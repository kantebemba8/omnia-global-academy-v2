import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { liveApi } from '../liveApi';
import ParticipantShell from './ParticipantShell';

export default function ParticipantMyLives(){
 const [regs,setRegs]=useState<any[]>([]),[msg,setMsg]=useState('');
 useEffect(()=>{liveApi('participant_library').then(d=>setRegs(d.registrations||[])).catch(e=>setMsg(e instanceof Error?e.message:'Erreur'))},[]);
 const groups:any={upcoming:[],live:[],completed:[],other:[]};
 for(const r of regs){const e=r.live_events||{};if(e.status==='live')groups.live.push(r);else if(e.status==='completed')groups.completed.push(r);else if(e.starts_at&&new Date(e.starts_at)>new Date())groups.upcoming.push(r);else groups.other.push(r)}
 const section=(title:string,rows:any[])=><div className="mt-7"><h2 className="text-xl font-bold text-[#002050]">{title}</h2><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{rows.map(r=><div key={r.id} className="rounded-2xl border bg-white p-5"><div className="font-bold text-[#002050]">{r.live_events?.title}</div><div className="mt-2 text-sm text-slate-500">{r.live_events?.delivery_type} · {r.status}</div><div className="mt-4 flex flex-wrap gap-2"><Link to={`/omnia-live/${r.event_id}`} className="rounded-lg border px-3 py-2 text-sm font-semibold">Voir</Link>{r.live_events?.status==='live'&&<Link to={`/omnia-live/${r.event_id}/salle`} className="rounded-lg bg-[#002050] px-3 py-2 text-sm font-bold text-white">Rejoindre</Link>}{r.live_events?.status==='completed'&&<Link to={`/omnia-live/${r.event_id}/avis`} className="rounded-lg border px-3 py-2 text-sm">Donner un avis</Link>}</div></div>)}</div></div>;
 return <ParticipantShell title="Mes Lives" subtitle="Vos inscriptions, classes synchrones et événements.">{msg&&<div className="rounded-xl bg-slate-50 p-4">{msg}</div>}{section('En direct',groups.live)}{section('À venir',groups.upcoming)}{section('Terminés',groups.completed)}{section('Autres',groups.other)}</ParticipantShell>
}
