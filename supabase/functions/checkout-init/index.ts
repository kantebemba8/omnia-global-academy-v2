import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

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
  const year = new Date().getFullYear();
  const suffix = Math.floor(100000 + Math.random() * 900000).toString();
  return `OMN-${year}-${suffix}`;
}

async function sha256hex(str: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
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

    if (coupon_code) {
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
          discountXof = coupon.discount_type === "percentage"
            ? Math.floor(originalPrice * coupon.discount_value / 100)
            : Math.min(coupon.discount_value, originalPrice);
          finalPrice = Math.max(0, originalPrice - discountXof);
          couponId = coupon.id;
          couponCodeApplied = coupon.code;
        }
      }
    }

    // License processing
    if (license_code) {
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
    const orderNum = generateOrderNumber();
    const idempotencyKey = await sha256hex(`${user.id}${course_id}${Date.now()}`);
    const { data: order, error: orderErr } = await sb.from("orders").insert({
      order_number: orderNum, user_id: user.id, course_id,
      original_price_xof: originalPrice, discount_xof: discountXof, final_price_xof: finalPrice,
      coupon_id: couponId, coupon_code: couponCodeApplied, license_id: licenseIdApplied,
      payment_status: "pending", payment_gateway: paymentProvider,
      idempotency_key: idempotencyKey,
    }).select("id, order_number").single();
    if (orderErr) throw orderErr;

    const fedaKey = Deno.env.get("FEDAPAY_SECRET_KEY") || "";
    const appUrl = Deno.env.get("APP_URL") || "https://omniaglobalacademy.com";
    const nameParts = (user.full_name || "").trim().split(/\s+/);
    const firstname = nameParts[0] || user.email.split("@")[0];
    const lastname = nameParts.slice(1).join(" ") || "-";

    const fedaRes = await fetch("https://api.fedapay.com/v1/transactions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${fedaKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        description: `Formation: ${course.title}`,
        amount: finalPrice,
        currency: { iso: "XOF" },
        callback_url: `${appUrl}/functions/v1/fedapay-webhook`,
        return_url: `${appUrl}/paiement/confirmation?order=${orderNum}`,
        cancel_url: `${appUrl}/paiement/echec?order=${orderNum}&course=${course_id}`,
        customer: {
          email: user.email,
          firstname,
          lastname,
          ...(user.phone_number ? { phone_number: { number: user.phone_number, country: user.country_code || "SN" } } : {}),
        },
        metadata: { order_id: order.id, order_number: order.order_number, user_id: user.id, course_id },
      }),
    });

    if (!fedaRes.ok) {
      await sb.from("orders").delete().eq("id", order.id);
      return new Response(JSON.stringify({ error: "PAYMENT_INIT_FAILED", message: "Impossible d'initialiser le paiement." }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const fedaData = await fedaRes.json();
    const txn = fedaData.v1Transaction || fedaData.transaction || fedaData;
    const fedapayId = txn?.id ? String(txn.id) : null;

    // Get checkout URL via token endpoint
    let checkoutUrl = `${appUrl}/paiement/echec?order=${orderNum}&course=${course_id}`;
    if (fedapayId) {
      try {
        const tokenRes = await fetch(`https://api.fedapay.com/v1/transactions/${fedapayId}/token`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${fedaKey}`, "Content-Type": "application/json" },
        });
        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          checkoutUrl = tokenData.url || tokenData.token_url || checkoutUrl;
        }
      } catch (_) { /* use fallback */ }
      await sb.from("orders").update({ fedapay_transaction_id: fedapayId }).eq("id", order.id);
    }

    return new Response(JSON.stringify({
      order_number: order.order_number,
      order_id: order.id,
      original_price: originalPrice,
      discount_xof: discountXof,
      final_price: finalPrice,
      coupon_applied: couponCodeApplied,
      payment_url: checkoutUrl,
      fedapay_token: fedapayId,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: "INTERNAL", message: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
