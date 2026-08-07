import { generateOpaqueToken, sha256Hex } from "./auth-security.ts";
import { appendModeratorTeamAudit } from "./moderator-access.ts";

export type AccessInvitationType = "moderator" | "structure_team" | "structure_recruiter";

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

const RECRUITER_CORE_PERMISSIONS = {
  can_post_job: true,
  can_search_talent: true,
  can_contact_talent: true,
  can_manage_jobs: true,
  can_view_applications: true,
  can_schedule_interview: true,
} as const;

function normalizedEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function escapeHtml(value: unknown) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function invitationLabel(type: AccessInvitationType) {
  if (type === "moderator") return "missions de modération Omnia";
  if (type === "structure_recruiter") return "équipe de recrutement d’une Structure";
  return "équipe interne d’une Structure";
}

async function sendInvitationEmail(input: {
  email: string;
  fullName?: string | null;
  invitationType: AccessInvitationType;
  invitationUrl: string;
  organizationName?: string | null;
  message?: string | null;
}) {
  const apiKey = Deno.env.get("BREVO_API_KEY") || "";
  if (!apiKey) return false;
  const displayName = escapeHtml(input.fullName || input.email.split("@")[0] || "");
  const context = input.organizationName
    ? `La Structure <strong>${escapeHtml(input.organizationName)}</strong> vous invite à rejoindre ${invitationLabel(input.invitationType)}.`
    : `L’Administration Omnia vous invite à rejoindre les ${invitationLabel(input.invitationType)}.`;
  const note = input.message ? `<p style="color:#475467">${escapeHtml(input.message)}</p>` : "";
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      sender: {
        name: "Omnia Global Academy",
        email: Deno.env.get("BREVO_SENDER_EMAIL") || "support@omniaglobalacademy.com",
      },
      to: [{ email: input.email, name: input.fullName || undefined }],
      subject: "Invitation professionnelle — Omnia Global Academy",
      htmlContent: `<div style="font-family:Arial,sans-serif;max-width:580px;margin:auto;color:#1f2937">
        <div style="border-top:5px solid #BF8813;padding:26px 4px 14px"><h1 style="font-size:22px;color:#002050;margin:0">Omnia Global Academy</h1></div>
        <div style="border:1px solid #E4E7EC;padding:28px"><p>Bonjour ${displayName},</p><p>${context}</p>${note}
        <p>Utilisez le bouton ci-dessous. Si vous possédez déjà un compte Omnia, connectez-vous avec cette adresse e-mail. Sinon, créez votre compte personnel.</p>
        <p style="margin:26px 0"><a href="${escapeHtml(input.invitationUrl)}" style="display:inline-block;background:#002050;color:white;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700">Examiner l’invitation</a></p>
        <p style="font-size:12px;color:#667085">Ce lien est personnel, expire automatiquement et ne contient aucun mot de passe.</p></div>
      </div>`,
    }),
  }).catch(() => null);
  if (!response?.ok) console.error("access invitation email failed", response?.status);
  return !!response?.ok;
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
  const emailSent = await sendInvitationEmail({
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
}

async function applyStructureRecruiterAccess(sb: Client, invitation: any, userId: string, email: string) {
  if (!invitation.organization_id) throw new Error("ORGANIZATION_REQUIRED");
  await ensureNotProtected(sb, userId);
  const permissions = { ...RECRUITER_CORE_PERMISSIONS, can_manage_team: invitation.permissions?.can_manage_team === true };
  const now = new Date().toISOString();
  const { error: managerError } = await sb.from("partner_managers").upsert({
    organization_id: invitation.organization_id,
    user_id: userId,
    role_in_org: invitation.internal_role || "Recruteur rattaché à la Structure",
    is_primary: false,
    status: "actif",
    permissions,
  }, { onConflict: "organization_id,user_id" });
  if (managerError) throw managerError;
  const { error: permissionError } = await sb.from("talent_structure_permissions").upsert({
    organization_id: invitation.organization_id,
    user_id: userId,
    ...permissions,
    updated_at: now,
  }, { onConflict: "organization_id,user_id" });
  if (permissionError) throw permissionError;
  const { error: profileError } = await sb.from("talent_recruiter_profiles").upsert({
    user_id: userId,
    recruiter_type: "structure",
    organization_id: invitation.organization_id,
    job_title: invitation.internal_role || "Recruteur rattaché à la Structure",
    professional_email: email,
    status: "approved",
    visibility: "private",
    notifications_enabled: true,
    validated_by: invitation.invited_by,
    validated_at: now,
    suspended_at: null,
    updated_at: now,
  }, { onConflict: "user_id" });
  if (profileError) throw profileError;
  const { error: roleError } = await sb.from("user_roles").upsert({ user_id: userId, role: "recruteur_structure", granted_by: invitation.invited_by }, { onConflict: "user_id,role", ignoreDuplicates: true });
  if (roleError && roleError.code !== "23505") throw roleError;
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
  else if (invitation.invitation_type === "structure_recruiter") await applyStructureRecruiterAccess(sb, invitation, userId, email);
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
    else if (invitation.invitation_type === "structure_recruiter") await applyStructureRecruiterAccess(sb, invitation, userId, normalized);
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
