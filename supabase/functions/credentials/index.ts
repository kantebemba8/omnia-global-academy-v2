import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-omnia-session-token",
};

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
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
    .select("*,template:badge_templates(*,category:badge_categories(*),level:badge_levels(*)),issuer:credential_issuers(*),recipient:users(id,full_name,email,avatar_url)")
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
    .select("*,template:badge_templates(*,category:badge_categories(*),level:badge_levels(*)),issuer:credential_issuers(*),recipient:users(id,full_name,avatar_url)");
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

async function issueBadge(sb: Supabase, session: Session, body: JsonRecord) {
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
    evidence: evidence.map((item) => {
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
  await audit(sb, session.userId, "badge_awarded", "badge_award", String(award.id), null, award, { recipient_email: recipient.email });
  return award;
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "METHOD_NOT_ALLOWED" }, 405);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const body = await req.json().catch(() => ({})) as JsonRecord;
    const action = text(body.action, 80);
    const session = await authenticate(sb, req);

    if (action === "public_badge") return json({ success: true, badge: await publicBadge(sb, text(body.identifier, 120)) });
    if (action === "public_clr") return json({ success: true, ...(await publicClr(sb, text(body.token, 200))) });

    if (action === "learner_badges") {
      requireSession(session);
      return json({ success: true, badges: await awardRows(sb, session.userId), templates: await templateRows(sb, false) });
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
      const [templates, awards, pendingReviews, issuers, clrRecords] = await Promise.all([
        sb.from("badge_templates").select("id", { count: "exact", head: true }),
        sb.from("badge_awards").select("id", { count: "exact", head: true }),
        sb.from("badge_review_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        sb.from("credential_issuers").select("id", { count: "exact", head: true }).eq("status", "active"),
        sb.from("clr_records").select("id", { count: "exact", head: true }),
      ]);
      return json({ success: true, metrics: { templates: templates.count || 0, awards: awards.count || 0, pending_reviews: pendingReviews.count || 0, active_issuers: issuers.count || 0, clr_records: clrRecords.count || 0 } });
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
    if (action === "admin_issue_badge") return json({ success: true, award: await issueBadge(sb, session, body) });
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
