import { Clock3, Loader2, Settings2, ShieldCheck } from 'lucide-react';

export function AssessmentRulesCard({
  durationMinutes = 0,
  courseId = 'new',
  busy = false,
  locked = false,
  onConfigure,
}: {
  durationMinutes?: number;
  courseId?: string;
  busy?: boolean;
  locked?: boolean;
  onConfigure?: () => void | Promise<void>;
}) {
  const isDraftCreated = Boolean(courseId && courseId !== 'new');
  const actionLabel = locked
    ? 'Consulter les règles'
    : isDraftCreated
      ? 'Configurer les règles'
      : 'Créer le brouillon et configurer';

  return (
    <div
      className="rounded-xl border px-4 py-3 shadow-sm sm:px-5 sm:py-4"
      style={{ borderColor: '#E5D5A5', background: '#FFFBEB' }}
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            <ShieldCheck size={18} style={{ color: '#BF8813' }} />
            <h3 className="text-sm font-semibold" style={{ color: '#002050' }}>
              Évaluations, réussite et certification
            </h3>
          </div>
          <p className="text-xs leading-relaxed text-gray-600">
            Configurez les seuils, tentatives, délais de reprise, remédiations, jurys et compétences pour chaque leçon, module et examen final. Le certificat reste conditionné à la réussite des évaluations obligatoires.
          </p>
          <div className="mt-3 flex flex-col gap-1.5 text-xs text-gray-600 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
            <span className="inline-flex items-center gap-2">
              <Clock3 size={14} />
              Durée pédagogique calculée : {Math.max(0, durationMinutes)} min
            </span>
            {!isDraftCreated && !locked && (
              <span className="font-medium" style={{ color: '#92400E' }}>
                Le brouillon sera créé automatiquement après validation du titre et de la description courte.
              </span>
            )}
            {locked && (
              <span className="font-medium" style={{ color: '#6B7280' }}>
                Formation verrouillée : consultation uniquement.
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void onConfigure?.()}
          disabled={busy || !onConfigure}
          aria-busy={busy}
          className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto"
          style={{ background: '#002050' }}
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Settings2 size={15} />}
          {busy ? 'Préparation…' : actionLabel}
        </button>
      </div>
    </div>
  );
}
