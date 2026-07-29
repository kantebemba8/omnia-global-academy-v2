import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

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
  return (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
}

function randomPart(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function generateCode(prefix = "OGA") {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${randomPart(4)}`;
}

function generatePin() {
  return Math.floor(1000 + Math.random() * 9000).toString();
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

function isBenefitRow(row: Record<string, any>) {
  return codeMeta(row).__omnia_kind === "structure_benefit";
}

function mapCode(row: Record<string, any>) {
  const meta = codeMeta(row);
  const type = meta.code_type || "rattachement_simple";
  const expired = row.expires_at && Date.parse(row.expires_at) < Date.now();
  return {
    ...row,
    id: row.id,
    structure_id: row.organization_id,
    code_name: row.code_name || "Code structure",
    code_value: row.code,
    code_type: type,
    type_label: CODE_TYPE_LABELS[type] || type,
    description: meta.description || "",
    max_uses: Number(row.max_users || 0),
    used_count: Number(row.used_count || 0),
    requires_manual_validation: !!row.requires_manual_validation,
    pin: row.pin || "",
    status: expired ? "expired" : (CODE_STATUS_TO_UI[row.status] ?? row.status ?? "draft"),
    admin_comment: meta.admin_comment || row.refusal_reason || null,
  };
}

function mapBenefit(row: Record<string, any>) {
  const meta = codeMeta(row);
  const storedStatus = meta.benefit_status || CODE_STATUS_TO_UI[row.status] || row.status || "draft";
  return {
    id: row.id,
    structure_id: row.organization_id,
    benefit_name: meta.benefit_name || row.code_name || "Avantage",
    benefit_type: meta.benefit_type || "autre",
    description: meta.description || "",
    eligibility_conditions: meta.eligibility_conditions || "",
    discount_percentage: Number(meta.discount_percentage || 0),
    max_beneficiaries: Number(meta.max_beneficiaries || row.max_users || 0),
    starts_at: meta.starts_at || null,
    ends_at: meta.ends_at || row.expires_at || null,
    structure_comment: meta.structure_comment || "",
    free_access: !!meta.free_access,
    omnia_career_access: !!meta.omnia_career_access,
    cv_token_bonus: Number(meta.cv_token_bonus || 0),
    status: storedStatus,
    admin_comment: meta.admin_comment || row.refusal_reason || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
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
    .neq("status", "retire");
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

async function requireStructureAccess(
  sb: ReturnType<typeof createClient>,
  session: { userId: string; roles: string[] },
  organizationId: string,
  permission?: string,
) {
  if (session.roles.includes("super_admin")) return true;
  const link = await managerLink(sb, session.userId, organizationId);
  return hasPermission(link, permission);
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
  const { data: manager } = await sb.from("partner_managers").select("user_id").eq("organization_id", organizationId).eq("is_primary", true).neq("status", "retire").maybeSingle();
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
        return json({ error: "MISSING_REQUIRED_FIELDS" }, 400);
      }

      const existingLink = await managerLink(sb, session.userId);
      if (existingLink) return json({ error: "STRUCTURE_ALREADY_EXISTS" }, 409);

      const { data: organization, error } = await sb.from("partner_organizations").insert({
        org_name: String(body.name).trim(),
        org_type: String(body.structure_type).trim(),
        country: body.country || "ML",
        city: body.city || null,
        address: body.address || null,
        phone: body.phone || null,
        email: body.professional_email || null,
        website: body.website || null,
        description: body.description || null,
        main_need: body.objective || null,
        logo_url: body.logo_url || null,
        justificatif_url: body.justificatif_url || null,
        contact_name: body.responsible_name || session.user?.full_name || null,
        contact_function: body.responsible_function || null,
        contact_email: body.responsible_email || session.user?.email || null,
        contact_phone: body.responsible_phone || null,
        status: "pending",
      }).select("*").single();
      if (error) throw error;

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
          can_request_structure_benefits: true,
          can_view_statistics: true,
          can_view_logs: true,
          can_manage_notifications: true,
          can_manage_settings: true,
        },
      });
      if (managerError) {
        await sb.from("partner_organizations").delete().eq("id", organization.id);
        throw managerError;
      }

      await addRole(sb, session.userId, "responsable_structure");
      await sb.from("user_roles").delete().eq("user_id", session.userId).in("role", ["etablissement_directeur", "etablissement_enseignant"]);

      return json({ success: true, structure: mapStructure(organization) });
    }

    if (action === "get_my_structure") {
      const link = await managerLink(sb, session.userId);
      if (!link) return json({ error: "NO_STRUCTURE" }, 404);
      const organization = await getOrganization(sb, String(link.organization_id));
      if (!organization) return json({ error: "STRUCTURE_NOT_FOUND" }, 404);
      return json({ success: true, structure: mapStructure(organization), my_permissions: link.permissions || {}, my_role: link.role_in_org });
    }

    if (action === "get_structure") {
      if (!isSuperAdmin(session)) return json({ error: "FORBIDDEN" }, 403);
      const organizationId = String(body.structure_id || "");
      const organization = await getOrganization(sb, organizationId);
      if (!organization) return json({ error: "STRUCTURE_NOT_FOUND" }, 404);
      return json({ success: true, structure: mapStructure(organization) });
    }

    if (action === "update_structure") {
      const organizationId = String(body.structure_id || "");
      if (!organizationId) return json({ error: "STRUCTURE_ID_REQUIRED" }, 400);
      if (!(await requireStructureAccess(sb, session, organizationId, "can_manage_structure_profile"))) {
        return json({ error: "FORBIDDEN" }, 403);
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
        logo_url: "logo_url",
        responsible_name: "contact_name",
        responsible_function: "contact_function",
        responsible_email: "contact_email",
        responsible_phone: "contact_phone",
      };
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const [input, column] of Object.entries(fieldMap)) {
        if (body[input] !== undefined) patch[column] = body[input] === "" ? null : body[input];
      }
      const { data, error } = await sb.from("partner_organizations").update(patch).eq("id", organizationId).select("*").single();
      if (error) throw error;
      return json({ success: true, structure: mapStructure(data) });
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
      const { data, error } = await query;
      if (error) throw error;
      return json({ success: true, structures: (data || []).map(mapStructure) });
    }

    if (action === "admin_pending_overview") {
      if (!isSuperAdmin(session)) return json({ error: "FORBIDDEN" }, 403);
      const [{ data: organizations }, { data: codeRows }] = await Promise.all([
        sb.from("partner_organizations").select("*").in("status", ["pending", "modification_requested"]),
        sb.from("partner_codes").select("*").in("status", ["pending"]),
      ]);
      const benefits = (codeRows || []).filter(isBenefitRow).map(mapBenefit);
      const codes = (codeRows || []).filter((row: any) => !isBenefitRow(row)).map(mapCode);
      return json({
        success: true,
        pending: {
          structures: (organizations || []).map(mapStructure),
          codes,
          benefits,
        },
      });
    }

    if (action === "admin_validate_structure") {
      if (!isSuperAdmin(session)) return json({ error: "FORBIDDEN" }, 403);
      const organizationId = String(body.structure_id || "");
      const decision = String(body.decision || "");
      if (!organizationId) return json({ error: "STRUCTURE_ID_REQUIRED" }, 400);
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
      }
      const { data, error } = await sb.from("partner_organizations").update(patch).eq("id", organizationId).select("*").single();
      if (error) throw error;
      if (["validate", "restore"].includes(decision)) {
        const { data: managers } = await sb.from("partner_managers").select("user_id").eq("organization_id", organizationId).eq("is_primary", true);
        for (const manager of managers || []) {
          await addRole(sb, String(manager.user_id), "responsable_structure");
          await sb.from("user_roles").delete().eq("user_id", manager.user_id).in("role", ["etablissement_directeur", "etablissement_enseignant"]);
        }
      }
      return json({ success: true, structure: mapStructure(data) });
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
      const { data: membership } = await sb.from("partner_code_users").select("*").eq("id", membershipId).eq("organization_id", organizationId).maybeSingle();
      if (!membership) return json({ error: "MEMBERSHIP_NOT_FOUND" }, 404);
      const newStatus = decision === "approve" ? "validated" : "rejected";
      if (decision === "approve") {
        const capacity = await structureCapacity(sb, organizationId, "structure_member_limit");
        if (capacity !== null) {
          const { count } = await sb.from("partner_code_users").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).in("status", ["validated", "approved", "active"]);
          if (Number(count || 0) >= capacity) return json({ error: "STRUCTURE_MEMBER_LIMIT_REACHED", message: "La capacité de membres prévue par l'abonnement de la Structure est atteinte." }, 409);
        }
      }
      const { error } = await sb.from("partner_code_users").update({ status: newStatus }).eq("id", membershipId);
      if (error) throw error;
      if (decision === "approve" && membership.code_id) {
        const { data: code } = await sb.from("partner_codes").select("used_count,advantages").eq("id", membership.code_id).maybeSingle();
        if (code) {
          await sb.from("partner_codes").update({ used_count: Number(code.used_count || 0) + 1 }).eq("id", membership.code_id);
          const amount = Number(code.advantages?.cv_tokens || 0);
          if (amount > 0) {
            const { data: learner } = await sb.from("users").select("cv_tokens").eq("id", membership.user_id).maybeSingle();
            const balance = Number(learner?.cv_tokens || 0) + amount;
            await sb.from("users").update({ cv_tokens: balance }).eq("id", membership.user_id);
          }
        }
      }
      return json({ success: true, status: decision === "approve" ? "approved" : "rejected" });
    }

    if (action === "list_team") {
      const organizationId = String(body.structure_id || "");
      if (!(await requireStructureAccess(sb, session, organizationId, "can_manage_structure_users"))) return json({ error: "FORBIDDEN" }, 403);
      const { data: rows, error } = await sb.from("partner_managers").select("*").eq("organization_id", organizationId).order("is_primary", { ascending: false });
      if (error) throw error;
      const ids = [...new Set((rows || []).map((r: any) => String(r.user_id)).filter(Boolean))];
      const { data: users } = ids.length ? await sb.from("users").select("id,full_name,email").in("id", ids) : { data: [] as any[] };
      const userMap = new Map((users || []).map((u: any) => [String(u.id), u]));
      const team = (rows || []).map((row: any) => {
        const user = userMap.get(String(row.user_id));
        const statusMap: Record<string, string> = { actif: "active", active: "active", invite: "invited", invited: "invited", inactif: "inactive", inactive: "inactive", suspendu: "suspended", suspended: "suspended", retire: "removed", removed: "removed" };
        return {
          ...row,
          invited_email: user?.email || "",
          invited_name: user?.full_name || "",
          internal_role: row.role_in_org || "lecture_seule",
          permissions_json: row.permissions || {},
          status: statusMap[row.status] || row.status,
          users: user || null,
        };
      });
      return json({ success: true, team });
    }

    if (action === "invite_team_member") {
      const organizationId = String(body.structure_id || "");
      if (!(await requireStructureAccess(sb, session, organizationId, "can_manage_structure_users"))) return json({ error: "FORBIDDEN" }, 403);
      const email = String(body.email || "").trim().toLowerCase();
      if (!email) return json({ error: "EMAIL_REQUIRED" }, 400);
      const managerCapacity = await structureCapacity(sb, organizationId, "structure_manager_limit");
      if (managerCapacity !== null) {
        const { count } = await sb.from("partner_managers").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).in("status", ["actif", "active", "invite", "invited"]);
        if (Number(count || 0) >= managerCapacity) return json({ error: "STRUCTURE_MANAGER_LIMIT_REACHED", message: "La limite de gestionnaires prévue par l'abonnement est atteinte." }, 409);
      }
      const { data: user } = await sb.from("users").select("id,full_name,email").ilike("email", email).maybeSingle();
      if (!user) return json({ error: "USER_ACCOUNT_REQUIRED", message: "Cette personne doit d'abord créer un compte Omnia avec cette adresse e-mail." }, 404);
      const permissions = body.permissions && typeof body.permissions === "object" ? body.permissions : {};
      const { data: member, error } = await sb.from("partner_managers").upsert({
        organization_id: organizationId,
        user_id: user.id,
        role_in_org: body.internal_role || "lecture_seule",
        is_primary: false,
        status: "actif",
        permissions,
      }, { onConflict: "organization_id,user_id" }).select("*").single();
      if (error) throw error;
      return json({ success: true, member: { ...member, invited_email: user.email, invited_name: user.full_name, internal_role: member.role_in_org, permissions_json: member.permissions, status: "active" } });
    }

    if (action === "remove_team_member") {
      const organizationId = String(body.structure_id || "");
      if (!(await requireStructureAccess(sb, session, organizationId, "can_manage_structure_users"))) return json({ error: "FORBIDDEN" }, 403);
      const memberId = String(body.member_id || "");
      const { data: row } = await sb.from("partner_managers").select("is_primary").eq("id", memberId).eq("organization_id", organizationId).maybeSingle();
      if (!row) return json({ error: "MEMBER_NOT_FOUND" }, 404);
      if (row.is_primary) return json({ error: "PRIMARY_MANAGER_CANNOT_BE_REMOVED" }, 403);
      const { error } = await sb.from("partner_managers").update({ status: "retire" }).eq("id", memberId).eq("organization_id", organizationId);
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "list_codes") {
      const organizationId = String(body.structure_id || "");
      if (!(await requireStructureAccess(sb, session, organizationId, "can_manage_structure_codes"))) return json({ error: "FORBIDDEN" }, 403);
      const { data, error } = await sb.from("partner_codes").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false });
      if (error) throw error;
      return json({ success: true, codes: (data || []).filter((row: any) => !isBenefitRow(row)).map(mapCode) });
    }

    if (action === "create_code") {
      const organizationId = String(body.structure_id || "");
      if (!(await requireStructureAccess(sb, session, organizationId, "can_manage_structure_codes"))) return json({ error: "FORBIDDEN" }, 403);
      const codeType = String(body.code_type || "rattachement_simple");
      const code = generateCode("OGA");
      const meta = {
        __omnia_kind: "structure_code",
        code_type: codeType,
        description: body.description || "",
        admin_comment: null,
      };
      const { data, error } = await sb.from("partner_codes").insert({
        organization_id: organizationId,
        created_by: session.userId,
        code_name: body.code_name || "Code structure",
        code,
        pin: String(body.pin || generatePin()),
        max_users: Number(body.max_uses || 100),
        expires_at: body.expires_at || null,
        advantages: meta,
        requires_manual_validation: body.requires_manual_validation ?? true,
        qr_code_enabled: true,
        status: codeType === "rattachement_simple" ? "validated" : "draft",
      }).select("*").single();
      if (error) throw error;
      return json({ success: true, code: mapCode(data) });
    }

    if (action === "submit_code") {
      const organizationId = String(body.structure_id || "");
      if (!(await requireStructureAccess(sb, session, organizationId, "can_manage_structure_codes"))) return json({ error: "FORBIDDEN" }, 403);
      const { data, error } = await sb.from("partner_codes").update({ status: "pending", submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", body.code_id).eq("organization_id", organizationId).select("*").single();
      if (error) throw error;
      return json({ success: true, code: mapCode(data) });
    }

    if (action === "admin_validate_code") {
      if (!isSuperAdmin(session)) return json({ error: "FORBIDDEN" }, 403);
      const codeId = String(body.code_id || "");
      const decision = String(body.decision || "");
      const { data: current } = await sb.from("partner_codes").select("*").eq("id", codeId).maybeSingle();
      if (!current || isBenefitRow(current)) return json({ error: "CODE_NOT_FOUND" }, 404);
      const statusMap: Record<string, string> = { activate: "validated", reject: "refused", suspend: "suspended", deactivate: "draft" };
      if (!statusMap[decision]) return json({ error: "INVALID_DECISION" }, 400);
      const meta = { ...codeMeta(current), admin_comment: body.admin_comment || null };
      const patch: Record<string, unknown> = { status: statusMap[decision], advantages: meta, updated_at: new Date().toISOString() };
      if (decision === "activate") {
        patch.validated_by = session.userId;
        patch.validated_at = new Date().toISOString();
      }
      if (decision === "reject") patch.refusal_reason = body.admin_comment || null;
      const { data, error } = await sb.from("partner_codes").update(patch).eq("id", codeId).select("*").single();
      if (error) throw error;
      return json({ success: true, code: mapCode(data) });
    }

    if (action === "use_code") {
      const codeValue = String(body.code_value || "").trim().toUpperCase();
      if (!codeValue) return json({ error: "CODE_REQUIRED" }, 400);
      const { data: code, error } = await sb.from("partner_codes").select("*").eq("code", codeValue).maybeSingle();
      if (error) throw error;
      if (!code || isBenefitRow(code)) return json({ error: "INVALID_CODE", message: "Code structure invalide." }, 400);
      if (code.pin && String(body.pin || "").trim() !== String(code.pin)) return json({ error: "INVALID_PIN", message: "Le PIN est incorrect." }, 400);
      if (!["validated", "active"].includes(String(code.status))) return json({ error: "CODE_NOT_ACTIVE", message: "Ce code n'est pas actif." }, 400);
      if (code.expires_at && Date.parse(code.expires_at) < Date.now()) return json({ error: "CODE_EXPIRED", message: "Ce code a expiré." }, 400);
      if (Number(code.max_users || 0) > 0 && Number(code.used_count || 0) >= Number(code.max_users)) return json({ error: "CODE_QUOTA_REACHED", message: "La limite d'utilisation de ce code est atteinte." }, 400);
      const { data: existing } = await sb.from("partner_code_users").select("id,status").eq("code_id", code.id).eq("user_id", session.userId).maybeSingle();
      if (existing) return json({ error: "ALREADY_LINKED", message: "Votre compte est déjà lié à ce code." }, 409);
      const needsValidation = !!code.requires_manual_validation;
      const { data: link, error: insertError } = await sb.from("partner_code_users").insert({
        code_id: code.id,
        user_id: session.userId,
        organization_id: code.organization_id,
        status: needsValidation ? "pending" : "validated",
        advantages_remaining: needsValidation ? {} : (code.advantages || {}),
        expires_at: code.expires_at || null,
      }).select("*").single();
      if (insertError) throw insertError;
      if (!needsValidation) await sb.from("partner_codes").update({ used_count: Number(code.used_count || 0) + 1 }).eq("id", code.id);
      const organization = await getOrganization(sb, String(code.organization_id));
      return json({
        success: true,
        membership: link,
        status: needsValidation ? "pending" : "approved",
        structure: organization ? mapStructure(organization) : null,
        message: needsValidation ? "Votre demande de rattachement a été envoyée à la Structure." : "Votre rattachement à la Structure est actif.",
      });
    }

    if (action === "list_benefits") {
      const organizationId = String(body.structure_id || "");
      if (!(await requireStructureAccess(sb, session, organizationId, "can_request_structure_benefits"))) return json({ error: "FORBIDDEN" }, 403);
      const { data, error } = await sb.from("partner_codes").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false });
      if (error) throw error;
      return json({ success: true, benefits: (data || []).filter(isBenefitRow).map(mapBenefit) });
    }

    if (action === "propose_benefit") {
      const organizationId = String(body.structure_id || "");
      if (!(await requireStructureAccess(sb, session, organizationId, "can_request_structure_benefits"))) return json({ error: "FORBIDDEN" }, 403);
      if (!String(body.benefit_name || "").trim()) return json({ error: "BENEFIT_NAME_REQUIRED" }, 400);
      const meta = {
        __omnia_kind: "structure_benefit",
        benefit_status: "pending_admin_validation",
        benefit_name: body.benefit_name,
        benefit_type: body.benefit_type || "autre",
        description: body.description || "",
        eligibility_conditions: body.eligibility_conditions || "",
        discount_percentage: Number(body.discount_percentage || 0),
        max_beneficiaries: Number(body.max_beneficiaries || 0),
        starts_at: body.starts_at || null,
        ends_at: body.ends_at || null,
        structure_comment: body.structure_comment || "",
        free_access: !!body.free_access,
        omnia_career_access: !!body.omnia_career_access,
        cv_token_bonus: Number(body.cv_token_bonus || 0),
        admin_comment: null,
      };
      const { data, error } = await sb.from("partner_codes").insert({
        organization_id: organizationId,
        created_by: session.userId,
        code_name: String(body.benefit_name),
        code: generateCode("BEN"),
        pin: generatePin(),
        max_users: Number(body.max_beneficiaries || 0) || 999999,
        expires_at: body.ends_at || null,
        advantages: meta,
        requires_manual_validation: true,
        qr_code_enabled: false,
        status: "pending",
      }).select("*").single();
      if (error) throw error;
      return json({ success: true, benefit: mapBenefit(data) });
    }

    if (action === "admin_validate_benefit") {
      if (!isSuperAdmin(session)) return json({ error: "FORBIDDEN" }, 403);
      const benefitId = String(body.benefit_id || "");
      const decision = String(body.decision || "");
      const { data: current } = await sb.from("partner_codes").select("*").eq("id", benefitId).maybeSingle();
      if (!current || !isBenefitRow(current)) return json({ error: "BENEFIT_NOT_FOUND" }, 404);
      const statusMap: Record<string, { db: string; ui: string }> = {
        validate: { db: "validated", ui: "validated" },
        activate: { db: "validated", ui: "active" },
        reject: { db: "refused", ui: "rejected" },
        suspend: { db: "suspended", ui: "suspended" },
        request_changes: { db: "draft", ui: "changes_requested" },
      };
      const target = statusMap[decision];
      if (!target) return json({ error: "INVALID_DECISION" }, 400);
      const meta = { ...codeMeta(current), benefit_status: target.ui, admin_comment: body.admin_comment || null };
      const patch: Record<string, unknown> = { status: target.db, advantages: meta, updated_at: new Date().toISOString() };
      if (decision === "activate" || decision === "validate") {
        patch.validated_by = session.userId;
        patch.validated_at = new Date().toISOString();
      }
      if (decision === "reject") patch.refusal_reason = body.admin_comment || null;
      const { data, error } = await sb.from("partner_codes").update(patch).eq("id", benefitId).select("*").single();
      if (error) throw error;
      return json({ success: true, benefit: mapBenefit(data) });
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
      const { data: plans, error } = await sb.from("b2b_plan_templates")
        .select("*,b2b_plan_tiers(*)")
        .eq("is_active", true)
        .order("created_at");
      if (error) throw error;
      return json({ success: true, plans: plans || [] });
    }

    if (["tableau_structure", "creer_devis", "signer_contrat", "envoyer_preuve", "demander_renouvellement"].includes(action)) {
      if (isSuperAdmin(session)) return json({ error: "ACTION_RESERVED_FOR_STRUCTURE" }, 403);
      const requestedOrganizationId = String(body.organization_id || body.structure_id || "");
      const link = await managerLink(sb, session.userId, requestedOrganizationId || undefined);
      if (!link) return json({ error: "STRUCTURE_ACCESS_DENIED" }, 403);
      const organizationId = String(link.organization_id);

      if (action === "tableau_structure") {
        const [quotes, contracts, proofs, invoices, renewals] = await Promise.all([
          sb.from("b2b_quotes").select("*,b2b_plan_templates(name)").eq("organization_id", organizationId).order("created_at", { ascending: false }),
          sb.from("b2b_contracts").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }),
          sb.from("b2b_payment_proofs").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }),
          sb.from("b2b_invoices").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }),
          sb.from("b2b_renewals").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }),
        ]);
        for (const result of [quotes, contracts, proofs, invoices, renewals]) if (result.error) throw result.error;
        return json({ success: true, quotes: quotes.data || [], contracts: contracts.data || [], proofs: proofs.data || [], invoices: invoices.data || [], renewals: renewals.data || [] });
      }

      if (action === "creer_devis") {
        const memberCount = Math.max(1, Number(body.member_count || 1));
        let tier: Record<string, any> | null = null;
        if (body.tier_id) {
          const { data, error } = await sb.from("b2b_plan_tiers").select("*").eq("id", String(body.tier_id)).eq("is_active", true).maybeSingle();
          if (error) throw error;
          tier = data;
          if (!tier) return json({ error: "TIER_NOT_FOUND" }, 404);
          if (body.plan_id && String(tier.plan_id) !== String(body.plan_id)) return json({ error: "TIER_PLAN_MISMATCH" }, 400);
          if (memberCount < Number(tier.min_members || 1) || (tier.max_members !== null && memberCount > Number(tier.max_members))) {
            return json({ error: "MEMBER_COUNT_OUTSIDE_TIER" }, 400);
          }
        }
        const { data: plan, error: planError } = await sb.from("b2b_plan_templates").select("id,billing_cycle,currency,base_price,is_active").eq("id", String(body.plan_id || "")).maybeSingle();
        if (planError) throw planError;
        if (!plan?.is_active) return json({ error: "PLAN_NOT_FOUND" }, 404);
        const subtotal = Number(plan.base_price || 0) + Number(tier?.fixed_price || 0) + Number(tier?.unit_price || 0) * memberCount;
        const { data, error } = await sb.from("b2b_quotes").insert({
          quote_number: generateCode("DEV"), organization_id: organizationId, plan_id: plan.id,
          tier_id: tier?.id || null, member_count: memberCount, billing_cycle: body.billing_cycle || plan.billing_cycle || "annual",
          subtotal, total_amount: subtotal, currency: body.currency || plan.currency || "XOF",
          valid_until: body.valid_until || null, notes: body.notes || null, status: "submitted", created_by: session.userId,
        }).select("*").single();
        if (error) throw error;
        return json({ success: true, quote: data });
      }

      if (action === "signer_contrat") {
        const { data, error } = await sb.from("b2b_contracts").update({
          status: "signed_by_structure", structure_signed_by: session.userId,
          structure_signed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }).eq("id", String(body.contract_id || "")).eq("organization_id", organizationId).in("status", ["draft", "sent"]).select("*").maybeSingle();
        if (error) throw error;
        if (!data) return json({ error: "CONTRACT_NOT_FOUND_OR_NOT_SIGNABLE" }, 404);
        return json({ success: true, contract: data });
      }

      if (action === "envoyer_preuve") {
        const { data: contract, error: contractError } = await sb.from("b2b_contracts").select("id,currency,status").eq("id", String(body.contract_id || "")).eq("organization_id", organizationId).maybeSingle();
        if (contractError) throw contractError;
        if (!contract) return json({ error: "CONTRACT_NOT_FOUND" }, 404);
        if (!body.proof_url || !body.paid_on || Number(body.amount) <= 0) return json({ error: "INVALID_PAYMENT_PROOF" }, 400);
        const { data, error } = await sb.from("b2b_payment_proofs").insert({
          contract_id: contract.id, organization_id: organizationId, amount: Number(body.amount),
          currency: body.currency || contract.currency || "XOF", paid_on: body.paid_on,
          reference: body.reference || null, proof_url: body.proof_url, submitted_by: session.userId,
        }).select("*").single();
        if (error) throw error;
        return json({ success: true, proof: data });
      }

      if (action === "demander_renouvellement") {
        const { data: contract, error: contractError } = await sb.from("b2b_contracts").select("id").eq("id", String(body.contract_id || "")).eq("organization_id", organizationId).maybeSingle();
        if (contractError) throw contractError;
        if (!contract) return json({ error: "CONTRACT_NOT_FOUND" }, 404);
        if (!body.requested_start || !body.requested_end || String(body.requested_end) < String(body.requested_start)) return json({ error: "INVALID_RENEWAL_DATES" }, 400);
        const { data, error } = await sb.from("b2b_renewals").insert({
          contract_id: contract.id, organization_id: organizationId, requested_start: body.requested_start,
          requested_end: body.requested_end, requested_member_count: Math.max(1, Number(body.requested_member_count || 1)),
          notes: body.notes || null, requested_by: session.userId,
        }).select("*").single();
        if (error) throw error;
        return json({ success: true, renewal: data });
      }
    }

    if (["tableau_admin", "examiner_devis", "valider_contrat", "examiner_preuve", "examiner_renouvellement"].includes(action)) {
      if (!isSuperAdmin(session)) return json({ error: "SUPER_ADMIN_REQUIRED" }, 403);

      if (action === "tableau_admin") {
        const [quotes, contracts, proofs, invoices, renewals] = await Promise.all([
          sb.from("b2b_quotes").select("*,partner_organizations(org_name),b2b_plan_templates(name)").order("created_at", { ascending: false }),
          sb.from("b2b_contracts").select("*,partner_organizations(org_name)").order("created_at", { ascending: false }),
          sb.from("b2b_payment_proofs").select("*,partner_organizations(org_name)").order("created_at", { ascending: false }),
          sb.from("b2b_invoices").select("*,partner_organizations(org_name)").order("created_at", { ascending: false }),
          sb.from("b2b_renewals").select("*,partner_organizations(org_name)").order("created_at", { ascending: false }),
        ]);
        for (const result of [quotes, contracts, proofs, invoices, renewals]) if (result.error) throw result.error;
        return json({ success: true, quotes: quotes.data || [], contracts: contracts.data || [], proofs: proofs.data || [], invoices: invoices.data || [], renewals: renewals.data || [] });
      }

      if (action === "examiner_devis") {
        const status = String(body.status || "");
        if (!["accepted", "rejected", "changes_requested"].includes(status)) return json({ error: "INVALID_STATUS" }, 400);
        const { data: quote, error } = await sb.from("b2b_quotes").update({
          status, reviewed_by: session.userId, reviewed_at: new Date().toISOString(),
          admin_comment: body.comment || null, updated_at: new Date().toISOString(),
        }).eq("id", String(body.quote_id || "")).in("status", ["submitted", "changes_requested"]).select("*").maybeSingle();
        if (error) throw error;
        if (!quote) return json({ error: "QUOTE_NOT_FOUND_OR_ALREADY_REVIEWED" }, 404);
        if (status === "accepted" && body.create_contract !== false) {
          const startsOn = body.starts_on || new Date().toISOString().slice(0, 10);
          const endsOn = body.ends_on || new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
          const { error: contractError } = await sb.from("b2b_contracts").insert({
            contract_number: generateCode("CTR"), quote_id: quote.id, organization_id: quote.organization_id,
            title: `Contrat ${quote.quote_number}`, terms: body.terms || "Conditions contractuelles validées par les parties.",
            starts_on: startsOn, ends_on: endsOn, total_amount: quote.total_amount, currency: quote.currency,
            status: "sent", created_by: session.userId,
          });
          if (contractError) throw contractError;
          const { error: convertedError } = await sb.from("b2b_quotes").update({ status: "converted", updated_at: new Date().toISOString() }).eq("id", quote.id);
          if (convertedError) throw convertedError;
        }
        return json({ success: true, quote });
      }

      if (action === "valider_contrat") {
        const { data, error } = await sb.from("b2b_contracts").update({
          status: "active", admin_signed_by: session.userId, admin_signed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }).eq("id", String(body.contract_id || "")).eq("status", "signed_by_structure").select("*").maybeSingle();
        if (error) throw error;
        if (!data) return json({ error: "CONTRACT_NOT_SIGNABLE" }, 409);
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
        if (status === "verified") {
          const { data: contract, error: contractError } = await sb.from("b2b_contracts").select("id,organization_id").eq("id", proof.contract_id).single();
          if (contractError) throw contractError;
          const { error: invoiceError } = await sb.from("b2b_invoices").insert({
            invoice_number: generateCode("FAC"), contract_id: contract.id, organization_id: contract.organization_id,
            amount: proof.amount, currency: proof.currency, status: "paid", created_by: session.userId,
          });
          if (invoiceError) throw invoiceError;
        }
        return json({ success: true, proof });
      }

      if (action === "examiner_renouvellement") {
        const status = String(body.status || "");
        if (!["approved", "rejected", "under_review"].includes(status)) return json({ error: "INVALID_STATUS" }, 400);
        const { data, error } = await sb.from("b2b_renewals").update({
          status, reviewed_by: session.userId, reviewed_at: new Date().toISOString(),
          admin_comment: body.comment || null, updated_at: new Date().toISOString(),
        }).eq("id", String(body.renewal_id || "")).select("*").maybeSingle();
        if (error) throw error;
        if (!data) return json({ error: "RENEWAL_NOT_FOUND" }, 404);
        return json({ success: true, renewal: data });
      }
    }

    return json({ error: "UNKNOWN_ACTION", action }, 400);
  } catch (error) {
    console.error("structure-manage", error);
    return json({
      error: "SERVER_ERROR",
      message: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});
