import { ENDPOINTS } from '../../lib/config';
import { getSessionToken } from '../../lib/session';

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

export type TalentInterview = {
  id: string;
  talent_user_id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  interview_mode: 'video'|'audio'|'phone'|'in_person';
  meeting_url?: string;
  location?: string;
  status: 'pending'|'accepted'|'declined'|'cancelled'|'completed';
  talent?: PublicTalent | null;
};

export type TalentConversation = {
  id: string;
  talent_user_id: string;
  subject?: string;
  last_message_at: string;
  talent?: PublicTalent | null;
  last_message?: { body?: string; created_at?: string; read_at?: string | null } | null;
};

export type TalentContact = {
  id: string;
  talent_user_id: string;
  subject?: string;
  message: string;
  status: string;
  created_at: string;
  talent?: PublicTalent | null;
};

async function recruitmentRequest<T>(action: string, payload: Record<string, unknown> = {}, scope: 'recruiter'|'structure' = 'recruiter'): Promise<T> {
  const token = getSessionToken();
  const response = await fetch(ENDPOINTS.talentRecruitment, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ action, scope, ...payload }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || 'Opération Talent indisponible.');
  return data as T;
}

export async function loadPublicTalents(): Promise<PublicTalent[]> {
  if (!SUPABASE_URL) return [];
  const response = await fetch(`${SUPABASE_URL}/functions/v1/career-public-profiles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'list' }),
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

export async function loadTalentDashboard(scope: 'recruiter'|'structure' = 'recruiter') {
  return recruitmentRequest<{ success: true; metrics: { favorites: number; contacts: number; upcoming_interviews: number } }>('dashboard', {}, scope);
}
export async function loadTalentFavorites(scope: 'recruiter'|'structure' = 'recruiter') {
  const data = await recruitmentRequest<{ success: true; favorites: PublicTalent[] }>('list_favorites', {}, scope);
  return data.favorites || [];
}
export async function toggleTalentFavorite(talentUserId: string, scope: 'recruiter'|'structure' = 'recruiter') {
  return recruitmentRequest<{ success: true; favorite: boolean }>('toggle_favorite', { talent_user_id: talentUserId }, scope);
}
export async function contactTalent(talentUserId: string, message: string, subject = 'Prise de contact', scope: 'recruiter'|'structure' = 'recruiter') {
  return recruitmentRequest<{ success: true; conversation_id: string }>('contact_talent', { talent_user_id: talentUserId, message, subject }, scope);
}
export async function loadTalentContacts(scope: 'recruiter'|'structure' = 'recruiter') {
  const data = await recruitmentRequest<{ success: true; contacts: TalentContact[] }>('list_contacts', {}, scope);
  return data.contacts || [];
}
export async function createTalentInterview(input: Record<string, unknown>, scope: 'recruiter'|'structure' = 'recruiter') {
  return recruitmentRequest<{ success: true; interview: TalentInterview }>('create_interview', input, scope);
}
export async function loadTalentInterviews(scope: 'recruiter'|'structure' = 'recruiter') {
  const data = await recruitmentRequest<{ success: true; interviews: TalentInterview[] }>('list_interviews', {}, scope);
  return data.interviews || [];
}
export async function loadTalentConversations(scope: 'recruiter'|'structure' = 'recruiter') {
  const data = await recruitmentRequest<{ success: true; conversations: TalentConversation[] }>('list_conversations', {}, scope);
  return data.conversations || [];
}
export async function sendTalentMessage(conversationId: string, message: string, scope: 'recruiter'|'structure' = 'recruiter') {
  return recruitmentRequest<{ success: true }>('send_message', { conversation_id: conversationId, message }, scope);
}
export async function loadRecruitmentTeam() {
  return recruitmentRequest<{ success: true; members: any[] }>('list_team_permissions', {}, 'structure');
}
export async function updateRecruitmentPermissions(userId: string, permissions: Record<string, boolean>) {
  return recruitmentRequest<{ success: true }>('update_team_permissions', { user_id: userId, permissions }, 'structure');
}
