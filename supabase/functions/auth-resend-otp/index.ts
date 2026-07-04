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

const messageMap: Record<string, string> = {
  inscription: `Omnia Academy : Votre nouveau code de vérification est {OTP}. Valable 5 minutes.`,
  connexion: `Omnia Academy : Votre nouveau code de connexion est {OTP}. Valable 5 minutes.`,
  reset_password: `Omnia Academy : Votre nouveau code de réinitialisation est {OTP}. Valable 5 minutes.`,
};

async function sendBrevoSMS(phone: string, message: string): Promise<boolean> {
  const brevoKey = Deno.env.get("BREVO_API_KEY") ?? "";
  if (!brevoKey) return false;
  try {
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
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function sendBrevoEmailFallback(
  email: string,
  prenom: string,
  otp: string,
  purpose: string,
  brevoKey: string
): Promise<void> {
  const subjects: Record<string, string> = {
    inscription: "Votre code de vérification — Omnia Academy",
    connexion: "Votre code de connexion — Omnia Academy",
    reset_password: "Votre code de réinitialisation — Omnia Academy",
  };
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
      subject: subjects[purpose] || "Votre code — Omnia Academy",
      htmlContent: `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:32px">
        <div style="background:#002050;padding:24px;text-align:center;border-radius:8px 8px 0 0">
          <h2 style="color:#BF8813;margin:0">OMNIA GLOBAL ACADEMY</h2>
        </div>
        <div style="background:#fff;padding:32px;border:1px solid #E4E7EC;text-align:center">
          <p style="color:#374151">Bonjour ${prenom},</p>
          <p style="color:#374151">SMS indisponible. Voici votre code :</p>
          <div style="font-size:36px;font-weight:900;color:#002050;
            letter-spacing:8px;padding:16px;background:#F8F9FA;
            border-radius:8px;margin:16px 0">${otp}</div>
          <p style="color:#6B7280;font-size:13px">Valable 5 minutes</p>
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, message: "Method not allowed" }, 405);

  try {
    const { phone_number, purpose } = await req.json();

    if (!phone_number || phone_number.trim().length < 8) {
      return json({ success: false, message: "Numéro de téléphone invalide" }, 400);
    }
    if (!["inscription", "connexion", "reset_password"].includes(purpose)) {
      return json({ success: false, message: "Purpose invalide" }, 400);
    }

    const sanitizedPhone = phone_number.trim();
    const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || null;
    const brevoKey = Deno.env.get("BREVO_API_KEY") ?? "";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Cooldown 59 secondes
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
        return json({
          success: false,
          retry_after: waitSeconds,
          message: `Veuillez attendre ${waitSeconds} secondes avant de renvoyer un code.`,
        }, 429);
      }
    }

    // Rate limit 3/heure
    const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString();
    const { count: recentSms } = await supabase
      .from("sms_rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("phone_number", sanitizedPhone)
      .gte("sent_at", oneHourAgo);

    if ((recentSms ?? 0) >= 3) {
      return json({ success: false, message: "Trop de tentatives. Réessayez dans une heure." }, 429);
    }

    // Invalider anciens OTP
    await supabase.from("otp_codes")
      .update({ used: true })
      .eq("phone_number", sanitizedPhone)
      .eq("purpose", purpose)
      .eq("used", false);

    // Générer OTP
    const otp = generateOTP();
    await supabase.from("otp_codes").insert({
      phone_number: sanitizedPhone,
      code: otp,
      purpose,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      ip_address: ipAddress,
    });

    const message = (messageMap[purpose] || `Omnia Academy : Votre code est {OTP}. Valable 5 minutes.`)
      .replace("{OTP}", otp);

    // Tenter SMS via Brevo
    const smsSent = await sendBrevoSMS(sanitizedPhone, message);

    // Fallback email si SMS échoue
    if (!smsSent) {
      const { data: user } = await supabase
        .from("users")
        .select("email, full_name")
        .eq("phone_number", sanitizedPhone)
        .maybeSingle();

      if (user?.email) {
        const prenom = user.full_name?.split(" ")[0] || "Utilisateur";
        await sendBrevoEmailFallback(user.email, prenom, otp, purpose, brevoKey);
      }
    }

    await supabase.from("sms_rate_limits").insert({
      phone_number: sanitizedPhone,
      ip_address: ipAddress,
    });

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
