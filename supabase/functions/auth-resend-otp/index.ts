import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import {
  consumeRateLimit,
  createHashedEmailOtp,
  getClientIP,
  makeCorsHeaders,
  sha256Hex,
} from "../_shared/auth-security.ts";
import { sendOmniaEmail } from "../_shared/brevo-mail.ts";

Deno.serve(async (req: Request) => {
  const corsHeaders = makeCorsHeaders(req);
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, message: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const purpose = String(body.purpose || "");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ success: false, message: "Adresse e-mail invalide" }, 400);
    }
    if (!["inscription", "connexion", "reset_password"].includes(purpose)) {
      return json({ success: false, message: "Purpose invalide" }, 400);
    }

    const clientIP = getClientIP(req);
    const emailHash = await sha256Hex(email);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id,email,full_name,status")
      .eq("email", email)
      .maybeSingle();
    if (userError) throw userError;
    if (!user) return json({ success: false, message: "Aucun compte correspondant" }, 404);

    const cooldown = await consumeRateLimit(supabase, `auth-resend-otp:cooldown:${purpose}:${emailHash}`, 1, 59);
    const emailLimit = await consumeRateLimit(supabase, `auth-resend-otp:email:${purpose}:${emailHash}`, 3, 60 * 60);
    const ipLimit = await consumeRateLimit(supabase, `auth-resend-otp:ip:${clientIP}`, 10, 60 * 60);
    if (!cooldown.allowed || !emailLimit.allowed || !ipLimit.allowed) {
      const retryAfter = Math.max(cooldown.retryAfter, emailLimit.retryAfter, ipLimit.retryAfter);
      return json({ success: false, retry_after: retryAfter, message: `Veuillez réessayer dans ${retryAfter} secondes.` }, 429);
    }

    await supabase.from("otp_codes")
      .update({ used: true })
      .eq("email", email)
      .eq("purpose", purpose)
      .eq("used", false);

    const expiresInMinutes = purpose === "reset_password" ? 15 : 5;
    const otp = await createHashedEmailOtp(supabase, {
      email,
      purpose: purpose as "inscription" | "connexion" | "reset_password",
      expiresAt: new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString(),
      ipAddress: clientIP,
    });

    const templateKey = purpose === "connexion"
      ? "auth_login_otp"
      : purpose === "reset_password"
      ? "auth_password_reset"
      : "auth_verification_otp";
    const sent = await sendOmniaEmail({
      to: { email, name: user.full_name || undefined },
      templateKey,
      params: {
        FIRST_NAME: String(user.full_name || "").split(" ")[0],
        OTP_CODE: otp,
        EXPIRY_MINUTES: expiresInMinutes,
      },
      userId: String(user.id),
      sb: supabase,
    });

    if (!sent) return json({ success: false, message: "Le code n’a pas pu être envoyé par e-mail." }, 503);
    return json({ success: true, next_step: "verify_otp", delivery: "email" });
  } catch (error) {
    console.error("auth-resend-otp error:", error);
    return json({ success: false, message: "Une erreur est survenue" }, 500);
  }
});
