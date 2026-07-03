import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function verifySuperAdmin(sb: ReturnType<typeof createClient>, token: string) {
  const { data: sess } = await sb.from("user_sessions").select("user_id")
    .eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!sess) return null;
  const { data: role } = await sb.from("user_roles").select("role")
    .eq("user_id", sess.user_id).eq("role", "super_admin").maybeSingle();
  if (!role) return null;
  return sess.user_id;
}

async function processApprovedByReference(sb: ReturnType<typeof createClient>, reference: string, gateway: string) {
  const fedaKey = Deno.env.get("FEDAPAY_SECRET_KEY") ?? "";
  const verifyRes = await fetch(
    `https://api.fedapay.com/v1/transactions?reference=${encodeURIComponent(reference)}`,
    { headers: { "Authorization": `Bearer ${fedaKey}` } }
  );

  if (!verifyRes.ok) return { verified: false, status: "fetch_error" };
  const data = await verifyRes.json();
  const txns = data.v1Transactions ?? data.transactions ?? [];
  if (!txns.length) return { verified: false, status: "not_found" };

  const txn = txns[0];
  const status = txn.status ?? txn.payment_status;

  if (status !== "approved") return { verified: true, status, order_found: null };

  // Find the order
  const fedapayId = String(txn.id);
  let order = null;
  const { data: byFeda } = await sb.from("orders").select("*").eq("fedapay_transaction_id", fedapayId).maybeSingle();
  order = byFeda;

  if (!order && txn.metadata?.order_id) {
    const { data: byMeta } = await sb.from("orders").select("*").eq("id", txn.metadata.order_id).maybeSingle();
    order = byMeta;
  }

  if (!order) return { verified: true, status, order_found: null };
  if (order.payment_status === "completed") return { verified: true, status, order_found: order.id, note: "already_completed" };

  await sb.from("orders").update({
    payment_status: "completed",
    fedapay_transaction_id: fedapayId,
    paid_at: new Date().toISOString(),
  }).eq("id", order.id);

  const { data: existing } = await sb.from("user_enrollments")
    .select("id").eq("user_id", order.user_id).eq("course_id", order.course_id).maybeSingle();
  if (!existing) {
    await sb.from("user_enrollments").insert({
      user_id: order.user_id, course_id: order.course_id, enrolled_at: new Date().toISOString(),
    });
  }

  return { verified: true, status, order_found: order.id, triggered: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const adminId = await verifySuperAdmin(sb, token);
    if (!adminId) return new Response(JSON.stringify({ error: "FORBIDDEN" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const { external_reference, gateway } = body;
    if (!external_reference || !gateway) {
      return new Response(JSON.stringify({ error: "MISSING_FIELDS" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const result = await processApprovedByReference(sb, external_reference, gateway);

    // Log reconciliation
    await sb.from("payment_reconciliations").insert({
      admin_id: adminId,
      external_reference,
      gateway,
      order_id: result.order_found ?? null,
      verification_result: result,
      triggered_webhook: result.triggered ?? false,
    });

    return new Response(JSON.stringify({
      verified: result.verified,
      status: result.status,
      order_found: result.order_found,
      triggered_webhook: result.triggered ?? false,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: "INTERNAL", message: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
