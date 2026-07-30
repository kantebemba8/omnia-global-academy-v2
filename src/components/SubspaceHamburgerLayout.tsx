import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, ChevronDown, Home, LogOut, Menu, Radio, Search, UserRound } from 'lucide-react';

const BLUE = '#002050';
const GOLD = '#BF8813';

export type SubspaceNavItem = {
  label: string;
  path: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  exact?: boolean;
};

type StoredUser = { full_name?: string; name?: string; email?: string; roles?: string[] };

type Props = {
  title: string;
  navItems: SubspaceNavItem[];
  children: ReactNode;
  searchPlaceholder?: string;
  showSearch?: boolean;
  rightContent?: ReactNode;
};

export function getDashboardPath(roles: string[] = []) {
  if (roles.includes('super_admin')) return '/admin/dashboard';
  if (roles.includes('organizer') || roles.includes('organisateur')) return '/omnia-live/organisateur';
  if (roles.includes('responsable_structure') || roles.includes('structure_admin') || roles.includes('directeur')) return '/structure/dashboard';
  if (roles.includes('recruteur')) return '/talent/recruteur/dashboard';
  if (roles.includes('professeur') || roles.includes('formateur')) return '/professeur/dashboard';
  if (roles.includes('enseignant') || roles.includes('etablissement_enseignant')) return '/professeur/dashboard';
  if (roles.includes('moderateur')) return '/moderateur/dashboard';
  return '/dashboard';
}

export function getProfilePath(roles: string[] = []) {
  // IMPORTANT: always use the REAL authenticated role.
  // A preview URL (?preview=true) must never change the personal profile destination.
  if (roles.includes('super_admin')) return '/admin/profil';
  if (roles.includes('responsable_structure') || roles.includes('structure_admin') || roles.includes('directeur')) return '/structure/profil';
  if (roles.includes('recruteur')) return '/talent/recruteur/profil';
  if (roles.includes('professeur') || roles.includes('formateur')) return '/professeur/profile';
  return '/dashboard/profil';
}

function initials(user: StoredUser | null) {
  const source = user?.full_name || user?.name || user?.email || 'Omnia';
  const parts = source.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : source.slice(0, 2).toUpperCase();
}

export default function SubspaceHamburgerLayout({ title, navItems, children, searchPlaceholder, showSearch = true, rightContent }: Props) {
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const user = useMemo<StoredUser | null>(() => {
    try { const raw = localStorage.getItem('omnia_user'); return raw ? JSON.parse(raw) : null; } catch { return null; }
  }, []);
  const roles = user?.roles || [];
  const dashboardPath = getDashboardPath(roles);
  const profilePath = getProfilePath(roles);
  const isSuperAdmin = roles.includes('super_admin');
  const isOrganizer = roles.some(r => ['organizer','organisateur','professeur','formateur','responsable_structure','structure_admin','directeur'].includes(r))
    || Boolean((user as any)?.omnia_live_organizer);

  useEffect(() => {
    if (!open && !profileOpen) return;
    const previousOverflow = document.body.style.overflow;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setProfileOpen(false);
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
  }, [location.pathname, location.search]);

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
          <img src="/IMG_0349.png" alt="Omnia Global Academy" className="h-9 w-9 rounded-lg object-cover" />
          {title === 'Omnia Live' ? (
            <button type="button" onClick={() => navigate('/omnia-live')} className="truncate text-lg font-bold transition hover:opacity-80 md:text-xl" aria-label="Accueil Omnia Live">
              <span>Omnia </span><span style={{ color: GOLD }}>Live</span>
            </button>
          ) : title === 'Omnia Talent' ? (
            <button type="button" onClick={() => navigate('/talent')} className="truncate text-lg font-bold transition hover:opacity-80 md:text-xl" aria-label="Accueil Omnia Talent">
              <span>Omnia </span><span style={{ color: GOLD }}>Talent</span>
            </button>
          ) : title === 'Omnia Projects' ? (
            <button type="button" onClick={() => navigate('/projects')} className="truncate text-lg font-bold transition hover:opacity-80 md:text-xl" aria-label="Accueil Omnia Projects">
              <span>Omnia </span><span style={{ color: GOLD }}>Projects</span>
            </button>
          ) : title === 'Omnia Career Studio' ? (
            <div className="truncate text-lg font-bold md:text-xl"><span>Omnia </span><span style={{ color: GOLD }}>Career Studio</span></div>
          ) : (
            <div className="truncate text-lg font-bold md:text-xl">{title}</div>
          )}
        </div>

        {showSearch && (
          <div className="mx-5 hidden w-full max-w-[420px] items-center rounded-xl border border-slate-200 bg-white px-3 lg:flex">
            <Search size={17} className="text-slate-400" />
            <input aria-label={searchPlaceholder || `Rechercher dans ${title}`} className="h-10 flex-1 border-0 bg-transparent px-2 text-sm outline-none focus-visible:ring-0" placeholder={searchPlaceholder || `Rechercher dans ${title}...`} />
          </div>
        )}

        <div className="flex flex-shrink-0 items-center gap-3">
          {rightContent}
          {user ? (
            <button type="button" onClick={() => navigate(dashboardPath)} className="hidden items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition hover:bg-slate-100 sm:flex">
              <ArrowLeft size={16} /> Retour au Dashboard
            </button>
          ) : (
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
                <span className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: BLUE }}>{initials(user)}</span>
                <ChevronDown size={15} className="text-slate-400" />
              </button>

              {profileOpen && (
                <>
                  <button
                    type="button"
                    aria-label="Fermer le menu du profil"
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={() => setProfileOpen(false)}
                  />
                  <div className="absolute right-0 top-12 z-50 w-[235px] overflow-hidden rounded-2xl border border-slate-200 bg-white py-2 shadow-xl" role="menu">
                    <button type="button" role="menuitem" onClick={() => navigate(profilePath)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold hover:bg-slate-50">
                      <UserRound size={17} /> Mon profil
                    </button>
                    <button type="button" role="menuitem" onClick={() => navigate('/omnia-live/notifications')} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold hover:bg-slate-50">
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
                    <button type="button" role="menuitem" onClick={() => navigate(dashboardPath)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold hover:bg-slate-50">
                      <ArrowLeft size={17} /> Retour au Dashboard
                    </button>
                    <div className="my-1 border-t border-slate-100" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        localStorage.removeItem('omnia_user');
                        localStorage.removeItem('omnia_session_token');
                        localStorage.removeItem('omnia_access_token');
                        localStorage.removeItem('access_token');
                        navigate('/connexion');
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
          <aside id="subspace-navigation-drawer" className="absolute left-3 top-[84px] w-[286px] max-w-[86vw] max-h-[calc(100vh-100px)] overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-5">
              <img src="/IMG_0349.png" alt="Omnia Global Academy" className="h-12 w-12 rounded-xl object-cover" />
              <div className="min-w-0">
                <div className="truncate text-base font-bold tracking-wide" style={{ color: BLUE }}>OMNIA</div>
                <div className="text-[10px] font-semibold tracking-[0.15em] text-slate-500">GLOBAL ACADEMY</div>
              </div>
            </div>
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
            <div className="mt-auto border-t border-slate-100 px-3 py-4">
              <button type="button" onClick={() => { setOpen(false); navigate(user ? dashboardPath : '/accueil'); }} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition hover:bg-slate-50" style={{ color: BLUE }}>
                {user ? <ArrowLeft size={18} /> : <Home size={18} />}
                {user ? 'Retour au Dashboard' : 'Retour à Omnia Global Academy'}
              </button>
            </div>
          </aside>
        </div>
      )}

      <main className="min-w-0">{children}</main>
    </div>
  );
}
