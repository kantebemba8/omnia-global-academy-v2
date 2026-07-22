import {useEffect,useState} from 'react';
import {liveApi} from '../liveApi';
import AdminOmniaLiveShell from './AdminOmniaLiveShell';
import {liveStatusLabel} from '../../../lib/omniaLiveLabels';

export default function AdminOmniaLiveAudit(){
 const [rows,setRows]=useState<any[]>([]),[q,setQ]=useState(''),[action,setAction]=useState(''),[msg,setMsg]=useState('');
 const load=()=>liveApi('audit_log_list',{}, {q:q||undefined,action:action||undefined}).then(r=>setRows(r.items||[])).catch(e=>setMsg(e instanceof Error?e.message:'Erreur'));
 useEffect(()=>{load()},[]);
 return <AdminOmniaLiveShell title="Journal d’audit" subtitle="Traçabilité des actions sensibles réalisées dans Omnia Live.">
  <div className="mb-5 flex flex-wrap gap-3 border-b border-slate-200 pb-5"><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Rechercher…" className="min-w-[220px] flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm"/><input value={action} onChange={e=>setAction(e.target.value)} placeholder="Action technique" className="min-w-[220px] rounded-lg border border-slate-300 px-4 py-2.5 text-sm"/><button onClick={load} className="rounded-lg bg-[#002050] px-4 py-2.5 text-sm font-bold text-white">Filtrer</button></div>
  {msg&&<div className="mb-5 border-l-2 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700">{msg}</div>}
  {rows.length?<div className="overflow-x-auto"><div className="min-w-[980px]"><div className="grid grid-cols-[1fr_1fr_.7fr_1.2fr_.8fr_.7fr] border-b border-slate-300 pb-3 text-xs font-semibold uppercase tracking-wide text-slate-400"><div>Date</div><div>Acteur</div><div>Rôle</div><div>Action</div><div>Entité</div><div>Résultat</div></div>{rows.map(r=><div key={r.id} className="grid grid-cols-[1fr_1fr_.7fr_1.2fr_.8fr_.7fr] border-b border-slate-200 py-4 text-sm"><div>{new Date(r.created_at).toLocaleString('fr-FR')}</div><div>{r.actor_user_id||'Système'}</div><div>{r.actor_role||'—'}</div><div className="font-semibold">{String(r.action||'').replaceAll('_',' ')}</div><div>{r.entity_type||'—'}</div><div>{liveStatusLabel(r.result)}</div></div>)}</div></div>:<div className="border-y border-slate-200 py-10 text-sm text-slate-500">Aucune entrée d’audit.</div>}
 </AdminOmniaLiveShell>
}
