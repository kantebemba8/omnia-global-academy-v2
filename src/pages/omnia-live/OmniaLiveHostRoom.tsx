import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import OmniaLiveLayout from '../../components/omnia-live/OmniaLiveLayout';
import { liveApi } from './liveApi';
import {omniaDialog} from '../../lib/omniaDialog';

const BLUE='#002050', GOLD='#BF8813';

export default function OmniaLiveHostRoom(){
 const {liveId}=useParams(); const navigate=useNavigate();
 const [room,setRoom]=useState<any>(null),[members,setMembers]=useState<any[]>([]),[message,setMessage]=useState(''),[loading,setLoading]=useState(true);

 async function prepare(){if(!liveId)return;try{const r=await liveApi('room_open',{method:'POST',body:JSON.stringify({event_id:liveId})});setRoom(r.room);await refresh(r.room.id)}catch(e){setMessage(e instanceof Error?e.message:'Impossible.')}finally{setLoading(false)}}
 async function refresh(roomId=room?.id){if(!roomId)return;try{const r=await liveApi('room_participants',{}, {room_id:roomId});setMembers(r.members||[]);setRoom(r.room||room)}catch{}}
 useEffect(()=>{prepare()},[liveId]);
 useEffect(()=>{if(!room?.id)return;const t=setInterval(()=>refresh(room.id),5000);return()=>clearInterval(t)},[room?.id]);

 async function start(){try{const r=await liveApi('room_start',{method:'POST',body:JSON.stringify({room_id:room.id})});setRoom(r.room);setMessage('Live démarré.')}catch(e){setMessage(e instanceof Error?e.message:'Erreur.')}}
 async function admit(userId:string){try{await liveApi('room_admit',{method:'POST',body:JSON.stringify({room_id:room.id,user_id:userId})});await refresh()}catch(e){setMessage(e instanceof Error?e.message:'Erreur.')}}
 async function remove(userId:string,block=false){try{await liveApi('room_remove_participant',{method:'POST',body:JSON.stringify({room_id:room.id,user_id:userId,block,reason:block?'Blocage par modération':'Retrait par modération'})});await refresh()}catch(e){setMessage(e instanceof Error?e.message:'Erreur.')}}
 async function end(){const r=await omniaDialog({title:'Terminer la session',message:'Voulez-vous réellement terminer cette session Live ?',confirmLabel:'Terminer',danger:true});if(!r.confirmed)return;try{await liveApi('room_end',{method:'POST',body:JSON.stringify({room_id:room.id})});setMessage('Session terminée.');await refresh()}catch(e){setMessage(e instanceof Error?e.message:'Erreur.')}}

 if(loading)return <OmniaLiveLayout><div className="mx-auto max-w-7xl px-4 py-12 text-slate-500">Préparation de la salle...</div></OmniaLiveLayout>;
 const waiting=members.filter(m=>m.access_status==='waiting'), admitted=members.filter(m=>m.access_status==='admitted');

 return <OmniaLiveLayout><section className="mx-auto max-w-7xl px-4 py-8 md:px-8">
  <div className="flex flex-wrap items-center justify-between gap-3"><div><button onClick={()=>navigate(-1)} className="text-sm font-semibold" style={{color:BLUE}}>← Retour</button><h1 className="mt-2 text-3xl font-black" style={{color:BLUE}}>Console organisateur</h1></div><div className="flex gap-2"><button onClick={start} disabled={!room||room.status==='live'} className="rounded-xl px-4 py-2 font-bold text-white disabled:opacity-50" style={{background:BLUE}}>Démarrer</button><button onClick={end} disabled={!room||room.status==='ended'} className="rounded-xl border border-red-300 px-4 py-2 font-bold text-red-700">Terminer</button></div></div>
  {message&&<div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm">{message}</div>}
  <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
   <div className="overflow-hidden rounded-3xl bg-slate-950">{room?.provider_host_url?<iframe title="Host Live" src={room.provider_host_url} allow="camera; microphone; fullscreen; display-capture; autoplay" className="h-[70vh] w-full border-0"/>:<div className="flex h-[70vh] items-center justify-center text-white">Moteur vidéo non configuré.</div>}</div>
   <aside className="space-y-5"><div className="rounded-2xl border bg-white p-4"><div className="text-xs text-slate-400">Statut</div><div className="font-bold">{room?.status||'—'}</div></div>
    <div className="rounded-2xl border bg-white p-4"><h2 className="font-bold" style={{color:BLUE}}>Salle d’attente ({waiting.length})</h2><div className="mt-3 space-y-2">{waiting.length?waiting.map(m=><div key={m.id} className="rounded-xl border p-3"><div className="font-semibold">{m.users?.full_name||m.user_id}</div><button onClick={()=>admit(m.user_id)} className="mt-2 rounded-lg px-3 py-1.5 text-xs font-bold text-white" style={{background:GOLD}}>Admettre</button></div>):<p className="text-sm text-slate-500">Personne en attente.</p>}</div></div>
    <div className="rounded-2xl border bg-white p-4"><h2 className="font-bold" style={{color:BLUE}}>Participants ({admitted.length})</h2><div className="mt-3 max-h-80 space-y-2 overflow-auto">{admitted.map(m=><div key={m.id} className="rounded-xl border p-3"><div className="font-semibold">{m.users?.full_name||m.user_id}</div><div className="text-xs text-slate-500">{m.room_role}</div>{m.room_role==='attendee'&&<div className="mt-2 flex gap-2"><button onClick={()=>remove(m.user_id,false)} className="text-xs font-semibold text-red-600">Retirer</button><button onClick={()=>remove(m.user_id,true)} className="text-xs font-semibold text-red-800">Bloquer</button></div>}</div>)}</div></div>
   </aside>
  </div>
 </section></OmniaLiveLayout>;
}