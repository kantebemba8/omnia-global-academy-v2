import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

import { getActiveOmniaSessionResult } from "../_shared/omnia-auth.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-omnia-session-token",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const token = (req.headers.get("x-omnia-session-token") || req.headers.get("Authorization") || "")
      .replace(/^Bearer\s+/i, "").trim();
    if (!token) return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: sess } = await getActiveOmniaSessionResult(sb, token);
    if (!sess) return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const url = new URL(req.url);
    const orderNumber = url.searchParams.get("order_number");
    if (!orderNumber) return new Response(JSON.stringify({ error: "MISSING_ORDER_NUMBER" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: order } = await sb.from("orders")
      .select("id, order_number, payment_status, course_id, final_price_xof, paid_at, invoice_url, user_id")
      .eq("order_number", orderNumber).maybeSingle();

    if (!order || order.user_id !== sess.user_id) {
      return new Response(JSON.stringify({ error: "NOT_FOUND" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: course } = await sb.from("courses").select("title").eq("id", order.course_id).maybeSingle();

    return new Response(JSON.stringify({
      status: order.payment_status,
      order_number: order.order_number,
      course_id: order.course_id,
      course_title: course?.title ?? "",
      amount_xof: order.final_price_xof,
      paid_at: order.paid_at,
      invoice_url: order.invoice_url,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: "INTERNAL", message: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
