import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Maximize2, Minimize2, RefreshCw } from 'lucide-react';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!scormUrl) { setError('URL SCORM manquante'); return; }

    function handleComplete(score?: number) {
      setCompleted(true);
      setProgress(100);
      onComplete?.(score);
    }

    function handleProgress(pct: number) {
      setProgress(pct);
      onProgress?.(pct);
    }

    // Injecter l'API SCORM dans la fenêtre de l'iframe
    const injectAPI = () => {
      try {
        const iframeWindow = iframeRef.current?.contentWindow as any;
        if (!iframeWindow) return;

        if (packageType === 'scorm_2004') {
          iframeWindow.API_1484_11 = createScorm2004API(handleComplete, handleProgress);
        } else {
          // SCORM 1.2 par défaut
          iframeWindow.API = createScorm12API(handleComplete, handleProgress);
        }
      } catch (e) {
        // Cross-origin — l'API doit être injectée au niveau window parent
        if (packageType === 'scorm_2004') {
          (window as any).API_1484_11 = createScorm2004API(handleComplete, handleProgress);
        } else {
          (window as any).API = createScorm12API(handleComplete, handleProgress);
        }
      }
    };

    // Injecter au niveau window parent (pour les packages qui cherchent dans parent)
    if (packageType === 'scorm_2004') {
      (window as any).API_1484_11 = createScorm2004API(handleComplete, handleProgress);
    } else {
      (window as any).API = createScorm12API(handleComplete, handleProgress);
    }

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
      // Nettoyage
      delete (window as any).API;
      delete (window as any).API_1484_11;
    };
  }, [scormUrl, packageType]);

  if (!scormUrl) return (
    <div className="flex items-center justify-center h-64 rounded-2xl border-2 border-dashed" style={{ borderColor: '#E4E7EC' }}>
      <div className="text-center">
        <AlertCircle size={32} className="mx-auto mb-2 opacity-30" style={{ color: '#002050' }} />
        <p className="text-sm" style={{ color: '#9CA3AF' }}>Aucun contenu SCORM configuré</p>
      </div>
    </div>
  );

  return (
    <div className={`rounded-2xl overflow-hidden border ${fullscreen ? 'fixed inset-0 z-50 rounded-none border-0' : ''}`}
      style={{ borderColor: '#E4E7EC' }}>

      {/* Barre de contrôle */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b"
        style={{ background: '#002050', borderColor: 'rgba(255,255,255,0.1)' }}>
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full" style={{ background: completed ? '#10B981' : progress > 0 ? '#BF8813' : '#9CA3AF' }} />
          <span className="text-sm font-semibold text-white">{title || 'Contenu SCORM'}</span>
          {packageType && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)' }}>
              {packageType === 'scorm_12' ? 'SCORM 1.2' : packageType === 'scorm_2004' ? 'SCORM 2004' : packageType.toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Barre de progression */}
          {progress > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: '#BF8813' }} />
              </div>
              <span className="text-xs text-white/70">{progress}%</span>
            </div>
          )}
          {completed && (
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: '#10B981', color: 'white' }}>
              ✓ Terminé
            </span>
          )}
          <button onClick={() => { setLoading(true); if (iframeRef.current) iframeRef.current.src += ''; }}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <RefreshCw size={14} color="white" />
          </button>
          <button onClick={() => setFullscreen(v => !v)}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            {fullscreen ? <Minimize2 size={14} color="white" /> : <Maximize2 size={14} color="white" />}
          </button>
        </div>
      </div>

      {/* Iframe SCORM */}
      <div className="relative" style={{ height: fullscreen ? 'calc(100vh - 48px)' : '560px', background: '#F8F9FA' }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10" style={{ background: '#F8F9FA' }}>
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3"
                style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
              <p className="text-sm" style={{ color: '#6B7280' }}>Chargement du contenu SCORM...</p>
            </div>
          </div>
        )}
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center p-8">
              <AlertCircle size={40} className="mx-auto mb-3" style={{ color: '#DC2626' }} />
              <p className="font-semibold mb-1" style={{ color: '#002050' }}>Erreur de chargement</p>
              <p className="text-sm mb-4" style={{ color: '#6B7280' }}>{error}</p>
              <button onClick={() => { setError(''); setLoading(true); if (iframeRef.current) iframeRef.current.src = scormUrl; }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white mx-auto"
                style={{ background: '#002050' }}>
                <RefreshCw size={14} /> Réessayer
              </button>
            </div>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            src={scormUrl}
            title={title || 'Contenu SCORM'}
            className="w-full h-full border-0"
            allow="fullscreen; autoplay; camera; microphone"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation"
          />
        )}
      </div>
    </div>
  );
}
