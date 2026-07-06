import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { corsHeaders } from "../_shared/cors.ts";

const LANDING_KEYS = [
  "landing_hero_title_fr",
  "landing_hero_subtitle_fr",
  "landing_stats",
  "landing_piliers",
  "landing_devenir_formateur_title_fr",
  "landing_devenir_formateur_desc_fr",
  "fintech_logos",
  "landing_testimonials",
  "social_networks",
  "app_downloads",
  "collaborations_logos",
 "follow_us_label_fr",
  "stat_formations","stat_apprenants","stat_pays","stat_formateurs","stat_etablissements",
];

function parseSetting(value: string): unknown {
  try { return JSON.parse(value); } catch { return value; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ success: false, message: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const [settingsResult, coursesResult, catResult, statsResult] = await Promise.all([
      supabase.from("site_settings").select("key, value").in("key", LANDING_KEYS),
      supabase
        .from("courses")
        .select("id, title, short_description, cover_image_url, category, level, price_xof, is_free, cpd_hours, average_rating, total_reviews, total_students")
        .eq("is_published", true)
        .order("average_rating", { ascending: false })
        .order("total_students", { ascending: false })
        .limit(8),
      supabase.from("courses").select("category").eq("is_published", true),
      // Calculer les vraies stats depuis la base
      Promise.all([
        supabase.from("courses").select("id", { count: "exact", head: true }).eq("is_published", true),
        supabase.from("users").select("id", { count: "exact", head: true }).eq("status", "actif"),
        supabase.from("users").select("country_code", { count: "exact", head: true }).eq("status", "actif"),
        supabase.from("users").select("id", { count: "exact", head: true }).eq("role", "professeur"),
        supabase.from("users").select("id", { count: "exact", head: true }).eq("role", "directeur"),
      ]),
    ]);

    const settings: Record<string, unknown> = {};
    for (const row of settingsResult.data ?? []) {
      settings[row.key] = parseSetting(row.value);
    }

    const categoryCounts: Record<string, number> = {};
    for (const row of catResult.data ?? []) {
      if (row.category) categoryCounts[row.category] = (categoryCounts[row.category] ?? 0) + 1;
    }

    // Stats depuis la base — null si 0 (ne pas afficher)
    const [formationsRes, apprenantsRes, paysRes, formateursRes, etablissementsRes] = statsResult;
    const formationsCount = formationsRes.count ?? 0;
    const apprenantsCount = apprenantsRes.count ?? 0;
    const formateursCount = formateursRes.count ?? 0;
    const etablissementsCount = etablissementsRes.count ?? 0;

    // Compter les pays distincts
    const { data: usersWithCountry } = await supabase
      .from("users")
      .select("country_code")
      .eq("status", "actif")
      .not("country_code", "is", null);
    const distinctPays = new Set((usersWithCountry ?? []).map((u: { country_code: string }) => u.country_code)).size;

   // Lire les stats custom depuis site_settings (clés individuelles)
   const [statForm, statApp, statPays, statForm2, statEtab,
           showForm, showApp, showPays, showForm2, showEtab] = await Promise.all([
      supabase.from("site_settings").select("value").eq("key", "stat_formations").maybeSingle(),
      supabase.from("site_settings").select("value").eq("key", "stat_apprenants").maybeSingle(),
      supabase.from("site_settings").select("value").eq("key", "stat_pays").maybeSingle(),
      supabase.from("site_settings").select("value").eq("key", "stat_formateurs").maybeSingle(),
      supabase.from("site_settings").select("value").eq("key", "stat_etablissements").maybeSingle(),
      supabase.from("site_settings").select("value").eq("key", "stat_show_formations").maybeSingle(),
      supabase.from("site_settings").select("value").eq("key", "stat_show_apprenants").maybeSingle(),
      supabase.from("site_settings").select("value").eq("key", "stat_show_pays").maybeSingle(),
      supabase.from("site_settings").select("value").eq("key", "stat_show_formateurs").maybeSingle(),
      supabase.from("site_settings").select("value").eq("key", "stat_show_etablissements").maybeSingle(),
    ]);

    // Stats : valeur CMS si définie et non vide, sinon valeur réelle de la base, sinon null
    const stats: Record<string, string | null> = {
      formations:     (statForm.data?.value || null) ?? (formationsCount > 0 ? `${formationsCount}+` : null),
      apprenants:     (statApp.data?.value || null) ?? (apprenantsCount > 0 ? `${apprenantsCount.toLocaleString('fr-FR')}+` : null),
      pays:           (statPays.data?.value || null) ?? (distinctPays > 0 ? `${distinctPays}+` : null),
      formateurs:     (statForm2.data?.value || null) ?? (formateursCount > 0 ? `${formateursCount}+` : null),
      etablissements: (statEtab.data?.value || null) ?? (etablissementsCount > 0 ? `${etablissementsCount}+` : null),
    };
    const payload = {
      hero: {
        title_fr:    settings["landing_hero_title_fr"]    ?? "Formez-vous, certifiez-vous, transformez votre avenir",
        subtitle_fr: settings["landing_hero_subtitle_fr"] ?? "Des formations certifiées CPD, accessibles partout en Afrique de l'Ouest, payables par Mobile Money.",
      },
      stats,
      stats_visibility: {
        formations:     showForm.data?.value === 'true',
        apprenants:     showApp.data?.value === 'true',
        pays:           showPays.data?.value === 'true',
        formateurs:     showForm2.data?.value === 'true',
        etablissements: showEtab.data?.value === 'true',
      },
      piliers:         settings["landing_piliers"]                     ?? [],
      featured_courses: coursesResult.data ?? [],
      devenir_formateur: {
        title_fr: settings["landing_devenir_formateur_title_fr"] ?? "Partagez votre savoir avec l'Afrique",
        desc_fr:  settings["landing_devenir_formateur_desc_fr"]  ?? "",
      },
      fintech_logos:      settings["fintech_logos"]       ?? [],
      social_networks:    settings["social_networks"]     ?? {},
      app_downloads:      settings["app_downloads"]       ?? {},
      collaborations_logos: settings["collaborations_logos"] ?? [],
      follow_us_label_fr: settings["follow_us_label_fr"] ?? "Suivez-nous",
      category_counts: categoryCounts,
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("landing-data error:", err);
    return new Response(JSON.stringify({ success: false, message: "Erreur serveur" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
