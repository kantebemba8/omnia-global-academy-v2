import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "https://omniaglobalacademy.com",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const DEMO_EMAIL = "test@omniaglobalacademy.com";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ success: false, message: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const sessionToken = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!sessionToken) {
    return new Response(JSON.stringify({ success: false, message: "Token manquant" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? Deno.env.get("DB_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("DB_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: session } = await supabase
      .from("user_sessions")
      .select("user_id, expires_at")
      .eq("session_token", sessionToken)
      .maybeSingle();

    if (!session) {
      return new Response(JSON.stringify({ success: false, message: "Session invalide" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(session.expires_at) < new Date()) {
      return new Response(JSON.stringify({ success: false, message: "Session expirée" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: user } = await supabase
      .from("users")
      .select("id, email, full_name, phone_number, avatar_url, status, force_password_change")
      .eq("id", session.user_id)
      .maybeSingle();

    if (!user) {
      return new Response(JSON.stringify({ success: false, message: "Compte inaccessible" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Demo account: verify this session is still the active one
    if (user.email === DEMO_EMAIL) {
      const { data: demoConfig } = await supabase
        .from("demo_account_config")
        .select("active_session_token, expires_at, demo_roles")
        .order("configured_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!demoConfig || demoConfig.active_session_token !== sessionToken) {
        return new Response(JSON.stringify({
          success: false,
          error: "DEMO_SESSION_REPLACED",
          message: "Cette session démo a été remplacée par une connexion plus récente.",
        }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!demoConfig.expires_at || new Date(demoConfig.expires_at) <= new Date()) {
        return new Response(JSON.stringify({
          success: false,
          error: "DEMO_EXPIRED",
          message: "L'accès démo a expiré.",
        }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const demoRoles: string[] = Array.isArray(demoConfig.demo_roles)
        ? demoConfig.demo_roles
        : ["apprenant"];

      return new Response(JSON.stringify({
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
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Regular user — suspended check after demo branch
    if (user.status === "suspendu") {
      return new Response(JSON.stringify({ success: false, message: "Compte inaccessible" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user_id);

    const roles = (rolesData ?? []).map((r: { role: string }) => r.role);

    return new Response(JSON.stringify({
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
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("auth-me error:", error);
    return new Response(JSON.stringify({ success: false, message: "Erreur serveur" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
