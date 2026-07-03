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

function chunkText(text: string, maxWords = 400): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
  const chunks: string[] = [];
  let current = "";
  let wordCount = 0;

  for (const sentence of sentences) {
    const words = sentence.trim().split(/\s+/).length;
    if (wordCount + words > maxWords && current) {
      chunks.push(current.trim());
      current = sentence;
      wordCount = words;
    } else {
      current += (current ? " " : "") + sentence;
      wordCount += words;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [text.trim()];
}

async function getEmbedding(text: string, openaiKey: string): Promise<number[]> {
  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error?.message || "OpenAI embedding error");
  return data.data[0].embedding;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Accept service role key OR valid admin session
  if (token !== serviceKey) {
    const { data: sess } = await sb.from("user_sessions").select("user_id")
      .eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (!sess) return json({ error: "AUTH_REQUIRED" }, 401);
    const { data: u } = await sb.from("users").select("role").eq("id", sess.user_id).maybeSingle();
    if (!u || u.role !== "super_admin") return json({ error: "FORBIDDEN" }, 403);
  }

  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) return json({ error: "OPENAI_NOT_CONFIGURED" }, 500);

  const body = await req.json() as { course_id: string };
  if (!body.course_id) return json({ error: "COURSE_ID_REQUIRED" }, 400);
  const { course_id } = body;

  // Fetch course title
  const { data: course } = await sb.from("courses").select("title").eq("id", course_id).maybeSingle();
  if (!course) return json({ error: "COURSE_NOT_FOUND" }, 404);

  // Fetch all lessons with text content
  const { data: lessons } = await sb.from("course_lessons")
    .select("id, title, content_text")
    .eq("course_id", course_id)
    .not("content_text", "is", null)
    .order("position");

  if (!lessons || lessons.length === 0) {
    return json({ success: true, chunks_indexed: 0, lessons_processed: 0 });
  }

  let totalChunks = 0;
  let lessonsProcessed = 0;

  for (const lesson of lessons) {
    const text = (lesson.content_text as string || "").trim();
    if (text.length < 50) continue;

    const rawChunks = chunkText(text);
    for (let i = 0; i < rawChunks.length; i++) {
      const prefixed = `[Cours: ${course.title}] [Leçon: ${lesson.title}] ${rawChunks[i]}`;
      try {
        const embedding = await getEmbedding(prefixed, openaiKey);
        await sb.from("rag_chunks").upsert({
          course_id,
          lesson_id: lesson.id,
          chunk_index: i,
          content: prefixed,
          embedding: JSON.stringify(embedding),
        }, { onConflict: "lesson_id,chunk_index" });
        totalChunks++;
      } catch (e) {
        console.error(`Chunk ${i} of lesson ${lesson.id} failed:`, e);
      }
      // Small delay to avoid rate limits
      if (totalChunks % 10 === 0) await new Promise(r => setTimeout(r, 200));
    }
    lessonsProcessed++;
  }

  return json({ success: true, chunks_indexed: totalChunks, lessons_processed: lessonsProcessed });
});
