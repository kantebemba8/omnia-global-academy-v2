import { useEffect, useState, useSyncExternalStore } from 'react';
import { Bell, BellOff, Check, ExternalLink, X } from 'lucide-react';
import { getStoredUser } from '../../lib/session';
import {
  getMobileNotificationState,
  initializeMobileNotificationRuntime,
  markMobileNotification,
  requestMobilePushPermission,
  subscribeMobileNotificationState,
  type OmniaMobileNotification,
} from '../../lib/mobile/notifications';
import { isNativeApp } from '../../lib/mobile/platform';
import { navigateInsideOmnia } from '../../lib/mobile/deepLinks';

const DISMISS_KEY = 'omnia_push_prompt_dismissed';

export function MobileNotificationBridge() {
  const notificationState = useSyncExternalStore(
    subscribeMobileNotificationState,
    getMobileNotificationState,
    getMobileNotificationState,
  );
  const [latest, setLatest] = useState<OmniaMobileNotification | null>(null);
  const [promptDismissed, setPromptDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1');
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (!isNativeApp()) return;
    void initializeMobileNotificationRuntime();
    const listener = (event: Event) => {
      const notification = (event as CustomEvent<OmniaMobileNotification>).detail;
      if (notification) setLatest(notification);
    };
    window.addEventListener('omnia:mobile-notification', listener);
    return () => window.removeEventListener('omnia:mobile-notification', listener);
  }, []);

  if (!isNativeApp()) return null;

  const user = getStoredUser<{ id?: string; allow_push?: boolean }>();
  const showPermissionPrompt = Boolean(
    user?.id &&
    user.allow_push !== false &&
    !promptDismissed &&
    (notificationState.permission === 'prompt' || notificationState.permission === 'prompt-with-rationale'),
  );

  async function enablePush() {
    setRequesting(true);
    await requestMobilePushPermission();
    setRequesting(false);
  }

  function dismissPrompt() {
    localStorage.setItem(DISMISS_KEY, '1');
    setPromptDismissed(true);
  }

  function openLatest() {
    if (!latest) return;
    if (latest.action_url) navigateInsideOmnia(latest.action_url);
    void markMobileNotification(latest, 'read').catch(() => undefined);
    setLatest(null);
  }

  return (
    <>
      {showPermissionPrompt && (
        <aside className="oga-mobile-push-prompt" role="status" aria-live="polite">
          <div className="flex min-w-0 items-start gap-3">
            <Bell className="mt-0.5 h-5 w-5 shrink-0 text-[#BF8813]" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#002050]">Activer les notifications Omnia</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Recevez les rappels de formation, Lives, coaching, emplois et certificats. Vous pourrez les désactiver dans les réglages du téléphone.
              </p>
              {notificationState.lastError && (
                <p className="mt-2 text-xs text-amber-700">La configuration push du projet doit encore être finalisée.</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={enablePush} disabled={requesting}
                  className="rounded-lg bg-[#002050] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">
                  {requesting ? 'Activation…' : 'Activer'}
                </button>
                <button type="button" onClick={dismissPrompt}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600">
                  Plus tard
                </button>
              </div>
            </div>
          </div>
          <button type="button" onClick={dismissPrompt} aria-label="Fermer"
            className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </aside>
      )}

      {latest && (
        <aside className="oga-mobile-notification-toast" role="alert" aria-live="assertive">
          <div className="flex min-w-0 items-start gap-3">
            {latest.priority === 'critical' ? <BellOff className="mt-0.5 h-5 w-5 text-red-600" /> : <Bell className="mt-0.5 h-5 w-5 text-[#BF8813]" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-[#002050]">{latest.title || 'Omnia Global Academy'}</p>
              {latest.message && <p className="mt-1 line-clamp-3 text-xs leading-5 text-slate-600">{latest.message}</p>}
              <div className="mt-3 flex gap-2">
                {latest.action_url && (
                  <button type="button" onClick={openLatest}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#002050] px-3 py-2 text-xs font-semibold text-white">
                    Ouvrir <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                )}
                <button type="button" onClick={() => { void markMobileNotification(latest, 'read').catch(() => undefined); setLatest(null); }}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600">
                  <Check className="h-3.5 w-3.5" /> Lu
                </button>
              </div>
            </div>
          </div>
          <button type="button" onClick={() => setLatest(null)} aria-label="Fermer"
            className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </aside>
      )}
    </>
  );
}
