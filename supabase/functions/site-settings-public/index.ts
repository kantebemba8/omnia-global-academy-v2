import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get('ALLOWED_ORIGIN') || "https://omniaglobalacademy.com",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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
    const supabaseAnon = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { data: settings, error } = await supabaseAnon
      .from('site_settings')
      .select('key, value');

    if (error) {
      throw error;
    }

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
      social_networks: parseObjectSetting(settingsMap.social_networks, {
        facebook: null,
        instagram: null,
        youtube: null,
        linkedin: null,
        indeed: null,
        whatsapp: null,
      }),
      follow_us_label_fr: settingsMap.follow_us_label_fr || "Suivez-nous",
      app_downloads: parseObjectSetting(settingsMap.app_downloads, {
        google_play: null,
        app_store: null,
      }),
      collaborations_logos: parseObjectSetting(settingsMap.collaborations_logos, []),
      favicon_url: settingsMap.favicon_url || null,
      site_slogan: settingsMap.site_slogan || null,
      referral_enabled: settingsMap.referral_enabled === 'true' || settingsMap.referral_enabled === true,
      referral_reward_referrer_xof: parseNumberSetting(settingsMap.referral_reward_referrer_xof, 0),
      referral_reward_referred_xof: parseNumberSetting(settingsMap.referral_reward_referred_xof, 0),
    };

    const { data: publicPartners } = await supabaseAnon
      .from("public_partners")
      .select("id,name,category,logo_url,website_url,description,display_order,is_featured")
      .eq("is_active", true)
      .order("display_order")
      .order("name");
    (publicSettings as any).public_partners = publicPartners ?? [];
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
