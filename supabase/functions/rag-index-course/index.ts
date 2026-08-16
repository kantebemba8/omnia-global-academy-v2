import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { getActiveOmniaSessionResult, isOmniaInternalRequest } from "../_shared/omnia-auth.ts";
import { runOpenAIEmbedding, aiErrorPayload } from "../_shared/ai-runtime.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-omnia-session-token, x-omnia-internal-token",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function stripHtml(value: unknown) {
  return String(value || "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
}
function collectStrings(value: unknown, out: string[], depth = 0) {
  if (depth > 5 || out.length > 250) return;
  if (typeof value === "string") { const clean = stripHtml(value); if (clean.length >= 2) out.push(clean); return; }
  if (Array.isArray(value)) { for (const item of value) collectStrings(item, out, depth + 1); return; }
  if (!value || typeof value !== "object") return;
  const ignored = new Set(["url","audio_url","reference_audio_url","thumbnail","cloudflare_stream_uid","provider","storage_path","runtime_session_token","runtime_state","file_url"]);
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) if (!ignored.has(key)) collectStrings(item, out, depth + 1);
}
function blockText(block: any) {
  const type = String(block?.block_type || "");
  // Media-only and technical blocks are indexed only through useful metadata/transcripts.
  const supported = new Set(["heading","subheading","text","callout","remember","objective","example","summary","quote","checklist","accordion","flashcards","interactive_table","timeline","columns","important","case_study","definition","correction","qcm","true_false","open_question","exercise","rubric","vocabulary","dialogue","cloze","dictation","pronunciation","matching","sentence_order","oral_response","listening_comprehension","written_expression","audio","video"]);
  if (!supported.has(type)) return "";
  const values: string[] = [];
  if (block?.title) values.push(stripHtml(block.title));
  collectStrings(block?.content_json || {}, values);
  return [...new Set(values)].join("\n").trim();
}
function chunkText(text: string, maxWords = 360) {
  const paragraphs = text.split(/\n+/).map(x => x.trim()).filter(Boolean);
  const chunks: string[] = []; let current: string[] = []; let count = 0;
  const flush = () => { if (current.length) chunks.push(current.join("\n").trim()); current=[]; count=0; };
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean).length;
    if (count + words > maxWords && current.length) flush();
    if (words > maxWords) {
      const tokens = paragraph.split(/\s+/);
      for (let i=0;i<tokens.length;i+=maxWords) chunks.push(tokens.slice(i,i+maxWords).join(" "));
      continue;
    }
    current.push(paragraph); count += words;
  }
  flush(); return chunks;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const authHeader = req.headers.get("x-omnia-session-token") || req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    let actorUserId: string | null = null;
    if (!isOmniaInternalRequest(req)) {
      const { data: sess } = await getActiveOmniaSessionResult(sb, token);
      if (!sess) return json({ error: "AUTH_REQUIRED" }, 401);
      actorUserId = String(sess.user_id);
      const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", actorUserId);
      if (!(roles || []).some((row: any) => row.role === "super_admin")) return json({ error: "FORBIDDEN" }, 403);
    }
    const body = await req.json().catch(() => ({}));
    const courseId = String(body.course_id || "").trim();
    if (!courseId) return json({ error: "COURSE_ID_REQUIRED" }, 400);
    const { data: course } = await sb.from("courses").select("id,title,language,instruction_language").eq("id", courseId).maybeSingle();
    if (!course) return json({ error: "COURSE_NOT_FOUND" }, 404);
    const { data: lessons, error: lessonError } = await sb.from("course_lessons").select("id,title,content_text,position").eq("course_id", courseId).order("position");
    if (lessonError) throw lessonError;
    const { data: blocks, error: blockError } = await sb.from("lesson_blocks").select("id,lesson_id,block_type,position,title,content_json").eq("course_id", courseId).order("position");
    if (blockError) throw blockError;

    // Build all new embeddings before replacing the previous index. If the provider
    // fails, the last known-good course index remains available to learners.
    const newRows: any[] = [];
    let lessonsProcessed = 0;
    for (const lesson of lessons || []) {
      const lessonBlocks = (blocks || []).filter((block: any) => String(block.lesson_id) === String(lesson.id));
      const blockContent = lessonBlocks.map(blockText).filter(text => text.length >= 2).join("\n\n");
      const legacy = stripHtml(lesson.content_text || "");
      const source = blockContent.length >= 20 ? blockContent : legacy;
      if (source.length < 20) continue;
      const rawChunks = chunkText(source);
      for (let i=0;i<rawChunks.length;i++) {
        const prefixed = `[Index:blocks-v2] [Formation: ${course.title}] [Leçon: ${lesson.title}] [Langue: ${course.instruction_language || course.language || "non précisée"}] ${rawChunks[i]}`;
        const embedding = await runOpenAIEmbedding(sb, { context: { module: "rag_index", action: "index_course", userId: actorUserId, courseId, lessonId: lesson.id }, input: prefixed });
        newRows.push({ course_id: courseId, lesson_id: lesson.id, chunk_index: i, content: prefixed, embedding: JSON.stringify(embedding) });
      }
      lessonsProcessed++;
    }

    const { error: deleteError } = await sb.from("rag_chunks").delete().eq("course_id", courseId);
    if (deleteError) throw deleteError;
    if (newRows.length) {
      for (let i=0;i<newRows.length;i+=200) {
        const { error: insertError } = await sb.from("rag_chunks").insert(newRows.slice(i,i+200));
        if (insertError) throw insertError;
      }
    }
    return json({ success: true, chunks_indexed: newRows.length, lessons_processed: lessonsProcessed, source: "lesson_blocks_with_legacy_fallback" });
  } catch (error) {
    console.error("rag-index-course", error);
    const ai = aiErrorPayload(error);
    if (ai.error !== "AI_RUNTIME_ERROR") return json({ error: ai.error, provider: ai.provider, message: ai.message }, ai.status);
    return json({ error: "SERVER_ERROR", message: error instanceof Error ? error.message : String(error) }, 500);
  }
});
