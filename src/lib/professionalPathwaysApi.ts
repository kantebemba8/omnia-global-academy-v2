import { API_BASE_URL } from './config';
import { edgeAuthHeaders } from './edgeAuth';

export type ProfessionalPathway = {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  status: 'draft' | 'review' | 'published' | 'suspended' | 'archived';
  visibility: 'public' | 'authenticated' | 'structure' | 'invitation';
  certification_type: 'oga' | 'recognized' | 'co_certified' | 'professional' | 'cpd';
  recognition_program_id?: string | null;
  validity_months?: number | null;
  renewal_required: boolean;
  cpd_enabled: boolean;
  cpd_credit_value?: number | null;
  cpd_credit_unit?: string | null;
  badge_template_id?: string | null;
  certificate_template_id?: string | null;
  metadata?: Record<string, unknown>;
  steps?: ProfessionalPathwayStep[];
  prerequisites?: ProfessionalPathwayPrerequisite[];
};

export type ProfessionalPathwayStep = {
  id: string;
  pathway_id: string;
  step_type: 'course' | 'assessment' | 'jury' | 'project' | 'evidence' | 'renewal_training';
  title: string;
  position: number;
  required: boolean;
  course_id?: string | null;
  assessment_id?: string | null;
  project_id?: string | null;
  minimum_score?: number | null;
  rules?: Record<string, unknown>;
};

export type ProfessionalPathwayPrerequisite = {
  id: string;
  pathway_id: string;
  prerequisite_type: 'course' | 'pathway' | 'badge' | 'skill' | 'manual';
  title: string;
  required: boolean;
  course_id?: string | null;
  required_pathway_id?: string | null;
  badge_template_id?: string | null;
  skill_code?: string | null;
  rules?: Record<string, unknown>;
  met?: boolean;
  source?: unknown;
};

export async function professionalPathwaysCall<T = any>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/professional-pathways`, {
    method: 'POST',
    headers: edgeAuthHeaders(),
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) throw new Error(data?.message || data?.error || 'PROFESSIONAL_PATHWAYS_REQUEST_FAILED');
  return data as T;
}
