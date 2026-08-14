import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { validatedStructureAccess, validatedStructureRecruitmentAccess } from "../_shared/structure-access.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-omnia-session-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const text = (value: unknown, max = 5000) => String(value ?? "").trim().slice(0, max);
const textArray = (value: unknown, max = 100, itemMax = 160) => Array.isArray(value)
  ? [...new Set(value.map((item) => text(item, itemMax)).filter(Boolean))].slice(0, max)
  : [];
const normalize = (value: unknown) => text(value, 500).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

type Session = { userId: string; roles: string[]; isAdmin: boolean; isRecruiter: boolean; isLearner: boolean; organizationId: string | null };
function tokenFrom(req: Request, bodyToken = "") {
  return (bodyToken || req.headers.get("x-omnia-session-token") || req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
}
async function authenticate(sb: any, req: Request, bodyToken = ""): Promise<Session | null> {
  const token = tokenFrom(req, bodyToken);
  if (!token) return null;
  const { data: active } = await sb.from("user_sessions").select("user_id").eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!active?.user_id) return null;
  const userId = String(active.user_id);
  const [{ data: roleRows }, structureAccess, recruitmentAccess] = await Promise.all([
    sb.from("user_roles").select("role").eq("user_id", userId),
    validatedStructureAccess(sb, userId),
    validatedStructureRecruitmentAccess(sb, userId),
  ]);
  const roles = (roleRows || []).map((row: any) => text(row.role, 80).toLowerCase());
  return {
    userId,
    roles,
    isAdmin: roles.some((role: string) => ["super_admin", "admin"].includes(role)),
    isRecruiter: roles.some((role: string) => ["recruteur", "recruteur_independant", "recruiter"].includes(role)) || !!recruitmentAccess,
    isLearner: roles.includes("apprenant"),
    organizationId: structureAccess?.organizationId || null,
  };
}
function requireSession(session: Session | null): asserts session is Session { if (!session) throw new Error("AUTH_REQUIRED"); }
async function ensureProfile(sb: any, userId: string) {
  const { data: existing } = await sb.from("employability_profiles").select("*").eq("user_id", userId).maybeSingle();
  if (existing) return existing;
  const { data, error } = await sb.from("employability_profiles").insert({ user_id: userId }).select("*").single();
  if (error) throw error;
  return data;
}
async function getActiveConsent(sb: any, userId: string) {
  const { data } = await sb.from("employability_profiles").select("*").eq("user_id", userId).eq("status", "active").in("talent_visibility", ["recruiters", "public"]).maybeSingle();
  return data || null;
}
function addTerms(target: Set<string>, values: unknown) {
  for (const value of textArray(values, 250, 240)) { const normalized = normalize(value); if (normalized) target.add(normalized); }
}
async function collectSources(sb: any, userId: string, profile: any, recruiterView = false) {
  const skills = new Set<string>();
  const sectors = new Set<string>();
  const certifications = new Set<string>();
  const evidence: any[] = [];
  let career: any = null, portfolio: any = null, passport: any = null, learningRecord: any = null;

  if (profile.use_career_documents) {
    const { data } = await sb.from("career_public_profiles").select("user_id,full_name,professional_title,location,bio,skills,sectors,languages,certifications,photo_url,visibility,documents_visibility").eq("user_id", userId).maybeSingle();
    if (data && (!recruiterView || ["recruiters", "public"].includes(data.visibility))) {
      career = data; addTerms(skills, data.skills); addTerms(sectors, data.sectors); addTerms(certifications, data.certifications);
    }
  }

  if (profile.use_project_evidence) {
    const { data: profileRow } = await sb.from("project_portfolio_profiles")
      .select("id,user_id,headline,professional_summary,target_roles,featured_skill_codes,status,default_visibility")
      .eq("user_id", userId).eq("status", "published").maybeSingle();
    portfolio = profileRow || null;
    if (portfolio) {
      addTerms(skills, portfolio.featured_skill_codes); addTerms(skills, portfolio.target_roles);
      if (recruiterView) {
        const { data: items } = await sb.from("project_portfolio_items")
          .select("id,display_title,display_summary,visibility,is_featured,display_order,show_organization,show_deliverable_link,evidence:omnia_project_verified_evidence(id,title,summary,skill_codes,evidence_type,evidence_url,validated_at,project:omnia_projects(id,slug,title,organization_name,project_type))")
          .eq("profile_id", portfolio.id).in("visibility", ["recruiters", "public"]).order("display_order").limit(100);
        for (const item of items || []) {
          const source = item.evidence;
          if (!source) continue;
          const project = source.project ? { ...source.project, organization_name: item.show_organization ? source.project.organization_name : null } : null;
          const row = { id: source.id, title: item.display_title || source.title, summary: item.display_summary || source.summary, skill_codes: source.skill_codes || [], evidence_type: source.evidence_type, evidence_url: item.show_deliverable_link ? source.evidence_url : null, validated_at: source.validated_at, project, is_featured: item.is_featured };
          addTerms(skills, row.skill_codes); evidence.push(row);
        }
      } else {
        const { data: rows } = await sb.from("omnia_project_verified_evidence")
          .select("id,title,summary,description,skill_codes,portfolio_permission,evidence_type,evidence_url,validated_at,project:omnia_projects(id,slug,title,organization_name,project_type)")
          .eq("user_id", userId).eq("validation_status", "validated").order("validated_at", { ascending: false }).limit(100);
        for (const row of rows || []) { addTerms(skills, row.skill_codes); evidence.push(row); }
      }
    }
  }

  if (profile.use_skills_passport) {
    const { data: passportRow } = await sb.from("skills_passports").select("id,title,status,professional_headline,professional_summary,target_roles,languages,location_text,availability_text,selected_sections,published_at,updated_at").eq("user_id", userId).eq("status", "published").order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (passportRow) {
      const { data: items } = await sb.from("skills_passport_items").select("display_order,is_featured,achievement:clr_achievements(id,title,description,achievement_type,section,visibility,issued_at,payload)").eq("passport_id", passportRow.id).order("display_order");
      const filtered = (items || []).filter((item: any) => !recruiterView || ["recruiters", "public"].includes(item.achievement?.visibility));
      passport = { ...passportRow, items: filtered };
      addTerms(skills, passportRow.target_roles);
      for (const item of filtered) {
        addTerms(skills, item.achievement?.payload?.skill_codes || item.achievement?.payload?.skills);
        if (item.achievement?.section === "certifications" || item.achievement?.achievement_type?.toLowerCase().includes("certif")) certifications.add(normalize(item.achievement?.title));
      }
    }
  }

  if (profile.use_learning_record) {
    const { data: record } = await sb.from("clr_records").select("id,title,status,default_visibility,updated_at").eq("user_id", userId).eq("status", "active").maybeSingle();
    if (record) {
      let query = sb.from("clr_achievements").select("id,title,description,achievement_type,section,status,visibility,issued_at,payload").eq("clr_record_id", record.id).eq("status", "active");
      if (recruiterView) query = query.in("visibility", ["recruiters", "public"]);
      const { data: achievements } = await query.order("issued_at", { ascending: false }).limit(200);
      learningRecord = { ...record, achievements: achievements || [] };
      for (const achievement of achievements || []) {
        addTerms(skills, achievement.payload?.skill_codes || achievement.payload?.skills);
        if (achievement.section === "certifications" || normalize(achievement.achievement_type).includes("certif")) certifications.add(normalize(achievement.title));
      }
    }
  }

  return { career, portfolio, project_evidence: evidence, skills_passport: passport, learning_record: learningRecord, skills: [...skills], sectors: [...sectors], certifications: [...certifications] };
}
function candidateSummary(user: any, profile: any, sources: any) {
  return {
    user_id: user.id,
    full_name: user.full_name || sources.career?.full_name || "Talent Omnia",
    avatar_url: sources.career?.photo_url || user.avatar_url || null,
    professional_title: sources.career?.professional_title || sources.skills_passport?.professional_headline || sources.portfolio?.headline || profile.target_roles?.[0] || "Profil professionnel",
    location: sources.career?.location || sources.skills_passport?.location_text || null,
    target_roles: profile.target_roles || [], target_sectors: profile.target_sectors || [], target_countries: profile.target_countries || [], contract_preferences: profile.contract_preferences || [],
    verified_skills: sources.skills, certifications: sources.certifications,
    verified_project_evidence_count: sources.project_evidence.length,
    source_permissions: { career: Boolean(profile.use_career_documents), projects: Boolean(profile.use_project_evidence), skills_passport: Boolean(profile.use_skills_passport), learning_record: Boolean(profile.use_learning_record) },
    allow_recruiter_contact: Boolean(profile.allow_recruiter_contact), talent_visibility: profile.talent_visibility,
  };
}
async function audit(sb: any, actor: string | null, subject: string | null, action: string, details: any = {}) {
  const { error } = await sb.from("employability_audit_log").insert({ actor_user_id: actor, subject_user_id: subject, action, details });
  if (error) console.error("employability audit", error);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const body = await req.json().catch(() => ({}));
    const action = text(body.action, 80);
    const session = await authenticate(sb, req, text(body.session_token, 400));
    requireSession(session);

    if (action === "learner_dashboard") {
      if (!session.isLearner) return json({ error: "ROLE_APPRENANT_REQUIRED" }, 403);
      const profile = await ensureProfile(sb, session.userId);
      const [sources, matchesR, applicationsR, contactsR] = await Promise.all([
        collectSources(sb, session.userId, profile, false),
        sb.from("employability_opportunity_matches").select("*,job:job_offers(id,title,description,location,contract_type,category,deadline,status)").eq("user_id", session.userId).order("match_score", { ascending: false }).limit(100),
        sb.from("job_applications").select("id,job_id,status,submitted_at,cover_letter,cv_url,job:job_offers(id,title,location,contract_type,category,deadline,status)").eq("applicant_id", session.userId).order("submitted_at", { ascending: false }).limit(100),
        sb.from("employability_contact_requests").select("*,recruiter:users!employability_contact_requests_recruiter_user_id_fkey(id,full_name,email)").eq("talent_user_id", session.userId).order("requested_at", { ascending: false }).limit(100),
      ]);
      return json({ success: true, profile, sources, matches: matchesR.data || [], applications: applicationsR.data || [], contact_requests: contactsR.data || [] });
    }

    if (action === "save_preferences") {
      if (!session.isLearner) return json({ error: "ROLE_APPRENANT_REQUIRED" }, 403);
      const current = await ensureProfile(sb, session.userId);
      const requestedStatus = ["draft", "active", "paused", "archived"].includes(text(body.status, 30)) ? text(body.status, 30) : current.status;
      const active = requestedStatus === "active";
      const patch: any = {
        status: requestedStatus,
        talent_visibility: active && ["private", "recruiters", "public"].includes(text(body.talent_visibility, 30)) ? text(body.talent_visibility, 30) : "private",
        use_project_evidence: Boolean(body.use_project_evidence),
        use_skills_passport: Boolean(body.use_skills_passport),
        use_learning_record: Boolean(body.use_learning_record),
        use_career_documents: Boolean(body.use_career_documents),
        allow_opportunity_matching: active && Boolean(body.allow_opportunity_matching),
        allow_recruiter_contact: active && Boolean(body.allow_recruiter_contact),
        target_roles: textArray(body.target_roles, 30, 160), target_sectors: textArray(body.target_sectors, 30, 160), target_countries: textArray(body.target_countries, 30, 80), contract_preferences: textArray(body.contract_preferences, 20, 100),
        excluded_organizations: Array.isArray(body.excluded_organizations) ? body.excluded_organizations.slice(0, 200) : current.excluded_organizations || [],
        consented_at: active ? (current.consented_at || new Date().toISOString()) : current.consented_at,
        paused_at: requestedStatus === "paused" ? new Date().toISOString() : null,
        consent_withdrawn_at: active ? null : new Date().toISOString(),
      };
      if (!active) { patch.talent_visibility = "private"; patch.allow_opportunity_matching = false; patch.allow_recruiter_contact = false; }
      const { data, error } = await sb.from("employability_profiles").update(patch).eq("user_id", session.userId).select("*").single();
      if (error) throw error;
      await audit(sb, session.userId, session.userId, "preferences_updated", { status: data.status, visibility: data.talent_visibility, sources: { projects: data.use_project_evidence, passport: data.use_skills_passport, clr: data.use_learning_record, career: data.use_career_documents } });
      return json({ success: true, profile: data });
    }

    if (action === "refresh_matches") {
      if (!session.isLearner) return json({ error: "ROLE_APPRENANT_REQUIRED" }, 403);
      const profile = await ensureProfile(sb, session.userId);
      if (profile.status !== "active" || !profile.allow_opportunity_matching) return json({ error: "MATCHING_NOT_AUTHORIZED" }, 403);
      const sources = await collectSources(sb, session.userId, profile, false);
      const terms = new Set<string>();
      addTerms(terms, sources.skills); addTerms(terms, sources.sectors); addTerms(terms, profile.target_roles); addTerms(terms, profile.target_sectors); addTerms(terms, profile.target_countries); addTerms(terms, profile.contract_preferences);
      const { data: jobs, error: jobsError } = await sb.from("job_offers").select("id,title,description,location,contract_type,category,deadline,status").eq("status", "approved").order("created_at", { ascending: false }).limit(500);
      if (jobsError) throw jobsError;
      const rows: any[] = [];
      for (const job of jobs || []) {
        const haystack = normalize([job.title, job.description, job.location, job.contract_type, job.category].filter(Boolean).join(" "));
        const matched = [...terms].filter((term) => term.length >= 2 && haystack.includes(term));
        const targetRoleMatch = (profile.target_roles || []).some((role: string) => haystack.includes(normalize(role)));
        const sectorMatch = (profile.target_sectors || []).some((sector: string) => haystack.includes(normalize(sector)));
        const countryMatch = (profile.target_countries || []).some((country: string) => haystack.includes(normalize(country)));
        let score = Math.min(70, matched.length * 10) + (targetRoleMatch ? 15 : 0) + (sectorMatch ? 10 : 0) + (countryMatch ? 5 : 0);
        if (!terms.size) score = 0;
        if (score < 10) continue;
        const missing = [...terms].filter((term) => !matched.includes(term)).slice(0, 12);
        rows.push({ user_id: session.userId, job_id: job.id, match_score: Math.min(100, score), matched_skills: matched.slice(0, 30), missing_skills: missing, explanation: `Correspondance basée sur ${matched.length} élément(s) de compétences ou préférences vérifiées.`, status: "suggested", generated_at: new Date().toISOString() });
      }
      if (rows.length) { const { error } = await sb.from("employability_opportunity_matches").upsert(rows, { onConflict: "user_id,job_id" }); if (error) throw error; }
      await sb.from("employability_profiles").update({ last_matched_at: new Date().toISOString() }).eq("user_id", session.userId);
      return json({ success: true, generated: rows.length });
    }

    if (action === "set_match_status") {
      const status = text(body.status, 30);
      if (!["suggested", "viewed", "saved", "dismissed", "applied", "expired"].includes(status)) return json({ error: "INVALID_STATUS" }, 400);
      const patch: any = { status };
      if (status === "viewed") patch.viewed_at = new Date().toISOString();
      if (status === "dismissed") patch.dismissed_at = new Date().toISOString();
      const { data, error } = await sb.from("employability_opportunity_matches").update(patch).eq("id", body.match_id).eq("user_id", session.userId).select("*").single();
      if (error) throw error;
      return json({ success: true, match: data });
    }

    if (action === "verified_candidates") {
      if (!session.isRecruiter && !session.isAdmin) return json({ error: "FORBIDDEN" }, 403);
      const { data: profiles, error } = await sb.from("employability_profiles").select("*").eq("status", "active").in("talent_visibility", ["recruiters", "public"]).order("updated_at", { ascending: false }).limit(300);
      if (error) throw error;
      const q = normalize(body.q), skill = normalize(body.skill), sector = normalize(body.sector);
      const candidates: any[] = [];
      for (const profile of profiles || []) {
        if (session.organizationId && (profile.excluded_organizations || []).map(String).includes(session.organizationId)) continue;
        const [{ data: user }, sources] = await Promise.all([
          sb.from("users").select("id,full_name,avatar_url,status").eq("id", profile.user_id).maybeSingle(),
          collectSources(sb, profile.user_id, profile, true),
        ]);
        if (!user || user.status === "suspended") continue;
        const candidate = candidateSummary(user, profile, sources);
        const haystack = normalize(JSON.stringify(candidate));
        if (q && !haystack.includes(q)) continue;
        if (skill && !candidate.verified_skills.some((value: string) => value.includes(skill))) continue;
        if (sector && !candidate.target_sectors.some((value: string) => normalize(value).includes(sector)) && !sources.sectors.some((value: string) => value.includes(sector))) continue;
        candidates.push(candidate);
      }
      return json({ success: true, candidates });
    }

    if (action === "candidate_details") {
      if (!session.isRecruiter && !session.isAdmin) return json({ error: "FORBIDDEN" }, 403);
      const talentUserId = text(body.talent_user_id, 80);
      const profile = await getActiveConsent(sb, talentUserId);
      if (!profile) return json({ error: "PROFILE_NOT_AUTHORIZED" }, 403);
      if (session.organizationId && (profile.excluded_organizations || []).map(String).includes(session.organizationId)) return json({ error: "ORGANIZATION_EXCLUDED" }, 403);
      const [{ data: user }, sources, { data: contactRequests }] = await Promise.all([
        sb.from("users").select("id,full_name,avatar_url,status").eq("id", talentUserId).maybeSingle(),
        collectSources(sb, talentUserId, profile, true),
        sb.from("employability_contact_requests").select("id,status,requested_at,responded_at,subject,message,talent_response,job_id").eq("recruiter_user_id", session.userId).eq("talent_user_id", talentUserId).order("requested_at", { ascending: false }).limit(20),
      ]);
      if (!user) return json({ error: "USER_NOT_FOUND" }, 404);
      await sb.from("employability_recruiter_access_log").insert({ recruiter_user_id: session.userId, talent_user_id: talentUserId, organization_id: session.organizationId, action: "profile_view", purpose: text(body.purpose, 500) || "Consultation d’un profil autorisé" });
      return json({ success: true, candidate: { ...candidateSummary(user, profile, sources), career: profile.use_career_documents ? sources.career : null, portfolio: profile.use_project_evidence ? sources.portfolio : null, project_evidence: profile.use_project_evidence ? sources.project_evidence : [], skills_passport: profile.use_skills_passport ? sources.skills_passport : null, learning_record: profile.use_learning_record ? sources.learning_record : null, contact_requests: contactRequests || [] } });
    }

    if (action === "request_contact") {
      if (!session.isRecruiter && !session.isAdmin) return json({ error: "FORBIDDEN" }, 403);
      const talentUserId = text(body.talent_user_id, 80);
      const profile = await getActiveConsent(sb, talentUserId);
      if (!profile?.allow_recruiter_contact) return json({ error: "CONTACT_NOT_AUTHORIZED" }, 403);
      const message = text(body.message, 5000);
      if (!message) return json({ error: "MESSAGE_REQUIRED" }, 400);
      const jobId = text(body.job_id, 80) || null;
      let pendingQuery = sb.from("employability_contact_requests").select("id,status,requested_at").eq("recruiter_user_id", session.userId).eq("talent_user_id", talentUserId).eq("status", "pending");
      pendingQuery = jobId ? pendingQuery.eq("job_id", jobId) : pendingQuery.is("job_id", null);
      const { data: pending } = await pendingQuery.limit(1).maybeSingle();
      if (pending) return json({ error: "CONTACT_REQUEST_ALREADY_PENDING", request: pending }, 409);
      const { data, error } = await sb.from("employability_contact_requests").insert({ recruiter_user_id: session.userId, talent_user_id: talentUserId, job_id: jobId, subject: text(body.subject, 240) || null, message, status: "pending" }).select("*").single();
      if (error?.code === "23505") return json({ error: "CONTACT_REQUEST_ALREADY_PENDING" }, 409);
      if (error) throw error;
      await sb.from("employability_recruiter_access_log").insert({ recruiter_user_id: session.userId, talent_user_id: talentUserId, organization_id: session.organizationId, action: "contact_request", purpose: text(body.subject, 240) || "Demande de contact", job_id: jobId });
      await audit(sb, session.userId, talentUserId, "contact_requested", { request_id: data.id, job_id: jobId });
      return json({ success: true, request: data }, 201);
    }

    if (action === "respond_contact") {
      const status = text(body.status, 30);
      if (!["accepted", "declined", "closed"].includes(status)) return json({ error: "INVALID_STATUS" }, 400);
      const { data, error } = await sb.from("employability_contact_requests").update({ status, talent_response: text(body.response, 3000) || null, responded_at: new Date().toISOString() }).eq("id", body.id).eq("talent_user_id", session.userId).eq("status", "pending").select("*").single();
      if (error) throw error;
      await audit(sb, session.userId, session.userId, `contact_${status}`, { request_id: data.id });
      return json({ success: true, request: data });
    }

    if (action === "log_candidate_access") {
      if (!session.isRecruiter && !session.isAdmin) return json({ error: "FORBIDDEN" }, 403);
      const accessAction = ["search_result", "profile_view", "portfolio_view", "passport_view", "contact_request"].includes(text(body.access_action, 40)) ? text(body.access_action, 40) : "profile_view";
      const talentUserId = text(body.talent_user_id, 80);
      if (!(await getActiveConsent(sb, talentUserId))) return json({ error: "PROFILE_NOT_AUTHORIZED" }, 403);
      const { error } = await sb.from("employability_recruiter_access_log").insert({ recruiter_user_id: session.userId, talent_user_id: talentUserId, organization_id: session.organizationId, action: accessAction, purpose: text(body.purpose, 500) || null, job_id: body.job_id || null });
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "admin_dashboard") {
      if (!session.isAdmin) return json({ error: "FORBIDDEN" }, 403);
      const { data: learnerRoles, error: learnerRolesError } = await sb.from("user_roles").select("user_id").eq("role", "apprenant");
      if (learnerRolesError) throw learnerRolesError;
      const learnerIds = [...new Set((learnerRoles || []).map((row: any) => String(row.user_id)).filter(Boolean))];
      if (!learnerIds.length) return json({ success: true, profiles: [], profile_count: 0, matches: [], access_log: [], contact_requests: [] });
      const [profilesR, matchesR, accessR, contactsR] = await Promise.all([
        sb.from("employability_profiles").select("*,user:users!employability_profiles_user_id_fkey(id,full_name,email,status)").in("user_id", learnerIds).order("updated_at", { ascending: false }).limit(500),
        sb.from("employability_opportunity_matches").select("*,user:users!employability_opportunity_matches_user_id_fkey(id,full_name,email),job:job_offers(id,title,status)").in("user_id", learnerIds).order("generated_at", { ascending: false }).limit(500),
        sb.from("employability_recruiter_access_log").select("*,recruiter:users!employability_recruiter_access_log_recruiter_user_id_fkey(id,full_name,email),talent:users!employability_recruiter_access_log_talent_user_id_fkey(id,full_name,email)").in("talent_user_id", learnerIds).order("created_at", { ascending: false }).limit(500),
        sb.from("employability_contact_requests").select("*,recruiter:users!employability_contact_requests_recruiter_user_id_fkey(id,full_name,email),talent:users!employability_contact_requests_talent_user_id_fkey(id,full_name,email)").in("talent_user_id", learnerIds).order("requested_at", { ascending: false }).limit(500),
      ]);
      return json({ success: true, profiles: profilesR.data || [], profile_count: (profilesR.data || []).length, matches: matchesR.data || [], access_log: accessR.data || [], contact_requests: contactsR.data || [] });
    }

    return json({ error: "UNKNOWN_ACTION" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "SERVER_ERROR";
    const status = message === "AUTH_REQUIRED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    console.error("employability-integration", error);
    return json({ error: message }, status);
  }
});
