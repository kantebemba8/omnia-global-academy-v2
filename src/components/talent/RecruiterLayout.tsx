import { ReactNode, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Briefcase,
  CalendarDays,
  ChevronDown,
  ExternalLink,
  FileText,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Search,
  Settings,
  UserRound,
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

function initials(user: StoredUser | null) {
  const source = user?.full_name || user?.email || 'RE';
  const parts = source.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : source.slice(0, 2).toUpperCase();
}

export function RecruiterLayout({ children, title = 'Espace recruteur', subtitle = 'Omnia Talent' }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const user = getStoredUser<StoredUser>();
  const previewMode = useMemo(
    () => new URLSearchParams(location.search).get('preview') === 'true' && !!user?.roles?.includes('super_admin'),
    [location.search, user?.roles],
  );
  const withPreview = (path: string) => previewMode ? `${path}${path.includes('?') ? '&' : '?'}preview=true` : path;

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
              className="relative flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors hover:bg-white/5"
              style={{ color: active ? GOLD : 'rgba(255,255,255,0.78)', background: active ? 'rgba(255,255,255,.06)' : undefined }}
            >
              {active && <span className="absolute bottom-2 left-0 top-2 w-0.5 rounded-full" style={{ backgroundColor: GOLD }} />}
              <Icon size={18} />
              <span className="flex-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex-shrink-0 border-t border-white/10 px-3 py-4">
        <Link to="/talent" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold" style={{ color: GOLD }}>
          <ExternalLink size={18} /> Voir Omnia Talent
        </Link>
        {!previewMode && (
          <button type="button" onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/80 hover:bg-white/5 hover:text-white">
            <LogOut size={18} /> Déconnexion
          </button>
        )}
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="hidden w-[260px] flex-shrink-0 flex-col lg:flex">{sidebar}</div>
      {open && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button type="button" className="fixed inset-0 bg-black/60" onClick={() => setOpen(false)} aria-label="Fermer le menu" />
          <div className="relative z-10 h-full w-[260px]">{sidebar}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex min-h-[72px] items-center border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button type="button" className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Ouvrir le menu">
              <Menu size={21} />
            </button>
            <button type="button" onClick={() => navigate('/talent')} className="flex min-w-0 items-center gap-3 text-left">
              <img src="/omnia-sidebar-logo.png" alt="Omnia Talent" className="h-9 w-9 rounded-lg object-contain" />
              <div className="min-w-0">
                <div className="truncate text-lg font-bold" style={{ color: BLUE }}>Omnia <span style={{ color: GOLD }}>Talent</span></div>
                <div className="truncate text-[11px] font-medium text-slate-500">{previewMode ? 'Prévisualisation Super-admin · compte recruteur de test' : 'Espace recruteur indépendant'}</div>
              </div>
            </button>
          </div>

          <div className="hidden min-w-0 px-5 text-center md:block">
            <h1 className="truncate text-sm font-semibold" style={{ color: BLUE }}>{title}</h1>
            <p className="truncate text-xs text-slate-500">{subtitle}</p>
          </div>

          <div className="flex flex-1 items-center justify-end gap-2">
            <button type="button" onClick={() => navigate(previewMode ? '/admin/dashboard' : '/talent')} className="hidden items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition hover:bg-slate-100 sm:flex" style={{ color: BLUE }}>
              <ArrowLeft size={16} /> {previewMode ? 'Retour au Dashboard' : 'Voir Omnia Talent'}
            </button>
            <div className="relative">
              <button type="button" onClick={() => setProfileOpen(value => !value)} className="flex items-center gap-1 rounded-xl px-1.5 py-1 transition hover:bg-slate-100" aria-label="Ouvrir le menu du profil" aria-expanded={profileOpen}>
                <span className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: BLUE }}>{initials(user)}</span>
                <ChevronDown size={15} className="text-slate-400" />
              </button>
              {profileOpen && (
                <>
                  <button type="button" className="fixed inset-0 z-40 cursor-default" onClick={() => setProfileOpen(false)} aria-label="Fermer le menu du profil" />
                  <div className="absolute right-0 top-12 z-50 w-[235px] overflow-hidden rounded-2xl border border-slate-200 bg-white py-2 shadow-xl">
                    <button onClick={() => navigate(withPreview('/talent/recruteur/profil'))} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold hover:bg-slate-50"><UserRound size={17} /> Mon profil</button>
                    <button onClick={() => navigate(previewMode ? '/admin/dashboard' : '/talent/recruteur/dashboard')} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold hover:bg-slate-50"><LayoutDashboard size={17} /> Retour au Dashboard</button>
                    <button onClick={() => navigate('/talent')} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold hover:bg-slate-50"><ExternalLink size={17} /> Voir Omnia Talent</button>
                    {!previewMode && <><div className="my-1 border-t border-slate-100" /><button onClick={logout} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50"><LogOut size={17} /> Se déconnecter</button></>}
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
