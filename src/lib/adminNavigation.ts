import type React from 'react';
import {
  LayoutDashboard, Settings, CreditCard, Wallet, Tag, BookOpen, Users, Monitor,
  Award, Eye, MessageSquare, Briefcase, Building2, QrCode, Gift,
  Shield, Activity, Radio, FileText, Layers3, Landmark, GraduationCap, BadgeCheck, ShieldCheck
} from 'lucide-react';

export interface AdminNavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
  badge?: string;
}

export interface AdminNavGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  items: AdminNavItem[];
}

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: 'dashboard',
    label: 'Tableau de bord',
    icon: LayoutDashboard,
    items: [
      { path: '/admin/dashboard', label: 'Vue d’ensemble', icon: LayoutDashboard, exact: true },
    ],
  },
  {
    id: 'formations',
    label: 'Formations & CPD',
    icon: BookOpen,
    items: [
      { path: '/admin/courses', label: 'Catalogue & CPD', icon: BookOpen },
      { path: '/admin/studio-mes-formations', label: 'Mes formations OGA', icon: GraduationCap },
      { path: '/admin/assisted-courses', label: 'Saisie assistée & certifications', icon: FileText },
      { path: '/admin/course-pricing', label: 'Validation tarifaire', icon: Landmark },
      { path: '/admin/quality-center', label: 'Centre Qualité', icon: ShieldCheck },
      { path: '/admin/cpd-credits', label: 'Open CPD', icon: Award },
    ],
  },
  {
    id: 'certificates',
    label: 'Certificats & attestations',
    icon: Award,
    items: [
      { path: '/admin/certificates', label: 'Documents délivrés', icon: Award },
      { path: '/admin/certificate-templates', label: 'Modèles', icon: FileText },
      { path: '/admin/certificate-settings', label: 'Paramètres', icon: Settings },
      { path: '/admin/certificate-preview', label: 'Aperçu & Tests', icon: Eye },
    ],
  },
  {
    id: 'credentials',
    label: 'Badges & Learning Records',
    icon: BadgeCheck,
    items: [
      { path: '/admin/credentials', label: 'Gestion des credentials', icon: BadgeCheck },
    ],
  },
  {
    id: 'users-structures',
    label: 'Utilisateurs & Structures',
    icon: Users,
    items: [
      { path: '/admin/team', label: 'Équipe & Modérateurs', icon: Users },
      { path: '/admin/structures', label: 'Structures', icon: Building2 },
      { path: '/admin/structure-codes', label: 'Codes structure', icon: QrCode },
      { path: '/admin/structure-avantages', label: 'Avantages structure', icon: Gift },
    ],
  },
  {
    id: 'finance',
    label: 'Finance & Commercial',
    icon: Landmark,
    items: [
      { path: '/admin/fintech', label: 'Configuration Fintech', icon: CreditCard },
      { path: '/admin/payouts', label: 'Gestion des Retraits', icon: Wallet },
      { path: '/admin/marketing', label: 'Offres & Licences B2B', icon: Tag },
    ],
  },
  {
    id: 'career-talent',
    label: 'Career, Talent & Coaching',
    icon: Briefcase,
    items: [
      { path: '/admin/career-studio', label: 'Gestion Omnia Career Studio', icon: Briefcase },
      { path: '/admin/coaching', label: 'Gestion Omnia Coaching', icon: Users },
      { path: '/admin/talent', label: 'Supervision Omnia Talent', icon: Shield },
      { path: '/admin/offres-emploi', label: 'Offres d’emploi', icon: Briefcase },
    ],
  },
  {
    id: 'community-live',
    label: 'Communauté & Live',
    icon: Layers3,
    items: [
      { path: '/admin/forum', label: 'Forum & Modération', icon: MessageSquare },
      { path: '/admin/omnia-live', label: 'Gestion Omnia Live', icon: Radio },
    ],
  },
  {
    id: 'platform',
    label: 'Plateforme & CMS',
    icon: Settings,
    items: [
      { path: '/admin/cms-branding', label: 'Configuration CMS', icon: Settings },
      { path: '/admin/demo-access', label: 'Accès Démo', icon: Monitor },
    ],
  },
];

export const ADMIN_NAV_ITEMS = ADMIN_NAV_GROUPS.flatMap(group => group.items);
