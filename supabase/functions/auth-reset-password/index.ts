import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { hashSync } from "npm:bcryptjs@2.4.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "https://omniaglobalacademy.com",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function sendBrevoResetConfirmation(apiKey: string, email: string, prenom: string): Promise<void> {
  const templateId = parseInt(Deno.env.get("BREVO_RESET_CONFIRM_TEMPLATE_ID") || "2");

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
      params: { PRENOM: prenom, EMAIL: email },
    }),
  });

  if (!res.ok) {
    console.error("Brevo reset confirm error:", await res.text());
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
    const { reset_token, new_password } = await req.json();

    if (!reset_token || !new_password) {
      return new Response(JSON.stringify({ success: false, message: "Token et nouveau mot de passe requis" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new_password.length < 8) {
      return new Response(JSON.stringify({ success: false, message: "Mot de passe trop court (minimum 8 caractères)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: tokenRecord } = await supabase
      .from("password_reset_tokens")
      .select("*")
      .eq("reset_token", reset_token.trim())
      .eq("used", false)
      .maybeSingle();

    if (!tokenRecord) {
      return new Response(JSON.stringify({ success: false, message: "Token invalide ou déjà utilisé" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(tokenRecord.expires_at) < new Date()) {
      return new Response(JSON.stringify({ success: false, message: "Token expiré. Demandez un nouveau code." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newPasswordHash = hashSync(new_password, 12);

    const { error: updateError } = await supabase
      .from("users")
      .update({ password_hash: newPasswordHash, updated_at: new Date().toISOString() })
      .eq("id", tokenRecord.user_id);

    if (updateError) throw updateError;

    // Mark token as used
    await supabase
      .from("password_reset_tokens")
      .update({ used: true })
      .eq("id", tokenRecord.id);

    // Invalidate all active sessions for security
    await supabase
      .from("user_sessions")
      .delete()
      .eq("user_id", tokenRecord.user_id);

    // Send Brevo confirmation email (template #2)
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    if (brevoApiKey) {
      const { data: user } = await supabase
        .from("users")
        .select("email, full_name")
        .eq("id", tokenRecord.user_id)
        .maybeSingle();

      if (user) {
        try {
          await sendBrevoResetConfirmation(brevoApiKey, user.email, user.full_name);
        } catch (e) {
          console.error("Brevo confirmation error:", e);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, message: "Mot de passe mis à jour. Connectez-vous." }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("auth-reset-password error:", error);
    return new Response(JSON.stringify({ success: false, message: "Une erreur est survenue" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
