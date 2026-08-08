import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { createAccessInvitation } from "../_shared/access-invitations.ts";
import { sendOmniaEmail } from "../_shared/brevo-mail.ts";
import {
  MODERATOR_PERMISSION_KEYS,
  appendModeratorTeamAudit,
  legacyModeratorPermissionColumns,
  normalizeModeratorPermissions,
  sanitizeModeratorPermissions,
} from "../_shared/moderator-access.ts";

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

function text(value: unknown, max = 1000) {
  return String(value ?? "").trim().slice(0, max);
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

async function ensureTargetNotProtected(sb: SupabaseClient, userId: string) {
  const { data, error } = await sb.from("user_roles").select("role").eq("user_id", userId).eq("role", "super_admin").maybeSingle();
  if (error) throw error;
  if (data) throw new Error("PROTECTED_ACCOUNT");
}

async function ensureModerator(sb: SupabaseClient, userId: string) {
  await ensureTargetNotProtected(sb, userId);
  const { data, error } = await sb.from("user_roles").select("role").eq("user_id", userId).eq("role", "moderateur").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("MODERATOR_NOT_FOUND");
}

async function savePermissions(sb: SupabaseClient, adminId: string, moderatorId: string, input: unknown, reason?: string) {
  const permissions = sanitizeModeratorPermissions(input);
  const { data: currentRow, error: currentError } = await sb.from("moderator_permissions").select("*").eq("moderator_user_id", moderatorId).maybeSingle();
  if (currentError) throw currentError;
  const before = normalizeModeratorPermissions(currentRow as Record<string, unknown> | null);
  const payload = {
    moderator_user_id: moderatorId,
    permissions,
    permission_version: 4,
    updated_by: adminId,
    updated_at: new Date().toISOString(),
    ...legacyModeratorPermissionColumns(permissions),
  };
  const { error } = await sb.from("moderator_permissions").upsert(payload, { onConflict: "moderator_user_id" });
  if (error) throw error;

  const added = MODERATOR_PERMISSION_KEYS.filter(key => !before[key] && permissions[key]);
  const removed = MODERATOR_PERMISSION_KEYS.filter(key => before[key] && !permissions[key]);
  if (added.length || removed.length) {
    await appendModeratorTeamAudit(sb, adminId, moderatorId, "permissions_updated", reason || null, { added, removed });
  }
  return permissions;
}

async function listModerators(sb: SupabaseClient) {
  const { data: roles, error: rolesError } = await sb.from("user_roles").select("user_id,granted_at").eq("role", "moderateur");
  if (rolesError) throw rolesError;
  const ids = [...new Set((roles || []).map((row: { user_id: string }) => String(row.user_id)))];
  if (!ids.length) return [];

  const [usersResult, permissionsResult, profilesResult, missionsResult, delegationsResult, conflictsResult] = await Promise.all([
    sb.from("users").select("id,full_name,email,status,created_at,last_login_at").in("id", ids).order("created_at", { ascending: false }),
    sb.from("moderator_permissions").select("*").in("moderator_user_id", ids),
    sb.from("moderator_team_profiles").select("*").in("moderator_user_id", ids),
    sb.from("moderator_missions").select("id,moderator_user_id,title,description,domain,priority,status,starts_at,due_at,completed_at,assigned_by,created_at,updated_at").in("moderator_user_id", ids).order("created_at", { ascending: false }),
    sb.from("moderator_delegations").select("id,moderator_user_id,permissions,reason,starts_at,expires_at,status,granted_by,revoked_by,revoked_at,created_at").in("moderator_user_id", ids).order("created_at", { ascending: false }),
    sb.from("moderator_conflicts").select("id,moderator_user_id,target_type,target_id,reason,status,declared_by,resolved_by,resolved_at,resolution_note,created_at").in("moderator_user_id", ids).order("created_at", { ascending: false }),
  ]);
  for (const result of [usersResult, permissionsResult, profilesResult, missionsResult, delegationsResult, conflictsResult]) {
    if (result.error) throw result.error;
  }

  const permissionMap = new Map((permissionsResult.data || []).map((row: Record<string, unknown>) => [String(row.moderator_user_id), normalizeModeratorPermissions(row)]));
  const profileMap = new Map((profilesResult.data || []).map((row: Record<string, unknown>) => [String(row.moderator_user_id), row]));
  const byModerator = <T extends Record<string, unknown>>(rows: T[]) => {
    const map = new Map<string, T[]>();
    for (const row of rows) {
      const id = String(row.moderator_user_id || "");
      map.set(id, [...(map.get(id) || []), row]);
    }
    return map;
  };
  const missions = byModerator((missionsResult.data || []) as Record<string, unknown>[]);
  const delegations = byModerator((delegationsResult.data || []) as Record<string, unknown>[]);
  const conflicts = byModerator((conflictsResult.data || []) as Record<string, unknown>[]);

  return (usersResult.data || []).map((user: Record<string, unknown>) => {
    const id = String(user.id);
    const permissions = permissionMap.get(id) || sanitizeModeratorPermissions({});
    return {
      ...user,
      permissions,
      permissions_count: Object.values(permissions).filter(Boolean).length,
      team_profile: profileMap.get(id) || null,
      missions: missions.get(id) || [],
      delegations: delegations.get(id) || [],
      conflicts: conflicts.get(id) || [],
    };
  });
}

async function listPendingModeratorInvitations(sb: SupabaseClient) {
  const { data, error } = await sb.from("platform_access_invitations")
    .select("id,email,full_name,internal_role,permissions,message,status,created_at,expires_at,target_user_id")
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

async function listTeamAudit(sb: SupabaseClient) {
  const { data, error } = await sb.from("moderator_team_audit")
    .select("id,actor_user_id,moderator_user_id,action,reason,metadata,created_at")
    .order("created_at", { ascending: false })
    .limit(120);
  if (error) throw error;
  return data || [];
}


async function listReviewRecommendations(sb: SupabaseClient) {
  const { data, error } = await sb.from("moderator_review_recommendations")
    .select("id,moderator_user_id,permission_key,target_type,target_id,recommendation,note,status,reviewed_by,reviewed_at,created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(150);
  if (error) throw error;
  const moderatorIds = [...new Set((data ?? []).map((row: Record<string, unknown>) => String(row.moderator_user_id || "")).filter(Boolean))];
  const { data: users, error: usersError } = moderatorIds.length
    ? await sb.from("users").select("id,full_name,email").in("id", moderatorIds)
    : { data: [], error: null };
  if (usersError) throw usersError;
  const byId = new Map((users ?? []).map((row: Record<string, unknown>) => [String(row.id), row]));
  return (data ?? []).map((row: Record<string, unknown>) => ({ ...row, moderator: byId.get(String(row.moderator_user_id)) || null }));
}

async function createModerator(sb: SupabaseClient, adminId: string, body: Record<string, unknown>) {
  const fullName = text(body.full_name, 160);
  const email = text(body.email, 320).toLowerCase();
  const internalTitle = text(body.internal_title, 120) || "Modérateur";
  if (!fullName || !email) return json({ error: "INVALID_PARAMS", message: "Le nom et l’email sont requis." }, 400);

  try {
    const permissions = sanitizeModeratorPermissions(body.permissions);
    const result = await createAccessInvitation(sb, {
      invitationType: "moderator",
      email,
      fullName,
      invitedBy: adminId,
      internalRole: internalTitle,
      permissions,
      message: text(body.message, 1000) || null,
    });
    await appendModeratorTeamAudit(sb, adminId, result.invitation.target_user_id || null, "invitation_created", null, {
      invitation_id: result.invitation.id,
      email,
      full_name: fullName,
      internal_title: internalTitle,
      permissions,
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

async function reviewRequest(sb: SupabaseClient, adminId: string, body: Record<string, unknown>) {
  const requestId = text(body.request_id, 80);
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
      await sb.from("admin_user_account_audit").insert({ actor_user_id: adminId, target_user_id: request.target_user_id, action: "account_suspended", reason: request.reason, metadata: { moderator_request_id: request.id } });
    } else if (request.action_type === "reactivate") {
      const { error: updateError } = await sb.from("users").update({ status: "actif" }).eq("id", request.target_user_id);
      if (updateError) throw updateError;
      await sb.from("admin_user_account_audit").insert({ actor_user_id: adminId, target_user_id: request.target_user_id, action: "account_reactivated", reason: request.reason, metadata: { moderator_request_id: request.id } });
    } else if (["validate_kyc", "kyc_approve"].includes(String(request.action_type))) {
      const { error: kycError } = await sb.from("professeur_profiles").update({ kyc_status: "valide", kyc_validated_by: adminId, kyc_validated_at: now, kyc_rejection_reason: null }).eq("user_id", request.target_user_id);
      if (kycError) throw kycError;
      const { error: userError } = await sb.from("users").update({ status: "actif", updated_at: now }).eq("id", request.target_user_id);
      if (userError) throw userError;
      const { data: approvedUser } = await sb.from("users").select("email,full_name").eq("id", request.target_user_id).maybeSingle();
      if (approvedUser?.email) {
        await sendOmniaEmail({
          sb,
          userId: String(request.target_user_id),
          to: { email: String(approvedUser.email), name: approvedUser.full_name || undefined },
          templateKey: "professor_approved",
          params: {
            FIRST_NAME: String(approvedUser.full_name || "").split(" ")[0],
            DASHBOARD_URL: `${(Deno.env.get("APP_URL") || "https://omniaglobalacademy.com").replace(/\/$/, "")}/professeur/dashboard`,
          },
        });
      }
    } else if (request.action_type === "kyc_reject") {
      const { error: kycError } = await sb.from("professeur_profiles").update({ kyc_status: "rejete", kyc_validated_by: adminId, kyc_validated_at: now, kyc_rejection_reason: request.reason }).eq("user_id", request.target_user_id);
      if (kycError) throw kycError;
      const { error: userError } = await sb.from("users").update({ status: "en_attente_validation", updated_at: now }).eq("id", request.target_user_id);
      if (userError) throw userError;
      const { data: rejectedUser } = await sb.from("users").select("email,full_name").eq("id", request.target_user_id).maybeSingle();
      if (rejectedUser?.email) {
        await sendOmniaEmail({
          sb,
          userId: String(request.target_user_id),
          to: { email: String(rejectedUser.email), name: rejectedUser.full_name || undefined },
          templateKey: "status_update",
          params: {
            SUBJECT: "Mise à jour de votre dossier Professeur",
            FIRST_NAME: String(rejectedUser.full_name || "").split(" ")[0],
            MESSAGE: "Votre dossier Professeur nécessite une nouvelle étape avant activation.",
            STATUS_LABEL: "Dossier non validé",
            ADDITIONAL_INFORMATION: request.reason || "Consultez les informations communiquées par l’Administration Omnia.",
            CTA_LABEL: "Se connecter à Omnia",
            CTA_URL: `${(Deno.env.get("APP_URL") || "https://omniaglobalacademy.com").replace(/\/$/, "")}/connexion`,
          },
        });
      }
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
  await appendModeratorTeamAudit(sb, adminId, String(request.moderator_id), "moderator_request_reviewed", request.reason, {
    request_id: request.id,
    request_action: request.action_type,
    decision: approve ? "approved" : "rejected",
    target_user_id: request.target_user_id,
  });

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
        const [moderators, requests, invitations, audit, recommendations] = await Promise.all([
          listModerators(sb),
          listPendingRequests(sb),
          listPendingModeratorInvitations(sb),
          listTeamAudit(sb),
          listReviewRecommendations(sb),
        ]);
        return json({ success: true, moderators, requests, invitations, audit, recommendations });
      }
      return json({ error: "UNKNOWN_ACTION", action }, 400);
    }

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    if (action === "create") return await createModerator(sb, adminId, body);

    if (action === "revoke_invitation") {
      const invitationId = text(body.invitation_id, 80);
      if (!invitationId) return json({ error: "INVALID_PARAMS" }, 400);
      const { data: invitation, error: invitationError } = await sb.from("platform_access_invitations")
        .select("id,status,email,target_user_id,internal_role")
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
      await appendModeratorTeamAudit(sb, adminId, invitation.target_user_id || null, "invitation_revoked", null, { invitation_id: invitation.id, email: invitation.email, internal_title: invitation.internal_role });
      return json({ success: true });
    }

    if (action === "update_permissions") {
      const moderatorId = text(body.moderator_id, 80);
      if (!moderatorId) return json({ error: "INVALID_PARAMS" }, 400);
      await ensureModerator(sb, moderatorId);
      const permissions = await savePermissions(sb, adminId, moderatorId, body.permissions, text(body.reason, 600));
      return json({ success: true, permissions });
    }

    // Compatibilité avec l'ancien appel action=update + body.action=update_permissions.
    if (action === "update" && body.action === "update_permissions") {
      const moderatorId = text(body.moderator_id, 80);
      if (!moderatorId) return json({ error: "INVALID_PARAMS" }, 400);
      await ensureModerator(sb, moderatorId);
      const permissions = await savePermissions(sb, adminId, moderatorId, body.permissions, text(body.reason, 600));
      return json({ success: true, permissions });
    }

    if (action === "update_profile") {
      const moderatorId = text(body.moderator_id, 80);
      if (!moderatorId) return json({ error: "INVALID_PARAMS" }, 400);
      await ensureModerator(sb, moderatorId);
      const payload = {
        moderator_user_id: moderatorId,
        internal_title: text(body.internal_title, 120) || "Modérateur",
        team_area: text(body.team_area, 120) || null,
        primary_mission: text(body.primary_mission, 1000) || null,
        admin_notes: text(body.admin_notes, 3000) || null,
        updated_by: adminId,
        updated_at: new Date().toISOString(),
      };
      const { error } = await sb.from("moderator_team_profiles").upsert(payload, { onConflict: "moderator_user_id" });
      if (error) throw error;
      await appendModeratorTeamAudit(sb, adminId, moderatorId, "profile_updated", text(body.reason, 600) || null, { internal_title: payload.internal_title, team_area: payload.team_area, primary_mission: payload.primary_mission });
      return json({ success: true });
    }

    if (action === "set_member_status") {
      const moderatorId = text(body.moderator_id, 80);
      const status = text(body.status, 30);
      const reason = text(body.reason, 1000);
      if (!moderatorId || !["active", "suspended"].includes(status) || reason.length < 3) return json({ error: "INVALID_PARAMS", message: "Statut et motif requis." }, 400);
      await ensureModerator(sb, moderatorId);
      const now = new Date().toISOString();
      const { error } = await sb.from("moderator_team_profiles").update({ status, updated_by: adminId, updated_at: now }).eq("moderator_user_id", moderatorId);
      if (error) throw error;
      if (status === "suspended") {
        const { error: sessionError } = await sb.from("user_sessions").update({ expires_at: now }).eq("user_id", moderatorId);
        if (sessionError) throw sessionError;
      }
      await appendModeratorTeamAudit(sb, adminId, moderatorId, status === "active" ? "member_reactivated" : "member_suspended", reason);
      return json({ success: true });
    }

    if (action === "create_mission") {
      const moderatorId = text(body.moderator_id, 80);
      const title = text(body.title, 180);
      if (!moderatorId || title.length < 2) return json({ error: "INVALID_PARAMS", message: "Membre et titre de mission requis." }, 400);
      await ensureModerator(sb, moderatorId);
      const priority = ["low", "normal", "high", "urgent"].includes(text(body.priority, 20)) ? text(body.priority, 20) : "normal";
      const startsAt = text(body.starts_at, 60) || new Date().toISOString();
      const dueAt = text(body.due_at, 60) || null;
      const { data: mission, error } = await sb.from("moderator_missions").insert({
        moderator_user_id: moderatorId,
        title,
        description: text(body.description, 3000) || null,
        domain: text(body.domain, 120) || null,
        priority,
        status: "todo",
        starts_at: startsAt,
        due_at: dueAt,
        assigned_by: adminId,
      }).select("*").single();
      if (error) throw error;
      await appendModeratorTeamAudit(sb, adminId, moderatorId, "mission_created", text(body.reason, 600) || null, { mission_id: mission.id, title, priority, due_at: dueAt });
      return json({ success: true, mission });
    }

    if (action === "update_mission") {
      const missionId = text(body.mission_id, 80);
      const status = text(body.status, 30);
      if (!missionId || !["todo", "in_progress", "completed", "cancelled"].includes(status)) return json({ error: "INVALID_PARAMS" }, 400);
      const { data: mission, error: missionError } = await sb.from("moderator_missions").select("id,moderator_user_id,title,status").eq("id", missionId).maybeSingle();
      if (missionError) throw missionError;
      if (!mission) return json({ error: "MISSION_NOT_FOUND" }, 404);
      await ensureModerator(sb, String(mission.moderator_user_id));
      const now = new Date().toISOString();
      const { error } = await sb.from("moderator_missions").update({ status, completed_at: status === "completed" ? now : null, updated_at: now }).eq("id", missionId);
      if (error) throw error;
      await appendModeratorTeamAudit(sb, adminId, String(mission.moderator_user_id), "mission_status_updated", text(body.reason, 600) || null, { mission_id: missionId, title: mission.title, from: mission.status, to: status });
      return json({ success: true });
    }

    if (action === "create_delegation") {
      const moderatorId = text(body.moderator_id, 80);
      const reason = text(body.reason, 1000);
      const permissions = sanitizeModeratorPermissions(body.permissions);
      const enabled = MODERATOR_PERMISSION_KEYS.filter(key => permissions[key]);
      const startsAt = text(body.starts_at, 60) || new Date().toISOString();
      const expiresAt = text(body.expires_at, 60);
      if (!moderatorId || reason.length < 3 || !expiresAt || !enabled.length || Date.parse(expiresAt) <= Date.parse(startsAt)) {
        return json({ error: "INVALID_PARAMS", message: "Permission(s), motif et période valide sont requis." }, 400);
      }
      await ensureModerator(sb, moderatorId);
      const { data: delegation, error } = await sb.from("moderator_delegations").insert({
        moderator_user_id: moderatorId,
        permissions,
        reason,
        starts_at: startsAt,
        expires_at: expiresAt,
        status: "active",
        granted_by: adminId,
      }).select("*").single();
      if (error) throw error;
      await appendModeratorTeamAudit(sb, adminId, moderatorId, "delegation_created", reason, { delegation_id: delegation.id, permissions: enabled, starts_at: startsAt, expires_at: expiresAt });
      return json({ success: true, delegation });
    }

    if (action === "revoke_delegation") {
      const delegationId = text(body.delegation_id, 80);
      const reason = text(body.reason, 1000);
      if (!delegationId || reason.length < 3) return json({ error: "INVALID_PARAMS", message: "Motif requis." }, 400);
      const { data: delegation, error: fetchError } = await sb.from("moderator_delegations").select("id,moderator_user_id,status").eq("id", delegationId).maybeSingle();
      if (fetchError) throw fetchError;
      if (!delegation) return json({ error: "DELEGATION_NOT_FOUND" }, 404);
      if (delegation.status !== "active") return json({ error: "DELEGATION_NOT_ACTIVE" }, 409);
      const now = new Date().toISOString();
      const { error } = await sb.from("moderator_delegations").update({ status: "revoked", revoked_by: adminId, revoked_at: now, updated_at: now }).eq("id", delegationId).eq("status", "active");
      if (error) throw error;
      await appendModeratorTeamAudit(sb, adminId, String(delegation.moderator_user_id), "delegation_revoked", reason, { delegation_id: delegationId });
      return json({ success: true });
    }

    if (action === "resolve_conflict") {
      const conflictId = text(body.conflict_id, 80);
      const note = text(body.resolution_note, 2000);
      if (!conflictId || note.length < 3) return json({ error: "INVALID_PARAMS", message: "Note de résolution requise." }, 400);
      const { data: conflict, error: fetchError } = await sb.from("moderator_conflicts").select("id,moderator_user_id,status,target_type,target_id").eq("id", conflictId).maybeSingle();
      if (fetchError) throw fetchError;
      if (!conflict) return json({ error: "CONFLICT_NOT_FOUND" }, 404);
      if (conflict.status !== "active") return json({ error: "CONFLICT_ALREADY_RESOLVED" }, 409);
      const now = new Date().toISOString();
      const { error } = await sb.from("moderator_conflicts").update({ status: "resolved", resolved_by: adminId, resolved_at: now, resolution_note: note, updated_at: now }).eq("id", conflictId).eq("status", "active");
      if (error) throw error;
      await appendModeratorTeamAudit(sb, adminId, String(conflict.moderator_user_id), "conflict_resolved", note, { conflict_id: conflictId, target_type: conflict.target_type, target_id: conflict.target_id });
      return json({ success: true });
    }

    if (action === "delete") {
      const userId = text(body.user_id, 80);
      const reason = text(body.reason, 1000) || "Fin de fonction décidée par l’Administration Omnia";
      if (!userId) return json({ error: "INVALID_PARAMS" }, 400);
      await ensureModerator(sb, userId);
      const now = new Date().toISOString();
      const [
        { error: roleError }, { error: permissionError }, { error: sessionError }, { error: profileError },
        { error: delegationError }, { error: missionError }, { error: conflictError },
      ] = await Promise.all([
        sb.from("user_roles").delete().eq("user_id", userId).eq("role", "moderateur"),
        sb.from("moderator_permissions").delete().eq("moderator_user_id", userId),
        sb.from("user_sessions").update({ expires_at: now }).eq("user_id", userId),
        sb.from("moderator_team_profiles").update({ status: "ended", updated_by: adminId, updated_at: now }).eq("moderator_user_id", userId),
        sb.from("moderator_delegations").update({ status: "revoked", revoked_by: adminId, revoked_at: now, updated_at: now }).eq("moderator_user_id", userId).eq("status", "active"),
        sb.from("moderator_missions").update({ status: "cancelled", updated_at: now }).eq("moderator_user_id", userId).in("status", ["todo", "in_progress"]),
        sb.from("moderator_conflicts").update({ status: "resolved", resolved_by: adminId, resolved_at: now, resolution_note: "Clôturé automatiquement lors de la fin de fonction.", updated_at: now }).eq("moderator_user_id", userId).eq("status", "active"),
      ]);
      for (const error of [roleError, permissionError, sessionError, profileError, delegationError, missionError, conflictError]) if (error) throw error;
      await appendModeratorTeamAudit(sb, adminId, userId, "member_ended", reason);
      return json({ success: true });
    }

    if (action === "review_recommendation") {
      const recommendationId = text(body.recommendation_id, 80);
      const status = text(body.status, 30);
      const note = text(body.note, 1200);
      if (!recommendationId || !["reviewed", "dismissed"].includes(status)) return json({ error: "INVALID_PARAMS" }, 400);
      const { data: recommendation, error: recommendationError } = await sb.from("moderator_review_recommendations")
        .select("id,moderator_user_id,target_type,target_id,recommendation,status")
        .eq("id", recommendationId).maybeSingle();
      if (recommendationError) throw recommendationError;
      if (!recommendation) return json({ error: "RECOMMENDATION_NOT_FOUND" }, 404);
      if (recommendation.status !== "pending") return json({ error: "RECOMMENDATION_ALREADY_REVIEWED" }, 409);
      const now = new Date().toISOString();
      const { error } = await sb.from("moderator_review_recommendations").update({ status, reviewed_by: adminId, reviewed_at: now, updated_at: now }).eq("id", recommendationId).eq("status", "pending");
      if (error) throw error;
      await appendModeratorTeamAudit(sb, adminId, String(recommendation.moderator_user_id), "review_recommendation_reviewed", note || null, {
        recommendation_id: recommendationId, target_type: recommendation.target_type, target_id: recommendation.target_id,
        moderator_recommendation: recommendation.recommendation, admin_review_status: status,
      });
      return json({ success: true });
    }

    if (action === "review_request") return await reviewRequest(sb, adminId, body);
    return json({ error: "UNKNOWN_ACTION", action }, 400);
  } catch (error) {
    const code = error instanceof Error ? error.message : String(error);
    if (code === "PROTECTED_ACCOUNT") return json({ error: code, message: "Le compte Super-admin protégé ne peut pas être modifié depuis Équipe & Modérateurs." }, 403);
    if (code === "MODERATOR_NOT_FOUND") return json({ error: code, message: "Ce membre n’est plus un modérateur actif." }, 404);
    console.error("admin-moderator-manage", error);
    return json({ error: "SERVER_ERROR", message: code }, 500);
  }
});
