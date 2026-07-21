import {useEffect,useState} from 'react';
import ParticipantShell from './ParticipantShell';
import {liveApi} from '../liveApi';
import {liveStatusLabel} from '../../../lib/omniaLiveLabels';

export default function ParticipantRefunds(){
 const [rows,setRows]=useState<any[]>([]),[msg,setMsg]=useState('');
 useEffect(()=>{liveApi('participant_refunds').then(d=>setRows(d.refunds||[])).catch(e=>setMsg(e instanceof Error?e.message:'Erreur'))},[]);
 return <ParticipantShell title="Mes remboursements" subtitle="Suivez vos demandes de remboursement et les décisions administratives.">
  {msg&&<div className="mb-4 border-l-2 border-[#BF8813] bg-amber-50 px-4 py-3 text-sm">{msg}</div>}
  {rows.length?(
   <div>
    <div className="hidden grid-cols-[1.4fr_.7fr_.7fr_1.1fr] border-b border-slate-300 pb-3 text-xs font-semibold uppercase tracking-wide text-slate-400 md:grid">
     <div>Événement</div><div>Montant demandé</div><div>Statut</div><div>Motif / décision</div>
    </div>
    {rows.map(x=><div key={x.id} className="grid gap-3 border-b border-slate-200 py-4 text-sm md:grid-cols-[1.4fr_.7fr_.7fr_1.1fr]">
     <div className="font-semibold text-[#002050]">{x.live_events?.title||'Événement'}</div>
     <div>{Number(x.requested_amount||0).toLocaleString('fr-FR')} {x.live_orders?.currency||''}</div>
     <div>{liveStatusLabel(x.status)}</div>
     <div className="text-slate-600">{x.decision_reason||x.reason_details||String(x.reason_code||'—').replaceAll('_',' ')}</div>
    </div>)}
   </div>
  ):<div className="border-y border-slate-200 py-10 text-center text-sm text-slate-500">Aucune demande de remboursement.</div>}
 </ParticipantShell>
}
