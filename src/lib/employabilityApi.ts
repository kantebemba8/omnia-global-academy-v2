import { API_BASE_URL } from './config';
import { edgeAuthHeaders } from './edgeAuth';

export type EmployabilityProfile = {
  user_id: string;
  status: 'draft' | 'active' | 'paused' | 'archived';
  talent_visibility: 'private' | 'recruiters' | 'public';
  use_project_evidence: boolean;
  use_skills_passport: boolean;
  use_learning_record: boolean;
  use_career_documents: boolean;
  allow_opportunity_matching: boolean;
  allow_recruiter_contact: boolean;
  target_roles: string[];
  target_sectors: string[];
  target_countries: string[];
  contract_preferences: string[];
  excluded_organizations?: string[];
};

export type VerifiedTalentCandidate = {
  user_id: string;
  full_name: string;
  avatar_url?: string | null;
  professional_title: string;
  location?: string | null;
  target_roles: string[];
  target_sectors: string[];
  target_countries: string[];
  contract_preferences: string[];
  verified_skills: string[];
  certifications: string[];
  verified_project_evidence_count: number;
  allow_recruiter_contact: boolean;
  talent_visibility: 'recruiters' | 'public';
  source_permissions: Record<string, boolean>;
};

export async function employabilityRequest<T = any>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/employability-integration`, {
    method: 'POST',
    headers: edgeAuthHeaders(),
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) throw new Error(data?.message || data?.error || 'EMPLOYABILITY_REQUEST_FAILED');
  return data as T;
}
