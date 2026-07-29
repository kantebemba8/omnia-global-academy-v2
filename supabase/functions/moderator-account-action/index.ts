import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type SupabaseClient = ReturnType<typeof createClient>;
type PermissionMap = Record<string, boolean>;
const PROTECTED_ROLES = ["super_admin", "moderateur"];

function maskName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return parts[0] || "—";
  return `${parts.slice(0, -1).join(" ")} ${parts.at(-1)?.[0] || ""}.`;
}

function normalizePermissions(row: Record<string, unknown> | null): PermissionMap {
  const nested = row?.permissions && typeof row.permissions === "object" && !Array.isArray(row.permissions)
    ? row.permissions as Record<string, unknown>
    : {};
  const value = (canonical: string, legacy?: string) => nested[canonical] === true || row?.[canonical] === true || (!!legacy && (nested[legacy] === true || row?.[legacy] === true));
  return {
    can_see_learners_list: value("can_see_learners_list"),
    can_see_professors_list: value("can_see_professors_list"),
    can_request_account_suspension: value("can_request_account_suspension", "can_suspend_account"),
  };
}

async function verifyModerator(sb: SupabaseClient, token: string) {
  const { data: session, error: sessionError } = await sb
    .from("user_sessions")
    .select("user_id")
    .eq("session_token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (sessionError || !session) return null;

  const { data: role, error: roleError } = await sb
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user_id)
    .eq("role", "moderateur")
    .maybeSingle();
  if (roleError || !role) return null;
  return String(session.user_id);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (!["GET", "POST"].includes(req.method)) return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const url = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!url || !serviceKey) return json({ error: "SERVER_CONFIG_ERROR" }, 500);
    const sb = createClient(url, serviceKey);
    const moderatorId = await verifyModerator(sb, token);
    if (!moderatorId) return json({ error: "FORBIDDEN" }, 403);

    const { data: permissionRow, error: permissionError } = await sb
      .from("moderator_permissions")
      .select("*")
      .eq("moderator_user_id", moderatorId)
      .maybeSingle();
    if (permissionError) throw permissionError;
    const permissions = normalizePermissions(permissionRow as Record<string, unknown> | null);

    if (req.method === "GET") {
      if (!permissions.can_see_learners_list && !permissions.can_see_professors_list) return json({ error: "FORBIDDEN" }, 403);

      const requestUrl = new URL(req.url);
      const search = (requestUrl.searchParams.get("search") || "").trim();
      const statusFilter = (requestUrl.searchParams.get("status") || "").trim();
      const requestedType = requestUrl.searchParams.get("type") || "all";
      const allowedTypes = [
        ...(permissions.can_see_learners_list ? ["apprenant"] : []),
        ...(permissions.can_see_professors_list ? ["professeur"] : []),
      ];
      if (requestedType !== "all" && !allowedTypes.includes(requestedType)) return json({ users: [] });

      const { data: protectedRows, error: protectedError } = await sb.from("user_roles").select("user_id").in("role", PROTECTED_ROLES);
      if (protectedError) throw protectedError;
      const protectedIds = [...new Set((protectedRows || []).map((row: { user_id: string }) => String(row.user_id)))];

      let query = sb.from("users").select("id,full_name,status,country_code,created_at").order("created_at", { ascending: false }).limit(100);
      if (protectedIds.length) query = query.not("id", "in", `(${protectedIds.join(",")})`);
      if (search) query = query.ilike("full_name", `%${search}%`);
      if (statusFilter) query = query.eq("status", statusFilter);
      const { data: users, error: usersError } = await query;
      if (usersError) throw usersError;

      const userIds = (users || []).map((user: { id: string }) => String(user.id));
      const { data: roleRows, error: rolesError } = userIds.length
        ? await sb.from("user_roles").select("user_id,role").in("user_id", userIds)
        : { data: [], error: null };
      if (rolesError) throw rolesError;
      const rolesByUser = new Map<string, string[]>();
      for (const row of roleRows || []) {
        const id = String(row.user_id);
        rolesByUser.set(id, [...(rolesByUser.get(id) || []), String(row.role)]);
      }

      const safeUsers = (users || []).flatMap((user: Record<string, unknown>) => {
        const roles = rolesByUser.get(String(user.id)) || [];
        if (roles.some((role) => PROTECTED_ROLES.includes(role))) return [];
        if (!roles.some((role) => allowedTypes.includes(role))) return [];
        if (requestedType !== "all" && !roles.includes(requestedType)) return [];
        return [{
          id: user.id,
          full_name: maskName(String(user.full_name || "")),
          status: user.status,
          country_code: user.country_code,
          created_at: user.created_at,
          roles,
        }];
      });
      return json({ users: safeUsers, permissions });
    }

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    if (body.action !== "submit_request") return json({ error: "INVALID_ACTION" }, 400);
    if (!permissions.can_request_account_suspension) {
      return json({ error: "FORBIDDEN", message: "Permission de demande d’action sur un compte requise." }, 403);
    }

    const targetUserId = String(body.target_user_id || "");
    const requestAction = String(body.request_action || "");
    const reason = String(body.reason || "").trim();
    if (!targetUserId || !["suspend", "reactivate", "validate_kyc"].includes(requestAction) || reason.length < 3) {
      return json({ error: "INVALID_PARAMS", message: "La cible, l’action et un motif sont requis." }, 400);
    }

    const { data: targetRoles, error: targetRolesError } = await sb.from("user_roles").select("role").eq("user_id", targetUserId);
    if (targetRolesError) throw targetRolesError;
    if ((targetRoles || []).some((row: { role: string }) => PROTECTED_ROLES.includes(row.role))) {
      return json({ error: "PROTECTED_ACCOUNT", message: "Action interdite sur ce compte." }, 403);
    }

    const { data: existing, error: existingError } = await sb
      .from("moderator_action_requests")
      .select("id")
      .eq("moderator_id", moderatorId)
      .eq("target_user_id", targetUserId)
      .eq("action_type", requestAction)
      .eq("status", "pending")
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) return json({ error: "REQUEST_ALREADY_PENDING", message: "Une demande identique est déjà en attente." }, 409);

    const { data: created, error: insertError } = await sb.from("moderator_action_requests").insert({
      moderator_id: moderatorId,
      action_type: requestAction,
      target_user_id: targetUserId,
      reason,
      status: "pending",
    }).select("id").single();
    if (insertError) throw insertError;

    return json({ success: true, request_id: created.id, message: "Demande transmise au Super-admin." }, 201);
  } catch (error) {
    console.error("moderator-account-action", error);
    return json({ error: "SERVER_ERROR", message: error instanceof Error ? error.message : String(error) }, 500);
  }
});
