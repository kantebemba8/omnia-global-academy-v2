import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { getActiveOmniaSessionResult, omniaInternalHeaders } from "../_shared/omnia-auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { validatedStructureAccess, hasStructurePermission } from "../_shared/structure-access.ts";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function canManageCourse(sb: any, userId: string, course: any) {
  const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", userId);
  if ((roles || []).some((row: any) => row.role === "super_admin")) return true;
  if (String(course?.creator_id || "") !== userId) return false;
  if (String(course?.creator_context || "") !== "structure") return true;
  if (!course?.structure_id) return false;
  const access = await validatedStructureAccess(sb, userId, String(course.structure_id));
  return hasStructurePermission(access, "can_upload_files") || hasStructurePermission(access, "can_manage_lessons");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const token = (req.headers.get("x-omnia-session-token") || req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "AUTH_REQUIRED" }, 401);
    const { data: sess } = await getActiveOmniaSessionResult(sb, token);
    if (!sess) return json({ error: "SESSION_INVALID" }, 401);
    const userId = String(sess.user_id);
    const { data: pipelineSetting } = await sb.from("site_settings").select("value").eq("key", "subtitle_pipeline_enabled").maybeSingle();
    const raw = pipelineSetting?.value;
    const enabled = raw === true || raw === "true" || raw === '"true"';
    if (!enabled) return json({ error: "PIPELINE_DISABLED", message: "Le pipeline de sous-titres n'est pas activé dans Moteurs & Services." }, 403);

    const body = await req.json().catch(() => ({}));
    const blockId = String(body.block_id || "").trim();
    const legacyLessonId = String(body.lesson_id || "").trim();
    let block: any = null;
    if (blockId) {
      const result = await sb.from("lesson_blocks").select("id,lesson_id,course_id,block_type,content_json").eq("id", blockId).maybeSingle();
      block = result.data;
    } else if (legacyLessonId) {
      const result = await sb.from("lesson_blocks").select("id,lesson_id,course_id,block_type,content_json").eq("lesson_id", legacyLessonId).eq("block_type", "video").order("position", { ascending: false }).limit(1).maybeSingle();
      block = result.data;
    }
    if (!block || block.block_type !== "video") return json({ error: "VIDEO_BLOCK_REQUIRED", message: "Sélectionnez un bloc Vidéo contenant une vidéo Cloudflare Stream." }, 400);
    const streamUid = String(block.content_json?.cloudflare_stream_uid || "").trim();
    if (!streamUid) return json({ error: "NO_STREAM_VIDEO", message: "La vidéo doit d'abord être téléversée dans Omnia/Cloudflare Stream." }, 400);
    const { data: course } = await sb.from("courses").select("id,creator_id,creator_context,structure_id,language,instruction_language,target_language").eq("id", block.course_id).maybeSingle();
    if (!course) return json({ error: "COURSE_NOT_FOUND" }, 404);
    if (!(await canManageCourse(sb, userId, course))) return json({ error: "FORBIDDEN" }, 403);

    const sourceLanguage = String(body.source_language || course.instruction_language || course.language || "fr").trim().toLowerCase();
    const targetLanguage = String(body.target_language || sourceLanguage).trim().toLowerCase();
    const { data: existing } = await sb.from("subtitle_jobs").select("id,status").eq("block_id", block.id).eq("target_language", targetLanguage).maybeSingle();
    if (existing && ["pending","processing"].includes(String(existing.status))) return json({ error: "JOB_IN_PROGRESS", job_id: existing.id, status: existing.status }, 409);
    const payload = {
      lesson_id: block.lesson_id,
      block_id: block.id,
      course_id: block.course_id,
      status: "pending",
      source_language: sourceLanguage,
      target_language: targetLanguage,
      requested_by: userId,
      storage_bucket: null,
      srt_storage_path: null,
      vtt_storage_path: null,
      srt_url: null,
      vtt_url: null,
      error_message: null,
      completed_at: null,
    };
    let job: any;
    if (existing?.id) {
      const updated = await sb.from("subtitle_jobs").update(payload).eq("id", existing.id).select("id").single();
      if (updated.error) throw updated.error; job = updated.data;
    } else {
      const created = await sb.from("subtitle_jobs").insert(payload).select("id").single();
      if (created.error) throw created.error; job = created.data;
    }

    const processUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/subtitle-process`;
    const processing = fetch(processUrl, { method: "POST", headers: omniaInternalHeaders(), body: JSON.stringify({ job_id: job.id }) })
      .then(async response => { if (!response.ok) console.error("SUBTITLE_PROCESS_TRIGGER_FAILED", response.status, await response.text()); })
      .catch(error => console.error("SUBTITLE_PROCESS_TRIGGER_FAILED", error));
    try { EdgeRuntime.waitUntil(processing); } catch { void processing; }

    return json({ success: true, job_id: job.id, block_id: block.id, status: "pending", message: "La génération des sous-titres a démarré. Le résultat sera rattaché à ce bloc vidéo." });
  } catch (error) {
    console.error("subtitle-request", error);
    return json({ error: "SERVER_ERROR", message: error instanceof Error ? error.message : String(error) }, 500);
  }
});
