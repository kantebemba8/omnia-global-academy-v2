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

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();

  // GET — load full wizard data for a course
  if (req.method === "GET") {
    if (!token) return json({ error: "AUTH_REQUIRED" }, 401);
    const url = new URL(req.url);
    const course_id = url.searchParams.get("course_id");
    if (!course_id) return json({ error: "course_id requis" }, 400);
    try {
      const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
      const { data: sess } = await sb.from("user_sessions").select("user_id").eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
      if (!sess) return json({ error: "SESSION_INVALID" }, 401);
      const { data: course } = await sb.from("courses").select("*").eq("id", course_id).eq("instructor_id", sess.user_id).maybeSingle();
      if (!course) return json({ error: "COURSE_NOT_FOUND" }, 404);
      const { data: modules } = await sb.from("course_modules").select("id,title,objective,position").eq("course_id", course_id).order("position");
      const moduleIds = (modules ?? []).map((m) => (m as unknown as { id: string }).id);
      const { data: lessons } = moduleIds.length > 0
        ? await sb.from("course_lessons").select("id,title,text_content,lesson_summary,video_url,audio_url,duration_seconds,content_type,position,module_id").in("module_id", moduleIds).order("position")
        : { data: [] };
      const lessonIds = (lessons ?? []).map((l) => (l as unknown as { id: string }).id);
      const { data: questions } = lessonIds.length > 0
        ? await sb.from("course_questions").select("id,lesson_id,question_text,options,correct_answer").in("lesson_id", lessonIds)
        : { data: [] };
      const { data: resources } = lessonIds.length > 0
        ? await sb.from("lesson_resources").select("id,lesson_id,resource_type,title,url,file_url,position").in("lesson_id", lessonIds)
        : { data: [] };
      return json({ course, modules: modules ?? [], lessons: lessons ?? [], questions: questions ?? [], resources: resources ?? [] });
    } catch (err) { console.error(err); return json({ error: "SERVER_ERROR" }, 500); }
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  let body: {
    action?: string; course_id?: string;
    data?: Record<string, unknown>;
    module_id?: string; lesson_id?: string;
    question_text?: string; resource?: Record<string, unknown>;
  };
  try { body = await req.json(); } catch { return json({ error: "Invalid body" }, 400); }
  const { action, course_id, data } = body;
  if (!action) return json({ error: "action requis" }, 400);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const { data: sess } = await sb.from("user_sessions").select("user_id").eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (!sess) return json({ error: "SESSION_INVALID" }, 401);
    const userId = sess.user_id;

    const { data: roleRow } = await sb.from("user_roles").select("role").eq("user_id", userId).eq("role", "professeur").maybeSingle();
    if (!roleRow) return json({ error: "FORBIDDEN" }, 403);

    // ── action: init ──
    if (action === "init") {
      const { data: course, error } = await sb.from("courses").insert({
        instructor_id: userId,
        title: data?.title || "Nouvelle formation",
        status: "brouillon",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).select("id,title,status").single();
      if (error) throw error;
      return json({ course });
    }

    // All other actions require course_id
    if (!course_id) return json({ error: "course_id requis" }, 400);

    // Verify ownership
    const { data: courseRow } = await sb.from("courses").select("id,instructor_id").eq("id", course_id).maybeSingle();
    if (!courseRow || (courseRow as unknown as { instructor_id: string }).instructor_id !== userId) return json({ error: "FORBIDDEN" }, 403);

    // ── action: save_step ──
    if (action === "save_step") {
      if (!data) return json({ error: "data requis" }, 400);
      const allowedFields = ["title", "description", "description_courte", "category", "level", "language", "prerequisites", "objectives", "presentation_video_url", "cover_image_url", "requested_cpd", "final_validation_type", "final_project_instructions", "has_oral_exam", "oral_exam_instructions"];
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const k of allowedFields) {
        if (data[k] !== undefined) updates[k] = data[k];
      }
      await sb.from("courses").update(updates).eq("id", course_id);
      return json({ success: true });
    }

    // ── action: add_module ──
    if (action === "add_module") {
      const { data: existingModules } = await sb.from("course_modules").select("id").eq("course_id", course_id);
      const position = (existingModules?.length ?? 0) + 1;
      const { data: mod, error } = await sb.from("course_modules").insert({
        course_id,
        title: (data?.title as string) || `Module ${position}`,
        objective: (data?.objective as string) || null,
        position,
      }).select("id,title,position,objective").single();
      if (error) throw error;
      return json({ module: mod });
    }

    // ── action: add_lesson ──
    if (action === "add_lesson") {
      const { module_id } = body;
      if (!module_id) return json({ error: "module_id requis" }, 400);
      const { data: existingLessons } = await sb.from("course_lessons").select("id").eq("module_id", module_id);
      const position = (existingLessons?.length ?? 0) + 1;
      const { data: lesson, error } = await sb.from("course_lessons").insert({
        module_id,
        course_id,
        title: (data?.title as string) || `Leçon ${position}`,
        content_type: "text",
        position,
      }).select("id,title,position,module_id").single();
      if (error) throw error;
      return json({ lesson });
    }

    // ── action: add_question ──
    if (action === "add_question") {
      const { lesson_id, question_text } = body;
      if (!lesson_id || !question_text) return json({ error: "lesson_id + question_text requis" }, 400);
      const { data: q, error } = await sb.from("course_questions").insert({
        lesson_id,
        module_id: data?.module_id ?? null,
        question_text,
        options: null,
        correct_answer: null,
      }).select("id,question_text").single();
      if (error) throw error;
      return json({ question: q });
    }

    // ── action: add_resource ──
    if (action === "add_resource") {
      const { lesson_id, resource } = body;
      if (!lesson_id || !resource) return json({ error: "lesson_id + resource requis" }, 400);
      const { data: res, error } = await sb.from("lesson_resources").insert({
        lesson_id,
        resource_type: resource.resource_type,
        title: resource.title,
        url: resource.url ?? null,
        file_url: resource.file_url ?? null,
        position: resource.position ?? 0,
      }).select("id,resource_type,title").single();
      if (error) throw error;
      return json({ resource: res });
    }

    // ── action: save_lesson_content ──
    if (action === "save_lesson_content") {
      const { lesson_id } = body;
      if (!lesson_id || !data) return json({ error: "lesson_id + data requis" }, 400);
      const allowed = ["title", "text_content", "lesson_summary", "video_url", "audio_url", "duration_seconds", "cloudflare_stream_uid", "content_type"];
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const k of allowed) { if (data[k] !== undefined) updates[k] = data[k]; }
      await sb.from("course_lessons").update(updates).eq("id", lesson_id).eq("course_id", course_id);
      return json({ success: true });
    }

    // ── action: generate_cover_ai ──
    if (action === "generate_cover_ai") {
      const title = (data?.title as string) || "Formation professionnelle";
      const category = (data?.category as string) || "Business";
      const openaiKey = Deno.env.get("OPENAI_API_KEY");
      if (!openaiKey) return json({ error: "OpenAI non configuré" }, 500);

      const prompt = `Professional online course cover image for a course titled "${title}" in the category "${category}". Abstract, geometric, modern style. NO people, NO faces, NO hands. Use colors: deep navy blue and gold. 16:9 aspect ratio. Clean and professional.`;

      const aiRes = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({ model: "dall-e-3", prompt, n: 1, size: "1792x1024", quality: "standard" }),
      });
      if (!aiRes.ok) {
        const errText = await aiRes.text();
        console.error("DALL-E error:", errText);
        return json({ error: "IMAGE_GENERATION_FAILED" }, 500);
      }
      const aiJson = await aiRes.json() as { data: Array<{ url: string }> };
      const imageUrl = aiJson.data?.[0]?.url;
      if (!imageUrl) return json({ error: "No image returned" }, 500);

      // Download and upload to Supabase storage
      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) return json({ error: "Failed to download image" }, 500);
      const imgBuffer = await imgRes.arrayBuffer();
      const path = `covers/${course_id}/ai_cover_${Date.now()}.png`;
      const { error: uploadErr } = await sb.storage.from("course-covers").upload(path, imgBuffer, { contentType: "image/png", upsert: true });
      if (uploadErr) {
        // Fall through and return the raw URL if upload fails
        await sb.from("courses").update({ cover_image_url: imageUrl, updated_at: new Date().toISOString() }).eq("id", course_id);
        return json({ cover_url: imageUrl, ai_generated: true });
      }
      const { data: publicUrl } = sb.storage.from("course-covers").getPublicUrl(path);
      await sb.from("courses").update({ cover_image_url: publicUrl.publicUrl, updated_at: new Date().toISOString() }).eq("id", course_id);
      return json({ cover_url: publicUrl.publicUrl, ai_generated: true });
    }

    return json({ error: "Action inconnue" }, 400);
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
