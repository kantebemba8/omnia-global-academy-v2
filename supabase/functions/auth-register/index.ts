import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import bcrypt from "npm:bcryptjs@2.4.3";
import {
  consumeRateLimit,
  createHashedEmailOtp,
  generateOpaqueToken,
  getClientIP,
  makeCorsHeaders,
  sha256Hex,
} from "../_shared/auth-security.ts";
import { acceptAccessInvitation, inspectAccessInvitation } from "../_shared/access-invitations.ts";
import { sendOmniaEmail } from "../_shared/brevo-mail.ts";
import { setNewsletterConsent } from "../_shared/newsletter.ts";
function base64ToBytes(b64: string): Uint8Array {
  const binStr = atob(b64);
  const bytes = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
  return bytes;
}

async function uploadFile(
  supabase: ReturnType<typeof createClient>,
  bucket: string,
  path: string,
  b64: string,
  mime: string
): Promise<string | null> {
  try {
    const bytes = base64ToBytes(b64);
    const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
      contentType: mime,
      upsert: true,
    });
    if (error) { console.error(`Storage upload error (${bucket}/${path}):`, error); return null; }
    return path;
  } catch (e) {
    console.error("Upload failed:", e);
    return null;
  }
}


Deno.serve(async (req: Request) => {
  const corsHeaders = makeCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, message: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const action = String(body.action || "");

    if (action === "inspect_access_invitation") {
      const invitation = await inspectAccessInvitation(supabase, String(body.invitation_token || ""));
      if (!invitation) return new Response(JSON.stringify({ success: false, error: "INVITATION_NOT_FOUND", message: "Invitation introuvable." }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ success: true, invitation }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "accept_access_invitation") {
      const sessionToken = (req.headers.get("x-omnia-session-token") || String(body.session_token || "")).replace(/^Bearer\s+/i, "").trim();
      if (!sessionToken) return new Response(JSON.stringify({ success: false, error: "AUTH_REQUIRED", message: "Connectez-vous pour accepter cette invitation." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: session } = await supabase.from("user_sessions").select("user_id").eq("session_token", sessionToken).gt("expires_at", new Date().toISOString()).maybeSingle();
      if (!session) return new Response(JSON.stringify({ success: false, error: "SESSION_INVALID", message: "Votre session a expiré." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: account } = await supabase.from("users").select("id,email").eq("id", session.user_id).maybeSingle();
      if (!account) return new Response(JSON.stringify({ success: false, error: "ACCOUNT_NOT_FOUND" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      try {
        const invitation = await acceptAccessInvitation(supabase, String(body.invitation_token || ""), String(account.id), String(account.email || ""));
        const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", account.id);
        return new Response(JSON.stringify({ success: true, invitation_type: invitation.invitation_type, roles: (roles || []).map((row: { role: string }) => row.role) }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (error) {
        const code = error instanceof Error ? error.message : String(error);
        const status = code.includes("MISMATCH") || code === "PROTECTED_ACCOUNT" ? 403 : code.includes("EXPIRED") ? 410 : 400;
        return new Response(JSON.stringify({ success: false, error: code, message: "Cette invitation ne peut pas être acceptée avec ce compte." }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const { role, email, phone_number, password, birth_date, country_code = "" } = body;
    let accessInvitation: Awaited<ReturnType<typeof inspectAccessInvitation>> = null;
    const accessInvitationToken = String(body.access_invitation_token || "").trim();
    if (accessInvitationToken) {
      accessInvitation = await inspectAccessInvitation(supabase, accessInvitationToken);
      if (!accessInvitation || accessInvitation.status !== "pending") {
        return new Response(JSON.stringify({ success: false, message: "Cette invitation est invalide ou a expiré." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (String(accessInvitation.email || "").toLowerCase() !== String(email || "").trim().toLowerCase()) {
        return new Response(JSON.stringify({ success: false, message: "Utilisez l’adresse e-mail qui a reçu l’invitation." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (role !== "apprenant") {
        return new Response(JSON.stringify({ success: false, message: "Créez d’abord un compte personnel avant d’accepter cette invitation professionnelle." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (!["apprenant", "professeur", "organizer", "responsable_structure", "etablissement", "recruteur_independant"].includes(role)) {
      return new Response(JSON.stringify({ success: false, message: "Rôle invalide" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email.trim())) {
      return new Response(JSON.stringify({ success: false, message: "Email invalide" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!phone_number || phone_number.trim().length < 8) {
      return new Response(JSON.stringify({ success: false, message: "Numéro de téléphone invalide" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!country_code || !/^[A-Za-z]{2}$/.test(String(country_code))) {
      return new Response(JSON.stringify({ success: false, message: "Pays requis" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!password || password.length < 8) {
      return new Response(JSON.stringify({ success: false, message: "Mot de passe trop court (minimum 8 caractères)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!["recruteur_independant", "responsable_structure", "etablissement"].includes(role) && !birth_date) {
      return new Response(JSON.stringify({ success: false, message: "Date de naissance requise" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let fullName: string;
    let roleForDB: string;
    let profileData: Record<string, unknown> | null = null;

    if (role === "apprenant") {
      if (!body.full_name?.trim()) {
        return new Response(JSON.stringify({ success: false, message: "Nom complet requis" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      fullName = body.full_name.trim();
      roleForDB = "apprenant";
    } else if (role === "professeur") {
      if (!body.full_name?.trim()) {
        return new Response(JSON.stringify({ success: false, message: "Nom complet requis" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!body.expertise_domain?.trim()) {
        return new Response(JSON.stringify({ success: false, message: "Domaine d'expertise requis" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      fullName = body.full_name.trim();
      roleForDB = "professeur";
      profileData = { bio: body.bio?.trim() || null, expertise_domain: body.expertise_domain.trim(), cv_diploma_url: null };
    } else if (role === "recruteur_independant") {
      if (!body.full_name?.trim() || !body.company_name?.trim() || !body.job_title?.trim()) {
        return new Response(JSON.stringify({ success: false, message: "Nom, entreprise et fonction sont requis" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const professionalEmail = String(body.professional_email || email || "").trim().toLowerCase();
      if (professionalEmail !== String(email || "").trim().toLowerCase()) {
        return new Response(JSON.stringify({ success: false, message: "L’email professionnel doit correspondre à l’email du compte" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      fullName = body.full_name.trim();
      roleForDB = "recruteur_independant";
      profileData = {
        recruiter_type: "independent",
        organization_id: null,
        company_name: body.company_name.trim(),
        job_title: body.job_title.trim(),
        professional_email: professionalEmail,
        phone: phone_number.trim(),
        country: String(country_code).toUpperCase(),
        linkedin_url: body.linkedin_url?.trim() || null,
        website_url: body.website_url?.trim() || null,
        status: "pending",
        visibility: "private",
        notifications_enabled: true,
      };
    } else if (role === "organizer") {
      if (!body.full_name?.trim() || !body.display_name?.trim() || !body.experience_summary?.trim()) {
        return new Response(JSON.stringify({ success: false, message: "Nom, nom public et expérience sont requis" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      fullName = body.full_name.trim();
      roleForDB = "apprenant"; // organizer role is granted only after Administration Omnia approval
      profileData = {
        display_name: body.display_name.trim(),
        organizer_type: body.organizer_type || "independent",
        professional_title: body.professional_title?.trim() || null,
        organization_name: body.organization_name?.trim() || null,
        website_url: body.website_url?.trim() || null,
        bio: body.bio?.trim() || null,
        experience_summary: body.experience_summary.trim(),
        event_topics: Array.isArray(body.event_topics) ? body.event_topics : [],
      };
    } else {
      // `etablissement` reste seulement un alias de compatibilité vers le rôle Structure.
      // Aucun rôle, profil ou Dashboard Établissement n'est créé.
      const responsibleName = String(body.full_name || body.responsible_name || body.director_name || "").trim();
      if (!responsibleName) {
        return new Response(JSON.stringify({ success: false, message: "Nom du responsable de la Structure requis" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      fullName = responsibleName;
      roleForDB = "responsable_structure";
      profileData = null;
    }

    const sanitizedEmail = email.trim().toLowerCase();
    const sanitizedPhone = phone_number.trim();
    const ipAddress = getClientIP(req);

    // Extract referral code from body or URL
    const refCode = String(body.referral_code || body.ref_code || "").trim() || null;

    const emailHash = await sha256Hex(sanitizedEmail);
    const phoneHash = await sha256Hex(sanitizedPhone);
    const ipRate = await consumeRateLimit(
      supabase,
      `auth-register:ip:${ipAddress}`,
      10,
      60 * 60,
    );
    const emailRate = await consumeRateLimit(
      supabase,
      `auth-register:email:${emailHash}`,
      3,
      60 * 60,
    );
    const phoneRate = await consumeRateLimit(
      supabase,
      `auth-register:phone:${phoneHash}`,
      3,
      60 * 60,
    );

    if (!ipRate.allowed || !emailRate.allowed || !phoneRate.allowed) {
      return new Response(JSON.stringify({
        success: false,
        message: "Trop de tentatives d'inscription. Réessayez plus tard.",
        retry_after: Math.max(ipRate.retryAfter, emailRate.retryAfter, phoneRate.retryAfter),
      }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existingEmail } = await supabase.from("users").select("id").eq("email", sanitizedEmail).maybeSingle();
    if (existingEmail) {
      return new Response(JSON.stringify({ success: false, message: "Cet email est déjà utilisé" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existingPhone } = await supabase.from("users").select("id").eq("phone_number", sanitizedPhone).maybeSingle();
    if (existingPhone) {
      return new Response(JSON.stringify({ success: false, message: "Ce numéro est déjà utilisé" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const { data: newUser, error: userError } = await supabase
      .from("users")
      .insert({
        email: sanitizedEmail,
        phone_number: sanitizedPhone,
        password_hash: passwordHash,
        full_name: fullName,
        birth_date: birth_date || null,
        country_code: String(country_code).toUpperCase(),
        status: "verification_email",
        email_status: "a_verifier",
        allow_email: body.allow_email ?? true,
        allow_sms: body.allow_sms ?? false,
        allow_push: body.allow_push ?? false,
        subscribe_newsletter: body.subscribe_newsletter ?? false,
      })
      .select("id")
      .single();

    if (userError) throw userError;
    const userId = newUser.id;

    if (accessInvitation) {
      const { error: invitationBindError } = await supabase.from("platform_access_invitations")
        .update({ target_user_id: userId, updated_at: new Date().toISOString() })
        .eq("id", accessInvitation.id).eq("status", "pending").is("target_user_id", null);
      if (invitationBindError) throw invitationBindError;
    }

    // Le parrainage est réservé aux apprenants et reste inactif tant que
    // l’Administration Omnia ne l'a pas explicitement activé dans les paramètres.
    if (role === "apprenant" && refCode && refCode !== userId) {
      const { data: referralSetting } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "referral_enabled")
        .maybeSingle();

      const referralEnabled = referralSetting?.value === true || referralSetting?.value === "true";

      if (referralEnabled) {
        const { data: referrer } = await supabase.from("users").select("id").eq("id", refCode).maybeSingle();
        if (referrer) {
          await supabase.from("referrals").insert({
            referrer_id: refCode,
            referred_id: userId,
            status: "pending",
            reward_referrer_xof: 0,
            reward_referred_xof: 0,
          }).then(() => {/* ignore duplicate errors */});
        }
      }
    }

    const rolesToInsert: { user_id: string; role: string }[] = [{ user_id: userId, role: roleForDB }];
    const { error: rolesError } = await supabase.from("user_roles").insert(rolesToInsert);
    if (rolesError) throw rolesError;

    if (profileData) {
      const tableName =
        role === "professeur" ? "professeur_profiles" :
        role === "organizer" ? "live_organizer_applications" :
        "talent_recruiter_profiles";
      const { error: profileError } = await supabase.from(tableName).insert({ user_id: userId, ...profileData });
      if (profileError) throw profileError;
      // Une demande professionnelle n'entre dans la file d'examen qu'après
      // confirmation de l'adresse e-mail dans auth-verify-otp.
    }

    // Upload files to storage
    if (role === "professeur" && body.cv_diploma_base64) {
      const cvPath = await uploadFile(supabase, "cv-documents", `${userId}/cv_${Date.now()}.pdf`, body.cv_diploma_base64, body.cv_diploma_mime || "application/pdf");
      if (cvPath) await supabase.from("professeur_profiles").update({ cv_diploma_url: cvPath }).eq("user_id", userId);
    }
    // Logo et signature établissement retirés de l'inscription
    // Ils seront ajoutés dans le menu Certificats de l'établissement

    // Toutes les créations de compte confirment désormais l’adresse e-mail.
    // Le téléphone reste une donnée de compte ; aucun OTP d’inscription n’est envoyé par SMS.
    await supabase
      .from("otp_codes")
      .update({ used: true })
      .eq("email", sanitizedEmail)
      .eq("purpose", "inscription")
      .eq("used", false);

    const otp = await createHashedEmailOtp(supabase, {
      email: sanitizedEmail,
      purpose: "inscription",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      ipAddress,
    });

    const emailSent = await sendOmniaEmail({
      to: { email: sanitizedEmail, name: fullName },
      templateKey: "auth_verification_otp",
      params: { PRENOM: fullName.split(" ")[0] || fullName, OTP: otp, EXPIRES_MINUTES: 5 },
      senderEmail: Deno.env.get("BREVO_AUTH_SENDER_EMAIL") || Deno.env.get("BREVO_SENDER_EMAIL") || "contact@omniaglobalacademy.com",
      userId,
      sb: supabase,
    });
    if (!emailSent) {
      console.error("Registration OTP email delivery failed for user", userId);
    }

    if (body.subscribe_newsletter === true) {
      try {
        await setNewsletterConsent(supabase, {
          userId, email: sanitizedEmail, active: true, source: "registration", locale: "fr",
          firstName: fullName.split(" ")[0] || fullName, userAgent: req.headers.get("user-agent") || null,
        });
      } catch (error) {
        console.error("Newsletter registration opt-in sync failed", error);
      }
    }

    // Les Structures ont besoin d’un jeton court pour déposer leur dossier avant
    // la validation manuelle ; l’adresse e-mail devra néanmoins être confirmée.
    let registrationSessionToken: string | undefined;
    if (["responsable_structure", "etablissement"].includes(role)) {
      registrationSessionToken = generateOpaqueToken();
      await supabase.from("user_sessions").insert({
        user_id: userId,
        session_token: registrationSessionToken,
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });
    }

    return new Response(JSON.stringify({
      success: true,
      user_id: userId,
      email: sanitizedEmail,
      session_token: registrationSessionToken,
      next_step: "verify_email_otp",
      delivery: "email",
      email_sent: emailSent,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("auth-register error:", error);
    return new Response(JSON.stringify({ success: false, message: "Une erreur est survenue" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
