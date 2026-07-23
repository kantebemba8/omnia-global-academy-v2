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
  const [{ data: user }, { data: level }, domainsByCoach, offers] = await Promise.all([
    sb.from("users").select("id,full_name").eq("id", profile.user_id).maybeSingle(),
    profile.level_id ? sb.from("coaching_levels").select("id,slug,name,description,badge_label,badge_color,is_featured").eq("id", profile.level_id).maybeSingle() : Promise.resolve({ data: null }),
    domainMapForProfiles(sb, [String(profile.id)]),
    activeOffers(sb, String(profile.id)),
  ]);
  return {
    ...profile,
    full_name: user?.full_name || "Coach Omnia",
    level: level || null,
    domains: domainsByCoach.get(String(profile.id)) || [],
    offers,
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

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("fr-FR", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1 || value === "1") return true;
  if (value === "false" || value === 0 || value === "0") return false;
  return fallback;
}

function asIsoDate(value: unknown): string | null {
  const text = asText(value, 40);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function asDateOnly(value: unknown): string | null {
  const text = asText(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function asTime(value: unknown): string | null {
  const text = asText(value, 8);
  return /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(text) ? text.slice(0, 5) : null;
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function ownCoachProfile(sb: Supabase, session: Session) {
  const { data: profile, error } = await sb.from("coach_profiles").select("*").eq("user_id", session.userId).maybeSingle();
  if (error) throw error;
  if (!profile || !session.roles.includes("coach")) throw new Error("FORBIDDEN");
  return profile;
}

async function activeOffers(sb: Supabase, coachId: string) {
  const { data, error } = await sb
    .from("coach_offers")
    .select("*,domain:coaching_domains(id,slug,name)")
    .eq("coach_id", coachId)
    .eq("status", "active")
    .order("offer_type")
    .order("duration_minutes", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function allOwnOffers(sb: Supabase, coachId: string) {
  const { data, error } = await sb
    .from("coach_offers")
    .select("*,domain:coaching_domains(id,slug,name)")
    .eq("coach_id", coachId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

async function coachPriceLimits(sb: Supabase, profile: Record<string, unknown>) {
  let level: Record<string, unknown> | null = null;
  if (profile.level_id) {
    const result = await sb.from("coaching_levels").select("*").eq("id", profile.level_id).maybeSingle();
    if (result.error) throw result.error;
    level = result.data;
  }
  return {
    minimum: Number(profile.minimum_price_override_xof ?? level?.minimum_price_xof ?? 0),
    maximum: profile.maximum_price_override_xof !== null && profile.maximum_price_override_xof !== undefined
      ? Number(profile.maximum_price_override_xof)
      : level?.maximum_price_xof !== null && level?.maximum_price_xof !== undefined
        ? Number(level.maximum_price_xof)
        : null,
    commission: Number(profile.commission_override_percent ?? level?.commission_percent ?? 20),
  };
}

function validateOfferPrice(price: number, limits: { minimum: number; maximum: number | null }) {
  if (!Number.isFinite(price) || price < limits.minimum || (limits.maximum !== null && price > limits.maximum)) {
    throw new Error("OFFER_PRICE_OUT_OF_RANGE");
  }
}

async function saveCoachOffer(sb: Supabase, session: Session, body: Record<string, unknown>) {
  const profile = await ownCoachProfile(sb, session);
  if (profile.status === "suspended" || profile.status === "archived") throw new Error("FORBIDDEN");
  const offerType = asText(body.offer_type, 20) === "custom" ? "custom" : "fixed";
  const title = asText(body.title, 160);
  const description = asText(body.description, 2500);
  const domainId = asNullableText(body.domain_id, 80);
  const sessionModes = asStringArray(body.session_modes, 2, 20).filter((mode) => ["jitsi", "external"].includes(mode));
  if (!title || !sessionModes.length) throw new Error("OFFER_INCOMPLETE");

  if (domainId) {
    const { data: link } = await sb.from("coach_profile_domains").select("domain_id").eq("coach_id", profile.id).eq("domain_id", domainId).maybeSingle();
    if (!link) throw new Error("INVALID_DOMAIN");
  }
  const allowedModes = new Set(asStringArray(profile.preferred_session_modes, 2, 20));
  if (sessionModes.some((mode) => !allowedModes.has(mode))) throw new Error("INVALID_SESSION_MODE");

  const limits = await coachPriceLimits(sb, profile);
  const payload: Record<string, unknown> = {
    coach_id: profile.id,
    domain_id: domainId,
    offer_type: offerType,
    title,
    description,
    session_modes: sessionModes,
    status: "pending",
    admin_message: null,
    reviewed_by: null,
    reviewed_at: null,
  };

  if (offerType === "fixed") {
    const duration = asInteger(body.duration_minutes);
    const price = asInteger(body.price_xof);
    if (![30, 60, 90].includes(duration || 0) || price === null) throw new Error("OFFER_INCOMPLETE");
    validateOfferPrice(price, limits);
    Object.assign(payload, { duration_minutes: duration, price_xof: price, hourly_price_xof: null, custom_min_minutes: null, custom_max_minutes: null, custom_step_minutes: null });
  } else {
    const hourlyPrice = asInteger(body.hourly_price_xof);
    const minMinutes = asInteger(body.custom_min_minutes);
    const maxMinutes = asInteger(body.custom_max_minutes);
    const stepMinutes = asInteger(body.custom_step_minutes);
    if (hourlyPrice === null || minMinutes === null || maxMinutes === null || stepMinutes === null || minMinutes < 15 || maxMinutes < minMinutes || stepMinutes < 5 || stepMinutes > 60) throw new Error("OFFER_INCOMPLETE");
    const minimumSessionPrice = Math.round(hourlyPrice * minMinutes / 60);
    const maximumSessionPrice = Math.round(hourlyPrice * maxMinutes / 60);
    if (minimumSessionPrice < limits.minimum || (limits.maximum !== null && maximumSessionPrice > limits.maximum)) throw new Error("OFFER_PRICE_OUT_OF_RANGE");
    Object.assign(payload, { duration_minutes: null, price_xof: null, hourly_price_xof: hourlyPrice, custom_min_minutes: minMinutes, custom_max_minutes: maxMinutes, custom_step_minutes: stepMinutes });
  }

  const offerId = asNullableText(body.offer_id, 80);
  if (offerId) {
    const { data: existing, error } = await sb.from("coach_offers").select("*").eq("id", offerId).eq("coach_id", profile.id).maybeSingle();
    if (error) throw error;
    if (!existing) throw new Error("OFFER_NOT_FOUND");
    if (existing.status === "pending" || existing.status === "rejected") {
      const { data, error: updateError } = await sb.from("coach_offers").update(payload).eq("id", existing.id).select().single();
      if (updateError) throw updateError;
      return data;
    }
    payload.supersedes_offer_id = existing.id;
  }
  const { data, error } = await sb.from("coach_offers").insert(payload).select().single();
  if (error) throw error;
  return data;
}

async function toggleCoachOffer(sb: Supabase, session: Session, body: Record<string, unknown>) {
  const profile = await ownCoachProfile(sb, session);
  const offerId = asText(body.offer_id, 80);
  const active = asBoolean(body.active);
  const { data: offer, error } = await sb.from("coach_offers").select("*").eq("id", offerId).eq("coach_id", profile.id).maybeSingle();
  if (error) throw error;
  if (!offer) throw new Error("OFFER_NOT_FOUND");
  if (!["active", "inactive"].includes(offer.status)) throw new Error("OFFER_NOT_APPROVED");
  if (active) {
    let query = sb.from("coach_offers").update({ status: "inactive" }).eq("coach_id", profile.id).eq("status", "active").eq("offer_type", offer.offer_type);
    if (offer.offer_type === "fixed") query = query.eq("duration_minutes", offer.duration_minutes);
    const { error: deactivateError } = await query;
    if (deactivateError) throw deactivateError;
  }
  const { data, error: updateError } = await sb.from("coach_offers").update({ status: active ? "active" : "inactive" }).eq("id", offer.id).select().single();
  if (updateError) throw updateError;
  return data;
}

async function listCoachAvailability(sb: Supabase, session: Session) {
  const profile = await ownCoachProfile(sb, session);
  const [rules, exceptions, settings] = await Promise.all([
    sb.from("coach_availability_rules").select("*").eq("coach_id", profile.id).order("day_of_week").order("start_time"),
    sb.from("coach_availability_exceptions").select("*").eq("coach_id", profile.id).gte("ends_at", new Date(Date.now() - 30 * 86400000).toISOString()).order("starts_at"),
    sb.from("coaching_settings").select("*").eq("id", 1).single(),
  ]);
  if (rules.error) throw rules.error;
  if (exceptions.error) throw exceptions.error;
  if (settings.error) throw settings.error;
  return { profile, rules: rules.data || [], exceptions: exceptions.data || [], settings: settings.data };
}

async function saveAvailabilityRule(sb: Supabase, session: Session, body: Record<string, unknown>) {
  const profile = await ownCoachProfile(sb, session);
  const day = asInteger(body.day_of_week);
  const startTime = asTime(body.start_time);
  const endTime = asTime(body.end_time);
  const timezone = asText(body.timezone, 80) || String(profile.timezone || "Africa/Bamako");
  const validFrom = asDateOnly(body.valid_from) || toDateOnly(new Date());
  const validUntil = asDateOnly(body.valid_until);
  if (day === null || day > 6 || !startTime || !endTime || startTime >= endTime || !isValidTimeZone(timezone)) throw new Error("INVALID_AVAILABILITY");
  const payload = {
    coach_id: profile.id,
    day_of_week: day,
    start_time: startTime,
    end_time: endTime,
    timezone,
    valid_from: validFrom,
    valid_until: validUntil,
    booking_notice_hours: asInteger(body.booking_notice_hours),
    maximum_sessions_per_day: asInteger(body.maximum_sessions_per_day),
    buffer_before_minutes: asInteger(body.buffer_before_minutes) || 0,
    buffer_after_minutes: asInteger(body.buffer_after_minutes) || 0,
    is_active: body.is_active === undefined ? true : asBoolean(body.is_active, true),
  };
  const id = asNullableText(body.id, 80);
  const result = id
    ? await sb.from("coach_availability_rules").update(payload).eq("id", id).eq("coach_id", profile.id).select().single()
    : await sb.from("coach_availability_rules").insert(payload).select().single();
  if (result.error) throw result.error;
  return result.data;
}

async function deleteAvailabilityRule(sb: Supabase, session: Session, body: Record<string, unknown>) {
  const profile = await ownCoachProfile(sb, session);
  const id = asText(body.id, 80);
  if (!id) throw new Error("INVALID_AVAILABILITY");
  const { error } = await sb.from("coach_availability_rules").delete().eq("id", id).eq("coach_id", profile.id);
  if (error) throw error;
}

async function saveAvailabilityException(sb: Supabase, session: Session, body: Record<string, unknown>) {
  const profile = await ownCoachProfile(sb, session);
  const startsAt = asIsoDate(body.starts_at);
  const endsAt = asIsoDate(body.ends_at);
  const exceptionType = asText(body.exception_type, 20);
  if (!startsAt || !endsAt || startsAt >= endsAt || !["blocked", "available"].includes(exceptionType)) throw new Error("INVALID_AVAILABILITY");
  const payload = { coach_id: profile.id, exception_type: exceptionType, starts_at: startsAt, ends_at: endsAt, reason: asNullableText(body.reason, 500) };
  const id = asNullableText(body.id, 80);
  const result = id
    ? await sb.from("coach_availability_exceptions").update(payload).eq("id", id).eq("coach_id", profile.id).select().single()
    : await sb.from("coach_availability_exceptions").insert(payload).select().single();
  if (result.error) throw result.error;
  return result.data;
}

async function deleteAvailabilityException(sb: Supabase, session: Session, body: Record<string, unknown>) {
  const profile = await ownCoachProfile(sb, session);
  const id = asText(body.id, 80);
  if (!id) throw new Error("INVALID_AVAILABILITY");
  const { error } = await sb.from("coach_availability_exceptions").delete().eq("id", id).eq("coach_id", profile.id);
  if (error) throw error;
}

async function publicSlots(sb: Supabase, body: Record<string, unknown>) {
  const coachIdentifier = asText(body.coach_id, 100);
  const offerId = asText(body.offer_id, 80);
  const fromDate = asDateOnly(body.from_date) || toDateOnly(new Date());
  const toDate = asDateOnly(body.to_date) || toDateOnly(new Date(Date.now() + 30 * 86400000));
  const fromTimestamp = Date.parse(`${fromDate}T00:00:00.000Z`);
  const toTimestamp = Date.parse(`${toDate}T00:00:00.000Z`);
  if (!coachIdentifier || !offerId || toDate < fromDate || !Number.isFinite(fromTimestamp) || !Number.isFinite(toTimestamp) || toTimestamp - fromTimestamp > 31 * 86400000) throw new Error("INVALID_AVAILABILITY_RANGE");
  const { data: profile } = await sb.from("coach_profiles").select("id,status").eq(/^[0-9a-f-]{36}$/i.test(coachIdentifier) ? "id" : "public_slug", coachIdentifier).maybeSingle();
  if (!profile || profile.status !== "active") throw new Error("COACH_NOT_FOUND");
  const { data: offer, error: offerError } = await sb.from("coach_offers").select("*").eq("id", offerId).eq("coach_id", profile.id).eq("status", "active").maybeSingle();
  if (offerError) throw offerError;
  if (!offer) throw new Error("OFFER_NOT_FOUND");
  const duration = offer.offer_type === "fixed" ? Number(offer.duration_minutes) : asInteger(body.duration_minutes);
  if (!duration || duration < 15 || duration > 480) throw new Error("INVALID_DURATION");
  if (offer.offer_type === "custom") {
    if (duration < Number(offer.custom_min_minutes) || duration > Number(offer.custom_max_minutes) || (duration - Number(offer.custom_min_minutes)) % Number(offer.custom_step_minutes) !== 0) throw new Error("INVALID_DURATION");
  }
  const { data, error } = await sb.rpc("coaching_available_slots", { p_coach_id: profile.id, p_from_date: fromDate, p_to_date: toDate, p_duration_minutes: duration, p_limit: 300 });
  if (error) throw error;
  return { coach_id: profile.id, offer, duration_minutes: duration, slots: data || [] };
}

async function coachRequestSlots(sb: Supabase, session: Session, body: Record<string, unknown>) {
  const profile = await ownCoachProfile(sb, session);
  const sessionId = asText(body.session_id, 80);
  const fromDate = asDateOnly(body.from_date) || toDateOnly(new Date());
  const toDate = asDateOnly(body.to_date) || fromDate;
  const fromTimestamp = Date.parse(`${fromDate}T00:00:00.000Z`);
  const toTimestamp = Date.parse(`${toDate}T00:00:00.000Z`);
  if (!sessionId || toDate < fromDate || !Number.isFinite(fromTimestamp) || !Number.isFinite(toTimestamp) || toTimestamp - fromTimestamp > 31 * 86400000) throw new Error("INVALID_AVAILABILITY_RANGE");
  const { data: booking, error: bookingError } = await sb.from("coaching_sessions").select("id,coach_id,duration_minutes,status").eq("id", sessionId).eq("coach_id", profile.id).eq("status", "pending_coach").maybeSingle();
  if (bookingError) throw bookingError;
  if (!booking) throw new Error("BOOKING_NOT_FOUND");
  const { data, error } = await sb.rpc("coaching_available_slots", { p_coach_id: profile.id, p_from_date: fromDate, p_to_date: toDate, p_duration_minutes: Number(booking.duration_minutes), p_limit: 300 });
  if (error) throw error;
  return { duration_minutes: Number(booking.duration_minutes), slots: data || [] };
}

async function favoriteState(sb: Supabase, session: Session, coachId: string) {
  const { data, error } = await sb.from("coach_favorites").select("coach_id").eq("user_id", session.userId).eq("coach_id", coachId).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

async function toggleFavorite(sb: Supabase, session: Session, body: Record<string, unknown>) {
  const coachId = asText(body.coach_id, 80);
  const active = asBoolean(body.active, true);
  const { data: coach } = await sb.from("coach_profiles").select("id,user_id,status").eq("id", coachId).maybeSingle();
  if (!coach || !["active", "vacation"].includes(coach.status)) throw new Error("COACH_NOT_FOUND");
  if (String(coach.user_id) === session.userId) throw new Error("CANNOT_FAVORITE_SELF");
  if (active) {
    const { error } = await sb.from("coach_favorites").upsert({ user_id: session.userId, coach_id: coachId }, { onConflict: "user_id,coach_id" });
    if (error) throw error;
  } else {
    const { error } = await sb.from("coach_favorites").delete().eq("user_id", session.userId).eq("coach_id", coachId);
    if (error) throw error;
  }
  return active;
}

async function expireBookingHolds(sb: Supabase, coachId?: string) {
  let query = sb.from("coaching_sessions").update({ status: "expired" }).eq("status", "pending_payment").lt("hold_expires_at", new Date().toISOString());
  if (coachId) query = query.eq("coach_id", coachId);
  const { error } = await query;
  if (error) throw error;
}

async function loadBookingContext(sb: Supabase, offerId: string) {
  const { data: offer, error } = await sb.from("coach_offers").select("*").eq("id", offerId).eq("status", "active").maybeSingle();
  if (error) throw error;
  if (!offer) throw new Error("OFFER_NOT_FOUND");
  const { data: profile, error: profileError } = await sb.from("coach_profiles").select("*").eq("id", offer.coach_id).eq("status", "active").maybeSingle();
  if (profileError) throw profileError;
  if (!profile) throw new Error("COACH_NOT_FOUND");
  const [{ data: user }, limits, { data: settings }] = await Promise.all([
    sb.from("users").select("id,full_name").eq("id", profile.user_id).maybeSingle(),
    coachPriceLimits(sb, profile),
    sb.from("coaching_settings").select("*").eq("id", 1).single(),
  ]);
  return { offer, profile, coachName: user?.full_name || "Coach Omnia", limits, settings };
}

async function ensureSlotAvailable(sb: Supabase, coachId: string, duration: number, startIso: string) {
  const date = new Date(startIso);
  const from = toDateOnly(new Date(date.getTime() - 86400000));
  const to = toDateOnly(new Date(date.getTime() + 86400000));
  const { data, error } = await sb.rpc("coaching_available_slots", { p_coach_id: coachId, p_from_date: from, p_to_date: to, p_duration_minutes: duration, p_limit: 500 });
  if (error) throw error;
  const target = date.getTime();
  const slot = (data || []).find((item: { slot_start: string }) => Math.abs(new Date(item.slot_start).getTime() - target) < 1000);
  if (!slot) throw new Error("SLOT_UNAVAILABLE");
  return slot as { slot_start: string; slot_end: string };
}

async function createFixedBooking(sb: Supabase, session: Session, body: Record<string, unknown>) {
  const offerId = asText(body.offer_id, 80);
  const startIso = asIsoDate(body.slot_start);
  const meetingMode = asText(body.meeting_mode, 20);
  if (!offerId || !startIso || !["jitsi", "external"].includes(meetingMode)) throw new Error("BOOKING_INCOMPLETE");
  const context = await loadBookingContext(sb, offerId);
  if (context.offer.offer_type !== "fixed") throw new Error("INVALID_OFFER_TYPE");
  if (String(context.profile.user_id) === session.userId) throw new Error("CANNOT_BOOK_SELF");
  if (!asStringArray(context.offer.session_modes, 2, 20).includes(meetingMode)) throw new Error("INVALID_SESSION_MODE");
  await expireBookingHolds(sb, String(context.profile.id));
  const duration = Number(context.offer.duration_minutes);
  const slot = await ensureSlotAvailable(sb, String(context.profile.id), duration, startIso);
  const price = Number(context.offer.price_xof);
  const commissionAmount = Math.round(price * context.limits.commission / 100);
  const holdExpiresAt = new Date(Date.now() + Number(context.settings?.slot_hold_minutes || 15) * 60000).toISOString();
  const payload = {
    learner_user_id: session.userId,
    coach_id: context.profile.id,
    offer_id: context.offer.id,
    session_type: "fixed",
    status: "pending_payment",
    payment_status: "not_started",
    meeting_mode: meetingMode,
    requested_start: slot.slot_start,
    requested_end: slot.slot_end,
    scheduled_start: slot.slot_start,
    scheduled_end: slot.slot_end,
    duration_minutes: duration,
    hold_expires_at: holdExpiresAt,
    learner_message: asNullableText(body.learner_message, 1500),
    price_total_xof: price,
    commission_percent_snapshot: context.limits.commission,
    commission_amount_xof: commissionAmount,
    coach_net_xof: price - commissionAmount,
    offer_title_snapshot: context.offer.title,
    coach_name_snapshot: context.coachName,
    coach_timezone_snapshot: context.profile.timezone,
    policy_snapshot: { source: "coaching_module_2", payment_activation: "module_3", hold_minutes: Number(context.settings?.slot_hold_minutes || 15) },
  };
  const { data, error } = await sb.from("coaching_sessions").insert(payload).select().single();
  if (error) {
    if ((error as { code?: string }).code === "23P01") throw new Error("SLOT_UNAVAILABLE");
    throw error;
  }
  return data;
}

async function createCustomRequest(sb: Supabase, session: Session, body: Record<string, unknown>) {
  const offerId = asText(body.offer_id, 80);
  const startIso = asIsoDate(body.slot_start);
  const meetingMode = asText(body.meeting_mode, 20);
  const duration = asInteger(body.duration_minutes);
  if (!offerId || !startIso || !duration || !["jitsi", "external"].includes(meetingMode)) throw new Error("BOOKING_INCOMPLETE");
  const context = await loadBookingContext(sb, offerId);
  if (context.offer.offer_type !== "custom") throw new Error("INVALID_OFFER_TYPE");
  if (String(context.profile.user_id) === session.userId) throw new Error("CANNOT_BOOK_SELF");
  if (!asStringArray(context.offer.session_modes, 2, 20).includes(meetingMode)) throw new Error("INVALID_SESSION_MODE");
  if (duration < Number(context.offer.custom_min_minutes) || duration > Number(context.offer.custom_max_minutes) || (duration - Number(context.offer.custom_min_minutes)) % Number(context.offer.custom_step_minutes) !== 0) throw new Error("INVALID_DURATION");
  const slot = await ensureSlotAvailable(sb, String(context.profile.id), duration, startIso);
  const price = Math.round(Number(context.offer.hourly_price_xof) * duration / 60);
  const commissionAmount = Math.round(price * context.limits.commission / 100);
  const { data, error } = await sb.from("coaching_sessions").insert({
    learner_user_id: session.userId,
    coach_id: context.profile.id,
    offer_id: context.offer.id,
    session_type: "custom",
    status: "pending_coach",
    payment_status: "not_started",
    meeting_mode: meetingMode,
    requested_start: slot.slot_start,
    requested_end: slot.slot_end,
    duration_minutes: duration,
    learner_message: asNullableText(body.learner_message, 1500),
    price_total_xof: price,
    commission_percent_snapshot: context.limits.commission,
    commission_amount_xof: commissionAmount,
    coach_net_xof: price - commissionAmount,
    offer_title_snapshot: context.offer.title,
    coach_name_snapshot: context.coachName,
    coach_timezone_snapshot: context.profile.timezone,
    policy_snapshot: { source: "coaching_module_2", payment_activation: "module_3" },
  }).select().single();
  if (error) throw error;
  return data;
}

async function coachingSessionsForUser(sb: Supabase, userId: string, coachId?: string) {
  let query = sb.from("coaching_sessions").select("*").order("created_at", { ascending: false });
  query = coachId ? query.eq("coach_id", coachId) : query.eq("learner_user_id", userId);
  const { data, error } = await query;
  if (error) throw error;
  const rows = data || [];
  const coachIds = [...new Set(rows.map((row: { coach_id: string }) => String(row.coach_id)))];
  const { data: profiles } = coachIds.length ? await sb.from("coach_profiles").select("id,user_id,public_slug,photo_url,professional_title").in("id", coachIds) : { data: [] };
  const userIds = (profiles || []).map((profile: { user_id: string }) => String(profile.user_id));
  const { data: users } = userIds.length ? await sb.from("users").select("id,full_name").in("id", userIds) : { data: [] };
  const userMap = new Map((users || []).map((user: { id: string }) => [String(user.id), user]));
  const profileMap = new Map((profiles || []).map((profile: { id: string; user_id: string }) => [String(profile.id), { ...profile, full_name: (userMap.get(String(profile.user_id)) as { full_name?: string } | undefined)?.full_name || "Coach Omnia" }]));
  return rows.map((row: Record<string, unknown>) => ({ ...row, coach: profileMap.get(String(row.coach_id)) || null }));
}

async function learnerDashboard(sb: Supabase, session: Session) {
  await expireBookingHolds(sb);
  const [sessions, favorites] = await Promise.all([
    coachingSessionsForUser(sb, session.userId),
    sb.from("coach_favorites").select("coach_id,created_at").eq("user_id", session.userId).order("created_at", { ascending: false }),
  ]);
  if (favorites.error) throw favorites.error;
  const favoriteIds = (favorites.data || []).map((row: { coach_id: string }) => String(row.coach_id));
  const all = await publicCoaches(sb);
  return { sessions, favorites: all.filter((coach: { id: string }) => favoriteIds.includes(String(coach.id))) };
}

async function coachSessions(sb: Supabase, session: Session) {
  const profile = await ownCoachProfile(sb, session);
  await expireBookingHolds(sb, String(profile.id));
  const rows = await coachingSessionsForUser(sb, session.userId, String(profile.id));
  const learnerIds = [...new Set(rows.map((row: Record<string, unknown>) => String(row.learner_user_id)))];
  const { data: learners } = learnerIds.length ? await sb.from("users").select("id,full_name,email").in("id", learnerIds) : { data: [] };
  const learnerMap = new Map((learners || []).map((learner: { id: string }) => [String(learner.id), learner]));
  return rows.map((row: Record<string, unknown>) => ({ ...row, learner: learnerMap.get(String(row.learner_user_id)) || null }));
}

async function decideCustomRequest(sb: Supabase, session: Session, body: Record<string, unknown>) {
  const profile = await ownCoachProfile(sb, session);
  const sessionId = asText(body.session_id, 80);
  const decision = asText(body.decision, 20);
  const responseMessage = asNullableText(body.message, 1000);
  const { data: booking, error } = await sb.from("coaching_sessions").select("*").eq("id", sessionId).eq("coach_id", profile.id).eq("status", "pending_coach").maybeSingle();
  if (error) throw error;
  if (!booking) throw new Error("BOOKING_NOT_FOUND");
  if (decision === "decline") {
    const { data, error: updateError } = await sb.from("coaching_sessions").update({ status: "declined_by_coach", coach_response_message: responseMessage }).eq("id", booking.id).select().single();
    if (updateError) throw updateError;
    return data;
  }
  if (!["accept", "propose"].includes(decision)) throw new Error("INVALID_DECISION");
  const startIso = decision === "propose" ? asIsoDate(body.slot_start) : booking.requested_start;
  if (!startIso) throw new Error("BOOKING_INCOMPLETE");
  await expireBookingHolds(sb, String(profile.id));
  const slot = await ensureSlotAvailable(sb, String(profile.id), Number(booking.duration_minutes), String(startIso));
  const { data: settings } = await sb.from("coaching_settings").select("slot_hold_minutes").eq("id", 1).single();
  const holdExpiresAt = new Date(Date.now() + Number(settings?.slot_hold_minutes || 15) * 60000).toISOString();
  const { data, error: updateError } = await sb.from("coaching_sessions").update({
    status: "pending_payment",
    requested_start: decision === "propose" ? slot.slot_start : booking.requested_start,
    requested_end: decision === "propose" ? slot.slot_end : booking.requested_end,
    scheduled_start: slot.slot_start,
    scheduled_end: slot.slot_end,
    hold_expires_at: holdExpiresAt,
    coach_response_message: responseMessage,
  }).eq("id", booking.id).select().single();
  if (updateError) {
    if ((updateError as { code?: string }).code === "23P01") throw new Error("SLOT_UNAVAILABLE");
    throw updateError;
  }
  return data;
}

async function cancelPendingBooking(sb: Supabase, session: Session, body: Record<string, unknown>) {
  const id = asText(body.session_id, 80);
  const { data, error } = await sb.from("coaching_sessions").select("id,status,learner_user_id").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data || String(data.learner_user_id) !== session.userId) throw new Error("BOOKING_NOT_FOUND");
  if (!["pending_coach", "pending_payment", "requested"].includes(data.status)) throw new Error("BOOKING_CANNOT_CANCEL");
  const result = await sb.from("coaching_sessions").update({ status: "cancelled_by_learner", hold_expires_at: null }).eq("id", id).select().single();
  if (result.error) throw result.error;
  return result.data;
}

async function adminOffers(sb: Supabase) {
  const { data: offers, error } = await sb.from("coach_offers").select("*,domain:coaching_domains(id,name)").order("created_at", { ascending: false });
  if (error) throw error;
  const rows = offers || [];
  const coachIds = [...new Set(rows.map((row: { coach_id: string }) => String(row.coach_id)))];
  const { data: profiles } = coachIds.length ? await sb.from("coach_profiles").select("id,user_id,public_slug,professional_title").in("id", coachIds) : { data: [] };
  const userIds = (profiles || []).map((profile: { user_id: string }) => String(profile.user_id));
  const { data: users } = userIds.length ? await sb.from("users").select("id,full_name").in("id", userIds) : { data: [] };
  const userMap = new Map((users || []).map((user: { id: string }) => [String(user.id), user]));
  const profileMap = new Map((profiles || []).map((profile: { id: string; user_id: string }) => [String(profile.id), { ...profile, full_name: (userMap.get(String(profile.user_id)) as { full_name?: string } | undefined)?.full_name || "Coach Omnia" }]));
  return rows.map((offer: Record<string, unknown>) => ({ ...offer, coach: profileMap.get(String(offer.coach_id)) || null }));
}

async function reviewCoachOffer(sb: Supabase, session: Session, body: Record<string, unknown>) {
  const offerId = asText(body.offer_id, 80);
  const decision = asText(body.decision, 20);
  const message = asNullableText(body.message, 1000);
  if (!["approve", "reject"].includes(decision)) throw new Error("INVALID_DECISION");
  if (decision === "reject" && !message) throw new Error("REVIEW_MESSAGE_REQUIRED");
  const { data: offer, error } = await sb.from("coach_offers").select("*").eq("id", offerId).eq("status", "pending").maybeSingle();
  if (error) throw error;
  if (!offer) throw new Error("OFFER_NOT_FOUND");
  if (decision === "reject") {
    const result = await sb.from("coach_offers").update({ status: "rejected", admin_message: message, reviewed_by: session.userId, reviewed_at: new Date().toISOString() }).eq("id", offer.id).select().single();
    if (result.error) throw result.error;
    await audit(sb, session.userId, "coach_offer_rejected", "coach_offer", offer.id, offer, result.data, { message });
    return result.data;
  }

  const { data: profile, error: profileError } = await sb.from("coach_profiles").select("*").eq("id", offer.coach_id).maybeSingle();
  if (profileError) throw profileError;
  if (!profile) throw new Error("COACH_NOT_FOUND");
  const limits = await coachPriceLimits(sb, profile);
  const pricePatch: Record<string, unknown> = {};
  if (offer.offer_type === "fixed") {
    const adjustedPrice = body.adjusted_price_xof === undefined || body.adjusted_price_xof === null || body.adjusted_price_xof === "" ? Number(offer.price_xof) : asInteger(body.adjusted_price_xof);
    if (adjustedPrice === null) throw new Error("OFFER_INCOMPLETE");
    validateOfferPrice(adjustedPrice, limits);
    pricePatch.price_xof = adjustedPrice;
  } else {
    const adjustedHourlyPrice = body.adjusted_hourly_price_xof === undefined || body.adjusted_hourly_price_xof === null || body.adjusted_hourly_price_xof === "" ? Number(offer.hourly_price_xof) : asInteger(body.adjusted_hourly_price_xof);
    if (adjustedHourlyPrice === null) throw new Error("OFFER_INCOMPLETE");
    const minimumSessionPrice = Math.round(adjustedHourlyPrice * Number(offer.custom_min_minutes) / 60);
    const maximumSessionPrice = Math.round(adjustedHourlyPrice * Number(offer.custom_max_minutes) / 60);
    if (minimumSessionPrice < limits.minimum || (limits.maximum !== null && maximumSessionPrice > limits.maximum)) throw new Error("OFFER_PRICE_OUT_OF_RANGE");
    pricePatch.hourly_price_xof = adjustedHourlyPrice;
  }

  const { data: finalOffer, error: activationError } = await sb.rpc("coaching_activate_offer", {
    p_offer_id: offer.id,
    p_admin_user_id: session.userId,
    p_admin_message: message,
    p_price_xof: offer.offer_type === "fixed" ? pricePatch.price_xof : null,
    p_hourly_price_xof: offer.offer_type === "custom" ? pricePatch.hourly_price_xof : null,
  });
  if (activationError) throw activationError;
  const priceAdjusted = offer.offer_type === "fixed"
    ? Number(finalOffer.price_xof) !== Number(offer.price_xof)
    : Number(finalOffer.hourly_price_xof) !== Number(offer.hourly_price_xof);
  await audit(sb, session.userId, "coach_offer_approved", "coach_offer", offer.id, offer, finalOffer, { message, price_adjusted: priceAdjusted });
  return finalOffer;
}

function errorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  const badRequest = [
    "FILE_REQUIRED", "DOCUMENT_REQUIRED", "FILE_TYPE_NOT_ALLOWED", "FILE_TOO_LARGE", "INVALID_FILE", "APPLICATION_INCOMPLETE", "INVALID_URL",
    "INVALID_DOMAIN", "INVALID_REVIEW", "REVIEW_MESSAGE_REQUIRED", "LEVEL_REQUIRED", "LEVEL_NOT_FOUND", "INVALID_PRICE_RANGE",
    "APPLICATION_PRICE_OUT_OF_RANGE", "COACH_REQUIRED", "INVALID_STATUS", "SUSPENSION_REASON_REQUIRED", "LEVEL_NAME_REQUIRED", "DOMAIN_NAME_REQUIRED",
    "OFFER_INCOMPLETE", "OFFER_PRICE_OUT_OF_RANGE", "INVALID_SESSION_MODE", "INVALID_AVAILABILITY", "INVALID_AVAILABILITY_RANGE",
    "INVALID_DURATION", "BOOKING_INCOMPLETE", "INVALID_OFFER_TYPE", "CANNOT_BOOK_SELF", "CANNOT_FAVORITE_SELF", "INVALID_DECISION",
    "BOOKING_CANNOT_CANCEL",
  ];
  if (code === "SESSION_INVALID") return json({ error: code }, 401);
  if (code === "FORBIDDEN") return json({ error: code }, 403);
  if (["APPLICATION_NOT_FOUND", "COACH_NOT_FOUND", "OFFER_NOT_FOUND", "BOOKING_NOT_FOUND"].includes(code)) return json({ error: code }, 404);
  if (["APPLICATION_ALREADY_ACTIVE", "SLOT_UNAVAILABLE", "OFFER_NOT_APPROVED"].includes(code)) return json({ error: code }, 409);
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
    if (action === "public_availability") return json({ success: true, ...(await publicSlots(sb, body)) });

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
    if (action === "favorite_status") {
      const coachId = asText(body.coach_id, 80);
      return json({ success: true, favorite: await favoriteState(sb, session, coachId) });
    }
    if (action === "favorite_toggle") return json({ success: true, favorite: await toggleFavorite(sb, session, body) });
    if (action === "learner_coaching_dashboard") return json({ success: true, ...(await learnerDashboard(sb, session)) });
    if (action === "booking_create_fixed") return json({ success: true, session: await createFixedBooking(sb, session, body) });
    if (action === "booking_create_custom") return json({ success: true, session: await createCustomRequest(sb, session, body) });
    if (action === "booking_cancel_pending") return json({ success: true, session: await cancelPendingBooking(sb, session, body) });
    if (action === "coach_dashboard") {
      const profile = await ownCoachProfile(sb, session);
      await expireBookingHolds(sb, String(profile.id));
      const now = new Date().toISOString();
      const [upcoming, pendingCustom, offers, sessions] = await Promise.all([
        sb.from("coaching_sessions").select("id", { count: "exact", head: true }).eq("coach_id", profile.id).in("status", ["pending_payment", "confirmed", "ready"]).gte("scheduled_start", now),
        sb.from("coaching_sessions").select("id", { count: "exact", head: true }).eq("coach_id", profile.id).eq("status", "pending_coach"),
        allOwnOffers(sb, String(profile.id)),
        coachSessions(sb, session),
      ]);
      return json({ success: true, profile: await publicProfile(sb, String(profile.public_slug)), offers, recent_sessions: sessions.slice(0, 8), metrics: { upcoming_sessions: upcoming.count || 0, pending_custom_requests: pendingCustom.count || 0, completed_sessions: Number(profile.completed_sessions_count || 0), average_rating: Number(profile.average_rating || 0), available_revenue_xof: 0 } });
    }
    if (action === "coach_offers") { const profile = await ownCoachProfile(sb, session); return json({ success: true, offers: await allOwnOffers(sb, String(profile.id)), domains: await getDomains(sb), profile, limits: await coachPriceLimits(sb, profile) }); }
    if (action === "coach_offer_save") return json({ success: true, offer: await saveCoachOffer(sb, session, body) });
    if (action === "coach_offer_toggle") return json({ success: true, offer: await toggleCoachOffer(sb, session, body) });
    if (action === "coach_availability") return json({ success: true, ...(await listCoachAvailability(sb, session)) });
    if (action === "coach_availability_rule_save") return json({ success: true, rule: await saveAvailabilityRule(sb, session, body) });
    if (action === "coach_availability_rule_delete") { await deleteAvailabilityRule(sb, session, body); return json({ success: true }); }
    if (action === "coach_availability_exception_save") return json({ success: true, exception: await saveAvailabilityException(sb, session, body) });
    if (action === "coach_availability_exception_delete") { await deleteAvailabilityException(sb, session, body); return json({ success: true }); }
    if (action === "coach_sessions") return json({ success: true, sessions: await coachSessions(sb, session) });
    if (action === "coach_request_availability") return json({ success: true, ...(await coachRequestSlots(sb, session, body)) });
    if (action === "coach_custom_request_decide") return json({ success: true, session: await decideCustomRequest(sb, session, body) });

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
    if (action === "admin_offers") return json({ success: true, offers: await adminOffers(sb) });
    if (action === "admin_offer_review") return json({ success: true, offer: await reviewCoachOffer(sb, session, body) });

    return json({ error: "UNKNOWN_ACTION" }, 400);
  } catch (error) {
    return errorResponse(error);
  }
});
