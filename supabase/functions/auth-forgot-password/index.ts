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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ success: false, message: "Adresse e-mail invalide" }, 400);
    }

    const clientIP = getClientIP(req);
    const emailHash = await sha256Hex(email);
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const ipLimit = await consumeRateLimit(supabase, `auth-forgot-password:ip:${clientIP}`, 10, 60 * 60);
    const emailLimit = await consumeRateLimit(supabase, `auth-forgot-password:email:${emailHash}`, 3, 60 * 60);
    if (!ipLimit.allowed || !emailLimit.allowed) {
      return json({ success: false, message: "Trop de demandes. Réessayez plus tard.", retry_after: Math.max(ipLimit.retryAfter, emailLimit.retryAfter) }, 429);
    }

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id,email,full_name,status,suspension_source")
      .eq("email", email)
      .maybeSingle();
    if (userError) throw userError;

    // Réponse neutre pour limiter l'énumération de comptes.
    if (!user || user.status === "supprime" || (user.status === "suspendu" && user.suspension_source !== "self")) {
      return json({ success: true, method: "email_otp", next_step: "verify_otp", delivery: "email" });
    }

    await supabase.from("otp_codes")
      .update({ used: true })
      .eq("email", email)
      .eq("purpose", "reset_password")
      .eq("used", false);

    const expiresInMinutes = 15;
    const otp = await createHashedEmailOtp(supabase, {
      email,
      purpose: "reset_password",
      expiresAt: new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString(),
      ipAddress: clientIP,
    });

    const sent = await sendOmniaEmail({
      to: { email: user.email, name: user.full_name || undefined },
      templateKey: "auth_password_reset",
      params: {
        FIRST_NAME: String(user.full_name || "").split(" ")[0],
        OTP_CODE: otp,
        EXPIRY_MINUTES: expiresInMinutes,
      },
      userId: String(user.id),
      sb: supabase,
    });
    if (!sent) console.error("Password-reset OTP email delivery failed for user:", user.id);

    return json({ success: true, method: "email_otp", next_step: "verify_otp", delivery: "email" });
  } catch (error) {
    console.error("auth-forgot-password error:", error);
    return json({ success: false, message: "Une erreur est survenue" }, 500);
  }
});
