import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { makeCorsHeaders } from "../_shared/auth-security.ts";
import { getOmniaRoles, getOmniaSessionByToken, getOmniaSessionToken, hashOmniaToken } from "../_shared/omnia-auth.ts";

const DEMO_EMAIL = "test@omniaglobalacademy.com";

Deno.serve(async (req: Request) => {
  const corsHeaders = makeCorsHeaders(req);
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "GET") return json({ success: false, message: "Method not allowed" }, 405);

  const sessionToken = getOmniaSessionToken(req);
  if (!sessionToken) return json({ success: false, message: "Token manquant" }, 401);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? Deno.env.get("DB_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("DB_SERVICE_ROLE_KEY") ?? "",
    );

    const session = await getOmniaSessionByToken(supabase, sessionToken);
    if (!session) return json({ success: false, message: "Session invalide" }, 401);
    if (!session.expires_at || new Date(session.expires_at) <= new Date()) {
      return json({ success: false, message: "Session expirée" }, 401);
    }

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, email, full_name, phone_number, avatar_url, status, force_password_change")
      .eq("id", session.user_id)
      .maybeSingle();
    if (userError) throw userError;
    if (!user) return json({ success: false, message: "Compte inaccessible" }, 403);

    // Démo : le token brut n'est jamais utilisé pour rechercher user_sessions.
    // Il reste temporairement comparé au verrou de session démo historique, qui
    // sera lui aussi migré lors du Lot 2B sans interrompre les démonstrations.
    if (user.email === DEMO_EMAIL) {
      const { data: demoConfig, error: demoError } = await supabase
        .from("demo_account_config")
        .select("active_session_token_hash, expires_at, demo_roles")
        .order("configured_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (demoError) throw demoError;

      if (!demoConfig || demoConfig.active_session_token_hash !== await hashOmniaToken(sessionToken)) {
        return json({
          success: false,
          error: "DEMO_SESSION_REPLACED",
          message: "Cette session démo a été remplacée par une connexion plus récente.",
        }, 401);
      }

      if (!demoConfig.expires_at || new Date(demoConfig.expires_at) <= new Date()) {
        return json({
          success: false,
          error: "DEMO_EXPIRED",
          message: "L'accès démo a expiré.",
        }, 403);
      }

      const demoRoles: string[] = Array.isArray(demoConfig.demo_roles)
        ? demoConfig.demo_roles
        : ["apprenant"];

      return json({
        success: true,
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          phone_number: user.phone_number,
          avatar_url: user.avatar_url ?? null,
          roles: demoRoles,
          force_password_change: false,
          is_demo: true,
        },
      });
    }

    if (user.status !== "actif") {
      return json({
        success: false,
        error: user.status === "supprime" ? "ACCOUNT_DELETED" : "ACCOUNT_INACTIVE",
        message: "Compte inaccessible",
      }, user.status === "supprime" ? 410 : 403);
    }

    const roles = await getOmniaRoles(supabase, String(session.user_id));
    return json({
      success: true,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone_number: user.phone_number,
        avatar_url: user.avatar_url ?? null,
        roles,
        force_password_change: user.force_password_change ?? false,
      },
    });
  } catch (error) {
    console.error("auth-me error:", error);
    return json({ success: false, message: "Erreur serveur" }, 500);
  }
});
