import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Omnia-Session-Token",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const token = (req.headers.get("x-omnia-session-token") ?? req.headers.get("Authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: session, error: sessionError } = await sb
      .from("user_sessions")
      .select("user_id")
      .eq("session_token", token)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (sessionError || !session?.user_id) return json({ error: "SESSION_INVALID" }, 401);
    const userId = String(session.user_id);

    const { data: roleRow, error: roleError } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "professeur")
      .maybeSingle();
    if (roleError) throw roleError;
    if (!roleRow) return json({ error: "FORBIDDEN", message: "Rôle professeur requis." }, 403);

    const [{ data: user, error: userError }, { data: existingWallet, error: walletError }, { data: courses, error: coursesError }] = await Promise.all([
      sb.from("users")
        .select("id,full_name,email,avatar_url,phone_number,country_code,allow_email,allow_sms,allow_push,subscribe_newsletter")
        .eq("id", userId)
        .maybeSingle(),
      sb.from("wallets")
        .select("id,balance_xof,reserved_xof,total_earned_xof,total_withdrawn_xof")
        .eq("user_id", userId)
        .maybeSingle(),
      sb.from("courses")
        .select("id,title,status,score_calcule,price_xof,prix_provisoire_xof,cover_image_url,category,cpd_accredited,requested_cpd,admin_comment,rejection_reason,created_at,updated_at,final_validation_type")
        .eq("instructor_id", userId),
    ]);
    if (userError) throw userError;
    if (walletError) throw walletError;
    if (coursesError) throw coursesError;

    let wallet = existingWallet;
    if (!wallet) {
      const { data: createdWallet, error: createWalletError } = await sb
        .from("wallets")
        .insert({ user_id: userId })
        .select("id,balance_xof,reserved_xof,total_earned_xof,total_withdrawn_xof")
        .single();
      if (createWalletError) throw createWalletError;
      wallet = createdWallet;
    }

    const courseRows = courses ?? [];
    const courseIds = courseRows.map((course: { id: string }) => String(course.id));
    let totalStudents = 0;
    const enrollCount: Record<string, number> = {};
    const projectCount: Record<string, number> = {};
    const ratings: Record<string, { sum: number; count: number }> = {};

    if (courseIds.length > 0) {
      const [totalResult, enrollmentsResult, feedbackResult, attemptsResult] = await Promise.all([
        sb.from("user_enrollments").select("*", { count: "exact", head: true }).in("course_id", courseIds),
        sb.from("user_enrollments").select("course_id").in("course_id", courseIds),
        sb.from("course_private_feedback").select("course_id,quality_score").in("course_id", courseIds),
        sb.from("assessment_attempts").select("course_id").in("course_id", courseIds).in("status", ["submitted", "pending_review"]),
      ]);
      for (const result of [totalResult, enrollmentsResult, feedbackResult, attemptsResult]) {
        if (result.error) throw result.error;
      }

      totalStudents = totalResult.count ?? 0;
      for (const enrollment of enrollmentsResult.data ?? []) {
        const courseId = String(enrollment.course_id);
        enrollCount[courseId] = (enrollCount[courseId] ?? 0) + 1;
      }
      for (const feedback of feedbackResult.data ?? []) {
        const courseId = String(feedback.course_id);
        const qualityScore = Number(feedback.quality_score || 0);
        if (!ratings[courseId]) ratings[courseId] = { sum: 0, count: 0 };
        ratings[courseId].sum += qualityScore;
        ratings[courseId].count += 1;
      }
      for (const attempt of attemptsResult.data ?? []) {
        const courseId = String(attempt.course_id);
        projectCount[courseId] = (projectCount[courseId] ?? 0) + 1;
      }
    }

    const formations = courseRows.map((course: Record<string, unknown>) => {
      const courseId = String(course.id);
      const rating = ratings[courseId];
      return {
        ...course,
        total_students: enrollCount[courseId] ?? 0,
        average_rating: rating?.count ? Math.round((rating.sum / rating.count) * 10) / 10 : 0,
        projets_a_corriger: projectCount[courseId] ?? 0,
      };
    });

    let ratingSum = 0;
    let ratingCount = 0;
    for (const rating of Object.values(ratings)) {
      ratingSum += rating.sum;
      ratingCount += rating.count;
    }
    const globalRating = ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : 0;

    const [payoutResult, transactionResult] = wallet
      ? await Promise.all([
        sb.from("payout_requests")
          .select("id,amount_xof,channel,status,requested_at")
          .eq("wallet_id", wallet.id)
          .order("requested_at", { ascending: false })
          .limit(20),
        sb.from("wallet_transactions")
          .select("id,type,amount_xof,description,created_at")
          .eq("wallet_id", wallet.id)
          .order("created_at", { ascending: false })
          .limit(100),
      ])
      : [{ data: [], error: null }, { data: [], error: null }];
    if (payoutResult.error) throw payoutResult.error;
    if (transactionResult.error) throw transactionResult.error;

    const balance = Number(wallet?.balance_xof || 0);
    const reserved = Number(wallet?.reserved_xof || 0);

    return json({
      user,
      kpis: {
        solde_retirable_xof: Math.max(0, balance - reserved),
        gains_cumules_xof: Number(wallet?.total_earned_xof || 0),
        total_eleves: totalStudents,
        note_globale: globalRating,
      },
      formations,
      payout_requests: payoutResult.data ?? [],
      transactions: transactionResult.data ?? [],
      wallet: {
        balance_xof: balance,
        reserved_xof: reserved,
        total_earned_xof: Number(wallet?.total_earned_xof || 0),
        total_withdrawn_xof: Number(wallet?.total_withdrawn_xof || 0),
      },
      forum_questions_unanswered: 0,
    });
  } catch (error) {
    console.error("dashboard-professeur", error);
    return json({ error: "SERVER_ERROR", message: error instanceof Error ? error.message : "Erreur inconnue" }, 500);
  }
});
