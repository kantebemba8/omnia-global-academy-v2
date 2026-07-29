import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

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
  const { data: session, error } = await sb.from("user_sessions")
    .select("user_id")
    .eq("session_token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
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

async function listAction(req: Request, sb: ReturnType<typeof createClient>) {
  if (req.method === "GET") {
    const url = new URL(req.url);
    const type = url.searchParams.get("type") || "cv";
    const category = url.searchParams.get("category");
    let query = sb.from("career_templates")
      .select("*")
      .eq("template_type", type)
      .eq("is_active", true)
      .order("display_order");
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
      .order("display_order"),
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
    documents: documentsResult.data || [],
    templates: templatesResult.data || [],
    // Les anciens packs de jetons sont volontairement retirés.
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

  if (operation === "delete") {
    if (!documentId) return json({ error: "DOCUMENT_ID_REQUIRED" }, 400);
    const { error } = await sb.from("career_documents")
      .delete()
      .eq("id", documentId)
      .eq("user_id", user.id);
    if (error) throw error;
    return json({ success: true, action: "deleted" });
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
    const { data, error } = await sb.from("career_documents").insert({
      user_id: user.id,
      doc_type: original.doc_type,
      title: `${original.title} (copie)`,
      template_key: original.template_key,
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
  const title = String(body.title || "Mon document").trim() || "Mon document";
  const docData = body.doc_data && typeof body.doc_data === "object" ? body.doc_data : {};
  const designOptions = body.design_options && typeof body.design_options === "object" ? body.design_options : {};
  const hash = await contentHash(docData);
  const patch = {
    doc_type: docType,
    title,
    template_key: body.template_key || null,
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

async function callClaude(system: string, prompt: string) {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY") || "";
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY_MISSING");
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-4-6",
      max_tokens: 2048,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `ANTHROPIC_HTTP_${response.status}`);
  return String(payload?.content?.[0]?.text || "");
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
  const language = String(body.language || "fr");
  const languageInstruction = language === "en" ? "Respond in English." : "Réponds en français.";

  const [aiConfig, tokenConfig] = await Promise.all([
    loadKeyValueConfig(sb, "career_ai_config"),
    loadKeyValueConfig(sb, "career_token_config", true),
  ]);

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
    if (String(aiConfig[`${action}_enabled`] ?? "true") === "false") {
      return json({ error: "AI_DISABLED", message: "Cette fonction IA est désactivée." }, 403);
    }
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
  else if (action === "translate") prompt = `Traduis professionnellement ce texte en ${language === "en" ? "anglais" : "français"} :\n\n${text}`;
  else if (action === "ats_score") prompt = `Analyse ce CV et réponds en JSON avec lisibilite, structure, orthographe, compatibilite_ats, longueur, mots_cles, professionnalisme, score_global et conseils.\nCV : ${JSON.stringify(body.doc_data || text)}`;
  else return json({ error: "UNKNOWN_AI_ACTION", action }, 400);

  const result = await callClaude(SYSTEM_PROMPT, prompt);

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

  return json({
    success: true,
    action,
    result,
    tokens_consumed: tokensToConsume,
    tokens_remaining: tokensRemaining,
    subscription_credits_remaining: subscriptionCreditsRemaining,
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
    return json({
      error: "SERVER_ERROR",
      message: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});
