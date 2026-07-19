import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { liveApi } from '../liveApi';
import ParticipantShell from './ParticipantShell';

export default function ParticipantLibrary(){
 const [d,setD]=useState<any>({replays:[],training_media:[]}),[msg,setMsg]=useState('');
 useEffect(()=>{liveApi('participant_library').then(setD).catch(e=>setMsg(e instanceof Error?e.message:'Erreur'))},[]);
 const card=(x:any,media:any)=><div key={`${x.id}-${media.id}`} className="rounded-2xl border bg-white p-5"><div className="text-xs uppercase text-slate-400">{media.media_type}</div><div className="mt-1 font-bold text-[#002050]">{media.title||x.live_events?.title}</div><div className="mt-2 text-sm text-slate-500">Progression {Number(x.progress?.completion_percent||0).toFixed(0)}%</div><div className="mt-3 h-2 overflow-hidden rounded bg-slate-200"><div className="h-full bg-[#BF8813]" style={{width:`${Math.min(100,Number(x.progress?.completion_percent||0))}%`}}/></div><Link to={`/omnia-live/watch/${media.id}`} className="mt-4 inline-block rounded-lg bg-[#002050] px-4 py-2 text-sm font-bold text-white">Regarder</Link></div>;
 return <ParticipantShell title="Ma bibliothèque" subtitle="Vidéos achetées, Replays et ressources de vos formations.">{msg&&<div className="mb-4 rounded-xl bg-slate-50 p-4">{msg}</div>}<h2 className="text-xl font-bold text-[#002050]">Replays</h2><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{d.replays.map((x:any)=>card(x,x.live_media))}{!d.replays.length&&<div className="rounded-2xl bg-slate-50 p-8 text-slate-500">Aucun Replay disponible.</div>}</div><h2 className="mt-8 text-xl font-bold text-[#002050]">Ressources de formation</h2><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{d.training_media.map((m:any)=>card(m,m))}{!d.training_media.length&&<div className="rounded-2xl bg-slate-50 p-8 text-slate-500">Aucune ressource vidéo.</div>}</div></ParticipantShell>
}
