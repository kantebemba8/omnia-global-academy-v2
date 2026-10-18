import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { LayoutDashboard, BookOpen, Users, QrCode, BarChart2, Building2, UserCheck, Shield, Briefcase, Search, CalendarDays, Heart, MessageSquare, UserRoundSearch, Radio, Layers3, CreditCard, FolderKanban, FileSignature, Network, LineChart, ShieldCheck } from 'lucide-react';
import { DashboardLayout, type NavGroup } from './DashboardLayout';
import { getStoredUser } from '../lib/session';
import { edgeAuthHeaders } from '../lib/edgeAuth';
import ContextualHeaderSearch from './ContextualHeaderSearch';

const STRUCTURE_API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/structure-manage`;

const STRUCTURE_NAV_GROUPS: NavGroup[] = [
  {
    id: 'dashboard', label: 'Accueil', icon: LayoutDashboard,
    items: [{ path: '/home?role=structure', label: 'Accueil', icon: LayoutDashboard, exact: true }],
  },
  {
    id: 'organization', label: 'Organisation & accès', icon: Building2,
    items: [
      { path: '/structure/profil', label: 'Profil de la Structure', icon: Building2 },
      { path: '/structure/membres', label: 'Membres', icon: Users },
      { path: '/structure/equipe', label: 'Équipe & accès', icon: Shield },
      { path: '/structure/rattachements', label: 'Rattachements', icon: UserCheck },
      { path: '/structure/codes', label: 'Codes Structure', icon: QrCode },
    ],
  },
  {
    id: 'learning', label: 'Formation & projets', icon: BookOpen,
    items: [
      { path: '/formations', label: 'Formations', icon: BookOpen },
      { path: '/structure/projects', label: 'Omnia Projects', icon: FolderKanban },
    ],
  },
  {
    id: 'recruitment', label: 'Talent & recrutement', icon: Briefcase,
    items: [
      { path: '/structure/recrutement/dashboard', label: 'Vue recrutement', icon: UserRoundSearch, exact: true },
      { path: '/structure/offres-emploi', label: 'Offres d’emploi', icon: Briefcase },
      { path: '/structure/recrutement/talents', label: 'Recherche de talents', icon: Search },
      { path: '/structure/recrutement/competences-verifiees', label: 'Compétences vérifiées', icon: ShieldCheck },
      { path: '/structure/recrutement/candidats', label: 'Candidats', icon: Users },
      { path: '/structure/recrutement/favoris', label: 'Favoris', icon: Heart },
      { path: '/structure/recrutement/entretiens', label: 'Entretiens', icon: CalendarDays },
      { path: '/structure/recrutement/messages', label: 'Messages', icon: MessageSquare },
    ],
  },
  {
    id: 'operations', label: 'Pilotage & contrats', icon: BarChart2,
    items: [
      { path: '/structure/organisation', label: 'Organisation & obligations', icon: Network },
      { path: '/structure/suivi-rh', label: 'RH & conformité', icon: LineChart },
      { path: '/structure/abonnements', label: 'Abonnements & capacités', icon: CreditCard },
      { path: '/structure/commerce-b2b', label: 'B2B & contrats', icon: FileSignature },
    ],
  },
  {
    id: 'ecosystem', label: 'Écosystème Omnia', icon: Layers3,
    items: [
      { path: '/talent', label: 'Omnia Talent', icon: Search },
      { path: '/omnia-live', label: 'Omnia Live', icon: Radio },
    ],
  },
];

const RECRUITMENT_ONLY_NAV_GROUPS: NavGroup[] = [
  {
    id: 'dashboard', label: 'Accueil', icon: LayoutDashboard,
    items: [{ path: '/structure/recrutement/dashboard', label: 'Accueil', icon: LayoutDashboard, exact: true }],
  },
  {
    id: 'recruitment', label: 'Talent & recrutement', icon: Briefcase,
    items: [
      { path: '/structure/offres-emploi', label: 'Offres d’emploi', icon: Briefcase },
      { path: '/structure/recrutement/talents', label: 'Recherche de talents', icon: Search },
      { path: '/structure/recrutement/competences-verifiees', label: 'Compétences vérifiées', icon: ShieldCheck },
      { path: '/structure/recrutement/candidats', label: 'Candidats', icon: Users },
      { path: '/structure/recrutement/favoris', label: 'Favoris', icon: Heart },
      { path: '/structure/recrutement/entretiens', label: 'Entretiens', icon: CalendarDays },
      { path: '/structure/recrutement/messages', label: 'Messages', icon: MessageSquare },
      { path: '/structure/recrutement/statistiques', label: 'Statistiques', icon: BarChart2 },
    ],
  },
  {
    id: 'ecosystem', label: 'Écosystème Omnia', icon: Layers3,
    items: [{ path: '/talent', label: 'Omnia Talent', icon: Search }],
  },
];

type StoredUser = { roles?: string[] };
type StructureContext = {
  is_primary?: boolean;
  my_permissions?: Record<string, boolean>;
  my_recruitment_permissions?: Record<string, boolean>;
};

function hasAny(source: Record<string, boolean>, keys: string[]) {
  return keys.some(key => source[key] === true);
}

function filterStructureNavigation(
  permissions: Record<string, boolean>,
  recruitmentPermissions: Record<string, boolean>,
  isPrimary: boolean,
): NavGroup[] {
  if (isPrimary) return STRUCTURE_NAV_GROUPS;

  const courseAccess = hasAny(permissions, [
    'can_create_courses', 'can_edit_courses', 'can_submit_courses', 'can_assign_trainers',
    'can_manage_lessons', 'can_upload_files',
  ]);
  const recruitmentAccess = Object.values(recruitmentPermissions).some(Boolean);

  return STRUCTURE_NAV_GROUPS.map(group => {
    if (group.id === 'organization') {
      return {
        ...group,
        items: group.items.filter(item => {
          if (item.path === '/structure/profil') return true;
          if (item.path === '/structure/membres') return hasAny(permissions, ['can_manage_members', 'can_approve_memberships']);
          if (item.path === '/structure/equipe') return permissions.can_manage_structure_users === true;
          if (item.path === '/structure/rattachements') return permissions.can_approve_memberships === true;
          if (item.path === '/structure/codes') return permissions.can_manage_structure_codes === true;
          return false;
        }),
      };
    }

    if (group.id === 'learning') {
      return {
        ...group,
        items: group.items.filter(item => {
          if (item.path === '/structure/projects') return permissions.can_manage_projects === true;
          if (item.path === '/formations') return courseAccess;
          return false;
        }),
      };
    }

    if (group.id === 'recruitment') {
      return recruitmentAccess ? group : { ...group, items: [] };
    }

    if (group.id === 'operations') {
      return {
        ...group,
        items: group.items.filter(item => {
          if (item.path === '/structure/organisation') return permissions.can_manage_structure_users === true;
          if (item.path === '/structure/suivi-rh') return permissions.can_manage_structure_users === true || permissions.can_view_statistics === true;
          if (item.path === '/structure/abonnements') return permissions.can_manage_settings === true;
          if (item.path === '/structure/commerce-b2b') return permissions.can_manage_b2b_contracts === true;
          return false;
        }),
      };
    }

    return group;
  }).filter(group => group.items.length > 0);
}

export function StructureLayout({ children, headerTitle, headerSubtitle, headerSearch, ecosystemMode = false }: { children: ReactNode; displayName?: string; headerTitle?: string; headerSubtitle?: string; headerSearch?: ReactNode; ecosystemMode?: boolean }) {
  const location = useLocation();
  const [structureContext, setStructureContext] = useState<StructureContext | null>(null);
  const user = getStoredUser<StoredUser>();
  const roles = user?.roles || [];
  const roleThemeKey = roles.includes('gestionnaire_structure') && !roles.includes('structure')
    ? 'gestionnaire_structure'
    : 'structure';

  useEffect(() => {
    let active = true;
    fetch(STRUCTURE_API, {
      method: 'POST',
      headers: edgeAuthHeaders(),
      body: JSON.stringify({ action: 'get_my_structure' }),
    })
      .then(response => response.json())
      .then(data => {
        if (!active || data?.success !== true) return;
        setStructureContext({
          is_primary: data.is_primary === true,
          my_permissions: data.my_permissions || {},
          my_recruitment_permissions: data.my_recruitment_permissions || {},
        });
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const visibleGroups = useMemo(() => {
    const permissions = structureContext?.my_permissions || {};
    const recruitmentPermissions = structureContext?.my_recruitment_permissions || {};
    const isPrimary = structureContext?.is_primary === true;
    const hasNonRecruitmentDelegation = Object.values(permissions).some(Boolean);
    const hasRecruitmentDelegation = Object.values(recruitmentPermissions).some(Boolean);
    const recruitmentOnlyMember = !isPrimary && hasRecruitmentDelegation && !hasNonRecruitmentDelegation;

    if (!structureContext) return [];
    if (recruitmentOnlyMember) return RECRUITMENT_ONLY_NAV_GROUPS;
    return filterStructureNavigation(permissions, recruitmentPermissions, isPrimary);
  }, [structureContext]);

  const recruitmentItems = visibleGroups.find(group => group.id === 'recruitment')?.items || [];
  const showRecruitmentSearch = recruitmentItems.length > 0
    && (location.pathname.startsWith('/structure/recrutement') || location.pathname === '/structure/offres-emploi');

  return (
    <DashboardLayout
      role="directeur"
      roleThemeKey={roleThemeKey}
      navGroups={visibleGroups}
      brandTitle="Omnia"
      brandAccent="Structure"
      headerTitle={headerTitle}
      headerSubtitle={headerSubtitle}
      ecosystemMode={ecosystemMode}
      headerSearch={headerSearch ?? (showRecruitmentSearch ? <ContextualHeaderSearch items={recruitmentItems.map(item => ({ id: item.path, label: item.label, description: 'Navigation recrutement Structure', path: item.path }))} placeholder="Rechercher dans le recrutement..." /> : undefined)}
    >
      {children}
    </DashboardLayout>
  );
}
