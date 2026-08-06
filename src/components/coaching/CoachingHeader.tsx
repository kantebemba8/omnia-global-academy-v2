import { getSessionToken } from '../../lib/session';
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  Compass,
  Home,
  LayoutDashboard,
  LogIn,
  Menu,
  Package,
  Search,
  UserRoundCheck,
  X,
} from 'lucide-react';
import { isCoachPreviewMode, withCoachPreview } from '../../lib/coachingApi';
import { LanguageSwitcher } from '../LanguageSwitcher';
import UserAccountMenu from '../UserAccountMenu';

const BLUE = '#002050';
const GOLD = '#BF8813';

type StoredUser = {
  full_name?: string;
  name?: string;
  email?: string;
  avatar_url?: string | null;
  roles?: string[];
};

type NavItem = {
  path: string;
  label: string;
  icon: typeof Home;
  exact?: boolean;
};

type Props = {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  showSearch?: boolean;
};

function dashboardPathForRoles(roles: string[]): string {
  if (roles.includes('super_admin')) return '/admin/dashboard';
  if (roles.includes('coach')) return '/coach/dashboard';
  if (roles.includes('responsable_structure') || roles.includes('gestionnaire_structure') || roles.includes('structure_admin') || roles.includes('directeur') || roles.includes('gestionnaire_partenaire')) return '/structure/dashboard';
  if (roles.includes('recruteur_independant') || roles.includes('recruteur')) return '/talent/recruteur/dashboard';
  if (roles.includes('recruteur_structure')) return '/structure/recrutement/dashboard';
  if (roles.includes('professeur') || roles.includes('formateur') || roles.includes('enseignant') || roles.includes('etablissement_enseignant')) return '/professeur/dashboard';
  if (roles.includes('moderateur')) return '/moderateur/dashboard';
  return '/dashboard';
}

function canStartCoachApplication(roles: string[]) {
  return roles.some(role => [
    'professeur',
    'formateur',
    'responsable_structure',
    'gestionnaire_structure',
    'structure_admin',
    'directeur',
    'gestionnaire_partenaire',
  ].includes(role));
}

export default function CoachingHeader({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Rechercher un coach, une spécialité…',
  showSearch = true,
}: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [internalSearch, setInternalSearch] = useState(() => new URLSearchParams(location.search).get('q') || '');
  const [user, setUser] = useState<StoredUser | null>(() => {
    try {
      const raw = localStorage.getItem('omnia_user');
      return raw ? JSON.parse(raw) as StoredUser : null;
    } catch {
      return null;
    }
  });

  const roles = user?.roles || [];
  const loggedIn = Boolean(getSessionToken()) && Boolean(user);
  const isCoach = roles.includes('coach');
  const previewMode = isCoachPreviewMode();
  const isCoachingLanding = location.pathname === '/coaching';
  const dashboardPath = dashboardPathForRoles(roles);
  const coachSpaceTarget = loggedIn ? (isCoach ? withCoachPreview('/coach/dashboard') : dashboardPath) : '/connexion?redirect=%2Fcoach%2Fdashboard';
  const resolvedSearch = searchValue ?? internalSearch;

  useEffect(() => {
    const refreshUser = () => {
      try {
        const raw = localStorage.getItem('omnia_user');
        setUser(raw ? JSON.parse(raw) as StoredUser : null);
      } catch {
        setUser(null);
      }
    };
    window.addEventListener('omnia:profile-updated', refreshUser);
    window.addEventListener('storage', refreshUser);
    return () => {
      window.removeEventListener('omnia:profile-updated', refreshUser);
      window.removeEventListener('storage', refreshUser);
    };
  }, []);

  const navItems = useMemo<NavItem[]>(() => {
    const items: NavItem[] = [
      { path: '/coaching', label: 'Trouver un coach', icon: Compass, exact: true },
      { path: '/coaching/solutions', label: 'Coaching collectif', icon: Package },
    ];
    if (loggedIn) items.push({ path: '/dashboard/coaching', label: 'Mes sessions', icon: CalendarDays });
    if (isCoach || previewMode) items.push({ path: '/coach/dashboard', label: 'Espace coach', icon: LayoutDashboard });
    if (!isCoach && canStartCoachApplication(roles)) items.push({ path: '/coaching/devenir-coach', label: 'Devenir coach', icon: UserRoundCheck });
    return items;
  }, [isCoach, loggedIn, previewMode, roles]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    if (searchValue === undefined) setInternalSearch(new URLSearchParams(location.search).get('q') || '');
  }, [location.pathname, location.search, searchValue]);

  function updateSearch(value: string) {
    if (onSearchChange) onSearchChange(value);
    else setInternalSearch(value);
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const query = resolvedSearch.trim();
    if (isCoachingLanding && onSearchChange) return;
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    navigate(`/coaching${params.toString() ? `?${params.toString()}` : ''}`);
  }

  const searchField = (mobile = false) => showSearch ? (
    <form onSubmit={submitSearch} role="search" className={`flex items-center rounded-xl border border-slate-200 bg-white px-3 focus-within:border-[#BF8813] focus-within:ring-2 focus-within:ring-[#BF8813]/15 ${mobile ? 'w-full' : 'w-full max-w-[440px]'}`}>
      <Search size={17} className="flex-none text-slate-400" />
      <input
        value={resolvedSearch}
        onChange={event => updateSearch(event.target.value)}
        className="h-10 min-w-0 flex-1 border-0 bg-transparent px-2 text-sm text-slate-700 outline-none"
        placeholder={searchPlaceholder}
        aria-label={searchPlaceholder}
      />
      {resolvedSearch && <button type="button" onClick={() => updateSearch('')} className="rounded-full p-1 text-slate-400 hover:bg-slate-100" aria-label="Effacer la recherche"><X size={14} /></button>}
    </form>
  ) : null;

  return (
    <>
      <header className="sticky top-0 z-50 flex h-[72px] items-center border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-7">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            onClick={() => setMenuOpen(open => !open)}
            className="flex h-10 w-10 flex-none items-center justify-center rounded-xl transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BF8813]"
            style={{ color: menuOpen ? GOLD : BLUE }}
            aria-label={menuOpen ? 'Fermer le menu Omnia Coaching' : 'Ouvrir le menu Omnia Coaching'}
            aria-expanded={menuOpen}
            aria-controls="omnia-coaching-navigation"
          >
            <Menu size={23} />
          </button>

          <Link to="/coaching" className="flex min-w-0 items-center gap-3">
            <img src="/IMG_0349.png" alt="Omnia Global Academy" className="h-9 w-9 flex-none rounded-lg object-cover" />
            <span className="truncate text-lg font-bold md:text-xl" style={{ color: BLUE }}>Omnia <span style={{ color: GOLD }}>Coaching</span></span>
          </Link>
        </div>

        {showSearch && <div className="mx-5 hidden min-w-0 flex-1 justify-center lg:flex">{searchField()}</div>}

        <div className="ml-auto flex flex-none items-center gap-2">
          {isCoachingLanding && (
            <Link to={coachSpaceTarget} className="hidden items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold transition hover:bg-slate-50 sm:inline-flex" style={{ color: BLUE }}>
              {loggedIn ? <LayoutDashboard size={16} /> : <LogIn size={16} />}
              <span>Espace coach</span>
            </Link>
          )}
          {!loggedIn && !isCoachingLanding && (
            <Link to={`/connexion?redirect=${encodeURIComponent(location.pathname + location.search)}`} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-white" style={{ background: BLUE }}>
              <LogIn size={16} /> <span className="hidden sm:inline">Connexion</span>
            </Link>
          )}
          <LanguageSwitcher compact />
          {loggedIn && <UserAccountMenu dashboardPath={dashboardPath} />}
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Navigation Omnia Coaching">
          <button type="button" className="absolute inset-0 bg-slate-950/35" onClick={() => setMenuOpen(false)} aria-label="Fermer le menu" />
          <aside id="omnia-coaching-navigation" className="absolute left-3 top-[84px] max-h-[calc(100vh-100px)] w-[300px] max-w-[90vw] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-5">
              <img src="/IMG_0349.png" alt="Omnia Coaching" className="h-11 w-11 rounded-xl object-cover" />
              <div className="truncate text-base font-bold" style={{ color: BLUE }}>Omnia <span style={{ color: GOLD }}>Coaching</span></div>
            </div>
            {showSearch && <div className="px-4 pt-4 lg:hidden">{searchField(true)}</div>}
            <nav className="space-y-1 px-3 py-4">
              {navItems.map(item => {
                const active = item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);
                const Icon = item.icon;
                const path = previewMode && item.path.startsWith('/coach') ? withCoachPreview(item.path) : item.path;
                return (
                  <Link
                    key={item.path}
                    to={path}
                    onClick={() => setMenuOpen(false)}
                    className="relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BF8813]"
                    style={{ color: active ? BLUE : '#526074', background: active ? 'rgba(191,136,19,.08)' : undefined }}
                  >
                    {active && <span className="absolute bottom-2 left-0 top-2 w-1 rounded-r-full" style={{ background: GOLD }} />}
                    <Icon size={18} style={{ color: active ? GOLD : '#64748B' }} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            {!loggedIn && (
              <div className="border-t border-slate-100 px-3 py-4">
                <button type="button" onClick={() => navigate('/accueil')} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition hover:bg-slate-50" style={{ color: BLUE }}>
                  <Home size={18} /> Retour à Omnia Global Academy
                </button>
              </div>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
