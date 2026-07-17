import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Briefcase, Compass, Home, Info, LogIn, Menu,
  MessageSquare, Search, X,
} from 'lucide-react';

const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

type Props = { children: ReactNode };
type StoredUser = { full_name?: string; roles?: string[] };

const NAV = [
  { label: 'Accueil Talent', path: '/talent', icon: Home, exact: true },
  { label: 'Explorer', path: '/talent/explorer', icon: Compass },
  { label: 'Communauté', path: '/talent/communaute', icon: MessageSquare },
  { label: 'Pour les recruteurs', path: '/talent/recruteurs', icon: Briefcase },
  { label: 'À propos', path: '/talent/a-propos', icon: Info },
];

function initials(name?: string) {
  if (!name) return 'OA';
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : name.slice(0, 2).toUpperCase();
}

function dashboardPath(roles: string[] = []) {
  if (roles.includes('super_admin')) return '/admin/dashboard';
  if (roles.includes('responsable_structure') || roles.includes('structure_admin') || roles.includes('directeur')) return '/structure/dashboard';
  if (roles.includes('recruteur')) return '/talent/recruteur/dashboard';
  if (roles.includes('professeur') || roles.includes('formateur')) return '/professeur/dashboard';
  if (roles.includes('enseignant')) return '/staff/dashboard';
  if (roles.includes('moderateur')) return '/moderateur/dashboard';
  return '/dashboard';
}

function pageLabel(pathname: string) {
  if (pathname === '/talent') return 'Accueil';
  if (pathname.startsWith('/talent/explorer')) return 'Explorer';
  if (pathname.startsWith('/talent/communaute')) return 'Communauté';
  if (pathname.startsWith('/talent/recruteurs')) return 'Pour les recruteurs';
  if (pathname.startsWith('/talent/a-propos')) return 'À propos';
  if (pathname.startsWith('/talent/profil/')) return 'Profil public';
  return 'Talent Omnia';
}

export function TalentLayout({ children }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [query, setQuery] = useState('');
  const returnPath = dashboardPath(user?.roles || []);
  const currentLabel = useMemo(() => pageLabel(location.pathname), [location.pathname]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('omnia_user');
      setUser(stored ? JSON.parse(stored) : null);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const value = query.trim();
    navigate(value ? `/talent/explorer?q=${encodeURIComponent(value)}` : '/talent/explorer');
    setOpen(false);
  }

  return (
    <div className="min-h-screen" style={{ fontFamily: 'Inter, system-ui, sans-serif', background: '#F8F9FA' }}>
      <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur" style={{ borderColor: BORDER }}>
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-3 px-4 md:px-6">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border bg-white transition hover:bg-gray-50"
            style={{ borderColor: BORDER }}
            onClick={() => setOpen(true)}
            aria-label="Ouvrir le menu Talent Omnia"
          >
            <Menu size={21} color={BLUE} />
          </button>

          <Link to="/talent" className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl text-sm font-bold text-white" style={{ background: GOLD }}>OA</div>
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-sm font-bold" style={{ color: BLUE }}>Talent Omnia</p>
              <p className="truncate text-xs text-gray-500">Omnia Global Academy</p>
            </div>
          </Link>

          <form onSubmit={submitSearch} className="relative ml-0 hidden max-w-2xl flex-1 md:block lg:ml-5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Rechercher un talent, une compétence, une entreprise..."
              className="h-10 w-full rounded-xl border bg-gray-50 pl-10 pr-4 text-sm outline-none transition focus:bg-white"
              style={{ borderColor: BORDER }}
            />
          </form>

          <div className="ml-auto flex items-center gap-2">
            <Link to="/talent/explorer" className="inline-flex h-10 w-10 items-center justify-center rounded-xl border md:hidden" style={{ borderColor: BORDER }} aria-label="Rechercher">
              <Search size={18} color={BLUE} />
            </Link>
            {user ? (
              <button type="button" onClick={() => navigate(returnPath)} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium" style={{ borderColor: BORDER, color: BLUE }}>
                <ArrowLeft size={16} /><span className="hidden lg:inline">Retour au Dashboard</span>
              </button>
            ) : (
              <Link to="/connexion" className="rounded-xl px-3 py-2 text-sm font-semibold text-white" style={{ background: BLUE }}>Se connecter</Link>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-4 pt-4 md:px-6">
        <nav className="flex items-center gap-2 text-xs text-gray-500" aria-label="Fil d’Ariane">
          <Link to="/talent" className="hover:underline">Talent Omnia</Link>
          <span>/</span>
          <span className="font-medium" style={{ color: BLUE }}>{currentLabel}</span>
        </nav>
      </div>

      <main>{children}</main>

      <div className={`fixed inset-0 z-50 transition ${open ? 'pointer-events-auto' : 'pointer-events-none'}`} aria-hidden={!open}>
        <button className={`absolute inset-0 bg-black/45 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`} onClick={() => setOpen(false)} aria-label="Fermer le menu" />
        <aside className={`absolute bottom-0 left-0 top-0 w-[88vw] max-w-[320px] transform shadow-2xl transition-transform duration-200 ${open ? 'translate-x-0' : '-translate-x-full'}`} style={{ background: BLUE }}>
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
            <Link to="/talent" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ background: GOLD }}>OA</div>
              <div><p className="text-sm font-bold text-white">Talent Omnia</p><p className="text-xs text-white/50">Omnia Global Academy</p></div>
            </Link>
            <button onClick={() => setOpen(false)} className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Fermer"><X size={20}/></button>
          </div>

          <form onSubmit={submitSearch} className="relative mx-4 mt-4 md:hidden">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/45" size={16}/>
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Rechercher..." className="h-10 w-full rounded-xl border border-white/10 bg-white/10 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/40" />
          </form>

          <nav className="space-y-1 px-3 py-5">
            {NAV.map(item => {
              const active = item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);
              const Icon = item.icon;
              return (
                <Link key={item.path} to={item.path} className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors" style={{ background: active ? 'rgba(191,136,19,.16)' : 'transparent', color: active ? GOLD : 'rgba(255,255,255,.72)' }}>
                  <Icon size={18}/><span className="text-sm font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 p-4">
            {user ? (
              <button onClick={() => navigate(returnPath)} className="flex w-full items-center gap-3 rounded-xl bg-white/5 p-3 text-left">
                <div className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold" style={{ background: GOLD, color: BLUE }}>{initials(user.full_name)}</div>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white">{user.full_name || 'Compte Omnia'}</p><p className="text-xs text-white/50">Retour au Dashboard</p></div>
              </button>
            ) : (
              <div className="grid gap-2">
                <button onClick={() => navigate('/connexion')} className="flex items-center justify-center gap-2 rounded-xl border border-white/15 px-3 py-2.5 text-sm font-medium text-white"><LogIn size={16}/>Se connecter</button>
                <button onClick={() => navigate('/recruteur')} className="rounded-xl px-3 py-2.5 text-sm font-semibold" style={{ background: GOLD, color: BLUE }}>Compte recruteur</button>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
