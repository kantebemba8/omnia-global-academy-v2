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

async function sendBrevoWelcome(
  apiKey: string,
  email: string,
  firstName: string,
  roleName: string,
  specificMessage: string,
): Promise<void> {
  const templateId = parseInt(Deno.env.get("BREVO_WELCOME_TEMPLATE_ID") || "4");
  const appUrl = Deno.env.get("APP_URL") || "https://omniaglobalacademy.com";

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      to: [{ email, name: firstName }],
      templateId,
      params: {
        PRENOM: firstName,
        MESSAGE_SPECIFIQUE: specificMessage,
        ROLE_NAME: roleName,
        EMAIL: email,
        DASHBOARD_URL: `${appUrl}/dashboard`,
      },
    }),
  });

  if (!response.ok) {
    console.error("Brevo welcome email error:", await response.text());
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
    const otpCode = String(body.otp_code ?? "").trim();
    const purpose = typeof body.purpose === "string" ? body.purpose : "";

    if (!phoneNumber || !/^\d{6}$/.test(otpCode) || !purpose) {
      return json({ success: false, message: "Champs requis manquants" }, 400);
    }
    if (!["inscription", "connexion", "reset_password"].includes(purpose)) {
      return json({ success: false, message: "Purpose invalide" }, 400);
    }

    const clientIP = getClientIP(req);
    const phoneHash = await sha256Hex(phoneNumber);
    const codeHash = await sha256Hex(otpCode);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const ipLimit = await consumeRateLimit(
      supabase,
      `auth-verify-otp:ip:${clientIP}`,
      20,
      15 * 60,
    );
    const phoneLimit = await consumeRateLimit(
      supabase,
      `auth-verify-otp:phone:${purpose}:${phoneHash}`,
      10,
      15 * 60,
    );
    if (!ipLimit.allowed || !phoneLimit.allowed) {
      return json({
        success: false,
        message: "Trop de tentatives. Réessayez plus tard.",
        retry_after: Math.max(ipLimit.retryAfter, phoneLimit.retryAfter),
      }, 429);
    }

    const { data: verificationData, error: verificationError } = await supabase.rpc(
      "verify_omnia_otp",
      {
        p_phone_number: phoneNumber,
        p_purpose: purpose,
        p_code: otpCode,
        p_code_hash: codeHash,
        p_max_attempts: 5,
      },
    );
    if (verificationError) throw verificationError;

    const verification = Array.isArray(verificationData)
      ? verificationData[0]
      : verificationData;
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
      .select("id, email, full_name, phone_number, status, country_code, avatar_url, force_password_change")
      .eq("phone_number", phoneNumber)
      .maybeSingle();
    if (userError) throw userError;

    if (!user) {
      return json({ success: false, message: "Utilisateur introuvable" }, 404);
    }

    if (purpose === "inscription") {
      try {
        await acceptPendingInvitationsForUser(supabase, String(user.id), String(user.email || ""));
      } catch (error) {
        console.error("access invitation finalization failed", error);
        throw error;
      }
    }

    const { data: rolesData, error: rolesError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    if (rolesError) throw rolesError;

    const userRoles = (rolesData ?? []).map((row: { role: string }) => row.role);
    const requiresManualValidation = userRoles.some((role: string) =>
      ["professeur", "responsable_structure", "recruteur_independant"].includes(role)
    );

    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    const now = new Date().toISOString();

    if (purpose === "inscription") {
      if (!requiresManualValidation) {
        const { error: activationError } = await supabase
          .from("users")
          .update({ status: "actif", updated_at: now })
          .eq("id", user.id);
        if (activationError) throw activationError;

        if (brevoApiKey) {
          try {
            await sendBrevoWelcome(
              brevoApiKey,
              user.email,
              user.full_name,
              userRoles.includes("moderateur") ? "Équipe de modération" : userRoles.includes("recruteur_structure") ? "Recrutement Structure" : userRoles.includes("gestionnaire_structure") ? "Équipe Structure" : "Apprenant",
              "Votre compte est actif. Vous pouvez maintenant accéder aux espaces qui vous ont été attribués.",
            );
          } catch (error) {
            console.error("Brevo welcome error:", error);
          }
        }

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

        return json({
          success: true,
          session_token: sessionToken,
          user: {
            ...user,
            status: "actif",
            roles: userRoles,
          },
        });
      }

      const roleDisplay = userRoles.includes("professeur")
        ? "Professeur"
        : userRoles.includes("recruteur_independant")
        ? "Recruteur indépendant"
        : "Structure";

      if (brevoApiKey) {
        try {
          await sendBrevoWelcome(
            brevoApiKey,
            user.email,
            user.full_name,
            roleDisplay,
            "Votre dossier est en cours de validation par notre équipe. Vous serez notifié dès que la vérification sera terminée.",
          );
        } catch (error) {
          console.error("Brevo welcome error:", error);
        }
      }

      return json({
        success: true,
        needs_validation: true,
        user: { ...user, roles: userRoles },
      });
    }

    if (purpose === "connexion") {
      if (user.status !== "actif") {
        return json({
          success: false,
          message: "Compte inactif ou en attente de validation",
        }, 403);
      }

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

      return json({
        success: true,
        session_token: sessionToken,
        user: { ...user, roles: userRoles },
      });
    }

    const rawResetToken = generateOpaqueToken();
    const tokenHash = await sha256Hex(rawResetToken);

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
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      });
    if (tokenError) throw tokenError;

    return json({ success: true, reset_token: rawResetToken });
  } catch (error) {
    console.error("auth-verify-otp error:", error);
    return json({ success: false, message: "Une erreur est survenue" }, 500);
  }
});
