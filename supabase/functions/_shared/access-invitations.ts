import { generateOpaqueToken, sha256Hex } from "./auth-security.ts";
import { appendModeratorTeamAudit } from "./moderator-access.ts";
import { sendOmniaEmail } from "./brevo-mail.ts";

export type AccessInvitationType = "moderator" | "structure_team" | "coach_oga";

type Client = any;

type CreateInvitationInput = {
  invitationType: AccessInvitationType;
  email: string;
  fullName?: string | null;
  organizationId?: string | null;
  invitedBy: string;
  internalRole?: string | null;
  permissions?: Record<string, boolean>;
  message?: string | null;
};

const RECRUITMENT_PERMISSION_KEYS = [
  "can_post_job",
  "can_search_talent",
  "can_contact_talent",
  "can_manage_jobs",
  "can_view_applications",
  "can_schedule_interview",
  "can_manage_team",
] as const;

function recruitmentPermissions(value: unknown) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const normalized = Object.fromEntries(RECRUITMENT_PERMISSION_KEYS.map((key) => [key, source[key] === true])) as Record<string, boolean>;
  return RECRUITMENT_PERMISSION_KEYS.some((key) => normalized[key] === true) ? normalized : null;
}

function normalizedEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function invitationLabel(type: AccessInvitationType) {
  if (type === "moderator") return "missions de modération Omnia";
  if (type === "coach_oga") return "équipe des Coachs OGA";
  return "équipe interne d’une Structure";
}

async function sendInvitationEmail(sb: Client, input: {
  email: string;
  fullName?: string | null;
  invitationType: AccessInvitationType;
  invitationUrl: string;
  organizationName?: string | null;
  message?: string | null;
}) {
  return await sendOmniaEmail({
    sb,
    to: { email: input.email, name: input.fullName || undefined },
    templateKey: "platform_invitation",
    params: {
      PRENOM: input.fullName || "",
      ROLE_NAME: invitationLabel(input.invitationType),
      ORGANIZATION_NAME: input.organizationName || "",
      MESSAGE_SPECIFIQUE: input.message || "",
      LOGIN_URL: input.invitationUrl,
    },
  });
}

export async function createAccessInvitation(sb: Client, input: CreateInvitationInput) {
  const email = normalizedEmail(input.email);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("INVALID_EMAIL");

  const { data: existingUser, error: existingUserError } = await sb
    .from("users")
    .select("id,full_name,email")
    .ilike("email", email)
    .maybeSingle();
  if (existingUserError) throw existingUserError;
  if (existingUser?.id) {
    const { data: protectedRole, error: protectedError } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", existingUser.id)
      .eq("role", "super_admin")
      .maybeSingle();
    if (protectedError) throw protectedError;
    if (protectedRole) throw new Error("PROTECTED_ACCOUNT");
  }

  let revoke = sb.from("platform_access_invitations").update({ status: "revoked", updated_at: new Date().toISOString() })
    .eq("invitation_type", input.invitationType).eq("email", email).eq("status", "pending");
  revoke = input.organizationId ? revoke.eq("organization_id", input.organizationId) : revoke.is("organization_id", null);
  const { error: revokeError } = await revoke;
  if (revokeError) throw revokeError;

  const rawToken = generateOpaqueToken();
  const tokenHash = await sha256Hex(rawToken);
  const appUrl = (Deno.env.get("PUBLIC_APP_URL") || Deno.env.get("APP_URL") || "https://omniaglobalacademy.com").replace(/\/$/, "");
  const invitationUrl = `${appUrl}/invitation/${encodeURIComponent(rawToken)}`;
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const payload = {
    invitation_type: input.invitationType,
    email,
    full_name: String(input.fullName || existingUser?.full_name || "").trim() || null,
    organization_id: input.organizationId || null,
    target_user_id: existingUser?.id || null,
    invited_by: input.invitedBy,
    internal_role: input.internalRole || null,
    permissions: input.permissions || {},
    message: String(input.message || "").trim() || null,
    token_hash: tokenHash,
    status: "pending",
    expires_at: expiresAt,
  };
  const { data: invitation, error } = await sb.from("platform_access_invitations").insert(payload).select("*").single();
  if (error) throw error;

  let organizationName: string | null = null;
  if (input.organizationId) {
    const { data: organization } = await sb.from("partner_organizations").select("org_name").eq("id", input.organizationId).maybeSingle();
    organizationName = organization?.org_name || null;
  }
  const emailSent = await sendInvitationEmail(sb, {
    email,
    fullName: payload.full_name,
    invitationType: input.invitationType,
    invitationUrl,
    organizationName,
    message: payload.message,
  });
  return { invitation, invitationUrl, emailSent, accountExists: !!existingUser?.id };
}

export async function inspectAccessInvitation(sb: Client, rawToken: string) {
  const token = String(rawToken || "").trim();
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const { data, error } = await sb.from("platform_access_invitations")
    .select("id,invitation_type,email,full_name,organization_id,internal_role,status,expires_at,accepted_at,created_at")
    .eq("token_hash", tokenHash).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const expired = data.expires_at && Date.parse(data.expires_at) <= Date.now();
  if (expired && data.status === "pending") {
    const { error: expireError } = await sb.from("platform_access_invitations")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("status", "pending");
    if (expireError) throw expireError;
    data.status = "expired";
  }
  let organizationName: string | null = null;
  if (data.organization_id) {
    const { data: organization } = await sb.from("partner_organizations").select("org_name").eq("id", data.organization_id).maybeSingle();
    organizationName = organization?.org_name || null;
  }
  const { data: user } = await sb.from("users").select("id").ilike("email", data.email).maybeSingle();
  return { ...data, organization_name: organizationName, account_exists: !!user?.id };
}

async function ensureNotProtected(sb: Client, userId: string) {
  const { data, error } = await sb.from("user_roles").select("role").eq("user_id", userId).eq("role", "super_admin").maybeSingle();
  if (error) throw error;
  if (data) throw new Error("PROTECTED_ACCOUNT");
}

function coachSlug(value: unknown) {
  return String(value || "coach")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "coach";
}

export async function ensureCoachOgaAccess(sb: Client, userId: string, grantedBy: string) {
  await ensureNotProtected(sb, userId);
  const { data: user, error: userError } = await sb.from("users").select("id,full_name,email").eq("id", userId).maybeSingle();
  if (userError) throw userError;
  if (!user) throw new Error("USER_NOT_FOUND");

  const { data: existingProfile, error: existingProfileError } = await sb.from("coach_profiles").select("id,status").eq("user_id", userId).maybeSingle();
  if (existingProfileError) throw existingProfileError;

  if (!existingProfile) {
    const { data: level, error: levelError } = await sb.from("coaching_levels")
      .select("id,commission_percent,minimum_price_xof,maximum_price_xof")
      .eq("is_active", true)
      .order("catalogue_priority", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (levelError) throw levelError;
    if (!level) throw new Error("COACHING_LEVEL_REQUIRED");
    const now = new Date().toISOString();
    const profilePayload = {
      user_id: userId,
      application_id: null,
      level_id: level.id,
      status: "active",
      public_slug: `${coachSlug(user.full_name || user.email)}-${userId.slice(0, 8)}`,
      professional_title: "Coach OGA",
      biography: "",
      specialties: [],
      languages: [],
      country: "",
      timezone: "UTC",
      photo_url: null,
      linkedin_url: null,
      website_url: null,
      presentation_video_url: null,
      preferred_session_modes: ["jitsi"],
      price_30_xof: null,
      price_60_xof: null,
      price_90_xof: null,
      custom_duration_enabled: false,
      custom_hourly_price_xof: null,
      commission_override_percent: Number(level.commission_percent || 0),
      minimum_price_override_xof: Number(level.minimum_price_xof || 0),
      maximum_price_override_xof: level.maximum_price_xof === null ? null : Number(level.maximum_price_xof),
      badge_override: "Coach OGA",
      is_featured: false,
      catalogue_priority: 0,
      approved_by: grantedBy,
      approved_at: now,
      suspended_by: null,
      suspended_at: null,
      suspension_reason: null,
    };
    const { error: profileError } = await sb.from("coach_profiles").insert(profilePayload);
    if (profileError) throw profileError;
  } else if (String(existingProfile.status || "") === "archived") {
    const { error: profileError } = await sb.from("coach_profiles").update({
      status: "active", approved_by: grantedBy, approved_at: new Date().toISOString(), suspended_by: null, suspended_at: null, suspension_reason: null,
    }).eq("id", existingProfile.id);
    if (profileError) throw profileError;
  }

  const { error: roleError } = await sb.from("user_roles").upsert(
    { user_id: userId, role: "coach", granted_by: grantedBy },
    { onConflict: "user_id,role", ignoreDuplicates: true },
  );
  if (roleError && roleError.code !== "23505") throw roleError;
  return { user_id: userId, role: "coach" };
}

async function applyModeratorAccess(sb: Client, invitation: any, userId: string) {
  await ensureNotProtected(sb, userId);
  const permissions = invitation.permissions && typeof invitation.permissions === "object" ? invitation.permissions : {};
  const { error: roleError } = await sb.from("user_roles").upsert({ user_id: userId, role: "moderateur", granted_by: invitation.invited_by }, { onConflict: "user_id,role", ignoreDuplicates: true });
  if (roleError && roleError.code !== "23505") throw roleError;
  const legacy = {
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
  const now = new Date().toISOString();
  const { error: permissionError } = await sb.from("moderator_permissions").upsert({
    moderator_user_id: userId,
    permissions,
    permission_version: 4,
    updated_by: invitation.invited_by,
    updated_at: now,
    ...legacy,
  }, { onConflict: "moderator_user_id" });
  if (permissionError) throw permissionError;

  const { error: profileError } = await sb.from("moderator_team_profiles").upsert({
    moderator_user_id: userId,
    internal_title: String(invitation.internal_role || "Modérateur").trim() || "Modérateur",
    status: "active",
    joined_at: now,
    updated_by: invitation.invited_by,
    updated_at: now,
  }, { onConflict: "moderator_user_id" });
  if (profileError) throw profileError;

  await appendModeratorTeamAudit(sb, invitation.invited_by, userId, "member_joined", null, {
    invitation_id: invitation.id,
    internal_title: invitation.internal_role || "Modérateur",
    permissions,
  });
}

async function applyStructureTeamAccess(sb: Client, invitation: any, userId: string) {
  if (!invitation.organization_id) throw new Error("ORGANIZATION_REQUIRED");
  await ensureNotProtected(sb, userId);
  const { data: organization, error: organizationError } = await sb.from("partner_organizations").select("id,status").eq("id", invitation.organization_id).maybeSingle();
  if (organizationError) throw organizationError;
  if (!organization || String(organization.status || "") !== "validated") throw new Error("STRUCTURE_NOT_ACTIVE");
  const { error: linkError } = await sb.from("partner_managers").upsert({
    organization_id: invitation.organization_id,
    user_id: userId,
    role_in_org: invitation.internal_role || "collaborateur",
    is_primary: false,
    status: "actif",
    permissions: invitation.permissions || {},
  }, { onConflict: "organization_id,user_id" });
  if (linkError) throw linkError;
  const { error: roleError } = await sb.from("user_roles").upsert({ user_id: userId, role: "gestionnaire_structure", granted_by: invitation.invited_by }, { onConflict: "user_id,role", ignoreDuplicates: true });
  if (roleError && roleError.code !== "23505") throw roleError;

  const recruitment = recruitmentPermissions(invitation.permissions);
  if (recruitment) {
    const { error: recruitmentError } = await sb.from("talent_structure_permissions").upsert({
      organization_id: invitation.organization_id,
      user_id: userId,
      ...recruitment,
      updated_at: new Date().toISOString(),
    }, { onConflict: "organization_id,user_id" });
    if (recruitmentError) throw recruitmentError;
  }

  const { error: auditError } = await sb.from("structure_governance_audit").insert({
    organization_id: invitation.organization_id,
    actor_user_id: invitation.invited_by,
    actor_scope: "structure",
    event_type: "team_member_joined",
    target_user_id: userId,
    metadata: { invitation_id: invitation.id, internal_role: invitation.internal_role || "collaborateur" },
  });
  if (auditError) throw auditError;
}


export async function acceptAccessInvitation(sb: Client, rawToken: string, userId: string, userEmail: string) {
  const token = String(rawToken || "").trim();
  if (!token || !userId) throw new Error("INVALID_INVITATION");
  const tokenHash = await sha256Hex(token);
  const { data: invitation, error } = await sb.from("platform_access_invitations").select("*").eq("token_hash", tokenHash).maybeSingle();
  if (error) throw error;
  if (!invitation) throw new Error("INVITATION_NOT_FOUND");
  if (invitation.status !== "pending") throw new Error("INVITATION_NOT_PENDING");
  if (invitation.expires_at && Date.parse(invitation.expires_at) <= Date.now()) throw new Error("INVITATION_EXPIRED");
  const email = normalizedEmail(userEmail);
  if (email !== normalizedEmail(invitation.email)) throw new Error("INVITATION_EMAIL_MISMATCH");
  if (invitation.target_user_id && String(invitation.target_user_id) !== userId) throw new Error("INVITATION_ACCOUNT_MISMATCH");

  if (invitation.invitation_type === "moderator") await applyModeratorAccess(sb, invitation, userId);
  else if (invitation.invitation_type === "structure_team") await applyStructureTeamAccess(sb, invitation, userId);
  else if (invitation.invitation_type === "coach_oga") await ensureCoachOgaAccess(sb, userId, invitation.invited_by);
  else throw new Error("INVITATION_TYPE_INVALID");

  const now = new Date().toISOString();
  const { error: updateError } = await sb.from("platform_access_invitations").update({
    target_user_id: userId,
    status: "accepted",
    accepted_at: now,
    updated_at: now,
  }).eq("id", invitation.id).eq("status", "pending");
  if (updateError) throw updateError;
  return invitation;
}

export async function acceptPendingInvitationsForUser(sb: Client, userId: string, email: string) {
  const normalized = normalizedEmail(email);
  const { data, error } = await sb.from("platform_access_invitations")
    .select("token_hash")
    .eq("email", normalized)
    .eq("target_user_id", userId)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString());
  if (error) throw error;
  const accepted: string[] = [];
  for (const row of data || []) {
    const { data: invitation } = await sb.from("platform_access_invitations").select("*").eq("token_hash", row.token_hash).maybeSingle();
    if (!invitation) continue;
    if (invitation.target_user_id && String(invitation.target_user_id) !== userId) continue;
    if (invitation.invitation_type === "moderator") await applyModeratorAccess(sb, invitation, userId);
    else if (invitation.invitation_type === "structure_team") await applyStructureTeamAccess(sb, invitation, userId);
    else if (invitation.invitation_type === "coach_oga") await ensureCoachOgaAccess(sb, userId, invitation.invited_by);
    else continue;
    const now = new Date().toISOString();
    const { error: updateError } = await sb.from("platform_access_invitations")
      .update({ target_user_id: userId, status: "accepted", accepted_at: now, updated_at: now })
      .eq("id", invitation.id)
      .eq("status", "pending");
    if (updateError) throw updateError;
    accepted.push(String(invitation.invitation_type));
  }
  return accepted;
}
