import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

import { getActiveOmniaSessionResult } from "../_shared/omnia-auth.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-omnia-session-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const text = (value: unknown, max = 5000) => String(value ?? "").trim().slice(0, max);
const asNumber = (value: unknown, fallback: number | null = null) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};
const textArray = (value: unknown, max = 100, itemMax = 160) => Array.isArray(value)
  ? [...new Set(value.map((item) => text(item, itemMax)).filter(Boolean))].slice(0, max)
  : [];
const safeSlug = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "parcours";
const addMonths = (iso: string | Date, months: number) => { const date = new Date(iso); date.setUTCMonth(date.getUTCMonth() + months); return date.toISOString(); };
const verificationCode = () => `OGA-PATH-${crypto.randomUUID().replaceAll("-", "").slice(0, 14).toUpperCase()}`;

type Session = { userId: string; roles: string[]; isAdmin: boolean };
function tokenFrom(req: Request, bodyToken = "") {
  return (bodyToken || req.headers.get("x-omnia-session-token") || req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
}
async function authenticate(sb: any, req: Request, bodyToken = ""): Promise<Session | null> {
  const token = tokenFrom(req, bodyToken);
  if (!token) return null;
  const { data: active } = await getActiveOmniaSessionResult(sb, token);
  if (!active?.user_id) return null;
  const { data: roleRows } = await sb.from("user_roles").select("role").eq("user_id", active.user_id);
  const roles = (roleRows || []).map((row: any) => text(row.role, 80).toLowerCase());
  return { userId: String(active.user_id), roles, isAdmin: roles.some((role: string) => ["super_admin", "admin"].includes(role)) };
}
function requireSession(session: Session | null): asserts session is Session { if (!session) throw new Error("AUTH_REQUIRED"); }
function requireAdmin(session: Session | null): asserts session is Session { requireSession(session); if (!session.isAdmin) throw new Error("FORBIDDEN"); }
async function audit(sb: any, pathwayId: string | null, actorId: string | null, action: string, entityType: string, entityId: string | null, details: any = {}) {
  const { error } = await sb.from("professional_pathway_audit_log").insert({ pathway_id: pathwayId, actor_id: actorId, action, entity_type: entityType, entity_id: entityId, details });
  if (error) console.error("professional pathway audit", error);
}
async function pathwayBundle(sb: any, pathwayId: string) {
  const [{ data: pathway }, { data: steps }, { data: prerequisites }] = await Promise.all([
    sb.from("professional_pathways").select("*").eq("id", pathwayId).maybeSingle(),
    sb.from("professional_pathway_steps").select("*").eq("pathway_id", pathwayId).order("position"),
    sb.from("professional_pathway_prerequisites").select("*").eq("pathway_id", pathwayId).order("created_at"),
  ]);
  return { pathway, steps: steps || [], prerequisites: prerequisites || [] };
}
async function prerequisiteState(sb: any, userId: string, prerequisite: any) {
  let met = false;
  let source: any = null;
  if (prerequisite.prerequisite_type === "course") {
    const { data } = await sb.from("user_enrollments").select("id,completed_at").eq("user_id", userId).eq("course_id", prerequisite.course_id).not("completed_at", "is", null).limit(1).maybeSingle();
    met = Boolean(data?.completed_at); source = data;
  } else if (prerequisite.prerequisite_type === "pathway") {
    const { data } = await sb.from("professional_pathway_enrollments").select("id,completed_at,status").eq("user_id", userId).eq("pathway_id", prerequisite.required_pathway_id).eq("status", "completed").maybeSingle();
    met = Boolean(data); source = data;
  } else if (prerequisite.prerequisite_type === "badge") {
    const { data } = await sb.from("badge_awards").select("id,status,expires_at").eq("recipient_user_id", userId).eq("template_id", prerequisite.badge_template_id).eq("status", "awarded").order("issued_at", { ascending: false }).limit(1).maybeSingle();
    met = Boolean(data && (!data.expires_at || new Date(data.expires_at) > new Date())); source = data;
  } else if (prerequisite.prerequisite_type === "skill") {
    const { data } = await sb.from("omnia_project_verified_evidence").select("id,title,skill_codes").eq("user_id", userId).eq("validation_status", "validated").contains("skill_codes", [prerequisite.skill_code]).limit(1).maybeSingle();
    met = Boolean(data); source = data;
    if (!met) {
      const { data: record } = await sb.from("clr_records").select("id").eq("user_id", userId).eq("status", "active").maybeSingle();
      if (record) {
        const { data: achievements } = await sb.from("clr_achievements").select("id,title,payload,status").eq("clr_record_id", record.id).eq("status", "active").limit(500);
        const code = text(prerequisite.skill_code, 160).toLowerCase();
        const achievement = (achievements || []).find((item: any) => {
          const values = [...textArray(item.payload?.skill_codes, 200, 160), ...textArray(item.payload?.skills, 200, 160)].map((value) => value.toLowerCase());
          return values.includes(code);
        });
        met = Boolean(achievement); source = achievement || source;
      }
    }
  } else {
    const { data } = await sb.from("professional_pathway_prerequisite_validations").select("*").eq("prerequisite_id", prerequisite.id).eq("user_id", userId).maybeSingle();
    met = data?.status === "approved"; source = data;
  }
  return { ...prerequisite, met, source };
}
async function prerequisitesForUser(sb: any, userId: string, prerequisites: any[]) {
  return Promise.all(prerequisites.map((prerequisite) => prerequisiteState(sb, userId, prerequisite)));
}
async function ensureStepResults(sb: any, enrollmentId: string, steps: any[]) {
  if (!steps.length) return;
  const rows = steps.map((step) => ({ enrollment_id: enrollmentId, step_id: step.id, status: "pending" }));
  const { error } = await sb.from("professional_pathway_step_results").upsert(rows, { onConflict: "enrollment_id,step_id", ignoreDuplicates: true });
  if (error) throw error;
}
async function automaticStepState(sb: any, userId: string, step: any) {
  if (step.step_type === "course" || step.step_type === "renewal_training") {
    if (!step.course_id) return null;
    const { data } = await sb.from("user_enrollments").select("id,completed_at").eq("user_id", userId).eq("course_id", step.course_id).not("completed_at", "is", null).limit(1).maybeSingle();
    return data ? { status: "passed", score: 100, evidence: { enrollment_id: data.id, completed_at: data.completed_at } } : null;
  }
  if (step.step_type === "assessment") {
    if (!step.assessment_id) return null;
    const { data } = await sb.from("assessment_attempts").select("id,score,passed,graded_at").eq("user_id", userId).eq("assessment_id", step.assessment_id).eq("passed", true).order("score", { ascending: false }).limit(1).maybeSingle();
    if (!data || (step.minimum_score != null && Number(data.score || 0) < Number(step.minimum_score))) return null;
    return { status: "passed", score: data.score, evidence: { attempt_id: data.id, graded_at: data.graded_at } };
  }
  if (step.step_type === "project") {
    if (!step.project_id) return null;
    const { data } = await sb.from("omnia_project_verified_evidence").select("id,title,validated_at,skill_codes").eq("user_id", userId).eq("project_id", step.project_id).eq("validation_status", "validated").limit(1).maybeSingle();
    return data ? { status: "passed", score: 100, evidence: { verified_evidence_id: data.id, title: data.title, validated_at: data.validated_at } } : null;
  }
  if (step.step_type === "evidence") {
    let query = sb.from("omnia_project_verified_evidence").select("id,title,validated_at,skill_codes").eq("user_id", userId).eq("validation_status", "validated");
    const skillCode = text(step.rules?.skill_code, 160);
    if (skillCode) query = query.contains("skill_codes", [skillCode]);
    const { data } = await query.order("validated_at", { ascending: false }).limit(1).maybeSingle();
    return data ? { status: "passed", score: 100, evidence: { verified_evidence_id: data.id, title: data.title, validated_at: data.validated_at } } : null;
  }
  return null;
}
async function issuePathwayOutputs(sb: any, enrollment: any, pathway: any, steps: any[], results: any[], actorId: string | null) {
  const issuedAt = new Date().toISOString();
  const validUntil = pathway.validity_months ? addMonths(issuedAt, Number(pathway.validity_months)) : null;
  const transcriptJson = {
    pathway: { id: pathway.id, title: pathway.title, certification_type: pathway.certification_type, cpd_enabled: pathway.cpd_enabled, cpd_credit_value: pathway.cpd_credit_value, cpd_credit_unit: pathway.cpd_credit_unit },
    enrollment: { id: enrollment.id, enrolled_at: enrollment.enrolled_at, completed_at: issuedAt },
    steps: steps.map((step) => ({ ...step, result: results.find((result) => result.step_id === step.id) || null })),
    generated_at: issuedAt,
  };
  const { data: transcript, error: transcriptError } = await sb.from("professional_pathway_transcripts").upsert({
    enrollment_id: enrollment.id, pathway_id: pathway.id, user_id: enrollment.user_id, status: "issued", transcript_json: transcriptJson, issued_at: issuedAt,
  }, { onConflict: "enrollment_id" }).select("*").single();
  if (transcriptError) throw transcriptError;

  const certificatePayload = { pathway_id: pathway.id, enrollment_id: enrollment.id, transcript_id: transcript.id, certification_type: pathway.certification_type, recognition_program_id: pathway.recognition_program_id, certificate_template_id: pathway.certificate_template_id, cpd: pathway.cpd_enabled ? { value: pathway.cpd_credit_value, unit: pathway.cpd_credit_unit } : null };
  const { data: certificate, error: certificateError } = await sb.from("professional_pathway_credentials").upsert({
    enrollment_id: enrollment.id, pathway_id: pathway.id, user_id: enrollment.user_id, credential_type: "certificate", title: `Certificat — ${pathway.title}`, status: "issued", issued_at: issuedAt, expires_at: validUntil, payload: certificatePayload,
  }, { onConflict: "enrollment_id,credential_type" }).select("*").single();
  if (certificateError) throw certificateError;
  const { data: record, error: recordError } = await sb.from("professional_pathway_credentials").upsert({
    enrollment_id: enrollment.id, pathway_id: pathway.id, user_id: enrollment.user_id, credential_type: "professional_record", title: `Relevé professionnel — ${pathway.title}`, status: "issued", issued_at: issuedAt, expires_at: validUntil, payload: { ...certificatePayload, transcript: transcriptJson },
  }, { onConflict: "enrollment_id,credential_type" }).select("*").single();
  if (recordError) throw recordError;

  let badgeAwardId: string | null = null;
  if (pathway.badge_template_id) {
    const { data: template } = await sb.from("badge_templates").select("id,issuer_id,name,status,default_visibility").eq("id", pathway.badge_template_id).eq("status", "active").maybeSingle();
    if (template) {
      const sourceId = `professional_pathway:${enrollment.id}`;
      const { data: existing } = await sb.from("badge_awards").select("id").eq("recipient_user_id", enrollment.user_id).eq("template_id", template.id).eq("source_id", sourceId).neq("status", "revoked").maybeSingle();
      if (existing) badgeAwardId = String(existing.id);
      else {
        const { data: award, error: awardError } = await sb.from("badge_awards").insert({
          verification_code: verificationCode(), template_id: template.id, issuer_id: template.issuer_id, recipient_user_id: enrollment.user_id,
          awarded_by: pathway.approved_by || pathway.created_by || actorId, source_type: "professional_pathway", source_id: sourceId,
          status: "awarded", visibility: template.default_visibility || "oga", evidence_summary: `Parcours ${pathway.title} terminé`,
          issued_at: issuedAt, expires_at: validUntil, standards_status: "internal_verified", credential_json: { pathway_id: pathway.id, enrollment_id: enrollment.id },
        }).select("id").single();
        if (awardError) throw awardError;
        badgeAwardId = String(award.id);
      }
    }
  }

  let { data: clrRecord } = await sb.from("clr_records").select("id").eq("user_id", enrollment.user_id).maybeSingle();
  if (!clrRecord) {
    const created = await sb.from("clr_records").insert({ user_id: enrollment.user_id, title: "Omnia Learning Record", status: "active", default_visibility: "oga" }).select("id").single();
    if (created.error) throw created.error;
    clrRecord = created.data;
  }
  const { error: clrError } = await sb.from("clr_achievements").upsert({
    clr_record_id: clrRecord.id, award_id: badgeAwardId, source_type: "professional_pathway", source_id: enrollment.id,
    title: pathway.title, description: `Parcours professionnel terminé et vérifié.`, achievement_type: "ProfessionalCertification", section: "certifications",
    status: "active", visibility: "oga", issued_at: issuedAt, payload: { certificate_id: certificate.id, professional_record_id: record.id, transcript_id: transcript.id, certification_type: pathway.certification_type, valid_until: validUntil },
  }, { onConflict: "clr_record_id,source_type,source_id" });
  if (clrError) throw clrError;

  const { error: enrollmentError } = await sb.from("professional_pathway_enrollments").update({
    status: "completed", progress_percent: 100, completed_at: issuedAt, valid_until: validUntil,
    certificate_id: certificate.id, credential_id: certificate.id, transcript_id: transcript.id, badge_credential_id: badgeAwardId,
    completion_checked_at: issuedAt,
  }).eq("id", enrollment.id);
  if (enrollmentError) throw enrollmentError;

  if (pathway.renewal_required && validUntil) {
    const { data: openRenewal } = await sb.from("professional_pathway_renewals").select("id").eq("enrollment_id", enrollment.id).in("status", ["due", "in_progress", "submitted"]).maybeSingle();
    if (!openRenewal) {
      const { error } = await sb.from("professional_pathway_renewals").insert({ enrollment_id: enrollment.id, due_at: validUntil, status: "due", requirements: pathway.metadata?.renewal_requirements || [] });
      if (error) throw error;
    }
  }
  return { certificate, record, transcript, badge_award_id: badgeAwardId, valid_until: validUntil };
}
async function syncEnrollment(sb: any, enrollmentId: string, userId: string, actorId: string | null = null) {
  const { data: enrollment } = await sb.from("professional_pathway_enrollments").select("*").eq("id", enrollmentId).eq("user_id", userId).maybeSingle();
  if (!enrollment) throw new Error("ENROLLMENT_NOT_FOUND");
  const { pathway, steps } = await pathwayBundle(sb, enrollment.pathway_id);
  if (!pathway) throw new Error("PATHWAY_NOT_FOUND");
  await ensureStepResults(sb, enrollment.id, steps);
  const { data: currentResults } = await sb.from("professional_pathway_step_results").select("*").eq("enrollment_id", enrollment.id);
  for (const step of steps) {
    const current = (currentResults || []).find((result: any) => result.step_id === step.id);
    if (["passed", "waived"].includes(current?.status)) continue;
    const automatic = await automaticStepState(sb, userId, step);
    if (automatic) await sb.from("professional_pathway_step_results").update({ ...automatic, validated_at: new Date().toISOString() }).eq("enrollment_id", enrollment.id).eq("step_id", step.id);
  }
  const { data: results } = await sb.from("professional_pathway_step_results").select("*").eq("enrollment_id", enrollment.id);
  const required = steps.filter((step) => step.required);
  const passedRequired = required.filter((step) => ["passed", "waived"].includes((results || []).find((result: any) => result.step_id === step.id)?.status));
  const progress = required.length ? Math.round((passedRequired.length / required.length) * 10000) / 100 : 0;
  await sb.from("professional_pathway_enrollments").update({ progress_percent: progress, completion_checked_at: new Date().toISOString() }).eq("id", enrollment.id);
  let outputs = null;
  if (required.length > 0 && passedRequired.length === required.length && enrollment.status !== "completed") outputs = await issuePathwayOutputs(sb, enrollment, pathway, steps, results || [], actorId);
  return { enrollment: { ...enrollment, progress_percent: progress, status: outputs ? "completed" : enrollment.status }, pathway, steps, results: results || [], outputs };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const body = await req.json().catch(() => ({}));
    const action = text(body.action, 80);

    if (action === "verify_credential") {
      const code = text(body.verification_code, 100);
      const uuid = text(body.credential_uuid, 100);
      let query = sb.from("professional_pathway_credentials").select("*,pathway:professional_pathways(id,title,certification_type,recognition_program_id)");
      query = code ? query.eq("verification_code", code) : query.eq("credential_uuid", uuid);
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "CREDENTIAL_NOT_FOUND" }, 404);
      return json({ success: true, credential: data, valid: data.status === "issued" && (!data.expires_at || new Date(data.expires_at) > new Date()) });
    }

    const session = await authenticate(sb, req, text(body.session_token, 400));
    requireSession(session);

    if (action === "admin_dashboard") {
      requireAdmin(session);
      const [pathwaysR, stepsR, prerequisitesR, enrollmentsR, resultsR, renewalsR, validationsR, coursesR, assessmentsR, projectsR, recognitionR, badgesR, templatesR] = await Promise.all([
        sb.from("professional_pathways").select("*").order("created_at", { ascending: false }),
        sb.from("professional_pathway_steps").select("*").order("position"),
        sb.from("professional_pathway_prerequisites").select("*").order("created_at"),
        sb.from("professional_pathway_enrollments").select("*,user:users!professional_pathway_enrollments_user_id_fkey(id,full_name,email)").order("created_at", { ascending: false }).limit(500),
        sb.from("professional_pathway_step_results").select("*,step:professional_pathway_steps(id,pathway_id,title,step_type)").in("status", ["submitted", "in_progress"]).order("updated_at", { ascending: false }).limit(300),
        sb.from("professional_pathway_renewals").select("*,enrollment:professional_pathway_enrollments(id,user_id,pathway_id,user:users!professional_pathway_enrollments_user_id_fkey(id,full_name,email))").in("status", ["due", "in_progress", "submitted"]).order("due_at").limit(300),
        sb.from("professional_pathway_prerequisite_validations").select("*,prerequisite:professional_pathway_prerequisites(id,pathway_id,title,prerequisite_type),user:users!professional_pathway_prerequisite_validations_user_id_fkey(id,full_name,email)").eq("status", "submitted").order("submitted_at").limit(300),
        sb.from("courses").select("id,title,status").order("title").limit(1000),
        sb.from("course_assessments").select("id,title,course_id,scope,is_active,passing_score").eq("is_active", true).order("title").limit(1000),
        sb.from("omnia_projects").select("id,title,status").in("status", ["published", "selection", "in_progress", "closed"]).order("title").limit(1000),
        sb.from("recognition_programs").select("id,title,status,recognition_type,partner:recognition_partners(id,name)").eq("status", "approved").order("title").limit(500),
        sb.from("badge_templates").select("id,name,status,issuer_id").eq("status", "active").order("name").limit(500),
        sb.from("certificate_templates").select("id,name,code,is_active,document_type").eq("is_active", true).order("name").limit(500),
      ]);
      const steps = stepsR.data || [], prerequisites = prerequisitesR.data || [];
      const pathways = (pathwaysR.data || []).map((pathway: any) => ({ ...pathway, steps: steps.filter((step: any) => step.pathway_id === pathway.id), prerequisites: prerequisites.filter((prerequisite: any) => prerequisite.pathway_id === pathway.id) }));
      return json({ success: true, pathways, enrollments: enrollmentsR.data || [], pending_step_results: resultsR.data || [], renewals: renewalsR.data || [], pending_prerequisites: validationsR.data || [], catalogs: { courses: coursesR.data || [], assessments: assessmentsR.data || [], projects: projectsR.data || [], recognition_programs: recognitionR.data || [], badge_templates: badgesR.data || [], certificate_templates: templatesR.data || [] } });
    }

    if (action === "save_pathway") {
      requireAdmin(session);
      const title = text(body.title, 220);
      if (!title) return json({ error: "TITLE_REQUIRED" }, 400);
      const certificationType = ["oga", "recognized", "co_certified", "professional", "cpd"].includes(text(body.certification_type, 40)) ? text(body.certification_type, 40) : "oga";
      const patch: any = {
        title,
        slug: safeSlug(text(body.slug, 140) || title),
        description: text(body.description, 10000) || null,
        visibility: ["public", "authenticated", "structure", "invitation"].includes(text(body.visibility, 40)) ? text(body.visibility, 40) : "authenticated",
        certification_type: certificationType,
        recognition_program_id: body.recognition_program_id || null,
        validity_months: asNumber(body.validity_months),
        renewal_required: Boolean(body.renewal_required),
        cpd_enabled: certificationType === "cpd" || Boolean(body.cpd_enabled),
        cpd_credit_value: asNumber(body.cpd_credit_value),
        cpd_credit_unit: text(body.cpd_credit_unit, 40) || "hours",
        badge_template_id: body.badge_template_id || null,
        certificate_template_id: body.certificate_template_id || null,
        metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
      };
      let result;
      if (body.id) result = await sb.from("professional_pathways").update(patch).eq("id", text(body.id, 80)).select("*").single();
      else result = await sb.from("professional_pathways").insert({ ...patch, status: "draft", created_by: session.userId }).select("*").single();
      if (result.error) throw result.error;
      await audit(sb, result.data.id, session.userId, body.id ? "pathway_updated" : "pathway_created", "pathway", result.data.id, patch);
      return json({ success: true, pathway: result.data });
    }

    if (action === "set_pathway_status") {
      requireAdmin(session);
      const pathwayId = text(body.pathway_id, 80);
      const status = text(body.status, 40);
      if (!["draft", "review", "published", "suspended", "archived"].includes(status)) return json({ error: "INVALID_STATUS" }, 400);
      if (status === "published") {
        const { count } = await sb.from("professional_pathway_steps").select("id", { count: "exact", head: true }).eq("pathway_id", pathwayId).eq("required", true);
        if (!count) return json({ error: "PATHWAY_REQUIRES_AT_LEAST_ONE_REQUIRED_STEP" }, 409);
      }
      const patch: any = { status };
      if (status === "published") Object.assign(patch, { approved_by: session.userId, approved_at: new Date().toISOString() });
      const { data, error } = await sb.from("professional_pathways").update(patch).eq("id", pathwayId).select("*").single();
      if (error) throw error;
      await audit(sb, pathwayId, session.userId, `pathway_${status}`, "pathway", pathwayId, patch);
      return json({ success: true, pathway: data });
    }

    if (action === "save_step") {
      requireAdmin(session);
      const pathwayId = text(body.pathway_id, 80);
      const type = text(body.step_type, 40);
      if (!["course", "assessment", "jury", "project", "evidence", "renewal_training"].includes(type)) return json({ error: "INVALID_STEP_TYPE" }, 400);
      const patch: any = {
        pathway_id: pathwayId, step_type: type, title: text(body.title, 220), position: Math.max(1, Number(body.position || 1)), required: body.required !== false,
        course_id: body.course_id || null, assessment_id: body.assessment_id || null, project_id: body.project_id || null,
        minimum_score: asNumber(body.minimum_score), rules: body.rules && typeof body.rules === "object" ? body.rules : {},
      };
      if (!patch.title) return json({ error: "TITLE_REQUIRED" }, 400);
      let result = body.id ? await sb.from("professional_pathway_steps").update(patch).eq("id", body.id).eq("pathway_id", pathwayId).select("*").single() : await sb.from("professional_pathway_steps").insert(patch).select("*").single();
      if (result.error) throw result.error;
      await audit(sb, pathwayId, session.userId, body.id ? "step_updated" : "step_created", "step", result.data.id, patch);
      return json({ success: true, step: result.data });
    }

    if (action === "delete_step") {
      requireAdmin(session);
      const { data: step } = await sb.from("professional_pathway_steps").select("*").eq("id", body.step_id).maybeSingle();
      if (!step) return json({ error: "STEP_NOT_FOUND" }, 404);
      const { error } = await sb.from("professional_pathway_steps").delete().eq("id", step.id);
      if (error) throw error;
      await audit(sb, step.pathway_id, session.userId, "step_deleted", "step", step.id, step);
      return json({ success: true });
    }

    if (action === "save_prerequisite") {
      requireAdmin(session);
      const type = text(body.prerequisite_type, 40);
      if (!["course", "pathway", "badge", "skill", "manual"].includes(type)) return json({ error: "INVALID_PREREQUISITE_TYPE" }, 400);
      const patch: any = { pathway_id: text(body.pathway_id, 80), prerequisite_type: type, course_id: body.course_id || null, required_pathway_id: body.required_pathway_id || null, badge_template_id: body.badge_template_id || null, skill_code: text(body.skill_code, 160) || null, title: text(body.title, 220), required: body.required !== false, rules: body.rules && typeof body.rules === "object" ? body.rules : {} };
      if (!patch.title) return json({ error: "TITLE_REQUIRED" }, 400);
      const result = body.id ? await sb.from("professional_pathway_prerequisites").update(patch).eq("id", body.id).eq("pathway_id", patch.pathway_id).select("*").single() : await sb.from("professional_pathway_prerequisites").insert(patch).select("*").single();
      if (result.error) throw result.error;
      await audit(sb, patch.pathway_id, session.userId, body.id ? "prerequisite_updated" : "prerequisite_created", "prerequisite", result.data.id, patch);
      return json({ success: true, prerequisite: result.data });
    }

    if (action === "delete_prerequisite") {
      requireAdmin(session);
      const { data: prerequisite } = await sb.from("professional_pathway_prerequisites").select("*").eq("id", body.prerequisite_id).maybeSingle();
      if (!prerequisite) return json({ error: "PREREQUISITE_NOT_FOUND" }, 404);
      const { error } = await sb.from("professional_pathway_prerequisites").delete().eq("id", prerequisite.id);
      if (error) throw error;
      await audit(sb, prerequisite.pathway_id, session.userId, "prerequisite_deleted", "prerequisite", prerequisite.id, prerequisite);
      return json({ success: true });
    }

    if (action === "learner_dashboard") {
      const { data: ownEnrollments } = await sb.from("professional_pathway_enrollments").select("id").eq("user_id", session.userId).in("status", ["active", "blocked"]);
      for (const enrollment of ownEnrollments || []) await syncEnrollment(sb, enrollment.id, session.userId, session.userId);
      const [{ data: pathways }, { data: enrollments }, { data: renewals }, { data: credentials }, { data: transcripts }] = await Promise.all([
        sb.from("professional_pathways").select("*").eq("status", "published").in("visibility", ["public", "authenticated"]).order("created_at", { ascending: false }),
        sb.from("professional_pathway_enrollments").select("*,pathway:professional_pathways(*),results:professional_pathway_step_results(*,step:professional_pathway_steps(*))").eq("user_id", session.userId).order("enrolled_at", { ascending: false }),
        sb.from("professional_pathway_renewals").select("*,enrollment:professional_pathway_enrollments!inner(id,user_id,pathway_id,pathway:professional_pathways(id,title))").eq("enrollment.user_id", session.userId).order("due_at"),
        sb.from("professional_pathway_credentials").select("*,pathway:professional_pathways(id,title,certification_type)").eq("user_id", session.userId).order("issued_at", { ascending: false }),
        sb.from("professional_pathway_transcripts").select("id,enrollment_id,pathway_id,status,version,issued_at,updated_at").eq("user_id", session.userId).order("updated_at", { ascending: false }),
      ]);
      const enrolledIds = new Set((enrollments || []).map((row: any) => row.pathway_id));
      const catalog = [];
      for (const pathway of pathways || []) {
        const bundle = await pathwayBundle(sb, pathway.id);
        const prerequisiteStates = await prerequisitesForUser(sb, session.userId, bundle.prerequisites);
        catalog.push({ ...pathway, steps: bundle.steps, prerequisites: prerequisiteStates, prerequisites_met: prerequisiteStates.filter((row: any) => row.required).every((row: any) => row.met), enrolled: enrolledIds.has(pathway.id) });
      }
      const { data: pendingValidations } = await sb.from("professional_pathway_prerequisite_validations").select("*,prerequisite:professional_pathway_prerequisites(*)").eq("user_id", session.userId).order("submitted_at", { ascending: false });
      return json({ success: true, catalog, enrollments: enrollments || [], renewals: renewals || [], credentials: credentials || [], transcripts: transcripts || [], prerequisite_submissions: pendingValidations || [] });
    }

    if (action === "enroll") {
      const pathwayId = text(body.pathway_id, 80);
      const bundle = await pathwayBundle(sb, pathwayId);
      if (!bundle.pathway || bundle.pathway.status !== "published" || !["public", "authenticated"].includes(bundle.pathway.visibility)) return json({ error: "PATHWAY_NOT_AVAILABLE" }, 404);
      const states = await prerequisitesForUser(sb, session.userId, bundle.prerequisites);
      const missing = states.filter((row: any) => row.required && !row.met);
      if (missing.length) return json({ error: "PREREQUISITES_NOT_MET", missing }, 409);
      const { data: enrollment, error } = await sb.from("professional_pathway_enrollments").upsert({ pathway_id: pathwayId, user_id: session.userId, status: "active", progress_percent: 0 }, { onConflict: "pathway_id,user_id" }).select("*").single();
      if (error) throw error;
      await ensureStepResults(sb, enrollment.id, bundle.steps);
      await audit(sb, pathwayId, session.userId, "learner_enrolled", "enrollment", enrollment.id);
      return json({ success: true, ...(await syncEnrollment(sb, enrollment.id, session.userId, session.userId)) }, 201);
    }

    if (action === "sync_enrollment") {
      const enrollmentId = text(body.enrollment_id, 80);
      return json({ success: true, ...(await syncEnrollment(sb, enrollmentId, session.userId, session.userId)) });
    }

    if (action === "submit_prerequisite") {
      const prerequisiteId = text(body.prerequisite_id, 80);
      const { data: prerequisite } = await sb.from("professional_pathway_prerequisites").select("*").eq("id", prerequisiteId).maybeSingle();
      if (!prerequisite || prerequisite.prerequisite_type !== "manual") return json({ error: "MANUAL_PREREQUISITE_NOT_FOUND" }, 404);
      const { data, error } = await sb.from("professional_pathway_prerequisite_validations").upsert({ prerequisite_id: prerequisiteId, user_id: session.userId, status: "submitted", evidence: body.evidence && typeof body.evidence === "object" ? body.evidence : { note: text(body.note, 5000) }, submitted_at: new Date().toISOString(), reviewed_by: null, reviewed_at: null, decision_notes: null }, { onConflict: "prerequisite_id,user_id" }).select("*").single();
      if (error) throw error;
      return json({ success: true, validation: data }, 201);
    }

    if (action === "review_prerequisite") {
      requireAdmin(session);
      const status = text(body.status, 30);
      if (!["approved", "rejected"].includes(status)) return json({ error: "INVALID_STATUS" }, 400);
      const { data, error } = await sb.from("professional_pathway_prerequisite_validations").update({ status, reviewed_by: session.userId, reviewed_at: new Date().toISOString(), decision_notes: text(body.decision_notes, 5000) || null }).eq("id", body.validation_id).select("*,prerequisite:professional_pathway_prerequisites(pathway_id)").single();
      if (error) throw error;
      await audit(sb, data.prerequisite?.pathway_id || null, session.userId, `prerequisite_${status}`, "prerequisite_validation", data.id);
      return json({ success: true, validation: data });
    }

    if (action === "submit_step") {
      const { data: result } = await sb.from("professional_pathway_step_results").select("*,enrollment:professional_pathway_enrollments!inner(user_id),step:professional_pathway_steps(*)").eq("id", body.result_id).eq("enrollment.user_id", session.userId).maybeSingle();
      if (!result || !["jury", "evidence"].includes(result.step?.step_type)) return json({ error: "STEP_NOT_SUBMITTABLE" }, 404);
      const { data, error } = await sb.from("professional_pathway_step_results").update({ status: "submitted", evidence: body.evidence && typeof body.evidence === "object" ? body.evidence : { note: text(body.note, 5000) }, comments: text(body.comments, 5000) || null }).eq("id", result.id).select("*").single();
      if (error) throw error;
      return json({ success: true, result: data });
    }

    if (action === "review_step") {
      requireAdmin(session);
      const decision = text(body.decision, 30);
      if (!["passed", "failed", "waived"].includes(decision)) return json({ error: "INVALID_DECISION" }, 400);
      const { data: current } = await sb.from("professional_pathway_step_results").select("*,enrollment:professional_pathway_enrollments(*),step:professional_pathway_steps(*)").eq("id", body.result_id).maybeSingle();
      if (!current) return json({ error: "RESULT_NOT_FOUND" }, 404);
      const score = asNumber(body.score);
      if (decision === "passed" && current.step?.minimum_score != null && score != null && score < Number(current.step.minimum_score)) return json({ error: "SCORE_BELOW_MINIMUM" }, 409);
      const { data, error } = await sb.from("professional_pathway_step_results").update({ status: decision, score, comments: text(body.comments, 5000) || null, validated_by: session.userId, validated_at: new Date().toISOString() }).eq("id", current.id).select("*").single();
      if (error) throw error;
      await syncEnrollment(sb, current.enrollment.id, current.enrollment.user_id, session.userId);
      return json({ success: true, result: data });
    }

    if (action === "submit_renewal") {
      const { data: renewal } = await sb.from("professional_pathway_renewals").select("*,enrollment:professional_pathway_enrollments!inner(user_id)").eq("id", body.renewal_id).eq("enrollment.user_id", session.userId).maybeSingle();
      if (!renewal || !["due", "in_progress", "rejected"].includes(renewal.status)) return json({ error: "RENEWAL_NOT_AVAILABLE" }, 404);
      const requirements = body.evidence && typeof body.evidence === "object" ? body.evidence : renewal.requirements;
      const { data, error } = await sb.from("professional_pathway_renewals").update({ status: "submitted", requirements, submitted_at: new Date().toISOString() }).eq("id", renewal.id).select("*").single();
      if (error) throw error;
      return json({ success: true, renewal: data });
    }

    if (action === "review_renewal") {
      requireAdmin(session);
      const decision = text(body.decision, 30);
      if (!["approved", "rejected", "expired"].includes(decision)) return json({ error: "INVALID_DECISION" }, 400);
      const { data: renewal } = await sb.from("professional_pathway_renewals").select("*,enrollment:professional_pathway_enrollments(*,pathway:professional_pathways(*))").eq("id", body.renewal_id).maybeSingle();
      if (!renewal) return json({ error: "RENEWAL_NOT_FOUND" }, 404);
      const months = Number(renewal.enrollment?.pathway?.validity_months || 12);
      const newValidUntil = decision === "approved" ? addMonths(new Date(), months) : null;
      const { data, error } = await sb.from("professional_pathway_renewals").update({ status: decision, reviewed_by: session.userId, reviewed_at: new Date().toISOString(), decision_notes: text(body.decision_notes, 5000) || null, new_valid_until: newValidUntil }).eq("id", renewal.id).select("*").single();
      if (error) throw error;
      if (decision === "approved") {
        await sb.from("professional_pathway_enrollments").update({ status: "completed", valid_until: newValidUntil }).eq("id", renewal.enrollment_id);
        await sb.from("professional_pathway_credentials").update({ status: "issued", expires_at: newValidUntil }).eq("enrollment_id", renewal.enrollment_id);
        if (renewal.enrollment?.pathway?.renewal_required) await sb.from("professional_pathway_renewals").insert({ enrollment_id: renewal.enrollment_id, due_at: newValidUntil, status: "due", requirements: renewal.enrollment.pathway.metadata?.renewal_requirements || [] });
      } else if (decision === "expired") {
        await sb.from("professional_pathway_enrollments").update({ status: "expired" }).eq("id", renewal.enrollment_id);
        await sb.from("professional_pathway_credentials").update({ status: "expired" }).eq("enrollment_id", renewal.enrollment_id);
      }
      return json({ success: true, renewal: data });
    }

    return json({ error: "UNKNOWN_ACTION" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "SERVER_ERROR";
    const status = message === "AUTH_REQUIRED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    console.error("professional-pathways", error);
    return json({ error: message }, status);
  }
});
