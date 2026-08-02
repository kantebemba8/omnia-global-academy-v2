import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Maximize2, Minimize2, RefreshCw, WifiOff } from 'lucide-react';
import { useOmniaNetworkStatus } from '../hooks/useOmniaNetwork';

interface ScormPlayerProps {
  scormUrl: string;        // URL du ZIP SCORM extrait ou du point d'entrée
  packageType?: string;    // scorm_12 | scorm_2004 | xapi
  title?: string;
  onComplete?: (score?: number) => void;
  onProgress?: (percent: number) => void;
}

// ─── SCORM 1.2 API Runtime ────────────────────────────────────
function createScorm12API(onComplete: (score?: number) => void, onProgress: (p: number) => void) {
  const data: Record<string, string> = {
    'cmi.core.lesson_status': 'not attempted',
    'cmi.core.score.raw': '',
    'cmi.core.lesson_location': '',
    'cmi.core.session_time': '',
    'cmi.suspend_data': '',
  };

  return {
    LMSInitialize: () => { console.log('[SCORM 1.2] LMSInitialize'); return 'true'; },
    LMSFinish: () => {
      const status = data['cmi.core.lesson_status'];
      const score = parseFloat(data['cmi.core.score.raw']) || undefined;
      if (['completed', 'passed'].includes(status)) onComplete(score);
      console.log('[SCORM 1.2] LMSFinish — status:', status, 'score:', score);
      return 'true';
    },
    LMSGetValue: (element: string) => {
      const val = data[element] ?? '';
      console.log('[SCORM 1.2] LMSGetValue', element, '=', val);
      return val;
    },
    LMSSetValue: (element: string, value: string) => {
      data[element] = value;
      console.log('[SCORM 1.2] LMSSetValue', element, '=', value);
      // Suivre la progression via lesson_location si c'est un pourcentage
      if (element === 'cmi.core.lesson_location') {
        const pct = parseFloat(value);
        if (!isNaN(pct) && pct >= 0 && pct <= 100) onProgress(pct);
      }
      if (element === 'cmi.core.lesson_status') {
        if (['completed', 'passed'].includes(value)) onProgress(100);
      }
      return 'true';
    },
    LMSCommit: () => { console.log('[SCORM 1.2] LMSCommit'); return 'true'; },
    LMSGetLastError: () => '0',
    LMSGetErrorString: () => 'No error',
    LMSGetDiagnostic: () => '',
  };
}

// ─── SCORM 2004 API Runtime ───────────────────────────────────
function createScorm2004API(onComplete: (score?: number) => void, onProgress: (p: number) => void) {
  const data: Record<string, string> = {
    'cmi.completion_status': 'unknown',
    'cmi.success_status': 'unknown',
    'cmi.score.raw': '',
    'cmi.score.scaled': '',
    'cmi.location': '',
    'cmi.suspend_data': '',
    'cmi.progress_measure': '',
  };

  return {
    Initialize: () => { console.log('[SCORM 2004] Initialize'); return 'true'; },
    Terminate: () => {
      const completion = data['cmi.completion_status'];
      const success = data['cmi.success_status'];
      const score = parseFloat(data['cmi.score.raw']) || undefined;
      if (['completed'].includes(completion) || ['passed'].includes(success)) onComplete(score);
      return 'true';
    },
    GetValue: (element: string) => data[element] ?? '',
    SetValue: (element: string, value: string) => {
      data[element] = value;
      if (element === 'cmi.progress_measure') {
        const pct = parseFloat(value) * 100;
        if (!isNaN(pct)) onProgress(Math.round(pct));
      }
      if (element === 'cmi.completion_status' && value === 'completed') {
        onProgress(100);
      }
      return 'true';
    },
    Commit: () => 'true',
    GetLastError: () => '0',
    GetErrorString: () => '',
    GetDiagnostic: () => '',
  };
}

export function ScormPlayer({ scormUrl, packageType = 'scorm_12', title, onComplete, onProgress }: ScormPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const onCompleteRef = useRef(onComplete);
  const onProgressRef = useRef(onProgress);
  const network = useOmniaNetworkStatus();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [completed, setCompleted] = useState(false);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { onProgressRef.current = onProgress; }, [onProgress]);

  useEffect(() => {
    if (!network.connected) {
      setLoading(false);
      return;
    }
    if (!scormUrl) {
      setError('URL SCORM manquante');
      setLoading(false);
      return;
    }

    setError('');
    setLoading(true);

    function handleComplete(score?: number) {
      setCompleted(true);
      setProgress(100);
      onCompleteRef.current?.(score);
    }

    function handleProgress(pct: number) {
      setProgress(pct);
      onProgressRef.current?.(pct);
    }

    const createApi = () => packageType === 'scorm_2004'
      ? createScorm2004API(handleComplete, handleProgress)
      : createScorm12API(handleComplete, handleProgress);

    const injectAPI = () => {
      try {
        const iframeWindow = iframeRef.current?.contentWindow as (Window & { API?: unknown; API_1484_11?: unknown }) | null;
        if (!iframeWindow) return;
        if (packageType === 'scorm_2004') iframeWindow.API_1484_11 = createApi();
        else iframeWindow.API = createApi();
      } catch {
        // Certains paquets cherchent l'API dans la fenêtre parente.
      }
    };

    const hostWindow = window as Window & { API?: unknown; API_1484_11?: unknown };
    if (packageType === 'scorm_2004') hostWindow.API_1484_11 = createApi();
    else hostWindow.API = createApi();

    const iframe = iframeRef.current;
    if (iframe) {
      iframe.onload = () => {
        setLoading(false);
        injectAPI();
      };
      iframe.onerror = () => {
        setError('Impossible de charger le contenu SCORM');
        setLoading(false);
      };
    }

    return () => {
      if (iframe) {
        iframe.onload = null;
        iframe.onerror = null;
      }
      delete hostWindow.API;
      delete hostWindow.API_1484_11;
    };
  }, [scormUrl, packageType, network.connected]);

  if (!scormUrl) return (
    <div className="flex h-64 items-center justify-center rounded-2xl border-2 border-dashed" style={{ borderColor: '#E4E7EC' }}>
      <div className="text-center">
        <AlertCircle size={32} className="mx-auto mb-2 opacity-30" style={{ color: '#002050' }} />
        <p className="text-sm" style={{ color: '#9CA3AF' }}>Aucun contenu SCORM configuré</p>
      </div>
    </div>
  );

  if (!network.connected) return (
    <div className="flex min-h-64 items-center justify-center rounded-2xl border p-6 text-center" style={{ borderColor: '#BF8813', backgroundColor: '#FFFBEB' }}>
      <div>
        <WifiOff size={36} className="mx-auto mb-3" style={{ color: '#BF8813' }} />
        <p className="font-semibold" style={{ color: '#002050' }}>Contenu SCORM disponible en ligne</p>
        <p className="mt-1 max-w-md text-sm" style={{ color: '#6B7280' }}>
          Ce paquet interactif ne peut pas être exécuté hors connexion. La leçon enregistrée reste accessible et le lecteur reprendra lorsque le réseau reviendra.
        </p>
      </div>
    </div>
  );

  const reload = () => {
    setError('');
    setLoading(true);
    if (iframeRef.current) iframeRef.current.src = scormUrl;
  };

  return (
    <div
      className={`overflow-hidden rounded-2xl border ${fullscreen ? 'oga-scorm-fullscreen fixed z-[150] rounded-none border-0' : ''}`}
      style={{ borderColor: '#E4E7EC' }}
    >
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5" style={{ background: '#002050', borderColor: 'rgba(255,255,255,0.1)' }}>
        <div className="flex min-w-0 items-center gap-3">
          <div className="h-2 w-2 shrink-0 rounded-full" style={{ background: completed ? '#10B981' : progress > 0 ? '#BF8813' : '#9CA3AF' }} />
          <span className="truncate text-sm font-semibold text-white">{title || 'Contenu SCORM'}</span>
          {packageType && (
            <span className="hidden rounded-full px-2 py-0.5 text-xs sm:inline" style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)' }}>
              {packageType === 'scorm_12' ? 'SCORM 1.2' : packageType === 'scorm_2004' ? 'SCORM 2004' : packageType.toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {progress > 0 && (
            <div className="hidden items-center gap-2 sm:flex">
              <div className="h-1.5 w-24 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: '#BF8813' }} />
              </div>
              <span className="text-xs text-white/70">{progress}%</span>
            </div>
          )}
          {completed && <span className="hidden rounded-full px-2 py-0.5 text-xs font-semibold text-white sm:inline" style={{ background: '#10B981' }}>Terminé</span>}
          <button type="button" onClick={reload} aria-label="Recharger le contenu SCORM" className="rounded-lg p-1.5 transition-colors hover:bg-white/10">
            <RefreshCw size={14} color="white" />
          </button>
          <button type="button" onClick={() => setFullscreen(value => !value)} aria-label={fullscreen ? 'Quitter le plein écran' : 'Afficher en plein écran'} className="rounded-lg p-1.5 transition-colors hover:bg-white/10">
            {fullscreen ? <Minimize2 size={14} color="white" /> : <Maximize2 size={14} color="white" />}
          </button>
        </div>
      </div>

      <div className="relative" style={{ height: fullscreen ? 'calc(100dvh - 48px)' : 'min(560px, 70dvh)', minHeight: 360, background: '#F8F9FA' }}>
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center" style={{ background: '#F8F9FA' }}>
            <div className="text-center">
              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
              <p className="text-sm" style={{ color: '#6B7280' }}>Chargement du contenu SCORM...</p>
            </div>
          </div>
        )}
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="p-8 text-center">
              <AlertCircle size={40} className="mx-auto mb-3" style={{ color: '#DC2626' }} />
              <p className="mb-1 font-semibold" style={{ color: '#002050' }}>Erreur de chargement</p>
              <p className="mb-4 text-sm" style={{ color: '#6B7280' }}>{error}</p>
              <button type="button" onClick={reload} className="mx-auto flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: '#002050' }}>
                <RefreshCw size={14} /> Réessayer
              </button>
            </div>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            src={scormUrl}
            title={title || 'Contenu SCORM'}
            className="h-full w-full border-0"
            allow="fullscreen; autoplay; camera; microphone"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation-by-user-activation"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        )}
      </div>
    </div>
  );
}
