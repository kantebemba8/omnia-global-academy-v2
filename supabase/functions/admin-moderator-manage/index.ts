import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { createAccessInvitation } from "../_shared/access-invitations.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-omnia-session-token",
  "Access-Control-Max-Age": "86400",
  "Cache-Control": "no-store",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type SupabaseClient = ReturnType<typeof createClient>;
type PermissionMap = Record<string, boolean>;

const CANONICAL_PERMISSION_KEYS = [
  "can_see_pending_courses",
  "can_review_course_content",
  "can_request_course_modification",
  "can_reject_course",
  "can_recommend_course_price",
  "can_approve_transmit_course",
  "can_manage_course_certifications",
  "can_create_assisted_course",
  "can_see_learners_list",
  "can_see_professors_list",
  "can_see_structures_list",
  "can_see_organizers_list",
  "can_validate_professor_kyc",
  "can_validate_structure_kyc",
  "can_request_account_suspension",
  "can_moderate_forum",
  "can_moderate_jobs",
  "can_manage_support",
  "can_view_ai_conversations",
  "can_manage_reports",
  "can_review_live_events",
  "can_review_live_reports",
  "can_review_live_refunds",
  "can_review_live_organizers",
  "can_review_structure_requests",
  "can_review_structure_codes",
  "can_view_analytics",
] as const;

const LEGACY_BOOLEAN_KEYS = [
  "can_see_pending_courses",
  "can_validate_course_price",
  "can_reject_course",
  "can_request_course_modification",
  "can_approve_transmit_course",
  "can_create_assisted_course",
  "can_see_learners_list",
  "can_see_professors_list",
  "can_suspend_account",
  "can_validate_professor_kyc",
  "can_validate_establishment_kyc",
  "can_moderate_forum",
  "can_moderate_jobs",
  "can_manage_support",
  "can_view_ai_conversations",
  "can_view_analytics",
] as const;

function asPermissionMap(value: unknown): PermissionMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, enabled]) => [key, enabled === true]));
}

function normalizePermissions(row: Record<string, unknown> | null | undefined): PermissionMap {
  const source = row || {};
  const merged: PermissionMap = {};
  for (const key of LEGACY_BOOLEAN_KEYS) {
    if (typeof source[key] === "boolean") merged[key] = source[key] === true;
  }
  Object.assign(merged, asPermissionMap(source.permissions));

  const normalized: PermissionMap = {};
  for (const key of CANONICAL_PERMISSION_KEYS) normalized[key] = merged[key] === true;

  normalized.can_recommend_course_price = merged.can_recommend_course_price === true || merged.can_validate_course_price === true;
  normalized.can_approve_transmit_course = merged.can_approve_transmit_course === true || merged.can_transmit_course_to_admin === true;
  normalized.can_validate_structure_kyc = merged.can_validate_structure_kyc === true || merged.can_validate_establishment_kyc === true;
  normalized.can_request_account_suspension = merged.can_request_account_suspension === true || merged.can_suspend_account === true;
  normalized.can_reject_course = merged.can_reject_course === true;
  return normalized;
}

function sanitizePermissions(value: unknown): PermissionMap {
  const requested = asPermissionMap(value);
  const result: PermissionMap = {};
  for (const key of CANONICAL_PERMISSION_KEYS) result[key] = requested[key] === true;
  return result;
}

function legacyColumns(permissions: PermissionMap) {
  return {
    can_see_pending_courses: permissions.can_see_pending_courses === true,
    can_validate_course_price: permissions.can_recommend_course_price === true,
    can_reject_course: permissions.can_reject_course === true,
    can_request_course_modification: permissions.can_request_course_modification === true,
    can_approve_transmit_course: permissions.can_approve_transmit_course === true,
    can_create_assisted_course: permissions.can_create_assisted_course === true,
    can_see_learners_list: permissions.can_see_learners_list === true,
    can_see_professors_list: permissions.can_see_professors_list === true,
    can_suspend_account: permissions.can_request_account_suspension === true,
    can_validate_professor_kyc: permissions.can_validate_professor_kyc === true,
    can_validate_establishment_kyc: permissions.can_validate_structure_kyc === true,
    can_moderate_forum: permissions.can_moderate_forum === true,
    can_moderate_jobs: permissions.can_moderate_jobs === true,
    can_manage_support: permissions.can_manage_support === true,
    can_view_ai_conversations: permissions.can_view_ai_conversations === true,
    can_view_analytics: permissions.can_view_analytics === true,
  };
}

async function verifySuperAdmin(sb: SupabaseClient, token: string) {
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
    .eq("role", "super_admin")
    .maybeSingle();
  if (roleError || !role) return null;
  return String(session.user_id);
}

async function savePermissions(sb: SupabaseClient, moderatorId: string, input: unknown) {
  const permissions = sanitizePermissions(input);
  const payload = {
    moderator_user_id: moderatorId,
    permissions,
    permission_version: 2,
    ...legacyColumns(permissions),
  };
  const { error } = await sb.from("moderator_permissions").upsert(payload, { onConflict: "moderator_user_id" });
  if (error) throw error;
  return permissions;
}

async function listModerators(sb: SupabaseClient) {
  const { data: roles, error: rolesError } = await sb.from("user_roles").select("user_id").eq("role", "moderateur");
  if (rolesError) throw rolesError;
  const ids = [...new Set((roles || []).map((row: { user_id: string }) => String(row.user_id)))];
  if (!ids.length) return [];

  const [{ data: users, error: usersError }, { data: permissionRows, error: permissionsError }] = await Promise.all([
    sb.from("users").select("id,full_name,email,status,created_at").in("id", ids).order("created_at", { ascending: false }),
    sb.from("moderator_permissions").select("*").in("moderator_user_id", ids),
  ]);
  if (usersError) throw usersError;
  if (permissionsError) throw permissionsError;

  const permissionMap = new Map((permissionRows || []).map((row: Record<string, unknown>) => [String(row.moderator_user_id), normalizePermissions(row)]));
  return (users || []).map((user: Record<string, unknown>) => {
    const permissions = permissionMap.get(String(user.id)) || sanitizePermissions({});
    return {
      ...user,
      permissions,
      permissions_count: Object.values(permissions).filter(Boolean).length,
    };
  });
}

async function listPendingModeratorInvitations(sb: SupabaseClient) {
  const { data, error } = await sb.from("platform_access_invitations")
    .select("id,email,full_name,permissions,status,created_at,expires_at,target_user_id")
    .eq("invitation_type", "moderator")
    .is("organization_id", null)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

async function listPendingRequests(sb: SupabaseClient) {
  const { data: requests, error } = await sb
    .from("moderator_action_requests")
    .select("id,moderator_id,action_type,target_user_id,reason,status,created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const userIds = [...new Set((requests || []).flatMap((row: Record<string, unknown>) => [row.moderator_id, row.target_user_id]).filter(Boolean).map(String))];
  const { data: users, error: usersError } = userIds.length
    ? await sb.from("users").select("id,full_name,email").in("id", userIds)
    : { data: [], error: null };
  if (usersError) throw usersError;
  const usersById = new Map((users || []).map((user: Record<string, unknown>) => [String(user.id), user]));

  return (requests || []).map((request: Record<string, unknown>) => ({
    ...request,
    moderator: usersById.get(String(request.moderator_id)) || null,
    target_user: usersById.get(String(request.target_user_id)) || null,
  }));
}

async function createModerator(sb: SupabaseClient, adminId: string, body: Record<string, unknown>) {
  const fullName = String(body.full_name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  if (!fullName || !email) return json({ error: "INVALID_PARAMS", message: "Le nom et l’email sont requis." }, 400);

  try {
    const result = await createAccessInvitation(sb, {
      invitationType: "moderator",
      email,
      fullName,
      invitedBy: adminId,
      internalRole: "Modérateur",
      permissions: sanitizePermissions(body.permissions),
      message: String(body.message || "").trim() || null,
    });
    return json({
      success: true,
      invitation_id: result.invitation.id,
      invitation_url: result.invitationUrl,
      email_sent: result.emailSent,
      account_exists: result.accountExists,
      status: "invited",
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : String(error);
    if (code === "PROTECTED_ACCOUNT") return json({ error: code, message: "Ce compte système protégé ne peut pas recevoir une fonction de modération." }, 403);
    if (code === "INVALID_EMAIL") return json({ error: code, message: "L’adresse e-mail est invalide." }, 400);
    throw error;
  }
}

async function ensureTargetNotProtected(sb: SupabaseClient, userId: string) {
  const { data, error } = await sb.from("user_roles").select("role").eq("user_id", userId).eq("role", "super_admin").maybeSingle();
  if (error) throw error;
  if (data) throw new Error("PROTECTED_ACCOUNT");
}

async function reviewRequest(sb: SupabaseClient, adminId: string, body: Record<string, unknown>) {
  const requestId = String(body.request_id || "");
  const approve = body.approve === true;
  if (!requestId) return json({ error: "INVALID_PARAMS" }, 400);

  const { data: request, error } = await sb
    .from("moderator_action_requests")
    .select("id,moderator_id,action_type,target_user_id,reason,status")
    .eq("id", requestId)
    .maybeSingle();
  if (error) throw error;
  if (!request) return json({ error: "REQUEST_NOT_FOUND" }, 404);
  if (request.status !== "pending") return json({ error: "REQUEST_ALREADY_REVIEWED" }, 409);

  const now = new Date().toISOString();
  if (approve) {
    const { data: targetRoles, error: targetRolesError } = await sb.from("user_roles").select("role").eq("user_id", request.target_user_id);
    if (targetRolesError) throw targetRolesError;
    if ((targetRoles || []).some((row: { role: string }) => ["super_admin", "moderateur"].includes(row.role))) {
      return json({ error: "PROTECTED_ACCOUNT", message: "Action interdite sur un compte protégé." }, 403);
    }

    if (request.action_type === "suspend") {
      const { error: updateError } = await sb.from("users").update({ status: "suspendu" }).eq("id", request.target_user_id);
      if (updateError) throw updateError;
      const { error: sessionError } = await sb.from("user_sessions").update({ expires_at: now }).eq("user_id", request.target_user_id);
      if (sessionError) throw sessionError;
    } else if (request.action_type === "reactivate" || request.action_type === "validate_kyc") {
      const { error: updateError } = await sb.from("users").update({ status: "actif" }).eq("id", request.target_user_id);
      if (updateError) throw updateError;
    } else {
      return json({ error: "INVALID_REQUEST_ACTION" }, 400);
    }
  }

  const { error: reviewError } = await sb.from("moderator_action_requests").update({
    status: approve ? "approved" : "rejected",
    reviewed_by: adminId,
    reviewed_at: now,
  }).eq("id", requestId).eq("status", "pending");
  if (reviewError) throw reviewError;

  const { error: logError } = await sb.from("moderation_log").insert({
    moderator_id: request.moderator_id,
    action_type: approve ? `request_${request.action_type}_approved` : `request_${request.action_type}_rejected`,
    target_type: "user",
    target_id: request.target_user_id,
    comment: `${request.reason || ""} | reviewed_by:${adminId}`,
  });
  if (logError) console.error("admin-moderator-manage: moderation log failed", logError.message);

  return json({ success: true });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  const requestUrl = new URL(req.url);
  const requestedAction = requestUrl.searchParams.get("action") || (req.method === "GET" ? "list" : "");
  if (req.method === "GET" && requestedAction === "health") {
    return json({ success: true, service: "admin-moderator-manage", status: "available", timestamp: new Date().toISOString() });
  }
  if (!["GET", "POST"].includes(req.method)) return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const token = (req.headers.get("x-omnia-session-token") || req.headers.get("Authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const url = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!url || !serviceKey) return json({ error: "SERVER_CONFIG_ERROR", message: "Configuration Supabase incomplète pour Équipe & Modérateurs." }, 500);
    const sb = createClient(url, serviceKey);
    const adminId = await verifySuperAdmin(sb, token);
    if (!adminId) return json({ error: "FORBIDDEN", message: "Session d’administration invalide ou expirée." }, 403);

    const action = requestedAction;

    if (req.method === "GET") {
      if (action === "list") return json({ moderators: await listModerators(sb) });
      if (action === "requests") return json({ requests: await listPendingRequests(sb) });
      if (action === "overview") {
        const [moderators, requests, invitations] = await Promise.all([
          listModerators(sb),
          listPendingRequests(sb),
          listPendingModeratorInvitations(sb),
        ]);
        return json({ success: true, moderators, requests, invitations });
      }
      return json({ error: "UNKNOWN_ACTION", action }, 400);
    }

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    if (action === "create") return await createModerator(sb, adminId, body);

    if (action === "revoke_invitation") {
      const invitationId = String(body.invitation_id || "");
      if (!invitationId) return json({ error: "INVALID_PARAMS" }, 400);
      const { data: invitation, error: invitationError } = await sb.from("platform_access_invitations")
        .select("id,status")
        .eq("id", invitationId)
        .eq("invitation_type", "moderator")
        .is("organization_id", null)
        .maybeSingle();
      if (invitationError) throw invitationError;
      if (!invitation) return json({ error: "INVITATION_NOT_FOUND" }, 404);
      if (invitation.status !== "pending") return json({ error: "INVITATION_NOT_PENDING" }, 409);
      const { error: revokeError } = await sb.from("platform_access_invitations")
        .update({ status: "revoked", updated_at: new Date().toISOString() })
        .eq("id", invitationId)
        .eq("status", "pending");
      if (revokeError) throw revokeError;
      return json({ success: true });
    }

    if (action === "update") {
      const moderatorId = String(body.moderator_id || "");
      if (!moderatorId || body.action !== "update_permissions") return json({ error: "INVALID_PARAMS" }, 400);
      try { await ensureTargetNotProtected(sb, moderatorId); } catch { return json({ error: "PROTECTED_ACCOUNT" }, 403); }
      const permissions = await savePermissions(sb, moderatorId, body.permissions);
      return json({ success: true, permissions });
    }

    if (action === "delete") {
      const userId = String(body.user_id || "");
      if (!userId) return json({ error: "INVALID_PARAMS" }, 400);
      try { await ensureTargetNotProtected(sb, userId); } catch { return json({ error: "PROTECTED_ACCOUNT" }, 403); }
      const now = new Date().toISOString();
      const [{ error: roleError }, { error: permissionError }, { error: sessionError }] = await Promise.all([
        sb.from("user_roles").delete().eq("user_id", userId).eq("role", "moderateur"),
        sb.from("moderator_permissions").delete().eq("moderator_user_id", userId),
        sb.from("user_sessions").update({ expires_at: now }).eq("user_id", userId),
      ]);
      if (roleError) throw roleError;
      if (permissionError) throw permissionError;
      if (sessionError) throw sessionError;
      return json({ success: true });
    }

    if (action === "review_request") return await reviewRequest(sb, adminId, body);
    return json({ error: "UNKNOWN_ACTION", action }, 400);
  } catch (error) {
    console.error("admin-moderator-manage", error);
    return json({ error: "SERVER_ERROR", message: error instanceof Error ? error.message : String(error) }, 500);
  }
});
