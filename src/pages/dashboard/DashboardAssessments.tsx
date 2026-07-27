import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, CalendarClock, CheckCircle2, FileCheck2, FileText, Loader2,
  RotateCcw, ShieldAlert, SlidersHorizontal, Upload, XCircle, type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '../../components/DashboardLayout';
import { edgeAuthHeaders } from '../../lib/edgeAuth';
import { assessmentGovernanceCall, uploadAssessmentGovernanceFile } from '../../lib/assessmentGovernanceApi';

const API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/assessment-center`;
const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

type AccommodationDraft = { extra_time_minutes: string; break_minutes: string; reason: string };
type AppealDraft = { reason: string; file: File | null };

async function call(action: string, payload: Record<string, unknown> = {}) {
  const response = await fetch(API, { method: 'POST', headers: edgeAuthHeaders(), body: JSON.stringify({ action, ...payload }) });
  const data = await response.json();
  if (!response.ok || data.success === false) throw new Error(data.message || data.error || 'Erreur');
  return data;
}
function date(value?: string) { return value ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—'; }
function statusLabel(status: string) {
  const labels: Record<string, string> = { submitted: 'Soumise', admissibility_review: 'Recevabilité en cours', accepted: 'Recevable', in_review: 'Nouvelle correction', rejected: 'Rejetée', decided: 'Décision publiée', withdrawn: 'Retirée' };
  return labels[status] || status;
}

export default function DashboardAssessments() {
  const [data, setData] = useState<any>({ sessions: [], results: [], incidents: [], accommodations: [], appeals: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tab, setTab] = useState<'sessions' | 'results' | 'appeals' | 'incidents'>('sessions');
  const [openAccommodation, setOpenAccommodation] = useState('');
  const [drafts, setDrafts] = useState<Record<string, AccommodationDraft>>({});
  const [openAppeal, setOpenAppeal] = useState('');
  const [appealDrafts, setAppealDrafts] = useState<Record<string, AppealDraft>>({});

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [assessmentData, appealData] = await Promise.all([
        call('learner_dashboard'),
        assessmentGovernanceCall<any>('learner_appeals_overview').catch(() => ({ appeals: [] })),
      ]);
      setData({ ...assessmentData, appeals: appealData.appeals || [] });
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Chargement impossible.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const appealsByAttempt = useMemo(() => new Map((data.appeals || []).map((item: any) => [item.attempt_id, item])), [data.appeals]);
  function accommodationFor(sessionId: string) { return data.accommodations?.find((item: any) => item.session_id === sessionId); }

  function openRequest(sessionId: string) {
    const existing = accommodationFor(sessionId);
    setDrafts(current => ({ ...current, [sessionId]: { extra_time_minutes: String(existing?.extra_time_minutes || ''), break_minutes: String(existing?.break_minutes || ''), reason: existing?.reason || '' } }));
    setOpenAccommodation(current => current === sessionId ? '' : sessionId);
  }

  async function requestAccommodation(sessionId: string) {
    const draft = drafts[sessionId] || { extra_time_minutes: '', break_minutes: '', reason: '' };
    if (!draft.reason.trim()) { setError('Décrivez le besoin d’aménagement. Aucun diagnostic médical détaillé n’est requis.'); return; }
    setSaving(sessionId); setError(''); setSuccess('');
    try {
      await call('learner_request_accommodation', { session_id: sessionId, extra_time_minutes: Number(draft.extra_time_minutes || 0), break_minutes: Number(draft.break_minutes || 0), reason: draft.reason });
      setSuccess('Votre demande d’aménagement a été transmise au Super Admin.'); setOpenAccommodation(''); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Demande impossible.'); }
    finally { setSaving(''); }
  }

  function beginAppeal(attemptId: string) {
    setAppealDrafts(current => ({ ...current, [attemptId]: current[attemptId] || { reason: '', file: null } }));
    setOpenAppeal(current => current === attemptId ? '' : attemptId);
  }

  async function submitAppeal(attemptId: string) {
    const draft = appealDrafts[attemptId] || { reason: '', file: null };
    if (!draft.reason.trim()) { setError('Expliquez précisément pourquoi vous demandez une révision.'); return; }
    setSaving(`appeal-${attemptId}`); setError(''); setSuccess('');
    try {
      const evidence = draft.file ? [await uploadAssessmentGovernanceFile(draft.file, 'appeal')] : [];
      await assessmentGovernanceCall('learner_submit_appeal', { attempt_id: attemptId, reason: draft.reason, evidence });
      setSuccess('Votre demande de révision a été transmise. La note initiale reste conservée dans l’historique.'); setOpenAppeal(''); await load(); setTab('appeals');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Demande impossible.'); }
    finally { setSaving(''); }
  }

  async function withdrawAppeal(appealId: string) {
    setSaving(`withdraw-${appealId}`); setError(''); setSuccess('');
    try { await assessmentGovernanceCall('learner_withdraw_appeal', { appeal_id: appealId }); setSuccess('La demande de révision a été retirée.'); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Retrait impossible.'); }
    finally { setSaving(''); }
  }

  function appealStillOpen(item: any) {
    if (item.result_status !== 'published' || item.assessment?.appeal_enabled === false) return false;
    const published = new Date(item.result_published_at || item.graded_at || Date.now()).getTime();
    return Date.now() <= published + Number(item.assessment?.appeal_deadline_days ?? 7) * 86400_000;
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl p-6 lg:p-8">
        <h1 className="text-2xl font-bold" style={{ color: BLUE }}>Mes évaluations</h1>
        <p className="mt-1 text-sm text-gray-500">Sessions programmées, résultats, compétences, révisions de notes, aménagements et incidents.</p>
        {error && <p className="mt-5 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700"><AlertCircle size={16} />{error}</p>}
        {success && <p className="mt-5 rounded-xl bg-green-50 p-3 text-sm text-green-700">{success}</p>}

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <Stat icon={CalendarClock} label="Sessions" value={data.sessions?.length || 0} />
          <Stat icon={FileCheck2} label="Résultats publiés" value={data.results?.filter((item: any) => item.result_status === 'published').length || 0} />
          <Stat icon={RotateCcw} label="Révisions" value={data.appeals?.filter((item: any) => !['rejected', 'decided', 'withdrawn'].includes(item.status)).length || 0} />
          <Stat icon={ShieldAlert} label="Incidents ouverts" value={data.incidents?.filter((item: any) => !['resolved', 'dismissed'].includes(item.status)).length || 0} />
        </div>

        <div className="mt-6 flex flex-wrap gap-2 border-b pb-3" style={{ borderColor: BORDER }}>
          {(['sessions', 'results', 'appeals', 'incidents'] as const).map(key => <button key={key} onClick={() => setTab(key)} className="rounded-lg px-4 py-2 text-sm font-semibold" style={{ background: tab === key ? BLUE : '#F3F4F6', color: tab === key ? 'white' : '#4B5563' }}>{key === 'sessions' ? 'Sessions' : key === 'results' ? 'Résultats' : key === 'appeals' ? 'Révisions de note' : 'Incidents'}</button>)}
        </div>

        {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div> : <div className="mt-5 space-y-3">
          {tab === 'sessions' && (data.sessions?.length ? data.sessions.map((item: any) => {
            const accommodation = accommodationFor(item.id); const draft = drafts[item.id] || { extra_time_minutes: '', break_minutes: '', reason: '' };
            return <div key={item.id} className="rounded-xl border bg-white p-4" style={{ borderColor: BORDER }}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold" style={{ color: BLUE }}>{item.title}</p><p className="mt-1 text-xs text-gray-500">{item.course?.title} · {date(item.starts_at)} → {date(item.effective_ends_at || item.ends_at)}</p><p className="mt-2 text-sm text-gray-600">Surveillance {item.security_level}/4 · {item.delivery_mode}</p>{accommodation && <p className="mt-2 text-xs font-semibold text-amber-700">Aménagement : {accommodation.status} · +{accommodation.extra_time_minutes || 0} min · pauses {accommodation.break_minutes || 0} min</p>}</div><div className="flex flex-col items-end gap-2"><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">{item.computed_status}</span>{['open', 'in_progress'].includes(item.computed_status) && <Link to={`/dashboard/evaluations/session/${item.id}`} className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: BLUE }}>Accéder à la session</Link>}{!['completed', 'cancelled', 'suspended'].includes(item.computed_status) && <button onClick={() => openRequest(item.id)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold" style={{ borderColor: GOLD, color: BLUE }}><SlidersHorizontal size={14} />Aménagement</button>}</div></div>
              {openAccommodation === item.id && <div className="mt-4 rounded-xl bg-gray-50 p-4"><p className="text-sm font-semibold" style={{ color: BLUE }}>Demander un aménagement</p><p className="mt-1 text-xs text-gray-500">Indiquez uniquement le besoin fonctionnel.</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-gray-600">Temps supplémentaire (minutes)<input type="number" min="0" max="480" value={draft.extra_time_minutes} onChange={event => setDrafts(current => ({ ...current, [item.id]: { ...draft, extra_time_minutes: event.target.value } }))} className="mt-1 h-10 w-full rounded-lg border px-3 text-sm" style={{ borderColor: BORDER }} /></label><label className="text-xs font-semibold text-gray-600">Temps de pause (minutes)<input type="number" min="0" max="240" value={draft.break_minutes} onChange={event => setDrafts(current => ({ ...current, [item.id]: { ...draft, break_minutes: event.target.value } }))} className="mt-1 h-10 w-full rounded-lg border px-3 text-sm" style={{ borderColor: BORDER }} /></label><label className="text-xs font-semibold text-gray-600 sm:col-span-2">Besoin d’aménagement<textarea rows={3} value={draft.reason} onChange={event => setDrafts(current => ({ ...current, [item.id]: { ...draft, reason: event.target.value } }))} className="mt-1 w-full rounded-lg border p-3 text-sm" style={{ borderColor: BORDER }} /></label></div><button disabled={saving === item.id} onClick={() => void requestAccommodation(item.id)} className="mt-3 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" style={{ background: BLUE }}>{saving === item.id && <Loader2 size={14} className="animate-spin" />}Transmettre la demande</button></div>}
            </div>;
          }) : <Empty icon={CalendarClock} text="Aucune session programmée." />)}

          {tab === 'results' && (data.results?.length ? data.results.map((item: any) => {
            const existingAppeal: any = appealsByAttempt.get(item.id); const draft = appealDrafts[item.id] || { reason: '', file: null }; const allowed = appealStillOpen(item) && !existingAppeal;
            return <div key={item.id} className="rounded-xl border bg-white p-4" style={{ borderColor: BORDER }}><div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold" style={{ color: BLUE }}>{item.assessment?.title || 'Évaluation'}</p><p className="mt-1 text-xs text-gray-500">Tentative {item.attempt_number} · {date(item.graded_at || item.submitted_at)}</p></div><div className="text-right"><p className="text-xl font-bold" style={{ color: item.passed ? '#15803D' : '#B91C1C' }}>{item.score ?? '—'}%</p><p className="text-xs text-gray-500">{item.result_status === 'published' ? 'Résultat publié' : 'En cours de validation'}</p></div></div>{item.feedback && <p className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">{item.feedback}</p>}{item.competencies?.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{item.competencies.map((competency: any) => <span key={competency.id} className={`rounded-full px-3 py-1 text-xs font-semibold ${competency.status === 'validated' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{competency.competency_name} · {competency.score ?? '—'}%</span>)}</div>}
              <div className="mt-4 border-t pt-3" style={{ borderColor: BORDER }}>{existingAppeal ? <p className="text-xs font-semibold text-amber-700">Révision : {statusLabel(existingAppeal.status)}</p> : allowed ? <button onClick={() => beginAppeal(item.id)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold" style={{ borderColor: GOLD, color: BLUE }}><RotateCcw size={14} />Demander une révision</button> : item.result_status === 'published' && <p className="text-xs text-gray-500">Le délai de révision est expiré ou cette évaluation ne permet pas de révision.</p>}</div>
              {openAppeal === item.id && <div className="mt-4 rounded-xl bg-gray-50 p-4"><p className="text-sm font-semibold" style={{ color: BLUE }}>Demande de révision</p><p className="mt-1 text-xs text-gray-500">La note initiale sera conservée. Une seule demande standard peut être déposée pour cette tentative.</p><textarea rows={4} value={draft.reason} onChange={event => setAppealDrafts(current => ({ ...current, [item.id]: { ...draft, reason: event.target.value } }))} className="mt-3 w-full rounded-lg border p-3 text-sm" style={{ borderColor: BORDER }} placeholder="Expliquez les points précis à réexaminer…" /><label className="mt-3 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed p-3 text-xs font-semibold" style={{ borderColor: BORDER, color: BLUE }}><Upload size={15} /><span>{draft.file?.name || 'Joindre une preuve facultative (PDF, Word ou image)'}</span><input type="file" className="hidden" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp" onChange={event => setAppealDrafts(current => ({ ...current, [item.id]: { ...draft, file: event.target.files?.[0] || null } }))} /></label><button disabled={saving === `appeal-${item.id}`} onClick={() => void submitAppeal(item.id)} className="mt-3 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" style={{ background: BLUE }}>{saving === `appeal-${item.id}` && <Loader2 size={14} className="animate-spin" />}Envoyer la demande</button></div>}
            </div>;
          }) : <Empty icon={CheckCircle2} text="Aucun résultat." />)}

          {tab === 'appeals' && (data.appeals?.length ? data.appeals.map((item: any) => <div key={item.id} className="rounded-xl border bg-white p-4" style={{ borderColor: BORDER }}><div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold" style={{ color: BLUE }}>{item.attempt?.course_assessments?.title || 'Évaluation'}</p><p className="mt-1 text-xs text-gray-500">Soumise le {date(item.submitted_at)} · note initiale {item.original_score ?? item.attempt?.score ?? '—'}%</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">{statusLabel(item.status)}</span></div><p className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">{item.reason}</p>{item.admissibility_reason && <p className="mt-3 text-sm text-gray-600"><strong>Recevabilité :</strong> {item.admissibility_reason}</p>}{item.decision_reason && <p className="mt-3 text-sm text-gray-600"><strong>Décision :</strong> {item.decision_reason}</p>}{item.status === 'decided' && <div className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-700">Décision finale : {item.decision} {item.final_score !== null && item.final_score !== undefined ? `· ${item.final_score}%` : ''}</div>}{['submitted', 'admissibility_review'].includes(item.status) && <button disabled={saving === `withdraw-${item.id}`} onClick={() => void withdrawAppeal(item.id)} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700"><XCircle size={14} />Retirer ma demande</button>}</div>) : <Empty icon={RotateCcw} text="Aucune demande de révision." />)}

          {tab === 'incidents' && (data.incidents?.length ? data.incidents.map((item: any) => <div key={item.id} className="rounded-xl border bg-white p-4" style={{ borderColor: BORDER }}><div className="flex justify-between gap-3"><div><p className="font-semibold" style={{ color: BLUE }}>{item.title}</p><p className="mt-1 text-xs text-gray-500">{item.incident_type} · {date(item.created_at)}</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">{item.status}</span></div><p className="mt-3 text-sm text-gray-600">{item.description}</p>{item.resolution && <p className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-700">{item.resolution}</p>}</div>) : <Empty icon={ShieldAlert} text="Aucun incident déclaré." />)}
        </div>}
      </div>
    </DashboardLayout>
  );
}

function Stat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) { return <div className="rounded-xl border bg-white p-4" style={{ borderColor: BORDER }}><Icon size={18} color={GOLD} /><p className="mt-2 text-xs text-gray-500">{label}</p><p className="text-2xl font-bold" style={{ color: BLUE }}>{value}</p></div>; }
function Empty({ icon: Icon, text }: { icon: LucideIcon; text: string }) { return <div className="rounded-xl border bg-white p-12 text-center text-sm text-gray-500" style={{ borderColor: BORDER }}><Icon className="mx-auto mb-2 text-gray-300" />{text}</div>; }
