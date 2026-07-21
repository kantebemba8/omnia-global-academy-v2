import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import OmniaLiveLayout from '../../components/omnia-live/OmniaLiveLayout';
import {liveApi} from './liveApi';

const BLUE='#002050';

export default function OmniaLivePrivateAccess(){
 const [code,setCode]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const navigate=useNavigate();
 async function redeem(){
  const normalized=code.trim().toUpperCase();
  if(!normalized){setMessage('Saisissez votre code d’accès.');return}
  setBusy(true);setMessage('');
  try{
   const r=await liveApi('private_code_redeem',{method:'POST',body:JSON.stringify({code:normalized})});
   setMessage('Accès autorisé.');
   const eventId=r.event_id||r.event?.id;
   if(eventId)window.setTimeout(()=>navigate(`/omnia-live/${eventId}`),600);
  }catch(e){setMessage(e instanceof Error?e.message:'Code invalide, expiré ou non autorisé pour votre compte.')}
  finally{setBusy(false)}
 }
 return <OmniaLiveLayout><section className="mx-auto max-w-xl px-4 py-16">
  <h1 className="text-3xl font-black" style={{color:BLUE}}>Accès privé Omnia Live</h1>
  <p className="mt-2 text-slate-600">Saisissez le code transmis par l’organisateur ou votre Structure. Le code est vérifié avec votre compte connecté.</p>
  <div className="mt-7 border-y border-slate-200 py-6">
   <label className="block"><span className="mb-1 block text-sm font-semibold" style={{color:BLUE}}>Code d’accès</span>
    <input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} onKeyDown={e=>e.key==='Enter'&&redeem()} className="w-full rounded-lg border border-slate-300 p-3 font-mono" placeholder="OL-XXXXXXXXXX"/>
   </label>
   <button onClick={redeem} disabled={busy} className="mt-4 w-full rounded-lg bg-[#002050] px-5 py-3 text-sm font-bold text-white disabled:opacity-40">{busy?'Vérification…':'Valider le code'}</button>
   {message&&<div className="mt-4 border-l-2 border-[#BF8813] bg-amber-50 px-4 py-3 text-sm">{message}</div>}
  </div>
 </section></OmniaLiveLayout>
}
