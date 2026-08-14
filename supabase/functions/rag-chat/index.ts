import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

import { getActiveOmniaSessionResult } from "../_shared/omnia-auth.ts";
import { getAnthropicApiKey, getAnthropicQualityModel, getOpenAIEmbeddingModel, normalizeAnthropicModel } from "../_shared/ai-models.ts";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-omnia-session-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function sessionUser(sb: any, req: Request) {
  const token = (req.headers.get("x-omnia-session-token") || req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data } = await getActiveOmniaSessionResult(sb, token);
  if (data?.user_id) return data.user_id;
  const { data: authData } = await sb.auth.getUser(token);
  return authData?.user?.id || null;
}

const MODE_LABELS: Record<string, string> = {
  explanation: "expliquer clairement le point demandé",
  reformulation: "reformuler le contenu avec des mots plus simples sans changer son sens",
  exercise: "proposer un exercice d'entraînement puis fournir des indications, sans inventer de notions absentes du cours",
  revision_plan: "construire un plan de révision réaliste à partir des notions présentes dans le cours",
  recommendation: "recommander les éléments du cours à revoir en priorité",
  question: "répondre à la question",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const userId = await sessionUser(sb, req);
    if (!userId) return json({ success: false, error: "AUTH_REQUIRED", message: "Connexion requise." }, 401);
    const body = await req.json();
    const courseId = String(body.course_id || "");
    const message = String(body.message || "").trim();
    const mode = String(body.mode || "question");
    const history = Array.isArray(body.conversation_history) ? body.conversation_history.slice(-6) : [];
    if (!courseId) return json({ success: false, error: "COURSE_ID_REQUIRED", message: "Formation requise." }, 400);
    if (message.length < 3) return json({ success: false, error: "MESSAGE_TOO_SHORT", message: "Votre demande est trop courte." }, 400);
    if (message.length > 1200) return json({ success: false, error: "MESSAGE_TOO_LONG", message: "Votre demande est trop longue." }, 400);

    const [{ data: enrollment }, { data: course }] = await Promise.all([
      sb.from("user_enrollments").select("id").eq("user_id", userId).eq("course_id", courseId).maybeSingle(),
      sb.from("courses").select("id,title,creator_id,is_published,quality_review_status").eq("id", courseId).maybeSingle(),
    ]);
    if (!course) return json({ success: false, error: "COURSE_NOT_FOUND", message: "Formation introuvable." }, 404);
    if (!enrollment && course.creator_id !== userId) return json({ success: false, error: "NOT_ENROLLED", message: "Accès refusé à cette formation." }, 403);
    if (!course.is_published || course.quality_review_status !== "approved") {
      return json({ success: false, error: "COURSE_NOT_APPROVED", message: "L’assistant est disponible uniquement pour les formations publiées et validées par le Centre Qualité." }, 403);
    }

    const [{ data: governance }, { data: courseSetting }] = await Promise.all([
      sb.from("ai_pedagogical_governance").select("*").eq("id", 1).maybeSingle(),
      sb.from("ai_pedagogical_course_settings").select("*").eq("course_id", courseId).maybeSingle(),
    ]);
    if (governance && governance.enabled === false) return json({ success: false, error: "AI_DISABLED", message: "L’assistant pédagogique est temporairement désactivé par le Centre Qualité." }, 403);
    if (courseSetting && courseSetting.enabled === false) return json({ success: false, error: "COURSE_AI_DISABLED", message: "L’assistant n’est pas activé pour cette formation." }, 403);
    const allowedModes = courseSetting?.allowed_modes || governance?.allowed_modes || ["question", "explanation", "reformulation", "exercise", "revision_plan", "recommendation"];
    if (!allowedModes.includes(mode)) return json({ success: false, error: "MODE_NOT_ALLOWED", message: "Cette fonction n’est pas autorisée par le Centre Qualité." }, 403);

    const hourlyLimit = Number(courseSetting?.hourly_limit || governance?.hourly_limit || 20);
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await sb.from("ai_pedagogical_usage_logs").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since);
    if (Number(count || 0) >= hourlyLimit) return json({ success: false, error: "RATE_LIMIT", message: `Limite de ${hourlyLimit} demandes par heure atteinte.` }, 429);

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    const claudeKey = getAnthropicApiKey();
    if (!openaiKey || !claudeKey) return json({ success: false, error: "AI_NOT_CONFIGURED", message: "Le service d’assistance n’est pas encore configuré." }, 503);

    const embResp = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST", headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: getOpenAIEmbeddingModel(), input: message }),
    });
    if (!embResp.ok) throw new Error("EMBEDDING_FAILED");
    const embData = await embResp.json();
    const { data: chunks, error: searchError } = await sb.rpc("search_rag_chunks", {
      query_embedding: embData.data[0].embedding, course_id_filter: courseId,
      match_count: Number(governance?.max_chunks || 6), match_threshold: Number(governance?.similarity_threshold || 0.72),
    });
    if (searchError) throw searchError;
    const validChunks = chunks || [];
    const hasContext = validChunks.length > 0;
    const context = validChunks.map((c: any, i: number) => `[Source ${i + 1}]\n${c.content}`).join("\n\n---\n\n");
    if (!hasContext) {
      await sb.from("ai_pedagogical_usage_logs").insert({ user_id: userId, course_id: courseId, mode, question: message, status: "no_context", chunks_used: 0 });
      return json({ success: true, reply: "Je n’ai pas trouvé de réponse dans le contenu validé de cette formation. Reformulez votre demande ou consultez le forum du cours.", sources_found: false, chunks_used: 0 });
    }

    const model = normalizeAnthropicModel(courseSetting?.model || governance?.model || getAnthropicQualityModel(), "quality");
    const maxTokens = Number(courseSetting?.max_tokens || governance?.max_tokens || 1000);
    const instruction = MODE_LABELS[mode] || MODE_LABELS.question;
    const system = `Tu es l’assistant pédagogique gouverné d’Omnia Global Academy pour la formation « ${course.title} ».
Ta tâche est de ${instruction}.
RÈGLES ABSOLUES :
- utilise uniquement les sources validées fournies ;
- n’invente aucun fait, notion, référence ou résultat ;
- indique clairement lorsqu’une information manque ;
- ne réalise pas à la place de l’apprenant une évaluation notée ni un travail à remettre ;
- réponds uniquement en français ;
- reste pédagogique, clair et concis ;
- termine par « Sources utilisées : » avec les numéros des sources réellement mobilisées.

SOURCES VALIDÉES :\n${context}`;

    const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": claudeKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [...history, { role: "user", content: message }] }),
    });
    if (!aiResp.ok) throw new Error(`AI_PROVIDER_${aiResp.status}`);
    const aiData = await aiResp.json();
    const reply = aiData.content?.[0]?.text || "Une erreur est survenue.";
    await sb.from("ai_pedagogical_usage_logs").insert({ user_id: userId, course_id: courseId, mode, question: message, response_excerpt: reply.slice(0, 1000), status: "answered", chunks_used: validChunks.length, model });
    return json({ success: true, reply, sources_found: true, chunks_used: validChunks.length, mode });
  } catch (error) {
    console.error("rag-chat", error);
    return json({ success: false, error: "SERVER_ERROR", message: "L’assistant pédagogique est momentanément indisponible." }, 500);
  }
});
