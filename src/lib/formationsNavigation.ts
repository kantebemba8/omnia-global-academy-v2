import {
  Award,
  BadgeCheck,
  BarChart3,
  BookOpen,
  ClipboardCheck,
  FileCheck2,
  GraduationCap,
  LayoutGrid,
  PlusCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { normalizePlatformRoles, type CanonicalPlatformRole } from './session';

export type FormationsAudience = 'public' | 'apprenant' | 'professeur' | 'structure' | 'moderateur' | 'recruteur' | 'organisateur' | 'coach' | 'super_admin';

export type FormationsNavChild = {
  label: string;
  path: string;
  description: string;
  icon: LucideIcon;
};

export type FormationsNavGroup = {
  id: string;
  label: string;
  path: string;
  description: string;
  icon: LucideIcon;
  children?: FormationsNavChild[];
};

const HOME: FormationsNavGroup = {
  id: 'accueil',
  label: 'Accueil',
  path: '/formations',
  description: 'Vue d’ensemble de l’univers Formations.',
  icon: GraduationCap,
};

const CATALOGUE: FormationsNavGroup = {
  id: 'catalogue',
  label: 'Catalogue',
  path: '/catalogue',
  description: 'Explorer les formations disponibles.',
  icon: Search,
};

const NAV: Record<FormationsAudience, FormationsNavGroup[]> = {
  public: [HOME, CATALOGUE],
  apprenant: [
    HOME,
    {
      id: 'apprentissage',
      label: 'Apprentissage',
      path: '/formations/apprentissage',
      description: 'Cours, progression et reprise de parcours.',
      icon: BookOpen,
      children: [
        { label: 'Mes formations', path: '/dashboard/mes-cours', description: 'Formations en cours et terminées.', icon: BookOpen },
        { label: 'Explorer le catalogue', path: '/catalogue', description: 'Découvrir de nouvelles formations.', icon: Search },
      ],
    },
    {
      id: 'evaluations',
      label: 'Évaluations',
      path: '/formations/evaluations',
      description: 'Sessions, résultats et demandes liées aux évaluations.',
      icon: ClipboardCheck,
      children: [
        { label: 'Mes évaluations', path: '/dashboard/evaluations', description: 'Évaluations disponibles, passées et suivies.', icon: ClipboardCheck },
      ],
    },
    {
      id: 'preuves',
      label: 'Preuves & compétences',
      path: '/formations/preuves',
      description: 'Certificats, badges et preuves vérifiables.',
      icon: BadgeCheck,
      children: [
        { label: 'Mes certificats', path: '/dashboard/certificats', description: 'Certificats obtenus et vérification.', icon: Award },
        { label: 'Badges', path: '/dashboard/badges', description: 'Badges et preuves de compétences.', icon: BadgeCheck },
        { label: 'Learning Record', path: '/dashboard/learning-record', description: 'Registre consolidé de vos acquis.', icon: FileCheck2 },
        { label: 'Skills Passport', path: '/dashboard/skills-passport', description: 'Passeport de compétences partageable.', icon: Sparkles },
      ],
    },
  ],
  professeur: [
    HOME,
    {
      id: 'conception',
      label: 'Conception',
      path: '/formations/conception',
      description: 'Créer, structurer et faire évoluer vos formations.',
      icon: LayoutGrid,
      children: [
        { label: 'Mes formations', path: '/professeur/courses', description: 'Portfolio pédagogique et statuts.', icon: BookOpen },
        { label: 'Créer une formation', path: '/professeur/courses/new', description: 'Création manuelle, depuis un fichier ou assistée.', icon: PlusCircle },
      ],
    },
    {
      id: 'evaluations',
      label: 'Évaluations',
      path: '/formations/evaluations',
      description: 'Programmer, corriger et réviser les évaluations.',
      icon: ClipboardCheck,
      children: [
        { label: 'Assessment Center', path: '/professeur/assessment-center', description: 'Sessions et corrections.', icon: ClipboardCheck },
        { label: 'Jurys & révisions', path: '/professeur/jurys', description: 'Jurys, experts et révisions.', icon: Users },
      ],
    },
    {
      id: 'suivi',
      label: 'Suivi',
      path: '/formations/suivi',
      description: 'Résultats, certificats et lecture de la performance.',
      icon: BarChart3,
      children: [
        { label: 'Certificats', path: '/professeur/certificats', description: 'Certificats délivrés par vos formations.', icon: Award },
        { label: 'Analytique', path: '/professeur/analytics', description: 'Progression et activité des apprenants.', icon: BarChart3 },
      ],
    },
  ],
  structure: [
    HOME,
    {
      id: 'conception',
      label: 'Formations de la Structure',
      path: '/formations/conception',
      description: 'Créer et piloter les formations de votre organisation.',
      icon: BookOpen,
      children: [
        { label: 'Mes formations', path: '/structure/formations', description: 'Portfolio de formations de la Structure.', icon: BookOpen },
        { label: 'Créer une formation', path: '/structure/courses/new', description: 'Créer ou importer une formation.', icon: PlusCircle },
      ],
    },
    {
      id: 'evaluations',
      label: 'Évaluations',
      path: '/formations/evaluations',
      description: 'Organiser les évaluations et jurys liés aux formations.',
      icon: ClipboardCheck,
      children: [
        { label: 'Assessment Center', path: '/structure/assessment-center', description: 'Sessions et corrections.', icon: ClipboardCheck },
        { label: 'Jurys & révisions', path: '/structure/jurys', description: 'Experts, jurys et révisions.', icon: Users },
      ],
    },
  ],
  moderateur: [
    HOME,
    {
      id: 'controle',
      label: 'Contrôle pédagogique',
      path: '/formations/controle',
      description: 'Examiner les formations selon vos permissions.',
      icon: ShieldCheck,
      children: [
        { label: 'Formations à contrôler', path: '/moderator/courses', description: 'Soumissions, modifications et décisions.', icon: ShieldCheck },
      ],
    },
  ],
  recruteur: [HOME, CATALOGUE],
  organisateur: [HOME, CATALOGUE],
  coach: [HOME, CATALOGUE],
  super_admin: [HOME],
};

export function getFormationsNavigation(audience: FormationsAudience): FormationsNavGroup[] {
  return NAV[audience] || NAV.public;
}

export function resolveFormationsAudience(
  roles: readonly string[] | null | undefined,
  requestedRole?: string | null,
): FormationsAudience {
  const normalized = normalizePlatformRoles(roles);
  const requested = requestedRole as CanonicalPlatformRole | undefined;
  if (requested && normalized.includes('super_admin') && ['apprenant', 'professeur', 'structure', 'moderateur', 'recruteur', 'organisateur', 'coach'].includes(requested)) {
    return requested as FormationsAudience;
  }
  if (normalized.includes('super_admin')) return 'super_admin';
  const priority: FormationsAudience[] = ['moderateur', 'structure', 'organisateur', 'recruteur', 'professeur', 'coach', 'apprenant'];
  return priority.find(role => normalized.includes(role as CanonicalPlatformRole)) || (normalized.length ? 'apprenant' : 'public');
}

export function formationsAudienceLabel(audience: FormationsAudience) {
  return ({
    public: 'Découvrir',
    apprenant: 'Apprenant',
    professeur: 'Professeur',
    structure: 'Structure',
    moderateur: 'Modérateur',
    recruteur: 'Recruteur',
    organisateur: 'Organisateur',
    coach: 'Coach',
    super_admin: 'Administration',
  } satisfies Record<FormationsAudience, string>)[audience];
}

export function findFormationsSection(audience: FormationsAudience, pathname: string) {
  const groups = getFormationsNavigation(audience);
  return groups.find(group => {
    if (pathname === group.path || pathname.startsWith(`${group.path}/`)) return true;
    return group.children?.some(item => pathname === item.path || pathname.startsWith(`${item.path}/`));
  });
}
