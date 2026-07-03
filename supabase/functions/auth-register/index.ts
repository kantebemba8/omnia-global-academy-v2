import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { hashSync } from "npm:bcryptjs@2.4.3";
import { corsHeaders } from "../_shared/cors.ts";

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendSMS(phone: string, otp: string): Promise<void> {
  const username = Deno.env.get("AFRICASTALKING_USERNAME") || "sandbox";
  const apiUrl = username === "sandbox"
    ? "https://api.sandbox.africastalking.com/version1/messaging"
    : "https://api.africastalking.com/version1/messaging";
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      apiKey: Deno.env.get("AFRICASTALKING_API_KEY") ?? "",
    },
    body: new URLSearchParams({
      username,
      to: phone,
      message: `Omnia Academy : Votre code de vérification est ${otp}. Valable 5 minutes. Ne le partagez jamais.`,
      from: Deno.env.get("AFRICASTALKING_SENDER_ID") || "OmniaAcad",
    }),
  });
  if (!res.ok) console.error("Africa's Talking error:", await res.text());
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

    if (!["apprenant", "professeur", "etablissement"].includes(role)) {
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
    if (!birth_date) {
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
        birth_date,
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
    if (roleForDB !== "apprenant") rolesToInsert.push({ user_id: userId, role: "apprenant" });
    const { error: rolesError } = await supabase.from("user_roles").insert(rolesToInsert);
    if (rolesError) throw rolesError;

    if (profileData) {
      const tableName = role === "professeur" ? "professeur_profiles" : "etablissement_profiles";
      const { error: profileError } = await supabase.from(tableName).insert({ user_id: userId, ...profileData });
      if (profileError) throw profileError;
    }

    // Upload files to storage
    if (role === "professeur" && body.cv_diploma_base64) {
      const cvPath = await uploadFile(supabase, "cv-documents", `${userId}/cv_${Date.now()}.pdf`, body.cv_diploma_base64, body.cv_diploma_mime || "application/pdf");
      if (cvPath) await supabase.from("professeur_profiles").update({ cv_diploma_url: cvPath }).eq("user_id", userId);
    }

    if (role === "etablissement") {
      const updates: Record<string, string> = {};
      if (body.logo_base64) {
        const ext = body.logo_mime === "image/png" ? "png" : "jpg";
        const logoPath = await uploadFile(supabase, "school-documents", `${userId}/logo_${Date.now()}.${ext}`, body.logo_base64, body.logo_mime || "image/png");
        if (logoPath) updates.logo_url = logoPath;
      }
      if (body.signature_base64) {
        const sigPath = await uploadFile(supabase, "school-documents", `${userId}/signature_${Date.now()}.png`, body.signature_base64, "image/png");
        if (sigPath) updates.signature_url = sigPath;
      }
      if (Object.keys(updates).length > 0) {
        await supabase.from("etablissement_profiles").update(updates).eq("user_id", userId);
      }
    }

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

    // Apprenant / Professeur: send OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const { error: otpError } = await supabase.from("otp_codes").insert({
      phone_number: sanitizedPhone, code: otp, purpose: "inscription",
      expires_at: expiresAt, ip_address: ipAddress,
    });
    if (otpError) throw otpError;

    await sendSMS(sanitizedPhone, otp);
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
