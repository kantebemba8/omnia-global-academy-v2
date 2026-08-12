import {
  BadgeCheck,
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  Compass,
  CreditCard,
  HeartHandshake,
  Home,
  ListChecks,
  Package,
  Settings2,
  Sparkles,
  Star,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { normalizePlatformRoles, type CanonicalPlatformRole } from './session';

export type CoachingAudience = 'public' | 'apprenant' | 'professeur' | 'structure' | 'moderateur' | 'recruteur' | 'organisateur' | 'coach' | 'super_admin';

export type CoachingNavChild = {
  label: string;
  path: string;
  description: string;
  icon: LucideIcon;
};

export type CoachingNavGroup = {
  id: string;
  label: string;
  path: string;
  description: string;
  icon: LucideIcon;
  children?: CoachingNavChild[];
};

const HOME: CoachingNavGroup = {
  id: 'accueil',
  label: 'Accueil',
  path: '/coaching',
  description: 'Vue d’ensemble de l’écosystème Omnia Coaching selon votre rôle.',
  icon: Home,
};

const EXPLORE: CoachingNavGroup = {
  id: 'explorer',
  label: 'Trouver un coach',
  path: '/coaching/explorer',
  description: 'Explorer les coachs validés, domaines, langues et expertises.',
  icon: Compass,
};

const SOLUTIONS: CoachingNavGroup = {
  id: 'solutions',
  label: 'Solutions',
  path: '/coaching/solutions',
  description: 'Coaching collectif, recommandations et plans d’action.',
  icon: Sparkles,
};

const LEARNER_FOLLOW_UP: CoachingNavGroup = {
  id: 'accompagnement',
  label: 'Mon accompagnement',
  path: '/coaching/accompagnement',
  description: 'Retrouver vos séances, recommandations et continuité après coaching.',
  icon: HeartHandshake,
  children: [
    {
      label: 'Mes sessions',
      path: '/dashboard/coaching',
      description: 'Demandes, rendez-vous, paiements, historique et coachs favoris.',
      icon: CalendarDays,
    },
    {
      label: 'Recommandations & plans',
      path: '/dashboard/coaching/avance',
      description: 'Matching, coaching collectif et plans d’action.',
      icon: ListChecks,
    },
  ],
};

const COACH_PRACTICE: CoachingNavGroup = {
  id: 'pratique',
  label: 'Ma pratique',
  path: '/coaching/pratique',
  description: 'Piloter vos offres, disponibilités, séances et qualité d’accompagnement.',
  icon: HeartHandshake,
  children: [
    { label: 'Vue coach', path: '/coach/dashboard', description: 'Activité et priorités de votre pratique.', icon: BarChart3 },
    { label: 'Mes offres', path: '/coach/offres', description: 'Offres individuelles et demandes personnalisées.', icon: Settings2 },
    { label: 'Mon calendrier', path: '/coach/calendrier', description: 'Disponibilités, exceptions et rythme de réservation.', icon: CalendarDays },
    { label: 'Mes sessions', path: '/coach/sessions', description: 'Séances à venir, en cours et terminées.', icon: ListChecks },
    { label: 'Mes avis', path: '/coach/avis', description: 'Retours vérifiés et réponses du coach.', icon: Star },
  ],
};

const COACH_DEVELOPMENT: CoachingNavGroup = {
  id: 'developpement',
  label: 'Développer mon offre',
  path: '/coaching/developpement',
  description: 'Étendre votre accompagnement au collectif et aux produits avancés.',
  icon: Package,
  children: [
    { label: 'Coaching collectif', path: '/coach/produits', description: 'Programmes collectifs et produits avancés.', icon: Users },
    { label: 'Solutions Omnia', path: '/coaching/solutions', description: 'Voir l’expérience collective côté participant.', icon: Sparkles },
  ],
};

const COACH_BUSINESS: CoachingNavGroup = {
  id: 'revenus-plan',
  label: 'Revenus & plan',
  path: '/coaching/revenus-plan',
  description: 'Suivre les revenus et les paramètres commerciaux de votre activité.',
  icon: CircleDollarSign,
  children: [
    { label: 'Mes revenus', path: '/coach/revenus', description: 'Gains, disponibilité et retraits.', icon: CircleDollarSign },
    { label: 'Tarifs & abonnements', path: '/coach/commerce', description: 'Paramètres commerciaux du module Coaching.', icon: CreditCard },
    { label: 'Mon plan Omnia', path: '/coach/plan-omnia', description: 'Plan Omnia et avantages liés à votre activité.', icon: BadgeCheck },
  ],
};

const BECOME_COACH: CoachingNavGroup = {
  id: 'devenir-coach',
  label: 'Devenir coach',
  path: '/coaching/devenir-coach',
  description: 'Candidature, expertise, disponibilité et validation Omnia.',
  icon: BadgeCheck,
};

const NAV: Record<CoachingAudience, CoachingNavGroup[]> = {
  public: [HOME, EXPLORE, SOLUTIONS, BECOME_COACH],
  apprenant: [HOME, LEARNER_FOLLOW_UP, EXPLORE, SOLUTIONS],
  professeur: [HOME, EXPLORE, SOLUTIONS, BECOME_COACH],
  structure: [HOME, EXPLORE, SOLUTIONS],
  moderateur: [HOME, EXPLORE, SOLUTIONS],
  recruteur: [HOME, EXPLORE, SOLUTIONS],
  organisateur: [HOME, EXPLORE, SOLUTIONS],
  coach: [HOME, COACH_PRACTICE, COACH_DEVELOPMENT, COACH_BUSINESS],
  super_admin: [HOME],
};

export function getCoachingNavigation(audience: CoachingAudience): CoachingNavGroup[] {
  return NAV[audience] || NAV.public;
}

export function resolveCoachingAudience(
  roles: readonly string[] | null | undefined,
  requestedRole?: string | null,
): CoachingAudience {
  const normalized = normalizePlatformRoles(roles);
  const requested = requestedRole as CanonicalPlatformRole | undefined;
  if (
    requested &&
    normalized.includes('super_admin') &&
    ['apprenant', 'professeur', 'structure', 'moderateur', 'recruteur', 'organisateur', 'coach'].includes(requested)
  ) {
    return requested as CoachingAudience;
  }
  if (normalized.includes('super_admin')) return 'super_admin';
  if (normalized.includes('structure') || normalized.includes('recruteur_structure') || normalized.includes('gestionnaire_structure')) return 'structure';
  const priority: CoachingAudience[] = ['moderateur', 'organisateur', 'recruteur', 'professeur', 'coach', 'apprenant'];
  return priority.find(role => normalized.includes(role as CanonicalPlatformRole)) || (normalized.length ? 'apprenant' : 'public');
}

export function coachingAudienceLabel(audience: CoachingAudience) {
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
  } satisfies Record<CoachingAudience, string>)[audience];
}

function clean(path: string) {
  return path.split('#', 1)[0].split('?', 1)[0];
}

export function findCoachingSection(audience: CoachingAudience, pathname: string) {
  return getCoachingNavigation(audience).find(group => {
    const gp = clean(group.path);
    if (pathname === gp || pathname.startsWith(`${gp}/`)) return true;
    return Boolean(group.children?.some(child => {
      const cp = clean(child.path);
      return pathname === cp || pathname.startsWith(`${cp}/`);
    }));
  });
}
