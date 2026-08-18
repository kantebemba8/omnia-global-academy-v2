import { ENDPOINTS } from './config';
import { edgeAuthHeaders } from './edgeAuth';

export type ProfileVisibleField =
  | 'display_name'
  | 'avatar_url'
  | 'headline'
  | 'bio'
  | 'city'
  | 'country_code'
  | 'languages'
  | 'skills'
  | 'interests'
  | 'website_url'
  | 'linkedin_url'
  | 'portfolio_url'
  | 'github_url'
  | 'availability_text'
  | 'public_email'
  | 'public_phone'
  | 'roles'
  | 'achievements'
  | 'messages'
  | 'education_level'
  | 'field_of_study'
  | 'career_goal'
  | 'target_roles'
  | 'target_sectors'
  | 'contract_preferences'
  | 'years_experience'
  | 'expertise_domain'
  | 'teaching_languages'
  | 'qualifications'
  | 'teaching_formats'
  | 'experience_summary'
  | 'organizer_type'
  | 'organization_name'
  | 'event_topics'
  | 'moderation_domains'
  | 'recruitment_sectors'
  | 'recruitment_countries'
  | 'coaching_topics'
  | 'session_languages'
  | 'organizer_metrics'
  | 'coach_metrics'
  | 'structure';

export type ProfileFieldVisibility = Partial<Record<ProfileVisibleField, boolean>>;

export type UnifiedUser = {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
  country_code: string;
  birth_date: string;
  avatar_url: string | null;
  allow_email: boolean;
  allow_sms: boolean;
  allow_push: boolean;
  subscribe_newsletter: boolean;
  ai_tokens?: number;
  status?: string;
};

export type UnifiedProfile = {
  user_id: string;
  display_name: string | null;
  headline: string | null;
  bio: string | null;
  city: string | null;
  languages: string[];
  skills: string[];
  interests: string[];
  website_url: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  github_url: string | null;
  availability_text: string | null;
  public_email: string | null;
  public_phone: string | null;
  visibility: 'public' | 'members' | 'private';
  preferred_language: 'fr' | 'en' | 'es' | 'pt' | 'ar' | 'zh' | 'ru' | 'de' | 'bm';
  show_email: boolean;
  show_phone: boolean;
  show_location: boolean;
  show_roles: boolean;
  show_achievements: boolean;
  allow_messages: boolean;
  field_visibility: ProfileFieldVisibility;
  role_details: Record<string, unknown>;
  avatar_storage_path?: string | null;
};

export type UnifiedProfileBundle = {
  success: true;
  user: UnifiedUser;
  roles: string[];
  profile: UnifiedProfile;
  professor_profile?: Record<string, unknown> | null;
  organizer_profile?: Record<string, unknown> | null;
  coach_profile?: Record<string, unknown> | null;
  structure?: Record<string, unknown> | null;
};

export type PublicProfile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  city: string | null;
  country_code: string | null;
  languages: string[];
  skills: string[];
  interests: string[];
  website_url: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  github_url: string | null;
  availability_text: string | null;
  email: string | null;
  phone: string | null;
  roles: string[];
  show_achievements: boolean;
  allow_messages: boolean;
  role_details: Record<string, unknown>;
  professor_profile?: Record<string, unknown> | null;
  organizer_profile?: Record<string, unknown> | null;
  coach_profile?: Record<string, unknown> | null;
  structure?: Record<string, unknown> | null;
  visibility: 'public' | 'members' | 'private';
};

export class ProfileApiError extends Error {
  code: string;
  status: number;
  field?: string;

  constructor(code: string, status: number, message?: string, field?: string) {
    super(message || code);
    this.name = 'ProfileApiError';
    this.code = code;
    this.status = status;
    this.field = field;
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || payload.success === false || payload.error) {
    throw new ProfileApiError(
      String(payload.error || 'PROFILE_REQUEST_FAILED'),
      response.status,
      typeof payload.message === 'string' ? payload.message : undefined,
      typeof payload.field === 'string' ? payload.field : undefined,
    );
  }
  return payload as T;
}

async function request<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch(ENDPOINTS.authUpdateProfile, {
    method: 'POST',
    headers: edgeAuthHeaders(),
    body: JSON.stringify(body),
  });
  return parseResponse<T>(response);
}

export function getUnifiedProfile(): Promise<UnifiedProfileBundle> {
  return request<UnifiedProfileBundle>({ action: 'get_profile' });
}

export function updateUnifiedProfile(payload: {
  user?: Partial<UnifiedUser>;
  profile?: Partial<UnifiedProfile>;
  role_details?: Record<string, unknown>;
}): Promise<UnifiedProfileBundle> {
  return request<UnifiedProfileBundle>({ action: 'update_profile', ...payload });
}

export function uploadProfileAvatar(avatarBase64: string): Promise<UnifiedProfileBundle & { avatar_url: string }> {
  return request<UnifiedProfileBundle & { avatar_url: string }>({ action: 'upload_avatar', avatar_base64: avatarBase64 });
}

export function removeProfileAvatar(): Promise<UnifiedProfileBundle> {
  return request<UnifiedProfileBundle>({ action: 'remove_avatar' });
}

export async function getPublicProfile(userId: string): Promise<{ profile: PublicProfile; is_owner: boolean }> {
  return request<{ success: true; profile: PublicProfile; is_owner: boolean }>({ action: 'public_profile', user_id: userId });
}

export function listBlockedProfileUsers(): Promise<{ blocked_users: Array<{ user_id: string; full_name: string; reason: string | null; blocked_at: string }> }> {
  return request({ action: 'list_blocked_users' });
}

export function unblockProfileUser(targetUserId: string): Promise<{ success: true }> {
  return request({ action: 'unblock_user', target_user_id: targetUserId });
}
export type AccountExitFeedback = {
  improvement_feedback?: string;
  missing_feature?: string;
  return_condition?: string;
};

export function suspendOwnAccount(payload: {
  current_password: string;
  confirmation: string;
  reason_code: string;
  suspended_until?: string | null;
  feedback?: AccountExitFeedback;
}): Promise<{ success: true; account_suspended: true; suspended_at: string; suspended_until: string | null }> {
  return request({ action: 'suspend_account', source: 'web', ...payload });
}

export function deleteOwnAccount(payload: {
  current_password: string;
  confirmation: string;
  reason_code: string;
  feedback?: AccountExitFeedback;
}): Promise<{ success: true; account_deleted: true; deletion_reference: string | null; deleted_at: string }> {
  return request({ action: 'delete_account', source: 'web', ...payload });
}

