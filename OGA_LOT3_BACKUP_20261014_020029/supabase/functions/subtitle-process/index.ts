import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { isOmniaInternalRequest, omniaInternalHeaders } from "../_shared/omnia-auth.ts";
import { fetchStreamCaption, signedStreamDownload, uploadStreamCaption } from "../_shared/cloudflare-stream.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { storageRef } from "../_shared/protected-storage.ts";
import { runAnthropicText, runOpenAITranscription, aiErrorPayload } from "../_shared/ai-runtime.ts";

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function srtToVtt(srt: string) {
  return "WEBVTT\n\n" + String(srt || "").replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2").replace(/^\d+\s*$/gm, "").replace(/\n{3,}/g, "\n\n").trim();
}
function vttToSrt(vtt: string) {
  const normalized = String(vtt || "").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const cues: string[] = [];
  for (const block of normalized.split(/\n{2,}/)) {
    const lines = block.split("\n").map(line => line.trimEnd());
    const idx = lines.findIndex(line => line.includes("-->")); if (idx < 0) continue;
    const match = lines[idx].match(/(?:(\d{2}):)?(\d{2}):(\d{2})\.(\d{3})\s+-->\s+(?:(\d{2}):)?(\d{2}):(\d{2})\.(\d{3})/); if (!match) continue;
    const timestamp = `${match[1] || "00"}:${match[2]}:${match[3]},${match[4]} --> ${match[5] || "00"}:${match[6]}:${match[7]},${match[8]}`;
    const text = lines.slice(idx + 1).filter(line => line.trim()); if (!text.length) continue;
    cues.push(`${cues.length + 1}\n${timestamp}\n${text.join("\n")}`);
  }
  if (!cues.length) throw new Error("CLOUDFLARE_STREAM_CAPTION_VTT_INVALID");
  return `${cues.join("\n\n")}\n`;
}
function splitSrtForTranslation(srt: string, maxChars = 12000) {
  const cues = String(srt || "").replace(/\r\n/g, "\n").split(/\n{2,}/).map(x => x.trim()).filter(Boolean);
  const chunks: string[] = []; let current = "";
  for (const cue of cues) {
    const candidate = current ? `${current}\n\n${cue}` : cue;
    if (candidate.length > maxChars && current) { chunks.push(current); current = cue; }
    else current = candidate;
  }
  if (current) chunks.push(current);
  return chunks;
}
async function translateSrt(sb: any, job: any, srt: string) {
  if (String(job.source_language) === String(job.target_language)) return srt;
  const translated: string[] = [];
  const chunks = splitSrtForTranslation(srt);
  for (let index=0; index<chunks.length; index++) {
    const prompt = `Traduis cet extrait SRT de ${job.source_language} vers ${job.target_language}.\nRègles absolues : conserve exactement les numéros et timestamps ; traduis uniquement les lignes de texte ; retourne uniquement le SRT, sans markdown ni commentaire. Ceci est la partie ${index+1}/${chunks.length}.\n\n${chunks[index]}`;
    const result = await runAnthropicText(sb, { context: { module: "subtitles", action: "translate_srt", userId: job.requested_by, courseId: job.course_id, lessonId: job.lesson_id, blockId: job.block_id, metadata: { chunk: index + 1, chunks: chunks.length } }, tier: "quality", prompt, maxTokens: 7000, effort: "low" });
    const text = String(result.text || "").trim();
    if (!text.includes("-->")) throw new Error("SUBTITLE_TRANSLATION_INVALID");
    translated.push(text);
  }
  return `${translated.join("\n\n").trim()}\n`;
}
async function cleanupLegacyPublicSubtitleObjects(sb: any) {
  try {
    const storage = sb.storage.from("course-covers"); const paths: string[] = [];
    const walk = async (prefix: string, depth: number): Promise<void> => { if (depth > 4 || paths.length >= 5000) return; const { data } = await storage.list(prefix, { limit: 1000 }); for (const item of data || []) { const child = `${prefix}/${item.name}`; if (item.id || item.metadata) paths.push(child); else await walk(child, depth + 1); } };
    await walk("subtitles", 0); for (let i=0;i<paths.length;i+=100) await storage.remove(paths.slice(i,i+100));
  } catch (error) { console.warn("Legacy subtitle cleanup skipped", error); }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const cronSecret = String(Deno.env.get("CRON_SECRET") || "").trim();
  if (!isOmniaInternalRequest(req) && !(cronSecret && token === cronSecret)) return json({ error: "UNAUTHORIZED" }, 401);
  try {
    await cleanupLegacyPublicSubtitleObjects(sb);
    const body = await req.json().catch(() => ({}));
    let query = sb.from("subtitle_jobs").select("*").eq("status", "pending");
    if (body.job_id) query = query.eq("id", String(body.job_id));
    const { data: job } = await query.order("created_at").limit(1).maybeSingle();
    if (!job) return json({ success: true, message: "No pending jobs", processed: 0 });
    await sb.from("subtitle_jobs").update({ status: "processing", error_message: null }).eq("id", job.id);
    try {
      let block: any = null;
      if (job.block_id) block = (await sb.from("lesson_blocks").select("id,lesson_id,course_id,content_json,block_type").eq("id", job.block_id).maybeSingle()).data;
      if (!block) block = (await sb.from("lesson_blocks").select("id,lesson_id,course_id,content_json,block_type").eq("lesson_id", job.lesson_id).eq("block_type", "video").order("position", { ascending: false }).limit(1).maybeSingle()).data;
      if (!block || block.block_type !== "video") throw new Error("VIDEO_BLOCK_NOT_FOUND");
      const streamUid = String(block.content_json?.cloudflare_stream_uid || "").trim();
      if (!streamUid) throw new Error("NO_CLOUDFLARE_STREAM_UID");
      let sourceSrt = "";
      try {
        const caption = await fetchStreamCaption(streamUid, String(job.source_language || "fr"));
        if (caption.ok) { const vtt = await caption.text(); if (vtt.trim()) sourceSrt = vttToSrt(vtt); }
      } catch (error) { console.warn("Cloudflare captions unavailable", error); }
      if (!sourceSrt) {
        const signed = await signedStreamDownload(streamUid, 10 * 60);
        const media = await fetch(signed.url); if (!media.ok) throw new Error(`STREAM_DOWNLOAD_${media.status}`);
        const blob = await media.blob();
        const transcription = await runOpenAITranscription(sb, { context: { module: "subtitles", action: "transcribe", userId: job.requested_by, courseId: job.course_id, lessonId: job.lesson_id, blockId: block.id }, audio: blob, filename: "stream.mp4", language: String(job.source_language || "fr"), responseFormat: "srt" });
        sourceSrt = transcription.text;
      }
      const translatedSrt = await translateSrt(sb, { ...job, block_id: block.id }, sourceSrt);
      const vtt = srtToVtt(translatedSrt);
      // Upload the VTT back to Cloudflare Stream as the canonical playback caption.
      // Stream then exposes it automatically in the signed player/manifest.
      await uploadStreamCaption(streamUid, String(job.target_language || "fr"), vtt);
      const bucket = "course-resources";
      const base = `subtitles/${job.course_id}/${block.id}/${job.target_language}`;
      const srtPath = `${base}.srt`, vttPath = `${base}.vtt`;
      const srtUpload = await sb.storage.from(bucket).upload(srtPath, new TextEncoder().encode(translatedSrt), { contentType: "application/x-subrip", upsert: true }); if (srtUpload.error) throw srtUpload.error;
      const vttUpload = await sb.storage.from(bucket).upload(vttPath, new TextEncoder().encode(vtt), { contentType: "text/vtt", upsert: true }); if (vttUpload.error) throw vttUpload.error;
      const existingTracks = Array.isArray(block.content_json?.subtitles) ? block.content_json.subtitles : [];
      const track = { language: job.target_language, source_language: job.source_language, label: String(job.target_language || "").toUpperCase(), srt_url: storageRef(bucket, srtPath), vtt_url: storageRef(bucket, vttPath), generated_at: new Date().toISOString() };
      const tracks = [...existingTracks.filter((item: any) => String(item?.language) !== String(job.target_language)), track];
      await sb.from("lesson_blocks").update({ content_json: { ...(block.content_json || {}), subtitles: tracks, subtitles_available: true }, updated_at: new Date().toISOString() }).eq("id", block.id);
      await sb.from("course_lessons").update({ subtitles_available: true }).eq("id", block.lesson_id);
      await sb.from("subtitle_jobs").update({ block_id: block.id, status: "completed", storage_bucket: bucket, srt_storage_path: srtPath, vtt_storage_path: vttPath, srt_url: null, vtt_url: null, completed_at: new Date().toISOString(), error_message: null }).eq("id", job.id);
      const signedVtt = await sb.storage.from(bucket).createSignedUrl(vttPath, 3600);
      if (job.requested_by) fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/notify-dispatch`, { method: "POST", headers: omniaInternalHeaders(), body: JSON.stringify({ type: "subtitle_ready", user_id: job.requested_by, payload: { lesson_id: block.lesson_id, block_id: block.id, language: job.target_language } }) }).catch(() => {});
      return json({ success: true, processed: 1, job_id: job.id, block_id: block.id, language: job.target_language, preview_vtt_url: signedVtt.data?.signedUrl || null });
    } catch (error) {
      const ai = aiErrorPayload(error);
      const message = ai.error !== "AI_RUNTIME_ERROR" ? `${ai.error}: ${ai.message}` : (error instanceof Error ? error.message : String(error));
      await sb.from("subtitle_jobs").update({ status: "failed", error_message: message.slice(0, 1500) }).eq("id", job.id);
      throw error;
    }
  } catch (error) {
    console.error("subtitle-process", error);
    const ai = aiErrorPayload(error); if (ai.error !== "AI_RUNTIME_ERROR") return json({ error: ai.error, provider: ai.provider, message: ai.message }, ai.status);
    return json({ error: "SERVER_ERROR", message: error instanceof Error ? error.message : String(error) }, 500);
  }
});
