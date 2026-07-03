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

// Block financial routes
const BLOCKED_PATHS = ["/wallet", "/payout", "/school/payouts", "/school/licenses"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const url = new URL(req.url);
  if (BLOCKED_PATHS.some((p) => url.pathname.includes(p))) return json({ error: "FORBIDDEN", message: "Accès financier refusé aux enseignants." }, 403);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const { data: sess } = await sb.from("user_sessions").select("user_id").eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (!sess) return json({ error: "SESSION_INVALID" }, 401);
    const userId = sess.user_id;

    const { data: roleRow } = await sb.from("user_roles").select("role").eq("user_id", userId).eq("role", "etablissement_enseignant").maybeSingle();
    if (!roleRow) return json({ error: "FORBIDDEN", message: "Rôle enseignant requis." }, 403);

    // School link
    const { data: teacherLink } = await sb.from("school_teachers").select("establishment_id").eq("teacher_user_id", userId).maybeSingle();
    let etablissement = null;
    if (teacherLink) {
      const tl = teacherLink as unknown as { establishment_id: string };
      const { data: etab } = await sb.from("etablissement_profiles").select("school_name,logo_url").eq("id", tl.establishment_id).maybeSingle();
      etablissement = etab;
    }

    // My courses
    const { data: courses } = await sb.from("courses").select("id,title,status,cover_image_url,category,pending_school_validation,created_at").eq("instructor_id", userId);
    const courseIds = (courses ?? []).map((c) => (c as unknown as { id: string }).id);

    let totalStudents = 0;
    let projetsACorriger: unknown[] = [];
    if (courseIds.length > 0) {
      const { count } = await sb.from("user_enrollments").select("*", { count: "exact", head: true }).in("course_id", courseIds);
      totalStudents = count ?? 0;

      const { data: projects } = await sb.from("user_final_validation").select("id,course_id,user_id,submitted_at").in("course_id", courseIds).eq("status", "submitted");
      projetsACorriger = await Promise.all((projects ?? []).map(async (p) => {
        const pp = p as unknown as { id: string; course_id: string; user_id: string; submitted_at: string };
        const course = (courses ?? []).find((c) => (c as unknown as { id: string }).id === pp.course_id) as unknown as { title: string } | undefined;
        return { ...pp, course_title: course?.title ?? "—", student_name: "Apprenant" };
      }));
    }

    // Course data with student counts
    const mesCoursEnriched = (courses ?? []).map((c) => {
      const cc = c as unknown as { id: string; title: string; status: string; pending_school_validation: boolean };
      return { ...cc, total_students: 0, average_rating: 0 };
    });

    return json({
      etablissement,
      kpis: {
        eleves_actifs: totalStudents,
        heures_dispensees: 0,
        note_moyenne: 0,
        questions_forum_en_attente: 0,
      },
      mes_cours: mesCoursEnriched,
      projets_a_corriger: projetsACorriger,
    });
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
