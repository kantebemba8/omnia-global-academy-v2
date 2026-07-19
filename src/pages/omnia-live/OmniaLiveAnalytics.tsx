import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import OmniaLiveLayout from '../../components/omnia-live/OmniaLiveLayout';
import { liveApi } from './liveApi';

export default function OmniaLiveAnalytics(){
 const {liveId}=useParams();const [rows,setRows]=useState<any[]>([]),[message,setMessage]=useState('');
 async function load(){if(!liveId)return;try{await liveApi('analytics_rebuild',{method:'POST',body:JSON.stringify({event_id:liveId})});const d=await liveApi('analytics_get',{}, {event_id:liveId});setRows(d.analytics||[])}catch(e){setMessage(e instanceof Error?e.message:'Erreur')}}
 useEffect(()=>{load()},[liveId]);
 const latest=rows[rows.length-1]||{};
 const cards=[['Inscriptions',latest.registrations],['Commandes payées',latest.paid_orders],['Revenu brut',latest.gross_revenue],['Participants Live',latest.live_attendees],['Spectateurs Replay',latest.replay_viewers]];
 return <OmniaLiveLayout><section className="mx-auto max-w-6xl px-4 py-10"><h1 className="text-3xl font-black" style={{color:'#002050'}}>Statistiques Omnia Live</h1>{message&&<div className="mt-4 rounded-xl bg-slate-50 p-4">{message}</div>}<div className="mt-6 grid gap-4 md:grid-cols-3 xl:grid-cols-5">{cards.map(([l,v])=><div key={l} className="rounded-2xl border bg-white p-5"><div className="text-sm text-slate-500">{l}</div><div className="mt-1 text-2xl font-black">{Number(v||0).toFixed(l==='Revenu brut'?2:0)}</div></div>)}</div></section></OmniaLiveLayout>
}
