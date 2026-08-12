import {useEffect,useState} from 'react';
import {liveApi} from '../liveApi';
import AdminOmniaLiveShell from './AdminOmniaLiveShell';
import {liveStatusLabel} from '../../../lib/omniaLiveLabels';

const TYPE_LABELS:any={event_performance:'Performance événement',attendance:'Présence',financial:'Financier',structure:'Structure'};
const AUDIENCE_LABELS:any={organizer:'Organisateur',super_admin:'Administration Omnia',structure:'Structure'};
function downloadExport(x:any){
 if(!x?.content_text)return;
 if(x.format==='pdf'){
  const w=window.open('','_blank');if(!w)return;w.document.open();w.document.write(x.content_text);w.document.close();setTimeout(()=>w.print(),250);return;
 }
 const blob=new Blob([x.content_text],{type:x.mime_type||'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=x.file_name||`rapport.${x.format}`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}

export default function AdminOmniaLiveReports(){
 const [defs,setDefs]=useState<any[]>([]),[exports,setExports]=useState<any[]>([]),[msg,setMsg]=useState(''),[busy,setBusy]=useState('');
 const load=async()=>{try{const [d,e]=await Promise.all([liveApi('report_definitions_list'),liveApi('report_exports_list')]);setDefs(d.reports||[]);setExports(e.exports||[])}catch(e){setMsg(e instanceof Error?e.message:'Erreur')}};useEffect(()=>{load()},[]);
 async function request(r:any,format:string){setBusy(r.report_key+format);setMsg('');try{const result=await liveApi('report_export_request',{method:'POST',body:JSON.stringify({report_key:r.report_key,format})});setMsg(format==='pdf'?'Rapport prêt. La fenêtre d’impression permet de l’enregistrer en PDF.':'Export généré et téléchargé.');downloadExport(result.export);await load()}catch(e){setMsg(e instanceof Error?e.message:'Erreur')}finally{setBusy('')}}
 return <AdminOmniaLiveShell title="Rapports & exports" subtitle="L’Administration Omnia génère et télécharge directement les rapports Omnia Live.">
  {msg&&<div className="mb-5 border-l-2 border-[#6556B5] bg-amber-50 px-4 py-3 text-sm break-words">{msg}</div>}
  <section className="border-b border-slate-200 pb-7"><h2 className="mb-4 text-lg font-bold text-[#002050]">Rapports disponibles</h2>{defs.length?defs.map(r=><div key={r.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 py-4"><div><div className="font-semibold text-[#002050]">{r.name}</div><div className="mt-1 text-xs text-slate-400">{TYPE_LABELS[r.report_type]||String(r.report_type||'').replaceAll('_',' ')} · {AUDIENCE_LABELS[r.audience]||r.audience}</div></div><div className="flex gap-2"><button disabled={!!busy} onClick={()=>request(r,'csv')} className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50">CSV</button><button disabled={!!busy} onClick={()=>request(r,'xlsx')} className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50">Excel</button><button disabled={!!busy} onClick={()=>request(r,'pdf')} className="rounded-lg bg-[#002050] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">PDF</button></div></div>):<div className="text-sm text-slate-500">Aucun rapport configuré.</div>}</section>
  <section className="py-7"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold text-[#002050]">Exports récents</h2><button onClick={load} className="text-sm font-semibold text-[#002050]">Actualiser</button></div>{exports.length?exports.map(x=><div key={x.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 py-4"><div><div className="font-semibold">{x.file_name||x.format.toUpperCase()}</div><div className="mt-1 text-xs text-slate-400">{liveStatusLabel(x.status)} · {new Date(x.created_at).toLocaleString('fr-FR')}</div>{x.error_message&&<div className="mt-1 max-w-3xl break-words text-xs text-red-600">{x.error_message}</div>}</div>{x.status==='ready'&&x.content_text&&<button onClick={()=>downloadExport(x)} className="rounded-lg border px-3 py-2 text-sm font-semibold text-[#002050]">Télécharger</button>}</div>):<div className="border-y border-slate-200 py-9 text-sm text-slate-500">Aucun export récent.</div>}</section>
 </AdminOmniaLiveShell>
}
