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

const VALID_REASONS = ["spam", "contenu_inapproprie", "hors_sujet", "discrimination", "autre"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
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
});
