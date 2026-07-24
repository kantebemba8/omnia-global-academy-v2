import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  BarChart3,
  ExternalLink,
  LayoutDashboard,
  Menu,
  UsersRound,
  X,
} from 'lucide-react';
import { useState } from 'react';

const BLUE = '#002050';
const GOLD = '#BF8813';

const NAV_ITEMS = [
  { hash: 'overview', label: 'Vue d’ensemble', icon: LayoutDashboard },
  { hash: 'recruteurs', label: 'Recruteurs', icon: UsersRound },
  { hash: 'statistiques', label: 'Statistiques', icon: BarChart3 },
  { hash: 'activite', label: 'Activité & contacts', icon: Activity },
];

export default function AdminTalentManagementLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  function goTo(hash: string) {
    setOpen(false);
    requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  const sidebar = (
    <aside className="flex h-full min-h-0 flex-col" style={{ background: BLUE }}>
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
        <button type="button" onClick={() => goTo('overview')} className="flex min-w-0 items-center gap-3 text-left">
          <img src="/omnia-sidebar-logo.png" alt="Omnia Talent" className="h-10 w-10 flex-shrink-0 object-contain" />
          <div className="min-w-0 font-bold leading-tight">
            <div className="truncate text-base text-white">Supervision Omnia</div>
            <div className="truncate text-base" style={{ color: GOLD }}>Talent</div>
          </div>
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-white/80 lg:hidden" aria-label="Fermer le menu"><X size={18} /></button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          return (
            <button key={item.hash} type="button" onClick={() => goTo(item.hash)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-white/80 transition hover:bg-white/5 hover:text-white">
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-3 py-4">
        <Link to="/talent" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold" style={{ color: GOLD }}>
          <ExternalLink size={18} /> Voir Omnia Talent
        </Link>
        <Link to="/admin/dashboard" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/80 hover:bg-white/5 hover:text-white">
          <ArrowLeft size={18} /> Retour au Dashboard
        </Link>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC]">
      <div className="hidden w-[270px] flex-shrink-0 lg:block">{sidebar}</div>
      {open && (
        <div className="fixed inset-0 z-[90] flex lg:hidden">
          <button type="button" className="fixed inset-0 bg-black/55" onClick={() => setOpen(false)} aria-label="Fermer le menu de supervision Talent" />
          <div className="relative z-10 h-full w-[280px] max-w-[88vw]">{sidebar}</div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold" style={{ color: BLUE }}>
            <Menu size={18} /> Supervision Omnia Talent
          </button>
        </div>
        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
