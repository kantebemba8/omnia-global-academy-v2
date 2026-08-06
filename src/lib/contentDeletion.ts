import { API_BASE_URL } from './config';
import { edgeAuthHeaders } from './edgeAuth';

export type DeletableContentType = 'course' | 'project' | 'live_event' | 'job_offer';

export type ContentDeletionResult = {
  success: true;
  deleted?: boolean;
  deletion_pending?: boolean;
  request_id?: string;
  message: string;
};

export type ContentDeletionRequest = {
  id: string;
  content_type: DeletableContentType;
  content_id: string;
  content_title: string;
  creator_user_id: string;
  reason?: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'executed';
  requires_admin_confirmation: boolean;
  importance_reason?: string | null;
  metadata?: Record<string, unknown>;
  review_note?: string | null;
  created_at: string;
  reviewed_at?: string | null;
  executed_at?: string | null;
  creator?: { full_name?: string | null; email?: string | null } | null;
};

const ENDPOINT = `${API_BASE_URL}/dashboard-admin`;

async function post<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: edgeAuthHeaders(),
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) {
    throw new Error(payload?.message || payload?.error || 'ACTION_IMPOSSIBLE');
  }
  return payload as T;
}

export function deleteOrRequestContent(
  contentType: DeletableContentType,
  contentId: string,
  reason = '',
) {
  return post<ContentDeletionResult>({
    action: 'delete_or_request',
    content_type: contentType,
    content_id: contentId,
    reason,
  });
}

export function listContentDeletionRequests(status = 'pending') {
  return post<{ success: true; requests: ContentDeletionRequest[] }>({
    action: 'list_deletion_requests',
    status,
  });
}

export function reviewContentDeletionRequest(
  requestId: string,
  decision: 'approve' | 'reject',
  reviewNote = '',
) {
  return post<{ success: true; request: ContentDeletionRequest; message: string }>({
    action: 'review_deletion_request',
    request_id: requestId,
    decision,
    review_note: reviewNote,
  });
}
