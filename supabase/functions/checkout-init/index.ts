import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-demo-heartbeat-token, x-omnia-session-token",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

async function verifySession(sb: ReturnType<typeof createClient>, token: string) {
  const { data: sess } = await sb.from("user_sessions").select("user_id")
    .eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!sess) return null;
  const { data: user } = await sb.from("users")
    .select("id, email, full_name, phone_number, country_code, status, ai_tokens")
    .eq("id", sess.user_id).maybeSingle();
  if (!user || user.status !== "actif") return null;
  return user;
}

function generateOrderNumber(): string {
  const year = new Date().getUTCFullYear();
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
  return `OMN-${year}-${suffix}`;
}

async function sha256hex(str: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}


type TrainingBenefitState = {
  discountXof: number;
  included: boolean;
  entitlementId: string | null;
  source: string | null;
};

function benefitNumber(value: Record<string, unknown> | null | undefined) {
  const raw = value?.value ?? value?.amount ?? value?.percentage ?? value?.quantity ?? 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function contentScopeAllows(value: Record<string, any>, course: Record<string, any>) {
  const scope = String(value?.scope || "all");
  if (scope === "all") return true;
  if (scope === "categories") return Array.isArray(value?.category_ids) && value.category_ids.includes(course.category);
  if (scope === "courses") return Array.isArray(value?.course_ids) && value.course_ids.includes(course.id);
  if (scope === "selected") return Array.isArray(value?.ids) && value.ids.includes(course.id);
  return false;
}

async function resolveTrainingBenefits(sb: ReturnType<typeof createClient>, userId: string, course: Record<string, any>, priceXof: number): Promise<TrainingBenefitState> {
  const keys = ["training_discount_percent", "training_discount_xof", "training_access_count", "training_catalog_access"];
  const { data: definitions } = await sb.from("commerce_benefit_definitions").select("id,benefit_key").in("benefit_key", keys).eq("is_active", true);
  if (!definitions?.length) return { discountXof: 0, included: false, entitlementId: null, source: null };
  const ids = definitions.map((row: any) => row.id);
  const keyById = new Map(definitions.map((row: any) => [String(row.id), String(row.benefit_key)]));
  const now = new Date().toISOString();
  const { data: entitlements } = await sb.from("commerce_entitlements").select("id,benefit_definition_id,value_json,remaining_quantity,valid_until,status")
    .eq("user_id", userId).in("benefit_definition_id", ids).eq("status", "active").lte("valid_from", now)
    .or(`valid_until.is.null,valid_until.gte.${now}`);
  let bestDiscount = 0;
  let included = false;
  let entitlementId: string | null = null;
  let source: string | null = null;
  for (const right of entitlements || []) {
    const key = keyById.get(String(right.benefit_definition_id));
    const value = (right.value_json || {}) as Record<string, any>;
    const scopeAllowed = contentScopeAllows(value, course);
    if (key === "training_catalog_access" && scopeAllowed) { included = true; source = key; entitlementId = null; }
    if (key === "training_access_count" && scopeAllowed && !included && (right.remaining_quantity === null || Number(right.remaining_quantity) >= 1)) { included = true; source = key; entitlementId = String(right.id); }
    if (key === "training_discount_percent" && scopeAllowed) bestDiscount = Math.max(bestDiscount, Math.floor(priceXof * benefitNumber(value) / 100));
    if (key === "training_discount_xof" && scopeAllowed) bestDiscount = Math.max(bestDiscount, Math.min(priceXof, Math.floor(benefitNumber(value))));
  }
  return { discountXof: Math.min(priceXof, bestDiscount), included, entitlementId, source };
}

async function consumeTrainingInclusion(sb: ReturnType<typeof createClient>, userId: string, entitlementId: string | null, courseId: string) {
  if (!entitlementId) return;
  const { data: right } = await sb.from("commerce_entitlements").select("remaining_quantity").eq("id", entitlementId).eq("user_id", userId).single();
  if (!right || right.remaining_quantity === null || Number(right.remaining_quantity) < 1) throw new Error("TRAINING_ENTITLEMENT_EXHAUSTED");
  const remaining = Number(right.remaining_quantity) - 1;
  await sb.from("commerce_entitlements").update({ remaining_quantity: remaining, status: remaining <= 0 ? "exhausted" : "active" }).eq("id", entitlementId);
  await sb.from("commerce_usage_ledger").insert({ entitlement_id: entitlementId, user_id: userId, quantity: 1, module_key: "formations", action_key: "training_access_count", reference_type: "course", reference_id: courseId });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("x-omnia-session-token") || req.headers.get("Authorization") || "")
      .replace(/^Bearer\s+/i, "").trim();
    if (!token) return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const user = await verifySession(sb, token);
    if (!user) return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const { course_id, coupon_code, license_code } = body;
    if (!course_id) return new Response(JSON.stringify({ error: "MISSING_COURSE_ID" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: course } = await sb.from("courses")
      .select("id, title, price_xof, is_free, is_published, creator_id, category, level, cpd_accredited, is_assisted, cover_image_url")
      .eq("id", course_id).maybeSingle();
    if (!course || !course.is_published) {
      return new Response(JSON.stringify({ error: "COURSE_NOT_FOUND" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (course.creator_id === user.id) {
      return new Response(JSON.stringify({ error: "SELF_PURCHASE_FORBIDDEN", message: "Vous ne pouvez pas acheter votre propre formation." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: enrolled } = await sb.from("user_enrollments").select("id").eq("user_id", user.id).eq("course_id", course_id).maybeSingle();
    if (enrolled) {
      return new Response(JSON.stringify({ error: "ALREADY_ENROLLED", message: "Vous êtes déjà inscrit à cette formation." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let originalPrice = course.price_xof || 0;
    let discountXof = 0;
    let finalPrice = originalPrice;
    let couponId: string | null = null;
    let couponCodeApplied: string | null = null;
    let licenseIdApplied: string | null = null;
    const commerceBenefit = await resolveTrainingBenefits(sb, user.id, course, originalPrice);
    if (commerceBenefit.included) {
      discountXof = originalPrice;
      finalPrice = 0;
    } else if (commerceBenefit.discountXof > 0) {
      discountXof = commerceBenefit.discountXof;
      finalPrice = Math.max(0, originalPrice - discountXof);
    }

    if (coupon_code && !commerceBenefit.included) {
      const { data: coupon } = await sb.from("coupons").select("*").eq("code", coupon_code.toUpperCase()).eq("is_active", true).maybeSingle();
      if (coupon) {
        const now = new Date().toISOString();
        const expired = coupon.expires_at && coupon.expires_at < now;
        const maxed = coupon.max_uses !== null && coupon.used_count >= coupon.max_uses;
        const { data: alreadyUsed } = await sb.from("coupon_usages").select("id").eq("coupon_id", coupon.id).eq("user_id", user.id).maybeSingle();
        const scopeOk = coupon.applicable_to === "all" ||
          (coupon.applicable_to === "category" && coupon.applicable_id === course.category) ||
          (coupon.applicable_to === "course" && coupon.applicable_id === course_id);

        if (!expired && !maxed && !alreadyUsed && scopeOk) {
          const couponDiscount = coupon.discount_type === "percentage"
            ? Math.floor(originalPrice * coupon.discount_value / 100)
            : Math.min(coupon.discount_value, originalPrice);
          if (couponDiscount > discountXof) {
            discountXof = couponDiscount;
            finalPrice = Math.max(0, originalPrice - discountXof);
            couponId = coupon.id;
            couponCodeApplied = coupon.code;
          }
        }
      }
    }

    // License processing
    if (license_code && !commerceBenefit.included) {
      const { data: license } = await sb.from("group_licenses").select("*").eq("code", String(license_code).toUpperCase()).eq("is_active", true).maybeSingle().catch(() => ({ data: null }));
      if (license && license.course_id === course_id) {
        licenseIdApplied = license.id;
        const expired = license.expires_at && new Date(license.expires_at) < new Date();
        const full = license.used_seats >= license.max_seats;
        if (!expired && !full) {
          if (license.price_per_seat_xof === 0) {
            const orderNum = generateOrderNumber();
            await sb.from("orders").insert({
              order_number: orderNum, user_id: user.id, course_id,
              original_price_xof: originalPrice, discount_xof: originalPrice,
              final_price_xof: 0, license_id: license.id,
              payment_status: "completed", payment_gateway: "free",
              paid_at: new Date().toISOString(),
            });
            await sb.from("user_enrollments").insert({ user_id: user.id, course_id, enrolled_at: new Date().toISOString() });
            await sb.from("group_licenses").update({ used_seats: (license.used_seats || 0) + 1 }).eq("id", license.id);
            await sb.from("license_usages").upsert({ license_id: license.id, user_id: user.id }, { onConflict: "license_id,user_id" });
            return new Response(JSON.stringify({ enrolled: true, free_license: true, course_id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          finalPrice = license.price_per_seat_xof;
          discountXof = Math.max(0, originalPrice - finalPrice);
        }
      }
    }

    // Free course
    if (course.is_free || finalPrice === 0) {
      const orderNum = generateOrderNumber();
      const { data: freeOrder } = await sb.from("orders").insert({
        order_number: orderNum, user_id: user.id, course_id,
        original_price_xof: originalPrice, discount_xof: discountXof, final_price_xof: 0,
        coupon_id: couponId, coupon_code: couponCodeApplied, license_id: licenseIdApplied,
        payment_status: "completed", payment_gateway: "free",
        paid_at: new Date().toISOString(),
      }).select("id").single();
      await sb.from("user_enrollments").insert({ user_id: user.id, course_id, enrolled_at: new Date().toISOString() });
      await consumeTrainingInclusion(sb, user.id, commerceBenefit.entitlementId, course_id);
      if (couponId && freeOrder) {
        await sb.from("coupons").update({ used_count: (await sb.from("coupons").select("used_count").eq("id", couponId).single().then(r => r.data?.used_count || 0)) + 1 }).eq("id", couponId);
        await sb.from("coupon_usages").insert({ coupon_id: couponId, user_id: user.id, order_id: freeOrder.id, discount_applied_xof: discountXof });
      }
      return new Response(JSON.stringify({ enrolled: true, free_license: false, course_id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Create pending order
    const { data: providerSetting } = await sb.from("site_settings").select("value").eq("key", "payment_provider_primary").maybeSingle();
    const paymentProvider = String(providerSetting?.value || "fedapay");
    if (paymentProvider !== "fedapay") {
      return new Response(JSON.stringify({ error: "PAYMENT_PROVIDER_NOT_IMPLEMENTED", message: `Le prestataire ${paymentProvider} n\'est pas encore connecté au checkout.` }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const fedaKey = Deno.env.get("FEDAPAY_SECRET_KEY") || "";
    if (!fedaKey) {
      return new Response(JSON.stringify({ error: "FEDAPAY_NOT_CONFIGURED", message: "Le paiement est temporairement indisponible." }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const mode = (Deno.env.get("FEDAPAY_MODE") || "live").toLowerCase();
    const fedaBase = mode === "sandbox" || mode === "test" ? "https://sandbox-api.fedapay.com/v1" : "https://api.fedapay.com/v1";
    const appUrl = Deno.env.get("APP_URL") || Deno.env.get("PUBLIC_APP_URL") || "https://omniaglobalacademy.com";

    async function checkoutUrlFor(transactionId: string): Promise<string | null> {
      const response = await fetch(`${fedaBase}/transactions/${encodeURIComponent(transactionId)}/token`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${fedaKey}`, "Content-Type": "application/json" },
      });
      if (!response.ok) return null;
      const tokenData = await response.json().catch(() => ({}));
      return tokenData.url || tokenData.token_url || tokenData.token || null;
    }

    const pendingSince = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    const { data: reusableOrder } = await sb.from("orders")
      .select("id,order_number,fedapay_transaction_id,gateway_reference")
      .eq("user_id", user.id)
      .eq("course_id", course_id)
      .eq("payment_status", "pending")
      .eq("final_price_xof", finalPrice)
      .gte("created_at", pendingSince)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (reusableOrder?.fedapay_transaction_id) {
      const reusedUrl = await checkoutUrlFor(String(reusableOrder.fedapay_transaction_id));
      if (reusedUrl) {
        return new Response(JSON.stringify({
          order_number: reusableOrder.order_number,
          order_id: reusableOrder.id,
          original_price: originalPrice,
          discount_xof: discountXof,
          final_price: finalPrice,
          coupon_applied: couponCodeApplied,
          subscription_discount_xof: commerceBenefit.discountXof,
          payment_url: reusedUrl,
          fedapay_token: String(reusableOrder.fedapay_transaction_id),
          reused: true,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const orderNum = generateOrderNumber();
    const requestedIdempotency = String(req.headers.get("Idempotency-Key") || body.idempotency_key || "").trim();
    const idempotencyKey = requestedIdempotency
      ? await sha256hex(`${user.id}:${course_id}:${requestedIdempotency}`)
      : await sha256hex(`${user.id}:${course_id}:${crypto.randomUUID()}`);
    const { data: order, error: orderErr } = await sb.from("orders").insert({
      order_number: orderNum, user_id: user.id, course_id,
      original_price_xof: originalPrice, discount_xof: discountXof, final_price_xof: finalPrice,
      coupon_id: couponId, coupon_code: couponCodeApplied, license_id: licenseIdApplied,
      payment_status: "pending", payment_gateway: paymentProvider,
      idempotency_key: idempotencyKey,
    }).select("id, order_number").single();
    if (orderErr) throw orderErr;

    const nameParts = (user.full_name || "").trim().split(/\s+/);
    const firstname = nameParts[0] || user.email.split("@")[0];
    const lastname = nameParts.slice(1).join(" ") || "-";

    const fedaRes = await fetch(`${fedaBase}/transactions`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${fedaKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        description: `Formation: ${course.title}`,
        amount: finalPrice,
        currency: { iso: "XOF" },
        callback_url: `${appUrl}/paiement/confirmation?order=${orderNum}`,
        merchant_reference: order.order_number,
        customer: {
          email: user.email,
          firstname,
          lastname,
          ...(user.phone_number ? { phone_number: { number: user.phone_number, country: user.country_code || "ML" } } : {}),
        },
        custom_metadata: { order_id: order.id, order_number: order.order_number, user_id: user.id, course_id },
      }),
    });

    const fedaData = await fedaRes.json().catch(() => ({}));
    if (!fedaRes.ok) {
      await sb.from("orders").update({ payment_status: "failed", gateway_reference: `init_error:${fedaRes.status}` }).eq("id", order.id);
      return new Response(JSON.stringify({ error: "PAYMENT_INIT_FAILED", message: "Impossible d'initialiser le paiement." }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const txn = fedaData.v1Transaction || fedaData.transaction || fedaData;
    const fedapayId = txn?.id ? String(txn.id) : "";
    const providerReference = txn?.reference ? String(txn.reference) : null;
    if (!fedapayId) {
      await sb.from("orders").update({ payment_status: "failed", gateway_reference: "transaction_id_missing" }).eq("id", order.id);
      return new Response(JSON.stringify({ error: "PAYMENT_INIT_FAILED", message: "Réponse de paiement incomplète." }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await sb.from("orders").update({
      fedapay_transaction_id: fedapayId,
      gateway_reference: providerReference,
    }).eq("id", order.id);

    const checkoutUrl = await checkoutUrlFor(fedapayId);
    if (!checkoutUrl) {
      await sb.from("orders").update({ payment_status: "failed" }).eq("id", order.id);
      return new Response(JSON.stringify({ error: "PAYMENT_LINK_FAILED", message: "Le lien de paiement n'a pas pu être généré." }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      order_number: order.order_number,
      order_id: order.id,
      original_price: originalPrice,
      discount_xof: discountXof,
      final_price: finalPrice,
      coupon_applied: couponCodeApplied,
      subscription_discount_xof: commerceBenefit.discountXof,
      payment_url: checkoutUrl,
      fedapay_token: fedapayId,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: "INTERNAL", message: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
