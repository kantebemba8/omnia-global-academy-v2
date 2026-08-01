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
  "landing_page_published",
  "collaborations_logos",
  "follow_us_label_fr",
  "stat_formations",
  "stat_apprenants",
  "stat_pays",
  "stat_formateurs",
  "stat_etablissements",
  "stat_show_formations",
  "stat_show_apprenants",
  "stat_show_pays",
  "stat_show_formateurs",
  "stat_show_etablissements",
];

function parseSetting(value: unknown): unknown {
  if (value == null || typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return value;
  }
}

function settingIsTrue(value: unknown): boolean {
  return value === true || value === "true";
}

function isSafeExternalUrl(value: unknown): boolean {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function publicSocialNetworks(value: unknown) {
  const items = Array.isArray(value) ? value : [];
  return items
    .filter((item: any) => item && item.enabled === true && (item.show_homepage === true || item.show_footer === true) && isSafeExternalUrl(item.url) && ((item.icon_key && item.icon_key !== "other") || isSafeExternalUrl(item.logo_url)))
    .sort((a: any, b: any) => Number(a.display_order || 0) - Number(b.display_order || 0));
}

function publicMobileApps(value: unknown) {
  const items = Array.isArray(value) ? value : [];
  return items
    .filter((item: any) => item && item.enabled === true && (item.show_homepage === true || item.show_footer === true) && isSafeExternalUrl(item.url))
    .sort((a: any, b: any) => Number(a.display_order || 0) - Number(b.display_order || 0));
}

function uniqueCount(values: string[]) {
  return new Set(values).size;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ success: false, message: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const [
      settingsResult,
      coursesResult,
      categoriesResult,
      activeUsersResult,
      rolesResult,
      structuresResult,
      cmsStateResult,
      partnersResult,
    ] = await Promise.all([
      supabase.from("site_settings").select("key, value").in("key", LANDING_KEYS),
      supabase
        .from("courses")
        .select("id,title,short_description,cover_image_url,category,level,price_xof,is_free,cpd_hours,cpd_accredited,average_rating,total_reviews,total_students,creator_id,creator_type,language,total_duration_seconds", { count: "exact" })
        .eq("is_published", true)
        .order("average_rating", { ascending: false })
        .order("total_students", { ascending: false })
        .limit(8),
      supabase.from("courses").select("category").eq("is_published", true),
      supabase.from("users").select("id,country_code").eq("status", "actif"),
      supabase.from("user_roles").select("user_id,role").in("role", ["apprenant", "professeur", "structure"]),
      supabase.from("partner_organizations").select("id", { count: "exact", head: true }).eq("status", "validated"),
      supabase.from("landing_page_cms_state").select("social_networks,mobile_apps").eq("id", 1).maybeSingle(),
      supabase
        .from("public_partners")
        .select("id,name,category,logo_url,website_url,description,display_order,is_featured,status,logo_authorized,show_homepage,show_footer,alt_text")
        .eq("is_active", true)
        .eq("status", "active")
        .eq("logo_authorized", true)
        .or("show_homepage.eq.true,show_footer.eq.true")
        .not("logo_url", "is", null)
        .order("display_order")
        .order("name"),
    ]);

    const firstError = [
      settingsResult.error,
      coursesResult.error,
      categoriesResult.error,
      activeUsersResult.error,
      rolesResult.error,
      structuresResult.error,
      cmsStateResult.error,
      partnersResult.error,
    ].find(Boolean);
    if (firstError) throw firstError;

    const settings: Record<string, unknown> = {};
    for (const row of settingsResult.data ?? []) settings[row.key] = parseSetting(row.value);

    const publicPartners = (partnersResult.data ?? [])
      .filter((partner: any) => isSafeExternalUrl(partner.logo_url))
      .map((partner: any) => ({
        ...partner,
        website_url: isSafeExternalUrl(partner.website_url) ? partner.website_url : null,
      }));

    const categoryCounts: Record<string, number> = {};
    for (const row of categoriesResult.data ?? []) {
      if (row.category) categoryCounts[row.category] = (categoryCounts[row.category] ?? 0) + 1;
    }

    const activeUsers = activeUsersResult.data ?? [];
    const activeIds = new Set(activeUsers.map((user: { id: string }) => user.id));
    const roles = rolesResult.data ?? [];
    const roleUserIds = (role: string) => roles
      .filter((item: { user_id: string; role: string }) => item.role === role && activeIds.has(item.user_id))
      .map((item: { user_id: string }) => item.user_id);

    const formationsCount = Number(coursesResult.count ?? 0);
    const apprenantsCount = uniqueCount(roleUserIds("apprenant"));
    const formateursCount = uniqueCount(roleUserIds("professeur"));
    const structuresCount = Number(structuresResult.count ?? 0);
    const distinctCountries = uniqueCount(
      activeUsers
        .map((user: { country_code: string | null }) => user.country_code)
        .filter((value: string | null): value is string => Boolean(value)),
    );

    const creatorIds = Array.from(new Set((coursesResult.data ?? [])
      .map((course: { creator_id?: string | null }) => course.creator_id)
      .filter((value: string | null | undefined): value is string => Boolean(value))));

    const creatorNames = new Map<string, string>();
    if (creatorIds.length > 0) {
      const { data: creators, error: creatorsError } = await supabase
        .from("users")
        .select("id,full_name")
        .in("id", creatorIds);
      if (creatorsError) throw creatorsError;
      for (const creator of creators ?? []) creatorNames.set(creator.id, creator.full_name);
    }

    const featuredCourses = (coursesResult.data ?? []).map((course: any) => ({
      ...course,
      creator_name: course.creator_id ? creatorNames.get(course.creator_id) ?? null : null,
    }));

    const customStat = (key: string, fallback: number) => {
      const value = settings[key];
      if (typeof value === "string" && value.trim()) return value.trim();
      if (typeof value === "number" && Number.isFinite(value)) return String(value);
      return fallback > 0 ? fallback.toLocaleString("fr-FR") : null;
    };

    const stats = {
      formations: customStat("stat_formations", formationsCount),
      apprenants: customStat("stat_apprenants", apprenantsCount),
      pays: customStat("stat_pays", distinctCountries),
      formateurs: customStat("stat_formateurs", formateursCount),
      etablissements: customStat("stat_etablissements", structuresCount),
    };

    const payload = {
      hero: {
        title_fr: settings["landing_hero_title_fr"] ?? "Apprenez. Prouvez vos compétences. Avancez.",
        subtitle_fr: settings["landing_hero_subtitle_fr"] ?? "Omnia réunit formations, projets, certifications vérifiables, coaching, événements en direct et opportunités professionnelles dans un même parcours.",
      },
      stats,
      stats_visibility: {
        formations: settingIsTrue(settings["stat_show_formations"]),
        apprenants: settingIsTrue(settings["stat_show_apprenants"]),
        pays: settingIsTrue(settings["stat_show_pays"]),
        formateurs: settingIsTrue(settings["stat_show_formateurs"]),
        etablissements: settingIsTrue(settings["stat_show_etablissements"]),
      },
      piliers: settings["landing_piliers"] ?? [],
      featured_courses: featuredCourses,
      devenir_formateur: {
        title_fr: settings["landing_devenir_formateur_title_fr"] ?? "Partagez votre savoir avec l’Afrique",
        desc_fr: settings["landing_devenir_formateur_desc_fr"] ?? "",
      },
      fintech_logos: settings["fintech_logos"] ?? [],
      social_networks_v2: publicSocialNetworks(cmsStateResult.data?.social_networks),
      mobile_apps_v2: publicMobileApps(cmsStateResult.data?.mobile_apps),
      landing_page: settings["landing_page_published"] ?? {},
      collaborations_logos: settings["collaborations_logos"] ?? [],
      public_partners: publicPartners,
      follow_us_label_fr: settings["follow_us_label_fr"] ?? "Suivez-nous",
      category_counts: categoryCounts,
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("landing-data error:", error);
    return new Response(JSON.stringify({ success: false, message: "Erreur serveur" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
