import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, CheckCircle2, Eye, Loader2, Monitor, RotateCcw,
  Save, ShieldCheck, Video, X, type LucideIcon,
} from 'lucide-react';
import { edgeAuthHeaders } from '../lib/edgeAuth';

const API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/studio-unified`;
const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

type ProctoringSettings = {
  camera_required?: boolean;
  microphone_required?: boolean;
  screen_share_required?: boolean;
  tab_switch_tracking?: boolean;
  fullscreen_required?: boolean;
  human_proctor_required?: boolean;
  recording_required?: boolean;
};

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
  assessment_type: 'quiz' | 'exam' | 'case_study' | 'project' | 'practical' | 'oral' | 'assignment';
  delivery_mode: 'asynchronous' | 'scheduled_online' | 'scheduled_in_person' | 'hybrid';
  security_level: number;
  session_required: boolean;
  identity_verification_required: boolean;
  proctoring_settings: ProctoringSettings;
  result_release_mode: 'immediate' | 'after_review' | 'manual';
  competency_labels: string[];
  allowed_materials?: string;
  candidate_instructions?: string;
  integrity_rules?: string;
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
      setRows((data.assessments || []).map((row: Partial<AssessmentRow> & Pick<AssessmentRow, 'id' | 'title' | 'scope'>) => ({
        ...row,
        passing_score: Number(row.passing_score || 70),
        max_attempts: Number(row.max_attempts || row.remediation_after_attempts || 3),
        remediation_after_attempts: Number(row.remediation_after_attempts || row.max_attempts || 3),
        retry_cooldown_hours: Number(row.retry_cooldown_hours || 0),
        remediation_mode: row.remediation_mode || 'review_module',
        required: row.required !== false,
        assessment_type: row.assessment_type || (row.scope === 'final' ? 'exam' : 'quiz'),
        delivery_mode: row.delivery_mode || 'asynchronous',
        security_level: Number(row.security_level || 1),
        session_required: row.session_required === true,
        identity_verification_required: row.identity_verification_required === true,
        proctoring_settings: row.proctoring_settings || {},
        result_release_mode: row.result_release_mode || 'after_review',
        competency_labels: Array.isArray(row.competency_labels) ? row.competency_labels : [],
      } as AssessmentRow)));
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
      setMessage('Les règles d’évaluation et de surveillance ont été enregistrées. Elles seront contrôlées par le Centre Qualité.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-black/50 p-4">
      <div className="mx-auto my-6 w-full max-w-7xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b px-6 py-5" style={{ borderColor: BORDER }}>
          <div>
            <h2 className="text-lg font-bold" style={{ color: BLUE }}>Évaluations, tentatives et surveillance</h2>
            <p className="mt-1 max-w-4xl text-sm text-gray-600">
              Configurez chaque évaluation. Le Centre Qualité valide ensuite le niveau de surveillance, les seuils, la remédiation et les conditions de publication du résultat.
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-gray-100" aria-label="Fermer"><X size={20} /></button>
        </div>

        <div className="px-6 py-5">
          <div className="mb-5 grid gap-3 md:grid-cols-4">
            <Info icon={RotateCcw} title="Tentatives" text="La remédiation remplace le blocage définitif pour une formation achetée." />
            <Info icon={ShieldCheck} title="Contrôle qualité" text="Le Super Admin valide la surveillance proposée avant publication." />
            <Info icon={Monitor} title="Sessions" text="Les examens officiels peuvent être programmés à une date précise." />
            <Info icon={CheckCircle2} title="Résultats" text="La réussite alimente certificats, CLR et Skills Passport." />
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
      <div className="space-y-4">
        {rows.map(row => (
          <div key={row.id} className="rounded-xl border p-4" style={{ borderColor: BORDER }}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium" style={{ color: BLUE }}>{row.title}</p>
                <p className="mt-1 text-xs text-gray-500">Niveau de surveillance proposé : {row.security_level}/4</p>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-600">
                <input type="checkbox" checked={row.required !== false} disabled={locked} onChange={event => onUpdate(row.id, { required: event.target.checked })} /> Obligatoire
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SelectField label="Type d’évaluation" value={row.assessment_type} disabled={locked} onChange={value => onUpdate(row.id, { assessment_type: value as AssessmentRow['assessment_type'] })} options={[
                ['quiz', 'Quiz'], ['exam', 'Examen'], ['case_study', 'Étude de cas'], ['project', 'Projet'], ['practical', 'Épreuve pratique'], ['oral', 'Oral / soutenance'], ['assignment', 'Travail à remettre'],
              ]} />
              <SelectField label="Mode de passage" value={row.delivery_mode} disabled={locked} onChange={value => onUpdate(row.id, { delivery_mode: value as AssessmentRow['delivery_mode'], session_required: value !== 'asynchronous' })} options={[
                ['asynchronous', 'Libre / asynchrone'], ['scheduled_online', 'Session en ligne'], ['scheduled_in_person', 'Session en présentiel'], ['hybrid', 'Hybride'],
              ]} />
              <SelectField label="Niveau de surveillance" value={String(row.security_level)} disabled={locked} onChange={value => onUpdate(row.id, { security_level: Number(value) })} options={[
                ['1', 'Niveau 1 — entraînement'], ['2', 'Niveau 2 — formation'], ['3', 'Niveau 3 — officiel'], ['4', 'Niveau 4 — oral / soutenance'],
              ]} />
              <SelectField label="Publication du résultat" value={row.result_release_mode} disabled={locked} onChange={value => onUpdate(row.id, { result_release_mode: value as AssessmentRow['result_release_mode'] })} options={[
                ['immediate', 'Immédiate si automatique'], ['after_review', 'Après correction'], ['manual', 'Décision manuelle'],
              ]} />
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <NumberField label="Seuil de réussite (%)" value={row.passing_score} min={1} max={100} disabled={locked} onChange={value => onUpdate(row.id, { passing_score: value })} />
              <NumberField label="Échecs avant remédiation" value={row.remediation_after_attempts} min={1} disabled={locked} onChange={value => onUpdate(row.id, { remediation_after_attempts: value, max_attempts: value })} />
              <NumberField label="Délai avant reprise (heures)" value={row.retry_cooldown_hours} min={0} disabled={locked} onChange={value => onUpdate(row.id, { retry_cooldown_hours: value })} />
              <NumberField label="Durée de l’épreuve (min)" value={row.time_limit_minutes || 0} min={0} disabled={locked} onChange={value => onUpdate(row.id, { time_limit_minutes: value || null })} />
              <SelectField label="Remédiation" value={row.remediation_mode} disabled={locked} onChange={value => onUpdate(row.id, { remediation_mode: value as AssessmentRow['remediation_mode'] })} options={[
                ['none', 'Aucune'], ['review_lesson', 'Revoir la leçon'], ['review_module', 'Revoir le module'], ['exercise', 'Exercice complémentaire'], ['manual', 'Décision du formateur'],
              ]} />
            </div>

            <div className="mt-4 rounded-xl bg-gray-50 p-4">
              <div className="mb-3 flex items-center gap-2"><Video size={16} color={GOLD} /><p className="text-sm font-semibold" style={{ color: BLUE }}>Mesures de surveillance proposées</p></div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Toggle label="Session programmée" checked={row.session_required} disabled={locked} onChange={checked => onUpdate(row.id, { session_required: checked })} />
                <Toggle label="Confirmation d’identité" checked={row.identity_verification_required} disabled={locked} onChange={checked => onUpdate(row.id, { identity_verification_required: checked })} />
                <Toggle label="Caméra" checked={row.proctoring_settings.camera_required === true} disabled={locked} onChange={checked => onUpdate(row.id, { proctoring_settings: { ...row.proctoring_settings, camera_required: checked } })} />
                <Toggle label="Microphone" checked={row.proctoring_settings.microphone_required === true} disabled={locked} onChange={checked => onUpdate(row.id, { proctoring_settings: { ...row.proctoring_settings, microphone_required: checked } })} />
                <Toggle label="Partage d’écran" checked={row.proctoring_settings.screen_share_required === true} disabled={locked} onChange={checked => onUpdate(row.id, { proctoring_settings: { ...row.proctoring_settings, screen_share_required: checked } })} />
                <Toggle label="Changements d’onglet" checked={row.proctoring_settings.tab_switch_tracking === true} disabled={locked} onChange={checked => onUpdate(row.id, { proctoring_settings: { ...row.proctoring_settings, tab_switch_tracking: checked } })} />
                <Toggle label="Plein écran" checked={row.proctoring_settings.fullscreen_required === true} disabled={locked} onChange={checked => onUpdate(row.id, { proctoring_settings: { ...row.proctoring_settings, fullscreen_required: checked } })} />
                <Toggle label="Surveillant humain" checked={row.proctoring_settings.human_proctor_required === true} disabled={locked} onChange={checked => onUpdate(row.id, { proctoring_settings: { ...row.proctoring_settings, human_proctor_required: checked } })} />
              </div>
              <p className="mt-3 flex items-center gap-2 text-xs text-gray-500"><Eye size={14} />La plateforme enregistre les événements autorisés. Aucun enregistrement audio ou vidéo n’est activé automatiquement.</p>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <TextField label="Compétences évaluées" value={row.competency_labels.join(', ')} disabled={locked} onChange={value => onUpdate(row.id, { competency_labels: value.split(',').map(item => item.trim()).filter(Boolean) })} placeholder="Ex. Analyse des risques, Audit interne" />
              <TextField label="Documents ou matériels autorisés" value={row.allowed_materials || ''} disabled={locked} onChange={value => onUpdate(row.id, { allowed_materials: value })} placeholder="Ex. calculatrice, norme fournie, aucun document" />
              <TextArea label="Instructions au candidat" value={row.candidate_instructions || ''} disabled={locked} onChange={value => onUpdate(row.id, { candidate_instructions: value })} placeholder="Consignes avant le démarrage de l’épreuve…" />
              <TextArea label="Règles d’intégrité" value={row.integrity_rules || ''} disabled={locked} onChange={value => onUpdate(row.id, { integrity_rules: value })} placeholder="Comportements autorisés, incidents et conditions d’annulation…" />
            </div>

            <TextField className="mt-4" label="Instructions après un échec" value={row.retry_instructions || ''} disabled={locked} onChange={value => onUpdate(row.id, { retry_instructions: value })} placeholder="Ex. Revoyez le module avant de reprendre l’évaluation." />
          </div>
        ))}
      </div>
    </section>
  );
}

function NumberField({ label, value, min, max, disabled, onChange }: { label: string; value: number; min: number; max?: number; disabled?: boolean; onChange: (value: number) => void }) {
  return <label className="text-xs font-semibold text-gray-600">{label}<input type="number" min={min} max={max} value={value} disabled={disabled} onChange={event => onChange(Number(event.target.value || min))} className="mt-1 h-10 w-full rounded-lg border px-3 text-sm" style={{ borderColor: BORDER }} /></label>;
}

function SelectField({ label, value, options, disabled, onChange }: { label: string; value: string; options: Array<[string, string]>; disabled?: boolean; onChange: (value: string) => void }) {
  return <label className="text-xs font-semibold text-gray-600">{label}<select value={value} disabled={disabled} onChange={event => onChange(event.target.value)} className="mt-1 h-10 w-full rounded-lg border px-2 text-sm" style={{ borderColor: BORDER }}>{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>;
}

function TextField({ label, value, placeholder, disabled, onChange, className = '' }: { label: string; value: string; placeholder?: string; disabled?: boolean; onChange: (value: string) => void; className?: string }) {
  return <label className={`block text-xs font-semibold text-gray-600 ${className}`}>{label}<input value={value} disabled={disabled} onChange={event => onChange(event.target.value)} className="mt-1 h-10 w-full rounded-lg border px-3 text-sm" style={{ borderColor: BORDER }} placeholder={placeholder} /></label>;
}

function TextArea({ label, value, placeholder, disabled, onChange }: { label: string; value: string; placeholder?: string; disabled?: boolean; onChange: (value: string) => void }) {
  return <label className="block text-xs font-semibold text-gray-600">{label}<textarea rows={3} value={value} disabled={disabled} onChange={event => onChange(event.target.value)} className="mt-1 w-full rounded-lg border p-3 text-sm" style={{ borderColor: BORDER }} placeholder={placeholder} /></label>;
}

function Toggle({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-700"><input type="checkbox" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} />{label}</label>;
}

function Info({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return <div className="rounded-xl border p-4" style={{ borderColor: BORDER }}><Icon size={18} color={GOLD} /><p className="mt-2 text-sm font-semibold" style={{ color: BLUE }}>{title}</p><p className="mt-1 text-xs text-gray-600">{text}</p></div>;
}
