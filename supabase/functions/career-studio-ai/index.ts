import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { corsHeaders } from "../_shared/cors.ts";

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function verifySession(sb: ReturnType<typeof createClient>, token: string) {
  const { data: sess } = await sb.from("user_sessions")
    .select("user_id")
    .eq("session_token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!sess) return null;
  const { data: user } = await sb.from("users")
    .select("id, cv_tokens")
    .eq("id", (sess as { user_id: string }).user_id)
    .maybeSingle();
  return user;
}

async function callClaude(systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text ?? "";
}

const SYSTEM_BASE = `Tu es un expert en ressources humaines et rédaction professionnelle, spécialisé dans le marché africain et international. 
Tu aides les apprenants d'Omnia Global Academy à créer des CV et lettres de motivation professionnels.
Tu réponds toujours en français sauf si demandé autrement.
Tu ne dois jamais inventer des diplômes, expériences ou compétences que l'utilisateur n'a pas mentionnés.
Tu améliores et reformules uniquement ce que l'utilisateur te donne.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const user = await verifySession(sb, token);
    if (!user) return json({ error: "SESSION_INVALID" }, 401);

    const body = await req.json();
    const { action, text, doc_data, offer_text, target_job, target_country, application_type, language = "fr" } = body;

    // Vérifier config IA
    const { data: aiConfig } = await sb.from("career_ai_config").select("config_key, config_value");
    const aiMap: Record<string, string> = {};
    (aiConfig ?? []).forEach((c: { config_key: string; config_value: string }) => { aiMap[c.config_key] = c.config_value; });

    // Vérifier coût en jetons
    const { data: tokenConfig } = await sb.from("career_token_config").select("config_key, config_value");
    const tokenMap: Record<string, number> = {};
    (tokenConfig ?? []).forEach((c: { config_key: string; config_value: number }) => { tokenMap[c.config_key] = c.config_value; });

    // Actions gratuites (pas de consommation de jetons)
    const FREE_ACTIONS = [
      "improve_summary", "fix_grammar", "shorten_text",
      "make_professional", "rewrite_experience", "improve_project",
      "suggest_title", "suggest_skills",
    ];

    // Actions payantes
    const PAID_ACTIONS: Record<string, string> = {
      "generate_cv": "cout_cv_ia",
      "generate_lm": "cout_lm_ia",
      "generate_cv_lm": "cout_cv_lm_ia",
      "adapt_to_offer": "cout_adapter_offre",
      "full_pack": "cout_pack_candidature",
      "translate": "cout_traduction",
      "ats_score": "cout_ats_score",
    };

    let tokensToConsume = 0;
    if (PAID_ACTIONS[action]) {
      if (aiMap[action + "_enabled"] === "false") {
        return json({ error: "AI_DISABLED", message: "Cette fonction IA est désactivée." }, 403);
      }
      tokensToConsume = tokenMap[PAID_ACTIONS[action]] ?? 1;
      const currentTokens = user.cv_tokens ?? 0;
      if (currentTokens < tokensToConsume) {
        return json({
          error: "INSUFFICIENT_TOKENS",
          tokens_required: tokensToConsume,
          tokens_available: currentTokens,
          message: `Cette action nécessite ${tokensToConsume} jeton(s). Vous en avez ${currentTokens}.`,
        }, 402);
      }
    }

    let result = "";
    const langInstruction = language === "en" ? "Respond in English." : "Réponds en français.";

    // ── Actions gratuites ────────────────────────────────────
    if (action === "improve_summary") {
      result = await callClaude(SYSTEM_BASE, `${langInstruction}\nAméliore ce résumé professionnel pour le rendre plus percutant et professionnel. Garde le même sens :\n\n${text}`);
    } else if (action === "fix_grammar") {
      result = await callClaude(SYSTEM_BASE, `${langInstruction}\nCorrige les fautes d'orthographe et de grammaire dans ce texte sans changer le fond :\n\n${text}`);
    } else if (action === "shorten_text") {
      result = await callClaude(SYSTEM_BASE, `${langInstruction}\nRaccourcis ce texte pour qu'il tienne en 2-3 phrases maximum, sans perdre l'essentiel :\n\n${text}`);
    } else if (action === "make_professional") {
      result = await callClaude(SYSTEM_BASE, `${langInstruction}\nTransforme ce texte en un style professionnel et formel adapté à un CV ou une lettre de motivation :\n\n${text}`);
    } else if (action === "rewrite_experience") {
      result = await callClaude(SYSTEM_BASE, `${langInstruction}\nReformule cette description d'expérience professionnelle avec des verbes d'action et des résultats concrets :\n\n${text}`);
    } else if (action === "improve_project") {
      result = await callClaude(SYSTEM_BASE, `${langInstruction}\nAméliore la description de ce projet pour le rendre plus percutant dans un CV :\n\n${text}`);
    } else if (action === "suggest_title") {
      result = await callClaude(SYSTEM_BASE, `${langInstruction}\nPropose 5 titres professionnels adaptés à ce profil (une ligne chacun) :\n\n${text}`);
    } else if (action === "suggest_skills") {
      result = await callClaude(SYSTEM_BASE, `${langInstruction}\nSuggère 10 compétences professionnelles pertinentes pour ce profil/métier (une par ligne) :\n\n${text}`);
    }

    // ── Actions payantes ─────────────────────────────────────
    else if (action === "generate_cv") {
      const prompt = doc_data
        ? `${langInstruction}\nGénère un résumé professionnel percutant (3-4 phrases) pour ce profil :\n${JSON.stringify(doc_data, null, 2)}`
        : `${langInstruction}\nÀ partir de ce texte libre, génère un résumé professionnel pour un CV :\n\n${text}`;
      result = await callClaude(SYSTEM_BASE, prompt);
    } else if (action === "generate_lm") {
      result = await callClaude(SYSTEM_BASE,
        `${langInstruction}\nGénère une lettre de motivation professionnelle complète à partir de ces informations :\n
Profil : ${text || JSON.stringify(doc_data)}
Poste visé : ${target_job || "non spécifié"}
Type : ${application_type || "emploi"}
Pays cible : ${target_country || "Afrique de l'Ouest"}

La lettre doit inclure : introduction, motivation, compétences clés, lien avec l'entreprise, disponibilité, formule de politesse.`
      );
    } else if (action === "generate_cv_lm") {
      const cvResult = await callClaude(SYSTEM_BASE,
        `${langInstruction}\nGénère un résumé professionnel percutant (3-4 phrases) pour ce profil :\n${text || JSON.stringify(doc_data)}`
      );
      const lmResult = await callClaude(SYSTEM_BASE,
        `${langInstruction}\nGénère une lettre de motivation professionnelle pour ce profil :\n${text || JSON.stringify(doc_data)}\nPoste visé : ${target_job || "non spécifié"}`
      );
      result = JSON.stringify({ cv_summary: cvResult, lm: lmResult });
    } else if (action === "adapt_to_offer") {
      result = await callClaude(SYSTEM_BASE,
        `${langInstruction}\nAnalyse cette offre d'emploi et fournis :
1. Score de correspondance avec le profil (0-100%)
2. Mots-clés manquants dans le CV
3. Compétences à ajouter ou mettre en avant
4. Expériences à reformuler
5. Recommandations concrètes
6. Une lettre de motivation adaptée à cette offre

CV/Profil :
${JSON.stringify(doc_data || text)}

Offre d'emploi :
${offer_text}

Réponds en JSON avec les clés : score, missing_keywords, skills_to_add, experiences_to_rewrite, recommendations, cover_letter`
      );
    } else if (action === "translate") {
      const targetLang = language === "en" ? "anglais" : "français";
      result = await callClaude(SYSTEM_BASE, `Traduis ce texte en ${targetLang} de manière professionnelle :\n\n${text}`);
    } else if (action === "ats_score") {
      result = await callClaude(SYSTEM_BASE,
        `Analyse ce CV et donne un score ATS détaillé en JSON avec les clés :
- lisibilite (0-100)
- structure (0-100)
- orthographe (0-100)
- compatibilite_ats (0-100)
- longueur (0-100)
- mots_cles (0-100)
- professionnalisme (0-100)
- score_global (0-100)
- conseils (liste de 5 recommandations concrètes)

CV :
${JSON.stringify(doc_data || text)}`
      );
    } else {
      return json({ error: "UNKNOWN_ACTION", message: `Action inconnue : ${action}` }, 400);
    }

    // Consommer les jetons si action payante
    if (tokensToConsume > 0) {
      const newBalance = (user.cv_tokens ?? 0) - tokensToConsume;
      await sb.from("users").update({ cv_tokens: Math.max(0, newBalance) }).eq("id", user.id);
      await sb.from("career_token_transactions").insert({
        user_id: user.id,
        transaction_type: "debit",
        amount: tokensToConsume,
        balance_after: Math.max(0, newBalance),
        reason: action,
        reference_type: "career_ai",
      });
    }

    return json({
      success: true,
      action,
      result,
      tokens_consumed: tokensToConsume,
      tokens_remaining: (user.cv_tokens ?? 0) - tokensToConsume,
    });

  } catch (err) {
    console.error("career-studio-ai error:", err);
    return json({ error: "SERVER_ERROR", message: (err as Error).message }, 500);
  }
});