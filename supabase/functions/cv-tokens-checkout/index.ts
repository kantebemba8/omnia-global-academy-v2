import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

async function getPacks(sb: ReturnType<typeof createClient>) {
  const { data } = await sb.from("site_settings")
    .select("value").eq("key", "cv_token_packs").maybeSingle();
  if (data?.value) {
    try {
      const packs = JSON.parse(data.value);
      if (Array.isArray(packs) && packs.length > 0) return packs;
    } catch (_) {}
  }
  // Packs par défaut si non configurés
  return [
    { id: "pack_3", tokens: 3, price_xof: 500,  label: "3 jetons", popular: false },
    { id: "pack_5", tokens: 5, price_xof: 1000, label: "5 jetons", popular: true },
  ];
}

async function verifySession(sb: ReturnType<typeof createClient>, token: string) {
  const { data: sess } = await sb.from("user_sessions").select("user_id")
    .eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!sess) return null;
  const { data: user } = await sb.from("users")
    .select("id, email, full_name, phone_number, country_code, status")
    .eq("id", sess.user_id).maybeSingle();
  if (!user || user.status !== "actif") return null;
  return user;
}

function generateOrderNumber(): string {
  const year = new Date().getFullYear();
  const suffix = Math.floor(100000 + Math.random() * 900000).toString();
  return `OMN-CV-${year}-${suffix}`;
}

async function sha256hex(str: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const user = await verifySession(sb, token);
    if (!user) return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const { pack_id } = body;

   const PACKS = await getPacks(sb);
    const pack = PACKS.find((p: any) => p.id === pack_id);
    if (!pack) return new Response(JSON.stringify({ error: "INVALID_PACK" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const orderNum = generateOrderNumber();
    const idempotencyKey = await sha256hex(`${user.id}${pack_id}${Date.now()}`);

    // Créer une commande de type "cv_tokens"
    const { data: order, error: orderErr } = await sb.from("orders").insert({
      order_number: orderNum,
      user_id: user.id,
      course_id: null,
      original_price_xof: pack.price_xof,
      discount_xof: 0,
      final_price_xof: pack.price_xof,
      payment_status: "pending",
      payment_gateway: "fedapay",
      idempotency_key: idempotencyKey,
      order_type: "cv_tokens",
      cv_tokens_pack: pack.tokens,
    }).select("id, order_number").single();

    if (orderErr) throw orderErr;

    const fedaKey = Deno.env.get("FEDAPAY_SECRET_KEY") || "";
    const appUrl = Deno.env.get("APP_URL") || "https://omniaglobalacademy.com";
    const nameParts = (user.full_name || "").trim().split(/\s+/);
    const firstname = nameParts[0] || user.email.split("@")[0];
    const lastname = nameParts.slice(1).join(" ") || "-";

    const fedaRes = await fetch("https://api.fedapay.com/v1/transactions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${fedaKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        description: `CV Builder — ${pack.label}`,
        amount: pack.price_xof,
        currency: { iso: "XOF" },
        callback_url: `${appUrl}/functions/v1/fedapay-webhook`,
        return_url: `${appUrl}/dashboard/cv-builder?tokens_purchased=${pack.tokens}`,
        cancel_url: `${appUrl}/dashboard/cv-builder?purchase_cancelled=1`,
        customer: {
          email: user.email,
          firstname,
          lastname,
          ...(user.phone_number ? { phone_number: { number: user.phone_number, country: user.country_code || "SN" } } : {}),
        },
        metadata: {
          order_id: order.id,
          order_number: order.order_number,
          user_id: user.id,
          order_type: "cv_tokens",
          cv_tokens_pack: pack.tokens,
        },
      }),
    });

    if (!fedaRes.ok) {
      await sb.from("orders").delete().eq("id", order.id);
      return new Response(JSON.stringify({ error: "PAYMENT_INIT_FAILED" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const fedaData = await fedaRes.json();
    const txn = fedaData.v1Transaction || fedaData.transaction || fedaData;
    const fedapayId = txn?.id ? String(txn.id) : null;

    let checkoutUrl = `${appUrl}/dashboard/cv-builder?purchase_cancelled=1`;
    if (fedapayId) {
      try {
        const tokenRes = await fetch(`https://api.fedapay.com/v1/transactions/${fedapayId}/token`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${fedaKey}`, "Content-Type": "application/json" },
        });
        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          checkoutUrl = tokenData.url || tokenData.token_url || checkoutUrl;
        }
      } catch (_) { /* use fallback */ }
      await sb.from("orders").update({ fedapay_transaction_id: fedapayId }).eq("id", order.id);
    }

    return new Response(JSON.stringify({
      order_number: order.order_number,
      order_id: order.id,
      pack,
      payment_url: checkoutUrl,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: "INTERNAL", message: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
