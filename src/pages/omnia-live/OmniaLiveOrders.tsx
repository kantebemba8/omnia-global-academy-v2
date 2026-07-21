import {useEffect,useState} from 'react';
import OmniaLiveLayout from '../../components/omnia-live/OmniaLiveLayout';
import {liveApi} from './liveApi';
import {omniaDialog} from '../../lib/omniaDialog';
import {liveStatusLabel} from '../../lib/omniaLiveLabels';

const BLUE='#002050';

export default function OmniaLiveOrders(){
 const [orders,setOrders]=useState<any[]>([]),[message,setMessage]=useState('');
 const load=()=>liveApi('orders_mine').then(d=>setOrders(d.orders||[])).catch(e=>setMessage(e instanceof Error?e.message:'Erreur'));
 useEffect(()=>{load()},[]);

 async function invoice(id:string){
  try{
   const r=await liveApi('invoice_download',{}, {invoice_id:id});
   if(r.download_url)window.open(r.download_url,'_blank','noopener,noreferrer');
   else throw new Error('Facture indisponible.');
  }catch(e){setMessage(e instanceof Error?e.message:'Facture indisponible.')}
 }

 async function refund(order:any){
  const r=await omniaDialog({
   title:'Demander un remboursement',
   message:'Votre demande sera examinée selon la politique applicable à cet achat. Le remboursement n’est pas automatique.',
   confirmLabel:'Envoyer la demande',
   inputLabel:'Motif détaillé',
   inputRequired:true
  });
  if(!r.confirmed)return;
  try{
   await liveApi('refund_request',{method:'POST',body:JSON.stringify({order_id:order.id,reason_code:'other',reason_details:r.value})});
   setMessage('Demande de remboursement envoyée.');
   await load();
  }catch(e){setMessage(e instanceof Error?e.message:'Erreur')}
 }

 return <OmniaLiveLayout><section className="mx-auto max-w-6xl px-4 py-10 md:px-8">
  <h1 className="text-3xl font-black" style={{color:BLUE}}>Mes achats Omnia Live</h1>
  {message&&<div className="mt-5 border-l-2 border-[#BF8813] bg-amber-50 px-4 py-3 text-sm">{message}</div>}
  <div className="mt-7">
   {orders.length?<>
    <div className="hidden grid-cols-[1.4fr_.8fr_.8fr_1fr] border-b border-slate-300 pb-3 text-xs font-semibold uppercase tracking-wide text-slate-400 md:grid">
     <div>Achat</div><div>Statut</div><div>Montant</div><div className="text-right">Actions</div>
    </div>
    {orders.map(o=><div key={o.id} className="grid gap-3 border-b border-slate-200 py-4 text-sm md:grid-cols-[1.4fr_.8fr_.8fr_1fr] md:items-center">
     <div><div className="font-semibold" style={{color:BLUE}}>{o.live_events?.title||o.order_number}</div><div className="mt-1 text-xs text-slate-400">{o.order_number} · {String(o.purchase_type||'live').replaceAll('_',' ')}</div></div>
     <div className="font-medium">{liveStatusLabel(o.payment_status)}</div>
     <div>{Number(o.amount||0).toLocaleString('fr-FR')} {o.currency}</div>
     <div className="flex flex-wrap justify-start gap-3 md:justify-end">
      {o.live_invoices?.[0]&&<button onClick={()=>invoice(o.live_invoices[0].id)} className="font-semibold" style={{color:BLUE}}>Facture PDF</button>}
      {['paid','partially_refunded'].includes(o.payment_status)&&<button onClick={()=>refund(o)} className="font-semibold text-amber-700">Demander un remboursement</button>}
     </div>
    </div>)}
   </>:<div className="border-y border-slate-200 py-10 text-center text-sm text-slate-500">Aucun achat.</div>}
  </div>
 </section></OmniaLiveLayout>;
}
