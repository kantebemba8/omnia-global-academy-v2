import type { ReactNode } from 'react';
import { AdminLayout } from '../AdminLayout';

export default function AdminCredentialsManagementLayout({ children }: { children: ReactNode }) {
  return (
    <AdminLayout headerSubtitle="Badges & Learning Records" contentClassName="bg-transparent">
      {children}
    </AdminLayout>
  );
}
