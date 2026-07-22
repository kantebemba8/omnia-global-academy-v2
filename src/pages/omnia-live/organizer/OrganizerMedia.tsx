import {useEffect,useMemo,useState} from 'react';
import {Link} from 'react-router-dom';
import {liveApi} from '../liveApi';
import OrganizerShell from './OrganizerShell';
import {liveStatusLabel} from '../../../lib/omniaLiveLabels';

const BLUE='#002050';
const GOLD='#BF8813';

export default function OrganizerMedia(){
 const [events,setEvents]=useState<any[]>([]),[eventId,setEventId]=useState(''),[rows,setRows]=useState<any[]>([]),[reviews,setReviews]=useState<any[]>([]),[msg,setMsg]=useState('');
 useEffect(()=>{liveApi('organizer_events').then(d=>{const items=d.items||[];setEvents(items);if(items[0])setEventId(items[0].id)}).catch(e=>setMsg(e instanceof Error?e.message:'Erreur'))},[]);
 useEffect(()=>{if(!eventId){setRows([]);setReviews([]);return}liveApi('organizer_media',{}, {event_id:eventId}).then(d=>{setRows(d.media||[]);setReviews(d.reviews||[])}).catch(e=>setMsg(e instanceof Error?e.message:'Erreur'))},[eventId]);
 const latest=useMemo(()=>{const x:any={};for(const r of reviews)if(!x[r.media_id])x[r.media_id]=r;return x},[reviews]);
 return <OrganizerShell title="Médias & Replays" subtitle="Vidéos, documents, traitements et replays rattachés à vos événements.">
  <div className="mb-6 flex flex-wrap items-end gap-3 border-b border-slate-200 pb-5">
   <label className="min-w-[300px] flex-1"><span className="mb-1 block text-sm font-semibold" style={{color:BLUE}}>Événement concerné</span><span className="mb-2 block text-xs text-slate-500">Choisissez un événement pour afficher uniquement ses vidéos, documents et replays.</span><select value={eventId} onChange={e=>setEventId(e.target.value)} disabled={!events.length} className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm disabled:bg-slate-50 disabled:text-slate-400"><option value="">{events.length?'Choisir un événement':'Aucun événement disponible'}</option>{events.map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select></label>
   {eventId&&<Link to={`/omnia-live/studio/${eventId}/upload`} className="rounded-lg bg-[#002050] px-4 py-2.5 text-sm font-bold text-white">Téléverser un média</Link>}
  </div>
  {msg&&<div className="mb-5 border-l-2 border-[#BF8813] bg-amber-50 px-4 py-3 text-sm">{msg}</div>}
  {rows.length?<div className="overflow-x-auto"><div className="min-w-[820px]"><div className="grid grid-cols-[1.4fr_.8fr_.8fr_.8fr] border-b border-slate-300 pb-3 text-xs font-semibold uppercase tracking-wide text-slate-400"><div>Média</div><div>Type</div><div>État</div><div className="text-right">Action</div></div>{rows.map(x=><div key={x.id} className="grid grid-cols-[1.4fr_.8fr_.8fr_.8fr] items-center border-b border-slate-200 py-4 text-sm"><div><div className="font-semibold" style={{color:BLUE}}>{x.title||x.file_name||'Média'}</div>{latest[x.id]&&<div className="mt-1 text-xs text-slate-500">Décision : {liveStatusLabel(latest[x.id].decision)}{latest[x.id].reason?` — ${latest[x.id].reason}`:''}</div>}</div><div className="text-slate-600">{String(x.media_type||'Média').replaceAll('_',' ')}</div><div className="font-medium" style={{color:GOLD}}>{liveStatusLabel(x.processing_status||x.status)}</div><div className="text-right">{x.processing_status!=='ready'?<Link to={`/omnia-live/media/${x.id}/processing?source=organizer`} className="font-semibold" style={{color:BLUE}}>Voir le traitement</Link>:<Link to={`/omnia-live/watch/${x.id}`} className="font-semibold" style={{color:BLUE}}>Prévisualiser</Link>}</div></div>)}</div></div>:<div className="border-y border-slate-200 py-10 text-sm text-slate-500">{eventId?'Aucun média pour cet événement.':'Choisissez un événement.'}</div>}
 </OrganizerShell>
}
