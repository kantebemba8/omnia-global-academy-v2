import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  LayoutDashboard, BookOpen, PlusCircle, Users, QrCode,
  BarChart2, Bell, Settings, Building2, UserCheck, Shield, Briefcase, Search,
  CalendarDays, Heart, MessageSquare, UserRoundSearch, User, Radio, Layers3,
  ClipboardCheck, CreditCard, FolderKanban, FileSignature, Network, LineChart, ShieldCheck,
} from 'lucide-react';
import { DashboardLayout, type NavGroup } from './DashboardLayout';
import { getStoredUser } from '../lib/session';
import { edgeAuthHeaders } from '../lib/edgeAuth';
import ContextualHeaderSearch from './ContextualHeaderSearch';

const STRUCTURE_API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/structure-manage`;

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
      { path: '/structure/recrutement/competences-verifiees', label: 'Compétences vérifiées', icon: ShieldCheck },
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
      { path: '/structure/suivi-rh', label: 'Statistiques & suivi', icon: BarChart2 },
      { path: '/mon-profil?tab=notifications', label: 'Notifications', icon: Bell },
      { path: '/mon-profil?tab=visibilite', label: 'Paramètres et confidentialité', icon: Settings },
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
  roles: string[],
): NavGroup[] {
  if (isPrimary) return STRUCTURE_NAV_GROUPS;

  const courseAccess = hasAny(permissions, [
    'can_create_courses', 'can_edit_courses', 'can_submit_courses', 'can_assign_trainers',
    'can_manage_lessons', 'can_upload_files',
  ]);
  const recruitmentAccess = roles.includes('recruteur_structure')
    || Object.values(recruitmentPermissions).some(Boolean);

  return STRUCTURE_NAV_GROUPS.map(group => {
    if (group.id === 'structure-members') {
      return {
        ...group,
        items: group.items.filter(item => {
          if (item.path === '/structure/profil') return true;
          if (item.path === '/structure/membres') return hasAny(permissions, ['can_manage_members', 'can_approve_memberships']);
          if (item.path === '/structure/organisation' || item.path === '/structure/suivi-rh') return permissions.can_manage_structure_users === true || permissions.can_view_statistics === true;
          if (item.path === '/structure/rattachements') return permissions.can_approve_memberships === true;
          if (item.path === '/structure/codes') return permissions.can_manage_structure_codes === true;
          if (item.path === '/structure/abonnements') return permissions.can_manage_settings === true;
          if (item.path === '/structure/commerce-b2b') return permissions.can_manage_b2b_contracts === true;
          if (item.path === '/structure/equipe') return permissions.can_manage_structure_users === true;
          return false;
        }),
      };
    }
    if (group.id === 'formations') {
      return {
        ...group,
        items: group.items.filter(item => {
          if (item.path === '/structure/projects') return permissions.can_manage_projects === true;
          if (item.path === '/structure/courses/new') return permissions.can_create_courses === true;
          return courseAccess;
        }),
      };
    }
    if (group.id === 'recruitment') return recruitmentAccess ? group : { ...group, items: [] };
    if (group.id === 'management') {
      return {
        ...group,
        items: group.items.filter(item => item.path !== '/structure/suivi-rh' || permissions.can_view_statistics === true),
      };
    }
    return group;
  }).filter(group => group.items.length > 0);
}

function homePath(groups: NavGroup[]) {
  return groups === STRUCTURE_RECRUITER_NAV_GROUPS ? '/structure/recrutement/dashboard' : '/structure/dashboard';
}

export function StructureLayout({ children }: { children: ReactNode; displayName?: string }) {
  const location = useLocation();
  const [structureContext, setStructureContext] = useState<StructureContext | null>(null);
  const user = getStoredUser<StoredUser>();
  const roles = user?.roles || [];

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
    const dedicatedRecruiter = roles.includes('recruteur_structure') && !isPrimary && !hasNonRecruitmentDelegation;

    if (dedicatedRecruiter) return STRUCTURE_RECRUITER_NAV_GROUPS;
    if (!structureContext) {
      return roles.includes('recruteur_structure') ? STRUCTURE_RECRUITER_NAV_GROUPS : STRUCTURE_NAV_GROUPS;
    }
    return filterStructureNavigation(permissions, recruitmentPermissions, isPrimary, roles);
  }, [roles, structureContext]);

  const recruitmentItems = visibleGroups.find(group => group.id === 'recruitment')?.items || [];
  const showRecruitmentSearch = recruitmentItems.length > 0
    && (location.pathname.startsWith('/structure/recrutement') || location.pathname === '/structure/offres-emploi');

  return (
    <DashboardLayout
      role="directeur"
      navGroups={visibleGroups}
      brandTitle="Omnia"
      brandAccent="Structure"
      headerSearch={showRecruitmentSearch ? <ContextualHeaderSearch items={recruitmentItems.map(item => ({ id: item.path, label: item.label, description: 'Navigation recrutement Structure', path: item.path }))} placeholder="Rechercher dans le recrutement..." /> : undefined}
      spaceHomePath={homePath(visibleGroups)}
      spaceHomeLabel="Accueil de mon espace"
    >
      {children}
    </DashboardLayout>
  );
}
