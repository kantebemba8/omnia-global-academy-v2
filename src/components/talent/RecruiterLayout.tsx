import { ReactNode, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, Briefcase, CalendarDays, FileText, Heart, LayoutDashboard, LogOut,
  Menu, MessageSquare, Search, Settings, UserRound, ExternalLink,
} from 'lucide-react';
import { clearSession, getStoredUser } from '../../lib/session';

const BLUE = '#002050';
const GOLD = '#BF8813';

type StoredUser = { id?: string; full_name?: string; email?: string; roles?: string[] };
type Props = { children: ReactNode; title?: string; subtitle?: string };

const NAV = [
  { path: '/talent/recruteur/dashboard', label: 'Tableau de bord', icon: LayoutDashboard, exact: true },
  { path: '/talent/recruteur/talents', label: 'Rechercher des talents', icon: Search },
  { path: '/talent/recruteur/offres', label: 'Mes offres', icon: Briefcase },
  { path: '/talent/recruteur/candidatures', label: 'Candidatures', icon: FileText },
  { path: '/talent/recruteur/favoris', label: 'Talents favoris', icon: Heart },
  { path: '/talent/recruteur/entretiens', label: 'Entretiens', icon: CalendarDays },
  { path: '/talent/recruteur/messages', label: 'Messages', icon: MessageSquare },
  { path: '/talent/recruteur/profil', label: 'Profil recruteur', icon: UserRound },
  { path: '/talent/recruteur/parametres', label: 'Paramètres', icon: Settings },
];

export function RecruiterLayout({ children, title = 'Espace recruteur', subtitle = 'Omnia Talent' }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const user = getStoredUser<StoredUser>();
  const previewMode = useMemo(
    () => new URLSearchParams(location.search).get('preview') === 'true' && !!user?.roles?.includes('super_admin'),
    [location.search, user?.roles],
  );
  const withPreview = (path: string) => previewMode ? `${path}?preview=true` : path;

  function logout() {
    clearSession();
    navigate('/connexion');
  }

  const sidebar = (
    <aside className="flex h-full min-h-0 flex-col" style={{ backgroundColor: BLUE }}>
      <div className="flex-shrink-0 border-b border-white/10 px-5 py-5">
        <Link to="/talent" className="flex items-center gap-3" onClick={() => setOpen(false)}>
          <img src="/omnia-sidebar-logo.png" alt="Omnia Talent" className="h-10 w-10 flex-shrink-0 object-contain" />
          <div className="font-bold leading-tight">
            <div className="text-base text-white">Omnia</div>
            <div className="text-base" style={{ color: GOLD }}>Talent</div>
          </div>
        </Link>
      </div>

      <nav className="sidebar-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {NAV.map(item => {
          const active = item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={withPreview(item.path)}
              onClick={() => setOpen(false)}
              className="relative flex items-center gap-3 px-3 py-3 text-sm font-semibold transition-colors"
              style={{ color: active ? GOLD : 'rgba(255,255,255,0.78)' }}
            >
              {active && <span className="absolute bottom-2 left-0 top-2 w-0.5" style={{ backgroundColor: GOLD }} />}
              <Icon size={18} />
              <span className="flex-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex-shrink-0 border-t border-white/10 px-3 py-4">
        <Link
          to="/talent"
          onClick={() => setOpen(false)}
          className="flex items-center gap-3 px-3 py-2.5 text-sm font-semibold"
          style={{ color: GOLD }}
        >
          <ExternalLink size={18} /> Retour à Omnia Talent
        </Link>
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center gap-3 px-3 py-2.5 text-sm text-white hover:text-white"
        >
          <LogOut size={18} /> Déconnexion
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="hidden w-[260px] flex-shrink-0 flex-col lg:flex">{sidebar}</div>
      {open && <div className="fixed inset-0 z-50 flex lg:hidden"><button type="button" className="fixed inset-0 bg-black/60" onClick={() => setOpen(false)} aria-label="Fermer le menu"/><div className="relative z-10 h-full w-[260px]">{sidebar}</div></div>}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex min-h-16 items-center justify-between border-b border-gray-200 bg-white px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <button type="button" className="p-2 text-gray-600 lg:hidden" onClick={() => setOpen(true)} aria-label="Ouvrir le menu"><Menu size={20}/></button>
            <div><h1 className="text-base font-semibold" style={{ color: BLUE }}>{title}</h1><p className="text-xs text-gray-500">{previewMode ? 'Prévisualisation Super-admin · données réelles autorisées' : subtitle}</p></div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="border-l border-gray-200 p-2 text-gray-600" aria-label="Notifications"><Bell size={18}/></button>
            <Link to={withPreview('/talent/recruteur/profil')} className="hidden border-l border-gray-200 px-3 py-2 text-sm font-medium sm:block" style={{ color: BLUE }}>Mon profil</Link>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
