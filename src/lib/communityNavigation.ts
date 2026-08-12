import {
  BookOpen,
  Home,
  MessageCircle,
  MessagesSquare,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { normalizePlatformRoles, type CanonicalPlatformRole } from './session';

export type CommunityAudience = 'public' | 'apprenant' | 'professeur' | 'structure' | 'moderateur' | 'recruteur' | 'organisateur' | 'coach' | 'super_admin';

export type CommunityNavChild = {
  label: string;
  path: string;
  description: string;
  icon: LucideIcon;
};

export type CommunityNavGroup = {
  id: string;
  label: string;
  path: string;
  description: string;
  icon: LucideIcon;
  children?: CommunityNavChild[];
};

const HOME: CommunityNavGroup = {
  id: 'accueil',
  label: 'Accueil',
  path: '/forum',
  description: 'Vue d’ensemble de la Communauté selon votre rôle.',
  icon: Home,
};

const EXCHANGES: CommunityNavGroup = {
  id: 'echanges',
  label: 'Échanger',
  path: '/forum/echanges',
  description: 'Choisir le bon espace de discussion selon votre besoin.',
  icon: MessagesSquare,
  children: [
    {
      label: 'Espace général',
      path: '/forum/general',
      description: 'Entraide, orientation, apprentissage et vie dans l’écosystème Omnia.',
      icon: MessageCircle,
    },
    {
      label: 'Forums des formations',
      path: '/forum/formations',
      description: 'Questions et réponses réservées aux formations auxquelles vous avez accès.',
      icon: BookOpen,
    },
  ],
};

const MODERATION: CommunityNavGroup = {
  id: 'moderation',
  label: 'Modération',
  path: '/moderator/forum',
  description: 'Examiner les contenus et signalements selon vos permissions.',
  icon: ShieldCheck,
};

const NAV: Record<CommunityAudience, CommunityNavGroup[]> = {
  public: [HOME, EXCHANGES],
  apprenant: [HOME, EXCHANGES],
  professeur: [HOME, EXCHANGES],
  structure: [HOME, EXCHANGES],
  recruteur: [HOME, EXCHANGES],
  organisateur: [HOME, EXCHANGES],
  coach: [HOME, EXCHANGES],
  moderateur: [HOME, EXCHANGES, MODERATION],
  super_admin: [HOME, EXCHANGES],
};

export function getCommunityNavigation(audience: CommunityAudience): CommunityNavGroup[] {
  return NAV[audience] || NAV.public;
}

export function resolveCommunityAudience(
  roles: readonly string[] | null | undefined,
  requestedRole?: string | null,
): CommunityAudience {
  const normalized = normalizePlatformRoles(roles);
  const requested = requestedRole as CanonicalPlatformRole | undefined;
  if (
    requested &&
    normalized.includes('super_admin') &&
    ['apprenant', 'professeur', 'structure', 'moderateur', 'recruteur', 'organisateur', 'coach'].includes(requested)
  ) {
    return requested as CommunityAudience;
  }
  if (normalized.includes('super_admin')) return 'super_admin';
  if (normalized.includes('structure') || normalized.includes('recruteur_structure') || normalized.includes('gestionnaire_structure')) return 'structure';
  const priority: CommunityAudience[] = ['moderateur', 'organisateur', 'recruteur', 'professeur', 'coach', 'apprenant'];
  return priority.find(role => normalized.includes(role as CanonicalPlatformRole)) || (normalized.length ? 'apprenant' : 'public');
}

export function communityAudienceLabel(audience: CommunityAudience) {
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
  } satisfies Record<CommunityAudience, string>)[audience];
}

function clean(path: string) {
  return path.split('#', 1)[0].split('?', 1)[0];
}

export function findCommunitySection(audience: CommunityAudience, pathname: string) {
  return getCommunityNavigation(audience).find(group => {
    const gp = clean(group.path);
    if (pathname === gp || pathname.startsWith(`${gp}/`)) return true;
    return Boolean(group.children?.some(child => {
      const cp = clean(child.path);
      return pathname === cp || pathname.startsWith(`${cp}/`);
    }));
  });
}
