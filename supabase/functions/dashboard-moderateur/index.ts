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

const EMPTY_PERMS = {
  can_see_pending_courses: false, can_validate_course_price: false, can_reject_course: false,
  can_request_course_modification: false, can_approve_transmit_course: false, can_create_assisted_course: false,
  can_see_learners_list: false, can_see_professors_list: false, can_suspend_account: false,
  can_validate_professor_kyc: false, can_validate_establishment_kyc: false,
  can_moderate_forum: false, can_moderate_jobs: false, can_manage_support: false,
  can_view_ai_conversations: false, can_view_analytics: false,
};

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

    const { data: roleRow } = await sb.from("user_roles").select("role").eq("user_id", userId).eq("role", "moderateur").maybeSingle();
    if (!roleRow) return json({ error: "FORBIDDEN" }, 403);

    // Only return safe fields — never expose email/phone/password_hash to moderator dashboard
    const { data: user } = await sb.from("users").select("id,full_name").eq("id", userId).maybeSingle();

    // Load permissions (default all false if no row)
    const { data: permsRow } = await sb.from("moderator_permissions").select("*").eq("moderator_user_id", userId).maybeSingle();
    const perms = permsRow ? { ...EMPTY_PERMS, ...permsRow } : { ...EMPTY_PERMS };

    // Collect IDs of protected accounts (super_admin + moderateur) for exclusion in KPI counts
    const { data: protectedRows } = await sb.from("user_roles")
      .select("user_id")
      .in("role", ["super_admin", "moderateur"]);
    const protectedIds: string[] = (protectedRows ?? []).map((r) => (r as unknown as { user_id: string }).user_id);

    // Dynamic KPIs
    const kpis: Record<string, number> = {};
    if (perms.can_see_pending_courses) {
      const { count } = await sb.from("courses").select("*", { count: "exact", head: true }).eq("status", "en_attente_validation_manuelle");
      kpis.cours_en_attente = count ?? 0;
    }
    if (perms.can_validate_professor_kyc || perms.can_validate_establishment_kyc) {
      let kyc = 0;
      if (perms.can_validate_professor_kyc) {
        const { count } = await sb.from("professeur_profiles").select("*", { count: "exact", head: true }).eq("kyc_status", "en_attente");
        kyc += count ?? 0;
      }
      if (perms.can_validate_establishment_kyc) {
        const { count } = await sb.from("etablissement_profiles").select("*", { count: "exact", head: true }).eq("kyc_status", "en_attente");
        kyc += count ?? 0;
      }
      kpis.kyc_en_attente = kyc;
    }
    if (perms.can_see_learners_list) {
      // Count apprenants, excluding protected accounts
      let countQuery = sb.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "apprenant");
      if (protectedIds.length > 0) {
        countQuery = countQuery.not("user_id", "in", `(${protectedIds.join(",")})`);
      }
      const { count } = await countQuery;
      kpis.apprenants_total = count ?? 0;
    }
    if (perms.can_see_professors_list) {
      let countQuery = sb.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "professeur");
      if (protectedIds.length > 0) {
        countQuery = countQuery.not("user_id", "in", `(${protectedIds.join(",")})`);
      }
      const { count } = await countQuery;
      kpis.professeurs_total = count ?? 0;
    }
    if (perms.can_moderate_forum) {
      const { count } = await sb.from("forum_posts").select("*", { count: "exact", head: true }).eq("is_flagged", true).eq("is_visible", true);
      kpis.forum_signales = count ?? 0;
    }
    if (perms.can_moderate_jobs) {
      const { count } = await sb.from("job_offers").select("*", { count: "exact", head: true }).eq("status", "pending_moderation");
      kpis.offres_emploi_en_attente = count ?? 0;
    }
    if (perms.can_manage_support) {
      const { count } = await sb.from("support_tickets").select("*", { count: "exact", head: true }).eq("status", "open");
      kpis.tickets_ouverts = count ?? 0;
    }

    // Priority queue — 10 oldest items across all granted categories
    const queue: Array<{ type: string; title: string; created_at: string; target_id: string; priority: number }> = [];

    if (perms.can_see_pending_courses) {
      const { data: courses } = await sb.from("courses").select("id,title,created_at").eq("status", "en_attente_validation_manuelle").order("created_at", { ascending: true }).limit(5);
      (courses ?? []).forEach((c) => {
        const cc = c as unknown as { id: string; title: string; created_at: string };
        queue.push({ type: "cours", title: cc.title, created_at: cc.created_at, target_id: cc.id, priority: 1 });
      });
    }
    if (perms.can_validate_professor_kyc) {
      const { data: profs } = await sb.from("professeur_profiles").select("id,user_id,expertise_domain,created_at").eq("kyc_status", "en_attente").order("created_at", { ascending: true }).limit(3);
      (profs ?? []).forEach((p) => {
        const pp = p as unknown as { id: string; user_id: string; expertise_domain: string; created_at: string };
        queue.push({ type: "kyc_prof", title: `KYC Professeur - ${pp.expertise_domain || "—"}`, created_at: pp.created_at, target_id: pp.user_id, priority: 2 });
      });
    }
    if (perms.can_validate_establishment_kyc) {
      const { data: etabs } = await sb.from("etablissement_profiles").select("id,user_id,school_name,created_at").eq("kyc_status", "en_attente").order("created_at", { ascending: true }).limit(3);
      (etabs ?? []).forEach((e) => {
        const ee = e as unknown as { id: string; user_id: string; school_name: string; created_at: string };
        queue.push({ type: "kyc_etab", title: `KYC Établissement - ${ee.school_name}`, created_at: ee.created_at, target_id: ee.user_id, priority: 2 });
      });
    }
    if (perms.can_moderate_jobs) {
      const { data: jobs } = await sb.from("job_offers").select("id,title,created_at").eq("status", "pending_moderation").order("created_at", { ascending: true }).limit(3);
      (jobs ?? []).forEach((j) => {
        const jj = j as unknown as { id: string; title: string; created_at: string };
        queue.push({ type: "job", title: jj.title, created_at: jj.created_at, target_id: jj.id, priority: 3 });
      });
    }
    if (perms.can_manage_support) {
      const { data: tickets } = await sb.from("support_tickets").select("id,subject,created_at").eq("status", "open").order("created_at", { ascending: true }).limit(3);
      (tickets ?? []).forEach((t) => {
        const tt = t as unknown as { id: string; subject: string; created_at: string };
        queue.push({ type: "support", title: tt.subject, created_at: tt.created_at, target_id: tt.id, priority: 4 });
      });
    }
    if (perms.can_moderate_forum) {
      const { data: flagged } = await sb.from("forum_posts").select("id,title,content,created_at").eq("is_flagged", true).order("created_at", { ascending: true }).limit(3);
      (flagged ?? []).forEach((f) => {
        const ff = f as unknown as { id: string; title: string | null; content: string; created_at: string };
        queue.push({ type: "forum", title: ff.title || ff.content.slice(0, 60), created_at: ff.created_at, target_id: ff.id, priority: 5 });
      });
    }

    queue.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const priorityQueue = queue.slice(0, 10);

    // Today's decisions
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const { data: decisions } = await sb.from("moderation_log").select("action_type,target_type,comment,created_at")
      .eq("moderator_id", userId).gte("created_at", todayStart.toISOString()).order("created_at", { ascending: false }).limit(20);

    return json({ moderator: user, permissions: perms, kpis, file_attente_prioritaire: priorityQueue, decisions_session: decisions ?? [] });
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
