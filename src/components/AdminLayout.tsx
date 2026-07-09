import { ReactNode } from 'react';
import { DashboardLayout } from './DashboardLayout';
import {
  LayoutDashboard, Settings, CreditCard, Wallet, Tag,
  BookOpen, Users, Monitor, Award, Eye, MessageSquare,
  Briefcase, Building2, PlusCircle, QrCode, Gift
} from 'lucide-react';

const ADMIN_NAV = [
  { path: '/admin/dashboard',              label: 'Tableau de bord',        icon: LayoutDashboard, exact: true },
  { path: '/admin/cms-branding',           label: 'Configuration CMS',      icon: Settings },
  { path: '/admin/fintech',                label: 'Configuration Fintech',   icon: CreditCard },
  { path: '/admin/payouts',                label: 'Gestion des Retraits',   icon: Wallet },
  { path: '/admin/marketing',              label: 'Offres & Licences B2B',  icon: Tag },
  { path: '/admin/courses',                label: 'Catalogue & CPD',        icon: BookOpen },
  { path: '/admin/studio-mes-formations',  label: 'Mes formations OGA',     icon: BookOpen },
  { path: '/admin/studio/new',             label: 'Créer une formation',    icon: PlusCircle },
  { path: '/admin/studio-validation',      label: 'Validation formations',  icon: Eye },
  { path: '/admin/team',                   label: 'Équipe & Modérateurs',   icon: Users },
  { path: '/admin/cpd-credits',            label: 'Crédits Open CPD',       icon: Award },
  { path: '/admin/certificates',           label: 'Certificats délivrés',   icon: Award },
  { path: '/admin/certificate-settings',   label: 'Paramètres Certificats', icon: Settings },
  { path: '/admin/certificate-preview',    label: 'Aperçu Certificats',     icon: Eye },
  { path: '/admin/demo-access',            label: 'Accès Démo',             icon: Monitor },
  { path: '/admin/forum',                  label: 'Forum & Modération',     icon: MessageSquare },
  { path: '/admin/career-studio',          label: 'Omnia Career Studio',    icon: Briefcase },
  { path: '/admin/structures',             label: 'Structures',             icon: Building2 },
  { path: '/admin/structure-codes',        label: 'Codes structure',        icon: QrCode },
  { path: '/admin/structure-avantages',    label: 'Avantages structure',    icon: Gift },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardLayout role="super_admin" navItems={ADMIN_NAV}>
      {children}
    </DashboardLayout>
  );
}
