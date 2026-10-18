import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import OmniaLiveLayout from '../../../components/omnia-live/OmniaLiveLayout';
import JaasMeetingFrame, { type JaasMeetingAccess } from '../../../components/video/JaasMeetingFrame';
import { liveApi } from '../liveApi';
import '../../../lib/omniaLiveLabels';

export default function LiveEngineRoom(){
 const {liveId}=useParams();const navigate=useNavigate();
 const [join,setJoin]=useState<any>(null),[error,setError]=useState(''),[tab,setTab]=useState<'chat'|'qa'|'polls'>('chat'),[controls,setControls]=useState<any>(null),[messages,setMessages]=useState<any[]>([]),[questions,setQuestions]=useState<any[]>([]),[polls,setPolls]=useState<any[]>([]),[text,setText]=useState('');
 const timer=useRef<number|null>(null);
 const roomId=join?.room?.id;

 async function enter(){try{const r=await liveApi('room_join',{method:'POST',body:JSON.stringify({event_id:liveId})});setJoin(r);if(r.room?.id){const c=await liveApi('room_controls_get',{}, {room_id:r.room.id});setControls(c.controls)}}catch(e){setError(e instanceof Error?e.message:'Accès impossible')}}
 async function refresh(){if(!roomId)return;try{const [c,q,p]=await Promise.all([liveApi('chat_list',{}, {room_id:roomId}),liveApi('question_list',{}, {room_id:roomId}),liveApi('poll_list',{}, {room_id:roomId})]);setMessages(c.messages||[]);setQuestions(q.questions||[]);setPolls(p.polls||[])}catch{}}
 useEffect(()=>{enter()},[liveId]);
 useEffect(()=>{if(!roomId)return;refresh();timer.current=window.setInterval(refresh,5000);return()=>{if(timer.current)window.clearInterval(timer.current);liveApi('room_leave',{method:'POST',body:JSON.stringify({room_id:roomId})}).catch(()=>{})}},[roomId]);
 async function send(){if(!text.trim()||!roomId)return;try{await liveApi('chat_send',{method:'POST',body:JSON.stringify({room_id:roomId,message:text})});setText('');await refresh()}catch(e){setError(e instanceof Error?e.message:'Erreur')}}
 async function ask(){if(!text.trim()||!roomId)return;try{await liveApi('question_create',{method:'POST',body:JSON.stringify({room_id:roomId,question:text})});setText('');await refresh()}catch(e){setError(e instanceof Error?e.message:'Erreur')}}
 async function voteQuestion(id:string){await liveApi('question_vote',{method:'POST',body:JSON.stringify({question_id:id})});await refresh()}
 async function votePoll(id:string,i:number){await liveApi('poll_vote',{method:'POST',body:JSON.stringify({poll_id:id,option_index:i})});await refresh()}
 const jaasMeeting=useMemo<JaasMeetingAccess|null>(()=>join?.provider?.type==='jaas'?join.provider as JaasMeetingAccess:null,[join]);
 const joinUrl=useMemo(()=>join?.provider?.join_url||join?.room?.provider_join_url||'', [join]);

 if(error)return <OmniaLiveLayout><div className="mx-auto max-w-5xl px-4 py-10"><div className="rounded-2xl bg-red-50 p-6 text-red-700">{error}</div></div></OmniaLiveLayout>;
 if(!join)return <OmniaLiveLayout><div className="mx-auto max-w-5xl px-4 py-10">Connexion à la salle...</div></OmniaLiveLayout>;
 if(join.waiting)return <OmniaLiveLayout><div className="mx-auto flex min-h-[65vh] max-w-3xl items-center justify-center px-4 text-center"><div><div className="text-5xl">⏳</div><h1 className="mt-4 text-2xl font-black text-[#002050]">Salle d’attente</h1><p className="mt-2 text-slate-600">L’organisateur doit vous admettre avant l’entrée.</p></div></div></OmniaLiveLayout>;

 return <OmniaLiveLayout><section className="mx-auto max-w-[1600px] px-3 py-5 md:px-6"><div className="mb-4 flex justify-between"><button onClick={()=>navigate(-1)} className="font-semibold text-[#002050]">← Quitter</button><span className="font-bold text-[#002050]">OMNIA LIVE</span></div><div className="grid gap-4 xl:grid-cols-[1fr_380px]">
 <div className="overflow-hidden rounded-3xl bg-black">{jaasMeeting?<JaasMeetingFrame meeting={jaasMeeting}/>:joinUrl?<iframe title="Omnia Live — mode de développement" src={joinUrl} allow="camera; microphone; fullscreen; display-capture; autoplay" className="h-[76vh] w-full border-0"/>:<div className="flex h-[76vh] items-center justify-center text-white">Moteur vidéo sécurisé non configuré.</div>}</div>
 <aside className="overflow-hidden rounded-3xl border bg-white"><div className="flex border-b">{[['chat','Chat'],['qa','Q&A'],['polls','Sondages']].map(([k,l])=><button key={k} onClick={()=>setTab(k as any)} className={`flex-1 px-3 py-3 text-sm font-bold ${tab===k?'border-b-2 border-[#BF8813] text-[#002050]':'text-slate-500'}`}>{l}</button>)}</div>
 <div className="h-[58vh] overflow-auto p-4">
 {tab==='chat'&&<div className="space-y-3">{messages.map(m=><div key={m.id} className="rounded-xl bg-slate-50 p-3"><div className="text-xs font-bold text-[#002050]">{m.users?.full_name||'Participant'}</div><div className="mt-1 text-sm">{m.message}</div></div>)}</div>}
 {tab==='qa'&&<div className="space-y-3">{questions.map(q=><div key={q.id} className="rounded-xl border p-3"><div className="text-sm font-semibold">{q.question}</div><div className="mt-2 flex items-center justify-between"><button onClick={()=>voteQuestion(q.id)} className="text-xs font-bold text-[#002050]">▲ {q.upvotes}</button><span className="text-xs text-slate-400">{q.status}</span></div>{q.answer_text&&<div className="mt-2 rounded-lg bg-slate-50 p-2 text-sm">{q.answer_text}</div>}</div>)}</div>}
 {tab==='polls'&&<div className="space-y-4">{polls.filter(p=>p.status!=='draft').map(p=><div key={p.id} className="rounded-xl border p-3"><div className="font-semibold">{p.question}</div><div className="mt-3 space-y-2">{(p.options||[]).map((o:string,i:number)=><button key={i} disabled={p.status!=='open'} onClick={()=>votePoll(p.id,i)} className="flex w-full justify-between rounded-lg border px-3 py-2 text-left text-sm disabled:opacity-60"><span>{o}</span><span>{p.vote_counts?.[i]||0}</span></button>)}</div></div>)}</div>}
 </div>
 {(tab==='chat'&&controls?.chat_enabled!==false||tab==='qa'&&controls?.qa_enabled!==false)&&<div className="border-t p-3"><div className="flex gap-2"><input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&(tab==='chat'?send():ask())} className="flex-1 rounded-xl border px-3 py-2" placeholder={tab==='chat'?'Votre message':'Votre question'}/><button onClick={tab==='chat'?send:ask} className="rounded-xl bg-[#002050] px-4 py-2 font-bold text-white">Envoyer</button></div></div>}
 </aside></div></section></OmniaLiveLayout>
}
