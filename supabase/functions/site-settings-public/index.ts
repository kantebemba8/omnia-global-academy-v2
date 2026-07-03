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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
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

    // Build the response with only public settings
    const publicSettings = {
      coming_soon_enabled: settingsMap.coming_soon_enabled === 'true' || settingsMap.coming_soon_enabled === true,
      coming_soon_title_fr: settingsMap.coming_soon_title_fr || "La plateforme africaine de formation en ligne arrive bientot",
      coming_soon_subtitle_fr: settingsMap.coming_soon_subtitle_fr || "Des formations d'elite et interactives, parfaitement adaptees aux realites professionnelles africaines.",
      launch_date: settingsMap.launch_date || null,
      social_networks: settingsMap.social_networks || {
        facebook: null,
        instagram: null,
        youtube: null,
        linkedin: null,
        indeed: null,
        whatsapp: null,
      },
      follow_us_label_fr: settingsMap.follow_us_label_fr || "Suivez-nous",
      app_downloads: settingsMap.app_downloads || {
        google_play: null,
        app_store: null,
      },
      collaborations_logos: settingsMap.collaborations_logos || [],
    };

    // Fetch waitlist count via service role (bypasses RLS)
    const { count } = await supabaseAdmin
      .from('waitlist')
      .select('*', { count: 'exact', head: true });

    return new Response(JSON.stringify({ ...publicSettings, waitlist_count: count ?? 0 }), {
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
