import { useCallback, useEffect, useMemo, useRef, useState, type ElementType, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Award,
  Bell,
  BookOpen,
  Briefcase,
  Camera,
  CheckCircle,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  Languages,
  Link2 as LinkIcon,
  Lock,
  Mail,
  MapPin,
  Phone,
  Save,
  Settings,
  Shield,
  Trash2,
  Upload,
  User,
  Users,
} from 'lucide-react';
import { ProfileRoleLayout } from '../../components/profile/ProfileRoleLayout';
import { ENDPOINTS } from '../../lib/config';
import { edgeAuthHeaders } from '../../lib/edgeAuth';
import {
  getUnifiedProfile,
  listBlockedProfileUsers,
  ProfileApiError,
  deleteOwnAccount,
  removeProfileAvatar,
  suspendOwnAccount,
  unblockProfileUser,
  updateUnifiedProfile,
  uploadProfileAvatar,
  type ProfileFieldVisibility,
  type ProfileVisibleField,
  type UnifiedProfileBundle,
} from '../../lib/profileApi';
import { clearSession, getDashboardPathForRoles, getSessionToken, saveSession } from '../../lib/session';
import { PLATFORM_LANGUAGES, useLanguage } from '../../i18n/LanguageContext';

type Tab = 'apercu' | 'identite' | 'professionnel' | 'visibilite' | 'notifications' | 'securite';
type Message = { ok: boolean; text: string } | null;
type BlockedUser = { user_id: string; full_name: string; reason: string | null; blocked_at: string };
type ExitFeedbackForm = { improvement_feedback: string; missing_feature: string; return_condition: string };
type SuspensionForm = ExitFeedbackForm & {
  currentPassword: string; confirmation: string; reasonCode: string; duration: string; customDate: string; accepted: boolean;
};
type DeletionForm = ExitFeedbackForm & {
  currentPassword: string; confirmation: string; reasonCode: string; accepted: boolean;
};

type UserForm = {
  full_name: string;
  email: string;
  phone_number: string;
  country_code: string;
  birth_date: string;
};

type ProfileForm = {
  display_name: string;
  headline: string;
  bio: string;
  city: string;
  languages: string[];
  skills: string[];
  interests: string[];
  website_url: string;
  linkedin_url: string;
  portfolio_url: string;
  github_url: string;
  availability_text: string;
  public_email: string;
  public_phone: string;
  visibility: 'public' | 'members' | 'private';
  show_email: boolean;
  show_phone: boolean;
  show_location: boolean;
  show_roles: boolean;
  show_achievements: boolean;
  allow_messages: boolean;
  field_visibility: ProfileFieldVisibility;
};

type RoleForm = {
  education_level: string;
  field_of_study: string;
  career_goal: string;
  target_roles: string[];
  target_sectors: string[];
  contract_preferences: string[];
  years_experience: string;
  expertise_domain: string;
  teaching_languages: string[];
  qualifications: string[];
  teaching_formats: string[];
  experience_summary: string;
  organizer_type: string;
  organization_name: string;
  event_topics: string[];
  moderation_domains: string[];
  recruitment_sectors: string[];
  recruitment_countries: string[];
  coaching_topics: string[];
  session_languages: string[];
};

const EMPTY_USER: UserForm = { full_name: '', email: '', phone_number: '', country_code: '', birth_date: '' };
const DEFAULT_FIELD_VISIBILITY: Required<ProfileFieldVisibility> = {
  display_name: true,
  avatar_url: true,
  headline: true,
  bio: true,
  city: true,
  country_code: true,
  languages: true,
  skills: true,
  interests: true,
  website_url: true,
  linkedin_url: true,
  portfolio_url: true,
  github_url: true,
  availability_text: true,
  public_email: false,
  public_phone: false,
  roles: true,
  achievements: true,
  messages: true,
  education_level: true,
  field_of_study: true,
  career_goal: true,
  target_roles: true,
  target_sectors: true,
  contract_preferences: true,
  years_experience: true,
  expertise_domain: true,
  teaching_languages: true,
  qualifications: true,
  teaching_formats: true,
  experience_summary: true,
  organizer_type: true,
  organization_name: true,
  event_topics: true,
  moderation_domains: true,
  recruitment_sectors: true,
  recruitment_countries: true,
  coaching_topics: true,
  session_languages: true,
  organizer_metrics: true,
  coach_metrics: true,
  structure: true,
};

const EMPTY_PROFILE: ProfileForm = {
  display_name: '', headline: '', bio: '', city: '', languages: [], skills: [], interests: [],
  website_url: '', linkedin_url: '', portfolio_url: '', github_url: '', availability_text: '',
  public_email: '', public_phone: '', visibility: 'members', show_email: false, show_phone: false,
  show_location: true, show_roles: true, show_achievements: true, allow_messages: true,
  field_visibility: { ...DEFAULT_FIELD_VISIBILITY },
};
const EMPTY_ROLE: RoleForm = {
  education_level: '', field_of_study: '', career_goal: '', target_roles: [], target_sectors: [],
  contract_preferences: [], years_experience: '', expertise_domain: '', teaching_languages: [],
  qualifications: [], teaching_formats: [], experience_summary: '', organizer_type: '', organization_name: '',
  event_topics: [], moderation_domains: [], recruitment_sectors: [], recruitment_countries: [],
  coaching_topics: [], session_languages: [],
};

const inputClass = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#BF8813] focus:ring-2 focus:ring-[#BF8813]/15';
const labelClass = 'block text-sm font-semibold text-[#002050]';
const ROLE_ACCENT = 'var(--oga-role-accent, #BF8813)';
const ROLE_SOFT = 'var(--oga-role-soft, rgba(0, 32, 80, 0.05))';
const ROLE_SECONDARY = 'var(--oga-role-secondary, #002050)';
const ROLE_CONTROL_ACCENT = 'var(--oga-role-accent, #002050)';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Administration', moderateur: 'Modérateur', structure: 'Structure',
  organisateur: 'Organisateur Omnia Live', organizer: 'Organisateur Omnia Live', recruteur: 'Recruteur',
  recruteur_independant: 'Recruteur', professeur: 'Professeur', formateur: 'Professeur', coach: 'Coach', apprenant: 'Apprenant',
};

const SUSPENSION_REASONS = [
  ['pause', 'Je fais une pause'],
  ['too_many_notifications', 'Je reçois trop de notifications'],
  ['low_usage', 'Je n’utilise pas suffisamment la plateforme'],
  ['technical_issue', 'Je rencontre un problème technique'],
  ['security_break', 'Je souhaite protéger temporairement mon compte'],
  ['missing_features', 'Je ne trouve pas les fonctionnalités recherchées'],
  ['other', 'Autre'],
] as const;

const DELETION_REASONS = [
  ['no_longer_use', 'Je n’utilise plus la plateforme'],
  ['duplicate_account', 'J’ai créé un autre compte'],
  ['privacy_request', 'Je souhaite supprimer mes données'],
  ['technical_issues', 'Je rencontre trop de problèmes techniques'],
  ['missing_content', 'Je ne trouve pas les formations ou services recherchés'],
  ['communications', 'Je ne souhaite plus recevoir de communications'],
  ['dissatisfied', 'Je suis insatisfait de mon expérience'],
  ['other', 'Autre'],
] as const;

const EMPTY_EXIT_FEEDBACK: ExitFeedbackForm = { improvement_feedback: '', missing_feature: '', return_condition: '' };
const EMPTY_SUSPENSION: SuspensionForm = {
  ...EMPTY_EXIT_FEEDBACK, currentPassword: '', confirmation: '', reasonCode: '', duration: '', customDate: '', accepted: false,
};
const EMPTY_DELETION: DeletionForm = {
  ...EMPTY_EXIT_FEEDBACK, currentPassword: '', confirmation: '', reasonCode: '', accepted: false,
};

const TAB_ALIASES: Record<string, Tab> = {
  info: 'identite', informations: 'identite', professionnel: 'professionnel', profil_pro: 'professionnel',
  parametres: 'visibilite', preferences: 'visibilite', notifications: 'notifications', securite: 'securite', security: 'securite',
};

type VisibilityItem = {
  field: ProfileVisibleField;
  title: string;
  description: string;
};

const IDENTITY_VISIBILITY_ITEMS: VisibilityItem[] = [
  { field: 'display_name', title: 'Nom affiché', description: 'Si vous le masquez, la page publique affichera « Membre Omnia ».' },
  { field: 'avatar_url', title: 'Photo de profil', description: 'Masquez la photo sans supprimer le fichier de votre compte.' },
  { field: 'city', title: 'Ville', description: 'Affiche uniquement la ville, jamais une adresse précise.' },
  { field: 'country_code', title: 'Pays', description: 'Affiche le pays associé à votre compte.' },
  { field: 'languages', title: 'Langues', description: 'Langues renseignées dans votre profil.' },
  { field: 'public_email', title: 'E-mail public', description: 'L’adresse de connexion reste toujours privée.' },
  { field: 'public_phone', title: 'Téléphone public', description: 'Le numéro privé du compte reste toujours masqué.' },
];

const PROFESSIONAL_VISIBILITY_ITEMS: VisibilityItem[] = [
  { field: 'headline', title: 'Titre professionnel', description: 'Accroche affichée sous votre nom.' },
  { field: 'bio', title: 'Présentation', description: 'Résumé public de votre parcours.' },
  { field: 'skills', title: 'Compétences', description: 'Compétences utilisées dans votre profil et Omnia Talent.' },
  { field: 'interests', title: 'Centres d’intérêt', description: 'Thématiques que vous avez choisi de renseigner.' },
  { field: 'availability_text', title: 'Disponibilité', description: 'Disponibilité professionnelle ou pédagogique.' },
  { field: 'website_url', title: 'Site web', description: 'Lien vers votre site professionnel.' },
  { field: 'linkedin_url', title: 'LinkedIn', description: 'Lien vers votre profil LinkedIn.' },
  { field: 'portfolio_url', title: 'Portfolio', description: 'Lien vers votre portfolio externe.' },
  { field: 'github_url', title: 'GitHub', description: 'Lien vers votre profil GitHub.' },
  { field: 'roles', title: 'Rôles Omnia', description: 'Ex. Apprenant, Professeur, Coach ou Organisateur.' },
  { field: 'achievements', title: 'Réalisations', description: 'Badges, certificats et preuves autorisées.' },
  { field: 'messages', title: 'Messages des membres', description: 'Autorise les membres connectés à vous contacter.' },
];

const ROLE_VISIBILITY_LABELS: Partial<Record<ProfileVisibleField, [string, string]>> = {
  education_level: ['Niveau d’étude', 'Niveau d’étude renseigné dans le parcours apprenant.'],
  field_of_study: ['Domaine d’étude', 'Domaine ou spécialité d’étude.'],
  career_goal: ['Objectif professionnel', 'Objectif professionnel détaillé.'],
  target_roles: ['Postes recherchés', 'Postes ou fonctions ciblés.'],
  target_sectors: ['Secteurs ciblés', 'Secteurs professionnels recherchés.'],
  contract_preferences: ['Types de contrat', 'Préférences de contrat ou de collaboration.'],
  years_experience: ['Années d’expérience', 'Expérience déclarée dans votre rôle professionnel.'],
  expertise_domain: ['Domaine d’expertise', 'Domaine principal d’expertise.'],
  teaching_languages: ['Langues d’enseignement', 'Langues utilisées pour enseigner.'],
  qualifications: ['Diplômes et qualifications', 'Qualifications rendues visibles.'],
  teaching_formats: ['Formats d’enseignement', 'Formats pédagogiques proposés.'],
  experience_summary: ['Expérience détaillée', 'Résumé de votre expérience de rôle.'],
  organizer_type: ['Type d’organisateur', 'Catégorie de votre activité Omnia Live.'],
  organization_name: ['Organisation', 'Organisation associée à votre activité.'],
  event_topics: ['Thématiques d’événements', 'Sujets de vos événements Omnia Live.'],
  moderation_domains: ['Domaines de modération', 'Domaines publics de contribution à la communauté.'],
  recruitment_sectors: ['Secteurs de recrutement', 'Secteurs dans lesquels vous recrutez.'],
  recruitment_countries: ['Pays de recrutement', 'Pays ou zones de recrutement.'],
  coaching_topics: ['Thématiques de coaching', 'Domaines dans lesquels vous accompagnez.'],
  session_languages: ['Langues de session', 'Langues proposées pour les séances.'],
  organizer_metrics: ['Indicateurs organisateur', 'Notes et volumes publics liés à Omnia Live.'],
  coach_metrics: ['Indicateurs coach', 'Notes et volumes publics liés au coaching.'],
  structure: ['Structure associée', 'Nom, type, logo et localisation autorisée de la structure.'],
};

function asText(value: unknown) { return typeof value === 'string' ? value : ''; }
function asList(value: unknown) { return Array.isArray(value) ? value.map(String).filter(Boolean) : []; }
function asBoolean(value: unknown, fallback: boolean) { return typeof value === 'boolean' ? value : fallback; }
function visibilityFromProfile(profile: UnifiedProfileBundle['profile']): ProfileFieldVisibility {
  const stored = profile.field_visibility && typeof profile.field_visibility === 'object'
    ? profile.field_visibility
    : {};
  return {
    ...DEFAULT_FIELD_VISIBILITY,
    ...stored,
    public_email: stored.public_email ?? asBoolean(profile.show_email, false),
    public_phone: stored.public_phone ?? asBoolean(profile.show_phone, false),
    city: stored.city ?? asBoolean(profile.show_location, true),
    country_code: stored.country_code ?? asBoolean(profile.show_location, true),
    roles: stored.roles ?? asBoolean(profile.show_roles, true),
    achievements: stored.achievements ?? asBoolean(profile.show_achievements, true),
    messages: stored.messages ?? asBoolean(profile.allow_messages, true),
  };
}
function monogram(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : parts[0].slice(0, 2)).toUpperCase();
}
function normalizeDate(value: unknown) { return asText(value).slice(0, 10); }
function roleDetails(bundle: UnifiedProfileBundle) { return (bundle.profile.role_details || {}) as Record<string, unknown>; }

function formsFromBundle(bundle: UnifiedProfileBundle) {
  const details = roleDetails(bundle);
  const profile = bundle.profile;
  return {
    user: {
      full_name: asText(bundle.user.full_name), email: asText(bundle.user.email), phone_number: asText(bundle.user.phone_number),
      country_code: asText(bundle.user.country_code), birth_date: normalizeDate(bundle.user.birth_date),
    } satisfies UserForm,
    profile: {
      display_name: asText(profile.display_name) || asText(bundle.user.full_name), headline: asText(profile.headline), bio: asText(profile.bio),
      city: asText(profile.city), languages: asList(profile.languages), skills: asList(profile.skills), interests: asList(profile.interests),
      website_url: asText(profile.website_url), linkedin_url: asText(profile.linkedin_url), portfolio_url: asText(profile.portfolio_url),
      github_url: asText(profile.github_url), availability_text: asText(profile.availability_text), public_email: asText(profile.public_email),
      public_phone: asText(profile.public_phone), visibility: profile.visibility || 'members', show_email: asBoolean(profile.show_email, false),
      show_phone: asBoolean(profile.show_phone, false), show_location: asBoolean(profile.show_location, true), show_roles: asBoolean(profile.show_roles, true),
      show_achievements: asBoolean(profile.show_achievements, true), allow_messages: asBoolean(profile.allow_messages, true),
      field_visibility: visibilityFromProfile(profile),
    } satisfies ProfileForm,
    role: {
      education_level: asText(details.education_level), field_of_study: asText(details.field_of_study), career_goal: asText(details.career_goal),
      target_roles: asList(details.target_roles), target_sectors: asList(details.target_sectors), contract_preferences: asList(details.contract_preferences),
      years_experience: asText(details.years_experience), expertise_domain: asText(details.expertise_domain), teaching_languages: asList(details.teaching_languages),
      qualifications: asList(details.qualifications), teaching_formats: asList(details.teaching_formats), experience_summary: asText(details.experience_summary),
      organizer_type: asText(details.organizer_type), organization_name: asText(details.organization_name), event_topics: asList(details.event_topics),
      moderation_domains: asList(details.moderation_domains), recruitment_sectors: asList(details.recruitment_sectors),
      recruitment_countries: asList(details.recruitment_countries), coaching_topics: asList(details.coaching_topics), session_languages: asList(details.session_languages),
    } satisfies RoleForm,
  };
}

function profileErrorMessage(error: unknown) {
  if (!(error instanceof ProfileApiError)) return 'Une erreur réseau empêche la mise à jour du profil.';
  const labels: Record<string, string> = {
    AUTH_REQUIRED: 'Votre session a expiré. Reconnectez-vous.', SESSION_INVALID: 'Votre session est invalide ou expirée.',
    EMAIL_TAKEN: 'Cette adresse e-mail est déjà utilisée.', PHONE_TAKEN: 'Ce numéro est déjà utilisé.',
    FULL_NAME_REQUIRED: 'Le nom complet est obligatoire.', EMAIL_REQUIRED: 'L’adresse e-mail est obligatoire.',
    PHONE_REQUIRED: 'Le numéro de téléphone est obligatoire.', COUNTRY_REQUIRED: 'Le pays est obligatoire.',
    BIRTH_DATE_REQUIRED: 'La date de naissance est obligatoire.', INVALID_URL: 'Une adresse web n’est pas valide.',
    AVATAR_TOO_LARGE: 'La photo dépasse 3 Mo.', INVALID_AVATAR_TYPE: 'Utilisez une image PNG, JPG ou WebP.',
    INVALID_AVATAR_DATA: 'La photo n’a pas pu être lue.', INVALID_FIELD_VISIBILITY: 'Les réglages de visibilité sont invalides.', PROFILE_PRIVATE: 'Ce profil est privé.',
    PROFILE_SUSPENDED: 'Ce profil est temporairement indisponible.', INVALID_PASSWORD: 'Mot de passe actuel incorrect.',
    SUSPENSION_CONFIRMATION_REQUIRED: 'La confirmation de suspension est invalide.', INVALID_SUSPENSION_REASON: 'Choisissez un motif de suspension valide.',
    INVALID_SUSPENSION_UNTIL: 'La date de retour prévue est invalide.', ACCOUNT_NOT_ACTIVE: 'Seul un compte actif peut être suspendu volontairement.',
    LAST_SUPER_ADMIN_PROTECTED: 'Le dernier compte d’administration actif ne peut pas être suspendu ou supprimé.',
    DEMO_ACCOUNT_PROTECTED: 'Le compte de démonstration est protégé.', DELETION_CONFIRMATION_REQUIRED: 'La confirmation de suppression est invalide.',
  };
  return labels[error.code] || error.message || 'Mise à jour impossible.';
}

function plannedSuspensionDate(duration: string, customDate: string) {
  if (!duration) return null;
  if (duration === 'custom') {
    if (!customDate) return null;
    const parsed = new Date(`${customDate}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  const days = Number(duration);
  if (!Number.isFinite(days) || days <= 0) return null;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function accountImpactForRoles(roles: string[]) {
  const impacts = new Set<string>();
  if (roles.includes('apprenant')) impacts.add('Vos formations, progressions et espaces personnels deviennent inaccessibles pendant la suspension. Les certificats et preuves déjà émis restent conservés selon leurs règles.');
  if (roles.some(role => ['professeur', 'formateur', 'enseignant', 'etablissement_enseignant'].includes(role))) impacts.add('Vos formations publiées et les dossiers nécessaires aux apprenants ne sont pas supprimés automatiquement. Vous ne pourrez plus les gérer pendant la suspension.');
  if (roles.some(role => ['structure', 'responsable_structure', 'gestionnaire_structure', 'gestionnaire_partenaire'].includes(role))) impacts.add('La suspension de votre compte personnel ne supprime pas la Structure. Vérifiez qu’un autre responsable peut assurer la continuité avant une suppression définitive.');
  if (roles.some(role => ['organisateur', 'organizer'].includes(role))) impacts.add('Les événements, inscriptions et documents déjà produits restent conservés. Vous perdez temporairement la gestion des événements à venir.');
  if (roles.includes('moderateur')) impacts.add('Les journaux de modération nécessaires à la sécurité sont conservés sous une forme pseudonymisée.');
  if (roles.includes('super_admin')) impacts.add('Le dernier compte d’administration actif ne peut ni être suspendu ni être supprimé.');
  if (!impacts.size) impacts.add('La suspension désactive l’accès sans supprimer vos données. La suppression définitive efface ou anonymise les données personnelles, sous réserve des obligations légales et de sécurité.');
  return [...impacts];
}

export default function UnifiedProfilePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const fileInput = useRef<HTMLInputElement>(null);
  const queryTab = new URLSearchParams(location.search).get('tab') || '';
  const [tab, setTab] = useState<Tab>(TAB_ALIASES[queryTab] || (queryTab as Tab) || 'apercu');
  const [bundle, setBundle] = useState<UnifiedProfileBundle | null>(null);
  const [userForm, setUserForm] = useState<UserForm>(EMPTY_USER);
  const [profileForm, setProfileForm] = useState<ProfileForm>(EMPTY_PROFILE);
  const [roleForm, setRoleForm] = useState<RoleForm>(EMPTY_ROLE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [password, setPassword] = useState({ current: '', next: '', confirm: '' });
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [suspensionForm, setSuspensionForm] = useState<SuspensionForm>(EMPTY_SUSPENSION);
  const [suspensionSaving, setSuspensionSaving] = useState(false);
  const [deletionForm, setDeletionForm] = useState<DeletionForm>(EMPTY_DELETION);
  const [deletionSaving, setDeletionSaving] = useState(false);

  const hydrate = useCallback((next: UnifiedProfileBundle) => {
    setBundle(next);
    const forms = formsFromBundle(next);
    setUserForm(forms.user);
    setProfileForm(forms.profile);
    setRoleForm(forms.role);
  }, []);

  const load = useCallback(async () => {
    if (!getSessionToken()) { navigate('/connexion', { replace: true }); return; }
    try {
      hydrate(await getUnifiedProfile());
    } catch (error) {
      setMessage({ ok: false, text: profileErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [hydrate, navigate]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const next = TAB_ALIASES[queryTab] || (['apercu', 'identite', 'professionnel', 'visibilite', 'notifications', 'securite'].includes(queryTab) ? queryTab as Tab : null);
    if (next) setTab(next);
  }, [queryTab]);
  useEffect(() => {
    if (!bundle || tab !== 'securite' || location.hash !== '#gestion-compte') return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById('gestion-compte')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [bundle, location.hash, tab]);

  const roles = bundle?.roles || [];
  const isAdministration = roles.includes('super_admin');
  const roleLabels = useMemo(
    () => isAdministration ? ['Administration'] : [...new Set(roles.filter(role => role !== 'gestionnaire_structure').map(role => ROLE_LABELS[role] || role))],
    [isAdministration, roles],
  );
  const isLearner = roles.includes('apprenant');
  const isProfessor = roles.some(role => ['professeur', 'formateur'].includes(role));
  const isOrganizer = roles.some(role => ['organisateur', 'organizer'].includes(role));
  const isModerator = roles.includes('moderateur');
  const isRecruiter = roles.some(role => ['recruteur', 'recruteur_independant'].includes(role));
  const isCoach = roles.includes('coach');
  const isStructure = roles.includes('structure');
  const hasStructureManagementDelegation = roles.includes('gestionnaire_structure');
  const roleVisibilityItems = useMemo<VisibilityItem[]>(() => {
    const fields: ProfileVisibleField[] = [];
    if (isLearner) fields.push('education_level', 'field_of_study', 'career_goal', 'target_roles', 'target_sectors', 'contract_preferences');
    if (isProfessor) fields.push('years_experience', 'expertise_domain', 'teaching_languages', 'qualifications', 'teaching_formats');
    if (isOrganizer) fields.push('organizer_type', 'organization_name', 'event_topics', 'experience_summary', 'organizer_metrics');
    if (isModerator) fields.push('moderation_domains');
    if (isRecruiter) fields.push('organization_name', 'recruitment_sectors', 'recruitment_countries');
    if (isCoach) fields.push('coaching_topics', 'session_languages', 'coach_metrics');
    if (isStructure) fields.push('structure');
    return [...new Set(fields)].flatMap(field => {
      const label = ROLE_VISIBILITY_LABELS[field];
      return label ? [{ field, title: label[0], description: label[1] }] : [];
    });
  }, [isCoach, isLearner, isModerator, isOrganizer, isProfessor, isRecruiter, isStructure]);
  const accountImpacts = useMemo(() => accountImpactForRoles(roles), [roles]);

  const completion = useMemo(() => {
    const values = [userForm.full_name, userForm.email, userForm.phone_number, userForm.country_code, userForm.birth_date,
      profileForm.display_name, profileForm.headline, profileForm.bio, profileForm.city, profileForm.languages.length,
      profileForm.skills.length, profileForm.interests.length, profileForm.availability_text, bundle?.user.avatar_url];
    const filled = values.filter(Boolean).length;
    return Math.round((filled / values.length) * 100);
  }, [bundle?.user.avatar_url, profileForm, userForm]);

  function updateStoredUser(next: UnifiedProfileBundle) {
    const stored = localStorage.getItem('omnia_user');
    try {
      const previous = stored ? JSON.parse(stored) : {};
      const merged = { ...previous, ...next.user, roles: next.roles };
      localStorage.setItem('omnia_user', JSON.stringify(merged));
      window.dispatchEvent(new CustomEvent('omnia:profile-updated', { detail: merged }));
    } catch { /* la réponse serveur reste la source de vérité */ }
  }

  async function save(section: 'identity' | 'professional' | 'privacy' | 'notifications') {
    setSaving(true); setMessage(null);
    try {
      let next: UnifiedProfileBundle;
      if (section === 'identity') {
        next = await updateUnifiedProfile({
          user: userForm,
          profile: {
            display_name: profileForm.display_name, city: profileForm.city, languages: profileForm.languages,
            public_email: profileForm.public_email, public_phone: profileForm.public_phone,
          },
        });
      } else if (section === 'professional') {
        next = await updateUnifiedProfile({
          profile: {
            headline: profileForm.headline, bio: profileForm.bio, skills: profileForm.skills, interests: profileForm.interests,
            website_url: profileForm.website_url, linkedin_url: profileForm.linkedin_url, portfolio_url: profileForm.portfolio_url,
            github_url: profileForm.github_url, availability_text: profileForm.availability_text,
          },
          role_details: roleForm,
        });
      } else if (section === 'privacy') {
        const fields = profileForm.field_visibility;
        next = await updateUnifiedProfile({ profile: {
          visibility: profileForm.visibility,
          field_visibility: fields,
          show_email: fields.public_email !== false,
          show_phone: fields.public_phone !== false,
          show_location: fields.city !== false || fields.country_code !== false,
          show_roles: fields.roles !== false,
          show_achievements: fields.achievements !== false,
          allow_messages: fields.messages !== false,
        } });
      } else {
        next = await updateUnifiedProfile({ user: {
          allow_email: bundle?.user.allow_email ?? true, allow_sms: bundle?.user.allow_sms ?? false,
          allow_push: bundle?.user.allow_push ?? true, subscribe_newsletter: bundle?.user.subscribe_newsletter ?? false,
        } });
      }
      hydrate(next); updateStoredUser(next);
      setMessage({ ok: true, text: 'Profil mis à jour et synchronisé dans vos espaces Omnia.' });
    } catch (error) {
      setMessage({ ok: false, text: profileErrorMessage(error) });
    } finally { setSaving(false); }
  }

  async function selectAvatar(file: File | undefined) {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setMessage({ ok: false, text: 'Utilisez une image PNG, JPG ou WebP.' }); return;
    }
    if (file.size > 3 * 1024 * 1024) { setMessage({ ok: false, text: 'La photo ne doit pas dépasser 3 Mo.' }); return; }
    setAvatarSaving(true); setMessage(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('READ_FAILED'));
        reader.readAsDataURL(file);
      });
      const next = await uploadProfileAvatar(dataUrl);
      hydrate(next); updateStoredUser(next);
      setMessage({ ok: true, text: 'Photo de profil mise à jour.' });
    } catch (error) { setMessage({ ok: false, text: profileErrorMessage(error) }); }
    finally { setAvatarSaving(false); if (fileInput.current) fileInput.current.value = ''; }
  }

  async function deleteAvatar() {
    setAvatarSaving(true); setMessage(null);
    try {
      const next = await removeProfileAvatar(); hydrate(next); updateStoredUser(next);
      setMessage({ ok: true, text: 'Photo retirée. Vos initiales sont utilisées.' });
    } catch (error) { setMessage({ ok: false, text: profileErrorMessage(error) }); }
    finally { setAvatarSaving(false); }
  }

  async function savePassword() {
    if (password.next.length < 8) { setMessage({ ok: false, text: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' }); return; }
    if (password.next !== password.confirm) { setMessage({ ok: false, text: 'La confirmation ne correspond pas.' }); return; }
    setPasswordSaving(true); setMessage(null);
    try {
      const response = await fetch(ENDPOINTS.authChangePassword, {
        method: 'POST', headers: edgeAuthHeaders(),
        body: JSON.stringify({ current_password: password.current, new_password: password.next }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.message || 'Modification impossible.');
      if (payload.session_token && payload.user) saveSession(payload.session_token, payload.user);
      setPassword({ current: '', next: '', confirm: '' });
      setMessage({ ok: true, text: 'Mot de passe modifié. Les anciennes sessions ont été révoquées.' });
    } catch (error) { setMessage({ ok: false, text: error instanceof Error ? error.message : 'Modification impossible.' }); }
    finally { setPasswordSaving(false); }
  }

  const loadBlocked = useCallback(async () => {
    setBlockedLoading(true);
    try { setBlocked((await listBlockedProfileUsers()).blocked_users || []); }
    catch { setBlocked([]); }
    finally { setBlockedLoading(false); }
  }, []);
  useEffect(() => { if (tab === 'securite') void loadBlocked(); }, [loadBlocked, tab]);

  async function unblock(userId: string) {
    try { await unblockProfileUser(userId); setBlocked(items => items.filter(item => item.user_id !== userId)); }
    catch (error) { setMessage({ ok: false, text: profileErrorMessage(error) }); }
  }

  async function suspendAccount() {
    if (!suspensionForm.reasonCode) { setMessage({ ok: false, text: 'Choisissez un motif de suspension.' }); return; }
    if (!suspensionForm.currentPassword) { setMessage({ ok: false, text: 'Saisissez votre mot de passe actuel.' }); return; }
    if (suspensionForm.confirmation.trim() !== 'SUSPENDRE') { setMessage({ ok: false, text: 'Écrivez SUSPENDRE pour confirmer.' }); return; }
    if (!suspensionForm.accepted) { setMessage({ ok: false, text: 'Confirmez avoir compris les conséquences de la suspension.' }); return; }
    const suspendedUntil = plannedSuspensionDate(suspensionForm.duration, suspensionForm.customDate);
    if (suspensionForm.duration && !suspendedUntil) { setMessage({ ok: false, text: 'Choisissez une date de retour valide.' }); return; }

    setSuspensionSaving(true); setMessage(null);
    try {
      await suspendOwnAccount({
        current_password: suspensionForm.currentPassword,
        confirmation: suspensionForm.confirmation.trim(),
        reason_code: suspensionForm.reasonCode,
        suspended_until: suspendedUntil,
        feedback: {
          improvement_feedback: suspensionForm.improvement_feedback,
          missing_feature: suspensionForm.missing_feature,
          return_condition: suspensionForm.return_condition,
        },
      });
      clearSession();
      navigate('/connexion?compte=suspendu', { replace: true });
    } catch (error) { setMessage({ ok: false, text: profileErrorMessage(error) }); }
    finally { setSuspensionSaving(false); }
  }

  async function deleteAccount() {
    if (!deletionForm.reasonCode) { setMessage({ ok: false, text: 'Choisissez un motif de suppression.' }); return; }
    if (!deletionForm.currentPassword) { setMessage({ ok: false, text: 'Saisissez votre mot de passe actuel.' }); return; }
    if (deletionForm.confirmation.trim() !== 'SUPPRIMER') { setMessage({ ok: false, text: 'Écrivez SUPPRIMER pour confirmer.' }); return; }
    if (!deletionForm.accepted) { setMessage({ ok: false, text: 'Confirmez avoir compris que la suppression est irréversible.' }); return; }

    setDeletionSaving(true); setMessage(null);
    try {
      const result = await deleteOwnAccount({
        current_password: deletionForm.currentPassword,
        confirmation: deletionForm.confirmation.trim(),
        reason_code: deletionForm.reasonCode,
        feedback: {
          improvement_feedback: deletionForm.improvement_feedback,
          missing_feature: deletionForm.missing_feature,
          return_condition: deletionForm.return_condition,
        },
      });
      clearSession();
      navigate(`/compte-supprime${result.deletion_reference ? `?reference=${encodeURIComponent(result.deletion_reference)}` : ''}`, { replace: true });
    } catch (error) { setMessage({ ok: false, text: profileErrorMessage(error) }); }
    finally { setDeletionSaving(false); }
  }

  function switchTab(next: Tab) {
    setTab(next); setMessage(null);
    const params = new URLSearchParams(location.search); params.set('tab', next);
    navigate({ pathname: '/mon-profil', search: `?${params.toString()}` }, { replace: true });
  }

  if (loading) return <ProfileRoleLayout><div className="flex min-h-[60vh] items-center justify-center"><div className="h-9 w-9 animate-spin rounded-full border-2 border-[#002050] border-t-transparent" /></div></ProfileRoleLayout>;
  if (!bundle) return <ProfileRoleLayout><div className="mx-auto max-w-3xl p-6"><Notice value={message || { ok: false, text: 'Profil indisponible.' }} /></div></ProfileRoleLayout>;

  const avatar = bundle.user.avatar_url;
  const tabs: Array<{ key: Tab; label: string; icon: ElementType }> = isAdministration
    ? [
        { key: 'apercu', label: 'Compte', icon: User },
        { key: 'identite', label: 'Informations', icon: Mail },
        { key: 'notifications', label: 'Notifications', icon: Bell },
        { key: 'securite', label: 'Sécurité', icon: Lock },
      ]
    : [
        { key: 'apercu', label: 'Aperçu', icon: User }, { key: 'identite', label: 'Informations', icon: Mail },
        { key: 'professionnel', label: 'Professionnel', icon: Briefcase }, { key: 'visibilite', label: 'Confidentialité', icon: Eye },
        { key: 'notifications', label: 'Notifications', icon: Bell }, { key: 'securite', label: 'Sécurité', icon: Lock },
      ];

  return <ProfileRoleLayout>
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <header
        className={`relative overflow-hidden rounded-3xl border p-5 shadow-sm sm:p-7 ${isAdministration ? 'border-[#183D6D] text-white shadow-[0_24px_70px_rgba(0,32,80,.18)]' : 'border-slate-200 bg-white'}`}
        style={isAdministration ? { background: 'radial-gradient(circle at 92% 12%, rgba(191,136,19,.22), transparent 28%), linear-gradient(125deg,#001A3F 0%,#002B61 64%,#083B73 100%)' } : undefined}
      >
        {isAdministration && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-[linear-gradient(90deg,#BF8813_0%,#E6C56F_45%,#3E63B8_100%)]" aria-hidden="true" />}
        <div className="flex flex-col gap-6 md:flex-row md:items-center">
          <div className="relative h-28 w-28 flex-none">
            {avatar ? <img src={avatar} alt="Photo de profil" className="h-28 w-28 rounded-3xl border-4 border-white object-cover shadow-lg" /> :
              <div className="flex h-28 w-28 items-center justify-center rounded-3xl text-3xl font-black shadow-lg" style={{ background: isAdministration ? '#BF8813' : ROLE_ACCENT, color: isAdministration ? '#002050' : '#FFFFFF' }}>{monogram(userForm.full_name)}</div>}
            <button type="button" onClick={() => fileInput.current?.click()} disabled={avatarSaving} className="absolute -bottom-2 -right-2 rounded-xl p-2.5 text-white shadow-lg disabled:opacity-50" style={{ background: ROLE_SECONDARY }} aria-label="Changer la photo"><Camera size={18} /></button>
            <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={event => void selectAvatar(event.target.files?.[0])} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">{roleLabels.map(label => <span key={label} className="rounded-full px-3 py-1 text-xs font-bold" style={isAdministration ? { background: 'rgba(191,136,19,.16)', color: '#F0D58B', border: '1px solid rgba(240,213,139,.28)' } : { background: ROLE_SOFT, color: ROLE_CONTROL_ACCENT }}>{label}</span>)}{hasStructureManagementDelegation && <span className="rounded-full border border-[#BF8813]/35 bg-[#BF8813]/10 px-3 py-1 text-xs font-bold text-[#805A0C]">Accès interne à une Structure</span>}</div>
            <h1 className={`mt-3 truncate text-2xl font-black sm:text-3xl ${isAdministration ? 'text-white' : 'text-[#002050]'}`}>{profileForm.display_name || userForm.full_name}</h1>
            <p className={`mt-1 text-sm ${isAdministration ? 'text-white/68' : 'text-slate-600'}`}>{isAdministration ? 'Compte interne de gestion de la plateforme.' : (profileForm.headline || 'Complétez votre profil pour mieux représenter votre parcours dans l’écosystème Omnia.')}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => fileInput.current?.click()} disabled={avatarSaving} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${isAdministration ? 'border-white/20 bg-white/[.08] text-white hover:bg-white/[.12]' : 'border-slate-200 text-[#002050]'}`}><Upload size={16} /> {avatarSaving ? 'Traitement...' : 'Ajouter une photo'}</button>
              {avatar && <button type="button" onClick={() => void deleteAvatar()} disabled={avatarSaving} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-600"><Trash2 size={16} /> Retirer</button>}
              {!isAdministration && <Link to={`/profil/${bundle.user.id}`} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-white" style={{ background: ROLE_ACCENT }}><ExternalLink size={16} /> Voir mon profil public</Link>}
            </div>
          </div>
          <div className={`w-full rounded-2xl p-4 md:w-56 ${isAdministration ? 'border border-white/12 bg-white/[.08]' : 'bg-slate-50'}`}>
            <div className={`flex items-center justify-between text-sm font-bold ${isAdministration ? 'text-white' : 'text-[#002050]'}`}><span>{isAdministration ? 'Compte configuré' : 'Profil complété'}</span><span>{completion}%</span></div>
            <div className={`mt-3 h-2 overflow-hidden rounded-full ${isAdministration ? 'bg-white/[.15]' : 'bg-slate-200'}`}><div className="h-full rounded-full transition-all" style={{ width: `${completion}%`, background: isAdministration ? '#BF8813' : ROLE_ACCENT }} /></div>
            <p className={`mt-3 text-xs ${isAdministration ? 'text-white/58' : 'text-slate-500'}`}>{isAdministration ? 'Ces informations restent internes et ne créent aucun profil public.' : 'Un profil complet améliore la cohérence de vos espaces Omnia.'}</p>
          </div>
        </div>
      </header>

      <div className={`overflow-x-auto rounded-2xl border p-1.5 shadow-sm ${isAdministration ? 'border-[#DDE5F0] bg-[#F2F6FB]' : 'border-slate-200 bg-white'}`}><div className="flex min-w-max gap-1">{tabs.map(item => <button key={item.key} type="button" onClick={() => switchTab(item.key)} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${tab === item.key ? 'text-white' : 'text-slate-600 hover:bg-white'}`} style={tab === item.key ? { background: isAdministration ? '#002050' : ROLE_SECONDARY, boxShadow: isAdministration ? 'inset 0 -2px 0 #BF8813' : undefined } : undefined}><item.icon size={16} />{item.label}</button>)}</div></div>

      <Notice value={message} />

      {tab === 'apercu' && <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Section title={isAdministration ? 'Informations du compte' : 'Votre présence Omnia'} icon={Globe} description={isAdministration ? 'Données internes utilisées pour sécuriser et administrer votre accès.' : 'Les informations publiques visibles dans Omnia Communauté, Talent, Career et vos autres espaces.'}>
          <div className="space-y-5">
            {profileForm.bio ? <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{profileForm.bio}</p> : <Empty text="Ajoutez une présentation professionnelle dans l’onglet Professionnel." />}
            <InfoGrid values={[
              ['Localisation', [profileForm.city, userForm.country_code].filter(Boolean).join(', ')],
              ['Disponibilité', profileForm.availability_text], ['Langues', profileForm.languages.join(', ')], ['Compétences', profileForm.skills.join(', ')],
            ]} />
          </div>
        </Section>
        <div className="space-y-6">
          <Section title="Accès rapides" icon={Settings}>
            <div className="space-y-2">
              <QuickLink to={getDashboardPathForRoles(roles)} icon={User} label="Retour à mon Dashboard" />
              <QuickLink to="/mon-profil?tab=securite#gestion-compte" icon={Shield} label="Gérer la suspension ou la suppression du compte" />
              {isLearner && <><QuickLink to="/dashboard/skills-passport" icon={Award} label="Skills Passport" /><QuickLink to="/dashboard/learning-record" icon={BookOpen} label="Learning Record" /></>}
              {isStructure && <QuickLink to="/structure/profil" icon={Users} label="Profil public de la structure" />}
              {isProfessor && <QuickLink to="/professeur/dossier-professionnel" icon={Shield} label="Dossier professeur et signature" />}
              {isOrganizer && <QuickLink to="/omnia-live/profil-organisateur" icon={Shield} label="Dossier organisateur Omnia Live" />}
            </div>
          </Section>
          <Section title={isAdministration ? 'Protection du compte' : 'Confidentialité actuelle'} icon={Eye}>
            {isAdministration ? <p className="text-sm text-slate-600">Ce compte ne possède aucune page publique et n’apparaît dans aucun annuaire de la plateforme.</p> : <>
              <p className="text-sm text-slate-600">Visibilité : <strong className="text-[#002050]">{profileForm.visibility === 'public' ? 'Tout le monde' : profileForm.visibility === 'members' ? 'Membres connectés' : 'Privé'}</strong></p>
              <p className="mt-2 text-xs text-slate-500">Les coordonnées privées ne sont jamais affichées sauf si vous activez explicitement leur visibilité.</p>
            </>}
          </Section>
        </div>
      </div>}

      {tab === 'identite' && <Section title="Informations personnelles" icon={User} description="Ces données servent à votre compte. Les coordonnées publiques sont contrôlées séparément.">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Nom complet" icon={User}><input className={inputClass} value={userForm.full_name} onChange={e => setUserForm(v => ({ ...v, full_name: e.target.value }))} /></Field>
          <Field label="Nom d’affichage" icon={User}><input className={inputClass} value={profileForm.display_name} onChange={e => setProfileForm(v => ({ ...v, display_name: e.target.value }))} /></Field>
          <Field label="E-mail du compte" icon={Mail}><input type="email" className={inputClass} value={userForm.email} onChange={e => setUserForm(v => ({ ...v, email: e.target.value }))} /></Field>
          <Field label="Téléphone privé" icon={Phone}><input type="tel" className={inputClass} value={userForm.phone_number} onChange={e => setUserForm(v => ({ ...v, phone_number: e.target.value }))} /></Field>
          <Field label="Date de naissance" icon={User}><input type="date" className={inputClass} value={userForm.birth_date} onChange={e => setUserForm(v => ({ ...v, birth_date: e.target.value }))} /></Field>
          <Field label="Pays (code ISO)" icon={Globe}><input className={inputClass} value={userForm.country_code} maxLength={10} onChange={e => setUserForm(v => ({ ...v, country_code: e.target.value.toUpperCase() }))} /></Field>
          <Field label="Ville" icon={MapPin}><input className={inputClass} value={profileForm.city} onChange={e => setProfileForm(v => ({ ...v, city: e.target.value }))} /></Field>
          <Field label="Langues" icon={Languages}><TagEditor values={profileForm.languages} onChange={languages => setProfileForm(v => ({ ...v, languages }))} placeholder="Français, Bambara, Anglais..." /></Field>
          <Field label="E-mail public facultatif" icon={Mail}><input type="email" className={inputClass} value={profileForm.public_email} onChange={e => setProfileForm(v => ({ ...v, public_email: e.target.value }))} /></Field>
          <Field label="Téléphone public facultatif" icon={Phone}><input type="tel" className={inputClass} value={profileForm.public_phone} onChange={e => setProfileForm(v => ({ ...v, public_phone: e.target.value }))} /></Field>
        </div>
        <SaveButton saving={saving} onClick={() => void save('identity')} />
      </Section>}

      {!isAdministration && tab === 'professionnel' && <div className="space-y-6">
        <Section title="Présentation professionnelle" icon={Briefcase} description="Une seule présentation synchronisée avec Career, Talent, Skills Passport et les espaces compatibles.">
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Titre ou accroche" icon={Briefcase} wide><input className={inputClass} value={profileForm.headline} onChange={e => setProfileForm(v => ({ ...v, headline: e.target.value }))} placeholder="Ex. Analyste data, Formateur en gestion, Recruteur..." /></Field>
            <Field label="Biographie" icon={User} wide><textarea rows={6} className={inputClass} value={profileForm.bio} onChange={e => setProfileForm(v => ({ ...v, bio: e.target.value }))} placeholder="Présentez votre parcours, vos objectifs et vos domaines de contribution." /></Field>
            <Field label="Compétences" icon={Award}><TagEditor values={profileForm.skills} onChange={skills => setProfileForm(v => ({ ...v, skills }))} placeholder="Gestion de projet, Excel, Formation..." /></Field>
            <Field label="Centres d’intérêt" icon={Users}><TagEditor values={profileForm.interests} onChange={interests => setProfileForm(v => ({ ...v, interests }))} placeholder="Entrepreneuriat, numérique, finance..." /></Field>
            <Field label="Disponibilité" icon={Briefcase}><input className={inputClass} value={profileForm.availability_text} onChange={e => setProfileForm(v => ({ ...v, availability_text: e.target.value }))} placeholder="Disponible immédiatement, soirs et week-ends..." /></Field>
            <Field label="Site web" icon={Globe}><input type="url" className={inputClass} value={profileForm.website_url} onChange={e => setProfileForm(v => ({ ...v, website_url: e.target.value }))} placeholder="https://" /></Field>
            <Field label="LinkedIn" icon={LinkIcon}><input type="url" className={inputClass} value={profileForm.linkedin_url} onChange={e => setProfileForm(v => ({ ...v, linkedin_url: e.target.value }))} placeholder="https://linkedin.com/in/..." /></Field>
            <Field label="Portfolio" icon={LinkIcon}><input type="url" className={inputClass} value={profileForm.portfolio_url} onChange={e => setProfileForm(v => ({ ...v, portfolio_url: e.target.value }))} placeholder="https://" /></Field>
            <Field label="GitHub" icon={LinkIcon}><input type="url" className={inputClass} value={profileForm.github_url} onChange={e => setProfileForm(v => ({ ...v, github_url: e.target.value }))} placeholder="https://github.com/..." /></Field>
          </div>
        </Section>

        {isLearner && <Section title="Parcours apprenant" icon={BookOpen}><div className="grid gap-5 md:grid-cols-2">
          <TextInput label="Niveau d’étude" value={roleForm.education_level} onChange={education_level => setRoleForm(v => ({ ...v, education_level }))} />
          <TextInput label="Domaine d’étude" value={roleForm.field_of_study} onChange={field_of_study => setRoleForm(v => ({ ...v, field_of_study }))} />
          <TextArea label="Objectif professionnel" value={roleForm.career_goal} onChange={career_goal => setRoleForm(v => ({ ...v, career_goal }))} wide />
          <TagField label="Postes recherchés" values={roleForm.target_roles} onChange={target_roles => setRoleForm(v => ({ ...v, target_roles }))} />
          <TagField label="Secteurs ciblés" values={roleForm.target_sectors} onChange={target_sectors => setRoleForm(v => ({ ...v, target_sectors }))} />
          <TagField label="Types de contrat" values={roleForm.contract_preferences} onChange={contract_preferences => setRoleForm(v => ({ ...v, contract_preferences }))} />
        </div></Section>}

        {isProfessor && <Section title="Profil professeur" icon={BookOpen}><div className="grid gap-5 md:grid-cols-2">
          <TextInput label="Domaine d’expertise" value={roleForm.expertise_domain} onChange={expertise_domain => setRoleForm(v => ({ ...v, expertise_domain }))} />
          <TextInput label="Années d’expérience" value={roleForm.years_experience} onChange={years_experience => setRoleForm(v => ({ ...v, years_experience }))} />
          <TagField label="Langues d’enseignement" values={roleForm.teaching_languages} onChange={teaching_languages => setRoleForm(v => ({ ...v, teaching_languages }))} />
          <TagField label="Diplômes et qualifications" values={roleForm.qualifications} onChange={qualifications => setRoleForm(v => ({ ...v, qualifications }))} />
          <TagField label="Formats d’enseignement" values={roleForm.teaching_formats} onChange={teaching_formats => setRoleForm(v => ({ ...v, teaching_formats }))} />
        </div></Section>}

        {isOrganizer && <Section title="Profil organisateur Omnia Live" icon={Users}><div className="grid gap-5 md:grid-cols-2">
          <TextInput label="Type d’organisateur" value={roleForm.organizer_type} onChange={organizer_type => setRoleForm(v => ({ ...v, organizer_type }))} />
          <TextInput label="Organisation représentée" value={roleForm.organization_name} onChange={organization_name => setRoleForm(v => ({ ...v, organization_name }))} />
          <TagField label="Thématiques d’événements" values={roleForm.event_topics} onChange={event_topics => setRoleForm(v => ({ ...v, event_topics }))} />
          <TextArea label="Expérience d’organisation" value={roleForm.experience_summary} onChange={experience_summary => setRoleForm(v => ({ ...v, experience_summary }))} wide />
        </div></Section>}

        {isModerator && <Section title="Profil Modérateur" icon={Shield} description="Vos permissions et journaux administratifs restent privés."><TagField label="Domaines de modération" values={roleForm.moderation_domains} onChange={moderation_domains => setRoleForm(v => ({ ...v, moderation_domains }))} /></Section>}
        {isRecruiter && <Section title="Profil recruteur" icon={Users}><div className="grid gap-5 md:grid-cols-2">
          <TextInput label="Organisation" value={roleForm.organization_name} onChange={organization_name => setRoleForm(v => ({ ...v, organization_name }))} />
          <TagField label="Secteurs de recrutement" values={roleForm.recruitment_sectors} onChange={recruitment_sectors => setRoleForm(v => ({ ...v, recruitment_sectors }))} />
          <TagField label="Pays de recrutement" values={roleForm.recruitment_countries} onChange={recruitment_countries => setRoleForm(v => ({ ...v, recruitment_countries }))} />
        </div></Section>}
        {isCoach && <Section title="Profil Coach" icon={Users}><div className="grid gap-5 md:grid-cols-2">
          <TagField label="Thématiques de coaching" values={roleForm.coaching_topics} onChange={coaching_topics => setRoleForm(v => ({ ...v, coaching_topics }))} />
          <TagField label="Langues de session" values={roleForm.session_languages} onChange={session_languages => setRoleForm(v => ({ ...v, session_languages }))} />
        </div></Section>}
        {isStructure && bundle.structure && <Section title="Structure associée" icon={Users} description="Votre profil personnel reste distinct du profil institutionnel."><InfoGrid values={[
          ['Nom', asText(bundle.structure.org_name)], ['Type', asText(bundle.structure.org_type)], ['Pays', asText(bundle.structure.country)], ['Ville', asText(bundle.structure.city)],
        ]} /><Link to="/structure/profil" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#002050]">Gérer le profil institutionnel <ExternalLink size={15} /></Link></Section>}
        <SaveButton saving={saving} onClick={() => void save('professional')} label="Synchroniser le profil professionnel" />
      </div>}

      {!isAdministration && tab === 'visibilite' && <div className="space-y-6">
        <Section title="Accès au profil" icon={Eye} description="Définissez d’abord qui peut ouvrir votre page publique.">
          <label className={labelClass}>Qui peut voir votre profil ?<select className={inputClass} value={profileForm.visibility} onChange={e => setProfileForm(v => ({ ...v, visibility: e.target.value as ProfileForm['visibility'] }))}><option value="public">Tout le monde, même sans connexion</option><option value="members">Uniquement les membres Omnia connectés</option><option value="private">Uniquement moi et l’équipe chargée de la sécurité</option></select></label>
          <div className="mt-4 rounded-2xl border border-[#002050]/10 bg-[#002050]/[0.03] p-4 text-sm leading-6 text-slate-600">La page publique utilise exactement ces réglages. Masquer un champ ne le supprime pas de votre compte.</div>
        </Section>

        <VisibilityGroup
          title="Identité publique"
          description="Choisissez séparément les informations d’identité visibles."
          items={IDENTITY_VISIBILITY_ITEMS}
          values={profileForm.field_visibility}
          onChange={(field, checked) => setProfileForm(value => ({ ...value, field_visibility: { ...value.field_visibility, [field]: checked } }))}
        />

        <VisibilityGroup
          title="Présentation professionnelle"
          description="Contrôlez chaque élément affiché dans le profil et les résultats Omnia Talent."
          items={PROFESSIONAL_VISIBILITY_ITEMS}
          values={profileForm.field_visibility}
          onChange={(field, checked) => setProfileForm(value => ({ ...value, field_visibility: { ...value.field_visibility, [field]: checked } }))}
        />

        {roleVisibilityItems.length > 0 && <VisibilityGroup
          title="Informations liées à vos rôles"
          description="Les réglages sont communs à votre page publique, quel que soit l’espace depuis lequel elle est ouverte."
          items={roleVisibilityItems}
          values={profileForm.field_visibility}
          onChange={(field, checked) => setProfileForm(value => ({ ...value, field_visibility: { ...value.field_visibility, [field]: checked } }))}
        />}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-600">Vérifiez le rendu exact avant d’enregistrer.</p>
          {bundle && <Link to={`/profil/${bundle.user.id}`} className="inline-flex items-center gap-2 rounded-xl border border-[#002050]/15 px-4 py-2.5 text-sm font-bold text-[#002050]"><ExternalLink size={16} /> Voir mon profil public</Link>}
        </div>
        <SaveButton saving={saving} onClick={() => void save('privacy')} label="Enregistrer la confidentialité" />
      </div>}

      {tab === 'notifications' && <div className="space-y-6">
        <Section title="Préférences de langue" icon={Languages} description="La langue s’applique immédiatement à l’ensemble de la plateforme.">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(280px,420px)] md:items-center">
            <div>
              <p className="text-sm leading-6 text-slate-600">Choisissez la langue de l’interface pour tous vos rôles et tous vos espaces Omnia.</p>
              <p className="mt-2 text-xs leading-5 text-slate-500">Les contenus créés par les utilisateurs conservent leur langue d’origine.</p>
            </div>
            <label className={labelClass}>Langue de la plateforme
              <select
                className={inputClass}
                value={language}
                onChange={event => setLanguage(event.target.value as typeof language)}
              >
                {PLATFORM_LANGUAGES.map(option => (
                  <option key={option.code} value={option.code} dir={option.direction}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>
        </Section>

        <Section title="Préférences de communication" icon={Bell} description="Ces préférences s’appliquent à votre compte, quel que soit le rôle utilisé.">
          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200">{([
            ['allow_email', 'Notifications par e-mail', 'Informations importantes, inscriptions et activités.'],
            ['allow_sms', 'Notifications par SMS', 'Uniquement lorsque le canal SMS est disponible.'],
            ['allow_push', 'Notifications push', 'Alertes mobiles et web autorisées.'],
            ['subscribe_newsletter', 'Omnia Newsletter', 'Actualités, programmes et opportunités.'],
          ] as Array<['allow_email' | 'allow_sms' | 'allow_push' | 'subscribe_newsletter', string, string]>).map(([key, title, description]) => <ToggleRow key={key} title={title} description={description} checked={Boolean(bundle.user[key])} onChange={checked => setBundle(current => current ? { ...current, user: { ...current.user, [key]: checked } } : current)} />)}</div>
          <SaveButton saving={saving} onClick={() => void save('notifications')} label="Enregistrer les notifications" />
        </Section>
      </div>}

      {tab === 'securite' && <div className="space-y-6">
        <Section title="Mot de passe" icon={Lock} description="La modification révoque les anciennes sessions pour protéger votre compte.">
          <div className="grid gap-5 md:grid-cols-3">{[
            ['current', 'Mot de passe actuel'], ['next', 'Nouveau mot de passe'], ['confirm', 'Confirmer le mot de passe'],
          ].map(([key, label]) => <label key={key} className={labelClass}>{label}<div className="relative"><input type={showPasswords ? 'text' : 'password'} className={`${inputClass} pr-11`} value={password[key as keyof typeof password]} onChange={e => setPassword(v => ({ ...v, [key]: e.target.value }))} />{key === 'confirm' && <button type="button" onClick={() => setShowPasswords(v => !v)} className="absolute right-3 top-1/2 mt-0.5 -translate-y-1/2 text-slate-400" aria-label="Afficher ou masquer les mots de passe">{showPasswords ? <EyeOff size={17} /> : <Eye size={17} />}</button>}</div></label>)}</div>
          <SaveButton saving={passwordSaving} onClick={() => void savePassword()} label="Changer le mot de passe" />
        </Section>
        <Section title="Membres bloqués" icon={Shield} description="Vous pouvez débloquer les membres que vous aviez masqués dans les espaces communautaires.">
          {blockedLoading ? <p className="text-sm text-slate-500">Chargement...</p> : blocked.length ? <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200">{blocked.map(item => <div key={item.user_id} className="flex items-center justify-between gap-4 p-4"><div><p className="font-bold text-[#002050]">{item.full_name}</p><p className="text-xs text-slate-500">{item.reason || 'Aucun motif enregistré'}</p></div><button type="button" onClick={() => void unblock(item.user_id)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-[#002050]">Débloquer</button></div>)}</div> : <Empty text="Aucun membre bloqué." />}
        </Section>
        <section id="gestion-compte" className="space-y-6 scroll-mt-24">
          <Section title="Conséquences selon vos rôles" icon={AlertTriangle} description="Prenez connaissance des effets avant de suspendre ou supprimer votre compte.">
            <ul className="space-y-2 text-sm leading-6 text-slate-600">{accountImpacts.map(item => <li key={item} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-[#BF8813]" /><span>{item}</span></li>)}</ul>
          </Section>

          <Section title="Suspendre temporairement mon compte" icon={Shield} description="Une pause réversible : toutes vos sessions sont fermées immédiatement et vous pourrez réactiver le compte avec votre mot de passe.">
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">La suspension ne supprime pas vos données. Votre profil public devient temporairement indisponible. Une suspension décidée par l’équipe Omnia ne peut pas être réactivée automatiquement.</div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className={labelClass}>Motif de la pause<select className={inputClass} value={suspensionForm.reasonCode} onChange={e => setSuspensionForm(v => ({ ...v, reasonCode: e.target.value }))}><option value="">Sélectionner un motif</option>{SUSPENSION_REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className={labelClass}>Retour prévu — facultatif<select className={inputClass} value={suspensionForm.duration} onChange={e => setSuspensionForm(v => ({ ...v, duration: e.target.value }))}><option value="">Aucune date prévue</option><option value="7">Dans 7 jours</option><option value="14">Dans 14 jours</option><option value="30">Dans 30 jours</option><option value="custom">Choisir une date</option></select></label>
              {suspensionForm.duration === 'custom' && <label className={`${labelClass} md:col-span-2`}>Date de retour prévue<input type="date" min={new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)} className={inputClass} value={suspensionForm.customDate} onChange={e => setSuspensionForm(v => ({ ...v, customDate: e.target.value }))} /></label>}
              <AccountFeedbackFields value={suspensionForm} onChange={patch => setSuspensionForm(v => ({ ...v, ...patch }))} />
              <label className={labelClass}>Mot de passe actuel<input type="password" autoComplete="current-password" className={inputClass} value={suspensionForm.currentPassword} onChange={e => setSuspensionForm(v => ({ ...v, currentPassword: e.target.value }))} /></label>
              <label className={labelClass}>Écrivez SUSPENDRE<input className={inputClass} value={suspensionForm.confirmation} onChange={e => setSuspensionForm(v => ({ ...v, confirmation: e.target.value.toUpperCase() }))} /></label>
            </div>
            <label className="mt-4 flex items-start gap-3 text-sm leading-6 text-slate-700"><input type="checkbox" className="mt-1" checked={suspensionForm.accepted} onChange={e => setSuspensionForm(v => ({ ...v, accepted: e.target.checked }))} /><span>Je comprends que je serai immédiatement déconnecté et que mes espaces seront inaccessibles jusqu’à ma réactivation.</span></label>
            <button type="button" disabled={suspensionSaving || !suspensionForm.accepted || suspensionForm.confirmation !== 'SUSPENDRE' || !suspensionForm.currentPassword || !suspensionForm.reasonCode} onClick={() => void suspendAccount()} className="mt-5 w-full rounded-xl bg-[#002050] px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{suspensionSaving ? 'Suspension en cours...' : 'Suspendre mon compte'}</button>
          </Section>

          <Section title="Supprimer définitivement mon compte" icon={Trash2} description="Action irréversible soumise à une confirmation forte. Les données légalement nécessaires sont seulement conservées sous une forme pseudonymisée.">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900">Avant de supprimer, vous pouvez choisir la suspension temporaire ci-dessus. La suppression ferme tous les accès et ne peut pas être annulée. <Link to="/supprimer-compte" className="font-bold underline">Lire la politique détaillée</Link>.</div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className={`${labelClass} md:col-span-2`}>Motif de la suppression<select className={inputClass} value={deletionForm.reasonCode} onChange={e => setDeletionForm(v => ({ ...v, reasonCode: e.target.value }))}><option value="">Sélectionner un motif</option>{DELETION_REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <AccountFeedbackFields value={deletionForm} onChange={patch => setDeletionForm(v => ({ ...v, ...patch }))} />
              <label className={labelClass}>Mot de passe actuel<input type="password" autoComplete="current-password" className={inputClass} value={deletionForm.currentPassword} onChange={e => setDeletionForm(v => ({ ...v, currentPassword: e.target.value }))} /></label>
              <label className={labelClass}>Écrivez SUPPRIMER<input className={inputClass} value={deletionForm.confirmation} onChange={e => setDeletionForm(v => ({ ...v, confirmation: e.target.value.toUpperCase() }))} /></label>
            </div>
            <label className="mt-4 flex items-start gap-3 text-sm leading-6 text-red-900"><input type="checkbox" className="mt-1" checked={deletionForm.accepted} onChange={e => setDeletionForm(v => ({ ...v, accepted: e.target.checked }))} /><span>Je comprends que la suppression est définitive et que mes profils, accès et données personnelles supprimables ne pourront pas être restaurés.</span></label>
            <button type="button" disabled={deletionSaving || !deletionForm.accepted || deletionForm.confirmation !== 'SUPPRIMER' || !deletionForm.currentPassword || !deletionForm.reasonCode} onClick={() => void deleteAccount()} className="mt-5 w-full rounded-xl bg-red-700 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{deletionSaving ? 'Suppression en cours...' : 'Supprimer définitivement mon compte'}</button>
          </Section>
        </section>
      </div>}
    </div>
  </ProfileRoleLayout>;
}

function AccountFeedbackFields({ value, onChange }: { value: ExitFeedbackForm; onChange: (patch: Partial<ExitFeedbackForm>) => void }) {
  return <>
    <p className="md:col-span-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">Ces réponses sont facultatives et servent uniquement à améliorer Omnia. N’indiquez aucun mot de passe, code, numéro de carte, adresse e-mail ou numéro de téléphone.</p>
    <label className={`${labelClass} md:col-span-2`}>Que pourrions-nous améliorer ? — facultatif<textarea rows={3} maxLength={1200} className={inputClass} value={value.improvement_feedback} onChange={e => onChange({ improvement_feedback: e.target.value })} /></label>
    <label className={labelClass}>Quelle fonctionnalité vous manque ? — facultatif<input maxLength={600} className={inputClass} value={value.missing_feature} onChange={e => onChange({ missing_feature: e.target.value })} /></label>
    <label className={labelClass}>Qu’est-ce qui vous ferait revenir ? — facultatif<input maxLength={600} className={inputClass} value={value.return_condition} onChange={e => onChange({ return_condition: e.target.value })} /></label>
  </>;
}

function Section({ title, icon: Icon, description, children }: { title: string; icon: ElementType; description?: string; children: ReactNode }) {
  return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="mb-5 flex items-start gap-3"><div className="rounded-xl p-2.5" style={{ background: ROLE_SOFT, color: ROLE_CONTROL_ACCENT }}><Icon size={20} /></div><div><h2 className="text-lg font-black text-[#002050]">{title}</h2>{description && <p className="mt-1 text-sm text-slate-500">{description}</p>}</div></div>{children}</section>;
}
function Field({ label, icon: Icon, wide, children }: { label: string; icon: ElementType; wide?: boolean; children: ReactNode }) { return <label className={`${labelClass} ${wide ? 'md:col-span-2' : ''}`}><span className="inline-flex items-center gap-2"><Icon size={15} />{label}</span>{children}</label>; }
function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className={labelClass}>{label}<input className={inputClass} value={value} onChange={e => onChange(e.target.value)} /></label>; }
function TextArea({ label, value, onChange, wide }: { label: string; value: string; onChange: (value: string) => void; wide?: boolean }) { return <label className={`${labelClass} ${wide ? 'md:col-span-2' : ''}`}>{label}<textarea rows={4} className={inputClass} value={value} onChange={e => onChange(e.target.value)} /></label>; }
function TagField({ label, values, onChange }: { label: string; values: string[]; onChange: (values: string[]) => void }) { return <label className={labelClass}>{label}<TagEditor values={values} onChange={onChange} /></label>; }
function TagEditor({ values, onChange, placeholder = 'Saisissez puis appuyez sur Entrée' }: { values: string[]; onChange: (values: string[]) => void; placeholder?: string }) {
  const [value, setValue] = useState('');
  function add() { const items = value.split(',').map(item => item.trim()).filter(Boolean); if (!items.length) return; onChange([...new Set([...values, ...items])]); setValue(''); }
  return <div className="mt-1 rounded-xl border border-slate-200 bg-white p-2 focus-within:border-[#BF8813] focus-within:ring-2 focus-within:ring-[#BF8813]/15"><div className="flex flex-wrap gap-1.5">{values.map(item => <button key={item} type="button" onClick={() => onChange(values.filter(valueItem => valueItem !== item))} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-[#002050]" title="Cliquer pour retirer">{item} ×</button>)}</div><div className="flex items-center gap-2"><input value={value} onChange={e => setValue(e.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); add(); } }} onBlur={add} className="min-w-0 flex-1 border-0 bg-transparent px-1 py-2 text-sm outline-none" placeholder={placeholder} /><button type="button" onClick={add} className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-white" style={{ background: ROLE_SECONDARY }}>Ajouter</button></div></div>;
}
function VisibilityGroup({ title, description, items, values, onChange }: {
  title: string;
  description: string;
  items: VisibilityItem[];
  values: ProfileFieldVisibility;
  onChange: (field: ProfileVisibleField, checked: boolean) => void;
}) {
  return <Section title={title} icon={Eye} description={description}>
    <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
      {items.map(item => <ToggleRow
        key={item.field}
        title={item.title}
        description={item.description}
        checked={values[item.field] !== false}
        onChange={checked => onChange(item.field, checked)}
      />)}
    </div>
  </Section>;
}
function ToggleRow({ title, description, checked, onChange }: { title: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) { return <label className="flex cursor-pointer items-center justify-between gap-5 p-4"><span><span className="block text-sm font-bold text-[#002050]">{title}</span><span className="mt-0.5 block text-xs text-slate-500">{description}</span></span><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="h-5 w-5" style={{ accentColor: ROLE_CONTROL_ACCENT }} /></label>; }
function SaveButton({ saving, onClick, label = 'Enregistrer les modifications' }: { saving: boolean; onClick: () => void; label?: string }) { return <div className="mt-6 flex justify-end"><button type="button" disabled={saving} onClick={onClick} className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white disabled:opacity-50" style={{ background: ROLE_SECONDARY }}><Save size={16} />{saving ? 'Enregistrement...' : label}</button></div>; }
function Notice({ value }: { value: Message }) { if (!value) return null; return <div className={`flex items-start gap-2 rounded-2xl border p-4 text-sm ${value.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>{value.ok ? <CheckCircle className="mt-0.5 h-4 w-4 flex-none" /> : <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />}<span>{value.text}</span></div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">{text}</div>; }
function InfoGrid({ values }: { values: Array<[string, string]> }) { return <div className="grid gap-3 sm:grid-cols-2">{values.map(([label, value]) => <div key={label} className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 break-words text-sm font-semibold text-[#002050]">{value || 'Non renseigné'}</p></div>)}</div>; }
function QuickLink({ to, icon: Icon, label }: { to: string; icon: ElementType; label: string }) { return <Link to={to} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-bold text-[#002050] transition hover:border-[#BF8813]"><Icon size={17} /><span className="flex-1">{label}</span><ExternalLink size={14} /></Link>; }
