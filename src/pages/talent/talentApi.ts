import { ENDPOINTS } from '../../lib/config';
import { edgeAuthHeaders, edgeGatewayHeaders } from '../../lib/edgeAuth';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';

function apiErrorMessage(value: unknown, fallback: string, depth = 0): string {
  if (depth > 5) return fallback;
  if (value instanceof Error) {
    if (value.message && value.message.trim() && value.message.trim() !== '[object Object]') {
      return value.message;
    }
    return apiErrorMessage((value as Error & { cause?: unknown }).cause, fallback, depth + 1);
  }
  if (typeof value === 'string') {
    const text = value.trim();
    if (text && text !== '[object Object]' && text !== '{}') return text;
    return fallback;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const text = apiErrorMessage(item, '', depth + 1);
      if (text) return text;
    }
    return fallback;
  }
  if (value && typeof value === 'object') {
    const row = value as Record<string, unknown>;
    const parts: string[] = [];
    for (const key of ['message', 'error_description', 'error', 'details', 'hint', 'code']) {
      const nested = row[key];
      if (nested === undefined || nested === null) continue;
      const text = apiErrorMessage(nested, '', depth + 1);
      if (text && !parts.includes(text)) parts.push(text);
    }
    if (parts.length) return parts.join(' — ');
  }
  return fallback;
}


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

type TalentRequestScope = 'public'|'recruiter'|'structure'|'admin';

type TalentRequestOptions = {
  authenticated?: boolean;
  timeoutMs?: number;
};

function talentEndpointCandidates() {
  const candidates = [
    ENDPOINTS.talentRecruitment,
    SUPABASE_URL ? `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/talent-recruitment` : '',
  ].filter(Boolean);
  return [...new Set(candidates)];
}

async function parseTalentResponse(response: Response) {
  const raw = await response.text();
  if (!raw) return {};
  try { return JSON.parse(raw); }
  catch { return { message: raw }; }
}

async function recruitmentRequest<T>(
  action: string,
  payload: Record<string, unknown> = {},
  scope: TalentRequestScope = 'recruiter',
  options: TalentRequestOptions = {},
): Promise<T> {
  const endpoints = talentEndpointCandidates();
  if (!endpoints.length) {
    throw new Error('Configuration Omnia Talent absente : VITE_SUPABASE_URL n’est pas défini.');
  }

  const authenticated = options.authenticated ?? scope !== 'public';
  const timeoutMs = Math.max(5000, options.timeoutMs || 20000);
  const networkErrors: string[] = [];

  for (const [endpointIndex, endpoint] of endpoints.entries()) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: authenticated ? edgeAuthHeaders() : edgeGatewayHeaders(),
        body: JSON.stringify({ action, scope, ...payload }),
        signal: controller.signal,
        credentials: 'omit',
      });
      const data = await parseTalentResponse(response);
      if (!response.ok) {
        const message = apiErrorMessage(data, `Opération Omnia Talent indisponible (${response.status}).`);
        const canTryAlternate = endpointIndex < endpoints.length - 1 && [404, 502, 503, 504].includes(response.status);
        if (canTryAlternate) {
          networkErrors.push(`${endpoint} : HTTP ${response.status} — ${message}`);
          continue;
        }
        throw new Error(message);
      }
      return data as T;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        networkErrors.push(`${endpoint} : délai dépassé`);
        continue;
      }
      if (error instanceof TypeError) {
        networkErrors.push(`${endpoint} : ${error.message || 'connexion refusée'}`);
        continue;
      }
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  throw new Error(`Connexion à l’Edge Function talent-recruitment impossible. Vérifiez le déploiement, l’URL Supabase et les règles CORS. Tentatives : ${networkErrors.join(' | ')}`);
}

export async function loadPublicTalents(): Promise<PublicTalent[]> {
  const data = await recruitmentRequest<{ success: true; profiles: PublicTalent[] }>('public_list', {}, 'public', { authenticated: false });
  return data.profiles || [];
}

export async function loadPublicJobs(): Promise<PublicJob[]> {
  const response = await fetch(ENDPOINTS.jobsList, { headers: edgeGatewayHeaders() });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(apiErrorMessage(data, 'Impossible de charger les offres.'));
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
  recruiter_type: 'independent';
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
export async function updateRecruiterPreferences(input: { visibility?: 'public'|'private'; notifications_enabled?: boolean }) {
  return recruitmentRequest<{ success: true; profile: RecruiterStatus }>('update_recruiter_preferences', input);
}
export async function loadTalentNotifications() {
  const data = await recruitmentRequest<{ success: true; notifications: TalentNotification[]; unread: number }>('list_notifications');
  return data;
}
export async function markTalentNotificationRead(notificationId?: string) {
  const result = await recruitmentRequest<{ success: true }>('mark_notification_read', { notification_id: notificationId || null });
  if (result?.success) window.dispatchEvent(new CustomEvent('omnia:notifications-changed'));
  return result;
}
export async function adminLoadTalentSupervision(status?: string) {
  return recruitmentRequest<{ success: true; recruiters: any[]; contacts: any[]; activity: any[]; metrics: Record<string, number> }>('admin_talent_supervision', status ? { status } : {}, 'admin');
}
export async function adminUpdateRecruiterStatus(userId: string, status: 'approved'|'rejected'|'suspended'|'pending', reason?: string) {
  return recruitmentRequest<{ success: true; profile: RecruiterStatus }>('admin_update_recruiter_status', { user_id: userId, status, reason }, 'admin');
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
  return recruitmentRequest<{ success: true; analytics: TalentAnalytics }>('analytics', { period_days: periodDays }, scope);
}

export async function logTalentProfileView(talentUserId: string) {
  try { await recruitmentRequest<{ success: true }>('log_profile_view', { talent_user_id: talentUserId }); } catch { /* vue publique anonyme ou session indisponible */ }
}
