import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { approvedStatus, fedaPayApiBase, retrieveFedaPayTransaction } from "../_shared/fedapay-security.ts";
import { resolvePlatformOrder, settlePlatformOrder } from "../_shared/course-payment-settlement.ts";

import { getActiveOmniaSessionResult } from "../_shared/omnia-auth.ts";
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

async function verifySuperAdmin(sb: ReturnType<typeof createClient>, token: string) {
  const { data: session } = await getActiveOmniaSessionResult(sb, token);
  if (!session) return null;
  const { data: role } = await sb.from("user_roles").select("role")
    .eq("user_id", session.user_id).eq("role", "super_admin").maybeSingle();
  return role ? String(session.user_id) : null;
}

async function findFedaPayTransaction(reference: string): Promise<Record<string, any> | null> {
  if (/^\d+$/.test(reference)) return retrieveFedaPayTransaction(reference);

  const secretKey = Deno.env.get("FEDAPAY_SECRET_KEY") || "";
  if (!secretKey) throw new Error("FEDAPAY_SECRET_KEY_MISSING");
  const response = await fetch(`${fedaPayApiBase()}/transactions?reference=${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secretKey}`, Accept: "application/json" },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`FEDAPAY_RECONCILIATION_LOOKUP_FAILED:${response.status}`);
  const rows = body.v1Transactions || body.transactions || body.data || [];
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const sessionToken = (req.headers.get("x-omnia-session-token") || req.headers.get("Authorization") || "")
      .replace(/^Bearer\s+/i, "").trim();
    if (!sessionToken) return json({ error: "UNAUTHORIZED" }, 401);

    const adminId = await verifySuperAdmin(sb, sessionToken);
    if (!adminId) return json({ error: "FORBIDDEN" }, 403);

    const body = await req.json().catch(() => ({}));
    const externalReference = String(body.external_reference || "").trim();
    const gateway = String(body.gateway || "fedapay").toLowerCase();
    if (!externalReference) return json({ error: "MISSING_EXTERNAL_REFERENCE" }, 400);
    if (gateway !== "fedapay") return json({ error: "UNSUPPORTED_GATEWAY" }, 400);

    const transaction = await findFedaPayTransaction(externalReference);
    if (!transaction) {
      await sb.from("payment_reconciliations").insert({
        admin_id: adminId,
        external_reference: externalReference,
        gateway,
        verification_result: { verified: true, status: "not_found" },
        triggered_webhook: false,
      });
      return json({ verified: true, status: "not_found", order_found: null });
    }

    const order = await resolvePlatformOrder(sb, transaction);
    let settlement: Record<string, unknown> | null = null;
    if (approvedStatus(transaction) && order) settlement = await settlePlatformOrder(sb, order, transaction);

    const verificationResult = {
      verified: true,
      status: String(transaction.status || "unknown"),
      transaction_id: transaction.id ? String(transaction.id) : null,
      transaction_reference: transaction.reference ? String(transaction.reference) : null,
      order_found: order?.id || null,
      settled: Boolean(settlement),
      settlement,
    };

    await sb.from("payment_reconciliations").insert({
      admin_id: adminId,
      external_reference: externalReference,
      gateway,
      order_id: order?.id || null,
      verification_result: verificationResult,
      triggered_webhook: Boolean(settlement),
    });

    return json(verificationResult);
  } catch (error) {
    console.error("Payment reconciliation error", error);
    return json({ error: "RECONCILIATION_FAILED", message: String(error instanceof Error ? error.message : error) }, 500);
  }
});
