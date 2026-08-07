import type { ReactNode } from 'react';
import {
  Briefcase, CalendarDays, CreditCard, FileText, Heart, LayoutDashboard,
  MessageSquare, Search, Settings, ShieldCheck,
} from 'lucide-react';
import { DashboardLayout, type NavGroup } from '../DashboardLayout';
import ContextualHeaderSearch, { type ContextualHeaderSearchItem } from '../ContextualHeaderSearch';

type Props = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchItems?: ContextualHeaderSearchItem[];
};

const GROUPS: NavGroup[] = [
  {
    id: 'dashboard', label: 'Accueil', icon: LayoutDashboard,
    items: [{ path: '/talent/recruteur/dashboard', label: 'Accueil', icon: LayoutDashboard, exact: true }],
  },
  {
    id: 'talent-pool', label: 'Talents', icon: Search,
    items: [
      { path: '/talent/recruteur/talents', label: 'Rechercher des talents', icon: Search },
      { path: '/talent/recruteur/competences-verifiees', label: 'Compétences vérifiées', icon: ShieldCheck },
      { path: '/talent/recruteur/favoris', label: 'Talents favoris', icon: Heart },
    ],
  },
  {
    id: 'recruitment', label: 'Recrutement', icon: Briefcase,
    items: [
      { path: '/talent/recruteur/offres', label: 'Mes offres', icon: Briefcase },
      { path: '/talent/recruteur/candidatures', label: 'Candidatures', icon: FileText },
      { path: '/talent/recruteur/entretiens', label: 'Entretiens', icon: CalendarDays },
      { path: '/talent/recruteur/messages', label: 'Messages', icon: MessageSquare },
    ],
  },
  {
    id: 'account-plan', label: 'Plan & réglages', icon: CreditCard,
    items: [
      { path: '/talent/recruteur/plans', label: 'Plans & crédits', icon: CreditCard },
      { path: '/talent/recruteur/parametres', label: 'Paramètres', icon: Settings },
    ],
  },
];

const DEFAULT_SEARCH_ITEMS = GROUPS.flatMap(group => group.items).map(item => ({
  id: item.path,
  label: item.label,
  description: 'Navigation Omnia Talent',
  path: item.path,
}));

export function RecruiterLayout({ children, title, subtitle, searchValue, onSearchChange, searchItems }: Props) {
  const items = searchItems || DEFAULT_SEARCH_ITEMS;
  return (
    <DashboardLayout
      role="recruteur"
      navGroups={GROUPS}
      headerTitle={title}
      headerSubtitle={subtitle || 'Omnia Talent'}
      headerSearch={<ContextualHeaderSearch items={items} placeholder="Rechercher dans Omnia Talent..." value={searchValue} onChange={onSearchChange} />}
      brandTitle="Omnia"
      brandAccent="Talent"
      spaceHomePath="/talent"
      spaceHomeLabel="Retour à Omnia Talent"
      contentClassName="bg-white"
    >
      {children}
    </DashboardLayout>
  );
}
