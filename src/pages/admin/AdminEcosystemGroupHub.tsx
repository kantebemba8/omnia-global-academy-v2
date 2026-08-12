import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';
import { ADMIN_ECOSYSTEMS } from '../../lib/adminNavigation';

export default function AdminEcosystemGroupHub() {
  const { ecosystemId = '', groupId = '' } = useParams();
  const ecosystem = ADMIN_ECOSYSTEMS.find(item => item.id === ecosystemId);
  const group = ecosystem?.groups.find(item => item.id === groupId);
  if (!ecosystem || !group) return <Navigate to="/admin/ecosystemes" replace />;
  const GroupIcon = group.icon;

  return (
    <AdminLayout headerTitle={`Omnia ${ecosystem.label} · ${group.label}`} headerSubtitle="Administration Super-admin">
      <section className="mx-auto max-w-[1180px] px-5 py-9 sm:px-6 lg:px-8 lg:py-12">
        <Link to={`/admin/ecosystemes/${ecosystem.id}`} className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-black transition hover:bg-black/[.03]" style={{ color: ecosystem.accent }}>
          <ArrowLeft size={17} /> Omnia {ecosystem.label}
        </Link>

        <div className="mt-5 border-b pb-6" style={{ borderColor: ecosystem.border }}>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ color: ecosystem.accent, background: ecosystem.soft }}><GroupIcon size={21} /></span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.16em]" style={{ color: ecosystem.accent }}>Administration Super-admin · Omnia {ecosystem.label}</p>
              <h1 className="mt-1 text-3xl font-black tracking-[-.035em] sm:text-4xl" style={{ color: ecosystem.accent }}>{group.label}</h1>
            </div>
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">Choisissez la fonction à administrer. Cette page remplace l’empilement des sous-menus sous l’en-tête.</p>
        </div>

        <nav className="mt-7 overflow-hidden rounded-[22px] border p-2" style={{ borderColor: ecosystem.accent, background: ecosystem.soft }} aria-label={`Sous-menus ${group.label}`}>
          {group.items.map((item, index) => {
            const Icon = item.icon;
            return (
              <Link key={item.path} to={item.path} className="group flex items-center gap-4 rounded-2xl px-5 py-4 transition sm:px-6" style={{ marginTop: index ? 6 : 0, background: '#FFFFFF' }}>
                <span className="h-10 w-1 shrink-0 rounded-full" style={{ background: ecosystem.accent }} />
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ color: ecosystem.accent, background: ecosystem.soft }}><Icon size={18} /></span>
                <span className="min-w-0 flex-1"><strong className="block text-sm font-black sm:text-base" style={{ color: ecosystem.accent }}>{item.label}</strong><span className="mt-1 block text-xs leading-5 text-slate-500 sm:text-sm">Ouvrir la fonction administrative</span></span>
                <ChevronRight size={18} className="shrink-0 transition-transform group-hover:translate-x-1" style={{ color: ecosystem.accent }} />
              </Link>
            );
          })}
        </nav>
      </section>
    </AdminLayout>
  );
}
