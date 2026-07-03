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

  const { post_id, reply_id } = await req.json() as { post_id: string; reply_id: string };
  if (!post_id || !reply_id) return json({ error: "MISSING_FIELDS" }, 400);

  const { data: post } = await sb.from("forum_posts").select("id, user_id")
    .eq("id", post_id).is("parent_id", null).maybeSingle();
  if (!post) return json({ error: "POST_NOT_FOUND" }, 404);
  if (post.user_id !== userId) return json({ error: "FORBIDDEN" }, 403);

  const { data: reply } = await sb.from("forum_posts").select("id")
    .eq("id", reply_id).eq("parent_id", post_id).maybeSingle();
  if (!reply) return json({ error: "REPLY_NOT_FOUND" }, 404);

  await sb.from("forum_posts").update({ is_solved: true, solved_reply_id: reply_id }).eq("id", post_id);

  return json({ success: true });
});
