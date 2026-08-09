import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import {
  consumeRateLimit,
  generateOpaqueToken,
  getClientIP,
  makeCorsHeaders,
  sha256Hex,
} from "../_shared/auth-security.ts";
import { acceptPendingInvitationsForUser } from "../_shared/access-invitations.ts";
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
    const otpCode = String(body.otp_code ?? "").trim();
    const purpose = String(body.purpose || "");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{6}$/.test(otpCode) || !purpose) {
      return json({ success: false, message: "Champs requis manquants" }, 400);
    }
    if (!["inscription", "connexion", "reset_password"].includes(purpose)) {
      return json({ success: false, message: "Purpose invalide" }, 400);
    }

    const clientIP = getClientIP(req);
    const emailHash = await sha256Hex(email);
    const codeHash = await sha256Hex(otpCode);
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const ipLimit = await consumeRateLimit(supabase, `auth-verify-otp:ip:${clientIP}`, 20, 15 * 60);
    const emailLimit = await consumeRateLimit(supabase, `auth-verify-otp:email:${purpose}:${emailHash}`, 10, 15 * 60);
    if (!ipLimit.allowed || !emailLimit.allowed) {
      return json({ success: false, message: "Trop de tentatives. Réessayez plus tard.", retry_after: Math.max(ipLimit.retryAfter, emailLimit.retryAfter) }, 429);
    }

    const { data: verificationData, error: verificationError } = await supabase.rpc("verify_omnia_email_otp", {
      p_email: email,
      p_purpose: purpose,
      p_code: otpCode,
      p_code_hash: codeHash,
      p_max_attempts: 5,
    });
    if (verificationError) throw verificationError;

    const verification = Array.isArray(verificationData) ? verificationData[0] : verificationData;
    const verificationStatus = String(verification?.status ?? "not_found");
    if (verificationStatus !== "verified") {
      const messages: Record<string, string> = {
        not_found: "Aucun code valide trouvé",
        expired: "Code expiré",
        incorrect: "Code incorrect",
        locked: "Trop de codes incorrects. Demandez un nouveau code.",
        invalid_request: "Code invalide",
      };
      return json({
        success: false,
        message: messages[verificationStatus] || "Code invalide",
        remaining_attempts: Number(verification?.remaining_attempts ?? 0),
      }, verificationStatus === "locked" ? 429 : 400);
    }

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id,email,full_name,phone_number,status,email_status,country_code,avatar_url,force_password_change")
      .eq("email", email)
      .maybeSingle();
    if (userError) throw userError;
    if (!user) return json({ success: false, message: "Utilisateur introuvable" }, 404);

    if (purpose === "inscription") {
      try {
        await acceptPendingInvitationsForUser(supabase, String(user.id), String(user.email || ""));
      } catch (error) {
        console.error("access invitation finalization failed", error);
        throw error;
      }
    }

    const { data: rolesData, error: rolesError } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    if (rolesError) throw rolesError;
    const userRoles = (rolesData ?? []).map((row: { role: string }) => row.role);
    const requiresManualValidation = userRoles.some((role: string) =>
      ["professeur", "responsable_structure", "recruteur_independant"].includes(role)
    );
    const now = new Date().toISOString();

    if (purpose === "inscription") {
      if (!requiresManualValidation) {
        const { error: activationError } = await supabase.from("users").update({ status: "actif", email_status: "valide", updated_at: now }).eq("id", user.id);
        if (activationError) throw activationError;

        await sendOmniaEmail({
          to: { email: user.email, name: user.full_name || undefined },
          templateKey: "account_welcome",
          params: {
            PRENOM: String(user.full_name || "").split(" ")[0],
            ROLE_NAME: userRoles.includes("moderateur") ? "Équipe de modération" : userRoles.includes("recruteur_structure") ? "Recrutement Structure" : userRoles.includes("gestionnaire_structure") ? "Équipe Structure" : "Apprenant",
            MESSAGE_SPECIFIQUE: "Votre adresse e-mail est confirmée et votre compte est actif.",
            DASHBOARD_URL: `${Deno.env.get("APP_URL") || "https://omniaglobalacademy.com"}/home`,
          },
          senderEmail: Deno.env.get("BREVO_AUTH_SENDER_EMAIL") || Deno.env.get("BREVO_SENDER_EMAIL") || "contact@omniaglobalacademy.com",
          userId: String(user.id),
          sb: supabase,
        });

        const sessionToken = generateOpaqueToken();
        const { error: sessionError } = await supabase.from("user_sessions").insert({
          user_id: user.id,
          session_token: sessionToken,
          ip_address: clientIP,
          user_agent: req.headers.get("user-agent") ?? "",
          expires_at: new Date(Date.now() + 30 * 24 * 3_600_000).toISOString(),
        });
        if (sessionError) throw sessionError;
        await supabase.from("users").update({ last_login_at: now }).eq("id", user.id);

        return json({ success: true, session_token: sessionToken, user: { ...user, status: "actif", roles: userRoles } });
      }

      const { error: pendingStatusError } = await supabase.from("users")
        .update({ status: "en_attente_validation", email_status: "valide", updated_at: now })
        .eq("id", user.id);
      if (pendingStatusError) throw pendingStatusError;

      const roleDisplay = userRoles.includes("professeur")
        ? "Professeur"
        : userRoles.includes("recruteur_independant")
        ? "Recruteur indépendant"
        : "Structure";

      if (userRoles.includes("recruteur_independant")) {
        const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "super_admin");
        for (const admin of admins || []) {
          await supabase.from("notification_queue").insert({
            notification_type: "recruiter_application_submitted",
            user_id: admin.user_id,
            payload: { recruiter_user_id: user.id },
          }).catch(() => {});
          await supabase.from("talent_notifications").insert({
            user_id: admin.user_id,
            notification_type: "recruiter_application_submitted",
            title: "Nouvelle demande recruteur indépendant",
            message: "Une adresse e-mail confirmée attend maintenant votre validation.",
            action_url: "/admin/talent",
            payload: { recruiter_user_id: user.id },
          }).catch(() => {});
        }
      }

      await sendOmniaEmail({
        to: { email: user.email, name: user.full_name || undefined },
        templateKey: "account_pending_validation",
        params: {
          PRENOM: String(user.full_name || "").split(" ")[0],
          ROLE_NAME: roleDisplay,
          MESSAGE_SPECIFIQUE: "Votre adresse e-mail est confirmée. Votre dossier est maintenant en attente de décision de l’Administration Omnia.",
          DASHBOARD_URL: `${Deno.env.get("APP_URL") || "https://omniaglobalacademy.com"}/connexion`,
        },
        senderEmail: Deno.env.get("BREVO_AUTH_SENDER_EMAIL") || Deno.env.get("BREVO_SENDER_EMAIL") || "contact@omniaglobalacademy.com",
        userId: String(user.id),
        sb: supabase,
      });

      return json({ success: true, needs_validation: true, user: { ...user, status: "en_attente_validation", email_status: "valide", roles: userRoles } });
    }

    if (purpose === "connexion") {
      if (user.status !== "actif") return json({ success: false, message: "Compte inactif ou en attente de validation" }, 403);
      const sessionToken = generateOpaqueToken();
      const { error: sessionError } = await supabase.from("user_sessions").insert({
        user_id: user.id,
        session_token: sessionToken,
        ip_address: clientIP,
        user_agent: req.headers.get("user-agent") ?? "",
        expires_at: new Date(Date.now() + 30 * 24 * 3_600_000).toISOString(),
      });
      if (sessionError) throw sessionError;
      await supabase.from("users").update({ last_login_at: now }).eq("id", user.id);
      return json({ success: true, session_token: sessionToken, user: { ...user, roles: userRoles } });
    }

    const rawResetToken = generateOpaqueToken();
    const tokenHash = await sha256Hex(rawResetToken);
    await supabase.from("password_reset_tokens").update({ used: true }).eq("user_id", user.id).eq("used", false);
    const { error: tokenError } = await supabase.from("password_reset_tokens").insert({
      user_id: user.id,
      reset_token: null,
      token_hash: tokenHash,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });
    if (tokenError) throw tokenError;
    return json({ success: true, reset_token: rawResetToken });
  } catch (error) {
    console.error("auth-verify-otp error:", error);
    return json({ success: false, message: "Une erreur est survenue" }, 500);
  }
});
