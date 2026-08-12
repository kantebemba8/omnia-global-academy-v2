import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';
import { ADMIN_NAV_GROUPS } from '../../lib/adminNavigation';

const SECTION_META: Record<string, { groupId: string; eyebrow: string; description: string }> = {
  'utilisateurs-acces': {
    groupId: 'users-access',
    eyebrow: 'Utilisateurs, équipe & structures',
    description: 'Gérez les comptes, les accès, les équipes de modération et les structures depuis un espace unique.',
  },
  'commerce-finance': {
    groupId: 'commerce-finance',
    eyebrow: 'Commerce, revenus & contrats',
    description: 'Pilotez les paramètres commerciaux, la monétisation, les retraits et les relations B2B de la plateforme.',
  },
  'plateforme-gouvernance': {
    groupId: 'platform-governance',
    eyebrow: 'Identité, contenus & gouvernance',
    description: 'Centralisez les réglages transversaux de la plateforme, son identité publique et ses traductions.',
  },
};

export default function AdminSectionHub() {
  const { sectionId = '' } = useParams();
  const meta = SECTION_META[sectionId];
  if (!meta) return <Navigate to="/admin/dashboard" replace />;
  const group = ADMIN_NAV_GROUPS.find(item => item.id === meta.groupId);
  if (!group) return <Navigate to="/admin/dashboard" replace />;
  const GroupIcon = group.icon;

  return (
    <AdminLayout headerTitle={group.label} headerSubtitle="Omnia Administration">
      <div className="mx-auto max-w-[1480px] px-4 py-7 md:px-6 lg:px-8 lg:py-10">
        <Link to="/admin/dashboard" className="inline-flex items-center gap-2 text-sm font-black text-[#002050] transition hover:text-[#BF8813]">
          <ArrowLeft size={16} /> Administration
        </Link>

        <section className="relative mt-5 overflow-hidden rounded-[30px] border border-[#DDE5F0] bg-[linear-gradient(120deg,#002050_0%,#123E72_58%,#F6F8FC_58%,#F6F8FC_100%)] shadow-[0_24px_70px_rgba(0,32,80,.13)]">
          <div className="grid min-h-[260px] lg:grid-cols-[1.12fr_.88fr]">
            <div className="px-6 py-8 text-white md:px-9 md:py-10">
              <p className="text-[11px] font-black uppercase tracking-[.18em] text-[#E9C876]">Omnia Administration</p>
              <div className="mt-5 flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-[#E9C876]"><GroupIcon size={22} /></span>
                <div>
                  <h1 className="text-3xl font-black tracking-[-.04em] md:text-4xl">{group.label}</h1>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-white/65">{meta.description}</p>
                </div>
              </div>
            </div>
            <div className="flex items-end px-6 py-7 md:px-9">
              <div className="w-full border-t border-slate-200 pt-5 lg:border-t-0 lg:border-l lg:pl-8">
                <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#BF8813]">{meta.eyebrow}</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">Choisissez une fonction. Chaque outil conserve sa route et sa logique métier existantes.</p>
              </div>
            </div>
          </div>
        </section>

        <nav className="mt-7 overflow-hidden rounded-[24px] border border-[#DDE5F0] bg-[#EEF3FA] p-2" aria-label={group.label}>
          {group.items.map((item, index) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className="group flex items-center gap-4 rounded-[18px] bg-white px-5 py-4 transition hover:bg-[#F9FBFE] sm:px-6"
                style={{ marginTop: index ? 7 : 0 }}
              >
                <span className="h-10 w-1 shrink-0 rounded-full bg-[#BF8813]" />
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F7F0DF] text-[#9B6B0B]"><Icon size={18} /></span>
                <span className="min-w-0 flex-1">
                  <strong className="block text-sm font-black text-[#002050] sm:text-base">{item.label}</strong>
                  <span className="mt-1 block text-xs text-slate-500">Ouvrir la fonction administrative</span>
                </span>
                <ArrowRight size={17} className="shrink-0 text-[#BF8813] transition-transform group-hover:translate-x-1" />
              </Link>
            );
          })}
        </nav>
      </div>
    </AdminLayout>
  );
}
