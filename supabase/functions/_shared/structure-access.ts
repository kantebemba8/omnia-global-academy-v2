export type ValidatedStructureAccess = {
  organizationId: string;
  organizationName: string | null;
  organizationStatus: string;
  isPrimary: boolean;
  permissions: Record<string, boolean>;
  roleInOrg: string | null;
};

function normalizedStatus(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export async function validatedStructureAccess(
  sb: any,
  userId: string,
  requestedOrganizationId = "",
): Promise<ValidatedStructureAccess | null> {
  if (!userId) return null;

  let managerQuery = sb
    .from("partner_managers")
    .select("organization_id,is_primary,status,permissions,role_in_org")
    .eq("user_id", userId)
    .in("status", ["actif", "active"])
    .order("is_primary", { ascending: false });

  if (requestedOrganizationId) {
    managerQuery = managerQuery.eq("organization_id", requestedOrganizationId);
  }

  const { data: manager, error: managerError } = await managerQuery.limit(1).maybeSingle();
  if (managerError) throw managerError;
  if (!manager?.organization_id) return null;

  const { data: organization, error: organizationError } = await sb
    .from("partner_organizations")
    .select("id,org_name,status")
    .eq("id", manager.organization_id)
    .maybeSingle();
  if (organizationError) throw organizationError;
  if (!organization?.id || normalizedStatus(organization.status) !== "validated") return null;

  return {
    organizationId: String(organization.id),
    organizationName: organization.org_name ? String(organization.org_name) : null,
    organizationStatus: String(organization.status),
    isPrimary: Boolean(manager.is_primary),
    permissions: manager.permissions && typeof manager.permissions === "object" && !Array.isArray(manager.permissions)
      ? manager.permissions as Record<string, boolean>
      : {},
    roleInOrg: manager.role_in_org ? String(manager.role_in_org) : null,
  };
}

export async function hasValidatedStructureAccess(
  sb: any,
  userId: string,
  requestedOrganizationId = "",
) {
  return Boolean(await validatedStructureAccess(sb, userId, requestedOrganizationId));
}
