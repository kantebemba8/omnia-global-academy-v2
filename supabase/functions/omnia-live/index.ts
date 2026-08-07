import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand } from "npm:@aws-sdk/client-s3@3.637.0";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@3.637.0";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import { hasStructurePermission, validatedStructureAccess, type ValidatedStructureAccess } from "../_shared/structure-access.ts";

/*
  OMNIA LIVE — FINAL CONSOLIDATED EDGE FUNCTION

  Sensitive production integrations remain controlled by feature flags:
  - fedapay_live_payments
  - server_recording
  - sms_notifications
  - push_notifications

  Structure-bound private-code membership validation still requires the
  canonical Structure-membership table to be identified in the project schema.
  This file deliberately does not guess a table name and risk unsafe access.
*/


const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-omnia-session-token",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function supabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? Deno.env.get("DB_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("DB_SERVICE_ROLE_KEY") ?? "",
  );
}

function tokenFrom(req: Request) {
  return (
    req.headers.get("x-omnia-session-token")
    ?? req.headers.get("Authorization")
    ?? ""
  ).replace(/^Bearer\s+/i, "").trim();
}

async function sessionContext(sb: ReturnType<typeof createClient>, token: string) {
  if (!token) return null;
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("DB_SERVICE_ROLE_KEY") || "";
  if (serviceRole && token === serviceRole) {
    return { user: { id: "service", full_name: "Service", email: "service@omnia.local", status: "actif" }, userId: "service", roles: ["service_role"], structureOrganizationId: null, structureAccess: null as ValidatedStructureAccess | null };
  }

  const { data: session } = await sb
    .from("user_sessions")
    .select("user_id,expires_at")
    .eq("session_token", token)
    .maybeSingle();

  if (!session || !session.expires_at || new Date(session.expires_at) <= new Date()) return null;

  const userId = (session as { user_id: string }).user_id;

  const { data: user } = await sb
    .from("users")
    .select("id,full_name,email,status")
    .eq("id", userId)
    .maybeSingle();

  if (!user || user.status === "suspendu") return null;

  const { data: roleRows } = await sb
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  const roles = (roleRows ?? []).map((r: { role: string }) => r.role);
  const structureAccess = await validatedStructureAccess(sb, userId);

  return { user, userId, roles, structureOrganizationId: structureAccess?.organizationId || null, structureAccess: structureAccess || null };
}

function isSuperAdmin(ctx: Awaited<ReturnType<typeof sessionContext>>) {
  return !!ctx?.roles.includes("super_admin");
}

function isService(ctx: Awaited<ReturnType<typeof sessionContext>>) {
  return !!ctx?.roles.includes("service_role");
}

function hasStructureOrganizerRole(ctx: Awaited<ReturnType<typeof sessionContext>>) {
  return Boolean(ctx?.roles.some((r) => [
    "etablissement_directeur", "responsable_structure", "gestionnaire_structure",
    "structure_admin", "directeur", "gestionnaire_partenaire",
  ].includes(r)));
}

function canManageStructureLive(ctx: Awaited<ReturnType<typeof sessionContext>>) {
  return Boolean(ctx && hasStructureOrganizerRole(ctx) && hasStructurePermission(ctx.structureAccess, "can_manage_omnia_live"));
}

function ownerEventAccess(
  ctx: Awaited<ReturnType<typeof sessionContext>>,
  event: any,
) {
  if (!ctx || !event || String(event.owner_user_id || "") !== ctx.userId) return false;
  if (String(event.organizer_kind || "") === "structure") return canManageStructureLive(ctx);
  return true;
}

async function featureFlagEnabled(
  sb: ReturnType<typeof createClient>,
  flagKey: string,
  fallback = false,
) {
  const { data, error } = await sb
    .from("live_feature_flags")
    .select("enabled")
    .eq("flag_key", flagKey)
    .maybeSingle();

  if (error) {
    console.error("featureFlagEnabled", flagKey, error);
    return fallback;
  }

  return data ? Boolean(data.enabled) : fallback;
}

async function organizerLiveLimit(sb: ReturnType<typeof createClient>, userId: string) {
  const { data: definition } = await sb.from("commerce_benefit_definitions").select("id").eq("benefit_key", "organizer_live_limit").eq("is_active", true).maybeSingle();
  if (!definition) return 1;
  const now = new Date().toISOString();
  const { data: rights } = await sb.from("commerce_entitlements").select("remaining_quantity,value_json")
    .eq("user_id", userId).eq("benefit_definition_id", definition.id).eq("status", "active").lte("valid_from", now)
    .or(`valid_until.is.null,valid_until.gte.${now}`);
  let limit = 1;
  for (const right of rights || []) {
    const value = Number(right.remaining_quantity ?? right.value_json?.capacity ?? right.value_json?.value ?? 0);
    if (Number.isFinite(value)) limit = Math.max(limit, value);
  }
  return limit;
}

async function ensureOrganizerLiveCapacity(sb: ReturnType<typeof createClient>, userId: string, currentEventId: string) {
  const limit = await organizerLiveLimit(sb, userId);
  const { count } = await sb.from("live_events").select("id", { count: "exact", head: true })
    .eq("owner_user_id", userId).neq("id", currentEventId)
    .in("status", ["submitted", "under_review", "approved", "published", "live"]);
  return { allowed: Number(count || 0) < limit, limit, active: Number(count || 0) };
}

function canOrganize(ctx: Awaited<ReturnType<typeof sessionContext>>) {
  if (!ctx) return false;
  if (ctx.roles.some((r) => ["super_admin", "organizer", "organisateur", "professeur"].includes(r))) return true;
  return canManageStructureLive(ctx);
}

const ORGANIZER_PREVIEW_EMAIL = "organisateur.test@omniaglobalacademy.com";
const ORGANIZER_PREVIEW_READ_ACTIONS = new Set([
  "categories",
  "get",
  "studio_get",
  "organizer_profile_me",
  "organizer_dashboard",
  "organizer_events",
  "organizer_participants",
  "organizer_media",
  "organizer_cancellations",
  "organizer_access_codes",
  "organizer_analytics",
  "organizer_ledger_mine",
  "payout_requests_mine",
  "analytics_event_kpis",
  "analytics_event_history",
  "communication_campaigns_list",
  "automation_rules_list",
  "report_exports_list",
]);

async function organizerPreviewContext(
  sb: ReturnType<typeof createClient>,
): Promise<NonNullable<Awaited<ReturnType<typeof sessionContext>>>> {
  const { data: user, error } = await sb
    .from("users")
    .select("id,full_name,email,status")
    .ilike("email", ORGANIZER_PREVIEW_EMAIL)
    .maybeSingle();
  if (error) throw error;
  if (!user?.id || user.status === "suspendu") {
    throw new Error("ORGANIZER_PREVIEW_ACCOUNT_MISSING");
  }
  return {
    user,
    userId: String(user.id),
    roles: ["organisateur"],
    structureOrganizationId: null,
    structureAccess: null,
  };
}

function organizerKind(ctx: Awaited<ReturnType<typeof sessionContext>>, requestedScope = "") {
  if (!ctx) return "user";
  if (ctx.roles.includes("super_admin")) return "omnia";

  const structureAllowed = canManageStructureLive(ctx);
  const independentCreator = ctx.roles.some((r) => ["organizer", "organisateur", "professeur"].includes(r));
  if (requestedScope === "structure") return structureAllowed ? "structure" : "forbidden";
  if (requestedScope === "personal") return independentCreator ? "user" : "forbidden";
  if (structureAllowed && !independentCreator) return "structure";
  return "user";
}

function makeSlug(title: string) {
  const base =
    title
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70) || "omnia-live";

  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

const EVENT_TYPES = new Set([
  "class_live",
  "masterclass",
  "workshop",
  "webinar",
  "conference",
  "event",
]);

const DELIVERY_TYPES = new Set([
  "single_live",
  "synchronous_training",
  "recorded_video",
]);

const VISIBILITIES = new Set([
  "public",
  "private",
  "structure",
  "invitation",
  "training_only",
]);

const LEVELS = new Set([
  "beginner",
  "intermediate",
  "advanced",
  "all",
]);

const SPEAKER_ROLES = new Set([
  "organizer",
  "co_organizer",
  "speaker",
  "moderator",
  "trainer",
]);

const WAITING_ROOM_VALUES = new Set([0, 15, 30, 45, 60]);

function cleanEventInput(body: Record<string, unknown>, create = false) {
  const out: Record<string, unknown> = {};

  const textFields = [
    "title",
    "short_description",
    "long_description",
    "language",
    "timezone",
    "replay_access_policy",
    "cover_url",
    "cover_source",
    "cover_ai_prompt",
    "cover_template_key",
    "prerequisites",
    "organizer_message_to_admin",
  ];

  for (const key of textFields) {
    if (body[key] !== undefined) out[key] = body[key];
  }

  if (body.event_type !== undefined && EVENT_TYPES.has(String(body.event_type))) {
    out.event_type = body.event_type;
  }

  if (body.delivery_type !== undefined && DELIVERY_TYPES.has(String(body.delivery_type))) {
    out.delivery_type = body.delivery_type;
  }

  if (body.visibility !== undefined && VISIBILITIES.has(String(body.visibility))) {
    out.visibility = body.visibility;
  }

  if (body.level !== undefined && LEVELS.has(String(body.level))) {
    out.level = body.level;
  }

  for (const key of [
    "starts_at",
    "category_id",
    "registration_opens_at",
    "registration_closes_at",
  ]) {
    if (body[key] !== undefined) out[key] = body[key] || null;
  }

  for (const key of [
    "duration_minutes",
    "max_participants",
    "minimum_participants",
    "price_amount",
    "proposed_replay_price_amount",
    "replay_availability_days",
  ]) {
    if (body[key] !== undefined) {
      out[key] = body[key] === null || body[key] === "" ? null : Number(body[key]);
    }
  }

  if (body.waiting_room_minutes !== undefined) {
    const value = Number(body.waiting_room_minutes);
    if (WAITING_ROOM_VALUES.has(value)) out.waiting_room_minutes = value;
  }

  if (body.currency !== undefined) {
    out.currency = String(body.currency).toUpperCase().slice(0, 3);
  }

  for (const key of [
    "replay_enabled",
    "allow_late_registration",
    "certificate_requested",
    "cpd_requested",
    "replay_sale_enabled",
  ]) {
    if (body[key] !== undefined) out[key] = Boolean(body[key]);
  }

  if (body.learning_outcomes !== undefined) {
    out.learning_outcomes = Array.isArray(body.learning_outcomes)
      ? body.learning_outcomes
      : [];
  }

  if (body.program !== undefined) {
    out.program = Array.isArray(body.program) ? body.program : [];
  }

  for (const key of [
    "refund_policy_snapshot",
    "cancellation_policy_snapshot",
    "private_access_config",
    "interaction_settings",
    "certificate_request_config",
    "organizer_refund_proposal",
    "organizer_cancellation_proposal",
  ]) {
    if (body[key] !== undefined) out[key] = body[key];
  }

  if (create && !out.title) out.title = "Nouveau Live";

  out.updated_at = new Date().toISOString();

  return out;
}

async function eventForAccess(
  sb: ReturnType<typeof createClient>,
  eventId: string,
) {
  const { data } = await sb
    .from("live_events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle();

  return data;
}

async function canManageEvent(
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
  eventId: string,
) {
  if (!ctx) return false;
  if (isSuperAdmin(ctx)) return true;

  const ev = await eventForAccess(sb, eventId);
  return ownerEventAccess(ctx, ev);
}

async function reviewLog(
  sb: ReturnType<typeof createClient>,
  params: {
    eventId: string;
    action: string;
    actorUserId?: string | null;
    fromStatus?: string | null;
    toStatus?: string | null;
    message?: string | null;
    snapshot?: unknown;
  },
) {
  const { error } = await sb.from("live_review_history").insert({
    event_id: params.eventId,
    action: params.action,
    actor_user_id: params.actorUserId ?? null,
    from_status: params.fromStatus ?? null,
    to_status: params.toStatus ?? null,
    message: params.message ?? null,
    snapshot: params.snapshot ?? null,
  });

  if (error) {
    console.error("live_review_history insert error:", error);
  }
}

async function publicList(
  req: Request,
  sb: ReturnType<typeof createClient>,
) {
  const url = new URL(req.url);

  const delivery = url.searchParams.get("delivery_type");
  const eventType = url.searchParams.get("event_type");
  const status = url.searchParams.get("status");
  const categoryId = url.searchParams.get("category_id");
  const language = url.searchParams.get("language");
  const level = url.searchParams.get("level");
  const search = (url.searchParams.get("q") ?? "").trim();
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit") ?? 24), 1),
    100,
  );

  let q = sb
    .from("live_events")
    .select(
      "id,title,slug,short_description,event_type,delivery_type,language,level,category_id,starts_at,timezone,duration_minutes,max_participants,price_amount,currency,replay_enabled,cover_url,organizer_display_name,organizer_kind,status,featured,created_at",
    )
    .eq("visibility", "public")
    .in("status", ["published", "live", "completed"])
    .order("featured", { ascending: false })
    .order("starts_at", { ascending: true, nullsFirst: false })
    .limit(limit);

  if (delivery && DELIVERY_TYPES.has(delivery)) q = q.eq("delivery_type", delivery);
  if (eventType && EVENT_TYPES.has(eventType)) q = q.eq("event_type", eventType);
  if (status && ["published", "live", "completed"].includes(status)) q = q.eq("status", status);
  if (categoryId) q = q.eq("category_id", categoryId);
  if (language) q = q.eq("language", language);
  if (level && LEVELS.has(level)) q = q.eq("level", level);

  if (search) {
    const safe = search.replace(/[%_,()]/g, "");
    q = q.or(
      `title.ilike.%${safe}%,short_description.ilike.%${safe}%,organizer_display_name.ilike.%${safe}%`,
    );
  }

  const { data, error } = await q;

  if (error) throw error;

  return json({
    success: true,
    items: data ?? [],
  });
}

async function categories(
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
  req: Request,
) {
  const includeInactive =
    isSuperAdmin(ctx) &&
    new URL(req.url).searchParams.get("include_inactive") === "true";

  let q = sb
    .from("live_categories")
    .select("*")
    .order("display_order")
    .order("name");

  if (!includeInactive) q = q.eq("is_active", true);

  const { data, error } = await q;

  if (error) throw error;

  return json({
    success: true,
    categories: data ?? [],
  });
}

async function getEvent(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  const url = new URL(req.url);
  const eventId = url.searchParams.get("event_id");
  const slug = url.searchParams.get("slug");

  if (!eventId && !slug) {
    return json({ error: "EVENT_IDENTIFIER_REQUIRED" }, 400);
  }

  let q = sb.from("live_events").select("*");

  q = eventId ? q.eq("id", eventId) : q.eq("slug", slug!);

  const { data: ev, error } = await q.maybeSingle();

  if (error) throw error;
  if (!ev) return json({ error: "EVENT_NOT_FOUND" }, 404);

  let allowed =
    ev.visibility === "public" &&
    ["published", "live", "completed"].includes(ev.status);

  if (ctx) {
    if (isSuperAdmin(ctx) || ownerEventAccess(ctx, ev)) {
      allowed = true;
    }

    if (!allowed) {
      const { data: reg } = await sb
        .from("live_registrations")
        .select("id,status")
        .eq("event_id", ev.id)
        .eq("user_id", ctx.userId)
        .in("status", ["confirmed", "waitlisted"])
        .maybeSingle();

      allowed = !!reg;
    }
  }

  if (!allowed) return json({ error: "FORBIDDEN" }, 403);

  const { data: sessions } = await sb
    .from("live_sessions")
    .select("*")
    .eq("event_id", ev.id)
    .order("sequence_no");

  const { data: speakers } = await sb
    .from("live_event_speakers")
    .select("*")
    .eq("event_id", ev.id)
    .order("display_order");

  const { data: media } = await sb
    .from("live_media")
    .select(
      "id,session_id,media_type,status,title,description,mime_type,file_name,size_bytes,duration_seconds,access_policy,availability_scope,available_from,available_until,watermark_enabled,version,created_at",
    )
    .eq("event_id", ev.id)
    .neq("status", "deleted")
    .order("created_at", { ascending: false });

  return json({
    success: true,
    event: ev,
    sessions: sessions ?? [],
    speakers: speakers ?? [],
    media: media ?? [],
  });
}

async function studioGet(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx) return json({ error: "AUTH_REQUIRED" }, 401);

  const eventId = new URL(req.url).searchParams.get("event_id");

  if (!eventId) return json({ error: "EVENT_ID_REQUIRED" }, 400);

  if (!(await canManageEvent(sb, ctx, eventId))) {
    return json({ error: "FORBIDDEN" }, 403);
  }

  const ev = await eventForAccess(sb, eventId);

  if (!ev) return json({ error: "EVENT_NOT_FOUND" }, 404);

  const [
    sessionsResult,
    speakersResult,
    mediaResult,
    termsResult,
    reviewResult,
  ] = await Promise.all([
    sb
      .from("live_sessions")
      .select("*")
      .eq("event_id", eventId)
      .order("sequence_no"),

    sb
      .from("live_event_speakers")
      .select("*")
      .eq("event_id", eventId)
      .order("display_order"),

    sb
      .from("live_media")
      .select("*")
      .eq("event_id", eventId)
      .neq("status", "deleted")
      .order("created_at", { ascending: false }),

    sb
      .from("live_commercial_terms")
      .select("*")
      .eq("event_id", eventId)
      .order("version", { ascending: false }),

    sb
      .from("live_review_history")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false }),
  ]);

  return json({
    success: true,
    event: ev,
    sessions: sessionsResult.data ?? [],
    speakers: speakersResult.data ?? [],
    media: mediaResult.data ?? [],
    commercial_terms: termsResult.data ?? [],
    review_history: reviewResult.data ?? [],
  });
}

async function myLives(
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx) return json({ error: "AUTH_REQUIRED" }, 401);

  const { data: regs, error } = await sb
    .from("live_registrations")
    .select(
      "id,status,access_source,registered_at,event_id,live_events(*)",
    )
    .eq("user_id", ctx.userId)
    .order("registered_at", { ascending: false });

  if (error) throw error;

  const { data: owned } = canOrganize(ctx)
    ? await sb
        .from("live_events")
        .select("*")
        .eq("owner_user_id", ctx.userId)
        .order("updated_at", { ascending: false })
    : ({ data: [] } as { data: unknown[] });

  return json({
    success: true,
    registrations: regs ?? [],
    organized: owned ?? [],
  });
}

async function createDraft(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx) return json({ error: "AUTH_REQUIRED" }, 401);

  if (!canOrganize(ctx)) {
    return json({ error: "ORGANIZER_PERMISSION_REQUIRED" }, 403);
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const payload = cleanEventInput(body, true);
  const requestedScope = String(body.organizer_scope || "").trim().toLowerCase();
  const resolvedOrganizerKind = organizerKind(ctx, requestedScope);
  if (resolvedOrganizerKind === "forbidden") return json({ error: "STRUCTURE_LIVE_PERMISSION_REQUIRED" }, 403);

  payload.owner_user_id = ctx.userId;
  payload.organizer_kind = resolvedOrganizerKind;
  payload.organizer_display_name =
    body.organizer_display_name ??
    (resolvedOrganizerKind === "omnia"
      ? "Omnia Global Academy"
      : ctx.user.full_name);

  payload.status = "draft";
  payload.slug = makeSlug(String(payload.title));
  payload.created_at = new Date().toISOString();

  const { data, error } = await sb
    .from("live_events")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;

  return json(
    {
      success: true,
      event: data,
    },
    201,
  );
}

async function updateDraft(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx) return json({ error: "AUTH_REQUIRED" }, 401);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const eventId = String(body.event_id ?? "");

  if (!eventId) return json({ error: "EVENT_ID_REQUIRED" }, 400);

  if (!(await canManageEvent(sb, ctx, eventId))) {
    return json({ error: "FORBIDDEN" }, 403);
  }

  const ev = await eventForAccess(sb, eventId);

  if (!ev) return json({ error: "EVENT_NOT_FOUND" }, 404);

  if (
    !isSuperAdmin(ctx) &&
    !["draft", "changes_requested"].includes(ev.status)
  ) {
    return json(
      {
        error: "EVENT_NOT_EDITABLE",
        status: ev.status,
      },
      409,
    );
  }

  const payload = cleanEventInput(body);

  delete payload.status;
  delete payload.slug;
  delete payload.owner_user_id;

  const { data, error } = await sb
    .from("live_events")
    .update(payload)
    .eq("id", eventId)
    .select("*")
    .single();

  if (error) throw error;

  return json({
    success: true,
    event: data,
    message:
      body.decision === "start_review" ? "Examen commencé." :
      body.decision === "request_changes" ? "Demande de modifications envoyée à l’organisateur." :
      body.decision === "approve" ? "Live approuvé." :
      body.decision === "reject" ? "Live refusé." :
      body.decision === "suspend" ? "Live suspendu." : "Action enregistrée.",
  });
}

async function saveSessions(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx) return json({ error: "AUTH_REQUIRED" }, 401);

  const body = (await req.json().catch(() => ({}))) as {
    event_id?: string;
    sessions?: Array<Record<string, unknown>>;
  };

  const eventId = body.event_id ?? "";

  if (!eventId) return json({ error: "EVENT_ID_REQUIRED" }, 400);

  if (!(await canManageEvent(sb, ctx, eventId))) {
    return json({ error: "FORBIDDEN" }, 403);
  }

  const ev = await eventForAccess(sb, eventId);

  if (!ev) return json({ error: "EVENT_NOT_FOUND" }, 404);

  if (
    !isSuperAdmin(ctx) &&
    !["draft", "changes_requested"].includes(ev.status)
  ) {
    return json({ error: "EVENT_NOT_EDITABLE" }, 409);
  }

  const sessions = Array.isArray(body.sessions) ? body.sessions : [];

  if (sessions.length > 100) {
    return json({ error: "TOO_MANY_SESSIONS" }, 400);
  }

  for (const [index, session] of sessions.entries()) {
    if (!session.starts_at) {
      return json(
        {
          error: "SESSION_START_REQUIRED",
          session_index: index,
        },
        400,
      );
    }

    if (
      session.ends_at &&
      new Date(String(session.ends_at)) <=
        new Date(String(session.starts_at))
    ) {
      return json(
        {
          error: "INVALID_SESSION_TIME_RANGE",
          session_index: index,
        },
        400,
      );
    }
  }

  await sb
    .from("live_sessions")
    .delete()
    .eq("event_id", eventId);

  if (sessions.length) {
    const rows = sessions.map((s, i) => ({
      event_id: eventId,
      title: s.title ?? `Session ${i + 1}`,
      description: s.description ?? null,
      sequence_no: i + 1,
      starts_at: s.starts_at ?? null,
      ends_at: s.ends_at ?? null,
      timezone: s.timezone ?? ev.timezone ?? "UTC",
      recording_enabled: Boolean(
        s.recording_enabled ?? ev.replay_enabled,
      ),
      status: "scheduled",
    }));

    const { error } = await sb
      .from("live_sessions")
      .insert(rows);

    if (error) throw error;
  }

  const { data } = await sb
    .from("live_sessions")
    .select("*")
    .eq("event_id", eventId)
    .order("sequence_no");

  return json({
    success: true,
    sessions: data ?? [],
  });
}

async function saveSpeakers(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx) return json({ error: "AUTH_REQUIRED" }, 401);

  const body = (await req.json().catch(() => ({}))) as {
    event_id?: string;
    speakers?: Array<Record<string, unknown>>;
  };

  const eventId = body.event_id ?? "";

  if (!eventId) return json({ error: "EVENT_ID_REQUIRED" }, 400);

  if (!(await canManageEvent(sb, ctx, eventId))) {
    return json({ error: "FORBIDDEN" }, 403);
  }

  const ev = await eventForAccess(sb, eventId);

  if (!ev) return json({ error: "EVENT_NOT_FOUND" }, 404);

  if (
    !isSuperAdmin(ctx) &&
    !["draft", "changes_requested"].includes(ev.status)
  ) {
    return json({ error: "EVENT_NOT_EDITABLE" }, 409);
  }

  const speakers = Array.isArray(body.speakers) ? body.speakers : [];

  if (speakers.length > 50) {
    return json({ error: "TOO_MANY_SPEAKERS" }, 400);
  }

  const rows = [];

  for (const [index, s] of speakers.entries()) {
    const role = SPEAKER_ROLES.has(String(s.role))
      ? String(s.role)
      : "speaker";

    const userId = s.user_id ? String(s.user_id) : null;
    const externalName = s.external_name
      ? String(s.external_name).trim()
      : "";

    if (!userId && !externalName) {
      return json(
        {
          error: "SPEAKER_IDENTITY_REQUIRED",
          speaker_index: index,
        },
        400,
      );
    }

    rows.push({
      event_id: eventId,
      user_id: userId,
      external_name: externalName || null,
      external_email: s.external_email ?? null,
      title: s.title ?? null,
      organization: s.organization ?? null,
      bio: s.bio ?? null,
      photo_url: s.photo_url ?? null,
      role,
      permissions:
        s.permissions && typeof s.permissions === "object"
          ? s.permissions
          : {},
      invitation_status: userId ? "not_required" : "pending",
      display_order: index,
    });
  }

  await sb
    .from("live_event_speakers")
    .delete()
    .eq("event_id", eventId);

  if (rows.length) {
    const { error } = await sb
      .from("live_event_speakers")
      .insert(rows);

    if (error) throw error;
  }

  const { data } = await sb
    .from("live_event_speakers")
    .select("*")
    .eq("event_id", eventId)
    .order("display_order");

  return json({
    success: true,
    speakers: data ?? [],
  });
}

async function submitEvent(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx) return json({ error: "AUTH_REQUIRED" }, 401);

  const body = (await req.json().catch(() => ({}))) as {
    event_id?: string;
  };

  const eventId = body.event_id ?? "";

  if (!eventId) return json({ error: "EVENT_ID_REQUIRED" }, 400);

  if (!(await canManageEvent(sb, ctx, eventId))) {
    return json({ error: "FORBIDDEN" }, 403);
  }

  const ev = await eventForAccess(sb, eventId);

  if (!ev) return json({ error: "EVENT_NOT_FOUND" }, 404);

  if (
    !isSuperAdmin(ctx) &&
    !["draft", "changes_requested"].includes(ev.status)
  ) {
    return json(
      {
        error: "INVALID_STATUS",
        status: ev.status,
      },
      409,
    );
  }

  if (!isSuperAdmin(ctx) && ev.organizer_kind !== "omnia") {
    const capacity = await ensureOrganizerLiveCapacity(sb, ctx.userId, eventId);
    if (!capacity.allowed) {
      return json({
        error: "ORGANIZER_PLAN_LIMIT_REACHED",
        message: "La limite de lives actifs de votre accès organisateur est atteinte.",
        limit: capacity.limit,
        active: capacity.active,
        action_url: "/omnia-live/organisateur/offres",
      }, 402);
    }
  }

  const missing: string[] = [];

  if (!ev.title) missing.push("title");
  if (!ev.short_description) missing.push("short_description");
  if (!ev.long_description) missing.push("long_description");
  if (!ev.category_id) missing.push("category_id");
  if (!ev.language) missing.push("language");
  if (!ev.cover_url && !ev.cover_template_key && !ev.cover_ai_prompt) {
    missing.push("cover");
  }

  if (missing.length) {
    return json(
      {
        error: "INCOMPLETE_EVENT",
        fields: missing,
      },
      400,
    );
  }

  if (ev.delivery_type === "single_live" && !ev.starts_at) {
    return json({ error: "START_DATE_REQUIRED" }, 400);
  }

  if (ev.delivery_type === "synchronous_training") {
    const { count } = await sb
      .from("live_sessions")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId);

    if (!count) {
      return json(
        {
          error: "TRAINING_SESSIONS_REQUIRED",
        },
        400,
      );
    }
  }

  if (ev.delivery_type === "recorded_video") {
    const { count } = await sb
      .from("live_media")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("media_type", "recorded_video")
      .neq("status", "deleted");

    if (!count) {
      return json(
        {
          error: "RECORDED_VIDEO_REQUIRED",
        },
        400,
      );
    }
  }

  const fromStatus = ev.status;
  const now = new Date().toISOString();

  const { data, error } = await sb
    .from("live_events")
    .update({
      status: "submitted",
      submitted_at: now,
      admin_review_message: null,
      updated_at: now,
    })
    .eq("id", eventId)
    .select("*")
    .single();

  if (error) throw error;

  await reviewLog(sb, {
    eventId,
    action: "submitted",
    actorUserId: ctx.userId,
    fromStatus,
    toStatus: "submitted",
    message: ev.organizer_message_to_admin ?? null,
    snapshot: data,
  });

  return json({
    success: true,
    event: data,
  });
}

async function adminQueue(
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
  req: Request,
) {
  if (!ctx || !isSuperAdmin(ctx)) {
    return json({ error: "FORBIDDEN" }, 403);
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const deliveryType = url.searchParams.get("delivery_type");

  let q = sb
    .from("live_events")
    .select("*")
    .order("submitted_at", {
      ascending: false,
      nullsFirst: false,
    })
    .limit(200);

  if (status) {
    q = q.eq("status", status);
  } else {
    q = q.in("status", [
      "submitted",
      "under_review",
      "changes_requested",
      "approved",
      "rejected",
    ]);
  }

  if (deliveryType && DELIVERY_TYPES.has(deliveryType)) {
    q = q.eq("delivery_type", deliveryType);
  }

  const { data, error } = await q;

  if (error) throw error;

  return json({
    success: true,
    items: data ?? [],
  });
}

async function adminReview(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx || !isSuperAdmin(ctx)) {
    return json({ error: "FORBIDDEN" }, 403);
  }

  const body = (await req.json().catch(() => ({}))) as {
    event_id?: string;
    decision?: string;
    reason?: string;
  };

  if (!body.event_id || !body.decision) {
    return json({ error: "MISSING_PARAMS" }, 400);
  }

  const ev = await eventForAccess(sb, body.event_id);

  if (!ev) return json({ error: "EVENT_NOT_FOUND" }, 404);

  const decisions: Record<string, string> = {
    start_review: "under_review",
    approve: "approved",
    request_changes: "changes_requested",
    reject: "rejected",
    suspend: "suspended",
  };

  const actions: Record<string, string> = {
    start_review: "under_review",
    approve: "approved",
    request_changes: "changes_requested",
    reject: "rejected",
    suspend: "suspended",
  };

  const next = decisions[body.decision];

  if (!next) {
    return json({ error: "UNKNOWN_DECISION" }, 400);
  }

  if (
    ["request_changes", "reject", "suspend"].includes(body.decision) &&
    !body.reason?.trim()
  ) {
    return json(
      {
        error: "REASON_REQUIRED",
      },
      400,
    );
  }

  const now = new Date().toISOString();

  const patch: Record<string, unknown> = {
    status: next,
    admin_review_message: body.reason?.trim() || null,
    last_reviewed_by: ctx.userId,
    last_reviewed_at: now,
    updated_at: now,
  };

  if (next === "approved") {
    patch.approved_at = now;
  }

  const { data, error } = await sb
    .from("live_events")
    .update(patch)
    .eq("id", body.event_id)
    .select("*")
    .single();

  if (error) throw error;

  await reviewLog(sb, {
    eventId: body.event_id,
    action: actions[body.decision],
    actorUserId: ctx.userId,
    fromStatus: ev.status,
    toStatus: next,
    message: body.reason?.trim() || null,
    snapshot: data,
  });

  return json({
    success: true,
    event: data,
  });
}

async function setCommercialTerms(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx || !isSuperAdmin(ctx)) {
    return json({ error: "FORBIDDEN" }, 403);
  }

  const body = (await req.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  const eventId = String(body.event_id ?? "");

  if (!eventId) return json({ error: "EVENT_ID_REQUIRED" }, 400);

  const ev = await eventForAccess(sb, eventId);

  if (!ev) return json({ error: "EVENT_NOT_FOUND" }, 404);

  const { data: last } = await sb
    .from("live_commercial_terms")
    .select("version")
    .eq("event_id", eventId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const version = Number(last?.version ?? 0) + 1;

  const oga =
    body.oga_commission_percent == null
      ? null
      : Number(body.oga_commission_percent);

  const organizer =
    body.organizer_share_percent == null
      ? oga == null
        ? null
        : 100 - oga
      : Number(body.organizer_share_percent);

  if (oga != null && (oga < 0 || oga > 100)) {
    return json({ error: "INVALID_COMMISSION" }, 400);
  }

  if (organizer != null && (organizer < 0 || organizer > 100)) {
    return json({ error: "INVALID_ORGANIZER_SHARE" }, 400);
  }

  if (
    oga != null &&
    organizer != null &&
    Math.abs(oga + organizer - 100) > 0.01
  ) {
    return json({ error: "SHARES_MUST_TOTAL_100" }, 400);
  }

  const row = {
    event_id: eventId,
    version,
    live_price_amount: Number(
      body.live_price_amount ?? ev.price_amount ?? 0,
    ),
    replay_price_amount:
      body.replay_price_amount == null
        ? null
        : Number(body.replay_price_amount),
    currency: String(body.currency ?? ev.currency ?? "XOF")
      .toUpperCase()
      .slice(0, 3),
    oga_commission_percent: oga,
    organizer_share_percent: organizer,
    payout_delay_hours:
      body.payout_delay_hours == null
        ? null
        : Number(body.payout_delay_hours),
    refund_policy:
      body.refund_policy ?? ev.refund_policy_snapshot ?? null,
    cancellation_policy:
      body.cancellation_policy ??
      ev.cancellation_policy_snapshot ??
      null,
    subscription_compensation:
      body.subscription_compensation ?? null,
    proposed_by: ev.owner_user_id,
    approved_by: ctx.userId,
    approved_at: new Date().toISOString(),
  };

  const { data, error } = await sb
    .from("live_commercial_terms")
    .insert(row)
    .select("*")
    .single();

  if (error) throw error;

  await sb
    .from("live_events")
    .update({
      commercial_terms_version: version,
      price_amount: row.live_price_amount,
      currency: row.currency,
      refund_policy_snapshot: row.refund_policy,
      cancellation_policy_snapshot: row.cancellation_policy,
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId);

  await reviewLog(sb, {
    eventId,
    action: "terms_set",
    actorUserId: ctx.userId,
    fromStatus: ev.status,
    toStatus: ev.status,
    snapshot: data,
  });

  return json({
    success: true,
    terms: data,
  });
}

async function acceptTerms(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx) return json({ error: "AUTH_REQUIRED" }, 401);

  const body = (await req.json().catch(() => ({}))) as {
    event_id?: string;
    version?: number;
  };

  if (!body.event_id) {
    return json({ error: "EVENT_ID_REQUIRED" }, 400);
  }

  if (!(await canManageEvent(sb, ctx, body.event_id))) {
    return json({ error: "FORBIDDEN" }, 403);
  }

  const ev = await eventForAccess(sb, body.event_id);

  if (!ev) return json({ error: "EVENT_NOT_FOUND" }, 404);

  const version = Number(
    body.version ?? ev.commercial_terms_version ?? 0,
  );

  if (!version) {
    return json({ error: "COMMERCIAL_TERMS_REQUIRED" }, 409);
  }

  const acceptedAt = new Date().toISOString();

  const { data, error } = await sb
    .from("live_commercial_terms")
    .update({
      organizer_accepted_at: acceptedAt,
    })
    .eq("event_id", body.event_id)
    .eq("version", version)
    .select("*")
    .single();

  if (error) throw error;

  await reviewLog(sb, {
    eventId: body.event_id,
    action: "terms_accepted",
    actorUserId: ctx.userId,
    fromStatus: ev.status,
    toStatus: ev.status,
    snapshot: data,
  });

  return json({
    success: true,
    terms: data,
  });
}

async function publishEvent(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx || !isSuperAdmin(ctx)) {
    return json({ error: "FORBIDDEN" }, 403);
  }

  const body = (await req.json().catch(() => ({}))) as {
    event_id?: string;
  };

  if (!body.event_id) {
    return json({ error: "EVENT_ID_REQUIRED" }, 400);
  }

  const ev = await eventForAccess(sb, body.event_id);

  if (!ev) return json({ error: "EVENT_NOT_FOUND" }, 404);

  if (ev.status !== "approved") {
    return json(
      {
        error: "EVENT_NOT_APPROVED",
        status: ev.status,
      },
      409,
    );
  }

  if (Number(ev.price_amount ?? 0) > 0) {
    if (!ev.commercial_terms_version) {
      return json({ error: "COMMERCIAL_TERMS_REQUIRED" }, 409);
    }

    const { data: terms } = await sb
      .from("live_commercial_terms")
      .select("organizer_accepted_at")
      .eq("event_id", ev.id)
      .eq("version", ev.commercial_terms_version)
      .maybeSingle();

    if (!terms?.organizer_accepted_at) {
      return json(
        {
          error: "ORGANIZER_MUST_ACCEPT_TERMS",
        },
        409,
      );
    }
  }

  const now = new Date().toISOString();

  const { data, error } = await sb
    .from("live_events")
    .update({
      status: "published",
      published_at: now,
      updated_at: now,
    })
    .eq("id", ev.id)
    .select("*")
    .single();

  if (error) throw error;

  await reviewLog(sb, {
    eventId: ev.id,
    action: "published",
    actorUserId: ctx.userId,
    fromStatus: ev.status,
    toStatus: "published",
    snapshot: data,
  });

  return json({
    success: true,
    event: data,
  });
}


async function mediaRegister(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx) return json({ error: "AUTH_REQUIRED" }, 401);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const eventId = String(body.event_id ?? "");

  if (!eventId) return json({ error: "EVENT_ID_REQUIRED" }, 400);
  if (!(await canManageEvent(sb, ctx, eventId))) return json({ error: "FORBIDDEN" }, 403);

  const mediaType = String(body.media_type ?? "");
  const allowedTypes = new Set([
    "cover",
    "document",
    "recorded_video",
    "replay",
    "subtitle",
    "audio",
  ]);

  if (!allowedTypes.has(mediaType)) {
    return json({ error: "INVALID_MEDIA_TYPE" }, 400);
  }

  const row = {
    event_id: eventId,
    session_id: body.session_id || null,
    media_type: mediaType,
    title: body.title || null,
    description: body.description || null,
    file_name: body.file_name || null,
    mime_type: body.mime_type || null,
    size_bytes: body.size_bytes == null ? null : Number(body.size_bytes),
    storage_provider: "r2",
    storage_key: body.storage_key || null,
    original_storage_key: body.original_storage_key || null,
    status: body.status || "draft",
    processing_status: body.processing_status || "pending",
    access_policy: body.access_policy || "registered",
    availability_scope: body.availability_scope || "registered",
    watermark_enabled: body.watermark_enabled !== false,
    watermark_mode: body.watermark_enabled === false ? "none" : "dynamic",
    download_allowed: Boolean(body.download_allowed),
    is_primary: Boolean(body.is_primary),
    version: Number(body.version || 1),
  };

  if (row.is_primary) {
    await sb
      .from("live_media")
      .update({ is_primary: false })
      .eq("event_id", eventId)
      .eq("media_type", mediaType);
  }

  const { data, error } = await sb
    .from("live_media")
    .insert(row)
    .select("*")
    .single();

  if (error) throw error;

  return json({ success: true, media: data }, 201);
}

async function mediaUpdate(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx) return json({ error: "AUTH_REQUIRED" }, 401);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const mediaId = String(body.media_id ?? "");

  if (!mediaId) return json({ error: "MEDIA_ID_REQUIRED" }, 400);

  const { data: media } = await sb
    .from("live_media")
    .select("id,event_id,status")
    .eq("id", mediaId)
    .maybeSingle();

  if (!media) return json({ error: "MEDIA_NOT_FOUND" }, 404);
  if (!(await canManageEvent(sb, ctx, media.event_id))) return json({ error: "FORBIDDEN" }, 403);

  const patch: Record<string, unknown> = {};
  for (const key of [
    "title",
    "description",
    "storage_key",
    "original_storage_key",
    "streaming_manifest_key",
    "audio_track_key",
    "checksum_sha256",
    "processing_status",
    "processing_error",
    "access_policy",
    "availability_scope",
    "published_at",
    "expires_at",
  ]) {
    if (body[key] !== undefined) patch[key] = body[key];
  }

  for (const key of ["download_allowed", "watermark_enabled", "is_primary"]) {
    if (body[key] !== undefined) patch[key] = Boolean(body[key]);
  }

  if (body.watermark_mode !== undefined) patch.watermark_mode = body.watermark_mode;

  const { data, error } = await sb
    .from("live_media")
    .update(patch)
    .eq("id", mediaId)
    .select("*")
    .single();

  if (error) throw error;

  return json({ success: true, media: data });
}

async function playbackAuthorize(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx) return json({ error: "AUTH_REQUIRED" }, 401);

  const body = (await req.json().catch(() => ({}))) as {
    media_id?: string;
    device_fingerprint?: string;
  };

  if (!body.media_id) return json({ error: "MEDIA_ID_REQUIRED" }, 400);

  const { data: media } = await sb
    .from("live_media")
    .select("id,event_id,status,processing_status,storage_key,streaming_manifest_key,audio_track_key,watermark_enabled,watermark_mode,download_allowed,available_from,available_until")
    .eq("id", body.media_id)
    .maybeSingle();

  if (!media) return json({ error: "MEDIA_NOT_FOUND" }, 404);
  if (media.status !== "published" || media.processing_status !== "ready") {
    return json({ error: "MEDIA_NOT_READY" }, 409);
  }

  const ev = await eventForAccess(sb, media.event_id);
  if (!ev) return json({ error: "EVENT_NOT_FOUND" }, 404);

  let allowed = isSuperAdmin(ctx) || ownerEventAccess(ctx, ev);

  if (!allowed) {
    const { data: reg } = await sb
      .from("live_registrations")
      .select("id,status")
      .eq("event_id", media.event_id)
      .eq("user_id", ctx.userId)
      .eq("status", "confirmed")
      .maybeSingle();

    allowed = !!reg;
  }

  if (!allowed && ev.visibility === "public" && Number(ev.price_amount || 0) === 0) {
    allowed = true;
  }

  if (!allowed) return json({ error: "ACCESS_DENIED" }, 403);

  const now = new Date();
  if (media.available_from && new Date(media.available_from) > now) {
    return json({ error: "MEDIA_NOT_YET_AVAILABLE" }, 403);
  }
  if (media.available_until && new Date(media.available_until) <= now) {
    return json({ error: "MEDIA_ACCESS_EXPIRED" }, 403);
  }

  const rawToken = crypto.randomUUID() + crypto.randomUUID();
  const hashBuf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(rawToken),
  );
  const tokenHash = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const watermark = media.watermark_enabled
    ? `${String(ctx.user.full_name || "USER").slice(0, 3).toUpperCase()}*** · OGA · ${crypto.randomUUID().slice(0, 6).toUpperCase()}`
    : null;

  const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();

  const { error } = await sb.from("live_playback_sessions").insert({
    media_id: media.id,
    user_id: ctx.userId,
    event_id: media.event_id,
    session_token_hash: tokenHash,
    watermark_payload: watermark,
    device_fingerprint: body.device_fingerprint || null,
    expires_at: expiresAt,
    last_seen_at: new Date().toISOString(),
  });

  if (error) throw error;

  const bucket = Deno.env.get("R2_BUCKET_NAME") ?? "";
  if (!bucket) throw new Error("R2_BUCKET_NAME_NOT_CONFIGURED");

  const client = r2Client();
  const videoKey = media.streaming_manifest_key || media.storage_key;
  if (!videoKey) return json({ error: "MEDIA_STREAM_NOT_CONFIGURED" }, 409);

  const videoUrl = await getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: videoKey,
      ResponseContentDisposition: "inline",
    }),
    { expiresIn: 15 * 60 },
  );

  let audioUrl: string | null = null;
  if (media.audio_track_key) {
    audioUrl = await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: media.audio_track_key,
        ResponseContentDisposition: "inline",
      }),
      { expiresIn: 15 * 60 },
    );
  }

  return json({
    success: true,
    playback_token: rawToken,
    expires_at: expiresAt,
    watermark,
    watermark_mode: media.watermark_mode,
    video_url: videoUrl,
    audio_url: audioUrl,
    download_allowed: media.download_allowed,
  });
}

async function roomPrepare(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx) return json({ error: "AUTH_REQUIRED" }, 401);

  const body = (await req.json().catch(() => ({}))) as {
    event_id?: string;
    session_id?: string | null;
  };

  if (!body.event_id) return json({ error: "EVENT_ID_REQUIRED" }, 400);
  if (!(await canManageEvent(sb, ctx, body.event_id))) return json({ error: "FORBIDDEN" }, 403);

  const { data: existing } = await sb
    .from("live_rooms")
    .select("*")
    .eq("event_id", body.event_id)
    .eq("session_id", body.session_id || null)
    .maybeSingle();

  if (existing) {
    return json({ success: true, room: existing });
  }

  const { data, error } = await sb
    .from("live_rooms")
    .insert({
      event_id: body.event_id,
      session_id: body.session_id || null,
      provider: "unconfigured",
      status: "pending",
      created_by: ctx.userId,
    })
    .select("*")
    .single();

  if (error) throw error;

  return json({
    success: true,
    room: data,
    provider_configuration_required: true,
  }, 201);
}


function r2Client() {
  const accountId = Deno.env.get("R2_ACCOUNT_ID") ?? "";
  const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID") ?? "";
  const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY") ?? "";

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2_NOT_CONFIGURED");
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function safeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120) || "file";
}

function mediaStorageKey(eventId: string, mediaType: string, fileName: string) {
  const ext = safeFileName(fileName);
  return `omnia-live/event/${eventId}/${mediaType}/${crypto.randomUUID()}-${ext}`;
}

async function uploadPrepare(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx) return json({ error: "AUTH_REQUIRED" }, 401);

  const body = (await req.json().catch(() => ({}))) as {
    event_id?: string;
    media_type?: string;
    file_name?: string;
    mime_type?: string;
    size_bytes?: number;
    title?: string;
    session_id?: string | null;
  };

  if (!body.event_id || !body.media_type || !body.file_name) {
    return json({ error: "MISSING_PARAMS" }, 400);
  }

  if (!(await canManageEvent(sb, ctx, body.event_id))) {
    return json({ error: "FORBIDDEN" }, 403);
  }

  const allowedTypes = new Set(["cover","document","recorded_video","replay","subtitle","audio"]);
  if (!allowedTypes.has(body.media_type)) {
    return json({ error: "INVALID_MEDIA_TYPE" }, 400);
  }

  const maxUploadBytes = Number(Deno.env.get("OMNIA_LIVE_MAX_UPLOAD_BYTES") || 10 * 1024 * 1024 * 1024);
  if (body.size_bytes && body.size_bytes > maxUploadBytes) {
    return json({ error: "FILE_TOO_LARGE", max_bytes: maxUploadBytes }, 413);
  }

  const bucket = Deno.env.get("R2_BUCKET_NAME") ?? "";
  if (!bucket) throw new Error("R2_BUCKET_NAME_NOT_CONFIGURED");

  const key = mediaStorageKey(body.event_id, body.media_type, body.file_name);

  const { data: media, error } = await sb
    .from("live_media")
    .insert({
      event_id: body.event_id,
      session_id: body.session_id || null,
      media_type: body.media_type,
      title: body.title || body.file_name,
      file_name: body.file_name,
      mime_type: body.mime_type || "application/octet-stream",
      size_bytes: body.size_bytes || null,
      storage_provider: "r2",
      storage_key: key,
      original_storage_key: key,
      status: "draft",
      processing_status: "pending",
      watermark_enabled: ["recorded_video","replay"].includes(body.media_type),
      watermark_mode: ["recorded_video","replay"].includes(body.media_type) ? "dynamic" : "none",
      download_allowed: body.media_type === "document",
      version: 1,
    })
    .select("*")
    .single();

  if (error) throw error;

  const client = r2Client();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: body.mime_type || "application/octet-stream",
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 15 * 60 });

  return json({
    success: true,
    media,
    upload: {
      url: uploadUrl,
      method: "PUT",
      expires_in_seconds: 900,
      headers: {
        "Content-Type": body.mime_type || "application/octet-stream",
      },
    },
  }, 201);
}

async function uploadComplete(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx) return json({ error: "AUTH_REQUIRED" }, 401);

  const body = (await req.json().catch(() => ({}))) as {
    media_id?: string;
  };

  if (!body.media_id) return json({ error: "MEDIA_ID_REQUIRED" }, 400);

  const { data: media } = await sb
    .from("live_media")
    .select("*")
    .eq("id", body.media_id)
    .maybeSingle();

  if (!media) return json({ error: "MEDIA_NOT_FOUND" }, 404);

  if (!(await canManageEvent(sb, ctx, media.event_id))) {
    return json({ error: "FORBIDDEN" }, 403);
  }

  const bucket = Deno.env.get("R2_BUCKET_NAME") ?? "";
  if (!bucket || !media.storage_key) throw new Error("R2_STORAGE_NOT_CONFIGURED");

  const client = r2Client();

  try {
    const head = await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: media.storage_key,
      }),
    );

    const { data, error } = await sb
      .from("live_media")
      .update({
        size_bytes: Number(head.ContentLength ?? media.size_bytes ?? 0),
        mime_type: head.ContentType ?? media.mime_type,
        processing_status:
          ["recorded_video","replay","audio"].includes(media.media_type)
            ? "uploaded"
            : "ready",
        status:
          ["document","cover","subtitle"].includes(media.media_type)
            ? "published"
            : "draft",
        updated_at: new Date().toISOString(),
      })
      .eq("id", media.id)
      .select("*")
      .single();

    if (error) throw error;

    return json({
      success: true,
      media: data,
      processing_required: ["recorded_video","replay","audio"].includes(media.media_type),
    });
  } catch (error) {
    console.error("R2 HeadObject failed:", error);
    return json({ error: "UPLOAD_NOT_FOUND_OR_INCOMPLETE" }, 409);
  }
}


async function processingQueue(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx) return json({ error: "AUTH_REQUIRED" }, 401);

  const body = (await req.json().catch(() => ({}))) as {
    media_id?: string;
  };

  if (!body.media_id) return json({ error: "MEDIA_ID_REQUIRED" }, 400);

  const { data: media } = await sb
    .from("live_media")
    .select("*")
    .eq("id", body.media_id)
    .maybeSingle();

  if (!media) return json({ error: "MEDIA_NOT_FOUND" }, 404);
  if (!(await canManageEvent(sb, ctx, media.event_id))) {
    return json({ error: "FORBIDDEN" }, 403);
  }

  if (!["recorded_video","replay","audio"].includes(media.media_type)) {
    return json({ error: "PROCESSING_NOT_REQUIRED" }, 400);
  }

  const jobType =
    media.media_type === "replay"
      ? "replay_transcode"
      : media.media_type === "audio"
        ? "audio_extract"
        : "video_transcode";

  const { data: existing } = await sb
    .from("live_media_processing_jobs")
    .select("*")
    .eq("media_id", media.id)
    .in("status", ["queued","processing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return json({ success: true, job: existing, already_exists: true });
  }

  const { data: job, error } = await sb
    .from("live_media_processing_jobs")
    .insert({
      media_id: media.id,
      event_id: media.event_id,
      job_type: jobType,
      status: "queued",
      provider: "internal",
      input_key: media.original_storage_key || media.storage_key,
      attempts: 0,
    })
    .select("*")
    .single();

  if (error) throw error;

  await sb
    .from("live_media")
    .update({
      processing_status: "processing",
      processing_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", media.id);

  return json({
    success: true,
    job,
    note:
      "Le job est mis en file d'attente. Le worker vidéo doit appeler processing_update puis processing_complete.",
  }, 201);
}

async function processingUpdate(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx || !isSuperAdmin(ctx)) {
    return json({ error: "FORBIDDEN" }, 403);
  }

  const body = (await req.json().catch(() => ({}))) as {
    job_id?: string;
    status?: string;
    progress_percent?: number;
    provider_job_id?: string;
    error_message?: string;
  };

  if (!body.job_id) return json({ error: "JOB_ID_REQUIRED" }, 400);

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (body.status) patch.status = body.status;
  if (body.progress_percent != null) {
    patch.progress_percent = Math.max(0, Math.min(100, Number(body.progress_percent)));
  }
  if (body.provider_job_id !== undefined) patch.provider_job_id = body.provider_job_id;
  if (body.error_message !== undefined) patch.error_message = body.error_message;

  if (body.status === "processing") patch.started_at = new Date().toISOString();
  if (body.status === "failed") patch.completed_at = new Date().toISOString();

  const { data: job, error } = await sb
    .from("live_media_processing_jobs")
    .update(patch)
    .eq("id", body.job_id)
    .select("*")
    .single();

  if (error) throw error;

  if (body.status === "failed") {
    await sb
      .from("live_media")
      .update({
        processing_status: "failed",
        processing_error: body.error_message || "VIDEO_PROCESSING_FAILED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.media_id);
  }

  return json({ success: true, job });
}

async function processingComplete(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx || !isSuperAdmin(ctx)) {
    return json({ error: "FORBIDDEN" }, 403);
  }

  const body = (await req.json().catch(() => ({}))) as {
    job_id?: string;
    streaming_manifest_key?: string;
    audio_track_key?: string;
    duration_seconds?: number;
  };

  if (!body.job_id || !body.streaming_manifest_key) {
    return json({ error: "MISSING_PARAMS" }, 400);
  }

  const { data: job } = await sb
    .from("live_media_processing_jobs")
    .select("*")
    .eq("id", body.job_id)
    .maybeSingle();

  if (!job) return json({ error: "JOB_NOT_FOUND" }, 404);

  const now = new Date().toISOString();

  const { data: media, error: mediaError } = await sb
    .from("live_media")
    .update({
      streaming_manifest_key: body.streaming_manifest_key,
      audio_track_key: body.audio_track_key || null,
      duration_seconds: body.duration_seconds || null,
      processing_status: "ready",
      processing_error: null,
      status: "published",
      published_at: now,
      updated_at: now,
    })
    .eq("id", job.media_id)
    .select("*")
    .single();

  if (mediaError) throw mediaError;

  const { data: updatedJob, error: jobError } = await sb
    .from("live_media_processing_jobs")
    .update({
      status: "completed",
      progress_percent: 100,
      output_manifest_key: body.streaming_manifest_key,
      output_audio_key: body.audio_track_key || null,
      completed_at: now,
      updated_at: now,
    })
    .eq("id", job.id)
    .select("*")
    .single();

  if (jobError) throw jobError;

  return json({
    success: true,
    job: updatedJob,
    media,
  });
}

async function processingStatus(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx) return json({ error: "AUTH_REQUIRED" }, 401);

  const mediaId = new URL(req.url).searchParams.get("media_id");
  if (!mediaId) return json({ error: "MEDIA_ID_REQUIRED" }, 400);

  const { data: media } = await sb
    .from("live_media")
    .select("id,event_id,processing_status,processing_error,status")
    .eq("id", mediaId)
    .maybeSingle();

  if (!media) return json({ error: "MEDIA_NOT_FOUND" }, 404);

  const allowed =
    isSuperAdmin(ctx) ||
    (await canManageEvent(sb, ctx, media.event_id));

  if (!allowed) return json({ error: "FORBIDDEN" }, 403);

  const { data: job } = await sb
    .from("live_media_processing_jobs")
    .select("*")
    .eq("media_id", mediaId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return json({
    success: true,
    media,
    job: job || null,
  });
}


function makeRoomSlug(eventId: string, sessionId?: string | null) {
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 18);
  return `oga-${eventId.slice(0, 8)}-${sessionId ? sessionId.slice(0, 6) : "main"}-${suffix}`;
}

function configuredVideoProvider() {
  const provider = (Deno.env.get("LIVE_VIDEO_PROVIDER") || "jitsi_embed").toLowerCase();
  const embedBase = (Deno.env.get("LIVE_VIDEO_EMBED_BASE_URL") || "https://meet.jit.si").replace(/\/+$/, "");
  return { provider, embedBase };
}

async function roomEnsure(
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
  eventId: string,
  sessionId?: string | null,
) {
  const ev = await eventForAccess(sb, eventId);
  if (!ev) throw new Error("EVENT_NOT_FOUND");

  let query = sb
    .from("live_rooms")
    .select("*")
    .eq("event_id", eventId);

  query = sessionId
    ? query.eq("session_id", sessionId)
    : query.is("session_id", null);

  const { data: existing } = await query.maybeSingle();
  if (existing) return existing;

  const roomSlug = makeRoomSlug(eventId, sessionId || null);
  const { provider, embedBase } = configuredVideoProvider();

  const { data: created, error } = await sb
    .from("live_rooms")
    .insert({
      event_id: eventId,
      session_id: sessionId || null,
      provider,
      provider_room_id: roomSlug,
      room_slug: roomSlug,
      status: "ready",
      starts_at: sessionId ? null : ev.starts_at,
      recording_enabled: Boolean(ev.replay_enabled),
      waiting_room_enabled: Number(ev.waiting_room_minutes ?? 0) > 0,
      max_participants: ev.max_participants || null,
      provider_join_url: `${embedBase}/${encodeURIComponent(roomSlug)}`,
      provider_host_url: `${embedBase}/${encodeURIComponent(roomSlug)}`,
      created_by: ctx?.userId || null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return created;
}

async function deriveRoomRole(
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
  eventId: string,
) {
  if (!ctx) return "attendee";
  if (isSuperAdmin(ctx)) return "admin_supervisor";

  const ev = await eventForAccess(sb, eventId);
  if (ownerEventAccess(ctx, ev)) return "host";

  const { data: speaker } = await sb
    .from("live_event_speakers")
    .select("role")
    .eq("event_id", eventId)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  if (!speaker) return "attendee";

  const map: Record<string, string> = {
    organizer: "host",
    co_organizer: "co_host",
    speaker: "speaker",
    trainer: "speaker",
    moderator: "moderator",
  };

  return map[speaker.role] || "attendee";
}

async function roomAccessAllowed(
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
  eventId: string,
) {
  if (!ctx) return false;
  if (isSuperAdmin(ctx)) return true;

  const ev = await eventForAccess(sb, eventId);
  if (!ev) return false;
  if (ownerEventAccess(ctx, ev)) return true;

  const { data: speaker } = await sb
    .from("live_event_speakers")
    .select("id")
    .eq("event_id", eventId)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  if (speaker) return true;

  const { data: registration } = await sb
    .from("live_registrations")
    .select("id,status")
    .eq("event_id", eventId)
    .eq("user_id", ctx.userId)
    .eq("status", "confirmed")
    .maybeSingle();

  if (registration) return true;

  if (ev.visibility === "public" && Number(ev.price_amount || 0) === 0) {
    return true;
  }

  return false;
}

async function roomOpen(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx) return json({ error: "AUTH_REQUIRED" }, 401);

  const body = (await req.json().catch(() => ({}))) as {
    event_id?: string;
    session_id?: string | null;
  };

  if (!body.event_id) return json({ error: "EVENT_ID_REQUIRED" }, 400);
  if (!(await canManageEvent(sb, ctx, body.event_id)) && !isSuperAdmin(ctx)) {
    return json({ error: "FORBIDDEN" }, 403);
  }

  const room = await roomEnsure(sb, ctx, body.event_id, body.session_id || null);

  const { data: updated, error } = await sb
    .from("live_rooms")
    .update({
      status: room.status === "live" ? "live" : "open",
      updated_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("id", room.id)
    .select("*")
    .single();

  if (error) throw error;

  await sb.from("live_room_actions").insert({
    room_id: room.id,
    event_id: body.event_id,
    actor_user_id: ctx.userId,
    action: "room_opened",
  });

  return json({ success: true, room: updated });
}

async function roomStart(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx) return json({ error: "AUTH_REQUIRED" }, 401);

  const body = (await req.json().catch(() => ({}))) as {
    room_id?: string;
  };

  if (!body.room_id) return json({ error: "ROOM_ID_REQUIRED" }, 400);

  const { data: room } = await sb
    .from("live_rooms")
    .select("*")
    .eq("id", body.room_id)
    .maybeSingle();

  if (!room) return json({ error: "ROOM_NOT_FOUND" }, 404);

  if (!(await canManageEvent(sb, ctx, room.event_id)) && !isSuperAdmin(ctx)) {
    return json({ error: "FORBIDDEN" }, 403);
  }

  const now = new Date().toISOString();

  const { data: updated, error } = await sb
    .from("live_rooms")
    .update({
      status: "live",
      starts_at: room.starts_at || now,
      updated_at: now,
    })
    .eq("id", room.id)
    .select("*")
    .single();

  if (error) throw error;

  await sb.from("live_events").update({
    status: "live",
    updated_at: now,
  }).eq("id", room.event_id);

  await sb.from("live_room_actions").insert({
    room_id: room.id,
    event_id: room.event_id,
    actor_user_id: ctx.userId,
    action: "room_started",
  });

  return json({ success: true, room: updated });
}

async function roomJoin(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx) return json({ error: "AUTH_REQUIRED" }, 401);

  const body = (await req.json().catch(() => ({}))) as {
    event_id?: string;
    session_id?: string | null;
  };

  if (!body.event_id) return json({ error: "EVENT_ID_REQUIRED" }, 400);

  if (!(await roomAccessAllowed(sb, ctx, body.event_id))) {
    return json({ error: "ACCESS_DENIED" }, 403);
  }

  const room = await roomEnsure(sb, ctx, body.event_id, body.session_id || null);

  if (!["open","live"].includes(room.status) && !isSuperAdmin(ctx)) {
    return json({
      error: "ROOM_NOT_OPEN",
      room_status: room.status,
    }, 409);
  }

  const role = await deriveRoomRole(sb, ctx, body.event_id);
  const bypassWaiting = ["host","co_host","speaker","moderator","admin_supervisor"].includes(role);
  const accessStatus = room.waiting_room_enabled && !bypassWaiting ? "waiting" : "admitted";
  const now = new Date().toISOString();

  const { data: member, error } = await sb
    .from("live_room_members")
    .upsert({
      room_id: room.id,
      event_id: room.event_id,
      session_id: room.session_id,
      user_id: ctx.userId,
      room_role: role,
      access_status: accessStatus,
      joined_at: accessStatus === "admitted" ? now : null,
      last_seen_at: now,
      left_at: null,
      updated_at: now,
    }, { onConflict: "room_id,user_id" })
    .select("*")
    .single();

  if (error) throw error;

  if (role === "admin_supervisor") {
    await sb.from("live_room_actions").insert({
      room_id: room.id,
      event_id: room.event_id,
      actor_user_id: ctx.userId,
      action: "admin_supervision_entered",
    });
  }

  let segmentId: string | null = null;

  if (accessStatus === "admitted") {
    const { data: segment } = await sb
      .from("live_attendance_segments")
      .insert({
        event_id: room.event_id,
        session_id: room.session_id,
        room_id: room.id,
        user_id: ctx.userId,
        joined_at: now,
      })
      .select("id")
      .single();

    segmentId = segment?.id || null;
  }

  return json({
    success: true,
    room,
    member,
    attendance_segment_id: segmentId,
    waiting: accessStatus === "waiting",
    provider: {
      type: room.provider,
      join_url: accessStatus === "admitted" ? room.provider_join_url : null,
      room_slug: room.room_slug,
    },
  });
}

async function roomAdmit(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx) return json({ error: "AUTH_REQUIRED" }, 401);

  const body = (await req.json().catch(() => ({}))) as {
    room_id?: string;
    user_id?: string;
  };

  if (!body.room_id || !body.user_id) return json({ error: "MISSING_PARAMS" }, 400);

  const { data: room } = await sb
    .from("live_rooms")
    .select("*")
    .eq("id", body.room_id)
    .maybeSingle();

  if (!room) return json({ error: "ROOM_NOT_FOUND" }, 404);

  const actorRole = await deriveRoomRole(sb, ctx, room.event_id);
  if (!["host","co_host","moderator","admin_supervisor"].includes(actorRole) && !isSuperAdmin(ctx)) {
    return json({ error: "FORBIDDEN" }, 403);
  }

  const now = new Date().toISOString();

  const { data: member, error } = await sb
    .from("live_room_members")
    .update({
      access_status: "admitted",
      joined_at: now,
      last_seen_at: now,
      updated_at: now,
    })
    .eq("room_id", room.id)
    .eq("user_id", body.user_id)
    .select("*")
    .single();

  if (error) throw error;

  const { data: segment } = await sb
    .from("live_attendance_segments")
    .insert({
      event_id: room.event_id,
      session_id: room.session_id,
      room_id: room.id,
      user_id: body.user_id,
      joined_at: now,
    })
    .select("id")
    .single();

  await sb.from("live_room_actions").insert({
    room_id: room.id,
    event_id: room.event_id,
    actor_user_id: ctx.userId,
    target_user_id: body.user_id,
    action: "participant_admitted",
  });

  return json({
    success: true,
    member,
    attendance_segment_id: segment?.id || null,
    join_url: room.provider_join_url,
  });
}

async function roomHeartbeat(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx) return json({ error: "AUTH_REQUIRED" }, 401);

  const body = (await req.json().catch(() => ({}))) as {
    room_id?: string;
  };

  if (!body.room_id) return json({ error: "ROOM_ID_REQUIRED" }, 400);

  const now = new Date().toISOString();

  const { data: member, error } = await sb
    .from("live_room_members")
    .update({
      last_seen_at: now,
      updated_at: now,
    })
    .eq("room_id", body.room_id)
    .eq("user_id", ctx.userId)
    .select("id,access_status")
    .maybeSingle();

  if (error) throw error;
  if (!member) return json({ error: "ROOM_MEMBER_NOT_FOUND" }, 404);

  return json({ success: true, access_status: member.access_status, server_time: now });
}

async function roomLeave(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx) return json({ error: "AUTH_REQUIRED" }, 401);

  const body = (await req.json().catch(() => ({}))) as {
    room_id?: string;
  };

  if (!body.room_id) return json({ error: "ROOM_ID_REQUIRED" }, 400);

  const now = new Date();

  await sb
    .from("live_room_members")
    .update({
      access_status: "left",
      left_at: now.toISOString(),
      last_seen_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("room_id", body.room_id)
    .eq("user_id", ctx.userId);

  const { data: openSegment } = await sb
    .from("live_attendance_segments")
    .select("*")
    .eq("room_id", body.room_id)
    .eq("user_id", ctx.userId)
    .is("left_at", null)
    .order("joined_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (openSegment) {
    const joined = new Date(openSegment.joined_at);
    const duration = Math.max(0, Math.floor((now.getTime() - joined.getTime()) / 1000));

    await sb
      .from("live_attendance_segments")
      .update({
        left_at: now.toISOString(),
        duration_seconds: duration,
      })
      .eq("id", openSegment.id);
  }

  return json({ success: true });
}

async function roomRemoveParticipant(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx) return json({ error: "AUTH_REQUIRED" }, 401);

  const body = (await req.json().catch(() => ({}))) as {
    room_id?: string;
    user_id?: string;
    reason?: string;
    block?: boolean;
  };

  if (!body.room_id || !body.user_id) return json({ error: "MISSING_PARAMS" }, 400);

  const { data: room } = await sb
    .from("live_rooms")
    .select("*")
    .eq("id", body.room_id)
    .maybeSingle();

  if (!room) return json({ error: "ROOM_NOT_FOUND" }, 404);

  const actorRole = await deriveRoomRole(sb, ctx, room.event_id);
  if (!["host","co_host","moderator","admin_supervisor"].includes(actorRole) && !isSuperAdmin(ctx)) {
    return json({ error: "FORBIDDEN" }, 403);
  }

  const now = new Date().toISOString();
  const status = body.block ? "blocked" : "removed";

  await sb
    .from("live_room_members")
    .update({
      access_status: status,
      removed_at: now,
      removed_by: ctx.userId,
      left_at: now,
      updated_at: now,
    })
    .eq("room_id", body.room_id)
    .eq("user_id", body.user_id);

  const { data: openSegments } = await sb
    .from("live_attendance_segments")
    .select("*")
    .eq("room_id", body.room_id)
    .eq("user_id", body.user_id)
    .is("left_at", null);

  for (const segment of openSegments ?? []) {
    const duration = Math.max(
      0,
      Math.floor((new Date(now).getTime() - new Date(segment.joined_at).getTime()) / 1000),
    );

    await sb
      .from("live_attendance_segments")
      .update({ left_at: now, duration_seconds: duration })
      .eq("id", segment.id);
  }

  await sb.from("live_room_actions").insert({
    room_id: body.room_id,
    event_id: room.event_id,
    actor_user_id: ctx.userId,
    target_user_id: body.user_id,
    action: body.block ? "participant_blocked" : "participant_removed",
    reason: body.reason || null,
  });

  return json({ success: true, access_status: status });
}

async function roomParticipants(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx) return json({ error: "AUTH_REQUIRED" }, 401);

  const roomId = new URL(req.url).searchParams.get("room_id");
  if (!roomId) return json({ error: "ROOM_ID_REQUIRED" }, 400);

  const { data: room } = await sb
    .from("live_rooms")
    .select("*")
    .eq("id", roomId)
    .maybeSingle();

  if (!room) return json({ error: "ROOM_NOT_FOUND" }, 404);

  const actorRole = await deriveRoomRole(sb, ctx, room.event_id);
  if (!["host","co_host","speaker","moderator","admin_supervisor"].includes(actorRole) && !isSuperAdmin(ctx)) {
    return json({ error: "FORBIDDEN" }, 403);
  }

  const { data: members, error } = await sb
    .from("live_room_members")
    .select("*,users(id,full_name,email)")
    .eq("room_id", roomId)
    .order("created_at");

  if (error) throw error;

  return json({ success: true, room, members: members ?? [] });
}

async function roomEnd(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx) return json({ error: "AUTH_REQUIRED" }, 401);

  const body = (await req.json().catch(() => ({}))) as {
    room_id?: string;
  };

  if (!body.room_id) return json({ error: "ROOM_ID_REQUIRED" }, 400);

  const { data: room } = await sb
    .from("live_rooms")
    .select("*")
    .eq("id", body.room_id)
    .maybeSingle();

  if (!room) return json({ error: "ROOM_NOT_FOUND" }, 404);

  if (!(await canManageEvent(sb, ctx, room.event_id)) && !isSuperAdmin(ctx)) {
    return json({ error: "FORBIDDEN" }, 403);
  }

  const now = new Date();

  const { data: openSegments } = await sb
    .from("live_attendance_segments")
    .select("*")
    .eq("room_id", room.id)
    .is("left_at", null);

  for (const segment of openSegments ?? []) {
    const duration = Math.max(
      0,
      Math.floor((now.getTime() - new Date(segment.joined_at).getTime()) / 1000),
    );

    await sb
      .from("live_attendance_segments")
      .update({
        left_at: now.toISOString(),
        duration_seconds: duration,
      })
      .eq("id", segment.id);
  }

  await sb
    .from("live_room_members")
    .update({
      access_status: "left",
      left_at: now.toISOString(),
      last_seen_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("room_id", room.id)
    .in("access_status", ["waiting","admitted"]);

  const { data: updated, error } = await sb
    .from("live_rooms")
    .update({
      status: "ended",
      ends_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("id", room.id)
    .select("*")
    .single();

  if (error) throw error;

  await sb.from("live_room_actions").insert({
    room_id: room.id,
    event_id: room.event_id,
    actor_user_id: ctx.userId,
    action: "room_ended",
  });

  const { count: activeRooms } = await sb
    .from("live_rooms")
    .select("id", { count: "exact", head: true })
    .eq("event_id", room.event_id)
    .in("status", ["open","live"]);

  if (!activeRooms) {
    await sb
      .from("live_events")
      .update({
        status: "completed",
        updated_at: now.toISOString(),
      })
      .eq("id", room.event_id)
      .eq("status", "live");
  }

  return json({ success: true, room: updated });
}

async function attendanceSummary(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx) return json({ error: "AUTH_REQUIRED" }, 401);

  const url = new URL(req.url);
  const eventId = url.searchParams.get("event_id");
  if (!eventId) return json({ error: "EVENT_ID_REQUIRED" }, 400);

  if (!(await canManageEvent(sb, ctx, eventId)) && !isSuperAdmin(ctx)) {
    return json({ error: "FORBIDDEN" }, 403);
  }

  const { data: segments, error } = await sb
    .from("live_attendance_segments")
    .select("user_id,duration_seconds,joined_at,left_at,users(id,full_name,email)")
    .eq("event_id", eventId);

  if (error) throw error;

  const totals = new Map<string, any>();

  for (const s of segments ?? []) {
    const row = totals.get(s.user_id) || {
      user_id: s.user_id,
      user: s.users,
      duration_seconds: 0,
      segments: 0,
    };

    row.duration_seconds += Number(s.duration_seconds || 0);
    row.segments += 1;
    totals.set(s.user_id, row);
  }

  return json({
    success: true,
    participants: Array.from(totals.values()),
  });
}


function orderNumber() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `OGA-LIVE-${y}${m}${day}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function invoiceNumber() {
  const d = new Date();
  return `INV-LIVE-${d.getUTCFullYear()}-${crypto.randomUUID().slice(0, 10).toUpperCase()}`;
}

async function currentConfirmedCount(
  sb: ReturnType<typeof createClient>,
  eventId: string,
) {
  const { count } = await sb
    .from("live_registrations")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("status", "confirmed");

  return count ?? 0;
}

async function createInvoicePdf(
  sb: ReturnType<typeof createClient>,
  order: any,
  user: any,
  event: any,
) {
  const number = invoiceNumber();
  const snapshot = {
    invoice_number: number,
    issued_at: new Date().toISOString(),
    seller: {
      name: "Omnia Global Academy",
    },
    buyer: {
      name: user.full_name || "",
      email: user.email || "",
    },
    item: {
      title: event.title,
      event_id: event.id,
    },
    amount: Number(order.amount || 0),
    currency: order.currency,
    order_number: order.order_number,
  };

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  page.drawText("OMNIA GLOBAL ACADEMY", {
    x: 50, y: 790, size: 18, font: bold, color: rgb(0, 0.125, 0.314),
  });

  page.drawText("FACTURE OMNIA LIVE", {
    x: 50, y: 755, size: 16, font: bold,
  });

  const lines = [
    `Numero : ${number}`,
    `Date : ${new Date().toLocaleDateString("fr-FR")}`,
    `Client : ${user.full_name || ""}`,
    `Email : ${user.email || ""}`,
    `Produit : ${event.title}`,
    `Commande : ${order.order_number}`,
    `Montant : ${Number(order.amount || 0).toFixed(2)} ${order.currency}`,
  ];

  let y = 710;
  for (const line of lines) {
    page.drawText(line, { x: 50, y, size: 11, font });
    y -= 28;
  }

  page.drawText("Document emis automatiquement par Omnia Global Academy.", {
    x: 50, y: 120, size: 9, font,
  });

  const bytes = await pdf.save();

  const hashBuf = await crypto.subtle.digest("SHA-256", bytes);
  const checksum = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  let pdfStorageKey: string | null = null;

  const bucket = Deno.env.get("R2_BUCKET_NAME") ?? "";
  if (bucket) {
    const key = `omnia-live/invoices/${user.id}/${number}.pdf`;
    const client = r2Client();

    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: bytes,
      ContentType: "application/pdf",
      ContentDisposition: `attachment; filename="${number}.pdf"`,
    }));

    pdfStorageKey = key;
  }

  const { data: invoice, error } = await sb
    .from("live_invoices")
    .insert({
      invoice_number: number,
      order_id: order.id,
      user_id: user.id,
      event_id: event.id,
      amount: order.amount,
      currency: order.currency,
      seller_name: "Omnia Global Academy",
      buyer_name: user.full_name || null,
      buyer_email: user.email || null,
      event_title: event.title,
      invoice_snapshot: snapshot,
      pdf_storage_key: pdfStorageKey,
      checksum_sha256: checksum,
    })
    .select("*")
    .single();

  if (error) throw error;

  return invoice;
}

async function registrationCreate(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx) return json({ error: "AUTH_REQUIRED" }, 401);

  const body = (await req.json().catch(() => ({}))) as {
    event_id?: string;
    access_source?: string;
    payment_channel?: string;
    platform?: string;
  };

  if (!body.event_id) return json({ error: "EVENT_ID_REQUIRED" }, 400);

  const ev = await eventForAccess(sb, body.event_id);
  if (!ev) return json({ error: "EVENT_NOT_FOUND" }, 404);

  if (!["published","live"].includes(ev.status)) {
    return json({ error: "REGISTRATION_CLOSED" }, 409);
  }

  const { data: existing } = await sb
    .from("live_registrations")
    .select("*")
    .eq("event_id", ev.id)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  if (existing && ["confirmed","waitlisted"].includes(existing.status)) {
    return json({ success: true, registration: existing, already_registered: true });
  }

  const confirmedCount = await currentConfirmedCount(sb, ev.id);
  const isFull = ev.max_participants != null && confirmedCount >= Number(ev.max_participants);

  if (isFull) {
    const { count: waitingCount } = await sb
      .from("live_waitlist")
      .select("id", { count: "exact", head: true })
      .eq("event_id", ev.id)
      .eq("status", "waiting");

    const { data: wait, error } = await sb
      .from("live_waitlist")
      .upsert({
        event_id: ev.id,
        user_id: ctx.userId,
        position: (waitingCount ?? 0) + 1,
        status: "waiting",
        updated_at: new Date().toISOString(),
      }, { onConflict: "event_id,user_id" })
      .select("*")
      .single();

    if (error) throw error;

    return json({
      success: true,
      waitlisted: true,
      waitlist: wait,
    });
  }

  const amount = Number(ev.price_amount || 0);
  const free = amount <= 0;
  const paymentChannel = String(body.payment_channel || "web");
  const nativePlatform = String(body.platform || "");
  const nativeStore = paymentChannel === "native_store" && ["android", "ios"].includes(nativePlatform);
  const paymentProvider = free
    ? "free"
    : nativeStore
      ? (nativePlatform === "android" ? "google_play" : "app_store")
      : (Deno.env.get("LIVE_PAYMENT_PROVIDER") || "platform_default");

  const { data: registration, error: regError } = await sb
    .from("live_registrations")
    .upsert({
      event_id: ev.id,
      user_id: ctx.userId,
      status: free ? "confirmed" : "pending_payment",
      access_source: body.access_source || (free ? "free_registration" : "purchase"),
      registered_at: new Date().toISOString(),
    }, { onConflict: "event_id,user_id" })
    .select("*")
    .single();

  if (regError) throw regError;

  if (free) {
    return json({
      success: true,
      registration,
      payment_required: false,
    });
  }

  const { data: order, error: orderError } = await sb
    .from("live_orders")
    .insert({
      order_number: orderNumber(),
      user_id: ctx.userId,
      event_id: ev.id,
      registration_id: registration.id,
      amount,
      currency: ev.currency || "XOF",
      payment_status: "pending",
      payment_provider: paymentProvider,
    })
    .select("*")
    .single();

  if (orderError) throw orderError;

  return json({
    success: true,
    registration,
    order,
    payment_required: true,
    payment_provider: order.payment_provider,
    native_store: nativeStore,
    platform: nativeStore ? nativePlatform : null,
  }, 201);
}

async function paymentConfirm(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx) return json({ error: "AUTH_REQUIRED" }, 401);

  const body = (await req.json().catch(() => ({}))) as {
    order_id?: string;
    provider_reference?: string;
    provider_status?: string;
    payment_metadata?: Record<string, unknown>;
  };

  if (!body.order_id) return json({ error: "ORDER_ID_REQUIRED" }, 400);

  const paymentsEnabled = await featureFlagEnabled(sb, "fedapay_live_payments", false);
  if (!paymentsEnabled) {
    return json({ error: "FEDAPAY_LIVE_PAYMENTS_DISABLED" }, 503);
  }

  const { data: order } = await sb
    .from("live_orders")
    .select("*")
    .eq("id", body.order_id)
    .maybeSingle();

  if (!order) return json({ error: "ORDER_NOT_FOUND" }, 404);

  const allowed =
    order.user_id === ctx.userId ||
    isSuperAdmin(ctx);

  if (!allowed) return json({ error: "FORBIDDEN" }, 403);

  if (order.payment_status === "paid") {
    const { data: existingInvoice } = await sb
      .from("live_invoices")
      .select("*")
      .eq("order_id", order.id)
      .maybeSingle();

    return json({
      success: true,
      order,
      invoice: existingInvoice || null,
      already_paid: true,
    });
  }

  if (body.provider_status && body.provider_status !== "paid") {
    return json({ error: "PAYMENT_NOT_CONFIRMED" }, 409);
  }

  const now = new Date().toISOString();

  const { data: paidOrder, error: updateError } = await sb
    .from("live_orders")
    .update({
      payment_status: "paid",
      provider_reference: body.provider_reference || order.provider_reference || null,
      payment_metadata: body.payment_metadata || order.payment_metadata || {},
      paid_at: now,
      access_granted_at: now,
      updated_at: now,
    })
    .eq("id", order.id)
    .select("*")
    .single();

  if (updateError) throw updateError;

  await sb
    .from("live_registrations")
    .update({
      status: "confirmed",
    })
    .eq("id", order.registration_id);

  const ev = await eventForAccess(sb, order.event_id);

  const invoice = await createInvoicePdf(
    sb,
    paidOrder,
    ctx.user,
    ev,
  );

  const organizer_ledger = ["live","replay","recorded_video"].includes(paidOrder.purchase_type || "live")
    ? await organizerLedgerCreateForOrder(sb, paidOrder)
    : null;

  await commerceFinalizePaidOrder(sb, paidOrder);

  return json({
    success: true,
    order: paidOrder,
    invoice,
    organizer_ledger,
  });
}

async function invoiceDownload(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx) return json({ error: "AUTH_REQUIRED" }, 401);

  const invoiceId = new URL(req.url).searchParams.get("invoice_id");
  if (!invoiceId) return json({ error: "INVOICE_ID_REQUIRED" }, 400);

  const { data: invoice } = await sb
    .from("live_invoices")
    .select("*")
    .eq("id", invoiceId)
    .maybeSingle();

  if (!invoice) return json({ error: "INVOICE_NOT_FOUND" }, 404);

  if (invoice.user_id !== ctx.userId && !isSuperAdmin(ctx)) {
    return json({ error: "FORBIDDEN" }, 403);
  }

  if (!invoice.pdf_storage_key) {
    return json({ error: "INVOICE_PDF_NOT_AVAILABLE" }, 409);
  }

  const bucket = Deno.env.get("R2_BUCKET_NAME") ?? "";
  if (!bucket) throw new Error("R2_BUCKET_NAME_NOT_CONFIGURED");

  const url = await getSignedUrl(
    r2Client(),
    new GetObjectCommand({
      Bucket: bucket,
      Key: invoice.pdf_storage_key,
      ResponseContentDisposition: `attachment; filename="${invoice.invoice_number}.pdf"`,
    }),
    { expiresIn: 10 * 60 },
  );

  return json({
    success: true,
    invoice,
    download_url: url,
    expires_in_seconds: 600,
  });
}

async function refundRequest(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx) return json({ error: "AUTH_REQUIRED" }, 401);

  const body = (await req.json().catch(() => ({}))) as {
    order_id?: string;
    reason_code?: string;
    reason_details?: string;
    requested_amount?: number;
  };

  if (!body.order_id || !body.reason_code) {
    return json({ error: "MISSING_PARAMS" }, 400);
  }

  const { data: order } = await sb
    .from("live_orders")
    .select("*")
    .eq("id", body.order_id)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  if (!order) return json({ error: "ORDER_NOT_FOUND" }, 404);
  if (!["paid","partially_refunded"].includes(order.payment_status)) {
    return json({ error: "ORDER_NOT_REFUNDABLE" }, 409);
  }

  const ev = await eventForAccess(sb, order.event_id);

  const requested = Math.min(
    Number(body.requested_amount ?? order.amount),
    Number(order.amount),
  );

  const { data: refund, error } = await sb
    .from("live_refund_requests")
    .insert({
      order_id: order.id,
      event_id: order.event_id,
      user_id: ctx.userId,
      requested_amount: requested,
      reason_code: body.reason_code,
      reason_details: body.reason_details || null,
      status: "pending",
      policy_snapshot: ev?.refund_policy_snapshot || {},
    })
    .select("*")
    .single();

  if (error) throw error;

  return json({
    success: true,
    refund,
  }, 201);
}

async function refundAdminDecision(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx || !isSuperAdmin(ctx)) {
    return json({ error: "FORBIDDEN" }, 403);
  }

  const body = (await req.json().catch(() => ({}))) as {
    refund_id?: string;
    decision?: string;
    approved_amount?: number;
    decision_reason?: string;
    provider_reference?: string;
  };

  if (!body.refund_id || !body.decision) {
    return json({ error: "MISSING_PARAMS" }, 400);
  }

  const { data: refund, error: fetchError } = await sb
    .from("live_refund_requests")
    .select("*")
    .eq("id", body.refund_id)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!refund) return json({ error: "REFUND_NOT_FOUND" }, 404);

  if (body.decision === "processed") {
    const providerReference = String(body.provider_reference || "").trim();
    if (!providerReference) return json({ error: "PROVIDER_REFERENCE_REQUIRED" }, 400);

    const { data, error } = await sb.rpc("omnia_live_process_refund", {
      p_refund_id: refund.id,
      p_admin_id: ctx.userId,
      p_provider_refund_reference: providerReference,
    });
    if (error) throw error;

    return json({ success: true, ...(data || {}) });
  }

  const allowedDecisions = new Set(["under_review", "approved", "partially_approved", "rejected"]);
  if (!allowedDecisions.has(body.decision)) {
    return json({ error: "INVALID_DECISION" }, 400);
  }

  const currentStatus = String(refund.status);
  const allowedTransition =
    (body.decision === "under_review" && currentStatus === "pending") ||
    (["approved", "partially_approved", "rejected"].includes(body.decision) &&
      ["pending", "under_review"].includes(currentStatus));

  if (!allowedTransition) {
    return json({ error: "INVALID_STATUS_TRANSITION" }, 409);
  }

  let approvedAmount: number | null = null;
  if (body.decision === "approved") {
    approvedAmount = Number(refund.requested_amount);
  } else if (body.decision === "partially_approved") {
    approvedAmount = Number(body.approved_amount || 0);
    if (
      !Number.isFinite(approvedAmount) ||
      approvedAmount <= 0 ||
      approvedAmount >= Number(refund.requested_amount)
    ) {
      return json({ error: "INVALID_REFUND_AMOUNT" }, 400);
    }
  } else if (body.decision === "rejected") {
    approvedAmount = 0;
  }

  const now = new Date().toISOString();
  const { data: updated, error } = await sb
    .from("live_refund_requests")
    .update({
      status: body.decision,
      approved_amount: approvedAmount,
      decision_reason: body.decision_reason || null,
      decided_by: ctx.userId,
      decided_at: ["approved", "partially_approved", "rejected"].includes(body.decision)
        ? now
        : refund.decided_at,
      updated_at: now,
    })
    .eq("id", refund.id)
    .select("*")
    .single();

  if (error) throw error;
  return json({ success: true, refund: updated });
}

async function waitlistPromote(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx || !isSuperAdmin(ctx)) return json({ error: "FORBIDDEN" }, 403);

  const body = (await req.json().catch(() => ({}))) as {
    event_id?: string;
  };

  if (!body.event_id) return json({ error: "EVENT_ID_REQUIRED" }, 400);

  const ev = await eventForAccess(sb, body.event_id);
  if (!ev) return json({ error: "EVENT_NOT_FOUND" }, 404);

  const confirmed = await currentConfirmedCount(sb, ev.id);
  const capacity = Number(ev.max_participants || 0);

  if (!capacity || confirmed >= capacity) {
    return json({ success: true, promoted: null, reason: "NO_AVAILABLE_CAPACITY" });
  }

  const { data: next } = await sb
    .from("live_waitlist")
    .select("*")
    .eq("event_id", ev.id)
    .eq("status", "waiting")
    .order("position")
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (!next) return json({ success: true, promoted: null });

  const expires = new Date(Date.now() + 24 * 60 * 60_000).toISOString();

  const { data: promoted, error } = await sb
    .from("live_waitlist")
    .update({
      status: "invited",
      invited_at: new Date().toISOString(),
      invitation_expires_at: expires,
      updated_at: new Date().toISOString(),
    })
    .eq("id", next.id)
    .select("*")
    .single();

  if (error) throw error;

  return json({
    success: true,
    promoted,
  });
}

async function ordersMine(
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx) return json({ error: "AUTH_REQUIRED" }, 401);

  const { data: orders, error } = await sb
    .from("live_orders")
    .select("*,live_events(title,cover_url,starts_at),live_invoices(id,invoice_number,issued_at)")
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return json({ success: true, orders: orders ?? [] });
}

async function refundsAdminQueue(
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx || !isSuperAdmin(ctx)) return json({ error: "FORBIDDEN" }, 403);

  // IMPORTANT:
  // Do not embed "users" directly here. live_refund_requests has two FKs to users
  // (user_id and decided_by), which causes PGRST201 ambiguity.
  const { data: rows, error } = await sb.from("live_refund_requests")
    .select("*")
    .in("status", ["pending","under_review","approved","partially_approved"])
    .order("created_at", { ascending: false });

  if (error) throw error;
  const refunds = rows ?? [];

  const eventIds = [...new Set(refunds.map((r:any)=>r.event_id).filter(Boolean))];
  const userIds = [...new Set(refunds.map((r:any)=>r.user_id).filter(Boolean))];
  const orderIds = [...new Set(refunds.map((r:any)=>r.order_id).filter(Boolean))];

  let eventMap = new Map<string,any>();
  let userMap = new Map<string,any>();
  let orderMap = new Map<string,any>();

  if (eventIds.length) {
    const { data, error: e } = await sb.from("live_events")
      .select("id,title,starts_at,organizer_display_name")
      .in("id", eventIds);
    if (e) throw e;
    eventMap = new Map((data ?? []).map((x:any)=>[x.id,x]));
  }

  if (userIds.length) {
    const { data, error: e } = await sb.from("users")
      .select("id,full_name,email")
      .in("id", userIds);
    if (e) throw e;
    userMap = new Map((data ?? []).map((x:any)=>[x.id,x]));
  }

  if (orderIds.length) {
    const { data, error: e } = await sb.from("live_orders")
      .select("id,currency,amount,payment_status")
      .in("id", orderIds);
    if (e) throw e;
    orderMap = new Map((data ?? []).map((x:any)=>[x.id,x]));
  }

  return json({
    success: true,
    refunds: refunds.map((r:any)=>{
      const ev = eventMap.get(r.event_id);
      const u = userMap.get(r.user_id);
      const o = orderMap.get(r.order_id);
      return {
        ...r,
        event_title: ev?.title ?? null,
        event_starts_at: ev?.starts_at ?? null,
        organizer_display_name: ev?.organizer_display_name ?? null,
        user_name: u?.full_name ?? null,
        user_email: u?.email ?? null,
        currency: o?.currency ?? null,
        order_amount: o?.amount ?? null,
      };
    }),
  });
}


async function cancellationRequest(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx) return json({ error: "AUTH_REQUIRED" }, 401);

  const body = (await req.json().catch(() => ({}))) as {
    event_id?: string;
    request_type?: string;
    reason_code?: string;
    reason_details?: string;
    proposed_new_start_at?: string | null;
  };

  if (!body.event_id || !body.reason_code) return json({ error: "MISSING_PARAMS" }, 400);
  if (!(await canManageEvent(sb, ctx, body.event_id)) && !isSuperAdmin(ctx)) {
    return json({ error: "FORBIDDEN" }, 403);
  }

  const { data, error } = await sb.from("live_cancellation_requests").insert({
    event_id: body.event_id,
    requested_by: ctx.userId,
    request_type: body.request_type === "reschedule" ? "reschedule" : "cancel",
    reason_code: body.reason_code,
    reason_details: body.reason_details || null,
    proposed_new_start_at: body.proposed_new_start_at || null,
    status: "pending",
  }).select("*").single();

  if (error) throw error;
  return json({ success: true, request: data }, 201);
}

async function cancellationAdminDecision(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx || !isSuperAdmin(ctx)) return json({ error: "FORBIDDEN" }, 403);

  const body = (await req.json().catch(() => ({}))) as {
    request_id?: string;
    decision?: string;
    reason?: string;
    penalty_applied?: boolean;
    penalty_details?: Record<string, unknown>;
  };

  if (!body.request_id || !body.decision) return json({ error: "MISSING_PARAMS" }, 400);

  const { data: request } = await sb.from("live_cancellation_requests")
    .select("*").eq("id", body.request_id).maybeSingle();

  if (!request) return json({ error: "REQUEST_NOT_FOUND" }, 404);
  if (!["under_review","approved","rejected","processed"].includes(body.decision)) {
    return json({ error: "INVALID_DECISION" }, 400);
  }

  const now = new Date().toISOString();
  const { data: updated, error } = await sb.from("live_cancellation_requests").update({
    status: body.decision,
    admin_decision_reason: body.reason || null,
    decided_by: ctx.userId,
    decided_at: ["approved","rejected"].includes(body.decision) ? now : request.decided_at,
    processed_at: body.decision === "processed" ? now : request.processed_at,
    penalty_applied: Boolean(body.penalty_applied),
    penalty_details: body.penalty_details || {},
    updated_at: now,
  }).eq("id", request.id).select("*").single();

  if (error) throw error;

  if (body.decision === "processed") {
    if (request.request_type === "cancel") {
      await sb.from("live_events").update({
        status: "cancelled",
        updated_at: now,
      }).eq("id", request.event_id);
    } else if (request.proposed_new_start_at) {
      await sb.from("live_events").update({
        starts_at: request.proposed_new_start_at,
        updated_at: now,
      }).eq("id", request.event_id);
    }
  }

  return json({ success: true, request: updated });
}

async function cancellationAdminQueue(
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx || !isSuperAdmin(ctx)) return json({ error: "FORBIDDEN" }, 403);

  const { data: rows, error } = await sb.from("live_cancellation_requests")
    .select("*")
    .in("status", ["pending","under_review","approved"])
    .order("created_at", { ascending: false });

  if (error) throw error;
  const requests = rows ?? [];

  const eventMap = await hydrateEventMap(sb, requests.map((r:any)=>r.event_id));
  const requesterIds = requests.map((r:any)=>r.requested_by || r.user_id).filter(Boolean);
  const userMap = await hydrateUserMap(sb, requesterIds);

  return json({
    success: true,
    requests: requests.map((r:any)=>{
      const ev=eventMap.get(r.event_id);
      const u=userMap.get(r.requested_by || r.user_id);
      return {
        ...r,
        event_title: ev?.title ?? null,
        event_starts_at: ev?.starts_at ?? null,
        organizer_display_name: ev?.organizer_display_name ?? null,
        user_name: u?.full_name ?? null,
        user_email: u?.email ?? null,
      };
    }),
  });
}

async function reviewCreate(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx) return json({ error: "AUTH_REQUIRED" }, 401);
  const body = (await req.json().catch(() => ({}))) as {
    event_id?: string;
    rating?: number;
    comment?: string;
  };
  if (!body.event_id || !body.rating) return json({ error: "MISSING_PARAMS" }, 400);

  const { data: reg } = await sb.from("live_registrations")
    .select("id,status").eq("event_id", body.event_id).eq("user_id", ctx.userId)
    .eq("status","confirmed").maybeSingle();

  if (!reg && !isSuperAdmin(ctx)) return json({ error: "VERIFIED_PARTICIPANT_REQUIRED" }, 403);

  const { data, error } = await sb.from("live_reviews").upsert({
    event_id: body.event_id,
    user_id: ctx.userId,
    rating: Math.max(1, Math.min(5, Number(body.rating))),
    comment: body.comment || null,
    verified_participant: !!reg,
    status: "published",
    updated_at: new Date().toISOString(),
  }, { onConflict: "event_id,user_id" }).select("*").single();

  if (error) throw error;
  return json({ success: true, review: data });
}

async function reviewsList(
  req: Request,
  sb: ReturnType<typeof createClient>,
) {
  const eventId = new URL(req.url).searchParams.get("event_id");
  if (!eventId) return json({ error: "EVENT_ID_REQUIRED" }, 400);

  const { data, error } = await sb.from("live_reviews")
    .select("id,rating,comment,verified_participant,created_at,users(full_name)")
    .eq("event_id", eventId).eq("status","published").order("created_at",{ascending:false});

  if (error) throw error;
  const ratings = (data ?? []).map((r:any)=>Number(r.rating));
  const average = ratings.length ? ratings.reduce((a,b)=>a+b,0)/ratings.length : 0;

  return json({ success: true, reviews: data ?? [], average_rating: average, count: ratings.length });
}

async function certificateEligibilityCalculate(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx) return json({ error: "AUTH_REQUIRED" }, 401);
  const body = (await req.json().catch(() => ({}))) as { event_id?: string };
  if (!body.event_id) return json({ error: "EVENT_ID_REQUIRED" }, 400);

  if (!(await canManageEvent(sb, ctx, body.event_id)) && !isSuperAdmin(ctx)) {
    return json({ error: "FORBIDDEN" }, 403);
  }

  const ev = await eventForAccess(sb, body.event_id);
  if (!ev) return json({ error: "EVENT_NOT_FOUND" }, 404);

  const minimum = Number(ev.certificate_request_config?.minimum_attendance_percent ?? 80);

  const { data: regs } = await sb.from("live_registrations")
    .select("user_id").eq("event_id", body.event_id).eq("status","confirmed");

  const results:any[] = [];
  for (const reg of regs ?? []) {
    const { data: segments } = await sb.from("live_attendance_segments")
      .select("duration_seconds").eq("event_id", body.event_id).eq("user_id", reg.user_id);

    const attended = (segments ?? []).reduce((s:any,x:any)=>s+Number(x.duration_seconds||0),0);
    const planned = Number(ev.duration_minutes || 0) * 60;
    const pct = planned > 0 ? Math.min(100, (attended/planned)*100) : (attended>0 ? 100 : 0);
    const eligible = pct >= minimum;
    const documentType = ev.cpd_requested ? "cpd" : ev.certificate_requested ? "participation" : null;

    const { data } = await sb.from("live_certificate_eligibility").upsert({
      event_id: body.event_id,
      user_id: reg.user_id,
      attendance_seconds: attended,
      attendance_percent: pct,
      eligible,
      eligibility_reason: eligible ? "ATTENDANCE_REQUIREMENT_MET" : "ATTENDANCE_REQUIREMENT_NOT_MET",
      document_type: documentType,
      calculated_at: new Date().toISOString(),
    }, { onConflict: "event_id,user_id" }).select("*").single();

    results.push(data);
  }

  return json({ success: true, results });
}

async function certificateEligibilityMine(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx) return json({ error: "AUTH_REQUIRED" }, 401);
  const eventId = new URL(req.url).searchParams.get("event_id");
  if (!eventId) return json({ error: "EVENT_ID_REQUIRED" }, 400);

  const { data, error } = await sb.from("live_certificate_eligibility")
    .select("*").eq("event_id", eventId).eq("user_id", ctx.userId).maybeSingle();

  if (error) throw error;
  return json({ success: true, eligibility: data || null });
}

async function centralLiveCommission(
  sb: ReturnType<typeof createClient>,
  creatorUserId: string,
  amountXof: number,
  fallbackPercent: number,
) {
  try {
    const now = new Date().toISOString();
    const { data, error } = await sb.from("commerce_commission_rules").select("*")
      .in("module_key", ["omnia_live", "global"]).eq("status", "active")
      .lte("valid_from", now).or(`valid_until.is.null,valid_until.gte.${now}`)
      .order("priority", { ascending: true });
    if (error) return { percent: fallbackPercent, fixedFeeXof: 0, source: "live_terms" };
    const rule = (data || []).find((row: any) =>
      (!row.creator_user_id || String(row.creator_user_id) === creatorUserId) &&
      (!row.offer_type || String(row.offer_type) === "event") &&
      amountXof >= Number(row.minimum_amount_xof || 0)
    );
    return rule
      ? { percent: Number(rule.platform_percent || 0), fixedFeeXof: Number(rule.fixed_fee_xof || 0), source: "central_commerce" }
      : { percent: fallbackPercent, fixedFeeXof: 0, source: "live_terms" };
  } catch {
    return { percent: fallbackPercent, fixedFeeXof: 0, source: "live_terms" };
  }
}

async function organizerLedgerCreateForOrder(
  sb: ReturnType<typeof createClient>,
  order: any,
) {
  const ev = await eventForAccess(sb, order.event_id);
  if (!ev) return null;

  const { data: terms } = await sb.from("live_commercial_terms")
    .select("*").eq("event_id", order.event_id)
    .eq("version", ev.commercial_terms_version || 0).maybeSingle();

  const gross = Number(order.amount || 0);
  const fallbackPct = Number(terms?.oga_commission_percent ?? 0);
  const commissionTerms = await centralLiveCommission(sb, String(ev.owner_user_id), gross, fallbackPct);
  const ogaAmount = Math.min(gross, Math.round(gross * commissionTerms.percent / 100) + commissionTerms.fixedFeeXof);
  const organizerAmount = Math.max(0, gross - ogaAmount);
  const availableAt = new Date(Date.now() + Number(terms?.payout_delay_hours ?? 48) * 3600_000).toISOString();

  const idempotencyKey = `live:sale:${order.id}`;
  const { data: existingSale, error: existingSaleError } = await sb
    .from("live_organizer_ledger")
    .select("*")
    .eq("order_id", order.id)
    .eq("entry_type", "sale")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existingSaleError) {
    console.error("organizer ledger existing sale lookup error", existingSaleError);
    return null;
  }
  if (existingSale) return existingSale;

  const { data, error } = await sb.from("live_organizer_ledger").upsert({
    event_id: order.event_id,
    organizer_user_id: ev.owner_user_id,
    order_id: order.id,
    entry_type: "sale",
    gross_amount: gross,
    oga_amount: ogaAmount,
    organizer_amount: organizerAmount,
    currency: order.currency,
    status: "pending",
    available_at: availableAt,
    idempotency_key: idempotencyKey,
  }, { onConflict: "idempotency_key", ignoreDuplicates: true }).select("*").maybeSingle();

  if (error) {
    console.error("organizer ledger error", error);
    return null;
  }
  if (data) return data;

  const { data: existing, error: existingError } = await sb
    .from("live_organizer_ledger")
    .select("*")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existingError) {
    console.error("organizer ledger lookup error", existingError);
    return null;
  }
  return existing;
}

async function liveLedgerWithAvailability(
  sb: ReturnType<typeof createClient>,
  rows: any[],
) {
  const ledgerIds = rows.map((row: any) => row.id).filter(Boolean);
  const allocationMap = new Map<string, { reserved: number; paid: number }>();

  if (ledgerIds.length) {
    const { data: allocations, error } = await sb
      .from("live_payout_allocations")
      .select("ledger_entry_id,allocated_amount,status")
      .in("ledger_entry_id", ledgerIds)
      .in("status", ["reserved", "paid"]);

    if (error) throw error;

    for (const allocation of allocations || []) {
      const key = String(allocation.ledger_entry_id);
      const current = allocationMap.get(key) || { reserved: 0, paid: 0 };
      if (allocation.status === "reserved") current.reserved += Number(allocation.allocated_amount || 0);
      if (allocation.status === "paid") current.paid += Number(allocation.allocated_amount || 0);
      allocationMap.set(key, current);
    }
  }

  return rows.map((row: any) => {
    const allocated = allocationMap.get(String(row.id)) || { reserved: 0, paid: 0 };
    const organizerAmount = Number(row.organizer_amount || 0);
    const availableAmount =
      row.status === "available"
        ? organizerAmount > 0
          ? Math.max(0, organizerAmount - allocated.reserved - allocated.paid)
          : organizerAmount
        : 0;

    return {
      ...row,
      reserved_amount: allocated.reserved,
      paid_amount: allocated.paid,
      available_amount: availableAmount,
    };
  });
}

async function organizerLedgerMine(
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx) return json({ error: "AUTH_REQUIRED" }, 401);

  const { error: refreshError } = await sb.rpc("omnia_live_refresh_ledger_availability", {
    p_organizer_user_id: ctx.userId,
  });
  if (refreshError) throw refreshError;

  const { data, error } = await sb
    .from("live_organizer_ledger")
    .select("*,live_events(title)")
    .eq("organizer_user_id", ctx.userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const entries = await liveLedgerWithAvailability(sb, data ?? []);
  const totals = entries.reduce(
    (acc: any, row: any) => {
      acc.gross += Number(row.gross_amount || 0);
      acc.oga += Number(row.oga_amount || 0);
      acc.organizer += Number(row.organizer_amount || 0);
      if (row.status === "pending") acc.pending += Number(row.organizer_amount || 0);
      acc.available += Number(row.available_amount || 0);
      acc.reserved += Number(row.reserved_amount || 0);
      acc.paid += Number(row.paid_amount || 0);
      return acc;
    },
    { gross: 0, oga: 0, organizer: 0, pending: 0, available: 0, reserved: 0, paid: 0 },
  );

  return json({ success: true, entries, totals });
}

async function replayEntitlementGrantForEvent(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx || !isSuperAdmin(ctx)) return json({ error: "FORBIDDEN" }, 403);
  const body = (await req.json().catch(() => ({}))) as { event_id?: string; media_id?: string };
  if (!body.event_id || !body.media_id) return json({ error: "MISSING_PARAMS" }, 400);

  const ev = await eventForAccess(sb, body.event_id);
  if (!ev) return json({ error: "EVENT_NOT_FOUND" }, 404);

  const { data: regs } = await sb.from("live_registrations")
    .select("user_id,access_source").eq("event_id", body.event_id).eq("status","confirmed");

  const days = Number(ev.replay_availability_days || 0);
  const expiresAt = days > 0 ? new Date(Date.now()+days*86400000).toISOString() : null;

  const rows = (regs ?? []).map((r:any)=>({
    event_id: body.event_id,
    media_id: body.media_id,
    user_id: r.user_id,
    source: Number(ev.price_amount||0)>0 ? "live_purchase" : "free_live",
    starts_at: new Date().toISOString(),
    expires_at: expiresAt,
  }));

  if (rows.length) {
    const { error } = await sb.from("live_replay_entitlements").upsert(rows, {
      onConflict: "event_id,media_id,user_id,source",
      ignoreDuplicates: false,
    });
    if (error) throw error;
  }

  return json({ success:true, granted:rows.length });
}

async function notificationsScheduleForEvent(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx || !isSuperAdmin(ctx)) return json({ error: "FORBIDDEN" }, 403);
  const body = (await req.json().catch(() => ({}))) as { event_id?: string };
  if (!body.event_id) return json({ error: "EVENT_ID_REQUIRED" }, 400);

  const ev = await eventForAccess(sb, body.event_id);
  if (!ev) return json({ error: "EVENT_NOT_FOUND" }, 404);

  const { data: regs } = await sb.from("live_registrations")
    .select("user_id").eq("event_id", body.event_id).eq("status","confirmed");

  const starts = ev.starts_at ? new Date(ev.starts_at).getTime() : null;
  const rows:any[] = [];

  for (const r of regs ?? []) {
    rows.push({
      user_id:r.user_id,event_id:ev.id,notification_type:"registration_confirmed",
      channel:"in_app",payload:{title:ev.title},scheduled_at:new Date().toISOString()
    });
    if (starts) {
      for (const [type,offset] of [["live_reminder_24h",24*3600_000],["live_reminder_1h",3600_000]] as any[]) {
        const when = starts-offset;
        if (when>Date.now()) rows.push({
          user_id:r.user_id,event_id:ev.id,notification_type:type,channel:"in_app",
          payload:{title:ev.title,starts_at:ev.starts_at},scheduled_at:new Date(when).toISOString()
        });
      }
    }
  }

  if (rows.length) {
    const { error } = await sb.from("live_notifications_queue").insert(rows);
    if (error) throw error;
  }

  return json({ success:true, queued:rows.length });
}


function generateAccessCode() {
  return `OL-${crypto.randomUUID().replace(/-/g,"").slice(0,10).toUpperCase()}`;
}

async function privateCodeCreate(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx) return json({ error:"AUTH_REQUIRED" },401);
  const body = await req.json().catch(()=>({})) as any;
  if (!body.event_id) return json({ error:"EVENT_ID_REQUIRED" },400);
  if (!(await canManageEvent(sb,ctx,body.event_id)) && !isSuperAdmin(ctx)) return json({ error:"FORBIDDEN" },403);

  const ev = await eventForAccess(sb,body.event_id);
  if (!ev) return json({ error:"EVENT_NOT_FOUND" },404);

  const accessType = ["private","structure","invitation"].includes(body.access_type) ? body.access_type : "private";

  const {data,error}=await sb.from("live_private_access_codes").insert({
    event_id:body.event_id,
    code:generateAccessCode(),
    access_type:accessType,
    structure_id:body.structure_id||null,
    max_uses:body.max_uses==null?null:Number(body.max_uses),
    expires_at:body.expires_at||null,
    created_by:ctx.userId,
  }).select("*").single();

  if(error) throw error;
  return json({success:true,access_code:data},201);
}

async function privateCodeRedeem(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const body=await req.json().catch(()=>({})) as any;
  if(!body.code) return json({error:"CODE_REQUIRED"},400);

  const {data:code}=await sb.from("live_private_access_codes").select("*")
    .eq("code",String(body.code).trim().toUpperCase()).eq("status","active").maybeSingle();

  if(!code) return json({error:"INVALID_ACCESS_CODE"},404);
  if(code.expires_at && new Date(code.expires_at)<=new Date()) return json({error:"ACCESS_CODE_EXPIRED"},410);
  if(code.max_uses!=null && Number(code.used_count)>=Number(code.max_uses)) return json({error:"ACCESS_CODE_LIMIT_REACHED"},409);

  const grantSource = code.access_type==="structure" ? "structure" : "code";

  const { data: existingGrant, error: existingGrantError } = await sb
    .from("live_private_access_grants")
    .select("*")
    .eq("event_id", code.event_id)
    .eq("user_id", ctx.userId)
    .eq("source", grantSource)
    .is("revoked_at", null)
    .maybeSingle();

  if (existingGrantError) throw existingGrantError;
  if (existingGrant) {
    return json({ success:true, grant:existingGrant, already_granted:true, event_id:code.event_id });
  }

  if (code.access_type === "structure" && !code.structure_id) {
    return json({ error:"STRUCTURE_CODE_MISCONFIGURED" },409);
  }

  const {data:grant,error}=await sb.from("live_private_access_grants").upsert({
    event_id:code.event_id,user_id:ctx.userId,access_code_id:code.id,
    source:grantSource,granted_at:new Date().toISOString(),
    expires_at:code.expires_at||null
  },{onConflict:"event_id,user_id,source"}).select("*").single();

  if(error) throw error;

  await sb.from("live_private_access_codes").update({
    used_count:Number(code.used_count||0)+1
  }).eq("id",code.id);

  return json({success:true,grant,event_id:code.event_id});
}

async function structurePackCreate(
  _req: Request,
  _sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if(!ctx||!isSuperAdmin(ctx)) return json({error:"FORBIDDEN"},403);
  return json({
    error:"LEGACY_COMMERCE_DISABLED",
    message:"Les anciens Packs Omnia Live ont été retirés. Ils seront remplacés par le moteur central de monétisation.",
  },410);
}

async function archiveCreate(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const body=await req.json().catch(()=>({})) as any;
  if(!body.event_id||!body.archive_type) return json({error:"MISSING_PARAMS"},400);
  if(!(await canManageEvent(sb,ctx,body.event_id))&&!isSuperAdmin(ctx)) return json({error:"FORBIDDEN"},403);

  const {data,error}=await sb.from("live_institutional_archive").insert({
    event_id:body.event_id,structure_id:body.structure_id||null,media_id:body.media_id||null,
    archive_type:body.archive_type,retention_until:body.retention_until||null,
    permanent:Boolean(body.permanent),metadata:body.metadata||{}
  }).select("*").single();

  if(error) throw error;
  return json({success:true,archive:data},201);
}

async function organizerProfileUpsert(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const body=await req.json().catch(()=>({})) as any;

  const row={
    user_id:ctx.userId,structure_id:body.structure_id||null,
    display_name:body.display_name||ctx.user.full_name||"Organisateur Omnia",
    bio:body.bio||null,country:body.country||null,website:body.website||null,logo_url:body.logo_url||null,
    metadata:body.metadata||{},updated_at:new Date().toISOString()
  };

  const {data,error}=await sb.from("live_organizer_profiles").upsert(row,{onConflict:"user_id"}).select("*").single();
  if(error) throw error;
  return json({success:true,profile:data});
}

async function organizerProfileGet(
  req: Request,
  sb: ReturnType<typeof createClient>,
) {
  const url=new URL(req.url);
  const userId=url.searchParams.get("user_id");
  if(!userId) return json({error:"USER_ID_REQUIRED"},400);

  const {data,error}=await sb.from("live_organizer_profiles").select("*").eq("user_id",userId).maybeSingle();
  if(error) throw error;
  return json({success:true,profile:data||null});
}

async function organizerProfileMe(
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx) return json({ error: "AUTH_REQUIRED" }, 401);

  const { data, error } = await sb
    .from("live_organizer_profiles")
    .select("*")
    .eq("user_id", ctx.userId)
    .maybeSingle();

  if (error) throw error;
  return json({ success: true, profile: data || null });
}

async function organizerProfileRefreshStats(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if(!ctx||!isSuperAdmin(ctx)) return json({error:"FORBIDDEN"},403);
  const body=await req.json().catch(()=>({})) as any;
  if(!body.user_id) return json({error:"USER_ID_REQUIRED"},400);

  const {data:events}=await sb.from("live_events").select("id,status").eq("owner_user_id",body.user_id);
  const ids=(events??[]).map((e:any)=>e.id);
  let average=0,count=0,refundCount=0;

  if(ids.length){
    const {data:reviews}=await sb.from("live_reviews").select("rating").in("event_id",ids).eq("status","published");
    count=(reviews??[]).length;
    average=count?(reviews??[]).reduce((a:any,x:any)=>a+Number(x.rating||0),0)/count:0;
    const {count:rc}=await sb.from("live_refund_requests").select("id",{count:"exact",head:true}).in("event_id",ids).in("status",["approved","partially_approved","processed"]);
    refundCount=rc??0;
  }

  const completed=(events??[]).filter((e:any)=>e.status==="completed").length;
  const cancelled=(events??[]).filter((e:any)=>e.status==="cancelled").length;

  const {data,error}=await sb.from("live_organizer_profiles").update({
    public_rating:average,review_count:count,completed_events:completed,cancellation_count:cancelled,refund_count:refundCount,updated_at:new Date().toISOString()
  }).eq("user_id",body.user_id).select("*").single();

  if(error) throw error;
  return json({success:true,profile:data});
}

async function analyticsRebuild(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const body=await req.json().catch(()=>({})) as any;
  if(!body.event_id) return json({error:"EVENT_ID_REQUIRED"},400);
  if(!(await canManageEvent(sb,ctx,body.event_id))&&!isSuperAdmin(ctx)) return json({error:"FORBIDDEN"},403);

  const date=new Date().toISOString().slice(0,10);
  const [{count:regs},{count:paid},{data:orders},{data:segments},{data:progress}] = await Promise.all([
    sb.from("live_registrations").select("id",{count:"exact",head:true}).eq("event_id",body.event_id),
    sb.from("live_orders").select("id",{count:"exact",head:true}).eq("event_id",body.event_id).eq("payment_status","paid"),
    sb.from("live_orders").select("amount,payment_status").eq("event_id",body.event_id),
    sb.from("live_attendance_segments").select("user_id,duration_seconds").eq("event_id",body.event_id),
    sb.from("live_media_progress").select("user_id,watched_seconds").eq("event_id",body.event_id),
  ]);

  const gross=(orders??[]).filter((o:any)=>o.payment_status==="paid").reduce((a:any,x:any)=>a+Number(x.amount||0),0);
  const refunds=(orders??[]).filter((o:any)=>["refunded","partially_refunded"].includes(o.payment_status)).reduce((a:any,x:any)=>a+Number(x.amount||0),0);
  const attendees=new Set((segments??[]).map((x:any)=>x.user_id)).size;
  const replayViewers=new Set((progress??[]).map((x:any)=>x.user_id)).size;
  const avgWatch=(progress??[]).length?(progress??[]).reduce((a:any,x:any)=>a+Number(x.watched_seconds||0),0)/(progress??[]).length:0;

  const {data,error}=await sb.from("live_event_analytics_daily").upsert({
    event_id:body.event_id,metric_date:date,registrations:regs??0,paid_orders:paid??0,
    gross_revenue:gross,refunds,live_attendees:attendees,replay_viewers:replayViewers,average_watch_seconds:avgWatch,updated_at:new Date().toISOString()
  },{onConflict:"event_id,metric_date"}).select("*").single();

  if(error) throw error;
  return json({success:true,analytics:data});
}

async function analyticsGet(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const eventId=new URL(req.url).searchParams.get("event_id");
  if(!eventId) return json({error:"EVENT_ID_REQUIRED"},400);
  if(!(await canManageEvent(sb,ctx,eventId))&&!isSuperAdmin(ctx)) return json({error:"FORBIDDEN"},403);

  const {data,error}=await sb.from("live_event_analytics_daily").select("*").eq("event_id",eventId).order("metric_date");
  if(error) throw error;
  return json({success:true,analytics:data??[]});
}


function fedapayBaseUrl() {
  const env = (Deno.env.get("FEDAPAY_ENV") || "sandbox").toLowerCase();
  return env === "live"
    ? "https://api.fedapay.com/v1"
    : "https://sandbox-api.fedapay.com/v1";
}

function fedapayHeaders() {
  const key = Deno.env.get("FEDAPAY_SECRET_KEY") || "";
  if (!key) throw new Error("FEDAPAY_SECRET_KEY_NOT_CONFIGURED");

  return {
    "Authorization": `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

async function fedapayPrepare(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx) return json({ error: "AUTH_REQUIRED" }, 401);

  const body = (await req.json().catch(() => ({}))) as {
    order_id?: string;
    callback_url?: string;
  };

  if (!body.order_id) return json({ error: "ORDER_ID_REQUIRED" }, 400);

  const { data: order } = await sb
    .from("live_orders")
    .select("*,live_events(title)")
    .eq("id", body.order_id)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  if (!order) return json({ error: "ORDER_NOT_FOUND" }, 404);
  if (order.payment_status === "paid") {
    return json({ error: "ORDER_ALREADY_PAID" }, 409);
  }
  if (!["pending","authorized","failed"].includes(String(order.payment_status || "pending"))) {
    return json({ error: "ORDER_NOT_PAYABLE", status: order.payment_status }, 409);
  }

  if (order.provider_reference && order.payment_status !== "failed") {
    return json({
      error: "PAYMENT_ALREADY_PREPARED",
      order_id: order.id,
      provider_reference: order.provider_reference,
    }, 409);
  }

  let callbackUrl = body.callback_url || Deno.env.get("FEDAPAY_CALLBACK_URL") || null;
  if (callbackUrl) {
    try {
      const callback = new URL(callbackUrl);
      const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN");
      if (allowedOrigin && allowedOrigin !== "*" && callback.origin !== new URL(allowedOrigin).origin) {
        return json({ error: "CALLBACK_URL_NOT_ALLOWED" }, 400);
      }
    } catch {
      return json({ error: "INVALID_CALLBACK_URL" }, 400);
    }
  }

  const customerName = String(ctx.user.full_name || "").trim();
  const [firstname, ...rest] = customerName.split(/\s+/);
  const lastname = rest.join(" ") || firstname || "Client";

  const transactionPayload = {
    description: `Omnia Live - ${order.live_events?.title || order.order_number}`,
    amount: Math.round(Number(order.amount)),
    currency: { iso: order.currency || "XOF" },
    callback_url: callbackUrl,
    custom_metadata: {
      omnia_order_id: order.id,
      omnia_order_number: order.order_number,
      omnia_event_id: order.event_id,
      omnia_user_id: ctx.userId,
    },
    customer: {
      email: ctx.user.email,
      firstname: firstname || customerName || "Client",
      lastname,
    },
  };

  const createResponse = await fetch(
    `${fedapayBaseUrl()}/transactions`,
    {
      method: "POST",
      headers: fedapayHeaders(),
      body: JSON.stringify(transactionPayload),
    },
  );

  const createJson = await createResponse.json().catch(() => ({}));

  if (!createResponse.ok) {
    console.error("FedaPay create transaction:", createJson);
    return json({
      error: "FEDAPAY_TRANSACTION_CREATE_FAILED",
      provider_response: createJson,
    }, 502);
  }

  const transactionId =
    createJson.id ??
    createJson.v1?.transaction?.id ??
    createJson.transaction?.id;

  const reference =
    createJson.reference ??
    createJson.v1?.transaction?.reference ??
    createJson.transaction?.reference ??
    String(transactionId ?? "");

  if (!transactionId) {
    return json({
      error: "FEDAPAY_TRANSACTION_ID_MISSING",
      provider_response: createJson,
    }, 502);
  }

  const tokenResponse = await fetch(
    `${fedapayBaseUrl()}/transactions/${transactionId}/token`,
    {
      method: "POST",
      headers: fedapayHeaders(),
    },
  );

  const tokenJson = await tokenResponse.json().catch(() => ({}));

  if (!tokenResponse.ok || !tokenJson.url) {
    console.error("FedaPay create token:", tokenJson);
    return json({
      error: "FEDAPAY_PAYMENT_LINK_FAILED",
      provider_response: tokenJson,
    }, 502);
  }

  const paymentAttemptKey = order.payment_attempt_key || crypto.randomUUID();

  await sb
    .from("live_orders")
    .update({
      payment_provider: "fedapay",
      payment_attempt_key: paymentAttemptKey,
      provider_reference: reference || null,
      payment_metadata: {
        ...(order.payment_metadata || {}),
        fedapay_transaction_id: transactionId,
        fedapay_reference: reference,
        fedapay_environment: Deno.env.get("FEDAPAY_ENV") || "sandbox",
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.id);

  return json({
    success: true,
    order_id: order.id,
    provider: "fedapay",
    environment: Deno.env.get("FEDAPAY_ENV") || "sandbox",
    transaction_id: transactionId,
    reference,
    payment_url: tokenJson.url,
    payment_token: tokenJson.token || null,
  });
}

async function fedapayWebhook(
  req: Request,
  sb: ReturnType<typeof createClient>,
) {
  const configuredSecret = Deno.env.get("FEDAPAY_WEBHOOK_SECRET") || "";
  const providedSecret =
    req.headers.get("X-Omnia-Webhook-Secret") ||
    req.headers.get("x-omnia-webhook-secret") ||
    "";

  if (!configuredSecret || providedSecret !== configuredSecret) {
    return json({ error: "INVALID_WEBHOOK_SECRET" }, 401);
  }

  const payload = await req.json().catch(() => ({})) as any;

  const providerEventId =
    payload.id != null ? String(payload.id) :
    payload.event?.id != null ? String(payload.event.id) :
    null;

  const eventType =
    payload.name ||
    payload.type ||
    payload.event?.name ||
    "unknown";

  const entity =
    payload.entity ||
    payload.data?.entity ||
    payload.data ||
    payload.transaction ||
    {};

  const reference =
    entity.reference ||
    payload.reference ||
    payload.data?.reference ||
    null;

  const transactionId =
    entity.id ||
    payload.transaction_id ||
    payload.data?.id ||
    null;

  const status =
    String(
      entity.status ||
      payload.status ||
      payload.data?.status ||
      "",
    ).toLowerCase();

  const metadata =
    entity.custom_metadata ||
    payload.custom_metadata ||
    payload.data?.custom_metadata ||
    {};

  const omniaOrderId =
    metadata.omnia_order_id ||
    null;

  const { data: eventRow, error: eventInsertError } = await sb
    .from("live_payment_events")
    .insert({
      provider: "fedapay",
      provider_event_id: providerEventId,
      provider_reference: reference ? String(reference) : null,
      event_type: String(eventType),
      payload,
      processed: false,
    })
    .select("*")
    .single();

  if (eventInsertError) {
    if (eventInsertError.code === "23505") {
      return json({ success: true, duplicate: true });
    }
    throw eventInsertError;
  }

  let orderQuery = sb.from("live_orders").select("*");

  if (omniaOrderId) {
    orderQuery = orderQuery.eq("id", omniaOrderId);
  } else if (reference) {
    orderQuery = orderQuery.eq("provider_reference", String(reference));
  } else if (transactionId) {
    orderQuery = orderQuery.contains("payment_metadata", {
      fedapay_transaction_id: transactionId,
    });
  } else {
    await sb.from("live_payment_events").update({
      processing_error: "ORDER_IDENTIFIER_MISSING",
      processed_at: new Date().toISOString(),
    }).eq("id", eventRow.id);

    return json({ success: true, ignored: true });
  }

  const { data: order } = await orderQuery.maybeSingle();

  if (!order) {
    await sb.from("live_payment_events").update({
      processing_error: "ORDER_NOT_FOUND",
      processed_at: new Date().toISOString(),
    }).eq("id", eventRow.id);

    return json({ success: true, ignored: true });
  }

  const paidStatuses = new Set(["approved","paid","successful","success","completed"]);
  const failedStatuses = new Set(["declined","failed","canceled","cancelled"]);

  if (paidStatuses.has(status) && order.payment_status !== "paid") {
    const now = new Date().toISOString();

    const { data: paidOrder, error: orderError } = await sb
      .from("live_orders")
      .update({
        payment_status: "paid",
        provider_reference: reference ? String(reference) : order.provider_reference,
        payment_metadata: {
          ...(order.payment_metadata || {}),
          fedapay_transaction_id: transactionId,
          fedapay_last_status: status,
        },
        paid_at: now,
        access_granted_at: now,
        updated_at: now,
      })
      .eq("id", order.id)
      .select("*")
      .single();

    if (orderError) throw orderError;

    await sb.from("live_registrations").update({
      status: "confirmed",
    }).eq("id", order.registration_id);

    const { data: user } = await sb
      .from("users")
      .select("id,full_name,email")
      .eq("id", order.user_id)
      .single();

    const ev = await eventForAccess(sb, order.event_id);

    const { data: existingInvoice } = await sb
      .from("live_invoices")
      .select("*")
      .eq("order_id", order.id)
      .maybeSingle();

    if (!existingInvoice && user && ev) {
      await createInvoicePdf(sb, paidOrder, user, ev);
    }

    const { data: existingLedger } = await sb
      .from("live_organizer_ledger")
      .select("id")
      .eq("order_id", order.id)
      .eq("entry_type", "sale")
      .maybeSingle();

    if (!existingLedger && ["live","replay","recorded_video"].includes(paidOrder.purchase_type || "live")) {
      await organizerLedgerCreateForOrder(sb, paidOrder);
    }

    await commerceFinalizePaidOrder(sb, paidOrder);
  } else if (failedStatuses.has(status) && order.payment_status !== "paid") {
    await sb.from("live_orders").update({
      payment_status: "failed",
      failed_at: new Date().toISOString(),
      payment_metadata: {
        ...(order.payment_metadata || {}),
        fedapay_last_status: status,
      },
      updated_at: new Date().toISOString(),
    }).eq("id", order.id);
  }

  await sb.from("live_payment_events").update({
    processed: true,
    processed_at: new Date().toISOString(),
  }).eq("id", eventRow.id);

  return json({ success: true });
}

function liveDocumentNumber(type: string) {
  const prefix = type === "cpd" ? "CPD" : type === "success" ? "CERT" : "ATT";
  return `${prefix}-OL-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0, 10).toUpperCase()}`;
}

async function documentIssue(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx) return json({ error: "AUTH_REQUIRED" }, 401);

  const body = (await req.json().catch(() => ({}))) as {
    eligibility_id?: string;
  };

  if (!body.eligibility_id) return json({ error: "ELIGIBILITY_ID_REQUIRED" }, 400);

  const { data: eligibility } = await sb
    .from("live_certificate_eligibility")
    .select("*")
    .eq("id", body.eligibility_id)
    .maybeSingle();

  if (!eligibility) return json({ error: "ELIGIBILITY_NOT_FOUND" }, 404);

  const allowed =
    eligibility.user_id === ctx.userId ||
    isSuperAdmin(ctx);

  if (!allowed) return json({ error: "FORBIDDEN" }, 403);
  if (!eligibility.eligible) return json({ error: "NOT_ELIGIBLE" }, 409);

  const { data: existing } = await sb
    .from("live_documents_issued")
    .select("*")
    .eq("eligibility_id", eligibility.id)
    .maybeSingle();

  if (existing) return json({ success: true, document: existing, already_issued: true });

  const ev = await eventForAccess(sb, eligibility.event_id);

  const { data: user } = await sb
    .from("users")
    .select("id,full_name,email")
    .eq("id", eligibility.user_id)
    .single();

  if (!ev || !user) return json({ error: "SOURCE_DATA_MISSING" }, 409);

  const type = eligibility.document_type || "participation";
  const number = liveDocumentNumber(type);
  const verificationCode = crypto.randomUUID().replace(/-/g, "").slice(0, 20).toUpperCase();

  const title =
    type === "cpd"
      ? "Certificat CPD Omnia Live"
      : type === "success"
        ? "Certificat de réussite Omnia Live"
        : "Attestation de participation Omnia Live";

  const snapshot = {
    document_number: number,
    verification_code: verificationCode,
    participant: user.full_name,
    participant_email: user.email,
    event_title: ev.title,
    event_id: ev.id,
    organizer: ev.organizer_display_name,
    document_type: type,
    attendance_percent: Number(eligibility.attendance_percent || 0),
    issued_at: new Date().toISOString(),
  };

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([841.89, 595.28]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  page.drawText("OMNIA GLOBAL ACADEMY", {
    x: 55, y: 525, size: 20, font: bold, color: rgb(0, 0.125, 0.314),
  });
  page.drawText(title, {
    x: 55, y: 465, size: 28, font: bold, color: rgb(0.75, 0.53, 0.07),
  });
  page.drawText("Certifie que", { x: 55, y: 410, size: 14, font });
  page.drawText(String(user.full_name || ""), {
    x: 55, y: 365, size: 24, font: bold,
  });
  page.drawText(`a participe a : ${ev.title}`, {
    x: 55, y: 320, size: 14, font,
  });
  page.drawText(`Presence validee : ${Number(eligibility.attendance_percent || 0).toFixed(1)}%`, {
    x: 55, y: 285, size: 12, font,
  });
  page.drawText(`Document : ${number}`, { x: 55, y: 110, size: 10, font });
  page.drawText(`Verification : ${verificationCode}`, { x: 55, y: 90, size: 10, font });

  const bytes = await pdf.save();
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  const checksum = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  let storageKey: string | null = null;
  const bucket = Deno.env.get("R2_BUCKET_NAME") || "";

  if (bucket) {
    storageKey = `omnia-live/documents/${user.id}/${number}.pdf`;
    await r2Client().send(new PutObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      Body: bytes,
      ContentType: "application/pdf",
      ContentDisposition: `attachment; filename="${number}.pdf"`,
    }));
  }

  const { data: document, error } = await sb
    .from("live_documents_issued")
    .insert({
      document_number: number,
      event_id: ev.id,
      user_id: user.id,
      eligibility_id: eligibility.id,
      document_type: type,
      title,
      snapshot,
      pdf_storage_key: storageKey,
      checksum_sha256: checksum,
      verification_code: verificationCode,
    })
    .select("*")
    .single();

  if (error) throw error;

  return json({ success: true, document }, 201);
}

async function documentsMine(
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx) return json({ error: "AUTH_REQUIRED" }, 401);

  const { data, error } = await sb
    .from("live_documents_issued")
    .select("*,live_events(title,cover_url)")
    .eq("user_id", ctx.userId)
    .is("revoked_at", null)
    .order("issued_at", { ascending: false });

  if (error) throw error;
  return json({ success: true, documents: data ?? [] });
}

async function documentDownload(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx) return json({ error: "AUTH_REQUIRED" }, 401);

  const documentId = new URL(req.url).searchParams.get("document_id");
  if (!documentId) return json({ error: "DOCUMENT_ID_REQUIRED" }, 400);

  const { data: doc } = await sb
    .from("live_documents_issued")
    .select("*")
    .eq("id", documentId)
    .maybeSingle();

  if (!doc) return json({ error: "DOCUMENT_NOT_FOUND" }, 404);
  if (doc.user_id !== ctx.userId && !isSuperAdmin(ctx)) return json({ error: "FORBIDDEN" }, 403);
  if (!doc.pdf_storage_key) return json({ error: "PDF_NOT_AVAILABLE" }, 409);

  const url = await getSignedUrl(
    r2Client(),
    new GetObjectCommand({
      Bucket: Deno.env.get("R2_BUCKET_NAME") || "",
      Key: doc.pdf_storage_key,
      ResponseContentDisposition: `attachment; filename="${doc.document_number}.pdf"`,
    }),
    { expiresIn: 10 * 60 },
  );

  return json({ success: true, download_url: url, expires_in_seconds: 600 });
}

async function documentVerify(
  req: Request,
  sb: ReturnType<typeof createClient>,
) {
  const code = new URL(req.url).searchParams.get("code");
  if (!code) return json({ error: "VERIFICATION_CODE_REQUIRED" }, 400);

  const { data, error } = await sb
    .from("live_documents_issued")
    .select("document_number,document_type,title,issued_at,snapshot,revoked_at,revocation_reason")
    .eq("verification_code", code.trim().toUpperCase())
    .maybeSingle();

  if (error) throw error;
  if (!data) return json({ success: true, valid: false });

  return json({
    success: true,
    valid: !data.revoked_at,
    document: data,
  });
}

async function notificationDispatch(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx || !isSuperAdmin(ctx)) return json({ error: "FORBIDDEN" }, 403);

  const body = (await req.json().catch(() => ({}))) as { limit?: number };
  const limit = Math.min(Math.max(Number(body.limit || 50), 1), 200);

  const { data: rows, error } = await sb
    .from("live_notifications_queue")
    .select("*,users(email,full_name)")
    .eq("status", "queued")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at")
    .limit(limit);

  if (error) throw error;

  let sent = 0;
  let failed = 0;

  for (const row of rows ?? []) {
    try {
      if (row.channel === "email") {
        const brevoKey = Deno.env.get("BREVO_API_KEY") || "";
        if (!brevoKey || !row.users?.email) throw new Error("EMAIL_PROVIDER_NOT_CONFIGURED");

        const response = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "api-key": brevoKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sender: {
              name: "Omnia Global Academy",
              email: Deno.env.get("BREVO_SENDER_EMAIL") || "support@omniaglobalacademy.com",
            },
            to: [{ email: row.users.email, name: row.users.full_name || undefined }],
            subject: row.payload?.subject || "Omnia Live",
            htmlContent: row.payload?.html || `<p>${row.payload?.message || row.notification_type}</p>`,
          }),
        });

        if (!response.ok) throw new Error(`BREVO_${response.status}`);
      }

      await sb.from("live_notification_deliveries").insert({
        queue_id: row.id,
        user_id: row.user_id,
        channel: row.channel,
        recipient: row.channel === "email" ? row.users?.email : String(row.user_id || ""),
        provider: row.channel === "email" ? "brevo" : "omnia",
        status: "sent",
        payload: row.payload || {},
      });

      await sb.from("live_notifications_queue").update({
        status: "sent",
        sent_at: new Date().toISOString(),
      }).eq("id", row.id);

      sent += 1;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "DELIVERY_FAILED";

      await sb.from("live_notification_deliveries").insert({
        queue_id: row.id,
        user_id: row.user_id,
        channel: row.channel,
        recipient: row.channel === "email" ? row.users?.email : String(row.user_id || ""),
        provider: row.channel === "email" ? "brevo" : "omnia",
        status: "failed",
        error_message: msg,
        payload: row.payload || {},
      });

      await sb.from("live_notifications_queue").update({
        status: "failed",
        error_message: msg,
      }).eq("id", row.id);

      failed += 1;
    }
  }

  return json({ success: true, processed: (rows ?? []).length, sent, failed });
}


async function adminDashboard(
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx || !isSuperAdmin(ctx)) return json({ error: "FORBIDDEN" }, 403);

  const [
    eventsRes,
    registrationsRes,
    ordersRes,
    refundsRes,
    cancellationsRes,
    mediaRes,
    organizersRes,
    reportsRes,
    ledgerRes,
    roomsRes,
  ] = await Promise.all([
    sb.from("live_events")
      .select("id,title,status,price_amount,currency,starts_at,delivery_type,event_type,organizer_display_name,created_at")
      .neq("status","archived")
      .is("deleted_at",null)
      .order("created_at",{ascending:false}),
    sb.from("live_registrations").select("id,status,event_id"),
    sb.from("live_orders").select("id,payment_status,amount,currency,event_id"),
    sb.from("live_refund_requests").select("id,status,requested_amount,approved_amount"),
    sb.from("live_cancellation_requests").select("id,status,request_type"),
    sb.from("live_media").select("id,status,processing_status,media_type,event_id"),
    sb.from("live_organizer_profiles").select("id,verification_status,verified,public_rating,completed_events"),
    sb.from("live_content_reports").select("id,status,priority"),
    sb.from("live_organizer_ledger").select("id,status,gross_amount,oga_amount,organizer_amount,currency"),
    sb.from("live_rooms").select("id,status,event_id"),
  ]);

  const events = eventsRes.data ?? [];
  const activeEventIds = new Set(events.map((e:any)=>e.id));
  const registrations = (registrationsRes.data ?? []).filter((r:any)=>activeEventIds.has(r.event_id));
  const orders = (ordersRes.data ?? []).filter((o:any)=>!o.event_id || activeEventIds.has(o.event_id));
  const ledger = ledgerRes.data ?? [];

  const sum = (rows: any[], key: string) =>
    rows.reduce((acc, row) => acc + Number(row[key] || 0), 0);

  const countStatus = (rows: any[], key: string, value: string) =>
    rows.filter((row) => row[key] === value).length;

  const registrationCounts = new Map<string,number>();
  for (const r of registrations) {
    registrationCounts.set(r.event_id,(registrationCounts.get(r.event_id)||0)+1);
  }

  const recentEvents = events.slice(0,10).map((e:any)=>({
    ...e,
    registrations_count: registrationCounts.get(e.id)||0,
  }));

  const activeRooms = (roomsRes.data ?? []).filter((room:any)=>
    activeEventIds.has(room.event_id) &&
    ["open","live"].includes(room.status)
  );

  return json({
    success: true,
    kpis: {
      total_events: events.length,
      submitted: countStatus(events, "status", "submitted"),
      under_review: countStatus(events, "status", "under_review"),
      published: countStatus(events, "status", "published"),
      live_now: countStatus(events, "status", "live"),
      completed: countStatus(events, "status", "completed"),
      suspended: countStatus(events, "status", "suspended"),
      registrations: registrations.length,
      paid_orders: countStatus(orders, "payment_status", "paid"),
      gross_revenue: sum(orders.filter((o:any)=>o.payment_status==="paid"), "amount"),
      refunds_pending: (refundsRes.data ?? []).filter((x:any)=>["pending","under_review"].includes(x.status)).length,
      cancellations_pending: (cancellationsRes.data ?? []).filter((x:any)=>["pending","under_review"].includes(x.status)).length,
      media_processing: (mediaRes.data ?? []).filter((x:any)=>["pending","uploaded","processing"].includes(x.processing_status)).length,
      organizers_pending: (organizersRes.data ?? []).filter((x:any)=>x.verification_status==="pending").length,
      reports_open: (reportsRes.data ?? []).filter((x:any)=>["open","under_review"].includes(x.status)).length,
      live_rooms_active: activeRooms.length,
      organizer_due: sum(ledger.filter((x:any)=>["pending","available"].includes(x.status)), "organizer_amount"),
      oga_revenue: sum(ledger.filter((x:any)=>x.status!=="reversed"), "oga_amount"),
    },
    recent_events: recentEvents,
  });
}

async function adminEvents(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx || !isSuperAdmin(ctx)) return json({ error: "FORBIDDEN" }, 403);

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const deliveryType = url.searchParams.get("delivery_type");
  const search = (url.searchParams.get("q") || "").trim();

  let q = sb.from("live_events").select("*").order("updated_at", { ascending: false }).limit(500);
  if (status) q = q.eq("status", status);
  if (deliveryType) q = q.eq("delivery_type", deliveryType);
  if (search) {
    const safe = search.replace(/[%_,()]/g, "");
    q = q.or(`title.ilike.%${safe}%,organizer_display_name.ilike.%${safe}%`);
  }

  const { data, error } = await q;
  if (error) throw error;
  return json({ success: true, items: data ?? [] });
}

async function adminEventDetail(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx || !isSuperAdmin(ctx)) return json({ error: "FORBIDDEN" }, 403);
  const eventId = new URL(req.url).searchParams.get("event_id");
  if (!eventId) return json({ error: "EVENT_ID_REQUIRED" }, 400);

  const [
    eventRes, sessionsRes, speakersRes, mediaRes, registrationsRes,
    ordersRes, reviewsRes, termsRes, historyRes, roomsRes, reportsRes, notesRes
  ] = await Promise.all([
    sb.from("live_events").select("*").eq("id",eventId).maybeSingle(),
    sb.from("live_sessions").select("*").eq("event_id",eventId).order("sequence_no"),
    sb.from("live_event_speakers").select("*").eq("event_id",eventId).order("display_order"),
    sb.from("live_media").select("*").eq("event_id",eventId).order("created_at",{ascending:false}),
    sb.from("live_registrations").select("*").eq("event_id",eventId),
    sb.from("live_orders").select("*").eq("event_id",eventId).order("created_at",{ascending:false}),
    sb.from("live_reviews").select("*,users(full_name,email)").eq("event_id",eventId).order("created_at",{ascending:false}),
    sb.from("live_commercial_terms").select("*").eq("event_id",eventId).order("version",{ascending:false}),
    sb.from("live_review_history").select("*").eq("event_id",eventId).order("created_at",{ascending:false}),
    sb.from("live_rooms").select("*").eq("event_id",eventId),
    sb.from("live_content_reports").select("*").eq("event_id",eventId).order("created_at",{ascending:false}),
    sb.from("live_admin_notes").select("*").eq("entity_type","event").eq("entity_id",eventId).order("created_at",{ascending:false}),
  ]);

  if (!eventRes.data) return json({ error:"EVENT_NOT_FOUND" },404);

  return json({
    success:true,
    event:eventRes.data,
    sessions:sessionsRes.data??[],
    speakers:speakersRes.data??[],
    media:mediaRes.data??[],
    registrations:registrationsRes.data??[],
    orders:ordersRes.data??[],
    reviews:reviewsRes.data??[],
    commercial_terms:termsRes.data??[],
    review_history:historyRes.data??[],
    rooms:roomsRes.data??[],
    reports:reportsRes.data??[],
    admin_notes:notesRes.data??[],
  });
}

async function adminOrganizers(
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx || !isSuperAdmin(ctx)) return json({ error:"FORBIDDEN" },403);

  const { data: applications, error: appError } = await sb
    .from("live_organizer_applications")
    .select("*,users(id,full_name,email,status)")
    .order("created_at",{ascending:false});
  if (appError) throw appError;

  const { data: profiles, error: profileError } = await sb
    .from("live_organizer_profiles")
    .select("*,users(id,full_name,email,status)")
    .order("updated_at",{ascending:false});
  if (profileError) throw profileError;

  const byUser=new Map((profiles??[]).map((p:any)=>[p.user_id,p]));
  const organizers=(applications??[]).map((a:any)=>{
    const p=byUser.get(a.user_id) as any;
    return {
      ...(p||{}),
      application_id:a.id,
      id:a.id,
      user_id:a.user_id,
      display_name:a.display_name,
      organizer_type:a.organizer_type,
      professional_title:a.professional_title,
      organization_name:a.organization_name,
      experience_summary:a.experience_summary,
      event_topics:a.event_topics,
      admin_note:a.admin_note,
      verification_status:a.status,
      users:a.users,
      public_rating:p?.public_rating??0,
      completed_events:p?.completed_events??0,
      cancellation_count:p?.cancellation_count??0,
      refund_count:p?.refund_count??0,
    };
  });

  return json({ success:true, organizers, applications, profiles:profiles??[] });
}


async function adminOrganizerDecision(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx || !isSuperAdmin(ctx)) return json({ error:"FORBIDDEN" },403);
  const body=await req.json().catch(()=>({})) as any;
  const applicationId=body.application_id||body.profile_id;
  if(!applicationId||!body.decision) return json({error:"MISSING_PARAMS"},400);

  const {data,error}=await sb.rpc("omnia_live_approve_organizer",{
    p_application_id:applicationId,
    p_admin_id:ctx.userId,
    p_decision:body.decision,
    p_note:body.note||null,
  });
  if(error) return json({error:"ORGANIZER_DECISION_FAILED",message:error.message,code:error.code,details:error.details},400);
  return json({success:true,result:data});
}


async function adminStructurePacks(
  _sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx || !isSuperAdmin(ctx)) return json({ error:"FORBIDDEN" },403);
  return json({ success:true, packs:[], legacy_commerce_disabled:true });
}

async function adminMediaQueue(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx || !isSuperAdmin(ctx)) return json({ error:"FORBIDDEN" },403);
  const status = new URL(req.url).searchParams.get("status");

  let q = sb.from("live_media").select("*,live_events(title,organizer_display_name,status)")
    .order("created_at",{ascending:false}).limit(500);
  if (status) q = q.eq("status",status);

  const { data, error } = await q;
  if (error) throw error;
  return json({ success:true, media:data??[] });
}

async function adminMediaReview(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx || !isSuperAdmin(ctx)) return json({ error:"FORBIDDEN" },403);
  const body = await req.json().catch(()=>({})) as any;
  if (!body.media_id || !body.decision) return json({ error:"MISSING_PARAMS" },400);
  if (!["approved","changes_requested","rejected","suspended"].includes(body.decision)) return json({ error:"INVALID_DECISION" },400);

  const { data: media } = await sb.from("live_media").select("*").eq("id",body.media_id).maybeSingle();
  if (!media) return json({ error:"MEDIA_NOT_FOUND" },404);

  const statusMap:any = {
    approved:"published",
    changes_requested:"draft",
    rejected:"rejected",
    suspended:"suspended",
  };

  const { data: review, error } = await sb.from("live_media_reviews").insert({
    media_id:media.id,event_id:media.event_id,version:Number(media.version||1),
    decision:body.decision,reason:body.reason||null,reviewed_by:ctx.userId,reviewed_at:new Date().toISOString()
  }).select("*").single();

  if (error) throw error;

  await sb.from("live_media").update({
    status:statusMap[body.decision]||media.status,
    updated_at:new Date().toISOString(),
  }).eq("id",media.id);

  return json({ success:true, review });
}

async function adminFinance(
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx || !isSuperAdmin(ctx)) return json({ error: "FORBIDDEN" }, 403);

  const { error: refreshError } = await sb.rpc("omnia_live_refresh_ledger_availability", {
    p_organizer_user_id: null,
  });
  if (refreshError) throw refreshError;

  const [orders, ledger, payouts, refunds] = await Promise.all([
    sb.from("live_orders").select("*,live_events(title,organizer_display_name)").order("created_at", { ascending: false }).limit(500),
    sb.from("live_organizer_ledger").select("*,live_events(title)").order("created_at", { ascending: false }).limit(1000),
    sb.from("live_payout_batches").select("*").order("created_at", { ascending: false }).limit(500),
    sb.from("live_refund_requests").select("*").order("created_at", { ascending: false }).limit(500),
  ]);

  if (orders.error) throw orders.error;
  if (ledger.error) throw ledger.error;
  if (payouts.error) throw payouts.error;
  if (refunds.error) throw refunds.error;

  const ledgerRows = await liveLedgerWithAvailability(sb, ledger.data ?? []);

  return json({
    success: true,
    orders: orders.data ?? [],
    ledger: ledgerRows,
    payouts: payouts.data ?? [],
    refunds: refunds.data ?? [],
  });
}

async function adminPayoutCreate(
  _req: Request,
  _sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx || !isSuperAdmin(ctx)) return json({ error: "FORBIDDEN" }, 403);
  return json({
    error: "LEGACY_PAYOUT_WORKFLOW_DISABLED",
    message: "Créez et traitez les versements depuis les demandes de paiement organisateur.",
  }, 410);
}

async function adminPayoutDecision(
  _req: Request,
  _sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx || !isSuperAdmin(ctx)) return json({ error: "FORBIDDEN" }, 403);
  return json({
    error: "LEGACY_PAYOUT_WORKFLOW_DISABLED",
    message: "Les lots sont désormais pilotés automatiquement par les demandes de paiement.",
  }, 410);
}

async function adminReports(
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx || !isSuperAdmin(ctx)) return json({ error:"FORBIDDEN" },403);

  const { data: rows, error } = await sb.from("live_content_reports")
    .select("*")
    .order("created_at",{ascending:false});

  if(error) throw error;
  const reports = rows ?? [];

  const eventMap = await hydrateEventMap(sb, reports.map((r:any)=>r.event_id));
  const userMap = await hydrateUserMap(sb, reports.map((r:any)=>r.reporter_user_id || r.user_id).filter(Boolean));

  const mediaIds=[...new Set(reports.map((r:any)=>r.media_id).filter(Boolean))];
  let mediaMap=new Map<string,any>();
  if(mediaIds.length){
    const {data:media}=await sb.from("live_media").select("id,title,media_type").in("id",mediaIds);
    mediaMap=new Map((media??[]).map((x:any)=>[x.id,x]));
  }

  return json({
    success:true,
    reports:reports.map((r:any)=>{
      const ev=eventMap.get(r.event_id);
      const media=mediaMap.get(r.media_id);
      const u=userMap.get(r.reporter_user_id || r.user_id);
      return {
        ...r,
        target_title: ev?.title || media?.title || "Signalement",
        user_name: u?.full_name ?? null,
        user_email: u?.email ?? null,
      };
    }),
  });
}

async function adminReportDecision(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx || !isSuperAdmin(ctx)) return json({ error:"FORBIDDEN" },403);
  const body=await req.json().catch(()=>({})) as any;
  if(!body.report_id||!body.status) return json({error:"MISSING_PARAMS"},400);
  if(!["under_review","resolved","dismissed"].includes(body.status)) return json({error:"INVALID_STATUS"},400);

  const patch:any={status:body.status,assigned_to:ctx.userId,updated_at:new Date().toISOString()};
  if(["resolved","dismissed"].includes(body.status)){patch.resolution=body.resolution||null;patch.resolved_at=new Date().toISOString()}
  const {data,error}=await sb.from("live_content_reports").update(patch).eq("id",body.report_id).select("*").single();
  if(error) throw error;
  return json({success:true,report:data});
}

async function adminSettingsGet(
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx || !isSuperAdmin(ctx)) return json({ error:"FORBIDDEN" },403);
  const {data,error}=await sb.from("live_global_settings").select("*").order("config_key");
  if(error) throw error;
  return json({success:true,settings:data??[]});
}

async function adminSettingsSave(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx || !isSuperAdmin(ctx)) return json({ error:"FORBIDDEN" },403);
  const body=await req.json().catch(()=>({})) as any;
  if(!body.config_key || body.config_value===undefined) return json({error:"MISSING_PARAMS"},400);

  const {data,error}=await sb.from("live_global_settings").upsert({
    config_key:body.config_key,config_value:body.config_value,description:body.description||null,
    is_public:Boolean(body.is_public),updated_by:ctx.userId,updated_at:new Date().toISOString()
  },{onConflict:"config_key"}).select("*").single();

  if(error) throw error;
  return json({success:true,setting:data});
}


async function organizerDashboard(
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx) return json({ error: "AUTH_REQUIRED" }, 401);
  if (!canOrganize(ctx)) return json({ error: "ORGANIZER_PERMISSION_REQUIRED" }, 403);

  const { data: events, error: eventsError } = await sb
    .from("live_events")
    .select("*")
    .eq("owner_user_id", ctx.userId)
    .order("updated_at", { ascending: false });

  if (eventsError) throw eventsError;

  const ids = (events ?? []).map((e:any)=>e.id);
  let registrations:any[] = [], orders:any[] = [], media:any[] = [], rooms:any[] = [], reviews:any[] = [];

  if (ids.length) {
    const results = await Promise.all([
      sb.from("live_registrations").select("id,event_id,status,user_id").in("event_id", ids),
      sb.from("live_orders").select("id,event_id,payment_status,amount,currency").in("event_id", ids),
      sb.from("live_media").select("id,event_id,status,processing_status,media_type").in("event_id", ids),
      sb.from("live_rooms").select("id,event_id,status").in("event_id", ids),
      sb.from("live_reviews").select("id,event_id,rating,status").in("event_id", ids).eq("status","published"),
    ]);
    registrations = results[0].data ?? [];
    orders = results[1].data ?? [];
    media = results[2].data ?? [];
    rooms = results[3].data ?? [];
    reviews = results[4].data ?? [];
  }

  const ledgerRes = await sb
    .from("live_organizer_ledger")
    .select("*")
    .eq("organizer_user_id", ctx.userId)
    .order("created_at", { ascending: false });

  const ledger = ledgerRes.data ?? [];
  const sum = (rows:any[], key:string) => rows.reduce((a,x)=>a+Number(x[key]||0),0);

  return json({
    success: true,
    kpis: {
      total_events: (events ?? []).length,
      draft: (events ?? []).filter((x:any)=>x.status==="draft").length,
      pending_review: (events ?? []).filter((x:any)=>["submitted","under_review","changes_requested"].includes(x.status)).length,
      published: (events ?? []).filter((x:any)=>x.status==="published").length,
      live_now: (events ?? []).filter((x:any)=>x.status==="live").length,
      completed: (events ?? []).filter((x:any)=>x.status==="completed").length,
      registrations: registrations.filter((x:any)=>x.status==="confirmed").length,
      paid_orders: orders.filter((x:any)=>x.payment_status==="paid").length,
      gross_revenue: sum(orders.filter((x:any)=>x.payment_status==="paid"),"amount"),
      organizer_revenue: sum(ledger.filter((x:any)=>x.status!=="reversed"),"organizer_amount"),
      available_payout: sum(ledger.filter((x:any)=>["pending","available"].includes(x.status)),"organizer_amount"),
      media_processing: media.filter((x:any)=>["pending","uploaded","processing"].includes(x.processing_status)).length,
      active_rooms: rooms.filter((x:any)=>["open","live"].includes(x.status)).length,
      average_rating: reviews.length ? reviews.reduce((a:any,x:any)=>a+Number(x.rating||0),0)/reviews.length : 0,
    },
    recent_events: (events ?? []).slice(0,8),
  });
}

async function organizerEvents(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx) return json({ error:"AUTH_REQUIRED" },401);
  if (!canOrganize(ctx)) return json({ error:"ORGANIZER_PERMISSION_REQUIRED" },403);

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const qText = (url.searchParams.get("q")||"").trim();

  let q = sb.from("live_events").select("*")
    .eq("owner_user_id",ctx.userId)
    .order("updated_at",{ascending:false})
    .limit(300);

  if(status) q=q.eq("status",status);
  if(qText){
    const safe=qText.replace(/[%_,()]/g,"");
    q=q.ilike("title",`%${safe}%`);
  }

  const {data,error}=await q;
  if(error) throw error;
  return json({success:true,items:data??[]});
}

async function organizerParticipants(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const eventId=new URL(req.url).searchParams.get("event_id");
  if(!eventId) return json({error:"EVENT_ID_REQUIRED"},400);
  if(!(await canManageEvent(sb,ctx,eventId))&&!isSuperAdmin(ctx)) return json({error:"FORBIDDEN"},403);

  const [regs,waitlist,attendance,orders] = await Promise.all([
    sb.from("live_registrations").select("*,users(id,full_name,email)").eq("event_id",eventId).order("registered_at",{ascending:false}),
    sb.from("live_waitlist").select("*,users(id,full_name,email)").eq("event_id",eventId).order("position"),
    sb.from("live_attendance_segments").select("user_id,duration_seconds").eq("event_id",eventId),
    sb.from("live_orders").select("user_id,payment_status,amount,currency").eq("event_id",eventId),
  ]);

  const attendanceMap:any={};
  for(const row of attendance.data??[]){
    attendanceMap[row.user_id]=(attendanceMap[row.user_id]||0)+Number(row.duration_seconds||0);
  }

  const orderMap:any={};
  for(const row of orders.data??[]) orderMap[row.user_id]=row;

  const participants=(regs.data??[]).map((r:any)=>({
    ...r,
    attendance_seconds:attendanceMap[r.user_id]||0,
    order:orderMap[r.user_id]||null,
  }));

  return json({success:true,participants,waitlist:waitlist.data??[]});
}

async function organizerMedia(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const eventId=new URL(req.url).searchParams.get("event_id");
  if(!eventId) return json({error:"EVENT_ID_REQUIRED"},400);
  if(!(await canManageEvent(sb,ctx,eventId))&&!isSuperAdmin(ctx)) return json({error:"FORBIDDEN"},403);

  const {data,error}=await sb.from("live_media").select("*")
    .eq("event_id",eventId).neq("status","deleted").order("created_at",{ascending:false});
  if(error) throw error;

  const {data:reviews}=await sb.from("live_media_reviews").select("*")
    .eq("event_id",eventId).order("created_at",{ascending:false});

  return json({success:true,media:data??[],reviews:reviews??[]});
}

async function organizerCancellationList(
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const {data:events}=await sb.from("live_events").select("id").eq("owner_user_id",ctx.userId);
  const ids=(events??[]).map((x:any)=>x.id);
  if(!ids.length) return json({success:true,requests:[]});

  const {data,error}=await sb.from("live_cancellation_requests")
    .select("*,live_events(title,starts_at,status)")
    .in("event_id",ids).order("created_at",{ascending:false});
  if(error) throw error;
  return json({success:true,requests:data??[]});
}

async function organizerAccessCodes(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const eventId=new URL(req.url).searchParams.get("event_id");
  if(!eventId) return json({error:"EVENT_ID_REQUIRED"},400);
  if(!(await canManageEvent(sb,ctx,eventId))&&!isSuperAdmin(ctx)) return json({error:"FORBIDDEN"},403);

  const {data,error}=await sb.from("live_private_access_codes")
    .select("*").eq("event_id",eventId).order("created_at",{ascending:false});
  if(error) throw error;
  return json({success:true,codes:data??[]});
}

async function organizerAnalyticsOverview(
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const {data:events}=await sb.from("live_events").select("id,title,status").eq("owner_user_id",ctx.userId);
  const ids=(events??[]).map((x:any)=>x.id);
  if(!ids.length) return json({success:true,events:[],analytics:[]});

  const {data:analytics,error}=await sb.from("live_event_analytics_daily")
    .select("*").in("event_id",ids).order("metric_date");
  if(error) throw error;
  return json({success:true,events:events??[],analytics:analytics??[]});
}


async function participantDashboard(
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx) return json({ error:"AUTH_REQUIRED" },401);

  const [regsRes, ordersRes, docsRes, notificationsRes, favoritesRes] = await Promise.all([
    sb.from("live_registrations")
      .select("*,live_events(id,title,slug,short_description,delivery_type,event_type,status,starts_at,timezone,cover_url,price_amount,currency,replay_enabled)")
      .eq("user_id",ctx.userId)
      .order("registered_at",{ascending:false}),
    sb.from("live_orders")
      .select("*,live_events(id,title,cover_url,starts_at),live_invoices(id,invoice_number,issued_at)")
      .eq("user_id",ctx.userId)
      .order("created_at",{ascending:false}),
    sb.from("live_documents_issued")
      .select("*,live_events(id,title,cover_url)")
      .eq("user_id",ctx.userId)
      .is("revoked_at",null)
      .order("issued_at",{ascending:false}),
    sb.from("live_notifications_queue")
      .select("*")
      .eq("user_id",ctx.userId)
      .is("dismissed_at",null)
      .order("scheduled_at",{ascending:false})
      .limit(20),
    sb.from("live_participant_favorites")
      .select("event_id,live_events(id,title,short_description,cover_url,status,starts_at,delivery_type,event_type,price_amount,currency)")
      .eq("user_id",ctx.userId)
      .order("created_at",{ascending:false}),
  ]);

  const regs=regsRes.data??[];
  const upcoming=regs.filter((r:any)=>r.status==="confirmed"&&r.live_events?.starts_at&&new Date(r.live_events.starts_at)>new Date());
  const active=regs.filter((r:any)=>r.status==="confirmed"&&["live","published"].includes(r.live_events?.status));
  const completed=regs.filter((r:any)=>["completed"].includes(r.live_events?.status));
  const orders=ordersRes.data??[];

  return json({
    success:true,
    kpis:{
      registrations:regs.filter((r:any)=>r.status==="confirmed").length,
      upcoming:upcoming.length,
      active:active.length,
      completed:completed.length,
      paid_orders:orders.filter((o:any)=>o.payment_status==="paid").length,
      documents:(docsRes.data??[]).length,
      unread_notifications:(notificationsRes.data??[]).filter((n:any)=>!n.read_at).length,
      favorites:(favoritesRes.data??[]).length,
    },
    upcoming:upcoming.slice(0,6),
    active:active.slice(0,6),
    recent_orders:orders.slice(0,5),
    recent_documents:(docsRes.data??[]).slice(0,5),
    notifications:notificationsRes.data??[],
    favorites:(favoritesRes.data??[]).map((x:any)=>x.live_events).filter(Boolean),
  });
}

async function participantLibrary(
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);

  const [regs, entitlements, progress, media] = await Promise.all([
    sb.from("live_registrations")
      .select("*,live_events(*)")
      .eq("user_id",ctx.userId)
      .eq("status","confirmed")
      .order("registered_at",{ascending:false}),
    sb.from("live_replay_entitlements")
      .select("*,live_events(*),live_media(id,title,media_type,status,processing_status,duration_seconds,cover_url)")
      .eq("user_id",ctx.userId)
      .is("revoked_at",null)
      .order("created_at",{ascending:false}),
    sb.from("live_media_progress")
      .select("*")
      .eq("user_id",ctx.userId),
    sb.from("live_media")
      .select("id,event_id,title,media_type,status,processing_status,duration_seconds")
      .eq("status","published")
      .eq("processing_status","ready"),
  ]);

  const progressMap:any={};
  for(const p of progress.data??[]) progressMap[p.media_id]=p;

  const replayItems=(entitlements.data??[])
    .filter((x:any)=>!x.expires_at||new Date(x.expires_at)>new Date())
    .map((x:any)=>({...x,progress:progressMap[x.media_id]||null}));

  const trainingEventIds=(regs.data??[])
    .filter((r:any)=>r.live_events?.delivery_type==="synchronous_training")
    .map((r:any)=>r.event_id);

  const trainingMedia=(media.data??[])
    .filter((m:any)=>trainingEventIds.includes(m.event_id))
    .map((m:any)=>({...m,progress:progressMap[m.id]||null}));

  return json({
    success:true,
    registrations:regs.data??[],
    replays:replayItems,
    training_media:trainingMedia,
  });
}

async function participantNotifications(
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const {data,error}=await sb.from("live_notifications_queue")
    .select("*").eq("user_id",ctx.userId).is("dismissed_at",null)
    .order("scheduled_at",{ascending:false}).limit(100);
  if(error) throw error;
  return json({success:true,notifications:data??[]});
}

async function participantNotificationUpdate(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const body=await req.json().catch(()=>({})) as any;
  if(!body.notification_id||!body.action) return json({error:"MISSING_PARAMS"},400);

  const patch:any={};
  if(body.action==="read") patch.read_at=new Date().toISOString();
  else if(body.action==="dismiss") patch.dismissed_at=new Date().toISOString();
  else return json({error:"INVALID_ACTION"},400);

  const {data,error}=await sb.from("live_notifications_queue")
    .update(patch).eq("id",body.notification_id).eq("user_id",ctx.userId)
    .select("*").single();
  if(error) throw error;
  return json({success:true,notification:data});
}

async function participantProgressUpdate(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const body=await req.json().catch(()=>({})) as any;
  if(!body.media_id) return json({error:"MEDIA_ID_REQUIRED"},400);

  const {data:media}=await sb.from("live_media")
    .select("id,event_id,duration_seconds,status,processing_status")
    .eq("id",body.media_id).maybeSingle();

  if(!media) return json({error:"MEDIA_NOT_FOUND"},404);

  const ev=await eventForAccess(sb,media.event_id);
  let allowed=isSuperAdmin(ctx)||ownerEventAccess(ctx,ev);

  if(!allowed){
    const {data:reg}=await sb.from("live_registrations").select("id")
      .eq("event_id",media.event_id).eq("user_id",ctx.userId).eq("status","confirmed").maybeSingle();
    const {data:ent}=await sb.from("live_replay_entitlements").select("id")
      .eq("event_id",media.event_id).eq("media_id",media.id).eq("user_id",ctx.userId)
      .is("revoked_at",null).maybeSingle();
    allowed=!!reg||!!ent;
  }
  if(!allowed) return json({error:"FORBIDDEN"},403);

  const position=Math.max(0,Number(body.last_position_seconds||0));
  const watched=Math.max(0,Number(body.watched_seconds||position));
  const duration=Number(media.duration_seconds||0);
  const percent=duration>0?Math.min(100,(Math.max(position,watched)/duration)*100):0;
  const now=new Date().toISOString();

  const {data,error}=await sb.from("live_media_progress").upsert({
    media_id:media.id,user_id:ctx.userId,event_id:media.event_id,
    last_position_seconds:position,watched_seconds:watched,completion_percent:percent,
    first_started_at:body.first_started_at||now,last_seen_at:now,
    completed_at:percent>=95?now:null
  },{onConflict:"media_id,user_id"}).select("*").single();

  if(error) throw error;
  return json({success:true,progress:data});
}

async function participantWaitlistAccept(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const body=await req.json().catch(()=>({})) as any;
  if(!body.waitlist_id) return json({error:"WAITLIST_ID_REQUIRED"},400);

  const {data:w}=await sb.from("live_waitlist").select("*")
    .eq("id",body.waitlist_id).eq("user_id",ctx.userId).maybeSingle();
  if(!w) return json({error:"WAITLIST_ENTRY_NOT_FOUND"},404);
  if(w.status!=="invited") return json({error:"WAITLIST_NOT_INVITED"},409);
  if(w.invitation_expires_at&&new Date(w.invitation_expires_at)<=new Date()) return json({error:"WAITLIST_INVITATION_EXPIRED"},410);

  const ev=await eventForAccess(sb,w.event_id);
  if(!ev) return json({error:"EVENT_NOT_FOUND"},404);

  const amount=Number(ev.price_amount||0);
  const free=amount<=0;

  const {data:reg,error:regError}=await sb.from("live_registrations").upsert({
    event_id:w.event_id,user_id:ctx.userId,status:free?"confirmed":"pending_payment",
    access_source:"waitlist",registered_at:new Date().toISOString()
  },{onConflict:"event_id,user_id"}).select("*").single();
  if(regError) throw regError;

  await sb.from("live_waitlist").update({
    status:"converted",converted_registration_id:reg.id,updated_at:new Date().toISOString()
  }).eq("id",w.id);

  if(free) return json({success:true,registration:reg,payment_required:false});

  const {data:order,error}=await sb.from("live_orders").insert({
    order_number:orderNumber(),user_id:ctx.userId,event_id:w.event_id,registration_id:reg.id,
    amount,currency:ev.currency||"XOF",payment_status:"pending",
    payment_provider:Deno.env.get("LIVE_PAYMENT_PROVIDER")||"platform_default"
  }).select("*").single();
  if(error) throw error;
  return json({success:true,registration:reg,order,payment_required:true});
}

async function participantRefunds(
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const {data,error}=await sb.from("live_refund_requests")
    .select("*,live_orders(order_number,amount,currency,payment_status),live_events(title,cover_url)")
    .eq("user_id",ctx.userId).order("created_at",{ascending:false});
  if(error) throw error;
  return json({success:true,refunds:data??[]});
}

async function favoriteToggle(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const body=await req.json().catch(()=>({})) as any;
  if(!body.event_id) return json({error:"EVENT_ID_REQUIRED"},400);

  const {data:existing}=await sb.from("live_participant_favorites")
    .select("id").eq("user_id",ctx.userId).eq("event_id",body.event_id).maybeSingle();

  if(existing){
    await sb.from("live_participant_favorites").delete().eq("id",existing.id);
    return json({success:true,favorite:false});
  }

  const {error}=await sb.from("live_participant_favorites").insert({
    user_id:ctx.userId,event_id:body.event_id
  });
  if(error) throw error;
  return json({success:true,favorite:true});
}


function mediaProcessingProfiles() {
  return [
    { profile_key:"240p", label:"Faible connexion", width:426, height:240, video_bitrate_kbps:350, audio_bitrate_kbps:48 },
    { profile_key:"360p", label:"Économique", width:640, height:360, video_bitrate_kbps:700, audio_bitrate_kbps:64 },
    { profile_key:"480p", label:"Standard", width:854, height:480, video_bitrate_kbps:1200, audio_bitrate_kbps:96 },
    { profile_key:"720p", label:"HD", width:1280, height:720, video_bitrate_kbps:2500, audio_bitrate_kbps:128 },
  ];
}

async function mediaCreateRevision(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const body=await req.json().catch(()=>({})) as any;
  if(!body.media_id) return json({error:"MEDIA_ID_REQUIRED"},400);

  const {data:source}=await sb.from("live_media").select("*").eq("id",body.media_id).maybeSingle();
  if(!source) return json({error:"MEDIA_NOT_FOUND"},404);
  if(!(await canManageEvent(sb,ctx,source.event_id))&&!isSuperAdmin(ctx)) return json({error:"FORBIDDEN"},403);

  const parent=source.parent_media_id||source.id;
  const {data:last}=await sb.from("live_media").select("revision_number")
    .or(`id.eq.${parent},parent_media_id.eq.${parent}`)
    .order("revision_number",{ascending:false}).limit(1).maybeSingle();

  const revision=Number(last?.revision_number||1)+1;

  const {data:newMedia,error}=await sb.from("live_media").insert({
    event_id:source.event_id,
    session_id:source.session_id,
    media_type:source.media_type,
    title:body.title||source.title,
    description:body.description??source.description,
    file_name:body.file_name||null,
    mime_type:body.mime_type||source.mime_type,
    size_bytes:body.size_bytes||null,
    storage_provider:"r2",
    storage_key:body.storage_key||null,
    original_storage_key:body.original_storage_key||body.storage_key||null,
    status:"draft",
    processing_status:body.storage_key?"uploaded":"pending",
    access_policy:source.access_policy,
    availability_scope:source.availability_scope,
    watermark_enabled:source.watermark_enabled,
    watermark_mode:source.watermark_mode,
    download_allowed:source.download_allowed,
    is_primary:source.is_primary,
    version:revision,
    revision_number:revision,
    parent_media_id:parent,
    review_required:true,
    approved_version:null,
    source_kind:body.source_kind||"upload",
    retention_policy:source.retention_policy||"standard",
  }).select("*").single();

  if(error) throw error;
  return json({success:true,media:newMedia},201);
}

async function mediaProcessingPrepare(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const body=await req.json().catch(()=>({})) as any;
  if(!body.media_id) return json({error:"MEDIA_ID_REQUIRED"},400);

  const {data:media}=await sb.from("live_media").select("*").eq("id",body.media_id).maybeSingle();
  if(!media) return json({error:"MEDIA_NOT_FOUND"},404);
  if(!(await canManageEvent(sb,ctx,media.event_id))&&!isSuperAdmin(ctx)) return json({error:"FORBIDDEN"},403);
  if(!["recorded_video","replay"].includes(media.media_type)) return json({error:"VIDEO_MEDIA_REQUIRED"},400);

  const profiles=mediaProcessingProfiles();
  const rows=profiles.map((p:any)=>({
    media_id:media.id,...p,status:"pending"
  }));

  const {error}=await sb.from("live_media_stream_profiles").upsert(rows,{onConflict:"media_id,profile_key"});
  if(error) throw error;

  const queued=await processingQueue(
    new Request(req.url,{method:"POST",headers:req.headers,body:JSON.stringify({media_id:media.id})}),
    sb,ctx
  );

  return json({success:true,profiles,processing_queued:true});
}

async function mediaProcessingCallback(
  req: Request,
  sb: ReturnType<typeof createClient>,
) {
  const secret=Deno.env.get("MEDIA_WORKER_SECRET")||"";
  const provided=req.headers.get("X-Omnia-Media-Secret")||req.headers.get("x-omnia-media-secret")||"";
  if(!secret||provided!==secret) return json({error:"INVALID_MEDIA_WORKER_SECRET"},401);

  const body=await req.json().catch(()=>({})) as any;
  if(!body.media_id||!body.status) return json({error:"MISSING_PARAMS"},400);

  const {data:media}=await sb.from("live_media").select("*").eq("id",body.media_id).maybeSingle();
  if(!media) return json({error:"MEDIA_NOT_FOUND"},404);

  if(body.profiles && Array.isArray(body.profiles)){
    for(const p of body.profiles){
      await sb.from("live_media_stream_profiles").upsert({
        media_id:media.id,
        profile_key:p.profile_key,
        label:p.label||p.profile_key,
        width:p.width||null,
        height:p.height||null,
        video_bitrate_kbps:p.video_bitrate_kbps||null,
        audio_bitrate_kbps:p.audio_bitrate_kbps||null,
        manifest_key:p.manifest_key||null,
        file_key:p.file_key||null,
        status:p.status||"ready",
        updated_at:new Date().toISOString()
      },{onConflict:"media_id,profile_key"});
    }
  }

  const patch:any={updated_at:new Date().toISOString()};
  if(body.status==="ready"){
    patch.processing_status="ready";
    patch.status=media.review_required?"draft":"published";
    patch.streaming_manifest_key=body.master_manifest_key||body.streaming_manifest_key||media.streaming_manifest_key;
    patch.audio_track_key=body.audio_track_key||media.audio_track_key;
    patch.duration_seconds=body.duration_seconds||media.duration_seconds;
    patch.processing_error=null;
  } else if(body.status==="failed"){
    patch.processing_status="failed";
    patch.processing_error=body.error_message||"MEDIA_PROCESSING_FAILED";
  } else {
    patch.processing_status="processing";
  }

  const {data:updated,error}=await sb.from("live_media").update(patch).eq("id",media.id).select("*").single();
  if(error) throw error;

  return json({success:true,media:updated});
}

async function replayJobCreate(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const body=await req.json().catch(()=>({})) as any;
  if(!body.event_id) return json({error:"EVENT_ID_REQUIRED"},400);
  if(!(await canManageEvent(sb,ctx,body.event_id))&&!isSuperAdmin(ctx)) return json({error:"FORBIDDEN"},403);

  const ev=await eventForAccess(sb,body.event_id);
  if(!ev) return json({error:"EVENT_NOT_FOUND"},404);
  if(!ev.replay_enabled) return json({error:"REPLAY_NOT_ENABLED"},409);

  const {data:existing}=await sb.from("live_replay_jobs").select("*")
    .eq("event_id",body.event_id)
    .eq("session_id",body.session_id||null)
    .in("status",["queued","recording_wait","processing","ready"])
    .order("created_at",{ascending:false}).limit(1).maybeSingle();

  if(existing) return json({success:true,job:existing,already_exists:true});

  const {data,error}=await sb.from("live_replay_jobs").insert({
    event_id:body.event_id,
    room_id:body.room_id||null,
    session_id:body.session_id||null,
    source_recording_key:body.source_recording_key||null,
    status:body.source_recording_key?"queued":"recording_wait",
    provider:"internal"
  }).select("*").single();

  if(error) throw error;
  return json({success:true,job:data},201);
}

async function replayJobCallback(
  req: Request,
  sb: ReturnType<typeof createClient>,
) {
  const secret=Deno.env.get("MEDIA_WORKER_SECRET")||"";
  const provided=req.headers.get("X-Omnia-Media-Secret")||req.headers.get("x-omnia-media-secret")||"";
  if(!secret||provided!==secret) return json({error:"INVALID_MEDIA_WORKER_SECRET"},401);

  const body=await req.json().catch(()=>({})) as any;
  if(!body.job_id||!body.status) return json({error:"MISSING_PARAMS"},400);

  const {data:job}=await sb.from("live_replay_jobs").select("*").eq("id",body.job_id).maybeSingle();
  if(!job) return json({error:"REPLAY_JOB_NOT_FOUND"},404);

  if(body.status==="recording_ready"){
    const {data:media,error:mediaError}=await sb.from("live_media").insert({
      event_id:job.event_id,
      session_id:job.session_id,
      media_type:"replay",
      title:body.title||"Replay Omnia Live",
      file_name:body.file_name||null,
      mime_type:body.mime_type||"video/mp4",
      size_bytes:body.size_bytes||null,
      storage_provider:"r2",
      storage_key:body.storage_key,
      original_storage_key:body.storage_key,
      status:"draft",
      processing_status:"uploaded",
      access_policy:"registered",
      availability_scope:"registered",
      watermark_enabled:true,
      watermark_mode:"dynamic",
      download_allowed:false,
      is_primary:false,
      version:1,
      revision_number:1,
      review_required:true,
      source_kind:"generated_replay",
      retention_policy:"standard"
    }).select("*").single();

    if(mediaError) throw mediaError;

    const {data:updated,error}=await sb.from("live_replay_jobs").update({
      status:"processing",
      source_recording_key:body.storage_key,
      media_id:media.id,
      updated_at:new Date().toISOString()
    }).eq("id",job.id).select("*").single();

    if(error) throw error;
    return json({success:true,job:updated,media});
  }

  if(body.status==="ready"){
    const now=new Date().toISOString();
    if(job.media_id){
      await sb.from("live_media").update({
        streaming_manifest_key:body.master_manifest_key||null,
        audio_track_key:body.audio_track_key||null,
        duration_seconds:body.duration_seconds||null,
        processing_status:"ready",
        status:"draft",
        processing_error:null,
        updated_at:now
      }).eq("id",job.media_id);
    }

    const {data:updated,error}=await sb.from("live_replay_jobs").update({
      status:"ready",completed_at:now,updated_at:now,error_message:null
    }).eq("id",job.id).select("*").single();

    if(error) throw error;
    return json({success:true,job:updated});
  }

  if(body.status==="failed"){
    const {data:updated,error}=await sb.from("live_replay_jobs").update({
      status:"failed",error_message:body.error_message||"REPLAY_PROCESSING_FAILED",
      updated_at:new Date().toISOString()
    }).eq("id",job.id).select("*").single();

    if(job.media_id){
      await sb.from("live_media").update({
        processing_status:"failed",
        processing_error:body.error_message||"REPLAY_PROCESSING_FAILED",
        updated_at:new Date().toISOString()
      }).eq("id",job.media_id);
    }

    if(error) throw error;
    return json({success:true,job:updated});
  }

  return json({error:"INVALID_STATUS"},400);
}

async function replayJobsList(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const eventId=new URL(req.url).searchParams.get("event_id");
  if(!eventId) return json({error:"EVENT_ID_REQUIRED"},400);
  if(!(await canManageEvent(sb,ctx,eventId))&&!isSuperAdmin(ctx)) return json({error:"FORBIDDEN"},403);

  const {data,error}=await sb.from("live_replay_jobs")
    .select("*,live_media(*)").eq("event_id",eventId)
    .order("created_at",{ascending:false});

  if(error) throw error;
  return json({success:true,jobs:data??[]});
}

async function mediaRetentionSchedule(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const body=await req.json().catch(()=>({})) as any;
  if(!body.media_id||!body.action||!body.scheduled_at) return json({error:"MISSING_PARAMS"},400);

  const {data:media}=await sb.from("live_media").select("*").eq("id",body.media_id).maybeSingle();
  if(!media) return json({error:"MEDIA_NOT_FOUND"},404);
  if(!(await canManageEvent(sb,ctx,media.event_id))&&!isSuperAdmin(ctx)) return json({error:"FORBIDDEN"},403);

  const {data,error}=await sb.from("live_media_retention_jobs").insert({
    media_id:media.id,action:body.action,scheduled_at:body.scheduled_at,status:"scheduled"
  }).select("*").single();

  if(error) throw error;
  return json({success:true,retention_job:data},201);
}

async function mediaRetentionRun(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if(!ctx||!isSuperAdmin(ctx)) return json({error:"FORBIDDEN"},403);
  const now=new Date().toISOString();

  const {data:jobs,error}=await sb.from("live_media_retention_jobs").select("*,live_media(*)")
    .eq("status","scheduled").lte("scheduled_at",now).limit(100);
  if(error) throw error;

  let completed=0,failed=0;
  const bucket=Deno.env.get("R2_BUCKET_NAME")||"";

  for(const job of jobs??[]){
    try{
      await sb.from("live_media_retention_jobs").update({status:"processing"}).eq("id",job.id);

      const media=job.live_media;
      if(job.action==="archive"){
        await sb.from("live_media").update({
          archived_at:now,status:"archived",updated_at:now
        }).eq("id",media.id);
      } else if(job.action==="delete_original"){
        if(bucket&&media.original_storage_key){
          // Object deletion is intentionally delegated to the storage worker/provider.
        }
        await sb.from("live_media").update({
          original_storage_key:null,updated_at:now
        }).eq("id",media.id);
      } else if(job.action==="delete_all"){
        await sb.from("live_media").update({
          status:"deleted",deleted_at:now,storage_key:null,original_storage_key:null,
          streaming_manifest_key:null,audio_track_key:null,updated_at:now
        }).eq("id",media.id);
      }

      await sb.from("live_media_retention_jobs").update({
        status:"completed",completed_at:now
      }).eq("id",job.id);
      completed++;
    }catch(error){
      await sb.from("live_media_retention_jobs").update({
        status:"failed",error_message:error instanceof Error?error.message:"RETENTION_FAILED"
      }).eq("id",job.id);
      failed++;
    }
  }

  return json({success:true,processed:(jobs??[]).length,completed,failed});
}

async function mediaPlaybackAudit(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const body=await req.json().catch(()=>({})) as any;
  if(!body.media_id||!body.action) return json({error:"MISSING_PARAMS"},400);

  const allowedActions=["started","heartbeat","completed"];
  if(!allowedActions.includes(body.action)) return json({error:"INVALID_ACTION"},400);

  const {data:media}=await sb.from("live_media").select("id,event_id").eq("id",body.media_id).maybeSingle();
  if(!media) return json({error:"MEDIA_NOT_FOUND"},404);

  const {error}=await sb.from("live_playback_audit").insert({
    event_id:media.event_id,media_id:media.id,user_id:ctx.userId,
    action:body.action,watermark_payload:body.watermark_payload||null,
    device_fingerprint:body.device_fingerprint||null,metadata:body.metadata||{}
  });

  if(error) throw error;
  return json({success:true});
}

async function mediaAdminVersions(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if(!ctx||!isSuperAdmin(ctx)) return json({error:"FORBIDDEN"},403);
  const mediaId=new URL(req.url).searchParams.get("media_id");
  if(!mediaId) return json({error:"MEDIA_ID_REQUIRED"},400);

  const {data:source}=await sb.from("live_media").select("id,parent_media_id").eq("id",mediaId).maybeSingle();
  if(!source) return json({error:"MEDIA_NOT_FOUND"},404);
  const parent=source.parent_media_id||source.id;

  const {data,error}=await sb.from("live_media").select("*")
    .or(`id.eq.${parent},parent_media_id.eq.${parent}`)
    .order("revision_number",{ascending:false});

  if(error) throw error;
  return json({success:true,versions:data??[]});
}


async function roomControlsGet(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const roomId=new URL(req.url).searchParams.get("room_id");
  if(!roomId) return json({error:"ROOM_ID_REQUIRED"},400);

  const {data:room}=await sb.from("live_rooms").select("*").eq("id",roomId).maybeSingle();
  if(!room) return json({error:"ROOM_NOT_FOUND"},404);

  const {data:controls}=await sb.from("live_room_controls").select("*").eq("room_id",roomId).maybeSingle();

  if(controls) return json({success:true,controls});

  const ev=await eventForAccess(sb,room.event_id);
  const settings=ev?.interaction_settings||{};

  const {data:created,error}=await sb.from("live_room_controls").insert({
    room_id:room.id,event_id:room.event_id,
    chat_enabled:settings.chat!==false,
    qa_enabled:settings.qa!==false,
    polls_enabled:settings.polls!==false,
    participant_mic_mode:settings.participant_microphone||"on_request",
    participant_camera_enabled:Boolean(settings.participant_camera),
    screen_share_enabled:true,
    recording_status:"stopped"
  }).select("*").single();

  if(error) throw error;
  return json({success:true,controls:created});
}

async function roomControlsUpdate(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const body=await req.json().catch(()=>({})) as any;
  if(!body.room_id) return json({error:"ROOM_ID_REQUIRED"},400);

  const {data:room}=await sb.from("live_rooms").select("*").eq("id",body.room_id).maybeSingle();
  if(!room) return json({error:"ROOM_NOT_FOUND"},404);

  const role=await deriveRoomRole(sb,ctx,room.event_id);
  if(!["host","co_host","moderator","admin_supervisor"].includes(role)&&!isSuperAdmin(ctx)) return json({error:"FORBIDDEN"},403);

  const patch:any={updated_by:ctx.userId,updated_at:new Date().toISOString()};
  for(const k of ["chat_enabled","qa_enabled","polls_enabled","participant_camera_enabled","screen_share_enabled"]) if(body[k]!==undefined) patch[k]=Boolean(body[k]);
  if(body.participant_mic_mode!==undefined) patch.participant_mic_mode=body.participant_mic_mode;

  const {data,error}=await sb.from("live_room_controls").upsert({
    room_id:room.id,event_id:room.event_id,...patch
  },{onConflict:"room_id"}).select("*").single();

  if(error) throw error;
  return json({success:true,controls:data});
}

async function chatList(req:Request,sb:ReturnType<typeof createClient>,ctx:Awaited<ReturnType<typeof sessionContext>>){
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const roomId=new URL(req.url).searchParams.get("room_id");
  if(!roomId) return json({error:"ROOM_ID_REQUIRED"},400);
  const {data,error}=await sb.from("live_chat_messages")
    .select("*,users(full_name)")
    .eq("room_id",roomId).eq("status","visible").order("created_at").limit(300);
  if(error) throw error;
  return json({success:true,messages:data??[]});
}

async function chatSend(req:Request,sb:ReturnType<typeof createClient>,ctx:Awaited<ReturnType<typeof sessionContext>>){
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const body=await req.json().catch(()=>({})) as any;
  if(!body.room_id||!String(body.message||"").trim()) return json({error:"MISSING_PARAMS"},400);

  const {data:room}=await sb.from("live_rooms").select("*").eq("id",body.room_id).maybeSingle();
  if(!room) return json({error:"ROOM_NOT_FOUND"},404);

  const {data:member}=await sb.from("live_room_members").select("access_status").eq("room_id",room.id).eq("user_id",ctx.userId).maybeSingle();
  if(!member||member.access_status!=="admitted") return json({error:"ROOM_ACCESS_REQUIRED"},403);

  const {data:controls}=await sb.from("live_room_controls").select("chat_enabled").eq("room_id",room.id).maybeSingle();
  if(controls?.chat_enabled===false) return json({error:"CHAT_DISABLED"},403);

  const {data,error}=await sb.from("live_chat_messages").insert({
    room_id:room.id,event_id:room.event_id,user_id:ctx.userId,
    message:String(body.message).trim().slice(0,4000),message_type:"chat"
  }).select("*,users(full_name)").single();

  if(error) throw error;
  return json({success:true,message:data},201);
}

async function chatModerate(req:Request,sb:ReturnType<typeof createClient>,ctx:Awaited<ReturnType<typeof sessionContext>>){
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const body=await req.json().catch(()=>({})) as any;
  if(!body.message_id||!body.action) return json({error:"MISSING_PARAMS"},400);

  const {data:msg}=await sb.from("live_chat_messages").select("*").eq("id",body.message_id).maybeSingle();
  if(!msg) return json({error:"MESSAGE_NOT_FOUND"},404);

  const role=await deriveRoomRole(sb,ctx,msg.event_id);
  if(!["host","co_host","moderator","admin_supervisor"].includes(role)&&!isSuperAdmin(ctx)) return json({error:"FORBIDDEN"},403);

  const status=body.action==="delete"?"deleted":"hidden";
  const {data,error}=await sb.from("live_chat_messages").update({
    status,moderated_by:ctx.userId
  }).eq("id",msg.id).select("*").single();

  if(error) throw error;
  return json({success:true,message:data});
}

async function questionList(req:Request,sb:ReturnType<typeof createClient>,ctx:Awaited<ReturnType<typeof sessionContext>>){
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const roomId=new URL(req.url).searchParams.get("room_id");
  if(!roomId) return json({error:"ROOM_ID_REQUIRED"},400);
  const {data,error}=await sb.from("live_questions")
    .select("*,users(full_name)").eq("room_id",roomId).neq("status","hidden")
    .order("upvotes",{ascending:false}).order("created_at");
  if(error) throw error;
  return json({success:true,questions:data??[]});
}

async function questionCreate(req:Request,sb:ReturnType<typeof createClient>,ctx:Awaited<ReturnType<typeof sessionContext>>){
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const body=await req.json().catch(()=>({})) as any;
  if(!body.room_id||!String(body.question||"").trim()) return json({error:"MISSING_PARAMS"},400);

  const {data:room}=await sb.from("live_rooms").select("*").eq("id",body.room_id).maybeSingle();
  if(!room) return json({error:"ROOM_NOT_FOUND"},404);

  const {data:controls}=await sb.from("live_room_controls").select("qa_enabled").eq("room_id",room.id).maybeSingle();
  if(controls?.qa_enabled===false) return json({error:"QA_DISABLED"},403);

  const {data,error}=await sb.from("live_questions").insert({
    room_id:room.id,event_id:room.event_id,user_id:ctx.userId,
    question:String(body.question).trim().slice(0,4000)
  }).select("*,users(full_name)").single();

  if(error) throw error;
  return json({success:true,question:data},201);
}

async function questionVote(req:Request,sb:ReturnType<typeof createClient>,ctx:Awaited<ReturnType<typeof sessionContext>>){
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const body=await req.json().catch(()=>({})) as any;
  if(!body.question_id) return json({error:"QUESTION_ID_REQUIRED"},400);

  const {data:existing}=await sb.from("live_question_votes")
    .select("id").eq("question_id",body.question_id).eq("user_id",ctx.userId).maybeSingle();

  if(existing){
    await sb.from("live_question_votes").delete().eq("id",existing.id);
  }else{
    await sb.from("live_question_votes").insert({question_id:body.question_id,user_id:ctx.userId});
  }

  const {count}=await sb.from("live_question_votes").select("id",{count:"exact",head:true}).eq("question_id",body.question_id);
  await sb.from("live_questions").update({upvotes:count??0}).eq("id",body.question_id);

  return json({success:true,voted:!existing,upvotes:count??0});
}

async function questionAnswer(req:Request,sb:ReturnType<typeof createClient>,ctx:Awaited<ReturnType<typeof sessionContext>>){
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const body=await req.json().catch(()=>({})) as any;
  if(!body.question_id) return json({error:"QUESTION_ID_REQUIRED"},400);

  const {data:q}=await sb.from("live_questions").select("*").eq("id",body.question_id).maybeSingle();
  if(!q) return json({error:"QUESTION_NOT_FOUND"},404);

  const role=await deriveRoomRole(sb,ctx,q.event_id);
  if(!["host","co_host","speaker","moderator","admin_supervisor"].includes(role)&&!isSuperAdmin(ctx)) return json({error:"FORBIDDEN"},403);

  const {data,error}=await sb.from("live_questions").update({
    status:body.status||"answered",
    answer_text:body.answer_text||null,
    answered_by:ctx.userId,
    answered_at:new Date().toISOString()
  }).eq("id",q.id).select("*").single();

  if(error) throw error;
  return json({success:true,question:data});
}

async function pollList(req:Request,sb:ReturnType<typeof createClient>,ctx:Awaited<ReturnType<typeof sessionContext>>){
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const roomId=new URL(req.url).searchParams.get("room_id");
  if(!roomId) return json({error:"ROOM_ID_REQUIRED"},400);

  const {data:polls,error}=await sb.from("live_polls").select("*").eq("room_id",roomId).order("created_at");
  if(error) throw error;

  const results:any[]=[];
  for(const poll of polls??[]){
    const {data:votes}=await sb.from("live_poll_votes").select("option_index,user_id").eq("poll_id",poll.id);
    const counts=(poll.options||[]).map(()=>0);
    for(const v of votes??[]) if(counts[v.option_index]!==undefined) counts[v.option_index]++;
    results.push({...poll,vote_counts:counts,total_votes:(votes??[]).length,my_vote:(votes??[]).find((v:any)=>v.user_id===ctx.userId)?.option_index??null});
  }

  return json({success:true,polls:results});
}

async function pollCreate(req:Request,sb:ReturnType<typeof createClient>,ctx:Awaited<ReturnType<typeof sessionContext>>){
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const body=await req.json().catch(()=>({})) as any;
  if(!body.room_id||!body.question||!Array.isArray(body.options)||body.options.length<2) return json({error:"INVALID_POLL"},400);

  const {data:room}=await sb.from("live_rooms").select("*").eq("id",body.room_id).maybeSingle();
  if(!room) return json({error:"ROOM_NOT_FOUND"},404);

  const role=await deriveRoomRole(sb,ctx,room.event_id);
  if(!["host","co_host","speaker","moderator","admin_supervisor"].includes(role)&&!isSuperAdmin(ctx)) return json({error:"FORBIDDEN"},403);

  const {data,error}=await sb.from("live_polls").insert({
    room_id:room.id,event_id:room.event_id,created_by:ctx.userId,
    question:String(body.question).slice(0,1000),
    options:body.options.slice(0,10).map((x:any)=>String(x).slice(0,500)),
    status:"draft"
  }).select("*").single();

  if(error) throw error;
  return json({success:true,poll:data},201);
}

async function pollUpdate(req:Request,sb:ReturnType<typeof createClient>,ctx:Awaited<ReturnType<typeof sessionContext>>){
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const body=await req.json().catch(()=>({})) as any;
  if(!body.poll_id||!body.status) return json({error:"MISSING_PARAMS"},400);

  const {data:poll}=await sb.from("live_polls").select("*").eq("id",body.poll_id).maybeSingle();
  if(!poll) return json({error:"POLL_NOT_FOUND"},404);

  const role=await deriveRoomRole(sb,ctx,poll.event_id);
  if(!["host","co_host","speaker","moderator","admin_supervisor"].includes(role)&&!isSuperAdmin(ctx)) return json({error:"FORBIDDEN"},403);

  const patch:any={status:body.status};
  if(body.status==="open") patch.opened_at=new Date().toISOString();
  if(body.status==="closed") patch.closed_at=new Date().toISOString();

  const {data,error}=await sb.from("live_polls").update(patch).eq("id",poll.id).select("*").single();
  if(error) throw error;
  return json({success:true,poll:data});
}

async function pollVote(req:Request,sb:ReturnType<typeof createClient>,ctx:Awaited<ReturnType<typeof sessionContext>>){
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const body=await req.json().catch(()=>({})) as any;
  if(!body.poll_id||body.option_index===undefined) return json({error:"MISSING_PARAMS"},400);

  const {data:poll}=await sb.from("live_polls").select("*").eq("id",body.poll_id).maybeSingle();
  if(!poll) return json({error:"POLL_NOT_FOUND"},404);
  if(poll.status!=="open") return json({error:"POLL_NOT_OPEN"},409);
  if(Number(body.option_index)<0||Number(body.option_index)>=(poll.options||[]).length) return json({error:"INVALID_OPTION"},400);

  const {data,error}=await sb.from("live_poll_votes").upsert({
    poll_id:poll.id,user_id:ctx.userId,option_index:Number(body.option_index)
  },{onConflict:"poll_id,user_id"}).select("*").single();

  if(error) throw error;
  return json({success:true,vote:data});
}

async function recordingStart(req:Request,sb:ReturnType<typeof createClient>,ctx:Awaited<ReturnType<typeof sessionContext>>){
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const body=await req.json().catch(()=>({})) as any;
  if(!body.room_id) return json({error:"ROOM_ID_REQUIRED"},400);

  const {data:room}=await sb.from("live_rooms").select("*").eq("id",body.room_id).maybeSingle();
  if(!room) return json({error:"ROOM_NOT_FOUND"},404);

  const role=await deriveRoomRole(sb,ctx,room.event_id);
  if(!["host","co_host","admin_supervisor"].includes(role)&&!isSuperAdmin(ctx)) return json({error:"FORBIDDEN"},403);

  const provider=(room.provider||configuredVideoProvider().provider);
  const now=new Date().toISOString();

  const {data:recording,error}=await sb.from("live_recordings").insert({
    room_id:room.id,event_id:room.event_id,session_id:room.session_id,
    provider,status:"recording",started_at:now,
    metadata:{requested_by:ctx.userId}
  }).select("*").single();

  if(error) throw error;

  await sb.from("live_room_controls").upsert({
    room_id:room.id,event_id:room.event_id,recording_status:"recording",
    recording_started_at:now,updated_by:ctx.userId,updated_at:now
  },{onConflict:"room_id"});

  await sb.from("live_room_actions").insert({
    room_id:room.id,event_id:room.event_id,actor_user_id:ctx.userId,action:"recording_started"
  });

  return json({
    success:true,
    recording,
    provider_action_required: true,
    provider,
    note:"Le fournisseur vidéo doit démarrer l'enregistrement et renvoyer son identifiant/provider_recording_id."
  });
}

async function recordingStop(req:Request,sb:ReturnType<typeof createClient>,ctx:Awaited<ReturnType<typeof sessionContext>>){
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const body=await req.json().catch(()=>({})) as any;
  if(!body.room_id) return json({error:"ROOM_ID_REQUIRED"},400);

  const {data:room}=await sb.from("live_rooms").select("*").eq("id",body.room_id).maybeSingle();
  if(!room) return json({error:"ROOM_NOT_FOUND"},404);

  const role=await deriveRoomRole(sb,ctx,room.event_id);
  if(!["host","co_host","admin_supervisor"].includes(role)&&!isSuperAdmin(ctx)) return json({error:"FORBIDDEN"},403);

  const {data:recording}=await sb.from("live_recordings").select("*")
    .eq("room_id",room.id).eq("status","recording")
    .order("created_at",{ascending:false}).limit(1).maybeSingle();

  if(!recording) return json({error:"ACTIVE_RECORDING_NOT_FOUND"},404);

  const now=new Date().toISOString();

  const {data:updated,error}=await sb.from("live_recordings").update({
    status:"processing",stopped_at:now,updated_at:now
  }).eq("id",recording.id).select("*").single();

  if(error) throw error;

  const replayResp=await replayJobCreate(
    new Request(req.url,{method:"POST",headers:req.headers,body:JSON.stringify({
      event_id:room.event_id,room_id:room.id,session_id:room.session_id
    })}),
    sb,ctx
  );

  let replayJobId:null|string=null;
  try{
    const bodyJson=await replayResp.clone().json();
    replayJobId=bodyJson.job?.id||null;
  }catch{}

  if(replayJobId){
    await sb.from("live_recordings").update({replay_job_id:replayJobId}).eq("id",recording.id);
  }

  await sb.from("live_room_controls").upsert({
    room_id:room.id,event_id:room.event_id,recording_status:"stopped",
    recording_stopped_at:now,updated_by:ctx.userId,updated_at:now
  },{onConflict:"room_id"});

  await sb.from("live_room_actions").insert({
    room_id:room.id,event_id:room.event_id,actor_user_id:ctx.userId,action:"recording_stopped"
  });

  return json({
    success:true,
    recording:updated,
    replay_job_id:replayJobId,
    provider_action_required:true,
    note:"Le fournisseur vidéo doit finaliser l'enregistrement puis appeler replay_job_callback."
  });
}

async function recordingProviderCallback(req:Request,sb:ReturnType<typeof createClient>){
  const secret=Deno.env.get("LIVE_RECORDING_SECRET")||Deno.env.get("MEDIA_WORKER_SECRET")||"";
  const provided=req.headers.get("X-Omnia-Recording-Secret")||req.headers.get("x-omnia-recording-secret")||"";
  if(!secret||provided!==secret) return json({error:"INVALID_RECORDING_SECRET"},401);

  const body=await req.json().catch(()=>({})) as any;
  if(!body.recording_id||!body.status) return json({error:"MISSING_PARAMS"},400);

  const {data:recording}=await sb.from("live_recordings").select("*").eq("id",body.recording_id).maybeSingle();
  if(!recording) return json({error:"RECORDING_NOT_FOUND"},404);

  if(body.status==="ready"){
    const now=new Date().toISOString();
    await sb.from("live_recordings").update({
      status:"ready",
      provider_recording_id:body.provider_recording_id||recording.provider_recording_id,
      storage_key:body.storage_key||recording.storage_key,
      duration_seconds:body.duration_seconds||null,
      metadata:{...(recording.metadata||{}),provider_payload:body.provider_payload||{}},
      updated_at:now
    }).eq("id",recording.id);

    if(recording.replay_job_id){
      const replayReq=new Request(req.url,{
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "X-Omnia-Media-Secret":Deno.env.get("MEDIA_WORKER_SECRET")||secret
        },
        body:JSON.stringify({
          job_id:recording.replay_job_id,
          status:"recording_ready",
          storage_key:body.storage_key,
          file_name:body.file_name||"replay.mp4",
          mime_type:body.mime_type||"video/mp4",
          size_bytes:body.size_bytes||null,
          title:body.title||"Replay Omnia Live"
        })
      });
      await replayJobCallback(replayReq,sb);
    }

    return json({success:true});
  }

  if(body.status==="failed"){
    await sb.from("live_recordings").update({
      status:"failed",error_message:body.error_message||"RECORDING_FAILED",
      updated_at:new Date().toISOString()
    }).eq("id",recording.id);
    return json({success:true});
  }

  return json({error:"INVALID_STATUS"},400);
}


function commerceOrderNumber(type: string) {
  const prefix: Record<string,string> = {
    live:"LIVE", replay:"RPL", recorded_video:"VID", structure_pack:"STR", subscription:"SUB"
  };
  return `OGA-${prefix[type]||"OL"}-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0,10).toUpperCase()}`;
}

async function commerceResolveProduct(
  sb: ReturnType<typeof createClient>,
  params: { product_id?: string; event_id?: string; media_id?: string; product_type?: string }
) {
  if(params.product_id){
    const {data}=await sb.from("live_commerce_products").select("*").eq("id",params.product_id).maybeSingle();
    return data;
  }

  if(params.media_id){
    const {data}=await sb.from("live_commerce_products").select("*")
      .eq("media_id",params.media_id)
      .eq("product_type",params.product_type||"recorded_video")
      .eq("status","active").maybeSingle();
    return data;
  }

  if(params.event_id){
    const {data}=await sb.from("live_commerce_products").select("*")
      .eq("event_id",params.event_id)
      .eq("product_type",params.product_type||"live")
      .eq("status","active").maybeSingle();
    return data;
  }

  return null;
}

async function commerceSyncEventProducts(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const body=await req.json().catch(()=>({})) as any;
  if(!body.event_id) return json({error:"EVENT_ID_REQUIRED"},400);
  if(!(await canManageEvent(sb,ctx,body.event_id))&&!isSuperAdmin(ctx)) return json({error:"FORBIDDEN"},403);

  const ev=await eventForAccess(sb,body.event_id);
  if(!ev) return json({error:"EVENT_NOT_FOUND"},404);

  const rows:any[]=[{
    product_type:"live",
    event_id:ev.id,
    title:ev.title,
    description:ev.short_description||null,
    price_amount:Number(ev.price_amount||0),
    currency:ev.currency||"XOF",
    status:ev.status==="published"||ev.status==="live"?"active":"draft",
    settings:{
      visibility:ev.visibility,
      max_participants:ev.max_participants,
      replay_enabled:ev.replay_enabled
    },
    created_by:ctx.userId,
    updated_at:new Date().toISOString()
  }];

  if(ev.replay_enabled && Number(ev.proposed_replay_price_amount||0)>=0){
    rows.push({
      product_type:"replay",
      event_id:ev.id,
      title:`Replay — ${ev.title}`,
      description:ev.short_description||null,
      price_amount:Number(ev.proposed_replay_price_amount||0),
      currency:ev.currency||"XOF",
      status:ev.status==="completed"?"active":"draft",
      access_duration_days:Number(ev.replay_availability_days||0)||null,
      settings:{source_event_id:ev.id},
      created_by:ctx.userId,
      updated_at:new Date().toISOString()
    });
  }

  const saved:any[]=[];
  for(const row of rows){
    const {data,error}=await sb.from("live_commerce_products").upsert(row,{
      onConflict:"event_id,product_type"
    }).select("*").single();
    if(error) throw error;
    saved.push(data);
  }

  return json({success:true,products:saved});
}

async function commerceSyncMediaProduct(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const body=await req.json().catch(()=>({})) as any;
  if(!body.media_id) return json({error:"MEDIA_ID_REQUIRED"},400);

  const {data:media}=await sb.from("live_media").select("*,live_events(title,currency,owner_user_id)")
    .eq("id",body.media_id).maybeSingle();
  if(!media) return json({error:"MEDIA_NOT_FOUND"},404);
  if(!(await canManageEvent(sb,ctx,media.event_id))&&!isSuperAdmin(ctx)) return json({error:"FORBIDDEN"},403);

  const productType=media.media_type==="replay"?"replay":"recorded_video";
  const {data,error}=await sb.from("live_commerce_products").upsert({
    product_type:productType,
    event_id:media.event_id,
    media_id:media.id,
    title:body.title||media.title||media.live_events?.title||"Contenu Omnia Live",
    description:body.description||media.description||null,
    price_amount:Number(body.price_amount||0),
    currency:body.currency||media.live_events?.currency||"XOF",
    status:body.status||"active",
    access_duration_days:body.access_duration_days==null?null:Number(body.access_duration_days),
    settings:body.settings||{},
    created_by:ctx.userId,
    updated_at:new Date().toISOString()
  },{onConflict:"media_id,product_type"}).select("*").single();

  if(error) throw error;
  return json({success:true,product:data});
}

async function commerceProductsList(
  req: Request,
  sb: ReturnType<typeof createClient>,
) {
  const url=new URL(req.url);
  const type=url.searchParams.get("product_type");
  const eventId=url.searchParams.get("event_id");

  if(type && ["subscription","structure_pack"].includes(type)) {
    return json({success:true,products:[],legacy_commerce_disabled:true});
  }

  let q=sb.from("live_commerce_products").select("*").eq("status","active")
    .not("product_type","in",'("subscription","structure_pack")')
    .order("created_at",{ascending:false});
  if(type) q=q.eq("product_type",type);
  if(eventId) q=q.eq("event_id",eventId);

  const {data,error}=await q;
  if(error) throw error;
  return json({success:true,products:data??[]});
}

async function commerceApplyDiscount(
  sb: ReturnType<typeof createClient>,
  codeText: string | null,
  product: any,
) {
  if(!codeText) return {discount:0,code:null};

  const codeValue=String(codeText).trim().toUpperCase();
  const {data:code}=await sb.from("live_discount_codes").select("*")
    .eq("code",codeValue).eq("status","active").maybeSingle();

  if(!code) throw new Error("INVALID_DISCOUNT_CODE");
  const now=new Date();
  if(code.starts_at&&new Date(code.starts_at)>now) throw new Error("DISCOUNT_NOT_STARTED");
  if(code.ends_at&&new Date(code.ends_at)<=now) throw new Error("DISCOUNT_EXPIRED");
  if(code.max_uses!=null&&Number(code.used_count)>=Number(code.max_uses)) throw new Error("DISCOUNT_LIMIT_REACHED");
  if(code.product_type&&code.product_type!==product.product_type) throw new Error("DISCOUNT_NOT_APPLICABLE");
  if(code.event_id&&code.event_id!==product.event_id) throw new Error("DISCOUNT_NOT_APPLICABLE");
  if(code.media_id&&code.media_id!==product.media_id) throw new Error("DISCOUNT_NOT_APPLICABLE");

  const price=Number(product.price_amount||0);
  let discount=code.discount_type==="percent"
    ? price*(Number(code.discount_value||0)/100)
    : Number(code.discount_value||0);

  discount=Math.max(0,Math.min(price,discount));
  return {discount,code};
}

async function commerceCheckout(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);

  const body=await req.json().catch(()=>({})) as any;
  const paymentChannel=String(body.payment_channel||"web");
  const nativePlatform=String(body.platform||"");
  const nativeStore=paymentChannel==="native_store"&&["android","ios"].includes(nativePlatform);
  const paymentProvider=nativeStore?(nativePlatform==="android"?"google_play":"app_store"):"fedapay";
  const product=await commerceResolveProduct(sb,{
    product_id:body.product_id,
    event_id:body.event_id,
    media_id:body.media_id,
    product_type:body.product_type
  });

  if(!product) return json({error:"PRODUCT_NOT_FOUND"},404);
  if(["subscription","structure_pack"].includes(String(product.product_type||""))) {
    return json({
      error:"LEGACY_COMMERCE_DISABLED",
      message:"Cet ancien produit Omnia Live a été retiré en attente du moteur central de monétisation.",
    },410);
  }
  if(product.status!=="active") return json({error:"PRODUCT_NOT_ACTIVE"},409);

  const {discount,code}=await commerceApplyDiscount(sb,body.discount_code||null,product);
  const price=Number(product.price_amount||0);
  const tax=0;
  const fee=0;
  const net=Math.max(0,price-discount+tax+fee);

  const purchaseType=product.product_type;

  const {data:existing}=await sb.from("live_orders").select("*")
    .eq("user_id",ctx.userId)
    .eq("purchase_type",purchaseType)
    .eq("event_id",product.event_id||null)
    .eq("media_id",product.media_id||null)
    .eq("payment_provider",net<=0?"free":paymentProvider)
    .in("payment_status",["pending","paid"])
    .order("created_at",{ascending:false}).limit(1).maybeSingle();

  if(existing?.payment_status==="paid"){
    return json({success:true,order:existing,already_purchased:true,payment_required:false});
  }

  if(existing?.payment_status==="pending"){
    return json({success:true,order:existing,payment_required:Number(existing.net_amount??existing.amount)>0});
  }

  let registrationId:null|string=null;

  if(purchaseType==="live"&&product.event_id){
    const {data:reg,error:regError}=await sb.from("live_registrations").upsert({
      event_id:product.event_id,
      user_id:ctx.userId,
      status:net<=0?"confirmed":"pending_payment",
      access_source:net<=0?"free_registration":"purchase",
      registered_at:new Date().toISOString()
    },{onConflict:"event_id,user_id"}).select("*").single();
    if(regError) throw regError;
    registrationId=reg.id;
  }

  const {data:order,error}=await sb.from("live_orders").insert({
    order_number:commerceOrderNumber(purchaseType),
    user_id:ctx.userId,
    event_id:product.event_id,
    registration_id:registrationId,
    purchase_type:purchaseType,
    media_id:product.media_id||null,
    structure_pack_id:product.structure_pack_id||null,
    amount:price,
    currency:product.currency,
    discount_amount:discount,
    fee_amount:fee,
    tax_amount:tax,
    net_amount:net,
    payment_status:net<=0?"paid":"pending",
    payment_provider:net<=0?"free":paymentProvider,
    paid_at:net<=0?new Date().toISOString():null,
    access_granted_at:net<=0?new Date().toISOString():null,
    pricing_snapshot:{
      product_id:product.id,
      product_type:purchaseType,
      base_price:price,
      discount,
      fee,
      tax,
      final_amount:net,
      discount_code:code?.code||null
    }
  }).select("*").single();

  if(error) throw error;

  if(code){
    await sb.from("live_discount_codes").update({used_count:Number(code.used_count||0)+1}).eq("id",code.id);
    await sb.from("live_order_adjustments").insert({
      order_id:order.id,adjustment_type:"discount",amount:-discount,currency:product.currency,
      reason:`Code ${code.code}`,metadata:{discount_code_id:code.id},created_by:ctx.userId
    });
  }

  if(net<=0){
    await grantCommerceEntitlement(sb,order,product,ctx.userId,"free");
  }

  return json({
    success:true,
    order,
    product,
    payment_required:net>0,
    final_amount:net,
    native_store:nativeStore&&net>0,
    platform:nativeStore?nativePlatform:null,
  },201);
}

async function grantCommerceEntitlement(
  sb: ReturnType<typeof createClient>,
  order: any,
  product: any,
  userId: string,
  source = "purchase",
) {
  const now=new Date();
  const days=Number(product.access_duration_days||0);
  const expires=days>0?new Date(now.getTime()+days*86400000).toISOString():null;

  let entitlementType="live_access";
  if(product.product_type==="replay") entitlementType="replay_access";
  else if(product.product_type==="recorded_video") entitlementType="video_access";
  else if(product.product_type==="structure_pack") entitlementType="structure_pack";
  else if(product.product_type==="subscription") entitlementType="subscription";

  const {data,error}=await sb.from("live_entitlements").upsert({
    user_id:userId,
    product_id:product.id,
    order_id:order.id,
    entitlement_type:entitlementType,
    event_id:product.event_id||null,
    media_id:product.media_id||null,
    structure_pack_id:product.structure_pack_id||null,
    source,
    starts_at:now.toISOString(),
    expires_at:expires,
    metadata:{purchase_type:product.product_type}
  },{onConflict:"order_id,entitlement_type"}).select("*").single();

  if(error) throw error;

  if(product.product_type==="replay"&&product.media_id){
    await sb.from("live_replay_entitlements").upsert({
      event_id:product.event_id,
      media_id:product.media_id,
      user_id:userId,
      source:source==="purchase"?"replay_purchase":"admin",
      starts_at:now.toISOString(),
      expires_at:expires
    },{onConflict:"event_id,media_id,user_id,source"});
  }

  if(product.product_type==="live"&&order.registration_id){
    await sb.from("live_registrations").update({status:"confirmed"}).eq("id",order.registration_id);
  }

  return data;
}

async function commerceFinalizePaidOrder(
  sb: ReturnType<typeof createClient>,
  order: any,
) {
  const product=await commerceResolveProduct(sb,{
    event_id:order.event_id,
    media_id:order.media_id,
    product_type:order.purchase_type
  });

  if(product){
    const {data:existingEnt}=await sb.from("live_entitlements").select("id")
      .eq("order_id",order.id).maybeSingle();
    if(!existingEnt) await grantCommerceEntitlement(sb,order,product,order.user_id,"purchase");
  }

  if(order.purchase_type==="live"&&order.registration_id){
    await sb.from("live_registrations").update({status:"confirmed"}).eq("id",order.registration_id);
  }
}


async function storePaymentFinalize(
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
  body: Record<string, unknown>,
) {
  if(!ctx||!isService(ctx)) return json({error:"SERVICE_ONLY"},403);
  const orderId=String(body.order_id||"");
  const {data:order,error}=await sb.from("live_orders").select("*").eq("id",orderId).maybeSingle();
  if(error) throw error;
  if(!order) return json({error:"LIVE_ORDER_NOT_FOUND"},404);
  if(order.payment_status==="paid") return json({success:true,order,already_completed:true});
  if(!["google_play","app_store"].includes(String(order.payment_provider||""))) return json({error:"STORE_ORDER_PROVIDER_MISMATCH"},409);
  const providerTransactionId=String(body.provider_transaction_id||"");
  if(!providerTransactionId) return json({error:"STORE_TRANSACTION_REQUIRED"},400);
  const {data:paidOrder,error:updateError}=await sb.from("live_orders").update({
    payment_status:"paid",
    provider_reference:body.provider_reference||providerTransactionId,
    payment_metadata:{...(order.payment_metadata||{}),store:body.provider_metadata||{}},
    paid_at:new Date().toISOString(),
    access_granted_at:new Date().toISOString(),
    failed_at:null,
  }).eq("id",order.id).select("*").single();
  if(updateError) throw updateError;
  await commerceFinalizePaidOrder(sb,paidOrder);
  return json({success:true,order:paidOrder});
}

async function commerceEntitlementsMine(
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);

  const {data,error}=await sb.from("live_entitlements")
    .select("*,live_commerce_products(*),live_events(title,cover_url,status,starts_at),live_media(title,media_type,status,processing_status)")
    .eq("user_id",ctx.userId)
    .is("revoked_at",null)
    .order("created_at",{ascending:false});

  if(error) throw error;

  const active=(data??[]).filter((x:any)=>!x.expires_at||new Date(x.expires_at)>new Date());
  return json({success:true,entitlements:active});
}

async function discountAdminCreate(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if(!ctx||!isSuperAdmin(ctx)) return json({error:"FORBIDDEN"},403);
  const body=await req.json().catch(()=>({})) as any;
  if(!body.code||!body.discount_type||body.discount_value===undefined) return json({error:"MISSING_PARAMS"},400);

  const {data,error}=await sb.from("live_discount_codes").insert({
    code:String(body.code).trim().toUpperCase(),
    discount_type:body.discount_type,
    discount_value:Number(body.discount_value),
    currency:body.currency||null,
    product_type:body.product_type||null,
    event_id:body.event_id||null,
    media_id:body.media_id||null,
    max_uses:body.max_uses==null?null:Number(body.max_uses),
    starts_at:body.starts_at||null,
    ends_at:body.ends_at||null,
    status:body.status||"active",
    created_by:ctx.userId
  }).select("*").single();

  if(error) throw error;
  return json({success:true,discount:data},201);
}

async function discountAdminList(
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if(!ctx||!isSuperAdmin(ctx)) return json({error:"FORBIDDEN"},403);
  const {data,error}=await sb.from("live_discount_codes").select("*").order("created_at",{ascending:false});
  if(error) throw error;
  return json({success:true,discounts:data??[]});
}

async function payoutRequestCreate(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx) return json({ error: "AUTH_REQUIRED" }, 401);
  if (!canOrganize(ctx)) return json({ error: "ORGANIZER_PERMISSION_REQUIRED" }, 403);

  const body = await req.json().catch(() => ({})) as any;
  const requestedAmount = Number(body.requested_amount || 0);
  if (!body.currency || !Number.isFinite(requestedAmount) || requestedAmount <= 0) {
    return json({ error: "MISSING_PARAMS" }, 400);
  }

  const { data, error } = await sb.rpc("omnia_live_create_payout_request", {
    p_organizer_user_id: ctx.userId,
    p_currency: String(body.currency),
    p_requested_amount: requestedAmount,
    p_payout_method: body.payout_method || null,
    p_payout_details: body.payout_details || {},
    p_request_note: body.request_note || null,
  });

  if (error) throw error;
  return json({ success: true, ...(data || {}) }, 201);
}

async function payoutRequestsMine(
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const {data,error}=await sb.from("live_payout_requests")
    .select("*").eq("organizer_user_id",ctx.userId).order("created_at",{ascending:false});
  if(error) throw error;
  return json({success:true,requests:data??[]});
}

async function payoutAdminRequests(
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if(!ctx||!isSuperAdmin(ctx)) return json({error:"FORBIDDEN"},403);
  // Ne pas embarquer users directement : plusieurs clés étrangères peuvent rendre
  // la relation ambiguë (PGRST201). On hydrate explicitement les organisateurs.
  const {data,error}=await sb.from("live_payout_requests")
    .select("*").order("created_at",{ascending:false});
  if(error) throw error;
  const requests=data??[];
  const userMap=await hydrateUserMap(sb,requests.map((x:any)=>x.organizer_user_id));
  return json({success:true,requests:requests.map((x:any)=>({
    ...x,
    users:userMap.get(x.organizer_user_id)||null,
    organizer_name:userMap.get(x.organizer_user_id)?.full_name||null,
    organizer_email:userMap.get(x.organizer_user_id)?.email||null,
  }))});
}

async function payoutAdminDecision(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx || !isSuperAdmin(ctx)) return json({ error: "FORBIDDEN" }, 403);

  const body = await req.json().catch(() => ({})) as any;
  if (!body.request_id || !body.status) return json({ error: "MISSING_PARAMS" }, 400);
  if (!["under_review", "approved", "rejected", "paid", "cancelled"].includes(body.status)) {
    return json({ error: "INVALID_STATUS" }, 400);
  }

  if (body.status === "paid" && !String(body.provider_reference || "").trim()) {
    return json({ error: "PROVIDER_REFERENCE_REQUIRED" }, 400);
  }

  const { data, error } = await sb.rpc("omnia_live_process_payout", {
    p_request_id: body.request_id,
    p_status: body.status,
    p_admin_id: ctx.userId,
    p_decision_note: body.decision_note || null,
    p_provider_reference: body.provider_reference || null,
  });

  if (error) throw error;
  return json({ success: true, ...(data || {}) });
}

async function subscriptionPlansAdmin(
  _sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if(!ctx||!isSuperAdmin(ctx)) return json({error:"FORBIDDEN"},403);
  return json({success:true,plans:[],legacy_commerce_disabled:true});
}

async function subscriptionPlanSave(
  _req: Request,
  _sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if(!ctx||!isSuperAdmin(ctx)) return json({error:"FORBIDDEN"},403);
  return json({
    error:"LEGACY_COMMERCE_DISABLED",
    message:"Les anciens abonnements Omnia Live ont été retirés. Utilisez le futur moteur central de monétisation.",
  },410);
}

function liveDocumentNumberG(type:string){
  const p = ({attendance_certificate:"ATT",completion_certificate:"CMP",cpd_certificate:"CPD",participation_attestation:"PAR"} as any)[type]||"DOC";
  return `OGA-LIVE-${p}-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0,10).toUpperCase()}`;
}

async function documentEligibility(sb:any,eventId:string,userId:string,documentType?:string){
  const {data:event}=await sb.from("live_events").select("*").eq("id",eventId).maybeSingle();
  if(!event) throw new Error("EVENT_NOT_FOUND");
  const {data:rule}=await sb.from("live_event_document_rules").select("*").eq("event_id",eventId).maybeSingle();
  const effective=rule||{
    documents_enabled:true,free_event_document_policy:"attendance_based",
    default_document_type:"attendance_certificate",minimum_attendance_percent:80,
    require_all_mandatory_sessions:false,require_completion:false,require_assessment:false,
    cpd_enabled:false,super_admin_validation_required:true
  };
  if(!effective.documents_enabled) return {eligible:false,reason:"DOCUMENTS_DISABLED",event,rule:effective};

  const {data:sessions}=await sb.from("live_sessions").select("id,is_mandatory").eq("event_id",eventId);
  const total=(sessions||[]).length;
  const mandatory=(sessions||[]).filter((s:any)=>s.is_mandatory).map((s:any)=>s.id);

  const {data:attendance}=await sb.from("live_attendance").select("*").eq("event_id",eventId).eq("user_id",userId);
  const attendedRows=(attendance||[]).filter((a:any)=>Number(a.attended_seconds||0)>0 || a.status==="present" || a.status==="completed");
  const unique=new Set(attendedRows.map((a:any)=>a.session_id).filter(Boolean));
  const attended=unique.size;
  const attendancePercent=total>0?(attended/total)*100:0;
  const mandatoryOk=!effective.require_all_mandatory_sessions || mandatory.every((id:string)=>unique.has(id));

  const isFree=Number(event.price_amount||0)<=0;
  if(isFree && effective.free_event_document_policy==="none")
    return {eligible:false,reason:"FREE_EVENT_DOCUMENT_DISABLED",event,rule:effective,attendance_percent:attendancePercent,sessions_attended:attended,sessions_total:total};

  const eligible=attendancePercent>=Number(effective.minimum_attendance_percent||0) && mandatoryOk;
  return {
    eligible,
    reason:eligible?null:"ATTENDANCE_REQUIREMENT_NOT_MET",
    event,rule:effective,
    attendance_percent:Number(attendancePercent.toFixed(2)),
    sessions_attended:attended,sessions_total:total,
    mandatory_ok:mandatoryOk,
    document_type:documentType||effective.default_document_type
  };
}

async function documentRulesGet(req:Request,sb:any,ctx:any){
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const eventId=new URL(req.url).searchParams.get("event_id");
  if(!eventId) return json({error:"EVENT_ID_REQUIRED"},400);
  const {data}=await sb.from("live_event_document_rules").select("*,live_document_templates(*)").eq("event_id",eventId).maybeSingle();
  return json({success:true,rules:data});
}

async function documentRulesSave(req:Request,sb:any,ctx:any){
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const b=await req.json().catch(()=>({}));
  if(!b.event_id) return json({error:"EVENT_ID_REQUIRED"},400);
  if(!(await canManageEvent(sb,ctx,b.event_id))&&!isSuperAdmin(ctx)) return json({error:"FORBIDDEN"},403);
  const row:any={event_id:b.event_id,updated_by:ctx.userId,updated_at:new Date().toISOString()};
  for(const k of ["documents_enabled","free_event_document_policy","default_document_type","minimum_attendance_percent","minimum_sessions_attended","require_all_mandatory_sessions","require_completion","require_assessment","minimum_assessment_score","cpd_enabled","cpd_hours","cpd_points","cpd_reference","template_id","auto_issue","organizer_can_request","super_admin_validation_required","settings"])
    if(b[k]!==undefined) row[k]=b[k];
  const {data,error}=await sb.from("live_event_document_rules").upsert(row,{onConflict:"event_id"}).select("*").single();
  if(error) throw error;
  return json({success:true,rules:data});
}

async function documentRequestCreate(req:Request,sb:any,ctx:any){
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const b=await req.json().catch(()=>({}));
  if(!b.event_id) return json({error:"EVENT_ID_REQUIRED"},400);
  const userId=b.user_id||ctx.userId;
  if(userId!==ctx.userId && !(await canManageEvent(sb,ctx,b.event_id)) && !isSuperAdmin(ctx)) return json({error:"FORBIDDEN"},403);
  const check=await documentEligibility(sb,b.event_id,userId,b.document_type);
  const type=b.document_type||check.document_type||"attendance_certificate";
  const status=check.eligible?"eligible":"ineligible";
  const {data,error}=await sb.from("live_document_issuance_requests").upsert({
    event_id:b.event_id,user_id:userId,requested_by:ctx.userId,document_type:type,
    eligibility_snapshot:check,status,updated_at:new Date().toISOString()
  },{onConflict:"event_id,user_id,document_type"}).select("*").single();
  if(error) throw error;
  return json({success:true,request:data,eligibility:check});
}

async function documentAdminRequests(req:Request,sb:any,ctx:any){
  if(!ctx||!isSuperAdmin(ctx)) return json({error:"FORBIDDEN"},403);
  const status=new URL(req.url).searchParams.get("status");
  // Chargement séparé des utilisateurs et événements afin d’éviter les embeds
  // ambigus lorsque la table comporte plusieurs relations vers users.
  let q=sb.from("live_document_issuance_requests").select("*").order("created_at",{ascending:false});
  if(status) q=q.eq("status",status);
  const {data,error}=await q;if(error) throw error;
  const requests=data||[];
  const userMap=await hydrateUserMap(sb,requests.map((x:any)=>x.user_id));
  const eventMap=await hydrateEventMap(sb,requests.map((x:any)=>x.event_id));
  return json({success:true,requests:requests.map((x:any)=>({
    ...x,
    users:userMap.get(x.user_id)||null,
    live_events:eventMap.get(x.event_id)||null,
    participant_name:userMap.get(x.user_id)?.full_name||null,
    participant_email:userMap.get(x.user_id)?.email||null,
    event_title:eventMap.get(x.event_id)?.title||null,
  }))});
}

async function documentIssueG(req:Request,sb:any,ctx:any){
  if(!ctx||!isSuperAdmin(ctx)) return json({error:"FORBIDDEN"},403);
  const b=await req.json().catch(()=>({}));
  if(!b.request_id) return json({error:"REQUEST_ID_REQUIRED"},400);
  const {data:r}=await sb.from("live_document_issuance_requests").select("*").eq("id",b.request_id).maybeSingle();
  if(!r) return json({error:"REQUEST_NOT_FOUND"},404);
  if(!["eligible","approved"].includes(r.status)) return json({error:"REQUEST_NOT_ELIGIBLE"},409);

  const check=await documentEligibility(sb,r.event_id,r.user_id,r.document_type);
  if(!check.eligible) return json({error:"ELIGIBILITY_FAILED",eligibility:check},409);
  const {data:user}=await sb.from("users").select("full_name,email").eq("id",r.user_id).maybeSingle();
  const {data:rule}=await sb.from("live_event_document_rules").select("*").eq("event_id",r.event_id).maybeSingle();
  const {data:template}=rule?.template_id
    ? await sb.from("live_document_templates").select("*").eq("id",rule.template_id).maybeSingle()
    : await sb.from("live_document_templates").select("*").eq("document_type",r.document_type).eq("status","active").limit(1).maybeSingle();

  const verification=crypto.randomUUID().replaceAll("-","").slice(0,20).toUpperCase();
  const number=liveDocumentNumberG(r.document_type);
  const immutable={
    participant_name:user?.full_name||user?.email||"Participant",
    event_title:check.event.title,
    organizer_user_id:check.event.owner_user_id,
    attendance_percent:check.attendance_percent,
    sessions_attended:check.sessions_attended,
    sessions_total:check.sessions_total,
    cpd_hours:rule?.cpd_hours||null,cpd_points:rule?.cpd_points||null,cpd_reference:rule?.cpd_reference||null,
    issued_at:new Date().toISOString()
  };
  const {data:doc,error}=await sb.from("live_issued_documents").insert({
    request_id:r.id,event_id:r.event_id,user_id:r.user_id,template_id:template?.id||null,
    document_type:r.document_type,document_number:number,verification_code:verification,
    verification_url:`/verify/live-document/${verification}`,
    participant_name:immutable.participant_name,event_title:immutable.event_title,
    attendance_percent:check.attendance_percent,sessions_attended:check.sessions_attended,sessions_total:check.sessions_total,
    cpd_hours:rule?.cpd_hours||null,cpd_points:rule?.cpd_points||null,cpd_reference:rule?.cpd_reference||null,
    immutable_payload:immutable,status:"issued",issued_by:ctx.userId
  }).select("*").single();
  if(error) throw error;
  await sb.from("live_document_issuance_requests").update({status:"issued",reviewed_by:ctx.userId,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",r.id);
  await sb.from("live_document_audit_log").insert({document_id:doc.id,request_id:r.id,actor_user_id:ctx.userId,action:"issued",metadata:{document_number:number}});
  return json({success:true,document:doc,template,pdf_generation_required:true});
}

async function documentAdminDecision(req:Request,sb:any,ctx:any){
  if(!ctx||!isSuperAdmin(ctx)) return json({error:"FORBIDDEN"},403);
  const b=await req.json().catch(()=>({}));
  if(!b.request_id||!["approved","rejected","cancelled"].includes(b.status)) return json({error:"INVALID_PARAMS"},400);
  const {data,error}=await sb.from("live_document_issuance_requests").update({
    status:b.status,decision_note:b.decision_note||null,reviewed_by:ctx.userId,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()
  }).eq("id",b.request_id).select("*").single();
  if(error) throw error;
  return json({success:true,request:data});
}

async function documentsMineG(sb:any,ctx:any){
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const {data,error}=await sb.from("live_issued_documents").select("*").eq("user_id",ctx.userId).order("created_at",{ascending:false});
  if(error) throw error;return json({success:true,documents:data||[]});
}

async function documentVerifyG(req:Request,sb:any){
  const code=new URL(req.url).searchParams.get("code");
  if(!code) return json({error:"CODE_REQUIRED"},400);
  const {data}=await sb.from("live_issued_documents").select("document_number,verification_code,participant_name,event_title,organizer_name,issue_date,document_type,attendance_percent,cpd_hours,cpd_points,cpd_reference,status,revoked_at,revocation_reason").eq("verification_code",code.toUpperCase()).maybeSingle();
  if(!data) return json({valid:false,error:"DOCUMENT_NOT_FOUND"},404);
  return json({valid:data.status==="issued",document:data});
}

async function documentRevoke(req:Request,sb:any,ctx:any){
  if(!ctx||!isSuperAdmin(ctx)) return json({error:"FORBIDDEN"},403);
  const b=await req.json().catch(()=>({}));
  if(!b.document_id||!b.reason) return json({error:"MISSING_PARAMS"},400);
  const {data,error}=await sb.from("live_issued_documents").update({
    status:"revoked",revoked_at:new Date().toISOString(),revoked_by:ctx.userId,revocation_reason:b.reason
  }).eq("id",b.document_id).select("*").single();
  if(error) throw error;
  await sb.from("live_document_audit_log").insert({document_id:b.document_id,actor_user_id:ctx.userId,action:"revoked",metadata:{reason:b.reason}});
  return json({success:true,document:data});
}

async function documentTemplatesList(sb:any,ctx:any){
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const {data,error}=await sb.from("live_document_templates").select("*").neq("status","archived").order("created_at");
  if(error) throw error;return json({success:true,templates:data||[]});
}

async function documentTemplateSave(req:Request,sb:any,ctx:any){
  if(!ctx||!isSuperAdmin(ctx)) return json({error:"FORBIDDEN"},403);
  const b=await req.json().catch(()=>({}));
  if(!b.template_key||!b.name||!b.document_type) return json({error:"MISSING_PARAMS"},400);
  const {data,error}=await sb.from("live_document_templates").upsert({
    template_key:b.template_key,name:b.name,document_type:b.document_type,status:b.status||"draft",
    design_config:b.design_config||{},eligibility_rules:b.eligibility_rules||{},logo_mode:b.logo_mode||"platform",
    created_by:ctx.userId,updated_by:ctx.userId,updated_at:new Date().toISOString()
  },{onConflict:"template_key"}).select("*").single();
  if(error) throw error;return json({success:true,template:data});
}


// ============================================================
// MODULE H — NOTIFICATIONS / COMMUNICATION / AUTOMATIONS
// ============================================================
async function notificationPreferencesGet(sb:any,ctx:any){
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const {data,error}=await sb.from("live_notification_preferences").select("*").eq("user_id",ctx.userId).maybeSingle();
  if(error) throw error;
  return json({success:true,preferences:data||{user_id:ctx.userId,in_app_enabled:true,email_enabled:true,sms_enabled:false,push_enabled:true,reminders_enabled:true,reminder_24h:true,reminder_1h:true,reminder_15m:false,payment_notifications:true,replay_notifications:true,document_notifications:true,marketing_notifications:false}});
}

async function notificationPreferencesSave(req:Request,sb:any,ctx:any){
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const b=await req.json().catch(()=>({}));
  const allowed=["in_app_enabled","email_enabled","sms_enabled","push_enabled","reminders_enabled","reminder_24h","reminder_1h","reminder_15m","payment_notifications","replay_notifications","document_notifications","marketing_notifications","quiet_hours_enabled","quiet_hours_start","quiet_hours_end","timezone"];
  const row:any={user_id:ctx.userId,updated_at:new Date().toISOString()};
  for(const k of allowed) if(b[k]!==undefined) row[k]=b[k];
  const {data,error}=await sb.from("live_notification_preferences").upsert(row,{onConflict:"user_id"}).select("*").single();
  if(error) throw error; return json({success:true,preferences:data});
}

async function notificationsInbox(req:Request,sb:any,ctx:any){
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const unread=new URL(req.url).searchParams.get("unread")==="true";
  let q=sb.from("live_notification_inbox").select("*").eq("user_id",ctx.userId).is("dismissed_at",null).order("created_at",{ascending:false}).limit(200);
  if(unread) q=q.is("read_at",null);
  const {data,error}=await q;if(error) throw error;return json({success:true,notifications:data||[]});
}

async function notificationInboxUpdate(req:Request,sb:any,ctx:any){
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const b=await req.json().catch(()=>({})); if(!b.notification_id||!b.action) return json({error:"MISSING_PARAMS"},400);
  const patch:any={}; if(b.action==="read") patch.read_at=new Date().toISOString(); else if(b.action==="dismiss") patch.dismissed_at=new Date().toISOString(); else return json({error:"INVALID_ACTION"},400);
  const {data,error}=await sb.from("live_notification_inbox").update(patch).eq("id",b.notification_id).eq("user_id",ctx.userId).select("*").single();
  if(error) throw error;return json({success:true,notification:data});
}

async function notificationTemplatesList(sb:any,ctx:any){
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);
  const {data,error}=await sb.from("live_notification_templates").select("*").neq("status","archived").order("category");if(error) throw error;
  return json({success:true,templates:data||[]});
}

async function notificationTemplateSave(req:Request,sb:any,ctx:any){
  if(!ctx||!isSuperAdmin(ctx)) return json({error:"FORBIDDEN"},403);
  const b=await req.json().catch(()=>({}));if(!b.template_key||!b.name||!b.category||!b.channel||!b.body_template)return json({error:"MISSING_PARAMS"},400);
  const {data,error}=await sb.from("live_notification_templates").upsert({...b,updated_by:ctx.userId,updated_at:new Date().toISOString()},{onConflict:"template_key"}).select("*").single();if(error)throw error;
  return json({success:true,template:data});
}

async function communicationCampaignCreate(req:Request,sb:any,ctx:any){
  if(!ctx) return json({error:"AUTH_REQUIRED"},401);const b=await req.json().catch(()=>({}));if(!b.event_id||!b.name||!b.message)return json({error:"MISSING_PARAMS"},400);
  if(!(await canManageEvent(sb,ctx,b.event_id))&&!isSuperAdmin(ctx)) return json({error:"FORBIDDEN"},403);
  const {data,error}=await sb.from("live_communication_campaigns").insert({event_id:b.event_id,organizer_user_id:ctx.userId,name:b.name,audience_type:b.audience_type||"all_registered",audience_filter:b.audience_filter||{},channel:b.channel||"multi",subject:b.subject||null,message:b.message,status:"draft",created_by:ctx.userId}).select("*").single();if(error)throw error;
  return json({success:true,campaign:data},201);
}

async function communicationCampaignsList(req:Request,sb:any,ctx:any){
  if(!ctx)return json({error:"AUTH_REQUIRED"},401);const eventId=new URL(req.url).searchParams.get("event_id");if(!eventId)return json({error:"EVENT_ID_REQUIRED"},400);
  if(!(await canManageEvent(sb,ctx,eventId))&&!isSuperAdmin(ctx))return json({error:"FORBIDDEN"},403);
  const {data,error}=await sb.from("live_communication_campaigns").select("*").eq("event_id",eventId).order("created_at",{ascending:false});if(error)throw error;return json({success:true,campaigns:data||[]});
}

async function communicationCampaignSchedule(req:Request,sb:any,ctx:any){
  if(!ctx)return json({error:"AUTH_REQUIRED"},401);const b=await req.json().catch(()=>({}));if(!b.campaign_id)return json({error:"CAMPAIGN_ID_REQUIRED"},400);
  const {data:c}=await sb.from("live_communication_campaigns").select("*").eq("id",b.campaign_id).maybeSingle();if(!c)return json({error:"CAMPAIGN_NOT_FOUND"},404);
  if(!(await canManageEvent(sb,ctx,c.event_id))&&!isSuperAdmin(ctx))return json({error:"FORBIDDEN"},403);
  const {data,error}=await sb.from("live_communication_campaigns").update({status:"scheduled",scheduled_at:b.scheduled_at||new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",c.id).select("*").single();if(error)throw error;return json({success:true,campaign:data});
}

async function adminCommunicationCampaigns(sb:any,ctx:any){if(!ctx||!isSuperAdmin(ctx))return json({error:"FORBIDDEN"},403);const {data,error}=await sb.from("live_communication_campaigns").select("*,live_events(title)").order("created_at",{ascending:false}).limit(500);if(error)throw error;return json({success:true,campaigns:data||[]});}

async function adminCommunicationCampaignDecision(req:Request,sb:any,ctx:any){
  if(!ctx||!isSuperAdmin(ctx))return json({error:"FORBIDDEN"},403);const b=await req.json().catch(()=>({}));if(!b.campaign_id||!b.status)return json({error:"MISSING_PARAMS"},400);
  const patch:any={updated_at:new Date().toISOString()};if(b.status==="approved"){patch.approved_by=ctx.userId;patch.approved_at=new Date().toISOString();patch.status="scheduled";}else if(b.status==="cancelled")patch.status="cancelled";else return json({error:"INVALID_STATUS"},400);
  const {data,error}=await sb.from("live_communication_campaigns").update(patch).eq("id",b.campaign_id).select("*").single();if(error)throw error;return json({success:true,campaign:data});
}

async function automationRulesList(req:Request,sb:any,ctx:any){if(!ctx)return json({error:"AUTH_REQUIRED"},401);const eventId=new URL(req.url).searchParams.get("event_id");let q=sb.from("live_automation_rules").select("*").order("created_at");if(eventId)q=q.eq("event_id",eventId);const {data,error}=await q;if(error)throw error;return json({success:true,rules:data||[]});}
async function adminAutomationRules(sb:any,ctx:any){if(!ctx||!isSuperAdmin(ctx))return json({error:"FORBIDDEN"},403);const {data,error}=await sb.from("live_automation_rules").select("*,live_events(title)").order("created_at");if(error)throw error;return json({success:true,rules:data||[]});}
async function automationRuleSave(req:Request,sb:any,ctx:any){
  if(!ctx)return json({error:"AUTH_REQUIRED"},401);const b=await req.json().catch(()=>({}));if(!b.rule_key||!b.trigger_type)return json({error:"MISSING_PARAMS"},400);
  if(b.event_id&&!(await canManageEvent(sb,ctx,b.event_id))&&!isSuperAdmin(ctx))return json({error:"FORBIDDEN"},403);
  if(!b.event_id&&!isSuperAdmin(ctx))return json({error:"FORBIDDEN"},403);
  const row={event_id:b.event_id||null,rule_key:b.rule_key,trigger_type:b.trigger_type,trigger_offset_minutes:b.trigger_offset_minutes??null,channel:b.channel||"multi",template_key:b.template_key||null,enabled:b.enabled!==false,settings:b.settings||{},updated_by:ctx.userId,updated_at:new Date().toISOString()};
  const {data,error}=await sb.from("live_automation_rules").upsert(row,{onConflict:"event_id,rule_key"}).select("*").single();if(error)throw error;return json({success:true,rule:data});
}
async function notificationJobsList(sb:any,ctx:any){if(!ctx||!isSuperAdmin(ctx))return json({error:"FORBIDDEN"},403);const {data,error}=await sb.from("live_notification_jobs").select("*").order("scheduled_at",{ascending:false}).limit(500);if(error)throw error;return json({success:true,jobs:data||[]});}

function renderLiveTemplate(input:string,vars:any){return String(input||"").replace(/\{\{\s*([\w.]+)\s*\}\}/g,(_:string,k:string)=>String(vars?.[k]??""));}

async function queueInboxNotification(sb:any,userId:string,eventId:string|null,type:string,title:string,message:string,actionUrl:string|null,payload:any={}){
  return await sb.from("live_notification_inbox").insert({user_id:userId,event_id:eventId,notification_type:type,title,message,action_url:actionUrl,payload}).select("id").single();
}

async function notificationDispatchDue(req:Request,sb:any,ctx:any){
  if(!ctx||!isSuperAdmin(ctx))return json({error:"FORBIDDEN"},403);const b=await req.json().catch(()=>({}));const limit=Math.min(500,Math.max(1,Number(b.limit||100)));
  const {data:jobs,error}=await sb.from("live_notification_jobs").select("*").eq("status","queued").lte("scheduled_at",new Date().toISOString()).order("scheduled_at").limit(limit);if(error)throw error;
  let sent=0,failed=0;
  for(const j of jobs||[]){try{
    await sb.from("live_notification_jobs").update({status:"processing",attempts:Number(j.attempts||0)+1,updated_at:new Date().toISOString()}).eq("id",j.id);
    const {data:user}=await sb.from("users").select("email,full_name").eq("id",j.user_id).maybeSingle();
    const payload=j.payload||{};const title=payload.subject||payload.title||"Omnia Live";const message=payload.message||payload.body||j.notification_type;
    if(j.channel==="in_app"||j.channel==="multi") await queueInboxNotification(sb,j.user_id,j.event_id,j.notification_type,title,message,payload.action_url||null,payload);
    if((j.channel==="email"||j.channel==="multi")&&user?.email){
      const key=Deno.env.get("BREVO_API_KEY")||"";if(!key)throw new Error("BREVO_API_KEY_NOT_CONFIGURED");
      const resp=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"api-key":key,"Content-Type":"application/json"},body:JSON.stringify({sender:{name:"Omnia Global Academy",email:Deno.env.get("BREVO_SENDER_EMAIL")||"support@omniaglobalacademy.com"},to:[{email:user.email,name:user.full_name||undefined}],subject:title,htmlContent:`<p>${message}</p>`})});
      if(!resp.ok)throw new Error(`BREVO_${resp.status}`);
    }
    await sb.from("live_notification_jobs").update({status:"sent",sent_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",j.id);sent++;
  }catch(e){await sb.from("live_notification_jobs").update({status:"failed",last_error:e instanceof Error?e.message:"SEND_FAILED",updated_at:new Date().toISOString()}).eq("id",j.id);failed++;}}
  return json({success:true,processed:(jobs||[]).length,sent,failed});
}

// ============================================================
// MODULE I — ANALYTICS / REPORTING
// ============================================================
async function computeEventKpis(sb:any,eventId:string){
  const [regs,wait,att,chat,questions,votes,orders,ledger,replays,docs,reviews,mediaProgress]=await Promise.all([
    sb.from("live_registrations").select("id,user_id,status").eq("event_id",eventId),
    sb.from("live_waitlist").select("id").eq("event_id",eventId),
    sb.from("live_attendance_segments").select("user_id,duration_seconds").eq("event_id",eventId),
    sb.from("live_chat_messages").select("id").eq("event_id",eventId),
    sb.from("live_questions").select("id,status").eq("event_id",eventId),
    sb.from("live_poll_votes").select("id,poll_id,live_polls!inner(event_id)").eq("live_polls.event_id",eventId),
    sb.from("live_orders").select("payment_status,amount,net_amount,purchase_type").eq("event_id",eventId),
    sb.from("live_organizer_ledger").select("status,oga_amount,organizer_amount").eq("event_id",eventId),
    sb.from("live_replay_entitlements").select("id,user_id").eq("event_id",eventId),
    sb.from("live_issued_documents").select("id,status").eq("event_id",eventId),
    sb.from("live_reviews").select("rating,status").eq("event_id",eventId).eq("status","published"),
    sb.from("live_media_progress").select("user_id,watched_seconds,completion_percent").eq("event_id",eventId)
  ]);
  const r=regs.data||[];const confirmed=r.filter((x:any)=>x.status==="confirmed");const a=att.data||[];const unique=new Set(a.map((x:any)=>x.user_id));const avgAtt=a.length?a.reduce((s:number,x:any)=>s+Number(x.duration_seconds||0),0)/Math.max(1,unique.size):0;
  const paid=(orders.data||[]).filter((x:any)=>x.payment_status==="paid");const revenue=(t:string)=>paid.filter((x:any)=>(x.purchase_type||"live")===t).reduce((s:number,x:any)=>s+Number(x.net_amount??x.amount??0),0);
  const l=(ledger.data||[]).filter((x:any)=>x.status!=="reversed");const q=questions.data||[];const rev=reviews.data||[];const mp=mediaProgress.data||[];
  return {event_id:eventId,registrations_total:r.length,registrations_confirmed:confirmed.length,waitlist_total:(wait.data||[]).length,attendance_unique:unique.size,attendance_rate:confirmed.length?unique.size/confirmed.length*100:0,average_attendance_seconds:avgAtt,chat_messages:(chat.data||[]).length,questions_total:q.length,questions_answered:q.filter((x:any)=>x.status==="answered").length,poll_votes:(votes.data||[]).length,live_revenue:revenue("live"),replay_revenue:revenue("replay"),video_revenue:revenue("recorded_video"),refunds_total:0,organizer_revenue:l.reduce((s:number,x:any)=>s+Number(x.organizer_amount||0),0),oga_revenue:l.reduce((s:number,x:any)=>s+Number(x.oga_amount||0),0),replay_views:mp.length,replay_unique_viewers:new Set(mp.map((x:any)=>x.user_id)).size,replay_average_watch_seconds:mp.length?mp.reduce((s:number,x:any)=>s+Number(x.watched_seconds||0),0)/mp.length:0,certificates_issued:(docs.data||[]).filter((x:any)=>x.status==="issued").length,certificates_revoked:(docs.data||[]).filter((x:any)=>x.status==="revoked").length,average_rating:rev.length?rev.reduce((s:number,x:any)=>s+Number(x.rating||0),0)/rev.length:0,ratings_count:rev.length,conversion_rate:r.length?paid.length/r.length*100:0,completion_rate:mp.length?mp.filter((x:any)=>Number(x.completion_percent||0)>=95).length/mp.length*100:0,updated_at:new Date().toISOString()};
}

async function analyticsEventKpis(req:Request,sb:any,ctx:any){if(!ctx)return json({error:"AUTH_REQUIRED"},401);const id=new URL(req.url).searchParams.get("event_id");if(!id)return json({error:"EVENT_ID_REQUIRED"},400);if(!(await canManageEvent(sb,ctx,id))&&!isSuperAdmin(ctx))return json({error:"FORBIDDEN"},403);let {data}=await sb.from("live_event_kpis").select("*").eq("event_id",id).maybeSingle();if(!data){data=await computeEventKpis(sb,id);await sb.from("live_event_kpis").upsert(data,{onConflict:"event_id"});}return json({success:true,kpis:data});}
async function analyticsRebuildEvent(req:Request,sb:any,ctx:any){if(!ctx)return json({error:"AUTH_REQUIRED"},401);const b=await req.json().catch(()=>({}));if(!b.event_id)return json({error:"EVENT_ID_REQUIRED"},400);if(!(await canManageEvent(sb,ctx,b.event_id))&&!isSuperAdmin(ctx))return json({error:"FORBIDDEN"},403);const k=await computeEventKpis(sb,b.event_id);const {data,error}=await sb.from("live_event_kpis").upsert(k,{onConflict:"event_id"}).select("*").single();if(error)throw error;return json({success:true,kpis:data});}
async function analyticsEventHistory(req:Request,sb:any,ctx:any){if(!ctx)return json({error:"AUTH_REQUIRED"},401);const id=new URL(req.url).searchParams.get("event_id");if(!id)return json({error:"EVENT_ID_REQUIRED"},400);if(!(await canManageEvent(sb,ctx,id))&&!isSuperAdmin(ctx))return json({error:"FORBIDDEN"},403);const {data,error}=await sb.from("live_analytics_snapshots").select("*").eq("event_id",id).order("snapshot_date");if(error)throw error;return json({success:true,snapshots:data||[]});}
async function analyticsSnapshotDaily(req:Request,sb:any,ctx:any){if(!ctx||!isSuperAdmin(ctx))return json({error:"FORBIDDEN"},403);const {data:events}=await sb.from("live_events").select("id,owner_user_id,currency").neq("status","draft");let count=0;for(const e of events||[]){const k=await computeEventKpis(sb,e.id);await sb.from("live_event_kpis").upsert(k,{onConflict:"event_id"});await sb.from("live_analytics_snapshots").upsert({event_id:e.id,organizer_user_id:e.owner_user_id,snapshot_type:"event_daily",snapshot_date:new Date().toISOString().slice(0,10),currency:e.currency,metrics:{registrations:k.registrations_confirmed,attendance_rate:k.attendance_rate,gross_revenue:k.live_revenue+k.replay_revenue+k.video_revenue,replay_views:k.replay_views,rating:k.average_rating}},{onConflict:"event_id,organizer_user_id,snapshot_type,snapshot_date"});count++;}return json({success:true,snapshots_created:count});}

async function analyticsPlatformOverview(sb:any,ctx:any){if(!ctx||!isSuperAdmin(ctx))return json({error:"FORBIDDEN"},403);const [events,regs,kpis]=await Promise.all([sb.from("live_events").select("id,delivery_type,owner_user_id,title"),sb.from("live_registrations").select("id,user_id,status"),sb.from("live_event_kpis").select("*")]);const ks=kpis.data||[];const sum=(key:string)=>ks.reduce((s:number,x:any)=>s+Number(x[key]||0),0);const by:any={};for(const e of events.data||[])by[e.delivery_type]=(by[e.delivery_type]||0)+1;const top=(events.data||[]).map((e:any)=>{const k=ks.find((x:any)=>x.event_id===e.id)||{};return{event_id:e.id,title:e.title,registrations:k.registrations_confirmed||0,gross_revenue:Number(k.live_revenue||0)+Number(k.replay_revenue||0)+Number(k.video_revenue||0)}}).sort((a:any,b:any)=>b.gross_revenue-a.gross_revenue).slice(0,10);return json({success:true,total_events:(events.data||[]).length,registrations:(regs.data||[]).length,unique_attendees:new Set((regs.data||[]).map((x:any)=>x.user_id)).size,gross_revenue:sum("live_revenue")+sum("replay_revenue")+sum("video_revenue"),refunds:sum("refunds_total"),oga_revenue:sum("oga_revenue"),organizer_revenue:sum("organizer_revenue"),replay_views:sum("replay_views"),documents_issued:sum("certificates_issued"),average_rating:ks.length?ks.reduce((s:number,x:any)=>s+Number(x.average_rating||0),0)/ks.length:0,by_delivery_type:by,top_events:top,top_organizers:[]});}
async function analyticsStructureOverview(sb:any,ctx:any){if(!ctx)return json({error:"AUTH_REQUIRED"},401);return json({success:true,members:0,events:0,registrations:0,attendance_rate:0,documents:0,revenue:0,replay_views:0,learning_hours:0,note:"Structure linkage resolved by final project schema."});}

async function reportDefinitionsList(sb:any,ctx:any){if(!ctx)return json({error:"AUTH_REQUIRED"},401);const {data,error}=await sb.from("live_report_definitions").select("*").eq("status","active").order("name");if(error)throw error;return json({success:true,reports:data||[]});}
function reportCell(v:any){return String(v??"").replaceAll(";",",").replaceAll("\n"," ");}
async function buildReportPayload(sb:any,ctx:any,def:any,format:string){
  const overview=await analyticsPlatformOverview(sb,ctx);
  const raw=await overview.clone().json().catch(()=>({}));
  const rows=[
    ["Indicateur","Valeur"],
    ["Événements",raw.total_events||0],
    ["Inscriptions",raw.registrations||0],
    ["Participants uniques",raw.unique_attendees||0],
    ["Chiffre d’affaires brut",raw.gross_revenue||0],
    ["Revenu OGA",raw.oga_revenue||0],
    ["Part organisateurs",raw.organizer_revenue||0],
    ["Remboursements",raw.refunds||0],
    ["Replays vus",raw.replay_views||0],
    ["Documents émis",raw.documents_issued||0],
    ["Note moyenne",raw.average_rating||0],
  ];
  const title=def?.name||"Rapport Omnia Live";
  if(format==="pdf"){
    const body=rows.slice(1).map(r=>`<tr><td>${reportCell(r[0])}</td><td>${reportCell(r[1])}</td></tr>`).join("");
    return {mime_type:"text/html;charset=utf-8",content_text:`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:Arial,sans-serif;padding:36px;color:#002050}h1{font-size:24px}table{width:100%;border-collapse:collapse;margin-top:24px}td,th{border:1px solid #ddd;padding:10px;text-align:left}th{background:#f5f5f5}</style></head><body><h1>${title}</h1><p>Généré le ${new Date().toLocaleString("fr-FR")}</p><table><thead><tr><th>Indicateur</th><th>Valeur</th></tr></thead><tbody>${body}</tbody></table></body></html>`};
  }
  const separator=format==="xlsx"?"\t":";";
  const content=rows.map(r=>r.map(reportCell).join(separator)).join("\n");
  return {mime_type:format==="xlsx"?"application/vnd.ms-excel;charset=utf-8":"text/csv;charset=utf-8",content_text:"\ufeff"+content};
}
async function reportExportRequest(req:Request,sb:any,ctx:any){
  if(!ctx||!isSuperAdmin(ctx))return json({error:"FORBIDDEN"},403);
  const b=await req.json().catch(()=>({}));
  if(!b.report_key||!["csv","xlsx","pdf"].includes(b.format))return json({error:"INVALID_PARAMS"},400);
  const {data:def,error:defError}=await sb.from("live_report_definitions").select("*").eq("report_key",b.report_key).maybeSingle();
  if(defError)throw defError;if(!def)return json({error:"REPORT_NOT_FOUND"},404);
  const payload=await buildReportPayload(sb,ctx,def,b.format);
  const ext=b.format==="xlsx"?"xls":b.format;
  const {data,error}=await sb.from("live_report_exports").insert({report_definition_id:def.id,requested_by:ctx.userId,event_id:b.event_id||null,organizer_user_id:null,format:b.format,filters:b.filters||{},status:"ready",file_name:`${b.report_key}-${Date.now()}.${ext}`,mime_type:payload.mime_type,content_text:payload.content_text,completed_at:new Date().toISOString()}).select("*").single();
  if(error)throw error;return json({success:true,export:data},201);
}
async function reportExportsList(sb:any,ctx:any){if(!ctx)return json({error:"AUTH_REQUIRED"},401);let q=sb.from("live_report_exports").select("*").order("created_at",{ascending:false}).limit(200);if(!isSuperAdmin(ctx))q=q.eq("requested_by",ctx.userId);const {data,error}=await q;if(error)throw error;return json({success:true,exports:data||[]});}
async function reportExportProcess(req:Request,sb:any,ctx:any){if(!ctx||!isSuperAdmin(ctx))return json({error:"FORBIDDEN"},403);const b=await req.json().catch(()=>({}));const limit=Math.min(50,Number(b.limit||10));const {data:rows,error}=await sb.from("live_report_exports").select("*,live_report_definitions(*)").eq("status","queued").limit(limit);if(error)throw error;for(const x of rows||[]){await sb.from("live_report_exports").update({status:"processing"}).eq("id",x.id);await sb.from("live_report_exports").update({status:"failed",error_message:"EXPORT_WORKER_REQUIRED_FOR_BINARY_FORMAT",completed_at:new Date().toISOString()}).eq("id",x.id);}return json({success:true,processed:(rows||[]).length,note:"CSV/XLSX/PDF binary generation is delegated to the report worker."});}

// ============================================================
// MODULE J — SECURITY / PERMISSIONS / AUDIT / INTEGRITY
// ============================================================
async function rolePermissionsList(sb:any,ctx:any){if(!ctx||!isSuperAdmin(ctx))return json({error:"FORBIDDEN"},403);const {data,error}=await sb.from("live_role_permissions").select("*").order("role_key").order("permission_key");if(error)throw error;return json({success:true,permissions:data||[]});}
async function rolePermissionSave(req:Request,sb:any,ctx:any){if(!ctx||!isSuperAdmin(ctx))return json({error:"FORBIDDEN"},403);const b=await req.json().catch(()=>({}));if(!b.role_key||!b.permission_key)return json({error:"MISSING_PARAMS"},400);const {data,error}=await sb.from("live_role_permissions").upsert({role_key:b.role_key,permission_key:b.permission_key,enabled:b.enabled!==false,scope:b.scope||"global",settings:b.settings||{},updated_by:ctx.userId,updated_at:new Date().toISOString()},{onConflict:"role_key,permission_key"}).select("*").single();if(error)throw error;return json({success:true,permission:data});}
async function securityPoliciesList(sb:any,ctx:any){if(!ctx||!isSuperAdmin(ctx))return json({error:"FORBIDDEN"},403);const {data,error}=await sb.from("live_security_policies").select("*").order("policy_key");if(error)throw error;return json({success:true,policies:data||[]});}
async function securityPolicySave(req:Request,sb:any,ctx:any){if(!ctx||!isSuperAdmin(ctx))return json({error:"FORBIDDEN"},403);const b=await req.json().catch(()=>({}));if(!b.policy_key)return json({error:"POLICY_KEY_REQUIRED"},400);const {data,error}=await sb.from("live_security_policies").upsert({policy_key:b.policy_key,enabled:b.enabled!==false,config:b.config||{},updated_by:ctx.userId,updated_at:new Date().toISOString()},{onConflict:"policy_key"}).select("*").single();if(error)throw error;return json({success:true,policy:data});}
async function featureFlagsList(sb:any,ctx:any){if(!ctx||!isSuperAdmin(ctx))return json({error:"FORBIDDEN"},403);const {data,error}=await sb.from("live_feature_flags").select("*").not("flag_key","in",'("omnia_live_pass","oga_premium_live")').order("flag_key");if(error)throw error;return json({success:true,flags:data||[]});}
async function featureFlagSave(req:Request,sb:any,ctx:any){if(!ctx||!isSuperAdmin(ctx))return json({error:"FORBIDDEN"},403);const b=await req.json().catch(()=>({}));if(!b.flag_key)return json({error:"FLAG_KEY_REQUIRED"},400);if(["omnia_live_pass","oga_premium_live"].includes(String(b.flag_key)))return json({error:"LEGACY_COMMERCE_DISABLED",message:"Cet ancien plan a été retiré au profit du futur moteur central de monétisation."},410);const {data,error}=await sb.from("live_feature_flags").upsert({flag_key:b.flag_key,enabled:Boolean(b.enabled),audience:b.audience||{roles:[],countries:[],structures:[]},config:b.config||{},updated_by:ctx.userId,updated_at:new Date().toISOString()},{onConflict:"flag_key"}).select("*").single();if(error)throw error;return json({success:true,flag:data});}
async function auditLogWrite(sb:any,ctx:any,action:string,opts:any={}){try{await sb.from("live_audit_log").insert({actor_user_id:ctx?.userId||null,actor_role:Array.isArray(ctx?.roles)?(ctx.roles.includes("super_admin")?"super_admin":ctx.roles[0]||null):null,event_id:opts.event_id||null,entity_type:opts.entity_type||null,entity_id:opts.entity_id||null,action,result:opts.result||"success",metadata:opts.metadata||{}});}catch(e){console.error("audit write",e);} }
async function auditLogList(req:Request,sb:any,ctx:any){if(!ctx||!isSuperAdmin(ctx))return json({error:"FORBIDDEN"},403);const url=new URL(req.url);const action=url.searchParams.get("action");let q=sb.from("live_audit_log").select("*").order("created_at",{ascending:false}).limit(1000);if(action)q=q.eq("action",action);const {data,error}=await q;if(error)throw error;return json({success:true,items:data||[]});}
async function integrityChecksRun(req:Request,sb:any,ctx:any){
  if(!ctx||!isSuperAdmin(ctx))return json({error:"FORBIDDEN"},403);

  const checks:any[]=[];
  const tests=[
    ["events_without_owner","live_events","owner_user_id","warning"],
    ["paid_orders_without_access","live_orders","access_granted_at","critical"],
    ["ready_media_without_storage","live_media","storage_key","warning"]
  ];

  for(const [key,table,column,severity] of tests){
    try{
      let q=sb.from(table).select("id",{count:"exact",head:true}).is(column,null);
      if(key==="paid_orders_without_access")q=q.eq("payment_status","paid");
      if(key==="ready_media_without_storage")q=q.eq("processing_status","ready");
      const {count,error}=await q;
      if(error)throw error;

      const {data:existing}=await sb.from("live_integrity_checks")
        .select("*").eq("check_key",key).eq("scope","platform").eq("status","open")
        .is("entity_id",null).maybeSingle();

      if((count||0)>0){
        if(existing){
          checks.push(existing);
        }else{
          const {data,error:insertError}=await sb.from("live_integrity_checks").insert({
            check_key:key,scope:"platform",severity,status:"open",details:{count}
          }).select("*").single();
          if(insertError)throw insertError;
          checks.push(data);
        }
      }else if(existing){
        await sb.from("live_integrity_checks").update({
          status:"resolved",resolved_at:new Date().toISOString(),resolved_by:ctx.userId
        }).eq("id",existing.id);
      }
    }catch(e){
      checks.push({
        check_key:key,severity:"error",status:"open",
        details:{error:e instanceof Error?e.message:"QUERY_FAILED"}
      });
    }
  }

  const {data:openRows}=await sb.from("live_integrity_checks")
    .select("severity,status").eq("status","open");

  const summary={
    critical:(openRows||[]).filter((x:any)=>x.severity==="critical").length,
    error:(openRows||[]).filter((x:any)=>x.severity==="error").length,
    warning:(openRows||[]).filter((x:any)=>x.severity==="warning").length,
    resolved:0
  };

  await auditLogWrite(sb,ctx,"integrity_checks_run",{metadata:{checks_returned:checks.length}});
  return json({success:true,checks,summary});
}
async function integrityCheckResolve(req:Request,sb:any,ctx:any){if(!ctx||!isSuperAdmin(ctx))return json({error:"FORBIDDEN"},403);const b=await req.json().catch(()=>({}));if(!b.check_id)return json({error:"CHECK_ID_REQUIRED"},400);const {data,error}=await sb.from("live_integrity_checks").update({status:b.status||"resolved",resolved_at:new Date().toISOString(),resolved_by:ctx.userId}).eq("id",b.check_id).select("*").single();if(error)throw error;return json({success:true,check:data});}
async function systemStatus(sb:any){const services:any={database:{status:"ok"},r2:{status:Deno.env.get("R2_BUCKET_NAME")?"configured":"missing"},brevo:{status:Deno.env.get("BREVO_API_KEY")?"configured":"missing"},fedapay:{status:Deno.env.get("FEDAPAY_SECRET_KEY")?"configured":"disabled_or_missing"},media_worker:{status:Deno.env.get("MEDIA_WORKER_SECRET")?"configured":"missing"},recording:{status:Deno.env.get("LIVE_RECORDING_SECRET")?"configured":"disabled_or_missing"}};const ok=!Object.values(services).some((x:any)=>x.status==="missing");return json({success:true,ok,services});}


async function adminCreateLive(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  if (!ctx || !isSuperAdmin(ctx)) return json({ error: "FORBIDDEN" }, 403);

  const body = (await req.json().catch(() => ({}))) as any;
  if (!String(body.title || "").trim()) return json({ error: "TITLE_REQUIRED" }, 400);

  const mode = String(body.creation_mode || "omnia");
  if (!["omnia", "organizer", "structure"].includes(mode)) return json({ error: "INVALID_CREATION_MODE" }, 400);
  if (mode === "organizer" && !body.owner_user_id) return json({ error: "OWNER_USER_ID_REQUIRED" }, 400);
  if (mode === "structure" && !body.owner_structure_id) return json({ error: "OWNER_STRUCTURE_ID_REQUIRED" }, 400);

  const publishNow = mode === "omnia" && Boolean(body.publish_now);
  const now = new Date().toISOString();

  const payload: any = {
    owner_user_id: mode === "omnia" ? ctx.userId : (mode === "organizer" ? body.owner_user_id : ctx.userId),
    owner_structure_id: mode === "structure" ? body.owner_structure_id : null,
    organizer_kind: mode === "omnia" ? "omnia" : mode === "structure" ? "structure" : "user",
    organizer_display_name: mode === "omnia" ? "Omnia Global Academy" : (body.organizer_display_name || null),
    title: String(body.title).trim(),
    slug: makeSlug(String(body.title)),
    event_type: EVENT_TYPES.has(String(body.event_type)) ? String(body.event_type) : "masterclass",
    delivery_type: DELIVERY_TYPES.has(String(body.delivery_type)) ? String(body.delivery_type) : "single_live",
    status: publishNow ? "published" : "draft",
    created_at: now,
    updated_at: now,
    last_reviewed_by: ctx.userId,
    last_reviewed_at: now,
  };

  if (publishNow) {
    payload.approved_at = now;
    payload.published_at = now;
    payload.admin_review_message = "Créé et publié directement par l’Administration Omnia au nom d’Omnia Global Academy.";
  }

  const { data: event, error } = await sb.from("live_events").insert(payload).select("*").single();
  if (error) throw error;

  if (String(body.presenter_name || "").trim()) {
    const { error: speakerError } = await sb.from("live_event_speakers").insert({
      event_id: event.id,
      external_name: String(body.presenter_name).trim(),
      external_email: body.presenter_email ? String(body.presenter_email).trim() : null,
      title: body.presenter_title ? String(body.presenter_title).trim() : null,
      organization: body.presenter_organization ? String(body.presenter_organization).trim() : null,
      role: "speaker",
      invitation_status: body.presenter_email ? "pending" : "not_required",
      display_order: 0,
    });
    if (speakerError) throw speakerError;
  }

  await reviewLog(sb, {
    eventId: event.id,
    action: publishNow ? "published" : "under_review",
    actorUserId: ctx.userId,
    fromStatus: null,
    toStatus: event.status,
    message: publishNow
      ? "Créé et publié directement par l’Administration Omnia au nom d’Omnia Global Academy."
      : "Brouillon créé par l’Administration Omnia.",
    snapshot: event,
  });

  return json({
    success: true,
    event,
    validation_skipped: publishNow,
    message: publishNow
      ? "Live Omnia créé et publié directement."
      : "Brouillon créé. Il peut être complété dans le Studio.",
  }, 201);
}



async function adminDeleteSuspended(
  req: Request,
  sb: ReturnType<typeof createClient>,
  ctx: Awaited<ReturnType<typeof sessionContext>>,
) {
  try {
    if (!ctx || !isSuperAdmin(ctx)) {
      return json({ error: "FORBIDDEN", message: "Accès administratif Omnia requis." }, 403);
    }

    const url = new URL(req.url);
    const body = req.method === "POST"
      ? ((await req.json().catch(() => ({}))) as any)
      : {};
    const eventId = String(body.event_id || url.searchParams.get("event_id") || "").trim();

    if (!eventId) {
      return json({ error: "EVENT_ID_REQUIRED", message: "Identifiant du Live manquant." }, 400);
    }

    const { data: event, error: lookupError } = await sb
      .from("live_events")
      .select("*")
      .eq("id", eventId)
      .maybeSingle();

    if (lookupError) {
      return json({
        error: "EVENT_LOOKUP_FAILED",
        message: lookupError.message,
        code: lookupError.code,
        details: lookupError.details,
        hint: lookupError.hint,
      }, 400);
    }

    if (!event) {
      return json({
        success: true,
        deleted: true,
        already_deleted: true,
        event_id: eventId,
        message: "Ce Live est déjà supprimé.",
      });
    }

    if (event.status !== "suspended") {
      return json({
        error: "ONLY_SUSPENDED_EVENT_CAN_BE_DELETED",
        message: `Le Live doit être suspendu avant suppression. Statut actuel : ${event.status}.`,
        current_status: event.status,
      }, 409);
    }

    let history: any[] = [];
    const hr = await sb.from("live_review_history")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true });
    if (!hr.error) history = hr.data ?? [];

    const { error: auditError } = await sb.from("live_deleted_event_audit").insert({
      original_event_id: event.id,
      title: event.title,
      previous_status: event.status,
      organizer_snapshot: {
        owner_user_id: event.owner_user_id ?? null,
        owner_structure_id: event.owner_structure_id ?? null,
        organizer_kind: event.organizer_kind ?? null,
        organizer_display_name: event.organizer_display_name ?? null,
      },
      event_snapshot: event,
      validation_history: history,
      deleted_by: ctx.userId,
    });

    if (auditError) {
      return json({
        error: "DELETE_AUDIT_FAILED",
        message: auditError.message,
        code: auditError.code,
        details: auditError.details,
        hint: auditError.hint,
      }, 400);
    }

    const { error: deleteError } = await sb
      .from("live_events")
      .delete()
      .eq("id", eventId);

    if (deleteError) {
      return json({
        error: "DELETE_EVENT_FAILED",
        message: deleteError.message,
        code: deleteError.code,
        details: deleteError.details,
        hint: deleteError.hint,
      }, 400);
    }

    const { data: remaining, error: verifyError } = await sb
      .from("live_events")
      .select("id")
      .eq("id", eventId)
      .maybeSingle();

    if (verifyError) {
      return json({
        error: "DELETE_VERIFY_FAILED",
        message: verifyError.message,
        code: verifyError.code,
        details: verifyError.details,
        hint: verifyError.hint,
      }, 400);
    }

    if (remaining) {
      return json({
        error: "DELETE_FAILED_EVENT_STILL_EXISTS",
        message: "Le Live existe encore dans la base après la suppression.",
      }, 409);
    }

    return json({
      success: true,
      deleted: true,
      event_id: eventId,
      message: "Live supprimé définitivement. L’action reste dans l’historique administratif.",
    });
  } catch (error) {
    const e = error as any;
    return json({
      error: "DELETE_UNEXPECTED_ERROR",
      message:
        error instanceof Error
          ? error.message
          : typeof error === "string"
          ? error
          : (() => {
              try { return JSON.stringify(error); }
              catch { return String(error); }
            })(),
      raw: e && typeof e === "object" ? e : undefined,
    }, 500);
  }
}



async function hydrateUserMap(sb: ReturnType<typeof createClient>, ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map<string, any>();
  const { data } = await sb.from("users").select("id,full_name,email").in("id", unique);
  return new Map((data ?? []).map((x:any)=>[x.id,x]));
}

async function hydrateEventMap(sb: ReturnType<typeof createClient>, ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map<string, any>();
  const { data } = await sb.from("live_events").select("id,title,starts_at,organizer_display_name").in("id", unique);
  return new Map((data ?? []).map((x:any)=>[x.id,x]));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const sb = supabaseAdmin();
    const token = tokenFrom(req);
    let ctx = await sessionContext(sb, token);
    const requestUrl = new URL(req.url);
    const action = requestUrl.searchParams.get("action") ?? "list";
    const previewRole = requestUrl.searchParams.get("preview_role");

    if (previewRole) {
      if (previewRole !== "organisateur" || !ctx || !isSuperAdmin(ctx)) {
        return json({ error: "FORBIDDEN" }, 403);
      }
      if (!ORGANIZER_PREVIEW_READ_ACTIONS.has(action)) {
        return json({
          error: "PREVIEW_READ_ONLY",
          message: "Cette action est désactivée dans la prévisualisation Organisateur.",
        }, 403);
      }
      try {
        ctx = await organizerPreviewContext(sb);
      } catch (error) {
        return json({
          error: "ORGANIZER_PREVIEW_ACCOUNT_MISSING",
          message: "Le compte de prévisualisation Organisateur est indisponible.",
          detail: error instanceof Error ? error.message : String(error),
        }, 503);
      }
    }

    switch (action) {
      case "list":
        return await publicList(req, sb);

      case "categories":
        return await categories(sb, ctx, req);

      case "get":
        return await getEvent(req, sb, ctx);

      case "studio_get":
        return await studioGet(req, sb, ctx);

      case "my":
        return await myLives(sb, ctx);

      case "create_draft":
        return await createDraft(req, sb, ctx);

      case "update_draft":
        return await updateDraft(req, sb, ctx);

      case "save_sessions":
        return await saveSessions(req, sb, ctx);

      case "save_speakers":
        return await saveSpeakers(req, sb, ctx);

      case "submit":
        return await submitEvent(req, sb, ctx);

      case "admin_queue":
        return await adminQueue(sb, ctx, req);

      case "admin_review":
        return await adminReview(req, sb, ctx);

      case "set_commercial_terms":
        return await setCommercialTerms(req, sb, ctx);

      case "accept_terms":
        return await acceptTerms(req, sb, ctx);

      case "publish":
        return await publishEvent(req, sb, ctx);

      case "media_register":
        return await mediaRegister(req, sb, ctx);

      case "media_update":
        return await mediaUpdate(req, sb, ctx);

      case "playback_authorize":
        return await playbackAuthorize(req, sb, ctx);

      case "room_prepare":
        return await roomPrepare(req, sb, ctx);

      case "upload_prepare":
        return await uploadPrepare(req, sb, ctx);

      case "upload_complete":
        return await uploadComplete(req, sb, ctx);

      case "processing_queue":
        return await processingQueue(req, sb, ctx);

      case "processing_update":
        return await processingUpdate(req, sb, ctx);

      case "processing_complete":
        return await processingComplete(req, sb, ctx);

      case "processing_status":
        return await processingStatus(req, sb, ctx);

      case "room_open":
        return await roomOpen(req, sb, ctx);

      case "room_start":
        return await roomStart(req, sb, ctx);

      case "room_join":
        return await roomJoin(req, sb, ctx);

      case "room_admit":
        return await roomAdmit(req, sb, ctx);

      case "room_heartbeat":
        return await roomHeartbeat(req, sb, ctx);

      case "room_leave":
        return await roomLeave(req, sb, ctx);

      case "room_remove_participant":
        return await roomRemoveParticipant(req, sb, ctx);

      case "room_participants":
        return await roomParticipants(req, sb, ctx);

      case "room_end":
        return await roomEnd(req, sb, ctx);

      case "attendance_summary":
        return await attendanceSummary(req, sb, ctx);

      case "registration_create":
        return await registrationCreate(req, sb, ctx);

      case "payment_confirm":
        return await paymentConfirm(req, sb, ctx);

      case "invoice_download":
        return await invoiceDownload(req, sb, ctx);

      case "refund_request":
        return await refundRequest(req, sb, ctx);

      case "refund_admin_decision":
        return await refundAdminDecision(req, sb, ctx);

      case "waitlist_promote":
        return await waitlistPromote(req, sb, ctx);

      case "orders_mine":
        return await ordersMine(sb, ctx);

      case "refunds_admin_queue":
        return await refundsAdminQueue(sb, ctx);

      case "cancellation_request":
        return await cancellationRequest(req, sb, ctx);

      case "cancellation_admin_decision":
        return await cancellationAdminDecision(req, sb, ctx);

      case "cancellation_admin_queue":
        return await cancellationAdminQueue(sb, ctx);

      case "review_create":
        return await reviewCreate(req, sb, ctx);

      case "reviews_list":
        return await reviewsList(req, sb);

      case "certificate_eligibility_calculate":
        return await certificateEligibilityCalculate(req, sb, ctx);

      case "certificate_eligibility_mine":
        return await certificateEligibilityMine(req, sb, ctx);

      case "organizer_ledger_mine":
        return await organizerLedgerMine(sb, ctx);

      case "replay_entitlements_grant":
        return await replayEntitlementGrantForEvent(req, sb, ctx);

      case "notifications_schedule":
        return await notificationsScheduleForEvent(req, sb, ctx);

      case "private_code_create":
        return await privateCodeCreate(req, sb, ctx);

      case "private_code_redeem":
        return await privateCodeRedeem(req, sb, ctx);

      case "structure_pack_create":
        return await structurePackCreate(req, sb, ctx);

      case "archive_create":
        return await archiveCreate(req, sb, ctx);

      case "organizer_profile_upsert":
        return await organizerProfileUpsert(req, sb, ctx);

      case "organizer_profile_get":
        return await organizerProfileGet(req, sb);

      case "organizer_profile_me":
        return await organizerProfileMe(sb, ctx);

      case "organizer_profile_refresh_stats":
        return await organizerProfileRefreshStats(req, sb, ctx);

      case "analytics_rebuild":
        return await analyticsRebuild(req, sb, ctx);

      case "analytics_get":
        return await analyticsGet(req, sb, ctx);

      case "fedapay_prepare":
        return await fedapayPrepare(req, sb, ctx);

      case "fedapay_webhook":
        return await fedapayWebhook(req, sb);

      case "document_issue_v2":
        return await documentIssueG(req, sb, ctx);

      case "documents_mine_v2":
        return await documentsMineG(sb, ctx);

      case "document_download":
        return await documentDownload(req, sb, ctx);

      case "document_verify_v2":
        return await documentVerifyG(req, sb);

      case "notification_dispatch":
        return await notificationDispatch(req, sb, ctx);

      case "admin_create_live":
        return await adminCreateLive(req, sb, ctx);

      case "admin_delete_suspended":
        return await adminDeleteSuspended(req, sb, ctx);

      case "admin_dashboard":
        return await adminDashboard(sb, ctx);

      case "admin_events":
        return await adminEvents(req, sb, ctx);

      case "admin_event_detail":
        return await adminEventDetail(req, sb, ctx);

      case "admin_organizers":
        return await adminOrganizers(sb, ctx);

      case "admin_organizer_decision":
        return await adminOrganizerDecision(req, sb, ctx);

      case "admin_structure_packs":
        return await adminStructurePacks(sb, ctx);

      case "admin_media_queue":
        return await adminMediaQueue(req, sb, ctx);

      case "admin_media_review":
        return await adminMediaReview(req, sb, ctx);

      case "admin_finance":
        return await adminFinance(sb, ctx);

      case "admin_payout_create":
        return await adminPayoutCreate(req, sb, ctx);

      case "admin_payout_decision":
        return await adminPayoutDecision(req, sb, ctx);

      case "admin_reports":
        return await adminReports(sb, ctx);

      case "admin_report_decision":
        return await adminReportDecision(req, sb, ctx);

      case "admin_settings_get":
        return await adminSettingsGet(sb, ctx);

      case "admin_settings_save":
        return await adminSettingsSave(req, sb, ctx);

      case "organizer_dashboard":
        return await organizerDashboard(sb, ctx);

      case "organizer_events":
        return await organizerEvents(req, sb, ctx);

      case "organizer_participants":
        return await organizerParticipants(req, sb, ctx);

      case "organizer_media":
        return await organizerMedia(req, sb, ctx);

      case "organizer_cancellations":
        return await organizerCancellationList(sb, ctx);

      case "organizer_access_codes":
        return await organizerAccessCodes(req, sb, ctx);

      case "organizer_analytics":
        return await organizerAnalyticsOverview(sb, ctx);

      case "participant_dashboard":
        return await participantDashboard(sb, ctx);

      case "participant_library":
        return await participantLibrary(sb, ctx);

      case "participant_notifications":
        return await participantNotifications(sb, ctx);

      case "participant_notification_update":
        return await participantNotificationUpdate(req, sb, ctx);

      case "participant_progress_update":
        return await participantProgressUpdate(req, sb, ctx);

      case "participant_waitlist_accept":
        return await participantWaitlistAccept(req, sb, ctx);

      case "participant_refunds":
        return await participantRefunds(sb, ctx);

      case "favorite_toggle":
        return await favoriteToggle(req, sb, ctx);

      case "media_create_revision":
        return await mediaCreateRevision(req, sb, ctx);

      case "media_processing_prepare":
        return await mediaProcessingPrepare(req, sb, ctx);

      case "media_processing_callback":
        return await mediaProcessingCallback(req, sb);

      case "replay_job_create":
        return await replayJobCreate(req, sb, ctx);

      case "replay_job_callback":
        return await replayJobCallback(req, sb);

      case "replay_jobs_list":
        return await replayJobsList(req, sb, ctx);

      case "media_retention_schedule":
        return await mediaRetentionSchedule(req, sb, ctx);

      case "media_retention_run":
        return await mediaRetentionRun(req, sb, ctx);

      case "media_playback_audit":
        return await mediaPlaybackAudit(req, sb, ctx);

      case "media_admin_versions":
        return await mediaAdminVersions(req, sb, ctx);

      case "room_controls_get":
        return await roomControlsGet(req, sb, ctx);

      case "room_controls_update":
        return await roomControlsUpdate(req, sb, ctx);

      case "chat_list":
        return await chatList(req, sb, ctx);

      case "chat_send":
        return await chatSend(req, sb, ctx);

      case "chat_moderate":
        return await chatModerate(req, sb, ctx);

      case "question_list":
        return await questionList(req, sb, ctx);

      case "question_create":
        return await questionCreate(req, sb, ctx);

      case "question_vote":
        return await questionVote(req, sb, ctx);

      case "question_answer":
        return await questionAnswer(req, sb, ctx);

      case "poll_list":
        return await pollList(req, sb, ctx);

      case "poll_create":
        return await pollCreate(req, sb, ctx);

      case "poll_update":
        return await pollUpdate(req, sb, ctx);

      case "poll_vote":
        return await pollVote(req, sb, ctx);

      case "recording_start":
        return await recordingStart(req, sb, ctx);

      case "recording_stop":
        return await recordingStop(req, sb, ctx);

      case "recording_provider_callback":
        return await recordingProviderCallback(req, sb);

      case "commerce_sync_event_products":
        return await commerceSyncEventProducts(req, sb, ctx);

      case "commerce_sync_media_product":
        return await commerceSyncMediaProduct(req, sb, ctx);

      case "commerce_products":
        return await commerceProductsList(req, sb);

      case "commerce_checkout":
        return await commerceCheckout(req, sb, ctx);

      case "commerce_entitlements_mine":
        return await commerceEntitlementsMine(sb, ctx);

      case "store_payment_finalize":
        return await storePaymentFinalize(sb, ctx, await req.json().catch(()=>({})) as Record<string,unknown>);

      case "discount_admin_create":
        return await discountAdminCreate(req, sb, ctx);

      case "discount_admin_list":
        return await discountAdminList(sb, ctx);

      case "payout_request_create":
        return await payoutRequestCreate(req, sb, ctx);

      case "payout_requests_mine":
        return await payoutRequestsMine(sb, ctx);

      case "payout_admin_requests":
        return await payoutAdminRequests(sb, ctx);

      case "payout_admin_decision":
        return await payoutAdminDecision(req, sb, ctx);

      case "subscription_plans_admin":
        return await subscriptionPlansAdmin(sb, ctx);

      case "subscription_plan_save":
        return await subscriptionPlanSave(req, sb, ctx);

      case "document_rules_get":
        return await documentRulesGet(req, sb, ctx);
      case "document_rules_save":
        return await documentRulesSave(req, sb, ctx);
      case "document_request_create":
        return await documentRequestCreate(req, sb, ctx);
      case "document_admin_requests":
        return await documentAdminRequests(req, sb, ctx);
      case "document_admin_decision":
        return await documentAdminDecision(req, sb, ctx);
      case "document_issue":
        return await documentIssue(req, sb, ctx);
      case "documents_mine":
        return await documentsMine(sb, ctx);
      case "document_verify":
        return await documentVerify(req, sb);
      case "document_revoke":
        return await documentRevoke(req, sb, ctx);
      case "document_templates_list":
        return await documentTemplatesList(sb, ctx);
      case "document_template_save":
        return await documentTemplateSave(req, sb, ctx);

      case "notification_preferences_get": return await notificationPreferencesGet(sb, ctx);
      case "notification_preferences_save": return await notificationPreferencesSave(req, sb, ctx);
      case "notifications_inbox": return await notificationsInbox(req, sb, ctx);
      case "notification_inbox_update": return await notificationInboxUpdate(req, sb, ctx);
      case "notification_templates_list": return await notificationTemplatesList(sb, ctx);
      case "notification_template_save": return await notificationTemplateSave(req, sb, ctx);
      case "communication_campaign_create": return await communicationCampaignCreate(req, sb, ctx);
      case "communication_campaigns_list": return await communicationCampaignsList(req, sb, ctx);
      case "communication_campaign_schedule": return await communicationCampaignSchedule(req, sb, ctx);
      case "admin_communication_campaigns": return await adminCommunicationCampaigns(sb, ctx);
      case "admin_communication_campaign_decision": return await adminCommunicationCampaignDecision(req, sb, ctx);
      case "automation_rules_list": return await automationRulesList(req, sb, ctx);
      case "admin_automation_rules": return await adminAutomationRules(sb, ctx);
      case "automation_rule_save": return await automationRuleSave(req, sb, ctx);
      case "notification_jobs_list": return await notificationJobsList(sb, ctx);
      case "notification_dispatch_due": return await notificationDispatchDue(req, sb, ctx);

      case "analytics_event_kpis": return await analyticsEventKpis(req, sb, ctx);
      case "analytics_event_history": return await analyticsEventHistory(req, sb, ctx);
      case "analytics_platform_overview": return await analyticsPlatformOverview(sb, ctx);
      case "analytics_structure_overview": return await analyticsStructureOverview(sb, ctx);
      case "analytics_rebuild_event": return await analyticsRebuildEvent(req, sb, ctx);
      case "analytics_snapshot_daily": return await analyticsSnapshotDaily(req, sb, ctx);
      case "report_definitions_list": return await reportDefinitionsList(sb, ctx);
      case "report_export_request": return await reportExportRequest(req, sb, ctx);
      case "report_exports_list": return await reportExportsList(sb, ctx);
      case "report_export_process": return await reportExportProcess(req, sb, ctx);

      case "role_permissions_list": return await rolePermissionsList(sb, ctx);
      case "role_permission_save": return await rolePermissionSave(req, sb, ctx);
      case "security_policies_list": return await securityPoliciesList(sb, ctx);
      case "security_policy_save": return await securityPolicySave(req, sb, ctx);
      case "feature_flags_list": return await featureFlagsList(sb, ctx);
      case "feature_flag_save": return await featureFlagSave(req, sb, ctx);
      case "audit_log_list": return await auditLogList(req, sb, ctx);
      case "integrity_checks_run": return await integrityChecksRun(req, sb, ctx);
      case "integrity_check_resolve": return await integrityCheckResolve(req, sb, ctx);
      case "system_status": return await systemStatus(sb);

      default:
        return json(
          {
            error: "UNKNOWN_ACTION",
            action,
            allowed_actions: [
              "list",
              "categories",
              "get",
              "studio_get",
              "my",
              "create_draft",
              "update_draft",
              "save_sessions",
              "save_speakers",
              "submit",
              "admin_queue",
              "admin_review",
              "set_commercial_terms",
              "accept_terms",
              "publish",
              "media_register",
              "media_update",
              "playback_authorize",
              "room_prepare",
              "upload_prepare",
              "upload_complete",
              "processing_queue",
              "processing_update",
              "processing_complete",
              "processing_status",
              "room_open",
              "room_start",
              "room_join",
              "room_admit",
              "room_heartbeat",
              "room_leave",
              "room_remove_participant",
              "room_participants",
              "room_end",
              "attendance_summary",
              "registration_create",
              "payment_confirm",
              "invoice_download",
              "refund_request",
              "refund_admin_decision",
              "waitlist_promote",
              "orders_mine",
              "refunds_admin_queue",
              "cancellation_request",
              "cancellation_admin_decision",
              "cancellation_admin_queue",
              "review_create",
              "reviews_list",
              "certificate_eligibility_calculate",
              "certificate_eligibility_mine",
              "organizer_ledger_mine",
              "replay_entitlements_grant",
              "notifications_schedule",
              "private_code_create",
              "private_code_redeem",
              "structure_pack_create",
              "archive_create",
              "organizer_profile_upsert",
              "organizer_profile_get",
              "organizer_profile_me",
              "organizer_profile_refresh_stats",
              "analytics_rebuild",
              "analytics_get",
              "fedapay_prepare",
              "fedapay_webhook",
              "document_issue",
              "documents_mine",
              "document_download",
              "document_verify",
              "notification_dispatch",
              "admin_create_live",
              "admin_delete_suspended",
              "admin_dashboard",
              "admin_events",
              "admin_event_detail",
              "admin_organizers",
              "admin_organizer_decision",
              "admin_structure_packs",
              "admin_media_queue",
              "admin_media_review",
              "admin_finance",
              "admin_payout_create",
              "admin_payout_decision",
              "admin_reports",
              "admin_report_decision",
              "admin_settings_get",
              "admin_settings_save",
              "organizer_dashboard",
              "organizer_events",
              "organizer_participants",
              "organizer_media",
              "organizer_cancellations",
              "organizer_access_codes",
              "organizer_analytics",
              "participant_dashboard",
              "participant_library",
              "participant_notifications",
              "participant_notification_update",
              "participant_progress_update",
              "participant_waitlist_accept",
              "participant_refunds",
              "favorite_toggle",
              "media_create_revision",
              "media_processing_prepare",
              "media_processing_callback",
              "replay_job_create",
              "replay_job_callback",
              "replay_jobs_list",
              "media_retention_schedule",
              "media_retention_run",
              "media_playback_audit",
              "media_admin_versions",
              "room_controls_get",
              "room_controls_update",
              "chat_list",
              "chat_send",
              "chat_moderate",
              "question_list",
              "question_create",
              "question_vote",
              "question_answer",
              "poll_list",
              "poll_create",
              "poll_update",
              "poll_vote",
              "recording_start",
              "recording_stop",
              "recording_provider_callback",
              "commerce_sync_event_products",
              "commerce_sync_media_product",
              "commerce_products",
              "commerce_checkout",
              "commerce_entitlements_mine",
              "discount_admin_create",
              "discount_admin_list",
              "payout_request_create",
              "payout_requests_mine",
              "payout_admin_requests",
              "payout_admin_decision",
              "subscription_plans_admin",
              "subscription_plan_save",
              "document_rules_get",
              "document_rules_save",
              "document_request_create",
              "document_admin_requests",
              "document_admin_decision",
              "document_issue",
              "documents_mine",
              "document_verify",
              "document_revoke",
              "document_templates_list",
              "document_template_save",
              "notification_preferences_get",
              "notification_preferences_save",
              "notifications_inbox",
              "notification_inbox_update",
              "notification_templates_list",
              "notification_template_save",
              "communication_campaign_create",
              "communication_campaigns_list",
              "communication_campaign_schedule",
              "admin_communication_campaigns",
              "admin_communication_campaign_decision",
              "automation_rules_list",
              "admin_automation_rules",
              "automation_rule_save",
              "notification_jobs_list",
              "notification_dispatch_due",
              "analytics_event_kpis",
              "analytics_event_history",
              "analytics_platform_overview",
              "analytics_structure_overview",
              "analytics_rebuild_event",
              "analytics_snapshot_daily",
              "report_definitions_list",
              "report_export_request",
              "report_exports_list",
              "report_export_process",
              "role_permissions_list",
              "role_permission_save",
              "security_policies_list",
              "security_policy_save",
              "feature_flags_list",
              "feature_flag_save",
              "audit_log_list",
              "integrity_checks_run",
              "integrity_check_resolve",
              "system_status",
              "document_issue_v2",
              "documents_mine_v2",
              "document_verify_v2",
            ],
          },
          400,
        );
    }
  } catch (error) {
    console.error("omnia-live error:", error);

    let message = "Unknown error";
    let raw: unknown = undefined;

    if (error instanceof Error) {
      message = error.message;
      raw = { name: error.name, stack: error.stack };
    } else if (typeof error === "string") {
      message = error;
      raw = error;
    } else {
      try {
        message = JSON.stringify(error);
        raw = error;
      } catch {
        message = String(error);
      }
    }

    return json(
      {
        error: "SERVER_ERROR",
        message,
        raw,
      },
      500,
    );
  }
});
