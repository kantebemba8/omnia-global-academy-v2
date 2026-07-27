import { edgeAuthHeaders } from './edgeAuth';

export const ASSESSMENT_GOVERNANCE_API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/assessment-governance`;

export async function assessmentGovernanceCall<T = any>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(ASSESSMENT_GOVERNANCE_API, {
    method: 'POST',
    headers: edgeAuthHeaders(),
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) throw new Error(data.message || data.error || 'Erreur Assessment Center');
  return data as T;
}

export type GovernanceUpload = {
  bucket_name: 'assessment-governance';
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
};

export async function uploadAssessmentGovernanceFile(file: File, purpose: 'expert' | 'appeal' | 'jury'): Promise<GovernanceUpload> {
  const prepared = await assessmentGovernanceCall<any>('prepare_governance_upload', {
    purpose,
    file_name: file.name,
    mime_type: file.type || 'application/octet-stream',
    size_bytes: file.size,
  });
  const uploadResponse = await fetch(prepared.signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
  if (!uploadResponse.ok) throw new Error('Téléversement du document impossible.');
  return {
    bucket_name: 'assessment-governance',
    storage_path: prepared.path,
    file_name: file.name,
    mime_type: file.type || 'application/octet-stream',
    size_bytes: file.size,
  };
}
