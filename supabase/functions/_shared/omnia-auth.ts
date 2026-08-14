import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { generateOpaqueToken, sha256Hex } from "./auth-security.ts";

export type OmniaSessionRow = {
  id?: string;
  user_id: string;
  expires_at: string;
  session_token_hash?: string | null;
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

export async function getOmniaSessionByToken(
  sb: SupabaseClient,
  rawToken: string,
): Promise<OmniaSessionRow | null> {
  const token = rawToken.trim();
  if (!token) return null;

  const tokenHash = await sha256Hex(token);
  const select = "id,user_id,expires_at,session_token_hash";

  const { data: hashedSession, error: hashedError } = await sb
    .from("user_sessions")
    .select(select)
    .eq("session_token_hash", tokenHash)
    .maybeSingle();
  if (hashedError) throw hashedError;
  if (hashedSession) return hashedSession as OmniaSessionRow;

  // Compatibilité transitoire Lot 2A : les fonctions non encore migrées peuvent
  // avoir créé une session avant le déploiement de la migration 162. Le trigger
  // SQL rendra cette branche inutile après la migration complète du Lot 2B.
  const { data: legacySession, error: legacyError } = await sb
    .from("user_sessions")
    .select(select)
    .eq("session_token", token)
    .maybeSingle();
  if (legacyError) throw legacyError;
  return (legacySession || null) as OmniaSessionRow | null;
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
    session_token: token,
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

  const { error: hashError } = await sb
    .from("user_sessions")
    .delete()
    .eq("session_token_hash", tokenHash);
  if (hashError) throw hashError;

  // Compatibilité transitoire pour les lignes sans hash antérieures à 162.
  const { error: legacyError } = await sb
    .from("user_sessions")
    .delete()
    .is("session_token_hash", null)
    .eq("session_token", token);
  if (legacyError) throw legacyError;
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
