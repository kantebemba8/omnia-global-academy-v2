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

    const ipLimit = await consumeRateLimit(supabase, `auth-login-otp:ip:${clientIP}`, 10, 60 * 60);
    const emailLimit = await consumeRateLimit(supabase, `auth-login-otp:email:${emailHash}`, 3, 60 * 60);
    if (!ipLimit.allowed || !emailLimit.allowed) {
      return json({ success: false, message: "Trop de codes demandés. Réessayez plus tard.", retry_after: Math.max(ipLimit.retryAfter, emailLimit.retryAfter) }, 429);
    }

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id,status,email,email_status,full_name,suspension_source,self_suspension_until")
      .eq("email", email)
      .maybeSingle();
    if (userError) throw userError;
    if (!user) {
      // Réponse volontairement identique à un envoi réussi : ne jamais révéler
      // publiquement si une adresse possède ou non un compte Omnia.
      return json({ success: true, next_step: "enter_otp", delivery: "email" });
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
    if (user.status === "supprime") return json({ success: false, error: "ACCOUNT_DELETED", message: "Ce compte a été supprimé." }, 410);

    if (String(user.email_status || "valide") === "a_verifier") {
      await supabase.from("otp_codes").update({ used: true }).eq("email", email).eq("purpose", "inscription").eq("used", false);
      const otp = await createHashedEmailOtp(supabase, {
        email,
        purpose: "inscription",
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        ipAddress: clientIP,
      });
      const sent = await sendOmniaEmail({
        to: { email, name: user.full_name || undefined },
        templateKey: "auth_verification_otp",
        params: { FIRST_NAME: String(user.full_name || "").split(" ")[0], OTP_CODE: otp, EXPIRY_MINUTES: 5 },
        userId: String(user.id),
        sb: supabase,
      });
      if (!sent) return json({
        success: false,
        needs_email_verification: true,
        verification_purpose: "inscription",
        purpose: "inscription",
        email,
        verification_email: email,
        email_sent: false,
        initial_email_sent: false,
        message: "Le code de confirmation n’a pas pu être envoyé par e-mail. Vous pouvez le renvoyer depuis l’écran de vérification.",
      }, 503);
      return json({
        success: true,
        next_step: "verify_email_otp",
        verification_purpose: "inscription",
        purpose: "inscription",
        email,
        verification_email: email,
        email_sent: true,
        initial_email_sent: true,
        delivery: "email",
      });
    }

    if (user.status === "en_attente_validation") {
      return json({ success: false, needs_validation: true, message: "Votre adresse e-mail est confirmée. Votre dossier est en attente de validation par notre équipe." }, 403);
    }
    if (user.status !== "actif") return json({ success: false, message: "Compte inactif" }, 403);

    await supabase.from("otp_codes").update({ used: true }).eq("email", email).eq("purpose", "connexion").eq("used", false);
    const otp = await createHashedEmailOtp(supabase, {
      email,
      purpose: "connexion",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      ipAddress: clientIP,
    });

    const sent = await sendOmniaEmail({
      to: { email, name: user.full_name || undefined },
      templateKey: "auth_login_otp",
      params: { PRENOM: String(user.full_name || "").split(" ")[0], OTP: otp, EXPIRES_MINUTES: 5 },
      senderEmail: Deno.env.get("BREVO_AUTH_SENDER_EMAIL") || Deno.env.get("BREVO_SENDER_EMAIL") || "contact@omniaglobalacademy.com",
      userId: String(user.id),
      sb: supabase,
    });
    if (!sent) return json({ success: false, message: "Le code de connexion n’a pas pu être envoyé." }, 503);
    return json({ success: true, next_step: "enter_otp", delivery: "email" });
  } catch (error) {
    console.error("auth-login-otp error:", error);
    return json({ success: false, message: "Une erreur est survenue" }, 500);
  }
});
