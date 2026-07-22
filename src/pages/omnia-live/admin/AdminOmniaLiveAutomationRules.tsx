import {useEffect,useState} from 'react';
import {liveApi} from '../liveApi';
import AdminOmniaLiveShell from './AdminOmniaLiveShell';

const CHANNEL_LABELS:any={multi:'Notifications + e-mail',in_app:'Notification Omnia',email:'E-mail',sms:'SMS',push:'Push'};

export default function AdminOmniaLiveAutomationRules(){
 const [rows,setRows]=useState<any[]>([]),[msg,setMsg]=useState('');
 const load=()=>liveApi('admin_automation_rules').then(r=>setRows(r.rules||[])).catch(e=>setMsg(e instanceof Error?e.message:'Erreur'));
 useEffect(()=>{load()},[]);
 async function toggle(r:any){
  try{await liveApi('automation_rule_save',{method:'POST',body:JSON.stringify({...r,enabled:!r.enabled})});await load()}
  catch(e){setMsg(e instanceof Error?e.message:'Erreur')}
 }
 return <AdminOmniaLiveShell title="Automatisations" subtitle="Règles globales et par événement pour confirmations, rappels et changements de statut.">
  {msg&&<div className="mb-5 border-l-2 border-[#BF8813] bg-amber-50 px-4 py-3 text-sm">{msg}</div>}
  {rows.length?<div className="overflow-x-auto"><div className="min-w-[900px]">
   <div className="grid grid-cols-[1.3fr_1fr_.8fr_.7fr] border-b border-slate-300 pb-3 text-xs font-semibold uppercase tracking-wide text-slate-400"><div>Règle</div><div>Déclencheur</div><div>Canal</div><div className="text-right">État</div></div>
   {rows.map(r=><div key={r.id} className="grid grid-cols-[1.3fr_1fr_.8fr_.7fr] items-center border-b border-slate-200 py-4 text-sm">
    <div><div className="font-semibold text-[#002050]">{r.rule_key}</div>{r.event_id&&<div className="mt-1 text-xs text-slate-400">Règle spécifique à un événement</div>}</div>
    <div>{String(r.trigger_type||'').replaceAll('_',' ')}{r.trigger_offset_minutes?` · ${Math.abs(r.trigger_offset_minutes)} min`:''}</div>
    <div>{CHANNEL_LABELS[r.channel]||r.channel}</div>
    <label className="flex items-center justify-end gap-2 font-semibold"><span>{r.enabled?'Active':'Inactive'}</span><input type="checkbox" checked={!!r.enabled} onChange={()=>toggle(r)}/></label>
   </div>)}
  </div></div>:<div className="border-y border-slate-200 py-10 text-sm text-slate-500">Aucune automatisation configurée.</div>}
 </AdminOmniaLiveShell>
}
