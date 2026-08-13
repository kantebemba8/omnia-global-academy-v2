import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  BadgeCheck,
  BarChart3,
  BookOpen,
  Briefcase,
  Building2,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  FileText,
  FolderKanban,
  GraduationCap,
  Heart,
  Landmark,
  LayoutDashboard,
  MessageCircle,
  Radio,
  Search,
  Settings,
  ShieldCheck,
  UserCheck,
  Users,
  Video,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import UserAccountMenu from '../components/UserAccountMenu';
import LearnerConnectedHomeSections, { type LearnerConnectedHomeData } from '../components/home/LearnerConnectedHomeSections';
import ProfessorConnectedHomeSections, { type ProfessorConnectedHomeData } from '../components/home/ProfessorConnectedHomeSections';
import StructureConnectedHomeSections, { type StructureConnectedHomeData } from '../components/home/StructureConnectedHomeSections';
import RecruiterConnectedHomeSections from '../components/home/RecruiterConnectedHomeSections';
import OrganizerConnectedHomeSections from '../components/home/OrganizerConnectedHomeSections';
import CoachConnectedHomeSections from '../components/home/CoachConnectedHomeSections';
import ModeratorConnectedHomeSections from '../components/home/ModeratorConnectedHomeSections';
import OmniaBrandLockup from '../components/OmniaBrandLockup';
import { PREVIEW_SESSION_KEY, PreviewReturnBar } from '../components/PreviewReturnButton';
import type { CourseCardData } from '../components/CourseCard';
import { useAuth } from '../hooks/useAuth';
import { ENDPOINTS } from '../lib/config';
import { edgeAuthHeaders } from '../lib/edgeAuth';
import { ADMIN_NAV_GROUPS } from '../lib/adminNavigation';
import { getActivePlatformRole, getDashboardPathForRoles, getSessionToken, normalizePlatformRoles, setActivePlatformRole, type CanonicalPlatformRole } from '../lib/session';
import { normalizeModeratorPermissions, type ModeratorPermissions } from '../lib/moderatorPermissions';

const BLUE = '#002050';
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

type HomeAudience =
  | 'super_admin'
  | 'moderateur'
  | 'structure'
  | 'gestionnaire_structure'
  | 'recruteur_structure'
  | 'organisateur'
  | 'recruteur'
  | 'professeur'
  | 'coach'
  | 'apprenant';

type LearnerDashboardData = LearnerConnectedHomeData;
type ProfessorDashboardData = ProfessorConnectedHomeData;
type StructureDashboardData = StructureConnectedHomeData;

type LandingData = { featured_courses?: CourseCardData[] };

type HomeLink = {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

type HomeGroup = {
  eyebrow: string;
  title: string;
  description: string;
  items: HomeLink[];
};

type HomeConfig = {
  label: string;
  eyebrow: string;
  title: string;
  intro: string;
  accent: string;
  soft: string;
  secondary: string;
  variant: 'control' | 'moderation' | 'organization' | 'pipeline' | 'live' | 'studio' | 'coaching' | 'learning';
  primary: HomeLink;
  secondaryAction: HomeLink;
  workflow: Array<{ label: string; description: string }>;
  groups: HomeGroup[];
  ecosystem: HomeLink[];
};

const LINK = (label: string, description: string, href: string, icon: LucideIcon): HomeLink => ({ label, description, href, icon });

const HOME_CONFIGS: Record<HomeAudience, HomeConfig> = {
  super_admin: {
    label: 'Super-admin',
    eyebrow: 'Pilotage de la plateforme',
    title: 'Gouverner Omnia dans son ensemble.',
    intro: 'Cette page rassemble les accès de pilotage, de contrôle et de gouvernance. Les contenus apprenants ne sont pas mélangés à votre vue Super-admin.',
    accent: '#BF8813', soft: '#FFF7E6', secondary: '#123B68', variant: 'control',
    primary: LINK('Ouvrir le tableau de bord', 'Indicateurs, actions requises et activité opérationnelle.', '/admin/dashboard', LayoutDashboard),
    secondaryAction: LINK('Prévisualiser un rôle', 'Voir l’accueil exact d’un rôle sans modifier vos propres permissions.', '/admin/dashboard#previsualiser-les-espaces', UserCheck),
    workflow: [
      { label: 'Observer', description: 'Suivre activité, ventes, utilisateurs et signaux opérationnels.' },
      { label: 'Contrôler', description: 'Traiter validations, qualité, accès, retraits et demandes.' },
      { label: 'Gouverner', description: 'Administrer contenus, monétisation, rôles, CMS et paramètres.' },
      { label: 'Développer', description: 'Piloter Career, Talent, Projects, Coaching, Live et les structures.' },
    ],
    groups: [],
    ecosystem: [],
  },
  moderateur: {
    label: 'Modérateur',
    eyebrow: 'Contrôle & confiance',
    title: 'Traiter ce qui demande votre intervention.',
    intro: 'Votre accueil met en priorité les contrôles, missions et espaces de modération auxquels vos permissions donnent réellement accès.',
    accent: '#C66A22', soft: '#FFF2E8', secondary: '#6F3D1F', variant: 'moderation',
    primary: LINK('Ouvrir la modération', 'Retrouver votre tableau de bord et vos missions.', '/moderator/dashboard', ShieldCheck),
    secondaryAction: LINK('Centre de missions', 'Accéder aux contrôles complémentaires qui vous sont attribués.', '/moderator/missions', ClipboardCheck),
    workflow: [
      { label: 'Recevoir', description: 'Identifier les contrôles et demandes qui vous sont attribués.' },
      { label: 'Vérifier', description: 'Examiner les éléments selon vos permissions.' },
      { label: 'Décider', description: 'Modérer, recommander ou transmettre selon votre périmètre.' },
      { label: 'Tracer', description: 'Conserver une activité lisible pour la gouvernance.' },
    ],
    groups: [
      { eyebrow: 'Contrôles', title: 'Vos zones de vérification', description: 'Ces accès restent soumis à vos permissions de modération.', items: [
        LINK('Formations', 'Contrôle pédagogique et demandes liées aux formations.', '/moderator/courses', BookOpen),
        LINK('Vérification d’identité', 'Contrôles KYC lorsque cette permission vous est attribuée.', '/moderator/kyc', ShieldCheck),
        LINK('Utilisateurs', 'Contrôles autorisés sur les comptes et listes.', '/moderator/users', Users),
        LINK('Missions', 'Missions complémentaires de contrôle et validation.', '/moderator/missions', ClipboardCheck),
      ]},
      { eyebrow: 'Modération', title: 'Communauté, emploi et support', description: 'Accès visibles uniquement dans la mesure où ils vous sont autorisés.', items: [
        LINK('Omnia Communauté', 'Modération des contenus et échanges.', '/moderator/forum', MessageCircle),
        LINK('Offres d’emploi', 'Contrôle des offres lorsque la permission est active.', '/moderator/jobs', Briefcase),
        LINK('Support', 'Traitement du support si cette mission vous est confiée.', '/moderator/support', UserCheck),
        LINK('Analytique', 'Vue analytique lorsque votre périmètre le permet.', '/moderator/analytics', BarChart3),
      ]},
    ],
    ecosystem: [],
  },
  structure: {
    label: 'Structure',
    eyebrow: 'Organisation & développement des compétences',
    title: 'Former, suivre et faire évoluer votre organisation.',
    intro: 'Votre accueil Structure réunit membres, équipe, formations, évaluation, projets, recrutement et opérations organisationnelles sans vous renvoyer vers des contenus apprenants génériques.',
    accent: '#087F79', soft: '#E8F7F5', secondary: '#0B4F54', variant: 'organization',
    primary: LINK('Ouvrir l’espace Structure', 'Pilotage de votre organisation et de ses activités.', '/structure/dashboard', Building2),
    secondaryAction: LINK('Gérer les membres', 'Membres, rattachements, équipe et codes Structure.', '/structure/membres', Users),
    workflow: [
      { label: 'Organiser', description: 'Structurer équipe, membres, rattachements et accès.' },
      { label: 'Former', description: 'Créer ou gérer les formations et évaluations de la Structure.' },
      { label: 'Suivre', description: 'Piloter compétences, projets et suivi RH.' },
      { label: 'Développer', description: 'Recruter, gérer le B2B et connecter l’organisation à Omnia.' },
    ],
    groups: [
      { eyebrow: 'Organisation', title: 'Membres, équipe et rattachements', description: 'Le socle administratif de votre espace.', items: [
        LINK('Membres', 'Gérer les membres rattachés à la Structure.', '/structure/membres', Users),
        LINK('Équipe', 'Administrer l’équipe de gestion de la Structure.', '/structure/equipe', UserCheck),
        LINK('Rattachements', 'Suivre les rattachements et demandes associées.', '/structure/rattachements', Building2),
        LINK('Codes Structure', 'Gérer les codes utilisés pour relier vos membres.', '/structure/codes', BadgeCheck),
      ]},
      { eyebrow: 'Formation', title: 'Concevoir et évaluer', description: 'Tous les outils de formation disponibles pour la Structure.', items: [
        LINK('Mes formations', 'Retrouver les formations de la Structure.', '/structure/formations', BookOpen),
        LINK('Créer une formation', 'Démarrer la création selon les parcours existants.', '/structure/courses/new', GraduationCap),
        LINK('Assessment Center', 'Gérer les évaluations et contrôles associés.', '/structure/assessment-center', ClipboardCheck),
        LINK('Jurys', 'Accéder aux jurys et décisions d’évaluation.', '/structure/jurys', Award),
      ]},
      { eyebrow: 'Talents', title: 'Recrutement & compétences', description: 'Relier les besoins de la Structure aux profils et opportunités.', items: [
        LINK('Recrutement', 'Vue de pilotage du recrutement Structure.', '/structure/recrutement/dashboard', Briefcase),
        LINK('Talents', 'Explorer les talents disponibles.', '/structure/recrutement/talents', Users),
        LINK('Compétences vérifiées', 'Consulter les preuves utiles au recrutement.', '/structure/recrutement/competences-verifiees', ShieldCheck),
        LINK('Candidats', 'Suivre les candidatures de la Structure.', '/structure/recrutement/candidats', UserCheck),
      ]},
      { eyebrow: 'Opérations', title: 'Suivi & développement', description: 'Les outils de pilotage organisationnel complémentaires.', items: [
        LINK('Suivi RH', 'Suivre les éléments RH disponibles dans votre espace.', '/structure/suivi-rh', BarChart3),
        LINK('Projets', 'Piloter les projets portés par la Structure.', '/structure/projects', FolderKanban),
        LINK('Abonnements', 'Consulter les offres et accès de la Structure.', '/structure/abonnements', CreditCard),
        LINK('Commerce B2B', 'Accéder aux fonctions B2B existantes.', '/structure/commerce-b2b', Landmark),
      ]},
    ],
    ecosystem: [
      LINK('Omnia Talent', 'Visibilité, talents et profils professionnels.', '/talent', Users),
      LINK('Omnia Live', 'Événements et expériences en direct.', '/omnia-live', Radio),
      LINK('Omnia Communauté', 'Échanges et ressources de la communauté.', '/forum', MessageCircle),
      LINK('Opportunités', 'Explorer l’espace public des offres d’emploi.', '/forum/emploi', Briefcase),
    ],
  },
  gestionnaire_structure: {
    label: 'Gestionnaire Structure',
    eyebrow: 'Gestion déléguée',
    title: 'Piloter le périmètre qui vous a été confié.',
    intro: 'Votre accueil reprend les fonctions Structure accessibles à travers votre délégation. Les permissions restent celles définies par votre organisation.',
    accent: '#087F79', soft: '#E8F7F5', secondary: '#0B4F54', variant: 'organization',
    primary: LINK('Ouvrir l’espace Structure', 'Accéder au tableau de bord selon vos permissions.', '/structure/dashboard', Building2),
    secondaryAction: LINK('Voir les membres', 'Accéder aux membres si votre délégation le permet.', '/structure/membres', Users),
    workflow: [
      { label: 'Accéder', description: 'Retrouver uniquement le périmètre délégué par la Structure.' },
      { label: 'Gérer', description: 'Administrer membres, formations ou opérations autorisées.' },
      { label: 'Suivre', description: 'Conserver une vue claire des activités confiées.' },
      { label: 'Coordonner', description: 'Travailler dans le même espace que l’organisation.' },
    ],
    groups: [
      { eyebrow: 'Délégation', title: 'Votre périmètre Structure', description: 'Les contrôles d’accès existants restent appliqués à chaque page.', items: [
        LINK('Membres', 'Gestion des membres si autorisée.', '/structure/membres', Users),
        LINK('Formations', 'Formations de la Structure si autorisées.', '/structure/formations', BookOpen),
        LINK('Projets', 'Projets de la Structure si autorisés.', '/structure/projects', FolderKanban),
        LINK('Organisation', 'Paramètres organisationnels selon délégation.', '/structure/organisation', Building2),
      ]},
      { eyebrow: 'Suivi', title: 'Opérations accessibles', description: 'Accès conditionnés par les permissions qui vous ont été attribuées.', items: [
        LINK('Suivi RH', 'Suivi organisationnel lorsque disponible.', '/structure/suivi-rh', BarChart3),
        LINK('Rattachements', 'Gestion des rattachements autorisés.', '/structure/rattachements', UserCheck),
        LINK('Codes Structure', 'Codes de rattachement lorsque accessibles.', '/structure/codes', BadgeCheck),
        LINK('Tableau de bord', 'Revenir à votre vue opérationnelle.', '/structure/dashboard', LayoutDashboard),
      ]},
    ],
    ecosystem: [
      LINK('Omnia Talent', 'Accéder à l’écosystème professionnel.', '/talent', Users),
      LINK('Omnia Live', 'Événements et expériences en direct.', '/omnia-live', Radio),
      LINK('Omnia Communauté', 'Échanges et ressources transversales.', '/forum', MessageCircle),
    ],
  },
  recruteur_structure: {
    label: 'Recruteur Structure',
    eyebrow: 'Recrutement délégué',
    title: 'Faire avancer le recrutement de votre Structure.',
    intro: 'Cette vue concentre uniquement le pipeline de recrutement qui vous est délégué : offres, talents, preuves, candidats, entretiens et échanges.',
    accent: '#315FA8', soft: '#EAF1FF', secondary: '#243E73', variant: 'pipeline',
    primary: LINK('Ouvrir le recrutement', 'Accéder au tableau de bord recrutement Structure.', '/structure/recrutement/dashboard', Briefcase),
    secondaryAction: LINK('Explorer les talents', 'Rechercher les profils utiles à votre organisation.', '/structure/recrutement/talents', Users),
    workflow: [
      { label: 'Publier', description: 'Gérer les offres de la Structure.' },
      { label: 'Sourcer', description: 'Explorer talents et compétences vérifiées.' },
      { label: 'Qualifier', description: 'Suivre candidats, favoris et preuves.' },
      { label: 'Échanger', description: 'Organiser entretiens et messages.' },
    ],
    groups: [
      { eyebrow: 'Sourcing', title: 'Trouver les bons profils', description: 'Vos outils de recherche et de sélection Structure.', items: [
        LINK('Offres d’emploi', 'Créer et gérer les offres de la Structure.', '/structure/offres-emploi', Briefcase),
        LINK('Talents', 'Explorer les talents disponibles.', '/structure/recrutement/talents', Users),
        LINK('Compétences vérifiées', 'Consulter les preuves de compétences.', '/structure/recrutement/competences-verifiees', ShieldCheck),
        LINK('Favoris', 'Retrouver les profils présélectionnés.', '/structure/recrutement/favoris', Heart),
      ]},
      { eyebrow: 'Pipeline', title: 'Candidats & échanges', description: 'Suivre le recrutement jusqu’aux échanges avec les candidats.', items: [
        LINK('Candidats', 'Suivre les candidatures reçues.', '/structure/recrutement/candidats', UserCheck),
        LINK('Entretiens', 'Organiser et suivre les entretiens.', '/structure/recrutement/entretiens', CalendarDays),
        LINK('Messages', 'Échanger avec les profils concernés.', '/structure/recrutement/messages', MessageCircle),
        LINK('Tableau de bord', 'Revenir à la synthèse du recrutement.', '/structure/recrutement/dashboard', LayoutDashboard),
      ]},
    ],
    ecosystem: [
      LINK('Omnia Talent', 'Accéder à l’écosystème Talent.', '/talent', Users),
      LINK('Omnia Live', 'Suivre les événements et rencontres.', '/omnia-live', Radio),
      LINK('Omnia Communauté', 'Participer aux échanges professionnels.', '/forum', MessageCircle),
      LINK('Opportunités', 'Explorer l’espace public emploi.', '/forum/emploi', Briefcase),
    ],
  },
  organisateur: {
    label: 'Organisateur',
    eyebrow: 'Omnia Live',
    title: 'Concevoir, diffuser et piloter vos événements.',
    intro: 'Votre accueil Organisateur rassemble le cycle complet Omnia Live : proposition, événements, participants, communications, accès privés, médias, statistiques et revenus.',
    accent: '#7A55B8', soft: '#F2EDFB', secondary: '#49316F', variant: 'live',
    primary: LINK('Ouvrir l’espace Organisateur', 'Retrouver votre activité Omnia Live.', '/omnia-live/organisateur', Radio),
    secondaryAction: LINK('Proposer un événement', 'Démarrer une nouvelle proposition Omnia Live.', '/omnia-live/proposer', Video),
    workflow: [
      { label: 'Proposer', description: 'Présenter un événement ou une expérience Live.' },
      { label: 'Préparer', description: 'Configurer participants, communications, accès et médias.' },
      { label: 'Animer', description: 'Piloter l’événement et ses interactions.' },
      { label: 'Mesurer', description: 'Consulter statistiques, offres et revenus.' },
    ],
    groups: [
      { eyebrow: 'Production', title: 'Préparer vos événements', description: 'Toutes les fonctions opérationnelles avant et pendant le Live.', items: [
        LINK('Mes événements', 'Retrouver et gérer vos événements.', '/omnia-live/organisateur/evenements', CalendarDays),
        LINK('Participants', 'Suivre les participants de vos événements.', '/omnia-live/organisateur/participants', Users),
        LINK('Communications', 'Préparer les communications organisateur.', '/omnia-live/organisateur/communications', MessageCircle),
        LINK('Accès privés', 'Gérer les accès privés disponibles.', '/omnia-live/organisateur/acces-prives', ShieldCheck),
      ]},
      { eyebrow: 'Pilotage', title: 'Médias, performance & commerce', description: 'Gérer ce qui prolonge et mesure vos événements.', items: [
        LINK('Médias', 'Gérer les médias liés à Omnia Live.', '/omnia-live/organisateur/medias', Video),
        LINK('Statistiques', 'Consulter les statistiques de vos événements.', '/omnia-live/organisateur/statistiques', BarChart3),
        LINK('Offres', 'Accéder aux offres organisateur existantes.', '/omnia-live/organisateur/offres', CreditCard),
        LINK('Revenus', 'Suivre les revenus de votre activité Live.', '/omnia-live/revenus', Wallet),
      ]},
    ],
    ecosystem: [
      LINK('Omnia Live', 'Voir l’espace public Omnia Live.', '/omnia-live', Radio),
      LINK('Omnia Communauté', 'Échanger avec la communauté Omnia.', '/forum', MessageCircle),
      LINK('Omnia Talent', 'Découvrir les profils et l’écosystème professionnel.', '/talent', Users),
    ],
  },
  recruteur: {
    label: 'Recruteur',
    eyebrow: 'Omnia Talent',
    title: 'Passer du besoin au bon profil.',
    intro: 'Votre accueil Recruteur est organisé autour du pipeline réel : offres, sourcing, compétences vérifiées, favoris, candidatures, entretiens et messages.',
    accent: '#9C436D', soft: '#FAEDF3', secondary: '#62304A', variant: 'pipeline',
    primary: LINK('Ouvrir l’espace Recruteur', 'Accéder à votre tableau de bord Talent.', '/talent/recruteur/dashboard', Briefcase),
    secondaryAction: LINK('Explorer les talents', 'Rechercher les profils disponibles sur Omnia Talent.', '/talent/recruteur/talents', Users),
    workflow: [
      { label: 'Définir', description: 'Publier et organiser vos besoins de recrutement.' },
      { label: 'Sourcer', description: 'Explorer les talents et leurs compétences vérifiées.' },
      { label: 'Qualifier', description: 'Gérer favoris et candidatures.' },
      { label: 'Échanger', description: 'Faire avancer entretiens et messages.' },
    ],
    groups: [
      { eyebrow: 'Sourcing', title: 'Talents & preuves', description: 'Identifier des profils sur des éléments professionnels exploitables.', items: [
        LINK('Talents', 'Explorer les profils disponibles.', '/talent/recruteur/talents', Users),
        LINK('Compétences vérifiées', 'Examiner les preuves de compétences.', '/talent/recruteur/competences-verifiees', ShieldCheck),
        LINK('Favoris', 'Retrouver les profils présélectionnés.', '/talent/recruteur/favoris', Heart),
        LINK('Offres', 'Créer et gérer vos offres.', '/talent/recruteur/offres', Briefcase),
      ]},
      { eyebrow: 'Suivi', title: 'Candidatures & échanges', description: 'Gérer le pipeline après l’identification des profils.', items: [
        LINK('Candidatures', 'Suivre les candidatures liées à vos offres.', '/talent/recruteur/candidatures', UserCheck),
        LINK('Entretiens', 'Planifier et suivre les entretiens.', '/talent/recruteur/entretiens', CalendarDays),
        LINK('Messages', 'Échanger avec les talents.', '/talent/recruteur/messages', MessageCircle),
        LINK('Plans', 'Consulter les offres et plans Recruteur.', '/talent/recruteur/plans', CreditCard),
      ]},
    ],
    ecosystem: [
      LINK('Omnia Talent', 'Voir l’écosystème professionnel.', '/talent', Users),
      LINK('Omnia Communauté', 'Échanger dans la communauté.', '/forum', MessageCircle),
      LINK('Omnia Live', 'Découvrir les événements professionnels.', '/omnia-live', Radio),
      LINK('Opportunités', 'Voir l’espace public emploi.', '/forum/emploi', Briefcase),
    ],
  },
  professeur: {
    label: 'Professeur',
    eyebrow: 'Enseignement & conception',
    title: 'Concevoir des formations qui vont jusqu’à la preuve.',
    intro: 'Votre accueil Professeur rassemble création, formations, évaluations, jurys, certificats, projets, analytique et revenus. Le catalogue apprenant n’est plus le centre de votre vue.',
    accent: '#3E63B8', soft: '#EDF2FF', secondary: '#293F75', variant: 'studio',
    primary: LINK('Ouvrir l’espace Professeur', 'Retrouver votre tableau de bord enseignant.', '/professeur/dashboard', GraduationCap),
    secondaryAction: LINK('Créer une formation', 'Démarrer le parcours de création existant.', '/professeur/courses/new', BookOpen),
    workflow: [
      { label: 'Concevoir', description: 'Structurer contenus, modules et expériences.' },
      { label: 'Évaluer', description: 'Construire évaluations et participer aux jurys.' },
      { label: 'Publier', description: 'Faire vivre vos formations dans le catalogue.' },
      { label: 'Mesurer', description: 'Suivre analytique, certificats, projets et revenus.' },
    ],
    groups: [
      { eyebrow: 'Studio', title: 'Formations & évaluation', description: 'Votre chaîne de conception et de validation pédagogique.', items: [
        LINK('Mes formations', 'Retrouver vos formations existantes.', '/professeur/courses', BookOpen),
        LINK('Créer une formation', 'Démarrer une nouvelle formation.', '/professeur/courses/new', GraduationCap),
        LINK('Assessment Center', 'Gérer les évaluations de vos formations.', '/professeur/assessment-center', ClipboardCheck),
        LINK('Jurys', 'Participer aux jurys et décisions.', '/professeur/jurys', Users),
      ]},
      { eyebrow: 'Impact', title: 'Suivi, preuves & activité', description: 'Mesurer et prolonger le travail pédagogique.', items: [
        LINK('Certificats', 'Retrouver les certificats liés à vos formations.', '/professeur/certificats', Award),
        LINK('Projets', 'Suivre les projets liés à votre activité.', '/professeur/projects', FolderKanban),
        LINK('Analytique', 'Consulter les données d’activité disponibles.', '/professeur/analytics', BarChart3),
        LINK('Revenus', 'Suivre votre portefeuille et vos reversements.', '/professeur/payouts', Wallet),
      ]},
    ],
    ecosystem: [
      LINK('Catalogue public', 'Voir les formations telles qu’elles sont présentées au public.', '/catalogue', BookOpen),
      LINK('Omnia Talent', 'Votre présence dans l’écosystème professionnel.', '/talent', Users),
      LINK('Omnia Communauté', 'Échanger avec la communauté.', '/forum', MessageCircle),
      LINK('Omnia Live', 'Participer aux expériences en direct.', '/omnia-live', Radio),
    ],
  },
  coach: {
    label: 'Coach',
    eyebrow: 'Accompagnement professionnel',
    title: 'Piloter votre activité de coaching de bout en bout.',
    intro: 'Votre accueil Coach réunit offres, calendrier, sessions, avis, produits, commerce et revenus sans vous faire passer par une page pensée pour l’apprenant.',
    accent: '#0F766E', soft: '#E9F8F5', secondary: '#0B4F54', variant: 'coaching',
    primary: LINK('Ouvrir l’espace Coach', 'Retrouver votre tableau de bord Coach.', '/coach/dashboard', Heart),
    secondaryAction: LINK('Gérer mes sessions', 'Accéder à vos sessions de coaching.', '/coach/sessions', CalendarDays),
    workflow: [
      { label: 'Proposer', description: 'Structurer vos offres et produits de coaching.' },
      { label: 'Planifier', description: 'Organiser disponibilité, calendrier et sessions.' },
      { label: 'Accompagner', description: 'Conduire les séances et leur suivi.' },
      { label: 'Développer', description: 'Suivre avis, commerce, plan Omnia et revenus.' },
    ],
    groups: [
      { eyebrow: 'Accompagnement', title: 'Offres, agenda & sessions', description: 'Le cœur de votre activité Coach.', items: [
        LINK('Mes offres', 'Gérer vos offres de coaching.', '/coach/offres', Heart),
        LINK('Calendrier', 'Organiser vos disponibilités.', '/coach/calendrier', CalendarDays),
        LINK('Sessions', 'Retrouver les séances à venir et passées.', '/coach/sessions', Video),
        LINK('Avis', 'Consulter les avis liés à votre activité.', '/coach/avis', MessageCircle),
      ]},
      { eyebrow: 'Activité', title: 'Produits, commerce & revenus', description: 'Les outils existants pour développer votre activité.', items: [
        LINK('Produits', 'Gérer vos produits et offres avancées.', '/coach/produits', FileText),
        LINK('Commerce', 'Accéder aux fonctions commerce Coach.', '/coach/commerce', CreditCard),
        LINK('Plan Omnia', 'Consulter les plans disponibles.', '/coach/plan-omnia', BadgeCheck),
        LINK('Revenus', 'Suivre les revenus de votre activité.', '/coach/revenus', Wallet),
      ]},
    ],
    ecosystem: [
      LINK('Omnia Coaching', 'Voir l’espace public Coaching.', '/coaching', Heart),
      LINK('Omnia Communauté', 'Échanger dans la communauté Omnia.', '/forum', MessageCircle),
      LINK('Omnia Live', 'Découvrir les événements Omnia.', '/omnia-live', Radio),
      LINK('Omnia Talent', 'Accéder à l’écosystème professionnel.', '/talent', Users),
    ],
  },
  apprenant: {
    label: 'Apprenant',
    eyebrow: 'Votre parcours Omnia',
    title: 'Votre parcours, au même endroit.',
    intro: 'Retrouvez votre progression, les actions utiles et des accès directs vers chaque écosystème. Les fonctions détaillées restent dans leur espace pour garder un accueil clair.',
    accent: '#0F7699', soft: '#E9F7FB', secondary: '#15546A', variant: 'learning',
    primary: LINK('Continuer mes formations', 'Retrouver vos cours et votre progression.', '/dashboard/mes-cours', BookOpen),
    secondaryAction: LINK('Voir mes preuves', 'Accéder à vos compétences, badges et preuves d’apprentissage.', '/dashboard/skills-passport', ShieldCheck),
    workflow: [
      { label: 'Apprendre', description: 'Suivre vos formations et modules.' },
      { label: 'Évaluer', description: 'Passer les évaluations et documenter vos acquis.' },
      { label: 'Prouver', description: 'Capitaliser certificats, badges, records et projets.' },
      { label: 'Avancer', description: 'Transformer vos acquis en carrière et opportunités.' },
    ],
    groups: [
      { eyebrow: 'Progression', title: 'Apprentissage & preuves', description: 'Tout ce qui documente votre progression réelle.', items: [
        LINK('Mes formations', 'Retrouver vos cours en cours et terminés.', '/dashboard/mes-cours', BookOpen),
        LINK('Évaluations', 'Passer et suivre vos évaluations.', '/dashboard/evaluations', ClipboardCheck),
        LINK('Certificats', 'Retrouver vos certificats délivrés.', '/dashboard/certificats', Award),
        LINK('Badges', 'Consulter vos badges et reconnaissances.', '/dashboard/badges', BadgeCheck),
      ]},
      { eyebrow: 'Dossier de compétences', title: 'Rendre vos acquis exploitables', description: 'Centraliser les preuves qui construisent votre profil.', items: [
        LINK('Learning Record', 'Consulter votre historique d’apprentissage.', '/dashboard/learning-record', FileText),
        LINK('Skills Passport', 'Regrouper vos compétences et preuves.', '/dashboard/skills-passport', ShieldCheck),
        LINK('Portfolio projets', 'Valoriser vos réalisations.', '/dashboard/project-portfolio', FolderKanban),
        LINK('Parcours professionnels', 'Suivre les parcours professionnels disponibles.', '/dashboard/professional-pathways', GraduationCap),
      ]},
      { eyebrow: 'Carrière', title: 'Passer de la compétence à l’opportunité', description: 'Les outils qui prolongent votre formation.', items: [
        LINK('Omnia Career', 'Créer et gérer vos documents de carrière.', '/omnia-career', Briefcase),
        LINK('Employabilité', 'Retrouver vos outils d’employabilité.', '/dashboard/employabilite', UserCheck),
        LINK('Omnia Projects', 'Participer et valoriser vos projets.', '/projects/mes-projets', FolderKanban),
        LINK('Omnia Talent', 'Développer votre visibilité professionnelle.', '/talent', Users),
      ]},
      { eyebrow: 'Écosystème', title: 'Communauté, Live & accompagnement', description: 'Compléter votre parcours avec les espaces transversaux.', items: [
        LINK('Omnia Coaching', 'Accéder à l’accompagnement disponible.', '/coaching', Heart),
        LINK('Omnia Communauté', 'Échanger et participer à la communauté.', '/forum', MessageCircle),
        LINK('Omnia Live', 'Participer aux événements en direct.', '/omnia-live', Radio),
        LINK('Abonnements', 'Consulter les offres liées à votre compte.', '/dashboard/abonnements', CreditCard),
      ]},
    ],
    ecosystem: [
      LINK('Opportunités emploi', 'Explorer les offres et opportunités publiées.', '/forum/emploi', Briefcase),
      LINK('Ma Structure', 'Retrouver votre rattachement Structure lorsqu’il existe.', '/dashboard/structure', Building2),
    ],
  },
};

const ROLE_PRIORITY: HomeAudience[] = [
  'super_admin',
  'moderateur',
  'structure',
  'gestionnaire_structure',
  'recruteur_structure',
  'organisateur',
  'recruteur',
  'professeur',
  'coach',
  'apprenant',
];

const PREVIEWABLE_ROLES = new Set<HomeAudience>(['apprenant', 'professeur', 'coach', 'organisateur', 'structure', 'moderateur', 'recruteur']);

function isHomeAudience(value: string | null): value is HomeAudience {
  return Boolean(value && ROLE_PRIORITY.includes(value as HomeAudience));
}

function coursePath(course: CourseCardData) {
  return course.content_origin === 'external' ? `/formation-externe/${course.id}` : `/cours/${course.id}`;
}

function addPreview(path: string, previewMode: boolean) {
  if (!previewMode || !path.startsWith('/') || path.startsWith('/admin/')) return path;
  const [base, hash = ''] = path.split('#', 2);
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}preview=true${hash ? `#${hash}` : ''}`;
}

function readModeratorPermissions(): ModeratorPermissions | null {
  try {
    const raw = localStorage.getItem('mod_perms');
    return raw ? normalizeModeratorPermissions(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function filterModeratorGroups(groups: HomeGroup[], permissions: ModeratorPermissions | null, previewMode: boolean) {
  if (previewMode) return groups;
  if (!permissions) return [];
  const allowed = new Set<string>(['/moderator/dashboard']);
  const p = permissions;
  if (
    p.can_see_pending_courses || p.can_review_course_content || p.can_request_course_modification ||
    p.can_reject_course || p.can_recommend_course_price || p.can_approve_transmit_course
  ) allowed.add('/moderator/courses');
  if (p.can_validate_professor_kyc) allowed.add('/moderator/kyc');
  if (p.can_see_learners_list || p.can_see_professors_list || p.can_request_account_suspension) allowed.add('/moderator/users');
  if (
    p.can_manage_course_certifications || p.can_create_assisted_course || p.can_see_structures_list ||
    p.can_see_organizers_list || p.can_validate_structure_kyc || p.can_view_ai_conversations ||
    p.can_manage_reports || p.can_review_live_events || p.can_review_live_reports || p.can_review_live_refunds ||
    p.can_review_live_organizers || p.can_review_structure_requests || p.can_review_structure_codes
  ) allowed.add('/moderator/missions');
  if (p.can_moderate_forum) allowed.add('/moderator/forum');
  if (p.can_moderate_jobs) allowed.add('/moderator/jobs');
  if (p.can_manage_support) allowed.add('/moderator/support');
  if (p.can_view_analytics) allowed.add('/moderator/analytics');

  return groups
    .map(group => ({ ...group, items: group.items.filter(item => allowed.has(item.href)) }))
    .filter(group => group.items.length > 0);
}

function searchPlaceholderFor(audience: HomeAudience) {
  switch (audience) {
    case 'super_admin': return 'Rechercher un outil, un domaine ou une fonction de gouvernance…';
    case 'moderateur': return 'Rechercher dans vos outils de modération…';
    case 'structure': return 'Rechercher membres, formations, recrutement, suivi…';
    case 'gestionnaire_structure': return 'Rechercher dans votre périmètre Structure…';
    case 'recruteur_structure': return 'Rechercher offres, talents, candidats, entretiens…';
    case 'organisateur': return 'Rechercher événements, participants, médias, revenus…';
    case 'recruteur': return 'Rechercher offres, talents, candidatures, entretiens…';
    case 'professeur': return 'Rechercher formations, évaluations, apprenants, revenus…';
    case 'coach': return 'Rechercher séances, disponibilités, demandes, revenus…';
    case 'apprenant': return 'Rechercher formations, Career, Talent, certificats, opportunités…';
  }
}

function HeroDecoration({ variant, accent }: { variant: HomeConfig['variant']; accent: string }) {
  const dense = variant === 'control' || variant === 'pipeline';
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute -right-20 -top-36 h-[420px] w-[420px] rounded-full border border-white/20" />
      <div className="absolute -right-8 -top-24 h-[320px] w-[320px] rounded-full border border-white/20" />
      <div className="absolute bottom-[-180px] right-[16%] h-[360px] w-[360px] rounded-full" style={{ background: `radial-gradient(circle, ${accent}88 0%, ${accent}22 42%, transparent 70%)` }} />
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: dense ? 'linear-gradient(rgba(255,255,255,.26) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.18) 1px, transparent 1px)' : 'radial-gradient(circle at 1px 1px, rgba(255,255,255,.55) 1px, transparent 0)', backgroundSize: dense ? '36px 36px' : '28px 28px' }} />
      <div className="absolute left-[42%] top-[25%] h-px w-[52%] rotate-[-8deg] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
      <div className="absolute left-[52%] top-[46%] h-px w-[45%] rotate-[10deg] bg-gradient-to-r from-transparent via-white/30 to-transparent" />
    </div>
  );
}

function ActionLink({ item, accent, previewMode, inverse = false }: { item: HomeLink; accent: string; previewMode: boolean; inverse?: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      to={addPreview(item.href, previewMode)}
      className={`group flex items-start gap-3 py-4 ${inverse ? 'text-white' : 'text-[#002050]'}`}
    >
      <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${inverse ? 'bg-white/10' : 'bg-slate-50'}`} style={{ color: inverse ? '#FFFFFF' : accent }}>
        <Icon size={19} />
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block text-sm font-extrabold">{item.label}</strong>
        <span className={`mt-1 block text-xs leading-5 ${inverse ? 'text-white/60' : 'text-slate-500'}`}>{item.description}</span>
      </span>
      <ArrowRight size={16} className={`mt-1.5 shrink-0 transition group-hover:translate-x-1 ${inverse ? 'text-white/60' : 'text-slate-400'}`} />
    </Link>
  );
}

export default function ConnectedHome() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [learnerData, setLearnerData] = useState<LearnerDashboardData | null>(null);
  const [professorData, setProfessorData] = useState<ProfessorDashboardData | null>(null);
  const [structureData, setStructureData] = useState<StructureDashboardData | null>(null);
  const [moderatorPermissionsLive, setModeratorPermissionsLive] = useState<ModeratorPermissions | null>(null);
  const [featuredCourses, setFeaturedCourses] = useState<CourseCardData[]>([]);

  const roles = useMemo(() => normalizePlatformRoles(user?.roles || []), [user?.roles]);
  const isSuperAdmin = roles.includes('super_admin');
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const requestedRole = isHomeAudience(params.get('role')) ? params.get('role') as HomeAudience : null;
  const requestedPreviewRole = params.get('preview') === 'true' ? requestedRole : null;
  const previewMode = Boolean(isSuperAdmin && requestedPreviewRole && PREVIEWABLE_ROLES.has(requestedPreviewRole));
  const requestedOwnedRole = !previewMode && requestedRole && roles.includes(requestedRole as CanonicalPlatformRole) ? requestedRole : null;
  const preferredOwnedRole = !previewMode ? getActivePlatformRole(user?.roles || []) : null;

  const audience = useMemo<HomeAudience>(() => {
    if (previewMode && requestedPreviewRole) return requestedPreviewRole;
    if (requestedOwnedRole) return requestedOwnedRole;
    if (preferredOwnedRole && isHomeAudience(preferredOwnedRole)) return preferredOwnedRole;
    return ROLE_PRIORITY.find(role => roles.includes(role as CanonicalPlatformRole)) || 'apprenant';
  }, [previewMode, requestedPreviewRole, requestedOwnedRole, preferredOwnedRole, roles]);

  useEffect(() => {
    if (previewMode || !user || !roles.includes(audience as CanonicalPlatformRole)) return;
    setActivePlatformRole(audience as CanonicalPlatformRole);
  }, [audience, previewMode, roles, user]);

  const config = HOME_CONFIGS[audience];
  const dashboardPath = user ? getDashboardPathForRoles(user.roles || []) : '/accueil';
  const moderatorPermissions = useMemo(() => audience === 'moderateur' ? (moderatorPermissionsLive || readModeratorPermissions()) : null, [audience, moderatorPermissionsLive]);
  const continueCourses = learnerData?.courses_en_cours || [];
  const groups = useMemo(
    () => audience === 'moderateur' ? filterModeratorGroups(config.groups, moderatorPermissions, previewMode) : config.groups,
    [audience, config.groups, moderatorPermissions, previewMode],
  );

  const searchEntries = useMemo(() => {
    const entries: HomeLink[] = [];
    const pushUnique = (item: HomeLink) => {
      if (!entries.some(entry => entry.href === item.href)) entries.push(item);
    };

    pushUnique(config.primary);
    pushUnique(config.secondaryAction);

    if (audience === 'super_admin') {
      ADMIN_NAV_GROUPS.forEach(group => group.items.forEach(item => pushUnique(LINK(item.label, `Accès ${group.label.toLowerCase()} de la plateforme.`, item.path, item.icon))));
    } else {
      groups.forEach(group => group.items.forEach(pushUnique));
      config.ecosystem.forEach(pushUnique);
    }

    if (audience === 'apprenant') {
      continueCourses.forEach(course => pushUnique(LINK(course.title, `${course.progress_percent}% de progression · ${course.lessons_completed}/${course.lessons_total} leçons terminées.`, `/cours/${course.slug}/apprendre`, BookOpen)));
      featuredCourses.forEach(course => pushUnique(LINK(course.title, course.short_description || 'Formation mise en avant dans le catalogue Omnia.', coursePath(course), BookOpen)));
    }

    if (audience === 'professeur') {
      (professorData?.formations || []).forEach(course => pushUnique(LINK(course.title, `Formation Professeur · ${course.total_students || 0} apprenant(s).`, '/professeur/courses', BookOpen)));
    }

    if (audience === 'structure') {
      (structureData?.pending_members || []).forEach(member => {
        const name = member.users?.full_name?.trim();
        if (name) pushUnique(LINK(name, 'Demande de rattachement Structure en attente.', '/structure/rattachements', Users));
      });
    }

    return entries;
  }, [audience, config, groups, continueCourses, featuredCourses, professorData, structureData]);

  const searchResults = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('fr');
    if (!normalizedQuery) return [];
    return searchEntries
      .filter(item => `${item.label} ${item.description}`.toLocaleLowerCase('fr').includes(normalizedQuery))
      .slice(0, 8);
  }, [query, searchEntries]);

  useEffect(() => {
    if (!isSuperAdmin) {
      sessionStorage.removeItem(PREVIEW_SESSION_KEY);
      return;
    }
    if (previewMode && requestedPreviewRole) sessionStorage.setItem(PREVIEW_SESSION_KEY, requestedPreviewRole);
  }, [isSuperAdmin, previewMode, requestedPreviewRole]);

  useEffect(() => {
    if (audience !== 'apprenant') {
      setFeaturedCourses([]);
      return;
    }
    let active = true;
    fetch(ENDPOINTS.landingData, { headers: ANON_KEY ? { Authorization: `Bearer ${ANON_KEY}` } : undefined })
      .then(response => response.ok ? response.json() as Promise<LandingData> : Promise.reject())
      .then(data => { if (active) setFeaturedCourses(Array.isArray(data.featured_courses) ? data.featured_courses.slice(0, 3) : []); })
      .catch(() => { if (active) setFeaturedCourses([]); });
    return () => { active = false; };
  }, [audience]);

  useEffect(() => {
    if (audience !== 'apprenant' || previewMode || !roles.includes('apprenant')) {
      setLearnerData(null);
      return;
    }
    let active = true;
    fetch(ENDPOINTS.dashboardApprenant, { headers: edgeAuthHeaders() })
      .then(response => response.ok ? response.json() as Promise<LearnerDashboardData> : Promise.reject())
      .then(data => { if (active) setLearnerData(data); })
      .catch(() => { if (active) setLearnerData(null); });
    return () => { active = false; };
  }, [audience, previewMode, roles]);

  useEffect(() => {
    if (audience !== 'professeur' || previewMode || !roles.includes('professeur')) {
      setProfessorData(null);
      return;
    }
    let active = true;
    fetch(ENDPOINTS.dashboardProfesseur, { headers: edgeAuthHeaders() })
      .then(response => response.ok ? response.json() as Promise<ProfessorDashboardData> : Promise.reject())
      .then(data => { if (active) setProfessorData(data); })
      .catch(() => { if (active) setProfessorData(null); });
    return () => { active = false; };
  }, [audience, previewMode, roles]);

  useEffect(() => {
    if (audience !== 'structure' || previewMode || !roles.includes('structure')) {
      setStructureData(null);
      return;
    }
    const sessionToken = getSessionToken() || '';
    if (!sessionToken) {
      setStructureData(null);
      return;
    }
    let active = true;
    const api = `${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/studio-unified`;
    fetch(api, {
      method: 'POST',
      headers: edgeAuthHeaders(),
      body: JSON.stringify({ action: 'structure_dashboard', session_token: sessionToken }),
    })
      .then(async response => {
        const payload = await response.json().catch(() => null) as StructureDashboardData & { success?: boolean } | null;
        if (!response.ok || !payload || payload.success === false) return Promise.reject();
        return payload;
      })
      .then(data => { if (active) setStructureData(data); })
      .catch(() => { if (active) setStructureData(null); });
    return () => { active = false; };
  }, [audience, previewMode, roles]);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    if (searchResults[0]) {
      navigate(addPreview(searchResults[0].href, previewMode));
      return;
    }
    if (audience === 'apprenant' && query.trim()) {
      navigate(`/catalogue?q=${encodeURIComponent(query.trim())}`);
    }
  }

  if (loading) {
    return <div className="grid min-h-screen place-items-center bg-white"><div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#002050]" /></div>;
  }
  if (!user) return <Navigate to="/connexion?redirect=%2Fhome" replace />;
  if (roles.length === 0) return <Navigate to="/inscription?mode=add-role" replace />;
  if (audience === 'super_admin') return <Navigate to="/admin/dashboard" replace />;

  const otherRoleHomes = roles
    .filter(role => role !== audience && role in HOME_CONFIGS)
    .map(role => ({ role: role as HomeAudience, home: HOME_CONFIGS[role as HomeAudience] }));

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <header className="sticky top-0 z-40 border-b border-[#DCE5F0] bg-white/95 backdrop-blur-xl">
        <div className={`mx-auto flex min-h-[76px] max-w-7xl items-center gap-4 px-5 sm:px-6 lg:px-8 ${audience === 'apprenant' || audience === 'professeur' || audience === 'structure' || audience === 'recruteur' || audience === 'organisateur' || audience === 'coach' || audience === 'moderateur' ? 'flex-wrap py-2 lg:flex-nowrap' : 'justify-between'}`}>
          <OmniaBrandLockup href="/home" showSlogan={false} className="flex-none" />

          {(audience === 'apprenant' || audience === 'professeur' || audience === 'structure' || audience === 'recruteur' || audience === 'organisateur' || audience === 'coach' || audience === 'moderateur') && (
            <form onSubmit={submitSearch} className="relative order-3 w-full min-w-0 flex-1 lg:order-none lg:mx-auto lg:max-w-[650px]">
              <div className="flex min-h-[44px] items-center overflow-hidden rounded-xl border border-[#D4DFEA] bg-[#F8FAFD] focus-within:border-[#9EB4D0] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#0F7699]/10">
                <Search size={17} className="ml-4 shrink-0 text-slate-400" />
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder={searchPlaceholderFor(audience)}
                  aria-label={`Rechercher dans l’accueil ${config.label}`}
                  className="min-h-[42px] min-w-0 flex-1 bg-transparent px-3 text-sm font-medium text-[#002050] outline-none placeholder:font-normal placeholder:text-slate-400"
                />
                <button type="submit" className="mr-1.5 hidden min-h-[34px] rounded-lg bg-[#002050] px-3 text-xs font-black text-white sm:block">Rechercher</button>
              </div>

              {query.trim() && (
                <div className="absolute left-0 right-0 top-[52px] z-50 overflow-hidden rounded-2xl border border-[#D8E2EE] bg-white shadow-[0_24px_60px_rgba(0,32,80,0.16)]">
                  {searchResults.length > 0 ? (
                    <div className="divide-y divide-slate-100">
                      {searchResults.map(item => {
                        const ResultIcon = item.icon;
                        return (
                          <Link key={item.href} to={addPreview(item.href, previewMode)} onClick={() => setQuery('')} className="group flex items-center gap-3 px-4 py-3 hover:bg-slate-50 sm:px-5">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: config.soft, color: config.accent }}><ResultIcon size={17} /></span>
                            <span className="min-w-0 flex-1"><strong className="block truncate text-sm font-extrabold text-[#002050]">{item.label}</strong><span className="mt-0.5 block truncate text-xs text-slate-500">{item.description}</span></span>
                            <ArrowRight size={15} className="shrink-0 text-slate-300 transition group-hover:translate-x-1" />
                          </Link>
                        );
                      })}
                    </div>
                  ) : audience === 'apprenant' ? (
                    <Link to={`/catalogue?q=${encodeURIComponent(query.trim())}`} onClick={() => setQuery('')} className="flex items-center justify-between gap-4 px-5 py-4 text-sm font-bold text-[#002050] hover:bg-slate-50">
                      <span>Rechercher « {query.trim()} » dans le catalogue de formations</span><ArrowRight size={16} />
                    </Link>
                  ) : (
                    <p className="px-5 py-4 text-sm text-slate-500">Aucun accès de votre espace ne correspond à cette recherche.</p>
                  )}
                </div>
              )}
            </form>
          )}

          <UserAccountMenu dashboardPath={dashboardPath} />
        </div>
      </header>

      {previewMode && <PreviewReturnBar label={config.label} />}

      <main>
        {audience !== 'apprenant' && audience !== 'professeur' && audience !== 'structure' && audience !== 'recruteur' && audience !== 'organisateur' && audience !== 'coach' && audience !== 'moderateur' && (
        <section className="border-b border-[#DCE5F0] bg-white">
          <div className="mx-auto max-w-7xl px-5 py-5 sm:px-6 lg:px-8">
            <form onSubmit={submitSearch} className="relative mx-auto max-w-4xl">
              <div className="flex min-h-[54px] items-center overflow-hidden rounded-2xl border border-[#CFDAE8] bg-[#F8FBFF] shadow-[0_10px_30px_rgba(0,32,80,0.06)] focus-within:border-[#9EB4D0] focus-within:bg-white">
                <Search size={18} className="ml-5 shrink-0" style={{ color: config.accent }} />
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder={searchPlaceholderFor(audience)}
                  aria-label={`Rechercher dans l’accueil ${config.label}`}
                  className="min-h-[52px] min-w-0 flex-1 bg-transparent px-4 text-sm font-medium text-[#002050] outline-none placeholder:font-normal placeholder:text-slate-400"
                />
                <button type="submit" className="mr-1.5 min-h-[42px] rounded-xl px-5 text-xs font-black text-white" style={{ backgroundColor: BLUE }}>Rechercher</button>
              </div>

              {query.trim() && (
                <div className="absolute left-0 right-0 top-[62px] z-30 overflow-hidden rounded-2xl border border-[#D8E2EE] bg-white shadow-[0_24px_60px_rgba(0,32,80,0.16)]">
                  {searchResults.length > 0 ? (
                    <div className="divide-y divide-slate-100">
                      {searchResults.map(item => {
                        const ResultIcon = item.icon;
                        return (
                          <Link key={item.href} to={addPreview(item.href, previewMode)} onClick={() => setQuery('')} className="group flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 sm:px-5">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: config.soft, color: config.accent }}><ResultIcon size={17} /></span>
                            <span className="min-w-0 flex-1"><strong className="block truncate text-sm font-extrabold text-[#002050]">{item.label}</strong><span className="mt-0.5 block truncate text-xs text-slate-500">{item.description}</span></span>
                            <ArrowRight size={15} className="shrink-0 text-slate-300 transition group-hover:translate-x-1" />
                          </Link>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="px-5 py-4 text-sm text-slate-500">Aucun accès de votre espace ne correspond à cette recherche.</p>
                  )}
                </div>
              )}
            </form>
          </div>
        </section>
        )}

        {audience !== 'apprenant' && audience !== 'professeur' && audience !== 'structure' && audience !== 'recruteur' && audience !== 'organisateur' && audience !== 'coach' && audience !== 'moderateur' && (
        <section className="relative overflow-hidden bg-[#002050] text-white">
          <HeroDecoration variant={config.variant} accent={config.accent} />
          <div className="relative mx-auto grid min-h-[430px] max-w-7xl gap-10 px-5 py-14 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:px-8 lg:py-16">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.18em] text-white/60">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: config.accent }} />
                {config.eyebrow}
              </div>
              <h1 className="mt-5 text-4xl font-black leading-[1.02] tracking-[-0.045em] sm:text-5xl lg:text-[3.55rem]">{config.title}</h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">{config.intro}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to={addPreview(config.primary.href, previewMode)} className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-black text-[#002050] transition hover:-translate-y-0.5" style={{ backgroundColor: config.accent }}>
                  {config.primary.label} <ArrowRight size={16} />
                </Link>
                <Link to={addPreview(config.secondaryAction.href, previewMode)} className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/20">
                  {config.secondaryAction.label} <ArrowRight size={16} />
                </Link>
              </div>
            </div>

            <div className="border-l border-white/20 pl-6 sm:pl-8">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-white/50">Votre logique de travail</p>
              <div className="mt-5 divide-y divide-white/10">
                {config.workflow.map((step, index) => (
                  <div key={step.label} className="grid grid-cols-[42px_1fr] gap-3 py-4 first:pt-0">
                    <span className="text-lg font-black" style={{ color: config.accent }}>0{index + 1}</span>
                    <div><strong className="text-sm font-extrabold text-white">{step.label}</strong><p className="mt-1 text-xs leading-5 text-white/50">{step.description}</p></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
        )}

        {audience === 'professeur' && (
          <ProfessorConnectedHomeSections data={professorData} previewMode={previewMode} />
        )}

        {audience === 'structure' && (
          <StructureConnectedHomeSections data={structureData} previewMode={previewMode} />
        )}

        {audience === 'recruteur' && (
          <RecruiterConnectedHomeSections previewMode={previewMode} />
        )}

        {audience === 'organisateur' && (
          <OrganizerConnectedHomeSections previewMode={previewMode} />
        )}

        {audience === 'coach' && (
          <CoachConnectedHomeSections previewMode={previewMode} />
        )}

        {audience === 'moderateur' && (
          <ModeratorConnectedHomeSections previewMode={previewMode} onPermissionsLoaded={setModeratorPermissionsLive} />
        )}

        {audience === 'apprenant' && (
          <LearnerConnectedHomeSections data={learnerData} previewMode={previewMode} />
        )}

        {audience === 'super_admin' ? (
          <section className="bg-white">
            <div className="mx-auto max-w-7xl px-5 py-14 sm:px-6 lg:px-8">
              <div className="grid gap-8 lg:grid-cols-[0.55fr_1.45fr]">
                <div className="lg:sticky lg:top-28 lg:self-start">
                  <p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: config.accent }}>Toute la plateforme</p>
                  <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-[#002050]">Vos domaines de gouvernance</h2>
                  <p className="mt-4 max-w-sm text-sm leading-7 text-slate-600">Les groupes ci-contre proviennent de la navigation Super-admin existante : aucune fonction supplémentaire n’est inventée.</p>
                </div>
                <div className="border-t border-slate-200">
                  {ADMIN_NAV_GROUPS.filter(group => group.id !== 'dashboard').map(group => {
                    const GroupIcon = group.icon;
                    return (
                      <div key={group.id} className="grid gap-4 border-b border-slate-200 py-7 md:grid-cols-[230px_1fr]">
                        <div className="flex items-start gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: config.soft, color: config.accent }}><GroupIcon size={18} /></span>
                          <div><h3 className="text-sm font-black text-[#002050]">{group.label}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{group.items.length} accès existants</p></div>
                        </div>
                        <div className="grid gap-x-8 sm:grid-cols-2">
                          {group.items.map(item => {
                            const ItemIcon = item.icon;
                            return <Link key={item.path} to={item.path} className="group flex items-center gap-3 border-b border-slate-100 py-3 text-sm font-semibold text-slate-700 last:border-0 hover:text-[#002050]"><ItemIcon size={16} style={{ color: config.accent }} /><span className="flex-1">{item.label}</span><ArrowRight size={14} className="text-slate-300 transition group-hover:translate-x-1" /></Link>;
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        ) : audience !== 'apprenant' && audience !== 'professeur' && audience !== 'structure' && audience !== 'recruteur' && audience !== 'organisateur' && audience !== 'coach' && audience !== 'moderateur' ? (
          <section className="bg-white">
            <div className="mx-auto max-w-7xl px-5 py-14 sm:px-6 lg:px-8">
              <div className="mb-10 max-w-3xl">
                <p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: config.accent }}>Votre espace complet</p>
                <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-[#002050]">Tout ce qui est utile à votre rôle, sans doublons.</h2>
                <p className="mt-4 text-sm leading-7 text-slate-600">Chaque ligne mène vers une fonction déjà présente dans Omnia. L’accueil sert de vue d’ensemble ; les espaces spécialisés conservent leur profondeur.</p>
              </div>

              <div className="divide-y divide-slate-200 border-y border-slate-200">
                {groups.map((group, groupIndex) => (
                  <section
                    key={`${group.eyebrow}-${group.title}`}
                    className={`grid gap-8 py-10 ${groupIndex % 2 === 0 ? 'lg:grid-cols-[0.68fr_1.32fr]' : 'lg:grid-cols-[1.32fr_0.68fr]'}`}
                    style={groupIndex % 2 === 1 ? { background: `linear-gradient(90deg, ${config.soft} 0%, transparent 78%)` } : undefined}
                  >
                    <div className={groupIndex % 2 === 0 ? '' : 'lg:order-2'}>
                      <p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: config.accent }}>{group.eyebrow}</p>
                      <h3 className="mt-2 text-2xl font-black tracking-[-0.025em] text-[#002050]">{group.title}</h3>
                      <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">{group.description}</p>
                    </div>
                    <div className={`${groupIndex % 2 === 0 ? '' : 'lg:order-1'} divide-y divide-slate-200 border-t border-slate-200`}>
                      {group.items.map(item => <ActionLink key={item.href} item={item} accent={config.accent} previewMode={previewMode} />)}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {audience === 'apprenant' && featuredCourses.length > 0 && (
          <section className="border-t border-slate-200" style={{ backgroundColor: config.soft }}>
            <div className="mx-auto max-w-7xl px-5 py-12 sm:px-6 lg:px-8">
              <div className="grid gap-8 lg:grid-cols-[0.7fr_1.3fr]">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: config.accent }}>À découvrir</p>
                  <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#002050]">Formations mises en avant</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600">Cette sélection publique reste réservée à l’accueil Apprenant.</p>
                  <Link to="/catalogue" className="mt-5 inline-flex items-center gap-2 text-sm font-black text-[#002050] hover:underline">Voir le catalogue <ArrowRight size={15} /></Link>
                </div>
                <div className="divide-y divide-slate-300/70 border-y border-slate-300/70">
                  {featuredCourses.map(course => (
                    <Link key={course.id} to={coursePath(course)} className="group flex items-center gap-4 py-5">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white" style={{ color: config.accent }}><BookOpen size={19} /></span>
                      <span className="min-w-0 flex-1"><strong className="block truncate text-sm font-extrabold text-[#002050] group-hover:underline">{course.title}</strong>{course.short_description && <span className="mt-1 block line-clamp-1 text-xs text-slate-500">{course.short_description}</span>}</span>
                      <ArrowRight size={16} className="text-slate-400 transition group-hover:translate-x-1" />
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {audience !== 'apprenant' && audience !== 'professeur' && audience !== 'structure' && audience !== 'recruteur' && audience !== 'organisateur' && audience !== 'coach' && audience !== 'moderateur' && config.ecosystem.length > 0 && (
          <section className="relative overflow-hidden bg-[#061C36] text-white">
            <div className="absolute inset-y-0 right-0 w-1/2 opacity-30" style={{ background: `radial-gradient(circle at 80% 50%, ${config.accent}, transparent 62%)` }} aria-hidden="true" />
          <div className="relative mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-6 lg:grid-cols-[0.55fr_1.45fr] lg:px-8">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: config.accent }}>Écosystème lié à votre rôle</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.035em]">Continuer dans Omnia</h2>
              <p className="mt-4 max-w-sm text-sm leading-7 text-white/60">Une sélection courte des espaces transversaux réellement utiles à votre activité.</p>
            </div>
            <div className="grid gap-x-8 border-t border-white/20 sm:grid-cols-2">
              {config.ecosystem.map(item => <div key={item.href} className="border-b border-white/10"><ActionLink item={item} accent={config.accent} previewMode={previewMode} inverse /></div>)}
            </div>
          </div>
          </section>
        )}

        {!previewMode && otherRoleHomes.length > 0 && (
          <section className="border-t border-slate-200 bg-white">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-5 text-sm sm:px-6 lg:px-8">
              <span className="font-black text-[#002050]">Autres accès associés à votre compte :</span>
              {otherRoleHomes.map(({ role, home }) => <Link key={role} to={`/home?role=${encodeURIComponent(role)}`} className="font-semibold text-slate-600 hover:text-[#002050] hover:underline">Accueil {home.label}</Link>)}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
