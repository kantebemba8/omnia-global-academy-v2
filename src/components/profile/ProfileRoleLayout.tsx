import type { ReactNode } from 'react';
import { ModerateurLayout } from '../ModerateurLayout';
import { StructureLayout } from '../StructureLayout';
import { DashboardLayout } from '../DashboardLayout';
import { DashboardTopbar } from '../DashboardTopbar';
import { RecruiterLayout } from '../talent/RecruiterLayout';
import CoachWorkspaceLayout from '../coaching/CoachWorkspaceLayout';
import OrganizerShell from '../../pages/omnia-live/organizer/OrganizerShell';
import { getStoredUser, normalizePlatformRoles } from '../../lib/session';

type StoredUser = { roles?: string[] };

function SuperAdminProfileLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[#F6F8FC]">
      <DashboardTopbar
        title="Mon profil"
        subtitle="Compte Super-admin"
        dashboardPath="/admin/dashboard"
        showBrand
        brandHref="/home"
      />
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#F6F8FC]">
        {children}
      </main>
    </div>
  );
}

export function ProfileRoleLayout({ children }: { children: ReactNode }) {
  const stored = getStoredUser<StoredUser>();
  const roles = normalizePlatformRoles(stored?.roles);

  if (roles.includes('super_admin')) return <SuperAdminProfileLayout>{children}</SuperAdminProfileLayout>;
  if (roles.includes('moderateur')) return <ModerateurLayout>{children}</ModerateurLayout>;
  if (roles.includes('structure') || roles.includes('recruteur_structure')) return <StructureLayout>{children}</StructureLayout>;
  if (roles.includes('organisateur')) return <OrganizerShell title="Mon profil" subtitle="Identité, visibilité et préférences">{children}</OrganizerShell>;
  if (roles.includes('recruteur')) return <RecruiterLayout title="Mon profil" subtitle="Identité et présence professionnelle">{children}</RecruiterLayout>;
  if (roles.includes('coach')) return <CoachWorkspaceLayout>{children}</CoachWorkspaceLayout>;
  if (roles.includes('professeur')) return <DashboardLayout role="professeur">{children}</DashboardLayout>;
  return <DashboardLayout role="apprenant">{children}</DashboardLayout>;
}
