import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "https://omniaglobalacademy.com",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), {
    status: s, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: sess } = await sb.from("user_sessions")
    .select("user_id")
    .eq("session_token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!sess) return json({ error: "SESSION_INVALID" }, 401);

  const { cv_id } = await req.json();
  if (!cv_id) return json({ error: "cv_id requis" }, 400);

  // Vérifier que le CV appartient à l'utilisateur
  const { data: cv } = await sb
    .from("cv_profiles")
    .select("user_id")
    .eq("id", cv_id)
    .maybeSingle();

  if (!cv || cv.user_id !== sess.user_id) {
    return json({ error: "CV non trouvé ou accès refusé" }, 404);
  }

  // Soft delete
  const { error } = await sb
    .from("cv_profiles")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", cv_id)
    .eq("user_id", sess.user_id);

  if (error) return json({ error: error.message }, 500);

  return json({ success: true, cv_id });
});
