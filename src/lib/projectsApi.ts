import { createClient } from '@supabase/supabase-js';
import { API_BASE_URL } from './config';
import { edgeAuthHeaders } from './edgeAuth';

export const PROJECTS_FUNCTION_URL = `${API_BASE_URL}/omnia-projects`;

export type ProjectStatus =
  | 'draft'
  | 'pending_validation'
  | 'changes_requested'
  | 'published'
  | 'selection'
  | 'in_progress'
  | 'suspended'
  | 'closed'
  | 'archived'
  | 'rejected';

export type ProjectType =
  | 'real_project'
  | 'challenge'
  | 'case_study'
  | 'short_mission'
  | 'academic_project'
  | 'structure_internal'
  | 'call_for_solutions'
  | 'hackathon'
  | 'volunteer_mission'
  | 'rewarded_project';

export type OmniaProject = {
  id: string;
  slug: string;
  title: string;
  short_description?: string | null;
  description: string;
  problem_statement?: string | null;
  objectives?: string | null;
  project_type: ProjectType;
  creator_user_id: string;
  organization_id?: string | null;
  organization_name?: string | null;
  organization_type?: string | null;
  country_code?: string | null;
  city?: string | null;
  geographic_scope: string[];
  languages: string[];
  visibility: 'public' | 'authenticated' | 'structure' | 'cohort' | 'invitation';
  visibility_structure_id?: string | null;
  visibility_cohort_id?: string | null;
  required_skills: string[];
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'all';
  participation_mode: 'individual' | 'team' | 'individual_or_team';
  team_creation_mode: 'candidate' | 'owner' | 'candidate_or_owner';
  selection_mode: 'manual' | 'automatic' | 'mixed';
  min_participants: number;
  max_participants?: number | null;
  min_team_size: number;
  max_team_size?: number | null;
  estimated_hours?: number | null;
  application_opens_at?: string | null;
  application_closes_at?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  evaluation_criteria: Array<{ label?: string; weight?: number; description?: string }>;
  deliverables_summary?: string | null;
  confidentiality_level: 'public' | 'standard' | 'confidential' | 'strictly_confidential';
  nda_required: boolean;
  portfolio_policy: 'forbidden' | 'anonymized_only' | 'validated_summary' | 'authorized_deliverable';
  ip_policy: 'participant_owned' | 'partner_license' | 'joint_ownership' | 'separate_assignment_agreement';
  ip_policy_details?: string | null;
  public_deliverables_allowed: boolean;
  reward_type: string;
  reward_details: Record<string, unknown>;
  reward_funding_status: string;
  recruitment_opportunity: boolean;
  recruitment_disclaimer: string;
  status: ProjectStatus;
  admin_feedback?: string | null;
  cover_url?: string | null;
  application_count?: number;
  selected_count?: number;
  team_count?: number;
  created_at: string;
  updated_at: string;
  published_at?: string | null;
};

export type ProjectMilestone = {
  id: string;
  project_id: string;
  title: string;
  description?: string | null;
  sequence_no: number;
  due_at?: string | null;
  deliverable_required: boolean;
  status: 'planned' | 'open' | 'completed' | 'cancelled';
};

export type ProjectApplication = {
  id: string;
  project_id: string;
  applicant_user_id: string;
  application_mode: 'individual' | 'team';
  team_id?: string | null;
  motivation?: string | null;
  proposed_approach?: string | null;
  availability?: string | null;
  status: 'draft' | 'submitted' | 'under_review' | 'waitlisted' | 'selected' | 'rejected' | 'withdrawn' | 'cancelled';
  review_note?: string | null;
  submitted_at: string;
  project?: Pick<OmniaProject, 'id' | 'slug' | 'title' | 'project_type' | 'status' | 'starts_at' | 'ends_at' | 'organization_name' | 'cover_url'>;
  applicant?: { id: string; full_name: string; email: string; avatar_url?: string | null; country_code?: string | null };
  team?: ProjectTeam | null;
};

export type ProjectTeam = {
  id: string;
  project_id: string;
  name: string;
  description?: string | null;
  leader_user_id: string;
  status: 'forming' | 'submitted' | 'selected' | 'active' | 'completed' | 'disbanded';
  max_members?: number | null;
  invitation_code?: string | null;
  project?: Pick<OmniaProject, 'id' | 'slug' | 'title' | 'status' | 'starts_at' | 'ends_at'>;
};


export type ProjectDeliverable = {
  id: string;
  project_id: string;
  milestone_id?: string | null;
  team_id?: string | null;
  submitted_by: string;
  title: string;
  description?: string | null;
  file_path?: string | null;
  external_url?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  mime_type?: string | null;
  version_no: number;
  confidentiality_level: 'public' | 'project' | 'owner_only' | 'strictly_confidential';
  portfolio_visibility: 'not_allowed' | 'anonymized' | 'summary' | 'full_after_approval';
  status: 'draft' | 'submitted' | 'changes_requested' | 'accepted' | 'rejected' | 'withdrawn';
  evaluation_score?: number | null;
  evaluation_feedback?: string | null;
  submitted_at: string;
  project?: Pick<OmniaProject, 'id' | 'slug' | 'title'>;
  milestone?: Pick<ProjectMilestone, 'id' | 'title'> | null;
  team?: Pick<ProjectTeam, 'id' | 'name'> | null;
  submitter?: { id: string; full_name: string; email: string } | null;
};

export type ProjectInvitation = {
  id: string;
  project_id: string;
  team_id?: string | null;
  invited_user_id: string;
  invitation_role: 'participant' | 'team_leader' | 'mentor' | 'observer';
  status: 'pending' | 'accepted' | 'declined' | 'revoked' | 'expired';
  message?: string | null;
  invited_at: string;
  expires_at?: string | null;
  project?: Pick<OmniaProject, 'id' | 'slug' | 'title' | 'status' | 'organization_name'>;
  team?: Pick<ProjectTeam, 'id' | 'name'> | null;
};

export type ProjectContext = {
  authenticated: boolean;
  user: { id?: string; full_name?: string; email?: string; avatar_url?: string | null } | null;
  roles: string[];
  organization_id: string | null;
  organization_name: string | null;
  can_create: boolean;
  is_admin: boolean;
};

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  real_project: 'Projet réel',
  challenge: 'Challenge',
  case_study: 'Étude de cas',
  short_mission: 'Mission courte',
  academic_project: 'Projet académique',
  structure_internal: 'Projet interne à une Structure',
  call_for_solutions: 'Appel à solutions',
  hackathon: 'Hackathon',
  volunteer_mission: 'Mission bénévole',
  rewarded_project: 'Projet avec récompense',
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: 'Brouillon',
  pending_validation: 'En validation',
  changes_requested: 'Corrections demandées',
  published: 'Publié',
  selection: 'Sélection en cours',
  in_progress: 'En cours',
  suspended: 'Suspendu',
  closed: 'Clôturé',
  archived: 'Archivé',
  rejected: 'Refusé',
};

export const PROJECT_LEVEL_LABELS: Record<OmniaProject['level'], string> = {
  beginner: 'Débutant',
  intermediate: 'Intermédiaire',
  advanced: 'Avancé',
  expert: 'Expert',
  all: 'Tous niveaux',
};

async function projectsPost<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch(PROJECTS_FUNCTION_URL, {
    method: 'POST',
    headers: edgeAuthHeaders(),
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) {
    const error = new Error(payload?.message || payload?.error || 'PROJECTS_SERVER_ERROR') as Error & { code?: string; status?: number };
    error.code = payload?.error || 'PROJECTS_SERVER_ERROR';
    error.status = response.status;
    throw error;
  }
  return payload as T;
}

export function getProjectsContext() {
  return projectsPost<ProjectContext>({ action: 'context' });
}

export function listProjects(filters: Record<string, unknown> = {}) {
  return projectsPost<{ projects: OmniaProject[]; page: number; page_size: number; total: number }>({ action: 'list', ...filters });
}

export function getProjectDetail(identifier: { project_id?: string; slug?: string }) {
  return projectsPost<{
    project: OmniaProject;
    milestones: ProjectMilestone[];
    rewards: Array<Record<string, unknown>>;
    own_application: ProjectApplication | null;
    memberships: Array<Record<string, unknown>>;
    deliverables: ProjectDeliverable[];
    teams: Array<ProjectTeam & { members?: Array<{ id: string; user_id: string; member_role: string; invitation_status: string; user?: { id: string; full_name: string; email: string } }> }>;
    privileged: boolean;
  }>({ action: 'detail', ...identifier });
}

export function getMyProjectsWorkspace() {
  return projectsPost<{
    applications: ProjectApplication[];
    memberships: Array<{ id: string; invitation_status: string; team: ProjectTeam }>;
    invitations: Array<{ id: string; invitation_status: string; invited_at: string; team: ProjectTeam }>;
    project_invitations: ProjectInvitation[];
    deliverables: ProjectDeliverable[];
  }>({ action: 'my_workspace' });
}

export function getOwnerProjects() {
  return projectsPost<{ projects: OmniaProject[]; can_create: boolean }>({ action: 'owner_dashboard' });
}

export function createProject(data: Record<string, unknown>) {
  return projectsPost<{ success: true; project: OmniaProject }>({ action: 'create', ...data });
}

export function updateProject(projectId: string, data: Record<string, unknown>) {
  return projectsPost<{ success: true; project: OmniaProject }>({ action: 'update', project_id: projectId, ...data });
}

export function submitProject(projectId: string) {
  return projectsPost<{ success: true; project: OmniaProject }>({ action: 'submit', project_id: projectId });
}

export function applyToProject(projectId: string, data: Record<string, unknown>) {
  return projectsPost<{ success: true; application: ProjectApplication }>({ action: 'apply', project_id: projectId, ...data });
}

export function acceptProjectAgreement(projectId: string, agreementType = 'nda') {
  return projectsPost<{ success: true }>({ action: 'accept_agreement', project_id: projectId, agreement_type: agreementType });
}

export function createProjectTeam(projectId: string, data: Record<string, unknown>) {
  return projectsPost<{ success: true; team: ProjectTeam }>({ action: 'create_team', project_id: projectId, ...data });
}

export function inviteProjectTeamMember(teamId: string, email: string) {
  return projectsPost<{ success: true }>({ action: 'invite_team_member', team_id: teamId, email });
}

export function respondProjectTeamInvite(membershipId: string, response: 'accepted' | 'declined') {
  return projectsPost<{ success: true }>({ action: 'respond_team_invite', membership_id: membershipId, response });
}

export function inviteProjectUser(projectId: string, email: string, invitationRole: ProjectInvitation['invitation_role'] = 'participant', message = '', teamId?: string) {
  return projectsPost<{ success: true; invitation: ProjectInvitation }>({
    action: 'invite_project_user', project_id: projectId, email, invitation_role: invitationRole, message,
    ...(teamId ? { team_id: teamId } : {}),
  });
}

export function respondProjectInvitation(invitationId: string, response: 'accepted' | 'declined') {
  return projectsPost<{ success: true; invitation: ProjectInvitation }>({ action: 'respond_project_invitation', invitation_id: invitationId, response });
}

export function changeProjectStatus(projectId: string, status: 'selection' | 'published' | 'in_progress' | 'closed') {
  return projectsPost<{ success: true; project: OmniaProject }>({ action: 'change_status', project_id: projectId, status });
}

export function upsertProjectMilestone(projectId: string, data: Record<string, unknown>) {
  return projectsPost<{ success: true; milestone: ProjectMilestone }>({ action: 'upsert_milestone', project_id: projectId, ...data });
}

export function getProjectApplications(projectId: string) {
  return projectsPost<{ applications: ProjectApplication[] }>({ action: 'list_applications', project_id: projectId });
}

export function reviewProjectApplication(applicationId: string, status: string, reviewNote = '') {
  return projectsPost<{ success: true; application: ProjectApplication }>({ action: 'review_application', application_id: applicationId, status, review_note: reviewNote });
}

export function getAdminProjects(status?: string) {
  return projectsPost<{ projects: OmniaProject[]; reports: Array<Record<string, unknown>> }>({ action: 'admin_list', ...(status ? { status } : {}) });
}

export function decideProject(projectId: string, decision: string, note = '', restoreStatus?: ProjectStatus) {
  return projectsPost<{ success: true; project?: OmniaProject; deleted?: boolean }>({
    action: 'admin_decision',
    project_id: projectId,
    decision,
    note,
    ...(restoreStatus ? { restore_status: restoreStatus } : {}),
  });
}

export function reportProject(projectId: string, reportType: string, description: string) {
  return projectsPost<{ success: true }>({ action: 'report', project_id: projectId, report_type: reportType, description });
}

export function resolveProjectReport(reportId: string, status: 'under_review' | 'resolved' | 'dismissed' | 'escalated', resolutionNote = '') {
  return projectsPost<{ success: true }>({ action: 'resolve_report', report_id: reportId, status, resolution_note: resolutionNote });
}

export function submitProjectDeliverable(projectId: string, data: Record<string, unknown>) {
  return projectsPost<{ success: true; deliverable: ProjectDeliverable }>({ action: 'submit_deliverable', project_id: projectId, ...data });
}

export function evaluateProjectDeliverable(deliverableId: string, status: 'changes_requested' | 'accepted' | 'rejected', evaluationFeedback = '', evaluationScore?: number | null, skillCodes: string[] = []) {
  return projectsPost<{ success: true; deliverable: ProjectDeliverable }>({
    action: 'evaluate_deliverable',
    deliverable_id: deliverableId,
    status,
    evaluation_feedback: evaluationFeedback,
    evaluation_score: evaluationScore ?? null,
    skill_codes: skillCodes,
  });
}

export function createProjectUploadUrl(projectId: string, fileName: string, purpose = 'deliverables') {
  return projectsPost<{ path: string; signed_url: string; token: string }>({ action: 'create_upload_url', project_id: projectId, file_name: fileName, purpose });
}

export async function uploadProjectFile(projectId: string, file: File) {
  const upload = await createProjectUploadUrl(projectId, file.name);
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !anonKey) throw new Error('SUPABASE_STORAGE_NOT_CONFIGURED');
  const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.storage.from('omnia-projects').uploadToSignedUrl(upload.path, upload.token, file, {
    contentType: file.type || 'application/octet-stream',
  });
  if (error) throw error;
  return { path: upload.path, file_name: file.name, file_size: file.size, mime_type: file.type || 'application/octet-stream' };
}

export function getProjectFileUrl(projectId: string, filePath: string) {
  return projectsPost<{ signed_url: string; expires_in: number }>({ action: 'signed_file_url', project_id: projectId, file_path: filePath });
}

