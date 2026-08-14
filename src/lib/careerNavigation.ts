import {
  Briefcase,
  FileText,
  FolderOpen,
  Mail,
  MessageSquare,
  Settings,
  Sparkles,
  Target,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { normalizePlatformRoles, type CanonicalPlatformRole } from './session';

export type CareerAudience = 'public' | 'apprenant' | 'professeur' | 'structure' | 'moderateur' | 'recruteur' | 'organisateur' | 'coach' | 'super_admin';

export type CareerNavChild = {
  label: string;
  path: string;
  description: string;
  icon: LucideIcon;
};

export type CareerNavGroup = {
  id: string;
  label: string;
  path: string;
  description: string;
  icon: LucideIcon;
  children?: CareerNavChild[];
};

const PUBLIC_NAV: CareerNavGroup[] = [
  { id: 'accueil', label: 'Accueil Career', path: '/career-studio', description: 'Découvrir Omnia Career.', icon: Sparkles },
  { id: 'opportunites', label: 'Opportunités', path: '/forum/emploi', description: 'Explorer les offres publiées sur Omnia.', icon: Briefcase },
  { id: 'conseils', label: 'Conseils carrière', path: '/forum/carriere', description: 'Échanger et poser vos questions carrière.', icon: MessageSquare },
];

const LEARNER_NAV: CareerNavGroup[] = [
  { id: 'accueil', label: 'Accueil', path: '/omnia-career', description: 'Vue d’ensemble de votre progression carrière.', icon: Sparkles },
  {
    id: 'documents',
    label: 'Documents',
    path: '/omnia-career/documents',
    description: 'Créer, améliorer et organiser vos documents professionnels.',
    icon: FolderOpen,
    children: [
      { label: 'CV Builder', path: '/omnia-career/cv-builder', description: 'Créer et maintenir vos CV.', icon: FileText },
      { label: 'Lettres de motivation', path: '/omnia-career/lettres', description: 'Créer et personnaliser vos lettres.', icon: Mail },
    ],
  },
  {
    id: 'preparation',
    label: 'Préparation',
    path: '/omnia-career/preparation',
    description: 'Préparer votre positionnement et vos entretiens.',
    icon: Target,
    children: [
      { label: 'Préparation entretien', path: '/omnia-career/entretien', description: 'Questions, simulations et conseils.', icon: MessageSquare },
      { label: 'Profil carrière', path: '/omnia-career/profil', description: 'Votre profil professionnel Omnia.', icon: UserRound },
    ],
  },
  { id: 'candidatures', label: 'Candidatures', path: '/omnia-career/candidatures', description: 'Suivre vos candidatures et relances.', icon: Briefcase },
  { id: 'opportunites', label: 'Opportunités', path: '/forum/emploi', description: 'Découvrir les offres compatibles avec votre projet.', icon: Sparkles },
  { id: 'parametres', label: 'Paramètres', path: '/omnia-career/parametres', description: 'Préférences et confidentialité Career.', icon: Settings },
];

const CONNECTED_CONTEXT_NAV: CareerNavGroup[] = [
  { id: 'accueil', label: 'Accueil', path: '/career-studio', description: 'Vue Career contextualisée pour votre rôle.', icon: Sparkles },
  { id: 'opportunites', label: 'Opportunités', path: '/forum/emploi', description: 'Explorer les opportunités professionnelles publiées sur Omnia.', icon: Briefcase },
  { id: 'conseils', label: 'Conseils carrière', path: '/forum/carriere', description: 'Échanger autour de l’employabilité et des trajectoires.', icon: MessageSquare },
];

export function getCareerNavigation(audience: CareerAudience): CareerNavGroup[] {
  if (audience === 'apprenant') return LEARNER_NAV;
  if (audience === 'public' || audience === 'super_admin') return PUBLIC_NAV;
  return CONNECTED_CONTEXT_NAV;
}

export function resolveCareerAudience(roles: readonly string[] | null | undefined, requestedRole?: string | null): CareerAudience {
  const normalized = normalizePlatformRoles(roles || []);
  const requested = requestedRole as CanonicalPlatformRole | undefined;
  if (requested && normalized.includes('super_admin') && ['apprenant','professeur','structure','moderateur','recruteur','organisateur','coach'].includes(requested)) return requested as CareerAudience;
  if (normalized.includes('super_admin')) return 'super_admin';
  if (normalized.includes('structure') || normalized.includes('gestionnaire_structure')) return 'structure';
  const priority: CareerAudience[] = ['moderateur','organisateur','recruteur','professeur','coach','apprenant'];
  return priority.find(role => normalized.includes(role as CanonicalPlatformRole)) || (normalized.length ? 'apprenant' : 'public');
}

export function careerAudienceLabel(audience: CareerAudience) {
  return ({ public:'Découvrir', apprenant:'Apprenant', professeur:'Professeur', structure:'Structure', moderateur:'Modérateur', recruteur:'Recruteur', organisateur:'Organisateur', coach:'Coach', super_admin:'Administration' } satisfies Record<CareerAudience,string>)[audience];
}

export function findCareerSection(audience: CareerAudience, pathname: string) {
  return getCareerNavigation(audience).find(group => {
    if (group.id === 'accueil') return pathname === group.path;
    if (pathname === group.path || pathname.startsWith(`${group.path}/`)) return true;
    return group.children?.some(child => {
      const childPath = child.path.split('?', 1)[0];
      return pathname === childPath || pathname.startsWith(`${childPath}/`);
    });
  });
}
