import { ReactNode, useMemo } from 'react';
import { DashboardLayout } from './DashboardLayout';
import ContextualHeaderSearch from './ContextualHeaderSearch';
import { ADMIN_NAV_GROUPS } from '../lib/adminNavigation';

export function AdminLayout({ children }: { children: ReactNode }) {
  const searchItems = useMemo(
    () => ADMIN_NAV_GROUPS.flatMap(group => group.items.map(item => ({
      id: `${group.id}:${item.path}`,
      label: item.label,
      description: group.label,
      keywords: [group.label, item.label, 'administration', 'omnia'],
      path: item.path,
    }))),
    [],
  );

  return (
    <DashboardLayout
      role="super_admin"
      navGroups={ADMIN_NAV_GROUPS}
      dashboardPath="/admin/dashboard"
      headerSearch={(
        <ContextualHeaderSearch
          items={searchItems}
          placeholder="Rechercher dans l’administration..."
          ariaLabel="Rechercher une fonction administrative"
          maxResults={10}
        />
      )}
    >
      {children}
    </DashboardLayout>
  );
}
