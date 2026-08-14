import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import bcrypt from "npm:bcryptjs@2.4.3";
import { makeCorsHeaders } from "../_shared/auth-security.ts";
import {
  createOmniaSession,
  getOmniaRoles,
  getOmniaSessionByToken,
  getOmniaSessionToken,
} from "../_shared/omnia-auth.ts";

Deno.serve(async (req: Request) => {
  const corsHeaders = makeCorsHeaders(req);
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, message: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const sessionToken = getOmniaSessionToken(req, body);
    const currentPassword = String(body.current_password || "");
    const newPassword = String(body.new_password || "");

    if (!sessionToken || !newPassword) {
      return json({ success: false, message: "Session et nouveau mot de passe requis" }, 400);
    }
    if (newPassword.length < 8 || newPassword.length > 128) {
      return json({ success: false, message: "Le mot de passe doit contenir entre 8 et 128 caractères" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const session = await getOmniaSessionByToken(supabase, sessionToken);
    if (!session) return json({ success: false, message: "Session invalide" }, 401);
    if (!session.expires_at || new Date(session.expires_at) <= new Date()) {
      return json({ success: false, message: "Session expirée. Reconnectez-vous." }, 401);
    }

    const { data: account, error: accountError } = await supabase
      .from("users")
      .select("id,password_hash,force_password_change")
      .eq("id", session.user_id)
      .maybeSingle();
    if (accountError) throw accountError;
    if (!account) return json({ success: false, message: "Compte introuvable" }, 404);

    if (!account.force_password_change) {
      if (!currentPassword) return json({ success: false, message: "Mot de passe actuel requis" }, 400);
      const validCurrentPassword = await bcrypt.compare(currentPassword, String(account.password_hash || ""));
      if (!validCurrentPassword) return json({ success: false, message: "Mot de passe actuel incorrect" }, 403);
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

    // Révoque toutes les anciennes sessions et crée une nouvelle session dont
    // le hash est immédiatement disponible pour les fonctions migrées du Lot 2A.
    await supabase.from("user_sessions").delete().eq("user_id", session.user_id);
    const { token: newToken } = await createOmniaSession(supabase, {
      userId: String(session.user_id),
      expiresAt: new Date(Date.now() + 30 * 24 * 3_600_000).toISOString(),
      ipAddress: req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || null,
      userAgent: req.headers.get("user-agent") ?? "",
    });

    const { data: user, error: userError } = await supabase.from("users")
      .select("id,email,full_name,phone_number,status,avatar_url,country_code")
      .eq("id", session.user_id)
      .maybeSingle();
    if (userError) throw userError;
    const roles = await getOmniaRoles(supabase, String(session.user_id));

    return json({ success: true, session_token: newToken, user: { ...user, roles } });
  } catch (error) {
    console.error("auth-change-password error:", error);
    return json({ success: false, message: "Une erreur est survenue" }, 500);
  }
});
