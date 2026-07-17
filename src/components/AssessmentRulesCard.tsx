import { useEffect, useState } from 'react';
import { ShieldCheck, Clock3 } from 'lucide-react';

export function AssessmentRulesCard({ durationMinutes=0, courseId='new' }:{durationMinutes?:number;courseId?:string}){
  const [acknowledged,setAcknowledged]=useState(false);
  const userId = (()=>{ try { return JSON.parse(localStorage.getItem('omnia_user')||'{}')?.id || 'anonymous'; } catch { return 'anonymous'; } })();
  const storageKey = `omnia_studio_rules_ack_v2_${userId}_${courseId}`;
  useEffect(()=>{ setAcknowledged(localStorage.getItem(storageKey)==='1'); },[storageKey]);
  if(acknowledged) return null;
  return <div className="rounded-xl border p-4 shadow-sm" style={{borderColor:'#E5D5A5',background:'#FFFBEB'}}>
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2"><ShieldCheck size={18} style={{color:'#BF8813'}}/><h3 className="text-sm font-semibold" style={{color:'#002050'}}>Règles obligatoires de validation</h3></div>
        <div className="grid sm:grid-cols-3 gap-2 text-sm"><div>Chaque leçon : <b>80 %</b></div><div>Chaque module : <b>80 %</b></div><div>Examen final : <b>70 %</b></div></div>
        <p className="text-xs text-gray-600 mt-2">Une évaluation est obligatoire à la fin de chaque leçon, de chaque module et de la formation. Ces seuils Omnia ne sont pas modifiables.</p>
        <div className="flex items-center gap-2 mt-3 text-xs text-gray-600"><Clock3 size={14}/>Durée pédagogique calculée automatiquement : {Math.max(0,durationMinutes)} min. Ce calcul s’applique à toutes les formations et alimente les heures CPD/certifiées.</div>
      </div>
      <button onClick={()=>{localStorage.setItem(storageKey,'1');setAcknowledged(true)}} className="shrink-0 rounded-lg px-4 py-2 text-xs font-semibold text-white" style={{background:'#002050'}}>J’ai compris</button>
    </div>
  </div>
}
