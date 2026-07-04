import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { hashSync } from "npm:bcryptjs@2.4.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "https://omniaglobalacademy.com",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, message: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const { reset_token, token, new_password } = body;

    // Accepter reset_token (OTP) ou token (lien email)
    const tokenValue = reset_token || token;

    if (!tokenValue || !new_password) {
      return json({ success: false, message: "Token et nouveau mot de passe requis" }, 400);
    }

    if (new_password.length < 8) {
      return json({ success: false, message: "Mot de passe trop court (minimum 8 caractères)" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let userId: string | null = null;

    // CAS 1 — Token URL (lien email) : chercher dans password_reset_tokens
    if (token) {
      const { data: tokenRecord } = await supabase
        .from("password_reset_tokens")
        .select("*")
        .eq("token", token.trim())
        .eq("used", false)
        .maybeSingle();

      if (!tokenRecord) {
        return json({ success: false, message: "Lien invalide ou déjà utilisé" }, 400);
      }

      if (new Date(tokenRecord.expires_at) < new Date()) {
        return json({ success: false, message: "Lien expiré. Demandez un nouveau lien." }, 400);
      }

      userId = tokenRecord.user_id;

      // Marquer le token comme utilisé
      await supabase.from("password_reset_tokens")
        .update({ used: true })
        .eq("id", tokenRecord.id);
    }

    // CAS 2 — reset_token (OTP SMS) : chercher dans password_reset_tokens
    if (reset_token && !token) {
      const { data: tokenRecord } = await supabase
        .from("password_reset_tokens")
        .select("*")
        .eq("reset_token", reset_token.trim())
        .eq("used", false)
        .maybeSingle();

      if (!tokenRecord) {
        return json({ success: false, message: "Token invalide ou déjà utilisé" }, 400);
      }

      if (new Date(tokenRecord.expires_at) < new Date()) {
        return json({ success: false, message: "Token expiré. Demandez un nouveau code." }, 400);
      }

      userId = tokenRecord.user_id;

      await supabase.from("password_reset_tokens")
        .update({ used: true })
        .eq("id", tokenRecord.id);
    }

    if (!userId) {
      return json({ success: false, message: "Token invalide" }, 400);
    }

    // Mettre à jour le mot de passe
    const newPasswordHash = hashSync(new_password, 12);

    const { error: updateError } = await supabase
      .from("users")
      .update({
        password_hash: newPasswordHash,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateError) throw updateError;

    // Invalider toutes les sessions actives
    await supabase.from("user_sessions")
      .delete()
      .eq("user_id", userId);

    return json({
      success: true,
      message: "Mot de passe mis à jour avec succès. Connectez-vous.",
    });

  } catch (error) {
    console.error("auth-reset-password error:", error);
    return json({ success: false, message: "Une erreur est survenue" }, 500);
  }
});
