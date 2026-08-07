import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

const DEFAULT_ORIGIN = "https://omniaglobalacademy.com";

function allowedOrigins(): Set<string> {
  const configured = [
    Deno.env.get("ALLOWED_ORIGIN") ?? "",
    Deno.env.get("ALLOWED_ORIGINS") ?? "",
  ]
    .join(",")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return new Set(configured.length > 0 ? configured : [DEFAULT_ORIGIN]);
}

export function makeCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  const allowed = allowedOrigins();
  const selectedOrigin = origin && allowed.has(origin)
    ? origin
    : (allowed.has(DEFAULT_ORIGIN) ? DEFAULT_ORIGIN : [...allowed][0] ?? DEFAULT_ORIGIN);

  return {
    "Access-Control-Allow-Origin": selectedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-demo-heartbeat-token, x-omnia-session-token",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  };
}

export function getClientIP(req: Request): string {
  const cloudflare = req.headers.get("cf-connecting-ip")?.trim();
  if (cloudflare) return cloudflare;

  const realIP = req.headers.get("x-real-ip")?.trim();
  if (realIP) return realIP;

  const forwarded = req.headers.get("x-forwarded-for")
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return forwarded?.at(-1) ?? "unknown";
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function generateNumericOtp(): string {
  const range = 1_000_000;
  const maxAccepted = Math.floor(0x1_0000_0000 / range) * range;
  const values = new Uint32Array(1);

  do {
    crypto.getRandomValues(values);
  } while (values[0] >= maxAccepted);

  return (values[0] % range).toString().padStart(6, "0");
}

export function generateOpaqueToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function consumeRateLimit(
  supabase: SupabaseClient,
  key: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; retryAfter: number }> {
  const { data, error } = await supabase.rpc("consume_rate_limit", {
    p_key: key,
    p_max_requests: maxRequests,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    console.error("consume_rate_limit failed:", error.message);
    // Fail closed on authentication endpoints if the protection cannot be evaluated.
    return { allowed: false, retryAfter: Math.max(1, windowSeconds) };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    allowed: Boolean(row?.allowed),
    retryAfter: Math.max(0, Number(row?.retry_after ?? 0)),
  };
}

export async function createHashedEmailOtp(
  supabase: SupabaseClient,
  input: {
    email: string;
    purpose: "inscription" | "connexion" | "reset_password";
    expiresAt: string;
    ipAddress?: string | null;
  },
): Promise<string> {
  const otp = generateNumericOtp();
  const codeHash = await sha256Hex(otp);

  const { error } = await supabase.from("otp_codes").insert({
    phone_number: null,
    email: input.email.trim().toLowerCase(),
    code: null,
    code_hash: codeHash,
    purpose: input.purpose,
    expires_at: input.expiresAt,
    ip_address: input.ipAddress ?? null,
    failed_attempts: 0,
    locked_at: null,
  });

  if (error) throw error;
  return otp;
}

export async function createHashedOtp(
  supabase: SupabaseClient,
  input: {
    phoneNumber: string;
    purpose: "inscription" | "connexion" | "reset_password";
    expiresAt: string;
    ipAddress?: string | null;
  },
): Promise<string> {
  const otp = generateNumericOtp();
  const codeHash = await sha256Hex(otp);

  const { error } = await supabase.from("otp_codes").insert({
    phone_number: input.phoneNumber,
    code: null,
    code_hash: codeHash,
    purpose: input.purpose,
    expires_at: input.expiresAt,
    ip_address: input.ipAddress ?? null,
    failed_attempts: 0,
    locked_at: null,
  });

  if (error) throw error;
  return otp;
}
