import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-omnia-session-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function verifySession(sb: any, req: Request) {
  const token = (req.headers.get("x-omnia-session-token") || req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data: session } = await sb.from("user_sessions").select("user_id").eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!session) return null;
  const { data: user } = await sb.from("users").select("id,cv_tokens").eq("id", session.user_id).maybeSingle();
  const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", session.user_id);
  return user ? { user, roles: (roles || []).map((r: any) => r.role) } : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return json({ error: "SERVER_CONFIG_ERROR" }, 500);
    const sb = createClient(url, key);
    const session = await verifySession(sb, req);
    if (!session) return json({ error: "SESSION_INVALID" }, 401);
    const { user, roles } = session;
    const isSuperAdmin = roles.includes("super_admin");
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");

    if (action === "checkout") {
      return json({
        error: "LEGACY_COMMERCE_DISABLED",
        message: "Les anciens packs de jetons Career ont été retirés. Les futurs avantages seront créés dans le moteur central de monétisation.",
      }, 410);
    }

    if (action === "credit") {
      if (!isSuperAdmin) return json({ error: "FORBIDDEN" }, 403);
      const amount = Number(body.amount || 0);
      if (!body.target_user_id || amount <= 0) return json({ error: "INVALID_PARAMS" }, 400);
      const { data: target } = await sb.from("users").select("id,cv_tokens").eq("id", body.target_user_id).maybeSingle();
      if (!target) return json({ error: "USER_NOT_FOUND" }, 404);
      const balance = Number(target.cv_tokens || 0) + amount;
      await sb.from("users").update({ cv_tokens: balance }).eq("id", target.id);
      await sb.from("career_token_transactions").insert({ user_id: target.id, transaction_type: "credit", amount, balance_after: balance, reason: body.reason || "admin_credit", reference_type: "admin" });
      return json({ success: true, new_balance: balance });
    }

    if (action === "get_history") {
      const targetId = isSuperAdmin && body.user_id ? body.user_id : user.id;
      const { data } = await sb.from("career_token_transactions").select("*").eq("user_id", targetId).order("created_at", { ascending: false }).limit(100);
      return json({ transactions: data || [], balance: user.cv_tokens || 0 });
    }

    if (action === "update_config") {
      if (!isSuperAdmin) return json({ error: "FORBIDDEN" }, 403);
      const configs = Array.isArray(body.configs) ? body.configs : [];
      for (const cfg of configs) {
        const { error } = await sb.from("career_token_config").upsert({ ...cfg, updated_at: new Date().toISOString() }, { onConflict: "config_key" });
        if (error) throw error;
      }
      return json({ success: true, updated: configs.length });
    }

    if (action === "update_pack") {
      if (!isSuperAdmin) return json({ error: "FORBIDDEN" }, 403);
      return json({
        error: "LEGACY_COMMERCE_DISABLED",
        message: "La gestion des anciens packs Career est fermée. Utilisez le futur catalogue central d’avantages.",
      }, 410);
    }

    return json({ error: "UNKNOWN_ACTION" }, 400);
  } catch (error) {
    console.error("career-token-manage error:", error);
    return json({ error: "SERVER_ERROR", message: error instanceof Error ? error.message : "Erreur inconnue" }, 500);
  }
});
