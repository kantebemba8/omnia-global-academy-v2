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

  const body = await req.json();
  const { parent_id, content } = body as { parent_id: string; content: string };

  if (!parent_id || !content) return json({ error: "MISSING_FIELDS" }, 400);
  if (content.length < 10 || content.length > 2000) return json({ error: "CONTENT_LENGTH", min: 10, max: 2000 }, 422);

  const { data: parent } = await sb.from("forum_posts").select("id, space, course_id, country_code, is_visible")
    .eq("id", parent_id).maybeSingle();
  if (!parent || !parent.is_visible) return json({ error: "POST_NOT_FOUND" }, 404);

  const { data: reply, error: replyErr } = await sb.from("forum_posts").insert({
    user_id: userId,
    parent_id,
    space: parent.space,
    course_id: parent.course_id || null,
    country_code: parent.country_code || null,
    title: null,
    content,
    is_visible: true,
    likes_count: 0,
    replies_count: 0,
  }).select("id").single();

  if (replyErr) return json({ error: "INSERT_FAILED", detail: replyErr.message }, 500);

  // Increment parent replies_count
  await sb.from("forum_posts").update({ replies_count: (parent as unknown as Record<string, unknown>).replies_count as number + 1 })
    .eq("id", parent_id).catch(() => {});
  // Safer: use RPC-like increment
  await sb.rpc("increment_replies_count", { post_id: parent_id }).catch(() => {});

  return json({ success: true, reply_id: reply.id });
});
