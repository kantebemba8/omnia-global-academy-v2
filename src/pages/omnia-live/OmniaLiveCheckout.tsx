import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import OmniaLiveLayout from '../../components/omnia-live/OmniaLiveLayout';
import { liveApi } from './liveApi';

const BLUE='#002050', GOLD='#BF8813';

export default function OmniaLiveCheckout(){
  const {liveId}=useParams(); const navigate=useNavigate();
  const [event,setEvent]=useState<any>(null),[loading,setLoading]=useState(true),[message,setMessage]=useState(''),[order,setOrder]=useState<any>(null),[waitlist,setWaitlist]=useState<any>(null);

  useEffect(()=>{if(!liveId)return;liveApi('get',{}, {event_id:liveId}).then(d=>setEvent(d.event)).catch(e=>setMessage(e instanceof Error?e.message:'Erreur')).finally(()=>setLoading(false))},[liveId]);

  async function register(){
    try{
      const r=await liveApi('registration_create',{method:'POST',body:JSON.stringify({event_id:liveId})});
      if(r.waitlisted){setWaitlist(r.waitlist);setMessage('Événement complet : vous êtes ajouté à la liste d’attente.');return}
      if(!r.payment_required){setMessage('Inscription confirmée.');setTimeout(()=>navigate(`/omnia-live/${liveId}`),800);return}
      setOrder(r.order);setMessage('Commande créée. Procédez au paiement avec le moyen de paiement Omnia configuré.');
    }catch(e){setMessage(e instanceof Error?e.message:'Inscription impossible.')}
  }

  async function confirmDemo(){
    if(!order)return;
    try{
      const r=await liveApi('payment_confirm',{method:'POST',body:JSON.stringify({order_id:order.id,provider_status:'paid',provider_reference:`OGA-${Date.now()}`})});
      setMessage('Paiement confirmé. Accès activé et facture générée.');
      setOrder({...order,payment_status:'paid',invoice:r.invoice});
    }catch(e){setMessage(e instanceof Error?e.message:'Confirmation impossible.')}
  }

  if(loading)return <OmniaLiveLayout><div className="mx-auto max-w-4xl px-4 py-12">Chargement...</div></OmniaLiveLayout>;
  return <OmniaLiveLayout><section className="mx-auto max-w-4xl px-4 py-10 md:px-8"><h1 className="text-3xl font-black" style={{color:BLUE}}>Inscription Omnia Live</h1>
    <div className="mt-7 rounded-3xl border bg-white p-6"><h2 className="text-xl font-bold">{event?.title}</h2><div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-600"><span>{event?.starts_at?new Date(event.starts_at).toLocaleString():'À la demande'}</span><span>{Number(event?.price_amount||0)>0?`${event.price_amount} ${event.currency}`:'Gratuit'}</span></div>
    {!order&&!waitlist&&<button onClick={register} className="mt-6 rounded-xl px-5 py-3 font-bold text-white" style={{background:BLUE}}>S’inscrire</button>}
    {waitlist&&<div className="mt-6 rounded-xl bg-amber-50 p-4 text-amber-900">Position liste d’attente : {waitlist.position||'—'}</div>}
    {order&&order.payment_status!=='paid'&&<div className="mt-6 rounded-2xl border p-5"><div className="font-bold">Commande {order.order_number}</div><div className="mt-1 text-sm text-slate-500">{order.amount} {order.currency}</div><div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm">Le connecteur de paiement de la plateforme doit appeler <code>payment_confirm</code> après confirmation du PSP.</div><button onClick={confirmDemo} className="mt-4 rounded-xl px-4 py-2 font-semibold text-white" style={{background:GOLD}}>Confirmer paiement de test</button></div>}
    {order?.payment_status==='paid'&&<div className="mt-6 rounded-xl bg-emerald-50 p-4 text-emerald-800">Paiement confirmé. <Link to="/omnia-live/mes-achats" className="font-bold underline">Voir mes achats et factures</Link></div>}
    {message&&<div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm">{message}</div>}
    </div>
  </section></OmniaLiveLayout>
}
