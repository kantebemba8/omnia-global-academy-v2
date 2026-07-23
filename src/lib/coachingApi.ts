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
