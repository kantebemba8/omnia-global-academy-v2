import { getSessionToken } from '../lib/session';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Menu, ShieldCheck, X } from 'lucide-react';
import { LessonBlocksRenderer } from '../components/BlockRenderer';

const API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/studio-unified`;

type PreviewBlock = { id:string; block_type:string; position:number; title?:string; content_json:Record<string,unknown>; settings_json?:Record<string,unknown>; file_url?:string; file_name?:string; file_size?:number; file_mime?:string; };
type PreviewStage = { id:string; title:string; stage_type?:string; blocks:PreviewBlock[] };
type ProgramSection = { id:string; title:string; objective?:string; section_type?:'introduction'|'module'|'conclusion'|'final_exam'; lessons:Array<{id:string;title:string;stage_type?:string;locked:boolean;duration_seconds?:number}> };
type PreviewPayload = {
  success:boolean; preview_enabled:boolean; privileged?:boolean;
  course:{id:string;title:string;short_description?:string;long_description?:string;cover_image_url?:string;category?:string;level?:string;language?:string;target_audience?:string;objectives?:string[]|string;learning_outcomes?:string[]|string;sale_mode?:'free'|'paid';price_xof?:number;desired_price_amount?:number;sale_currency?:string;current_version?:string};
  introduction:PreviewStage|null; module_presentation:PreviewStage|null; first_lesson:PreviewStage|null; program:ProgramSection[]; error?:string;
};

type PreviewStep = 'intro'|'presentation'|'lesson'|'end';
function PreviewBlocks({blocks}:{blocks:PreviewBlock[]}){
  return <LessonBlocksRenderer blocks={blocks as any[]} />;
}

export function ApercuGratuit(){
  const {id:courseId}=useParams<{id:string}>(); const navigate=useNavigate();
  const [data,setData]=useState<PreviewPayload|null>(null); const [loading,setLoading]=useState(true); const [error,setError]=useState(''); const [step,setStep]=useState<PreviewStep>('intro'); const [programOpen,setProgramOpen]=useState(false);
  useEffect(()=>{if(!courseId)return;const sessionToken=getSessionToken()||import.meta.env.VITE_SUPABASE_ANON_KEY||'';fetch(API,{method:'POST',headers:{Authorization:`Bearer ${sessionToken}`,'Content-Type':'application/json'},body:JSON.stringify({action:'public_course_preview',course_id:courseId})}).then(async response=>{const payload=await response.json();if(!response.ok||!payload.success)throw new Error(payload.error||'Aperçu indisponible');setData(payload);}).catch(reason=>setError(reason instanceof Error?reason.message:'Aperçu indisponible')).finally(()=>setLoading(false));},[courseId]);
  useEffect(()=>{
    if(!data||loading)return;
    if(step==='intro'&&!data.introduction){
      if(data.module_presentation)setStep('presentation');
      else if(data.first_lesson)setStep('lesson');
      else setStep('end');
    }
  },[data,loading,step]);
  if(loading)return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="h-9 w-9 animate-spin rounded-full border-2" style={{borderColor:'#002050',borderTopColor:'transparent'}}/></div>;
  if(!data||error)return <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 px-5"><p className="font-semibold text-[#002050]">Aperçu indisponible</p><p className="text-center text-sm text-slate-500">{error||'Cette formation ne propose pas encore d’aperçu gratuit.'}</p><button onClick={()=>navigate(`/cours/${courseId}`)} className="rounded-lg bg-[#002050] px-4 py-2 text-sm font-semibold text-white">Retour à la formation</button></div>;
  const {course,introduction,module_presentation:firstPresentation,first_lesson:firstLesson,program}=data;
  const priceLabel=course.sale_mode==='free'?'Gratuit':`${Number(course.price_xof??course.desired_price_amount??0).toLocaleString('fr-FR')} ${course.sale_currency||'XOF'}`;
  const sequence:PreviewStep[]=[...(introduction?['intro' as PreviewStep]:[]),...(firstPresentation?['presentation' as PreviewStep]:[]),...(firstLesson?['lesson' as PreviewStep]:[]),'end'];
  const goNext=()=>{const i=sequence.indexOf(step);if(i>=0&&i<sequence.length-1)setStep(sequence[i+1]);}; const goPrev=()=>{const i=sequence.indexOf(step);if(i>0)setStep(sequence[i-1]);else navigate(`/cours/${courseId}`);};
  const currentStage=step==='intro'?introduction:step==='presentation'?firstPresentation:step==='lesson'?firstLesson:null;
  const labelFor=(section:ProgramSection,index:number)=>section.section_type==='introduction'?'Introduction':section.section_type==='conclusion'?'Conclusion de la formation':section.section_type==='final_exam'?'Examen final':`Module ${program.slice(0,index+1).filter(s=>s.section_type==='module').length}`;
  return <div className="min-h-screen bg-slate-50 pb-24" style={{fontFamily:'Inter, system-ui, sans-serif'}}>
    <header className="sticky top-0 z-40 border-b bg-white" style={{borderColor:'#E4E7EC'}}><div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3"><button onClick={()=>navigate(`/cours/${courseId}`)} className="flex h-9 w-9 items-center justify-center rounded-lg border" style={{borderColor:'#E4E7EC'}}><ArrowLeft size={17} className="text-[#002050]"/></button><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[#002050]">{course.title}</p><p className="text-xs text-slate-500">Aperçu avant achat · aucune progression enregistrée</p></div>{<button onClick={()=>setProgramOpen(true)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold text-[#002050]"><Menu size={15}/>Programme</button>}<span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">APERÇU</span></div></header>
    {programOpen&&<div className="fixed inset-0 z-50"><button className="absolute inset-0 bg-black/50" onClick={()=>setProgramOpen(false)}/><aside className="absolute inset-y-0 left-0 w-[88vw] max-w-sm overflow-y-auto bg-white p-4 shadow-2xl"><div className="mb-4 flex items-center justify-between"><h2 className="font-black text-[#002050]">Programme</h2><button onClick={()=>setProgramOpen(false)}><X size={18}/></button></div>{program.map((section,i)=><div key={section.id} className="border-b py-3"><p className="text-[10px] font-black uppercase tracking-[.12em] text-[#BF8813]">{labelFor(section,i)}</p><p className="text-sm font-semibold text-[#002050]">{section.title}</p>{section.section_type==='module'&&<p className="mt-1 text-xs text-slate-400">{section.lessons.filter(l=>(l.stage_type||'lesson')==='lesson').length} leçon(s)</p>}</div>)}</aside></div>}
    {step==='end'?<main className="mx-auto flex min-h-[65vh] max-w-2xl items-center px-4"><div className="w-full rounded-3xl border bg-white p-8 text-center" style={{borderColor:'#E4E7EC'}}><ShieldCheck size={36} className="mx-auto text-[#BF8813]"/><h1 className="mt-4 text-2xl font-black text-[#002050]">Fin de l’aperçu gratuit</h1><p className="mt-3 text-sm leading-6 text-slate-600">Vous avez découvert l’introduction, la présentation du premier module et la première leçon autorisée. Les entraînements, évaluations, synthèses et la suite restent protégés.</p><button onClick={()=>navigate(`/cours/${courseId}`)} className="mt-6 rounded-xl bg-[#BF8813] px-5 py-3 text-sm font-bold text-white">{course.sale_mode==='free'?"S'inscrire":`Acheter · ${priceLabel}`}</button></div></main>:<main className="mx-auto max-w-7xl px-4 py-7"><div className="mx-auto max-w-5xl"><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#BF8813]">{step==='intro'?'Introduction':step==='presentation'?'Présentation du module':'Première leçon offerte'}</p><h1 className="mt-2 text-2xl font-black text-[#002050]">{currentStage?.title}</h1>{step==='lesson'&&<p className="mt-2 text-xs text-slate-500">Les entraînements et évaluations restent verrouillés avant achat.</p>}</div><div className="mt-6"><PreviewBlocks blocks={currentStage?.blocks||[]}/></div><div className="mx-auto mt-8 flex max-w-5xl items-center justify-between border-t pt-5" style={{borderColor:'#E4E7EC'}}><button onClick={goPrev} className="rounded-xl border px-4 py-2 text-sm font-semibold text-[#002050]">Précédent</button><button onClick={goNext} className="rounded-xl bg-[#002050] px-4 py-2 text-sm font-semibold text-white">{step==='lesson'?'Terminer l’aperçu':'Suivant'}</button></div></main>}
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-[#002050]"><div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white">Aperçu avant achat</p><p className="text-xs text-white/60">Programme complet visible · validations protégées</p></div><button onClick={()=>navigate(`/cours/${courseId}`)} className="rounded-xl bg-[#BF8813] px-4 py-2.5 text-sm font-semibold text-white">{course.sale_mode==='free'?"S'inscrire":`Acheter · ${priceLabel}`}</button></div></div>
  </div>;
}
