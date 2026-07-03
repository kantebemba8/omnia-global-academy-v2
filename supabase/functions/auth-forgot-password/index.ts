import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "https://omniaglobalacademy.com",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, message: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { phone_number } = await req.json();

    if (!phone_number || phone_number.trim().length < 8) {
      return new Response(JSON.stringify({ success: false, message: "Numéro de téléphone invalide" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sanitizedPhone = phone_number.trim();
    const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Return generic success to prevent phone enumeration
    const { data: user } = await supabase
      .from("users").select("id, status").eq("phone_number", sanitizedPhone).maybeSingle();

    if (!user || user.status === "suspendu" || user.status === "supprime") {
      return new Response(JSON.stringify({ success: true, next_step: "verify_otp", purpose: "reset_password" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit: max 3 SMS/heure
    const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString();
    const { count: recentSms } = await supabase
      .from("sms_rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("phone_number", sanitizedPhone)
      .gte("sent_at", oneHourAgo);

    if ((recentSms ?? 0) >= 3) {
      return new Response(JSON.stringify({ success: false, message: "Trop de SMS envoyés. Réessayez dans une heure." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Invalidate any existing reset OTPs
    await supabase
      .from("otp_codes")
      .update({ used: true })
      .eq("phone_number", sanitizedPhone)
      .eq("purpose", "reset_password")
      .eq("used", false);

    // Generate and store OTP — 15 min expiry
    const otp = generateOTP();
    const { error: otpError } = await supabase.from("otp_codes").insert({
      phone_number: sanitizedPhone,
      code: otp,
      purpose: "reset_password",
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      ip_address: ipAddress,
    });
    if (otpError) throw otpError;

    const username = Deno.env.get("AFRICASTALKING_USERNAME") || "sandbox";
    const atApiUrl = username === "sandbox"
      ? "https://api.sandbox.africastalking.com/version1/messaging"
      : "https://api.africastalking.com/version1/messaging";

    const smsRes = await fetch(atApiUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        apiKey: Deno.env.get("AFRICASTALKING_API_KEY") ?? "",
      },
      body: new URLSearchParams({
        username,
        to: sanitizedPhone,
        message: `Omnia Academy : Code de réinitialisation : ${otp}. Valable 15 minutes.`,
        from: Deno.env.get("AFRICASTALKING_SENDER_ID") || "OmniaAcad",
      }),
    });

    if (!smsRes.ok) {
      console.error("Africa's Talking error:", await smsRes.text());
    }

    await supabase.from("sms_rate_limits").insert({
      phone_number: sanitizedPhone,
      ip_address: ipAddress,
    });

    return new Response(JSON.stringify({ success: true, next_step: "verify_otp", purpose: "reset_password" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("auth-forgot-password error:", error);
    return new Response(JSON.stringify({ success: false, message: "Une erreur est survenue" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
