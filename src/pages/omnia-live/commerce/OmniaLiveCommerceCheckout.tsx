import { getOmniaPlatform, isNativeApp, redirectToWebPayment, startNativeStorePurchase } from '../../../lib/mobile';
import {useEffect,useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import OmniaLiveLayout from '../../../components/omnia-live/OmniaLiveLayout';
import {liveApi} from '../liveApi';
import {liveStatusLabel} from '../../../lib/omniaLiveLabels';

const BLUE='#002050';
const GOLD='#BF8813';

export default function OmniaLiveCommerceCheckout(){
 const [params]=useSearchParams();
 const productId=params.get('product'),eventId=params.get('event'),mediaId=params.get('media'),type=params.get('type')||undefined;
 const [product,setProduct]=useState<any>(null),[discount,setDiscount]=useState(''),[publicDiscounts,setPublicDiscounts]=useState<any[]>([]),[order,setOrder]=useState<any>(null),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false);

 useEffect(()=>{
  Promise.all([liveApi('commerce_products',{}, {product_type:type,event_id:eventId||undefined}),liveApi('discount_public_list')])
   .then(([d,p])=>{
    const rows=d.products||[];
    const selected=productId?rows.find((x:any)=>x.id===productId):mediaId?rows.find((x:any)=>x.media_id===mediaId):rows[0];
    setProduct(selected||null);
    setPublicDiscounts((p.discounts||[]).filter((x:any)=>(!x.product_type||x.product_type===selected?.product_type)&&(!x.event_id||x.event_id===(eventId||selected?.event_id))&&(!x.media_id||x.media_id===(mediaId||selected?.media_id))));
   })
   .catch(e=>setMsg(e instanceof Error?e.message:'Produit indisponible.'));
 },[productId,eventId,mediaId,type]);

 async function create(){
  if(!product&&!eventId&&!mediaId){setMsg('Aucun produit sélectionné.');return}
  setBusy(true);setMsg('');
  try{
   const r=await liveApi('commerce_checkout',{method:'POST',body:JSON.stringify({
    product_id:product?.id,event_id:eventId,media_id:mediaId,product_type:type,discount_code:discount.trim().toUpperCase()||null,payment_channel:isNativeApp()?'native_store':'web',platform:isNativeApp()?getOmniaPlatform():undefined
   })});
   setOrder(r.order);
   if(!r.payment_required)setMsg('Accès activé sans paiement.');
   else setMsg('Commande créée. Le paiement doit être confirmé par le serveur avant activation de l’accès.');
  }catch(e){setMsg(e instanceof Error?e.message:'Impossible de créer la commande.')}
  finally{setBusy(false)}
 }

 async function pay(){
  if(!order)return;
  setBusy(true);setMsg('');
  try{
   if(isNativeApp()){
    const purchase=await startNativeStorePurchase('omnia_live',order.id);
    if(purchase.pending){setMsg('Le paiement est en attente de confirmation dans votre store.');return}
    if(purchase.cancelled)return;
    setOrder((current:any)=>current?{...current,payment_status:'paid'}:current);
    setMsg('Paiement confirmé. Votre accès Omnia Live est actif.');
    return;
   }
   const r=await liveApi('fedapay_prepare',{method:'POST',body:JSON.stringify({
    order_id:order.id,callback_url:`${window.location.origin}/omnia-live/mes-achats`
   })});
   if(r.payment_url)redirectToWebPayment(r.payment_url);
   else throw new Error('Le paiement FedaPay Omnia Live n’est pas encore activé.');
  }catch(e){setMsg(e instanceof Error?e.message:'FedaPay indisponible.')}
  finally{setBusy(false)}
 }

 return <OmniaLiveLayout><section className="mx-auto max-w-3xl px-4 py-12">
  <h1 className="text-3xl font-black" style={{color:BLUE}}>Paiement Omnia Live</h1>
  <div className="mt-7 border-y border-slate-200 py-6">
   {product?<>
    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{String(product.product_type||'').replaceAll('_',' ')}</div>
    <h2 className="mt-1 text-xl font-bold" style={{color:BLUE}}>{product.title}</h2>
    <div className="mt-3 text-lg font-black" style={{color:BLUE}}>{Number(product.price_amount||0).toLocaleString('fr-FR')} {product.currency}</div>
    {!order&&<>
     <label className="mt-5 block"><span className="mb-1 block text-sm font-semibold">Code promotionnel <span className="font-normal text-slate-400">(optionnel)</span></span>
      <input value={discount} onChange={e=>setDiscount(e.target.value.toUpperCase())} placeholder="Code fourni par Omnia" className="w-full rounded-lg border border-slate-300 p-3 text-sm"/>
     </label>{publicDiscounts.length>0&&<div className="mt-3"><p className="text-xs font-semibold text-slate-500">Promotions publiques disponibles</p><div className="mt-2 flex flex-wrap gap-2">{publicDiscounts.map((x:any)=><button type="button" key={x.id} onClick={()=>setDiscount(x.code)} className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold" style={{color:BLUE}}>{x.name||'Promotion Live'} · {x.discount_value}{x.discount_type==='percent'?' %':''}</button>)}</div></div>}
     <button onClick={create} disabled={busy} className="mt-4 w-full rounded-lg px-5 py-3 text-sm font-bold text-white disabled:opacity-40" style={{background:BLUE}}>{busy?'Traitement…':'Créer ma commande'}</button>
    </>}
    {order&&<div className="mt-5 border-t border-slate-200 pt-5">
     <div className="text-sm font-semibold">Commande {order.order_number}</div>
     <div className="mt-1 text-sm text-slate-500">{liveStatusLabel(order.payment_status)} · {Number(order.amount||order.net_amount||0).toLocaleString('fr-FR')} {order.currency}</div>
     {order.payment_status!=='paid'&&<button onClick={pay} disabled={busy} className="mt-4 w-full rounded-lg px-5 py-3 text-sm font-bold text-white disabled:opacity-40" style={{background:GOLD}}>{busy?'Préparation…':isNativeApp()?'Payer dans l’application':'Payer avec FedaPay'}</button>}
    </div>}
   </>:<div className="text-sm text-slate-500">Produit non disponible.</div>}
   {msg&&<div className="mt-5 border-l-2 border-[#BF8813] bg-amber-50 px-4 py-3 text-sm">{msg}</div>}
  </div>
 </section></OmniaLiveLayout>;
}
