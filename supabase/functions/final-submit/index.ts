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

async function auth(sb: ReturnType<typeof createClient>, token: string) {
  const { data } = await sb.from("user_sessions").select("user_id").eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
  return data?.user_id ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const courseId = url.searchParams.get("course_id");
      if (!courseId || url.searchParams.get("mode") !== "questions") return json({ error: "course_id + mode=questions requis" }, 400);

      const userId = await auth(sb, token);
      if (!userId) return json({ error: "SESSION_INVALID" }, 401);

      const { data: existing } = await sb.from("user_final_validation").select("status,score,validation_type").eq("user_id", userId).eq("course_id", courseId).maybeSingle();
      if (existing?.status === "passed") return json({ already_passed: true, score: existing.score, status: existing.status });
      if (existing?.status === "submitted") return json({ already_submitted: true, status: existing.status });

      const { data: course } = await sb.from("courses").select("final_validation_type,title").eq("id", courseId).maybeSingle();
      if (!course) return json({ error: "COURSE_NOT_FOUND" }, 404);

      const { data: allQ } = await sb.from("course_questions").select("id,question_text,options").eq("course_id", courseId);
      const questions = (allQ ?? []).sort(() => Math.random() - 0.5).slice(0, 20).map((q) => ({
        id: q.id, question_text: q.question_text, options: (q.options as string[]).sort(() => Math.random() - 0.5),
      }));
      return json({ questions, validation_type: course.final_validation_type ?? "qcm", course_title: course.title });
    }

    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    let body: { course_id?: string; type?: string; answers?: { question_id: string; selected_answer: string }[]; submission_url?: string };
    try { body = await req.json(); } catch { return json({ error: "Invalid body" }, 400); }
    const { course_id, type, answers, submission_url } = body;
    if (!course_id || !type) return json({ error: "course_id + type requis" }, 400);

    const userId = await auth(sb, token);
    if (!userId) return json({ error: "SESSION_INVALID" }, 401);

    const { data: enroll } = await sb.from("user_enrollments").select("id").eq("user_id", userId).eq("course_id", course_id).maybeSingle();
    if (!enroll) return json({ error: "NOT_ENROLLED" }, 403);

    const { data: allMods } = await sb.from("course_modules").select("id").eq("course_id", course_id);
    const { data: passedMods } = await sb.from("user_module_progress").select("module_id").eq("user_id", userId).eq("exam_passed", true).in("module_id", (allMods ?? []).map((m) => m.id));
    if ((passedMods?.length ?? 0) < (allMods?.length ?? 1)) return json({ error: "MODULES_NOT_COMPLETE", message: "Réussissez tous les examens de modules avant la validation finale." }, 403);

    if (type === "projet_soumettre" || type === "projet_corriger") {
      if (!submission_url) return json({ error: "submission_url requis" }, 400);
      await sb.from("user_final_validation").upsert({ user_id: userId, course_id, validation_type: type, status: "submitted", submission_url, submitted_at: new Date().toISOString() }, { onConflict: "user_id,course_id" });
      return json({ success: true, status: "submitted", message: "Votre projet a été soumis. Le professeur l'évaluera sous 5 jours ouvrés." });
    }

    if (!Array.isArray(answers) || answers.length === 0) return json({ error: "answers requis pour le QCM" }, 400);
    const qIds = answers.map((a) => a.question_id);
    const { data: questions } = await sb.from("course_questions").select("id,correct_answer").in("id", qIds);
    const correct = (questions ?? []).filter((q) => answers.find((a) => a.question_id === q.id)?.selected_answer === q.correct_answer).length;
    const total = Math.max((questions ?? []).length, answers.length);
    const score = total > 0 ? Math.round((correct / total) * 100) : 0;
    const passed = score >= 70;

    await sb.from("user_final_validation").upsert({ user_id: userId, course_id, validation_type: "qcm", status: passed ? "passed" : "failed", score, submitted_at: new Date().toISOString(), evaluated_at: new Date().toISOString() }, { onConflict: "user_id,course_id" });
    await sb.from("quiz_attempts").insert({ user_id: userId, course_id, attempt_type: "final_qcm", score, passed, answers: JSON.stringify(answers) });

    return json(passed
      ? { passed, score, correct_count: correct, total, certificate_eligible: true, message: "Validation finale réussie !" }
      : { passed, score, correct_count: correct, total, message: `Score insuffisant (${score}%). Minimum 70% requis.` });
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
