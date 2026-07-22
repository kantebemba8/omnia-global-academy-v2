import {useEffect,useState} from 'react';
import {liveApi} from '../liveApi';
import AdminOmniaLiveShell from './AdminOmniaLiveShell';
import {liveStatusLabel} from '../../../lib/omniaLiveLabels';

export default function AdminOmniaLiveReports(){
 const [defs,setDefs]=useState<any[]>([]),[exports,setExports]=useState<any[]>([]),[msg,setMsg]=useState('');
 const load=async()=>{try{const [d,e]=await Promise.all([liveApi('report_definitions_list'),liveApi('report_exports_list')]);setDefs(d.reports||[]);setExports(e.exports||[])}catch(e){setMsg(e instanceof Error?e.message:'Erreur')}};useEffect(()=>{load()},[]);
 async function request(r:any,format:string){try{await liveApi('report_export_request',{method:'POST',body:JSON.stringify({report_key:r.report_key,format})});setMsg('Export demandé.');await load()}catch(e){setMsg(e instanceof Error?e.message:'Erreur')}}
 return <AdminOmniaLiveShell title="Rapports Omnia Live" subtitle="Exports opérationnels, financiers et institutionnels.">
  {msg&&<div className="mb-5 border-l-2 border-[#BF8813] bg-amber-50 px-4 py-3 text-sm">{msg}</div>}
  <section className="border-b border-slate-200 pb-7"><h2 className="mb-4 text-lg font-bold text-[#002050]">Rapports disponibles</h2>{defs.length?defs.map(r=><div key={r.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 py-4"><div><div className="font-semibold text-[#002050]">{r.name}</div><div className="mt-1 text-xs text-slate-400">{String(r.report_type||'').replaceAll('_',' ')} · {r.audience}</div></div><div className="flex gap-2"><button onClick={()=>request(r,'csv')} className="text-sm font-semibold">CSV</button><button onClick={()=>request(r,'xlsx')} className="text-sm font-semibold">Excel</button><button onClick={()=>request(r,'pdf')} className="text-sm font-semibold text-[#002050]">PDF</button></div></div>):<div className="text-sm text-slate-500">Aucun rapport configuré.</div>}</section>
  <section className="py-7"><h2 className="mb-4 text-lg font-bold text-[#002050]">Exports récents</h2>{exports.length?exports.map(x=><div key={x.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 py-4"><div><div className="font-semibold">{x.file_name||x.format.toUpperCase()}</div><div className="mt-1 text-xs text-slate-400">{liveStatusLabel(x.status)} · {new Date(x.created_at).toLocaleString('fr-FR')}</div>{x.error_message&&<div className="mt-1 text-xs text-red-600">{x.error_message}</div>}</div>{x.status==='ready'&&x.download_url&&<a href={x.download_url} className="text-sm font-semibold text-[#002050]">Télécharger</a>}</div>):<div className="border-y border-slate-200 py-9 text-sm text-slate-500">Aucun export récent.</div>}</section>
 </AdminOmniaLiveShell>
}
