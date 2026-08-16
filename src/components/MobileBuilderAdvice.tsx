import { useEffect, useState } from 'react';
import { Monitor, X } from 'lucide-react';

type Props = {
  storageKey: string;
  title?: string;
  description?: string;
};

function isMobileViewport() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 767px)').matches;
}

export default function MobileBuilderAdvice({
  storageKey,
  title = 'Conseil pour une meilleure expérience',
  description = 'La création sur mobile est entièrement prise en charge. Pour les mises en page complexes, les imports et la réorganisation de nombreux éléments, l’utilisation d’un ordinateur est recommandée.',
}: Props) {
  const localKey = `oga:mobile-builder-advice:${storageKey}:never`;
  const sessionKey = `oga:mobile-builder-advice:${storageKey}:session`;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isMobileViewport()) return;
    try {
      if (window.localStorage.getItem(localKey) === '1') return;
      if (window.sessionStorage.getItem(sessionKey) === '1') return;
    } catch {
      // Le conseil reste non bloquant même si le stockage du navigateur est indisponible.
    }
    setOpen(true);
  }, [localKey, sessionKey]);

  function dismissSession() {
    try { window.sessionStorage.setItem(sessionKey, '1'); } catch {}
    setOpen(false);
  }

  function dismissForever() {
    try {
      window.localStorage.setItem(localKey, '1');
      window.sessionStorage.setItem(sessionKey, '1');
    } catch {}
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[220] flex items-end justify-center bg-slate-950/45 p-3 backdrop-blur-[2px] md:hidden">
      <div role="dialog" aria-modal="true" aria-labelledby={`${storageKey}-mobile-advice-title`} className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#002050] text-white">
            <Monitor className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <h2 id={`${storageKey}-mobile-advice-title`} className="text-base font-bold text-[#002050]">{title}</h2>
              <button type="button" onClick={dismissSession} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Fermer"><X className="h-4 w-4" /></button>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button type="button" onClick={dismissSession} className="rounded-xl bg-[#002050] px-4 py-2.5 text-sm font-semibold text-white">OK</button>
          <button type="button" onClick={dismissForever} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#002050]">Ne plus me le rappeler</button>
        </div>
      </div>
    </div>
  );
}
