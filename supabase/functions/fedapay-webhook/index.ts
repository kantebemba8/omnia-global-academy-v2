import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function processApprovedPayment(sb: ReturnType<typeof createClient>, order: Record<string, unknown>, fedapayId: string) {
  // Update order to completed
  await sb.from("orders").update({
    payment_status: "completed",
    fedapay_transaction_id: fedapayId,
    paid_at: new Date().toISOString(),
  }).eq("id", order.id);

  // Create enrollment
  const { data: existing } = await sb.from("user_enrollments")
    .select("id").eq("user_id", order.user_id).eq("course_id", order.course_id).maybeSingle();
  if (!existing) {
    await sb.from("user_enrollments").insert({
      user_id: order.user_id, course_id: order.course_id, enrolled_at: new Date().toISOString(),
    });
  }

  // Increment course student count
  const { data: courseRow } = await sb.from("courses")
    .select("total_students, creator_id, cpd_accredited, is_assisted, creator_type")
    .eq("id", order.course_id).maybeSingle();
  if (courseRow) {
    await sb.from("courses").update({ total_students: (courseRow.total_students || 0) + 1 }).eq("id", order.course_id);
  }

  // Calculate commissions from site_settings
  const { data: settings } = await sb.from("site_settings").select("key, value");
  const cfg: Record<string, string> = {};
  (settings || []).forEach((r: { key: string; value: string }) => { cfg[r.key] = r.value; });

  let profPercent = 0;
  if (courseRow?.creator_type === "professeur" || !courseRow?.creator_type) {
    // Determine commission tier
    if (courseRow?.cpd_accredited && courseRow?.is_assisted) {
      profPercent = parseInt(cfg["commission_cpd_assiste_prof"] ?? "60");
    } else if (courseRow?.cpd_accredited) {
      profPercent = parseInt(cfg["commission_avec_cpd_prof"] ?? "65");
    } else if (courseRow?.is_assisted) {
      profPercent = parseInt(cfg["commission_assiste_prof"] ?? "55");
    } else {
      profPercent = parseInt(cfg["commission_sans_cpd_prof"] ?? "70");
    }

    const finalPrice = order.final_price_xof as number;
    const profShare = Math.floor(finalPrice * profPercent / 100);
    const platShare = finalPrice - profShare;

    await sb.from("orders").update({
      professor_share_xof: profShare,
      platform_share_xof: platShare,
      professor_percent: profPercent,
      platform_percent: 100 - profPercent,
    }).eq("id", order.id);

    if (courseRow.creator_id && profShare > 0) {
      // Upsert wallet
      const { data: wallet } = await sb.from("wallets").select("id, balance_xof, total_earned_xof")
        .eq("user_id", courseRow.creator_id).maybeSingle();
      if (wallet) {
        await sb.from("wallets").update({
          balance_xof: (wallet.balance_xof || 0) + profShare,
          total_earned_xof: (wallet.total_earned_xof || 0) + profShare,
        }).eq("id", wallet.id);
      } else {
        await sb.from("wallets").insert({
          user_id: courseRow.creator_id, balance_xof: profShare, total_earned_xof: profShare,
        });
      }

      const { data: walletRow } = await sb.from("wallets").select("id").eq("user_id", courseRow.creator_id).maybeSingle();
      if (walletRow) {
        await sb.from("wallet_transactions").insert({
          wallet_id: walletRow.id, user_id: courseRow.creator_id,
          type: "credit_sale", amount_xof: profShare,
          description: `Vente — commande ${order.order_number}`,
          reference_id: String(order.id),
        });
      }
    }
  }

  // Handle coupon usage
  if (order.coupon_id) {
    const { data: couponRow } = await sb.from("coupons").select("used_count").eq("id", order.coupon_id).maybeSingle();
    if (couponRow) {
      await sb.from("coupons").update({ used_count: (couponRow.used_count || 0) + 1 }).eq("id", order.coupon_id);
    }
    const { data: existingUsage } = await sb.from("coupon_usages").select("id")
      .eq("coupon_id", order.coupon_id).eq("user_id", order.user_id).maybeSingle();
    if (!existingUsage) {
      await sb.from("coupon_usages").insert({
        coupon_id: order.coupon_id, user_id: order.user_id, order_id: order.id,
        discount_applied_xof: order.discount_xof || 0,
      });
    }
  }

  // Referral — only on first purchase
  const { data: completedOrders } = await sb.from("orders")
    .select("id", { count: "exact" }).eq("user_id", order.user_id).eq("payment_status", "completed");
  const isFirstPurchase = (completedOrders?.length ?? 0) === 1;
  if (isFirstPurchase) {
    const { data: referral } = await sb.from("referrals")
      .select("*").eq("referred_id", order.user_id).eq("status", "pending").maybeSingle();
    if (referral) {
      const referrerReward = parseInt(cfg["referral_reward_referrer_xof"] ?? "2000");
      const referredReward = parseInt(cfg["referral_reward_referred_xof"] ?? "1000");

      await sb.from("referrals").update({
        status: "rewarded", rewarded_at: new Date().toISOString(),
      }).eq("id", referral.id);

      // Credit referrer wallet
      const { data: refWallet } = await sb.from("wallets").select("id, balance_xof, total_earned_xof")
        .eq("user_id", referral.referrer_id).maybeSingle();
      if (refWallet) {
        await sb.from("wallets").update({
          balance_xof: (refWallet.balance_xof || 0) + referrerReward,
          total_earned_xof: (refWallet.total_earned_xof || 0) + referrerReward,
        }).eq("id", refWallet.id);
        await sb.from("wallet_transactions").insert({
          wallet_id: refWallet.id, user_id: referral.referrer_id,
          type: "credit_referral", amount_xof: referrerReward,
          description: "Bonus parrainage — premier achat du filleul",
          reference_id: String(order.id),
        });
      } else {
        await sb.from("wallets").insert({ user_id: referral.referrer_id, balance_xof: referrerReward, total_earned_xof: referrerReward });
      }

      // Credit referred bonus as wallet credit
      const { data: refWallet2 } = await sb.from("wallets").select("id, balance_xof, total_earned_xof")
        .eq("user_id", order.user_id).maybeSingle();
      if (refWallet2 && referredReward > 0) {
        await sb.from("wallets").update({
          balance_xof: (refWallet2.balance_xof || 0) + referredReward,
          total_earned_xof: (refWallet2.total_earned_xof || 0) + referredReward,
        }).eq("id", refWallet2.id);
        await sb.from("wallet_transactions").insert({
          wallet_id: refWallet2.id, user_id: order.user_id,
          type: "credit_referral", amount_xof: referredReward,
          description: "Bonus parrainage — bienvenue filleul",
          reference_id: String(order.id),
        });
      }
    }
  }

  // Credit AI tokens
  const aiTokens = parseInt(cfg["ai_token_per_purchase"] ?? "1");
  if (aiTokens > 0) {
    const { data: userRow } = await sb.from("users").select("ai_tokens").eq("id", order.user_id).maybeSingle();
    if (userRow !== null) {
      await sb.from("users").update({ ai_tokens: (userRow?.ai_tokens || 0) + aiTokens }).eq("id", order.user_id);
    }
  }

  // Notify professor of sale (fire-and-forget)
  if (courseRow?.creator_id) {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const profShare = Math.floor((order.final_price_xof as number) * profPercent / 100);
    const { data: walletAfter } = await sb.from("wallets").select("balance_xof").eq("user_id", courseRow.creator_id).maybeSingle();
    fetch(`${supabaseUrl}/functions/v1/notify-dispatch`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "alerte_vente",
        payload: {
          userId: courseRow.creator_id,
          formation_titre: courseRow.title ?? "",
          montant_xof: order.final_price_xof,
          commission_xof: profShare,
          acheteur_pays: "",
          solde_total_xof: walletAfter?.balance_xof ?? 0,
        },
      }),
    }).catch(() => {});
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const webhookSecret = Deno.env.get("FEDAPAY_WEBHOOK_SECRET") ?? "";
    const body = await req.text();

    // Validate HMAC signature
    if (webhookSecret) {
      const signature = req.headers.get("x-fedapay-signature") ?? "";
      const expectedHex = await hmacHex(webhookSecret, body);
      if (signature !== expectedHex) {
        return new Response("Signature invalide", { status: 401, headers: corsHeaders });
      }
    }

    const event = JSON.parse(body);
    const eventName: string = event.name ?? "";
    const txn = event.data ?? {};
    const fedapayId = String(txn.id ?? "");
    const metadata = txn.metadata ?? {};

    // Resolve order: try metadata first, then by fedapay transaction id
    let order: Record<string, unknown> | null = null;
    if (metadata.order_id) {
      const { data } = await sb.from("orders").select("*").eq("id", metadata.order_id).maybeSingle();
      order = data;
    }
    if (!order && fedapayId) {
      const { data } = await sb.from("orders").select("*").eq("fedapay_transaction_id", fedapayId).maybeSingle();
      order = data;
    }

    if (!order) {
      return new Response(JSON.stringify({ received: true, note: "order_not_found" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (eventName === "transaction.approved" || txn.status === "approved") {
      // Idempotence check
      if (order.payment_status === "completed") {
        return new Response(JSON.stringify({ received: true, note: "already_completed" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // ── Achat de jetons CV ──────────────────────────────────────────
      if (order.order_type === "cv_tokens") {
        const cvTokensPack = (order.cv_tokens_pack as number) || 0;
        await sb.from("orders").update({
          payment_status: "completed",
          fedapay_transaction_id: fedapayId,
          paid_at: new Date().toISOString(),
        }).eq("id", order.id);

        if (cvTokensPack > 0) {
          const { data: userRow } = await sb.from("users").select("cv_tokens").eq("id", order.user_id).maybeSingle();
          await sb.from("users").update({
            cv_tokens: (userRow?.cv_tokens || 0) + cvTokensPack,
          }).eq("id", order.user_id);
        }
      } else {
        // ── Achat de formation (flux normal) ───────────────────────────
        await processApprovedPayment(sb, order, fedapayId);
      }

    } else if (eventName === "transaction.declined" || eventName === "transaction.canceled" ||
               txn.status === "declined" || txn.status === "canceled") {
      if (order.payment_status === "pending") {
        await sb.from("orders").update({ payment_status: "failed" }).eq("id", order.id);
      }
    }

    return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: "INTERNAL" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
