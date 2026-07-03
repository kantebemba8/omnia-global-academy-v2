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
  const courseId = url.searchParams.get("course_id");
  if (!courseId) return json({ error: "course_id requis" }, 400);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: sess } = await sb.from("user_sessions").select("user_id").eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (!sess) return json({ error: "SESSION_INVALID" }, 401);
    const userId = sess.user_id;

    const { data: enroll } = await sb.from("user_enrollments").select("id").eq("user_id", userId).eq("course_id", courseId).maybeSingle();
    if (!enroll) return json({ error: "NOT_ENROLLED" }, 403);

    const { data: modules } = await sb.from("course_modules").select("id,title,position,description").eq("course_id", courseId).order("position");
    const moduleIds = (modules ?? []).map((m) => m.id);

    const { data: allLessons } = await sb.from("course_lessons").select("id,title,position,module_id,content_type,duration_seconds,is_free").in("module_id", moduleIds).order("position");
    const { data: lessonProg } = await sb.from("user_lesson_progress").select("lesson_id,time_spent_seconds,quiz_passed,is_completed").eq("user_id", userId).eq("course_id", courseId);
    const { data: modProg } = await sb.from("user_module_progress").select("module_id,exam_passed,exam_score,exam_attempts").eq("user_id", userId).eq("course_id", courseId);

    const lMap: Record<string, { time_spent_seconds: number; quiz_passed: boolean; is_completed: boolean }> = {};
    (lessonProg ?? []).forEach((p) => { lMap[p.lesson_id] = p; });
    const mMap: Record<string, { exam_passed: boolean; exam_score: number | null; exam_attempts: number }> = {};
    (modProg ?? []).forEach((p) => { mMap[p.module_id] = p; });

    const enriched = (modules ?? []).map((mod, idx) => {
      const lessons = (allLessons ?? []).filter((l) => l.module_id === mod.id).sort((a, b) => a.position - b.position).map((l) => ({
        lesson_id: l.id, title: l.title, position: l.position, content_type: l.content_type,
        duration_seconds: l.duration_seconds ?? 0, is_free: l.is_free ?? false,
        is_completed: lMap[l.id]?.is_completed ?? false,
        time_spent_seconds: lMap[l.id]?.time_spent_seconds ?? 0,
        quiz_passed: lMap[l.id]?.quiz_passed ?? false,
      }));
      const mp = mMap[mod.id];
      const prevMod = idx > 0 ? (modules ?? [])[idx - 1] : null;
      return {
        module_id: mod.id, title: mod.title, position: mod.position, description: mod.description ?? null,
        lessons, exam_unlocked: lessons.length > 0 && lessons.every((l) => l.is_completed),
        exam_passed: mp?.exam_passed ?? false, exam_score: mp?.exam_score ?? null, exam_attempts: mp?.exam_attempts ?? 0,
        is_unlocked: idx === 0 || (prevMod ? (mMap[prevMod.id]?.exam_passed ?? false) : false),
      };
    });

    const allModPassed = enriched.length > 0 && enriched.every((m) => m.exam_passed);
    const { data: finalVal } = await sb.from("user_final_validation").select("status,score,validation_type").eq("user_id", userId).eq("course_id", courseId).maybeSingle();

    const totalLessons = enriched.reduce((s, m) => s + m.lessons.length, 0);
    const doneLessons = enriched.reduce((s, m) => s + m.lessons.filter((l) => l.is_completed).length, 0);

    return json({
      modules: enriched,
      final_validation_unlocked: allModPassed,
      final_validation: finalVal ? { status: finalVal.status, score: finalVal.score, validation_type: finalVal.validation_type } : null,
      progress: { total_lessons: totalLessons, completed_lessons: doneLessons, percent: totalLessons > 0 ? Math.round((doneLessons / totalLessons) * 100) : 0 },
    });
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
