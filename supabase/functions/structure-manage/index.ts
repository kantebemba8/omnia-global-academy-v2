import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { createAccessInvitation } from "../_shared/access-invitations.ts";
import { sendOmniaEmail } from "../_shared/brevo-mail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-omnia-session-token",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function authToken(req: Request) {
  return (req.headers.get("x-omnia-session-token") || req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
}

class ClientError extends Error {
  status: number;
  code: string;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "ClientError";
    this.code = code;
    this.status = status;
  }
}

const STRUCTURE_ASSET_BUCKET = "omnia-global-academy";
const B2B_DOCUMENT_BUCKET = "b2b-documents";
const LOGO_MIMES = new Set(["image/png", "image/jpeg"]);
const DOCUMENT_MIMES = new Set(["application/pdf", "image/png", "image/jpeg"]);

function decodeBase64(value: unknown): Uint8Array {
  const raw = String(value || "").replace(/^data:[^;]+;base64,/, "").trim();
  if (!raw) throw new ClientError("FILE_EMPTY", "Le fichier transmis est vide.");
  try {
    const binary = atob(raw);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    throw new ClientError("FILE_INVALID", "Le fichier transmis est invalide.");
  }
}

function extensionFor(mime: string, originalName: string) {
  const mapped: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "application/pdf": "pdf",
  };
  const original = originalName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "";
  return mapped[mime] || original || "bin";
}

async function uploadStructureAsset(
  sb: ReturnType<typeof createClient>,
  userId: string,
  kind: "logos" | "justificatifs",
  base64: unknown,
  mimeValue: unknown,
  originalNameValue: unknown,
) {
  const mime = String(mimeValue || "").toLowerCase();
  const originalName = String(originalNameValue || "fichier");
  const allowed = kind === "logos" ? LOGO_MIMES : DOCUMENT_MIMES;
  const maxBytes = kind === "logos" ? 2 * 1024 * 1024 : 5 * 1024 * 1024;
  if (!allowed.has(mime)) {
    throw new ClientError("FILE_TYPE_NOT_ALLOWED", kind === "logos"
      ? "Le logo doit être au format PNG ou JPG."
      : "Le justificatif doit être au format PDF, PNG ou JPG.");
  }

  const bytes = decodeBase64(base64);
  if (bytes.byteLength > maxBytes) {
    throw new ClientError("FILE_TOO_LARGE", kind === "logos"
      ? "Le logo ne doit pas dépasser 2 MB."
      : "Le justificatif ne doit pas dépasser 5 MB.");
  }

  const path = `structures/${kind}/${userId}/${crypto.randomUUID()}.${extensionFor(mime, originalName)}`;
  const { error } = await sb.storage.from(STRUCTURE_ASSET_BUCKET).upload(path, bytes, {
    contentType: mime,
    upsert: false,
  });
  if (error) throw new Error(`STORAGE_UPLOAD_FAILED: ${error.message}`);

  const publicUrl = sb.storage.from(STRUCTURE_ASSET_BUCKET).getPublicUrl(path).data.publicUrl;
  return { path, publicUrl };
}


async function uploadB2BDocument(
  sb: ReturnType<typeof createClient>,
  organizationId: string,
  userId: string,
  base64: unknown,
  mimeValue: unknown,
  originalNameValue: unknown,
) {
  const mime = String(mimeValue || "").toLowerCase();
  const originalName = String(originalNameValue || "preuve");
  if (!DOCUMENT_MIMES.has(mime)) {
    throw new ClientError("FILE_TYPE_NOT_ALLOWED", "La preuve doit être au format PDF, PNG ou JPG.");
  }
  const bytes = decodeBase64(base64);
  if (bytes.byteLength > 8 * 1024 * 1024) {
    throw new ClientError("FILE_TOO_LARGE", "La preuve de paiement ne doit pas dépasser 8 MB.");
  }
  const path = `b2b/${organizationId}/payments/${userId}/${crypto.randomUUID()}.${extensionFor(mime, originalName)}`;
  const { error } = await sb.storage.from(B2B_DOCUMENT_BUCKET).upload(path, bytes, { contentType: mime, upsert: false });
  if (error) throw new Error(`B2B_STORAGE_UPLOAD_FAILED: ${error.message}`);
  return { path };
}

async function signedB2BDocumentUrl(sb: ReturnType<typeof createClient>, pathValue: unknown) {
  const path = String(pathValue || "").trim();
  if (!path) return null;
  const { data, error } = await sb.storage.from(B2B_DOCUMENT_BUCKET).createSignedUrl(path, 3600);
  if (error) return null;
  return data?.signedUrl || null;
}

async function b2bBenefitsSnapshot(sb: ReturnType<typeof createClient>, commercePlanId: string | null) {
  if (!commercePlanId) return [];
  const { data, error } = await sb.from("commerce_plan_benefits")
    .select("benefit_definition_id,value_json,display_label,display_order,commerce_benefit_definitions(benefit_key,name,value_type,reset_period,unit_label)")
    .eq("plan_id", commercePlanId)
    .eq("is_active", true)
    .order("display_order");
  if (error) throw error;
  return (data || []).map((row: any) => ({
    benefit_definition_id: row.benefit_definition_id,
    value_json: row.value_json || {},
    display_label: row.display_label || row.commerce_benefit_definitions?.name || "Avantage",
    benefit_key: row.commerce_benefit_definitions?.benefit_key || null,
    value_type: row.commerce_benefit_definitions?.value_type || null,
    reset_period: row.commerce_benefit_definitions?.reset_period || null,
    unit_label: row.commerce_benefit_definitions?.unit_label || null,
  }));
}

async function appendB2BAudit(
  sb: ReturnType<typeof createClient>,
  organizationId: string | null,
  actorUserId: string | null,
  eventType: string,
  entityType: string,
  entityId: string | null,
  metadata: Record<string, unknown> = {},
) {
  const { error } = await sb.from("b2b_audit_log").insert({
    organization_id: organizationId,
    actor_user_id: actorUserId,
    event_type: eventType,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
  });
  if (error) throw error;
}

async function refreshB2BEntitlements(sb: ReturnType<typeof createClient>, organizationId: string) {
  const { data, error } = await sb.rpc("oga_refresh_b2b_contract_entitlements", { p_organization_id: organizationId });
  if (error) throw error;
  return data;
}

function randomPart(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function generateCode(prefix = "OGA") {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${randomPart(4)}`;
}

const STRUCTURE_STATUS_TO_UI: Record<string, string> = {
  pending: "pending_validation",
  pending_validation: "pending_validation",
  modification_requested: "changes_requested",
  changes_requested: "changes_requested",
  validated: "validated",
  refused: "rejected",
  rejected: "rejected",
  suspended: "suspended",
  draft: "draft",
  archived: "archived",
};

const CODE_STATUS_TO_UI: Record<string, string> = {
  draft: "draft",
  pending: "pending_admin_validation",
  pending_admin_validation: "pending_admin_validation",
  validated: "active",
  active: "active",
  inactive: "inactive",
  refused: "rejected",
  rejected: "rejected",
  suspended: "suspended",
  expired: "expired",
};

const CODE_TYPE_LABELS: Record<string, string> = {
  rattachement_simple: "Rattachement simple",
  acces_formation: "Accès formation",
  reduction_formation: "Réduction formation",
  acces_omnia_career: "Accès Omnia Career",
  acces_groupe: "Accès groupe",
  programme_special: "Programme spécial",
  autre: "Autre",
};

const CODE_TYPES = new Set(Object.keys(CODE_TYPE_LABELS));
const SPECIAL_CODE_TYPES = new Set([...CODE_TYPES].filter((value) => value !== "rattachement_simple"));

const STRUCTURE_TEAM_PERMISSION_KEYS = new Set([
  "can_manage_structure_profile",
  "can_manage_structure_users",
  "can_create_courses",
  "can_edit_courses",
  "can_submit_courses",
  "can_assign_trainers",
  "can_manage_lessons",
  "can_upload_files",
  "can_manage_members",
  "can_approve_memberships",
  "can_manage_structure_codes",
  "can_view_statistics",
  "can_view_logs",
  "can_manage_notifications",
  "can_manage_settings",
  "can_manage_b2b_contracts",
  "can_manage_omnia_live",
  "can_manage_projects",
]);

const SENSITIVE_STRUCTURE_INPUTS: Record<string, string> = {
  name: "org_name",
  professional_email: "email",
  responsible_name: "contact_name",
  responsible_function: "contact_function",
  responsible_email: "contact_email",
  responsible_phone: "contact_phone",
  logo_url: "logo_url",
};

function normalizeStructurePermissions(value: unknown) {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return Object.fromEntries([...STRUCTURE_TEAM_PERMISSION_KEYS].map((key) => [key, source[key] === true]));
}

function sameValue(a: unknown, b: unknown) {
  return String(a ?? "").trim() === String(b ?? "").trim();
}

function mapStructure(row: Record<string, any>) {
  return {
    ...row,
    id: row.id,
    name: row.org_name ?? row.name ?? "Structure",
    structure_type: row.org_type ?? row.structure_type ?? "autre",
    status: STRUCTURE_STATUS_TO_UI[row.status] ?? row.status ?? "draft",
    country: row.country ?? "",
    city: row.city ?? "",
    address: row.address ?? "",
    professional_email: row.email ?? row.professional_email ?? "",
    phone: row.phone ?? "",
    website: row.website ?? "",
    description: row.description ?? "",
    objective: row.main_need ?? row.objective ?? "",
    logo_url: row.logo_url ?? null,
    justificatif_url: row.justificatif_url ?? null,
    responsible_name: row.contact_name ?? row.responsible_name ?? "",
    responsible_function: row.contact_function ?? row.responsible_function ?? "",
    responsible_email: row.contact_email ?? row.responsible_email ?? "",
    responsible_phone: row.contact_phone ?? row.responsible_phone ?? "",
    admin_comment: row.modification_note ?? row.admin_comment ?? null,
    rejection_reason: row.rejection_reason ?? null,
    display_name: row.org_name ?? row.name ?? "Structure",
    status_label: STRUCTURE_STATUS_TO_UI[row.status] ?? row.status ?? "draft",
  };
}

function codeMeta(row: Record<string, any>) {
  return row.advantages && typeof row.advantages === "object" ? row.advantages : {};
}

function mapCode(row: Record<string, any>) {
  const meta = codeMeta(row);
  const type = meta.code_type || "rattachement_simple";
  const expired = row.expires_at && Date.parse(row.expires_at) < Date.now();
  const activeUses = Number(row._active_uses ?? row.used_count ?? 0);
  const pendingUses = Number(row._pending_uses ?? 0);
  const maxUses = Number(row.max_users || 0);
  const reviewState = String(meta.admin_review_state || "");
  let status = expired ? "expired" : (CODE_STATUS_TO_UI[row.status] ?? row.status ?? "draft");
  if (!expired && status === "draft" && reviewState === "changes_requested") status = "changes_requested";
  return {
    ...row,
    id: row.id,
    structure_id: row.organization_id,
    code_name: row.code_name || "Code structure",
    code_value: row.code,
    code_type: type,
    type_label: CODE_TYPE_LABELS[type] || type,
    description: meta.description || "",
    max_uses: maxUses,
    used_count: activeUses,
    current_uses: activeUses,
    pending_uses: pendingUses,
    remaining_uses: Math.max(0, maxUses - activeUses),
    requires_manual_validation: true,
    pin: row.pin || "",
    pin_enabled: !!String(row.pin || "").trim(),
    requires_admin_validation: SPECIAL_CODE_TYPES.has(type),
    status,
    admin_comment: meta.admin_comment || row.refusal_reason || null,
  };
}

async function mapCodesWithUsage(sb: ReturnType<typeof createClient>, rows: Record<string, any>[]) {
  const codeIds = rows.map((row) => String(row.id || "")).filter(Boolean);
  const usage = new Map<string, { active: number; pending: number }>();
  if (codeIds.length) {
    const { data, error } = await sb.from("partner_code_users").select("code_id,status").in("code_id", codeIds);
    if (error) throw error;
    for (const row of data || []) {
      const codeId = String(row.code_id || "");
      const stats = usage.get(codeId) || { active: 0, pending: 0 };
      const status = String(row.status || "").toLowerCase();
      if (["validated", "approved", "active", "actif"].includes(status)) stats.active += 1;
      else if (["pending", "requested", "en_attente"].includes(status)) stats.pending += 1;
      usage.set(codeId, stats);
    }
  }
  return rows.map((row) => {
    const stats = usage.get(String(row.id)) || { active: 0, pending: 0 };
    return mapCode({ ...row, _active_uses: stats.active, _pending_uses: stats.pending });
  });
}

function validateCodeInput(body: Record<string, any>) {
  const codeName = String(body.code_name || "").trim();
  const codeType = String(body.code_type || "rattachement_simple").trim();
  const description = String(body.description || "").trim();
  const maxUses = Number(body.max_uses);
  const pin = String(body.pin || "").trim();
  const expiresAt = body.expires_at ? String(body.expires_at) : null;

  if (codeName.length < 3 || codeName.length > 120) throw new ClientError("CODE_NAME_INVALID", "Le nom du code doit contenir entre 3 et 120 caractères.");
  if (!CODE_TYPES.has(codeType)) throw new ClientError("CODE_TYPE_INVALID", "Le type de code est invalide.");
  if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 100000) throw new ClientError("CODE_LIMIT_INVALID", "La limite du code doit être comprise entre 1 et 100 000 membres.");
  if (pin && (pin.length < 4 || pin.length > 20)) throw new ClientError("PIN_INVALID", "Le PIN doit contenir entre 4 et 20 caractères.");
  if (expiresAt && (!Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now())) throw new ClientError("EXPIRATION_INVALID", "La date d'expiration doit être dans le futur.");

  return { codeName, codeType, description, maxUses, pin: pin || null, expiresAt };
}

async function appendStructureAudit(
  sb: ReturnType<typeof createClient>,
  organizationId: string,
  actorUserId: string | null,
  actorScope: string,
  eventType: string,
  metadata: Record<string, unknown> = {},
  targetUserId: string | null = null,
) {
  const { error } = await sb.from("structure_governance_audit").insert({
    organization_id: organizationId,
    actor_user_id: actorUserId,
    actor_scope: actorScope,
    event_type: eventType,
    target_user_id: targetUserId,
    metadata,
  });
  if (error) throw error;
}

async function getOpenProfileChange(sb: ReturnType<typeof createClient>, organizationId: string) {
  const { data, error } = await sb.from("structure_profile_change_requests")
    .select("*")
    .eq("organization_id", organizationId)
    .in("status", ["pending", "changes_requested"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as Record<string, any> | null;
}

async function verifySession(sb: ReturnType<typeof createClient>, token: string) {
  const { data: session, error } = await sb.from("user_sessions")
    .select("user_id")
    .eq("session_token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error || !session) return null;
  const userId = String(session.user_id);
  const [{ data: roles }, { data: user }] = await Promise.all([
    sb.from("user_roles").select("role").eq("user_id", userId),
    sb.from("users").select("id,full_name,email,status").eq("id", userId).maybeSingle(),
  ]);
  return {
    userId,
    user,
    roles: (roles || []).map((r: any) => String(r.role)),
  };
}

async function managerLink(sb: ReturnType<typeof createClient>, userId: string, organizationId?: string) {
  let query = sb.from("partner_managers")
    .select("organization_id,user_id,role_in_org,is_primary,status,permissions")
    .eq("user_id", userId)
    .in("status", ["actif", "active"]);
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data } = await query.order("is_primary", { ascending: false }).limit(1).maybeSingle();
  return data as Record<string, any> | null;
}

function hasPermission(link: Record<string, any> | null, permission?: string) {
  if (!link) return false;
  if (link.is_primary) return true;
  if (!permission) return true;
  return link.permissions?.[permission] === true;
}

async function primaryManagerEmailVerified(
  sb: ReturnType<typeof createClient>,
  organizationId: string,
): Promise<boolean> {
  const { data: manager, error: managerError } = await sb.from("partner_managers")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("is_primary", true)
    .maybeSingle();
  if (managerError) throw managerError;
  if (!manager?.user_id) return false;
  const { data: user, error: userError } = await sb.from("users")
    .select("email_status")
    .eq("id", manager.user_id)
    .maybeSingle();
  if (userError) throw userError;
  return String(user?.email_status || "valide") === "valide";
}

async function requireStructureAccess(
  sb: ReturnType<typeof createClient>,
  session: { userId: string; roles: string[] },
  organizationId: string,
  permission?: string,
  allowUnvalidated = false,
) {
  if (session.roles.includes("super_admin")) return true;
  const link = await managerLink(sb, session.userId, organizationId);
  if (!hasPermission(link, permission)) return false;
  if (allowUnvalidated) return true;
  const organization = await getOrganization(sb, organizationId);
  return String(organization?.status || "") === "validated";
}

function isSuperAdmin(session: { roles: string[] }) {
  return session.roles.includes("super_admin");
}

async function addRole(sb: ReturnType<typeof createClient>, userId: string, role: string) {
  const { error } = await sb.from("user_roles").upsert(
    { user_id: userId, role },
    { onConflict: "user_id,role", ignoreDuplicates: true },
  );
  if (error && error.code !== "23505") throw error;
}

async function structureCapacity(sb: ReturnType<typeof createClient>, organizationId: string, benefitKey: string) {
  const { data: manager } = await sb.from("partner_managers").select("user_id").eq("organization_id", organizationId).eq("is_primary", true).in("status", ["actif", "active"]).maybeSingle();
  if (!manager?.user_id) return null;
  const { data: definition } = await sb.from("commerce_benefit_definitions").select("id").eq("benefit_key", benefitKey).eq("is_active", true).maybeSingle();
  if (!definition) return null;
  const now = new Date().toISOString();
  const { data: rights } = await sb.from("commerce_entitlements").select("value_json").eq("user_id", manager.user_id).eq("benefit_definition_id", definition.id).eq("status", "active").lte("valid_from", now).or(`valid_until.is.null,valid_until.gte.${now}`);
  const values = (rights || []).map((row: any) => Number(row.value_json?.value ?? row.value_json?.capacity ?? row.value_json?.quantity)).filter((value: number) => Number.isFinite(value) && value >= 0);
  return values.length ? Math.max(...values) : null;
}

async function getOrganization(sb: ReturnType<typeof createClient>, organizationId: string) {
  const { data, error } = await sb.from("partner_organizations").select("*").eq("id", organizationId).maybeSingle();
  if (error) throw error;
  return data as Record<string, any> | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const token = authToken(req);
  if (!token) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const session = await verifySession(sb, token);
    if (!session) return json({ error: "SESSION_INVALID" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    if (action === "create_structure") {
      const required = ["name", "structure_type", "responsible_name", "responsible_email"];
      if (required.some((key) => !String(body[key] || "").trim())) {
        return json({ error: "MISSING_REQUIRED_FIELDS", message: "Des informations obligatoires sont manquantes." }, 400);
      }

      const existingLink = await managerLink(sb, session.userId);
      if (existingLink) return json({ error: "STRUCTURE_ALREADY_EXISTS", message: "Une Structure est déjà liée à ce compte." }, 409);

      const uploadedPaths: string[] = [];
      let createdOrganizationId = "";
      let logoUrl = String(body.logo_url || "").trim() || null;
      let justificatifUrl = String(body.justificatif_url || "").trim() || null;

      try {
        if (body.logo_base64) {
          const uploaded = await uploadStructureAsset(
            sb,
            session.userId,
            "logos",
            body.logo_base64,
            body.logo_mime,
            body.logo_name,
          );
          uploadedPaths.push(uploaded.path);
          logoUrl = uploaded.publicUrl;
        }
        if (body.justificatif_base64) {
          const uploaded = await uploadStructureAsset(
            sb,
            session.userId,
            "justificatifs",
            body.justificatif_base64,
            body.justificatif_mime,
            body.justificatif_name,
          );
          uploadedPaths.push(uploaded.path);
          justificatifUrl = uploaded.publicUrl;
        }

        const { data: organization, error } = await sb.from("partner_organizations").insert({
          org_name: String(body.name).trim(),
          org_type: String(body.structure_type).trim(),
          country: body.country || null,
          city: body.city || null,
          address: body.address || null,
          phone: body.phone || null,
          email: body.professional_email || null,
          website: body.website || null,
          description: body.description || null,
          main_need: body.objective || null,
          logo_url: logoUrl,
          justificatif_url: justificatifUrl,
          contact_name: body.responsible_name || session.user?.full_name || null,
          contact_function: body.responsible_function || null,
          contact_email: body.responsible_email || session.user?.email || null,
          contact_phone: body.responsible_phone || null,
          status: "pending",
        }).select("*").single();
        if (error) throw error;
        createdOrganizationId = String(organization.id);

        const { error: managerError } = await sb.from("partner_managers").insert({
          organization_id: organization.id,
          user_id: session.userId,
          role_in_org: "responsable_structure",
          is_primary: true,
          status: "actif",
          permissions: {
            can_manage_structure_profile: true,
            can_manage_structure_users: true,
            can_create_courses: true,
            can_edit_courses: true,
            can_submit_courses: true,
            can_assign_trainers: true,
            can_manage_lessons: true,
            can_upload_files: true,
            can_manage_members: true,
            can_approve_memberships: true,
            can_manage_structure_codes: true,
            can_view_statistics: true,
            can_view_logs: true,
            can_manage_notifications: true,
            can_manage_settings: true,
            can_manage_b2b_contracts: true,
            can_manage_omnia_live: true,
            can_manage_projects: true,
          },
        });
        if (managerError) throw managerError;

        await addRole(sb, session.userId, "responsable_structure");
        await sb.from("user_roles").delete().eq("user_id", session.userId).in("role", ["etablissement_directeur", "etablissement_enseignant"]);
        await appendStructureAudit(sb, createdOrganizationId, session.userId, "structure", "structure_created", {
          status: "pending",
          structure_type: String(body.structure_type || "autre"),
        }, session.userId);

        return json({ success: true, structure: mapStructure(organization) });
      } catch (error) {
        if (createdOrganizationId) {
          await sb.from("partner_organizations").delete().eq("id", createdOrganizationId).catch(() => {});
        }
        if (uploadedPaths.length) {
          await sb.storage.from(STRUCTURE_ASSET_BUCKET).remove(uploadedPaths).catch(() => {});
        }
        throw error;
      }
    }

    if (action === "get_my_structure") {
      const link = await managerLink(sb, session.userId);
      if (!link) return json({ error: "NO_STRUCTURE" }, 404);
      const organizationId = String(link.organization_id);
      const organization = await getOrganization(sb, organizationId);
      if (!organization) return json({ error: "STRUCTURE_NOT_FOUND" }, 404);
      const [profileChange, recruitmentResult] = await Promise.all([
        getOpenProfileChange(sb, organizationId),
        sb.from("talent_structure_permissions").select("can_post_job,can_search_talent,can_contact_talent,can_manage_jobs,can_view_applications,can_schedule_interview,can_manage_team").eq("organization_id", organizationId).eq("user_id", session.userId).maybeSingle(),
      ]);
      if (recruitmentResult.error) throw recruitmentResult.error;
      return json({
        success: true,
        structure: mapStructure(organization),
        my_permissions: link.is_primary ? normalizeStructurePermissions(Object.fromEntries([...STRUCTURE_TEAM_PERMISSION_KEYS].map(key => [key, true]))) : normalizeStructurePermissions(link.permissions || {}),
        my_recruitment_permissions: recruitmentResult.data || {},
        my_role: link.role_in_org,
        is_primary: !!link.is_primary,
        operational_access: String(organization.status || "") === "validated",
        pending_profile_change: profileChange,
      });
    }

    if (action === "my_memberships") {
      const { data: links, error: linksError } = await sb.from("partner_code_users")
        .select("*")
        .eq("user_id", session.userId)
        .order("created_at", { ascending: false });
      if (linksError) throw linksError;

      const organizationIds = [...new Set((links || []).map((row: any) => String(row.organization_id || "")).filter(Boolean))];
      const { data: organizations, error: organizationsError } = organizationIds.length
        ? await sb.from("partner_organizations").select("*").in("id", organizationIds)
        : { data: [], error: null };
      if (organizationsError) throw organizationsError;
      const organizationsById = new Map((organizations || []).map((row: any) => [String(row.id), row]));

      const normalizedStatus = (value: unknown) => {
        const status = String(value || "").toLowerCase();
        if (["validated", "approved", "active", "actif"].includes(status)) return "approved";
        if (["refused", "rejected", "refuse"].includes(status)) return "rejected";
        if (["removed", "revoked", "expired", "inactive", "retire"].includes(status)) return "removed";
        return "pending";
      };

      const memberships = (links || []).map((row: any) => {
        const status = normalizedStatus(row.status);
        const organization = organizationsById.get(String(row.organization_id));
        return {
          id: row.id,
          status,
          requested_at: row.requested_at || row.created_at || row.updated_at || new Date().toISOString(),
          approved_at: status === "approved" ? (row.validated_at || row.approved_at || row.updated_at || null) : null,
          expires_at: row.expires_at || null,
          structure: organization ? mapStructure(organization) : null,
        };
      });
      return json({ success: true, memberships });
    }

    if (action === "get_structure") {
      if (!isSuperAdmin(session)) return json({ error: "FORBIDDEN" }, 403);
      const organizationId = String(body.structure_id || "");
      const organization = await getOrganization(sb, organizationId);
      if (!organization) return json({ error: "STRUCTURE_NOT_FOUND" }, 404);

      const [managersResult, invitationsResult, membersResult, profileChange, auditResult] = await Promise.all([
        sb.from("partner_managers").select("id,user_id,role_in_org,is_primary,status,permissions").eq("organization_id", organizationId).order("is_primary", { ascending: false }),
        sb.from("platform_access_invitations").select("id,email,full_name,internal_role,status,expires_at,created_at,target_user_id").eq("organization_id", organizationId).in("invitation_type", ["structure_team", "structure_recruiter"]).eq("status", "pending"),
        sb.from("partner_code_users").select("id,user_id,status,created_at").eq("organization_id", organizationId),
        getOpenProfileChange(sb, organizationId),
        sb.from("structure_governance_audit").select("id,actor_user_id,actor_scope,event_type,target_user_id,metadata,created_at").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(30),
      ]);
      if (managersResult.error) throw managersResult.error;
      if (invitationsResult.error) throw invitationsResult.error;
      if (membersResult.error) throw membersResult.error;
      if (auditResult.error) throw auditResult.error;

      const managers = managersResult.data || [];
      const managerUserIds = [...new Set(managers.map((row: any) => String(row.user_id)).filter(Boolean))];
      const auditUserIds = [...new Set((auditResult.data || []).flatMap((row: any) => [String(row.actor_user_id || ""), String(row.target_user_id || "")]).filter(Boolean))];
      const userIds = [...new Set([...managerUserIds, ...auditUserIds])];
      const { data: people, error: peopleError } = userIds.length
        ? await sb.from("users").select("id,full_name,email").in("id", userIds)
        : { data: [] as any[], error: null };
      if (peopleError) throw peopleError;
      const peopleMap = new Map((people || []).map((row: any) => [String(row.id), row]));

      const team = managers.map((row: any) => ({
        ...row,
        user: peopleMap.get(String(row.user_id)) || null,
        permissions: row.is_primary ? Object.fromEntries([...STRUCTURE_TEAM_PERMISSION_KEYS].map(key => [key, true])) : normalizeStructurePermissions(row.permissions || {}),
      }));
      const audit = (auditResult.data || []).map((row: any) => ({
        ...row,
        actor: row.actor_user_id ? peopleMap.get(String(row.actor_user_id)) || null : null,
        target: row.target_user_id ? peopleMap.get(String(row.target_user_id)) || null : null,
      }));
      const memberships = membersResult.data || [];
      return json({
        success: true,
        structure: mapStructure(organization),
        governance: {
          team,
          pending_invitations: invitationsResult.data || [],
          member_counts: {
            total: memberships.length,
            active: memberships.filter((row: any) => ["validated", "approved", "active"].includes(String(row.status))).length,
            pending: memberships.filter((row: any) => ["pending", "requested"].includes(String(row.status))).length,
          },
          pending_profile_change: profileChange,
          audit,
        },
      });
    }

    if (action === "update_structure") {
      const organizationId = String(body.structure_id || "");
      if (!organizationId) return json({ error: "STRUCTURE_ID_REQUIRED" }, 400);
      if (!(await requireStructureAccess(sb, session, organizationId, "can_manage_structure_profile", true))) {
        return json({ error: "FORBIDDEN" }, 403);
      }

      const current = await getOrganization(sb, organizationId);
      if (!current) return json({ error: "STRUCTURE_NOT_FOUND" }, 404);
      const currentStatus = String(current.status || "");
      if (["suspended", "archived"].includes(currentStatus) && !isSuperAdmin(session)) {
        return json({ error: "STRUCTURE_LOCKED", message: "Cette Structure est suspendue ou archivée. Les modifications sont temporairement bloquées." }, 403);
      }

      if (body.name !== undefined && !String(body.name || "").trim()) {
        return json({ error: "STRUCTURE_NAME_REQUIRED", message: "Le nom de la Structure est obligatoire." }, 400);
      }
      for (const key of ["professional_email", "responsible_email"]) {
        if (body[key] !== undefined && String(body[key] || "").trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body[key]).trim())) {
          return json({ error: "INVALID_EMAIL", message: "Une adresse e-mail transmise est invalide." }, 400);
        }
      }

      const fieldMap: Record<string, string> = {
        name: "org_name",
        city: "city",
        address: "address",
        professional_email: "email",
        phone: "phone",
        website: "website",
        description: "description",
        objective: "main_need",
        responsible_name: "contact_name",
        responsible_function: "contact_function",
        responsible_email: "contact_email",
        responsible_phone: "contact_phone",
      };

      let uploadedPath: string | null = null;
      try {
        const submitted: Record<string, unknown> = {};
        for (const [input, column] of Object.entries(fieldMap)) {
          if (body[input] !== undefined) submitted[column] = body[input] === "" ? null : body[input];
        }

        if (body.logo_base64) {
          const uploaded = await uploadStructureAsset(
            sb,
            session.userId,
            "logos",
            body.logo_base64,
            body.logo_mime,
            body.logo_name,
          );
          uploadedPath = uploaded.path;
          submitted.logo_url = uploaded.publicUrl;
        }

        const sensitiveColumns = new Set(Object.values(SENSITIVE_STRUCTURE_INPUTS));
        const directPatch: Record<string, unknown> = {};
        const sensitiveChanges: Record<string, unknown> = {};
        for (const [column, value] of Object.entries(submitted)) {
          if (sameValue(current[column], value)) continue;
          if (sensitiveColumns.has(column)) sensitiveChanges[column] = value;
          else directPatch[column] = value;
        }

        // Une Structure déjà validée conserve son identité officielle tant que
        // l'Administration n'a pas accepté les changements sensibles.
        if (currentStatus === "validated" && !isSuperAdmin(session)) {
          if (Object.keys(directPatch).length > 0) {
            directPatch.updated_at = new Date().toISOString();
            const { error } = await sb.from("partner_organizations").update(directPatch).eq("id", organizationId);
            if (error) throw error;
            await appendStructureAudit(sb, organizationId, session.userId, "structure", "profile_non_sensitive_updated", { fields: Object.keys(directPatch).filter(key => key !== "updated_at") });
          }

          let profileChange = await getOpenProfileChange(sb, organizationId);
          if (Object.keys(sensitiveChanges).length > 0) {
            const now = new Date().toISOString();
            const mergedChanges = { ...(profileChange?.requested_changes || {}), ...sensitiveChanges };
            if (profileChange) {
              const { data, error } = await sb.from("structure_profile_change_requests").update({
                requested_by: session.userId,
                requested_changes: mergedChanges,
                status: "pending",
                admin_comment: null,
                reviewed_by: null,
                reviewed_at: null,
                updated_at: now,
              }).eq("id", profileChange.id).select("*").single();
              if (error) throw error;
              profileChange = data;
            } else {
              const { data, error } = await sb.from("structure_profile_change_requests").insert({
                organization_id: organizationId,
                requested_by: session.userId,
                requested_changes: sensitiveChanges,
                status: "pending",
              }).select("*").single();
              if (error) throw error;
              profileChange = data;
            }
            await appendStructureAudit(sb, organizationId, session.userId, "structure", "profile_change_requested", { fields: Object.keys(sensitiveChanges), request_id: profileChange?.id || null });
          }

          const refreshed = await getOrganization(sb, organizationId);
          return json({
            success: true,
            structure: mapStructure(refreshed || current),
            pending_profile_change: profileChange,
            requires_admin_review: Object.keys(sensitiveChanges).length > 0,
          });
        }

        const patch: Record<string, unknown> = { ...directPatch, ...sensitiveChanges, updated_at: new Date().toISOString() };
        if (["modification_requested", "refused"].includes(currentStatus)) {
          patch.status = "pending";
          patch.modification_note = null;
          patch.rejection_reason = null;
        }
        const { data, error } = await sb.from("partner_organizations").update(patch).eq("id", organizationId).select("*").single();
        if (error) throw error;
        await appendStructureAudit(sb, organizationId, session.userId, isSuperAdmin(session) ? "admin" : "structure", "profile_updated", {
          fields: Object.keys(patch).filter(key => !["updated_at", "modification_note", "rejection_reason"].includes(key)),
          resubmitted: ["modification_requested", "refused"].includes(currentStatus),
        });
        return json({ success: true, structure: mapStructure(data), pending_profile_change: null, requires_admin_review: false });
      } catch (error) {
        if (uploadedPath) await sb.storage.from(STRUCTURE_ASSET_BUCKET).remove([uploadedPath]).catch(() => {});
        throw error;
      }
    }

    if (action === "admin_list_structures") {
      if (!isSuperAdmin(session)) return json({ error: "FORBIDDEN" }, 403);
      let query = sb.from("partner_organizations").select("*").order("created_at", { ascending: false });
      const statusMap: Record<string, string> = {
        pending_validation: "pending",
        changes_requested: "modification_requested",
        rejected: "refused",
      };
      if (body.status_filter) query = query.eq("status", statusMap[body.status_filter] || body.status_filter);
      if (body.type_filter) query = query.eq("org_type", body.type_filter);
      if (body.search) {
        const safe = String(body.search).replace(/[,%()]/g, " ").trim();
        if (safe) query = query.or(`org_name.ilike.%${safe}%,email.ilike.%${safe}%,contact_name.ilike.%${safe}%`);
      }
      const [{ data, error }, { data: allStatuses, error: statusError }] = await Promise.all([
        query,
        sb.from("partner_organizations").select("id,status"),
      ]);
      if (error) throw error;
      if (statusError) throw statusError;
      const filterReviewable = async (rows: any[]) => {
        const decisions = await Promise.all(rows.map(async (row: any) => {
          const pending = ["pending", "modification_requested"].includes(String(row.status));
          return !pending || await primaryManagerEmailVerified(sb, String(row.id));
        }));
        return rows.filter((_: any, index: number) => decisions[index]);
      };
      const visibleData = await filterReviewable(data || []);
      const rows = await filterReviewable(allStatuses || []);
      return json({
        success: true,
        structures: visibleData.map(mapStructure),
        stats: {
          total: rows.length,
          validated: rows.filter((row: any) => String(row.status) === "validated").length,
          pending: rows.filter((row: any) => ["pending", "modification_requested"].includes(String(row.status))).length,
          suspended: rows.filter((row: any) => String(row.status) === "suspended").length,
        },
      });
    }

    if (action === "admin_pending_overview") {
      if (!isSuperAdmin(session)) return json({ error: "FORBIDDEN" }, 403);
      const [{ data: organizations, error: organizationsError }, { data: codeRows, error: codesError }, { data: profileChanges, error: profileError }] = await Promise.all([
        sb.from("partner_organizations").select("*").in("status", ["pending", "modification_requested"]),
        sb.from("partner_codes").select("*").in("status", ["pending"]),
        sb.from("structure_profile_change_requests").select("id,organization_id,status,created_at,updated_at").in("status", ["pending", "changes_requested"]),
      ]);
      if (organizationsError) throw organizationsError;
      if (codesError) throw codesError;
      if (profileError) throw profileError;
      const structureVisibility = await Promise.all((organizations || []).map((row: any) => primaryManagerEmailVerified(sb, String(row.id))));
      const reviewableOrganizations = (organizations || []).filter((_: any, index: number) => structureVisibility[index]);
      return json({
        success: true,
        pending: {
          structures: reviewableOrganizations.map(mapStructure),
          codes: (codeRows || []).map(mapCode),
          profile_changes: profileChanges || [],
        },
      });
    }

    if (action === "admin_validate_structure") {
      if (!isSuperAdmin(session)) return json({ error: "FORBIDDEN" }, 403);
      const organizationId = String(body.structure_id || "");
      const decision = String(body.decision || "");
      if (!organizationId) return json({ error: "STRUCTURE_ID_REQUIRED" }, 400);
      const current = await getOrganization(sb, organizationId);
      if (!current) return json({ error: "STRUCTURE_NOT_FOUND" }, 404);
      if (["pending", "modification_requested"].includes(String(current.status)) && !(await primaryManagerEmailVerified(sb, organizationId))) {
        return json({ error: "EMAIL_VERIFICATION_REQUIRED", message: "Le responsable de la Structure doit d’abord confirmer son adresse e-mail avant l’examen du dossier." }, 409);
      }
      const statuses: Record<string, string> = {
        validate: "validated",
        reject: "refused",
        request_changes: "modification_requested",
        suspend: "suspended",
        archive: "archived",
        restore: "validated",
      };
      if (!statuses[decision]) return json({ error: "INVALID_DECISION" }, 400);
      const patch: Record<string, unknown> = {
        status: statuses[decision],
        updated_at: new Date().toISOString(),
        modification_note: body.admin_comment || null,
        rejection_reason: decision === "reject" ? (body.rejection_reason || body.admin_comment || null) : null,
      };
      if (decision === "validate" || decision === "restore") {
        patch.validated_by = session.userId;
        patch.validated_at = new Date().toISOString();
        patch.modification_note = null;
        patch.rejection_reason = null;
      }
      const { data, error } = await sb.from("partner_organizations").update(patch).eq("id", organizationId).select("*").single();
      if (error) throw error;

      const { data: primaryManagers, error: managersError } = await sb
        .from("partner_managers")
        .select("user_id")
        .eq("organization_id", organizationId)
        .eq("is_primary", true);
      if (managersError) throw managersError;

      for (const manager of primaryManagers || []) {
        const managerUserId = String(manager.user_id);

        if (["validate", "restore"].includes(decision)) {
          await addRole(sb, managerUserId, "responsable_structure");
          await sb.from("user_roles").delete().eq("user_id", managerUserId).in("role", ["etablissement_directeur", "etablissement_enseignant"]);

          // La validation de la Structure doit aussi rendre le compte du
          // responsable utilisable. Sans cette transition, auth-login continue
          // de bloquer le compte en "en_attente_validation".
          const { error: activateUserError } = await sb
            .from("users")
            .update({ status: "actif", updated_at: new Date().toISOString() })
            .eq("id", managerUserId);
          if (activateUserError) throw activateUserError;
        } else if (decision === "suspend") {
          const { error: suspendUserError } = await sb
            .from("users")
            .update({ status: "suspendu", updated_at: new Date().toISOString() })
            .eq("id", managerUserId);
          if (suspendUserError) throw suspendUserError;
          await sb.from("user_sessions").delete().eq("user_id", managerUserId);
        }

        const { data: managerUser } = await sb
          .from("users")
          .select("email,full_name")
          .eq("id", managerUserId)
          .maybeSingle();

        if (managerUser?.email) {
          const appUrl = (Deno.env.get("APP_URL") || "https://omniaglobalacademy.com").replace(/\/$/, "");
          if (["validate", "restore"].includes(decision)) {
            await sendOmniaEmail({
              sb,
              userId: managerUserId,
              to: { email: String(managerUser.email), name: managerUser.full_name || undefined },
              templateKey: "structure_approved",
              params: {
                CONTACT_NAME: String(managerUser.full_name || data.contact_name || ""),
                ORGANIZATION_NAME: String(data.org_name || "Votre Structure"),
                DASHBOARD_URL: `${appUrl}/structure/dashboard`,
              },
            });
          } else if (["reject", "request_changes", "suspend"].includes(decision)) {
            const statusLabel = decision === "reject"
              ? "Dossier non validé"
              : decision === "request_changes"
              ? "Modifications demandées"
              : "Structure suspendue";
            await sendOmniaEmail({
              sb,
              userId: managerUserId,
              to: { email: String(managerUser.email), name: managerUser.full_name || undefined },
              templateKey: "status_update",
              params: {
                SUBJECT: `Mise à jour de votre Structure — ${String(data.org_name || "Omnia")}`,
                FIRST_NAME: String(managerUser.full_name || "").split(" ")[0],
                MESSAGE: decision === "request_changes"
                  ? "L’Administration Omnia demande des modifications avant de poursuivre la validation de votre Structure."
                  : decision === "reject"
                  ? "La demande de validation de votre Structure n’a pas été approuvée."
                  : "L’accès opérationnel de votre Structure a été suspendu.",
                STATUS_LABEL: statusLabel,
                ADDITIONAL_INFORMATION: body.admin_comment || body.rejection_reason || "",
                CTA_LABEL: "Consulter Omnia",
                CTA_URL: `${appUrl}/connexion`,
              },
            });
          }
        }
      }

      await appendStructureAudit(sb, organizationId, session.userId, "admin", `structure_${decision}`, {
        from_status: String(current.status || ""),
        to_status: String(data.status || ""),
        comment: body.admin_comment || null,
      });
      return json({ success: true, structure: mapStructure(data) });
    }

    if (action === "admin_review_profile_change") {
      if (!isSuperAdmin(session)) return json({ error: "FORBIDDEN" }, 403);
      const organizationId = String(body.structure_id || "");
      const requestId = String(body.request_id || "");
      const decision = String(body.decision || "");
      if (!organizationId || !requestId) return json({ error: "REQUEST_REQUIRED" }, 400);
      if (!["approve", "reject", "request_changes"].includes(decision)) return json({ error: "INVALID_DECISION" }, 400);
      const { data: request, error: requestError } = await sb.from("structure_profile_change_requests")
        .select("*")
        .eq("id", requestId)
        .eq("organization_id", organizationId)
        .in("status", ["pending", "changes_requested"])
        .maybeSingle();
      if (requestError) throw requestError;
      if (!request) return json({ error: "PROFILE_CHANGE_NOT_FOUND" }, 404);
      const now = new Date().toISOString();
      if (decision === "approve") {
        const patch = { ...(request.requested_changes || {}), updated_at: now };
        const { error } = await sb.from("partner_organizations").update(patch).eq("id", organizationId);
        if (error) throw error;
      }
      const requestStatus = decision === "approve" ? "approved" : decision === "reject" ? "rejected" : "changes_requested";
      const { error: reviewError } = await sb.from("structure_profile_change_requests").update({
        status: requestStatus,
        admin_comment: body.admin_comment || null,
        reviewed_by: session.userId,
        reviewed_at: now,
        updated_at: now,
      }).eq("id", requestId);
      if (reviewError) throw reviewError;
      await appendStructureAudit(sb, organizationId, session.userId, "admin", `profile_change_${decision}`, {
        request_id: requestId,
        fields: Object.keys(request.requested_changes || {}),
        comment: body.admin_comment || null,
      });
      const organization = await getOrganization(sb, organizationId);
      return json({ success: true, structure: mapStructure(organization || {}), request_status: requestStatus });
    }

    if (action === "list_members") {
      const organizationId = String(body.structure_id || "");
      if (!(await requireStructureAccess(sb, session, organizationId, "can_manage_members"))) return json({ error: "FORBIDDEN" }, 403);
      const { data: rows, error } = await sb.from("partner_code_users").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false });
      if (error) throw error;
      const userIds = [...new Set((rows || []).map((r: any) => String(r.user_id)).filter(Boolean))];
      const codeIds = [...new Set((rows || []).map((r: any) => String(r.code_id)).filter(Boolean))];
      const [{ data: users }, { data: codes }] = await Promise.all([
        userIds.length ? sb.from("users").select("id,full_name,email").in("id", userIds) : Promise.resolve({ data: [] as any[] }),
        codeIds.length ? sb.from("partner_codes").select("id,code,code_name").in("id", codeIds) : Promise.resolve({ data: [] as any[] }),
      ]);
      const userMap = new Map((users || []).map((u: any) => [String(u.id), u]));
      const codeMap = new Map((codes || []).map((c: any) => [String(c.id), c]));
      const statusMap: Record<string, string> = { validated: "approved", approved: "approved", pending: "pending", refused: "rejected", rejected: "rejected", removed: "removed" };
      return json({
        success: true,
        members: (rows || []).map((row: any) => ({
          ...row,
          status: statusMap[row.status] || row.status,
          requested_at: row.requested_at || row.created_at,
          structure_code_id: row.code_id,
          users: userMap.get(String(row.user_id)) || null,
          code: codeMap.get(String(row.code_id)) || null,
        })),
      });
    }

    if (action === "handle_membership") {
      const organizationId = String(body.structure_id || "");
      if (!(await requireStructureAccess(sb, session, organizationId, "can_approve_memberships"))) return json({ error: "FORBIDDEN" }, 403);
      const membershipId = String(body.membership_id || "");
      const decision = String(body.decision || "");
      if (!membershipId || !["approve", "reject"].includes(decision)) return json({ error: "INVALID_REQUEST" }, 400);

      const capacity = await structureCapacity(sb, organizationId, "structure_member_limit");
      const { data: result, error } = await sb.rpc("oga_decide_structure_membership", {
        p_membership_id: membershipId,
        p_organization_id: organizationId,
        p_actor_user_id: session.userId,
        p_decision: decision,
        p_structure_capacity: capacity,
        p_comment: body.comment || null,
      });
      if (error) throw error;
      if (!result?.ok) {
        const code = String(result?.error || "MEMBERSHIP_DECISION_FAILED");
        const messages: Record<string, string> = {
          MEMBERSHIP_NOT_FOUND: "Demande de rattachement introuvable.",
          MEMBERSHIP_ALREADY_PROCESSED: "Cette demande a déjà été traitée.",
          CODE_NOT_ACTIVE: "Le code utilisé n'est plus actif.",
          CODE_EXPIRED: "Le code utilisé a expiré.",
          CODE_QUOTA_REACHED: "La limite de membres de ce code est atteinte.",
          STRUCTURE_MEMBER_LIMIT_REACHED: "La capacité de membres prévue pour la Structure est atteinte.",
          STRUCTURE_NOT_ACTIVE: "La Structure n'est pas actuellement active.",
        };
        return json({ error: code, message: messages[code] || "Décision impossible." }, 409);
      }

      await appendStructureAudit(sb, organizationId, session.userId, "structure", `membership_${decision}`, {
        membership_id: membershipId,
        code_id: result.code_id || null,
        comment: body.comment || null,
      }, String(result.user_id || "") || null);
      if (decision === "approve") await refreshB2BEntitlements(sb, organizationId);
      return json({ success: true, status: result.status });
    }

    if (action === "remove_membership") {
      const organizationId = String(body.structure_id || "");
      if (!(await requireStructureAccess(sb, session, organizationId, "can_manage_members"))) return json({ error: "FORBIDDEN" }, 403);
      const membershipId = String(body.membership_id || "");
      if (!membershipId) return json({ error: "MEMBERSHIP_REQUIRED" }, 400);
      const { data: result, error } = await sb.rpc("oga_remove_structure_membership", {
        p_membership_id: membershipId,
        p_organization_id: organizationId,
        p_actor_user_id: session.userId,
        p_comment: body.comment || null,
      });
      if (error) throw error;
      if (!result?.ok) return json({ error: result?.error || "MEMBERSHIP_REMOVE_FAILED" }, 409);
      await appendStructureAudit(sb, organizationId, session.userId, "structure", "membership_removed", {
        membership_id: membershipId,
        code_id: result.code_id || null,
        comment: body.comment || null,
      }, String(result.user_id || "") || null);
      await refreshB2BEntitlements(sb, organizationId);
      return json({ success: true, status: "removed" });
    }

    if (action === "list_team") {
      const organizationId = String(body.structure_id || "");
      if (!(await requireStructureAccess(sb, session, organizationId, "can_manage_structure_users"))) return json({ error: "FORBIDDEN" }, 403);
      const [{ data: rows, error }, { data: invitations, error: invitationError }] = await Promise.all([
        sb.from("partner_managers").select("*").eq("organization_id", organizationId).order("is_primary", { ascending: false }),
        sb.from("platform_access_invitations")
          .select("id,email,full_name,internal_role,permissions,status,created_at,expires_at,target_user_id")
          .eq("organization_id", organizationId).eq("invitation_type", "structure_team").eq("status", "pending")
          .order("created_at", { ascending: false }),
      ]);
      if (error) throw error;
      if (invitationError) throw invitationError;
      const ids = [...new Set((rows || []).map((r: any) => String(r.user_id)).filter(Boolean))];
      const { data: users } = ids.length ? await sb.from("users").select("id,full_name,email").in("id", ids) : { data: [] as any[] };
      const userMap = new Map((users || []).map((u: any) => [String(u.id), u]));
      const statusMap: Record<string, string> = { actif: "active", active: "active", invite: "invited", invited: "invited", inactif: "inactive", inactive: "inactive", suspendu: "suspended", suspended: "suspended", retire: "removed", removed: "removed" };
      const activeTeam = (rows || []).map((row: any) => {
        const user = userMap.get(String(row.user_id));
        return {
          ...row,
          invited_email: user?.email || "",
          invited_name: user?.full_name || "",
          internal_role: row.role_in_org || "lecture_seule",
          permissions_json: row.is_primary ? Object.fromEntries([...STRUCTURE_TEAM_PERMISSION_KEYS].map(key => [key, true])) : normalizeStructurePermissions(row.permissions || {}),
          status: statusMap[row.status] || row.status,
          users: user || null,
        };
      });
      const pendingTeam = (invitations || []).map((invitation: any) => ({
        id: `invitation:${invitation.id}`,
        user_id: invitation.target_user_id || null,
        invited_email: invitation.email,
        invited_name: invitation.full_name || "",
        internal_role: invitation.internal_role || "lecture_seule",
        permissions_json: normalizeStructurePermissions(invitation.permissions || {}),
        status: "invited",
        is_primary: false,
        invitation_expires_at: invitation.expires_at,
        users: invitation.target_user_id ? { id: invitation.target_user_id, full_name: invitation.full_name || "", email: invitation.email } : null,
      }));
      return json({ success: true, team: [...activeTeam, ...pendingTeam] });
    }

    if (action === "invite_team_member") {
      const organizationId = String(body.structure_id || "");
      if (!(await requireStructureAccess(sb, session, organizationId, "can_manage_structure_users"))) return json({ error: "FORBIDDEN" }, 403);
      const email = String(body.email || "").trim().toLowerCase();
      const fullName = [body.firstname, body.lastname].map(value => String(value || "").trim()).filter(Boolean).join(" ") || String(body.full_name || "").trim();
      if (!email) return json({ error: "EMAIL_REQUIRED" }, 400);
      const managerCapacity = await structureCapacity(sb, organizationId, "structure_manager_limit");
      if (managerCapacity !== null) {
        const [{ count }, { count: pendingCount }] = await Promise.all([
          sb.from("partner_managers").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).in("status", ["actif", "active"]),
          sb.from("platform_access_invitations").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("invitation_type", "structure_team").eq("status", "pending"),
        ]);
        if (Number(count || 0) + Number(pendingCount || 0) >= managerCapacity) return json({ error: "STRUCTURE_MANAGER_LIMIT_REACHED", message: "La limite de gestionnaires prévue par l'abonnement est atteinte." }, 409);
      }
      const permissions = normalizeStructurePermissions(body.permissions);
      try {
        const result = await createAccessInvitation(sb, {
          invitationType: "structure_team",
          email,
          fullName,
          organizationId,
          invitedBy: session.userId,
          internalRole: String(body.internal_role || "lecture_seule"),
          permissions,
          message: String(body.message || "").trim() || null,
        });
        await appendStructureAudit(sb, organizationId, session.userId, "structure", "team_invitation_created", {
          invitation_id: result.invitation.id,
          email,
          internal_role: result.invitation.internal_role,
          permissions,
        }, result.invitation.target_user_id || null);
        return json({
          success: true,
          invitation: result.invitation,
          invitation_url: result.invitationUrl,
          email_sent: result.emailSent,
          account_exists: result.accountExists,
          member: {
            id: `invitation:${result.invitation.id}`,
            invited_email: email,
            invited_name: fullName,
            internal_role: result.invitation.internal_role,
            permissions_json: permissions,
            status: "invited",
          },
        });
      } catch (error) {
        const code = error instanceof Error ? error.message : String(error);
        if (code === "PROTECTED_ACCOUNT") return json({ error: code, message: "Ce compte système protégé ne peut pas rejoindre une équipe Structure." }, 403);
        if (code === "INVALID_EMAIL") return json({ error: code, message: "L’adresse e-mail est invalide." }, 400);
        throw error;
      }
    }

    if (action === "update_team_member") {
      const organizationId = String(body.structure_id || "");
      if (!(await requireStructureAccess(sb, session, organizationId, "can_manage_structure_users"))) return json({ error: "FORBIDDEN" }, 403);
      const memberId = String(body.member_id || "");
      if (!memberId || memberId.startsWith("invitation:")) return json({ error: "ACTIVE_MEMBER_REQUIRED" }, 400);
      const { data: currentMember, error: memberError } = await sb.from("partner_managers")
        .select("id,user_id,is_primary,role_in_org,status,permissions")
        .eq("id", memberId)
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (memberError) throw memberError;
      if (!currentMember) return json({ error: "MEMBER_NOT_FOUND" }, 404);
      if (currentMember.is_primary) return json({ error: "PRIMARY_MANAGER_IS_PROTECTED", message: "Le responsable principal conserve l'ensemble des droits de la Structure." }, 403);

      const nextStatus = String(body.status || currentMember.status || "actif");
      if (!["actif", "active", "suspendu", "suspended"].includes(nextStatus)) return json({ error: "INVALID_MEMBER_STATUS" }, 400);
      const normalizedStatus = ["suspendu", "suspended"].includes(nextStatus) ? "suspendu" : "actif";
      const internalRole = String(body.internal_role || currentMember.role_in_org || "lecture_seule").trim() || "lecture_seule";
      const permissions = normalizeStructurePermissions(body.permissions ?? currentMember.permissions);
      const { data: updated, error } = await sb.from("partner_managers").update({
        role_in_org: internalRole,
        permissions,
        status: normalizedStatus,
      }).eq("id", memberId).eq("organization_id", organizationId).select("*").single();
      if (error) throw error;

      if (normalizedStatus === "actif") {
        await addRole(sb, String(currentMember.user_id), "gestionnaire_structure");
      } else {
        const { count } = await sb.from("partner_managers").select("id", { count: "exact", head: true })
          .eq("user_id", currentMember.user_id).neq("id", memberId).in("status", ["actif", "active"]);
        if (!Number(count || 0)) await sb.from("user_roles").delete().eq("user_id", currentMember.user_id).eq("role", "gestionnaire_structure");
      }
      await appendStructureAudit(sb, organizationId, session.userId, "structure", normalizedStatus === "actif" ? "team_member_updated" : "team_member_suspended", {
        member_id: memberId,
        previous_role: currentMember.role_in_org || null,
        internal_role: internalRole,
        permissions,
      }, String(currentMember.user_id));
      return json({ success: true, member: updated });
    }

    if (action === "remove_team_member") {
      const organizationId = String(body.structure_id || "");
      if (!(await requireStructureAccess(sb, session, organizationId, "can_manage_structure_users"))) return json({ error: "FORBIDDEN" }, 403);
      const memberId = String(body.member_id || "");
      if (memberId.startsWith("invitation:")) {
        const invitationId = memberId.slice("invitation:".length);
        const { error } = await sb.from("platform_access_invitations").update({ status: "revoked", updated_at: new Date().toISOString() })
          .eq("id", invitationId).eq("organization_id", organizationId).eq("invitation_type", "structure_team").eq("status", "pending");
        if (error) throw error;
        await appendStructureAudit(sb, organizationId, session.userId, "structure", "team_invitation_revoked", { invitation_id: invitationId });
        return json({ success: true, invitation_revoked: true });
      }
      const { data: row } = await sb.from("partner_managers").select("is_primary,user_id").eq("id", memberId).eq("organization_id", organizationId).maybeSingle();
      if (!row) return json({ error: "MEMBER_NOT_FOUND" }, 404);
      if (row.is_primary) return json({ error: "PRIMARY_MANAGER_CANNOT_BE_REMOVED" }, 403);
      const { error } = await sb.from("partner_managers").update({ status: "retire" }).eq("id", memberId).eq("organization_id", organizationId);
      if (error) throw error;
      const { count } = await sb.from("partner_managers").select("id", { count: "exact", head: true }).eq("user_id", row.user_id).in("status", ["actif", "active"]);
      if (!Number(count || 0)) await sb.from("user_roles").delete().eq("user_id", row.user_id).eq("role", "gestionnaire_structure");
      await appendStructureAudit(sb, organizationId, session.userId, "structure", "team_member_removed", { member_id: memberId }, String(row.user_id));
      return json({ success: true });
    }

    if (action === "list_codes") {
      const organizationId = String(body.structure_id || "");
      if (!(await requireStructureAccess(sb, session, organizationId, "can_manage_structure_codes"))) return json({ error: "FORBIDDEN" }, 403);
      const { data, error } = await sb.from("partner_codes").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false });
      if (error) throw error;
      return json({ success: true, codes: await mapCodesWithUsage(sb, data || []) });
    }

    if (action === "admin_list_codes") {
      if (!isSuperAdmin(session)) return json({ error: "FORBIDDEN" }, 403);
      const { data: rows, error } = await sb.from("partner_codes").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const codes = await mapCodesWithUsage(sb, rows || []);
      const organizationIds = [...new Set(codes.map((row: any) => String(row.organization_id || "")).filter(Boolean))];
      const { data: organizations, error: organizationsError } = organizationIds.length
        ? await sb.from("partner_organizations").select("id,org_name,org_type,status").in("id", organizationIds)
        : { data: [], error: null } as any;
      if (organizationsError) throw organizationsError;
      const organizationMap = new Map((organizations || []).map((row: any) => [String(row.id), row]));
      const statusFilter = String(body.status_filter || "all");
      const search = String(body.search || "").trim().toLowerCase();
      let filtered = codes.map((code: any) => ({ ...code, structure: organizationMap.get(String(code.organization_id)) || null }));
      if (statusFilter !== "all") filtered = filtered.filter((code: any) => code.status === statusFilter);
      if (search) filtered = filtered.filter((code: any) => [code.code_name, code.code_value, code.structure?.org_name].some((value) => String(value || "").toLowerCase().includes(search)));
      return json({
        success: true,
        codes: filtered,
        stats: {
          total: codes.length,
          pending: codes.filter((code: any) => code.status === "pending_admin_validation").length,
          active: codes.filter((code: any) => code.status === "active").length,
          changes_requested: codes.filter((code: any) => code.status === "changes_requested").length,
          suspended: codes.filter((code: any) => code.status === "suspended").length,
        },
      });
    }

    if (action === "create_code") {
      const organizationId = String(body.structure_id || "");
      if (!(await requireStructureAccess(sb, session, organizationId, "can_manage_structure_codes"))) return json({ error: "FORBIDDEN" }, 403);
      const input = validateCodeInput(body);
      const code = generateCode("OGA");
      const requiresAdmin = SPECIAL_CODE_TYPES.has(input.codeType);
      const meta = {
        __omnia_kind: "structure_code",
        code_type: input.codeType,
        description: input.description,
        admin_comment: null,
        admin_review_state: null,
      };
      const { data, error } = await sb.from("partner_codes").insert({
        organization_id: organizationId,
        created_by: session.userId,
        code_name: input.codeName,
        code,
        pin: input.pin,
        max_users: input.maxUses,
        expires_at: input.expiresAt,
        advantages: meta,
        requires_manual_validation: true,
        qr_code_enabled: true,
        status: requiresAdmin ? "draft" : "validated",
        used_count: 0,
      }).select("*").single();
      if (error) throw error;
      await appendStructureAudit(sb, organizationId, session.userId, "structure", "structure_code_created", {
        code_id: data.id, code_type: input.codeType, max_uses: input.maxUses, requires_admin_validation: requiresAdmin,
      });
      return json({ success: true, code: mapCode(data) });
    }

    if (action === "update_code") {
      const organizationId = String(body.structure_id || "");
      if (!(await requireStructureAccess(sb, session, organizationId, "can_manage_structure_codes"))) return json({ error: "FORBIDDEN" }, 403);
      const codeId = String(body.code_id || "");
      if (!codeId) return json({ error: "CODE_ID_REQUIRED" }, 400);
      const { data: current, error: currentError } = await sb.from("partner_codes").select("*").eq("id", codeId).eq("organization_id", organizationId).maybeSingle();
      if (currentError) throw currentError;
      if (!current) return json({ error: "CODE_NOT_FOUND" }, 404);
      const mapped = mapCode(current);
      if (["pending_admin_validation", "active", "suspended"].includes(mapped.status)) {
        return json({ error: "CODE_NOT_EDITABLE", message: "Ce code doit être en brouillon, en modification demandée ou refusé pour être modifié." }, 409);
      }
      const input = validateCodeInput(body);
      const { count } = await sb.from("partner_code_users").select("id", { count: "exact", head: true }).eq("code_id", codeId).in("status", ["validated", "approved", "active", "actif"]);
      if (Number(count || 0) > input.maxUses) return json({ error: "CODE_LIMIT_BELOW_USAGE", message: "La nouvelle limite ne peut pas être inférieure au nombre de membres déjà rattachés." }, 409);
      const meta = { ...codeMeta(current), code_type: input.codeType, description: input.description, admin_review_state: null };
      const { data, error } = await sb.from("partner_codes").update({
        code_name: input.codeName,
        pin: input.pin,
        max_users: input.maxUses,
        expires_at: input.expiresAt,
        advantages: meta,
        requires_manual_validation: true,
        status: SPECIAL_CODE_TYPES.has(input.codeType) ? "draft" : "validated",
        updated_at: new Date().toISOString(),
      }).eq("id", codeId).eq("organization_id", organizationId).select("*").single();
      if (error) throw error;
      await appendStructureAudit(sb, organizationId, session.userId, "structure", "structure_code_updated", { code_id: codeId, code_type: input.codeType, max_uses: input.maxUses });
      return json({ success: true, code: mapCode(data) });
    }

    if (action === "submit_code") {
      const organizationId = String(body.structure_id || "");
      if (!(await requireStructureAccess(sb, session, organizationId, "can_manage_structure_codes"))) return json({ error: "FORBIDDEN" }, 403);
      const codeId = String(body.code_id || "");
      const { data: current, error: currentError } = await sb.from("partner_codes").select("*").eq("id", codeId).eq("organization_id", organizationId).maybeSingle();
      if (currentError) throw currentError;
      if (!current) return json({ error: "CODE_NOT_FOUND" }, 404);
      const type = String(codeMeta(current).code_type || "rattachement_simple");
      if (!SPECIAL_CODE_TYPES.has(type)) return json({ error: "ADMIN_VALIDATION_NOT_REQUIRED", message: "Un code de rattachement simple est actif sans validation administrative." }, 409);
      if (!['draft','refused','rejected'].includes(String(current.status || ''))) return json({ error: "CODE_NOT_SUBMITTABLE" }, 409);
      const meta = { ...codeMeta(current), admin_comment: null, admin_review_state: "pending" };
      const { data, error } = await sb.from("partner_codes").update({ status: "pending", advantages: meta, submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", codeId).eq("organization_id", organizationId).select("*").single();
      if (error) throw error;
      await appendStructureAudit(sb, organizationId, session.userId, "structure", "structure_code_submitted", { code_id: codeId, code_type: type });
      return json({ success: true, code: mapCode(data) });
    }

    if (action === "admin_validate_code") {
      if (!isSuperAdmin(session)) return json({ error: "FORBIDDEN" }, 403);
      const codeId = String(body.code_id || "");
      const decision = String(body.decision || "");
      const { data: current, error: currentError } = await sb.from("partner_codes").select("*").eq("id", codeId).maybeSingle();
      if (currentError) throw currentError;
      if (!current) return json({ error: "CODE_NOT_FOUND" }, 404);
      const metaCurrent = codeMeta(current);
      const type = String(metaCurrent.code_type || "rattachement_simple");
      if (!CODE_TYPES.has(type)) return json({ error: "CODE_TYPE_INVALID" }, 409);
      const statusMap: Record<string, string> = { activate: "validated", reject: "refused", request_changes: "draft", suspend: "suspended", deactivate: "draft" };
      if (!statusMap[decision]) return json({ error: "INVALID_DECISION" }, 400);

      let maxUsers = Number(current.max_users || 0);
      if (body.max_uses !== undefined) {
        const candidate = Number(body.max_uses);
        if (!Number.isInteger(candidate) || candidate < 1 || candidate > 100000) return json({ error: "CODE_LIMIT_INVALID" }, 400);
        const { count } = await sb.from("partner_code_users").select("id", { count: "exact", head: true }).eq("code_id", codeId).in("status", ["validated", "approved", "active", "actif"]);
        if (Number(count || 0) > candidate) return json({ error: "CODE_LIMIT_BELOW_USAGE" }, 409);
        maxUsers = candidate;
      }
      let expiresAt = current.expires_at || null;
      if (body.expires_at !== undefined) {
        expiresAt = body.expires_at ? String(body.expires_at) : null;
        if (expiresAt && (!Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now())) return json({ error: "EXPIRATION_INVALID" }, 400);
      }
      const description = body.description !== undefined ? String(body.description || "").trim() : String(metaCurrent.description || "");
      const adminComment = String(body.admin_comment || "").trim() || null;
      const reviewState = decision === "request_changes" ? "changes_requested" : decision === "activate" ? "approved" : decision === "reject" ? "rejected" : decision;
      const meta = { ...metaCurrent, description, admin_comment: adminComment, admin_review_state: reviewState };
      const patch: Record<string, unknown> = {
        status: statusMap[decision],
        advantages: meta,
        max_users: maxUsers,
        expires_at: expiresAt,
        requires_manual_validation: true,
        updated_at: new Date().toISOString(),
      };
      if (decision === "activate") { patch.validated_by = session.userId; patch.validated_at = new Date().toISOString(); }
      if (decision === "reject") patch.refusal_reason = adminComment;
      const { data, error } = await sb.from("partner_codes").update(patch).eq("id", codeId).select("*").single();
      if (error) throw error;
      await appendStructureAudit(sb, String(current.organization_id), session.userId, "admin", `structure_code_${decision}`, { code_id: codeId, code_type: type, max_uses: maxUsers, comment: adminComment });
      return json({ success: true, code: mapCode(data) });
    }

    if (action === "use_code") {
      if (!session.roles.includes("apprenant")) return json({ error: "CODE_LEARNER_ONLY", message: "Les Codes Structure sont réservés au rattachement des apprenants." }, 403);
      const codeValue = String(body.code_value || "").trim().toUpperCase();
      if (!codeValue) return json({ error: "CODE_REQUIRED" }, 400);
      const { data: codeRow, error: codeError } = await sb.from("partner_codes").select("organization_id").eq("code", codeValue).maybeSingle();
      if (codeError) throw codeError;
      const capacity = codeRow?.organization_id ? await structureCapacity(sb, String(codeRow.organization_id), "structure_member_limit") : null;
      const { data: result, error } = await sb.rpc("oga_use_structure_code", {
        p_code_value: codeValue,
        p_user_id: session.userId,
        p_pin: body.pin || null,
        p_structure_capacity: capacity,
      });
      if (error) throw error;
      if (!result?.ok) {
        const code = String(result?.error || "CODE_USE_FAILED");
        const messages: Record<string, string> = {
          INVALID_CODE: "Code structure invalide.",
          PIN_REQUIRED: "Ce code nécessite un PIN.",
          INVALID_PIN: "Le PIN est incorrect.",
          CODE_NOT_ACTIVE: "Ce code n'est pas actif.",
          CODE_EXPIRED: "Ce code a expiré.",
          CODE_QUOTA_REACHED: "La limite d'utilisation de ce code est atteinte.",
          CODE_LIMIT_INVALID: "Ce code n'a pas de capacité valide.",
          ALREADY_LINKED_TO_STRUCTURE: "Votre compte possède déjà un rattachement actif ou en attente avec cette Structure.",
          STRUCTURE_MEMBER_LIMIT_REACHED: "La Structure a atteint sa capacité de membres.",
          STRUCTURE_NOT_ACTIVE: "Cette Structure n'est pas actuellement autorisée à recevoir de nouveaux rattachements.",
        };
        return json({ error: code, message: messages[code] || "Impossible d'utiliser ce code.", pin_required: code === "PIN_REQUIRED" }, code === "INVALID_CODE" ? 400 : 409);
      }
      const organization = await getOrganization(sb, String(result.organization_id));
      await appendStructureAudit(sb, String(result.organization_id), session.userId, "learner", "structure_membership_requested", { membership_id: result.membership_id, code_id: result.code_id }, session.userId);
      return json({
        success: true,
        membership: { id: result.membership_id, status: "pending" },
        status: "pending",
        requires_validation: true,
        structure: organization ? mapStructure(organization) : null,
        message: "Votre demande de rattachement a été envoyée à la Structure pour vérification.",
      });
    }

    if (action === "cancel_membership") {
      const membershipId = String(body.membership_id || "");
      if (!membershipId) return json({ error: "MEMBERSHIP_REQUIRED" }, 400);
      const { data: membership, error: membershipError } = await sb.from("partner_code_users").select("id,user_id,organization_id,status").eq("id", membershipId).eq("user_id", session.userId).maybeSingle();
      if (membershipError) throw membershipError;
      if (!membership) return json({ error: "MEMBERSHIP_NOT_FOUND" }, 404);
      const { data: result, error } = await sb.rpc("oga_remove_structure_membership", {
        p_membership_id: membershipId,
        p_organization_id: membership.organization_id,
        p_actor_user_id: session.userId,
        p_comment: body.comment || "Annulation par l'apprenant",
      });
      if (error) throw error;
      if (!result?.ok) return json({ error: result?.error || "MEMBERSHIP_CANCEL_FAILED" }, 409);
      await appendStructureAudit(sb, String(membership.organization_id), session.userId, "learner", "structure_membership_cancelled", { membership_id: membershipId }, session.userId);
      return json({ success: true, status: "removed" });
    }

    // Programme 3 / GM2 — organisation, cohortes et formations obligatoires
    if (action === "gm2_overview") {
      const organizationId = String(body.structure_id || "");
      if (!(await requireStructureAccess(sb, session, organizationId, "can_manage_structure_users"))) return json({ error: "FORBIDDEN" }, 403);

      const [departmentsRes, groupsRes, cohortsRes, trainingsRes, assignmentsRes, membersRes] = await Promise.all([
        sb.from("structure_departments").select("*").eq("organization_id", organizationId).order("name"),
        sb.from("structure_groups").select("*").eq("organization_id", organizationId).order("name"),
        sb.from("structure_cohorts").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }),
        sb.from("structure_mandatory_trainings").select("*,courses(id,title,cover_image_url)").eq("organization_id", organizationId).order("created_at", { ascending: false }),
        sb.from("structure_training_assignments").select("*").eq("organization_id", organizationId),
        sb.from("partner_code_users").select("user_id,status,users(id,full_name,email)").eq("organization_id", organizationId).in("status", ["validated", "approved", "active"]),
      ]);
      for (const result of [departmentsRes, groupsRes, cohortsRes, trainingsRes, assignmentsRes, membersRes]) if (result.error) throw result.error;
      const userIds = (membersRes.data || []).map((m: any) => m.user_id);
      const { data: organizationRows, error: organizationError } = userIds.length
        ? await sb.from("structure_member_organization").select("*").eq("organization_id", organizationId).in("user_id", userIds)
        : { data: [], error: null } as any;
      if (organizationError) throw organizationError;
      const orgMap = new Map((organizationRows || []).map((row: any) => [row.user_id, row]));
      const assignments = assignmentsRes.data || [];
      const today = new Date().toISOString().slice(0, 10);
      const normalizedAssignments = assignments.map((row: any) => ({
        ...row,
        status: row.status !== "terminée" && row.due_at < today ? "en_retard" : row.status,
      }));
      return json({
        success: true,
        departments: departmentsRes.data || [],
        groups: groupsRes.data || [],
        cohorts: cohortsRes.data || [],
        trainings: trainingsRes.data || [],
        assignments: normalizedAssignments,
        members: (membersRes.data || []).map((m: any) => ({ ...m, organization: orgMap.get(m.user_id) || null })),
        indicators: {
          members: (membersRes.data || []).length,
          departments: (departmentsRes.data || []).length,
          groups: (groupsRes.data || []).length,
          cohorts: (cohortsRes.data || []).length,
          mandatory_trainings: (trainingsRes.data || []).filter((t: any) => t.status === "active").length,
          overdue: normalizedAssignments.filter((a: any) => a.status === "en_retard").length,
          completed: normalizedAssignments.filter((a: any) => a.status === "terminée").length,
        },
      });
    }

    if (action === "gm2_list_courses") {
      const organizationId = String(body.structure_id || "");
      if (!(await requireStructureAccess(sb, session, organizationId, "can_manage_structure_users"))) return json({ error: "FORBIDDEN" }, 403);
      const { data, error } = await sb.from("courses").select("id,title,short_description,cover_image_url,level,is_published").eq("is_published", true).order("title");
      if (error) throw error;
      return json({ success: true, courses: data || [] });
    }

    if (["gm2_save_department", "gm2_save_group", "gm2_save_cohort"].includes(action)) {
      const organizationId = String(body.structure_id || "");
      if (!(await requireStructureAccess(sb, session, organizationId, "can_manage_structure_users"))) return json({ error: "FORBIDDEN" }, 403);
      const name = String(body.name || "").trim();
      if (!name) return json({ error: "NAME_REQUIRED", message: "Le nom est obligatoire." }, 400);
      const table = action === "gm2_save_department" ? "structure_departments" : action === "gm2_save_group" ? "structure_groups" : "structure_cohorts";
      const payload: Record<string, unknown> = {
        organization_id: organizationId,
        name,
        description: String(body.description || "").trim() || null,
        updated_at: new Date().toISOString(),
      };
      if (!body.id) payload.created_by = session.userId;
      if (table === "structure_groups") payload.department_id = body.department_id || null;
      if (table === "structure_cohorts") {
        payload.starts_at = body.starts_at || null;
        payload.ends_at = body.ends_at || null;
        payload.status = body.status || "préparation";
      }
      const query = body.id
        ? sb.from(table).update(payload).eq("id", body.id).eq("organization_id", organizationId)
        : sb.from(table).insert(payload);
      const { data, error } = await query.select("*").single();
      if (error) throw error;
      return json({ success: true, item: data });
    }

    if (action === "gm2_delete_unit") {
      const organizationId = String(body.structure_id || "");
      if (!(await requireStructureAccess(sb, session, organizationId, "can_manage_structure_users"))) return json({ error: "FORBIDDEN" }, 403);
      const tableMap: Record<string, string> = { department: "structure_departments", group: "structure_groups", cohort: "structure_cohorts" };
      const table = tableMap[String(body.unit_type || "")];
      if (!table) return json({ error: "INVALID_UNIT_TYPE" }, 400);
      const { error } = await sb.from(table).delete().eq("id", body.id).eq("organization_id", organizationId);
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "gm2_update_member") {
      const organizationId = String(body.structure_id || "");
      if (!(await requireStructureAccess(sb, session, organizationId, "can_manage_structure_users"))) return json({ error: "FORBIDDEN" }, 403);
      const userId = String(body.user_id || "");
      if (!userId) return json({ error: "USER_REQUIRED" }, 400);
      const { data: membership } = await sb.from("partner_code_users").select("id").eq("organization_id", organizationId).eq("user_id", userId).in("status", ["validated", "approved", "active"]).maybeSingle();
      if (!membership) return json({ error: "MEMBER_NOT_FOUND" }, 404);
      const { data, error } = await sb.from("structure_member_organization").upsert({
        organization_id: organizationId,
        user_id: userId,
        department_id: body.department_id || null,
        group_id: body.group_id || null,
        employee_reference: String(body.employee_reference || "").trim() || null,
        job_title: String(body.job_title || "").trim() || null,
        joined_at: body.joined_at || null,
        updated_by: session.userId,
        updated_at: new Date().toISOString(),
      }, { onConflict: "organization_id,user_id" }).select("*").single();
      if (error) throw error;
      if (Array.isArray(body.cohort_ids)) {
        const { data: orgCohorts } = await sb.from("structure_cohorts").select("id").eq("organization_id", organizationId);
        const allowed = new Set((orgCohorts || []).map((c: any) => c.id));
        await sb.from("structure_cohort_members").delete().eq("user_id", userId).in("cohort_id", [...allowed]);
        const rows = body.cohort_ids.filter((id: string) => allowed.has(id)).map((cohort_id: string) => ({ cohort_id, user_id: userId, added_by: session.userId }));
        if (rows.length) {
          const { error: cohortError } = await sb.from("structure_cohort_members").insert(rows);
          if (cohortError) throw cohortError;
        }
      }
      return json({ success: true, member: data });
    }

    if (action === "gm2_import_members") {
      const organizationId = String(body.structure_id || "");
      if (!(await requireStructureAccess(sb, session, organizationId, "can_manage_structure_users"))) return json({ error: "FORBIDDEN" }, 403);
      const rows = Array.isArray(body.rows) ? body.rows.slice(0, 1000) : [];
      const errors: any[] = [];
      let successful = 0;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i] || {};
        const email = String(row.email || "").trim().toLowerCase();
        if (!email) { errors.push({ line: i + 2, email, message: "Adresse e-mail manquante" }); continue; }
        const { data: user } = await sb.from("users").select("id,email").ilike("email", email).maybeSingle();
        if (!user) { errors.push({ line: i + 2, email, message: "Aucun compte Omnia correspondant" }); continue; }
        const { data: membership } = await sb.from("partner_code_users").select("id").eq("organization_id", organizationId).eq("user_id", user.id).in("status", ["validated", "approved", "active"]).maybeSingle();
        if (!membership) { errors.push({ line: i + 2, email, message: "Le compte n’est pas encore rattaché à la Structure" }); continue; }
        let departmentId = null;
        let groupId = null;
        if (String(row.departement || "").trim()) {
          const { data: dep, error: depError } = await sb.from("structure_departments").upsert({ organization_id: organizationId, name: String(row.departement).trim(), created_by: session.userId }, { onConflict: "organization_id,name" }).select("id").single();
          if (depError) throw depError;
          departmentId = dep.id;
        }
        if (String(row.groupe || "").trim()) {
          const { data: group, error: groupError } = await sb.from("structure_groups").upsert({ organization_id: organizationId, name: String(row.groupe).trim(), department_id: departmentId, created_by: session.userId }, { onConflict: "organization_id,name" }).select("id").single();
          if (groupError) throw groupError;
          groupId = group.id;
        }
        const { error: upsertError } = await sb.from("structure_member_organization").upsert({
          organization_id: organizationId,
          user_id: user.id,
          department_id: departmentId,
          group_id: groupId,
          employee_reference: String(row.reference || "").trim() || null,
          job_title: String(row.fonction || "").trim() || null,
          joined_at: row.date_arrivee || null,
          updated_by: session.userId,
          updated_at: new Date().toISOString(),
        }, { onConflict: "organization_id,user_id" });
        if (upsertError) { errors.push({ line: i + 2, email, message: upsertError.message }); continue; }
        successful++;
      }
      const { data: imported, error } = await sb.from("structure_member_imports").insert({
        organization_id: organizationId,
        imported_by: session.userId,
        file_name: String(body.file_name || "import.csv"),
        total_rows: rows.length,
        successful_rows: successful,
        failed_rows: errors.length,
        errors,
      }).select("*").single();
      if (error) throw error;
      return json({ success: true, import: imported, errors });
    }

    if (action === "gm2_create_mandatory_training") {
      const organizationId = String(body.structure_id || "");
      if (!(await requireStructureAccess(sb, session, organizationId, "can_manage_structure_users"))) return json({ error: "FORBIDDEN" }, 403);
      const courseId = String(body.course_id || "");
      const dueAt = String(body.due_at || "");
      if (!courseId || !dueAt) return json({ error: "COURSE_AND_DUE_DATE_REQUIRED", message: "La formation et la date limite sont obligatoires." }, 400);
      const { data: course } = await sb.from("courses").select("id,title").eq("id", courseId).eq("is_published", true).maybeSingle();
      if (!course) return json({ error: "COURSE_NOT_FOUND" }, 404);
      const targetType = String(body.target_type || "tous");
      const { data: training, error } = await sb.from("structure_mandatory_trainings").insert({
        organization_id: organizationId,
        course_id: courseId,
        title: String(body.title || course.title),
        target_type: targetType,
        target_id: body.target_id || null,
        starts_at: body.starts_at || null,
        due_at: dueAt,
        priority: body.priority || "normale",
        reminder_days: Array.isArray(body.reminder_days) ? body.reminder_days.map(Number).filter((n: number) => n >= 0) : [30, 7, 1],
        status: "active",
        created_by: session.userId,
      }).select("*").single();
      if (error) throw error;

      const { data: memberships } = await sb.from("partner_code_users").select("user_id").eq("organization_id", organizationId).in("status", ["validated", "approved", "active"]);
      let userIds = (memberships || []).map((m: any) => m.user_id);
      if (targetType === "département" || targetType === "groupe") {
        const column = targetType === "département" ? "department_id" : "group_id";
        const { data: targets } = await sb.from("structure_member_organization").select("user_id").eq("organization_id", organizationId).eq(column, body.target_id);
        userIds = (targets || []).map((m: any) => m.user_id);
      } else if (targetType === "cohorte") {
        const { data: targets } = await sb.from("structure_cohort_members").select("user_id").eq("cohort_id", body.target_id);
        userIds = (targets || []).map((m: any) => m.user_id);
      } else if (targetType === "membres") {
        const allowed = new Set(userIds);
        userIds = (Array.isArray(body.user_ids) ? body.user_ids : []).filter((id: string) => allowed.has(id));
      }
      userIds = [...new Set(userIds)];
      if (userIds.length) {
        const assignmentRows = userIds.map((user_id: string) => ({ mandatory_training_id: training.id, organization_id: organizationId, user_id, due_at: dueAt }));
        const { error: assignmentError } = await sb.from("structure_training_assignments").insert(assignmentRows);
        if (assignmentError) throw assignmentError;
        const enrollmentRows = userIds.map((user_id: string) => ({ user_id, course_id: courseId }));
        const { error: enrollmentError } = await sb.from("user_enrollments").upsert(enrollmentRows, { onConflict: "user_id,course_id", ignoreDuplicates: true });
        if (enrollmentError) throw enrollmentError;
      }
      return json({ success: true, training, assigned_count: userIds.length });
    }

    if (action === "gm2_change_training_status") {
      const organizationId = String(body.structure_id || "");
      if (!(await requireStructureAccess(sb, session, organizationId, "can_manage_structure_users"))) return json({ error: "FORBIDDEN" }, 403);
      const allowed = ["active", "suspendue", "terminée", "archivée"];
      const status = String(body.status || "");
      if (!allowed.includes(status)) return json({ error: "INVALID_STATUS" }, 400);
      const { data, error } = await sb.from("structure_mandatory_trainings").update({ status, updated_at: new Date().toISOString() }).eq("id", body.training_id).eq("organization_id", organizationId).select("*").single();
      if (error) throw error;
      return json({ success: true, training: data });
    }


    // Programme 3 / GM3 — suivi RH, conformité, CPD et cartographie des compétences
    if (action === "gm3_rh_dashboard") {
      const organizationId = String(body.structure_id || "");
      if (!(await requireStructureAccess(sb, session, organizationId, "can_manage_structure_users"))) return json({ error: "FORBIDDEN" }, 403);

      const [membersRes, orgRes, departmentsRes, groupsRes, cohortsRes, assignmentsRes] = await Promise.all([
        sb.from("partner_code_users").select("user_id,status,users(id,full_name,email)").eq("organization_id", organizationId).in("status", ["validated", "approved", "active"]),
        sb.from("structure_member_organization").select("*").eq("organization_id", organizationId),
        sb.from("structure_departments").select("id,name").eq("organization_id", organizationId).order("name"),
        sb.from("structure_groups").select("id,name,department_id").eq("organization_id", organizationId).order("name"),
        sb.from("structure_cohorts").select("id,name,status").eq("organization_id", organizationId).order("name"),
        sb.from("structure_training_assignments").select("*").eq("organization_id", organizationId),
      ]);
      for (const result of [membersRes, orgRes, departmentsRes, groupsRes, cohortsRes, assignmentsRes]) if (result.error) throw result.error;
      const cohortIds = (cohortsRes.data || []).map((row: any) => row.id);
      const cohortMembersRes = cohortIds.length
        ? await sb.from("structure_cohort_members").select("cohort_id,user_id").in("cohort_id", cohortIds)
        : { data: [], error: null } as any;
      if (cohortMembersRes.error) throw cohortMembersRes.error;

      const memberships = membersRes.data || [];
      const userIds = [...new Set(memberships.map((row: any) => row.user_id).filter(Boolean))];
      if (!userIds.length) return json({ success: true, indicators: { members: 0 }, members: [], departments: departmentsRes.data || [], groups: groupsRes.data || [], cohorts: cohortsRes.data || [], skills: [] });

      const [enrollmentsRes, progressRes, attemptsRes, certificatesRes, badgesRes, clrRes] = await Promise.all([
        sb.from("user_enrollments").select("user_id,course_id,enrolled_at,completed_at,courses(id,title,cpd_hours,calculated_duration_minutes)").in("user_id", userIds),
        sb.from("user_lesson_progress").select("user_id,course_id,time_spent_seconds,is_completed,quiz_score").in("user_id", userIds),
        sb.from("assessment_attempts").select("user_id,course_id,status,score,passed,time_spent_seconds,submitted_at").in("user_id", userIds),
        sb.from("certificates").select("user_id,course_id,course_title,cpd_hours,status,issued_at,expires_at,validity_status").in("user_id", userIds),
        sb.from("badge_awards").select("recipient_user_id,status,expires_at,badge_templates(name,achievement_type)").in("recipient_user_id", userIds),
        sb.from("clr_records").select("id,user_id").in("user_id", userIds),
      ]);
      for (const result of [enrollmentsRes, progressRes, attemptsRes, certificatesRes, badgesRes, clrRes]) if (result.error) throw result.error;

      const clrIds = (clrRes.data || []).map((row: any) => row.id);
      const achievementsRes = clrIds.length
        ? await sb.from("clr_achievements").select("clr_record_id,title,section,status,payload").in("clr_record_id", clrIds).eq("status", "active")
        : { data: [], error: null } as any;
      if (achievementsRes.error) throw achievementsRes.error;

      const departments = departmentsRes.data || [];
      const groups = groupsRes.data || [];
      const departmentMap = new Map(departments.map((row: any) => [row.id, row.name]));
      const groupMap = new Map(groups.map((row: any) => [row.id, row.name]));
      const organizationMap = new Map((orgRes.data || []).map((row: any) => [row.user_id, row]));
      const cohortMap = new Map<string, string[]>();
      for (const row of cohortMembersRes.data || []) cohortMap.set(row.user_id, [...(cohortMap.get(row.user_id) || []), row.cohort_id]);
      const clrById = new Map((clrRes.data || []).map((row: any) => [row.id, row.user_id]));

      const today = new Date();
      const round = (value: number, digits = 1) => Number(value.toFixed(digits));
      const memberRows = memberships.map((membership: any) => {
        const user = Array.isArray(membership.users) ? membership.users[0] : membership.users;
        const userId = membership.user_id;
        const organization = organizationMap.get(userId) || {};
        const enrollments = (enrollmentsRes.data || []).filter((row: any) => row.user_id === userId);
        const progress = (progressRes.data || []).filter((row: any) => row.user_id === userId);
        const attempts = (attemptsRes.data || []).filter((row: any) => row.user_id === userId && row.score !== null);
        const certificates = (certificatesRes.data || []).filter((row: any) => row.user_id === userId);
        const validCertificates = certificates.filter((row: any) => !["revoque", "revoked"].includes(String(row.status)) && row.validity_status !== "revoked" && (!row.expires_at || new Date(row.expires_at) >= today));
        const expiredCertificates = certificates.filter((row: any) => row.expires_at && new Date(row.expires_at) < today).length;
        const badges = (badgesRes.data || []).filter((row: any) => row.recipient_user_id === userId && row.status === "awarded" && (!row.expires_at || new Date(row.expires_at) >= today));
        const assignments = (assignmentsRes.data || []).filter((row: any) => row.user_id === userId);
        const overdueAssignments = assignments.filter((row: any) => row.status !== "terminée" && row.status !== "dispensée" && new Date(`${row.due_at}T23:59:59`) < today).length;
        const completedAssignments = assignments.filter((row: any) => row.status === "terminée").length;
        const compliancePercent = assignments.length ? round((completedAssignments / assignments.length) * 100, 0) : 100;
        const completedEnrollments = enrollments.filter((row: any) => row.completed_at).length;
        const progressPercent = enrollments.length ? round((completedEnrollments / enrollments.length) * 100, 0) : 0;
        const averageScore = attempts.length ? round(attempts.reduce((sum: number, row: any) => sum + Number(row.score || 0), 0) / attempts.length, 1) : 0;
        const recordedSeconds = progress.reduce((sum: number, row: any) => sum + Number(row.time_spent_seconds || 0), 0) + attempts.reduce((sum: number, row: any) => sum + Number(row.time_spent_seconds || 0), 0);
        const certifiedMinutes = validCertificates.reduce((sum: number, row: any) => {
          const enrollment = enrollments.find((item: any) => item.course_id === row.course_id);
          const course = Array.isArray(enrollment?.courses) ? enrollment.courses[0] : enrollment?.courses;
          return sum + Number(course?.calculated_duration_minutes || 0);
        }, 0);
        const trainingHours = round(Math.max(recordedSeconds / 3600, certifiedMinutes / 60), 1);
        const cpdHours = round(validCertificates.reduce((sum: number, row: any) => sum + Number(row.cpd_hours || 0), 0), 1);
        return {
          user_id: userId,
          full_name: user?.full_name || "Membre",
          email: user?.email || "",
          department_id: organization.department_id || null,
          department_name: departmentMap.get(organization.department_id) || null,
          group_id: organization.group_id || null,
          group_name: groupMap.get(organization.group_id) || null,
          cohort_ids: cohortMap.get(userId) || [],
          employee_reference: organization.employee_reference || null,
          job_title: organization.job_title || null,
          enrollments: enrollments.length,
          completed_courses: completedEnrollments,
          progress_percent: progressPercent,
          average_score: averageScore,
          training_hours: trainingHours,
          cpd_hours: cpdHours,
          certificates: validCertificates.length,
          expired_certificates: expiredCertificates,
          badges: badges.length,
          mandatory_assignments: assignments.length,
          overdue_assignments: overdueAssignments,
          compliance_percent: compliancePercent,
        };
      });

      const skillCounts = new Map<string, Set<string>>();
      for (const badge of badgesRes.data || []) {
        if (badge.status !== "awarded") continue;
        const template = Array.isArray(badge.badge_templates) ? badge.badge_templates[0] : badge.badge_templates;
        const name = String(template?.name || "").trim();
        if (name) skillCounts.set(name, new Set([...(skillCounts.get(name) || []), badge.recipient_user_id]));
      }
      for (const achievement of achievementsRes.data || []) {
        if (!['competences', 'skills', 'competences_verifiees'].includes(String(achievement.section))) continue;
        const userId = clrById.get(achievement.clr_record_id);
        const name = String(achievement.title || achievement.payload?.skill_name || "").trim();
        if (userId && name) skillCounts.set(name, new Set([...(skillCounts.get(name) || []), userId]));
      }
      const skills = [...skillCounts.entries()].map(([name, users]) => ({ name, members: users.size, coverage_percent: round((users.size / userIds.length) * 100, 0) })).sort((a, b) => b.members - a.members);

      const total = memberRows.length || 1;
      const sums = (key: string) => memberRows.reduce((sum: number, row: any) => sum + Number(row[key] || 0), 0);
      return json({
        success: true,
        departments,
        groups,
        cohorts: cohortsRes.data || [],
        members: memberRows,
        skills,
        indicators: {
          members: memberRows.length,
          average_progress: round(sums("progress_percent") / total, 0),
          average_score: round(sums("average_score") / total, 1),
          training_hours: round(sums("training_hours"), 1),
          cpd_hours: round(sums("cpd_hours"), 1),
          certificates: sums("certificates"),
          badges: sums("badges"),
          overdue: sums("overdue_assignments"),
          expired_certificates: sums("expired_certificates"),
          compliance_percent: round(sums("compliance_percent") / total, 0),
          compliant: memberRows.filter((row: any) => row.compliance_percent === 100 && row.expired_certificates === 0).length,
          in_progress: memberRows.filter((row: any) => row.compliance_percent > 0 && row.compliance_percent < 100).length,
        },
      });
    }


    // Programme 3 / GM1 — commerce B2B et contrats (consolidé dans structure-manage)
    if (action === "catalogue") {
      if (isSuperAdmin(session)) return json({ error: "ACTION_RESERVED_FOR_STRUCTURE" }, 403);
      const requestedOrganizationId = String(body.organization_id || body.structure_id || "");
      const link = await managerLink(sb, session.userId, requestedOrganizationId || undefined);
      if (!link) return json({ error: "STRUCTURE_ACCESS_DENIED" }, 403);
      const organizationId = String(link.organization_id);
      const organization = await getOrganization(sb, organizationId);
      if (!organization || String(organization.status || "") !== "validated") {
        return json({ error: "STRUCTURE_NOT_ACTIVE", message: "La Structure doit être validée et active pour accéder aux services B2B." }, 403);
      }
      const { data: plans, error } = await sb.from("b2b_plan_templates")
        .select("*,b2b_plan_tiers(*),commerce_plans(id,name,subtitle,status,audience,commerce_plan_benefits(benefit_definition_id,value_json,display_label,commerce_benefit_definitions(name,unit_label)))")
        .eq("is_active", true)
        .order("created_at");
      if (error) throw error;
      return json({ success: true, plans: plans || [] });
    }

    if (["tableau_structure", "creer_devis", "modifier_devis", "signer_contrat", "envoyer_preuve", "demander_renouvellement"].includes(action)) {
      if (isSuperAdmin(session)) return json({ error: "ACTION_RESERVED_FOR_STRUCTURE" }, 403);
      const requestedOrganizationId = String(body.organization_id || body.structure_id || "");
      const link = await managerLink(sb, session.userId, requestedOrganizationId || undefined);
      if (!link) return json({ error: "STRUCTURE_ACCESS_DENIED" }, 403);
      const organizationId = String(link.organization_id);
      const organization = await getOrganization(sb, organizationId);
      if (!organization || String(organization.status || "") !== "validated") {
        return json({ error: "STRUCTURE_NOT_ACTIVE", message: "La Structure doit être validée et active pour accéder aux services B2B." }, 403);
      }
      if (!hasPermission(link, "can_manage_b2b_contracts")) {
        return json({ error: "PERMISSION_DENIED", message: "La gestion B2B et des contrats n’est pas autorisée pour ce membre de l’équipe Structure." }, 403);
      }

      if (action === "tableau_structure") {
        await refreshB2BEntitlements(sb, organizationId);
        const [quotes, contracts, proofs, invoices, renewals, proformas] = await Promise.all([
          sb.from("b2b_quotes").select("*,b2b_plan_templates(name,template_kind)").eq("organization_id", organizationId).order("created_at", { ascending: false }),
          sb.from("b2b_contracts").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }),
          sb.from("b2b_payment_proofs").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }),
          sb.from("b2b_invoices").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }),
          sb.from("b2b_renewals").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }),
          sb.from("b2b_proformas").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }),
        ]);
        for (const result of [quotes, contracts, proofs, invoices, renewals, proformas]) if (result.error) throw result.error;
        const signedProofs = await Promise.all((proofs.data || []).map(async (proof: any) => ({
          ...proof,
          signed_url: proof.document_path ? await signedB2BDocumentUrl(sb, proof.document_path) : proof.proof_url || null,
        })));
        return json({
          success: true,
          quotes: quotes.data || [], contracts: contracts.data || [], proofs: signedProofs,
          invoices: invoices.data || [], renewals: renewals.data || [], proformas: proformas.data || [],
        });
      }

      const computeQuote = async (planId: string, tierId: string | null, memberCount: number) => {
        const { data: plan, error: planError } = await sb.from("b2b_plan_templates").select("*").eq("id", planId).eq("is_active", true).maybeSingle();
        if (planError) throw planError;
        if (!plan) throw new ClientError("PLAN_NOT_FOUND", "Le modèle B2B sélectionné n'est plus disponible.", 404);
        let tier: Record<string, any> | null = null;
        if (tierId) {
          const { data, error } = await sb.from("b2b_plan_tiers").select("*").eq("id", tierId).eq("plan_id", plan.id).eq("is_active", true).maybeSingle();
          if (error) throw error;
          if (!data) throw new ClientError("TIER_NOT_FOUND", "Le palier sélectionné n'est plus disponible.", 404);
          tier = data;
          if (memberCount < Number(tier.min_members || 1) || (tier.max_members !== null && memberCount > Number(tier.max_members))) {
            throw new ClientError("MEMBER_COUNT_OUTSIDE_TIER", "Le nombre de membres ne correspond pas au palier sélectionné.");
          }
        }
        const subtotal = Number(plan.base_price || 0) + Number(tier?.fixed_price || 0) + Number(tier?.unit_price || 0) * memberCount;
        return { plan, tier, subtotal };
      };

      if (action === "creer_devis") {
        const planId = String(body.plan_id || "");
        const tierId = String(body.tier_id || "") || null;
        const memberCount = Math.max(1, Number(body.member_count || 1));
        if (!planId) return json({ error: "PLAN_REQUIRED" }, 400);
        const { plan, tier, subtotal } = await computeQuote(planId, tierId, memberCount);
        const quotePayload = {
          quote_number: generateCode("DEV"), organization_id: organizationId, plan_id: plan.id,
          tier_id: tier?.id || null, member_count: memberCount, billing_cycle: plan.billing_cycle || "annual",
          subtotal, discount_amount: 0, tax_amount: 0, total_amount: subtotal, currency: plan.currency || "XOF",
          valid_until: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
          notes: body.notes || null, status: "submitted", created_by: session.userId, submitted_at: new Date().toISOString(),
          plan_snapshot: { id: plan.id, name: plan.name, description: plan.description, template_kind: plan.template_kind, commerce_plan_id: plan.commerce_plan_id },
          pricing_snapshot: { base_price: plan.base_price, tier_id: tier?.id || null, tier_name: tier?.name || null, fixed_price: tier?.fixed_price || 0, unit_price: tier?.unit_price || 0, member_count: memberCount },
        };
        const { data, error } = await sb.from("b2b_quotes").insert(quotePayload).select("*").single();
        if (error) throw error;
        await appendB2BAudit(sb, organizationId, session.userId, "quote_submitted", "quote", data.id, { member_count: memberCount, total_amount: subtotal });
        return json({ success: true, quote: data });
      }

      if (action === "modifier_devis") {
        const quoteId = String(body.quote_id || "");
        const { data: existing, error: existingError } = await sb.from("b2b_quotes").select("*").eq("id", quoteId).eq("organization_id", organizationId).eq("status", "changes_requested").maybeSingle();
        if (existingError) throw existingError;
        if (!existing) return json({ error: "QUOTE_NOT_EDITABLE" }, 409);
        const planId = String(body.plan_id || existing.plan_id || "");
        const tierId = String(body.tier_id || existing.tier_id || "") || null;
        const memberCount = Math.max(1, Number(body.member_count || existing.member_count || 1));
        const { plan, tier, subtotal } = await computeQuote(planId, tierId, memberCount);
        const { data, error } = await sb.from("b2b_quotes").update({
          plan_id: plan.id, tier_id: tier?.id || null, member_count: memberCount,
          billing_cycle: plan.billing_cycle || existing.billing_cycle, subtotal, discount_amount: 0, tax_amount: 0,
          total_amount: subtotal, currency: plan.currency || existing.currency, notes: body.notes ?? existing.notes,
          status: "submitted", reviewed_by: null, reviewed_at: null, admin_comment: null, submitted_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          plan_snapshot: { id: plan.id, name: plan.name, description: plan.description, template_kind: plan.template_kind, commerce_plan_id: plan.commerce_plan_id },
          pricing_snapshot: { base_price: plan.base_price, tier_id: tier?.id || null, tier_name: tier?.name || null, fixed_price: tier?.fixed_price || 0, unit_price: tier?.unit_price || 0, member_count: memberCount },
        }).eq("id", quoteId).select("*").single();
        if (error) throw error;
        await appendB2BAudit(sb, organizationId, session.userId, "quote_resubmitted", "quote", quoteId, { member_count: memberCount });
        return json({ success: true, quote: data });
      }

      if (action === "signer_contrat") {
        const contractId = String(body.contract_id || "");
        const signatoryName = String(body.signatory_name || "").trim();
        if (body.accept_terms !== true || !signatoryName) return json({ error: "SIGNATURE_CONFIRMATION_REQUIRED" }, 400);
        const { data, error } = await sb.from("b2b_contracts").update({
          status: "signed_by_structure", structure_signed_by: session.userId, structure_signed_at: new Date().toISOString(),
          structure_signatory_name: signatoryName, structure_signature_note: String(body.signature_note || "").trim() || null,
          updated_at: new Date().toISOString(),
        }).eq("id", contractId).eq("organization_id", organizationId).eq("status", "sent").select("*").maybeSingle();
        if (error) throw error;
        if (!data) return json({ error: "CONTRACT_NOT_FOUND_OR_NOT_SIGNABLE" }, 404);
        await appendB2BAudit(sb, organizationId, session.userId, "contract_signed_by_structure", "contract", data.id, { signatory_name: signatoryName });
        return json({ success: true, contract: data });
      }

      if (action === "envoyer_preuve") {
        const contractId = String(body.contract_id || "");
        const { data: contract, error: contractError } = await sb.from("b2b_contracts").select("id,currency,status,total_amount").eq("id", contractId).eq("organization_id", organizationId).maybeSingle();
        if (contractError) throw contractError;
        if (!contract) return json({ error: "CONTRACT_NOT_FOUND" }, 404);
        if (!["signed_by_structure", "active"].includes(String(contract.status))) return json({ error: "CONTRACT_NOT_READY_FOR_PAYMENT" }, 409);
        if (!body.paid_on || Number(body.amount) <= 0) return json({ error: "INVALID_PAYMENT_PROOF" }, 400);
        const reference = String(body.reference || "").trim() || null;
        if (reference) {
          const { data: duplicate } = await sb.from("b2b_payment_proofs").select("id").eq("organization_id", organizationId).eq("reference", reference).in("status", ["submitted", "verified"]).limit(1).maybeSingle();
          if (duplicate) return json({ error: "PAYMENT_REFERENCE_ALREADY_USED" }, 409);
        }
        let documentPath = String(body.document_path || "").trim() || null;
        if (body.proof_base64) {
          const uploaded = await uploadB2BDocument(sb, organizationId, session.userId, body.proof_base64, body.proof_mime, body.proof_name);
          documentPath = uploaded.path;
        }
        if (!documentPath && !String(body.proof_url || "").trim()) return json({ error: "PAYMENT_PROOF_FILE_REQUIRED" }, 400);
        const { data, error } = await sb.from("b2b_payment_proofs").insert({
          contract_id: contract.id, organization_id: organizationId, amount: Number(body.amount),
          currency: body.currency || contract.currency || "XOF", paid_on: body.paid_on, reference,
          proof_url: String(body.proof_url || documentPath || ""), document_path: documentPath,
          submitted_by: session.userId, metadata: { submitted_from: "structure_b2b" },
        }).select("*").single();
        if (error) throw error;
        await appendB2BAudit(sb, organizationId, session.userId, "payment_proof_submitted", "payment_proof", data.id, { contract_id: contract.id, amount: Number(body.amount), reference });
        return json({ success: true, proof: data });
      }

      if (action === "demander_renouvellement") {
        const contractId = String(body.contract_id || "");
        const { data: contract, error: contractError } = await sb.from("b2b_contracts").select("*").eq("id", contractId).eq("organization_id", organizationId).eq("status", "active").maybeSingle();
        if (contractError) throw contractError;
        if (!contract) return json({ error: "ACTIVE_CONTRACT_REQUIRED" }, 409);
        const { data: openRenewal } = await sb.from("b2b_renewals").select("id").eq("contract_id", contract.id).in("status", ["requested", "under_review", "approved"]).limit(1).maybeSingle();
        if (openRenewal) return json({ error: "RENEWAL_ALREADY_OPEN" }, 409);
        if (!body.requested_start || !body.requested_end || String(body.requested_end) < String(body.requested_start)) return json({ error: "INVALID_RENEWAL_DATES" }, 400);
        const { data, error } = await sb.from("b2b_renewals").insert({
          contract_id: contract.id, organization_id: organizationId, requested_start: body.requested_start,
          requested_end: body.requested_end, requested_member_count: Math.max(1, Number(body.requested_member_count || contract.member_limit || 1)),
          notes: body.notes || null, requested_by: session.userId,
        }).select("*").single();
        if (error) throw error;
        await appendB2BAudit(sb, organizationId, session.userId, "renewal_requested", "renewal", data.id, { contract_id: contract.id });
        return json({ success: true, renewal: data });
      }
    }

    if (["tableau_admin", "enregistrer_modele_b2b", "dupliquer_modele_b2b", "changer_statut_modele_b2b", "examiner_devis", "valider_contrat", "changer_statut_contrat", "examiner_preuve", "examiner_renouvellement"].includes(action)) {
      if (!isSuperAdmin(session)) return json({ error: "SUPER_ADMIN_REQUIRED" }, 403);

      if (action === "tableau_admin") {
        const [plans, commercePlans, quotes, contracts, proofs, invoices, renewals, proformas, auditRows] = await Promise.all([
          sb.from("b2b_plan_templates").select("*,b2b_plan_tiers(*),commerce_plans(id,name,status,audience)").order("created_at", { ascending: false }),
          sb.from("commerce_plans").select("id,name,subtitle,status,audience,commerce_plan_benefits(benefit_definition_id,value_json,display_label,commerce_benefit_definitions(name,unit_label))").eq("audience", "structure").order("display_order"),
          sb.from("b2b_quotes").select("*,partner_organizations(org_name),b2b_plan_templates(name)").order("created_at", { ascending: false }),
          sb.from("b2b_contracts").select("*,partner_organizations(org_name)").order("created_at", { ascending: false }),
          sb.from("b2b_payment_proofs").select("*,partner_organizations(org_name)").order("created_at", { ascending: false }),
          sb.from("b2b_invoices").select("*,partner_organizations(org_name)").order("created_at", { ascending: false }),
          sb.from("b2b_renewals").select("*,partner_organizations(org_name)").order("created_at", { ascending: false }),
          sb.from("b2b_proformas").select("*,partner_organizations(org_name)").order("created_at", { ascending: false }),
          sb.from("b2b_audit_log").select("*").order("created_at", { ascending: false }).limit(100),
        ]);
        for (const result of [plans, commercePlans, quotes, contracts, proofs, invoices, renewals, proformas, auditRows]) if (result.error) throw result.error;
        const signedProofs = await Promise.all((proofs.data || []).map(async (proof: any) => ({
          ...proof,
          signed_url: proof.document_path ? await signedB2BDocumentUrl(sb, proof.document_path) : proof.proof_url || null,
        })));
        return json({
          success: true, plans: plans.data || [], commerce_plans: commercePlans.data || [], quotes: quotes.data || [],
          contracts: contracts.data || [], proofs: signedProofs, invoices: invoices.data || [], renewals: renewals.data || [],
          proformas: proformas.data || [], audit: auditRows.data || [],
        });
      }

      if (action === "enregistrer_modele_b2b") {
        const rawId = String(body.id || "").trim();
        const { data: result, error } = await sb.rpc("oga_save_b2b_plan", {
          p_plan_id: rawId || null,
          p_name: String(body.name || "").trim(),
          p_description: String(body.description || "").trim(),
          p_template_kind: String(body.template_kind || "custom"),
          p_billing_cycle: String(body.billing_cycle || "annual"),
          p_currency: String(body.currency || "XOF").trim().toUpperCase(),
          p_base_price: Math.max(0, Number(body.base_price || 0)),
          p_commerce_plan_id: String(body.commerce_plan_id || "").trim() || null,
          p_terms_text: String(body.terms_text || "").trim(),
          p_is_active: body.is_active !== false,
          p_tiers: Array.isArray(body.tiers) ? body.tiers : [],
          p_actor_user_id: session.userId,
        });
        if (error) throw error;
        if (!result?.ok) return json({ error: result?.error || "B2B_PLAN_SAVE_FAILED" }, 400);
        const { data: saved, error: savedError } = await sb.from("b2b_plan_templates").select("*,b2b_plan_tiers(*)").eq("id", result.plan_id).single();
        if (savedError) throw savedError;
        return json({ success: true, plan: saved });
      }

      if (action === "dupliquer_modele_b2b") {
        const sourceId = String(body.plan_id || "");
        const { data: source, error } = await sb.from("b2b_plan_templates").select("*,b2b_plan_tiers(*)").eq("id", sourceId).maybeSingle();
        if (error) throw error;
        if (!source) return json({ error: "B2B_PLAN_NOT_FOUND" }, 404);
        const { data: copy, error: copyError } = await sb.from("b2b_plan_templates").insert({
          name: String(body.name || `${source.name} — copie`).trim(), description: source.description, template_kind: source.template_kind,
          billing_cycle: source.billing_cycle, currency: source.currency, base_price: source.base_price, commerce_plan_id: source.commerce_plan_id,
          terms_text: source.terms_text, metadata: source.metadata || {}, is_active: false, created_by: session.userId,
        }).select("*").single();
        if (copyError) throw copyError;
        const tiers = (source.b2b_plan_tiers || []).map((tier: any) => ({
          plan_id: copy.id, name: tier.name, min_members: tier.min_members, max_members: tier.max_members,
          unit_price: tier.unit_price, fixed_price: tier.fixed_price, benefits: tier.benefits || [], position: tier.position, is_active: tier.is_active,
        }));
        if (tiers.length) {
          const { error: tierError } = await sb.from("b2b_plan_tiers").insert(tiers);
          if (tierError) throw tierError;
        }
        await appendB2BAudit(sb, null, session.userId, "b2b_plan_duplicated", "plan", copy.id, { source_plan_id: source.id });
        return json({ success: true, plan: copy });
      }

      if (action === "changer_statut_modele_b2b") {
        const { data, error } = await sb.from("b2b_plan_templates").update({ is_active: body.is_active === true, updated_at: new Date().toISOString() }).eq("id", String(body.plan_id || "")).select("*").maybeSingle();
        if (error) throw error;
        if (!data) return json({ error: "B2B_PLAN_NOT_FOUND" }, 404);
        await appendB2BAudit(sb, null, session.userId, data.is_active ? "b2b_plan_activated" : "b2b_plan_paused", "plan", data.id);
        return json({ success: true, plan: data });
      }

      if (action === "examiner_devis") {
        const status = String(body.status || "");
        if (!["accepted", "rejected", "changes_requested"].includes(status)) return json({ error: "INVALID_STATUS" }, 400);
        const quoteId = String(body.quote_id || "");
        if (status !== "accepted") {
          const { data: quote, error } = await sb.from("b2b_quotes").update({
            status, reviewed_by: session.userId, reviewed_at: new Date().toISOString(),
            admin_comment: body.comment || null, updated_at: new Date().toISOString(),
          }).eq("id", quoteId).eq("status", "submitted").select("*").maybeSingle();
          if (error) throw error;
          if (!quote) return json({ error: "QUOTE_NOT_FOUND_OR_ALREADY_REVIEWED" }, 404);
          await appendB2BAudit(sb, quote.organization_id, session.userId, `quote_${status}`, "quote", quote.id, { comment: body.comment || null });
          return json({ success: true, quote });
        }

        const { data: current, error: currentError } = await sb.from("b2b_quotes")
          .select("*,b2b_plan_templates(commerce_plan_id,terms_text)")
          .eq("id", quoteId).eq("status", "submitted").maybeSingle();
        if (currentError) throw currentError;
        if (!current) return json({ error: "QUOTE_NOT_FOUND_OR_ALREADY_REVIEWED" }, 404);
        const subtotal = Math.max(0, Number(body.subtotal ?? current.subtotal ?? 0));
        const discount = Math.max(0, Number(body.discount_amount ?? current.discount_amount ?? 0));
        const tax = Math.max(0, Number(body.tax_amount ?? current.tax_amount ?? 0));
        const total = Math.max(0, Number(body.total_amount ?? (subtotal - discount + tax)));
        const startsOn = String(body.starts_on || new Date().toISOString().slice(0, 10));
        const endsOn = String(body.ends_on || new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10));
        const terms = String(body.terms || current.b2b_plan_templates?.terms_text || "").trim();
        const commercePlanId = String(current.b2b_plan_templates?.commerce_plan_id || "") || null;
        const benefitsSnapshot = await b2bBenefitsSnapshot(sb, commercePlanId);
        const { data: result, error } = await sb.rpc("oga_accept_b2b_quote", {
          p_quote_id: quoteId, p_admin_user_id: session.userId, p_subtotal: subtotal,
          p_discount: discount, p_tax: tax, p_total: total, p_starts_on: startsOn, p_ends_on: endsOn,
          p_terms: terms, p_title: String(body.title || `Contrat ${current.quote_number}`).trim(),
          p_payment_method: String(body.payment_method || "bank_transfer"), p_benefits_snapshot: benefitsSnapshot,
          p_due_on: String(body.due_on || current.valid_until || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)),
          p_comment: body.comment || null,
        });
        if (error) throw error;
        if (!result?.ok) return json({ error: result?.error || "QUOTE_ACCEPTANCE_FAILED" }, 409);
        return json({ success: true, ...result });
      }

      if (action === "valider_contrat") {
        const contractId = String(body.contract_id || "");
        const { data: result, error } = await sb.rpc("oga_finalize_b2b_contract", {
          p_contract_id: contractId, p_admin_user_id: session.userId, p_admin_comment: body.comment || null,
        });
        if (error) throw error;
        if (!result?.ok) return json({ error: result?.error || "CONTRACT_VALIDATION_FAILED" }, 409);
        return json({ success: true, ...result });
      }

      if (action === "changer_statut_contrat") {
        const contractId = String(body.contract_id || "");
        const targetStatus = String(body.status || "");
        if (targetStatus === "active") {
          const { data: result, error } = await sb.rpc("oga_finalize_b2b_contract", {
            p_contract_id: contractId, p_admin_user_id: session.userId, p_admin_comment: body.comment || null,
          });
          if (error) throw error;
          if (!result?.ok) return json({ error: result?.error || "CONTRACT_REACTIVATION_FAILED" }, 409);
          return json({ success: true, ...result });
        }
        if (!["suspended", "terminated"].includes(targetStatus)) return json({ error: "INVALID_CONTRACT_STATUS" }, 400);
        const patch: Record<string, unknown> = {
          status: targetStatus, status_reason: String(body.comment || "").trim() || null, updated_at: new Date().toISOString(),
        };
        if (targetStatus === "suspended") patch.suspended_at = new Date().toISOString();
        if (targetStatus === "terminated") patch.terminated_at = new Date().toISOString();
        const { data, error } = await sb.from("b2b_contracts").update(patch).eq("id", contractId).in("status", ["active", "suspended"]).select("*").maybeSingle();
        if (error) throw error;
        if (!data) return json({ error: "CONTRACT_STATUS_CHANGE_NOT_ALLOWED" }, 409);
        await refreshB2BEntitlements(sb, data.organization_id);
        await appendB2BAudit(sb, data.organization_id, session.userId, `contract_${targetStatus}`, "contract", data.id, { reason: body.comment || null });
        return json({ success: true, contract: data });
      }

      if (action === "examiner_preuve") {
        const status = String(body.status || "");
        if (!["verified", "rejected"].includes(status)) return json({ error: "INVALID_STATUS" }, 400);
        const { data: proof, error } = await sb.from("b2b_payment_proofs").update({
          status, reviewed_by: session.userId, reviewed_at: new Date().toISOString(), review_comment: body.comment || null,
        }).eq("id", String(body.proof_id || "")).eq("status", "submitted").select("*").maybeSingle();
        if (error) throw error;
        if (!proof) return json({ error: "PAYMENT_PROOF_NOT_FOUND_OR_ALREADY_REVIEWED" }, 404);
        await appendB2BAudit(sb, proof.organization_id, session.userId, `payment_proof_${status}`, "payment_proof", proof.id, { contract_id: proof.contract_id, amount: proof.amount });
        const { error: syncError } = await sb.rpc("oga_sync_b2b_payment_totals", { p_contract_id: proof.contract_id });
        if (syncError) throw syncError;
        let activation: any = null;
        if (status === "verified") {
          const { data: contract, error: contractError } = await sb.from("b2b_contracts").select("admin_signed_at,admin_signed_by").eq("id", proof.contract_id).single();
          if (contractError) throw contractError;
          if (contract.admin_signed_at && contract.admin_signed_by) {
            const { data: result, error: finalizeError } = await sb.rpc("oga_finalize_b2b_contract", {
              p_contract_id: proof.contract_id, p_admin_user_id: contract.admin_signed_by, p_admin_comment: "Activation après vérification du paiement",
            });
            if (finalizeError) throw finalizeError;
            activation = result;
          }
        }
        return json({ success: true, proof, activation });
      }

      if (action === "examiner_renouvellement") {
        const status = String(body.status || "");
        if (!["approved", "rejected", "under_review"].includes(status)) return json({ error: "INVALID_STATUS" }, 400);
        const renewalId = String(body.renewal_id || "");
        if (status !== "approved") {
          const { data, error } = await sb.from("b2b_renewals").update({
            status, reviewed_by: session.userId, reviewed_at: new Date().toISOString(),
            admin_comment: body.comment || null, updated_at: new Date().toISOString(),
          }).eq("id", renewalId).in("status", ["requested", "under_review"]).select("*").maybeSingle();
          if (error) throw error;
          if (!data) return json({ error: "RENEWAL_NOT_FOUND_OR_ALREADY_REVIEWED" }, 404);
          await appendB2BAudit(sb, data.organization_id, session.userId, `renewal_${status}`, "renewal", data.id, { comment: body.comment || null });
          return json({ success: true, renewal: data });
        }
        const { data: renewal, error: renewalError } = await sb.from("b2b_renewals").select("*,b2b_contracts(total_amount,title,terms,payment_method)").eq("id", renewalId).in("status", ["requested", "under_review"]).maybeSingle();
        if (renewalError) throw renewalError;
        if (!renewal) return json({ error: "RENEWAL_NOT_FOUND_OR_ALREADY_REVIEWED" }, 404);
        const previous = renewal.b2b_contracts;
        const { data: result, error } = await sb.rpc("oga_approve_b2b_renewal", {
          p_renewal_id: renewalId, p_admin_user_id: session.userId,
          p_total_amount: Math.max(0, Number(body.total_amount ?? previous?.total_amount ?? 0)),
          p_title: String(body.title || `${previous?.title || 'Contrat'} — renouvellement`).trim(),
          p_terms: String(body.terms || previous?.terms || "").trim(),
          p_payment_method: String(body.payment_method || previous?.payment_method || "bank_transfer"),
          p_due_on: String(body.due_on || renewal.requested_start), p_comment: body.comment || null,
        });
        if (error) throw error;
        if (!result?.ok) return json({ error: result?.error || "RENEWAL_APPROVAL_FAILED" }, 409);
        return json({ success: true, ...result });
      }
    }

    return json({ error: "UNKNOWN_ACTION", action }, 400);
  } catch (error) {
    console.error("structure-manage", error);
    if (error instanceof ClientError) {
      return json({ error: error.code, message: error.message }, error.status);
    }
    return json({
      error: "SERVER_ERROR",
      message: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});
