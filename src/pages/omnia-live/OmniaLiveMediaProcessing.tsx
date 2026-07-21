import {useEffect,useState} from 'react';
import {useNavigate,useParams,useSearchParams} from 'react-router-dom';
import OmniaLiveLayout from '../../components/omnia-live/OmniaLiveLayout';
import OrganizerShell from './organizer/OrganizerShell';
import {liveApi} from './liveApi';
import {liveStatusLabel} from '../../lib/omniaLiveLabels';

const BLUE='#002050';

function ProcessingContent({mediaId}:{mediaId:string}){
 const [data,setData]=useState<any>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[queuing,setQueuing]=useState(false);
 const load=()=>liveApi('processing_status',{}, {media_id:mediaId}).then(setData).catch(e=>setError(e instanceof Error?e.message:'Chargement impossible.')).finally(()=>setLoading(false));
 useEffect(()=>{load();const timer=window.setInterval(load,5000);return()=>window.clearInterval(timer)},[mediaId]);
 async function queue(){setQueuing(true);setError('');try{await liveApi('processing_queue',{method:'POST',body:JSON.stringify({media_id:mediaId})});await load()}catch(e){setError(e instanceof Error?e.message:'Impossible de lancer le traitement.')}finally{setQueuing(false)}}
 const job=data?.job,media=data?.media;

 if(loading)return <p className="py-8 text-sm text-slate-500">Chargement du traitement…</p>;
 if(error)return <div className="border-l-2 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;

 return <div className="space-y-6">
  <div className="grid gap-x-10 gap-y-5 border-b border-slate-200 pb-6 sm:grid-cols-2">
   <div><div className="text-xs font-semibold uppercase tracking-wide text-slate-400">État du média</div><div className="mt-1 text-lg font-bold" style={{color:BLUE}}>{liveStatusLabel(media?.status)}</div></div>
   <div><div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Traitement</div><div className="mt-1 text-lg font-bold" style={{color:BLUE}}>{liveStatusLabel(media?.processing_status)}</div></div>
  </div>
  {job&&<div>
   <div className="mb-2 flex justify-between text-sm"><span>{liveStatusLabel(job.status)}</span><span>{Number(job.progress_percent||0)} %</span></div>
   <div className="h-2 overflow-hidden rounded bg-slate-200"><div className="h-full" style={{width:`${job.progress_percent||0}%`,background:BLUE}}/></div>
   {job.error_message&&<div className="mt-3 text-sm text-red-600">{job.error_message}</div>}
  </div>}
  {!job&&media?.processing_status!=='ready'&&<button onClick={queue} disabled={queuing} className="rounded-lg px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50" style={{background:BLUE}}>{queuing?'Lancement…':'Lancer le traitement'}</button>}
  {media?.processing_status==='ready'&&<div className="border-l-2 border-emerald-500 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Le média est prêt pour la lecture sécurisée.</div>}
 </div>
}

export default function OmniaLiveMediaProcessing(){
 const {mediaId}=useParams();
 const navigate=useNavigate();
 const [search]=useSearchParams();
 if(!mediaId)return null;
 const content=<><button onClick={()=>navigate(-1)} className="mb-5 text-sm font-semibold" style={{color:BLUE}}>← Retour</button><ProcessingContent mediaId={mediaId}/></>;
 if(search.get('source')==='organizer'){
  return <OrganizerShell title="Traitement du média" subtitle="Suivez la préparation technique du fichier avant sa validation et sa publication.">{content}</OrganizerShell>;
 }
 return <OmniaLiveLayout><section className="mx-auto max-w-4xl px-4 py-10 md:px-8"><h1 className="mb-6 text-3xl font-black" style={{color:BLUE}}>Traitement du média</h1>{content}</section></OmniaLiveLayout>;
}
