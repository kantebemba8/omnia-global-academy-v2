import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "https://omniaglobalacademy.com",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendBrevoSMS(phone: string, message: string, apiKey: string): Promise<boolean> {
  try {
    const res = await fetch("https://api.brevo.com/v3/transactionalSMS/sms", {
      method: "POST",
      headers: {
        "accept": "application/json",
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
    return res.ok;
  } catch {
    return false;
  }
}

async function sendBrevoEmail(to: string, subject: string, content: string, apiKey: string): Promise<boolean> {
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: { name: "Omnia Global Academy", email: "admission@omniaglobalacademy.com" },
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
    return res.ok;
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, message: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const { method, email, phone_number } = body;
    const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || null;
    const brevoApiKey = Deno.env.get("BREVO_API_KEY") ?? "";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ── MÉTHODE EMAIL : envoyer lien de réinitialisation ──────────────
    if (method === "email") {
      if (!email) return json({ success: false, message: "Email requis" }, 400);

      const { data: user } = await supabase
        .from("users")
        .select("id, email, full_name, status")
        .eq("email", email.trim().toLowerCase())
        .maybeSingle();

      // Toujours retourner succès pour éviter l'énumération
      if (!user || user.status === "suspendu" || user.status === "supprime") {
        return json({ success: true, method: "email" });
      }

      // Générer un token unique
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 heure

      await supabase.from("password_reset_tokens").insert({
        user_id: user.id,
        token,
        expires_at: expiresAt,
        method: "email",
      });

      const resetUrl = `${Deno.env.get("APP_URL") || "https://omniaglobalacademy.com"}/reinitialiser-mot-de-passe?token=${token}`;
      const prenom = user.full_name?.split(" ")[0] || "Utilisateur";

      await sendBrevoEmail(
        user.email,
        "Réinitialisation de votre mot de passe — Omnia Academy",
        `Bonjour ${prenom},<br><br>
         Vous avez demandé la réinitialisation de votre mot de passe.<br><br>
         <a href="${resetUrl}" style="background:#002050;color:white;padding:12px 24px;
           border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">
           Réinitialiser mon mot de passe →
         </a><br><br>
         Ce lien est valable <strong>1 heure</strong>.<br>
         Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.`,
        brevoApiKey
      );

      return json({ success: true, method: "email" });
    }

    // ── MÉTHODE SMS : envoyer OTP avec fallback email ──────────────────
    if (method === "sms" || !method) {
      if (!phone_number) return json({ success: false, message: "Numéro requis" }, 400);

      const sanitizedPhone = phone_number.trim();

      const { data: user } = await supabase
        .from("users")
        .select("id, email, full_name, status")
        .eq("phone_number", sanitizedPhone)
        .maybeSingle();

      if (!user || user.status === "suspendu" || user.status === "supprime") {
        return json({ success: true, method: "sms", next_step: "verify_otp", purpose: "reset_password" });
      }

      // Rate limit : 3 OTP par heure
      const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString();
      const { count: recentOtp } = await supabase
        .from("otp_codes")
        .select("*", { count: "exact", head: true })
        .eq("phone_number", sanitizedPhone)
        .eq("purpose", "reset_password")
        .gte("created_at", oneHourAgo);

      if ((recentOtp ?? 0) >= 3) {
        return json({ success: false, message: "Trop de tentatives. Réessayez dans une heure." }, 429);
      }

      // Invalider anciens OTP
      await supabase.from("otp_codes")
        .update({ used: true })
        .eq("phone_number", sanitizedPhone)
        .eq("purpose", "reset_password")
        .eq("used", false);

      // Générer OTP
      const otp = generateOTP();
      await supabase.from("otp_codes").insert({
        phone_number: sanitizedPhone,
        code: otp,
        purpose: "reset_password",
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        ip_address: ipAddress,
      });

      const smsMessage = `Omnia Academy : Code de réinitialisation : ${otp}. Valable 15 minutes.`;

      // Tenter SMS via Brevo
      const smsSent = await sendBrevoSMS(sanitizedPhone, smsMessage, brevoApiKey);

      if (smsSent) {
        return json({ success: true, method: "sms", next_step: "verify_otp", purpose: "reset_password" });
      }

      // Fallback : envoyer le code par email
      const prenom = user.full_name?.split(" ")[0] || "Utilisateur";
      await sendBrevoEmail(
        user.email,
        "Votre code de réinitialisation — Omnia Academy",
        `Bonjour ${prenom},<br><br>
         Le SMS n'a pas pu être envoyé. Voici votre code de réinitialisation :<br><br>
         <div style="font-size:32px;font-weight:900;color:#002050;
           text-align:center;letter-spacing:8px;padding:16px;
           background:#F8F9FA;border-radius:8px">
           ${otp}
         </div><br>
         Ce code est valable <strong>15 minutes</strong>.`,
        brevoApiKey
      );

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
