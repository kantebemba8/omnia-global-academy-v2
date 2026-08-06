import type { ReactNode } from 'react';
import {
  Award, BadgeCheck, Building2, FileCheck2, KeyRound, Layers3,
  LayoutDashboard, ShieldCheck, Sparkles,
} from 'lucide-react';
import { DashboardLayout, type NavItem } from '../DashboardLayout';

const NAV_ITEMS: NavItem[] = [
  { path: '/admin/credentials', label: 'Vue d’ensemble', icon: LayoutDashboard, exact: true },
  { path: '/admin/credentials/modeles', label: 'Modèles de badges', icon: Award },
  { path: '/admin/credentials/attributions', label: 'Attributions', icon: BadgeCheck },
  { path: '/admin/credentials/emetteurs', label: 'Émetteurs', icon: Building2 },
  { path: '/admin/credentials/signatures', label: 'Signatures Open Badges', icon: KeyRound },
  { path: '/admin/credentials/categories', label: 'Catégories & niveaux', icon: Layers3 },
  { path: '/admin/credentials/clr', label: 'Learning Records', icon: FileCheck2 },
  { path: '/admin/credentials/passports', label: 'Skills Passport', icon: Sparkles },
  { path: '/admin/credentials/revocations', label: 'Révocations', icon: ShieldCheck },
];

export default function AdminCredentialsManagementLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardLayout
      role="super_admin"
      navItems={NAV_ITEMS}
      headerSubtitle="Badges & Learning Records"
      dashboardPath="/admin/dashboard"
      brandTitle="Omnia"
      brandAccent="Credentials"
      spaceHomePath="/admin/dashboard"
      spaceHomeLabel="Retour à l’administration"
      contentClassName="bg-slate-50"
    >
      {children}
    </DashboardLayout>
  );
}
