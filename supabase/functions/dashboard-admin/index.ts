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

async function verifySuperAdmin(sb: ReturnType<typeof createClient>, token: string) {
  const { data: sess } = await sb.from("user_sessions").select("user_id").eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!sess) return null;
  const { data: role } = await sb.from("user_roles").select("role").eq("user_id", (sess as { user_id: string }).user_id).eq("role", "super_admin").maybeSingle();
  if (!role) return null;
  return (sess as { user_id: string }).user_id;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const adminId = await verifySuperAdmin(sb, token);
    if (!adminId) return json({ error: "FORBIDDEN" }, 403);

    const url = new URL(req.url);
    const period = url.searchParams.get("period") ?? "30d";
    const now = new Date();
    let startDate = new Date();
    if (period === "1d") startDate.setDate(now.getDate() - 1);
    else if (period === "7d") startDate.setDate(now.getDate() - 7);
    else if (period === "1y") startDate.setFullYear(now.getFullYear() - 1);
    else startDate.setDate(now.getDate() - 30);

    // KPIs from enrollments/wallets
    const { data: enrollments } = await sb.from("enrollments").select("amount_paid_xof,created_at").gte("created_at", startDate.toISOString());
    const caBrut = (enrollments ?? []).reduce((s, e) => s + ((e as { amount_paid_xof?: number }).amount_paid_xof ?? 0), 0);

    // DAU: sessions active in last 24h
    const dau24h = new Date(now.getTime() - 86400000).toISOString();
    const { data: dauSess } = await sb.from("user_sessions").select("user_id", { count: "exact", head: true }).gte("created_at", dau24h);
    const dau = (dauSess as unknown as { count?: number } | null)?.count ?? 0;

    // Wallets aggregated
    const { data: wallets } = await sb.from("wallets").select("balance_xof,total_earnings_xof");
    const tresorerieSequestree = (wallets ?? []).reduce((s, w) => s + ((w as { balance_xof?: number }).balance_xof ?? 0), 0);

    // Commission rates from site_settings
    const { data: commSetting } = await sb.from("site_settings").select("value").eq("key", "commission_normal_sans_cpd").maybeSingle();
    const commRate = parseFloat((commSetting as { value?: string } | null)?.value ?? "0.30");
    const revenuNet = Math.round(caBrut * commRate);

    // Sales evolution: group enrollments by day
    const salesByDay: Record<string, { amount: number; count: number }> = {};
    for (const e of (enrollments ?? [])) {
      const day = (e as { created_at: string; amount_paid_xof?: number }).created_at.slice(0, 10);
      if (!salesByDay[day]) salesByDay[day] = { amount: 0, count: 0 };
      salesByDay[day].amount += (e as { amount_paid_xof?: number }).amount_paid_xof ?? 0;
      salesByDay[day].count++;
    }
    const ventesEvolution = Object.entries(salesByDay).map(([date, v]) => ({ date, amount_xof: v.amount, count: v.count })).sort((a, b) => a.date.localeCompare(b.date));

    // Geo: from enrollments join users
    const { data: enrollWithUser } = await sb.from("enrollments").select("amount_paid_xof, users!inner(country_code)").gte("created_at", startDate.toISOString());
    const geoMap: Record<string, { count: number; amount: number }> = {};
    for (const e of (enrollWithUser ?? [])) {
      const cc = ((e as { users?: { country_code?: string } }).users?.country_code ?? "—").toUpperCase();
      if (!geoMap[cc]) geoMap[cc] = { count: 0, amount: 0 };
      geoMap[cc].count++;
      geoMap[cc].amount += (e as { amount_paid_xof?: number }).amount_paid_xof ?? 0;
    }
    const repartitionGeo = Object.entries(geoMap).map(([country_code, v]) => ({ country_code, country_name: country_code, sales_count: v.count, amount_xof: v.amount })).sort((a, b) => b.amount_xof - a.amount_xof).slice(0, 10);

    // FinOps from site_settings (if tracked)
    const finops = { ai_tokens_used_month: 0, ai_tokens_cost_usd: 0, cloudflare_stream_minutes_used: 0, cloudflare_stream_cost_usd: 0, r2_storage_gb: 0 };

    // Alertes
    const { count: retraitsCount } = await sb.from("payout_requests").select("*", { count: "exact", head: true }).eq("status", "pending");
    const { count: coursesCount } = await sb.from("courses").select("*", { count: "exact", head: true }).eq("status", "validee");
    const { count: kycProfCount } = await sb.from("professeur_profiles").select("*", { count: "exact", head: true }).eq("kyc_status", "en_attente");
    const { count: kycEtabCount } = await sb.from("etablissement_profiles").select("*", { count: "exact", head: true }).eq("kyc_status", "en_attente");
    const { count: jobsCount } = await sb.from("job_offers").select("*", { count: "exact", head: true }).eq("status", "pending_moderation");

    // Courses à publier (status = validee)
    const { data: coursesToPublish } = await sb.from("courses").select("id,title,instructor_id,score_calcule,price_xof,category,created_at,establishment_id").eq("status", "validee").order("created_at", { ascending: true }).limit(10);
    const enrichedCourses = await Promise.all((coursesToPublish ?? []).map(async (c) => {
      const cc = c as { id: string; title: string; instructor_id: string; score_calcule: number | null; price_xof: number | null; category: string; created_at: string; establishment_id: string | null };
      const { data: u } = await sb.from("users").select("full_name").eq("id", cc.instructor_id).maybeSingle();
      return { ...cc, creator_name: (u as { full_name?: string } | null)?.full_name ?? "—", prix_provisoire_xof: cc.price_xof };
    }));

    return json({
      kpis: { ca_brut_xof: caBrut, revenu_net_plateforme_xof: revenuNet, tresorerie_sequestree_xof: tresorerieSequestree, dau },
      ventes_evolution: ventesEvolution,
      repartition_geo: repartitionGeo,
      repartition_paiement: [],
      finops,
      alertes: { retraits_en_attente: retraitsCount ?? 0, courses_a_publier: coursesCount ?? 0, kyc_en_attente: (kycProfCount ?? 0) + (kycEtabCount ?? 0), offres_emploi_en_attente: jobsCount ?? 0 },
      cours_a_publier: enrichedCourses,
    });
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
