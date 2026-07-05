import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "https://omniaglobalacademy.com",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), {
    status: s, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const ACTIONS: Record<string, string> = {
  improve_summary: `Améliore ce résumé professionnel pour qu'il soit plus percutant et professionnel. 
    Garde exactement les mêmes informations, ne rajoute rien d'inventé.
    Réponds uniquement avec le texte amélioré, sans explication.`,
  
  rewrite_experience: `Reformule cette description d'expérience professionnelle de manière 
    plus percutante, en utilisant des verbes d'action forts au passé.
    Ne rajoute aucune information inventée. Garde les faits exacts.
    Réponds uniquement avec le texte reformulé.`,
  
  make_professional: `Rends cette phrase plus professionnelle et formelle 
    pour un CV. Ne change pas le sens, n'ajoute aucune information.
    Réponds uniquement avec la phrase améliorée.`,
  
  fix_grammar: `Corrige les fautes d'orthographe et de grammaire dans ce texte.
    Ne change pas le sens ni le contenu.
    Réponds uniquement avec le texte corrigé.`,
  
  adapt_to_job: `Adapte ce contenu de CV pour mieux correspondre à cette offre d'emploi.
    Réorganise et mets en valeur les éléments pertinents déjà présents.
    N'invente JAMAIS de compétence, diplôme ou expérience.
    Réponds avec le contenu adapté.`,
  
  suggest_skills: `À partir de ces informations de profil, suggère des compétences 
    pertinentes que cette personne possède probablement.
    Base-toi uniquement sur les informations fournies.
    Réponds avec une liste de compétences séparées par des virgules.`,
  
  shorten_text: `Raccourcis ce texte tout en gardant les informations essentielles.
    Vise 30% à 50% plus court. Ne retire aucun fait important.
    Réponds uniquement avec le texte raccourci.`,
  
  improve_project: `Améliore la description de ce projet pour qu'elle soit 
    plus claire et professionnelle dans un CV.
    Mets en avant les résultats et l'impact si mentionnés.
    Ne rajoute aucune information inventée.
    Réponds uniquement avec la description améliorée.`,
  
  suggest_title: `Propose 3 titres professionnels adaptés à ce profil.
    Base-toi uniquement sur les informations fournies.
    Réponds avec 3 titres séparés par des sauts de ligne.`,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: sess } = await sb.from("user_sessions")
    .select("user_id")
    .eq("session_token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!sess) return json({ error: "SESSION_INVALID" }, 401);

  const { action, text, context } = await req.json();

  if (!action || !ACTIONS[action]) {
    return json({ error: "Action invalide", available: Object.keys(ACTIONS) }, 400);
  }
  if (!text?.trim()) return json({ error: "text requis" }, 400);

  const systemPrompt = `Tu es un expert en rédaction de CV professionnels pour le marché africain 
et international. Tu aides à améliorer les CVs sans jamais inventer d'informations.

RÈGLES ABSOLUES :
- Ne jamais inventer de diplôme, expérience, certification ou compétence
- Travailler uniquement avec les informations fournies par l'utilisateur
- Répondre en français professionnel
- Répondre uniquement avec le contenu demandé, sans commentaire ni explication`;

  const userPrompt = `${ACTIONS[action]}

${context ? `Contexte additionnel : ${context}\n\n` : ''}Texte à traiter :
${text}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": Deno.env.get("CLAUDE_API_KEY") ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    const data = await response.json();
    const result = data.content?.[0]?.text ?? "";

    return json({ success: true, result, action });
  } catch (err) {
    console.error(err);
    return json({ error: "Erreur IA" }, 500);
  }
});
