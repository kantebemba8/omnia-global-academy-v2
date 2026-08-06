import type { ReactNode } from 'react';
import {
  Briefcase, CalendarDays, CreditCard, FileText, Heart, LayoutDashboard,
  MessageSquare, Search, Settings, ShieldCheck, UserRound,
} from 'lucide-react';
import { DashboardLayout, type NavItem } from '../DashboardLayout';

type Props = { children: ReactNode; title?: string; subtitle?: string };

const NAV: NavItem[] = [
  { path: '/talent/recruteur/dashboard', label: 'Accueil', icon: LayoutDashboard, exact: true },
  { path: '/talent/recruteur/talents', label: 'Rechercher des talents', icon: Search },
  { path: '/talent/recruteur/competences-verifiees', label: 'Compétences vérifiées', icon: ShieldCheck },
  { path: '/talent/recruteur/offres', label: 'Mes offres', icon: Briefcase },
  { path: '/talent/recruteur/candidatures', label: 'Candidatures', icon: FileText },
  { path: '/talent/recruteur/favoris', label: 'Talents favoris', icon: Heart },
  { path: '/talent/recruteur/entretiens', label: 'Entretiens', icon: CalendarDays },
  { path: '/talent/recruteur/messages', label: 'Messages', icon: MessageSquare },
  { path: '/mon-profil', label: 'Mon profil', icon: UserRound },
  { path: '/talent/recruteur/plans', label: 'Plans & crédits', icon: CreditCard },
  { path: '/talent/recruteur/parametres', label: 'Paramètres', icon: Settings },
];

export function RecruiterLayout({ children, title, subtitle }: Props) {
  return (
    <DashboardLayout
      role="recruteur"
      navItems={NAV}
      headerTitle={title}
      headerSubtitle={subtitle || 'Omnia Talent'}
      brandTitle="Omnia"
      brandAccent="Talent"
      spaceHomePath="/talent"
      spaceHomeLabel="Retour à Omnia Talent"
      contentClassName="bg-slate-50"
    >
      {children}
    </DashboardLayout>
  );
}
