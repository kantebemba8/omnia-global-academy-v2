import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

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
  const url = new URL(req.url);

  const space = url.searchParams.get("space") || "general";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "20")));
  const sort = url.searchParams.get("sort") || "recent";
  const search = url.searchParams.get("search") || "";

  // Resolve current user + country
  let userId: string | null = null;
  let userCountry = "ML";
  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  if (token) {
    const { data: sess } = await sb.from("user_sessions").select("user_id")
      .eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (sess) {
      userId = sess.user_id;
      const { data: u } = await sb.from("users").select("country_code").eq("id", userId).maybeSingle();
      userCountry = u?.country_code || "ML";
    }
  }
  const countryCode = url.searchParams.get("country_code") || userCountry;

  // For course forum: verify enrollment
  const courseId = url.searchParams.get("course_id");
  if (space === "cours" && courseId) {
    if (!userId) return json({ error: "AUTH_REQUIRED" }, 401);
    const { data: enr } = await sb.from("user_enrollments").select("id")
      .eq("user_id", userId).eq("course_id", courseId).maybeSingle();
    if (!enr) return json({ error: "NOT_ENROLLED" }, 403);
  }

  // Build query — top-level posts only (parent_id IS NULL)
  let query = sb.from("forum_posts")
    .select("id, title, content, user_id, country_code, space, course_id, likes_count, replies_count, is_pinned, is_solved, is_flagged, created_at", { count: "exact" })
    .eq("space", space)
    .eq("is_visible", true)
    .is("parent_id", null);

  if (space === "cours" && courseId) {
    query = query.eq("course_id", courseId);
  } else if (space !== "cours") {
    query = query.eq("country_code", countryCode);
  }

  if (search) {
    query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
  }

  if (sort === "popular") {
    query = query.order("likes_count", { ascending: false });
  } else if (sort === "unsolved") {
    query = query.eq("is_solved", false).order("created_at", { ascending: false });
  } else {
    // recent: pinned first, then by date
    query = query.order("is_pinned", { ascending: false }).order("created_at", { ascending: false });
  }

  const from = (page - 1) * limit;
  query = query.range(from, from + limit - 1);

  const { data: rawPosts, count } = await query;

  // Enrich with author names
  const userIds = [...new Set((rawPosts || []).map((p: Record<string, unknown>) => p.user_id as string).filter(Boolean))];
  const userMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: users } = await sb.from("users").select("id, full_name").in("id", userIds);
    (users || []).forEach((u: { id: string; full_name: string }) => { userMap[u.id] = u.full_name; });
  }

  // Check liked by current user
  const likedSet = new Set<string>();
  if (userId && rawPosts?.length) {
    const postIds = rawPosts.map((p: Record<string, unknown>) => p.id as string);
    const { data: likes } = await sb.from("forum_likes").select("post_id")
      .eq("user_id", userId).in("post_id", postIds);
    (likes || []).forEach((l: { post_id: string }) => likedSet.add(l.post_id));
  }

  const posts = (rawPosts || []).map((p: Record<string, unknown>) => {
    const name = userMap[p.user_id as string] || "";
    return {
      ...p,
      content: (p.content as string)?.substring(0, 200),
      author_name: authorDisplay(name),
      author_initials: initials(name),
      user_liked: likedSet.has(p.id as string),
    };
  });

  // Countries available
  const { data: countryCounts } = await sb.from("forum_posts")
    .select("country_code")
    .eq("space", space).eq("is_visible", true).is("parent_id", null);
  const ccMap: Record<string, number> = {};
  (countryCounts || []).forEach((r: { country_code: string }) => {
    if (r.country_code) ccMap[r.country_code] = (ccMap[r.country_code] || 0) + 1;
  });

  const total = count || 0;
  return json({
    posts,
    total,
    page,
    total_pages: Math.ceil(total / limit),
    current_country: countryCode,
    countries_available: Object.entries(ccMap).map(([code, cnt]) => ({ code, posts_count: cnt })),
  });
});
