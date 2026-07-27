import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
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

    return json({ error: "UNKNOWN_ACTION", action }, 400);
  } catch (error) {
    console.error("structure-manage", error);
    return json({
      error: "SERVER_ERROR",
      message: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});
