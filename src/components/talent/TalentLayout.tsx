import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Briefcase, Compass, Home, Info, LogIn, Menu,
  MessageSquare, Search,
} from 'lucide-react';

const BLUE = '#002050';
const GOLD = '#BF8813';

type Props = { children: ReactNode };

type StoredUser = {
  full_name?: string;
  roles?: string[];
};

const NAV = [
  { label: 'Accueil Talent', path: '/talent', icon: Home, exact: true },
  { label: 'Explorer', path: '/talent/explorer', icon: Compass },
  { label: 'Communauté', path: '/forum', icon: MessageSquare, externalModule: true },
  { label: 'Pour les recruteurs', path: '/talent/recruteurs', icon: Briefcase },
  { label: 'À propos', path: '/talent/a-propos', icon: Info },
];

function initials(name?: string) {
  if (!name) return 'OA';
  const parts = name.trim().split(/\s+/);
  return parts.length > 1
    ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    : name.slice(0, 2).toUpperCase();
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

export function TalentLayout({ children }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);
  const returnPath = dashboardPath(user?.roles || []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('omnia_user');
      setUser(stored ? JSON.parse(stored) : null);
    } catch {
      setUser(null);
    }
  }, []);

  const sidebar = (
    <aside className="flex h-full flex-col" style={{ background: BLUE }}>
      <div className="border-b border-white/10 px-5 py-5">
        <Link to="/accueil" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ background: GOLD }}>
            OA
          </div>
          <div>
            <p className="text-sm font-bold leading-tight text-white">Talent Omnia</p>
            <p className="text-xs text-white/45">Omnia Global Academy</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV.map(item => {
          const active = item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors"
              style={{
                background: active ? 'rgba(191,136,19,0.15)' : 'transparent',
                color: active ? GOLD : 'rgba(255,255,255,0.68)',
              }}
            >
              <Icon size={18} />
              <span className="flex-1 text-sm font-medium">{item.label}</span>
              {item.externalModule && <span className="text-[10px] text-white/35">Forum</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-3 py-4">
        {user ? (
          <div className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold" style={{ background: GOLD, color: BLUE }}>
              {initials(user.full_name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{user.full_name || 'Compte Omnia'}</p>
              <button
                type="button"
                onClick={() => navigate(returnPath)}
                className="text-xs text-white/50 hover:text-white"
              >
                Retour au Dashboard
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => navigate('/connexion')}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 px-3 py-2.5 text-sm font-medium text-white"
            >
              <LogIn size={16} /> Se connecter
            </button>
            <button
              type="button"
              onClick={() => navigate('/recruteur')}
              className="w-full rounded-lg px-3 py-2.5 text-sm font-semibold"
              style={{ background: GOLD, color: BLUE }}
            >
              Compte recruteur
            </button>
          </div>
        )}
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen" style={{ fontFamily: 'Inter, system-ui, sans-serif', background: '#F8F9FA' }}>
      <aside className="hidden min-h-screen w-[260px] flex-shrink-0 md:block">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button className="absolute inset-0 bg-black/45" onClick={() => setOpen(false)} aria-label="Fermer le menu" />
          <div className="absolute bottom-0 left-0 top-0 w-[260px]">{sidebar}</div>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-white px-4 md:px-6" style={{ borderColor: '#E4E7EC' }}>
          <div className="flex items-center gap-3">
            <button type="button" className="rounded-lg p-2 md:hidden" onClick={() => setOpen(true)} aria-label="Ouvrir le menu">
              <Menu size={20} color={BLUE} />
            </button>
            <div>
              <p className="text-sm font-semibold" style={{ color: BLUE }}>Talent Omnia</p>
              <p className="hidden text-xs text-gray-500 sm:block">Découvrez les profils publics de la communauté Omnia</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user && (
              <button type="button" onClick={() => navigate(returnPath)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium" style={{ borderColor: '#E4E7EC', color: BLUE }}>
                <ArrowLeft size={16} /> <span className="hidden sm:inline">Retour au Dashboard</span>
              </button>
            )}
            <Link to="/talent/explorer" className="hidden items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium sm:flex" style={{ borderColor: '#E4E7EC', color: BLUE }}>
              <Search size={16} /> Explorer
            </Link>
            {!user && (
              <Link to="/recruteur" className="rounded-lg px-3 py-2 text-sm font-semibold text-white" style={{ background: BLUE }}>
                Recruteur
              </Link>
            )}
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
