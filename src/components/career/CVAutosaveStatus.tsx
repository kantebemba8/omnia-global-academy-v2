import { CheckCircle2, Clock, Loader2 } from 'lucide-react';

type Status = 'idle' | 'saving' | 'saved' | 'error';

export function CVAutosaveStatus({ status }: { status: Status }) {
  if (status === 'idle') return null;
  return (
    <div className="flex items-center gap-1.5 text-xs font-medium">
      {status === 'saving' && (
        <><Loader2 size={12} className="animate-spin text-slate-400" /><span className="text-slate-400">Enregistrement...</span></>
      )}
      {status === 'saved' && (
        <><CheckCircle2 size={12} className="text-green-500" /><span className="text-green-600">Enregistré automatiquement</span></>
      )}
      {status === 'error' && (
        <><Clock size={12} className="text-red-400" /><span className="text-red-500">Erreur d'enregistrement</span></>
      )}
    </div>
  );
}
