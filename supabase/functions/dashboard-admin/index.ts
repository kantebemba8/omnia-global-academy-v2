import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Omnia-Session-Token,X-Client-Info,Apikey",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function verifySuperAdmin(sb: any, token: string) {
  const { data: session } = await sb
    .from("user_sessions")
    .select("user_id")
    .eq("session_token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!session) return null;

  const { data: role } = await sb
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user_id)
    .eq("role", "super_admin")
    .maybeSingle();

  return role ? session.user_id : null;
}

async function rows(sb: any, table: string, columns = "*", apply?: (q: any) => any) {
  try {
    let q = sb.from(table).select(columns);
    if (apply) q = apply(q);
    const { data, error } = await q;
    if (error) {
      console.warn(`[dashboard-admin] ${table}:`, error.message);
      return null;
    }
    return data ?? [];
  } catch (error) {
    console.warn(`[dashboard-admin] ${table}:`, error);
    return null;
  }
}

async function countRows(sb: any, table: string, apply?: (q: any) => any) {
  try {
    let q = sb.from(table).select("*", { count: "exact", head: true });
    if (apply) q = apply(q);
    const { count, error } = await q;
    if (error) {
      console.warn(`[dashboard-admin] count ${table}:`, error.message);
      return null;
    }
    return count ?? 0;
  } catch (error) {
    console.warn(`[dashboard-admin] count ${table}:`, error);
    return null;
  }
}

function sum(list: any[] | null, key: string) {
  if (!list) return null;
  return list.reduce((total, row) => total + Number(row?.[key] ?? 0), 0);
}

function dayKey(value: string | null | undefined) {
  if (!value) return null;
  return value.slice(0, 10);
}

function sessionToken(req: Request) {
  return (
    req.headers.get("x-omnia-session-token") ??
    (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "")
  ).trim();
}


const ACCOUNT_REASON_LABELS: Record<string, string> = {
  pause: "Pause volontaire",
  too_many_notifications: "Trop de notifications",
  low_usage: "Utilisation insuffisante",
  technical_issue: "Problème technique",
  security_break: "Protection temporaire du compte",
  missing_features: "Fonctionnalités manquantes",
  no_longer_use: "N’utilise plus la plateforme",
  duplicate_account: "Compte en double",
  privacy_request: "Demande de suppression des données",
  technical_issues: "Problèmes techniques répétés",
  missing_content: "Contenus ou services non trouvés",
  communications: "Communications non souhaitées",
  dissatisfied: "Expérience insatisfaisante",
  other: "Autre motif",
};

function accountReasonLabel(value: unknown) {
  const key = String(value || "");
  return ACCOUNT_REASON_LABELS[key] || "Motif non communiqué";
}

const ROLE_GROUPS = [
  { key: "apprenant", label: "Apprenants", aliases: ["apprenant"] },
  { key: "professeur", label: "Professeurs", aliases: ["professeur", "formateur", "enseignant", "etablissement_enseignant"] },
  { key: "structure", label: "Structures", aliases: ["structure", "responsable_structure", "gestionnaire_partenaire", "structure_admin", "directeur", "etablissement_directeur"] },
  { key: "recruteur_structure", label: "Recruteurs Structure", aliases: ["recruteur_structure"] },
  { key: "organisateur", label: "Organisateurs Omnia Live", aliases: ["organisateur", "organizer"] },
  { key: "moderateur", label: "Modérateurs", aliases: ["moderateur", "moderator"] },
  { key: "recruteur", label: "Recruteurs", aliases: ["recruteur", "recruteur_independant"] },
  { key: "coach", label: "Coachs", aliases: ["coach"] },
] as const;

function roleGroup(key: string) {
  return ROLE_GROUPS.find((group) => group.key === key);
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

    const adminId = await verifySuperAdmin(sb, token);
    if (!adminId) return json({ error: "FORBIDDEN" }, 403);

    const url = new URL(req.url);

    // Détail d'un rôle : uniquement nom, e-mail et date d'inscription.
    // Aucun mot de passe, téléphone, adresse, KYC ou autre donnée sensible n'est exposé.
    const requestedRole = url.searchParams.get("role");
    if (requestedRole) {
      const group = roleGroup(requestedRole);
      if (!group) return json({ error: "ROLE_NOT_SUPPORTED", message: "Rôle officiel inconnu." }, 404);
      const keys = [...group.aliases];
      const { data: roleRows, error: roleError } = await sb
        .from("user_roles")
        .select("user_id,role")
        .in("role", keys);
      if (roleError) throw roleError;
      const ids = [...new Set((roleRows ?? []).map((row:any) => row.user_id).filter(Boolean))];
      const members = ids.length
        ? await rows(sb, "users", "id,full_name,email,created_at", query => query.in("id", ids).order("created_at", { ascending: false }))
        : [];
      return json({
        role: group.label,
        role_key: group.key,
        role_keys: keys,
        count: members?.length ?? 0,
        members: (members ?? []).map((user:any) => ({
          id: user.id,
          name: user.full_name ?? "",
          email: user.email ?? "",
          created_at: user.created_at ?? null,
        })),
      });
    }

    if (url.searchParams.get("activity_today_detail") === "true") {
      const startToday = new Date(); startToday.setHours(0,0,0,0);
      const [adminRows,studioRows,lifecycleRows,deletionRows] = await Promise.all([
        rows(sb,"admin_audit_log","action,created_at,metadata",q=>q.gte("created_at",startToday.toISOString()).order("created_at",{ascending:false}).limit(200)),
        rows(sb,"course_studio_logs","action,created_at,course_id",q=>q.gte("created_at",startToday.toISOString()).order("created_at",{ascending:false}).limit(200)),
        rows(sb,"account_lifecycle_audit","action,reason_code,planned_reactivation_at,created_at",q=>q.gte("created_at",startToday.toISOString()).order("created_at",{ascending:false}).limit(200)),
        rows(sb,"account_deletion_audit","reason_code,completed_at",q=>q.gte("completed_at",startToday.toISOString()).order("completed_at",{ascending:false}).limit(200)),
      ]);
      const activities=[
        ...(adminRows||[]).map((r:any)=>({label:`Administration : ${String(r.action||"action").replaceAll("_"," ")}`,created_at:r.created_at,detail:r.metadata?JSON.stringify(r.metadata):"",source:"Administration"})),
        ...(studioRows||[]).map((r:any)=>({label:`Formation : ${String(r.action||"action").replaceAll("_"," ")}`,created_at:r.created_at,detail:r.course_id?`Formation ${r.course_id}`:"",source:"Studio de formation"})),
        ...(lifecycleRows||[]).map((r:any)=>({
          label:r.action==="self_reactivated"?"Compte réactivé par son titulaire":"Compte suspendu volontairement",
          created_at:r.created_at,
          detail:r.action==="self_suspended"
            ?`${accountReasonLabel(r.reason_code)}${r.planned_reactivation_at?` · retour prévu ${new Date(r.planned_reactivation_at).toLocaleDateString("fr-FR")}`:""}`
            :"Réactivation sécurisée après vérification du mot de passe",
          source:"Cycle de vie du compte",
        })),
        ...(deletionRows||[]).map((r:any)=>({
          label:"Compte supprimé définitivement",
          created_at:r.completed_at,
          detail:accountReasonLabel(r.reason_code),
          source:"Cycle de vie du compte",
        })),
      ].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
      return json({activities});
    }

    const period = url.searchParams.get("period") ?? "30d";
    const now = new Date();
    const start = new Date(now);
    if (period === "1d") start.setDate(now.getDate() - 1);
    else if (period === "7d") start.setDate(now.getDate() - 7);
    else if (period === "1y") start.setFullYear(now.getFullYear() - 1);
    else start.setDate(now.getDate() - 30);

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const dauStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      courseOrders,
      liveOrders,
      liveLedger,
      wallets,
      activeSessions,
      newUsersToday,
      courseSubmissionsToday,
      liveCreatedToday,
      payoutToday,
      livePayoutToday,
      pricingPending,
      pricingProfessor,
      pedagogicPending,
      readyPublish,
      publishedCourses,
      liveValidation,
      livePublished,
      liveNow,
      liveRefunds,
      livePayouts,
      organizerPending,
      structurePending,
      structureActive,
      userRoles,
      siteSettings,
      jobPending,
      forumReports,
      auditLogs,
      courseStudioLogs,
    ] = await Promise.all([
      rows(sb, "orders", "final_price_xof,platform_share_xof,payment_gateway,paid_at,user_id", q =>
        q.eq("payment_status", "paid").gte("paid_at", start.toISOString())
      ),
      rows(sb, "live_orders", "amount,payment_provider,paid_at,user_id", q =>
        q.eq("payment_status", "paid").gte("paid_at", start.toISOString())
      ),
      rows(sb, "live_organizer_ledger", "entry_type,oga_amount,organizer_amount,status,created_at", q =>
        q.gte("created_at", start.toISOString())
      ),
      rows(sb, "wallets", "balance_xof"),
      rows(sb, "user_sessions", "user_id,created_at", q => q.gte("created_at", dauStart.toISOString())),
      countRows(sb, "users", q => q.gte("created_at", todayStart.toISOString())),
      countRows(sb, "courses", q => q.eq("studio_status", "pending_validation").gte("submitted_at", todayStart.toISOString())),
      countRows(sb, "live_events", q => q.gte("created_at", todayStart.toISOString())),
      countRows(sb, "payout_requests", q => q.gte("requested_at", todayStart.toISOString())),
      countRows(sb, "live_payout_requests", q => q.gte("created_at", todayStart.toISOString())),
      countRows(sb, "courses", q => q.eq("pricing_status", "en_attente_validation_prix_admin")),
      countRows(sb, "courses", q => q.eq("pricing_status", "en_attente_acceptation_prix_professeur")),
      countRows(sb, "courses", q => q.eq("studio_status", "pending_validation")),
      countRows(sb, "courses", q => q.eq("studio_status", "validated").eq("is_published", false)),
      countRows(sb, "courses", q => q.eq("is_published", true)),
      countRows(sb, "live_events", q => q.in("status", ["submitted", "under_review"])),
      countRows(sb, "live_events", q => q.in("status", ["approved", "published"])),
      countRows(sb, "live_events", q => q.eq("status", "live")),
      countRows(sb, "live_refund_requests", q => q.in("status", ["pending", "under_review", "approved", "partially_approved"])),
      countRows(sb, "live_payout_requests", q => q.in("status", ["pending", "under_review", "approved"])),
      countRows(sb, "live_organizer_applications", q => q.eq("status", "pending")),
      countRows(sb, "partner_organizations", q => q.eq("status", "pending")),
      countRows(sb, "partner_organizations", q => q.eq("status", "validated")),
      rows(sb, "user_roles", "role,user_id"),
      rows(sb, "site_settings", "key,value", q =>
        q.in("key", [
          "maintenance_enabled",
          "maintenance_module_omnia_live",
          "maintenance_module_career",
          "maintenance_module_talent",
          "maintenance_module_forum",
          "maintenance_module_payments",
          "maintenance_module_formations",
        ])
      ),
      countRows(sb, "job_offers", q => q.eq("status", "pending_moderation")),
      countRows(sb, "forum_reports", q => q.eq("status", "pending")),
      rows(sb, "admin_audit_log", "action,created_at", q => q.order("created_at", { ascending: false }).limit(6)),
      rows(sb, "course_studio_logs", "action,created_at", q => q.order("created_at", { ascending: false }).limit(6)),
    ]);

    const caCourse = sum(courseOrders, "final_price_xof");
    const caLive = sum(liveOrders, "amount");
    const caEncaisse = caCourse == null && caLive == null ? null : Number(caCourse ?? 0) + Number(caLive ?? 0);

    const platformCourse = sum(courseOrders, "platform_share_xof");
    const platformLive = liveLedger
      ? liveLedger
          .filter((row: any) => row.entry_type === "sale")
          .reduce((s: number, row: any) => s + Number(row.oga_amount ?? 0), 0)
      : null;
    const revenuOmnia = platformCourse == null && platformLive == null
      ? null
      : Number(platformCourse ?? 0) + Number(platformLive ?? 0);

    const walletBalance = sum(wallets, "balance_xof");
    const organizerDue = liveLedger
      ? liveLedger
          .filter((row: any) => ["pending", "available"].includes(row.status))
          .reduce((s: number, row: any) => s + Number(row.organizer_amount ?? 0), 0)
      : null;
    const aReverser = walletBalance == null && organizerDue == null
      ? null
      : Number(walletBalance ?? 0) + Number(organizerDue ?? 0);

    const dau = activeSessions
      ? new Set(activeSessions.map((row: any) => row.user_id).filter(Boolean)).size
      : null;

    const salesMap: Record<string, { amount_xof: number; count: number }> = {};
    for (const row of courseOrders ?? []) {
      const day = dayKey(row.paid_at);
      if (!day) continue;
      salesMap[day] ??= { amount_xof: 0, count: 0 };
      salesMap[day].amount_xof += Number(row.final_price_xof ?? 0);
      salesMap[day].count += 1;
    }
    for (const row of liveOrders ?? []) {
      const day = dayKey(row.paid_at);
      if (!day) continue;
      salesMap[day] ??= { amount_xof: 0, count: 0 };
      salesMap[day].amount_xof += Number(row.amount ?? 0);
      salesMap[day].count += 1;
    }
    const ventesEvolution = Object.entries(salesMap)
      .map(([date, value]) => ({ date, ...value }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const paymentMap: Record<string, { count: number; amount_xof: number }> = {};
    for (const row of courseOrders ?? []) {
      const gateway = row.payment_gateway || "Non renseigné";
      paymentMap[gateway] ??= { count: 0, amount_xof: 0 };
      paymentMap[gateway].count += 1;
      paymentMap[gateway].amount_xof += Number(row.final_price_xof ?? 0);
    }
    for (const row of liveOrders ?? []) {
      const gateway = row.payment_provider || "Non renseigné";
      paymentMap[gateway] ??= { count: 0, amount_xof: 0 };
      paymentMap[gateway].count += 1;
      paymentMap[gateway].amount_xof += Number(row.amount ?? 0);
    }
    const paymentTotal = Object.values(paymentMap).reduce((s, row) => s + row.amount_xof, 0);
    const paymentRows = Object.entries(paymentMap)
      .map(([gateway, row]) => ({
        gateway,
        ...row,
        percent: paymentTotal > 0 ? row.amount_xof / paymentTotal * 100 : 0,
      }))
      .sort((a, b) => b.amount_xof - a.amount_xof);

    // Seuls les rôles officiels sont exposés dans le Dashboard.
    // Les anciens alias restent regroupés silencieusement pour la compatibilité des comptes existants.
    const allUserIds = [...new Set((userRoles ?? []).map((row:any) => row.user_id).filter(Boolean))];
    const userRows = allUserIds.length
      ? await rows(sb, "users", "id,full_name,email", query => query.in("id", allUserIds))
      : [];
    const usersById = new Map((userRows ?? []).map((user:any) => [user.id, user]));

    const usersByRole = ROLE_GROUPS.map((group) => {
      const ids = [...new Set(
        (userRoles ?? [])
          .filter((row:any) => group.aliases.includes(row.role))
          .map((row:any) => row.user_id)
          .filter(Boolean),
      )];
      return {
        role: group.label,
        role_key: group.key,
        role_keys: [...group.aliases],
        count: ids.length,
        members: ids.map((id:string) => {
          const user:any = usersById.get(id);
          return { id, name: user?.full_name ?? "", email: user?.email ?? "" };
        }),
      };
    });

    const settingsMap: Record<string, any> = {};
    for (const row of siteSettings ?? []) settingsMap[row.key] = row.value;
    const isTrue = (v: any) => v === true || v === "true";
    const maintenanceModules = [
      ["Omnia Live", "maintenance_module_omnia_live"],
      ["Omnia Career", "maintenance_module_career"],
      ["Omnia Talent", "maintenance_module_talent"],
      ["Forum", "maintenance_module_forum"],
      ["Paiements", "maintenance_module_payments"],
      ["Formations", "maintenance_module_formations"],
    ].filter(([, key]) => isTrue(settingsMap[key])).map(([label]) => label);

    const payoutPending = await countRows(sb, "payout_requests", q => q.eq("status", "pending"));

    const actions = [
      { key: "pricing", label: "Tarifications de formations à valider", count: pricingPending ?? 0, path: "/admin/course-pricing", detail: "Choisir le prix avant acceptation du professeur", priority: "high" },
      { key: "pedagogy", label: "Formations en validation pédagogique", count: pedagogicPending ?? 0, path: "/admin/studio-validation", detail: "Contenu soumis par les créateurs" },
      { key: "payouts", label: "Retraits à traiter", count: payoutPending ?? 0, path: "/admin/payouts", detail: "Demandes de reversement classiques" },
      { key: "structures", label: "Structures à valider", count: structurePending ?? 0, path: "/admin/structures" },
      { key: "jobs", label: "Offres d’emploi à modérer", count: jobPending ?? 0, path: "/admin/offres-emploi" },
      { key: "live-validation", label: "Événements Omnia Live à valider", count: liveValidation ?? 0, path: "/admin/omnia-live" },
      { key: "live-refunds", label: "Remboursements Omnia Live à traiter", count: liveRefunds ?? 0, path: "/admin/omnia-live", priority: "high" },
      { key: "live-payouts", label: "Retraits organisateurs Omnia Live", count: livePayouts ?? 0, path: "/admin/omnia-live" },
      { key: "organizers", label: "Organisateurs à valider", count: organizerPending ?? 0, path: "/admin/omnia-live" },
      { key: "forum", label: "Signalements Forum à examiner", count: forumReports ?? 0, path: "/admin/forum" },
    ].filter(item => item.count > 0);

    const combinedActivity = [
      ...(auditLogs ?? []).map((row: any) => ({
        label: `Administration : ${String(row.action || "action").replaceAll("_", " ")}`,
        created_at: row.created_at,
      })),
      ...(courseStudioLogs ?? []).map((row: any) => ({
        label: `Formation : ${String(row.action || "action").replaceAll("_", " ")}`,
        created_at: row.created_at,
      })),
    ]
      .filter(row => row.created_at)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, 8);

    const geoRows = await rows(sb, "orders", "final_price_xof,paid_at,users!inner(country_code)", q =>
      q.eq("payment_status", "paid").gte("paid_at", start.toISOString())
    );
    const geoMap: Record<string, { sales_count: number; amount_xof: number }> = {};
    for (const row of geoRows ?? []) {
      const code = String(row.users?.country_code || "—").toUpperCase();
      geoMap[code] ??= { sales_count: 0, amount_xof: 0 };
      geoMap[code].sales_count += 1;
      geoMap[code].amount_xof += Number(row.final_price_xof ?? 0);
    }

    return json({
      period,
      kpis: {
        ca_encaisse_xof: caEncaisse,
        revenu_omnia_xof: revenuOmnia,
        a_reverser_xof: aReverser,
        utilisateurs_actifs_24h: dau,
      },
      activity_today: {
        nouveaux_utilisateurs: newUsersToday,
        commandes_payees:
          courseOrders == null && liveOrders == null
            ? null
            : (courseOrders ?? []).filter((o: any) => o.paid_at >= todayStart.toISOString()).length
              + (liveOrders ?? []).filter((o: any) => o.paid_at >= todayStart.toISOString()).length,
        formations_soumises: courseSubmissionsToday,
        lives_crees: liveCreatedToday,
        retraits_demandes:
          payoutToday == null && livePayoutToday == null ? null : Number(payoutToday ?? 0) + Number(livePayoutToday ?? 0),
      },
      actions,
      ventes_evolution: ventesEvolution,
      repartition_geo: Object.entries(geoMap)
        .map(([country_code, value]) => ({ country_code, ...value }))
        .sort((a, b) => b.amount_xof - a.amount_xof)
        .slice(0, 10),
      paiements: {
        available: paymentRows.length > 0,
        rows: paymentRows,
      },
      formations: {
        attente_tarification: pricingPending,
        attente_acceptation_professeur: pricingProfessor,
        validation_pedagogique: pedagogicPending,
        pretes_a_publier: readyPublish,
        publiees: publishedCourses,
      },
      omnia_live: {
        validation: liveValidation,
        programmes_ou_publies: livePublished,
        en_direct: liveNow,
        remboursements: liveRefunds,
        retraits: livePayouts,
        organisateurs: organizerPending,
      },
      structures: {
        en_attente: structurePending,
        actives: structureActive,
      },
      users_by_role: usersByRole,
      platform: {
        maintenance_global: isTrue(settingsMap.maintenance_enabled),
        maintenance_modules: maintenanceModules,
      },
      latest_admin_activity: combinedActivity,
    });
  } catch (error) {
    console.error("[dashboard-admin]", error);
    return json({
      error: "SERVER_ERROR",
      message: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});
