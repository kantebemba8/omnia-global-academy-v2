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

async function sendSMS(phone: string, otp: string, email?: string, fullName?: string): Promise<void> {
  const brevoKey = Deno.env.get("BREVO_API_KEY") ?? "";
  if (!brevoKey) return;

  const message = `Omnia Academy : Votre code de connexion est ${otp}. Valable 5 minutes. Ne le partagez jamais.`;

  const res = await fetch("https://api.brevo.com/v3/transactionalSMS/sms", {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "api-key": brevoKey,
    },
    body: JSON.stringify({
      sender: "OmniaAcad",
      recipient: phone,
      content: message,
      type: "transactional",
    }),
  }).catch(() => null);

  if ((!res || !res.ok) && email) {
    const prenom = fullName?.split(" ")[0] || "";
    await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "api-key": brevoKey,
      },
      body: JSON.stringify({
        sender: { name: "Omnia Global Academy", email: "admission@omniaglobalacademy.com" },
        to: [{ email }],
        subject: "Votre code de connexion — Omnia Academy",
        htmlContent: `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:32px">
          <div style="background:#002050;padding:24px;text-align:center;border-radius:8px 8px 0 0">
            <h2 style="color:#BF8813;margin:0">OMNIA GLOBAL ACADEMY</h2>
          </div>
          <div style="background:#fff;padding:32px;border:1px solid #E4E7EC;text-align:center">
            <p style="color:#374151">Bonjour ${prenom},</p>
            <p style="color:#374151">SMS indisponible. Voici votre code de connexion :</p>
            <div style="font-size:36px;font-weight:900;color:#002050;
              letter-spacing:8px;padding:16px;background:#F8F9FA;
              border-radius:8px;margin:16px 0">${otp}</div>
            <p style="color:#6B7280;font-size:13px">Valable 5 minutes. Ne le partagez jamais.</p>
          </div>
          <div style="background:#002050;padding:16px;text-align:center;border-radius:0 0 8px 8px">
            <p style="color:rgba(255,255,255,0.5);font-size:12px;margin:0">
              admission@omniaglobalacademy.com
            </p>
          </div>
        </div>`,
      }),
    }).catch(() => {});
  }
}
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

    const { data: userFull } = await supabase
      .from("users")
      .select("email, full_name")
      .eq("phone_number", sanitizedPhone)
      .maybeSingle();
    await sendSMS(sanitizedPhone, otp, userFull?.email, userFull?.full_name);

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
