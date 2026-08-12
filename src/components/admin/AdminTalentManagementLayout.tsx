import type { ReactNode } from 'react';
import { Activity, BarChart3, ExternalLink, LayoutDashboard, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { AdminLayout } from '../AdminLayout';
import ContextualHeaderSearch, { type ContextualHeaderSearchItem } from '../ContextualHeaderSearch';
import { getEcosystem } from '../../lib/ecosystemRegistry';

const TALENT = getEcosystem('talent');

const NAV_ITEMS = [
  { hash: 'overview', label: 'Vue d’ensemble', icon: LayoutDashboard },
  { hash: 'recruteurs', label: 'Recruteurs', icon: UsersRound },
  { hash: 'statistiques', label: 'Statistiques', icon: BarChart3 },
  { hash: 'activite', label: 'Activité & contacts', icon: Activity },
];

type Props = {
  children: ReactNode;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchItems?: ContextualHeaderSearchItem[];
};

export default function AdminTalentManagementLayout({ children, searchValue, onSearchChange, searchItems = [] }: Props) {
  const [activeSection, setActiveSection] = useState('overview');

  function goTo(hash: string) {
    setActiveSection(hash);
    requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  const contextualItems: ContextualHeaderSearchItem[] = [
    ...NAV_ITEMS.map(item => ({
      id: `section-${item.hash}`,
      label: item.label,
      description: 'Section de gestion Omnia Talent',
      onSelect: () => goTo(item.hash),
    })),
    ...searchItems,
  ];

  return (
    <AdminLayout
      headerTitle="Gestion Omnia Talent"
      headerSubtitle="Recruteurs, activité et statistiques"
      headerSearch={<ContextualHeaderSearch items={contextualItems} placeholder="Rechercher un recruteur ou une section..." value={searchValue} onChange={onSearchChange} />}
      headerActions={<Link to="/talent" className="hidden items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-[#002050] hover:bg-slate-50 sm:inline-flex"><ExternalLink size={16} /> Voir Omnia Talent</Link>}
      contentClassName="bg-transparent"
    >
      <div className="border-b" style={{ borderColor: TALENT.border, background: TALENT.panel }}>
        <nav className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 py-2 md:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Sections de gestion Omnia Talent">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const active = activeSection === item.hash;
            return (
              <button
                key={item.hash}
                type="button"
                onClick={() => goTo(item.hash)}
                className="inline-flex min-h-9 min-w-max items-center gap-2 rounded-lg border px-3 text-xs font-bold transition"
                style={active
                  ? { borderColor: TALENT.accent, background: TALENT.soft, color: '#002050' }
                  : { borderColor: 'transparent', color: '#64748B' }}
              >
                <Icon size={14} style={{ color: active ? TALENT.accent : '#94A3B8' }} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>
      {children}
    </AdminLayout>
  );
}
