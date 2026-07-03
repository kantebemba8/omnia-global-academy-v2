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
];

function parseSetting(value: string): unknown {
  try { return JSON.parse(value); } catch { return value; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
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

    const [settingsResult, coursesResult, catResult] = await Promise.all([
      supabase.from("site_settings").select("key, value").in("key", LANDING_KEYS),
      supabase
        .from("courses")
        .select("id, title, short_description, cover_image_url, category, level, price_xof, is_free, cpd_hours, average_rating, total_reviews, total_students")
        .eq("is_published", true)
        .order("average_rating", { ascending: false })
        .order("total_students", { ascending: false })
        .limit(8),
      supabase.from("courses").select("category").eq("is_published", true),
    ]);

    const settings: Record<string, unknown> = {};
    for (const row of settingsResult.data ?? []) {
      settings[row.key] = parseSetting(row.value);
    }

    const categoryCounts: Record<string, number> = {};
    for (const row of catResult.data ?? []) {
      if (row.category) categoryCounts[row.category] = (categoryCounts[row.category] ?? 0) + 1;
    }

    const payload = {
      hero: {
        title_fr:    settings["landing_hero_title_fr"]    ?? "Formez-vous, certifiez-vous, transformez votre avenir",
        subtitle_fr: settings["landing_hero_subtitle_fr"] ?? "Des formations certifiées CPD, accessibles partout en Afrique de l'Ouest.",
      },
      stats:           settings["landing_stats"]                       ?? { formations: "500+", apprenants: "10 000+", pays: "15+", formateurs: "200+" },
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
