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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  let body: { lesson_id?: string; course_id?: string; seconds_since_last_heartbeat?: number; is_active?: boolean };
  try { body = await req.json(); } catch { return json({ error: "Invalid body" }, 400); }
  const { lesson_id, course_id, seconds_since_last_heartbeat, is_active } = body;
  if (!lesson_id || !course_id) return json({ error: "lesson_id + course_id requis" }, 400);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: sess } = await sb.from("user_sessions").select("user_id").eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (!sess) return json({ error: "SESSION_INVALID" }, 401);
    const userId = sess.user_id;

    const safeSeconds = Math.min(Math.max(0, seconds_since_last_heartbeat ?? 0), 35);
    if (!is_active || safeSeconds === 0) return json({ success: true, credited: 0 });

    const { data: lesson } = await sb.from("course_lessons").select("duration_seconds, is_external").eq("id", lesson_id).maybeSingle();

    // External lessons are excluded from CPD tracking
    if (lesson?.is_external) {
      return json({ success: true, credited: 0, reason: "external_lesson_excluded_from_cpd" });
    }

    const required = lesson?.duration_seconds ?? 0;

    const { data: existing } = await sb.from("user_lesson_progress").select("id,time_spent_seconds,quiz_passed").eq("user_id", userId).eq("lesson_id", lesson_id).maybeSingle();
    const newTime = (existing?.time_spent_seconds ?? 0) + safeSeconds;
    const cpdReached = required === 0 || newTime >= required;
    const isCompleted = cpdReached && (existing?.quiz_passed ?? false);

    await sb.from("user_lesson_progress").upsert({
      user_id: userId, lesson_id, course_id,
      time_spent_seconds: newTime, quiz_passed: existing?.quiz_passed ?? false,
      is_completed: isCompleted, updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,lesson_id" });

    // Update last access for anti-abandon tracking (fire-and-forget)
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    if (supabaseUrl) {
      fetch(`${supabaseUrl}/functions/v1/update-last-access`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ course_id }),
      }).catch(() => {});
    }

    return json({ success: true, credited: safeSeconds, time_spent: newTime, cpd_reached: cpdReached });
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
