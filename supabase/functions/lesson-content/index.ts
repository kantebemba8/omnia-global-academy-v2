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

  const url = new URL(req.url);
  const lessonId = url.searchParams.get("lesson_id");
  const courseId = url.searchParams.get("course_id");
  if (!lessonId || !courseId) return json({ error: "lesson_id + course_id requis" }, 400);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const { data: sess } = await sb.from("user_sessions").select("user_id").eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (!sess) return json({ error: "SESSION_INVALID" }, 401);
    const userId = sess.user_id;

    const { data: enroll } = await sb.from("user_enrollments").select("id").eq("user_id", userId).eq("course_id", courseId).maybeSingle();
    if (!enroll) return json({ error: "NOT_ENROLLED" }, 403);

    const { data: lesson } = await sb.from("course_lessons").select("id,title,content_type,video_url,audio_url,text_content,lesson_summary,duration_seconds,cloudflare_stream_uid,position,module_id").eq("id", lessonId).maybeSingle();
    if (!lesson) return json({ error: "LESSON_NOT_FOUND" }, 404);

    const { data: allModules } = await sb.from("course_modules").select("id,position").eq("course_id", courseId).order("position");
    const modPos: Record<string, number> = {};
    (allModules ?? []).forEach((m) => { modPos[m.id] = m.position; });

    const { data: allLessons } = await sb.from("course_lessons").select("id,position,module_id").in("module_id", (allModules ?? []).map((m) => m.id));
    const sorted = (allLessons ?? []).sort((a, b) => (modPos[a.module_id] - modPos[b.module_id]) || (a.position - b.position));
    const idx = sorted.findIndex((l) => l.id === lessonId);
    if (idx < 0) return json({ error: "LESSON_NOT_IN_COURSE" }, 404);

    let isUnlocked = idx === 0;
    if (!isUnlocked) {
      const prev = sorted[idx - 1];
      const { data: prevProg } = await sb.from("user_lesson_progress").select("is_completed").eq("user_id", userId).eq("lesson_id", prev.id).maybeSingle();
      isUnlocked = prevProg?.is_completed === true;
    }
    if (!isUnlocked) return json({ error: "LESSON_LOCKED", message: "Complétez la leçon précédente d'abord." }, 403);

    const { data: prog } = await sb.from("user_lesson_progress").select("time_spent_seconds,quiz_passed,is_completed").eq("user_id", userId).eq("lesson_id", lessonId).maybeSingle();
    const timeSpent = prog?.time_spent_seconds ?? 0;
    const quizPassed = prog?.quiz_passed ?? false;
    const required = lesson.duration_seconds ?? 0;
    const cpdReached = required === 0 || timeSpent >= required;

    let questions: unknown[] = [];
    if (cpdReached && !quizPassed) {
      const { data: rawQ } = await sb.from("course_questions").select("id,question_text,options").eq("lesson_id", lessonId).limit(10);
      questions = (rawQ ?? []).sort(() => Math.random() - 0.5).slice(0, 5).map((q) => ({
        id: q.id, question_text: q.question_text,
        options: (q.options as string[]).sort(() => Math.random() - 0.5),
      }));
    }

    return json({
      lesson: { id: lesson.id, title: lesson.title, content_type: lesson.content_type, video_url: lesson.content_type === "video" ? lesson.video_url : undefined, audio_url: lesson.content_type === "audio" ? lesson.audio_url : undefined, text_content: lesson.content_type === "text" ? lesson.text_content : undefined, lesson_summary: lesson.lesson_summary, duration_seconds: required, cloudflare_stream_uid: lesson.cloudflare_stream_uid },
      progress: { time_spent_seconds: timeSpent, quiz_passed: quizPassed, is_completed: prog?.is_completed ?? false },
      required_seconds: required, cpd_time_reached: cpdReached, questions,
      next_lesson_id: idx < sorted.length - 1 ? sorted[idx + 1].id : null,
    });
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
