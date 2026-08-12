import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  Clapperboard,
  Compass,
  CreditCard,
  FileBadge,
  Film,
  Gauge,
  Info,
  KeyRound,
  Library,
  MessageSquare,
  Radio,
  ReceiptText,
  RotateCcw,
  Settings2,
  Sparkles,
  Ticket,
  UsersRound,
  Video,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { normalizePlatformRoles, type CanonicalPlatformRole } from './session';

export type LiveAudience = 'public' | 'apprenant' | 'professeur' | 'structure' | 'moderateur' | 'recruteur' | 'organisateur' | 'coach' | 'super_admin';
export type LiveNavChild = { label: string; path: string; description: string; icon: LucideIcon };
export type LiveNavGroup = { id: string; label: string; path: string; description: string; icon: LucideIcon; children?: LiveNavChild[] };

const HOME: LiveNavGroup = { id: 'accueil', label: 'Accueil', path: '/omnia-live', description: 'La scène Omnia Live adaptée à votre rôle.', icon: Sparkles };
const DISCOVER: LiveNavGroup = {
  id: 'decouvrir', label: 'Découvrir', path: '/omnia-live/decouvrir', description: 'Directs, programmation, formations synchrones, vidéos et experts.', icon: Compass,
  children: [
    { label: 'En direct maintenant', path: '/omnia-live/en-direct', description: 'Rejoindre les sessions ouvertes en ce moment.', icon: Radio },
    { label: 'À venir', path: '/omnia-live/a-venir', description: 'Consulter la programmation à venir.', icon: CalendarDays },
    { label: 'Explorer', path: '/omnia-live/explorer', description: 'Parcourir tous les formats disponibles.', icon: Compass },
    { label: 'Formations Live', path: '/omnia-live/formations', description: 'Parcours synchrones structurés en plusieurs sessions.', icon: BookOpen },
    { label: 'Vidéos & Replays', path: '/omnia-live/videos', description: 'Contenus enregistrés et replays validés.', icon: Film },
    { label: 'Organisateurs', path: '/omnia-live/organisateurs', description: 'Professeurs, experts et Structures qui publient sur Live.', icon: UsersRound },
  ],
};
const ABOUT: LiveNavGroup = { id: 'a-propos', label: 'À propos', path: '/omnia-live/a-propos', description: 'Comprendre l’expérience et les garanties Omnia Live.', icon: Info };

const PARTICIPATION: LiveNavGroup = {
  id: 'participation', label: 'Mon Live', path: '/omnia-live/participation', description: 'Vos inscriptions, accès, documents, notifications et historique.', icon: Ticket,
  children: [
    { label: 'Vue participant', path: '/omnia-live/participant', description: 'Résumé personnel de votre activité Live.', icon: Gauge },
    { label: 'Mes Lives', path: '/omnia-live/participant/mes-lives', description: 'Directs, événements à venir et sessions terminées.', icon: CalendarDays },
    { label: 'Bibliothèque', path: '/omnia-live/participant/bibliotheque', description: 'Vos contenus Live disponibles.', icon: Library },
    { label: 'Mes accès', path: '/omnia-live/mes-acces', description: 'Droits et accès associés à vos achats ou invitations.', icon: KeyRound },
    { label: 'Achats & factures', path: '/omnia-live/mes-achats', description: 'Historique commercial de vos Lives.', icon: ReceiptText },
    { label: 'Mes documents', path: '/omnia-live/mes-documents', description: 'Documents, attestations et preuves Live.', icon: FileBadge },
    { label: 'Notifications', path: '/omnia-live/participant/notifications', description: 'Alertes liées à vos sessions.', icon: Bell },
    { label: 'Remboursements', path: '/omnia-live/participant/remboursements', description: 'Suivre vos demandes de remboursement.', icon: RotateCcw },
    { label: 'Accès privé', path: '/omnia-live/acces-prive', description: 'Utiliser un code ou une invitation privée.', icon: KeyRound },
  ],
};

const PRODUCTION: LiveNavGroup = {
  id: 'production', label: 'Créer & produire', path: '/omnia-live/production', description: 'Transformer une expertise en événement ou formation Live.', icon: Clapperboard,
  children: [
    { label: 'Proposer un Live', path: '/omnia-live/proposer', description: 'Démarrer une proposition et son workflow de validation.', icon: Video },
    { label: 'Mes Lives', path: '/omnia-live/participant/mes-lives', description: 'Retrouver les Lives auxquels vous participez.', icon: Ticket },
    { label: 'Mes documents', path: '/omnia-live/mes-documents', description: 'Retrouver vos documents Live.', icon: FileBadge },
  ],
};

const STRUCTURE_ACTIVITY: LiveNavGroup = {
  id: 'structure', label: 'Pilotage', path: '/omnia-live/structure', description: 'Activité Live de votre Structure et programmation de nouveaux événements.', icon: BarChart3,
  children: [
    { label: 'Rapports Structure', path: '/omnia-live/structure/rapports', description: 'Présence, inscriptions, documents et activité de vos membres.', icon: BarChart3 },
    { label: 'Proposer un Live', path: '/omnia-live/proposer', description: 'Créer un événement porté par votre Structure.', icon: Video },
    { label: 'Mes Lives', path: '/omnia-live/participant/mes-lives', description: 'Lives suivis depuis votre compte.', icon: Ticket },
  ],
};

const PROGRAM: LiveNavGroup = {
  id: 'programme', label: 'Programmation', path: '/omnia-live/organisateur/programme', description: 'Créer, programmer et opérer vos événements.', icon: CalendarDays,
  children: [
    { label: 'Créer un événement', path: '/omnia-live/proposer', description: 'Démarrer une nouvelle proposition.', icon: Video },
    { label: 'Mes événements', path: '/omnia-live/organisateur/evenements', description: 'Brouillons, validation, publication, direct et historique.', icon: Radio },
    { label: 'Participants', path: '/omnia-live/organisateur/participants', description: 'Audience, inscriptions et présence.', icon: UsersRound },
    { label: 'Communications', path: '/omnia-live/organisateur/communications', description: 'Messages et campagnes événementielles.', icon: MessageSquare },
    { label: 'Accès privés', path: '/omnia-live/organisateur/acces-prives', description: 'Codes et invitations privées.', icon: KeyRound },
    { label: 'Médias & replays', path: '/omnia-live/organisateur/medias', description: 'Médias, versions et replays.', icon: Film },
  ],
};
const PERFORMANCE: LiveNavGroup = {
  id: 'performance', label: 'Performance', path: '/omnia-live/organisateur/performance', description: 'Mesurer audience, engagement et performance événementielle.', icon: Activity,
  children: [
    { label: 'Analytique', path: '/omnia-live/organisateur/statistiques', description: 'Indicateurs principaux de vos événements.', icon: BarChart3 },
    { label: 'Analytics avancés', path: '/omnia-live/organisateur/analytics-avances', description: 'Historique et analyses détaillées.', icon: Activity },
  ],
};
const MONETIZATION: LiveNavGroup = {
  id: 'monetisation', label: 'Offres & revenus', path: '/omnia-live/organisateur/monetisation', description: 'Offres participants, plan Omnia et revenus.', icon: Wallet,
  children: [
    { label: 'Offres participants', path: '/omnia-live/organisateur/offres', description: 'Configurer vos offres commerciales.', icon: CreditCard },
    { label: 'Mon plan organisateur', path: '/omnia-live/organisateur/plan-omnia', description: 'Consulter votre plan Omnia.', icon: CreditCard },
    { label: 'Revenus & payouts', path: '/omnia-live/revenus', description: 'Suivre revenus et versements.', icon: Wallet },
  ],
};
const SETTINGS: LiveNavGroup = { id: 'configuration', label: 'Configuration', path: '/omnia-live/organisateur/parametres', description: 'Préférences et réglages de votre espace Organisateur.', icon: Settings2 };
const TRUST: LiveNavGroup = {
  id: 'confiance', label: 'Confiance', path: '/omnia-live/confiance', description: 'Accéder aux outils existants de contrôle et à l’état du service.', icon: Activity,
  children: [
    { label: 'Centre de missions', path: '/moderator/missions', description: 'Traiter les missions correspondant à vos permissions.', icon: Activity },
    { label: 'Statut du service', path: '/omnia-live/system-status', description: 'Consulter l’état opérationnel d’Omnia Live.', icon: Gauge },
  ],
};

const NAV: Record<LiveAudience, LiveNavGroup[]> = {
  public: [HOME, DISCOVER, ABOUT],
  apprenant: [HOME, DISCOVER, PARTICIPATION],
  professeur: [HOME, DISCOVER, PRODUCTION, PARTICIPATION],
  structure: [HOME, DISCOVER, STRUCTURE_ACTIVITY, PARTICIPATION],
  moderateur: [HOME, DISCOVER, TRUST],
  recruteur: [HOME, DISCOVER, PARTICIPATION],
  organisateur: [HOME, DISCOVER, PROGRAM, PERFORMANCE, MONETIZATION, SETTINGS],
  coach: [HOME, DISCOVER, PARTICIPATION],
  super_admin: [HOME, DISCOVER, ABOUT],
};

export function getLiveNavigation(audience: LiveAudience): LiveNavGroup[] { return NAV[audience] || NAV.public; }

export function resolveLiveAudience(roles: readonly string[] | null | undefined, requestedRole?: string | null): LiveAudience {
  const normalized = normalizePlatformRoles(roles);
  const requested = requestedRole as CanonicalPlatformRole | undefined;
  if (requested && normalized.includes('super_admin') && ['apprenant','professeur','structure','moderateur','recruteur','organisateur','coach'].includes(requested)) return requested as LiveAudience;
  if (normalized.includes('super_admin')) return 'super_admin';
  if (normalized.includes('structure') || normalized.includes('recruteur_structure') || normalized.includes('gestionnaire_structure')) return 'structure';
  const priority: LiveAudience[] = ['moderateur','organisateur','recruteur','professeur','coach','apprenant'];
  return priority.find(role => normalized.includes(role as CanonicalPlatformRole)) || (normalized.length ? 'apprenant' : 'public');
}

export function liveAudienceLabel(audience: LiveAudience) {
  return ({ public:'Découvrir', apprenant:'Apprenant', professeur:'Professeur', structure:'Structure', moderateur:'Modérateur', recruteur:'Recruteur', organisateur:'Organisateur', coach:'Coach', super_admin:'Administration' } satisfies Record<LiveAudience,string>)[audience];
}
function pathOnly(path:string){return path.split('#',1)[0].split('?',1)[0]}
export function findLiveSection(audience: LiveAudience, pathname: string) {
  return getLiveNavigation(audience).find(group => {
    const gp=pathOnly(group.path);
    if(pathname===gp||pathname.startsWith(`${gp}/`))return true;
    return Boolean(group.children?.some(child=>{const cp=pathOnly(child.path);return pathname===cp||pathname.startsWith(`${cp}/`)}));
  });
}
