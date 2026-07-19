import { useEffect, useState } from 'react';
import OmniaLiveLayout from '../../components/omnia-live/OmniaLiveLayout';
import { liveApi } from './liveApi';

const BLUE='#002050';

export default function OmniaLiveOrders(){
 const [orders,setOrders]=useState<any[]>([]),[message,setMessage]=useState('');
 useEffect(()=>{liveApi('orders_mine').then(d=>setOrders(d.orders||[])).catch(e=>setMessage(e instanceof Error?e.message:'Erreur'))},[]);
 async function invoice(id:string){try{const r=await liveApi('invoice_download',{}, {invoice_id:id});window.open(r.download_url,'_blank')}catch(e){setMessage(e instanceof Error?e.message:'Facture indisponible.')}}
 async function refund(order:any){const reason=prompt('Motif de la demande de remboursement :');if(!reason)return;try{await liveApi('refund_request',{method:'POST',body:JSON.stringify({order_id:order.id,reason_code:'other',reason_details:reason})});setMessage('Demande de remboursement envoyée.')}catch(e){setMessage(e instanceof Error?e.message:'Erreur')}}
 return <OmniaLiveLayout><section className="mx-auto max-w-6xl px-4 py-10 md:px-8"><h1 className="text-3xl font-black" style={{color:BLUE}}>Mes achats Omnia Live</h1>{message&&<div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm">{message}</div>}<div className="mt-7 space-y-3">{orders.map(o=><div key={o.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-5"><div><div className="font-bold">{o.live_events?.title}</div><div className="mt-1 text-sm text-slate-500">{o.order_number} · {o.payment_status} · {o.amount} {o.currency}</div></div><div className="flex flex-wrap gap-2">{o.live_invoices?.[0]&&<button onClick={()=>invoice(o.live_invoices[0].id)} className="rounded-lg border px-3 py-2 text-sm font-semibold">Télécharger facture PDF</button>}{['paid','partially_refunded'].includes(o.payment_status)&&<button onClick={()=>refund(o)} className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-semibold">Demander remboursement</button>}</div></div>)}{!orders.length&&<div className="rounded-2xl bg-slate-50 p-8 text-center text-slate-500">Aucun achat.</div>}</div></section></OmniaLiveLayout>
}
