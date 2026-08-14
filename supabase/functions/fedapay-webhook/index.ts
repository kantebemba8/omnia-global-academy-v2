import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import {
  approvedStatus,
  assertTransactionMatches,
  extractFedaPayTransaction,
  failedStatus,
  retrieveFedaPayTransaction,
  transactionMetadata,
  verifyFedaPayWebhook,
} from "../_shared/fedapay-security.ts";
import { omniaInternalHeaders } from "../_shared/omnia-auth.ts";
import { resolvePlatformOrder, settlePlatformOrder } from "../_shared/course-payment-settlement.ts";

type SB = ReturnType<typeof createClient>;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function reserveWebhookEvent(
  sb: SB,
  event: Record<string, any>,
  rawBody: string,
  transaction: Record<string, any>,
) {
  const eventName = String(event.name || event.type || transaction.status || "unknown");
  const transactionId = transaction.id ? String(transaction.id) : null;
  const eventId = String(event.id || `sha256:${await sha256Hex(rawBody)}`);
  const insert = await sb.from("payment_webhook_events").insert({
    provider: "fedapay",
    provider_event_id: eventId,
    event_type: eventName,
    provider_transaction_id: transactionId,
    provider_reference: transaction.reference ? String(transaction.reference) : null,
    payload: event,
    processing_status: "processing",
  }).select("id,processing_status,processing_attempts").maybeSingle();

  if (!insert.error) return { id: insert.data?.id as string, duplicate: false, eventId };
  if (insert.error.code !== "23505") throw insert.error;

  const { data: existing, error } = await sb.from("payment_webhook_events")
    .select("id,processing_status,processing_attempts")
    .eq("provider", "fedapay").eq("provider_event_id", eventId).single();
  if (error) throw error;
  if (["processed", "ignored"].includes(String(existing.processing_status))) {
    return { id: String(existing.id), duplicate: true, eventId };
  }
  await sb.from("payment_webhook_events").update({
    processing_status: "processing",
    processing_attempts: Number(existing.processing_attempts || 1) + 1,
    processing_error: null,
    processed_at: null,
    payload: event,
  }).eq("id", existing.id);
  return { id: String(existing.id), duplicate: false, eventId };
}

async function finishWebhookEvent(sb: SB, id: string, status: "processed" | "ignored" | "failed", resourceType?: string, resourceId?: string | null, error?: unknown) {
  await sb.from("payment_webhook_events").update({
    processing_status: status,
    resource_type: resourceType || null,
    resource_id: resourceId || null,
    processing_error: error ? String(error instanceof Error ? error.message : error).slice(0, 1500) : null,
    processed_at: new Date().toISOString(),
  }).eq("id", id);
}
async function postInternal(path: string, body: Record<string, unknown>) {
  const url = Deno.env.get("SUPABASE_URL") || "";
  if (!url) return null;
  const response = await fetch(`${url}/functions/v1/${path}`, {
    method: "POST",
    headers: omniaInternalHeaders(),
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

  assertTransactionMatches(txn, Number(order.amount_xof || 0), String(order.currency || "XOF"));

  const providerEventId = String(event.id || `${eventName}:${fedapayId}:${String(txn.updated_at || txn.status || "event")}`);
  const eventInsert = await sb.from("coaching_payment_events").insert({
    provider_event_id: providerEventId,
    event_type: eventName || String(txn.status || "unknown"),
    provider_transaction_id: fedapayId || null,
    order_id: order.id,
    session_id: order.session_id,
    payload: event,
    processing_status: "received",
  }).select("id,processing_status").maybeSingle();

  let paymentEventId = eventInsert.data?.id as string | undefined;
  if (eventInsert.error) {
    if (eventInsert.error.code !== "23505") throw eventInsert.error;
    const { data: existingEvent, error: existingError } = await sb.from("coaching_payment_events")
      .select("id,processing_status")
      .eq("provider_event_id", providerEventId)
      .single();
    if (existingError) throw existingError;
    if (["processed", "ignored"].includes(String(existingEvent.processing_status))) return true;
    paymentEventId = String(existingEvent.id);
    await sb.from("coaching_payment_events").update({
      processing_status: "received",
      processing_error: null,
      processed_at: null,
      payload: event,
    }).eq("id", paymentEventId);
  }

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
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let trackedEventId: string | null = null;

  try {
    const rawBody = await req.text();
    await verifyFedaPayWebhook(
      rawBody,
      req.headers.get("x-fedapay-signature"),
      Deno.env.get("FEDAPAY_WEBHOOK_SECRET") || "",
    );

    const incomingEvent = JSON.parse(rawBody) as Record<string, any>;
    const incomingTransaction = extractFedaPayTransaction(incomingEvent);
    const incomingTransactionId = String(incomingTransaction.id || "");
    if (!incomingTransactionId) throw new Error("FEDAPAY_TRANSACTION_ID_MISSING");

    const authoritativeTransaction = await retrieveFedaPayTransaction(incomingTransactionId);
    const event: Record<string, any> = { ...incomingEvent, data: authoritativeTransaction };
    const transaction = authoritativeTransaction;
    const eventName = String(event.name || event.type || transaction.status || "unknown");
    const metadata = transactionMetadata(transaction);

    const reservation = await reserveWebhookEvent(sb, event, rawBody, transaction);
    trackedEventId = reservation.id;
    if (reservation.duplicate) return json({ received: true, duplicate: true });

    if (metadata.commerce_order_id || metadata.resource_type === "central_commerce") {
      const { data: commerceOrder, error } = await sb.from("commerce_orders")
        .select("id,final_amount_xof,currency")
        .eq("id", metadata.commerce_order_id).maybeSingle();
      if (error) throw error;
      if (!commerceOrder) throw new Error("CENTRAL_COMMERCE_ORDER_NOT_FOUND");
      assertTransactionMatches(transaction, Number(commerceOrder.final_amount_xof || 0), String(commerceOrder.currency || "XOF"));
      const response = await postInternal("commerce-engine", { action: "system_payment_event", event });
      if (!response?.ok) throw new Error(`CENTRAL_COMMERCE_WEBHOOK_FAILED:${response ? await response.text().catch(() => "") : "unavailable"}`);
      await finishWebhookEvent(sb, trackedEventId, "processed", "central_commerce", String(commerceOrder.id));
      return json({ received: true, resource: "central_commerce" });
    }

    if (metadata.omnia_order_id) {
      const { data: liveOrder, error } = await sb.from("live_orders")
        .select("id,amount,currency")
        .eq("id", metadata.omnia_order_id).maybeSingle();
      if (error) throw error;
      if (!liveOrder) throw new Error("OMNIA_LIVE_ORDER_NOT_FOUND");
      assertTransactionMatches(transaction, Number(liveOrder.amount || 0), String(liveOrder.currency || "XOF"));
      const url = Deno.env.get("SUPABASE_URL") || "";
      const webhookSecret = Deno.env.get("FEDAPAY_WEBHOOK_SECRET") || "";
      const response = await fetch(`${url}/functions/v1/omnia-live?action=fedapay_webhook`, {
        method: "POST",
        headers: {
          ...omniaInternalHeaders(),
          "x-omnia-webhook-secret": webhookSecret,
        },
        body: JSON.stringify(event),
      });
      if (!response.ok) throw new Error(`OMNIA_LIVE_WEBHOOK_FAILED:${await response.text().catch(() => "")}`);
      await finishWebhookEvent(sb, trackedEventId, "processed", "omnia_live", String(liveOrder.id));
      return json({ received: true, resource: "omnia_live" });
    }

    if (metadata.external_course_order_id || metadata.resource_type === "external_course") {
      const orderId = String(metadata.external_course_order_id || "");
      if (!orderId) throw new Error("EXTERNAL_COURSE_ORDER_ID_MISSING");
      const { data: externalOrder, error } = await sb.from("external_course_orders")
        .select("id,amount_xof,currency,payment_status")
        .eq("id", orderId)
        .maybeSingle();
      if (error) throw error;
      if (!externalOrder) throw new Error("EXTERNAL_COURSE_ORDER_NOT_FOUND");
      assertTransactionMatches(transaction, Number(externalOrder.amount_xof || 0), String(externalOrder.currency || "XOF"));
      if (approvedStatus(transaction) || eventName === "transaction.approved") {
        const { error: settleError } = await sb.rpc("settle_external_course_order", {
          p_order_id: externalOrder.id,
          p_transaction_id: String(transaction.id || incomingTransactionId),
        });
        if (settleError) throw settleError;
        await finishWebhookEvent(sb, trackedEventId, "processed", "external_course", String(externalOrder.id));
        return json({ received: true, resource: "external_course", order_id: externalOrder.id });
      }
      if (failedStatus(transaction) || ["transaction.declined", "transaction.canceled", "transaction.cancelled"].includes(eventName)) {
        if (externalOrder.payment_status !== "completed") {
          await sb.from("external_course_orders").update({
            payment_status: "failed",
            failed_at: new Date().toISOString(),
            provider_transaction_id: String(transaction.id || incomingTransactionId),
            updated_at: new Date().toISOString(),
          }).eq("id", externalOrder.id);
        }
        await finishWebhookEvent(sb, trackedEventId, "processed", "external_course", String(externalOrder.id));
        return json({ received: true, resource: "external_course", status: "failed" });
      }
      await finishWebhookEvent(sb, trackedEventId, "ignored", "external_course", String(externalOrder.id));
      return json({ received: true, resource: "external_course", ignored: true });
    }

    if (await processCoachingWebhook(sb, event, eventName, transaction, incomingTransactionId)) {
      const coachingId = metadata.coaching_order_id ? String(metadata.coaching_order_id) : null;
      await finishWebhookEvent(sb, trackedEventId, "processed", "coaching", coachingId);
      return json({ received: true, resource: "coaching" });
    }

    const order = await resolvePlatformOrder(sb, transaction);
    if (!order) {
      await finishWebhookEvent(sb, trackedEventId, "ignored", "unknown", null);
      return json({ received: true, note: "order_not_found" });
    }

    if (approvedStatus(transaction) || eventName === "transaction.approved") {
      const result = await settlePlatformOrder(sb, order, transaction);
      await finishWebhookEvent(sb, trackedEventId, "processed", result.resource_type, String(order.id));
      return json({ received: true, resource: result.resource_type, order_id: order.id });
    }

    if (failedStatus(transaction) || ["transaction.declined", "transaction.canceled"].includes(eventName)) {
      if (order.payment_status !== "completed") {
        await sb.from("orders").update({ payment_status: "failed" }).eq("id", order.id);
      }
      await finishWebhookEvent(sb, trackedEventId, "processed", "order", String(order.id));
      return json({ received: true, resource: "order", status: "failed" });
    }

    await finishWebhookEvent(sb, trackedEventId, "ignored", "order", String(order.id));
    return json({ received: true, ignored: true });
  } catch (error) {
    console.error("FedaPay webhook error", error);
    if (trackedEventId) await finishWebhookEvent(sb, trackedEventId, "failed", undefined, null, error).catch(() => null);
    const message = String(error instanceof Error ? error.message : error);
    const securityError = message.startsWith("FEDAPAY_SIGNATURE") || message === "FEDAPAY_WEBHOOK_SECRET_MISSING";
    return json({ error: securityError ? "INVALID_WEBHOOK" : "WEBHOOK_PROCESSING_FAILED" }, securityError ? 401 : 500);
  }
});
