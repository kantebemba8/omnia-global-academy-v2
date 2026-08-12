import {
  Briefcase,
  ClipboardList,
  Compass,
  FileCheck2,
  FolderKanban,
  LayoutGrid,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { normalizePlatformRoles, type CanonicalPlatformRole } from './session';

export type ProjectsAudience = 'public' | 'apprenant' | 'professeur' | 'structure' | 'moderateur' | 'recruteur' | 'organisateur' | 'coach' | 'super_admin';

export type ProjectsNavChild = {
  label: string;
  path: string;
  description: string;
  icon: LucideIcon;
};

export type ProjectsNavGroup = {
  id: string;
  label: string;
  path: string;
  description: string;
  icon: LucideIcon;
  children?: ProjectsNavChild[];
};

const HOME: ProjectsNavGroup = { id: 'accueil', label: 'Accueil', path: '/projects', description: 'Vue d’ensemble de l’univers Omnia Projects.', icon: Sparkles };
const EXPLORE: ProjectsNavGroup = { id: 'explorer', label: 'Explorer', path: '/projects/explorer', description: 'Découvrir les projets, défis et missions disponibles.', icon: Compass };

const NAV: Record<ProjectsAudience, ProjectsNavGroup[]> = {
  public: [HOME, EXPLORE],
  apprenant: [
    HOME,
    EXPLORE,
    {
      id: 'participation',
      label: 'Participation',
      path: '/projects/participation',
      description: 'Candidatures, équipes, invitations et livrables réunis dans un même espace.',
      icon: FolderKanban,
      children: [
        { label: 'Mes candidatures', path: '/projects/mes-projets#candidatures', description: 'Suivre les candidatures envoyées et leur statut.', icon: ClipboardList },
        { label: 'Mes équipes', path: '/projects/mes-projets#equipes', description: 'Équipes rejointes, invitations et membres.', icon: Users },
        { label: 'Mes livrables', path: '/projects/mes-projets#livrables', description: 'Déposer et retrouver vos livrables de projet.', icon: FileCheck2 },
      ],
    },
    { id: 'portfolio', label: 'Portfolio', path: '/dashboard/project-portfolio', description: 'Valoriser les preuves de projets que vous choisissez de publier.', icon: Briefcase },
  ],
  professeur: [
    HOME,
    EXPLORE,
    {
      id: 'pilotage',
      label: 'Pilotage',
      path: '/projects/pilotage',
      description: 'Créer, suivre et évaluer les projets que vous portez.',
      icon: LayoutGrid,
      children: [
        { label: 'Mes projets', path: '/professeur/projects', description: 'Portfolio de projets et statuts de publication.', icon: FolderKanban },
        { label: 'Jalons', path: '/professeur/projects#jalons', description: 'Structurer le cycle du projet et ses échéances.', icon: Target },
        { label: 'Équipes', path: '/professeur/projects#equipes', description: 'Constituer et suivre les équipes projet.', icon: Users },
        { label: 'Livrables', path: '/professeur/projects#livrables', description: 'Examiner les livrables reçus.', icon: FileCheck2 },
        { label: 'Candidatures', path: '/professeur/projects#candidatures', description: 'Étudier et décider sur les candidatures.', icon: ClipboardList },
      ],
    },
  ],
  structure: [
    HOME,
    EXPLORE,
    {
      id: 'pilotage',
      label: 'Pilotage',
      path: '/projects/pilotage',
      description: 'Créer et gouverner les projets portés par votre Structure.',
      icon: LayoutGrid,
      children: [
        { label: 'Projets de la Structure', path: '/structure/projects', description: 'Portefeuille de projets de votre organisation.', icon: FolderKanban },
        { label: 'Jalons', path: '/structure/projects#jalons', description: 'Planifier les jalons et résultats attendus.', icon: Target },
        { label: 'Équipes', path: '/structure/projects#equipes', description: 'Suivre les équipes engagées.', icon: Users },
        { label: 'Livrables', path: '/structure/projects#livrables', description: 'Évaluer les livrables reçus.', icon: FileCheck2 },
        { label: 'Candidatures', path: '/structure/projects#candidatures', description: 'Gérer les candidatures aux projets.', icon: ClipboardList },
      ],
    },
  ],
  moderateur: [HOME, EXPLORE],
  recruteur: [HOME, EXPLORE],
  organisateur: [HOME, EXPLORE],
  coach: [HOME, EXPLORE],
  super_admin: [HOME],
};

export function getProjectsNavigation(audience: ProjectsAudience): ProjectsNavGroup[] {
  return NAV[audience] || NAV.public;
}

export function resolveProjectsAudience(roles: readonly string[] | null | undefined, requestedRole?: string | null): ProjectsAudience {
  const normalized = normalizePlatformRoles(roles);
  const requested = requestedRole as CanonicalPlatformRole | undefined;
  if (requested && normalized.includes('super_admin') && ['apprenant', 'professeur', 'structure', 'moderateur', 'recruteur', 'organisateur', 'coach'].includes(requested)) {
    return requested as ProjectsAudience;
  }
  if (normalized.includes('super_admin')) return 'super_admin';
  const priority: ProjectsAudience[] = ['moderateur', 'structure', 'organisateur', 'recruteur', 'professeur', 'coach', 'apprenant'];
  return priority.find(role => normalized.includes(role as CanonicalPlatformRole)) || (normalized.length ? 'apprenant' : 'public');
}

export function projectsAudienceLabel(audience: ProjectsAudience) {
  return ({
    public: 'Découvrir', apprenant: 'Apprenant', professeur: 'Professeur', structure: 'Structure', moderateur: 'Modérateur', recruteur: 'Recruteur', organisateur: 'Organisateur', coach: 'Coach', super_admin: 'Administration',
  } satisfies Record<ProjectsAudience, string>)[audience];
}

function pathOnly(path: string) {
  return path.split('#', 1)[0].split('?', 1)[0];
}

export function findProjectsSection(audience: ProjectsAudience, pathname: string) {
  return getProjectsNavigation(audience).find(group => {
    const groupPath = pathOnly(group.path);
    if (pathname === groupPath || pathname.startsWith(`${groupPath}/`)) return true;
    return group.children?.some(child => {
      const childPath = pathOnly(child.path);
      return pathname === childPath || pathname.startsWith(`${childPath}/`);
    });
  });
}
