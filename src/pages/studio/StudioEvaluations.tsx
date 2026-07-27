import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  CheckCircle,
  Download,
  FileCheck2,
  FileText,
  Loader2,
  Save,
  Send,
  Upload,
  X,
} from 'lucide-react';
import { edgeAuthHeaders } from '../../lib/edgeAuth';

const API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/studio-unified`;
const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

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

type AttemptSummary = {
  id: string;
  attempt_number: number;
  status?: string;
  remediation_required?: boolean;
  remediation_completed_at?: string | null;
  submitted_at?: string;
  users?: { full_name?: string; email?: string };
  course_assessments?: { title?: string; scope?: string; passing_score?: number; remediation_mode?: string; competency_labels?: string[] };
  assessment_corrections?: Array<{ status: string; score?: number; updated_at?: string }>;
};

type AttemptDetail = {
  attempt: AttemptSummary & { score?: number; course_assessments?: { title?: string; scope?: string; passing_score?: number; remediation_mode?: string; competency_labels?: string[] } };
  answers: Array<{
    id: string;
    answer_json: unknown;
    assessment_questions?: { prompt?: string; question_type?: string; points?: number };
  }>;
  files: Array<{ id: string; file_name: string; size_bytes?: number; signed_url?: string }>;
  correction?: {
    status?: string;
    score?: number;
    max_score?: number;
    comment?: string;
    corrected_file_name?: string;
    signed_url?: string;
  } | null;
};

type UploadedCorrection = {
  bucket_name: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
};

function formatDate(value?: string) {
  if (!value) return 'Date inconnue';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function renderAnswer(value: unknown) {
  if (value === null || value === undefined || value === '') return 'Aucune réponse textuelle.';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object' && value && 'files' in value) return 'Réponse remise sous forme de fichier.';
  return JSON.stringify(value, null, 2);
}

export function StudioEvaluations() {
  const { courseId = '' } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState<AttemptSummary[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AttemptDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [score, setScore] = useState('');
  const [comment, setComment] = useState('');
  const [competencyScores, setCompetencyScores] = useState<Record<string, string>>({});
  const [correctedFile, setCorrectedFile] = useState<File | null>(null);
  const [uploadedCorrection, setUploadedCorrection] = useState<UploadedCorrection | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [attemptsData, analyticsData] = await Promise.all([
        call('grader_list_attempts', { course_id: courseId }),
        call('assessment_analytics', { course_id: courseId }),
      ]);
      setItems(attemptsData.attempts || []);
      setAnalytics(analyticsData.summary || null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => { void load(); }, [load]);

  async function openAttempt(attemptId: string) {
    setDetailLoading(true);
    setError('');
    try {
      const data = await call('grader_get_attempt', { attempt_id: attemptId });
      const detail: AttemptDetail = data;
      setSelected(detail);
      setScore(detail.correction?.score !== undefined ? String(detail.correction.score) : '');
      setComment(detail.correction?.comment || '');
      setCompetencyScores(Object.fromEntries((detail.attempt.course_assessments?.competency_labels || []).map(label => [label, detail.correction?.score !== undefined ? String(detail.correction.score) : ''])));
      setUploadedCorrection(detail.correction?.corrected_file_name && detail.correction?.signed_url ? {
        bucket_name: 'assessment-corrections',
        storage_path: '',
        file_name: detail.correction.corrected_file_name,
        mime_type: '',
        size_bytes: 0,
      } : null);
      setCorrectedFile(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Ouverture impossible.');
    } finally {
      setDetailLoading(false);
    }
  }

  const numericScore = useMemo(() => Number(score), [score]);
  const validScore = Number.isFinite(numericScore) && numericScore >= 0 && numericScore <= 100;
  const correctedFileRequired = Boolean(selected?.files.length);
  const hasCorrectedFile = Boolean(correctedFile || selected?.correction?.corrected_file_name);
  const manualRelease = Boolean(selected?.attempt.status === 'failed' && selected?.attempt.remediation_required && selected?.attempt.course_assessments?.remediation_mode === 'manual');

  async function uploadCorrectionIfNeeded(): Promise<UploadedCorrection | null> {
    if (!selected || !correctedFile) return uploadedCorrection;
    const prepared = await call('prepare_assessment_correction_upload', {
      attempt_id: selected.attempt.id,
      file_name: correctedFile.name,
      size_bytes: correctedFile.size,
      mime_type: correctedFile.type,
    });
    if (!prepared.signedUrl || !prepared.path) throw new Error('Téléversement impossible.');
    const response = await fetch(prepared.signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': correctedFile.type || 'application/octet-stream' },
      body: correctedFile,
    });
    if (!response.ok) throw new Error('La copie corrigée n’a pas pu être téléversée.');
    const uploaded: UploadedCorrection = {
      bucket_name: prepared.bucket || 'assessment-corrections',
      storage_path: prepared.path,
      file_name: correctedFile.name,
      mime_type: correctedFile.type || 'application/octet-stream',
      size_bytes: correctedFile.size,
    };
    setUploadedCorrection(uploaded);
    return uploaded;
  }

  async function authorizeRetry() {
    if (!selected) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await call('grader_release_remediation', {
        attempt_id: selected.attempt.id,
        note: comment || 'Nouvelle tentative autorisée par le formateur.',
      });
      setSuccess('La nouvelle tentative a été autorisée pour l’apprenant.');
      setSelected(null);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Autorisation impossible.');
    } finally {
      setSaving(false);
    }
  }

  async function saveCorrection(publish: boolean) {
    if (!selected || !validScore) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const file = await uploadCorrectionIfNeeded();
      await call('grader_save_correction', {
        attempt_id: selected.attempt.id,
        score: numericScore,
        max_score: 100,
        comment,
        corrected_file: file,
        competency_results: Object.entries(competencyScores).map(([name, value]) => ({ name, score: Number(value || numericScore) })),
        publish,
      });
      if (publish) {
        setSuccess('La correction et la note ont été publiées auprès de l’apprenant.');
        setSelected(null);
        await load();
      } else {
        setSuccess('Brouillon de correction enregistré.');
        await openAttempt(selected.attempt.id);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex items-center gap-3 border-b bg-white px-6 py-4">
        <button onClick={() => navigate(-1)} aria-label="Retour"><ArrowLeft size={18} /></button>
        <div>
          <h1 className="font-semibold" style={{ color: BLUE }}>Corrections et résultats</h1>
          <p className="text-xs text-gray-500">Téléchargez la copie, corrigez-la hors ligne, puis publiez la note et le fichier corrigé.</p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-6">
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <Stat label="Tentatives évaluées" value={analytics?.attempts || 0} />
          <Stat label="Taux de réussite" value={`${analytics?.pass_rate || 0}%`} />
          <Stat label="Score moyen" value={`${analytics?.average_score || 0}%`} />
        </div>

        {error && <p className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700"><AlertCircle size={16} />{error}</p>}
        {success && <p className="mb-4 rounded-xl bg-green-50 p-3 text-sm text-green-700">{success}</p>}

        <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: BORDER }}>
          <div className="flex items-center gap-2 border-b p-4" style={{ borderColor: BORDER }}>
            <BarChart3 size={18} style={{ color: GOLD }} />
            <h2 className="font-semibold" style={{ color: BLUE }}>Corrections et autorisations</h2>
          </div>
          {items.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-500"><CheckCircle className="mx-auto mb-2" />Aucune correction ou autorisation en attente.</div>
          ) : (
            <div className="divide-y">
              {items.map(item => {
                const draft = item.assessment_corrections?.find(correction => correction.status === 'draft');
                const retryAuthorization = item.status === 'failed' && item.remediation_required && item.course_assessments?.remediation_mode === 'manual';
                return (
                  <button key={item.id} onClick={() => void openAttempt(item.id)} className="flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-gray-50">
                    <div>
                      <p className="text-sm font-medium" style={{ color: BLUE }}>{item.users?.full_name || 'Apprenant'}</p>
                      <p className="mt-1 text-xs text-gray-500">{item.course_assessments?.title} · tentative {item.attempt_number} · {formatDate(item.submitted_at)}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs ${draft ? 'bg-blue-50 text-blue-700' : retryAuthorization ? 'bg-purple-50 text-purple-700' : 'bg-amber-50 text-amber-700'}`}>{draft ? 'Brouillon enregistré' : retryAuthorization ? 'Autorisation de reprise' : 'À corriger'}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {(selected || detailLoading) && (
        <div className="fixed inset-0 z-[80] overflow-y-auto bg-black/50 p-4">
          <div className="mx-auto my-6 w-full max-w-5xl rounded-2xl bg-white shadow-2xl">
            {detailLoading && !selected ? (
              <div className="flex items-center justify-center gap-2 py-24 text-sm text-gray-500"><Loader2 className="animate-spin" size={18} />Ouverture de la copie…</div>
            ) : selected && (
              <>
                <div className="flex items-start justify-between gap-4 border-b px-6 py-5" style={{ borderColor: BORDER }}>
                  <div>
                    <h2 className="font-bold" style={{ color: BLUE }}>{selected.attempt.course_assessments?.title || 'Copie à corriger'}</h2>
                    <p className="mt-1 text-sm text-gray-500">{selected.attempt.users?.full_name || 'Apprenant'} · tentative {selected.attempt.attempt_number}</p>
                  </div>
                  <button onClick={() => setSelected(null)} className="rounded-lg p-2 hover:bg-gray-100" aria-label="Fermer"><X size={20} /></button>
                </div>

                <div className="grid gap-6 p-6 lg:grid-cols-[1fr_360px]">
                  <div className="space-y-5">
                    <section>
                      <h3 className="mb-3 text-sm font-semibold" style={{ color: BLUE }}>Réponses de l’apprenant</h3>
                      <div className="space-y-3">
                        {selected.answers.map((answer, index) => (
                          <div key={answer.id} className="rounded-xl border p-4" style={{ borderColor: BORDER }}>
                            <p className="text-sm font-semibold" style={{ color: BLUE }}>{index + 1}. {answer.assessment_questions?.prompt || 'Question'}</p>
                            <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 font-sans text-sm text-gray-700">{renderAnswer(answer.answer_json)}</pre>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section>
                      <h3 className="mb-3 text-sm font-semibold" style={{ color: BLUE }}>Copies originales</h3>
                      {selected.files.length === 0 ? <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">Aucun fichier joint.</p> : (
                        <div className="space-y-2">
                          {selected.files.map(file => (
                            <a key={file.id} href={file.signed_url || '#'} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border p-3 text-sm hover:bg-gray-50" style={{ borderColor: BORDER }}>
                              <span className="flex items-center gap-2"><FileText size={16} style={{ color: GOLD }} />{file.file_name}</span>
                              <span className="flex items-center gap-1 font-semibold" style={{ color: BLUE }}><Download size={15} />Télécharger</span>
                            </a>
                          ))}
                        </div>
                      )}
                    </section>
                  </div>

                  <aside className="h-fit rounded-xl border p-5" style={{ borderColor: BORDER }}>
                    {manualRelease ? (
                      <>
                        <h3 className="flex items-center gap-2 font-semibold" style={{ color: BLUE }}><CheckCircle size={18} style={{ color: GOLD }} />Autoriser une nouvelle tentative</h3>
                        <p className="mt-3 text-sm leading-6 text-gray-600">Cette évaluation prévoit une remédiation manuelle. Vérifiez le travail et les réponses, puis autorisez la reprise lorsque l’apprenant est prêt.</p>
                        <label className="mt-4 block text-xs font-semibold text-gray-600">Commentaire facultatif
                          <textarea rows={5} value={comment} onChange={event => setComment(event.target.value)} className="mt-1 w-full rounded-lg border p-3 text-sm" style={{ borderColor: BORDER }} placeholder="Consignes avant la nouvelle tentative…" />
                        </label>
                        <button disabled={saving} onClick={() => void authorizeRetry()} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40" style={{ background: BLUE }}>
                          {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />} Autoriser la reprise
                        </button>
                        <p className="mt-3 text-xs leading-relaxed text-gray-500">L’action est tracée. Elle ne modifie pas la note obtenue et ouvre seulement la prochaine tentative.</p>
                      </>
                    ) : (
                      <>
                        <h3 className="flex items-center gap-2 font-semibold" style={{ color: BLUE }}><FileCheck2 size={18} style={{ color: GOLD }} />Correction</h3>
                        <label className="mt-5 block text-xs font-semibold text-gray-600">Note / moyenne sur 100
                          <input type="number" min={0} max={100} step="0.01" value={score} onChange={event => setScore(event.target.value)} className="mt-1 h-11 w-full rounded-lg border px-3 text-sm" style={{ borderColor: BORDER }} />
                        </label>
                        {!validScore && score !== '' && <p className="mt-1 text-xs text-red-600">La note doit être comprise entre 0 et 100.</p>}

                        {(selected.attempt.course_assessments?.competency_labels || []).length > 0 && (
                          <div className="mt-4 rounded-lg bg-gray-50 p-3">
                            <p className="text-xs font-semibold text-gray-600">Résultats par compétence</p>
                            <div className="mt-3 space-y-2">
                              {(selected.attempt.course_assessments?.competency_labels || []).map(label => (
                                <label key={label} className="grid grid-cols-[1fr_88px] items-center gap-3 text-xs text-gray-700">
                                  <span>{label}</span>
                                  <input type="number" min={0} max={100} step="0.01" value={competencyScores[label] ?? ''} onChange={event => setCompetencyScores(current => ({ ...current, [label]: event.target.value }))} className="h-9 rounded-lg border px-2 text-sm" style={{ borderColor: BORDER }} placeholder={score || '0'} />
                                </label>
                              ))}
                            </div>
                          </div>
                        )}

                        <label className="mt-4 block text-xs font-semibold text-gray-600">Commentaire facultatif
                          <textarea rows={5} value={comment} onChange={event => setComment(event.target.value)} className="mt-1 w-full rounded-lg border p-3 text-sm" style={{ borderColor: BORDER }} placeholder="Appréciation, points à améliorer ou consignes…" />
                        </label>

                        <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-semibold" style={{ borderColor: GOLD, color: BLUE }}>
                          <Upload size={16} /> Joindre la copie corrigée
                          <input type="file" className="hidden" onChange={event => { setCorrectedFile(event.target.files?.[0] || null); setUploadedCorrection(null); }} />
                        </label>
                        {(correctedFile || selected.correction?.corrected_file_name) && <p className="mt-2 text-xs text-green-700">{correctedFile?.name || selected.correction?.corrected_file_name}</p>}
                        {selected.correction?.signed_url && !correctedFile && <a href={selected.correction.signed_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs underline" style={{ color: BLUE }}><Download size={13} />Voir la correction enregistrée</a>}
                        {correctedFileRequired && !hasCorrectedFile && <p className="mt-2 text-xs text-amber-700">Une copie corrigée est obligatoire avant la publication, car l’apprenant a remis un fichier.</p>}

                        <div className="mt-5 grid gap-2">
                          <button disabled={!validScore || saving} onClick={() => void saveCorrection(false)} className="inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold disabled:opacity-40" style={{ borderColor: BORDER, color: BLUE }}>
                            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Enregistrer le brouillon
                          </button>
                          <button disabled={!validScore || saving || (correctedFileRequired && !hasCorrectedFile)} onClick={() => void saveCorrection(true)} className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40" style={{ background: BLUE }}>
                            {saving ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Publier la correction
                          </button>
                        </div>
                        <p className="mt-3 text-xs leading-relaxed text-gray-500">La publication transmet la note, le commentaire facultatif et la copie corrigée à l’apprenant. L’historique conserve les modifications.</p>
                      </>
                    )}
                  </aside>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-xl border bg-white p-4" style={{ borderColor: BORDER }}><p className="text-xs text-gray-500">{label}</p><p className="text-2xl font-semibold" style={{ color: BLUE }}>{value}</p></div>;
}
