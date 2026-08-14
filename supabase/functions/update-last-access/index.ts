import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

import { getActiveOmniaSessionResult } from "../_shared/omnia-auth.ts";
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

  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  let body: { course_id?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid body" }, 400); }
  const { course_id } = body;
  if (!course_id) return json({ error: "course_id requis" }, 400);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: sess } = await getActiveOmniaSessionResult(sb, token);
    if (!sess) return json({ error: "SESSION_INVALID" }, 401);

    // Upsert last access — reset anti_abandon_sent on resume
    await sb.from("course_last_access").upsert({
      user_id: sess.user_id,
      course_id,
      last_accessed_at: new Date().toISOString(),
      anti_abandon_sent: false,
      anti_abandon_sent_at: null,
    }, { onConflict: "user_id,course_id" });

    return json({ success: true });
  } catch (err) {
    return json({ error: "SERVER_ERROR", message: (err as Error).message }, 500);
  }
});
