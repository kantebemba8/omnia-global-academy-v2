import {
  BadgeCheck,
  Briefcase,
  Building2,
  CalendarDays,
  Compass,
  CreditCard,
  FileText,
  Heart,
  Info,
  MessageCircle,
  MessageSquare,
  Network,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { normalizePlatformRoles, type CanonicalPlatformRole } from './session';

export type TalentAudience = 'public' | 'apprenant' | 'professeur' | 'structure' | 'moderateur' | 'recruteur' | 'organisateur' | 'coach' | 'super_admin';

export type TalentNavChild = {
  label: string;
  path: string;
  description: string;
  icon: LucideIcon;
};

export type TalentNavGroup = {
  id: string;
  label: string;
  path: string;
  description: string;
  icon: LucideIcon;
  children?: TalentNavChild[];
};

const HOME: TalentNavGroup = { id: 'accueil', label: 'Accueil', path: '/talent', description: 'Vue d’ensemble de l’écosystème Omnia Talent.', icon: Sparkles };
const EXPLORE: TalentNavGroup = { id: 'explorer', label: 'Explorer', path: '/talent/explorer', description: 'Profils, compétences, organisations et opportunités visibles.', icon: Compass };
const ABOUT: TalentNavGroup = { id: 'a-propos', label: 'À propos', path: '/talent/a-propos', description: 'Comprendre la visibilité, les preuves et la protection des profils.', icon: Info };
const ORGANISATIONS: TalentNavGroup = { id: 'organisations', label: 'Organisations', path: '/talent/organisations', description: 'Organisations visibles et opportunités publiées.', icon: Building2 };

const NAV: Record<TalentAudience, TalentNavGroup[]> = {
  public: [HOME, EXPLORE, { id: 'recruteurs', label: 'Recruteurs', path: '/talent/recruteurs', description: 'Accès professionnel au sourcing et au recrutement.', icon: Briefcase }, ORGANISATIONS, ABOUT],
  apprenant: [
    HOME,
    {
      id: 'presence', label: 'Ma présence', path: '/talent/presence', description: 'Profil, compétences et preuves que vous choisissez de rendre visibles.', icon: UserRound,
      children: [
        { label: 'Mon profil', path: '/mon-profil', description: 'Informations publiques et confidentialité.', icon: UserRound },
        { label: 'Skills Passport', path: '/dashboard/skills-passport', description: 'Compétences, preuves et réalisations autorisées.', icon: BadgeCheck },
        { label: 'Portfolio projets', path: '/dashboard/project-portfolio', description: 'Expériences de projets que vous valorisez.', icon: FileText },
      ],
    },
    EXPLORE,
    {
      id: 'opportunites', label: 'Opportunités', path: '/talent/opportunites', description: 'Entreprises, offres et outils pour transformer votre visibilité en opportunité.', icon: Briefcase,
      children: [
        { label: 'Offres', path: '/talent/explorer?tab=offres', description: 'Parcourir les opportunités publiées.', icon: Briefcase },
        { label: 'Organisations', path: '/talent/explorer?tab=entreprises', description: 'Découvrir les organisations actives.', icon: Building2 },
        { label: 'Omnia Career', path: '/omnia-career', description: 'Préparer CV, lettres et candidatures.', icon: BadgeCheck },
      ],
    },
    {
      id: 'reseau', label: 'Réseau', path: '/talent/reseau', description: 'Échanges et expériences qui prolongent votre présence professionnelle.', icon: Network,
      children: [
        { label: 'Omnia Communauté', path: '/forum', description: 'Échanger avec la communauté Omnia.', icon: MessageCircle },
        { label: 'Omnia Live', path: '/omnia-live', description: 'Rencontrer des intervenants et participer aux événements.', icon: CalendarDays },
      ],
    },
  ],
  professeur: [
    HOME, EXPLORE,
    {
      id: 'reseau', label: 'Réseau', path: '/talent/reseau', description: 'Découvrir les profils, projets et échanges professionnels utiles à votre activité.', icon: Network,
      children: [
        { label: 'Omnia Projects', path: '/projects', description: 'Relier compétences et expériences concrètes.', icon: BadgeCheck },
        { label: 'Omnia Communauté', path: '/forum', description: 'Échanger avec la communauté.', icon: MessageCircle },
        { label: 'Omnia Live', path: '/omnia-live', description: 'Événements et expertise en direct.', icon: CalendarDays },
      ],
    },
    ABOUT,
  ],
  structure: [
    HOME,
    {
      id: 'talents', label: 'Talents', path: '/talent/structure/talents', description: 'Sourcing, compétences vérifiées et favoris de votre organisation.', icon: UsersRound,
      children: [
        { label: 'Rechercher des talents', path: '/structure/recrutement/talents', description: 'Explorer les profils publics.', icon: Compass },
        { label: 'Compétences vérifiées', path: '/structure/recrutement/competences-verifiees', description: 'Consulter les preuves autorisées.', icon: ShieldCheck },
        { label: 'Favoris', path: '/structure/recrutement/favoris', description: 'Retrouver les profils suivis.', icon: Heart },
      ],
    },
    {
      id: 'recrutement', label: 'Recrutement', path: '/talent/structure/recrutement', description: 'Offres, candidats, entretiens et conversations de la Structure.', icon: Briefcase,
      children: [
        { label: 'Offres', path: '/structure/recrutement/offres', description: 'Offres rattachées à la Structure.', icon: Briefcase },
        { label: 'Candidats', path: '/structure/recrutement/candidats', description: 'Candidatures reçues et suivi.', icon: FileText },
        { label: 'Entretiens', path: '/structure/recrutement/entretiens', description: 'Entretiens programmés.', icon: CalendarDays },
        { label: 'Messages', path: '/structure/recrutement/messages', description: 'Conversations avec les talents.', icon: MessageSquare },
      ],
    },
    {
      id: 'pilotage', label: 'Pilotage', path: '/talent/structure/pilotage', description: 'Mesurer l’activité et organiser l’équipe recrutement.', icon: BadgeCheck,
      children: [
        { label: 'Statistiques', path: '/structure/recrutement/statistiques', description: 'Activité et tendances de recrutement.', icon: BadgeCheck },
        { label: 'Équipe recrutement', path: '/structure/recrutement/equipe', description: 'Membres, délégations et permissions.', icon: UsersRound },
      ],
    },
    ORGANISATIONS,
  ],
  recruteur: [
    HOME,
    {
      id: 'talents', label: 'Talents', path: '/talent/recruteur/sourcing', description: 'Sourcing, profils vérifiés et favoris.', icon: UsersRound,
      children: [
        { label: 'Rechercher', path: '/talent/recruteur/talents', description: 'Rechercher dans les profils publics.', icon: Compass },
        { label: 'Compétences vérifiées', path: '/talent/recruteur/competences-verifiees', description: 'Examiner les preuves autorisées.', icon: ShieldCheck },
        { label: 'Favoris', path: '/talent/recruteur/favoris', description: 'Profils conservés pour votre sourcing.', icon: Heart },
      ],
    },
    {
      id: 'recrutement', label: 'Recrutement', path: '/talent/recruteur/recrutement', description: 'Piloter les opportunités et les échanges candidats.', icon: Briefcase,
      children: [
        { label: 'Mes offres', path: '/talent/recruteur/offres', description: 'Créer et suivre vos opportunités.', icon: Briefcase },
        { label: 'Candidatures', path: '/talent/recruteur/candidatures', description: 'Suivre le pipeline candidat.', icon: FileText },
        { label: 'Entretiens', path: '/talent/recruteur/entretiens', description: 'Rendez-vous programmés.', icon: CalendarDays },
        { label: 'Messages', path: '/talent/recruteur/messages', description: 'Conversations avec les talents.', icon: MessageSquare },
      ],
    },
    {
      id: 'compte', label: 'Plan & réglages', path: '/talent/recruteur/compte', description: 'Plan Omnia et préférences de recrutement.', icon: Settings,
      children: [
        { label: 'Plans & crédits', path: '/talent/recruteur/plans', description: 'Offres commerciales et quotas.', icon: CreditCard },
        { label: 'Paramètres', path: '/talent/recruteur/parametres', description: 'Préférences et notifications.', icon: Settings },
      ],
    },
    ORGANISATIONS,
  ],
  organisateur: [HOME, EXPLORE, { id: 'reseau', label: 'Réseau', path: '/talent/reseau', description: 'Repérer des expertises et prolonger les rencontres.', icon: Network, children: [{ label: 'Omnia Live', path: '/omnia-live', description: 'Événements et intervenants.', icon: CalendarDays }, { label: 'Communauté', path: '/forum', description: 'Échanges et réseau.', icon: MessageCircle }] }, ABOUT],
  coach: [HOME, EXPLORE, { id: 'reseau', label: 'Réseau', path: '/talent/reseau', description: 'Relier objectifs, compétences et expériences.', icon: Network, children: [{ label: 'Omnia Projects', path: '/projects', description: 'Expériences et preuves de compétences.', icon: BadgeCheck }, { label: 'Communauté', path: '/forum', description: 'Échanges professionnels.', icon: MessageCircle }] }, ABOUT],
  moderateur: [HOME, EXPLORE, ABOUT],
  super_admin: [HOME],
};

export function getTalentNavigation(audience: TalentAudience): TalentNavGroup[] { return NAV[audience] || NAV.public; }

export function resolveTalentAudience(roles: readonly string[] | null | undefined, requestedRole?: string | null): TalentAudience {
  const normalized = normalizePlatformRoles(roles);
  const requested = requestedRole as CanonicalPlatformRole | undefined;
  if (requested && normalized.includes('super_admin') && ['apprenant', 'professeur', 'structure', 'moderateur', 'recruteur', 'organisateur', 'coach'].includes(requested)) return requested as TalentAudience;
  if (normalized.includes('super_admin')) return 'super_admin';
  if (normalized.includes('structure')) return 'structure';
  const priority: TalentAudience[] = ['moderateur', 'organisateur', 'recruteur', 'professeur', 'coach', 'apprenant'];
  return priority.find(role => normalized.includes(role as CanonicalPlatformRole)) || (normalized.length ? 'apprenant' : 'public');
}

export function talentAudienceLabel(audience: TalentAudience) {
  return ({ public: 'Découvrir', apprenant: 'Apprenant', professeur: 'Professeur', structure: 'Structure', moderateur: 'Modérateur', recruteur: 'Recruteur', organisateur: 'Organisateur', coach: 'Coach', super_admin: 'Administration' } satisfies Record<TalentAudience, string>)[audience];
}

function pathOnly(path: string) { return path.split('#', 1)[0].split('?', 1)[0]; }

export function findTalentSection(audience: TalentAudience, pathname: string) {
  return getTalentNavigation(audience).find(group => {
    const gp = pathOnly(group.path);
    if (pathname === gp || pathname.startsWith(`${gp}/`)) return true;
    return Boolean(group.children?.some(child => { const cp = pathOnly(child.path); return pathname === cp || pathname.startsWith(`${cp}/`); }));
  });
}
