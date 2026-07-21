import {useEffect,useMemo,useState} from 'react';
import {Link} from 'react-router-dom';
import {liveApi} from '../liveApi';
import OrganizerShell from './OrganizerShell';
import {liveStatusLabel} from '../../../lib/omniaLiveLabels';
import {omniaDialog} from '../../../lib/omniaDialog';

const BLUE='#002050';
const GOLD='#BF8813';

export default function OrganizerMedia(){
 const [events,setEvents]=useState<any[]>([]);
 const [eventId,setEventId]=useState('');
 const [rows,setRows]=useState<any[]>([]);
 const [reviews,setReviews]=useState<any[]>([]);
 const [jobs,setJobs]=useState<any[]>([]);
 const [msg,setMsg]=useState('');

 useEffect(()=>{
  liveApi('organizer_events').then(d=>{
   const items=d.items||[];
   setEvents(items);
   if(items[0])setEventId(items[0].id);
  }).catch(e=>setMsg(e instanceof Error?e.message:'Erreur'));
 },[]);

 async function load(){
  if(!eventId){setRows([]);setReviews([]);setJobs([]);return}
  try{
   const [m,j]=await Promise.all([
    liveApi('organizer_media',{}, {event_id:eventId}),
    liveApi('replay_jobs_list',{}, {event_id:eventId}),
   ]);
   setRows(m.media||[]);
   setReviews(m.reviews||[]);
   setJobs(j.jobs||[]);
  }catch(e){setMsg(e instanceof Error?e.message:'Erreur')}
 }
 useEffect(()=>{load()},[eventId]);

 const latest=useMemo(()=>{
  const out:any={};
  for(const r of reviews)if(!out[r.media_id])out[r.media_id]=r;
  return out;
 },[reviews]);

 async function prepareReplay(){
  if(!eventId)return;
  const r=await omniaDialog({
   title:'Préparer le replay',
   message:"Le replay sera créé à partir de l’enregistrement disponible pour cet événement. Une validation peut être requise avant publication.",
   confirmLabel:'Préparer le replay'
  });
  if(!r.confirmed)return;
  try{
   await liveApi('replay_job_create',{method:'POST',body:JSON.stringify({event_id:eventId})});
   setMsg('Préparation du replay lancée.');
   await load();
  }catch(e){setMsg(e instanceof Error?e.message:'Erreur')}
 }

 return <OrganizerShell title="Médias & Replays" subtitle="Gérez les vidéos, documents et replays rattachés à chacun de vos événements.">
  <div className="mb-6 flex flex-wrap items-end gap-3 border-b border-slate-200 pb-5">
   <label className="min-w-[300px] flex-1">
    <span className="mb-1 block text-sm font-semibold" style={{color:BLUE}}>Événement concerné</span>
    <span className="mb-2 block text-xs text-slate-500">Choisissez un événement pour afficher uniquement ses médias, enregistrements et replays.</span>
    <select value={eventId} onChange={e=>setEventId(e.target.value)} disabled={!events.length}
      className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm disabled:bg-slate-50 disabled:text-slate-400">
     <option value="">{events.length?'Choisir un événement':'Aucun événement disponible'}</option>
     {events.map(x=><option key={x.id} value={x.id}>{x.title}</option>)}
    </select>
   </label>
   {eventId&&<>
    <Link to={`/omnia-live/studio/${eventId}/upload`} className="rounded-lg bg-[#002050] px-4 py-2.5 text-sm font-bold text-white">Téléverser un média</Link>
    <button onClick={prepareReplay} className="rounded-lg border border-[#BF8813] px-4 py-2.5 text-sm font-bold text-[#002050]">Préparer le replay</button>
   </>}
  </div>

  {msg&&<div className="mb-5 border-l-2 border-[#BF8813] bg-amber-50 px-4 py-3 text-sm">{msg}</div>}

  <section className="border-b border-slate-200 pb-7">
   <div className="mb-4 flex items-center justify-between">
    <h2 className="text-lg font-bold" style={{color:BLUE}}>Médias de l’événement</h2>
    <span className="text-sm text-slate-400">{rows.length} élément{rows.length>1?'s':''}</span>
   </div>
   {rows.length?(
    <div className="overflow-x-auto">
     <div className="min-w-[860px]">
      <div className="grid grid-cols-[1.4fr_.8fr_.8fr_.8fr] border-b border-slate-300 pb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
       <div>Média</div><div>Type</div><div>État</div><div className="text-right">Actions</div>
      </div>
      {rows.map(x=><div key={x.id} className="grid grid-cols-[1.4fr_.8fr_.8fr_.8fr] items-center border-b border-slate-200 py-4 text-sm">
       <div>
        <div className="font-semibold" style={{color:BLUE}}>{x.title||x.file_name||'Média sans titre'}</div>
        {latest[x.id]&&<div className="mt-1 text-xs text-slate-500">Décision : {liveStatusLabel(latest[x.id].decision)}{latest[x.id].reason?` — ${latest[x.id].reason}`:''}</div>}
       </div>
       <div className="text-slate-600">{String(x.media_type||'média').replaceAll('_',' ')}</div>
       <div><span className="font-medium" style={{color:x.processing_status==='ready'?BLUE:GOLD}}>{liveStatusLabel(x.processing_status||x.status)}</span></div>
       <div className="flex justify-end gap-3">
        {x.processing_status!=='ready'&&<Link to={`/omnia-live/media/${x.id}/processing?source=organizer`} className="font-semibold" style={{color:BLUE}}>Traitement</Link>}
        {x.processing_status==='ready'&&<Link to={`/omnia-live/watch/${x.id}`} className="font-semibold" style={{color:BLUE}}>Prévisualiser</Link>}
       </div>
      </div>)}
     </div>
    </div>
   ):<div className="border-y border-slate-200 py-9 text-sm text-slate-500">{eventId?'Aucun média pour cet événement.':'Choisissez d’abord un événement.'}</div>}
  </section>

  <section className="py-7">
   <h2 className="mb-4 text-lg font-bold" style={{color:BLUE}}>Préparation des replays</h2>
   {jobs.length?(
    <div>
     <div className="grid grid-cols-[1fr_.8fr_.8fr] border-b border-slate-300 pb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
      <div>Source</div><div>Statut</div><div>Dernière mise à jour</div>
     </div>
     {jobs.map(j=><div key={j.id} className="grid grid-cols-[1fr_.8fr_.8fr] border-b border-slate-200 py-4 text-sm">
      <div>{j.session_id?'Session spécifique':'Événement complet'}</div>
      <div className="font-medium" style={{color:GOLD}}>{liveStatusLabel(j.status)}</div>
      <div className="text-slate-500">{j.updated_at?new Date(j.updated_at).toLocaleString('fr-FR'):'—'}{j.error_message&&<div className="mt-1 text-xs text-red-600">{j.error_message}</div>}</div>
     </div>)}
    </div>
   ):<div className="border-y border-slate-200 py-9 text-sm text-slate-500">Aucune préparation de replay en cours.</div>}
  </section>
 </OrganizerShell>
}
