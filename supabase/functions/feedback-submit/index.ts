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

  let body: { course_id?: string; quality_score?: number; would_recommend?: boolean; suggestions?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid body" }, 400); }
  const { course_id, quality_score, would_recommend, suggestions } = body;

  if (!course_id || quality_score == null || would_recommend == null) {
    return json({ error: "course_id, quality_score, would_recommend requis" }, 400);
  }
  if (quality_score < 1 || quality_score > 5) {
    return json({ error: "quality_score doit être entre 1 et 5" }, 400);
  }

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: sess } = await sb.from("user_sessions").select("user_id").eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (!sess) return json({ error: "SESSION_INVALID" }, 401);
    const userId = sess.user_id;

    // Verify course completed
    const { data: finalVal } = await sb.from("user_final_validation").select("id").eq("user_id", userId).eq("course_id", course_id).eq("status", "passed").maybeSingle();
    if (!finalVal) return json({ error: "COURSE_NOT_COMPLETED", message: "Vous devez terminer la formation pour laisser un avis." }, 403);

    const { error } = await sb.from("course_private_feedback").insert({
      user_id: userId,
      course_id,
      quality_score,
      would_recommend,
      suggestions: suggestions ?? null,
    });

    if (error) {
      if (error.code === "23505") return json({ error: "FEEDBACK_ALREADY_SUBMITTED" }, 409);
      throw error;
    }

    return json({ success: true });
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
