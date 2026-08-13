import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { appendModeratorTeamAudit, getModeratorAccess, hasModeratorConflict } from "../_shared/moderator-access.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Omnia-Session-Token, X-Client-Info, Apikey",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sessionToken(req: Request) {
  return (
    req.headers.get("x-omnia-session-token") ??
    (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "")
  ).trim();
}

const EMPTY_PERMS: Record<string, boolean> = {
  can_see_pending_courses: false,
  can_review_course_content: false,
  can_request_course_modification: false,
  can_recommend_course_price: false,
  can_validate_course_price: false,
  can_reject_course: false,
  can_approve_transmit_course: false,
  can_transmit_course_to_admin: false,
  can_manage_course_certifications: false,
  can_create_assisted_course: false,
  can_see_learners_list: false,
  can_see_professors_list: false,
  can_see_structures_list: false,
  can_see_organizers_list: false,
  can_request_account_suspension: false,
  can_suspend_account: false,
  can_validate_professor_kyc: false,
  can_validate_structure_kyc: false,
  can_validate_establishment_kyc: false,
  can_moderate_forum: false,
  can_moderate_jobs: false,
  can_manage_support: false,
  can_view_ai_conversations: false,
  can_manage_reports: false,
  can_review_live_events: false,
  can_review_live_reports: false,
  can_review_live_refunds: false,
  can_review_live_organizers: false,
  can_review_structure_requests: false,
  can_review_structure_codes: false,
  can_view_analytics: false,
};

function dateKey(value: string) {
  return value.slice(0, 10);
}

function weekKey(value: string) {
  const date = new Date(value);
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - day);
  return date.toISOString().slice(0, 10);
}

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    course_approved: "Formations approuvées",
    course_rejected: "Formations rejetées",
    course_transmitted: "Formations transmises",
    kyc_approved: "KYC approuvés",
    kyc_rejected: "KYC rejetés",
    account_suspended: "Comptes suspendus",
    account_reactivated: "Comptes réactivés",
    forum_post_removed: "Publications masquées",
    forum_post_restored: "Publications restaurées",
    job_approved: "Offres approuvées",
    job_rejected: "Offres rejetées",
  };
  return labels[action] ?? action.replaceAll("_", " ");
}


type ControlQueueItem = {
  id: string;
  target_type: string;
  title: string;
  subtitle?: string | null;
  status?: string | null;
  created_at?: string | null;
  permission_key: string;
  decision_mode: "read_only" | "operational" | "recommendation";
  metadata?: Record<string, unknown>;
};

async function loadControlQueues(sb: ReturnType<typeof createClient>, userId: string, permissions: Record<string, boolean>) {
  const queues: Record<string, ControlQueueItem[]> = {};
  const add = (key: string, rows: ControlQueueItem[]) => { if (rows.length) queues[key] = rows; };

  if (permissions.can_manage_course_certifications) {
    const { data, error } = await sb.from("course_certifications")
      .select("id,course_id,certification_name,organization_name,status,requested_by,created_at")
      .eq("status", "pending").order("created_at", { ascending: true }).limit(50);
    if (error) throw error;
    add("course_certifications", (data ?? []).map((row) => ({
      id: String(row.id), target_type: "course_certification",
      title: String(row.certification_name || "Certification"),
      subtitle: String(row.organization_name || "Organisme non renseigné"), status: String(row.status || "pending"),
      created_at: row.created_at ? String(row.created_at) : null,
      permission_key: "can_manage_course_certifications", decision_mode: "recommendation",
      metadata: { course_id: row.course_id, requested_by: row.requested_by },
    })));
  }

  if (permissions.can_create_assisted_course) {
    const { data, error } = await sb.from("assisted_course_requests")
      .select("id,course_id,requester_id,requester_role,service_type,status,assigned_to,requested_at")
      .in("status", ["pending", "in_progress", "changes_requested"]).order("requested_at", { ascending: true }).limit(50);
    if (error) throw error;
    add("assisted_course_requests", (data ?? []).map((row) => ({
      id: String(row.id), target_type: "assisted_course_request",
      title: `Saisie assistée · ${String(row.service_type || "formation")}`,
      subtitle: row.assigned_to ? (String(row.assigned_to) === userId ? "Prise en charge par vous" : "Déjà assignée") : "À prendre en charge",
      status: String(row.status || "pending"), created_at: row.requested_at ? String(row.requested_at) : null,
      permission_key: "can_create_assisted_course", decision_mode: "operational",
      metadata: { course_id: row.course_id, requester_id: row.requester_id, assigned_to: row.assigned_to },
    })));
  }

  if (permissions.can_see_structures_list || permissions.can_validate_structure_kyc || permissions.can_review_structure_requests) {
    let query = sb.from("partner_organizations").select("*").order("created_at", { ascending: false }).limit(100);
    if (!permissions.can_see_structures_list) query = query.in("status", ["pending", "modification_requested"]);
    const { data, error } = await query;
    if (error) throw error;
    add("structures", (data ?? []).map((row: Record<string, unknown>) => ({
      id: String(row.id), target_type: "structure", title: String(row.org_name || row.name || "Structure"),
      subtitle: String(row.org_type || row.organization_type || "Structure"), status: String(row.status || ""),
      created_at: row.created_at ? String(row.created_at) : null,
      permission_key: permissions.can_validate_structure_kyc ? "can_validate_structure_kyc" : (permissions.can_review_structure_requests ? "can_review_structure_requests" : "can_see_structures_list"),
      decision_mode: (permissions.can_validate_structure_kyc || permissions.can_review_structure_requests) ? "recommendation" : "read_only",
    })));
  }

  if (permissions.can_review_structure_codes) {
    const { data, error } = await sb.from("partner_codes").select("*").eq("status", "pending").order("created_at", { ascending: true }).limit(50);
    if (error) throw error;
    add("structure_codes", (data ?? []).map((row: Record<string, unknown>) => ({
      id: String(row.id), target_type: "structure_code", title: String(row.code_name || row.code || "Code Structure"),
      subtitle: row.code ? String(row.code) : null, status: String(row.status || "pending"), created_at: row.created_at ? String(row.created_at) : null,
      permission_key: "can_review_structure_codes", decision_mode: "recommendation", metadata: { organization_id: row.organization_id },
    })));
  }

  if (permissions.can_see_organizers_list) {
    const { data, error } = await sb.from("live_organizer_profiles")
      .select("id,user_id,display_name,verification_status,completed_events,created_at")
      .order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    add("organizers", (data ?? []).map((row) => ({
      id: String(row.id), target_type: "live_organizer_profile", title: String(row.display_name || "Organisateur"),
      subtitle: `${Number(row.completed_events || 0)} événement(s) terminé(s)`, status: String(row.verification_status || ""),
      created_at: row.created_at ? String(row.created_at) : null,
      permission_key: "can_see_organizers_list", decision_mode: "read_only", metadata: { user_id: row.user_id },
    })));
  }

  if (permissions.can_review_live_organizers) {
    const { data, error } = await sb.from("live_organizer_applications")
      .select("id,user_id,display_name,organizer_type,organization_name,status,created_at")
      .in("status", ["pending", "changes_requested"]).order("created_at", { ascending: true }).limit(50);
    if (error) throw error;
    add("live_organizer_applications", (data ?? []).map((row) => ({
      id: String(row.id), target_type: "live_organizer_application", title: String(row.display_name || "Demande organisateur"),
      subtitle: String(row.organization_name || row.organizer_type || "Indépendant"), status: String(row.status || "pending"),
      created_at: row.created_at ? String(row.created_at) : null,
      permission_key: "can_review_live_organizers", decision_mode: "recommendation", metadata: { user_id: row.user_id },
    })));
  }

  if (permissions.can_review_live_events) {
    const { data, error } = await sb.from("live_events")
      .select("id,owner_user_id,owner_structure_id,title,event_type,status,submitted_at,created_at")
      .in("status", ["submitted", "under_review", "changes_requested"]).order("created_at", { ascending: true }).limit(50);
    if (error) throw error;
    add("live_events", (data ?? []).map((row) => ({
      id: String(row.id), target_type: "live_event", title: String(row.title || "Événement Live"), subtitle: String(row.event_type || "Live"),
      status: String(row.status || "submitted"), created_at: row.submitted_at ? String(row.submitted_at) : (row.created_at ? String(row.created_at) : null),
      permission_key: "can_review_live_events", decision_mode: "recommendation",
      metadata: { owner_user_id: row.owner_user_id, owner_structure_id: row.owner_structure_id },
    })));
  }

  if (permissions.can_review_live_reports) {
    const { data, error } = await sb.from("live_content_reports")
      .select("id,event_id,media_id,reporter_user_id,report_type,reason,status,priority,created_at")
      .in("status", ["open", "under_review"]).order("created_at", { ascending: true }).limit(50);
    if (error) throw error;
    add("live_reports", (data ?? []).map((row) => ({
      id: String(row.id), target_type: "live_report", title: `Signalement Live · ${String(row.report_type || "contenu")}`,
      subtitle: String(row.reason || "Motif non renseigné"), status: String(row.status || "open"), created_at: row.created_at ? String(row.created_at) : null,
      permission_key: "can_review_live_reports", decision_mode: "recommendation",
      metadata: { event_id: row.event_id, media_id: row.media_id, reporter_user_id: row.reporter_user_id, priority: row.priority },
    })));
  }

  if (permissions.can_review_live_refunds) {
    const { data, error } = await sb.from("live_refund_requests")
      .select("id,event_id,user_id,requested_amount,reason_code,status,created_at")
      .in("status", ["pending", "under_review"]).order("created_at", { ascending: true }).limit(50);
    if (error) throw error;
    add("live_refunds", (data ?? []).map((row) => ({
      id: String(row.id), target_type: "live_refund", title: `Remboursement · ${Number(row.requested_amount || 0).toLocaleString("fr-FR")} XOF`,
      subtitle: String(row.reason_code || "Demande de remboursement"), status: String(row.status || "pending"), created_at: row.created_at ? String(row.created_at) : null,
      permission_key: "can_review_live_refunds", decision_mode: "recommendation", metadata: { event_id: row.event_id, user_id: row.user_id },
    })));
  }

  if (permissions.can_manage_reports) {
    const { data, error } = await sb.from("forum_reports").select("id,post_id,reported_by,reason,details,status,created_at")
      .eq("status", "pending").order("created_at", { ascending: true }).limit(50);
    if (error) throw error;
    add("general_reports", (data ?? []).map((row) => ({
      id: String(row.id), target_type: "forum_report", title: `Signalement · ${String(row.reason || "Communauté")}`,
      subtitle: String(row.details || "").slice(0, 180) || null, status: String(row.status || "pending"), created_at: row.created_at ? String(row.created_at) : null,
      permission_key: "can_manage_reports", decision_mode: "operational", metadata: { post_id: row.post_id, reported_by: row.reported_by },
    })));
  }

  if (permissions.can_view_ai_conversations) {
    const { data, error } = await sb.from("ai_conversations").select("id,user_id,course_id,created_at,updated_at")
      .order("updated_at", { ascending: false }).limit(50);
    if (error) throw error;
    add("ai_conversations", (data ?? []).map((row) => ({
      id: String(row.id), target_type: "ai_conversation", title: "Conversation IA autorisée — métadonnées",
      subtitle: "Le contenu des messages n’est pas exposé dans la file générale.", status: "metadata_only",
      created_at: row.updated_at ? String(row.updated_at) : (row.created_at ? String(row.created_at) : null),
      permission_key: "can_view_ai_conversations", decision_mode: "read_only", metadata: { user_id: row.user_id, course_id: row.course_id },
    })));
  }

  return queues;
}

async function recommendationConflictContext(sb: ReturnType<typeof createClient>, targetType: string, targetId: string) {
  const owners: string[] = [];
  let found = false;
  if (targetType === "course_certification") {
    const { data, error } = await sb.from("course_certifications").select("requested_by,course_id").eq("id", targetId).maybeSingle();
    if (error) throw error;
    found = !!data;
    if (data?.requested_by) owners.push(String(data.requested_by));
    if (data?.course_id) {
      const { data: course, error: courseError } = await sb.from("courses").select("creator_id,instructor_id").eq("id", data.course_id).maybeSingle();
      if (courseError) throw courseError;
      for (const value of [course?.creator_id, course?.instructor_id]) if (value) owners.push(String(value));
    }
  } else if (targetType === "structure") {
    const { data: organization, error: organizationError } = await sb.from("partner_organizations").select("id").eq("id", targetId).maybeSingle();
    if (organizationError) throw organizationError;
    found = !!organization;
    if (found) {
      const { data, error } = await sb.from("partner_managers").select("user_id").eq("organization_id", targetId);
      if (error) throw error;
      for (const row of data ?? []) if (row.user_id) owners.push(String(row.user_id));
    }
  } else if (targetType === "structure_code") {
    const { data: code, error: codeError } = await sb.from("partner_codes").select("organization_id").eq("id", targetId).maybeSingle();
    if (codeError) throw codeError;
    found = !!code;
    if (code?.organization_id) {
      const { data, error } = await sb.from("partner_managers").select("user_id").eq("organization_id", code.organization_id);
      if (error) throw error;
      for (const row of data ?? []) if (row.user_id) owners.push(String(row.user_id));
    }
  } else if (targetType === "live_event") {
    const { data, error } = await sb.from("live_events").select("owner_user_id").eq("id", targetId).maybeSingle();
    if (error) throw error;
    found = !!data;
    if (data?.owner_user_id) owners.push(String(data.owner_user_id));
  } else if (targetType === "live_report") {
    const { data, error } = await sb.from("live_content_reports").select("reporter_user_id,event_id").eq("id", targetId).maybeSingle();
    if (error) throw error;
    found = !!data;
    if (data?.reporter_user_id) owners.push(String(data.reporter_user_id));
    if (data?.event_id) {
      const { data: event, error: eventError } = await sb.from("live_events").select("owner_user_id").eq("id", data.event_id).maybeSingle();
      if (eventError) throw eventError;
      if (event?.owner_user_id) owners.push(String(event.owner_user_id));
    }
  } else if (targetType === "live_refund") {
    const { data, error } = await sb.from("live_refund_requests").select("user_id,event_id").eq("id", targetId).maybeSingle();
    if (error) throw error;
    found = !!data;
    if (data?.user_id) owners.push(String(data.user_id));
    if (data?.event_id) {
      const { data: event, error: eventError } = await sb.from("live_events").select("owner_user_id").eq("id", data.event_id).maybeSingle();
      if (eventError) throw eventError;
      if (event?.owner_user_id) owners.push(String(event.owner_user_id));
    }
  } else if (targetType === "live_organizer_application") {
    const { data, error } = await sb.from("live_organizer_applications").select("user_id").eq("id", targetId).maybeSingle();
    if (error) throw error;
    found = !!data;
    if (data?.user_id) owners.push(String(data.user_id));
  }
  return { found, owners: [...new Set(owners)] };
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

    const { data: session, error: sessionError } = await sb
      .from("user_sessions")
      .select("user_id")
      .eq("session_token", token)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (sessionError) throw sessionError;
    if (!session) return json({ error: "SESSION_INVALID" }, 401);
    const userId = session.user_id as string;

    const { data: roleRow, error: roleError } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "moderateur")
      .maybeSingle();
    if (roleError) throw roleError;
    if (!roleRow) return json({ error: "FORBIDDEN" }, 403);

    const { data: user } = await sb.from("users").select("id,full_name").eq("id", userId).maybeSingle();
    const access = await getModeratorAccess(sb, userId);
    if (!access.active) return json({ error: "TEAM_ACCESS_SUSPENDED", message: "Votre accès interne est suspendu ou terminé." }, 403);
    const permissions = access.permissions;

    const url = new URL(req.url);
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({})) as Record<string, unknown>;
      const action = String(body.action || "");
      if (action === "update_mission_status") {
        const missionId = String(body.mission_id || "").trim();
        const status = String(body.status || "").trim();
        if (!missionId || !["todo", "in_progress", "completed"].includes(status)) return json({ error: "INVALID_PARAMS" }, 400);
        const { data: mission, error: missionError } = await sb.from("moderator_missions")
          .select("id,title,status")
          .eq("id", missionId)
          .eq("moderator_user_id", userId)
          .maybeSingle();
        if (missionError) throw missionError;
        if (!mission) return json({ error: "MISSION_NOT_FOUND" }, 404);
        const now = new Date().toISOString();
        const { error: updateError } = await sb.from("moderator_missions").update({
          status,
          completed_at: status === "completed" ? now : null,
          updated_at: now,
        }).eq("id", missionId).eq("moderator_user_id", userId);
        if (updateError) throw updateError;
        await appendModeratorTeamAudit(sb, userId, userId, "mission_status_self_updated", null, { mission_id: missionId, from: mission.status, to: status });
        return json({ success: true });
      }
      if (action === "declare_conflict") {
        const targetType = String(body.target_type || "").trim().slice(0, 80);
        const targetId = String(body.target_id || "").trim().slice(0, 160);
        const reason = String(body.reason || "").trim().slice(0, 1200);
        if (!targetType || !targetId || reason.length < 3) return json({ error: "INVALID_PARAMS", message: "Dossier et motif requis." }, 400);
        const { data: existing, error: existingError } = await sb.from("moderator_conflicts")
          .select("id")
          .eq("moderator_user_id", userId)
          .eq("target_type", targetType)
          .eq("target_id", targetId)
          .eq("status", "active")
          .maybeSingle();
        if (existingError) throw existingError;
        if (existing) return json({ error: "CONFLICT_ALREADY_DECLARED", conflict_id: existing.id }, 409);
        const { data: conflict, error: conflictError } = await sb.from("moderator_conflicts").insert({
          moderator_user_id: userId,
          target_type: targetType,
          target_id: targetId,
          reason,
          declared_by: userId,
        }).select("id").single();
        if (conflictError) throw conflictError;
        await appendModeratorTeamAudit(sb, userId, userId, "conflict_declared", reason, { conflict_id: conflict.id, target_type: targetType, target_id: targetId });
        return json({ success: true, conflict_id: conflict.id }, 201);
      }
      if (action === "create_review_recommendation") {
        const targetType = String(body.target_type || "").trim().slice(0, 80);
        const targetId = String(body.target_id || "").trim().slice(0, 160);
        const recommendation = String(body.recommendation || "").trim();
        const note = String(body.note || "").trim().slice(0, 2000);
        const permissionByTarget: Record<string, string> = {
          course_certification: "can_manage_course_certifications",
          structure: permissions.can_validate_structure_kyc ? "can_validate_structure_kyc" : "can_review_structure_requests",
          structure_code: "can_review_structure_codes",
          live_event: "can_review_live_events",
          live_report: "can_review_live_reports",
          live_refund: "can_review_live_refunds",
          live_organizer_application: "can_review_live_organizers",
        };
        const permissionKey = permissionByTarget[targetType];
        if (!targetType || !targetId || !permissionKey || !permissions[permissionKey] || !["approve", "reject", "changes_requested", "reviewed", "escalate"].includes(recommendation)) {
          return json({ error: "FORBIDDEN_OR_INVALID_RECOMMENDATION" }, 403);
        }
        const context = await recommendationConflictContext(sb, targetType, targetId);
        if (!context.found) return json({ error: "TARGET_NOT_FOUND" }, 404);
        if (await hasModeratorConflict(sb, userId, targetType, targetId, context.owners)) {
          return json({ error: "CONFLICT_OF_INTEREST", message: "Ce dossier est bloqué en raison d’un conflit d’intérêts." }, 409);
        }
        const { data: existing, error: existingError } = await sb.from("moderator_review_recommendations")
          .select("id").eq("moderator_user_id", userId).eq("target_type", targetType).eq("target_id", targetId).eq("status", "pending").maybeSingle();
        if (existingError) throw existingError;
        if (existing) return json({ error: "RECOMMENDATION_ALREADY_PENDING", recommendation_id: existing.id }, 409);
        const { data: created, error: createError } = await sb.from("moderator_review_recommendations").insert({
          moderator_user_id: userId, permission_key: permissionKey, target_type: targetType, target_id: targetId, recommendation, note: note || null,
        }).select("id").single();
        if (createError) throw createError;
        await sb.from("moderation_log").insert({ moderator_id: userId, action_type: "review_recommendation_submitted", target_type: targetType, target_id: targetId, comment: `${recommendation}${note ? ` | ${note}` : ""}` });
        await appendModeratorTeamAudit(sb, userId, userId, "review_recommendation_submitted", note || null, { recommendation_id: created.id, target_type: targetType, target_id: targetId, recommendation, permission_key: permissionKey });
        return json({ success: true, recommendation_id: created.id }, 201);
      }
      if (action === "take_assisted_request" || action === "complete_assisted_request") {
        if (!permissions.can_create_assisted_course) return json({ error: "FORBIDDEN" }, 403);
        const requestId = String(body.request_id || "").trim();
        if (!requestId) return json({ error: "INVALID_PARAMS" }, 400);
        const { data: requestRow, error: requestError } = await sb.from("assisted_course_requests")
          .select("id,course_id,requester_id,status,assigned_to").eq("id", requestId).maybeSingle();
        if (requestError) throw requestError;
        if (!requestRow) return json({ error: "REQUEST_NOT_FOUND" }, 404);
        if (await hasModeratorConflict(sb, userId, "assisted_course_request", requestId, [String(requestRow.requester_id || "")])) {
          return json({ error: "CONFLICT_OF_INTEREST" }, 409);
        }
        const now = new Date().toISOString();
        if (action === "take_assisted_request") {
          if (requestRow.assigned_to && String(requestRow.assigned_to) !== userId) return json({ error: "ALREADY_ASSIGNED" }, 409);
          const { error } = await sb.from("assisted_course_requests").update({ assigned_to: userId, status: "in_progress", started_at: now, updated_at: now }).eq("id", requestId).in("status", ["pending", "in_progress"]);
          if (error) throw error;
        } else {
          if (String(requestRow.assigned_to || "") !== userId) return json({ error: "NOT_ASSIGNED_TO_YOU" }, 403);
          if (!["in_progress", "changes_requested"].includes(String(requestRow.status || ""))) return json({ error: "INVALID_STATUS" }, 409);
          const { error } = await sb.from("assisted_course_requests").update({ status: "draft_ready", draft_ready_at: now, last_returned_at: now, updated_at: now }).eq("id", requestId).eq("assigned_to", userId);
          if (error) throw error;
          if (requestRow.course_id) await sb.from("courses").update({ assisted_status: "draft_ready", updated_at: now }).eq("id", requestRow.course_id);
        }
        await appendModeratorTeamAudit(sb, userId, userId, action, null, { assisted_request_id: requestId });
        return json({ success: true });
      }
      if (action === "triage_forum_report") {
        if (!permissions.can_manage_reports) return json({ error: "FORBIDDEN" }, 403);
        const reportId = String(body.report_id || "").trim();
        if (!reportId) return json({ error: "INVALID_PARAMS" }, 400);
        const { data: report, error: reportError } = await sb.from("forum_reports").select("id,post_id,reported_by,status").eq("id", reportId).maybeSingle();
        if (reportError) throw reportError;
        if (!report) return json({ error: "REPORT_NOT_FOUND" }, 404);
        const { data: post } = await sb.from("forum_posts").select("user_id").eq("id", report.post_id).maybeSingle();
        if (await hasModeratorConflict(sb, userId, "forum_report", reportId, [String(report.reported_by || ""), String(post?.user_id || "")])) return json({ error: "CONFLICT_OF_INTEREST" }, 409);
        const { error } = await sb.from("forum_reports").update({ status: "reviewed", reviewed_by: userId }).eq("id", reportId).eq("status", "pending");
        if (error) throw error;
        await sb.from("moderation_log").insert({ moderator_id: userId, action_type: "forum_report_triaged", target_type: "forum_report", target_id: reportId, comment: String(body.note || "").slice(0, 1000) || null });
        return json({ success: true });
      }
      return json({ error: "UNKNOWN_ACTION" }, 400);
    }
    if (url.searchParams.get("analytics") === "1") {
      if (!permissions.can_view_analytics) {
        return json({ error: "FORBIDDEN", message: "Permission analytique requise.", permissions }, 403);
      }

      const since = new Date();
      since.setUTCDate(since.getUTCDate() - 30);
      const { data: moderationRows, error: moderationError } = await sb
        .from("moderation_log")
        .select("action_type,target_type,created_at")
        .eq("moderator_id", userId)
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: true });
      if (moderationError) throw moderationError;

      const decisionsByDay = new Map<string, { date: string; total: number; approved: number; rejected: number }>();
      const actionsByType = new Map<string, number>();
      const kycByWeek = new Map<string, number>();

      for (const row of moderationRows ?? []) {
        const action = String(row.action_type || "");
        const createdAt = String(row.created_at || "");
        if (!createdAt) continue;
        const day = dateKey(createdAt);
        const item = decisionsByDay.get(day) ?? { date: day, total: 0, approved: 0, rejected: 0 };
        item.total += 1;
        if (/reject|remove|suspend/i.test(action)) item.rejected += 1;
        else if (/approve|validate|transmit|restore|reactivate/i.test(action)) item.approved += 1;
        decisionsByDay.set(day, item);
        actionsByType.set(action, (actionsByType.get(action) ?? 0) + 1);
        if (action.startsWith("kyc_")) {
          const week = weekKey(createdAt);
          kycByWeek.set(week, (kycByWeek.get(week) ?? 0) + 1);
        }
      }

      let ticketsByStatus: Array<{ status: string; count: number }> = [];
      if (permissions.can_manage_support) {
        const { data: tickets, error: ticketsError } = await sb.from("support_tickets").select("status");
        if (ticketsError) throw ticketsError;
        const counts = new Map<string, number>();
        for (const ticket of tickets ?? []) {
          const status = String(ticket.status || "non renseigné");
          counts.set(status, (counts.get(status) ?? 0) + 1);
        }
        ticketsByStatus = [...counts.entries()].map(([status, count]) => ({ status, count }));
      }

      let forumBySpace: Array<{ space: string; posts: number; flagged: number }> = [];
      if (permissions.can_moderate_forum) {
        const { data: posts, error: postsError } = await sb
          .from("forum_posts")
          .select("space,is_flagged")
          .gte("created_at", since.toISOString());
        if (postsError) throw postsError;
        const spaces = new Map<string, { posts: number; flagged: number }>();
        for (const post of posts ?? []) {
          const space = String(post.space || "Général");
          const current = spaces.get(space) ?? { posts: 0, flagged: 0 };
          current.posts += 1;
          if (post.is_flagged === true) current.flagged += 1;
          spaces.set(space, current);
        }
        forumBySpace = [...spaces.entries()].map(([space, values]) => ({ space, ...values }));
      }

      return json({
        permissions,
        analytics: {
          decisions_by_day: [...decisionsByDay.values()],
          actions_by_type: [...actionsByType.entries()]
            .map(([action, count]) => ({ action: actionLabel(action), count }))
            .sort((a, b) => b.count - a.count),
          tickets_by_status: ticketsByStatus,
          kyc_by_week: [...kycByWeek.entries()].map(([week, professeurs]) => ({ week, professeurs })),
          forum_by_space: forumBySpace,
        },
      });
    }

    const { data: protectedRows } = await sb
      .from("user_roles")
      .select("user_id")
      .in("role", ["super_admin", "moderateur"]);
    const protectedIds = (protectedRows ?? []).map((row) => String(row.user_id));

    const kpis: Array<{ key: string; label: string; value: number }> = [];
    if (permissions.can_see_pending_courses) {
      const { count } = await sb.from("courses").select("*", { count: "exact", head: true }).eq("status", "en_attente_validation_manuelle");
      kpis.push({ key: "courses", label: "Formations en attente", value: count ?? 0 });
    }
    if (permissions.can_validate_professor_kyc) {
      const { count } = await sb.from("professeur_profiles").select("*", { count: "exact", head: true }).eq("kyc_status", "en_attente");
      kpis.push({ key: "professor_kyc", label: "KYC Professeur en attente", value: count ?? 0 });
    }
    if (permissions.can_see_learners_list) {
      let query = sb.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "apprenant");
      if (protectedIds.length) query = query.not("user_id", "in", `(${protectedIds.join(",")})`);
      const { count } = await query;
      kpis.push({ key: "learners", label: "Apprenants", value: count ?? 0 });
    }
    if (permissions.can_see_professors_list) {
      let query = sb.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "professeur");
      if (protectedIds.length) query = query.not("user_id", "in", `(${protectedIds.join(",")})`);
      const { count } = await query;
      kpis.push({ key: "professors", label: "Professeurs", value: count ?? 0 });
    }
    if (permissions.can_moderate_forum) {
      const { count } = await sb.from("forum_posts").select("*", { count: "exact", head: true }).eq("is_flagged", true).eq("is_visible", true);
      kpis.push({ key: "forum", label: "Publications signalées", value: count ?? 0 });
    }
    if (permissions.can_moderate_jobs) {
      const { count } = await sb.from("job_offers").select("*", { count: "exact", head: true }).eq("status", "pending_moderation");
      kpis.push({ key: "jobs", label: "Offres en attente", value: count ?? 0 });
    }
    if (permissions.can_manage_support) {
      const { count } = await sb.from("support_tickets").select("*", { count: "exact", head: true }).eq("status", "open");
      kpis.push({ key: "support", label: "Tickets ouverts", value: count ?? 0 });
    }

    const queue: Array<{ id: string; type: string; title: string; created_at: string; priority_label: string; link: string }> = [];
    if (permissions.can_see_pending_courses) {
      const { data: courses } = await sb.from("courses").select("id,title,created_at").eq("status", "en_attente_validation_manuelle").order("created_at", { ascending: true }).limit(5);
      for (const course of courses ?? []) queue.push({ id: `course:${course.id}`, type: "course", title: String(course.title || "Formation sans titre"), created_at: String(course.created_at), priority_label: "Haute", link: "/moderator/courses" });
    }
    if (permissions.can_validate_professor_kyc) {
      const { data: profiles } = await sb.from("professeur_profiles").select("user_id,expertise_domain,created_at").eq("kyc_status", "en_attente").order("created_at", { ascending: true }).limit(3);
      for (const profile of profiles ?? []) queue.push({ id: `kyc:${profile.user_id}`, type: "kyc_prof", title: `KYC Professeur — ${String(profile.expertise_domain || "Domaine non renseigné")}`, created_at: String(profile.created_at), priority_label: "Haute", link: "/moderator/kyc" });
    }
    if (permissions.can_moderate_jobs) {
      const { data: jobs } = await sb.from("job_offers").select("id,title,created_at").eq("status", "pending_moderation").order("created_at", { ascending: true }).limit(3);
      for (const job of jobs ?? []) queue.push({ id: `job:${job.id}`, type: "job", title: String(job.title || "Offre sans titre"), created_at: String(job.created_at), priority_label: "Normale", link: "/moderator/jobs" });
    }
    if (permissions.can_manage_support) {
      const { data: tickets } = await sb.from("support_tickets").select("id,subject,created_at").eq("status", "open").order("created_at", { ascending: true }).limit(3);
      for (const ticket of tickets ?? []) queue.push({ id: `support:${ticket.id}`, type: "support", title: String(ticket.subject || "Ticket support"), created_at: String(ticket.created_at), priority_label: "Normale", link: "/moderator/support" });
    }
    if (permissions.can_moderate_forum) {
      const { data: posts } = await sb.from("forum_posts").select("id,title,content,created_at").eq("is_flagged", true).eq("is_visible", true).order("created_at", { ascending: true }).limit(3);
      for (const post of posts ?? []) queue.push({ id: `forum:${post.id}`, type: "forum", title: String(post.title || post.content || "Publication signalée").slice(0, 90), created_at: String(post.created_at), priority_label: "Normale", link: "/moderator/forum" });
    }
    queue.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data: decisionRows, error: decisionsError } = await sb
      .from("moderation_log")
      .select("id,action_type,target_type,created_at")
      .eq("moderator_id", userId)
      .gte("created_at", todayStart.toISOString())
      .order("created_at", { ascending: false })
      .limit(20);
    if (decisionsError) throw decisionsError;

    const activePermissionKeys = Object.keys(EMPTY_PERMS).filter(key => !["can_validate_course_price", "can_transmit_course_to_admin", "can_validate_establishment_kyc", "can_suspend_account"].includes(key));
    const [{ data: missions, error: missionsError }, { data: conflicts, error: conflictsError }] = await Promise.all([
      sb.from("moderator_missions")
        .select("id,title,description,domain,priority,status,starts_at,due_at,completed_at,created_at,updated_at")
        .eq("moderator_user_id", userId)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false }),
      sb.from("moderator_conflicts")
        .select("id,target_type,target_id,reason,status,created_at")
        .eq("moderator_user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false }),
    ]);
    if (missionsError) throw missionsError;
    if (conflictsError) throw conflictsError;

    const controlQueues = await loadControlQueues(sb, userId, permissions);
    const { data: myRecommendations, error: recommendationsError } = await sb.from("moderator_review_recommendations")
      .select("id,permission_key,target_type,target_id,recommendation,note,status,created_at,reviewed_at")
      .eq("moderator_user_id", userId).order("created_at", { ascending: false }).limit(100);
    if (recommendationsError) throw recommendationsError;

    return json({
      moderator: user,
      profile: access.profile,
      permissions,
      permanent_permissions: access.permanentPermissions,
      delegations: access.delegations,
      missions: missions ?? [],
      conflicts: conflicts ?? [],
      control_queues: controlQueues,
      review_recommendations: myRecommendations ?? [],
      kpis,
      priority_queue: queue.slice(0, 10),
      todays_decisions: decisionRows ?? [],
      has_any_permission: activePermissionKeys.some((key) => permissions[key] === true),
    });
  } catch (error) {
    console.error("[dashboard-moderateur]", error);
    return json({ error: "SERVER_ERROR", message: error instanceof Error ? error.message : String(error) }, 500);
  }
});
