import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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
    const { data: course, error: courseErr } = await supabase
      .from("courses")
      .select(
        "id, title, short_description, long_description, cover_image_url, " +
        "preview_video_url, category, level, price_xof, is_free, cpd_hours, " +
        "cpd_accredited, cpd_provider_code, average_rating, total_reviews, " +
        "total_students, language, subtitles_available, prerequisites, " +
        "objectives, creator_type, creator_id, establishment_id, " +
        "total_duration_seconds, is_published"
      )
      .eq("id", courseId)
      .eq("is_published", true)
      .maybeSingle();

    if (courseErr) throw courseErr;
    if (!course) return json({ success: false, message: "Formation introuvable" }, 404);

    // ── Creator ─────────────────────────────────────────────────────────────
    let creator: Record<string, unknown> = {};
    if (course.creator_type === "plateforme") {
      creator = { id: null, full_name: "Omnia Global Academy", bio: "Formation créée par la plateforme Omnia Global Academy.", expertise_domain: null, avatar_url: null };
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
    const { data: modules } = await supabase
      .from("course_modules")
      .select("id, title, objective, position")
      .eq("course_id", courseId)
      .order("position");

    const moduleIds = (modules ?? []).map(m => m.id);
    const { data: lessons } = moduleIds.length > 0
      ? await supabase
          .from("course_lessons")
          .select("id, module_id, title, position, is_free_preview, cpd_calculated_time_seconds, is_external, video_url, audio_url")
          .in("module_id", moduleIds)
          .order("position")
      : { data: [] };

    const lessonsByModule: Record<string, unknown[]> = {};
    for (const l of lessons ?? []) {
      const ml = l as Record<string, unknown>;
      const mid = ml.module_id as string;
      if (!lessonsByModule[mid]) lessonsByModule[mid] = [];
      lessonsByModule[mid].push({
        id: ml.id, title: ml.title, position: ml.position,
        is_free_preview: ml.is_free_preview,
        cpd_calculated_time_seconds: ml.cpd_calculated_time_seconds,
        is_external: ml.is_external,
        has_video: !!ml.video_url,
        has_audio: !!ml.audio_url,
      });
    }

    const modulesWithLessons = (modules ?? []).map(m => ({
      ...m,
      lessons: lessonsByModule[m.id] ?? [],
    }));

    // ── Free preview lesson (full content) ──────────────────────────────────
    const firstLessonMeta = (modulesWithLessons[0]?.lessons as Record<string, unknown>[])?.[0];
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

    // ── Enrollment check ─────────────────────────────────────────────────────
    let isEnrolled = false;
    if (sessionToken) {
      const { data: sess } = await supabase
        .from("user_sessions")
        .select("user_id")
        .eq("session_token", sessionToken)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (sess?.user_id) {
        const { data: enroll } = await supabase
          .from("user_enrollments")
          .select("id")
          .eq("user_id", sess.user_id)
          .eq("course_id", courseId)
          .maybeSingle();
        isEnrolled = !!enroll;
      }
    }

    return json({
      course, creator,
      modules: modulesWithLessons,
      reviews: reviewsWithInitials,
      rating_distribution: ratingDist,
      is_enrolled: isEnrolled,
      free_preview_lesson_id: freePrevLessonId,
      free_preview_lesson: freePrevLesson,
    });
  } catch (err) {
    console.error("course-detail error:", err);
    return json({ success: false, message: "Erreur serveur" }, 500);
  }
});
