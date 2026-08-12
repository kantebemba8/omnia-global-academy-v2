import {useEffect,useState} from 'react';
import {liveApi} from '../liveApi';
import AdminOmniaLiveShell from './AdminOmniaLiveShell';

const BLUE='#002050';
const GOLD='#6556B5';
const DELIVERY:any={single_live:'Live unique',synchronous_training:'Formation synchrone',recorded_video:'Vidéo préenregistrée'};

export default function AdminOmniaLiveAnalytics(){
 const [d,setD]=useState<any>({}),[msg,setMsg]=useState('');
 useEffect(()=>{liveApi('analytics_platform_overview').then(setD).catch(e=>setMsg(e instanceof Error?e.message:'Erreur'))},[]);
 async function exportReport(format:string){try{await liveApi('report_export_request',{method:'POST',body:JSON.stringify({report_key:'financial_platform',format})});setMsg(`Rapport ${format.toUpperCase()} demandé.`)}catch(e){setMsg(e instanceof Error?e.message:'Erreur')}}

 const metrics=[
  ['Événements',d.total_events],['Inscriptions',d.registrations],['Participants uniques',d.unique_attendees],
  ['CA brut',d.gross_revenue],['Remboursements',d.refunds],['Revenu OGA',d.oga_revenue],
  ['Part organisateurs',d.organizer_revenue],['Replays vus',d.replay_views],['Documents émis',d.documents_issued],
  ['Note moyenne',Number(d.average_rating||0).toFixed(1)]
 ];

 return <AdminOmniaLiveShell title="Analytics Omnia Live" subtitle="Pilotage global fondé sur les données réelles des événements, ventes, présences et replays.">
  <div className="mb-5 flex justify-end gap-2"><button onClick={()=>exportReport('xlsx')} className="rounded-lg border px-3 py-2 text-sm font-semibold">Excel</button><button onClick={()=>exportReport('pdf')} className="rounded-lg bg-[#002050] px-3 py-2 text-sm font-bold text-white">PDF</button></div>
  {msg&&<div className="mb-5 border-l-2 border-[#6556B5] bg-amber-50 px-4 py-3 text-sm">{msg}</div>}

  <section className="border-b border-slate-200 pb-7">
   <div className="grid grid-cols-2 gap-x-8 gap-y-5 md:grid-cols-5">
    {metrics.map(([l,v])=><div key={String(l)} className="border-b border-slate-200 pb-4"><div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{l}</div><div className="mt-1 text-xl font-bold" style={{color:String(l).includes('OGA')?GOLD:BLUE}}>{typeof v==='number'?v.toLocaleString('fr-FR'):v||0}</div></div>)}
   </div>
  </section>

  <section className="grid gap-8 border-b border-slate-200 py-7 lg:grid-cols-3">
   <div><h2 className="mb-4 text-lg font-bold" style={{color:BLUE}}>Formats</h2>{Object.entries(d.by_delivery_type||{}).length?Object.entries(d.by_delivery_type||{}).map(([k,v])=><div key={k} className="flex justify-between border-b border-slate-200 py-3 text-sm"><span>{DELIVERY[k]||k}</span><b>{Number(v)}</b></div>):<div className="text-sm text-slate-500">Aucune donnée.</div>}</div>
   <div><h2 className="mb-4 text-lg font-bold" style={{color:BLUE}}>Top événements</h2>{(d.top_events||[]).length?(d.top_events||[]).map((e:any)=><div key={e.event_id} className="border-b border-slate-200 py-3"><div className="text-sm font-semibold">{e.title}</div><div className="mt-1 text-xs text-slate-500">{Number(e.registrations||0).toLocaleString('fr-FR')} inscriptions · {Number(e.gross_revenue||0).toLocaleString('fr-FR')} de revenu</div></div>):<div className="text-sm text-slate-500">Aucune donnée.</div>}</div>
   <div><h2 className="mb-4 text-lg font-bold" style={{color:BLUE}}>Top organisateurs</h2>{(d.top_organizers||[]).length?(d.top_organizers||[]).map((o:any)=><div key={o.user_id} className="border-b border-slate-200 py-3"><div className="text-sm font-semibold">{o.name||'Organisateur'}</div><div className="mt-1 text-xs text-slate-500">{Number(o.events||0)} événements · {Number(o.revenue||0).toLocaleString('fr-FR')} de revenu</div></div>):<div className="text-sm text-slate-500">Aucune donnée.</div>}</div>
  </section>

  <p className="pt-6 text-xs text-slate-500">Les indicateurs doivent être reconstruits à partir des tables métier. Aucun KPI ne doit être simulé côté interface.</p>
 </AdminOmniaLiveShell>
}
