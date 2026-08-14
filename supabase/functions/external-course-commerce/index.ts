import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import {
  approvedStatus,
  assertTransactionMatches,
  fedaPayApiBase,
  failedStatus,
  retrieveFedaPayTransaction,
} from "../_shared/fedapay-security.ts";
import { getActiveOmniaSessionResult } from "../_shared/omnia-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-omnia-session-token, Idempotency-Key",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

type Supabase = ReturnType<typeof createClient>;

type User = {
  id: string;
  email: string;
  full_name?: string | null;
  phone_number?: string | null;
  country_code?: string | null;
};

async function sha256hex(value: string) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function authenticate(sb: Supabase, req: Request): Promise<User | null> {
  const token = (req.headers.get("x-omnia-session-token") || req.headers.get("Authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) return null;
  const { data: session, error } = await getActiveOmniaSessionResult(sb, token);
  if (error || !session?.user_id) return null;
  const { data: user, error: userError } = await sb.from("users")
    .select("id,email,full_name,phone_number,country_code,status")
    .eq("id", session.user_id)
    .maybeSingle();
  if (userError || !user || String(user.status || "") !== "actif") return null;
  return user as User;
}

function orderNumber() {
  return `EXT-${new Date().getUTCFullYear()}-${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
}

function registrationClosed(deadline: string | null | undefined) {
  if (!deadline) return false;
  return new Date(`${deadline}T23:59:59`).getTime() < Date.now();
}

async function checkoutUrl(transactionId: string, secretKey: string, apiBase: string) {
  const response = await fetch(`${apiBase}/transactions/${encodeURIComponent(transactionId)}/token`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
  });
  if (!response.ok) return null;
  const data = await response.json().catch(() => ({}));
  return String(data.url || data.token?.url || data.checkout_url || data.payment_url || data.token || "") || null;
}

async function settleIfProviderApproved(sb: Supabase, order: any) {
  if (!order?.provider_transaction_id || order.payment_status !== "pending") return;
  const transaction = await retrieveFedaPayTransaction(String(order.provider_transaction_id));
  assertTransactionMatches(transaction, Number(order.amount_xof), "XOF");
  if (approvedStatus(transaction)) {
    const { error } = await sb.rpc("settle_external_course_order", {
      p_order_id: order.id,
      p_transaction_id: String(transaction.id || order.provider_transaction_id),
    });
    if (error) throw error;
  } else if (failedStatus(transaction)) {
    const { error } = await sb.from("external_course_orders").update({
      payment_status: "failed",
      failed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", order.id).eq("payment_status", "pending");
    if (error) throw error;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
    const user = await authenticate(sb, req);
    if (!user) return json({ success: false, error: "UNAUTHORIZED" }, 401);
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = String(body.action || "start_payment");
    const externalCourseId = String(body.external_course_id || "").trim();
    if (!externalCourseId) return json({ success: false, error: "EXTERNAL_COURSE_REQUIRED" }, 400);

    const { data: course, error: courseError } = await sb.from("external_courses")
      .select("id,title,status,access_mode,is_free,price_xof,registration_deadline")
      .eq("id", externalCourseId)
      .maybeSingle();
    if (courseError) throw courseError;
    if (!course || course.status !== "published" || course.access_mode !== "paid" || course.is_free || Number(course.price_xof || 0) <= 0) {
      return json({ success: false, error: "PAID_EXTERNAL_COURSE_NOT_FOUND" }, 404);
    }

    const { data: existingGrant, error: grantError } = await sb.from("external_course_access_grants")
      .select("id,status")
      .eq("user_id", user.id)
      .eq("external_course_id", course.id)
      .maybeSingle();
    if (grantError) throw grantError;
    if (existingGrant && existingGrant.status !== "revoked") {
      return json({ success: true, already_paid: true, access_state: existingGrant.status });
    }

    if (action === "status") {
      const { data: order, error: orderError } = await sb.from("external_course_orders")
        .select("*")
        .eq("user_id", user.id)
        .eq("external_course_id", course.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (orderError) throw orderError;
      if (order?.payment_status === "pending" && order.provider_transaction_id) await settleIfProviderApproved(sb, order);
      const [{ data: refreshedOrder }, { data: refreshedGrant }] = await Promise.all([
        sb.from("external_course_orders").select("id,order_number,payment_status,amount_xof,created_at,completed_at").eq("user_id", user.id).eq("external_course_id", course.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        sb.from("external_course_access_grants").select("id,status,ready_at").eq("user_id", user.id).eq("external_course_id", course.id).maybeSingle(),
      ]);
      return json({ success: true, order: refreshedOrder || null, access: refreshedGrant || null });
    }

    if (action !== "start_payment") return json({ success: false, error: "UNKNOWN_ACTION" }, 400);
    if (registrationClosed(course.registration_deadline)) return json({ success: false, error: "REGISTRATION_CLOSED", message: "La date limite d’inscription est dépassée." }, 409);

    const apiBase = fedaPayApiBase();
    const secretKey = Deno.env.get("FEDAPAY_SECRET_KEY") || "";
    if (!secretKey) throw new Error("FEDAPAY_SECRET_KEY_MISSING");
    const appUrl = (Deno.env.get("PUBLIC_APP_URL") || Deno.env.get("APP_URL") || "https://omniaglobalacademy.com").replace(/\/$/, "");
    const pendingSince = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    const { data: reusable, error: reusableError } = await sb.from("external_course_orders")
      .select("*")
      .eq("user_id", user.id)
      .eq("external_course_id", course.id)
      .eq("payment_status", "pending")
      .eq("amount_xof", Number(course.price_xof))
      .gte("created_at", pendingSince)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (reusableError) throw reusableError;

    if (reusable?.provider_transaction_id) {
      const url = await checkoutUrl(String(reusable.provider_transaction_id), secretKey, apiBase);
      if (url) return json({ success: true, reused: true, order_id: reusable.id, order_number: reusable.order_number, payment_url: url, amount_xof: reusable.amount_xof });
    }

    const requestedIdempotency = String(req.headers.get("Idempotency-Key") || body.idempotency_key || crypto.randomUUID()).trim();
    const idempotencyKey = await sha256hex(`${user.id}:${course.id}:${requestedIdempotency}`);
    const number = orderNumber();
    const { data: order, error: orderError } = await sb.from("external_course_orders").insert({
      order_number: number,
      user_id: user.id,
      external_course_id: course.id,
      amount_xof: Number(course.price_xof),
      currency: "XOF",
      payment_status: "pending",
      payment_gateway: "fedapay",
      idempotency_key: idempotencyKey,
      metadata: { resource_type: "external_course" },
    }).select("*").single();
    if (orderError) throw orderError;

    const parts = String(user.full_name || "").trim().split(/\s+/).filter(Boolean);
    const firstname = parts[0] || user.email.split("@")[0];
    const lastname = parts.slice(1).join(" ") || "-";
    const transactionResponse = await fetch(`${apiBase}/transactions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        description: `Formation externe: ${course.title}`,
        amount: Number(course.price_xof),
        currency: { iso: "XOF" },
        callback_url: `${appUrl}/formation-externe/${encodeURIComponent(course.id)}?payment=return`,
        merchant_reference: order.order_number,
        customer: {
          email: user.email,
          firstname,
          lastname,
          ...(user.phone_number && user.country_code ? { phone_number: { number: user.phone_number, country: user.country_code } } : {}),
        },
        custom_metadata: {
          resource_type: "external_course",
          external_course_order_id: order.id,
          external_course_id: course.id,
          user_id: user.id,
          order_number: order.order_number,
        },
      }),
    });
    const transactionData = await transactionResponse.json().catch(() => ({}));
    if (!transactionResponse.ok) {
      await sb.from("external_course_orders").update({ payment_status: "failed", failed_at: new Date().toISOString(), gateway_reference: `init_error:${transactionResponse.status}`, updated_at: new Date().toISOString() }).eq("id", order.id);
      return json({ success: false, error: "PAYMENT_INIT_FAILED", message: "Impossible d’initialiser le paiement." }, 502);
    }

    const transaction = transactionData.v1Transaction || transactionData.transaction || transactionData;
    const transactionId = transaction?.id ? String(transaction.id) : "";
    if (!transactionId) {
      await sb.from("external_course_orders").update({ payment_status: "failed", failed_at: new Date().toISOString(), gateway_reference: "transaction_id_missing", updated_at: new Date().toISOString() }).eq("id", order.id);
      return json({ success: false, error: "PAYMENT_INIT_FAILED", message: "Réponse de paiement incomplète." }, 502);
    }
    const gatewayReference = transaction?.reference ? String(transaction.reference) : null;
    await sb.from("external_course_orders").update({ provider_transaction_id: transactionId, gateway_reference: gatewayReference, updated_at: new Date().toISOString() }).eq("id", order.id);
    const url = await checkoutUrl(transactionId, secretKey, apiBase);
    if (!url) {
      await sb.from("external_course_orders").update({ payment_status: "failed", failed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", order.id);
      return json({ success: false, error: "PAYMENT_LINK_FAILED", message: "Le lien de paiement n’a pas pu être généré." }, 502);
    }

    return json({ success: true, order_id: order.id, order_number: order.order_number, amount_xof: Number(course.price_xof), payment_url: url });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("external-course-commerce", message);
    if (["FEDAPAY_LIVE_NOT_ENABLED", "FEDAPAY_API_BASE_NOT_ALLOWED", "FEDAPAY_MODE_INVALID"].includes(message)) {
      return json({ success: false, error: "PAYMENT_CONFIGURATION_BLOCKED", message: "Les paiements réels ne sont pas activés. Le mode sandbox reste obligatoire." }, 503);
    }
    return json({ success: false, error: "SERVER_ERROR", message }, 500);
  }
});
