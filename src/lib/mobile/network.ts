import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { Network, type ConnectionStatus } from '@capacitor/network';

export type OmniaConnectionType = 'wifi' | 'cellular' | 'ethernet' | 'none' | 'unknown';

export interface OmniaNetworkStatus {
  connected: boolean;
  connectionType: OmniaConnectionType;
  source: 'native' | 'browser';
  updatedAt: number;
}

type NetworkSubscriber = () => void;

const subscribers = new Set<NetworkSubscriber>();
let initialized = false;
let nativeListener: PluginListenerHandle | null = null;
let browserOnlineHandler: (() => void) | null = null;
let browserOfflineHandler: (() => void) | null = null;
let currentStatus: OmniaNetworkStatus = {
  connected: typeof navigator === 'undefined' ? true : navigator.onLine,
  connectionType: 'unknown',
  source: 'browser',
  updatedAt: Date.now(),
};

function normalizeConnectionType(value: ConnectionStatus['connectionType'] | string): OmniaConnectionType {
  if (value === 'wifi' || value === 'cellular' || value === 'none' || value === 'unknown') return value;
  if (value === 'ethernet') return 'ethernet';
  return 'unknown';
}

function publish(next: Omit<OmniaNetworkStatus, 'updatedAt'>): void {
  const normalized: OmniaNetworkStatus = { ...next, updatedAt: Date.now() };
  if (
    normalized.connected === currentStatus.connected &&
    normalized.connectionType === currentStatus.connectionType &&
    normalized.source === currentStatus.source
  ) return;

  currentStatus = normalized;
  subscribers.forEach(subscriber => subscriber());
  window.dispatchEvent(new CustomEvent('omnia:network-status', { detail: currentStatus }));
}

function publishBrowserStatus(connected: boolean): void {
  publish({
    connected,
    connectionType: connected ? 'unknown' : 'none',
    source: 'browser',
  });
}

export async function initializeNetworkRuntime(): Promise<void> {
  if (initialized) return;
  initialized = true;

  if (Capacitor.isNativePlatform()) {
    try {
      const status = await Network.getStatus();
      publish({
        connected: status.connected,
        connectionType: normalizeConnectionType(status.connectionType),
        source: 'native',
      });
      nativeListener = await Network.addListener('networkStatusChange', next => {
        publish({
          connected: next.connected,
          connectionType: normalizeConnectionType(next.connectionType),
          source: 'native',
        });
      });
      return;
    } catch (error) {
      console.warn('[Omnia] Détection réseau native indisponible, utilisation du navigateur.', error);
    }
  }

  browserOnlineHandler = () => publishBrowserStatus(true);
  browserOfflineHandler = () => publishBrowserStatus(false);
  window.addEventListener('online', browserOnlineHandler);
  window.addEventListener('offline', browserOfflineHandler);
  publishBrowserStatus(navigator.onLine);
}

export function getOmniaNetworkStatus(): OmniaNetworkStatus {
  return currentStatus;
}

export function subscribeOmniaNetworkStatus(subscriber: NetworkSubscriber): () => void {
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
}

export function isMeteredOmniaConnection(status: OmniaNetworkStatus = currentStatus): boolean {
  return status.connected && status.connectionType === 'cellular';
}

export async function disposeNetworkRuntime(): Promise<void> {
  if (nativeListener) {
    await nativeListener.remove();
    nativeListener = null;
  }
  if (browserOnlineHandler) window.removeEventListener('online', browserOnlineHandler);
  if (browserOfflineHandler) window.removeEventListener('offline', browserOfflineHandler);
  browserOnlineHandler = null;
  browserOfflineHandler = null;
  initialized = false;
}
