import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const routerCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-omnia-session-token",
};

const forumCreate = (() => {

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function handler(req: Request) {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const token = req.headers.get("x-omnia-session-token") ?? req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  const { data: sess } = await sb.from("user_sessions").select("user_id")
    .eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!sess) return json({ error: "SESSION_INVALID" }, 401);
  const userId = sess.user_id;

  const { data: user } = await sb.from("users").select("country_code, status").eq("id", userId).maybeSingle();
  if (!user || user.status !== "actif") return json({ error: "ACCOUNT_SUSPENDED" }, 403);

  const body = await req.json();
  const { space, course_id, title, content, country_code } = body as {
    space: string; course_id?: string; title: string; content: string; country_code?: string;
  };

  if (!space || !title || !content) return json({ error: "MISSING_FIELDS" }, 400);
  if (title.length < 10 || title.length > 200) return json({ error: "TITLE_LENGTH", min: 10, max: 200 }, 422);
  if (content.length < 20 || content.length > 5000) return json({ error: "CONTENT_LENGTH", min: 20, max: 5000 }, 422);

  const postCountry = country_code || user.country_code || "ML";

  if (space === "cours") {
    if (!course_id) return json({ error: "COURSE_ID_REQUIRED" }, 400);
    const { data: enr } = await sb.from("user_enrollments").select("id")
      .eq("user_id", userId).eq("course_id", course_id).maybeSingle();
    if (!enr) return json({ error: "NOT_ENROLLED" }, 403);
  }

  const { data: post, error: postErr } = await sb.from("forum_posts").insert({
    user_id: userId,
    space,
    course_id: course_id || null,
    title,
    content,
    country_code: space === "cours" ? null : postCountry,
    is_visible: true,
    is_pinned: false,
    is_solved: false,
    likes_count: 0,
    replies_count: 0,
  }).select("id").single();

  if (postErr) return json({ error: "INSERT_FAILED", detail: postErr.message }, 500);

  return json({ success: true, post_id: post.id });
}
return { handler };
})();
const forumLike = (() => {

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function handler(req: Request) {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const token = req.headers.get("x-omnia-session-token") ?? req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
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
return { handler };
})();
const forumPin = (() => {

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function handler(req: Request) {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const token = req.headers.get("x-omnia-session-token") ?? req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
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
}
return { handler };
})();
const forumReply = (() => {

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function handler(req: Request) {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const token = req.headers.get("x-omnia-session-token") ?? req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  const { data: sess } = await sb.from("user_sessions").select("user_id")
    .eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!sess) return json({ error: "SESSION_INVALID" }, 401);
  const userId = sess.user_id;

  const body = await req.json();
  const { parent_id, content } = body as { parent_id: string; content: string };

  if (!parent_id || !content) return json({ error: "MISSING_FIELDS" }, 400);
  if (content.length < 10 || content.length > 2000) return json({ error: "CONTENT_LENGTH", min: 10, max: 2000 }, 422);

  const { data: parent } = await sb.from("forum_posts").select("id, space, course_id, country_code, is_visible")
    .eq("id", parent_id).maybeSingle();
  if (!parent || !parent.is_visible) return json({ error: "POST_NOT_FOUND" }, 404);

  const { data: reply, error: replyErr } = await sb.from("forum_posts").insert({
    user_id: userId,
    parent_id,
    space: parent.space,
    course_id: parent.course_id || null,
    country_code: parent.country_code || null,
    title: null,
    content,
    is_visible: true,
    likes_count: 0,
    replies_count: 0,
  }).select("id").single();

  if (replyErr) return json({ error: "INSERT_FAILED", detail: replyErr.message }, 500);

  // Increment parent replies_count
  await sb.from("forum_posts").update({ replies_count: (parent as unknown as Record<string, unknown>).replies_count as number + 1 })
    .eq("id", parent_id).catch(() => {});
  // Safer: use RPC-like increment
  await sb.rpc("increment_replies_count", { post_id: parent_id }).catch(() => {});

  return json({ success: true, reply_id: reply.id });
}
return { handler };
})();
const forumReport = (() => {

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const VALID_REASONS = ["spam", "contenu_inapproprie", "hors_sujet", "discrimination", "autre"];

async function handler(req: Request) {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const token = req.headers.get("x-omnia-session-token") ?? req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  const { data: sess } = await sb.from("user_sessions").select("user_id")
    .eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!sess) return json({ error: "SESSION_INVALID" }, 401);
  const userId = sess.user_id;

  const body = await req.json() as { post_id: string; reason: string; details?: string };
  const { post_id, reason, details } = body;

  if (!post_id || !reason) return json({ error: "MISSING_FIELDS" }, 400);
  if (!VALID_REASONS.includes(reason)) return json({ error: "INVALID_REASON" }, 422);

  const { data: existing } = await sb.from("forum_reports").select("id")
    .eq("post_id", post_id).eq("reported_by", userId).maybeSingle();
  if (existing) return json({ error: "ALREADY_REPORTED" }, 409);

  await sb.from("forum_reports").insert({ post_id, reported_by: userId, reason, details: details || null });
  await sb.from("forum_posts").update({ is_flagged: true }).eq("id", post_id);

  return json({ success: true });
}
return { handler };
})();
const forumSolve = (() => {

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function handler(req: Request) {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const token = req.headers.get("x-omnia-session-token") ?? req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
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
}
return { handler };
})();
const forumList = (() => {
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-omnia-session-token",
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

async function handler(req: Request) {
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
  const token = req.headers.get("x-omnia-session-token") ?? req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
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

  // Hide content authored by users blocked by the current user.
  let blockedUserIds: string[] = [];
  if (userId) {
    const { data: blockedRows } = await sb.from("user_blocks")
      .select("blocked_user_id")
      .eq("blocker_user_id", userId);
    blockedUserIds = (blockedRows || []).map((row: { blocked_user_id: string }) => row.blocked_user_id);
  }

  // Build query — top-level posts only (parent_id IS NULL)
  let query = sb.from("forum_posts")
    .select("id, title, content, user_id, country_code, space, course_id, likes_count, replies_count, is_pinned, is_solved, is_flagged, created_at", { count: "exact" })
    .eq("space", space)
    .eq("is_visible", true)
    .is("parent_id", null);

  if (blockedUserIds.length > 0) {
    query = query.not("user_id", "in", `(${blockedUserIds.join(",")})`);
  }

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
}
return { handler };
})();

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: routerCorsHeaders });
  const action = new URL(req.url).searchParams.get("action") || "";
  switch (action) {
    case "create": return forumCreate.handler(req);
    case "like": return forumLike.handler(req);
    case "pin": return forumPin.handler(req);
    case "reply": return forumReply.handler(req);
    case "report": return forumReport.handler(req);
    case "solve": return forumSolve.handler(req);
    case "list": return forumList.handler(req);
    default: return new Response(JSON.stringify({ error: "UNKNOWN_ACTION", action }), { status: 400, headers: { ...routerCorsHeaders, "Content-Type": "application/json" } });
  }
});
