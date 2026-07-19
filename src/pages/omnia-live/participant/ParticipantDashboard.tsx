import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { liveApi } from '../liveApi';
import ParticipantShell from './ParticipantShell';

export default function ParticipantDashboard(){
 const [d,setD]=useState<any>({kpis:{},upcoming:[],active:[],notifications:[],favorites:[]}),[msg,setMsg]=useState('');
 useEffect(()=>{liveApi('participant_dashboard').then(setD).catch(e=>setMsg(e instanceof Error?e.message:'Connexion requise'))},[]);
 const k=d.kpis||{};
 const cards=[['Mes inscriptions',k.registrations],['À venir',k.upcoming],['Actifs',k.active],['Terminés',k.completed],['Achats',k.paid_orders],['Documents',k.documents],['Notifications',k.unread_notifications],['Favoris',k.favorites]];
 return <ParticipantShell title="Mon espace Omnia Live" subtitle="Vos Lives, formations, vidéos, Replays, documents et achats au même endroit.">
  {msg&&<div className="mb-4 rounded-xl bg-slate-50 p-4">{msg}</div>}
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([l,v])=><div key={l} className="rounded-2xl border bg-white p-5"><div className="text-sm text-slate-500">{l}</div><div className="mt-2 text-2xl font-black text-[#002050]">{Number(v||0)}</div></div>)}</div>
  <div className="mt-8 grid gap-6 lg:grid-cols-2"><div><div className="flex items-center justify-between"><h2 className="text-xl font-bold text-[#002050]">À venir</h2><Link to="/omnia-live/participant/mes-lives" className="text-sm font-bold text-[#002050]">Tout voir</Link></div><div className="mt-4 space-y-3">{d.upcoming.map((r:any)=><Link key={r.id} to={`/omnia-live/${r.event_id}`} className="block rounded-2xl border bg-white p-4 hover:border-[#BF8813]"><div className="font-bold">{r.live_events?.title}</div><div className="mt-1 text-sm text-slate-500">{r.live_events?.starts_at?new Date(r.live_events.starts_at).toLocaleString():'—'}</div></Link>)}{!d.upcoming.length&&<div className="rounded-2xl bg-slate-50 p-6 text-slate-500">Aucun Live à venir.</div>}</div></div>
  <div><h2 className="text-xl font-bold text-[#002050]">En cours / disponibles</h2><div className="mt-4 space-y-3">{d.active.map((r:any)=><Link key={r.id} to={`/omnia-live/${r.event_id}`} className="block rounded-2xl border bg-white p-4 hover:border-[#BF8813]"><div className="font-bold">{r.live_events?.title}</div><div className="mt-1 text-sm text-slate-500">{r.live_events?.delivery_type} · {r.live_events?.status}</div></Link>)}{!d.active.length&&<div className="rounded-2xl bg-slate-50 p-6 text-slate-500">Aucun contenu actif.</div>}</div></div></div>
  {d.favorites.length>0&&<div className="mt-8"><h2 className="text-xl font-bold text-[#002050]">Mes favoris</h2><div className="mt-4 grid gap-4 md:grid-cols-3">{d.favorites.map((x:any)=><Link key={x.id} to={`/omnia-live/${x.id}`} className="rounded-2xl border bg-white p-4"><div className="font-bold">{x.title}</div><div className="text-sm text-slate-500">{x.delivery_type}</div></Link>)}</div></div>}
 </ParticipantShell>
}
