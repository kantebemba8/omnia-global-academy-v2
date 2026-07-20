import { useEffect,useState } from 'react';
import OmniaLiveLayout from '../../../components/omnia-live/OmniaLiveLayout';
import { liveApi } from '../liveApi';

export default function StructureOmniaLiveReports(){
 const [d,setD]=useState<any>({}),[msg,setMsg]=useState('');
 useEffect(()=>{liveApi('analytics_structure_overview').then(setD).catch(e=>setMsg(e instanceof Error?e.message:'Erreur'))},[]);
 async function exportXlsx(){try{await liveApi('report_export_request',{method:'POST',body:JSON.stringify({report_key:'structure_activity',format:'xlsx'})});setMsg('Rapport Structure demandé.')}catch(e){setMsg(e instanceof Error?e.message:'Erreur')}}
 return <OmniaLiveLayout><section className="mx-auto max-w-7xl px-4 py-10"><div className="flex flex-wrap justify-between gap-3"><div><h1 className="text-3xl font-black text-[#002050]">Rapports Structure — Omnia Live</h1><p className="mt-2 text-slate-600">Activité de vos membres et événements.</p></div><button onClick={exportXlsx} className="rounded-xl bg-[#002050] px-4 py-3 font-bold text-white">Exporter Excel</button></div>{msg&&<div className="mt-4 rounded-xl bg-slate-50 p-4">{msg}</div>}<div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[['Membres',d.members],['Événements',d.events],['Inscriptions',d.registrations],['Présence moyenne',`${Number(d.attendance_rate||0).toFixed(1)}%`],['Documents',d.documents],['CA',d.revenue],['Replays vus',d.replay_views],['Heures suivies',d.learning_hours]].map(([l,v])=><div key={l} className="rounded-2xl border bg-white p-5"><div className="text-sm text-slate-500">{l}</div><div className="mt-2 text-2xl font-black text-[#002050]">{typeof v==='number'?v.toLocaleString():v||0}</div></div>)}</div></section></OmniaLiveLayout>
}