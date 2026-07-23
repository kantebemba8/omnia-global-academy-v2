import { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  BellRing,
  Building2,
  CalendarDays,
  ClipboardCheck,
  FileBadge2,
  Film,
  Gauge,
  ListChecks,
  LockKeyhole,
  Radio,
  RefreshCcw,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  Wallet,
} from 'lucide-react';

const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

type NavItem = {
  path: string;
  label: string;
  icon: typeof Gauge;
  exact?: boolean;
};

const NAV: NavItem[] = [
  { path: '/admin/omnia-live', label: 'Vue d’ensemble', icon: Gauge, exact: true },
  { path: '/admin/omnia-live/validation', label: 'Validation', icon: ListChecks },
  { path: '/admin/omnia-live/evenements', label: 'Événements', icon: CalendarDays },
  { path: '/admin/omnia-live/organisateurs', label: 'Organisateurs', icon: Users },
  { path: '/admin/omnia-live/structures', label: 'Structures & Packs', icon: Building2 },
  { path: '/admin/omnia-live/medias', label: 'Médias & Replays', icon: Film },
  { path: '/admin/omnia-live/documents', label: 'Documents & attestations', icon: FileBadge2 },
  { path: '/admin/omnia-live/finance', label: 'Finance & Payouts', icon: Wallet },
  { path: '/admin/omnia-live/operations', label: 'Opérations', icon: RefreshCcw },
  { path: '/admin/omnia-live/communications', label: 'Communication', icon: BellRing },
  { path: '/admin/omnia-live/automatisations', label: 'Automatisations', icon: SlidersHorizontal },
  { path: '/admin/omnia-live/analytics', label: 'Analytique', icon: BarChart3 },
  { path: '/admin/omnia-live/rapports', label: 'Rapports', icon: ClipboardCheck },
  { path: '/admin/omnia-live/securite', label: 'Sécurité', icon: LockKeyhole },
  { path: '/admin/omnia-live/integrite', label: 'Intégrité', icon: ShieldCheck },
  { path: '/admin/omnia-live/parametres', label: 'Paramètres', icon: Settings },
];

function Navigation({ mobile = false }: { mobile?: boolean }) {
  return (
    <nav
      className={mobile ? 'flex min-w-max gap-2' : 'space-y-1'}
      style={!mobile ? { scrollbarColor: `${GOLD} rgba(255,255,255,.08)` } : undefined}
    >
      {NAV.map(({ path, label, icon: Icon, exact }) => (
        <NavLink
          key={path}
          to={path}
          end={Boolean(exact)}
          className={({ isActive }) => mobile
            ? `inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${isActive ? 'text-white' : 'bg-white text-slate-600'}`
            : 'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition'
          }
          style={({ isActive }) => mobile
            ? (isActive ? { background: BLUE } : { border: `1px solid ${BORDER}` })
            : (isActive
              ? { background: 'rgba(191,136,19,.18)', color: GOLD }
              : { color: 'rgba(255,255,255,.78)' })
          }
        >
          <Icon size={16} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function AdminOmniaLiveShell({
  children,
  title,
  subtitle,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b bg-white" style={{ borderColor: BORDER }}>
        <div className="flex min-h-16 items-center justify-between gap-4 px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <img src="/omnia-sidebar-logo.png" alt="Omnia" className="h-10 w-10 rounded-lg object-contain" />
            <div>
              <p className="text-base font-bold leading-tight" style={{ color: BLUE }}>Omnia</p>
              <p className="text-base font-bold leading-tight" style={{ color: GOLD }}>Live</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link
              to="/omnia-live"
              className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-semibold"
              style={{ borderColor: BORDER, color: BLUE }}
            >
              <Radio size={15} /> Voir Omnia Live
            </Link>
            <Link
              to="/admin/omnia-live/creer"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"
              style={{ background: GOLD }}
            >
              + Créer un Live
            </Link>
            <Link
              to="/admin/dashboard"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"
              style={{ background: BLUE }}
            >
              <ArrowLeft size={15} /> Retour au Dashboard
            </Link>
          </div>
        </div>
        <div className="overflow-x-auto border-t px-3 py-2 lg:hidden" style={{ borderColor: BORDER }}>
          <Navigation mobile />
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-65px)]">
        <aside className="hidden w-64 flex-shrink-0 flex-col lg:flex" style={{ background: BLUE }}>
          <div className="flex items-center gap-3 border-b border-white/10 p-5">
            <img src="/omnia-sidebar-logo.png" alt="Omnia" className="h-10 w-10 object-contain" />
            <div>
              <p className="font-bold text-white">Omnia</p>
              <p className="font-bold" style={{ color: GOLD }}>Live</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3" style={{ scrollbarColor: `${GOLD} rgba(255,255,255,.08)` }}>
            <Navigation />
          </div>
          <div className="border-t border-white/10 p-3">
            <Link
              to="/admin/dashboard"
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold"
              style={{ color: GOLD }}
            >
              <ArrowLeft size={16} /> Retour au Dashboard
            </Link>
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            <header className="mb-6 border-b pb-5" style={{ borderColor: BORDER }}>
              <p className="text-xs font-semibold uppercase tracking-[.16em]" style={{ color: GOLD }}>Gestion Omnia Live</p>
              <h1 className="mt-1 text-2xl font-bold" style={{ color: BLUE }}>{title}</h1>
              {subtitle && <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{subtitle}</p>}
            </header>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
