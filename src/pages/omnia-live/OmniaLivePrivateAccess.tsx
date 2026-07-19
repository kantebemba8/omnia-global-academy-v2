import { useState } from 'react';
import OmniaLiveLayout from '../../components/omnia-live/OmniaLiveLayout';
import { liveApi } from './liveApi';

export default function OmniaLivePrivateAccess(){
 const [code,setCode]=useState(''),[message,setMessage]=useState('');
 async function redeem(){try{const r=await liveApi('private_code_redeem',{method:'POST',body:JSON.stringify({code})});setMessage('Accès autorisé à cet espace Omnia Live.')}catch(e){setMessage(e instanceof Error?e.message:'Code invalide.')}}
 return <OmniaLiveLayout><section className="mx-auto max-w-xl px-4 py-16"><h1 className="text-3xl font-black" style={{color:'#002050'}}>Accès privé Omnia Live</h1><p className="mt-2 text-slate-600">Saisissez le code fourni par l’organisateur ou votre Structure.</p><div className="mt-7 rounded-2xl border bg-white p-6"><input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} className="w-full rounded-xl border p-3" placeholder="OL-XXXXXXXXXX"/><button onClick={redeem} className="mt-4 w-full rounded-xl bg-[#002050] px-5 py-3 font-bold text-white">Valider le code</button>{message&&<div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">{message}</div>}</div></section></OmniaLiveLayout>
}
