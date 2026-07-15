import { ReactNode, useMemo } from 'react';
import { useCareerAutoTranslate } from '../../lib/careerAutoTranslate';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  Briefcase,
  ChevronDown,
  ChevronRight,
  Crown,
  FileText,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  Search,
  Settings,
  Star,
  UserRound,
} from 'lucide-react';

type CareerSection =
  | 'dashboard'
  | 'cv'
  | 'letters'
  | 'interview'
  | 'applications'
  | 'profile'
  | 'coaching'
  | 'settings';

type StoredUser = {
  full_name?: string;
  email?: string;
  ai_tokens?: number;
  roles?: string[];
};

type NavItem = {
  key: CareerSection;
  label: string;
  icon: typeof LayoutDashboard;
};

const BLUE = '#002050';
const GOLD = '#bf8813';

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { key: 'cv', label: 'CV Builder', icon: FileText },
  { key: 'letters', label: 'Lettres de motivation', icon: Mail },
  { key: 'interview', label: 'Préparation entretien', icon: MessageSquare },
  { key: 'applications', label: 'Suivi candidatures', icon: Briefcase },
  { key: 'profile', label: 'Profil carrière', icon: UserRound },
  { key: 'coaching', label: 'Coaching carrière', icon: Star },
  { key: 'settings', label: 'Paramètres', icon: Settings },
];

const SECTION_TO_URL: Record<CareerSection, string> = {
  dashboard: '/dashboard/career-studio',
  cv: '/dashboard/career-studio?section=cv',
  letters: '/dashboard/career-studio?section=lm',
  interview: '/dashboard/career-studio?section=interview',
  applications: '/dashboard/career-studio?section=applications',
  profile: '/dashboard/career-studio?section=profile',
  coaching: '/dashboard/career-studio?section=coaching',
  settings: '/dashboard/career-studio?section=settings',
};

function readStoredUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem('omnia_user');
    return raw ? JSON.parse(raw) as StoredUser : null;
  } catch {
    return null;
  }
}

function initials(name?: string, email?: string): string {
  const base = (name || email || 'Apprenant').trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

export function OmniaCareerShell({
  activeSection,
  children,
}: {
  activeSection: CareerSection;
  children: ReactNode;
}) {
  useCareerAutoTranslate();
  const navigate = useNavigate();
  const user = useMemo(() => readStoredUser(), []);
  const displayName = user?.full_name || 'Apprenant';
  const monogram = initials(displayName, user?.email);

  function logout() {
    localStorage.removeItem('omnia_session_token');
    localStorage.removeItem('omnia_user');
    navigate('/connexion');
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <aside className="hidden h-full flex-shrink-0 flex-col lg:flex" style={{ width: 260, backgroundColor: BLUE }}>
        <div className="border-b border-white/10 px-6 py-5">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white" style={{ backgroundColor: GOLD }}>OA</div>
            <span className="text-base font-bold leading-tight text-white">Omnia Global<br />Academy</span>
          </Link>
        </div>

        <div className="mx-3 mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold" style={{ backgroundColor: GOLD, color: BLUE }}>{monogram}</div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{displayName}</p>
              <p className="truncate text-xs text-white/50">Apprenant</p>
            </div>
          </div>
          {typeof user?.ai_tokens === 'number' && (
            <div className="mt-3 flex items-center gap-1.5 text-xs" style={{ color: GOLD }}>
              <Star className="h-3.5 w-3.5" />
              <span>{user.ai_tokens} jeton{user.ai_tokens !== 1 ? 's' : ''} IA</span>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => navigate(SECTION_TO_URL[item.key])}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-all duration-150"
                style={{ backgroundColor: active ? 'rgba(191,136,19,0.15)' : 'transparent', color: active ? GOLD : 'rgba(255,255,255,0.65)' }}
              >
                <Icon style={{ width: 18, height: 18, flexShrink: 0 }} />
                <span className="flex-1">{item.label}</span>
                {active && <ChevronRight className="h-3.5 w-3.5 opacity-60" />}
              </button>
            );
          })}
        </nav>
        <div className="px-3 pb-5">
          <button type="button" onClick={() => navigate('/dashboard/career-studio?section=settings')} className="mb-2 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition hover:opacity-90" style={{ backgroundColor: GOLD, color: BLUE }}>
            <Crown className="h-[18px] w-[18px]" /> Passer à Premium
          </button>
          <button onClick={logout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/50 transition hover:bg-white/5 hover:text-white">
            <LogOut style={{ width: 18, height: 18 }} />
            Déconnexion
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-[64px] items-center justify-between border-b border-gray-200 bg-white px-4 lg:h-[68px] lg:px-6">
          <div className="flex items-center gap-3">
            <button className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100 lg:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden h-10 w-[420px] items-center rounded-xl border border-gray-200 bg-white px-3 lg:flex">
              <Search className="h-4 w-4 text-gray-400" />
              <input className="ml-2 h-full flex-1 border-0 bg-transparent text-sm outline-none" placeholder="Rechercher un CV, une offre, un conseil..." />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" className="relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100">
              <Bell className="h-5 w-5" style={{ color: BLUE }} />
              <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: GOLD }} />
            </button>
            <button type="button" className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100">
              <div className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: BLUE }}>{monogram}</div>
              <div className="hidden text-left sm:block">
                <div className="text-sm font-semibold" style={{ color: BLUE }}>{displayName}</div>
                <div className="text-xs text-gray-500">Apprenant</div>
              </div>
              <ChevronDown className="h-4 w-4 text-gray-500" />
            </button>
          </div>
        </div>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

export type { CareerSection };
