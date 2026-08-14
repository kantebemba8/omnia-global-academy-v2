import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

import { isOmniaInternalRequest, omniaInternalHeaders } from "../_shared/omnia-auth.ts";
import { getAnthropicApiKey, getAnthropicQualityModel, getOpenAISubtitleTranscriptionModel } from "../_shared/ai-models.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-omnia-internal-secret",
};

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
      .select("cloudflare_stream_id, course_id")
      .eq("id", job.lesson_id).maybeSingle();

    if (!lesson?.cloudflare_stream_id) throw new Error("No Cloudflare stream ID");

    const cfAccountId = Deno.env.get("CF_ACCOUNT_ID");
    const cfStreamToken = Deno.env.get("CF_STREAM_API_TOKEN");

    let srtContent: string | null = null;

    // Try Cloudflare Stream auto-captions first
    if (cfAccountId && cfStreamToken) {
      const cfResp = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/stream/${lesson.cloudflare_stream_id}/captions/${job.source_language}`,
        { headers: { "Authorization": `Bearer ${cfStreamToken}` } }
      );
      if (cfResp.ok) {
        const cfData = await cfResp.json();
        if (cfData.result?.src) {
          const captionResp = await fetch(cfData.result.src);
          if (captionResp.ok) srtContent = await captionResp.text();
        }
      }
    }

    // Fallback: subtitle transcription. Whisper remains intentional here because SRT/timestamps are required.
    if (!srtContent) {
      const videoUrl = `https://videodelivery.net/${lesson.cloudflare_stream_id}/downloads/default.mp4`;
      srtContent = await transcribeForSubtitles(videoUrl, openaiKey, job.source_language);
    }

    // Translate with Claude if source != target
    let translatedSrt = srtContent;
    if (job.source_language !== job.target_language) {
      translatedSrt = await translateSrtWithClaude(srtContent, job.source_language, job.target_language, claudeKey);
    }

    // Convert SRT to VTT
    const vttContent = srtToVtt(translatedSrt);

    // Upload both to Supabase Storage
    const srtPath = `subtitles/${job.course_id}/${job.lesson_id}_${job.target_language}.srt`;
    const vttPath = `subtitles/${job.course_id}/${job.lesson_id}_${job.target_language}.vtt`;

    await sb.storage.from("course-covers").upload(srtPath, new TextEncoder().encode(translatedSrt), {
      contentType: "text/plain", upsert: true,
    });
    await sb.storage.from("course-covers").upload(vttPath, new TextEncoder().encode(vttContent), {
      contentType: "text/vtt", upsert: true,
    });

    const { data: srtUrlData } = sb.storage.from("course-covers").getPublicUrl(srtPath);
    const { data: vttUrlData } = sb.storage.from("course-covers").getPublicUrl(vttPath);

    // Update job as completed
    await sb.from("subtitle_jobs").update({
      status: "completed",
      srt_url: srtUrlData.publicUrl,
      vtt_url: vttUrlData.publicUrl,
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
          payload: { lesson_id: job.lesson_id, vtt_url: vttUrlData.publicUrl },
        }),
      }).catch(() => {});
    }

    return json({ success: true, processed: 1, job_id: job.id });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await sb.from("subtitle_jobs").update({
      status: "failed",
      error_message: errorMsg,
    }).eq("id", job.id);
    return json({ success: false, error: errorMsg, job_id: job.id }, 500);
  }
});
