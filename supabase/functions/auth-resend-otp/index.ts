import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import {
  consumeRateLimit,
  createHashedOtp,
  getClientIP,
  makeCorsHeaders,
  sha256Hex,
} from "../_shared/auth-security.ts";

const messageMap: Record<string, string> = {
  inscription: "Omnia Academy : Votre nouveau code de vérification est {OTP}. Valable 5 minutes.",
  connexion: "Omnia Academy : Votre nouveau code de connexion est {OTP}. Valable 5 minutes.",
  reset_password: "Omnia Academy : Votre nouveau code de réinitialisation est {OTP}. Valable 15 minutes.",
};

async function sendBrevoSMS(phone: string, message: string): Promise<boolean> {
  const brevoKey = Deno.env.get("BREVO_API_KEY") ?? "";
  if (!brevoKey) return false;

  try {
    const response = await fetch("https://api.brevo.com/v3/transactionalSMS/sms", {
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
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function sendBrevoEmailFallback(
  email: string,
  firstName: string,
  otp: string,
  purpose: string,
): Promise<void> {
  const brevoKey = Deno.env.get("BREVO_API_KEY") ?? "";
  if (!brevoKey) return;

  const subjects: Record<string, string> = {
    inscription: "Votre code de vérification — Omnia Academy",
    connexion: "Votre code de connexion — Omnia Academy",
    reset_password: "Votre code de réinitialisation — Omnia Academy",
  };
  const validity = purpose === "reset_password" ? "15 minutes" : "5 minutes";

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
      subject: subjects[purpose] || "Votre code — Omnia Academy",
      htmlContent: `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:32px">
        <div style="background:#002050;padding:24px;text-align:center;border-radius:8px 8px 0 0">
          <h2 style="color:#BF8813;margin:0">OMNIA GLOBAL ACADEMY</h2>
        </div>
        <div style="background:#fff;padding:32px;border:1px solid #E4E7EC;text-align:center">
          <p style="color:#374151">Bonjour ${firstName},</p>
          <p style="color:#374151">SMS indisponible. Voici votre code :</p>
          <div style="font-size:36px;font-weight:900;color:#002050;letter-spacing:8px;padding:16px;background:#F8F9FA;border-radius:8px;margin:16px 0">${otp}</div>
          <p style="color:#6B7280;font-size:13px">Valable ${validity}</p>
        </div>
        <div style="background:#002050;padding:16px;text-align:center;border-radius:0 0 8px 8px">
          <p style="color:rgba(255,255,255,0.5);font-size:12px;margin:0">admission@omniaglobalacademy.com</p>
        </div>
      </div>`,
    }),
  }).catch(() => {});
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
    const purpose = typeof body.purpose === "string" ? body.purpose : "";

    if (phoneNumber.length < 8) {
      return json({ success: false, message: "Numéro de téléphone invalide" }, 400);
    }
    if (!["inscription", "connexion", "reset_password"].includes(purpose)) {
      return json({ success: false, message: "Purpose invalide" }, 400);
    }

    const clientIP = getClientIP(req);
    const phoneHash = await sha256Hex(phoneNumber);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, email, full_name, status")
      .eq("phone_number", phoneNumber)
      .maybeSingle();
    if (userError) throw userError;

    if (!user) {
      return json({ success: false, message: "Aucun compte correspondant" }, 404);
    }

    const cooldown = await consumeRateLimit(
      supabase,
      `auth-resend-otp:cooldown:${purpose}:${phoneHash}`,
      1,
      59,
    );
    if (!cooldown.allowed) {
      return json({
        success: false,
        retry_after: cooldown.retryAfter,
        message: `Veuillez attendre ${cooldown.retryAfter} secondes avant de renvoyer un code.`,
      }, 429);
    }

    const phoneLimit = await consumeRateLimit(
      supabase,
      `auth-resend-otp:phone:${purpose}:${phoneHash}`,
      3,
      60 * 60,
    );
    const ipLimit = await consumeRateLimit(
      supabase,
      `auth-resend-otp:ip:${clientIP}`,
      10,
      60 * 60,
    );
    if (!phoneLimit.allowed || !ipLimit.allowed) {
      return json({
        success: false,
        retry_after: Math.max(phoneLimit.retryAfter, ipLimit.retryAfter),
        message: "Trop de tentatives. Réessayez plus tard.",
      }, 429);
    }

    await supabase
      .from("otp_codes")
      .update({ used: true })
      .eq("phone_number", phoneNumber)
      .eq("purpose", purpose)
      .eq("used", false);

    const expiresInMinutes = purpose === "reset_password" ? 15 : 5;
    const otp = await createHashedOtp(supabase, {
      phoneNumber,
      purpose: purpose as "inscription" | "connexion" | "reset_password",
      expiresAt: new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString(),
      ipAddress: clientIP,
    });

    const message = (messageMap[purpose] || "Omnia Academy : Votre code est {OTP}.")
      .replace("{OTP}", otp);
    const smsSent = await sendBrevoSMS(phoneNumber, message);

    if (!smsSent && user.email) {
      await sendBrevoEmailFallback(
        user.email,
        user.full_name?.split(" ")[0] || "Utilisateur",
        otp,
        purpose,
      );
    }

    const { error: smsLogError } = await supabase.from("sms_rate_limits").insert({
      phone_number: phoneNumber,
      ip_address: clientIP,
    });
    if (smsLogError) {
      console.error("sms_rate_limits insert failed:", smsLogError.message);
    }

    return json({
      success: true,
      next_step: "verify_otp",
      delivery: smsSent ? "sms" : "email_fallback",
    });
  } catch (error) {
    console.error("auth-resend-otp error:", error);
    return json({ success: false, message: "Une erreur est survenue" }, 500);
  }
});
