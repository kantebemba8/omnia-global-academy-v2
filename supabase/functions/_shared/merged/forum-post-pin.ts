import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getModeratorAccess, hasModeratorConflict } from "../moderator-access.ts";

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

  const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", sess.user_id);
  const roleNames = (roles || []).map((row: { role: string }) => String(row.role));
  const isAdmin = roleNames.includes("super_admin");
  const isModerator = roleNames.includes("moderateur");
  if (!isAdmin && !isModerator) return json({ error: "FORBIDDEN" }, 403);
  if (isModerator && !isAdmin) {
    const access = await getModeratorAccess(sb, String(sess.user_id));
    if (!access.active || !access.permissions.can_moderate_forum) return json({ error: "FORBIDDEN" }, 403);
  }

  const { post_id, pinned } = await req.json() as { post_id: string; pinned: boolean };
  if (!post_id) return json({ error: "MISSING_POST_ID" }, 400);

  if (isModerator && !isAdmin) {
    const { data: post, error: postError } = await sb.from("forum_posts").select("id,user_id").eq("id", post_id).maybeSingle();
    if (postError) throw postError;
    if (!post) return json({ error: "POST_NOT_FOUND" }, 404);
    if (await hasModeratorConflict(sb, String(sess.user_id), "forum_post", post_id, [String(post.user_id)])) {
      return json({ error: "CONFLICT_OF_INTEREST" }, 403);
    }
  }

  await sb.from("forum_posts").update({ is_pinned: pinned }).eq("id", post_id);

  return json({ success: true, is_pinned: pinned });
}
