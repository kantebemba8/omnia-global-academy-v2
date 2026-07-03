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

  // Check moderator or super_admin role
  const { data: roles } = await sb.from("user_roles").select("role")
    .eq("user_id", sess.user_id).in("role", ["moderateur", "super_admin"]);
  if (!roles?.length) return json({ error: "FORBIDDEN" }, 403);

  const { post_id, pinned } = await req.json() as { post_id: string; pinned: boolean };
  if (!post_id) return json({ error: "MISSING_POST_ID" }, 400);

  await sb.from("forum_posts").update({ is_pinned: pinned }).eq("id", post_id);

  return json({ success: true, is_pinned: pinned });
});
