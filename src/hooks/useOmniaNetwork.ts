import { useSyncExternalStore } from 'react';
import { getOmniaNetworkStatus, subscribeOmniaNetworkStatus } from '../lib/mobile/network';

export function useOmniaNetworkStatus() {
  return useSyncExternalStore(
    subscribeOmniaNetworkStatus,
    getOmniaNetworkStatus,
    getOmniaNetworkStatus,
  );
}
