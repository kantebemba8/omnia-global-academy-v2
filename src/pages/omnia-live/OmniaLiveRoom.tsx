import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import OmniaLiveLayout from '../../components/omnia-live/OmniaLiveLayout';
import { liveApi } from './liveApi';

const BLUE='#002050', GOLD='#BF8813';

export default function OmniaLiveRoom(){
  const {liveId}=useParams(); const navigate=useNavigate();
  const [loading,setLoading]=useState(true),[joining,setJoining]=useState(false),[data,setData]=useState<any>(null),[error,setError]=useState(''),[waiting,setWaiting]=useState(false),[audioOnly,setAudioOnly]=useState(false);
  const heartbeat=useRef<number|null>(null);

  async function join(){
    if(!liveId)return;setJoining(true);setError('');
    try{
      const r=await liveApi('room_join',{method:'POST',body:JSON.stringify({event_id:liveId})});
      setData(r);setWaiting(Boolean(r.waiting));
      if(!r.waiting&&r.room?.id) startHeartbeat(r.room.id);
    }catch(e){setError(e instanceof Error?e.message:'Accès impossible.')}finally{setJoining(false);setLoading(false)}
  }

  function startHeartbeat(roomId:string){
    if(heartbeat.current)window.clearInterval(heartbeat.current);
    heartbeat.current=window.setInterval(async()=>{
      try{
        const r=await liveApi('room_heartbeat',{method:'POST',body:JSON.stringify({room_id:roomId})});
        if(r.access_status==='admitted'&&waiting){setWaiting(false);const rr=await liveApi('room_join',{method:'POST',body:JSON.stringify({event_id:liveId})});setData(rr);}
        if(['removed','blocked','left'].includes(r.access_status)){setError('Votre accès à la salle a été fermé.');if(heartbeat.current)window.clearInterval(heartbeat.current);}
      }catch{}
    },15000);
  }

  useEffect(()=>{join();return()=>{if(heartbeat.current)window.clearInterval(heartbeat.current);if(data?.room?.id)liveApi('room_leave',{method:'POST',body:JSON.stringify({room_id:data.room.id})}).catch(()=>{})}},[]);

  const joinUrl=useMemo(()=>data?.provider?.join_url||data?.room?.provider_join_url||'', [data]);

  if(loading)return <OmniaLiveLayout><div className="mx-auto max-w-7xl px-4 py-12 text-slate-500">Connexion à la salle...</div></OmniaLiveLayout>;

  return <OmniaLiveLayout><section className="mx-auto max-w-[1600px] px-3 py-5 md:px-6">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><button onClick={()=>navigate(-1)} className="text-sm font-semibold" style={{color:BLUE}}>← Quitter la salle</button><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-red-500"/><span className="text-sm font-bold" style={{color:BLUE}}>OMNIA LIVE</span></div></div>
    {error?<div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">{error}</div>:waiting?<div className="flex min-h-[60vh] items-center justify-center rounded-3xl border bg-white p-8 text-center"><div><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-3xl">⏳</div><h1 className="mt-5 text-2xl font-black" style={{color:BLUE}}>Salle d’attente</h1><p className="mt-2 text-slate-600">L’organisateur va vous autoriser à rejoindre la session.</p></div></div>:<div className="overflow-hidden rounded-3xl bg-slate-950 shadow-xl">
      <div className="relative min-h-[72vh]">
        {audioOnly?<div className="flex min-h-[72vh] items-center justify-center text-center text-white"><div><div className="text-6xl">🎧</div><h2 className="mt-4 text-xl font-bold">Mode audio uniquement</h2><p className="mt-2 text-sm text-slate-400">L’image est désactivée dans l’interface pour réduire votre consommation de données.</p>{joinUrl&&<a href={joinUrl} target="_blank" rel="noreferrer" className="mt-5 inline-block rounded-xl border border-white/20 px-4 py-2 text-sm">Ouvrir le flux audio/vidéo</a>}</div></div>:
        joinUrl?<iframe title="Omnia Live Room" src={joinUrl} allow="camera; microphone; fullscreen; display-capture; autoplay" className="h-[72vh] w-full border-0" />:<div className="flex min-h-[72vh] items-center justify-center text-white">Moteur vidéo non configuré.</div>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 p-4 text-white"><div className="text-xs text-slate-400">Salle intégrée Omnia · {data?.member?.room_role}</div><button onClick={()=>setAudioOnly(x=>!x)} className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold">{audioOnly?'Afficher la vidéo':'🎧 Audio uniquement'}</button></div>
    </div>}
  </section></OmniaLiveLayout>;
}
