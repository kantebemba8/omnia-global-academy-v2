import { getSessionToken, clearSession } from '../../lib/session';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  ChevronDown,
  Compass,
  Home,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  Package,
  Search,
  UserRound,
  UserRoundCheck,
} from 'lucide-react';
import { isCoachPreviewMode, withCoachPreview } from '../../lib/coachingApi';

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
  if (roles.includes('responsable_structure') || roles.includes('structure_admin') || roles.includes('directeur') || roles.includes('gestionnaire_partenaire')) return '/structure/dashboard';
  if (roles.includes('recruteur_independant') || roles.includes('recruteur')) return '/talent/recruteur/dashboard';
  if (roles.includes('recruteur_structure')) return '/structure/recrutement/dashboard';
  if (roles.includes('professeur') || roles.includes('formateur')) return '/professeur/dashboard';
  if (roles.includes('enseignant') || roles.includes('etablissement_enseignant')) return '/professeur/dashboard';
  if (roles.includes('moderateur')) return '/moderator/dashboard';
  return '/dashboard';
}

function profilePathForRoles(roles: string[]): string {
  if (roles.includes('super_admin')) return '/mon-profil';
  if (roles.includes('responsable_structure') || roles.includes('structure_admin') || roles.includes('directeur') || roles.includes('gestionnaire_partenaire')) return '/mon-profil';
  if (roles.includes('recruteur_independant') || roles.includes('recruteur')) return '/mon-profil';
  if (roles.includes('professeur') || roles.includes('formateur')) return '/mon-profil';
  return '/mon-profil';
}

function initials(user: StoredUser | null) {
  const source = user?.full_name || user?.name || user?.email || 'Omnia';
  const parts = source.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : source.slice(0, 2).toUpperCase();
}

function canStartCoachApplication(roles: string[]) {
  return roles.some(role => [
    'professeur',
    'formateur',
    'responsable_structure',
    'structure_admin',
    'directeur',
    'gestionnaire_partenaire',
  ].includes(role));
}

export default function CoachingHeader({ searchValue = '', onSearchChange, searchPlaceholder = 'Rechercher un coach, une spécialité…', showSearch = false }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
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
  const isAdministration = roles.includes('super_admin');
  const previewMode = isCoachPreviewMode();
  const isCoachingLanding = location.pathname === '/coaching';
  const dashboardPath = dashboardPathForRoles(roles);
  const profilePath = profilePathForRoles(roles);
  const coachSpaceTarget = loggedIn ? (isCoach ? withCoachPreview('/coach/dashboard') : dashboardPath) : '/connexion?redirect=%2Fcoach%2Fdashboard';

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
      if (event.key === 'Escape') {
        setMenuOpen(false);
        setProfileOpen(false);
      }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setProfileOpen(false);
  }, [location.pathname, location.search]);

  function logout() {
    localStorage.removeItem('omnia_user');
    clearSession();
    localStorage.removeItem('omnia_access_token');
    localStorage.removeItem('access_token');
    navigate('/connexion');
  }

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-[72px] max-w-7xl items-center gap-3 px-4 py-3 md:px-6">
          <button
            type="button"
            onClick={() => setMenuOpen(open => !open)}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition hover:bg-slate-100"
            style={{ color: menuOpen ? GOLD : BLUE }}
            aria-label={menuOpen ? 'Fermer le menu Omnia Coaching' : 'Ouvrir le menu Omnia Coaching'}
            aria-expanded={menuOpen}
          >
            <Menu size={23} />
          </button>

          <Link to="/coaching" className="flex min-w-0 flex-1 items-center gap-3 lg:flex-none">
            <img src="/omnia-sidebar-logo.png" alt="Omnia Global Academy" className="h-10 w-10 flex-shrink-0 rounded-xl object-contain" />
            <div className="min-w-0">
              <div className="truncate text-lg font-bold leading-none md:text-xl" style={{ color: BLUE }}>
                Omnia <span style={{ color: GOLD }}>Coaching</span>
              </div>
              <div className="mt-1 hidden text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:block">Accompagnement 1-on-1</div>
            </div>
          </Link>

          {showSearch && onSearchChange && (
            <div className="mx-5 hidden w-full max-w-[420px] items-center rounded-xl border border-slate-200 bg-white px-3 lg:flex">
              <Search size={17} className="text-slate-400" />
              <input
                value={searchValue}
                onChange={event => onSearchChange(event.target.value)}
                className="h-10 flex-1 border-0 bg-transparent px-2 text-sm outline-none"
                placeholder={searchPlaceholder}
                aria-label="Rechercher un coach"
              />
            </div>
          )}

          <div className="ml-auto flex flex-shrink-0 items-center gap-2">
            {isCoachingLanding && (
              <Link to={coachSpaceTarget} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold transition hover:bg-slate-50" style={{ color: BLUE }}>
                {loggedIn ? <LayoutDashboard size={16} /> : <LogIn size={16} />}
                <span className="hidden sm:inline">Espace coach</span>
              </Link>
            )}

            {!loggedIn && !isCoachingLanding && (
              <Link to={`/connexion?redirect=${encodeURIComponent(location.pathname + location.search)}`} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-white" style={{ background: BLUE }}>
                <LogIn size={16} /> Connexion
              </Link>
            )}

            {loggedIn && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setProfileOpen(open => !open)}
                  className="flex items-center gap-1 rounded-xl px-1.5 py-1 transition hover:bg-slate-100"
                  aria-label="Ouvrir le menu du profil"
                  aria-expanded={profileOpen}
                >
                  {user?.avatar_url ? (
                    <img src={user.avatar_url} alt="Photo de profil" className="h-9 w-9 rounded-full border border-slate-200 object-cover" />
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: BLUE }}>{initials(user)}</span>
                  )}
                  <ChevronDown size={15} className="text-slate-400" />
                </button>

                {profileOpen && (
                  <>
                    <button type="button" className="fixed inset-0 z-40 cursor-default" onClick={() => setProfileOpen(false)} aria-label="Fermer le menu du profil" />
                    <div className="absolute right-0 top-12 z-50 w-[245px] overflow-hidden rounded-2xl border border-slate-200 bg-white py-2 shadow-xl">
                      <button onClick={() => navigate(profilePath)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold hover:bg-slate-50">
                        <UserRound size={17} /> {isAdministration ? 'Mon compte' : 'Mon profil'}
                      </button>
                      <button onClick={() => navigate('/dashboard/coaching')} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold hover:bg-slate-50">
                        <CalendarDays size={17} /> Mes sessions coaching
                      </button>
                      {isCoachingLanding && (isCoach || previewMode) && (
                        <button onClick={() => navigate(withCoachPreview('/coach/dashboard'))} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold hover:bg-slate-50">
                          <LayoutDashboard size={17} /> Espace coach
                        </button>
                      )}
                      <button onClick={() => navigate(dashboardPath)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold hover:bg-slate-50">
                        <LayoutDashboard size={17} /> Retour au Dashboard
                      </button>
                      <div className="my-1 border-t border-slate-100" />
                      <button onClick={logout} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50">
                        <LogOut size={17} /> Se déconnecter
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-[70]">
          <button type="button" className="absolute inset-0 bg-slate-950/30" onClick={() => setMenuOpen(false)} aria-label="Fermer le menu en cliquant à l’extérieur" />
          <aside className="absolute left-3 top-[84px] max-h-[calc(100vh-100px)] w-[292px] max-w-[88vw] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-5">
              <img src="/omnia-sidebar-logo.png" alt="Omnia Coaching" className="h-12 w-12 rounded-xl object-contain" />
              <div className="min-w-0">
                <div className="truncate text-base font-bold" style={{ color: BLUE }}>Omnia <span style={{ color: GOLD }}>Coaching</span></div>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">Accompagnement 1-on-1</div>
              </div>
            </div>
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
                    className="relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition hover:bg-slate-50"
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
                <button type="button" onClick={() => { setMenuOpen(false); navigate('/accueil'); }} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition hover:bg-slate-50" style={{ color: BLUE }}>
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
