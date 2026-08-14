import { ENDPOINTS } from './config';
import { edgeAuthHeaders } from './edgeAuth';

export type AdminUserStatus = 'active' | 'pending' | 'suspended' | 'deleted' | 'other';

export interface AdminUserDirectoryRow {
  id: string;
  full_name: string;
  email: string;
  status: string;
  status_group: AdminUserStatus;
  country_code: string | null;
  created_at: string | null;
  last_login_at: string | null;
  primary_roles: string[];
  delegated_access: string[];
  organizations: Array<{ id: string; name: string; access: string }>;
  is_test: boolean;
  force_password_change: boolean;
  signal: string | null;
}

export interface AdminUsersOverview {
  active: number;
  pending: number;
  suspended: number;
  new_30d: number;
  total: number;
}

export interface AdminUsersListResponse {
  success: true;
  overview: AdminUsersOverview;
  users: AdminUserDirectoryRow[];
  total: number;
  page: number;
  page_size: number;
  available_roles: Array<{ key: string; label: string }>;
  available_delegations: Array<{ key: string; label: string }>;
}

export interface AdminUserDetailResponse {
  success: true;
  user: AdminUserDirectoryRow & {
    phone_masked: string | null;
    updated_at: string | null;
    suspension_source: string | null;
    self_suspended_at: string | null;
    self_suspension_until: string | null;
  };
  sessions: Array<{ id: string; ip_address: string | null; user_agent: string | null; created_at: string | null; expires_at: string | null; active: boolean }>;
  invitations: Array<Record<string, unknown>>;
  lifecycle: Array<Record<string, unknown>>;
  administrative_history: Array<Record<string, unknown>>;
  profile: { visibility: string | null; updated_at: string | null } | null;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String(payload.message || payload.error || 'Opération impossible.'));
  }
  return payload as T;
}

export async function adminUsersGet<T>(params: Record<string, string | number | boolean | undefined>): Promise<T> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '' && value !== false) search.set(key, String(value));
  }
  const response = await fetch(`${ENDPOINTS.dashboardAdmin}?${search.toString()}`, { headers: edgeAuthHeaders() });
  return parseResponse<T>(response);
}

export async function adminUsersPost<T>(action: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(ENDPOINTS.dashboardAdmin, {
    method: 'POST',
    headers: edgeAuthHeaders(),
    body: JSON.stringify({ action, ...body }),
  });
  return parseResponse<T>(response);
}

export const PRIMARY_ROLE_LABELS: Record<string, string> = {
  apprenant: 'Apprenant',
  professeur: 'Professeur',
  structure: 'Structure',
  organisateur: 'Organisateur Omnia Live',
  recruteur: 'Recruteur indépendant',
  coach: 'Coach',
  moderateur: 'Modérateur',
};

export const DELEGATION_LABELS: Record<string, string> = {
  gestionnaire_structure: 'Gestionnaire de Structure',
};

export function userStatusLabel(status: AdminUserStatus): string {
  if (status === 'active') return 'Actif';
  if (status === 'pending') return 'En attente';
  if (status === 'suspended') return 'Suspendu';
  if (status === 'deleted') return 'Supprimé';
  return 'Autre';
}
