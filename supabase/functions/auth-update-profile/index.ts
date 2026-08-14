import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import bcrypt from "npm:bcryptjs@2.4.3";
import { setNewsletterConsent } from "../_shared/newsletter.ts";
import { getActiveOmniaSession, getOmniaRoles, getOmniaSessionToken } from "../_shared/omnia-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "https://omniaglobalacademy.com",
  "Access-Control-Allow-Methods": "POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-omnia-session-token",
};

const PROFILE_BUCKET = "profile-avatars";
const MAX_AVATAR_BYTES = 3 * 1024 * 1024;
const ALLOWED_AVATAR_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
const PROFILE_VISIBILITIES = new Set(["public", "members", "private"]);
const PLATFORM_LANGUAGES = new Set(["fr", "en", "es", "pt", "ar", "zh", "ru", "de"]);
const URL_FIELDS = new Set(["website_url", "linkedin_url", "portfolio_url", "github_url"]);

const SUSPENSION_REASON_LABELS: Record<string, string> = {
  pause: "Je fais une pause",
  too_many_notifications: "Je reçois trop de notifications",
  low_usage: "Je n’utilise pas suffisamment la plateforme",
  technical_issue: "Je rencontre un problème technique",
  security_break: "Je souhaite protéger temporairement mon compte",
  missing_features: "Je ne trouve pas les fonctionnalités recherchées",
  other: "Autre",
};

const DELETION_REASON_LABELS: Record<string, string> = {
  no_longer_use: "Je n’utilise plus la plateforme",
  duplicate_account: "J’ai créé un autre compte",
  privacy_request: "Je souhaite supprimer mes données",
  technical_issues: "Je rencontre trop de problèmes techniques",
  missing_content: "Je ne trouve pas les formations ou services recherchés",
  communications: "Je ne souhaite plus recevoir de communications",
  dissatisfied: "Je suis insatisfait de mon expérience",
  other: "Autre",
};

const USER_FIELDS = [
  "full_name",
  "email",
  "phone_number",
  "country_code",
  "birth_date",
  "allow_email",
  "allow_sms",
  "allow_push",
  "subscribe_newsletter",
] as const;

const PROFILE_TEXT_FIELDS: Record<string, number> = {
  display_name: 160,
  headline: 220,
  bio: 3000,
  city: 160,
  website_url: 700,
  linkedin_url: 700,
  portfolio_url: 700,
  github_url: 700,
  availability_text: 300,
  public_email: 255,
  public_phone: 80,
};

const PROFILE_ARRAY_FIELDS: Record<string, { maxItems: number; maxLength: number }> = {
  languages: { maxItems: 20, maxLength: 80 },
  skills: { maxItems: 50, maxLength: 120 },
  interests: { maxItems: 30, maxLength: 120 },
};

const PROFILE_BOOLEAN_FIELDS = [
  "show_email",
  "show_phone",
  "show_location",
  "show_roles",
  "show_achievements",
  "allow_messages",
] as const;

const FIELD_VISIBILITY_DEFAULTS: Record<string, boolean> = {
  display_name: true,
  avatar_url: true,
  headline: true,
  bio: true,
  city: true,
  country_code: true,
  languages: true,
  skills: true,
  interests: true,
  website_url: true,
  linkedin_url: true,
  portfolio_url: true,
  github_url: true,
  availability_text: true,
  public_email: false,
  public_phone: false,
  roles: true,
  achievements: true,
  messages: true,
  education_level: true,
  field_of_study: true,
  career_goal: true,
  target_roles: true,
  target_sectors: true,
  contract_preferences: true,
  years_experience: true,
  expertise_domain: true,
  teaching_languages: true,
  qualifications: true,
  teaching_formats: true,
  experience_summary: true,
  organizer_type: true,
  organization_name: true,
  event_topics: true,
  moderation_domains: true,
  recruitment_sectors: true,
  recruitment_countries: true,
  coaching_topics: true,
  session_languages: true,
  organizer_metrics: true,
  coach_metrics: true,
  structure: true,
};
const FIELD_VISIBILITY_KEYS = new Set(Object.keys(FIELD_VISIBILITY_DEFAULTS));

const ROLE_DETAIL_TEXT_FIELDS: Record<string, number> = {
  education_level: 160,
  field_of_study: 180,
  career_goal: 1200,
  years_experience: 40,
  expertise_domain: 300,
  experience_summary: 2000,
  organizer_type: 120,
  organization_name: 220,
};

const ROLE_DETAIL_ARRAY_FIELDS: Record<string, { maxItems: number; maxLength: number }> = {
  target_roles: { maxItems: 20, maxLength: 120 },
  target_sectors: { maxItems: 20, maxLength: 120 },
  contract_preferences: { maxItems: 15, maxLength: 100 },
  teaching_languages: { maxItems: 15, maxLength: 80 },
  qualifications: { maxItems: 30, maxLength: 180 },
  teaching_formats: { maxItems: 10, maxLength: 100 },
  event_topics: { maxItems: 25, maxLength: 150 },
  moderation_domains: { maxItems: 25, maxLength: 150 },
  recruitment_sectors: { maxItems: 25, maxLength: 150 },
  recruitment_countries: { maxItems: 25, maxLength: 100 },
  coaching_topics: { maxItems: 25, maxLength: 150 },
  session_languages: { maxItems: 15, maxLength: 80 },
};

type DbClient = ReturnType<typeof createClient>;
type SessionContext = { userId: string; roles: string[] };

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function resolveSession(sb: DbClient, req: Request, required = true): Promise<SessionContext | null | Response> {
  const token = getOmniaSessionToken(req);
  if (!token) return required ? json({ error: "AUTH_REQUIRED" }, 401) : null;

  const session = await getActiveOmniaSession(sb, token);
  if (!session) return required ? json({ error: "SESSION_INVALID" }, 401) : null;

  return {
    userId: String(session.user_id),
    roles: await getOmniaRoles(sb, String(session.user_id)),
  };
}

function isResponse(value: unknown): value is Response {
  return value instanceof Response;
}

async function ignoreFailure(operation: PromiseLike<unknown>) {
  try {
    await operation;
  } catch {
    // Synchronisation secondaire : le profil unifié reste la source de vérité.
  }
}

function cleanText(value: unknown, maxLength: number): string | null {
  if (value === null || value === undefined || value === "") return null;
  return String(value).trim().slice(0, maxLength) || null;
}

function cleanArray(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(item => String(item).trim().slice(0, maxLength)).filter(Boolean))].slice(0, maxItems);
}

function redactFeedbackText(value: unknown, maxLength: number): string | null {
  const cleaned = cleanText(value, maxLength);
  if (!cleaned) return null;
  return cleaned
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[adresse masquée]")
    .replace(/(?:\+?\d[\d .()/-]{7,}\d)/g, "[numéro masqué]")
    .replace(/\b(?:Bearer\s+)?[A-Za-z0-9_-]{20,}(?:\.[A-Za-z0-9_-]{10,}){0,2}\b/g, "[secret masqué]");
}

function cleanFeedback(value: unknown) {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    improvement_feedback: redactFeedbackText(input.improvement_feedback, 1200),
    missing_feature: redactFeedbackText(input.missing_feature, 600),
    return_condition: redactFeedbackText(input.return_condition, 600),
  };
}

function hasFeedback(value: ReturnType<typeof cleanFeedback>) {
  return Boolean(value.improvement_feedback || value.missing_feature || value.return_condition);
}

async function saveExitFeedback(
  sb: DbClient,
  accountReference: string,
  action: "suspension" | "deletion",
  reasonCode: string,
  feedback: ReturnType<typeof cleanFeedback>,
) {
  if (!hasFeedback(feedback)) return null;
  try {
    const { data, error } = await sb.from("account_exit_feedback").upsert({
      account_reference: accountReference,
      action,
      reason_code: reasonCode,
      ...feedback,
    }, { onConflict: "account_reference,action" }).select("id").single();
    if (error) {
      console.error("account_exit_feedback upsert failed:", error.message);
      return null;
    }
    return data?.id ? String(data.id) : null;
  } catch (error) {
    console.error("account_exit_feedback failed:", error);
    return null;
  }
}

function validHttpUrl(value: string | null) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function normalizeFieldVisibility(
  value: unknown,
  legacy: Record<string, unknown> = {},
): Record<string, boolean> {
  const result: Record<string, boolean> = { ...FIELD_VISIBILITY_DEFAULTS };
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      if (FIELD_VISIBILITY_KEYS.has(key) && typeof raw === "boolean") result[key] = raw;
    }
  } else {
    result.public_email = Boolean(legacy.show_email);
    result.public_phone = Boolean(legacy.show_phone);
    const showLocation = legacy.show_location === undefined ? true : Boolean(legacy.show_location);
    result.city = showLocation;
    result.country_code = showLocation;
    result.roles = legacy.show_roles === undefined ? true : Boolean(legacy.show_roles);
    result.achievements = legacy.show_achievements === undefined ? true : Boolean(legacy.show_achievements);
    result.messages = legacy.allow_messages === undefined ? true : Boolean(legacy.allow_messages);
  }
  return result;
}

function sanitizeFieldVisibility(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_FIELD_VISIBILITY");
  const result: Record<string, boolean> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!FIELD_VISIBILITY_KEYS.has(key)) continue;
    if (typeof raw !== "boolean") throw new Error("INVALID_FIELD_VISIBILITY");
    result[key] = raw;
  }
  return { ...FIELD_VISIBILITY_DEFAULTS, ...result };
}

function isFieldVisible(
  fieldVisibility: Record<string, boolean>,
  field: string,
  fallback = true,
) {
  return fieldVisibility[field] === undefined ? fallback : fieldVisibility[field];
}

function sanitizeProfile(input: Record<string, unknown>) {
  const result: Record<string, unknown> = {};
  for (const [field, maxLength] of Object.entries(PROFILE_TEXT_FIELDS)) {
    if (input[field] === undefined) continue;
    const value = cleanText(input[field], maxLength);
    if (URL_FIELDS.has(field) && !validHttpUrl(value)) throw new Error(`INVALID_URL:${field}`);
    result[field] = value;
  }
  for (const [field, config] of Object.entries(PROFILE_ARRAY_FIELDS)) {
    if (input[field] !== undefined) result[field] = cleanArray(input[field], config.maxItems, config.maxLength);
  }
  for (const field of PROFILE_BOOLEAN_FIELDS) {
    if (input[field] !== undefined) result[field] = Boolean(input[field]);
  }
  if (input.visibility !== undefined) {
    const visibility = String(input.visibility || "");
    if (!PROFILE_VISIBILITIES.has(visibility)) throw new Error("INVALID_VISIBILITY");
    result.visibility = visibility;
  }
  if (input.field_visibility !== undefined) {
    result.field_visibility = sanitizeFieldVisibility(input.field_visibility);
  }
  return result;
}

function sanitizeRoleDetails(input: Record<string, unknown>) {
  const result: Record<string, unknown> = {};
  for (const [field, maxLength] of Object.entries(ROLE_DETAIL_TEXT_FIELDS)) {
    if (input[field] !== undefined) result[field] = cleanText(input[field], maxLength);
  }
  for (const [field, config] of Object.entries(ROLE_DETAIL_ARRAY_FIELDS)) {
    if (input[field] !== undefined) result[field] = cleanArray(input[field], config.maxItems, config.maxLength);
  }
  return result;
}

function parseDataUrl(value: unknown) {
  const text = typeof value === "string" ? value : "";
  const match = text.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) throw new Error("INVALID_AVATAR_DATA");
  const mime = match[1].toLowerCase();
  if (!ALLOWED_AVATAR_MIME.has(mime)) throw new Error("INVALID_AVATAR_TYPE");
  const normalized = match[2].replace(/\s+/g, "");
  const bytes = Uint8Array.from(atob(normalized), char => char.charCodeAt(0));
  if (!bytes.length || bytes.length > MAX_AVATAR_BYTES) throw new Error("AVATAR_TOO_LARGE");
  return { mime, bytes };
}

function avatarExtension(mime: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

async function ensureProfile(sb: DbClient, userId: string, fullName?: string | null) {
  const { data: existing, error: existingError } = await sb
    .from("user_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return existing as Record<string, unknown>;

  const { data, error } = await sb
    .from("user_profiles")
    .insert({ user_id: userId, display_name: cleanText(fullName, 160) })
    .select("*")
    .single();
  if (error) throw error;
  return data as Record<string, unknown>;
}

async function loadProfileBundle(
  sb: DbClient,
  userId: string,
  knownRoles?: string[],
  createProfile = true,
) {
  const [userResult, rolesResult, profileResult, professorResult, organizerResult, coachResult, managerResult] = await Promise.all([
    sb.from("users").select("id,full_name,email,phone_number,country_code,birth_date,avatar_url,allow_email,allow_sms,allow_push,subscribe_newsletter,ai_tokens,status").eq("id", userId).maybeSingle(),
    knownRoles ? Promise.resolve({ data: knownRoles.map(role => ({ role })), error: null }) : sb.from("user_roles").select("role").eq("user_id", userId),
    sb.from("user_profiles").select("*").eq("user_id", userId).maybeSingle(),
    sb.from("professeur_profiles").select("bio,expertise_domain,cv_diploma_url,kyc_status,signature_url").eq("user_id", userId).maybeSingle(),
    sb.from("live_organizer_profiles").select("display_name,bio,country,website,logo_url,verification_status,public_rating,review_count,completed_events").eq("user_id", userId).maybeSingle(),
    sb.from("coach_profiles").select("id,public_slug,professional_title,biography,specialties,languages,country,timezone,photo_url,linkedin_url,website_url,status,average_rating,rating_count,completed_sessions_count").eq("user_id", userId).maybeSingle(),
    sb.from("partner_managers").select("organization_id,role_in_org,is_primary,status").eq("user_id", userId).in("status", ["actif", "active"]).order("is_primary", { ascending: false }).limit(1).maybeSingle(),
  ]);

  if (userResult.error) throw userResult.error;
  if (!userResult.data || userResult.data.status === "supprime") return null;
  if (rolesResult.error) throw rolesResult.error;
  if (profileResult.error) throw profileResult.error;

  const roles = (rolesResult.data || []).map((row: { role: string }) => String(row.role));
  let structure: Record<string, unknown> | null = null;
  if (!managerResult.error && managerResult.data?.organization_id) {
    const { data } = await sb
      .from("partner_organizations")
      .select("id,org_name,org_type,country,city,logo_url,website,description")
      .eq("id", managerResult.data.organization_id)
      .maybeSingle();
    if (data) structure = { ...data, role_in_org: managerResult.data.role_in_org, is_primary: managerResult.data.is_primary };
  }

  const profile = profileResult.data || (createProfile
    ? await ensureProfile(sb, userId, userResult.data.full_name)
    : {
        user_id: userId,
        display_name: userResult.data.full_name,
        headline: null,
        bio: null,
        city: null,
        languages: [],
        skills: [],
        interests: [],
        visibility: "members",
        show_email: false,
        show_phone: false,
        show_location: true,
        show_roles: true,
        show_achievements: true,
        allow_messages: true,
        field_visibility: { ...FIELD_VISIBILITY_DEFAULTS },
        role_details: {},
      });
  return {
    user: userResult.data,
    roles,
    profile,
    professor_profile: professorResult.error ? null : professorResult.data || null,
    organizer_profile: organizerResult.error ? null : organizerResult.data || null,
    coach_profile: coachResult.error ? null : coachResult.data || null,
    structure,
  };
}

async function synchronizeRoleProfiles(
  sb: DbClient,
  userId: string,
  roles: string[],
  user: Record<string, unknown>,
  profile: Record<string, unknown>,
) {
  const roleDetails = (profile.role_details && typeof profile.role_details === "object" ? profile.role_details : {}) as Record<string, unknown>;
  const fieldVisibility = normalizeFieldVisibility(profile.field_visibility, profile);
  const displayName = isFieldVisible(fieldVisibility, "display_name")
    ? cleanText(profile.display_name, 160) || cleanText(user.full_name, 160) || "Membre Omnia"
    : "Membre Omnia";
  const country = isFieldVisible(fieldVisibility, "country_code") ? cleanText(user.country_code, 20) : null;
  const city = isFieldVisible(fieldVisibility, "city") ? cleanText(profile.city, 160) : null;
  const location = [city, country].filter(Boolean).join(", ") || null;
  const languages = isFieldVisible(fieldVisibility, "languages") ? cleanArray(profile.languages, 20, 80) : [];
  const skills = isFieldVisible(fieldVisibility, "skills") ? cleanArray(profile.skills, 50, 120) : [];
  const visibility = profile.visibility === "public" ? "public" : profile.visibility === "members" ? "recruiters" : "private";

  const individualRoles = roles.some(role => ["apprenant", "professeur", "formateur", "coach", "organizer", "organisateur", "recruteur", "recruteur_independant"].includes(role));
  if (individualRoles) {
    await ignoreFailure(sb.from("career_public_profiles").upsert({
      user_id: userId,
      full_name: displayName,
      professional_title: isFieldVisible(fieldVisibility, "headline") ? cleanText(profile.headline, 220) : null,
      email: isFieldVisible(fieldVisibility, "public_email", false) ? cleanText(profile.public_email, 255) : null,
      phone: isFieldVisible(fieldVisibility, "public_phone", false) ? cleanText(profile.public_phone, 80) : null,
      location,
      linkedin: isFieldVisible(fieldVisibility, "linkedin_url") ? cleanText(profile.linkedin_url, 700) : null,
      bio: isFieldVisible(fieldVisibility, "bio") ? cleanText(profile.bio, 3000) : null,
      skills,
      languages,
      photo_url: isFieldVisible(fieldVisibility, "avatar_url") ? cleanText(user.avatar_url, 1200) : null,
      visibility,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" }));

    await ignoreFailure(sb.from("skills_passports").update({
      professional_headline: isFieldVisible(fieldVisibility, "headline") ? cleanText(profile.headline, 220) : null,
      professional_summary: isFieldVisible(fieldVisibility, "bio") ? cleanText(profile.bio, 3000) : null,
      target_roles: isFieldVisible(fieldVisibility, "target_roles") ? cleanArray(roleDetails.target_roles, 20, 120) : [],
      languages,
      location_text: location,
      availability_text: isFieldVisible(fieldVisibility, "availability_text") ? cleanText(profile.availability_text, 300) : null,
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId));
  }

  if (roles.some(role => ["professeur", "formateur", "enseignant", "etablissement_enseignant"].includes(role))) {
    await ignoreFailure(sb.from("professeur_profiles").upsert({
      user_id: userId,
      bio: cleanText(profile.bio, 3000),
      expertise_domain: cleanText(roleDetails.expertise_domain, 300) || cleanArray(profile.skills, 50, 120).slice(0, 5).join(", ") || null,
    }, { onConflict: "user_id" }));
  }

  if (roles.some(role => ["organizer", "organisateur"].includes(role))) {
    await ignoreFailure(sb.from("live_organizer_profiles").update({
      display_name: displayName,
      bio: cleanText(profile.bio, 3000),
      country: cleanText(user.country_code, 20),
      website: cleanText(profile.website_url, 700),
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId));
  }

  if (roles.includes("coach")) {
    await ignoreFailure(sb.from("coach_profiles").update({
      professional_title: cleanText(profile.headline, 220),
      biography: cleanText(profile.bio, 3000),
      specialties: cleanArray(profile.skills, 50, 120),
      languages: cleanArray(roleDetails.session_languages, 15, 80).length
        ? cleanArray(roleDetails.session_languages, 15, 80)
        : cleanArray(profile.languages, 20, 80),
      country: cleanText(user.country_code, 20),
      photo_url: cleanText(user.avatar_url, 1200),
      linkedin_url: cleanText(profile.linkedin_url, 700),
      website_url: cleanText(profile.website_url, 700),
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId));
  }
}

async function publicProfileAction(sb: DbClient, req: Request, body: Record<string, unknown>) {
  const targetUserId = cleanText(body.user_id ?? body.profile_user_id, 80);
  if (!targetUserId) return json({ error: "PROFILE_USER_REQUIRED" }, 400);

  const optionalSession = await resolveSession(sb, req, false);
  if (isResponse(optionalSession)) return optionalSession;
  const bundle = await loadProfileBundle(sb, targetUserId, undefined, false);
  if (!bundle) return json({ error: "PROFILE_NOT_FOUND" }, 404);

  if (bundle.roles.includes("super_admin")) {
    return json({ error: "PROFILE_NOT_FOUND" }, 404);
  }

  const profile = bundle.profile as Record<string, unknown>;
  const viewerIsOwner = optionalSession?.userId === targetUserId;
  const viewerIsAdmin = optionalSession?.roles.includes("super_admin") || false;
  const visibility = String(profile.visibility || "members");
  if (visibility === "private" && !viewerIsOwner && !viewerIsAdmin) return json({ error: "PROFILE_PRIVATE" }, 403);
  if (visibility === "members" && !optionalSession) return json({ error: "MEMBER_ACCESS_REQUIRED" }, 401);

  const roleDetails = (profile.role_details && typeof profile.role_details === "object" ? profile.role_details : {}) as Record<string, unknown>;
  const fieldVisibility = normalizeFieldVisibility(profile.field_visibility, profile);
  const safeRoleDetails: Record<string, unknown> = {};
  for (const key of [
    "education_level", "field_of_study", "career_goal", "target_roles", "target_sectors", "contract_preferences",
    "years_experience", "expertise_domain", "teaching_languages", "qualifications", "teaching_formats",
    "experience_summary", "organizer_type", "organization_name", "event_topics", "moderation_domains",
    "recruitment_sectors", "recruitment_countries", "coaching_topics", "session_languages",
  ]) {
    if (!isFieldVisible(fieldVisibility, key)) continue;
    if (roleDetails[key] !== undefined && roleDetails[key] !== null && roleDetails[key] !== "") safeRoleDetails[key] = roleDetails[key];
  }

  const user = bundle.user as Record<string, unknown>;
  if (String(user.status || "") === "suspendu" && !viewerIsAdmin) {
    return json({ error: "PROFILE_SUSPENDED", message: "Ce profil est temporairement indisponible." }, 404);
  }

  const showCity = isFieldVisible(fieldVisibility, "city");
  const showCountry = isFieldVisible(fieldVisibility, "country_code");
  const response = {
    id: user.id,
    display_name: isFieldVisible(fieldVisibility, "display_name")
      ? profile.display_name || user.full_name || "Membre Omnia"
      : "Membre Omnia",
    avatar_url: isFieldVisible(fieldVisibility, "avatar_url") ? user.avatar_url || null : null,
    headline: isFieldVisible(fieldVisibility, "headline") ? profile.headline || null : null,
    bio: isFieldVisible(fieldVisibility, "bio") ? profile.bio || null : null,
    city: showCity ? profile.city || null : null,
    country_code: showCountry ? user.country_code || null : null,
    languages: isFieldVisible(fieldVisibility, "languages") ? profile.languages || [] : [],
    skills: isFieldVisible(fieldVisibility, "skills") ? profile.skills || [] : [],
    interests: isFieldVisible(fieldVisibility, "interests") ? profile.interests || [] : [],
    website_url: isFieldVisible(fieldVisibility, "website_url") ? profile.website_url || null : null,
    linkedin_url: isFieldVisible(fieldVisibility, "linkedin_url") ? profile.linkedin_url || null : null,
    portfolio_url: isFieldVisible(fieldVisibility, "portfolio_url") ? profile.portfolio_url || null : null,
    github_url: isFieldVisible(fieldVisibility, "github_url") ? profile.github_url || null : null,
    availability_text: isFieldVisible(fieldVisibility, "availability_text") ? profile.availability_text || null : null,
    email: isFieldVisible(fieldVisibility, "public_email", false) ? profile.public_email || null : null,
    phone: isFieldVisible(fieldVisibility, "public_phone", false) ? profile.public_phone || null : null,
    roles: isFieldVisible(fieldVisibility, "roles") ? bundle.roles : [],
    show_achievements: isFieldVisible(fieldVisibility, "achievements"),
    allow_messages: isFieldVisible(fieldVisibility, "messages"),
    role_details: safeRoleDetails,
    professor_profile: bundle.professor_profile && isFieldVisible(fieldVisibility, "expertise_domain") ? {
      expertise_domain: (bundle.professor_profile as Record<string, unknown>).expertise_domain || null,
    } : null,
    organizer_profile: bundle.organizer_profile && isFieldVisible(fieldVisibility, "organizer_metrics") ? {
      verification_status: (bundle.organizer_profile as Record<string, unknown>).verification_status || null,
      public_rating: (bundle.organizer_profile as Record<string, unknown>).public_rating || 0,
      review_count: (bundle.organizer_profile as Record<string, unknown>).review_count || 0,
      completed_events: (bundle.organizer_profile as Record<string, unknown>).completed_events || 0,
    } : null,
    coach_profile: bundle.coach_profile && isFieldVisible(fieldVisibility, "coach_metrics") ? {
      public_slug: (bundle.coach_profile as Record<string, unknown>).public_slug || null,
      status: (bundle.coach_profile as Record<string, unknown>).status || null,
      average_rating: (bundle.coach_profile as Record<string, unknown>).average_rating || 0,
      rating_count: (bundle.coach_profile as Record<string, unknown>).rating_count || 0,
      completed_sessions_count: (bundle.coach_profile as Record<string, unknown>).completed_sessions_count || 0,
    } : null,
    structure: bundle.structure && isFieldVisible(fieldVisibility, "structure") ? {
      id: (bundle.structure as Record<string, unknown>).id,
      name: (bundle.structure as Record<string, unknown>).org_name,
      type: (bundle.structure as Record<string, unknown>).org_type,
      logo_url: (bundle.structure as Record<string, unknown>).logo_url,
      city: showCity ? (bundle.structure as Record<string, unknown>).city : null,
      country: showCountry ? (bundle.structure as Record<string, unknown>).country : null,
    } : null,
    visibility,
  };

  return json({ success: true, profile: response, is_owner: viewerIsOwner });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "PATCH" && req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return json({ error: "INVALID_BODY" }, 400);
  const action = typeof body.action === "string" ? body.action.trim() : "update_profile";

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    if (action === "public_profile") return await publicProfileAction(sb, req, body);

    const session = await resolveSession(sb, req, true);
    if (isResponse(session)) return session;
    if (!session) return json({ error: "SESSION_INVALID" }, 401);
    const userId = session.userId;

    if (action === "set_preferred_language") {
      const language = cleanText(body.language, 10)?.toLowerCase() || "";
      if (!PLATFORM_LANGUAGES.has(language)) return json({ error: "INVALID_LANGUAGE" }, 400);
      const { error } = await sb.from("user_profiles").upsert({
        user_id: userId,
        preferred_language: language,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (error) throw error;
      return json({ success: true, preferred_language: language });
    }

    if (action === "get_profile") {
      const bundle = await loadProfileBundle(sb, userId, session.roles);
      if (!bundle) return json({ error: "ACCOUNT_UNAVAILABLE" }, 410);
      return json({ success: true, ...bundle });
    }

    if (action === "upload_avatar") {
      const { mime, bytes } = parseDataUrl(body.avatar_base64);
      const current = await ensureProfile(sb, userId);
      const oldPath = cleanText(current.avatar_storage_path, 800);
      const path = `${userId}/avatar-${crypto.randomUUID()}.${avatarExtension(mime)}`;
      const { error: uploadError } = await sb.storage.from(PROFILE_BUCKET).upload(path, bytes, {
        contentType: mime,
        cacheControl: "31536000",
        upsert: false,
      });
      if (uploadError) throw uploadError;
      const publicUrl = sb.storage.from(PROFILE_BUCKET).getPublicUrl(path).data.publicUrl;
      if (!publicUrl) throw new Error("AVATAR_PUBLIC_URL_UNAVAILABLE");

      const [{ error: userError }, { error: profileError }] = await Promise.all([
        sb.from("users").update({ avatar_url: publicUrl, updated_at: new Date().toISOString() }).eq("id", userId),
        sb.from("user_profiles").upsert({ user_id: userId, avatar_storage_path: path }, { onConflict: "user_id" }),
      ]);
      if (userError) throw userError;
      if (profileError) throw profileError;
      if (oldPath && oldPath !== path) await ignoreFailure(sb.storage.from(PROFILE_BUCKET).remove([oldPath]));

      const bundle = await loadProfileBundle(sb, userId, session.roles);
      return json({ success: true, avatar_url: publicUrl, ...(bundle || {}) });
    }

    if (action === "remove_avatar") {
      const current = await ensureProfile(sb, userId);
      const oldPath = cleanText(current.avatar_storage_path, 800);
      const [{ error: userError }, { error: profileError }] = await Promise.all([
        sb.from("users").update({ avatar_url: null, updated_at: new Date().toISOString() }).eq("id", userId),
        sb.from("user_profiles").upsert({ user_id: userId, avatar_storage_path: null }, { onConflict: "user_id" }),
      ]);
      if (userError) throw userError;
      if (profileError) throw profileError;
      if (oldPath) await ignoreFailure(sb.storage.from(PROFILE_BUCKET).remove([oldPath]));
      const bundle = await loadProfileBundle(sb, userId, session.roles);
      return json({ success: true, ...(bundle || {}) });
    }

    if (action === "block_user" || action === "unblock_user") {
      const targetUserId = cleanText(body.target_user_id, 80);
      const reason = cleanText(body.reason, 300);
      if (!targetUserId) return json({ error: "TARGET_USER_REQUIRED" }, 400);
      if (targetUserId === userId) return json({ error: "CANNOT_BLOCK_SELF" }, 400);

      const { data: target, error: targetError } = await sb.from("users")
        .select("id,status")
        .eq("id", targetUserId)
        .maybeSingle();
      if (targetError) throw targetError;
      if (!target || target.status === "supprime") return json({ error: "TARGET_USER_NOT_FOUND" }, 404);

      if (action === "block_user") {
        const { error } = await sb.from("user_blocks").upsert({
          blocker_user_id: userId,
          blocked_user_id: targetUserId,
          reason,
        }, { onConflict: "blocker_user_id,blocked_user_id" });
        if (error) throw error;
        return json({ success: true, blocked: true, target_user_id: targetUserId });
      }

      const { error } = await sb.from("user_blocks").delete()
        .eq("blocker_user_id", userId)
        .eq("blocked_user_id", targetUserId);
      if (error) throw error;
      return json({ success: true, blocked: false, target_user_id: targetUserId });
    }

    if (action === "list_blocked_users") {
      const { data: blocks, error: blocksError } = await sb.from("user_blocks")
        .select("blocked_user_id,reason,created_at")
        .eq("blocker_user_id", userId)
        .order("created_at", { ascending: false });
      if (blocksError) throw blocksError;

      const blockedIds = (blocks || []).map((row: { blocked_user_id: string }) => row.blocked_user_id);
      const { data: blockedUsers, error: usersError } = blockedIds.length
        ? await sb.from("users").select("id,full_name,status").in("id", blockedIds)
        : { data: [], error: null };
      if (usersError) throw usersError;
      const nameMap = new Map((blockedUsers || []).map((row: { id: string; full_name: string }) => [row.id, row.full_name] as const));

      return json({
        success: true,
        blocked_users: (blocks || []).map((row: { blocked_user_id: string; reason?: string | null; created_at: string }) => ({
          user_id: row.blocked_user_id,
          full_name: nameMap.get(row.blocked_user_id) || "Utilisateur",
          reason: row.reason || null,
          blocked_at: row.created_at,
        })),
      });
    }

    if (action === "suspend_account") {
      const currentPassword = typeof body.current_password === "string" ? body.current_password : "";
      const confirmation = typeof body.confirmation === "string" ? body.confirmation.trim() : "";
      const reasonCode = typeof body.reason_code === "string" ? body.reason_code.trim() : "";
      const source = body.source === "web" ? "web" : "app";
      const feedback = cleanFeedback(body.feedback);
      const suspendedUntilText = typeof body.suspended_until === "string" ? body.suspended_until.trim() : "";
      const suspendedUntil = suspendedUntilText ? new Date(suspendedUntilText) : null;

      if (!currentPassword || confirmation !== "SUSPENDRE") {
        return json({ error: "SUSPENSION_CONFIRMATION_REQUIRED", message: "Confirmation de suspension invalide." }, 400);
      }
      if (!Object.hasOwn(SUSPENSION_REASON_LABELS, reasonCode)) {
        return json({ error: "INVALID_SUSPENSION_REASON", message: "Choisissez un motif de suspension valide." }, 400);
      }
      if (suspendedUntil && (Number.isNaN(suspendedUntil.getTime()) || suspendedUntil <= new Date() || suspendedUntil.getTime() > Date.now() + 366 * 24 * 60 * 60 * 1000)) {
        return json({ error: "INVALID_SUSPENSION_UNTIL", message: "La date de retour prévue doit être future et située dans les 12 prochains mois." }, 400);
      }

      const { data: account, error: accountError } = await sb.from("users")
        .select("id,email,password_hash,status,suspension_source")
        .eq("id", userId)
        .maybeSingle();
      if (accountError) throw accountError;
      if (!account || account.status === "supprime") {
        return json({ error: "ACCOUNT_UNAVAILABLE", message: "Ce compte est supprimé ou inaccessible." }, 410);
      }
      if (String(account.email || "").toLowerCase() === "test@omniaglobalacademy.com") {
        return json({ error: "DEMO_ACCOUNT_PROTECTED", message: "Le compte de démonstration ne peut pas être suspendu." }, 403);
      }

      const passwordValid = await bcrypt.compare(currentPassword, String(account.password_hash || ""));
      if (!passwordValid) return json({ error: "INVALID_PASSWORD", message: "Mot de passe actuel incorrect." }, 403);

      const { data: suspension, error: suspensionError } = await sb.rpc("omnia_suspend_user_account", {
        p_user_id: userId,
        p_reason_code: reasonCode,
        p_suspended_until: suspendedUntil ? suspendedUntil.toISOString() : null,
        p_source: source,
      });
      if (suspensionError) {
        const message = String(suspensionError.message || "");
        if (message.includes("LAST_SUPER_ADMIN_PROTECTED")) {
          return json({ error: "LAST_SUPER_ADMIN_PROTECTED", message: "Le compte système de l’Administration Omnia ne peut pas suspendre son compte." }, 409);
        }
        if (message.includes("DEMO_ACCOUNT_PROTECTED")) {
          return json({ error: "DEMO_ACCOUNT_PROTECTED", message: "Le compte de démonstration ne peut pas être suspendu." }, 403);
        }
        if (message.includes("ACCOUNT_NOT_ACTIVE")) {
          return json({ error: "ACCOUNT_NOT_ACTIVE", message: "Seul un compte actif peut être suspendu volontairement." }, 409);
        }
        throw suspensionError;
      }

      const suspensionReference = String(suspension?.suspension_reference || "");
      if (suspensionReference) await saveExitFeedback(sb, suspensionReference, "suspension", reasonCode, feedback);

      return json({
        success: true,
        account_suspended: true,
        suspension_reference: suspensionReference || null,
        suspended_at: suspension?.suspended_at || new Date().toISOString(),
        suspended_until: suspension?.suspended_until || null,
        reactivation: "password_login",
      });
    }

    if (action === "delete_account") {
      const currentPassword = typeof body.current_password === "string" ? body.current_password : "";
      const confirmation = typeof body.confirmation === "string" ? body.confirmation.trim() : "";
      const reasonCodeInput = typeof body.reason_code === "string" ? body.reason_code.trim() : "";
      const reasonCode = Object.hasOwn(DELETION_REASON_LABELS, reasonCodeInput) ? reasonCodeInput : "other";
      const legacyReason = cleanText(body.reason, 500);
      const reason = legacyReason || DELETION_REASON_LABELS[reasonCode];
      const feedback = cleanFeedback(body.feedback);
      const source = body.source === "web" ? "web" : "app";

      if (!currentPassword || confirmation !== "SUPPRIMER") {
        return json({ error: "DELETION_CONFIRMATION_REQUIRED", message: "Confirmation de suppression invalide." }, 400);
      }

      const { data: account, error: accountError } = await sb.from("users")
        .select("id,email,password_hash,status")
        .eq("id", userId)
        .maybeSingle();
      if (accountError) throw accountError;
      if (!account || account.status === "supprime") {
        return json({ error: "ACCOUNT_UNAVAILABLE", message: "Ce compte est déjà supprimé ou inaccessible." }, 410);
      }
      if (String(account.email || "").toLowerCase() === "test@omniaglobalacademy.com") {
        return json({ error: "DEMO_ACCOUNT_PROTECTED", message: "Le compte de démonstration ne peut pas être supprimé." }, 403);
      }

      const passwordValid = await bcrypt.compare(currentPassword, String(account.password_hash || ""));
      if (!passwordValid) return json({ error: "INVALID_PASSWORD", message: "Mot de passe actuel incorrect." }, 403);

      const { data: deletion, error: deletionError } = await sb.rpc("omnia_delete_user_account", {
        p_user_id: userId,
        p_reason: reason,
        p_source: source,
      });
      if (deletionError) {
        const message = String(deletionError.message || "");
        if (message.includes("LAST_SUPER_ADMIN_PROTECTED")) {
          return json({ error: "LAST_SUPER_ADMIN_PROTECTED", message: "Le compte système de l’Administration Omnia ne peut pas supprimer son compte." }, 409);
        }
        if (message.includes("DEMO_ACCOUNT_PROTECTED")) {
          return json({ error: "DEMO_ACCOUNT_PROTECTED", message: "Le compte de démonstration ne peut pas être supprimé." }, 403);
        }
        throw deletionError;
      }

      const deletionReference = String(deletion?.deletion_reference || "");
      let feedbackReference: string | null = null;
      if (deletionReference) {
        feedbackReference = await saveExitFeedback(sb, deletionReference, "deletion", reasonCode, feedback);
        const { error: auditUpdateError } = await sb.from("account_deletion_audit").update({
          reason_code: reasonCode,
          feedback_reference: feedbackReference,
        }).eq("deletion_reference", deletionReference);
        if (auditUpdateError) console.error("account_deletion_audit metadata update failed:", auditUpdateError.message);
      }

      return json({
        success: true,
        account_deleted: true,
        deletion_reference: deletionReference || null,
        deleted_at: deletion?.deleted_at || new Date().toISOString(),
        retained_categories: deletion?.retained_categories || [],
      });
    }

    const requestedUser = (body.user && typeof body.user === "object" ? body.user : body) as Record<string, unknown>;
    const requestedProfile = (body.profile && typeof body.profile === "object" ? { ...body.profile as Record<string, unknown> } : {}) as Record<string, unknown>;
    const legacyProfessorProfile = (body.professor_profile && typeof body.professor_profile === "object"
      ? body.professor_profile
      : {}) as Record<string, unknown>;
    if (requestedProfile.bio === undefined && legacyProfessorProfile.bio !== undefined) requestedProfile.bio = legacyProfessorProfile.bio;
    const requestedRoleDetails = (body.role_details && typeof body.role_details === "object"
      ? { ...body.role_details as Record<string, unknown> }
      : requestedProfile.role_details && typeof requestedProfile.role_details === "object"
        ? { ...requestedProfile.role_details as Record<string, unknown> }
        : {}) as Record<string, unknown>;
    if (requestedRoleDetails.expertise_domain === undefined && legacyProfessorProfile.expertise_domain !== undefined) {
      requestedRoleDetails.expertise_domain = legacyProfessorProfile.expertise_domain;
    }

    const userUpdates: Record<string, unknown> = {};
    for (const field of USER_FIELDS) {
      if (requestedUser[field] !== undefined) userUpdates[field] = requestedUser[field] === "" ? null : requestedUser[field];
    }
    if (userUpdates.email) {
      const email = String(userUpdates.email).trim().toLowerCase();
      const { data: existing } = await sb.from("users").select("id").eq("email", email).neq("id", userId).maybeSingle();
      if (existing) return json({ error: "EMAIL_TAKEN" }, 409);
      userUpdates.email = email;
    }
    if (userUpdates.phone_number) {
      const phone = String(userUpdates.phone_number).trim();
      const { data: existing } = await sb.from("users").select("id").eq("phone_number", phone).neq("id", userId).maybeSingle();
      if (existing) return json({ error: "PHONE_TAKEN" }, 409);
      userUpdates.phone_number = phone;
    }
    if (userUpdates.full_name !== undefined) {
      userUpdates.full_name = cleanText(userUpdates.full_name, 255);
      if (!userUpdates.full_name) return json({ error: "FULL_NAME_REQUIRED" }, 400);
    }
    if (userUpdates.email !== undefined && !userUpdates.email) return json({ error: "EMAIL_REQUIRED" }, 400);
    if (userUpdates.phone_number !== undefined && !userUpdates.phone_number) return json({ error: "PHONE_REQUIRED" }, 400);
    if (userUpdates.country_code !== undefined) {
      userUpdates.country_code = cleanText(userUpdates.country_code, 10)?.toUpperCase();
      if (!userUpdates.country_code) return json({ error: "COUNTRY_REQUIRED" }, 400);
    }
    if (userUpdates.birth_date !== undefined) {
      userUpdates.birth_date = cleanText(userUpdates.birth_date, 20);
      if (!userUpdates.birth_date) return json({ error: "BIRTH_DATE_REQUIRED" }, 400);
    }

    const profileUpdates = sanitizeProfile(requestedProfile);
    const legacyVisibilityRequested = PROFILE_BOOLEAN_FIELDS.some(field => requestedProfile[field] !== undefined);
    if (profileUpdates.field_visibility && typeof profileUpdates.field_visibility === "object") {
      const map = profileUpdates.field_visibility as Record<string, boolean>;
      profileUpdates.show_email = isFieldVisible(map, "public_email", false);
      profileUpdates.show_phone = isFieldVisible(map, "public_phone", false);
      profileUpdates.show_location = isFieldVisible(map, "city") || isFieldVisible(map, "country_code");
      profileUpdates.show_roles = isFieldVisible(map, "roles");
      profileUpdates.show_achievements = isFieldVisible(map, "achievements");
      profileUpdates.allow_messages = isFieldVisible(map, "messages");
    } else if (legacyVisibilityRequested) {
      const currentProfile = await ensureProfile(sb, userId);
      const map = normalizeFieldVisibility(currentProfile.field_visibility, currentProfile);
      if (requestedProfile.show_email !== undefined) map.public_email = Boolean(requestedProfile.show_email);
      if (requestedProfile.show_phone !== undefined) map.public_phone = Boolean(requestedProfile.show_phone);
      if (requestedProfile.show_location !== undefined) {
        map.city = Boolean(requestedProfile.show_location);
        map.country_code = Boolean(requestedProfile.show_location);
      }
      if (requestedProfile.show_roles !== undefined) map.roles = Boolean(requestedProfile.show_roles);
      if (requestedProfile.show_achievements !== undefined) map.achievements = Boolean(requestedProfile.show_achievements);
      if (requestedProfile.allow_messages !== undefined) map.messages = Boolean(requestedProfile.allow_messages);
      profileUpdates.field_visibility = map;
    }
    if (session.roles.includes("super_admin")) {
      profileUpdates.visibility = "private";
      profileUpdates.show_email = false;
      profileUpdates.show_phone = false;
      profileUpdates.show_location = false;
      profileUpdates.show_roles = false;
      profileUpdates.show_achievements = false;
      profileUpdates.allow_messages = false;
      profileUpdates.field_visibility = Object.fromEntries(
        Object.keys(FIELD_VISIBILITY_DEFAULTS).map(key => [key, false]),
      );
    }
    const roleDetails = sanitizeRoleDetails(requestedRoleDetails);
    if (Object.keys(roleDetails).length) {
      const currentProfile = await ensureProfile(sb, userId);
      const currentDetails = currentProfile.role_details && typeof currentProfile.role_details === "object"
        ? currentProfile.role_details as Record<string, unknown>
        : {};
      profileUpdates.role_details = { ...currentDetails, ...roleDetails };
    }

    if (!Object.keys(userUpdates).length && !Object.keys(profileUpdates).length) {
      return json({ error: "NO_VALID_FIELDS", message: "Aucun champ valide fourni." }, 400);
    }

    if (Object.keys(userUpdates).length) {
      userUpdates.updated_at = new Date().toISOString();
      const { error } = await sb.from("users").update(userUpdates).eq("id", userId);
      if (error) throw error;
    }
    if (Object.keys(profileUpdates).length) {
      const { error } = await sb.from("user_profiles").upsert({
        user_id: userId,
        ...profileUpdates,
      }, { onConflict: "user_id" });
      if (error) throw error;
    }

    if (userUpdates.subscribe_newsletter !== undefined) {
      const { data: newsletterUser, error: newsletterUserError } = await sb.from("users")
        .select("email")
        .eq("id", userId)
        .single();
      if (newsletterUserError) throw newsletterUserError;
      const currentProfile = await ensureProfile(sb, userId);
      await setNewsletterConsent(sb, {
        userId,
        email: String(newsletterUser.email || ""),
        active: Boolean(userUpdates.subscribe_newsletter),
        source: "profile",
        locale: cleanText(currentProfile.preferred_language, 8),
      });
    }

    const bundle = await loadProfileBundle(sb, userId, session.roles);
    if (!bundle) return json({ error: "ACCOUNT_UNAVAILABLE" }, 410);
    await synchronizeRoleProfiles(
      sb,
      userId,
      bundle.roles,
      bundle.user as Record<string, unknown>,
      bundle.profile as Record<string, unknown>,
    );
    const refreshed = await loadProfileBundle(sb, userId, session.roles);
    return json({ success: true, ...(refreshed || bundle) });
  } catch (error) {
    console.error("auth-update-profile", error);
    const message = error instanceof Error ? error.message : "SERVER_ERROR";
    if (message.startsWith("INVALID_URL:")) return json({ error: "INVALID_URL", field: message.split(":")[1] }, 400);
    if (["INVALID_VISIBILITY", "INVALID_FIELD_VISIBILITY", "INVALID_AVATAR_DATA", "INVALID_AVATAR_TYPE", "AVATAR_TOO_LARGE"].includes(message)) {
      return json({ error: message }, 400);
    }
    return json({ error: "SERVER_ERROR" }, 500);
  }
});
