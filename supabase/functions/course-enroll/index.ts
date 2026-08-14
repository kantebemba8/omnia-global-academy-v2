import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

import { getActiveOmniaSessionResult } from "../_shared/omnia-auth.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, message: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const sessionToken = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!sessionToken) return json({ success: false, message: "Authentification requise" }, 401);

  let body: { course_id?: string };
  try { body = await req.json(); } catch { return json({ success: false, message: "Corps invalide" }, 400); }

  const { course_id } = body;
  if (!course_id) return json({ success: false, message: "course_id requis" }, 400);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Validate session
    const { data: session } = await getActiveOmniaSessionResult(supabase, sessionToken);

    if (!session) return json({ success: false, message: "Session invalide ou expirée" }, 401);
    const userId = session.user_id;

    // Check course is free
    const { data: course } = await supabase
      .from("courses")
      .select("id, is_free, is_published, total_students")
      .eq("id", course_id)
      .eq("is_published", true)
      .maybeSingle();

    if (!course) return json({ success: false, message: "Formation introuvable" }, 404);
    if (!course.is_free) return json({ success: false, message: "Cette formation est payante. Veuillez procéder au paiement." }, 402);

    // Check not already enrolled
    const { data: existing } = await supabase
      .from("user_enrollments")
      .select("id")
      .eq("user_id", userId)
      .eq("course_id", course_id)
      .maybeSingle();

    if (existing) return json({ success: false, message: "Vous êtes déjà inscrit à cette formation." }, 409);

    // Enroll
    const { error: enrollErr } = await supabase
      .from("user_enrollments")
      .insert({ user_id: userId, course_id });

    if (enrollErr) throw enrollErr;

    // Increment total_students
    await supabase
      .from("courses")
      .update({ total_students: (course.total_students ?? 0) + 1 })
      .eq("id", course_id);

    return json({ success: true, message: "Inscription réussie" });
  } catch (err) {
    console.error("course-enroll error:", err);
    return json({ success: false, message: "Erreur serveur" }, 500);
  }
});
