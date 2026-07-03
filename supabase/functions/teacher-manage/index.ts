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

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const { data: sess } = await sb.from("user_sessions").select("user_id").eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (!sess) return json({ error: "SESSION_INVALID" }, 401);
    const directorId = sess.user_id;

    const { data: roleRow } = await sb.from("user_roles").select("role").eq("user_id", directorId).eq("role", "etablissement_directeur").maybeSingle();
    if (!roleRow) return json({ error: "FORBIDDEN" }, 403);

    const body = await req.json();
    const { teacher_id, action } = body as { teacher_id: string; action: "suspend" | "activate" };
    if (!teacher_id || !["suspend", "activate"].includes(action)) return json({ error: "INVALID_PARAMS" }, 400);

    // Verify teacher belongs to this director's establishment
    const { data: etab } = await sb.from("etablissement_profiles").select("id").eq("user_id", directorId).maybeSingle();
    if (!etab) return json({ error: "ESTABLISHMENT_NOT_FOUND" }, 404);
    const estabId = (etab as unknown as { id: string }).id;

    const { data: link } = await sb.from("school_teachers").select("id").eq("establishment_id", estabId).eq("teacher_user_id", teacher_id).maybeSingle();
    if (!link) return json({ error: "TEACHER_NOT_IN_SCHOOL" }, 404);

    const newSchoolStatus = action === "suspend" ? "suspendu" : "actif";
    const newUserStatus = action === "suspend" ? "suspendu" : "actif";

    await sb.from("school_teachers").update({ status: newSchoolStatus }).eq("establishment_id", estabId).eq("teacher_user_id", teacher_id);

    // Courses remain active — only user account status changes
    await sb.from("users").update({ status: newUserStatus }).eq("id", teacher_id);

    return json({ success: true });
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
