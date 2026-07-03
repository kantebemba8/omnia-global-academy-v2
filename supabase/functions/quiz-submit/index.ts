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
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  let body: { lesson_id?: string; course_id?: string; answers?: { question_id: string; selected_answer: string }[] };
  try { body = await req.json(); } catch { return json({ error: "Invalid body" }, 400); }
  const { lesson_id, course_id, answers } = body;
  if (!lesson_id || !course_id || !Array.isArray(answers) || answers.length === 0) return json({ error: "lesson_id, course_id + answers requis" }, 400);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: sess } = await sb.from("user_sessions").select("user_id").eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (!sess) return json({ error: "SESSION_INVALID" }, 401);
    const userId = sess.user_id;

    const { data: lesson } = await sb.from("course_lessons").select("duration_seconds").eq("id", lesson_id).maybeSingle();
    const required = lesson?.duration_seconds ?? 0;
    const { data: prog } = await sb.from("user_lesson_progress").select("time_spent_seconds,quiz_passed").eq("user_id", userId).eq("lesson_id", lesson_id).maybeSingle();

    if (required > 0 && (prog?.time_spent_seconds ?? 0) < required) {
      return json({ error: "CPD_TIME_NOT_REACHED", message: `Vous devez lire la leçon pendant au moins ${Math.ceil(required / 60)} minutes.` }, 403);
    }
    if (prog?.quiz_passed) return json({ passed: true, score: 100, correct_count: answers.length, total: answers.length, already_passed: true });

    const qIds = answers.map((a) => a.question_id);
    const { data: questions } = await sb.from("course_questions").select("id,correct_answer").in("id", qIds);
    const correct = (questions ?? []).filter((q) => answers.find((a) => a.question_id === q.id)?.selected_answer === q.correct_answer).length;
    const total = Math.max((questions ?? []).length, answers.length);
    const score = total > 0 ? Math.round((correct / total) * 100) : 0;
    const passed = score >= 80;

    await sb.from("quiz_attempts").insert({ user_id: userId, lesson_id, course_id, attempt_type: "lesson_quiz", score, passed, answers: JSON.stringify(answers) });

    if (passed) {
      await sb.from("user_lesson_progress").upsert({
        user_id: userId, lesson_id, course_id,
        time_spent_seconds: prog?.time_spent_seconds ?? 0, quiz_passed: true,
        is_completed: true, updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,lesson_id" });
    }

    return json({ passed, score, correct_count: correct, total, message: passed ? "Quiz réussi ! Leçon validée." : `Score insuffisant (${score}%). Minimum 80% requis.` });
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
