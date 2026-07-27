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

  // Consume B2B license seat exactly once after confirmed payment.
  if (order.license_id) {
    const { data: usage } = await sb.from("license_usages").select("id").eq("license_id", order.license_id).eq("user_id", order.user_id).maybeSingle();
    if (!usage) {
      const { data: license } = await sb.from("group_licenses").select("used_seats,max_seats").eq("id", order.license_id).maybeSingle();
      if (license && Number(license.used_seats || 0) < Number(license.max_seats || 0)) {
        await sb.from("license_usages").insert({ license_id: order.license_id, user_id: order.user_id });
        await sb.from("group_licenses").update({ used_seats: Number(license.used_seats || 0) + 1, updated_at: new Date().toISOString() }).eq("id", order.license_id);
      }
    }
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
    const finalPrice = Number(order.final_price_xof || 0);
    const now = new Date().toISOString();
    const { data: centralRules } = await sb.from("commerce_commission_rules").select("*")
      .in("module_key", ["courses", "global"]).eq("status", "active")
      .lte("valid_from", now).or(`valid_until.is.null,valid_until.gte.${now}`)
      .order("priority", { ascending: true });
    const centralRule = (centralRules || []).find((row: Record<string, unknown>) =>
      (!row.creator_user_id || row.creator_user_id === courseRow?.creator_id) &&
      (!row.offer_type || row.offer_type === "course_sale") &&
      finalPrice >= Number(row.minimum_amount_xof || 0)
    );

    let platformPercent = 0;
    let fixedFee = 0;
    if (centralRule) {
      platformPercent = Number(centralRule.platform_percent || 0);
      fixedFee = Number(centralRule.fixed_fee_xof || 0);
      profPercent = Math.max(0, 100 - platformPercent);
    } else {
      if (courseRow?.cpd_accredited && courseRow?.is_assisted) {
        profPercent = parseInt(cfg["commission_cpd_assiste_prof"] ?? "60");
      } else if (courseRow?.cpd_accredited) {
        profPercent = parseInt(cfg["commission_avec_cpd_prof"] ?? "65");
      } else if (courseRow?.is_assisted) {
        profPercent = parseInt(cfg["commission_assiste_prof"] ?? "55");
      } else {
        profPercent = parseInt(cfg["commission_sans_cpd_prof"] ?? "70");
      }
      platformPercent = 100 - profPercent;
    }

    const platShare = Math.min(finalPrice, Math.round(finalPrice * platformPercent / 100) + fixedFee);
    const profShare = Math.max(0, finalPrice - platShare);
    const effectiveProfPercent = finalPrice > 0 ? Number(((profShare / finalPrice) * 100).toFixed(2)) : 0;
    const effectivePlatformPercent = finalPrice > 0 ? Number(((platShare / finalPrice) * 100).toFixed(2)) : 0;
    profPercent = effectiveProfPercent;

    await sb.from("orders").update({
      professor_share_xof: profShare,
      platform_share_xof: platShare,
      professor_percent: effectiveProfPercent,
      platform_percent: effectivePlatformPercent,
    }).eq("id", order.id);

    if (courseRow.creator_id && profShare > 0) {
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
    const { data: settledOrder } = await sb.from("orders").select("professor_share_xof").eq("id", order.id).maybeSingle();
    const profShare = Number(settledOrder?.professor_share_xof || 0);
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


async function postInternal(path: string, body: Record<string, unknown>) {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !key) return null;
  const response = await fetch(`${url}/functions/v1/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return response;
}

async function processCoachingWebhook(
  sb: ReturnType<typeof createClient>,
  event: Record<string, unknown>,
  eventName: string,
  txn: Record<string, unknown>,
  fedapayId: string,
): Promise<boolean> {
  const metadata = (txn.custom_metadata || txn.metadata || {}) as Record<string, unknown>;
  let order: Record<string, unknown> | null = null;
  if (metadata.coaching_order_id) {
    const result = await sb.from("coaching_payment_orders").select("*").eq("id", metadata.coaching_order_id).maybeSingle();
    order = result.data;
  }
  if (!order && fedapayId) {
    const result = await sb.from("coaching_payment_orders").select("*").eq("provider_transaction_id", fedapayId).maybeSingle();
    order = result.data;
  }
  if (!order && !["coaching_session", "coaching_advanced"].includes(String(metadata.resource_type || ""))) return false;
  if (!order) return true;

  const providerEventId = String(event.id || `${eventName}:${fedapayId}:${String(txn.updated_at || txn.status || "event")}`);
  const eventInsert = await sb.from("coaching_payment_events").insert({
    provider_event_id: providerEventId,
    event_type: eventName || String(txn.status || "unknown"),
    provider_transaction_id: fedapayId || null,
    order_id: order.id,
    session_id: order.session_id,
    payload: event,
    processing_status: "received",
  }).select("id").maybeSingle();
  if (eventInsert.error && eventInsert.error.code === "23505") return true;
  const paymentEventId = eventInsert.data?.id;

  try {
    const approved = eventName === "transaction.approved" || txn.status === "approved";
    const failed = ["transaction.declined", "transaction.canceled", "transaction.cancelled"].includes(eventName) || ["declined", "canceled", "cancelled"].includes(String(txn.status));
    if (approved) {
      const advanced = String(order.product_type || "session") !== "session";
      const rpcName = advanced ? "coaching_confirm_advanced_payment" : "coaching_confirm_payment";
      const { data: confirmation, error } = await sb.rpc(rpcName, {
        p_order_id: order.id,
        p_provider_transaction_id: fedapayId,
        p_provider_reference: txn.reference ? String(txn.reference) : null,
        p_provider_metadata: txn,
      });
      if (error) throw error;

      if (advanced) {
        const productType = String(order.product_type || "");
        await Promise.all([
          postInternal("invoice-generate", { coaching_order_id: order.id }),
          postInternal("notify-dispatch", { type: "coaching_advanced_purchase_confirmed", payload: { userId: order.user_id, product_type: productType, product_title: order.offer_title_snapshot, amount_xof: order.amount_xof, action_url: productType === "group" ? "/dashboard/coaching/avance" : "/dashboard/coaching/avance" } }),
        ]);
        if (order.coach_id) {
          const { data: coachProfile } = await sb.from("coach_profiles").select("user_id").eq("id", order.coach_id).maybeSingle();
          if (coachProfile?.user_id) await postInternal("notify-dispatch", { type: "coaching_advanced_sale", payload: { userId: coachProfile.user_id, product_type: productType, product_title: order.offer_title_snapshot, amount_xof: order.amount_xof, action_url: "/coach/produits" } });
        }
      } else {
        const [{ data: coachingSession }, { data: learner }, { data: coachProfile }] = await Promise.all([
          sb.from("coaching_sessions").select("*").eq("id", order.session_id).maybeSingle(),
          sb.from("users").select("id,full_name,email").eq("id", order.user_id).maybeSingle(),
          sb.from("coach_profiles").select("id,user_id").eq("id", order.coach_id).maybeSingle(),
        ]);
        const late = Boolean((confirmation as Record<string, unknown> | null)?.late_payment);
        if (late) {
          await postInternal("notify-dispatch", { type: "coaching_payment_issue", payload: { userId: order.user_id, session_id: order.session_id, order_number: order.order_number, action_url: "/dashboard/coaching" } });
        } else if (coachingSession) {
          await Promise.all([
            postInternal("invoice-generate", { coaching_order_id: order.id }),
            postInternal("notify-dispatch", { type: "coaching_booking_confirmed", payload: { userId: order.user_id, session_id: coachingSession.id, coach_name: coachingSession.coach_name_snapshot, offer_title: coachingSession.offer_title_snapshot, scheduled_start: coachingSession.scheduled_start, duration_minutes: coachingSession.duration_minutes, amount_xof: order.amount_xof, action_url: "/dashboard/coaching" } }),
            coachProfile?.user_id ? postInternal("notify-dispatch", { type: "coaching_new_booking", payload: { userId: coachProfile.user_id, learner_name: learner?.full_name || learner?.email || "Apprenant", session_id: coachingSession.id, offer_title: coachingSession.offer_title_snapshot, scheduled_start: coachingSession.scheduled_start, duration_minutes: coachingSession.duration_minutes, amount_xof: order.amount_xof, action_url: "/coach/sessions" } }) : Promise.resolve(null),
          ]);
        }
      }
    } else if (failed) {
      if (String(order.product_type || "session") === "session") {
        const { error } = await sb.rpc("coaching_mark_payment_failed", {
          p_order_id: order.id,
          p_provider_transaction_id: fedapayId || null,
          p_provider_metadata: txn,
        });
        if (error) throw error;
      } else {
        await sb.from("coaching_payment_orders").update({ payment_status: "failed", provider_transaction_id: fedapayId || null, provider_metadata: txn, failed_at: new Date().toISOString() }).eq("id", order.id);
        if (String(order.product_type) === "group") await sb.from("coaching_group_registrations").update({ status: "expired" }).eq("id", order.product_id).eq("status", "pending_payment");
      }
      await postInternal("notify-dispatch", { type: "coaching_payment_failed", payload: { userId: order.user_id, session_id: order.session_id, order_number: order.order_number, action_url: String(order.product_type || "session") === "session" ? `/coaching/paiement/${order.session_id}` : `/coaching/avance/paiement/${order.id}` } });
    }
    if (paymentEventId) await sb.from("coaching_payment_events").update({ processing_status: approved || failed ? "processed" : "ignored", processed_at: new Date().toISOString() }).eq("id", paymentEventId);
  } catch (error) {
    if (paymentEventId) await sb.from("coaching_payment_events").update({ processing_status: "failed", processing_error: String(error instanceof Error ? error.message : error).slice(0, 1500), processed_at: new Date().toISOString() }).eq("id", paymentEventId);
    throw error;
  }
  return true;
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
    const centralMetadata = txn.custom_metadata ?? txn.metadata ?? {};

    if (centralMetadata.commerce_order_id || centralMetadata.resource_type === "central_commerce") {
      const response = await postInternal("commerce-engine", { action: "system_payment_event", event });
      if (!response || !response.ok) {
        const detail = response ? await response.text().catch(() => "") : "commerce-engine unavailable";
        throw new Error(`CENTRAL_COMMERCE_WEBHOOK_FAILED:${detail}`);
      }
      return new Response(JSON.stringify({ received: true, resource: "central_commerce" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (await processCoachingWebhook(sb, event, eventName, txn, fedapayId)) {
      return new Response(JSON.stringify({ received: true, resource: "coaching" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const metadata = txn.custom_metadata ?? txn.metadata ?? {};

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
