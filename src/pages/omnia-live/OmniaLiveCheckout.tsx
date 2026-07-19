import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import OmniaLiveLayout from '../../components/omnia-live/OmniaLiveLayout';
import { liveApi } from './liveApi';

const BLUE='#002050';

export default function OmniaLiveCheckout(){
 const {liveId}=useParams(); const navigate=useNavigate();
 const [event,setEvent]=useState<any>(null),[loading,setLoading]=useState(true),[message,setMessage]=useState(''),[order,setOrder]=useState<any>(null),[waitlist,setWaitlist]=useState<any>(null),[paying,setPaying]=useState(false);
 useEffect(()=>{if(!liveId)return;liveApi('get',{}, {event_id:liveId}).then(d=>setEvent(d.event)).catch(e=>setMessage(e instanceof Error?e.message:'Erreur')).finally(()=>setLoading(false))},[liveId]);

 async function register(){
   try{
     const r=await liveApi('registration_create',{method:'POST',body:JSON.stringify({event_id:liveId})});
     if(r.waitlisted){setWaitlist(r.waitlist);setMessage('Événement complet : vous êtes sur la liste d’attente.');return}
     if(!r.payment_required){setMessage('Inscription confirmée.');setTimeout(()=>navigate(`/omnia-live/${liveId}`),700);return}
     setOrder(r.order);setMessage('Commande créée. Le paiement FedaPay reste désactivé tant que le mode paiement global Omnia n’est pas activé.');
   }catch(e){setMessage(e instanceof Error?e.message:'Inscription impossible.')}
 }

 async function pay(){
   if(!order)return;setPaying(true);setMessage('');
   try{
     const callback=`${window.location.origin}/omnia-live/mes-achats`;
     const r=await liveApi('fedapay_prepare',{method:'POST',body:JSON.stringify({order_id:order.id,callback_url:callback})});
     if(r.payment_url) window.location.href=r.payment_url;
     else throw new Error('Lien de paiement indisponible.');
   }catch(e){setMessage(e instanceof Error?e.message:'FedaPay indisponible.')}finally{setPaying(false)}
 }

 if(loading)return <OmniaLiveLayout><div className="mx-auto max-w-4xl px-4 py-12">Chargement...</div></OmniaLiveLayout>;
 return <OmniaLiveLayout><section className="mx-auto max-w-4xl px-4 py-10 md:px-8"><h1 className="text-3xl font-black" style={{color:BLUE}}>Inscription Omnia Live</h1><div className="mt-7 rounded-3xl border bg-white p-6"><h2 className="text-xl font-bold">{event?.title}</h2><div className="mt-4 text-sm text-slate-600">{Number(event?.price_amount||0)>0?`${event.price_amount} ${event.currency}`:'Gratuit'}</div>
 {!order&&!waitlist&&<button onClick={register} className="mt-6 rounded-xl px-5 py-3 font-bold text-white" style={{background:BLUE}}>S’inscrire</button>}
 {waitlist&&<div className="mt-6 rounded-xl bg-amber-50 p-4">Liste d’attente · position {waitlist.position||'—'}</div>}
 {order&&<div className="mt-6 rounded-2xl border p-5"><div className="font-bold">{order.order_number}</div><div className="text-sm text-slate-500">{order.amount} {order.currency}</div><button onClick={pay} disabled={paying} className="mt-4 rounded-xl px-5 py-3 font-bold text-white disabled:opacity-50" style={{background:BLUE}}>{paying?'Préparation...':'Payer avec FedaPay'}</button><p className="mt-3 text-xs text-slate-500">Le bouton fonctionnera lorsque les clés FedaPay et l’activation paiement Omnia seront prêtes.</p></div>}
 {message&&<div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm">{message}</div>}</div></section></OmniaLiveLayout>
}
