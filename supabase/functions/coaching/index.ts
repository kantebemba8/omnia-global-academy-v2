import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { hasStructurePermission, validatedStructureAccess } from "../_shared/structure-access.ts";
import { fedaPayApiBase, fedaPaySecretKey } from "../_shared/fedapay-security.ts";
import { createAccessInvitation, ensureCoachOgaAccess } from "../_shared/access-invitations.ts";
import { sha256Hex } from "../_shared/auth-security.ts";
import { createJaasMeetingAccess, jaasConfigured, publicJitsiDevEnabled } from "../_shared/jaas.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { getActiveOmniaSessionResult, isOmniaInternalRequest, omniaInternalHeaders } from "../_shared/omnia-auth.ts";

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
  if (isOmniaInternalRequest(req)) return { userId: "service", roles: ["service_role"] };
  const explicitToken = (req.headers.get("x-omnia-session-token") || "").trim();
  const bearerToken = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const token = explicitToken || bearerToken;
  if (!token) return null;
  const { data: session, error } = await getActiveOmniaSessionResult(sb, token);
  if (error || !session?.user_id) return null;
  const userId = String(session.user_id);
  const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", userId);
  return { userId, roles: (roles || []).map((row: { role: string }) => String(row.role)) };
}

function isAdmin(session: Session | null): boolean {
  return !!session?.roles.includes("super_admin");
}

function isService(session: Session | null): boolean {
  return !!session?.roles.includes("service_role");
}

const DIRECT_COACH_ELIGIBILITY_ROLES = new Set(["professeur", "formateur"]);
const STRUCTURE_MANAGER_ROLES = new Set(["gestionnaire_partenaire", "gestionnaire_structure", "responsable_structure", "structure_admin", "directeur", "etablissement_directeur"]);

type CoachEligibility = {
  eligible: boolean;
  source: "existing_coach" | "professor" | "structure_designation" | "external_candidate" | "none";
  organization_id?: string | null;
  message: string;
};

async function coachEligibility(sb: Supabase, session: Session): Promise<CoachEligibility> {
  if (session.roles.includes("super_admin") || session.roles.includes("service_role")) {
    return {
      eligible: false,
      source: "none",
      message: "Le compte d’Administration conserve un accès exclusif et ne peut pas candidater comme Coach.",
    };
  }
  if (session.roles.includes("coach")) {
    return { eligible: true, source: "existing_coach", message: "Votre profil coach est déjà actif ou en cours de gestion." };
  }
  if (session.roles.some(role => DIRECT_COACH_ELIGIBILITY_ROLES.has(role))) {
    return { eligible: true, source: "professor", message: "Les professeurs et formateurs OGA peuvent déposer une candidature coach." };
  }
  const { data: designation, error } = await sb
    .from("structure_coach_designations")
    .select("organization_id")
    .eq("user_id", session.userId)
    .eq("status", "active")
    .order("designated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (designation?.organization_id) {
    return {
      eligible: true,
      source: "structure_designation",
      organization_id: String(designation.organization_id),
      message: "Votre Structure vous a désigné pour déposer une candidature coach.",
    };
  }
  return {
    eligible: true,
    source: "external_candidate",
    message: "Vous pouvez déposer une candidature Coach avec votre compte Omnia. Le rôle Coach sera ajouté uniquement après validation de l’Administration.",
  };
}

async function structureManagerOrganization(sb: Supabase, session: Session, requestedOrganizationId: string): Promise<string> {
  if (isAdmin(session)) {
    if (!requestedOrganizationId) throw new Error("ORGANIZATION_REQUIRED");
    return requestedOrganizationId;
  }
  if (!session.roles.some(role => STRUCTURE_MANAGER_ROLES.has(role))) throw new Error("FORBIDDEN");
  const structureAccess = await validatedStructureAccess(sb, session.userId, requestedOrganizationId);
  if (!structureAccess?.organizationId) throw new Error("STRUCTURE_NOT_VALIDATED");
  if (!hasStructurePermission(structureAccess, "can_manage_structure_users")) throw new Error("STRUCTURE_TEAM_PERMISSION_REQUIRED");
  return structureAccess.organizationId;
}

async function isLinkedStructureMember(sb: Supabase, organizationId: string, userId: string): Promise<boolean> {
  const [manager, member] = await Promise.all([
    sb.from("partner_managers").select("user_id").eq("organization_id", organizationId).eq("user_id", userId).in("status", ["actif", "active"]).limit(1).maybeSingle(),
    sb.from("partner_code_users").select("user_id").eq("organization_id", organizationId).eq("user_id", userId).limit(1).maybeSingle(),
  ]);
  return Boolean(manager.data?.user_id || member.data?.user_id);
}

async function structureCoachDesignations(sb: Supabase, session: Session, body: Record<string, unknown>) {
  const organizationId = await structureManagerOrganization(sb, session, asText(body.organization_id, 80));
  const { data, error } = await sb
    .from("structure_coach_designations")
    .select("id,organization_id,user_id,status,designated_at,revoked_at,users(full_name,email)")
    .eq("organization_id", organizationId)
    .order("designated_at", { ascending: false });
  if (error) throw error;
  return { organization_id: organizationId, designations: data || [] };
}

async function structureCoachDesignate(sb: Supabase, session: Session, body: Record<string, unknown>) {
  const organizationId = await structureManagerOrganization(sb, session, asText(body.organization_id, 80));
  const email = asText(body.email, 255).toLowerCase();
  const active = body.active !== false;
  if (!email) throw new Error("EMAIL_REQUIRED");
  const { data: user, error: userError } = await sb.from("users").select("id,email,full_name").ilike("email", email).maybeSingle();
  if (userError) throw userError;
  if (!user?.id) throw new Error("USER_NOT_FOUND");
  const linked = String(user.id) === session.userId || await isLinkedStructureMember(sb, organizationId, String(user.id));
  if (!linked && !isAdmin(session)) throw new Error("STRUCTURE_MEMBER_REQUIRED");

  const payload = active
    ? {
        organization_id: organizationId,
        user_id: user.id,
        status: "active",
        designated_by: session.userId,
        designated_at: new Date().toISOString(),
        revoked_by: null,
        revoked_at: null,
        updated_at: new Date().toISOString(),
      }
    : {
        organization_id: organizationId,
        user_id: user.id,
        status: "revoked",
        designated_by: session.userId,
        revoked_by: session.userId,
        revoked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
  const { data, error } = await sb
    .from("structure_coach_designations")
    .upsert(payload, { onConflict: "organization_id,user_id" })
    .select("id,organization_id,user_id,status,designated_at,revoked_at")
    .single();
  if (error) throw error;
  await audit(sb, session.userId, active ? "structure_coach_designated" : "structure_coach_designation_revoked", "structure_coach_designation", String(data.id), null, { ...data, target_email: email });
  return { designation: data, user: { id: user.id, email: user.email, full_name: user.full_name } };
}

const COACH_PREVIEW_EMAIL = "coach.test@omniaglobalacademy.com";
const COACH_PREVIEW_READ_ACTIONS = new Set([
  "coach_dashboard",
  "coach_offers",
  "coach_availability",
  "coach_sessions",
  "coach_request_availability",
  "coach_ratings",
  "coach_revenue",
  "coach_advanced_products",
  "session_follow_up",
  "session_room_access",
  "recording_status",
]);

async function coachPreviewSession(sb: Supabase): Promise<Session> {
  const { data: user, error } = await sb
    .from("users")
    .select("id")
    .ilike("email", COACH_PREVIEW_EMAIL)
    .maybeSingle();
  if (error) throw error;
  if (!user?.id) throw new Error("COACH_PREVIEW_ACCOUNT_MISSING");
  const { data: profile, error: profileError } = await sb
    .from("coach_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile?.id) throw new Error("COACH_PREVIEW_ACCOUNT_MISSING");
  return { userId: String(user.id), roles: ["coach"] };
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

function omitPublicFields(row: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = { ...row };
  for (const field of fields) delete result[field];
  return result;
}

function sanitizePublicOffer(row: Record<string, unknown>): Record<string, unknown> {
  return omitPublicFields(row, ["admin_message", "reviewed_by", "reviewed_at", "supersedes_offer_id", "created_at", "updated_at"]);
}

function sanitizePublicPackage(row: Record<string, unknown>): Record<string, unknown> {
  const result = omitPublicFields(row, ["admin_message", "reviewed_by", "reviewed_at", "created_at", "updated_at"]);
  if (result.coach && typeof result.coach === "object") result.coach = omitPublicFields(result.coach as Record<string, unknown>, ["user_id"]);
  return result;
}

function sanitizePublicGroup(row: Record<string, unknown>): Record<string, unknown> {
  const result = omitPublicFields(row, [
    "external_meeting_url", "room_slug", "registrations", "admin_message", "reviewed_by", "reviewed_at",
    "actual_started_at", "actual_ended_at", "created_at", "updated_at",
  ]);
  if (result.coach && typeof result.coach === "object") result.coach = omitPublicFields(result.coach as Record<string, unknown>, ["user_id"]);
  return result;
}

function sanitizePublicCoach(row: Record<string, unknown>): Record<string, unknown> {
  return omitPublicFields(row, [
    "user_id", "application_id", "commission_override_percent", "minimum_price_override_xof",
    "maximum_price_override_xof", "approved_by", "approved_at", "suspended_by", "suspended_at",
    "suspension_reason", "created_at", "updated_at",
  ]);
}

async function publicCoaches(sb: Supabase, includeInternal = false) {
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
  const mapped = rows.map((profile: Record<string, unknown>) => ({
    ...profile,
    full_name: (userById.get(String(profile.user_id)) as { full_name?: string } | undefined)?.full_name || "Coach Omnia",
    level: profile.level_id ? levelById.get(String(profile.level_id)) || null : null,
    domains: domainsByCoach.get(String(profile.id)) || [],
  }));
  return includeInternal ? mapped : mapped.map((profile) => sanitizePublicCoach(profile));
}

async function publicProfile(sb: Supabase, identifier: string, includeInactive = false) {
  let query = sb
    .from("coach_profiles")
    .select("*")
    .eq(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier) ? "id" : "public_slug", identifier);
  if (!includeInactive) query = query.eq("status", "active");
  const { data: profile, error } = await query.maybeSingle();
  if (error) throw error;
  if (!profile) return null;
  const [{ data: user }, { data: level }, domainsByCoach, offers, ratings] = await Promise.all([
    sb.from("users").select("id,full_name").eq("id", profile.user_id).maybeSingle(),
    profile.level_id ? sb.from("coaching_levels").select("id,slug,name,description,badge_label,badge_color,is_featured").eq("id", profile.level_id).maybeSingle() : Promise.resolve({ data: null }),
    domainMapForProfiles(sb, [String(profile.id)]),
    activeOffers(sb, String(profile.id)),
    publicCoachRatings(sb, String(profile.id)),
  ]);
  const { data: groups } = await sb.from("coaching_group_programs")
    .select("*,domain:coaching_domains(id,slug,name)")
    .eq("coach_id", profile.id)
    .in("status", ["active", "full"])
    .gt("scheduled_start", new Date().toISOString())
    .order("scheduled_start");
  const enriched = {
    ...profile,
    full_name: user?.full_name || "Coach Omnia",
    level: level || null,
    domains: domainsByCoach.get(String(profile.id)) || [],
    offers: includeInactive ? offers : (offers || []).map((offer: Record<string, unknown>) => sanitizePublicOffer(offer)),
    ratings,
    groups: includeInactive ? (groups || []) : (groups || []).map((item: Record<string, unknown>) => sanitizePublicGroup(item)),
  };
  return includeInactive ? enriched : sanitizePublicCoach(enriched);
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
  const eligibility = await coachEligibility(sb, session);
  if (!eligibility.eligible) throw new Error("COACH_ELIGIBILITY_REQUIRED");
  const fullName = asText(body.full_name, 180);
  const professionalTitle = asText(body.professional_title, 180);
  const country = asText(body.country, 100);
  const timezone = asText(body.timezone, 100) || "UTC";
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

function normalizeCoachLinkCode(value: unknown) {
  return asText(value, 40).toUpperCase().replace(/\s+/g, "");
}

function newCoachLinkCode() {
  const compact = crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase();
  return `OGA-${compact}`;
}

async function adminPrepareOgaCoach(sb: Supabase, session: Session, body: Record<string, unknown>) {
  const email = asText(body.email, 320).toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("INVALID_EMAIL");
  const fullName = asNullableText(body.full_name, 240);
  const { data: existingUser, error: userError } = await sb.from("users").select("id,email,full_name").ilike("email", email).maybeSingle();
  if (userError) throw userError;

  if (!existingUser?.id) {
    const invitation = await createAccessInvitation(sb, {
      invitationType: "coach_oga",
      email,
      fullName,
      invitedBy: session.userId,
      internalRole: "Coach OGA",
      message: "Vous êtes invité(e) à rejoindre Omnia Global Academy comme Coach OGA. La création de votre compte sera confirmée par code OTP envoyé par email.",
    });
    await audit(sb, session.userId, "coach_oga_invited", "platform_access_invitation", String(invitation.invitation.id), null, { email, email_sent: invitation.emailSent });
    return { mode: "email_invitation", email, email_sent: invitation.emailSent, expires_at: invitation.invitation.expires_at };
  }

  const { data: protectedRole, error: protectedError } = await sb.from("user_roles").select("role").eq("user_id", existingUser.id).eq("role", "super_admin").maybeSingle();
  if (protectedError) throw protectedError;
  if (protectedRole) throw new Error("PROTECTED_ACCOUNT");

  const now = new Date().toISOString();
  const { error: revokeError } = await sb.from("coach_oga_link_codes")
    .update({ status: "revoked", updated_at: now })
    .eq("target_user_id", existingUser.id)
    .eq("status", "pending");
  if (revokeError) throw revokeError;

  const code = newCoachLinkCode();
  const codeHash = await sha256Hex(code);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: link, error: linkError } = await sb.from("coach_oga_link_codes").insert({
    code_hash: codeHash,
    target_user_id: existingUser.id,
    created_by: session.userId,
    status: "pending",
    expires_at: expiresAt,
  }).select("id,expires_at").single();
  if (linkError) throw linkError;
  await audit(sb, session.userId, "coach_oga_link_code_created", "coach_oga_link_code", String(link.id), null, { target_user_id: existingUser.id, email });
  return {
    mode: "link_code",
    code,
    email,
    full_name: existingUser.full_name || fullName || null,
    expires_at: link.expires_at,
  };
}

async function claimOgaCoachLinkCode(sb: Supabase, session: Session, body: Record<string, unknown>) {
  if (isAdmin(session) || isService(session)) throw new Error("PROTECTED_ACCOUNT");
  const code = normalizeCoachLinkCode(body.code);
  if (!code) throw new Error("COACH_LINK_CODE_REQUIRED");
  const codeHash = await sha256Hex(code);
  const { data: link, error } = await sb.from("coach_oga_link_codes")
    .select("*")
    .eq("code_hash", codeHash)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw error;
  if (!link) throw new Error("COACH_LINK_CODE_INVALID_OR_EXPIRED");
  if (String(link.target_user_id) !== session.userId) throw new Error("COACH_LINK_CODE_ACCOUNT_MISMATCH");

  await ensureCoachOgaAccess(sb, session.userId, String(link.created_by));
  const now = new Date().toISOString();
  const { error: updateError } = await sb.from("coach_oga_link_codes").update({
    status: "used", used_at: now, used_by: session.userId, updated_at: now,
  }).eq("id", link.id).eq("status", "pending");
  if (updateError) throw updateError;
  await audit(sb, session.userId, "coach_oga_link_code_claimed", "coach_oga_link_code", String(link.id), null, { created_by: link.created_by });
  return { status: "linked", role: "coach" };
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

  if (decision === "approve") {
    const { data: applicantRoles, error: applicantRolesError } = await sb.from("user_roles").select("role").eq("user_id", application.user_id);
    if (applicantRolesError) throw applicantRolesError;
    const eligibility = await coachEligibility(sb, { userId: String(application.user_id), roles: (applicantRoles || []).map((row: { role: string }) => String(row.role)) });
    if (!eligibility.eligible) throw new Error("COACH_ELIGIBILITY_REQUIRED");
  }

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
  if (status === "active") {
    const { error: roleError } = await sb.from("user_roles").upsert(
      { user_id: current.user_id, role: "coach", granted_by: session.userId },
      { onConflict: "user_id,role" },
    );
    if (roleError) throw roleError;
  } else if (status === "suspended" || status === "archived") {
    const { error: roleError } = await sb.from("user_roles").delete().eq("user_id", current.user_id).eq("role", "coach");
    if (roleError) throw roleError;
  }
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

async function centralCoachingCommission(sb: Supabase, creatorUserId: string, amountXof: number, fallbackPercent: number, offerType: string) {
  try {
    const now = new Date().toISOString();
    const { data, error } = await sb.from("commerce_commission_rules").select("*")
      .in("module_key", ["coaching", "global"]).eq("status", "active")
      .lte("valid_from", now).or(`valid_until.is.null,valid_until.gte.${now}`)
      .order("priority", { ascending: true });
    if (error) return { percent: fallbackPercent, fixedFeeXof: 0, source: "coaching_profile" };
    const rule = (data || []).find((row: Record<string, unknown>) =>
      (!row.creator_user_id || String(row.creator_user_id) === creatorUserId) &&
      (!row.offer_type || String(row.offer_type) === offerType) &&
      amountXof >= Number(row.minimum_amount_xof || 0)
    );
    return rule
      ? { percent: Number(rule.platform_percent || 0), fixedFeeXof: Number(rule.fixed_fee_xof || 0), source: "central_commerce" }
      : { percent: fallbackPercent, fixedFeeXof: 0, source: "coaching_profile" };
  } catch {
    return { percent: fallbackPercent, fixedFeeXof: 0, source: "coaching_profile" };
  }
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
  const timezone = asText(body.timezone, 80) || String(profile.timezone || "UTC");
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

async function expireBookingHolds(sb: Supabase, _coachId?: string) {
  const { error } = await sb.rpc("coaching_expire_payment_holds");
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
  const originalPrice = Number(context.offer.price_xof);
  const discountXof = 0;
  const price = originalPrice;
  const commissionTerms = await centralCoachingCommission(sb, String(context.profile.user_id), price, context.limits.commission, "session");
  const commissionAmount = Math.min(price, Math.round(price * commissionTerms.percent / 100) + commissionTerms.fixedFeeXof);
  const effectiveCommissionPercent = price > 0 ? Number(((commissionAmount / price) * 100).toFixed(2)) : 0;
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
    commission_percent_snapshot: effectiveCommissionPercent,
    commission_amount_xof: commissionAmount,
    coach_net_xof: price - commissionAmount,
    offer_title_snapshot: context.offer.title,
    coach_name_snapshot: context.coachName,
    coach_timezone_snapshot: context.profile.timezone,
    policy_snapshot: { source: "coaching_module_2", payment_activation: "module_3", hold_minutes: Number(context.settings?.slot_hold_minutes || 15), commission_source: commissionTerms.source, commission_fixed_fee_xof: commissionTerms.fixedFeeXof },
    funding_source: "direct",
    funding_reference_id: null,
    original_price_xof: originalPrice,
    discount_xof: discountXof,
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
  const originalPrice = Math.round(Number(context.offer.hourly_price_xof) * duration / 60);
  const discountXof = 0;
  const price = originalPrice;
  const commissionTerms = await centralCoachingCommission(sb, String(context.profile.user_id), price, context.limits.commission, "session_custom");
  const commissionAmount = Math.min(price, Math.round(price * commissionTerms.percent / 100) + commissionTerms.fixedFeeXof);
  const effectiveCommissionPercent = price > 0 ? Number(((commissionAmount / price) * 100).toFixed(2)) : 0;
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
    commission_percent_snapshot: effectiveCommissionPercent,
    commission_amount_xof: commissionAmount,
    coach_net_xof: price - commissionAmount,
    offer_title_snapshot: context.offer.title,
    coach_name_snapshot: context.coachName,
    coach_timezone_snapshot: context.profile.timezone,
    policy_snapshot: { source: "coaching_module_2", payment_activation: "module_3", commission_source: commissionTerms.source, commission_fixed_fee_xof: commissionTerms.fixedFeeXof },
    funding_source: "direct",
    funding_reference_id: null,
    original_price_xof: originalPrice,
    discount_xof: discountXof,
  }).select().single();
  if (error) throw error;
  await invokeNotification("coaching_custom_request_received", {
    userId: context.profile.user_id,
    learner_name: "Un apprenant",
    offer_title: context.offer.title,
    scheduled_start: slot.slot_start,
    duration_minutes: duration,
    action_url: "/coach/sessions",
  });
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
  return rows.map((row: Record<string, unknown>) => { const { external_meeting_url: _privateExternalLink, ...safeRow } = row; return { ...safeRow, coach: profileMap.get(String(row.coach_id)) || null }; });
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
  const finance = await financeForSessions(sb, sessions.map((row: Record<string, unknown>) => String(row.id)));
  return {
    sessions: sessions.map((row: Record<string, unknown>) => ({ ...row, ...(finance.get(String(row.id)) || {}) })),
    favorites: all.filter((coach: { id: string }) => favoriteIds.includes(String(coach.id))),
  };
}

async function coachSessions(sb: Supabase, session: Session) {
  const profile = await ownCoachProfile(sb, session);
  await expireBookingHolds(sb, String(profile.id));
  const rows = await coachingSessionsForUser(sb, session.userId, String(profile.id));
  const learnerIds = [...new Set(rows.map((row: Record<string, unknown>) => String(row.learner_user_id)))];
  const { data: learners } = learnerIds.length ? await sb.from("users").select("id,full_name,email").in("id", learnerIds) : { data: [] };
  const learnerMap = new Map((learners || []).map((learner: { id: string }) => [String(learner.id), learner]));
  const finance = await financeForSessions(sb, rows.map((row: Record<string, unknown>) => String(row.id)));
  return rows.map((row: Record<string, unknown>) => ({ ...row, learner: learnerMap.get(String(row.learner_user_id)) || null, ...(finance.get(String(row.id)) || {}) }));
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
    await invokeNotification("coaching_custom_request_declined", {
      userId: booking.learner_user_id,
      offer_title: booking.offer_title_snapshot,
      coach_name: booking.coach_name_snapshot,
      reason: responseMessage || "La demande n’a pas été acceptée.",
      action_url: "/dashboard/coaching",
    });
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
  await invokeNotification("coaching_custom_request_accepted", {
    userId: booking.learner_user_id,
    offer_title: booking.offer_title_snapshot,
    coach_name: booking.coach_name_snapshot,
    scheduled_start: data.scheduled_start,
    duration_minutes: data.duration_minutes,
    action_url: `/coaching/paiement/${booking.id}`,
  });
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



async function sha256Hex(value: string): Promise<string> {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function coachingOrderNumber(): string {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return `COACH-${stamp}-${suffix}`;
}

async function invokeNotification(type: string, payload: Record<string, unknown>) {
  const url = Deno.env.get("SUPABASE_URL") || "";
  if (!url) return;
  await fetch(`${url}/functions/v1/notify-dispatch`, {
    method: "POST",
    headers: omniaInternalHeaders(),
    body: JSON.stringify({ type, payload }),
  }).catch(() => undefined);
}

async function requestCoachingInvoice(orderId: string) {
  const url = Deno.env.get("SUPABASE_URL") || "";
  if (!url) return;
  await fetch(`${url}/functions/v1/invoice-generate`, {
    method: "POST",
    headers: omniaInternalHeaders(),
    body: JSON.stringify({ coaching_order_id: orderId }),
  }).catch(() => undefined);
}

async function financeForSessions(sb: Supabase, sessionIds: string[]) {
  const result = new Map<string, Record<string, unknown>>();
  if (!sessionIds.length) return result;
  const [{ data: orders }, { data: invoices }, { data: refunds }] = await Promise.all([
    sb.from("coaching_payment_orders").select("*").in("session_id", sessionIds),
    sb.from("coaching_invoices").select("id,invoice_number,order_id,session_id,issued_at,amount_xof,currency,pdf_storage_path").in("session_id", sessionIds),
    sb.from("coaching_refund_requests").select("*").in("session_id", sessionIds).order("created_at", { ascending: false }),
  ]);
  const invoicesBySession = new Map((invoices || []).map((row: Record<string, unknown>) => [String(row.session_id), row]));
  const refundsBySession = new Map<string, Record<string, unknown>>();
  for (const row of refunds || []) if (!refundsBySession.has(String(row.session_id))) refundsBySession.set(String(row.session_id), row as Record<string, unknown>);
  for (const order of orders || []) {
    const sid = String(order.session_id);
    result.set(sid, { order, invoice: invoicesBySession.get(sid) || null, refund: refundsBySession.get(sid) || null });
  }
  for (const sid of sessionIds) if (!result.has(sid)) result.set(sid, { order: null, invoice: invoicesBySession.get(sid) || null, refund: refundsBySession.get(sid) || null });
  return result;
}

async function coachingPaymentCheckout(sb: Supabase, session: Session, body: Record<string, unknown>) {
  const sessionId = asText(body.session_id, 80);
  const { data: booking, error } = await sb.from("coaching_sessions").select("*").eq("id", sessionId).eq("learner_user_id", session.userId).maybeSingle();
  if (error) throw error;
  if (!booking) throw new Error("BOOKING_NOT_FOUND");
  if (booking.status !== "pending_payment") throw new Error("PAYMENT_NOT_ALLOWED");
  if (!booking.scheduled_start || !booking.scheduled_end) throw new Error("BOOKING_INCOMPLETE");
  if (booking.hold_expires_at && new Date(booking.hold_expires_at).getTime() <= Date.now()) throw new Error("PAYMENT_HOLD_EXPIRED");

  const { data: existing } = await sb.from("coaching_payment_orders").select("*").eq("session_id", booking.id).maybeSingle();
  if (existing?.payment_status === "paid") return { order: existing, already_paid: true, payment_url: null };

  const [{ data: user }, { data: coachProfile }] = await Promise.all([
    sb.from("users").select("id,full_name,email,phone_number,country_code,status").eq("id", session.userId).maybeSingle(),
    sb.from("coach_profiles").select("id,user_id").eq("id", booking.coach_id).maybeSingle(),
  ]);
  if (!user || user.status !== "actif") throw new Error("SESSION_INVALID");
  if (!coachProfile) throw new Error("COACH_NOT_FOUND");

  const settingsResult = await sb.from("coaching_settings").select("*").eq("id", 1).single();
  if (settingsResult.error) throw settingsResult.error;
  const settings = settingsResult.data;
  const policySnapshot = {
    cancellation_full_refund_hours: Number(settings.cancellation_full_refund_hours || 24),
    cancellation_partial_refund_hours: Number(settings.cancellation_partial_refund_hours || 6),
    cancellation_partial_refund_percent: Number(settings.cancellation_partial_refund_percent || 50),
    dispute_window_hours: Number(settings.dispute_window_hours || 48),
  };

  // A one-to-one live coaching session is an external person-to-person service.
  // It deliberately remains on the existing FedaPay flow, including in the native app.
  const paymentProvider = "fedapay";
  const orderNumber = existing?.order_number || coachingOrderNumber();
  const idempotencyKey = existing?.idempotency_key || await sha256Hex(`${session.userId}:${booking.id}:${orderNumber}`);
  const orderPayload = {
    order_number: orderNumber,
    session_id: booking.id,
    user_id: session.userId,
    coach_id: booking.coach_id,
    amount_xof: Number(booking.price_total_xof),
    currency: "XOF",
    payment_status: "pending",
    payment_provider: paymentProvider,
    idempotency_key: idempotencyKey,
    commission_percent_snapshot: Number(booking.commission_percent_snapshot),
    commission_amount_xof: Number(booking.commission_amount_xof),
    coach_net_xof: Number(booking.coach_net_xof),
    offer_title_snapshot: String(booking.offer_title_snapshot),
    coach_name_snapshot: String(booking.coach_name_snapshot),
    session_start_snapshot: booking.scheduled_start,
    session_end_snapshot: booking.scheduled_end,
    policy_snapshot: policySnapshot,
  };
  const orderResult = existing
    ? await sb.from("coaching_payment_orders").update(orderPayload).eq("id", existing.id).select().single()
    : await sb.from("coaching_payment_orders").insert(orderPayload).select().single();
  if (orderResult.error) throw orderResult.error;
  const order = orderResult.data;
  await sb.from("coaching_sessions").update({ payment_order_id: order.id, payment_status: "pending", policy_snapshot: policySnapshot }).eq("id", booking.id);

  const fedaKey = fedaPaySecretKey();
  if (!fedaKey) throw new Error("PAYMENT_CONFIGURATION_MISSING");
  const apiBase = fedaPayApiBase();
  const appUrl = (Deno.env.get("APP_URL") || "https://omniaglobalacademy.com").replace(/\/$/, "");
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  const names = String(user.full_name || "").trim().split(/\s+/);
  const firstname = names.shift() || String(user.email).split("@")[0];
  const lastname = names.join(" ") || "-";
  const metadata = { resource_type: "coaching_session", coaching_order_id: order.id, session_id: booking.id, user_id: session.userId, coach_id: booking.coach_id };
  const providerMerchantReference = `${order.order_number}-${Date.now().toString().slice(-6)}`;

  const transactionResponse = await fetch(`${apiBase}/transactions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${fedaKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      description: `Coaching OGA — ${booking.offer_title_snapshot}`,
      amount: Number(booking.price_total_xof),
      currency: { iso: "XOF" },
      callback_url: `${supabaseUrl}/functions/v1/fedapay-webhook`,
      return_url: `${appUrl}/coaching/paiement/${booking.id}?retour=fedapay`,
      cancel_url: `${appUrl}/coaching/paiement/${booking.id}?annule=1`,
      merchant_reference: providerMerchantReference,
      custom_metadata: metadata,
      metadata,
      customer: {
        email: user.email,
        firstname,
        lastname,
        ...(user.phone_number && user.country_code ? { phone_number: { number: user.phone_number, country: user.country_code } } : {}),
      },
    }),
  });
  if (!transactionResponse.ok) {
    const detail = await transactionResponse.text().catch(() => "");
    await sb.from("coaching_payment_orders").update({ payment_status: "failed", failed_at: new Date().toISOString(), provider_metadata: { initialization_error: detail.slice(0, 1000) } }).eq("id", order.id);
    await sb.from("coaching_sessions").update({ payment_status: "failed" }).eq("id", booking.id);
    throw new Error("PAYMENT_INIT_FAILED");
  }
  const transactionData = await transactionResponse.json();
  const transaction = transactionData.v1Transaction || transactionData.transaction || transactionData;
  const providerId = transaction?.id ? String(transaction.id) : "";
  if (!providerId) throw new Error("PAYMENT_INIT_FAILED");
  const tokenResponse = await fetch(`${apiBase}/transactions/${providerId}/token`, { method: "POST", headers: { Authorization: `Bearer ${fedaKey}`, "Content-Type": "application/json" } });
  if (!tokenResponse.ok) throw new Error("PAYMENT_LINK_FAILED");
  const tokenData = await tokenResponse.json();
  const paymentUrl = String(tokenData.url || tokenData.token_url || "");
  if (!paymentUrl) throw new Error("PAYMENT_LINK_FAILED");
  await sb.from("coaching_payment_orders").update({ provider_transaction_id: providerId, provider_reference: transaction?.reference || providerMerchantReference, provider_metadata: transactionData }).eq("id", order.id);
  return { order: { ...order, provider_transaction_id: providerId }, payment_url: paymentUrl, already_paid: false };
}

async function coachingPaymentStatus(sb: Supabase, session: Session, body: Record<string, unknown>) {
  const sessionId = asText(body.session_id, 80);
  const { data: booking, error } = await sb.from("coaching_sessions").select("*").eq("id", sessionId).maybeSingle();
  if (error) throw error;
  if (!booking) throw new Error("BOOKING_NOT_FOUND");
  const profile = await sb.from("coach_profiles").select("user_id").eq("id", booking.coach_id).maybeSingle();
  if (String(booking.learner_user_id) !== session.userId && String(profile.data?.user_id || "") !== session.userId && !isAdmin(session)) throw new Error("FORBIDDEN");
  const finance = await financeForSessions(sb, [sessionId]);
  return { session: booking, ...(finance.get(sessionId) || { order: null, invoice: null, refund: null }) };
}

async function coachingInvoiceUrl(sb: Supabase, session: Session, body: Record<string, unknown>) {
  const invoiceId = asText(body.invoice_id, 80);
  const { data: invoice, error } = await sb.from("coaching_invoices").select("*").eq("id", invoiceId).maybeSingle();
  if (error) throw error;
  if (!invoice) throw new Error("INVOICE_NOT_FOUND");
  const profile = await sb.from("coach_profiles").select("user_id").eq("id", invoice.coach_id).maybeSingle();
  if (String(invoice.user_id) !== session.userId && String(profile.data?.user_id || "") !== session.userId && !isAdmin(session)) throw new Error("FORBIDDEN");
  const { data, error: signedError } = await sb.storage.from("coaching-invoices").createSignedUrl(String(invoice.pdf_storage_path), 600);
  if (signedError || !data?.signedUrl) throw signedError || new Error("INVOICE_UNAVAILABLE");
  return { invoice, signed_url: data.signedUrl };
}

function refundAmountForLearner(booking: Record<string, unknown>, order: Record<string, unknown>) {
  const start = new Date(String(booking.scheduled_start)).getTime();
  const hours = Math.max(0, (start - Date.now()) / 3600000);
  const policy = (order.policy_snapshot || {}) as Record<string, unknown>;
  const fullHours = Number(policy.cancellation_full_refund_hours ?? 24);
  const partialHours = Number(policy.cancellation_partial_refund_hours ?? 6);
  const partialPercent = Number(policy.cancellation_partial_refund_percent ?? 50);
  if (hours >= fullHours) return { amount: Number(order.amount_xof), percent: 100, hours_before: hours };
  if (hours >= partialHours) return { amount: Math.round(Number(order.amount_xof) * partialPercent / 100), percent: partialPercent, hours_before: hours };
  return { amount: 0, percent: 0, hours_before: hours };
}

async function cancelPaidCoaching(sb: Supabase, session: Session, body: Record<string, unknown>, actor: "learner" | "coach") {
  const sessionId = asText(body.session_id, 80);
  const reasonCode = asText(body.reason_code, 80) || `${actor}_cancellation`;
  const reasonDetails = asNullableText(body.reason_details, 1500);
  const { data: booking, error } = await sb.from("coaching_sessions").select("*").eq("id", sessionId).maybeSingle();
  if (error) throw error;
  if (!booking) throw new Error("BOOKING_NOT_FOUND");
  const { data: coachProfile } = await sb.from("coach_profiles").select("user_id").eq("id", booking.coach_id).maybeSingle();
  if (actor === "learner" && String(booking.learner_user_id) !== session.userId) throw new Error("FORBIDDEN");
  if (actor === "coach" && String(coachProfile?.user_id || "") !== session.userId) throw new Error("FORBIDDEN");
  if (!['confirmed','ready'].includes(String(booking.status))) throw new Error("BOOKING_CANNOT_CANCEL");
  const { data: order } = await sb.from("coaching_payment_orders").select("*").eq("session_id", sessionId).eq("payment_status", "paid").maybeSingle();
  if (!order) throw new Error("COACHING_ORDER_NOT_FOUND");
  const existing = await sb.from("coaching_refund_requests").select("*").eq("session_id", sessionId).in("status", ["pending","under_review","approved","partially_approved"]).maybeSingle();
  if (existing.data) return existing.data;
  const calculation = actor === "coach" ? { amount: Number(order.amount_xof), percent: 100, hours_before: null } : refundAmountForLearner(booking, order);
  const status = calculation.amount > 0 ? "approved" : "processed";
  const { data: refund, error: refundError } = await sb.from("coaching_refund_requests").insert({
    order_id: order.id, session_id: booking.id, user_id: booking.learner_user_id, coach_id: booking.coach_id,
    initiated_by: actor, requested_amount_xof: calculation.amount, approved_amount_xof: calculation.amount,
    reason_code: reasonCode, reason_details: reasonDetails, status,
    policy_snapshot: { ...(order.policy_snapshot || {}), calculation },
    decision_reason: actor === "coach" ? "Annulation par le coach : remboursement total." : calculation.amount > 0 ? `Remboursement calculé à ${calculation.percent}%.` : "Annulation hors délai remboursable.",
    decided_by: actor === "coach" ? session.userId : null, decided_at: new Date().toISOString(), processed_at: calculation.amount === 0 ? new Date().toISOString() : null,
  }).select().single();
  if (refundError) throw refundError;
  await sb.from("coaching_sessions").update({ status: actor === "coach" ? "cancelled_by_coach" : "cancelled_by_learner", hold_expires_at: null }).eq("id", booking.id);
  await sb.from("coaching_notification_jobs").update({ status: "cancelled" }).eq("session_id", booking.id).in("status", ["pending","failed"]);
  await invokeNotification("coaching_cancelled", { userId: booking.learner_user_id, session_id: booking.id, coach_name: booking.coach_name_snapshot, offer_title: booking.offer_title_snapshot, scheduled_start: booking.scheduled_start, cancelled_by: actor, refund_amount_xof: calculation.amount, action_url: "/dashboard/coaching" });
  if (coachProfile?.user_id) await invokeNotification("coaching_cancelled", { userId: coachProfile.user_id, session_id: booking.id, coach_name: booking.coach_name_snapshot, offer_title: booking.offer_title_snapshot, scheduled_start: booking.scheduled_start, cancelled_by: actor, refund_amount_xof: calculation.amount, action_url: "/coach/sessions" });
  return refund;
}

async function adminCoachingFinance(sb: Supabase) {
  const [{ data: orders }, { data: refunds }, { data: sessions }, { data: invoices }, { data: settings }] = await Promise.all([
    sb.from("coaching_payment_orders").select("*").order("created_at", { ascending: false }).limit(300),
    sb.from("coaching_refund_requests").select("*").order("created_at", { ascending: false }).limit(300),
    sb.from("coaching_sessions").select("id,learner_user_id,coach_id,offer_title_snapshot,coach_name_snapshot,scheduled_start,status,payment_status").order("created_at", { ascending: false }).limit(300),
    sb.from("coaching_invoices").select("id,invoice_number,order_id,session_id,issued_at,amount_xof").order("issued_at", { ascending: false }).limit(300),
    sb.from("coaching_settings").select("*").eq("id", 1).single(),
  ]);
  const sessionMap = new Map((sessions || []).map((row: Record<string, unknown>) => [String(row.id), row]));
  const invoiceMap = new Map((invoices || []).map((row: Record<string, unknown>) => [String(row.order_id), row]));
  const processedRefundByOrder = new Map<string, number>();
  for (const refund of refunds || []) {
    if (String(refund.status) !== "processed") continue;
    const orderId = String(refund.order_id || "");
    processedRefundByOrder.set(orderId, (processedRefundByOrder.get(orderId) || 0) + Number(refund.approved_amount_xof || 0));
  }
  const orderRows = (orders || []).map((order: Record<string, unknown>) => {
    const amount = Number(order.amount_xof || 0);
    const refunded = Math.min(amount, Math.max(0, processedRefundByOrder.get(String(order.id)) || 0));
    const netPaid = Math.max(0, amount - refunded);
    const originalCommission = Number(order.commission_amount_xof || 0);
    const netCommission = amount > 0 ? Math.max(0, Math.round(originalCommission * netPaid / amount)) : 0;
    return {
      ...order,
      session: sessionMap.get(String(order.session_id)) || null,
      invoice: invoiceMap.get(String(order.id)) || null,
      refunded_amount_xof: refunded,
      net_paid_xof: netPaid,
      net_commission_xof: netCommission,
    };
  });
  const refundRows = (refunds || []).map((refund: Record<string, unknown>) => ({ ...refund, session: sessionMap.get(String(refund.session_id)) || null }));
  return { orders: orderRows, refunds: refundRows, settings, metrics: {
    paid_xof: orderRows.filter((row: Record<string, unknown>) => ["paid","partially_refunded","refunded"].includes(String(row.payment_status))).reduce((sum: number, row: Record<string, unknown>) => sum + Number(row.net_paid_xof || 0), 0),
    commission_xof: orderRows.filter((row: Record<string, unknown>) => ["paid","partially_refunded","refunded"].includes(String(row.payment_status))).reduce((sum: number, row: Record<string, unknown>) => sum + Number(row.net_commission_xof || 0), 0),
    pending_orders: orderRows.filter((row: Record<string, unknown>) => String(row.payment_status) === "pending").length,
    pending_refunds: refundRows.filter((row: Record<string, unknown>) => ["pending","under_review","approved","partially_approved"].includes(String(row.status))).length,
  } };
}


async function adminFinanceSettingsSave(sb: Supabase, session: Session, body: Record<string, unknown>) {
  const fullHours = asInteger(body.cancellation_full_refund_hours);
  const partialHours = asInteger(body.cancellation_partial_refund_hours);
  const partialPercent = asInteger(body.cancellation_partial_refund_percent);
  const disputeHours = asInteger(body.dispute_window_hours);
  const reminderHours = asInteger(body.reminder_day_before_hours);
  const reminderMinutes = asInteger(body.reminder_minutes_before);
  if (fullHours === null || partialHours === null || partialPercent === null || disputeHours === null || reminderHours === null || reminderMinutes === null || partialHours > fullHours || partialPercent > 100 || reminderHours < 1 || reminderMinutes < 5) throw new Error("INVALID_FINANCE_SETTINGS");
  const before = await sb.from("coaching_settings").select("*").eq("id", 1).single();
  const result = await sb.from("coaching_settings").update({
    cancellation_full_refund_hours: fullHours,
    cancellation_partial_refund_hours: partialHours,
    cancellation_partial_refund_percent: partialPercent,
    dispute_window_hours: disputeHours,
    reminder_day_before_hours: reminderHours,
    reminder_minutes_before: reminderMinutes,
  }).eq("id", 1).select().single();
  if (result.error) throw result.error;
  await audit(sb, session.userId, "coaching_finance_settings_updated", "coaching_settings", "1", before.data || {}, result.data || {}, {});
  return result.data;
}

async function adminRefundDecision(sb: Supabase, session: Session, body: Record<string, unknown>) {
  const refundId = asText(body.refund_id, 80);
  const decision = asText(body.decision, 30);
  const reason = asNullableText(body.reason, 1200);
  const amount = asInteger(body.approved_amount_xof);
  const { data: refund, error } = await sb.from("coaching_refund_requests").select("*,order:coaching_payment_orders(*)").eq("id", refundId).maybeSingle();
  if (error) throw error;
  if (!refund) throw new Error("REFUND_NOT_FOUND");
  if (decision === "reject") {
    if (!reason) throw new Error("REVIEW_MESSAGE_REQUIRED");
    const result = await sb.from("coaching_refund_requests").update({ status: "rejected", approved_amount_xof: 0, decision_reason: reason, decided_by: session.userId, decided_at: new Date().toISOString() }).eq("id", refund.id).select().single();
    if (result.error) throw result.error;
    await invokeNotification("coaching_refund_update", { userId: refund.user_id, status: "rejected", amount_xof: 0, reason, session_id: refund.session_id, action_url: "/dashboard/coaching" });
    return result.data;
  }
  if (decision !== "approve" || amount === null || amount < 0 || amount > Number(refund.order?.amount_xof || 0)) throw new Error("INVALID_REFUND_AMOUNT");
  const status = amount === Number(refund.order.amount_xof) ? "approved" : "partially_approved";
  const result = await sb.from("coaching_refund_requests").update({ status, approved_amount_xof: amount, decision_reason: reason, decided_by: session.userId, decided_at: new Date().toISOString() }).eq("id", refund.id).select().single();
  if (result.error) throw result.error;
  await invokeNotification("coaching_refund_update", { userId: refund.user_id, status, amount_xof: amount, reason, session_id: refund.session_id, action_url: "/dashboard/coaching" });
  return result.data;
}

async function adminRefundProcessed(sb: Supabase, session: Session, body: Record<string, unknown>) {
  const refundId = asText(body.refund_id, 80);
  const providerReference = asText(body.provider_reference, 200);
  if (!providerReference) throw new Error("PROVIDER_REFERENCE_REQUIRED");

  const { data, error } = await sb.rpc("coaching_process_refund", {
    p_refund_id: refundId,
    p_admin_id: session.userId,
    p_provider_refund_reference: providerReference,
  });
  if (error) throw error;

  const result = (data || {}) as Record<string, unknown>;
  const refund = (result.refund || null) as Record<string, unknown> | null;
  if (!refund) throw new Error("REFUND_PROCESSING_FAILED");

  await invokeNotification("coaching_refund_update", {
    userId: refund.user_id,
    status: "processed",
    amount_xof: Number(refund.approved_amount_xof || 0),
    session_id: refund.session_id,
    action_url: "/dashboard/coaching",
  });

  return {
    ...refund,
    wallet_recovered_xof: Number(result.wallet_recovered_xof || 0),
    full_refund: result.full_refund === true,
    already_processed: result.already_processed === true,
  };
}

function errorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  const badRequest = [
    "FILE_REQUIRED", "DOCUMENT_REQUIRED", "FILE_TYPE_NOT_ALLOWED", "FILE_TOO_LARGE", "INVALID_FILE", "APPLICATION_INCOMPLETE", "INVALID_URL",
    "INVALID_DOMAIN", "INVALID_REVIEW", "REVIEW_MESSAGE_REQUIRED", "LEVEL_REQUIRED", "LEVEL_NOT_FOUND", "INVALID_PRICE_RANGE",
    "APPLICATION_PRICE_OUT_OF_RANGE", "COACH_REQUIRED", "INVALID_STATUS", "SUSPENSION_REASON_REQUIRED", "LEVEL_NAME_REQUIRED", "DOMAIN_NAME_REQUIRED",
    "OFFER_INCOMPLETE", "OFFER_PRICE_OUT_OF_RANGE", "INVALID_SESSION_MODE", "INVALID_AVAILABILITY", "INVALID_AVAILABILITY_RANGE",
    "INVALID_DURATION", "BOOKING_INCOMPLETE", "INVALID_OFFER_TYPE", "CANNOT_BOOK_SELF", "CANNOT_FAVORITE_SELF", "INVALID_DECISION",
    "BOOKING_CANNOT_CANCEL", "PAYMENT_NOT_ALLOWED", "PAYMENT_HOLD_EXPIRED", "PAYMENT_CONFIGURATION_MISSING", "PAYMENT_INIT_FAILED", "PAYMENT_LINK_FAILED",
    "INVALID_REFUND_AMOUNT", "PROVIDER_REFERENCE_REQUIRED", "REFUND_NOT_APPROVED", "REFUND_ALREADY_PROCESSED", "REFUND_EXCEEDS_ORDER_AMOUNT", "REFUND_PROCESSING_FAILED", "INVALID_FINANCE_SETTINGS",
    "INVALID_MEETING_URL", "INVALID_PRESENCE_ACTION", "INVALID_SESSION_SETTINGS", "SESSION_CANNOT_CLOSE",
    "PACKAGE_INCOMPLETE", "PACKAGE_PRICE_OUT_OF_RANGE", "GROUP_INCOMPLETE", "SUBSCRIPTION_PLAN_INCOMPLETE", "ADVANCED_PRODUCT_REQUIRED",
    "ACTION_PLAN_INCOMPLETE", "ACTION_ITEM_INCOMPLETE", "INVALID_RECORDING_CONSENT", "RECORDING_STORAGE_KEY_REQUIRED", "INVALID_ADVANCED_SETTINGS",
    "EMAIL_REQUIRED", "ORGANIZATION_REQUIRED",
  ];
  if (code === "SESSION_INVALID") return json({ error: code }, 401);
  if (["FORBIDDEN", "PREVIEW_READ_ONLY", "COACH_ELIGIBILITY_REQUIRED", "STRUCTURE_MANAGER_REQUIRED", "STRUCTURE_MEMBER_REQUIRED"].includes(code)) return json({ error: code }, 403);
  if (code === "COACH_PREVIEW_ACCOUNT_MISSING") return json({ error: code }, 409);
  if (["INVOICE_UNAVAILABLE", "RECORDING_STORAGE_NOT_CONFIGURED", "RECORDING_PROVIDER_FAILED"].includes(code)) return json({ error: code }, 503);
  if (code === "INVALID_RECORDING_SECRET") return json({ error: code }, 401);
  if (["APPLICATION_NOT_FOUND", "COACH_NOT_FOUND", "OFFER_NOT_FOUND", "BOOKING_NOT_FOUND", "COACHING_ORDER_NOT_FOUND", "INVOICE_NOT_FOUND", "REFUND_NOT_FOUND", "PACKAGE_NOT_FOUND", "SUBSCRIPTION_PLAN_NOT_FOUND", "GROUP_NOT_FOUND", "GROUP_REGISTRATION_NOT_FOUND", "ACTION_PLAN_NOT_FOUND", "RECORDING_NOT_FOUND", "USER_NOT_FOUND"].includes(code)) return json({ error: code }, 404);
  if (["APPLICATION_ALREADY_ACTIVE", "SLOT_UNAVAILABLE", "OFFER_NOT_APPROVED", "SESSION_TOO_EARLY", "SESSION_OUTSIDE_ACCESS_WINDOW", "SESSION_ROOM_CLOSED", "SESSION_ROOM_UNAVAILABLE", "GROUP_FULL", "GROUP_ALREADY_REGISTERED", "GROUP_NOT_AVAILABLE", "PACKAGE_CREDIT_UNAVAILABLE", "PACKAGE_OFFER_MISMATCH", "RECORDING_CONSENT_REQUIRED", "RECORDING_DISABLED", "ACTIVE_RECORDING_NOT_FOUND", "GROUP_CANNOT_EDIT", "SUBSCRIPTION_ALREADY_ACTIVE"].includes(code)) return json({ error: code }, 409);
  if (["SESSION_ROOM_NOT_FOUND", "SESSION_MEMBER_NOT_FOUND"].includes(code)) return json({ error: code }, 404);
  if (badRequest.includes(code)) return json({ error: code }, 400);
  console.error("[coaching]", error);
  return json({ error: "COACHING_ERROR", detail: code }, 500);
}

type CoachingParticipantRole = "coach" | "learner" | "admin_supervisor";

type CoachingSessionAccess = {
  booking: Record<string, unknown>;
  coachProfile: Record<string, unknown>;
  role: CoachingParticipantRole;
};

async function coachingRoomSettings(sb: Supabase) {
  const { data, error } = await sb.from("coaching_settings").select("*").eq("id", 1).maybeSingle();
  if (error) throw error;
  return {
    room_access_before_minutes: Number(data?.room_access_before_minutes ?? 30),
    room_access_after_minutes: Number(data?.room_access_after_minutes ?? 30),
    external_link_reveal_before_minutes: Number(data?.external_link_reveal_before_minutes ?? 30),
    no_show_grace_minutes: Number(data?.no_show_grace_minutes ?? 15),
    auto_complete_after_minutes: Number(data?.auto_complete_after_minutes ?? 30),
  };
}

async function coachingSessionAccess(sb: Supabase, actor: Session, sessionId: string): Promise<CoachingSessionAccess> {
  const { data: booking, error } = await sb.from("coaching_sessions").select("*").eq("id", sessionId).maybeSingle();
  if (error) throw error;
  if (!booking) throw new Error("BOOKING_NOT_FOUND");
  const { data: coachProfile, error: coachError } = await sb.from("coach_profiles").select("id,user_id,public_slug,status").eq("id", booking.coach_id).maybeSingle();
  if (coachError) throw coachError;
  if (!coachProfile) throw new Error("COACH_NOT_FOUND");
  if (isAdmin(actor)) return { booking, coachProfile, role: "admin_supervisor" };
  if (String(booking.learner_user_id) === actor.userId) return { booking, coachProfile, role: "learner" };
  if (String(coachProfile.user_id) === actor.userId && actor.roles.includes("coach")) return { booking, coachProfile, role: "coach" };
  throw new Error("FORBIDDEN");
}

function coachingAccessWindow(booking: Record<string, unknown>, settings: Awaited<ReturnType<typeof coachingRoomSettings>>) {
  if (!booking.scheduled_start || !booking.scheduled_end) throw new Error("BOOKING_INCOMPLETE");
  const start = new Date(String(booking.scheduled_start));
  const end = new Date(String(booking.scheduled_end));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new Error("BOOKING_INCOMPLETE");
  return {
    opensAt: new Date(start.getTime() - settings.room_access_before_minutes * 60000),
    closesAt: new Date(end.getTime() + settings.room_access_after_minutes * 60000),
    externalRevealsAt: new Date(start.getTime() - settings.external_link_reveal_before_minutes * 60000),
  };
}

function coachingRoomSlug(sessionId: string) {
  return `oga-coaching-${sessionId.slice(0, 8)}-${crypto.randomUUID().replace(/-/g, "").slice(0, 18)}`;
}

async function ensureCoachingRoom(sb: Supabase, access: CoachingSessionAccess, actorUserId: string) {
  if (String(access.booking.meeting_mode) !== "jitsi") throw new Error("INVALID_SESSION_MODE");
  const { data: existing, error: existingError } = await sb.from("coaching_rooms").select("*").eq("session_id", access.booking.id).maybeSingle();
  if (existingError) throw existingError;

  const provider = jaasConfigured() ? "jaas" : publicJitsiDevEnabled() ? "jitsi_embed" : "unconfigured";
  const embedBase = (Deno.env.get("LIVE_VIDEO_EMBED_BASE_URL") || "https://meet.jit.si").replace(/\/+$/, "");
  if (existing) {
    if (provider !== "unconfigured" && existing.provider !== provider) {
      const roomSlug = String(existing.room_slug || existing.provider_room_id || coachingRoomSlug(String(access.booking.id)));
      const roomUrl = provider === "jitsi_embed" ? `${embedBase}/${encodeURIComponent(roomSlug)}` : null;
      const update = await sb.from("coaching_rooms").update({
        provider,
        provider_room_id: roomSlug,
        room_slug: roomSlug,
        provider_join_url: roomUrl,
        provider_host_url: roomUrl,
        status: "ready",
        updated_at: new Date().toISOString(),
      }).eq("id", existing.id).select("*").single();
      if (update.error) throw update.error;
      return update.data;
    }
    return existing;
  }

  const roomSlug = coachingRoomSlug(String(access.booking.id));
  const roomUrl = provider === "jitsi_embed" ? `${embedBase}/${encodeURIComponent(roomSlug)}` : null;
  const { data: created, error } = await sb.from("coaching_rooms").insert({
    session_id: access.booking.id,
    provider,
    provider_room_id: roomSlug,
    room_slug: roomSlug,
    status: provider === "unconfigured" ? "pending" : "ready",
    provider_join_url: roomUrl,
    provider_host_url: roomUrl,
    created_by: actorUserId,
  }).select("*").single();
  if (error) {
    const { data: concurrent } = await sb.from("coaching_rooms").select("*").eq("session_id", access.booking.id).maybeSingle();
    if (concurrent) return concurrent;
    throw error;
  }
  await sb.from("coaching_session_actions").insert({ session_id: access.booking.id, room_id: created.id, actor_user_id: actorUserId, action: "room_created", metadata: { provider } });
  return created;
}


async function coachingAttendance(sb: Supabase, sessionId: string) {
  const { data, error } = await sb.rpc("coaching_attendance_summary", { p_session_id: sessionId });
  if (error) throw error;
  return (data || []).map((row: Record<string, unknown>) => ({
    ...row,
    duration_seconds: Number(row.duration_seconds || 0),
  }));
}

async function sessionRoomAccess(sb: Supabase, actor: Session, body: Record<string, unknown>) {
  const sessionId = asText(body.session_id, 80);
  if (!sessionId) throw new Error("BOOKING_NOT_FOUND");
  const access = await coachingSessionAccess(sb, actor, sessionId);
  const settings = await coachingRoomSettings(sb);
  const window = coachingAccessWindow(access.booking, settings);
  const now = new Date();
  const isSupervisor = access.role === "admin_supervisor";
  const status = String(access.booking.status);
  const allowedStatus = ["confirmed", "ready", "in_progress", "completed", "no_show_learner", "no_show_coach"].includes(status);
  if (!allowedStatus || String(access.booking.payment_status) !== "paid") throw new Error("SESSION_ROOM_UNAVAILABLE");

  if (access.role === "learner" && now < window.opensAt) {
    return { session: { ...access.booking, external_meeting_url: undefined }, role: access.role, access_status: "too_early", opens_at: window.opensAt.toISOString(), closes_at: window.closesAt.toISOString(), room: null, attendance: [] };
  }

  let room: Record<string, unknown> | null = null;
  if (String(access.booking.meeting_mode) === "jitsi") {
    if (["completed", "no_show_learner", "no_show_coach"].includes(status)) {
      const existingRoom = await sb.from("coaching_rooms").select("*").eq("session_id", access.booking.id).maybeSingle();
      if (existingRoom.error) throw existingRoom.error;
      room = existingRoom.data || null;
    } else {
      if (!isSupervisor && now < window.opensAt) {
        return { session: { ...access.booking, external_meeting_url: undefined }, role: access.role, access_status: "too_early", opens_at: window.opensAt.toISOString(), closes_at: window.closesAt.toISOString(), room: null, attendance: [] };
      }
      room = await ensureCoachingRoom(sb, access, actor.userId);
      if (["ready"].includes(String(room.status)) && now >= window.opensAt && now <= window.closesAt) {
        const result = await sb.from("coaching_rooms").update({ status: "open" }).eq("id", room.id).select("*").single();
        if (result.error) throw result.error;
        room = result.data;
      }
    }
  }

  const externalVisible = isSupervisor || access.role === "coach" || now >= window.externalRevealsAt;
  const sanitized = { ...access.booking, external_meeting_url: externalVisible ? access.booking.external_meeting_url : undefined };
  return {
    session: sanitized,
    role: access.role,
    access_status: !isSupervisor && now > window.closesAt ? "closed" : "available",
    opens_at: window.opensAt.toISOString(),
    closes_at: window.closesAt.toISOString(),
    room,
    attendance: await coachingAttendance(sb, sessionId),
    external_link_visible: externalVisible,
  };
}

async function coachingRoomStart(sb: Supabase, actor: Session, body: Record<string, unknown>) {
  const sessionId = asText(body.session_id, 80);
  const access = await coachingSessionAccess(sb, actor, sessionId);
  if (!(["coach", "admin_supervisor"] as CoachingParticipantRole[]).includes(access.role)) throw new Error("FORBIDDEN");
  if (!["confirmed", "ready", "in_progress"].includes(String(access.booking.status)) || String(access.booking.payment_status) !== "paid") throw new Error("SESSION_ROOM_UNAVAILABLE");
  const settings = await coachingRoomSettings(sb);
  const window = coachingAccessWindow(access.booking, settings);
  const now = new Date();
  if (access.role !== "admin_supervisor" && (now < window.opensAt || now > window.closesAt)) throw new Error("SESSION_OUTSIDE_ACCESS_WINDOW");
  let room: Record<string, unknown> | null = null;
  if (String(access.booking.meeting_mode) === "jitsi") {
    room = await ensureCoachingRoom(sb, access, actor.userId);
    const result = await sb.from("coaching_rooms").update({ status: "live", starts_at: room.starts_at || now.toISOString() }).eq("id", room.id).select("*").single();
    if (result.error) throw result.error;
    room = result.data;
  }
  const update = await sb.from("coaching_sessions").update({ status: "in_progress", actual_started_at: access.booking.actual_started_at || now.toISOString() }).eq("id", sessionId).select("*").single();
  if (update.error) throw update.error;
  await sb.from("coaching_session_actions").insert({ session_id: sessionId, room_id: room?.id || null, actor_user_id: actor.userId, action: "session_started", metadata: { meeting_mode: access.booking.meeting_mode } });
  return { session: { ...update.data, external_meeting_url: access.role === "learner" ? undefined : update.data.external_meeting_url }, room };
}

async function coachingRoomJoin(sb: Supabase, actor: Session, body: Record<string, unknown>) {
  const sessionId = asText(body.session_id, 80);
  const access = await coachingSessionAccess(sb, actor, sessionId);
  if (String(access.booking.meeting_mode) !== "jitsi") throw new Error("INVALID_SESSION_MODE");
  if (!["confirmed", "ready", "in_progress"].includes(String(access.booking.status)) || String(access.booking.payment_status) !== "paid") throw new Error("SESSION_ROOM_UNAVAILABLE");
  const settings = await coachingRoomSettings(sb);
  const window = coachingAccessWindow(access.booking, settings);
  const now = new Date();
  if (access.role !== "admin_supervisor" && (now < window.opensAt || now > window.closesAt)) throw new Error(now < window.opensAt ? "SESSION_TOO_EARLY" : "SESSION_ROOM_CLOSED");
  const room = await ensureCoachingRoom(sb, access, actor.userId);
  if (String(room.status) === "ended" && access.role !== "admin_supervisor") throw new Error("SESSION_ROOM_CLOSED");
  if (String(room.status) === "ready") await sb.from("coaching_rooms").update({ status: "open" }).eq("id", room.id);
  const nowIso = now.toISOString();
  const memberResult = await sb.from("coaching_room_members").upsert({
    room_id: room.id,
    session_id: sessionId,
    user_id: actor.userId,
    room_role: access.role,
    access_status: "admitted",
    joined_at: nowIso,
    left_at: null,
    last_seen_at: nowIso,
  }, { onConflict: "room_id,user_id" }).select("*").single();
  if (memberResult.error) throw memberResult.error;
  const { data: openSegment } = await sb.from("coaching_attendance_segments").select("id").eq("session_id", sessionId).eq("user_id", actor.userId).is("left_at", null).maybeSingle();
  if (!openSegment) {
    const segment = await sb.from("coaching_attendance_segments").insert({ session_id: sessionId, room_id: room.id, user_id: actor.userId, participant_role: access.role, source: "jitsi", joined_at: nowIso }).select("id").single();
    if (segment.error) throw segment.error;
  }
  const sessionPatch: Record<string, unknown> = {};
  if (access.role === "coach" && !access.booking.coach_joined_at) sessionPatch.coach_joined_at = nowIso;
  if (access.role === "learner" && !access.booking.learner_joined_at) sessionPatch.learner_joined_at = nowIso;
  if (access.role === "coach" && ["confirmed", "ready"].includes(String(access.booking.status))) {
    sessionPatch.status = "in_progress";
    sessionPatch.actual_started_at = access.booking.actual_started_at || nowIso;
    await sb.from("coaching_rooms").update({ status: "live", starts_at: room.starts_at || nowIso }).eq("id", room.id);
  }
  if (Object.keys(sessionPatch).length) await sb.from("coaching_sessions").update(sessionPatch).eq("id", sessionId);
  await sb.from("coaching_session_actions").insert({ session_id: sessionId, room_id: room.id, actor_user_id: actor.userId, action: "participant_joined", metadata: { role: access.role, source: "jitsi", provider: room.provider } });

  if (jaasConfigured()) {
    const { data: user } = await sb.from("users").select("full_name,email").eq("id", actor.userId).maybeSingle();
    const meeting = await createJaasMeetingAccess({
      roomName: String(room.room_slug || room.provider_room_id),
      userId: actor.userId,
      name: user?.full_name || null,
      email: user?.email || null,
      moderator: access.role === "coach" || access.role === "admin_supervisor",
    });
    return { room, member: memberResult.data, role: access.role, join_url: null, meeting };
  }
  if (!publicJitsiDevEnabled()) throw new Error("VIDEO_PROVIDER_NOT_CONFIGURED");
  return {
    room,
    member: memberResult.data,
    role: access.role,
    join_url: access.role === "coach" || access.role === "admin_supervisor" ? room.provider_host_url : room.provider_join_url,
    meeting: null,
    security_mode: "development_public_jitsi",
  };
}

async function coachingRoomHeartbeat(sb: Supabase, actor: Session, body: Record<string, unknown>) {
  const sessionId = asText(body.session_id, 80);
  const access = await coachingSessionAccess(sb, actor, sessionId);
  const { data: room } = await sb.from("coaching_rooms").select("id,status").eq("session_id", sessionId).maybeSingle();
  if (!room) throw new Error("SESSION_ROOM_NOT_FOUND");
  const now = new Date().toISOString();
  const result = await sb.from("coaching_room_members").update({ last_seen_at: now }).eq("room_id", room.id).eq("user_id", actor.userId).select("id,access_status").maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new Error("SESSION_MEMBER_NOT_FOUND");
  return { role: access.role, room_status: room.status, access_status: result.data.access_status, server_time: now };
}

async function coachingRoomLeave(sb: Supabase, actor: Session, body: Record<string, unknown>) {
  const sessionId = asText(body.session_id, 80);
  await coachingSessionAccess(sb, actor, sessionId);
  const now = new Date().toISOString();
  const { data: room } = await sb.from("coaching_rooms").select("id").eq("session_id", sessionId).maybeSingle();
  if (room) await sb.from("coaching_room_members").update({ access_status: "left", left_at: now, last_seen_at: now }).eq("room_id", room.id).eq("user_id", actor.userId);
  const { error } = await sb.rpc("coaching_close_open_attendance", { p_session_id: sessionId, p_user_id: actor.userId, p_left_at: now });
  if (error) throw error;
  await sb.from("coaching_session_actions").insert({ session_id: sessionId, room_id: room?.id || null, actor_user_id: actor.userId, action: "participant_left" });
  return { left_at: now };
}

async function createNoShowRefund(sb: Supabase, booking: Record<string, unknown>, reasonDetails: string) {
  const { data: order } = await sb.from("coaching_payment_orders").select("*").eq("session_id", booking.id).eq("payment_status", "paid").maybeSingle();
  if (!order) return null;
  const { data: existing } = await sb.from("coaching_refund_requests").select("*").eq("session_id", booking.id).in("status", ["pending", "under_review", "approved", "partially_approved"]).maybeSingle();
  if (existing) return existing;
  const result = await sb.from("coaching_refund_requests").insert({
    order_id: order.id,
    session_id: booking.id,
    user_id: booking.learner_user_id,
    coach_id: booking.coach_id,
    initiated_by: "system",
    requested_amount_xof: Number(order.amount_xof || 0),
    reason_code: "no_show_coach",
    reason_details: reasonDetails,
    status: "pending",
    policy_snapshot: order.policy_snapshot || booking.policy_snapshot || {},
  }).select("*").single();
  if (result.error) throw result.error;
  return result.data;
}

async function finalizeCoachingSession(sb: Supabase, actor: Session, access: CoachingSessionAccess, source: "coach" | "admin" | "system") {
  const sessionId = String(access.booking.id);
  const now = new Date().toISOString();
  const { error: closeError } = await sb.rpc("coaching_close_open_attendance", { p_session_id: sessionId, p_user_id: null, p_left_at: now });
  if (closeError) throw closeError;
  const summary = await coachingAttendance(sb, sessionId);
  const coachSeconds = Number(summary.find((row: Record<string, unknown>) => row.participant_role === "coach")?.duration_seconds || 0);
  const learnerSeconds = Number(summary.find((row: Record<string, unknown>) => row.participant_role === "learner")?.duration_seconds || 0);
  let status = "completed";
  if (coachSeconds <= 0) status = "no_show_coach";
  else if (learnerSeconds <= 0) status = "no_show_learner";
  const result = await sb.from("coaching_sessions").update({ status, actual_ended_at: now, completion_source: source, no_show_marked_at: status.startsWith("no_show") ? now : null }).eq("id", sessionId).select("*").single();
  if (result.error) throw result.error;
  const { data: room } = await sb.from("coaching_rooms").select("*").eq("session_id", sessionId).maybeSingle();
  if (room) {
    await sb.from("coaching_rooms").update({ status: "ended", ends_at: now }).eq("id", room.id);
    await sb.from("coaching_room_members").update({ access_status: "left", left_at: now, last_seen_at: now }).eq("room_id", room.id).eq("access_status", "admitted");
  }
  let refund = null;
  if (status === "no_show_coach") refund = await createNoShowRefund(sb, result.data, "Le coach n’a enregistré aucune présence pendant la session.");
  await sb.from("coaching_session_actions").insert({ session_id: sessionId, room_id: room?.id || null, actor_user_id: source === "system" ? null : actor.userId, action: "session_closed", metadata: { status, source, coach_duration_seconds: coachSeconds, learner_duration_seconds: learnerSeconds } });
  await invokeNotification("coaching_session_closed", { userId: result.data.learner_user_id, status, offer_title: result.data.offer_title_snapshot, coach_name: result.data.coach_name_snapshot, session_id: sessionId, action_url: "/dashboard/coaching" });
  if (access.coachProfile.user_id) await invokeNotification("coaching_session_closed", { userId: access.coachProfile.user_id, status, offer_title: result.data.offer_title_snapshot, coach_name: result.data.coach_name_snapshot, session_id: sessionId, action_url: "/coach/sessions" });
  return { session: result.data, attendance: summary, refund };
}

async function coachingRoomEnd(sb: Supabase, actor: Session, body: Record<string, unknown>) {
  const sessionId = asText(body.session_id, 80);
  const access = await coachingSessionAccess(sb, actor, sessionId);
  if (!(["coach", "admin_supervisor"] as CoachingParticipantRole[]).includes(access.role)) throw new Error("FORBIDDEN");
  if (!["confirmed", "ready", "in_progress"].includes(String(access.booking.status))) throw new Error("SESSION_CANNOT_CLOSE");
  return finalizeCoachingSession(sb, actor, access, access.role === "admin_supervisor" ? "admin" : "coach");
}

async function saveExternalMeetingLink(sb: Supabase, actor: Session, body: Record<string, unknown>) {
  const sessionId = asText(body.session_id, 80);
  const meetingUrl = asText(body.meeting_url, 1000);
  const access = await coachingSessionAccess(sb, actor, sessionId);
  if (!(["coach", "admin_supervisor"] as CoachingParticipantRole[]).includes(access.role)) throw new Error("FORBIDDEN");
  if (String(access.booking.meeting_mode) !== "external") throw new Error("INVALID_SESSION_MODE");
  if (!meetingUrl || !isHttpUrl(meetingUrl)) throw new Error("INVALID_MEETING_URL");
  if (!["confirmed", "ready", "in_progress"].includes(String(access.booking.status))) throw new Error("SESSION_ROOM_UNAVAILABLE");
  const result = await sb.from("coaching_sessions").update({ external_meeting_url: meetingUrl, external_link_updated_at: new Date().toISOString(), external_link_updated_by: actor.userId }).eq("id", sessionId).select("*").single();
  if (result.error) throw result.error;
  await sb.from("coaching_session_actions").insert({ session_id: sessionId, actor_user_id: actor.userId, action: "external_link_updated", metadata: { hostname: new URL(meetingUrl).hostname } });
  await invokeNotification("coaching_external_link_ready", { userId: result.data.learner_user_id, offer_title: result.data.offer_title_snapshot, coach_name: result.data.coach_name_snapshot, scheduled_start: result.data.scheduled_start, session_id: sessionId, action_url: `/coaching/sessions/${sessionId}/room` });
  return { ...result.data, external_meeting_url: meetingUrl };
}

async function externalPresenceMark(sb: Supabase, actor: Session, body: Record<string, unknown>) {
  const sessionId = asText(body.session_id, 80);
  const presenceAction = asText(body.presence_action, 20);
  const access = await coachingSessionAccess(sb, actor, sessionId);
  if (String(access.booking.meeting_mode) !== "external") throw new Error("INVALID_SESSION_MODE");
  if (!(["coach", "learner"] as CoachingParticipantRole[]).includes(access.role)) throw new Error("FORBIDDEN");
  if (!["join", "leave"].includes(presenceAction)) throw new Error("INVALID_PRESENCE_ACTION");
  const settings = await coachingRoomSettings(sb);
  const window = coachingAccessWindow(access.booking, settings);
  const now = new Date();
  if (now < window.opensAt || now > window.closesAt) throw new Error(now < window.opensAt ? "SESSION_TOO_EARLY" : "SESSION_ROOM_CLOSED");
  const nowIso = now.toISOString();
  if (presenceAction === "join") {
    const { data: open } = await sb.from("coaching_attendance_segments").select("id").eq("session_id", sessionId).eq("user_id", actor.userId).is("left_at", null).maybeSingle();
    if (!open) {
      const segment = await sb.from("coaching_attendance_segments").insert({ session_id: sessionId, room_id: null, user_id: actor.userId, participant_role: access.role, source: "external", joined_at: nowIso }).select("id").single();
      if (segment.error) throw segment.error;
    }
    const patch: Record<string, unknown> = {};
    if (access.role === "coach" && !access.booking.coach_joined_at) patch.coach_joined_at = nowIso;
    if (access.role === "learner" && !access.booking.learner_joined_at) patch.learner_joined_at = nowIso;
    if (access.role === "coach" && ["confirmed", "ready"].includes(String(access.booking.status))) { patch.status = "in_progress"; patch.actual_started_at = access.booking.actual_started_at || nowIso; }
    if (Object.keys(patch).length) await sb.from("coaching_sessions").update(patch).eq("id", sessionId);
  } else {
    const { error } = await sb.rpc("coaching_close_open_attendance", { p_session_id: sessionId, p_user_id: actor.userId, p_left_at: nowIso });
    if (error) throw error;
  }
  await sb.from("coaching_session_actions").insert({ session_id: sessionId, actor_user_id: actor.userId, action: presenceAction === "join" ? "external_participant_joined" : "external_participant_left", metadata: { role: access.role } });
  return { presence_action: presenceAction, marked_at: nowIso, attendance: await coachingAttendance(sb, sessionId) };
}

async function adminCoachingSessions(sb: Supabase) {
  const { data: sessions, error } = await sb.from("coaching_sessions").select("*").order("scheduled_start", { ascending: false, nullsFirst: false }).limit(500);
  if (error) throw error;
  const rows = sessions || [];
  const coachIds = [...new Set(rows.map((row: Record<string, unknown>) => String(row.coach_id)))];
  const learnerIds = [...new Set(rows.map((row: Record<string, unknown>) => String(row.learner_user_id)))];
  const [{ data: profiles }, { data: users }, { data: rooms }] = await Promise.all([
    coachIds.length ? sb.from("coach_profiles").select("id,user_id,public_slug").in("id", coachIds) : Promise.resolve({ data: [] }),
    learnerIds.length ? sb.from("users").select("id,full_name,email").in("id", learnerIds) : Promise.resolve({ data: [] }),
    rows.length ? sb.from("coaching_rooms").select("*").in("session_id", rows.map((row: Record<string, unknown>) => String(row.id))) : Promise.resolve({ data: [] }),
  ]);
  const profileUserIds = (profiles || []).map((row: { user_id: string }) => String(row.user_id));
  const { data: coachUsers } = profileUserIds.length ? await sb.from("users").select("id,full_name,email").in("id", profileUserIds) : { data: [] };
  const coachUserMap = new Map((coachUsers || []).map((row: { id: string }) => [String(row.id), row]));
  const coachMap = new Map((profiles || []).map((row: { id: string; user_id: string }) => [String(row.id), { ...row, ...((coachUserMap.get(String(row.user_id)) || {}) as Record<string, unknown>) }]));
  const learnerMap = new Map((users || []).map((row: { id: string }) => [String(row.id), row]));
  const roomMap = new Map((rooms || []).map((row: { session_id: string }) => [String(row.session_id), row]));
  return rows.map((row: Record<string, unknown>) => ({ ...row, coach: coachMap.get(String(row.coach_id)) || null, learner: learnerMap.get(String(row.learner_user_id)) || null, room: roomMap.get(String(row.id)) || null }));
}

async function adminSessionSettingsSave(sb: Supabase, actor: Session, body: Record<string, unknown>) {
  const fields = ["room_access_before_minutes", "room_access_after_minutes", "external_link_reveal_before_minutes", "no_show_grace_minutes", "auto_complete_after_minutes"] as const;
  const patch: Record<string, number> = {};
  for (const field of fields) {
    const value = asInteger(body[field]);
    if (value === null) throw new Error("INVALID_SESSION_SETTINGS");
    patch[field] = value;
  }
  const result = await sb.from("coaching_settings").update(patch).eq("id", 1).select("*").single();
  if (result.error) throw result.error;
  await audit(sb, actor.userId, "coaching_session_settings_updated", "coaching_settings", "global", null, result.data);
  return result.data;
}



type CoachingDisputeRole = "learner" | "coach" | "admin";

async function performanceSettings(sb: Supabase) {
  const { data, error } = await sb.from("coaching_settings").select("*").eq("id", 1).maybeSingle();
  if (error) throw error;
  return {
    rating_window_days: Number(data?.rating_window_days ?? 30),
    rating_invitation_delay_minutes: Number(data?.rating_invitation_delay_minutes ?? 5),
    warning_rating_threshold: Number(data?.warning_rating_threshold ?? 3.5),
    warning_minimum_reviews: Number(data?.warning_minimum_reviews ?? 5),
    suspension_rating_threshold: Number(data?.suspension_rating_threshold ?? 2.5),
    suspension_minimum_reviews: Number(data?.suspension_minimum_reviews ?? 10),
    automatic_rating_suspension_enabled: Boolean(data?.automatic_rating_suspension_enabled ?? false),
    dispute_window_hours: Number(data?.dispute_window_hours ?? 48),
  };
}

function ratingValue(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) throw new Error("INVALID_RATING");
  return parsed;
}

function privateDisplayName(value: unknown): string {
  const parts = asText(value, 180).split(/\s+/).filter(Boolean);
  if (!parts.length) return "Apprenant OGA";
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[1][0].toUpperCase()}.`;
}

async function publicCoachRatings(sb: Supabase, coachId: string, limit = 30) {
  const { data: ratings, error } = await sb.from("coaching_ratings")
    .select("id,session_id,learner_user_id,overall_rating,communication_rating,expertise_rating,usefulness_rating,comment,would_recommend,coach_response,coach_responded_at,created_at")
    .eq("coach_id", coachId).eq("moderation_status", "published")
    .order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  const userIds = [...new Set((ratings || []).map((row: Record<string, unknown>) => String(row.learner_user_id)))];
  const { data: users } = userIds.length ? await sb.from("users").select("id,full_name").in("id", userIds) : { data: [] };
  const byId = new Map((users || []).map((user: Record<string, unknown>) => [String(user.id), privateDisplayName(user.full_name)]));
  return (ratings || []).map((row: Record<string, unknown>) => ({
    id: row.id,
    session_id: row.session_id,
    learner_name: byId.get(String(row.learner_user_id)) || "Apprenant OGA",
    overall_rating: Number(row.overall_rating),
    communication_rating: Number(row.communication_rating),
    expertise_rating: Number(row.expertise_rating),
    usefulness_rating: Number(row.usefulness_rating),
    comment: row.comment,
    would_recommend: row.would_recommend,
    coach_response: row.coach_response,
    coach_responded_at: row.coach_responded_at,
    created_at: row.created_at,
    verified_session: true,
  }));
}

async function followUpAccess(sb: Supabase, actor: Session, sessionId: string) {
  const access = await coachingSessionAccess(sb, actor, sessionId);
  const { data: order } = await sb.from("coaching_payment_orders").select("*").eq("session_id", sessionId).maybeSingle();
  const [{ data: rating }, { data: feedback }, { data: dispute }] = await Promise.all([
    sb.from("coaching_ratings").select("*").eq("session_id", sessionId).maybeSingle(),
    sb.from("coaching_learner_feedback").select("*").eq("session_id", sessionId).maybeSingle(),
    sb.from("coaching_disputes").select("*").eq("session_id", sessionId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const settings = await performanceSettings(sb);
  const endedAt = new Date(String(access.booking.actual_ended_at || access.booking.scheduled_end || access.booking.updated_at));
  const ratingDeadline = new Date(endedAt.getTime() + settings.rating_window_days * 86400000);
  const disputeDeadline = new Date(endedAt.getTime() + settings.dispute_window_hours * 3600000);
  return {
    ...access,
    order: order || null,
    rating: rating || null,
    learner_feedback: access.role === "coach" || access.role === "admin_supervisor" ? feedback || null : null,
    dispute: dispute || null,
    rating_deadline: ratingDeadline.toISOString(),
    dispute_deadline: disputeDeadline.toISOString(),
    can_rate: access.role === "learner" && String(access.booking.status) === "completed" && !rating && Date.now() <= ratingDeadline.getTime(),
    can_open_dispute: access.role !== "admin_supervisor" && ["completed", "no_show_learner", "no_show_coach"].includes(String(access.booking.status)) && String(access.booking.payment_status) === "paid" && !dispute && Date.now() <= disputeDeadline.getTime(),
  };
}

async function submitLearnerRating(sb: Supabase, actor: Session, body: Record<string, unknown>) {
  const sessionId = asText(body.session_id, 80);
  const follow = await followUpAccess(sb, actor, sessionId);
  if (follow.role !== "learner") throw new Error("FORBIDDEN");
  if (!follow.can_rate) throw new Error(follow.rating ? "RATING_ALREADY_SUBMITTED" : "RATING_WINDOW_CLOSED");
  const { data: profileBefore } = await sb.from("coach_profiles").select("status").eq("id", follow.booking.coach_id).maybeSingle();
  const payload = {
    session_id: sessionId,
    learner_user_id: actor.userId,
    coach_id: follow.booking.coach_id,
    overall_rating: ratingValue(body.overall_rating),
    communication_rating: ratingValue(body.communication_rating),
    expertise_rating: ratingValue(body.expertise_rating),
    usefulness_rating: ratingValue(body.usefulness_rating),
    comment: asNullableText(body.comment, 3000),
    would_recommend: asBoolean(body.would_recommend),
  };
  const { data, error } = await sb.from("coaching_ratings").insert(payload).select("*").single();
  if (error) {
    if (String(error.code) === "23505") throw new Error("RATING_ALREADY_SUBMITTED");
    throw error;
  }
  const coachUserId = String(follow.coachProfile.user_id);
  await invokeNotification("coaching_rating_received", {
    userId: coachUserId,
    learner_name: "Un apprenant",
    offer_title: follow.booking.offer_title_snapshot,
    rating: payload.overall_rating,
    session_id: sessionId,
    action_url: "/coach/avis",
  });
  const settings = await performanceSettings(sb);
  const { data: profile } = await sb.from("coach_profiles").select("average_rating,rating_count,status").eq("id", follow.booking.coach_id).maybeSingle();
  if (profile && String(profileBefore?.status) !== "suspended" && String(profile.status) === "suspended") {
    await invokeNotification("coaching_rating_suspension", {
      userId: coachUserId,
      average_rating: profile.average_rating,
      rating_count: profile.rating_count,
      action_url: "/coach/avis",
    });
  } else if (profile && Number(profile.rating_count) >= settings.warning_minimum_reviews && Number(profile.average_rating) < settings.warning_rating_threshold) {
    await invokeNotification("coaching_rating_warning", {
      userId: coachUserId,
      average_rating: profile.average_rating,
      rating_count: profile.rating_count,
      action_url: "/coach/avis",
    });
  }
  return data;
}

async function coachRatingsDashboard(sb: Supabase, actor: Session) {
  const profile = await ownCoachProfile(sb, actor);
  const { data: ratings, error } = await sb.from("coaching_ratings").select("*").eq("coach_id", profile.id).order("created_at", { ascending: false });
  if (error) throw error;
  const userIds = [...new Set((ratings || []).map((row: Record<string, unknown>) => String(row.learner_user_id)))];
  const { data: users } = userIds.length ? await sb.from("users").select("id,full_name").in("id", userIds) : { data: [] };
  const userById = new Map((users || []).map((row: Record<string, unknown>) => [String(row.id), privateDisplayName(row.full_name)]));
  return {
    profile,
    ratings: (ratings || []).map((row: Record<string, unknown>) => ({ ...row, learner_name: userById.get(String(row.learner_user_id)) || "Apprenant OGA" })),
    metrics: {
      average_rating: Number(profile.average_rating || 0),
      rating_count: Number(profile.rating_count || 0),
      recommendation_percent: (() => { const published = (ratings || []).filter((row: Record<string, unknown>) => row.moderation_status === "published"); return published.length ? Math.round((published.filter((row: Record<string, unknown>) => row.would_recommend === true).length / published.length) * 100) : 0; })(),
    },
  };
}

async function coachReplyToRating(sb: Supabase, actor: Session, body: Record<string, unknown>) {
  const profile = await ownCoachProfile(sb, actor);
  const ratingId = asText(body.rating_id, 80);
  const response = asText(body.response, 1500);
  if (!ratingId || !response) throw new Error("RATING_RESPONSE_REQUIRED");
  const { data: rating, error } = await sb.from("coaching_ratings").select("*").eq("id", ratingId).eq("coach_id", profile.id).maybeSingle();
  if (error) throw error;
  if (!rating) throw new Error("RATING_NOT_FOUND");
  if (String(rating.moderation_status) !== "published") throw new Error("RATING_NOT_PUBLISHED");
  const result = await sb.from("coaching_ratings").update({ coach_response: response, coach_responded_at: new Date().toISOString() }).eq("id", ratingId).select("*").single();
  if (result.error) throw result.error;
  await invokeNotification("coaching_rating_response", { userId: rating.learner_user_id, coach_name: profile.professional_title, action_url: "/dashboard/coaching" });
  return result.data;
}

async function submitCoachLearnerFeedback(sb: Supabase, actor: Session, body: Record<string, unknown>) {
  const sessionId = asText(body.session_id, 80);
  const access = await coachingSessionAccess(sb, actor, sessionId);
  if (access.role !== "coach") throw new Error("FORBIDDEN");
  if (!["completed", "no_show_learner"].includes(String(access.booking.status))) throw new Error("SESSION_NOT_FINISHED");
  const payload = {
    session_id: sessionId,
    coach_id: access.booking.coach_id,
    learner_user_id: access.booking.learner_user_id,
    punctuality_rating: ratingValue(body.punctuality_rating),
    preparation_rating: ratingValue(body.preparation_rating),
    exchange_quality_rating: ratingValue(body.exchange_quality_rating),
    internal_comment: asNullableText(body.internal_comment, 2500),
  };
  const { data, error } = await sb.from("coaching_learner_feedback").upsert(payload, { onConflict: "session_id" }).select("*").single();
  if (error) throw error;
  return data;
}

function validateDisputeAttachments(value: unknown, ownerUserId?: string) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 8).map((item) => {
    const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const storagePath = asText(row.storage_path, 500);
    if (!storagePath || (ownerUserId && !storagePath.startsWith(`${ownerUserId}/`))) return null;
    return { storage_path: storagePath, file_name: asText(row.file_name, 180), mime_type: asText(row.mime_type, 120), size_bytes: asInteger(row.size_bytes) };
  }).filter(Boolean);
}

async function signDisputeAttachments(sb: Supabase, value: unknown) {
  if (!Array.isArray(value)) return [];
  const result = [];
  for (const item of value) {
    const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const path = asText(row.storage_path, 500);
    if (!path) continue;
    const signed = await sb.storage.from("coaching-private").createSignedUrl(path, 3600);
    result.push({ ...row, signed_url: signed.data?.signedUrl || null });
  }
  return result;
}

async function enrichDispute(sb: Supabase, dispute: Record<string, unknown>, admin = false) {
  const [{ data: coachingSession }, { data: coach }, { data: learner }, { data: messages }] = await Promise.all([
    sb.from("coaching_sessions").select("*").eq("id", dispute.session_id).maybeSingle(),
    sb.from("coach_profiles").select("id,user_id,public_slug,professional_title").eq("id", dispute.coach_id).maybeSingle(),
    sb.from("users").select("id,full_name,email").eq("id", dispute.learner_user_id).maybeSingle(),
    sb.from("coaching_dispute_messages").select("*").eq("dispute_id", dispute.id).order("created_at"),
  ]);
  const coachUser = coach?.user_id ? await sb.from("users").select("id,full_name,email").eq("id", coach.user_id).maybeSingle() : { data: null };
  const visibleMessages = await Promise.all((messages || []).filter((message: Record<string, unknown>) => admin || message.visibility === "participants").map(async (message: Record<string, unknown>) => ({ ...message, attachments: await signDisputeAttachments(sb, message.attachments) })));
  return { ...dispute, session: coachingSession || null, coach: coach ? { ...coach, full_name: coachUser.data?.full_name || "Coach Omnia", email: admin ? coachUser.data?.email : undefined } : null, learner: learner ? { ...learner, email: admin ? learner.email : undefined } : null, messages: visibleMessages };
}

async function openCoachingDispute(sb: Supabase, actor: Session, body: Record<string, unknown>) {
  const sessionId = asText(body.session_id, 80);
  const follow = await followUpAccess(sb, actor, sessionId);
  if (!follow.can_open_dispute) throw new Error(follow.dispute ? "DISPUTE_ALREADY_OPEN" : "DISPUTE_WINDOW_CLOSED");
  const category = asText(body.category, 80);
  const allowed = ["session_not_held", "technical_problem", "service_quality", "inappropriate_behavior", "payment_refund", "attendance_disagreement", "other"];
  if (!allowed.includes(category)) throw new Error("INVALID_DISPUTE_CATEGORY");
  const description = asText(body.description, 5000);
  if (description.length < 20) throw new Error("DISPUTE_DESCRIPTION_REQUIRED");
  const role: CoachingDisputeRole = follow.role === "learner" ? "learner" : "coach";
  const { data: dispute, error } = await sb.from("coaching_disputes").insert({
    session_id: sessionId,
    order_id: follow.order?.id || null,
    coach_id: follow.booking.coach_id,
    learner_user_id: follow.booking.learner_user_id,
    opened_by_user_id: actor.userId,
    opened_by_role: role,
    category,
    description,
    requested_resolution: asNullableText(body.requested_resolution, 40),
    previous_session_status: follow.booking.status,
    priority: category === "inappropriate_behavior" || category === "session_not_held" ? "high" : "normal",
  }).select("*").single();
  if (error) {
    if (String(error.code) === "23505") throw new Error("DISPUTE_ALREADY_OPEN");
    throw error;
  }
  const attachments = validateDisputeAttachments(body.attachments, actor.userId);
  const messageResult = await sb.from("coaching_dispute_messages").insert({ dispute_id: dispute.id, author_user_id: actor.userId, author_role: role, message: description, attachments }).select("*").single();
  if (messageResult.error) throw messageResult.error;
  await sb.from("coaching_sessions").update({ status: "disputed" }).eq("id", sessionId);
  const recipient = role === "learner" ? follow.coachProfile.user_id : follow.booking.learner_user_id;
  await invokeNotification("coaching_dispute_opened", { userId: recipient, offer_title: follow.booking.offer_title_snapshot, session_id: sessionId, action_url: role === "learner" ? "/coach/sessions" : "/dashboard/coaching" });
  await audit(sb, actor.userId, "coaching_dispute_opened", "coaching_dispute", String(dispute.id), null, dispute);
  return await enrichDispute(sb, dispute);
}

async function myCoachingDisputes(sb: Supabase, actor: Session) {
  const profileResult = actor.roles.includes("coach") ? await sb.from("coach_profiles").select("id").eq("user_id", actor.userId).maybeSingle() : { data: null };
  let query = sb.from("coaching_disputes").select("*").order("created_at", { ascending: false });
  if (profileResult.data?.id) query = query.or(`learner_user_id.eq.${actor.userId},coach_id.eq.${profileResult.data.id}`);
  else query = query.eq("learner_user_id", actor.userId);
  const { data, error } = await query;
  if (error) throw error;
  return await Promise.all((data || []).map((row: Record<string, unknown>) => enrichDispute(sb, row)));
}

async function addCoachingDisputeMessage(sb: Supabase, actor: Session, body: Record<string, unknown>) {
  const disputeId = asText(body.dispute_id, 80);
  const message = asText(body.message, 4000);
  if (!message) throw new Error("DISPUTE_MESSAGE_REQUIRED");
  const { data: dispute, error } = await sb.from("coaching_disputes").select("*").eq("id", disputeId).maybeSingle();
  if (error) throw error;
  if (!dispute) throw new Error("DISPUTE_NOT_FOUND");
  let role: CoachingDisputeRole;
  if (isAdmin(actor)) role = "admin";
  else if (String(dispute.learner_user_id) === actor.userId) role = "learner";
  else {
    const profile = await ownCoachProfile(sb, actor);
    if (String(dispute.coach_id) !== String(profile.id)) throw new Error("FORBIDDEN");
    role = "coach";
  }
  if (["resolved", "rejected", "closed"].includes(String(dispute.status)) && role !== "admin") throw new Error("DISPUTE_CLOSED");
  const visibility = role === "admin" && body.admin_only === true ? "admin_only" : "participants";
  const result = await sb.from("coaching_dispute_messages").insert({ dispute_id: disputeId, author_user_id: actor.userId, author_role: role, visibility, message, attachments: validateDisputeAttachments(body.attachments, actor.userId) }).select("*").single();
  if (result.error) throw result.error;
  if (visibility === "participants") {
    const recipientIds = role === "learner"
      ? [(await sb.from("coach_profiles").select("user_id").eq("id", dispute.coach_id).maybeSingle()).data?.user_id]
      : role === "coach" ? [dispute.learner_user_id] : [dispute.learner_user_id, (await sb.from("coach_profiles").select("user_id").eq("id", dispute.coach_id).maybeSingle()).data?.user_id];
    for (const userId of recipientIds.filter(Boolean)) await invokeNotification("coaching_dispute_message", { userId, dispute_id: disputeId, action_url: role === "coach" ? "/dashboard/coaching" : "/coach/sessions" });
  }
  return { ...result.data, attachments: await signDisputeAttachments(sb, result.data.attachments) };
}

async function coachRevenueDashboard(sb: Supabase, actor: Session) {
  const profile = await ownCoachProfile(sb, actor);
  const [{ data: earnings, error: earningError }, { data: advancedEarnings }, { data: wallet }, { data: payouts }, { data: settings }] = await Promise.all([
    sb.from("coaching_earnings").select("*,session:coaching_sessions(id,offer_title_snapshot,scheduled_start,status),order:coaching_payment_orders(id,order_number,payment_status)").eq("coach_id", profile.id).order("created_at", { ascending: false }),
    sb.from("coaching_advanced_earnings").select("*,order:coaching_payment_orders(id,order_number,payment_status,offer_title_snapshot,product_type,product_id)").eq("coach_id", profile.id).order("created_at", { ascending: false }),
    sb.from("wallets").select("*").eq("user_id", actor.userId).maybeSingle(),
    sb.from("payout_requests").select("id,amount_xof,channel,status,requested_at,processed_at,paid_at,provider_reference,admin_note").eq("user_id", actor.userId).order("requested_at", { ascending: false }).limit(100),
    sb.from("finance_payout_policy").select("*").eq("id", true).maybeSingle(),
  ]);
  if (earningError) throw earningError;
  const cfg: Record<string, unknown> = settings ? {
    payout_minimum_xof: settings.minimum_xof,
    payout_processing_min: settings.processing_min,
    payout_processing_max: settings.processing_max,
    payout_processing_unit: settings.processing_unit,
    canal_mobile_money: settings.mobile_money_enabled,
    canal_virement_uemoa: settings.bank_transfer_enabled,
    canal_swift: settings.swift_enabled,
  } : {};
  const rows = earnings || [];
  const advancedRows = advancedEarnings || [];
  const netAfterRefund = (row: Record<string, unknown>) => Math.max(0, Number(row.net_amount_xof || 0) - Number(row.refunded_net_xof || 0));
  const sum = (status: string) => rows.filter((row: Record<string, unknown>) => row.status === status).reduce((total: number, row: Record<string, unknown>) => total + netAfterRefund(row), 0) + advancedRows.filter((row: Record<string, unknown>) => row.status === status).reduce((total: number, row: Record<string, unknown>) => total + netAfterRefund(row), 0);
  return {
    profile,
    earnings: rows,
    advanced_earnings: advancedRows,
    wallet: wallet || { balance_xof: 0, reserved_xof: 0, total_earned_xof: 0, total_withdrawn_xof: 0 },
    payouts: payouts || [],
    settings: cfg,
    metrics: { locked_xof: sum("locked"), frozen_xof: sum("frozen"), available_earnings_xof: sum("available"), lifetime_net_xof: rows.reduce((total: number, row: Record<string, unknown>) => total + netAfterRefund(row), 0) + advancedRows.reduce((total: number, row: Record<string, unknown>) => total + netAfterRefund(row), 0) },
  };
}

async function coachCreatePayout(sb: Supabase, actor: Session, body: Record<string, unknown>) {
  await ownCoachProfile(sb, actor);
  const amount = asInteger(body.amount_xof);
  const channel = asText(body.channel, 30);
  if (!amount || !["mobile_money", "bank_transfer", "swift"].includes(channel)) throw new Error("INVALID_PAYOUT");
  const { data: settings } = await sb.from("finance_payout_policy").select("*").eq("id", true).maybeSingle();
  if (!settings) throw new Error("PAYOUT_POLICY_NOT_CONFIGURED");
  const cfg = new Map<string, unknown>([
    ["payout_minimum_xof", settings.minimum_xof],
    ["canal_mobile_money", settings.mobile_money_enabled],
    ["canal_virement_uemoa", settings.bank_transfer_enabled],
    ["canal_swift", settings.swift_enabled],
  ]);
  const minimum = Number(cfg.get("payout_minimum_xof") || 0);
  if (amount < minimum) throw new Error("PAYOUT_AMOUNT_TOO_LOW");
  if (channel === "mobile_money" && settings.mobile_money_enabled !== true) throw new Error("PAYOUT_CHANNEL_DISABLED");
  if (channel === "bank_transfer" && settings.bank_transfer_enabled !== true) throw new Error("PAYOUT_CHANNEL_DISABLED");
  if (channel === "swift" && settings.swift_enabled !== true) throw new Error("PAYOUT_CHANNEL_DISABLED");
  if (channel === "mobile_money" && (!asText(body.mm_operator, 50) || !asText(body.mm_phone, 50))) throw new Error("PAYOUT_DETAILS_REQUIRED");
  if (["bank_transfer", "swift"].includes(channel) && (!asText(body.bank_name, 180) || !asText(body.account_holder, 180) || !asText(body.account_number, 80))) throw new Error("PAYOUT_DETAILS_REQUIRED");
  if (channel === "swift" && !asText(body.swift, 30)) throw new Error("PAYOUT_DETAILS_REQUIRED");
  const { data: id, error } = await sb.rpc("finance_create_payout_request", {
    p_user_id: actor.userId, p_amount_xof: amount, p_channel: channel,
    p_mm_operator: asNullableText(body.mm_operator, 50), p_mm_phone: asNullableText(body.mm_phone, 50),
    p_bank_name: asNullableText(body.bank_name, 180), p_account_holder: asNullableText(body.account_holder, 180),
    p_bank_code: asNullableText(body.bank_code, 30), p_branch_code: asNullableText(body.branch_code, 30),
    p_account_number: asNullableText(body.account_number, 80), p_rib_key: asNullableText(body.rib_key, 20),
    p_iban: asNullableText(body.iban, 80), p_swift: asNullableText(body.swift, 30),
  });
  if (error) {
    if (String(error.message).includes("INSUFFICIENT_AVAILABLE_BALANCE")) throw new Error("PAYOUT_INSUFFICIENT_BALANCE");
    throw error;
  }
  const payout = await sb.from("payout_requests").select("id,amount_xof,channel,status,requested_at").eq("id", id).single();
  if (payout.error) throw payout.error;
  return payout.data;
}

async function adminCoachingDisputes(sb: Supabase) {
  const { data, error } = await sb.from("coaching_disputes").select("*").order("created_at", { ascending: false }).limit(300);
  if (error) throw error;
  return await Promise.all((data || []).map((row: Record<string, unknown>) => enrichDispute(sb, row, true)));
}

async function adminDecideCoachingDispute(sb: Supabase, actor: Session, body: Record<string, unknown>) {
  const disputeId = asText(body.dispute_id, 80);
  const decision = asText(body.decision, 40);
  const reason = asText(body.reason, 3000);
  const allowed = ["refund_full", "refund_partial", "no_refund", "warning", "suspend_coach", "reject"];
  if (!allowed.includes(decision) || !reason) throw new Error("DISPUTE_DECISION_REQUIRED");
  const { data: dispute, error } = await sb.from("coaching_disputes").select("*").eq("id", disputeId).maybeSingle();
  if (error) throw error;
  if (!dispute) throw new Error("DISPUTE_NOT_FOUND");
  if (["resolved", "rejected", "closed"].includes(String(dispute.status))) throw new Error("DISPUTE_CLOSED");
  const { data: order } = dispute.order_id ? await sb.from("coaching_payment_orders").select("*").eq("id", dispute.order_id).maybeSingle() : { data: null };
  let approvedRefund: number | null = null;
  if (decision === "refund_full") approvedRefund = Number(order?.amount_xof || 0);
  if (decision === "refund_partial") {
    approvedRefund = asInteger(body.approved_refund_xof);
    if (approvedRefund === null || approvedRefund <= 0 || approvedRefund > Number(order?.amount_xof || 0)) throw new Error("INVALID_REFUND_AMOUNT");
  }
  if (approvedRefund !== null && order) {
    const { data: existing } = await sb.from("coaching_refund_requests").select("*").eq("session_id", dispute.session_id).in("status", ["pending", "under_review", "approved", "partially_approved"]).maybeSingle();
    const refundPayload = { approved_amount_xof: approvedRefund, requested_amount_xof: approvedRefund, status: approvedRefund >= Number(order.amount_xof) ? "approved" : "partially_approved", decision_reason: reason, decided_by: actor.userId, decided_at: new Date().toISOString() };
    if (existing) {
      const update = await sb.from("coaching_refund_requests").update(refundPayload).eq("id", existing.id);
      if (update.error) throw update.error;
    } else {
      const insert = await sb.from("coaching_refund_requests").insert({ order_id: order.id, session_id: dispute.session_id, user_id: dispute.learner_user_id, coach_id: dispute.coach_id, initiated_by: "admin", reason_code: "dispute_decision", reason_details: reason, policy_snapshot: order.policy_snapshot || {}, ...refundPayload });
      if (insert.error) throw insert.error;
    }
  }
  if (decision === "suspend_coach") {
    await sb.from("coach_profiles").update({ status: "suspended", suspended_by: actor.userId, suspended_at: new Date().toISOString(), suspension_reason: reason }).eq("id", dispute.coach_id);
  }
  const finalStatus = decision === "reject" ? "rejected" : "resolved";
  const result = await sb.from("coaching_disputes").update({ status: finalStatus, decision_code: decision, decision_reason: reason, approved_refund_xof: approvedRefund, decided_by: actor.userId, decided_at: new Date().toISOString(), closed_at: new Date().toISOString() }).eq("id", disputeId).select("*").single();
  if (result.error) throw result.error;
  if (approvedRefund === null) await sb.from("coaching_sessions").update({ status: dispute.previous_session_status }).eq("id", dispute.session_id).eq("status", "disputed");
  await sb.from("coaching_dispute_messages").insert({ dispute_id: disputeId, author_user_id: actor.userId, author_role: "admin", message: `Décision administrative : ${reason}`, visibility: "participants" });
  const coachUser = await sb.from("coach_profiles").select("user_id").eq("id", dispute.coach_id).maybeSingle();
  for (const userId of [dispute.learner_user_id, coachUser.data?.user_id].filter(Boolean)) await invokeNotification("coaching_dispute_resolved", { userId, decision, reason, dispute_id: disputeId, action_url: userId === dispute.learner_user_id ? "/dashboard/coaching" : "/coach/sessions" });
  await audit(sb, actor.userId, "coaching_dispute_resolved", "coaching_dispute", disputeId, dispute, result.data);
  return await enrichDispute(sb, result.data, true);
}

async function adminCoachingRatings(sb: Supabase) {
  const { data: ratings, error } = await sb.from("coaching_ratings").select("*").order("created_at", { ascending: false }).limit(300);
  if (error) throw error;
  const coachIds = [...new Set((ratings || []).map((row: Record<string, unknown>) => String(row.coach_id)))];
  const learnerIds = [...new Set((ratings || []).map((row: Record<string, unknown>) => String(row.learner_user_id)))];
  const [{ data: coaches }, { data: learners }] = await Promise.all([
    coachIds.length ? sb.from("coach_profiles").select("id,user_id,professional_title").in("id", coachIds) : Promise.resolve({ data: [] }),
    learnerIds.length ? sb.from("users").select("id,full_name,email").in("id", learnerIds) : Promise.resolve({ data: [] }),
  ]);
  const coachUsers = [...new Set((coaches || []).map((row: Record<string, unknown>) => String(row.user_id)))];
  const { data: coachUserRows } = coachUsers.length ? await sb.from("users").select("id,full_name,email").in("id", coachUsers) : { data: [] };
  const coachUserMap = new Map((coachUserRows || []).map((row: Record<string, unknown>) => [String(row.id), row]));
  const coachMap = new Map((coaches || []).map((row: Record<string, unknown>) => [String(row.id), { ...row, ...((coachUserMap.get(String(row.user_id)) || {}) as Record<string, unknown>) }]));
  const learnerMap = new Map((learners || []).map((row: Record<string, unknown>) => [String(row.id), row]));
  return (ratings || []).map((row: Record<string, unknown>) => ({ ...row, coach: coachMap.get(String(row.coach_id)) || null, learner: learnerMap.get(String(row.learner_user_id)) || null }));
}

async function adminModerateCoachingRating(sb: Supabase, actor: Session, body: Record<string, unknown>) {
  const ratingId = asText(body.rating_id, 80);
  const status = asText(body.status, 20);
  const reason = asText(body.reason, 1500);
  if (!["published", "hidden", "removed"].includes(status)) throw new Error("INVALID_RATING_STATUS");
  if (status !== "published" && !reason) throw new Error("RATING_MODERATION_REASON_REQUIRED");
  const current = await sb.from("coaching_ratings").select("*").eq("id", ratingId).maybeSingle();
  if (current.error) throw current.error;
  if (!current.data) throw new Error("RATING_NOT_FOUND");
  const result = await sb.from("coaching_ratings").update({ moderation_status: status, moderation_reason: status === "published" ? null : reason, moderated_by: actor.userId, moderated_at: new Date().toISOString() }).eq("id", ratingId).select("*").single();
  if (result.error) throw result.error;
  await audit(sb, actor.userId, "coaching_rating_moderated", "coaching_rating", ratingId, current.data, result.data);
  return result.data;
}

async function adminCoachingRevenue(sb: Supabase) {
  const [{ data: earnings, error }, { data: advancedEarnings }, { data: wallets }, { data: payouts }] = await Promise.all([
    sb.from("coaching_earnings").select("*,session:coaching_sessions(id,offer_title_snapshot,coach_name_snapshot,scheduled_start,status),order:coaching_payment_orders(id,order_number,payment_status)").order("created_at", { ascending: false }).limit(500),
    sb.from("coaching_advanced_earnings").select("*,order:coaching_payment_orders(id,order_number,payment_status,offer_title_snapshot,product_type,product_id)").order("created_at", { ascending: false }).limit(500),
    sb.from("wallets").select("id,user_id,balance_xof,reserved_xof,total_earned_xof,total_withdrawn_xof"),
    sb.from("payout_requests").select("id,user_id,amount_xof,status,requested_at,paid_at,channel").order("requested_at", { ascending: false }).limit(300),
  ]);
  if (error) throw error;
  const coachUserIds = [...new Set([...(earnings || []), ...(advancedEarnings || [])].map((row: Record<string, unknown>) => String(row.coach_user_id)))];
  const { data: users } = coachUserIds.length ? await sb.from("users").select("id,full_name,email").in("id", coachUserIds) : { data: [] };
  const byId = new Map((users || []).map((row: Record<string, unknown>) => [String(row.id), row]));
  const rows = (earnings || []).map((row: Record<string, unknown>) => ({ ...row, coach_user: byId.get(String(row.coach_user_id)) || null }));
  const advancedRows = (advancedEarnings || []).map((row: Record<string, unknown>) => ({ ...row, coach_user: byId.get(String(row.coach_user_id)) || null }));
  const allRows = [...rows, ...advancedRows];
  const net = (row: Record<string, unknown>) => Math.max(0, Number(row.net_amount_xof || 0) - Number(row.refunded_net_xof || 0));
  return {
    earnings: rows,
    advanced_earnings: advancedRows,
    wallets: wallets || [],
    payouts: (payouts || []).filter((row: Record<string, unknown>) => coachUserIds.includes(String(row.user_id))),
    metrics: {
      locked_xof: allRows.filter((r: Record<string, unknown>) => r.status === "locked").reduce((s: number, r: Record<string, unknown>) => s + net(r), 0),
      frozen_xof: allRows.filter((r: Record<string, unknown>) => r.status === "frozen").reduce((s: number, r: Record<string, unknown>) => s + net(r), 0),
      credited_xof: allRows.filter((r: Record<string, unknown>) => r.status === "available").reduce((s: number, r: Record<string, unknown>) => s + net(r), 0),
      commission_xof: allRows.reduce((s: number, r: Record<string, unknown>) => {
        const gross = Math.max(0, Number(r.gross_amount_xof || 0) - Number(r.refunded_gross_xof || 0));
        const coachNet = Math.max(0, Number(r.net_amount_xof || 0) - Number(r.refunded_net_xof || 0));
        return s + Math.max(0, gross - coachNet);
      }, 0),
    },
  };
}

async function adminSavePerformanceSettings(sb: Supabase, actor: Session, body: Record<string, unknown>) {
  const payload = {
    rating_window_days: asInteger(body.rating_window_days),
    rating_invitation_delay_minutes: asInteger(body.rating_invitation_delay_minutes),
    warning_rating_threshold: Number(body.warning_rating_threshold),
    warning_minimum_reviews: asInteger(body.warning_minimum_reviews),
    suspension_rating_threshold: Number(body.suspension_rating_threshold),
    suspension_minimum_reviews: asInteger(body.suspension_minimum_reviews),
    automatic_rating_suspension_enabled: asBoolean(body.automatic_rating_suspension_enabled),
  };
  if (!payload.rating_window_days || payload.rating_invitation_delay_minutes === null || !payload.warning_minimum_reviews || !payload.suspension_minimum_reviews || !Number.isFinite(payload.warning_rating_threshold) || payload.warning_rating_threshold < 0 || payload.warning_rating_threshold > 5 || !Number.isFinite(payload.suspension_rating_threshold) || payload.suspension_rating_threshold < 0 || payload.suspension_rating_threshold > 5) throw new Error("INVALID_PERFORMANCE_SETTINGS");
  const before = await performanceSettings(sb);
  const result = await sb.from("coaching_settings").update(payload).eq("id", 1).select("*").single();
  if (result.error) throw result.error;
  await audit(sb, actor.userId, "coaching_performance_settings_updated", "coaching_settings", null, before, payload);
  return await performanceSettings(sb);
}


type AdvancedProductType = "group";

type AdvancedOrderContext = {
  productType: AdvancedProductType;
  productId: string;
  title: string;
  description: string;
  amountXof: number;
  coachId: string | null;
  coachName: string;
  commissionPercent: number;
  commissionAmount: number;
  coachNet: number;
  returnPath: string;
  snapshot: Record<string, unknown>;
};

async function advancedSettings(sb: Supabase) {
  const { data, error } = await sb.from("coaching_settings").select("*").eq("id", 1).single();
  if (error) throw error;
  return data as Record<string, unknown>;
}

async function learnerPreferences(sb: Supabase, actor: Session) {
  const { data, error } = await sb.from("learner_coaching_preferences").select("*").eq("user_id", actor.userId).maybeSingle();
  if (error) throw error;
  return data || {
    user_id: actor.userId,
    domain_ids: [],
    languages: ["Français"],
    goals: [],
    budget_min_xof: 0,
    budget_max_xof: null,
    meeting_modes: ["jitsi", "external"],
    preferred_formats: ["individual"],
  };
}

async function saveLearnerPreferences(sb: Supabase, actor: Session, body: Record<string, unknown>) {
  const domainIds = asStringArray(body.domain_ids, 20, 80);
  if (domainIds.length) {
    const { data } = await sb.from("coaching_domains").select("id").in("id", domainIds).eq("is_active", true);
    if ((data || []).length !== domainIds.length) throw new Error("INVALID_DOMAIN");
  }
  const minBudget = asInteger(body.budget_min_xof) ?? 0;
  const maxBudget = asInteger(body.budget_max_xof);
  if (maxBudget !== null && maxBudget < minBudget) throw new Error("INVALID_PRICE_RANGE");
  const meetingModes = asStringArray(body.meeting_modes, 2, 20).filter((v) => ["jitsi", "external"].includes(v));
  const formats = asStringArray(body.preferred_formats, 2, 20).filter((v) => ["individual", "group"].includes(v));
  const payload = {
    user_id: actor.userId,
    domain_ids: domainIds,
    languages: asStringArray(body.languages, 12, 80),
    goals: asStringArray(body.goals, 15, 180),
    budget_min_xof: minBudget,
    budget_max_xof: maxBudget,
    meeting_modes: meetingModes.length ? meetingModes : ["jitsi", "external"],
    preferred_formats: formats.length ? formats : ["individual"],
  };
  const { data, error } = await sb.from("learner_coaching_preferences").upsert(payload, { onConflict: "user_id" }).select("*").single();
  if (error) throw error;
  return data;
}

async function learnerAdvancedDashboard(sb: Supabase, actor: Session) {
  const [preferences, groups, plans] = await Promise.all([
    learnerPreferences(sb, actor),
    sb.from("coaching_group_registrations").select("*,program:coaching_group_programs(*,coach:coach_profiles(id,user_id,public_slug,professional_title))").eq("user_id", actor.userId).order("created_at", { ascending: false }),
    sb.from("coaching_action_plans").select("*,items:coaching_action_items(*)").eq("learner_user_id", actor.userId).eq("learner_visible", true).order("updated_at", { ascending: false }),
  ]);
  return { preferences, groups: groups.data || [], action_plans: plans.data || [] };
}

function normalizedWords(values: unknown[]): Set<string> {
  const words = new Set<string>();
  for (const value of values) {
    const text = String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    for (const word of text.split(/[^a-z0-9]+/).filter((item) => item.length > 2)) words.add(word);
  }
  return words;
}

async function coachingRecommendations(sb: Supabase, actor: Session) {
  const settings = await advancedSettings(sb);
  if (settings.recommendations_enabled === false) return { preferences: await learnerPreferences(sb, actor), recommendations: [], source_categories: [] };
  const preferences = await learnerPreferences(sb, actor) as Record<string, unknown>;
  const [{ data: enrollments }, coaches] = await Promise.all([
    sb.from("user_enrollments").select("course_id,courses(category,title)").eq("user_id", actor.userId),
    publicCoaches(sb, true),
  ]);
  const coachRows = coaches as Array<Record<string, unknown>>;
  const coachIds = coachRows.map((coach) => String(coach.id));
  const [{ data: offerRows }, { data: availabilityRows }] = coachIds.length
    ? await Promise.all([
        sb.from("coach_offers").select("id,coach_id,price_xof,hourly_price_xof,session_modes,status").in("coach_id", coachIds).eq("status", "active"),
        sb.from("coach_availability_rules").select("coach_id").in("coach_id", coachIds).eq("is_active", true),
      ])
    : [{ data: [] }, { data: [] }];
  const availableCoachIds = new Set((availabilityRows || []).map((row: Record<string, unknown>) => String(row.coach_id)));
  const offersByCoach = new Map<string, Array<Record<string, unknown>>>();
  for (const offer of offerRows || []) {
    const coachId = String((offer as Record<string, unknown>).coach_id);
    offersByCoach.set(coachId, [...(offersByCoach.get(coachId) || []), offer as Record<string, unknown>]);
  }
  const courseCategories = (enrollments || []).flatMap((row: Record<string, unknown>) => {
    const course = row.courses as Record<string, unknown> | null;
    return course ? [String(course.category || ""), String(course.title || "")] : [];
  }).filter(Boolean);
  const goals = Array.isArray(preferences.goals) ? preferences.goals : [];
  const interestWords = normalizedWords([...goals, ...courseCategories]);
  const preferredDomains = new Set(asStringArray(preferences.domain_ids, 30, 80));
  const preferredLanguages = new Set(asStringArray(preferences.languages, 20, 80).map((v) => v.toLowerCase()));
  const preferredModes = new Set(asStringArray(preferences.meeting_modes, 5, 20));
  const minBudget = Number(preferences.budget_min_xof || 0);
  const maxBudget = preferences.budget_max_xof === null || preferences.budget_max_xof === undefined ? null : Number(preferences.budget_max_xof);
  const weights = (settings.matching_weights || {}) as Record<string, unknown>;
  const priorityBonus = 0;
  const rows = coachRows.filter((coach) => String(coach.user_id) !== actor.userId).map((coach) => {
    let score = priorityBonus;
    const reasons: string[] = [];
    const domains = (coach.domains || []) as Array<Record<string, unknown>>;
    const domainMatch = domains.filter((domain) => preferredDomains.has(String(domain.id)));
    if (domainMatch.length) { score += Number(weights.domains || 40); reasons.push(`Domaine : ${domainMatch.map((d) => d.name).join(", ")}`); }
    const specialties = Array.isArray(coach.specialties) ? coach.specialties : [];
    const coachWords = normalizedWords([coach.professional_title, coach.biography, ...specialties, ...domains.map((d) => d.name)]);
    const sharedWords = [...interestWords].filter((word) => coachWords.has(word));
    if (sharedWords.length) { score += Math.min(20, sharedWords.length * 4); reasons.push("Correspond à vos objectifs et formations"); }
    const languages = asStringArray(coach.languages, 20, 80).map((v) => v.toLowerCase());
    if (languages.some((lang) => preferredLanguages.has(lang))) { score += Number(weights.languages || 20); reasons.push("Langue compatible"); }
    const offers = offersByCoach.get(String(coach.id)) || [];
    const prices = offers.map((offer) => Number(offer.price_xof || offer.hourly_price_xof || 0)).filter((price) => Number.isFinite(price) && price >= 0);
    const minPrice = prices.length ? Math.min(...prices) : null;
    if (minPrice !== null && minPrice >= minBudget && (maxBudget === null || minPrice <= maxBudget)) { score += Number(weights.budget || 15); reasons.push("Dans votre budget"); }
    if (offers.some((offer) => asStringArray(offer.session_modes, 5, 20).some((mode) => preferredModes.has(mode)))) score += 5;
    if (availableCoachIds.has(String(coach.id)) && coach.vacation_mode !== true) {
      score += Number(weights.availability || 10);
      reasons.push("Disponibilités configurées");
    }
    const rating = Number(coach.average_rating || 0);
    score += Math.round((rating / 5) * Number(weights.rating || 15));
    if (rating >= 4.5 && Number(coach.rating_count || 0) >= 3) reasons.push("Très bien évalué");
    return { coach: { ...coach, offers }, score: Math.min(100, Math.round(score)), reasons: [...new Set(reasons)].slice(0, 4), minimum_price_xof: minPrice };
  }).sort((a, b) => b.score - a.score || Number((b.coach as Record<string, unknown>).average_rating || 0) - Number((a.coach as Record<string, unknown>).average_rating || 0)).slice(0, 12);
  return { preferences, recommendations: rows, source_categories: courseCategories.slice(0, 12) };
}

async function publicAdvancedCatalogue(sb: Supabase) {
  const now = new Date().toISOString();
  const [{ data: groups }, domains] = await Promise.all([
    sb.from("coaching_group_programs").select("*,coach:coach_profiles(id,user_id,public_slug,professional_title,photo_url,average_rating,rating_count),domain:coaching_domains(id,slug,name),registrations:coaching_group_registrations(id,status)").in("status", ["active", "full"]).gt("scheduled_start", now).order("scheduled_start"),
    getDomains(sb),
  ]);
  const coachUserIds = [...new Set((groups || []).map((row: Record<string, unknown>) => String((row.coach as Record<string, unknown> | null)?.user_id || "")).filter(Boolean))];
  const { data: users } = coachUserIds.length ? await sb.from("users").select("id,full_name").in("id", coachUserIds) : { data: [] };
  const names = new Map((users || []).map((u: Record<string, unknown>) => [String(u.id), String(u.full_name || "Coach Omnia")]));
  const enrich = (row: Record<string, unknown>) => { const coach = (row.coach || {}) as Record<string, unknown>; return { ...row, coach: { ...coach, full_name: names.get(String(coach.user_id)) || "Coach Omnia" } }; };
  return {
    groups: (groups || []).map((row: Record<string, unknown>) => sanitizePublicGroup({ ...enrich(row), confirmed_count: ((row.registrations || []) as Array<Record<string, unknown>>).filter((r) => ["confirmed", "attended"].includes(String(r.status))).length })),
    domains,
  };
}

async function coachAdvancedProducts(sb: Supabase, actor: Session) {
  const profile = await ownCoachProfile(sb, actor);
  const { data: groups } = await sb.from("coaching_group_programs").select("*,domain:coaching_domains(id,slug,name)").eq("coach_id", profile.id).order("scheduled_start", { ascending: false });
  const groupIds = (groups || []).map((row: Record<string, unknown>) => String(row.id));
  const { data: registrations } = groupIds.length ? await sb.from("coaching_group_registrations").select("*,program:coaching_group_programs(id,coach_id,title,scheduled_start),user:users(id,full_name,email)").in("program_id", groupIds).order("created_at", { ascending: false }) : { data: [] };
  return { profile, groups: groups || [], group_registrations: registrations || [], domains: await getDomains(sb) };
}

async function saveCoachGroup(sb: Supabase, actor: Session, body: Record<string, unknown>) {
  const profile = await ownCoachProfile(sb, actor);
  const id = asNullableText(body.id, 80);
  const title = asText(body.title, 180);
  const start = asIsoDate(body.scheduled_start);
  const end = asIsoDate(body.scheduled_end);
  const capacity = asInteger(body.capacity);
  const price = asInteger(body.price_per_participant_xof);
  const mode = asText(body.meeting_mode, 20);
  if (!title || !start || !end || new Date(start) >= new Date(end) || !capacity || capacity < 2 || capacity > 5 || price === null || !["jitsi", "external"].includes(mode)) throw new Error("GROUP_INCOMPLETE");
  const limits = await coachPriceLimits(sb, profile);
  if (price < limits.minimum || (limits.maximum !== null && price > limits.maximum)) throw new Error("OFFER_PRICE_OUT_OF_RANGE");
  const payload = { coach_id: profile.id, domain_id: asNullableText(body.domain_id, 80), title, description: asText(body.description, 3000), scheduled_start: start, scheduled_end: end, capacity, price_per_participant_xof: price, meeting_mode: mode, external_meeting_url: mode === "external" ? asNullableText(body.external_meeting_url, 1000) : null, status: "pending", admin_message: null, reviewed_by: null, reviewed_at: null };
  if (payload.external_meeting_url && !isHttpUrl(payload.external_meeting_url)) throw new Error("INVALID_MEETING_URL");
  if (id) {
    const current = await sb.from("coaching_group_programs").select("*").eq("id", id).eq("coach_id", profile.id).maybeSingle();
    if (!current.data) throw new Error("GROUP_NOT_FOUND");
    if (["in_progress","completed"].includes(String(current.data.status))) throw new Error("GROUP_CANNOT_EDIT");
    const { data, error } = await sb.from("coaching_group_programs").update(payload).eq("id", id).select("*").single(); if (error) throw error; return data;
  }
  const { data, error } = await sb.from("coaching_group_programs").insert(payload).select("*").single(); if (error) throw error; return data;
}

async function adminAdvancedProducts(sb: Supabase) {
  const [{ data: groups }, { data: recordings }, settings] = await Promise.all([
    sb.from("coaching_group_programs").select("*,coach:coach_profiles(id,user_id,public_slug,professional_title),domain:coaching_domains(id,name)").order("scheduled_start", { ascending: false }),
    sb.from("coaching_recordings").select("*,session:coaching_sessions(id,offer_title_snapshot,coach_name_snapshot,scheduled_start)").order("created_at", { ascending: false }).limit(200),
    advancedSettings(sb),
  ]);
  const userIds = [...new Set((groups || []).map((r: Record<string, unknown>) => String((r.coach as Record<string, unknown> | null)?.user_id || "")).filter(Boolean))];
  const { data: users } = userIds.length ? await sb.from("users").select("id,full_name").in("id", userIds) : { data: [] };
  const names = new Map((users || []).map((u: Record<string, unknown>) => [String(u.id), String(u.full_name || "Coach Omnia")]));
  const enrich = (row: Record<string, unknown>) => { const coach=(row.coach||{}) as Record<string,unknown>; return {...row,coach:{...coach,full_name:names.get(String(coach.user_id))||"Coach Omnia"}}; };
  return { groups: (groups || []).map(enrich), recordings: recordings || [], settings };
}

async function adminReviewAdvanced(sb: Supabase, actor: Session, body: Record<string, unknown>) {
  const productType = asText(body.product_type, 30);
  const productId = asText(body.product_id, 80);
  const decision = asText(body.decision, 30);
  const table = productType === "group" ? "coaching_group_programs" : "";
  if (!table || !productId || !["approve","reject","inactive","archive"].includes(decision)) throw new Error("INVALID_REVIEW");
  const current = await sb.from(table).select("*").eq("id", productId).maybeSingle();
  if (!current.data) throw new Error("GROUP_NOT_FOUND");
  const message = asNullableText(body.message, 2000);
  if (decision === "reject" && !message) throw new Error("REVIEW_MESSAGE_REQUIRED");
  const status = decision === "approve" ? "active" : decision === "reject" ? "rejected" : decision === "inactive" ? "inactive" : "archived";
  const { data, error } = await sb.from(table).update({ status, admin_message: message, reviewed_by: actor.userId, reviewed_at: new Date().toISOString() }).eq("id", productId).select("*").single();
  if (error) throw error;
  await audit(sb, actor.userId, `${productType}_${status}`, productType, productId, current.data, data);
  return data;
}

async function resolveAdvancedOrderContext(sb: Supabase, actor: Session, body: Record<string, unknown>): Promise<AdvancedOrderContext> {
  const productType = asText(body.product_type, 30) as AdvancedProductType;
  const productId = asText(body.product_id, 80);
  if (!productId || productType !== "group") throw new Error("ADVANCED_PRODUCT_REQUIRED");
  let registrationId = asNullableText(body.registration_id, 80);
  if (!registrationId) {
    const existing = await sb.from("coaching_group_registrations").select("id,status,hold_expires_at").eq("program_id", productId).eq("user_id", actor.userId).in("status", ["pending_payment","confirmed","attended"]).maybeSingle();
    if (existing.data?.status === "confirmed" || existing.data?.status === "attended") throw new Error("GROUP_ALREADY_REGISTERED");
    if (existing.data?.status === "pending_payment" && (!existing.data.hold_expires_at || new Date(String(existing.data.hold_expires_at)).getTime() > Date.now())) registrationId = String(existing.data.id);
    if (!registrationId) {
      const settings = await advancedSettings(sb);
      const rpc = await sb.rpc("coaching_reserve_group_seat", { p_program_id: productId, p_user_id: actor.userId, p_hold_minutes: Number(settings.slot_hold_minutes || 15) });
      if (rpc.error) throw new Error(String(rpc.error.message || "GROUP_NOT_AVAILABLE").includes("GROUP_FULL") ? "GROUP_FULL" : String(rpc.error.message || "GROUP_NOT_AVAILABLE").includes("GROUP_ALREADY_REGISTERED") ? "GROUP_ALREADY_REGISTERED" : "GROUP_NOT_AVAILABLE");
      registrationId = String(rpc.data);
    }
  }
  const { data: registration } = await sb.from("coaching_group_registrations").select("*,program:coaching_group_programs(*,coach:coach_profiles(*))").eq("id", registrationId).eq("user_id", actor.userId).maybeSingle();
  if (!registration) throw new Error("GROUP_REGISTRATION_NOT_FOUND");
  const program = registration.program as Record<string, unknown>; const coach = program.coach as Record<string, unknown>;
  if (!["active","full"].includes(String(program.status)) || new Date(String(program.scheduled_start)).getTime() <= Date.now()) throw new Error("GROUP_NOT_AVAILABLE");
  const limits = await coachPriceLimits(sb, coach); const amount = Number(program.price_per_participant_xof);
  const commissionTerms = await centralCoachingCommission(sb, String(coach.user_id), amount, limits.commission, "group");
  const commission = Math.min(amount, Math.round(amount * commissionTerms.percent / 100) + commissionTerms.fixedFeeXof);
  const effectiveCommissionPercent = amount > 0 ? Number(((commission / amount) * 100).toFixed(2)) : 0;
  await sb.from("coaching_group_registrations").update({ commission_percent_snapshot: effectiveCommissionPercent, commission_amount_xof: commission, coach_net_xof: amount-commission }).eq("id", registration.id);
  const { data: coachUser } = await sb.from("users").select("full_name").eq("id", coach.user_id).maybeSingle();
  return { productType, productId: String(registration.id), title: String(program.title), description: "Coaching collectif", amountXof: amount, coachId: String(program.coach_id), coachName: String(coachUser?.full_name || "Coach Omnia"), commissionPercent: effectiveCommissionPercent, commissionAmount: commission, coachNet: amount-commission, returnPath: `/coaching/groupes/${program.id}/room`, snapshot: { ...program, registration_id: registration.id, commission_source: commissionTerms.source, commission_fixed_fee_xof: commissionTerms.fixedFeeXof } };
}
function advancedOrderNumber(_type: AdvancedProductType) {
  return `OGA-COACH-GRP-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0,10).toUpperCase()}`;
}

async function advancedCheckout(sb: Supabase, actor: Session, body: Record<string, unknown>) {
  const context = await resolveAdvancedOrderContext(sb, actor, body);
  const existing = await sb.from("coaching_payment_orders").select("*").eq("user_id", actor.userId).eq("product_type", context.productType).eq("product_id", context.productId).in("payment_status", ["pending","paid"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (existing.data?.payment_status === "paid") return { order: existing.data, already_paid: true, payment_url: null };
  const { data: user } = await sb.from("users").select("id,full_name,email,phone_number,country_code,status").eq("id", actor.userId).maybeSingle();
  if (!user || user.status !== "actif") throw new Error("SESSION_INVALID");
  const paymentChannel = asText(body.payment_channel, 30) || "web";
  const nativePlatform = asText(body.platform, 20);
  const nativeStore = paymentChannel === "native_store" && ["android", "ios"].includes(nativePlatform);
  const paymentProvider = nativeStore ? (nativePlatform === "android" ? "google_play" : "app_store") : "fedapay";
  const orderNumber = existing.data?.order_number || advancedOrderNumber(context.productType);
  const idempotencyKey = existing.data?.idempotency_key || await sha256Hex(`${actor.userId}:${context.productType}:${context.productId}:${orderNumber}`);
  const orderPayload = { order_number: orderNumber, session_id: null, user_id: actor.userId, coach_id: context.coachId, amount_xof: context.amountXof, currency: "XOF", payment_status: "pending", payment_provider: paymentProvider, idempotency_key: idempotencyKey, commission_percent_snapshot: context.commissionPercent, commission_amount_xof: context.commissionAmount, coach_net_xof: context.coachNet, offer_title_snapshot: context.title, coach_name_snapshot: context.coachName, session_start_snapshot: context.productType === "group" ? context.snapshot.scheduled_start : null, session_end_snapshot: context.productType === "group" ? context.snapshot.scheduled_end : null, policy_snapshot: { source: "coaching_module_6" }, product_type: context.productType, product_id: context.productId, product_snapshot: context.snapshot };
  const result = existing.data ? await sb.from("coaching_payment_orders").update(orderPayload).eq("id", existing.data.id).select("*").single() : await sb.from("coaching_payment_orders").insert(orderPayload).select("*").single();
  if (result.error) throw result.error;
  const order = result.data;
  if (context.productType === "group") await sb.from("coaching_group_registrations").update({ order_id: order.id }).eq("id", context.productId);
  if (context.amountXof === 0) {
    const freeReference = `FREE-${order.order_number}`;
    const confirmed = await sb.rpc("coaching_confirm_advanced_payment", { p_order_id: order.id, p_provider_transaction_id: freeReference, p_provider_reference: freeReference, p_provider_metadata: { source: "free_advanced_product" } });
    if (confirmed.error) throw confirmed.error;
    await requestCoachingInvoice(order.id);
    await invokeNotification("coaching_advanced_purchase_confirmed", { userId: actor.userId, product_type: context.productType, product_title: context.title, amount_xof: 0, action_url: context.returnPath });
    if (context.coachId) {
      const { data: coach } = await sb.from("coach_profiles").select("user_id").eq("id", context.coachId).maybeSingle();
      if (coach?.user_id) await invokeNotification("coaching_advanced_sale", { userId: coach.user_id, product_type: context.productType, product_title: context.title, amount_xof: 0, action_url: "/coach/produits" });
    }
    const { data: paidOrder } = await sb.from("coaching_payment_orders").select("*").eq("id", order.id).single();
    return { order: paidOrder || { ...order, payment_status: "paid", provider_transaction_id: freeReference }, payment_url: null, already_paid: true, free_order: true };
  }
  if (nativeStore) return { order, payment_url: null, already_paid: false, native_store: true, platform: nativePlatform };
  const fedaKey = fedaPaySecretKey(); if (!fedaKey) throw new Error("PAYMENT_CONFIGURATION_MISSING");
  const apiBase = fedaPayApiBase();
  const appUrl = (Deno.env.get("APP_URL") || "https://omniaglobalacademy.com").replace(/\/$/, "");
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  const names = String(user.full_name || "").trim().split(/\s+/); const firstname = names.shift() || String(user.email).split("@")[0]; const lastname = names.join(" ") || "-";
  const metadata = { resource_type: "coaching_advanced", coaching_order_id: order.id, product_type: context.productType, product_id: context.productId, user_id: actor.userId };
  const transactionResponse = await fetch(`${apiBase}/transactions`, { method: "POST", headers: { Authorization: `Bearer ${fedaKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ description: `Omnia Coaching — ${context.title}`, amount: context.amountXof, currency: { iso: "XOF" }, callback_url: `${supabaseUrl}/functions/v1/fedapay-webhook`, return_url: `${appUrl}/coaching/avance/paiement/${order.id}?retour=fedapay`, cancel_url: `${appUrl}/coaching/avance/paiement/${order.id}?annule=1`, merchant_reference: `${order.order_number}-${Date.now().toString().slice(-6)}`, custom_metadata: metadata, metadata, customer: { email: user.email, firstname, lastname, ...(user.phone_number && user.country_code ? { phone_number: { number: user.phone_number, country: user.country_code } } : {}) } }) });
  if (!transactionResponse.ok) { const detail=await transactionResponse.text().catch(()=>""); await sb.from("coaching_payment_orders").update({payment_status:"failed",failed_at:new Date().toISOString(),provider_metadata:{initialization_error:detail.slice(0,1000)}}).eq("id",order.id); throw new Error("PAYMENT_INIT_FAILED"); }
  const transactionData=await transactionResponse.json(); const transaction=transactionData.v1Transaction||transactionData.transaction||transactionData; const providerId=transaction?.id?String(transaction.id):""; if(!providerId) throw new Error("PAYMENT_INIT_FAILED");
  const tokenResponse=await fetch(`${apiBase}/transactions/${providerId}/token`,{method:"POST",headers:{Authorization:`Bearer ${fedaKey}`,"Content-Type":"application/json"}}); if(!tokenResponse.ok) throw new Error("PAYMENT_LINK_FAILED"); const tokenData=await tokenResponse.json(); const paymentUrl=String(tokenData.url||tokenData.token_url||""); if(!paymentUrl) throw new Error("PAYMENT_LINK_FAILED");
  await sb.from("coaching_payment_orders").update({provider_transaction_id:providerId,provider_reference:transaction?.reference||null,provider_metadata:transactionData}).eq("id",order.id);
  return { order: { ...order, provider_transaction_id: providerId }, payment_url: paymentUrl, already_paid: false };
}


async function storePaymentFinalize(sb: Supabase, actor: Session, body: Record<string, unknown>) {
  if (!isService(actor)) throw new Error("SERVICE_ONLY");
  const orderId = asText(body.order_id, 80);
  const { data: order, error } = await sb.from("coaching_payment_orders").select("*").eq("id", orderId).maybeSingle();
  if (error) throw error;
  if (!order) throw new Error("COACHING_ORDER_NOT_FOUND");
  if (order.payment_status === "paid") return { order, already_completed: true };
  if (!["google_play", "app_store"].includes(String(order.payment_provider || ""))) throw new Error("STORE_ORDER_PROVIDER_MISMATCH");
  const advanced = String(order.product_type || "session") !== "session";
  if (!advanced) throw new Error("STORE_ONE_TO_ONE_EXTERNAL_SERVICE");
  const rpcName = "coaching_confirm_advanced_payment";
  const providerTransactionId = asText(body.provider_transaction_id, 500);
  const providerReference = asNullableText(body.provider_reference, 500);
  const { data: confirmation, error: confirmationError } = await sb.rpc(rpcName, {
    p_order_id: order.id,
    p_provider_transaction_id: providerTransactionId,
    p_provider_reference: providerReference,
    p_provider_metadata: body.provider_metadata || {},
  });
  if (confirmationError) throw confirmationError;
  await requestCoachingInvoice(order.id);
  if (advanced) {
    await invokeNotification("coaching_advanced_purchase_confirmed", { userId: order.user_id, product_type: order.product_type, product_title: order.offer_title_snapshot, amount_xof: order.amount_xof, action_url: "/dashboard/coaching/avance" });
    if (order.coach_id) {
      const { data: coach } = await sb.from("coach_profiles").select("user_id").eq("id", order.coach_id).maybeSingle();
      if (coach?.user_id) await invokeNotification("coaching_advanced_sale", { userId: coach.user_id, product_type: order.product_type, product_title: order.offer_title_snapshot, amount_xof: order.amount_xof, action_url: "/coach/produits" });
    }
  } else {
    const [{ data: booking }, { data: learner }, { data: coach }] = await Promise.all([
      sb.from("coaching_sessions").select("*").eq("id", order.session_id).maybeSingle(),
      sb.from("users").select("full_name,email").eq("id", order.user_id).maybeSingle(),
      sb.from("coach_profiles").select("user_id").eq("id", order.coach_id).maybeSingle(),
    ]);
    if (booking) {
      await invokeNotification("coaching_booking_confirmed", { userId: order.user_id, session_id: booking.id, coach_name: booking.coach_name_snapshot, offer_title: booking.offer_title_snapshot, scheduled_start: booking.scheduled_start, duration_minutes: booking.duration_minutes, amount_xof: order.amount_xof, action_url: "/dashboard/coaching" });
      if (coach?.user_id) await invokeNotification("coaching_new_booking", { userId: coach.user_id, learner_name: learner?.full_name || learner?.email || "Apprenant", session_id: booking.id, offer_title: booking.offer_title_snapshot, scheduled_start: booking.scheduled_start, duration_minutes: booking.duration_minutes, amount_xof: order.amount_xof, action_url: "/coach/sessions" });
    }
  }
  const { data: paidOrder } = await sb.from("coaching_payment_orders").select("*").eq("id", order.id).single();
  return { order: paidOrder, confirmation };
}

async function advancedPaymentStatus(sb: Supabase, actor: Session, body: Record<string, unknown>) {
  const orderId = asText(body.order_id, 80);
  const { data: order, error } = await sb.from("coaching_payment_orders").select("*").eq("id", orderId).eq("user_id", actor.userId).maybeSingle();
  if (error) throw error; if (!order || order.product_type === "session") throw new Error("COACHING_ORDER_NOT_FOUND");
  const { data: invoice } = await sb.from("coaching_invoices").select("id,invoice_number,issued_at,amount_xof,currency").eq("order_id", order.id).maybeSingle();
  let product: unknown = null;
  const legacyProduct = ["package", "subscription"].includes(String(order.product_type));
  if (order.product_type === "group") product = (await sb.from("coaching_group_registrations").select("*,program:coaching_group_programs(*)").eq("order_id", order.id).maybeSingle()).data;
  return { order, invoice: invoice || null, product, legacy_product: legacyProduct };
}

async function actionPlanForSession(sb: Supabase, actor: Session, body: Record<string, unknown>) {
  const sessionId=asText(body.session_id,80); const access=await coachingSessionAccess(sb,actor,sessionId);
  const {data:plan}=await sb.from("coaching_action_plans").select("*,items:coaching_action_items(*)").eq("session_id",sessionId).maybeSingle();
  if(plan && access.role==="learner" && plan.learner_visible===false) return {plan:null,role:access.role};
  return {plan:plan||null,role:access.role,session:access.booking};
}

async function actionPlanSave(sb: Supabase, actor: Session, body: Record<string, unknown>) {
  const sessionId=asText(body.session_id,80); const access=await coachingSessionAccess(sb,actor,sessionId); if(!["coach","admin_supervisor"].includes(access.role)) throw new Error("FORBIDDEN");
  const title=asText(body.title,180); if(!title) throw new Error("ACTION_PLAN_INCOMPLETE");
  const payload={session_id:sessionId,coach_id:access.booking.coach_id,learner_user_id:access.booking.learner_user_id,title,summary:asText(body.summary,4000),next_session_recommendation:asNullableText(body.next_session_recommendation,2500),status:["active","completed","archived"].includes(asText(body.status,20))?asText(body.status,20):"active",learner_visible:asBoolean(body.learner_visible,true),created_by:actor.userId};
  const {data,error}=await sb.from("coaching_action_plans").upsert(payload,{onConflict:"session_id"}).select("*").single(); if(error) throw error;
  return data;
}

async function actionItemSave(sb: Supabase, actor: Session, body: Record<string, unknown>) {
  const planId=asText(body.plan_id,80); const {data:plan}=await sb.from("coaching_action_plans").select("*").eq("id",planId).maybeSingle(); if(!plan) throw new Error("ACTION_PLAN_NOT_FOUND");
  const access=await coachingSessionAccess(sb,actor,String(plan.session_id)); const id=asNullableText(body.id,80);
  if(access.role==="learner"){
    if(!id) throw new Error("FORBIDDEN"); const status=asText(body.status,20); if(!["todo","in_progress","done","skipped"].includes(status)) throw new Error("INVALID_STATUS");
    const {data,error}=await sb.from("coaching_action_items").update({status,completed_at:status==="done"?new Date().toISOString():null}).eq("id",id).eq("plan_id",planId).select("*").single(); if(error) throw error; return data;
  }
  if(!["coach","admin_supervisor"].includes(access.role)) throw new Error("FORBIDDEN"); const title=asText(body.title,220); if(!title) throw new Error("ACTION_ITEM_INCOMPLETE");
  const payload={plan_id:planId,title,description:asText(body.description,2500),due_date:asNullableText(body.due_date,20),status:["todo","in_progress","done","skipped"].includes(asText(body.status,20))?asText(body.status,20):"todo",position:asInteger(body.position)||0,created_by:actor.userId,completed_at:asText(body.status,20)==="done"?new Date().toISOString():null};
  const result=id?await sb.from("coaching_action_items").update(payload).eq("id",id).eq("plan_id",planId).select("*").single():await sb.from("coaching_action_items").insert(payload).select("*").single(); if(result.error) throw result.error; return result.data;
}

async function recordingStatus(sb: Supabase, actor: Session, body: Record<string, unknown>) {
  const sessionId=asText(body.session_id,80); const access=await coachingSessionAccess(sb,actor,sessionId);
  const [{data:consents},{data:recording},settings]=await Promise.all([sb.from("coaching_recording_consents").select("*").eq("session_id",sessionId),sb.from("coaching_recordings").select("*").eq("session_id",sessionId).maybeSingle(),advancedSettings(sb)]);
  return {role:access.role,consents:consents||[],recording:recording||null,recording_enabled:Boolean(settings.recording_enabled)};
}

async function recordingConsent(sb: Supabase, actor: Session, body: Record<string, unknown>) {
  const sessionId=asText(body.session_id,80); const status=asText(body.consent_status,20); if(!["accepted","declined","revoked"].includes(status)) throw new Error("INVALID_RECORDING_CONSENT");
  const access=await coachingSessionAccess(sb,actor,sessionId); if(!["coach","learner"].includes(access.role)) throw new Error("FORBIDDEN");
  const now=new Date().toISOString(); const {data,error}=await sb.from("coaching_recording_consents").upsert({session_id:sessionId,user_id:actor.userId,party_role:access.role,consent_status:status,consented_at:status==="accepted"?now:null,revoked_at:status==="revoked"?now:null},{onConflict:"session_id,user_id"}).select("*").single(); if(error) throw error;
  if(status!=="accepted") await sb.from("coaching_recordings").update({status:"cancelled",error_message:"CONSENT_WITHDRAWN"}).eq("session_id",sessionId).in("status",["consent_pending","starting"]);
  return data;
}

async function recordingStartStop(sb: Supabase, actor: Session, body: Record<string, unknown>, operation: "start"|"stop") {
  const sessionId=asText(body.session_id,80); const access=await coachingSessionAccess(sb,actor,sessionId); if(!["coach","admin_supervisor"].includes(access.role)) throw new Error("FORBIDDEN");
  const settings=await advancedSettings(sb); if(!settings.recording_enabled) throw new Error("RECORDING_DISABLED");
  const {data:consents}=await sb.from("coaching_recording_consents").select("party_role,consent_status").eq("session_id",sessionId); const accepted=new Set((consents||[]).filter((c:Record<string,unknown>)=>c.consent_status==="accepted").map((c:Record<string,unknown>)=>String(c.party_role))); if(!accepted.has("coach")||!accepted.has("learner")) throw new Error("RECORDING_CONSENT_REQUIRED");
  const {data:room}=await sb.from("coaching_rooms").select("*").eq("session_id",sessionId).maybeSingle(); if(!room) throw new Error("SESSION_ROOM_NOT_FOUND");
  let recording=(await sb.from("coaching_recordings").select("*").eq("session_id",sessionId).maybeSingle()).data;
  const now=new Date().toISOString();
  if(operation==="start"){
    if(recording&&["starting","recording","processing","ready"].includes(String(recording.status))) return {recording,already_started:true,provider_action_required:false};
    const payload={session_id:sessionId,room_id:room.id,provider:"jitsi_jibri",status:"starting",retention_expires_at:new Date(Date.now()+Number(settings.recording_retention_days||30)*86400000).toISOString(),started_at:now,requested_by:actor.userId,metadata:{room_slug:room.room_slug}};
    const result=recording?await sb.from("coaching_recordings").update(payload).eq("id",recording.id).select("*").single():await sb.from("coaching_recordings").insert(payload).select("*").single(); if(result.error) throw result.error; recording=result.data;
  }else{
    if(!recording||!["starting","recording"].includes(String(recording.status))) throw new Error("ACTIVE_RECORDING_NOT_FOUND"); const result=await sb.from("coaching_recordings").update({status:"processing",stopped_at:now}).eq("id",recording.id).select("*").single(); if(result.error) throw result.error; recording=result.data;
  }
  const providerUrl=Deno.env.get("COACHING_RECORDING_PROVIDER_URL")||""; const secret=Deno.env.get("COACHING_RECORDING_SECRET")||Deno.env.get("LIVE_RECORDING_SECRET")||"";
  if(providerUrl){const callback=`${(Deno.env.get("SUPABASE_URL")||"").replace(/\/$/,"")}/functions/v1/coaching`; const response=await fetch(providerUrl,{method:"POST",headers:{"Content-Type":"application/json",...(secret?{"x-omnia-recording-secret":secret}:{})},body:JSON.stringify({action:operation,recording_id:recording.id,session_id:sessionId,room_slug:room.room_slug,join_url:room.provider_join_url,callback_url:callback,callback_payload:{action:"recording_provider_callback",recording_id:recording.id}})}); if(!response.ok){await sb.from("coaching_recordings").update({status:"failed",error_message:(await response.text().catch(()=>"PROVIDER_ERROR")).slice(0,1000)}).eq("id",recording.id); throw new Error("RECORDING_PROVIDER_FAILED");}}
  return {recording,provider_action_required:!providerUrl};
}

async function recordingProviderCallback(sb: Supabase, req: Request, body: Record<string, unknown>) {
  const secret=Deno.env.get("COACHING_RECORDING_SECRET")||Deno.env.get("LIVE_RECORDING_SECRET")||""; const supplied=req.headers.get("x-omnia-recording-secret")||req.headers.get("X-Omnia-Recording-Secret")||""; if(!secret||supplied!==secret) throw new Error("INVALID_RECORDING_SECRET");
  const recordingId=asText(body.recording_id,80); const status=asText(body.status,30); const {data:recording}=await sb.from("coaching_recordings").select("*").eq("id",recordingId).maybeSingle(); if(!recording) throw new Error("RECORDING_NOT_FOUND");
  const patch:Record<string,unknown>={provider_recording_id:asNullableText(body.provider_recording_id,300),metadata:{...(recording.metadata||{}),provider_payload:body.provider_payload||{}}};
  if(status==="recording") Object.assign(patch,{status:"recording",started_at:recording.started_at||new Date().toISOString()});
  else if(status==="ready") Object.assign(patch,{status:"ready",storage_key:asText(body.storage_key,1200),file_name:asNullableText(body.file_name,300)||"coaching-recording.mp4",mime_type:asNullableText(body.mime_type,100)||"video/mp4",size_bytes:asInteger(body.size_bytes),duration_seconds:asInteger(body.duration_seconds),stopped_at:recording.stopped_at||new Date().toISOString(),error_message:null});
  else if(status==="failed") Object.assign(patch,{status:"failed",error_message:asText(body.error_message,1000)||"RECORDING_FAILED"}); else throw new Error("INVALID_STATUS");
  if(status==="ready"&&!patch.storage_key) throw new Error("RECORDING_STORAGE_KEY_REQUIRED");
  const {data,error}=await sb.from("coaching_recordings").update(patch).eq("id",recordingId).select("*").single(); if(error) throw error;
  if (status === "ready") {
    const { data: booking } = await sb.from("coaching_sessions").select("id,learner_user_id,coach_id,offer_title_snapshot").eq("id", recording.session_id).maybeSingle();
    if (booking) {
      const { data: coach } = await sb.from("coach_profiles").select("user_id").eq("id", booking.coach_id).maybeSingle();
      for (const userId of [booking.learner_user_id, coach?.user_id].filter(Boolean)) {
        await invokeNotification("coaching_recording_available", { userId, session_id: booking.id, offer_title: booking.offer_title_snapshot, recording_id: data.id, action_url: `/coaching/sessions/${booking.id}/room` });
      }
    }
  }
  return data;
}

function awsUriEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256(key: Uint8Array, value: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(value));
  return new Uint8Array(signature);
}

async function createR2SignedGetUrl(options: {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  objectKey: string;
  fileName: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const endpointUrl = new URL(options.endpoint);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const region = "auto";
  const service = "s3";
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const baseSegments = endpointUrl.pathname.split("/").filter(Boolean).map((segment) => awsUriEncode(decodeURIComponent(segment)));
  const objectSegments = options.objectKey.split("/").filter(Boolean).map((segment) => awsUriEncode(segment));
  const canonicalUri = `/${[...baseSegments, awsUriEncode(options.bucket), ...objectSegments].join("/")}`;
  const safeFileName = options.fileName.replace(/["\\\r\n]/g, "");
  const queryEntries: Array<[string, string]> = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", `${options.accessKey}/${scope}`],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(Math.min(3600, Math.max(1, options.expiresInSeconds || 600)))],
    ["X-Amz-SignedHeaders", "host"],
    ["response-content-disposition", `inline; filename=\"${safeFileName}\"`],
  ];
  queryEntries.sort(([left], [right]) => awsUriEncode(left) < awsUriEncode(right) ? -1 : awsUriEncode(left) > awsUriEncode(right) ? 1 : 0);
  const canonicalQuery = queryEntries.map(([key, value]) => `${awsUriEncode(key)}=${awsUriEncode(value)}`).join("&");
  const canonicalHeaders = `host:${endpointUrl.host.toLowerCase()}\n`;
  const canonicalRequest = ["GET", canonicalUri, canonicalQuery, canonicalHeaders, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, await sha256Hex(canonicalRequest)].join("\n");
  const encoder = new TextEncoder();
  const dateKey = await hmacSha256(encoder.encode(`AWS4${options.secretKey}`), dateStamp);
  const regionKey = await hmacSha256(dateKey, region);
  const serviceKey = await hmacSha256(regionKey, service);
  const signingKey = await hmacSha256(serviceKey, "aws4_request");
  const signature = bytesToHex(await hmacSha256(signingKey, stringToSign));
  return `${endpointUrl.origin}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

async function recordingSignedUrl(sb: Supabase, actor: Session, body: Record<string, unknown>) {
  const recordingId=asText(body.recording_id,80); const {data:recording}=await sb.from("coaching_recordings").select("*").eq("id",recordingId).maybeSingle(); if(!recording||recording.status!=="ready"||!recording.storage_key) throw new Error("RECORDING_NOT_FOUND");
  await coachingSessionAccess(sb,actor,String(recording.session_id));
  const endpoint=Deno.env.get("R2_ENDPOINT")||""; const accessKey=Deno.env.get("R2_ACCESS_KEY_ID")||Deno.env.get("R2_ACCESS_KEY")||""; const secretKey=Deno.env.get("R2_SECRET_ACCESS_KEY")||Deno.env.get("R2_SECRET_KEY")||""; const bucket=Deno.env.get("R2_BUCKET_NAME")||"";
  if(!endpoint||!accessKey||!secretKey||!bucket) throw new Error("RECORDING_STORAGE_NOT_CONFIGURED");
  const signedUrl=await createR2SignedGetUrl({endpoint,accessKey,secretKey,bucket,objectKey:String(recording.storage_key),fileName:String(recording.file_name||"coaching.mp4"),expiresInSeconds:600});
  return {recording,signed_url:signedUrl};
}

async function groupRoomAccess(sb: Supabase, actor: Session, body: Record<string, unknown>) {
  const programId=asText(body.program_id,80);
  const {data:program}=await sb.from("coaching_group_programs").select("*,coach:coach_profiles(id,user_id)").eq("id",programId).maybeSingle();
  if(!program) throw new Error("GROUP_NOT_FOUND");
  const coachUser=String((program.coach as Record<string,unknown>).user_id);
  const isCoach=coachUser===actor.userId;
  const registration=isCoach||isAdmin(actor)?null:(await sb.from("coaching_group_registrations").select("*").eq("program_id",programId).eq("user_id",actor.userId).in("status",["confirmed","attended"]).maybeSingle()).data;
  if(!isCoach&&!isAdmin(actor)&&!registration) throw new Error("FORBIDDEN");
  const settings=await advancedSettings(sb);
  const opens=new Date(new Date(String(program.scheduled_start)).getTime()-Number(settings.group_access_before_minutes||30)*60000);
  const closes=new Date(new Date(String(program.scheduled_end)).getTime()+Number(settings.group_access_after_minutes||30)*60000);
  const now=Date.now();
  const accessStatus=now<opens.getTime()?"too_early":now>closes.getTime()?"closed":"available";
  const {count}=await sb.from("coaching_group_registrations").select("id",{count:"exact",head:true}).eq("program_id",programId).in("status",["confirmed","attended"]);
  const role=isAdmin(actor)?"admin_supervisor":isCoach?"coach":"learner";

  let joinUrl:string|null=null;
  let meeting:Record<string,unknown>|null=null;
  if(accessStatus==="available"&&program.meeting_mode==="jitsi"){
    if(jaasConfigured()){
      const {data:user}=await sb.from("users").select("full_name,email").eq("id",actor.userId).maybeSingle();
      meeting=await createJaasMeetingAccess({
        roomName:String(program.room_slug),
        userId:actor.userId,
        name:user?.full_name||null,
        email:user?.email||null,
        moderator:role==="coach"||role==="admin_supervisor",
      });
    }else if(publicJitsiDevEnabled()){
      joinUrl=`https://meet.jit.si/${encodeURIComponent(String(program.room_slug))}#config.prejoinPageEnabled=false`;
    }else{
      throw new Error("VIDEO_PROVIDER_NOT_CONFIGURED");
    }
  }else if(accessStatus==="available"){
    joinUrl=program.external_meeting_url;
  }
  return {
    program:{...program,confirmed_count:count||0},
    role,
    access_status:accessStatus,
    opens_at:opens.toISOString(),
    closes_at:closes.toISOString(),
    join_url:joinUrl,
    meeting,
    security_mode:meeting?"jaas":program.meeting_mode==="jitsi"&&joinUrl?"development_public_jitsi":null,
    registration,
  };
}


async function groupRoomPresence(sb: Supabase, actor: Session, body: Record<string, unknown>, action: "join"|"leave"|"start"|"end") {
  const access=await groupRoomAccess(sb,actor,body); const program=access.program as Record<string,unknown>; if(["start","end"].includes(action)&&!["coach","admin_supervisor"].includes(access.role)) throw new Error("FORBIDDEN"); if(access.access_status!=="available"&&action!=="end") throw new Error(access.access_status==="too_early"?"SESSION_TOO_EARLY":"SESSION_OUTSIDE_ACCESS_WINDOW"); const now=new Date().toISOString();
  if(action==="start") await sb.from("coaching_group_programs").update({status:"in_progress",actual_started_at:program.actual_started_at||now}).eq("id",program.id);
  if(action==="end"){await sb.from("coaching_group_programs").update({status:"completed",actual_ended_at:now}).eq("id",program.id); await sb.from("coaching_group_registrations").update({status:"attended",left_at:now}).eq("program_id",program.id).eq("status","confirmed").not("joined_at","is",null);}
  if(access.role==="learner"&&action==="join") await sb.from("coaching_group_registrations").update({joined_at:now,last_seen_at:now}).eq("program_id",program.id).eq("user_id",actor.userId);
  if(access.role==="learner"&&action==="leave") await sb.from("coaching_group_registrations").update({left_at:now,last_seen_at:now,status:"attended"}).eq("program_id",program.id).eq("user_id",actor.userId);
  return await groupRoomAccess(sb,actor,body);
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
    if (action === "public_advanced_catalogue") return json({ success: true, ...(await publicAdvancedCatalogue(sb)) });
    if (action === "recording_provider_callback") return json({ success: true, recording: await recordingProviderCallback(sb, req, body) });

    let session = await authenticate(sb, req);
    if (!session) throw new Error("SESSION_INVALID");

    const previewMode = asBoolean(body.preview_mode) && isAdmin(session);
    if (previewMode) {
      if (!COACH_PREVIEW_READ_ACTIONS.has(action)) throw new Error("PREVIEW_READ_ONLY");
      session = await coachPreviewSession(sb);
    }

    if (action === "store_payment_finalize") return json({ success: true, ...(await storePaymentFinalize(sb, session, body)) });
    if (action === "upload_asset") return json({ success: true, asset: await uploadAsset(sb, session, body) });
    if (action === "claim_oga_link_code") return json({ success: true, result: await claimOgaCoachLinkCode(sb, session, body) });
    if (action === "self_status") {
      const [applications, profile] = await Promise.all([
        loadApplicationRows(sb, session.userId),
        sb.from("coach_profiles").select("*").eq("user_id", session.userId).maybeSingle(),
      ]);
      let enrichedProfile: unknown = null;
      if (profile.data) enrichedProfile = await publicProfile(sb, String(profile.data.public_slug), true);
      return json({ success: true, application: applications[0] || null, profile: enrichedProfile, roles: session.roles, eligibility: await coachEligibility(sb, session) });
    }
    if (action === "submit_application") {
      const applicationId = await submitApplication(sb, session, body);
      return json({ success: true, application_id: applicationId });
    }
    if (action === "structure_coach_designations") return json({ success: true, ...(await structureCoachDesignations(sb, session, body)) });
    if (action === "structure_coach_designate") return json({ success: true, ...(await structureCoachDesignate(sb, session, body)) });
    if (action === "favorite_status") {
      const coachId = asText(body.coach_id, 80);
      return json({ success: true, favorite: await favoriteState(sb, session, coachId) });
    }
    if (action === "favorite_toggle") return json({ success: true, favorite: await toggleFavorite(sb, session, body) });
    if (action === "learner_coaching_dashboard") return json({ success: true, ...(await learnerDashboard(sb, session)) });
    if (action === "learner_advanced_dashboard") return json({ success: true, ...(await learnerAdvancedDashboard(sb, session)) });
    if (action === "learner_preferences") return json({ success: true, preferences: await learnerPreferences(sb, session) });
    if (action === "learner_preferences_save") return json({ success: true, preferences: await saveLearnerPreferences(sb, session, body) });
    if (action === "learner_recommendations") return json({ success: true, ...(await coachingRecommendations(sb, session)) });
    if (action === "advanced_checkout") return json({ success: true, ...(await advancedCheckout(sb, session, body)) });
    if (action === "advanced_payment_status") return json({ success: true, ...(await advancedPaymentStatus(sb, session, body)) });
    if (action === "action_plan_get") return json({ success: true, ...(await actionPlanForSession(sb, session, body)) });
    if (action === "action_plan_save") return json({ success: true, plan: await actionPlanSave(sb, session, body) });
    if (action === "action_item_save") return json({ success: true, item: await actionItemSave(sb, session, body) });
    if (action === "recording_status") return json({ success: true, ...(await recordingStatus(sb, session, body)) });
    if (action === "recording_consent") return json({ success: true, consent: await recordingConsent(sb, session, body) });
    if (action === "recording_start") return json({ success: true, ...(await recordingStartStop(sb, session, body, "start")) });
    if (action === "recording_stop") return json({ success: true, ...(await recordingStartStop(sb, session, body, "stop")) });
    if (action === "recording_signed_url") return json({ success: true, ...(await recordingSignedUrl(sb, session, body)) });
    if (action === "group_room_access") return json({ success: true, ...(await groupRoomAccess(sb, session, body)) });
    if (action === "group_room_join") return json({ success: true, ...(await groupRoomPresence(sb, session, body, "join")) });
    if (action === "group_room_leave") return json({ success: true, ...(await groupRoomPresence(sb, session, body, "leave")) });
    if (action === "group_room_start") return json({ success: true, ...(await groupRoomPresence(sb, session, body, "start")) });
    if (action === "group_room_end") return json({ success: true, ...(await groupRoomPresence(sb, session, body, "end")) });
    if (action === "booking_create_fixed") return json({ success: true, session: await createFixedBooking(sb, session, body) });
    if (action === "booking_create_custom") return json({ success: true, session: await createCustomRequest(sb, session, body) });
    if (action === "booking_cancel_pending") return json({ success: true, session: await cancelPendingBooking(sb, session, body) });
    if (action === "payment_checkout") return json({ success: true, ...(await coachingPaymentCheckout(sb, session, body)) });
    if (action === "payment_status") return json({ success: true, ...(await coachingPaymentStatus(sb, session, body)) });
    if (action === "invoice_signed_url") return json({ success: true, ...(await coachingInvoiceUrl(sb, session, body)) });
    if (action === "learner_cancel_paid") return json({ success: true, refund: await cancelPaidCoaching(sb, session, body, "learner") });
    if (action === "session_room_access") return json({ success: true, ...(await sessionRoomAccess(sb, session, body)) });
    if (action === "session_room_start") return json({ success: true, ...(await coachingRoomStart(sb, session, body)) });
    if (action === "session_room_join") return json({ success: true, ...(await coachingRoomJoin(sb, session, body)) });
    if (action === "session_room_heartbeat") return json({ success: true, ...(await coachingRoomHeartbeat(sb, session, body)) });
    if (action === "session_room_leave") return json({ success: true, ...(await coachingRoomLeave(sb, session, body)) });
    if (action === "session_room_end") return json({ success: true, ...(await coachingRoomEnd(sb, session, body)) });
    if (action === "session_external_link_save") return json({ success: true, session: await saveExternalMeetingLink(sb, session, body) });
    if (action === "session_external_presence") return json({ success: true, ...(await externalPresenceMark(sb, session, body)) });
    if (action === "session_follow_up") return json({ success: true, ...(await followUpAccess(sb, session, asText(body.session_id, 80))) });
    if (action === "learner_rating_submit") return json({ success: true, rating: await submitLearnerRating(sb, session, body) });
    if (action === "coach_ratings") return json({ success: true, ...(await coachRatingsDashboard(sb, session)) });
    if (action === "coach_rating_reply") return json({ success: true, rating: await coachReplyToRating(sb, session, body) });
    if (action === "coach_learner_feedback_submit") return json({ success: true, feedback: await submitCoachLearnerFeedback(sb, session, body) });
    if (action === "dispute_open") return json({ success: true, dispute: await openCoachingDispute(sb, session, body) });
    if (action === "disputes_mine") return json({ success: true, disputes: await myCoachingDisputes(sb, session) });
    if (action === "dispute_message_add") return json({ success: true, message: await addCoachingDisputeMessage(sb, session, body) });
    if (action === "coach_revenue") return json({ success: true, ...(await coachRevenueDashboard(sb, session)) });
    if (action === "coach_payout_request") return json({ success: true, payout: await coachCreatePayout(sb, session, body) });
    if (action === "coach_advanced_products") return json({ success: true, ...(await coachAdvancedProducts(sb, session)) });
    if (action === "coach_group_save") return json({ success: true, group: await saveCoachGroup(sb, session, body) });
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
      const revenue = await coachRevenueDashboard(sb, session);
      return json({ success: true, profile: await publicProfile(sb, String(profile.public_slug), true), offers, recent_sessions: sessions.slice(0, 8), metrics: { upcoming_sessions: upcoming.count || 0, pending_custom_requests: pendingCustom.count || 0, completed_sessions: Number(profile.completed_sessions_count || 0), average_rating: Number(profile.average_rating || 0), available_revenue_xof: Number(revenue.wallet.balance_xof || 0) - Number(revenue.wallet.reserved_xof || 0) } });
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
    if (action === "coach_cancel_paid") return json({ success: true, refund: await cancelPaidCoaching(sb, session, body, "coach") });

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
    if (action === "admin_prepare_oga_coach") return json({ success: true, result: await adminPrepareOgaCoach(sb, session, body) });
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
    if (action === "admin_finance") return json({ success: true, ...(await adminCoachingFinance(sb)) });
    if (action === "admin_refund_decide") return json({ success: true, refund: await adminRefundDecision(sb, session, body) });
    if (action === "admin_refund_processed") return json({ success: true, refund: await adminRefundProcessed(sb, session, body) });
    if (action === "admin_finance_settings_save") return json({ success: true, settings: await adminFinanceSettingsSave(sb, session, body) });
    if (action === "admin_sessions") return json({ success: true, sessions: await adminCoachingSessions(sb), settings: await coachingRoomSettings(sb) });
    if (action === "admin_session_settings_save") return json({ success: true, settings: await adminSessionSettingsSave(sb, session, body) });
    if (action === "admin_disputes") return json({ success: true, disputes: await adminCoachingDisputes(sb) });
    if (action === "admin_dispute_decide") return json({ success: true, dispute: await adminDecideCoachingDispute(sb, session, body) });
    if (action === "admin_dispute_message_add") return json({ success: true, message: await addCoachingDisputeMessage(sb, session, body) });
    if (action === "admin_ratings") return json({ success: true, ratings: await adminCoachingRatings(sb), settings: await performanceSettings(sb) });
    if (action === "admin_rating_moderate") return json({ success: true, rating: await adminModerateCoachingRating(sb, session, body) });
    if (action === "admin_revenue") return json({ success: true, ...(await adminCoachingRevenue(sb)) });
    if (action === "admin_performance_settings_save") return json({ success: true, settings: await adminSavePerformanceSettings(sb, session, body) });
    if (action === "admin_advanced_products") return json({ success: true, ...(await adminAdvancedProducts(sb)) });
    if (action === "admin_advanced_review") return json({ success: true, product: await adminReviewAdvanced(sb, session, body) });
    if (action === "admin_advanced_settings_save") {
      const before = await advancedSettings(sb);
      const retentionDays = asInteger(body.recording_retention_days) ?? 30;
      const groupAccessBefore = asInteger(body.group_access_before_minutes) ?? 30;
      const groupAccessAfter = asInteger(body.group_access_after_minutes) ?? 30;
      const rawWeights = body.matching_weights && typeof body.matching_weights === "object" ? body.matching_weights as Record<string, unknown> : before.matching_weights as Record<string, unknown>;
      const matchingWeights = {
        domains: Number(rawWeights?.domains ?? 40),
        languages: Number(rawWeights?.languages ?? 20),
        budget: Number(rawWeights?.budget ?? 15),
        rating: Number(rawWeights?.rating ?? 15),
        availability: Number(rawWeights?.availability ?? 10),
      };
      if (retentionDays < 1 || retentionDays > 365 || groupAccessBefore < 0 || groupAccessBefore > 240 || groupAccessAfter < 0 || groupAccessAfter > 240 || Object.values(matchingWeights).some(value => !Number.isFinite(value) || value < 0 || value > 100)) throw new Error("INVALID_ADVANCED_SETTINGS");
      const payload = {
        recommendations_enabled: asBoolean(body.recommendations_enabled, true),
        recording_enabled: asBoolean(body.recording_enabled),
        recording_retention_days: retentionDays,
        group_access_before_minutes: groupAccessBefore,
        group_access_after_minutes: groupAccessAfter,
        matching_weights: matchingWeights,
      };
      const result = await sb.from("coaching_settings").update(payload).eq("id", 1).select("*").single();
      if (result.error) throw result.error;
      await audit(sb, session.userId, "coaching_advanced_settings_updated", "coaching_settings", null, before, payload);
      return json({ success: true, settings: result.data });
    }

    return json({ error: "UNKNOWN_ACTION" }, 400);
  } catch (error) {
    return errorResponse(error);
  }
});
