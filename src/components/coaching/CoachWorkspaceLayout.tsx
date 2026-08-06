import type { ReactNode } from 'react';
import {
  CalendarDays, CircleDollarSign, CreditCard, LayoutDashboard, ListChecks,
  Package, Settings2, Star, User,
} from 'lucide-react';
import { DashboardLayout, type NavItem } from '../DashboardLayout';
import ContextualHeaderSearch from '../ContextualHeaderSearch';

const items: NavItem[] = [
  { path: '/coach/dashboard', label: 'Accueil', icon: LayoutDashboard, exact: true },
  { path: '/coach/offres', label: 'Mes offres', icon: Settings2 },
  { path: '/coach/calendrier', label: 'Mon calendrier', icon: CalendarDays },
  { path: '/coach/sessions', label: 'Mes sessions', icon: ListChecks },
  { path: '/coach/avis', label: 'Mes avis', icon: Star },
  { path: '/coach/revenus', label: 'Mes revenus', icon: CircleDollarSign },
  { path: '/coach/commerce', label: 'Tarifs & abonnements', icon: CreditCard },
  { path: '/coach/plan-omnia', label: 'Mon plan Omnia', icon: CreditCard },
  { path: '/coach/produits', label: 'Coaching collectif', icon: Package },
  { path: '/mon-profil', label: 'Mon profil', icon: User },
];

export default function CoachWorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardLayout
      role="coach"
      navItems={items}
      brandTitle="Omnia"
      brandAccent="Coaching"
      headerSubtitle="Espace Coach"
      headerSearch={<ContextualHeaderSearch items={items.map(item => ({ id: item.path, label: item.label, description: 'Navigation Omnia Coaching', path: item.path }))} placeholder="Rechercher dans mon espace Coach..." />}
      spaceHomePath="/coaching"
      spaceHomeLabel="Retour à Omnia Coaching"
      contentClassName="bg-slate-50"
    >
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">{children}</div>
    </DashboardLayout>
  );
}
