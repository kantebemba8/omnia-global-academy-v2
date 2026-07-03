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

function authorDisplay(fullName: string): string {
  const parts = (fullName || "").trim().split(/\s+/);
  if (parts.length < 2) return parts[0] || "?";
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function initials(fullName: string): string {
  const parts = (fullName || "").trim().split(/\s+/);
  return (parts[0]?.[0] || "?") + (parts[1]?.[0] || "").toUpperCase();
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

  const url = new URL(req.url);
  const courseId = url.searchParams.get("course_id");
  if (!courseId) return json({ error: "COURSE_ID_REQUIRED" }, 400);

  // Check enrollment
  const { data: enr } = await sb.from("user_enrollments").select("id")
    .eq("user_id", userId).eq("course_id", courseId).maybeSingle();
  // Also allow course creator/teacher
  const { data: course } = await sb.from("courses").select("creator_id, establishment_id").eq("id", courseId).maybeSingle();
  const isCreator = course?.creator_id === userId;
  if (!enr && !isCreator) return json({ error: "NOT_ENROLLED" }, 403);

  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = 20;
  const from = (page - 1) * limit;

  const { data: rawPosts, count } = await sb.from("forum_posts")
    .select("id, title, content, user_id, likes_count, replies_count, is_pinned, is_solved, created_at", { count: "exact" })
    .eq("course_id", courseId).eq("space", "cours").eq("is_visible", true).is("parent_id", null)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, from + limit - 1);

  const userIds = [...new Set((rawPosts || []).map((p: Record<string, unknown>) => p.user_id as string))];
  const userMap: Record<string, string> = {};
  const creatorIds = new Set<string>([course?.creator_id].filter(Boolean));

  if (userIds.length > 0) {
    const { data: users } = await sb.from("users").select("id, full_name").in("id", userIds);
    (users || []).forEach((u: { id: string; full_name: string }) => { userMap[u.id] = u.full_name; });
  }

  // Check liked
  const likedSet = new Set<string>();
  if (rawPosts?.length) {
    const postIds = rawPosts.map((p: Record<string, unknown>) => p.id as string);
    const { data: likes } = await sb.from("forum_likes").select("post_id").eq("user_id", userId).in("post_id", postIds);
    (likes || []).forEach((l: { post_id: string }) => likedSet.add(l.post_id));
  }

  const posts = (rawPosts || []).map((p: Record<string, unknown>) => {
    const name = userMap[p.user_id as string] || "";
    return {
      ...p,
      content: (p.content as string)?.substring(0, 200),
      author_name: authorDisplay(name),
      author_initials: initials(name),
      is_instructor: creatorIds.has(p.user_id as string),
      user_liked: likedSet.has(p.id as string),
    };
  });

  const total = count || 0;
  return json({ posts, total, page, total_pages: Math.ceil(total / limit) });
});
