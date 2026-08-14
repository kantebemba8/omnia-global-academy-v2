import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { getActiveOmniaSessionResult } from "../_shared/omnia-auth.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Client-Info,Apikey,x-omnia-session-token",
};

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function verifySuperAdmin(sb: ReturnType<typeof createClient>, token: string) {
  const { data: sess } = await getActiveOmniaSessionResult(sb, token);
  if (!sess) return null;
  const { data: role } = await sb.from("user_roles").select("role").eq("user_id", (sess as { user_id: string }).user_id).eq("role", "super_admin").maybeSingle();
  if (!role) return null;
  return (sess as { user_id: string }).user_id;
}


const UI_LANGUAGES = new Set(["en", "es", "pt", "ar", "zh", "ru", "de"]);
const UI_LANGUAGE_NAMES: Record<string, string> = {
  en: "English", es: "Spanish", pt: "Portuguese", ar: "Arabic",
  zh: "Simplified Chinese", ru: "Russian", de: "German",
};

function aiTranslationEnabled() {
  return Boolean(Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("CLAUDE_API_KEY") || Deno.env.get("OPENAI_API_KEY"));
}

function extractTranslationArray(raw: string): string[] | null {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return Array.isArray(parsed) && parsed.every(item => typeof item === "string") ? parsed : null;
  } catch { return null; }
}

async function generateTranslationValues(language: string, sources: string[]) {
  const target = UI_LANGUAGE_NAMES[language] || language;
  const prompt = [
    `Translate this French software-interface JSON array into ${target}.`,
    "Return ONLY a JSON array of strings in the same order and with the same number of items.",
    "Keep Omnia, OGA, CPD, URLs, file formats, placeholders and technical identifiers unchanged.",
    "Use concise, natural, professional interface language. Do not add explanations.",
    JSON.stringify(sources),
  ].join("\n");
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("CLAUDE_API_KEY") || "";
  if (anthropicKey) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": anthropicKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: Deno.env.get("ANTHROPIC_MODEL") || "claude-3-5-haiku-latest", max_tokens: 6000, temperature: 0, messages: [{ role: "user", content: prompt }] }),
    });
    if (response.ok) {
      const payload = await response.json();
      const raw = Array.isArray(payload?.content) ? payload.content.map((item: { text?: string }) => item?.text || "").join("") : "";
      const parsed = extractTranslationArray(raw);
      if (parsed?.length === sources.length) return parsed;
    } else console.error("Admin i18n Anthropic error", response.status, await response.text());
  }
  const openAiKey = Deno.env.get("OPENAI_API_KEY") || "";
  if (openAiKey) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openAiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: Deno.env.get("OPENAI_TEXT_MODEL") || "gpt-4o-mini", temperature: 0, messages: [{ role: "user", content: prompt }] }),
    });
    if (response.ok) {
      const payload = await response.json();
      const parsed = extractTranslationArray(String(payload?.choices?.[0]?.message?.content || ""));
      if (parsed?.length === sources.length) return parsed;
    } else console.error("Admin i18n OpenAI error", response.status, await response.text());
  }
  return [];
}

// Clés interdites — ne peuvent jamais être modifiées via le CMS
const FORBIDDEN_KEYS = new Set([
  "super_admin_id",
  "service_role_key",
  "fedapay_secret_key",
  "brevo_api_key",
  "html2pdf_api_key",
  "cron_secret",
]);

const GOVERNED_KEYS = new Set([
  "landing_page_published",
  "landing_page_publication_meta",
  "landing_page_draft",
  "landing_page_previous_published",
  "social_networks_v2",
  "mobile_apps_v2",
]);


const LANDING_SECTION_TYPES = new Set([
  "hero", "goal_selector", "omnia_journey", "featured_courses", "ecosystem",
  "credentials", "career_recruitment", "structures", "partners", "mobile_apps",
  "social_networks", "final_cta", "custom_text",
]);
const UNIQUE_LANDING_SECTION_TYPES = new Set([
  "hero", "goal_selector", "omnia_journey", "featured_courses", "ecosystem",
  "credentials", "career_recruitment", "structures", "partners", "mobile_apps",
  "social_networks", "final_cta",
]);

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function cleanPublicUrl(value: unknown) {
  const url = cleanText(value, 1000);
  if (!url) return "";
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" || parsed.protocol === "mailto:" || parsed.protocol === "tel:") return url;
  } catch {
    // L'erreur normalisée ci-dessous est plus claire pour le CMS.
  }
  throw new Error("INVALID_PUBLIC_URL");
}

function cleanExternalUrl(value: unknown) {
  const url = cleanText(value, 1000);
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:") return url;
  } catch {
    // L'erreur normalisée ci-dessous est plus claire pour le CMS.
  }
  throw new Error("INVALID_EXTERNAL_URL");
}

function normalizeSocialNetworks(value: unknown) {
  const rows = Array.isArray(value) ? value : [];
  if (rows.length > 30) throw new Error("TOO_MANY_SOCIAL_NETWORKS");
  const ids = new Set<string>();
  return rows.map((raw, index) => {
    if (!raw || typeof raw !== "object") throw new Error("SOCIAL_NETWORK_INVALID");
    const item = raw as Record<string, unknown>;
    const id = cleanText(item.id, 120) || `social-${crypto.randomUUID()}`;
    if (ids.has(id)) throw new Error("SOCIAL_NETWORK_ID_DUPLICATE");
    ids.add(id);
    const enabled = item.enabled === true;
    const name = cleanText(item.name, 120);
    const url = cleanExternalUrl(item.url);
    const iconKey = cleanText(item.icon_key, 60) || "other";
    const logoUrl = cleanExternalUrl(item.logo_url);
    if (enabled && (!name || !url || (iconKey === "other" && !logoUrl))) throw new Error("SOCIAL_NETWORK_PUBLIC_REQUIREMENTS");
    return {
      id, name, url, enabled,
      display_order: Math.trunc(Number(item.display_order || index + 1)),
      show_homepage: item.show_homepage === true,
      show_footer: item.show_footer === true,
      icon_key: iconKey,
      logo_url: logoUrl,
      alt_text: cleanText(item.alt_text, 300),
    };
  });
}

function normalizeMobileApps(value: unknown) {
  const rows = Array.isArray(value) ? value : [];
  if (rows.length > 6) throw new Error("TOO_MANY_MOBILE_APPS");
  const ids = new Set<string>();
  return rows.map((raw, index) => {
    if (!raw || typeof raw !== "object") throw new Error("MOBILE_APP_INVALID");
    const item = raw as Record<string, unknown>;
    const id = cleanText(item.id, 120) || `mobile-app-${crypto.randomUUID()}`;
    if (ids.has(id)) throw new Error("MOBILE_APP_ID_DUPLICATE");
    ids.add(id);
    const store = item.store === "ios" ? "ios" : "android";
    const enabled = item.enabled === true;
    const url = cleanExternalUrl(item.url);
    if (enabled && !url) throw new Error("MOBILE_APP_URL_REQUIRED");
    return {
      id,
      store,
      name: cleanText(item.name, 120) || (store === "ios" ? "App Store" : "Google Play"),
      url,
      enabled,
      display_order: Math.trunc(Number(item.display_order || index + 1)),
      show_homepage: item.show_homepage === true,
      show_footer: item.show_footer === true,
    };
  });
}

function normalizeLandingLinks(value: unknown, maxItems = 40) {
  const rows = Array.isArray(value) ? value : [];
  if (rows.length > maxItems) throw new Error("TOO_MANY_LANDING_LINKS");
  const ids = new Set<string>();
  return rows.map((raw, index) => {
    if (!raw || typeof raw !== "object") throw new Error("LANDING_LINK_INVALID");
    const item = raw as Record<string, unknown>;
    const id = cleanText(item.id, 120) || `link-${crypto.randomUUID()}`;
    if (ids.has(id)) throw new Error("LANDING_LINK_ID_DUPLICATE");
    ids.add(id);
    return {
      id,
      label: cleanText(item.label, 160),
      href: cleanPublicUrl(item.href),
      description: cleanText(item.description, 500),
      enabled: item.enabled !== false,
      order: index + 1,
    };
  });
}

function normalizeLandingItems(value: unknown) {
  const rows = Array.isArray(value) ? value : [];
  if (rows.length > 40) throw new Error("TOO_MANY_LANDING_ITEMS");
  const ids = new Set<string>();
  return rows.map((raw, index) => {
    if (!raw || typeof raw !== "object") throw new Error("LANDING_ITEM_INVALID");
    const item = raw as Record<string, unknown>;
    const id = cleanText(item.id, 120) || `item-${crypto.randomUUID()}`;
    if (ids.has(id)) throw new Error("LANDING_ITEM_ID_DUPLICATE");
    ids.add(id);
    return {
      id,
      label: cleanText(item.label, 180),
      title: cleanText(item.title, 500),
      description: cleanText(item.description, 1500),
      action_label: cleanText(item.action_label, 160),
      action_url: cleanPublicUrl(item.action_url),
      icon_key: cleanText(item.icon_key, 80) || "other",
      group: cleanText(item.group, 80),
      enabled: item.enabled !== false,
      order: index + 1,
    };
  });
}

const AUDIENCE_PAGE_KEYS = ["apprenants", "professeurs", "structures", "recruteurs"] as const;

function normalizeAudiencePage(raw: unknown, key: typeof AUDIENCE_PAGE_KEYS[number]) {
  if (!raw || typeof raw !== "object") throw new Error("AUDIENCE_PAGE_INVALID");
  const page = raw as Record<string, unknown>;
  return {
    key,
    route: cleanPublicUrl(page.route),
    nav_label: cleanText(page.nav_label, 160),
    enabled: page.enabled !== false,
    hero_eyebrow: cleanText(page.hero_eyebrow, 220),
    hero_title: cleanText(page.hero_title, 700),
    hero_subtitle: cleanText(page.hero_subtitle, 1800),
    hero_body: cleanText(page.hero_body, 5000),
    primary_cta_label: cleanText(page.primary_cta_label, 160),
    primary_cta_url: cleanPublicUrl(page.primary_cta_url),
    secondary_cta_label: cleanText(page.secondary_cta_label, 160),
    secondary_cta_url: cleanPublicUrl(page.secondary_cta_url),
    highlight_label: cleanText(page.highlight_label, 220),
    highlight_title: cleanText(page.highlight_title, 700),
    highlight_body: cleanText(page.highlight_body, 5000),
    items_title: cleanText(page.items_title, 700),
    items_subtitle: cleanText(page.items_subtitle, 1800),
    items: normalizeLandingItems(page.items),
    segments_title: cleanText(page.segments_title, 700),
    segments_subtitle: cleanText(page.segments_subtitle, 1800),
    segments: normalizeLandingItems(page.segments),
    steps_title: cleanText(page.steps_title, 700),
    steps_subtitle: cleanText(page.steps_subtitle, 1800),
    steps: normalizeLandingItems(page.steps),
  };
}

function normalizeAudiencePages(value: unknown) {
  if (!value || typeof value !== "object") return {};
  const source = value as Record<string, unknown>;
  return Object.fromEntries(
    AUDIENCE_PAGE_KEYS
      .filter((key) => source[key] && typeof source[key] === "object")
      .map((key) => [key, normalizeAudiencePage(source[key], key)]),
  );
}

function normalizeLandingPage(value: unknown) {
  if (!value || typeof value !== "object") throw new Error("LANDING_PAGE_REQUIRED");
  const source = value as Record<string, unknown>;
  const rawSections = Array.isArray(source.sections) ? source.sections : [];
  if (rawSections.length === 0 || rawSections.length > 30) throw new Error("LANDING_SECTIONS_INVALID");
  const ids = new Set<string>();
  const uniqueTypes = new Set<string>();
  const sections = rawSections.map((raw, index) => {
    if (!raw || typeof raw !== "object") throw new Error("LANDING_SECTION_INVALID");
    const section = raw as Record<string, unknown>;
    const type = cleanText(section.type, 60);
    if (!LANDING_SECTION_TYPES.has(type)) throw new Error("LANDING_SECTION_TYPE_INVALID");
    if (UNIQUE_LANDING_SECTION_TYPES.has(type)) {
      if (uniqueTypes.has(type)) throw new Error("LANDING_SECTION_DUPLICATE");
      uniqueTypes.add(type);
    }
    const id = cleanText(section.id, 120) || `${type}-${crypto.randomUUID()}`;
    if (ids.has(id)) throw new Error("LANDING_SECTION_ID_DUPLICATE");
    ids.add(id);
    return {
      id, type,
      internal_name: cleanText(section.internal_name, 160),
      enabled: section.enabled !== false,
      order: index + 1,
      eyebrow: cleanText(section.eyebrow, 180),
      title: cleanText(section.title, 500),
      subtitle: cleanText(section.subtitle, 1200),
      body: cleanText(section.body, 5000),
      primary_cta_label: cleanText(section.primary_cta_label, 120),
      primary_cta_url: cleanPublicUrl(section.primary_cta_url),
      secondary_cta_label: cleanText(section.secondary_cta_label, 120),
      secondary_cta_url: cleanPublicUrl(section.secondary_cta_url),
      search_placeholder: cleanText(section.search_placeholder, 300),
      search_button_label: cleanText(section.search_button_label, 120),
      items: normalizeLandingItems(section.items),
    };
  });

  const navigation = source.navigation && typeof source.navigation === "object" ? source.navigation as Record<string, unknown> : {};
  const footer = source.footer && typeof source.footer === "object" ? source.footer as Record<string, unknown> : {};
  const rawColumns = Array.isArray(footer.columns) ? footer.columns : [];
  if (rawColumns.length > 8) throw new Error("TOO_MANY_FOOTER_COLUMNS");
  const columns = rawColumns.map((raw, index) => {
    if (!raw || typeof raw !== "object") throw new Error("FOOTER_COLUMN_INVALID");
    const column = raw as Record<string, unknown>;
    return {
      id: cleanText(column.id, 120) || `footer-column-${crypto.randomUUID()}`,
      title: cleanText(column.title, 160),
      order: index + 1,
      links: normalizeLandingLinks(column.links, 30),
    };
  });

  return {
    version: Math.max(2, Math.trunc(Number(source.version || 2))),
    updated_at: new Date().toISOString(),
    published_at: source.published_at ? cleanText(source.published_at, 80) : null,
    navigation: {
      explore_label: cleanText(navigation.explore_label, 120),
      professionals_label: cleanText(navigation.professionals_label, 120),
      login_label: cleanText(navigation.login_label, 120),
      register_label: cleanText(navigation.register_label, 120),
      direct_links: normalizeLandingLinks(navigation.direct_links),
      explore_links: normalizeLandingLinks(navigation.explore_links),
      professional_links: normalizeLandingLinks(navigation.professional_links),
    },
    footer: {
      description: cleanText(footer.description, 1000),
      follow_us_label: cleanText(footer.follow_us_label, 160),
      partner_label: cleanText(footer.partner_label, 160),
      columns,
    },
    sections,
    audience_pages: normalizeAudiencePages(source.audience_pages),
  };
}

async function uploadSiteAsset(
  sb: ReturnType<typeof createClient>,
  folder: string,
  fileName: string,
  mimeType: string,
  base64: string,
) {
  const allowed = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);
  if (!allowed.has(mimeType)) throw new Error("INVALID_IMAGE_TYPE");
  const bytes = Uint8Array.from(atob(base64), character => character.charCodeAt(0));
  if (bytes.byteLength > 2 * 1024 * 1024) throw new Error("FILE_TOO_LARGE");
  const bucket = "site-assets";
  const { data: existingBucket } = await sb.storage.getBucket(bucket);
  if (!existingBucket) {
    const { error: bucketError } = await sb.storage.createBucket(bucket, {
      public: true,
      fileSizeLimit: 2 * 1024 * 1024,
      allowedMimeTypes: Array.from(allowed),
    });
    if (bucketError && !String(bucketError.message || "").toLowerCase().includes("already")) throw bucketError;
  }
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-80) || "asset.png";
  const path = `${folder}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await sb.storage.from(bucket).upload(path, bytes, {
    contentType: mimeType,
    upsert: false,
  });
  if (uploadError) throw uploadError;
  return sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const token = (req.headers.get("x-omnia-session-token") ?? req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const adminId = await verifySuperAdmin(sb, token);
    if (!adminId) return json({ error: "FORBIDDEN" }, 403);

    if (req.method === "GET") {
      const [settingsResult, pricingResult, partnersResult, landingResult, multipliersResult] = await Promise.all([
        sb.from("site_settings").select("key,value"),
        sb.from("pricing_tiers").select("id,label,score_min,score_max,price_xof,is_base_tier,is_protected").order("score_min"),
        sb.from("public_partners").select("*").order("display_order").order("name"),
        sb.from("landing_page_cms_state")
          .select("draft,previous_published,published_at,published_by,updated_at,social_networks,mobile_apps")
          .eq("id", 1)
          .maybeSingle(),
        sb.from("category_multipliers").select("category_name,multiplier").order("category_name"),
      ]);

      const readFailure = [
        ["SITE_SETTINGS_READ_FAILED", settingsResult.error],
        ["PRICING_TIERS_READ_FAILED", pricingResult.error],
        ["PARTNERS_READ_FAILED", partnersResult.error],
        ["LANDING_CMS_READ_FAILED", landingResult.error],
        ["CATEGORY_MULTIPLIERS_READ_FAILED", multipliersResult.error],
      ].find(([, error]) => Boolean(error));

      if (readFailure) {
        const [code, error] = readFailure as [string, { message: string }];
        return json({ error: code, detail: error.message }, 500);
      }

      return json({
        settings: settingsResult.data ?? [],
        pricing_tiers: pricingResult.data ?? [],
        partners: partnersResult.data ?? [],
        landing_cms: landingResult.data ?? null,
        category_multipliers: multipliersResult.data ?? [],
      });
    }

    const body = await req.json() as {
      updates?: { key: string; value: unknown }[];
      action?: string;
      tier_id?: string;
      tier?: Record<string, unknown>;
      file_name?: string;
      mime_type?: string;
      base64?: string;
      favicon_url?: string;
      partner_id?: string;
      partner?: Record<string, unknown>;
      category_name?: string;
      multiplier?: number;
      multipliers?: Array<{ category_name: string; multiplier: number }>;
      landing_page?: unknown;
      social_networks?: unknown;
      mobile_apps?: unknown;
      language?: string;
      query?: string;
      status?: string;
      page?: number;
      page_size?: number;
      limit?: number;
      source_hash?: string;
      translation?: string;
    };

    if (body.action === "translation_overview") {
      const { data, error } = await sb.rpc("oga_i18n_overview");
      if (error) return json({ error: "TRANSLATION_OVERVIEW_FAILED", detail: error.message }, 500);
      return json({ success: true, overview: { ...(data || {}), ai_enabled: aiTranslationEnabled() } });
    }

    if (body.action === "translation_list") {
      const language = String(body.language || "").trim().toLowerCase();
      if (!UI_LANGUAGES.has(language)) return json({ error: "INVALID_LANGUAGE" }, 400);
      const page = Math.max(1, Math.trunc(Number(body.page || 1)));
      const pageSize = Math.min(100, Math.max(1, Math.trunc(Number(body.page_size || 25))));
      const status = ["all", "missing", "reviewed", "automatic"].includes(String(body.status)) ? String(body.status) : "all";
      const { data, error } = await sb.rpc("oga_i18n_list", {
        p_language: language,
        p_query: cleanText(body.query, 200),
        p_status: status,
        p_offset: (page - 1) * pageSize,
        p_limit: pageSize,
      });
      if (error) return json({ error: "TRANSLATION_LIST_FAILED", detail: error.message }, 500);
      return json({ success: true, rows: data?.rows || [], total: Number(data?.total || 0), page, page_size: pageSize });
    }

    if (body.action === "translation_save") {
      const language = String(body.language || "").trim().toLowerCase();
      const sourceHash = cleanText(body.source_hash, 80);
      const translation = cleanText(body.translation, 1000);
      if (!UI_LANGUAGES.has(language) || !sourceHash || !translation) return json({ error: "INVALID_TRANSLATION" }, 400);
      const { data, error } = await sb.rpc("oga_i18n_save", { p_source_hash: sourceHash, p_language: language, p_translation: translation });
      if (error) return json({ error: "TRANSLATION_SAVE_FAILED", detail: error.message }, 500);
      return json({ success: true, row: data });
    }

    if (body.action === "translation_generate_missing") {
      const language = String(body.language || "").trim().toLowerCase();
      const limit = Math.min(25, Math.max(1, Math.trunc(Number(body.limit || 25))));
      if (!UI_LANGUAGES.has(language)) return json({ error: "INVALID_LANGUAGE" }, 400);
      if (!aiTranslationEnabled()) return json({ error: "TRANSLATION_AI_NOT_CONFIGURED" }, 503);
      const { data: listData, error: listError } = await sb.rpc("oga_i18n_list", { p_language: language, p_query: "", p_status: "missing", p_offset: 0, p_limit: limit });
      if (listError) return json({ error: "TRANSLATION_LIST_FAILED", detail: listError.message }, 500);
      const rows = Array.isArray(listData?.rows) ? listData.rows : [];
      if (!rows.length) return json({ success: true, generated: 0, remaining: 0 });
      const values = await generateTranslationValues(language, rows.map((row: { source_text: string }) => String(row.source_text)));
      if (values.length !== rows.length) return json({ error: "TRANSLATION_AI_INVALID_RESPONSE" }, 502);
      let generated = 0;
      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index] as Record<string, unknown>;
        const translated = cleanText(values[index], 1000);
        if (!translated) continue;
        const { data: current, error: currentError } = await sb.from("platform_ui_translations").select("translations,machine_generated_languages").eq("source_hash", row.source_hash).single();
        if (currentError) throw currentError;
        const translations = current?.translations && typeof current.translations === "object" ? current.translations : {};
        const machineLanguages = Array.isArray(current?.machine_generated_languages) ? [...new Set([...current.machine_generated_languages.map(String), language])] : [language];
        const { error: updateError } = await sb.from("platform_ui_translations").update({ translations: { ...translations, [language]: translated }, machine_generated_languages: machineLanguages, updated_at: new Date().toISOString() }).eq("source_hash", row.source_hash);
        if (updateError) throw updateError;
        generated += 1;
      }
      const { data: remainingData } = await sb.rpc("oga_i18n_list", { p_language: language, p_query: "", p_status: "missing", p_offset: 0, p_limit: 1 });
      return json({ success: true, generated, remaining: Number(remainingData?.total || 0) });
    }

    // Favicon library management
    if (body.action === "upload_favicon") {
      if (!body.base64 || !body.file_name || !body.mime_type) return json({ error: "FAVICON_FILE_REQUIRED" }, 400);
      const allowedTypes = new Set(["image/png","image/x-icon","image/vnd.microsoft.icon","image/svg+xml","image/webp","image/jpeg"]);
      if (!allowedTypes.has(body.mime_type)) return json({ error: "FAVICON_TYPE_NOT_ALLOWED" }, 400);

      const binary = Uint8Array.from(atob(body.base64), c => c.charCodeAt(0));
      if (binary.byteLength > 1024 * 1024) return json({ error: "FAVICON_TOO_LARGE" }, 400);

      const bucketName = "site-assets";
      const { data: existingBucket } = await sb.storage.getBucket(bucketName);
      if (!existingBucket) {
        const { error: bucketError } = await sb.storage.createBucket(bucketName, {
          public: true,
          fileSizeLimit: 1024 * 1024,
          allowedMimeTypes: Array.from(allowedTypes),
        });
        if (bucketError && !String(bucketError.message || "").toLowerCase().includes("already")) throw bucketError;
      }

      const safeName = body.file_name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-80);
      const path = `favicons/${Date.now()}-${crypto.randomUUID()}-${safeName || "favicon.png"}`;
      const { error: uploadError } = await sb.storage.from(bucketName).upload(path, binary, {
        contentType: body.mime_type,
        upsert: false,
      });
      if (uploadError) throw uploadError;

      const { data: publicData } = sb.storage.from(bucketName).getPublicUrl(path);
      const faviconUrl = publicData.publicUrl;

      const { data: libraryRow } = await sb.from("site_settings").select("value").eq("key","favicon_library").maybeSingle();
      let library: Array<{url:string;name:string;created_at:string}> = [];
      if (Array.isArray(libraryRow?.value)) library = libraryRow.value as typeof library;
      else if (typeof libraryRow?.value === "string") {
        try { library = JSON.parse(libraryRow.value); } catch { library = []; }
      }
      library.push({ url: faviconUrl, name: body.file_name, created_at: new Date().toISOString() });

      const now = new Date().toISOString();
      await sb.from("site_settings").upsert([
        { key:"favicon_url", value:faviconUrl, updated_at:now },
        { key:"favicon_library", value:library, updated_at:now },
      ], { onConflict:"key" });

      return json({ success:true, favicon_url:faviconUrl, favicon_library:library });
    }

    if (body.action === "set_active_favicon") {
      if (!body.favicon_url) return json({ error:"FAVICON_URL_REQUIRED" },400);
      await sb.from("site_settings").upsert({
        key:"favicon_url", value:body.favicon_url, updated_at:new Date().toISOString(),
      }, { onConflict:"key" });
      return json({ success:true, favicon_url:body.favicon_url });
    }

    if (body.action === "delete_favicon") {
      if (!body.favicon_url) return json({ error:"FAVICON_URL_REQUIRED" },400);
      const { data: activeRow } = await sb.from("site_settings").select("value").eq("key","favicon_url").maybeSingle();
      if (activeRow?.value === body.favicon_url) {
        return json({ error:"FAVICON_ACTIVE_CANNOT_DELETE", message:"Activez un autre favicon avant de supprimer celui-ci." },409);
      }

      const { data: libraryRow } = await sb.from("site_settings").select("value").eq("key","favicon_library").maybeSingle();
      let library: Array<{url:string;name:string;created_at?:string}> = [];
      if (Array.isArray(libraryRow?.value)) library = libraryRow.value as typeof library;
      else if (typeof libraryRow?.value === "string") {
        try { library = JSON.parse(libraryRow.value); } catch { library = []; }
      }
      library = library.filter(item => item?.url !== body.favicon_url);

      try {
        const marker = "/storage/v1/object/public/site-assets/";
        const i = body.favicon_url.indexOf(marker);
        if (i >= 0) {
          const objectPath = decodeURIComponent(body.favicon_url.slice(i + marker.length));
          if (objectPath) await sb.storage.from("site-assets").remove([objectPath]);
        }
      } catch (e) { console.error("favicon cleanup", e); }

      await sb.from("site_settings").upsert({
        key:"favicon_library", value:library, updated_at:new Date().toISOString(),
      }, { onConflict:"key" });
      return json({ success:true, favicon_library:library });
    }

    if (body.action === "upload_social_logo") {
      if (!body.base64 || !body.file_name || !body.mime_type) return json({ error: "FILE_REQUIRED" }, 400);
      const logoUrl = await uploadSiteAsset(sb, "social-networks", body.file_name, body.mime_type, body.base64);
      return json({ success: true, logo_url: logoUrl });
    }

    if (body.action === "upload_partner_logo") {
      if (!body.base64 || !body.file_name || !body.mime_type) return json({ error: "FILE_REQUIRED" }, 400);
      const allowed = new Set(["image/png","image/jpeg","image/webp","image/svg+xml"]);
      if (!allowed.has(body.mime_type)) return json({ error: "INVALID_IMAGE_TYPE" }, 400);
      const bytes = Uint8Array.from(atob(body.base64), c => c.charCodeAt(0));
      if (bytes.byteLength > 2 * 1024 * 1024) return json({ error: "FILE_TOO_LARGE" }, 400);
      const bucket = "site-assets";
      const { data: b } = await sb.storage.getBucket(bucket);
      if (!b) await sb.storage.createBucket(bucket, { public: true, fileSizeLimit: 2 * 1024 * 1024 });
      const safe = body.file_name.replace(/[^a-zA-Z0-9._-]+/g,"-").slice(-80);
      const path = `partners/${Date.now()}-${crypto.randomUUID()}-${safe}`;
      const { error } = await sb.storage.from(bucket).upload(path, bytes, { contentType: body.mime_type, upsert: false });
      if (error) throw error;
      const { data: pub } = sb.storage.from(bucket).getPublicUrl(path);
      return json({ success: true, logo_url: pub.publicUrl });
    }

    if (body.action === "upsert_partner") {
      if (!body.partner) return json({ error: "PARTNER_REQUIRED" }, 400);
      const p = body.partner as any;
      const status = ["draft", "active", "archived"].includes(String(p.status)) ? String(p.status) : "draft";
      const payload = {
        name: cleanText(p.name, 240),
        category: cleanText(p.category || "Autre", 120),
        logo_url: cleanText(p.logo_url, 1000) || null,
        website_url: cleanPublicUrl(p.website_url) || null,
        description: cleanText(p.description, 2000) || null,
        display_order: Math.trunc(Number(p.display_order || 0)),
        is_active: status === "active" && p.is_active !== false,
        is_featured: Boolean(p.is_featured),
        status,
        logo_authorized: Boolean(p.logo_authorized),
        show_homepage: p.show_homepage !== false,
        show_footer: Boolean(p.show_footer),
        alt_text: cleanText(p.alt_text, 300) || null,
        updated_at: new Date().toISOString(),
      };
      if (!payload.name) return json({ error: "PARTNER_NAME_REQUIRED" }, 400);
      if (payload.status === "active" && (!payload.logo_url || !payload.logo_authorized)) {
        return json({ error: "PARTNER_PUBLIC_REQUIREMENTS", message: "Un partenaire actif doit avoir un logo autorisé." }, 400);
      }
      const query = p.id
        ? sb.from("public_partners").update(payload).eq("id", p.id)
        : sb.from("public_partners").insert(payload);
      const { error: partnerError } = await query;
      if (partnerError) return json({ error: "PARTNER_SAVE_FAILED", detail: partnerError.message }, 500);
      return json({ success: true });
    }

    if (body.action === "delete_partner") {
      if (!body.partner_id) return json({ error: "PARTNER_ID_REQUIRED" }, 400);
      const { error: deleteError } = await sb.from("public_partners").delete().eq("id", body.partner_id);
      if (deleteError) return json({ error: "PARTNER_DELETE_FAILED", detail: deleteError.message }, 500);
      return json({ success: true });
    }

    if (body.action === "save_public_channels") {
      const socialNetworks = normalizeSocialNetworks(body.social_networks);
      const mobileApps = normalizeMobileApps(body.mobile_apps);
      const { error: channelError } = await sb.from("landing_page_cms_state").upsert({
        id: 1,
        social_networks: socialNetworks,
        mobile_apps: mobileApps,
        updated_at: new Date().toISOString(),
        updated_by: adminId,
      }, { onConflict: "id" });
      if (channelError) return json({ error: "PUBLIC_CHANNELS_SAVE_FAILED", detail: channelError.message }, 500);
      return json({ success: true, social_networks: socialNetworks, mobile_apps: mobileApps });
    }

    if (body.action === "save_landing_draft") {
      const page = normalizeLandingPage(body.landing_page);
      const { data, error: rpcError } = await sb.rpc("oga_landing_save_draft", { p_page: page, p_admin_id: adminId });
      if (rpcError) return json({ error: "LANDING_DRAFT_SAVE_FAILED", detail: rpcError.message }, 500);
      return json({ success: true, ...(data || {}), landing_page: (data as any)?.landing_page || page });
    }

    if (body.action === "publish_landing_page") {
      const page = normalizeLandingPage(body.landing_page);
      const { data, error: rpcError } = await sb.rpc("oga_landing_publish", { p_page: page, p_admin_id: adminId });
      if (rpcError) return json({ error: "LANDING_PUBLISH_FAILED", detail: rpcError.message }, 500);
      return json({ success: true, ...(data || {}) });
    }

    if (body.action === "restore_landing_draft") {
      const { data, error: rpcError } = await sb.rpc("oga_landing_restore_draft", { p_admin_id: adminId });
      if (rpcError) {
        const status = rpcError.message.includes("NO_PUBLISHED") ? 404 : 500;
        return json({ error: "LANDING_DRAFT_RESTORE_FAILED", detail: rpcError.message }, status);
      }
      return json({ success: true, ...(data || {}) });
    }

    if (body.action === "rollback_landing_publication") {
      const { data, error: rpcError } = await sb.rpc("oga_landing_rollback", { p_admin_id: adminId });
      if (rpcError) {
        const status = rpcError.message.includes("NO_PREVIOUS") ? 404 : 500;
        return json({ error: "LANDING_ROLLBACK_FAILED", detail: rpcError.message }, status);
      }
      return json({ success: true, ...(data || {}) });
    }

    if (body.action === "save_category_multipliers") {
      if (!Array.isArray(body.multipliers) || body.multipliers.length !== 22) {
        return json({ error: "EXACTLY_22_MULTIPLIERS_REQUIRED" }, 400);
      }

      for (const item of body.multipliers) {
        const categoryName = String(item.category_name || "").trim();
        const mult = Number(item.multiplier);
        if (!categoryName || !Number.isFinite(mult) || mult < 0.5 || mult > 2) {
          return json({ error: "INVALID_MULTIPLIER", category_name: categoryName }, 400);
        }
      }

      for (const item of body.multipliers) {
        const categoryName = String(item.category_name).trim();
        const mult = Number(item.multiplier);
        const { data: old } = await sb.from("category_multipliers")
          .select("multiplier").eq("category_name", categoryName).maybeSingle();

        const { error: upsertError } = await sb.from("category_multipliers").upsert({
          category_name: categoryName,
          multiplier: mult,
          updated_at: new Date().toISOString(),
        }, { onConflict: "category_name" });
        if (upsertError) return json({ error: "CATEGORY_MULTIPLIER_SAVE_FAILED", category_name: categoryName, detail: upsertError.message }, 500);

        if (Number(old?.multiplier) !== mult) {
          try {
            await sb.from("multiplier_audit_log").insert({
              category_name: categoryName,
              old_value: old?.multiplier ?? null,
              new_value: mult,
              changed_by: adminId,
            });
          } catch {}
        }
      }

      return json({ success: true, count: body.multipliers.length });
    }

    if (body.action === "update_category_multiplier") {
      if (!body.category_name || body.multiplier == null) return json({ error: "INVALID_PARAMS" }, 400);
      const mult = Number(body.multiplier);
      if (mult < 0.5 || mult > 2) return json({ error: "MULTIPLIER_OUT_OF_RANGE" }, 400);
      const { data: old } = await sb.from("category_multipliers").select("multiplier").eq("category_name", body.category_name).maybeSingle();
      await sb.from("category_multipliers").upsert({ category_name: body.category_name, multiplier: mult, updated_at: new Date().toISOString() }, { onConflict: "category_name" });
      try { await sb.from("multiplier_audit_log").insert({ category_name: body.category_name, old_value: old?.multiplier ?? null, new_value: mult, changed_by: adminId }); } catch {}
      return json({ success: true });
    }

    // Pricing tier management
    if (body.action === "delete_pricing_tier") {
      if (!body.tier_id) return json({ error: "tier_id requis" }, 400);
      const { data: palier } = await sb.from("pricing_tiers").select("is_protected,label").eq("id", body.tier_id).maybeSingle();
      if (!palier) return json({ error: "TIER_NOT_FOUND" }, 404);
      const p = palier as { is_protected: boolean; label: string };
      if (p.is_protected) return json({ error: "PALIER_PROTECTED", message: `Le palier "${p.label}" est protégé et ne peut pas être supprimé.` }, 403);
      await sb.from("pricing_tiers").delete().eq("id", body.tier_id);
      return json({ success: true });
    }

    if (body.action === "upsert_pricing_tier") {
      if (!body.tier) return json({ error: "tier requis" }, 400);
      const t = body.tier as { id?: string; label: string; score_min: number; score_max: number; price_xof: number };
      if (t.id) {
        await sb.from("pricing_tiers").update({ label: t.label, score_min: t.score_min, score_max: t.score_max, price_xof: t.price_xof }).eq("id", t.id);
      } else {
        await sb.from("pricing_tiers").insert({ label: t.label, score_min: t.score_min, score_max: t.score_max, price_xof: t.price_xof, created_by: adminId });
      }
      return json({ success: true });
    }

    const { updates } = body;
    if (!Array.isArray(updates)) return json({ error: "INVALID_PARAMS" }, 400);

    // Vérifier uniquement les clés interdites (secrets)
    const forbidden = updates.filter((u) => FORBIDDEN_KEYS.has(u.key.toLowerCase()));
    if (forbidden.length > 0) {
      return json({ error: "FORBIDDEN_KEY", keys: forbidden.map((u) => u.key) }, 400);
    }
    const governed = updates.filter((u) => GOVERNED_KEYS.has(u.key));
    if (governed.length > 0) {
      return json({ error: "GOVERNED_KEY_REQUIRES_ACTION", keys: governed.map((u) => u.key) }, 400);
    }

    const now = new Date().toISOString();
    let updated = 0;
    for (const { key, value } of updates) {
      await sb.from("site_settings").upsert({ key, value, updated_at: now }, { onConflict: "key" });
      updated++;
    }

    return json({ success: true, updated });
  } catch (err) {
    console.error(err);
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
