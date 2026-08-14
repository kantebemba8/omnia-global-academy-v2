import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { getModeratorAccess, hasModeratorConflict } from "../_shared/moderator-access.ts";

import { getActiveOmniaSessionResult } from "../_shared/omnia-auth.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-omnia-session-token",
};

const VALID_SPACES = new Set(["general", "carriere", "cours"]);
const VALID_REPORT_REASONS = new Set(["spam", "contenu_inapproprie", "hors_sujet", "discrimination", "autre"]);

type DbClient = ReturnType<typeof createClient>;
type CourseRow = {
  id: string;
  title: string;
  creator_id: string | null;
  instructor_id: string | null;
  is_published?: boolean | null;
  status?: string | null;
};
type SessionContext = {
  userId: string;
  countryCode: string;
  roles: string[];
  canModerateForum: boolean;
};
type CourseAccess = {
  allowed: boolean;
  accessType: "learner" | "instructor" | "moderation" | null;
  course: CourseRow | null;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function tokenFrom(req: Request) {
  return (
    req.headers.get("x-omnia-session-token") ||
    req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ||
    ""
  ).trim();
}

function safeString(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function authorDisplay(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] || "Membre Omnia";
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function initials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const value = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : (parts[0] || "OM").slice(0, 2);
  return value.toUpperCase();
}

function roleBadge(roles: string[]) {
  if (roles.includes("super_admin")) return "Équipe Omnia";
  if (roles.includes("moderateur")) return "Modération";
  if (roles.some((role) => ["professeur", "formateur", "enseignant", "etablissement_enseignant"].includes(role))) return "Formateur";
  if (roles.some((role) => ["organizer", "organisateur"].includes(role))) return "Organisateur";
  if (roles.some((role) => ["responsable_structure", "gestionnaire_structure", "structure_admin", "directeur", "gestionnaire_partenaire"].includes(role))) return "Structure";
  return null;
}

function sanitizeSearch(value: string) {
  return value.replace(/[,%()]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
}

async function resolveSession(sb: DbClient, req: Request, required: boolean): Promise<SessionContext | null | Response> {
  const token = tokenFrom(req);
  if (!token) return required ? json({ error: "AUTH_REQUIRED", message: "Connexion requise." }, 401) : null;

  const { data: session, error: sessionError } = await getActiveOmniaSessionResult(sb, token);
  if (sessionError || !session) return required ? json({ error: "SESSION_INVALID", message: "Session invalide ou expirée." }, 401) : null;

  const userId = String(session.user_id);
  const [{ data: user, error: userError }, { data: roleRows, error: roleError }] = await Promise.all([
    sb.from("users").select("country_code,status").eq("id", userId).maybeSingle(),
    sb.from("user_roles").select("role").eq("user_id", userId),
  ]);
  if (userError || roleError || !user) return required ? json({ error: "SESSION_INVALID", message: "Compte introuvable." }, 401) : null;
  if (user.status !== "actif") return required ? json({ error: "ACCOUNT_SUSPENDED", message: "Ce compte n'est pas actif." }, 403) : null;

  const roles = (roleRows || []).map((row: { role: string }) => String(row.role));
  let canModerateForum = roles.includes("super_admin");
  if (!canModerateForum && roles.includes("moderateur")) {
    const access = await getModeratorAccess(sb, userId);
    canModerateForum = access.active && access.permissions.can_moderate_forum === true;
  }

  return {
    userId,
    countryCode: String(user.country_code || ""),
    roles,
    canModerateForum,
  };
}

function isResponse(value: SessionContext | null | Response): value is Response {
  return value instanceof Response;
}

async function getCourseAccess(sb: DbClient, courseId: string, session: SessionContext): Promise<CourseAccess> {
  const { data: course, error } = await sb
    .from("courses")
    .select("id,title,creator_id,instructor_id,is_published,status")
    .eq("id", courseId)
    .maybeSingle();
  if (error || !course) return { allowed: false, accessType: null, course: null };

  const row = course as CourseRow;
  if (session.roles.includes("super_admin") || session.canModerateForum) {
    return { allowed: true, accessType: "moderation", course: row };
  }
  if (row.creator_id === session.userId || row.instructor_id === session.userId) {
    return { allowed: true, accessType: "instructor", course: row };
  }

  const { data: enrollment } = await sb
    .from("user_enrollments")
    .select("id")
    .eq("user_id", session.userId)
    .eq("course_id", courseId)
    .maybeSingle();
  return enrollment
    ? { allowed: true, accessType: "learner", course: row }
    : { allowed: false, accessType: null, course: row };
}

async function requirePostAccess(sb: DbClient, postId: string, session: SessionContext | null) {
  const { data: post, error } = await sb
    .from("forum_posts")
    .select("id,user_id,parent_id,space,course_id,country_code,is_visible,is_pinned,is_solved,solved_reply_id,likes_count,replies_count,title,content,is_flagged,created_at")
    .eq("id", postId)
    .maybeSingle();
  if (error || !post || !post.is_visible) return { response: json({ error: "POST_NOT_FOUND", message: "Publication introuvable." }, 404), post: null, access: null };

  if (post.space !== "cours") return { response: null, post, access: null };
  if (!session) return { response: json({ error: "AUTH_REQUIRED", message: "Connexion requise pour ce forum de formation." }, 401), post: null, access: null };
  if (!post.course_id) return { response: json({ error: "COURSE_ID_REQUIRED" }, 400), post: null, access: null };

  const access = await getCourseAccess(sb, String(post.course_id), session);
  if (!access.allowed) return { response: json({ error: "NOT_ENROLLED", message: "Ce forum est réservé aux participants autorisés." }, 403), post: null, access };
  return { response: null, post, access };
}

async function blockedUserIds(sb: DbClient, userId: string | null) {
  if (!userId) return [] as string[];
  const { data } = await sb.from("user_blocks").select("blocked_user_id").eq("blocker_user_id", userId);
  return (data || []).map((row: { blocked_user_id: string }) => String(row.blocked_user_id));
}

async function enrichPosts(
  sb: DbClient,
  rows: Array<Record<string, unknown>>,
  session: SessionContext | null,
  course: CourseRow | null = null,
) {
  if (!rows.length) return [];
  const userIds = [...new Set(rows.map((row) => String(row.user_id || "")).filter(Boolean))];
  const postIds = rows.map((row) => String(row.id));
  const [{ data: users }, { data: roleRows }] = await Promise.all([
    sb.from("users").select("id,full_name,avatar_url").in("id", userIds),
    sb.from("user_roles").select("user_id,role").in("user_id", userIds),
  ]);

  const userMap = new Map<string, { full_name: string; avatar_url: string | null }>();
  for (const user of users || []) {
    userMap.set(String(user.id), { full_name: String(user.full_name || ""), avatar_url: user.avatar_url ? String(user.avatar_url) : null });
  }
  const roleMap = new Map<string, string[]>();
  for (const role of roleRows || []) {
    const key = String(role.user_id);
    roleMap.set(key, [...(roleMap.get(key) || []), String(role.role)]);
  }

  const liked = new Set<string>();
  if (session && postIds.length) {
    const { data: likes } = await sb.from("forum_likes").select("post_id").eq("user_id", session.userId).in("post_id", postIds);
    for (const like of likes || []) liked.add(String(like.post_id));
  }

  return rows.map((row) => {
    const userId = String(row.user_id || "");
    const user = userMap.get(userId) || { full_name: "Membre Omnia", avatar_url: null };
    const roles = roleMap.get(userId) || [];
    const isInstructor = Boolean(course && (course.creator_id === userId || course.instructor_id === userId));
    return {
      ...row,
      author_name: authorDisplay(user.full_name),
      author_initials: initials(user.full_name),
      author_avatar_url: user.avatar_url,
      author_badge: isInstructor ? "Formateur de la formation" : roleBadge(roles),
      is_instructor: isInstructor,
      user_liked: liked.has(String(row.id)),
      course_title: course?.title || null,
    };
  });
}

async function listAction(sb: DbClient, req: Request) {
  const url = new URL(req.url);
  const space = safeString(url.searchParams.get("space") || "general", 30);
  if (!VALID_SPACES.has(space)) return json({ error: "INVALID_SPACE" }, 400);

  const sessionResult = await resolveSession(sb, req, false);
  if (isResponse(sessionResult)) return sessionResult;
  const session = sessionResult;
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "20", 10) || 20));
  const sort = safeString(url.searchParams.get("sort") || "recent", 20);
  const search = sanitizeSearch(url.searchParams.get("search") || "");
  const courseId = safeString(url.searchParams.get("course_id") || "", 80);
  let countryCode = safeString(url.searchParams.get("country_code") || session?.countryCode || "", 10).toUpperCase();
  let course: CourseRow | null = null;

  if (space === "cours") {
    if (!courseId) return json({ error: "COURSE_ID_REQUIRED" }, 400);
    if (!session) return json({ error: "AUTH_REQUIRED", message: "Connexion requise." }, 401);
    const access = await getCourseAccess(sb, courseId, session);
    if (!access.allowed) return json({ error: "NOT_ENROLLED", message: "Ce forum est réservé aux participants autorisés." }, 403);
    course = access.course;
  }

  const blocked = await blockedUserIds(sb, session?.userId || null);
  let query = sb
    .from("forum_posts")
    .select("id,title,content,user_id,country_code,space,course_id,likes_count,replies_count,is_pinned,is_solved,is_flagged,solved_reply_id,created_at,parent_id", { count: "exact" })
    .eq("space", space)
    .eq("is_visible", true)
    .is("parent_id", null);

  if (blocked.length) query = query.not("user_id", "in", `(${blocked.join(",")})`);
  if (space === "cours") query = query.eq("course_id", courseId);
  else if (countryCode) query = query.eq("country_code", countryCode);
  if (search) query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);

  if (sort === "popular") query = query.order("likes_count", { ascending: false }).order("created_at", { ascending: false });
  else if (sort === "unanswered") query = query.eq("replies_count", 0).order("created_at", { ascending: false });
  else if (sort === "unsolved") query = query.eq("is_solved", false).order("created_at", { ascending: false });
  else query = query.order("is_pinned", { ascending: false }).order("created_at", { ascending: false });

  const from = (page - 1) * limit;
  const { data, count, error } = await query.range(from, from + limit - 1);
  if (error) throw error;
  const posts = await enrichPosts(sb, (data || []) as Array<Record<string, unknown>>, session, course);

  let countriesAvailable: Array<{ code: string; posts_count: number }> = [];
  if (space !== "cours") {
    const { data: countries } = await sb.from("forum_posts").select("country_code").eq("space", space).eq("is_visible", true).is("parent_id", null);
    const counts = new Map<string, number>();
    for (const row of countries || []) {
      const code = String(row.country_code || "");
      if (code) counts.set(code, (counts.get(code) || 0) + 1);
    }
    countriesAvailable = [...counts.entries()].map(([code, postsCount]) => ({ code, posts_count: postsCount }));
  }

  const total = count || 0;
  return json({
    posts,
    total,
    page,
    total_pages: Math.max(1, Math.ceil(total / limit)),
    current_country: space === "cours" ? null : countryCode,
    countries_available: countriesAvailable,
    course_title: course?.title || null,
    can_create: space !== "cours" ? Boolean(session) : true,
  });
}

async function detailAction(sb: DbClient, req: Request) {
  const postId = safeString(new URL(req.url).searchParams.get("post_id") || "", 80);
  if (!postId) return json({ error: "MISSING_POST_ID" }, 400);
  const sessionResult = await resolveSession(sb, req, false);
  if (isResponse(sessionResult)) return sessionResult;
  const session = sessionResult;
  const accessResult = await requirePostAccess(sb, postId, session);
  if (accessResult.response) return accessResult.response;
  const post = accessResult.post as Record<string, unknown>;

  const blocked = await blockedUserIds(sb, session?.userId || null);
  if (blocked.includes(String(post.user_id))) return json({ error: "POST_NOT_FOUND" }, 404);

  let repliesQuery = sb
    .from("forum_posts")
    .select("id,title,content,user_id,country_code,space,course_id,likes_count,replies_count,is_pinned,is_solved,is_flagged,solved_reply_id,created_at,parent_id")
    .eq("parent_id", postId)
    .eq("is_visible", true)
    .order("created_at", { ascending: true });
  if (blocked.length) repliesQuery = repliesQuery.not("user_id", "in", `(${blocked.join(",")})`);
  const { data: replyRows, error: repliesError } = await repliesQuery;
  if (repliesError) throw repliesError;

  const course = accessResult.access?.course || null;
  const [enrichedPost] = await enrichPosts(sb, [post], session, course);
  const replies = await enrichPosts(sb, (replyRows || []) as Array<Record<string, unknown>>, session, course);
  const canMarkSolution = Boolean(session && (
    String(post.user_id) === session.userId ||
    accessResult.access?.accessType === "instructor" ||
    accessResult.access?.accessType === "moderation"
  ));

  return json({ post: enrichedPost, replies, can_mark_solution: canMarkSolution });
}

async function coursesAction(sb: DbClient, req: Request) {
  const sessionResult = await resolveSession(sb, req, true);
  if (isResponse(sessionResult)) return sessionResult;
  const session = sessionResult as SessionContext;
  const courseMap = new Map<string, { course: CourseRow; access_type: "learner" | "instructor" | "moderation" }>();

  const { data: enrollments, error: enrollmentError } = await sb
    .from("user_enrollments")
    .select("course_id,courses(id,title,creator_id,instructor_id,is_published,status)")
    .eq("user_id", session.userId)
    .limit(300);
  if (enrollmentError) throw enrollmentError;
  for (const enrollment of enrollments || []) {
    const raw = Array.isArray(enrollment.courses) ? enrollment.courses[0] : enrollment.courses;
    if (raw?.id) courseMap.set(String(raw.id), { course: raw as CourseRow, access_type: "learner" });
  }

  const { data: ownedCourses, error: ownedError } = await sb
    .from("courses")
    .select("id,title,creator_id,instructor_id,is_published,status")
    .or(`creator_id.eq.${session.userId},instructor_id.eq.${session.userId}`)
    .limit(300);
  if (ownedError) throw ownedError;
  for (const course of ownedCourses || []) courseMap.set(String(course.id), { course: course as CourseRow, access_type: "instructor" });

  if (session.roles.includes("super_admin") || session.canModerateForum) {
    const { data: moderationCourses, error: moderationError } = await sb
      .from("courses")
      .select("id,title,creator_id,instructor_id,is_published,status")
      .eq("is_published", true)
      .order("updated_at", { ascending: false })
      .limit(300);
    if (moderationError) throw moderationError;
    for (const course of moderationCourses || []) {
      if (!courseMap.has(String(course.id))) courseMap.set(String(course.id), { course: course as CourseRow, access_type: "moderation" });
    }
  }

  const ids = [...courseMap.keys()];
  const counts = new Map<string, { discussions: number; unresolved: number }>();
  if (ids.length) {
    const { data: posts, error } = await sb
      .from("forum_posts")
      .select("course_id,is_solved")
      .eq("space", "cours")
      .eq("is_visible", true)
      .is("parent_id", null)
      .in("course_id", ids);
    if (error) throw error;
    for (const post of posts || []) {
      const id = String(post.course_id || "");
      if (!id) continue;
      const current = counts.get(id) || { discussions: 0, unresolved: 0 };
      current.discussions += 1;
      if (!post.is_solved) current.unresolved += 1;
      counts.set(id, current);
    }
  }

  const courses = [...courseMap.values()]
    .sort((a, b) => a.course.title.localeCompare(b.course.title, "fr"))
    .map(({ course, access_type }) => ({
      id: course.id,
      title: course.title,
      access_type,
      discussions_count: counts.get(course.id)?.discussions || 0,
      unresolved_count: counts.get(course.id)?.unresolved || 0,
    }));
  return json({ courses });
}

async function createAction(sb: DbClient, req: Request) {
  const sessionResult = await resolveSession(sb, req, true);
  if (isResponse(sessionResult)) return sessionResult;
  const session = sessionResult as SessionContext;
  const body = await req.json().catch(() => ({}));
  const space = safeString(body.space, 30);
  const title = safeString(body.title, 200);
  const content = safeString(body.content, 5000);
  const courseId = safeString(body.course_id, 80);
  const countryCode = safeString(body.country_code || session.countryCode || "", 10).toUpperCase();

  if (!VALID_SPACES.has(space)) return json({ error: "INVALID_SPACE" }, 400);
  if (title.length < 10 || title.length > 200) return json({ error: "TITLE_LENGTH", min: 10, max: 200 }, 422);
  if (content.length < 20 || content.length > 5000) return json({ error: "CONTENT_LENGTH", min: 20, max: 5000 }, 422);
  if (space === "cours") {
    if (!courseId) return json({ error: "COURSE_ID_REQUIRED" }, 400);
    const access = await getCourseAccess(sb, courseId, session);
    if (!access.allowed) return json({ error: "NOT_ENROLLED", message: "Ce forum est réservé aux participants autorisés." }, 403);
  }

  const { data, error } = await sb.from("forum_posts").insert({
    user_id: session.userId,
    space,
    course_id: space === "cours" ? courseId : null,
    parent_id: null,
    title,
    content,
    country_code: space === "cours" || !countryCode ? null : countryCode,
    is_visible: true,
    is_pinned: false,
    is_solved: false,
    is_flagged: false,
    likes_count: 0,
    replies_count: 0,
  }).select("id").single();
  if (error) throw error;
  return json({ success: true, post_id: data.id });
}

async function replyAction(sb: DbClient, req: Request) {
  const sessionResult = await resolveSession(sb, req, true);
  if (isResponse(sessionResult)) return sessionResult;
  const session = sessionResult as SessionContext;
  const body = await req.json().catch(() => ({}));
  const parentId = safeString(body.parent_id, 80);
  const content = safeString(body.content, 2000);
  if (!parentId || content.length < 10) return json({ error: "CONTENT_LENGTH", min: 10, max: 2000 }, 422);

  const accessResult = await requirePostAccess(sb, parentId, session);
  if (accessResult.response) return accessResult.response;
  const parent = accessResult.post as Record<string, unknown>;
  if (parent.parent_id) return json({ error: "INVALID_PARENT" }, 400);

  const { data, error } = await sb.from("forum_posts").insert({
    user_id: session.userId,
    parent_id: parentId,
    space: parent.space,
    course_id: parent.course_id || null,
    country_code: parent.country_code || null,
    title: null,
    content,
    is_visible: true,
    is_pinned: false,
    is_solved: false,
    is_flagged: false,
    likes_count: 0,
    replies_count: 0,
  }).select("id").single();
  if (error) throw error;

  const { error: incrementError } = await sb.rpc("increment_replies_count", { target_post_id: parentId });
  if (incrementError) {
    const nextCount = Number(parent.replies_count || 0) + 1;
    await sb.from("forum_posts").update({ replies_count: nextCount }).eq("id", parentId);
  }
  return json({ success: true, reply_id: data.id });
}

async function likeAction(sb: DbClient, req: Request) {
  const sessionResult = await resolveSession(sb, req, true);
  if (isResponse(sessionResult)) return sessionResult;
  const session = sessionResult as SessionContext;
  const body = await req.json().catch(() => ({}));
  const postId = safeString(body.post_id, 80);
  if (!postId) return json({ error: "MISSING_POST_ID" }, 400);

  const accessResult = await requirePostAccess(sb, postId, session);
  if (accessResult.response) return accessResult.response;
  const { data: existing } = await sb.from("forum_likes").select("id").eq("post_id", postId).eq("user_id", session.userId).maybeSingle();
  let liked = false;
  if (existing) {
    const { error } = await sb.from("forum_likes").delete().eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await sb.from("forum_likes").insert({ post_id: postId, user_id: session.userId });
    if (error) throw error;
    liked = true;
  }
  const { count, error: countError } = await sb.from("forum_likes").select("id", { count: "exact", head: true }).eq("post_id", postId);
  if (countError) throw countError;
  const likesCount = count || 0;
  await sb.from("forum_posts").update({ likes_count: likesCount }).eq("id", postId);
  return json({ liked, likes_count: likesCount });
}

async function reportAction(sb: DbClient, req: Request) {
  const sessionResult = await resolveSession(sb, req, true);
  if (isResponse(sessionResult)) return sessionResult;
  const session = sessionResult as SessionContext;
  const body = await req.json().catch(() => ({}));
  const postId = safeString(body.post_id, 80);
  const reason = safeString(body.reason, 100);
  const details = safeString(body.details, 1000);
  if (!postId || !VALID_REPORT_REASONS.has(reason)) return json({ error: "INVALID_REPORT" }, 422);

  const accessResult = await requirePostAccess(sb, postId, session);
  if (accessResult.response) return accessResult.response;
  const { data: existing } = await sb.from("forum_reports").select("id").eq("post_id", postId).eq("reported_by", session.userId).maybeSingle();
  if (existing) return json({ error: "ALREADY_REPORTED", message: "Ce contenu a déjà été signalé." }, 409);
  const { error } = await sb.from("forum_reports").insert({ post_id: postId, reported_by: session.userId, reason, details: details || null });
  if (error) throw error;
  await sb.from("forum_posts").update({ is_flagged: true, flagged_reason: reason }).eq("id", postId);
  return json({ success: true });
}

async function solveAction(sb: DbClient, req: Request) {
  const sessionResult = await resolveSession(sb, req, true);
  if (isResponse(sessionResult)) return sessionResult;
  const session = sessionResult as SessionContext;
  const body = await req.json().catch(() => ({}));
  const postId = safeString(body.post_id, 80);
  const replyId = safeString(body.reply_id, 80);
  if (!postId || !replyId) return json({ error: "MISSING_FIELDS" }, 400);

  const accessResult = await requirePostAccess(sb, postId, session);
  if (accessResult.response) return accessResult.response;
  const post = accessResult.post as Record<string, unknown>;
  const canSolve = String(post.user_id) === session.userId || accessResult.access?.accessType === "instructor" || accessResult.access?.accessType === "moderation";
  if (!canSolve) return json({ error: "FORBIDDEN" }, 403);
  const { data: reply } = await sb.from("forum_posts").select("id").eq("id", replyId).eq("parent_id", postId).eq("is_visible", true).maybeSingle();
  if (!reply) return json({ error: "REPLY_NOT_FOUND" }, 404);
  const { error } = await sb.from("forum_posts").update({ is_solved: true, solved_reply_id: replyId }).eq("id", postId);
  if (error) throw error;
  return json({ success: true });
}

async function pinAction(sb: DbClient, req: Request) {
  const sessionResult = await resolveSession(sb, req, true);
  if (isResponse(sessionResult)) return sessionResult;
  const session = sessionResult as SessionContext;
  const body = await req.json().catch(() => ({}));
  const postId = safeString(body.post_id, 80);
  const pinned = body.pinned === true;
  if (!postId) return json({ error: "MISSING_POST_ID" }, 400);

  const accessResult = await requirePostAccess(sb, postId, session);
  if (accessResult.response) return accessResult.response;
  const canPin = session.roles.includes("super_admin") || session.canModerateForum || accessResult.access?.accessType === "instructor";
  if (!canPin) return json({ error: "FORBIDDEN" }, 403);
  if (session.roles.includes("moderateur") && !session.roles.includes("super_admin") && session.canModerateForum) {
    const targetPost = accessResult.post as Record<string, unknown>;
    if (await hasModeratorConflict(sb, session.userId, "forum_post", postId, [String(targetPost.user_id || "")])) {
      return json({ error: "CONFLICT_OF_INTEREST", message: "Cette publication doit être réattribuée à un autre membre de l’équipe." }, 403);
    }
  }
  const { error } = await sb.from("forum_posts").update({ is_pinned: pinned }).eq("id", postId);
  if (error) throw error;
  return json({ success: true, is_pinned: pinned });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (!["GET", "POST"].includes(req.method)) return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceRoleKey) return json({ error: "SERVER_CONFIG_ERROR" }, 500);
    const sb = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
    const action = new URL(req.url).searchParams.get("action") || "";

    if (action === "list") return await listAction(sb, req);
    if (action === "detail") return await detailAction(sb, req);
    if (action === "courses") return await coursesAction(sb, req);
    if (action === "create") return await createAction(sb, req);
    if (action === "reply") return await replyAction(sb, req);
    if (action === "like") return await likeAction(sb, req);
    if (action === "report") return await reportAction(sb, req);
    if (action === "solve") return await solveAction(sb, req);
    if (action === "pin") return await pinAction(sb, req);
    return json({ error: "UNKNOWN_ACTION", action }, 400);
  } catch (error) {
    console.error("forum-manage", error);
    return json({ error: "SERVER_ERROR", message: error instanceof Error ? error.message : "Erreur interne de la communauté." }, 500);
  }
});
