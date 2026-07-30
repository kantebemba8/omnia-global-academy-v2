import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import {
  consumeRateLimit,
  createHashedOtp,
  generateOpaqueToken,
  getClientIP,
  makeCorsHeaders,
  sha256Hex,
} from "../_shared/auth-security.ts";

async function sendBrevoSMS(
  phone: string,
  message: string,
  apiKey: string,
): Promise<boolean> {
  if (!apiKey) return false;
  try {
    const response = await fetch("https://api.brevo.com/v3/transactionalSMS/sms", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: "OmniaAcad",
        recipient: phone,
        content: message,
        type: "transactional",
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function sendBrevoEmail(
  to: string,
  subject: string,
  content: string,
  apiKey: string,
): Promise<boolean> {
  if (!apiKey) return false;
  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: {
          name: "Omnia Global Academy",
          email: "admission@omniaglobalacademy.com",
        },
        to: [{ email: to }],
        subject,
        htmlContent: `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:32px">
          <div style="background:#002050;padding:24px;text-align:center;border-radius:8px 8px 0 0">
            <h2 style="color:#BF8813;margin:0">OMNIA GLOBAL ACADEMY</h2>
          </div>
          <div style="background:#fff;padding:32px;border:1px solid #E4E7EC">
            <p style="color:#374151">${content}</p>
          </div>
          <div style="background:#002050;padding:16px;text-align:center;border-radius:0 0 8px 8px">
            <p style="color:rgba(255,255,255,0.5);font-size:12px;margin:0">admission@omniaglobalacademy.com</p>
          </div>
        </div>`,
      }),
    });
    return response.ok;
  } catch {
    return false;
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
    const method = typeof body.method === "string" ? body.method : "sms";
    const email = typeof body.email === "string"
      ? body.email.trim().toLowerCase()
      : "";
    const phoneNumber = typeof body.phone_number === "string"
      ? body.phone_number.trim()
      : "";
    const clientIP = getClientIP(req);
    const brevoApiKey = Deno.env.get("BREVO_API_KEY") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const ipLimit = await consumeRateLimit(
      supabase,
      `auth-forgot-password:ip:${clientIP}`,
      10,
      60 * 60,
    );
    if (!ipLimit.allowed) {
      return json({
        success: false,
        message: "Trop de demandes. Réessayez plus tard.",
        retry_after: ipLimit.retryAfter,
      }, 429);
    }

    if (method === "email") {
      if (!email) {
        return json({ success: false, message: "Email requis" }, 400);
      }

      const emailHash = await sha256Hex(email);
      const emailLimit = await consumeRateLimit(
        supabase,
        `auth-forgot-password:email:${emailHash}`,
        3,
        60 * 60,
      );
      if (!emailLimit.allowed) {
        return json({
          success: false,
          message: "Trop de demandes. Réessayez plus tard.",
          retry_after: emailLimit.retryAfter,
        }, 429);
      }

      const { data: user, error: userError } = await supabase
        .from("users")
        .select("id, email, full_name, status")
        .eq("email", email)
        .maybeSingle();
      if (userError) throw userError;

      // Réponse volontairement identique pour empêcher l'énumération des comptes.
      if (!user || user.status === "suspendu" || user.status === "supprime") {
        return json({ success: true, method: "email" });
      }

      const rawToken = generateOpaqueToken();
      const tokenHash = await sha256Hex(rawToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      await supabase
        .from("password_reset_tokens")
        .update({ used: true })
        .eq("user_id", user.id)
        .eq("used", false);

      const { error: tokenError } = await supabase
        .from("password_reset_tokens")
        .insert({
          user_id: user.id,
          reset_token: null,
          token_hash: tokenHash,
          expires_at: expiresAt,
        });
      if (tokenError) throw tokenError;

      const appUrl = Deno.env.get("APP_URL") || "https://omniaglobalacademy.com";
      const resetUrl =
        `${appUrl}/reinitialiser-mot-de-passe?token=${encodeURIComponent(rawToken)}`;
      const firstName = user.full_name?.split(" ")[0] || "Utilisateur";

      const sent = await sendBrevoEmail(
        user.email,
        "Réinitialisation de votre mot de passe — Omnia Academy",
        `Bonjour ${firstName},<br><br>
         Vous avez demandé la réinitialisation de votre mot de passe.<br><br>
         <a href="${resetUrl}" style="background:#002050;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">
           Réinitialiser mon mot de passe →
         </a><br><br>
         Ce lien est valable <strong>1 heure</strong>.<br>
         Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.`,
        brevoApiKey,
      );

      if (!sent) {
        console.error("Password-reset email delivery failed for user:", user.id);
      }

      return json({ success: true, method: "email" });
    }

    if (method === "sms" || !method) {
      if (!phoneNumber) {
        return json({ success: false, message: "Numéro requis" }, 400);
      }

      const phoneHash = await sha256Hex(phoneNumber);
      const phoneLimit = await consumeRateLimit(
        supabase,
        `auth-forgot-password:phone:${phoneHash}`,
        3,
        60 * 60,
      );
      if (!phoneLimit.allowed) {
        return json({
          success: false,
          message: "Trop de demandes. Réessayez plus tard.",
          retry_after: phoneLimit.retryAfter,
        }, 429);
      }

      const { data: user, error: userError } = await supabase
        .from("users")
        .select("id, email, full_name, status")
        .eq("phone_number", phoneNumber)
        .maybeSingle();
      if (userError) throw userError;

      if (!user || user.status === "suspendu" || user.status === "supprime") {
        return json({
          success: true,
          method: "sms",
          next_step: "verify_otp",
          purpose: "reset_password",
        });
      }

      await supabase
        .from("otp_codes")
        .update({ used: true })
        .eq("phone_number", phoneNumber)
        .eq("purpose", "reset_password")
        .eq("used", false);

      const otp = await createHashedOtp(supabase, {
        phoneNumber,
        purpose: "reset_password",
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        ipAddress: clientIP,
      });

      const smsSent = await sendBrevoSMS(
        phoneNumber,
        `Omnia Academy : Code de réinitialisation : ${otp}. Valable 15 minutes.`,
        brevoApiKey,
      );

      if (smsSent) {
        return json({
          success: true,
          method: "sms",
          next_step: "verify_otp",
          purpose: "reset_password",
        });
      }

      const firstName = user.full_name?.split(" ")[0] || "Utilisateur";
      const emailSent = await sendBrevoEmail(
        user.email,
        "Votre code de réinitialisation — Omnia Academy",
        `Bonjour ${firstName},<br><br>
         Le SMS n'a pas pu être envoyé. Voici votre code de réinitialisation :<br><br>
         <div style="font-size:32px;font-weight:900;color:#002050;text-align:center;letter-spacing:8px;padding:16px;background:#F8F9FA;border-radius:8px">
           ${otp}
         </div><br>
         Ce code est valable <strong>15 minutes</strong>.`,
        brevoApiKey,
      );

      if (!emailSent) {
        console.error("Password-reset OTP delivery failed for user:", user.id);
      }

      return json({
        success: true,
        method: "email_fallback",
        next_step: "verify_otp",
        purpose: "reset_password",
        message: "SMS indisponible — code envoyé par email",
      });
    }

    return json({ success: false, message: "Méthode invalide" }, 400);
  } catch (error) {
    console.error("auth-forgot-password error:", error);
    return json({ success: false, message: "Une erreur est survenue" }, 500);
  }
});
