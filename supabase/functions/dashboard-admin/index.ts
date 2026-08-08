import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { createAccessInvitation } from "../_shared/access-invitations.ts";

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
  recruteur_structure: "Recruteur rattaché à une Structure",
};
const CANONICAL_PRIMARY_BY_STORED: Record<string, string> = {
  apprenant: "apprenant", professeur: "professeur", formateur: "professeur", enseignant: "professeur", etablissement_enseignant: "professeur",
  structure: "structure", responsable_structure: "structure", directeur: "structure", etablissement_directeur: "structure",
  organisateur: "organisateur", organizer: "organisateur", recruteur: "recruteur", recruteur_independant: "recruteur",
  coach: "coach", moderateur: "moderateur", moderator: "moderateur",
};
const DELEGATED_ROLES = new Set(["gestionnaire_structure", "recruteur_structure"]);
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
  const { data: session } = await sb
    .from("user_sessions")
    .select("user_id")
    .eq("session_token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
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
      return await handleDeletionPost(sb, session, body);
    }

    if (!session.isAdmin) return json({ error: "FORBIDDEN" }, 403);
    const adminId = session.userId;
    const url = new URL(req.url);
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
