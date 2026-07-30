import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-demo-heartbeat-token, x-omnia-session-token",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

type SB = ReturnType<typeof createClient>;
type UserContext = { id: string; email: string; full_name: string; phone_number?: string | null; country_code?: string | null; roles: string[] };

function bearer(req: Request) {
  return (req.headers.get("x-omnia-session-token") || req.headers.get("Authorization") || "")
    .replace(/^Bearer\s+/i, "").trim();
}

async function context(sb: SB, req: Request): Promise<UserContext | null> {
  const token = bearer(req);
  if (!token) return null;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (token === service) return { id: "service", email: "service@omnia.local", full_name: "Service", roles: ["service_role"] };
  const { data: session } = await sb.from("user_sessions").select("user_id").eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!session) return null;
  const [{ data: user }, { data: roles }] = await Promise.all([
    sb.from("users").select("id,email,full_name,phone_number,country_code,status").eq("id", session.user_id).maybeSingle(),
    sb.from("user_roles").select("role").eq("user_id", session.user_id),
  ]);
  if (!user || user.status !== "actif") return null;
  return { ...user, roles: (roles || []).map((row: { role: string }) => row.role) } as UserContext;
}

const isAdmin = (ctx: UserContext | null) => Boolean(ctx?.roles.includes("super_admin"));
const isService = (ctx: UserContext | null) => Boolean(ctx?.roles.includes("service_role"));

function orderNumber() {
  return `COM-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}
async function sha256(value: string) {
  const out = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(out)).map(v => v.toString(16).padStart(2, "0")).join("");
}
function addDays(date: Date, days: number | null) {
  if (days === null) return null;
  return new Date(date.getTime() + days * 86400000).toISOString();
}
function durationDays(source: Record<string, unknown>) {
  const interval = String(source.billing_interval || "none");
  const count = Math.max(1, Number(source.interval_count || 1));
  if (interval === "week") return 7 * count;
  if (interval === "month") return 30 * count;
  if (interval === "quarter") return 90 * count;
  if (interval === "semester") return 182 * count;
  if (interval === "year") return 365 * count;
  if (interval === "custom") return Math.max(1, Number(source.custom_duration_days || 30));
  if (interval === "lifetime") return null;
  return Number(source.custom_duration_days || 0) || null;
}
function valueQuantity(value: Record<string, unknown>) {
  const raw = value.quantity ?? value.value ?? value.amount ?? value.capacity ?? value.credits;
  const number = Number(raw);
  return Number.isFinite(number) ? number : null;
}


async function signDocumentList(sb: SB, documents: unknown) {
  const list = Array.isArray(documents) ? documents : [];
  return Promise.all(list.map(async (item: any) => {
    const path = String(item?.path || "");
    if (!path) return item;
    const { data } = await sb.storage.from("commerce-documents").createSignedUrl(path, 3600);
    return { ...item, signed_url: data?.signedUrl || null };
  }));
}

async function audit(sb: SB, actor: string | null, action: string, entityType: string, entityId: string | null, before: unknown, after: unknown, reason?: string) {
  await sb.from("commerce_audit_log").insert({ actor_user_id: actor === "service" ? null : actor, action, entity_type: entityType, entity_id: entityId, before_json: before ?? null, after_json: after ?? null, reason: reason || null });
}

async function creatorAllowed(sb: SB, ctx: UserContext, moduleKey: string) {
  if (isAdmin(ctx)) return false;
  if (moduleKey === "coaching") {
    if (ctx.roles.includes("coach")) return true;
    const { data } = await sb.from("coach_profiles").select("id").eq("user_id", ctx.id).maybeSingle();
    return Boolean(data);
  }
  if (moduleKey === "omnia_live") {
    if (ctx.roles.includes("organizer") || ctx.roles.includes("organisateur")) return true;
    const { data } = await sb.from("live_organizer_profiles").select("id").eq("user_id", ctx.id).maybeSingle();
    return Boolean(data);
  }
  return false;
}

async function audienceAllowed(sb: SB, ctx: UserContext, audience: string) {
  if (audience === "global") return true;
  if (isAdmin(ctx)) return false;
  const roleMap: Record<string, string[]> = {
    learner: ["apprenant"],
    coach: ["coach"],
    organizer: ["organizer", "organisateur"],
    recruiter: ["recruteur_independant", "recruteur"],
    structure: ["responsable_structure", "structure_admin", "gestionnaire_partenaire", "recruteur_structure"],
    professor: ["professeur"],
  };
  if ((roleMap[audience] || []).some(role => ctx.roles.includes(role))) return true;
  if (audience === "coach") return Boolean((await sb.from("coach_profiles").select("id").eq("user_id", ctx.id).maybeSingle()).data);
  if (audience === "organizer") return Boolean((await sb.from("live_organizer_profiles").select("id").eq("user_id", ctx.id).maybeSingle()).data);
  if (audience === "recruiter") return Boolean((await sb.from("talent_recruiter_profiles").select("id").eq("user_id", ctx.id).eq("status", "approved").maybeSingle()).data);
  if (audience === "structure") return Boolean((await sb.from("partner_managers").select("id").eq("user_id", ctx.id).eq("status", "actif").maybeSingle()).data);
  return false;
}

async function userCapacity(sb: SB, userId: string, benefitKey: string) {
  const { data: definition } = await sb.from("commerce_benefit_definitions").select("id").eq("benefit_key", benefitKey).eq("is_active", true).maybeSingle();
  if (!definition) return null;
  const now = new Date().toISOString();
  const { data: rights } = await sb.from("commerce_entitlements").select("value_json").eq("user_id", userId).eq("benefit_definition_id", definition.id).eq("status", "active").lte("valid_from", now).or(`valid_until.is.null,valid_until.gte.${now}`);
  const values = (rights || []).map((row: any) => Number(row.value_json?.value ?? row.value_json?.capacity ?? row.value_json?.quantity)).filter((value: number) => Number.isFinite(value) && value >= 0);
  return values.length ? Math.max(...values) : null;
}

async function activeSubscriptionExists(sb: SB, userId: string, planId: string | null, offerId: string | null) {
  let query = sb.from("commerce_subscriptions").select("id,current_period_end,status").eq("user_id", userId).in("status", ["trial", "active", "grace", "past_due"]);
  query = planId ? query.eq("plan_id", planId) : query.eq("creator_offer_id", offerId);
  const { data } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!data) return null;
  if (data.current_period_end && new Date(data.current_period_end) <= new Date()) return null;
  return data;
}

async function grantEntitlements(sb: SB, order: Record<string, any>) {
  const now = new Date();
  let benefits: Array<{ definition_id: string; value_json: Record<string, unknown>; reset_period?: string | null }> = [];
  let source: Record<string, unknown> = {};
  let subscriptionId: string | null = null;
  let validUntil: string | null = null;

  if (order.plan_id) {
    const { data: plan } = await sb.from("commerce_plans").select("*").eq("id", order.plan_id).single();
    source = plan;
    const isTrialPlan = String(plan.commercial_type) === "trial";
    validUntil = isTrialPlan ? addDays(now, Math.max(1, Number(plan.trial_days || plan.custom_duration_days || 7))) : addDays(now, durationDays(plan));
    const { data: rows } = await sb.from("commerce_plan_benefits")
      .select("benefit_definition_id,value_json,commerce_benefit_definitions(reset_period)")
      .eq("plan_id", order.plan_id).eq("is_active", true);
    benefits = (rows || []).map((row: any) => ({ definition_id: row.benefit_definition_id, value_json: row.value_json || {}, reset_period: row.commerce_benefit_definitions?.reset_period || null }));
    const subscriptionLike = ["subscription", "trial"].includes(String(plan.commercial_type)) || String(plan.billing_interval) !== "none";
    if (subscriptionLike) {
      const trialDays = Number(plan.trial_days || 0);
      const isTrialPlan = String(plan.commercial_type) === "trial";
      const { data: subscription } = await sb.from("commerce_subscriptions").insert({
        user_id: order.buyer_user_id, plan_id: plan.id, source_order_id: order.id,
        status: isTrialPlan ? "trial" : "active", starts_at: now.toISOString(), current_period_start: now.toISOString(),
        current_period_end: validUntil, trial_ends_at: isTrialPlan ? validUntil : null,
        auto_renew: false,
        metadata: { requested_auto_renew: Boolean(plan.auto_renew), renewal_mode: "manual_checkout" },
      }).select("id").single();
      subscriptionId = subscription.id;
    }
  } else {
    const { data: offer } = await sb.from("commerce_creator_offers").select("*").eq("id", order.creator_offer_id).single();
    source = offer;
    validUntil = addDays(now, durationDays(offer));
    const rawBenefits = Array.isArray(offer.benefits_json) ? offer.benefits_json : [];
    const keys = rawBenefits.map((item: any) => item.benefit_key).filter(Boolean);
    const { data: defs } = keys.length ? await sb.from("commerce_benefit_definitions").select("id,benefit_key,reset_period").in("benefit_key", keys) : { data: [] as any[] };
    const map = new Map((defs || []).map((row: any) => [row.benefit_key, row]));
    benefits = rawBenefits.map((item: any) => {
      const def = map.get(item.benefit_key);
      return def ? { definition_id: def.id, value_json: item.value_json || item.value || {}, reset_period: def.reset_period } : null;
    }).filter(Boolean) as typeof benefits;
    if (offer.offer_kind === "subscription") {
      const { data: subscription } = await sb.from("commerce_subscriptions").insert({
        user_id: order.buyer_user_id, creator_offer_id: offer.id, source_order_id: order.id,
        status: "active", starts_at: now.toISOString(), current_period_start: now.toISOString(), current_period_end: validUntil, auto_renew: false,
      }).select("id").single();
      subscriptionId = subscription.id;
    }
  }

  if (benefits.length) {
    await sb.from("commerce_entitlements").insert(benefits.map(benefit => ({
      user_id: order.buyer_user_id,
      benefit_definition_id: benefit.definition_id,
      source_plan_id: order.plan_id || null,
      source_creator_offer_id: order.creator_offer_id || null,
      source_order_id: order.id,
      source_subscription_id: subscriptionId,
      value_json: benefit.value_json,
      remaining_quantity: valueQuantity(benefit.value_json),
      reset_period: benefit.reset_period,
      valid_from: now.toISOString(),
      valid_until: validUntil,
      status: "active",
      metadata: { source_name: String(source.name || source.title || "Offre Omnia") },
    })));
  }
  return { subscription_id: subscriptionId, valid_until: validUntil };
}

async function applyCreatorRevenue(sb: SB, order: Record<string, any>) {
  if (!order.creator_offer_id) return null;
  const { data: offer } = await sb.from("commerce_creator_offers").select("creator_user_id,approved_platform_percent,title,module_key,offer_kind").eq("id", order.creator_offer_id).single();
  let percent = offer.approved_platform_percent === null || offer.approved_platform_percent === undefined ? null : Number(offer.approved_platform_percent);
  let fixedFee = 0;
  if (percent === null) {
    const now = new Date().toISOString();
    const { data: rules } = await sb.from("commerce_commission_rules").select("*")
      .in("module_key", [offer.module_key, "global"]).eq("status", "active")
      .lte("valid_from", now).or(`valid_until.is.null,valid_until.gte.${now}`)
      .order("priority", { ascending: true });
    const rule = (rules || []).find((row: any) =>
      (!row.creator_user_id || row.creator_user_id === offer.creator_user_id) &&
      (!row.offer_type || row.offer_type === offer.offer_kind) &&
      Number(order.final_amount_xof || 0) >= Number(row.minimum_amount_xof || 0)
    );
    percent = Number(rule?.platform_percent ?? 20);
    fixedFee = Number(rule?.fixed_fee_xof ?? 0);
  }
  const gross = Number(order.final_amount_xof || 0);
  const fee = Math.min(gross, Math.round(gross * Number(percent) / 100) + fixedFee);
  const net = Math.max(0, gross - fee);
  const { data: existingBalance } = await sb.from("commerce_creator_balances").select("*").eq("creator_user_id", offer.creator_user_id).maybeSingle();
  if (existingBalance) {
    await sb.from("commerce_creator_balances").update({
      available_xof: Number(existingBalance.available_xof || 0) + net,
      lifetime_gross_xof: Number(existingBalance.lifetime_gross_xof || 0) + gross,
      lifetime_platform_fee_xof: Number(existingBalance.lifetime_platform_fee_xof || 0) + fee,
    }).eq("creator_user_id", offer.creator_user_id);
  } else {
    await sb.from("commerce_creator_balances").insert({
      creator_user_id: offer.creator_user_id,
      available_xof: net,
      lifetime_gross_xof: gross,
      lifetime_platform_fee_xof: fee,
    });
  }
  await sb.from("commerce_creator_ledger").insert({
    creator_user_id: offer.creator_user_id, order_id: order.id, entry_type: "sale_available",
    gross_xof: gross, platform_fee_xof: fee, net_xof: net, balance_bucket: "available",
    description: `Vente — ${offer.title}`, metadata: { module_key: offer.module_key, platform_percent: Number(percent), fixed_fee_xof: fixedFee },
  });
  return { creator_user_id: offer.creator_user_id, gross_xof: gross, platform_fee_xof: fee, net_xof: net };
}

async function activateOrder(sb: SB, orderId: string, providerId?: string, providerReference?: string, payload?: unknown) {
  const { data: order } = await sb.from("commerce_orders").select("*").eq("id", orderId).single();
  if (order.payment_status === "completed") return { already_completed: true, order };
  await sb.from("commerce_orders").update({ payment_status: "completed", provider_transaction_id: providerId || order.provider_transaction_id, provider_reference: providerReference || null, paid_at: new Date().toISOString(), metadata: { ...(order.metadata || {}), provider_payload: payload || null } }).eq("id", orderId);
  if (order.promotion_id) {
    const redemption = await sb.from("commerce_promotion_redemptions").insert({ promotion_id: order.promotion_id, user_id: order.buyer_user_id, order_id: order.id, discount_xof: Number(order.discount_xof || 0) });
    if (!redemption.error) {
      const { data: promotion } = await sb.from("commerce_promotions").select("used_count").eq("id", order.promotion_id).single();
      await sb.from("commerce_promotions").update({ used_count: Number(promotion?.used_count || 0) + 1 }).eq("id", order.promotion_id);
    }
  }
  const entitlement = await grantEntitlements(sb, order);
  const revenue = await applyCreatorRevenue(sb, order);
  return { order: { ...order, payment_status: "completed" }, entitlement, revenue };
}

function commerceReturnPath(product: Record<string, any>, isPlan: boolean) {
  if (!isPlan) return "/dashboard/abonnements";
  const audience = String(product.audience || "learner");
  if (audience === "recruiter") return "/talent/recruteur/plans";
  if (audience === "structure") return "/structure/abonnements";
  if (audience === "coach") return "/coach/plan-omnia";
  if (audience === "organizer") return "/omnia-live/organisateur/plan-omnia";
  if (audience === "professor") return "/professeur/dashboard";
  return "/dashboard/abonnements";
}

async function createFedaPay(order: Record<string, any>, user: UserContext, label: string, returnPath: string) {
  const key = Deno.env.get("FEDAPAY_SECRET_KEY") || "";
  if (!key) throw new Error("FEDAPAY_NOT_CONFIGURED");
  const mode = (Deno.env.get("FEDAPAY_MODE") || "live").toLowerCase();
  const base = mode === "sandbox" || mode === "test" ? "https://sandbox-api.fedapay.com/v1" : "https://api.fedapay.com/v1";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const appUrl = Deno.env.get("APP_URL") || Deno.env.get("PUBLIC_APP_URL") || "https://omniaglobalacademy.com";
  const parts = (user.full_name || "").trim().split(/\s+/);
  const transactionResponse = await fetch(`${base}/transactions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      description: label,
      amount: Number(order.final_amount_xof),
      currency: { iso: "XOF" },
      callback_url: `${supabaseUrl}/functions/v1/fedapay-webhook`,
      return_url: `${appUrl}${returnPath}?payment=success&order=${order.order_number}`,
      cancel_url: `${appUrl}${returnPath}?payment=cancelled&order=${order.order_number}`,
      merchant_reference: order.order_number,
      customer: {
        email: user.email,
        firstname: parts[0] || user.email.split("@")[0],
        lastname: parts.slice(1).join(" ") || "-",
        ...(user.phone_number ? { phone_number: { number: user.phone_number, country: user.country_code || "ML" } } : {}),
      },
      custom_metadata: { commerce_order_id: order.id, resource_type: "central_commerce", buyer_user_id: user.id },
    }),
  });
  const transactionBody = await transactionResponse.json().catch(() => ({}));
  if (!transactionResponse.ok) throw new Error(String(transactionBody?.message || transactionBody?.error || "FEDAPAY_TRANSACTION_FAILED"));
  const providerId = String(transactionBody.id || transactionBody.v1Transaction?.id || transactionBody.transaction?.id || transactionBody.v1?.transaction?.id || "");
  if (!providerId) throw new Error("FEDAPAY_TRANSACTION_ID_MISSING");
  const tokenResponse = await fetch(`${base}/transactions/${providerId}/token`, { method: "POST", headers: { Authorization: `Bearer ${key}` } });
  const tokenBody = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !tokenBody.url) throw new Error(String(tokenBody?.message || "FEDAPAY_PAYMENT_LINK_FAILED"));
  return { provider_id: providerId, provider_reference: String(transactionBody.reference || transactionBody.v1Transaction?.reference || transactionBody.transaction?.reference || ""), payment_url: String(tokenBody.url), return_url: `${appUrl}${returnPath}?payment=return&order=${order.order_number}` };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const url = new URL(req.url);
    const body = req.method === "GET" ? {} : await req.json().catch(() => ({}));
    const action = String(url.searchParams.get("action") || body.action || "public_catalog");

    if (action === "public_catalog") {
      const { data: plans } = await sb.from("commerce_plans").select("id,code,name,subtitle,description,audience,commercial_type,billing_interval,interval_count,custom_duration_days,price_xof,currency,trial_days,auto_renew,visibility,status,starts_at,ends_at,max_subscribers,country_codes,display_order,badge_label,terms_text,version,commerce_plan_benefits(id,benefit_definition_id,value_json,display_label,display_order,is_active,commerce_benefit_definitions(id,benefit_key,module_key,name,description,value_type,unit_label,reset_period,allowed_audiences,configuration_schema,is_active,is_system))").eq("status", "active").in("visibility", ["public", "code", "structure_only"]).order("display_order");
      const { data: offers } = await sb.from("commerce_creator_offers").select("id,module_key,offer_kind,title,description,billing_interval,price_xof,approved_price_xof,currency,benefits_json,capacity,creator_user_id,users!commerce_creator_offers_creator_user_id_fkey(full_name)").eq("status", "published").order("published_at", { ascending: false });
      return json({ plans: plans || [], creator_offers: (offers || []).map((offer: any) => ({ ...offer, price_xof: Number(offer.approved_price_xof ?? offer.price_xof) })) });
    }

    const ctx = await context(sb, req);
    if (!ctx) return json({ error: "UNAUTHORIZED" }, 401);

    if (action === "prepare_document_upload") {
      const moduleKey = String(body.module_key || "commerce").replace(/[^a-z0-9_-]/gi, "");
      if (!isAdmin(ctx) && !(await creatorAllowed(sb, ctx, moduleKey))) return json({ error: "CREATOR_PERMISSION_REQUIRED" }, 403);
      const fileName = String(body.file_name || "document").replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${ctx.id}/${moduleKey}/${crypto.randomUUID()}-${fileName}`;
      const { data, error } = await sb.storage.from("commerce-documents").createSignedUploadUrl(path);
      if (error) throw error;
      return json({ path, token: data.token, signed_url: data.signedUrl });
    }

    if (action === "my_overview") {
      const now = new Date().toISOString();
      await Promise.all([
        sb.from("commerce_subscriptions").update({ status: "expired" }).eq("user_id", ctx.id).in("status", ["trial", "active", "grace", "past_due"]).lt("current_period_end", now),
        sb.from("commerce_entitlements").update({ status: "expired" }).eq("user_id", ctx.id).eq("status", "active").lt("valid_until", now),
      ]);
      const [{ data: subscriptions }, { data: entitlements }, { data: orders }] = await Promise.all([
        sb.from("commerce_subscriptions").select("*,commerce_plans(name,audience),commerce_creator_offers(title,module_key)").eq("user_id", ctx.id).order("created_at", { ascending: false }),
        sb.from("commerce_entitlements").select("*,commerce_benefit_definitions(benefit_key,module_key,name,unit_label,value_type)").eq("user_id", ctx.id).order("created_at", { ascending: false }),
        sb.from("commerce_orders").select("id,order_number,order_type,final_amount_xof,payment_status,paid_at,created_at,commerce_plans(name),commerce_creator_offers(title)").eq("buyer_user_id", ctx.id).order("created_at", { ascending: false }).limit(30),
      ]);
      return json({ subscriptions: subscriptions || [], entitlements: entitlements || [], orders: orders || [] });
    }

    if (action === "checkout_create") {
      const planId = body.plan_id ? String(body.plan_id) : null;
      const offerId = body.creator_offer_id ? String(body.creator_offer_id) : null;
      if ((planId ? 1 : 0) + (offerId ? 1 : 0) !== 1) return json({ error: "ONE_PRODUCT_REQUIRED" }, 400);
      let product: any;
      let label: string;
      if (planId) {
        const { data } = await sb.from("commerce_plans").select("*").eq("id", planId).eq("status", "active").maybeSingle();
        if (!data) return json({ error: "PLAN_NOT_AVAILABLE" }, 404);
        if (!(await audienceAllowed(sb, ctx, String(data.audience)))) return json({ error: "PLAN_AUDIENCE_NOT_ALLOWED" }, 403);
        const now = new Date();
        if (data.starts_at && new Date(data.starts_at) > now) return json({ error: "PLAN_NOT_STARTED" }, 409);
        if (data.ends_at && new Date(data.ends_at) <= now) return json({ error: "PLAN_ENDED" }, 409);
        if (Array.isArray(data.country_codes) && data.country_codes.length && (!ctx.country_code || !data.country_codes.includes(ctx.country_code))) return json({ error: "PLAN_COUNTRY_NOT_ALLOWED" }, 403);
        if (data.visibility === "private") return json({ error: "PLAN_PRIVATE_ADMIN_GRANT_ONLY" }, 403);
        if (data.visibility === "code" && String(body.access_code || "").trim() !== String(data.eligibility?.access_code || "").trim()) return json({ error: "PLAN_ACCESS_CODE_INVALID" }, 403);
        if (data.max_subscribers) {
          const { count } = await sb.from("commerce_subscriptions").select("id", { count: "exact", head: true }).eq("plan_id", data.id).in("status", ["trial", "active", "grace", "past_due"]);
          if (Number(count || 0) >= Number(data.max_subscribers)) return json({ error: "PLAN_CAPACITY_REACHED" }, 409);
        }
        if (["subscription", "trial"].includes(String(data.commercial_type)) || String(data.billing_interval) !== "none") {
          const existing = await activeSubscriptionExists(sb, ctx.id, planId, null);
          if (existing) return json({ error: "ALREADY_SUBSCRIBED", subscription: existing }, 409);
        }
        product = data; label = `Abonnement Omnia — ${data.name}`;
      } else {
        const { data } = await sb.from("commerce_creator_offers").select("*").eq("id", offerId).eq("status", "published").maybeSingle();
        if (!data) return json({ error: "OFFER_NOT_AVAILABLE" }, 404);
        if (data.creator_user_id === ctx.id) return json({ error: "SELF_PURCHASE_FORBIDDEN" }, 400);
        if (data.offer_kind === "subscription") {
          const existing = await activeSubscriptionExists(sb, ctx.id, null, offerId);
          if (existing) return json({ error: "ALREADY_SUBSCRIBED", subscription: existing }, 409);
        }
        if (data.capacity) {
          const { count } = await sb.from("commerce_orders").select("id", { count: "exact", head: true }).eq("creator_offer_id", data.id).eq("payment_status", "completed");
          if (Number(count || 0) >= Number(data.capacity)) return json({ error: "OFFER_CAPACITY_REACHED" }, 409);
        }
        product = { ...data, price_xof: Number(data.approved_price_xof ?? data.price_xof) }; label = `${data.module_key === "coaching" ? "Coaching" : "Omnia Live"} — ${data.title}`;
      }
      let discount = 0;
      let promotionId: string | null = null;
      if (body.promotion_code) {
        const { data: promotion } = await sb.from("commerce_promotions").select("*").eq("code", String(body.promotion_code).toUpperCase()).eq("is_active", true).maybeSingle();
        if (promotion && (!promotion.ends_at || new Date(promotion.ends_at) > new Date()) && (!promotion.starts_at || new Date(promotion.starts_at) <= new Date()) && (!promotion.max_uses || promotion.used_count < promotion.max_uses)) {
          const applicable = !planId || !promotion.applicable_plan_ids?.length || promotion.applicable_plan_ids.includes(planId);
          const audienceOk = !promotion.audience?.length || (planId && promotion.audience.includes(product.audience));
          const countryOk = !promotion.country_codes?.length || Boolean(ctx.country_code && promotion.country_codes.includes(ctx.country_code));
          const { count: userUses } = await sb.from("commerce_promotion_redemptions").select("id", { count: "exact", head: true }).eq("promotion_id", promotion.id).eq("user_id", ctx.id);
          const perUserOk = Number(userUses || 0) < Number(promotion.max_uses_per_user || 1);
          let firstPurchaseOk = true;
          if (promotion.first_purchase_only) {
            const { count: previousOrders } = await sb.from("commerce_orders").select("id", { count: "exact", head: true }).eq("buyer_user_id", ctx.id).eq("payment_status", "completed");
            firstPurchaseOk = Number(previousOrders || 0) === 0;
          }
          if (applicable && audienceOk && countryOk && perUserOk && firstPurchaseOk) {
            discount = promotion.discount_type === "percentage" ? Math.floor(Number(product.price_xof) * Number(promotion.discount_value) / 100) : ["fixed", "credit"].includes(promotion.discount_type) ? Math.min(Number(product.price_xof), Number(promotion.discount_value)) : 0;
            promotionId = promotion.id;
          }
        }
      }
      const finalAmount = Math.max(0, Number(product.price_xof) - discount);
      const number = orderNumber();
      const idempotency = await sha256(`${ctx.id}:${planId || offerId}:${number}`);
      const { data: order, error } = await sb.from("commerce_orders").insert({
        order_number: number, buyer_user_id: ctx.id, plan_id: planId, creator_offer_id: offerId,
        order_type: planId ? "plan" : "creator_offer", original_amount_xof: Number(product.price_xof), discount_xof: discount,
        final_amount_xof: finalAmount, payment_status: "pending", idempotency_key: idempotency,
        promotion_id: promotionId, metadata: { source: "commerce-engine" },
      }).select("*").single();
      if (error) throw error;
      if (finalAmount === 0) {
        const result = await activateOrder(sb, order.id, "free", "free");
        return json({ completed: true, order_number: number, result });
      }
      try {
        const provider = await createFedaPay(order, ctx, label, commerceReturnPath(product, Boolean(planId)));
        await sb.from("commerce_orders").update({ provider_transaction_id: provider.provider_id, provider_reference: provider.provider_reference, payment_url: provider.payment_url, payment_status: "processing" }).eq("id", order.id);
        return json({ completed: false, order_number: number, payment_url: provider.payment_url, provider: "fedapay" });
      } catch (providerError) {
        await sb.from("commerce_orders").update({ payment_status: "failed", failed_at: new Date().toISOString(), metadata: { ...(order.metadata || {}), provider_error: providerError instanceof Error ? providerError.message : String(providerError) } }).eq("id", order.id);
        throw providerError;
      }
    }

    if (action === "subscription_cancel") {
      const id = String(body.subscription_id || "");
      const { data: current } = await sb.from("commerce_subscriptions").select("*").eq("id", id).eq("user_id", ctx.id).maybeSingle();
      if (!current) return json({ error: "SUBSCRIPTION_NOT_FOUND" }, 404);
      if (["cancelled", "expired", "refunded"].includes(current.status)) return json({ subscription: current, already_final: true });
      const immediate = Boolean(body.immediate);
      const updates = immediate
        ? { status: "cancelled", cancel_at_period_end: false, auto_renew: false, cancelled_at: new Date().toISOString(), cancellation_reason: String(body.reason || "Annulation utilisateur") }
        : { cancel_at_period_end: true, auto_renew: false, cancellation_reason: String(body.reason || "Annulation à la fin de la période") };
      const { data } = await sb.from("commerce_subscriptions").update(updates).eq("id", id).select("*").single();
      if (immediate) await sb.from("commerce_entitlements").update({ status: "revoked" }).eq("source_subscription_id", id).eq("status", "active");
      await audit(sb, ctx.id, "subscription_cancel", "subscription", id, current, data, String(body.reason || ""));
      return json({ subscription: data });
    }

    if (action === "entitlement_check" || action === "entitlement_consume") {
      const key = String(body.benefit_key || "");
      const quantity = Math.max(0, Number(body.quantity || 1));
      const { data: definition } = await sb.from("commerce_benefit_definitions").select("id,benefit_key,value_type").eq("benefit_key", key).eq("is_active", true).maybeSingle();
      if (!definition) return json({ allowed: false, reason: "BENEFIT_NOT_FOUND" }, 404);
      const now = new Date().toISOString();
      const { data: rights } = await sb.from("commerce_entitlements").select("*").eq("user_id", ctx.id).eq("benefit_definition_id", definition.id).eq("status", "active").lte("valid_from", now).or(`valid_until.is.null,valid_until.gte.${now}`).order("valid_until", { ascending: true, nullsFirst: false });
      const right = (rights || []).find((r: any) => r.remaining_quantity === null || Number(r.remaining_quantity) >= quantity);
      if (!right) return json({ allowed: false, reason: "NO_ACTIVE_ENTITLEMENT" });
      if (action === "entitlement_consume" && quantity > 0 && right.remaining_quantity !== null) {
        const remaining = Number(right.remaining_quantity) - quantity;
        await sb.from("commerce_entitlements").update({ remaining_quantity: remaining, status: remaining <= 0 ? "exhausted" : "active" }).eq("id", right.id);
        await sb.from("commerce_usage_ledger").insert({ entitlement_id: right.id, user_id: ctx.id, quantity, module_key: String(body.module_key || definition.benefit_key.split("_")[0]), action_key: String(body.action_key || key), reference_type: body.reference_type || null, reference_id: body.reference_id || null, notes: body.notes || null });
      }
      return json({ allowed: true, entitlement: right });
    }

    if (action.startsWith("creator_")) {
      const moduleKey = String(body.module_key || url.searchParams.get("module_key") || "coaching");
      if (!(await creatorAllowed(sb, ctx, moduleKey))) return json({ error: "CREATOR_PERMISSION_REQUIRED" }, 403);
      if (action === "creator_dashboard") {
        const offerBenefitKeys = moduleKey === "coaching"
          ? ["coaching_session_credits", "coaching_discount_percent"]
          : ["live_access_count", "live_replay_access"];
        const [{ data: offers }, { data: balance }, { data: ledger }, { data: payouts }, { data: benefits }] = await Promise.all([
          sb.from("commerce_creator_offers").select("*").eq("creator_user_id", ctx.id).eq("module_key", moduleKey).order("created_at", { ascending: false }),
          sb.from("commerce_creator_balances").select("*").eq("creator_user_id", ctx.id).maybeSingle(),
          sb.from("commerce_creator_ledger").select("*").eq("creator_user_id", ctx.id).order("created_at", { ascending: false }).limit(30),
          sb.from("commerce_payout_requests").select("*").eq("creator_user_id", ctx.id).order("requested_at", { ascending: false }).limit(20),
          sb.from("commerce_benefit_definitions").select("*").eq("is_active", true).in("benefit_key", offerBenefitKeys).order("name"),
        ]);
        const signedOffers = await Promise.all((offers || []).map(async (offer: any) => ({ ...offer, supporting_documents: await signDocumentList(sb, offer.supporting_documents) })));
        return json({ offers: signedOffers, balance: balance || { available_xof: 0, pending_xof: 0, reserved_xof: 0 }, ledger: ledger || [], payouts: payouts || [], benefits: benefits || [] });
      }
      if (action === "creator_offer_save") {
        const id = body.id ? String(body.id) : null;
        const offerKind = String(body.offer_kind || "pack");
        if (!["pack", "subscription"].includes(offerKind)) return json({ error: "CENTRAL_OFFER_KIND_NOT_ALLOWED", message: "Les ventes unitaires restent gérées par le module métier ; utilisez un pack ou un abonnement central." }, 400);
        if (!id && moduleKey === "coaching") {
          const capacity = await userCapacity(sb, ctx.id, "coach_offer_limit");
          if (capacity !== null) {
            const { count } = await sb.from("commerce_creator_offers").select("id", { count: "exact", head: true }).eq("creator_user_id", ctx.id).eq("module_key", moduleKey).not("status", "in", '(archived,rejected)');
            if (Number(count || 0) >= capacity) return json({ error: "COACH_OFFER_LIMIT_REACHED", message: "La limite d'offres prévue par votre plan Coach Omnia est atteinte." }, 409);
          }
        }
        const payload = {
          creator_user_id: ctx.id, module_key: moduleKey, offer_kind: offerKind,
          title: String(body.title || "").trim(), description: String(body.description || "").trim(),
          billing_interval: offerKind === "subscription" ? String(body.billing_interval || "month") : "none",
          interval_count: Math.max(1, Number(body.interval_count || 1)), custom_duration_days: body.custom_duration_days || null,
          price_xof: Math.max(0, Math.round(Number(body.price_xof || 0))), benefits_json: Array.isArray(body.benefits_json) ? body.benefits_json : [],
          capacity: body.capacity || null, justification: String(body.justification || "").trim(),
          supporting_documents: Array.isArray(body.supporting_documents) ? body.supporting_documents.filter((item: any) => String(item?.path || "").startsWith(`${ctx.id}/${moduleKey}/`)) : [],
          proposed_platform_percent: body.proposed_platform_percent === null || body.proposed_platform_percent === undefined ? null : Number(body.proposed_platform_percent),
          status: "draft", admin_reason: null, creator_response: null, creator_accepted_at: null,
        };
        if (!payload.title || !payload.justification) return json({ error: "TITLE_AND_JUSTIFICATION_REQUIRED" }, 400);
        if (id) {
          const { data: current } = await sb.from("commerce_creator_offers").select("*").eq("id", id).eq("creator_user_id", ctx.id).single();
          if (!["draft", "changes_requested", "rejected"].includes(current.status)) return json({ error: "OFFER_LOCKED" }, 409);
          const { data, error } = await sb.from("commerce_creator_offers").update(payload).eq("id", id).select("*").single();
          if (error) throw error; await audit(sb, ctx.id, "creator_offer_save", "creator_offer", id, current, data); return json({ offer: data });
        }
        const { data, error } = await sb.from("commerce_creator_offers").insert(payload).select("*").single();
        if (error) throw error; await audit(sb, ctx.id, "creator_offer_create", "creator_offer", data.id, null, data); return json({ offer: data });
      }
      if (action === "creator_offer_submit") {
        const id = String(body.id || "");
        const { data: current } = await sb.from("commerce_creator_offers").select("*").eq("id", id).eq("creator_user_id", ctx.id).single();
        if (!["draft", "changes_requested", "rejected"].includes(current.status)) return json({ error: "OFFER_NOT_SUBMITTABLE" }, 409);
        if (!current.justification || !current.price_xof) return json({ error: "PRICE_AND_JUSTIFICATION_REQUIRED" }, 400);
        const { data } = await sb.from("commerce_creator_offers").update({ status: "submitted", submitted_at: new Date().toISOString() }).eq("id", id).select("*").single();
        await audit(sb, ctx.id, "creator_offer_submit", "creator_offer", id, current, data); return json({ offer: data });
      }
      if (action === "creator_offer_accept_counter") {
        const id = String(body.id || "");
        const { data: current } = await sb.from("commerce_creator_offers").select("*").eq("id", id).eq("creator_user_id", ctx.id).eq("status", "counterproposal").single();
        const accepted = Boolean(body.accepted);
        const status = accepted ? "published" : "changes_requested";
        const updates: Record<string, unknown> = { status, creator_response: String(body.response || ""), creator_accepted_at: accepted ? new Date().toISOString() : null, published_at: accepted ? new Date().toISOString() : null };
        if (accepted) {
          updates.price_xof = Number(current.approved_price_xof ?? current.price_xof);
          updates.proposed_platform_percent = Number(current.approved_platform_percent ?? current.proposed_platform_percent ?? 20);
        }
        const { data } = await sb.from("commerce_creator_offers").update(updates).eq("id", id).select("*").single();
        await audit(sb, ctx.id, accepted ? "creator_counter_accept" : "creator_counter_refuse", "creator_offer", id, current, data, body.response); return json({ offer: data });
      }
      if (action === "creator_payout_request") {
        const amount = Math.round(Number(body.amount_xof || 0));
        const { data: balance } = await sb.from("commerce_creator_balances").select("*").eq("creator_user_id", ctx.id).maybeSingle();
        if (amount <= 0 || amount > Number(balance?.available_xof || 0)) return json({ error: "INSUFFICIENT_AVAILABLE_BALANCE" }, 400);
        const { data: payout } = await sb.from("commerce_payout_requests").insert({ creator_user_id: ctx.id, amount_xof: amount, payout_method: body.payout_method, payout_details: body.payout_details || {}, creator_note: body.creator_note || null }).select("*").single();
        await sb.from("commerce_creator_balances").update({ available_xof: Number(balance.available_xof) - amount, reserved_xof: Number(balance.reserved_xof || 0) + amount }).eq("creator_user_id", ctx.id);
        await sb.from("commerce_creator_ledger").insert({ creator_user_id: ctx.id, entry_type: "payout_reserved", net_xof: -amount, balance_bucket: "reserved", description: `Demande de retrait ${payout.id}` });
        return json({ payout });
      }
    }

    if (!isAdmin(ctx) && !isService(ctx)) return json({ error: "FORBIDDEN" }, 403);

    if (action === "admin_dashboard") {
      const [{ data: plans }, { data: benefits }, { data: offers }, { data: subscriptions }, { data: orders }, { data: payouts }, { data: commissions }, { data: promotions }] = await Promise.all([
        sb.from("commerce_plans").select("*,commerce_plan_benefits(*,commerce_benefit_definitions(*))").order("created_at", { ascending: false }),
        sb.from("commerce_benefit_definitions").select("*").order("module_key").order("name"),
        sb.from("commerce_creator_offers").select("*").order("created_at", { ascending: false }),
        sb.from("commerce_subscriptions").select("*,commerce_plans(name),commerce_creator_offers(title),users!commerce_subscriptions_user_id_fkey(full_name,email)").order("created_at", { ascending: false }).limit(100),
        sb.from("commerce_orders").select("*,users!commerce_orders_buyer_user_id_fkey(full_name,email),commerce_plans(name),commerce_creator_offers(title)").order("created_at", { ascending: false }).limit(100),
        sb.from("commerce_payout_requests").select("*,users!commerce_payout_requests_creator_user_id_fkey(full_name,email)").order("requested_at", { ascending: false }).limit(100),
        sb.from("commerce_commission_rules").select("*,users!commerce_commission_rules_creator_user_id_fkey(full_name,email)").order("priority").order("created_at", { ascending: false }),
        sb.from("commerce_promotions").select("*").order("created_at", { ascending: false }),
      ]);
      const signedOffers = await Promise.all((offers || []).map(async (offer: any) => ({ ...offer, supporting_documents: await signDocumentList(sb, offer.supporting_documents) })));
      const signedCommissions = await Promise.all((commissions || []).map(async (rule: any) => ({ ...rule, supporting_documents: await signDocumentList(sb, rule.supporting_documents) })));
      return json({ plans: plans || [], benefits: benefits || [], creator_offers: signedOffers, subscriptions: subscriptions || [], orders: orders || [], payouts: payouts || [], commission_rules: signedCommissions, promotions: promotions || [] });
    }

    if (action === "admin_benefit_save") {
      const payload = { benefit_key: String(body.benefit_key || "").trim(), module_key: String(body.module_key || "platform"), name: String(body.name || "").trim(), description: body.description || null, value_type: body.value_type, unit_label: body.unit_label || null, reset_period: body.reset_period || null, allowed_audiences: body.allowed_audiences || [], configuration_schema: body.configuration_schema || {}, is_active: body.is_active !== false, is_system: false, created_by: ctx.id };
      if (!payload.benefit_key || !payload.name) return json({ error: "KEY_AND_NAME_REQUIRED" }, 400);
      const { data, error } = await sb.from("commerce_benefit_definitions").upsert(payload, { onConflict: "benefit_key" }).select("*").single();
      if (error) throw error; await audit(sb, ctx.id, "admin_benefit_save", "benefit", data.id, null, data); return json({ benefit: data });
    }

    if (action === "admin_plan_save") {
      const id = body.id ? String(body.id) : null;
      const planPayload: any = {
        code: String(body.code || "").trim().toUpperCase(), name: String(body.name || "").trim(), subtitle: body.subtitle || null, description: body.description || null,
        audience: body.audience, commercial_type: body.commercial_type, billing_interval: body.billing_interval || "none", interval_count: Math.max(1, Number(body.interval_count || 1)),
        custom_duration_days: body.custom_duration_days || null, price_xof: body.commercial_type === "trial" ? 0 : Math.max(0, Math.round(Number(body.price_xof || 0))), trial_days: Math.max(0, Number(body.trial_days || 0)),
        auto_renew: Boolean(body.auto_renew), visibility: body.visibility || "public", starts_at: body.starts_at || null, ends_at: body.ends_at || null,
        max_subscribers: body.max_subscribers || null, country_codes: body.country_codes || [], eligibility: body.eligibility || {}, display_order: Number(body.display_order || 0),
        badge_label: body.badge_label || null, terms_text: body.terms_text || null, updated_by: ctx.id,
      };
      if (!planPayload.code || !planPayload.name || !planPayload.audience) return json({ error: "PLAN_REQUIRED_FIELDS" }, 400);
      let plan: any;
      if (id) {
        const { data: current } = await sb.from("commerce_plans").select("*").eq("id", id).single();
        await sb.from("commerce_plan_versions").upsert({ plan_id: id, version: current.version, snapshot: current, change_note: body.change_note || "Modification administrative", created_by: ctx.id }, { onConflict: "plan_id,version" });
        planPayload.version = Number(current.version || 1) + 1;
        const { data, error } = await sb.from("commerce_plans").update(planPayload).eq("id", id).select("*").single(); if (error) throw error; plan = data;
        await audit(sb, ctx.id, "admin_plan_update", "plan", id, current, data, body.change_note);
      } else {
        planPayload.created_by = ctx.id; planPayload.status = "draft";
        const { data, error } = await sb.from("commerce_plans").insert(planPayload).select("*").single(); if (error) throw error; plan = data;
        await audit(sb, ctx.id, "admin_plan_create", "plan", plan.id, null, plan);
      }
      if (Array.isArray(body.benefits)) {
        const rows = body.benefits.filter((item: any) => item.benefit_definition_id).map((item: any, index: number) => ({ plan_id: plan.id, benefit_definition_id: item.benefit_definition_id, value_json: item.value_json || {}, conditions: item.conditions || {}, display_label: item.display_label || null, display_order: index, is_active: item.is_active !== false }));
        if (rows.length) {
          const saved = await sb.from("commerce_plan_benefits").upsert(rows, { onConflict: "plan_id,benefit_definition_id" });
          if (saved.error) throw saved.error;
          const kept = rows.map((row: any) => row.benefit_definition_id);
          const removed = await sb.from("commerce_plan_benefits").delete().eq("plan_id", plan.id).not("benefit_definition_id", "in", `(${kept.join(",")})`);
          if (removed.error) throw removed.error;
        } else {
          const removed = await sb.from("commerce_plan_benefits").delete().eq("plan_id", plan.id);
          if (removed.error) throw removed.error;
        }
      }
      return json({ plan });
    }

    if (action === "admin_plan_status") {
      const id = String(body.id || ""); const status = String(body.status || "draft");
      const { data: current } = await sb.from("commerce_plans").select("*").eq("id", id).single();
      if (status === "active") {
        const { count } = await sb.from("commerce_plan_benefits").select("id", { count: "exact", head: true }).eq("plan_id", id).eq("is_active", true);
        if (!count) return json({ error: "PLAN_REQUIRES_BENEFIT" }, 400);
      }
      const { data } = await sb.from("commerce_plans").update({ status, published_at: status === "active" ? new Date().toISOString() : current.published_at, updated_by: ctx.id }).eq("id", id).select("*").single();
      await audit(sb, ctx.id, "admin_plan_status", "plan", id, current, data, body.reason); return json({ plan: data });
    }

    if (action === "admin_commission_rule_save") {
      const payload = {
        id: body.id || undefined,
        module_key: body.module_key,
        creator_user_id: body.creator_user_id || null,
        creator_level: body.creator_level || null,
        offer_type: body.offer_type || null,
        platform_percent: Number(body.platform_percent || 0),
        fixed_fee_xof: Number(body.fixed_fee_xof || 0),
        minimum_amount_xof: Number(body.minimum_amount_xof || 0),
        priority: Number(body.priority || 100),
        justification: String(body.justification || '').trim(),
        supporting_documents: body.supporting_documents || [],
        status: body.status || 'active',
        valid_from: body.valid_from || new Date().toISOString(),
        valid_until: body.valid_until || null,
        created_by: ctx.id,
        updated_by: ctx.id,
      };
      if (!payload.module_key || !payload.justification) return json({ error: "COMMISSION_REASON_REQUIRED" }, 400);
      let result;
      if (body.id) result = await sb.from("commerce_commission_rules").update(payload).eq("id", body.id).select("*").single();
      else result = await sb.from("commerce_commission_rules").insert(payload).select("*").single();
      if (result.error) throw result.error;
      await audit(sb, ctx.id, "admin_commission_rule_save", "commission_rule", result.data.id, null, result.data, payload.justification);
      return json({ rule: result.data });
    }

    if (action === "admin_promotion_save") {
      const payload = {
        code: body.code ? String(body.code).trim().toUpperCase() : null,
        name: String(body.name || '').trim(),
        discount_type: body.discount_type,
        discount_value: Number(body.discount_value || 0),
        applicable_plan_ids: body.applicable_plan_ids || [],
        audience: body.audience || [],
        country_codes: body.country_codes || [],
        first_purchase_only: Boolean(body.first_purchase_only),
        max_uses: body.max_uses || null,
        max_uses_per_user: Number(body.max_uses_per_user || 1),
        starts_at: body.starts_at || null,
        ends_at: body.ends_at || null,
        is_active: body.is_active !== false,
        created_by: ctx.id,
      };
      if (!payload.name || !payload.discount_type) return json({ error: "PROMOTION_REQUIRED_FIELDS" }, 400);
      let result;
      if (body.id) result = await sb.from("commerce_promotions").update(payload).eq("id", body.id).select("*").single();
      else result = await sb.from("commerce_promotions").insert(payload).select("*").single();
      if (result.error) throw result.error;
      await audit(sb, ctx.id, "admin_promotion_save", "promotion", result.data.id, null, result.data);
      return json({ promotion: result.data });
    }

    if (action === "admin_manual_grant") {
      const email = String(body.email || '').trim().toLowerCase();
      const planId = String(body.plan_id || '');
      const { data: user } = await sb.from("users").select("id,email").eq("email", email).maybeSingle();
      if (!user) return json({ error: "USER_NOT_FOUND" }, 404);
      const { data: plan } = await sb.from("commerce_plans").select("*").eq("id", planId).maybeSingle();
      if (!plan) return json({ error: "PLAN_NOT_FOUND" }, 404);
      const number = orderNumber();
      const idempotency = await sha256(`manual:${user.id}:${plan.id}:${number}`);
      const { data: order } = await sb.from("commerce_orders").insert({
        order_number: number, buyer_user_id: user.id, plan_id: plan.id, order_type: "manual_grant",
        original_amount_xof: 0, discount_xof: 0, final_amount_xof: 0, payment_provider: "manual",
        payment_status: "completed", idempotency_key: idempotency, paid_at: new Date().toISOString(),
        metadata: { granted_by: ctx.id, reason: body.reason || "Attribution manuelle" },
      }).select("*").single();
      const result = await grantEntitlements(sb, order);
      await audit(sb, ctx.id, "admin_manual_grant", "plan", plan.id, null, { user_id: user.id, order_id: order.id }, body.reason);
      return json({ order, result });
    }

    if (action === "admin_subscription_status") {
      const id = String(body.id || "");
      const status = String(body.status || "paused");
      if (!["active", "paused", "cancelled", "expired", "refunded"].includes(status)) return json({ error: "INVALID_SUBSCRIPTION_STATUS" }, 400);
      const { data: current } = await sb.from("commerce_subscriptions").select("*").eq("id", id).single();
      const updates: Record<string, unknown> = { status, cancellation_reason: body.reason || current.cancellation_reason };
      if (["cancelled", "refunded"].includes(status)) { updates.cancelled_at = new Date().toISOString(); updates.auto_renew = false; }
      const { data } = await sb.from("commerce_subscriptions").update(updates).eq("id", id).select("*").single();
      if (["cancelled", "refunded", "expired", "paused"].includes(status)) {
        await sb.from("commerce_entitlements").update({ status: status === "paused" ? "revoked" : "expired" }).eq("source_subscription_id", id).eq("status", "active");
      } else if (status === "active") {
        const now = new Date().toISOString();
        await sb.from("commerce_entitlements").update({ status: "active" }).eq("source_subscription_id", id).eq("status", "revoked").or(`valid_until.is.null,valid_until.gte.${now}`);
      }
      await audit(sb, ctx.id, "admin_subscription_status", "subscription", id, current, data, body.reason);
      return json({ subscription: data });
    }

    if (action === "admin_offer_review") {
      const id = String(body.id || ""); const decision = String(body.decision || "changes_requested");
      const { data: current } = await sb.from("commerce_creator_offers").select("*").eq("id", id).single();
      const updates: any = { reviewed_by: ctx.id, reviewed_at: new Date().toISOString(), admin_reason: String(body.reason || "").trim() };
      if (!updates.admin_reason) return json({ error: "ADMIN_REASON_REQUIRED" }, 400);
      if (decision === "approve") {
        updates.approved_price_xof = Number(body.approved_price_xof ?? current.price_xof);
        updates.approved_platform_percent = Number(body.approved_platform_percent ?? current.proposed_platform_percent ?? 20);
        const changed = updates.approved_price_xof !== Number(current.price_xof) || updates.approved_platform_percent !== Number(current.proposed_platform_percent ?? updates.approved_platform_percent);
        updates.status = changed ? "counterproposal" : "published";
        updates.creator_accepted_at = changed ? null : new Date().toISOString(); updates.published_at = changed ? null : new Date().toISOString();
      } else if (decision === "reject") updates.status = "rejected";
      else updates.status = "changes_requested";
      const { data } = await sb.from("commerce_creator_offers").update(updates).eq("id", id).select("*").single();
      await audit(sb, ctx.id, `admin_offer_${decision}`, "creator_offer", id, current, data, updates.admin_reason); return json({ offer: data });
    }

    if (action === "admin_payout_decide") {
      const id = String(body.id || ""); const decision = String(body.decision || "reject");
      const { data: current } = await sb.from("commerce_payout_requests").select("*").eq("id", id).single();
      if (!["pending", "under_review", "approved", "processing"].includes(current.status)) return json({ error: "PAYOUT_ALREADY_FINAL" }, 409);
      if (decision === "reject") {
        const { data: balance } = await sb.from("commerce_creator_balances").select("*").eq("creator_user_id", current.creator_user_id).single();
        await sb.from("commerce_creator_balances").update({ reserved_xof: Math.max(0, Number(balance.reserved_xof || 0) - current.amount_xof), available_xof: Number(balance.available_xof || 0) + current.amount_xof }).eq("creator_user_id", current.creator_user_id);
        await sb.from("commerce_payout_requests").update({ status: "rejected", admin_reason: body.reason || "Refusé", reviewed_by: ctx.id, reviewed_at: new Date().toISOString() }).eq("id", id);
        await sb.from("commerce_creator_ledger").insert({ creator_user_id: current.creator_user_id, entry_type: "payout_released", net_xof: current.amount_xof, balance_bucket: "available", description: `Retrait rejeté ${id}`, created_by: ctx.id });
      } else if (decision === "paid") {
        const { data: balance } = await sb.from("commerce_creator_balances").select("*").eq("creator_user_id", current.creator_user_id).single();
        await sb.from("commerce_creator_balances").update({ reserved_xof: Math.max(0, Number(balance.reserved_xof || 0) - current.amount_xof), lifetime_paid_xof: Number(balance.lifetime_paid_xof || 0) + current.amount_xof }).eq("creator_user_id", current.creator_user_id);
        await sb.from("commerce_payout_requests").update({ status: "paid", admin_reason: body.reason || null, provider_payout_id: body.provider_payout_id || null, reviewed_by: ctx.id, reviewed_at: new Date().toISOString(), paid_at: new Date().toISOString() }).eq("id", id);
        await sb.from("commerce_creator_ledger").insert({ creator_user_id: current.creator_user_id, entry_type: "payout_completed", net_xof: -current.amount_xof, balance_bucket: "paid", description: `Retrait payé ${id}`, created_by: ctx.id });
      } else {
        await sb.from("commerce_payout_requests").update({ status: decision === "approve" ? "approved" : "processing", admin_reason: body.reason || null, reviewed_by: ctx.id, reviewed_at: new Date().toISOString() }).eq("id", id);
      }
      const { data } = await sb.from("commerce_payout_requests").select("*").eq("id", id).single();
      await audit(sb, ctx.id, `admin_payout_${decision}`, "payout", id, current, data, body.reason); return json({ payout: data });
    }

    if (action === "system_payment_event") {
      if (!isService(ctx)) return json({ error: "SERVICE_ONLY" }, 403);
      const event = body.event || {}; const txn = event.data || body.transaction || {}; const metadata = txn.custom_metadata || txn.metadata || {};
      const orderId = String(metadata.commerce_order_id || body.order_id || "");
      if (!orderId) return json({ handled: false });
      const eventName = String(event.name || body.event_type || txn.status || "unknown");
      const providerId = String(txn.id || body.provider_transaction_id || "");
      const providerEventId = String(event.id || `${eventName}:${providerId}:${orderId}`);
      const insert = await sb.from("commerce_payment_events").insert({ provider_event_id: providerEventId, event_type: eventName, provider_transaction_id: providerId || null, order_id: orderId, payload: event }).select("id").maybeSingle();
      if (insert.error?.code === "23505") return json({ handled: true, duplicate: true });
      try {
        const approved = eventName === "transaction.approved" || txn.status === "approved";
        const failed = ["transaction.declined", "transaction.canceled", "transaction.cancelled"].includes(eventName) || ["declined", "canceled", "cancelled"].includes(String(txn.status));
        if (approved) await activateOrder(sb, orderId, providerId, String(txn.reference || ""), txn);
        else if (failed) await sb.from("commerce_orders").update({ payment_status: "failed", failed_at: new Date().toISOString(), provider_transaction_id: providerId || null }).eq("id", orderId).in("payment_status", ["pending", "processing"]);
        await sb.from("commerce_payment_events").update({ processing_status: approved || failed ? "processed" : "ignored", processed_at: new Date().toISOString() }).eq("id", insert.data?.id);
        return json({ handled: true, approved, failed });
      } catch (error) {
        await sb.from("commerce_payment_events").update({ processing_status: "failed", processing_error: String(error instanceof Error ? error.message : error), processed_at: new Date().toISOString() }).eq("id", insert.data?.id);
        throw error;
      }
    }

    return json({ error: "UNKNOWN_ACTION", action }, 404);
  } catch (error) {
    console.error("commerce-engine", error);
    return json({ error: "INTERNAL", message: error instanceof Error ? error.message : String(error) }, 500);
  }
});
