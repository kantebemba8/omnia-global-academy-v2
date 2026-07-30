import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarClock,
  CircleDollarSign,
  ClipboardList,
  ExternalLink,
  FolderCog,
  LayoutDashboard,
  Menu,
  Package,
  Settings2,
  ShieldAlert,
  Star,
  UserRoundCheck,
  UsersRound,
  X,
} from 'lucide-react';
import { useState } from 'react';

const BLUE = '#002050';
const GOLD = '#BF8813';

const NAV_ITEMS = [
  { path: '/admin/coaching', label: 'Vue d’ensemble', icon: LayoutDashboard, exact: true },
  { path: '/admin/coaching/candidatures', label: 'Candidatures', icon: ClipboardList },
  { path: '/admin/coaching/coachs', label: 'Coachs', icon: UserRoundCheck },
  { path: '/admin/coaching/offres', label: 'Offres', icon: Settings2 },
  { path: '/admin/coaching/sessions', label: 'Sessions', icon: CalendarClock },
  { path: '/admin/coaching/finance', label: 'Finance & remboursements', icon: CircleDollarSign },
  { path: '/admin/coaching/revenus', label: 'Revenus coachs', icon: CircleDollarSign },
  { path: '/admin/coaching/avis', label: 'Avis', icon: Star },
  { path: '/admin/coaching/litiges', label: 'Litiges', icon: ShieldAlert },
  { path: '/admin/coaching/niveaux', label: 'Niveaux', icon: UsersRound },
  { path: '/admin/coaching/domaines', label: 'Domaines', icon: FolderCog },
  { path: '/admin/coaching/avance', label: 'Packs & groupes', icon: Package },
];

export default function AdminCoachingManagementLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const sidebar = (
    <aside className="flex h-full min-h-0 flex-col" style={{ background: BLUE }}>
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
        <Link to="/admin/coaching" onClick={() => setOpen(false)} className="flex min-w-0 items-center gap-3">
          <img src="/omnia-sidebar-logo.png" alt="Omnia Coaching" className="h-10 w-10 flex-shrink-0 object-contain" />
          <div className="min-w-0 font-bold leading-tight">
            <div className="truncate text-base text-white">Gestion Omnia</div>
            <div className="truncate text-base" style={{ color: GOLD }}>Coaching</div>
          </div>
        </Link>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-white/80 lg:hidden" aria-label="Fermer le menu"><X size={18} /></button>
      </div>

      <nav className="sidebar-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map(item => {
          const active = item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setOpen(false)}
              className="relative flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition hover:bg-white/5"
              style={{ color: active ? GOLD : 'rgba(255,255,255,.80)', background: active ? 'rgba(255,255,255,.06)' : undefined }}
            >
              {active && <span className="absolute bottom-2 left-0 top-2 w-0.5 rounded-full" style={{ background: GOLD }} />}
              <Icon size={18} />
              <span className="flex-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-3 py-4">
        <Link to="/coaching" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold" style={{ color: GOLD }}>
          <ExternalLink size={18} /> Voir Omnia Coaching
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
          <button type="button" className="fixed inset-0 bg-black/55" onClick={() => setOpen(false)} aria-label="Fermer le menu de gestion Coaching" />
          <div className="relative z-10 h-full w-[280px] max-w-[88vw]">{sidebar}</div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold" style={{ color: BLUE }}>
            <Menu size={18} /> Gestion Omnia Coaching
          </button>
        </div>
        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
