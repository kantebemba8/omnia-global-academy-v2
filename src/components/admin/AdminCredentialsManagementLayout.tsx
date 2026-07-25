import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Award, BadgeCheck, Building2, FileCheck2, Layers3, KeyRound, LayoutDashboard, Menu, ShieldCheck, Sparkles, Users, X } from 'lucide-react';
import { useState } from 'react';

const BLUE = '#002050';
const GOLD = '#BF8813';

const NAV_ITEMS = [
  { path: '/admin/credentials', label: 'Vue d’ensemble', icon: LayoutDashboard, exact: true },
  { path: '/admin/credentials/modeles', label: 'Modèles de badges', icon: Award },
  { path: '/admin/credentials/attributions', label: 'Attributions', icon: BadgeCheck },
  { path: '/admin/credentials/emetteurs', label: 'Émetteurs', icon: Building2 },
  { path: '/admin/credentials/signatures', label: 'Signatures Open Badges', icon: KeyRound },
  { path: '/admin/credentials/categories', label: 'Catégories & niveaux', icon: Layers3 },
  { path: '/admin/credentials/clr', label: 'Learning Records', icon: FileCheck2 },
  { path: '/admin/credentials/passports', label: 'Skills Passport', icon: Sparkles },
  { path: '/admin/credentials/revocations', label: 'Révocations', icon: ShieldCheck },
];

export default function AdminCredentialsManagementLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const sidebar = (
    <aside className="flex h-full min-h-0 flex-col" style={{ background: BLUE }}>
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
        <Link to="/admin/credentials" onClick={() => setOpen(false)} className="flex min-w-0 items-center gap-3">
          <img src="/omnia-sidebar-logo.png" alt="Omnia Credentials" className="h-10 w-10 flex-shrink-0 object-contain" />
          <div className="min-w-0 font-bold leading-tight">
            <div className="truncate text-base text-white">Badges &</div>
            <div className="truncate text-base" style={{ color: GOLD }}>Learning Records</div>
          </div>
        </Link>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-white/80 lg:hidden" aria-label="Fermer le menu"><X size={18} /></button>
      </div>
      <nav className="oga-sidebar-scroll min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map(item => {
          const active = item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);
          const Icon = item.icon;
          return <Link key={item.path} to={item.path} onClick={() => setOpen(false)} className="relative flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition hover:bg-white/5" style={{ color: active ? GOLD : 'rgba(255,255,255,.80)', background: active ? 'rgba(255,255,255,.06)' : undefined }}>
            {active && <span className="absolute bottom-2 left-0 top-2 w-0.5 rounded-full" style={{ background: GOLD }} />}
            <Icon size={18} />
            <span className="flex-1">{item.label}</span>
          </Link>;
        })}
      </nav>
      <div className="border-t border-white/10 px-3 py-4">
        <Link to="/dashboard/badges" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold" style={{ color: GOLD }}><Users size={18} /> Voir l’espace apprenant</Link>
        <Link to="/admin/dashboard" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/80 hover:bg-white/5 hover:text-white"><ArrowLeft size={18} /> Retour au Dashboard</Link>
      </div>
    </aside>
  );

  return <div className="flex h-screen overflow-hidden bg-[#F8FAFC]">
    <div className="hidden w-[270px] flex-shrink-0 lg:block">{sidebar}</div>
    {open && <div className="fixed inset-0 z-[90] flex lg:hidden"><button type="button" className="fixed inset-0 bg-black/55" onClick={() => setOpen(false)} aria-label="Fermer le menu" /><div className="relative z-10 h-full w-[280px] max-w-[88vw]">{sidebar}</div></div>}
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <div className="border-b border-slate-200 bg-white px-4 py-3 lg:hidden"><button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold" style={{ color: BLUE }}><Menu size={18} /> Badges & Learning Records</button></div>
      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  </div>;
}
