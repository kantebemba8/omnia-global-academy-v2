import {useEffect,useState} from 'react';
import OmniaLiveLayout from '../../../components/omnia-live/OmniaLiveLayout';
import {liveApi} from '../liveApi';

const BLUE='#002050';
export default function OmniaLiveSystemStatus(){
 const [s,setS]=useState<any>(null);
 useEffect(()=>{liveApi('system_status').then(setS).catch(()=>setS({ok:false,services:{}}))},[]);
 return <OmniaLiveLayout><section className="mx-auto max-w-4xl px-4 py-12"><h1 className="text-3xl font-black" style={{color:BLUE}}>État Omnia Live</h1><div className="mt-7 border-y border-slate-200 py-6">{!s?<div>Chargement…</div>:<><div className={`text-xl font-bold ${s.ok?'text-emerald-700':'text-red-700'}`}>{s.ok?'Les services essentiels sont opérationnels':'Un ou plusieurs services nécessitent une attention'}</div><div className="mt-5">{Object.entries(s.services||{}).map(([k,v]:any)=><div key={k} className="flex justify-between border-b border-slate-200 py-3 text-sm"><span>{String(k).replaceAll('_',' ')}</span><b>{v?.status==='ok'?'Opérationnel':v?.status||String(v)}</b></div>)}</div></>}</div></section></OmniaLiveLayout>
}
