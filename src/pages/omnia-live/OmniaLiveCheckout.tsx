import { assertNativePaymentAvailable, redirectToWebPayment } from '../../lib/mobile';
import {useEffect,useState} from 'react';
import {useNavigate,useParams} from 'react-router-dom';
import OmniaLiveLayout from '../../components/omnia-live/OmniaLiveLayout';
import {liveApi} from './liveApi';
import {liveStatusLabel} from '../../lib/omniaLiveLabels';

const BLUE='#002050';
const GOLD='#BF8813';

export default function OmniaLiveCheckout(){
 const {liveId}=useParams();
 const navigate=useNavigate();
 const [event,setEvent]=useState<any>(null);
 const [loading,setLoading]=useState(true);
 const [message,setMessage]=useState('');
 const [order,setOrder]=useState<any>(null);
 const [waitlist,setWaitlist]=useState<any>(null);
 const [paying,setPaying]=useState(false);

 useEffect(()=>{
  if(!liveId)return;
  liveApi('get',{}, {event_id:liveId})
    .then(d=>setEvent(d.event))
    .catch(e=>setMessage(e instanceof Error?e.message:'Erreur'))
    .finally(()=>setLoading(false));
 },[liveId]);

 async function register(){
  try{
   const r=await liveApi('registration_create',{method:'POST',body:JSON.stringify({event_id:liveId})});
   if(r.waitlisted){
    setWaitlist(r.waitlist);
    setMessage('Événement complet : vous avez été placé sur la liste d’attente.');
    return;
   }
   if(!r.payment_required){
    setMessage('Inscription confirmée. Votre accès est actif.');
    window.setTimeout(()=>navigate(`/omnia-live/${liveId}`),800);
    return;
   }
   setOrder(r.order);
   setMessage('Votre commande a été créée. Le paiement sera proposé lorsque le module FedaPay Omnia Live sera activé.');
  }catch(e){
   setMessage(e instanceof Error?e.message:'Inscription impossible.');
  }
 }

 async function pay(){
  if(!order)return;
  setPaying(true);setMessage('');
  try{
   assertNativePaymentAvailable();
   const callback=`${window.location.origin}/omnia-live/mes-achats`;
   const r=await liveApi('fedapay_prepare',{method:'POST',body:JSON.stringify({order_id:order.id,callback_url:callback})});
   if(r.payment_url)redirectToWebPayment(r.payment_url);
   else throw new Error('Le paiement Omnia Live n’est pas encore activé.');
  }catch(e){
   setMessage(e instanceof Error?e.message:'Le paiement Omnia Live n’est pas encore disponible.');
  }finally{setPaying(false)}
 }

 if(loading)return <OmniaLiveLayout><div className="mx-auto max-w-4xl px-4 py-12 text-sm text-slate-500">Chargement…</div></OmniaLiveLayout>;

 const amount=Number(event?.price_amount||0);
 return <OmniaLiveLayout><section className="mx-auto max-w-4xl px-4 py-10 md:px-8">
  <h1 className="text-3xl font-black" style={{color:BLUE}}>Inscription Omnia Live</h1>
  <div className="mt-7 border-y border-slate-200 py-6">
   <h2 className="text-xl font-bold" style={{color:BLUE}}>{event?.title||'Événement'}</h2>
   <div className="mt-2 text-sm text-slate-600">{amount>0?`${amount.toLocaleString('fr-FR')} ${event?.currency||'XOF'}`:'Gratuit'}</div>

   {!order&&!waitlist&&<button onClick={register} className="mt-6 rounded-lg px-5 py-2.5 text-sm font-bold text-white" style={{background:BLUE}}>S’inscrire</button>}

   {waitlist&&<div className="mt-6 border-l-2 border-amber-500 bg-amber-50 px-4 py-3 text-sm">
    Liste d’attente · position {waitlist.position||'—'}
   </div>}

   {order&&<div className="mt-6 border-t border-slate-200 pt-5">
    <div className="text-sm font-semibold" style={{color:BLUE}}>Commande {order.order_number}</div>
    <div className="mt-1 text-sm text-slate-500">{Number(order.amount||0).toLocaleString('fr-FR')} {order.currency} · {liveStatusLabel(order.payment_status)}</div>
    <button onClick={pay} disabled={paying||order.payment_status==='paid'} className="mt-4 rounded-lg px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40" style={{background:GOLD}}>
     {paying?'Préparation du paiement…':'Payer avec FedaPay'}
    </button>
    <p className="mt-3 max-w-2xl text-xs text-slate-500">L’accès payant n’est accordé qu’après confirmation serveur du paiement. Un retour navigateur seul ne valide jamais une transaction.</p>
   </div>}

   {message&&<div className="mt-5 border-l-2 border-[#BF8813] bg-amber-50 px-4 py-3 text-sm">{message}</div>}
  </div>
 </section></OmniaLiveLayout>;
}
