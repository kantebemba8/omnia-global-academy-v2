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

async function sendSMS(phone: string, otp: string): Promise<void> {
  const username = Deno.env.get("AFRICASTALKING_USERNAME") || "sandbox";
  const apiUrl = username === "sandbox"
    ? "https://api.sandbox.africastalking.com/version1/messaging"
    : "https://api.africastalking.com/version1/messaging";

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      apiKey: Deno.env.get("AFRICASTALKING_API_KEY") ?? "",
    },
    body: new URLSearchParams({
      username,
      to: phone,
      message: `Omnia Academy : Votre code de connexion est ${otp}. Valable 5 minutes. Ne le partagez jamais.`,
      from: Deno.env.get("AFRICASTALKING_SENDER_ID") || "OmniaAcad",
    }),
  });

  if (!res.ok) {
    console.error("Africa's Talking error:", await res.text());
  }
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

    // Check user exists and is active
    const { data: user } = await supabase
      .from("users").select("id, status").eq("phone_number", sanitizedPhone).maybeSingle();

    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        not_found: true,
        message: "Aucun compte trouvé. Souhaitez-vous vous inscrire ?",
      }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (user.status !== "actif") {
      return new Response(JSON.stringify({ success: false, message: "Compte inactif ou en attente de validation" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    // Generate and store OTP
    const otp = generateOTP();
    const { error: otpError } = await supabase.from("otp_codes").insert({
      phone_number: sanitizedPhone,
      code: otp,
      purpose: "connexion",
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      ip_address: ipAddress,
    });
    if (otpError) throw otpError;

    await sendSMS(sanitizedPhone, otp);

    await supabase.from("sms_rate_limits").insert({
      phone_number: sanitizedPhone,
      ip_address: ipAddress,
    });

    return new Response(JSON.stringify({ success: true, next_step: "enter_otp" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("auth-login-otp error:", error);
    return new Response(JSON.stringify({ success: false, message: "Une erreur est survenue" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
