import {useEffect,useState} from 'react';
import {liveApi} from '../liveApi';
import OrganizerShell from './OrganizerShell';
import {omniaDialog} from '../../../lib/omniaDialog';

export default function OrganizerAccessCodes(){
 const [events,setEvents]=useState<any[]>([]);
 const [eventId,setEventId]=useState('');
 const [codes,setCodes]=useState<any[]>([]);
 const [msg,setMsg]=useState('');

 useEffect(()=>{
  liveApi('organizer_events').then(d=>{
   const rows=d.items||[];
   setEvents(rows);
   if(rows[0])setEventId(rows[0].id);
  }).catch(e=>setMsg(e instanceof Error?e.message:'Erreur'));
 },[]);

 async function load(id=eventId){
  if(!id){setCodes([]);return}
  try{
   const d=await liveApi('organizer_access_codes',{}, {event_id:id});
   setCodes(d.codes||[]);
  }catch(e){setMsg(e instanceof Error?e.message:'Erreur')}
 }
 useEffect(()=>{load()},[eventId]);

 async function createCode(){
  if(!eventId)return;
  const r=await omniaDialog({
   title:'Créer un code privé',
   message:'Ce code donnera accès à l’événement sélectionné selon ses règles d’accès.',
   confirmLabel:'Créer le code'
  });
  if(!r.confirmed)return;
  try{
   await liveApi('private_code_create',{method:'POST',body:JSON.stringify({event_id:eventId,access_type:'private'})});
   setMsg('Code privé créé.');
   await load();
  }catch(e){setMsg(e instanceof Error?e.message:'Erreur')}
 }

 return <OrganizerShell title="Codes privés" subtitle="Créez et suivez les codes d’accès réservés à vos événements privés.">
  <div className="mb-6 flex flex-wrap items-end gap-3 border-b border-slate-200 pb-5">
   <label className="min-w-[280px]">
    <span className="mb-1 block text-sm font-semibold text-[#002050]">Événement</span>
    <select value={eventId} onChange={e=>setEventId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm">
     <option value="">Choisir un événement</option>
     {events.map(e=><option key={e.id} value={e.id}>{e.title}</option>)}
    </select>
   </label>
   <button onClick={createCode} disabled={!eventId} className="rounded-lg bg-[#002050] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">
    Créer un code privé
   </button>
  </div>
  {msg&&<div className="mb-5 border-l-2 border-[#BF8813] bg-amber-50 px-4 py-3 text-sm">{msg}</div>}
  {codes.length?(
   <div className="overflow-x-auto">
    <div className="min-w-[680px]">
     <div className="grid grid-cols-[1fr_.7fr_.7fr] border-b border-slate-300 pb-3 text-xs font-semibold uppercase text-slate-400">
      <div>Code</div><div>Utilisations</div><div>État</div>
     </div>
     {codes.map(c=><div key={c.id} className="grid grid-cols-[1fr_.7fr_.7fr] border-b border-slate-200 py-4 text-sm">
      <div className="font-mono font-semibold text-[#002050]">{c.code}</div>
      <div>{c.uses_count??c.used_count??0}{c.max_uses?` / ${c.max_uses}`:''}</div>
      <div>{c.is_active===false?'Désactivé':'Actif'}</div>
     </div>)}
    </div>
   </div>
  ):<div className="border-y border-slate-200 py-10 text-sm text-slate-500">Aucun code privé pour cet événement.</div>}
 </OrganizerShell>
}
