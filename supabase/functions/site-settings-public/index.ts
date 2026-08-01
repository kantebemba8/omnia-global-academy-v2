import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get('ALLOWED_ORIGIN') || "https://omniaglobalacademy.com",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function isSafeExternalUrl(value: unknown): boolean {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '');
    const supabaseService = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    const [{ data: settings, error }, { data: cmsState, error: cmsError }] = await Promise.all([
      supabaseAnon
      .from('site_settings')
      .select('key, value'),
      supabaseService
        .from('landing_page_cms_state')
        .select('social_networks,mobile_apps')
        .eq('id', 1)
        .maybeSingle(),
    ]);

    if (error) throw error;
    if (cmsError) throw cmsError;

    // Transform the array into an object
    const settingsMap: Record<string, any> = {};
    for (const setting of settings || []) {
      settingsMap[setting.key] = setting.value;
    }

    const parseObjectSetting = (value: any, fallback: any) => {
      if (value == null) return fallback;
      if (typeof value === "object") return value;
      try { return JSON.parse(value); } catch { return fallback; }
    };

    const parseArraySetting = (value: any) => {
      const parsed = parseObjectSetting(value, []);
      return Array.isArray(parsed) ? parsed : [];
    };

    const parseNumberSetting = (value: any, fallback = 0) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : fallback;
    };

    // Build the response with only public settings.
    // Coming Soon / liste d'attente globale ont été retirés.
    const publicSettings = {
      maintenance_enabled: settingsMap.maintenance_enabled === 'true' || settingsMap.maintenance_enabled === true,
      maintenance_message_fr: settingsMap.maintenance_message_fr || "",
      maintenance_start_time: settingsMap.maintenance_start_time || null,
      maintenance_end_time: settingsMap.maintenance_end_time || null,
      maintenance_module_omnia_live: settingsMap.maintenance_module_omnia_live === 'true' || settingsMap.maintenance_module_omnia_live === true,
      maintenance_module_career: settingsMap.maintenance_module_career === 'true' || settingsMap.maintenance_module_career === true,
      maintenance_module_talent: settingsMap.maintenance_module_talent === 'true' || settingsMap.maintenance_module_talent === true,
      maintenance_module_forum: settingsMap.maintenance_module_forum === 'true' || settingsMap.maintenance_module_forum === true,
      maintenance_module_payments: settingsMap.maintenance_module_payments === 'true' || settingsMap.maintenance_module_payments === true,
      maintenance_module_formations: settingsMap.maintenance_module_formations === 'true' || settingsMap.maintenance_module_formations === true,
      maintenance_module_omnia_live_start_time: settingsMap.maintenance_module_omnia_live_start_time || null,
      maintenance_module_omnia_live_end_time: settingsMap.maintenance_module_omnia_live_end_time || null,
      maintenance_module_career_start_time: settingsMap.maintenance_module_career_start_time || null,
      maintenance_module_career_end_time: settingsMap.maintenance_module_career_end_time || null,
      maintenance_module_talent_start_time: settingsMap.maintenance_module_talent_start_time || null,
      maintenance_module_talent_end_time: settingsMap.maintenance_module_talent_end_time || null,
      maintenance_module_forum_start_time: settingsMap.maintenance_module_forum_start_time || null,
      maintenance_module_forum_end_time: settingsMap.maintenance_module_forum_end_time || null,
      maintenance_module_payments_start_time: settingsMap.maintenance_module_payments_start_time || null,
      maintenance_module_payments_end_time: settingsMap.maintenance_module_payments_end_time || null,
      maintenance_module_formations_start_time: settingsMap.maintenance_module_formations_start_time || null,
      maintenance_module_formations_end_time: settingsMap.maintenance_module_formations_end_time || null,
      maintenance_notice_platform: settingsMap.maintenance_notice_platform === 'true' || settingsMap.maintenance_notice_platform === true,
      maintenance_notice_message_fr: settingsMap.maintenance_notice_message_fr || "",
      maintenance_notice_at: settingsMap.maintenance_notice_at || null,
      page_content: parseObjectSetting(settingsMap.page_content, {}),
      landing_page: parseObjectSetting(settingsMap.landing_page_published, {}),
      social_networks_v2: parseArraySetting(cmsState?.social_networks)
        .filter((item: any) => item && item.enabled === true && (item.show_homepage === true || item.show_footer === true) && isSafeExternalUrl(item.url) && ((item.icon_key && item.icon_key !== "other") || isSafeExternalUrl(item.logo_url)))
        .sort((a: any, b: any) => Number(a.display_order || 0) - Number(b.display_order || 0)),
      follow_us_label_fr: settingsMap.follow_us_label_fr || "Suivez-nous",
      mobile_apps_v2: parseArraySetting(cmsState?.mobile_apps)
        .filter((item: any) => item && item.enabled === true && (item.show_homepage === true || item.show_footer === true) && isSafeExternalUrl(item.url))
        .sort((a: any, b: any) => Number(a.display_order || 0) - Number(b.display_order || 0)),
      collaborations_logos: parseObjectSetting(settingsMap.collaborations_logos, []),
      favicon_url: settingsMap.favicon_url || null,
      site_slogan: settingsMap.site_slogan || null,
      referral_enabled: settingsMap.referral_enabled === 'true' || settingsMap.referral_enabled === true,
      referral_reward_referrer_xof: parseNumberSetting(settingsMap.referral_reward_referrer_xof, 0),
      referral_reward_referred_xof: parseNumberSetting(settingsMap.referral_reward_referred_xof, 0),
    };

    const { data: publicPartners, error: partnersError } = await supabaseAnon
      .from("public_partners")
      .select("id,name,category,logo_url,website_url,description,display_order,is_featured,status,logo_authorized,show_homepage,show_footer,alt_text")
      .eq("is_active", true)
      .eq("status", "active")
      .eq("logo_authorized", true)
      .or("show_homepage.eq.true,show_footer.eq.true")
      .order("display_order")
      .order("name");
    if (partnersError) throw partnersError;
    (publicSettings as any).public_partners = (publicPartners ?? [])
      .filter((partner: any) => isSafeExternalUrl(partner.logo_url))
      .map((partner: any) => ({
        ...partner,
        website_url: isSafeExternalUrl(partner.website_url) ? partner.website_url : null,
      }));
    (publicSettings as any).legal = {
      cgu: settingsMap.cgu_content_fr || "",
      confidentialite: settingsMap.confidentialite_content_fr || "",
      mentions_legales: settingsMap.mentions_legales_fr || "",
      cookies: settingsMap.cookies_content_fr || "",
      cgv: settingsMap.cgv_content_fr || "",
      remboursements: settingsMap.refund_policy_content_fr || "",
    };

    return new Response(JSON.stringify(publicSettings), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error('Error fetching site settings:', error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
