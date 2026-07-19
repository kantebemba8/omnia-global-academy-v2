import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import OmniaLiveLayout from '../../components/omnia-live/OmniaLiveLayout';
import { liveApi } from './liveApi';

const BLUE='#002050';

export default function OmniaLiveWatch(){
  const {mediaId}=useParams(); const navigate=useNavigate(); const videoRef=useRef<HTMLVideoElement|null>(null);
  const [loading,setLoading]=useState(true),[auth,setAuth]=useState<any>(null),[error,setError]=useState(''),[audioOnly,setAudioOnly]=useState(false);

  useEffect(()=>{if(!mediaId)return;liveApi('playback_authorize',{method:'POST',body:JSON.stringify({media_id:mediaId})}).then(setAuth).catch(e=>setError(e instanceof Error?e.message:'Accès impossible.')).finally(()=>setLoading(false));},[mediaId]);

  return <OmniaLiveLayout><section className="mx-auto max-w-7xl px-4 py-8 md:px-8">
    <button onClick={()=>navigate(-1)} className="mb-4 text-sm font-semibold" style={{color:BLUE}}>← Retour</button>
    {loading?<div className="rounded-2xl bg-slate-950 p-12 text-center text-white">Préparation du lecteur...</div>:error?<div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">{error}</div>:<div className="overflow-hidden rounded-3xl bg-black shadow-xl">
      <div className="relative aspect-video bg-black">
        {audioOnly&&auth?.audio_url?<audio controls autoPlay src={auth.audio_url} className="absolute inset-x-6 top-1/2 w-[calc(100%-3rem)] -translate-y-1/2"/>:
        <video ref={videoRef} controls playsInline src={auth?.video_url} className={audioOnly?'hidden':'h-full w-full bg-black object-contain'}/>}
        {audioOnly&&!auth?.audio_url&&<div className="flex h-full items-center justify-center text-center text-white"><div><div className="text-5xl">🎧</div><div className="mt-4 font-bold">Piste audio indisponible</div><div className="mt-2 text-sm text-slate-400">Le traitement audio n’est pas encore terminé.</div></div></div>}
        {auth?.watermark&&<div className="pointer-events-none absolute right-5 top-5 rounded bg-black/40 px-3 py-1 text-xs text-white/70">{auth.watermark}</div>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 text-white"><div className="text-xs text-slate-400">Lecture sécurisée Omnia</div><button onClick={()=>setAudioOnly(x=>!x)} className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold">{audioOnly?'Afficher la vidéo':'🎧 Audio uniquement'}</button></div>
    </div>}
  </section></OmniaLiveLayout>
}
