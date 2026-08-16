import { getSessionToken } from '../../lib/session';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award, Briefcase, CalendarDays, Camera, ChevronDown, ChevronRight, Clock, Download,
  Eye, FileText, Mail, MessageSquare, Mic, Paperclip, Play, Search, Sparkles, Target,
  Upload, UserCheck, UserRound, Video, X
} from 'lucide-react';
import TemplateLiveCard from './TemplateLiveCard';
import type { CareerTemplateMeta } from '../../lib/careerStudioData';
import { edgeAuthHeaders } from '../../lib/edgeAuth';
import { dashboardGreeting } from '../../lib/dashboardGreeting';
import { isNativeApp, saveOrShareText } from '../../lib/mobile';
import {
  createCareerManualApplication,
  listCareerApplications,
  updateCareerApplicationStatus,
  type CareerTrackedApplication,
} from '../../lib/careerStudioApi';

const BLUE = '#002050';
const GOLD = '#bf8813';
const BORDER = '#E4E7EC';
const MUTED = '#6B7280';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

type Doc = { id:string; title:string; doc_type:'cv'|'lm'; status?:string; updated_at?:string; created_at?:string };
type Template = CareerTemplateMeta & { template_key:string; name_fr:string };
type User = Record<string, any> | null;

function Card({children,className=''}:{children:React.ReactNode;className?:string}){
  return <div className={`rounded-2xl border bg-white shadow-sm ${className}`} style={{borderColor:BORDER}}>{children}</div>;
}
function Empty({text}:{text:string}){return <div className="rounded-2xl border border-dashed p-8 text-center text-sm" style={{borderColor:BORDER,color:MUTED}}>{text}</div>}
function Stat({label,value,icon:Icon,onClick}:{label:string;value:string|number;icon:any;onClick?:()=>void}){
  return <button onClick={onClick} className="rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" style={{borderColor:BORDER}}><div className="flex items-center justify-between"><div><div className="text-sm" style={{color:MUTED}}>{label}</div><div className="mt-1 text-3xl font-semibold" style={{color:BLUE}}>{value}</div></div><div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{background:'rgba(0,32,80,.08)'}}><Icon size={20} color={BLUE}/></div></div></button>;
}
function readJson<T>(key:string,fallback:T):T{try{return JSON.parse(localStorage.getItem(key)||'') as T}catch{return fallback}}
function saveJson(key:string,value:any){localStorage.setItem(key,JSON.stringify(value))}
function token(){return getSessionToken()||''}
async function callAi(text:string){
  if(!SUPABASE_URL||!token()) throw new Error('IA indisponible');
  const response=await fetch(`${SUPABASE_URL}/functions/v1/career-studio-manage?action=ai`,{method:'POST',headers:edgeAuthHeaders(),body:JSON.stringify({action:'make_professional',text})});
  const data=await response.json(); if(!response.ok) throw new Error(data?.error||'IA indisponible'); return data.result||data.text||'';
}

export function EnhancedDashboard({displayName,loading,cvDocs,lmDocs,cvTemplates,lmTemplates,onView,onCreate,onOpen,previewMode=false}:{
  displayName:string;loading:boolean;cvDocs:Doc[];lmDocs:Doc[];cvTemplates:Template[];lmTemplates:Template[];
  onView:(view:string)=>void;onCreate:(type:'cv'|'lm',key?:string)=>void;onOpen:(id?:string,type?:'cv'|'lm')=>void;previewMode?:boolean;
}){
  const [trackedApplications,setTrackedApplications]=useState<CareerTrackedApplication[]>([]);
  useEffect(()=>{
    let active=true;
    if(previewMode){ setTrackedApplications([]); return () => { active=false; }; }
    void listCareerApplications().then(result=>{ if(active) setTrackedApplications(result.applications||[]); }).catch(()=>{});
    return () => { active=false; };
  },[previewMode]);
  const completedCv=cvDocs.filter(d=>d.status==='completed');
  const completedLm=lmDocs.filter(d=>d.status==='completed');
  const localApplications=readJson<any[]>('omnia_manual_applications',[]);
  const applications=trackedApplications.length?trackedApplications:localApplications;
  const allDocs=[...cvDocs,...lmDocs];
  const recent=[...allDocs].sort((a,b)=>new Date(b.updated_at||b.created_at||0).getTime()-new Date(a.updated_at||a.created_at||0).getTime()).slice(0,5);
  const documentProgress=allDocs.length?Math.round((completedCv.length+completedLm.length)/allDocs.length*100):0;
  const firstName=(displayName||'').split(' ')[0]||displayName;
  const nextAction = cvDocs.length===0
    ? {label:'Créer votre premier CV',text:'Commencez par poser une base professionnelle claire avant de décliner vos candidatures.',action:()=>onCreate('cv'),icon:FileText}
    : lmDocs.length===0
      ? {label:'Préparer une lettre de motivation',text:'Votre CV existe déjà. Ajoutez maintenant un message ciblé pour vos prochaines opportunités.',action:()=>onCreate('lm'),icon:Mail}
      : applications.length===0
        ? {label:'Structurer votre première candidature',text:'Vos documents sont prêts : passez au suivi d’une opportunité réelle.',action:()=>onView('applications'),icon:Briefcase}
        : {label:'Préparer le prochain entretien',text:'Gardez votre discours aligné avec vos documents et les postes suivis.',action:()=>onView('interview'),icon:MessageSquare};
  const NextIcon=nextAction.icon;
  const journey=[
    {label:'Positionnement',done:cvDocs.length>0,detail:cvDocs.length?`${cvDocs.length} CV`:'À construire'},
    {label:'Documents',done:cvDocs.length>0&&lmDocs.length>0,detail:`${allDocs.length} document${allDocs.length>1?'s':''}`},
    {label:'Candidatures',done:applications.length>0,detail:`${applications.length} suivie${applications.length>1?'s':''}`},
    {label:'Entretien',done:false,detail:'Préparation continue'},
  ];

  return <div className="mx-auto max-w-[1220px] space-y-8 pb-10">
    <section className="relative overflow-hidden rounded-[30px] bg-[#061A32] text-white shadow-[0_24px_60px_rgba(0,32,80,.18)]">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true"><div className="absolute -right-24 -top-24 h-72 w-72 rounded-full border border-white/10"/><div className="absolute right-12 top-10 h-44 w-44 rounded-full border border-[#3E63B8]/25"/><div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-[#3E63B8]/45 to-transparent"/></div>
      <div className="relative grid gap-8 p-6 md:p-8 lg:grid-cols-[1.08fr_.92fr] lg:p-10">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#AFC3FF]">Studio personnel · Omnia Career</p>
          <h1 className="mt-4 max-w-3xl text-3xl font-black leading-[1.05] tracking-[-0.035em] md:text-5xl">{firstName ? `${firstName}, ` : ''}faites avancer votre candidature comme un projet professionnel.</h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-white/65 md:text-base">Vos documents, vos candidatures et votre préparation restent reliés. L’accueil met en avant la prochaine action utile plutôt qu’une série de statistiques.</p>
          <div className="mt-7 flex flex-wrap gap-3"><button onClick={nextAction.action} className="inline-flex items-center gap-2 rounded-xl bg-[#3E63B8] px-4 py-2.5 text-sm font-black text-[#061A32]"><NextIcon size={17}/>{nextAction.label}</button><button onClick={()=>onView('applications')} className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-black text-white">Voir mes candidatures <ChevronRight size={16}/></button></div>
        </div>
        <div className="relative min-h-[270px]">
          <div className="absolute inset-x-10 bottom-3 top-8 rotate-[-5deg] rounded-[24px] border border-white/10 bg-white/5"/>
          <div className="absolute inset-x-4 bottom-6 top-4 rotate-[3deg] rounded-[24px] border border-[#AFC3FF]/20 bg-[#0E2A4B]"/>
          <div className="absolute inset-0 rounded-[26px] border border-white/10 bg-[#FCFBF8] p-5 text-[#002050] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E3DED5] pb-4"><div><p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#9A7118]">Dossier Career</p><p className="mt-1 text-lg font-black">État de préparation</p></div><Target size={22}/></div>
            <div className="mt-5 grid grid-cols-3 divide-x divide-[#E3DED5] border-y border-[#E3DED5] py-4 text-center"><div><strong className="block text-2xl">{loading?'…':allDocs.length}</strong><span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Documents</span></div><div><strong className="block text-2xl">{applications.length}</strong><span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Candidatures</span></div><div><strong className="block text-2xl">{documentProgress}%</strong><span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Finalisés</span></div></div>
            <div className="mt-5"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Prochaine meilleure action</p><p className="mt-2 text-sm font-black">{nextAction.label}</p><p className="mt-1 text-xs leading-5 text-slate-500">{nextAction.text}</p></div>
          </div>
        </div>
      </div>
    </section>

    <section className="bg-white">
      <div className="flex items-end justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#3E63B8]">Fil de progression</p><h2 className="mt-2 text-2xl font-black tracking-[-0.025em] text-[#002050]">Votre parcours carrière</h2></div><span className="hidden text-xs font-semibold text-slate-400 md:block">Les étapes évoluent avec votre activité.</span></div>
      <div className="mt-5 grid border-y border-[#DDD7CB] md:grid-cols-4">{journey.map((item,index)=><div key={item.label} className={`relative px-5 py-5 ${index?'border-t border-[#DDD7CB] md:border-l md:border-t-0':''}`}><div className="flex items-center justify-between"><span className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-black ${item.done?'bg-[#002050] text-white':'bg-[#EEEAE2] text-slate-500'}`}>0{index+1}</span>{item.done&&<span className="text-[10px] font-black uppercase tracking-wide text-[#7A9A86]">En place</span>}</div><strong className="mt-4 block text-sm text-[#002050]">{item.label}</strong><span className="mt-1 block text-xs text-slate-500">{item.detail}</span></div>)}</div>
    </section>

    <div className="grid gap-7 lg:grid-cols-[1.28fr_.72fr]">
      <section>
        <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#3E63B8]">Votre matière de travail</p><h2 className="mt-2 text-xl font-black text-[#002050]">Documents récents</h2></div><button onClick={()=>onView('cv')} className="text-xs font-black text-[#002050]">Tous les documents</button></div>
        <div className="mt-4 divide-y divide-[#E3DED5] border-y border-[#D8D2C7] bg-white">{recent.length?recent.map(doc=><button key={doc.id} onClick={()=>onOpen(doc.id,doc.doc_type)} className="group grid w-full gap-3 px-4 py-4 text-left transition hover:bg-[#F5F7FD] md:grid-cols-[42px_1fr_auto] md:items-center"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F1EEE7] text-[#002050]">{doc.doc_type==='cv'?<FileText size={17}/>:<Mail size={17}/>}</span><span><strong className="block text-sm text-[#002050]">{doc.title}</strong><span className="mt-1 block text-xs text-slate-400">Mis à jour {new Date(doc.updated_at||doc.created_at||Date.now()).toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}</span></span><ChevronRight size={16} className="text-[#3E63B8] transition group-hover:translate-x-1"/></button>):<div className="px-5 py-8 text-sm leading-6 text-slate-500">Vos CV et lettres apparaîtront ici dès leur création. Commencez avec un document réel plutôt qu’un exemple fictif.</div>}</div>
      </section>

      <aside className="space-y-5">
        <div className="border-l-4 border-[#3E63B8] bg-[#FCFBF8] p-5"><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#9A7118]"><Sparkles size={14}/> Action recommandée</div><h3 className="mt-3 text-lg font-black text-[#002050]">{nextAction.label}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{nextAction.text}</p><button onClick={nextAction.action} className="mt-4 inline-flex items-center gap-1 text-xs font-black text-[#002050]">Continuer <ChevronRight size={14}/></button></div>
        <div className="border-y border-[#D8D2C7] bg-white px-5 py-5"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Ressources disponibles</p><div className="mt-4 space-y-3"><button onClick={()=>onCreate('cv')} className="flex w-full items-center justify-between text-left text-sm font-bold text-[#002050]"><span>Modèles CV</span><span className="text-xs text-slate-400">{cvTemplates.length||12}</span></button><button onClick={()=>onCreate('lm')} className="flex w-full items-center justify-between text-left text-sm font-bold text-[#002050]"><span>Modèles LM</span><span className="text-xs text-slate-400">{lmTemplates.length||6}</span></button><button onClick={()=>onView('interview')} className="flex w-full items-center justify-between text-left text-sm font-bold text-[#002050]"><span>Préparation entretien</span><ChevronRight size={14} className="text-slate-400"/></button></div></div>
      </aside>
    </div>
  </div>;
}


export function EnhancedApplications({navigate}:{navigate:(path:string)=>void}){
  const [query,setQuery]=useState('');
  const [status,setStatus]=useState('all');
  const [contract,setContract]=useState('all');
  const [location,setLocation]=useState('');
  const [apps,setApps]=useState<CareerTrackedApplication[]>(()=>readJson('omnia_manual_applications',[]));
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [formOpen,setFormOpen]=useState(false);
  const [message,setMessage]=useState('');
  const [form,setForm]=useState({
    company_name:'',
    job_title:'',
    location:'',
    contract_type:'',
    job_url:'',
    status:'draft',
    notes:'',
  });

  useEffect(()=>{
    let active=true;
    listCareerApplications()
      .then(({applications})=>{if(active)setApps(applications)})
      .catch(()=>{if(active)setMessage('Le suivi distant est momentanément indisponible. Les données locales restent affichées.')})
      .finally(()=>{if(active)setLoading(false)});
    return()=>{active=false};
  },[]);

  const filtered=apps.filter(a=>{
    const hay=`${a.company_name||''} ${a.job_title||''}`.toLowerCase();
    const currentStatus=a.tracking_status||a.status||'draft';
    const currentContract=a.contract_type||'';
    const currentLocation=a.location||'';
    return hay.includes(query.toLowerCase())
      &&(status==='all'||currentStatus===status)
      &&(contract==='all'||currentContract===contract)
      &&currentLocation.toLowerCase().includes(location.toLowerCase());
  });

  async function createApplication(){
    if(!form.company_name.trim()||!form.job_title.trim()){
      setMessage("L'entreprise et le poste sont obligatoires.");
      return;
    }
    setSaving(true);
    setMessage('');
    try{
      const {application,remote}=await createCareerManualApplication({
        ...form,
        company_name:form.company_name.trim(),
        job_title:form.job_title.trim(),
      });
      setApps(current=>[application,...current.filter(item=>item.id!==application.id)]);
      setForm({company_name:'',job_title:'',location:'',contract_type:'',job_url:'',status:'draft',notes:''});
      setFormOpen(false);
      setMessage(remote?'Candidature enregistrée.':'Candidature sauvegardée localement. Elle sera synchronisée lorsque le service sera disponible.');
    }catch{
      setMessage("Impossible d'enregistrer la candidature.");
    }finally{
      setSaving(false);
    }
  }

  async function changeStatus(id:string,nextStatus:string){
    setMessage('');
    try{
      const {application,remote}=await updateCareerApplicationStatus(id,nextStatus);
      setApps(current=>current.map(item=>item.id===id?application:item));
      if(!remote)setMessage('Statut sauvegardé localement en attendant la synchronisation.');
    }catch{
      setMessage('Impossible de modifier ce statut.');
    }
  }

  const statusLabels:Record<string,string>={
    draft:'Brouillon',
    prepared:'Préparée',
    applied:'Envoyée',
    interview:'Entretien',
    offer:'Offre',
    rejected:'Refus',
    withdrawn:'Retirée',
    closed:'Clôturée',
  };

  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold" style={{color:BLUE}}>Suivi candidatures</h1>
        <p className="mt-1 text-sm" style={{color:MUTED}}>Centralisez les candidatures Omnia et celles envoyées sur des sites externes.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={()=>navigate('/talent')} className="rounded-xl border px-4 py-2.5 text-sm font-semibold" style={{borderColor:BORDER,color:BLUE}}>Explorer Omnia Talent</button>
        <button onClick={()=>setFormOpen(value=>!value)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{background:BLUE}}>{formOpen?'Fermer':'Ajouter une candidature'}</button>
      </div>
    </div>

    {message&&<div className="rounded-xl border px-4 py-3 text-sm" style={{borderColor:BORDER,color:BLUE,background:'rgba(0,32,80,.04)'}}>{message}</div>}

    {formOpen&&<Card className="p-5">
      <h2 className="font-semibold" style={{color:BLUE}}>Nouvelle candidature externe</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <input value={form.company_name} onChange={e=>setForm({...form,company_name:e.target.value})} className="h-11 rounded-xl border px-3 text-sm" style={{borderColor:BORDER}} placeholder="Entreprise *"/>
        <input value={form.job_title} onChange={e=>setForm({...form,job_title:e.target.value})} className="h-11 rounded-xl border px-3 text-sm" style={{borderColor:BORDER}} placeholder="Poste *"/>
        <input value={form.location} onChange={e=>setForm({...form,location:e.target.value})} className="h-11 rounded-xl border px-3 text-sm" style={{borderColor:BORDER}} placeholder="Lieu"/>
        <select value={form.contract_type} onChange={e=>setForm({...form,contract_type:e.target.value})} className="h-11 rounded-xl border px-3 text-sm" style={{borderColor:BORDER}}>
          <option value="">Type de contrat</option><option value="CDI">CDI</option><option value="CDD">CDD</option><option value="Stage">Stage</option><option value="Alternance">Alternance</option><option value="Freelance">Freelance</option>
        </select>
        <input value={form.job_url} onChange={e=>setForm({...form,job_url:e.target.value})} className="h-11 rounded-xl border px-3 text-sm md:col-span-2" style={{borderColor:BORDER}} placeholder="Lien de l'offre"/>
        <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})} className="h-11 rounded-xl border px-3 text-sm" style={{borderColor:BORDER}}>
          {Object.entries(statusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}
        </select>
        <input value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} className="h-11 rounded-xl border px-3 text-sm" style={{borderColor:BORDER}} placeholder="Note personnelle"/>
      </div>
      <button disabled={saving} onClick={createApplication} className="mt-4 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{background:BLUE}}>{saving?'Enregistrement…':'Enregistrer la candidature'}</button>
    </Card>}

    <Card className="p-4">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="flex h-11 items-center rounded-xl border px-3" style={{borderColor:BORDER}}><Search size={16} color={MUTED}/><input value={query} onChange={e=>setQuery(e.target.value)} className="ml-2 w-full border-0 text-sm outline-none" placeholder="Rechercher une candidature…"/></div>
        <select value={status} onChange={e=>setStatus(e.target.value)} className="rounded-xl border px-3 text-sm" style={{borderColor:BORDER}}><option value="all">Tous les statuts</option>{Object.entries(statusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
        <select value={contract} onChange={e=>setContract(e.target.value)} className="rounded-xl border px-3 text-sm" style={{borderColor:BORDER}}><option value="all">Tous les contrats</option><option value="CDI">CDI</option><option value="CDD">CDD</option><option value="Stage">Stage</option><option value="Alternance">Alternance</option><option value="Freelance">Freelance</option></select>
        <input value={location} onChange={e=>setLocation(e.target.value)} className="rounded-xl border px-3 text-sm" style={{borderColor:BORDER}} placeholder="Lieu"/>
      </div>
    </Card>

    {loading?<Empty text="Chargement des candidatures…"/>:filtered.length?<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map(a=>{
      const currentStatus=a.tracking_status||a.status||'draft';
      return <Card key={a.id} className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-semibold" style={{color:BLUE}}>{a.job_title||'Poste non renseigné'}</div>
            <div className="mt-1 text-sm" style={{color:MUTED}}>{a.company_name||'Entreprise non renseignée'}</div>
          </div>
          <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{background:a.source==='platform'?'rgba(191,136,19,.12)':'rgba(0,32,80,.08)',color:a.source==='platform'?GOLD:BLUE}}>{a.source==='platform'?'Omnia':'Externe'}</span>
        </div>
        <div className="mt-3 space-y-1 text-xs" style={{color:MUTED}}>
          {a.location&&<div>{a.location}</div>}
          {a.contract_type&&<div>{a.contract_type}</div>}
        </div>
        <label className="mt-4 block text-xs font-semibold" style={{color:BLUE}}>Statut
          <select value={currentStatus} onChange={e=>changeStatus(a.id,e.target.value)} className="mt-1 h-10 w-full rounded-xl border px-3 text-sm" style={{borderColor:BORDER}}>
            {Object.entries(statusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        {a.job_url&&<a href={a.job_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs font-semibold" style={{color:GOLD}}>Ouvrir l'offre</a>}
      </Card>;
    })}</div>:<Empty text="Aucune candidature ne correspond à vos filtres."/>}
  </div>;
}


const skillOptions=['Communication','Gestion de projet','Analyse de données','Excel','Leadership','Travail en équipe','Résolution de problèmes','Organisation','Rédaction','Négociation','Qualité','Sécurité','Environnement','Marketing','Développement web','Cybersécurité'];
const sectors=['Technologie','Finance / Banque','QHSE','Santé','Éducation','Hôtellerie','Commerce','Industrie','Administration','Communication','Développement durable','Transport / Logistique'];
export function EnhancedProfile({displayName}:{displayName:string}){
  const user=readJson<any>('omnia_user',{}); const stored=readJson<any>('omnia_career_profile',{});
  const initial={full_name:user.full_name||user.name||displayName,email:user.email||'',phone:user.phone_number||user.phone||'',profession:user.profession||'',linkedin:user.linkedin||'',summary:'',skills:[],sectors:[],languages:[],certifications:[],documents:[],visible:false,...stored};
  const [p,setP]=useState<any>(initial);const [editing,setEditing]=useState(false);const [summaryEditing,setSummaryEditing]=useState(false);const [docName,setDocName]=useState('');const fileRef=useRef<HTMLInputElement|null>(null);
  function persist(next=p){saveJson('omnia_career_profile',next);const nextUser={...user,full_name:next.full_name,email:next.email,phone_number:next.phone,profession:next.profession,linkedin:next.linkedin};saveJson('omnia_user',nextUser);setP(next)}
  function addDoc(file:File){if(!docName.trim())return;const reader=new FileReader();reader.onload=()=>{const next={...p,documents:[...p.documents,{name:docName.trim(),original_name:file.name,data_url:reader.result,added_at:new Date().toISOString()}]};setDocName('');persist(next)};reader.readAsDataURL(file)}
  async function exportProfile(){await saveOrShareText(JSON.stringify(p,null,2),{fileName:'profil-carriere.json',mimeType:'application/json',title:'Profil carrière Omnia'});}
  return <div className="space-y-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold" style={{color:BLUE}}>Profil carrière</h1><p className="mt-1 text-sm" style={{color:MUTED}}>Gérez votre profil professionnel et vos documents.</p></div><div className="flex flex-wrap gap-2"><button onClick={()=>void exportProfile()} className="rounded-xl border px-4 py-2.5 text-sm font-semibold" style={{borderColor:BORDER,color:BLUE}}><Download className="mr-2 inline h-4 w-4"/>{isNativeApp()?'Enregistrer ou partager le profil':'Exporter le profil'}</button><button onClick={()=>{const next={...p,visible:!p.visible};persist(next)}} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold" style={{borderColor:p.visible?'#22c55e':'#ef4444',color:p.visible?'#15803d':'#b91c1c',background:p.visible?'#f0fdf4':'#fef2f2'}}><span className={`h-2.5 w-2.5 rounded-full ${p.visible?'bg-green-500':'bg-red-500'}`}/>{p.visible?'Visible':'Privé'}</button><button onClick={()=>{if(editing)persist();setEditing(!editing)}} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{background:BLUE}}>{editing?'Enregistrer le profil':'Modifier mon profil'}</button></div></div>
  <div className="grid gap-5 xl:grid-cols-2"><EditableProfileCard title="Profil professionnel"><div className="grid gap-3 md:grid-cols-2">{[['Nom complet','full_name'],['Adresse e-mail','email'],['Numéro','phone'],['Profession','profession'],['LinkedIn','linkedin']].map(([label,key])=><label key={key} className="text-xs font-semibold" style={{color:MUTED}}>{label}<input disabled={!editing} value={p[key]||''} onChange={e=>setP({...p,[key]:e.target.value})} className="mt-1 h-10 w-full rounded-xl border px-3 text-sm disabled:bg-slate-50" style={{borderColor:BORDER}}/></label>)}</div></EditableProfileCard>
  <EditableProfileCard title="Résumé professionnel"><textarea disabled={!summaryEditing&&!editing} value={p.summary||''} onChange={e=>setP({...p,summary:e.target.value})} className="min-h-28 w-full rounded-xl border p-3 text-sm disabled:bg-slate-50" style={{borderColor:BORDER}} placeholder="Présentez votre parcours, vos forces et votre objectif…"/><div className="mt-3 flex gap-2">{!summaryEditing&&!editing?<button onClick={()=>setSummaryEditing(true)} className="rounded-xl border px-3 py-2 text-sm font-semibold" style={{borderColor:BORDER,color:BLUE}}>Modifier</button>:<button onClick={()=>{persist();setSummaryEditing(false)}} className="rounded-xl px-3 py-2 text-sm font-semibold text-white" style={{background:BLUE}}>Enregistrer</button>}</div></EditableProfileCard>
  <SelectableCard title="Compétences" editing={editing} options={skillOptions} selected={p.skills} onChange={(skills)=>setP({...p,skills})}/><SelectableCard title="Préférences de secteur" editing={editing} options={sectors} selected={p.sectors} onChange={(sectors)=>setP({...p,sectors})}/><ListEditor title="Langues" editing={editing} values={p.languages} onChange={(languages)=>setP({...p,languages})} placeholder="Ex. Anglais — B2"/><ListEditor title="Certifications" editing={editing} values={p.certifications} onChange={(certifications)=>setP({...p,certifications})} placeholder="Ex. ISO 9001 Lead Auditor"/><EditableProfileCard title="Portfolio et documents"><div className="flex flex-wrap gap-2"><input value={docName} onChange={e=>setDocName(e.target.value)} placeholder="Nom du document" className="h-10 flex-1 rounded-xl border px-3 text-sm" style={{borderColor:BORDER}}/><button disabled={!docName.trim()} onClick={()=>fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-40" style={{borderColor:BORDER,color:BLUE}}><Upload size={16}/>Choisir le fichier</button></div><input ref={fileRef} type="file" className="hidden" onChange={e=>e.target.files?.[0]&&addDoc(e.target.files[0])}/><div className="mt-3 space-y-2">{p.documents.length?p.documents.map((d:any,i:number)=><div key={`${d.name}-${i}`} className="flex items-center gap-2 rounded-xl border p-3 text-sm" style={{borderColor:BORDER}}><Paperclip size={15}/><span className="flex-1 truncate">{d.name}</span></div>):<p className="text-sm" style={{color:MUTED}}>Aucun document ajouté.</p>}</div></EditableProfileCard></div></div>;
}
function EditableProfileCard({title,children}:{title:string;children:React.ReactNode}){return <Card className="p-5"><h2 className="mb-4 font-semibold" style={{color:BLUE}}>{title}</h2>{children}</Card>}
function SelectableCard({title,editing,options,selected,onChange}:{title:string;editing:boolean;options:string[];selected:string[];onChange:(v:string[])=>void}){const shown=editing?options:selected;return <EditableProfileCard title={title}>{shown.length?<div className="flex flex-wrap gap-2">{shown.map(o=><button disabled={!editing} key={o} onClick={()=>onChange(selected.includes(o)?selected.filter(x=>x!==o):[...selected,o])} className="rounded-full border px-3 py-1.5 text-xs font-semibold disabled:cursor-default" style={{borderColor:selected.includes(o)?BLUE:BORDER,background:selected.includes(o)?'rgba(0,32,80,.08)':'#fff',color:BLUE}}>{o}</button>)}</div>:<p className="text-sm" style={{color:MUTED}}>Aucune sélection.</p>}</EditableProfileCard>}
function ListEditor({title,editing,values,onChange,placeholder}:{title:string;editing:boolean;values:string[];onChange:(v:string[])=>void;placeholder:string}){const [value,setValue]=useState('');return <EditableProfileCard title={title}>{editing&&<div className="flex gap-2"><input value={value} onChange={e=>setValue(e.target.value)} placeholder={placeholder} className="h-10 flex-1 rounded-xl border px-3 text-sm" style={{borderColor:BORDER}}/><button onClick={()=>{if(value.trim()){onChange([...values,value.trim()]);setValue('')}}} className="rounded-xl px-3 text-sm font-semibold text-white" style={{background:BLUE}}>Ajouter</button></div>}<div className={`${editing?'mt-3':''} flex flex-wrap gap-2`}>{values.length?values.map(v=><button disabled={!editing} key={v} onClick={()=>onChange(values.filter(x=>x!==v))} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs">{v}{editing?' ×':''}</button>):<span className="text-sm" style={{color:MUTED}}>Aucune information.</span>}</div></EditableProfileCard>}

export function EnhancedCoaching(){const [question,setQuestion]=useState('');const [answer,setAnswer]=useState('');const [loading,setLoading]=useState(false);const [topic,setTopic]=useState('');const [date,setDate]=useState('');async function ask(){setLoading(true);setAnswer('');try{setAnswer(await callAi(`Réponds comme coach carrière à cette question, sans inventer d'informations personnelles : ${question}`))}catch{setAnswer('Le service IA n’est pas disponible pour le moment.')}finally{setLoading(false)}}return <div className="space-y-5"><div><h1 className="text-2xl font-semibold" style={{color:BLUE}}>Coaching carrière</h1><p className="mt-1 text-sm" style={{color:MUTED}}>Posez une question à l’IA ou réservez un accompagnement humain.</p></div><div className="grid gap-5 xl:grid-cols-2"><Card className="p-6"><div className="flex items-center gap-2"><Sparkles color={GOLD}/><h2 className="font-semibold" style={{color:BLUE}}>Coaching IA</h2></div><textarea value={question} onChange={e=>setQuestion(e.target.value)} className="mt-4 min-h-36 w-full rounded-xl border p-3 text-sm" style={{borderColor:BORDER}} placeholder="Posez votre question…"/><button onClick={ask} disabled={!question.trim()||loading} className="mt-3 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40" style={{background:BLUE}}>{loading?'Analyse…':'Poser ma question'}</button>{answer&&<div className="mt-4 whitespace-pre-wrap rounded-xl border p-4 text-sm leading-6" style={{borderColor:BORDER}}>{answer}</div>}</Card><Card className="p-6"><div className="flex items-center gap-2"><UserCheck color={GOLD}/><h2 className="font-semibold" style={{color:BLUE}}>Coaching humain</h2></div><input value={topic} onChange={e=>setTopic(e.target.value)} className="mt-4 h-11 w-full rounded-xl border px-3 text-sm" style={{borderColor:BORDER}} placeholder="Sujet du rendez-vous"/><input value={date} onChange={e=>setDate(e.target.value)} type="datetime-local" className="mt-3 h-11 w-full rounded-xl border px-3 text-sm" style={{borderColor:BORDER}}/><button disabled={!topic||!date} onClick={()=>saveJson('omnia_coaching_request',{topic,date,status:'requested'})} className="mt-3 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-[#002050] disabled:opacity-40" style={{background:GOLD}}><CalendarDays size={17}/>Demander un rendez-vous</button><p className="mt-3 text-xs" style={{color:MUTED}}>La confirmation dépendra des disponibilités du coach dédié.</p></Card></div></div>}

export function EnhancedSettings({tokens,user}:{tokens:number;user:User}){
  const initial=readJson<any>('omnia_career_settings',{profile_visibility:'private',documents_visibility:'private',notifications:{jobs:true,interviews:true,profile_visits:true,news:true}});
  const [s,setS]=useState(initial);
  function save(){saveJson('omnia_career_settings',s)}
  return <div className="space-y-5"><div><h1 className="text-2xl font-semibold" style={{color:BLUE}}>Paramètres</h1><p className="mt-1 text-sm" style={{color:MUTED}}>Gérez vos préférences, votre compte et la confidentialité de vos données.</p></div><div className="grid gap-5 xl:grid-cols-2"><Card className="p-5"><h2 className="font-semibold" style={{color:BLUE}}>Compte</h2><div className="mt-4 grid gap-3 md:grid-cols-2"><Readonly label="Nom complet" value={user?.full_name||user?.name||''}/><Readonly label="Adresse e-mail" value={user?.email||''}/><Readonly label="Numéro" value={user?.phone_number||user?.phone||''}/></div></Card><Card className="p-5"><h2 className="font-semibold" style={{color:BLUE}}>Confidentialité</h2><label className="mt-4 block text-sm font-medium" style={{color:BLUE}}>Visibilité de mon profil<select value={s.profile_visibility} onChange={e=>setS({...s,profile_visibility:e.target.value})} className="mt-1 h-11 w-full rounded-xl border px-3" style={{borderColor:BORDER}}><option value="public">Tout le monde</option><option value="recruiters">Recruteurs</option><option value="private">Personne</option></select></label><label className="mt-3 block text-sm font-medium" style={{color:BLUE}}>Visibilité CV et LM<select value={s.documents_visibility} onChange={e=>setS({...s,documents_visibility:e.target.value})} className="mt-1 h-11 w-full rounded-xl border px-3" style={{borderColor:BORDER}}><option value="public">Tout le monde</option><option value="recruiters">Recruteurs</option><option value="private">Personne</option></select></label></Card><Card className="p-5"><h2 className="font-semibold" style={{color:BLUE}}>Notifications</h2><div className="mt-4 space-y-4">{[['jobs','Nouvelles opportunités d’emploi'],['interviews','Rappels d’entretien et préparation'],['profile_visits','Profil visité'],['news','Actualités et offres Omnia']].map(([key,label])=><label key={key} className="flex items-center justify-between text-sm" style={{color:BLUE}}><span>{label}</span><input type="checkbox" checked={!!s.notifications[key]} onChange={e=>setS({...s,notifications:{...s.notifications,[key]:e.target.checked}})}/></label>)}</div></Card><Card className="p-5"><h2 className="font-semibold" style={{color:BLUE}}>Téléchargements</h2><div className="mt-4 text-3xl font-semibold" style={{color:BLUE}}>{tokens}</div><p className="text-sm" style={{color:MUTED}}>jeton(s) disponibles pour vos exports et services Career.</p><p className="mt-3 text-xs" style={{color:MUTED}}>Les règles d’utilisation des jetons sont définies par l’Administration Omnia.</p></Card></div><button onClick={save} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{background:BLUE}}>Enregistrer les paramètres</button></div>;
}

function Readonly({label,value}:{label:string;value:string}){return <label className="text-sm font-medium" style={{color:BLUE}}>{label}<input readOnly value={value} className="mt-1 h-11 w-full rounded-xl border bg-slate-50 px-3 text-sm" style={{borderColor:BORDER}}/></label>}
