import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import bcrypt from "npm:bcryptjs@2.4.3";
import {
  consumeRateLimit,
  generateOpaqueToken,
  getClientIP,
  makeCorsHeaders,
  sha256Hex,
} from "../_shared/auth-security.ts";

async function checkIPBlocklist(supabase: any, ip: string): Promise<boolean> {
  if (ip === "unknown") return false;
  const { data } = await supabase
    .from("ip_blocklist")
    .select("blocked_until")
    .eq("ip_address", ip)
    .maybeSingle();

  if (!data) return false;
  if (!data.blocked_until) return true;
  return new Date(data.blocked_until) > new Date();
}

async function logSecurityEvent(
  supabase: any,
  event: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from("security_audit_log")
    .insert({ ...event, severity: event.severity ?? "info" });

  if (error) console.error("security_audit_log insert failed:", error.message);
}

const ROLE_REDIRECT: Record<string, string> = {
  super_admin: "/admin/dashboard",
  moderateur: "/moderateur/dashboard",
  responsable_structure: "/structure/dashboard",
  gestionnaire_partenaire: "/structure/dashboard",
  structure_admin: "/structure/dashboard",
  directeur: "/structure/dashboard",
  etablissement_directeur: "/structure/dashboard",
  recruteur_structure: "/structure/recrutement/dashboard",
  organizer: "/omnia-live/organisateur",
  organisateur: "/omnia-live/organisateur",
  recruteur_independant: "/talent/recruteur/dashboard",
  recruteur: "/talent/recruteur/dashboard",
  etablissement_enseignant: "/professeur/dashboard",
  enseignant: "/professeur/dashboard",
  professeur: "/professeur/dashboard",
  formateur: "/professeur/dashboard",
  coach: "/coach/dashboard",
  apprenant: "/dashboard",
};

function getRedirectUrl(roles: string[]): string {
  const priority = [
    "super_admin",
    "moderateur",
    "responsable_structure",
    "gestionnaire_partenaire",
    "structure_admin",
    "directeur",
    "etablissement_directeur",
    "recruteur_structure",
    "organizer",
    "organisateur",
    "recruteur_independant",
    "recruteur",
    "etablissement_enseignant",
    "enseignant",
    "professeur",
    "formateur",
    "coach",
    "apprenant",
  ];

  for (const role of priority) {
    if (roles.includes(role)) return ROLE_REDIRECT[role];
  }
  return "/dashboard";
}

const DEMO_EMAIL = "test@omniaglobalacademy.com";

Deno.serve(async (req: Request) => {
  const corsHeaders = makeCorsHeaders(req);
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ success: false, message: "Method not allowed" }, 405);
  }

  const clientIP = getClientIP(req);
  const userAgent = req.headers.get("user-agent") ?? "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    if (await checkIPBlocklist(supabase, clientIP)) {
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

    const ipLimit = await consumeRateLimit(
      supabase,
      `auth-login:ip:${clientIP}`,
      15,
      15 * 60,
    );
    if (!ipLimit.allowed) {
      await logSecurityEvent(supabase, {
        event_type: "rate_limit_hit",
        ip_address: clientIP,
        user_agent: userAgent,
        endpoint: "auth-login",
        severity: "warning",
        details: { scope: "ip" },
      });
      return json({
        success: false,
        message: "Trop de tentatives. Réessayez dans quelques minutes.",
        retry_after: ipLimit.retryAfter,
      }, 429);
    }

    const body = await req.json();
    const email = typeof body.email === "string"
      ? body.email.trim().toLowerCase()
      : "";
    const phoneNumber = typeof body.phone_number === "string"
      ? body.phone_number.trim()
      : "";
    const password = typeof body.password === "string" ? body.password : "";
    const reactivateAccount = body.reactivate_account === true;

    if ((!email && !phoneNumber) || !password) {
      return json({ success: false, message: "Identifiants requis" }, 400);
    }

    const identifier = email || phoneNumber;
    const identifierHash = await sha256Hex(identifier);
    const identifierLimit = await consumeRateLimit(
      supabase,
      `auth-login:id:${identifierHash}`,
      8,
      15 * 60,
    );
    if (!identifierLimit.allowed) {
      await logSecurityEvent(supabase, {
        event_type: "rate_limit_hit",
        ip_address: clientIP,
        user_agent: userAgent,
        endpoint: "auth-login",
        severity: "warning",
        details: { scope: "identifier", identifier_hash: identifierHash.slice(0, 16) },
      });
      return json({
        success: false,
        message: "Trop de tentatives. Réessayez dans quelques minutes.",
        retry_after: identifierLimit.retryAfter,
      }, 429);
    }

    let userQuery = supabase
      .from("users")
      .select(
        "id, email, full_name, phone_number, status, country_code, avatar_url, password_hash, force_password_change, suspension_source, self_suspended_at, self_suspension_until, self_suspension_reason_code",
      );

    userQuery = email
      ? userQuery.eq("email", email)
      : userQuery.eq("phone_number", phoneNumber);

    const { data: user, error: userError } = await userQuery.maybeSingle();
    if (userError) throw userError;

    if (!user) {
      await logSecurityEvent(supabase, {
        event_type: "auth_failed",
        ip_address: clientIP,
        user_agent: userAgent,
        endpoint: "auth-login",
        severity: "info",
        details: {
          reason: "user_not_found",
          identifier_hash: identifierHash.slice(0, 16),
        },
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

    let accountReactivated = false;

    if (user.email === DEMO_EMAIL) {
      const { data: demoConfig, error: demoError } = await supabase
        .from("demo_account_config")
        .select("*")
        .order("configured_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (demoError) throw demoError;

      if (!demoConfig) {
        return json({
          success: false,
          demo_expired: true,
          message: "Accès démo non configuré. Contactez l'administrateur.",
        }, 403);
      }

      if (!demoConfig.expires_at || new Date(demoConfig.expires_at) <= new Date()) {
        return json({
          success: false,
          demo_expired: true,
          message: "Cet accès temporaire a expiré. Veuillez contacter l'administrateur.",
        }, 403);
      }

      await supabase.from("user_sessions").delete().eq("user_id", user.id);

      const sessionToken = generateOpaqueToken();
      const heartbeatToken = generateOpaqueToken();
      const now = new Date().toISOString();

      const { error: sessionError } = await supabase.from("user_sessions").insert({
        user_id: user.id,
        session_token: sessionToken,
        ip_address: clientIP,
        user_agent: userAgent,
        expires_at: demoConfig.expires_at,
      });
      if (sessionError) throw sessionError;

      await supabase
        .from("demo_account_config")
        .update({
          active_session_token: sessionToken,
          heartbeat_token: heartbeatToken,
          is_online: true,
          last_seen_at: now,
        })
        .eq("id", demoConfig.id);

      await supabase.from("users").update({ last_login_at: now }).eq("id", user.id);

      const demoRoles: string[] = Array.isArray(demoConfig.demo_roles)
        ? demoConfig.demo_roles
        : ["apprenant"];

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
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          phone_number: user.phone_number,
          roles: demoRoles,
          force_password_change: false,
        },
      });
    }

    if (user.status === "suspendu") {
      const selfSuspended = user.suspension_source === "self";
      const plannedUntil = user.self_suspension_until ? new Date(user.self_suspension_until) : null;
      const plannedDateReached = Boolean(plannedUntil && !Number.isNaN(plannedUntil.getTime()) && plannedUntil <= new Date());

      if (!selfSuspended) {
        await logSecurityEvent(supabase, {
          event_type: "account_suspended",
          ip_address: clientIP,
          user_agent: userAgent,
          endpoint: "auth-login",
          user_id: user.id,
          severity: "info",
          details: { self_reactivation_allowed: false },
        });
        return json({
          success: false,
          error: "ACCOUNT_SUSPENDED",
          can_reactivate: false,
          message: "Ce compte a été suspendu par l’équipe Omnia. Contactez le support pour demander sa réactivation.",
        }, 403);
      }

      if (!reactivateAccount && !plannedDateReached) {
        await logSecurityEvent(supabase, {
          event_type: "account_suspended",
          ip_address: clientIP,
          user_agent: userAgent,
          endpoint: "auth-login",
          user_id: user.id,
          severity: "info",
          details: { self_reactivation_allowed: true },
        });
        return json({
          success: false,
          error: "ACCOUNT_SELF_SUSPENDED",
          can_reactivate: true,
          suspended_at: user.self_suspended_at || null,
          suspended_until: user.self_suspension_until || null,
          reason_code: user.self_suspension_reason_code || null,
          message: "Vous avez volontairement suspendu ce compte. Confirmez sa réactivation pour vous reconnecter.",
        }, 403);
      }

      const { data: reactivation, error: reactivationError } = await supabase.rpc("omnia_reactivate_user_account", {
        p_user_id: user.id,
        p_source: "password_login",
      });
      if (reactivationError) {
        const message = String(reactivationError.message || "");
        if (message.includes("SELF_REACTIVATION_NOT_ALLOWED")) {
          return json({ success: false, error: "SELF_REACTIVATION_NOT_ALLOWED", message: "La réactivation autonome n’est pas autorisée pour ce compte." }, 403);
        }
        throw reactivationError;
      }

      user.status = "actif";
      accountReactivated = true;
      await logSecurityEvent(supabase, {
        event_type: "account_reactivated",
        ip_address: clientIP,
        user_agent: userAgent,
        endpoint: "auth-login",
        user_id: user.id,
        severity: "info",
        details: { source: plannedDateReached && !reactivateAccount ? "planned_date" : "user_confirmation" },
      });
      void reactivation;
    }

    if (user.status === "en_attente_validation") {
      return json({
        success: false,
        needs_validation: true,
        message: "Votre compte est en attente de validation par notre équipe.",
      }, 403);
    }

    if (user.status === "supprime") {
      return json({ success: false, error: "ACCOUNT_DELETED", message: "Ce compte a été supprimé." }, 410);
    }

    if (user.status !== "actif") {
      return json({ success: false, message: "Compte inactif" }, 403);
    }

    const { data: rolesData, error: rolesError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    if (rolesError) throw rolesError;

    const userRoles = (rolesData ?? []).map((row: { role: string }) => row.role);
    const sessionToken = generateOpaqueToken();
    const now = new Date().toISOString();

    const { error: sessionError } = await supabase.from("user_sessions").insert({
      user_id: user.id,
      session_token: sessionToken,
      ip_address: clientIP,
      user_agent: userAgent,
      expires_at: new Date(Date.now() + 30 * 24 * 3_600_000).toISOString(),
    });
    if (sessionError) throw sessionError;

    await supabase.from("users").update({ last_login_at: now }).eq("id", user.id);

    await logSecurityEvent(supabase, {
      event_type: "auth_success",
      ip_address: clientIP,
      user_agent: userAgent,
      endpoint: "auth-login",
      user_id: user.id,
      severity: "info",
    });

    return json({
      success: true,
      reactivated: accountReactivated,
      session_token: sessionToken,
      redirect_url: getRedirectUrl(userRoles),
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone_number: user.phone_number,
        roles: userRoles,
        force_password_change: user.force_password_change,
      },
    });
  } catch (error) {
    console.error("auth-login error:", error);
    return json({ success: false, message: "Une erreur est survenue" }, 500);
  }
});
