import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-omnia-session-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function sessionUser(sb: any, req: Request, bodyToken = "") {
  const token = (bodyToken || req.headers.get("x-omnia-session-token") || req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data } = await sb.from("user_sessions").select("user_id").eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (data?.user_id) return data.user_id;
  const { data: authData } = await sb.auth.getUser(token);
  return authData?.user?.id || null;
}

async function roleList(sb: any, userId: string) {
  const { data } = await sb.from("user_roles").select("role").eq("user_id", userId);
  return (data || []).map((row: any) => String(row.role));
}

async function courseOwner(sb: any, userId: string, courseId: string, roles: string[]) {
  if (roles.includes("super_admin")) return true;
  const { data } = await sb.from("courses").select("creator_id").eq("id", courseId).maybeSingle();
  return Boolean(data && data.creator_id === userId);
}

async function isEnrolled(sb: any, userId: string, courseId: string) {
  const { data } = await sb.from("user_enrollments").select("id").eq("user_id", userId).eq("course_id", courseId).maybeSingle();
  return Boolean(data);
}

function normalizeSessionStatus(row: any) {
  const now = Date.now();
  const start = new Date(row.starts_at).getTime();
  const end = new Date(row.ends_at).getTime();
  if (["cancelled", "suspended", "completed"].includes(row.status)) return row.status;
  if (row.status === "scheduled" && now >= start && now < end) return "open";
  if (["scheduled", "open", "in_progress"].includes(row.status) && now >= end) return "completed";
  return row.status;
}

function safeFileName(name: string) {
  return name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 120) || "preuve";
}

async function approvedAccommodation(sb: any, sessionId: string, userId: string) {
  const { data } = await sb.from("assessment_accommodations")
    .select("extra_time_minutes,break_minutes,adjustments,status")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .eq("status", "approved")
    .maybeSingle();
  return data || null;
}

function effectiveEnd(session: any, accommodation: any) {
  const extra = Math.max(0, Number(accommodation?.extra_time_minutes || 0)) * 60_000;
  return new Date(new Date(session.ends_at).getTime() + extra);
}

async function signedEvidence(sb: any, items: unknown) {
  const rows = Array.isArray(items) ? items.slice(0, 5) : [];
  const output = [];
  for (const item of rows) {
    const value: any = item || {};
    if (value.bucket_name === "assessment-evidence" && value.storage_path) {
      const { data } = await sb.storage.from("assessment-evidence").createSignedUrl(String(value.storage_path), 3600);
      output.push({ ...value, signed_url: data?.signedUrl || null });
    }
  }
  return output;
}

async function enrichSessions(sb: any, sessions: any[]) {
  if (!sessions.length) return [];
  const assessmentIds = [...new Set(sessions.map((x: any) => x.assessment_id).filter(Boolean))];
  const courseIds = [...new Set(sessions.map((x: any) => x.course_id).filter(Boolean))];
  const [{ data: assessments }, { data: courses }] = await Promise.all([
    assessmentIds.length ? sb.from("course_assessments").select("id,title,scope,assessment_type,passing_score,quality_review_status,competency_labels").in("id", assessmentIds) : { data: [] },
    courseIds.length ? sb.from("courses").select("id,title,cover_image_url,creator_id").in("id", courseIds) : { data: [] },
  ]);
  const aMap = new Map((assessments || []).map((x: any) => [x.id, x]));
  const cMap = new Map((courses || []).map((x: any) => [x.id, x]));
  return sessions.map((row: any) => ({ ...row, computed_status: normalizeSessionStatus(row), assessment: aMap.get(row.assessment_id) || null, course: cMap.get(row.course_id) || null }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json();
    const action = String(body.action || "");
    const userId = await sessionUser(sb, req, String(body.session_token || ""));
    if (!userId) return json({ success: false, error: "AUTH_REQUIRED" }, 401);
    const roles = await roleList(sb, userId);
    const isAdmin = roles.includes("super_admin");

    if (action === "admin_overview") {
      if (!isAdmin) return json({ success: false, error: "FORBIDDEN" }, 403);
      const [{ data: assessments }, { data: sessions }, { data: incidents }, { data: accommodations }] = await Promise.all([
        sb.from("course_assessments").select("id,course_id,title,scope,assessment_type,delivery_mode,security_level,session_required,quality_review_status,passing_score,required,updated_at").eq("assessment_center_enabled", true).order("updated_at", { ascending: false }).limit(200),
        sb.from("assessment_sessions").select("*").order("starts_at", { ascending: true }).limit(200),
        sb.from("assessment_incidents").select("*").order("created_at", { ascending: false }).limit(200),
        sb.from("assessment_accommodations").select("*").order("created_at", { ascending: false }).limit(100),
      ]);
      const enriched = await enrichSessions(sb, sessions || []);
      const courseIds = [...new Set((assessments || []).map((x: any) => x.course_id).filter(Boolean))];
      const { data: courses } = courseIds.length ? await sb.from("courses").select("id,title,creator_id").in("id", courseIds) : { data: [] };
      const cMap = new Map((courses || []).map((x: any) => [x.id, x]));
      const assessmentRows = (assessments || []).map((row: any) => ({ ...row, course: cMap.get(row.course_id) || null }));
      const sessionMap = new Map(enriched.map((row: any) => [row.id, row]));
      const userIds = [...new Set([...(incidents || []).map((x: any) => x.user_id), ...(accommodations || []).map((x: any) => x.user_id)].filter(Boolean))];
      const { data: users } = userIds.length ? await sb.from("users").select("id,full_name,email").in("id", userIds) : { data: [] };
      const userMap = new Map((users || []).map((row: any) => [row.id, row]));
      const incidentRows = [];
      for (const row of incidents || []) incidentRows.push({ ...row, user: userMap.get(row.user_id) || null, session: sessionMap.get(row.session_id) || null, evidence: await signedEvidence(sb, row.evidence) });
      const accommodationRows = (accommodations || []).map((row: any) => ({ ...row, user: userMap.get(row.user_id) || null, session: sessionMap.get(row.session_id) || null }));
      return json({
        success: true,
        assessments: assessmentRows,
        sessions: enriched,
        incidents: incidentRows,
        accommodations: accommodationRows,
        summary: {
          assessments: assessmentRows.length,
          official: assessmentRows.filter((x: any) => x.assessment_type !== "quiz").length,
          upcoming_sessions: enriched.filter((x: any) => ["scheduled", "open", "in_progress"].includes(x.computed_status)).length,
          open_incidents: (incidents || []).filter((x: any) => ["open", "in_review"].includes(x.status)).length,
          pending_accommodations: (accommodations || []).filter((x: any) => x.status === "pending").length,
        },
      });
    }

    if (action === "creator_overview") {
      const { data: owned } = isAdmin
        ? await sb.from("courses").select("id,title,creator_id").order("updated_at", { ascending: false }).limit(200)
        : await sb.from("courses").select("id,title,creator_id").eq("creator_id", userId).order("updated_at", { ascending: false });
      const courseIds = (owned || []).map((x: any) => x.id);
      if (!courseIds.length) return json({ success: true, courses: [], assessments: [], sessions: [], pending_attempts: [] });
      const [{ data: assessments }, { data: sessions }, { data: attempts }] = await Promise.all([
        sb.from("course_assessments").select("*").in("course_id", courseIds).eq("assessment_center_enabled", true).order("updated_at", { ascending: false }),
        sb.from("assessment_sessions").select("*").in("course_id", courseIds).order("starts_at", { ascending: true }),
        sb.from("assessment_attempts").select("id,assessment_id,course_id,user_id,attempt_number,status,score,submitted_at,remediation_required,result_status").in("course_id", courseIds).in("status", ["submitted", "pending_review", "passed", "failed"]).order("submitted_at", { ascending: false }).limit(200),
      ]);
      return json({ success: true, courses: owned || [], assessments: assessments || [], sessions: await enrichSessions(sb, sessions || []), pending_attempts: (attempts || []).filter((item: any) => ["submitted", "pending_review"].includes(item.status) || item.result_status === "pending_review") });
    }

    if (action === "creator_create_session") {
      const assessmentId = String(body.assessment_id || "");
      const { data: assessment, error } = await sb.from("course_assessments").select("*").eq("id", assessmentId).single();
      if (error) throw error;
      if (!(await courseOwner(sb, userId, assessment.course_id, roles))) return json({ success: false, error: "FORBIDDEN" }, 403);
      if (assessment.quality_review_status !== "approved") return json({ success: false, error: "ASSESSMENT_NOT_APPROVED", message: "L’évaluation doit être validée par le Centre Qualité avant la programmation d’une session." }, 409);
      const startsAt = new Date(body.starts_at);
      const endsAt = new Date(body.ends_at);
      if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) return json({ success: false, error: "INVALID_DATES" }, 400);
      const patch = {
        assessment_id: assessment.id,
        course_id: assessment.course_id,
        title: String(body.title || assessment.title).trim(),
        description: String(body.description || "").trim() || null,
        status: isAdmin ? "scheduled" : "pending_approval",
        delivery_mode: body.delivery_mode || assessment.delivery_mode || "scheduled_online",
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        registration_deadline: body.registration_deadline || null,
        timezone: String(body.timezone || "UTC"),
        capacity: body.capacity ? Number(body.capacity) : null,
        location: String(body.location || "").trim() || null,
        meeting_url: String(body.meeting_url || "").trim() || null,
        access_instructions: String(body.access_instructions || "").trim() || null,
        security_level: Number(body.security_level || assessment.security_level || 2),
        proctoring_settings: body.proctoring_settings || assessment.proctoring_settings || {},
        identity_verification_required: body.identity_verification_required ?? assessment.identity_verification_required ?? false,
        late_entry_minutes: Math.max(0, Math.min(180, Number(body.late_entry_minutes ?? 15))),
        created_by: userId,
        approved_by: isAdmin ? userId : null,
        approved_at: isAdmin ? new Date().toISOString() : null,
      };
      const { data: session, error: insertError } = await sb.from("assessment_sessions").insert(patch).select("*").single();
      if (insertError) throw insertError;
      if (body.include_enrolled) {
        const { data: enrollments } = await sb.from("user_enrollments").select("user_id").eq("course_id", assessment.course_id);
        if (enrollments?.length) await sb.from("assessment_session_candidates").upsert(enrollments.map((x: any) => ({ session_id: session.id, user_id: x.user_id, status: "registered", invited_by: userId })), { onConflict: "session_id,user_id", ignoreDuplicates: true });
      }
      return json({ success: true, session });
    }

    if (action === "creator_update_session") {
      const sessionId = String(body.session_id || "");
      const { data: session, error } = await sb.from("assessment_sessions").select("*").eq("id", sessionId).single();
      if (error) throw error;
      if (!(await courseOwner(sb, userId, session.course_id, roles))) return json({ success: false, error: "FORBIDDEN" }, 403);
      if (!isAdmin && !["draft", "pending_approval"].includes(session.status)) return json({ success: false, error: "SESSION_LOCKED" }, 409);
      const allowed = ["title", "description", "starts_at", "ends_at", "registration_deadline", "timezone", "capacity", "location", "meeting_url", "access_instructions", "security_level", "proctoring_settings", "identity_verification_required", "late_entry_minutes"];
      const patch: Record<string, unknown> = {};
      for (const key of allowed) if (body[key] !== undefined) patch[key] = body[key];
      if (!isAdmin) patch.status = "pending_approval";
      const { data: updated, error: updateError } = await sb.from("assessment_sessions").update(patch).eq("id", sessionId).select("*").single();
      if (updateError) throw updateError;
      return json({ success: true, session: updated });
    }

    if (action === "admin_session_decide") {
      if (!isAdmin) return json({ success: false, error: "FORBIDDEN" }, 403);
      const status = String(body.status || "");
      if (!["scheduled", "cancelled", "suspended", "completed"].includes(status)) return json({ success: false, error: "INVALID_STATUS" }, 400);
      if (["cancelled", "suspended"].includes(status) && !String(body.reason || "").trim()) return json({ success: false, error: "REASON_REQUIRED" }, 400);
      const patch: any = { status, cancellation_reason: ["cancelled", "suspended"].includes(status) ? String(body.reason).trim() : null };
      if (status === "scheduled") { patch.approved_by = userId; patch.approved_at = new Date().toISOString(); }
      const { data, error } = await sb.from("assessment_sessions").update(patch).eq("id", body.session_id).select("*").single();
      if (error) throw error;
      return json({ success: true, session: data });
    }

    if (action === "learner_dashboard") {
      if (isAdmin) return json({ success: true, preview: true, sessions: [], results: [], incidents: [] });
      const { data: enrollments } = await sb.from("user_enrollments").select("course_id").eq("user_id", userId);
      const courseIds = (enrollments || []).map((x: any) => x.course_id);
      const [{ data: candidates }, { data: sessions }, { data: attempts }, { data: incidents }, { data: accommodations }, { data: competencyResults }] = await Promise.all([
        sb.from("assessment_session_candidates").select("*").eq("user_id", userId),
        courseIds.length ? sb.from("assessment_sessions").select("*").in("course_id", courseIds).in("status", ["scheduled", "open", "in_progress", "completed"]).order("starts_at", { ascending: true }) : { data: [] },
        sb.from("assessment_attempts").select("id,assessment_id,course_id,attempt_number,status,score,passed,submitted_at,graded_at,result_status,result_published_at,feedback,integrity_status").eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
        sb.from("assessment_incidents").select("id,session_id,incident_type,severity,status,title,description,resolution,created_at,resolved_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
        sb.from("assessment_accommodations").select("id,session_id,status,extra_time_minutes,break_minutes,reason,created_at,decided_at").eq("user_id", userId).order("created_at", { ascending: false }),
        sb.from("assessment_result_competencies").select("id,attempt_id,assessment_id,competency_name,score,status,validated_at").eq("user_id", userId).order("created_at", { ascending: true }),
      ]);
      const candidateMap = new Map((candidates || []).map((x: any) => [x.session_id, x]));
      const accommodationMap = new Map((accommodations || []).filter((x: any) => x.status === "approved").map((x: any) => [x.session_id, x]));
      const enriched = (await enrichSessions(sb, sessions || [])).map((x: any) => {
        const accommodation = accommodationMap.get(x.id) || null;
        const end = effectiveEnd(x, accommodation).toISOString();
        return { ...x, candidate: candidateMap.get(x.id) || null, effective_ends_at: end, computed_status: normalizeSessionStatus({ ...x, ends_at: end }) };
      });
      const assessmentIds = [...new Set((attempts || []).map((x: any) => x.assessment_id))];
      const { data: assessments } = assessmentIds.length ? await sb.from("course_assessments").select("id,title,scope,assessment_type,passing_score,competency_labels,appeal_enabled,appeal_deadline_days,jury_required").in("id", assessmentIds) : { data: [] };
      const aMap = new Map((assessments || []).map((x: any) => [x.id, x]));
      const competencyMap = new Map<string, any[]>();
      for (const row of competencyResults || []) competencyMap.set(row.attempt_id, [...(competencyMap.get(row.attempt_id) || []), row]);
      return json({ success: true, sessions: enriched, results: (attempts || []).map((x: any) => ({ ...x, assessment: aMap.get(x.assessment_id) || null, competencies: competencyMap.get(x.id) || [] })), incidents: incidents || [], accommodations: accommodations || [] });
    }

    if (action === "learner_session_get") {
      if (isAdmin) return json({ success: true, preview: true, session: null });
      const sessionId = String(body.session_id || "");
      const { data: session, error } = await sb.from("assessment_sessions").select("*").eq("id", sessionId).single();
      if (error) throw error;
      if (!["scheduled", "open", "in_progress"].includes(String(session.status))) return json({ success: false, error: "SESSION_UNAVAILABLE" }, 409);
      if (!(await isEnrolled(sb, userId, session.course_id))) return json({ success: false, error: "NOT_ENROLLED" }, 403);
      let { data: candidate } = await sb.from("assessment_session_candidates").select("*").eq("session_id", session.id).eq("user_id", userId).maybeSingle();
      if (!candidate) {
        if (session.registration_deadline && Date.now() > new Date(session.registration_deadline).getTime()) return json({ success: false, error: "REGISTRATION_CLOSED" }, 409);
        const { count } = await sb.from("assessment_session_candidates").select("id", { count: "exact", head: true }).eq("session_id", session.id).neq("status", "cancelled");
        if (session.capacity && Number(count || 0) >= Number(session.capacity)) return json({ success: false, error: "SESSION_FULL" }, 409);
        const { data, error: candidateError } = await sb.from("assessment_session_candidates").insert({ session_id: session.id, user_id: userId, status: "registered" }).select("*").single();
        if (candidateError) throw candidateError;
        candidate = data;
      }
      const [{ data: assessment }, { data: course }, { data: accommodation }] = await Promise.all([
        sb.from("course_assessments").select("*").eq("id", session.assessment_id).single(),
        sb.from("courses").select("id,title,cover_image_url").eq("id", session.course_id).single(),
        sb.from("assessment_accommodations").select("*").eq("session_id", session.id).eq("user_id", userId).eq("status", "approved").maybeSingle(),
      ]);
      const effectiveEndsAt = effectiveEnd(session, accommodation).toISOString();
      return json({ success: true, session: { ...session, computed_status: normalizeSessionStatus({ ...session, ends_at: effectiveEndsAt }), effective_ends_at: effectiveEndsAt }, assessment, course, candidate, accommodation });
    }

    if (action === "learner_session_start") {
      if (isAdmin) return json({ success: false, error: "PREVIEW_READ_ONLY" }, 403);
      const sessionId = String(body.session_id || "");
      const { data: session, error } = await sb.from("assessment_sessions").select("*").eq("id", sessionId).single();
      if (error) throw error;
      if (!(await isEnrolled(sb, userId, session.course_id))) return json({ success: false, error: "NOT_ENROLLED" }, 403);
      const now = Date.now();
      const start = new Date(session.starts_at).getTime();
      const accommodation = await approvedAccommodation(sb, session.id, userId);
      const end = effectiveEnd(session, accommodation).getTime();
      const late = Math.max(0, Number(session.late_entry_minutes || 0)) * 60_000;
      if (now < start - 15 * 60_000) return json({ success: false, error: "SESSION_NOT_OPEN" }, 409);
      if (now > end || (now > start + late && !["open", "in_progress"].includes(session.status))) return json({ success: false, error: "SESSION_CLOSED" }, 409);
      if (session.identity_verification_required && body.identity_confirmed !== true) return json({ success: false, error: "IDENTITY_CONFIRMATION_REQUIRED" }, 400);
      const { data: candidate, error: candidateError } = await sb.from("assessment_session_candidates").upsert({ session_id: session.id, user_id: userId, status: "started", started_at: new Date().toISOString(), confirmed_at: new Date().toISOString() }, { onConflict: "session_id,user_id" }).select("*").single();
      if (candidateError) throw candidateError;
      const events: any[] = [{ session_id: session.id, assessment_id: session.assessment_id, user_id: userId, event_type: "session_started", metadata: { user_agent: req.headers.get("user-agent") || "" } }];
      if (session.identity_verification_required) events.push({ session_id: session.id, assessment_id: session.assessment_id, user_id: userId, event_type: "identity_confirmed", metadata: { declaration: true } });
      await sb.from("assessment_activity_events").insert(events);
      return json({ success: true, candidate, effective_ends_at: new Date(end).toISOString() });
    }

    if (action === "learner_log_event") {
      if (isAdmin) return json({ success: true, preview: true });
      const allowed = ["session_started", "page_blur", "page_focus", "tab_hidden", "tab_visible", "fullscreen_exit", "screen_share_stopped", "camera_stopped", "microphone_stopped", "submitted"];
      const eventType = String(body.event_type || "");
      if (!allowed.includes(eventType)) return json({ success: false, error: "INVALID_EVENT" }, 400);
      const severity = ["screen_share_stopped", "camera_stopped", "microphone_stopped"].includes(eventType) ? "warning" : "info";
      const { error } = await sb.from("assessment_activity_events").insert({ session_id: body.session_id || null, assessment_id: body.assessment_id || null, attempt_id: body.attempt_id || null, user_id: userId, event_type: eventType, severity, metadata: body.metadata || {} });
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "prepare_incident_upload") {
      if (isAdmin) return json({ success: false, error: "PREVIEW_READ_ONLY" }, 403);
      const fileName = safeFileName(String(body.file_name || "preuve"));
      const sessionId = String(body.session_id || "");
      const size = Math.max(0, Number(body.size_bytes || 0));
      const mime = String(body.mime_type || "application/octet-stream").toLowerCase();
      const allowedMimes = ["application/pdf", "image/png", "image/jpeg", "image/webp", "text/plain", "application/json"];
      if (!sessionId) return json({ success: false, error: "SESSION_REQUIRED" }, 400);
      if (size > 10 * 1024 * 1024) return json({ success: false, error: "FILE_TOO_LARGE" }, 400);
      if (!allowedMimes.includes(mime)) return json({ success: false, error: "FILE_TYPE_NOT_ALLOWED" }, 400);
      const { data: session, error: sessionError } = await sb.from("assessment_sessions").select("course_id").eq("id", sessionId).single();
      if (sessionError) throw sessionError;
      if (!(await isEnrolled(sb, userId, session.course_id))) return json({ success: false, error: "NOT_ENROLLED" }, 403);
      const path = `${userId}/${sessionId}/${crypto.randomUUID()}-${fileName}`;
      const { data, error } = await sb.storage.from("assessment-evidence").createSignedUploadUrl(path, { upsert: false });
      if (error) throw error;
      return json({ success: true, bucket: "assessment-evidence", path, signedUrl: data.signedUrl });
    }

    if (action === "learner_report_incident") {
      if (isAdmin) return json({ success: false, error: "PREVIEW_READ_ONLY" }, 403);
      const title = String(body.title || "").trim();
      const description = String(body.description || "").trim();
      if (!title || !description) return json({ success: false, error: "TITLE_DESCRIPTION_REQUIRED" }, 400);
      const sessionId = String(body.session_id || "");
      const { data: session, error: sessionError } = await sb.from("assessment_sessions").select("course_id,assessment_id").eq("id", sessionId).single();
      if (sessionError) throw sessionError;
      if (!(await isEnrolled(sb, userId, session.course_id))) return json({ success: false, error: "NOT_ENROLLED" }, 403);
      const evidence = Array.isArray(body.evidence) ? body.evidence.slice(0, 5) : [];
      for (const item of evidence) {
        if (item?.bucket_name !== "assessment-evidence" || !String(item?.storage_path || "").startsWith(`${userId}/${sessionId}/`) || Number(item?.size_bytes || 0) > 10 * 1024 * 1024) return json({ success: false, error: "INVALID_EVIDENCE" }, 400);
      }
      const { data, error } = await sb.from("assessment_incidents").insert({ session_id: sessionId, assessment_id: session.assessment_id, attempt_id: body.attempt_id || null, user_id: userId, incident_type: body.incident_type || "technical", severity: body.severity || "minor", title, description, evidence, reported_by: userId }).select("*").single();
      if (error) throw error;
      await sb.from("assessment_activity_events").insert({ session_id: body.session_id || null, assessment_id: body.assessment_id || null, attempt_id: body.attempt_id || null, user_id: userId, event_type: "incident_reported", severity: body.severity === "critical" ? "critical" : "warning", metadata: { incident_id: data.id, type: data.incident_type } });
      return json({ success: true, incident: data });
    }

    if (action === "admin_resolve_incident") {
      if (!isAdmin) return json({ success: false, error: "FORBIDDEN" }, 403);
      const status = ["in_review", "resolved", "dismissed"].includes(String(body.status)) ? String(body.status) : "resolved";
      if (["resolved", "dismissed"].includes(status) && !String(body.resolution || "").trim()) return json({ success: false, error: "RESOLUTION_REQUIRED" }, 400);
      const patch: any = { status, assigned_to: body.assigned_to || userId, resolution: String(body.resolution || "").trim() || null };
      if (["resolved", "dismissed"].includes(status)) { patch.resolved_by = userId; patch.resolved_at = new Date().toISOString(); }
      const { data, error } = await sb.from("assessment_incidents").update(patch).eq("id", body.incident_id).select("*").single();
      if (error) throw error;
      return json({ success: true, incident: data });
    }

    if (action === "learner_request_accommodation") {
      if (isAdmin) return json({ success: false, error: "PREVIEW_READ_ONLY" }, 403);
      const { data: session, error } = await sb.from("assessment_sessions").select("course_id,status,starts_at").eq("id", body.session_id).single();
      if (error) throw error;
      if (!["scheduled", "open"].includes(String(session.status)) || Date.now() >= new Date(session.starts_at).getTime()) return json({ success: false, error: "ACCOMMODATION_REQUEST_CLOSED" }, 409);
      if (!(await isEnrolled(sb, userId, session.course_id))) return json({ success: false, error: "NOT_ENROLLED" }, 403);
      const reason = String(body.reason || "").trim();
      if (!reason) return json({ success: false, error: "REASON_REQUIRED" }, 400);
      const { data, error: upsertError } = await sb.from("assessment_accommodations").upsert({ session_id: body.session_id, user_id: userId, status: "pending", extra_time_minutes: Math.min(480, Math.max(0, Number(body.extra_time_minutes || 0))), break_minutes: Math.min(240, Math.max(0, Number(body.break_minutes || 0))), adjustments: body.adjustments || {}, reason, requested_by: userId, decided_by: null, decided_at: null }, { onConflict: "session_id,user_id" }).select("*").single();
      if (upsertError) throw upsertError;
      return json({ success: true, accommodation: data });
    }

    if (action === "admin_accommodation_decide") {
      if (!isAdmin) return json({ success: false, error: "FORBIDDEN" }, 403);
      const status = String(body.status || "");
      if (!["approved", "rejected", "cancelled"].includes(status)) return json({ success: false, error: "INVALID_STATUS" }, 400);
      const { data, error } = await sb.from("assessment_accommodations").update({ status, extra_time_minutes: Math.min(480, Math.max(0, Number(body.extra_time_minutes || 0))), break_minutes: Math.min(240, Math.max(0, Number(body.break_minutes || 0))), adjustments: body.adjustments || {}, private_note: String(body.private_note || "").trim() || null, decided_by: userId, decided_at: new Date().toISOString() }).eq("id", body.accommodation_id).select("*").single();
      if (error) throw error;
      return json({ success: true, accommodation: data });
    }

    return json({ success: false, error: "UNKNOWN_ACTION" }, 400);
  } catch (error) {
    console.error("assessment-center", error);
    return json({ success: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
