import type React from 'react';
import {
  Activity, Award, BadgeCheck, BarChart3, BellRing, BookOpen, Briefcase, Building2,
  CalendarDays, ClipboardCheck, CreditCard, Eye, FileBadge2, FileSignature, FileText,
  FileUp, Film, FolderCog, FolderKanban, Gauge, Gift, GraduationCap, KeyRound,
  Landmark, Languages, Layers3, LayoutDashboard, ListChecks, LockKeyhole,
  MessageSquare, Package, QrCode, Radio, RefreshCcw, Route, Settings, Shield,
  ShieldCheck, SlidersHorizontal, Sparkles, Star, Tag, Trash2, Users, Wallet,
} from 'lucide-react';
import { getEcosystem, type EcosystemId } from './ecosystemRegistry';

export interface AdminNavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
  badge?: string;
  ecosystemId?: EcosystemId;
}

export interface AdminNavGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  items: AdminNavItem[];
}

export interface AdminEcosystemNavGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  items: AdminNavItem[];
}

export interface AdminEcosystemNavigation {
  id: EcosystemId;
  label: string;
  icon: React.ElementType;
  entryPath: string;
  publicPath: string;
  accent: string;
  soft: string;
  background: string;
  border: string;
  groups: AdminEcosystemNavGroup[];
  matchPrefixes: string[];
}

const formations = getEcosystem('formations');
const career = getEcosystem('career');
const projects = getEcosystem('projects');
const talent = getEcosystem('talent');
const live = getEcosystem('live');
const community = getEcosystem('community');
const coaching = getEcosystem('coaching');

export const ADMIN_ECOSYSTEMS: AdminEcosystemNavigation[] = [
  {
    id: 'formations',
    label: 'Formations',
    icon: BookOpen,
    entryPath: '/admin/ecosystemes/formations',
    publicPath: formations.publicPath,
    accent: formations.accent,
    soft: formations.soft,
    background: formations.background,
    border: formations.border,
    matchPrefixes: [
      '/admin/ecosystemes/formations', '/admin/courses', '/admin/studio', '/admin/studio-mes-formations', '/admin/assisted-courses',
      '/admin/course-pricing', '/admin/quality-center', '/admin/recognition-hub', '/admin/professional-pathways',
      '/admin/assessment-center', '/admin/assessment-governance', '/admin/cpd-credits', '/admin/certificates',
      '/admin/certificate-templates', '/admin/certificate-settings', '/admin/certificate-preview', '/admin/credentials',
    ],
    groups: [
      {
        id: 'formations-catalogue', label: 'Catalogue & création', icon: BookOpen,
        items: [
          { path: '/admin/courses', label: 'Catalogue des formations', icon: BookOpen, exact: true },
          { path: '/admin/studio-mes-formations', label: 'Formations OGA', icon: GraduationCap },
          { path: '/admin/studio/new', label: 'Créer une formation', icon: FileText },
          { path: '/admin/courses/import', label: 'Importer une formation', icon: FileUp },
          { path: '/admin/assisted-courses', label: 'Création assistée', icon: FileText },
          { path: '/admin/course-pricing', label: 'Validation tarifaire', icon: Landmark },
          { path: '/admin/quality-center', label: 'Centre Qualité', icon: ShieldCheck },
        ],
      },
      {
        id: 'formations-recognition', label: 'Évaluation & reconnaissance', icon: ClipboardCheck,
        items: [
          { path: '/admin/recognition-hub', label: 'Partenaires & reconnaissances', icon: Building2 },
          { path: '/admin/professional-pathways', label: 'Parcours professionnels', icon: Route },
          { path: '/admin/assessment-center', label: 'Assessment Center', icon: ClipboardCheck },
          { path: '/admin/assessment-governance', label: 'Jurys & compétences', icon: Users },
          { path: '/admin/cpd-credits', label: 'Open CPD', icon: Award },
        ],
      },
      {
        id: 'formations-credentials', label: 'Certificats & credentials', icon: BadgeCheck,
        items: [
          { path: '/admin/certificates', label: 'Documents délivrés', icon: Award },
          { path: '/admin/certificate-templates', label: 'Modèles de certificats', icon: FileText },
          { path: '/admin/certificate-settings', label: 'Paramètres certificats', icon: Settings },
          { path: '/admin/certificate-preview', label: 'Aperçu & tests', icon: Eye },
          { path: '/admin/credentials', label: 'Vue credentials', icon: BadgeCheck, exact: true },
          { path: '/admin/credentials/modeles', label: 'Modèles de badges', icon: Award },
          { path: '/admin/credentials/emetteurs', label: 'Émetteurs', icon: Building2 },
          { path: '/admin/credentials/signatures', label: 'Signatures Open Badges', icon: KeyRound },
          { path: '/admin/credentials/categories', label: 'Catégories & niveaux', icon: Layers3 },
          { path: '/admin/credentials/attributions', label: 'Attributions', icon: BadgeCheck },
          { path: '/admin/credentials/clr', label: 'Learning Records', icon: FileBadge2 },
          { path: '/admin/credentials/passports', label: 'Skills Passport', icon: Sparkles },
          { path: '/admin/credentials/revocations', label: 'Révocations', icon: ShieldCheck },
        ],
      },
    ],
  },
  {
    id: 'career', label: 'Career', icon: Briefcase, entryPath: '/admin/ecosystemes/career', publicPath: career.publicPath,
    accent: career.accent, soft: career.soft, background: career.background, border: career.border,
    matchPrefixes: ['/admin/ecosystemes/career', '/admin/career-studio'],
    groups: [
      { id: 'career-studio', label: 'Career Studio', icon: Briefcase, items: [{ path: '/admin/career-studio', label: 'Gestion Career Studio', icon: Briefcase, exact: true }] },
    ],
  },
  {
    id: 'projects', label: 'Projects', icon: FolderKanban, entryPath: '/admin/ecosystemes/projects', publicPath: projects.publicPath,
    accent: projects.accent, soft: projects.soft, background: projects.background, border: projects.border,
    matchPrefixes: ['/admin/ecosystemes/projects', '/admin/projects'],
    groups: [
      { id: 'projects-supervision', label: 'Supervision', icon: FolderKanban, items: [{ path: '/admin/projects', label: 'Supervision des projets', icon: FolderKanban, exact: true }] },
      { id: 'projects-management', label: 'Gestion', icon: ClipboardCheck, items: [{ path: '/admin/projects/gestion', label: 'Gestion des projets', icon: ClipboardCheck }] },
    ],
  },
  {
    id: 'talent', label: 'Talent', icon: Users, entryPath: '/admin/ecosystemes/talent', publicPath: talent.publicPath,
    accent: talent.accent, soft: talent.soft, background: talent.background, border: talent.border,
    matchPrefixes: ['/admin/ecosystemes/talent', '/admin/talent', '/admin/employabilite', '/admin/offres-emploi'],
    groups: [
      { id: 'talent-pilotage', label: 'Pilotage Talent', icon: Users, items: [{ path: '/admin/talent', label: 'Supervision Talent', icon: Users, exact: true }] },
      { id: 'talent-employability', label: 'Employabilité', icon: ShieldCheck, items: [{ path: '/admin/employabilite', label: 'Employabilité', icon: ShieldCheck }] },
      { id: 'talent-jobs', label: 'Offres d’emploi', icon: Briefcase, items: [{ path: '/admin/offres-emploi', label: 'Offres d’emploi', icon: Briefcase }] },
    ],
  },
  {
    id: 'live', label: 'Live', icon: Radio, entryPath: '/admin/ecosystemes/live', publicPath: live.publicPath,
    accent: live.accent, soft: live.soft, background: live.background, border: live.border,
    matchPrefixes: ['/admin/ecosystemes/live', '/admin/omnia-live'],
    groups: [
      { id: 'live-pilotage', label: 'Pilotage', icon: Gauge, items: [
        { path: '/admin/omnia-live', label: 'Vue d’ensemble', icon: Gauge, exact: true },
        { path: '/admin/omnia-live/validation', label: 'Validation & événements', icon: ListChecks },
        { path: '/admin/omnia-live/evenements', label: 'Tous les événements', icon: CalendarDays },
        { path: '/admin/omnia-live/creer', label: 'Créer un Live', icon: Radio },
      ] },
      { id: 'live-management', label: 'Gestion', icon: Users, items: [
        { path: '/admin/omnia-live/organisateurs', label: 'Organisateurs', icon: Users },
        { path: '/admin/omnia-live/structures', label: 'Structures', icon: Building2 },
        { path: '/admin/omnia-live/medias', label: 'Médias & replays', icon: Film },
        { path: '/admin/omnia-live/documents', label: 'Certificats & attestations', icon: FileBadge2 },
        { path: '/admin/omnia-live/communications', label: 'Communication', icon: BellRing },
      ] },
      { id: 'live-finance', label: 'Commerce & opérations', icon: Wallet, items: [
        { path: '/admin/omnia-live/commerce', label: 'Commerce Omnia Live', icon: CreditCard },
        { path: '/admin/omnia-live/finance', label: 'Finance & Payouts', icon: Wallet },
        { path: '/admin/omnia-live/operations', label: 'Opérations', icon: RefreshCcw },
        { path: '/admin/omnia-live/automatisations', label: 'Règles automatiques', icon: SlidersHorizontal },
      ] },
      { id: 'live-control', label: 'Contrôle', icon: ShieldCheck, items: [
        { path: '/admin/omnia-live/analytics', label: 'Analytique', icon: BarChart3 },
        { path: '/admin/omnia-live/rapports', label: 'Rapports & exports', icon: ClipboardCheck },
        { path: '/admin/omnia-live/securite', label: 'Sécurité', icon: LockKeyhole },
        { path: '/admin/omnia-live/integrite', label: 'Contrôles d’intégrité', icon: ShieldCheck },
        { path: '/admin/omnia-live/audit', label: 'Journal d’audit', icon: Activity },
        { path: '/admin/omnia-live/parametres', label: 'Paramètres', icon: Settings },
      ] },
    ],
  },
  {
    id: 'community', label: 'Communauté', icon: MessageSquare, entryPath: '/admin/ecosystemes/community', publicPath: community.publicPath,
    accent: community.accent, soft: community.soft, background: community.background, border: community.border,
    matchPrefixes: ['/admin/ecosystemes/community', '/admin/forum'],
    groups: [
      { id: 'community-moderation', label: 'Modération', icon: MessageSquare, items: [{ path: '/admin/forum', label: 'Gestion de la Communauté', icon: MessageSquare, exact: true }] },
    ],
  },
  {
    id: 'coaching', label: 'Coaching', icon: Users, entryPath: '/admin/ecosystemes/coaching', publicPath: coaching.publicPath,
    accent: coaching.accent, soft: coaching.soft, background: coaching.background, border: coaching.border,
    matchPrefixes: ['/admin/ecosystemes/coaching', '/admin/coaching'],
    groups: [
      { id: 'coaching-pilotage', label: 'Pilotage', icon: LayoutDashboard, items: [
        { path: '/admin/coaching', label: 'Vue d’ensemble', icon: LayoutDashboard, exact: true },
      ] },
      { id: 'coaching-coaches', label: 'Coachs & candidatures', icon: Users, items: [
        { path: '/admin/coaching/candidatures', label: 'Candidatures', icon: ListChecks },
        { path: '/admin/coaching/coachs', label: 'Coachs', icon: Users },
        { path: '/admin/coaching/niveaux', label: 'Niveaux', icon: Layers3 },
      ] },
      { id: 'coaching-activity', label: 'Offres & activité', icon: CalendarDays, items: [
        { path: '/admin/coaching/domaines', label: 'Domaines', icon: FolderCog },
        { path: '/admin/coaching/offres', label: 'Offres', icon: Package },
        { path: '/admin/coaching/sessions', label: 'Sessions', icon: CalendarDays },
        { path: '/admin/coaching/avis', label: 'Avis', icon: Star },
      ] },
      { id: 'coaching-finance', label: 'Finance & litiges', icon: Wallet, items: [
        { path: '/admin/coaching/finance', label: 'Finance', icon: Wallet },
        { path: '/admin/coaching/revenus', label: 'Revenus', icon: CreditCard },
        { path: '/admin/coaching/litiges', label: 'Litiges', icon: ShieldCheck },
      ] },
      { id: 'coaching-config', label: 'Configuration', icon: Settings, items: [
        { path: '/admin/coaching/avance', label: 'Packs & groupes', icon: Package },
      ] },
    ],
  },
];

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: 'dashboard', label: 'Accueil', icon: LayoutDashboard,
    items: [{ path: '/admin/dashboard', label: 'Accueil', icon: LayoutDashboard, exact: true }],
  },
  {
    id: 'users-access', label: 'Utilisateurs & accès', icon: Users,
    items: [
      { path: '/admin/utilisateurs', label: 'Utilisateurs', icon: Users },
      { path: '/admin/team', label: 'Équipe & Modérateurs', icon: Shield },
      { path: '/admin/structures', label: 'Structures', icon: Building2 },
      { path: '/admin/structure-codes', label: 'Codes Structure', icon: QrCode },
      { path: '/admin/special-access', label: 'Accès spéciaux', icon: ShieldCheck },
      { path: '/admin/suppressions', label: 'Suppressions de comptes', icon: Trash2 },
    ],
  },
  {
    id: 'ecosystems', label: 'Écosystèmes', icon: Sparkles,
    items: [
      { path: '/admin/ecosystemes', label: 'Vue d’ensemble', icon: Sparkles, exact: true },
      ...ADMIN_ECOSYSTEMS.map(ecosystem => ({
        path: ecosystem.entryPath,
        label: ecosystem.label,
        icon: ecosystem.icon,
        ecosystemId: ecosystem.id,
      })),
    ],
  },
  {
    id: 'commerce-finance', label: 'Commerce & finance', icon: Landmark,
    items: [
      { path: '/admin/finance-commerce', label: 'Vue d’ensemble Finance & Commerce', icon: Landmark },
      { path: '/admin/monetization', label: 'Plans, abonnements & capacités', icon: Gift },
      { path: '/admin/marketing', label: 'Coupons & invitations gratuites', icon: Tag },
      { path: '/admin/fintech', label: 'Règles financières & parrainage', icon: CreditCard },
      { path: '/admin/payouts', label: 'Retraits', icon: Wallet },
      { path: '/admin/structures/b2b', label: 'Contrats B2B', icon: FileSignature },
    ],
  },
  {
    id: 'platform-governance', label: 'Plateforme & gouvernance', icon: Settings,
    items: [
      { path: '/admin/moteurs-services', label: 'Moteurs externes', icon: Gauge },
      { path: '/admin/cms-branding', label: 'CMS & identité', icon: Settings },
      { path: '/admin/traductions', label: 'Traductions', icon: Languages },
    ],
  },
];

function pathMatches(item: AdminNavItem, pathname: string) {
  const itemPath = item.path.split('?', 1)[0];
  if (item.exact) return pathname === itemPath;
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

export function findAdminEcosystem(pathname: string): AdminEcosystemNavigation | null {
  return ADMIN_ECOSYSTEMS.find(ecosystem => ecosystem.matchPrefixes.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`))) || null;
}

export function findAdminEcosystemItem(pathname: string): AdminNavItem | null {
  const ecosystem = findAdminEcosystem(pathname);
  if (!ecosystem) return null;
  return ecosystem.groups
    .flatMap(group => group.items)
    .filter(item => pathMatches(item, pathname))
    .sort((a, b) => b.path.length - a.path.length)[0] || null;
}

export function adminNavItemMatchesPath(item: AdminNavItem, pathname: string) {
  if (item.ecosystemId) return findAdminEcosystem(pathname)?.id === item.ecosystemId;
  return pathMatches(item, pathname);
}

export const ADMIN_NAV_ITEMS = ADMIN_NAV_GROUPS.flatMap(group => group.items);


export function adminGroupHubPath(groupId: string): string {
  if (groupId === 'dashboard') return '/admin/dashboard';
  if (groupId === 'users-access') return '/admin/section/utilisateurs-acces';
  if (groupId === 'ecosystems') return '/admin/ecosystemes';
  if (groupId === 'commerce-finance') return '/admin/section/commerce-finance';
  if (groupId === 'platform-governance') return '/admin/section/plateforme-gouvernance';
  return '/admin/dashboard';
}

export function adminEcosystemGroupHubPath(ecosystemId: EcosystemId, groupId: string): string {
  return `/admin/ecosystemes/${ecosystemId}/${groupId}`;
}
