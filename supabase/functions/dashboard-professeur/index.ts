import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Omnia-Session-Token",
};
function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const token = (req.headers.get("x-omnia-session-token") ?? req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const { data: sess } = await sb.from("user_sessions").select("user_id").eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (!sess) return json({ error: "SESSION_INVALID" }, 401);
    const userId = sess.user_id;

    // Verify role
    const { data: roleRow } = await sb.from("user_roles").select("role").eq("user_id", userId).eq("role", "professeur").maybeSingle();
    if (!roleRow) return json({ error: "FORBIDDEN", message: "Rôle professeur requis." }, 403);

    // User info
    const { data: user } = await sb.from("users").select("id,full_name,email,avatar_url").eq("id", userId).maybeSingle();

    // Ensure wallet exists
    const { data: existingWallet } = await sb.from("wallets").select("id,balance_xof,total_earned_xof,total_withdrawn_xof").eq("user_id", userId).maybeSingle();
    let wallet = existingWallet;
    if (!wallet) {
      const { data: newWallet } = await sb.from("wallets").insert({ user_id: userId }).select("id,balance_xof,total_earned_xof,total_withdrawn_xof").single();
      wallet = newWallet;
    }

    // All courses by this professor
    const { data: courses } = await sb.from("courses").select("id,title,status,score_calcule,price_xof,prix_provisoire_xof,cover_image_url,category,cpd_accredited,requested_cpd,admin_comment,rejection_reason,created_at,updated_at,final_validation_type").eq("instructor_id", userId);

    // Total students across all courses
    const courseIds = (courses ?? []).map((c) => (c as unknown as { id: string }).id);
    let totalStudents = 0;
    let avgRatings: Record<string, { sum: number; count: number }> = {};

    if (courseIds.length > 0) {
      const { count } = await sb.from("user_enrollments").select("*", { count: "exact", head: true }).in("course_id", courseIds);
      totalStudents = count ?? 0;

      // Per-course enrollments
      const { data: enrollByCourse } = await sb.from("user_enrollments").select("course_id").in("course_id", courseIds);
      const enrollCount: Record<string, number> = {};
      (enrollByCourse ?? []).forEach((e) => {
        const ec = e as unknown as { course_id: string };
        enrollCount[ec.course_id] = (enrollCount[ec.course_id] ?? 0) + 1;
      });

      // Ratings per course (from course_private_feedback)
      const { data: feedbacks } = await sb.from("course_private_feedback").select("course_id,quality_score").in("course_id", courseIds);
      (feedbacks ?? []).forEach((f) => {
        const fb = f as unknown as { course_id: string; quality_score: number };
        if (!avgRatings[fb.course_id]) avgRatings[fb.course_id] = { sum: 0, count: 0 };
        avgRatings[fb.course_id].sum += fb.quality_score;
        avgRatings[fb.course_id].count += 1;
      });

      // Copies ouvertes et travaux à corriger dans le moteur unique.
      const { data: submittedProjects } = await sb.from("assessment_attempts")
        .select("course_id")
        .in("course_id", courseIds)
        .in("status", ["submitted", "pending_review"]);
      const projCount: Record<string, number> = {};
      (submittedProjects ?? []).forEach((p) => {
        const sp = p as unknown as { course_id: string };
        projCount[sp.course_id] = (projCount[sp.course_id] ?? 0) + 1;
      });

      // Augment courses with per-course data
      const enriched = (courses ?? []).map((c) => {
        const course = c as unknown as Record<string, unknown>;
        const cid = course.id as string;
        const ratingData = avgRatings[cid];
        return {
          ...course,
          total_students: enrollCount[cid] ?? 0,
          average_rating: ratingData ? Math.round((ratingData.sum / ratingData.count) * 10) / 10 : 0,
          projets_a_corriger: projCount[cid] ?? 0,
        };
      });

      // Global rating
      let allSum = 0, allCount = 0;
      Object.values(avgRatings).forEach(({ sum, count }) => { allSum += sum; allCount += count; });
      const noteGlobale = allCount > 0 ? Math.round((allSum / allCount) * 10) / 10 : 0;

      // Recent payout requests
      const { data: payouts } = wallet
        ? await sb.from("payout_requests").select("id,amount_xof,channel,status,requested_at").eq("wallet_id", wallet.id).order("requested_at", { ascending: false }).limit(5)
        : { data: [] };

      return json({
        user,
        kpis: {
          solde_retirable_xof: wallet?.balance_xof ?? 0,
          gains_cumules_xof: wallet?.total_earned_xof ?? 0,
          total_eleves: totalStudents,
          note_globale: noteGlobale,
        },
        formations: enriched,
        payout_requests: payouts ?? [],
        wallet: {
          balance_xof: wallet?.balance_xof ?? 0,
          total_earned_xof: wallet?.total_earned_xof ?? 0,
          total_withdrawn_xof: wallet?.total_withdrawn_xof ?? 0,
        },
        forum_questions_unanswered: 0,
      });
    }

    return json({
      user,
      kpis: { solde_retirable_xof: 0, gains_cumules_xof: 0, total_eleves: 0, note_globale: 0 },
      formations: [],
      payout_requests: [],
      wallet: { balance_xof: 0, total_earned_xof: 0, total_withdrawn_xof: 0 },
      forum_questions_unanswered: 0,
    });
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
