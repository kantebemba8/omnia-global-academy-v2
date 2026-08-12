import { ReactNode, useMemo } from 'react';
import { DashboardLayout } from './DashboardLayout';
import ContextualHeaderSearch from './ContextualHeaderSearch';
import { ADMIN_ECOSYSTEMS, ADMIN_NAV_GROUPS } from '../lib/adminNavigation';

interface Props {
  children: ReactNode;
  headerTitle?: string;
  headerSubtitle?: string;
  headerActions?: ReactNode;
  headerSearch?: ReactNode;
  contentClassName?: string;
}

export function AdminLayout({ children, headerTitle, headerSubtitle, headerActions, headerSearch, contentClassName }: Props) {
  const searchItems = useMemo(() => {
    const seen = new Set<string>();
    const items: Array<{ id: string; label: string; description: string; keywords: string[]; path: string }> = [];
    const push = (path: string, label: string, description: string, keywords: string[]) => {
      if (seen.has(path)) return;
      seen.add(path);
      items.push({ id: path, label, description, keywords, path });
    };

    ADMIN_NAV_GROUPS.forEach(group => group.items.forEach(item => {
      push(item.path, item.label, group.label, [group.label, item.label, 'administration', 'omnia']);
    }));

    ADMIN_ECOSYSTEMS.forEach(ecosystem => ecosystem.groups.forEach(group => group.items.forEach(item => {
      push(item.path, item.label, `Omnia ${ecosystem.label} · ${group.label}`, [ecosystem.label, group.label, item.label, 'administration']);
    })));

    return items;
  }, []);

  return (
    <DashboardLayout
      role="super_admin"
      navGroups={ADMIN_NAV_GROUPS}
      dashboardPath="/admin/dashboard"
      headerTitle={headerTitle}
      headerSubtitle={headerSubtitle}
      headerActions={headerActions}
      headerSearch={headerSearch || (
        <ContextualHeaderSearch
          items={searchItems}
          placeholder="Rechercher dans l’administration..."
          ariaLabel="Rechercher une fonction administrative"
          maxResults={10}
        />
      )}
      contentClassName={contentClassName}
    >
      {children}
    </DashboardLayout>
  );
}
