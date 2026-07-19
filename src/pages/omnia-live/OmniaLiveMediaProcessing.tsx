import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import OmniaLiveLayout from '../../components/omnia-live/OmniaLiveLayout';
import { liveApi } from './liveApi';

const BLUE='#002050';

export default function OmniaLiveMediaProcessing(){
  const {mediaId}=useParams(); const navigate=useNavigate();
  const [data,setData]=useState<any>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[queuing,setQueuing]=useState(false);

  const load=()=>liveApi('processing_status',{}, {media_id:mediaId||''}).then(setData).catch(e=>setError(e instanceof Error?e.message:'Chargement impossible.')).finally(()=>setLoading(false));
  useEffect(()=>{if(!mediaId)return;load();const t=setInterval(load,5000);return()=>clearInterval(t)},[mediaId]);

  async function queue(){if(!mediaId)return;setQueuing(true);setError('');try{await liveApi('processing_queue',{method:'POST',body:JSON.stringify({media_id:mediaId})});await load()}catch(e){setError(e instanceof Error?e.message:'Impossible de lancer le traitement.')}finally{setQueuing(false)}}

  const job=data?.job, media=data?.media;
  return <OmniaLiveLayout><section className="mx-auto max-w-3xl px-4 py-10 md:px-8">
    <button onClick={()=>navigate(-1)} className="mb-5 text-sm font-semibold" style={{color:BLUE}}>← Retour</button>
    <h1 className="text-3xl font-black" style={{color:BLUE}}>Traitement du média</h1>
    {loading?<p className="mt-6 text-slate-500">Chargement...</p>:error?<div className="mt-6 rounded-xl bg-red-50 p-4 text-red-700">{error}</div>:<div className="mt-8 space-y-5 rounded-3xl border bg-white p-6">
      <div className="grid gap-4 sm:grid-cols-2"><div className="rounded-xl bg-slate-50 p-4"><div className="text-xs text-slate-400">Média</div><div className="font-bold">{media?.status}</div></div><div className="rounded-xl bg-slate-50 p-4"><div className="text-xs text-slate-400">Traitement</div><div className="font-bold">{media?.processing_status}</div></div></div>
      {job&&<div><div className="mb-2 flex justify-between text-sm"><span>{job.status}</span><span>{Number(job.progress_percent||0)}%</span></div><div className="h-2 overflow-hidden rounded bg-slate-200"><div className="h-full" style={{width:`${job.progress_percent||0}%`,background:BLUE}}/></div>{job.error_message&&<div className="mt-3 text-sm text-red-600">{job.error_message}</div>}</div>}
      {!job&&media?.processing_status!=='ready'&&<button onClick={queue} disabled={queuing} className="rounded-xl px-5 py-3 font-bold text-white" style={{background:BLUE}}>{queuing?'Lancement...':'Lancer le traitement'}</button>}
      {media?.processing_status==='ready'&&<div className="rounded-xl bg-emerald-50 p-4 text-emerald-800">Le média est prêt pour la lecture sécurisée.</div>}
    </div>}
  </section></OmniaLiveLayout>
}
