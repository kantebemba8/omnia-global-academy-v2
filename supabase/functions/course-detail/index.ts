import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { corsHeaders } from "../_shared/cors.ts";

import { getActiveOmniaSessionResult } from "../_shared/omnia-auth.ts";
import { canPreviewCourse } from "../_shared/course-preview-access.ts";
import { loadCourseCurriculum } from "../_shared/course-curriculum.ts";
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "GET") return json({ success: false, message: "Method not allowed" }, 405);

  const url = new URL(req.url);
  const courseId = url.searchParams.get("id");
  const previewMode = String(url.searchParams.get("preview") ?? "").toLowerCase();
  const previewRequested = ["visitor", "learner", "admin"].includes(previewMode);
  if (!courseId) return json({ success: false, message: "id requis" }, 400);

  // Optional auth
  const authHeader = req.headers.get("Authorization") ?? "";
  const sessionToken = authHeader.replace(/^Bearer\s+/i, "").trim();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ── Course ──────────────────────────────────────────────────────────────
    let previewAllowed = false;
    let viewerId: string | null = null;
    if (sessionToken) {
      const { data: sess } = await getActiveOmniaSessionResult(supabase, sessionToken);
      viewerId = sess?.user_id ?? null;
    }

    const courseSelect =
      "id, title, short_description, long_description, cover_image_url, " +
      "preview_video_url, category, level, price_xof, is_free, cpd_hours, " +
      "cpd_accredited, cpd_provider_code, average_rating, total_reviews, " +
      "total_students, language, subtitles_available, prerequisites, target_audience, learning_outcomes, course_intro_title, course_intro_summary, " +
      "objectives, creator_type, creator_id, creator_context, establishment_id, " +
      "total_duration_seconds, is_published, learning_design_settings, free_preview_mode, preview_first_lesson_enabled, " +
      "lesson_passing_score, module_passing_score, final_passing_score, is_catalog_active, is_current_catalog_version, training_delivery_mode";

    let courseQuery = supabase.from("courses").select(courseSelect).eq("id", courseId);
    if (previewRequested && viewerId) {
      previewAllowed = await canPreviewCourse(supabase, viewerId, courseId, "can_edit_courses");
      if (!previewAllowed) return json({ success: false, error: "PREVIEW_FORBIDDEN", message: "Prévisualisation non autorisée" }, 403);
    } else {
      courseQuery = courseQuery.eq("is_published", true).eq("is_catalog_active", true).eq("is_current_catalog_version", true);
    }
    const { data: course, error: courseErr } = await courseQuery.maybeSingle();
    if (courseErr) throw courseErr;
    if (!course) return json({ success: false, message: "Formation introuvable" }, 404);

    // ── Creator ─────────────────────────────────────────────────────────────
    let creator: Record<string, unknown> = {};
    if (course.creator_type === "plateforme" || String(course.creator_context || "") === "super_admin") {
      creator = { id: null, full_name: "Omnia Global Academy", bio: "Formation créée et publiée par Omnia Global Academy.", expertise_domain: null, avatar_url: "/omnia-sidebar-logo.png", logo_url: "/omnia-sidebar-logo.png", public_creator_type: "plateforme" };
    } else if (course.creator_type === "etablissement" && course.establishment_id) {
      const { data: ep } = await supabase
        .from("etablissement_profiles")
        .select("id, school_name, logo_url, director_name")
        .eq("id", course.establishment_id)
        .maybeSingle();
      creator = ep ?? {};
    } else if (course.creator_id) {
      const [{ data: u }, { data: pp }] = await Promise.all([
        supabase.from("users").select("id, full_name, avatar_url").eq("id", course.creator_id).maybeSingle(),
        supabase.from("professeur_profiles").select("bio, expertise_domain").eq("user_id", course.creator_id).maybeSingle(),
      ]);
      creator = { ...(u ?? {}), bio: pp?.bio ?? null, expertise_domain: pp?.expertise_domain ?? null };
    }

    // ── Modules + lessons ───────────────────────────────────────────────────
    const curriculum = await loadCourseCurriculum(supabase, courseId);
    const modules = curriculum.modules;
    const lessons = curriculum.lessons;
    if (curriculum.orphanLessonIds.length) console.warn("course-detail orphan lessons", courseId, curriculum.orphanLessonIds);

    const lessonsByModule: Record<string, unknown[]> = {};
    for (const l of lessons ?? []) {
      const ml = l as Record<string, unknown>;
      const mid = ml.module_id as string;
      if (!lessonsByModule[mid]) lessonsByModule[mid] = [];
      lessonsByModule[mid].push({
        id: ml.id, title: ml.title, position: ml.position,
        is_free_preview: ml.is_free_preview,
        cpd_calculated_time_seconds: ml.cpd_calculated_time_seconds,
        duration_seconds: ml.cpd_calculated_time_seconds,
        is_external: ml.is_external,
        is_intro: ml.is_intro, is_module_intro: ml.is_module_intro, is_conclusion: ml.is_conclusion, is_final_exam: ml.is_final_exam, is_required: ml.is_required,
        stage_type: ml.stage_type || (ml.is_intro ? "introduction" : ml.is_module_intro ? "module_presentation" : ml.is_conclusion ? "conclusion" : ml.is_final_exam ? "final_exam" : "lesson"),
        has_video: !!ml.video_url,
        has_audio: !!ml.audio_url,
      });
    }

    const modulesWithLessons = (modules ?? []).map(m => ({
      ...m,
      lessons: lessonsByModule[m.id] ?? [],
    }));

    // ── Free preview lesson (full content) ──────────────────────────────────
    const firstRealModule = modulesWithLessons.find((m: any) => String(m.section_type || (m.is_intro ? "introduction" : m.is_conclusion ? "conclusion" : m.is_final_exam ? "final_exam" : "module")) === "module");
    const firstLessonMeta = ((firstRealModule?.lessons as Record<string, unknown>[]) || []).find((l: any) => String(l.stage_type || "lesson") === "lesson");
    let freePrevLesson: unknown = null;
    let freePrevLessonId: string | null = null;

    if (firstLessonMeta?.id) {
      freePrevLessonId = firstLessonMeta.id as string;
      const { data: fl } = await supabase
        .from("course_lessons")
        .select("id, title, content_text, video_url, audio_url, lesson_summary")
        .eq("id", freePrevLessonId)
        .maybeSingle();
      freePrevLesson = fl;
    }

    // ── Reviews (5 most recent visible) ─────────────────────────────────────
    const { data: reviews } = await supabase
      .from("course_reviews")
      .select("id, rating, comment, created_at, user_id")
      .eq("course_id", courseId)
      .eq("is_visible", true)
      .order("created_at", { ascending: false })
      .limit(5);

    // Reviewer initials
    const reviewerIds = (reviews ?? []).map(r => r.user_id);
    const { data: reviewUsers } = reviewerIds.length > 0
      ? await supabase.from("users").select("id, full_name").in("id", reviewerIds)
      : { data: [] };

    const reviewUserMap: Record<string, string> = {};
    for (const u of reviewUsers ?? []) reviewUserMap[u.id] = u.full_name;

    const reviewsWithInitials = (reviews ?? []).map(r => ({
      id: r.id, rating: r.rating, comment: r.comment, created_at: r.created_at,
      reviewer_initials: (reviewUserMap[r.user_id] ?? "??")
        .split(" ").slice(0, 2).map((w: string) => w[0]?.toUpperCase() ?? "").join(""),
    }));

    // Rating distribution
    const { data: allRatings } = await supabase
      .from("course_reviews")
      .select("rating")
      .eq("course_id", courseId)
      .eq("is_visible", true);

    const dist: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    for (const r of allRatings ?? []) dist[r.rating] = (dist[r.rating] ?? 0) + 1;
    const totalRatings = allRatings?.length ?? 0;
    const ratingDist = [5, 4, 3, 2, 1].map(s => ({
      stars: s,
      count: dist[s] ?? 0,
      pct: totalRatings > 0 ? Math.round(((dist[s] ?? 0) / totalRatings) * 100) : 0,
    }));

    // ── Validated certifications and partners ───────────────────────────────
    const { data: certifications, error: certificationsError } = await supabase
      .from("course_certifications")
      .select(
        "id,certification_type,organization_name,certification_name,certification_code," +
        "credit_value,credit_unit,logo_url,badge_url,verification_url,partner_website_url," +
        "display_on_course,display_on_certificate,immutable_asset_snapshot,valid_from,expires_at"
      )
      .eq("course_id", courseId)
      .eq("status", "validated")
      .eq("display_on_course", true)
      .order("created_at");

    if (certificationsError) throw certificationsError;

    const publicCertifications = (certifications ?? []).map((item: Record<string, unknown>) => {
      const snapshot = (item.immutable_asset_snapshot && typeof item.immutable_asset_snapshot === "object")
        ? item.immutable_asset_snapshot as Record<string, unknown>
        : {};
      return {
        id: item.id,
        certification_type: item.certification_type,
        organization_name: item.organization_name,
        certification_name: item.certification_name,
        certification_code: item.certification_code,
        credit_value: item.credit_value,
        credit_unit: item.credit_unit,
        logo_url: snapshot.course_logo_url || snapshot.logo_url || item.logo_url || item.badge_url || null,
        verification_url: item.verification_url || null,
        website_url: snapshot.website_url || item.partner_website_url || null,
        valid_from: item.valid_from,
        expires_at: item.expires_at,
        display_on_certificate: item.display_on_certificate !== false,
      };
    });

    // ── Lives / Replays inclus dans cette formation ──────────────────────────
    const { data: liveLinks, error: liveLinksError } = await supabase
      .from("course_live_content_links")
      .select("id,event_id,media_id,title_override,position,required,live_events(id,title,delivery_type,status,starts_at,organizer_display_name),live_media(id,event_id,title,media_type,status,processing_status,sequence_no,duration_seconds)")
      .eq("course_id", courseId)
      .eq("is_active", true)
      .order("position")
      .order("created_at");
    if (liveLinksError) throw liveLinksError;
    const publicLiveContent = (liveLinks ?? []).filter((link: Record<string, any>) => {
      const event = link.live_events as Record<string, any> | null;
      const media = link.live_media as Record<string, any> | null;
      if (media) return media.status === "published" && media.processing_status === "ready";
      return !!event && ["published", "live", "completed"].includes(String(event.status || ""));
    });

    // ── Enrollment check ─────────────────────────────────────────────────────
    let isEnrolled = false;
    if (viewerId) {
      const { data: enroll } = await supabase.from("user_enrollments").select("id").eq("user_id", viewerId).eq("course_id", courseId).maybeSingle();
      isEnrolled = !!enroll;
    }

    return json({
      course, creator, preview: previewAllowed, preview_mode: previewAllowed ? previewMode : null,
      modules: modulesWithLessons,
      reviews: reviewsWithInitials,
      rating_distribution: ratingDist,
      is_enrolled: isEnrolled,
      free_preview_lesson_id: freePrevLessonId,
      free_preview_lesson: freePrevLesson,
      certifications: publicCertifications,
      live_content: publicLiveContent,
    });
  } catch (err) {
    console.error("course-detail error:", err);
    return json({ success: false, message: "Erreur serveur" }, 500);
  }
});
