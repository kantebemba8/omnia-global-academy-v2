import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  Send,
  Upload,
  XCircle,
} from 'lucide-react';
import { edgeAuthHeaders } from '../lib/edgeAuth';

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
  if (!response.ok || data.success === false) {
    const error = new Error(data.message || data.error || 'Erreur');
    Object.assign(error, { payload: data });
    throw error;
  }
  return data;
}

type Question = {
  id: string;
  section_id?: string | null;
  question_type: 'qcm' | 'true_false' | 'open_question' | 'exercise' | 'assignment_upload' | 'case_study' | 'cloze' | 'dictation' | 'pronunciation' | 'matching' | 'sentence_order' | 'oral_response' | 'listening_comprehension' | 'written_expression';
  prompt: string;
  options?: any;
  points: number;
  explanation?: string;
  accepted_submission_types?: string[];
  resource_files?: Array<{ name: string; url: string }>;
};

type UploadedFile = {
  bucket_name: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
};

type PendingFile = { file: File; uploaded?: UploadedFile };
type AnswerValue = string | number | boolean | string[] | { files: PendingFile[] };

type Attempt = {
  id: string;
  score?: number | null;
  passed: boolean;
  status: string;
  attempt_number: number;
  retry_available_at?: string | null;
  remediation_required?: boolean;
  remediation_completed_at?: string | null;
  feedback?: string;
};

type Correction = {
  score?: number | null;
  max_score?: number | null;
  comment?: string | null;
  corrected_file_name?: string | null;
  signed_url?: string | null;
  published_at?: string | null;
};

type Assessment = {
  id: string;
  title: string;
  instructions?: string;
  scope: string;
  passing_score: number;
  remediation_after_attempts: number;
  remediation_mode: 'none' | 'review_lesson' | 'review_module' | 'exercise' | 'manual';
  retry_cooldown_hours: number;
  retry_instructions?: string;
  time_limit_minutes?: number | null;
  questions: Question[];
  latest_attempt?: Attempt | null;
  correction?: Correction | null;
  can_retry: boolean;
  retry_blocked_until?: string | null;
  remediation_blocked?: boolean;
};

function formatDate(value?: string | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function remediationLabel(mode: Assessment['remediation_mode']) {
  if (mode === 'review_lesson') return 'revoir la leçon';
  if (mode === 'review_module') return 'revoir le module';
  if (mode === 'exercise') return 'effectuer l’exercice complémentaire';
  if (mode === 'manual') return 'attendre l’autorisation du formateur';
  return 'aucune remédiation automatique';
}

export function AssessmentEngine({
  courseId,
  lessonId,
  moduleId,
  assessmentId,
  sessionId,
  scope = 'lesson',
  onPassed,
  onSubmitted,
  preview = false,
}: {
  courseId: string;
  lessonId?: string;
  moduleId?: string;
  assessmentId?: string;
  sessionId?: string;
  scope?: 'lesson' | 'module' | 'final';
  onPassed?: () => void;
  onSubmitted?: (attemptId?: string) => void;
  preview?: boolean;
}) {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [remediationLoading, setRemediationLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await call('learner_get_assessment', {
        course_id: courseId,
        lesson_id: lessonId,
        module_id: moduleId,
        assessment_id: assessmentId,
        session_id: sessionId,
        scope,
        preview,
      });
      setAssessment(data.assessment || null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  }, [assessmentId, courseId, lessonId, moduleId, scope, sessionId, preview]);

  useEffect(() => {
    setAnswers({});
    setResult(null);
    void load();
  }, [load]);

  const complete = useMemo(() => assessment?.questions.every(question => {
    const answer = answers[question.id];
    if (['exercise', 'assignment_upload', 'oral_response', 'pronunciation'].includes(question.question_type)) {
      return Boolean(answer && typeof answer === 'object' && !Array.isArray(answer) && 'files' in answer && answer.files.length > 0);
    }
    if (['cloze', 'matching', 'listening_comprehension'].includes(question.question_type)) return Array.isArray(answer) && answer.length > 0 && answer.every(value => String(value ?? '').trim().length > 0);
    if (question.question_type === 'sentence_order') return Array.isArray(answer) ? answer.length > 0 : String(answer ?? '').trim().length > 0;
    return answer !== undefined && String(answer).trim() !== '';
  }) ?? false, [assessment, answers]);

  function pendingFiles(questionId: string): PendingFile[] {
    const answer = answers[questionId];
    return answer && typeof answer === 'object' && 'files' in answer ? answer.files : [];
  }

  function setFiles(questionId: string, files: FileList | null) {
    if (preview) return;
    const selected = Array.from(files || []).map(file => ({ file }));
    setAnswers(current => ({ ...current, [questionId]: { files: selected } }));
  }

  async function uploadFiles(questionId: string, items: PendingFile[]): Promise<UploadedFile[]> {
    if (!assessment) return [];
    const uploaded: UploadedFile[] = [];
    for (const item of items) {
      if (item.uploaded) {
        uploaded.push(item.uploaded);
        continue;
      }
      const prepared = await call('prepare_assessment_submission_upload', {
        assessment_id: assessment.id,
        question_id: questionId,
        file_name: item.file.name,
        size_bytes: item.file.size,
        mime_type: item.file.type,
      });
      if (!prepared.signedUrl || !prepared.path) throw new Error('Téléversement impossible.');
      const response = await fetch(prepared.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': item.file.type || 'application/octet-stream' },
        body: item.file,
      });
      if (!response.ok) throw new Error(`Le fichier « ${item.file.name} » n’a pas pu être envoyé.`);
      const metadata: UploadedFile = {
        bucket_name: prepared.bucket || 'assessment-submissions',
        storage_path: prepared.path,
        file_name: item.file.name,
        mime_type: item.file.type || 'application/octet-stream',
        size_bytes: item.file.size,
      };
      uploaded.push(metadata);
    }
    setAnswers(current => ({
      ...current,
      [questionId]: { files: items.map((item, index) => ({ ...item, uploaded: uploaded[index] })) },
    }));
    return uploaded;
  }

  async function submit() {
    if (preview) { setResult({ preview: true }); return; }
    if (!assessment || !complete || assessment.latest_attempt?.passed || !assessment.can_retry) return;
    setSending(true);
    setUploading(true);
    setError('');
    try {
      const normalizedAnswers = [];
      for (const question of assessment.questions) {
        const raw = answers[question.id];
        if (['exercise', 'assignment_upload', 'oral_response', 'pronunciation'].includes(question.question_type)) {
          const pending = raw && typeof raw === 'object' && !Array.isArray(raw) && 'files' in raw ? raw.files : [];
          const files = await uploadFiles(question.id, pending);
          normalizedAnswers.push({ question_id: question.id, answer: { files } });
        } else {
          normalizedAnswers.push({ question_id: question.id, answer: raw });
        }
      }
      setUploading(false);
      const data = await call('learner_submit_assessment', {
        assessment_id: assessment.id,
        session_id: sessionId,
        answers: normalizedAnswers,
      });
      setResult(data);
      setAnswers({});
      if (data.passed) onPassed?.();
      onSubmitted?.(data.attempt_id);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Envoi impossible.');
    } finally {
      setSending(false);
      setUploading(false);
    }
  }

  async function completeRemediation() {
    if (preview) return;
    if (!assessment || assessment.remediation_mode === 'manual') return;
    setRemediationLoading(true);
    setError('');
    try {
      await call('learner_complete_remediation', {
        assessment_id: assessment.id,
        note: assessment.retry_instructions || 'Contenu révisé par l’apprenant.',
      });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Validation impossible.');
    } finally {
      setRemediationLoading(false);
    }
  }

  if (loading) {
    return <div className="flex items-center gap-2 py-5 text-sm text-gray-500"><Loader2 size={16} className="animate-spin" />Chargement de l’évaluation…</div>;
  }

  if (!assessment) {
    return null;
  }

  const latest = assessment.latest_attempt;
  const passed = Boolean(latest?.passed);
  const pending = Boolean(latest && ['pending_review', 'submitted', 'in_progress'].includes(latest.status));
  const blocked = !assessment.can_retry && !passed && !pending;

  const setArrayAnswer = (questionId: string, index: number, value: string) => {
    setAnswers(current => {
      const existing = Array.isArray(current[questionId]) ? [...current[questionId] as string[]] : [];
      existing[index] = value;
      return { ...current, [questionId]: existing };
    });
  };

  return (
    <section className="mt-8 rounded-2xl border p-5" style={{ borderColor: BORDER }}>
      {preview && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">Mode prévisualisation — vous pouvez parcourir les questions, mais aucune réponse, copie, tentative ou note n’est enregistrée.</div>}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold" style={{ color: BLUE }}>{assessment.title}</h2>
          <p className="mt-1 text-sm text-gray-500">
            Seuil de réussite : <b>{assessment.passing_score}%</b>{Number(assessment.total_points || 0) > 0 && <> · Barème : <b>{assessment.total_points} points</b></>}
            {' · '}remédiation après {assessment.remediation_after_attempts} échec(s)
            {assessment.retry_cooldown_hours > 0 ? ` · reprise après ${assessment.retry_cooldown_hours} h` : ''}
            {assessment.time_limit_minutes ? ` · ${assessment.time_limit_minutes} min` : ''}
          </p>
          <p className="mt-1 text-xs text-gray-500">En cas d’échec, les tentatives restent possibles après la règle de reprise prévue.</p>
        </div>
        <Clock size={20} style={{ color: GOLD }} />
      </div>

      {assessment.instructions && <p className="mb-4 text-sm">{assessment.instructions}</p>}

      {!preview && latest && (
        <div className={`mb-5 rounded-xl p-4 ${passed ? 'bg-green-50' : pending ? 'bg-amber-50' : 'bg-gray-50'}`}>
          <div className="flex items-start gap-2">
            {passed ? <CheckCircle size={18} className="mt-0.5 text-green-700" /> : pending ? <Clock size={18} className="mt-0.5 text-amber-700" /> : <XCircle size={18} className="mt-0.5 text-red-700" />}
            <div className="text-sm">
              <p className="font-semibold" style={{ color: passed ? '#15803D' : pending ? '#B45309' : '#B91C1C' }}>
                {passed ? `Évaluation réussie — ${latest.score ?? 0}%` : pending ? 'Copie envoyée — correction en attente' : `Dernier résultat — ${latest.score ?? 0}%`}
              </p>
              <p className="mt-1 text-xs text-gray-600">Tentative {latest.attempt_number}</p>
              {latest.feedback && <p className="mt-2 text-sm text-gray-700">{latest.feedback}</p>}
            </div>
          </div>
        </div>
      )}

      {!preview && assessment.correction && (
        <div className="mb-5 rounded-xl border p-4" style={{ borderColor: '#C7D7EF', background: '#F7FAFF' }}>
          <p className="text-sm font-semibold" style={{ color: BLUE }}>Correction publiée</p>
          <p className="mt-1 text-sm text-gray-700">Note : {assessment.correction.score ?? 0}/{assessment.correction.max_score ?? 100}</p>
          {assessment.correction.comment && <p className="mt-2 text-sm text-gray-700">{assessment.correction.comment}</p>}
          {assessment.correction.signed_url && (
            <a href={assessment.correction.signed_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold" style={{ borderColor: GOLD, color: BLUE }}>
              <Download size={15} /> Télécharger la copie corrigée
            </a>
          )}
        </div>
      )}

      {!preview && assessment.retry_blocked_until && !assessment.remediation_blocked && (
        <div className="mb-5 flex items-start gap-2 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
          <Clock size={17} className="mt-0.5 shrink-0" />
          <div><p className="font-semibold">Nouvelle tentative temporairement bloquée</p><p className="mt-1">Disponible le {formatDate(assessment.retry_blocked_until)}.</p></div>
        </div>
      )}

      {!preview && assessment.remediation_blocked && (
        <div className="mb-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex items-start gap-2"><RefreshCw size={17} className="mt-0.5 shrink-0" /><div><p className="font-semibold">Remédiation obligatoire : {remediationLabel(assessment.remediation_mode)}</p><p className="mt-1">{assessment.retry_instructions || 'Revoyez le contenu concerné avant de reprendre l’évaluation.'}</p></div></div>
          {assessment.remediation_mode !== 'manual' && (
            <button onClick={completeRemediation} disabled={remediationLoading} className="mt-3 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50" style={{ background: BLUE }}>
              {remediationLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />} J’ai terminé la remédiation
            </button>
          )}
        </div>
      )}

      {!passed && !pending && !blocked && (
        <div className="space-y-5">
          {assessment.questions.map((question, index) => {
            const section = (assessment.sections || []).find(item => item.id === question.section_id);
            const previousSectionId = index > 0 ? assessment.questions[index - 1]?.section_id : null;
            const showSection = Boolean(section && section.id !== previousSectionId);
            return <div key={question.id}>
              {showSection && <div className="mb-3 mt-2 rounded-xl border-l-4 bg-slate-50 p-4" style={{ borderLeftColor: GOLD }}>
                <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-bold" style={{ color: BLUE }}>{section?.title}</p>{section?.description && <p className="mt-1 text-xs text-slate-500">{section.description}</p>}</div>{section?.target_points != null && <span className="text-xs font-semibold text-slate-600">{section.target_points} pts</span>}</div>
              </div>}
              <div className="rounded-xl bg-gray-50 p-4">
              <p className="mb-3 text-sm font-medium" style={{ color: BLUE }}>
                {index + 1}. {question.prompt} <span className="text-xs text-gray-400">({question.points} pts)</span>
              </p>

              {(question.resource_files || []).length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {(question.resource_files || []).map((file, fileIndex) => file.url ? (
                    /\.(mp3|wav|m4a|ogg|webm)(\?|$)/i.test(file.url) || /audio/i.test(file.name || '')
                      ? <audio key={fileIndex} controls className="w-full max-w-md" src={file.url} />
                      : <a key={fileIndex} href={file.url} target="_blank" rel="noreferrer" className="flex gap-1 text-xs underline"><FileText size={13} />{file.name}</a>
                  ) : null)}
                </div>
              )}

              {question.question_type === 'qcm' && (
                <div className="space-y-2">
                  {(question.options || []).map((option, optionIndex) => (
                    <label key={optionIndex} className="flex gap-2 text-sm">
                      <input type="radio" name={question.id} checked={answers[question.id] === optionIndex} onChange={() => setAnswers(current => ({ ...current, [question.id]: optionIndex }))} />
                      {option}
                    </label>
                  ))}
                </div>
              )}

              {question.question_type === 'true_false' && (
                <div className="flex gap-4">
                  <label className="text-sm"><input type="radio" name={question.id} checked={answers[question.id] === true} onChange={() => setAnswers(current => ({ ...current, [question.id]: true }))} /> Vrai</label>
                  <label className="text-sm"><input type="radio" name={question.id} checked={answers[question.id] === false} onChange={() => setAnswers(current => ({ ...current, [question.id]: false }))} /> Faux</label>
                </div>
              )}

              {question.question_type === 'open_question' && (
                <textarea rows={5} className="w-full rounded-lg border p-3 text-sm" value={typeof answers[question.id] === 'string' ? answers[question.id] as string : ''} onChange={event => setAnswers(current => ({ ...current, [question.id]: event.target.value }))} placeholder="Rédigez votre réponse…" />
              )}

              {question.question_type === 'cloze' && (() => {
                const text = String(question.options?.text || '');
                const parts = text.split('____');
                const values = Array.isArray(answers[question.id]) ? answers[question.id] as string[] : [];
                return <div className="rounded-lg border bg-white p-3 text-sm leading-8">{parts.map((part, partIndex) => <span key={partIndex}>{part}{partIndex < parts.length - 1 && <input className="mx-1 inline-block w-32 rounded border px-2 py-1" value={values[partIndex] || ''} onChange={event => setArrayAnswer(question.id, partIndex, event.target.value)} />}</span>)}</div>;
              })()}

              {question.question_type === 'matching' && (() => {
                const left = Array.isArray(question.options?.left) ? question.options.left : [];
                const choices = Array.isArray(question.options?.choices) ? question.options.choices : [];
                const values = Array.isArray(answers[question.id]) ? answers[question.id] as string[] : [];
                return <div className="space-y-2">{left.map((label: string, pairIndex: number) => <label key={pairIndex} className="grid gap-2 text-sm sm:grid-cols-2 sm:items-center"><strong>{label}</strong><select className="rounded-lg border p-2" value={values[pairIndex] || ''} onChange={event => setArrayAnswer(question.id, pairIndex, event.target.value)}><option value="">Associer…</option>{choices.map((choice: string, choiceIndex: number) => <option key={choiceIndex} value={choice}>{choice}</option>)}</select></label>)}</div>;
              })()}

              {question.question_type === 'sentence_order' && (
                <input className="w-full rounded-lg border p-3 text-sm" value={typeof answers[question.id] === 'string' ? answers[question.id] as string : ''} onChange={event => setAnswers(current => ({ ...current, [question.id]: event.target.value }))} placeholder={`Remettez les éléments dans l’ordre : ${(question.options?.tokens || []).join(' · ')}`} />
              )}

              {question.question_type === 'listening_comprehension' && (() => {
                const questions = Array.isArray(question.options?.questions) ? question.options.questions : [];
                const values = Array.isArray(answers[question.id]) ? answers[question.id] as string[] : [];
                return <div className="space-y-3">{questions.map((item: any, itemIndex: number) => <label key={itemIndex} className="block text-sm"><span className="font-medium">{item.question || `Question ${itemIndex + 1}`}</span><input className="mt-1 w-full rounded-lg border p-2" value={values[itemIndex] || ''} onChange={event => setArrayAnswer(question.id, itemIndex, event.target.value)} /></label>)}</div>;
              })()}

              {['dictation', 'written_expression', 'case_study'].includes(question.question_type) && (
                <textarea rows={question.question_type === 'written_expression' || question.question_type === 'case_study' ? 8 : 5} className="w-full rounded-lg border p-3 text-sm" value={typeof answers[question.id] === 'string' ? answers[question.id] as string : ''} onChange={event => setAnswers(current => ({ ...current, [question.id]: event.target.value }))} placeholder={question.question_type === 'dictation' ? 'Transcrivez ce que vous entendez…' : 'Rédigez votre réponse…'} />
              )}

              {['exercise', 'assignment_upload', 'oral_response', 'pronunciation'].includes(question.question_type) && (
                <div>
                  <label className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${preview ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                    <Upload size={15} /> {preview ? 'Dépôt désactivé en prévisualisation' : (question.question_type === 'oral_response' || question.question_type === 'pronunciation' ? 'Déposer mon enregistrement audio' : 'Déposer mon travail')}
                    <input type="file" multiple disabled={preview} className="hidden" accept={(question.accepted_submission_types || []).map(type => `.${type}`).join(',')} onChange={event => setFiles(question.id, event.target.files)} />
                  </label>
                  {pendingFiles(question.id).length > 0 && (
                    <div className="mt-2 space-y-1 text-xs text-green-700">
                      {pendingFiles(question.id).map((item, fileIndex) => <p key={`${item.file.name}-${fileIndex}`}>{item.file.name}</p>)}
                    </div>
                  )}
                </div>
              )}
              </div>
            </div>;
          })}
        </div>
      )}

      {error && <p className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700"><AlertCircle size={16} />{error}</p>}

      {result && !latest && !preview && (
        <div className={`mt-4 rounded-xl p-4 ${result.passed ? 'bg-green-50' : 'bg-amber-50'}`}>
          {result.passed ? <div className="flex gap-2 text-green-700"><CheckCircle size={18} />Évaluation réussie : {result.score}%</div> : result.pending_review ? <div className="flex gap-2 text-amber-700"><Clock size={18} />Réponse envoyée, correction en attente.</div> : <div className="flex gap-2 text-red-700"><XCircle size={18} />Score : {result.score}% — seuil requis {assessment.passing_score}%.</div>}
        </div>
      )}

      {preview ? (
        <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
          <div className="flex items-start gap-2"><CheckCircle size={17} className="mt-0.5 shrink-0" /><div><p className="font-semibold">Simulation en lecture seule</p><p className="mt-1 text-xs">Vous pouvez vérifier toutes les questions et interactions. L’envoi, les dépôts de fichiers, la note, les tentatives et la progression sont volontairement désactivés dans cette prévisualisation.</p></div></div>
        </div>
      ) : !passed && !pending && !blocked && (
        <button disabled={!complete || sending} onClick={submit} className="mt-5 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" style={{ backgroundColor: BLUE }}>
          {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          {uploading ? 'Téléversement des fichiers…' : 'Envoyer l’évaluation'}
        </button>
      )}
    </section>
  );
}
