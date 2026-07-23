import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Session = { userId: string; roles: string[] };

async function authenticate(sb: ReturnType<typeof createClient>, token: string): Promise<Session | null> {
  const { data: session, error: sessionError } = await sb
    .from("user_sessions")
    .select("user_id")
    .eq("session_token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (sessionError || !session) return null;

  const userId = String(session.user_id);
  const { data: roles, error: rolesError } = await sb
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (rolesError) return null;

  return { userId, roles: (roles || []).map((row: any) => String(row.role)) };
}

async function canModerateForum(sb: ReturnType<typeof createClient>, session: Session) {
  if (session.roles.includes("super_admin")) return true;
  if (!session.roles.includes("moderateur")) return false;

  const { data: permission, error } = await sb
    .from("moderator_permissions")
    .select("can_moderate_forum")
    .eq("moderator_user_id", session.userId)
    .maybeSingle();
  if (error) return false;
  return permission?.can_moderate_forum === true;
}

async function enrichPosts(sb: ReturnType<typeof createClient>, rows: any[]) {
  const userIds = [...new Set((rows || []).map((row: any) => row.user_id).filter(Boolean))];
  let users: any[] = [];
  if (userIds.length) {
    const { data } = await sb.from("users").select("id,full_name").in("id", userIds);
    users = data || [];
  }
  const names = new Map(users.map((user: any) => [String(user.id), user.full_name || "Utilisateur"]));
  return (rows || []).map((row: any) => ({
    ...row,
    author_name: names.get(String(row.user_id)) || "Utilisateur",
  }));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED", message: "Session requise." }, 401);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return json({ error: "SERVER_CONFIG_ERROR", message: "Configuration Supabase incomplète." }, 500);

    const sb = createClient(url, key);
    const session = await authenticate(sb, token);
    if (!session) return json({ error: "SESSION_INVALID", message: "Session invalide ou expirée." }, 401);
    if (!(await canModerateForum(sb, session))) {
      return json({ error: "FORBIDDEN", message: "Vous n’avez pas l’autorisation de modérer le forum." }, 403);
    }

    if (req.method === "GET") {
      const select = "id,user_id,space,title,content,is_visible,is_flagged,is_pinned,flagged_reason,created_at";
      const [flaggedResult, allResult] = await Promise.all([
        sb.from("forum_posts").select(select).eq("is_flagged", true).order("created_at", { ascending: false }).limit(100),
        sb.from("forum_posts").select(select).order("created_at", { ascending: false }).limit(300),
      ]);

      if (flaggedResult.error) throw flaggedResult.error;
      if (allResult.error) throw allResult.error;

      return json({
        flagged_posts: await enrichPosts(sb, flaggedResult.data || []),
        all_posts: await enrichPosts(sb, allResult.data || []),
      });
    }

    if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

    const body = await req.json().catch(() => ({}));
    const postId = String(body.post_id || "");
    const action = String(body.action || "");
    if (!postId || !["hide", "restore", "unflag"].includes(action)) {
      return json({ error: "INVALID_PARAMS", message: "Publication ou action invalide." }, 400);
    }

    let update: Record<string, unknown> = {};
    if (action === "hide") update = { is_visible: false };
    if (action === "restore") update = { is_visible: true };
    if (action === "unflag") update = { is_flagged: false, flagged_reason: null };

    const { data: updated, error: updateError } = await sb
      .from("forum_posts")
      .update(update)
      .eq("id", postId)
      .select("id")
      .maybeSingle();
    if (updateError) throw updateError;
    if (!updated) return json({ error: "POST_NOT_FOUND", message: "Publication introuvable." }, 404);

    const actionType = action === "hide"
      ? "forum_post_hidden"
      : action === "restore"
        ? "forum_post_restored"
        : "forum_post_unflagged";

    try {
      await sb.from("moderation_log").insert({
        moderator_id: session.userId,
        action_type: actionType,
        target_type: "forum_post",
        target_id: postId,
      });
    } catch {
      // Le journal ne doit pas bloquer l’action principale.
    }

    return json({ success: true, action });
  } catch (error) {
    console.error("moderator-forum-action", error);
    return json({
      error: "SERVER_ERROR",
      message: error instanceof Error ? error.message : "Erreur interne du forum.",
    }, 500);
  }
});
