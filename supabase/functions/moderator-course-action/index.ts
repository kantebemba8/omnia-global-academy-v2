import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { sendOmniaEmail } from "../_shared/brevo-mail.ts";
import { dispatchOmniaInAppNotification } from "../_shared/notifications.ts";
import { getModeratorAccess, hasModeratorConflict } from "../_shared/moderator-access.ts";

import { getActiveOmniaSessionResult } from "../_shared/omnia-auth.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type SupabaseClient = ReturnType<typeof createClient>;
type PermissionMap = Record<string, boolean>;

function normalizePermissions(row: Record<string, unknown> | null): PermissionMap {
  const nested = row?.permissions && typeof row.permissions === "object" && !Array.isArray(row.permissions)
    ? row.permissions as Record<string, unknown>
    : {};
  const enabled = (canonical: string, legacy?: string) => nested[canonical] === true || row?.[canonical] === true || (!!legacy && (nested[legacy] === true || row?.[legacy] === true));
  const recommendPrice = enabled("can_recommend_course_price", "can_validate_course_price");
  const transmit = enabled("can_approve_transmit_course", "can_transmit_course_to_admin");
  return {
    can_see_pending_courses: enabled("can_see_pending_courses"),
    can_review_course_content: enabled("can_review_course_content"),
    can_request_course_modification: enabled("can_request_course_modification"),
    can_recommend_course_price: recommendPrice,
    can_validate_course_price: recommendPrice,
    can_reject_course: enabled("can_reject_course"),
    can_approve_transmit_course: transmit,
    can_transmit_course_to_admin: transmit,
  };
}

async function verifyModerator(sb: SupabaseClient, token: string) {
  const { data: session, error: sessionError } = await getActiveOmniaSessionResult(sb, token);
  if (sessionError || !session) return null;

  const { data: role, error: roleError } = await sb
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user_id)
    .eq("role", "moderateur")
    .maybeSingle();
  if (roleError || !role) return null;
  return String(session.user_id);
}

async function notifyInstructor(
  sb: SupabaseClient,
  instructorId: string,
  params: Record<string, string>,
) {
  const { data: instructor } = await sb.from("users").select("email,full_name").eq("id", instructorId).maybeSingle();
  if (!instructor?.email) return;
  const status = params.STATUS === "rejetee" ? "Formation non validée" : "Modifications demandées";
  const comment = params.REASON || params.COMMENT || "";
  await sendOmniaEmail({
    sb,
    userId: instructorId,
    to: { email: String(instructor.email), name: String(instructor.full_name || "") || undefined },
    templateKey: "status_update",
    params: {
      PRENOM: instructor.full_name || "",
      FORMATION_TITRE: params.COURSE_TITLE || "Formation",
      STATUT: status,
      MESSAGE_SPECIFIQUE: params.STATUS === "rejetee"
        ? "Votre formation n’a pas été validée. Consultez le motif avant de poursuivre."
        : "Des modifications sont nécessaires avant la prochaine étape de validation.",
      COMMENTAIRE: comment,
      ACTION_URL: `${(Deno.env.get("APP_URL") || "https://omniaglobalacademy.com").replace(/\/$/, "")}/professeur/formations`,
    },
  });
  await dispatchOmniaInAppNotification({
    userId: instructorId,
    notificationType: params.STATUS === "rejetee" ? "course_rejected" : "course_changes_requested",
    title: status,
    message: comment || (params.STATUS === "rejetee"
      ? "Votre formation n’a pas été validée. Consultez le motif avant de poursuivre."
      : "Des modifications sont nécessaires avant la prochaine étape de validation."),
    actionUrl: "/professeur/formations",
    priority: "high",
    payload: { domain: "formations", status: params.STATUS || "changes_requested" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (!["GET", "POST"].includes(req.method)) return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const url = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!url || !serviceKey) return json({ error: "SERVER_CONFIG_ERROR" }, 500);
    const sb = createClient(url, serviceKey);
    const moderatorId = await verifyModerator(sb, token);
    if (!moderatorId) return json({ error: "FORBIDDEN" }, 403);

    const access = await getModeratorAccess(sb, moderatorId);
    if (!access.active) return json({ error: "TEAM_ACCESS_SUSPENDED", message: "Votre accès interne est suspendu ou terminé." }, 403);
    const permissions = access.permissions;

    if (req.method === "GET") {
      if (!permissions.can_see_pending_courses) {
        return json({ error: "FORBIDDEN", message: "Permission de consultation des formations requise." }, 403);
      }

      const { data: courses, error: coursesError } = await sb
        .from("courses")
        .select("id,title,description,category,level,status,pricing_engine_version,pricing_recommended_xof,pricing_range_min_xof,pricing_range_max_xof,moderator_price_recommendation_xof,desired_price_amount,price_xof,requested_cpd,final_validation_type,instructor_id,created_at,admin_comment,rejection_reason,examen_oral_statut,examen_oral_consignes,examen_oral_justification_moderateur")
        .in("status", ["en_attente_validation_manuelle", "validee", "rejetee", "modification_demandee"])
        .order("created_at", { ascending: true });
      if (coursesError) throw coursesError;

      const instructorIds = [...new Set((courses || []).map((course: Record<string, unknown>) => course.instructor_id).filter(Boolean).map(String))];
      const { data: instructors, error: instructorsError } = instructorIds.length
        ? await sb.from("users").select("id,full_name,email").in("id", instructorIds)
        : { data: [], error: null };
      if (instructorsError) throw instructorsError;
      const instructorsById = new Map<string, Record<string, unknown>>((instructors || []).map((user: Record<string, unknown>) => [String(user.id), user]));

      const enriched = await Promise.all((courses || []).map(async (course: Record<string, unknown>) => {
        const courseId = String(course.id);
        const { data: modules, error: modulesError } = await sb.from("modules").select("id,title,position").eq("course_id", courseId).order("position");
        if (modulesError) throw modulesError;
        const moduleIds = (modules || []).map((module: { id: string }) => String(module.id));
        const { data: lessons, error: lessonsError } = moduleIds.length
          ? await sb.from("lessons").select("id,title,position,module_id").in("module_id", moduleIds).order("position")
          : { data: [], error: null };
        if (lessonsError) throw lessonsError;
        const instructor = instructorsById.get(String(course.instructor_id)) || ({} as Record<string, unknown>);

        return {
          ...course,
          instructor_name: String(instructor.full_name || "—"),
          instructor_email: String(instructor.email || "—"),
          price: course.price_xof ?? course.pricing_recommended_xof ?? null,
          modules_count: (modules || []).length,
          lessons_count: (lessons || []).length,
          modules: (modules || []).map((module: Record<string, unknown>) => ({
            ...module,
            lessons: (lessons || []).filter((lesson: Record<string, unknown>) => String(lesson.module_id) === String(module.id)),
          })),
        };
      }));

      return json({ courses: enriched, permissions });
    }

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const courseId = String(body.course_id || "");
    const action = String(body.action || "");
    const comment = String(body.comment || "").trim();
    if (!courseId || !action) return json({ error: "MISSING_FIELDS" }, 400);

    const requiredPermission: Record<string, string> = {
      set_price: "can_recommend_course_price",
      reject: "can_reject_course",
      request_modification: "can_request_course_modification",
      transmit_to_admin: "can_approve_transmit_course",
      confirm_oral_exam: "can_review_course_content",
      recommend_oral_exam: "can_review_course_content",
    };
    const permissionKey = requiredPermission[action];
    if (!permissionKey) return json({ error: "INVALID_ACTION" }, 400);
    if (!permissions[permissionKey]) return json({ error: "FORBIDDEN", message: `Permission ${permissionKey} requise.` }, 403);

    const { data: course, error: courseError } = await sb
      .from("courses")
      .select("id,title,instructor_id,status,category,examen_oral_statut")
      .eq("id", courseId)
      .maybeSingle();
    if (courseError) throw courseError;
    if (!course) return json({ error: "COURSE_NOT_FOUND" }, 404);
    if (await hasModeratorConflict(sb, moderatorId, "course", courseId, [String(course.instructor_id)])) {
      return json({ error: "CONFLICT_OF_INTEREST", message: "Ce dossier est bloqué pour conflit d’intérêts. Il doit être réattribué par l’Administration Omnia." }, 403);
    }

    const now = new Date().toISOString();
    const update: Record<string, unknown> = { moderated_by: moderatorId, moderated_at: now };
    let logAction = action;
    const notificationParams: Record<string, string> = { COURSE_TITLE: String(course.title || "Formation") };
    let shouldNotify = false;

    if (action === "set_price") {
      const price = Number(body.price_xof);
      if (!Number.isFinite(price) || price < 0) return json({ error: "INVALID_PRICE" }, 400);
      update.moderator_price_recommendation_xof = Math.round(price);
      logAction = "course_price_recommended_v3";
    } else if (action === "reject") {
      if (!comment) return json({ error: "COMMENT_REQUIRED" }, 400);
      update.status = "rejetee";
      update.rejection_reason = comment;
      logAction = "course_rejected";
      notificationParams.STATUS = "rejetee";
      notificationParams.REASON = comment;
      shouldNotify = true;
    } else if (action === "request_modification") {
      if (!comment) return json({ error: "COMMENT_REQUIRED" }, 400);
      update.status = "modification_demandee";
      update.admin_comment = comment;
      logAction = "course_modification_requested";
      notificationParams.STATUS = "modification_demandee";
      notificationParams.COMMENT = comment;
      shouldNotify = true;
    } else if (action === "transmit_to_admin") {
      // La transmission ne valide ni ne publie la formation : la décision finale reste côté Administration Omnia.
      update.rejection_reason = null;
      logAction = "course_transmitted_to_admin";
    } else if (action === "confirm_oral_exam") {
      if (course.category !== "Langues & Linguistique" || course.examen_oral_statut === "non_propose") {
        return json({ error: "ORAL_EXAM_NOT_PROPOSED" }, 409);
      }
      update.examen_oral_statut = "confirme";
      logAction = "oral_exam_confirmed";
    } else if (action === "recommend_oral_exam") {
      if (course.category !== "Langues & Linguistique") return json({ error: "ORAL_EXAM_NOT_APPLICABLE" }, 409);
      update.examen_oral_statut = "recommande_par_moderateur";
      update.examen_oral_justification_moderateur = String(body.justification || "").trim() || null;
      logAction = "oral_exam_recommended";
    }

    const { error: updateError } = await sb.from("courses").update(update).eq("id", courseId);
    if (updateError) throw updateError;

    const { error: logError } = await sb.from("moderation_log").insert({
      moderator_id: moderatorId,
      action_type: logAction,
      target_type: "course",
      target_id: courseId,
      comment: comment || String(body.justification || "").trim() || null,
    });
    if (logError) console.error("moderator-course-action: log failed", logError.message);

    if (shouldNotify) await notifyInstructor(sb, String(course.instructor_id), notificationParams);

    const messages: Record<string, string> = {
      set_price: "Prix recommandé enregistré.",
      reject: "Formation rejetée.",
      request_modification: "Demande de modification envoyée.",
      transmit_to_admin: "Formation transmise à l’Administration Omnia pour décision finale.",
      confirm_oral_exam: "Examen oral confirmé.",
      recommend_oral_exam: "Recommandation transmise à l’Administration Omnia.",
    };
    return json({ success: true, message: messages[action] || "Action effectuée." });
  } catch (error) {
    console.error("moderator-course-action", error);
    return json({ error: "SERVER_ERROR", message: error instanceof Error ? error.message : String(error) }, 500);
  }
});
