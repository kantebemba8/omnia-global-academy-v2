import type { ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';
import { ADMIN_ECOSYSTEMS } from '../../lib/adminNavigation';
import type { EcosystemId } from '../../lib/ecosystemRegistry';
import { EcosystemConnectedShell, type EcosystemNavGroup } from './EcosystemShell';

type Props = {
  ecosystem: EcosystemId;
  navigation: EcosystemNavGroup[];
  search?: ReactNode;
  children: ReactNode;
};

export default function SuperAdminEcosystemLayout({ ecosystem, navigation, search, children }: Props) {
  const adminEcosystem = ADMIN_ECOSYSTEMS.find(item => item.id === ecosystem);
  const adminGroup: EcosystemNavGroup | null = adminEcosystem ? {
    id: 'administration-super-admin',
    label: 'Administration',
    path: adminEcosystem.entryPath,
    description: `Piloter Omnia ${adminEcosystem.label} avec les outils réservés au Super-admin.`,
    icon: ShieldCheck,
    children: adminEcosystem.groups.map(group => ({
      label: group.label,
      path: `/admin/ecosystemes/${adminEcosystem.id}/${group.id}`,
      description: `${group.items.length} fonction${group.items.length > 1 ? 's' : ''} de gestion`,
    })),
  } : null;

  const adminNavigation = adminGroup
    ? [...navigation.filter(group => group.id !== adminGroup.id), adminGroup]
    : navigation;

  return (
    <EcosystemConnectedShell
      ecosystem={ecosystem}
      audienceLabel="Super-admin"
      navigation={adminNavigation}
      search={search}
      dashboardPath="/admin/dashboard"
    >
      {children}
    </EcosystemConnectedShell>
  );
}
