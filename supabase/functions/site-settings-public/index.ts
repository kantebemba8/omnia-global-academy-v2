import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { getAnthropicApiKey, getAnthropicFastModel, getOpenAITextModel } from "../_shared/ai-models.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get('ALLOWED_ORIGIN') || "https://omniaglobalacademy.com",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-omnia-session-token",
};


const UI_LANGUAGES = new Set(["en", "es", "pt", "ar", "zh", "ru", "de"]);
const LANGUAGE_NAMES: Record<string, string> = {
  en: "English", es: "Spanish", pt: "Portuguese", ar: "Arabic",
  zh: "Simplified Chinese", ru: "Russian", de: "German",
};

function publicJson(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeUiSource(value: unknown) {
  return String(value ?? "").replace(/\u00a0/g, " ").replace(/[\t\r\n ]+/g, " ").trim().slice(0, 500);
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function extractJsonArray(raw: string): string[] | null {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return Array.isArray(parsed) && parsed.every(item => typeof item === "string") ? parsed : null;
  } catch {
    return null;
  }
}

async function generateUiTranslations(language: string, sources: string[]) {
  if (!sources.length) return [];
  const target = LANGUAGE_NAMES[language] || language;
  const prompt = [
    `Translate this French software-interface JSON array into ${target}.`,
    "Return ONLY a JSON array of strings in exactly the same order and with exactly the same number of items.",
    "Keep Omnia, OGA, CPD, product names, URLs, file formats, placeholders and technical identifiers unchanged.",
    "Use concise, natural, professional interface language. Do not add explanations.",
    JSON.stringify(sources),
  ].join("\n");

  const anthropicKey = getAnthropicApiKey();
  if (anthropicKey) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: getAnthropicFastModel(),
        max_tokens: 6000,
        temperature: 0,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (response.ok) {
      const payload = await response.json();
      const raw = Array.isArray(payload?.content) ? payload.content.map((item: { text?: string }) => item?.text || "").join("") : "";
      const parsed = extractJsonArray(raw);
      if (parsed?.length === sources.length) return parsed;
    } else {
      console.error("UI translation Anthropic error", response.status, await response.text());
    }
  }

  const openAiKey = Deno.env.get("OPENAI_API_KEY") || "";
  if (openAiKey) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openAiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: getOpenAITextModel(),
        temperature: 0,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (response.ok) {
      const payload = await response.json();
      const parsed = extractJsonArray(String(payload?.choices?.[0]?.message?.content || ""));
      if (parsed?.length === sources.length) return parsed;
    } else {
      console.error("UI translation OpenAI error", response.status, await response.text());
    }
  }

  return [];
}


function collectPublicCmsStrings(value: unknown, output: Set<string>, depth = 0) {
  if (depth > 8 || output.size > 3000) return;
  if (typeof value === "string") {
    const normalized = normalizeUiSource(value);
    if (normalized.length >= 2 && normalized.length <= 500) output.add(normalized);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach(item => collectPublicCmsStrings(item, output, depth + 1));
    return;
  }
  if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach(item => collectPublicCmsStrings(item, output, depth + 1));
  }
}

async function registerPublicCmsSources(sb: ReturnType<typeof createClient>, candidates: string[]) {
  if (!candidates.length) return;
  const allowedKeys = [
    "landing_page_published", "maintenance_message_fr", "social_networks_v2", "mobile_apps_v2",
  ];
  const [{ data: settings }, { data: cms }] = await Promise.all([
    sb.from("site_settings").select("key,value").in("key", allowedKeys),
    sb.from("landing_page_cms_state").select("social_networks,mobile_apps").eq("id", 1).maybeSingle(),
  ]);
  const publicStrings = new Set<string>();
  (settings || []).forEach((row: { value: unknown }) => collectPublicCmsStrings(row.value, publicStrings));
  collectPublicCmsStrings(cms, publicStrings);
  const accepted = candidates.filter(source => publicStrings.has(source));
  if (!accepted.length) return;
  const { error } = await sb.rpc("oga_i18n_register_sources", { p_sources: accepted });
  if (error) throw error;
}

async function translateUiBatch(req: Request, sb: ReturnType<typeof createClient>) {
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || body.action !== "translate_ui_batch") return publicJson({ error: "INVALID_ACTION" }, 400);
  const language = String(body.language || "").trim().toLowerCase();
  if (!UI_LANGUAGES.has(language)) return publicJson({ error: "INVALID_LANGUAGE" }, 400);
  const rawTexts = Array.isArray(body.texts) ? body.texts : [];
  const texts = [...new Set(rawTexts.map(normalizeUiSource).filter(value => value.length >= 2))].slice(0, 25);
  if (!texts.length) return publicJson({ success: true, language, translations: {}, missing: [] });

  const clientMarker = [
    req.headers.get("x-omnia-session-token") || "public",
    req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "unknown",
    req.headers.get("user-agent") || "unknown",
  ].join("|").slice(0, 1000);
  const quotaKey = await sha256(clientMarker);
  const { data: allowed, error: quotaError } = await sb.rpc("oga_i18n_consume_quota", {
    p_quota_key: quotaKey,
    p_limit: 120,
    p_window_seconds: 3600,
  });
  if (quotaError) throw quotaError;
  if (!allowed) return publicJson({ error: "TRANSLATION_RATE_LIMITED" }, 429);

  const { data: registered, error: readError } = await sb
    .from("platform_ui_translations")
    .select("source_hash,source_text,translations,machine_generated_languages,hit_count")
    .in("source_text", texts);
  if (readError) throw readError;

  let rows = registered || [];
  let rowMap = new Map(rows.map((row: Record<string, unknown>) => [String(row.source_text), row]));
  const initiallyUnknown = texts.filter(source => !rowMap.has(source));
  if (initiallyUnknown.length) {
    await registerPublicCmsSources(sb, initiallyUnknown);
    const { data: refreshed, error: refreshError } = await sb
      .from("platform_ui_translations")
      .select("source_hash,source_text,translations,machine_generated_languages,hit_count")
      .in("source_text", texts);
    if (refreshError) throw refreshError;
    rows = refreshed || [];
    rowMap = new Map(rows.map((row: Record<string, unknown>) => [String(row.source_text), row]));
  }
  const translations: Record<string, string> = {};
  const missingRows: Record<string, unknown>[] = [];
  for (const source of texts) {
    const row = rowMap.get(source);
    if (!row) continue; // Toute chaîne non enregistrée est ignorée : aucun contenu utilisateur n'est envoyé à l'IA.
    const existing = row.translations && typeof row.translations === "object"
      ? String((row.translations as Record<string, unknown>)[language] || "").trim()
      : "";
    if (existing) translations[source] = existing;
    else missingRows.push(row);
  }

  let generated = 0;
  if (missingRows.length) {
    const generatedValues = await generateUiTranslations(language, missingRows.map(row => String(row.source_text)));
    if (generatedValues.length === missingRows.length) {
      for (let index = 0; index < missingRows.length; index += 1) {
        const row = missingRows[index];
        const source = String(row.source_text);
        const translated = normalizeUiSource(generatedValues[index]).slice(0, 1000);
        if (!translated) continue;
        const currentTranslations = row.translations && typeof row.translations === "object" ? row.translations as Record<string, unknown> : {};
        const machineLanguages = Array.isArray(row.machine_generated_languages)
          ? [...new Set([...row.machine_generated_languages.map(String), language])]
          : [language];
        const { error: updateError } = await sb.from("platform_ui_translations").update({
          translations: { ...currentTranslations, [language]: translated },
          machine_generated_languages: machineLanguages,
          hit_count: Number(row.hit_count || 0) + 1,
          last_requested_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("source_hash", row.source_hash);
        if (updateError) throw updateError;
        translations[source] = translated;
        generated += 1;
      }
    }
  }

  const unresolved = texts.filter(source => rowMap.has(source) && !translations[source]);
  return publicJson({
    success: true,
    language,
    translations,
    generated,
    cached: Object.keys(translations).length - generated,
    missing: unresolved,
    ignored: texts.filter(source => !rowMap.has(source)),
  });
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return publicJson({ error: "METHOD_NOT_ALLOWED" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '');
    const supabaseService = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    if (req.method === "POST") return await translateUiBatch(req, supabaseService);

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
