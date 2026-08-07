import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { hasStructurePermission, validatedStructureAccess } from "../_shared/structure-access.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-omnia-session-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
type Sb = ReturnType<typeof createClient>;
type Session = { userId: string; roles: string[] };

type ExternalAccess = { session: any; member: any; panel: any; expert: any | null };

function clean(value: unknown, max = 4000) { return String(value ?? "").trim().slice(0, max); }
function lower(value: unknown) { return clean(value, 320).toLowerCase(); }
function bounded(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}
function safeName(name: string) {
  return name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 140) || "document";
}
function randomToken(bytes = 32) {
  const values = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(values).map((value) => value.toString(16).padStart(2, "0")).join("");
}
function randomPin() {
  const values = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(values).map((value) => String(value % 10)).join("");
}
async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");
}
function appUrl() { return (Deno.env.get("PUBLIC_APP_URL") || "https://omniaglobalacademy.com").replace(/\/+$/, ""); }

async function authenticate(sb: Sb, req: Request, bodyToken = ""): Promise<Session | null> {
  const token = (bodyToken || req.headers.get("x-omnia-session-token") || req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data } = await sb.from("user_sessions").select("user_id").eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
  let userId = data?.user_id ? String(data.user_id) : "";
  if (!userId) {
    const { data: authData } = await sb.auth.getUser(token);
    userId = authData?.user?.id || "";
  }
  if (!userId) return null;
  const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", userId);
  return { userId, roles: (roles || []).map((row: any) => String(row.role)) };
}
function isAdmin(session: Session | null) { return Boolean(session?.roles.includes("super_admin")); }
function requireSession(session: Session | null): asserts session is Session { if (!session) throw new Error("AUTH_REQUIRED"); }
function requireAdmin(session: Session | null): asserts session is Session { if (!isAdmin(session)) throw new Error("FORBIDDEN"); }

async function ownsCourse(sb: Sb, session: Session, courseId: string) {
  if (isAdmin(session)) return true;
  const { data } = await sb.from("courses").select("creator_id,creator_context,structure_id").eq("id", courseId).maybeSingle();
  if (!data || String(data.creator_id) !== session.userId) return false;
  if (String(data.creator_context || "") !== "structure") return true;
  if (!data.structure_id) return false;
  const access = await validatedStructureAccess(sb, session.userId, String(data.structure_id));
  return hasStructurePermission(access, "can_edit_courses");
}
async function ownsAssessment(sb: Sb, session: Session, assessmentId: string) {
  const { data } = await sb.from("course_assessments").select("id,course_id").eq("id", assessmentId).maybeSingle();
  if (!data) return null;
  return (await ownsCourse(sb, session, String(data.course_id))) ? data : null;
}
function sourceForRoles(roles: string[]) {
  if (roles.includes("super_admin")) return "super_admin";
  if (roles.includes("responsable_structure") || roles.includes("gestionnaire_structure") || roles.includes("structure_admin")) return "structure";
  return "professeur";
}
function permissions(value: any, role = "member") {
  const base: Record<string, boolean> = {
    view_case: true,
    view_evidence: true,
    score: role !== "observer",
    comment: role !== "observer",
    request_complement: role === "president" || role === "rapporteur",
    deliberate: role !== "observer",
    sign_decision: role === "president",
    view_candidate_identity: false,
  };
  if (!value || typeof value !== "object") return base;
  for (const key of Object.keys(base)) if (typeof value[key] === "boolean") base[key] = value[key];
  return base;
}
async function auditAppeal(sb: Sb, appealId: string, actor: string | null, action: string, before: string | null, after: string | null, comment = "", metadata: any = {}) {
  await sb.from("assessment_appeal_history").insert({ appeal_id: appealId, actor_user_id: actor, action, previous_status: before, new_status: after, comment: comment || null, metadata });
}
async function signedFiles(sb: Sb, attemptId: string) {
  const { data } = await sb.from("assessment_submission_files").select("*").eq("attempt_id", attemptId).order("uploaded_at");
  const output = [];
  for (const row of data || []) {
    const { data: signed } = await sb.storage.from(row.bucket_name).createSignedUrl(row.storage_path, 3600);
    output.push({ ...row, signed_url: signed?.signedUrl || null });
  }
  return output;
}
async function signedDocuments(sb: Sb, documents: any) {
  const output = [];
  for (const row of Array.isArray(documents) ? documents.slice(0, 10) : []) {
    if (row?.bucket_name === "assessment-governance" && row?.storage_path) {
      const { data } = await sb.storage.from("assessment-governance").createSignedUrl(String(row.storage_path), 3600);
      output.push({ ...row, signed_url: data?.signedUrl || null });
    }
  }
  return output;
}
async function enrichAppeal(sb: Sb, appeal: any, includeCopy = false) {
  const enriched: any = { ...appeal, evidence: await signedDocuments(sb, appeal.evidence) };
  if (!includeCopy || !appeal.attempt_id) return enriched;
  const [{ data: answers }, { data: corrections }] = await Promise.all([
    sb.from("assessment_answers").select("*,assessment_questions(id,prompt,question_type,points,rubric)").eq("attempt_id", appeal.attempt_id).order("created_at"),
    sb.from("assessment_corrections").select("*").eq("attempt_id", appeal.attempt_id).order("updated_at", { ascending: false }),
  ]);
  const correctionFiles = [];
  for (const correction of corrections || []) {
    if (correction.corrected_bucket_name && correction.corrected_storage_path) {
      const { data } = await sb.storage.from(correction.corrected_bucket_name).createSignedUrl(correction.corrected_storage_path, 3600);
      correctionFiles.push({ ...correction, signed_url: data?.signedUrl || null });
    }
  }
  enriched.answers = answers || [];
  enriched.files = await signedFiles(sb, appeal.attempt_id);
  enriched.previous_corrections = correctionFiles;
  return enriched;
}

async function frameworkCatalog(sb: Sb, includeDrafts = false) {
  let query = sb.from("competency_frameworks").select("*").order("updated_at", { ascending: false });
  if (!includeDrafts) query = query.eq("status", "published");
  const { data: frameworks, error } = await query;
  if (error) throw error;
  const ids = (frameworks || []).map((row: any) => row.id);
  if (!ids.length) return [];
  const [{ data: levels }, { data: competencies }] = await Promise.all([
    sb.from("competency_levels").select("*").in("framework_id", ids).order("sort_order"),
    sb.from("competency_definitions").select("*").in("framework_id", ids).neq("status", "inactive").order("domain").order("name"),
  ]);
  return (frameworks || []).map((framework: any) => ({
    ...framework,
    levels: (levels || []).filter((row: any) => row.framework_id === framework.id),
    competencies: (competencies || []).filter((row: any) => row.framework_id === framework.id),
  }));
}

async function syncAttemptCompetencies(sb: Sb, attemptId: string, actorUserId: string | null, verificationStatus: "verified" | "jury_validated" = "verified") {
  const { data: attempt, error } = await sb.from("assessment_attempts")
    .select("id,user_id,assessment_id,score,passed,result_published_at,course_assessments(id,passing_score)")
    .eq("id", attemptId).single();
  if (error) throw error;
  const assessment: any = attempt.course_assessments || {};
  const { data: mappings } = await sb.from("assessment_competency_mappings")
    .select("*,competency:competency_definitions(*),level:competency_levels(*)")
    .eq("assessment_id", attempt.assessment_id);
  for (const mapping of mappings || []) {
    const competency = mapping.competency || {};
    if (!competency.id) continue;
    const score = bounded(attempt.score, 0, 100, 0);
    const threshold = bounded(mapping.passing_score, 0, 100, Number(assessment.passing_score || 70));
    const validated = score >= threshold;
    const validUntil = competency.validity_months
      ? new Date(new Date(attempt.result_published_at || Date.now()).setMonth(new Date(attempt.result_published_at || Date.now()).getMonth() + Number(competency.validity_months))).toISOString()
      : null;
    const frameworkId = competency.framework_id;
    const { data: framework } = await sb.from("competency_frameworks").select("version").eq("id", frameworkId).maybeSingle();
    const resultRow = {
      attempt_id: attempt.id,
      assessment_id: attempt.assessment_id,
      user_id: attempt.user_id,
      competency_name: competency.name,
      competency_id: competency.id,
      competency_level_id: mapping.target_level_id || null,
      framework_version: framework?.version || null,
      score,
      status: validated ? "validated" : "not_validated",
      verification_status: validated ? verificationStatus : "evaluated",
      valid_until: validUntil,
      validated_by: validated ? actorUserId : null,
      validated_at: validated ? new Date().toISOString() : null,
    };
    await sb.from("assessment_result_competencies").upsert(resultRow, { onConflict: "attempt_id,competency_name" });
    await sb.from("learner_competency_records").upsert({
      user_id: attempt.user_id,
      competency_id: competency.id,
      competency_level_id: mapping.target_level_id || null,
      source_type: verificationStatus === "jury_validated" ? "jury" : "assessment",
      source_id: attempt.id,
      assessment_id: attempt.assessment_id,
      attempt_id: attempt.id,
      score,
      status: validated ? "validated" : "not_validated",
      framework_version: framework?.version || null,
      valid_from: attempt.result_published_at || new Date().toISOString(),
      valid_until: validUntil,
      evidence: [{ type: "assessment", attempt_id: attempt.id, assessment_id: attempt.assessment_id }],
      verified_by: validated ? actorUserId : null,
      verified_at: validated ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,competency_id,source_type,source_id" });
  }
}

async function getExternalAccess(sb: Sb, rawToken: string): Promise<ExternalAccess | null> {
  if (!rawToken) return null;
  const tokenHash = await sha256(rawToken);
  const { data: access } = await sb.from("assessment_jury_access_sessions").select("*")
    .eq("token_hash", tokenHash).is("revoked_at", null).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!access) return null;
  const { data: member } = await sb.from("assessment_jury_members").select("*").eq("id", access.member_id).maybeSingle();
  if (!member || !["invited", "accepted"].includes(member.status)) return null;
  const [{ data: panel }, { data: expert }] = await Promise.all([
    sb.from("assessment_jury_panels").select("*").eq("id", member.panel_id).maybeSingle(),
    member.expert_id ? sb.from("assessment_experts").select("*").eq("id", member.expert_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!panel) return null;
  await sb.from("assessment_jury_access_sessions").update({ last_used_at: new Date().toISOString() }).eq("id", access.id);
  return { session: access, member, panel, expert };
}

async function juryCasesForMember(sb: Sb, member: any, panel: any) {
  const { data: cases } = await sb.from("assessment_jury_cases").select("*").eq("panel_id", panel.id).neq("status", "cancelled").order("created_at");
  const output = [];
  for (const juryCase of cases || []) {
    const { data: attempt } = await sb.from("assessment_attempts")
      .select("id,user_id,assessment_id,attempt_number,score,status,result_status,submitted_at,feedback,course_assessments(id,title,passing_score,competency_labels),users!assessment_attempts_user_id_fkey(full_name,email)")
      .eq("id", juryCase.attempt_id).maybeSingle();
    if (!attempt) continue;
    const { data: answers } = await sb.from("assessment_answers").select("*,assessment_questions(id,prompt,question_type,points,rubric)").eq("attempt_id", attempt.id).order("created_at");
    const { data: review } = await sb.from("assessment_jury_reviews").select("*").eq("case_id", juryCase.id).eq("member_id", member.id).maybeSingle();
    const canIdentify = panel.blind_review === false && member.permissions?.view_candidate_identity === true;
    output.push({
      ...juryCase,
      assessment: attempt.course_assessments,
      attempt: { ...attempt, users: undefined },
      candidate: canIdentify ? attempt.users : { full_name: juryCase.candidate_alias, email: null },
      answers: answers || [],
      files: member.permissions?.view_evidence === false ? [] : await signedFiles(sb, attempt.id),
      review: review || null,
    });
  }
  return output;
}

async function upsertReview(sb: Sb, member: any, body: any) {
  if (member.conflict_status !== "none" || !member.confidentiality_accepted_at) throw new Error("TERMS_OR_CONFLICT_REQUIRED");
  if (member.permissions?.score === false && member.permissions?.comment === false) throw new Error("REVIEW_PERMISSION_REQUIRED");
  const caseId = clean(body.case_id, 100);
  const { data: juryCase } = await sb.from("assessment_jury_cases").select("*").eq("id", caseId).eq("panel_id", member.panel_id).maybeSingle();
  if (!juryCase) throw new Error("CASE_NOT_FOUND");
  const publish = body.publish === true;
  const score = member.permissions?.score === false ? null : bounded(body.score, 0, 100, 0);
  const recommendation = ["pass", "fail", "retry", "complement"].includes(clean(body.recommendation, 40)) ? clean(body.recommendation, 40) : null;
  const { data, error } = await sb.from("assessment_jury_reviews").upsert({
    case_id: juryCase.id,
    member_id: member.id,
    status: publish ? "submitted" : "draft",
    score,
    max_score: 100,
    recommendation,
    criteria_scores: body.criteria_scores && typeof body.criteria_scores === "object" ? body.criteria_scores : {},
    comment: member.permissions?.comment === false ? null : clean(body.comment, 8000) || null,
    complement_request: member.permissions?.request_complement === true ? clean(body.complement_request, 8000) || null : null,
    signed_at: publish ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "case_id,member_id" }).select("*").single();
  if (error) throw error;
  const { count } = await sb.from("assessment_jury_reviews").select("id", { count: "exact", head: true }).eq("case_id", juryCase.id).eq("status", "submitted");
  const { data: panel } = await sb.from("assessment_jury_panels").select("quorum").eq("id", member.panel_id).single();
  await sb.from("assessment_jury_cases").update({ status: Number(count || 0) >= Number(panel.quorum || 1) ? "ready" : "in_review" }).eq("id", juryCase.id).neq("status", "decided");
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json();
    const action = clean(body.action, 120);

    // Accès externe : aucun rôle global n'est créé.
    if (action === "external_login") {
      const inviteToken = clean(body.invite_token, 300);
      const pin = clean(body.pin, 20);
      const email = lower(body.email);
      if (!inviteToken || !pin || !email) return json({ success: false, error: "INVITE_EMAIL_PIN_REQUIRED" }, 400);
      const tokenHash = await sha256(inviteToken);
      const pinHash = await sha256(pin);
      const { data: member } = await sb.from("assessment_jury_members").select("*")
        .eq("invitation_token_hash", tokenHash).eq("access_pin_hash", pinHash).gt("invite_expires_at", new Date().toISOString()).maybeSingle();
      if (!member || !["invited", "accepted"].includes(member.status)) return json({ success: false, error: "INVITE_INVALID_OR_EXPIRED" }, 403);
      const { data: expert } = member.expert_id ? await sb.from("assessment_experts").select("email,full_name,status").eq("id", member.expert_id).maybeSingle() : { data: null };
      const expectedEmail = lower(member.external_email || expert?.email || "");
      if (!expectedEmail || expectedEmail !== email || expert?.status === "suspended") return json({ success: false, error: "INVITE_EMAIL_MISMATCH" }, 403);
      const rawSession = randomToken(32);
      await sb.from("assessment_jury_access_sessions").insert({ member_id: member.id, token_hash: await sha256(rawSession), expires_at: new Date(Date.now() + 12 * 3600_000).toISOString() });
      return json({ success: true, external_session_token: rawSession, expires_in_hours: 12 });
    }

    if (["external_overview", "external_accept_terms", "external_save_review"].includes(action)) {
      const access = await getExternalAccess(sb, clean(body.external_session_token, 300));
      if (!access) return json({ success: false, error: "EXTERNAL_SESSION_INVALID" }, 401);
      if (action === "external_accept_terms") {
        const conflict = body.conflict_declared === true;
        const details = clean(body.conflict_details, 4000);
        if (conflict && !details) return json({ success: false, error: "CONFLICT_DETAILS_REQUIRED" }, 400);
        const { data, error } = await sb.from("assessment_jury_members").update({
          confidentiality_accepted_at: body.confidentiality_accepted === true ? new Date().toISOString() : null,
          conflict_status: conflict ? "declared" : "none",
          conflict_details: conflict ? details : null,
          status: body.confidentiality_accepted === true && !conflict ? "accepted" : access.member.status,
          updated_at: new Date().toISOString(),
        }).eq("id", access.member.id).select("*").single();
        if (error) throw error;
        return json({ success: true, member: data, blocked_by_conflict: conflict });
      }
      if (action === "external_save_review") {
        const review = await upsertReview(sb, access.member, body);
        return json({ success: true, review });
      }
      return json({
        success: true,
        panel: { id: access.panel.id, name: access.panel.name, purpose: access.panel.purpose, blind_review: access.panel.blind_review, decision_mode: access.panel.decision_mode },
        member: { id: access.member.id, name: access.member.external_name || access.expert?.full_name, role: access.member.member_role, status: access.member.status, permissions: access.member.permissions, confidentiality_accepted_at: access.member.confidentiality_accepted_at, conflict_status: access.member.conflict_status, conflict_details: access.member.conflict_details },
        cases: access.member.confidentiality_accepted_at && access.member.conflict_status === "none" ? await juryCasesForMember(sb, access.member, access.panel) : [],
      });
    }

    const session = await authenticate(sb, req, clean(body.session_token, 300));
    requireSession(session);
    const admin = isAdmin(session);

    if (action === "framework_catalog") {
      return json({ success: true, frameworks: await frameworkCatalog(sb, admin) });
    }

    if (action === "prepare_governance_upload") {
      if (admin && body.preview === true) return json({ success: false, error: "PREVIEW_READ_ONLY" }, 403);
      const purpose = ["expert", "appeal", "jury"].includes(clean(body.purpose, 30)) ? clean(body.purpose, 30) : "jury";
      const size = bounded(body.size_bytes, 0, 20 * 1024 * 1024, 0);
      const mime = lower(body.mime_type);
      const allowed = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/png", "image/jpeg", "image/webp"];
      if (Number(body.size_bytes || 0) > 20 * 1024 * 1024) return json({ success: false, error: "FILE_TOO_LARGE" }, 400);
      if (!allowed.includes(mime)) return json({ success: false, error: "FILE_TYPE_NOT_ALLOWED" }, 400);
      const name = safeName(clean(body.file_name, 180));
      const path = `${session.userId}/${purpose}/${crypto.randomUUID()}-${name}`;
      const { data, error } = await sb.storage.from("assessment-governance").createSignedUploadUrl(path, { upsert: false });
      if (error) throw error;
      return json({ success: true, bucket: "assessment-governance", path, signedUrl: data.signedUrl, file_name: name, mime_type: mime, size_bytes: size });
    }

    if (action === "admin_overview") {
      requireAdmin(session);
      const [{ data: experts }, { data: panels }, { data: members }, { data: cases }, { data: appeals }, { data: thresholdSetting }] = await Promise.all([
        sb.from("assessment_experts").select("*").order("created_at", { ascending: false }).limit(300),
        sb.from("assessment_jury_panels").select("*,assessment:course_assessments(id,title,course_id),course:courses(id,title)").order("created_at", { ascending: false }).limit(300),
        sb.from("assessment_jury_members").select("*").order("created_at", { ascending: false }).limit(500),
        sb.from("assessment_jury_cases").select("*").order("created_at", { ascending: false }).limit(500),
        sb.from("assessment_grade_appeals").select("*,attempt:assessment_attempts(id,assessment_id,user_id,score,feedback,result_published_at,course_assessments(id,title,course_id),users!assessment_attempts_user_id_fkey(full_name,email))").order("submitted_at", { ascending: false }).limit(300),
        sb.from("site_settings").select("value").eq("key", "assessment_threshold_defaults").maybeSingle(),
      ]);
      const expertRows = [];
      for (const expert of experts || []) expertRows.push({ ...expert, documents: await signedDocuments(sb, expert.documents) });
      return json({
        success: true,
        experts: expertRows,
        panels: (panels || []).map((panel: any) => ({ ...panel, members: (members || []).filter((member: any) => member.panel_id === panel.id), cases: (cases || []).filter((juryCase: any) => juryCase.panel_id === panel.id) })),
        appeals: await Promise.all((appeals || []).map((appeal: any) => enrichAppeal(sb, appeal, false))),
        frameworks: await frameworkCatalog(sb, true),
        threshold_defaults: {
          lesson_passing_score: bounded((thresholdSetting?.value as any)?.lesson_passing_score, 1, 100, 80),
          module_passing_score: bounded((thresholdSetting?.value as any)?.module_passing_score, 1, 100, 80),
          final_passing_score: bounded((thresholdSetting?.value as any)?.final_passing_score, 1, 100, 70),
          competency_mastery_score: bounded((thresholdSetting?.value as any)?.competency_mastery_score, 1, 100, 80),
          default_retry_cooldown_hours: bounded((thresholdSetting?.value as any)?.default_retry_cooldown_hours, 0, 720, 24),
          default_remediation_after_attempts: bounded((thresholdSetting?.value as any)?.default_remediation_after_attempts, 1, 100, 3),
        },
        summary: {
          pending_experts: (experts || []).filter((row: any) => row.status === "pending").length,
          pending_panels: (panels || []).filter((row: any) => row.status === "pending_approval").length,
          active_cases: (cases || []).filter((row: any) => !["decided", "cancelled"].includes(row.status)).length,
          pending_appeals: (appeals || []).filter((row: any) => !["rejected", "decided", "withdrawn"].includes(row.status)).length,
          published_frameworks: (await frameworkCatalog(sb, false)).length,
        },
      });
    }

    if (action === "admin_save_threshold_defaults") {
      requireAdmin(session);
      const value = {
        lesson_passing_score: bounded(body.lesson_passing_score, 1, 100, 80),
        module_passing_score: bounded(body.module_passing_score, 1, 100, 80),
        final_passing_score: bounded(body.final_passing_score, 1, 100, 70),
        competency_mastery_score: bounded(body.competency_mastery_score, 1, 100, 80),
        default_retry_cooldown_hours: bounded(body.default_retry_cooldown_hours, 0, 720, 24),
        default_remediation_after_attempts: bounded(body.default_remediation_after_attempts, 1, 100, 3),
      };
      const { error } = await sb.from("site_settings").upsert({
        key: "assessment_threshold_defaults",
        value,
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" });
      if (error) throw error;
      return json({ success: true, threshold_defaults: value });
    }

    if (action === "creator_overview") {
      const { data: courses } = admin
        ? await sb.from("courses").select("id,title,creator_id").order("updated_at", { ascending: false }).limit(300)
        : await sb.from("courses").select("id,title,creator_id").eq("creator_id", session.userId).order("updated_at", { ascending: false });
      const courseIds = (courses || []).map((row: any) => row.id);
      const [{ data: assessments }, { data: panels }, { data: attempts }, { data: experts }, { data: assignedAppeals }] = await Promise.all([
        courseIds.length ? sb.from("course_assessments").select("id,course_id,title,assessment_type,jury_required,jury_min_members,jury_decision_mode,quality_review_status").in("course_id", courseIds).order("updated_at", { ascending: false }) : Promise.resolve({ data: [] }),
        courseIds.length ? sb.from("assessment_jury_panels").select("*").in("course_id", courseIds).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
        courseIds.length ? sb.from("assessment_attempts").select("id,assessment_id,course_id,user_id,attempt_number,status,score,result_status,submitted_at,users!assessment_attempts_user_id_fkey(full_name,email),course_assessments(title)").in("course_id", courseIds).in("status", ["submitted", "pending_review", "passed", "failed"]).order("submitted_at", { ascending: false }).limit(300) : Promise.resolve({ data: [] }),
        sb.from("assessment_experts").select("*").in("status", ["pending", "approved"]).order("full_name"),
        sb.from("assessment_grade_appeals").select("*,attempt:assessment_attempts(id,assessment_id,user_id,score,feedback,course_assessments(title),users!assessment_attempts_user_id_fkey(full_name,email))").eq("assigned_to", session.userId).in("status", ["accepted", "in_review"]).order("submitted_at", { ascending: false }),
      ]);
      const panelIds = (panels || []).map((row: any) => row.id);
      const [{ data: members }, { data: cases }] = await Promise.all([
        panelIds.length ? sb.from("assessment_jury_members").select("*").in("panel_id", panelIds) : Promise.resolve({ data: [] }),
        panelIds.length ? sb.from("assessment_jury_cases").select("*").in("panel_id", panelIds) : Promise.resolve({ data: [] }),
      ]);
      return json({
        success: true,
        courses: courses || [],
        assessments: assessments || [],
        experts: experts || [],
        panels: (panels || []).map((panel: any) => ({ ...panel, members: (members || []).filter((row: any) => row.panel_id === panel.id), cases: (cases || []).filter((row: any) => row.panel_id === panel.id) })),
        attempts: attempts || [],
        assigned_appeals: await Promise.all((assignedAppeals || []).map((appeal: any) => enrichAppeal(sb, appeal, true))),
      });
    }

    if (action === "creator_propose_expert") {
      const email = lower(body.email);
      const fullName = clean(body.full_name, 240);
      if (!email || !fullName) return json({ success: false, error: "EXPERT_NAME_EMAIL_REQUIRED" }, 400);
      const documents = Array.isArray(body.documents) ? body.documents.slice(0, 10) : [];
      for (const document of documents) {
        if (document?.bucket_name !== "assessment-governance" || !String(document?.storage_path || "").startsWith(`${session.userId}/expert/`)) return json({ success: false, error: "INVALID_EXPERT_DOCUMENT" }, 400);
      }
      const [{ data: existing }, { data: existingUser }] = await Promise.all([
        sb.from("assessment_experts").select("*").ilike("email", email).maybeSingle(),
        sb.from("users").select("id").ilike("email", email).maybeSingle(),
      ]);
      if (existing?.status === "approved") return json({ success: true, expert: existing, already_approved: true });
      if (existing?.status === "suspended") return json({ success: false, error: "EXPERT_SUSPENDED", message: "Cet expert est suspendu. Seul l’Administration Omnia peut réexaminer son dossier." }, 409);
      const payload = {
        user_id: existingUser?.id || existing?.user_id || null,
        email,
        full_name: fullName,
        organization_name: clean(body.organization_name, 240) || null,
        expertise_domains: Array.isArray(body.expertise_domains) ? body.expertise_domains.map((item: any) => clean(item, 160)).filter(Boolean).slice(0, 20) : [],
        biography: clean(body.biography, 5000) || null,
        documents,
        status: admin ? "approved" : "pending",
        proposed_by: session.userId,
        proposal_source: sourceForRoles(session.roles),
        validated_by: admin ? session.userId : null,
        validated_at: admin ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      };
      const result = existing
        ? await sb.from("assessment_experts").update(payload).eq("id", existing.id).select("*").single()
        : await sb.from("assessment_experts").insert(payload).select("*").single();
      if (result.error) throw result.error;
      return json({ success: true, expert: result.data });
    }

    if (action === "admin_expert_decide") {
      requireAdmin(session);
      const status = clean(body.status, 40);
      if (!["approved", "rejected", "suspended"].includes(status)) return json({ success: false, error: "INVALID_STATUS" }, 400);
      const note = clean(body.validation_note, 5000);
      if (["rejected", "suspended"].includes(status) && !note) return json({ success: false, error: "MOTIVE_REQUIRED" }, 400);
      const { data, error } = await sb.from("assessment_experts").update({ status, validation_note: note || null, validated_by: session.userId, validated_at: new Date().toISOString(), suspended_at: status === "suspended" ? new Date().toISOString() : null }).eq("id", body.expert_id).select("*").single();
      if (error) throw error;
      return json({ success: true, expert: data });
    }

    if (action === "creator_create_panel") {
      const assessmentId = clean(body.assessment_id, 100);
      const assessment = await ownsAssessment(sb, session, assessmentId);
      if (!assessment) return json({ success: false, error: "FORBIDDEN" }, 403);
      const required = Math.round(bounded(body.required_members, 1, 15, 2));
      const quorum = Math.round(bounded(body.quorum, 1, required, required));
      const mode = ["majority", "unanimous", "president_final"].includes(clean(body.decision_mode, 40)) ? clean(body.decision_mode, 40) : "majority";
      const { data, error } = await sb.from("assessment_jury_panels").insert({
        assessment_id: assessmentId,
        session_id: body.session_id || null,
        course_id: assessment.course_id,
        name: clean(body.name, 240) || "Jury d’évaluation",
        purpose: clean(body.purpose, 5000) || null,
        status: admin ? "approved" : "pending_approval",
        required_members: required,
        quorum,
        blind_review: body.blind_review !== false,
        decision_mode: mode,
        created_by: session.userId,
        approved_by: admin ? session.userId : null,
        approved_at: admin ? new Date().toISOString() : null,
      }).select("*").single();
      if (error) throw error;
      return json({ success: true, panel: data });
    }

    if (action === "creator_add_panel_member") {
      const { data: panel } = await sb.from("assessment_jury_panels").select("*").eq("id", body.panel_id).maybeSingle();
      if (!panel || !(await ownsCourse(sb, session, panel.course_id))) return json({ success: false, error: "FORBIDDEN" }, 403);
      if (["completed", "cancelled", "rejected"].includes(panel.status)) return json({ success: false, error: "PANEL_LOCKED" }, 409);
      const { data: expert } = await sb.from("assessment_experts").select("*").eq("id", body.expert_id).maybeSingle();
      if (!expert || expert.status !== "approved") return json({ success: false, error: "EXPERT_NOT_APPROVED" }, 409);
      const role = ["member", "president", "rapporteur", "observer"].includes(clean(body.member_role, 40)) ? clean(body.member_role, 40) : "member";
      const { data, error } = await sb.from("assessment_jury_members").upsert({
        panel_id: panel.id,
        expert_id: expert.id,
        user_id: expert.user_id || null,
        external_email: expert.email,
        external_name: expert.full_name,
        member_role: role,
        status: panel.status === "approved" ? "invited" : "pending_validation",
        permissions: permissions(body.permissions, role),
        created_by: session.userId,
        validated_by: admin ? session.userId : null,
        validated_at: admin ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "panel_id,expert_id" }).select("*").single();
      if (error) throw error;
      return json({ success: true, member: data });
    }

    if (action === "admin_panel_decide") {
      requireAdmin(session);
      const status = clean(body.status, 40);
      if (!["approved", "rejected", "cancelled"].includes(status)) return json({ success: false, error: "INVALID_STATUS" }, 400);
      const note = clean(body.approval_note, 5000);
      if (["rejected", "cancelled"].includes(status) && !note) return json({ success: false, error: "MOTIVE_REQUIRED" }, 400);
      const { data: currentPanel } = await sb.from("assessment_jury_panels").select("*").eq("id", body.panel_id).maybeSingle();
      if (!currentPanel) return json({ success: false, error: "PANEL_NOT_FOUND" }, 404);
      const { data: currentMembers } = await sb.from("assessment_jury_members").select("*").eq("panel_id", currentPanel.id).not("status", "in", "(removed,declined)");
      if (status === "approved" && (currentMembers || []).length < currentPanel.required_members) return json({ success: false, error: "INSUFFICIENT_MEMBERS", message: `Ajoutez au moins ${currentPanel.required_members} membres validés.` }, 409);
      const { data: panel, error } = await sb.from("assessment_jury_panels").update({ status, approval_note: note || null, approved_by: session.userId, approved_at: status === "approved" ? new Date().toISOString() : null }).eq("id", body.panel_id).select("*").single();
      if (error) throw error;
      const invitations = [];
      if (status === "approved") {
        for (const member of currentMembers || []) {
          const token = randomToken(24);
          const pin = randomPin();
          const expires = new Date(Date.now() + 14 * 24 * 3600_000).toISOString();
          await sb.from("assessment_jury_members").update({
            status: "invited",
            validated_by: session.userId,
            validated_at: new Date().toISOString(),
            invitation_token_hash: await sha256(token),
            access_pin_hash: await sha256(pin),
            invite_expires_at: expires,
          }).eq("id", member.id);
          invitations.push({ member_id: member.id, name: member.external_name, email: member.external_email, role: member.member_role, invite_url: `${appUrl()}/assessment/jury/${token}`, pin, expires_at: expires });
        }
      }
      return json({ success: true, panel, invitations });
    }

    if (action === "creator_assign_case") {
      const { data: panel } = await sb.from("assessment_jury_panels").select("*").eq("id", body.panel_id).maybeSingle();
      if (!panel || !(await ownsCourse(sb, session, panel.course_id))) return json({ success: false, error: "FORBIDDEN" }, 403);
      if (!["approved", "active", "deliberating"].includes(panel.status)) return json({ success: false, error: "PANEL_NOT_APPROVED" }, 409);
      const { data: attempt } = await sb.from("assessment_attempts").select("id,assessment_id,user_id").eq("id", body.attempt_id).maybeSingle();
      if (!attempt || attempt.assessment_id !== panel.assessment_id) return json({ success: false, error: "ATTEMPT_ASSESSMENT_MISMATCH" }, 400);
      const alias = `CAND-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const { data, error } = await sb.from("assessment_jury_cases").upsert({ panel_id: panel.id, attempt_id: attempt.id, candidate_alias: alias, status: "assigned", review_due_at: body.review_due_at || null }, { onConflict: "panel_id,attempt_id" }).select("*").single();
      if (error) throw error;
      await sb.from("assessment_jury_panels").update({ status: "active" }).eq("id", panel.id).eq("status", "approved");
      return json({ success: true, case: data });
    }

    if (action === "jury_overview") {
      const { data: members } = await sb.from("assessment_jury_members").select("*").eq("user_id", session.userId).in("status", ["invited", "accepted", "completed"]);
      const panels = [];
      for (const member of members || []) {
        const { data: panel } = await sb.from("assessment_jury_panels").select("*").eq("id", member.panel_id).maybeSingle();
        if (!panel) continue;
        panels.push({ panel, member, cases: member.confidentiality_accepted_at && member.conflict_status === "none" ? await juryCasesForMember(sb, member, panel) : [] });
      }
      return json({ success: true, panels });
    }

    if (action === "jury_accept_terms") {
      const { data: member } = await sb.from("assessment_jury_members").select("*").eq("id", body.member_id).eq("user_id", session.userId).maybeSingle();
      if (!member) return json({ success: false, error: "MEMBER_NOT_FOUND" }, 404);
      const conflict = body.conflict_declared === true;
      const details = clean(body.conflict_details, 4000);
      if (conflict && !details) return json({ success: false, error: "CONFLICT_DETAILS_REQUIRED" }, 400);
      const { data, error } = await sb.from("assessment_jury_members").update({ confidentiality_accepted_at: body.confidentiality_accepted === true ? new Date().toISOString() : null, conflict_status: conflict ? "declared" : "none", conflict_details: conflict ? details : null, status: body.confidentiality_accepted === true && !conflict ? "accepted" : member.status }).eq("id", member.id).select("*").single();
      if (error) throw error;
      return json({ success: true, member: data, blocked_by_conflict: conflict });
    }

    if (action === "jury_save_review") {
      const { data: member } = await sb.from("assessment_jury_members").select("*").eq("id", body.member_id).eq("user_id", session.userId).maybeSingle();
      if (!member) return json({ success: false, error: "MEMBER_NOT_FOUND" }, 404);
      const review = await upsertReview(sb, member, body);
      return json({ success: true, review });
    }

    if (action === "jury_finalize_case") {
      const { data: juryCase } = await sb.from("assessment_jury_cases").select("*").eq("id", body.case_id).maybeSingle();
      if (!juryCase) return json({ success: false, error: "CASE_NOT_FOUND" }, 404);
      const { data: panel } = await sb.from("assessment_jury_panels").select("*").eq("id", juryCase.panel_id).single();
      let allowed = admin;
      if (!allowed) {
        const { data: member } = await sb.from("assessment_jury_members").select("*").eq("panel_id", panel.id).eq("user_id", session.userId).eq("status", "accepted").maybeSingle();
        allowed = Boolean(member?.member_role === "president" && member.permissions?.sign_decision === true);
      }
      if (!allowed) return json({ success: false, error: "FORBIDDEN" }, 403);
      const { data: reviews } = await sb.from("assessment_jury_reviews").select("*").eq("case_id", juryCase.id).eq("status", "submitted");
      if ((reviews || []).length < Number(panel.quorum || 1)) return json({ success: false, error: "QUORUM_NOT_REACHED" }, 409);
      const scoredReviews = (reviews || []).filter((row: any) => row.score !== null);
      const average = scoredReviews.reduce((sum: number, row: any) => sum + Number(row.score || 0), 0) / Math.max(1, scoredReviews.length);
      const finalScore = bounded(body.final_score, 0, 100, Math.round(average * 100) / 100);
      const requestedDecision = ["passed", "failed", "retry", "complement_required", "confirmed", "modified"].includes(clean(body.final_decision, 40)) ? clean(body.final_decision, 40) : (finalScore >= 70 ? "passed" : "failed");
      const mappedVotes = (reviews || []).map((row: any) => row.recommendation === "pass" ? "passed" : row.recommendation === "fail" ? "failed" : row.recommendation === "retry" ? "retry" : row.recommendation === "complement" ? "complement_required" : null).filter(Boolean);
      const voteCounts = mappedVotes.reduce((acc: Record<string, number>, vote: string) => ({ ...acc, [vote]: (acc[vote] || 0) + 1 }), {});
      const majorityDecision = Object.entries(voteCounts).sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0] || requestedDecision;
      if (panel.decision_mode === "unanimous" && new Set(mappedVotes).size > 1) return json({ success: false, error: "UNANIMITY_NOT_REACHED", message: "Les avis du jury ne sont pas unanimes. Une nouvelle délibération est nécessaire." }, 409);
      if (panel.decision_mode === "unanimous" && mappedVotes.length && requestedDecision !== mappedVotes[0]) return json({ success: false, error: "DECISION_MUST_MATCH_UNANIMOUS_VOTE" }, 409);
      if (panel.decision_mode === "majority" && mappedVotes.length && requestedDecision !== majorityDecision) return json({ success: false, error: "DECISION_MUST_MATCH_MAJORITY_VOTE", message: `La décision doit suivre le vote majoritaire : ${majorityDecision}.` }, 409);
      const decision = requestedDecision;
      const { data: attempt } = await sb.from("assessment_attempts").select("*,course_assessments(passing_score)").eq("id", juryCase.attempt_id).single();
      const passing = Number((attempt.course_assessments as any)?.passing_score || 70);
      const passed = ["passed", "confirmed", "modified"].includes(decision) ? finalScore >= passing : false;
      await sb.from("assessment_grading_history").insert({ attempt_id: attempt.id, grader_id: session.userId, previous_score: attempt.score, new_score: finalScore, comment: `Décision du jury : ${clean(body.final_comment, 8000)}` });
      await sb.from("assessment_attempts").update({ score: finalScore, passed, status: passed ? "passed" : "failed", feedback: clean(body.final_comment, 8000), graded_at: new Date().toISOString(), graded_by: session.userId, result_status: "published", result_published_at: new Date().toISOString(), result_published_by: session.userId }).eq("id", attempt.id);
      await sb.from("assessment_jury_cases").update({ status: "decided", final_decision: decision, final_score: finalScore, final_mention: clean(body.final_mention, 240) || null, final_comment: clean(body.final_comment, 8000) || null, decided_by: session.userId, decided_at: new Date().toISOString() }).eq("id", juryCase.id);
      await syncAttemptCompetencies(sb, attempt.id, session.userId, "jury_validated");
      const { count: remaining } = await sb.from("assessment_jury_cases").select("id", { count: "exact", head: true }).eq("panel_id", panel.id).neq("status", "decided").neq("status", "cancelled");
      if (!remaining) await sb.from("assessment_jury_panels").update({ status: "completed", closed_at: new Date().toISOString() }).eq("id", panel.id);
      return json({ success: true, final_score: finalScore, decision, passed });
    }

    if (action === "learner_appeals_overview") {
      if (admin) return json({ success: true, preview: true, appeals: [] });
      const { data, error } = await sb.from("assessment_grade_appeals").select("*,attempt:assessment_attempts(id,assessment_id,score,feedback,result_published_at,course_assessments(id,title,appeal_enabled,appeal_deadline_days))").eq("user_id", session.userId).order("submitted_at", { ascending: false });
      if (error) throw error;
      return json({ success: true, appeals: data || [] });
    }

    if (action === "learner_submit_appeal") {
      if (admin) return json({ success: false, error: "PREVIEW_READ_ONLY" }, 403);
      const attemptId = clean(body.attempt_id, 100);
      const { data: attempt } = await sb.from("assessment_attempts").select("id,user_id,score,feedback,result_status,result_published_at,course_assessments(id,title,appeal_enabled,appeal_deadline_days)").eq("id", attemptId).maybeSingle();
      if (!attempt || attempt.user_id !== session.userId || attempt.result_status !== "published") return json({ success: false, error: "APPEAL_NOT_ALLOWED" }, 403);
      const assessment: any = attempt.course_assessments || {};
      if (assessment.appeal_enabled === false) return json({ success: false, error: "APPEAL_DISABLED" }, 409);
      const deadline = new Date(new Date(attempt.result_published_at || Date.now()).getTime() + Number(assessment.appeal_deadline_days || 7) * 86400_000);
      if (Date.now() > deadline.getTime()) return json({ success: false, error: "APPEAL_DEADLINE_EXPIRED" }, 409);
      const reason = clean(body.reason, 8000);
      if (!reason) return json({ success: false, error: "REASON_REQUIRED" }, 400);
      const evidence = Array.isArray(body.evidence) ? body.evidence.slice(0, 10) : [];
      for (const document of evidence) if (document?.bucket_name !== "assessment-governance" || !String(document?.storage_path || "").startsWith(`${session.userId}/appeal/`)) return json({ success: false, error: "INVALID_APPEAL_EVIDENCE" }, 400);
      const { data, error } = await sb.from("assessment_grade_appeals").insert({ attempt_id: attempt.id, user_id: session.userId, status: "submitted", reason, evidence, original_score: attempt.score, original_feedback: attempt.feedback, review_deadline: new Date(Date.now() + 14 * 86400_000).toISOString() }).select("*").single();
      if (error) {
        if (String(error.code) === "23505") return json({ success: false, error: "APPEAL_ALREADY_EXISTS" }, 409);
        throw error;
      }
      await auditAppeal(sb, data.id, session.userId, "submitted", null, "submitted", reason);
      return json({ success: true, appeal: data });
    }

    if (action === "learner_withdraw_appeal") {
      if (admin) return json({ success: false, error: "PREVIEW_READ_ONLY" }, 403);
      const { data: appeal } = await sb.from("assessment_grade_appeals").select("*").eq("id", body.appeal_id).eq("user_id", session.userId).maybeSingle();
      if (!appeal || !["submitted", "admissibility_review"].includes(appeal.status)) return json({ success: false, error: "APPEAL_CANNOT_BE_WITHDRAWN" }, 409);
      await sb.from("assessment_grade_appeals").update({ status: "withdrawn" }).eq("id", appeal.id);
      await auditAppeal(sb, appeal.id, session.userId, "withdrawn", appeal.status, "withdrawn");
      return json({ success: true });
    }

    if (action === "admin_appeal_admissibility") {
      requireAdmin(session);
      const { data: appeal } = await sb.from("assessment_grade_appeals").select("*").eq("id", body.appeal_id).maybeSingle();
      if (!appeal) return json({ success: false, error: "APPEAL_NOT_FOUND" }, 404);
      const accepted = body.accepted === true;
      const reason = clean(body.reason, 8000);
      if (!reason) return json({ success: false, error: "DECISION_REASON_REQUIRED" }, 400);
      const newStatus = accepted ? "in_review" : "rejected";
      let assignedTo = session.userId;
      if (accepted && body.assigned_to) {
        const requestedAssignee = clean(body.assigned_to, 100);
        if (requestedAssignee !== session.userId) {
          const { data: approvedExpert } = await sb.from("assessment_experts").select("id,user_id,status").eq("user_id", requestedAssignee).eq("status", "approved").maybeSingle();
          if (!approvedExpert) return json({ success: false, error: "APPEAL_REVIEWER_NOT_APPROVED" }, 400);
        }
        assignedTo = requestedAssignee;
      }
      const { data, error } = await sb.from("assessment_grade_appeals").update({ status: newStatus, admissibility_decided_by: session.userId, admissibility_decided_at: new Date().toISOString(), admissibility_reason: reason, assigned_to: accepted ? assignedTo : null, panel_id: null, decision: accepted ? null : "rejected", decision_reason: accepted ? null : reason, decided_by: accepted ? null : session.userId, decided_at: accepted ? null : new Date().toISOString() }).eq("id", appeal.id).select("*").single();
      if (error) throw error;
      await auditAppeal(sb, appeal.id, session.userId, accepted ? "accepted" : "rejected", appeal.status, newStatus, reason, { assigned_to: data.assigned_to, panel_id: data.panel_id });
      return json({ success: true, appeal: data });
    }

    if (action === "reviewer_resolve_appeal") {
      const { data: appeal } = await sb.from("assessment_grade_appeals").select("*").eq("id", body.appeal_id).maybeSingle();
      if (!appeal || (!admin && appeal.assigned_to !== session.userId)) return json({ success: false, error: "FORBIDDEN" }, 403);
      if (!["accepted", "in_review"].includes(appeal.status)) return json({ success: false, error: "APPEAL_NOT_IN_REVIEW" }, 409);
      const decision = ["confirmed", "modified", "new_attempt"].includes(clean(body.decision, 40)) ? clean(body.decision, 40) : "confirmed";
      const reason = clean(body.decision_reason, 8000);
      if (!reason) return json({ success: false, error: "DECISION_REASON_REQUIRED" }, 400);
      const { data: attempt } = await sb.from("assessment_attempts").select("*,course_assessments(passing_score)").eq("id", appeal.attempt_id).single();
      let finalScore = Number(attempt.score || 0);
      if (decision === "modified") finalScore = bounded(body.final_score, 0, 100, finalScore);
      if (decision === "new_attempt") {
        await sb.from("assessment_attempts").update({ retry_available_at: new Date().toISOString(), remediation_required: false, remediation_completed_at: new Date().toISOString() }).eq("id", attempt.id);
      } else if (decision === "modified") {
        const passing = Number((attempt.course_assessments as any)?.passing_score || 70);
        await sb.from("assessment_grading_history").insert({ attempt_id: attempt.id, grader_id: session.userId, previous_score: attempt.score, new_score: finalScore, comment: `Révision de note : ${reason}` });
        await sb.from("assessment_attempts").update({ score: finalScore, passed: finalScore >= passing, status: finalScore >= passing ? "passed" : "failed", feedback: clean(body.final_feedback, 8000) || attempt.feedback, graded_at: new Date().toISOString(), graded_by: session.userId, result_status: "published", result_published_at: new Date().toISOString(), result_published_by: session.userId }).eq("id", attempt.id);
        await syncAttemptCompetencies(sb, attempt.id, session.userId, "verified");
      }
      const { data, error } = await sb.from("assessment_grade_appeals").update({ status: "decided", decision, decision_reason: reason, final_score: decision === "new_attempt" ? null : finalScore, final_feedback: clean(body.final_feedback, 8000) || null, decided_by: session.userId, decided_at: new Date().toISOString() }).eq("id", appeal.id).select("*").single();
      if (error) throw error;
      await auditAppeal(sb, appeal.id, session.userId, "decided", appeal.status, "decided", reason, { decision, final_score: data.final_score });
      return json({ success: true, appeal: data });
    }

    if (action === "admin_save_framework") {
      requireAdmin(session);
      const id = clean(body.id, 100);
      const payload = {
        code: clean(body.code, 80).toUpperCase(),
        name: clean(body.name, 240),
        description: clean(body.description, 8000) || null,
        version: clean(body.version, 40) || "1.0",
        scope: ["omnia", "structure", "external"].includes(clean(body.scope, 30)) ? clean(body.scope, 30) : "omnia",
        organization_id: body.organization_id || null,
        status: ["draft", "pending_approval", "published", "archived"].includes(clean(body.status, 40)) ? clean(body.status, 40) : "draft",
        effective_from: body.effective_from || null,
        effective_until: body.effective_until || null,
        review_due_at: body.review_due_at || null,
        created_by: session.userId,
        updated_at: new Date().toISOString(),
      };
      if (!payload.code || !payload.name) return json({ success: false, error: "FRAMEWORK_CODE_NAME_REQUIRED" }, 400);
      const result = id ? await sb.from("competency_frameworks").update(payload).eq("id", id).select("*").single() : await sb.from("competency_frameworks").insert(payload).select("*").single();
      if (result.error) throw result.error;
      return json({ success: true, framework: result.data });
    }

    if (action === "admin_set_framework_status") {
      requireAdmin(session);
      const status = clean(body.status, 40);
      if (!["draft", "pending_approval", "published", "archived"].includes(status)) return json({ success: false, error: "INVALID_STATUS" }, 400);
      const { data, error } = await sb.from("competency_frameworks").update({ status, approved_by: status === "published" ? session.userId : null, approved_at: status === "published" ? new Date().toISOString() : null }).eq("id", body.framework_id).select("*").single();
      if (error) throw error;
      return json({ success: true, framework: data });
    }

    if (action === "admin_save_level") {
      requireAdmin(session);
      const payload = {
        framework_id: body.framework_id,
        level_number: Math.round(bounded(body.level_number, 1, 20, 1)),
        code: clean(body.code, 40).toUpperCase(),
        name: clean(body.name, 160),
        description: clean(body.description, 5000) || null,
        observable_expectations: Array.isArray(body.observable_expectations) ? body.observable_expectations.map((item: any) => clean(item, 500)).filter(Boolean).slice(0, 30) : [],
        sort_order: Math.round(bounded(body.sort_order, 0, 1000, Number(body.level_number || 1))),
      };
      if (!payload.framework_id || !payload.code || !payload.name) return json({ success: false, error: "LEVEL_FIELDS_REQUIRED" }, 400);
      const { data, error } = await sb.from("competency_levels").upsert(payload, { onConflict: "framework_id,level_number" }).select("*").single();
      if (error) throw error;
      return json({ success: true, level: data });
    }

    if (action === "admin_save_competency") {
      requireAdmin(session);
      const id = clean(body.id, 100);
      const payload = {
        framework_id: body.framework_id,
        parent_id: body.parent_id || null,
        code: clean(body.code, 80).toUpperCase(),
        name: clean(body.name, 240),
        description: clean(body.description, 8000) || null,
        domain: clean(body.domain, 200) || null,
        category: clean(body.category, 200) || null,
        evidence_requirements: Array.isArray(body.evidence_requirements) ? body.evidence_requirements.map((item: any) => clean(item, 500)).filter(Boolean).slice(0, 30) : [],
        validity_months: body.validity_months ? Math.round(bounded(body.validity_months, 1, 600, 12)) : null,
        renewal_mode: ["none", "full_training", "update_training", "renewal_exam", "new_evidence", "expert_validation"].includes(clean(body.renewal_mode, 40)) ? clean(body.renewal_mode, 40) : "none",
        status: ["active", "inactive", "deprecated"].includes(clean(body.status, 40)) ? clean(body.status, 40) : "active",
        created_by: session.userId,
        updated_at: new Date().toISOString(),
      };
      if (!payload.framework_id || !payload.code || !payload.name) return json({ success: false, error: "COMPETENCY_FIELDS_REQUIRED" }, 400);
      const result = id ? await sb.from("competency_definitions").update(payload).eq("id", id).select("*").single() : await sb.from("competency_definitions").insert(payload).select("*").single();
      if (result.error) throw result.error;
      return json({ success: true, competency: result.data });
    }

    return json({ success: false, error: "UNKNOWN_ACTION" }, 400);
  } catch (error) {
    console.error("assessment-governance", error);
    const message = error instanceof Error ? error.message : String(error);
    const status = ["AUTH_REQUIRED", "UNAUTHENTICATED"].includes(message) ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return json({ success: false, error: message }, status);
  }
});
