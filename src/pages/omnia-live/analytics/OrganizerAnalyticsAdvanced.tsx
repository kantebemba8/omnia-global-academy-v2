import {useEffect,useState} from 'react';
import OrganizerShell from '../organizer/OrganizerShell';
import {liveApi} from '../liveApi';

const BLUE='#002050';
const GOLD='#BF8813';

export default function OrganizerAnalyticsAdvanced(){
 const [events,setEvents]=useState<any[]>([]),[eventId,setEventId]=useState(''),[k,setK]=useState<any>({}),[history,setHistory]=useState<any[]>([]),[msg,setMsg]=useState('');
 useEffect(()=>{liveApi('organizer_events').then(r=>{const x=r.items||[];setEvents(x);if(x[0])setEventId(x[0].id)}).catch(e=>setMsg(e instanceof Error?e.message:'Erreur'))},[]);
 async function load(){if(!eventId)return;try{const [a,h]=await Promise.all([liveApi('analytics_event_kpis',{}, {event_id:eventId}),liveApi('analytics_event_history',{}, {event_id:eventId})]);setK(a.kpis||{});setHistory(h.snapshots||[])}catch(e){setMsg(e instanceof Error?e.message:'Erreur')}}
 useEffect(()=>{load()},[eventId]);
 async function exportReport(format:string){try{await liveApi('report_export_request',{method:'POST',body:JSON.stringify({report_key:'event_performance_standard',event_id:eventId,format})});setMsg(`Export ${format.toUpperCase()} demandé.`)}catch(e){setMsg(e instanceof Error?e.message:'Erreur')}}

 const metrics=[['Inscriptions',k.registrations_confirmed],['Présence',`${Number(k.attendance_rate||0).toFixed(1)} %`],['CA Live',k.live_revenue],['CA Replay',k.replay_revenue],['Part organisateur',k.organizer_revenue],['Spectateurs Replay',k.replay_unique_viewers],['Note moyenne',Number(k.average_rating||0).toFixed(1)],['Certificats',k.certificates_issued]];

 return <OrganizerShell title="Analytics avancés" subtitle="Performance commerciale, pédagogique et engagement par événement.">
  <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
   <label className="min-w-[300px]"><span className="mb-1 block text-sm font-semibold" style={{color:BLUE}}>Événement</span><select value={eventId} onChange={e=>setEventId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm"><option value="">Choisir un événement</option>{events.map(e=><option key={e.id} value={e.id}>{e.title}</option>)}</select></label>
   <div className="flex gap-2"><button onClick={()=>exportReport('csv')} disabled={!eventId} className="rounded-lg border px-3 py-2 text-sm font-semibold">CSV</button><button onClick={()=>exportReport('xlsx')} disabled={!eventId} className="rounded-lg border px-3 py-2 text-sm font-semibold">Excel</button><button onClick={()=>exportReport('pdf')} disabled={!eventId} className="rounded-lg bg-[#002050] px-3 py-2 text-sm font-bold text-white disabled:opacity-40">PDF</button></div>
  </div>
  {msg&&<div className="mt-5 border-l-2 border-[#BF8813] bg-amber-50 px-4 py-3 text-sm">{msg}</div>}
  <section className="border-b border-slate-200 py-7"><div className="grid grid-cols-2 gap-x-8 gap-y-5 md:grid-cols-4">{metrics.map(([l,v])=><div key={String(l)} className="border-b border-slate-200 pb-4"><div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{l}</div><div className="mt-1 text-xl font-bold" style={{color:String(l).includes('CA')||l==='Part organisateur'?GOLD:BLUE}}>{typeof v==='number'?v.toLocaleString('fr-FR'):v||0}</div></div>)}</div></section>
  <section className="grid gap-8 border-b border-slate-200 py-7 md:grid-cols-2">
   <div><h2 className="mb-3 text-lg font-bold" style={{color:BLUE}}>Engagement</h2>{[['Messages chat',k.chat_messages],['Questions',k.questions_total],['Questions répondues',k.questions_answered],['Votes aux sondages',k.poll_votes]].map(([l,v])=><div key={String(l)} className="flex justify-between border-b border-slate-200 py-3 text-sm"><span>{l}</span><b>{Number(v||0)}</b></div>)}</div>
   <div><h2 className="mb-3 text-lg font-bold" style={{color:BLUE}}>Conversion & complétion</h2><div className="flex justify-between border-b border-slate-200 py-3 text-sm"><span>Taux de conversion</span><b>{Number(k.conversion_rate||0).toFixed(1)} %</b></div><div className="flex justify-between border-b border-slate-200 py-3 text-sm"><span>Taux de complétion</span><b>{Number(k.completion_rate||0).toFixed(1)} %</b></div></div>
  </section>
  <section className="py-7"><h2 className="mb-4 text-lg font-bold" style={{color:BLUE}}>Historique</h2>{history.length?<div className="overflow-x-auto"><div className="min-w-[760px]"><div className="grid grid-cols-[1fr_.8fr_.8fr_.8fr_.8fr] border-b border-slate-300 pb-3 text-xs font-semibold uppercase tracking-wide text-slate-400"><div>Date</div><div>Type</div><div>Inscriptions</div><div>Présence</div><div>Revenu</div></div>{history.map(h=><div key={h.id} className="grid grid-cols-[1fr_.8fr_.8fr_.8fr_.8fr] border-b border-slate-200 py-4 text-sm"><div>{h.snapshot_date}</div><div>{String(h.snapshot_type||'').replaceAll('_',' ')}</div><div>{h.metrics?.registrations||0}</div><div>{h.metrics?.attendance_rate||0} %</div><div>{h.metrics?.gross_revenue||0}</div></div>)}</div></div>:<div className="border-y border-slate-200 py-9 text-sm text-slate-500">Aucun historique disponible.</div>}</section>
 </OrganizerShell>
}
