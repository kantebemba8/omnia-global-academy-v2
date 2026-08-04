import type { ReactNode } from 'react';
import { AdminLayout } from '../AdminLayout';
import { ModerateurLayout } from '../ModerateurLayout';
import { StructureLayout } from '../StructureLayout';
import { DashboardLayout } from '../DashboardLayout';
import { RecruiterLayout } from '../talent/RecruiterLayout';
import CoachWorkspaceLayout from '../coaching/CoachWorkspaceLayout';
import OrganizerShell from '../../pages/omnia-live/organizer/OrganizerShell';
import { getStoredUser, normalizePlatformRoles } from '../../lib/session';

type StoredUser = { roles?: string[] };

export function ProfileRoleLayout({ children }: { children: ReactNode }) {
  const stored = getStoredUser<StoredUser>();
  const roles = normalizePlatformRoles(stored?.roles);

  if (roles.includes('super_admin')) return <AdminLayout>{children}</AdminLayout>;
  if (roles.includes('moderateur')) return <ModerateurLayout>{children}</ModerateurLayout>;
  if (roles.includes('structure') || roles.includes('recruteur_structure')) return <StructureLayout>{children}</StructureLayout>;
  if (roles.includes('organisateur')) return <OrganizerShell title="Mon profil" subtitle="Identité, visibilité et préférences">{children}</OrganizerShell>;
  if (roles.includes('recruteur')) return <RecruiterLayout title="Mon profil" subtitle="Identité et présence professionnelle">{children}</RecruiterLayout>;
  if (roles.includes('coach')) return <CoachWorkspaceLayout>{children}</CoachWorkspaceLayout>;
  if (roles.includes('professeur')) return <DashboardLayout role="professeur">{children}</DashboardLayout>;
  return <DashboardLayout role="apprenant">{children}</DashboardLayout>;
}
