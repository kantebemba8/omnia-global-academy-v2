import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, Briefcase, CalendarDays, ChevronRight, FileText, Heart,
  LayoutDashboard, LogOut, Menu, MessageSquare, Search, Settings, UserRound,
  UsersRound, X,
} from 'lucide-react';
import { clearSession, getStoredUser } from '../../lib/session';

const BLUE = '#002050';
const GOLD = '#BF8813';

type StoredUser = { id?: string; full_name?: string; email?: string; roles?: string[] };
type Props = { children: ReactNode; title?: string; subtitle?: string };

const NAV = [
  { path: '/talent/recruteur/dashboard', label: 'Tableau de bord', icon: LayoutDashboard, exact: true },
  { path: '/talent/recruteur/offres', label: 'Mes offres', icon: Briefcase },
  { path: '/talent/recruteur/talents', label: 'Rechercher des talents', icon: Search },
  { path: '/talent/recruteur/favoris', label: 'Talents favoris', icon: Heart },
  { path: '/talent/recruteur/candidatures', label: 'Candidatures', icon: FileText },
  { path: '/talent/recruteur/entretiens', label: 'Entretiens', icon: CalendarDays },
  { path: '/talent/recruteur/messages', label: 'Messages', icon: MessageSquare },
  { path: '/talent/recruteur/profil', label: 'Profil recruteur', icon: UserRound },
  { path: '/talent/recruteur/parametres', label: 'Paramètres', icon: Settings },
];

function initials(name = 'Recruteur') {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : name.slice(0, 2).toUpperCase();
}

export function RecruiterLayout({ children, title = 'Espace recruteur', subtitle = 'Talent Omnia' }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);

  useEffect(() => {
    setUser(getStoredUser<StoredUser>());
  }, []);

  const roleLabel = useMemo(() => user?.roles?.includes('super_admin') ? 'Super-admin' : 'Recruteur', [user]);

  function logout() {
    clearSession();
    navigate('/connexion');
  }

  const sidebar = (
    <aside className="flex h-full flex-col" style={{ backgroundColor: BLUE }}>
      <div className="border-b border-white/10 px-6 py-5">
        <Link to="/talent" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white" style={{ backgroundColor: GOLD }}>OA</div>
          <span className="text-base font-bold leading-tight text-white">Omnia Global<br />Academy</span>
        </Link>
      </div>

      <div className="mx-3 mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold" style={{ backgroundColor: GOLD, color: BLUE }}>
            {initials(user?.full_name)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{user?.full_name || 'Compte recruteur'}</p>
            <p className="truncate text-xs capitalize text-white/50">{roleLabel}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV.map(item => {
          const active = item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);
          const Icon = item.icon;
          return (
            <Link key={item.path} to={item.path} onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-150"
              style={{ backgroundColor: active ? 'rgba(191,136,19,0.15)' : 'transparent', color: active ? GOLD : 'rgba(255,255,255,0.65)' }}>
              <Icon size={18} />
              <span className="flex-1 text-sm font-medium">{item.label}</span>
              {active && <ChevronRight size={14} className="opacity-60" />}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-3 py-4">
        <Link to="/talent" className="mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/60 hover:bg-white/5 hover:text-white">
          <UsersRound size={18} /> Voir Talent Omnia
        </Link>
        <button type="button" onClick={logout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/50 hover:bg-white/5 hover:text-white">
          <LogOut size={18} /> Déconnexion
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="hidden w-[260px] flex-shrink-0 flex-col lg:flex">{sidebar}</div>
      {open && <div className="fixed inset-0 z-50 flex lg:hidden"><button type="button" className="fixed inset-0 bg-black/60" onClick={() => setOpen(false)} aria-label="Fermer" /><div className="relative z-10 w-[260px]">{sidebar}</div></div>}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex min-h-16 items-center justify-between border-b border-gray-200 bg-white px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <button type="button" className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Menu"><Menu size={20} /></button>
            <div><h1 className="text-base font-semibold" style={{ color: BLUE }}>{title}</h1><p className="text-xs text-gray-500">{subtitle}</p></div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="relative rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50" aria-label="Notifications"><Bell size={18} /></button>
            <Link to="/talent/recruteur/profil" className="hidden rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium sm:block" style={{ color: BLUE }}>Mon profil</Link>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
