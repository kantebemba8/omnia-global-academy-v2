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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  let body: {
    amount_xof?: number; channel?: string;
    mm_operator?: string; mm_phone?: string;
    bank_name?: string; account_holder?: string; bank_code?: string;
    branch_code?: string; account_number?: string; rib_key?: string;
    iban?: string; swift?: string;
  };
  try { body = await req.json(); } catch { return json({ error: "Invalid body" }, 400); }
  const { amount_xof, channel } = body;
  if (!amount_xof || !channel) return json({ error: "amount_xof + channel requis" }, 400);
  if (!["mobile_money", "bank_transfer"].includes(channel)) return json({ error: "channel invalide" }, 400);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: sess } = await sb.from("user_sessions").select("user_id").eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (!sess) return json({ error: "SESSION_INVALID" }, 401);
    const userId = sess.user_id;

    // Check role (professeur OR etablissement_directeur)
    const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", userId).in("role", ["professeur", "etablissement_directeur"]);
    if (!roles || roles.length === 0) return json({ error: "FORBIDDEN" }, 403);

    // Get wallet
    const { data: wallet } = await sb.from("wallets").select("id,balance_xof").eq("user_id", userId).maybeSingle();
    if (!wallet) return json({ error: "WALLET_NOT_FOUND" }, 404);
    const walletTyped = wallet as unknown as { id: string; balance_xof: number };

    // Minimum check
    const { data: minSetting } = await sb.from("site_settings").select("value").eq("key", "payout_minimum_xof").maybeSingle();
    const minimum = parseInt(String(minSetting?.value ?? "5000"));
    if (amount_xof < minimum) return json({ error: "AMOUNT_TOO_LOW", message: `Montant minimum : ${minimum.toLocaleString()} XOF` }, 400);
    if (amount_xof > walletTyped.balance_xof) return json({ error: "INSUFFICIENT_BALANCE", message: `Solde insuffisant : ${walletTyped.balance_xof.toLocaleString()} XOF disponibles` }, 400);

    // Channel-specific validation
    if (channel === "mobile_money") {
      if (!body.mm_operator || !body.mm_phone) return json({ error: "mm_operator + mm_phone requis" }, 400);
    }
    if (channel === "bank_transfer") {
      if (!body.bank_name || !body.account_holder || !body.account_number) return json({ error: "bank_name + account_holder + account_number requis" }, 400);
    }

    const { data: payout, error } = await sb.from("payout_requests").insert({
      wallet_id: walletTyped.id,
      user_id: userId,
      amount_xof,
      channel,
      mm_operator: body.mm_operator ?? null,
      mm_phone: body.mm_phone ?? null,
      bank_name: body.bank_name ?? null,
      account_holder: body.account_holder ?? null,
      bank_code: body.bank_code ?? null,
      branch_code: body.branch_code ?? null,
      account_number: body.account_number ?? null,
      rib_key: body.rib_key ?? null,
      iban: body.iban ?? null,
      swift: body.swift ?? null,
      status: "pending",
    }).select("id,amount_xof,channel,status,requested_at").single();
    if (error) throw error;

    return json({ success: true, payout_id: (payout as unknown as { id: string }).id, payout });
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
