import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, ChevronDown, Home, LogOut, Menu, Search, UserRound, Video } from 'lucide-react';

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
  profileSpaceLabel?: string;
  profileSpacePath?: string;
};

export function getDashboardPath(roles: string[] = []) {
  if (roles.includes('super_admin')) return '/admin/dashboard';
  if (roles.includes('responsable_structure') || roles.includes('structure_admin') || roles.includes('directeur')) return '/structure/dashboard';
  if (roles.includes('recruteur')) return '/talent/recruteur/dashboard';
  if (roles.includes('professeur') || roles.includes('formateur')) return '/professeur/dashboard';
  if (roles.includes('enseignant')) return '/staff/dashboard';
  if (roles.includes('moderateur')) return '/moderateur/dashboard';
  return '/dashboard';
}

function initials(user: StoredUser | null) {
  const source = user?.full_name || user?.name || user?.email || 'Omnia';
  const parts = source.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : source.slice(0, 2).toUpperCase();
}

export default function SubspaceHamburgerLayout({ title, navItems, children, searchPlaceholder, showSearch = true, rightContent, profileSpaceLabel, profileSpacePath }: Props) {
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const user = useMemo<StoredUser | null>(() => {
    try { const raw = localStorage.getItem('omnia_user'); return raw ? JSON.parse(raw) : null; } catch { return null; }
  }, []);
  const dashboardPath = getDashboardPath(user?.roles || []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); setProfileOpen(false); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => { setOpen(false); setProfileOpen(false); }, [location.pathname, location.search]);

  function logout() {
    localStorage.removeItem('omnia_session_token');
    localStorage.removeItem('omnia_user');
    setProfileOpen(false);
    navigate('/connexion');
  }

  const liveRoleLabel = profileSpaceLabel || (title === 'Omnia Live'
    ? ((user?.roles || []).includes('super_admin') ? 'Administration Omnia Live'
      : (user?.roles || []).some(r => ['professeur','formateur','responsable_structure','structure_admin','directeur'].includes(r)) || (user as any)?.omnia_live_organizer ? 'Espace Organisateur' : 'Mes Lives')
    : title);
  const liveRolePath = profileSpacePath || (title === 'Omnia Live'
    ? ((user?.roles || []).includes('super_admin') ? '/admin/omnia-live'
      : (user?.roles || []).some(r => ['professeur','formateur','responsable_structure','structure_admin','directeur'].includes(r)) || (user as any)?.omnia_live_organizer ? '/omnia-live/organisateur' : '/omnia-live/mes-lives')
    : dashboardPath);

  return (
    <div className="min-h-screen bg-white" style={{ color: BLUE }}>
      <header className="sticky top-0 z-40 flex h-[72px] items-center border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-7">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            aria-label={open ? 'Replier le menu' : 'Ouvrir le menu'}
            aria-expanded={open}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition hover:bg-slate-100"
            style={{ color: open ? GOLD : BLUE }}
          >
            <Menu size={23} />
          </button>
          <img src="/IMG_0349.png" alt="Omnia Global Academy" className="h-9 w-9 rounded-lg object-cover" />
          <div className="truncate text-lg font-bold md:text-xl">{title}</div>
        </div>

        {showSearch && (
          <div className="mx-5 hidden w-full max-w-[420px] items-center rounded-xl border border-slate-200 bg-white px-3 lg:flex">
            <Search size={17} className="text-slate-400" />
            <input className="h-10 flex-1 border-0 bg-transparent px-2 text-sm outline-none" placeholder={searchPlaceholder || `Rechercher dans ${title}...`} />
          </div>
        )}

        <div className="flex flex-shrink-0 items-center gap-3">
          {rightContent}
          {user ? (
            <div className="relative">
              <button type="button" onClick={() => setProfileOpen(v => !v)} className="flex items-center gap-2 rounded-xl px-1.5 py-1 transition hover:bg-slate-100" aria-expanded={profileOpen}>
                <div className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: BLUE }}>{initials(user)}</div>
                <ChevronDown size={15} className={`text-slate-400 transition ${profileOpen ? 'rotate-180' : ''}`} />
              </button>
              {profileOpen && <>
                <button type="button" className="fixed inset-0 z-40 cursor-default" onClick={() => setProfileOpen(false)} aria-label="Fermer le menu profil" />
                <div className="absolute right-0 top-12 z-50 w-[235px] overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl">
                  <button onClick={() => {setProfileOpen(false);navigate('/profil')}} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-slate-50"><UserRound size={17}/>Mon profil</button>
                  <button onClick={() => {setProfileOpen(false);navigate(title === 'Omnia Live' ? '/omnia-live/notifications' : '/notifications')}} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-slate-50"><Bell size={17}/>Notifications</button>
                  <button onClick={() => {setProfileOpen(false);navigate(liveRolePath)}} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-slate-50"><Video size={17}/>{liveRoleLabel}</button>
                  <button onClick={() => {setProfileOpen(false);navigate(dashboardPath)}} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-slate-50"><ArrowLeft size={17}/>Retour au Dashboard</button>
                  <div className="my-1 border-t border-slate-100"/>
                  <button onClick={logout} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"><LogOut size={17}/>Se déconnecter</button>
                </div>
              </>}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => navigate('/connexion')} className="rounded-lg px-3 py-2 text-sm font-semibold hover:bg-slate-100">Se connecter</button>
              <button type="button" onClick={() => navigate('/inscription')} className="hidden rounded-lg px-3 py-2 text-sm font-bold text-white sm:block" style={{background:BLUE}}>Créer un compte</button>
            </div>
          )}
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50">
          <button type="button" className="absolute inset-0 bg-slate-950/25 backdrop-blur-[1px]" onClick={() => setOpen(false)} aria-label="Fermer le menu en cliquant à l’extérieur" />
          <aside className="absolute left-3 top-[84px] w-[286px] max-w-[86vw] max-h-[calc(100vh-100px)] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
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
                  <Link key={item.path} to={item.path} onClick={() => setOpen(false)} className="relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition hover:bg-slate-50" style={{ color: active ? BLUE : '#526074', background: active ? 'rgba(191,136,19,.08)' : undefined }}>
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
