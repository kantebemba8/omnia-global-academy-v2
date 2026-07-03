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

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: sess } = await sb.from("user_sessions").select("user_id").eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (!sess) return json({ error: "SESSION_INVALID" }, 401);
    const userId = sess.user_id;

    if (req.method === "GET") {
      const url = new URL(req.url);
      const moduleId = url.searchParams.get("module_id");
      const courseId = url.searchParams.get("course_id");
      if (!moduleId || !courseId) return json({ error: "module_id + course_id requis" }, 400);

      const { data: enroll } = await sb.from("user_enrollments").select("id").eq("user_id", userId).eq("course_id", courseId).maybeSingle();
      if (!enroll) return json({ error: "NOT_ENROLLED" }, 403);

      const { data: lessons } = await sb.from("course_lessons").select("id").eq("module_id", moduleId);
      const lessonIds = (lessons ?? []).map((l) => l.id);
      const { data: done } = await sb.from("user_lesson_progress").select("lesson_id").eq("user_id", userId).eq("is_completed", true).in("lesson_id", lessonIds);

      if ((done?.length ?? 0) < lessonIds.length) {
        return json({ error: "LESSONS_NOT_COMPLETE", message: "Complétez toutes les leçons du module avant l'examen.", completed: done?.length ?? 0, total: lessonIds.length }, 403);
      }

      const { data: allQ } = await sb.from("course_questions").select("id,question_text,options").eq("module_id", moduleId);
      const questions = (allQ ?? []).sort(() => Math.random() - 0.5).slice(0, 10).map((q) => ({
        id: q.id, question_text: q.question_text, options: (q.options as string[]).sort(() => Math.random() - 0.5),
      }));
      return json({ questions });
    }

    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    let body: { module_id?: string; course_id?: string; answers?: { question_id: string; selected_answer: string }[] };
    try { body = await req.json(); } catch { return json({ error: "Invalid body" }, 400); }
    const { module_id, course_id, answers } = body;
    if (!module_id || !course_id || !Array.isArray(answers) || answers.length === 0) return json({ error: "module_id, course_id + answers requis" }, 400);

    const { data: enroll } = await sb.from("user_enrollments").select("id").eq("user_id", userId).eq("course_id", course_id).maybeSingle();
    if (!enroll) return json({ error: "NOT_ENROLLED" }, 403);

    const qIds = answers.map((a) => a.question_id);
    const { data: questions } = await sb.from("course_questions").select("id,correct_answer").in("id", qIds);
    const correct = (questions ?? []).filter((q) => answers.find((a) => a.question_id === q.id)?.selected_answer === q.correct_answer).length;
    const total = Math.max((questions ?? []).length, answers.length);
    const score = total > 0 ? Math.round((correct / total) * 100) : 0;
    const passed = score >= 70;

    const { data: ex } = await sb.from("user_module_progress").select("exam_attempts").eq("user_id", userId).eq("module_id", module_id).maybeSingle();
    await sb.from("user_module_progress").upsert({
      user_id: userId, module_id, course_id, exam_passed: passed, exam_score: score,
      exam_attempts: (ex?.exam_attempts ?? 0) + 1, updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,module_id" });
    await sb.from("quiz_attempts").insert({ user_id: userId, module_id, course_id, attempt_type: "module_exam", score, passed, answers: JSON.stringify(answers) });

    let finalValidationUnlocked = false;
    if (passed) {
      const { data: allMods } = await sb.from("course_modules").select("id").eq("course_id", course_id);
      const { data: passedMods } = await sb.from("user_module_progress").select("module_id").eq("user_id", userId).eq("exam_passed", true).in("module_id", (allMods ?? []).map((m) => m.id));
      finalValidationUnlocked = (passedMods?.length ?? 0) >= (allMods?.length ?? 1);
    }

    return json({ passed, score, correct_count: correct, total: answers.length, final_validation_unlocked: finalValidationUnlocked, message: passed ? "Module validé !" : `Score insuffisant (${score}%). Minimum 70% requis.` });
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
