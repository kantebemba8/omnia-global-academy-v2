import { edgeAuthHeaders } from './edgeAuth';

export type NotificationSource = 'mobile' | 'live' | 'talent';

export type OmniaNotification = {
  id: string;
  source: NotificationSource;
  notification_type: string;
  title: string;
  message: string;
  action_url: string | null;
  payload: Record<string, unknown>;
  priority: string;
  read_at: string | null;
  created_at: string;
};

export type NotificationListResult = {
  notifications: OmniaNotification[];
  unread_count: number;
  unread_by_source?: Partial<Record<NotificationSource, number>>;
};

function endpoint(): string {
  const base = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
  return base ? `${base}/functions/v1/mobile-notifications` : '/api/mobile-notifications';
}

async function notificationApi<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(`${endpoint()}?action=${encodeURIComponent(action)}`, {
    method: 'POST',
    headers: edgeAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result?.success === false || result?.error) {
    throw new Error(String(result?.message || result?.error || `HTTP_${response.status}`));
  }
  return result as T;
}

export async function listNotifications(limit = 100): Promise<NotificationListResult> {
  return await notificationApi<NotificationListResult & { success: true }>('list', {
    limit: Math.min(200, Math.max(1, limit)),
  });
}

export async function markNotificationRead(notification: Pick<OmniaNotification, 'id' | 'source'>) {
  const result = await notificationApi<{ success: true; updated_id?: string; read_at?: string | null }>('mark', {
    id: notification.id,
    source: notification.source,
    action: 'read',
  });
  if (result.updated_id !== notification.id) throw new Error('READ_NOT_CONFIRMED');
  return result;
}

export async function markAllNotificationsRead() {
  const result = await notificationApi<{ success: true; updated_count?: number; unread_count?: number }>('mark_all_read');
  if (!Number.isFinite(Number(result.updated_count))) throw new Error('MARK_ALL_NOT_CONFIRMED');
  return result;
}
