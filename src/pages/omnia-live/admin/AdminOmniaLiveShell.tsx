import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Radio } from 'lucide-react';
import { AdminLayout } from '../../../components/AdminLayout';

export default function AdminOmniaLiveShell({ children, title, subtitle }: { children: ReactNode; title: string; subtitle?: string }) {
  const actions = (
    <div className="hidden items-center gap-2 sm:flex">
      <Link to="/omnia-live" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-[#002050] hover:bg-slate-50"><Radio size={15} /> Voir Omnia Live</Link>
      <Link to="/admin/omnia-live/creer" className="rounded-xl bg-[#6556B5] px-3 py-2 text-sm font-semibold text-white">Créer un Live</Link>
    </div>
  );

  return (
    <AdminLayout
      headerTitle={title}
      headerSubtitle={subtitle || 'Gestion Omnia Live'}
      headerActions={actions}
      contentClassName="bg-transparent"
    >
      <div className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8">{children}</div>
    </AdminLayout>
  );
}
