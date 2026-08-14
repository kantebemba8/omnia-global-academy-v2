import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { signCertificatePdf, signStoredValue } from "../_shared/protected-storage.ts";

import { getActiveOmniaSessionResult } from "../_shared/omnia-auth.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Omnia-Session-Token",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const LEGACY_STATUS_TO_STUDIO: Record<string, string> = {
  brouillon: "draft",
  soumise: "pending_validation",
  en_attente_validation_manuelle: "pending_validation",
  validee: "validated",
  publiee: "published",
  rejetee: "rejected",
  modification_demandee: "changes_requested",
  suspendue: "archived",
};

function normalizedCourseStatus(course: Record<string, unknown>): string {
  const studio = String(course.studio_status || "").trim();
  const legacy = String(course.status || "").trim();
  if (studio && studio !== "draft") return studio;
  if (legacy && legacy !== "brouillon") return LEGACY_STATUS_TO_STUDIO[legacy] || legacy;
  return studio || LEGACY_STATUS_TO_STUDIO[legacy] || "draft";
}

function periodDays(value: string | null): number {
  const parsed = Number.parseInt(String(value || "30d").replace(/\D/g, ""), 10);
  if (!Number.isFinite(parsed)) return 30;
  return Math.min(365, Math.max(7, parsed));
}

function anonymizedName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Apprenant";
  return parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0];
}

async function buildAnalytics(
  sb: ReturnType<typeof createClient>,
  ownedCourseIds: string[],
  selectedCourseId: string | null,
  days: number,
) {
  const targetCourseIds = selectedCourseId && ownedCourseIds.includes(selectedCourseId)
    ? [selectedCourseId]
    : ownedCourseIds;
  if (!targetCourseIds.length) {
    return {
      enrollments_over_time: [], countries: [], module_completion: [],
      rating_distribution: [5, 4, 3, 2, 1].map((stars) => ({ stars, count: 0 })), students: [],
    };
  }

  const since = new Date(Date.now() - days * 24 * 3_600_000);
  since.setHours(0, 0, 0, 0);

  const [enrollmentsResult, modulesResult, lessonsResult, progressResult, feedbackResult] = await Promise.all([
    sb.from("user_enrollments")
      .select("user_id,course_id,enrolled_at,completed_at")
      .in("course_id", targetCourseIds),
    sb.from("course_modules")
      .select("id,course_id,title,position")
      .in("course_id", targetCourseIds)
      .order("position", { ascending: true }),
    sb.from("course_lessons")
      .select("id,module_id,course_id")
      .in("course_id", targetCourseIds),
    sb.from("user_lesson_progress")
      .select("user_id,lesson_id,course_id,is_completed,updated_at")
      .in("course_id", targetCourseIds),
    sb.from("course_private_feedback")
      .select("course_id,quality_score")
      .in("course_id", targetCourseIds),
  ]);
  for (const result of [enrollmentsResult, modulesResult, lessonsResult, progressResult, feedbackResult]) {
    if (result.error) throw result.error;
  }

  const enrollments = enrollmentsResult.data || [];
  const userIds = [...new Set(enrollments.map((row: any) => String(row.user_id)).filter(Boolean))];
  const { data: users, error: usersError } = userIds.length
    ? await sb.from("users").select("id,full_name,country_code").in("id", userIds)
    : { data: [], error: null };
  if (usersError) throw usersError;
  const userMap = new Map<string, any>((users || []).map((row: any) => [String(row.id), row]));

  const daily = new Map<string, number>();
  for (let offset = days - 1; offset >= 0; offset--) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    daily.set(date.toISOString().slice(0, 10), 0);
  }
  for (const enrollment of enrollments) {
    const enrolledAt = new Date((enrollment as any).enrolled_at);
    if (enrolledAt >= since) {
      const key = enrolledAt.toISOString().slice(0, 10);
      if (daily.has(key)) daily.set(key, (daily.get(key) || 0) + 1);
    }
  }
  const enrollmentsOverTime = [...daily.entries()].map(([date, count]) => ({
    date: new Date(`${date}T00:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
    count,
  }));

  const countryCounts = new Map<string, number>();
  for (const userId of userIds) {
    const country = String(userMap.get(userId)?.country_code || "Non renseigné").toUpperCase();
    countryCounts.set(country, (countryCounts.get(country) || 0) + 1);
  }
  const countries = [...countryCounts.entries()]
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count);

  const lessons = lessonsResult.data || [];
  const modules = modulesResult.data || [];
  const completedProgress = (progressResult.data || []).filter((row: any) => row.is_completed);
  const moduleCompletion = modules.map((module: any) => {
    const moduleLessonIds = new Set(lessons.filter((lesson: any) => String(lesson.module_id) === String(module.id)).map((lesson: any) => String(lesson.id)));
    const possible = moduleLessonIds.size * Math.max(1, enrollments.filter((e: any) => String(e.course_id) === String(module.course_id)).length);
    const completed = completedProgress.filter((row: any) => moduleLessonIds.has(String(row.lesson_id))).length;
    return {
      module_title: String(module.title || "Module"),
      pct: possible > 0 ? Math.round((completed / possible) * 100) : 0,
    };
  });

  const ratingCounts = new Map<number, number>([1, 2, 3, 4, 5].map((stars) => [stars, 0]));
  for (const row of feedbackResult.data || []) {
    const score = Math.min(5, Math.max(1, Math.round(Number((row as any).quality_score || 0))));
    ratingCounts.set(score, (ratingCounts.get(score) || 0) + 1);
  }
  const ratingDistribution = [5, 4, 3, 2, 1].map((stars) => ({ stars, count: ratingCounts.get(stars) || 0 }));

  const lessonsByCourse = new Map<string, string[]>();
  for (const lesson of lessons) {
    const courseId = String((lesson as any).course_id);
    const current = lessonsByCourse.get(courseId) || [];
    current.push(String((lesson as any).id));
    lessonsByCourse.set(courseId, current);
  }
  const progressByUserCourse = new Map<string, { completed: Set<string>; lastActivity: string | null }>();
  for (const row of progressResult.data || []) {
    const key = `${String((row as any).user_id)}:${String((row as any).course_id)}`;
    const current = progressByUserCourse.get(key) || { completed: new Set<string>(), lastActivity: null };
    if ((row as any).is_completed) current.completed.add(String((row as any).lesson_id));
    const updatedAt = String((row as any).updated_at || "");
    if (updatedAt && (!current.lastActivity || updatedAt > current.lastActivity)) current.lastActivity = updatedAt;
    progressByUserCourse.set(key, current);
  }

  const students = enrollments.slice(0, 200).map((enrollment: any) => {
    const courseId = String(enrollment.course_id);
    const userId = String(enrollment.user_id);
    const totalLessons = lessonsByCourse.get(courseId)?.length || 0;
    const progress = progressByUserCourse.get(`${userId}:${courseId}`);
    const percent = totalLessons > 0 ? Math.round(((progress?.completed.size || 0) / totalLessons) * 100) : 0;
    return {
      anonymized: anonymizedName(String(userMap.get(userId)?.full_name || "Apprenant")),
      progress: percent,
      last_activity: progress?.lastActivity || enrollment.enrolled_at,
      status: enrollment.completed_at || percent >= 100 ? "completed" : "active",
    };
  });

  return {
    enrollments_over_time: enrollmentsOverTime,
    countries,
    module_completion: moduleCompletion,
    rating_distribution: ratingDistribution,
    students,
  };
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

    const { data: session, error: sessionError } = await getActiveOmniaSessionResult(sb, token);
    if (sessionError || !session?.user_id) return json({ error: "SESSION_INVALID" }, 401);
    const userId = String(session.user_id);

    const { data: roleRow, error: roleError } = await sb.from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "professeur")
      .maybeSingle();
    if (roleError) throw roleError;
    if (!roleRow) return json({ error: "FORBIDDEN", message: "Rôle professeur requis." }, 403);

    const [{ data: user, error: userError }, { data: professor, error: professorError }, { data: existingWallet, error: walletError }, { data: courses, error: coursesError }] = await Promise.all([
      sb.from("users")
        .select("id,full_name,email,avatar_url,phone_number,country_code,allow_email,allow_sms,allow_push,subscribe_newsletter")
        .eq("id", userId)
        .maybeSingle(),
      sb.from("professeur_profiles")
        .select("bio,expertise_domain,cv_diploma_url,kyc_status,signature_url")
        .eq("user_id", userId)
        .maybeSingle(),
      sb.from("wallets")
        .select("id,balance_xof,reserved_xof,total_earned_xof,total_withdrawn_xof")
        .eq("user_id", userId)
        .maybeSingle(),
      sb.from("courses")
        .select("id,title,status,studio_status,score_calcule,price_xof,prix_provisoire_xof,cover_image_url,category,cpd_accredited,requested_cpd,admin_comment,rejection_reason,created_at,updated_at,final_validation_type")
        .eq("instructor_id", userId),
    ]);
    if (userError) throw userError;
    if (professorError) throw professorError;
    if (walletError) throw walletError;
    if (coursesError) throw coursesError;

    let wallet = existingWallet;
    if (!wallet) {
      const { data: createdWallet, error: createWalletError } = await sb.from("wallets")
        .insert({ user_id: userId })
        .select("id,balance_xof,reserved_xof,total_earned_xof,total_withdrawn_xof")
        .single();
      if (createWalletError) throw createWalletError;
      wallet = createdWallet;
    }

    const courseRows = courses ?? [];
    const courseIds = courseRows.map((course: any) => String(course.id));
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
      for (const result of [totalResult, enrollmentsResult, feedbackResult, attemptsResult]) if (result.error) throw result.error;

      totalStudents = totalResult.count ?? 0;
      for (const enrollment of enrollmentsResult.data ?? []) {
        const courseId = String((enrollment as any).course_id);
        enrollCount[courseId] = (enrollCount[courseId] ?? 0) + 1;
      }
      for (const feedback of feedbackResult.data ?? []) {
        const courseId = String((feedback as any).course_id);
        const qualityScore = Number((feedback as any).quality_score || 0);
        if (!ratings[courseId]) ratings[courseId] = { sum: 0, count: 0 };
        ratings[courseId].sum += qualityScore;
        ratings[courseId].count += 1;
      }
      for (const attempt of attemptsResult.data ?? []) {
        const courseId = String((attempt as any).course_id);
        projectCount[courseId] = (projectCount[courseId] ?? 0) + 1;
      }
    }

    const formations = courseRows.map((course: Record<string, unknown>) => {
      const courseId = String(course.id);
      const rating = ratings[courseId];
      return {
        ...course,
        status: normalizedCourseStatus(course),
        total_students: enrollCount[courseId] ?? 0,
        average_rating: rating?.count ? Math.round((rating.sum / rating.count) * 10) / 10 : 0,
        projets_a_corriger: projectCount[courseId] ?? 0,
      };
    });

    const globalRatingRows = Object.values(ratings);
    const globalRatingCount = globalRatingRows.reduce((sum, row) => sum + row.count, 0);
    const globalRating = globalRatingCount
      ? Math.round((globalRatingRows.reduce((sum, row) => sum + row.sum, 0) / globalRatingCount) * 10) / 10
      : 0;

    const [payoutResult, transactionResult, certificateResult] = wallet?.id
      ? await Promise.all([
        sb.from("payout_requests").select("id,amount_xof,channel,status,requested_at").eq("wallet_id", wallet.id).order("requested_at", { ascending: false }).limit(20),
        sb.from("wallet_transactions").select("id,type,amount_xof,description,created_at").eq("wallet_id", wallet.id).order("created_at", { ascending: false }).limit(100),
        courseIds.length
          ? sb.from("certificates")
            .select("id,omnia_certificate_id,user_id,student_full_name,course_id,course_title,cpd_accredited,status,validity_status,expires_at,pdf_url,pdf_storage_path,issued_at")
            .in("course_id", courseIds)
            .order("issued_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
      ])
      : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }];
    for (const result of [payoutResult, transactionResult, certificateResult]) if (result.error) throw result.error;

    const professorForResponse=professor?{...professor}:null;
    if(professorForResponse?.signature_url){professorForResponse.signature_url=await signStoredValue(sb,professorForResponse.signature_url,"certificates",900)||professorForResponse.signature_url;}
    const certificates=await Promise.all((certificateResult.data??[]).map(async(certificate:any)=>{const revoked=certificate.validity_status==="revoked"||["revoked","revoque"].includes(String(certificate.status||"").toLowerCase());const expired=Boolean(certificate.expires_at&&new Date(certificate.expires_at)<new Date());const signedPdf=!revoked&&!expired?await signCertificatePdf(sb,certificate.pdf_storage_path,certificate.pdf_url,300):null;return {...certificate,pdf_url:signedPdf};}));

    const url = new URL(req.url);
    const analytics = url.searchParams.get("analytics") === "1"
      ? await buildAnalytics(sb, courseIds, url.searchParams.get("course_id"), periodDays(url.searchParams.get("period")))
      : undefined;

    const balance = Number(wallet?.balance_xof || 0);
    const reserved = Number(wallet?.reserved_xof || 0);

    return json({
      user,
      professeur: professorForResponse,
      kpis: {
        solde_retirable_xof: Math.max(0, balance - reserved),
        gains_cumules_xof: Number(wallet?.total_earned_xof || 0),
        total_eleves: totalStudents,
        note_globale: globalRating,
      },
      formations,
      certificates,
      payout_requests: payoutResult.data ?? [],
      transactions: transactionResult.data ?? [],
      wallet: {
        balance_xof: balance,
        reserved_xof: reserved,
        total_earned_xof: Number(wallet?.total_earned_xof || 0),
        total_withdrawn_xof: Number(wallet?.total_withdrawn_xof || 0),
      },
      analytics,
      forum_questions_unanswered: 0,
    });
  } catch (error) {
    console.error("dashboard-professeur", error);
    return json({ error: "SERVER_ERROR", message: error instanceof Error ? error.message : "Erreur inconnue" }, 500);
  }
});
