import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { hashSync } from "npm:bcryptjs@2.4.3";
const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "https://omniaglobalacademy.com",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-demo-heartbeat-token",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
async function sendSMS(phone: string, otp: string, email?: string, fullName?: string): Promise<void> {
  const brevoKey = Deno.env.get("BREVO_API_KEY") ?? "";
  if (!brevoKey) return;

  const message = `Omnia Academy : Votre code de vérification est ${otp}. Valable 5 minutes. Ne le partagez jamais.`;

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
  }).catch(() => null);

  if ((!res || !res.ok) && email) {
    const prenom = fullName?.split(" ")[0] || "";
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
        subject: "Votre code de vérification — Omnia Academy",
        htmlContent: `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:32px">
          <div style="background:#002050;padding:24px;text-align:center;border-radius:8px 8px 0 0">
            <h2 style="color:#BF8813;margin:0">OMNIA GLOBAL ACADEMY</h2>
          </div>
          <div style="background:#fff;padding:32px;border:1px solid #E4E7EC;text-align:center">
            <p style="color:#374151">Bonjour ${prenom},</p>
            <p style="color:#374151">SMS indisponible. Voici votre code de vérification :</p>
            <div style="font-size:36px;font-weight:900;color:#002050;
              letter-spacing:8px;padding:16px;background:#F8F9FA;
              border-radius:8px;margin:16px 0">${otp}</div>
            <p style="color:#6B7280;font-size:13px">Valable 5 minutes. Ne le partagez jamais.</p>
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
}

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
    const { role, email, phone_number, password, birth_date, country_code = "ML" } = body;

    if (!["apprenant", "professeur", "organizer", "etablissement", "recruteur_independant"].includes(role)) {
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
    if (!password || password.length < 8) {
      return new Response(JSON.stringify({ success: false, message: "Mot de passe trop court (minimum 8 caractères)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (role !== "recruteur_independant" && !birth_date) {
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
        country: country_code || "ML",
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
      roleForDB = "apprenant"; // organizer role is granted only after Super Admin approval
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
      if (!body.school_name?.trim()) {
        return new Response(JSON.stringify({ success: false, message: "Nom de l'établissement requis" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!body.director_name?.trim()) {
        return new Response(JSON.stringify({ success: false, message: "Nom du directeur requis" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      fullName = body.director_name.trim();
      roleForDB = "etablissement_directeur";
      profileData = {
        school_name: body.school_name.trim(),
        registration_number: body.registration_number?.trim() || null,
        director_name: body.director_name.trim(),
        logo_url: null,
        signature_url: null,
      };
    }

    const sanitizedEmail = email.trim().toLowerCase();
    const sanitizedPhone = phone_number.trim();
    const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || null;

    // Extract referral code from body or URL
    const refCode = body.ref_code?.trim() || null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

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

    // Rate limit only for OTP-based roles
    if (role !== "etablissement") {
      const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString();
      const { count: recentSms } = await supabase
        .from("sms_rate_limits")
        .select("*", { count: "exact", head: true })
        .eq("phone_number", sanitizedPhone)
        .gte("sent_at", oneHourAgo);
      if ((recentSms ?? 0) >= 3) {
        return new Response(JSON.stringify({ success: false, message: "Trop de SMS envoyés. Réessayez dans une heure." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const passwordHash = hashSync(password, 12);

    const { data: newUser, error: userError } = await supabase
      .from("users")
      .insert({
        email: sanitizedEmail,
        phone_number: sanitizedPhone,
        password_hash: passwordHash,
        full_name: fullName,
        birth_date: birth_date || null,
        country_code: country_code || "ML",
        status: "en_attente_validation",
        allow_email: body.allow_email ?? true,
        allow_sms: body.allow_sms ?? true,
        allow_push: body.allow_push ?? false,
        subscribe_newsletter: body.subscribe_newsletter ?? false,
      })
      .select("id")
      .single();

    if (userError) throw userError;
    const userId = newUser.id;

    // Handle referral code
    if (refCode) {
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

    const rolesToInsert: { user_id: string; role: string }[] = [{ user_id: userId, role: roleForDB }];
    const { error: rolesError } = await supabase.from("user_roles").insert(rolesToInsert);
    if (rolesError) throw rolesError;

    if (profileData) {
      const tableName =
        role === "professeur" ? "professeur_profiles" :
        role === "organizer" ? "live_organizer_applications" :
        role === "recruteur_independant" ? "talent_recruiter_profiles" :
        "etablissement_profiles";
      const { error: profileError } = await supabase.from(tableName).insert({ user_id: userId, ...profileData });
      if (profileError) throw profileError;
      if (role === "recruteur_independant") {
        const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "super_admin");
        for (const admin of admins || []) {
          await supabase.from("notification_queue").insert({
            notification_type: "recruiter_application_submitted",
            user_id: admin.user_id,
            payload: { recruiter_user_id: userId },
          }).catch(() => {});
          await supabase.from("talent_notifications").insert({
            user_id: admin.user_id,
            notification_type: "recruiter_application_submitted",
            title: "Nouvelle demande recruteur indépendant",
            message: "Un compte recruteur indépendant attend votre validation.",
            action_url: "/admin/talent",
            payload: { recruiter_user_id: userId },
          }).catch(() => {});
        }
      }
    }

    // Upload files to storage
    if (role === "professeur" && body.cv_diploma_base64) {
      const cvPath = await uploadFile(supabase, "cv-documents", `${userId}/cv_${Date.now()}.pdf`, body.cv_diploma_base64, body.cv_diploma_mime || "application/pdf");
      if (cvPath) await supabase.from("professeur_profiles").update({ cv_diploma_url: cvPath }).eq("user_id", userId);
    }
    // Logo et signature établissement retirés de l'inscription
    // Ils seront ajoutés dans le menu Certificats de l'établissement

    // Etablissement: no OTP — return pending directly
    if (role === "etablissement") {
      if (body.subscribe_newsletter === true) {
        const brevoApiKey = Deno.env.get("BREVO_API_KEY");
        const brevoListId = parseInt(Deno.env.get("BREVO_NEWSLETTER_LIST_ID") || "7");
        if (brevoApiKey) {
          try {
            await fetch("https://api.brevo.com/v3/contacts", {
              method: "POST",
              headers: { accept: "application/json", "content-type": "application/json", "api-key": brevoApiKey },
              body: JSON.stringify({ email: sanitizedEmail, attributes: { FIRSTNAME: fullName }, listIds: [brevoListId], updateEnabled: true }),
            });
          } catch (e) { console.error("Brevo newsletter error:", e); }
        }
      }
      return new Response(JSON.stringify({ success: true, user_id: userId, next_step: "pending_validation" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rôles avec vérification téléphonique : envoi OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const { error: otpError } = await supabase.from("otp_codes").insert({
      phone_number: sanitizedPhone, code: otp, purpose: "inscription",
      expires_at: expiresAt, ip_address: ipAddress,
    });
    if (otpError) throw otpError;

    await sendSMS(sanitizedPhone, otp, sanitizedEmail, fullName);
    await supabase.from("sms_rate_limits").insert({ phone_number: sanitizedPhone, ip_address: ipAddress });

    if (body.subscribe_newsletter === true) {
      const brevoApiKey = Deno.env.get("BREVO_API_KEY");
      const brevoListId = parseInt(Deno.env.get("BREVO_NEWSLETTER_LIST_ID") || "7");
      if (brevoApiKey) {
        try {
          await fetch("https://api.brevo.com/v3/contacts", {
            method: "POST",
            headers: { accept: "application/json", "content-type": "application/json", "api-key": brevoApiKey },
            body: JSON.stringify({ email: sanitizedEmail, attributes: { FIRSTNAME: fullName }, listIds: [brevoListId], updateEnabled: true }),
          });
        } catch (e) { console.error("Brevo newsletter error:", e); }
      }
    }

    return new Response(JSON.stringify({ success: true, user_id: userId, next_step: "verify_otp" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("auth-register error:", error);
    return new Response(JSON.stringify({ success: false, message: "Une erreur est survenue" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
