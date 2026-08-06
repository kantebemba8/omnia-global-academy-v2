import { edgeAuthHeaders } from './edgeAuth';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const ENDPOINT = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/coaching` : '/api/coaching';

const COACH_PREVIEW_SESSION_KEY = 'omnia_admin_role_preview';
const COACH_PREVIEW_READ_ACTIONS = new Set([
  'coach_dashboard',
  'coach_offers',
  'coach_availability',
  'coach_sessions',
  'coach_request_availability',
  'coach_ratings',
  'coach_revenue',
  'coach_advanced_products',
]);

export function isCoachPreviewMode(): boolean {
  if (typeof window === 'undefined') return false;
  const queryPreview = new URLSearchParams(window.location.search).get('preview') === 'true';
  const storedPreview = sessionStorage.getItem(COACH_PREVIEW_SESSION_KEY) === 'coach';
  let isSuperAdmin = false;
  try {
    isSuperAdmin = JSON.parse(localStorage.getItem('omnia_user') || '{}')?.roles?.includes('super_admin') ?? false;
  } catch { /* ignore invalid local storage */ }
  return isSuperAdmin && window.location.pathname.startsWith('/coach') && (queryPreview || storedPreview);
}

export function withCoachPreview(path: string): string {
  if (!isCoachPreviewMode()) return path;
  const [base, hash = ''] = path.split('#', 2);
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}preview=true${hash ? `#${hash}` : ''}`;
}

export type CoachingDomain = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  display_order?: number;
  is_active?: boolean;
};

export type CoachingLevel = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  commission_percent: number;
  minimum_price_xof: number;
  maximum_price_xof?: number | null;
  minimum_completed_sessions?: number;
  minimum_rating?: number | null;
  badge_label?: string | null;
  badge_color?: string | null;
  catalogue_priority?: number;
  is_featured?: boolean;
  is_active?: boolean;
};

export type CoachProfile = {
  id: string;
  user_id: string;
  public_slug: string;
  full_name: string;
  professional_title: string;
  biography: string;
  specialties: string[];
  languages: string[];
  country: string;
  timezone: string;
  photo_url?: string | null;
  linkedin_url?: string | null;
  website_url?: string | null;
  presentation_video_url?: string | null;
  preferred_session_modes: string[];
  price_30_xof?: number | null;
  price_60_xof?: number | null;
  price_90_xof?: number | null;
  custom_duration_enabled?: boolean;
  custom_hourly_price_xof?: number | null;
  status: 'active' | 'vacation' | 'suspended' | 'archived';
  is_featured?: boolean;
  average_rating?: number;
  rating_count?: number;
  completed_sessions_count?: number;
  badge_override?: string | null;
  level?: CoachingLevel | null;
  domains: CoachingDomain[];
  offers?: CoachOffer[];
  ratings?: CoachingRating[];
  groups?: CoachingGroupProgram[];
};

export type CoachOffer = {
  id: string;
  coach_id: string;
  domain_id?: string | null;
  supersedes_offer_id?: string | null;
  offer_type: 'fixed' | 'custom';
  title: string;
  description: string;
  duration_minutes?: number | null;
  price_xof?: number | null;
  hourly_price_xof?: number | null;
  custom_min_minutes?: number | null;
  custom_max_minutes?: number | null;
  custom_step_minutes?: number | null;
  session_modes: Array<'jitsi' | 'external'>;
  status: 'pending' | 'active' | 'rejected' | 'inactive' | 'archived';
  admin_message?: string | null;
  domain?: Pick<CoachingDomain, 'id' | 'slug' | 'name'> | null;
  coach?: { id: string; user_id: string; public_slug: string; professional_title: string; full_name: string } | null;
  created_at?: string;
  updated_at?: string;
};

export type CoachAvailabilityRule = {
  id: string;
  coach_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  timezone: string;
  valid_from: string;
  valid_until?: string | null;
  booking_notice_hours?: number | null;
  maximum_sessions_per_day?: number | null;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  is_active: boolean;
};

export type CoachAvailabilityException = {
  id: string;
  coach_id: string;
  exception_type: 'blocked' | 'available';
  starts_at: string;
  ends_at: string;
  reason?: string | null;
};

export type CoachingSlot = { slot_start: string; slot_end: string };


export type CoachingPaymentOrder = {
  id: string;
  order_number: string;
  session_id?: string | null;
  product_type?: 'session' | 'package' | 'subscription' | 'group';
  product_id?: string | null;
  product_snapshot?: Record<string, unknown>;
  amount_xof: number;
  currency: string;
  payment_status: 'pending' | 'paid' | 'failed' | 'cancelled' | 'partially_refunded' | 'refunded' | 'disputed';
  payment_provider: string;
  provider_transaction_id?: string | null;
  paid_at?: string | null;
  created_at: string;
};

export type CoachingInvoice = {
  id: string;
  invoice_number: string;
  order_id: string;
  session_id?: string | null;
  product_type?: 'session' | 'package' | 'subscription' | 'group';
  product_id?: string | null;
  issued_at: string;
  amount_xof: number;
  currency: string;
};

export type CoachingRefund = {
  id: string;
  order_id: string;
  session_id: string;
  initiated_by: 'learner' | 'coach' | 'admin' | 'system';
  requested_amount_xof: number;
  approved_amount_xof?: number | null;
  reason_code: string;
  reason_details?: string | null;
  status: 'pending' | 'under_review' | 'approved' | 'partially_approved' | 'rejected' | 'processed' | 'cancelled';
  decision_reason?: string | null;
  provider_refund_reference?: string | null;
  created_at: string;
};

export type CoachingRating = {
  id: string;
  session_id: string;
  learner_user_id?: string;
  coach_id?: string;
  learner_name?: string;
  overall_rating: number;
  communication_rating: number;
  expertise_rating: number;
  usefulness_rating: number;
  comment?: string | null;
  would_recommend: boolean;
  moderation_status?: 'published' | 'hidden' | 'removed';
  moderation_reason?: string | null;
  coach_response?: string | null;
  coach_responded_at?: string | null;
  created_at: string;
  verified_session?: boolean;
};

export type CoachingLearnerFeedback = {
  id: string;
  session_id: string;
  coach_id: string;
  learner_user_id: string;
  punctuality_rating: number;
  preparation_rating: number;
  exchange_quality_rating: number;
  internal_comment?: string | null;
  created_at: string;
};

export type CoachingDisputeMessage = {
  id: string;
  dispute_id: string;
  author_user_id?: string | null;
  author_role: 'learner' | 'coach' | 'admin' | 'system';
  visibility: 'participants' | 'admin_only';
  message: string;
  attachments: Array<{ storage_path: string; file_name?: string; mime_type?: string; size_bytes?: number; signed_url?: string | null }>;
  created_at: string;
};

export type CoachingDispute = {
  id: string;
  session_id: string;
  order_id?: string | null;
  coach_id: string;
  learner_user_id: string;
  opened_by_user_id: string;
  opened_by_role: 'learner' | 'coach' | 'admin';
  category: string;
  description: string;
  requested_resolution?: string | null;
  previous_session_status: string;
  status: 'open' | 'under_review' | 'awaiting_learner' | 'awaiting_coach' | 'resolved' | 'rejected' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  decision_code?: string | null;
  decision_reason?: string | null;
  approved_refund_xof?: number | null;
  created_at: string;
  decided_at?: string | null;
  session?: CoachingSession | null;
  coach?: { id: string; full_name: string; professional_title?: string; email?: string } | null;
  learner?: { id: string; full_name?: string; email?: string } | null;
  messages?: CoachingDisputeMessage[];
};

export type CoachingEarning = {
  id: string;
  order_id: string;
  session_id: string;
  coach_id: string;
  coach_user_id: string;
  gross_amount_xof: number;
  commission_amount_xof: number;
  net_amount_xof: number;
  refunded_gross_xof: number;
  refunded_net_xof: number;
  status: 'locked' | 'frozen' | 'available' | 'reversed';
  unlock_at?: string | null;
  frozen_reason?: string | null;
  credited_at?: string | null;
  session?: Pick<CoachingSession, 'id' | 'offer_title_snapshot' | 'scheduled_start' | 'status'> | null;
  order?: Pick<CoachingPaymentOrder, 'id' | 'order_number' | 'payment_status'> | null;
  coach_user?: { id: string; full_name?: string; email?: string } | null;
};

export type CoachingAdvancedEarning = {
  id: string;
  order_id: string;
  source_type: 'package' | 'group';
  source_id: string;
  coach_id: string;
  coach_user_id: string;
  gross_amount_xof: number;
  commission_amount_xof: number;
  net_amount_xof: number;
  status: 'locked' | 'frozen' | 'available' | 'reversed';
  unlock_at?: string | null;
  credited_at?: string | null;
  order?: Pick<CoachingPaymentOrder, 'id' | 'order_number' | 'payment_status' | 'product_type' | 'product_id'> & { offer_title_snapshot?: string } | null;
  coach_user?: { id: string; full_name?: string; email?: string } | null;
};

export type CoachingSession = {
  id: string;
  learner_user_id: string;
  coach_id: string;
  offer_id?: string | null;
  session_type: 'fixed' | 'custom';
  status: string;
  payment_status: string;
  meeting_mode: 'jitsi' | 'external';
  requested_start?: string | null;
  requested_end?: string | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  duration_minutes: number;
  hold_expires_at?: string | null;
  learner_message?: string | null;
  coach_response_message?: string | null;
  price_total_xof: number;
  commission_percent_snapshot: number;
  commission_amount_xof: number;
  coach_net_xof: number;
  offer_title_snapshot: string;
  coach_name_snapshot: string;
  coach_timezone_snapshot: string;
  external_meeting_url?: string | null;
  external_link_updated_at?: string | null;
  actual_started_at?: string | null;
  actual_ended_at?: string | null;
  coach_joined_at?: string | null;
  learner_joined_at?: string | null;
  completion_source?: 'coach' | 'admin' | 'system' | null;
  no_show_marked_at?: string | null;
  created_at: string;
  updated_at: string;
  coach?: { id: string; public_slug: string; photo_url?: string | null; professional_title: string; full_name: string } | null;
  learner?: { id: string; full_name?: string; email?: string } | null;
  order?: CoachingPaymentOrder | null;
  invoice?: CoachingInvoice | null;
  refund?: CoachingRefund | null;
};

export type CoachingRoom = {
  id: string;
  session_id: string;
  provider: string;
  provider_room_id: string;
  room_slug: string;
  status: 'ready' | 'open' | 'live' | 'ended';
  provider_join_url: string;
  provider_host_url: string;
  starts_at?: string | null;
  ends_at?: string | null;
};

export type CoachingAttendance = {
  user_id: string;
  participant_role: 'coach' | 'learner' | 'admin_supervisor';
  duration_seconds: number;
  first_joined_at?: string | null;
  last_left_at?: string | null;
};

export type CoachingSessionRoomAccess = {
  session: CoachingSession;
  role: 'coach' | 'learner' | 'admin_supervisor';
  access_status: 'too_early' | 'available' | 'closed';
  opens_at: string;
  closes_at: string;
  room?: CoachingRoom | null;
  attendance: CoachingAttendance[];
  external_link_visible?: boolean;
};

export type CoachApplication = {
  id: string;
  user_id: string;
  status: 'draft' | 'pending' | 'under_review' | 'changes_requested' | 'approved' | 'rejected' | 'suspended' | 'archived';
  full_name: string;
  professional_title: string;
  country: string;
  timezone: string;
  biography: string;
  specialties: string[];
  languages: string[];
  experience_summary: string;
  motivation: string;
  linkedin_url?: string | null;
  website_url?: string | null;
  presentation_video_url?: string | null;
  professional_references?: string | null;
  photo_url?: string | null;
  preferred_session_modes: string[];
  price_30_xof?: number | null;
  price_60_xof?: number | null;
  price_90_xof?: number | null;
  custom_duration_enabled?: boolean;
  custom_hourly_price_xof?: number | null;
  admin_message?: string | null;
  rejection_reason?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  domains: CoachingDomain[];
  documents?: Array<Record<string, unknown> & { signed_url?: string | null }>;
  user?: { full_name?: string; email?: string; phone_number?: string } | null;
  approved_level?: CoachingLevel | null;
};


export type LearnerCoachingPreferences = {
  user_id?: string;
  domain_ids: string[];
  languages: string[];
  goals: string[];
  budget_min_xof: number;
  budget_max_xof?: number | null;
  meeting_modes: Array<'jitsi' | 'external'>;
  preferred_formats: Array<'individual' | 'group'>;
};

export type CoachingGroupProgram = {
  id: string;
  coach_id: string;
  domain_id?: string | null;
  title: string;
  description: string;
  scheduled_start: string;
  scheduled_end: string;
  capacity: number;
  confirmed_count?: number;
  price_per_participant_xof: number;
  meeting_mode: 'jitsi' | 'external';
  external_meeting_url?: string | null;
  room_slug?: string | null;
  status: string;
  admin_message?: string | null;
  coach?: Partial<CoachProfile> | null;
  domain?: Pick<CoachingDomain, 'id' | 'slug' | 'name'> | null;
};

export type CoachingGroupRegistration = {
  id: string;
  program_id: string;
  user_id: string;
  order_id?: string | null;
  status: string;
  hold_expires_at?: string | null;
  amount_xof: number;
  program?: CoachingGroupProgram | null;
};

export type CoachingActionItem = {
  id: string;
  plan_id: string;
  title: string;
  description?: string;
  due_date?: string | null;
  status: 'todo' | 'in_progress' | 'done' | 'skipped';
  position: number;
  completed_at?: string | null;
};

export type CoachingActionPlan = {
  id: string;
  session_id: string;
  coach_id: string;
  learner_user_id: string;
  title: string;
  summary: string;
  next_session_recommendation?: string | null;
  status: 'active' | 'completed' | 'archived';
  learner_visible: boolean;
  items?: CoachingActionItem[];
  updated_at?: string;
};

export type CoachingRecording = {
  id: string;
  session_id: string;
  status: 'consent_pending' | 'starting' | 'recording' | 'processing' | 'ready' | 'failed' | 'cancelled' | 'deleted';
  file_name?: string | null;
  duration_seconds?: number | null;
  size_bytes?: number | null;
  retention_expires_at?: string | null;
  error_message?: string | null;
};

export type CoachingRecommendation = {
  coach: CoachProfile;
  score: number;
  reasons: string[];
  minimum_price_xof?: number | null;
};


const messages: Record<string, string> = {
  SESSION_INVALID: 'Votre session a expiré. Veuillez vous reconnecter.',
  FORBIDDEN: 'Vous ne disposez pas des droits nécessaires.',
  APPLICATION_INCOMPLETE: 'Complétez tous les champs obligatoires avant l’envoi.',
  APPLICATION_ALREADY_ACTIVE: 'Une candidature active existe déjà pour ce compte.',
  INVALID_URL: 'Un des liens saisis est invalide.',
  INVALID_DOMAIN: 'Un domaine sélectionné n’est plus disponible.',
  DOCUMENT_REQUIRED: 'Ajoutez au moins un diplôme, certificat ou justificatif professionnel.',
  FILE_TYPE_NOT_ALLOWED: 'Ce type de fichier n’est pas autorisé.',
  FILE_TOO_LARGE: 'Le fichier dépasse la taille autorisée.',
  APPLICATION_PRICE_OUT_OF_RANGE: 'Un tarif proposé est hors de la fourchette autorisée.',
  REVIEW_MESSAGE_REQUIRED: 'Un motif est requis pour cette décision.',
  SUSPENSION_REASON_REQUIRED: 'Le motif de suspension est requis.',
  COACH_NOT_FOUND: 'Ce profil coach est introuvable.',
  OFFER_NOT_FOUND: 'Cette offre de coaching est introuvable.',
  OFFER_INCOMPLETE: 'Complétez correctement les informations de l’offre.',
  OFFER_PRICE_OUT_OF_RANGE: 'Le tarif doit respecter la fourchette autorisée pour votre niveau.',
  OFFER_NOT_APPROVED: 'Cette offre doit d’abord être validée par l’Administration Omnia.',
  INVALID_SESSION_MODE: 'Ce format de rencontre n’est pas autorisé pour cette offre.',
  INVALID_AVAILABILITY: 'Le créneau de disponibilité saisi est invalide.',
  INVALID_AVAILABILITY_RANGE: 'La période demandée pour le calendrier est invalide.',
  INVALID_DURATION: 'La durée choisie n’est pas autorisée pour cette offre.',
  SLOT_UNAVAILABLE: 'Ce créneau vient d’être réservé ou n’est plus disponible.',
  BOOKING_INCOMPLETE: 'Choisissez une offre, un créneau et un format de session.',
  BOOKING_NOT_FOUND: 'Cette demande de coaching est introuvable.',
  BOOKING_CANNOT_CANCEL: 'Cette réservation ne peut plus être annulée depuis cet écran.',
  PAYMENT_NOT_ALLOWED: 'Cette session ne peut pas être payée dans son état actuel.',
  PAYMENT_HOLD_EXPIRED: 'Le délai de paiement a expiré et le créneau a été libéré.',
  PAYMENT_CONFIGURATION_MISSING: 'Le paiement FedaPay n’est pas configuré.',
  INVALID_FINANCE_SETTINGS: 'Les paramètres financiers saisis sont invalides.',
  PAYMENT_INIT_FAILED: 'Le paiement FedaPay n’a pas pu être initialisé.',
  PAYMENT_LINK_FAILED: 'Le lien de paiement FedaPay n’a pas pu être généré.',
  COACHING_ORDER_NOT_FOUND: 'La commande de coaching est introuvable.',
  INVOICE_NOT_FOUND: 'La facture est introuvable.',
  INVOICE_UNAVAILABLE: 'La facture est momentanément indisponible.',
  REFUND_NOT_FOUND: 'La demande de remboursement est introuvable.',
  INVALID_REFUND_AMOUNT: 'Le montant de remboursement est invalide.',
  PROVIDER_REFERENCE_REQUIRED: 'Ajoutez la référence du remboursement effectué chez FedaPay.',
  REFUND_NOT_APPROVED: 'Le remboursement doit être approuvé avant d’être marqué comme traité.',
  CANNOT_BOOK_SELF: 'Vous ne pouvez pas réserver une session avec votre propre profil coach.',
  CANNOT_FAVORITE_SELF: 'Votre propre profil ne peut pas être ajouté aux favoris.',
  SESSION_ROOM_UNAVAILABLE: 'Cette session n’est pas encore disponible dans la salle.',
  SESSION_TOO_EARLY: 'La salle n’est pas encore ouverte.',
  SESSION_OUTSIDE_ACCESS_WINDOW: 'La session se trouve en dehors de sa fenêtre d’accès.',
  SESSION_ROOM_CLOSED: 'La salle de cette session est fermée.',
  SESSION_ROOM_NOT_FOUND: 'La salle de cette session est introuvable.',
  SESSION_MEMBER_NOT_FOUND: 'Votre présence dans la salle n’a pas été trouvée.',
  SESSION_CANNOT_CLOSE: 'Cette session ne peut pas être clôturée dans son état actuel.',
  INVALID_MEETING_URL: 'Ajoutez un lien de réunion HTTPS valide.',
  INVALID_PRESENCE_ACTION: 'Cette action de présence est invalide.',
  INVALID_SESSION_SETTINGS: 'Les paramètres de session saisis sont invalides.',
  INVALID_RATING: 'Chaque note doit être comprise entre 1 et 5.',
  RATING_ALREADY_SUBMITTED: 'Vous avez déjà évalué cette session.',
  RATING_WINDOW_CLOSED: 'Le délai pour évaluer cette session est terminé.',
  RATING_NOT_FOUND: 'Cet avis est introuvable.',
  RATING_NOT_PUBLISHED: 'Cet avis n’est pas visible publiquement.',
  RATING_RESPONSE_REQUIRED: 'Rédigez une réponse avant de publier.',
  RATING_MODERATION_REASON_REQUIRED: 'Le motif de modération est obligatoire.',
  INVALID_RATING_STATUS: 'Le statut de modération est invalide.',
  SESSION_NOT_FINISHED: 'Cette session n’est pas encore terminée.',
  DISPUTE_ALREADY_OPEN: 'Un litige est déjà ouvert pour cette session.',
  DISPUTE_WINDOW_CLOSED: 'Le délai de contestation de cette session est terminé.',
  INVALID_DISPUTE_CATEGORY: 'Le motif du litige est invalide.',
  DISPUTE_DESCRIPTION_REQUIRED: 'Décrivez précisément le problème rencontré.',
  DISPUTE_NOT_FOUND: 'Ce dossier de litige est introuvable.',
  DISPUTE_MESSAGE_REQUIRED: 'Rédigez un message avant l’envoi.',
  DISPUTE_CLOSED: 'Ce dossier est déjà clôturé.',
  DISPUTE_DECISION_REQUIRED: 'Sélectionnez une décision et ajoutez son motif.',
  INVALID_PAYOUT: 'Le montant ou le canal de retrait est invalide.',
  PAYOUT_AMOUNT_TOO_LOW: 'Le montant demandé est inférieur au minimum autorisé.',
  PAYOUT_DETAILS_REQUIRED: 'Complétez les coordonnées nécessaires au retrait.',
  PAYOUT_INSUFFICIENT_BALANCE: 'Le solde disponible est insuffisant pour ce retrait.',
  INVALID_PERFORMANCE_SETTINGS: 'Les paramètres de qualité saisis sont invalides.',
  ADVANCED_PRODUCT_REQUIRED: 'Sélectionnez un produit de coaching valide.',
  PACKAGE_NOT_FOUND: 'Ce pack de coaching est introuvable.',
  PACKAGE_INCOMPLETE: 'Complétez correctement les informations du pack.',
  PACKAGE_PRICE_OUT_OF_RANGE: 'Le prix moyen par séance du pack ne respecte pas la fourchette autorisée.',
  PACKAGE_CREDIT_UNAVAILABLE: 'Aucun crédit de séance n’est disponible dans ce pack.',
  PACKAGE_OFFER_MISMATCH: 'Cette offre ne correspond pas aux conditions du pack.',
  SUBSCRIPTION_PLAN_NOT_FOUND: 'Cet abonnement de coaching est introuvable.',
  SUBSCRIPTION_ALREADY_ACTIVE: 'Un abonnement de coaching est déjà actif sur ce compte.',
  GROUP_NOT_FOUND: 'Cette session collective est introuvable.',
  GROUP_NOT_AVAILABLE: 'Cette session collective n’est plus disponible.',
  GROUP_FULL: 'Cette session collective est complète.',
  GROUP_ALREADY_REGISTERED: 'Vous êtes déjà inscrit à cette session collective.',
  GROUP_REGISTRATION_NOT_FOUND: 'Votre inscription collective est introuvable.',
  GROUP_INCOMPLETE: 'Complétez correctement les informations de la session collective.',
  PREFERENCES_INVALID: 'Les préférences de recommandation sont invalides.',
  ACTION_PLAN_INCOMPLETE: 'Ajoutez un titre au plan d’action.',
  ACTION_PLAN_NOT_FOUND: 'Le plan d’action est introuvable.',
  ACTION_ITEM_INCOMPLETE: 'Ajoutez un titre à cette action.',
  RECORDING_DISABLED: 'L’enregistrement des sessions est désactivé.',
  INVALID_RECORDING_CONSENT: 'Le choix de consentement est invalide.',
  RECORDING_CONSENT_REQUIRED: 'L’accord explicite du coach et de l’apprenant est requis.',
  RECORDING_PROVIDER_FAILED: 'Le fournisseur d’enregistrement n’a pas pu démarrer ou arrêter la capture.',
  RECORDING_NOT_FOUND: 'Aucun enregistrement n’est disponible.',
  RECORDING_STORAGE_NOT_CONFIGURED: 'Le stockage privé des enregistrements n’est pas configuré.',
  ACTIVE_RECORDING_NOT_FOUND: 'Aucun enregistrement actif n’a été trouvé.',
  INVALID_ADVANCED_SETTINGS: 'Les paramètres avancés saisis sont invalides.',
  PREVIEW_READ_ONLY: 'Cette action n’est pas disponible dans cet espace.',
  COACH_PREVIEW_ACCOUNT_MISSING: 'L’espace coach est temporairement indisponible.',
};

export async function coachingRequest<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const previewMode = isCoachPreviewMode();
  if (previewMode && !COACH_PREVIEW_READ_ACTIONS.has(action)) {
    throw new Error(messages.PREVIEW_READ_ONLY);
  }
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: edgeAuthHeaders(),
    body: JSON.stringify({
      ...payload,
      action,
      ...(previewMode ? { preview_mode: true } : {}),
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) {
    const code = String(data?.error || 'COACHING_ERROR');
    throw new Error(messages[code] || String(data?.message || data?.detail || 'Le service Omnia Coaching est indisponible.'));
  }
  return data as T;
}

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.onerror = () => reject(new Error('Lecture du fichier impossible.'));
    reader.readAsDataURL(file);
  });
}

export function formatXof(value?: number | null): string {
  if (value === null || value === undefined) return 'Sur demande';
  return `${new Intl.NumberFormat('fr-FR').format(value)} FCFA`;
}

export function formatCoachingDate(value?: string | null, options: Intl.DateTimeFormatOptions = {}): string {
  if (!value) return 'À définir';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'À définir';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short', ...options }).format(date);
}
