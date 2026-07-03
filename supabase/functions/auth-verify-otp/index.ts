import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "https://omniaglobalacademy.com",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function sendBrevoWelcome(
  apiKey: string,
  email: string,
  prenom: string,
  roleName: string,
  messageSpecifique: string
): Promise<void> {
  const templateId = parseInt(Deno.env.get("BREVO_WELCOME_TEMPLATE_ID") || "4");
  const appUrl = Deno.env.get("APP_URL") || "https://omniaglobalacademy.com";

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      to: [{ email, name: prenom }],
      templateId,
      params: {
        PRENOM: prenom,
        MESSAGE_SPECIFIQUE: messageSpecifique,
        ROLE_NAME: roleName,
        EMAIL: email,
        DASHBOARD_URL: `${appUrl}/dashboard`,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Brevo welcome email error:", text);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, message: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { phone_number, otp_code, purpose } = await req.json();

    if (!phone_number || !otp_code || !purpose) {
      return new Response(JSON.stringify({ success: false, message: "Champs requis manquants" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["inscription", "connexion", "reset_password"].includes(purpose)) {
      return new Response(JSON.stringify({ success: false, message: "Purpose invalide" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch latest unused OTP for this phone + purpose
    const { data: otpRecord } = await supabase
      .from("otp_codes")
      .select("*")
      .eq("phone_number", phone_number.trim())
      .eq("purpose", purpose)
      .eq("used", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otpRecord) {
      return new Response(JSON.stringify({ success: false, message: "Aucun code valide trouvé" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(otpRecord.expires_at) < new Date()) {
      return new Response(JSON.stringify({ success: false, message: "Code expiré" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (otpRecord.code !== otp_code.toString().trim()) {
      return new Response(JSON.stringify({ success: false, message: "Code incorrect" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark OTP as used
    await supabase.from("otp_codes").update({ used: true }).eq("id", otpRecord.id);

    // Find user
    const { data: user } = await supabase
      .from("users")
      .select("id, email, full_name, phone_number, status, country_code, avatar_url")
      .eq("phone_number", phone_number.trim())
      .maybeSingle();

    if (!user) {
      return new Response(JSON.stringify({ success: false, message: "Utilisateur introuvable" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch roles
    const { data: rolesData } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id);
    const userRoles = (rolesData || []).map((r: { role: string }) => r.role);
    const isProfOrEtab = userRoles.some((r: string) =>
      ["professeur", "etablissement_directeur", "etablissement_enseignant"].includes(r)
    );

    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    const now = new Date().toISOString();

    // ── INSCRIPTION ────────────────────────────────────────────────
    if (purpose === "inscription") {
      if (!isProfOrEtab) {
        // Apprenant → activate
        await supabase.from("users").update({ status: "actif", updated_at: now }).eq("id", user.id);

        if (brevoApiKey) {
          try {
            await sendBrevoWelcome(
              brevoApiKey, user.email, user.full_name, "Apprenant",
              "Votre compte est actif. Explorez nos formations !"
            );
          } catch (e) { console.error("Brevo error:", e); }
        }

        const sessionToken = crypto.randomUUID();
        await supabase.from("user_sessions").insert({
          user_id: user.id,
          session_token: sessionToken,
          expires_at: new Date(Date.now() + 30 * 24 * 3_600_000).toISOString(),
        });
        await supabase.from("users").update({ last_login_at: now }).eq("id", user.id);

        return new Response(JSON.stringify({
          success: true,
          session_token: sessionToken,
          user: { ...user, status: "actif", roles: userRoles },
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Professeur / Établissement → pending validation
      const roleDisplay = userRoles.includes("professeur") ? "Professeur" : "Établissement";
      if (brevoApiKey) {
        try {
          await sendBrevoWelcome(
            brevoApiKey, user.email, user.full_name, roleDisplay,
            "Votre dossier est en cours de validation par notre équipe. Vous serez notifié dès que la vérification sera terminée."
          );
        } catch (e) { console.error("Brevo error:", e); }
      }

      return new Response(JSON.stringify({
        success: true,
        needs_validation: true,
        user: { ...user, roles: userRoles },
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── CONNEXION ──────────────────────────────────────────────────
    if (purpose === "connexion") {
      if (user.status !== "actif") {
        return new Response(JSON.stringify({ success: false, message: "Compte inactif ou en attente de validation" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const sessionToken = crypto.randomUUID();
      await supabase.from("user_sessions").insert({
        user_id: user.id,
        session_token: sessionToken,
        expires_at: new Date(Date.now() + 30 * 24 * 3_600_000).toISOString(),
      });
      await supabase.from("users").update({ last_login_at: now }).eq("id", user.id);

      return new Response(JSON.stringify({
        success: true,
        session_token: sessionToken,
        user: { ...user, roles: userRoles },
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── RESET_PASSWORD ─────────────────────────────────────────────
    const resetToken = crypto.randomUUID();
    await supabase.from("password_reset_tokens").insert({
      user_id: user.id,
      reset_token: resetToken,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });

    return new Response(JSON.stringify({ success: true, reset_token: resetToken }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("auth-verify-otp error:", error);
    return new Response(JSON.stringify({ success: false, message: "Une erreur est survenue" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
