import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { edgeAuthHeaders } from '../../lib/edgeAuth';
import { ExternalLink, Plus, RefreshCw, ShieldCheck, Upload, Workflow } from 'lucide-react';

const API=`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cpd-credits-recharge`;
const BLUE='#002050', GOLD='#BF8813';

export default function AdminCpdCredits(){
 const [data,setData]=useState<any>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[amount,setAmount]=useState('');
 async function load(){setLoading(true);setError('');try{const r=await fetch(API,{headers:edgeAuthHeaders()});const d=await r.json();if(!r.ok||d.success===false)throw new Error(d.message||d.error||'Chargement impossible');setData(d)}catch(e){setError(e instanceof Error?e.message:'Erreur')}finally{setLoading(false)}}
 useEffect(()=>{load()},[]);
 async function recharge(e:React.FormEvent){e.preventDefault();const n=Number(amount);if(!Number.isInteger(n)||n<=0){setError('Saisissez un nombre entier de crédits réellement achetés chez Open CPD.');return}setError('');try{const r=await fetch(API,{method:'POST',headers:edgeAuthHeaders(),body:JSON.stringify({credits_to_add:n})});const d=await r.json();if(!r.ok||d.success===false)throw new Error(d.message||d.error||'Enregistrement impossible');setAmount('');await load()}catch(e){setError(e instanceof Error?e.message:'Erreur')}}
 const c=data?.credits||{total_credits:0,used_credits:0,available_credits:0};
 return <AdminLayout><div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
   <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between border-b border-gray-200 pb-5">
     <div>
       <p className="text-xs font-semibold uppercase tracking-[.14em]" style={{color:GOLD}}>Formations & certifications</p>
       <h1 className="text-2xl font-black mt-1" style={{color:BLUE}}>Open CPD</h1>
       <p className="text-sm text-gray-500 mt-1">Suivi interne des crédits Open CPD et des certificats en attente d’émission.</p>
     </div>
     <div className="flex flex-wrap gap-3">
       <a href="https://app.open-cpd.com/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold" style={{color:GOLD}}>Ouvrir Open CPD <ExternalLink size={14}/></a>
       <a href="https://open-cpd.com/lms-integration-options/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-gray-600">Options d’intégration <ExternalLink size={14}/></a>
       <button onClick={load} className="inline-flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold text-gray-600"><RefreshCw size={15}/>Actualiser</button>
     </div>
   </div>

   {error&&<div className="border-l-4 border-red-500 pl-4 py-2 text-sm text-red-700">{error}</div>}
   {loading?<div className="py-16 text-center text-sm text-gray-400">Chargement…</div>:<>
     <div className="grid grid-cols-3 border-y border-gray-200">
       {[['Crédits enregistrés',c.total_credits],['Utilisés',c.used_credits],['Disponibles',c.available_credits]].map(([l,v],i)=>
         <div key={String(l)} className={`py-5 px-4 ${i<2?'border-r border-gray-200':''}`}><p className="text-xs text-gray-500">{l}</p><p className="text-2xl font-black mt-1" style={{color:BLUE}}>{v}</p></div>)}
     </div>

     <section className="border-b border-gray-200 pb-5">
       <h2 className="font-bold" style={{color:BLUE}}>Mode d’intégration</h2>
       <p className="text-sm text-gray-500 mt-1">Omnia n’invente pas d’API Open CPD. L’automatisation directe reste désactivée tant que les identifiants et la documentation API officiels fournis à votre compte ne sont pas configurés.</p>
       <div className="mt-4 grid md:grid-cols-3 gap-4">
         <div className="border-l-2 pl-3" style={{borderColor:GOLD}}><Upload size={17} color={GOLD}/><p className="font-semibold text-sm mt-2" style={{color:BLUE}}>Import manuel / CSV</p><p className="text-xs text-gray-500 mt-1">Disponible via le tableau de bord Open CPD.</p></div>
         <div className="border-l-2 pl-3 border-gray-200"><Workflow size={17} className="text-gray-500"/><p className="font-semibold text-sm mt-2" style={{color:BLUE}}>Zapier / Zoho Flow</p><p className="text-xs text-gray-500 mt-1">À configurer avec les outils/documentations fournis par Open CPD.</p></div>
         <div className="border-l-2 pl-3 border-gray-200"><ShieldCheck size={17} className="text-gray-500"/><p className="font-semibold text-sm mt-2" style={{color:BLUE}}>API directe</p><p className="text-xs text-gray-500 mt-1">Intégration Auth0 sur configuration dédiée. Non activée automatiquement ici.</p></div>
       </div>
     </section>

     <form onSubmit={recharge} className="border-b border-gray-200 pb-6">
       <h2 className="font-bold" style={{color:BLUE}}>Enregistrer un achat de crédits</h2>
       <p className="text-xs text-gray-500 mt-1 mb-3">1 certificat Open CPD correspond à 1 crédit. Enregistrez uniquement les crédits réellement achetés sur votre compte Open CPD.</p>
       <div className="flex gap-2 max-w-md"><input type="number" min="1" step="1" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Nombre de crédits achetés" className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"/>
       <button className="inline-flex items-center gap-1 px-4 py-2 rounded-lg text-white text-sm font-semibold" style={{background:BLUE}}><Plus size={14}/>Enregistrer</button></div>
     </form>

     <section><h2 className="font-bold mb-3" style={{color:BLUE}}>Certificats Open CPD en attente</h2>
       {data?.pending?.length?<div className="border-t border-gray-200">{data.pending.map((x:any)=><div key={x.id} className="py-3 border-b border-gray-100"><p className="text-sm font-semibold" style={{color:BLUE}}>{x.student_full_name}</p><p className="text-xs text-gray-500">{x.course_title} · {x.issued_at?new Date(x.issued_at).toLocaleDateString('fr-FR'):'Date inconnue'}</p><p className="text-xs text-gray-400 mt-1">À émettre via votre workflow Open CPD configuré.</p></div>)}</div>:<p className="text-sm text-gray-500">Aucun certificat Open CPD en attente.</p>}
     </section>

     <section><h2 className="font-bold mb-3" style={{color:BLUE}}>Historique des crédits enregistrés</h2>
       {data?.history?.length?<div className="border-t border-gray-200">{data.history.map((x:any)=><div key={x.id} className="grid grid-cols-[1fr_auto] py-3 border-b border-gray-100"><div><p className="text-sm text-gray-700">+{x.credits_added} crédits</p><p className="text-xs text-gray-400">{new Date(x.created_at).toLocaleString('fr-FR')}</p></div><span className="text-xs text-gray-500">{x.operator_name||'Administration Omnia'}</span></div>)}</div>:<p className="text-sm text-gray-500">Aucun achat de crédits enregistré.</p>}
     </section>
   </>}
 </div></AdminLayout>
}
