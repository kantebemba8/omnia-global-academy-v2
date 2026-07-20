import { useEffect,useState } from 'react';
import { useParams } from 'react-router-dom';
import OmniaLiveLayout from '../../../components/omnia-live/OmniaLiveLayout';
import { liveApi } from '../liveApi';

export default function EventDocumentSettings(){
 const {liveId}=useParams();const [r,setR]=useState<any>({documents_enabled:true,free_event_document_policy:'attendance_based',default_document_type:'attendance_certificate',minimum_attendance_percent:80,super_admin_validation_required:true,cpd_enabled:false});
 const [msg,setMsg]=useState('');
 useEffect(()=>{if(liveId)liveApi('document_rules_get',{}, {event_id:liveId}).then(x=>x.rules&&setR(x.rules)).catch(()=>{})},[liveId]);
 async function save(){try{await liveApi('document_rules_save',{method:'POST',body:JSON.stringify({...r,event_id:liveId})});setMsg('Règles enregistrées.')}catch(e){setMsg(e instanceof Error?e.message:'Erreur')}}
 return <OmniaLiveLayout><section className="mx-auto max-w-4xl px-4 py-10"><h1 className="text-3xl font-black text-[#002050]">Documents & CPD</h1><div className="mt-6 space-y-4 rounded-3xl border bg-white p-6">
 <label className="flex justify-between">Documents activés<input type="checkbox" checked={!!r.documents_enabled} onChange={e=>setR({...r,documents_enabled:e.target.checked})}/></label>
 <label className="block">Événement gratuit<select className="mt-1 w-full rounded-xl border p-3" value={r.free_event_document_policy} onChange={e=>setR({...r,free_event_document_policy:e.target.value})}><option value="attendance_based">Document selon présence</option><option value="none">Aucun document</option><option value="manual_admin">Décision manuelle Super Admin</option></select></label>
 <label className="block">Présence minimale (%)<input type="number" className="mt-1 w-full rounded-xl border p-3" value={r.minimum_attendance_percent??80} onChange={e=>setR({...r,minimum_attendance_percent:Number(e.target.value)})}/></label>
 <label className="flex justify-between">CPD activé<input type="checkbox" checked={!!r.cpd_enabled} onChange={e=>setR({...r,cpd_enabled:e.target.checked})}/></label>
 {r.cpd_enabled&&<div className="grid gap-3 md:grid-cols-3"><input className="rounded-xl border p-3" placeholder="Heures CPD" value={r.cpd_hours||''} onChange={e=>setR({...r,cpd_hours:Number(e.target.value)})}/><input className="rounded-xl border p-3" placeholder="Points CPD" value={r.cpd_points||''} onChange={e=>setR({...r,cpd_points:Number(e.target.value)})}/><input className="rounded-xl border p-3" placeholder="Référence CPD" value={r.cpd_reference||''} onChange={e=>setR({...r,cpd_reference:e.target.value})}/></div>}
 <button onClick={save} className="rounded-xl bg-[#002050] px-5 py-3 font-bold text-white">Enregistrer</button>{msg&&<div className="rounded-xl bg-slate-50 p-3">{msg}</div>}</div></section></OmniaLiveLayout>
}