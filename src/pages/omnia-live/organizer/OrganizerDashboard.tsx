import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { liveApi } from '../liveApi';
import OrganizerShell from './OrganizerShell';

export default function OrganizerDashboard(){
 const [k,setK]=useState<any>({}),[recent,setRecent]=useState<any[]>([]),[err,setErr]=useState('');
 useEffect(()=>{liveApi('organizer_dashboard').then(d=>{setK(d.kpis||{});setRecent(d.recent_events||[])}).catch(e=>setErr(e instanceof Error?e.message:'Erreur'))},[]);
 const cards=[['Événements',k.total_events],['En validation',k.pending_review],['Publiés',k.published],['En direct',k.live_now],['Inscriptions',k.registrations],['Commandes payées',k.paid_orders],['Revenu organisateur',k.organizer_revenue],['Disponible payout',k.available_payout],['Note moyenne',Number(k.average_rating||0).toFixed(1)]];
 return <OrganizerShell title="Espace Organisateur" subtitle="Pilotez vos Lives, formations synchrones et vidéos depuis un seul espace.">
  {err&&<div className="mb-4 rounded-xl bg-red-50 p-4 text-red-700">{err}</div>}
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">{cards.map(([l,v])=><div key={l} className="rounded-2xl border bg-white p-5"><div className="text-sm text-slate-500">{l}</div><div className="mt-2 text-2xl font-black text-[#002050]">{typeof v==='number'?v.toLocaleString():v||0}</div></div>)}</div>
  <div className="mt-7 flex flex-wrap gap-3"><Link to="/omnia-live/proposer" className="rounded-xl bg-[#002050] px-5 py-3 font-bold text-white">Créer un contenu</Link><Link to="/omnia-live/organisateur/evenements" className="rounded-xl border px-5 py-3 font-bold text-[#002050]">Gérer mes événements</Link></div>
  <div className="mt-8"><h2 className="text-xl font-bold text-[#002050]">Activité récente</h2><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{recent.map(x=><Link key={x.id} to={`/omnia-live/organisateur/evenements/${x.id}`} className="rounded-2xl border bg-white p-5 hover:border-[#BF8813]"><div className="text-xs uppercase text-slate-400">{x.status}</div><div className="mt-1 font-bold text-[#002050]">{x.title}</div><div className="mt-2 text-sm text-slate-500">{x.delivery_type}</div></Link>)}{!recent.length&&<div className="rounded-2xl bg-slate-50 p-8 text-slate-500">Aucun événement.</div>}</div></div>
 </OrganizerShell>
}
