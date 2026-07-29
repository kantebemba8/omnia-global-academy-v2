import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import bcrypt from "npm:bcryptjs@2.4.3";
const SECURITY_HEADERS = {
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-demo-heartbeat-token",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};
function makeCorsHeaders(origin?: string): Record<string, string> {
  return { ...SECURITY_HEADERS, "Access-Control-Allow-Origin": origin ?? Deno.env.get("ALLOWED_ORIGIN") ?? "https://omniaglobalacademy.com" };
}
function getClientIP(req: Request): string {
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
}
async function checkIPBlocklist(supabase: any, ip: string): Promise<boolean> {
  const { data } = await supabase.from("ip_blocklist").select("blocked_until").eq("ip_address", ip).maybeSingle();
  if (!data) return false;
  if (!data.blocked_until) return true;
  return new Date(data.blocked_until) > new Date();
}
async function checkRateLimit(supabase: any, key: string, maxRequests: number, windowSeconds: number): Promise<{ allowed: boolean; retryAfter?: number }> {
  const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();
  const { count } = await supabase.from("rate_limit_log").select("*", { count: "exact", head: true }).eq("rate_key", key).gte("created_at", windowStart);
  if ((count ?? 0) >= maxRequests) return { allowed: false, retryAfter: windowSeconds };
  await supabase.from("rate_limit_log").insert({ rate_key: key, created_at: new Date().toISOString() });
  return { allowed: true };
}
async function logSecurityEvent(supabase: any, event: Record<string, unknown>): Promise<void> {
  await supabase.from("security_audit_log").insert({ ...event, severity: event.severity ?? "info" });
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
    "super_admin", "moderateur", "responsable_structure",
    "gestionnaire_partenaire", "structure_admin", "directeur", "etablissement_directeur",
    "recruteur_structure", "organizer", "organisateur",
    "recruteur_independant", "recruteur",
    "etablissement_enseignant", "enseignant", "professeur", "formateur", "coach", "apprenant",
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
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
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
