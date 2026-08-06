import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3, BellRing, Building2, CalendarDays, ClipboardCheck, FileBadge2,
  Film, Gauge, ListChecks, LockKeyhole, Radio, RefreshCcw, Settings,
  ShieldCheck, SlidersHorizontal, Users, Wallet,
} from 'lucide-react';
import { DashboardLayout, type NavGroup } from '../../../components/DashboardLayout';

const GROUPS: NavGroup[] = [
  { id: 'live-pilotage', label: 'Pilotage', icon: Gauge, items: [
    { path: '/admin/omnia-live', label: 'Vue d’ensemble', icon: Gauge, exact: true },
    { path: '/admin/omnia-live/validation', label: 'Validation & événements', icon: ListChecks },
    { path: '/admin/omnia-live/evenements', label: 'Tous les événements', icon: CalendarDays },
  ]},
  { id: 'live-management', label: 'Gestion', icon: Users, items: [
    { path: '/admin/omnia-live/organisateurs', label: 'Organisateurs', icon: Users },
    { path: '/admin/omnia-live/structures', label: 'Structures', icon: Building2 },
    { path: '/admin/omnia-live/medias', label: 'Médias, replays & documents', icon: Film },
    { path: '/admin/omnia-live/documents', label: 'Certificats & attestations', icon: FileBadge2 },
    { path: '/admin/omnia-live/communications', label: 'Communication', icon: BellRing },
  ]},
  { id: 'live-finance', label: 'Finance & opérations', icon: Wallet, items: [
    { path: '/admin/omnia-live/finance', label: 'Finance & Payouts', icon: Wallet },
    { path: '/admin/omnia-live/operations', label: 'Opérations & automatisations', icon: RefreshCcw },
    { path: '/admin/omnia-live/automatisations', label: 'Règles automatiques', icon: SlidersHorizontal },
  ]},
  { id: 'live-control', label: 'Contrôle', icon: ShieldCheck, items: [
    { path: '/admin/omnia-live/analytics', label: 'Analytique', icon: BarChart3 },
    { path: '/admin/omnia-live/rapports', label: 'Rapports & exports', icon: ClipboardCheck },
    { path: '/admin/omnia-live/securite', label: 'Sécurité & intégrité', icon: LockKeyhole },
    { path: '/admin/omnia-live/integrite', label: 'Contrôles d’intégrité', icon: ShieldCheck },
    { path: '/admin/omnia-live/parametres', label: 'Paramètres', icon: Settings },
  ]},
];

export default function AdminOmniaLiveShell({ children, title, subtitle }: { children: ReactNode; title: string; subtitle?: string }) {
  const actions = (
    <div className="hidden items-center gap-2 sm:flex">
      <Link to="/omnia-live" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-[#002050] hover:bg-slate-50"><Radio size={15} /> Voir Omnia Live</Link>
      <Link to="/admin/omnia-live/creer" className="rounded-xl bg-[#BF8813] px-3 py-2 text-sm font-semibold text-[#002050]">Créer un Live</Link>
    </div>
  );

  return (
    <DashboardLayout
      role="super_admin"
      navGroups={GROUPS}
      headerTitle={title}
      headerSubtitle={subtitle || 'Gestion Omnia Live'}
      headerActions={actions}
      dashboardPath="/admin/dashboard"
      brandTitle="Omnia"
      brandAccent="Live"
      spaceHomePath="/admin/dashboard"
      spaceHomeLabel="Retour à l’administration"
    >
      <div className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8">{children}</div>
    </DashboardLayout>
  );
}
