export const MODERATOR_PERMISSION_KEYS = [
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

export type ModeratorPermissionKey = typeof MODERATOR_PERMISSION_KEYS[number];
export type PermissionMap = Record<string, boolean>;
type Client = any;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function sanitizeModeratorPermissions(value: unknown): PermissionMap {
  const source = record(value);
  const result: PermissionMap = {};
  for (const key of MODERATOR_PERMISSION_KEYS) result[key] = source[key] === true;
  return result;
}

export function normalizeModeratorPermissions(row: Record<string, unknown> | null | undefined): PermissionMap {
  const source = row || {};
  const nested = record(source.permissions);
  const merged: PermissionMap = {};
  for (const [key, value] of Object.entries(source)) {
    if (key.startsWith("can_") && typeof value === "boolean") merged[key] = value;
  }
  for (const [key, value] of Object.entries(nested)) {
    if (key.startsWith("can_")) merged[key] = value === true;
  }
  merged.can_recommend_course_price = merged.can_recommend_course_price === true || merged.can_validate_course_price === true;
  merged.can_approve_transmit_course = merged.can_approve_transmit_course === true || merged.can_transmit_course_to_admin === true;
  merged.can_validate_structure_kyc = merged.can_validate_structure_kyc === true || merged.can_validate_establishment_kyc === true;
  merged.can_request_account_suspension = merged.can_request_account_suspension === true || merged.can_suspend_account === true;
  return sanitizeModeratorPermissions(merged);
}

export function legacyModeratorPermissionColumns(permissions: PermissionMap) {
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

export async function getModeratorAccess(sb: Client, moderatorUserId: string) {
  const now = new Date().toISOString();
  const [{ data: role, error: roleError }, { data: profile, error: profileError }, { data: permissionsRow, error: permissionsError }, { data: delegations, error: delegationsError }] = await Promise.all([
    sb.from("user_roles").select("role").eq("user_id", moderatorUserId).eq("role", "moderateur").maybeSingle(),
    sb.from("moderator_team_profiles").select("moderator_user_id,internal_title,team_area,status,joined_at,primary_mission").eq("moderator_user_id", moderatorUserId).maybeSingle(),
    sb.from("moderator_permissions").select("*").eq("moderator_user_id", moderatorUserId).maybeSingle(),
    sb.from("moderator_delegations")
      .select("id,permissions,reason,starts_at,expires_at,status")
      .eq("moderator_user_id", moderatorUserId)
      .eq("status", "active")
      .lte("starts_at", now)
      .gt("expires_at", now)
      .order("expires_at", { ascending: true }),
  ]);
  if (roleError) throw roleError;
  if (profileError) throw profileError;
  if (permissionsError) throw permissionsError;
  if (delegationsError) throw delegationsError;

  const permanentPermissions = normalizeModeratorPermissions(permissionsRow as Record<string, unknown> | null);
  const effectivePermissions = { ...permanentPermissions };
  for (const delegation of delegations || []) {
    const delegated = sanitizeModeratorPermissions(delegation.permissions);
    for (const key of MODERATOR_PERMISSION_KEYS) {
      if (delegated[key]) effectivePermissions[key] = true;
    }
  }

  const teamStatus = String(profile?.status || "active");
  const active = !!role && teamStatus === "active";
  if (!active) {
    for (const key of MODERATOR_PERMISSION_KEYS) effectivePermissions[key] = false;
  }

  return {
    active,
    profile: profile || null,
    permanentPermissions,
    permissions: effectivePermissions,
    delegations: delegations || [],
  };
}

export async function hasModeratorConflict(
  sb: Client,
  moderatorUserId: string,
  targetType: string,
  targetId: string,
  ownerUserIds: Array<string | null | undefined> = [],
) {
  if (ownerUserIds.some(value => value && String(value) === moderatorUserId)) return true;
  const { data, error } = await sb.from("moderator_conflicts")
    .select("id")
    .eq("moderator_user_id", moderatorUserId)
    .eq("target_type", targetType)
    .eq("target_id", String(targetId))
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function appendModeratorTeamAudit(
  sb: Client,
  actorUserId: string,
  moderatorUserId: string | null,
  action: string,
  reason?: string | null,
  metadata: Record<string, unknown> = {},
) {
  const { error } = await sb.from("moderator_team_audit").insert({
    actor_user_id: actorUserId,
    moderator_user_id: moderatorUserId,
    action,
    reason: String(reason || "").trim() || null,
    metadata,
  });
  if (error) throw error;
}
