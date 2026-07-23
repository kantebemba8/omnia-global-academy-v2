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

async function tokenSalesEnabled(sb: any) {
  const { data } = await sb.from("career_admin_rules").select("value_json,is_active").eq("rule_key", "token_sales_enabled").maybeSingle();
  if (!data) return true;
  const value = data.value_json && typeof data.value_json === "object" ? data.value_json.value : data.value_json;
  return data.is_active !== false && value !== false;
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
      if (!await tokenSalesEnabled(sb)) return json({ error: "TOKEN_SALES_DISABLED", message: "La vente de jetons est actuellement désactivée." }, 409);
      const { data: pack, error: packError } = await sb.from("career_token_packs").select("*").eq("pack_key", body.pack_key).eq("is_active", true).maybeSingle();
      if (packError) throw packError;
      if (!pack) return json({ error: "PACK_NOT_FOUND" }, 404);
      const totalTokens = Number(pack.tokens || 0) + Number(pack.bonus_tokens || 0);
      const orderNumber = `OMN-TK-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
      const { data: order, error: orderError } = await sb.from("orders").insert({
        order_number: orderNumber,
        user_id: user.id,
        course_id: null,
        original_price_xof: Number(pack.price_xof || 0),
        discount_xof: 0,
        final_price_xof: Number(pack.price_xof || 0),
        payment_status: "pending",
        payment_gateway: "fedapay",
        order_type: "cv_tokens",
        cv_tokens_pack: totalTokens,
        career_pack_key: pack.pack_key,
      }).select("id,order_number").single();
      if (orderError) throw orderError;

      const fedaKey = Deno.env.get("FEDAPAY_SECRET_KEY") || "";
      if (!fedaKey) {
        await sb.from("orders").delete().eq("id", order.id);
        return json({ error: "PAYMENT_PROVIDER_NOT_CONFIGURED", message: "FedaPay n’est pas configuré côté serveur." }, 503);
      }
      const appUrl = Deno.env.get("APP_URL") || "https://omniaglobalacademy.com";
      const { data: userFull } = await sb.from("users").select("full_name,email,phone_number,country_code").eq("id", user.id).maybeSingle();
      const nameParts = String(userFull?.full_name || "").trim().split(/\s+/);
      const fedaRes = await fetch("https://api.fedapay.com/v1/transactions", {
        method: "POST",
        headers: { Authorization: `Bearer ${fedaKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          description: `Omnia Career Studio — ${pack.name_fr} (${totalTokens} jetons)`, amount: Number(pack.price_xof || 0), currency: { iso: "XOF" },
          callback_url: `${appUrl}/functions/v1/fedapay-webhook`, return_url: `${appUrl}/dashboard/career-studio?tokens_purchased=${totalTokens}`, cancel_url: `${appUrl}/dashboard/career-studio?purchase_cancelled=1`,
          customer: { email: userFull?.email, firstname: nameParts[0] || "Apprenant", lastname: nameParts.slice(1).join(" ") || "-", ...(userFull?.phone_number ? { phone_number: { number: userFull.phone_number, country: userFull.country_code || "ML" } } : {}) },
          metadata: { order_id: order.id, order_number: order.order_number, user_id: user.id, order_type: "cv_tokens", cv_tokens_pack: totalTokens, career_pack_key: pack.pack_key },
        }),
      });
      if (!fedaRes.ok) { await sb.from("orders").delete().eq("id", order.id); return json({ error: "PAYMENT_INIT_FAILED" }, 502); }
      const fedaData = await fedaRes.json();
      const txn = fedaData.v1Transaction || fedaData.transaction || fedaData;
      const fedapayId = txn?.id ? String(txn.id) : null;
      let paymentUrl = `${appUrl}/dashboard/career-studio?purchase_cancelled=1`;
      if (fedapayId) {
        const tokenRes = await fetch(`https://api.fedapay.com/v1/transactions/${fedapayId}/token`, { method: "POST", headers: { Authorization: `Bearer ${fedaKey}`, "Content-Type": "application/json" } }).catch(() => null);
        if (tokenRes?.ok) { const tokenData = await tokenRes.json(); paymentUrl = tokenData.url || tokenData.token_url || paymentUrl; }
        await sb.from("orders").update({ fedapay_transaction_id: fedapayId }).eq("id", order.id);
      }
      return json({ success: true, order_number: order.order_number, payment_url: paymentUrl, pack: { name: pack.name_fr, tokens: totalTokens, price_xof: pack.price_xof } });
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
      const packData = {
        name_fr: body.name_fr,
        description_fr: body.description_fr || null,
        tokens: Number(body.tokens || 0), bonus_tokens: Number(body.bonus_tokens || 0),
        price_xof: Number(body.price_xof || 0), price_eur: body.price_eur == null ? null : Number(body.price_eur),
        currency_code: body.currency_code || "XOF", promo_label: body.promo_label || null,
        is_active: Boolean(body.is_active), is_popular: Boolean(body.is_popular), display_order: Number(body.display_order || 0), updated_at: new Date().toISOString(),
      };
      const query = body.pack_id
        ? sb.from("career_token_packs").update(packData).eq("id", body.pack_id)
        : sb.from("career_token_packs").upsert({ ...packData, pack_key: body.pack_key }, { onConflict: "pack_key" });
      const { error } = await query;
      if (error) throw error;
      return json({ success: true });
    }

    return json({ error: "UNKNOWN_ACTION" }, 400);
  } catch (error) {
    console.error("career-token-manage error:", error);
    return json({ error: "SERVER_ERROR", message: error instanceof Error ? error.message : "Erreur inconnue" }, 500);
  }
});
