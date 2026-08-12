import type { ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '../AdminLayout';

export default function AdminCoachingManagementLayout({ children }: { children: ReactNode }) {
  return (
    <AdminLayout
      headerSubtitle="Gestion Omnia Coaching"
      headerActions={(
        <Link to="/coaching" className="hidden items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-[#002050] hover:bg-slate-50 sm:inline-flex">
          <ExternalLink size={16} /> Voir Omnia Coaching
        </Link>
      )}
      contentClassName="bg-transparent"
    >
      {children}
    </AdminLayout>
  );
}
