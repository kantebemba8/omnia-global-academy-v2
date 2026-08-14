import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

import { isOmniaInternalRequest, omniaInternalHeaders } from "../_shared/omnia-auth.ts";
import { getAnthropicApiKey, getAnthropicQualityModel, getOpenAISubtitleTranscriptionModel } from "../_shared/ai-models.ts";
import { fetchStreamCaption, signedStreamDownload } from "../_shared/cloudflare-stream.ts";
import { corsHeaders } from "../_shared/cors.ts";

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function srtToVtt(srt: string): string {
  return (
    "WEBVTT\n\n" +
    srt
      .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2")
      .replace(/^\d+\s*$/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

function vttToSrt(vtt: string): string {
  const normalized = String(vtt || "").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const blocks = normalized.split(/\n{2,}/);
  const cues: string[] = [];

  for (const block of blocks) {
    const lines = block.split("\n").map((line) => line.trimEnd());
    const timestampIndex = lines.findIndex((line) => line.includes("-->"));
    if (timestampIndex < 0) continue;

    const match = lines[timestampIndex].match(
      /(?:(\d{2}):)?(\d{2}):(\d{2})\.(\d{3})\s+-->\s+(?:(\d{2}):)?(\d{2}):(\d{2})\.(\d{3})/,
    );
    if (!match) continue;

    const startHours = match[1] || "00";
    const endHours = match[5] || "00";
    const timestamp = `${startHours}:${match[2]}:${match[3]},${match[4]} --> ${endHours}:${match[6]}:${match[7]},${match[8]}`;
    const textLines = lines.slice(timestampIndex + 1).filter((line) => line.trim());
    if (!textLines.length) continue;

    cues.push(`${cues.length + 1}\n${timestamp}\n${textLines.join("\n")}`);
  }

  if (!cues.length) throw new Error("CLOUDFLARE_STREAM_CAPTION_VTT_INVALID");
  return `${cues.join("\n\n")}\n`;
}

async function cleanupLegacyPublicSubtitleObjects(sb: ReturnType<typeof createClient>): Promise<void> {
  const storage = sb.storage.from("course-covers");
  const paths: string[] = [];

  async function walk(prefix: string, depth: number): Promise<void> {
    if (depth > 4 || paths.length >= 5000) return;
    for (let offset = 0; offset < 5000; offset += 1000) {
      const { data, error } = await storage.list(prefix, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
      if (error) throw error;
      const items = data || [];
      for (const item of items) {
        const child = `${prefix}/${item.name}`;
        if (item.id || item.metadata) paths.push(child);
        else await walk(child, depth + 1);
        if (paths.length >= 5000) break;
      }
      if (items.length < 1000 || paths.length >= 5000) break;
    }
  }

  try {
    await walk("subtitles", 0);
    for (let offset = 0; offset < paths.length; offset += 100) {
      const { error } = await storage.remove(paths.slice(offset, offset + 100));
      if (error) throw error;
    }
    if (paths.length) console.info(`Removed ${paths.length} legacy public subtitle object(s)`);
  } catch (error) {
    // Best effort only: subtitle processing itself must not be blocked by old cleanup.
    console.warn("Legacy public subtitle cleanup failed", error instanceof Error ? error.message : String(error));
  }
}

async function transcribeForSubtitles(audioUrl: string, openaiKey: string, sourceLanguage: string): Promise<string> {
  // Fetch audio content
  const audioResp = await fetch(audioUrl);
  if (!audioResp.ok) throw new Error(`Failed to fetch audio: ${audioResp.status}`);
  const audioBuffer = await audioResp.arrayBuffer();

  const formData = new FormData();
  formData.append("file", new Blob([audioBuffer], { type: "audio/mp4" }), "audio.mp4");
  formData.append("model", getOpenAISubtitleTranscriptionModel());
  formData.append("language", sourceLanguage);
  formData.append("response_format", "srt");

  const whisperResp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${openaiKey}` },
    body: formData,
  });

  if (!whisperResp.ok) {
    const err = await whisperResp.json();
    throw new Error(err.error?.message || "Whisper transcription failed");
  }

  return await whisperResp.text();
}

async function translateSrtWithClaude(srtContent: string, sourceLang: string, targetLang: string, claudeKey: string): Promise<string> {
  const prompt = `Translate this SRT subtitle file from ${sourceLang} to ${targetLang}.

CRITICAL RULES:
- Keep ALL timestamp lines EXACTLY as-is (format: 00:00:00,000 --> 00:00:00,000)
- Keep ALL sequence numbers EXACTLY as-is
- Only translate the text content lines
- Maintain natural spoken language tone
- Keep technical terms if no equivalent exists
- Return ONLY the translated SRT, no explanations

SRT content:
${srtContent}`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": claudeKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: getAnthropicQualityModel(),
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!resp.ok) throw new Error("Claude translation failed");
  const data = await resp.json();
  return data.content?.[0]?.text || srtContent;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Headless execution: dedicated Cron secret or dedicated Omnia internal secret.
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
  const cronSecret = (Deno.env.get("CRON_SECRET") || "").trim();
  const isAuthorized = isOmniaInternalRequest(req) || Boolean(cronSecret && token === cronSecret);
  if (!isAuthorized) return json({ error: "UNAUTHORIZED" }, 401);

  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  const claudeKey = getAnthropicApiKey();
  if (!openaiKey || !claudeKey) return json({ error: "AI_NOT_CONFIGURED" }, 500);

  // Remove old subtitle files that were historically written into the public
  // course-covers bucket. New files are stored only in private course-resources.
  await cleanupLegacyPublicSubtitleObjects(sb);

  // Fetch one pending job
  const { data: job } = await sb.from("subtitle_jobs")
    .select("*")
    .eq("status", "pending")
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (!job) return json({ message: "No pending jobs", processed: 0 });

  // Mark as processing
  await sb.from("subtitle_jobs").update({ status: "processing" }).eq("id", job.id);

  try {
    // Fetch lesson video info
    const { data: lesson } = await sb.from("course_lessons")
      .select("cloudflare_stream_uid, course_id")
      .eq("id", job.lesson_id).maybeSingle();

    if (!lesson?.cloudflare_stream_uid) throw new Error("No Cloudflare Stream UID");

    let srtContent: string | null = null;

    // Try Cloudflare Stream captions first through the canonical authenticated
    // VTT endpoint, then normalize to SRT for the existing translation pipeline.
    try {
      const cfResp = await fetchStreamCaption(String(lesson.cloudflare_stream_uid), String(job.source_language || "fr"));
      if (cfResp.ok) {
        const vttContent = await cfResp.text();
        if (vttContent.trim()) srtContent = vttToSrt(vttContent);
      }
    } catch (error) {
      console.warn("Cloudflare captions unavailable", error instanceof Error ? error.message : String(error));
    }

    // Fallback: obtain a short-lived downloadable Stream URL, then transcribe.
    // Whisper remains intentional here because Omnia requires SRT timestamps.
    if (!srtContent) {
      const signed = await signedStreamDownload(String(lesson.cloudflare_stream_uid), 10 * 60);
      srtContent = await transcribeForSubtitles(signed.url, openaiKey, job.source_language);
    }

    // Translate with Claude if source != target
    let translatedSrt = srtContent;
    if (job.source_language !== job.target_language) {
      translatedSrt = await translateSrtWithClaude(srtContent, job.source_language, job.target_language, claudeKey);
    }

    // Convert SRT to VTT
    const vttContent = srtToVtt(translatedSrt);

    // Course subtitles are learning content and must never be placed in a public bucket.
    const subtitleBucket = "course-resources";
    const srtPath = `subtitles/${job.course_id}/${job.lesson_id}_${job.target_language}.srt`;
    const vttPath = `subtitles/${job.course_id}/${job.lesson_id}_${job.target_language}.vtt`;

    const srtUpload = await sb.storage.from(subtitleBucket).upload(srtPath, new TextEncoder().encode(translatedSrt), {
      contentType: "text/plain", upsert: true,
    });
    if (srtUpload.error) throw srtUpload.error;
    const vttUpload = await sb.storage.from(subtitleBucket).upload(vttPath, new TextEncoder().encode(vttContent), {
      contentType: "text/vtt", upsert: true,
    });
    if (vttUpload.error) throw vttUpload.error;

    const signedVtt = await sb.storage.from(subtitleBucket).createSignedUrl(vttPath, 24 * 60 * 60);
    if (signedVtt.error || !signedVtt.data?.signedUrl) throw signedVtt.error || new Error("SUBTITLE_SIGNED_URL_FAILED");
    const signedVttExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Persist storage references, never permanent public URLs.
    await sb.from("subtitle_jobs").update({
      status: "completed",
      storage_bucket: subtitleBucket,
      srt_storage_path: srtPath,
      vtt_storage_path: vttPath,
      srt_url: null,
      vtt_url: null,
      completed_at: new Date().toISOString(),
      error_message: null,
    }).eq("id", job.id);

    // Mark lesson subtitles available
    await sb.from("course_lessons").update({ subtitles_available: true }).eq("id", job.lesson_id);

    // Notify the professor
    if (job.requested_by) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      fetch(`${supabaseUrl}/functions/v1/notify-dispatch`, {
        method: "POST",
        headers: omniaInternalHeaders(),
        body: JSON.stringify({
          type: "subtitle_ready",
          user_id: job.requested_by,
          payload: { lesson_id: job.lesson_id, vtt_url: signedVtt.data.signedUrl, vtt_url_expires_at: signedVttExpiresAt },
        }),
      }).catch(() => {});
    }

    return json({ success: true, processed: 1, job_id: job.id });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const retryable = errorMsg.includes("CLOUDFLARE_STREAM_DOWNLOAD_NOT_READY");
    await sb.from("subtitle_jobs").update({
      status: retryable ? "pending" : "failed",
      error_message: errorMsg,
    }).eq("id", job.id);
    return json({ success: false, retryable, error: errorMsg, job_id: job.id }, retryable ? 202 : 500);
  }
});
