import { App } from '@capacitor/app';
import { Device } from '@capacitor/device';
import {
  PushNotifications,
  type PermissionStatus,
  type PushNotificationSchema,
  type Token,
} from '@capacitor/push-notifications';
import { edgeAuthHeaders } from '../edgeAuth';
import { getSessionToken, getStoredUser } from '../session';
import { getOmniaNetworkStatus } from './network';
import { getOmniaPlatform, isNativeApp } from './platform';
import { navigateInsideOmnia, routeFromNotificationData } from './deepLinks';

export type MobilePushPermission = PermissionStatus['receive'] | 'unavailable';

export interface MobileNotificationState {
  initialized: boolean;
  permission: MobilePushPermission;
  registered: boolean;
  backendAvailable: boolean;
  providerConfigured: boolean | null;
  unreadCount: number;
  lastError: string | null;
}

export interface OmniaMobileNotification {
  id: string;
  source: 'mobile' | 'live' | 'talent' | 'push';
  notification_type: string;
  title: string;
  message: string;
  action_url: string | null;
  payload: Record<string, unknown>;
  priority: string;
  read_at: string | null;
  created_at: string;
}

type Subscriber = () => void;
const subscribers = new Set<Subscriber>();
let state: MobileNotificationState = {
  initialized: false,
  permission: 'unavailable',
  registered: false,
  backendAvailable: true,
  providerConfigured: null,
  unreadCount: 0,
  lastError: null,
};
let initialized = false;
let currentToken: string | null = null;
let active = true;
let syncTimer: number | null = null;
let syncRunning = false;

function updateState(patch: Partial<MobileNotificationState>): void {
  state = { ...state, ...patch };
  subscribers.forEach(listener => listener());
}

export function subscribeMobileNotificationState(listener: Subscriber): () => void {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

export function getMobileNotificationState(): MobileNotificationState {
  return state;
}

function endpoint(): string {
  const base = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
  return base ? `${base}/functions/v1/mobile-notifications` : '/api/mobile-notifications';
}

async function mobileNotificationApi<T>(
  action: string,
  body: Record<string, unknown> = {},
  explicitSessionToken?: string | null,
): Promise<T> {
  const headers = explicitSessionToken
    ? edgeAuthHeaders({ 'Content-Type': 'application/json', 'x-omnia-session-token': explicitSessionToken })
    : edgeAuthHeaders({ 'Content-Type': 'application/json' });
  const response = await fetch(`${endpoint()}?action=${encodeURIComponent(action)}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result?.error) {
    const message = String(result?.message || result?.error || `HTTP_${response.status}`);
    if (response.status === 404 || response.status === 503) updateState({ backendAvailable: false });
    throw new Error(message);
  }
  updateState({ backendAvailable: true });
  return result as T;
}

function currentUser(): { id?: string; allow_push?: boolean } | null {
  return getStoredUser<{ id?: string; allow_push?: boolean }>();
}

async function installationPayload(token: string): Promise<Record<string, unknown>> {
  const [deviceId, deviceInfo, appInfo] = await Promise.all([
    Device.getId(),
    Device.getInfo(),
    App.getInfo(),
  ]);
  return {
    installation_id: deviceId.identifier,
    platform: getOmniaPlatform(),
    push_token: token,
    app_version: appInfo.version,
    app_build: appInfo.build,
    device_model: deviceInfo.model,
    device_manufacturer: deviceInfo.manufacturer,
    os_version: deviceInfo.osVersion,
    locale: navigator.language || null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
  };
}

async function registerCurrentToken(): Promise<void> {
  const user = currentUser();
  if (!currentToken || !getSessionToken() || !user?.id || user.allow_push === false) return;
  try {
    const result = await mobileNotificationApi<{ provider_configured?: boolean }>('register', await installationPayload(currentToken));
    updateState({ registered: true, providerConfigured: result.provider_configured ?? null, lastError: null });
  } catch (error) {
    updateState({ registered: false, lastError: error instanceof Error ? error.message : 'PUSH_REGISTER_FAILED' });
  }
}

function cursorKey(): string | null {
  const user = currentUser();
  return user?.id ? `omnia_mobile_notification_cursor_${user.id}` : null;
}

function dispatchNotification(notification: OmniaMobileNotification): void {
  window.dispatchEvent(new CustomEvent<OmniaMobileNotification>('omnia:mobile-notification', { detail: notification }));
}

function normalizePush(notification: PushNotificationSchema): OmniaMobileNotification {
  const data = notification.data && typeof notification.data === 'object' ? notification.data as Record<string, unknown> : {};
  const sourceValue = String(data.source || '').trim();
  const source: OmniaMobileNotification['source'] = sourceValue === 'mobile' || sourceValue === 'live' || sourceValue === 'talent'
    ? sourceValue
    : data.notification_id
      ? 'mobile'
      : 'push';
  return {
    id: String(data.notification_id || data.notificationId || notification.id || `push-${Date.now()}`),
    source,
    notification_type: String(data.notification_type || 'push'),
    title: notification.title || 'Omnia Global Academy',
    message: notification.body || '',
    action_url: routeFromNotificationData(data),
    payload: data,
    priority: String(data.priority || 'normal'),
    read_at: null,
    created_at: new Date().toISOString(),
  };
}

export async function syncMobileNotifications(options: { emitNew?: boolean } = {}): Promise<void> {
  if (!isNativeApp() || syncRunning || !active || !getSessionToken() || !getOmniaNetworkStatus().connected) return;
  const key = cursorKey();
  if (!key) return;
  syncRunning = true;
  try {
    const existingCursor = localStorage.getItem(key);
    const result = await mobileNotificationApi<{
      notifications?: OmniaMobileNotification[];
      cursor?: string;
      unread_count?: number;
      provider_configured?: boolean;
    }>('sync', { cursor: existingCursor, limit: 100 });
    const rows = Array.isArray(result.notifications) ? result.notifications : [];
    const shouldEmit = options.emitNew ?? Boolean(existingCursor);
    if (shouldEmit) rows.forEach(dispatchNotification);
    const nextCursor = result.cursor || rows.at(-1)?.created_at || existingCursor || new Date().toISOString();
    if (nextCursor) localStorage.setItem(key, nextCursor);
    updateState({
      unreadCount: Number(result.unread_count || 0),
      providerConfigured: result.provider_configured ?? state.providerConfigured,
      lastError: null,
    });
  } catch (error) {
    updateState({ lastError: error instanceof Error ? error.message : 'NOTIFICATION_SYNC_FAILED' });
  } finally {
    syncRunning = false;
  }
}

export async function requestMobilePushPermission(): Promise<MobileNotificationState> {
  if (!isNativeApp()) return state;
  try {
    let permission = await PushNotifications.checkPermissions();
    if (permission.receive === 'prompt' || permission.receive === 'prompt-with-rationale') {
      permission = await PushNotifications.requestPermissions();
    }
    updateState({ permission: permission.receive, lastError: null });
    if (permission.receive !== 'granted') return state;
    await PushNotifications.register();
    return state;
  } catch (error) {
    updateState({ lastError: error instanceof Error ? error.message : 'PUSH_PERMISSION_FAILED' });
    return state;
  }
}


async function unregisterCurrentInstallation(explicitSessionToken?: string | null): Promise<void> {
  const token = explicitSessionToken ?? getSessionToken();
  if (!token) return;
  const id = await Device.getId();
  await mobileNotificationApi('unregister', { installation_id: id.identifier }, token);
}

export async function disableMobilePush(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await unregisterCurrentInstallation();
    await PushNotifications.unregister();
    currentToken = null;
    updateState({ registered: false, lastError: null });
  } catch (error) {
    updateState({ lastError: error instanceof Error ? error.message : 'PUSH_UNREGISTER_FAILED' });
  }
}

export async function markMobileNotification(
  notification: Pick<OmniaMobileNotification, 'id' | 'source'>,
  action: 'read' | 'dismiss',
): Promise<void> {
  if (!getSessionToken() || notification.source === 'push') return;
  await mobileNotificationApi('mark', { id: notification.id, source: notification.source, action });
  await syncMobileNotifications({ emitNew: false });
}

export async function initializeMobileNotificationRuntime(): Promise<void> {
  if (initialized || !isNativeApp()) return;
  initialized = true;

  await PushNotifications.addListener('registration', (token: Token) => {
    currentToken = token.value;
    void registerCurrentToken();
  });
  await PushNotifications.addListener('registrationError', error => {
    updateState({ registered: false, lastError: error.error || 'PUSH_REGISTRATION_FAILED' });
  });
  await PushNotifications.addListener('pushNotificationReceived', notification => {
    dispatchNotification(normalizePush(notification));
    void syncMobileNotifications({ emitNew: false });
  });
  await PushNotifications.addListener('pushNotificationActionPerformed', action => {
    const route = routeFromNotificationData(action.notification.data);
    if (route) navigateInsideOmnia(route);
    void syncMobileNotifications({ emitNew: false });
  });

  if (getOmniaPlatform() === 'android') {
    await PushNotifications.createChannel({
      id: 'omnia-general',
      name: 'Omnia Global Academy',
      description: 'Formations, Lives, emplois, coaching et certificats.',
      importance: 4,
      visibility: 1,
      vibration: true,
    }).catch(() => undefined);
  }

  const permission = await PushNotifications.checkPermissions().catch(() => ({ receive: 'denied' as const }));
  updateState({ initialized: true, permission: permission.receive, lastError: null });
  if (permission.receive === 'granted') await PushNotifications.register().catch(() => undefined);

  window.addEventListener('omnia:session-changed', () => {
    void registerCurrentToken();
    void syncMobileNotifications({ emitNew: false });
  });
  window.addEventListener('omnia:session-ending', () => {
    const token = getSessionToken();
    if (token) void unregisterCurrentInstallation(token).catch(() => undefined);
  });
  window.addEventListener('omnia:profile-updated', event => {
    const detail = (event as CustomEvent<Record<string, unknown>>).detail || {};
    if (detail.allow_push === false) void disableMobilePush();
    else if (detail.allow_push === true && state.permission === 'granted') void PushNotifications.register();
  });
  window.addEventListener('omnia:network-status', () => {
    void registerCurrentToken();
    void syncMobileNotifications({ emitNew: true });
  });
  await App.addListener('appStateChange', ({ isActive }) => {
    active = isActive;
    if (isActive) {
      void registerCurrentToken();
      void syncMobileNotifications({ emitNew: true });
    }
  });

  await syncMobileNotifications({ emitNew: false });
  syncTimer = window.setInterval(() => void syncMobileNotifications({ emitNew: true }), 45_000);
  window.addEventListener('beforeunload', () => {
    if (syncTimer !== null) window.clearInterval(syncTimer);
  }, { once: true });
}
