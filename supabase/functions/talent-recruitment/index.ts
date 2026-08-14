import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { createAccessInvitation } from "../_shared/access-invitations.ts";
import { validatedStructureAccess } from "../_shared/structure-access.ts";
import { sendOmniaEmail } from "../_shared/brevo-mail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, Accept, x-omnia-session-token",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function sessionToken(req: Request) {
  return (
    req.headers.get("x-omnia-session-token")
    ?? req.headers.get("Authorization")
    ?? ""
  ).replace(/^Bearer\s+/i, "").trim();
}

type RecruiterProfile = { recruiter_type: "independent"; organization_id: null; status: "pending" | "approved" | "rejected" | "suspended" };
type Session = { userId: string; roles: string[]; organizationId: string | null; isPrimaryManager: boolean; permissions: Record<string, boolean>; recruiterProfile: RecruiterProfile | null };

async function authenticate(sb: ReturnType<typeof createClient>, req: Request): Promise<Session | null> {
  const token = sessionToken(req);
  if (!token) return null;
  const { data: session } = await sb.from("user_sessions").select("user_id").eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!session) return null;
  const userId = String(session.user_id);
  const [{ data: roles }, { data: recruiter }, structureAccess] = await Promise.all([
    sb.from("user_roles").select("role").eq("user_id", userId),
    sb.from("talent_recruiter_profiles").select("recruiter_type,organization_id,status").eq("user_id", userId).maybeSingle(),
    validatedStructureAccess(sb, userId),
  ]);
  const organizationId = structureAccess?.organizationId || null;
  let permissions: Record<string, boolean> = structureAccess?.permissions || {};
  if (organizationId) {
    const { data: explicit } = await sb.from("talent_structure_permissions").select("*").eq("organization_id", organizationId).eq("user_id", userId).maybeSingle();
    if (explicit) permissions = { ...permissions, ...explicit };
  }
  const recruiterProfile: RecruiterProfile | null = recruiter?.recruiter_type === "independent" ? {
    recruiter_type: "independent",
    organization_id: null,
    status: recruiter.status,
  } : null;
  return { userId, roles: (roles || []).map((r: any) => String(r.role)), organizationId, isPrimaryManager: !!structureAccess?.isPrimary, permissions, recruiterProfile };
}

function hasRole(s: Session, ...roles: string[]) { return roles.some(r => s.roles.includes(r)); }
const RECRUITMENT_CORE_PERMISSIONS = [
  "can_post_job",
  "can_search_talent",
  "can_contact_talent",
  "can_manage_jobs",
  "can_view_applications",
  "can_schedule_interview",
] as const;

function isIndependentRecruiter(s: Session) {
  return hasRole(s, "recruteur_independant", "recruteur")
    && s.recruiterProfile?.recruiter_type === "independent"
    && s.recruiterProfile.status === "approved";
}
function canUseRecruiter(s: Session) {
  if (hasRole(s, "super_admin")) return true;
  if (s.organizationId) {
    const hasStructureRecruitmentPermission = [
      "can_post_job",
      "can_search_talent",
      "can_contact_talent",
      "can_manage_jobs",
      "can_view_applications",
      "can_schedule_interview",
      "can_manage_team",
    ].some((key) => s.permissions[key] === true);
    if (s.isPrimaryManager || hasStructureRecruitmentPermission) return true;
  }
  return isIndependentRecruiter(s);
}
function can(s: Session, permission: string) {
  if (hasRole(s, "super_admin") || s.isPrimaryManager) return true;
  if (isIndependentRecruiter(s) && RECRUITMENT_CORE_PERMISSIONS.includes(permission as typeof RECRUITMENT_CORE_PERMISSIONS[number])) return true;
  return s.permissions[permission] === true;
}
function scopeOrg(s: Session, scope: string) { return scope === "structure" ? s.organizationId : null; }


async function commerceEntitlementOwner(sb: ReturnType<typeof createClient>, userId: string, organizationId: string | null) {
  if (!organizationId) return userId;
  const { data } = await sb.from("partner_managers").select("user_id").eq("organization_id", organizationId).eq("is_primary", true).eq("status", "actif").maybeSingle();
  return data?.user_id ? String(data.user_id) : userId;
}

async function consumeCommerceBenefit(sb: ReturnType<typeof createClient>, userId: string, organizationId: string | null, benefitKey: string, referenceType: string, referenceId: string | null = null) {
  const ownerId = await commerceEntitlementOwner(sb, userId, organizationId);
  const { data: definition } = await sb.from("commerce_benefit_definitions").select("id").eq("benefit_key", benefitKey).eq("is_active", true).maybeSingle();
  if (!definition) return { allowed: false, reason: "MONETIZATION_NOT_CONFIGURED" };
  const now = new Date().toISOString();
  const { data: rights } = await sb.from("commerce_entitlements").select("id,remaining_quantity")
    .eq("user_id", ownerId).eq("benefit_definition_id", definition.id).eq("status", "active").lte("valid_from", now)
    .or(`valid_until.is.null,valid_until.gte.${now}`).order("valid_until", { ascending: true, nullsFirst: false });
  const right = (rights || []).find((row: any) => row.remaining_quantity === null || Number(row.remaining_quantity) >= 1);
  if (!right) return { allowed: false, reason: "SUBSCRIPTION_OR_PACK_REQUIRED" };
  if (right.remaining_quantity !== null) {
    const remaining = Number(right.remaining_quantity) - 1;
    await sb.from("commerce_entitlements").update({ remaining_quantity: remaining, status: remaining <= 0 ? "exhausted" : "active" }).eq("id", right.id);
  }
  await sb.from("commerce_usage_ledger").insert({ entitlement_id: right.id, user_id: ownerId, quantity: 1, module_key: "talent", action_key: benefitKey, reference_type: referenceType, reference_id: referenceId });
  return { allowed: true };
}

async function profilesByIds(sb: ReturnType<typeof createClient>, ids: string[]) {
  if (!ids.length) return new Map<string, any>();
  const { data } = await sb.from("career_public_profiles").select("user_id,full_name,professional_title,location,photo_url,visibility").in("user_id", ids);
  return new Map((data || []).map((p: any) => [String(p.user_id), { ...p, id: p.user_id }]));
}

async function logActivity(sb: ReturnType<typeof createClient>, s: Session, organizationId: string | null, talentUserId: string | null, action: string, entityType?: string, entityId?: string, metadata: Record<string, unknown> = {}) {
  await sb.from("talent_activity_log").insert({ actor_user_id: s.userId, organization_id: organizationId, talent_user_id: talentUserId, action, entity_type: entityType || null, entity_id: entityId || null, metadata }).catch(() => {});
}

function notificationCopy(type: string) {
  const map: Record<string, [string, string, string | null]> = {
    talent_recruiter_contact: ["Nouveau contact recruteur", "Un recruteur souhaite échanger avec vous.", "/dashboard/career-studio?section=profile"],
    talent_contact_admin_alert: ["Contact Talent enregistré", "Une prise de contact recruteur ↔ apprenant a été enregistrée.", "/admin/talent"],
    talent_interview_requested: ["Nouvel entretien proposé", "Une demande d'entretien vous a été envoyée.", "/dashboard/career-studio?section=interview"],
    talent_new_message: ["Nouveau message", "Vous avez reçu un nouveau message dans Omnia Talent.", "/dashboard/career-studio"],
    recruiter_application_submitted: ["Nouvelle demande recruteur", "Un compte recruteur attend votre validation.", "/admin/talent"],
    recruiter_status_changed: ["Statut recruteur mis à jour", "Le statut de votre compte recruteur a changé.", "/talent/recruteurs"],
  };
  return map[type] || ["Notification Talent", "Une nouvelle activité Talent vous concerne.", null];
}

async function queueNotification(sb: ReturnType<typeof createClient>, userId: string, type: string, payload: Record<string, unknown>) {
  await sb.from("notification_queue").insert({ notification_type: type, user_id: userId, payload }).catch(() => {});
  const [title, message, actionUrl] = notificationCopy(type);
  await sb.from("talent_notifications").insert({ user_id: userId, notification_type: type, title, message, action_url: actionUrl, payload }).catch(() => {});
}

const TALENT_VISIBILITY_DEFAULTS: Record<string, boolean> = {
  display_name: true,
  avatar_url: true,
  headline: true,
  bio: true,
  city: true,
  country_code: true,
  languages: true,
  skills: true,
  target_sectors: true,
  achievements: true,
  availability_text: true,
  years_experience: true,
  portfolio_url: true,
  linkedin_url: true,
  messages: true,
  public_email: false,
  public_phone: false,
};

function talentFieldVisibility(value: unknown) {
  const result = { ...TALENT_VISIBILITY_DEFAULTS };
  if (!value || typeof value !== "object" || Array.isArray(value)) return result;
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (key in result && typeof raw === "boolean") result[key] = raw;
  }
  return result;
}

function maskTalentProfile(profile: any, privacy: any) {
  const fields = talentFieldVisibility(privacy?.field_visibility);
  return {
    ...profile,
    full_name: fields.display_name ? profile.full_name : "Membre Omnia",
    professional_title: fields.headline ? profile.professional_title : null,
    location: fields.city || fields.country_code ? profile.location : null,
    bio: fields.bio ? profile.bio : null,
    skills: fields.skills ? profile.skills || [] : [],
    sectors: fields.target_sectors ? profile.sectors || [] : [],
    languages: fields.languages ? profile.languages || [] : [],
    certifications: fields.achievements ? profile.certifications || [] : [],
    photo_url: fields.avatar_url ? profile.photo_url : null,
    availability: fields.availability_text ? profile.availability : null,
    experience_level: fields.years_experience ? profile.experience_level : null,
    portfolio_url: fields.portfolio_url ? profile.portfolio_url : null,
    contact_enabled: fields.messages && profile.contact_enabled !== false,
  };
}

async function listPublicProfiles(sb: ReturnType<typeof createClient>) {
  const [{ data, error }, { data: internalRoleRows, error: roleError }] = await Promise.all([
    sb
      .from("career_public_profiles")
      .select("user_id,full_name,professional_title,location,bio,skills,sectors,languages,certifications,photo_url,availability,experience_level,portfolio_url,contact_enabled,updated_at")
      .eq("visibility", "public")
      .order("updated_at", { ascending: false }),
    sb.from("user_roles").select("user_id").eq("role", "super_admin"),
  ]);
  if (error) throw error;
  if (roleError) throw roleError;

  const internalUserIds = new Set((internalRoleRows || []).map((row: any) => String(row.user_id)));
  const candidates = (data || []).filter((profile: any) => !internalUserIds.has(String(profile.user_id)));
  const userIds = candidates.map((profile: any) => String(profile.user_id));
  const privacyByUser = new Map<string, any>();
  if (userIds.length) {
    const { data: privacyRows, error: privacyError } = await sb
      .from("user_profiles")
      .select("user_id,visibility,field_visibility")
      .in("user_id", userIds);
    if (privacyError) throw privacyError;
    for (const row of privacyRows || []) privacyByUser.set(String(row.user_id), row);
  }

  return candidates
    .filter((profile: any) => {
      const privacy = privacyByUser.get(String(profile.user_id));
      return !privacy || privacy.visibility === "public";
    })
    .map((profile: any) => ({
      ...maskTalentProfile(profile, privacyByUser.get(String(profile.user_id))),
      id: profile.user_id,
    }));
}

async function savePublicProfile(sb: ReturnType<typeof createClient>, req: Request, body: any) {
  const token = sessionToken(req);
  if (!token) return json({ error: "SESSION_INVALID" }, 401);
  const { data: session } = await sb.from("user_sessions").select("user_id").eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!session) return json({ error: "SESSION_INVALID" }, 401);
  const userId = String(session.user_id);
  const { data: internalRole } = await sb.from("user_roles")
    .select("user_id")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (internalRole) {
    await sb.from("career_public_profiles").delete().eq("user_id", userId);
    return json({ error: "PUBLIC_PROFILE_NOT_AVAILABLE" }, 403);
  }
  const profile = body.profile || {};
  const { data: privacy, error: privacyError } = await sb
    .from("user_profiles")
    .select("visibility,field_visibility")
    .eq("user_id", userId)
    .maybeSingle();
  if (privacyError) throw privacyError;
  const fields = talentFieldVisibility(privacy?.field_visibility);
  const row = {
    user_id: userId,
    full_name: fields.display_name ? profile.full_name || "" : "Membre Omnia",
    professional_title: fields.headline ? profile.title || profile.professional_title || null : null,
    email: fields.public_email ? profile.email || null : null,
    phone: fields.public_phone ? profile.phone || null : null,
    location: fields.city || fields.country_code ? profile.location || null : null,
    linkedin: fields.linkedin_url !== false ? profile.linkedin || null : null,
    bio: fields.bio ? profile.summary || profile.bio || null : null,
    skills: fields.skills && Array.isArray(profile.skills) ? profile.skills : [],
    sectors: fields.target_sectors && Array.isArray(profile.sectors) ? profile.sectors : [],
    languages: fields.languages && Array.isArray(profile.languages) ? profile.languages : [],
    certifications: fields.achievements && Array.isArray(profile.certifications) ? profile.certifications : [],
    photo_url: fields.avatar_url ? profile.photo_url || null : null,
    availability: fields.availability_text ? profile.availability || null : null,
    experience_level: fields.years_experience ? profile.experience_level || null : null,
    portfolio_url: fields.portfolio_url ? profile.portfolio_url || null : null,
    contact_enabled: fields.messages && profile.contact_enabled !== false,
    visibility: privacy?.visibility === "public" ? "public" : privacy?.visibility === "members" ? "recruiters" : "private",
    documents_visibility: profile.documents_visibility || "private",
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await sb.from("career_public_profiles").upsert(row, { onConflict: "user_id" }).select().single();
  if (error) throw error;
  return json({ success: true, profile: data });
}


function analyticsPeriod(value: unknown) {
  const days = Number(value || 30);
  return [7, 30, 90, 365].includes(days) ? days : 30;
}
function dayKey(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}
function buildSeries(days: number, activity: any[], applications: any[] = []) {
  const rows = new Map<string, { date: string; profile_views: number; contacts: number; interviews: number; applications: number }>();
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now); d.setUTCDate(now.getUTCDate() - i);
    const key = dayKey(d); rows.set(key, { date: key, profile_views: 0, contacts: 0, interviews: 0, applications: 0 });
  }
  for (const item of activity || []) {
    const row = rows.get(dayKey(item.created_at)); if (!row) continue;
    if (item.action === "profile_viewed") row.profile_views++;
    if (["talent_contacted", "contact_created"].includes(item.action)) row.contacts++;
    if (["interview_created", "interview_requested"].includes(item.action)) row.interviews++;
  }
  for (const item of applications || []) {
    const row = rows.get(dayKey(item.submitted_at || item.created_at)); if (row) row.applications++;
  }
  return Array.from(rows.values());
}
async function userIdsForOrganization(sb: ReturnType<typeof createClient>, organizationId: string) {
  const { data } = await sb.from("partner_managers").select("user_id").eq("organization_id", organizationId).eq("status", "actif");
  return (data || []).map((row: any) => String(row.user_id));
}
async function loadAnalytics(sb: ReturnType<typeof createClient>, session: Session, body: any) {
  const periodDays = analyticsPeriod(body.period_days);
  const since = new Date(Date.now() - periodDays * 86400000).toISOString();
  const requestedScope = String(body.scope || "recruiter");
  const isAdmin = requestedScope === "admin";
  if (isAdmin && !hasRole(session, "super_admin")) throw new Error("FORBIDDEN");
  const organizationId = requestedScope === "structure" ? session.organizationId : null;
  if (requestedScope === "structure" && !organizationId && !hasRole(session, "super_admin")) throw new Error("NO_STRUCTURE");

  let actorIds: string[] = [session.userId];
  if (organizationId) actorIds = await userIdsForOrganization(sb, organizationId);

  let activityQuery = sb.from("talent_activity_log").select("id,action,created_at,metadata,actor_user_id,organization_id,talent_user_id").gte("created_at", since).order("created_at", { ascending: false });
  if (!isAdmin) activityQuery = organizationId ? activityQuery.eq("organization_id", organizationId) : activityQuery.eq("actor_user_id", session.userId).is("organization_id", null);
  const { data: activity, error: activityError } = await activityQuery.limit(5000);
  if (activityError) throw activityError;

  let favoritesQuery = sb.from("talent_favorites").select("id", { count: "exact", head: true });
  let contactsQuery = sb.from("talent_contacts").select("id,status,created_at", { count: "exact" }).gte("created_at", since);
  let interviewsQuery = sb.from("talent_interviews").select("id,status,scheduled_at,created_at", { count: "exact" }).gte("created_at", since);
  if (!isAdmin) {
    favoritesQuery = organizationId ? favoritesQuery.eq("organization_id", organizationId) : favoritesQuery.eq("actor_user_id", session.userId).is("organization_id", null);
    contactsQuery = organizationId ? contactsQuery.eq("organization_id", organizationId) : contactsQuery.eq("actor_user_id", session.userId).is("organization_id", null);
    interviewsQuery = organizationId ? interviewsQuery.eq("organization_id", organizationId) : interviewsQuery.eq("requested_by", session.userId).is("organization_id", null);
  }

  let jobsQuery = sb.from("job_offers").select("id,status,created_at,posted_by_id").gte("created_at", since);
  if (!isAdmin) jobsQuery = jobsQuery.in("posted_by_id", actorIds.length ? actorIds : [session.userId]);
  const [favoritesResult, contactsResult, interviewsResult, jobsResult] = await Promise.all([favoritesQuery, contactsQuery, interviewsQuery, jobsQuery]);
  for (const result of [favoritesResult, contactsResult, interviewsResult, jobsResult]) {
    if (result.error) throw result.error;
  }
  const jobs = jobsResult.data || [];
  const jobIds = jobs.map((row: any) => String(row.id));
  let applications: any[] = [];
  if (isAdmin) {
    const result = await sb.from("job_applications").select("id,status,submitted_at,job_id").gte("submitted_at", since);
    if (result.error) throw result.error;
    applications = result.data || [];
  } else if (jobIds.length) {
    const result = await sb.from("job_applications").select("id,status,submitted_at,job_id").in("job_id", jobIds).gte("submitted_at", since);
    if (result.error) throw result.error;
    applications = result.data || [];
  }

  const contacts = contactsResult.data || [];
  const interviews = interviewsResult.data || [];
  const replied = contacts.filter((c: any) => ["read", "replied", "closed"].includes(String(c.status))).length;
  const hires = applications.filter((a: any) => ["accepted", "offer", "hired"].includes(String(a.status))).length;
  const metrics: Record<string, number> = {
    active_jobs: jobs.filter((j: any) => j.status === "approved").length,
    applications: applications.length,
    profile_views: (activity || []).filter((a: any) => a.action === "profile_viewed").length,
    favorites: favoritesResult.count || 0,
    contacts: contactsResult.count || contacts.length,
    interviews: interviewsResult.count || interviews.length,
    hires,
    response_rate: contacts.length ? Math.round((replied / contacts.length) * 100) : 0,
  };
  if (isAdmin) {
    const [profiles, recruiters, structures] = await Promise.all([
      sb.from("career_public_profiles").select("user_id", { count: "exact", head: true }).eq("visibility", "public"),
      sb.from("talent_recruiter_profiles").select("user_id", { count: "exact", head: true }).eq("status", "approved"),
      sb.from("talent_recruiter_profiles").select("organization_id").eq("status", "approved").not("organization_id", "is", null),
    ]);
    for (const result of [profiles, recruiters, structures]) {
      if (result.error) throw result.error;
    }
    metrics.public_profiles = profiles.count || 0;
    metrics.approved_recruiters = recruiters.count || 0;
    metrics.recruiting_structures = new Set((structures.data || []).map((r: any) => String(r.organization_id))).size;
  }
  return { period_days: periodDays, metrics, series: buildSeries(periodDays, activity || [], applications), recent_activity: (activity || []).slice(0, 30) };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    if (action === "health") {
      return json({ success: true, service: "talent-recruitment", status: "ready" });
    }

    // Public profile actions formerly handled by career-public-profiles.
    if (action === "public_list" || action === "list_public_profiles" || action === "list") {
      return json({ success: true, profiles: await listPublicProfiles(sb) });
    }
    if (action === "save_public_profile" || action === "save") {
      return await savePublicProfile(sb, req, body);
    }

    const session = await authenticate(sb, req);
    if (!session) return json({ error: "SESSION_INVALID" }, 401);


    if (action === "log_profile_view") {
      const talentId = String(body.talent_user_id || "");
      if (!talentId || talentId === session.userId) return json({ success: true });
      await logActivity(sb, session, session.organizationId, talentId, "profile_viewed", "talent", talentId);
      return json({ success: true });
    }

    if (action === "analytics") {
      try { return json({ success: true, analytics: await loadAnalytics(sb, session, body) }); }
      catch (error) {
        const message = error instanceof Error ? error.message : "ANALYTICS_UNAVAILABLE";
        if (["FORBIDDEN", "NO_STRUCTURE"].includes(message)) return json({ error: message }, 403);
        throw error;
      }
    }

    // Actions accessibles à tout utilisateur Omnia connecté avant validation du rôle recruteur.
    if (action === "recruiter_self_status") {
      const { data, error } = await sb.from("talent_recruiter_profiles").select("*").eq("user_id", session.userId).maybeSingle();
      if (error) throw error;
      return json({ success: true, profile: data || null });
    }

    if (action === "submit_recruiter_application") {
      return json({
        error: "DEDICATED_RECRUITER_ACCOUNT_REQUIRED",
        message: "Créez un compte recruteur indépendant distinct depuis /inscription/recruteur.",
      }, 409);
    }

    if (action === "list_notifications") {
      const { data, error } = await sb.from("talent_notifications").select("*").eq("user_id", session.userId).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return json({ success: true, notifications: data || [], unread: (data || []).filter((n: any) => !n.read_at).length });
    }

    if (action === "mark_notification_read") {
      const notificationId = body.notification_id ? String(body.notification_id) : null;
      let q = sb.from("talent_notifications").update({ read_at: new Date().toISOString() }).eq("user_id", session.userId).is("read_at", null);
      if (notificationId) q = q.eq("id", notificationId);
      const { error } = await q;
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "update_recruiter_preferences") {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (["public","private"].includes(String(body.visibility))) patch.visibility = body.visibility;
      if (typeof body.notifications_enabled === "boolean") patch.notifications_enabled = body.notifications_enabled;
      const { data, error } = await sb.from("talent_recruiter_profiles").update(patch).eq("user_id", session.userId).select().single();
      if (error) throw error;
      return json({ success: true, profile: data });
    }

    if (action === "admin_talent_supervision" || action === "admin_update_recruiter_status") {
      if (!hasRole(session, "super_admin")) return json({ error: "FORBIDDEN" }, 403);
      if (action === "admin_talent_supervision") {
        let rq = sb.from("talent_recruiter_profiles").select("*").eq("recruiter_type", "independent");
        if (body.status) rq = rq.eq("status", String(body.status));
        const [recruitersResult, contactsResult, activityResult] = await Promise.all([
          rq.order("created_at", { ascending: false }),
          sb.from("talent_contacts").select("*").order("created_at", { ascending: false }).limit(100),
          sb.from("talent_activity_log").select("*").order("created_at", { ascending: false }).limit(150),
        ]);
        if (recruitersResult.error) throw recruitersResult.error;
        if (contactsResult.error) throw contactsResult.error;
        if (activityResult.error) throw activityResult.error;
        const baseRecruiters = recruitersResult.data || [];
        const userIds = [...new Set(baseRecruiters.map((r:any)=>r.user_id).filter(Boolean))];
        let usersById:any = {};
        if(userIds.length){
          const {data:userRows,error:userError}=await sb.from("users").select("id,full_name,email,email_status,status").in("id",userIds);
          if(userError) throw userError;
          usersById=Object.fromEntries((userRows||[]).map((u:any)=>[u.id,u]));
        }
        const recruiters = baseRecruiters
          .filter((r:any)=>String(usersById[r.user_id]?.email_status || "valide") === "valide")
          .map((r:any)=>({...r,users:usersById[r.user_id]||null}));
        return json({ success: true, recruiters, contacts: contactsResult.data || [], activity: activityResult.data || [], metrics: {
          pending: recruiters.filter((r: any) => r.status === "pending").length,
          approved: recruiters.filter((r: any) => r.status === "approved").length,
          suspended: recruiters.filter((r: any) => r.status === "suspended").length,
          contacts: (contactsResult.data || []).length,
        }});
      }
      const targetUserId = String(body.user_id || "");
      const status = String(body.status || "");
      if (!targetUserId || !["pending","approved","rejected","suspended"].includes(status)) return json({ error: "INVALID_STATUS" }, 400);
      const [{ data: currentProfile }, { data: targetRoles }, { data: targetUser }] = await Promise.all([
        sb.from("talent_recruiter_profiles").select("recruiter_type,status").eq("user_id", targetUserId).maybeSingle(),
        sb.from("user_roles").select("role").eq("user_id", targetUserId),
        sb.from("users").select("email_status,status").eq("id", targetUserId).maybeSingle(),
      ]);
      if (!targetUser || String(targetUser.email_status || "valide") !== "valide") {
        return json({ error: "EMAIL_VERIFICATION_REQUIRED", message: "Le recruteur doit d’abord confirmer son adresse e-mail avant l’examen de sa demande." }, 409);
      }
      const targetRoleNames = (targetRoles || []).map((row: any) => String(row.role));
      const patch: Record<string, unknown> = { status, rejection_reason: body.reason || null, updated_at: new Date().toISOString(), validated_by: session.userId };
      if (status === "approved") patch.validated_at = new Date().toISOString();
      if (status === "suspended") patch.suspended_at = new Date().toISOString();
      const { data, error } = await sb.from("talent_recruiter_profiles").update(patch).eq("user_id", targetUserId).select().single();
      if (error) throw error;

      // Un statut Recruteur est un statut de rôle, jamais un statut du compte Omnia.
      // Les autres espaces déjà possédés (Apprenant, Professeur, Coach...) sont conservés.
      if (status === "approved" && data.recruiter_type === "independent") {
        await sb.from("user_roles").upsert({ user_id: targetUserId, role: "recruteur_independant" }, { onConflict: "user_id,role" });
        await sb.from("user_roles").delete().eq("user_id", targetUserId).eq("role", "recruteur");
        if (String(targetUser.status || "") === "en_attente_validation") {
          await sb.from("users").update({ status: "actif", updated_at: new Date().toISOString() }).eq("id", targetUserId);
        }
      } else if (status === "approved") {
        await sb.from("user_roles").delete().eq("user_id", targetUserId).in("role", ["recruteur_independant", "recruteur"]);
        if (String(targetUser.status || "") === "en_attente_validation") {
          await sb.from("users").update({ status: "actif", updated_at: new Date().toISOString() }).eq("id", targetUserId);
        }
      }
      if (["rejected", "suspended"].includes(status)) {
        await sb.from("user_roles").delete().eq("user_id", targetUserId).in("role", ["recruteur_independant", "recruteur"]);
        if (String(targetUser.status || "") === "en_attente_validation") {
          await sb.from("users").update({ status: "actif", updated_at: new Date().toISOString() }).eq("id", targetUserId);
        }
      }
      await queueNotification(sb, targetUserId, "recruiter_status_changed", { status, reason: body.reason || null });

      const { data: recruiterUser } = await sb
        .from("users")
        .select("email,full_name")
        .eq("id", targetUserId)
        .maybeSingle();
      if (recruiterUser?.email) {
        const appUrl = (Deno.env.get("APP_URL") || "https://omniaglobalacademy.com").replace(/\/$/, "");
        const statusLabel = status === "approved"
          ? "Compte recruteur validé"
          : status === "rejected"
          ? "Candidature non validée"
          : status === "suspended"
          ? "Compte recruteur suspendu"
          : "Candidature en attente";
        await sendOmniaEmail({
          sb,
          userId: targetUserId,
          to: { email: String(recruiterUser.email), name: recruiterUser.full_name || undefined },
          templateKey: "status_update",
          params: {
            SUBJECT: "Mise à jour de votre compte Recruteur Omnia Talent",
            FIRST_NAME: String(recruiterUser.full_name || "").split(" ")[0],
            MESSAGE: status === "approved"
              ? "Votre compte Recruteur indépendant est validé et peut maintenant accéder à Omnia Talent."
              : status === "rejected"
              ? "Votre candidature Recruteur indépendant n’a pas été validée."
              : status === "suspended"
              ? "Votre accès Recruteur indépendant a été suspendu."
              : "Votre candidature Recruteur indépendant est en cours d’examen.",
            STATUS_LABEL: statusLabel,
            ADDITIONAL_INFORMATION: body.reason || "",
            CTA_LABEL: status === "approved" ? "Accéder à Omnia Talent" : "Consulter Omnia",
            CTA_URL: status === "approved" ? `${appUrl}/talent/recruteur/dashboard` : `${appUrl}/connexion`,
          },
        });
      }

      await logActivity(sb, session, null, targetUserId, "recruiter_status_changed", "user", targetUserId, { status, reason: body.reason || null });
      return json({ success: true, profile: data });
    }

    if (!canUseRecruiter(session)) return json({ error: "FORBIDDEN" }, 403);
    const scope = body.scope === "structure" ? "structure" : "recruiter";
    const organizationId = scopeOrg(session, scope);
    if (scope === "structure" && !organizationId && !hasRole(session, "super_admin")) return json({ error: "NO_STRUCTURE" }, 403);

    if (action === "dashboard") {
      const favoriteQuery = organizationId ? sb.from("talent_favorites").select("id", { count: "exact", head: true }).eq("organization_id", organizationId) : sb.from("talent_favorites").select("id", { count: "exact", head: true }).eq("actor_user_id", session.userId).is("organization_id", null);
      const contactQuery = organizationId ? sb.from("talent_contacts").select("id", { count: "exact", head: true }).eq("organization_id", organizationId) : sb.from("talent_contacts").select("id", { count: "exact", head: true }).eq("actor_user_id", session.userId).is("organization_id", null);
      const interviewQuery = organizationId ? sb.from("talent_interviews").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).gte("scheduled_at", new Date().toISOString()).in("status", ["pending","accepted"]) : sb.from("talent_interviews").select("id", { count: "exact", head: true }).eq("requested_by", session.userId).is("organization_id", null).gte("scheduled_at", new Date().toISOString()).in("status", ["pending","accepted"]);
      const [favorites, contacts, interviews] = await Promise.all([favoriteQuery, contactQuery, interviewQuery]);
      for (const result of [favorites, contacts, interviews]) {
        if (result.error) throw result.error;
      }
      return json({ success: true, metrics: { favorites: favorites.count || 0, contacts: contacts.count || 0, upcoming_interviews: interviews.count || 0 } });
    }

    if (action === "list_favorites") {
      const q = organizationId ? sb.from("talent_favorites").select("id,talent_user_id,created_at").eq("organization_id", organizationId) : sb.from("talent_favorites").select("id,talent_user_id,created_at").eq("actor_user_id", session.userId).is("organization_id", null);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      const map = await profilesByIds(sb, (data || []).map((r: any) => String(r.talent_user_id)));
      return json({ success: true, favorites: (data || []).map((r: any) => map.get(String(r.talent_user_id))).filter(Boolean) });
    }

    if (action === "toggle_favorite") {
      if (!can(session, "can_search_talent")) return json({ error: "PERMISSION_DENIED" }, 403);
      const talentId = String(body.talent_user_id || "");
      if (!talentId) return json({ error: "TALENT_REQUIRED" }, 400);
      let find = sb.from("talent_favorites").select("id").eq("talent_user_id", talentId);
      find = organizationId ? find.eq("organization_id", organizationId) : find.eq("actor_user_id", session.userId).is("organization_id", null);
      const { data: existing } = await find.maybeSingle();
      if (existing) {
        await sb.from("talent_favorites").delete().eq("id", existing.id);
        await logActivity(sb, session, organizationId, talentId, "favorite_removed", "talent", talentId);
        return json({ success: true, favorite: false });
      }
      await sb.from("talent_favorites").insert({ actor_user_id: session.userId, organization_id: organizationId, talent_user_id: talentId });
      await logActivity(sb, session, organizationId, talentId, "favorite_added", "talent", talentId);
      return json({ success: true, favorite: true });
    }

    if (action === "contact_talent") {
      if (!can(session, "can_contact_talent")) return json({ error: "PERMISSION_DENIED" }, 403);
      const talentId = String(body.talent_user_id || "");
      const message = String(body.message || "").trim();
      if (!talentId || message.length < 5) return json({ error: "INVALID_CONTACT" }, 400);
      if (!hasRole(session, "super_admin")) {
        const commercial = await consumeCommerceBenefit(sb, session.userId, organizationId, "recruiter_contact_credits", "talent", talentId);
        if (!commercial.allowed) return json({ error: commercial.reason, message: "Un crédit de contact recruteur est requis." }, 402);
      }
      const { data: contact, error } = await sb.from("talent_contacts").insert({ actor_user_id: session.userId, organization_id: organizationId, talent_user_id: talentId, subject: body.subject || null, message, status: "sent" }).select().single();
      if (error) throw error;
      let convQuery = sb.from("talent_conversations").select("id").eq("talent_user_id", talentId).is("closed_at", null);
      convQuery = organizationId ? convQuery.eq("organization_id", organizationId) : convQuery.eq("created_by", session.userId).is("organization_id", null);
      let { data: conversation } = await convQuery.maybeSingle();
      if (!conversation) {
        const created = await sb.from("talent_conversations").insert({ created_by: session.userId, organization_id: organizationId, talent_user_id: talentId, subject: body.subject || "Prise de contact" }).select("id").single();
        if (created.error) throw created.error;
        conversation = created.data;
      }
      await sb.from("talent_messages").insert({ conversation_id: conversation.id, sender_user_id: session.userId, recipient_user_id: talentId, body: message });
      await sb.from("talent_conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversation.id);
      await queueNotification(sb, talentId, "talent_recruiter_contact", { contact_id: contact.id, conversation_id: conversation.id, organization_id: organizationId, recruiter_user_id: session.userId });
      const { data: admins } = await sb.from("user_roles").select("user_id").eq("role", "super_admin");
      for (const admin of admins || []) await queueNotification(sb, String(admin.user_id), "talent_contact_admin_alert", { contact_id: contact.id, talent_user_id: talentId, recruiter_user_id: session.userId, organization_id: organizationId });
      await logActivity(sb, session, organizationId, talentId, "talent_contacted", "contact", contact.id);
      return json({ success: true, contact, conversation_id: conversation.id });
    }

    if (action === "list_contacts") {
      let q = sb.from("talent_contacts").select("*");
      q = organizationId ? q.eq("organization_id", organizationId) : q.eq("actor_user_id", session.userId).is("organization_id", null);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      const map = await profilesByIds(sb, (data || []).map((r: any) => String(r.talent_user_id)));
      return json({ success: true, contacts: (data || []).map((r: any) => ({ ...r, talent: map.get(String(r.talent_user_id)) || null })) });
    }

    if (action === "create_interview") {
      if (!can(session, "can_schedule_interview")) return json({ error: "PERMISSION_DENIED" }, 403);
      const talentId = String(body.talent_user_id || "");
      const scheduledAt = String(body.scheduled_at || "");
      if (!talentId || !scheduledAt || Number.isNaN(Date.parse(scheduledAt))) return json({ error: "INVALID_INTERVIEW" }, 400);
      const { data, error } = await sb.from("talent_interviews").insert({ requested_by: session.userId, organization_id: organizationId, talent_user_id: talentId, job_id: body.job_id || null, title: body.title || "Entretien de recrutement", interview_mode: body.interview_mode || "video", scheduled_at: scheduledAt, duration_minutes: Number(body.duration_minutes || 30), meeting_url: body.meeting_url || null, location: body.location || null, notes: body.notes || null }).select().single();
      if (error) throw error;
      await queueNotification(sb, talentId, "talent_interview_requested", { interview_id: data.id, scheduled_at: data.scheduled_at, title: data.title });
      await logActivity(sb, session, organizationId, talentId, "interview_requested", "interview", data.id);
      return json({ success: true, interview: data });
    }

    if (action === "list_interviews") {
      let q = sb.from("talent_interviews").select("*");
      q = organizationId ? q.eq("organization_id", organizationId) : q.eq("requested_by", session.userId).is("organization_id", null);
      const { data, error } = await q.order("scheduled_at", { ascending: true });
      if (error) throw error;
      const map = await profilesByIds(sb, (data || []).map((r: any) => String(r.talent_user_id)));
      return json({ success: true, interviews: (data || []).map((r: any) => ({ ...r, talent: map.get(String(r.talent_user_id)) || null })) });
    }

    if (action === "list_conversations") {
      let q = sb.from("talent_conversations").select("id,talent_user_id,subject,last_message_at,created_at").is("closed_at", null);
      q = organizationId ? q.eq("organization_id", organizationId) : q.eq("created_by", session.userId).is("organization_id", null);
      const { data, error } = await q.order("last_message_at", { ascending: false });
      if (error) throw error;
      const map = await profilesByIds(sb, (data || []).map((r: any) => String(r.talent_user_id)));
      const result = [];
      for (const conversation of data || []) {
        const { data: last } = await sb.from("talent_messages").select("body,created_at,read_at,sender_user_id").eq("conversation_id", conversation.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
        result.push({ ...conversation, talent: map.get(String(conversation.talent_user_id)) || null, last_message: last || null });
      }
      return json({ success: true, conversations: result });
    }

    if (action === "send_message") {
      if (!can(session, "can_contact_talent")) return json({ error: "PERMISSION_DENIED" }, 403);
      const conversationId = String(body.conversation_id || "");
      const text = String(body.message || "").trim();
      if (!conversationId || !text) return json({ error: "INVALID_MESSAGE" }, 400);
      let q = sb.from("talent_conversations").select("id,talent_user_id,organization_id,created_by").eq("id", conversationId);
      const { data: conversation } = await q.maybeSingle();
      if (!conversation) return json({ error: "CONVERSATION_NOT_FOUND" }, 404);
      const owns = organizationId ? String(conversation.organization_id || "") === organizationId : String(conversation.created_by) === session.userId && !conversation.organization_id;
      if (!owns && !hasRole(session, "super_admin")) return json({ error: "FORBIDDEN" }, 403);
      const { data, error } = await sb.from("talent_messages").insert({ conversation_id: conversationId, sender_user_id: session.userId, recipient_user_id: conversation.talent_user_id, body: text }).select().single();
      if (error) throw error;
      await sb.from("talent_conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversationId);
      await queueNotification(sb, String(conversation.talent_user_id), "talent_new_message", { conversation_id: conversationId, message_id: data.id });
      return json({ success: true, message: data });
    }

    if (action === "list_team_permissions") {
      if (!organizationId || !can(session, "can_manage_team")) return json({ error: "PERMISSION_DENIED" }, 403);
      const { data: members, error } = await sb.from("partner_managers")
        .select("user_id,role_in_org,is_primary,status")
        .eq("organization_id", organizationId)
        .neq("status", "retire")
        .order("is_primary", { ascending: false });
      if (error) throw error;
      const userIds = (members || []).map((member: any) => member.user_id).filter(Boolean);
      const [{ data: permissions }, { data: users }] = await Promise.all([
        sb.from("talent_structure_permissions").select("*").eq("organization_id", organizationId),
        userIds.length ? sb.from("users").select("id,full_name,email,created_at").in("id", userIds) : Promise.resolve({ data: [] as any[] }),
      ]);
      const byUser = new Map((permissions || []).map((permission: any) => [String(permission.user_id), permission]));
      const usersById = new Map((users || []).map((user: any) => [String(user.id), user]));
      return json({
        success: true,
        members: (members || []).map((member: any) => ({
          ...member,
          users: usersById.get(String(member.user_id)) || null,
          recruitment_permissions: byUser.get(String(member.user_id)) || null,
        })),
      });
    }

    if (action === "update_team_permissions") {
      if (!organizationId || !can(session, "can_manage_team")) return json({ error: "PERMISSION_DENIED" }, 403);
      const targetUserId = String(body.user_id || "");
      if (!targetUserId) return json({ error: "USER_REQUIRED" }, 400);
      const { data: member, error: memberError } = await sb.from("partner_managers")
        .select("user_id,is_primary,status")
        .eq("organization_id", organizationId)
        .eq("user_id", targetUserId)
        .neq("status", "retire")
        .maybeSingle();
      if (memberError) throw memberError;
      if (!member) return json({ error: "STRUCTURE_MEMBER_REQUIRED" }, 404);
      if (member.is_primary) return json({ error: "PRIMARY_MANAGER_PERMISSIONS_FIXED" }, 409);

      const row: Record<string, unknown> = {
        organization_id: organizationId,
        user_id: targetUserId,
        can_post_job: body.permissions?.can_post_job === true,
        can_search_talent: body.permissions?.can_search_talent === true,
        can_contact_talent: body.permissions?.can_contact_talent === true,
        can_manage_jobs: body.permissions?.can_manage_jobs === true,
        can_view_applications: body.permissions?.can_view_applications === true,
        can_schedule_interview: body.permissions?.can_schedule_interview === true,
        can_manage_team: body.permissions?.can_manage_team === true,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await sb.from("talent_structure_permissions").upsert(row, { onConflict: "organization_id,user_id" }).select().single();
      if (error) throw error;
      await logActivity(sb, session, organizationId, targetUserId, "recruitment_permissions_updated", "user", targetUserId, row);
      return json({ success: true, permissions: data });
    }

    return json({ error: "UNKNOWN_ACTION" }, 400);
  } catch (error) {
    console.error("talent-recruitment", error);
    return json({ error: "SERVER_ERROR", message: error instanceof Error ? error.message : String(error) }, 500);
  }
});
