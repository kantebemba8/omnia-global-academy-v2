import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {liveApi} from '../liveApi';
import OrganizerShell from './OrganizerShell';
import {deliveryLabel,liveStatusLabel} from '../../../lib/omniaLiveLabels';

const STATUS_OPTIONS=[
  ['','Tous les statuts'],
  ['draft','Brouillon'],
  ['submitted','Soumis'],
  ['under_review','En cours d’examen'],
  ['changes_requested','Modifications demandées'],
  ['approved','Approuvé'],
  ['published','Publié'],
  ['live','En direct'],
  ['completed','Terminé'],
  ['suspended','Suspendu'],
  ['cancelled','Annulé'],
  ['rejected','Refusé'],
] as const;

export default function OrganizerEvents(){
 const [items,setItems]=useState<any[]>([]),[status,setStatus]=useState(''),[q,setQ]=useState(''),[err,setErr]=useState('');
 const load=()=>liveApi('organizer_events',{}, {status:status||undefined,q:q||undefined})
   .then(d=>setItems(d.items||[]))
   .catch(e=>setErr(e instanceof Error?e.message:'Erreur'));
 useEffect(()=>{load()},[status]);

 return <OrganizerShell title="Mes événements" subtitle="Brouillons, validation, publication, direct et historique.">
  <div className="mb-6 flex flex-wrap items-center gap-3 border-b border-slate-200 pb-5">
   <input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&load()}
     placeholder="Rechercher un événement…" className="min-w-[240px] flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm"/>
   <select value={status} onChange={e=>setStatus(e.target.value)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm">
    {STATUS_OPTIONS.map(([value,label])=><option key={value||'all'} value={value}>{label}</option>)}
   </select>
   <button onClick={load} className="rounded-lg bg-[#002050] px-4 py-2.5 text-sm font-bold text-white">Rechercher</button>
  </div>

  {err&&<div className="mb-4 border-l-2 border-red-500 bg-red-50 p-4 text-sm text-red-700">{err}</div>}

  {items.length?(
   <div className="overflow-x-auto">
    <div className="min-w-[820px]">
     <div className="grid grid-cols-[1.5fr_.8fr_.8fr_.9fr] border-b border-slate-300 pb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
      <div>Événement</div><div>Format</div><div>Statut</div><div className="text-right">Actions</div>
     </div>
     {items.map(x=><div key={x.id} className="grid grid-cols-[1.5fr_.8fr_.8fr_.9fr] items-center border-b border-slate-200 py-4 text-sm">
      <div>
       <div className="font-semibold text-[#002050]">{x.title}</div>
       <div className="mt-1 text-xs text-slate-400">{x.starts_at?new Date(x.starts_at).toLocaleString('fr-FR'):'Date non définie'}</div>
      </div>
      <div className="text-slate-600">{deliveryLabel(x.delivery_type)}</div>
      <div className="font-medium text-[#BF8813]">{liveStatusLabel(x.status)}</div>
      <div className="flex justify-end gap-2">
       {['draft','changes_requested'].includes(x.status)&&<Link to={`/omnia-live/studio/${x.id}`} className="text-sm font-semibold text-[#002050]">Reprendre le Studio</Link>}
       <Link to={`/omnia-live/organisateur/evenements/${x.id}`} className="text-sm font-semibold text-[#002050]">Gérer</Link>
       {['published','live'].includes(x.status)&&<Link to={`/omnia-live/${x.id}/organiser`} className="text-sm font-semibold text-[#BF8813]">Salle Live</Link>}
      </div>
     </div>)}
    </div>
   </div>
  ):<div className="border-y border-slate-200 py-10 text-sm text-slate-500">Aucun événement.</div>}
 </OrganizerShell>
}
