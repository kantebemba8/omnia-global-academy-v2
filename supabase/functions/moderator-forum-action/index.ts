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

async function verifyModerator(sb: ReturnType<typeof createClient>, token: string) {
  const { data: sess } = await sb.from("user_sessions").select("user_id").eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!sess) return null;
  const { data: role } = await sb.from("user_roles").select("role").eq("user_id", (sess as unknown as { user_id: string }).user_id).eq("role", "moderateur").maybeSingle();
  if (!role) return null;
  return (sess as unknown as { user_id: string }).user_id;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const modId = await verifyModerator(sb, token);
    if (!modId) return json({ error: "FORBIDDEN" }, 403);

    const { data: permsRow } = await sb.from("moderator_permissions").select("can_moderate_forum").eq("moderator_user_id", modId).maybeSingle();
    const perms = permsRow as unknown as Record<string, boolean> | null ?? {};
    if (!perms.can_moderate_forum) return json({ error: "FORBIDDEN", message: "Permission can_moderate_forum requise." }, 403);

    // GET — list posts
    if (req.method === "GET") {
      const { data: flagged } = await sb.from("forum_posts").select("id,user_id,space,title,content,is_visible,is_flagged,flagged_reason,created_at").eq("is_flagged", true).order("created_at", { ascending: true }).limit(50);
      const { data: allPosts } = await sb.from("forum_posts").select("id,user_id,space,title,content,is_visible,is_flagged,created_at").order("created_at", { ascending: false }).limit(100);

      // Enrich with user info
      const enrich = async (posts: unknown[]) => {
        return await Promise.all((posts ?? []).map(async (p) => {
          const pp = p as unknown as { id: string; user_id: string; space: string; title: string | null; content: string; is_visible: boolean; is_flagged: boolean; flagged_reason?: string; created_at: string };
          const { data: u } = await sb.from("users").select("full_name").eq("id", pp.user_id).maybeSingle();
          return { ...pp, author_name: (u as unknown as { full_name: string } | null)?.full_name ?? "—" };
        }));
      };

      return json({ flagged_posts: await enrich(flagged ?? []), all_posts: await enrich(allPosts ?? []) });
    }

    // POST — hide / restore
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const body = await req.json();
    const { post_id, action } = body as { post_id: string; action: "hide" | "restore" | "unflag" };
    if (!post_id || !["hide", "restore", "unflag"].includes(action)) return json({ error: "INVALID_PARAMS" }, 400);

    if (action === "hide") await sb.from("forum_posts").update({ is_visible: false }).eq("id", post_id);
    else if (action === "restore") await sb.from("forum_posts").update({ is_visible: true }).eq("id", post_id);
    else if (action === "unflag") await sb.from("forum_posts").update({ is_flagged: false, flagged_reason: null }).eq("id", post_id);

    await sb.from("moderation_log").insert({ moderator_id: modId, action_type: action === "hide" ? "forum_post_removed" : "forum_post_restored", target_type: "forum_post", target_id: post_id });
    return json({ success: true });
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
