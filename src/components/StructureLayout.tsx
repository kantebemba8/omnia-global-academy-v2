import type { ReactNode } from 'react';
import { useMemo } from 'react';
import {
  LayoutDashboard, BookOpen, PlusCircle, Users, QrCode,
  BarChart2, Bell, Settings, Building2, UserCheck, Shield, Briefcase, Search,
  CalendarDays, Heart, MessageSquare, UserRoundSearch, User, Radio, Layers3,
  ClipboardCheck, CreditCard, FolderKanban, FileSignature, Network, LineChart,
} from 'lucide-react';
import { DashboardLayout, type NavGroup } from './DashboardLayout';
import { getStoredUser } from '../lib/session';

const STRUCTURE_NAV_GROUPS: NavGroup[] = [
  {
    id: 'dashboard', label: 'Accueil', icon: LayoutDashboard,
    items: [{ path: '/structure/dashboard', label: 'Accueil', icon: LayoutDashboard, exact: true }],
  },
  {
    id: 'structure-members', label: 'Structure & membres', icon: Building2,
    items: [
      { path: '/structure/profil', label: 'Profil de la structure', icon: Building2 },
      { path: '/structure/membres', label: 'Membres liés', icon: Users },
      { path: '/structure/organisation', label: 'Organisation & obligations', icon: Network },
      { path: '/structure/suivi-rh', label: 'Suivi RH & conformité', icon: LineChart },
      { path: '/structure/rattachements', label: 'Demandes de rattachement', icon: UserCheck },
      { path: '/structure/codes', label: 'Codes structure', icon: QrCode },
      { path: '/structure/abonnements', label: 'Abonnements & capacités', icon: CreditCard },
      { path: '/structure/commerce-b2b', label: 'Commerce B2B & contrats', icon: FileSignature },
      { path: '/structure/equipe', label: 'Équipe de la structure', icon: Shield },
    ],
  },
  {
    id: 'formations', label: 'Formations', icon: BookOpen,
    items: [
      { path: '/structure/formations', label: 'Mes formations', icon: BookOpen },
      { path: '/structure/courses/new', label: 'Créer une formation', icon: PlusCircle },
      { path: '/structure/assessment-center', label: 'Assessment Center', icon: ClipboardCheck },
      { path: '/structure/jurys', label: 'Jurys & révisions', icon: Users },
      { path: '/structure/projects', label: 'Omnia Projects', icon: FolderKanban },
    ],
  },
  {
    id: 'recruitment', label: 'Emploi & recrutement', icon: Briefcase,
    items: [
      { path: '/structure/offres-emploi', label: 'Offres d’emploi', icon: Briefcase },
      { path: '/structure/recrutement/dashboard', label: 'Accueil recrutement', icon: UserRoundSearch, exact: true },
      { path: '/structure/recrutement/talents', label: 'Recherche de talents', icon: Search },
      { path: '/structure/recrutement/favoris', label: 'Talents favoris', icon: Heart },
      { path: '/structure/recrutement/candidats', label: 'Candidats', icon: Users },
      { path: '/structure/recrutement/entretiens', label: 'Entretiens', icon: CalendarDays },
      { path: '/structure/recrutement/messages', label: 'Messages recrutement', icon: MessageSquare },
    ],
  },
  {
    id: 'omnia-services', label: 'Services Omnia', icon: Layers3,
    items: [
      { path: '/talent', label: 'Omnia Talent', icon: Search },
      { path: '/omnia-live', label: 'Omnia Live', icon: Radio },
    ],
  },
  {
    id: 'management', label: 'Pilotage & réglages', icon: Settings,
    items: [
      { path: '/mon-profil', label: 'Mon profil personnel', icon: User },
      { path: '/structure/statistiques', label: 'Statistiques', icon: BarChart2 },
      { path: '/structure/notifications', label: 'Notifications', icon: Bell },
      { path: '/structure/parametres', label: 'Paramètres', icon: Settings },
    ],
  },
];

const STRUCTURE_RECRUITER_NAV_GROUPS: NavGroup[] = [
  {
    id: 'dashboard', label: 'Accueil', icon: LayoutDashboard,
    items: [{ path: '/structure/recrutement/dashboard', label: 'Accueil', icon: LayoutDashboard, exact: true }],
  },
  {
    id: 'recruitment', label: 'Recrutement', icon: Briefcase,
    items: [
      { path: '/structure/offres-emploi', label: 'Offres d’emploi', icon: Briefcase },
      { path: '/structure/recrutement/talents', label: 'Recherche de talents', icon: Search },
      { path: '/structure/recrutement/candidats', label: 'Candidats', icon: Users },
      { path: '/structure/recrutement/favoris', label: 'Talents favoris', icon: Heart },
      { path: '/structure/recrutement/entretiens', label: 'Entretiens', icon: CalendarDays },
      { path: '/structure/recrutement/messages', label: 'Messages', icon: MessageSquare },
      { path: '/structure/recrutement/statistiques', label: 'Statistiques', icon: BarChart2 },
      { path: '/mon-profil', label: 'Mon profil personnel', icon: User },
    ],
  },
  {
    id: 'omnia-services', label: 'Services Omnia', icon: Layers3,
    items: [{ path: '/talent', label: 'Omnia Talent', icon: Search }],
  },
];

type StoredUser = { roles?: string[] };

export function StructureLayout({ children }: { children: ReactNode; displayName?: string }) {
  const visibleGroups = useMemo(() => {
    const user = getStoredUser<StoredUser>();
    const previewRole = sessionStorage.getItem('omnia_admin_role_preview');
    const roles = user?.roles || [];
    const recruitmentOnly = previewRole === 'recruteur_structure' || (
      roles.includes('recruteur_structure')
      && !roles.some(role => ['responsable_structure', 'gestionnaire_partenaire', 'structure', 'structure_admin', 'directeur', 'etablissement_directeur', 'super_admin'].includes(role))
    );
    return recruitmentOnly ? STRUCTURE_RECRUITER_NAV_GROUPS : STRUCTURE_NAV_GROUPS;
  }, []);

  return (
    <DashboardLayout
      role="directeur"
      navGroups={visibleGroups}
      brandTitle="Omnia"
      brandAccent="Structure"
      spaceHomePath="/"
      spaceHomeLabel="Retour au site Omnia"
    >
      {children}
    </DashboardLayout>
  );
}
