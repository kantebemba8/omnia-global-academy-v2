import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import bcrypt from "npm:bcryptjs@2.4.3";
import {
  makeCorsHeaders,
  getClientIP,
  checkIPBlocklist,
  checkRateLimit,
  logSecurityEvent,
} from "../_shared/security.ts";

const ROLE_REDIRECT: Record<string, string> = {
  super_admin: "/admin/dashboard",
  moderateur: "/moderateur/dashboard",
  etablissement_directeur: "/school/dashboard",
  etablissement_enseignant: "/school/dashboard",
  professeur: "/professeur/dashboard",
  apprenant: "/dashboard",
};

function getRedirectUrl(roles: string[]): string {
  const priority = [
    "super_admin", "moderateur", "etablissement_directeur",
    "etablissement_enseignant", "professeur", "apprenant",
  ];
  for (const r of priority) {
    if (roles.includes(r)) return ROLE_REDIRECT[r];
  }
  return "/dashboard";
}

const DEMO_EMAIL = "test@omniaglobalacademy.com";

Deno.serve(async (req: Request) => {
  const corsHeaders = makeCorsHeaders();

  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, message: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const clientIP = getClientIP(req);
  const userAgent = req.headers.get("user-agent") ?? "";

  const supabase = createClient(
    Deno.env.get("DB_URL") ?? "",
    Deno.env.get("DB_SERVICE_ROLE_KEY") ?? ""
  );

  function json(d: unknown, s = 200) {
    return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    // IP blocklist check
    const isBlocked = await checkIPBlocklist(supabase, clientIP);
    if (isBlocked) {
      await logSecurityEvent(supabase, {
        event_type: "forbidden_access",
        ip_address: clientIP,
        user_agent: userAgent,
        endpoint: "auth-login",
        severity: "warning",
        details: { reason: "ip_blocked" },
      });
      return json({ success: false, message: "Accès refusé." }, 403);
    }

    // Rate limit: 10 attempts / 15 min / IP
    const rateCheck = await checkRateLimit(supabase, `login:${clientIP}`, 10, 900);
    if (!rateCheck.allowed) {
      await logSecurityEvent(supabase, {
        event_type: "rate_limit_hit",
        ip_address: clientIP,
        user_agent: userAgent,
        endpoint: "auth-login",
        severity: "warning",
      });
      return json({
        success: false,
        message: "Trop de tentatives. Réessayez dans quelques minutes.",
        retry_after: rateCheck.retryAfter,
      }, 429);
    }

    const { email, phone_number, password } = await req.json();
    if ((!email && !phone_number) || !password) {
      return json({ success: false, message: "Identifiants requis" }, 400);
    }

    let userQuery = supabase
      .from("users")
      .select("id, email, full_name, phone_number, status, country_code, avatar_url, password_hash, force_password_change");

    if (email) {
      userQuery = userQuery.eq("email", email.trim().toLowerCase());
    } else {
      userQuery = userQuery.eq("phone_number", phone_number.trim());
    }

    const { data: user } = await userQuery.maybeSingle();

    if (!user) {
      await logSecurityEvent(supabase, {
        event_type: "auth_failed",
        ip_address: clientIP,
        user_agent: userAgent,
        endpoint: "auth-login",
        severity: "info",
        details: { reason: "user_not_found", identifier: email || phone_number },
      });
      return json({ success: false, message: "Identifiants incorrects" }, 401);
    }
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      await logSecurityEvent(supabase, {
        event_type: "auth_failed",
        ip_address: clientIP,
        user_agent: userAgent,
        endpoint: "auth-login",
        user_id: user.id,
        severity: "info",
        details: { reason: "wrong_password" },
      });
      return json({ success: false, message: "Identifiants incorrects" }, 401);
    }
    // Demo account branch
    if (user.email === DEMO_EMAIL) {
      const { data: demoConfig } = await supabase
        .from("demo_account_config")
        .select("*")
        .order("configured_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!demoConfig) {
        return json({ success: false, demo_expired: true, message: "Accès démo non configuré. Contactez l'administrateur." }, 403);
      }

      if (!demoConfig.expires_at || new Date(demoConfig.expires_at) <= new Date()) {
        return json({ success: false, demo_expired: true, message: "Cet accès temporaire a expiré. Veuillez contacter l'administrateur." }, 403);
      }

      await supabase.from("user_sessions").delete().eq("user_id", user.id);

      const sessionToken = crypto.randomUUID();
      const heartbeatToken = crypto.randomUUID();
      const now = new Date().toISOString();

      await supabase.from("user_sessions").insert({
        user_id: user.id,
        session_token: sessionToken,
        ip_address: clientIP,
        user_agent: userAgent,
        expires_at: demoConfig.expires_at,
      });

      await supabase.from("demo_account_config")
        .update({ active_session_token: sessionToken, heartbeat_token: heartbeatToken, is_online: true, last_seen_at: now })
        .eq("id", demoConfig.id);

      await supabase.from("users").update({ last_login_at: now }).eq("id", user.id);

      const demoRoles: string[] = Array.isArray(demoConfig.demo_roles) ? demoConfig.demo_roles : ["apprenant"];

      return json({
        success: true,
        is_demo: true,
        session_token: sessionToken,
        redirect_url: "/demo/dashboard",
        heartbeat_token: heartbeatToken,
        expires_at: demoConfig.expires_at,
        demo_roles: demoRoles,
        demo_course_ids: demoConfig.demo_course_ids ?? [],
        user: {
          id: user.id, full_name: user.full_name, email: user.email,
          phone_number: user.phone_number, roles: demoRoles, force_password_change: false,
        },
      });
    }

    if (user.status === "suspendu") {
      await logSecurityEvent(supabase, {
        event_type: "account_suspended",
        ip_address: clientIP, user_agent: userAgent,
        endpoint: "auth-login", user_id: user.id, severity: "info",
      });
      return json({ success: false, message: "Compte suspendu. Contactez le support." }, 403);
    }

    if (user.status === "en_attente_validation") {
      return json({ success: false, needs_validation: true, message: "Votre compte est en attente de validation par notre équipe." }, 403);
    }

    if (user.status !== "actif") {
      return json({ success: false, message: "Compte inactif" }, 403);
    }

    const { data: rolesData } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const userRoles = (rolesData || []).map((r: { role: string }) => r.role);

    const sessionToken = crypto.randomUUID();
    const now = new Date().toISOString();

    await supabase.from("user_sessions").insert({
      user_id: user.id,
      session_token: sessionToken,
      ip_address: clientIP,
      user_agent: userAgent,
      expires_at: new Date(Date.now() + 30 * 24 * 3_600_000).toISOString(),
    });

    await supabase.from("users").update({ last_login_at: now }).eq("id", user.id);

    return json({
      success: true,
      session_token: sessionToken,
      redirect_url: getRedirectUrl(userRoles),
      user: {
        id: user.id, full_name: user.full_name, email: user.email,
        phone_number: user.phone_number, roles: userRoles,
        force_password_change: user.force_password_change,
      },
    });
  } catch (error) {
    console.error("auth-login error:", error);
    return json({ success: false, message: "Une erreur est survenue" }, 500);
  }
});
