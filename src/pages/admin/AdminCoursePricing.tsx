import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { CheckCircle2 } from 'lucide-react';
import { ENDPOINTS } from '../../lib/config';

type C={id:string;title:string;score_calcule:number;prix_provisoire_xof:number;desired_price_amount:number|null;pricing_status:string;pricing_snapshot:any};
export default function AdminCoursePricing(){
 const [items,setItems]=useState<C[]>([]); const [comment,setComment]=useState<Record<string,string>>({});
 const token=()=>localStorage.getItem('omnia_session_token')||'';
 async function load(){const r=await fetch(ENDPOINTS.coursePricingWorkflow,{headers:{Authorization:`Bearer ${token()}`}});const d=await r.json();setItems(d.courses||[]);}
 useEffect(()=>{load();},[]);
 async function decide(id:string,source:'automatic'|'professor'){await fetch(ENDPOINTS.coursePricingWorkflow,{method:'POST',headers:{Authorization:`Bearer ${token()}`,'Content-Type':'application/json'},body:JSON.stringify({course_id:id,action:'admin_decide',source,comment:comment[id]||undefined})});load();}
 return <AdminLayout><div className="max-w-6xl mx-auto p-6 space-y-5">
  <div><h1 className="text-2xl font-bold" style={{color:'#002050'}}>Validation tarifaire des formations</h1><p className="text-sm text-gray-500 mt-1">Comparez le prix automatique et le prix souhaité avant la validation pédagogique.</p></div>
  {items.length===0?<div className="rounded-xl border bg-white p-6 text-sm text-gray-400">Aucune proposition en attente.</div>:
  items.map(c=><div key={c.id} className="rounded-2xl border border-gray-200 bg-white p-5">
    <div className="flex items-start justify-between"><div><h2 className="font-semibold text-gray-800">{c.title}</h2><p className="text-xs text-gray-500 mt-1">Score final : {c.score_calcule}</p></div><span className="text-xs bg-amber-50 text-amber-700 rounded-full px-2 py-1">{c.pricing_status.replaceAll('_',' ')}</span></div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
      <button onClick={()=>decide(c.id,'automatic')} className="text-left rounded-xl border-2 p-4 hover:bg-gray-50" style={{borderColor:'#002050'}}>
        <p className="text-xs text-gray-500">Prix automatique</p><p className="text-2xl font-bold mt-1" style={{color:'#002050'}}>{(c.prix_provisoire_xof||0).toLocaleString()} XOF</p><p className="text-xs text-gray-400 mt-2">Calculé selon le score, le multiplicateur et le palier configuré.</p>
      </button>
      <button onClick={()=>decide(c.id,'professor')} disabled={!c.desired_price_amount} className="text-left rounded-xl border-2 p-4 hover:bg-gray-50 disabled:opacity-40" style={{borderColor:'#BF8813'}}>
        <p className="text-xs text-gray-500">Prix souhaité par le professeur</p><p className="text-2xl font-bold mt-1" style={{color:'#BF8813'}}>{(c.desired_price_amount||0).toLocaleString()} XOF</p><p className="text-xs text-gray-400 mt-2">Choisissez ce montant pour le soumettre à l’acceptation du professeur.</p>
      </button>
    </div>
    <textarea value={comment[c.id]||''} onChange={e=>setComment(x=>({...x,[c.id]:e.target.value}))} placeholder="Commentaire ou justification (optionnel)" rows={2} className="mt-4 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"/>
  </div>)}
 </div></AdminLayout>;
}
