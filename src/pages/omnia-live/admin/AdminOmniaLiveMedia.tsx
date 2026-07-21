import {useEffect,useState} from 'react';
import {liveApi} from '../liveApi';
import AdminOmniaLiveShell from './AdminOmniaLiveShell';
import {omniaDialog} from '../../../lib/omniaDialog';
import {liveStatusLabel} from '../../../lib/omniaLiveLabels';

export default function AdminOmniaLiveMedia(){
 const [rows,setRows]=useState<any[]>([]),[msg,setMsg]=useState('');
 const load=()=>liveApi('admin_media_queue').then(d=>setRows(d.media||[])).catch(e=>setMsg(e instanceof Error?e.message:'Erreur'));
 useEffect(()=>{load()},[]);
 async function decide(id:string,decision:string){
  const labels:any={approved:'Approuver le média',changes_requested:'Demander des corrections',rejected:'Refuser le média',suspended:'Suspendre le média'};
  const r=await omniaDialog({title:labels[decision]||'Décision sur le média',message:'Confirmez cette action.',confirmLabel:'Confirmer',inputLabel:'Motif / note',inputRequired:decision!=='approved',danger:['rejected','suspended'].includes(decision)});
  if(!r.confirmed)return;
  try{await liveApi('admin_media_review',{method:'POST',body:JSON.stringify({media_id:id,decision,reason:r.value})});await load()}catch(e){setMsg(e instanceof Error?e.message:'Erreur')}
 }
 return <AdminOmniaLiveShell title="Médias & Replays" subtitle="Traitement, validation, suspension et publication des médias.">
  {msg&&<div className="mb-4 border-l-2 border-[#BF8813] bg-amber-50 px-4 py-3 text-sm">{msg}</div>}
  {rows.length?(
   <div className="overflow-x-auto">
    <div className="min-w-[900px]">
     <div className="grid grid-cols-[1.4fr_.8fr_.8fr_1.2fr] border-b border-slate-300 pb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
      <div>Média</div><div>Type</div><div>État</div><div className="text-right">Décision</div>
     </div>
     {rows.map(x=><div key={x.id} className="grid grid-cols-[1.4fr_.8fr_.8fr_1.2fr] items-center border-b border-slate-200 py-4 text-sm">
      <div><div className="font-semibold text-[#002050]">{x.title||x.file_name||'Média'}</div><div className="mt-1 text-xs text-slate-400">{x.live_events?.title||'Événement non renseigné'}</div></div>
      <div className="text-slate-600">{String(x.media_type||'média').replaceAll('_',' ')}</div>
      <div><div>{liveStatusLabel(x.status)}</div><div className="text-xs text-slate-400">{liveStatusLabel(x.processing_status)}</div></div>
      <div className="flex justify-end gap-2">
       <button onClick={()=>decide(x.id,'approved')} className="text-sm font-semibold text-[#002050]">Approuver</button>
       <button onClick={()=>decide(x.id,'changes_requested')} className="text-sm font-semibold text-amber-700">Corrections</button>
       <button onClick={()=>decide(x.id,'rejected')} className="text-sm font-semibold text-slate-600">Refuser</button>
       <button onClick={()=>decide(x.id,'suspended')} className="text-sm font-semibold text-red-700">Suspendre</button>
      </div>
     </div>)}
    </div>
   </div>
  ):<div className="border-y border-slate-200 py-10 text-center text-sm text-slate-500">Aucun média à examiner.</div>}
 </AdminOmniaLiveShell>
}
