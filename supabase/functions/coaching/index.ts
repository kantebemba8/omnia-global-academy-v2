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

type Session = { userId: string; roles: string[] };
type Supabase = ReturnType<typeof createClient>;

type UploadedDocument = {
  document_type: "diploma" | "certificate" | "cv" | "reference" | "identity" | "other";
  file_name: string;
  mime_type: string;
  storage_path: string;
  size_bytes?: number;
};

function asText(value: unknown, max = 5000): string {
  return String(value ?? "").trim().slice(0, max);
}

function asNullableText(value: unknown, max = 5000): string | null {
  const result = asText(value, max);
  return result || null;
}

function asStringArray(value: unknown, maxItems = 30, maxLength = 160): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => asText(item, maxLength)).filter(Boolean))].slice(0, maxItems);
}

function asInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : null;
}

function asPercent(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return null;
  return Math.round(parsed * 100) / 100;
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "coach";
}

function isHttpUrl(value: string | null): boolean {
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
  const { data: session, error } = await sb
    .from("user_sessions")
    .select("user_id")
    .eq("session_token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error || !session?.user_id) return null;
  const userId = String(session.user_id);
  const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", userId);
  return { userId, roles: (roles || []).map((row: { role: string }) => String(row.role)) };
}

function isAdmin(session: Session | null): session is Session {
  return !!session?.roles.includes("super_admin");
}

async function getLevels(sb: Supabase, includeInactive = false) {
  let query = sb.from("coaching_levels").select("*").order("catalogue_priority", { ascending: false }).order("name");
  if (!includeInactive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function getDomains(sb: Supabase, includeInactive = false) {
  let query = sb.from("coaching_domains").select("*").order("display_order").order("name");
  if (!includeInactive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function domainMapForProfiles(sb: Supabase, coachIds: string[]) {
  const result = new Map<string, unknown[]>();
  if (!coachIds.length) return result;
  const { data: links, error } = await sb.from("coach_profile_domains").select("coach_id,domain_id").in("coach_id", coachIds);
  if (error) throw error;
  const domainIds = [...new Set((links || []).map((row: { domain_id: string }) => String(row.domain_id)))];
  const { data: domains } = domainIds.length
    ? await sb.from("coaching_domains").select("id,slug,name,description,icon_key").in("id", domainIds)
    : { data: [] };
  const domainById = new Map((domains || []).map((domain: { id: string }) => [String(domain.id), domain]));
  for (const link of links || []) {
    const coachId = String(link.coach_id);
    const domain = domainById.get(String(link.domain_id));
    if (!domain) continue;
    result.set(coachId, [...(result.get(coachId) || []), domain]);
  }
  return result;
}

async function publicCoaches(sb: Supabase) {
  const { data: profiles, error } = await sb
    .from("coach_profiles")
    .select("*")
    .eq("status", "active")
    .order("is_featured", { ascending: false })
    .order("catalogue_priority", { ascending: false })
    .order("average_rating", { ascending: false });
  if (error) throw error;
  const rows = profiles || [];
  const userIds = rows.map((row: { user_id: string }) => String(row.user_id));
  const levelIds = [...new Set(rows.map((row: { level_id?: string | null }) => row.level_id).filter(Boolean).map(String))];
  const [{ data: users }, { data: levels }, domainsByCoach] = await Promise.all([
    userIds.length ? sb.from("users").select("id,full_name").in("id", userIds) : Promise.resolve({ data: [] }),
    levelIds.length ? sb.from("coaching_levels").select("id,slug,name,badge_label,badge_color,is_featured").in("id", levelIds) : Promise.resolve({ data: [] }),
    domainMapForProfiles(sb, rows.map((row: { id: string }) => String(row.id))),
  ]);
  const userById = new Map((users || []).map((user: { id: string }) => [String(user.id), user]));
  const levelById = new Map((levels || []).map((level: { id: string }) => [String(level.id), level]));
  return rows.map((profile: Record<string, unknown>) => ({
    ...profile,
    full_name: (userById.get(String(profile.user_id)) as { full_name?: string } | undefined)?.full_name || "Coach Omnia",
    level: profile.level_id ? levelById.get(String(profile.level_id)) || null : null,
    domains: domainsByCoach.get(String(profile.id)) || [],
  }));
}

async function publicProfile(sb: Supabase, identifier: string) {
  const { data: profile, error } = await sb
    .from("coach_profiles")
    .select("*")
    .eq(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier) ? "id" : "public_slug", identifier)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  if (!profile) return null;
  const [{ data: user }, { data: level }, domainsByCoach] = await Promise.all([
    sb.from("users").select("id,full_name").eq("id", profile.user_id).maybeSingle(),
    profile.level_id ? sb.from("coaching_levels").select("id,slug,name,description,badge_label,badge_color,is_featured").eq("id", profile.level_id).maybeSingle() : Promise.resolve({ data: null }),
    domainMapForProfiles(sb, [String(profile.id)]),
  ]);
  return {
    ...profile,
    full_name: user?.full_name || "Coach Omnia",
    level: level || null,
    domains: domainsByCoach.get(String(profile.id)) || [],
  };
}

async function allCoaches(sb: Supabase) {
  const { data: profiles, error } = await sb
    .from("coach_profiles")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  const rows = profiles || [];
  const userIds = rows.map((row: { user_id: string }) => String(row.user_id));
  const levelIds = [...new Set(rows.map((row: { level_id?: string | null }) => row.level_id).filter(Boolean).map(String))];
  const [{ data: users }, { data: levels }, domainsByCoach] = await Promise.all([
    userIds.length ? sb.from("users").select("id,full_name").in("id", userIds) : Promise.resolve({ data: [] }),
    levelIds.length ? sb.from("coaching_levels").select("id,slug,name,badge_label,badge_color,is_featured").in("id", levelIds) : Promise.resolve({ data: [] }),
    domainMapForProfiles(sb, rows.map((row: { id: string }) => String(row.id))),
  ]);
  const userById = new Map((users || []).map((user: { id: string }) => [String(user.id), user]));
  const levelById = new Map((levels || []).map((level: { id: string }) => [String(level.id), level]));
  return rows.map((profile: Record<string, unknown>) => ({
    ...profile,
    full_name: (userById.get(String(profile.user_id)) as { full_name?: string } | undefined)?.full_name || "Coach Omnia",
    level: profile.level_id ? levelById.get(String(profile.level_id)) || null : null,
    domains: domainsByCoach.get(String(profile.id)) || [],
  }));
}

async function applicationDomains(sb: Supabase, applicationIds: string[]) {
  const result = new Map<string, unknown[]>();
  if (!applicationIds.length) return result;
  const { data: links, error } = await sb.from("coach_application_domains").select("application_id,domain_id").in("application_id", applicationIds);
  if (error) throw error;
  const domainIds = [...new Set((links || []).map((row: { domain_id: string }) => String(row.domain_id)))];
  const { data: domains } = domainIds.length
    ? await sb.from("coaching_domains").select("id,slug,name").in("id", domainIds)
    : { data: [] };
  const byId = new Map((domains || []).map((domain: { id: string }) => [String(domain.id), domain]));
  for (const link of links || []) {
    const applicationId = String(link.application_id);
    const domain = byId.get(String(link.domain_id));
    if (domain) result.set(applicationId, [...(result.get(applicationId) || []), domain]);
  }
  return result;
}

async function signedDocuments(sb: Supabase, applicationIds: string[]) {
  const result = new Map<string, unknown[]>();
  if (!applicationIds.length) return result;
  const { data: documents, error } = await sb.from("coach_documents").select("*").in("application_id", applicationIds).order("created_at");
  if (error) throw error;
  for (const document of documents || []) {
    const { data } = await sb.storage.from("coaching-private").createSignedUrl(String(document.storage_path), 3600);
    const value = { ...document, signed_url: data?.signedUrl || null };
    const applicationId = String(document.application_id);
    result.set(applicationId, [...(result.get(applicationId) || []), value]);
  }
  return result;
}

async function loadApplicationRows(sb: Supabase, userId?: string) {
  let query = sb.from("coach_applications").select("*").order("submitted_at", { ascending: false, nullsFirst: false }).order("updated_at", { ascending: false });
  if (userId) query = query.eq("user_id", userId);
  const { data: applications, error } = await query;
  if (error) throw error;
  const rows = applications || [];
  const ids = rows.map((row: { id: string }) => String(row.id));
  const userIds = [...new Set(rows.map((row: { user_id: string }) => String(row.user_id)))];
  const levelIds = [...new Set(rows.map((row: { approved_level_id?: string | null }) => row.approved_level_id).filter(Boolean).map(String))];
  const [{ data: users }, { data: levels }, domains, documents] = await Promise.all([
    userIds.length ? sb.from("users").select("id,email,phone_number,full_name").in("id", userIds) : Promise.resolve({ data: [] }),
    levelIds.length ? sb.from("coaching_levels").select("id,name,slug").in("id", levelIds) : Promise.resolve({ data: [] }),
    applicationDomains(sb, ids),
    signedDocuments(sb, ids),
  ]);
  const userById = new Map((users || []).map((user: { id: string }) => [String(user.id), user]));
  const levelById = new Map((levels || []).map((level: { id: string }) => [String(level.id), level]));
  return rows.map((application: Record<string, unknown>) => ({
    ...application,
    user: userById.get(String(application.user_id)) || null,
    approved_level: application.approved_level_id ? levelById.get(String(application.approved_level_id)) || null : null,
    domains: domains.get(String(application.id)) || [],
    documents: documents.get(String(application.id)) || [],
  }));
}

async function uploadAsset(sb: Supabase, session: Session, body: Record<string, unknown>) {
  const fileName = asText(body.file_name, 180);
  const mimeType = asText(body.mime_type, 120).toLowerCase();
  const base64 = asText(body.base64, 24_000_000);
  const assetType = asText(body.asset_type, 30);
  if (!fileName || !mimeType || !base64) throw new Error("FILE_REQUIRED");

  const publicTypes = ["image/jpeg", "image/png", "image/webp", "video/mp4"];
  const privateTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
  const isPublic = assetType === "photo" || assetType === "video";
  const allowed = isPublic ? publicTypes : privateTypes;
  if (!allowed.includes(mimeType)) throw new Error("FILE_TYPE_NOT_ALLOWED");

  let binary: Uint8Array;
  try {
    const raw = atob(base64.replace(/^data:[^;]+;base64,/, ""));
    binary = Uint8Array.from(raw, (character) => character.charCodeAt(0));
  } catch {
    throw new Error("INVALID_FILE");
  }
  const maxBytes = isPublic ? 10 * 1024 * 1024 : 15 * 1024 * 1024;
  if (binary.byteLength > maxBytes) throw new Error("FILE_TOO_LARGE");

  const extension = fileName.includes(".") ? fileName.split(".").pop()!.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() : "bin";
  const path = `${session.userId}/${assetType || "document"}/${crypto.randomUUID()}.${extension}`;
  const bucket = isPublic ? "coaching-public" : "coaching-private";
  const { error } = await sb.storage.from(bucket).upload(path, binary, { contentType: mimeType, upsert: false });
  if (error) throw error;
  const publicUrl = isPublic ? sb.storage.from(bucket).getPublicUrl(path).data.publicUrl : null;
  return { path, public_url: publicUrl, size_bytes: binary.byteLength, file_name: fileName, mime_type: mimeType };
}

async function submitApplication(sb: Supabase, session: Session, body: Record<string, unknown>) {
  const fullName = asText(body.full_name, 180);
  const professionalTitle = asText(body.professional_title, 180);
  const country = asText(body.country, 100);
  const timezone = asText(body.timezone, 100) || "Africa/Bamako";
  const biography = asText(body.biography, 5000);
  const experienceSummary = asText(body.experience_summary, 5000);
  const motivation = asText(body.motivation, 3000);
  const languages = asStringArray(body.languages, 15, 80);
  const specialties = asStringArray(body.specialties, 30, 120);
  const domainIds = asStringArray(body.domain_ids, 30, 80);
  const sessionModes = asStringArray(body.preferred_session_modes, 3, 20).filter((mode) => ["jitsi", "external"].includes(mode));
  const linkedinUrl = asNullableText(body.linkedin_url, 500);
  const websiteUrl = asNullableText(body.website_url, 500);
  const presentationVideoUrl = asNullableText(body.presentation_video_url, 1000);
  if (![linkedinUrl, websiteUrl, presentationVideoUrl].every(isHttpUrl)) throw new Error("INVALID_URL");
  if (!fullName || !professionalTitle || !country || biography.length < 80 || !experienceSummary || !motivation || !languages.length || !domainIds.length || !sessionModes.length) {
    throw new Error("APPLICATION_INCOMPLETE");
  }

  const requestedApplicationId = asText(body.application_id, 80);
  let applicationQuery = sb.from("coach_applications").select("id,status").eq("user_id", session.userId);
  applicationQuery = requestedApplicationId
    ? applicationQuery.eq("id", requestedApplicationId)
    : applicationQuery.in("status", ["draft", "pending", "under_review", "changes_requested", "approved", "suspended"]);
  const { data: active, error: activeError } = await applicationQuery.maybeSingle();
  if (activeError) throw activeError;
  if (requestedApplicationId && !active) throw new Error("APPLICATION_NOT_FOUND");
  if (active && ["pending", "under_review", "approved", "suspended"].includes(String(active.status))) throw new Error("APPLICATION_ALREADY_ACTIVE");

  const { data: validDomains, error: domainError } = await sb.from("coaching_domains").select("id").in("id", domainIds).eq("is_active", true);
  if (domainError) throw domainError;
  if ((validDomains || []).length !== domainIds.length) throw new Error("INVALID_DOMAIN");

  const documents = Array.isArray(body.documents) ? body.documents as UploadedDocument[] : [];
  const safeDocuments = documents.slice(0, 12).map((document) => ({
    user_id: session.userId,
    document_type: ["diploma", "certificate", "cv", "reference", "identity", "other"].includes(document.document_type) ? document.document_type : "other",
    file_name: asText(document.file_name, 180),
    mime_type: asText(document.mime_type, 120),
    storage_path: asText(document.storage_path, 1000),
    size_bytes: asInteger(document.size_bytes),
  })).filter((document) => document.file_name && document.mime_type && document.storage_path.startsWith(`${session.userId}/`));
  if (documents.length && !safeDocuments.length) throw new Error("DOCUMENT_REQUIRED");
  if (!safeDocuments.length) {
    if (!active?.id) throw new Error("DOCUMENT_REQUIRED");
    const { count, error } = await sb
      .from("coach_documents")
      .select("id", { count: "exact", head: true })
      .eq("application_id", String(active.id))
      .eq("user_id", session.userId);
    if (error) throw error;
    if (!count) throw new Error("DOCUMENT_REQUIRED");
  }

  const payload = {
    user_id: session.userId,
    status: "pending",
    full_name: fullName,
    professional_title: professionalTitle,
    country,
    timezone,
    biography,
    specialties,
    languages,
    experience_summary: experienceSummary,
    motivation,
    linkedin_url: linkedinUrl,
    website_url: websiteUrl,
    presentation_video_url: presentationVideoUrl,
    professional_references: asNullableText(body.professional_references, 3000),
    photo_url: asNullableText(body.photo_url, 1200),
    preferred_session_modes: sessionModes,
    price_30_xof: asInteger(body.price_30_xof),
    price_60_xof: asInteger(body.price_60_xof),
    price_90_xof: asInteger(body.price_90_xof),
    custom_duration_enabled: body.custom_duration_enabled === true,
    custom_hourly_price_xof: body.custom_duration_enabled === true ? asInteger(body.custom_hourly_price_xof) : null,
    source_roles: session.roles,
    submitted_at: new Date().toISOString(),
    reviewed_by: null,
    reviewed_at: null,
    admin_message: null,
    rejection_reason: null,
  };

  let applicationId = active?.id ? String(active.id) : "";
  if (applicationId) {
    const { error } = await sb.from("coach_applications").update(payload).eq("id", applicationId).eq("user_id", session.userId);
    if (error) throw error;
  } else {
    const { data, error } = await sb.from("coach_applications").insert(payload).select("id").single();
    if (error) throw error;
    applicationId = String(data.id);
  }

  await sb.from("coach_application_domains").delete().eq("application_id", applicationId);
  const { error: linkError } = await sb.from("coach_application_domains").insert(domainIds.map((domainId) => ({ application_id: applicationId, domain_id: domainId })));
  if (linkError) throw linkError;

  if (safeDocuments.length) {
    await sb.from("coach_documents").delete().eq("application_id", applicationId).eq("user_id", session.userId);
    const { error } = await sb.from("coach_documents").insert(safeDocuments.map((document) => ({ ...document, application_id: applicationId })));
    if (error) throw error;
  }
  return applicationId;
}

async function audit(sb: Supabase, actorUserId: string, action: string, entityType: string, entityId: string | null, previousData: unknown, newData: unknown, metadata: Record<string, unknown> = {}) {
  await sb.from("coaching_admin_audit").insert({
    actor_user_id: actorUserId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    previous_data: previousData,
    new_data: newData,
    metadata,
  });
}

async function reviewApplication(sb: Supabase, session: Session, body: Record<string, unknown>) {
  const applicationId = asText(body.application_id, 80);
  const decision = asText(body.decision, 40);
  if (!applicationId || !["approve", "changes_requested", "reject"].includes(decision)) throw new Error("INVALID_REVIEW");
  const { data: application, error } = await sb.from("coach_applications").select("*").eq("id", applicationId).maybeSingle();
  if (error) throw error;
  if (!application) throw new Error("APPLICATION_NOT_FOUND");

  if (decision === "changes_requested" || decision === "reject") {
    const message = asText(body.message, 3000);
    if (!message) throw new Error("REVIEW_MESSAGE_REQUIRED");
    const status = decision === "reject" ? "rejected" : "changes_requested";
    const update = {
      status,
      reviewed_by: session.userId,
      reviewed_at: new Date().toISOString(),
      admin_message: decision === "changes_requested" ? message : null,
      rejection_reason: decision === "reject" ? message : null,
    };
    const { error: updateError } = await sb.from("coach_applications").update(update).eq("id", applicationId);
    if (updateError) throw updateError;
    await audit(sb, session.userId, `application_${status}`, "coach_application", applicationId, application, update);
    return { status };
  }

  const levelId = asText(body.level_id, 80);
  if (!levelId) throw new Error("LEVEL_REQUIRED");
  const { data: level, error: levelError } = await sb.from("coaching_levels").select("*").eq("id", levelId).eq("is_active", true).maybeSingle();
  if (levelError) throw levelError;
  if (!level) throw new Error("LEVEL_NOT_FOUND");

  const commission = asPercent(body.commission_percent) ?? Number(level.commission_percent);
  const minimumPrice = asInteger(body.minimum_price_xof) ?? Number(level.minimum_price_xof || 0);
  const maximumPrice = asInteger(body.maximum_price_xof) ?? (level.maximum_price_xof === null ? null : Number(level.maximum_price_xof));
  if (maximumPrice !== null && maximumPrice < minimumPrice) throw new Error("INVALID_PRICE_RANGE");
  const prices = [application.price_30_xof, application.price_60_xof, application.price_90_xof, application.custom_hourly_price_xof]
    .filter((value) => value !== null && value !== undefined)
    .map(Number);
  if (prices.some((price) => price < minimumPrice || (maximumPrice !== null && price > maximumPrice))) throw new Error("APPLICATION_PRICE_OUT_OF_RANGE");

  const { data: domains } = await sb.from("coach_application_domains").select("domain_id").eq("application_id", applicationId);
  const slug = `${slugify(String(application.full_name))}-${String(application.user_id).slice(0, 8)}`;
  const profilePayload = {
    user_id: application.user_id,
    application_id: application.id,
    level_id: levelId,
    status: "active",
    public_slug: slug,
    professional_title: application.professional_title,
    biography: application.biography,
    specialties: application.specialties || [],
    languages: application.languages || [],
    country: application.country,
    timezone: application.timezone,
    photo_url: application.photo_url,
    linkedin_url: application.linkedin_url,
    website_url: application.website_url,
    presentation_video_url: application.presentation_video_url,
    preferred_session_modes: application.preferred_session_modes || ["jitsi"],
    price_30_xof: application.price_30_xof,
    price_60_xof: application.price_60_xof,
    price_90_xof: application.price_90_xof,
    custom_duration_enabled: application.custom_duration_enabled,
    custom_hourly_price_xof: application.custom_hourly_price_xof,
    commission_override_percent: commission,
    minimum_price_override_xof: minimumPrice,
    maximum_price_override_xof: maximumPrice,
    badge_override: asNullableText(body.badge_label, 100),
    is_featured: body.is_featured === true,
    catalogue_priority: asInteger(body.catalogue_priority) ?? 0,
    approved_by: session.userId,
    approved_at: new Date().toISOString(),
    suspended_by: null,
    suspended_at: null,
    suspension_reason: null,
  };
  const { data: profile, error: profileError } = await sb.from("coach_profiles").upsert(profilePayload, { onConflict: "user_id" }).select("id").single();
  if (profileError) throw profileError;
  const profileId = String(profile.id);
  await sb.from("coach_profile_domains").delete().eq("coach_id", profileId);
  if ((domains || []).length) {
    const { error: linkError } = await sb.from("coach_profile_domains").insert((domains || []).map((row: { domain_id: string }) => ({ coach_id: profileId, domain_id: row.domain_id })));
    if (linkError) throw linkError;
  }
  const applicationUpdate = {
    status: "approved",
    reviewed_by: session.userId,
    reviewed_at: new Date().toISOString(),
    admin_message: asNullableText(body.message, 3000),
    rejection_reason: null,
    approved_level_id: levelId,
    approved_commission_percent: commission,
    approved_minimum_price_xof: minimumPrice,
    approved_maximum_price_xof: maximumPrice,
  };
  const { error: appError } = await sb.from("coach_applications").update(applicationUpdate).eq("id", applicationId);
  if (appError) throw appError;
  const { error: roleError } = await sb.from("user_roles").upsert({ user_id: application.user_id, role: "coach", granted_by: session.userId }, { onConflict: "user_id,role" });
  if (roleError) throw roleError;
  await audit(sb, session.userId, "application_approved", "coach_application", applicationId, application, { ...applicationUpdate, profile_id: profileId });
  return { status: "approved", profile_id: profileId };
}

async function updateCoach(sb: Supabase, session: Session, body: Record<string, unknown>) {
  const coachId = asText(body.coach_id, 80);
  if (!coachId) throw new Error("COACH_REQUIRED");
  const { data: current, error } = await sb.from("coach_profiles").select("*").eq("id", coachId).maybeSingle();
  if (error) throw error;
  if (!current) throw new Error("COACH_NOT_FOUND");
  const status = asText(body.status, 30);
  if (status && !["active", "vacation", "suspended", "archived"].includes(status)) throw new Error("INVALID_STATUS");
  const update: Record<string, unknown> = {};
  if (status) update.status = status;
  if (body.level_id !== undefined) update.level_id = asNullableText(body.level_id, 80);
  if (body.commission_percent !== undefined) update.commission_override_percent = asPercent(body.commission_percent);
  if (body.minimum_price_xof !== undefined) update.minimum_price_override_xof = asInteger(body.minimum_price_xof);
  if (body.maximum_price_xof !== undefined) update.maximum_price_override_xof = asInteger(body.maximum_price_xof);
  if (body.is_featured !== undefined) update.is_featured = body.is_featured === true;
  if (body.catalogue_priority !== undefined) update.catalogue_priority = asInteger(body.catalogue_priority) ?? 0;
  if (body.badge_label !== undefined) update.badge_override = asNullableText(body.badge_label, 100);
  if (status === "suspended") {
    const reason = asText(body.suspension_reason, 2000);
    if (!reason) throw new Error("SUSPENSION_REASON_REQUIRED");
    update.suspended_by = session.userId;
    update.suspended_at = new Date().toISOString();
    update.suspension_reason = reason;
  } else if (status === "active") {
    update.suspended_by = null;
    update.suspended_at = null;
    update.suspension_reason = null;
  }
  const { error: updateError } = await sb.from("coach_profiles").update(update).eq("id", coachId);
  if (updateError) throw updateError;
  await audit(sb, session.userId, "coach_updated", "coach_profile", coachId, current, update);
  return { success: true };
}

async function upsertLevel(sb: Supabase, session: Session, body: Record<string, unknown>) {
  const id = asNullableText(body.id, 80);
  const name = asText(body.name, 120);
  if (!name) throw new Error("LEVEL_NAME_REQUIRED");
  const minimumPrice = asInteger(body.minimum_price_xof) ?? 0;
  const maximumPrice = asInteger(body.maximum_price_xof);
  if (maximumPrice !== null && maximumPrice < minimumPrice) throw new Error("INVALID_PRICE_RANGE");
  const payload = {
    slug: slugify(asText(body.slug, 120) || name),
    name,
    description: asNullableText(body.description, 1000),
    commission_percent: asPercent(body.commission_percent) ?? 20,
    minimum_price_xof: minimumPrice,
    maximum_price_xof: maximumPrice,
    minimum_completed_sessions: asInteger(body.minimum_completed_sessions) ?? 0,
    minimum_rating: body.minimum_rating === null || body.minimum_rating === "" ? null : Math.min(5, Math.max(0, Number(body.minimum_rating))),
    badge_label: asNullableText(body.badge_label, 100),
    badge_color: asText(body.badge_color, 20) || "#BF8813",
    catalogue_priority: asInteger(body.catalogue_priority) ?? 0,
    is_featured: body.is_featured === true,
    is_active: body.is_active !== false,
    created_by: session.userId,
  };
  const current = id ? (await sb.from("coaching_levels").select("*").eq("id", id).maybeSingle()).data : null;
  const query = id ? sb.from("coaching_levels").update(payload).eq("id", id) : sb.from("coaching_levels").insert(payload);
  const { data, error } = await query.select("*").single();
  if (error) throw error;
  await audit(sb, session.userId, id ? "level_updated" : "level_created", "coaching_level", String(data.id), current, data);
  return data;
}

async function upsertDomain(sb: Supabase, session: Session, body: Record<string, unknown>) {
  const id = asNullableText(body.id, 80);
  const name = asText(body.name, 120);
  if (!name) throw new Error("DOMAIN_NAME_REQUIRED");
  const payload = {
    slug: slugify(asText(body.slug, 120) || name),
    name,
    description: asNullableText(body.description, 1000),
    icon_key: asNullableText(body.icon_key, 80),
    display_order: asInteger(body.display_order) ?? 0,
    is_active: body.is_active !== false,
    created_by: session.userId,
  };
  const current = id ? (await sb.from("coaching_domains").select("*").eq("id", id).maybeSingle()).data : null;
  const query = id ? sb.from("coaching_domains").update(payload).eq("id", id) : sb.from("coaching_domains").insert(payload);
  const { data, error } = await query.select("*").single();
  if (error) throw error;
  await audit(sb, session.userId, id ? "domain_updated" : "domain_created", "coaching_domain", String(data.id), current, data);
  return data;
}

function errorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  const badRequest = [
    "FILE_REQUIRED", "DOCUMENT_REQUIRED", "FILE_TYPE_NOT_ALLOWED", "FILE_TOO_LARGE", "INVALID_FILE", "APPLICATION_INCOMPLETE", "INVALID_URL",
    "INVALID_DOMAIN", "INVALID_REVIEW", "REVIEW_MESSAGE_REQUIRED", "LEVEL_REQUIRED", "LEVEL_NOT_FOUND", "INVALID_PRICE_RANGE",
    "APPLICATION_PRICE_OUT_OF_RANGE", "COACH_REQUIRED", "INVALID_STATUS", "SUSPENSION_REASON_REQUIRED", "LEVEL_NAME_REQUIRED", "DOMAIN_NAME_REQUIRED",
  ];
  if (code === "SESSION_INVALID") return json({ error: code }, 401);
  if (code === "FORBIDDEN") return json({ error: code }, 403);
  if (["APPLICATION_NOT_FOUND", "COACH_NOT_FOUND"].includes(code)) return json({ error: code }, 404);
  if (code === "APPLICATION_ALREADY_ACTIVE") return json({ error: code }, 409);
  if (badRequest.includes(code)) return json({ error: code }, 400);
  console.error("[coaching]", error);
  return json({ error: "COACHING_ERROR", detail: code }, 500);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = asText(body.action, 80);

    if (action === "public_bootstrap") {
      const [levels, domains, coaches] = await Promise.all([getLevels(sb), getDomains(sb), publicCoaches(sb)]);
      return json({ success: true, levels, domains, coaches });
    }
    if (action === "public_profile") {
      const identifier = asText(body.coach_id, 100);
      if (!identifier) return json({ error: "COACH_REQUIRED" }, 400);
      const coach = await publicProfile(sb, identifier);
      return coach ? json({ success: true, coach }) : json({ error: "COACH_NOT_FOUND" }, 404);
    }

    const session = await authenticate(sb, req);
    if (!session) throw new Error("SESSION_INVALID");

    if (action === "upload_asset") return json({ success: true, asset: await uploadAsset(sb, session, body) });
    if (action === "self_status") {
      const [applications, profile] = await Promise.all([
        loadApplicationRows(sb, session.userId),
        sb.from("coach_profiles").select("*").eq("user_id", session.userId).maybeSingle(),
      ]);
      let enrichedProfile: unknown = null;
      if (profile.data) enrichedProfile = await publicProfile(sb, String(profile.data.public_slug));
      return json({ success: true, application: applications[0] || null, profile: enrichedProfile, roles: session.roles });
    }
    if (action === "submit_application") {
      const applicationId = await submitApplication(sb, session, body);
      return json({ success: true, application_id: applicationId });
    }
    if (action === "coach_dashboard") {
      const { data: profile } = await sb.from("coach_profiles").select("*").eq("user_id", session.userId).maybeSingle();
      if (!profile || !session.roles.includes("coach")) return json({ error: "FORBIDDEN" }, 403);
      return json({ success: true, profile: await publicProfile(sb, String(profile.public_slug)), metrics: { upcoming_sessions: 0, completed_sessions: Number(profile.completed_sessions_count || 0), average_rating: Number(profile.average_rating || 0), available_revenue_xof: 0 } });
    }

    if (!isAdmin(session)) throw new Error("FORBIDDEN");

    if (action === "admin_overview") {
      const [applicationsPending, applicationsAll, coachesActive, coachesSuspended, levels, domains] = await Promise.all([
        sb.from("coach_applications").select("id", { count: "exact", head: true }).in("status", ["pending", "under_review"]),
        sb.from("coach_applications").select("id", { count: "exact", head: true }),
        sb.from("coach_profiles").select("id", { count: "exact", head: true }).eq("status", "active"),
        sb.from("coach_profiles").select("id", { count: "exact", head: true }).eq("status", "suspended"),
        getLevels(sb, true),
        getDomains(sb, true),
      ]);
      return json({ success: true, metrics: { pending_applications: applicationsPending.count || 0, total_applications: applicationsAll.count || 0, active_coaches: coachesActive.count || 0, suspended_coaches: coachesSuspended.count || 0, levels: levels.length, domains: domains.length } });
    }
    if (action === "admin_applications") return json({ success: true, applications: await loadApplicationRows(sb) });
    if (action === "admin_review_application") return json({ success: true, result: await reviewApplication(sb, session, body) });
    if (action === "admin_coaches") return json({ success: true, coaches: await allCoaches(sb), levels: await getLevels(sb, true) });
    if (action === "admin_update_coach") return json(await updateCoach(sb, session, body));
    if (action === "admin_levels") return json({ success: true, levels: await getLevels(sb, true) });
    if (action === "admin_level_save") return json({ success: true, level: await upsertLevel(sb, session, body) });
    if (action === "admin_domains") return json({ success: true, domains: await getDomains(sb, true) });
    if (action === "admin_domain_save") return json({ success: true, domain: await upsertDomain(sb, session, body) });

    return json({ error: "UNKNOWN_ACTION" }, 400);
  } catch (error) {
    return errorResponse(error);
  }
});
