import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlertCircle, CheckCircle2, FileText, Loader2, LockKeyhole, Save, Send,
  ShieldCheck, UserCheck, Users,
} from 'lucide-react';

const API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/assessment-governance`;
const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

type LoginForm = { email: string; pin: string };
type TermsForm = { confidentiality: boolean; conflict: boolean; details: string };
type ReviewForm = { score: string; recommendation: string; comment: string; complement_request: string };

async function publicCall<T = any>(action: string, payload: Record<string, unknown>) {
  const response = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) throw new Error(data.message || data.error || 'Accès au jury impossible.');
  return data as T;
}

function readableAnswer(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Aucune réponse';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const preferred = record.answer ?? record.text ?? record.value ?? record.selected ?? record.response;
    if (preferred !== undefined) return readableAnswer(preferred);
    return Object.entries(record).map(([key, item]) => `${key} : ${readableAnswer(item)}`).join('\n');
  }
  return String(value);
}

export default function AssessmentJuryAccess() {
  const { inviteToken = '' } = useParams();
  const storageKey = useMemo(() => `omnia-jury-access:${inviteToken}`, [inviteToken]);
  const [externalToken, setExternalToken] = useState(() => sessionStorage.getItem(storageKey) || '');
  const [data, setData] = useState<any>(null);
  const [login, setLogin] = useState<LoginForm>({ email: '', pin: '' });
  const [terms, setTerms] = useState<TermsForm>({ confidentiality: false, conflict: false, details: '' });
  const [reviews, setReviews] = useState<Record<string, ReviewForm>>({});
  const [loading, setLoading] = useState(Boolean(externalToken));
  const [working, setWorking] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async (token = externalToken) => {
    if (!token) return;
    setLoading(true); setError('');
    try {
      const result = await publicCall('external_overview', { external_session_token: token });
      setData(result);
      const initial: Record<string, ReviewForm> = {};
      for (const item of result.cases || []) {
        initial[item.id] = {
          score: item.review?.score === null || item.review?.score === undefined ? '' : String(item.review.score),
          recommendation: item.review?.recommendation || 'pass',
          comment: item.review?.comment || '',
          complement_request: item.review?.complement_request || '',
        };
      }
      setReviews(initial);
      setTerms({
        confidentiality: Boolean(result.member?.confidentiality_accepted_at),
        conflict: result.member?.conflict_status === 'declared',
        details: result.member?.conflict_details || '',
      });
    } catch (caught) {
      sessionStorage.removeItem(storageKey);
      setExternalToken(''); setData(null);
      setError(caught instanceof Error ? caught.message : 'Session expirée.');
    } finally { setLoading(false); }
  }, [externalToken, storageKey]);

  useEffect(() => { if (externalToken) void load(externalToken); }, [externalToken, load]);

  async function signIn() {
    if (!login.email.trim() || !login.pin.trim()) { setError('Indiquez l’adresse e-mail invitée et le code PIN.'); return; }
    setWorking('login'); setError(''); setSuccess('');
    try {
      const result = await publicCall<any>('external_login', { invite_token: inviteToken, email: login.email, pin: login.pin });
      sessionStorage.setItem(storageKey, result.external_session_token);
      setExternalToken(result.external_session_token);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Connexion impossible.'); }
    finally { setWorking(''); }
  }

  async function acceptTerms() {
    if (!terms.confidentiality) { setError('L’engagement de confidentialité est obligatoire.'); return; }
    if (terms.conflict && !terms.details.trim()) { setError('Décrivez le conflit d’intérêts déclaré.'); return; }
    setWorking('terms'); setError(''); setSuccess('');
    try {
      await publicCall('external_accept_terms', {
        external_session_token: externalToken,
        confidentiality_accepted: true,
        conflict_declared: terms.conflict,
        conflict_details: terms.details,
      });
      setSuccess(terms.conflict ? 'Votre conflit d’intérêts a été déclaré. Aucun dossier ne sera accessible.' : 'Vos engagements sont enregistrés.');
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Validation impossible.'); }
    finally { setWorking(''); }
  }

  async function saveReview(caseId: string, publish: boolean) {
    const current = reviews[caseId] || { score: '', recommendation: 'pass', comment: '', complement_request: '' };
    if (publish && data.member?.permissions?.score !== false && (current.score === '' || Number.isNaN(Number(current.score)))) {
      setError('Indiquez une note avant de signer votre avis.'); return;
    }
    setWorking(caseId); setError(''); setSuccess('');
    try {
      await publicCall('external_save_review', {
        external_session_token: externalToken,
        case_id: caseId,
        score: current.score === '' ? null : Number(current.score),
        recommendation: current.recommendation,
        comment: current.comment,
        complement_request: current.complement_request,
        publish,
      });
      setSuccess(publish ? 'Votre avis a été signé et transmis.' : 'Votre brouillon a été enregistré.');
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Enregistrement impossible.'); }
    finally { setWorking(''); }
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <header className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-xl p-3" style={{ background: '#FFF8E7' }}><ShieldCheck color={GOLD} /></div>
            <div>
              <p className="text-sm font-semibold" style={{ color: GOLD }}>Omnia Global Academy</p>
              <h1 className="mt-1 text-2xl font-bold" style={{ color: BLUE }}>Accès sécurisé au jury</h1>
              <p className="mt-2 text-sm text-gray-600">Cet accès est limité au jury et aux dossiers qui vous ont été attribués. Aucun rôle permanent n’est créé sur la plateforme.</p>
            </div>
          </div>
        </header>

        {error && <p className="mt-5 flex items-center gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-700"><AlertCircle size={17} />{error}</p>}
        {success && <p className="mt-5 flex items-center gap-2 rounded-xl bg-green-50 p-4 text-sm text-green-700"><CheckCircle2 size={17} />{success}</p>}

        {!externalToken ? (
          <section className="mx-auto mt-6 max-w-xl rounded-2xl border bg-white p-6" style={{ borderColor: BORDER }}>
            <h2 className="flex items-center gap-2 font-semibold" style={{ color: BLUE }}><LockKeyhole size={18} color={GOLD} />Vérifier l’invitation</h2>
            <p className="mt-2 text-sm text-gray-500">Utilisez l’adresse e-mail invitée et le code PIN transmis séparément par Omnia.</p>
            <div className="mt-5 space-y-4">
              <Field label="Adresse e-mail"><input type="email" value={login.email} onChange={event => setLogin(current => ({ ...current, email: event.target.value }))} className="h-11 w-full rounded-lg border px-3 text-sm" style={{ borderColor: BORDER }} /></Field>
              <Field label="Code PIN"><input inputMode="numeric" value={login.pin} onChange={event => setLogin(current => ({ ...current, pin: event.target.value.replace(/\D/g, '').slice(0, 8) }))} className="h-11 w-full rounded-lg border px-3 text-sm tracking-[0.25em]" style={{ borderColor: BORDER }} /></Field>
              <button disabled={working === 'login'} onClick={() => void signIn()} className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white disabled:opacity-40" style={{ background: BLUE }}>{working === 'login' ? <Loader2 className="animate-spin" size={16} /> : <UserCheck size={16} />}Accéder au jury</button>
            </div>
          </section>
        ) : loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin" color={BLUE} /></div>
        ) : data && (
          <div className="mt-6 space-y-5">
            <section className="rounded-2xl border bg-white p-5" style={{ borderColor: BORDER }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h2 className="font-semibold" style={{ color: BLUE }}>{data.panel?.name}</h2><p className="mt-1 text-sm text-gray-500">{data.panel?.purpose || 'Jury d’évaluation'} · {data.member?.name} · {data.member?.role}</p></div>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">Accès temporaire</span>
              </div>
            </section>

            {!data.member?.confidentiality_accepted_at || data.member?.conflict_status === 'pending' ? (
              <section className="rounded-2xl border bg-white p-6" style={{ borderColor: BORDER }}>
                <h2 className="flex items-center gap-2 font-semibold" style={{ color: BLUE }}><ShieldCheck size={18} color={GOLD} />Confidentialité et conflit d’intérêts</h2>
                <label className="mt-5 flex items-start gap-3 text-sm text-gray-700"><input type="checkbox" checked={terms.confidentiality} onChange={event => setTerms(current => ({ ...current, confidentiality: event.target.checked }))} className="mt-1" /><span>Je m’engage à utiliser les données uniquement pour cette évaluation, à ne pas les copier inutilement et à respecter leur confidentialité.</span></label>
                <label className="mt-4 flex items-start gap-3 text-sm text-gray-700"><input type="checkbox" checked={terms.conflict} onChange={event => setTerms(current => ({ ...current, conflict: event.target.checked }))} className="mt-1" /><span>Je déclare un conflit d’intérêts réel ou potentiel avec un candidat ou le travail évalué.</span></label>
                {terms.conflict && <Field label="Description du conflit"><textarea rows={4} value={terms.details} onChange={event => setTerms(current => ({ ...current, details: event.target.value }))} className="w-full rounded-lg border p-3 text-sm" style={{ borderColor: BORDER }} /></Field>}
                <button disabled={working === 'terms'} onClick={() => void acceptTerms()} className="mt-5 inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40" style={{ background: BLUE }}>{working === 'terms' ? <Loader2 className="animate-spin" size={15} /> : <CheckCircle2 size={15} />}Valider mes déclarations</button>
              </section>
            ) : data.member?.conflict_status === 'declared' ? (
              <section className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">Votre accès aux dossiers est bloqué à la suite de la déclaration de conflit d’intérêts. L’Administration Omnia pourra vous remplacer.</section>
            ) : data.cases?.length ? data.cases.map((juryCase: any) => {
              const current = reviews[juryCase.id] || { score: '', recommendation: 'pass', comment: '', complement_request: '' };
              return (
                <section key={juryCase.id} className="rounded-2xl border bg-white p-5" style={{ borderColor: BORDER }}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><h2 className="font-semibold" style={{ color: BLUE }}>{juryCase.assessment?.title || 'Évaluation'}</h2><p className="mt-1 text-xs text-gray-500">Candidat : {juryCase.candidate?.full_name || juryCase.candidate_alias} · tentative {juryCase.attempt?.attempt_number}</p></div>
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">{juryCase.review?.status || juryCase.status}</span>
                  </div>
                  <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px]">
                    <div>
                      <h3 className="text-sm font-semibold" style={{ color: BLUE }}>Copie et réponses</h3>
                      <div className="mt-3 space-y-3">{juryCase.answers?.map((answer: any, index: number) => <article key={answer.id} className="rounded-xl bg-gray-50 p-4"><p className="text-sm font-semibold" style={{ color: BLUE }}>{index + 1}. {answer.assessment_questions?.prompt || 'Question'}</p><p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{readableAnswer(answer.answer_json)}</p></article>)}</div>
                      {juryCase.files?.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{juryCase.files.map((file: any) => <a key={file.id} href={file.signed_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold" style={{ borderColor: BORDER, color: BLUE }}><FileText size={14} />{file.file_name}</a>)}</div>}
                    </div>
                    <aside className="space-y-3 rounded-xl bg-gray-50 p-4">
                      {data.member?.permissions?.score !== false && <Field label="Note sur 100"><input type="number" min="0" max="100" value={current.score} onChange={event => setReviews(state => ({ ...state, [juryCase.id]: { ...current, score: event.target.value } }))} className="h-10 w-full rounded-lg border px-3 text-sm" style={{ borderColor: BORDER }} /></Field>}
                      <Field label="Recommandation"><select value={current.recommendation} onChange={event => setReviews(state => ({ ...state, [juryCase.id]: { ...current, recommendation: event.target.value } }))} className="h-10 w-full rounded-lg border px-2 text-sm" style={{ borderColor: BORDER }}><option value="pass">Réussite</option><option value="fail">Échec</option><option value="retry">Nouvelle tentative</option><option value="complement">Complément demandé</option></select></Field>
                      {data.member?.permissions?.comment !== false && <Field label="Commentaire"><textarea rows={5} value={current.comment} onChange={event => setReviews(state => ({ ...state, [juryCase.id]: { ...current, comment: event.target.value } }))} className="w-full rounded-lg border p-3 text-sm" style={{ borderColor: BORDER }} /></Field>}
                      {data.member?.permissions?.request_complement === true && <Field label="Complément demandé"><textarea rows={3} value={current.complement_request} onChange={event => setReviews(state => ({ ...state, [juryCase.id]: { ...current, complement_request: event.target.value } }))} className="w-full rounded-lg border p-3 text-sm" style={{ borderColor: BORDER }} /></Field>}
                      <div className="grid grid-cols-2 gap-2"><button disabled={working === juryCase.id} onClick={() => void saveReview(juryCase.id, false)} className="inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold" style={{ borderColor: BORDER, color: BLUE }}><Save size={14} />Brouillon</button><button disabled={working === juryCase.id} onClick={() => void saveReview(juryCase.id, true)} className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white" style={{ background: BLUE }}><Send size={14} />Signer</button></div>
                    </aside>
                  </div>
                </section>
              );
            }) : <section className="rounded-2xl border bg-white p-12 text-center text-sm text-gray-500" style={{ borderColor: BORDER }}><Users className="mx-auto mb-3 text-gray-300" />Aucun dossier n’est encore affecté à ce jury.</section>}
          </div>
        )}
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="mt-3 block text-xs font-semibold text-gray-600">{label}<div className="mt-1">{children}</div></label>;
}
