import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

import { getActiveOmniaSessionResult, omniaInternalHeaders } from "../_shared/omnia-auth.ts";
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };
import { getAnthropicQualityModel, normalizeAnthropicModel } from "../_shared/ai-models.ts";
import { runAnthropicText, runOpenAIEmbedding, aiErrorPayload } from "../_shared/ai-runtime.ts";
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
      sb.from("courses").select("id,title,creator_id,is_published,quality_review_status,language,instruction_language,target_language,course_type").eq("id", courseId).maybeSingle(),
    ]);
    if (!course) return json({ success: false, error: "COURSE_NOT_FOUND", message: "Formation introuvable." }, 404);
    if (!enrollment && course.creator_id !== userId) return json({ success: false, error: "NOT_ENROLLED", message: "Accès refusé à cette formation." }, 403);
    if (!course.is_published || course.quality_review_status !== "approved") {
      return json({ success: false, error: "COURSE_NOT_APPROVED", message: "L’assistant est disponible uniquement pour les formations publiées et validées par le Centre Qualité." }, 403);
    }

    // Existing courses may still have a legacy content_text index. Trigger a one-time
    // blocks-v2 rebuild in the background; the current request can still use the old
    // index while the next request benefits from the modern Builder content.
    const { data: indexSample } = await sb.from("rag_chunks").select("content").eq("course_id", courseId).limit(1).maybeSingle();
    if (!String(indexSample?.content || "").includes("[Index:blocks-v2]")) {
      const rebuild = fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/rag-index-course`, {
        method: "POST", headers: omniaInternalHeaders(), body: JSON.stringify({ course_id: courseId, reason: "lazy_blocks_v2_upgrade" }),
      }).then(async response => { if (!response.ok) console.error("RAG_LAZY_REINDEX_FAILED", response.status, await response.text()); })
        .catch(error => console.error("RAG_LAZY_REINDEX_FAILED", error));
      try { EdgeRuntime.waitUntil(rebuild); } catch { void rebuild; }
    }

    const [{ data: governance }, { data: courseSetting }, { data: loggingSetting }] = await Promise.all([
      sb.from("ai_pedagogical_governance").select("*").eq("id", 1).maybeSingle(),
      sb.from("ai_pedagogical_course_settings").select("*").eq("course_id", courseId).maybeSingle(),
      sb.from("site_settings").select("value").eq("key", "ai_conversations_log_enabled").maybeSingle(),
    ]);
    const logConversationContent = loggingSetting?.value === true || loggingSetting?.value === "true" || loggingSetting?.value === '"true"';
    if (governance && governance.enabled === false) return json({ success: false, error: "AI_DISABLED", message: "L’assistant pédagogique est temporairement désactivé par le Centre Qualité." }, 403);
    if (courseSetting && courseSetting.enabled === false) return json({ success: false, error: "COURSE_AI_DISABLED", message: "L’assistant n’est pas activé pour cette formation." }, 403);
    const allowedModes = courseSetting?.allowed_modes || governance?.allowed_modes || ["question", "explanation", "reformulation", "exercise", "revision_plan", "recommendation"];
    if (!allowedModes.includes(mode)) return json({ success: false, error: "MODE_NOT_ALLOWED", message: "Cette fonction n’est pas autorisée par le Centre Qualité." }, 403);

    const hourlyLimit = Number(courseSetting?.hourly_limit || governance?.hourly_limit || 20);
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await sb.from("ai_pedagogical_usage_logs").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since);
    if (Number(count || 0) >= hourlyLimit) return json({ success: false, error: "RATE_LIMIT", message: `Limite de ${hourlyLimit} demandes par heure atteinte.` }, 429);

    const queryEmbedding = await runOpenAIEmbedding(sb, { context: { module: "rag_chat", action: "query_embedding", userId, courseId }, input: message });
    const { data: chunks, error: searchError } = await sb.rpc("search_rag_chunks", {
      query_embedding: queryEmbedding, course_id_filter: courseId,
      match_count: Number(governance?.max_chunks || 6), match_threshold: Number(governance?.similarity_threshold || 0.72),
    });
    if (searchError) throw searchError;
    const validChunks = chunks || [];
    const hasContext = validChunks.length > 0;
    const context = validChunks.map((c: any, i: number) => `[Source ${i + 1}]\n${c.content}`).join("\n\n---\n\n");
    if (!hasContext) {
      await sb.from("ai_pedagogical_usage_logs").insert({ user_id: userId, course_id: courseId, mode, question: logConversationContent ? message : "", response_excerpt: null, status: "no_context", chunks_used: 0 });
      return json({ success: true, reply: "Je n’ai pas trouvé de réponse dans le contenu validé de cette formation. Reformulez votre demande ou consultez le forum du cours.", sources_found: false, chunks_used: 0 });
    }

    const model = normalizeAnthropicModel(courseSetting?.model || governance?.model || getAnthropicQualityModel(), "quality");
    const configuredMax = Number(courseSetting?.max_tokens || governance?.max_tokens || 0);
    const maxTokens = Math.max(3000, Number.isFinite(configuredMax) ? configuredMax : 0);
    const instruction = MODE_LABELS[mode] || MODE_LABELS.question;
    const responseLanguage = String(course.instruction_language || course.language || "fr");
    const languageRule = course.course_type === "language_learning" && course.target_language
      ? `Réponds principalement dans la langue d'enseignement ${responseLanguage}. Utilise la langue cible ${course.target_language} seulement lorsque la question ou l'exercice l'exige.`
      : `Réponds dans la langue d'enseignement de la formation : ${responseLanguage}.`;
    const system = `Tu es l’assistant pédagogique gouverné d’Omnia Global Academy pour la formation « ${course.title} ».
Ta tâche est de ${instruction}.
RÈGLES ABSOLUES :
- utilise uniquement les sources validées fournies ;
- n’invente aucun fait, notion, référence ou résultat ;
- indique clairement lorsqu’une information manque ;
- ne réalise pas à la place de l’apprenant une évaluation notée ni un travail à remettre ;
- ${languageRule}
- reste pédagogique, clair et concis ;
- termine par « Sources utilisées : » avec les numéros des sources réellement mobilisées.

SOURCES VALIDÉES :\n${context}`;
    const historyText = history.map((item: any) => `${item.role === "assistant" ? "Assistant" : "Apprenant"}: ${String(item.content || "")}`).join("\n");
    const ai = await runAnthropicText(sb, { context: { module: "rag_chat", action: mode, userId, courseId }, model, tier: "quality", system, prompt: `${historyText ? `HISTORIQUE RÉCENT:\n${historyText}\n\n` : ""}DEMANDE DE L'APPRENANT:\n${message}`, maxTokens, effort: "low" });
    const reply = ai.text;
    await sb.from("ai_pedagogical_usage_logs").insert({ user_id: userId, course_id: courseId, mode, question: logConversationContent ? message : "", response_excerpt: logConversationContent ? reply.slice(0, 1000) : null, status: "answered", chunks_used: validChunks.length, model });
    return json({ success: true, reply, sources_found: true, chunks_used: validChunks.length, mode });
  } catch (error) {
    console.error("rag-chat", error);
    const ai = aiErrorPayload(error);
    if (ai.error !== "AI_RUNTIME_ERROR") return json({ success: false, error: ai.error, provider: ai.provider, message: ai.message }, ai.status);
    return json({ success: false, error: "SERVER_ERROR", message: "L’assistant pédagogique est momentanément indisponible." }, 500);
  }
});
