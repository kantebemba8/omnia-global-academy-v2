import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, CheckCircle2, Eye, Loader2, Monitor, Plus, RotateCcw,
  Save, ShieldCheck, Trash2, Users, Video, X, type LucideIcon,
} from 'lucide-react';
import { edgeAuthHeaders } from '../lib/edgeAuth';
import { assessmentGovernanceCall } from '../lib/assessmentGovernanceApi';

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

type CompetencyMapping = {
  competency_id: string;
  target_level_id?: string | null;
  weight: number;
  passing_score?: number | null;
  required: boolean;
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
  competency_framework_id?: string | null;
  competency_mappings: CompetencyMapping[];
  jury_required: boolean;
  jury_min_members: number;
  jury_decision_mode: 'majority' | 'unanimous' | 'president_final';
  appeal_enabled: boolean;
  appeal_deadline_days: number;
  allowed_materials?: string;
  candidate_instructions?: string;
  integrity_rules?: string;
};

type Framework = {
  id: string;
  name: string;
  version: string;
  competencies: Array<{ id: string; code: string; name: string; domain?: string; framework_id: string }>;
  levels: Array<{ id: string; code: string; name: string; level_number: number; framework_id: string }>;
};

class StudioApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = 'StudioApiError';
    this.code = code;
    this.status = status;
  }
}

async function call(action: string, payload: Record<string, unknown>) {
  const response = await fetch(API, {
    method: 'POST',
    headers: edgeAuthHeaders(),
    body: JSON.stringify({ action, ...payload }),
  });
  const raw = await response.text();
  let data: any = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      throw new StudioApiError(
        response.ok ? 'Réponse serveur illisible.' : `Le serveur a répondu avec l’erreur HTTP ${response.status}.`,
        `HTTP_${response.status}`,
        response.status,
      );
    }
  }
  if (!response.ok || data.success === false) {
    throw new StudioApiError(
      data.message || data.error || `Erreur HTTP ${response.status}`,
      String(data.error || `HTTP_${response.status}`),
      response.status,
    );
  }
  return data;
}

export function AssessmentPolicyPanel({ courseId, locked, onClose }: { courseId: string; locked?: boolean; onClose: () => void }) {
  const [rows, setRows] = useState<AssessmentRow[]>([]);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [frameworkWarning, setFrameworkWarning] = useState('');
  const [policy, setPolicy] = useState({
    lesson_assessment_required: false,
    module_assessment_required: false,
    final_assessment_required: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setFrameworkWarning('');
    try {
      if (!locked) await call('ensure_assessments', { course_id: courseId });

      const [data, catalog] = await Promise.all([
        call('assessment_policy_get', { course_id: courseId }),
        assessmentGovernanceCall<any>('framework_catalog').catch((caught) => {
          setFrameworkWarning(caught instanceof Error
            ? `Référentiels indisponibles : ${caught.message}`
            : 'Les référentiels de compétences sont temporairement indisponibles.');
          return { frameworks: [] };
        }),
      ]);

      setFrameworks(catalog.frameworks || []);
      setPolicy({
        lesson_assessment_required: data.policy?.lesson_assessment_required === true,
        module_assessment_required: data.policy?.module_assessment_required === true,
        final_assessment_required: data.policy?.final_assessment_required === true,
      });
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
        competency_framework_id: row.competency_framework_id || null,
        competency_mappings: Array.isArray(row.competency_mappings) ? row.competency_mappings.map((mapping: any) => ({
          competency_id: mapping.competency_id,
          target_level_id: mapping.target_level_id || null,
          weight: Number(mapping.weight || 1),
          passing_score: mapping.passing_score === null || mapping.passing_score === undefined ? null : Number(mapping.passing_score),
          required: mapping.required !== false,
        })) : [],
        jury_required: row.jury_required === true,
        jury_min_members: Number(row.jury_min_members || 2),
        jury_decision_mode: row.jury_decision_mode || 'majority',
        appeal_enabled: row.appeal_enabled !== false,
        appeal_deadline_days: Number(row.appeal_deadline_days ?? 7),
      } as AssessmentRow)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  }, [courseId, locked]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, saving]);

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
          lesson_assessment_required: policy.lesson_assessment_required,
          module_assessment_required: policy.module_assessment_required,
          final_assessment_required: policy.final_assessment_required,
        },
        assessments: rows,
      });
      await call('ensure_assessments', { course_id: courseId });
      setMessage('Les règles d’évaluation, de jury, de révision et de compétences ont été enregistrées. Les évaluations ne sont créées que lorsqu’elles sont requises.');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-stretch justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="assessment-policy-title" className="flex max-h-[100dvh] w-full max-w-7xl flex-col overflow-hidden bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl">
        <div className="flex flex-shrink-0 items-start justify-between gap-4 border-b px-4 py-4 sm:px-6 sm:py-5" style={{ borderColor: BORDER }}>
          <div>
            <h2 id="assessment-policy-title" className="text-lg font-bold" style={{ color: BLUE }}>Évaluations, tentatives, jurys et compétences</h2>
            <p className="mt-1 max-w-4xl text-sm text-gray-600">Configurez chaque évaluation. Le Centre Qualité valide ensuite la surveillance, les jurys, les révisions, la remédiation et les compétences réellement évaluées.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-gray-100" aria-label="Fermer"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="mb-5 rounded-2xl border bg-slate-50 p-4" style={{ borderColor: BORDER }}>
            <h3 className="text-sm font-bold" style={{ color: BLUE }}>Politique d’évaluation de la formation</h3>
            <p className="mt-1 text-xs leading-5 text-gray-600">Les évaluations de leçon et de module sont facultatives par défaut. L’examen final peut être imposé par votre politique ; il reste automatiquement requis lorsqu’une certification ou un parcours CPD l’exige.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {[
                ['lesson_assessment_required', 'Évaluation à chaque leçon'],
                ['module_assessment_required', 'Évaluation à chaque module'],
                ['final_assessment_required', 'Examen final obligatoire'],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-3 rounded-xl border bg-white p-3 text-sm font-semibold" style={{ borderColor: BORDER, color: BLUE }}>
                  <input
                    type="checkbox"
                    checked={policy[key as keyof typeof policy]}
                    onChange={event => setPolicy(current => ({ ...current, [key]: event.target.checked }))}
                    disabled={locked || saving}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="mb-5 grid gap-3 md:grid-cols-5">
            <Info icon={RotateCcw} title="Tentatives" text="La remédiation remplace le blocage définitif pour une formation achetée." />
            <Info icon={ShieldCheck} title="Contrôle qualité" text="L’Administration Omnia valide les règles proposées avant publication." />
            <Info icon={Monitor} title="Sessions" text="Les examens officiels peuvent être programmés à une date précise." />
            <Info icon={Users} title="Jurys" text="Un jury limité à l’épreuve peut être exigé sans créer un rôle permanent." />
            <Info icon={CheckCircle2} title="Compétences" text="Seules les compétences mappées et réellement réussies sont vérifiées." />
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500" role="status" aria-live="polite"><Loader2 className="animate-spin" size={18} />Chargement des règles…</div>
          ) : error && rows.length === 0 ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center">
              <AlertCircle className="mx-auto" size={24} color="#B91C1C" />
              <p className="mt-2 text-sm font-semibold text-red-800">Impossible d’ouvrir les règles</p>
              <p className="mt-1 text-sm text-red-700">{error}</p>
              <button type="button" onClick={() => void load()} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700"><RotateCcw size={15} />Réessayer</button>
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-xl border p-6 text-center" style={{ borderColor: BORDER }}>
              <ShieldCheck className="mx-auto" size={26} color={GOLD} />
              <p className="mt-2 text-sm font-semibold" style={{ color: BLUE }}>Aucune évaluation disponible</p>
              <p className="mt-1 text-sm text-gray-600">Ajoutez au moins une leçon ou rechargez la configuration.</p>
              {!locked && <button type="button" onClick={() => void load()} className="mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: BLUE }}><RotateCcw size={15} />Créer ou actualiser les évaluations</button>}
            </div>
          ) : (
            <div className="space-y-7">
              <AssessmentGroup title="Évaluations des leçons" rows={groups.lesson} frameworks={frameworks} locked={locked} onUpdate={update} />
              <AssessmentGroup title="Évaluations des modules" rows={groups.module} frameworks={frameworks} locked={locked} onUpdate={update} />
              <AssessmentGroup title="Examen final" rows={groups.final} frameworks={frameworks} locked={locked} onUpdate={update} />
            </div>
          )}

          {error && rows.length > 0 && <p className="mt-5 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert"><AlertCircle className="mt-0.5 shrink-0" size={16} />{error}</p>}
          {frameworkWarning && <p className="mt-5 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800"><AlertCircle className="mt-0.5 shrink-0" size={16} />{frameworkWarning}</p>}
          {message && <p className="mt-5 rounded-xl bg-green-50 p-3 text-sm text-green-700" role="status" aria-live="polite">{message}</p>}
        </div>

        <div className="flex flex-shrink-0 flex-col-reverse gap-3 border-t px-4 py-4 sm:flex-row sm:justify-end sm:px-6" style={{ borderColor: BORDER }}>
          <button onClick={onClose} className="rounded-xl border px-4 py-2.5 text-sm font-semibold" style={{ borderColor: BORDER }}>Fermer</button>
          <button disabled={locked || saving || loading || rows.length === 0} onClick={save} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40" style={{ background: BLUE }}>{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Enregistrer les règles</button>
        </div>
      </div>
    </div>
  );
}

function AssessmentGroup({ title, rows, frameworks, locked, onUpdate }: { title: string; rows: AssessmentRow[]; frameworks: Framework[]; locked?: boolean; onUpdate: (id: string, patch: Partial<AssessmentRow>) => void }) {
  if (!rows.length) return null;
  return (
    <section>
      <h3 className="mb-3 font-semibold" style={{ color: BLUE }}>{title}</h3>
      <div className="space-y-4">{rows.map(row => {
        const framework = frameworks.find(item => item.id === row.competency_framework_id);
        const selectedIds = new Set(row.competency_mappings.map(item => item.competency_id));
        const available = framework?.competencies.filter(item => !selectedIds.has(item.id)) || [];
        return (
          <div key={row.id} className="rounded-xl border p-4" style={{ borderColor: BORDER }}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div><p className="font-medium" style={{ color: BLUE }}>{row.title}</p><p className="mt-1 text-xs text-gray-500">Niveau de surveillance proposé : {row.security_level}/4</p></div>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-600"><input type="checkbox" checked={row.required !== false} disabled={locked} onChange={event => onUpdate(row.id, { required: event.target.checked })} /> Obligatoire</label>
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
              <p className="mt-3 flex items-center gap-2 text-xs text-gray-500"><Eye size={14} />Aucun enregistrement audio ou vidéo n’est activé automatiquement.</p>
            </div>

            <div className="mt-4 rounded-xl border p-4" style={{ borderColor: BORDER }}>
              <div className="flex items-center gap-2"><Users size={16} color={GOLD} /><p className="text-sm font-semibold" style={{ color: BLUE }}>Jury et révision de note</p></div>
              <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <Toggle label="Jury obligatoire" checked={row.jury_required} disabled={locked} onChange={checked => onUpdate(row.id, { jury_required: checked, result_release_mode: checked ? 'manual' : row.result_release_mode })} />
                <NumberField label="Membres minimum" value={row.jury_min_members} min={1} max={15} disabled={locked || !row.jury_required} onChange={value => onUpdate(row.id, { jury_min_members: value })} />
                <SelectField label="Mode de décision" value={row.jury_decision_mode} disabled={locked || !row.jury_required} onChange={value => onUpdate(row.id, { jury_decision_mode: value as AssessmentRow['jury_decision_mode'] })} options={[
                  ['majority', 'Majorité'], ['unanimous', 'Unanimité'], ['president_final', 'Décision finale du président'],
                ]} />
                <Toggle label="Révision de note autorisée" checked={row.appeal_enabled} disabled={locked} onChange={checked => onUpdate(row.id, { appeal_enabled: checked })} />
                <NumberField label="Délai de révision (jours)" value={row.appeal_deadline_days} min={0} max={90} disabled={locked || !row.appeal_enabled} onChange={value => onUpdate(row.id, { appeal_deadline_days: value })} />
              </div>
            </div>

            <div className="mt-4 rounded-xl border p-4" style={{ borderColor: BORDER }}>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div><p className="text-sm font-semibold" style={{ color: BLUE }}>Référentiel et compétences évaluées</p><p className="mt-1 text-xs text-gray-500">Une compétence ne sera vérifiée qu’après réussite du seuil défini ici.</p></div>
                <label className="min-w-[260px] text-xs font-semibold text-gray-600">Référentiel<select value={row.competency_framework_id || ''} disabled={locked} onChange={event => onUpdate(row.id, { competency_framework_id: event.target.value || null, competency_mappings: [] })} className="mt-1 h-10 w-full rounded-lg border px-2 text-sm" style={{ borderColor: BORDER }}><option value="">Aucun référentiel central</option>{frameworks.map(item => <option key={item.id} value={item.id}>{item.name} · v{item.version}</option>)}</select></label>
              </div>
              {framework && <div className="mt-4">
                <div className="flex gap-2"><select id={`add-competency-${row.id}`} disabled={locked || !available.length} defaultValue="" className="h-10 min-w-0 flex-1 rounded-lg border px-2 text-sm" style={{ borderColor: BORDER }}><option value="">Choisir une compétence…</option>{available.map(item => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select><button type="button" disabled={locked || !available.length} onClick={() => { const select = document.getElementById(`add-competency-${row.id}`) as HTMLSelectElement | null; const competencyId = select?.value || ''; if (!competencyId) return; onUpdate(row.id, { competency_mappings: [...row.competency_mappings, { competency_id: competencyId, target_level_id: null, weight: 1, passing_score: row.passing_score, required: true }] }); if (select) select.value = ''; }} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-40" style={{ background: BLUE }}><Plus size={14} />Ajouter</button></div>
                <div className="mt-3 space-y-2">{row.competency_mappings.map(mapping => {
                  const competency = framework.competencies.find(item => item.id === mapping.competency_id);
                  return <div key={mapping.competency_id} className="grid gap-3 rounded-lg bg-gray-50 p-3 md:grid-cols-[1fr_180px_130px_110px_44px]">
                    <div><p className="text-sm font-semibold" style={{ color: BLUE }}>{competency?.code} · {competency?.name || 'Compétence'}</p><label className="mt-2 inline-flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={mapping.required} disabled={locked} onChange={event => onUpdate(row.id, { competency_mappings: row.competency_mappings.map(item => item.competency_id === mapping.competency_id ? { ...item, required: event.target.checked } : item) })} />Compétence obligatoire</label></div>
                    <SelectField label="Niveau visé" value={mapping.target_level_id || ''} disabled={locked} onChange={value => onUpdate(row.id, { competency_mappings: row.competency_mappings.map(item => item.competency_id === mapping.competency_id ? { ...item, target_level_id: value || null } : item) })} options={[['', 'Non précisé'], ...framework.levels.map(level => [level.id, `${level.code} · ${level.name}`] as [string, string])]} />
                    <NumberField label="Seuil (%)" value={Number(mapping.passing_score ?? row.passing_score)} min={0} max={100} disabled={locked} onChange={value => onUpdate(row.id, { competency_mappings: row.competency_mappings.map(item => item.competency_id === mapping.competency_id ? { ...item, passing_score: value } : item) })} />
                    <NumberField label="Poids" value={Number(mapping.weight || 1)} min={0.01} max={100} step={0.01} disabled={locked} onChange={value => onUpdate(row.id, { competency_mappings: row.competency_mappings.map(item => item.competency_id === mapping.competency_id ? { ...item, weight: value } : item) })} />
                    <button type="button" disabled={locked} onClick={() => onUpdate(row.id, { competency_mappings: row.competency_mappings.filter(item => item.competency_id !== mapping.competency_id) })} className="mt-5 rounded-lg p-2 text-red-600 hover:bg-red-50" aria-label="Retirer"><Trash2 size={16} /></button>
                  </div>;
                })}</div>
              </div>}
              <TextField className="mt-4" label="Compétences libres complémentaires" value={row.competency_labels.join(', ')} disabled={locked} onChange={value => onUpdate(row.id, { competency_labels: value.split(',').map(item => item.trim()).filter(Boolean) })} placeholder="Utilisez ce champ seulement lorsqu’aucun référentiel publié ne correspond." />
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <TextField label="Documents ou matériels autorisés" value={row.allowed_materials || ''} disabled={locked} onChange={value => onUpdate(row.id, { allowed_materials: value })} placeholder="Ex. calculatrice, norme fournie, aucun document" />
              <TextArea label="Instructions au candidat" value={row.candidate_instructions || ''} disabled={locked} onChange={value => onUpdate(row.id, { candidate_instructions: value })} placeholder="Consignes avant le démarrage de l’épreuve…" />
              <TextArea label="Règles d’intégrité" value={row.integrity_rules || ''} disabled={locked} onChange={value => onUpdate(row.id, { integrity_rules: value })} placeholder="Comportements autorisés, incidents et conditions d’annulation…" />
            </div>
            <TextField className="mt-4" label="Instructions après un échec" value={row.retry_instructions || ''} disabled={locked} onChange={value => onUpdate(row.id, { retry_instructions: value })} placeholder="Ex. Revoyez le module avant de reprendre l’évaluation." />
          </div>
        );
      })}</div>
    </section>
  );
}

function NumberField({ label, value, min, max, step, disabled, onChange }: { label: string; value: number; min: number; max?: number; step?: number; disabled?: boolean; onChange: (value: number) => void }) {
  return <label className="text-xs font-semibold text-gray-600">{label}<input type="number" min={min} max={max} step={step} value={value} disabled={disabled} onChange={event => onChange(Number(event.target.value || min))} className="mt-1 h-10 w-full rounded-lg border px-3 text-sm" style={{ borderColor: BORDER }} /></label>;
}
function SelectField({ label, value, options, disabled, onChange }: { label: string; value: string; options: Array<[string, string]>; disabled?: boolean; onChange: (value: string) => void }) { return <label className="text-xs font-semibold text-gray-600">{label}<select value={value} disabled={disabled} onChange={event => onChange(event.target.value)} className="mt-1 h-10 w-full rounded-lg border px-2 text-sm" style={{ borderColor: BORDER }}>{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>; }
function TextField({ label, value, placeholder, disabled, onChange, className = '' }: { label: string; value: string; placeholder?: string; disabled?: boolean; onChange: (value: string) => void; className?: string }) { return <label className={`block text-xs font-semibold text-gray-600 ${className}`}>{label}<input value={value} disabled={disabled} onChange={event => onChange(event.target.value)} className="mt-1 h-10 w-full rounded-lg border px-3 text-sm" style={{ borderColor: BORDER }} placeholder={placeholder} /></label>; }
function TextArea({ label, value, placeholder, disabled, onChange }: { label: string; value: string; placeholder?: string; disabled?: boolean; onChange: (value: string) => void }) { return <label className="block text-xs font-semibold text-gray-600">{label}<textarea rows={3} value={value} disabled={disabled} onChange={event => onChange(event.target.value)} className="mt-1 w-full rounded-lg border p-3 text-sm" style={{ borderColor: BORDER }} placeholder={placeholder} /></label>; }
function Toggle({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) { return <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-700"><input type="checkbox" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} />{label}</label>; }
function Info({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) { return <div className="rounded-xl border p-4" style={{ borderColor: BORDER }}><Icon size={18} color={GOLD} /><p className="mt-2 text-sm font-semibold" style={{ color: BLUE }}>{title}</p><p className="mt-1 text-xs text-gray-600">{text}</p></div>; }
