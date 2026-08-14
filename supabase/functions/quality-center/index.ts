import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

import { getActiveOmniaSessionResult } from "../_shared/omnia-auth.ts";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-omnia-session-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { ...cors, "Content-Type": "application/json" },
});

async function sessionUser(sb: any, req: Request, bodyToken = "") {
  const token = (bodyToken || req.headers.get("x-omnia-session-token") || req.headers.get("Authorization") || "")
    .replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data } = await getActiveOmniaSessionResult(sb, token);
  if (data?.user_id) return data.user_id;
  const { data: authData } = await sb.auth.getUser(token);
  return authData?.user?.id || null;
}

async function roles(sb: any, userId: string) {
  const { data } = await sb.from("user_roles").select("role").eq("user_id", userId);
  return (data || []).map((row: any) => row.role);
}

async function courseOwned(sb: any, userId: string, courseId: string, isAdmin: boolean) {
  if (isAdmin) return true;
  const { data } = await sb.from("courses").select("creator_id").eq("id", courseId).maybeSingle();
  return data?.creator_id === userId;
}

async function hydrateReviews(sb: any, reviews: any[]) {
  const courseIds = [...new Set(reviews.map((r) => r.course_id).filter(Boolean))];
  const assessmentIds = [...new Set(reviews.map((r) => r.assessment_id).filter(Boolean))];
  const userIds = [...new Set(reviews.flatMap((r) => [r.submitted_by, r.assigned_to]).filter(Boolean))];
  const [{ data: courses }, { data: assessments }, { data: users }] = await Promise.all([
    courseIds.length ? sb.from("courses").select("id,title,creator_id,creator_context,studio_status,category,level,current_version,submitted_at,is_published,quality_review_status,quality_next_review_at").in("id", courseIds) : { data: [] },
    assessmentIds.length ? sb.from("course_assessments").select("id,course_id,title,scope,assessment_type,required,passing_score,quality_review_status").in("id", assessmentIds) : { data: [] },
    userIds.length ? sb.from("users").select("id,full_name,email").in("id", userIds) : { data: [] },
  ]);
  const courseMap = Object.fromEntries((courses || []).map((x: any) => [x.id, x]));
  const assessmentMap = Object.fromEntries((assessments || []).map((x: any) => [x.id, x]));
  const userMap = Object.fromEntries((users || []).map((x: any) => [x.id, x]));
  return reviews.map((review: any) => ({
    ...review,
    course: review.course_id ? courseMap[review.course_id] || null : null,
    assessment: review.assessment_id ? assessmentMap[review.assessment_id] || null : null,
    submitter: review.submitted_by ? userMap[review.submitted_by] || null : null,
    assignee: review.assigned_to ? userMap[review.assigned_to] || null : null,
  }));
}

async function addHistory(sb: any, review: any, actorId: string, eventType: string, fromStatus: string | null, toStatus: string | null, note = "", metadata: any = {}) {
  await sb.from("quality_review_history").insert({
    review_id: review?.id || null,
    course_id: review?.course_id || null,
    assessment_id: review?.assessment_id || null,
    actor_id: actorId,
    event_type: eventType,
    from_status: fromStatus,
    to_status: toStatus,
    note: note || null,
    metadata: metadata || {},
  });
}

async function ensureReviewItems(sb: any, review: any) {
  const entityType = review.entity_type === "assessment" ? "assessment" : "course";
  const { data: criteria, error } = await sb.from("quality_criteria").select("id")
    .eq("active", true).in("entity_type", [entityType, "both"]);
  if (error) throw error;
  if (!criteria?.length) return;
  const rows = criteria.map((criterion: any) => ({ review_id: review.id, criterion_id: criterion.id }));
  const { error: insertError } = await sb.from("quality_review_items").upsert(rows, { onConflict: "review_id,criterion_id", ignoreDuplicates: true });
  if (insertError) throw insertError;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next.toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json();
    const action = String(body.action || "");
    const userId = await sessionUser(sb, req, String(body.session_token || ""));
    if (!userId) return json({ success: false, error: "AUTH_REQUIRED" }, 401);
    const userRoles = await roles(sb, userId);
    const isAdmin = userRoles.includes("super_admin");

    if (action === "admin_dashboard") {
      if (!isAdmin) return json({ success: false, error: "FORBIDDEN" }, 403);
      const { data, error } = await sb.from("quality_reviews").select("*").order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      const allReviews = await hydrateReviews(sb, data || []);
      const reviews = allReviews.filter((review: any) =>
        (!body.status || body.status === "all" || review.status === body.status)
        && (!body.entity_type || body.entity_type === "all" || review.entity_type === body.entity_type)
      );
      const { count: openChanges } = await sb.from("quality_change_requests").select("id", { count: "exact", head: true }).in("status", ["open", "responded"]);
      const { count: openNonconformities } = await sb.from("quality_nonconformities").select("id", { count: "exact", head: true }).neq("status", "closed");
      const { count: plannedAudits } = await sb.from("quality_audits").select("id", { count: "exact", head: true }).in("status", ["planned", "in_progress", "actions_required"]);
      return json({
        success: true,
        reviews,
        summary: {
          total: allReviews.length,
          waiting: allReviews.filter((r: any) => r.status === "submitted").length,
          in_review: allReviews.filter((r: any) => r.status === "in_review").length,
          changes: Number(openChanges || 0),
          approved: allReviews.filter((r: any) => r.status === "approved").length,
          nonconformities: Number(openNonconformities || 0),
          audits: Number(plannedAudits || 0),
        },
      });
    }

    if (action === "admin_review_get" || action === "creator_status") {
      const reviewId = String(body.review_id || "");
      const courseId = String(body.course_id || "");
      let reviewQuery = sb.from("quality_reviews").select("*");
      if (reviewId) reviewQuery = reviewQuery.eq("id", reviewId);
      else if (courseId) reviewQuery = reviewQuery.eq("course_id", courseId).order("created_at", { ascending: false }).limit(1);
      else return json({ success: false, error: "REVIEW_OR_COURSE_REQUIRED" }, 400);
      const { data: review, error } = await reviewQuery.maybeSingle();
      if (error) throw error;
      if (!review) return json({ success: true, review: null, items: [], change_requests: [], history: [] });
      if (!isAdmin && !(await courseOwned(sb, userId, review.course_id, isAdmin))) return json({ success: false, error: "FORBIDDEN" }, 403);
      await ensureReviewItems(sb, review);
      const [{ data: items }, { data: changes }, { data: history }, { data: course }, { data: assessment }, { data: assessments }] = await Promise.all([
        sb.from("quality_review_items").select("*,criterion:quality_criteria(*)").eq("review_id", review.id).order("created_at"),
        sb.from("quality_change_requests").select("*").eq("review_id", review.id).order("created_at", { ascending: false }),
        sb.from("quality_review_history").select("*").eq("review_id", review.id).order("created_at", { ascending: false }),
        review.course_id ? sb.from("courses").select("*").eq("id", review.course_id).maybeSingle() : { data: null },
        review.assessment_id ? sb.from("course_assessments").select("*").eq("id", review.assessment_id).maybeSingle() : { data: null },
        review.course_id ? sb.from("course_assessments").select("id,title,scope,assessment_type,required,passing_score,quality_review_status").eq("course_id", review.course_id).order("created_at") : { data: [] },
      ]);
      return json({ success: true, review, course, assessment, assessments: assessments || [], items: items || [], change_requests: changes || [], history: history || [] });
    }

    if (action === "admin_review_start") {
      if (!isAdmin) return json({ success: false, error: "FORBIDDEN" }, 403);
      const { data: review, error } = await sb.from("quality_reviews").select("*").eq("id", body.review_id).single();
      if (error) throw error;
      const fromStatus = review.status;
      const { data: updated, error: updateError } = await sb.from("quality_reviews").update({
        status: "in_review",
        assigned_to: body.assigned_to || userId,
        started_at: review.started_at || new Date().toISOString(),
        due_at: body.due_at || review.due_at,
      }).eq("id", review.id).select("*").single();
      if (updateError) throw updateError;
      await ensureReviewItems(sb, updated);
      await addHistory(sb, updated, userId, "review_started", fromStatus, "in_review", body.note || "");
      return json({ success: true, review: updated });
    }

    if (action === "admin_save_item") {
      if (!isAdmin) return json({ success: false, error: "FORBIDDEN" }, 403);
      const allowed = ["not_reviewed", "conform", "partial", "non_conform", "not_applicable"];
      if (!allowed.includes(String(body.status))) return json({ success: false, error: "INVALID_STATUS" }, 400);
      const patch = {
        status: body.status,
        score: body.score === "" || body.score == null ? null : Number(body.score),
        comment: body.comment || null,
        required_action: body.required_action || null,
        evidence: Array.isArray(body.evidence) ? body.evidence : [],
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      };
      const { data, error } = await sb.from("quality_review_items").update(patch).eq("id", body.item_id).select("*").single();
      if (error) throw error;
      return json({ success: true, item: data });
    }

    if (action === "admin_add_change_request") {
      if (!isAdmin) return json({ success: false, error: "FORBIDDEN" }, 403);
      const { data: review, error: reviewError } = await sb.from("quality_reviews").select("*").eq("id", body.review_id).single();
      if (reviewError) throw reviewError;
      if (!String(body.title || "").trim() || !String(body.description || "").trim()) return json({ success: false, error: "TITLE_DESCRIPTION_REQUIRED" }, 400);
      const { data, error } = await sb.from("quality_change_requests").insert({
        review_id: review.id,
        course_id: review.course_id,
        assessment_id: review.assessment_id,
        criterion_id: body.criterion_id || null,
        title: String(body.title).trim(),
        description: String(body.description).trim(),
        severity: body.severity || "major",
        status: "open",
        requested_by: userId,
        assigned_to: review.submitted_by,
        due_at: body.due_at || null,
      }).select("*").single();
      if (error) throw error;
      await addHistory(sb, review, userId, "change_requested", review.status, "changes_requested", data.title, { change_request_id: data.id, severity: data.severity });
      return json({ success: true, change_request: data });
    }

    if (action === "creator_respond_change_request") {
      const { data: change, error: readError } = await sb.from("quality_change_requests").select("*,review:quality_reviews(*)").eq("id", body.change_request_id).single();
      if (readError) throw readError;
      const review = change.review;
      if (!isAdmin && !(await courseOwned(sb, userId, review.course_id, isAdmin))) return json({ success: false, error: "FORBIDDEN" }, 403);
      const { data, error } = await sb.from("quality_change_requests").update({
        creator_response: String(body.response || "").trim(),
        response_evidence: Array.isArray(body.evidence) ? body.evidence : [],
        responded_at: new Date().toISOString(),
        status: "responded",
      }).eq("id", change.id).select("*").single();
      if (error) throw error;
      await addHistory(sb, review, userId, "creator_response", review.status, review.status, data.creator_response || "", { change_request_id: change.id });
      return json({ success: true, change_request: data });
    }

    if (action === "admin_resolve_change_request") {
      if (!isAdmin) return json({ success: false, error: "FORBIDDEN" }, 403);
      const status = ["accepted", "rejected", "resolved", "cancelled"].includes(String(body.status)) ? String(body.status) : "resolved";
      const { data, error } = await sb.from("quality_change_requests").update({
        status,
        resolved_by: userId,
        resolved_at: new Date().toISOString(),
      }).eq("id", body.change_request_id).select("*").single();
      if (error) throw error;
      return json({ success: true, change_request: data });
    }

    if (action === "admin_decide") {
      if (!isAdmin) return json({ success: false, error: "FORBIDDEN" }, 403);
      const decision = String(body.decision || "");
      const decisionSummary = String(body.summary || "").trim();
      if (!["approved", "changes_requested", "rejected", "suspended", "restored"].includes(decision)) return json({ success: false, error: "INVALID_DECISION" }, 400);
      if (!decisionSummary) return json({ success: false, error: "SUMMARY_REQUIRED", message: "Le motif de la décision est obligatoire." }, 400);
      const { data: review, error: reviewError } = await sb.from("quality_reviews").select("*").eq("id", body.review_id).single();
      if (reviewError) throw reviewError;
      await ensureReviewItems(sb, review);
      const { data: items, error: itemError } = await sb.from("quality_review_items").select("*,criterion:quality_criteria(*)").eq("review_id", review.id);
      if (itemError) throw itemError;
      if (decision === "approved") {
        const incomplete = (items || []).filter((item: any) => item.criterion?.is_required && !["conform", "not_applicable"].includes(item.status));
        if (incomplete.length) return json({ success: false, error: "REQUIRED_CRITERIA_INCOMPLETE", message: `${incomplete.length} critère(s) obligatoire(s) ne sont pas conformes.` }, 409);
      }
      const weighted = (items || []).filter((item: any) => item.status !== "not_applicable");
      const totalWeight = weighted.reduce((sum: number, item: any) => sum + Number(item.criterion?.weight || 1), 0);
      const statusScores: Record<string, number> = { conform: 100, partial: 50, non_conform: 0, not_reviewed: 0 };
      const overallScore = totalWeight ? weighted.reduce((sum: number, item: any) => sum + Number(item.criterion?.weight || 1) * (item.score == null ? statusScores[item.status] || 0 : Number(item.score)), 0) / totalWeight : null;
      const fromStatus = review.status;
      const nextStatus = decision === "restored" ? "approved" : decision;
      const nextReviewAt = body.next_review_at || (decision === "approved" ? addMonths(new Date(), Number(body.review_months || 12)) : review.next_review_at);
      const { data: updated, error: updateError } = await sb.from("quality_reviews").update({
        status: nextStatus,
        decision,
        decision_summary: decisionSummary,
        overall_score: overallScore == null ? null : Number(overallScore.toFixed(2)),
        cpd_status: body.cpd_status || review.cpd_status || "not_assessed",
        cpd_notes: body.cpd_notes || null,
        completed_at: new Date().toISOString(),
        next_review_at: nextReviewAt,
        assigned_to: review.assigned_to || userId,
      }).eq("id", review.id).select("*").single();
      if (updateError) throw updateError;
      if (review.entity_type === "course" && review.course_id) {
        const patch: any = {
          quality_review_id: review.id,
          quality_review_status: nextStatus,
          quality_cpd_status: updated.cpd_status,
          quality_last_reviewed_at: new Date().toISOString(),
          quality_next_review_at: nextReviewAt,
          admin_comment: decisionSummary,
          updated_at: new Date().toISOString(),
        };
        if (decision === "approved" || decision === "restored") {
          patch.studio_status = body.publish ? "published" : "validated";
          patch.validated_at = new Date().toISOString();
          patch.validated_by = userId;
          patch.quality_suspended_at = null;
          patch.quality_suspension_reason = null;
          if (body.publish) patch.is_published = true;
        } else if (decision === "changes_requested") {
          patch.studio_status = "changes_requested";
          patch.is_published = false;
        } else if (decision === "rejected") {
          patch.studio_status = "rejected";
          patch.is_published = false;
        } else if (decision === "suspended") {
          patch.studio_status = "suspended";
          patch.is_published = false;
          patch.quality_suspended_at = new Date().toISOString();
          patch.quality_suspension_reason = decisionSummary;
        }
        const { error } = await sb.from("courses").update(patch).eq("id", review.course_id);
        if (error) throw error;
      }
      if (review.entity_type === "assessment" && review.assessment_id) {
        const { error } = await sb.from("course_assessments").update({
          quality_review_id: review.id,
          quality_review_status: nextStatus,
          quality_approved_at: decision === "approved" ? new Date().toISOString() : null,
          quality_approved_by: decision === "approved" ? userId : null,
          updated_at: new Date().toISOString(),
        }).eq("id", review.assessment_id);
        if (error) throw error;
      }
      await addHistory(sb, updated, userId, "review_decision", fromStatus, nextStatus, decisionSummary, { decision, overall_score: overallScore, publish: !!body.publish });
      return json({ success: true, review: updated });
    }

    if (action === "admin_fast_track") {
      if (!isAdmin) return json({ success: false, error: "FORBIDDEN" }, 403);
      const courseId = String(body.course_id || "");
      const summary = String(body.summary || "").trim();
      if (!courseId || !summary) return json({ success: false, error: "COURSE_AND_SUMMARY_REQUIRED" }, 400);
      const { data: course, error: courseError } = await sb.from("courses").select("*").eq("id", courseId).single();
      if (courseError) throw courseError;
      if (course.creator_context !== "super_admin" && course.creator_id !== userId) return json({ success: false, error: "FAST_TRACK_RESERVED_FOR_OMNIA_COURSES" }, 403);
      let { data: review } = await sb.from("quality_reviews").select("*").eq("course_id", courseId).in("status", ["draft", "submitted", "in_review", "changes_requested"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!review) {
        const { data, error } = await sb.from("quality_reviews").insert({
          entity_type: "course", course_id: courseId, review_type: "fast_track", status: "in_review",
          submitted_by: userId, assigned_to: userId, started_at: new Date().toISOString(), accelerated: true,
          version_label: course.current_version || "1.0",
        }).select("*").single();
        if (error) throw error;
        review = data;
      }
      await ensureReviewItems(sb, review);
      const { error: itemError } = await sb.from("quality_review_items").update({
        status: "conform", score: 100, comment: "Contrôle accéléré Omnia — vérification tracée.", reviewed_by: userId, reviewed_at: new Date().toISOString(),
      }).eq("review_id", review.id);
      if (itemError) throw itemError;
      const nextReviewAt = body.next_review_at || addMonths(new Date(), Number(body.review_months || 12));
      const { data: updated, error: updateError } = await sb.from("quality_reviews").update({
        status: "approved", decision: "approved", decision_summary: summary, overall_score: 100,
        cpd_status: body.cpd_status || "pending", cpd_notes: body.cpd_notes || null,
        completed_at: new Date().toISOString(), next_review_at: nextReviewAt, accelerated: true,
      }).eq("id", review.id).select("*").single();
      if (updateError) throw updateError;
      const { error: courseUpdateError } = await sb.from("courses").update({
        quality_review_id: review.id, quality_review_status: "approved", quality_last_reviewed_at: new Date().toISOString(),
        quality_next_review_at: nextReviewAt, quality_cpd_status: updated.cpd_status,
        studio_status: body.publish === false ? "validated" : "published", is_published: body.publish === false ? course.is_published : true,
        validated_at: new Date().toISOString(), validated_by: userId, admin_comment: summary,
      }).eq("id", courseId);
      if (courseUpdateError) throw courseUpdateError;
      await addHistory(sb, updated, userId, "fast_track_approved", review.status, "approved", summary, { publish: body.publish !== false });
      return json({ success: true, review: updated });
    }

    if (action === "admin_list_criteria") {
      if (!isAdmin) return json({ success: false, error: "FORBIDDEN" }, 403);
      const { data, error } = await sb.from("quality_criteria").select("*").order("sort_order");
      if (error) throw error;
      return json({ success: true, criteria: data || [] });
    }

    if (action === "admin_save_criterion") {
      if (!isAdmin) return json({ success: false, error: "FORBIDDEN" }, 403);
      const payload: any = {
        code: String(body.code || "").trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_"),
        name: String(body.name || "").trim(), description: body.description || null,
        category: body.category || "pedagogie", entity_type: body.entity_type || "course",
        response_type: body.response_type || "status", weight: Number(body.weight || 1),
        is_required: body.is_required !== false, cpd_relevant: !!body.cpd_relevant,
        sort_order: Number(body.sort_order || 0), active: body.active !== false, created_by: userId,
      };
      if (!payload.code || !payload.name) return json({ success: false, error: "CODE_NAME_REQUIRED" }, 400);
      let result;
      if (body.id) result = await sb.from("quality_criteria").update(payload).eq("id", body.id).select("*").single();
      else result = await sb.from("quality_criteria").insert(payload).select("*").single();
      if (result.error) throw result.error;
      return json({ success: true, criterion: result.data });
    }

    if (action === "admin_list_audits") {
      if (!isAdmin) return json({ success: false, error: "FORBIDDEN" }, 403);
      const { data, error } = await sb.from("quality_audits").select("*").order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      const courseIds = [...new Set((data || []).map((x: any) => x.course_id).filter(Boolean))];
      const { data: courses } = courseIds.length ? await sb.from("courses").select("id,title").in("id", courseIds) : { data: [] as any[] };
      const map = Object.fromEntries((courses || []).map((x: any) => [x.id, x]));
      return json({ success: true, audits: (data || []).map((x: any) => ({ ...x, course: map[x.course_id] || null })) });
    }

    if (action === "admin_save_audit") {
      if (!isAdmin) return json({ success: false, error: "FORBIDDEN" }, 403);
      const payload = {
        course_id: body.course_id || null, assessment_id: body.assessment_id || null, review_id: body.review_id || null,
        audit_type: body.audit_type || "periodic", status: body.status || "planned",
        title: String(body.title || "Audit qualité").trim(), scope: body.scope || null,
        scheduled_for: body.scheduled_for || null, started_at: body.started_at || null, completed_at: body.completed_at || null,
        auditor_id: body.auditor_id || userId, summary: body.summary || null,
        score: body.score == null || body.score === "" ? null : Number(body.score), next_audit_at: body.next_audit_at || null,
        created_by: userId,
      };
      const result = body.id
        ? await sb.from("quality_audits").update(payload).eq("id", body.id).select("*").single()
        : await sb.from("quality_audits").insert(payload).select("*").single();
      if (result.error) throw result.error;
      return json({ success: true, audit: result.data });
    }

    if (action === "admin_list_nonconformities") {
      if (!isAdmin) return json({ success: false, error: "FORBIDDEN" }, 403);
      const { data, error } = await sb.from("quality_nonconformities").select("*").order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      const courseIds = [...new Set((data || []).map((x: any) => x.course_id).filter(Boolean))];
      const { data: courses } = courseIds.length ? await sb.from("courses").select("id,title").in("id", courseIds) : { data: [] as any[] };
      const map = Object.fromEntries((courses || []).map((x: any) => [x.id, x]));
      return json({ success: true, nonconformities: (data || []).map((x: any) => ({ ...x, course: map[x.course_id] || null })) });
    }

    if (action === "admin_save_nonconformity") {
      if (!isAdmin) return json({ success: false, error: "FORBIDDEN" }, 403);
      const payload = {
        review_id: body.review_id || null, audit_id: body.audit_id || null, course_id: body.course_id || null, assessment_id: body.assessment_id || null,
        code: String(body.code || `NC-${Date.now()}`).trim(), title: String(body.title || "").trim(), description: String(body.description || "").trim(),
        severity: body.severity || "major", status: body.status || "open", detected_by: userId, assigned_to: body.assigned_to || null,
        due_at: body.due_at || null, root_cause: body.root_cause || null, corrective_action: body.corrective_action || null,
        corrective_evidence: Array.isArray(body.corrective_evidence) ? body.corrective_evidence : [],
        verified_by: body.status === "closed" ? userId : null, verified_at: body.status === "closed" ? new Date().toISOString() : null,
        closed_by: body.status === "closed" ? userId : null, closed_at: body.status === "closed" ? new Date().toISOString() : null,
      };
      if (!payload.title || !payload.description) return json({ success: false, error: "TITLE_DESCRIPTION_REQUIRED" }, 400);
      const result = body.id
        ? await sb.from("quality_nonconformities").update(payload).eq("id", body.id).select("*").single()
        : await sb.from("quality_nonconformities").insert(payload).select("*").single();
      if (result.error) throw result.error;
      return json({ success: true, nonconformity: result.data });
    }

    if (action === "admin_ai_governance_get") {
      if (!isAdmin) return json({ success: false, error: "FORBIDDEN" }, 403);
      const [{ data: governance, error: governanceError }, { data: logs, error: logsError }] = await Promise.all([
        sb.from("ai_pedagogical_governance").select("*").eq("id", 1).maybeSingle(),
        sb.from("ai_pedagogical_usage_logs").select("id,user_id,course_id,mode,status,chunks_used,model,created_at").order("created_at", { ascending: false }).limit(100),
      ]);
      if (governanceError) throw governanceError;
      if (logsError) throw logsError;
      const courseIds = [...new Set((logs || []).map((x: any) => x.course_id).filter(Boolean))];
      const userIds = [...new Set((logs || []).map((x: any) => x.user_id).filter(Boolean))];
      const [{ data: courses }, { data: users }, { data: overrides }] = await Promise.all([
        courseIds.length ? sb.from("courses").select("id,title").in("id", courseIds) : { data: [] },
        userIds.length ? sb.from("users").select("id,full_name,email").in("id", userIds) : { data: [] },
        sb.from("ai_pedagogical_course_settings").select("*,course:courses(id,title)").order("updated_at", { ascending: false }).limit(300),
      ]);
      const courseMap = Object.fromEntries((courses || []).map((x: any) => [x.id, x]));
      const userMap = Object.fromEntries((users || []).map((x: any) => [x.id, x]));
      return json({ success: true, governance, overrides: overrides || [], logs: (logs || []).map((x: any) => ({ ...x, course: courseMap[x.course_id] || null, user: userMap[x.user_id] || null })) });
    }

    if (action === "admin_ai_governance_save") {
      if (!isAdmin) return json({ success: false, error: "FORBIDDEN" }, 403);
      const payload = {
        id: 1,
        enabled: body.enabled !== false,
        model: String(body.model || "claude-sonnet-4-6"),
        max_tokens: Math.max(200, Math.min(4000, Number(body.max_tokens || 1000))),
        hourly_limit: Math.max(1, Math.min(200, Number(body.hourly_limit || 20))),
        max_chunks: Math.max(1, Math.min(12, Number(body.max_chunks || 6))),
        similarity_threshold: Math.max(0.3, Math.min(0.95, Number(body.similarity_threshold || 0.72))),
        allowed_modes: Array.isArray(body.allowed_modes) ? body.allowed_modes : ["question","explanation","reformulation","exercise","revision_plan","recommendation"],
        log_enabled: body.log_enabled !== false,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await sb.from("ai_pedagogical_governance").upsert(payload).select("*").single();
      if (error) throw error;
      return json({ success: true, governance: data });
    }

    if (action === "admin_ai_course_setting_save") {
      if (!isAdmin) return json({ success: false, error: "FORBIDDEN" }, 403);
      const courseId = String(body.course_id || "");
      if (!courseId) return json({ success: false, error: "COURSE_REQUIRED" }, 400);
      const payload = {
        course_id: courseId,
        enabled: body.enabled !== false,
        allowed_modes: Array.isArray(body.allowed_modes) ? body.allowed_modes : ["question","explanation","reformulation","exercise","revision_plan","recommendation"],
        model: body.model || null,
        max_tokens: body.max_tokens ? Number(body.max_tokens) : null,
        hourly_limit: body.hourly_limit ? Number(body.hourly_limit) : null,
        quality_notes: body.quality_notes || null,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await sb.from("ai_pedagogical_course_settings").upsert(payload).select("*").single();
      if (error) throw error;
      return json({ success: true, setting: data });
    }

    if (action === "prepare_evidence_upload") {
      const courseId = String(body.course_id || "");
      if (!courseId || (!isAdmin && !(await courseOwned(sb, userId, courseId, isAdmin)))) return json({ success: false, error: "FORBIDDEN" }, 403);
      const filename = String(body.file_name || "preuve").replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${courseId}/${body.review_id || "general"}/${crypto.randomUUID()}-${filename}`;
      const { data, error } = await sb.storage.from("quality-evidence").createSignedUploadUrl(path, { upsert: false });
      if (error) throw error;
      return json({ success: true, bucket: "quality-evidence", path, ...data });
    }

    return json({ success: false, error: "UNKNOWN_ACTION", action }, 400);
  } catch (error) {
    console.error("quality-center", error);
    return json({ success: false, error: "SERVER_ERROR", message: error instanceof Error ? error.message : String(error) }, 500);
  }
});
