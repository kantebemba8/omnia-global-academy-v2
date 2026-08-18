import { useEffect, useState } from 'react';
import { CalendarClock, Loader2, Save, Route } from 'lucide-react';
import { edgeAuthHeaders } from '../lib/edgeAuth';

const API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/studio-unified`;
const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

type LearningDesign = {
  delivery_mode: 'self_paced' | 'cohort' | 'blended';
  drip_enabled: boolean;
  drip_interval_days: number;
  cohort_start_at: string | null;
  completion_policy: 'all_required' | 'assessments_only';
  require_sequential_progress: boolean;
  require_video_completion: boolean;
};

type Props = {
  course: any;
  locked?: boolean;
  onPatch: (patch: Record<string, unknown>) => void;
  onSaved: (message: string) => void;
};

const DEFAULTS: LearningDesign = {
  delivery_mode: 'self_paced',
  drip_enabled: false,
  drip_interval_days: 7,
  cohort_start_at: null,
  completion_policy: 'all_required',
  require_sequential_progress: true,
  require_video_completion: false,
};

function localDateTime(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
function utc(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export default function CourseAdvancedSettingsPanel({ course, locked, onPatch, onSaved }: Props) {
  const incoming = course.learning_design_settings || {};
  const [design, setDesign] = useState<LearningDesign>({ ...DEFAULTS, ...incoming });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDesign({ ...DEFAULTS, ...(course.learning_design_settings || {}) });
  }, [course.id, course.learning_design_settings]);

  async function save() {
    if (!course.id) return;
    setSaving(true);
    try {
      const normalized: LearningDesign = {
        ...design,
        cohort_start_at: design.delivery_mode === 'self_paced' ? null : utc(design.cohort_start_at),
      };
      const response = await fetch(API, {
        method: 'POST', headers: edgeAuthHeaders(),
        body: JSON.stringify({ action: 'update_course', course_id: course.id, learning_design_settings: normalized }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) throw new Error(data.message || data.error || 'Enregistrement impossible');
      onPatch({ learning_design_settings: normalized });
      onSaved('Organisation du parcours enregistrée.');
    } catch (error) {
      onSaved(`Erreur : ${error instanceof Error ? error.message : 'enregistrement impossible'}`);
    } finally { setSaving(false); }
  }

  return <section className="rounded-2xl border bg-white p-5" style={{ borderColor: BORDER }}>
    <div className="flex items-start gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50"><Route size={18} color={GOLD}/></span>
      <div>
        <h2 className="text-lg font-black" style={{ color: BLUE }}>Organisation du parcours</h2>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">Choisissez uniquement comment l'apprenant progresse. La durée, l'accessibilité et la qualité sont contrôlées automatiquement ailleurs.</p>
      </div>
    </div>

    <div className="mt-5 grid gap-5 lg:grid-cols-2">
      <div className="space-y-4 rounded-2xl bg-slate-50 p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold" style={{ color: BLUE }}><CalendarClock size={17} color={GOLD}/>Diffusion</h3>
        <label className="block text-xs font-semibold text-gray-600">Mode
          <select disabled={locked} value={design.delivery_mode} onChange={e => setDesign(x => ({ ...x, delivery_mode: e.target.value as LearningDesign['delivery_mode'] }))} className="mt-1 h-10 w-full rounded-xl border bg-white px-3 text-sm" style={{ borderColor: BORDER }}>
            <option value="self_paced">À son rythme</option><option value="cohort">Cohorte avec date de début</option><option value="blended">Parcours hybride</option>
          </select>
        </label>
        {design.delivery_mode !== 'self_paced' && <label className="block text-xs font-semibold text-gray-600">Début de la cohorte
          <input disabled={locked} type="datetime-local" value={localDateTime(design.cohort_start_at)} onChange={e => setDesign(x => ({ ...x, cohort_start_at: e.target.value || null }))} className="mt-1 h-10 w-full rounded-xl border bg-white px-3 text-sm" style={{ borderColor: BORDER }}/>
        </label>}
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700"><input disabled={locked} type="checkbox" checked={design.drip_enabled} onChange={e => setDesign(x => ({ ...x, drip_enabled: e.target.checked }))}/>Débloquer progressivement les modules</label>
        {design.drip_enabled && <label className="block text-xs font-semibold text-gray-600">Intervalle entre modules (jours)
          <input disabled={locked} type="number" min={1} value={design.drip_interval_days} onChange={e => setDesign(x => ({ ...x, drip_interval_days: Math.max(1, Number(e.target.value || 1)) }))} className="mt-1 h-10 w-full rounded-xl border bg-white px-3 text-sm" style={{ borderColor: BORDER }}/>
        </label>}
      </div>

      <div className="space-y-4 rounded-2xl bg-slate-50 p-4">
        <h3 className="text-sm font-bold" style={{ color: BLUE }}>Progression</h3>
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700"><input disabled={locked} type="checkbox" checked={design.require_sequential_progress} onChange={e => setDesign(x => ({ ...x, require_sequential_progress: e.target.checked }))}/>Respecter l'ordre des leçons et modules</label>
        <label className="block text-xs font-semibold text-gray-600">Condition de complétion
          <select disabled={locked} value={design.completion_policy} onChange={e => setDesign(x => ({ ...x, completion_policy: e.target.value as LearningDesign['completion_policy'] }))} className="mt-1 h-10 w-full rounded-xl border bg-white px-3 text-sm" style={{ borderColor: BORDER }}>
            <option value="all_required">Tous les éléments obligatoires</option><option value="assessments_only">Évaluations obligatoires uniquement</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700"><input disabled={locked} type="checkbox" checked={design.require_video_completion} onChange={e => setDesign(x => ({ ...x, require_video_completion: e.target.checked }))}/>Exiger le visionnage des vidéos marquées obligatoires</label>
        <div className="rounded-xl border bg-white p-3 text-xs leading-5 text-slate-600" style={{ borderColor: BORDER }}>
          Durée pédagogique calculée : <strong style={{ color: BLUE }}>{Math.max(0, Number(course.calculated_duration_minutes || 0))} min</strong>. Cette valeur n'est jamais saisie manuellement.
        </div>
      </div>
    </div>

    <div className="mt-5 flex justify-end"><button disabled={locked || saving} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50" style={{ background: BLUE }}>{saving ? <Loader2 size={15} className="animate-spin"/> : <Save size={15}/>}Enregistrer</button></div>
  </section>;
}
