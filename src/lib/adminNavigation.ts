import type React from 'react';
import {
  LayoutDashboard, Settings, CreditCard, Wallet, Tag, BookOpen, Users,
  Award, Eye, MessageSquare, Briefcase, Building2, QrCode, Gift,
  Shield, Radio, FileText, FileUp, Landmark, GraduationCap, BadgeCheck,
  ShieldCheck, ClipboardCheck, FolderKanban, Route, FileSignature, Trash2, Languages,
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
    label: 'Accueil',
    icon: LayoutDashboard,
    items: [{ path: '/admin/dashboard', label: 'Accueil', icon: LayoutDashboard, exact: true }],
  },
  {
    id: 'catalog-production',
    label: 'Catalogue & création',
    icon: BookOpen,
    items: [
      { path: '/admin/courses', label: 'Catalogue des formations', icon: BookOpen },
      { path: '/admin/studio-mes-formations', label: 'Formations OGA', icon: GraduationCap },
      { path: '/admin/studio/new', label: 'Créer une formation', icon: FileText },
      { path: '/admin/courses/import', label: 'Importer une formation', icon: FileUp },
      { path: '/admin/assisted-courses', label: 'Création assistée', icon: FileText },
      { path: '/admin/course-pricing', label: 'Validation tarifaire', icon: Landmark },
      { path: '/admin/quality-center', label: 'Centre Qualité', icon: ShieldCheck },
    ],
  },
  {
    id: 'learning-governance',
    label: 'Évaluation & reconnaissance',
    icon: ClipboardCheck,
    items: [
      { path: '/admin/recognition-hub', label: 'Partenaires & reconnaissances', icon: Building2 },
      { path: '/admin/professional-pathways', label: 'Parcours professionnels', icon: Route },
      { path: '/admin/assessment-center', label: 'Assessment Center', icon: ClipboardCheck },
      { path: '/admin/assessment-governance', label: 'Jurys & compétences', icon: Users },
      { path: '/admin/cpd-credits', label: 'Open CPD', icon: Award },
    ],
  },
  {
    id: 'credentials',
    label: 'Certificats & credentials',
    icon: BadgeCheck,
    items: [
      { path: '/admin/certificates', label: 'Documents délivrés', icon: Award },
      { path: '/admin/certificate-templates', label: 'Modèles de certificats', icon: FileText },
      { path: '/admin/certificate-settings', label: 'Paramètres certificats', icon: Settings },
      { path: '/admin/certificate-preview', label: 'Aperçu & tests', icon: Eye },
      { path: '/admin/credentials', label: 'Badges & Learning Records', icon: BadgeCheck },
    ],
  },
  {
    id: 'users-access',
    label: 'Utilisateurs & accès',
    icon: Users,
    items: [
      { path: '/admin/utilisateurs', label: 'Utilisateurs', icon: Users },
      { path: '/admin/team', label: 'Équipe & Modérateurs', icon: Shield },
      { path: '/admin/structures', label: 'Structures', icon: Building2 },
      { path: '/admin/structure-codes', label: 'Codes Structure', icon: QrCode },
      { path: '/admin/special-access', label: 'Accès spéciaux', icon: ShieldCheck },
    ],
  },
  {
    id: 'commerce-finance',
    label: 'Commerce & finance',
    icon: Landmark,
    items: [
      { path: '/admin/fintech', label: 'Configuration Fintech', icon: CreditCard },
      { path: '/admin/monetization', label: 'Abonnements & monétisation', icon: Gift },
      { path: '/admin/payouts', label: 'Retraits', icon: Wallet },
      { path: '/admin/structures/b2b', label: 'Contrats B2B', icon: FileSignature },
      { path: '/admin/marketing', label: 'Offres & licences', icon: Tag },
    ],
  },
  {
    id: 'career-projects',
    label: 'Carrière & projets',
    icon: Briefcase,
    items: [
      { path: '/admin/career-studio', label: 'Omnia Career Studio', icon: Briefcase },
      { path: '/admin/projects', label: 'Omnia Projects', icon: FolderKanban },
      { path: '/admin/coaching', label: 'Omnia Coaching', icon: Users },
      { path: '/admin/talent', label: 'Omnia Talent', icon: Shield },
      { path: '/admin/employabilite', label: 'Employabilité', icon: ShieldCheck },
      { path: '/admin/offres-emploi', label: 'Offres d’emploi', icon: Briefcase },
    ],
  },
  {
    id: 'community-live',
    label: 'Communauté & Live',
    icon: Radio,
    items: [
      { path: '/admin/forum', label: 'Omnia Communauté', icon: MessageSquare },
      { path: '/admin/omnia-live', label: 'Omnia Live', icon: Radio },
    ],
  },
  {
    id: 'platform-governance',
    label: 'Plateforme & gouvernance',
    icon: Settings,
    items: [
      { path: '/admin/cms-branding', label: 'CMS & identité', icon: Settings },
      { path: '/admin/traductions', label: 'Traductions', icon: Languages },
      { path: '/admin/suppressions', label: 'Suppressions de comptes', icon: Trash2 },
    ],
  },
];

export const ADMIN_NAV_ITEMS = ADMIN_NAV_GROUPS.flatMap(group => group.items);
