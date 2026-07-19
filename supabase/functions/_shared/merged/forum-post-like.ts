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

export async function handler(req: Request) {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  const { data: sess } = await sb.from("user_sessions").select("user_id")
    .eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!sess) return json({ error: "SESSION_INVALID" }, 401);
  const userId = sess.user_id;

  const { post_id } = await req.json() as { post_id: string };
  if (!post_id) return json({ error: "MISSING_POST_ID" }, 400);

  const { data: post } = await sb.from("forum_posts").select("id, likes_count").eq("id", post_id).maybeSingle();
  if (!post) return json({ error: "POST_NOT_FOUND" }, 404);

  const { data: existing } = await sb.from("forum_likes").select("id")
    .eq("post_id", post_id).eq("user_id", userId).maybeSingle();

  let liked: boolean;
  let newCount: number;

  if (existing) {
    // Unlike
    await sb.from("forum_likes").delete().eq("post_id", post_id).eq("user_id", userId);
    newCount = Math.max(0, (post.likes_count || 0) - 1);
    liked = false;
  } else {
    // Like
    await sb.from("forum_likes").insert({ post_id, user_id: userId });
    newCount = (post.likes_count || 0) + 1;
    liked = true;
  }

  await sb.from("forum_posts").update({ likes_count: newCount }).eq("id", post_id);

  return json({ liked, likes_count: newCount });
}
