import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { calculateJwkThumbprint, compactVerify, decodeProtectedHeader, importJWK, SignJWT } from "npm:jose@5.9.6";
import QRCode from "npm:qrcode@1.5.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-omnia-session-token",
};

const json = (data: unknown, status = 200, extraHeaders: Record<string, string> = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
});

const textResponse = (value: string, contentType = "text/plain; charset=utf-8", extraHeaders: Record<string, string> = {}) => new Response(value, {
  status: 200,
  headers: { ...corsHeaders, "Content-Type": contentType, ...extraHeaders },
});

type Supabase = ReturnType<typeof createClient>;
type Session = { userId: string; roles: string[] };
type JsonRecord = Record<string, unknown>;

function text(value: unknown, max = 4000): string {
  return String(value ?? "").trim().slice(0, max);
}

function nullableText(value: unknown, max = 4000): string | null {
  const result = text(value, max);
  return result || null;
}

function integer(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function bool(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1 || value === "1") return true;
  if (value === "false" || value === 0 || value === "0") return false;
  return fallback;
}

function stringArray(value: unknown, maxItems = 30, maxLength = 80): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => text(item, maxLength)).filter(Boolean))].slice(0, maxItems);
}

function slugify(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "badge";
}

function validHttpUrl(value: string | null): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

async function authenticate(sb: Supabase, req: Request): Promise<Session | null> {
  const explicitToken = (req.headers.get("x-omnia-session-token") || "").trim();
  const bearerToken = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const token = explicitToken || bearerToken;
  if (!token) return null;
  const { data: current, error } = await sb.from("user_sessions")
    .select("user_id").eq("session_token", token).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (error || !current?.user_id) return null;
  const userId = String(current.user_id);
  const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", userId);
  return { userId, roles: (roles || []).map((row: { role: string }) => String(row.role)) };
}

function requireSession(session: Session | null): asserts session is Session {
  if (!session) throw new Error("UNAUTHENTICATED");
}

function requireAdmin(session: Session | null): asserts session is Session {
  if (!session?.roles.includes("super_admin")) throw new Error("FORBIDDEN");
}

async function audit(sb: Supabase, actorUserId: string, action: string, entityType: string, entityId: string | null, previousData: unknown, newData: unknown, metadata: JsonRecord = {}) {
  await sb.from("badge_audit_logs").insert({
    actor_user_id: actorUserId,
    action,
    entity_type: entityType,
    entity_id: entityId || null,
    previous_data: previousData,
    new_data: newData,
    metadata,
  });
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomToken(bytes = 32): string {
  const buffer = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(buffer).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function verificationCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = crypto.getRandomValues(new Uint8Array(14));
  return `OGA-${Array.from(values).map((value) => alphabet[value % alphabet.length]).join("")}`;
}

function appBaseUrl(): string {
  return (Deno.env.get("PUBLIC_APP_URL") || "https://omniaglobalacademy.com").replace(/\/+$/, "");
}

function functionBaseUrl(req: Request): string {
  const url = new URL(req.url);
  const marker = "/credentials";
  const markerIndex = url.pathname.indexOf(marker);
  const path = markerIndex >= 0 ? url.pathname.slice(0, markerIndex + marker.length) : url.pathname.replace(/\/+$/, "");
  return `${url.origin}${path}`;
}

function parseJwkSecret(name: string): JsonRecord | null {
  const raw = Deno.env.get(name);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as JsonRecord;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    throw new Error(`${name}_INVALID_JSON`);
  }
}

function publicRsaJwk(privateJwk: JsonRecord): JsonRecord {
  if (privateJwk.kty !== "RSA" || !privateJwk.n || !privateJwk.e || !privateJwk.d) throw new Error("SIGNING_PRIVATE_JWK_INVALID");
  return {
    kty: "RSA",
    n: privateJwk.n,
    e: privateJwk.e,
    alg: "RS256",
    use: "sig",
  };
}

async function signingConfiguration(req: Request) {
  const privateJwk = parseJwkSecret("CREDENTIALS_SIGNING_PRIVATE_JWK");
  if (!privateJwk) throw new Error("SIGNING_NOT_CONFIGURED");
  const publicJwk = publicRsaJwk(privateJwk);
  const thumbprint = await calculateJwkThumbprint(publicJwk as never, "sha256");
  const keyId = (Deno.env.get("CREDENTIALS_SIGNING_KEY_ID") || `${functionBaseUrl(req)}/keys/${thumbprint}`).trim();
  if (!validHttpUrl(keyId)) throw new Error("SIGNING_KEY_ID_INVALID");
  return { privateJwk, publicJwk: { ...publicJwk, kid: keyId }, thumbprint, keyId, algorithm: "RS256" as const };
}

function signingConfigured(): boolean {
  try {
    const privateJwk = parseJwkSecret("CREDENTIALS_SIGNING_PRIVATE_JWK");
    return Boolean(privateJwk?.kty === "RSA" && privateJwk.n && privateJwk.e && privateJwk.d);
  } catch {
    return false;
  }
}

async function syncSigningKey(sb: Supabase, req: Request, actorUserId?: string | null) {
  const issuer = await getIssuer(sb);
  const config = await signingConfiguration(req);
  const { data: current, error: currentError } = await sb.from("credential_signing_keys")
    .select("*").eq("key_id_uri", config.keyId).maybeSingle();
  if (currentError) throw currentError;
  if (current?.id) {
    const { error: retireError } = await sb.from("credential_signing_keys").update({ status: "retired", valid_until: new Date().toISOString() })
      .eq("issuer_id", issuer.id).eq("status", "active").neq("id", current.id);
    if (retireError) throw retireError;
    const { data, error } = await sb.from("credential_signing_keys").update({
      public_jwk: config.publicJwk,
      jwk_thumbprint: config.thumbprint,
      algorithm: config.algorithm,
      status: "active",
      valid_until: null,
    }).eq("id", current.id).select("*").single();
    if (error) throw error;
    await sb.from("credential_issuers").update({
      public_key_set_uri: `${functionBaseUrl(req)}/keys`,
      verification_method: { type: "JsonWebKey2020", controller: issuer.did || issuer.issuer_uri, publicKeyJwk: config.publicJwk, id: config.keyId },
      last_key_sync_at: new Date().toISOString(),
    }).eq("id", issuer.id);
    return data as JsonRecord;
  }
  await sb.from("credential_signing_keys").update({ status: "retired", valid_until: new Date().toISOString() })
    .eq("issuer_id", issuer.id).eq("status", "active");
  const { data, error } = await sb.from("credential_signing_keys").insert({
    issuer_id: issuer.id,
    key_name: `Omnia RS256 ${new Date().toISOString().slice(0, 10)}`,
    key_id_uri: config.keyId,
    algorithm: config.algorithm,
    public_jwk: config.publicJwk,
    jwk_thumbprint: config.thumbprint,
    status: "active",
    created_by: actorUserId || null,
  }).select("*").single();
  if (error) throw error;
  await sb.from("credential_issuers").update({
    public_key_set_uri: `${functionBaseUrl(req)}/keys`,
    verification_method: { type: "JsonWebKey2020", controller: issuer.did || issuer.issuer_uri, publicKeyJwk: config.publicJwk, id: config.keyId },
    last_key_sync_at: new Date().toISOString(),
  }).eq("id", issuer.id);
  return data as JsonRecord;
}

function numericDate(value: string): number {
  return Math.floor(new Date(value).getTime() / 1000);
}

function signedPayloadFromCredential(credential: JsonRecord): JsonRecord {
  const issuer = credential.issuer as JsonRecord | undefined;
  const subject = credential.credentialSubject as JsonRecord | undefined;
  const validFrom = text(credential.validFrom, 80);
  if (!credential.id || !issuer?.id || !subject?.id || !validFrom) throw new Error("CREDENTIAL_STRUCTURE_INVALID");
  const payload: JsonRecord = {
    ...credential,
    iss: issuer.id,
    jti: credential.id,
    sub: subject.id,
    nbf: numericDate(validFrom),
  };
  if (credential.validUntil) payload.exp = numericDate(String(credential.validUntil));
  return payload;
}

async function signCredential(credential: JsonRecord, req: Request) {
  const config = await signingConfiguration(req);
  const privateKey = await importJWK(config.privateJwk as never, "RS256");
  const payload = signedPayloadFromCredential(credential);
  const compactJws = await new SignJWT(payload)
    .setProtectedHeader({ alg: "RS256", kid: config.keyId, typ: "JWT" })
    .sign(privateKey);
  return { compactJws, payload, config };
}

async function signingKeyForHeader(sb: Supabase, header: JsonRecord, req: Request) {
  if (header.alg !== "RS256") throw new Error("UNSUPPORTED_SIGNING_ALGORITHM");
  if (header.typ && header.typ !== "JWT") throw new Error("INVALID_JWT_TYPE");
  const embedded = header.jwk as JsonRecord | undefined;
  if (embedded) {
    if (embedded.d) throw new Error("PRIVATE_JWK_EXPOSED");
    return { publicJwk: embedded, key: null as JsonRecord | null };
  }
  const kid = text(header.kid, 1200);
  if (!kid) throw new Error("SIGNING_KEY_MISSING");
  const { data: stored, error } = await sb.from("credential_signing_keys").select("*").eq("key_id_uri", kid).maybeSingle();
  if (error) throw error;
  if (stored?.status === "revoked") throw new Error("SIGNING_KEY_REVOKED");
  if (stored?.public_jwk) return { publicJwk: stored.public_jwk as JsonRecord, key: stored as JsonRecord };
  const config = await signingConfiguration(req).catch(() => null);
  if (config && config.keyId === kid) return { publicJwk: config.publicJwk, key: null as JsonRecord | null };
  throw new Error("SIGNING_KEY_NOT_TRUSTED");
}

function credentialStructureChecks(payload: JsonRecord) {
  const contexts = Array.isArray(payload["@context"]) ? payload["@context"].map(String) : [];
  const types = Array.isArray(payload.type) ? payload.type.map(String) : [];
  const issuer = payload.issuer as JsonRecord | undefined;
  const subject = payload.credentialSubject as JsonRecord | undefined;
  const schema = Array.isArray(payload.credentialSchema) ? payload.credentialSchema as JsonRecord[] : [];
  const validFrom = text(payload.validFrom, 80);
  const checks = {
    context: contexts.includes("https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json"),
    type: types.includes("OpenBadgeCredential") && types.includes("VerifiableCredential"),
    issuer: Boolean(issuer?.id && payload.iss === issuer.id),
    subject: Boolean(subject?.id && payload.sub === subject.id),
    credential_id: Boolean(payload.id && payload.jti === payload.id),
    valid_from: Boolean(validFrom && Number(payload.nbf) === numericDate(validFrom)),
    valid_until: !payload.validUntil || Number(payload.exp) === numericDate(String(payload.validUntil)),
    schema: schema.some((item) => String(item.id || "").includes("ob_v3p0_achievementcredential_schema.json")),
  };
  return { checks, valid: Object.values(checks).every(Boolean) };
}

async function verifyCompactCredential(sb: Supabase, compactJws: string, req: Request, award: JsonRecord | null, source: string) {
  let signatureValid = false;
  let structureValid = false;
  let statusValid = false;
  let errorCode: string | null = null;
  let payload: JsonRecord = {};
  let header: JsonRecord = {};
  let keyRow: JsonRecord | null = null;
  let structureChecks: JsonRecord = {};
  try {
    header = decodeProtectedHeader(compactJws) as JsonRecord;
    const keyResult = await signingKeyForHeader(sb, header, req);
    keyRow = keyResult.key;
    const publicKey = await importJWK(keyResult.publicJwk as never, "RS256");
    const verified = await compactVerify(compactJws, publicKey, { algorithms: ["RS256"] });
    signatureValid = true;
    payload = JSON.parse(new TextDecoder().decode(verified.payload)) as JsonRecord;
    const structure = credentialStructureChecks(payload);
    structureValid = structure.valid;
    structureChecks = structure.checks;
    if (!structureValid) errorCode = "CREDENTIAL_STRUCTURE_INVALID";
    const now = Date.now();
    const notBeforeValid = !payload.validFrom || new Date(String(payload.validFrom)).getTime() <= now;
    const expirationValid = !payload.validUntil || new Date(String(payload.validUntil)).getTime() >= now;
    const registryStatus = award ? String(award.status) : "awarded";
    statusValid = notBeforeValid && expirationValid && registryStatus === "awarded";
    if (!statusValid && !errorCode) errorCode = registryStatus !== "awarded" ? `CREDENTIAL_${registryStatus.toUpperCase()}` : "CREDENTIAL_EXPIRED_OR_NOT_YET_VALID";
    if (award) {
      const storedHash = text(award.credential_hash, 128);
      const actualHash = await sha256(compactJws);
      if (storedHash && storedHash !== actualHash) {
        statusValid = false;
        errorCode = "CREDENTIAL_HASH_MISMATCH";
      }
      if (payload.jti !== (award.credential_json as JsonRecord | undefined)?.id) {
        structureValid = false;
        errorCode = "CREDENTIAL_REGISTRY_MISMATCH";
      }
    }
  } catch (error) {
    errorCode = error instanceof Error ? error.message : "SIGNATURE_INVALID";
  }
  const result = {
    signature_valid: signatureValid,
    structure_valid: structureValid,
    status_valid: statusValid,
    overall_valid: signatureValid && structureValid && statusValid,
    error_code: errorCode,
    protected_header: header,
    credential: payload,
    structure_checks: structureChecks,
    checked_at: new Date().toISOString(),
  };
  if (award?.id) {
    await sb.from("credential_verification_events").insert({
      award_id: award.id,
      signing_key_id: keyRow?.id || award.signing_key_id || null,
      verification_source: ["public_page","admin","learner","api","export","internal"].includes(source) ? source : "api",
      signature_valid: signatureValid,
      structure_valid: structureValid,
      status_valid: statusValid,
      overall_valid: result.overall_valid,
      error_code: errorCode,
      result,
    });
    await sb.from("badge_awards").update({ last_verified_at: result.checked_at, verification_result: result }).eq("id", award.id);
  }
  return result;
}

async function getIssuer(sb: Supabase, issuerId?: string | null) {
  let query = sb.from("credential_issuers").select("*");
  query = issuerId ? query.eq("id", issuerId) : query.eq("code", "omnia-global-academy");
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("ISSUER_NOT_FOUND");
  return data as JsonRecord;
}

async function getOrCreateClr(sb: Supabase, userId: string) {
  const { data: existing, error } = await sb.from("clr_records").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (existing) return existing as JsonRecord;
  const { data, error: insertError } = await sb.from("clr_records")
    .insert({ user_id: userId, title: "Omnia Learning Record", description: "Dossier vérifié des réalisations Omnia." })
    .select("*").single();
  if (insertError) throw insertError;
  return data as JsonRecord;
}

async function rebuildClr(sb: Supabase, userId: string) {
  const record = await getOrCreateClr(sb, userId);
  const { data: achievements, error: achievementError } = await sb.from("clr_achievements")
    .select("*").eq("clr_record_id", record.id).order("issued_at", { ascending: false });
  if (achievementError) throw achievementError;
  const payload = {
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      "https://purl.imsglobal.org/spec/clr/v2p0/context-2.0.1.json",
      "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json",
    ],
    id: `urn:uuid:${record.record_uuid}`,
    type: ["VerifiableCredential", "ClrCredential"],
    name: String(record.title || "Omnia Learning Record"),
    issuer: { id: "https://omniaglobalacademy.com/credentials/issuers/omnia-global-academy", type: ["Profile"], name: "Omnia Global Academy" },
    credentialSubject: {
      id: `urn:uuid:${record.record_uuid}`,
      type: ["ClrSubject"],
      verifiableCredential: (achievements || []).filter((row: JsonRecord) => row.status !== "hidden").map((row: JsonRecord) => row.payload),
    },
    validFrom: String(record.created_at || new Date().toISOString()),
    credentialSchema: [{
      id: "https://purl.imsglobal.org/spec/clr/v2p0/schema/json/clr_v2p0_clrcredential_schema.json",
      type: "1EdTechJsonSchemaValidator2019",
    }],
  };
  const unchanged = JSON.stringify(record.clr_json || {}) === JSON.stringify(payload);
  if (unchanged) return { record, achievements: achievements || [] };
  const nextVersion = record.last_built_at ? Number(record.version || 1) + 1 : Number(record.version || 1);
  const { data: updated, error: updateError } = await sb.from("clr_records")
    .update({ clr_json: payload, standards_status: "clr2_draft", version: nextVersion, last_built_at: new Date().toISOString() })
    .eq("id", record.id).select("*").single();
  if (updateError) throw updateError;
  return { record: updated, achievements: achievements || [] };
}

async function templateRows(sb: Supabase, includeInactive = true) {
  let query = sb.from("badge_templates")
    .select("*,issuer:credential_issuers(*),category:badge_categories(*),level:badge_levels(*)")
    .order("created_at", { ascending: false });
  if (!includeInactive) query = query.eq("status", "active");
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function awardRows(sb: Supabase, recipientUserId?: string) {
  let query = sb.from("badge_awards")
    .select("*,template:badge_templates(*,category:badge_categories(*),level:badge_levels(*)),issuer:credential_issuers(*),recipient:users!badge_awards_recipient_user_id_fkey(id,full_name,email,avatar_url)")
    .order("issued_at", { ascending: false });
  if (recipientUserId) query = query.eq("recipient_user_id", recipientUserId);
  const { data, error } = await query;
  if (error) throw error;
  const rows = data || [];
  const awardIds = rows.map((row: JsonRecord) => String(row.id));
  const { data: evidence, error: evidenceError } = awardIds.length
    ? await sb.from("badge_evidence").select("*").in("award_id", awardIds).order("created_at")
    : { data: [], error: null };
  if (evidenceError) throw evidenceError;
  const map = new Map<string, JsonRecord[]>();
  for (const item of evidence || []) {
    const key = String(item.award_id);
    map.set(key, [...(map.get(key) || []), item as JsonRecord]);
  }
  return rows.map((row: JsonRecord) => ({ ...row, evidence: map.get(String(row.id)) || [] }));
}

function publicAward(row: JsonRecord) {
  const recipient = row.recipient as JsonRecord | null;
  const template = row.template as JsonRecord | null;
  const issuer = row.issuer as JsonRecord | null;
  const category = template?.category as JsonRecord | null;
  const level = template?.level as JsonRecord | null;
  return {
    id: row.id,
    credential_uuid: row.credential_uuid,
    verification_code: row.verification_code,
    status: row.status,
    visibility: row.visibility,
    source_type: row.source_type,
    evidence_summary: row.evidence_summary,
    issued_at: row.issued_at,
    expires_at: row.expires_at,
    revoked_at: row.revoked_at,
    revocation_reason: row.revocation_reason,
    standards_status: row.standards_status,
    signed_at: row.signed_at,
    signature_alg: row.signature_alg,
    credential_media_type: row.credential_media_type,
    credential_hash: row.credential_hash,
    last_verified_at: row.last_verified_at,
    verification_result: row.verification_result,
    credential_jwt_available: Boolean(row.credential_jwt),
    credential_json: row.credential_json,
    template: template ? {
      id: template.id, code: template.code, name: template.name, description: template.description, image_url: template.image_url,
      achievement_type: template.achievement_type, criteria_narrative: template.criteria_narrative, validity_days: template.validity_days,
      achievement_uri: template.achievement_uri,
      category: category ? { id: category.id, slug: category.slug, name: category.name, description: category.description, category_type: category.category_type } : null,
      level: level ? { id: level.id, slug: level.slug, name: level.name, description: level.description, rank: level.rank, color: level.color } : null,
    } : null,
    issuer: issuer ? { id: issuer.id, code: issuer.code, name: issuer.name, description: issuer.description, website_url: issuer.website_url, email: issuer.email, logo_url: issuer.logo_url, issuer_uri: issuer.issuer_uri, did: issuer.did } : null,
    recipient: recipient ? { full_name: recipient.full_name, avatar_url: recipient.avatar_url } : null,
    evidence: (row.evidence as JsonRecord[] || []).filter((item) => item.is_public).map((item) => ({
      id: item.id, evidence_type: item.evidence_type, title: item.title, description: item.description, url: item.url,
    })),
  };
}

async function publicBadge(sb: Supabase, identifier: string) {
  const baseQuery = sb.from("badge_awards")
    .select("*,template:badge_templates(*,category:badge_categories(*),level:badge_levels(*)),issuer:credential_issuers(*),recipient:users!badge_awards_recipient_user_id_fkey(id,full_name,avatar_url)");
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier);
  const { data, error } = await (isUuid
    ? baseQuery.eq("credential_uuid", identifier)
    : baseQuery.eq("verification_code", identifier.toUpperCase()))
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("BADGE_NOT_FOUND");
  if (data.visibility !== "public") throw new Error("BADGE_NOT_PUBLIC");
  const { data: evidence } = await sb.from("badge_evidence").select("*").eq("award_id", data.id).eq("is_public", true).order("created_at");
  return publicAward({ ...data, evidence: evidence || [] });
}

async function publicClr(sb: Supabase, token: string) {
  const tokenHash = await sha256(token);
  const { data: share, error } = await sb.from("clr_shares").select("*").eq("token_hash", tokenHash).maybeSingle();
  if (error) throw error;
  if (!share || share.revoked_at || (share.expires_at && new Date(share.expires_at) <= new Date())) throw new Error("CLR_SHARE_NOT_FOUND");
  const { data: record, error: recordError } = await sb.from("clr_records").select("*,user:users(id,full_name,avatar_url)").eq("id", share.clr_record_id).maybeSingle();
  if (recordError) throw recordError;
  if (!record) throw new Error("CLR_NOT_FOUND");
  const allowed = new Set(stringArray(share.include_sections, 30, 80));
  const { data: achievements, error: achievementError } = await sb.from("clr_achievements")
    .select("*").eq("clr_record_id", record.id).in("visibility", [share.visibility_filter, "public"]).order("issued_at", { ascending: false });
  if (achievementError) throw achievementError;
  await sb.from("clr_shares").update({ last_accessed_at: new Date().toISOString() }).eq("id", share.id);
  return {
    record: { record_uuid: record.record_uuid, title: record.title, description: record.description, version: record.version, standards_status: record.standards_status, user: record.user ? { full_name: record.user.full_name, avatar_url: record.user.avatar_url } : null },
    achievements: (achievements || []).filter((row: JsonRecord) => !allowed.size || allowed.has(String(row.section))).map((row: JsonRecord) => ({
      id: row.id, title: row.title, description: row.description, achievement_type: row.achievement_type, section: row.section, status: row.status, visibility: row.visibility, issued_at: row.issued_at,
    })),
  };
}

async function saveTemplate(sb: Supabase, session: Session, body: JsonRecord) {
  const id = nullableText(body.id, 80);
  const name = text(body.name, 160);
  const description = text(body.description, 2500);
  const criteriaNarrative = text(body.criteria_narrative, 3000);
  const categoryId = text(body.category_id, 80);
  const issuerId = text(body.issuer_id, 80);
  const imageUrl = nullableText(body.image_url, 1000);
  if (!name || !description || !criteriaNarrative || !categoryId || !issuerId || !validHttpUrl(imageUrl)) throw new Error("TEMPLATE_INCOMPLETE");
  const code = slugify(text(body.code, 120) || name);
  const achievementUri = nullableText(body.achievement_uri, 1000) || `https://omniaglobalacademy.com/credentials/achievements/${code}`;
  const sourceTypes = stringArray(body.source_types, 20, 80);
  const allowedRoles = stringArray(body.allowed_issuer_roles, 20, 80);
  const defaultVisibility = text(body.default_visibility, 30) || "oga";
  if (!["private","oga","recruiters","structure","public"].includes(defaultVisibility)) throw new Error("INVALID_VISIBILITY");
  if (bool(body.internal_only) && defaultVisibility === "public") throw new Error("INTERNAL_BADGE_CANNOT_BE_PUBLIC");
  const status = text(body.status, 30) || "draft";
  if (!["draft","pending_validation","active","inactive","archived"].includes(status)) throw new Error("INVALID_STATUS");
  const payload = {
    code,
    issuer_id: issuerId,
    category_id: categoryId,
    level_id: nullableText(body.level_id, 80),
    name,
    description,
    image_url: imageUrl,
    achievement_type: text(body.achievement_type, 80) || "Achievement",
    criteria_narrative: criteriaNarrative,
    evidence_required: bool(body.evidence_required),
    validity_days: integer(body.validity_days),
    default_visibility: defaultVisibility,
    allowed_issuer_roles: allowedRoles.length ? allowedRoles : ["super_admin"],
    source_types: sourceTypes.length ? sourceTypes : ["manual"],
    internal_only: bool(body.internal_only),
    automatic_enabled: bool(body.automatic_enabled),
    status,
    achievement_uri: achievementUri,
    metadata: typeof body.metadata === "object" && body.metadata !== null ? body.metadata : {},
    updated_by: session.userId,
    ...(id ? {} : { created_by: session.userId }),
  };
  const previous = id ? (await sb.from("badge_templates").select("*").eq("id", id).maybeSingle()).data : null;
  const result = id
    ? await sb.from("badge_templates").update(payload).eq("id", id).select("*").single()
    : await sb.from("badge_templates").insert(payload).select("*").single();
  if (result.error) throw result.error;
  await audit(sb, session.userId, id ? "template_updated" : "template_created", "badge_template", String(result.data.id), previous, result.data);
  return result.data;
}

async function saveCategory(sb: Supabase, session: Session, body: JsonRecord) {
  const id = nullableText(body.id, 80);
  const name = text(body.name, 120);
  if (!name) throw new Error("CATEGORY_NAME_REQUIRED");
  const categoryType = text(body.category_type, 30) || "achievement";
  if (!["skill","achievement","trust","community","internal"].includes(categoryType)) throw new Error("INVALID_CATEGORY_TYPE");
  const payload = {
    slug: slugify(text(body.slug, 120) || name), name, description: nullableText(body.description, 1000),
    category_type: categoryType, display_order: integer(body.display_order) || 0, is_active: body.is_active === undefined ? true : bool(body.is_active),
    ...(id ? {} : { created_by: session.userId }),
  };
  const previous = id ? (await sb.from("badge_categories").select("*").eq("id", id).maybeSingle()).data : null;
  const result = id ? await sb.from("badge_categories").update(payload).eq("id", id).select("*").single() : await sb.from("badge_categories").insert(payload).select("*").single();
  if (result.error) throw result.error;
  await audit(sb, session.userId, id ? "category_updated" : "category_created", "badge_category", String(result.data.id), previous, result.data);
  return result.data;
}

async function saveLevel(sb: Supabase, session: Session, body: JsonRecord) {
  const id = nullableText(body.id, 80);
  const name = text(body.name, 120);
  if (!name) throw new Error("LEVEL_NAME_REQUIRED");
  const color = text(body.color, 20) || "#002050";
  const payload = {
    slug: slugify(text(body.slug, 120) || name), name, description: nullableText(body.description, 1000),
    rank: integer(body.rank) || 0, color, is_active: body.is_active === undefined ? true : bool(body.is_active),
    ...(id ? {} : { created_by: session.userId }),
  };
  const previous = id ? (await sb.from("badge_levels").select("*").eq("id", id).maybeSingle()).data : null;
  const result = id ? await sb.from("badge_levels").update(payload).eq("id", id).select("*").single() : await sb.from("badge_levels").insert(payload).select("*").single();
  if (result.error) throw result.error;
  await audit(sb, session.userId, id ? "level_updated" : "level_created", "badge_level", String(result.data.id), previous, result.data);
  return result.data;
}

async function saveIssuer(sb: Supabase, session: Session, body: JsonRecord) {
  const id = nullableText(body.id, 80);
  const name = text(body.name, 160);
  const issuerUri = text(body.issuer_uri, 1000);
  const websiteUrl = nullableText(body.website_url, 1000);
  const logoUrl = nullableText(body.logo_url, 1000);
  if (!name || !issuerUri || !validHttpUrl(issuerUri) || !validHttpUrl(websiteUrl) || !validHttpUrl(logoUrl)) throw new Error("ISSUER_INCOMPLETE");
  const issuerType = text(body.issuer_type, 30) || "external";
  if (!["platform","structure","external"].includes(issuerType)) throw new Error("INVALID_ISSUER_TYPE");
  const status = text(body.status, 30) || "draft";
  if (!["draft","active","suspended","archived"].includes(status)) throw new Error("INVALID_STATUS");
  const payload = {
    code: slugify(text(body.code, 120) || name), name, description: nullableText(body.description, 1200), issuer_type: issuerType,
    website_url: websiteUrl, email: nullableText(body.email, 255), logo_url: logoUrl, issuer_uri: issuerUri,
    did: nullableText(body.did, 1000), status, ...(id ? {} : { created_by: session.userId }),
  };
  const previous = id ? (await sb.from("credential_issuers").select("*").eq("id", id).maybeSingle()).data : null;
  const result = id ? await sb.from("credential_issuers").update(payload).eq("id", id).select("*").single() : await sb.from("credential_issuers").insert(payload).select("*").single();
  if (result.error) throw result.error;
  await audit(sb, session.userId, id ? "issuer_updated" : "issuer_created", "credential_issuer", String(result.data.id), previous, result.data);
  return result.data;
}

async function issueBadge(sb: Supabase, session: Session, body: JsonRecord, req: Request) {
  const templateId = text(body.template_id, 80);
  const recipientEmail = text(body.recipient_email, 255).toLowerCase();
  if (!templateId || !recipientEmail) throw new Error("AWARD_INCOMPLETE");
  const [{ data: template, error: templateError }, { data: recipient, error: recipientError }] = await Promise.all([
    sb.from("badge_templates").select("*,category:badge_categories(*),level:badge_levels(*)").eq("id", templateId).eq("status", "active").maybeSingle(),
    sb.from("users").select("id,email,full_name,avatar_url").ilike("email", recipientEmail).maybeSingle(),
  ]);
  if (templateError) throw templateError;
  if (recipientError) throw recipientError;
  if (!template) throw new Error("TEMPLATE_NOT_ACTIVE");
  if (!recipient) throw new Error("RECIPIENT_NOT_FOUND");
  const issuer = await getIssuer(sb, String(template.issuer_id));
  const sourceType = text(body.source_type, 80) || "manual";
  const sourceId = nullableText(body.source_id, 80);
  const evidence = Array.isArray(body.evidence) ? body.evidence as JsonRecord[] : [];
  if (template.evidence_required && !evidence.length && !text(body.evidence_summary, 2000)) throw new Error("EVIDENCE_REQUIRED");
  const code = verificationCode();
  const issuedAt = new Date();
  const validityDays = template.validity_days === null || template.validity_days === undefined ? null : Number(template.validity_days);
  const expiresAt = validityDays ? new Date(issuedAt.getTime() + validityDays * 86400000).toISOString() : null;
  const credentialUuid = crypto.randomUUID();
  const recipientSubjectId = `urn:uuid:${crypto.randomUUID()}`;
  const credentialId = `https://omniaglobalacademy.com/credentials/badges/${credentialUuid}`;
  const achievement = {
    id: template.achievement_uri,
    type: ["Achievement"],
    achievementType: template.achievement_type,
    name: template.name,
    description: template.description,
    criteria: { narrative: template.criteria_narrative },
    ...(template.image_url ? { image: { id: template.image_url, type: "Image", caption: template.name } } : {}),
    creator: { id: issuer.issuer_uri, type: ["Profile"], name: issuer.name, url: issuer.website_url, email: issuer.email },
  };
  const credential = {
    "@context": ["https://www.w3.org/ns/credentials/v2", "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json"],
    id: credentialId,
    type: ["VerifiableCredential", "OpenBadgeCredential"],
    name: template.name,
    issuer: { id: issuer.did || issuer.issuer_uri, type: ["Profile"], name: issuer.name, url: issuer.website_url, email: issuer.email },
    validFrom: issuedAt.toISOString(),
    ...(expiresAt ? { validUntil: expiresAt } : {}),
    credentialSubject: { id: recipientSubjectId, type: ["AchievementSubject"], achievement },
    credentialSchema: [{ id: "https://purl.imsglobal.org/spec/ob/v3p0/schema/json/ob_v3p0_achievementcredential_schema.json", type: "1EdTechJsonSchemaValidator2019" }],
    refreshService: { id: `${functionBaseUrl(req)}/badges/${code}/refresh`, type: "1EdTechCredentialRefresh" },
    evidence: evidence.filter((item) => bool(item.is_public)).map((item) => {
      const evidenceUrl = nullableText(item.url, 1000);
      if (!validHttpUrl(evidenceUrl)) throw new Error("INVALID_EVIDENCE_URL");
      return { ...(evidenceUrl ? { id: evidenceUrl } : {}), type: ["Evidence"], name: text(item.title, 180), description: nullableText(item.description, 1000) };
    }).filter((item) => item.name),
  };
  const visibility = text(body.visibility, 30) || String(template.default_visibility || "oga");
  if (!["private","oga","recruiters","structure","public"].includes(visibility)) throw new Error("INVALID_VISIBILITY");
  if (template.internal_only && visibility === "public") throw new Error("INTERNAL_BADGE_CANNOT_BE_PUBLIC");
  const { data: award, error: awardError } = await sb.from("badge_awards").insert({
    credential_uuid: credentialUuid,
    verification_code: code,
    template_id: template.id,
    issuer_id: issuer.id,
    recipient_user_id: recipient.id,
    awarded_by: session.userId,
    source_type: sourceType,
    source_id: sourceId,
    visibility,
    evidence_summary: nullableText(body.evidence_summary, 2000),
    issued_at: issuedAt.toISOString(),
    expires_at: expiresAt,
    recipient_subject_id: recipientSubjectId,
    standards_status: "ob3_draft",
    credential_json: credential,
  }).select("*").single();
  if (awardError) throw awardError;
  if (evidence.length) {
    const rows = evidence.slice(0, 20).map((item) => ({
      award_id: award.id,
      evidence_type: text(item.evidence_type, 80) || "other",
      title: text(item.title, 180),
      description: nullableText(item.description, 1200),
      url: nullableText(item.url, 1000),
      source_table: nullableText(item.source_table, 120),
      source_record_id: nullableText(item.source_record_id, 80),
      is_public: bool(item.is_public),
      created_by: session.userId,
    })).filter((item) => item.title);
    if (rows.length) {
      const { error } = await sb.from("badge_evidence").insert(rows);
      if (error) throw error;
    }
  }
  const clr = await getOrCreateClr(sb, String(recipient.id));
  const section = template.category?.category_type === "community" ? "engagement_communautaire" : template.category?.category_type === "skill" ? "competences_verifiees" : "badges";
  const { error: clrItemError } = await sb.from("clr_achievements").insert({
    clr_record_id: clr.id,
    award_id: award.id,
    source_type: "badge",
    source_id: award.id,
    title: template.name,
    description: template.description,
    achievement_type: template.achievement_type,
    section,
    status: "active",
    visibility,
    issued_at: issuedAt.toISOString(),
    payload: credential,
  });
  if (clrItemError) throw clrItemError;
  await rebuildClr(sb, String(recipient.id));
  let finalAward = award as JsonRecord;
  if (!template.internal_only && signingConfigured()) {
    finalAward = await signAwardById(sb, session.userId, String(award.id), req);
  }
  await audit(sb, session.userId, "badge_awarded", "badge_award", String(award.id), null, finalAward, { recipient_email: recipient.email });
  return finalAward;
}

async function awardForSigning(sb: Supabase, awardId: string) {
  const { data: award, error } = await sb.from("badge_awards")
    .select("*,template:badge_templates(*,category:badge_categories(*),level:badge_levels(*)),issuer:credential_issuers(*),recipient:users!badge_awards_recipient_user_id_fkey(id,full_name,email,avatar_url)")
    .eq("id", awardId).maybeSingle();
  if (error) throw error;
  if (!award) throw new Error("BADGE_NOT_FOUND");
  const { data: evidence, error: evidenceError } = await sb.from("badge_evidence").select("*")
    .eq("award_id", awardId).eq("is_public", true).order("created_at");
  if (evidenceError) throw evidenceError;
  return { ...(award as JsonRecord), evidence: evidence || [] } as JsonRecord;
}

function credentialWithCurrentEvidence(award: JsonRecord, req: Request): JsonRecord {
  const template = award.template as JsonRecord | undefined;
  const issuer = award.issuer as JsonRecord | undefined;
  const stored = { ...((award.credential_json as JsonRecord | undefined) || {}) };
  const subjectId = text(award.recipient_subject_id, 1000)
    || text((stored.credentialSubject as JsonRecord | undefined)?.id, 1000)
    || `urn:uuid:${crypto.randomUUID()}`;
  const evidence = ((award.evidence as JsonRecord[] | undefined) || []).map((item) => ({
    ...(item.url ? { id: item.url } : {}),
    type: ["Evidence"],
    name: item.title,
    description: item.description || undefined,
  }));
  return {
    ...stored,
    id: stored.id || `${appBaseUrl()}/credentials/badges/${award.credential_uuid}`,
    type: ["VerifiableCredential", "OpenBadgeCredential"],
    name: stored.name || template?.name || "Badge Omnia",
    issuer: {
      id: issuer?.did || issuer?.issuer_uri,
      type: ["Profile"],
      name: issuer?.name,
      ...(issuer?.website_url ? { url: issuer.website_url } : {}),
      ...(issuer?.email ? { email: issuer.email } : {}),
    },
    credentialSubject: {
      ...((stored.credentialSubject as JsonRecord | undefined) || {}),
      id: subjectId,
      type: ["AchievementSubject"],
    },
    refreshService: { id: `${functionBaseUrl(req)}/badges/${award.verification_code}/refresh`, type: "1EdTechCredentialRefresh" },
    evidence,
  };
}

async function signAwardById(sb: Supabase, actorUserId: string | null, awardId: string, req: Request) {
  const award = await awardForSigning(sb, awardId);
  const template = award.template as JsonRecord | undefined;
  if (template?.internal_only) throw new Error("INTERNAL_BADGE_NOT_SIGNABLE");
  if (award.status !== "awarded") throw new Error("BADGE_NOT_ACTIVE");
  const keyRow = await syncSigningKey(sb, req, actorUserId);
  const credential = credentialWithCurrentEvidence(award, req);
  const signed = await signCredential(credential, req);
  const preflight = await verifyCompactCredential(sb, signed.compactJws, req, null, "internal");
  if (!preflight.signature_valid || !preflight.structure_valid) throw new Error(preflight.error_code || "SIGNED_CREDENTIAL_PREFLIGHT_FAILED");
  const credentialHash = await sha256(signed.compactJws);
  const subjectId = text((signed.payload.credentialSubject as JsonRecord | undefined)?.id, 1000);
  const signedAt = new Date().toISOString();
  const { data: updated, error } = await sb.from("badge_awards").update({
    recipient_subject_id: subjectId,
    standards_status: "ob3_signed",
    credential_json: signed.payload,
    credential_jwt: signed.compactJws,
    signing_key_id: keyRow.id,
    signed_at: signedAt,
    signature_alg: "RS256",
    credential_media_type: "text/plain",
    credential_hash: credentialHash,
  }).eq("id", awardId).select("*").single();
  if (error) throw error;
  await sb.from("clr_achievements").update({ payload: signed.payload }).eq("award_id", awardId);
  await rebuildClr(sb, String(award.recipient_user_id));
  const verification = await verifyCompactCredential(sb, signed.compactJws, req, { ...award, ...updated, credential_json: signed.payload }, "internal");
  if (!verification.overall_valid) throw new Error(verification.error_code || "SIGNED_CREDENTIAL_VERIFICATION_FAILED");
  if (actorUserId) await audit(sb, actorUserId, "badge_signed", "badge_award", awardId, award, updated, { key_id: signed.config.keyId, algorithm: "RS256" });
  return { ...updated, verification_result: verification } as JsonRecord;
}

async function signUnsignedAwards(sb: Supabase, session: Session, req: Request, limitValue: number) {
  const limit = Math.min(250, Math.max(1, limitValue || 100));
  const { data, error } = await sb.from("badge_awards")
    .select("id,template:badge_templates(internal_only)")
    .eq("status", "awarded")
    .neq("standards_status", "ob3_signed")
    .order("issued_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  const results: JsonRecord[] = [];
  for (const row of data || []) {
    const template = row.template as unknown as JsonRecord | null;
    if (template?.internal_only) continue;
    try {
      const signed = await signAwardById(sb, session.userId, String(row.id), req);
      results.push({ id: row.id, success: true, signed_at: signed.signed_at });
    } catch (cause) {
      results.push({ id: row.id, success: false, error: cause instanceof Error ? cause.message : "SIGNING_FAILED" });
    }
  }
  return results;
}

async function signingStatus(sb: Supabase, req: Request) {
  const [keyResult, signed, drafts, verificationEvents] = await Promise.all([
    sb.from("credential_signing_keys").select("*").order("created_at", { ascending: false }),
    sb.from("badge_awards").select("id", { count: "exact", head: true }).eq("standards_status", "ob3_signed"),
    sb.from("badge_awards").select("id", { count: "exact", head: true }).eq("status", "awarded").neq("standards_status", "ob3_signed"),
    sb.from("credential_verification_events").select("id", { count: "exact", head: true }),
  ]);
  if (keyResult.error) throw keyResult.error;
  let currentKey: JsonRecord | null = null;
  let configError: string | null = null;
  if (signingConfigured()) {
    try {
      const config = await signingConfiguration(req);
      currentKey = (keyResult.data || []).find((item: JsonRecord) => item.key_id_uri === config.keyId) || null;
    } catch (cause) {
      configError = cause instanceof Error ? cause.message : "SIGNING_CONFIGURATION_INVALID";
    }
  }
  return {
    configured: signingConfigured() && !configError,
    configuration_error: configError,
    current_key: currentKey,
    keys: keyResult.data || [],
    signed_awards: signed.count || 0,
    unsigned_awards: drafts.count || 0,
    verification_events: verificationEvents.count || 0,
    required_algorithm: "RS256",
    public_key_endpoint: `${functionBaseUrl(req)}/keys`,
  };
}

async function findPublicAwardByIdentifier(sb: Supabase, identifier: string) {
  const base = sb.from("badge_awards")
    .select("*,template:badge_templates(*,category:badge_categories(*),level:badge_levels(*)),issuer:credential_issuers(*),recipient:users!badge_awards_recipient_user_id_fkey(id,full_name,avatar_url)")
    .eq("visibility", "public");
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier);
  const query = isUuid ? base.eq("credential_uuid", identifier) : base.eq("verification_code", identifier.toUpperCase());
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("BADGE_NOT_FOUND");
  return data as JsonRecord;
}

async function verifyPublicBadge(sb: Supabase, identifier: string, req: Request, source = "public_page") {
  const award = await findPublicAwardByIdentifier(sb, identifier);
  const badge = await publicBadge(sb, identifier);
  if (!award.credential_jwt) {
    return {
      badge,
      verification: {
        signature_valid: false,
        structure_valid: false,
        status_valid: award.status === "awarded",
        overall_valid: false,
        error_code: "CREDENTIAL_NOT_SIGNED",
        checked_at: new Date().toISOString(),
      },
    };
  }
  const verification = await verifyCompactCredential(sb, String(award.credential_jwt), req, award, source);
  return { badge, verification };
}

async function issuerPublicProfile(sb: Supabase, code: string) {
  const { data, error } = await sb.from("credential_issuers")
    .select("code,name,description,issuer_type,website_url,email,logo_url,issuer_uri,did,verification_method,public_key_set_uri,status")
    .eq("code", code).eq("status", "active").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("ISSUER_NOT_FOUND");
  return data;
}

async function activePublicKeys(sb: Supabase) {
  const { data, error } = await sb.from("credential_signing_keys")
    .select("key_id_uri,algorithm,public_jwk,jwk_thumbprint,status,valid_from,valid_until")
    .in("status", ["active", "retired"]).order("valid_from", { ascending: false });
  if (error) throw error;
  return (data || []).map((row: JsonRecord) => ({ ...(row.public_jwk as JsonRecord), kid: row.key_id_uri, alg: row.algorithm, use: "sig" }));
}

async function exportResponse(sb: Supabase, award: JsonRecord, format: string, req: Request) {
  if (format === "vc_jwt") {
    if (!award.credential_jwt) throw new Error("CREDENTIAL_NOT_SIGNED");
    await verifyCompactCredential(sb, String(award.credential_jwt), req, award, "export");
    await sb.from("credential_exports").insert({ award_id: award.id, export_format: "vc_jwt" });
    return textResponse(String(award.credential_jwt), "text/plain; charset=utf-8", {
      "Content-Disposition": `attachment; filename="omnia-badge-${award.verification_code}.jwt"`,
      "Cache-Control": "no-store",
    });
  }
  if (format === "json_ld") {
    await sb.from("credential_exports").insert({ award_id: award.id, export_format: "json_ld" });
    return json(award.credential_json || {}, 200, {
      "Content-Type": "application/vc+ld+json",
      "Content-Disposition": `attachment; filename="omnia-badge-${award.verification_code}.json"`,
      "Cache-Control": "no-store",
    });
  }
  if (format === "qr_svg") {
    const verificationUrl = `${appBaseUrl()}/credentials/badges/${award.verification_code}`;
    const svg = await QRCode.toString(verificationUrl, { type: "svg", margin: 1, width: 320, errorCorrectionLevel: "M" });
    await sb.from("credential_exports").insert({ award_id: award.id, export_format: "qr_svg" });
    return textResponse(svg, "image/svg+xml; charset=utf-8", {
      "Content-Disposition": `inline; filename="omnia-badge-${award.verification_code}-qr.svg"`,
      "Cache-Control": "public, max-age=3600",
    });
  }
  throw new Error("EXPORT_FORMAT_UNSUPPORTED");
}

async function revokeBadge(sb: Supabase, session: Session, body: JsonRecord) {
  const awardId = text(body.award_id, 80);
  const reason = text(body.reason, 2000);
  if (!awardId || !reason) throw new Error("REVOCATION_INCOMPLETE");
  const { data: current, error } = await sb.from("badge_awards").select("*").eq("id", awardId).maybeSingle();
  if (error) throw error;
  if (!current) throw new Error("BADGE_NOT_FOUND");
  if (current.status === "revoked") throw new Error("BADGE_ALREADY_REVOKED");
  const { data: updated, error: updateError } = await sb.from("badge_awards").update({
    status: "revoked", revoked_at: new Date().toISOString(), revoked_by: session.userId, revocation_reason: reason,
  }).eq("id", awardId).select("*").single();
  if (updateError) throw updateError;
  await sb.from("clr_achievements").update({ status: "revoked" }).eq("award_id", awardId);
  await rebuildClr(sb, String(current.recipient_user_id));
  await audit(sb, session.userId, "badge_revoked", "badge_award", awardId, current, updated);
  return updated;
}

async function updateVisibility(sb: Supabase, session: Session, body: JsonRecord) {
  const awardId = text(body.award_id, 80);
  const visibility = text(body.visibility, 30);
  if (!["private","oga","recruiters","structure","public"].includes(visibility)) throw new Error("INVALID_VISIBILITY");
  const { data: award, error } = await sb.from("badge_awards").select("id,recipient_user_id,template:badge_templates(internal_only)").eq("id", awardId).maybeSingle();
  if (error) throw error;
  if (!award || String(award.recipient_user_id) !== session.userId) throw new Error("BADGE_NOT_FOUND");
  const template = award.template as unknown as JsonRecord | null;
  if (template?.internal_only && visibility === "public") throw new Error("INTERNAL_BADGE_CANNOT_BE_PUBLIC");
  const { error: updateError } = await sb.from("badge_awards").update({ visibility }).eq("id", awardId);
  if (updateError) throw updateError;
  await sb.from("clr_achievements").update({ visibility }).eq("award_id", awardId);
  await rebuildClr(sb, session.userId);
  return { success: true };
}

async function createClrShare(sb: Supabase, session: Session, body: JsonRecord) {
  const record = await getOrCreateClr(sb, session.userId);
  const token = randomToken();
  const tokenHash = await sha256(token);
  const days = integer(body.validity_days);
  const expiresAt = days && days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null;
  const sections = stringArray(body.include_sections, 20, 80);
  const visibilityFilter = text(body.visibility_filter, 30) || "public";
  if (!["oga","recruiters","structure","public"].includes(visibilityFilter)) throw new Error("INVALID_VISIBILITY");
  const { data, error } = await sb.from("clr_shares").insert({
    clr_record_id: record.id,
    token_hash: tokenHash,
    label: nullableText(body.label, 180),
    include_sections: sections.length ? sections : ["badges","competences_verifiees","engagement_communautaire"],
    visibility_filter: visibilityFilter,
    expires_at: expiresAt,
    created_by: session.userId,
  }).select("id,label,include_sections,visibility_filter,expires_at,created_at").single();
  if (error) throw error;
  await sb.from("clr_audit_logs").insert({ actor_user_id: session.userId, record_id: record.id, action: "share_created", metadata: { share_id: data.id } });
  return { ...data, token, url: `https://omniaglobalacademy.com/credentials/clr/${token}` };
}

async function learnerClr(sb: Supabase, session: Session) {
  const rebuilt = await rebuildClr(sb, session.userId);
  const { data: shares, error } = await sb.from("clr_shares").select("id,label,include_sections,visibility_filter,expires_at,revoked_at,created_at,last_accessed_at")
    .eq("clr_record_id", rebuilt.record.id).order("created_at", { ascending: false });
  if (error) throw error;
  return { ...rebuilt, shares: shares || [] };
}

async function revokeShare(sb: Supabase, session: Session, body: JsonRecord) {
  const shareId = text(body.share_id, 80);
  const record = await getOrCreateClr(sb, session.userId);
  const { error } = await sb.from("clr_shares").update({ revoked_at: new Date().toISOString() }).eq("id", shareId).eq("clr_record_id", record.id);
  if (error) throw error;
  return { success: true };
}

async function verifyOwnedBadge(sb: Supabase, session: Session, awardId: string, req: Request) {
  const { data: award, error } = await sb.from("badge_awards").select("*").eq("id", awardId).eq("recipient_user_id", session.userId).maybeSingle();
  if (error) throw error;
  if (!award) throw new Error("BADGE_NOT_FOUND");
  if (!award.credential_jwt) return { signature_valid: false, structure_valid: false, status_valid: award.status === "awarded", overall_valid: false, error_code: "CREDENTIAL_NOT_SIGNED", checked_at: new Date().toISOString() };
  return verifyCompactCredential(sb, String(award.credential_jwt), req, award as JsonRecord, "learner");
}

async function handlePublicGet(sb: Supabase, req: Request) {
  const url = new URL(req.url);
  const marker = "/credentials";
  const markerIndex = url.pathname.indexOf(marker);
  const relative = markerIndex >= 0 ? url.pathname.slice(markerIndex + marker.length) : "/";
  const parts = relative.split("/").filter(Boolean).map(decodeURIComponent);

  if (parts[0] === "keys") {
    const keys = await activePublicKeys(sb);
    if (parts.length === 1) return json({ keys }, 200, { "Cache-Control": "public, max-age=300" });
    if (parts[1] === "current") {
      const { data: currentRow, error: currentError } = await sb.from("credential_signing_keys")
        .select("key_id_uri,algorithm,public_jwk")
        .eq("status", "active")
        .order("valid_from", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (currentError) throw currentError;
      if (!currentRow) throw new Error("SIGNING_KEY_NOT_FOUND");
      return json({ ...(currentRow.public_jwk as JsonRecord), kid: currentRow.key_id_uri, alg: currentRow.algorithm, use: "sig" }, 200, { "Cache-Control": "public, max-age=300" });
    }
    const { data, error } = await sb.from("credential_signing_keys").select("key_id_uri,algorithm,public_jwk")
      .eq("jwk_thumbprint", parts[1]).in("status", ["active", "retired"]).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("SIGNING_KEY_NOT_FOUND");
    return json({ ...(data.public_jwk as JsonRecord), kid: data.key_id_uri, alg: data.algorithm, use: "sig" }, 200, { "Cache-Control": "public, max-age=300" });
  }

  if (parts[0] === "issuers" && parts[1]) {
    return json(await issuerPublicProfile(sb, parts[1]), 200, { "Cache-Control": "public, max-age=300" });
  }

  if (parts[0] === "badges" && parts[1]) {
    const rawIdentifier = parts[1];
    let identifier = rawIdentifier;
    let format = "verify";
    if (rawIdentifier.endsWith(".jwt")) { identifier = rawIdentifier.slice(0, -4); format = "vc_jwt"; }
    else if (rawIdentifier.endsWith(".json")) { identifier = rawIdentifier.slice(0, -5); format = "json_ld"; }
    else if (parts[2] === "qr.svg") format = "qr_svg";
    else if (parts[2] === "refresh") format = "vc_jwt";
    else if (parts[2] === "verify") format = "verify";
    const award = await findPublicAwardByIdentifier(sb, identifier);
    if (format === "verify") return json({ success: true, ...(await verifyPublicBadge(sb, identifier, req, "api")) }, 200, { "Cache-Control": "no-store" });
    return exportResponse(sb, award, format, req);
  }

  return json({ success: false, error: "PUBLIC_RESOURCE_NOT_FOUND" }, 404);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    if (req.method === "GET") return await handlePublicGet(sb, req);
    if (req.method !== "POST") return json({ success: false, error: "METHOD_NOT_ALLOWED" }, 405);

    const body = await req.json().catch(() => ({})) as JsonRecord;
    const action = text(body.action, 80);
    const session = await authenticate(sb, req);

    if (action === "public_badge" || action === "public_verify_badge") return json({ success: true, ...(await verifyPublicBadge(sb, text(body.identifier, 120), req)) });
    if (action === "public_clr") return json({ success: true, ...(await publicClr(sb, text(body.token, 200))) });
    if (action === "public_issuer") return json({ success: true, issuer: await issuerPublicProfile(sb, text(body.code, 120) || "omnia-global-academy") });
    if (action === "public_signing_keys") return json({ success: true, keys: await activePublicKeys(sb) });

    if (action === "learner_badges") {
      requireSession(session);
      return json({ success: true, badges: await awardRows(sb, session.userId), templates: await templateRows(sb, false) });
    }
    if (action === "learner_verify_badge") {
      requireSession(session);
      return json({ success: true, verification: await verifyOwnedBadge(sb, session, text(body.award_id, 80), req) });
    }
    if (action === "learner_clr") {
      requireSession(session);
      return json({ success: true, ...(await learnerClr(sb, session)) });
    }
    if (action === "learner_update_visibility") {
      requireSession(session);
      return json({ success: true, ...(await updateVisibility(sb, session, body)) });
    }
    if (action === "learner_create_clr_share") {
      requireSession(session);
      return json({ success: true, share: await createClrShare(sb, session, body) });
    }
    if (action === "learner_revoke_clr_share") {
      requireSession(session);
      return json({ success: true, ...(await revokeShare(sb, session, body)) });
    }

    requireAdmin(session);
    if (action === "admin_overview") {
      const [templates, awards, pendingReviews, issuers, clrRecords, signedAwards] = await Promise.all([
        sb.from("badge_templates").select("id", { count: "exact", head: true }),
        sb.from("badge_awards").select("id", { count: "exact", head: true }),
        sb.from("badge_review_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        sb.from("credential_issuers").select("id", { count: "exact", head: true }).eq("status", "active"),
        sb.from("clr_records").select("id", { count: "exact", head: true }),
        sb.from("badge_awards").select("id", { count: "exact", head: true }).eq("standards_status", "ob3_signed"),
      ]);
      return json({ success: true, metrics: { templates: templates.count || 0, awards: awards.count || 0, pending_reviews: pendingReviews.count || 0, active_issuers: issuers.count || 0, clr_records: clrRecords.count || 0, signed_awards: signedAwards.count || 0 } });
    }
    if (action === "admin_signing_status") return json({ success: true, signing: await signingStatus(sb, req) });
    if (action === "admin_sync_signing_key") return json({ success: true, key: await syncSigningKey(sb, req, session.userId), signing: await signingStatus(sb, req) });
    if (action === "admin_sign_award") return json({ success: true, award: await signAwardById(sb, session.userId, text(body.award_id, 80), req) });
    if (action === "admin_sign_unsigned") return json({ success: true, results: await signUnsignedAwards(sb, session, req, integer(body.limit) || 100), signing: await signingStatus(sb, req) });
    if (action === "admin_verify_award") {
      const award = await awardForSigning(sb, text(body.award_id, 80));
      if (!award.credential_jwt) throw new Error("CREDENTIAL_NOT_SIGNED");
      return json({ success: true, verification: await verifyCompactCredential(sb, String(award.credential_jwt), req, award, "admin") });
    }
    if (action === "admin_templates") return json({ success: true, templates: await templateRows(sb), categories: (await sb.from("badge_categories").select("*").order("display_order")).data || [], levels: (await sb.from("badge_levels").select("*").order("rank")).data || [], issuers: (await sb.from("credential_issuers").select("*").order("name")).data || [] });
    if (action === "admin_save_template") return json({ success: true, template: await saveTemplate(sb, session, body) });
    if (action === "admin_categories") return json({ success: true, categories: (await sb.from("badge_categories").select("*").order("display_order")).data || [] });
    if (action === "admin_save_category") return json({ success: true, category: await saveCategory(sb, session, body) });
    if (action === "admin_levels") return json({ success: true, levels: (await sb.from("badge_levels").select("*").order("rank")).data || [] });
    if (action === "admin_save_level") return json({ success: true, level: await saveLevel(sb, session, body) });
    if (action === "admin_issuers") return json({ success: true, issuers: (await sb.from("credential_issuers").select("*").order("created_at", { ascending: false })).data || [] });
    if (action === "admin_save_issuer") return json({ success: true, issuer: await saveIssuer(sb, session, body) });
    if (action === "admin_awards") return json({ success: true, awards: await awardRows(sb), templates: await templateRows(sb, false) });
    if (action === "admin_issue_badge") return json({ success: true, award: await issueBadge(sb, session, body, req) });
    if (action === "admin_revoke_badge") return json({ success: true, award: await revokeBadge(sb, session, body) });
    if (action === "admin_clr_records") {
      const { data, error } = await sb.from("clr_records").select("*,user:users(id,full_name,email,avatar_url)").order("updated_at", { ascending: false });
      if (error) throw error;
      return json({ success: true, records: data || [] });
    }
    throw new Error("UNKNOWN_ACTION");
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "UNAUTHENTICATED" ? 401 : message === "FORBIDDEN" ? 403 : message.endsWith("_NOT_FOUND") ? 404 : 400;
    return json({ success: false, error: message }, status);
  }
});
