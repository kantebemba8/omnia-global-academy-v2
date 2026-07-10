import { ReactNode } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import {
  Bell, Briefcase, ChevronDown, ChevronsLeft, Crown, FileText, LayoutDashboard,
  Mail, MessageSquare, Search, Settings, Star, User,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getInitials } from '../utils/omniaCareerAccess';

type Props = { children?: ReactNode };

type NavItem = {
  label: string;
  path: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
};

const CAREER_NAV_ITEMS: NavItem[] = [
  { label: 'Tableau de bord', path: '/omnia-career', icon: LayoutDashboard, end: true },
  { label: 'CV Builder', path: '/omnia-career/cv-builder', icon: FileText },
  { label: 'Lettres de motivation', path: '/omnia-career/lettres', icon: Mail },
  { label: 'Préparation entretien', path: '/omnia-career/entretien', icon: MessageSquare },
  { label: 'Suivi candidatures', path: '/omnia-career/candidatures', icon: Briefcase },
  { label: 'Profil carrière', path: '/omnia-career/profil', icon: User },
  { label: 'Coaching carrière', path: '/omnia-career/coaching', icon: Star },
  { label: 'Paramètres', path: '/omnia-career/parametres', icon: Settings },
];

export default function OmniaCareerLayout({ children }: Props) {
  const { user } = useAuth();
  const fullName = user?.full_name || 'Lina Amani';
  const initials = getInitials(fullName, user?.email);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <div className="flex min-h-screen">
        <aside className="fixed left-0 top-0 z-40 flex h-screen w-[280px] flex-col bg-[#031B32] text-white shadow-2xl">
          <div className="px-6 pb-6 pt-7">
            <Link to="/" className="flex items-center gap-3">
              {/* Remplacez ce bloc par <img src='/IMG_0349.png' ... /> si vous voulez utiliser l'image exacte existante. */}
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#D6A11E]/60 bg-[#061B3A] text-[#D6A11E] shadow-inner">
                <span className="text-2xl font-black">O</span>
              </div>
              <div className="leading-tight">
                <div className="font-serif text-[31px] tracking-wide text-white">OMNIA</div>
                <div className="text-[11px] font-bold tracking-[0.18em] text-white/80">GLOBAL ACADEMY</div>
              </div>
            </Link>

            <div className="mt-8">
              <h2 className="text-[22px] font-bold text-[#F6C64A]">Omnia Career</h2>
              <div className="mt-3 h-[2px] w-10 rounded-full bg-[#D6A11E]" />
            </div>
          </div>

          <nav className="flex-1 space-y-1 px-3">
            {CAREER_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.end}
                  className={({ isActive }) =>
                    [
                      'group relative flex h-12 items-center gap-3 rounded-xl px-4 text-[15px] font-semibold transition-all duration-200',
                      isActive ? 'bg-[#0B2A5B] text-white shadow-lg' : 'text-white/86 hover:bg-white/10 hover:text-white',
                    ].join(' ')
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && <span className="absolute left-0 top-2 h-8 w-1 rounded-r-full bg-[#D6A11E]" />}
                      <Icon className={`h-5 w-5 ${isActive ? 'text-[#F6C64A]' : 'text-white/82 group-hover:text-[#F6C64A]'}`} />
                      <span>{item.label}</span>
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>

          <div className="px-5 pb-7">
            <div className="rounded-2xl border border-[#D6A11E]/35 bg-white/5 p-5 shadow-lg backdrop-blur">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#D6A11E] text-[#061B3A]">
                <Crown className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-black text-[#F6C64A]">Passez à Premium</h3>
              <p className="mt-2 text-sm leading-6 text-white/78">Accédez à des modèles exclusifs, des analyses avancées et plus.</p>
              <button type="button" className="mt-5 h-11 w-full rounded-xl bg-[#F6C64A] text-sm font-black text-[#061B3A] shadow-md transition hover:bg-[#D6A11E]">
                Découvrir Premium
              </button>
            </div>
            <button type="button" aria-label="Réduire le menu" className="ml-auto mt-5 flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white">
              <ChevronsLeft className="h-5 w-5" />
            </button>
          </div>
        </aside>

        <div className="ml-[280px] flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-slate-200 bg-white/92 px-8 backdrop-blur">
            <div className="flex w-full max-w-[620px] items-center">
              <div className="flex h-12 w-full items-center rounded-2xl border border-slate-200 bg-white px-4 shadow-sm transition focus-within:border-[#D6A11E] focus-within:ring-4 focus-within:ring-[#D6A11E]/10">
                <Search className="mr-3 h-5 w-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher un CV, une offre, un conseil..."
                  className="h-full flex-1 border-0 bg-transparent text-[15px] text-slate-700 outline-none placeholder:text-slate-400"
                />
                <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500">⌘ K</span>
              </div>
            </div>

            <div className="ml-6 flex items-center gap-5">
              <button type="button" aria-label="Notifications" className="relative flex h-11 w-11 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100">
                <Bell className="h-5 w-5" />
                <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#D6A11E] text-[11px] font-black text-white">3</span>
              </button>
              <div className="h-9 w-px bg-slate-200" />
              <button type="button" className="flex items-center gap-3 rounded-2xl px-2 py-1.5 transition hover:bg-slate-100">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#061B3A] text-sm font-black text-white">{initials}</div>
                <div className="hidden text-left md:block">
                  <div className="text-sm font-black text-slate-900">{fullName}</div>
                  <div className="text-xs font-semibold text-slate-500">Apprenant</div>
                </div>
                <ChevronDown className="h-4 w-4 text-slate-500" />
              </button>
            </div>
          </header>

          <main className="flex-1 px-8 py-8">{children ?? <Outlet />}</main>
        </div>
      </div>
    </div>
  );
}
