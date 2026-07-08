import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { corsHeaders } from "../_shared/cors.ts";

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function verifySession(sb: ReturnType<typeof createClient>, token: string) {
  const { data: sess } = await sb.from("user_sessions")
    .select("user_id")
    .eq("session_token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!sess) return null;
  const userId = (sess as { user_id: string }).user_id;
  const { data: user } = await sb.from("users").select("id, cv_tokens").eq("id", userId).maybeSingle();
  const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", userId);
  return { user, roles: (roles ?? []).map((r: { role: string }) => r.role) };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const session = await verifySession(sb, token);
    if (!session || !session.user) return json({ error: "SESSION_INVALID" }, 401);

    const { user, roles } = session;
    const isSuperAdmin = roles.includes("super_admin");
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // ── Action CHECKOUT : initier achat pack ─────────────────
    if (action === "checkout") {
      const { pack_key } = body;
      const { data: pack } = await sb.from("career_token_packs")
        .select("*")
        .eq("pack_key", pack_key)
        .eq("is_active", true)
        .maybeSingle();
      if (!pack) return json({ error: "PACK_NOT_FOUND" }, 404);

      const p = pack as { id: string; name_fr: string; tokens: number; bonus_tokens: number; price_xof: number };
      const totalTokens = p.tokens + (p.bonus_tokens || 0);

      // Créer une commande
      const orderNum = `OMN-TK-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
      const { data: order } = await sb.from("orders").insert({
        order_number: orderNum,
        user_id: (user as { id: string }).id,
        course_id: null,
        original_price_xof: p.price_xof,
        discount_xof: 0,
        final_price_xof: p.price_xof,
        payment_status: "pending",
        payment_gateway: "fedapay",
        order_type: "cv_tokens",
        cv_tokens_pack: totalTokens,
        career_pack_key: pack_key,
      }).select("id, order_number").single();

      // Initialiser FedaPay
      const fedaKey = Deno.env.get("FEDAPAY_SECRET_KEY") || "";
      const appUrl = Deno.env.get("APP_URL") || "https://omniaglobalacademy.com";
      const { data: userFull } = await sb.from("users").select("full_name, email, phone_number, country_code").eq("id", (user as { id: string }).id).maybeSingle();
      const u = userFull as { full_name: string; email: string; phone_number: string; country_code: string };
      const nameParts = (u?.full_name || "").trim().split(/\s+/);

      const fedaRes = await fetch("https://api.fedapay.com/v1/transactions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${fedaKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          description: `Omnia Career Studio — ${p.name_fr} (${totalTokens} jetons)`,
          amount: p.price_xof,
          currency: { iso: "XOF" },
          callback_url: `${appUrl}/functions/v1/fedapay-webhook`,
          return_url: `${appUrl}/dashboard/career-studio?tokens_purchased=${totalTokens}`,
          cancel_url: `${appUrl}/dashboard/career-studio?purchase_cancelled=1`,
          customer: {
            email: u?.email,
            firstname: nameParts[0] || "Apprenant",
            lastname: nameParts.slice(1).join(" ") || "-",
            ...(u?.phone_number ? { phone_number: { number: u.phone_number, country: u.country_code || "ML" } } : {}),
          },
          metadata: {
            order_id: (order as { id: string }).id,
            order_number: (order as { order_number: string }).order_number,
            user_id: (user as { id: string }).id,
            order_type: "cv_tokens",
            cv_tokens_pack: totalTokens,
          },
        }),
      });

      if (!fedaRes.ok) {
        await sb.from("orders").delete().eq("id", (order as { id: string }).id);
        return json({ error: "PAYMENT_INIT_FAILED" }, 502);
      }

      const fedaData = await fedaRes.json();
      const txn = fedaData.v1Transaction || fedaData.transaction || fedaData;
      const fedapayId = txn?.id ? String(txn.id) : null;

      let paymentUrl = `${appUrl}/dashboard/career-studio?purchase_cancelled=1`;
      if (fedapayId) {
        const tokenRes = await fetch(`https://api.fedapay.com/v1/transactions/${fedapayId}/token`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${fedaKey}`, "Content-Type": "application/json" },
        }).catch(() => null);
        if (tokenRes?.ok) {
          const tokenData = await tokenRes.json();
          paymentUrl = tokenData.url || tokenData.token_url || paymentUrl;
        }
        await sb.from("orders").update({ fedapay_transaction_id: fedapayId }).eq("id", (order as { id: string }).id);
      }

      return json({ success: true, order_number: (order as { order_number: string }).order_number, payment_url: paymentUrl, pack: { name: p.name_fr, tokens: totalTokens, price_xof: p.price_xof } });
    }

    // ── Action CREDIT : super-admin crédite des jetons ───────
    if (action === "credit") {
      if (!isSuperAdmin) return json({ error: "FORBIDDEN" }, 403);
      const { target_user_id, amount, reason } = body;
      if (!target_user_id || !amount || amount <= 0) return json({ error: "INVALID_PARAMS" }, 400);
      const { data: targetUser } = await sb.from("users").select("id, cv_tokens").eq("id", target_user_id).maybeSingle();
      if (!targetUser) return json({ error: "USER_NOT_FOUND" }, 404);
      const newBalance = ((targetUser as { cv_tokens: number }).cv_tokens || 0) + amount;
      await sb.from("users").update({ cv_tokens: newBalance }).eq("id", target_user_id);
      await sb.from("career_token_transactions").insert({
        user_id: target_user_id,
        transaction_type: "credit",
        amount,
        balance_after: newBalance,
        reason: reason || "admin_credit",
        reference_type: "admin",
      });
      return json({ success: true, new_balance: newBalance });
    }

    // ── Action GET_HISTORY : historique transactions ──────────
    if (action === "get_history") {
      const targetId = isSuperAdmin && body.user_id ? body.user_id : (user as { id: string }).id;
      const { data: transactions } = await sb.from("career_token_transactions")
        .select("*")
        .eq("user_id", targetId)
        .order("created_at", { ascending: false })
        .limit(50);
      return json({ transactions: transactions ?? [], balance: (user as { cv_tokens: number }).cv_tokens ?? 0 });
    }

    // ── Action UPDATE_CONFIG : super-admin modifie les coûts ─
    if (action === "update_config") {
      if (!isSuperAdmin) return json({ error: "FORBIDDEN" }, 403);
      const { configs } = body;
      if (!Array.isArray(configs)) return json({ error: "INVALID_PARAMS" }, 400);
      for (const { config_key, config_value } of configs) {
        await sb.from("career_token_config")
          .upsert({ config_key, config_value, updated_at: new Date().toISOString() }, { onConflict: "config_key" });
      }
      return json({ success: true, updated: configs.length });
    }

    // ── Action UPDATE_PACKS : super-admin modifie les packs ──
    if (action === "update_pack") {
      if (!isSuperAdmin) return json({ error: "FORBIDDEN" }, 403);
      const { pack_id, pack_key, name_fr, tokens, price_xof, is_active, is_popular, bonus_tokens, promo_label, display_order } = body;
      const packData = { name_fr, tokens, price_xof, is_active, is_popular, bonus_tokens, promo_label, display_order, updated_at: new Date().toISOString() };
      if (pack_id) {
        await sb.from("career_token_packs").update(packData).eq("id", pack_id);
      } else {
        await sb.from("career_token_packs").upsert({ ...packData, pack_key }, { onConflict: "pack_key" });
      }
      return json({ success: true });
    }

    return json({ error: "UNKNOWN_ACTION" }, 400);

  } catch (err) {
    console.error("career-token-manage error:", err);
    return json({ error: "SERVER_ERROR", message: (err as Error).message }, 500);
  }
});