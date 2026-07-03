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
  const userId = sess.user_id;

  const { data: user } = await sb.from("users").select("country_code, account_status").eq("id", userId).maybeSingle();
  if (!user || user.account_status === "suspended") return json({ error: "ACCOUNT_SUSPENDED" }, 403);

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
});
