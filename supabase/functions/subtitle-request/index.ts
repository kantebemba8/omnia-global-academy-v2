import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  const { data: sess } = await sb.from("user_sessions").select("user_id")
    .eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!sess) return json({ error: "SESSION_INVALID" }, 401);
  const userId = sess.user_id;

  // Check subtitle pipeline enabled
  const { data: pipelineSetting } = await sb.from("site_settings").select("value").eq("key", "subtitle_pipeline_enabled").maybeSingle();
  const pipelineEnabled = pipelineSetting ? JSON.parse(pipelineSetting.value as string) : false;
  if (!pipelineEnabled) return json({ error: "PIPELINE_DISABLED", message: "Le pipeline de sous-titres n'est pas activé." }, 403);

  const body = await req.json() as {
    lesson_id: string;
    source_language?: string;
    target_language?: string;
  };

  if (!body.lesson_id) return json({ error: "LESSON_ID_REQUIRED" }, 400);

  // Fetch lesson + course
  const { data: lesson } = await sb.from("course_lessons")
    .select("id, course_id, cloudflare_stream_id, courses(creator_id, establishment_id)")
    .eq("id", body.lesson_id).maybeSingle();

  if (!lesson) return json({ error: "LESSON_NOT_FOUND" }, 404);
  if (!lesson.cloudflare_stream_id) return json({ error: "NO_VIDEO", message: "Cette leçon n'a pas de vidéo associée." }, 400);

  // Check authorization: must be course creator
  const courseData = lesson.courses as unknown as { creator_id: string; establishment_id: string | null };
  if (courseData.creator_id !== userId) {
    const { data: u } = await sb.from("users").select("role").eq("id", userId).maybeSingle();
    if (!u || u.role !== "super_admin") return json({ error: "FORBIDDEN" }, 403);
  }

  // Check no existing pending/processing job
  const { data: existingJob } = await sb.from("subtitle_jobs")
    .select("id, status").eq("lesson_id", body.lesson_id).maybeSingle();

  if (existingJob && ["pending", "processing"].includes(existingJob.status as string)) {
    return json({ error: "JOB_IN_PROGRESS", status: existingJob.status });
  }

  // Create or update job
  const jobData = {
    lesson_id: body.lesson_id,
    course_id: lesson.course_id,
    status: "pending",
    source_language: body.source_language || "fr",
    target_language: body.target_language || "en",
    requested_by: userId,
    srt_url: null,
    vtt_url: null,
    error_message: null,
    completed_at: null,
  };

  const { data: job, error: jobError } = await sb.from("subtitle_jobs")
    .upsert(jobData, { onConflict: "lesson_id" })
    .select("id").single();

  if (jobError) return json({ error: "JOB_CREATE_FAILED", detail: jobError.message }, 500);

  // Queue for async processing via notification_queue
  await sb.from("notification_queue").insert({
    notification_type: "subtitle_process",
    user_id: userId,
    payload: { subtitle_job_id: job.id, lesson_id: body.lesson_id, course_id: lesson.course_id },
    scheduled_at: new Date().toISOString(),
    processed: false,
  });

  return json({ success: true, job_id: job.id, message: "Votre demande de sous-titres est en cours de traitement. Vous serez notifié dès que les sous-titres sont disponibles." });
});
