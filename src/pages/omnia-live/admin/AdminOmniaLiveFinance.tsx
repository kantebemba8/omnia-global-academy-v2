import {useEffect,useMemo,useState} from 'react';
import {liveApi} from '../liveApi';
import {omniaDialog} from '../../../lib/omniaDialog';
import AdminOmniaLiveShell from './AdminOmniaLiveShell';
import {liveStatusLabel} from '../../../lib/omniaLiveLabels';

const BLUE='#002050';
const GOLD='#BF8813';
function money(v:any,c=''){return `${Number(v||0).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})}${c?` ${c}`:''}`}

export default function AdminOmniaLiveFinance(){
 const [d,setD]=useState<any>({orders:[],ledger:[],payouts:[],refunds:[]});
 const [requests,setRequests]=useState<any[]>([]);
 const [msg,setMsg]=useState('');

 async function load(){
  try{
   const [finance,req]=await Promise.all([liveApi('admin_finance'),liveApi('payout_admin_requests')]);
   setD(finance||{orders:[],ledger:[],payouts:[],refunds:[]});
   setRequests(req.requests||[]);
  }catch(e){setMsg(e instanceof Error?e.message:'Erreur')}
 }
 useEffect(()=>{load()},[]);

 const totals=useMemo(()=>({
  gross:(d.orders||[]).filter((x:any)=>['paid','partially_refunded'].includes(x.payment_status)).reduce((a:number,x:any)=>a+Number(x.amount||0),0),
  oga:(d.ledger||[]).filter((x:any)=>x.status!=='reversed').reduce((a:number,x:any)=>a+Number(x.oga_amount||0),0),
  due:(d.ledger||[]).filter((x:any)=>x.status==='available').reduce((a:number,x:any)=>a+Number(x.organizer_amount||0),0),
  pending:(d.ledger||[]).filter((x:any)=>x.status==='pending').reduce((a:number,x:any)=>a+Number(x.organizer_amount||0),0),
 }),[d]);

 async function decideRequest(id:string,status:string){
  const labels:any={
   approved:['Approuver la demande','Le montant restera à verser jusqu’à confirmation du paiement réel.'],
   paid:['Marquer comme payée','Confirmez uniquement après vérification du versement réel.'],
   rejected:['Refuser la demande','Indiquez la raison du refus.']
  };
  const [title,message]=labels[status]||['Confirmer','Confirmer cette action.'];
  const r=await omniaDialog({title,message,confirmLabel:'Confirmer',danger:status==='rejected',inputLabel:'Note de décision',inputRequired:status==='rejected'});
  if(!r.confirmed)return;
  try{
   await liveApi('payout_admin_decision',{method:'POST',body:JSON.stringify({request_id:id,status,decision_note:r.value||null})});
   await load();
  }catch(e){setMsg(e instanceof Error?e.message:'Erreur')}
 }

 async function decideBatch(id:string,status:string){
  const r=await omniaDialog({
   title:status==='paid'?'Confirmer le versement':'Modifier le lot de paiement',
   message:status==='paid'?'Cette action doit être utilisée uniquement après le versement réel.':'Confirmez cette action.',
   confirmLabel:'Confirmer',
   danger:status==='cancelled'
  });
  if(!r.confirmed)return;
  try{await liveApi('admin_payout_decision',{method:'POST',body:JSON.stringify({payout_id:id,status})});await load()}
  catch(e){setMsg(e instanceof Error?e.message:'Erreur')}
 }

 return <AdminOmniaLiveShell title="Finance & Payouts" subtitle="Contrôlez les ventes, commissions, soldes disponibles et versements aux organisateurs.">
  {msg&&<div className="mb-5 border-l-2 border-[#BF8813] bg-amber-50 px-4 py-3 text-sm">{msg}</div>}

  <section className="border-b border-slate-200 pb-7">
   <h2 className="mb-4 text-lg font-bold" style={{color:BLUE}}>Vue financière</h2>
   <div className="grid grid-cols-2 gap-x-8 gap-y-5 md:grid-cols-4">
    {[['CA encaissé',totals.gross],['Revenu OGA',totals.oga],['Part organisateurs en attente',totals.pending],['Disponible à verser',totals.due]].map(([l,v])=><div key={String(l)} className="border-b border-slate-200 pb-4"><div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{l}</div><div className="mt-1 text-xl font-bold" style={{color:l==='Disponible à verser'?GOLD:BLUE}}>{money(v)}</div></div>)}
   </div>
  </section>

  <section className="border-b border-slate-200 py-7">
   <div className="mb-4"><h2 className="text-lg font-bold" style={{color:BLUE}}>Demandes de paiement des organisateurs</h2><p className="mt-1 text-sm text-slate-500">Une demande doit être vérifiée par rapport au solde disponible avant validation.</p></div>
   {requests.length?(
    <div className="overflow-x-auto"><div className="min-w-[900px]">
     <div className="grid grid-cols-[1.2fr_.8fr_.8fr_1.2fr] border-b border-slate-300 pb-3 text-xs font-semibold uppercase tracking-wide text-slate-400"><div>Organisateur</div><div>Montant</div><div>Statut</div><div className="text-right">Actions</div></div>
     {requests.map(x=><div key={x.id} className="grid grid-cols-[1.2fr_.8fr_.8fr_1.2fr] items-center border-b border-slate-200 py-4 text-sm">
      <div><div className="font-semibold" style={{color:BLUE}}>{x.users?.full_name||x.organizer_user_id}</div><div className="text-xs text-slate-400">{x.payout_method||'Méthode non renseignée'}</div></div>
      <div className="font-semibold">{money(x.requested_amount,x.currency)}</div>
      <div>{liveStatusLabel(x.status)}</div>
      <div className="flex justify-end gap-3">
       {x.status==='pending'&&<button onClick={()=>decideRequest(x.id,'approved')} className="font-semibold text-emerald-700">Approuver</button>}
       {x.status==='approved'&&<button onClick={()=>decideRequest(x.id,'paid')} className="font-semibold" style={{color:BLUE}}>Marquer payée</button>}
       {!['paid','rejected','cancelled'].includes(x.status)&&<button onClick={()=>decideRequest(x.id,'rejected')} className="font-semibold text-red-700">Refuser</button>}
      </div>
     </div>)}
    </div></div>
   ):<div className="border-y border-slate-200 py-9 text-sm text-slate-500">Aucune demande de paiement en attente.</div>}
  </section>

  <section className="py-7">
   <div className="mb-4"><h2 className="text-lg font-bold" style={{color:BLUE}}>Lots de paiement</h2><p className="mt-1 text-sm text-slate-500">Les lots regroupent les écritures disponibles réellement affectées à un versement.</p></div>
   {(d.payouts||[]).length?(
    <div className="overflow-x-auto"><div className="min-w-[850px]">
     <div className="grid grid-cols-[1fr_.8fr_.8fr_1fr] border-b border-slate-300 pb-3 text-xs font-semibold uppercase tracking-wide text-slate-400"><div>Lot</div><div>Montant</div><div>Statut</div><div className="text-right">Actions</div></div>
     {(d.payouts||[]).map((x:any)=><div key={x.id} className="grid grid-cols-[1fr_.8fr_.8fr_1fr] items-center border-b border-slate-200 py-4 text-sm">
      <div className="font-semibold" style={{color:BLUE}}>{x.batch_number}</div>
      <div>{money(x.amount,x.currency)}</div>
      <div>{liveStatusLabel(x.status)}</div>
      <div className="flex justify-end gap-3">
       {x.status==='draft'&&<button onClick={()=>decideBatch(x.id,'approved')} className="font-semibold text-emerald-700">Approuver</button>}
       {['approved','processing'].includes(x.status)&&<button onClick={()=>decideBatch(x.id,'paid')} className="font-semibold" style={{color:BLUE}}>Marquer payé</button>}
       {!['paid','cancelled'].includes(x.status)&&<button onClick={()=>decideBatch(x.id,'cancelled')} className="font-semibold text-red-700">Annuler</button>}
      </div>
     </div>)}
    </div></div>
   ):<div className="border-y border-slate-200 py-9 text-sm text-slate-500">Aucun lot de paiement créé.</div>}
  </section>
 </AdminOmniaLiveShell>
}
