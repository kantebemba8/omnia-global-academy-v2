import type { ReactNode } from 'react';
import { ModerateurLayout } from '../ModerateurLayout';
import { StructureLayout } from '../StructureLayout';
import { DashboardLayout } from '../DashboardLayout';
import { AdminLayout } from '../AdminLayout';
import { getStoredUser, normalizePlatformRoles } from '../../lib/session';

type StoredUser = { roles?: string[] };

function SuperAdminProfileLayout({ children }: { children: ReactNode }) {
  return (
    <AdminLayout headerTitle="Mon compte" headerSubtitle="Profil interne Super-admin" contentClassName="bg-transparent">
      {children}
    </AdminLayout>
  );
}

export function ProfileRoleLayout({ children }: { children: ReactNode }) {
  const stored = getStoredUser<StoredUser>();
  const roles = normalizePlatformRoles(stored?.roles);

  if (roles.includes('super_admin')) return <SuperAdminProfileLayout>{children}</SuperAdminProfileLayout>;
  if (roles.includes('moderateur')) return <ModerateurLayout>{children}</ModerateurLayout>;
  if (roles.includes('structure') || roles.includes('gestionnaire_structure')) return <StructureLayout>{children}</StructureLayout>;
  if (roles.includes('organisateur')) return <DashboardLayout role="organisateur">{children}</DashboardLayout>;
  if (roles.includes('recruteur')) return <DashboardLayout role="recruteur">{children}</DashboardLayout>;
  if (roles.includes('coach')) return <DashboardLayout role="coach">{children}</DashboardLayout>;
  if (roles.includes('professeur')) return <DashboardLayout role="professeur">{children}</DashboardLayout>;
  return <DashboardLayout role="apprenant">{children}</DashboardLayout>;
}
