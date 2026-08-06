import type { ReactNode } from 'react';
import {
  CalendarDays, CircleDollarSign, ExternalLink, FolderCog, LayoutDashboard,
  ListChecks, Package, Settings2, Star, Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { DashboardLayout, type NavItem } from '../DashboardLayout';

const NAV_ITEMS: NavItem[] = [
  { path: '/admin/coaching', label: 'Vue d’ensemble', icon: LayoutDashboard, exact: true },
  { path: '/admin/coaching/coachs', label: 'Coachs', icon: Users },
  { path: '/admin/coaching/candidatures', label: 'Candidatures', icon: ListChecks },
  { path: '/admin/coaching/sessions', label: 'Sessions', icon: CalendarDays },
  { path: '/admin/coaching/avis', label: 'Avis', icon: Star },
  { path: '/admin/coaching/finance', label: 'Finance', icon: CircleDollarSign },
  { path: '/admin/coaching/parametres', label: 'Paramètres', icon: Settings2 },
  { path: '/admin/coaching/domaines', label: 'Domaines', icon: FolderCog },
  { path: '/admin/coaching/avance', label: 'Packs & groupes', icon: Package },
];

export default function AdminCoachingManagementLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardLayout
      role="super_admin"
      navItems={NAV_ITEMS}
      headerSubtitle="Gestion Omnia Coaching"
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
