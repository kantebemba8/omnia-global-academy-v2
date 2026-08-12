import {useEffect,useState} from 'react';
import {liveApi} from '../liveApi';
import AdminOmniaLiveShell from './AdminOmniaLiveShell';
import {omniaDialog} from '../../../lib/omniaDialog';
import {liveStatusLabel} from '../../../lib/omniaLiveLabels';

const BLUE='#002050';
export default function AdminOmniaLiveIntegrity(){
 const [checks,setChecks]=useState<any[]>([]),[summary,setSummary]=useState<any>({}),[msg,setMsg]=useState(''),[running,setRunning]=useState(false);

 async function run(){
  setRunning(true);setMsg('');
  try{const r=await liveApi('integrity_checks_run',{method:'POST',body:JSON.stringify({scope:'platform'})});setChecks(r.checks||[]);setSummary(r.summary||{});setMsg('Contrôle d’intégrité terminé.')}
  catch(e){setMsg(e instanceof Error?e.message:'Erreur')}
  finally{setRunning(false)}
 }
 async function resolve(id:string){
  const r=await omniaDialog({title:'Marquer comme résolu',message:'Utilisez cette action uniquement après avoir réellement corrigé ou vérifié le problème.',confirmLabel:'Marquer résolu'});
  if(!r.confirmed)return;
  try{await liveApi('integrity_check_resolve',{method:'POST',body:JSON.stringify({check_id:id,status:'resolved'})});await run()}catch(e){setMsg(e instanceof Error?e.message:'Erreur')}
 }

 return <AdminOmniaLiveShell title="Intégrité Omnia Live" subtitle="Contrôlez les incohérences de données et dépendances avant la mise en production.">
  <div className="mb-5 flex justify-end"><button onClick={run} disabled={running} className="rounded-lg bg-[#002050] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">{running?'Contrôle en cours…':'Lancer le contrôle d’intégrité'}</button></div>
  {msg&&<div className="mb-5 border-l-2 border-[#6556B5] bg-amber-50 px-4 py-3 text-sm">{msg}</div>}
  <div className="grid grid-cols-2 gap-x-8 gap-y-5 border-b border-slate-200 pb-7 md:grid-cols-4">{[['Critiques',summary.critical],['Erreurs',summary.error],['Avertissements',summary.warning],['Résolus',summary.resolved]].map(([l,v])=><div key={String(l)} className="border-b border-slate-200 pb-4"><div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{l}</div><div className="mt-1 text-xl font-bold" style={{color:BLUE}}>{Number(v||0)}</div></div>)}</div>
  <div className="pt-7">{checks.length?checks.map(c=><div key={c.id} className="flex flex-wrap justify-between gap-4 border-b border-slate-200 py-4"><div><div className="text-xs font-semibold uppercase text-slate-400">{liveStatusLabel(c.severity)} · {liveStatusLabel(c.status)}</div><div className="mt-1 font-semibold" style={{color:BLUE}}>{c.check_key}</div><pre className="mt-2 max-w-3xl whitespace-pre-wrap text-xs text-slate-500">{JSON.stringify(c.details,null,2)}</pre></div>{c.status==='open'&&<button onClick={()=>resolve(c.id)} className="self-start text-sm font-semibold text-[#002050]">Marquer résolu</button>}</div>):<div className="border-y border-slate-200 py-10 text-sm text-slate-500">Aucun contrôle exécuté dans cette session.</div>}</div>
 </AdminOmniaLiveShell>
}
