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

export type CareerAudience = 'public' | 'apprenant';

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

export function getCareerNavigation(audience: CareerAudience): CareerNavGroup[] {
  return audience === 'apprenant' ? LEARNER_NAV : PUBLIC_NAV;
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
