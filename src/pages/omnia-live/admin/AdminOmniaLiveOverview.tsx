import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { liveApi } from '../liveApi';
import AdminOmniaLiveShell from './AdminOmniaLiveShell';

export default function AdminOmniaLiveOverview(){
 const [k,setK]=useState<any>({}),[error,setError]=useState('');
 useEffect(()=>{liveApi('admin_dashboard').then(d=>setK(d.kpis||{})).catch(e=>setError(e instanceof Error?e.message:'Erreur'))},[]);
 const cards=[['Événements',k.total_events],['À valider',(k.submitted||0)+(k.under_review||0)],['Publiés',k.published],['En direct',k.live_now],['Inscriptions',k.registrations],['Commandes payées',k.paid_orders],['CA brut',k.gross_revenue],['Remboursements',k.refunds_pending],['Annulations',k.cancellations_pending],['Médias en traitement',k.media_processing],['Signalements',k.reports_open],['Salles actives',k.live_rooms_active]];
 return <AdminOmniaLiveShell title="Omnia Live — Supervision" subtitle="Centre de contrôle global de l’écosystème Omnia Live.">
  <div className="mb-6 flex justify-end"><Link to="/admin/omnia-live/creer" className="rounded-xl bg-[#002050] px-5 py-3 font-bold text-white">+ Créer un Live</Link></div>
  {error&&<div className="rounded-xl bg-red-50 p-4 text-red-700">{error}</div>}
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([l,v])=><div key={l} className="rounded-2xl border bg-white p-5 shadow-sm"><div className="text-sm text-slate-500">{l}</div><div className="mt-2 text-2xl font-black text-[#002050]">{typeof v==='number'?v.toLocaleString():Number(v||0).toLocaleString()}</div></div>)}</div>
  <div className="mt-7 grid gap-4 md:grid-cols-3">
   <Link to="/admin/omnia-live/validation" className="rounded-2xl border bg-white p-5 hover:border-[#BF8813]"><div className="font-bold text-[#002050]">File de validation</div><p className="mt-1 text-sm text-slate-500">Examiner les soumissions, conditions et publication.</p></Link>
   <Link to="/admin/omnia-live/operations" className="rounded-2xl border bg-white p-5 hover:border-[#BF8813]"><div className="font-bold text-[#002050]">Opérations</div><p className="mt-1 text-sm text-slate-500">Remboursements, annulations, salles et présence.</p></Link>
   <Link to="/admin/omnia-live/finance" className="rounded-2xl border bg-white p-5 hover:border-[#BF8813]"><div className="font-bold text-[#002050]">Finance</div><p className="mt-1 text-sm text-slate-500">Ventes, commissions, parts organisateurs et payouts.</p></Link>
  </div>
 </AdminOmniaLiveShell>
}
