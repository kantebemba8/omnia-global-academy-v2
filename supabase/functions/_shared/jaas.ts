import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { importPKCS8, SignJWT } from "npm:jose@5.9.6";

function env(name: string): string {
  return String(Deno.env.get(name) || "").trim();
}

function envFlag(name: string, fallback = false): boolean {
  const raw = env(name).toLowerCase();
  if (!raw) return fallback;
  return ["1", "true", "yes", "on"].includes(raw);
}

export function jaasConfigured(): boolean {
  return Boolean(env("JAAS_APP_ID") && env("JAAS_API_KEY_ID") && env("JAAS_PRIVATE_KEY"));
}

export function publicJitsiDevEnabled(): boolean {
  const explicit = env("ALLOW_PUBLIC_JITSI");
  if (explicit) return envFlag("ALLOW_PUBLIC_JITSI");
  // Compatibilité de développement uniquement : dès que les paiements Live
  // sont explicitement activés, le fallback public ne peut plus s'activer seul.
  return !envFlag("FEDAPAY_LIVE_ENABLED");
}

export type JaasMeetingAccess = {
  type: "jaas";
  domain: "8x8.vc";
  app_id: string;
  room_name: string;
  jwt: string;
  expires_at: string;
};

function normalizedPrivateKey(): string {
  return env("JAAS_PRIVATE_KEY").replace(/\\n/g, "\n");
}

export async function createJaasMeetingAccess(input: {
  roomName: string;
  userId: string;
  name?: string | null;
  email?: string | null;
  moderator?: boolean;
  expiresInSeconds?: number;
}): Promise<JaasMeetingAccess> {
  if (!jaasConfigured()) throw new Error("JAAS_NOT_CONFIGURED");
  const appId = env("JAAS_APP_ID");
  const keyId = env("JAAS_API_KEY_ID");
  const privateKey = await importPKCS8(normalizedPrivateKey(), "RS256");
  const now = Math.floor(Date.now() / 1000);
  const lifetime = Math.max(5 * 60, Math.min(12 * 60 * 60, Math.floor(input.expiresInSeconds || 2 * 60 * 60)));
  const exp = now + lifetime;
  const moderator = Boolean(input.moderator);

  const payload = {
    aud: "jitsi",
    iss: "chat",
    sub: appId,
    room: input.roomName,
    nbf: now - 10,
    exp,
    context: {
      user: {
        id: input.userId,
        name: String(input.name || "Participant Omnia").slice(0, 160),
        email: input.email ? String(input.email).slice(0, 254) : undefined,
        moderator: moderator ? "true" : "false",
      },
      features: {
        recording: moderator && envFlag("JAAS_RECORDING_ENABLED") ? "true" : "false",
        livestreaming: moderator && envFlag("JAAS_LIVESTREAMING_ENABLED") ? "true" : "false",
        transcription: moderator && envFlag("JAAS_TRANSCRIPTION_ENABLED") ? "true" : "false",
      },
    },
  };

  const jwt = await new SignJWT(payload)
    .setProtectedHeader({ alg: "RS256", kid: keyId, typ: "JWT" })
    .sign(privateKey);

  return {
    type: "jaas",
    domain: "8x8.vc",
    app_id: appId,
    room_name: input.roomName,
    jwt,
    expires_at: new Date(exp * 1000).toISOString(),
  };
}

export function jaasConfigurationStatus() {
  return {
    configured: jaasConfigured(),
    app_id_configured: Boolean(env("JAAS_APP_ID")),
    key_id_configured: Boolean(env("JAAS_API_KEY_ID")),
    private_key_configured: Boolean(env("JAAS_PRIVATE_KEY")),
    public_jitsi_development_fallback: publicJitsiDevEnabled(),
    production_ready: jaasConfigured(),
  };
}
