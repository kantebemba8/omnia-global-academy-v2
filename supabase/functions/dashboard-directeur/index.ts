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
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const { data: sess } = await sb.from("user_sessions").select("user_id").eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (!sess) return json({ error: "SESSION_INVALID" }, 401);
    const userId = sess.user_id;

    const { data: roleRow } = await sb.from("user_roles").select("role").eq("user_id", userId).eq("role", "etablissement_directeur").maybeSingle();
    if (!roleRow) return json({ error: "FORBIDDEN", message: "Rôle directeur requis." }, 403);

    // Etablissement
    const { data: etab } = await sb.from("etablissement_profiles").select("id,school_name,logo_url,registration_number,director_name,kyc_status").eq("user_id", userId).maybeSingle();
    if (!etab) return json({ error: "ESTABLISHMENT_NOT_FOUND" }, 404);
    const estabId = (etab as unknown as { id: string }).id;

    // Wallet (lazy create)
    const { data: existingWallet } = await sb.from("wallets").select("id,balance_xof,total_earned_xof,total_withdrawn_xof").eq("user_id", userId).maybeSingle();
    let wallet = existingWallet;
    if (!wallet) {
      const { data: nw } = await sb.from("wallets").insert({ user_id: userId }).select("id,balance_xof,total_earned_xof,total_withdrawn_xof").single();
      wallet = nw;
    }
    const w = wallet as unknown as { id: string; balance_xof: number; total_earned_xof: number; total_withdrawn_xof: number } | null;

    // Teachers
    const { data: teacherLinks } = await sb.from("school_teachers").select("id,teacher_user_id,status,created_at").eq("establishment_id", estabId);
    const teacherUserIds = (teacherLinks ?? []).map((t) => (t as unknown as { teacher_user_id: string }).teacher_user_id);
    let teacherDetails: unknown[] = [];
    if (teacherUserIds.length > 0) {
      const { data: teacherUsers } = await sb.from("users").select("id,full_name,email").in("id", teacherUserIds);
      // Courses per teacher
      const { data: teacherCourses } = await sb.from("courses").select("id,instructor_id").in("instructor_id", teacherUserIds);
      const coursesByTeacher: Record<string, string[]> = {};
      (teacherCourses ?? []).forEach((c) => {
        const cc = c as unknown as { id: string; instructor_id: string };
        if (!coursesByTeacher[cc.instructor_id]) coursesByTeacher[cc.instructor_id] = [];
        coursesByTeacher[cc.instructor_id].push(cc.id);
      });
      // Students per teacher
      const allTcIds = (teacherCourses ?? []).map((c) => (c as unknown as { id: string }).id);
      let enrollByTeacher: Record<string, number> = {};
      if (allTcIds.length > 0) {
        const { data: enr } = await sb.from("user_enrollments").select("course_id").in("course_id", allTcIds);
        (enr ?? []).forEach((e) => {
          const ec = e as unknown as { course_id: string };
          const tId = Object.entries(coursesByTeacher).find(([, ids]) => ids.includes(ec.course_id))?.[0];
          if (tId) enrollByTeacher[tId] = (enrollByTeacher[tId] ?? 0) + 1;
        });
      }
      teacherDetails = (teacherUsers ?? []).map((u) => {
        const tu = u as unknown as { id: string; full_name: string; email: string };
        const link = (teacherLinks ?? []).find((t) => (t as unknown as { teacher_user_id: string }).teacher_user_id === tu.id) as unknown as { status: string; created_at: string } | undefined;
        return {
          id: tu.id,
          full_name: tu.full_name,
          email: tu.email,
          status: link?.status ?? "actif",
          courses_count: coursesByTeacher[tu.id]?.length ?? 0,
          total_students: enrollByTeacher[tu.id] ?? 0,
          average_rating: 0,
          created_at: link?.created_at,
        };
      });
    }

    // Courses pending school validation
    const { data: pendingCourses } = await sb.from("courses").select("id,title,category,created_at,instructor_id").eq("establishment_id", estabId).eq("pending_school_validation", true);
    const pendingEnriched = await Promise.all((pendingCourses ?? []).map(async (c) => {
      const cc = c as unknown as { id: string; title: string; category: string; created_at: string; instructor_id: string };
      const { data: tu } = await sb.from("users").select("full_name").eq("id", cc.instructor_id).maybeSingle();
      return { ...cc, teacher_name: (tu as unknown as { full_name: string } | null)?.full_name ?? "—", submitted_at: cc.created_at };
    }));

    // Published courses
    const { data: publishedCourses } = await sb.from("courses").select("id,title,price_xof,cpd_accredited").eq("establishment_id", estabId).eq("status", "publiee");
    const pubCourseIds = (publishedCourses ?? []).map((c) => (c as unknown as { id: string }).id);
    let pubEnrollCount: Record<string, number> = {};
    if (pubCourseIds.length > 0) {
      const { data: pe } = await sb.from("user_enrollments").select("course_id").in("course_id", pubCourseIds);
      (pe ?? []).forEach((e) => {
        const ec = e as unknown as { course_id: string };
        pubEnrollCount[ec.course_id] = (pubEnrollCount[ec.course_id] ?? 0) + 1;
      });
    }
    const publishedEnriched = (publishedCourses ?? []).map((c) => {
      const cc = c as unknown as { id: string; title: string; price_xof: number; cpd_accredited: boolean };
      return { ...cc, total_students: pubEnrollCount[cc.id] ?? 0, average_rating: 0 };
    });

    const totalStudents = Object.values(pubEnrollCount).reduce((s, v) => s + v, 0);
    const activeTeachers = (teacherLinks ?? []).filter((t) => (t as unknown as { status: string }).status === "actif").length;

    return json({
      etablissement: etab,
      kpis: {
        chiffre_affaires_xof: w?.total_earned_xof ?? 0,
        solde_retirable_xof: w?.balance_xof ?? 0,
        eleves_inscrits: totalStudents,
        enseignants_actifs: activeTeachers,
      },
      enseignants: teacherDetails,
      courses_pending_school: pendingEnriched,
      courses_published: publishedEnriched,
      wallet: { balance_xof: w?.balance_xof ?? 0, total_earned_xof: w?.total_earned_xof ?? 0 },
      recent_activity: [],
    });
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
