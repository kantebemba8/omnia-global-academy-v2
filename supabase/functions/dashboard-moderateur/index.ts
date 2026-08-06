import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Omnia-Session-Token, X-Client-Info, Apikey",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sessionToken(req: Request) {
  return (
    req.headers.get("x-omnia-session-token") ??
    (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "")
  ).trim();
}

const EMPTY_PERMS: Record<string, boolean> = {
  can_see_pending_courses: false,
  can_review_course_content: false,
  can_request_course_modification: false,
  can_recommend_course_price: false,
  can_validate_course_price: false,
  can_reject_course: false,
  can_approve_transmit_course: false,
  can_transmit_course_to_admin: false,
  can_manage_course_certifications: false,
  can_create_assisted_course: false,
  can_see_learners_list: false,
  can_see_professors_list: false,
  can_see_structures_list: false,
  can_see_organizers_list: false,
  can_request_account_suspension: false,
  can_suspend_account: false,
  can_validate_professor_kyc: false,
  can_validate_structure_kyc: false,
  can_validate_establishment_kyc: false,
  can_moderate_forum: false,
  can_moderate_jobs: false,
  can_manage_support: false,
  can_view_ai_conversations: false,
  can_manage_reports: false,
  can_review_live_events: false,
  can_review_live_reports: false,
  can_review_live_refunds: false,
  can_review_live_organizers: false,
  can_review_structure_requests: false,
  can_review_structure_codes: false,
  can_view_analytics: false,
};

function normalizePermissions(row: Record<string, unknown> | null) {
  const nested = row?.permissions && typeof row.permissions === "object" && !Array.isArray(row.permissions)
    ? row.permissions as Record<string, unknown>
    : {};
  const merged: Record<string, boolean> = { ...EMPTY_PERMS };

  for (const [key, value] of Object.entries(row || {})) {
    if (key.startsWith("can_") && typeof value === "boolean") merged[key] = value;
  }
  for (const [key, value] of Object.entries(nested)) {
    if (key.startsWith("can_")) merged[key] = value === true;
  }

  merged.can_recommend_course_price = merged.can_recommend_course_price || merged.can_validate_course_price;
  merged.can_validate_course_price = merged.can_recommend_course_price;
  merged.can_approve_transmit_course = merged.can_approve_transmit_course || merged.can_transmit_course_to_admin;
  merged.can_transmit_course_to_admin = merged.can_approve_transmit_course;
  // Compatibilité historique uniquement. La validation des Structures reste réservée à l’Administration Omnia.
  merged.can_validate_structure_kyc = merged.can_validate_structure_kyc || merged.can_validate_establishment_kyc;
  merged.can_validate_establishment_kyc = merged.can_validate_structure_kyc;
  merged.can_request_account_suspension = merged.can_request_account_suspension || merged.can_suspend_account;
  merged.can_suspend_account = merged.can_request_account_suspension;
  return merged;
}

function dateKey(value: string) {
  return value.slice(0, 10);
}

function weekKey(value: string) {
  const date = new Date(value);
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - day);
  return date.toISOString().slice(0, 10);
}

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    course_approved: "Formations approuvées",
    course_rejected: "Formations rejetées",
    course_transmitted: "Formations transmises",
    kyc_approved: "KYC approuvés",
    kyc_rejected: "KYC rejetés",
    account_suspended: "Comptes suspendus",
    account_reactivated: "Comptes réactivés",
    forum_post_removed: "Publications masquées",
    forum_post_restored: "Publications restaurées",
    job_approved: "Offres approuvées",
    job_rejected: "Offres rejetées",
  };
  return labels[action] ?? action.replaceAll("_", " ");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const token = sessionToken(req);
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
    if (sessionError) throw sessionError;
    if (!session) return json({ error: "SESSION_INVALID" }, 401);
    const userId = session.user_id as string;

    const { data: roleRow, error: roleError } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "moderateur")
      .maybeSingle();
    if (roleError) throw roleError;
    if (!roleRow) return json({ error: "FORBIDDEN" }, 403);

    const { data: user } = await sb.from("users").select("id,full_name").eq("id", userId).maybeSingle();
    const { data: permissionsRow, error: permissionsError } = await sb
      .from("moderator_permissions")
      .select("*")
      .eq("moderator_user_id", userId)
      .maybeSingle();
    if (permissionsError) throw permissionsError;
    const permissions = normalizePermissions(permissionsRow as Record<string, unknown> | null);

    const url = new URL(req.url);
    if (url.searchParams.get("analytics") === "1") {
      if (!permissions.can_view_analytics) {
        return json({ error: "FORBIDDEN", message: "Permission analytique requise.", permissions }, 403);
      }

      const since = new Date();
      since.setUTCDate(since.getUTCDate() - 30);
      const { data: moderationRows, error: moderationError } = await sb
        .from("moderation_log")
        .select("action_type,target_type,created_at")
        .eq("moderator_id", userId)
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: true });
      if (moderationError) throw moderationError;

      const decisionsByDay = new Map<string, { date: string; total: number; approved: number; rejected: number }>();
      const actionsByType = new Map<string, number>();
      const kycByWeek = new Map<string, number>();

      for (const row of moderationRows ?? []) {
        const action = String(row.action_type || "");
        const createdAt = String(row.created_at || "");
        if (!createdAt) continue;
        const day = dateKey(createdAt);
        const item = decisionsByDay.get(day) ?? { date: day, total: 0, approved: 0, rejected: 0 };
        item.total += 1;
        if (/reject|remove|suspend/i.test(action)) item.rejected += 1;
        else if (/approve|validate|transmit|restore|reactivate/i.test(action)) item.approved += 1;
        decisionsByDay.set(day, item);
        actionsByType.set(action, (actionsByType.get(action) ?? 0) + 1);
        if (action.startsWith("kyc_")) {
          const week = weekKey(createdAt);
          kycByWeek.set(week, (kycByWeek.get(week) ?? 0) + 1);
        }
      }

      let ticketsByStatus: Array<{ status: string; count: number }> = [];
      if (permissions.can_manage_support) {
        const { data: tickets, error: ticketsError } = await sb.from("support_tickets").select("status");
        if (ticketsError) throw ticketsError;
        const counts = new Map<string, number>();
        for (const ticket of tickets ?? []) {
          const status = String(ticket.status || "non renseigné");
          counts.set(status, (counts.get(status) ?? 0) + 1);
        }
        ticketsByStatus = [...counts.entries()].map(([status, count]) => ({ status, count }));
      }

      let forumBySpace: Array<{ space: string; posts: number; flagged: number }> = [];
      if (permissions.can_moderate_forum) {
        const { data: posts, error: postsError } = await sb
          .from("forum_posts")
          .select("space,is_flagged")
          .gte("created_at", since.toISOString());
        if (postsError) throw postsError;
        const spaces = new Map<string, { posts: number; flagged: number }>();
        for (const post of posts ?? []) {
          const space = String(post.space || "Général");
          const current = spaces.get(space) ?? { posts: 0, flagged: 0 };
          current.posts += 1;
          if (post.is_flagged === true) current.flagged += 1;
          spaces.set(space, current);
        }
        forumBySpace = [...spaces.entries()].map(([space, values]) => ({ space, ...values }));
      }

      return json({
        permissions,
        analytics: {
          decisions_by_day: [...decisionsByDay.values()],
          actions_by_type: [...actionsByType.entries()]
            .map(([action, count]) => ({ action: actionLabel(action), count }))
            .sort((a, b) => b.count - a.count),
          tickets_by_status: ticketsByStatus,
          kyc_by_week: [...kycByWeek.entries()].map(([week, professeurs]) => ({ week, professeurs })),
          forum_by_space: forumBySpace,
        },
      });
    }

    const { data: protectedRows } = await sb
      .from("user_roles")
      .select("user_id")
      .in("role", ["super_admin", "moderateur"]);
    const protectedIds = (protectedRows ?? []).map((row) => String(row.user_id));

    const kpis: Array<{ key: string; label: string; value: number }> = [];
    if (permissions.can_see_pending_courses) {
      const { count } = await sb.from("courses").select("*", { count: "exact", head: true }).eq("status", "en_attente_validation_manuelle");
      kpis.push({ key: "courses", label: "Formations en attente", value: count ?? 0 });
    }
    if (permissions.can_validate_professor_kyc) {
      const { count } = await sb.from("professeur_profiles").select("*", { count: "exact", head: true }).eq("kyc_status", "en_attente");
      kpis.push({ key: "professor_kyc", label: "KYC Professeur en attente", value: count ?? 0 });
    }
    if (permissions.can_see_learners_list) {
      let query = sb.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "apprenant");
      if (protectedIds.length) query = query.not("user_id", "in", `(${protectedIds.join(",")})`);
      const { count } = await query;
      kpis.push({ key: "learners", label: "Apprenants", value: count ?? 0 });
    }
    if (permissions.can_see_professors_list) {
      let query = sb.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "professeur");
      if (protectedIds.length) query = query.not("user_id", "in", `(${protectedIds.join(",")})`);
      const { count } = await query;
      kpis.push({ key: "professors", label: "Professeurs", value: count ?? 0 });
    }
    if (permissions.can_moderate_forum) {
      const { count } = await sb.from("forum_posts").select("*", { count: "exact", head: true }).eq("is_flagged", true).eq("is_visible", true);
      kpis.push({ key: "forum", label: "Publications signalées", value: count ?? 0 });
    }
    if (permissions.can_moderate_jobs) {
      const { count } = await sb.from("job_offers").select("*", { count: "exact", head: true }).eq("status", "pending_moderation");
      kpis.push({ key: "jobs", label: "Offres en attente", value: count ?? 0 });
    }
    if (permissions.can_manage_support) {
      const { count } = await sb.from("support_tickets").select("*", { count: "exact", head: true }).eq("status", "open");
      kpis.push({ key: "support", label: "Tickets ouverts", value: count ?? 0 });
    }

    const queue: Array<{ id: string; type: string; title: string; created_at: string; priority_label: string; link: string }> = [];
    if (permissions.can_see_pending_courses) {
      const { data: courses } = await sb.from("courses").select("id,title,created_at").eq("status", "en_attente_validation_manuelle").order("created_at", { ascending: true }).limit(5);
      for (const course of courses ?? []) queue.push({ id: `course:${course.id}`, type: "course", title: String(course.title || "Formation sans titre"), created_at: String(course.created_at), priority_label: "Haute", link: "/moderator/courses" });
    }
    if (permissions.can_validate_professor_kyc) {
      const { data: profiles } = await sb.from("professeur_profiles").select("user_id,expertise_domain,created_at").eq("kyc_status", "en_attente").order("created_at", { ascending: true }).limit(3);
      for (const profile of profiles ?? []) queue.push({ id: `kyc:${profile.user_id}`, type: "kyc_prof", title: `KYC Professeur — ${String(profile.expertise_domain || "Domaine non renseigné")}`, created_at: String(profile.created_at), priority_label: "Haute", link: "/moderator/kyc" });
    }
    if (permissions.can_moderate_jobs) {
      const { data: jobs } = await sb.from("job_offers").select("id,title,created_at").eq("status", "pending_moderation").order("created_at", { ascending: true }).limit(3);
      for (const job of jobs ?? []) queue.push({ id: `job:${job.id}`, type: "job", title: String(job.title || "Offre sans titre"), created_at: String(job.created_at), priority_label: "Normale", link: "/moderator/jobs" });
    }
    if (permissions.can_manage_support) {
      const { data: tickets } = await sb.from("support_tickets").select("id,subject,created_at").eq("status", "open").order("created_at", { ascending: true }).limit(3);
      for (const ticket of tickets ?? []) queue.push({ id: `support:${ticket.id}`, type: "support", title: String(ticket.subject || "Ticket support"), created_at: String(ticket.created_at), priority_label: "Normale", link: "/moderator/support" });
    }
    if (permissions.can_moderate_forum) {
      const { data: posts } = await sb.from("forum_posts").select("id,title,content,created_at").eq("is_flagged", true).eq("is_visible", true).order("created_at", { ascending: true }).limit(3);
      for (const post of posts ?? []) queue.push({ id: `forum:${post.id}`, type: "forum", title: String(post.title || post.content || "Publication signalée").slice(0, 90), created_at: String(post.created_at), priority_label: "Normale", link: "/moderator/forum" });
    }
    queue.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data: decisionRows, error: decisionsError } = await sb
      .from("moderation_log")
      .select("id,action_type,target_type,created_at")
      .eq("moderator_id", userId)
      .gte("created_at", todayStart.toISOString())
      .order("created_at", { ascending: false })
      .limit(20);
    if (decisionsError) throw decisionsError;

    const activePermissionKeys = [
      "can_see_pending_courses", "can_review_course_content", "can_request_course_modification",
      "can_recommend_course_price", "can_reject_course", "can_approve_transmit_course",
      "can_manage_course_certifications", "can_create_assisted_course", "can_see_learners_list",
      "can_see_professors_list", "can_see_structures_list", "can_see_organizers_list",
      "can_request_account_suspension", "can_validate_professor_kyc", "can_validate_structure_kyc",
      "can_moderate_forum", "can_moderate_jobs", "can_manage_support", "can_view_ai_conversations",
      "can_manage_reports", "can_review_live_events", "can_review_live_reports",
      "can_review_live_refunds", "can_review_live_organizers", "can_review_structure_requests",
      "can_review_structure_codes", "can_view_analytics",
    ];

    return json({
      moderator: user,
      permissions,
      kpis,
      priority_queue: queue.slice(0, 10),
      todays_decisions: decisionRows ?? [],
      has_any_permission: activePermissionKeys.some((key) => permissions[key] === true),
    });
  } catch (error) {
    console.error("[dashboard-moderateur]", error);
    return json({ error: "SERVER_ERROR", message: error instanceof Error ? error.message : String(error) }, 500);
  }
});
