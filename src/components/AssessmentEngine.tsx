import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Clock, FileText, Loader2, Send, Upload, XCircle } from 'lucide-react';

const API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/studio-unified`;
const token = () => localStorage.getItem('omnia_session_token') || '';

async function call(action: string, payload: Record<string, unknown>) {
  const response = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ action, ...payload }) });
  const data = await response.json();
  if (!response.ok || data.success === false) throw new Error(data.message || data.error || 'Erreur');
  return data;
}

type Question = { id:string; question_type:'qcm'|'true_false'|'open_question'|'exercise'; prompt:string; options?:string[]; points:number; explanation?:string; accepted_submission_types?:string[]; resource_files?:Array<{name:string;url:string}> };
type Assessment = { id:string; title:string; instructions?:string; scope:string; passing_score:number; max_attempts:number; time_limit_minutes?:number; questions:Question[]; latest_attempt?:{score:number;passed:boolean;status:string} };

export function AssessmentEngine({ courseId, lessonId, moduleId, scope='lesson', onPassed }: { courseId:string; lessonId?:string; moduleId?:string; scope?:'lesson'|'module'|'final'; onPassed?:()=>void }) {
  const [assessment,setAssessment]=useState<Assessment|null>(null); const [answers,setAnswers]=useState<Record<string,any>>({}); const [loading,setLoading]=useState(true); const [sending,setSending]=useState(false); const [result,setResult]=useState<any>(null); const [error,setError]=useState('');
  useEffect(()=>{ setLoading(true); call('learner_get_assessment',{course_id:courseId,lesson_id:lessonId,module_id:moduleId,scope}).then(d=>setAssessment(d.assessment||null)).catch(e=>setError(e.message)).finally(()=>setLoading(false)); },[courseId,lessonId,moduleId,scope]);
  const complete=useMemo(()=>assessment?.questions.every(q=>{ const a=answers[q.id]; return q.question_type==='exercise' ? Array.isArray(a?.files)&&a.files.length>0 : a!==undefined&&a!==''; })??false,[assessment,answers]);
  const submit=async()=>{ if(!assessment||!complete)return; setSending(true);setError(''); try{ const d=await call('learner_submit_assessment',{assessment_id:assessment.id,course_id:courseId,answers:Object.entries(answers).map(([question_id,answer])=>({question_id,answer}))}); setResult(d); if(d.passed)onPassed?.(); }catch(e:any){setError(e.message)}finally{setSending(false)} };
  if(loading)return <div className="py-5 flex items-center gap-2 text-sm text-gray-500"><Loader2 size={16} className="animate-spin"/>Chargement de l’évaluation…</div>;
  if(!assessment)return <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">L’évaluation obligatoire n’a pas encore été configurée par le créateur.</div>;
  return <section className="mt-8 rounded-2xl border p-5" style={{borderColor:'#E4E7EC'}}>
    <div className="flex items-start justify-between gap-4 mb-4"><div><h2 className="font-semibold" style={{color:'#002050'}}>{assessment.title}</h2><p className="text-sm text-gray-500 mt-1">Score minimum obligatoire : <b>{assessment.passing_score}%</b> · {assessment.max_attempts} tentative(s){assessment.time_limit_minutes?` · ${assessment.time_limit_minutes} min`:''}</p></div><Clock size={20} style={{color:'#BF8813'}}/></div>
    {assessment.instructions&&<p className="text-sm mb-4">{assessment.instructions}</p>}
    <div className="space-y-5">{assessment.questions.map((q,i)=><div key={q.id} className="rounded-xl bg-gray-50 p-4"><p className="text-sm font-medium mb-3" style={{color:'#002050'}}>{i+1}. {q.prompt} <span className="text-xs text-gray-400">({q.points} pts)</span></p>
      {q.question_type==='qcm'&&<div className="space-y-2">{(q.options||[]).map((o,idx)=><label key={idx} className="flex gap-2 text-sm"><input type="radio" name={q.id} checked={answers[q.id]===idx} onChange={()=>setAnswers(a=>({...a,[q.id]:idx}))}/>{o}</label>)}</div>}
      {q.question_type==='true_false'&&<div className="flex gap-4"><label className="text-sm"><input type="radio" name={q.id} checked={answers[q.id]===true} onChange={()=>setAnswers(a=>({...a,[q.id]:true}))}/> Vrai</label><label className="text-sm"><input type="radio" name={q.id} checked={answers[q.id]===false} onChange={()=>setAnswers(a=>({...a,[q.id]:false}))}/> Faux</label></div>}
      {q.question_type==='open_question'&&<textarea rows={5} className="w-full border rounded-lg p-3 text-sm" value={answers[q.id]||''} onChange={e=>setAnswers(a=>({...a,[q.id]:e.target.value}))} placeholder="Rédigez votre réponse…"/>}
      {q.question_type==='exercise'&&<div><div className="flex flex-wrap gap-2 mb-3">{(q.resource_files||[]).map((f,j)=><a key={j} href={f.url} target="_blank" rel="noreferrer" className="text-xs underline flex gap-1"><FileText size={13}/>{f.name}</a>)}</div><label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm"><Upload size={15}/>Déposer mon travail<input type="file" multiple className="hidden" accept={(q.accepted_submission_types||[]).map(x=>'.'+x).join(',')} onChange={e=>setAnswers(a=>({...a,[q.id]:{files:Array.from(e.target.files||[]).map(f=>({name:f.name,size:f.size,type:f.type}))}}))}/></label>{answers[q.id]?.files?.length>0&&<p className="text-xs text-green-700 mt-2">{answers[q.id].files.length} fichier(s) prêt(s) à envoyer</p>}</div>}
    </div>)}</div>
    {error&&<p className="text-sm text-red-600 mt-4">{error}</p>}
    {result&&<div className={`mt-4 rounded-xl p-4 ${result.passed?'bg-green-50':'bg-amber-50'}`}>{result.passed?<div className="flex gap-2 text-green-700"><CheckCircle size={18}/>Évaluation réussie : {result.score}%</div>:result.pending_review?<div className="flex gap-2 text-amber-700"><Clock size={18}/>Réponse envoyée, correction en attente.</div>:<div className="flex gap-2 text-red-700"><XCircle size={18}/>Score : {result.score}% — seuil requis {assessment.passing_score}%.</div>}</div>}
    <button disabled={!complete||sending} onClick={submit} className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40" style={{backgroundColor:'#002050'}}>{sending?<Loader2 size={15} className="animate-spin"/>:<Send size={15}/>}Envoyer l’évaluation</button>
  </section>;
}
