import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import OmniaLiveLayout from '../../components/omnia-live/OmniaLiveLayout';
import LiveCard from './LiveCard';
import { LiveItem, liveApi } from './liveApi';

export default function OmniaLiveMyLives(){
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[registered,setRegistered]=useState<LiveItem[]>([]),[organized,setOrganized]=useState<any[]>([]),[message,setMessage]=useState('');
  const load=()=>liveApi('my').then(d=>{setRegistered((d.registrations||[]).map((r:any)=>r.live_events).filter(Boolean));setOrganized(d.organized||[])}).catch(e=>setError(e instanceof Error?e.message:'Connexion requise.')).finally(()=>setLoading(false));
  useEffect(()=>{load()},[]);
  async function accept(item:any){try{const d=await liveApi('studio_get',{}, {event_id:item.id});const terms=d.commercial_terms?.[0];if(!terms)throw new Error('Aucune condition commerciale disponible.');await liveApi('accept_terms',{method:'POST',body:JSON.stringify({event_id:item.id,version:terms.version})});setMessage('Conditions acceptées.');await load();}catch(e){setMessage(e instanceof Error?e.message:'Action impossible.')}}

  return <OmniaLiveLayout><section className="mx-auto max-w-7xl px-4 py-12 md:px-8"><h1 className="text-3xl font-black" style={{color:'#002050'}}>Mes Lives</h1>{message&&<div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm">{message}</div>}
    {loading?<p className="mt-8 text-slate-500">Chargement...</p>:error?<div className="mt-8 rounded-2xl border bg-slate-50 p-8"><h2 className="font-bold" style={{color:'#002050'}}>Connexion requise</h2><p className="mt-2 text-sm text-slate-600">{error}</p><Link to="/connexion" className="mt-5 inline-block rounded-xl px-5 py-3 font-bold text-white" style={{background:'#002050'}}>Se connecter</Link></div>:<div className="mt-8 space-y-12">
      <div><h2 className="text-xl font-bold" style={{color:'#002050'}}>Mes inscriptions</h2>{registered.length?<div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{registered.map(x=><LiveCard key={x.id} item={x}/>)}</div>:<p className="mt-4 text-sm text-slate-500">Aucune inscription.</p>}</div>
      {organized.length>0&&<div><h2 className="text-xl font-bold" style={{color:'#002050'}}>Mes contenus organisés</h2><div className="mt-5 space-y-3">{organized.map(x=><div key={x.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-4"><div><div className="font-bold">{x.title}</div><div className="text-xs text-slate-500">{x.status} · {x.delivery_type}</div></div><div className="flex flex-wrap gap-2">{['draft','changes_requested'].includes(x.status)&&<Link to={`/omnia-live/studio/${x.id}`} className="rounded-lg border px-3 py-2 text-sm font-semibold">Reprendre le Studio</Link>}<Link to={`/omnia-live/${x.id}`} className="rounded-lg border px-3 py-2 text-sm font-semibold">Voir</Link>{x.status==='approved'&&Number(x.price_amount||0)>0&&<button onClick={()=>accept(x)} className="rounded-lg px-3 py-2 text-sm font-bold text-white" style={{background:'#002050'}}>Accepter les conditions</button>}</div></div>)}</div></div>}
    </div>}
  </section></OmniaLiveLayout>;
}
