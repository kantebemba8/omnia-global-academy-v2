import {useEffect,useState} from 'react';
import OmniaLiveLayout from '../../../components/omnia-live/OmniaLiveLayout';
import {liveApi} from '../liveApi';

const BLUE='#002050';
export default function StructureOmniaLiveReports(){
 const [d,setD]=useState<any>({}),[msg,setMsg]=useState('');
 useEffect(()=>{liveApi('analytics_structure_overview').then(setD).catch(e=>setMsg(e instanceof Error?e.message:'Erreur'))},[]);
 async function exportXlsx(){try{await liveApi('report_export_request',{method:'POST',body:JSON.stringify({report_key:'structure_activity',format:'xlsx'})});setMsg('Rapport Structure demandé.')}catch(e){setMsg(e instanceof Error?e.message:'Erreur')}}
 const rows=[
  ['Membres',d.members],['Événements',d.events],['Inscriptions',d.registrations],
  ['Présence moyenne',`${Number(d.attendance_rate||0).toFixed(1)} %`],['Documents',d.documents],
  ['Chiffre d’affaires',d.revenue],['Replays vus',d.replay_views],['Heures suivies',d.learning_hours]
 ];
 return <OmniaLiveLayout><section className="mx-auto max-w-7xl px-4 py-10">
  <div className="flex flex-wrap justify-between gap-3 border-b border-slate-200 pb-5"><div><h1 className="text-3xl font-black" style={{color:BLUE}}>Rapports Structure — Omnia Live</h1><p className="mt-2 text-slate-600">Activité de vos membres et événements Omnia Live.</p></div><button onClick={exportXlsx} className="rounded-lg bg-[#002050] px-4 py-2.5 text-sm font-bold text-white">Exporter Excel</button></div>
  {msg&&<div className="mt-5 border-l-2 border-[#BF8813] bg-amber-50 px-4 py-3 text-sm">{msg}</div>}
  <div className="mt-7 grid grid-cols-2 gap-x-10 gap-y-5 md:grid-cols-4">
   {rows.map(([l,v])=><div key={String(l)} className="border-b border-slate-200 pb-4"><div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{l}</div><div className="mt-1 text-xl font-bold" style={{color:BLUE}}>{typeof v==='number'?v.toLocaleString('fr-FR'):v||0}</div></div>)}
  </div>
 </section></OmniaLiveLayout>
}
