import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-omnia-session-token",
  "X-Content-Type-Options": "nosniff",
};

const STRUCTURE_CREATOR_ROLES = new Set([
  "responsable_structure",
  "structure_admin",
  "gestionnaire_partenaire",
  "directeur",
  "etablissement_directeur",
]);
const PROFESSOR_ROLES = new Set(["professeur", "professor", "teacher", "instructor"]);

const ADMIN_ROLES = new Set(["super_admin"]);
const PROJECT_STATUSES = new Set([
  "draft", "pending_validation", "changes_requested", "published", "selection",
  "in_progress", "suspended", "closed", "archived", "rejected",
]);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function text(value: unknown, max = 10000) {
  return String(value ?? "").trim().slice(0, max);
}

function textArray(value: unknown, maxItems = 50, maxLength = 120) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => text(item, maxLength)).filter(Boolean).slice(0, maxItems);
}

function objectValue(value: unknown, fallback: Record<string, unknown> = {}) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
}

function jsonValue(value: unknown, fallback: Record<string, unknown> | unknown[] = {}) {
  return value && typeof value === "object" ? value : fallback;
}

function rewardDetailsValue(value: unknown) {
  const source = objectValue(value, {});
  const amount = source.amount_minor == null || source.amount_minor === "" ? null : Math.max(0, Math.round(Number(source.amount_minor)));
  return {
    description: text(source.description, 5000),
    amount_minor: Number.isFinite(amount) ? amount : null,
    currency: text(source.currency, 8).toUpperCase() || null,
  };
}

function safeSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "projet";
}

function tokenFrom(req: Request, bodyToken = "") {
  return (
    bodyToken ||
    req.headers.get("x-omnia-session-token") ||
    req.headers.get("Authorization") ||
    ""
  ).replace(/^Bearer\s+/i, "").trim();
}

type Session = {
  userId: string;
  roles: string[];
  user: Record<string, unknown> | null;
  organizationId: string | null;
  organizationName: string | null;
};

async function authenticate(sb: any, req: Request, bodyToken = ""): Promise<Session | null> {
  const token = tokenFrom(req, bodyToken);
  if (!token) return null;

  const { data: session } = await sb
    .from("user_sessions")
    .select("user_id")
    .eq("session_token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!session?.user_id) return null;

  const userId = String(session.user_id);
  const [{ data: roleRows }, { data: user }, { data: manager }] = await Promise.all([
    sb.from("user_roles").select("role").eq("user_id", userId),
    sb.from("users").select("id,full_name,email,avatar_url,status,country_code").eq("id", userId).maybeSingle(),
    sb.from("partner_managers")
      .select("organization_id,status,is_primary")
      .eq("user_id", userId)
      .neq("status", "retire")
      .order("is_primary", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  let organizationName: string | null = null;
  if (manager?.organization_id) {
    const { data: organization } = await sb
      .from("partner_organizations")
      .select("org_name")
      .eq("id", manager.organization_id)
      .maybeSingle();
    organizationName = organization?.org_name || null;
  }

  return {
    userId,
    roles: (roleRows || []).map((row: any) => String(row.role)),
    user: user || null,
    organizationId: manager?.organization_id ? String(manager.organization_id) : null,
    organizationName,
  };
}

function requireSession(session: Session | null): asserts session is Session {
  if (!session) throw new Error("AUTH_REQUIRED");
}

function isAdmin(session: Session | null) {
  return Boolean(session?.roles.some((role) => ADMIN_ROLES.has(role)));
}

function canUseOwnerWorkspace(session: Session | null) {
  return Boolean(session && (
    isAdmin(session)
    || session.roles.some((role) => STRUCTURE_CREATOR_ROLES.has(String(role).toLowerCase()))
    || session.roles.some((role) => PROFESSOR_ROLES.has(String(role).toLowerCase()))
  ));
}

async function canCreate(sb: any, session: Session | null, projectType = "") {
  if (!session) return false;
  if (isAdmin(session)) return true;
  if (session.roles.some((role) => STRUCTURE_CREATOR_ROLES.has(String(role).toLowerCase()))) return true;
  if (!session.roles.some((role) => PROFESSOR_ROLES.has(String(role).toLowerCase()))) return false;

  const { data: permission } = await sb
    .from("omnia_project_creator_permissions")
    .select("status,allowed_project_types,organization_scope_id")
    .eq("user_id", session.userId)
    .maybeSingle();
  if (!permission || permission.status !== "allowed") return false;
  if (permission.organization_scope_id && String(permission.organization_scope_id) !== String(session.organizationId || "")) return false;
  if (!projectType) return true;
  return Array.isArray(permission.allowed_project_types) && permission.allowed_project_types.includes(projectType);
}

async function projectById(sb: any, projectId: string) {
  const { data, error } = await sb.from("omnia_projects").select("*").eq("id", projectId).maybeSingle();
  if (error) throw error;
  return data;
}

async function canManageProject(sb: any, session: Session, project: any) {
  if (isAdmin(session)) return true;
  if (String(project.creator_user_id) === session.userId) return true;
  if (project.organization_id && session.organizationId === String(project.organization_id)) return canCreate(sb, session, String(project.project_type || ""));
  const { data: projectTeams } = await sb.from("omnia_project_teams").select("id").eq("project_id", project.id);
  const teamIds = (projectTeams || []).map((row: any) => row.id);
  if (!teamIds.length) return false;
  const { data: member } = await sb
    .from("omnia_project_team_members")
    .select("member_role,invitation_status")
    .in("team_id", teamIds)
    .eq("user_id", session.userId)
    .eq("member_role", "mentor")
    .eq("invitation_status", "accepted")
    .limit(1)
    .maybeSingle();
  return Boolean(member);
}

async function hasProjectAccess(sb: any, session: Session | null, project: any) {
  if (project.status !== "published" && project.status !== "selection" && project.status !== "in_progress" && project.status !== "closed") {
    if (!session) return false;
    return canManageProject(sb, session, project);
  }
  if (project.visibility === "public") return true;
  if (!session) return false;
  if (await canManageProject(sb, session, project)) return true;
  if (project.visibility === "authenticated") return true;
  if (project.visibility === "structure" && session.organizationId && String(project.visibility_structure_id) === session.organizationId) return true;
  const { data: invitation } = await sb
    .from("omnia_project_invitations")
    .select("id,expires_at")
    .eq("project_id", project.id)
    .eq("invited_user_id", session.userId)
    .eq("status", "accepted")
    .limit(1)
    .maybeSingle();
  if (invitation && (!invitation.expires_at || new Date(invitation.expires_at).getTime() > Date.now())) return true;
  const { data: projectTeams } = await sb.from("omnia_project_teams").select("id").eq("project_id", project.id);
  const teamIds = (projectTeams || []).map((row: any) => row.id);
  if (teamIds.length) {
    const { data: member } = await sb
      .from("omnia_project_team_members")
      .select("id")
      .in("team_id", teamIds)
      .eq("user_id", session.userId)
      .eq("invitation_status", "accepted")
      .limit(1)
      .maybeSingle();
    if (member) return true;
  }
  const { data: application } = await sb
    .from("omnia_project_applications")
    .select("id")
    .eq("project_id", project.id)
    .eq("applicant_user_id", session.userId)
    .limit(1)
    .maybeSingle();
  return Boolean(application);
}

async function hasParticipantAccess(sb: any, session: Session, project: any) {
  if (await canManageProject(sb, session, project)) return true;
  const { data: application } = await sb
    .from("omnia_project_applications")
    .select("id")
    .eq("project_id", project.id)
    .eq("applicant_user_id", session.userId)
    .eq("status", "selected")
    .limit(1)
    .maybeSingle();
  if (application) return true;
  const { data: projectTeams } = await sb
    .from("omnia_project_teams")
    .select("id")
    .eq("project_id", project.id)
    .in("status", ["selected", "active", "completed"]);
  const teamIds = (projectTeams || []).map((row: any) => row.id);
  if (!teamIds.length) return false;
  const { data: membership } = await sb
    .from("omnia_project_team_members")
    .select("id")
    .in("team_id", teamIds)
    .eq("user_id", session.userId)
    .eq("invitation_status", "accepted")
    .limit(1)
    .maybeSingle();
  return Boolean(membership);
}

async function acceptedTeamSize(sb: any, teamId: string) {
  const { count, error } = await sb
    .from("omnia_project_team_members")
    .select("id", { count: "exact", head: true })
    .eq("team_id", teamId)
    .eq("invitation_status", "accepted")
    .not("member_role", "eq", "observer");
  if (error) throw error;
  return count || 0;
}

async function selectedParticipantCount(sb: any, projectId: string, excludedApplicationId = "") {
  let query = sb
    .from("omnia_project_applications")
    .select("id,application_mode,team_id")
    .eq("project_id", projectId)
    .eq("status", "selected");
  if (excludedApplicationId) query = query.neq("id", excludedApplicationId);
  const { data: rows, error } = await query;
  if (error) throw error;
  let total = 0;
  for (const row of rows || []) {
    total += row.application_mode === "team" && row.team_id ? await acceptedTeamSize(sb, row.team_id) : 1;
  }
  return total;
}

async function audit(sb: any, projectId: string | null, actorUserId: string | null, action: string, entityType = "project", entityId: string | null = null, previousData: unknown = null, newData: unknown = null, metadata: Record<string, unknown> = {}) {
  await sb.from("omnia_project_audit_log").insert({
    project_id: projectId,
    actor_user_id: actorUserId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    previous_data: previousData,
    new_data: newData,
    metadata,
  });
}

function sanitizeProject(project: any, privileged = false) {
  const result = { ...project };
  if (!privileged) {
    delete result.admin_feedback;
    if (["confidential", "strictly_confidential"].includes(project.confidentiality_level)) {
      result.attachments = [];
      result.ip_policy_details = project.ip_policy_details ? "Les conditions détaillées sont accessibles après autorisation." : null;
    }
  }
  return result;
}

async function uniqueSlug(sb: any, title: string, projectId?: string) {
  const base = safeSlug(title);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    let query = sb.from("omnia_projects").select("id").eq("slug", candidate);
    if (projectId) query = query.neq("id", projectId);
    const { data } = await query.limit(1).maybeSingle();
    if (!data) return candidate;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

function projectPatch(body: Record<string, any>) {
  const patch: Record<string, unknown> = {};
  const strings: Record<string, number> = {
    title: 180,
    short_description: 420,
    description: 30000,
    problem_statement: 12000,
    objectives: 12000,
    project_type: 60,
    organization_name: 180,
    organization_type: 80,
    country_code: 8,
    city: 120,
    visibility: 40,
    level: 40,
    participation_mode: 40,
    team_creation_mode: 40,
    selection_mode: 40,
    deliverables_summary: 10000,
    confidentiality_level: 60,
    portfolio_policy: 60,
    ip_policy: 80,
    ip_policy_details: 12000,
    reward_type: 80,
    reward_funding_status: 60,
    recruitment_disclaimer: 1000,
    cover_url: 2000,
  };
  for (const [key, max] of Object.entries(strings)) {
    if (key in body) patch[key] = text(body[key], max) || null;
  }
  for (const key of ["visibility_structure_id", "visibility_cohort_id"]) {
    if (key in body) patch[key] = text(body[key], 80) || null;
  }
  for (const key of ["application_opens_at", "application_closes_at", "starts_at", "ends_at"]) {
    if (key in body) patch[key] = body[key] ? new Date(body[key]).toISOString() : null;
  }
  for (const key of ["min_participants", "min_team_size"]) {
    if (key in body) patch[key] = Math.max(1, Number(body[key] || 1));
  }
  for (const key of ["max_participants", "max_team_size"]) {
    if (key in body) patch[key] = body[key] === "" || body[key] == null ? null : Math.max(1, Number(body[key]));
  }
  if ("estimated_hours" in body) patch.estimated_hours = body.estimated_hours === "" || body.estimated_hours == null ? null : Math.max(0, Number(body.estimated_hours));
  for (const key of ["nda_required", "public_deliverables_allowed", "recruitment_opportunity"]) {
    if (key in body) patch[key] = Boolean(body[key]);
  }
  for (const key of ["geographic_scope", "languages", "required_skills", "prerequisite_course_ids", "prerequisite_credential_ids"]) {
    if (key in body) patch[key] = textArray(body[key], 100, 160);
  }
  for (const key of ["evaluation_criteria", "supervisors", "settings"]) {
    if (key in body) patch[key] = jsonValue(body[key], key === "settings" ? {} : []);
  }
  if ("reward_details" in body) patch.reward_details = rewardDetailsValue(body.reward_details);
  if ("attachments" in body) patch.attachments = Array.isArray(body.attachments) ? body.attachments.slice(0, 30) : [];
  return patch;
}

async function enrichProjects(sb: any, projects: any[], session: Session | null) {
  if (!projects.length) return [];
  const ids = projects.map((project) => project.id);
  const [{ data: applications }, { data: teams }] = await Promise.all([
    sb.from("omnia_project_applications").select("project_id,status").in("project_id", ids),
    sb.from("omnia_project_teams").select("project_id,status").in("project_id", ids),
  ]);
  const applicationCounts = new Map<string, number>();
  const selectedCounts = new Map<string, number>();
  const teamCounts = new Map<string, number>();
  for (const row of applications || []) {
    applicationCounts.set(row.project_id, (applicationCounts.get(row.project_id) || 0) + 1);
    if (row.status === "selected") selectedCounts.set(row.project_id, (selectedCounts.get(row.project_id) || 0) + 1);
  }
  for (const row of teams || []) teamCounts.set(row.project_id, (teamCounts.get(row.project_id) || 0) + 1);
  return projects.map((project) => ({
    ...sanitizeProject(project, Boolean(session && (isAdmin(session) || project.creator_user_id === session.userId))),
    application_count: applicationCounts.get(project.id) || 0,
    selected_count: selectedCounts.get(project.id) || 0,
    team_count: teamCounts.get(project.id) || 0,
  }));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const action = text(body.action || "list", 80);
    const session = await authenticate(sb, req, text(body.session_token, 400));

    if (action === "context") {
      return json({
        authenticated: Boolean(session),
        user: session?.user || null,
        roles: session?.roles || [],
        organization_id: session?.organizationId || null,
        organization_name: session?.organizationName || null,
        can_create: await canCreate(sb, session),
        is_admin: isAdmin(session),
      });
    }

    if (action === "list") {
      const page = Math.max(1, Number(body.page || 1));
      const pageSize = Math.min(50, Math.max(6, Number(body.page_size || 18)));
      let query = sb.from("omnia_projects").select("*", { count: "exact" })
        .in("status", ["published", "selection", "in_progress", "closed"])
        .order("published_at", { ascending: false, nullsFirst: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      const q = text(body.q, 160);
      if (q) query = query.or(`title.ilike.%${q.replace(/[%_,]/g, "")}%,short_description.ilike.%${q.replace(/[%_,]/g, "")}%,description.ilike.%${q.replace(/[%_,]/g, "")}%`);
      if (body.project_type) query = query.eq("project_type", text(body.project_type, 60));
      if (body.level) query = query.eq("level", text(body.level, 40));
      if (body.country_code) query = query.eq("country_code", text(body.country_code, 8));
      if (body.participation_mode) query = query.eq("participation_mode", text(body.participation_mode, 40));
      if (!session) query = query.eq("visibility", "public");
      else if (!isAdmin(session)) {
        const orgId = session.organizationId || "00000000-0000-0000-0000-000000000000";
        query = query.or(`visibility.in.(public,authenticated),visibility_structure_id.eq.${orgId},creator_user_id.eq.${session.userId}`);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return json({ projects: await enrichProjects(sb, data || [], session), page, page_size: pageSize, total: count || 0 });
    }

    if (action === "detail") {
      const projectId = text(body.project_id, 80);
      const slug = text(body.slug, 120);
      let query = sb.from("omnia_projects").select("*");
      query = projectId ? query.eq("id", projectId) : query.eq("slug", slug);
      const { data: project, error } = await query.maybeSingle();
      if (error) throw error;
      if (!project) return json({ error: "PROJECT_NOT_FOUND" }, 404);
      if (!(await hasProjectAccess(sb, session, project))) return json({ error: "PROJECT_ACCESS_DENIED" }, 403);

      const privileged = Boolean(session && (isAdmin(session) || await canManageProject(sb, session, project)));
      const { data: detailTeams } = await sb.from("omnia_project_teams").select("id").eq("project_id", project.id);
      const detailTeamIds = (detailTeams || []).map((row: any) => row.id);
      const [{ data: milestones }, { data: rewards }, { data: ownApplication }, { data: teamMembership }, { data: deliverables }, { data: managedTeams }, { data: partners }] = await Promise.all([
        sb.from("omnia_project_milestones").select("*").eq("project_id", project.id).order("sequence_no"),
        sb.from("omnia_project_rewards").select("id,reward_type,title,description,amount_minor,currency,funding_status,validation_status").eq("project_id", project.id).in("validation_status", privileged ? ["pending", "approved", "delivered", "rejected", "cancelled"] : ["approved", "delivered"]),
        session ? sb.from("omnia_project_applications").select("*").eq("project_id", project.id).eq("applicant_user_id", session.userId).maybeSingle() : Promise.resolve({ data: null }),
        session && detailTeamIds.length ? sb.from("omnia_project_team_members").select("*,team:omnia_project_teams(*)").in("team_id", detailTeamIds).eq("user_id", session.userId).eq("invitation_status", "accepted") : Promise.resolve({ data: [] }),
        privileged
          ? sb.from("omnia_project_deliverables").select("*,milestone:omnia_project_milestones(id,title),team:omnia_project_teams(id,name),submitter:users!omnia_project_deliverables_submitted_by_fkey(id,full_name,email)").eq("project_id", project.id).order("submitted_at", { ascending: false })
          : Promise.resolve({ data: [] }),
        privileged
          ? sb.from("omnia_project_teams").select("*,members:omnia_project_team_members(id,user_id,member_role,invitation_status,user:users!omnia_project_team_members_user_id_fkey(id,full_name,email))").eq("project_id", project.id).order("created_at", { ascending: false })
          : Promise.resolve({ data: [] }),
        sb.from("omnia_project_partners").select("*").eq("project_id", project.id).in("status", privileged ? ["proposed", "confirmed", "declined", "withdrawn"] : ["confirmed"]).order("created_at", { ascending: true }),
      ]);
      return json({ project: sanitizeProject(project, privileged), milestones: milestones || [], rewards: rewards || [], own_application: ownApplication || null, memberships: teamMembership || [], deliverables: deliverables || [], teams: managedTeams || [], partners: partners || [], privileged });
    }

    if (action === "my_workspace") {
      requireSession(session);
      const [{ data: applications }, { data: memberships }, { data: invitations }, { data: projectInvitations }, { data: deliverables }] = await Promise.all([
        sb.from("omnia_project_applications").select("*,project:omnia_projects(id,slug,title,project_type,status,starts_at,ends_at,organization_name,cover_url)").eq("applicant_user_id", session.userId).order("submitted_at", { ascending: false }),
        sb.from("omnia_project_team_members").select("*,team:omnia_project_teams(*,project:omnia_projects(id,slug,title,status,starts_at,ends_at))").eq("user_id", session.userId).eq("invitation_status", "accepted").order("created_at", { ascending: false }),
        sb.from("omnia_project_team_members").select("*,team:omnia_project_teams(*,project:omnia_projects(id,slug,title,status))").eq("user_id", session.userId).eq("invitation_status", "pending").order("invited_at", { ascending: false }),
        sb.from("omnia_project_invitations").select("*,project:omnia_projects(id,slug,title,status,organization_name),team:omnia_project_teams(id,name)").eq("invited_user_id", session.userId).in("status", ["pending", "accepted"]).order("invited_at", { ascending: false }),
        sb.from("omnia_project_deliverables").select("*,project:omnia_projects(id,slug,title),milestone:omnia_project_milestones(id,title)").eq("submitted_by", session.userId).order("submitted_at", { ascending: false }),
      ]);
      return json({ applications: applications || [], memberships: memberships || [], invitations: invitations || [], project_invitations: projectInvitations || [], deliverables: deliverables || [] });
    }

    if (action === "owner_dashboard") {
      requireSession(session);
      if (!canUseOwnerWorkspace(session)) return json({ error: "FORBIDDEN" }, 403);
      let query = sb.from("omnia_projects").select("*").order("created_at", { ascending: false });
      if (!isAdmin(session)) {
        if (session.organizationId) query = query.or(`creator_user_id.eq.${session.userId},organization_id.eq.${session.organizationId}`);
        else query = query.eq("creator_user_id", session.userId);
      }
      const { data: projects, error } = await query;
      if (error) throw error;
      return json({ projects: await enrichProjects(sb, projects || [], session), can_create: await canCreate(sb, session) });
    }

    if (action === "create") {
      requireSession(session);
      const requestedType = text(body.project_type, 60) || "real_project";
      if (!(await canCreate(sb, session, requestedType))) {
        const professor = session.roles.some((role) => PROFESSOR_ROLES.has(String(role).toLowerCase()));
        return json({ error: professor ? "PROFESSOR_PROJECT_PERMISSION_REQUIRED" : "CREATOR_ROLE_REQUIRED" }, 403);
      }
      if (!text(body.title, 180) || !text(body.description, 30000)) return json({ error: "TITLE_AND_DESCRIPTION_REQUIRED" }, 400);

      const patch = projectPatch(body);
      const title = text(body.title, 180);
      const slug = await uniqueSlug(sb, title);
      const organizationId = isAdmin(session) && body.organization_id ? text(body.organization_id, 80) : session.organizationId;
      const organizationName = isAdmin(session)
        ? text(body.organization_name, 180) || session.organizationName || "Omnia Global Academy"
        : session.organizationName || text(session.user?.full_name, 180) || "Omnia Global Academy";
      if (patch.visibility === "structure" && !patch.visibility_structure_id) patch.visibility_structure_id = organizationId || null;
      if (patch.reward_type === "financial_prize") patch.reward_funding_status = "unverified";
      const { data: project, error } = await sb.from("omnia_projects").insert({
        ...patch,
        slug,
        title,
        description: text(body.description, 30000),
        creator_user_id: session.userId,
        organization_id: organizationId || null,
        organization_name: organizationName,
        status: "draft",
      }).select("*").single();
      if (error) throw error;
      await audit(sb, project.id, session.userId, "project_created", "project", project.id, null, project);
      return json({ success: true, project }, 201);
    }

    if (action === "update") {
      requireSession(session);
      const project = await projectById(sb, text(body.project_id, 80));
      if (!project) return json({ error: "PROJECT_NOT_FOUND" }, 404);
      if (!(await canManageProject(sb, session, project))) return json({ error: "FORBIDDEN" }, 403);
      if (!["draft", "changes_requested"].includes(project.status) && !isAdmin(session)) return json({ error: "PROJECT_LOCKED" }, 409);
      const patch = projectPatch(body);
      if (!isAdmin(session)) {
        delete patch.organization_name;
        delete patch.organization_type;
        delete patch.reward_funding_status;
      }
      if (patch.title && patch.title !== project.title) patch.slug = await uniqueSlug(sb, String(patch.title), project.id);
      if (patch.visibility === "structure" && !patch.visibility_structure_id) patch.visibility_structure_id = project.organization_id || session.organizationId || null;
      const nextRewardType = String(patch.reward_type || project.reward_type);
      if (nextRewardType === "financial_prize") {
        if (project.reward_type !== "financial_prize" || "reward_details" in body) patch.reward_funding_status = "unverified";
      } else if (patch.reward_type) patch.reward_funding_status = "not_applicable";
      delete patch.status;
      const { data: updated, error } = await sb.from("omnia_projects").update(patch).eq("id", project.id).select("*").single();
      if (error) throw error;
      await audit(sb, project.id, session.userId, "project_updated", "project", project.id, project, updated);
      return json({ success: true, project: updated });
    }

    if (action === "submit") {
      requireSession(session);
      const project = await projectById(sb, text(body.project_id, 80));
      if (!project) return json({ error: "PROJECT_NOT_FOUND" }, 404);
      if (!(await canManageProject(sb, session, project))) return json({ error: "FORBIDDEN" }, 403);
      if (!["draft", "changes_requested", "rejected"].includes(project.status)) return json({ error: "INVALID_PROJECT_STATUS" }, 409);
      const { data: updated, error } = await sb.from("omnia_projects").update({ status: "pending_validation", submitted_at: new Date().toISOString(), admin_feedback: null }).eq("id", project.id).select("*").single();
      if (error) throw error;
      await audit(sb, project.id, session.userId, "project_submitted", "project", project.id, project, updated);
      return json({ success: true, project: updated });
    }

    if (action === "apply") {
      requireSession(session);
      const project = await projectById(sb, text(body.project_id, 80));
      if (!project) return json({ error: "PROJECT_NOT_FOUND" }, 404);
      if (!(await hasProjectAccess(sb, session, project))) return json({ error: "PROJECT_ACCESS_DENIED" }, 403);
      if (!["published", "selection"].includes(project.status)) return json({ error: "APPLICATIONS_CLOSED", message: "Les candidatures ne sont pas ouvertes pour ce projet." }, 409);
      const now = Date.now();
      if (project.application_opens_at && new Date(project.application_opens_at).getTime() > now) {
        return json({ error: "APPLICATIONS_NOT_OPEN", message: "La période de candidature n’a pas encore commencé." }, 409);
      }
      if (project.application_closes_at && new Date(project.application_closes_at).getTime() <= now) {
        return json({ error: "APPLICATIONS_CLOSED", message: "La période de candidature est terminée." }, 409);
      }
      const mode = text(body.application_mode || "individual", 20);
      if (mode === "team" && project.participation_mode === "individual") return json({ error: "TEAM_APPLICATION_NOT_ALLOWED" }, 400);
      if (mode === "individual" && project.participation_mode === "team") return json({ error: "INDIVIDUAL_APPLICATION_NOT_ALLOWED" }, 400);
      if (!body.consent_confirmed) return json({ error: "CONSENT_REQUIRED" }, 400);
      if (project.nda_required) {
        const { data: agreement } = await sb.from("omnia_project_agreements").select("id").eq("project_id", project.id).eq("user_id", session.userId).eq("agreement_type", "nda").eq("accepted", true).limit(1).maybeSingle();
        if (!agreement) return json({ error: "NDA_REQUIRED" }, 409);
      }
      const teamId = mode === "team" ? text(body.team_id, 80) : null;
      if (teamId) {
        const { data: team } = await sb.from("omnia_project_teams").select("id,project_id,status").eq("id", teamId).maybeSingle();
        if (!team || team.project_id !== project.id) return json({ error: "TEAM_PROJECT_MISMATCH" }, 400);
        const { data: membership } = await sb.from("omnia_project_team_members").select("id,member_role").eq("team_id", teamId).eq("user_id", session.userId).eq("invitation_status", "accepted").maybeSingle();
        if (!membership) return json({ error: "TEAM_MEMBERSHIP_REQUIRED" }, 403);
        if (membership.member_role !== "leader") return json({ error: "TEAM_LEADER_REQUIRED" }, 403);
        const { data: existingTeamApplication } = await sb.from("omnia_project_applications").select("id,applicant_user_id").eq("project_id", project.id).eq("team_id", teamId).limit(1).maybeSingle();
        if (existingTeamApplication && existingTeamApplication.applicant_user_id !== session.userId) return json({ error: "TEAM_ALREADY_APPLIED" }, 409);
      }
      const { data: application, error } = await sb.from("omnia_project_applications").upsert({
        project_id: project.id,
        applicant_user_id: session.userId,
        application_mode: mode,
        team_id: teamId || null,
        motivation: text(body.motivation, 12000),
        proposed_approach: text(body.proposed_approach, 12000),
        availability: text(body.availability, 2000),
        portfolio_links: Array.isArray(body.portfolio_links) ? body.portfolio_links.slice(0, 20) : [],
        answers: objectValue(body.answers, {}),
        consent_confirmed: true,
        status: "submitted",
        submitted_at: new Date().toISOString(),
      }, { onConflict: "project_id,applicant_user_id" }).select("*").single();
      if (error) throw error;
      if (teamId) await sb.from("omnia_project_teams").update({ status: "submitted" }).eq("id", teamId).eq("project_id", project.id);
      await audit(sb, project.id, session.userId, "application_submitted", "application", application.id, null, { status: application.status, application_mode: application.application_mode });
      return json({ success: true, application }, 201);
    }

    if (action === "accept_agreement") {
      requireSession(session);
      const project = await projectById(sb, text(body.project_id, 80));
      if (!project) return json({ error: "PROJECT_NOT_FOUND" }, 404);
      if (!(await hasProjectAccess(sb, session, project))) return json({ error: "PROJECT_ACCESS_DENIED" }, 403);
      const agreementType = text(body.agreement_type || "nda", 40);
      const version = text(body.agreement_version || "1.0", 30);
      const { data: agreement, error } = await sb.from("omnia_project_agreements").upsert({
        project_id: project.id,
        user_id: session.userId,
        agreement_type: agreementType,
        agreement_version: version,
        agreement_text_hash: text(body.agreement_text_hash, 200) || null,
        accepted: true,
        accepted_at: new Date().toISOString(),
        revoked_at: null,
        ip_address: req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0] || null,
        user_agent: req.headers.get("user-agent"),
        metadata: objectValue(body.metadata, {}),
      }, { onConflict: "project_id,user_id,agreement_type,agreement_version" }).select("*").single();
      if (error) throw error;
      await audit(sb, project.id, session.userId, "agreement_accepted", "agreement", agreement.id, null, { agreement_type: agreementType, version });
      return json({ success: true, agreement });
    }

    if (action === "create_team") {
      requireSession(session);
      const project = await projectById(sb, text(body.project_id, 80));
      if (!project) return json({ error: "PROJECT_NOT_FOUND" }, 404);
      if (!(await hasProjectAccess(sb, session, project))) return json({ error: "PROJECT_ACCESS_DENIED" }, 403);
      if (!["published", "selection"].includes(project.status)) return json({ error: "TEAM_CREATION_CLOSED" }, 409);
      if (project.participation_mode === "individual") return json({ error: "TEAM_NOT_ALLOWED" }, 400);
      const managesProject = await canManageProject(sb, session, project);
      if (project.team_creation_mode === "owner" && !managesProject) return json({ error: "TEAM_CREATION_RESERVED_TO_OWNER" }, 403);
      if (project.team_creation_mode === "candidate" && managesProject && body.create_for_candidate !== true) return json({ error: "TEAM_CREATION_RESERVED_TO_CANDIDATES" }, 403);
      const name = text(body.name, 160);
      if (!name) return json({ error: "TEAM_NAME_REQUIRED" }, 400);
      let leaderUserId = session.userId;
      let leaderUser = session.user;
      const leaderEmail = text(body.leader_email, 255).toLowerCase();
      if (leaderEmail) {
        const { data: target } = await sb.from("users").select("id,full_name,email").ilike("email", leaderEmail).maybeSingle();
        if (!target) return json({ error: "LEADER_USER_NOT_FOUND" }, 404);
        leaderUserId = String(target.id);
        leaderUser = target;
      } else if (managesProject && project.team_creation_mode === "owner") {
        return json({ error: "LEADER_EMAIL_REQUIRED" }, 400);
      }
      const invitationCode = `TEAM-${crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
      const { data: team, error } = await sb.from("omnia_project_teams").insert({
        project_id: project.id,
        name,
        description: text(body.description, 5000),
        leader_user_id: leaderUserId,
        created_by: session.userId,
        max_members: Math.min(Number(body.max_members || project.max_team_size || 10), Number(project.max_team_size || body.max_members || 10)),
        invitation_code: invitationCode,
      }).select("*").single();
      if (error) throw error;
      const selfLed = leaderUserId === session.userId;
      await sb.from("omnia_project_team_members").insert({
        team_id: team.id,
        user_id: leaderUserId,
        member_role: "leader",
        invitation_status: selfLed ? "accepted" : "pending",
        invited_by: session.userId,
        responded_at: selfLed ? new Date().toISOString() : null,
        consent_recorded_at: selfLed ? new Date().toISOString() : null,
      });
      await audit(sb, project.id, session.userId, "team_created", "team", team.id, null, team, { leader_user_id: leaderUserId, consent_pending: !selfLed });
      return json({ success: true, team, leader_user: leaderUser, consent_pending: !selfLed }, 201);
    }

    if (action === "invite_team_member") {
      requireSession(session);
      const teamId = text(body.team_id, 80);
      const { data: team } = await sb.from("omnia_project_teams").select("*").eq("id", teamId).maybeSingle();
      if (!team) return json({ error: "TEAM_NOT_FOUND" }, 404);
      if (team.leader_user_id !== session.userId && !isAdmin(session)) return json({ error: "FORBIDDEN" }, 403);
      const email = text(body.email, 255).toLowerCase();
      const { data: target } = await sb.from("users").select("id,full_name,email").ilike("email", email).maybeSingle();
      if (!target) return json({ error: "USER_NOT_FOUND" }, 404);
      if (target.id === session.userId) return json({ error: "CANNOT_INVITE_SELF" }, 400);
      const { count } = await sb.from("omnia_project_team_members").select("id", { count: "exact", head: true }).eq("team_id", team.id).in("invitation_status", ["pending", "accepted"]);
      if (team.max_members && (count || 0) >= team.max_members) return json({ error: "TEAM_FULL" }, 409);
      const { data: membership, error } = await sb.from("omnia_project_team_members").upsert({
        team_id: team.id,
        user_id: target.id,
        member_role: "member",
        invitation_status: "pending",
        invited_by: session.userId,
        invited_at: new Date().toISOString(),
        responded_at: null,
        consent_recorded_at: null,
      }, { onConflict: "team_id,user_id" }).select("*").single();
      if (error) throw error;
      await audit(sb, team.project_id, session.userId, "team_member_invited", "team_member", membership.id, null, { invited_user_id: target.id });
      return json({ success: true, membership, invited_user: target });
    }

    if (action === "respond_team_invite") {
      requireSession(session);
      const membershipId = text(body.membership_id, 80);
      const response = text(body.response, 20);
      if (!["accepted", "declined"].includes(response)) return json({ error: "INVALID_RESPONSE" }, 400);
      const { data: membership } = await sb.from("omnia_project_team_members").select("*,team:omnia_project_teams(project_id)").eq("id", membershipId).eq("user_id", session.userId).eq("invitation_status", "pending").maybeSingle();
      if (!membership) return json({ error: "INVITATION_NOT_FOUND" }, 404);
      const { data: updated, error } = await sb.from("omnia_project_team_members").update({
        invitation_status: response,
        responded_at: new Date().toISOString(),
        consent_recorded_at: response === "accepted" ? new Date().toISOString() : null,
      }).eq("id", membershipId).select("*").single();
      if (error) throw error;
      await audit(sb, membership.team?.project_id || null, session.userId, `team_invite_${response}`, "team_member", membershipId, membership, updated);
      return json({ success: true, membership: updated });
    }

    if (action === "invite_project_user") {
      requireSession(session);
      const project = await projectById(sb, text(body.project_id, 80));
      if (!project) return json({ error: "PROJECT_NOT_FOUND" }, 404);
      if (!(await canManageProject(sb, session, project))) return json({ error: "FORBIDDEN" }, 403);
      const email = text(body.email, 255).toLowerCase();
      if (!email) return json({ error: "EMAIL_REQUIRED" }, 400);
      const { data: target } = await sb.from("users").select("id,full_name,email").ilike("email", email).maybeSingle();
      if (!target) return json({ error: "USER_NOT_FOUND" }, 404);
      const invitationRole = text(body.invitation_role || "participant", 40);
      if (!["participant", "team_leader", "mentor", "observer"].includes(invitationRole)) return json({ error: "INVALID_INVITATION_ROLE" }, 400);
      const teamId = text(body.team_id, 80) || null;
      if (teamId) {
        const { data: team } = await sb.from("omnia_project_teams").select("id,project_id").eq("id", teamId).maybeSingle();
        if (!team || team.project_id !== project.id) return json({ error: "TEAM_PROJECT_MISMATCH" }, 400);
      }
      const expiresAt = body.expires_at ? new Date(body.expires_at).toISOString() : null;
      const { data: invitation, error } = await sb.from("omnia_project_invitations").upsert({
        project_id: project.id,
        team_id: teamId,
        invited_user_id: target.id,
        invited_email: target.email,
        invitation_role: invitationRole,
        status: "pending",
        message: text(body.message, 3000) || null,
        invited_by: session.userId,
        invited_at: new Date().toISOString(),
        responded_at: null,
        consent_recorded_at: null,
        expires_at: expiresAt,
      }, { onConflict: "project_id,invited_user_id,invitation_role" }).select("*").single();
      if (error) throw error;
      if (teamId) {
        await sb.from("omnia_project_team_members").upsert({
          team_id: teamId,
          user_id: target.id,
          member_role: invitationRole === "team_leader" ? "leader" : invitationRole === "mentor" ? "mentor" : invitationRole === "observer" ? "observer" : "member",
          invitation_status: "pending",
          invited_by: session.userId,
          invited_at: new Date().toISOString(),
          responded_at: null,
          consent_recorded_at: null,
        }, { onConflict: "team_id,user_id" });
      }
      await audit(sb, project.id, session.userId, "project_user_invited", "project_invitation", invitation.id, null, { invited_user_id: target.id, invitation_role: invitationRole, team_id: teamId });
      return json({ success: true, invitation, invited_user: target }, 201);
    }

    if (action === "respond_project_invitation") {
      requireSession(session);
      const response = text(body.response, 20);
      if (!["accepted", "declined"].includes(response)) return json({ error: "INVALID_RESPONSE" }, 400);
      const { data: invitation } = await sb.from("omnia_project_invitations").select("*").eq("id", text(body.invitation_id, 80)).eq("invited_user_id", session.userId).eq("status", "pending").maybeSingle();
      if (!invitation) return json({ error: "INVITATION_NOT_FOUND" }, 404);
      if (invitation.expires_at && new Date(invitation.expires_at).getTime() <= Date.now()) {
        await sb.from("omnia_project_invitations").update({ status: "expired", responded_at: new Date().toISOString() }).eq("id", invitation.id);
        return json({ error: "INVITATION_EXPIRED" }, 409);
      }
      const now = new Date().toISOString();
      const { data: updated, error } = await sb.from("omnia_project_invitations").update({
        status: response,
        responded_at: now,
        consent_recorded_at: response === "accepted" ? now : null,
      }).eq("id", invitation.id).select("*").single();
      if (error) throw error;
      if (invitation.team_id) {
        await sb.from("omnia_project_team_members").update({
          invitation_status: response,
          responded_at: now,
          consent_recorded_at: response === "accepted" ? now : null,
        }).eq("team_id", invitation.team_id).eq("user_id", session.userId);
      }
      await audit(sb, invitation.project_id, session.userId, `project_invitation_${response}`, "project_invitation", invitation.id, invitation, updated);
      return json({ success: true, invitation: updated });
    }

    if (action === "change_status") {
      requireSession(session);
      const project = await projectById(sb, text(body.project_id, 80));
      if (!project) return json({ error: "PROJECT_NOT_FOUND" }, 404);
      if (!(await canManageProject(sb, session, project))) return json({ error: "FORBIDDEN" }, 403);
      const nextStatus = text(body.status, 40);
      const allowedTransitions: Record<string, string[]> = {
        published: ["selection", "in_progress", "closed"],
        selection: ["published", "in_progress", "closed"],
        in_progress: ["closed"],
      };
      if (!(allowedTransitions[project.status] || []).includes(nextStatus)) return json({ error: "INVALID_STATUS_TRANSITION" }, 409);
      const patch: Record<string, unknown> = { status: nextStatus };
      if (nextStatus === "closed") patch.closed_at = new Date().toISOString();
      const { data: updated, error } = await sb.from("omnia_projects").update(patch).eq("id", project.id).select("*").single();
      if (error) throw error;
      await audit(sb, project.id, session.userId, "project_status_changed", "project", project.id, project, updated, { from: project.status, to: nextStatus });
      return json({ success: true, project: updated });
    }

    if (action === "list_applications") {
      requireSession(session);
      const project = await projectById(sb, text(body.project_id, 80));
      if (!project) return json({ error: "PROJECT_NOT_FOUND" }, 404);
      if (!(await canManageProject(sb, session, project))) return json({ error: "FORBIDDEN" }, 403);
      const { data, error } = await sb.from("omnia_project_applications")
        .select("*,applicant:users!omnia_project_applications_applicant_user_id_fkey(id,full_name,email,avatar_url,country_code),team:omnia_project_teams(id,name,status)")
        .eq("project_id", project.id)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return json({ applications: data || [] });
    }

    if (action === "review_application") {
      requireSession(session);
      const { data: application } = await sb.from("omnia_project_applications").select("*").eq("id", text(body.application_id, 80)).maybeSingle();
      if (!application) return json({ error: "APPLICATION_NOT_FOUND" }, 404);
      const project = await projectById(sb, application.project_id);
      if (!project || !(await canManageProject(sb, session, project))) return json({ error: "FORBIDDEN" }, 403);
      const status = text(body.status, 40);
      if (!["under_review", "waitlisted", "selected", "rejected", "cancelled"].includes(status)) return json({ error: "INVALID_APPLICATION_STATUS" }, 400);
      if (status === "selected" && application.status !== "selected") {
        let candidateSize = 1;
        if (application.application_mode === "team") {
          if (!application.team_id) return json({ error: "TEAM_REQUIRED" }, 400);
          const { data: team } = await sb.from("omnia_project_teams").select("id,project_id").eq("id", application.team_id).maybeSingle();
          if (!team || team.project_id !== project.id) return json({ error: "TEAM_PROJECT_MISMATCH" }, 400);
          candidateSize = await acceptedTeamSize(sb, application.team_id);
          if (candidateSize < Number(project.min_team_size || 1)) return json({ error: "TEAM_MINIMUM_NOT_REACHED" }, 409);
          if (project.max_team_size && candidateSize > Number(project.max_team_size)) return json({ error: "TEAM_MAXIMUM_EXCEEDED" }, 409);
        }
        if (project.max_participants) {
          const alreadySelected = await selectedParticipantCount(sb, project.id, application.id);
          if (alreadySelected + candidateSize > Number(project.max_participants)) return json({ error: "PROJECT_CAPACITY_EXCEEDED" }, 409);
        }
      }
      const { data: updated, error } = await sb.from("omnia_project_applications").update({
        status,
        review_note: text(body.review_note, 5000),
        reviewed_by: session.userId,
        reviewed_at: new Date().toISOString(),
      }).eq("id", application.id).select("*").single();
      if (error) throw error;
      if (application.team_id && status === "selected") await sb.from("omnia_project_teams").update({ status: "selected" }).eq("id", application.team_id);
      if (application.team_id && status === "rejected") await sb.from("omnia_project_teams").update({ status: "submitted" }).eq("id", application.team_id);
      await audit(sb, project.id, session.userId, "application_reviewed", "application", application.id, application, updated, { status });
      return json({ success: true, application: updated });
    }

    if (action === "upsert_milestone") {
      requireSession(session);
      const project = await projectById(sb, text(body.project_id, 80));
      if (!project || !(await canManageProject(sb, session, project))) return json({ error: "FORBIDDEN" }, 403);
      const payload = {
        project_id: project.id,
        title: text(body.title, 180),
        description: text(body.description, 5000),
        sequence_no: Math.max(1, Number(body.sequence_no || 1)),
        due_at: body.due_at ? new Date(body.due_at).toISOString() : null,
        deliverable_required: body.deliverable_required !== false,
        accepted_file_types: textArray(body.accepted_file_types, 30, 80),
        max_file_size_mb: Math.min(500, Math.max(1, Number(body.max_file_size_mb || 25))),
        status: text(body.status || "planned", 30),
        created_by: session.userId,
      };
      if (!payload.title) return json({ error: "MILESTONE_TITLE_REQUIRED" }, 400);
      const milestoneId = text(body.milestone_id, 80);
      const query = milestoneId
        ? sb.from("omnia_project_milestones").update(payload).eq("id", milestoneId).eq("project_id", project.id)
        : sb.from("omnia_project_milestones").insert(payload);
      const { data: milestone, error } = await query.select("*").single();
      if (error) throw error;
      await audit(sb, project.id, session.userId, milestoneId ? "milestone_updated" : "milestone_created", "milestone", milestone.id, null, milestone);
      return json({ success: true, milestone });
    }

    if (action === "submit_deliverable") {
      requireSession(session);
      const project = await projectById(sb, text(body.project_id, 80));
      if (!project) return json({ error: "PROJECT_NOT_FOUND" }, 404);
      const managesProject = await canManageProject(sb, session, project);
      if (!managesProject && project.status !== "in_progress") return json({ error: "PROJECT_NOT_IN_PROGRESS" }, 409);
      const title = text(body.title, 180);
      const description = text(body.description, 10000);
      const externalUrl = text(body.external_url, 2000) || null;
      const filePath = text(body.file_path, 2000) || null;
      if (!title) return json({ error: "DELIVERABLE_TITLE_REQUIRED" }, 400);
      if (!description && !externalUrl && !filePath) return json({ error: "DELIVERABLE_CONTENT_REQUIRED" }, 400);
      if (externalUrl && !/^https?:\/\//i.test(externalUrl)) return json({ error: "INVALID_EXTERNAL_URL" }, 400);
      if (filePath && !filePath.startsWith(`${project.id}/`)) return json({ error: "INVALID_FILE_PATH" }, 400);
      const milestoneId = text(body.milestone_id, 80) || null;
      if (milestoneId) {
        const { data: milestone } = await sb.from("omnia_project_milestones").select("id,project_id").eq("id", milestoneId).maybeSingle();
        if (!milestone || milestone.project_id !== project.id) return json({ error: "MILESTONE_PROJECT_MISMATCH" }, 400);
      }
      const teamId = text(body.team_id, 80) || null;
      if (teamId) {
        const { data: team } = await sb.from("omnia_project_teams").select("id,project_id,status").eq("id", teamId).maybeSingle();
        if (!team || team.project_id !== project.id) return json({ error: "TEAM_PROJECT_MISMATCH" }, 400);
        if (!managesProject && !["selected", "active"].includes(team.status)) return json({ error: "TEAM_NOT_SELECTED" }, 409);
        const { data: membership } = await sb.from("omnia_project_team_members").select("id").eq("team_id", teamId).eq("user_id", session.userId).eq("invitation_status", "accepted").maybeSingle();
        if (!membership && !managesProject) return json({ error: "TEAM_MEMBERSHIP_REQUIRED" }, 403);
      } else {
        const { data: application } = await sb.from("omnia_project_applications").select("id,status").eq("project_id", project.id).eq("applicant_user_id", session.userId).eq("status", "selected").maybeSingle();
        if (!application && !managesProject) return json({ error: "SELECTION_REQUIRED" }, 403);
      }
      const { data: deliverable, error } = await sb.from("omnia_project_deliverables").insert({
        project_id: project.id,
        milestone_id: milestoneId,
        team_id: teamId,
        submitted_by: session.userId,
        title,
        description,
        file_path: filePath,
        external_url: externalUrl,
        file_name: text(body.file_name, 255) || null,
        file_size: body.file_size ? Number(body.file_size) : null,
        mime_type: text(body.mime_type, 160) || null,
        version_no: Math.max(1, Number(body.version_no || 1)),
        confidentiality_level: text(body.confidentiality_level || "project", 40),
        portfolio_visibility: text(body.portfolio_visibility || "not_allowed", 40),
        status: "submitted",
      }).select("*").single();
      if (error) throw error;
      await audit(sb, project.id, session.userId, "deliverable_submitted", "deliverable", deliverable.id, null, { title: deliverable.title, team_id: teamId });
      return json({ success: true, deliverable }, 201);
    }

    if (action === "evaluate_deliverable") {
      requireSession(session);
      const { data: deliverable } = await sb.from("omnia_project_deliverables").select("*").eq("id", text(body.deliverable_id, 80)).maybeSingle();
      if (!deliverable) return json({ error: "DELIVERABLE_NOT_FOUND" }, 404);
      const project = await projectById(sb, deliverable.project_id);
      if (!project || !(await canManageProject(sb, session, project))) return json({ error: "FORBIDDEN" }, 403);
      const status = text(body.status, 30);
      if (!["changes_requested", "accepted", "rejected"].includes(status)) return json({ error: "INVALID_DELIVERABLE_STATUS" }, 400);
      const score = body.evaluation_score == null || body.evaluation_score === "" ? null : Math.min(100, Math.max(0, Number(body.evaluation_score)));
      const { data: updated, error } = await sb.from("omnia_project_deliverables").update({
        status,
        evaluation_score: score,
        evaluation_feedback: text(body.evaluation_feedback, 10000),
        evaluated_by: session.userId,
        evaluated_at: new Date().toISOString(),
      }).eq("id", deliverable.id).select("*").single();
      if (error) throw error;
      if (status === "accepted") {
        let recipients = [deliverable.submitted_by];
        if (deliverable.team_id) {
          const { data: members } = await sb.from("omnia_project_team_members").select("user_id").eq("team_id", deliverable.team_id).eq("invitation_status", "accepted");
          recipients = [...new Set([deliverable.submitted_by, ...(members || []).map(member => member.user_id)].filter(Boolean))];
        }
        for (const userId of recipients) {
          await sb.from("omnia_project_verified_evidence").upsert({
            project_id: project.id,
            user_id: userId,
            team_id: deliverable.team_id,
            deliverable_id: deliverable.id,
            evidence_type: "verified_deliverable",
            title: deliverable.title,
            summary: text(body.evaluation_feedback, 5000),
            skill_codes: textArray(body.skill_codes, 100, 160),
            validation_status: "validated",
            portfolio_permission: "private",
            issuer_name: project.organization_name || "Omnia Global Academy",
            evidence_payload: { evaluation_score: score, project_slug: project.slug },
            validated_by: session.userId,
            validated_at: new Date().toISOString(),
          }, { onConflict: "deliverable_id,user_id,evidence_type" });
        }
      }
      await audit(sb, project.id, session.userId, "deliverable_evaluated", "deliverable", deliverable.id, deliverable, updated, { status, score });
      return json({ success: true, deliverable: updated });
    }

    if (action === "create_upload_url") {
      requireSession(session);
      const project = await projectById(sb, text(body.project_id, 80));
      if (!project) return json({ error: "PROJECT_NOT_FOUND" }, 404);
      const allowed = await hasParticipantAccess(sb, session, project);
      if (!allowed) return json({ error: "FORBIDDEN" }, 403);
      const fileName = text(body.file_name, 255).replace(/[^a-zA-Z0-9._-]/g, "_");
      const purpose = text(body.purpose || "deliverables", 40).replace(/[^a-z0-9_-]/gi, "");
      if (!fileName) return json({ error: "FILE_NAME_REQUIRED" }, 400);
      const path = `${project.id}/${purpose}/${session.userId}/${crypto.randomUUID()}-${fileName}`;
      const { data, error } = await sb.storage.from("omnia-projects").createSignedUploadUrl(path);
      if (error) throw error;
      return json({ path, signed_url: data.signedUrl, token: data.token });
    }

    if (action === "signed_file_url") {
      requireSession(session);
      const project = await projectById(sb, text(body.project_id, 80));
      if (!project) return json({ error: "PROJECT_NOT_FOUND" }, 404);
      const path = text(body.file_path, 2000);
      if (!path.startsWith(`${project.id}/`)) return json({ error: "INVALID_FILE_PATH" }, 400);
      const managesProject = await canManageProject(sb, session, project);
      let allowed = managesProject;
      const { data: deliverable } = await sb.from("omnia_project_deliverables").select("id,submitted_by,team_id,confidentiality_level").eq("project_id", project.id).eq("file_path", path).maybeSingle();
      if (deliverable && !allowed) {
        if (deliverable.submitted_by === session.userId) allowed = true;
        else if (deliverable.team_id && deliverable.confidentiality_level !== "owner_only" && deliverable.confidentiality_level !== "strictly_confidential") {
          const { data: membership } = await sb.from("omnia_project_team_members").select("id").eq("team_id", deliverable.team_id).eq("user_id", session.userId).eq("invitation_status", "accepted").maybeSingle();
          allowed = Boolean(membership);
        }
      } else if (!deliverable && !allowed) {
        allowed = await hasParticipantAccess(sb, session, project);
      }
      if (!allowed) return json({ error: "FORBIDDEN" }, 403);
      const { data, error } = await sb.storage.from("omnia-projects").createSignedUrl(path, 900, { download: false });
      if (error) throw error;
      await audit(sb, project.id, session.userId, "protected_file_accessed", deliverable ? "deliverable_file" : "project_file", deliverable?.id || null, null, null, { path });
      return json({ signed_url: data.signedUrl, expires_in: 900 });
    }

    if (action === "report") {
      requireSession(session);
      const project = await projectById(sb, text(body.project_id, 80));
      if (!project) return json({ error: "PROJECT_NOT_FOUND" }, 404);
      const description = text(body.description, 10000);
      if (!description) return json({ error: "REPORT_DESCRIPTION_REQUIRED" }, 400);
      const { data: report, error } = await sb.from("omnia_project_reports").insert({
        project_id: project.id,
        reporter_user_id: session.userId,
        report_type: text(body.report_type || "other", 60),
        description,
        evidence: Array.isArray(body.evidence) ? body.evidence.slice(0, 20) : [],
      }).select("*").single();
      if (error) throw error;
      await audit(sb, project.id, session.userId, "project_reported", "report", report.id, null, { report_type: report.report_type });
      return json({ success: true, report }, 201);
    }

    if (action === "resolve_report") {
      requireSession(session);
      if (!isAdmin(session)) return json({ error: "FORBIDDEN" }, 403);
      const status = text(body.status, 40);
      if (!["under_review", "resolved", "dismissed", "escalated"].includes(status)) return json({ error: "INVALID_REPORT_STATUS" }, 400);
      const { data: report } = await sb.from("omnia_project_reports").select("*").eq("id", text(body.report_id, 80)).maybeSingle();
      if (!report) return json({ error: "REPORT_NOT_FOUND" }, 404);
      const patch: Record<string, unknown> = {
        status,
        assigned_to: session.userId,
        resolution_note: text(body.resolution_note, 10000) || null,
      };
      if (["resolved", "dismissed"].includes(status)) patch.resolved_at = new Date().toISOString();
      const { data: updated, error } = await sb.from("omnia_project_reports").update(patch).eq("id", report.id).select("*").single();
      if (error) throw error;
      await audit(sb, report.project_id, session.userId, "project_report_updated", "report", report.id, report, updated, { status });
      return json({ success: true, report: updated });
    }

    if (action === "project_partners") {
      requireSession(session);
      const project = await projectById(sb, text(body.project_id, 80));
      if (!project) return json({ error: "PROJECT_NOT_FOUND" }, 404);
      if (!(await canManageProject(sb, session, project))) return json({ error: "FORBIDDEN" }, 403);
      const { data, error } = await sb.from("omnia_project_partners").select("*").eq("project_id", project.id).order("created_at");
      if (error) throw error;
      return json({ partners: data || [] });
    }

    if (action === "save_project_partner") {
      requireSession(session);
      const project = await projectById(sb, text(body.project_id, 80));
      if (!project) return json({ error: "PROJECT_NOT_FOUND" }, 404);
      if (!(await canManageProject(sb, session, project))) return json({ error: "FORBIDDEN" }, 403);
      const partnerName = text(body.partner_name, 220);
      if (!partnerName) return json({ error: "PARTNER_NAME_REQUIRED" }, 400);
      const partnerKind = ["structure", "recognition_partner", "external"].includes(text(body.partner_kind, 40)) ? text(body.partner_kind, 40) : "external";
      const partnerRole = ["owner","co_owner","client","sponsor","technical","academic","institutional","mentor","evaluator","participant"].includes(text(body.partner_role, 40)) ? text(body.partner_role, 40) : "participant";
      const requestedStatus = text(body.status, 30);
      const status = isAdmin(session) && ["proposed","confirmed","declined","withdrawn"].includes(requestedStatus) ? requestedStatus : "proposed";
      const patch: Record<string, unknown> = {
        project_id: project.id,
        partner_kind: partnerKind,
        organization_id: body.organization_id ? text(body.organization_id, 80) : null,
        recognition_partner_id: body.recognition_partner_id ? text(body.recognition_partner_id, 80) : null,
        partner_name: partnerName,
        partner_role: partnerRole,
        status,
        logo_usage_allowed: isAdmin(session) && Boolean(body.logo_usage_allowed),
        notes: text(body.notes, 5000) || null,
      };
      if (status === "confirmed") Object.assign(patch, { confirmed_by: session.userId, confirmed_at: new Date().toISOString() });
      let result;
      if (body.partner_id) {
        result = await sb.from("omnia_project_partners").update(patch).eq("id", text(body.partner_id, 80)).eq("project_id", project.id).select("*").single();
      } else {
        result = await sb.from("omnia_project_partners").insert({ ...patch, created_by: session.userId }).select("*").single();
      }
      if (result.error) throw result.error;
      await audit(sb, project.id, session.userId, body.partner_id ? "project_partner_updated" : "project_partner_added", "project_partner", result.data.id, null, result.data);
      return json({ success: true, partner: result.data });
    }

    if (action === "remove_project_partner") {
      requireSession(session);
      const { data: partner } = await sb.from("omnia_project_partners").select("*").eq("id", text(body.partner_id, 80)).maybeSingle();
      if (!partner) return json({ error: "PARTNER_NOT_FOUND" }, 404);
      const project = await projectById(sb, String(partner.project_id));
      if (!project || !(await canManageProject(sb, session, project))) return json({ error: "FORBIDDEN" }, 403);
      const { data, error } = await sb.from("omnia_project_partners").update({ status: "withdrawn" }).eq("id", partner.id).select("*").single();
      if (error) throw error;
      await audit(sb, project.id, session.userId, "project_partner_withdrawn", "project_partner", partner.id, partner, data);
      return json({ success: true, partner: data });
    }

    if (action === "admin_creator_permissions") {
      requireSession(session);
      if (!isAdmin(session)) return json({ error: "FORBIDDEN" }, 403);
      const { data: roleRows, error: roleError } = await sb.from("user_roles").select("user_id,role").in("role", ["professeur","professor","teacher","instructor"]);
      if (roleError) throw roleError;
      const userIds = [...new Set((roleRows || []).map((row: any) => row.user_id))];
      if (!userIds.length) return json({ professors: [] });
      const [{ data: users }, { data: permissions }] = await Promise.all([
        sb.from("users").select("id,full_name,email,status").in("id", userIds).order("full_name"),
        sb.from("omnia_project_creator_permissions").select("*").in("user_id", userIds),
      ]);
      const byUser = new Map((permissions || []).map((row: any) => [String(row.user_id), row]));
      return json({ professors: (users || []).map((user: any) => ({ ...user, permission: byUser.get(String(user.id)) || null })) });
    }

    if (action === "admin_set_creator_permission") {
      requireSession(session);
      if (!isAdmin(session)) return json({ error: "FORBIDDEN" }, 403);
      const userId = text(body.user_id, 80);
      const status = ["allowed","suspended","revoked"].includes(text(body.status, 30)) ? text(body.status, 30) : "allowed";
      if (!userId) return json({ error: "USER_REQUIRED" }, 400);
      const allowedTypes = textArray(body.allowed_project_types, 20, 80);
      const patch: Record<string, unknown> = {
        user_id: userId,
        status,
        allowed_project_types: allowedTypes.length ? allowedTypes : ["real_project","challenge","case_study","short_mission","academic_project","structure_internal","call_for_solutions","hackathon","volunteer_mission","rewarded_project"],
        organization_scope_id: body.organization_scope_id ? text(body.organization_scope_id, 80) : null,
        notes: text(body.notes, 3000) || null,
        granted_by: session.userId,
        granted_at: new Date().toISOString(),
        revoked_by: status === "revoked" ? session.userId : null,
        revoked_at: status === "revoked" ? new Date().toISOString() : null,
      };
      const { data, error } = await sb.from("omnia_project_creator_permissions").upsert(patch, { onConflict: "user_id" }).select("*").single();
      if (error) throw error;
      await audit(sb, null, session.userId, "project_creator_permission_updated", "creator_permission", data.id, null, data);
      return json({ success: true, permission: data });
    }

    if (action === "admin_list") {
      requireSession(session);
      if (!isAdmin(session)) return json({ error: "FORBIDDEN" }, 403);
      let query = sb.from("omnia_projects").select("*").order("created_at", { ascending: false });
      if (body.status) query = query.eq("status", text(body.status, 40));
      const { data: projects, error } = await query;
      if (error) throw error;
      const { data: reports } = await sb.from("omnia_project_reports").select("*,project:omnia_projects(id,title,slug)").in("status", ["open", "under_review", "escalated"]).order("created_at", { ascending: false });
      return json({ projects: await enrichProjects(sb, projects || [], session), reports: reports || [] });
    }

    if (action === "admin_decision") {
      requireSession(session);
      if (!isAdmin(session)) return json({ error: "FORBIDDEN" }, 403);
      const project = await projectById(sb, text(body.project_id, 80));
      if (!project) return json({ error: "PROJECT_NOT_FOUND" }, 404);
      const decision = text(body.decision, 40);
      const now = new Date().toISOString();
      const patch: Record<string, unknown> = { reviewed_by: session.userId, reviewed_at: now };
      if (decision === "approve") {
        patch.status = "published";
        patch.published_at = project.published_at || now;
        patch.admin_feedback = text(body.note, 5000) || null;
        if (project.reward_type === "financial_prize" && project.reward_funding_status !== "verified") return json({ error: "REWARD_FUNDING_MUST_BE_VERIFIED" }, 409);
      } else if (decision === "request_changes") {
        patch.status = "changes_requested";
        patch.admin_feedback = text(body.note, 5000);
        if (!patch.admin_feedback) return json({ error: "DECISION_NOTE_REQUIRED" }, 400);
      } else if (decision === "reject") {
        patch.status = "rejected";
        patch.admin_feedback = text(body.note, 5000);
        if (!patch.admin_feedback) return json({ error: "DECISION_NOTE_REQUIRED" }, 400);
      } else if (decision === "suspend") {
        patch.status = "suspended";
        patch.admin_feedback = text(body.note, 5000);
      } else if (decision === "close") {
        patch.status = "closed";
        patch.closed_at = now;
        patch.admin_feedback = text(body.note, 5000) || null;
      } else if (decision === "archive") {
        patch.status = "archived";
        patch.admin_feedback = text(body.note, 5000) || null;
      } else if (decision === "restore") {
        patch.status = PROJECT_STATUSES.has(text(body.restore_status, 40)) ? text(body.restore_status, 40) : "draft";
        patch.admin_feedback = text(body.note, 5000) || null;
      } else if (decision === "verify_reward") {
        patch.admin_feedback = text(body.note, 5000);
        if (!patch.admin_feedback) return json({ error: "DECISION_NOTE_REQUIRED" }, 400);
        patch.reward_funding_status = "verified";
      } else if (decision === "block_reward") {
        patch.reward_funding_status = "blocked";
        patch.admin_feedback = text(body.note, 5000);
      } else if (decision === "delete") {
        await audit(sb, project.id, session.userId, "project_deleted", "project", project.id, project, null, { note: text(body.note, 5000) });
        const { error } = await sb.from("omnia_projects").delete().eq("id", project.id);
        if (error) throw error;
        return json({ success: true, deleted: true });
      } else return json({ error: "UNKNOWN_DECISION" }, 400);

      const { data: updated, error } = await sb.from("omnia_projects").update(patch).eq("id", project.id).select("*").single();
      if (error) throw error;
      await audit(sb, project.id, session.userId, `admin_${decision}`, "project", project.id, project, updated, { note: text(body.note, 5000) });
      return json({ success: true, project: updated });
    }

    return json({ error: "UNKNOWN_ACTION" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "SERVER_ERROR";
    const status = message === "AUTH_REQUIRED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    console.error("omnia-projects", error);
    return json({ error: message, message }, status);
  }
});
