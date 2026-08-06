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

function requireLearner(session: Session | null): asserts session is Session {
  requireSession(session);
  // L’Administration Omnia ne devient jamais apprenant pendant une prévisualisation,
  // même si une ancienne donnée lui a attribué ce rôle par erreur.
  if (session.roles.includes("super_admin") || !session.roles.includes("apprenant")) {
    throw new Error("LEARNER_ROLE_REQUIRED");
  }
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
  if (!raw?.trim()) return null;

  let candidate = raw.trim();
  if (candidate.startsWith(`${name}=`)) candidate = candidate.slice(name.length + 1).trim();

  try {
    let parsed: unknown = JSON.parse(candidate);
    // Le Dashboard Supabase peut recevoir accidentellement un JSON entouré de
    // guillemets. On accepte ce format sans affaiblir la validation du JWK.
    if (typeof parsed === "string") parsed = JSON.parse(parsed.trim());
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("INVALID_OBJECT");
    return parsed as JsonRecord;
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
  return rebuildCompleteClr(sb, userId);
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

async function publicClr(sb: Supabase, token: string, req: Request) {
  const tokenHash = await sha256(token);
  const { data: share, error } = await sb.from("clr_shares").select("*").eq("token_hash", tokenHash).maybeSingle();
  if (error) throw error;
  if (!share || share.revoked_at || (share.expires_at && new Date(share.expires_at) <= new Date())) throw new Error("CLR_SHARE_NOT_FOUND");
  const { data: record, error: recordError } = await sb.from("clr_records").select("*,user:users!clr_records_user_id_fkey(id,full_name,avatar_url,country_code)").eq("id", share.clr_record_id).maybeSingle();
  if (recordError) throw recordError;
  if (!record) throw new Error("CLR_NOT_FOUND");
  const verification = record.clr_jwt
    ? await verifyPortableCredential(sb, String(record.clr_jwt), req, record as JsonRecord, "ClrCredential", "public_page")
    : record.verification_result || {};
  const allowed = new Set(stringArray(share.include_sections, 30, 80));
  const { data: achievements, error: achievementError } = await sb.from("clr_achievements")
    .select("*").eq("clr_record_id", record.id).in("visibility", [share.visibility_filter, "public"]).order("issued_at", { ascending: false });
  if (achievementError) throw achievementError;
  await sb.from("clr_shares").update({ last_accessed_at: new Date().toISOString() }).eq("id", share.id);
  return {
    record: {
      record_uuid: record.record_uuid,
      title: record.title,
      description: record.description,
      profile_headline: record.profile_headline,
      summary: record.summary,
      language_code: record.language_code,
      section_order: record.section_order || [],
      hidden_sections: record.hidden_sections || [],
      version: record.version,
      standards_status: record.standards_status,
      signed_at: record.signed_at,
      verification_result: verification,
      user: record.user ? {
        full_name: record.user.full_name,
        avatar_url: record.user.avatar_url,
        country_code: record.user.country_code,
      } : null,
    },
    share: {
      label: share.label,
      expires_at: share.expires_at,
      visibility_filter: share.visibility_filter,
      include_sections: share.include_sections || [],
    },
    achievements: (achievements || []).filter((row: JsonRecord) => !allowed.size || allowed.has(String(row.section))).map((row: JsonRecord) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      achievement_type: row.achievement_type,
      section: row.section,
      status: row.status,
      visibility: row.visibility,
      issued_at: row.issued_at,
      started_at: row.started_at,
      ended_at: row.ended_at,
      score: row.score,
      score_max: row.score_max,
      result_label: row.result_label,
      skills: row.skills || [],
      evidence: row.evidence || [],
      external_url: row.external_url,
      issuer_name: row.issuer_name,
      issuer_url: row.issuer_url,
      entry_origin: row.entry_origin || "platform",
      verification_status: row.verification_status || "verified",
      learner_editable: false,
      is_featured: Boolean(row.is_featured),
      sort_order: row.sort_order || 0,
    })),
  };
}

async function uploadBadgeTemplateImage(sb: Supabase, session: Session, body: JsonRecord) {
  const mimeType = text(body.mime_type, 100).toLowerCase();
  const fileName = text(body.file_name, 240);
  const encoded = text(body.base64, 8_000_000).replace(/^data:[^;]+;base64,/, "");
  const allowed: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
  };
  const extension = allowed[mimeType];
  if (!fileName || !encoded || !extension) throw new Error("BADGE_IMAGE_INVALID");
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
  } catch {
    throw new Error("BADGE_IMAGE_INVALID_BASE64");
  }
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new Error("BADGE_IMAGE_TOO_LARGE");
  const storagePath = `badge-templates/${session.userId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await sb.storage.from("credential-assets").upload(storagePath, bytes, {
    contentType: mimeType,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw error;
  const { data } = sb.storage.from("credential-assets").getPublicUrl(storagePath);
  if (!data.publicUrl) throw new Error("BADGE_IMAGE_PUBLIC_URL_UNAVAILABLE");
  return { url: data.publicUrl, storage_path: storagePath };
}


function xmlEscape(value:unknown){return String(value??"").replace(/[&<>"']/g,character=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[character]||character));}
async function generateAutomaticBadgeImage(sb:Supabase,session:Session,name:string,metadata:JsonRecord){
 const primary=/^#[0-9a-f]{6}$/i.test(String(metadata.primary_color||""))?String(metadata.primary_color):"#002050";
 const accent=/^#[0-9a-f]{6}$/i.test(String(metadata.accent_color||""))?String(metadata.accent_color):"#BF8813";
 const symbol=text(metadata.symbol,8)||"✓";const shortName=name.length>28?`${name.slice(0,25)}…`:name;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" role="img" aria-label="${xmlEscape(name)}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${primary}"/><stop offset="1" stop-color="#00152f"/></linearGradient></defs><circle cx="256" cy="256" r="238" fill="url(#g)"/><circle cx="256" cy="256" r="206" fill="none" stroke="${accent}" stroke-width="14"/><path d="M132 390 92 492l108-52 56 72 56-72 108 52-40-102" fill="${accent}" opacity=".96"/><circle cx="256" cy="218" r="92" fill="#fff" opacity=".98"/><text x="256" y="250" text-anchor="middle" font-family="Arial,sans-serif" font-size="92" font-weight="700" fill="${primary}">${xmlEscape(symbol)}</text><rect x="92" y="334" width="328" height="82" rx="28" fill="#fff"/><text x="256" y="372" text-anchor="middle" font-family="Arial,sans-serif" font-size="21" font-weight="700" fill="${primary}">${xmlEscape(shortName)}</text><text x="256" y="397" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" font-weight="700" letter-spacing="3" fill="${accent}">OMNIA GLOBAL ACADEMY</text></svg>`;
 const bytes=new TextEncoder().encode(svg);const storagePath=`badge-templates/${session.userId}/automatic-${crypto.randomUUID()}.svg`;const {error}=await sb.storage.from("credential-assets").upload(storagePath,bytes,{contentType:"image/svg+xml",cacheControl:"31536000",upsert:false});if(error)throw error;const {data}=sb.storage.from("credential-assets").getPublicUrl(storagePath);if(!data.publicUrl)throw new Error("BADGE_IMAGE_PUBLIC_URL_UNAVAILABLE");return data.publicUrl;
}

async function saveTemplate(sb: Supabase, session: Session, body: JsonRecord) {
  const id = nullableText(body.id, 80);
  const name = text(body.name, 160);
  const description = text(body.description, 2500);
  const criteriaNarrative = text(body.criteria_narrative, 3000);
  const categoryId = text(body.category_id, 80);
  const issuerId = text(body.issuer_id, 80);
  const metadata:JsonRecord=typeof body.metadata === "object" && body.metadata !== null ? body.metadata as JsonRecord : {};
  const designMode=text(metadata.design_mode,30)||"upload";
  let imageUrl = nullableText(body.image_url, 1000);
  if(designMode==="automatic"&&!imageUrl)imageUrl=await generateAutomaticBadgeImage(sb,session,name,metadata);
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
    metadata,
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
  return { ...data, token, url: `${appBaseUrl()}/credentials/clr/${token}` };
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

const CLR_SECTIONS = [
  "formations", "certificats", "competences_verifiees", "evaluations", "badges",
  "coaching", "omnia_live", "projets", "experiences", "recommandations",
  "engagement_communautaire",
];

const PASSPORT_SECTIONS = [
  "competences_verifiees", "certificats", "badges", "evaluations",
  "projets", "experiences", "recommandations",
];

function jsonRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function jsonArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function decodeJwtPayload(compactJwt: string): JsonRecord {
  const parts = compactJwt.split(".");
  if (parts.length !== 3) throw new Error("VC_JWT_INVALID");
  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padding = "=".repeat((4 - normalized.length % 4) % 4);
    return JSON.parse(atob(normalized + padding)) as JsonRecord;
  } catch {
    throw new Error("VC_JWT_INVALID");
  }
}

function portableCredentialChecks(payload: JsonRecord, requiredType: string) {
  const contexts = jsonArray(payload["@context"]).map(String);
  const types = jsonArray(payload.type).map(String);
  const issuer = jsonRecord(payload.issuer);
  const subject = jsonRecord(payload.credentialSubject);
  const validFrom = text(payload.validFrom, 80);
  const checks = {
    context: contexts.includes("https://www.w3.org/ns/credentials/v2"),
    type: types.includes("VerifiableCredential") && types.includes(requiredType),
    id: Boolean(payload.id && payload.jti === payload.id),
    issuer: Boolean(issuer.id && payload.iss === issuer.id),
    subject: Boolean(subject.id && payload.sub === subject.id),
    valid_from: Boolean(validFrom && Number(payload.nbf) === numericDate(validFrom)),
    valid_until: !payload.validUntil || Number(payload.exp) === numericDate(String(payload.validUntil)),
  };
  return { checks, valid: Object.values(checks).every(Boolean) };
}

async function verifyPortableCredential(
  sb: Supabase,
  compactJwt: string,
  req: Request,
  registry: JsonRecord,
  requiredType: "ClrCredential" | "OmniaSkillsPassportCredential",
  source: string,
) {
  let signatureValid = false;
  let structureValid = false;
  let statusValid = false;
  let errorCode: string | null = null;
  let payload: JsonRecord = {};
  let header: JsonRecord = {};
  let keyRow: JsonRecord | null = null;
  let structureChecks: JsonRecord = {};
  try {
    header = decodeProtectedHeader(compactJwt) as JsonRecord;
    const keyResult = await signingKeyForHeader(sb, header, req);
    keyRow = keyResult.key;
    const publicKey = await importJWK(keyResult.publicJwk as never, "RS256");
    const verified = await compactVerify(compactJwt, publicKey, { algorithms: ["RS256"] });
    signatureValid = true;
    payload = JSON.parse(new TextDecoder().decode(verified.payload)) as JsonRecord;
    const structure = portableCredentialChecks(payload, requiredType);
    structureValid = structure.valid;
    structureChecks = structure.checks;
    if (!structureValid) errorCode = "CREDENTIAL_STRUCTURE_INVALID";

    const storedHash = text(registry.credential_hash, 128);
    const actualHash = await sha256(compactJwt);
    const hashValid = !storedHash || storedHash === actualHash;
    const registryId = requiredType === "ClrCredential"
      ? `urn:uuid:${registry.record_uuid}`
      : `urn:uuid:${registry.passport_uuid}`;
    const idValid = payload.id === registryId;
    const activeStatus = requiredType === "ClrCredential"
      ? registry.status === "active"
      : registry.status === "published";
    const now = Date.now();
    const datesValid = (!payload.validFrom || new Date(String(payload.validFrom)).getTime() <= now)
      && (!payload.validUntil || new Date(String(payload.validUntil)).getTime() >= now);
    statusValid = hashValid && idValid && activeStatus && datesValid;
    if (!hashValid) errorCode = "CREDENTIAL_HASH_MISMATCH";
    else if (!idValid) errorCode = "CREDENTIAL_REGISTRY_MISMATCH";
    else if (!activeStatus) errorCode = "CREDENTIAL_NOT_ACTIVE";
    else if (!datesValid) errorCode = "CREDENTIAL_EXPIRED_OR_NOT_YET_VALID";
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

  if (requiredType === "ClrCredential") {
    await sb.from("clr_records").update({ verification_result: result }).eq("id", registry.id);
    await sb.from("clr_audit_logs").insert({
      actor_user_id: null,
      record_id: registry.id,
      action: "credential_verified",
      metadata: { source, overall_valid: result.overall_valid, error_code: errorCode },
    });
  } else {
    await sb.from("skills_passport_verification_events").insert({
      passport_id: registry.id,
      signing_key_id: keyRow?.id || registry.signing_key_id || null,
      verification_source: source,
      signature_valid: signatureValid,
      structure_valid: structureValid,
      status_valid: statusValid,
      overall_valid: result.overall_valid,
      error_code: errorCode,
      result,
    });
    await sb.from("skills_passports").update({ verification_result: result }).eq("id", registry.id);
  }
  return result;
}

function clrEntryCredential(recordUuid: string, entry: JsonRecord): JsonRecord {
  const sourceType = text(entry.source_type, 80) || "manual";
  const sourceId = text(entry.source_id, 160) || crypto.randomUUID();
  const issuedAt = text(entry.issued_at, 80) || text(entry.ended_at, 80) || new Date().toISOString();
  const achievement: JsonRecord = {
    id: `${appBaseUrl()}/credentials/clr/achievements/${sourceType}/${encodeURIComponent(sourceId)}`,
    type: ["Achievement"],
    name: text(entry.title, 240),
    description: nullableText(entry.description, 4000),
    achievementType: text(entry.achievement_type, 80) || "Achievement",
  };
  const result: JsonRecord = {
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json",
    ],
    id: `${appBaseUrl()}/credentials/clr/entries/${sourceType}/${encodeURIComponent(sourceId)}`,
    type: ["VerifiableCredential", "OpenBadgeCredential"],
    issuer: {
      id: text(entry.issuer_url, 1000) || `${appBaseUrl()}/credentials/issuers/omnia-global-academy`,
      type: ["Profile"],
      name: text(entry.issuer_name, 240) || "Omnia Global Academy",
    },
    validFrom: issuedAt,
    credentialSubject: {
      id: `urn:uuid:${recordUuid}`,
      type: ["AchievementSubject"],
      achievement,
    },
  };
  const score = nullableNumber(entry.score);
  if (score !== null) {
    result.credentialSubject = {
      ...jsonRecord(result.credentialSubject),
      result: [{
        type: ["Result"],
        value: String(score),
        resultDescription: entry.score_max ? `Score sur ${entry.score_max}` : nullableText(entry.result_label, 500),
      }],
    };
  }
  return result;
}

async function upsertClrSourceEntry(sb: Supabase, record: JsonRecord, entry: JsonRecord): Promise<boolean> {
  const sourceType = text(entry.source_type, 80);
  const sourceId = text(entry.source_id, 200);
  if (!sourceType || !sourceId || !text(entry.title, 240)) return false;
  const { data: existing, error: existingError } = await sb.from("clr_achievements").select("*")
    .eq("clr_record_id", record.id).eq("source_type", sourceType).eq("source_id", sourceId).maybeSingle();
  if (existingError) throw existingError;
  const common = {
    title: text(entry.title, 240),
    description: nullableText(entry.description, 4000),
    achievement_type: text(entry.achievement_type, 80) || "Achievement",
    section: CLR_SECTIONS.includes(text(entry.section, 80)) ? text(entry.section, 80) : "formations",
    issued_at: nullableText(entry.issued_at, 80),
    started_at: nullableText(entry.started_at, 80),
    ended_at: nullableText(entry.ended_at, 80),
    score: nullableNumber(entry.score),
    score_max: nullableNumber(entry.score_max),
    result_label: nullableText(entry.result_label, 500),
    skills: stringArray(entry.skills, 80, 120),
    evidence: jsonArray(entry.evidence),
    external_url: validHttpUrl(nullableText(entry.external_url, 1000)) ? nullableText(entry.external_url, 1000) : null,
    issuer_name: nullableText(entry.issuer_name, 240) || "Omnia Global Academy",
    issuer_url: validHttpUrl(nullableText(entry.issuer_url, 1000)) ? nullableText(entry.issuer_url, 1000) : null,
    entry_origin: "platform",
    verification_status: "verified",
    learner_editable: false,
    metadata: jsonRecord(entry.metadata),
    source_updated_at: nullableText(entry.source_updated_at, 80),
  };
  const payload = clrEntryCredential(String(record.record_uuid), { ...entry, ...common });
  if (existing) {
    const comparisonKeys = Object.keys(common);
    const changed = comparisonKeys.some((key) => JSON.stringify(existing[key]) !== JSON.stringify(common[key]))
      || JSON.stringify(existing.payload || {}) !== JSON.stringify(payload);
    if (!changed) return false;
    const { error } = await sb.from("clr_achievements").update({
      ...common,
      payload,
      status: existing.status === "hidden" ? "hidden" : "active",
    }).eq("id", existing.id);
    if (error) throw error;
    return true;
  }
  const { error } = await sb.from("clr_achievements").insert({
    clr_record_id: record.id,
    source_type: sourceType,
    source_id: sourceId,
    visibility: "oga",
    status: "active",
    ...common,
    payload,
  });
  if (error) throw error;
  return true;
}

async function optionalSourceRows(
  query: PromiseLike<{ data: unknown; error: { message?: string } | null }>,
): Promise<JsonRecord[]> {
  try {
    const result = await query;
    if (result.error) return [];
    return Array.isArray(result.data) ? result.data as JsonRecord[] : [];
  } catch {
    return [];
  }
}

async function syncPlatformClr(sb: Supabase, userId: string) {
  const record = await getOrCreateClr(sb, userId);
  let changed = 0;

  const enrollments = await optionalSourceRows(
    sb.from("enrollments").select("*,courses(id,title,category,level,language)")
      .eq("user_id", userId).eq("status", "completed"),
  );
  for (const row of enrollments) {
    const course = jsonRecord(row.courses);
    if (await upsertClrSourceEntry(sb, record, {
      source_type: "course",
      source_id: row.course_id || row.id,
      section: "formations",
      achievement_type: "Course",
      title: course.title || row.course_title || "Formation Omnia terminée",
      description: course.category || row.description,
      issued_at: row.completed_at || row.updated_at,
      ended_at: row.completed_at,
      skills: jsonArray(row.skills),
      issuer_name: "Omnia Global Academy",
      metadata: { course_id: row.course_id, level: course.level, language: course.language },
      source_updated_at: row.updated_at,
    })) changed++;
  }

  const certificates = await optionalSourceRows(
    sb.from("certificates").select("*").eq("user_id", userId),
  );
  for (const row of certificates) {
    const revoked = row.validity_status === "revoked" || row.status === "revoked";
    if (revoked) continue;
    if (await upsertClrSourceEntry(sb, record, {
      source_type: "certificate",
      source_id: row.id,
      section: "certificats",
      achievement_type: "Certificate",
      title: row.course_title || row.title || "Certificat Omnia",
      description: row.course_category || row.description,
      issued_at: row.issued_at || row.created_at,
      ended_at: row.issued_at,
      external_url: row.verification_url || row.pdf_url,
      issuer_name: row.issuer_name || row.establishment_name || "Omnia Global Academy",
      evidence: row.verification_url ? [{ type: "verification", url: row.verification_url }] : [],
      metadata: {
        certificate_id: row.omnia_certificate_id,
        cpd_hours: row.cpd_hours,
        document_type: row.document_type,
      },
      source_updated_at: row.updated_at,
    })) changed++;
  }

  const competenciesByAttempt = new Map<string, string[]>();
  const canonicalCompetencies = await optionalSourceRows(
    sb.from("learner_competency_records")
      .select("*,competency:competency_definitions(id,name,code,description,domain,category,validity_months,renewal_mode),level:competency_levels(id,code,name,level_number)")
      .eq("user_id", userId).eq("status", "validated"),
  );
  const canonicalNames = new Set<string>();
  for (const row of canonicalCompetencies) {
    const competency = jsonRecord(row.competency);
    const level = jsonRecord(row.level);
    const competencyName = text(competency.name || row.competency_name, 240);
    if (!competencyName) continue;
    canonicalNames.add(competencyName.toLowerCase());
    const attemptId = text(row.attempt_id, 200);
    if (attemptId) {
      const current = competenciesByAttempt.get(attemptId) || [];
      current.push(competencyName);
      competenciesByAttempt.set(attemptId, [...new Set(current.filter(Boolean))]);
    }
    if (await upsertClrSourceEntry(sb, record, {
      source_type: "verified_competency",
      source_id: row.id,
      section: "competences_verifiees",
      achievement_type: "Competency",
      title: competencyName,
      description: competency.description || "Compétence validée par une évaluation ou un jury Omnia.",
      issued_at: row.verified_at || row.valid_from || row.updated_at || row.created_at,
      ended_at: row.valid_until,
      score: row.score,
      score_max: 100,
      result_label: row.source_type === "jury" ? "Compétence validée par jury" : "Compétence vérifiée",
      skills: [competencyName],
      evidence: jsonArray(row.evidence).length ? jsonArray(row.evidence) : [{ type: row.source_type || "assessment", attempt_id: row.attempt_id, assessment_id: row.assessment_id }],
      metadata: {
        competency_id: row.competency_id,
        competency_code: competency.code,
        domain: competency.domain,
        category: competency.category,
        level_id: row.competency_level_id,
        level_code: level.code,
        level_name: level.name,
        level_number: level.level_number,
        framework_version: row.framework_version,
        source_type: row.source_type,
        validity_status: row.valid_until && Date.parse(row.valid_until) < Date.now() ? "expired" : "valid",
        renewal_mode: competency.renewal_mode,
      },
      source_updated_at: row.updated_at || row.verified_at,
    })) changed++;
  }

  const competencyResults = await optionalSourceRows(
    sb.from("assessment_result_competencies").select("*")
      .eq("user_id", userId).eq("status", "validated"),
  );
  for (const row of competencyResults) {
    const competencyName = text(row.competency_name, 240);
    if (!competencyName || canonicalNames.has(competencyName.toLowerCase())) continue;
    const attemptId = text(row.attempt_id, 200);
    if (!attemptId) continue;
    const current = competenciesByAttempt.get(attemptId) || [];
    current.push(competencyName);
    competenciesByAttempt.set(attemptId, [...new Set(current.filter(Boolean))]);
    if (await upsertClrSourceEntry(sb, record, {
      source_type: "assessment_competency",
      source_id: row.id,
      section: "competences_verifiees",
      achievement_type: "Competency",
      title: competencyName,
      description: "Compétence validée par une évaluation Omnia.",
      issued_at: row.validated_at || row.updated_at || row.created_at,
      ended_at: row.valid_until,
      score: row.score,
      score_max: 100,
      result_label: row.verification_status === "jury_validated" ? "Compétence validée par jury" : "Compétence validée",
      skills: [competencyName],
      evidence: [{ type: "assessment", attempt_id: row.attempt_id, assessment_id: row.assessment_id }],
      metadata: { attempt_id: row.attempt_id, assessment_id: row.assessment_id, validation_status: row.status, verification_status: row.verification_status, framework_version: row.framework_version },
      source_updated_at: row.updated_at || row.validated_at,
    })) changed++;
  }

  const attempts = await optionalSourceRows(
    sb.from("assessment_attempts").select("*,assessment:course_assessments(title,scope,passing_score,assessment_type,competency_labels)")
      .eq("user_id", userId).eq("passed", true).eq("result_status", "published"),
  );
  for (const row of attempts) {
    const assessment = jsonRecord(row.assessment);
    const resultSkills = competenciesByAttempt.get(text(row.id, 200)) || stringArray(assessment.competency_labels, 80, 120);
    if (await upsertClrSourceEntry(sb, record, {
      source_type: "assessment",
      source_id: row.id,
      section: "evaluations",
      achievement_type: "Assessment",
      title: assessment.title || "Évaluation réussie",
      description: row.feedback,
      issued_at: row.result_published_at || row.graded_at || row.submitted_at,
      score: row.score,
      score_max: 100,
      result_label: `Évaluation ${assessment.scope || ""} réussie`,
      skills: resultSkills,
      metadata: { course_id: row.course_id, assessment_id: row.assessment_id, assessment_type: assessment.assessment_type, integrity_status: row.integrity_status },
      source_updated_at: row.result_published_at || row.graded_at || row.submitted_at,
    })) changed++;
  }

  const verifiedProjectEvidence = await optionalSourceRows(
    sb.from("omnia_project_verified_evidence")
      .select("*,project:omnia_projects(id,slug,title,organization_name,project_type),deliverable:omnia_project_deliverables(id,title,evaluation_score,evaluation_feedback,evaluated_at)")
      .eq("user_id", userId).eq("validation_status", "validated"),
  );
  for (const row of verifiedProjectEvidence) {
    const project = jsonRecord(row.project);
    const deliverable = jsonRecord(row.deliverable);
    const section = row.evidence_type === "recommendation" ? "recommandations" : row.evidence_type === "demonstrated_skill" ? "competences_verifiees" : "projets";
    if (await upsertClrSourceEntry(sb, record, {
      source_type: "omnia_project_evidence",
      source_id: row.id,
      section,
      achievement_type: row.evidence_type === "recommendation" ? "Recommendation" : row.evidence_type === "demonstrated_skill" ? "Competency" : "Project",
      title: row.title || project.title || "Expérience projet vérifiée",
      description: row.summary || row.description || deliverable.evaluation_feedback,
      issued_at: row.validated_at || deliverable.evaluated_at || row.created_at,
      score: deliverable.evaluation_score,
      score_max: deliverable.evaluation_score == null ? null : 100,
      result_label: row.evidence_type === "recommendation" ? "Recommandation vérifiée" : "Preuve d’expérience validée",
      skills: stringArray(row.skill_codes, 100, 160),
      external_url: row.portfolio_permission === "public" ? row.evidence_url : null,
      evidence: [{ type: "omnia_project", project_id: row.project_id, deliverable_id: row.deliverable_id, evidence_id: row.id }],
      issuer_name: row.issuer_name || project.organization_name || "Omnia Global Academy",
      visibility: row.portfolio_permission === "public" ? "public" : row.portfolio_permission === "recruiters" ? "recruiters" : "private",
      metadata: { project_id: row.project_id, project_slug: project.slug, evidence_type: row.evidence_type, portfolio_permission: row.portfolio_permission, evidence_payload: row.evidence_payload || {} },
      source_updated_at: row.updated_at || row.validated_at,
    })) changed++;
    await sb.from("omnia_project_verified_evidence").update({ exported_to_clr_at: new Date().toISOString() }).eq("id", row.id);
  }

  const projects = await optionalSourceRows(
    sb.from("course_assignment_submissions").select("*")
      .eq("learner_id", userId).eq("status", "graded"),
  );
  for (const row of projects) {
    if (await upsertClrSourceEntry(sb, record, {
      source_type: "project",
      source_id: row.id,
      section: "projets",
      achievement_type: "Project",
      title: row.file_name || "Projet évalué",
      description: row.evaluator_comment || row.answer_text,
      issued_at: row.evaluated_at || row.submitted_at,
      score: row.score,
      external_url: row.file_url,
      evidence: row.file_url ? [{ type: "artifact", url: row.file_url, name: row.file_name }] : [],
      metadata: { course_id: row.course_id, lesson_id: row.lesson_id },
      source_updated_at: row.updated_at,
    })) changed++;
  }

  const liveDocuments = [
    ...await optionalSourceRows(sb.from("live_issued_documents").select("*").eq("user_id", userId).eq("status", "issued")),
    ...await optionalSourceRows(sb.from("live_documents_issued").select("*").eq("user_id", userId).is("revoked_at", null)),
  ];
  for (const row of liveDocuments) {
    if (await upsertClrSourceEntry(sb, record, {
      source_type: "omnia_live",
      source_id: row.id,
      section: "omnia_live",
      achievement_type: "Participation",
      title: row.event_title || row.title || "Participation Omnia Live",
      description: row.document_type || "Attestation Omnia Live",
      issued_at: row.issue_date || row.issued_at || row.created_at,
      score: row.assessment_score,
      score_max: row.assessment_score === null || row.assessment_score === undefined ? null : 100,
      external_url: row.verification_url,
      issuer_name: row.organizer_name || row.issuer_name || "Omnia Global Academy",
      metadata: {
        event_id: row.event_id,
        attendance_percent: row.attendance_percent,
        cpd_hours: row.cpd_hours,
      },
      source_updated_at: row.updated_at || row.created_at,
    })) changed++;
  }

  const coachingSessions = await optionalSourceRows(
    sb.from("coaching_sessions").select("*").eq("learner_user_id", userId).eq("status", "completed"),
  );
  for (const row of coachingSessions) {
    if (await upsertClrSourceEntry(sb, record, {
      source_type: "coaching",
      source_id: row.id,
      section: "coaching",
      achievement_type: "Coaching",
      title: row.offer_title_snapshot || "Session de coaching terminée",
      description: row.coach_name_snapshot ? `Coach : ${row.coach_name_snapshot}` : null,
      started_at: row.actual_started_at || row.scheduled_start,
      ended_at: row.actual_ended_at || row.scheduled_end,
      issued_at: row.actual_ended_at || row.scheduled_end,
      issuer_name: row.coach_name_snapshot || "Coach Omnia",
      metadata: { duration_minutes: row.duration_minutes, meeting_mode: row.meeting_mode },
      source_updated_at: row.updated_at || row.actual_ended_at,
    })) changed++;
  }

  const recommendations = await optionalSourceRows(
    sb.from("coaching_action_plans").select("*")
      .eq("learner_user_id", userId).eq("learner_visible", true),
  );
  for (const row of recommendations) {
    if (await upsertClrSourceEntry(sb, record, {
      source_type: "coaching_recommendation",
      source_id: row.id,
      section: "recommandations",
      achievement_type: "Recommendation",
      title: row.title || "Recommandation de coaching",
      description: row.summary || row.next_session_recommendation,
      issued_at: row.updated_at || row.created_at,
      verification_status: "verified",
      metadata: { session_id: row.session_id, status: row.status },
      source_updated_at: row.updated_at,
    })) changed++;
  }

  const { error } = await sb.from("clr_records").update({
    last_synced_at: new Date().toISOString(),
    ...(changed ? {
      clr_jwt: null,
      signed_at: null,
      signing_key_id: null,
      signature_alg: null,
      credential_hash: null,
      standards_status: "clr2_draft",
      verification_result: {},
    } : {}),
  }).eq("id", record.id);
  if (error) throw error;
  return changed;
}

async function rebuildCompleteClr(sb: Supabase, userId: string) {
  const record = await getOrCreateClr(sb, userId);
  const { data: user, error: userError } = await sb.from("users")
    .select("id,full_name,country_code").eq("id", userId).maybeSingle();
  if (userError) throw userError;
  const { data: achievements, error: achievementError } = await sb.from("clr_achievements")
    .select("*").eq("clr_record_id", record.id)
    .order("sort_order").order("issued_at", { ascending: false });
  if (achievementError) throw achievementError;
  const active = (achievements || []).filter((row: JsonRecord) => row.status !== "hidden");
  const payload: JsonRecord = {
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      "https://purl.imsglobal.org/spec/clr/v2p0/context-2.0.1.json",
      "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json",
    ],
    id: `urn:uuid:${record.record_uuid}`,
    type: ["VerifiableCredential", "ClrCredential"],
    name: String(record.title || "Omnia Learning Record"),
    description: nullableText(record.description, 3000),
    issuer: {
      id: `${appBaseUrl()}/credentials/issuers/omnia-global-academy`,
      type: ["Profile"],
      name: "Omnia Global Academy",
    },
    credentialSubject: {
      id: `urn:uuid:${record.record_uuid}`,
      type: ["ClrSubject"],
      name: user?.full_name || "Titulaire Omnia",
      ...(user?.country_code ? { address: { addressCountry: user.country_code } } : {}),
      verifiableCredential: active.map((row: JsonRecord) => row.payload),
    },
    validFrom: String(record.created_at || new Date().toISOString()),
    credentialSchema: [{
      id: "https://purl.imsglobal.org/spec/clr/v2p0/schema/json/clr_v2p0_clrcredential_schema.json",
      type: "1EdTechJsonSchemaValidator2019",
    }],
  };
  const unchanged = JSON.stringify(record.clr_json || {}) === JSON.stringify(payload);
  let current = record;
  if (!unchanged) {
    const { data, error } = await sb.from("clr_records").update({
      clr_json: payload,
      standards_status: "clr2_draft",
      version: record.last_built_at ? Number(record.version || 1) + 1 : Number(record.version || 1),
      last_built_at: new Date().toISOString(),
      clr_jwt: null,
      signed_at: null,
      signing_key_id: null,
      signature_alg: null,
      credential_hash: null,
      verification_result: {},
    }).eq("id", record.id).select("*").single();
    if (error) throw error;
    current = data as JsonRecord;
  }
  return { record: current, achievements: achievements || [], changed: !unchanged };
}

function clrCounts(achievements: JsonRecord[]) {
  return {
    total: achievements.filter((row) => row.status !== "hidden").length,
    verified: achievements.filter((row) => row.status !== "hidden" && row.verification_status === "verified").length,
    pending: achievements.filter((row) => row.verification_status === "pending_review").length,
  };
}

async function learnerClrComplete(sb: Supabase, session: Session, synchronize = false) {
  const syncedEntries = synchronize ? await syncPlatformClr(sb, session.userId) : 0;
  const rebuilt = await rebuildCompleteClr(sb, session.userId);
  const [sharesResult, importsResult] = await Promise.all([
    sb.from("clr_shares").select("id,label,include_sections,visibility_filter,expires_at,revoked_at,created_at,last_accessed_at")
      .eq("clr_record_id", rebuilt.record.id).order("created_at", { ascending: false }),
    sb.from("clr_imports").select("*").eq("user_id", session.userId).order("created_at", { ascending: false }),
  ]);
  if (sharesResult.error) throw sharesResult.error;
  if (importsResult.error) throw importsResult.error;
  const achievements = rebuilt.achievements as JsonRecord[];
  return {
    record: { ...rebuilt.record, entry_counts: clrCounts(achievements) },
    achievements,
    shares: sharesResult.data || [],
    imports: importsResult.data || [],
    sections: CLR_SECTIONS,
    synced_entries: syncedEntries,
  };
}

async function invalidateClrSignature(sb: Supabase, recordId: string) {
  const { error } = await sb.from("clr_records").update({
    standards_status: "clr2_draft",
    clr_jwt: null,
    signed_at: null,
    signing_key_id: null,
    signature_alg: null,
    credential_hash: null,
    verification_result: {},
  }).eq("id", recordId);
  if (error) throw error;
}

async function ownedClrEntry(sb: Supabase, session: Session, entryId: string) {
  const { data, error } = await sb.from("clr_achievements")
    .select("*,record:clr_records!clr_achievements_record_id_fkey(id,user_id)")
    .eq("id", entryId).maybeSingle();
  if (error) throw error;
  const record = jsonRecord(data?.record);
  if (!data || String(record.user_id) !== session.userId) throw new Error("CLR_ENTRY_NOT_FOUND");
  return data as JsonRecord;
}

async function updateClrEntry(sb: Supabase, session: Session, body: JsonRecord) {
  const entry = await ownedClrEntry(sb, session, text(body.entry_id, 80));
  const patch: JsonRecord = {};
  if (body.visibility !== undefined) {
    const visibility = text(body.visibility, 30);
    if (!["private","oga","recruiters","structure","public"].includes(visibility)) throw new Error("INVALID_VISIBILITY");
    patch.visibility = visibility;
  }
  if (body.is_featured !== undefined) patch.is_featured = bool(body.is_featured);
  if (body.hidden !== undefined) patch.status = bool(body.hidden) ? "hidden" : "active";
  if (!Object.keys(patch).length) throw new Error("CLR_ENTRY_UPDATE_EMPTY");
  const { data, error } = await sb.from("clr_achievements").update(patch).eq("id", entry.id).select("*").single();
  if (error) throw error;
  await invalidateClrSignature(sb, String(entry.clr_record_id));
  return data;
}

async function saveClrEntry(sb: Supabase, session: Session, body: JsonRecord) {
  const record = await getOrCreateClr(sb, session.userId);
  const section = text(body.section, 80);
  if (!["experiences","projets","recommandations","certificats"].includes(section)) throw new Error("CLR_SECTION_NOT_MANUAL");
  const title = text(body.title, 240);
  if (!title) throw new Error("CLR_ENTRY_TITLE_REQUIRED");
  const entryId = nullableText(body.id, 80);
  const base: JsonRecord = {
    source_type: "manual",
    source_id: entryId || crypto.randomUUID(),
    title,
    description: nullableText(body.description, 4000),
    achievement_type: section === "experiences" ? "Experience" : section === "projets" ? "Project" : section === "recommandations" ? "Recommendation" : "Certificate",
    section,
    status: "active",
    visibility: ["private","oga","recruiters","structure","public"].includes(text(body.visibility, 30)) ? text(body.visibility, 30) : "private",
    issued_at: nullableText(body.ended_at, 80) || new Date().toISOString(),
    started_at: nullableText(body.started_at, 80),
    ended_at: nullableText(body.ended_at, 80),
    result_label: nullableText(body.result_label, 500),
    skills: stringArray(body.skills, 50, 120),
    evidence: [],
    external_url: validHttpUrl(nullableText(body.external_url, 1000)) ? nullableText(body.external_url, 1000) : null,
    issuer_name: nullableText(body.issuer_name, 240),
    entry_origin: "manual",
    verification_status: "declared",
    learner_editable: true,
    is_featured: bool(body.is_featured),
    metadata: {},
  };
  base.payload = clrEntryCredential(String(record.record_uuid), base);
  if (entryId) {
    const existing = await ownedClrEntry(sb, session, entryId);
    if (!existing.learner_editable) throw new Error("CLR_ENTRY_NOT_EDITABLE");
    const { data, error } = await sb.from("clr_achievements").update(base).eq("id", entryId).select("*").single();
    if (error) throw error;
    await invalidateClrSignature(sb, String(record.id));
    return data;
  }
  const { data, error } = await sb.from("clr_achievements").insert({
    clr_record_id: record.id,
    ...base,
  }).select("*").single();
  if (error) throw error;
  await invalidateClrSignature(sb, String(record.id));
  return data;
}

async function deleteClrEntry(sb: Supabase, session: Session, body: JsonRecord) {
  const entry = await ownedClrEntry(sb, session, text(body.entry_id, 80));
  if (!entry.learner_editable) throw new Error("CLR_ENTRY_NOT_EDITABLE");
  const { error } = await sb.from("clr_achievements").delete().eq("id", entry.id);
  if (error) throw error;
  await invalidateClrSignature(sb, String(entry.clr_record_id));
  return { success: true };
}

async function updateClrProfile(sb: Supabase, session: Session, body: JsonRecord) {
  const record = await getOrCreateClr(sb, session.userId);
  const order = stringArray(body.section_order, CLR_SECTIONS.length, 80).filter((value) => CLR_SECTIONS.includes(value));
  const hidden = stringArray(body.hidden_sections, CLR_SECTIONS.length, 80).filter((value) => CLR_SECTIONS.includes(value));
  const visibility = text(body.default_visibility, 30) || String(record.default_visibility || "oga");
  if (!["private","oga","recruiters","structure","public"].includes(visibility)) throw new Error("INVALID_VISIBILITY");
  const update: JsonRecord = {
    title: body.title === undefined ? String(record.title || "Omnia Learning Record") : (text(body.title, 240) || "Omnia Learning Record"),
    description: body.description === undefined ? record.description : nullableText(body.description, 3000),
    profile_headline: body.profile_headline === undefined ? record.profile_headline : nullableText(body.profile_headline, 300),
    summary: body.summary === undefined ? record.summary : nullableText(body.summary, 4000),
    language_code: body.language_code === undefined ? String(record.language_code || "fr") : (text(body.language_code, 10) || "fr"),
    default_visibility: visibility,
    section_order: body.section_order === undefined ? (jsonArray(record.section_order).map(String).filter(Boolean).length ? record.section_order : CLR_SECTIONS) : (order.length ? order : CLR_SECTIONS),
    hidden_sections: body.hidden_sections === undefined ? (record.hidden_sections || []) : hidden,
  };
  const { data, error } = await sb.from("clr_records").update(update).eq("id", record.id).select("*").single();
  if (error) throw error;
  await invalidateClrSignature(sb, String(record.id));
  return data;
}

function importedCredentials(payload: JsonRecord): JsonRecord[] {
  const subject = jsonRecord(payload.credentialSubject);
  const nested = jsonArray(subject.verifiableCredential)
    .map((item) => typeof item === "string" ? decodeJwtPayload(item) : jsonRecord(item))
    .filter((item) => Object.keys(item).length);
  return nested.length ? nested.slice(0, 100) : [payload];
}

async function importClr(sb: Supabase, session: Session, body: JsonRecord) {
  const record = await getOrCreateClr(sb, session.userId);
  const sourceFormat = text(body.source_format, 20);
  if (!["json","json_ld","vc_jwt"].includes(sourceFormat)) throw new Error("CLR_IMPORT_FORMAT_INVALID");
  const content = text(body.content, 2_000_000);
  if (!content) throw new Error("CLR_IMPORT_EMPTY");
  let payload: JsonRecord;
  let compactJwt: string | null = null;
  try {
    if (sourceFormat === "vc_jwt") {
      compactJwt = content;
      payload = decodeJwtPayload(content);
    } else {
      payload = JSON.parse(content) as JsonRecord;
    }
  } catch {
    throw new Error("CLR_IMPORT_INVALID");
  }
  const credentials = importedCredentials(payload);
  const issuer = jsonRecord(payload.issuer);
  const { data, error } = await sb.from("clr_imports").insert({
    clr_record_id: record.id,
    user_id: session.userId,
    source_format: sourceFormat,
    source_file_name: nullableText(body.source_file_name, 240),
    source_issuer: nullableText(issuer.name || issuer.id, 300),
    credential_type: jsonArray(payload.type).map(String).join(",").slice(0, 300) || null,
    raw_payload: payload,
    compact_jwt: compactJwt,
    status: "pending",
    verification_result: {
      structure_recognized: Boolean(credentials.length),
      signature_checked: false,
      note: "Contrôle de l’Administration Omnia requis avant intégration.",
    },
    imported_entries_count: credentials.length,
  }).select("*").single();
  if (error) throw error;
  await sb.from("clr_audit_logs").insert({
    actor_user_id: session.userId,
    record_id: record.id,
    action: "import_submitted",
    metadata: { import_id: data.id, source_format: sourceFormat, entries: credentials.length },
  });
  return data;
}

async function reviewClrImport(sb: Supabase, session: Session, body: JsonRecord) {
  const importId = text(body.import_id, 80);
  const decision = text(body.decision, 20);
  if (!["approve","reject"].includes(decision)) throw new Error("CLR_IMPORT_DECISION_INVALID");
  const { data: imported, error } = await sb.from("clr_imports").select("*").eq("id", importId).maybeSingle();
  if (error) throw error;
  if (!imported) throw new Error("CLR_IMPORT_NOT_FOUND");
  if (imported.status !== "pending") throw new Error("CLR_IMPORT_ALREADY_REVIEWED");
  let inserted = 0;
  if (decision === "approve") {
    const credentials = importedCredentials(jsonRecord(imported.raw_payload));
    for (const credential of credentials) {
      const subject = jsonRecord(credential.credentialSubject);
      const achievement = jsonRecord(subject.achievement);
      const title = text(achievement.name || credential.name, 240);
      if (!title) continue;
      const sourceId = text(credential.id, 500) || crypto.randomUUID();
      const issuer = jsonRecord(credential.issuer);
      const section = jsonArray(credential.type).map(String).includes("OpenBadgeCredential") ? "badges" : "certificats";
      const { data: exists } = await sb.from("clr_achievements").select("id")
        .eq("clr_record_id", imported.clr_record_id).eq("source_type", "imported").eq("source_id", sourceId).maybeSingle();
      if (exists) continue;
      const { error: insertError } = await sb.from("clr_achievements").insert({
        clr_record_id: imported.clr_record_id,
        source_type: "imported",
        source_id: sourceId,
        title,
        description: nullableText(achievement.description || credential.description, 4000),
        achievement_type: text(achievement.achievementType, 80) || "Achievement",
        section,
        status: "active",
        visibility: "private",
        issued_at: nullableText(credential.validFrom, 80) || imported.created_at,
        skills: stringArray(achievement.tag, 50, 120),
        evidence: jsonArray(subject.evidence),
        external_url: validHttpUrl(nullableText(credential.id, 1000)) ? nullableText(credential.id, 1000) : null,
        issuer_name: nullableText(issuer.name || issuer.id, 240),
        issuer_url: validHttpUrl(nullableText(issuer.id, 1000)) ? nullableText(issuer.id, 1000) : null,
        entry_origin: "imported",
        verification_status: "verified",
        learner_editable: false,
        metadata: { import_id: imported.id },
        payload: credential,
      });
      if (insertError) throw insertError;
      inserted++;
    }
    await invalidateClrSignature(sb, String(imported.clr_record_id));
  }
  const status = decision === "approve" ? "imported" : "rejected";
  const { data, error: updateError } = await sb.from("clr_imports").update({
    status,
    imported_entries_count: decision === "approve" ? inserted : Number(imported.imported_entries_count || 0),
    review_note: nullableText(body.review_note, 2500),
    reviewed_by: session.userId,
    reviewed_at: new Date().toISOString(),
  }).eq("id", importId).select("*").single();
  if (updateError) throw updateError;
  await sb.from("clr_audit_logs").insert({
    actor_user_id: session.userId,
    record_id: imported.clr_record_id,
    action: decision === "approve" ? "import_approved" : "import_rejected",
    metadata: { import_id: importId, inserted_entries: inserted },
  });
  return data;
}

async function signClr(sb: Supabase, userId: string, actorUserId: string, req: Request) {
  const rebuilt = await rebuildCompleteClr(sb, userId);
  const key = await syncSigningKey(sb, req, actorUserId);
  const signed = await signCredential(rebuilt.record.clr_json as JsonRecord, req);
  const hash = await sha256(signed.compactJws);
  const verification = {
    signature_valid: true,
    structure_valid: true,
    status_valid: true,
    overall_valid: true,
    checked_at: new Date().toISOString(),
  };
  const { data, error } = await sb.from("clr_records").update({
    clr_jwt: signed.compactJws,
    signed_at: new Date().toISOString(),
    signing_key_id: key.id,
    signature_alg: "RS256",
    credential_hash: hash,
    standards_status: "clr2_signed",
    verification_result: verification,
  }).eq("id", rebuilt.record.id).select("*").single();
  if (error) throw error;
  await sb.from("clr_audit_logs").insert({
    actor_user_id: actorUserId,
    record_id: data.id,
    action: "clr_signed",
    metadata: { version: data.version, credential_hash: hash },
  });
  return data as JsonRecord;
}

async function exportClr(sb: Supabase, session: Session, body: JsonRecord, req: Request) {
  const format = text(body.format, 30);
  if (!["clr_json","vc_jwt"].includes(format)) throw new Error("CLR_EXPORT_FORMAT_INVALID");
  const rebuilt = await rebuildCompleteClr(sb, session.userId);
  let record = rebuilt.record;
  let content: JsonRecord | string = rebuilt.record.clr_json as JsonRecord;
  if (format === "vc_jwt") {
    record = await signClr(sb, session.userId, session.userId, req);
    content = String(record.clr_jwt);
  }
  await sb.from("clr_exports").insert({
    clr_record_id: record.id,
    user_id: session.userId,
    export_format: format,
    credential_hash: format === "vc_jwt" ? record.credential_hash : await sha256(JSON.stringify(content)),
  });
  return {
    format,
    content,
    file_name: format === "vc_jwt" ? `omnia-clr-${record.record_uuid}.jwt` : `omnia-clr-${record.record_uuid}.jsonld`,
    media_type: format === "vc_jwt" ? "application/vc+jwt" : "application/ld+json",
    record,
  };
}

async function adminClrRecords(sb: Supabase) {
  const { data, error } = await sb.from("clr_records")
    .select("*,user:users!clr_records_user_id_fkey(id,full_name,email,avatar_url,country_code)")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  const records = data || [];
  const recordIds = records.map((row: JsonRecord) => String(row.id));
  const { data: achievements, error: achievementsError } = recordIds.length
    ? await sb.from("clr_achievements").select("clr_record_id,status,verification_status").in("clr_record_id", recordIds)
    : { data: [], error: null };
  if (achievementsError) throw achievementsError;
  return records.map((record: JsonRecord) => {
    const entries = (achievements || []).filter((row: JsonRecord) => row.clr_record_id === record.id);
    return { ...record, entry_counts: clrCounts(entries as JsonRecord[]) };
  });
}

async function adminClrImports(sb: Supabase) {
  const { data, error } = await sb.from("clr_imports")
    .select("*,user:users!clr_imports_user_id_fkey(id,full_name,email),record:clr_records!clr_imports_record_id_fkey(id,record_uuid,title)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

async function ensureSkillsPassport(sb: Supabase, userId: string) {
  const record = await getOrCreateClr(sb, userId);
  const { data: existing, error } = await sb.from("skills_passports").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (existing) return existing as JsonRecord;
  const { data, error: insertError } = await sb.from("skills_passports").insert({
    user_id: userId,
    clr_record_id: record.id,
    title: "Omnia Skills Passport",
    selected_sections: PASSPORT_SECTIONS,
  }).select("*").single();
  if (insertError) throw insertError;
  const { data: candidates } = await sb.from("clr_achievements").select("id")
    .eq("clr_record_id", record.id).eq("status", "active").eq("verification_status", "verified")
    .in("section", PASSPORT_SECTIONS).neq("visibility", "private").limit(30);
  if (candidates?.length) {
    await sb.from("skills_passport_items").insert(candidates.map((row: { id: string }, index: number) => ({
      passport_id: data.id,
      clr_achievement_id: row.id,
      display_order: index,
      is_featured: false,
    })));
  }
  return data as JsonRecord;
}

async function learnerSkillsPassport(sb: Supabase, session: Session) {
  const passport = await ensureSkillsPassport(sb, session.userId);
  const [itemsResult, candidatesResult, sharesResult] = await Promise.all([
    sb.from("skills_passport_items")
      .select("*,achievement:clr_achievements!skills_passport_items_clr_achievement_id_fkey(*)")
      .eq("passport_id", passport.id).order("display_order"),
    sb.from("clr_achievements").select("*").eq("clr_record_id", passport.clr_record_id)
      .eq("status", "active").in("section", PASSPORT_SECTIONS)
      .in("verification_status", ["verified","declared","pending_review"]).neq("visibility", "private")
      .order("issued_at", { ascending: false }),
    sb.from("skills_passport_shares").select("id,label,expires_at,max_views,view_count,last_accessed_at,revoked_at,created_at")
      .eq("passport_id", passport.id).order("created_at", { ascending: false }),
  ]);
  if (itemsResult.error) throw itemsResult.error;
  if (candidatesResult.error) throw candidatesResult.error;
  if (sharesResult.error) throw sharesResult.error;
  return {
    passport,
    items: itemsResult.data || [],
    candidates: candidatesResult.data || [],
    shares: sharesResult.data || [],
    allowed_sections: PASSPORT_SECTIONS,
  };
}

async function updateSkillsPassportItems(sb: Supabase, session: Session, body: JsonRecord) {
  const passport = await ensureSkillsPassport(sb, session.userId);
  const requested = jsonArray(body.items).slice(0, 100).map((item, index) => {
    const row = jsonRecord(item);
    return {
      achievement_id: text(row.achievement_id, 80),
      display_order: integer(row.display_order) ?? index,
      is_featured: bool(row.is_featured),
    };
  }).filter((item) => item.achievement_id);
  const ids = [...new Set(requested.map((item) => item.achievement_id))];
  const { data: allowed, error } = ids.length
    ? await sb.from("clr_achievements").select("id,section").eq("clr_record_id", passport.clr_record_id)
      .in("id", ids).eq("status", "active").in("section", PASSPORT_SECTIONS).neq("visibility", "private")
    : { data: [], error: null };
  if (error) throw error;
  const allowedIds = new Set((allowed || []).map((row: { id: string }) => String(row.id)));
  if (allowedIds.size !== ids.length) throw new Error("SKILLS_PASSPORT_ITEM_FORBIDDEN");
  const { error: deleteError } = await sb.from("skills_passport_items").delete().eq("passport_id", passport.id);
  if (deleteError) throw deleteError;
  if (requested.length) {
    const { error: insertError } = await sb.from("skills_passport_items").insert(requested.map((item) => ({
      passport_id: passport.id,
      clr_achievement_id: item.achievement_id,
      display_order: Math.max(0, item.display_order),
      is_featured: item.is_featured,
    })));
    if (insertError) throw insertError;
  }
  const { error: invalidateError } = await sb.from("skills_passports").update({
    status: "draft",
    presentation_jwt: null,
    signing_key_id: null,
    signature_alg: null,
    credential_hash: null,
    published_at: null,
    verification_result: {},
  }).eq("id", passport.id);
  if (invalidateError) throw invalidateError;
  await sb.from("skills_passport_audit_logs").insert({
    passport_id: passport.id,
    actor_user_id: session.userId,
    action: "selection_updated",
    metadata: { item_count: requested.length },
  });
  return { success: true };
}

async function updateSkillsPassportProfile(sb: Supabase, session: Session, body: JsonRecord) {
  const passport = await ensureSkillsPassport(sb, session.userId);
  const submittedSections = stringArray(body.selected_sections, PASSPORT_SECTIONS.length, 80)
    .filter((value) => PASSPORT_SECTIONS.includes(value));
  const existingSections = stringArray(passport.selected_sections, PASSPORT_SECTIONS.length, 80)
    .filter((value) => PASSPORT_SECTIONS.includes(value));
  const { data, error } = await sb.from("skills_passports").update({
    title: body.title === undefined ? String(passport.title || "Omnia Skills Passport") : (text(body.title, 240) || "Omnia Skills Passport"),
    professional_headline: body.professional_headline === undefined ? passport.professional_headline : nullableText(body.professional_headline, 300),
    professional_summary: body.professional_summary === undefined ? passport.professional_summary : nullableText(body.professional_summary, 4000),
    target_roles: body.target_roles === undefined ? (passport.target_roles || []) : stringArray(body.target_roles, 20, 120),
    languages: body.languages === undefined ? (passport.languages || []) : stringArray(body.languages, 20, 80),
    location_text: body.location_text === undefined ? passport.location_text : nullableText(body.location_text, 240),
    availability_text: body.availability_text === undefined ? passport.availability_text : nullableText(body.availability_text, 240),
    selected_sections: body.selected_sections === undefined
      ? (existingSections.length ? existingSections : PASSPORT_SECTIONS)
      : (submittedSections.length ? submittedSections : PASSPORT_SECTIONS),
    status: "draft",
    presentation_jwt: null,
    signing_key_id: null,
    signature_alg: null,
    credential_hash: null,
    published_at: null,
    verification_result: {},
  }).eq("id", passport.id).select("*").single();
  if (error) throw error;
  return data;
}

function publicPassportItem(row: JsonRecord) {
  return {
    id: row.id,
    clr_achievement_id: row.id,
    section: row.section,
    title: row.title,
    description: row.description,
    achievement_type: row.achievement_type,
    issued_at: row.issued_at,
    started_at: row.started_at,
    ended_at: row.ended_at,
    result_label: row.result_label,
    score: row.score,
    score_max: row.score_max,
    skills: stringArray(row.skills, 80, 120),
    evidence: jsonArray(row.evidence).filter((item) => {
      const evidence = jsonRecord(item);
      return evidence.is_public !== false;
    }),
    external_url: row.external_url,
    issuer_name: row.issuer_name,
    verification_status: row.verification_status,
    entry_origin: row.entry_origin,
    is_featured: bool(row.is_featured),
    display_order: integer(row.display_order) || 0,
  };
}

async function buildSkillsPassport(sb: Supabase, userId: string) {
  const passport = await ensureSkillsPassport(sb, userId);
  const { data: user, error: userError } = await sb.from("users").select("id,full_name,country_code").eq("id", userId).maybeSingle();
  if (userError) throw userError;
  const { data: itemRows, error } = await sb.from("skills_passport_items")
    .select("display_order,is_featured,achievement:clr_achievements!skills_passport_items_clr_achievement_id_fkey(*)")
    .eq("passport_id", passport.id).order("display_order");
  if (error) throw error;
  const allowedSections = new Set(stringArray(passport.selected_sections, PASSPORT_SECTIONS.length, 80));
  const items = (itemRows || []).map((item: JsonRecord) => ({
    ...jsonRecord(item.achievement),
    display_order: item.display_order,
    is_featured: item.is_featured,
  })).filter((item: JsonRecord) =>
    item.status === "active"
    && item.visibility !== "private"
    && PASSPORT_SECTIONS.includes(String(item.section))
    && (!allowedSections.size || allowedSections.has(String(item.section)))
  ).map(publicPassportItem);
  const validFrom = String(passport.created_at || new Date().toISOString());
  const payload: JsonRecord = {
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json",
    ],
    id: `urn:uuid:${passport.passport_uuid}`,
    type: ["VerifiableCredential", "OmniaSkillsPassportCredential"],
    name: String(passport.title || "Omnia Skills Passport"),
    issuer: {
      id: `${appBaseUrl()}/credentials/issuers/omnia-global-academy`,
      type: ["Profile"],
      name: "Omnia Global Academy",
    },
    validFrom,
    credentialSubject: {
      id: `urn:uuid:${passport.passport_uuid}`,
      type: ["Person"],
      name: user?.full_name || "Titulaire Omnia",
      ...(user?.country_code ? { address: { addressCountry: user.country_code } } : {}),
      professionalHeadline: passport.professional_headline,
      professionalSummary: passport.professional_summary,
      targetRoles: stringArray(passport.target_roles, 20, 120),
      languages: stringArray(passport.languages, 20, 80),
      location: passport.location_text,
      availability: passport.availability_text,
      achievement: items,
    },
  };
  const unchanged = JSON.stringify(passport.presentation_json || {}) === JSON.stringify(payload);
  let current = passport;
  if (!unchanged) {
    const { data, error: updateError } = await sb.from("skills_passports").update({
      presentation_json: payload,
      version: passport.last_built_at ? Number(passport.version || 1) + 1 : Number(passport.version || 1),
      last_built_at: new Date().toISOString(),
      status: "draft",
      presentation_jwt: null,
      signing_key_id: null,
      signature_alg: null,
      credential_hash: null,
      published_at: null,
      verification_result: {},
    }).eq("id", passport.id).select("*").single();
    if (updateError) throw updateError;
    current = data as JsonRecord;
  }
  return { passport: current, items, changed: !unchanged };
}

async function publishSkillsPassport(sb: Supabase, session: Session, req: Request) {
  const built = await buildSkillsPassport(sb, session.userId);
  if (!built.items.length) throw new Error("SKILLS_PASSPORT_EMPTY");
  const key = await syncSigningKey(sb, req, session.userId);
  const signed = await signCredential(built.passport.presentation_json as JsonRecord, req);
  const hash = await sha256(signed.compactJws);
  const verification = {
    signature_valid: true,
    structure_valid: true,
    status_valid: true,
    overall_valid: true,
    checked_at: new Date().toISOString(),
  };
  const { data, error } = await sb.from("skills_passports").update({
    status: "published",
    presentation_jwt: signed.compactJws,
    signing_key_id: key.id,
    signature_alg: "RS256",
    credential_hash: hash,
    published_at: new Date().toISOString(),
    verification_result: verification,
  }).eq("id", built.passport.id).select("*").single();
  if (error) throw error;
  await sb.from("skills_passport_audit_logs").insert({
    passport_id: data.id,
    actor_user_id: session.userId,
    action: "passport_published",
    metadata: { version: data.version, item_count: built.items.length, credential_hash: hash },
  });
  return { passport: data as JsonRecord, jwt: signed.compactJws };
}

async function createSkillsPassportShare(sb: Supabase, session: Session, body: JsonRecord) {
  const passport = await ensureSkillsPassport(sb, session.userId);
  if (passport.status !== "published" || !passport.presentation_jwt) throw new Error("SKILLS_PASSPORT_NOT_PUBLISHED");
  const token = randomToken();
  const days = integer(body.validity_days);
  const maxViews = integer(body.max_views);
  if (maxViews !== null && maxViews <= 0) throw new Error("SKILLS_PASSPORT_MAX_VIEWS_INVALID");
  const expiresAt = days && days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null;
  const { data, error } = await sb.from("skills_passport_shares").insert({
    passport_id: passport.id,
    token_hash: await sha256(token),
    label: nullableText(body.label, 180),
    expires_at: expiresAt,
    max_views: maxViews,
    created_by: session.userId,
  }).select("id,label,expires_at,max_views,view_count,last_accessed_at,revoked_at,created_at").single();
  if (error) throw error;
  return { ...data, token, url: `${appBaseUrl()}/credentials/passports/${token}` };
}

async function revokeSkillsPassportShare(sb: Supabase, session: Session, body: JsonRecord) {
  const passport = await ensureSkillsPassport(sb, session.userId);
  const { data, error } = await sb.from("skills_passport_shares").update({ revoked_at: new Date().toISOString() })
    .eq("id", text(body.share_id, 80)).eq("passport_id", passport.id).select("id").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("SKILLS_PASSPORT_SHARE_NOT_FOUND");
  return { success: true };
}

async function verifyOwnedSkillsPassport(sb: Supabase, session: Session, req: Request) {
  const passport = await ensureSkillsPassport(sb, session.userId);
  if (!passport.presentation_jwt) throw new Error("SKILLS_PASSPORT_NOT_SIGNED");
  return verifyPortableCredential(sb, String(passport.presentation_jwt), req, passport, "OmniaSkillsPassportCredential", "learner");
}

async function exportSkillsPassport(sb: Supabase, session: Session, body: JsonRecord, req: Request) {
  const format = text(body.format, 30);
  if (!["passport_json","vc_jwt"].includes(format)) throw new Error("SKILLS_PASSPORT_EXPORT_FORMAT_INVALID");
  let built = await buildSkillsPassport(sb, session.userId);
  if (format === "vc_jwt" && (!built.passport.presentation_jwt || built.passport.status !== "published")) {
    const published = await publishSkillsPassport(sb, session, req);
    built = { ...built, passport: published.passport };
  }
  const content = format === "vc_jwt" ? String(built.passport.presentation_jwt) : built.passport.presentation_json as JsonRecord;
  await sb.from("skills_passport_exports").insert({
    passport_id: built.passport.id,
    requested_by: session.userId,
    export_format: format,
    credential_hash: format === "vc_jwt" ? built.passport.credential_hash : await sha256(JSON.stringify(content)),
  });
  return {
    format,
    content,
    file_name: format === "vc_jwt" ? `omnia-skills-passport-${built.passport.passport_uuid}.jwt` : `omnia-skills-passport-${built.passport.passport_uuid}.jsonld`,
    media_type: format === "vc_jwt" ? "application/vc+jwt" : "application/ld+json",
    passport: built.passport,
  };
}

async function publicSkillsPassport(sb: Supabase, token: string, req: Request) {
  const { data: share, error } = await sb.from("skills_passport_shares").select("*")
    .eq("token_hash", await sha256(token)).maybeSingle();
  if (error) throw error;
  if (!share || share.revoked_at) throw new Error("SKILLS_PASSPORT_SHARE_NOT_FOUND");
  if (share.expires_at && new Date(share.expires_at) <= new Date()) throw new Error("SKILLS_PASSPORT_SHARE_EXPIRED");
  if (share.max_views !== null && Number(share.view_count || 0) >= Number(share.max_views)) throw new Error("SKILLS_PASSPORT_SHARE_LIMIT_REACHED");
  const { data: passport, error: passportError } = await sb.from("skills_passports")
    .select("*,user:users!skills_passports_user_id_fkey(id,full_name,country_code)")
    .eq("id", share.passport_id).maybeSingle();
  if (passportError) throw passportError;
  if (!passport || passport.status !== "published" || !passport.presentation_jwt) throw new Error("SKILLS_PASSPORT_NOT_PUBLISHED");
  const verification = await verifyPortableCredential(
    sb,
    String(passport.presentation_jwt),
    req,
    passport as JsonRecord,
    "OmniaSkillsPassportCredential",
    "public_page",
  );
  const snapshot = jsonRecord(passport.presentation_json);
  const subject = jsonRecord(snapshot.credentialSubject);
  const items = jsonArray(subject.achievement).map((item) => jsonRecord(item));
  const nextCount = Number(share.view_count || 0) + 1;
  const { data: updatedShare, error: viewError } = await sb.from("skills_passport_shares")
    .update({ view_count: nextCount, last_accessed_at: new Date().toISOString() })
    .eq("id", share.id).eq("view_count", Number(share.view_count || 0))
    .select("label,expires_at,max_views,view_count").maybeSingle();
  if (viewError) throw viewError;
  if (!updatedShare) throw new Error("SKILLS_PASSPORT_VIEW_CONFLICT");
  return {
    passport: {
      id: passport.id,
      passport_uuid: passport.passport_uuid,
      title: passport.title,
      professional_headline: passport.professional_headline,
      professional_summary: passport.professional_summary,
      target_roles: passport.target_roles,
      languages: passport.languages,
      location_text: passport.location_text,
      availability_text: passport.availability_text,
      selected_sections: passport.selected_sections,
      status: passport.status,
      version: passport.version,
      published_at: passport.published_at,
      verification_result: verification,
      user: passport.user ? {
        full_name: passport.user.full_name,
        country_code: passport.user.country_code,
      } : null,
    },
    share: updatedShare,
    items,
    verification,
  };
}

async function adminSkillsPassports(sb: Supabase) {
  const { data, error } = await sb.from("skills_passports")
    .select("*,user:users!skills_passports_user_id_fkey(id,full_name,country_code)")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  const rows = data || [];
  const ids = rows.map((row: JsonRecord) => String(row.id));
  if (!ids.length) return [];
  const [itemsResult, sharesResult] = await Promise.all([
    sb.from("skills_passport_items").select("passport_id").in("passport_id", ids),
    sb.from("skills_passport_shares").select("passport_id,revoked_at,expires_at").in("passport_id", ids),
  ]);
  if (itemsResult.error) throw itemsResult.error;
  if (sharesResult.error) throw sharesResult.error;
  const now = Date.now();
  return rows.map((row: JsonRecord) => ({
    ...row,
    item_count: (itemsResult.data || []).filter((item: JsonRecord) => item.passport_id === row.id).length,
    active_share_count: (sharesResult.data || []).filter((share: JsonRecord) =>
      share.passport_id === row.id && !share.revoked_at && (!share.expires_at || new Date(String(share.expires_at)).getTime() > now)
    ).length,
  }));
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
    if (action === "public_clr") return json({ success: true, ...(await publicClr(sb, text(body.token, 200), req)) });
    if (action === "public_skills_passport") return json({ success: true, ...(await publicSkillsPassport(sb, text(body.token, 200), req)) });
    if (action === "public_issuer") return json({ success: true, issuer: await issuerPublicProfile(sb, text(body.code, 120) || "omnia-global-academy") });
    if (action === "public_signing_keys") return json({ success: true, keys: await activePublicKeys(sb) });

    if (action === "learner_badges") {
      requireLearner(session);
      return json({ success: true, badges: await awardRows(sb, session.userId), templates: await templateRows(sb, false) });
    }
    if (action === "learner_verify_badge") {
      requireLearner(session);
      return json({ success: true, verification: await verifyOwnedBadge(sb, session, text(body.award_id, 80), req) });
    }
    if (action === "learner_clr") {
      requireLearner(session);
      return json({ success: true, ...(await learnerClrComplete(sb, session)) });
    }
    if (action === "learner_sync_clr") {
      requireLearner(session);
      return json({ success: true, ...(await learnerClrComplete(sb, session, true)) });
    }
    if (action === "learner_update_clr_entry") {
      requireLearner(session);
      return json({ success: true, entry: await updateClrEntry(sb, session, body) });
    }
    if (action === "learner_save_clr_entry") {
      requireLearner(session);
      return json({ success: true, entry: await saveClrEntry(sb, session, body) });
    }
    if (action === "learner_delete_clr_entry") {
      requireLearner(session);
      return json({ success: true, ...(await deleteClrEntry(sb, session, body)) });
    }
    if (action === "learner_update_clr_profile") {
      requireLearner(session);
      return json({ success: true, record: await updateClrProfile(sb, session, body) });
    }
    if (action === "learner_import_clr") {
      requireLearner(session);
      return json({ success: true, import: await importClr(sb, session, body) });
    }
    if (action === "learner_export_clr") {
      requireLearner(session);
      return json({ success: true, ...(await exportClr(sb, session, body, req)) });
    }
    if (action === "learner_update_visibility") {
      requireLearner(session);
      return json({ success: true, ...(await updateVisibility(sb, session, body)) });
    }
    if (action === "learner_create_clr_share") {
      requireLearner(session);
      return json({ success: true, share: await createClrShare(sb, session, body) });
    }
    if (action === "learner_revoke_clr_share") {
      requireLearner(session);
      return json({ success: true, ...(await revokeShare(sb, session, body)) });
    }
    if (action === "learner_skills_passport") {
      requireLearner(session);
      return json({ success: true, ...(await learnerSkillsPassport(sb, session)) });
    }
    if (action === "learner_update_skills_passport_items") {
      requireLearner(session);
      return json({ success: true, ...(await updateSkillsPassportItems(sb, session, body)) });
    }
    if (action === "learner_update_skills_passport_profile") {
      requireLearner(session);
      return json({ success: true, passport: await updateSkillsPassportProfile(sb, session, body) });
    }
    if (action === "learner_publish_skills_passport") {
      requireLearner(session);
      return json({ success: true, ...(await publishSkillsPassport(sb, session, req)) });
    }
    if (action === "learner_verify_skills_passport") {
      requireLearner(session);
      return json({ success: true, verification: await verifyOwnedSkillsPassport(sb, session, req) });
    }
    if (action === "learner_export_skills_passport") {
      requireLearner(session);
      return json({ success: true, ...(await exportSkillsPassport(sb, session, body, req)) });
    }
    if (action === "learner_create_skills_passport_share") {
      requireLearner(session);
      return json({ success: true, share: await createSkillsPassportShare(sb, session, body) });
    }
    if (action === "learner_revoke_skills_passport_share") {
      requireLearner(session);
      return json({ success: true, ...(await revokeSkillsPassportShare(sb, session, body)) });
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
    if (action === "admin_upload_badge_image") return json({ success: true, ...(await uploadBadgeTemplateImage(sb, session, body)) });
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
    if (action === "admin_clr_records") return json({ success: true, records: await adminClrRecords(sb) });
    if (action === "admin_clr_imports") return json({ success: true, imports: await adminClrImports(sb) });
    if (action === "admin_sync_clr") {
      const userId = text(body.user_id, 80);
      if (!userId) throw new Error("CLR_USER_REQUIRED");
      await syncPlatformClr(sb, userId);
      return json({ success: true, ...(await rebuildCompleteClr(sb, userId)) });
    }
    if (action === "admin_sign_clr") {
      const userId = text(body.user_id, 80);
      if (!userId) throw new Error("CLR_USER_REQUIRED");
      return json({ success: true, record: await signClr(sb, userId, session.userId, req) });
    }
    if (action === "admin_verify_clr") {
      const { data: record, error } = await sb.from("clr_records").select("*").eq("id", text(body.record_id, 80)).maybeSingle();
      if (error) throw error;
      if (!record) throw new Error("CLR_NOT_FOUND");
      if (!record.clr_jwt) throw new Error("CLR_NOT_SIGNED");
      return json({ success: true, verification: await verifyPortableCredential(sb, String(record.clr_jwt), req, record as JsonRecord, "ClrCredential", "admin") });
    }
    if (action === "admin_review_clr_import") return json({ success: true, import: await reviewClrImport(sb, session, body) });
    if (action === "admin_skills_passports") return json({ success: true, passports: await adminSkillsPassports(sb) });
    if (action === "admin_verify_skills_passport") {
      const { data: passport, error } = await sb.from("skills_passports").select("*").eq("id", text(body.passport_id, 80)).maybeSingle();
      if (error) throw error;
      if (!passport) throw new Error("SKILLS_PASSPORT_NOT_FOUND");
      if (!passport.presentation_jwt) throw new Error("SKILLS_PASSPORT_NOT_SIGNED");
      return json({ success: true, verification: await verifyPortableCredential(sb, String(passport.presentation_jwt), req, passport as JsonRecord, "OmniaSkillsPassportCredential", "admin") });
    }
    throw new Error("UNKNOWN_ACTION");
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "UNAUTHENTICATED" ? 401 : ["FORBIDDEN","LEARNER_ROLE_REQUIRED"].includes(message) ? 403 : message.endsWith("_NOT_FOUND") ? 404 : 400;
    return json({ success: false, error: message }, status);
  }
});
