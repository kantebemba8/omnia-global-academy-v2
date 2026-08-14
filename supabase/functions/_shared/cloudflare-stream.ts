import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const BASIC_DIRECT_UPLOAD_MAX_BYTES = 200 * 1024 * 1024;
const DEFAULT_MAX_DURATION_SECONDS = 6 * 60 * 60;

function env(name: string): string {
  return String(Deno.env.get(name) || "").trim();
}

function flag(name: string, fallback = false): boolean {
  const value = env(name).toLowerCase();
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value);
}

function accountId(): string {
  return env("CLOUDFLARE_ACCOUNT_ID") || env("CF_ACCOUNT_ID") || env("R2_ACCOUNT_ID");
}

function apiToken(): string {
  return env("CLOUDFLARE_STREAM_API_TOKEN") || env("CF_STREAM_API_TOKEN");
}

function signingKeyId(): string {
  return env("CLOUDFLARE_STREAM_SIGNING_KEY_ID") || env("CF_STREAM_KEY_ID");
}

function signingJwk(): string {
  return env("CLOUDFLARE_STREAM_SIGNING_JWK") || env("CF_STREAM_JWK");
}

function signingPem(): string {
  return env("CLOUDFLARE_STREAM_SIGNING_PEM") || env("CF_STREAM_PEM");
}

function localSigningConfigured(): boolean {
  return Boolean(signingKeyId() && (signingJwk() || signingPem()));
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function jsonToBase64Url(value: unknown): string {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function decodeBase64Bytes(value: string): Uint8Array {
  const binary = atob(value.replace(/\s+/g, ""));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function importStreamSigningKey(): Promise<CryptoKey> {
  const jwkRaw = signingJwk();
  if (jwkRaw) {
    const json = jwkRaw.trim().startsWith("{") ? jwkRaw : atob(jwkRaw);
    return await crypto.subtle.importKey(
      "jwk",
      JSON.parse(json),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"],
    );
  }

  let pem = signingPem();
  if (!pem) throw new Error("CLOUDFLARE_STREAM_SIGNING_KEY_MISSING");
  if (!pem.includes("BEGIN")) pem = atob(pem.replace(/\s+/g, ""));
  const base64 = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const der = decodeBase64Bytes(base64);
  return await crypto.subtle.importKey(
    "pkcs8",
    der.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function createLocalStreamToken(uid: string, expiresInSeconds: number, downloadable: boolean): Promise<string> {
  const keyId = signingKeyId();
  if (!keyId || !localSigningConfigured()) throw new Error("CLOUDFLARE_STREAM_SIGNING_KEY_MISSING");
  const exp = Math.floor(Date.now() / 1000) + Math.max(60, Math.min(24 * 60 * 60, Math.floor(expiresInSeconds)));
  const header = { alg: "RS256", kid: keyId };
  const payload: Record<string, unknown> = { sub: uid, kid: keyId, exp };
  if (downloadable) payload.downloadable = true;
  const unsigned = `${jsonToBase64Url(header)}.${jsonToBase64Url(payload)}`;
  const key = await importStreamSigningKey();
  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    new TextEncoder().encode(unsigned),
  );
  return `${unsigned}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

function apiBase(): string {
  const account = accountId();
  if (!account) throw new Error("CLOUDFLARE_ACCOUNT_ID_MISSING");
  return `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/stream`;
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = apiToken();
  if (!token) throw new Error("CLOUDFLARE_STREAM_API_TOKEN_MISSING");
  return { Authorization: `Bearer ${token}`, ...extra };
}

async function cfJson(response: Response, errorCode: string): Promise<any> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.success === false) {
    const detail = Array.isArray(body?.errors)
      ? body.errors.map((item: any) => item?.message || item?.code).filter(Boolean).join(" | ")
      : "";
    throw new Error(`${errorCode}:${response.status}${detail ? `:${detail}` : ""}`);
  }
  return body?.result ?? body;
}

export function cloudflareStreamConfigured(): boolean {
  return Boolean(accountId() && apiToken());
}

export function cloudflareStreamProductionReady(): boolean {
  return cloudflareStreamConfigured();
}

export type StreamDirectUpload = {
  uid: string;
  protocol: "stream_basic" | "stream_tus";
  upload_url: string;
  headers: Record<string, string>;
  chunk_size_bytes?: number;
  requires_signed_urls: true;
};

function base64Metadata(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function createDirectStreamUpload(input: {
  fileName: string;
  sizeBytes: number;
  maxDurationSeconds?: number;
  creator?: string | null;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}): Promise<StreamDirectUpload> {
  if (!cloudflareStreamConfigured()) throw new Error("CLOUDFLARE_STREAM_NOT_CONFIGURED");
  const sizeBytes = Math.max(1, Math.floor(Number(input.sizeBytes || 0)));
  const maxDurationSeconds = Math.max(60, Math.min(24 * 60 * 60, Math.floor(Number(input.maxDurationSeconds || DEFAULT_MAX_DURATION_SECONDS))));
  const meta = Object.fromEntries(
    Object.entries(input.metadata || {})
      .filter(([, value]) => value !== null && value !== undefined && String(value).trim())
      .map(([key, value]) => [key, String(value).slice(0, 500)]),
  );

  if (sizeBytes <= BASIC_DIRECT_UPLOAD_MAX_BYTES) {
    const response = await fetch(`${apiBase()}/direct_upload`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        maxDurationSeconds,
        requireSignedURLs: true,
        creator: input.creator || undefined,
        meta: { name: input.fileName, ...meta },
      }),
    });
    const result = await cfJson(response, "CLOUDFLARE_STREAM_DIRECT_UPLOAD_FAILED");
    if (!result?.uid || !result?.uploadURL) throw new Error("CLOUDFLARE_STREAM_DIRECT_UPLOAD_INVALID_RESPONSE");
    return {
      uid: String(result.uid),
      protocol: "stream_basic",
      upload_url: String(result.uploadURL),
      headers: {},
      requires_signed_urls: true,
    };
  }

  // Cloudflare TUS only accepts a documented subset of Upload-Metadata keys.
  // Business metadata is retained for the basic Direct Upload path, while the
  // TUS path relies on the backend-issued UID + Omnia authorization checks.
  const uploadMetadata = [
    `name ${base64Metadata(input.fileName)}`,
    "requiresignedurls",
    `maxdurationseconds ${base64Metadata(String(maxDurationSeconds))}`,
  ];
  const tusHeaders: Record<string, string> = {
    "Tus-Resumable": "1.0.0",
    "Upload-Length": String(sizeBytes),
    "Upload-Metadata": uploadMetadata.join(","),
  };
  if (input.creator) tusHeaders["Upload-Creator"] = String(input.creator).slice(0, 64);

  const response = await fetch(`${apiBase()}?direct_user=true`, {
    method: "POST",
    headers: authHeaders(tusHeaders),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`CLOUDFLARE_STREAM_TUS_CREATE_FAILED:${response.status}:${detail.slice(0, 400)}`);
  }
  const uploadUrl = response.headers.get("location") || "";
  const uid = response.headers.get("stream-media-id") || "";
  if (!uploadUrl || !uid) throw new Error("CLOUDFLARE_STREAM_TUS_CREATE_INVALID_RESPONSE");
  return {
    uid,
    protocol: "stream_tus",
    upload_url: uploadUrl,
    headers: { "Tus-Resumable": "1.0.0" },
    // 50 MiB: multiple de 256 KiB, au-dessus du minimum Cloudflare.
    chunk_size_bytes: 50 * 1024 * 1024,
    requires_signed_urls: true,
  };
}

export async function getStreamVideo(uid: string): Promise<any> {
  if (!uid) throw new Error("CLOUDFLARE_STREAM_UID_MISSING");
  const response = await fetch(`${apiBase()}/${encodeURIComponent(uid)}`, {
    headers: authHeaders({ Accept: "application/json" }),
  });
  return await cfJson(response, "CLOUDFLARE_STREAM_VIDEO_LOOKUP_FAILED");
}

export function streamVideoReady(video: any): boolean {
  const state = String(video?.status?.state || "").toLowerCase();
  return Boolean(video?.readyToStream) && ["ready", "readytostream"].includes(state || "ready");
}

export async function createStreamPlaybackToken(uid: string, expiresInSeconds = 15 * 60, downloadable = false): Promise<string> {
  if (localSigningConfigured()) {
    return await createLocalStreamToken(uid, expiresInSeconds, downloadable);
  }

  const exp = Math.floor(Date.now() / 1000) + Math.max(60, Math.min(24 * 60 * 60, Math.floor(expiresInSeconds)));
  const response = await fetch(`${apiBase()}/${encodeURIComponent(uid)}/token`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ exp, downloadable }),
  });
  const result = await cfJson(response, "CLOUDFLARE_STREAM_TOKEN_FAILED");
  const token = typeof result === "string" ? result : result?.token;
  if (!token) throw new Error("CLOUDFLARE_STREAM_TOKEN_MISSING");
  return String(token);
}

function configuredDeliveryHost(): string | null {
  const raw = env("CLOUDFLARE_STREAM_DELIVERY_HOST");
  if (!raw) return null;
  try {
    const parsed = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return parsed.host;
  } catch {
    return null;
  }
}

async function deliveryHost(uid: string, video?: any): Promise<string> {
  const configured = configuredDeliveryHost();
  if (configured) return configured;
  const item = video || await getStreamVideo(uid);
  const candidates = [item?.playback?.hls, item?.playback?.dash, item?.preview];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try { return new URL(String(candidate)).host; } catch { /* ignore */ }
  }
  throw new Error("CLOUDFLARE_STREAM_DELIVERY_HOST_UNAVAILABLE");
}

export async function signedStreamManifest(uid: string, expiresInSeconds = 15 * 60): Promise<{ url: string; iframe_url: string; token: string; expires_in: number }> {
  const video = await getStreamVideo(uid);
  const token = await createStreamPlaybackToken(uid, expiresInSeconds, false);
  const host = await deliveryHost(uid, video);
  return {
    url: `https://${host}/${token}/manifest/video.m3u8`,
    iframe_url: `https://${host}/${token}/iframe`,
    token,
    expires_in: expiresInSeconds,
  };
}

async function getStreamDownloads(uid: string): Promise<any> {
  const response = await fetch(`${apiBase()}/${encodeURIComponent(uid)}/downloads`, {
    headers: authHeaders({ Accept: "application/json" }),
  });
  return await cfJson(response, "CLOUDFLARE_STREAM_DOWNLOAD_LOOKUP_FAILED");
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function ensureStreamDownloads(uid: string): Promise<any> {
  const response = await fetch(`${apiBase()}/${encodeURIComponent(uid)}/downloads`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({}),
  });
  await cfJson(response, "CLOUDFLARE_STREAM_DOWNLOAD_ENABLE_FAILED");

  // Cloudflare génère le MP4 de façon asynchrone. Le worker attend seulement
  // quelques secondes afin de rester court ; un job de sous-titres peut être
  // relancé plus tard si le téléchargement n'est pas encore prêt.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const downloads = await getStreamDownloads(uid);
    const item = downloads?.default;
    const status = String(item?.status || "").toLowerCase();
    if (status === "ready") return item;
    if (status === "error") throw new Error("CLOUDFLARE_STREAM_DOWNLOAD_GENERATION_FAILED");
    if (attempt < 4) await wait(1000);
  }

  throw new Error("CLOUDFLARE_STREAM_DOWNLOAD_NOT_READY");
}

export async function signedStreamDownload(uid: string, expiresInSeconds = 10 * 60): Promise<{ url: string; token: string; expires_in: number }> {
  await ensureStreamDownloads(uid);
  const video = await getStreamVideo(uid);
  const token = await createStreamPlaybackToken(uid, expiresInSeconds, true);
  const host = await deliveryHost(uid, video);
  return {
    url: `https://${host}/${token}/downloads/default.mp4`,
    token,
    expires_in: expiresInSeconds,
  };
}

export async function deleteStreamVideo(uid: string): Promise<void> {
  if (!uid || !cloudflareStreamConfigured()) return;
  const response = await fetch(`${apiBase()}/${encodeURIComponent(uid)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (response.status === 404) return;
  await cfJson(response, "CLOUDFLARE_STREAM_DELETE_FAILED");
}

export async function fetchStreamCaption(uid: string, language: string): Promise<Response> {
  // The caption metadata endpoint returns JSON; /vtt returns the actual WebVTT file.
  return await fetch(`${apiBase()}/${encodeURIComponent(uid)}/captions/${encodeURIComponent(language)}/vtt`, {
    headers: authHeaders({ Accept: "text/vtt,text/plain" }),
  });
}

export function streamConfigurationStatus() {
  return {
    configured: cloudflareStreamConfigured(),
    account_configured: Boolean(accountId()),
    api_token_configured: Boolean(apiToken()),
    delivery_host_configured: Boolean(configuredDeliveryHost()),
    local_signing_key_configured: localSigningConfigured(),
    token_strategy: localSigningConfigured() ? "local_signing_key" : "api_token_endpoint",
  };
}
