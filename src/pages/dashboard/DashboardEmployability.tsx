import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Briefcase, CheckCircle2, Eye, FileText, RefreshCw, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '../../components/DashboardLayout';
import { employabilityRequest, EmployabilityProfile } from '../../lib/employabilityApi';

const BLUE = '#002050';
const GOLD = '#BF8813';
const split = (value: string) => value.split(',').map(item => item.trim()).filter(Boolean);

export default function DashboardEmployability() {
  const [data, setData] = useState<any>(null);
  const [form, setForm] = useState<EmployabilityProfile | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    setError('');
    try {
      const result = await employabilityRequest<any>('learner_dashboard');
      setData(result); setForm(result.profile);
    } catch (err) { setError(err instanceof Error ? err.message : 'Chargement impossible.'); }
  };
  useEffect(() => { load(); }, []);

  const metrics = useMemo(() => ({
    matches: data?.matches?.filter((item:any)=>!['dismissed','expired'].includes(item.status)).length || 0,
    applications: data?.applications?.length || 0,
    requests: data?.contact_requests?.filter((item:any)=>item.status === 'pending').length || 0,
    skills: data?.sources?.skills?.length || 0,
  }), [data]);

  const save = async () => {
    if (!form) return;
    setBusy('save'); setError(''); setMessage('');
    try {
      const { user_id: _userId, ...profile } = form;
      await employabilityRequest('save_preferences', profile);
      setMessage('Vos consentements et préférences ont été enregistrés.');
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Enregistrement impossible.'); }
    finally { setBusy(''); }
  };

  const run = async (key:string, action:string, payload:Record<string,unknown>={}) => {
    setBusy(key); setError(''); setMessage('');
    try { await employabilityRequest(action, payload); setMessage('Mise à jour effectuée.'); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Opération impossible.'); }
    finally { setBusy(''); }
  };

  if (!form) return <DashboardLayout><div className="p-8 text-sm text-gray-600">{error || 'Chargement de votre espace employabilité…'}</div></DashboardLayout>;
  const toggle = (key:keyof EmployabilityProfile) => <input type="checkbox" checked={Boolean(form[key])} onChange={event=>setForm({...form,[key]:event.target.checked})}/>;

  return <DashboardLayout><main className="mx-auto max-w-7xl p-5 md:p-8">
    <div className="flex flex-wrap items-end justify-between gap-4 border-b pb-6"><div><p className="text-xs font-bold uppercase tracking-[.18em]" style={{color:GOLD}}>Programme 2 · GM5</p><h1 className="mt-2 text-3xl font-black" style={{color:BLUE}}>Employabilité intégrée</h1><p className="mt-2 max-w-3xl text-sm text-gray-600">Contrôlez les preuves utilisées par Omnia Talent et Omnia Career. Aucune candidature, mise en relation ou publication n’est automatique.</p></div><button onClick={save} disabled={busy==='save'} className="px-5 py-3 text-sm font-bold text-white disabled:opacity-60" style={{background:BLUE}}>{busy==='save'?'Enregistrement…':'Enregistrer mes choix'}</button></div>
    {error&&<p className="mt-4 border-l-4 border-red-500 bg-red-50 p-3 text-sm text-red-700">{error}</p>}{message&&<p className="mt-4 border-l-4 border-emerald-600 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}

    <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={<Sparkles/>} label="Correspondances" value={metrics.matches}/><Metric icon={<FileText/>} label="Candidatures" value={metrics.applications}/><Metric icon={<Users/>} label="Demandes de contact" value={metrics.requests}/><Metric icon={<ShieldCheck/>} label="Compétences vérifiées" value={metrics.skills}/></section>

    <section className="grid gap-6 py-7 lg:grid-cols-2">
      <div className="border bg-white p-5"><h2 className="flex items-center gap-2 font-black" style={{color:BLUE}}><ShieldCheck size={19}/>Consentement et visibilité</h2><label className="mt-5 block text-sm font-semibold">État du profil<select value={form.status} onChange={event=>setForm({...form,status:event.target.value as EmployabilityProfile['status']})} className="mt-2 w-full border p-3"><option value="draft">Brouillon</option><option value="active">Actif</option><option value="paused">En pause</option><option value="archived">Archivé</option></select></label><label className="mt-4 block text-sm font-semibold">Visibilité Talent<select value={form.talent_visibility} onChange={event=>setForm({...form,talent_visibility:event.target.value as EmployabilityProfile['talent_visibility']})} disabled={form.status!=='active'} className="mt-2 w-full border p-3 disabled:bg-gray-100"><option value="private">Privé</option><option value="recruiters">Recruteurs validés</option><option value="public">Public</option></select></label><div className="mt-5 space-y-3 text-sm"><label className="flex gap-3">{toggle('allow_recruiter_contact')} Autoriser les recruteurs validés à envoyer une demande de contact</label><label className="flex gap-3">{toggle('allow_opportunity_matching')} Recevoir des recommandations d’opportunités</label></div>{form.status!=='active'&&<p className="mt-4 bg-amber-50 p-3 text-xs text-amber-800">Un profil non actif reste privé et ne reçoit ni matching ni demande de contact.</p>}</div>
      <div className="border bg-white p-5"><h2 className="flex items-center gap-2 font-black" style={{color:BLUE}}><Sparkles size={19}/>Sources autorisées</h2><div className="mt-5 space-y-4 text-sm"><label className="flex gap-3">{toggle('use_project_evidence')} Projets et livrables vérifiés</label><label className="flex gap-3">{toggle('use_skills_passport')} Skills Passport publié</label><label className="flex gap-3">{toggle('use_learning_record')} Learning Record</label><label className="flex gap-3">{toggle('use_career_documents')} Profil et documents Omnia Career autorisés</label></div><div className="mt-5 grid grid-cols-2 gap-3 text-xs text-gray-600"><Source label="Portfolio" ok={Boolean(data?.sources?.portfolio)}/><Source label="Skills Passport" ok={Boolean(data?.sources?.skills_passport)}/><Source label="Learning Record" ok={Boolean(data?.sources?.learning_record)}/><Source label="Career" ok={Boolean(data?.sources?.career)}/></div></div>
    </section>

    <section className="border-y py-6"><h2 className="font-black" style={{color:BLUE}}>Préférences professionnelles</h2><p className="mt-1 text-sm text-gray-500">Utilisées seulement pour expliquer et classer les opportunités.</p><div className="mt-4 grid gap-4 md:grid-cols-2"><TextList placeholder="Métiers ciblés" values={form.target_roles} onChange={values=>setForm({...form,target_roles:values})}/><TextList placeholder="Secteurs ciblés" values={form.target_sectors} onChange={values=>setForm({...form,target_sectors:values})}/><TextList placeholder="Pays ciblés" values={form.target_countries} onChange={values=>setForm({...form,target_countries:values})}/><TextList placeholder="Types de contrat" values={form.contract_preferences} onChange={values=>setForm({...form,contract_preferences:values})}/></div></section>

    <section className="py-7"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 font-black" style={{color:BLUE}}><Briefcase size={19}/>Opportunités recommandées</h2><p className="mt-1 text-sm text-gray-500">Les raisons et compétences correspondantes restent visibles.</p></div><button onClick={()=>run('refresh','refresh_matches')} disabled={busy==='refresh'||!form.allow_opportunity_matching} className="flex items-center gap-2 border px-4 py-2 text-sm font-semibold disabled:opacity-50"><RefreshCw size={16}/>Actualiser</button></div><div className="mt-5 divide-y border-y">{(data?.matches||[]).length===0?<Empty text="Aucune opportunité recommandée pour le moment."/>:(data.matches||[]).map((match:any)=><article key={match.id} className="grid gap-4 py-5 md:grid-cols-[1fr_auto]"><div><h3 className="font-bold" style={{color:BLUE}}>{match.job?.title||'Opportunité'}</h3><p className="mt-1 text-sm text-gray-500">{match.job?.category||'Emploi'} · {match.job?.location||'Lieu non précisé'} · {match.job?.contract_type||'Contrat non précisé'}</p><p className="mt-2 text-sm">{match.explanation}</p><p className="mt-2 text-xs text-gray-500">Correspondances : {(match.matched_skills||[]).join(', ')||'préférences générales'}</p><div className="mt-3 flex gap-2"><button onClick={()=>run(`save-${match.id}`,'set_match_status',{match_id:match.id,status:'saved'})} className="border px-3 py-1.5 text-xs font-bold">Enregistrer</button><button onClick={()=>run(`dismiss-${match.id}`,'set_match_status',{match_id:match.id,status:'dismissed'})} className="border px-3 py-1.5 text-xs">Masquer</button></div></div><div className="text-right"><strong className="text-xl" style={{color:GOLD}}>{Math.round(Number(match.match_score||0))}%</strong><Link to={`/emploi/${match.job_id}`} onClick={()=>run(`view-${match.id}`,'set_match_status',{match_id:match.id,status:'viewed'})} className="mt-3 block text-sm font-bold" style={{color:BLUE}}>Voir l’offre</Link></div></article>)}</div></section>

    <section className="grid gap-6 border-t pt-7 lg:grid-cols-2"><div><h2 className="font-black" style={{color:BLUE}}>Mes candidatures</h2><div className="mt-4 divide-y border-y">{(data?.applications||[]).length===0?<Empty text="Aucune candidature liée à votre compte."/>:(data.applications||[]).map((item:any)=><div key={item.id} className="flex items-center justify-between gap-3 py-4"><div><p className="font-semibold">{item.job?.title||'Offre'}</p><p className="text-xs text-gray-500">{item.job?.location||''} · déposée le {new Date(item.submitted_at).toLocaleDateString('fr-FR')}</p></div><span className="border px-2 py-1 text-xs">{item.status}</span></div>)}</div></div><div><h2 className="font-black" style={{color:BLUE}}>Demandes de contact</h2><div className="mt-4 divide-y border-y">{(data?.contact_requests||[]).length===0?<Empty text="Aucune demande de contact."/>:(data.contact_requests||[]).map((item:any)=><div key={item.id} className="py-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{item.subject||'Demande de contact'}</p><p className="text-xs text-gray-500">{item.recruiter?.full_name||item.recruiter?.email||'Recruteur validé'} · {new Date(item.requested_at).toLocaleDateString('fr-FR')}</p></div><span className="border px-2 py-1 text-xs">{item.status}</span></div><p className="mt-2 text-sm text-gray-600">{item.message}</p>{item.status==='pending'&&<div className="mt-3 flex gap-2"><button onClick={()=>run(`accept-${item.id}`,'respond_contact',{id:item.id,status:'accepted',response:'Demande acceptée depuis mon espace Omnia.'})} className="px-3 py-1.5 text-xs font-bold text-white" style={{background:'#087A55'}}>Accepter</button><button onClick={()=>run(`decline-${item.id}`,'respond_contact',{id:item.id,status:'declined',response:'Demande refusée depuis mon espace Omnia.'})} className="border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700">Refuser</button></div>}</div>)}</div></div></section>

    <div className="mt-7 grid gap-3 border-t pt-5 text-sm text-gray-600 md:grid-cols-3"><p className="flex gap-2"><Eye size={17}/>Vous pouvez suspendre votre visibilité à tout moment.</p><p className="flex gap-2"><Users size={17}/>Seuls les recruteurs autorisés accèdent aux profils réservés.</p><p className="flex gap-2"><CheckCircle2 size={17}/>Les compétences restent rattachées à leurs preuves.</p></div>
  </main></DashboardLayout>;
}

function Metric({icon,label,value}:{icon:ReactNode;label:string;value:number}){return <div className="border bg-white p-5"><span style={{color:GOLD}}>{icon}</span><p className="mt-3 text-3xl font-black" style={{color:BLUE}}>{value}</p><p className="text-sm text-gray-500">{label}</p></div>}
function Source({label,ok}:{label:string;ok:boolean}){return <p>{label} : <strong className={ok?'text-emerald-700':'text-gray-500'}>{ok?'disponible':'absent ou non publié'}</strong></p>}
function TextList({placeholder,values,onChange}:{placeholder:string;values:string[];onChange:(values:string[])=>void}){return <input className="border p-3" placeholder={`${placeholder}, séparés par des virgules`} value={values.join(', ')} onChange={event=>onChange(split(event.target.value))}/>}
function Empty({text}:{text:string}){return <p className="py-7 text-center text-sm text-gray-500">{text}</p>}
