import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

import { getActiveOmniaSessionResult } from "../_shared/omnia-auth.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function verifySuperAdmin(sb: ReturnType<typeof createClient>, token: string) {
  const { data: session, error: sessionError } = await getActiveOmniaSessionResult(sb, token);
  if (sessionError || !session) return null;

  const userId = String(session.user_id);
  const { data: role, error: roleError } = await sb
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (roleError || !role) return null;
  return userId;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED", message: "Session requise." }, 401);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return json({ error: "SERVER_CONFIG_ERROR", message: "Configuration Supabase incomplète." }, 500);

    const sb = createClient(url, key);
    const adminId = await verifySuperAdmin(sb, token);
    if (!adminId) return json({ error: "FORBIDDEN", message: "Accès administratif Omnia requis." }, 403);

    const body = await req.json().catch(() => ({}));
    const postId = String(body.post_id || "");
    const action = String(body.action || "");
    if (!postId || !["delete", "pin", "unpin"].includes(action)) {
      return json({ error: "INVALID_PARAMS", message: "Publication ou action invalide." }, 400);
    }

    const { data: post, error: postError } = await sb
      .from("forum_posts")
      .select("id,is_pinned")
      .eq("id", postId)
      .maybeSingle();
    if (postError) throw postError;
    if (!post) return json({ error: "POST_NOT_FOUND", message: "Publication introuvable." }, 404);

    if (action === "delete") {
      const { error: repliesError } = await sb.from("forum_replies").delete().eq("post_id", postId);
      if (repliesError) throw repliesError;
      const { error: deleteError } = await sb.from("forum_posts").delete().eq("id", postId);
      if (deleteError) throw deleteError;
      return json({ success: true, action });
    }

    const { error: updateError } = await sb
      .from("forum_posts")
      .update({ is_pinned: action === "pin" })
      .eq("id", postId);
    if (updateError) throw updateError;

    return json({ success: true, action });
  } catch (error) {
    console.error("admin-forum-action", error);
    return json({
      error: "SERVER_ERROR",
      message: error instanceof Error ? error.message : "Erreur interne du forum.",
    }, 500);
  }
});
