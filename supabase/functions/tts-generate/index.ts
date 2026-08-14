import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { corsHeaders } from "../_shared/cors.ts";

import { getActiveOmniaSessionResult } from "../_shared/omnia-auth.ts";
import { getOpenAITtsModel } from "../_shared/ai-models.ts";
import { storageRef } from "../_shared/protected-storage.ts";
function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  let body: { lesson_id?: string; text?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid body" }, 400); }
  const { lesson_id, text } = body;
  if (!text || !lesson_id) return json({ error: "text + lesson_id requis" }, 400);

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: sess } = await getActiveOmniaSessionResult(sb, token);
    if (!sess) return json({ error: "SESSION_INVALID" }, 401);

    // Call OpenAI TTS
    const ttsResponse = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: getOpenAITtsModel(),
        input: text.substring(0, 4096),
        voice: "nova",
        response_format: "mp3",
        speed: 0.9,
      }),
    });

    if (!ttsResponse.ok) {
      return json({ error: "TTS_FAILED", details: await ttsResponse.text() }, 500);
    }

    const audioBuffer = await ttsResponse.arrayBuffer();
    const audioBytes = new Uint8Array(audioBuffer);
    const storagePath = `audio/lessons/${lesson_id}/tts_${Date.now()}.mp3`;

    const { error: uploadError } = await sb.storage
      .from("course-audios")
      .upload(storagePath, audioBytes, { contentType: "audio/mpeg", upsert: true });

    if (uploadError) {
      return json({ error: "UPLOAD_FAILED", details: uploadError.message }, 500);
    }

    // Store only the private storage locator. lesson-content authorizes access
    // and replaces it with a short-lived signed URL for entitled learners.
    const audioUrl = storageRef("course-audios", storagePath);

    await sb.from("course_lessons").update({
      audio_url: audioUrl,
    }).eq("id", lesson_id);

    const wordCount = text.split(/\s+/).length;
    return json({
      success: true,
      audio_url: audioUrl,
      duration_estimate: Math.round(wordCount / 150 * 60),
    });
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
