import type { ReactNode } from 'react';
import {
  CalendarDays, CircleDollarSign, ExternalLink, FolderCog, LayoutDashboard,
  ListChecks, Package, Star, Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { DashboardLayout, type NavGroup } from '../DashboardLayout';
import ContextualHeaderSearch from '../ContextualHeaderSearch';

const GROUPS: NavGroup[] = [
  {
    id: 'dashboard', label: 'Accueil', icon: LayoutDashboard,
    items: [{ path: '/admin/coaching', label: 'Vue d’ensemble', icon: LayoutDashboard, exact: true }],
  },
  {
    id: 'coaches', label: 'Coachs & candidatures', icon: Users,
    items: [
      { path: '/admin/coaching/coachs', label: 'Coachs', icon: Users },
      { path: '/admin/coaching/candidatures', label: 'Candidatures', icon: ListChecks },
    ],
  },
  {
    id: 'activity', label: 'Activité', icon: CalendarDays,
    items: [
      { path: '/admin/coaching/sessions', label: 'Sessions', icon: CalendarDays },
      { path: '/admin/coaching/avis', label: 'Avis', icon: Star },
    ],
  },
  {
    id: 'finance', label: 'Finance', icon: CircleDollarSign,
    items: [{ path: '/admin/coaching/finance', label: 'Finance', icon: CircleDollarSign }],
  },
  {
    id: 'configuration', label: 'Configuration', icon: FolderCog,
    items: [
      { path: '/admin/coaching/domaines', label: 'Domaines', icon: FolderCog },
      { path: '/admin/coaching/avance', label: 'Packs & groupes', icon: Package },
    ],
  },
];

const SEARCH_ITEMS = GROUPS.flatMap(group => group.items).map(item => ({
  id: item.path,
  label: item.label,
  description: 'Navigation Omnia Coaching',
  path: item.path,
}));

export default function AdminCoachingManagementLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardLayout
      role="super_admin"
      navGroups={GROUPS}
      headerSubtitle="Gestion Omnia Coaching"
      headerSearch={<ContextualHeaderSearch items={SEARCH_ITEMS} placeholder="Rechercher dans la gestion Coaching..." />}
      headerActions={<Link to="/coaching" className="hidden items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-[#002050] hover:bg-slate-50 sm:inline-flex"><ExternalLink size={16} /> Voir Omnia Coaching</Link>}
      dashboardPath="/admin/dashboard"
      brandTitle="Omnia"
      brandAccent="Coaching"
      spaceHomePath="/admin/dashboard"
      spaceHomeLabel="Retour à l’administration"
      contentClassName="bg-slate-50"
    >
      {children}
    </DashboardLayout>
  );
}
