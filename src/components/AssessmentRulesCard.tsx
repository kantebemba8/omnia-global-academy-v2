import { Clock3, Settings2, ShieldCheck } from 'lucide-react';

export function AssessmentRulesCard({
  durationMinutes = 0,
  courseId = 'new',
  onConfigure,
}: {
  durationMinutes?: number;
  courseId?: string;
  onConfigure?: () => void;
}) {
  const isDraftCreated = Boolean(courseId && courseId !== 'new');

  return (
    <div className="rounded-xl border p-4 shadow-sm" style={{ borderColor: '#E5D5A5', background: '#FFFBEB' }}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2">
            <ShieldCheck size={18} style={{ color: '#BF8813' }} />
            <h3 className="text-sm font-semibold" style={{ color: '#002050' }}>Évaluations, réussite et certification</h3>
          </div>
          <p className="text-xs leading-relaxed text-gray-600">
            Les seuils, délais entre tentatives et remédiations sont configurables pour chaque leçon, module et examen final. Pour une formation achetée, un échec ne bloque jamais définitivement l’apprenant : il déclenche la règle de reprise prévue. Le certificat reste conditionné à la réussite des évaluations obligatoires.
          </p>
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
            <Clock3 size={14} />
            Durée pédagogique calculée automatiquement : {Math.max(0, durationMinutes)} min. Ce calcul alimente les heures CPD et certifiées.
          </div>
        </div>
        <button
          type="button"
          onClick={onConfigure}
          disabled={!isDraftCreated || !onConfigure}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
          style={{ background: '#002050' }}
          title={!isDraftCreated ? 'Enregistrez d’abord le brouillon.' : undefined}
        >
          <Settings2 size={14} /> Configurer les règles
        </button>
      </div>
    </div>
  );
}
