import {
  getAnthropicApiKey,
  getAnthropicFastModel,
  getAnthropicQualityModel,
  getOpenAIEmbeddingModel,
  getOpenAIImageModel,
  getOpenAITextModel,
  getOpenAITtsModel,
  getOpenAISubtitleTranscriptionModel,
} from "./ai-models.ts";

export type AiModule =
  | "career"
  | "studio"
  | "rag_chat"
  | "rag_index"
  | "subtitles"
  | "tts"
  | "translation"
  | "image"
  | string;

export class AiRuntimeError extends Error {
  code: string;
  provider: string;
  status: number;
  detail?: string;
  constructor(code: string, provider: string, status = 502, detail?: string) {
    super(code);
    this.name = "AiRuntimeError";
    this.code = code;
    this.provider = provider;
    this.status = status;
    this.detail = detail;
  }
}

type RuntimeContext = {
  module: AiModule;
  action: string;
  userId?: string | null;
  courseId?: string | null;
  lessonId?: string | null;
  blockId?: string | null;
  metadata?: Record<string, unknown>;
};

function cleanDetail(value: unknown, max = 1200) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

async function recordUsage(sb: any, provider: string, model: string, context: RuntimeContext, usage: Record<string, unknown> = {}, requestId?: string | null) {
  if (!sb) return;
  const occurredAt = new Date().toISOString();
  const keyBase = requestId || crypto.randomUUID();
  const rows: any[] = [];
  const add = (suffix: string, quantity: unknown, unit: string) => {
    const value = Number(quantity || 0);
    if (!Number.isFinite(value) || value <= 0) return;
    rows.push({
      provider_entry_key: `${provider}-app:${keyBase}:${suffix}`,
      provider,
      entry_type: "usage",
      source: "platform",
      occurred_at: occurredAt,
      quantity: value,
      unit,
      reference: requestId || null,
      description: `Usage ${provider} — ${context.module}/${context.action}`,
      metadata: {
        module: context.module,
        action: context.action,
        model,
        course_id: context.courseId || null,
        lesson_id: context.lessonId || null,
        block_id: context.blockId || null,
        ...(context.metadata || {}),
      },
      created_by: context.userId || null,
    });
  };
  add("input", usage.input_tokens ?? usage.prompt_tokens, "input_tokens");
  add("output", usage.output_tokens ?? usage.completion_tokens, "output_tokens");
  add("cache_creation", usage.cache_creation_input_tokens, "cache_creation_input_tokens");
  add("cache_read", usage.cache_read_input_tokens, "cache_read_input_tokens");
  add("images", usage.images, "images");
  add("audio_seconds", usage.audio_seconds, "audio_seconds");
  if (!rows.length) return;
  const { error } = await sb.from("external_service_ledger").upsert(rows, { onConflict: "provider_entry_key", ignoreDuplicates: true });
  if (error) console.warn("AI_TELEMETRY_FAILED", provider, context.module, context.action, error.message);
}

function anthropicThinkingConfig(model: string, effort: "low" | "medium" | "high" | "max" = "low") {
  // Claude Sonnet/Opus 5 use adaptive thinking by default. Explicit low effort
  // keeps structured UI tasks predictable while still allowing reasoning when useful.
  if (/claude-(?:sonnet|opus)-5(?:\b|-)/i.test(model)) {
    return { thinking: { type: "adaptive" }, output_config: { effort } };
  }
  return {};
}

export async function runAnthropicText(sb: any, options: {
  context: RuntimeContext;
  prompt: string;
  system?: string;
  tier?: "fast" | "quality";
  model?: string;
  maxTokens?: number;
  effort?: "low" | "medium" | "high" | "max";
  temperature?: number;
}) {
  const key = getAnthropicApiKey();
  if (!key) throw new AiRuntimeError("ANTHROPIC_NOT_CONFIGURED", "anthropic", 503);
  const model = String(options.model || (options.tier === "fast" ? getAnthropicFastModel() : getAnthropicQualityModel()));
  const maxTokens = Math.max(512, Math.min(32000, Number(options.maxTokens || (options.tier === "fast" ? 2400 : 6000))));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  try {
    const body: Record<string, unknown> = {
      model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: options.prompt }],
      ...anthropicThinkingConfig(model, options.effort || "low"),
    };
    if (options.system) body.system = options.system;
    // Temperature is intentionally omitted on adaptive-thinking models.
    if (typeof options.temperature === "number" && !("thinking" in body)) body.temperature = options.temperature;
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({} as any));
    if (!response.ok) {
      throw new AiRuntimeError("ANTHROPIC_REQUEST_FAILED", "anthropic", response.status, cleanDetail(payload?.error?.message || payload));
    }
    const text = Array.isArray(payload?.content)
      ? payload.content.filter((item: any) => item?.type === "text" || typeof item?.text === "string").map((item: any) => String(item?.text || "")).join("").trim()
      : "";
    if (!text) throw new AiRuntimeError("ANTHROPIC_EMPTY_RESPONSE", "anthropic", 502);
    const usage = payload?.usage || {};
    await recordUsage(sb, "anthropic", String(payload?.model || model), options.context, usage, String(payload?.id || "") || null);
    return { text, provider: "anthropic", model: String(payload?.model || model), requestId: String(payload?.id || ""), usage };
  } catch (error) {
    if (error instanceof AiRuntimeError) throw error;
    if ((error as Error)?.name === "AbortError") throw new AiRuntimeError("ANTHROPIC_TIMEOUT", "anthropic", 504);
    throw new AiRuntimeError("ANTHROPIC_UNAVAILABLE", "anthropic", 502, cleanDetail((error as Error)?.message));
  } finally { clearTimeout(timer); }
}



function bytesToBase64(bytes: Uint8Array) {
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunkSize, bytes.length)));
  }
  return btoa(binary);
}

export async function runAnthropicPdfText(sb: any, options: {
  context: RuntimeContext;
  pdfBytes: Uint8Array;
  prompt: string;
  system?: string;
  tier?: "fast" | "quality";
  model?: string;
  maxTokens?: number;
  effort?: "low" | "medium" | "high" | "max";
}) {
  const key = getAnthropicApiKey();
  if (!key) throw new AiRuntimeError("ANTHROPIC_NOT_CONFIGURED", "anthropic", 503);
  if (!(options.pdfBytes instanceof Uint8Array) || !options.pdfBytes.byteLength) {
    throw new AiRuntimeError("ANTHROPIC_PDF_EMPTY", "anthropic", 400);
  }
  // Keep enough headroom for JSON/base64 expansion and Edge Function memory.
  if (options.pdfBytes.byteLength > 20 * 1024 * 1024) {
    throw new AiRuntimeError("ANTHROPIC_PDF_TOO_LARGE_FOR_DIRECT_ANALYSIS", "anthropic", 413);
  }
  const model = String(options.model || (options.tier === "fast" ? getAnthropicFastModel() : getAnthropicQualityModel()));
  const maxTokens = Math.max(1024, Math.min(32000, Number(options.maxTokens || 7000)));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  try {
    const body: Record<string, unknown> = {
      model,
      max_tokens: maxTokens,
      messages: [{
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: bytesToBase64(options.pdfBytes),
            },
          },
          { type: "text", text: options.prompt },
        ],
      }],
      ...anthropicThinkingConfig(model, options.effort || "low"),
    };
    if (options.system) body.system = options.system;
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({} as any));
    if (!response.ok) {
      throw new AiRuntimeError("ANTHROPIC_PDF_REQUEST_FAILED", "anthropic", response.status, cleanDetail(payload?.error?.message || payload));
    }
    const text = Array.isArray(payload?.content)
      ? payload.content.filter((item: any) => item?.type === "text" || typeof item?.text === "string").map((item: any) => String(item?.text || "")).join("").trim()
      : "";
    if (!text) throw new AiRuntimeError("ANTHROPIC_PDF_EMPTY_RESPONSE", "anthropic", 502);
    const usage = payload?.usage || {};
    await recordUsage(sb, "anthropic", String(payload?.model || model), options.context, usage, String(payload?.id || "") || null);
    return { text, provider: "anthropic", model: String(payload?.model || model), requestId: String(payload?.id || ""), usage };
  } catch (error) {
    if (error instanceof AiRuntimeError) throw error;
    if ((error as Error)?.name === "AbortError") throw new AiRuntimeError("ANTHROPIC_PDF_TIMEOUT", "anthropic", 504);
    throw new AiRuntimeError("ANTHROPIC_PDF_UNAVAILABLE", "anthropic", 502, cleanDetail((error as Error)?.message));
  } finally {
    clearTimeout(timer);
  }
}

export async function runOpenAIChatText(sb: any, options: { context: RuntimeContext; prompt: string; model?: string; temperature?: number; maxTokens?: number }) {
  const key = String(Deno.env.get("OPENAI_API_KEY") || "").trim();
  if (!key) throw new AiRuntimeError("OPENAI_NOT_CONFIGURED", "openai", 503);
  const model = options.model || getOpenAITextModel();
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: options.temperature ?? 0,
      max_tokens: options.maxTokens || 5000,
      messages: [{ role: "user", content: options.prompt }],
    }),
  });
  const payload = await response.json().catch(() => ({} as any));
  if (!response.ok) throw new AiRuntimeError("OPENAI_TEXT_FAILED", "openai", response.status, cleanDetail(payload?.error?.message || payload));
  const text = String(payload?.choices?.[0]?.message?.content || "").trim();
  if (!text) throw new AiRuntimeError("OPENAI_EMPTY_RESPONSE", "openai", 502);
  await recordUsage(sb, "openai", String(payload?.model || model), options.context, payload?.usage || {}, String(payload?.id || "") || null);
  return { text, provider: "openai", model: String(payload?.model || model), usage: payload?.usage || {}, requestId: String(payload?.id || "") };
}

export async function runOpenAIEmbedding(sb: any, options: { context: RuntimeContext; input: string; model?: string }) {
  const key = String(Deno.env.get("OPENAI_API_KEY") || "").trim();
  if (!key) throw new AiRuntimeError("OPENAI_NOT_CONFIGURED", "openai", 503);
  const model = options.model || getOpenAIEmbeddingModel();
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, input: options.input }),
  });
  const payload = await response.json().catch(() => ({} as any));
  if (!response.ok) throw new AiRuntimeError("OPENAI_EMBEDDING_FAILED", "openai", response.status, cleanDetail(payload?.error?.message || payload));
  const embedding = payload?.data?.[0]?.embedding;
  if (!Array.isArray(embedding)) throw new AiRuntimeError("OPENAI_EMBEDDING_EMPTY", "openai", 502);
  await recordUsage(sb, "openai", model, options.context, payload?.usage || {}, String(payload?.id || "") || null);
  return embedding as number[];
}

export async function runOpenAIImage(sb: any, options: { context: RuntimeContext; prompt: string; size?: string; quality?: string; model?: string; count?: number }) {
  const key = String(Deno.env.get("OPENAI_API_KEY") || "").trim();
  if (!key) throw new AiRuntimeError("OPENAI_NOT_CONFIGURED", "openai", 503, "La clé OpenAI n’est pas configurée dans Supabase.");
  const model = options.model || getOpenAIImageModel();
  const count = Math.min(4, Math.max(1, Number(options.count || 1)));
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt: options.prompt, size: options.size || "1536x1024", quality: options.quality || "medium", n: count, output_format: "png" }),
  });
  const payload = await response.json().catch(() => ({} as any));
  if (!response.ok) throw new AiRuntimeError("OPENAI_IMAGE_FAILED", "openai", response.status, cleanDetail(payload?.error?.message || payload));
  const images = Array.isArray(payload?.data)
    ? payload.data.map((item: any) => String(item?.b64_json || "")).filter(Boolean)
    : [];
  if (!images.length) throw new AiRuntimeError("OPENAI_IMAGE_EMPTY", "openai", 502, "OpenAI n’a retourné aucune image.");
  await recordUsage(sb, "openai", model, options.context, { images: images.length }, String(payload?.id || crypto.randomUUID()));
  return { b64: images[0], images, model };
}

export async function runOpenAITts(sb: any, options: { context: RuntimeContext; text: string; voice?: string; speed?: number; model?: string }) {
  const key = String(Deno.env.get("OPENAI_API_KEY") || "").trim();
  if (!key) throw new AiRuntimeError("OPENAI_NOT_CONFIGURED", "openai", 503);
  const model = options.model || getOpenAITtsModel();
  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, input: options.text.slice(0, 4096), voice: options.voice || "nova", response_format: "mp3", speed: options.speed ?? 0.95 }),
  });
  if (!response.ok) throw new AiRuntimeError("OPENAI_TTS_FAILED", "openai", response.status, cleanDetail(await response.text()));
  const bytes = new Uint8Array(await response.arrayBuffer());
  const words = options.text.trim().split(/\s+/).filter(Boolean).length;
  const seconds = Math.max(1, Math.round(words / 150 * 60));
  await recordUsage(sb, "openai", model, options.context, { audio_seconds: seconds }, crypto.randomUUID());
  return { bytes, model, estimatedSeconds: seconds };
}

export async function runOpenAITranscription(sb: any, options: { context: RuntimeContext; audio: Blob; filename?: string; language?: string; model?: string; responseFormat?: "srt" | "text" | "json" }) {
  const key = String(Deno.env.get("OPENAI_API_KEY") || "").trim();
  if (!key) throw new AiRuntimeError("OPENAI_NOT_CONFIGURED", "openai", 503);
  const model = options.model || getOpenAISubtitleTranscriptionModel();
  const form = new FormData();
  form.append("file", options.audio, options.filename || "audio.mp4");
  form.append("model", model);
  form.append("response_format", options.responseFormat || "srt");
  if (options.language && options.language !== "auto") form.append("language", options.language);
  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
  if (!response.ok) throw new AiRuntimeError("OPENAI_TRANSCRIPTION_FAILED", "openai", response.status, cleanDetail(await response.text()));
  const text = await response.text();
  await recordUsage(sb, "openai", model, options.context, {}, crypto.randomUUID());
  return { text, model };
}

export function aiErrorPayload(error: unknown) {
  if (error instanceof AiRuntimeError) {
    return { error: error.code, provider: error.provider, message: error.detail || "Le service IA est momentanément indisponible.", status: error.status };
  }
  return { error: "AI_RUNTIME_ERROR", provider: "unknown", message: "Le service IA est momentanément indisponible.", status: 502 };
}
