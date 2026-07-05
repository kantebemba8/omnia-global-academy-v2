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

  // Récupérer les CVs de l'utilisateur
  const { data: cvs, error } = await sb
    .from("cv_profiles")
    .select("id, title, template_id, with_photo, is_active, created_at, updated_at, last_pdf_url, content_hash")
    .eq("user_id", sess.user_id)
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  if (error) return json({ error: error.message }, 500);

  // Récupérer les jetons disponibles
  const { data: user } = await sb
    .from("users")
    .select("cv_tokens")
    .eq("id", sess.user_id)
    .maybeSingle();

  // Récupérer les templates actifs
  const { data: templates } = await sb
    .from("cv_templates")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");

  // Récupérer les formations et certificats terminés
  const { data: enrollments } = await sb
    .from("user_enrollments")
    .select(`
      course_id,
      courses (
        id, title, category, level, cpd_accredited, cpd_hours
      )
    `)
    .eq("user_id", sess.user_id);

  const { data: certificates } = await sb
    .from("certificates")
    .select("id, omnia_certificate_id, course_id, issued_at, cpd_accredited, cpd_hours")
    .eq("user_id", sess.user_id)
    .eq("status", "active");

  return json({
    cvs: cvs || [],
    tokens: user?.cv_tokens ?? 0,
    templates: templates || [],
    completed_courses: enrollments?.map(e => e.courses).filter(Boolean) || [],
    certificates: certificates || [],
  });
});
