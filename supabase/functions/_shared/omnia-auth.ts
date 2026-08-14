import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { generateOpaqueToken, sha256Hex } from "./auth-security.ts";

export type OmniaSessionRow = {
  id?: string;
  user_id: string;
  expires_at: string;
  session_token_hash?: string | null;
};

export type OmniaSessionResult = {
  data: OmniaSessionRow | null;
  error: unknown | null;
};

export function getOmniaSessionToken(
  req: Request,
  body?: Record<string, unknown> | null,
): string {
  const headerValue = req.headers.get("x-omnia-session-token") ||
    req.headers.get("Authorization") ||
    "";
  const bodyValue = typeof body?.session_token === "string" ? body.session_token : "";
  return String(headerValue || bodyValue)
    .replace(/^Bearer\s+/i, "")
    .trim();
}

export async function hashOmniaToken(rawToken: string): Promise<string> {
  return await sha256Hex(String(rawToken || "").trim());
}

export async function getOmniaSessionByToken(
  sb: SupabaseClient,
  rawToken: string,
): Promise<OmniaSessionRow | null> {
  const token = rawToken.trim();
  if (!token) return null;

  const tokenHash = await sha256Hex(token);
  const { data, error } = await sb
    .from("user_sessions")
    .select("id,user_id,expires_at,session_token_hash")
    .eq("session_token_hash", tokenHash)
    .maybeSingle();

  if (error) throw error;
  return (data || null) as OmniaSessionRow | null;
}

export async function getActiveOmniaSession(
  sb: SupabaseClient,
  rawToken: string,
): Promise<OmniaSessionRow | null> {
  const session = await getOmniaSessionByToken(sb, rawToken);
  if (!session) return null;
  if (!session.expires_at || new Date(session.expires_at) <= new Date()) return null;
  return session;
}

export async function getActiveOmniaSessionResult(
  sb: SupabaseClient,
  rawToken: string,
): Promise<OmniaSessionResult> {
  try {
    return { data: await getActiveOmniaSession(sb, rawToken), error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function createOmniaSession(
  sb: SupabaseClient,
  input: {
    userId: string;
    expiresAt: string;
    ipAddress?: string | null;
    userAgent?: string | null;
    token?: string;
  },
): Promise<{ token: string; tokenHash: string }> {
  const token = input.token?.trim() || generateOpaqueToken();
  const tokenHash = await sha256Hex(token);

  const { error } = await sb.from("user_sessions").insert({
    user_id: input.userId,
    session_token_hash: tokenHash,
    ip_address: input.ipAddress ?? null,
    user_agent: input.userAgent ?? null,
    expires_at: input.expiresAt,
  });
  if (error) throw error;
  return { token, tokenHash };
}

export async function revokeOmniaSession(
  sb: SupabaseClient,
  rawToken: string,
): Promise<void> {
  const token = rawToken.trim();
  if (!token) return;
  const tokenHash = await sha256Hex(token);

  const { error } = await sb
    .from("user_sessions")
    .delete()
    .eq("session_token_hash", tokenHash);
  if (error) throw error;
}

export async function getOmniaRoles(
  sb: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const { data, error } = await sb
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw error;
  return (data || []).map((row: { role: string }) => String(row.role));
}

export function getOmniaInternalSecret(): string {
  return (Deno.env.get("OMNIA_INTERNAL_FUNCTION_SECRET") || "").trim();
}

export function isOmniaInternalRequest(req: Request): boolean {
  const expected = getOmniaInternalSecret();
  const supplied = (req.headers.get("x-omnia-internal-secret") || "").trim();
  return Boolean(expected && supplied && supplied === expected);
}

export function omniaInternalHeaders(
  extra: Record<string, string> = {},
): Record<string, string> {
  const secret = getOmniaInternalSecret();
  if (!secret) throw new Error("OMNIA_INTERNAL_FUNCTION_SECRET_MISSING");
  return {
    "x-omnia-internal-secret": secret,
    "Content-Type": "application/json",
    ...extra,
  };
}
