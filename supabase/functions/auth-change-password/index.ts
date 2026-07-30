import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import bcrypt from "npm:bcryptjs@2.4.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "https://omniaglobalacademy.com",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-omnia-session-token",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function requestSessionToken(req: Request, body: Record<string, unknown>): string {
  return String(
    req.headers.get("x-omnia-session-token") ||
    req.headers.get("Authorization") ||
    body.session_token ||
    "",
  ).replace(/^Bearer\s+/i, "").trim();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, message: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const sessionToken = requestSessionToken(req, body);
    const currentPassword = String(body.current_password || "");
    const newPassword = String(body.new_password || "");

    if (!sessionToken || !newPassword) {
      return json({ success: false, message: "Session et nouveau mot de passe requis" }, 400);
    }
    if (newPassword.length < 8) {
      return json({ success: false, message: "Mot de passe trop court (minimum 8 caractères)" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: session, error: sessionError } = await supabase
      .from("user_sessions")
      .select("user_id, expires_at")
      .eq("session_token", sessionToken)
      .maybeSingle();

    if (sessionError || !session) return json({ success: false, message: "Session invalide" }, 401);
    if (new Date(session.expires_at) < new Date()) {
      return json({ success: false, message: "Session expirée. Reconnectez-vous." }, 401);
    }

    const { data: account, error: accountError } = await supabase
      .from("users")
      .select("id,password_hash,force_password_change")
      .eq("id", session.user_id)
      .maybeSingle();
    if (accountError) throw accountError;
    if (!account) return json({ success: false, message: "Compte introuvable" }, 404);

    // Le mot de passe actuel est obligatoire pour une modification volontaire.
    // Il reste facultatif uniquement durant le parcours imposé force_password_change.
    if (!account.force_password_change) {
      if (!currentPassword) {
        return json({ success: false, message: "Mot de passe actuel requis" }, 400);
      }
      const validCurrentPassword = await bcrypt.compare(currentPassword, String(account.password_hash || ""));
      if (!validCurrentPassword) {
        return json({ success: false, message: "Mot de passe actuel incorrect" }, 403);
      }
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    const { error: updateError } = await supabase
      .from("users")
      .update({
        password_hash: newPasswordHash,
        force_password_change: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.user_id);
    if (updateError) throw updateError;

    // Une modification de mot de passe révoque les anciennes sessions et en
    // émet une nouvelle afin que le navigateur reste connecté en sécurité.
    const newToken = crypto.randomUUID();
    await supabase.from("user_sessions").delete().eq("user_id", session.user_id);
    const { error: insertSessionError } = await supabase.from("user_sessions").insert({
      user_id: session.user_id,
      session_token: newToken,
      expires_at: new Date(Date.now() + 30 * 24 * 3_600_000).toISOString(),
    });
    if (insertSessionError) throw insertSessionError;

    const [{ data: user, error: userError }, { data: rolesData, error: rolesError }] = await Promise.all([
      supabase.from("users")
        .select("id,email,full_name,phone_number,status,avatar_url,country_code")
        .eq("id", session.user_id)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", session.user_id),
    ]);
    if (userError) throw userError;
    if (rolesError) throw rolesError;

    return json({
      success: true,
      session_token: newToken,
      user: { ...user, roles: (rolesData || []).map((row: { role: string }) => row.role) },
    });
  } catch (error) {
    console.error("auth-change-password error:", error);
    return json({ success: false, message: "Une erreur est survenue" }, 500);
  }
});
