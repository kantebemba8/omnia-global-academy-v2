import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { corsHeaders } from "../_shared/cors.ts";

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function verifySuperAdmin(sb: ReturnType<typeof createClient>, token: string) {
  const { data: sess } = await sb.from("user_sessions").select("user_id")
    .eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!sess) return null;
  const { data: role } = await sb.from("user_roles").select("role")
    .eq("user_id", (sess as { user_id: string }).user_id).eq("role", "super_admin").maybeSingle();
  if (!role) return null;
  return (sess as { user_id: string }).user_id;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const adminId = await verifySuperAdmin(sb, token);
    if (!adminId) return json({ error: "FORBIDDEN" }, 403);

    const body = await req.json() as { post_id?: string; action?: string };
    const { post_id, action } = body;

    if (!post_id || !action) return json({ error: "MISSING_PARAMS" }, 400);

    // Vérifier que le post existe
    const { data: post } = await sb.from("forum_posts").select("id, is_pinned").eq("id", post_id).maybeSingle();
    if (!post) return json({ error: "POST_NOT_FOUND" }, 404);

    if (action === "delete") {
      // Supprimer les réponses d'abord
      await sb.from("forum_replies").delete().eq("post_id", post_id);
      // Supprimer le post
      await sb.from("forum_posts").delete().eq("id", post_id);
      return json({ success: true, action: "delete" });
    }

    if (action === "pin") {
      await sb.from("forum_posts").update({ is_pinned: true }).eq("id", post_id);
      return json({ success: true, action: "pin" });
    }

    if (action === "unpin") {
      await sb.from("forum_posts").update({ is_pinned: false }).eq("id", post_id);
      return json({ success: true, action: "unpin" });
    }

    return json({ error: "UNKNOWN_ACTION" }, 400);

  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR", message: (err as Error).message }, 500);
  }
});
