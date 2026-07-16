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

export type RecruiterStatus = {
  user_id: string;
  recruiter_type: 'independent' | 'structure';
  organization_id?: string | null;
  company_name?: string | null;
  job_title?: string | null;
  professional_email?: string | null;
  phone?: string | null;
  country?: string | null;
  linkedin_url?: string | null;
  website_url?: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  visibility: 'public' | 'private';
  notifications_enabled: boolean;
  rejection_reason?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type TalentNotification = {
  id: string;
  notification_type: string;
  title: string;
  message?: string | null;
  action_url?: string | null;
  read_at?: string | null;
  created_at: string;
};

export async function loadRecruiterStatus() {
  return recruitmentRequest<{ success: true; profile: RecruiterStatus | null }>('recruiter_self_status');
}
export async function submitRecruiterApplication(input: Record<string, unknown>) {
  return recruitmentRequest<{ success: true; profile: RecruiterStatus }>('submit_recruiter_application', input);
}
export async function joinRecruitmentStructure(code: string) {
  return recruitmentRequest<{ success: true; profile: RecruiterStatus }>('join_structure_by_code', { code });
}
export async function updateRecruiterPreferences(input: { visibility?: 'public'|'private'; notifications_enabled?: boolean }) {
  return recruitmentRequest<{ success: true; profile: RecruiterStatus }>('update_recruiter_preferences', input);
}
export async function loadTalentNotifications() {
  const data = await recruitmentRequest<{ success: true; notifications: TalentNotification[]; unread: number }>('list_notifications');
  return data;
}
export async function markTalentNotificationRead(notificationId?: string) {
  return recruitmentRequest<{ success: true }>('mark_notification_read', { notification_id: notificationId || null });
}
export async function createRecruitmentInvite(input: { email?: string; max_uses?: number; expires_at?: string; permissions?: Record<string, boolean> }) {
  return recruitmentRequest<{ success: true; invite: { id: string; code: string } }>('create_recruitment_invite', input, 'structure');
}
export async function loadRecruitmentInvites() {
  return recruitmentRequest<{ success: true; invites: any[] }>('list_recruitment_invites', {}, 'structure');
}
export async function revokeRecruitmentInvite(inviteId: string) {
  return recruitmentRequest<{ success: true }>('revoke_recruitment_invite', { invite_id: inviteId }, 'structure');
}
export async function adminLoadTalentSupervision(status?: string) {
  return recruitmentRequest<{ success: true; recruiters: any[]; contacts: any[]; activity: any[]; metrics: Record<string, number> }>('admin_talent_supervision', status ? { status } : {});
}
export async function adminUpdateRecruiterStatus(userId: string, status: 'approved'|'rejected'|'suspended'|'pending', reason?: string) {
  return recruitmentRequest<{ success: true; profile: RecruiterStatus }>('admin_update_recruiter_status', { user_id: userId, status, reason });
}

export type TalentAnalytics = {
  period_days: number;
  metrics: {
    active_jobs: number; applications: number; profile_views: number; favorites: number;
    contacts: number; interviews: number; hires: number; response_rate: number;
    public_profiles?: number; approved_recruiters?: number; recruiting_structures?: number;
  };
  series: Array<{ date: string; profile_views: number; contacts: number; interviews: number; applications: number }>;
  recent_activity: Array<{ id: string; action: string; created_at: string; metadata?: Record<string, unknown> }>;
};

export async function loadTalentAnalytics(scope: 'recruiter'|'structure'|'admin' = 'recruiter', periodDays = 30) {
  return recruitmentRequest<{ success: true; analytics: TalentAnalytics }>('analytics', { period_days: periodDays }, scope === 'admin' ? 'recruiter' : scope);
}

export async function logTalentProfileView(talentUserId: string) {
  try { await recruitmentRequest<{ success: true }>('log_profile_view', { talent_user_id: talentUserId }); } catch { /* vue publique anonyme ou session indisponible */ }
}
