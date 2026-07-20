import { useEffect,useState } from 'react';
import OmniaLiveLayout from '../../../components/omnia-live/OmniaLiveLayout';
import { liveApi } from '../liveApi';

export default function OmniaLiveSystemStatus(){
 const [s,setS]=useState<any>(null);
 useEffect(()=>{liveApi('system_status').then(setS).catch(()=>setS({ok:false}))},[]);
 return <OmniaLiveLayout><section className="mx-auto max-w-4xl px-4 py-12"><h1 className="text-3xl font-black text-[#002050]">État Omnia Live</h1><div className="mt-7 rounded-3xl border bg-white p-6">{!s?<div>Chargement...</div>:<><div className={`text-xl font-bold ${s.ok?'text-emerald-700':'text-red-700'}`}>{s.ok?'Tous les services essentiels sont opérationnels':'Un ou plusieurs services nécessitent une attention'}</div><div className="mt-5 grid gap-3 md:grid-cols-2">{Object.entries(s.services||{}).map(([k,v]:any)=><div key={k} className="rounded-xl bg-slate-50 p-4"><b>{k}</b><div className="text-sm text-slate-500">{v?.status||String(v)}</div></div>)}</div></>}</div></section></OmniaLiveLayout>
}