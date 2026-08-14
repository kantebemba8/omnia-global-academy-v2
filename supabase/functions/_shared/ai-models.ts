/**
 * Omnia Global Academy — canonical external AI configuration.
 * Centralizes provider model IDs so retired models cannot remain hidden in
 * individual Edge Functions. Environment variables may override defaults.
 */
export const DEFAULT_ANTHROPIC_FAST_MODEL = "claude-haiku-4-5";
export const DEFAULT_ANTHROPIC_QUALITY_MODEL = "claude-sonnet-5";
export const DEFAULT_OPENAI_TEXT_MODEL = "gpt-4o-mini";
export const DEFAULT_OPENAI_IMAGE_MODEL = "gpt-image-2";
export const DEFAULT_OPENAI_TTS_MODEL = "gpt-4o-mini-tts";
export const DEFAULT_OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";

// Whisper remains intentional for the subtitle pipeline because Omnia needs
// SRT/timestamp output; current OpenAI guidance still directs timestamp use to Whisper.
export const DEFAULT_OPENAI_SUBTITLE_TRANSCRIPTION_MODEL = "whisper-1";

export function getAnthropicApiKey(): string {
  // Canonical: ANTHROPIC_API_KEY. CLAUDE_API_KEY is a temporary compatibility
  // fallback so an existing Supabase secret is not broken by this deployment.
  return (Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("CLAUDE_API_KEY") || "").trim();
}
export function getAnthropicFastModel(): string {
  return (Deno.env.get("ANTHROPIC_FAST_MODEL") || DEFAULT_ANTHROPIC_FAST_MODEL).trim();
}
export function getAnthropicQualityModel(): string {
  return (Deno.env.get("ANTHROPIC_QUALITY_MODEL") || DEFAULT_ANTHROPIC_QUALITY_MODEL).trim();
}
export function normalizeAnthropicModel(value: unknown, tier: "fast" | "quality" = "quality"): string {
  const raw = String(value || "").trim();
  if (!raw) return tier === "fast" ? getAnthropicFastModel() : getAnthropicQualityModel();
  if (raw === "claude-3-5-haiku-latest" || raw === "claude-3-5-haiku-20241022") return getAnthropicFastModel();
  if (raw === "claude-sonnet-4-6") return getAnthropicQualityModel();
  return raw;
}
export function getOpenAITextModel(): string {
  return (Deno.env.get("OPENAI_TEXT_MODEL") || DEFAULT_OPENAI_TEXT_MODEL).trim();
}
export function getOpenAIImageModel(): string {
  return (Deno.env.get("OPENAI_IMAGE_MODEL") || DEFAULT_OPENAI_IMAGE_MODEL).trim();
}
export function getOpenAITtsModel(): string {
  return (Deno.env.get("OPENAI_TTS_MODEL") || DEFAULT_OPENAI_TTS_MODEL).trim();
}
export function getOpenAIEmbeddingModel(): string {
  return (Deno.env.get("OPENAI_EMBEDDING_MODEL") || DEFAULT_OPENAI_EMBEDDING_MODEL).trim();
}
export function getOpenAISubtitleTranscriptionModel(): string {
  return (Deno.env.get("OPENAI_SUBTITLE_TRANSCRIPTION_MODEL") || DEFAULT_OPENAI_SUBTITLE_TRANSCRIPTION_MODEL).trim();
}
