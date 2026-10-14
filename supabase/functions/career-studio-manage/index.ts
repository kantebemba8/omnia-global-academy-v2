import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

import { getActiveOmniaSessionResult } from "../_shared/omnia-auth.ts";
import { runAiText, parseAiObject, normalizeAiPlainText, aiErrorPayload } from "../_shared/ai-runtime.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-omnia-session-token",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function tokenFrom(req: Request) {
  return (req.headers.get("x-omnia-session-token") || req.headers.get("Authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

async function verifySession(sb: ReturnType<typeof createClient>, token: string) {
  const { data: session, error } = await getActiveOmniaSessionResult(sb, token);
  if (error || !session) return null;
  const { data: user, error: userError } = await sb.from("users")
    .select("id,full_name,email,cv_tokens,career_studio_enabled,profile_completion")
    .eq("id", session.user_id)
    .maybeSingle();
  if (userError || !user) return null;
  return user as Record<string, any>;
}

async function contentHash(content: unknown) {
  const input = new TextEncoder().encode(JSON.stringify(content ?? {}));
  const digest = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

async function loadKeyValueConfig(
  sb: ReturnType<typeof createClient>,
  table: string,
  activeOnly = false,
) {
  let query = sb.from(table).select("config_key,config_value");
  if (activeOnly) query = query.eq("is_active", true);
  const { data } = await query;
  const result: Record<string, any> = {};
  for (const row of data || []) result[String(row.config_key)] = row.config_value;
  return result;
}

const LEGACY_TEMPLATE_ALIASES: Record<string, string> = {
  classic_pro: "cv_horizon",
  modern_student: "cv_nile",
  corporate_blue: "cv_horizon",
  minimal_luxe: "cv_impact",
  africa_gold: "cv_sahara",
  tech_future: "cv_digital",
  cyber_security: "cv_digital",
  data_analyst: "cv_digital",
  creative_digital: "cv_baobab",
  no_photo_ats: "cv_atlas",
  photo_elegant: "cv_horizon",
  young_graduate: "cv_nile",
  internship_ready: "cv_nile",
  international_cv: "cv_atlas",
  qhse_professional: "cv_qhse",
  business_manager: "cv_executive",
  hospitality: "cv_hospitality",
  hospitality_premium: "cv_hospitality",
  academic_cv: "cv_academia",
  academic: "cv_academia",
  freelancer: "cv_kora",
  freelancer_portfolio: "cv_kora",
  executive_one_page: "cv_executive",
  cyber_security_cv: "cv_digital",
  data_analyst_cv: "cv_digital",
  modern: "cv_horizon",
  professional: "cv_horizon",
  classic: "cv_horizon",
  creative: "cv_baobab",
  simple: "cv_atlas",
  student: "cv_nile",
  qhse: "cv_qhse",
  lm_classic_pro: "lm_horizon",
  lm_modern_student: "lm_atlas",
  lm_corporate_blue: "lm_horizon",
  lm_minimal_luxe: "lm_atlas",
  lm_africa_gold: "lm_sahara",
  lm_tech_future: "lm_digital",
  lm_cyber_security: "lm_digital",
  lm_data_analyst: "lm_digital",
  lm_creative_digital: "lm_kora",
  lm_no_photo_ats: "lm_atlas",
  lm_photo_elegant: "lm_horizon",
  lm_young_graduate: "lm_atlas",
  lm_internship_ready: "lm_atlas",
  lm_international: "lm_horizon",
  lm_qhse: "lm_horizon",
  lm_business_manager: "lm_executive",
  lm_hospitality: "lm_sahara",
  lm_academic: "lm_atlas",
  lm_freelancer: "lm_kora",
  lm_stage_simple: "lm_atlas",
  lm_premier_emploi: "lm_atlas",
  lm_alternance: "lm_atlas",
  lm_spontanee: "lm_horizon",
  lm_qhse_rse: "lm_horizon",
  lm_tech_data: "lm_digital",
  lm_hotellerie: "lm_sahara",
  lm_administration: "lm_horizon",
  lm_finance_banque: "lm_executive",
  lm_internationale: "lm_horizon",
  lm_courte_premium: "lm_executive",
  lm_pro_classique: "lm_horizon",
  classic_lm: "lm_horizon",
  dynamic_lm: "lm_kora",
  academic_lm: "lm_atlas",
  modern_lm: "lm_horizon",
  professional_lm: "lm_horizon",
  creative_lm: "lm_kora",
  simple_lm: "lm_atlas",
};

function defaultTemplateKey(docType: string) {
  return docType === "lm" ? "lm_horizon" : "cv_horizon";
}

function canonicalTemplateKey(docType: string, requestedKey: unknown) {
  const raw = String(requestedKey || defaultTemplateKey(docType)).trim().toLowerCase();
  // Une clé inconnue peut être celle d'un modèle personnalisé. La requête
  // suivante vérifie son template_type réel dans career_templates.
  return LEGACY_TEMPLATE_ALIASES[raw] || raw;
}

async function resolveTemplateKey(
  sb: ReturnType<typeof createClient>,
  docType: string,
  requestedKey: unknown,
) {
  if (!["cv", "lm"].includes(docType)) throw new Error("INVALID_DOCUMENT_TYPE");
  const canonicalKey = canonicalTemplateKey(docType, requestedKey);

  const { data: template, error } = await sb
    .from("career_templates")
    .select("template_key,template_type,is_active,catalog_status,is_custom")
    .eq("template_key", canonicalKey)
    .maybeSingle();
  if (error) throw error;
  if (!template) throw new Error("TEMPLATE_NOT_FOUND");
  if (String(template.template_type) !== docType) throw new Error("TEMPLATE_TYPE_MISMATCH");
  if (template.is_active !== true) throw new Error("TEMPLATE_INACTIVE");
  if (!["official", "custom"].includes(String(template.catalog_status || ""))) {
    throw new Error("TEMPLATE_NOT_IN_ACTIVE_CATALOG");
  }
  return String(template.template_key);
}

async function canonicalizeDocumentTemplate(
  sb: ReturnType<typeof createClient>,
  document: Record<string, any>,
) {
  try {
    const templateKey = await resolveTemplateKey(
      sb,
      String(document.doc_type || "cv"),
      document.template_key,
    );
    return { ...document, template_key: templateKey };
  } catch {
    return {
      ...document,
      template_key: defaultTemplateKey(String(document.doc_type || "cv")),
    };
  }
}

async function listAction(req: Request, sb: ReturnType<typeof createClient>) {
  if (req.method === "GET") {
    const url = new URL(req.url);
    const type = String(url.searchParams.get("type") || "cv");
    const category = url.searchParams.get("category");
    if (!["cv", "lm"].includes(type)) return json({ error: "INVALID_DOCUMENT_TYPE" }, 400);

    let query = sb.from("career_templates")
      .select("*")
      .eq("template_type", type)
      .eq("is_active", true)
      .in("catalog_status", ["official", "custom"])
      .order("display_order")
      .order("template_key");
    if (category) query = query.eq("category", category);
    const { data, error } = await query;
    if (error) throw error;
    return json({ templates: data || [], packs: [] });
  }

  const token = tokenFrom(req);
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);
  const user = await verifySession(sb, token);
  if (!user) return json({ error: "SESSION_INVALID" }, 401);

  const body = await req.json().catch(() => ({}));
  const docType = String(body.doc_type || "cv");
  if (!["cv", "lm"].includes(docType)) return json({ error: "INVALID_DOCUMENT_TYPE" }, 400);

  const [documentsResult, templatesResult, tokenConfig, aiConfig, formationsResult, certificatesResult, partnerResult] = await Promise.all([
    sb.from("career_documents")
      .select("id,title,doc_type,template_key,language,status,ats_score,target_job,target_country,application_type,created_at,updated_at")
      .eq("user_id", user.id)
      .eq("doc_type", docType)
      .order("updated_at", { ascending: false }),
    sb.from("career_templates")
      .select("*")
      .eq("template_type", docType)
      .eq("is_active", true)
      .in("catalog_status", ["official", "custom"])
      .order("display_order")
      .order("template_key"),
    loadKeyValueConfig(sb, "career_token_config", true),
    loadKeyValueConfig(sb, "career_ai_config"),
    sb.from("enrollments")
      .select("course_id,completed_at,courses(title,category)")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .not("completed_at", "is", null),
    sb.from("certificates")
      .select("id,course_id,omnia_certificate_id,issued_at,courses(title)")
      .eq("user_id", user.id),
    sb.from("partner_code_users")
      .select("*,partner_codes(code,advantages),partner_organizations(org_name)")
      .eq("user_id", user.id)
      .in("status", ["validated", "approved"])
      .limit(1)
      .maybeSingle(),
  ]);

  if (documentsResult.error) throw documentsResult.error;
  if (templatesResult.error) throw templatesResult.error;

  const documents = await Promise.all(
    (documentsResult.data || []).map((document: any) => canonicalizeDocumentTemplate(sb, document)),
  );

  return json({
    success: true,
    user: {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      cv_tokens: Number(user.cv_tokens || 0),
      career_studio_enabled: user.career_studio_enabled ?? true,
      profile_completion: Number(user.profile_completion || 0),
    },
    documents,
    templates: templatesResult.data || [],
    packs: [],
    token_config: tokenConfig,
    ai_config: aiConfig,
    completed_formations: formationsResult.data || [],
    certificates: certificatesResult.data || [],
    partner_link: partnerResult.data || null,
  });
}

async function saveAction(req: Request, sb: ReturnType<typeof createClient>) {
  const token = tokenFrom(req);
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);
  const user = await verifySession(sb, token);
  if (!user) return json({ error: "SESSION_INVALID" }, 401);

  const body = await req.json().catch(() => ({}));
  const operation = String(body.action || "save");
  const documentId = body.document_id ? String(body.document_id) : "";

  // Cette branche doit précéder toute mutation. L'ancienne fonction traitait `get`
  // comme une sauvegarde et pouvait écraser le document avec des valeurs vides.
  if (operation === "get") {
    if (!documentId) return json({ error: "DOCUMENT_ID_REQUIRED" }, 400);
    const { data: document, error } = await sb.from("career_documents")
      .select("*")
      .eq("id", documentId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!document) return json({ error: "DOCUMENT_NOT_FOUND" }, 404);
    return json({ success: true, action: "get", document: await canonicalizeDocumentTemplate(sb, document) });
  }

  if (operation === "delete") {
    if (!documentId) return json({ error: "DOCUMENT_ID_REQUIRED" }, 400);
    const { data, error } = await sb.from("career_documents")
      .delete()
      .eq("id", documentId)
      .eq("user_id", user.id)
      .select("id");
    if (error) throw error;
    if (!data || data.length !== 1) {
      return json({ error: "DOCUMENT_NOT_FOUND", message: "Document introuvable ou déjà supprimé." }, 404);
    }
    return json({ success: true, action: "deleted", document_id: documentId });
  }

  if (operation === "duplicate") {
    if (!documentId) return json({ error: "DOCUMENT_ID_REQUIRED" }, 400);
    const { data: original, error: originalError } = await sb.from("career_documents")
      .select("*")
      .eq("id", documentId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (originalError) throw originalError;
    if (!original) return json({ error: "DOCUMENT_NOT_FOUND" }, 404);

    let templateKey: string;
    try {
      templateKey = await resolveTemplateKey(sb, String(original.doc_type), original.template_key);
    } catch (error) {
      return json({
        error: "TEMPLATE_UNAVAILABLE",
        message: error instanceof Error ? error.message : "Le modèle du document n'est plus disponible.",
      }, 409);
    }

    const { data, error } = await sb.from("career_documents").insert({
      user_id: user.id,
      doc_type: original.doc_type,
      title: `${original.title} (copie)`,
      template_key: templateKey,
      language: original.language,
      doc_data: original.doc_data,
      design_options: original.design_options,
      target_job: original.target_job,
      target_country: original.target_country,
      application_type: original.application_type,
      content_hash: original.content_hash,
      status: "draft",
    }).select("*").single();
    if (error) throw error;
    return json({ success: true, action: "duplicated", document: data });
  }

  if (operation === "rename") {
    if (!documentId || !String(body.title || "").trim()) return json({ error: "MISSING_PARAMS" }, 400);
    const { data, error } = await sb.from("career_documents")
      .update({ title: String(body.title).trim(), updated_at: new Date().toISOString() })
      .eq("id", documentId)
      .eq("user_id", user.id)
      .select("*")
      .single();
    if (error) throw error;
    return json({ success: true, action: "renamed", document: data });
  }

  const docType = String(body.doc_type || "cv");
  if (!["cv", "lm"].includes(docType)) return json({ error: "INVALID_DOCUMENT_TYPE" }, 400);

  let templateKey: string;
  try {
    templateKey = await resolveTemplateKey(sb, docType, body.template_key);
  } catch (error) {
    return json({
      error: "TEMPLATE_UNAVAILABLE",
      message: error instanceof Error ? error.message : "Le modèle sélectionné n'est pas disponible.",
    }, 409);
  }

  const title = String(body.title || "Mon document").trim() || "Mon document";
  const docData = body.doc_data && typeof body.doc_data === "object" ? body.doc_data : {};
  const designOptions = body.design_options && typeof body.design_options === "object" ? body.design_options : {};
  const hash = await contentHash(docData);
  const patch = {
    doc_type: docType,
    title,
    template_key: templateKey,
    language: body.language || "fr",
    doc_data: docData,
    design_options: designOptions,
    target_job: body.target_job || null,
    target_country: body.target_country || null,
    application_type: body.application_type || null,
    content_hash: hash,
    status: "draft",
    updated_at: new Date().toISOString(),
  };

  if (documentId) {
    const { data, error } = await sb.from("career_documents")
      .update(patch)
      .eq("id", documentId)
      .eq("user_id", user.id)
      .select("*")
      .single();
    if (error) throw error;
    return json({ success: true, action: "updated", document: data });
  }

  const { count, error: countError } = await sb.from("career_documents")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("doc_type", docType);
  if (countError) throw countError;
  if (Number(count || 0) >= 20) {
    return json({ error: "MAX_DOCUMENTS_REACHED", message: "Vous avez atteint la limite de 20 documents." }, 400);
  }

  const { data, error } = await sb.from("career_documents")
    .insert({ user_id: user.id, ...patch })
    .select("*")
    .single();
  if (error) throw error;
  return json({ success: true, action: "created", document: data });
}

const SYSTEM_PROMPT = `Tu es un expert en ressources humaines et rédaction professionnelle, spécialisé dans le marché africain et international.
Tu aides les utilisateurs d'Omnia Global Academy à créer des CV et lettres de motivation professionnels.
Tu réponds en français sauf demande contraire.
Tu ne dois jamais inventer des diplômes, expériences ou compétences non fournis par l'utilisateur.
Tu améliores et reformules uniquement les informations reçues.`;


const INTERVIEW_SYSTEM_PROMPT = `Tu es l'Assistant IA de préparation aux entretiens d'Omnia Global Academy.
Tu aides un candidat à améliorer une réponse d'entretien de manière pédagogique, exigeante et bienveillante.
Tu n'inventes jamais une expérience, un diplôme, une compétence, un résultat ou une information absente des données fournies.
Tu utilises le contexte de l'offre uniquement lorsqu'il est fourni.
Pour une réponse individuelle, analyse la pertinence, la précision, la méthode STAR et l'adéquation au poste.
Pour un bilan global, synthétise uniquement les réponses réellement fournies.
Réponds exclusivement avec un objet JSON valide, sans bloc markdown ni texte autour.`;

function parseAiJsonObject(text: string): Record<string, unknown> | null {
  const cleaned = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

async function callClaude(sb: ReturnType<typeof createClient>, userId: string, action: string, system: string, prompt: string) {
  return await runAiText(sb, {
    context: { module: "career", action, userId },
    tier: "quality",
    system,
    prompt,
    maxTokens: action === "interview_feedback" ? 7000 : 5000,
    effort: action === "interview_feedback" ? "medium" : "low",
  });
}

async function centralCareerCredits(sb: ReturnType<typeof createClient>, userId: string, quantity: number, consume = false) {
  const { data: definition } = await sb.from("commerce_benefit_definitions").select("id").eq("benefit_key", "career_ai_credits").eq("is_active", true).maybeSingle();
  if (!definition) return { available: 0, consumed: false };
  const now = new Date().toISOString();
  const { data: rights } = await sb.from("commerce_entitlements").select("*").eq("user_id", userId).eq("benefit_definition_id", definition.id).eq("status", "active").lte("valid_from", now).or(`valid_until.is.null,valid_until.gte.${now}`).order("valid_until", { ascending: true, nullsFirst: false });
  const right = (rights || []).find((row: any) => row.remaining_quantity === null || Number(row.remaining_quantity) >= quantity);
  if (!right) return { available: 0, consumed: false };
  if (consume && right.remaining_quantity !== null) {
    const remaining = Number(right.remaining_quantity) - quantity;
    await sb.from("commerce_entitlements").update({ remaining_quantity: remaining, status: remaining <= 0 ? "exhausted" : "active" }).eq("id", right.id);
    await sb.from("commerce_usage_ledger").insert({ entitlement_id: right.id, user_id: userId, quantity, module_key: "career", action_key: "career_ai_credits", reference_type: "career_ai" });
    return { available: remaining, consumed: true };
  }
  return { available: right.remaining_quantity === null ? Number.MAX_SAFE_INTEGER : Number(right.remaining_quantity), consumed: false };
}

async function aiAction(req: Request, sb: ReturnType<typeof createClient>) {
  const token = tokenFrom(req);
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);
  const user = await verifySession(sb, token);
  if (!user) return json({ error: "SESSION_INVALID" }, 401);

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");
  const text = String(body.text || "");
  const supportedLanguages: Record<string,string> = { fr:"français", en:"English", es:"español", pt:"português", ar:"العربية", zh:"简体中文", ru:"русский", de:"Deutsch", bm:"bamanankan" };

  const [aiConfig, tokenConfig] = await Promise.all([
    loadKeyValueConfig(sb, "career_ai_config"),
    loadKeyValueConfig(sb, "career_token_config", true),
  ]);

  const requestedLanguage = String(body.language || body.document_language || body.preferred_language || aiConfig.default_language || "fr").trim().toLowerCase();
  const language = supportedLanguages[requestedLanguage] ? requestedLanguage : "fr";
  const tone = String(aiConfig.default_tone || "professionnel").trim() || "professionnel";
  const languageInstruction = `Réponds intégralement en ${supportedLanguages[language] || "français"}. Ne change pas de langue sauf demande explicite. Adopte un ton ${tone}.`;

  const featureKeys: Record<string, string[]> = {
    improve_summary: ["cv_ai_enabled"],
    rewrite_experience: ["cv_ai_enabled"],
    improve_project: ["cv_ai_enabled"],
    suggest_title: ["cv_ai_enabled"],
    suggest_skills: ["cv_ai_enabled"],
    generate_cv: ["cv_ai_enabled"],
    generate_lm: ["lm_ai_enabled"],
    generate_cv_lm: ["cv_ai_enabled", "lm_ai_enabled"],
    adapt_to_offer: ["adapt_to_offer_enabled"],
    ats_score: ["ats_score_enabled"],
    translate: ["translation_enabled"],
    fix_grammar: ["reformulation_enabled"],
    shorten_text: ["reformulation_enabled"],
    make_professional: ["reformulation_enabled"],
    interview_feedback: ["interview_feedback_enabled"],
  };
  const requiredFeatures = featureKeys[action] || [];
  if (requiredFeatures.some((key) => String(aiConfig[key] ?? "true") === "false")) {
    return json({ error: "AI_DISABLED", message: "Cette fonction IA est désactivée par l’administration." }, 403);
  }

  const now = new Date();
  const dayStart = new Date(now); dayStart.setUTCHours(0, 0, 0, 0);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const dailyLimit = Math.max(0, Number(aiConfig.daily_limit_per_user || 0));
  const monthlyLimit = Math.max(0, Number(aiConfig.monthly_limit_per_user || 0));
  if (dailyLimit > 0 || monthlyLimit > 0) {
    const usageQuery = (from: string) => sb.from("external_service_ledger")
      .select("id", { count: "exact", head: true })
      .eq("created_by", user.id)
      .eq("entry_type", "usage")
      .eq("source", "platform")
      .eq("unit", "input_tokens")
      .eq("metadata->>module", "career")
      .gte("occurred_at", from);
    const [dailyUsage, monthlyUsage] = await Promise.all([
      dailyLimit > 0 ? usageQuery(dayStart.toISOString()) : Promise.resolve({ count: 0, error: null }),
      monthlyLimit > 0 ? usageQuery(monthStart.toISOString()) : Promise.resolve({ count: 0, error: null }),
    ]);
    if (dailyUsage.error) throw dailyUsage.error;
    if (monthlyUsage.error) throw monthlyUsage.error;
    if (dailyLimit > 0 && Number(dailyUsage.count || 0) >= dailyLimit) {
      return json({ error: "AI_DAILY_LIMIT_REACHED", message: `Limite quotidienne atteinte (${dailyLimit} action(s) IA).` }, 429);
    }
    if (monthlyLimit > 0 && Number(monthlyUsage.count || 0) >= monthlyLimit) {
      return json({ error: "AI_MONTHLY_LIMIT_REACHED", message: `Limite mensuelle atteinte (${monthlyLimit} action(s) IA).` }, 429);
    }
  }

  const paidActions: Record<string, string> = {
    generate_cv: "cout_cv_ia",
    generate_lm: "cout_lm_ia",
    generate_cv_lm: "cout_cv_lm_ia",
    adapt_to_offer: "cout_adapter_offre",
    full_pack: "cout_pack_candidature",
    translate: "cout_traduction",
    ats_score: "cout_ats_score",
  };

  let tokensToConsume = 0;
  if (paidActions[action]) {
    tokensToConsume = Number(tokenConfig[paidActions[action]] ?? 1);
    const central = await centralCareerCredits(sb, user.id, tokensToConsume, false);
    if (central.available < tokensToConsume && Number(user.cv_tokens || 0) < tokensToConsume) {
      return json({
        error: "INSUFFICIENT_TOKENS",
        tokens_required: tokensToConsume,
        tokens_available: Number(user.cv_tokens || 0),
        subscription_credits_available: central.available,
        message: `Cette action nécessite ${tokensToConsume} crédit(s).`,
      }, 402);
    }
  }

  let prompt = "";
  if (action === "improve_summary") prompt = `${languageInstruction}\nAméliore ce résumé professionnel sans inventer d'information :\n\n${text}`;
  else if (action === "fix_grammar") prompt = `${languageInstruction}\nCorrige l'orthographe et la grammaire sans changer le fond :\n\n${text}`;
  else if (action === "shorten_text") prompt = `${languageInstruction}\nRaccourcis ce texte en conservant les informations essentielles :\n\n${text}`;
  else if (action === "make_professional") prompt = `${languageInstruction}\nReformule ce texte dans un style professionnel adapté à une candidature :\n\n${text}`;
  else if (action === "rewrite_experience") prompt = `${languageInstruction}\nReformule cette expérience avec des verbes d'action et des résultats concrets, sans inventer :\n\n${text}`;
  else if (action === "improve_project") prompt = `${languageInstruction}\nAméliore cette description de projet pour un CV, sans inventer :\n\n${text}`;
  else if (action === "suggest_title") prompt = `${languageInstruction}\nPropose cinq titres professionnels adaptés à ce profil :\n\n${text}`;
  else if (action === "suggest_skills") prompt = `${languageInstruction}\nSuggère dix compétences pertinentes à vérifier avec l'utilisateur pour ce profil :\n\n${text}`;
  else if (action === "generate_cv") prompt = `${languageInstruction}\nGénère un résumé professionnel à partir de ces seules informations :\n${JSON.stringify(body.doc_data || text, null, 2)}`;
  else if (action === "generate_lm") prompt = `${languageInstruction}\nRédige une lettre de motivation à partir de ces seules informations :\nProfil : ${text || JSON.stringify(body.doc_data || {})}\nPoste : ${body.target_job || "non précisé"}\nPays : ${body.target_country || "non précisé"}\nType : ${body.application_type || "emploi"}`;
  else if (action === "generate_cv_lm") prompt = `${languageInstruction}\nProduis en JSON un résumé CV et une lettre de motivation à partir de ces seules informations :\n${text || JSON.stringify(body.doc_data || {})}\nPoste : ${body.target_job || "non précisé"}`;
  else if (action === "adapt_to_offer") prompt = `${languageInstruction}\nAnalyse la correspondance entre le profil et l'offre. Réponds en JSON avec score, missing_keywords, skills_to_add, experiences_to_rewrite, recommendations, cover_letter.\nProfil : ${JSON.stringify(body.doc_data || text)}\nOffre : ${body.offer_text || ""}`;
  else if (action === "translate") prompt = `Traduis professionnellement ce texte en ${supportedLanguages[language] || "français"} :\n\n${text}`;
  else if (action === "ats_score") prompt = `Analyse ce CV et réponds en JSON avec lisibilite, structure, orthographe, compatibilite_ats, longueur, mots_cles, professionnalisme, score_global et conseils.\nCV : ${JSON.stringify(body.doc_data || text)}`;
  else if (action === "interview_feedback") {
    const mode = String(body.interview_mode || "answer") === "summary" ? "summary" : "answer";
    const question = String(body.question || "").trim();
    const answer = String(body.answer || text || "").trim();
    const jobContext = body.job_context && typeof body.job_context === "object" ? body.job_context : {};
    const answers = body.answers && typeof body.answers === "object" ? body.answers : {};
    if (mode === "answer" && (!question || !answer)) return json({ error: "INTERVIEW_INPUT_REQUIRED" }, 400);
    if (mode === "summary" && Object.keys(answers as Record<string, unknown>).length === 0) return json({ error: "INTERVIEW_ANSWERS_REQUIRED" }, 400);
    prompt = `${languageInstruction}\nMode : ${mode}.\nContexte du poste : ${JSON.stringify(jobContext)}\nQuestion : ${question}\nRéponse : ${answer}\nRéponses sauvegardées : ${JSON.stringify(answers)}\n\nRetourne exactement un JSON avec : {"score": nombre 0-100, "strengths": [chaînes], "improvements": [chaînes], "star_analysis": {"situation": chaîne, "task": chaîne, "action": chaîne, "result": chaîne}, "relevance": chaîne, "improved_answer": chaîne, "next_tip": chaîne}.\nPour un bilan global, improved_answer doit contenir un plan d'action synthétique plutôt qu'une réponse fictive.`;
  }
  else return json({ error: "UNKNOWN_AI_ACTION", action }, 400);

  const aiResult = await callClaude(sb, user.id, action, action === "interview_feedback" ? INTERVIEW_SYSTEM_PROMPT : SYSTEM_PROMPT, prompt);
  const result = aiResult.text;
  const structuredActions = new Set(["interview_feedback", "adapt_to_offer", "ats_score", "generate_cv_lm"]);
  const structuredResult = structuredActions.has(action) ? parseAiJsonObject(result) : null;
  if (structuredActions.has(action) && !structuredResult) {
    return json({ error: "AI_RESPONSE_INVALID", message: "La réponse IA reçue est incomplète ou invalide. Aucun crédit n’a été consommé.", provider: aiResult.provider, model: aiResult.model }, 502);
  }

  let tokensRemaining = Number(user.cv_tokens || 0);
  let subscriptionCreditsRemaining: number | null = null;
  if (tokensToConsume > 0) {
    const central = await centralCareerCredits(sb, user.id, tokensToConsume, true);
    if (central.consumed) {
      subscriptionCreditsRemaining = central.available;
    } else {
      tokensRemaining = Math.max(0, tokensRemaining - tokensToConsume);
      const { error: userError } = await sb.from("users").update({ cv_tokens: tokensRemaining }).eq("id", user.id);
      if (userError) throw userError;
      await sb.from("career_token_transactions").insert({
        user_id: user.id,
        transaction_type: "debit",
        amount: tokensToConsume,
        balance_after: tokensRemaining,
        reason: action,
        reference_type: "career_ai",
      });
    }
  }

  const interviewFeedback = action === "interview_feedback" ? structuredResult : null;

  return json({
    success: true,
    action,
    result,
    ...(interviewFeedback ? { feedback: interviewFeedback } : {}),
    tokens_consumed: tokensToConsume,
    tokens_remaining: tokensRemaining,
    subscription_credits_remaining: subscriptionCreditsRemaining,
    provider: aiResult.provider,
    model: aiResult.model,
    provider_usage: aiResult.usage,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || (req.method === "GET" ? "list" : "");

    if (action === "list") return await listAction(req, sb);
    if (action === "save") return await saveAction(req, sb);
    if (action === "ai") return await aiAction(req, sb);
    return json({ error: "UNKNOWN_ACTION", action }, 400);
  } catch (error) {
    console.error("career-studio-manage", error);
    const ai = aiErrorPayload(error);
    if (ai.error !== "AI_RUNTIME_ERROR") return json({ error: ai.error, provider: ai.provider, message: ai.message }, ai.status);
    return json({ error: "SERVER_ERROR", message: error instanceof Error ? error.message : String(error) }, 500);
  }
});
