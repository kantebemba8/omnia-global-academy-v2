import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

import { getActiveOmniaSessionResult } from "../_shared/omnia-auth.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-omnia-session-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function requireAdmin(sb: any, req: Request): Promise<string | null> {
  const token = (
    req.headers.get("x-omnia-session-token") ||
    req.headers.get("Authorization") ||
    ""
  )
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) return null;

  const { data: session } = await getActiveOmniaSessionResult(sb, token);
  if (!session) return null;

  const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", session.user_id);
  return (roles || []).some((row: any) => ["super_admin", "admin"].includes(row.role)) ? session.user_id : null;
}

async function uploadImage(sb: any, dataUrl: string, filename: string, mime: string) {
  if (!dataUrl) throw new Error("IMAGE_REQUIRED");
  const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `thumbnails/${crypto.randomUUID()}-${safeName}`;
  const { error } = await sb.storage.from("career-templates").upload(path, bytes, {
    contentType: mime || "image/png",
    upsert: false,
  });
  if (error) throw error;
  return sb.storage.from("career-templates").getPublicUrl(path).data.publicUrl;
}

const OFFICIAL_TEMPLATE_KEYS = new Set([
  "cv_horizon",
  "cv_sahara",
  "cv_atlas",
  "cv_kora",
  "cv_nile",
  "cv_executive",
  "cv_baobab",
  "cv_digital",
  "cv_academia",
  "cv_hospitality",
  "cv_qhse",
  "cv_impact",
  "lm_horizon",
  "lm_sahara",
  "lm_atlas",
  "lm_kora",
  "lm_digital",
  "lm_executive",
]);

const LEGACY_TEMPLATE_KEYS = new Set([
  "academic",
  "academic_cv",
  "academic_lm",
  "africa_gold",
  "business_manager",
  "classic",
  "classic_lm",
  "classic_pro",
  "corporate_blue",
  "creative",
  "creative_digital",
  "creative_lm",
  "cyber_security",
  "cyber_security_cv",
  "data_analyst",
  "data_analyst_cv",
  "dynamic_lm",
  "executive_one_page",
  "freelancer",
  "freelancer_portfolio",
  "hospitality",
  "hospitality_premium",
  "international_cv",
  "internship_ready",
  "lm_academic",
  "lm_administration",
  "lm_africa_gold",
  "lm_alternance",
  "lm_business_manager",
  "lm_classic_pro",
  "lm_corporate_blue",
  "lm_courte_premium",
  "lm_creative_digital",
  "lm_cyber_security",
  "lm_data_analyst",
  "lm_finance_banque",
  "lm_freelancer",
  "lm_hospitality",
  "lm_hotellerie",
  "lm_international",
  "lm_internationale",
  "lm_internship_ready",
  "lm_minimal_luxe",
  "lm_modern_student",
  "lm_no_photo_ats",
  "lm_photo_elegant",
  "lm_premier_emploi",
  "lm_pro_classique",
  "lm_qhse",
  "lm_qhse_rse",
  "lm_spontanee",
  "lm_stage_simple",
  "lm_tech_data",
  "lm_tech_future",
  "lm_young_graduate",
  "minimal_luxe",
  "modern",
  "modern_lm",
  "modern_student",
  "no_photo_ats",
  "photo_elegant",
  "professional",
  "professional_lm",
  "qhse",
  "qhse_professional",
  "simple",
  "simple_lm",
  "student",
  "tech_future",
  "young_graduate",
]);

function sanitizeKey(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function normalizeOrder(sb: any, templateType: string) {
  const { error } = await sb.rpc("career_normalize_template_order", {
    p_template_type: templateType,
  });
  if (error) throw error;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return json({ error: "SERVER_CONFIG_ERROR" }, 500);

    const sb = createClient(supabaseUrl, serviceKey);
    const adminId = await requireAdmin(sb, req);
    if (!adminId) return json({ error: "FORBIDDEN" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "list");

    if (action === "list") {
      const { data, error } = await sb
        .from("career_templates")
        .select("*")
        .in("catalog_status", ["official", "custom"])
        .order("template_type")
        .order("display_order")
        .order("template_key");
      if (error) throw error;
      return json({ templates: data || [] });
    }

    if (action === "upload_thumbnail") {
      const url = await uploadImage(
        sb,
        String(body.data_url || ""),
        String(body.filename || "template.png"),
        String(body.mime || "image/png"),
      );
      return json({ success: true, url });
    }

    if (action === "delete") {
      const key = sanitizeKey(body.template_key);
      if (!key) return json({ error: "TEMPLATE_KEY_REQUIRED" }, 400);

      const { data: existing, error: existingError } = await sb
        .from("career_templates")
        .select("template_key,template_type,is_custom,catalog_status")
        .eq("template_key", key)
        .maybeSingle();
      if (existingError) throw existingError;
      if (!existing) return json({ error: "TEMPLATE_NOT_FOUND" }, 404);
      if (existing.catalog_status !== "custom" || existing.is_custom !== true) {
        return json({
          error: "OFFICIAL_TEMPLATE_PROTECTED",
          message: "Un modèle officiel ou retiré ne peut pas être supprimé depuis le gestionnaire personnalisé.",
        }, 409);
      }

      const { error } = await sb
        .from("career_templates")
        .delete()
        .eq("template_key", key)
        .eq("catalog_status", "custom")
        .eq("is_custom", true);
      if (error) throw error;
      await normalizeOrder(sb, String(existing.template_type));
      return json({ success: true });
    }

    if (action !== "upsert") return json({ error: "UNKNOWN_ACTION" }, 400);

    const template = body.template || {};
    const key = sanitizeKey(template.template_key);
    const templateType = String(template.template_type || "");
    if (!key || !["cv", "lm"].includes(templateType)) {
      return json({ error: "INVALID_TEMPLATE" }, 400);
    }
    if (OFFICIAL_TEMPLATE_KEYS.has(key) || LEGACY_TEMPLATE_KEYS.has(key)) {
      return json({
        error: "TEMPLATE_KEY_RESERVED",
        message: "Cette clé appartient au catalogue officiel ou à un ancien modèle retiré.",
      }, 409);
    }

    const layout = template.layout_config || {};
    if (!layout.variant || !layout.primary || !layout.accent) {
      return json({
        error: "LAYOUT_REQUIRED",
        message: "Choisissez une mise en page et ses couleurs avant de publier le modèle.",
      }, 400);
    }

    const { data: existing, error: existingError } = await sb
      .from("career_templates")
      .select("*")
      .eq("template_key", key)
      .maybeSingle();
    if (existingError) throw existingError;

    if (existing && (existing.catalog_status !== "custom" || existing.is_custom !== true)) {
      return json({
        error: "TEMPLATE_KEY_RESERVED",
        message: "Cette clé appartient déjà au catalogue officiel ou à un ancien alias protégé.",
      }, 409);
    }
    if (existing && String(existing.template_type) !== templateType) {
      return json({
        error: "TEMPLATE_TYPE_IMMUTABLE",
        message: "Le type d'un modèle personnalisé existant ne peut pas être modifié.",
      }, 409);
    }

    const payload = {
      template_key: key,
      template_type: templateType,
      name_fr: String(template.name_fr || existing?.name_fr || key).trim(),
      description_fr: String(template.description_fr ?? existing?.description_fr ?? "").trim(),
      category: String(template.category || existing?.category || "custom"),
      // Tout nouveau modèle est disponible gratuitement. L’Administration Omnia peut ensuite
      // le réserver en Premium depuis le tableau de gestion du catalogue.
      is_free: existing
        ? (typeof template.is_free === "boolean" ? template.is_free : existing.is_free !== false)
        : true,
      is_active: typeof template.is_active === "boolean" ? template.is_active : existing?.is_active !== false,
      is_ats_compatible: typeof template.is_ats_compatible === "boolean"
        ? template.is_ats_compatible
        : Boolean(existing?.is_ats_compatible),
      display_order: Math.max(1, Number(template.display_order || existing?.display_order || 999)),
      thumbnail_url: template.thumbnail_url ?? existing?.thumbnail_url ?? null,
      layout_config: layout,
      default_colors: template.default_colors && typeof template.default_colors === "object"
        ? template.default_colors
        : (existing?.default_colors || {}),
      is_custom: true,
      catalog_status: "custom",
      canonical_template_key: key,
      created_by: existing?.created_by || adminId,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await sb
      .from("career_templates")
      .upsert(payload, { onConflict: "template_key" })
      .select("*")
      .single();
    if (error) throw error;

    await normalizeOrder(sb, templateType);

    const { data: normalized, error: normalizedError } = await sb
      .from("career_templates")
      .select("*")
      .eq("template_key", key)
      .single();
    if (normalizedError) throw normalizedError;

    return json({ template: normalized || data });
  } catch (error) {
    console.error("career-template-manager error:", error);
    return json({
      error: "SERVER_ERROR",
      message: error instanceof Error ? error.message : "Erreur inconnue",
    }, 500);
  }
});
