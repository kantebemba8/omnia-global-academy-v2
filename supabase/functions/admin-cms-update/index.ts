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

const ALLOWED_CMS_KEYS = new Set([
  "coming_soon_enabled","coming_soon_title_fr","coming_soon_subtitle_fr","launch_date",
  "social_networks","app_downloads","collaborations_logos","fintech_logos",
  "landing_hero_title_fr","landing_hero_subtitle_fr","landing_stats","landing_piliers",
  "landing_devenir_formateur_title_fr","landing_devenir_formateur_desc_fr","landing_testimonials",
  "a_propos_content_fr","confidentialite_content_fr","referral_reward_referrer_xof",
  "referral_reward_referred_xof","ai_token_per_registration","ai_token_per_purchase",
  "payout_minimum_xof","cpd_premium_price_xof","commission_normal_sans_cpd",
  "commission_normal_avec_cpd","commission_assistee_sans_cpd","commission_assistee_avec_cpd",
  "follow_us_label_fr","category_multipliers","pricing_tiers_json",
  // Colors
  "color_primary","color_accent","color_bg_light","color_success",
  // Maintenance
  "maintenance_enabled","maintenance_message_fr","maintenance_end_time",
  // CPD quiz thresholds
  "quiz_lesson_threshold","quiz_module_threshold","quiz_final_threshold",
  // AI tokens (CPD-related)
  "ai_tokens_inscription","ai_tokens_per_purchase",
  // Text / legal
  "site_slogan","cgu_content_fr","mentions_legales_fr",
]);

async function sendBrevoLaunchEmail(sb: ReturnType<typeof createClient>) {
  const brevoKey = Deno.env.get("BREVO_API_KEY");
  if (!brevoKey) return;

  try {
    const res = await fetch("https://api.brevo.com/v3/emailCampaigns", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": brevoKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: `Lancement Omnia Global Academy — ${new Date().toISOString().slice(0, 10)}`,
        subject: "Omnia Global Academy est maintenant disponible !",
        sender: { name: "Omnia Global Academy", email: "noreply@omniaglobalacademy.com" },
        type: "classic",
        recipients: { listIds: [8] },
        htmlContent: `<!DOCTYPE html>
<html><body style="font-family:Inter,sans-serif;background:#f8f9fa;margin:0;padding:32px 0;">
<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <div style="background:#002050;padding:40px 32px;text-align:center;">
    <h1 style="color:#ffffff;font-size:28px;margin:0 0 8px;">Omnia Global Academy</h1>
    <p style="color:#BF8813;font-size:14px;letter-spacing:0.1em;margin:0;">LA PLATEFORME EST EN LIGNE</p>
  </div>
  <div style="padding:40px 32px;">
    <p style="color:#002050;font-size:18px;font-weight:700;margin:0 0 16px;">La plateforme est enfin disponible !</p>
    <p style="color:#6B7280;font-size:15px;line-height:1.6;margin:0 0 24px;">
      Vous avez été parmi les premiers à vous inscrire sur notre liste d'attente. Aujourd'hui, la plateforme africaine de formation en ligne est officiellement ouverte.
    </p>
    <a href="https://omniaglobalacademy.com" style="display:inline-block;background:#002050;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">
      Découvrir la plateforme
    </a>
    <p style="color:#9CA3AF;font-size:12px;margin:32px 0 0;">© 2026 Omnia Global Academy</p>
  </div>
</div>
</body></html>`,
      }),
    });

    if (res.ok) {
      const campaign = await res.json();
      // Immediately send the campaign
      await fetch(`https://api.brevo.com/v3/emailCampaigns/${campaign.id}/sendNow`, {
        method: "POST",
        headers: { "api-key": brevoKey },
      });
    }
  } catch (e) {
    console.error("Brevo launch email error:", e);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const adminId = await verifySuperAdmin(sb, token);
    if (!adminId) return json({ error: "FORBIDDEN" }, 403);

    if (req.method === "GET") {
      const { data: settings } = await sb.from("site_settings").select("key,value");
      return json({ settings: settings ?? [] });
    }

    const { updates } = await req.json() as { updates: { key: string; value: string }[] };
    if (!Array.isArray(updates)) return json({ error: "INVALID_PARAMS" }, 400);

    const invalid = updates.filter((u) => !ALLOWED_CMS_KEYS.has(u.key));
    if (invalid.length > 0) return json({ error: "INVALID_KEY", keys: invalid.map((u) => u.key) }, 400);

    // Detect coming_soon → live toggle
    const comingSoonUpdate = updates.find((u) => u.key === "coming_soon_enabled");
    let wasComingSoon = false;
    if (comingSoonUpdate && comingSoonUpdate.value === "false") {
      const { data: current } = await sb
        .from("site_settings")
        .select("value")
        .eq("key", "coming_soon_enabled")
        .maybeSingle();
      wasComingSoon = (current as { value: string } | null)?.value === "true";
    }

    const now = new Date().toISOString();
    let updated = 0;
    for (const { key, value } of updates) {
      await sb.from("site_settings").upsert({ key, value, updated_at: now }, { onConflict: "key" });
      updated++;
    }

    // Site launch detected — log + send Brevo email to waitlist list #8
    if (wasComingSoon) {
      await sb.from("security_audit_log").insert({
        event_type: "site_launched",
        severity: "info",
        user_id: adminId,
        metadata: { triggered_by: adminId, timestamp: now },
      });
      await sendBrevoLaunchEmail(sb);
    }

    return json({ success: true, updated, launched: wasComingSoon });
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
