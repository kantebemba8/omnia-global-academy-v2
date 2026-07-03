import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/security.ts";
import { corsHeaders } from "../_shared/cors.ts";

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  const { data: sess } = await sb.from("user_sessions").select("user_id")
    .eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!sess) return json({ error: "SESSION_INVALID" }, 401);
  const userId = sess.user_id;

  // Rate limit: 20 messages / hour / user
  const rateCheck = await sb.from("rate_limit_log")
    .select("*", { count: "exact", head: true })
    .eq("rate_key", `rag-chat:${userId}`)
    .gte("created_at", new Date(Date.now() - 3600_000).toISOString());
  if ((rateCheck.count ?? 0) >= 20) {
    return json({ error: "RATE_LIMIT", message: "Limite de 20 questions par heure atteinte. Réessayez plus tard." }, 429);
  }
  await sb.from("rate_limit_log").insert({ rate_key: `rag-chat:${userId}`, created_at: new Date().toISOString() });


  const body = await req.json() as {
    course_id: string;
    message: string;
    conversation_history?: Array<{ role: string; content: string }>;
  };

  const { course_id, message, conversation_history } = body;
  if (!course_id) return json({ error: "COURSE_ID_REQUIRED" }, 400);
  if (!message || message.trim().length < 3) return json({ error: "MESSAGE_TOO_SHORT" }, 400);
  if (message.length > 1000) return json({ error: "MESSAGE_TOO_LONG" }, 400);

  // Check enrollment
  const { data: enr } = await sb.from("user_enrollments").select("id")
    .eq("user_id", userId).eq("course_id", course_id).maybeSingle();
  const { data: course } = await sb.from("courses").select("title, creator_id").eq("id", course_id).maybeSingle();
  if (!course) return json({ error: "COURSE_NOT_FOUND" }, 404);
  if (!enr && course.creator_id !== userId) return json({ error: "NOT_ENROLLED" }, 403);

  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  const claudeKey = Deno.env.get("CLAUDE_API_KEY");
  if (!openaiKey || !claudeKey) return json({ error: "AI_NOT_CONFIGURED" }, 500);

  // Fetch AI settings
  const { data: settings } = await sb.from("site_settings")
    .select("key, value")
    .in("key", ["ai_model", "ai_max_tokens_per_response", "ai_conversations_log_enabled"]);
  const settingsMap: Record<string, string> = {};
  (settings || []).forEach((s: { key: string; value: string }) => {
    try { settingsMap[s.key] = JSON.parse(s.value); } catch { settingsMap[s.key] = s.value; }
  });
  const aiModel = settingsMap["ai_model"] || "claude-sonnet-4-6";
  const maxTokens = parseInt(settingsMap["ai_max_tokens_per_response"] || "1000");
  const logEnabled = settingsMap["ai_conversations_log_enabled"] === "true";

  // Step 1: Embed question
  const embResp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "text-embedding-3-small", input: message }),
  });
  if (!embResp.ok) return json({ error: "EMBEDDING_FAILED" }, 500);
  const embData = await embResp.json();
  const questionEmbedding = embData.data[0].embedding;

  // Step 2: Vector search
  const { data: chunks } = await sb.rpc("search_rag_chunks", {
    query_embedding: questionEmbedding,
    course_id_filter: course_id,
    match_count: 5,
    match_threshold: 0.75,
  });

  const hasContext = chunks && chunks.length > 0;
  const context = hasContext ? (chunks as Array<{ content: string }>).map(c => c.content).join("\n\n---\n\n") : null;

  // Step 3: Build system prompt
  const systemPrompt = context
    ? `Tu es l'assistant pédagogique de la formation "${course.title}" sur Omnia Global Academy.

RÈGLES ABSOLUES :
- Réponds UNIQUEMENT en te basant sur le contexte de cours fourni ci-dessous
- Si la question dépasse ce contexte, réponds : "Cette question sort du périmètre de cette formation. Je ne peux répondre qu'aux questions liées au contenu de ce cours."
- Ne jamais inventer d'informations
- Langue de réponse : français
- Sois pédagogue, encourageant, concis (max ${maxTokens} tokens)

CONTEXTE DE LA FORMATION :
${context}`
    : `Tu es l'assistant pédagogique de la formation "${course.title}" sur Omnia Global Academy.
La question posée ne correspond à aucun contenu indexé de cette formation. Réponds uniquement : "Je n'ai pas trouvé de réponse dans le contenu de cette formation. Essayez de reformuler votre question ou consultez le forum du cours."`;

  // Step 4: Call Claude
  const history = (conversation_history || []).slice(-6).map(m => ({ role: m.role, content: m.content }));
  const claudeResp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": claudeKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: aiModel,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [...history, { role: "user", content: message }],
    }),
  });

  if (!claudeResp.ok) {
    const err = await claudeResp.json();
    console.error("Claude error:", err);
    return json({ error: "CLAUDE_FAILED" }, 500);
  }

  const claudeData = await claudeResp.json();
  const assistantReply = claudeData.content?.[0]?.text || "Désolé, une erreur est survenue.";

  // Step 5: Log if enabled
  if (logEnabled) {
    const newMessages = [
      ...(conversation_history || []),
      { role: "user", content: message, created_at: new Date().toISOString() },
      { role: "assistant", content: assistantReply, created_at: new Date().toISOString() },
    ];
    await sb.from("ai_conversations").upsert(
      { user_id: userId, course_id, messages: newMessages, updated_at: new Date().toISOString() },
      { onConflict: "user_id,course_id" }
    );
  }

  return json({
    reply: assistantReply,
    sources_found: hasContext,
    chunks_used: hasContext ? (chunks as unknown[]).length : 0,
  });
});
