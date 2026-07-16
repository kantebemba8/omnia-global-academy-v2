import { ENDPOINTS } from '../../lib/config';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';

export type PublicTalent = {
  id: string;
  full_name: string;
  professional_title?: string;
  location?: string;
  country?: string;
  bio?: string;
  skills?: string[];
  sectors?: string[];
  languages?: string[];
  certifications?: string[];
  photo_url?: string;
  availability?: string;
  experience_level?: string;
  portfolio_url?: string;
  contact_enabled?: boolean;
};

export type PublicJob = {
  id: string;
  title?: string;
  company_name?: string;
  location?: string;
  contract_type?: string;
  sector?: string;
  created_at?: string;
  published_at?: string;
  description?: string;
};

export async function loadPublicTalents(): Promise<PublicTalent[]> {
  if (!SUPABASE_URL) return [];
  const response = await fetch(`${SUPABASE_URL}/functions/v1/talent-recruitment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'public_list' }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || 'Impossible de charger les profils publics.');
  return data.profiles || [];
}

export async function loadPublicJobs(): Promise<PublicJob[]> {
  const response = await fetch(ENDPOINTS.jobsList, { headers: { 'Content-Type': 'application/json' } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || 'Impossible de charger les offres.');
  return data.jobs || data.offers || [];
}
