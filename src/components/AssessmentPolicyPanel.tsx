import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, Loader2, RotateCcw, Save, X, type LucideIcon } from 'lucide-react';
import { edgeAuthHeaders } from '../lib/edgeAuth';

const API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/studio-unified`;
const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

type AssessmentRow = {
  id: string;
  title: string;
  scope: 'lesson' | 'module' | 'final';
  passing_score: number;
  max_attempts: number;
  retry_cooldown_hours: number;
  remediation_after_attempts: number;
  remediation_mode: 'none' | 'review_lesson' | 'review_module' | 'exercise' | 'manual';
  time_limit_minutes?: number | null;
  required: boolean;
  retry_instructions?: string;
};

async function call(action: string, payload: Record<string, unknown>) {
  const response = await fetch(API, {
    method: 'POST',
    headers: edgeAuthHeaders(),
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await response.json();
  if (!response.ok || data.success === false) throw new Error(data.message || data.error || 'Erreur');
  return data;
}

export function AssessmentPolicyPanel({ courseId, locked, onClose }: { courseId: string; locked?: boolean; onClose: () => void }) {
  const [rows, setRows] = useState<AssessmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      await call('ensure_assessments', { course_id: courseId });
      const data = await call('assessment_policy_get', { course_id: courseId });
      setRows((data.assessments || []).map((row: AssessmentRow) => ({
        ...row,
        max_attempts: Number(row.max_attempts || row.remediation_after_attempts || 3),
        remediation_after_attempts: Number(row.remediation_after_attempts || row.max_attempts || 3),
        retry_cooldown_hours: Number(row.retry_cooldown_hours || 0),
      })));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [courseId]);

  const groups = useMemo(() => ({
    lesson: rows.filter(row => row.scope === 'lesson'),
    module: rows.filter(row => row.scope === 'module'),
    final: rows.filter(row => row.scope === 'final'),
  }), [rows]);

  function update(id: string, patch: Partial<AssessmentRow>) {
    setRows(current => current.map(row => row.id === id ? { ...row, ...patch } : row));
  }

  async function save() {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await call('assessment_policy_update', {
        course_id: courseId,
        policy: {
          purchased_access: 'until_passed',
          certificate_requires_success: true,
          default_retry_cooldown_hours: rows[0]?.retry_cooldown_hours ?? 24,
          default_remediation_after_attempts: rows[0]?.remediation_after_attempts ?? 3,
          default_remediation_mode: rows[0]?.remediation_mode ?? 'review_module',
        },
        assessments: rows,
      });
      setMessage('Les règles ont été enregistrées. Elles seront contrôlées lors de la soumission.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-black/50 p-4">
      <div className="mx-auto my-6 w-full max-w-6xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b px-6 py-5" style={{ borderColor: BORDER }}>
          <div>
            <h2 className="text-lg font-bold" style={{ color: BLUE }}>Évaluations, tentatives et remédiation</h2>
            <p className="mt-1 max-w-3xl text-sm text-gray-600">
              Pour une formation achetée, les tentatives restent possibles jusqu’à la réussite. Le nombre configuré déclenche une remédiation et non une exclusion définitive.
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-gray-100" aria-label="Fermer"><X size={20} /></button>
        </div>

        <div className="px-6 py-5">
          <div className="mb-5 grid gap-3 md:grid-cols-3">
            <Info icon={RotateCcw} title="Tentatives" text="Seuil avant remédiation, jamais certificat automatique." />
            <Info icon={Clock3} title="Délai" text="Temps d’attente avant une nouvelle tentative." />
            <Info icon={CheckCircle2} title="Certification" text="Le certificat exige toujours la réussite des évaluations obligatoires." />
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500"><Loader2 className="animate-spin" size={18} />Chargement…</div>
          ) : (
            <div className="space-y-7">
              <AssessmentGroup title="Évaluations des leçons" rows={groups.lesson} locked={locked} onUpdate={update} />
              <AssessmentGroup title="Évaluations des modules" rows={groups.module} locked={locked} onUpdate={update} />
              <AssessmentGroup title="Examen final" rows={groups.final} locked={locked} onUpdate={update} />
            </div>
          )}

          {message && <p className="mt-5 rounded-xl bg-green-50 p-3 text-sm text-green-700">{message}</p>}
          {error && <p className="mt-5 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700"><AlertCircle size={16} />{error}</p>}
        </div>

        <div className="flex justify-end gap-3 border-t px-6 py-4" style={{ borderColor: BORDER }}>
          <button onClick={onClose} className="rounded-xl border px-4 py-2.5 text-sm font-semibold" style={{ borderColor: BORDER }}>Fermer</button>
          <button disabled={locked || saving || loading} onClick={save} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40" style={{ background: BLUE }}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Enregistrer les règles
          </button>
        </div>
      </div>
    </div>
  );
}

function AssessmentGroup({ title, rows, locked, onUpdate }: { title: string; rows: AssessmentRow[]; locked?: boolean; onUpdate: (id: string, patch: Partial<AssessmentRow>) => void }) {
  if (!rows.length) return null;
  return (
    <section>
      <h3 className="mb-3 font-semibold" style={{ color: BLUE }}>{title}</h3>
      <div className="space-y-3">
        {rows.map(row => (
          <div key={row.id} className="rounded-xl border p-4" style={{ borderColor: BORDER }}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="font-medium" style={{ color: BLUE }}>{row.title}</p>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-600">
                <input type="checkbox" checked={row.required !== false} disabled={locked} onChange={event => onUpdate(row.id, { required: event.target.checked })} /> Obligatoire
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <NumberField label="Seuil de réussite (%)" value={row.passing_score} min={1} max={100} disabled={locked} onChange={value => onUpdate(row.id, { passing_score: value })} />
              <NumberField label="Échecs avant remédiation" value={row.remediation_after_attempts} min={1} disabled={locked} onChange={value => onUpdate(row.id, { remediation_after_attempts: value, max_attempts: value })} />
              <NumberField label="Délai avant reprise (heures)" value={row.retry_cooldown_hours} min={0} disabled={locked} onChange={value => onUpdate(row.id, { retry_cooldown_hours: value })} />
              <NumberField label="Durée de l’épreuve (min)" value={row.time_limit_minutes || 0} min={0} disabled={locked} onChange={value => onUpdate(row.id, { time_limit_minutes: value || null })} />
              <label className="text-xs font-semibold text-gray-600">Remédiation
                <select value={row.remediation_mode} disabled={locked} onChange={event => onUpdate(row.id, { remediation_mode: event.target.value as AssessmentRow['remediation_mode'] })} className="mt-1 h-10 w-full rounded-lg border px-2 text-sm" style={{ borderColor: BORDER }}>
                  <option value="none">Aucune</option>
                  <option value="review_lesson">Revoir la leçon</option>
                  <option value="review_module">Revoir le module</option>
                  <option value="exercise">Exercice complémentaire</option>
                  <option value="manual">Décision du formateur</option>
                </select>
              </label>
            </div>
            <label className="mt-4 block text-xs font-semibold text-gray-600">Instructions après un échec
              <input value={row.retry_instructions || ''} disabled={locked} onChange={event => onUpdate(row.id, { retry_instructions: event.target.value })} className="mt-1 h-10 w-full rounded-lg border px-3 text-sm" style={{ borderColor: BORDER }} placeholder="Ex. Revoyez le module avant de reprendre l’évaluation." />
            </label>
          </div>
        ))}
      </div>
    </section>
  );
}

function NumberField({ label, value, min, max, disabled, onChange }: { label: string; value: number; min: number; max?: number; disabled?: boolean; onChange: (value: number) => void }) {
  return <label className="text-xs font-semibold text-gray-600">{label}<input type="number" min={min} max={max} value={value} disabled={disabled} onChange={event => onChange(Number(event.target.value || min))} className="mt-1 h-10 w-full rounded-lg border px-3 text-sm" style={{ borderColor: BORDER }} /></label>;
}

function Info({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return <div className="rounded-xl border p-4" style={{ borderColor: BORDER }}><Icon size={18} color={GOLD} /><p className="mt-2 text-sm font-semibold" style={{ color: BLUE }}>{title}</p><p className="mt-1 text-xs text-gray-600">{text}</p></div>;
}
