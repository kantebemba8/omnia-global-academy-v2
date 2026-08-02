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

export function EnhancedDashboard({displayName,loading,cvDocs,lmDocs,cvTemplates,lmTemplates,onView,onCreate,onOpen}:{
  displayName:string;loading:boolean;cvDocs:Doc[];lmDocs:Doc[];cvTemplates:Template[];lmTemplates:Template[];
  onView:(view:string)=>void;onCreate:(type:'cv'|'lm',key?:string)=>void;onOpen:(id?:string,type?:'cv'|'lm')=>void;
}){
  const completedCv=cvDocs.filter(d=>d.status==='completed');
  const completedLm=lmDocs.filter(d=>d.status==='completed');
  const applications=readJson<any[]>('omnia_manual_applications',[]);
  const allDocs=[...cvDocs,...lmDocs];
  const progress=allDocs.length?Math.round((completedCv.length+completedLm.length)/allDocs.length*100):0;
  const recent=[...allDocs].sort((a,b)=>new Date(b.updated_at||b.created_at||0).getTime()-new Date(a.updated_at||a.created_at||0).getTime()).slice(0,5);
  const [advice,setAdvice]=useState<{text:string;loading:boolean}>({text:'',loading:false});
  useEffect(()=>{
    const day=new Date().toISOString().slice(0,10); const cached=readJson<any>('omnia_career_daily_advice',null);
    if(cached?.day===day&&cached?.text){setAdvice({text:cached.text,loading:false});return}
    setAdvice({text:'',loading:true});
    callAi(`Génère un seul conseil du jour concret, professionnel et bref (maximum 45 mots), destiné à ${displayName}, pour améliorer un CV, une lettre de motivation, une candidature ou une préparation entretien. Données réelles: ${completedCv.length} CV terminés, ${completedLm.length} LM terminées, ${applications.length} candidatures. N'invente aucune donnée personnelle.`)
      .then(text=>{if(text){saveJson('omnia_career_daily_advice',{day,text});setAdvice({text,loading:false})}else setAdvice({text:'',loading:false})})
      .catch(()=>setAdvice({text:'',loading:false}));
  },[displayName,completedCv.length,completedLm.length,applications.length]);
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-semibold" style={{color:BLUE}}>{dashboardGreeting(displayName)}</h1></div>
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4"><Stat label="CV terminés" value={loading?'…':completedCv.length} icon={FileText} onClick={()=>onView('cv')}/><Stat label="LM terminées" value={loading?'…':completedLm.length} icon={Mail} onClick={()=>onView('lm')}/><Stat label="Candidatures" value={applications.length} icon={Briefcase} onClick={()=>onView('applications')}/><Stat label="Ma progression" value={`${progress}%`} icon={Target}/></div>
    <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]"><Card className="p-5"><h2 className="mb-4 font-semibold" style={{color:BLUE}}>Activité récente</h2>{recent.length?<div className="space-y-3">{recent.map(doc=><button key={doc.id} onClick={()=>onOpen(doc.id,doc.doc_type)} className="flex w-full items-center gap-3 rounded-xl border p-3 text-left hover:bg-slate-50" style={{borderColor:BORDER}}><div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{background:'rgba(0,32,80,.08)'}}>{doc.doc_type==='cv'?<FileText size={16} color={BLUE}/>:<Mail size={16} color={BLUE}/>}</div><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold" style={{color:BLUE}}>{doc.title}</div><div className="text-xs" style={{color:MUTED}}>{doc.status==='completed'?'Terminé':'Brouillon'}</div></div><ChevronRight size={15} color={MUTED}/></button>)}</div>:<Empty text="Aucune activité récente."/>}</Card><Card className="p-5"><div className="mb-4 flex items-center gap-2"><Sparkles size={18} color={GOLD}/><h2 className="font-semibold" style={{color:BLUE}}>Conseil du jour</h2></div>{advice.loading?<p className="text-sm" style={{color:MUTED}}>Génération du conseil IA…</p>:advice.text?<p className="text-sm leading-6" style={{color:'#374151'}}>{advice.text}</p>:<Empty text="Conseil IA indisponible pour le moment."/>}</Card></div>
    <Card className="p-5"><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold" style={{color:BLUE}}>Modèles recommandés</h2></div><div className="grid gap-5 lg:grid-cols-2"><div><div className="mb-3 text-sm font-semibold" style={{color:BLUE}}>3 modèles CV</div><div className="grid grid-cols-3 gap-3">{cvTemplates.slice(0,3).map(t=><TemplateLiveCard key={t.template_key} template={t} docType="cv" onClick={()=>onCreate('cv',t.template_key)}/>)}</div></div><div><div className="mb-3 text-sm font-semibold" style={{color:BLUE}}>3 modèles LM</div><div className="grid grid-cols-3 gap-3">{lmTemplates.slice(0,3).map(t=><TemplateLiveCard key={t.template_key} template={t} docType="lm" onClick={()=>onCreate('lm',t.template_key)}/>)}</div></div></div></Card>
  </div>;
}

const baseCategories=['Général','RH','Comportemental','Technique','Sectoriel','Lié à une offre'] as const;
const questionBank:Record<string,string[]>={
  Général:['Présentez-vous en deux minutes.','Pourquoi souhaitez-vous rejoindre cette entreprise ?','Pourquoi êtes-vous la bonne personne pour ce poste ?','Quel accomplissement vous rend le plus fier ?'],
  RH:['Quelles sont vos principales motivations ?','Quel environnement de travail vous convient le mieux ?','Comment gérez-vous un désaccord avec un collègue ?','Où vous voyez-vous dans trois ans ?'],
  Comportemental:['Parlez d’une situation difficile que vous avez résolue.','Décrivez une erreur et ce que vous en avez appris.','Donnez un exemple de prise d’initiative.','Racontez une situation où vous avez dû convaincre.'],
  Technique:['Expliquez une compétence technique importante pour votre métier.','Comment contrôlez-vous la qualité de votre travail ?','Décrivez un problème technique complexe que vous avez résolu.','Comment restez-vous à jour dans votre domaine ?'],
  Sectoriel:['Quels sont les principaux enjeux actuels de votre secteur ?','Comment votre expérience répond-elle aux besoins du secteur ?','Quelle évolution du secteur vous semble la plus importante ?','Quels indicateurs utiliseriez-vous pour mesurer votre performance ?'],
  'Lié à une offre':['Pourquoi cette offre vous intéresse-t-elle ?','Quelles compétences correspondent le mieux à cette offre ?','Quel élément de votre parcours répond au besoin principal ?','Que feriez-vous pendant vos 90 premiers jours ?']
};

function StarChecklist(){
  const steps=[
    {letter:'S',name:'Situation',role:'Décrire précisément le contexte, le lieu et le moment.'},
    {letter:'T',name:'Tâche',role:'Présenter votre objectif ou votre responsabilité personnelle.'},
    {letter:'A',name:'Action',role:'Expliquer les actions que vous avez personnellement réalisées.'},
    {letter:'R',name:'Résultat',role:'Donner un résultat observable, concret ou chiffré.'}
  ];
  const [completed,setCompleted]=useState<number[]>(()=>readJson('omnia_star_completed',[]));
  const [pendingStep,setPendingStep]=useState<number|null>(null);

  function requestConfirmation(i:number){
    if(i>completed.length||completed.includes(i))return;
    setPendingStep(i);
  }

  function confirmInsideOmnia(){
    if(pendingStep===null)return;
    const next=Array.from(new Set([...completed,pendingStep])).sort((a,b)=>a-b);
    setCompleted(next);
    saveJson('omnia_star_completed',next);
    setPendingStep(null);
  }

  return <>
    <Card className="p-5">
      <h3 className="font-semibold" style={{color:BLUE}}>Checklist STAR</h3>
      <p className="mt-2 text-sm" style={{color:MUTED}}>STAR vous aide à structurer une réponse comportementale complète. Validez chaque étape après l’avoir réellement intégrée à votre réponse.</p>
      <div className="mt-4 space-y-3">
        {steps.map((step,i)=>{
          const done=completed.includes(i);
          const enabled=i<=completed.length;
          return <div key={step.letter} className="rounded-xl border p-3" style={{borderColor:done?'#22c55e':BORDER,background:done?'#f0fdf4':'#fff'}}>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold" style={{background:done?'#16a34a':'rgba(0,32,80,.08)',color:done?'#fff':BLUE}}>{done?'✓':step.letter}</div>
              <div className="flex-1">
                <div className="font-semibold" style={{color:BLUE}}>{step.name}</div>
                <div className="mt-1 text-xs leading-5" style={{color:MUTED}}>{step.role}</div>
                {enabled&&!done&&<button onClick={()=>requestConfirmation(i)} className="mt-3 rounded-lg border px-3 py-1.5 text-xs font-semibold" style={{borderColor:GOLD,color:BLUE}}>Confirmer et passer à l’étape suivante</button>}
              </div>
            </div>
          </div>
        })}
      </div>
      <div className="mt-4 text-sm font-semibold" style={{color:BLUE}}>Progression : {completed.length}/4</div>
    </Card>

    {pendingStep!==null&&<div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="star-confirm-title">
      <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-2xl" style={{borderColor:BORDER}}>
        <h3 id="star-confirm-title" className="text-lg font-semibold" style={{color:BLUE}}>Confirmer dans Omnia Career</h3>
        <p className="mt-3 text-sm leading-6" style={{color:MUTED}}>Êtes-vous sûr que votre réponse contient bien l’étape {steps[pendingStep].letter} — {steps[pendingStep].name} ?</p>
        <p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm" style={{color:BLUE}}>{steps[pendingStep].role}</p>
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={()=>setPendingStep(null)} className="rounded-xl border px-4 py-2.5 text-sm font-semibold" style={{borderColor:BORDER,color:BLUE}}>Annuler</button>
          <button onClick={confirmInsideOmnia} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{background:BLUE}}>Confirmer et continuer</button>
        </div>
      </div>
    </div>}
  </>;
}

function FrequentQuestions(){
  const adminQuestions=readJson<string[]>('omnia_admin_interview_questions',[]);
  const categories=[...baseCategories,'Omnia'];
  const [category,setCategory]=useState<string>('Général'); const [open,setOpen]=useState('');
  const [answers,setAnswers]=useState<Record<string,string>>(()=>readJson('omnia_interview_answers',{}));
  const [feedback,setFeedback]=useState<Record<string,string>>(()=>readJson('omnia_interview_feedback',{}));
  const [loading,setLoading]=useState('');
  const questions=category==='Omnia'?adminQuestions:(questionBank[category]||[]);
  async function saveAnswer(q:string){const answer=(answers[q]||'').trim();if(!answer)return;saveJson('omnia_interview_answers',answers);if(category==='Omnia'){const submissions=readJson<any[]>('omnia_admin_question_submissions',[]);saveJson('omnia_admin_question_submissions',[...submissions,{question:q,answer,submitted_at:new Date().toISOString(),status:'pending_admin_score'}]);setFeedback({...feedback,[q]:'Réponse enregistrée et transmise au Super Admin pour notation.'});return}setLoading(q);try{const result=await callAi(`Corrige cette réponse d'entretien. Donne une note sur 100, les points forts et 3 améliorations concrètes. Question: ${q}\nRéponse: ${answer}. N'invente aucune information.`);const next={...feedback,[q]:result};setFeedback(next);saveJson('omnia_interview_feedback',next)}catch{setFeedback({...feedback,[q]:'Réponse enregistrée. La correction IA est indisponible pour le moment.'})}finally{setLoading('')}}
  return <div className="space-y-5"><div className="flex flex-wrap gap-2">{categories.map(c=><button key={c} onClick={()=>setCategory(c)} className="rounded-full px-4 py-2 text-sm font-semibold" style={{background:category===c?BLUE:'#fff',color:category===c?'#fff':BLUE,border:`1px solid ${BORDER}`}}>{c}</button>)}</div><div className="grid gap-5 xl:grid-cols-[1fr_380px]"><Card className="p-5"><h3 className="mb-4 font-semibold" style={{color:BLUE}}>Questions fréquentes</h3>{questions.length?<div className="space-y-3">{questions.map(q=><div key={q} className="rounded-xl border" style={{borderColor:BORDER}}><button onClick={()=>setOpen(open===q?'':q)} className="flex w-full items-center justify-between p-4 text-left text-sm font-semibold" style={{color:BLUE}}>{q}<ChevronDown size={16}/></button>{open===q&&<div className="border-t p-4" style={{borderColor:BORDER}}><textarea value={answers[q]||''} onChange={e=>setAnswers({...answers,[q]:e.target.value})} className="min-h-32 w-full rounded-xl border p-3 text-sm" style={{borderColor:BORDER}} placeholder="Rédigez votre réponse personnelle…"/><button onClick={()=>saveAnswer(q)} disabled={!answers[q]?.trim()||loading===q} className="mt-3 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40" style={{background:BLUE}}>{loading===q?'Analyse IA…':'Enregistrer ma réponse'}</button>{feedback[q]&&<div className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm leading-6">{feedback[q]}</div>}</div>}</div>)}</div>:<Empty text={category==='Omnia'?'Aucune question Omnia publiée par le Super Admin.':'Aucune question disponible.'}/>}</Card><StarChecklist/></div></div>;
}

function InterviewSimulation(){
  const videoRef=useRef<HTMLVideoElement|null>(null);const recorderRef=useRef<MediaRecorder|null>(null);const chunks=useRef<Blob[]>([]);
  const recognitionRef=useRef<any>(null);const [mode,setMode]=useState<'video'|'audio'>('video');const [active,setActive]=useState(false);const [recording,setRecording]=useState(false);const [index,setIndex]=useState(0);const [questions,setQuestions]=useState<string[]>([]);const [recordings,setRecordings]=useState<Array<{url:string;transcript:string;question:string}>>([]);const [transcript,setTranscript]=useState('');const [analysis,setAnalysis]=useState('');const [loading,setLoading]=useState(false);const [error,setError]=useState('');
  async function start(){setError('');try{const stream=await navigator.mediaDevices.getUserMedia({video:mode==='video',audio:true});if(videoRef.current){videoRef.current.srcObject=stream;if(mode==='video')await videoRef.current.play()}const base=[...questionBank.Général,...questionBank.Comportemental,...questionBank.RH].sort(()=>Math.random()-.5).slice(0,5);setQuestions(base);setActive(true);setIndex(0);setRecordings([]);setAnalysis('')}catch{setError('Accès au microphone ou à la caméra refusé.')}}
  function startSpeech(){const SR=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;if(!SR)return;const r=new SR();r.lang='fr-FR';r.continuous=true;r.interimResults=true;r.onresult=(e:any)=>{let t='';for(let i=e.resultIndex;i<e.results.length;i++)t+=e.results[i][0].transcript+' ';setTranscript(prev=>(prev+' '+t).trim())};r.start();recognitionRef.current=r}
  function record(){const stream=videoRef.current?.srcObject as MediaStream|null;if(!stream)return;chunks.current=[];setTranscript('');const rec=new MediaRecorder(stream);rec.ondataavailable=e=>e.data.size&&chunks.current.push(e.data);rec.onstop=()=>{recognitionRef.current?.stop?.();const blob=new Blob(chunks.current,{type:mode==='video'?'video/webm':'audio/webm'});const item={url:URL.createObjectURL(blob),transcript,question:questions[index]};setRecordings(r=>[...r,item]);setRecording(false);if(index<questions.length-1)setIndex(i=>i+1)};recorderRef.current=rec;rec.start();startSpeech();setRecording(true)}
  function stop(){recorderRef.current?.stop()}
  async function analyze(){setLoading(true);try{const text=recordings.map((r,i)=>`Question ${i+1}: ${r.question}\nRéponse transcrite: ${r.transcript||'[transcription indisponible]'}`).join('\n\n');const result=await callAi(`Évalue cette simulation d'entretien. Donne un score global sur 100, un score par réponse, les points forts et les axes d'amélioration. Si une transcription est indisponible, indique clairement que cette réponse ne peut pas être notée. ${text}`);setAnalysis(result)}catch{setAnalysis('Analyse IA indisponible pour le moment. Les enregistrements restent disponibles.')}finally{setLoading(false)}}
  function reset(){const stream=videoRef.current?.srcObject as MediaStream|null;stream?.getTracks().forEach(t=>t.stop());setActive(false);setRecording(false);setQuestions([]);setRecordings([]);setAnalysis('');setIndex(0)}
  return <div className="space-y-5"><div className="flex gap-2"><button onClick={()=>setMode('video')} disabled={active} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold" style={{borderColor:mode==='video'?BLUE:BORDER,background:mode==='video'?'rgba(0,32,80,.06)':'#fff',color:BLUE}}><Video size={16}/>Vidéo</button><button onClick={()=>setMode('audio')} disabled={active} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold" style={{borderColor:mode==='audio'?BLUE:BORDER,background:mode==='audio'?'rgba(0,32,80,.06)':'#fff',color:BLUE}}><Mic size={16}/>Audio</button></div><div className="grid gap-5 xl:grid-cols-[1fr_380px]"><Card className="p-5"><div className="aspect-video overflow-hidden rounded-2xl bg-slate-950">{mode==='video'?<video ref={videoRef} className="h-full w-full object-cover" muted playsInline/>:<div className="flex h-full items-center justify-center"><Mic size={54} color="#fff"/><video ref={videoRef} className="hidden" muted playsInline/></div>}</div>{error&&<p className="mt-3 text-sm text-red-600">{error}</p>}<div className="mt-4 flex flex-wrap gap-3">{!active?<button onClick={start} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{background:BLUE}}>{mode==='video'?<Camera size={17}/>:<Mic size={17}/>}Commencer la simulation</button>:<>{!recording&&index<questions.length?<button onClick={record} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{background:BLUE}}><Play size={17}/>Enregistrer ma réponse</button>:recording?<button onClick={stop} className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white">Terminer la réponse</button>:null}<button onClick={reset} className="rounded-xl border px-4 py-2.5 text-sm font-semibold" style={{borderColor:BORDER,color:BLUE}}>Supprimer la simulation</button></>}</div>{recordings.length===5&&<button onClick={analyze} disabled={loading} className="mt-4 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40" style={{background:BLUE}}>{loading?'Analyse IA…':'Analyser et obtenir mon score'}</button>}{analysis&&<div className="mt-4 whitespace-pre-wrap rounded-xl border p-4 text-sm leading-6" style={{borderColor:BORDER}}>{analysis}</div>}</Card><Card className="p-5"><div className="flex items-center justify-between"><h3 className="font-semibold" style={{color:BLUE}}>Simulation entretien</h3>{active&&<span className="text-sm font-semibold" style={{color:GOLD}}>{Math.min(index+1,5)}/5</span>}</div>{active?<><div className="mt-5 rounded-2xl p-5" style={{background:'rgba(0,32,80,.06)'}}><div className="text-xs font-semibold uppercase" style={{color:MUTED}}>Question actuelle</div><p className="mt-2 text-lg font-semibold leading-7" style={{color:BLUE}}>{questions[index]}</p></div><div className="mt-4 flex items-center gap-2 text-sm" style={{color:MUTED}}><Clock size={16}/>Temps conseillé : 60 à 120 secondes</div><div className="mt-4 text-xs" style={{color:MUTED}}>Réponses enregistrées : {recordings.length}/5</div></>:<Empty text="Choisissez audio ou vidéo, puis démarrez la simulation de 5 questions."/>}</Card></div></div>;
}

export function EnhancedInterview(){const [tab,setTab]=useState<'questions'|'simulation'|'answers'|'advice'>('questions');const answers=readJson<Record<string,string>>('omnia_interview_answers',{});const tabs=[['questions','Questions fréquentes'],['simulation','Simulation entretien'],['answers','Mes réponses'],['advice','Conseils']] as const;return <div className="space-y-5"><div><h1 className="text-2xl font-semibold" style={{color:BLUE}}>Préparation entretien</h1><p className="mt-1 text-sm" style={{color:MUTED}}>Entraînez-vous, maîtrisez les questions clés et gagnez en confiance.</p></div><div className="flex gap-6 border-b" style={{borderColor:BORDER}}>{tabs.map(([id,label])=><button key={id} onClick={()=>setTab(id)} className="border-b-2 px-1 pb-3 text-sm font-semibold" style={{borderColor:tab===id?GOLD:'transparent',color:tab===id?BLUE:MUTED}}>{label}</button>)}</div>{tab==='questions'&&<FrequentQuestions/>}{tab==='simulation'&&<InterviewSimulation/>}{tab==='answers'&&<Card className="p-5"><h3 className="mb-4 font-semibold" style={{color:BLUE}}>Mes réponses sauvegardées</h3>{Object.entries(answers).filter(([,v])=>v.trim()).length?Object.entries(answers).filter(([,v])=>v.trim()).map(([q,a])=><div key={q} className="mb-3 rounded-xl border p-4" style={{borderColor:BORDER}}><div className="text-sm font-semibold" style={{color:BLUE}}>{q}</div><p className="mt-2 text-sm leading-6" style={{color:'#374151'}}>{a}</p></div>):<Empty text="Aucune réponse sauvegardée."/>}</Card>}{tab==='advice'&&<AiAdvice/>}</div>}
function AiAdvice(){const [text,setText]=useState('');const [loading,setLoading]=useState(false);async function generate(){setLoading(true);setText('');try{const user=readJson<any>('omnia_user',{});const answers=readJson<any>('omnia_interview_answers',{});const apps=readJson<any[]>('omnia_manual_applications',[]);setText(await callAi(`Donne des conseils d'entretien personnalisés basés uniquement sur ces données réelles. Profil:${JSON.stringify(user)} Réponses:${JSON.stringify(answers)} Candidatures:${JSON.stringify(apps)}. Si une information manque, indique-le.`))}catch{setText('Le service IA n’est pas disponible pour le moment.')}finally{setLoading(false)}}return <Card className="p-5"><h3 className="font-semibold" style={{color:BLUE}}>Conseils personnalisés</h3><p className="mt-2 text-sm" style={{color:MUTED}}>L’IA analysera votre profil, vos candidatures et vos réponses réelles.</p><button onClick={generate} disabled={loading} className="mt-4 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{background:BLUE}}>{loading?'Analyse…':'Générer mes conseils'}</button>{text&&<div className="mt-4 whitespace-pre-wrap rounded-xl border p-4 text-sm leading-6" style={{borderColor:BORDER,color:'#374151'}}>{text}</div>}</Card>}

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
  function exportProfile(){const blob=new Blob([JSON.stringify(p,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='profil-carriere.json';a.click();URL.revokeObjectURL(url)}
  return <div className="space-y-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold" style={{color:BLUE}}>Profil carrière</h1><p className="mt-1 text-sm" style={{color:MUTED}}>Gérez votre profil professionnel et vos documents.</p></div><div className="flex flex-wrap gap-2"><button onClick={exportProfile} className="rounded-xl border px-4 py-2.5 text-sm font-semibold" style={{borderColor:BORDER,color:BLUE}}><Download className="mr-2 inline h-4 w-4"/>Exporter le profil</button><button onClick={()=>{const next={...p,visible:!p.visible};persist(next)}} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold" style={{borderColor:p.visible?'#22c55e':'#ef4444',color:p.visible?'#15803d':'#b91c1c',background:p.visible?'#f0fdf4':'#fef2f2'}}><span className={`h-2.5 w-2.5 rounded-full ${p.visible?'bg-green-500':'bg-red-500'}`}/>{p.visible?'Visible':'Privé'}</button><button onClick={()=>{if(editing)persist();setEditing(!editing)}} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{background:BLUE}}>{editing?'Enregistrer le profil':'Modifier mon profil'}</button></div></div>
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
  return <div className="space-y-5"><div><h1 className="text-2xl font-semibold" style={{color:BLUE}}>Paramètres</h1><p className="mt-1 text-sm" style={{color:MUTED}}>Gérez vos préférences, votre compte et la confidentialité de vos données.</p></div><div className="grid gap-5 xl:grid-cols-2"><Card className="p-5"><h2 className="font-semibold" style={{color:BLUE}}>Compte</h2><div className="mt-4 grid gap-3 md:grid-cols-2"><Readonly label="Nom complet" value={user?.full_name||user?.name||''}/><Readonly label="Adresse e-mail" value={user?.email||''}/><Readonly label="Numéro" value={user?.phone_number||user?.phone||''}/></div></Card><Card className="p-5"><h2 className="font-semibold" style={{color:BLUE}}>Confidentialité</h2><label className="mt-4 block text-sm font-medium" style={{color:BLUE}}>Visibilité de mon profil<select value={s.profile_visibility} onChange={e=>setS({...s,profile_visibility:e.target.value})} className="mt-1 h-11 w-full rounded-xl border px-3" style={{borderColor:BORDER}}><option value="public">Tout le monde</option><option value="recruiters">Recruteurs</option><option value="private">Personne</option></select></label><label className="mt-3 block text-sm font-medium" style={{color:BLUE}}>Visibilité CV et LM<select value={s.documents_visibility} onChange={e=>setS({...s,documents_visibility:e.target.value})} className="mt-1 h-11 w-full rounded-xl border px-3" style={{borderColor:BORDER}}><option value="public">Tout le monde</option><option value="recruiters">Recruteurs</option><option value="private">Personne</option></select></label></Card><Card className="p-5"><h2 className="font-semibold" style={{color:BLUE}}>Notifications</h2><div className="mt-4 space-y-4">{[['jobs','Nouvelles opportunités d’emploi'],['interviews','Rappels d’entretien et préparation'],['profile_visits','Profil visité'],['news','Actualités et offres Omnia']].map(([key,label])=><label key={key} className="flex items-center justify-between text-sm" style={{color:BLUE}}><span>{label}</span><input type="checkbox" checked={!!s.notifications[key]} onChange={e=>setS({...s,notifications:{...s.notifications,[key]:e.target.checked}})}/></label>)}</div></Card><Card className="p-5"><h2 className="font-semibold" style={{color:BLUE}}>Téléchargements</h2><div className="mt-4 text-3xl font-semibold" style={{color:BLUE}}>{tokens}</div><p className="text-sm" style={{color:MUTED}}>jeton(s) disponibles pour vos exports et services Career.</p><p className="mt-3 text-xs" style={{color:MUTED}}>Les règles d’utilisation des jetons sont définies par le Super-admin.</p></Card></div><button onClick={save} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{background:BLUE}}>Enregistrer les paramètres</button></div>;
}

function Readonly({label,value}:{label:string;value:string}){return <label className="text-sm font-medium" style={{color:BLUE}}>{label}<input readOnly value={value} className="mt-1 h-11 w-full rounded-xl border bg-slate-50 px-3 text-sm" style={{borderColor:BORDER}}/></label>}
