import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function verifySuperAdmin(sb: ReturnType<typeof createClient>, token: string) {
  const { data: sess } = await sb.from("user_sessions").select("user_id").eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!sess) return null;
  const { data: role } = await sb.from("user_roles").select("role").eq("user_id", (sess as { user_id: string }).user_id).eq("role", "super_admin").maybeSingle();
  if (!role) return null;
  return (sess as { user_id: string }).user_id;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const adminId = await verifySuperAdmin(sb, token);
    if (!adminId) return json({ error: "FORBIDDEN" }, 403);

    if (req.method === "GET") {
      const url = new URL(req.url);
      const status = url.searchParams.get("status") ?? "";
      let query = sb.from("payout_requests").select("id,user_id,amount_xof,gateway,payout_details,status,admin_note,created_at,processed_at").order("created_at", { ascending: false }).limit(100);
      if (status) query = query.eq("status", status);
      const { data: payouts } = await query;
      const enriched = await Promise.all((payouts ?? []).map(async (p) => {
        const pp = p as { id: string; user_id: string; amount_xof: number; gateway: string; payout_details: unknown; status: string; admin_note: string | null; created_at: string; processed_at: string | null };
        const { data: u } = await sb.from("users").select("full_name,email").eq("id", pp.user_id).maybeSingle();
        const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", pp.user_id);
        const roleList = (roles ?? []).map((r) => (r as { role: string }).role);
        const type = roleList.includes("professeur") ? "Professeur" : roleList.includes("etablissement_directeur") ? "École" : "Autre";
        return { ...pp, user_name: (u as { full_name?: string } | null)?.full_name ?? "—", user_email: (u as { email?: string } | null)?.email ?? "—", user_type: type };
      }));
      const { count: pendingCount } = await sb.from("payout_requests").select("*", { count: "exact", head: true }).eq("status", "pending");
      const { data: monthApproved } = await sb.from("payout_requests").select("amount_xof").eq("status", "approved").gte("processed_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());
      const totalVerseMois = (monthApproved ?? []).reduce((s, p) => s + ((p as { amount_xof?: number }).amount_xof ?? 0), 0);
      const { data: wallets } = await sb.from("wallets").select("balance_xof");
      const tresorerie = (wallets ?? []).reduce((s, w) => s + ((w as { balance_xof?: number }).balance_xof ?? 0), 0);
      return json({ payouts: enriched, stats: { pending: pendingCount ?? 0, total_verse_mois: totalVerseMois, tresorerie } });
    }

    const body = await req.json() as { payout_id: string; action: "approve" | "reject"; admin_note?: string };
    const { payout_id, action, admin_note } = body;
    if (!payout_id || !["approve", "reject"].includes(action)) return json({ error: "INVALID_PARAMS" }, 400);

    const { data: payout } = await sb.from("payout_requests").select("user_id,amount_xof,status,gateway").eq("id", payout_id).maybeSingle();
    if (!payout) return json({ error: "NOT_FOUND" }, 404);
    const p = payout as { user_id: string; amount_xof: number; status: string; gateway: string };
    if (p.status !== "pending") return json({ error: "ALREADY_PROCESSED" }, 400);
    const now = new Date().toISOString();

    if (action === "approve") {
      const { data: wallet } = await sb.from("wallets").select("id,balance_xof,total_withdrawn_xof").eq("user_id", p.user_id).maybeSingle();
      if (!wallet) return json({ error: "WALLET_NOT_FOUND" }, 404);
      const w = wallet as { id: string; balance_xof: number; total_withdrawn_xof: number };
      if (w.balance_xof < p.amount_xof) return json({ error: "INSUFFICIENT_BALANCE" }, 400);
      await sb.from("wallets").update({ balance_xof: w.balance_xof - p.amount_xof, total_withdrawn_xof: (w.total_withdrawn_xof ?? 0) + p.amount_xof }).eq("id", w.id);
      await sb.from("wallet_transactions").insert({ wallet_id: w.id, user_id: p.user_id, type: "debit_withdrawal", amount_xof: p.amount_xof, description: "Retrait approuvé" });
      await sb.from("payout_requests").update({ status: "approved", processed_at: now, admin_note: admin_note ?? null }).eq("id", payout_id);
    } else {
      await sb.from("payout_requests").update({ status: "rejected", processed_at: now, admin_note: admin_note ?? null }).eq("id", payout_id);
    }

    return json({ success: true });
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
