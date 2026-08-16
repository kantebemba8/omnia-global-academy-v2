import { FormEvent, ReactNode, useEffect, useState, type CSSProperties, type ComponentType } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Navbar } from './Navbar';
import { ArrowLeft, Bell, ChevronDown, Home, Languages, LayoutDashboard, LogOut, Menu, Radio, Search, UserRound, X } from 'lucide-react';
import OmniaBrandLockup from './OmniaBrandLockup';
import { logoutOmniaSession } from '../lib/authApi';

const BLUE = '#002050';
const GOLD = '#BF8813';

export type SubspaceNavItem = {
  label: string;
  path: string;
  icon: ComponentType<{ size?: number; className?: string; style?: CSSProperties }>;
  exact?: boolean;
};

export type SubspaceSearchResult = {
  id: string;
  label: string;
  description?: string;
  path?: string;
  onSelect?: () => void;
};

type StoredUser = { full_name?: string; name?: string; email?: string; avatar_url?: string | null; roles?: string[] };

type Props = {
  title: string;
  navItems: SubspaceNavItem[];
  children: ReactNode;
  searchPlaceholder?: string;
  showSearch?: boolean;
  searchPath?: string;
  searchParam?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onSearchSubmit?: (value: string) => void;
  searchResults?: SubspaceSearchResult[];
  rightContent?: ReactNode;
  navigationMode?: 'drawer' | 'horizontal';
};

export function getDashboardPath(roles: string[] = []) {
  if (roles.includes('super_admin')) return '/admin/dashboard';
  if (roles.includes('organizer') || roles.includes('organisateur')) return '/omnia-live/organisateur';
  if (roles.includes('responsable_structure') || roles.includes('gestionnaire_structure') || roles.includes('structure_admin') || roles.includes('directeur')) return '/home?role=structure';
  if (roles.includes('recruteur')) return '/home?role=recruteur';
  if (roles.includes('professeur') || roles.includes('formateur')) return '/home?role=professeur';
  if (roles.includes('enseignant') || roles.includes('etablissement_enseignant')) return '/home?role=professeur';
  if (roles.includes('moderateur')) return '/home?role=moderateur';
  return '/home?role=apprenant';
}

export function getProfilePath(_roles: string[] = []) {
  // Toujours utiliser le rôle authentifié réel. Une prévisualisation ne change jamais le profil personnel.
  return '/home?section=profil';
}

function initials(user: StoredUser | null) {
  const source = user?.full_name || user?.name || user?.email || 'Omnia';
  const parts = source.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : source.slice(0, 2).toUpperCase();
}

function targetWithSearch(path: string, param: string, value: string) {
  const [pathAndQuery, hash = ''] = path.split('#', 2);
  const [pathname, query = ''] = pathAndQuery.split('?', 2);
  const params = new URLSearchParams(query);
  if (value) params.set(param, value);
  else params.delete(param);
  const serialized = params.toString();
  return `${pathname}${serialized ? `?${serialized}` : ''}${hash ? `#${hash}` : ''}`;
}

export default function SubspaceHamburgerLayout({
  title,
  navItems,
  children,
  searchPlaceholder,
  showSearch = true,
  searchPath,
  searchParam = 'q',
  searchValue,
  onSearchChange,
  onSearchSubmit,
  searchResults = [],
  rightContent,
  navigationMode = 'drawer',
}: Props) {
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [internalSearch, setInternalSearch] = useState(() => new URLSearchParams(window.location.search).get(searchParam) || '');
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<StoredUser | null>(() => {
    try { const raw = localStorage.getItem('omnia_user'); return raw ? JSON.parse(raw) : null; } catch { return null; }
  });
  const roles = user?.roles || [];
  const dashboardPath = getDashboardPath(roles);
  const profilePath = getProfilePath(roles);
  const isSuperAdmin = roles.includes('super_admin');
  const isOrganizer = roles.some(r => ['organizer', 'organisateur'].includes(r))
    || Boolean((user as any)?.omnia_live_organizer);
  const resolvedSearchValue = searchValue ?? internalSearch;

  const setSearch = (value: string) => {
    if (onSearchChange) onSearchChange(value);
    else setInternalSearch(value);
  };

  const submitSearch = (event?: FormEvent) => {
    event?.preventDefault();
    const value = resolvedSearchValue.trim();
    if (onSearchSubmit) {
      onSearchSubmit(value);
      return;
    }
    navigate(targetWithSearch(searchPath || location.pathname, searchParam, value));
  };

  const selectSearchResult = (result: SubspaceSearchResult) => {
    result.onSelect?.();
    if (result.path) navigate(result.path);
    setSearchFocused(false);
  };

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

  useEffect(() => {
    if (!open && !profileOpen) return;
    const previousOverflow = document.body.style.overflow;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setProfileOpen(false);
        setSearchFocused(false);
      }
    };
    if (open) document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, profileOpen]);

  useEffect(() => {
    setOpen(false);
    setProfileOpen(false);
    setSearchFocused(false);
    if (searchValue === undefined) setInternalSearch(new URLSearchParams(location.search).get(searchParam) || '');
  }, [location.pathname, location.search, searchParam, searchValue]);

  const searchField = (mobile = false) => (
    <form onSubmit={submitSearch} className={`relative flex items-center rounded-xl border border-slate-200 bg-white px-3 ${mobile ? 'w-full' : 'w-full max-w-[420px]'}`}>
      <Search size={17} className="flex-shrink-0 text-slate-400" />
      <input
        value={resolvedSearchValue}
        onChange={event => setSearch(event.target.value)}
        onFocus={() => setSearchFocused(true)}
        aria-label={searchPlaceholder || `Rechercher dans ${title}`}
        className="h-10 min-w-0 flex-1 border-0 bg-transparent px-2 text-sm outline-none focus-visible:ring-0"
        placeholder={searchPlaceholder || `Rechercher dans ${title}...`}
      />
      {resolvedSearchValue && (
        <button type="button" onClick={() => setSearch('')} className="rounded-full p-1 text-slate-400 hover:bg-slate-100" aria-label="Effacer la recherche">
          <X size={14} />
        </button>
      )}
      {searchFocused && resolvedSearchValue.trim() && searchResults.length > 0 && !mobile && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-[70] max-h-80 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
          {searchResults.map(result => (
            <button key={result.id} type="button" onMouseDown={event => event.preventDefault()} onClick={() => selectSearchResult(result)} className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left hover:bg-slate-50">
              <Search size={15} className="mt-0.5 flex-shrink-0" style={{ color: GOLD }} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold" style={{ color: BLUE }}>{result.label}</span>
                {result.description && <span className="mt-0.5 block truncate text-xs text-slate-500">{result.description}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </form>
  );

  if (navigationMode === 'horizontal') {
    return (
      <div className="min-h-screen bg-white" style={{ color: BLUE }}>
        <Navbar />
        <div className="pt-20">
          <header className="sticky top-20 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
            <div className="mx-auto max-w-[1440px] px-5 sm:px-6 lg:px-8">
              <div className="flex min-h-14 items-center gap-5">
                <Link
                  to={navItems[0]?.path || '/accueil'}
                  className="shrink-0 whitespace-nowrap text-sm font-black text-[#002050] sm:text-base"
                >
                  {title}
                </Link>
                <nav aria-label={`Navigation ${title}`} className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <div className="flex min-w-max items-center gap-1">
                    {navItems.map(item => {
                      const active = item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          aria-current={active ? 'page' : undefined}
                          className={`relative whitespace-nowrap px-3 py-[18px] text-sm font-semibold transition-colors ${active ? 'text-[#002050]' : 'text-slate-600 hover:text-[#002050]'}`}
                        >
                          {item.label}
                          {active && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#BF8813]" />}
                        </Link>
                      );
                    })}
                  </div>
                </nav>
                {showSearch && (
                  <div className="hidden w-[min(30vw,360px)] shrink-0 lg:block">
                    {searchField()}
                  </div>
                )}
              </div>
              {showSearch && (
                <div className="pb-3 lg:hidden">
                  {searchField(true)}
                </div>
              )}
            </div>
          </header>
          <main className="min-w-0">{children}</main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white" style={{ color: BLUE }}>
      <header className="sticky top-0 z-40 flex h-[72px] items-center border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-7">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            aria-label={open ? 'Replier le menu' : 'Ouvrir le menu'}
            aria-expanded={open}
            aria-controls="subspace-navigation-drawer"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition hover:bg-slate-100"
            style={{ color: open ? GOLD : BLUE }}
          >
            <Menu size={23} />
          </button>
          <img src="/omnia-sidebar-logo.png" alt="" className="h-9 w-9 object-contain" />
          <div className="min-w-0">
            {title === 'Omnia Live' ? (
              <button type="button" onClick={() => navigate('/omnia-live')} className="block truncate text-base font-bold transition hover:opacity-80 md:text-lg" aria-label="Accueil Omnia Live">
                <span>Omnia </span><span style={{ color: GOLD }}>Live</span>
              </button>
            ) : title === 'Omnia Talent' ? (
              <button type="button" onClick={() => navigate('/talent')} className="block truncate text-base font-bold transition hover:opacity-80 md:text-lg" aria-label="Accueil Omnia Talent">
                <span>Omnia </span><span style={{ color: GOLD }}>Talent</span>
              </button>
            ) : title === 'Omnia Projects' ? (
              <button type="button" onClick={() => navigate('/projects')} className="block truncate text-base font-bold transition hover:opacity-80 md:text-lg" aria-label="Accueil Omnia Projects">
                <span>Omnia </span><span style={{ color: GOLD }}>Projects</span>
              </button>
            ) : title === 'Omnia Communauté' ? (
              <button type="button" onClick={() => navigate('/forum')} className="block truncate text-base font-bold transition hover:opacity-80 md:text-lg" aria-label="Accueil Omnia Communauté">
                <span>Omnia </span><span style={{ color: GOLD }}>Communauté</span>
              </button>
            ) : title === 'Omnia Career Studio' ? (
              <div className="truncate text-base font-bold md:text-lg"><span>Omnia </span><span style={{ color: GOLD }}>Career Studio</span></div>
            ) : (
              <div className="truncate text-base font-bold md:text-lg">{title}</div>
            )}
          </div>
        </div>

        {showSearch && <div className="relative mx-5 hidden w-full max-w-[420px] lg:block">{searchField()}</div>}

        <div className="flex flex-shrink-0 items-center gap-3">
          {rightContent}
          {!user && <LanguageSwitcher compact />}
          {!user && (
            <button type="button" onClick={() => navigate('/accueil')} className="hidden items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition hover:bg-slate-100 sm:flex">
              <ArrowLeft size={16} /> Retour à Omnia Global Academy
            </button>
          )}
          {user && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen(v => !v)}
                className="flex items-center gap-1 rounded-xl px-1.5 py-1 transition hover:bg-slate-100"
                aria-expanded={profileOpen}
                aria-label="Ouvrir le menu du profil"
              >
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="Photo de profil" className="h-9 w-9 rounded-full border border-slate-200 object-cover" />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: BLUE }}>{initials(user)}</span>
                )}
                <ChevronDown size={15} className="text-slate-400" />
              </button>

              {profileOpen && (
                <>
                  <button type="button" aria-label="Fermer le menu du profil" className="fixed inset-0 z-40 cursor-default" onClick={() => setProfileOpen(false)} />
                  <div className="absolute right-0 top-12 z-50 w-[270px] overflow-visible rounded-2xl border border-slate-200 bg-white py-2 shadow-xl" role="menu">
                    <button type="button" role="menuitem" onClick={() => navigate(profilePath)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold hover:bg-slate-50">
                      <UserRound size={17} /> {isSuperAdmin ? 'Mon compte' : 'Mon profil'}
                    </button>
                    <button type="button" role="menuitem" onClick={() => navigate(dashboardPath)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold hover:bg-slate-50">
                      <LayoutDashboard size={17} /> Retour au Dashboard
                    </button>
                    <button type="button" role="menuitem" onClick={() => navigate('/notifications')} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold hover:bg-slate-50">
                      <Bell size={17} /> Notifications
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => navigate(isSuperAdmin ? '/admin/omnia-live' : isOrganizer ? '/omnia-live/organisateur' : '/omnia-live/mes-lives')}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold hover:bg-slate-50"
                    >
                      <Radio size={17} />
                      {isSuperAdmin ? 'Administration Omnia Live' : isOrganizer ? 'Espace Organisateur' : 'Mes Lives'}
                    </button>
                    <div className="my-1 border-t border-slate-100" />
                    <div className="flex items-center gap-3 px-4 py-2" role="none">
                      <Languages size={17} className="text-slate-500" />
                      <span className="flex-1 text-sm font-semibold text-slate-700">Langue de la plateforme</span>
                      <LanguageSwitcher compact />
                    </div>
                    <div className="my-1 border-t border-slate-100" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setProfileOpen(false);
                        void logoutOmniaSession().then(() => navigate('/connexion', { replace: true }));
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
                    >
                      <LogOut size={17} /> Se déconnecter
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`Navigation ${title}`}>
          <button type="button" className="absolute inset-0 bg-slate-950/25 backdrop-blur-[1px]" onClick={() => setOpen(false)} aria-label="Fermer le menu en cliquant à l’extérieur" />
          <aside id="subspace-navigation-drawer" className="absolute left-3 top-[84px] flex max-h-[calc(100dvh-100px)] w-[286px] max-w-[86vw] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-100 px-5 py-5">
              <OmniaBrandLockup href="/home" compact />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {showSearch && <div className="px-4 pt-4 lg:hidden">{searchField(true)}</div>}
              <div className="px-5 pb-2 pt-5">
                <div className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: GOLD }}>{title}</div>
              </div>
              <nav className="space-y-1 px-3 py-3">
                {navItems.map(item => {
                  const active = item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);
                  const Icon = item.icon;
                  return (
                    <Link key={item.path} to={item.path} onClick={() => setOpen(false)} aria-current={active ? 'page' : undefined} className="relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BF8813]" style={{ color: active ? BLUE : '#526074', background: active ? 'rgba(191,136,19,.08)' : undefined }}>
                      {active && <span className="absolute bottom-2 left-0 top-2 w-1 rounded-r-full" style={{ background: GOLD }} />}
                      <Icon size={18} style={{ color: active ? GOLD : '#64748B' }} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
            {!user && (
              <div className="border-t border-slate-100 px-3 py-4">
                <button type="button" onClick={() => { setOpen(false); navigate('/accueil'); }} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition hover:bg-slate-50" style={{ color: BLUE }}>
                  <Home size={18} /> Retour à Omnia Global Academy
                </button>
              </div>
            )}
          </aside>
        </div>
      )}

      <main className="min-w-0">{children}</main>
    </div>
  );
}
