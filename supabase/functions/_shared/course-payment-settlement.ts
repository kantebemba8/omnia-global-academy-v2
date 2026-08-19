import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { assertTransactionMatches, transactionMetadata } from "./fedapay-security.ts";

import { omniaInternalHeaders } from "./omnia-auth.ts";
export type SettlementResult = {
  order_id: string;
  already_completed?: boolean;
  enrollment_created?: boolean;
  professor_user_id?: string | null;
  professor_share_xof?: number;
  platform_share_xof?: number;
  resource_type: "course" | "cv_tokens";
};

export async function resolvePlatformOrder(
  sb: SupabaseClient,
  transaction: Record<string, any>,
): Promise<Record<string, any> | null> {
  const metadata = transactionMetadata(transaction);
  if (metadata.order_id) {
    const { data, error } = await sb.from("orders").select("*").eq("id", metadata.order_id).maybeSingle();
    if (error) throw error;
    if (data) return data;
  }
  const transactionId = String(transaction.id || "");
  if (transactionId) {
    const { data, error } = await sb.from("orders").select("*").eq("fedapay_transaction_id", transactionId).maybeSingle();
    if (error) throw error;
    if (data) return data;
  }
  if (transaction.reference) {
    const { data, error } = await sb.from("orders").select("*").eq("gateway_reference", String(transaction.reference)).maybeSingle();
    if (error) throw error;
    if (data) return data;
  }
  if (transaction.merchant_reference) {
    const { data, error } = await sb.from("orders").select("*").eq("order_number", String(transaction.merchant_reference)).maybeSingle();
    if (error) throw error;
    if (data) return data;
  }
  return null;
}

async function notifyProfessorSale(sb: SupabaseClient, result: Record<string, any>, order: Record<string, any>) {
  const professorId = result.professor_user_id ? String(result.professor_user_id) : "";
  if (!professorId) return;
  const [{ data: course }, { data: wallet }] = await Promise.all([
    sb.from("courses").select("title").eq("id", order.course_id).maybeSingle(),
    sb.from("wallets").select("balance_xof").eq("user_id", professorId).maybeSingle(),
  ]);
  const url = Deno.env.get("SUPABASE_URL") || "";
  if (!url) return;
  await fetch(`${url}/functions/v1/notify-dispatch`, {
    method: "POST",
    headers: omniaInternalHeaders(),
    body: JSON.stringify({
      type: "alerte_vente",
      payload: {
        userId: professorId,
        formation_titre: course?.title || "Formation",
        montant_xof: Number(order.final_price_xof || 0),
        commission_xof: Number(result.professor_share_xof || 0),
        acheteur_pays: "",
        solde_total_xof: Number(wallet?.balance_xof || 0),
      },
    }),
  }).catch(() => null);
}

export async function settlePlatformOrder(
  sb: SupabaseClient,
  order: Record<string, any>,
  transaction: Record<string, any>,
): Promise<SettlementResult> {
  assertTransactionMatches(transaction, Number(order.final_price_xof || 0), String(order.currency_code || "XOF"));

  const providerId = String(transaction.id || "");
  const providerReference = transaction.reference ? String(transaction.reference) : null;
  const orderType = String(order.order_type || "course");

  if (orderType === "cv_tokens") {
    const tokens = Number(order.cv_tokens_pack || 0);
    const { data, error } = await sb.rpc("payment_credit_cv_tokens_once", {
      p_order_id: order.id,
      p_user_id: order.user_id,
      p_tokens: tokens,
      p_provider_transaction_id: providerId,
      p_provider_reference: providerReference,
    });
    if (error) throw error;
    return { ...(data || {}), resource_type: "cv_tokens" } as SettlementResult;
  }

  const { data, error } = await sb.rpc("payment_settle_course_order", {
    p_order_id: order.id,
    p_provider_transaction_id: providerId,
    p_provider_reference: providerReference,
    p_provider_payload: transaction,
  });
  if (error) throw error;
  const result = { ...(data || {}), resource_type: "course" } as SettlementResult;
  if (order.training_session_id) {
    await sb.from("course_training_registrations").upsert({
      session_id: order.training_session_id,
      course_id: order.course_id,
      user_id: order.user_id,
      status: "paid",
      payment_status: "paid",
      order_id: order.id,
      registered_at: new Date().toISOString(),
    }, { onConflict: "session_id,user_id" });
  }
  await notifyProfessorSale(sb, result, order);
  return result;
}
