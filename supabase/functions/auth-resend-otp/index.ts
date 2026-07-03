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

async function sendSMS(phone: string, otp: string, purpose: string): Promise<void> {
  const username = Deno.env.get("AFRICASTALKING_USERNAME") || "sandbox";
  const apiUrl = username === "sandbox"
    ? "https://api.sandbox.africastalking.com/version1/messaging"
    : "https://api.africastalking.com/version1/messaging";

  const messageMap: Record<string, string> = {
    inscription: `Omnia Academy : Votre nouveau code de vérification est ${otp}. Valable 5 minutes.`,
    connexion: `Omnia Academy : Votre nouveau code de connexion est ${otp}. Valable 5 minutes.`,
    reset_password: `Omnia Academy : Votre nouveau code de réinitialisation est ${otp}. Valable 5 minutes.`,
  };

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
      message: messageMap[purpose] || `Omnia Academy : Votre nouveau code est ${otp}. Valable 5 minutes.`,
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
    const { phone_number, purpose } = await req.json();

    if (!phone_number || phone_number.trim().length < 8) {
      return new Response(JSON.stringify({ success: false, message: "Numéro de téléphone invalide" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["inscription", "connexion", "reset_password"].includes(purpose)) {
      return new Response(JSON.stringify({ success: false, message: "Purpose invalide" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sanitizedPhone = phone_number.trim();
    const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 59-second cooldown: check last SMS sent to this number
    const { data: lastSms } = await supabase
      .from("sms_rate_limits")
      .select("sent_at")
      .eq("phone_number", sanitizedPhone)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastSms) {
      const secondsSinceLast = (Date.now() - new Date(lastSms.sent_at).getTime()) / 1000;
      if (secondsSinceLast < 59) {
        const waitSeconds = Math.ceil(59 - secondsSinceLast);
        return new Response(JSON.stringify({
          success: false,
          retry_after: waitSeconds,
          message: `Veuillez attendre ${waitSeconds} secondes avant de renvoyer un code.`,
        }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Hourly rate limit: max 3 SMS/heure
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

    // Invalidate existing OTPs for this phone + purpose
    await supabase
      .from("otp_codes")
      .update({ used: true })
      .eq("phone_number", sanitizedPhone)
      .eq("purpose", purpose)
      .eq("used", false);

    // Generate and store new OTP
    const otp = generateOTP();
    const { error: otpError } = await supabase.from("otp_codes").insert({
      phone_number: sanitizedPhone,
      code: otp,
      purpose,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      ip_address: ipAddress,
    });
    if (otpError) throw otpError;

    await sendSMS(sanitizedPhone, otp, purpose);

    await supabase.from("sms_rate_limits").insert({
      phone_number: sanitizedPhone,
      ip_address: ipAddress,
    });

    return new Response(JSON.stringify({ success: true, next_step: "verify_otp" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("auth-resend-otp error:", error);
    return new Response(JSON.stringify({ success: false, message: "Une erreur est survenue" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
