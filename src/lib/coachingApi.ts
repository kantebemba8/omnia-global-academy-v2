import { edgeAuthHeaders } from './edgeAuth';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const ENDPOINT = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/coaching` : '/api/coaching';

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
  created_at: string;
  updated_at: string;
  coach?: { id: string; public_slug: string; photo_url?: string | null; professional_title: string; full_name: string } | null;
  learner?: { id: string; full_name?: string; email?: string } | null;
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
  OFFER_NOT_APPROVED: 'Cette offre doit d’abord être validée par le Super Admin.',
  INVALID_SESSION_MODE: 'Ce format de rencontre n’est pas autorisé pour cette offre.',
  INVALID_AVAILABILITY: 'Le créneau de disponibilité saisi est invalide.',
  INVALID_AVAILABILITY_RANGE: 'La période demandée pour le calendrier est invalide.',
  INVALID_DURATION: 'La durée choisie n’est pas autorisée pour cette offre.',
  SLOT_UNAVAILABLE: 'Ce créneau vient d’être réservé ou n’est plus disponible.',
  BOOKING_INCOMPLETE: 'Choisissez une offre, un créneau et un format de session.',
  BOOKING_NOT_FOUND: 'Cette demande de coaching est introuvable.',
  BOOKING_CANNOT_CANCEL: 'Cette réservation ne peut plus être annulée depuis cet écran.',
  CANNOT_BOOK_SELF: 'Vous ne pouvez pas réserver une session avec votre propre profil coach.',
  CANNOT_FAVORITE_SELF: 'Votre propre profil ne peut pas être ajouté aux favoris.',
};

export async function coachingRequest<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: edgeAuthHeaders(),
    body: JSON.stringify({ action, ...payload }),
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
