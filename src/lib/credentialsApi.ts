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

export type ClrAchievement = {
  id: string;
  source_type: string;
  source_id?: string | null;
  title: string;
  description?: string | null;
  achievement_type: string;
  section: string;
  status: string;
  visibility: BadgeAward['visibility'];
  issued_at?: string | null;
  payload?: Record<string, unknown>;
};

export type ClrRecord = {
  id: string;
  record_uuid: string;
  user_id: string;
  title: string;
  description?: string | null;
  status: string;
  default_visibility: BadgeAward['visibility'];
  version: number;
  standards_status: 'internal_record' | 'clr2_draft' | 'clr2_signed';
  clr_json?: Record<string, unknown>;
  last_built_at?: string | null;
  user?: { id: string; full_name: string; email?: string; avatar_url?: string | null } | null;
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
  return ({ awarded: 'Actif', pending: 'En attente', expired: 'Expiré', revoked: 'Révoqué', suspended: 'Suspendu' } as Record<string, string>)[value] || value;
}


export function credentialAssetUrl(identifier: string, format: 'jwt' | 'json' | 'qr' | 'verify'): string {
  const encoded = encodeURIComponent(identifier);
  if (format === 'jwt') return `${CREDENTIALS_FUNCTION_URL}/badges/${encoded}.jwt`;
  if (format === 'json') return `${CREDENTIALS_FUNCTION_URL}/badges/${encoded}.json`;
  if (format === 'qr') return `${CREDENTIALS_FUNCTION_URL}/badges/${encoded}/qr.svg`;
  return `${CREDENTIALS_FUNCTION_URL}/badges/${encoded}/verify`;
}
