import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { createAccessInvitation } from "../_shared/access-invitations.ts";
import { fedaPayApiBase, fedaPayConfiguration, fedaPaySecretKey, fedaPaySecretKeyConfigured, fedaPayWebhookConfigured } from "../_shared/fedapay-security.ts";
import { jaasConfigurationStatus } from "../_shared/jaas.ts";
import { cloudflareStreamConfigured } from "../_shared/cloudflare-stream.ts";

import { getActiveOmniaSessionResult } from "../_shared/omnia-auth.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Omnia-Session-Token,X-Client-Info,Apikey",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function verifySuperAdmin(sb: any, token: string) {
  const { data: session } = await getActiveOmniaSessionResult(sb, token);
  if (!session) return null;

  const { data: role } = await sb
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user_id)
    .eq("role", "super_admin")
    .maybeSingle();

  return role ? session.user_id : null;
}

async function rows(sb: any, table: string, columns = "*", apply?: (q: any) => any) {
  try {
    let q = sb.from(table).select(columns);
    if (apply) q = apply(q);
    const { data, error } = await q;
    if (error) {
      console.warn(`[dashboard-admin] ${table}:`, error.message);
      return null;
    }
    return data ?? [];
  } catch (error) {
    console.warn(`[dashboard-admin] ${table}:`, error);
    return null;
  }
}

async function countRows(sb: any, table: string, apply?: (q: any) => any) {
  try {
    let q = sb.from(table).select("*", { count: "exact", head: true });
    if (apply) q = apply(q);
    const { count, error } = await q;
    if (error) {
      console.warn(`[dashboard-admin] count ${table}:`, error.message);
      return null;
    }
    return count ?? 0;
  } catch (error) {
    console.warn(`[dashboard-admin] count ${table}:`, error);
    return null;
  }
}

function sum(list: any[] | null, key: string) {
  if (!list) return null;
  return list.reduce((total, row) => total + Number(row?.[key] ?? 0), 0);
}

function dayKey(value: string | null | undefined) {
  if (!value) return null;
  return value.slice(0, 10);
}

function sessionToken(req: Request) {
  return (
    req.headers.get("x-omnia-session-token") ??
    (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "")
  ).trim();
}


const ACCOUNT_REASON_LABELS: Record<string, string> = {
  pause: "Pause volontaire",
  too_many_notifications: "Trop de notifications",
  low_usage: "Utilisation insuffisante",
  technical_issue: "Problème technique",
  security_break: "Protection temporaire du compte",
  missing_features: "Fonctionnalités manquantes",
  no_longer_use: "N’utilise plus la plateforme",
  duplicate_account: "Compte en double",
  privacy_request: "Demande de suppression des données",
  technical_issues: "Problèmes techniques répétés",
  missing_content: "Contenus ou services non trouvés",
  communications: "Communications non souhaitées",
  dissatisfied: "Expérience insatisfaisante",
  other: "Autre motif",
};

function accountReasonLabel(value: unknown) {
  const key = String(value || "");
  return ACCOUNT_REASON_LABELS[key] || "Motif non communiqué";
}

const ACCOUNT_ACTION_LABELS: Record<string, string> = {
  self_suspended: "Suspension volontaire du compte",
  self_reactivated: "Réactivation volontaire du compte",
  account_suspended: "Compte suspendu par l’Administration",
  account_reactivated: "Compte réactivé par l’Administration",
  sessions_revoked: "Toutes les sessions ont été déconnectées",
  password_change_required: "Changement de mot de passe requis",
  invitation_resent: "Invitation renvoyée",
  account_deleted: "Compte fermé et anonymisé",
};

function accountActionLabel(value: unknown) {
  const key = String(value || "");
  return ACCOUNT_ACTION_LABELS[key] || "Action administrative";
}

const PRIMARY_ROLE_GROUPS = [
  { key: "apprenant", label: "Apprenants", aliases: ["apprenant"] },
  { key: "professeur", label: "Professeurs", aliases: ["professeur", "formateur", "enseignant", "etablissement_enseignant"] },
  { key: "structure", label: "Structures", aliases: ["structure", "responsable_structure", "directeur", "etablissement_directeur"] },
  { key: "organisateur", label: "Organisateurs Omnia Live", aliases: ["organisateur", "organizer"] },
  { key: "moderateur", label: "Modérateurs", aliases: ["moderateur", "moderator"] },
  { key: "recruteur", label: "Recruteurs", aliases: ["recruteur", "recruteur_independant"] },
  { key: "coach", label: "Coachs", aliases: ["coach"] },
] as const;

function roleGroup(key: string) {
  return PRIMARY_ROLE_GROUPS.find((group) => group.key === key);
}



const PRIMARY_ROLE_LABELS: Record<string, string> = {
  apprenant: "Apprenant",
  professeur: "Professeur",
  structure: "Structure",
  organisateur: "Organisateur Omnia Live",
  recruteur: "Recruteur indépendant",
  coach: "Coach",
  moderateur: "Modérateur",
};
const DELEGATION_LABELS: Record<string, string> = {
  gestionnaire_structure: "Gestionnaire de Structure",
};
const CANONICAL_PRIMARY_BY_STORED: Record<string, string> = {
  apprenant: "apprenant", professeur: "professeur", formateur: "professeur", enseignant: "professeur", etablissement_enseignant: "professeur",
  structure: "structure", responsable_structure: "structure", directeur: "structure", etablissement_directeur: "structure",
  organisateur: "organisateur", organizer: "organisateur", recruteur: "recruteur", recruteur_independant: "recruteur",
  coach: "coach", moderateur: "moderateur", moderator: "moderateur",
};
const DELEGATED_ROLES = new Set(["gestionnaire_structure"]);
const TEST_EMAILS = new Set([
  "test@omniaglobalacademy.com", "apprenant.test@omniaglobalacademy.com", "mod.test@omniaglobalacademy.com",
  "prof.test@omniaglobalacademy.com", "structure.test@omniaglobalacademy.com", "organisateur.test@omniaglobalacademy.com",
  "recruteur.test@omniaglobalacademy.com", "coach.test@omniaglobalacademy.com",
]);
function isTestUser(email: unknown) {
  const value = String(email || "").trim().toLowerCase();
  return TEST_EMAILS.has(value) || value.endsWith(".test@omniaglobalacademy.com");
}
function accountStatusGroup(value: unknown) {
  const status = String(value || "").trim().toLowerCase();
  if (["actif", "active"].includes(status)) return "active";
  if (["en_attente_validation", "en_attente", "pending", "pending_validation"].includes(status)) return "pending";
  if (["suspendu", "suspended"].includes(status)) return "suspended";
  if (["supprime", "deleted"].includes(status)) return "deleted";
  return "other";
}
function maskPhone(value: unknown) {
  const phone = String(value || "").trim();
  if (!phone) return null;
  const visible = phone.slice(-3);
  return `${"•".repeat(Math.max(4, phone.length - 3))}${visible}`;
}
async function protectedUserIds(sb: any) {
  const { data, error } = await sb.from("user_roles").select("user_id").eq("role", "super_admin");
  if (error) throw error;
  return new Set((data ?? []).map((row: any) => String(row.user_id)));
}
async function loadAdminUserDirectory(sb: any) {
  const [usersResult, rolesResult, managersResult, orgsResult] = await Promise.all([
    sb.from("users").select("id,full_name,email,phone_number,status,country_code,created_at,updated_at,last_login_at,force_password_change,suspension_source,self_suspended_at,self_suspension_until,deleted_at").order("created_at", { ascending: false }).limit(5000),
    sb.from("user_roles").select("user_id,role,granted_at").limit(20000),
    sb.from("partner_managers").select("user_id,organization_id,status,role_in_org,is_primary").in("status", ["actif", "active"]).limit(10000),
    sb.from("partner_organizations").select("id,org_name,status").limit(5000),
  ]);
  if (usersResult.error) throw usersResult.error;
  if (rolesResult.error) throw rolesResult.error;
  const protectedIds = new Set((rolesResult.data ?? []).filter((row: any) => row.role === "super_admin").map((row: any) => String(row.user_id)));
  const roleMap = new Map<string, string[]>();
  for (const row of rolesResult.data ?? []) {
    const id = String(row.user_id); if (protectedIds.has(id)) continue;
    const list = roleMap.get(id) ?? []; list.push(String(row.role)); roleMap.set(id, list);
  }
  const orgMap = new Map((orgsResult.data ?? []).map((row: any) => [String(row.id), String(row.org_name || "Structure")]));
  const managerMap = new Map<string, any[]>();
  for (const row of managersResult.data ?? []) {
    const id = String(row.user_id); const list = managerMap.get(id) ?? []; list.push(row); managerMap.set(id, list);
  }
  return (usersResult.data ?? []).filter((user: any) => !protectedIds.has(String(user.id))).map((user: any) => {
    const storedRoles = roleMap.get(String(user.id)) ?? [];
    const primary = [...new Set(storedRoles.map(role => CANONICAL_PRIMARY_BY_STORED[role]).filter(Boolean))];
    const delegated = [...new Set(storedRoles.filter(role => DELEGATED_ROLES.has(role)))];
    const organizations = (managerMap.get(String(user.id)) ?? []).map((row: any) => ({
      id: String(row.organization_id), name: orgMap.get(String(row.organization_id)) || "Structure", access: String(row.role_in_org || (row.is_primary ? "Responsable principal" : "Collaborateur")),
    }));
    const statusGroup = accountStatusGroup(user.status);
    return {
      id: String(user.id), full_name: String(user.full_name || ""), email: String(user.email || ""), phone_number: user.phone_number || null,
      status: String(user.status || ""), status_group: statusGroup, country_code: user.country_code || null, created_at: user.created_at || null,
      updated_at: user.updated_at || null, last_login_at: user.last_login_at || null, force_password_change: user.force_password_change === true,
      suspension_source: user.suspension_source || null, self_suspended_at: user.self_suspended_at || null, self_suspension_until: user.self_suspension_until || null,
      deleted_at: user.deleted_at || null, primary_roles: primary, delegated_access: delegated, organizations, is_test: isTestUser(user.email),
      signal: statusGroup === "pending" && user.created_at && Date.parse(user.created_at) < Date.now() - 14 * 86400000 ? "Validation en attente depuis plus de 14 jours" : null,
    };
  });
}
async function insertAdminUserAudit(sb: any, actorId: string, targetId: string, action: string, reason: string | null, metadata: Record<string, unknown> = {}) {
  const { error } = await sb.from("admin_user_account_audit").insert({ actor_user_id: actorId, target_user_id: targetId, action, reason, metadata });
  if (error) throw error;
}
async function handleAdminUserGet(sb: any, adminId: string, url: URL) {
  const action = url.searchParams.get("action");
  if (!action || !["users_list", "users_overview", "user_detail"].includes(action)) return null;
  const directory = await loadAdminUserDirectory(sb);
  const baseForOverview = directory.filter((row: any) => !row.is_test);
  const overview = {
    active: baseForOverview.filter((row: any) => row.status_group === "active").length,
    pending: baseForOverview.filter((row: any) => row.status_group === "pending").length,
    suspended: baseForOverview.filter((row: any) => row.status_group === "suspended").length,
    new_30d: baseForOverview.filter((row: any) => row.created_at && Date.parse(row.created_at) >= Date.now() - 30 * 86400000).length,
    total: baseForOverview.length,
  };
  if (action === "users_overview") return json({ success: true, overview });
  if (action === "users_list") {
    const q = String(url.searchParams.get("q") || "").trim().toLowerCase();
    const role = String(url.searchParams.get("role") || ""); const status = String(url.searchParams.get("status") || "");
    const delegation = String(url.searchParams.get("delegation") || ""); const includeTest = url.searchParams.get("include_test") === "true";
    const page = Math.max(1, Number(url.searchParams.get("page") || 1)); const pageSize = Math.min(100, Math.max(10, Number(url.searchParams.get("page_size") || 40)));
    const filtered = directory.filter((row: any) => {
      if (!includeTest && row.is_test) return false;
      if (q && !`${row.full_name} ${row.email} ${row.id}`.toLowerCase().includes(q)) return false;
      if (role && !row.primary_roles.includes(role)) return false;
      if (status && row.status_group !== status) return false;
      if (delegation && !row.delegated_access.includes(delegation)) return false;
      return true;
    });
    const start = (page - 1) * pageSize;
    return json({ success: true, overview, users: filtered.slice(start, start + pageSize).map(({ phone_number, ...row }: any) => row), total: filtered.length, page, page_size: pageSize,
      available_roles: Object.entries(PRIMARY_ROLE_LABELS).map(([key, label]) => ({ key, label })),
      available_delegations: Object.entries(DELEGATION_LABELS).map(([key, label]) => ({ key, label })),
    });
  }
  const userId = String(url.searchParams.get("user_id") || "");
  const user = directory.find((row: any) => row.id === userId);
  if (!user) return json({ error: "USER_NOT_FOUND", message: "Ce compte est introuvable ou protégé." }, 404);
  const [sessionsResult, invitationsResult, lifecycleResult, adminHistoryResult, profileResult] = await Promise.all([
    sb.from("user_sessions").select("id,ip_address,user_agent,expires_at,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(100),
    sb.from("platform_access_invitations").select("id,invitation_type,email,organization_id,internal_role,status,expires_at,accepted_at,created_at").or(`target_user_id.eq.${userId},email.eq.${user.email}`).order("created_at", { ascending: false }).limit(100),
    sb.from("account_lifecycle_audit").select("id,action,request_source,reason_code,planned_reactivation_at,metadata,created_at").eq("former_user_id", userId).order("created_at", { ascending: false }).limit(100),
    sb.from("admin_user_account_audit").select("id,action,reason,metadata,created_at").eq("target_user_id", userId).order("created_at", { ascending: false }).limit(100),
    sb.from("user_profiles").select("visibility,updated_at").eq("user_id", userId).maybeSingle(),
  ]);
  const now = Date.now();
  return json({ success: true, user: { ...user, phone_masked: maskPhone(user.phone_number) },
    sessions: (sessionsResult.data ?? []).map((row: any) => ({ ...row, active: !!row.expires_at && Date.parse(row.expires_at) > now })),
    invitations: invitationsResult.data ?? [],
    lifecycle: (lifecycleResult.data ?? []).map((row: any) => ({ ...row, label: accountActionLabel(row.action), reason: accountReasonLabel(row.reason_code) })),
    administrative_history: (adminHistoryResult.data ?? []).map((row: any) => ({ ...row, label: accountActionLabel(row.action) })),
    profile: profileResult.data ?? null,
  });
}
async function handleAdminUserPost(sb: any, session: SessionContext, body: any) {
  const action = String(body?.action || "");
  if (!["user_suspend", "user_reactivate", "user_revoke_sessions", "user_force_password_change", "user_resend_invitation", "user_delete"].includes(action)) return null;
  if (!session.isAdmin) return json({ error: "FORBIDDEN" }, 403);
  const userId = String(body?.user_id || "").trim(); const reason = String(body?.reason || "").trim();
  if (!userId) return json({ error: "INVALID_REQUEST", message: "Compte cible manquant." }, 400);
  const protectedIds = await protectedUserIds(sb); if (protectedIds.has(userId)) return json({ error: "PROTECTED_ACCOUNT", message: "Le compte système d’administration est protégé." }, 403);
  const { data: user, error: userError } = await sb.from("users").select("id,status,email").eq("id", userId).maybeSingle();
  if (userError) throw userError; if (!user) return json({ error: "USER_NOT_FOUND", message: "Compte introuvable." }, 404);
  const now = new Date().toISOString();
  if (action === "user_suspend") {
    if (reason.length < 5) return json({ error: "REASON_REQUIRED", message: "Un motif précis est obligatoire." }, 400);
    if (accountStatusGroup(user.status) !== "active") return json({ error: "ACCOUNT_NOT_ACTIVE", message: "Seul un compte actif peut être suspendu." }, 409);
    const { error } = await sb.from("users").update({ status: "suspendu", suspension_source: "administrative", updated_at: now }).eq("id", userId); if (error) throw error;
    await sb.from("user_sessions").delete().eq("user_id", userId);
    await insertAdminUserAudit(sb, session.userId, userId, "account_suspended", reason, { previous_status: user.status });
    return json({ success: true, message: "Le compte a été suspendu et toutes ses sessions ont été fermées." });
  }
  if (action === "user_reactivate") {
    if (reason.length < 5) return json({ error: "REASON_REQUIRED", message: "Un motif précis est obligatoire." }, 400);
    if (accountStatusGroup(user.status) !== "suspended") return json({ error: "ACCOUNT_NOT_SUSPENDED", message: "Ce compte n’est pas suspendu." }, 409);
    const { error } = await sb.from("users").update({ status: "actif", self_suspended_at: null, self_suspension_until: null, self_suspension_reason_code: null, self_suspension_reference: null, suspension_source: null, last_reactivated_at: now, updated_at: now }).eq("id", userId); if (error) throw error;
    await sb.from("user_sessions").delete().eq("user_id", userId);
    await insertAdminUserAudit(sb, session.userId, userId, "account_reactivated", reason, { previous_status: user.status });
    return json({ success: true, message: "Le compte a été réactivé. La personne devra se reconnecter." });
  }
  if (action === "user_revoke_sessions") {
    const { count, error } = await sb.from("user_sessions").delete({ count: "exact" }).eq("user_id", userId); if (error) throw error;
    await insertAdminUserAudit(sb, session.userId, userId, "sessions_revoked", reason || null, { sessions_revoked: count ?? 0 });
    return json({ success: true, message: `${count ?? 0} session(s) ont été fermées.` });
  }
  if (action === "user_resend_invitation") {
    const invitationId = String(body?.invitation_id || "").trim();
    if (!invitationId) return json({ error: "INVITATION_REQUIRED", message: "Invitation introuvable." }, 400);
    const { data: invitation, error: invitationError } = await sb.from("platform_access_invitations").select("*").eq("id", invitationId).maybeSingle();
    if (invitationError) throw invitationError;
    if (!invitation || String(invitation.target_user_id || "") !== userId) return json({ error: "INVITATION_NOT_FOUND", message: "Cette invitation ne correspond pas au compte." }, 404);
    const result = await createAccessInvitation(sb, {
      invitationType: invitation.invitation_type, email: invitation.email, fullName: invitation.full_name, organizationId: invitation.organization_id, invitedBy: session.userId,
      internalRole: invitation.internal_role, permissions: invitation.permissions || {}, message: invitation.message || null,
    });
    await insertAdminUserAudit(sb, session.userId, userId, "invitation_resent", null, { invitation_type: invitation.invitation_type, email_sent: result.emailSent });
    return json({ success: true, message: result.emailSent ? "L’invitation a été renvoyée par e-mail." : "L’e-mail n’a pas pu être envoyé. Le nouveau lien a été généré.", invitation_url: result.emailSent ? null : result.invitationUrl });
  }
  if (action === "user_delete") {
    if (String(body?.confirmation || "") !== "SUPPRIMER") return json({ error: "CONFIRMATION_REQUIRED", message: "Saisissez SUPPRIMER pour confirmer." }, 400);
    if (reason.length < 10) return json({ error: "REASON_REQUIRED", message: "Un motif détaillé d’au moins 10 caractères est obligatoire." }, 400);
    if (isTestUser(user.email)) return json({ error: "TEST_ACCOUNT_PROTECTED", message: "Les comptes de test doivent être gérés depuis Accès spéciaux." }, 403);
    const { data: deletionResult, error: deletionError } = await sb.rpc("omnia_delete_user_account", { p_user_id: userId, p_reason: reason, p_source: "admin" });
    if (deletionError) throw deletionError;
    await insertAdminUserAudit(sb, session.userId, userId, "account_deleted", reason, { deletion_reference: deletionResult?.deletion_reference || null });
    return json({ success: true, message: "Le compte a été fermé et ses données personnelles ont été anonymisées conformément à la procédure protégée." });
  }
  const { error } = await sb.from("users").update({ force_password_change: true, updated_at: now }).eq("id", userId); if (error) throw error;
  await sb.from("user_sessions").delete().eq("user_id", userId);
  await insertAdminUserAudit(sb, session.userId, userId, "password_change_required", reason || null);
  return json({ success: true, message: "Le changement de mot de passe sera exigé à la prochaine connexion." });
}

type SessionContext = {
  userId: string;
  roles: string[];
  isAdmin: boolean;
};

type DeletionTarget = {
  contentType: "course" | "project" | "live_event" | "job_offer";
  contentId: string;
  title: string;
  creatorUserId: string;
  organizationId: string | null;
  status: string;
  safeToDelete: boolean;
  importanceReason: string;
  metadata: Record<string, unknown>;
};

async function verifySessionContext(sb: any, token: string): Promise<SessionContext | null> {
  if (!token) return null;
  const { data: session } = await getActiveOmniaSessionResult(sb, token);
  if (!session?.user_id) return null;

  const { data: roleRows } = await sb
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user_id);

  const roles = (roleRows ?? []).map((row: any) => String(row.role || ""));
  return {
    userId: session.user_id,
    roles,
    isAdmin: roles.includes("super_admin"),
  };
}

async function exactCount(sb: any, table: string, column: string, value: string): Promise<number | null> {
  const { count, error } = await sb
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(column, value);
  if (error) {
    console.warn(`[dashboard-admin] count ${table}:`, error.message);
    return null;
  }
  return count ?? 0;
}

function deletionCounts(values: Array<number | null>) {
  return {
    known: values.every(value => value !== null),
    total: values.reduce((sum, value) => sum + Number(value ?? 0), 0),
  };
}

function normalizeDeletionType(value: unknown): DeletionTarget["contentType"] | null {
  const type = String(value || "");
  return ["course", "project", "live_event", "job_offer"].includes(type)
    ? type as DeletionTarget["contentType"]
    : null;
}

async function resolveDeletionTarget(
  sb: any,
  session: SessionContext,
  contentType: DeletionTarget["contentType"],
  contentId: string,
): Promise<DeletionTarget> {
  if (contentType === "course") {
    const { data: course, error } = await sb
      .from("courses")
      .select("id,title,creator_id,structure_id,creator_context,studio_status,is_published")
      .eq("id", contentId)
      .maybeSingle();
    if (error) throw error;
    if (!course) throw new Error("CONTENU_INTROUVABLE");
    if (!session.isAdmin && course.creator_id !== session.userId) throw new Error("FORBIDDEN");

    const [enrollments, certificates, orders] = await Promise.all([
      exactCount(sb, "user_enrollments", "course_id", contentId),
      exactCount(sb, "certificates", "course_id", contentId),
      exactCount(sb, "orders", "course_id", contentId),
    ]);
    const draft = ["draft", "brouillon", "rejected", "changes_requested"].includes(String(course.studio_status || "draft"));
    const counts = deletionCounts([enrollments, certificates, orders]);
    const hasHistory = counts.total > 0;
    return {
      contentType,
      contentId,
      title: course.title || "Formation sans titre",
      creatorUserId: course.creator_id,
      organizationId: course.structure_id ?? null,
      status: String(course.studio_status || "draft"),
      safeToDelete: counts.known && draft && !course.is_published && !hasHistory,
      importanceReason: !counts.known
        ? "Les dépendances de cette formation n’ont pas pu être vérifiées automatiquement."
        : hasHistory
          ? `${enrollments ?? 0} inscription(s), ${certificates ?? 0} certificat(s) et ${orders ?? 0} commande(s) sont liés à cette formation.`
          : "Cette formation a quitté l’état de brouillon ou a été publiée.",
      metadata: { enrollments, certificates, orders, creator_context: course.creator_context },
    };
  }

  if (contentType === "project") {
    const { data: project, error } = await sb
      .from("omnia_projects")
      .select("id,title,creator_user_id,organization_id,status")
      .eq("id", contentId)
      .maybeSingle();
    if (error) throw error;
    if (!project) throw new Error("CONTENU_INTROUVABLE");
    if (!session.isAdmin && project.creator_user_id !== session.userId) throw new Error("FORBIDDEN");

    const [applications, teams, deliverables] = await Promise.all([
      exactCount(sb, "omnia_project_applications", "project_id", contentId),
      exactCount(sb, "omnia_project_teams", "project_id", contentId),
      exactCount(sb, "omnia_project_deliverables", "project_id", contentId),
    ]);
    const counts = deletionCounts([applications, teams, deliverables]);
    const hasHistory = counts.total > 0;
    const safeStatus = ["draft", "changes_requested", "rejected"].includes(String(project.status || "draft"));
    return {
      contentType,
      contentId,
      title: project.title || "Projet sans titre",
      creatorUserId: project.creator_user_id,
      organizationId: project.organization_id ?? null,
      status: String(project.status || "draft"),
      safeToDelete: counts.known && safeStatus && !hasHistory,
      importanceReason: !counts.known
        ? "Les dépendances de ce projet n’ont pas pu être vérifiées automatiquement."
        : hasHistory
          ? `${applications ?? 0} candidature(s), ${teams ?? 0} équipe(s) et ${deliverables ?? 0} livrable(s) sont liés à ce projet.`
          : "Ce projet a été soumis, publié ou possède un historique de validation.",
      metadata: { applications, teams, deliverables },
    };
  }

  if (contentType === "live_event") {
    const { data: event, error } = await sb
      .from("live_events")
      .select("id,title,owner_user_id,owner_structure_id,status")
      .eq("id", contentId)
      .maybeSingle();
    if (error) throw error;
    if (!event) throw new Error("CONTENU_INTROUVABLE");
    if (!session.isAdmin && event.owner_user_id !== session.userId) throw new Error("FORBIDDEN");

    const [registrations, orders, media] = await Promise.all([
      exactCount(sb, "live_registrations", "event_id", contentId),
      exactCount(sb, "live_orders", "event_id", contentId),
      exactCount(sb, "live_media", "event_id", contentId),
    ]);
    const counts = deletionCounts([registrations, orders, media]);
    const hasHistory = counts.total > 0;
    const safeStatus = ["draft", "changes_requested", "rejected", "cancelled"].includes(String(event.status || "draft"));
    return {
      contentType,
      contentId,
      title: event.title || "Événement sans titre",
      creatorUserId: event.owner_user_id || session.userId,
      organizationId: event.owner_structure_id ?? null,
      status: String(event.status || "draft"),
      safeToDelete: counts.known && safeStatus && !hasHistory,
      importanceReason: !counts.known
        ? "Les dépendances de cet événement n’ont pas pu être vérifiées automatiquement."
        : hasHistory
          ? `${registrations ?? 0} inscription(s), ${orders ?? 0} commande(s) et ${media ?? 0} média(s) sont liés à cet événement.`
          : "Cet événement a été soumis, approuvé ou publié.",
      metadata: { registrations, orders, media },
    };
  }

  const { data: job, error } = await sb
    .from("job_offers")
    .select("id,title,posted_by_id,organization_id,status")
    .eq("id", contentId)
    .maybeSingle();
  if (error) throw error;
  if (!job) throw new Error("CONTENU_INTROUVABLE");
  if (!session.isAdmin && job.posted_by_id !== session.userId) throw new Error("FORBIDDEN");

  const applications = await exactCount(sb, "job_applications", "job_id", contentId);
  const counts = deletionCounts([applications]);
  const safeStatus = ["draft", "pending_moderation", "rejected", "changes_requested"].includes(String(job.status || "pending_moderation"));
  return {
    contentType,
    contentId,
    title: job.title || "Offre sans titre",
    creatorUserId: job.posted_by_id || session.userId,
    organizationId: job.organization_id ?? null,
    status: String(job.status || "pending_moderation"),
    safeToDelete: counts.known && safeStatus && applications === 0,
    importanceReason: !counts.known
      ? "Les candidatures liées à cette offre n’ont pas pu être vérifiées automatiquement."
      : Number(applications ?? 0) > 0
        ? `${applications ?? 0} candidature(s) sont liées à cette offre.`
        : "Cette offre a été validée ou publiée.",
    metadata: { applications },
  };
}

async function executeSafeDeletion(sb: any, target: DeletionTarget) {
  if (target.contentType === "course") {
    const { error } = await sb.from("courses").delete().eq("id", target.contentId);
    if (error) throw error;
    return;
  }
  if (target.contentType === "project") {
    const { error } = await sb.from("omnia_projects").delete().eq("id", target.contentId);
    if (error) throw error;
    return;
  }
  if (target.contentType === "live_event") {
    const { error } = await sb.from("live_events").delete().eq("id", target.contentId);
    if (error) throw error;
    return;
  }
  const { error } = await sb.from("job_offers").delete().eq("id", target.contentId);
  if (error) throw error;
}

async function archiveImportantContent(sb: any, request: any) {
  const now = new Date().toISOString();
  if (request.content_type === "course") {
    const { error } = await sb.from("courses").update({
      is_published: false,
      studio_status: "archived",
      updated_at: now,
    }).eq("id", request.content_id);
    if (error) throw error;
    return;
  }
  if (request.content_type === "project") {
    const { error } = await sb.from("omnia_projects").update({
      status: "archived",
      updated_at: now,
    }).eq("id", request.content_id);
    if (error) throw error;
    return;
  }
  if (request.content_type === "live_event") {
    const { error } = await sb.from("live_events").update({
      status: "archived",
      updated_at: now,
    }).eq("id", request.content_id);
    if (error) throw error;
    return;
  }
  const { error } = await sb.from("job_offers").update({
    status: "archived",
    updated_at: now,
  }).eq("id", request.content_id);
  if (error) throw error;
}

async function handleDeletionPost(sb: any, session: SessionContext, body: any) {
  const action = String(body?.action || "");

  if (action === "delete_or_request") {
    const contentType = normalizeDeletionType(body?.content_type);
    const contentId = String(body?.content_id || "").trim();
    if (!contentType || !contentId) return json({ error: "INVALID_REQUEST", message: "Contenu à supprimer invalide." }, 400);

    const target = await resolveDeletionTarget(sb, session, contentType, contentId);
    if (target.safeToDelete) {
      await executeSafeDeletion(sb, target);
      return json({
        success: true,
        deleted: true,
        message: "Le contenu a été supprimé définitivement.",
      });
    }

    const { data: existing } = await sb
      .from("content_deletion_requests")
      .select("*")
      .eq("content_type", target.contentType)
      .eq("content_id", target.contentId)
      .eq("status", "pending")
      .maybeSingle();

    if (existing) {
      return json({
        success: true,
        deletion_pending: true,
        request_id: existing.id,
        message: "Une demande de suppression est déjà en attente de confirmation.",
      });
    }

    const { data: request, error } = await sb
      .from("content_deletion_requests")
      .insert({
        content_type: target.contentType,
        content_id: target.contentId,
        content_title: target.title,
        creator_user_id: target.creatorUserId,
        organization_id: target.organizationId,
        requested_by: session.userId,
        reason: String(body?.reason || "").trim() || null,
        status: "pending",
        requires_admin_confirmation: true,
        importance_reason: target.importanceReason,
        metadata: { ...target.metadata, original_status: target.status },
      })
      .select("*")
      .single();
    if (error) throw error;

    return json({
      success: true,
      deletion_pending: true,
      request_id: request.id,
      message: "La demande a été transmise à l’administration pour confirmation.",
    });
  }

  if (!session.isAdmin) return json({ error: "FORBIDDEN" }, 403);

  if (action === "list_deletion_requests") {
    const requestedStatus = String(body?.status || "pending");
    let query = sb
      .from("content_deletion_requests")
      .select("*,creator:creator_user_id(full_name,email)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (requestedStatus !== "all") query = query.eq("status", requestedStatus);
    const { data, error } = await query;
    if (error) throw error;
    return json({ success: true, requests: data ?? [] });
  }

  if (action === "review_deletion_request") {
    const requestId = String(body?.request_id || "").trim();
    const decision = String(body?.decision || "");
    if (!requestId || !["approve", "reject"].includes(decision)) {
      return json({ error: "INVALID_REQUEST", message: "Décision invalide." }, 400);
    }

    const { data: request, error: loadError } = await sb
      .from("content_deletion_requests")
      .select("*")
      .eq("id", requestId)
      .eq("status", "pending")
      .maybeSingle();
    if (loadError) throw loadError;
    if (!request) return json({ error: "REQUEST_NOT_FOUND", message: "Cette demande n’est plus en attente." }, 404);

    const now = new Date().toISOString();
    const note = String(body?.review_note || "").trim() || null;

    if (decision === "reject") {
      const { data, error } = await sb
        .from("content_deletion_requests")
        .update({
          status: "rejected",
          reviewed_by: session.userId,
          reviewed_at: now,
          review_note: note,
        })
        .eq("id", requestId)
        .select("*")
        .single();
      if (error) throw error;
      return json({ success: true, request: data, message: "La suppression a été refusée." });
    }

    await archiveImportantContent(sb, request);
    const { data, error } = await sb
      .from("content_deletion_requests")
      .update({
        status: "executed",
        reviewed_by: session.userId,
        reviewed_at: now,
        review_note: note,
        executed_at: now,
      })
      .eq("id", requestId)
      .select("*")
      .single();
    if (error) throw error;
    return json({
      success: true,
      request: data,
      message: "La suppression a été confirmée. Le contenu a été retiré tout en préservant son historique.",
    });
  }

  return json({ error: "ACTION_NOT_SUPPORTED" }, 404);
}


const EXTERNAL_SERVICE_IDS = new Set([
  "openai", "anthropic", "brevo", "cloudflare", "fedapay", "jaas", "fcm", "apns", "sentry",
]);

function envConfigured(...names: string[]) {
  return names.every((name) => Boolean(String(Deno.env.get(name) || "").trim()));
}

function currencyCode(value: unknown) {
  return String(value || "").trim().toUpperCase().slice(0, 12);
}

function safeProvider(value: unknown) {
  const provider = String(value || "").trim().toLowerCase();
  return EXTERNAL_SERVICE_IDS.has(provider) ? provider : null;
}


const OPENAI_PROJECT_DEFAULT_NAME = "Omnia Global Academy";

function openAiAdminKey() {
  return String(Deno.env.get("OPENAI_ADMIN_KEY") || "").trim();
}

function openAiProjectName() {
  return String(Deno.env.get("OPENAI_PROJECT_NAME") || OPENAI_PROJECT_DEFAULT_NAME).trim() || OPENAI_PROJECT_DEFAULT_NAME;
}

async function openAiAdminFetch(path: string) {
  const key = openAiAdminKey();
  if (!key) throw new Error("OPENAI_ADMIN_KEY_NOT_CONFIGURED");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`https://api.openai.com/v1${path}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = String(payload?.error?.message || payload?.message || `HTTP_${response.status}`).slice(0, 500);
      throw new Error(`OPENAI_ADMIN_API_${response.status}:${message}`);
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

async function resolveOpenAiProject() {
  const explicitId = String(Deno.env.get("OPENAI_PROJECT_ID") || "").trim();
  const targetName = openAiProjectName();
  if (explicitId) return { id: explicitId, name: targetName, source: "env" };

  const projects: any[] = [];
  let after = "";
  for (let page = 0; page < 10; page += 1) {
    const params = new URLSearchParams({ limit: "100", include_archived: "false" });
    if (after) params.set("after", after);
    const payload = await openAiAdminFetch(`/organization/projects?${params.toString()}`);
    const batch = Array.isArray(payload?.data) ? payload.data : [];
    projects.push(...batch);
    if (!payload?.has_more || !payload?.last_id) break;
    after = String(payload.last_id);
  }

  const normalizedTarget = targetName.toLocaleLowerCase("fr");
  const matches = projects.filter((project: any) =>
    String(project?.name || "").trim().toLocaleLowerCase("fr") === normalizedTarget
    && String(project?.status || "active").toLowerCase() !== "archived"
  );
  if (matches.length === 1) {
    return { id: String(matches[0].id), name: String(matches[0].name || targetName), source: "name" };
  }
  if (matches.length > 1) throw new Error("OPENAI_PROJECT_AMBIGUOUS_SET_OPENAI_PROJECT_ID");
  throw new Error(`OPENAI_PROJECT_NOT_FOUND:${targetName}`);
}

function openAiSyncConfigured() {
  return Boolean(openAiAdminKey());
}

type OpenAiUsageSurfaceSpec = {
  id: string;
  path: string;
  groupByModel?: boolean;
};

const OPENAI_USAGE_SURFACES: OpenAiUsageSurfaceSpec[] = [
  { id: "completions", path: "/organization/usage/completions", groupByModel: true },
  { id: "embeddings", path: "/organization/usage/embeddings", groupByModel: true },
  { id: "images", path: "/organization/usage/images", groupByModel: true },
  { id: "audio_speeches", path: "/organization/usage/audio_speeches", groupByModel: true },
  { id: "audio_transcriptions", path: "/organization/usage/audio_transcriptions", groupByModel: true },
  { id: "moderations", path: "/organization/usage/moderations", groupByModel: true },
  { id: "vector_stores", path: "/organization/usage/vector_stores" },
  { id: "code_interpreter_sessions", path: "/organization/usage/code_interpreter_sessions" },
  { id: "file_search_calls", path: "/organization/usage/file_search_calls" },
  { id: "web_search_calls", path: "/organization/usage/web_search_calls", groupByModel: true },
];

function finiteMetric(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function addMetric(target: Record<string, number>, key: string, value: unknown) {
  const number = finiteMetric(value);
  if (number > 0) target[key] = Number(((target[key] || 0) + number).toFixed(6));
}

function normalizeOpenAiUsageResult(target: Record<string, number>, result: any) {
  addMetric(target, "input_tokens", result?.input_tokens);
  addMetric(target, "output_tokens", result?.output_tokens);
  addMetric(target, "cached_input_tokens", result?.input_cached_tokens);
  addMetric(target, "cache_write_tokens", result?.input_cache_write_tokens);
  addMetric(target, "model_requests", result?.num_model_requests);
  addMetric(target, "images", result?.images);
  addMetric(target, "tts_characters", result?.characters);
  addMetric(target, "audio_seconds", result?.seconds);
  addMetric(target, "storage_bytes", result?.usage_bytes);
  addMetric(target, "sessions", result?.num_sessions);
  addMetric(target, "tool_requests", result?.num_requests);
}

async function fetchOpenAiUsageSurface(
  spec: OpenAiUsageSurfaceSpec,
  projectId: string,
  startSeconds: number,
  endSeconds: number,
) {
  const totals: Record<string, number> = {};
  const byModel: Record<string, Record<string, number>> = {};
  let records = 0;
  let pageToken = "";

  for (let page = 0; page < 20; page += 1) {
    const params = new URLSearchParams({
      start_time: String(startSeconds),
      end_time: String(endSeconds),
      bucket_width: "1d",
      limit: "31",
    });
    params.append("project_ids", projectId);
    if (spec.groupByModel) {
      params.append("group_by", "project_id");
      params.append("group_by", "model");
    }
    if (pageToken) params.set("page", pageToken);

    const payload = await openAiAdminFetch(`${spec.path}?${params.toString()}`);
    for (const bucket of Array.isArray(payload?.data) ? payload.data : []) {
      for (const result of Array.isArray(bucket?.results) ? bucket.results : []) {
        records += 1;
        normalizeOpenAiUsageResult(totals, result);
        const model = String(result?.model || "").trim();
        if (model) {
          byModel[model] ||= {};
          normalizeOpenAiUsageResult(byModel[model], result);
        }
      }
    }
    if (!payload?.has_more || !payload?.next_page) break;
    pageToken = String(payload.next_page);
  }
  return { totals, by_model: byModel, records };
}

async function syncOpenAiCosts(sb: any, options: { force?: boolean; actorUserId?: string | null } = {}) {
  const provider = "openai";
  const force = options.force === true;
  const actorUserId = options.actorUserId || null;
  const state = await providerSyncState(sb, provider);
  if (state.auto_sync_enabled === false && !force) return { success: true, skipped: true, reason: "AUTO_SYNC_DISABLED", state };
  if (!openAiAdminKey()) return { success: true, skipped: true, reason: "OPENAI_ADMIN_KEY_NOT_CONFIGURED", state };
  if (providerSyncRecent(state, force)) return { success: true, skipped: true, reason: "RECENT_SYNC", state };
  await providerSyncBegin(sb, provider, state);

  try {
    const now = new Date();
    const project = await resolveOpenAiProject();
    const endSeconds = Math.floor(now.getTime() / 1000);

    const costStart = new Date(now.getTime() - 90 * 86400000);
    costStart.setUTCHours(0, 0, 0, 0);
    const costStartSeconds = Math.floor(costStart.getTime() / 1000);

    const usageStart = new Date(now.getTime() - 30 * 86400000);
    usageStart.setUTCHours(0, 0, 0, 0);
    const usageStartSeconds = Math.floor(usageStart.getTime() / 1000);

    const costRows: any[] = [];
    let pageToken = "";
    for (let page = 0; page < 20; page += 1) {
      const params = new URLSearchParams({
        start_time: String(costStartSeconds),
        end_time: String(endSeconds),
        bucket_width: "1d",
        limit: "90",
      });
      params.append("project_ids", project.id);
      params.append("group_by", "project_id");
      params.append("group_by", "line_item");
      if (pageToken) params.set("page", pageToken);

      const payload = await openAiAdminFetch(`/organization/costs?${params.toString()}`);
      for (const bucket of Array.isArray(payload?.data) ? payload.data : []) {
        for (const result of Array.isArray(bucket?.results) ? bucket.results : []) {
          const amount = Number(result?.amount?.value);
          const currency = currencyCode(result?.amount?.currency);
          if (!Number.isFinite(amount) || amount < 0 || !currency) continue;
          const lineItem = String(result?.line_item || "total").trim() || "total";
          const key = [
            "openai-cost",
            String(bucket?.start_time || ""),
            String(bucket?.end_time || ""),
            String(result?.project_id || project.id),
            lineItem,
            currency,
          ].join(":");
          costRows.push({
            provider_entry_key: key,
            provider,
            entry_type: "usage",
            source: "provider",
            occurred_at: new Date(Number(bucket?.start_time || costStartSeconds) * 1000).toISOString(),
            amount,
            currency,
            quantity: Number.isFinite(Number(result?.quantity)) ? Number(result.quantity) : null,
            unit: Number.isFinite(Number(result?.quantity)) ? "provider_quantity" : null,
            reference: key,
            description: lineItem === "total"
              ? "Coût OpenAI synchronisé automatiquement."
              : `Coût OpenAI synchronisé automatiquement · ${lineItem}`,
            metadata: {
              provider,
              project_id: String(result?.project_id || project.id),
              project_name: project.name,
              line_item: result?.line_item || null,
              api_key_id: result?.api_key_id || null,
              bucket_start: bucket?.start_time || null,
              bucket_end: bucket?.end_time || null,
              sync_source: "openai_organization_costs_api",
            },
            created_by: actorUserId,
          });
        }
      }
      if (!payload?.has_more || !payload?.next_page) break;
      pageToken = String(payload.next_page);
    }
    await upsertProviderLedgerRows(sb, costRows);

    const technicalUsage: Record<string, number> = {};
    const usageBySurface: Record<string, Record<string, number>> = {};
    const usageByModel: Record<string, Record<string, number>> = {};
    const usageErrors: Array<{ surface: string; error: string }> = [];
    let usageRecordsProcessed = 0;
    let successfulUsageSurfaces = 0;

    const surfaceResults = await Promise.all(OPENAI_USAGE_SURFACES.map(async (spec) => {
      try {
        const result = await fetchOpenAiUsageSurface(spec, project.id, usageStartSeconds, endSeconds);
        return { spec, result, error: null as string | null };
      } catch (error) {
        return { spec, result: null, error: error instanceof Error ? error.message : String(error) };
      }
    }));

    for (const item of surfaceResults) {
      if (!item.result) {
        usageErrors.push({ surface: item.spec.id, error: String(item.error || "REQUEST_FAILED").slice(0, 500) });
        continue;
      }
      successfulUsageSurfaces += 1;
      usageRecordsProcessed += item.result.records;
      usageBySurface[item.spec.id] = item.result.totals;
      for (const [metric, value] of Object.entries(item.result.totals)) addMetric(technicalUsage, metric, value);
      for (const [model, metrics] of Object.entries(item.result.by_model)) {
        usageByModel[model] ||= {};
        for (const [metric, value] of Object.entries(metrics)) addMetric(usageByModel[model], metric, value);
      }
    }

    const usageStatus = successfulUsageSurfaces === OPENAI_USAGE_SURFACES.length
      ? "complete"
      : successfulUsageSurfaces > 0
      ? "partial"
      : "unavailable";

    const successState = await providerSyncSuccess(sb, provider, state, costRows.length, {
      source: "openai_admin_costs_and_usage_api",
      cost_lookback_days: 90,
      usage_lookback_days: 30,
      project_resolution: project.source,
      project_id: project.id,
      project_name: project.name,
      cost_endpoint: "organization/costs",
      usage_status: usageStatus,
      usage_surfaces_ok: successfulUsageSurfaces,
      usage_surfaces_total: OPENAI_USAGE_SURFACES.length,
      usage_records_processed: usageRecordsProcessed,
      technical_usage_30d: technicalUsage,
      technical_usage_by_surface_30d: usageBySurface,
      technical_usage_by_model_30d: usageByModel,
      usage_errors: usageErrors,
      recharge_mode: "provider_auto_reload",
    }, actorUserId, force);

    return {
      success: true,
      skipped: false,
      rows_synced: costRows.length,
      usage_records_processed: usageRecordsProcessed,
      usage_status: usageStatus,
      project,
      state: { ...successState, admin_key_configured: true },
    };
  } catch (error) {
    return await providerSyncFailure(sb, provider, state, error, actorUserId);
  }
}

const PROVIDER_SYNC_INTERVAL_MS = 15 * 60 * 1000;

async function providerSyncState(sb: any, provider: string) {
  const { data } = await sb.from("external_service_sync_state").select("*").eq("provider", provider).maybeSingle();
  return data || { provider, auto_sync_enabled: true, metadata: {} };
}

function providerSyncRecent(state: any, force: boolean) {
  if (force) return false;
  const lastAttemptMs = state?.last_attempt_at ? new Date(state.last_attempt_at).getTime() : 0;
  return Number.isFinite(lastAttemptMs) && (Date.now() - lastAttemptMs) < PROVIDER_SYNC_INTERVAL_MS;
}

async function providerSyncBegin(sb: any, provider: string, state: any) {
  const now = new Date().toISOString();
  await sb.from("external_service_sync_state").upsert({
    provider,
    auto_sync_enabled: state?.auto_sync_enabled !== false,
    last_attempt_at: now,
    updated_at: now,
  }, { onConflict: "provider" });
  return now;
}

async function providerSyncSuccess(sb: any, provider: string, state: any, rowsSynced: number, metadata: Record<string, unknown>, actorUserId: string | null, force: boolean) {
  const now = new Date().toISOString();
  const row = {
    provider,
    auto_sync_enabled: state?.auto_sync_enabled !== false,
    last_attempt_at: now,
    last_success_at: now,
    last_error: null,
    last_rows_synced: rowsSynced,
    metadata: { ...(state?.metadata || {}), ...metadata },
    updated_at: now,
  };
  await sb.from("external_service_sync_state").upsert(row, { onConflict: "provider" });
  await sb.from("external_service_admin_audit").insert({
    actor_user_id: actorUserId,
    provider,
    action: force ? "provider_sync_forced" : "provider_sync_automatic",
    metadata: { rows_synced: rowsSynced, ...metadata },
  });
  return row;
}

async function providerSyncFailure(sb: any, provider: string, state: any, error: unknown, actorUserId: string | null) {
  const message = error instanceof Error ? error.message : String(error);
  const now = new Date().toISOString();
  const row = {
    provider,
    auto_sync_enabled: state?.auto_sync_enabled !== false,
    last_attempt_at: now,
    last_error: message.slice(0, 1000),
    updated_at: now,
  };
  await sb.from("external_service_sync_state").upsert(row, { onConflict: "provider" });
  await sb.from("external_service_admin_audit").insert({
    actor_user_id: actorUserId,
    provider,
    action: "provider_sync_failed",
    metadata: { error: message.slice(0, 1000) },
  });
  return { success: false, skipped: false, error: message, state: { ...state, ...row } };
}

async function upsertProviderLedgerRows(sb: any, rowsToWrite: any[]) {
  if (!rowsToWrite.length) return;
  for (let i = 0; i < rowsToWrite.length; i += 200) {
    const { error } = await sb.from("external_service_ledger").upsert(rowsToWrite.slice(i, i + 200), { onConflict: "provider_entry_key" });
    if (error) throw error;
  }
}

function anthropicAdminKey() {
  return String(Deno.env.get("ANTHROPIC_ADMIN_KEY") || "").trim();
}

async function anthropicAdminFetch(path: string) {
  const key = anthropicAdminKey();
  if (!key) throw new Error("ANTHROPIC_ADMIN_KEY_NOT_CONFIGURED");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`https://api.anthropic.com${path}`, {
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "User-Agent": "OmniaGlobalAcademy/1.0",
      },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`ANTHROPIC_ADMIN_API_${response.status}:${String(payload?.error?.message || payload?.message || "REQUEST_FAILED").slice(0, 500)}`);
    return payload;
  } finally { clearTimeout(timer); }
}

function anthropicCacheCreationTokens(value: unknown) {
  if (typeof value === "number") return finiteMetric(value);
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  return Object.values(value as Record<string, unknown>).reduce<number>((sum, item) => sum + finiteMetric(item), 0);
}

async function fetchAnthropicMessagesUsage(start: Date, end: Date) {
  const totals: Record<string, number> = {};
  const byModel: Record<string, Record<string, number>> = {};
  let records = 0;
  let page = "";

  for (let i = 0; i < 20; i += 1) {
    const params = new URLSearchParams({
      starting_at: start.toISOString(),
      ending_at: end.toISOString(),
      bucket_width: "1d",
      limit: "31",
    });
    params.append("group_by[]", "model");
    if (page) params.set("page", page);

    const payload = await anthropicAdminFetch(`/v1/organizations/usage_report/messages?${params.toString()}`);
    for (const bucket of Array.isArray(payload?.data) ? payload.data : []) {
      for (const result of Array.isArray(bucket?.results) ? bucket.results : []) {
        records += 1;
        const uncachedInput = Number.isFinite(Number(result?.uncached_input_tokens))
          ? finiteMetric(result?.uncached_input_tokens)
          : finiteMetric(result?.input_tokens);
        const cacheRead = finiteMetric(result?.cache_read_input_tokens);
        const cacheCreation = finiteMetric(result?.cache_creation_input_tokens) || anthropicCacheCreationTokens(result?.cache_creation);
        const output = finiteMetric(result?.output_tokens);
        const model = String(result?.model || "").trim();
        const serverToolUse = result?.server_tool_use && typeof result.server_tool_use === "object" && !Array.isArray(result.server_tool_use)
          ? result.server_tool_use as Record<string, unknown>
          : {};

        addMetric(totals, "uncached_input_tokens", uncachedInput);
        addMetric(totals, "cache_read_input_tokens", cacheRead);
        addMetric(totals, "cache_creation_input_tokens", cacheCreation);
        addMetric(totals, "input_tokens", uncachedInput + cacheRead + cacheCreation);
        addMetric(totals, "output_tokens", output);
        for (const [tool, value] of Object.entries(serverToolUse)) addMetric(totals, `server_tool_${tool}`, value);

        if (model) {
          byModel[model] ||= {};
          addMetric(byModel[model], "uncached_input_tokens", uncachedInput);
          addMetric(byModel[model], "cache_read_input_tokens", cacheRead);
          addMetric(byModel[model], "cache_creation_input_tokens", cacheCreation);
          addMetric(byModel[model], "input_tokens", uncachedInput + cacheRead + cacheCreation);
          addMetric(byModel[model], "output_tokens", output);
          for (const [tool, value] of Object.entries(serverToolUse)) addMetric(byModel[model], `server_tool_${tool}`, value);
        }
      }
    }
    if (!payload?.has_more || !payload?.next_page) break;
    page = String(payload.next_page);
  }
  return { totals, by_model: byModel, records };
}

async function syncAnthropicCosts(sb: any, options: { force?: boolean; actorUserId?: string | null } = {}) {
  const provider = "anthropic";
  const force = options.force === true;
  const actorUserId = options.actorUserId || null;
  const state = await providerSyncState(sb, provider);
  if (state.auto_sync_enabled === false && !force) return { success: true, skipped: true, reason: "AUTO_SYNC_DISABLED", state };
  if (!anthropicAdminKey()) return { success: true, skipped: true, reason: "ANTHROPIC_ADMIN_KEY_NOT_CONFIGURED", state };
  if (providerSyncRecent(state, force)) return { success: true, skipped: true, reason: "RECENT_SYNC", state };
  await providerSyncBegin(sb, provider, state);

  try {
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 86400000);

    const paramsBase = new URLSearchParams({
      starting_at: start.toISOString(),
      ending_at: end.toISOString(),
      bucket_width: "1d",
      limit: "31",
    });
    paramsBase.append("group_by[]", "description");

    const rowsToWrite: any[] = [];
    let page = "";
    for (let i = 0; i < 20; i += 1) {
      const params = new URLSearchParams(paramsBase);
      if (page) params.set("page", page);
      const payload = await anthropicAdminFetch(`/v1/organizations/cost_report?${params.toString()}`);
      for (const bucket of Array.isArray(payload?.data) ? payload.data : []) {
        for (const result of Array.isArray(bucket?.results) ? bucket.results : []) {
          const cents = Number(result?.amount);
          if (!Number.isFinite(cents) || cents < 0) continue;
          const amount = Number((cents / 100).toFixed(6));
          const description = String(result?.description || result?.cost_type || "usage").trim() || "usage";
          const key = ["anthropic-cost", String(bucket?.starting_at || start.toISOString()), String(bucket?.ending_at || ""), description, String(result?.workspace_id || "default")].join(":");
          rowsToWrite.push({
            provider_entry_key: key,
            provider,
            entry_type: "usage",
            source: "provider",
            occurred_at: String(bucket?.starting_at || start.toISOString()),
            amount,
            currency: "USD",
            reference: key,
            description: `Coût Anthropic synchronisé automatiquement · ${description}`,
            metadata: {
              sync_source: "anthropic_cost_report_api",
              description,
              workspace_id: result?.workspace_id || null,
              cost_type: result?.cost_type || null,
              model: result?.model || null,
              inference_geo: result?.inference_geo || null,
              context_window: result?.context_window || null,
              amount_minor_units: String(result?.amount ?? ""),
            },
            created_by: actorUserId,
          });
        }
      }
      if (!payload?.has_more || !payload?.next_page) break;
      page = String(payload.next_page);
    }
    await upsertProviderLedgerRows(sb, rowsToWrite);

    let usageStatus = "unavailable";
    let usageRecordsProcessed = 0;
    let technicalUsage: Record<string, number> = {};
    let technicalUsageByModel: Record<string, Record<string, number>> = {};
    let usageError: string | null = null;

    try {
      const usage = await fetchAnthropicMessagesUsage(start, end);
      technicalUsage = usage.totals;
      technicalUsageByModel = usage.by_model;
      usageRecordsProcessed = usage.records;
      usageStatus = "complete";
    } catch (error) {
      usageError = (error instanceof Error ? error.message : String(error)).slice(0, 500);
    }

    const successState = await providerSyncSuccess(sb, provider, state, rowsToWrite.length, {
      source: "anthropic_cost_and_messages_usage_api",
      lookback_days: 30,
      currency: "USD",
      cost_endpoint: "/v1/organizations/cost_report",
      usage_endpoint: "/v1/organizations/usage_report/messages",
      usage_status: usageStatus,
      usage_records_processed: usageRecordsProcessed,
      technical_usage_30d: technicalUsage,
      technical_usage_by_model_30d: technicalUsageByModel,
      usage_error: usageError,
      recharge_mode: "provider_auto_reload",
    }, actorUserId, force);

    return {
      success: true,
      skipped: false,
      rows_synced: rowsToWrite.length,
      usage_records_processed: usageRecordsProcessed,
      usage_status: usageStatus,
      state: successState,
    };
  } catch (error) {
    return await providerSyncFailure(sb, provider, state, error, actorUserId);
  }
}

async function syncBrevoAccount(sb: any, options: { force?: boolean; actorUserId?: string | null } = {}) {
  const provider = "brevo";
  const force = options.force === true;
  const actorUserId = options.actorUserId || null;
  const state = await providerSyncState(sb, provider);
  const key = String(Deno.env.get("BREVO_API_KEY") || "").trim();
  if (state.auto_sync_enabled === false && !force) return { success: true, skipped: true, reason: "AUTO_SYNC_DISABLED", state };
  if (!key) return { success: true, skipped: true, reason: "BREVO_API_KEY_NOT_CONFIGURED", state };
  if (providerSyncRecent(state, force)) return { success: true, skipped: true, reason: "RECENT_SYNC", state };
  await providerSyncBegin(sb, provider, state);
  try {
    const response = await fetch("https://api.brevo.com/v3/account", { headers: { "api-key": key, accept: "application/json" } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`BREVO_ACCOUNT_API_${response.status}:${String(payload?.message || "REQUEST_FAILED").slice(0, 500)}`);
    const plans = (Array.isArray(payload?.plan) ? payload.plan : []).map((plan: any) => ({ type: plan?.type || null, credits: Number(plan?.credits ?? 0), credits_type: plan?.creditsType || null }));
    const planVerticals = (Array.isArray(payload?.planVerticals) ? payload.planVerticals : []).map((plan: any) => ({ category: plan?.planCategory || null, type: plan?.planType || null, name: plan?.name || null, status: plan?.status || null, credits: plan?.credits ?? null, end_date: plan?.endDate || null }));
    const successState = await providerSyncSuccess(sb, provider, state, 0, {
      source: "brevo_account_api", company_name: payload?.companyName || null, organization_id: payload?.organization_id || null,
      plans, plan_verticals: planVerticals, relay_enabled: payload?.relay?.enabled === true,
      recharge_mode: "provider_plan_or_credit_purchase",
    }, actorUserId, force);
    return { success: true, skipped: false, rows_synced: 0, state: successState };
  } catch (error) { return await providerSyncFailure(sb, provider, state, error, actorUserId); }
}

function cloudflareBillingToken() { return String(Deno.env.get("CLOUDFLARE_BILLING_API_TOKEN") || "").trim(); }
function cloudflareAccountId() { return String(Deno.env.get("CLOUDFLARE_ACCOUNT_ID") || Deno.env.get("CF_ACCOUNT_ID") || Deno.env.get("R2_ACCOUNT_ID") || "").trim(); }

async function syncCloudflareBilling(sb: any, options: { force?: boolean; actorUserId?: string | null } = {}) {
  const provider = "cloudflare";
  const force = options.force === true;
  const actorUserId = options.actorUserId || null;
  const state = await providerSyncState(sb, provider);
  const token = cloudflareBillingToken(); const accountId = cloudflareAccountId();
  if (state.auto_sync_enabled === false && !force) return { success: true, skipped: true, reason: "AUTO_SYNC_DISABLED", state };
  if (!token || !accountId) return force
    ? { success: false, skipped: true, reason: "CLOUDFLARE_BILLING_TOKEN_OR_ACCOUNT_MISSING", error: "Token Billing ou Account ID Cloudflare manquant.", state }
    : { success: true, skipped: true, reason: "CLOUDFLARE_BILLING_TOKEN_OR_ACCOUNT_MISSING", state };
  if (providerSyncRecent(state, force)) return { success: true, skipped: true, reason: "RECENT_SYNC", state };
  await providerSyncBegin(sb, provider, state);
  try {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/billable-usage`, { headers: { Authorization: `Bearer ${token}`, accept: "application/json" } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success === false) throw new Error(`CLOUDFLARE_BILLING_API_${response.status}:${String(payload?.errors?.[0]?.message || "REQUEST_FAILED").slice(0, 500)}`);
    const result = Array.isArray(payload?.result) ? payload.result : (Array.isArray(payload) ? payload : []);
    const rowsToWrite = result.flatMap((item: any) => {
      const amount = Number(item?.BilledCost ?? item?.ContractedCost ?? item?.EffectiveCost);
      const currency = currencyCode(item?.BillingCurrency);
      if (!Number.isFinite(amount) || amount < 0 || !currency) return [];
      const key = ["cloudflare-cost", item?.ChargePeriodStart || item?.BillingPeriodStart || "current", item?.ChargePeriodEnd || "", item?.ServiceName || "service", item?.ChargeDescription || "usage", currency].join(":");
      return [{
        provider_entry_key: key, provider, entry_type: "usage", source: "provider",
        occurred_at: item?.ChargePeriodStart || item?.BillingPeriodStart || new Date().toISOString(), amount, currency,
        quantity: Number.isFinite(Number(item?.ConsumedQuantity)) ? Number(item.ConsumedQuantity) : null,
        unit: String(item?.ConsumedUnit || item?.PricingUnit || "").trim() || null,
        reference: key, description: `Coût Cloudflare synchronisé automatiquement · ${String(item?.ServiceName || item?.ChargeDescription || "Usage")}`,
        metadata: { sync_source: "cloudflare_billable_usage_api", service_name: item?.ServiceName || null, service_family: item?.ServiceFamilyName || null, charge_description: item?.ChargeDescription || null, subscription_id: item?.SubscriptionId || null },
        created_by: actorUserId,
      }];
    });
    await upsertProviderLedgerRows(sb, rowsToWrite);
    const successState = await providerSyncSuccess(sb, provider, state, rowsToWrite.length, { source: "cloudflare_billable_usage_api", account_id: accountId, recharge_mode: "postpaid_or_subscription" }, actorUserId, force);
    return { success: true, skipped: false, rows_synced: rowsToWrite.length, state: successState };
  } catch (error) { return await providerSyncFailure(sb, provider, state, error, actorUserId); }
}

async function fedaPayFetch(path: string) {
  const response = await fetch(`${fedaPayApiBase()}${path}`, { headers: { Authorization: `Bearer ${fedaPaySecretKey()}`, accept: "application/json" } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`FEDAPAY_API_${response.status}:${String(payload?.message || payload?.error || "REQUEST_FAILED").slice(0, 500)}`);
  return payload;
}

async function syncFedaPayBilling(sb: any, options: { force?: boolean; actorUserId?: string | null } = {}) {
  const provider = "fedapay";
  const force = options.force === true;
  const actorUserId = options.actorUserId || null;
  const state = await providerSyncState(sb, provider);
  if (state.auto_sync_enabled === false && !force) return { success: true, skipped: true, reason: "AUTO_SYNC_DISABLED", state };
  if (!fedaPaySecretKeyConfigured()) return { success: true, skipped: true, reason: "FEDAPAY_SECRET_KEY_NOT_CONFIGURED", state };
  if (providerSyncRecent(state, force)) return { success: true, skipped: true, reason: "RECENT_SYNC", state };
  await providerSyncBegin(sb, provider, state);
  try {
    const [balancesPayload, txPayload] = await Promise.all([fedaPayFetch("/balances"), fedaPayFetch("/transactions?per_page=100")]);
    const balances = Array.isArray(balancesPayload) ? balancesPayload : (Array.isArray(balancesPayload?.balances) ? balancesPayload.balances : []);
    const transactions = Array.isArray(txPayload) ? txPayload : (Array.isArray(txPayload?.transactions) ? txPayload.transactions : (Array.isArray(txPayload?.data) ? txPayload.data : []));
    const currencyIds = Array.from(new Set(transactions.map((tx: any) => Number(tx?.currency_id)).filter((id: number) => Number.isFinite(id) && id > 0)));
    const currencyMap = new Map<number, string>();
    await Promise.all(currencyIds.slice(0, 20).map(async (id: number) => {
      try {
        const raw = await fedaPayFetch(`/currencies/${id}`);
        const item = Array.isArray(raw) ? raw[0] : (raw?.currency || raw);
        const code = currencyCode(item?.iso || item?.code || item?.name);
        if (code) currencyMap.set(id, code);
      } catch { /* cost row skipped if currency cannot be proven */ }
    }));
    const rowsToWrite: any[] = [];
    for (const tx of transactions) {
      const providerFeeUnits = Number(tx?.fees ?? 0) + Number(tx?.commission ?? 0) + Number(tx?.fixed_commission ?? 0);
      const currency = currencyMap.get(Number(tx?.currency_id)) || "";
      if (!(providerFeeUnits > 0)) continue;
      const txId = String(tx?.id || tx?.reference || tx?.transaction_key || "").trim();
      if (!txId) continue;
      const key = `fedapay-fee:${txId}:${currency || "unknown"}`;
      // FedaPay expose des montants dans l'unité propre à la devise. Ne pas supposer
      // arbitrairement 2 décimales (XOF, par exemple, ne doit pas être divisé par 100).
      // On conserve donc la quantité brute fournisseur tant que l'échelle monétaire
      // n'est pas explicitement prouvée par les métadonnées de devise.
      rowsToWrite.push({
        provider_entry_key: key,
        provider,
        entry_type: "usage",
        source: "provider",
        occurred_at: tx?.approved_at || tx?.created_at || new Date().toISOString(),
        amount: null,
        currency: null,
        quantity: providerFeeUnits,
        unit: currency ? `${currency}_provider_units` : "provider_units",
        reference: tx?.reference || txId,
        description: "Frais FedaPay synchronisés automatiquement (unités fournisseur, sans conversion estimée).",
        metadata: {
          sync_source: "fedapay_transactions_api",
          transaction_id: tx?.id || null,
          status: tx?.status || null,
          fees_provider_units: tx?.fees ?? null,
          commission_provider_units: tx?.commission ?? null,
          fixed_commission_provider_units: tx?.fixed_commission ?? null,
          currency_id: tx?.currency_id || null,
          currency_code: currency || null,
          monetary_scale_assumed: false,
        },
        created_by: actorUserId,
      });
    }
    await upsertProviderLedgerRows(sb, rowsToWrite);
    const successState = await providerSyncSuccess(sb, provider, state, rowsToWrite.length, { source: "fedapay_transactions_and_balances_api", balances: balances.map((b: any) => ({ id: b?.id || null, amount_minor: b?.amount ?? null, mode: b?.mode || null, updated_at: b?.updated_at || null })), transaction_count: transactions.length, recharge_mode: "not_applicable_merchant_balance" }, actorUserId, force);
    return { success: true, skipped: false, rows_synced: rowsToWrite.length, state: successState };
  } catch (error) { return await providerSyncFailure(sb, provider, state, error, actorUserId); }
}

function sentrySyncConfigured() { return Boolean(String(Deno.env.get("SENTRY_AUTH_TOKEN") || "").trim() && String(Deno.env.get("SENTRY_ORG_SLUG") || "").trim()); }

async function syncSentryStats(sb: any, options: { force?: boolean; actorUserId?: string | null } = {}) {
  const provider = "sentry";
  const force = options.force === true;
  const actorUserId = options.actorUserId || null;
  const state = await providerSyncState(sb, provider);
  const token = String(Deno.env.get("SENTRY_AUTH_TOKEN") || "").trim();
  const org = String(Deno.env.get("SENTRY_ORG_SLUG") || "").trim();
  if (state.auto_sync_enabled === false && !force) return { success: true, skipped: true, reason: "AUTO_SYNC_DISABLED", state };
  if (!token || !org) return { success: true, skipped: true, reason: "SENTRY_TOKEN_OR_ORG_NOT_CONFIGURED", state };
  if (providerSyncRecent(state, force)) return { success: true, skipped: true, reason: "RECENT_SYNC", state };
  await providerSyncBegin(sb, provider, state);
  try {
    const params = new URLSearchParams({ "field": "sum(quantity)", "groupBy": "category", "statsPeriod": "30d" });
    const response = await fetch(`https://sentry.io/api/0/organizations/${encodeURIComponent(org)}/stats_v2/?${params.toString()}`, { headers: { Authorization: `Bearer ${token}`, accept: "application/json" } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`SENTRY_STATS_API_${response.status}:${String(payload?.detail || "REQUEST_FAILED").slice(0, 500)}`);
    const groups = Array.isArray(payload?.groups) ? payload.groups : [];
    const snapshot = groups.map((g: any) => ({ category: g?.by?.category || null, quantity: g?.totals?.["sum(quantity)"] ?? null }));
    const technicalUsage: Record<string, number> = {};
    let totalEvents = 0;
    for (const item of snapshot) {
      const quantity = Number(item.quantity);
      if (!Number.isFinite(quantity) || quantity < 0) continue;
      const category = String(item.category || "events").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "events";
      technicalUsage[`events_${category}`] = Number((technicalUsage[`events_${category}`] || 0) + quantity);
      totalEvents += quantity;
    }
    if (totalEvents > 0) technicalUsage.events_total = Number(totalEvents.toFixed(6));
    const successState = await providerSyncSuccess(sb, provider, state, 0, {
      source: "sentry_stats_v2_api",
      organization: org,
      usage_30d: snapshot,
      technical_usage_30d: technicalUsage,
      recharge_mode: "subscription_or_quota",
    }, actorUserId, force);
    return { success: true, skipped: false, rows_synced: 0, state: successState };
  } catch (error) { return await providerSyncFailure(sb, provider, state, error, actorUserId); }
}

async function syncExternalProvider(sb: any, provider: string, options: { force?: boolean; actorUserId?: string | null } = {}) {
  if (provider === "openai") return await syncOpenAiCosts(sb, options);
  if (provider === "anthropic") return await syncAnthropicCosts(sb, options);
  if (provider === "brevo") return await syncBrevoAccount(sb, options);
  if (provider === "cloudflare") return await syncCloudflareBilling(sb, options);
  if (provider === "fedapay") return await syncFedaPayBilling(sb, options);
  if (provider === "sentry") return await syncSentryStats(sb, options);
  if (["jaas", "fcm", "apns"].includes(provider)) return { success: true, skipped: true, reason: "LIVE_PLATFORM_TELEMETRY", rows_synced: 0 };
  return { success: false, skipped: true, reason: "PROVIDER_SYNC_NOT_SUPPORTED" };
}

function groupLedgerAmounts(entries: any[]) {
  const balances: Record<string, number> = {};
  const recharges: Record<string, number> = {};
  const consumption: Record<string, number> = {};
  const quantities: Record<string, number> = {};
  for (const entry of entries) {
    const currency = currencyCode(entry.currency);
    const amount = Number(entry.amount);
    if (currency && Number.isFinite(amount)) {
      const sign = entry.entry_type === "usage" ? -1 : 1;
      balances[currency] = Number(((balances[currency] || 0) + (sign * amount)).toFixed(6));
      if (entry.entry_type === "recharge") recharges[currency] = Number(((recharges[currency] || 0) + amount).toFixed(6));
      if (entry.entry_type === "usage") consumption[currency] = Number(((consumption[currency] || 0) + amount).toFixed(6));
    }
    const unit = String(entry.unit || "").trim();
    const quantity = Number(entry.quantity);
    if (unit && Number.isFinite(quantity)) {
      quantities[unit] = Number(((quantities[unit] || 0) + quantity).toFixed(6));
    }
  }
  return { tracked_balance: balances, recharges, consumption, quantities };
}

async function externalServiceGovernancePayload(sb: any, actorUserId: string | null = null) {
  const [openAiSyncAttempt, anthropicSyncAttempt, brevoSyncAttempt, cloudflareSyncAttempt, fedaPaySyncAttempt, sentrySyncAttempt] = await Promise.all([
    syncOpenAiCosts(sb, { actorUserId }), syncAnthropicCosts(sb, { actorUserId }), syncBrevoAccount(sb, { actorUserId }),
    syncCloudflareBilling(sb, { actorUserId }), syncFedaPayBilling(sb, { actorUserId }), syncSentryStats(sb, { actorUserId }),
  ]);
  const now = new Date();
  const start30 = new Date(now.getTime() - 30 * 86400000).toISOString();

  const [ledger, budgets, syncStates, audits, cronControls, cronRuns, notificationRows, pushRows, cloudflareMedia, jaasRooms, fedaCourseOrders, fedaLiveOrders] = await Promise.all([
    rows(sb, "external_service_ledger", "id,provider,entry_type,source,occurred_at,amount,currency,quantity,unit,reference,description,metadata,provider_entry_key,created_by,created_at", q => q.order("occurred_at", { ascending: false }).limit(5000)),
    rows(sb, "external_service_budget_settings", "provider,monthly_budget,currency,low_balance_threshold,notes,enabled,updated_at", q => q.order("provider", { ascending: true })),
    rows(sb, "external_service_sync_state", "provider,auto_sync_enabled,last_attempt_at,last_success_at,last_error,last_project_id,last_project_name,last_rows_synced,metadata,updated_at", q => q.order("provider", { ascending: true })),
    rows(sb, "external_service_admin_audit", "id,provider,action,metadata,created_at", q => q.order("created_at", { ascending: false }).limit(100)),
    rows(sb, "oga_cron_controls", "job_key,enabled,max_runtime_seconds,failure_threshold,consecutive_failures,last_started_at,last_finished_at,last_success_at,last_failure_at,last_error,updated_at", q => q.order("job_key", { ascending: true })),
    rows(sb, "oga_cron_runs", "id,job_key,status,forced,started_at,finished_at,duration_ms,error_message", q => q.gte("started_at", start30).order("started_at", { ascending: false }).limit(200)),
    rows(sb, "notification_log", "channel,status,sent_at", q => q.gte("sent_at", start30).order("sent_at", { ascending: false }).limit(5000)),
    rows(sb, "mobile_notification_deliveries", "provider,status,created_at", q => q.gte("created_at", start30).order("created_at", { ascending: false }).limit(5000)),
    countRows(sb, "live_media", q => q.not("cloudflare_stream_uid", "is", null).gte("created_at", start30)),
    countRows(sb, "live_rooms", q => q.eq("provider", "jaas").gte("created_at", start30)),
    countRows(sb, "orders", q => q.eq("payment_gateway", "fedapay").gte("created_at", start30)),
    countRows(sb, "live_orders", q => q.eq("payment_provider", "fedapay").gte("created_at", start30)),
  ]);

  let fedaConfig: any = null;
  try { fedaConfig = fedaPayConfiguration(); } catch (error) {
    fedaConfig = { effective_mode: "sandbox", requested_mode: "invalid", live_enabled: false, live_blocked: true, configuration_error: error instanceof Error ? error.message : String(error) };
  }
  const jaas = jaasConfigurationStatus();
  const notificationSummary = {
    queued: await countRows(sb, "notification_queue", q => q.eq("processed", false)),
    email_30d: (notificationRows || []).filter((r: any) => ["email", "brevo"].includes(String(r.channel || "").toLowerCase())).length,
    sms_30d: (notificationRows || []).filter((r: any) => String(r.channel || "").toLowerCase() === "sms").length,
    failures_30d: (notificationRows || []).filter((r: any) => ["failed", "error", "bounced"].includes(String(r.status || "").toLowerCase())).length,
    fcm_sent_30d: (pushRows || []).filter((r: any) => r.provider === "fcm" && r.status === "sent").length,
    fcm_failed_30d: (pushRows || []).filter((r: any) => r.provider === "fcm" && r.status === "failed").length,
    apns_sent_30d: (pushRows || []).filter((r: any) => r.provider === "apns" && r.status === "sent").length,
    apns_failed_30d: (pushRows || []).filter((r: any) => r.provider === "apns" && r.status === "failed").length,
  };

  const ledgerRows = ledger || [];
  const budgetMap = new Map<string, any>((budgets || []).map((row: any) => [String(row.provider), row]));
  const syncMap = new Map<string, any>((syncStates || []).map((row: any) => [String(row.provider), row]));
  const providerLedger = (provider: string) => ledgerRows.filter((row: any) => row.provider === provider);
  const provider = (id: string, label: string, details: Record<string, unknown>) => {
    const entries = providerLedger(id);
    const finance = groupLedgerAmounts(entries);
    const finance30d = groupLedgerAmounts(entries.filter((entry: any) => String(entry.occurred_at || "") >= start30));
    const budget = budgetMap.get(id) || null;
    const sync = syncMap.get(id) || null;
    const budgetCurrency = currencyCode(budget?.currency);
    const monthlyBudget = Number(budget?.monthly_budget);
    const threshold = Number(budget?.low_balance_threshold);
    const trackedBalance = budgetCurrency ? Number(finance.tracked_balance?.[budgetCurrency]) : NaN;
    const trackedRecharge = budgetCurrency ? Number(finance.recharges?.[budgetCurrency]) : NaN;
    const hasManualFundingReference = Number.isFinite(trackedRecharge) && trackedRecharge > 0;
    const monthlyConsumption = budgetCurrency ? Number(finance30d.consumption?.[budgetCurrency]) : NaN;
    const budgetStatus = {
      currency: budgetCurrency || null,
      monthly_budget: Number.isFinite(monthlyBudget) ? monthlyBudget : null,
      consumption_30d: Number.isFinite(monthlyConsumption) ? monthlyConsumption : null,
      remaining_budget: Number.isFinite(monthlyBudget) && Number.isFinite(monthlyConsumption) ? Number((monthlyBudget - monthlyConsumption).toFixed(6)) : null,
      low_balance_threshold: Number.isFinite(threshold) ? threshold : null,
      tracked_balance: Number.isFinite(trackedBalance) ? trackedBalance : null,
      // Le solde calculé par le journal n'est qu'un rapprochement de secours. Si les
      // recharges sont gérées automatiquement par le fournisseur et non importables,
      // ne jamais produire une fausse alerte de solde négatif à partir des seuls coûts.
      low_balance_alert: hasManualFundingReference && Number.isFinite(threshold) && Number.isFinite(trackedBalance) ? trackedBalance <= threshold : false,
      budget_exceeded: Number.isFinite(monthlyBudget) && Number.isFinite(monthlyConsumption) ? monthlyConsumption > monthlyBudget : false,
    };
    return {
      id, label, budget,
      sync,
      finance,
      finance_30d: finance30d,
      budget_status: budgetStatus,
      recent_entries: entries.slice(0, 20),
      provider_balance_available: false,
      balance_mode: "provider_not_exposed",
      technical_usage_30d: Object.keys(sync?.metadata?.technical_usage_30d || {}).length
        ? sync.metadata.technical_usage_30d
        : (Object.keys(finance30d.quantities || {}).length ? finance30d.quantities : {}),
      technical_usage_by_model_30d: sync?.metadata?.technical_usage_by_model_30d || {},
      secrets_exposed: false,
      ...details,
    };
  };

  const providers = [
    (() => {
      const appConfigured = Boolean(String(Deno.env.get("OPENAI_API_KEY") || "").trim());
      const adminConfigured = openAiSyncConfigured();
      return provider("openai", "OpenAI", {
        configured: appConfigured,
        admin_billing_configured: adminConfigured,
        environment: "API",
        billing_model: "usage",
        role: "Texte, images, embeddings, transcription et synthèse vocale selon les moteurs OGA.",
        components: [
          { id: "application_api", label: "API applicative OGA", configured: appConfigured },
          { id: "admin_usage", label: "Suivi coûts & usage", configured: adminConfigured },
        ],
        balance_mode: "provider_not_exposed",
        balance_note: "Le solde prépayé OpenAI n’est pas exposé par cette API d’administration. OGA affiche séparément les recharges suivies et les coûts réels.",
        usage_note: adminConfigured
          ? "Coûts et usage technique sont synchronisés automatiquement via les API Admin OpenAI (tokens, requêtes, images, audio et autres surfaces disponibles)."
          : "Ajoutez OPENAI_ADMIN_KEY côté Supabase pour synchroniser automatiquement coûts et usage. La clé applicative reste inchangée.",
        recharge_automation: {
          provider_managed: true, provider_name: "OpenAI", auto_reload_supported: true,
          transaction_sync_supported: false, manual_fallback: true, mode: "provider_auto_reload",
          note: "Auto-reload est géré par OpenAI. OGA importe les coûts et l’usage ; une saisie manuelle reste uniquement un secours comptable pour une recharge non exposée par l’API.",
        },
        sync_attempt: openAiSyncAttempt,
        management_path: "/admin/moteurs-services",
      });
    })(),
    (() => {
      const appConfigured = Boolean(String(Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("CLAUDE_API_KEY") || "").trim());
      const adminConfigured = Boolean(anthropicAdminKey());
      return provider("anthropic", "Anthropic", {
        configured: appConfigured,
        admin_billing_configured: adminConfigured,
        environment: "API",
        billing_model: "usage",
        role: "Assistance pédagogique, Career Studio et génération/traitement de contenus selon les moteurs OGA.",
        components: [
          { id: "application_api", label: "API applicative OGA", configured: appConfigured },
          { id: "admin_usage", label: "Suivi coûts & usage", configured: adminConfigured },
        ],
        balance_mode: "provider_not_exposed",
        balance_note: "Le solde prépayé Anthropic n’est pas exposé par l’Usage & Cost Admin API. OGA conserve donc la recharge de secours séparément des coûts et tokens synchronisés.",
        usage_note: adminConfigured
          ? "Coûts et usage Messages sont synchronisés automatiquement via les rapports Cost et Usage Anthropic, avec tokens d’entrée, sortie et cache."
          : "Ajoutez ANTHROPIC_ADMIN_KEY pour activer la synchronisation automatique des coûts et des tokens.",
        recharge_automation: {
          provider_managed: true, provider_name: "Anthropic", auto_reload_supported: true,
          transaction_sync_supported: false, manual_fallback: true, mode: "provider_auto_reload",
          note: "Les crédits et l’auto-reload sont gérés par Anthropic ; OGA importe coûts et usage. Une recharge non exposée par l’API peut rester saisie en secours.",
        },
        sync_attempt: anthropicSyncAttempt,
        management_path: "/admin/quality-center",
      });
    })(),
    (() => {
      const configured = Boolean(String(Deno.env.get("BREVO_API_KEY") || "").trim());
      const brevoSync = syncMap.get("brevo") || null;
      return provider("brevo", "Brevo", {
        configured,
        admin_billing_configured: configured,
        environment: "production_account",
        billing_model: "credits_or_plan",
        role: "E-mails transactionnels, newsletter et SMS lorsque configuré.",
        components: [{ id: "account_api", label: "Compte & crédits Brevo", configured }],
        provider_credit_plans: brevoSync?.metadata?.plans || [],
        provider_credit_verticals: brevoSync?.metadata?.plan_verticals || [],
        balance_mode: "provider_credits",
        observed_usage_30d: { emails: notificationSummary.email_30d, sms: notificationSummary.sms_30d, failures: notificationSummary.failures_30d },
        technical_usage_30d: { emails_sent_or_logged: notificationSummary.email_30d, sms_sent_or_logged: notificationSummary.sms_30d, failures: notificationSummary.failures_30d },
        usage_note: "Le compte et les crédits disponibles sont lus via l’API Account Brevo ; les envois OGA sont comptés depuis les journaux de la plateforme.",
        recharge_automation: {
          provider_managed: true, provider_name: "Brevo", auto_reload_supported: false,
          transaction_sync_supported: false, manual_fallback: true, mode: "provider_plan_or_credit_purchase",
          note: "Aucune saisie n’est requise pour le suivi courant ; plan/crédits sont lus automatiquement. Une écriture manuelle reste un secours de rapprochement.",
        },
        sync_attempt: brevoSyncAttempt,
        management_path: "/admin/cms-branding",
      });
    })(),
    (() => {
      const r2Configured = envConfigured("R2_ACCOUNT_ID")
        && Boolean(String(Deno.env.get("R2_ACCESS_KEY_ID") || Deno.env.get("R2_ACCESS_KEY") || "").trim())
        && Boolean(String(Deno.env.get("R2_SECRET_ACCESS_KEY") || Deno.env.get("R2_SECRET_KEY") || "").trim());
      const billingConfigured = Boolean(cloudflareBillingToken() && cloudflareAccountId());
      const streamConfigured = cloudflareStreamConfigured();
      return provider("cloudflare", "Cloudflare R2 / Stream", {
        configured: r2Configured || billingConfigured || streamConfigured,
        r2_configured: r2Configured,
        admin_billing_configured: billingConfigured,
        stream_configured: streamConfigured,
        environment: "production_service",
        billing_model: "usage",
        role: "Stockage privé, diffusion vidéo et URLs signées.",
        components: [
          { id: "r2", label: "R2 stockage privé", configured: r2Configured },
          { id: "stream", label: "Stream vidéo", configured: streamConfigured },
          { id: "billing", label: "Suivi Billing", configured: billingConfigured },
        ],
        balance_mode: "not_applicable_postpaid",
        observed_usage_30d: { stream_media_created: cloudflareMedia ?? null },
        usage_note: billingConfigured
          ? "Coûts et quantités facturables sont synchronisés depuis l’API Billing Cloudflare. R2, Stream et Billing sont affichés séparément."
          : "Ajoutez un token CLOUDFLARE_BILLING_API_TOKEN avec Billing Read et un Account ID pour automatiser les coûts, sans élargir les permissions R2/Stream.",
        recharge_automation: {
          provider_managed: true, provider_name: "Cloudflare", auto_reload_supported: false,
          transaction_sync_supported: true, manual_fallback: true, mode: "postpaid_or_subscription",
          note: "Cloudflare est facturé à l’usage ou par abonnement : il n’y a pas de recharge OGA à saisir.",
        },
        sync_attempt: cloudflareSyncAttempt,
        management_path: "/admin/live",
      });
    })(),
    (() => {
      const secretConfigured = fedaPaySecretKeyConfigured();
      const webhookConfigured = fedaPayWebhookConfigured();
      const fedaSync = syncMap.get("fedapay") || null;
      const apiAuthenticated = Boolean(fedaSync?.last_success_at && !fedaSync?.last_error);
      return provider("fedapay", "FedaPay", {
        configured: secretConfigured,
        webhook_configured: webhookConfigured,
        provider_api_authenticated: apiAuthenticated,
        environment: fedaConfig?.effective_mode || "sandbox",
        requested_environment: fedaConfig?.requested_mode || "sandbox",
        production_enabled: fedaConfig?.live_enabled === true && fedaConfig?.live_blocked !== true,
        billing_model: "transactional",
        role: "Paiements Omnia. Le passage Production reste contrôlé côté serveur.",
        components: [
          { id: "secret", label: `Clé ${fedaConfig?.effective_mode === "live" ? "Production" : "Sandbox"}`, configured: secretConfigured },
          { id: "api_auth", label: "Authentification API", configured: apiAuthenticated },
          { id: "webhook", label: "Webhook paiement", configured: webhookConfigured },
        ],
        balance_mode: "merchant_balance_provider_units",
        provider_balances: fedaSync?.metadata?.balances || [],
        observed_usage_30d: { course_orders: fedaCourseOrders ?? null, live_orders: fedaLiveOrders ?? null },
        usage_note: "Balances et transactions sont lues depuis l’environnement FedaPay actif. Une clé présente n’est considérée authentifiée qu’après une synchronisation fournisseur réussie.",
        recharge_automation: {
          provider_managed: true, provider_name: "FedaPay", auto_reload_supported: false,
          transaction_sync_supported: true, manual_fallback: true, mode: "merchant_balance",
          note: "FedaPay est un compte marchand : aucune recharge OGA. Les balances et frais disponibles sont suivis automatiquement sans conversion monétaire estimée.",
        },
        sync_attempt: fedaPaySyncAttempt,
        management_path: "/admin/fintech",
      });
    })(),
    provider("jaas", "Jitsi / JaaS", {
      configured: jaas.configured,
      environment: jaas.public_jitsi_development_fallback ? "development_fallback" : "jaas",
      production_ready: jaas.production_ready,
      billing_model: "plan_or_usage",
      role: "Infrastructure visioconférence Omnia Live.",
      components: [
        { id: "jaas", label: "JaaS production", configured: jaas.production_ready === true },
        { id: "fallback", label: "Fallback Jitsi développement", configured: jaas.public_jitsi_development_fallback === true },
      ],
      balance_mode: "provider_console_only",
      observed_usage_30d: { rooms_created: jaasRooms ?? null },
      technical_usage_30d: { rooms_created: jaasRooms ?? 0 },
      usage_note: jaas.production_ready
        ? "JaaS est prêt pour la production ; l’activité Live est suivie par OGA."
        : jaas.public_jitsi_development_fallback
        ? "Le fallback Jitsi de développement est actif. Il permet les tests mais ne doit pas être présenté comme JaaS production."
        : "JaaS production n’est pas encore configuré.",
      recharge_automation: {
        provider_managed: true, provider_name: "JaaS", auto_reload_supported: false,
        transaction_sync_supported: false, manual_fallback: true, mode: "subscription_invoice",
        note: "Abonnement/facture fournisseur ; la saisie n’est qu’un secours de rapprochement.",
      },
      sync_attempt: { success: true, skipped: true, reason: "LIVE_PLATFORM_TELEMETRY" },
      management_path: "/admin/live",
    }),
    (() => {
      const configured = envConfigured("FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY");
      return provider("fcm", "Firebase Cloud Messaging", {
        configured,
        environment: "firebase",
        billing_model: "no_cost_service",
        role: "Notifications push Android.",
        components: [{ id: "firebase", label: "Identifiants Firebase", configured }],
        balance_mode: "not_applicable",
        observed_usage_30d: { sent: notificationSummary.fcm_sent_30d, failed: notificationSummary.fcm_failed_30d },
        technical_usage_30d: { sent: notificationSummary.fcm_sent_30d, failed: notificationSummary.fcm_failed_30d },
        usage_note: "FCM est suivi automatiquement par les livraisons OGA et n’a pas de recharge à enregistrer.",
        recharge_automation: {
          provider_managed: true, provider_name: "FCM", auto_reload_supported: false,
          transaction_sync_supported: true, manual_fallback: false, mode: "not_applicable",
          note: "Service Cloud Messaging sans recharge OGA.",
        },
        sync_attempt: { success: true, skipped: true, reason: "LIVE_PLATFORM_TELEMETRY" },
        management_path: "/admin/moteurs-services",
      });
    })(),
    (() => {
      const configured = envConfigured("APNS_TEAM_ID", "APNS_KEY_ID", "APNS_PRIVATE_KEY", "APNS_BUNDLE_ID");
      const environment = String(Deno.env.get("APNS_ENVIRONMENT") || "sandbox").trim().toLowerCase() === "production" ? "production" : "sandbox";
      return provider("apns", "Apple Push Notification Service", {
        configured,
        environment,
        billing_model: "service",
        role: "Notifications push iOS.",
        components: [{ id: "apns", label: `Identifiants APNs ${environment}`, configured }],
        balance_mode: "not_applicable",
        observed_usage_30d: { sent: notificationSummary.apns_sent_30d, failed: notificationSummary.apns_failed_30d },
        technical_usage_30d: { sent: notificationSummary.apns_sent_30d, failed: notificationSummary.apns_failed_30d },
        usage_note: "Les livraisons APNs sont suivies automatiquement par OGA. Le programme développeur Apple est distinct du service APNs.",
        recharge_automation: {
          provider_managed: true, provider_name: "APNs", auto_reload_supported: false,
          transaction_sync_supported: true, manual_fallback: false, mode: "not_applicable",
          note: "Aucune recharge APNs.",
        },
        sync_attempt: { success: true, skipped: true, reason: "LIVE_PLATFORM_TELEMETRY" },
        management_path: "/admin/moteurs-services",
      });
    })(),
    (() => {
      const statsConfigured = sentrySyncConfigured();
      return provider("sentry", "Sentry", {
        configured: null,
        configuration_scope: "frontend_build",
        admin_billing_configured: statsConfigured,
        environment: "web_and_capacitor",
        billing_model: "plan_or_quota",
        role: "Diagnostic d’erreurs Web/PWA et natif. Le DSN public est injecté au build sans exposer de secret serveur.",
        components: [{ id: "stats_api", label: "API statistiques Sentry", configured: statsConfigured }],
        balance_mode: "provider_console_only",
        usage_note: statsConfigured
          ? "Les volumes d’événements sont synchronisés automatiquement via l’API Stats Sentry. Le DSN de collecte est contrôlé séparément au build."
          : "La collecte peut être active au build même sans API Stats. Ajoutez SENTRY_AUTH_TOKEN et SENTRY_ORG_SLUG uniquement pour importer automatiquement les volumes dans cette console.",
        recharge_automation: {
          provider_managed: true, provider_name: "Sentry", auto_reload_supported: false,
          transaction_sync_supported: false, manual_fallback: true, mode: "subscription_or_quota",
          note: "Plan/quota fournisseur : aucune recharge quotidienne à saisir.",
        },
        sync_attempt: sentrySyncAttempt,
        management_path: "/admin/moteurs-services",
      });
    })(),
  ];

  const jobs = (cronControls || []).map((control: any) => ({
    ...control,
    runs_30d: (cronRuns || []).filter((run: any) => run.job_key === control.job_key).slice(0, 20),
  }));

  return {
    success: true,
    generated_at: now.toISOString(),
    providers,
    ledger: ledgerRows.slice(0, 200),
    budgets: budgets || [],
    admin_audit: audits || [],
    automations: jobs,
    notifications: notificationSummary,
    security: {
      secrets_exposed: false,
      direct_notification_queue_write_closed_by_migration_167: true,
      cron_default_policy: "disabled_until_explicit_admin_activation",
    },
    admin_surfaces: [
      { id: "quality", label: "Centre Qualité", path: "/admin/quality-center", description: "Contrôles, critères, audits, non-conformités et gouvernance de l’assistant pédagogique." },
      { id: "users", label: "Utilisateurs & accès", path: "/admin/section/utilisateurs-acces", description: "Rôles, comptes, sessions, invitations et permissions." },
      { id: "fintech", label: "Configuration Fintech", path: "/admin/fintech", description: "FedaPay, environnement et sécurité des paiements." },
      { id: "live", label: "Omnia Live", path: "/admin/live", description: "JaaS, Cloudflare Stream, files et automatisations Live." },
      { id: "credentials", label: "Credentials pédagogiques", path: "/admin/credentials", description: "Open Badges, CLR, Skills Passport, signatures et révocations — distincts des secrets API." },
      { id: "cms", label: "CMS & identité", path: "/admin/cms-branding", description: "Brevo, contenus publics et identité de la plateforme." },
    ],
  };
}

async function handleOperationsPost(sb: any, session: SessionContext, body: any) {
  const action = String(body?.action || "");
  const supported = new Set(["external_service_ledger_add", "external_service_ledger_update", "external_service_ledger_delete", "external_service_budget_save", "external_service_provider_sync", "cron_control_update"]);
  if (!supported.has(action)) return null;
  if (!session.isAdmin) return json({ error: "FORBIDDEN" }, 403);

  if (action === "external_service_provider_sync") {
    const provider = safeProvider(body?.provider);
    if (!provider) return json({ error: "PROVIDER_INVALID" }, 400);
    const result = await syncExternalProvider(sb, provider, { force: true, actorUserId: session.userId });
    if (!result.success) return json({ error: "PROVIDER_SYNC_FAILED", message: ("error" in result ? result.error : null) || `Synchronisation ${provider} impossible.`, sync: result }, 502);
    return json({ success: true, sync: result });
  }

  if (action === "external_service_ledger_add") {
    const provider = safeProvider(body?.provider);
    const entryType = String(body?.entry_type || "");
    const amount = body?.amount === "" || body?.amount == null ? null : Number(body.amount);
    const quantity = body?.quantity === "" || body?.quantity == null ? null : Number(body.quantity);
    const currency = amount == null ? null : currencyCode(body?.currency);
    const unit = quantity == null ? null : String(body?.unit || "").trim().slice(0, 80) || null;
    const reference = String(body?.reference || "").trim().slice(0, 240) || null;
    const description = String(body?.description || "").trim().slice(0, 1200) || null;
    if (!provider || !["recharge", "usage", "refund", "adjustment"].includes(entryType)) return json({ error: "INVALID_ENTRY" }, 400);
    if (amount != null && (!Number.isFinite(amount) || amount < 0 || !currency)) return json({ error: "INVALID_AMOUNT" }, 400);
    if (quantity != null && (!Number.isFinite(quantity) || quantity < 0 || !unit)) return json({ error: "INVALID_QUANTITY" }, 400);
    if (amount == null && quantity == null && !description) return json({ error: "EMPTY_ENTRY" }, 400);
    const { data, error } = await sb.from("external_service_ledger").insert({
      provider, entry_type: entryType, source: "manual", occurred_at: body?.occurred_at || new Date().toISOString(),
      amount, currency, quantity, unit, reference, description, created_by: session.userId,
      metadata: { evidence: String(body?.evidence || "").trim().slice(0, 1000) || null },
    }).select("*").single();
    if (error) throw error;
    await sb.from("external_service_admin_audit").insert({ actor_user_id: session.userId, provider, action: "ledger_entry_added", metadata: { entry_id: data.id, entry_type: entryType, amount, currency, quantity, unit, reference } });
    return json({ success: true, entry: data });
  }

  if (action === "external_service_ledger_update") {
    const id = String(body?.id || "").trim();
    const provider = safeProvider(body?.provider);
    const entryType = String(body?.entry_type || "");
    const amount = body?.amount === "" || body?.amount == null ? null : Number(body.amount);
    const quantity = body?.quantity === "" || body?.quantity == null ? null : Number(body.quantity);
    const currency = amount == null ? null : currencyCode(body?.currency);
    const unit = quantity == null ? null : String(body?.unit || "").trim().slice(0, 80) || null;
    const reference = String(body?.reference || "").trim().slice(0, 240) || null;
    const description = String(body?.description || "").trim().slice(0, 1200) || null;
    if (!id || !provider || !["recharge", "usage", "refund", "adjustment"].includes(entryType)) return json({ error: "INVALID_ENTRY" }, 400);
    if (amount != null && (!Number.isFinite(amount) || amount < 0 || !currency)) return json({ error: "INVALID_AMOUNT" }, 400);
    if (quantity != null && (!Number.isFinite(quantity) || quantity < 0 || !unit)) return json({ error: "INVALID_QUANTITY" }, 400);
    if (amount == null && quantity == null && !description) return json({ error: "EMPTY_ENTRY" }, 400);
    const { data, error } = await sb.from("external_service_ledger").update({
      provider, entry_type: entryType, occurred_at: body?.occurred_at || new Date().toISOString(),
      amount, currency, quantity, unit, reference, description,
      metadata: { evidence: String(body?.evidence || "").trim().slice(0, 1000) || null },
    }).eq("id", id).eq("source", "manual").select("*").maybeSingle();
    if (error) throw error;
    if (!data) return json({ error: "MANUAL_ENTRY_NOT_FOUND", message: "Seules les saisies manuelles existantes peuvent être modifiées." }, 404);
    await sb.from("external_service_admin_audit").insert({ actor_user_id: session.userId, provider, action: "ledger_entry_updated", metadata: { entry_id: data.id, entry_type: entryType, amount, currency, quantity, unit, reference } });
    return json({ success: true, entry: data });
  }

  if (action === "external_service_ledger_delete") {
    const id = String(body?.id || "").trim();
    if (!id) return json({ error: "INVALID_ENTRY_ID" }, 400);
    const { data, error } = await sb.from("external_service_ledger").delete().eq("id", id).eq("source", "manual")
      .select("id,provider,entry_type,amount,currency,quantity,unit,reference").maybeSingle();
    if (error) throw error;
    if (!data) return json({ error: "MANUAL_ENTRY_NOT_FOUND", message: "Seules les saisies manuelles existantes peuvent être supprimées." }, 404);
    await sb.from("external_service_admin_audit").insert({ actor_user_id: session.userId, provider: data.provider, action: "ledger_entry_deleted", metadata: { entry_id: data.id, entry_type: data.entry_type, amount: data.amount, currency: data.currency, quantity: data.quantity, unit: data.unit, reference: data.reference } });
    return json({ success: true, deleted_id: data.id });
  }

  if (action === "external_service_budget_save") {
    const provider = safeProvider(body?.provider);
    if (!provider) return json({ error: "INVALID_PROVIDER" }, 400);
    const monthlyBudget = body?.monthly_budget === "" || body?.monthly_budget == null ? null : Number(body.monthly_budget);
    const lowBalance = body?.low_balance_threshold === "" || body?.low_balance_threshold == null ? null : Number(body.low_balance_threshold);
    const currency = monthlyBudget == null ? null : currencyCode(body?.currency);
    if (monthlyBudget != null && (!Number.isFinite(monthlyBudget) || monthlyBudget < 0 || !currency)) return json({ error: "INVALID_BUDGET" }, 400);
    if (lowBalance != null && (!Number.isFinite(lowBalance) || lowBalance < 0)) return json({ error: "INVALID_THRESHOLD" }, 400);
    const { data, error } = await sb.from("external_service_budget_settings").upsert({
      provider, monthly_budget: monthlyBudget, currency, low_balance_threshold: lowBalance,
      notes: String(body?.notes || "").trim().slice(0, 1200) || null,
      enabled: body?.enabled !== false, updated_by: session.userId, updated_at: new Date().toISOString(),
    }, { onConflict: "provider" }).select("*").single();
    if (error) throw error;
    await sb.from("external_service_admin_audit").insert({ actor_user_id: session.userId, provider, action: "budget_updated", metadata: { monthly_budget: monthlyBudget, currency, low_balance_threshold: lowBalance } });
    return json({ success: true, budget: data });
  }

  const jobKey = String(body?.job_key || "").trim();
  const enabled = body?.enabled === true;
  if (!jobKey || body?.confirmed !== true) return json({ error: "CONFIRMATION_REQUIRED", message: "La modification d’une automatisation doit être confirmée explicitement." }, 400);
  const patch: Record<string, unknown> = { enabled, updated_at: new Date().toISOString() };
  if (body?.max_runtime_seconds != null) patch.max_runtime_seconds = Math.max(30, Math.min(7200, Number(body.max_runtime_seconds)));
  if (body?.failure_threshold != null) patch.failure_threshold = Math.max(1, Math.min(20, Number(body.failure_threshold)));
  const { data, error } = await sb.from("oga_cron_controls").update(patch).eq("job_key", jobKey).select("*").maybeSingle();
  if (error) throw error;
  if (!data) return json({ error: "JOB_NOT_FOUND" }, 404);
  await sb.from("external_service_admin_audit").insert({ actor_user_id: session.userId, provider: null, action: enabled ? "cron_enabled" : "cron_disabled", metadata: { job_key: jobKey } });
  return json({ success: true, automation: data });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (!["GET", "POST"].includes(req.method)) return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const token = sessionToken(req);
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const session = await verifySessionContext(sb, token);
    if (!session) return json({ error: "AUTH_REQUIRED" }, 401);

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const adminUserResponse = await handleAdminUserPost(sb, session, body);
      if (adminUserResponse) return adminUserResponse;
      const operationsResponse = await handleOperationsPost(sb, session, body);
      if (operationsResponse) return operationsResponse;
      return await handleDeletionPost(sb, session, body);
    }

    if (!session.isAdmin) return json({ error: "FORBIDDEN" }, 403);
    const adminId = session.userId;
    const url = new URL(req.url);
    if (url.searchParams.get("action") === "external_services_governance") {
      return json(await externalServiceGovernancePayload(sb, session.userId));
    }
    const adminUsersResponse = await handleAdminUserGet(sb, adminId, url);
    if (adminUsersResponse) return adminUsersResponse;

    // Détail d'un rôle : uniquement nom, e-mail et date d'inscription.
    // Aucun mot de passe, téléphone, adresse, KYC ou autre donnée sensible n'est exposé.
    const requestedRole = url.searchParams.get("role");
    if (requestedRole) {
      const group = roleGroup(requestedRole);
      if (!group) return json({ error: "ROLE_NOT_SUPPORTED", message: "Rôle officiel inconnu." }, 404);
      const keys = [...group.aliases];
      const { data: roleRows, error: roleError } = await sb
        .from("user_roles")
        .select("user_id,role")
        .in("role", keys);
      if (roleError) throw roleError;
      const ids = [...new Set((roleRows ?? []).map((row:any) => row.user_id).filter(Boolean))];
      const members = ids.length
        ? await rows(sb, "users", "id,full_name,email,created_at", query => query.in("id", ids).order("created_at", { ascending: false }))
        : [];
      return json({
        role: group.label,
        role_key: group.key,
        role_keys: keys,
        count: members?.length ?? 0,
        members: (members ?? []).map((user:any) => ({
          id: user.id,
          name: user.full_name ?? "",
          email: user.email ?? "",
          created_at: user.created_at ?? null,
        })),
      });
    }

    if (url.searchParams.get("activity_today_detail") === "true") {
      const startToday = new Date(); startToday.setHours(0,0,0,0);
      const [adminRows,studioRows,lifecycleRows,deletionRows] = await Promise.all([
        rows(sb,"admin_audit_log","action,created_at,metadata",q=>q.gte("created_at",startToday.toISOString()).order("created_at",{ascending:false}).limit(200)),
        rows(sb,"course_studio_logs","action,created_at,course_id",q=>q.gte("created_at",startToday.toISOString()).order("created_at",{ascending:false}).limit(200)),
        rows(sb,"account_lifecycle_audit","action,reason_code,planned_reactivation_at,created_at",q=>q.gte("created_at",startToday.toISOString()).order("created_at",{ascending:false}).limit(200)),
        rows(sb,"account_deletion_audit","reason_code,completed_at",q=>q.gte("completed_at",startToday.toISOString()).order("completed_at",{ascending:false}).limit(200)),
      ]);
      const activities=[
        ...(adminRows||[]).map((r:any)=>({label:`Administration : ${String(r.action||"action").replaceAll("_"," ")}`,created_at:r.created_at,detail:r.metadata?JSON.stringify(r.metadata):"",source:"Administration"})),
        ...(studioRows||[]).map((r:any)=>({label:`Formation : ${String(r.action||"action").replaceAll("_"," ")}`,created_at:r.created_at,detail:r.course_id?`Formation ${r.course_id}`:"",source:"Studio de formation"})),
        ...(lifecycleRows||[]).map((r:any)=>({
          label:r.action==="self_reactivated"?"Compte réactivé par son titulaire":"Compte suspendu volontairement",
          created_at:r.created_at,
          detail:r.action==="self_suspended"
            ?`${accountReasonLabel(r.reason_code)}${r.planned_reactivation_at?` · retour prévu ${new Date(r.planned_reactivation_at).toLocaleDateString("fr-FR")}`:""}`
            :"Réactivation sécurisée après vérification du mot de passe",
          source:"Cycle de vie du compte",
        })),
        ...(deletionRows||[]).map((r:any)=>({
          label:"Compte supprimé définitivement",
          created_at:r.completed_at,
          detail:accountReasonLabel(r.reason_code),
          source:"Cycle de vie du compte",
        })),
      ].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
      return json({activities});
    }

    const period = url.searchParams.get("period") ?? "30d";
    const now = new Date();
    const start = new Date(now);
    if (period === "1d") start.setDate(now.getDate() - 1);
    else if (period === "7d") start.setDate(now.getDate() - 7);
    else if (period === "1y") start.setFullYear(now.getFullYear() - 1);
    else start.setDate(now.getDate() - 30);

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const dauStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      courseOrders,
      liveOrders,
      liveLedger,
      wallets,
      activeSessions,
      newUsersToday,
      courseSubmissionsToday,
      liveCreatedToday,
      payoutToday,
      livePayoutToday,
      pricingPending,
      pricingProfessor,
      pedagogicPending,
      readyPublish,
      publishedCourses,
      liveValidation,
      livePublished,
      liveNow,
      liveRefunds,
      livePayouts,
      organizerPending,
      structurePending,
      structureActive,
      userRoles,
      siteSettings,
      jobPending,
      forumReports,
      auditLogs,
      courseStudioLogs,
    ] = await Promise.all([
      rows(sb, "orders", "final_price_xof,platform_share_xof,payment_gateway,paid_at,user_id", q =>
        q.eq("payment_status", "paid").gte("paid_at", start.toISOString())
      ),
      rows(sb, "live_orders", "amount,payment_provider,paid_at,user_id", q =>
        q.eq("payment_status", "paid").gte("paid_at", start.toISOString())
      ),
      rows(sb, "live_organizer_ledger", "entry_type,oga_amount,organizer_amount,status,created_at", q =>
        q.gte("created_at", start.toISOString())
      ),
      rows(sb, "wallets", "balance_xof"),
      rows(sb, "user_sessions", "user_id,created_at", q => q.gte("created_at", dauStart.toISOString())),
      countRows(sb, "users", q => q.gte("created_at", todayStart.toISOString()).neq("id", adminId)),
      countRows(sb, "courses", q => q.eq("studio_status", "pending_validation").gte("submitted_at", todayStart.toISOString())),
      countRows(sb, "live_events", q => q.gte("created_at", todayStart.toISOString())),
      countRows(sb, "payout_requests", q => q.gte("requested_at", todayStart.toISOString())),
      countRows(sb, "live_payout_requests", q => q.gte("created_at", todayStart.toISOString())),
      countRows(sb, "courses", q => q.eq("pricing_status", "en_attente_validation_prix_admin")),
      countRows(sb, "courses", q => q.eq("pricing_status", "en_attente_acceptation_prix_professeur")),
      countRows(sb, "courses", q => q.eq("studio_status", "pending_validation")),
      countRows(sb, "courses", q => q.eq("studio_status", "validated").eq("is_published", false)),
      countRows(sb, "courses", q => q.eq("is_published", true)),
      countRows(sb, "live_events", q => q.in("status", ["submitted", "under_review"])),
      countRows(sb, "live_events", q => q.in("status", ["approved", "published"])),
      countRows(sb, "live_events", q => q.eq("status", "live")),
      countRows(sb, "live_refund_requests", q => q.in("status", ["pending", "under_review", "approved", "partially_approved"])),
      countRows(sb, "live_payout_requests", q => q.in("status", ["pending", "under_review", "approved"])),
      countRows(sb, "live_organizer_applications", q => q.eq("status", "pending")),
      countRows(sb, "partner_organizations", q => q.eq("status", "pending")),
      countRows(sb, "partner_organizations", q => q.eq("status", "validated")),
      rows(sb, "user_roles", "role,user_id"),
      rows(sb, "site_settings", "key,value", q =>
        q.in("key", [
          "maintenance_enabled",
          "maintenance_module_omnia_live",
          "maintenance_module_career",
          "maintenance_module_talent",
          "maintenance_module_forum",
          "maintenance_module_payments",
          "maintenance_module_formations",
        ])
      ),
      countRows(sb, "job_offers", q => q.eq("status", "pending_moderation")),
      countRows(sb, "forum_reports", q => q.eq("status", "pending")),
      rows(sb, "admin_audit_log", "action,created_at", q => q.order("created_at", { ascending: false }).limit(6)),
      rows(sb, "course_studio_logs", "action,created_at", q => q.order("created_at", { ascending: false }).limit(6)),
    ]);

    const caCourse = sum(courseOrders, "final_price_xof");
    const caLive = sum(liveOrders, "amount");
    const caEncaisse = caCourse == null && caLive == null ? null : Number(caCourse ?? 0) + Number(caLive ?? 0);

    const platformCourse = sum(courseOrders, "platform_share_xof");
    const platformLive = liveLedger
      ? liveLedger
          .filter((row: any) => row.entry_type === "sale")
          .reduce((s: number, row: any) => s + Number(row.oga_amount ?? 0), 0)
      : null;
    const revenuOmnia = platformCourse == null && platformLive == null
      ? null
      : Number(platformCourse ?? 0) + Number(platformLive ?? 0);

    const walletBalance = sum(wallets, "balance_xof");
    const organizerDue = liveLedger
      ? liveLedger
          .filter((row: any) => ["pending", "available"].includes(row.status))
          .reduce((s: number, row: any) => s + Number(row.organizer_amount ?? 0), 0)
      : null;
    const aReverser = walletBalance == null && organizerDue == null
      ? null
      : Number(walletBalance ?? 0) + Number(organizerDue ?? 0);

    const dau = activeSessions
      ? new Set(activeSessions.map((row: any) => row.user_id).filter((id: unknown) => Boolean(id) && String(id) !== adminId)).size
      : null;

    const salesMap: Record<string, { amount_xof: number; count: number }> = {};
    for (const row of courseOrders ?? []) {
      const day = dayKey(row.paid_at);
      if (!day) continue;
      salesMap[day] ??= { amount_xof: 0, count: 0 };
      salesMap[day].amount_xof += Number(row.final_price_xof ?? 0);
      salesMap[day].count += 1;
    }
    for (const row of liveOrders ?? []) {
      const day = dayKey(row.paid_at);
      if (!day) continue;
      salesMap[day] ??= { amount_xof: 0, count: 0 };
      salesMap[day].amount_xof += Number(row.amount ?? 0);
      salesMap[day].count += 1;
    }
    const ventesEvolution = Object.entries(salesMap)
      .map(([date, value]) => ({ date, ...value }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const paymentMap: Record<string, { count: number; amount_xof: number }> = {};
    for (const row of courseOrders ?? []) {
      const gateway = row.payment_gateway || "Non renseigné";
      paymentMap[gateway] ??= { count: 0, amount_xof: 0 };
      paymentMap[gateway].count += 1;
      paymentMap[gateway].amount_xof += Number(row.final_price_xof ?? 0);
    }
    for (const row of liveOrders ?? []) {
      const gateway = row.payment_provider || "Non renseigné";
      paymentMap[gateway] ??= { count: 0, amount_xof: 0 };
      paymentMap[gateway].count += 1;
      paymentMap[gateway].amount_xof += Number(row.amount ?? 0);
    }
    const paymentTotal = Object.values(paymentMap).reduce((s, row) => s + row.amount_xof, 0);
    const paymentRows = Object.entries(paymentMap)
      .map(([gateway, row]) => ({
        gateway,
        ...row,
        percent: paymentTotal > 0 ? row.amount_xof / paymentTotal * 100 : 0,
      }))
      .sort((a, b) => b.amount_xof - a.amount_xof);

    // Seuls les rôles officiels sont exposés dans le Dashboard.
    // Les anciens alias restent regroupés silencieusement pour la compatibilité des comptes existants.
    const protectedUserIds = new Set((userRoles ?? [])
      .filter((row:any) => String(row.role) === "super_admin")
      .map((row:any) => String(row.user_id)));
    const allUserIds = [...new Set((userRoles ?? [])
      .map((row:any) => row.user_id)
      .filter((id: unknown) => Boolean(id) && !protectedUserIds.has(String(id))))];
    const userRows = allUserIds.length
      ? await rows(sb, "users", "id,full_name,email", query => query.in("id", allUserIds))
      : [];
    const usersById = new Map((userRows ?? []).map((user:any) => [user.id, user]));

    const usersByRole = PRIMARY_ROLE_GROUPS.map((group) => {
      const ids = [...new Set(
        (userRoles ?? [])
          .filter((row:any) => group.aliases.includes(row.role))
          .map((row:any) => row.user_id)
          .filter((id: unknown) => Boolean(id) && !protectedUserIds.has(String(id))),
      )];
      return {
        role: group.label,
        role_key: group.key,
        role_keys: [...group.aliases],
        count: ids.length,
        members: ids.map((id:string) => {
          const user:any = usersById.get(id);
          return { id, name: user?.full_name ?? "", email: user?.email ?? "" };
        }),
      };
    });

    const settingsMap: Record<string, any> = {};
    for (const row of siteSettings ?? []) settingsMap[row.key] = row.value;
    const isTrue = (v: any) => v === true || v === "true";
    const maintenanceModules = [
      ["Omnia Live", "maintenance_module_omnia_live"],
      ["Omnia Career", "maintenance_module_career"],
      ["Omnia Talent", "maintenance_module_talent"],
      ["Forum", "maintenance_module_forum"],
      ["Paiements", "maintenance_module_payments"],
      ["Formations", "maintenance_module_formations"],
    ].filter(([, key]) => isTrue(settingsMap[key])).map(([label]) => label);

    const payoutPending = await countRows(sb, "payout_requests", q => q.eq("status", "pending"));

    const actions = [
      { key: "pricing", label: "Tarifications de formations à valider", count: pricingPending ?? 0, path: "/admin/course-pricing", detail: "Choisir le prix avant acceptation du professeur", priority: "high" },
      { key: "pedagogy", label: "Formations en validation pédagogique", count: pedagogicPending ?? 0, path: "/admin/studio-validation", detail: "Contenu soumis par les créateurs" },
      { key: "payouts", label: "Retraits à traiter", count: payoutPending ?? 0, path: "/admin/payouts", detail: "Demandes de reversement classiques" },
      { key: "structures", label: "Structures à valider", count: structurePending ?? 0, path: "/admin/structures" },
      { key: "jobs", label: "Offres d’emploi à modérer", count: jobPending ?? 0, path: "/admin/offres-emploi" },
      { key: "live-validation", label: "Événements Omnia Live à valider", count: liveValidation ?? 0, path: "/admin/omnia-live" },
      { key: "live-refunds", label: "Remboursements Omnia Live à traiter", count: liveRefunds ?? 0, path: "/admin/omnia-live", priority: "high" },
      { key: "live-payouts", label: "Retraits organisateurs Omnia Live", count: livePayouts ?? 0, path: "/admin/omnia-live" },
      { key: "organizers", label: "Organisateurs à valider", count: organizerPending ?? 0, path: "/admin/omnia-live" },
      { key: "forum", label: "Signalements Forum à examiner", count: forumReports ?? 0, path: "/admin/forum" },
    ].filter(item => item.count > 0);

    const combinedActivity = [
      ...(auditLogs ?? []).map((row: any) => ({
        label: `Administration : ${String(row.action || "action").replaceAll("_", " ")}`,
        created_at: row.created_at,
      })),
      ...(courseStudioLogs ?? []).map((row: any) => ({
        label: `Formation : ${String(row.action || "action").replaceAll("_", " ")}`,
        created_at: row.created_at,
      })),
    ]
      .filter(row => row.created_at)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, 8);

    const geoRows = await rows(sb, "orders", "final_price_xof,paid_at,users!inner(country_code)", q =>
      q.eq("payment_status", "paid").gte("paid_at", start.toISOString())
    );
    const geoMap: Record<string, { sales_count: number; amount_xof: number }> = {};
    for (const row of geoRows ?? []) {
      const code = String(row.users?.country_code || "—").toUpperCase();
      geoMap[code] ??= { sales_count: 0, amount_xof: 0 };
      geoMap[code].sales_count += 1;
      geoMap[code].amount_xof += Number(row.final_price_xof ?? 0);
    }

    return json({
      period,
      kpis: {
        ca_encaisse_xof: caEncaisse,
        revenu_omnia_xof: revenuOmnia,
        a_reverser_xof: aReverser,
        utilisateurs_actifs_24h: dau,
      },
      activity_today: {
        nouveaux_utilisateurs: newUsersToday,
        commandes_payees:
          courseOrders == null && liveOrders == null
            ? null
            : (courseOrders ?? []).filter((o: any) => o.paid_at >= todayStart.toISOString()).length
              + (liveOrders ?? []).filter((o: any) => o.paid_at >= todayStart.toISOString()).length,
        formations_soumises: courseSubmissionsToday,
        lives_crees: liveCreatedToday,
        retraits_demandes:
          payoutToday == null && livePayoutToday == null ? null : Number(payoutToday ?? 0) + Number(livePayoutToday ?? 0),
      },
      actions,
      ventes_evolution: ventesEvolution,
      repartition_geo: Object.entries(geoMap)
        .map(([country_code, value]) => ({ country_code, ...value }))
        .sort((a, b) => b.amount_xof - a.amount_xof)
        .slice(0, 10),
      paiements: {
        available: paymentRows.length > 0,
        rows: paymentRows,
      },
      formations: {
        attente_tarification: pricingPending,
        attente_acceptation_professeur: pricingProfessor,
        validation_pedagogique: pedagogicPending,
        pretes_a_publier: readyPublish,
        publiees: publishedCourses,
      },
      omnia_live: {
        validation: liveValidation,
        programmes_ou_publies: livePublished,
        en_direct: liveNow,
        remboursements: liveRefunds,
        retraits: livePayouts,
        organisateurs: organizerPending,
      },
      structures: {
        en_attente: structurePending,
        actives: structureActive,
      },
      users_by_role: usersByRole,
      platform: {
        maintenance_global: isTrue(settingsMap.maintenance_enabled),
        maintenance_modules: maintenanceModules,
      },
      latest_admin_activity: combinedActivity,
    });
  } catch (error) {
    console.error("[dashboard-admin]", error);
    return json({
      error: "SERVER_ERROR",
      message: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});
