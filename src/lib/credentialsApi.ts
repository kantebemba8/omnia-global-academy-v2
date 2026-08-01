import { API_BASE_URL } from './config';
import { edgeAuthHeaders } from './edgeAuth';

export const CREDENTIALS_FUNCTION_URL = `${API_BASE_URL}/credentials`;

export type CredentialIssuer = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  issuer_type: 'platform' | 'structure' | 'external';
  website_url?: string | null;
  email?: string | null;
  logo_url?: string | null;
  issuer_uri: string;
  did?: string | null;
  status: 'draft' | 'active' | 'suspended' | 'archived';
  public_key_set_uri?: string | null;
  verification_method?: Record<string, unknown>;
  last_key_sync_at?: string | null;
};

export type BadgeCategory = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  category_type: 'skill' | 'achievement' | 'trust' | 'community' | 'internal';
  display_order: number;
  is_active: boolean;
};

export type BadgeLevel = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  rank: number;
  color: string;
  is_active: boolean;
};

export type BadgeTemplate = {
  id: string;
  code: string;
  issuer_id: string;
  category_id: string;
  level_id?: string | null;
  name: string;
  description: string;
  image_url?: string | null;
  achievement_type: string;
  criteria_narrative: string;
  evidence_required: boolean;
  validity_days?: number | null;
  default_visibility: 'private' | 'oga' | 'recruiters' | 'structure' | 'public';
  allowed_issuer_roles: string[];
  source_types: string[];
  internal_only: boolean;
  automatic_enabled: boolean;
  status: 'draft' | 'pending_validation' | 'active' | 'inactive' | 'archived';
  achievement_uri?: string | null;
  metadata?: Record<string, unknown>;
  issuer?: CredentialIssuer | null;
  category?: BadgeCategory | null;
  level?: BadgeLevel | null;
};

export type BadgeEvidence = {
  id?: string;
  evidence_type: string;
  title: string;
  description?: string | null;
  url?: string | null;
  is_public?: boolean;
};

export type BadgeAward = {
  id: string;
  credential_uuid: string;
  verification_code: string;
  template_id: string;
  recipient_user_id: string;
  status: 'pending' | 'awarded' | 'expired' | 'revoked' | 'suspended';
  visibility: 'private' | 'oga' | 'recruiters' | 'structure' | 'public';
  source_type: string;
  evidence_summary?: string | null;
  issued_at: string;
  expires_at?: string | null;
  revoked_at?: string | null;
  revocation_reason?: string | null;
  standards_status: 'internal_verified' | 'ob3_draft' | 'ob3_signed';
  signed_at?: string | null;
  signature_alg?: string | null;
  credential_media_type?: string | null;
  credential_hash?: string | null;
  last_verified_at?: string | null;
  verification_result?: CredentialVerification;
  credential_jwt_available?: boolean;
  credential_json?: Record<string, unknown>;
  template?: BadgeTemplate | null;
  issuer?: CredentialIssuer | null;
  recipient?: { id?: string; full_name: string; email?: string; avatar_url?: string | null } | null;
  evidence?: BadgeEvidence[];
};


export type CredentialVerification = {
  signature_valid: boolean;
  structure_valid: boolean;
  status_valid: boolean;
  overall_valid: boolean;
  error_code?: string | null;
  protected_header?: Record<string, unknown>;
  credential?: Record<string, unknown>;
  structure_checks?: Record<string, boolean>;
  checked_at: string;
};

export type CredentialSigningKey = {
  id: string;
  issuer_id: string;
  key_name: string;
  key_id_uri: string;
  algorithm: 'RS256';
  public_jwk: Record<string, unknown>;
  jwk_thumbprint: string;
  status: 'active' | 'retired' | 'revoked';
  valid_from: string;
  valid_until?: string | null;
};

export type CredentialSigningStatus = {
  configured: boolean;
  configuration_error?: string | null;
  current_key?: CredentialSigningKey | null;
  keys: CredentialSigningKey[];
  signed_awards: number;
  unsigned_awards: number;
  verification_events: number;
  required_algorithm: 'RS256';
  public_key_endpoint: string;
};

export type ClrVisibility = BadgeAward['visibility'];

export type ClrAchievement = {
  id: string;
  clr_record_id?: string;
  award_id?: string | null;
  source_type: string;
  source_id: string;
  title: string;
  description?: string | null;
  achievement_type: string;
  section: string;
  status: 'active' | 'hidden' | 'revoked' | 'expired';
  visibility: ClrVisibility;
  issued_at?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  score?: number | null;
  score_max?: number | null;
  result_label?: string | null;
  skills: string[];
  evidence: Array<Record<string, unknown>>;
  external_url?: string | null;
  issuer_name?: string | null;
  issuer_url?: string | null;
  entry_origin: 'platform' | 'manual' | 'imported';
  verification_status: 'verified' | 'declared' | 'pending_review' | 'rejected' | 'revoked';
  learner_editable: boolean;
  is_featured: boolean;
  sort_order?: number;
  metadata?: Record<string, unknown>;
  payload?: Record<string, unknown>;
};

export type ClrEntryCounts = { total: number; verified: number; pending: number };

export type ClrRecord = {
  id: string;
  record_uuid: string;
  user_id: string;
  title: string;
  description?: string | null;
  profile_headline?: string | null;
  summary?: string | null;
  language_code?: string;
  status: string;
  default_visibility: ClrVisibility;
  section_order: string[];
  hidden_sections: string[];
  version: number;
  standards_status: 'internal_record' | 'clr2_draft' | 'clr2_signed';
  clr_json?: Record<string, unknown>;
  clr_jwt?: string | null;
  signed_at?: string | null;
  signature_alg?: string | null;
  credential_hash?: string | null;
  verification_result?: CredentialVerification | Record<string, never>;
  last_built_at?: string | null;
  last_synced_at?: string | null;
  entry_counts?: ClrEntryCounts;
  user?: { id?: string; full_name: string; email?: string; avatar_url?: string | null; country_code?: string | null } | null;
};

export type ClrShare = {
  id: string;
  label?: string | null;
  include_sections: string[];
  visibility_filter: Exclude<ClrVisibility, 'private'>;
  expires_at?: string | null;
  revoked_at?: string | null;
  created_at: string;
  last_accessed_at?: string | null;
  url?: string;
  token?: string;
};

export type ClrImport = {
  id: string;
  clr_record_id?: string;
  user_id?: string;
  source_format: 'json' | 'json_ld' | 'vc_jwt';
  source_file_name?: string | null;
  source_issuer?: string | null;
  credential_type?: string | null;
  status: 'pending' | 'imported' | 'rejected' | 'failed';
  verification_result?: CredentialVerification | Record<string, unknown>;
  imported_entries_count: number;
  review_note?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  user?: { id: string; full_name?: string; email?: string } | null;
  record?: { id: string; record_uuid: string; title: string } | null;
};

export type ClrExportResponse = {
  success: true;
  format: 'clr_json' | 'vc_jwt';
  content: Record<string, unknown> | string;
  file_name: string;
  media_type: string;
  record: ClrRecord;
};

export type LearnerClrResponse = {
  success: true;
  record: ClrRecord;
  achievements: ClrAchievement[];
  shares: ClrShare[];
  imports: ClrImport[];
  sections: string[];
  synced_entries: number;
};

export type SkillsPassportStatus = 'draft' | 'published' | 'suspended' | 'archived';

export type SkillsPassport = {
  id: string;
  passport_uuid: string;
  user_id?: string;
  clr_record_id?: string;
  title: string;
  professional_headline?: string | null;
  professional_summary?: string | null;
  target_roles: string[];
  languages: string[];
  location_text?: string | null;
  availability_text?: string | null;
  selected_sections: string[];
  status: SkillsPassportStatus;
  version: number;
  presentation_json?: Record<string, unknown>;
  presentation_jwt?: string | null;
  signature_alg?: string | null;
  credential_hash?: string | null;
  verification_result?: CredentialVerification | Record<string, unknown>;
  published_at?: string | null;
  last_built_at?: string | null;
  updated_at?: string | null;
  item_count?: number;
  active_share_count?: number;
  user?: { id?: string; full_name?: string; email?: string; avatar_url?: string | null; country_code?: string | null } | null;
};

export type SkillsPassportItem = {
  id: string;
  passport_id: string;
  clr_achievement_id: string;
  display_order: number;
  is_featured: boolean;
  achievement?: ClrAchievement | null;
};

export type SkillsPassportShare = {
  id: string;
  label?: string | null;
  expires_at?: string | null;
  max_views?: number | null;
  view_count: number;
  last_accessed_at?: string | null;
  revoked_at?: string | null;
  created_at: string;
  url?: string;
  token?: string;
};

export type LearnerSkillsPassportResponse = {
  success: true;
  passport: SkillsPassport;
  items: SkillsPassportItem[];
  candidates: ClrAchievement[];
  shares: SkillsPassportShare[];
  allowed_sections: string[];
};

export type SkillsPassportExportResponse = {
  success: true;
  format: 'passport_json' | 'vc_jwt';
  content: Record<string, unknown> | string;
  file_name: string;
  media_type: string;
  passport: SkillsPassport;
};

export type PublicSkillsPassportResponse = {
  success: true;
  passport: SkillsPassport;
  share: Pick<SkillsPassportShare, 'label' | 'expires_at' | 'max_views' | 'view_count'>;
  items: Array<{
    id: string;
    clr_achievement_id?: string;
    section: string;
    title: string;
    description?: string | null;
    achievement_type?: string;
    issued_at?: string | null;
    started_at?: string | null;
    ended_at?: string | null;
    result_label?: string | null;
    score?: number | null;
    score_max?: number | null;
    skills: string[];
    evidence: Array<Record<string, unknown>>;
    external_url?: string | null;
    issuer_name?: string | null;
    verification_status: ClrAchievement['verification_status'];
    entry_origin: ClrAchievement['entry_origin'];
    is_featured: boolean;
    display_order: number;
  }>;
  verification: CredentialVerification;
};

export async function credentialsRequest<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/credentials`, {
    method: 'POST',
    headers: edgeAuthHeaders(),
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok || data.error) throw new Error(data.error || 'CREDENTIALS_REQUEST_FAILED');
  return data;
}

export const visibilityLabel: Record<BadgeAward['visibility'], string> = {
  private: 'Privé',
  oga: 'Visible dans OGA',
  recruiters: 'Visible par les recruteurs',
  structure: 'Visible par ma Structure',
  public: 'Public',
};

export function credentialStatusLabel(value: string): string {
  return ({
    awarded: 'Actif', active: 'Actif', pending: 'En attente', expired: 'Expiré', revoked: 'Révoqué', suspended: 'Suspendu',
    hidden: 'Masqué', verified: 'Vérifié', declared: 'Déclaré', pending_review: 'À vérifier', rejected: 'Refusé',
    imported: 'Importé', failed: 'Échec', internal_record: 'Dossier interne', clr2_draft: 'CLR 2.0 prêt', clr2_signed: 'CLR 2.0 signé',
    ob3_draft: 'Open Badge prêt', ob3_signed: 'Open Badge signé', draft: 'Brouillon', published: 'Publié', archived: 'Archivé',
  } as Record<string, string>)[value] || value;
}


export function credentialAssetUrl(identifier: string, format: 'jwt' | 'json' | 'qr' | 'verify'): string {
  const encoded = encodeURIComponent(identifier);
  if (format === 'jwt') return `${CREDENTIALS_FUNCTION_URL}/badges/${encoded}.jwt`;
  if (format === 'json') return `${CREDENTIALS_FUNCTION_URL}/badges/${encoded}.json`;
  if (format === 'qr') return `${CREDENTIALS_FUNCTION_URL}/badges/${encoded}/qr.svg`;
  return `${CREDENTIALS_FUNCTION_URL}/badges/${encoded}/verify`;
}
