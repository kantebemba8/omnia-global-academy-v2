import { ReactNode } from 'react';
import { DashboardLayout } from './DashboardLayout';
import { ADMIN_NAV_GROUPS } from '../lib/adminNavigation';

export function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardLayout role="super_admin" navItems={ADMIN_NAV_GROUPS}>
      {children}
    </DashboardLayout>
  );
}
