import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { corsHeaders } from "../_shared/cors.ts";
import { getActiveOmniaSessionResult } from "../_shared/omnia-auth.ts";
import { storageRef } from "../_shared/protected-storage.ts";
import { validatedStructureAccess, hasStructurePermission } from "../_shared/structure-access.ts";
import { runOpenAITts, aiErrorPayload } from "../_shared/ai-runtime.ts";

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function canManageCourse(sb: any, userId: string, course: any) {
  const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", userId);
  if ((roles || []).some((row: any) => row.role === "super_admin")) return true;
  if (String(course?.creator_id || "") !== userId) return false;
  if (String(course?.creator_context || "") !== "structure") return true;
  if (!course?.structure_id) return false;
  const access = await validatedStructureAccess(sb, userId, String(course.structure_id));
  return hasStructurePermission(access, "can_manage_lessons") || hasStructurePermission(access, "can_upload_files");
}
function setPath(input: Record<string, any>, path: string, value: unknown) {
  const parts = path.split(".").filter(Boolean);
  if (!parts.length || parts.length > 4 || parts.some(part => !/^(?:[a-z_][a-z0-9_]*|\d+)$/i.test(part))) throw new Error("INVALID_TARGET_PATH");
  const root: any = structuredClone(input || {}); let cursor = root;
  for (let i=0;i<parts.length-1;i++) {
    const key = /^\d+$/.test(parts[i]) ? Number(parts[i]) : parts[i];
    const nextKey = parts[i+1];
    if (cursor[key] == null) cursor[key] = /^\d+$/.test(nextKey) ? [] : {};
    cursor = cursor[key];
  }
  const last = /^\d+$/.test(parts.at(-1)!) ? Number(parts.at(-1)!) : parts.at(-1)!;
  cursor[last] = value; return root;
}
const ALLOWED_TARGETS = [
  /^url$/, /^audio_url$/, /^reference_audio_url$/, /^items\.\d+\.audio_url$/,
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const token = (req.headers.get("x-omnia-session-token") || req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "AUTH_REQUIRED" }, 401);
    const { data: sess } = await getActiveOmniaSessionResult(sb, token); if (!sess) return json({ error: "SESSION_INVALID" }, 401);
    const userId = String(sess.user_id);
    const body = await req.json().catch(() => ({}));
    const blockId = String(body.block_id || "").trim(); const text = String(body.text || "").trim(); const targetPath = String(body.target_path || "audio_url").trim();
    if (!blockId || !text) return json({ error: "BLOCK_AND_TEXT_REQUIRED", message: "Un bloc et un texte source sont requis." }, 400);
    if (!ALLOWED_TARGETS.some(pattern => pattern.test(targetPath))) return json({ error: "INVALID_TARGET_PATH" }, 400);
    if (text.length > 4096) return json({ error: "TEXT_TOO_LONG", message: "Le texte TTS est limité à 4096 caractères par génération." }, 400);
    const { data: block } = await sb.from("lesson_blocks").select("id,course_id,lesson_id,block_type,content_json").eq("id", blockId).maybeSingle();
    if (!block) return json({ error: "BLOCK_NOT_FOUND" }, 404);
    const { data: course } = await sb.from("courses").select("id,creator_id,creator_context,structure_id,language,instruction_language,target_language").eq("id", block.course_id).maybeSingle();
    if (!course || !(await canManageCourse(sb, userId, course))) return json({ error: "FORBIDDEN" }, 403);
    const generated = await runOpenAITts(sb, { context: { module: "tts", action: `block_${block.block_type}`, userId, courseId: block.course_id, lessonId: block.lesson_id, blockId }, text, voice: String(body.voice || "nova"), speed: Number(body.speed || 0.95) });
    const storagePath = `audio/blocks/${block.course_id}/${block.id}/${Date.now()}.mp3`;
    const upload = await sb.storage.from("course-audios").upload(storagePath, generated.bytes, { contentType: "audio/mpeg", upsert: false }); if (upload.error) throw upload.error;
    const ref = storageRef("course-audios", storagePath);
    const content = setPath(block.content_json || {}, targetPath, ref);
    if (targetPath === "url") content.provider = "openai_tts";
    const { error: updateError } = await sb.from("lesson_blocks").update({ content_json: content, updated_at: new Date().toISOString() }).eq("id", block.id); if (updateError) throw updateError;
    return json({ success: true, block_id: block.id, target_path: targetPath, audio_ref: ref, duration_estimate: generated.estimatedSeconds, provider: "openai", model: generated.model, content_json: content });
  } catch (error) {
    console.error("tts-generate", error);
    const ai = aiErrorPayload(error); if (ai.error !== "AI_RUNTIME_ERROR") return json({ error: ai.error, provider: ai.provider, message: ai.message }, ai.status);
    return json({ error: "SERVER_ERROR", message: error instanceof Error ? error.message : String(error) }, 500);
  }
});
