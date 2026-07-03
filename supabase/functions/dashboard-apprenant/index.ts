import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const { data: sess } = await sb.from("user_sessions").select("user_id").eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (!sess) return json({ error: "SESSION_INVALID" }, 401);
    const userId = sess.user_id;

    // User info
    const { data: user } = await sb.from("users").select("full_name,email,phone_number,country_code,avatar_url,ai_tokens,created_at").eq("id", userId).maybeSingle();
    if (!user) return json({ error: "USER_NOT_FOUND" }, 404);

    // Enrollments with course info
    const { data: enrollments } = await sb.from("user_enrollments").select("id,course_id,enrolled_at,courses(id,title,slug,thumbnail_url,total_duration_seconds,instructor_id)").eq("user_id", userId).order("enrolled_at", { ascending: false });

    const courseIds = (enrollments ?? []).map((e) => (e as unknown as { course_id: string }).course_id);

    // Lesson progress for all enrolled courses
    const { data: lessonProgress } = courseIds.length > 0
      ? await sb.from("user_lesson_progress").select("lesson_id,is_completed,course_id").eq("user_id", userId).in("course_id", courseIds)
      : { data: [] };

    // Module progress (exams passed)
    const { data: moduleProgress } = courseIds.length > 0
      ? await sb.from("user_module_progress").select("module_id,course_id,exam_passed").eq("user_id", userId).in("course_id", courseIds)
      : { data: [] };

    // Final validations (certificates)
    const { data: finalValidations } = await sb.from("user_final_validation").select("course_id,status,created_at").eq("user_id", userId);

    // All lessons per course for progress calculation
    const { data: allLessons } = courseIds.length > 0
      ? await sb.from("course_lessons").select("id,module_id,course_modules(course_id)").filter("course_modules.course_id", "in", `(${courseIds.map((id) => `'${id}'`).join(",")})`)
      : { data: [] };

    // Build progress map per course
    const lessonsByCourse: Record<string, string[]> = {};
    for (const l of allLessons ?? []) {
      const lesson = l as unknown as { id: string; course_modules: { course_id: string } | null };
      const cid = lesson.course_modules?.course_id;
      if (cid) {
        if (!lessonsByCourse[cid]) lessonsByCourse[cid] = [];
        lessonsByCourse[cid].push(lesson.id);
      }
    }

    const completedByCourse: Record<string, number> = {};
    for (const p of lessonProgress ?? []) {
      const prog = p as unknown as { lesson_id: string; is_completed: boolean; course_id: string };
      if (prog.is_completed) {
        completedByCourse[prog.course_id] = (completedByCourse[prog.course_id] ?? 0) + 1;
      }
    }

    const passedCourses = new Set((finalValidations ?? []).filter((fv) => (fv as unknown as { status: string }).status === "passed").map((fv) => (fv as unknown as { course_id: string }).course_id));

    const coursesEnCours = [];
    const coursesTermines = [];

    for (const enroll of enrollments ?? []) {
      const e = enroll as unknown as { course_id: string; enrolled_at: string; courses: { id: string; title: string; slug: string; thumbnail_url: string | null; total_duration_seconds: number | null } | null };
      const cid = e.course_id;
      const total = lessonsByCourse[cid]?.length ?? 0;
      const done = completedByCourse[cid] ?? 0;
      const percent = total > 0 ? Math.round((done / total) * 100) : 0;

      const entry = {
        course_id: cid,
        title: e.courses?.title ?? "",
        slug: e.courses?.slug ?? "",
        thumbnail_url: e.courses?.thumbnail_url ?? null,
        enrolled_at: e.enrolled_at,
        progress_percent: percent,
        lessons_completed: done,
        lessons_total: total,
        certificate_earned: passedCourses.has(cid),
      };

      if (passedCourses.has(cid)) {
        coursesTermines.push(entry);
      } else {
        coursesEnCours.push(entry);
      }
    }

    // Recent activity (last 5 completed lessons)
    const { data: recentActivity } = await sb.from("user_lesson_progress")
      .select("lesson_id,course_id,updated_at,course_lessons(title)")
      .eq("user_id", userId)
      .eq("is_completed", true)
      .order("updated_at", { ascending: false })
      .limit(5);

    // Referral info
    const { data: referralData } = await sb.from("referrals").select("id,status,reward_referrer_xof,rewarded_at").eq("referrer_id", userId);
    const totalFilleuls = (referralData ?? []).length;
    const totalRewards = (referralData ?? []).reduce((sum, r) => {
      const ref = r as unknown as { reward_referrer_xof: number };
      return sum + (ref.reward_referrer_xof ?? 0);
    }, 0);

    return json({
      user: {
        id: userId,
        full_name: user.full_name,
        email: user.email,
        phone_number: user.phone_number,
        country_code: user.country_code,
        avatar_url: user.avatar_url,
        ai_tokens: user.ai_tokens ?? 0,
        member_since: user.created_at,
      },
      kpis: {
        formations_en_cours: coursesEnCours.length,
        formations_terminees: coursesTermines.length,
        certificats_obtenus: passedCourses.size,
        jetons_ia_restants: user.ai_tokens ?? 0,
      },
      courses_en_cours: coursesEnCours.slice(0, 6),
      cours_termines: coursesTermines,
      activite_recente: (recentActivity ?? []).map((a) => {
        const act = a as unknown as { lesson_id: string; course_id: string; updated_at: string; course_lessons: { title: string } | null };
        return { lesson_id: act.lesson_id, course_id: act.course_id, lesson_title: act.course_lessons?.title ?? "", completed_at: act.updated_at };
      }),
      parrainage: {
        total_filleuls: totalFilleuls,
        total_recompenses_xof: totalRewards,
        referral_link: `${Deno.env.get("SITE_URL") ?? "https://omniaglobalacademy.com"}/inscription?ref=${userId}`,
      },
    });
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
