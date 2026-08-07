import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { hashSync } from "npm:bcryptjs@2.4.3";
import { appendModeratorTeamAudit } from "../_shared/moderator-access.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function clean(value: unknown, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
}

async function verifySuperAdmin(sb: any, token: string) {
  const { data: session } = await sb
    .from("user_sessions")
    .select("user_id")
    .eq("session_token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!session) return null;

  const { data: role } = await sb
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user_id)
    .eq("role", "super_admin")
    .maybeSingle();

  return role ? String(session.user_id) : null;
}

const DEMO_EMAIL = "test@omniaglobalacademy.com";
const ALL_DEMO_ROLES = ["apprenant", "professeur", "responsable_structure", "moderateur"];
const LEGACY_ROLE_MAP: Record<string, string> = { etablissement_directeur: "responsable_structure" };

async function appendAudit(
  sb: any,
  actorUserId: string,
  accessType: string,
  sourceId: string | null,
  action: string,
  options: {
    targetUserId?: string | null;
    organizationId?: string | null;
    reason?: string | null;
    metadata?: Record<string, unknown>;
  } = {},
) {
  const { error } = await sb.from("special_access_audit").insert({
    actor_user_id: actorUserId,
    target_user_id: options.targetUserId || null,
    organization_id: options.organizationId || null,
    access_type: accessType,
    source_id: sourceId,
    action,
    reason: clean(options.reason, 3000) || null,
    metadata: options.metadata || {},
  });
  if (error) throw error;
}

async function recordException(
  sb: any,
  adminId: string,
  sourceType: "professional_invitation" | "moderator_delegation" | "jury_external",
  sourceId: string,
  previousExpiresAt: string | null,
  newExpiresAt: string,
  reason: string,
  metadata: Record<string, unknown> = {},
) {
  const action = previousExpiresAt && Date.parse(previousExpiresAt) <= Date.now() ? "reactivate" : "extend";
  const { error } = await sb.from("special_access_admin_exceptions").insert({
    source_type: sourceType,
    source_id: sourceId,
    action,
    previous_expires_at: previousExpiresAt,
    new_expires_at: newExpiresAt,
    reason,
    created_by: adminId,
    metadata,
  });
  if (error) throw error;
  return action;
}

async function userDirectory(sb: any, ids: string[]) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (!uniqueIds.length) return {} as Record<string, { full_name: string | null; email: string | null }>;
  const { data, error } = await sb.from("users").select("id,full_name,email").in("id", uniqueIds);
  if (error) throw error;
  return Object.fromEntries((data || []).map((row: any) => [String(row.id), { full_name: row.full_name || null, email: row.email || null }]));
}

async function loadOverview(sb: any) {
  const nowIso = new Date().toISOString();
  const [
    configResult,
    coursesResult,
    invitationResult,
    delegationResult,
    juryResult,
    structureResult,
    b2bResult,
    exceptionsResult,
    auditResult,
  ] = await Promise.all([
    sb.from("demo_account_config")
      .select("id,expires_at,is_online,last_seen_at,configured_at,configured_by,demo_roles,demo_course_ids,revoked_at,revoked_by,revoke_reason")
      .order("configured_at", { ascending: false }).limit(10),
    sb.from("courses").select("id,title").eq("is_published", true).order("title").limit(500),
    sb.from("platform_access_invitations")
      .select("id,invitation_type,email,full_name,organization_id,target_user_id,invited_by,internal_role,status,expires_at,accepted_at,created_at,updated_at")
      .order("created_at", { ascending: false }).limit(150),
    sb.from("moderator_delegations")
      .select("id,moderator_user_id,permissions,reason,starts_at,expires_at,status,granted_by,revoked_by,revoked_at,created_at,updated_at")
      .order("created_at", { ascending: false }).limit(150),
    sb.from("assessment_jury_members")
      .select("id,panel_id,expert_id,user_id,external_email,external_name,member_role,status,permissions,invite_expires_at,validated_by,validated_at,created_at,updated_at")
      .not("external_email", "is", null)
      .order("created_at", { ascending: false }).limit(150),
    sb.from("partner_managers")
      .select("organization_id,user_id,role_in_org,is_primary,status,permissions")
      .eq("is_primary", false).order("organization_id").limit(250),
    sb.from("b2b_entitlement_grants")
      .select("id,contract_id,organization_id,user_id,status,granted_at,revoked_at,metadata")
      .order("granted_at", { ascending: false }).limit(250),
    sb.from("special_access_admin_exceptions")
      .select("id,source_type,source_id,action,previous_expires_at,new_expires_at,reason,created_by,created_at,metadata")
      .order("created_at", { ascending: false }).limit(100),
    sb.from("special_access_audit")
      .select("id,actor_user_id,target_user_id,organization_id,access_type,source_id,action,reason,metadata,created_at")
      .order("created_at", { ascending: false }).limit(120),
  ]);

  for (const result of [configResult, coursesResult, invitationResult, delegationResult, juryResult, structureResult, b2bResult, exceptionsResult, auditResult]) {
    if (result.error) throw result.error;
  }

  const configs = configResult.data || [];
  const invitations = invitationResult.data || [];
  const delegations = delegationResult.data || [];
  const juryMembers = juryResult.data || [];
  const structureLinks = structureResult.data || [];
  const b2bGrants = b2bResult.data || [];
  const exceptions = exceptionsResult.data || [];
  const audit = auditResult.data || [];

  const organizationIds = [...new Set([
    ...invitations.map((row: any) => row.organization_id),
    ...structureLinks.map((row: any) => row.organization_id),
    ...b2bGrants.map((row: any) => row.organization_id),
    ...audit.map((row: any) => row.organization_id),
  ].filter(Boolean))];
  const contractIds = [...new Set(b2bGrants.map((row: any) => row.contract_id).filter(Boolean))];
  const panelIds = [...new Set(juryMembers.map((row: any) => row.panel_id).filter(Boolean))];

  const [organizationsResult, contractsResult, panelsResult] = await Promise.all([
    organizationIds.length
      ? sb.from("partner_organizations").select("id,org_name,status").in("id", organizationIds)
      : Promise.resolve({ data: [], error: null }),
    contractIds.length
      ? sb.from("b2b_contracts").select("id,contract_number,title,status,starts_on,ends_on,organization_id").in("id", contractIds)
      : Promise.resolve({ data: [], error: null }),
    panelIds.length
      ? sb.from("assessment_jury_panels").select("id,name,purpose,status").in("id", panelIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (organizationsResult.error) throw organizationsResult.error;
  if (contractsResult.error) throw contractsResult.error;
  if (panelsResult.error) throw panelsResult.error;

  const organizations = Object.fromEntries((organizationsResult.data || []).map((row: any) => [String(row.id), row]));
  const contracts = Object.fromEntries((contractsResult.data || []).map((row: any) => [String(row.id), row]));
  const panels = Object.fromEntries((panelsResult.data || []).map((row: any) => [String(row.id), row]));

  const userIds = [
    ...configs.flatMap((row: any) => [row.configured_by, row.revoked_by]),
    ...invitations.flatMap((row: any) => [row.target_user_id, row.invited_by]),
    ...delegations.flatMap((row: any) => [row.moderator_user_id, row.granted_by, row.revoked_by]),
    ...juryMembers.flatMap((row: any) => [row.user_id, row.validated_by]),
    ...structureLinks.map((row: any) => row.user_id),
    ...b2bGrants.map((row: any) => row.user_id),
    ...exceptions.map((row: any) => row.created_by),
    ...audit.flatMap((row: any) => [row.actor_user_id, row.target_user_id]),
  ].filter(Boolean).map(String);
  const users = await userDirectory(sb, userIds);

  const latestConfig = configs[0] || null;
  const demoStatus = latestConfig ? (() => {
    const expiresMs = latestConfig.expires_at ? Date.parse(latestConfig.expires_at) : 0;
    const lastSeenMs = latestConfig.last_seen_at ? Date.parse(latestConfig.last_seen_at) : 0;
    const heartbeatFresh = lastSeenMs > 0 && Date.now() - lastSeenMs <= 90_000;
    const active = !latestConfig.revoked_at && expiresMs > Date.now();
    return {
      is_active: active && Boolean(latestConfig.is_online) && heartbeatFresh,
      is_configured: active,
      last_activity: latestConfig.last_seen_at || null,
      time_remaining_seconds: active ? Math.max(0, Math.floor((expiresMs - Date.now()) / 1000)) : 0,
    };
  })() : null;

  const enrichedConfigs = configs.map((row: any) => ({
    ...row,
    configured_by_name: users[String(row.configured_by)]?.full_name || "—",
    revoked_by_name: users[String(row.revoked_by)]?.full_name || null,
  }));

  const enrichedInvitations = invitations.map((row: any) => ({
    ...row,
    organization_name: organizations[String(row.organization_id)]?.org_name || null,
    target_user: users[String(row.target_user_id)] || null,
    invited_by_name: users[String(row.invited_by)]?.full_name || "—",
  }));

  const enrichedDelegations = delegations.map((row: any) => ({
    ...row,
    moderator: users[String(row.moderator_user_id)] || null,
    granted_by_name: users[String(row.granted_by)]?.full_name || "—",
  }));

  const enrichedJury = juryMembers.map((row: any) => ({
    ...row,
    panel: panels[String(row.panel_id)] || null,
    linked_user: users[String(row.user_id)] || null,
  }));

  const enrichedStructure = structureLinks.map((row: any) => ({
    ...row,
    organization: organizations[String(row.organization_id)] || null,
    user: users[String(row.user_id)] || null,
  }));

  const enrichedB2b = b2bGrants.map((row: any) => ({
    ...row,
    organization: organizations[String(row.organization_id)] || null,
    contract: contracts[String(row.contract_id)] || null,
    user: users[String(row.user_id)] || null,
  }));

  const enrichedExceptions = exceptions.map((row: any) => ({
    ...row,
    created_by_name: users[String(row.created_by)]?.full_name || "—",
  }));

  const enrichedAudit = audit.map((row: any) => ({
    ...row,
    actor_name: users[String(row.actor_user_id)]?.full_name || "—",
    target_user: users[String(row.target_user_id)] || null,
    organization_name: organizations[String(row.organization_id)]?.org_name || null,
  }));

  const activeInvitations = enrichedInvitations.filter((row: any) => row.status === "pending" && Date.parse(row.expires_at) > Date.now()).length;
  const activeDelegations = enrichedDelegations.filter((row: any) => row.status === "active" && Date.parse(row.starts_at) <= Date.now() && Date.parse(row.expires_at) > Date.now()).length;
  const activeJury = enrichedJury.filter((row: any) => ["invited", "accepted"].includes(row.status) && row.invite_expires_at && Date.parse(row.invite_expires_at) > Date.now()).length;
  const activeStructure = enrichedStructure.filter((row: any) => ["actif", "active"].includes(String(row.status || "").toLowerCase()) && row.organization?.status === "validated").length;
  const activeB2b = enrichedB2b.filter((row: any) => row.status === "active" && row.organization?.status === "validated" && row.contract?.status === "active" && row.contract?.ends_on && new Date(`${row.contract.ends_on}T23:59:59Z`) > new Date()).length;

  return {
    configs: enrichedConfigs,
    status: demoStatus,
    available_roles: ALL_DEMO_ROLES,
    published_courses: coursesResult.data || [],
    invitations: enrichedInvitations,
    delegations: enrichedDelegations,
    jury_accesses: enrichedJury,
    structure_accesses: enrichedStructure,
    b2b_accesses: enrichedB2b,
    exceptions: enrichedExceptions,
    audit: enrichedAudit,
    summary: {
      demo: demoStatus?.is_configured ? 1 : 0,
      invitations: activeInvitations,
      delegations: activeDelegations,
      jury: activeJury,
      structure: activeStructure,
      b2b: activeB2b,
      total_active: (demoStatus?.is_configured ? 1 : 0) + activeInvitations + activeDelegations + activeJury + activeStructure + activeB2b,
      generated_at: nowIso,
    },
  };
}

async function configureDemo(sb: any, adminId: string, body: any) {
  const newPassword = clean(body.new_password, 100);
  const expiresAt = clean(body.expires_at, 100);
  if (!newPassword || !expiresAt) throw new Error("INVALID_PARAMS");
  if (newPassword.length < 6) throw new Error("PASSWORD_TOO_SHORT");
  if (newPassword.length > 72) throw new Error("PASSWORD_TOO_LONG");
  if (!Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now()) throw new Error("EXPIRY_IN_PAST");

  const requestedRoles = Array.isArray(body.demo_roles) && body.demo_roles.length ? body.demo_roles : ["apprenant"];
  const selectedRoles = [...new Set(requestedRoles
    .map((role: string) => LEGACY_ROLE_MAP[role] ?? role)
    .filter((role: string) => ALL_DEMO_ROLES.includes(role)))];
  if (!selectedRoles.length) throw new Error("NO_VALID_DEMO_ROLE");

  const requestedCourseIds = Array.isArray(body.demo_course_ids)
    ? [...new Set(body.demo_course_ids.map((value: unknown) => clean(value, 100)).filter(Boolean))]
    : [];
  let selectedCourseIds: string[] = [];
  if (requestedCourseIds.length) {
    const { data, error } = await sb.from("courses").select("id").in("id", requestedCourseIds).eq("is_published", true);
    if (error) throw error;
    selectedCourseIds = (data || []).map((row: any) => String(row.id));
  }

  const passwordHash = hashSync(newPassword, 10);
  const now = new Date().toISOString();
  const { data: demoUser, error: demoError } = await sb.from("users").select("id").eq("email", DEMO_EMAIL).maybeSingle();
  if (demoError) throw demoError;

  if (demoUser) {
    await sb.from("user_sessions").delete().eq("user_id", demoUser.id);
    const { error: passwordError } = await sb.from("users").update({ password_hash: passwordHash }).eq("id", demoUser.id);
    if (passwordError) throw passwordError;

    const { error: deleteEnrollmentError } = await sb.from("user_enrollments").delete().eq("user_id", demoUser.id);
    if (deleteEnrollmentError) throw deleteEnrollmentError;
    if (selectedCourseIds.length) {
      const enrollments = selectedCourseIds.map((courseId) => ({ user_id: demoUser.id, course_id: courseId, enrolled_at: now, status: "active" }));
      const { error } = await sb.from("user_enrollments").upsert(enrollments, { onConflict: "user_id,course_id" });
      if (error) throw error;
    }
  }

  const { error: heartbeatError } = await sb.from("demo_account_config")
    .update({ active_session_token: null, heartbeat_token: null, is_online: false })
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (heartbeatError) throw heartbeatError;

  const { data: inserted, error: insertError } = await sb.from("demo_account_config").insert({
    expires_at: expiresAt,
    is_online: false,
    configured_by: adminId,
    configured_at: now,
    demo_roles: selectedRoles,
    demo_course_ids: selectedCourseIds,
    revoked_at: null,
    revoked_by: null,
    revoke_reason: null,
  }).select("id").single();
  if (insertError) throw insertError;

  await appendAudit(sb, adminId, "demo", String(inserted.id), "configured", {
    targetUserId: demoUser?.id || null,
    metadata: { expires_at: expiresAt, roles: selectedRoles, course_ids: selectedCourseIds },
  });

  return { success: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
    const adminId = await verifySuperAdmin(sb, token);
    if (!adminId) return json({ error: "FORBIDDEN" }, 403);

    if (req.method === "GET") return json(await loadOverview(sb));
    if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

    const body = await req.json().catch(() => ({}));
    const action = clean(body.action, 80) || "configure_demo";
    const reason = clean(body.reason, 3000);

    if (action === "configure_demo") return json(await configureDemo(sb, adminId, body));

    if (action === "revoke_demo") {
      if (!reason) return json({ error: "REASON_REQUIRED" }, 400);
      const { data: current, error } = await sb.from("demo_account_config").select("id,expires_at,revoked_at").order("configured_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      if (!current) return json({ error: "DEMO_CONFIG_NOT_FOUND" }, 404);
      const now = new Date().toISOString();
      const { data: demoUser } = await sb.from("users").select("id").eq("email", DEMO_EMAIL).maybeSingle();
      if (demoUser) await sb.from("user_sessions").delete().eq("user_id", demoUser.id);
      const { error: updateError } = await sb.from("demo_account_config").update({
        expires_at: now,
        revoked_at: now,
        revoked_by: adminId,
        revoke_reason: reason,
        active_session_token: null,
        heartbeat_token: null,
        is_online: false,
      }).eq("id", current.id);
      if (updateError) throw updateError;
      await appendAudit(sb, adminId, "demo", String(current.id), "revoked", { targetUserId: demoUser?.id || null, reason });
      return json({ success: true });
    }

    if (action === "revoke_invitation") {
      if (!reason) return json({ error: "REASON_REQUIRED" }, 400);
      const invitationId = clean(body.invitation_id, 100);
      const { data: invitation, error } = await sb.from("platform_access_invitations").select("*").eq("id", invitationId).maybeSingle();
      if (error) throw error;
      if (!invitation) return json({ error: "INVITATION_NOT_FOUND" }, 404);
      if (!["pending", "expired"].includes(invitation.status)) return json({ error: "INVITATION_NOT_REVOCABLE" }, 409);
      const { error: updateError } = await sb.from("platform_access_invitations").update({ status: "revoked", updated_at: new Date().toISOString() }).eq("id", invitation.id);
      if (updateError) throw updateError;
      await appendAudit(sb, adminId, "professional_invitation", String(invitation.id), "revoked", {
        targetUserId: invitation.target_user_id || null,
        organizationId: invitation.organization_id || null,
        reason,
        metadata: { invitation_type: invitation.invitation_type, email: invitation.email },
      });
      return json({ success: true });
    }

    if (action === "extend_invitation") {
      if (!reason) return json({ error: "REASON_REQUIRED" }, 400);
      const invitationId = clean(body.invitation_id, 100);
      const newExpiresAt = clean(body.expires_at, 100);
      if (!Number.isFinite(Date.parse(newExpiresAt)) || Date.parse(newExpiresAt) <= Date.now()) return json({ error: "EXPIRY_IN_PAST" }, 400);
      const { data: invitation, error } = await sb.from("platform_access_invitations").select("*").eq("id", invitationId).maybeSingle();
      if (error) throw error;
      if (!invitation) return json({ error: "INVITATION_NOT_FOUND" }, 404);
      if (!["pending", "expired"].includes(invitation.status)) return json({ error: "INVITATION_NOT_EXTENDABLE" }, 409);
      if (invitation.expires_at && Date.parse(invitation.expires_at) > Date.now() && Date.parse(newExpiresAt) <= Date.parse(invitation.expires_at)) return json({ error: "EXPIRY_NOT_EXTENDED" }, 400);
      const exceptionAction = await recordException(sb, adminId, "professional_invitation", String(invitation.id), invitation.expires_at || null, newExpiresAt, reason, { invitation_type: invitation.invitation_type });
      const { error: updateError } = await sb.from("platform_access_invitations").update({ status: "pending", expires_at: newExpiresAt, updated_at: new Date().toISOString() }).eq("id", invitation.id);
      if (updateError) throw updateError;
      await appendAudit(sb, adminId, "professional_invitation", String(invitation.id), exceptionAction, {
        targetUserId: invitation.target_user_id || null,
        organizationId: invitation.organization_id || null,
        reason,
        metadata: { previous_expires_at: invitation.expires_at, new_expires_at: newExpiresAt },
      });
      return json({ success: true });
    }

    if (action === "revoke_delegation") {
      if (!reason) return json({ error: "REASON_REQUIRED" }, 400);
      const delegationId = clean(body.delegation_id, 100);
      const { data: delegation, error } = await sb.from("moderator_delegations").select("*").eq("id", delegationId).maybeSingle();
      if (error) throw error;
      if (!delegation) return json({ error: "DELEGATION_NOT_FOUND" }, 404);
      if (delegation.status !== "active") return json({ error: "DELEGATION_NOT_ACTIVE" }, 409);
      const now = new Date().toISOString();
      const { error: updateError } = await sb.from("moderator_delegations").update({ status: "revoked", revoked_by: adminId, revoked_at: now, updated_at: now }).eq("id", delegation.id).eq("status", "active");
      if (updateError) throw updateError;
      await appendModeratorTeamAudit(sb, adminId, delegation.moderator_user_id, "delegation_revoked", reason, { delegation_id: delegation.id, source: "special_access" });
      await appendAudit(sb, adminId, "moderator_delegation", String(delegation.id), "revoked", { targetUserId: delegation.moderator_user_id, reason });
      return json({ success: true });
    }

    if (action === "extend_delegation") {
      if (!reason) return json({ error: "REASON_REQUIRED" }, 400);
      const delegationId = clean(body.delegation_id, 100);
      const newExpiresAt = clean(body.expires_at, 100);
      if (!Number.isFinite(Date.parse(newExpiresAt)) || Date.parse(newExpiresAt) <= Date.now()) return json({ error: "EXPIRY_IN_PAST" }, 400);
      const { data: delegation, error } = await sb.from("moderator_delegations").select("*").eq("id", delegationId).maybeSingle();
      if (error) throw error;
      if (!delegation) return json({ error: "DELEGATION_NOT_FOUND" }, 404);
      if (delegation.status !== "active") return json({ error: "DELEGATION_REVOKED" }, 409);
      if (delegation.expires_at && Date.parse(delegation.expires_at) > Date.now() && Date.parse(newExpiresAt) <= Date.parse(delegation.expires_at)) return json({ error: "EXPIRY_NOT_EXTENDED" }, 400);
      const exceptionAction = await recordException(sb, adminId, "moderator_delegation", String(delegation.id), delegation.expires_at || null, newExpiresAt, reason);
      const { error: updateError } = await sb.from("moderator_delegations").update({ expires_at: newExpiresAt, updated_at: new Date().toISOString() }).eq("id", delegation.id).eq("status", "active");
      if (updateError) throw updateError;
      await appendModeratorTeamAudit(sb, adminId, delegation.moderator_user_id, "delegation_extended", reason, { delegation_id: delegation.id, previous_expires_at: delegation.expires_at, new_expires_at: newExpiresAt });
      await appendAudit(sb, adminId, "moderator_delegation", String(delegation.id), exceptionAction, { targetUserId: delegation.moderator_user_id, reason, metadata: { previous_expires_at: delegation.expires_at, new_expires_at: newExpiresAt } });
      return json({ success: true });
    }

    if (action === "revoke_jury_access") {
      if (!reason) return json({ error: "REASON_REQUIRED" }, 400);
      const memberId = clean(body.member_id, 100);
      const { data: member, error } = await sb.from("assessment_jury_members").select("*").eq("id", memberId).maybeSingle();
      if (error) throw error;
      if (!member) return json({ error: "JURY_MEMBER_NOT_FOUND" }, 404);
      if (["removed", "declined", "completed"].includes(member.status)) return json({ error: "JURY_ACCESS_ALREADY_CLOSED" }, 409);
      const now = new Date().toISOString();
      const { error: updateError } = await sb.from("assessment_jury_members").update({ status: "removed", updated_at: now }).eq("id", member.id);
      if (updateError) throw updateError;
      const { error: sessionError } = await sb.from("assessment_jury_access_sessions").update({ revoked_at: now }).eq("member_id", member.id).is("revoked_at", null);
      if (sessionError) throw sessionError;
      await appendAudit(sb, adminId, "jury_external", String(member.id), "revoked", { targetUserId: member.user_id || null, reason, metadata: { panel_id: member.panel_id, external_email: member.external_email } });
      return json({ success: true });
    }

    if (action === "extend_jury_access") {
      if (!reason) return json({ error: "REASON_REQUIRED" }, 400);
      const memberId = clean(body.member_id, 100);
      const newExpiresAt = clean(body.expires_at, 100);
      if (!Number.isFinite(Date.parse(newExpiresAt)) || Date.parse(newExpiresAt) <= Date.now()) return json({ error: "EXPIRY_IN_PAST" }, 400);
      const { data: member, error } = await sb.from("assessment_jury_members").select("*").eq("id", memberId).maybeSingle();
      if (error) throw error;
      if (!member) return json({ error: "JURY_MEMBER_NOT_FOUND" }, 404);
      if (!["invited", "accepted"].includes(member.status)) return json({ error: "JURY_ACCESS_NOT_EXTENDABLE" }, 409);
      if (member.invite_expires_at && Date.parse(member.invite_expires_at) > Date.now() && Date.parse(newExpiresAt) <= Date.parse(member.invite_expires_at)) return json({ error: "EXPIRY_NOT_EXTENDED" }, 400);
      const exceptionAction = await recordException(sb, adminId, "jury_external", String(member.id), member.invite_expires_at || null, newExpiresAt, reason, { panel_id: member.panel_id });
      const { error: updateError } = await sb.from("assessment_jury_members").update({ invite_expires_at: newExpiresAt, updated_at: new Date().toISOString() }).eq("id", member.id);
      if (updateError) throw updateError;
      await appendAudit(sb, adminId, "jury_external", String(member.id), exceptionAction, { targetUserId: member.user_id || null, reason, metadata: { panel_id: member.panel_id, previous_expires_at: member.invite_expires_at, new_expires_at: newExpiresAt } });
      return json({ success: true });
    }

    return json({ error: "UNKNOWN_ACTION" }, 400);
  } catch (error) {
    console.error("admin-demo-configure/special-access", error);
    const code = error instanceof Error ? error.message : "SERVER_ERROR";
    const clientErrors = ["INVALID_PARAMS", "PASSWORD_TOO_SHORT", "PASSWORD_TOO_LONG", "EXPIRY_IN_PAST", "EXPIRY_NOT_EXTENDED", "NO_VALID_DEMO_ROLE"];
    return json({ error: clientErrors.includes(code) ? code : "SERVER_ERROR", message: code }, clientErrors.includes(code) ? 400 : 500);
  }
});
