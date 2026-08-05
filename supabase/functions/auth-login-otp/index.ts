import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import {
  consumeRateLimit,
  createHashedOtp,
  getClientIP,
  makeCorsHeaders,
  sha256Hex,
} from "../_shared/auth-security.ts";

async function sendSMS(
  phone: string,
  otp: string,
  email?: string,
  fullName?: string,
): Promise<void> {
  const brevoKey = Deno.env.get("BREVO_API_KEY") ?? "";
  if (!brevoKey) {
    console.error("BREVO_API_KEY is missing; OTP delivery was not attempted.");
    return;
  }

  const message =
    `Omnia Academy : Votre code de connexion est ${otp}. Valable 5 minutes. Ne le partagez jamais.`;

  const res = await fetch("https://api.brevo.com/v3/transactionalSMS/sms", {
    method: "POST",
    headers: {
      Accept: "application/json",
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
    const firstName = fullName?.split(" ")[0] || "";
    await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "api-key": brevoKey,
      },
      body: JSON.stringify({
        sender: {
          name: "Omnia Global Academy",
          email: "admission@omniaglobalacademy.com",
        },
        to: [{ email }],
        subject: "Votre code de connexion — Omnia Academy",
        htmlContent: `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:32px">
          <div style="background:#002050;padding:24px;text-align:center;border-radius:8px 8px 0 0">
            <h2 style="color:#BF8813;margin:0">OMNIA GLOBAL ACADEMY</h2>
          </div>
          <div style="background:#fff;padding:32px;border:1px solid #E4E7EC;text-align:center">
            <p style="color:#374151">Bonjour ${firstName},</p>
            <p style="color:#374151">SMS indisponible. Voici votre code de connexion :</p>
            <div style="font-size:36px;font-weight:900;color:#002050;letter-spacing:8px;padding:16px;background:#F8F9FA;border-radius:8px;margin:16px 0">${otp}</div>
            <p style="color:#6B7280;font-size:13px">Valable 5 minutes. Ne le partagez jamais.</p>
          </div>
          <div style="background:#002050;padding:16px;text-align:center;border-radius:0 0 8px 8px">
            <p style="color:rgba(255,255,255,0.5);font-size:12px;margin:0">admission@omniaglobalacademy.com</p>
          </div>
        </div>`,
      }),
    }).catch(() => {});
  }
}

Deno.serve(async (req: Request) => {
  const corsHeaders = makeCorsHeaders(req);
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ success: false, message: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json();
    const phoneNumber = typeof body.phone_number === "string"
      ? body.phone_number.trim()
      : "";

    if (phoneNumber.length < 8) {
      return json({ success: false, message: "Numéro de téléphone invalide" }, 400);
    }

    const clientIP = getClientIP(req);
    const phoneHash = await sha256Hex(phoneNumber);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const ipLimit = await consumeRateLimit(
      supabase,
      `auth-login-otp:ip:${clientIP}`,
      10,
      60 * 60,
    );
    const phoneLimit = await consumeRateLimit(
      supabase,
      `auth-login-otp:phone:${phoneHash}`,
      3,
      60 * 60,
    );

    if (!ipLimit.allowed || !phoneLimit.allowed) {
      return json({
        success: false,
        message: "Trop de codes demandés. Réessayez plus tard.",
        retry_after: Math.max(ipLimit.retryAfter, phoneLimit.retryAfter),
      }, 429);
    }

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, status, email, full_name, suspension_source, self_suspension_until")
      .eq("phone_number", phoneNumber)
      .maybeSingle();
    if (userError) throw userError;

    if (!user) {
      return json({
        success: false,
        not_found: true,
        message: "Aucun compte trouvé. Souhaitez-vous vous inscrire ?",
      }, 404);
    }

    if (user.status === "suspendu") {
      const selfSuspended = user.suspension_source === "self";
      return json({
        success: false,
        error: selfSuspended ? "ACCOUNT_SELF_SUSPENDED" : "ACCOUNT_SUSPENDED",
        can_reactivate: selfSuspended,
        suspended_until: selfSuspended ? user.self_suspension_until || null : null,
        message: selfSuspended
          ? "Ce compte est suspendu volontairement. Utilisez la connexion par mot de passe pour le réactiver en toute sécurité."
          : "Ce compte a été suspendu par l’équipe Omnia. Contactez le support.",
      }, 403);
    }

    if (user.status !== "actif") {
      return json({
        success: false,
        message: "Compte inactif ou en attente de validation",
      }, 403);
    }

    await supabase
      .from("otp_codes")
      .update({ used: true })
      .eq("phone_number", phoneNumber)
      .eq("purpose", "connexion")
      .eq("used", false);

    const otp = await createHashedOtp(supabase, {
      phoneNumber,
      purpose: "connexion",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      ipAddress: clientIP,
    });

    await sendSMS(phoneNumber, otp, user.email, user.full_name);

    const { error: smsLogError } = await supabase.from("sms_rate_limits").insert({
      phone_number: phoneNumber,
      ip_address: clientIP,
    });
    if (smsLogError) {
      console.error("sms_rate_limits insert failed:", smsLogError.message);
    }

    return json({ success: true, next_step: "enter_otp" });
  } catch (error) {
    console.error("auth-login-otp error:", error);
    return json({ success: false, message: "Une erreur est survenue" }, 500);
  }
});
