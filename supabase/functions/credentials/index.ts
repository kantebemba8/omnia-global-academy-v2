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

function canonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as JsonRecord).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, canonicalJson(item)]));
  }
  return value;
}

function stableJson(value: unknown): string {
  return JSON.stringify(canonicalJson(value));
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
    .insert({
      user_id: userId,
      title: "Omnia Learning Record",
      description: "Dossier vérifié des réalisations Omnia.",
      summary: "Parcours de formation, compétences, expériences et réalisations vérifiées dans Omnia Global Academy.",
    })
    .select("*").single();
  if (insertError) throw insertError;
  return data as JsonRecord;
}

function related(value: unknown): JsonRecord | null {
  if (Array.isArray(value)) return value.length && value[0] && typeof value[0] === "object" ? value[0] as JsonRecord : null;
  return value && typeof value === "object" ? value as JsonRecord : null;
}

function objectArray(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object").map((item) => item as JsonRecord) : [];
}

function learningOutcomeNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => {
    if (typeof item === "string") return text(item, 180);
    if (item && typeof item === "object") {
      const row = item as JsonRecord;
      return text(row.name || row.title || row.label || row.outcome || row.description, 180);
    }
    return "";
  }).filter(Boolean))].slice(0, 30);
}

function errorRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" ? value as JsonRecord : {};
}

function optionalRelationError(value: unknown): boolean {
  const error = errorRecord(value);
  const code = text(error.code, 30);
  const message = text(error.message || error.details || error.hint, 1000).toLowerCase();
  return ["42P01", "42703", "PGRST200", "PGRST204", "PGRST205"].includes(code)
    || message.includes("could not find the table")
    || message.includes("schema cache")
    || message.includes("does not exist");
}

async function optionalRows(query: PromiseLike<{ data: unknown; error: unknown }>): Promise<JsonRecord[]> {
  const result = await query;
  if (result.error) {
    if (optionalRelationError(result.error)) return [];
    throw result.error;
  }
  return Array.isArray(result.data) ? result.data as JsonRecord[] : [];
}

const CLR_SECTION_ORDER = [
  "formations", "certificats", "competences_verifiees", "evaluations", "badges",
  "coaching", "omnia_live", "projets", "experiences", "recommandations",
  "engagement_communautaire",
];

const CLR_MANUAL_SECTIONS = new Set(["experiences", "projets", "recommandations", "certificats"]);
const CLR_VISIBILITIES = new Set(["private", "oga", "recruiters", "structure", "public"]);

function entryCredential(row: JsonRecord, record: JsonRecord, issuer: JsonRecord): JsonRecord {
  const existing = row.payload as JsonRecord | undefined;
  const existingTypes = Array.isArray(existing?.type) ? existing?.type.map(String) : [];
  if (existing && existingTypes.some((value) => ["AchievementCredential", "OpenBadgeCredential"].includes(value))) return existing;

  const subject: JsonRecord = {
    id: `urn:uuid:${record.record_uuid}`,
    type: ["AchievementSubject"],
    achievement: {
      id: `${appBaseUrl()}/credentials/clr/entries/${row.id}`,
      type: ["Achievement"],
      name: String(row.title || "Réalisation Omnia"),
      description: String(row.description || row.title || "Réalisation enregistrée dans Omnia Global Academy."),
      achievementType: String(row.achievement_type || "Achievement"),
      creator: {
        id: row.issuer_url || issuer.did || issuer.issuer_uri,
        type: ["Profile"],
        name: row.issuer_name || issuer.name,
      },
      criteria: {
        narrative: row.verification_status === "verified"
          ? "Réalisation vérifiée par Omnia Global Academy ou par une source institutionnelle enregistrée."
          : row.verification_status === "pending_review"
          ? "Credential externe importé et conservé en attente de validation."
          : "Réalisation déclarée par le titulaire du Learning Record.",
      },
    },
  };
  if (row.started_at) subject.activityStartDate = row.started_at;
  if (row.ended_at) subject.activityEndDate = row.ended_at;

  return {
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json",
    ],
    id: `urn:uuid:${row.id}`,
    type: ["VerifiableCredential", "AchievementCredential"],
    name: String(row.title || "Réalisation Omnia"),
    description: String(row.description || row.title || "Réalisation enregistrée dans Omnia Global Academy."),
    issuer: {
      id: row.issuer_url || issuer.did || issuer.issuer_uri,
      type: ["Profile"],
      name: row.issuer_name || issuer.name,
    },
    validFrom: String(row.issued_at || row.ended_at || row.created_at || new Date().toISOString()),
    credentialSubject: subject,
    credentialSchema: [{
      id: "https://purl.imsglobal.org/spec/ob/v3p0/schema/json/ob_v3p0_achievementcredential_schema.json",
      type: "1EdTechJsonSchemaValidator2019",
    }],
  };
}

async function syncPlatformSources(sb: Supabase, userId: string) {
  const record = await getOrCreateClr(sb, userId);
  const rows: JsonRecord[] = [];
  const now = new Date().toISOString();

  const completedCourses = await optionalRows(sb.from("user_enrollments")
    .select("id,course_id,enrolled_at,completed_at,course:courses(id,title,short_description,category,level,cpd_hours,learning_outcomes,objectives,language,updated_at)")
    .eq("user_id", userId).not("completed_at", "is", null));
  for (const enrollment of completedCourses) {
    const course = related(enrollment.course);
    if (!course) continue;
    const skills = learningOutcomeNames(course.learning_outcomes).length
      ? learningOutcomeNames(course.learning_outcomes)
      : learningOutcomeNames(course.objectives);
    rows.push({
      clr_record_id: record.id,
      source_type: "course_completion",
      source_id: String(enrollment.id || enrollment.course_id),
      title: String(course.title || "Formation terminée"),
      description: nullableText(course.short_description, 2500),
      achievement_type: "Course",
      section: "formations",
      status: "active",
      visibility: "oga",
      issued_at: enrollment.completed_at || enrollment.enrolled_at,
      started_at: enrollment.enrolled_at,
      ended_at: enrollment.completed_at,
      entry_origin: "platform",
      verification_status: "verified",
      issuer_name: "Omnia Global Academy",
      issuer_url: `${appBaseUrl()}/credentials/issuers/omnia-global-academy`,
      skills,
      result_label: [course.category, course.level].filter(Boolean).join(" · ") || null,
      learner_editable: false,
      source_updated_at: course.updated_at || enrollment.completed_at || now,
      metadata: { course_id: enrollment.course_id, cpd_hours: course.cpd_hours || 0, language: course.language || "fr" },
    });
  }

  const certificates = await optionalRows(sb.from("certificates")
    .select("id,omnia_certificate_id,user_id,course_id,course_title,course_level,course_category,cpd_hours,status,validity_status,revoked_at,revocation_reason,pdf_url,verification_url,issued_at,expires_at,issuer_name,document_type,metadata,course:courses(id,short_description,learning_outcomes,objectives,updated_at)")
    .eq("user_id", userId));
  for (const certificate of certificates) {
    const course = related(certificate.course);
    const revoked = certificate.status === "revoque" || certificate.status === "revoked" || certificate.validity_status === "revoked" || Boolean(certificate.revoked_at);
    rows.push({
      clr_record_id: record.id,
      source_type: "certificate",
      source_id: String(certificate.id),
      title: String(certificate.course_title || "Certificat Omnia"),
      description: nullableText(course?.short_description || certificate.document_type, 2500),
      achievement_type: "Certificate",
      section: "certificats",
      status: revoked ? "revoked" : "active",
      visibility: "recruiters",
      issued_at: certificate.issued_at,
      ended_at: certificate.issued_at,
      entry_origin: "platform",
      verification_status: revoked ? "revoked" : "verified",
      issuer_name: certificate.issuer_name || "Omnia Global Academy",
      issuer_url: certificate.verification_url || `${appBaseUrl()}/credentials/issuers/omnia-global-academy`,
      external_url: certificate.verification_url || certificate.pdf_url || null,
      skills: learningOutcomeNames(course?.learning_outcomes).length ? learningOutcomeNames(course?.learning_outcomes) : learningOutcomeNames(course?.objectives),
      result_label: [certificate.course_category, certificate.course_level].filter(Boolean).join(" · ") || null,
      evidence: certificate.pdf_url ? [{ type: "Certificate", name: certificate.omnia_certificate_id, id: certificate.pdf_url }] : [],
      learner_editable: false,
      source_updated_at: certificate.issued_at || course?.updated_at || now,
      metadata: { course_id: certificate.course_id, credential_id: certificate.omnia_certificate_id, cpd_hours: certificate.cpd_hours || 0, expires_at: certificate.expires_at || null, revocation_reason: certificate.revocation_reason || null },
    });
  }

  const assessmentAttempts = await optionalRows(sb.from("assessment_attempts")
    .select("id,assessment_id,course_id,attempt_number,status,score,passed,started_at,submitted_at,graded_at,feedback,assessment:course_assessments(id,title,scope,passing_score),course:courses(id,title,category,level,learning_outcomes,objectives,updated_at)")
    .eq("user_id", userId).eq("passed", true).order("graded_at", { ascending: false }));
  const bestAssessment = new Map<string, JsonRecord>();
  for (const attempt of assessmentAttempts) {
    const key = String(attempt.assessment_id || attempt.id);
    const current = bestAssessment.get(key);
    if (!current || Number(attempt.score || 0) > Number(current.score || 0)) bestAssessment.set(key, attempt);
  }
  for (const attempt of bestAssessment.values()) {
    const assessment = related(attempt.assessment);
    const course = related(attempt.course);
    rows.push({
      clr_record_id: record.id,
      source_type: "assessment",
      source_id: String(attempt.assessment_id || attempt.id),
      title: String(assessment?.title || `Évaluation — ${course?.title || "Omnia"}`),
      description: nullableText(attempt.feedback || `Évaluation ${assessment?.scope || "validée"}.`, 2500),
      achievement_type: "Assessment",
      section: "evaluations",
      status: "active",
      visibility: "recruiters",
      issued_at: attempt.graded_at || attempt.submitted_at,
      started_at: attempt.started_at,
      ended_at: attempt.graded_at || attempt.submitted_at,
      score: attempt.score,
      score_max: 100,
      result_label: `Réussie · seuil ${assessment?.passing_score || "—"}%`,
      entry_origin: "platform",
      verification_status: "verified",
      issuer_name: "Omnia Global Academy",
      issuer_url: `${appBaseUrl()}/credentials/issuers/omnia-global-academy`,
      skills: learningOutcomeNames(course?.learning_outcomes).length ? learningOutcomeNames(course?.learning_outcomes) : learningOutcomeNames(course?.objectives),
      learner_editable: false,
      source_updated_at: attempt.graded_at || course?.updated_at || now,
      metadata: { course_id: attempt.course_id, assessment_id: attempt.assessment_id, attempt_number: attempt.attempt_number, course_title: course?.title || null },
    });
  }

  const assignments = await optionalRows(sb.from("course_assignment_submissions")
    .select("id,course_id,lesson_id,block_id,file_url,file_name,answer_text,status,score,evaluator_comment,submitted_at,evaluated_at,updated_at,course:courses(id,title,category,level,learning_outcomes,objectives),lesson:course_lessons(id,title),block:lesson_blocks(id,title)")
    .eq("learner_id", userId).eq("status", "graded"));
  for (const assignment of assignments) {
    const course = related(assignment.course);
    const lesson = related(assignment.lesson);
    const block = related(assignment.block);
    rows.push({
      clr_record_id: record.id,
      source_type: "course_project",
      source_id: String(assignment.id),
      title: String(block?.title || lesson?.title || `Projet — ${course?.title || "Omnia"}`),
      description: nullableText(assignment.evaluator_comment || assignment.answer_text || `Projet évalué dans la formation ${course?.title || "Omnia"}.`, 2500),
      achievement_type: "Project",
      section: "projets",
      status: "active",
      visibility: "recruiters",
      issued_at: assignment.evaluated_at || assignment.submitted_at,
      started_at: assignment.submitted_at,
      ended_at: assignment.evaluated_at,
      score: assignment.score,
      score_max: 100,
      result_label: course?.title || null,
      entry_origin: "platform",
      verification_status: "verified",
      issuer_name: "Omnia Global Academy",
      issuer_url: `${appBaseUrl()}/credentials/issuers/omnia-global-academy`,
      external_url: assignment.file_url || null,
      evidence: assignment.file_url ? [{ type: "Evidence", name: assignment.file_name || "Livrable du projet", id: assignment.file_url }] : [],
      skills: learningOutcomeNames(course?.learning_outcomes).length ? learningOutcomeNames(course?.learning_outcomes) : learningOutcomeNames(course?.objectives),
      learner_editable: false,
      source_updated_at: assignment.updated_at || assignment.evaluated_at || now,
      metadata: { course_id: assignment.course_id, lesson_id: assignment.lesson_id, block_id: assignment.block_id },
    });
  }

  const liveDocuments = await optionalRows(sb.from("live_issued_documents")
    .select("id,event_id,document_type,document_number,verification_code,verification_url,event_title,organizer_name,issue_date,attendance_percent,sessions_attended,sessions_total,assessment_score,cpd_hours,cpd_points,status,revoked_at,revocation_reason,created_at")
    .eq("user_id", userId));
  for (const document of liveDocuments) {
    const revoked = document.status === "revoked" || Boolean(document.revoked_at);
    rows.push({
      clr_record_id: record.id,
      source_type: "live_document",
      source_id: String(document.id),
      title: String(document.event_title || "Participation Omnia Live"),
      description: `Document ${document.document_type || "de participation"} émis pour une activité Omnia Live.`,
      achievement_type: "ProfessionalDevelopment",
      section: "omnia_live",
      status: revoked ? "revoked" : "active",
      visibility: "recruiters",
      issued_at: document.issue_date || document.created_at,
      ended_at: document.issue_date || document.created_at,
      score: document.assessment_score,
      score_max: document.assessment_score === null || document.assessment_score === undefined ? null : 100,
      result_label: document.attendance_percent !== null && document.attendance_percent !== undefined ? `${document.attendance_percent}% de présence` : null,
      entry_origin: "platform",
      verification_status: revoked ? "revoked" : "verified",
      issuer_name: document.organizer_name || "Omnia Global Academy",
      issuer_url: document.verification_url || `${appBaseUrl()}/credentials/issuers/omnia-global-academy`,
      external_url: document.verification_url || null,
      learner_editable: false,
      source_updated_at: document.created_at || now,
      metadata: { event_id: document.event_id, document_number: document.document_number, verification_code: document.verification_code, sessions_attended: document.sessions_attended, sessions_total: document.sessions_total, cpd_hours: document.cpd_hours, cpd_points: document.cpd_points, revocation_reason: document.revocation_reason || null },
    });
  }

  const liveEligibility = await optionalRows(sb.from("live_certificate_eligibility")
    .select("id,event_id,attendance_seconds,attendance_percent,evaluation_passed,eligible,eligibility_reason,document_type,calculated_at,event:live_events(id,title,short_description,event_type,delivery_type,starts_at,duration_minutes,organizer_display_name,learning_outcomes,updated_at)")
    .eq("user_id", userId).eq("eligible", true));
  const documentedEventIds = new Set(liveDocuments.map((item) => String(item.event_id)));
  for (const eligibility of liveEligibility) {
    if (documentedEventIds.has(String(eligibility.event_id))) continue;
    const event = related(eligibility.event);
    if (!event) continue;
    rows.push({
      clr_record_id: record.id,
      source_type: "live_participation",
      source_id: String(eligibility.id),
      title: String(event.title || "Omnia Live"),
      description: nullableText(event.short_description || eligibility.eligibility_reason, 2500),
      achievement_type: "ProfessionalDevelopment",
      section: "omnia_live",
      status: "active",
      visibility: "oga",
      issued_at: eligibility.calculated_at || event.starts_at,
      started_at: event.starts_at,
      ended_at: eligibility.calculated_at,
      result_label: eligibility.attendance_percent !== null && eligibility.attendance_percent !== undefined ? `${eligibility.attendance_percent}% de présence` : null,
      entry_origin: "platform",
      verification_status: "verified",
      issuer_name: event.organizer_display_name || "Omnia Global Academy",
      issuer_url: `${appBaseUrl()}/credentials/issuers/omnia-global-academy`,
      skills: learningOutcomeNames(event.learning_outcomes),
      learner_editable: false,
      source_updated_at: event.updated_at || eligibility.calculated_at || now,
      metadata: { event_id: eligibility.event_id, event_type: event.event_type, delivery_type: event.delivery_type, duration_minutes: event.duration_minutes, evaluation_passed: eligibility.evaluation_passed },
    });
  }

  const coachingSessions = await optionalRows(sb.from("coaching_sessions")
    .select("id,learner_user_id,status,payment_status,scheduled_start,scheduled_end,actual_started_at,actual_ended_at,duration_minutes,offer_title_snapshot,coach_name_snapshot,updated_at")
    .eq("learner_user_id", userId).eq("status", "completed"));
  for (const session of coachingSessions) {
    rows.push({
      clr_record_id: record.id,
      source_type: "coaching_session",
      source_id: String(session.id),
      title: String(session.offer_title_snapshot || "Session de coaching individuel"),
      description: `Session individuelle réalisée avec ${session.coach_name_snapshot || "un coach Omnia"}.`,
      achievement_type: "ProfessionalDevelopment",
      section: "coaching",
      status: "active",
      visibility: "oga",
      issued_at: session.actual_ended_at || session.scheduled_end || session.updated_at,
      started_at: session.actual_started_at || session.scheduled_start,
      ended_at: session.actual_ended_at || session.scheduled_end,
      result_label: session.duration_minutes ? `${session.duration_minutes} minutes` : null,
      entry_origin: "platform",
      verification_status: "verified",
      issuer_name: session.coach_name_snapshot || "Coach Omnia",
      issuer_url: `${appBaseUrl()}/coaching`,
      learner_editable: false,
      source_updated_at: session.updated_at || session.actual_ended_at || now,
      metadata: { payment_status: session.payment_status },
    });
  }

  const groupRegistrations = await optionalRows(sb.from("coaching_group_registrations")
    .select("id,program_id,status,joined_at,left_at,created_at,program:coaching_group_programs(id,title,description,scheduled_start,scheduled_end,status,coach_id,updated_at)")
    .eq("user_id", userId).eq("status", "attended"));
  for (const registration of groupRegistrations) {
    const program = related(registration.program);
    if (!program) continue;
    rows.push({
      clr_record_id: record.id,
      source_type: "coaching_group",
      source_id: String(registration.id),
      title: String(program.title || "Session de coaching collectif"),
      description: nullableText(program.description, 2500),
      achievement_type: "ProfessionalDevelopment",
      section: "coaching",
      status: "active",
      visibility: "oga",
      issued_at: registration.left_at || program.scheduled_end || program.updated_at,
      started_at: registration.joined_at || program.scheduled_start,
      ended_at: registration.left_at || program.scheduled_end,
      entry_origin: "platform",
      verification_status: "verified",
      issuer_name: "Omnia Coaching",
      issuer_url: `${appBaseUrl()}/coaching`,
      learner_editable: false,
      source_updated_at: program.updated_at || registration.left_at || now,
      metadata: { program_id: registration.program_id },
    });
  }

  const actionPlans = await optionalRows(sb.from("coaching_action_plans")
    .select("id,session_id,title,summary,next_session_recommendation,status,learner_visible,updated_at,session:coaching_sessions(id,coach_name_snapshot,offer_title_snapshot,scheduled_start)")
    .eq("learner_user_id", userId).eq("learner_visible", true));
  for (const plan of actionPlans) {
    const session = related(plan.session);
    rows.push({
      clr_record_id: record.id,
      source_type: "coaching_recommendation",
      source_id: String(plan.id),
      title: String(plan.title || "Recommandation du coach"),
      description: nullableText(plan.summary || plan.next_session_recommendation, 2500),
      achievement_type: "Recommendation",
      section: "recommandations",
      status: plan.status === "archived" ? "hidden" : "active",
      visibility: "private",
      issued_at: plan.updated_at || session?.scheduled_start,
      entry_origin: "platform",
      verification_status: "verified",
      issuer_name: session?.coach_name_snapshot || "Coach Omnia",
      issuer_url: `${appBaseUrl()}/coaching`,
      learner_editable: false,
      source_updated_at: plan.updated_at || now,
      metadata: { session_id: plan.session_id, next_session_recommendation: plan.next_session_recommendation || null, session_title: session?.offer_title_snapshot || null },
    });
  }

  const forumPosts = await optionalRows(sb.from("forum_posts")
    .select("id,title,content,space,likes_count,replies_count,is_pinned,is_solved,created_at")
    .eq("user_id", userId).eq("is_visible", true));
  for (const post of forumPosts.filter((item) => Number(item.likes_count || 0) > 0 || Number(item.replies_count || 0) > 0 || item.is_pinned || item.is_solved)) {
    rows.push({
      clr_record_id: record.id,
      source_type: "community_contribution",
      source_id: String(post.id),
      title: String(post.title || "Contribution utile à la communauté"),
      description: nullableText(post.content, 600),
      achievement_type: "CommunityService",
      section: "engagement_communautaire",
      status: "active",
      visibility: "oga",
      issued_at: post.created_at,
      entry_origin: "platform",
      verification_status: "verified",
      issuer_name: "Communauté Omnia",
      issuer_url: `${appBaseUrl()}/forum`,
      result_label: `${Number(post.likes_count || 0)} appréciation(s) · ${Number(post.replies_count || 0)} réponse(s)`,
      learner_editable: false,
      source_updated_at: post.created_at || now,
      metadata: { space: post.space, is_pinned: Boolean(post.is_pinned), is_solved: Boolean(post.is_solved), professional_skill: false },
    });
  }

  // Les compétences professionnelles sont dérivées uniquement de sources Omnia
  // vérifiées (formations, certificats, évaluations et projets). Les contributions
  // du Forum restent dans l'engagement communautaire et ne créent jamais une compétence.
  const competencyMap = new Map<string, { name: string; issuedAt: string | null; sources: Array<{ type: string; id: string; title: string }> }>();
  for (const source of rows) {
    if (source.verification_status !== "verified" || source.section === "engagement_communautaire" || source.source_type === "competency") continue;
    for (const skill of stringArray(source.skills, 50, 160)) {
      const key = slugify(skill);
      const current = competencyMap.get(key) || { name: skill, issuedAt: null, sources: [] };
      const issuedAt = nullableText(source.issued_at, 80);
      if (issuedAt && (!current.issuedAt || new Date(issuedAt) > new Date(current.issuedAt))) current.issuedAt = issuedAt;
      current.sources.push({ type: String(source.source_type), id: String(source.source_id), title: String(source.title) });
      competencyMap.set(key, current);
    }
  }
  for (const [key, competency] of competencyMap) {
    rows.push({
      clr_record_id: record.id,
      source_type: "competency",
      source_id: key,
      title: competency.name,
      description: "Compétence démontrée par des réalisations vérifiées dans Omnia Global Academy.",
      achievement_type: "Competency",
      section: "competences_verifiees",
      status: "active",
      visibility: "recruiters",
      issued_at: competency.issuedAt || now,
      ended_at: competency.issuedAt || now,
      entry_origin: "platform",
      verification_status: "verified",
      issuer_name: "Omnia Global Academy",
      issuer_url: `${appBaseUrl()}/credentials/issuers/omnia-global-academy`,
      skills: [competency.name],
      evidence: competency.sources.slice(0, 25).map((source) => ({ type: "Evidence", name: source.title, id: `${source.type}:${source.id}` })),
      learner_editable: false,
      source_updated_at: competency.issuedAt || now,
      metadata: { evidence_sources: competency.sources.slice(0, 100), source_count: competency.sources.length, professional_skill: true },
    });
  }

  if (rows.length) {
    const { data: existingRows, error: existingError } = await sb.from("clr_achievements")
      .select("id,source_type,source_id,visibility,status,is_featured,sort_order")
      .eq("clr_record_id", record.id);
    if (existingError) throw existingError;
    const existingMap = new Map((existingRows || []).map((item: JsonRecord) => [`${item.source_type}:${item.source_id}`, item]));
    const merged = rows.map((item) => {
      const existing = existingMap.get(`${item.source_type}:${item.source_id}`);
      return existing ? {
        ...item,
        id: existing.id,
        visibility: existing.visibility || item.visibility,
        status: existing.status === "hidden" ? "hidden" : item.status,
        is_featured: Boolean(existing.is_featured),
        sort_order: Number(existing.sort_order || 0),
      } : item;
    });
    const { error } = await sb.from("clr_achievements").upsert(merged, { onConflict: "clr_record_id,source_type,source_id" });
    if (error) throw error;
  }

  const { error: syncError } = await sb.from("clr_records").update({ last_synced_at: now }).eq("id", record.id);
  if (syncError) throw syncError;
  return { record, synced_entries: rows.length };
}

async function rebuildClr(sb: Supabase, userId: string) {
  const record = await getOrCreateClr(sb, userId);
  const [{ data: achievements, error: achievementError }, { data: user, error: userError }, issuer] = await Promise.all([
    sb.from("clr_achievements").select("*").eq("clr_record_id", record.id).order("sort_order").order("issued_at", { ascending: false }),
    sb.from("users").select("id,full_name,email,avatar_url,country_code").eq("id", userId).maybeSingle(),
    getIssuer(sb),
  ]);
  if (achievementError) throw achievementError;
  if (userError) throw userError;
  if (!user) throw new Error("USER_NOT_FOUND");

  const hiddenSections = new Set(stringArray(record.hidden_sections, 30, 80));
  const included = (achievements || []).filter((row: JsonRecord) => row.status === "active" && row.verification_status !== "rejected" && !hiddenSections.has(String(row.section)));
  const payload = {
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      "https://purl.imsglobal.org/spec/clr/v2p0/context-2.0.1.json",
      "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json",
    ],
    id: `urn:uuid:${record.record_uuid}`,
    type: ["VerifiableCredential", "ClrCredential"],
    name: String(record.title || "Omnia Learning Record"),
    description: String(record.summary || record.description || "Dossier vérifié des réalisations Omnia."),
    issuer: {
      id: issuer.did || issuer.issuer_uri,
      type: ["Profile"],
      name: issuer.name,
      ...(issuer.website_url ? { url: issuer.website_url } : {}),
    },
    credentialSubject: {
      id: `urn:uuid:${record.record_uuid}`,
      type: ["ClrSubject"],
      name: user.full_name,
      verifiableCredential: included.map((row: JsonRecord) => entryCredential(row, record, issuer)),
    },
    validFrom: String(record.created_at || new Date().toISOString()),
    credentialSchema: [{
      id: "https://purl.imsglobal.org/spec/clr/v2p0/schema/json/clr_v2p0_clrcredential_schema.json",
      type: "1EdTechJsonSchemaValidator2019",
    }],
  };
  const unchanged = stableJson(record.clr_json || {}) === stableJson(payload);
  if (unchanged) return { record, achievements: achievements || [] };
  const nextVersion = record.last_built_at ? Number(record.version || 1) + 1 : Number(record.version || 1);
  const { data: updated, error: updateError } = await sb.from("clr_records")
    .update({
      clr_json: payload,
      clr_jwt: null,
      signing_key_id: null,
      signed_at: null,
      signature_alg: null,
      credential_hash: null,
      verification_result: {},
      standards_status: "clr2_draft",
      version: nextVersion,
      last_built_at: new Date().toISOString(),
    })
    .eq("id", record.id).select("*").single();
  if (updateError) throw updateError;
  return { record: updated, achievements: achievements || [] };
}

function clrCredentialStructureChecks(payload: JsonRecord) {
  const contexts = Array.isArray(payload["@context"]) ? payload["@context"].map(String) : [];
  const types = Array.isArray(payload.type) ? payload.type.map(String) : [];
  const issuer = payload.issuer as JsonRecord | undefined;
  const subject = payload.credentialSubject as JsonRecord | undefined;
  const hasCredentialsArray = Array.isArray(subject?.verifiableCredential);
  const credentials = hasCredentialsArray ? subject?.verifiableCredential as unknown[] : [];
  const schema = Array.isArray(payload.credentialSchema) ? payload.credentialSchema as JsonRecord[] : [];
  const validFrom = text(payload.validFrom, 80);
  const checks = {
    context: contexts.includes("https://purl.imsglobal.org/spec/clr/v2p0/context-2.0.1.json"),
    type: types.includes("ClrCredential") && types.includes("VerifiableCredential"),
    issuer: Boolean(issuer?.id && payload.iss === issuer.id),
    subject: Boolean(subject?.id && payload.sub === subject.id),
    credential_id: Boolean(payload.id && payload.jti === payload.id),
    valid_from: Boolean(validFrom && Number(payload.nbf) === numericDate(validFrom)),
    credentials: hasCredentialsArray,
    schema: schema.some((item) => String(item.id || "").includes("clr_v2p0_clrcredential_schema.json")),
  };
  return { checks, valid: Object.values(checks).every(Boolean) };
}

async function verifyCompactClr(sb: Supabase, compactJws: string, req: Request, record: JsonRecord | null) {
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
    const structure = clrCredentialStructureChecks(payload);
    structureValid = structure.valid;
    structureChecks = structure.checks;
    if (!structureValid) errorCode = "CLR_STRUCTURE_INVALID";
    const now = Date.now();
    statusValid = (!payload.validFrom || new Date(String(payload.validFrom)).getTime() <= now)
      && (!payload.validUntil || new Date(String(payload.validUntil)).getTime() >= now)
      && (!record || String(record.status) === "active");
    if (record) {
      const actualHash = await sha256(compactJws);
      if (record.credential_hash && String(record.credential_hash) !== actualHash) {
        statusValid = false;
        errorCode = "CLR_HASH_MISMATCH";
      }
      if (payload.jti !== (record.clr_json as JsonRecord | undefined)?.id) {
        structureValid = false;
        errorCode = "CLR_REGISTRY_MISMATCH";
      }
    }
  } catch (cause) {
    errorCode = cause instanceof Error ? cause.message : "CLR_SIGNATURE_INVALID";
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
  if (record?.id) await sb.from("clr_records").update({ verification_result: result }).eq("id", record.id);
  return { result, keyRow };
}

async function signClr(sb: Supabase, userId: string, actorUserId: string, req: Request) {
  await syncPlatformSources(sb, userId);
  const rebuilt = await rebuildClr(sb, userId);
  const key = await syncSigningKey(sb, req, actorUserId);
  const signed = await signCredential(rebuilt.record.clr_json as JsonRecord, req);
  const hash = await sha256(signed.compactJws);
  const signedAt = new Date().toISOString();
  const { data: updated, error } = await sb.from("clr_records").update({
    clr_json: rebuilt.record.clr_json,
    clr_jwt: signed.compactJws,
    signing_key_id: key.id,
    signed_at: signedAt,
    signature_alg: "RS256",
    credential_hash: hash,
    standards_status: "clr2_signed",
  }).eq("id", rebuilt.record.id).select("*").single();
  if (error) throw error;
  const verification = await verifyCompactClr(sb, signed.compactJws, req, updated as JsonRecord);
  if (!verification.result.overall_valid) throw new Error(verification.result.error_code || "CLR_SIGNING_PREFLIGHT_FAILED");
  await sb.from("clr_audit_logs").insert({ actor_user_id: actorUserId, record_id: updated.id, action: "clr_signed", metadata: { key_id: signed.config.keyId, version: updated.version } });
  return { record: { ...updated, verification_result: verification.result }, jwt: signed.compactJws };
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
  const { data: record, error: recordError } = await sb.from("clr_records")
    .select("*,user:users!clr_records_user_id_fkey(id,full_name,avatar_url,country_code)")
    .eq("id", share.clr_record_id).maybeSingle();
  if (recordError) throw recordError;
  if (!record) throw new Error("CLR_NOT_FOUND");
  const allowed = new Set(stringArray(share.include_sections, 30, 80));
  const visibility = String(share.visibility_filter || "public");
  const visibleValues = visibility === "public" ? ["public"] : [visibility, "public"];
  const { data: achievements, error: achievementError } = await sb.from("clr_achievements")
    .select("*").eq("clr_record_id", record.id).eq("status", "active").in("visibility", visibleValues)
    .order("sort_order").order("issued_at", { ascending: false });
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
      section_order: record.section_order,
      hidden_sections: record.hidden_sections,
      version: record.version,
      standards_status: record.standards_status,
      signed_at: record.signed_at,
      verification_result: record.verification_result,
      user: record.user ? { full_name: record.user.full_name, avatar_url: record.user.avatar_url, country_code: record.user.country_code } : null,
    },
    share: { label: share.label, expires_at: share.expires_at, visibility_filter: share.visibility_filter, include_sections: share.include_sections },
    achievements: (achievements || [])
      .filter((row: JsonRecord) => (!allowed.size || allowed.has(String(row.section))) && row.verification_status !== "rejected")
      .map((row: JsonRecord) => ({
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
        skills: row.skills,
        evidence: row.evidence,
        external_url: row.external_url,
        issuer_name: row.issuer_name,
        entry_origin: row.entry_origin,
        verification_status: row.verification_status,
        is_featured: row.is_featured,
        metadata: row.metadata,
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
  await syncPlatformSources(sb, session.userId);
  const rebuilt = await rebuildClr(sb, session.userId);
  const record = rebuilt.record;
  const token = randomToken();
  const tokenHash = await sha256(token);
  const days = integer(body.validity_days);
  const expiresAt = days && days > 0 ? new Date(Date.now() + Math.min(days, 3650) * 86400000).toISOString() : null;
  const requestedSections = stringArray(body.include_sections, 30, 80).filter((section) => CLR_SECTION_ORDER.includes(section));
  const visibilityFilter = text(body.visibility_filter, 30) || "public";
  if (!["oga","recruiters","structure","public"].includes(visibilityFilter)) throw new Error("INVALID_VISIBILITY");
  const { data, error } = await sb.from("clr_shares").insert({
    clr_record_id: record.id,
    token_hash: tokenHash,
    label: nullableText(body.label, 180),
    include_sections: requestedSections.length ? requestedSections : stringArray(record.section_order, 30, 80),
    visibility_filter: visibilityFilter,
    expires_at: expiresAt,
    created_by: session.userId,
  }).select("id,label,include_sections,visibility_filter,expires_at,created_at").single();
  if (error) throw error;
  await sb.from("clr_audit_logs").insert({ actor_user_id: session.userId, record_id: record.id, action: "share_created", metadata: { share_id: data.id, include_sections: data.include_sections } });
  return { ...data, token, url: `${appBaseUrl()}/credentials/clr/${token}` };
}

async function updateClrProfile(sb: Supabase, session: Session, body: JsonRecord) {
  const record = await getOrCreateClr(sb, session.userId);
  const order = stringArray(body.section_order, 30, 80).filter((section) => CLR_SECTION_ORDER.includes(section));
  const hidden = stringArray(body.hidden_sections, 30, 80).filter((section) => CLR_SECTION_ORDER.includes(section));
  const visibility = text(body.default_visibility, 30) || String(record.default_visibility || "oga");
  if (!CLR_VISIBILITIES.has(visibility)) throw new Error("INVALID_VISIBILITY");
  const payload = {
    title: text(body.title, 180) || "Omnia Learning Record",
    description: nullableText(body.description, 1000),
    profile_headline: nullableText(body.profile_headline, 220),
    summary: nullableText(body.summary, 3000),
    language_code: text(body.language_code, 12) || "fr",
    default_visibility: visibility,
    section_order: order.length ? order : CLR_SECTION_ORDER,
    hidden_sections: hidden,
  };
  const { data, error } = await sb.from("clr_records").update(payload).eq("id", record.id).select("*").single();
  if (error) throw error;
  await rebuildClr(sb, session.userId);
  await sb.from("clr_audit_logs").insert({ actor_user_id: session.userId, record_id: record.id, action: "profile_updated", metadata: { hidden_sections: hidden } });
  return data;
}

async function saveManualClrEntry(sb: Supabase, session: Session, body: JsonRecord) {
  const record = await getOrCreateClr(sb, session.userId);
  const id = nullableText(body.id, 80);
  const section = text(body.section, 80);
  if (!CLR_MANUAL_SECTIONS.has(section)) throw new Error("CLR_SECTION_NOT_EDITABLE");
  const title = text(body.title, 220);
  if (!title) throw new Error("CLR_ENTRY_TITLE_REQUIRED");
  const visibility = text(body.visibility, 30) || "private";
  if (!CLR_VISIBILITIES.has(visibility)) throw new Error("INVALID_VISIBILITY");
  const start = nullableText(body.started_at, 40);
  const end = nullableText(body.ended_at, 40);
  if (start && Number.isNaN(new Date(start).getTime())) throw new Error("CLR_ENTRY_DATE_INVALID");
  if (end && Number.isNaN(new Date(end).getTime())) throw new Error("CLR_ENTRY_DATE_INVALID");
  if (start && end && new Date(end) < new Date(start)) throw new Error("CLR_ENTRY_DATE_INVALID");
  const sourceId = id || crypto.randomUUID();
  const payload = {
    clr_record_id: record.id,
    source_type: `manual_${section}`,
    source_id: sourceId,
    title,
    description: nullableText(body.description, 3000),
    achievement_type: section === "projets" ? "Project" : section === "experiences" ? "WorkExperience" : section === "recommandations" ? "Recommendation" : "Certificate",
    section,
    status: "active",
    visibility,
    issued_at: end || start || new Date().toISOString(),
    started_at: start,
    ended_at: end,
    result_label: nullableText(body.result_label, 300),
    skills: stringArray(body.skills, 30, 180),
    evidence: objectArray(body.evidence).slice(0, 20),
    external_url: nullableText(body.external_url, 1000),
    issuer_name: nullableText(body.issuer_name, 220),
    issuer_url: nullableText(body.issuer_url, 1000),
    entry_origin: "manual",
    verification_status: "declared",
    learner_editable: true,
    is_featured: bool(body.is_featured),
    metadata: typeof body.metadata === "object" && body.metadata !== null ? body.metadata : {},
    source_updated_at: new Date().toISOString(),
    payload: {},
  };
  let saved: JsonRecord;
  if (id) {
    const { data: current, error: currentError } = await sb.from("clr_achievements").select("*").eq("id", id).eq("clr_record_id", record.id).eq("learner_editable", true).maybeSingle();
    if (currentError) throw currentError;
    if (!current || current.entry_origin !== "manual") throw new Error("CLR_ENTRY_NOT_FOUND");
    const { data, error } = await sb.from("clr_achievements").update({ ...payload, source_id: current.source_id, source_type: current.source_type }).eq("id", id).select("*").single();
    if (error) throw error;
    saved = data as JsonRecord;
  } else {
    const { data, error } = await sb.from("clr_achievements").insert(payload).select("*").single();
    if (error) throw error;
    saved = data as JsonRecord;
  }
  await rebuildClr(sb, session.userId);
  await sb.from("clr_audit_logs").insert({ actor_user_id: session.userId, record_id: record.id, action: id ? "manual_entry_updated" : "manual_entry_created", metadata: { entry_id: saved.id, section } });
  return saved;
}

async function updateClrEntry(sb: Supabase, session: Session, body: JsonRecord) {
  const record = await getOrCreateClr(sb, session.userId);
  const entryId = text(body.entry_id, 80);
  const { data: entry, error } = await sb.from("clr_achievements").select("*").eq("id", entryId).eq("clr_record_id", record.id).maybeSingle();
  if (error) throw error;
  if (!entry) throw new Error("CLR_ENTRY_NOT_FOUND");
  const updates: JsonRecord = {};
  if (body.visibility !== undefined) {
    const visibility = text(body.visibility, 30);
    if (!CLR_VISIBILITIES.has(visibility)) throw new Error("INVALID_VISIBILITY");
    updates.visibility = visibility;
    if (entry.award_id) await sb.from("badge_awards").update({ visibility }).eq("id", entry.award_id).eq("recipient_user_id", session.userId);
  }
  if (body.is_featured !== undefined) updates.is_featured = bool(body.is_featured);
  if (body.hidden !== undefined) updates.status = bool(body.hidden) ? "hidden" : "active";
  if (!Object.keys(updates).length) throw new Error("CLR_ENTRY_UPDATE_EMPTY");
  const { data: updated, error: updateError } = await sb.from("clr_achievements").update(updates).eq("id", entryId).select("*").single();
  if (updateError) throw updateError;
  await rebuildClr(sb, session.userId);
  return updated;
}

async function deleteClrEntry(sb: Supabase, session: Session, body: JsonRecord) {
  const record = await getOrCreateClr(sb, session.userId);
  const entryId = text(body.entry_id, 80);
  const { data: entry, error } = await sb.from("clr_achievements").select("id,entry_origin,learner_editable").eq("id", entryId).eq("clr_record_id", record.id).maybeSingle();
  if (error) throw error;
  if (!entry || !entry.learner_editable || !["manual", "imported"].includes(String(entry.entry_origin))) throw new Error("CLR_ENTRY_NOT_DELETABLE");
  const { error: deleteError } = await sb.from("clr_achievements").delete().eq("id", entryId).eq("clr_record_id", record.id);
  if (deleteError) throw deleteError;
  await rebuildClr(sb, session.userId);
  await sb.from("clr_audit_logs").insert({ actor_user_id: session.userId, record_id: record.id, action: "entry_deleted", metadata: { entry_id: entryId } });
  return { success: true };
}

function base64UrlJson(segment: string): JsonRecord {
  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(segment.length / 4) * 4, "=");
  const binary = atob(normalized);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const value = JSON.parse(new TextDecoder().decode(bytes));
  if (!value || typeof value !== "object") throw new Error("CLR_IMPORT_INVALID");
  return value as JsonRecord;
}

function credentialTypes(payload: JsonRecord): string[] {
  return Array.isArray(payload.type) ? payload.type.map(String) : payload.type ? [String(payload.type)] : [];
}

function importedCredentialRows(payload: JsonRecord): JsonRecord[] {
  const types = credentialTypes(payload);
  if (types.includes("ClrCredential")) {
    const subject = related(payload.credentialSubject);
    return objectArray(subject?.verifiableCredential).slice(0, 200);
  }
  if (types.includes("AchievementCredential") || types.includes("OpenBadgeCredential")) return [payload];
  throw new Error("CLR_IMPORT_CREDENTIAL_TYPE_UNSUPPORTED");
}

function importEntrySection(credential: JsonRecord): string {
  const subject = related(credential.credentialSubject);
  const achievement = related(subject?.achievement);
  const type = text(achievement?.achievementType || credential.name, 120).toLowerCase();
  if (type.includes("course") || type.includes("formation")) return "formations";
  if (type.includes("certificate") || type.includes("degree") || type.includes("diploma")) return "certificats";
  if (type.includes("competenc") || type.includes("skill")) return "competences_verifiees";
  if (type.includes("assessment") || type.includes("exam")) return "evaluations";
  if (type.includes("project")) return "projets";
  if (type.includes("experience") || type.includes("internship") || type.includes("employment")) return "experiences";
  if (type.includes("recommend")) return "recommandations";
  return "badges";
}

async function importClr(sb: Supabase, session: Session, body: JsonRecord, req: Request) {
  const record = await getOrCreateClr(sb, session.userId);
  const sourceFormat = text(body.source_format, 20) || "json";
  if (!["json", "json_ld", "vc_jwt"].includes(sourceFormat)) throw new Error("CLR_IMPORT_FORMAT_INVALID");
  const content = text(body.content, 1500000);
  if (!content) throw new Error("CLR_IMPORT_EMPTY");
  let payload: JsonRecord;
  let rawJwt: string | null = null;
  let verification: JsonRecord = { overall_valid: false, error_code: "UNSIGNED_IMPORTED_CREDENTIAL", checked_at: new Date().toISOString() };
  if (sourceFormat === "vc_jwt") {
    const parts = content.split(".");
    if (parts.length !== 3) throw new Error("CLR_IMPORT_INVALID_JWT");
    payload = base64UrlJson(parts[1]);
    rawJwt = content;
    const types = credentialTypes(payload);
    if (types.includes("ClrCredential")) verification = (await verifyCompactClr(sb, content, req, null)).result;
    else if (types.includes("OpenBadgeCredential") || types.includes("AchievementCredential")) verification = await verifyCompactCredential(sb, content, req, null, "api");
  } else {
    try { payload = JSON.parse(content) as JsonRecord; }
    catch { throw new Error("CLR_IMPORT_INVALID_JSON"); }
  }
  const credentials = importedCredentialRows(payload);
  if (!credentials.length) throw new Error("CLR_IMPORT_EMPTY_CREDENTIAL");
  const hash = await sha256(content);
  const issuer = related(payload.issuer);
  const status = verification.overall_valid ? "imported" : "pending";
  const { data: importRow, error: importError } = await sb.from("clr_imports").insert({
    clr_record_id: record.id,
    user_id: session.userId,
    source_format: sourceFormat,
    source_file_name: nullableText(body.source_file_name, 255),
    source_issuer: nullableText(issuer?.name || issuer?.id, 500),
    credential_type: credentialTypes(payload).join(","),
    status,
    raw_payload: payload,
    raw_jwt: rawJwt,
    payload_hash: hash,
    verification_result: verification,
    imported_entries_count: credentials.length,
  }).select("*").single();
  if (importError) {
    if (text(errorRecord(importError).code, 30) === "23505") throw new Error("CLR_IMPORT_ALREADY_EXISTS");
    throw importError;
  }
  const verified = Boolean(verification.overall_valid);
  const entries = credentials.map((credential, index) => {
    const subject = related(credential.credentialSubject);
    const achievement = related(subject?.achievement);
    const credentialIssuer = related(credential.issuer);
    const section = importEntrySection(credential);
    const title = text(credential.name || achievement?.name, 220) || `Credential importé ${index + 1}`;
    return {
      clr_record_id: record.id,
      source_type: "clr_import",
      source_id: `${importRow.id}:${index}`,
      title,
      description: nullableText(credential.description || achievement?.description, 3000),
      achievement_type: text(achievement?.achievementType, 120) || "Achievement",
      section,
      status: "active",
      visibility: "private",
      issued_at: credential.validFrom || new Date().toISOString(),
      started_at: subject?.activityStartDate || null,
      ended_at: subject?.activityEndDate || credential.validFrom || null,
      issuer_name: nullableText(credentialIssuer?.name || credentialIssuer?.id, 220),
      issuer_url: nullableText(credentialIssuer?.id, 1000),
      entry_origin: "imported",
      verification_status: verified ? "verified" : "pending_review",
      learner_editable: true,
      external_url: nullableText(credential.id, 1000),
      source_updated_at: new Date().toISOString(),
      metadata: { import_id: importRow.id, original_types: credentialTypes(credential) },
      payload: credential,
    };
  });
  const { error: entryError } = await sb.from("clr_achievements").insert(entries);
  if (entryError) {
    await sb.from("clr_imports").update({ status: "failed", review_note: text(errorRecord(entryError).message, 1000) }).eq("id", importRow.id);
    throw entryError;
  }
  await rebuildClr(sb, session.userId);
  await sb.from("clr_audit_logs").insert({ actor_user_id: session.userId, record_id: record.id, action: "credential_imported", metadata: { import_id: importRow.id, count: entries.length, verified } });
  return { ...importRow, status, verification_result: verification };
}

async function exportClr(sb: Supabase, session: Session, body: JsonRecord, req: Request) {
  const format = text(body.format, 20) || "clr_json";
  if (!["clr_json", "vc_jwt"].includes(format)) throw new Error("CLR_EXPORT_FORMAT_INVALID");
  await syncPlatformSources(sb, session.userId);
  let rebuilt = await rebuildClr(sb, session.userId);
  let content: unknown = rebuilt.record.clr_json;
  let hash = await sha256(stableJson(content));
  let standardsStatus = String(rebuilt.record.standards_status);
  if (format === "vc_jwt") {
    const signed = await signClr(sb, session.userId, session.userId, req);
    rebuilt = { record: signed.record, achievements: rebuilt.achievements };
    content = signed.jwt;
    hash = String(signed.record.credential_hash || await sha256(signed.jwt));
    standardsStatus = "clr2_signed";
  }
  await sb.from("clr_exports").insert({
    clr_record_id: rebuilt.record.id,
    requested_by: session.userId,
    export_format: format,
    record_version: rebuilt.record.version,
    standards_status: standardsStatus,
    credential_hash: hash,
    metadata: { entries_count: rebuilt.achievements.length },
  });
  return {
    format,
    content,
    file_name: format === "vc_jwt" ? `omnia-learning-record-v${rebuilt.record.version}.jwt` : `omnia-learning-record-v${rebuilt.record.version}.json`,
    media_type: format === "vc_jwt" ? "text/plain" : "application/vc+ld+json",
    record: rebuilt.record,
  };
}

async function learnerClr(sb: Supabase, session: Session) {
  const sync = await syncPlatformSources(sb, session.userId);
  const rebuilt = await rebuildClr(sb, session.userId);
  const [{ data: shares, error: shareError }, { data: imports, error: importError }] = await Promise.all([
    sb.from("clr_shares").select("id,label,include_sections,visibility_filter,expires_at,revoked_at,created_at,last_accessed_at")
      .eq("clr_record_id", rebuilt.record.id).order("created_at", { ascending: false }),
    sb.from("clr_imports").select("id,source_format,source_file_name,source_issuer,credential_type,status,verification_result,imported_entries_count,review_note,created_at,reviewed_at")
      .eq("clr_record_id", rebuilt.record.id).order("created_at", { ascending: false }),
  ]);
  if (shareError) throw shareError;
  if (importError && !optionalRelationError(importError)) throw importError;
  return { ...rebuilt, shares: shares || [], imports: imports || [], synced_entries: sync.synced_entries, sections: stringArray(rebuilt.record.section_order, 30, 80) };
}


const SKILLS_PASSPORT_SECTIONS = [
  "competences_verifiees", "certificats", "badges", "evaluations", "projets", "experiences", "recommandations",
];
const SKILLS_PASSPORT_SECTION_SET = new Set(SKILLS_PASSPORT_SECTIONS);

async function getOrCreateSkillsPassport(sb: Supabase, userId: string) {
  const record = await getOrCreateClr(sb, userId);
  const { data: existing, error } = await sb.from("skills_passports").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (existing) return { passport: existing as JsonRecord, record };
  const { data, error: insertError } = await sb.from("skills_passports").insert({
    user_id: userId,
    clr_record_id: record.id,
    title: "Omnia Skills Passport",
    professional_headline: record.profile_headline || null,
    professional_summary: record.summary || record.description || null,
    selected_sections: SKILLS_PASSPORT_SECTIONS,
  }).select("*").single();
  if (insertError) throw insertError;
  return { passport: data as JsonRecord, record };
}

async function seedSkillsPassportItems(sb: Supabase, passport: JsonRecord, record: JsonRecord) {
  if (passport.items_initialized) return;
  const { data: achievements, error } = await sb.from("clr_achievements")
    .select("id,section,verification_status,status,issued_at")
    .eq("clr_record_id", record.id)
    .eq("status", "active")
    .eq("verification_status", "verified")
    .in("section", SKILLS_PASSPORT_SECTIONS)
    .order("issued_at", { ascending: false });
  if (error) throw error;
  const rows = (achievements || []).slice(0, 30).map((item: JsonRecord, index: number) => ({
    passport_id: passport.id,
    clr_achievement_id: item.id,
    display_order: index,
    is_featured: index < 3,
  }));
  if (rows.length) {
    const { error: insertError } = await sb.from("skills_passport_items").insert(rows);
    if (insertError) throw insertError;
  }
  const { error: updateError } = await sb.from("skills_passports").update({ items_initialized: true }).eq("id", passport.id);
  if (updateError) throw updateError;
  passport.items_initialized = true;
}

async function skillsPassportItems(sb: Supabase, passportId: string) {
  const { data, error } = await sb.from("skills_passport_items")
    .select("*,achievement:clr_achievements!skills_passport_items_clr_achievement_id_fkey(*)")
    .eq("passport_id", passportId)
    .order("is_featured", { ascending: false })
    .order("display_order")
    .order("created_at");
  if (error) throw error;
  return (data || []).map((item: JsonRecord) => ({ ...item, achievement: related(item.achievement) }));
}

function publicPassportItem(item: JsonRecord) {
  const achievement = related(item.achievement) || {};
  return {
    id: item.id,
    clr_achievement_id: achievement.id,
    section: achievement.section,
    title: achievement.title,
    description: achievement.description,
    achievement_type: achievement.achievement_type,
    issued_at: achievement.issued_at,
    started_at: achievement.started_at,
    ended_at: achievement.ended_at,
    result_label: achievement.result_label,
    score: achievement.score,
    score_max: achievement.score_max,
    skills: achievement.skills || [],
    evidence: achievement.evidence || [],
    external_url: achievement.external_url,
    issuer_name: achievement.issuer_name,
    verification_status: achievement.verification_status,
    entry_origin: achievement.entry_origin,
    is_featured: Boolean(item.is_featured),
    display_order: Number(item.display_order || 0),
  };
}

async function buildSkillsPassport(sb: Supabase, userId: string) {
  const { passport, record } = await getOrCreateSkillsPassport(sb, userId);
  await seedSkillsPassportItems(sb, passport, record);
  const [items, userResult, issuer] = await Promise.all([
    skillsPassportItems(sb, String(passport.id)),
    sb.from("users").select("id,full_name,avatar_url,country_code").eq("id", userId).maybeSingle(),
    getIssuer(sb),
  ]);
  if (userResult.error) throw userResult.error;
  if (!userResult.data) throw new Error("USER_NOT_FOUND");
  const selectedSections = stringArray(passport.selected_sections, 20, 80).filter((section) => SKILLS_PASSPORT_SECTION_SET.has(section));
  const included = items.filter((item) => {
    const achievement = related(item.achievement);
    return achievement
      && selectedSections.includes(String(achievement.section))
      && achievement.status === "active"
      && achievement.verification_status !== "rejected"
      && achievement.verification_status !== "revoked";
  });
  const profile: JsonRecord = {
    id: `urn:uuid:${record.record_uuid}`,
    type: ["ClrSubject"],
    name: userResult.data.full_name,
    verifiableCredential: included.map((item) => entryCredential(related(item.achievement) || {}, record, issuer)),
  };
  if (passport.professional_headline) profile["https://schema.org/headline"] = passport.professional_headline;
  if (passport.professional_summary) profile["https://schema.org/description"] = passport.professional_summary;
  if (stringArray(passport.target_roles, 20, 120).length) profile["https://schema.org/jobTitle"] = stringArray(passport.target_roles, 20, 120);
  if (stringArray(passport.languages, 20, 80).length) profile["https://schema.org/knowsLanguage"] = stringArray(passport.languages, 20, 80);
  if (passport.location_text) profile["https://schema.org/homeLocation"] = passport.location_text;
  if (passport.availability_text) profile["https://omniaglobalacademy.com/vocab/availability"] = passport.availability_text;

  const payload = {
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      "https://purl.imsglobal.org/spec/clr/v2p0/context-2.0.1.json",
      "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json",
    ],
    id: `urn:uuid:${passport.passport_uuid}`,
    type: ["VerifiableCredential", "ClrCredential"],
    name: String(passport.title || "Omnia Skills Passport"),
    description: String(passport.professional_summary || "Passeport professionnel vérifiable construit à partir du Learning Record Omnia."),
    issuer: {
      id: issuer.did || issuer.issuer_uri,
      type: ["Profile"],
      name: issuer.name,
      ...(issuer.website_url ? { url: issuer.website_url } : {}),
    },
    credentialSubject: profile,
    validFrom: String(passport.created_at || new Date().toISOString()),
    credentialSchema: [{
      id: "https://purl.imsglobal.org/spec/clr/v2p0/schema/json/clr_v2p0_clrcredential_schema.json",
      type: "1EdTechJsonSchemaValidator2019",
    }],
  };
  const unchanged = stableJson(passport.presentation_json || {}) === stableJson(payload);
  if (unchanged) return { passport, record, items, presentation: payload };
  const nextVersion = passport.last_built_at ? Number(passport.version || 1) + 1 : Number(passport.version || 1);
  const { data: updated, error } = await sb.from("skills_passports").update({
    presentation_json: payload,
    presentation_jwt: null,
    signing_key_id: null,
    signature_alg: null,
    credential_hash: null,
    verification_result: {},
    status: passport.status === "suspended" ? "suspended" : "draft",
    version: nextVersion,
    last_built_at: new Date().toISOString(),
  }).eq("id", passport.id).select("*").single();
  if (error) throw error;
  return { passport: updated as JsonRecord, record, items, presentation: payload };
}

function skillsPassportStructureChecks(payload: JsonRecord) {
  const base = clrCredentialStructureChecks(payload);
  const subject = payload.credentialSubject as JsonRecord | undefined;
  const credentials = Array.isArray(subject?.verifiableCredential) ? subject?.verifiableCredential as JsonRecord[] : [];
  const sectionsValid = credentials.every((credential) => {
    const credentialSubject = credential.credentialSubject as JsonRecord | undefined;
    const achievement = credentialSubject?.achievement as JsonRecord | undefined;
    return Boolean(achievement?.name);
  });
  const checks = { ...base.checks, selected_credentials: credentials.length > 0, achievement_structure: sectionsValid };
  return { checks, valid: Object.values(checks).every(Boolean) };
}

async function verifyCompactSkillsPassport(sb: Supabase, compactJws: string, req: Request, passport: JsonRecord | null, source: string, shareId?: string | null) {
  let signatureValid = false;
  let structureValid = false;
  let statusValid = false;
  let errorCode: string | null = null;
  let payload: JsonRecord = {};
  let header: JsonRecord = {};
  let structureChecks: JsonRecord = {};
  try {
    header = decodeProtectedHeader(compactJws) as JsonRecord;
    const keyResult = await signingKeyForHeader(sb, header, req);
    const publicKey = await importJWK(keyResult.publicJwk as never, "RS256");
    const verified = await compactVerify(compactJws, publicKey, { algorithms: ["RS256"] });
    signatureValid = true;
    payload = JSON.parse(new TextDecoder().decode(verified.payload)) as JsonRecord;
    const structure = skillsPassportStructureChecks(payload);
    structureValid = structure.valid;
    structureChecks = structure.checks;
    if (!structureValid) errorCode = "SKILLS_PASSPORT_STRUCTURE_INVALID";
    const now = Date.now();
    statusValid = (!payload.validFrom || new Date(String(payload.validFrom)).getTime() <= now)
      && (!payload.validUntil || new Date(String(payload.validUntil)).getTime() >= now)
      && (!passport || String(passport.status) === "published");
    if (passport) {
      const actualHash = await sha256(compactJws);
      if (passport.credential_hash && String(passport.credential_hash) !== actualHash) {
        statusValid = false;
        errorCode = "SKILLS_PASSPORT_HASH_MISMATCH";
      }
      if (payload.jti !== (passport.presentation_json as JsonRecord | undefined)?.id) {
        structureValid = false;
        errorCode = "SKILLS_PASSPORT_REGISTRY_MISMATCH";
      }
    }
  } catch (cause) {
    errorCode = cause instanceof Error ? cause.message : "SKILLS_PASSPORT_SIGNATURE_INVALID";
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
  await sb.from("skills_passport_verification_events").insert({
    passport_id: passport?.id || null,
    share_id: shareId || null,
    verification_source: ["public_page","learner","admin","export","api"].includes(source) ? source : "api",
    signature_valid: signatureValid,
    structure_valid: structureValid,
    status_valid: statusValid,
    overall_valid: result.overall_valid,
    error_code: errorCode,
    result,
  });
  if (passport?.id) await sb.from("skills_passports").update({ verification_result: result }).eq("id", passport.id);
  return result;
}

async function publishSkillsPassport(sb: Supabase, userId: string, actorUserId: string, req: Request) {
  const built = await buildSkillsPassport(sb, userId);
  const subject = (built.presentation as JsonRecord).credentialSubject as JsonRecord | undefined;
  const presentedCredentials = Array.isArray(subject?.verifiableCredential) ? subject?.verifiableCredential as unknown[] : [];
  if (!presentedCredentials.length) throw new Error("SKILLS_PASSPORT_EMPTY");
  const key = await syncSigningKey(sb, req, actorUserId);
  const signed = await signCredential(built.presentation as JsonRecord, req);
  const hash = await sha256(signed.compactJws);
  const publishedAt = new Date().toISOString();
  const { data: updated, error } = await sb.from("skills_passports").update({
    presentation_json: built.presentation,
    presentation_jwt: signed.compactJws,
    signing_key_id: key.id,
    signature_alg: "RS256",
    credential_hash: hash,
    status: "published",
    published_at: publishedAt,
  }).eq("id", built.passport.id).select("*").single();
  if (error) throw error;
  const verification = await verifyCompactSkillsPassport(sb, signed.compactJws, req, updated as JsonRecord, actorUserId === userId ? "learner" : "admin");
  if (!verification.overall_valid) throw new Error(verification.error_code || "SKILLS_PASSPORT_SIGNING_PREFLIGHT_FAILED");
  await sb.from("skills_passport_audit_logs").insert({ actor_user_id: actorUserId, passport_id: updated.id, action: "passport_published", metadata: { version: updated.version } });
  return { passport: { ...updated, verification_result: verification }, jwt: signed.compactJws };
}

async function learnerSkillsPassport(sb: Supabase, session: Session) {
  await syncPlatformSources(sb, session.userId);
  await rebuildClr(sb, session.userId);
  const built = await buildSkillsPassport(sb, session.userId);
  const { data: candidates, error: candidateError } = await sb.from("clr_achievements")
    .select("*")
    .eq("clr_record_id", built.record.id)
    .eq("status", "active")
    .in("section", SKILLS_PASSPORT_SECTIONS)
    .neq("verification_status", "rejected")
    .order("is_featured", { ascending: false })
    .order("issued_at", { ascending: false });
  if (candidateError) throw candidateError;
  const { data: shares, error: shareError } = await sb.from("skills_passport_shares")
    .select("id,label,expires_at,max_views,view_count,last_accessed_at,revoked_at,created_at")
    .eq("passport_id", built.passport.id).order("created_at", { ascending: false });
  if (shareError) throw shareError;
  return { passport: built.passport, items: built.items, candidates: candidates || [], shares: shares || [], allowed_sections: SKILLS_PASSPORT_SECTIONS };
}

async function updateSkillsPassportProfile(sb: Supabase, session: Session, body: JsonRecord) {
  const { passport } = await getOrCreateSkillsPassport(sb, session.userId);
  const sections = stringArray(body.selected_sections, 20, 80).filter((section) => SKILLS_PASSPORT_SECTION_SET.has(section));
  const payload = {
    title: text(body.title, 180) || "Omnia Skills Passport",
    professional_headline: nullableText(body.professional_headline, 240),
    professional_summary: nullableText(body.professional_summary, 3000),
    target_roles: stringArray(body.target_roles, 20, 120),
    languages: stringArray(body.languages, 20, 80),
    location_text: nullableText(body.location_text, 180),
    availability_text: nullableText(body.availability_text, 300),
    selected_sections: sections.length ? sections : SKILLS_PASSPORT_SECTIONS,
    presentation_jwt: null,
    signing_key_id: null,
    signature_alg: null,
    credential_hash: null,
    verification_result: {},
    status: passport.status === "suspended" ? "suspended" : "draft",
  };
  const { data, error } = await sb.from("skills_passports").update(payload).eq("id", passport.id).select("*").single();
  if (error) throw error;
  await buildSkillsPassport(sb, session.userId);
  await sb.from("skills_passport_audit_logs").insert({ actor_user_id: session.userId, passport_id: passport.id, action: "profile_updated", previous_data: passport, new_data: data });
  return data;
}

async function updateSkillsPassportItems(sb: Supabase, session: Session, body: JsonRecord) {
  const { passport, record } = await getOrCreateSkillsPassport(sb, session.userId);
  const requested = objectArray(body.items).slice(0, 60).map((item, index) => ({
    achievement_id: text(item.achievement_id, 80),
    display_order: Math.max(0, integer(item.display_order) ?? index),
    is_featured: bool(item.is_featured),
  })).filter((item) => item.achievement_id);
  const ids = [...new Set(requested.map((item) => item.achievement_id))];
  if (ids.length) {
    const { data: valid, error: validError } = await sb.from("clr_achievements")
      .select("id,section,status,verification_status")
      .eq("clr_record_id", record.id).in("id", ids);
    if (validError) throw validError;
    const validIds = new Set((valid || []).filter((item: JsonRecord) => SKILLS_PASSPORT_SECTION_SET.has(String(item.section)) && item.status === "active" && !["rejected","revoked"].includes(String(item.verification_status))).map((item: JsonRecord) => String(item.id)));
    if (validIds.size !== ids.length) throw new Error("SKILLS_PASSPORT_ITEM_INVALID");
  }
  const { error: deleteError } = await sb.from("skills_passport_items").delete().eq("passport_id", passport.id);
  if (deleteError) throw deleteError;
  if (requested.length) {
    const rows = requested.map((item) => ({
      passport_id: passport.id,
      clr_achievement_id: item.achievement_id,
      display_order: item.display_order,
      is_featured: item.is_featured,
    }));
    const { error: insertError } = await sb.from("skills_passport_items").insert(rows);
    if (insertError) throw insertError;
  }
  const { error: updateError } = await sb.from("skills_passports").update({
    items_initialized: true,
    presentation_jwt: null,
    signing_key_id: null,
    signature_alg: null,
    credential_hash: null,
    verification_result: {},
    status: passport.status === "suspended" ? "suspended" : "draft",
  }).eq("id", passport.id);
  if (updateError) throw updateError;
  const built = await buildSkillsPassport(sb, session.userId);
  await sb.from("skills_passport_audit_logs").insert({ actor_user_id: session.userId, passport_id: passport.id, action: "items_updated", metadata: { count: requested.length } });
  return { passport: built.passport, items: built.items };
}

async function createSkillsPassportShare(sb: Supabase, session: Session, body: JsonRecord) {
  const { passport } = await getOrCreateSkillsPassport(sb, session.userId);
  if (passport.status !== "published" || !passport.presentation_jwt) throw new Error("SKILLS_PASSPORT_NOT_PUBLISHED");
  const token = randomToken();
  const tokenHash = await sha256(token);
  const days = integer(body.validity_days);
  const maxViewsRaw = integer(body.max_views);
  const maxViews = maxViewsRaw && maxViewsRaw > 0 ? Math.min(maxViewsRaw, 100000) : null;
  const expiresAt = days && days > 0 ? new Date(Date.now() + Math.min(days, 3650) * 86400000).toISOString() : null;
  const { data, error } = await sb.from("skills_passport_shares").insert({
    passport_id: passport.id,
    token_hash: tokenHash,
    label: nullableText(body.label, 180),
    expires_at: expiresAt,
    max_views: maxViews,
    created_by: session.userId,
  }).select("id,label,expires_at,max_views,view_count,created_at").single();
  if (error) throw error;
  await sb.from("skills_passport_audit_logs").insert({ actor_user_id: session.userId, passport_id: passport.id, action: "share_created", metadata: { share_id: data.id } });
  return { ...data, token, url: `${appBaseUrl()}/credentials/passports/${token}` };
}

async function revokeSkillsPassportShare(sb: Supabase, session: Session, body: JsonRecord) {
  const { passport } = await getOrCreateSkillsPassport(sb, session.userId);
  const shareId = text(body.share_id, 80);
  const { error } = await sb.from("skills_passport_shares").update({ revoked_at: new Date().toISOString() }).eq("id", shareId).eq("passport_id", passport.id);
  if (error) throw error;
  await sb.from("skills_passport_audit_logs").insert({ actor_user_id: session.userId, passport_id: passport.id, action: "share_revoked", metadata: { share_id: shareId } });
  return { success: true };
}

async function publicSkillsPassport(sb: Supabase, token: string, req: Request) {
  const tokenHash = await sha256(token);
  const { data: share, error: shareError } = await sb.from("skills_passport_shares").select("*").eq("token_hash", tokenHash).maybeSingle();
  if (shareError) throw shareError;
  if (!share || share.revoked_at) throw new Error("SKILLS_PASSPORT_SHARE_NOT_FOUND");
  if (share.expires_at && new Date(String(share.expires_at)).getTime() < Date.now()) throw new Error("SKILLS_PASSPORT_SHARE_EXPIRED");
  if (share.max_views && Number(share.view_count || 0) >= Number(share.max_views)) throw new Error("SKILLS_PASSPORT_SHARE_LIMIT_REACHED");
  const { data: passport, error: passportError } = await sb.from("skills_passports")
    .select("*,user:users!skills_passports_user_id_fkey(id,full_name,country_code)")
    .eq("id", share.passport_id).maybeSingle();
  if (passportError) throw passportError;
  if (!passport || passport.status !== "published" || !passport.presentation_jwt) throw new Error("SKILLS_PASSPORT_NOT_PUBLISHED");
  const items = await skillsPassportItems(sb, String(passport.id));
  const verification = await verifyCompactSkillsPassport(sb, String(passport.presentation_jwt), req, passport as JsonRecord, "public_page", String(share.id));
  await sb.from("skills_passport_shares").update({ view_count: Number(share.view_count || 0) + 1, last_accessed_at: new Date().toISOString() }).eq("id", share.id);
  return {
    passport: {
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
      signature_alg: passport.signature_alg,
      credential_hash: passport.credential_hash,
      user: passport.user ? { full_name: passport.user.full_name, country_code: passport.user.country_code } : null,
    },
    share: { label: share.label, expires_at: share.expires_at, max_views: share.max_views, view_count: Number(share.view_count || 0) + 1 },
    items: items
      .filter((item) => {
        const achievement = related(item.achievement);
        const selectedSections = stringArray(passport.selected_sections, 20, 80);
        return achievement
          && selectedSections.includes(String(achievement.section))
          && achievement.status === "active"
          && !["rejected", "revoked"].includes(String(achievement.verification_status));
      })
      .map(publicPassportItem),
    verification,
  };
}

async function exportSkillsPassport(sb: Supabase, session: Session, body: JsonRecord, req: Request) {
  const format = text(body.format, 30) || "passport_json";
  if (!["passport_json","vc_jwt"].includes(format)) throw new Error("SKILLS_PASSPORT_EXPORT_FORMAT_INVALID");
  let built = await buildSkillsPassport(sb, session.userId);
  let content: unknown = built.presentation;
  let passport = built.passport;
  let hash = await sha256(stableJson(content));
  if (format === "vc_jwt") {
    const published = await publishSkillsPassport(sb, session.userId, session.userId, req);
    passport = published.passport;
    content = published.jwt;
    hash = String(passport.credential_hash || await sha256(published.jwt));
  }
  await sb.from("skills_passport_exports").insert({
    passport_id: passport.id,
    requested_by: session.userId,
    export_format: format,
    passport_version: passport.version,
    credential_hash: hash,
    metadata: { selected_items: built.items.length },
  });
  return {
    format,
    content,
    file_name: format === "vc_jwt" ? `omnia-skills-passport-v${passport.version}.jwt` : `omnia-skills-passport-v${passport.version}.json`,
    media_type: format === "vc_jwt" ? "text/plain" : "application/vc+ld+json",
    passport,
  };
}

async function adminSkillsPassports(sb: Supabase) {
  const { data, error } = await sb.from("skills_passports")
    .select("*,user:users!skills_passports_user_id_fkey(id,full_name,email,avatar_url,country_code)")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  const ids = (data || []).map((item: JsonRecord) => String(item.id));
  const [{ data: items, error: itemsError }, { data: shares, error: sharesError }] = ids.length ? await Promise.all([
    sb.from("skills_passport_items").select("passport_id").in("passport_id", ids),
    sb.from("skills_passport_shares").select("passport_id,revoked_at").in("passport_id", ids),
  ]) : [{ data: [], error: null }, { data: [], error: null }];
  if (itemsError) throw itemsError;
  if (sharesError) throw sharesError;
  const itemCounts = new Map<string, number>();
  const shareCounts = new Map<string, number>();
  for (const item of items || []) itemCounts.set(String(item.passport_id), (itemCounts.get(String(item.passport_id)) || 0) + 1);
  for (const share of shares || []) if (!share.revoked_at) shareCounts.set(String(share.passport_id), (shareCounts.get(String(share.passport_id)) || 0) + 1);
  return (data || []).map((item: JsonRecord) => ({ ...item, item_count: itemCounts.get(String(item.id)) || 0, active_share_count: shareCounts.get(String(item.id)) || 0 }));
}

async function revokeShare(sb: Supabase, session: Session, body: JsonRecord) {
  const shareId = text(body.share_id, 80);
  const record = await getOrCreateClr(sb, session.userId);
  const { error } = await sb.from("clr_shares").update({ revoked_at: new Date().toISOString() }).eq("id", shareId).eq("clr_record_id", record.id);
  if (error) throw error;
  await sb.from("clr_audit_logs").insert({ actor_user_id: session.userId, record_id: record.id, action: "share_revoked", metadata: { share_id: shareId } });
  return { success: true };
}

async function adminClrImports(sb: Supabase) {
  const { data, error } = await sb.from("clr_imports")
    .select("*,user:users!clr_imports_user_id_fkey(id,full_name,email),record:clr_records!clr_imports_record_id_fkey(id,record_uuid,title)")
    .order("created_at", { ascending: false }).limit(500);
  if (error) throw error;
  return data || [];
}

async function adminReviewClrImport(sb: Supabase, session: Session, body: JsonRecord) {
  const importId = text(body.import_id, 80);
  const decision = text(body.decision, 20);
  const note = nullableText(body.review_note, 1500);
  if (!["approve", "reject"].includes(decision)) throw new Error("CLR_IMPORT_DECISION_INVALID");
  const { data: current, error } = await sb.from("clr_imports").select("*").eq("id", importId).maybeSingle();
  if (error) throw error;
  if (!current) throw new Error("CLR_IMPORT_NOT_FOUND");
  const approved = decision === "approve";
  const { data: updated, error: updateError } = await sb.from("clr_imports").update({
    status: approved ? "imported" : "rejected",
    review_note: note,
    reviewed_by: session.userId,
    reviewed_at: new Date().toISOString(),
  }).eq("id", importId).select("*").single();
  if (updateError) throw updateError;
  const { error: entriesError } = await sb.from("clr_achievements").update({
    verification_status: approved ? "verified" : "rejected",
    status: approved ? "active" : "hidden",
  }).eq("clr_record_id", current.clr_record_id).eq("source_type", "clr_import").like("source_id", `${importId}:%`);
  if (entriesError) throw entriesError;
  await rebuildClr(sb, String(current.user_id));
  await sb.from("clr_audit_logs").insert({ actor_user_id: session.userId, record_id: current.clr_record_id, action: approved ? "import_approved" : "import_rejected", metadata: { import_id: importId, note } });
  return updated;
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
    if (action === "public_skills_passport") return json({ success: true, ...(await publicSkillsPassport(sb, text(body.token, 200), req)) });
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
    if (action === "learner_clr" || action === "learner_sync_clr") {
      requireSession(session);
      return json({ success: true, ...(await learnerClr(sb, session)) });
    }
    if (action === "learner_update_clr_profile") {
      requireSession(session);
      return json({ success: true, record: await updateClrProfile(sb, session, body) });
    }
    if (action === "learner_save_clr_entry") {
      requireSession(session);
      return json({ success: true, entry: await saveManualClrEntry(sb, session, body) });
    }
    if (action === "learner_update_clr_entry") {
      requireSession(session);
      return json({ success: true, entry: await updateClrEntry(sb, session, body) });
    }
    if (action === "learner_delete_clr_entry") {
      requireSession(session);
      return json({ success: true, ...(await deleteClrEntry(sb, session, body)) });
    }
    if (action === "learner_import_clr") {
      requireSession(session);
      return json({ success: true, imported: await importClr(sb, session, body, req) });
    }
    if (action === "learner_export_clr") {
      requireSession(session);
      return json({ success: true, ...(await exportClr(sb, session, body, req)) });
    }
    if (action === "learner_verify_clr") {
      requireSession(session);
      const record = await getOrCreateClr(sb, session.userId);
      if (!record.clr_jwt) throw new Error("CLR_NOT_SIGNED");
      return json({ success: true, verification: (await verifyCompactClr(sb, String(record.clr_jwt), req, record)).result });
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
    if (action === "learner_skills_passport") {
      requireSession(session);
      return json({ success: true, ...(await learnerSkillsPassport(sb, session)) });
    }
    if (action === "learner_update_skills_passport_profile") {
      requireSession(session);
      return json({ success: true, passport: await updateSkillsPassportProfile(sb, session, body) });
    }
    if (action === "learner_update_skills_passport_items") {
      requireSession(session);
      return json({ success: true, ...(await updateSkillsPassportItems(sb, session, body)) });
    }
    if (action === "learner_publish_skills_passport") {
      requireSession(session);
      return json({ success: true, ...(await publishSkillsPassport(sb, session.userId, session.userId, req)) });
    }
    if (action === "learner_verify_skills_passport") {
      requireSession(session);
      const { passport } = await getOrCreateSkillsPassport(sb, session.userId);
      if (!passport.presentation_jwt) throw new Error("SKILLS_PASSPORT_NOT_SIGNED");
      return json({ success: true, verification: await verifyCompactSkillsPassport(sb, String(passport.presentation_jwt), req, passport, "learner") });
    }
    if (action === "learner_create_skills_passport_share") {
      requireSession(session);
      return json({ success: true, share: await createSkillsPassportShare(sb, session, body) });
    }
    if (action === "learner_revoke_skills_passport_share") {
      requireSession(session);
      return json({ success: true, ...(await revokeSkillsPassportShare(sb, session, body)) });
    }
    if (action === "learner_export_skills_passport") {
      requireSession(session);
      return json({ success: true, ...(await exportSkillsPassport(sb, session, body, req)) });
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
      const { data, error } = await sb.from("clr_records").select("*,user:users!clr_records_user_id_fkey(id,full_name,email,avatar_url,country_code)").order("updated_at", { ascending: false });
      if (error) throw error;
      const recordIds = (data || []).map((item: JsonRecord) => String(item.id));
      const { data: entries, error: entriesError } = recordIds.length
        ? await sb.from("clr_achievements").select("clr_record_id,verification_status,status").in("clr_record_id", recordIds)
        : { data: [], error: null };
      if (entriesError) throw entriesError;
      const counts = new Map<string, { total: number; verified: number; pending: number }>();
      for (const item of entries || []) {
        const key = String(item.clr_record_id);
        const current = counts.get(key) || { total: 0, verified: 0, pending: 0 };
        current.total += item.status === "hidden" ? 0 : 1;
        current.verified += item.verification_status === "verified" && item.status !== "hidden" ? 1 : 0;
        current.pending += item.verification_status === "pending_review" ? 1 : 0;
        counts.set(key, current);
      }
      return json({ success: true, records: (data || []).map((item: JsonRecord) => ({ ...item, entry_counts: counts.get(String(item.id)) || { total: 0, verified: 0, pending: 0 } })) });
    }
    if (action === "admin_skills_passports") return json({ success: true, passports: await adminSkillsPassports(sb) });
    if (action === "admin_verify_skills_passport") {
      const passportId = text(body.passport_id, 80);
      const { data: passport, error } = await sb.from("skills_passports").select("*").eq("id", passportId).maybeSingle();
      if (error) throw error;
      if (!passport) throw new Error("SKILLS_PASSPORT_NOT_FOUND");
      if (!passport.presentation_jwt) throw new Error("SKILLS_PASSPORT_NOT_SIGNED");
      return json({ success: true, verification: await verifyCompactSkillsPassport(sb, String(passport.presentation_jwt), req, passport as JsonRecord, "admin") });
    }
    if (action === "admin_clr_imports") return json({ success: true, imports: await adminClrImports(sb) });
    if (action === "admin_review_clr_import") return json({ success: true, imported: await adminReviewClrImport(sb, session, body) });
    if (action === "admin_sync_clr") {
      const userId = text(body.user_id, 80);
      if (!userId) throw new Error("USER_NOT_FOUND");
      const sync = await syncPlatformSources(sb, userId);
      const rebuilt = await rebuildClr(sb, userId);
      return json({ success: true, ...sync, ...rebuilt });
    }
    if (action === "admin_sign_clr") {
      const userId = text(body.user_id, 80);
      if (!userId) throw new Error("USER_NOT_FOUND");
      return json({ success: true, ...(await signClr(sb, userId, session.userId, req)) });
    }
    if (action === "admin_verify_clr") {
      const recordId = text(body.record_id, 80);
      const { data: record, error } = await sb.from("clr_records").select("*").eq("id", recordId).maybeSingle();
      if (error) throw error;
      if (!record) throw new Error("CLR_NOT_FOUND");
      if (!record.clr_jwt) throw new Error("CLR_NOT_SIGNED");
      return json({ success: true, verification: (await verifyCompactClr(sb, String(record.clr_jwt), req, record as JsonRecord)).result });
    }
    throw new Error("UNKNOWN_ACTION");
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "UNAUTHENTICATED" ? 401 : message === "FORBIDDEN" ? 403 : message.endsWith("_NOT_FOUND") ? 404 : 400;
    return json({ success: false, error: message }, status);
  }
});
