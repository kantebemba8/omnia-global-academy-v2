import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import {
  Award,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileCheck2,
  RefreshCw,
  Route,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { professionalPathwaysCall } from '../../lib/professionalPathwaysApi';

const BLUE = '#002050';
const GOLD = '#BF8813';

type LearnerData = {
  catalog: any[];
  enrollments: any[];
  renewals: any[];
  credentials: any[];
  transcripts: any[];
  prerequisite_submissions: any[];
};

const statusLabel: Record<string, string> = {
  active: 'En cours', blocked: 'Bloqué', completed: 'Terminé', expired: 'Expiré', withdrawn: 'Retiré',
  pending: 'À faire', in_progress: 'En cours', submitted: 'Soumis', passed: 'Validé', failed: 'Échoué', waived: 'Dispensé',
  due: 'À renouveler', approved: 'Approuvé', rejected: 'Refusé', issued: 'Délivré', suspended: 'Suspendu', revoked: 'Révoqué',
};

export default function DashboardProfessionalPathways() {
  const [data, setData] = useState<LearnerData | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submission, setSubmission] = useState<{ kind: 'prerequisite' | 'step' | 'renewal'; id: string; title: string } | null>(null);
  const [note, setNote] = useState('');

  const load = async () => {
    setError('');
    try {
      setData(await professionalPathwaysCall<LearnerData>('learner_dashboard'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chargement impossible.');
    }
  };

  useEffect(() => { load(); }, []);

  const metrics = useMemo(() => ({
    active: data?.enrollments.filter(item => item.status === 'active').length || 0,
    completed: data?.enrollments.filter(item => item.status === 'completed').length || 0,
    renewals: data?.renewals.filter(item => ['due', 'in_progress', 'submitted'].includes(item.status)).length || 0,
    credentials: data?.credentials.filter(item => item.status === 'issued').length || 0,
  }), [data]);

  const run = async (key: string, action: string, payload: Record<string, unknown>) => {
    setBusy(key); setError(''); setMessage('');
    try {
      await professionalPathwaysCall(action, payload);
      setMessage('Opération enregistrée.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Opération impossible.');
    } finally {
      setBusy('');
    }
  };

  const submitEvidence = async (event: FormEvent) => {
    event.preventDefault();
    if (!submission) return;
    const action = submission.kind === 'prerequisite' ? 'submit_prerequisite' : submission.kind === 'step' ? 'submit_step' : 'submit_renewal';
    const payload = submission.kind === 'prerequisite'
      ? { prerequisite_id: submission.id, note }
      : submission.kind === 'step'
        ? { result_id: submission.id, note, comments: note }
        : { renewal_id: submission.id, evidence: { note } };
    await run(`submit-${submission.id}`, action, payload);
    setSubmission(null); setNote('');
  };

  if (!data) return <DashboardLayout><div className="p-8 text-sm text-gray-600">{error || 'Chargement des parcours…'}</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <main className="mx-auto max-w-7xl p-5 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b pb-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em]" style={{ color: GOLD }}>Programme 2 · GM4</p>
            <h1 className="mt-2 text-3xl font-black" style={{ color: BLUE }}>Parcours professionnels et certifications</h1>
            <p className="mt-2 max-w-3xl text-sm text-gray-600">Suivez vos formations obligatoires, examens, projets, jurys, relevés professionnels et renouvellements depuis un même espace.</p>
          </div>
          <button onClick={load} className="flex items-center gap-2 border px-4 py-2 text-sm font-semibold"><RefreshCw size={16}/>Actualiser</button>
        </div>

        {error && <p className="mt-4 border-l-4 border-red-500 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {message && <p className="mt-4 border-l-4 border-emerald-600 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={<Route/>} label="Parcours en cours" value={metrics.active}/>
          <Metric icon={<CheckCircle2/>} label="Parcours terminés" value={metrics.completed}/>
          <Metric icon={<CalendarClock/>} label="Renouvellements" value={metrics.renewals}/>
          <Metric icon={<Award/>} label="Credentials actifs" value={metrics.credentials}/>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-black" style={{ color: BLUE }}>Mes parcours</h2>
          <div className="mt-4 space-y-5">
            {data.enrollments.length === 0 && <Empty text="Vous n’êtes inscrit à aucun parcours professionnel."/>}
            {data.enrollments.map(enrollment => (
              <article key={enrollment.id} className="border bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase" style={{ color: GOLD }}>{enrollment.pathway?.certification_type || 'Parcours'}</p>
                    <h3 className="mt-1 text-lg font-black" style={{ color: BLUE }}>{enrollment.pathway?.title}</h3>
                    <p className="mt-1 text-sm text-gray-500">Statut : {statusLabel[enrollment.status] || enrollment.status}</p>
                  </div>
                  <div className="min-w-48">
                    <div className="flex justify-between text-xs"><span>Progression</span><strong>{Math.round(Number(enrollment.progress_percent || 0))}%</strong></div>
                    <div className="mt-2 h-2 overflow-hidden bg-gray-100"><div className="h-full" style={{ width: `${Math.min(100, Number(enrollment.progress_percent || 0))}%`, background: GOLD }}/></div>
                    {enrollment.status === 'active' && <button disabled={busy === enrollment.id} onClick={() => run(enrollment.id, 'sync_enrollment', { enrollment_id: enrollment.id })} className="mt-3 flex items-center gap-2 text-xs font-bold" style={{ color: BLUE }}><RefreshCw size={14}/>Synchroniser mes résultats</button>}
                  </div>
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {(enrollment.results || []).sort((a:any,b:any)=>(a.step?.position||0)-(b.step?.position||0)).map((result:any) => (
                    <div key={result.id} className="border p-4">
                      <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{result.step?.title}</p><p className="text-xs text-gray-500">{result.step?.step_type} · {statusLabel[result.status] || result.status}</p></div><StepIcon status={result.status}/></div>
                      {result.score != null && <p className="mt-2 text-xs">Score : <strong>{result.score}</strong></p>}
                      {['jury','evidence'].includes(result.step?.step_type) && ['pending','in_progress','failed'].includes(result.status) && <button onClick={() => setSubmission({ kind:'step', id:result.id, title:result.step?.title || 'Étape' })} className="mt-3 flex items-center gap-2 border px-3 py-1.5 text-xs font-bold"><Send size={13}/>Soumettre une preuve</button>}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-9 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <div>
            <h2 className="text-xl font-black" style={{ color: BLUE }}>Catalogue disponible</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {data.catalog.map(pathway => (
                <article key={pathway.id} className="border bg-white p-5">
                  <div className="flex items-start justify-between gap-3"><Award style={{ color: GOLD }}/><span className="border px-2 py-1 text-[11px] uppercase">{pathway.certification_type}</span></div>
                  <h3 className="mt-4 font-black" style={{ color: BLUE }}>{pathway.title}</h3>
                  <p className="mt-2 text-sm text-gray-600">{pathway.description || 'Parcours professionnel Omnia.'}</p>
                  <div className="mt-4 space-y-2 text-xs text-gray-600">
                    <p>{pathway.steps?.length || 0} étape(s) · {pathway.validity_months ? `validité ${pathway.validity_months} mois` : 'sans échéance définie'}</p>
                    <p>{pathway.cpd_enabled ? `${pathway.cpd_credit_value || 0} ${pathway.cpd_credit_unit || 'heures'} CPD` : 'CPD non applicable'}</p>
                  </div>
                  {(pathway.prerequisites || []).length > 0 && <div className="mt-4 border-t pt-3"><p className="text-xs font-bold">Prérequis</p>{pathway.prerequisites.map((item:any)=><div key={item.id} className="mt-2 flex items-center justify-between gap-2 text-xs"><span>{item.title}</span><span className={item.met ? 'text-emerald-700' : 'text-amber-700'}>{item.met ? 'Validé' : 'À compléter'}</span>{!item.met && item.prerequisite_type === 'manual' && <button onClick={() => setSubmission({kind:'prerequisite',id:item.id,title:item.title})} className="border px-2 py-1 font-bold">Soumettre</button>}</div>)}</div>}
                  <button disabled={pathway.enrolled || !pathway.prerequisites_met || busy === pathway.id} onClick={() => run(pathway.id, 'enroll', { pathway_id: pathway.id })} className="mt-5 w-full px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-gray-400" style={!pathway.enrolled && pathway.prerequisites_met ? { background: BLUE } : undefined}>{pathway.enrolled ? 'Déjà inscrit' : pathway.prerequisites_met ? 'Commencer le parcours' : 'Prérequis non remplis'}</button>
                </article>
              ))}
            </div>
          </div>

          <aside className="space-y-6">
            <section className="border bg-white p-5"><h2 className="flex items-center gap-2 font-black" style={{ color: BLUE }}><ShieldCheck size={18}/>Certificats et relevés</h2><div className="mt-4 space-y-3">{data.credentials.length === 0 && <p className="text-sm text-gray-500">Aucun credential de parcours délivré.</p>}{data.credentials.map(item=><div key={item.id} className="border p-3"><p className="font-semibold">{item.title}</p><p className="mt-1 text-xs text-gray-500">{item.credential_type === 'professional_record' ? 'Relevé professionnel' : 'Certificat'} · {statusLabel[item.status] || item.status}</p><p className="mt-1 text-[11px] font-mono">{item.verification_code}</p><a href={`/credentials/pathways/${item.verification_code}`} className="mt-2 inline-block text-xs font-bold" style={{color:BLUE}}>Vérifier le credential</a></div>)}</div></section>
            <section className="border bg-white p-5"><h2 className="flex items-center gap-2 font-black" style={{ color: BLUE }}><Clock3 size={18}/>Renouvellements</h2><div className="mt-4 space-y-3">{data.renewals.length === 0 && <p className="text-sm text-gray-500">Aucun renouvellement à traiter.</p>}{data.renewals.map(item=><div key={item.id} className="border p-3"><p className="font-semibold">{item.enrollment?.pathway?.title || 'Parcours'}</p><p className="text-xs text-gray-500">Échéance : {new Date(item.due_at).toLocaleDateString('fr-FR')} · {statusLabel[item.status] || item.status}</p>{['due','in_progress','rejected'].includes(item.status) && <button onClick={()=>setSubmission({kind:'renewal',id:item.id,title:item.enrollment?.pathway?.title || 'Renouvellement'})} className="mt-3 flex items-center gap-2 border px-3 py-1.5 text-xs font-bold"><FileCheck2 size={13}/>Soumettre le renouvellement</button>}</div>)}</div></section>
          </aside>
        </section>
      </main>

      {submission && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4" onMouseDown={event=>{if(event.target===event.currentTarget)setSubmission(null)}}><form onSubmit={submitEvidence} className="w-full max-w-xl bg-white p-6"><p className="text-xs font-bold uppercase" style={{color:GOLD}}>Soumission</p><h2 className="mt-1 text-xl font-black" style={{color:BLUE}}>{submission.title}</h2><p className="mt-2 text-sm text-gray-600">Décrivez la preuve ou le travail réalisé. Les pièces sensibles ne doivent pas être placées dans ce champ public.</p><textarea required value={note} onChange={event=>setNote(event.target.value)} rows={7} className="mt-4 w-full border p-3" placeholder="Description, référence ou commentaire…"/><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={()=>setSubmission(null)} className="border px-4 py-2">Annuler</button><button disabled={Boolean(busy)} className="px-4 py-2 font-bold text-white" style={{background:BLUE}}>Envoyer</button></div></form></div>}
    </DashboardLayout>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) { return <div className="border bg-white p-5"><span style={{color:GOLD}}>{icon}</span><p className="mt-3 text-3xl font-black" style={{color:BLUE}}>{value}</p><p className="text-sm text-gray-500">{label}</p></div>; }
function Empty({ text }: { text:string }) { return <div className="border bg-white p-8 text-center text-sm text-gray-500">{text}</div>; }
function StepIcon({ status }: { status:string }) { return ['passed','waived'].includes(status) ? <CheckCircle2 size={18} className="text-emerald-700"/> : status === 'submitted' ? <FileCheck2 size={18} className="text-amber-700"/> : <BookOpen size={18} className="text-gray-400"/>; }
