import { clearSession } from '../../lib/session';
import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  CircleDollarSign, CreditCard,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Package,
  Settings2,
  Star,
  X,
} from 'lucide-react';
import { withCoachPreview } from '../../lib/coachingApi';

const BLUE = '#002050';
const GOLD = '#BF8813';

const items = [
  { path: '/coach/dashboard', label: 'Accueil', icon: LayoutDashboard, exact: true },
  { path: '/coach/offres', label: 'Mes offres', icon: Settings2 },
  { path: '/coach/calendrier', label: 'Mon calendrier', icon: CalendarDays },
  { path: '/coach/sessions', label: 'Mes sessions', icon: ListChecks },
  { path: '/coach/avis', label: 'Mes avis', icon: Star },
  { path: '/coach/revenus', label: 'Mes revenus', icon: CircleDollarSign },
  { path: '/coach/commerce', label: 'Tarifs & abonnements', icon: CreditCard },
  { path: '/coach/plan-omnia', label: 'Mon plan Omnia', icon: CreditCard },
  { path: '/coach/produits', label: 'Coaching collectif', icon: Package },
];

export default function CoachWorkspaceLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  function logout() {
    sessionStorage.removeItem('omnia_admin_role_preview');
    localStorage.removeItem('omnia_user');
    clearSession();
    localStorage.removeItem('omnia_access_token');
    localStorage.removeItem('access_token');
    navigate('/connexion');
  }

  const sidebar = (
    <aside className="flex h-full min-h-0 flex-col" style={{ background: BLUE }}>
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
        <Link to="/coaching" className="flex items-center gap-3" onClick={() => setOpen(false)}>
          <img src="/omnia-sidebar-logo.png" alt="Omnia Coaching" className="h-10 w-10 flex-shrink-0 object-contain" />
          <div className="font-bold leading-tight">
            <div className="text-base text-white">Espace</div>
            <div className="text-base" style={{ color: GOLD }}>Coach</div>
          </div>
        </Link>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-white/80 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BF8813] lg:hidden" aria-label="Fermer le menu"><X size={18} /></button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {items.map(item => {
          const active = item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={withCoachPreview(item.path)}
              onClick={() => setOpen(false)}
              aria-current={active ? 'page' : undefined}
              className="relative flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#BF8813]"
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
        <Link to="/coaching" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold" style={{ color: GOLD }}>
          <ArrowLeft size={18} /> Voir Omnia Coaching
        </Link>
        <button type="button" onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/80 hover:bg-white/5 hover:text-white">
          <LogOut size={18} />
          Déconnexion
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8FAFC]">
      <div className="hidden w-[260px] flex-shrink-0 lg:block">{sidebar}</div>
      {open && (
        <div className="fixed inset-0 z-[70] flex lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation de l’espace Coach">
          <button type="button" className="fixed inset-0 bg-black/55" onClick={() => setOpen(false)} aria-label="Fermer le menu coach" />
          <div id="coach-mobile-navigation" className="relative z-10 h-full w-[270px] max-w-[88vw]">{sidebar}</div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BF8813]"
            style={{ color: BLUE }}
            aria-expanded={open}
            aria-controls="coach-mobile-navigation"
          >
            <Menu size={18} /> Menu coach
          </button>
        </div>
        <main className="min-w-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
