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

    // Optional auth — get user_id if provided to check prior usage
    let userId: string | null = null;
    const token = (req.headers.get("x-omnia-session-token") || req.headers.get("Authorization") || "")
      .replace(/^Bearer\s+/i, "").trim();
    if (token) {
      const { data: sess } = await getActiveOmniaSessionResult(sb, token);
      userId = sess?.user_id ?? null;
    }

    if (req.method === "GET") {
      const courseId = new URL(req.url).searchParams.get("course_id") || "";
      if (!courseId) return new Response(JSON.stringify({ coupons: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: course } = await sb.from("courses").select("id,category,price_xof").eq("id", courseId).maybeSingle();
      if (!course) return new Response(JSON.stringify({ coupons: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const now = new Date().toISOString();
      const { data: coupons } = await sb.from("coupons").select("id,code,name,discount_type,discount_value,applicable_to,applicable_id,expires_at,max_uses,used_count")
        .eq("is_active", true).eq("distribution_mode", "public")
        .or(`starts_at.is.null,starts_at.lte.${now}`).or(`expires_at.is.null,expires_at.gte.${now}`);
      const visible = (coupons || []).filter((coupon:any) => (coupon.max_uses == null || Number(coupon.used_count||0) < Number(coupon.max_uses)) && (
        coupon.applicable_to === "all" ||
        (coupon.applicable_to === "category" && coupon.applicable_id === course.category) ||
        (coupon.applicable_to === "course" && coupon.applicable_id === courseId)
      ));
      return new Response(JSON.stringify({ coupons: visible }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { coupon_code, course_id } = body;
    if (!coupon_code || !course_id) {
      return new Response(JSON.stringify({ valid: false, message: "Paramètres manquants." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: coupon } = await sb.from("coupons").select("*")
      .eq("code", coupon_code.toUpperCase().trim()).eq("is_active", true).maybeSingle();

    if (!coupon) {
      return new Response(JSON.stringify({ valid: false, message: "Code invalide ou inactif." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const now = new Date().toISOString();
    if (coupon.starts_at && coupon.starts_at > now) {
      return new Response(JSON.stringify({ valid: false, message: "Ce code n’est pas encore actif." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (coupon.expires_at && coupon.expires_at < now) {
      return new Response(JSON.stringify({ valid: false, message: "Ce code a expiré." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (coupon.distribution_mode === "targeted_email") {
      if (!userId) {
        return new Response(JSON.stringify({ valid: false, message: "Connectez-vous avec l’adresse e-mail destinataire de cet avantage." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: user } = await sb.from("users").select("email").eq("id", userId).maybeSingle();
      const { data: assignment } = user?.email ? await sb.from("coupon_recipient_assignments").select("id,status")
        .eq("coupon_id", coupon.id).eq("recipient_email", String(user.email).toLowerCase()).in("status", ["assigned","sent"]).maybeSingle() : { data: null };
      if (!assignment) {
        return new Response(JSON.stringify({ valid: false, message: "Ce code est réservé à un autre destinataire." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
      return new Response(JSON.stringify({ valid: false, message: "Ce code a atteint son nombre maximum d'utilisations." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (userId) {
      const { data: alreadyUsed } = await sb.from("coupon_usages").select("id")
        .eq("coupon_id", coupon.id).eq("user_id", userId).maybeSingle();
      if (alreadyUsed) {
        return new Response(JSON.stringify({ valid: false, message: "Vous avez déjà utilisé ce code." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const { data: course } = await sb.from("courses").select("price_xof, category").eq("id", course_id).maybeSingle();
    if (!course) {
      return new Response(JSON.stringify({ valid: false, message: "Formation introuvable." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const scopeOk = coupon.applicable_to === "all" ||
      (coupon.applicable_to === "category" && coupon.applicable_id === course.category) ||
      (coupon.applicable_to === "course" && coupon.applicable_id === course_id);

    if (!scopeOk) {
      return new Response(JSON.stringify({ valid: false, message: "Ce code n'est pas applicable à cette formation." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const price = course.price_xof || 0;
    let discountXof: number;
    if (coupon.discount_type === "percentage") {
      discountXof = Math.floor(price * coupon.discount_value / 100);
    } else {
      discountXof = Math.min(coupon.discount_value, price);
    }
    const finalPrice = Math.max(0, price - discountXof);

    return new Response(JSON.stringify({
      valid: true,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      discount_xof: discountXof,
      final_price_xof: finalPrice,
      message: `Code appliqué : -${discountXof.toLocaleString("fr-FR")} XOF`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ valid: false, message: "Erreur serveur." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
