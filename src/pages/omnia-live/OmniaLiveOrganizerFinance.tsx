import { useEffect, useState } from 'react';
import OmniaLiveLayout from '../../components/omnia-live/OmniaLiveLayout';
import { liveApi } from './liveApi';

export default function OmniaLiveOrganizerFinance(){
 const [data,setData]=useState<any>(null),[error,setError]=useState('');
 useEffect(()=>{liveApi('organizer_ledger_mine').then(setData).catch(e=>setError(e instanceof Error?e.message:'Erreur'))},[]);
 return <OmniaLiveLayout><section className="mx-auto max-w-6xl px-4 py-10 md:px-8"><h1 className="text-3xl font-black" style={{color:'#002050'}}>Revenus Omnia Live</h1>{error&&<div className="mt-4 rounded-xl bg-red-50 p-4 text-red-700">{error}</div>}{data&&<><div className="mt-6 grid gap-4 md:grid-cols-3">{[['Brut',data.totals?.gross],['Commission OGA',data.totals?.oga],['Part organisateur',data.totals?.organizer]].map(([l,v])=><div key={l} className="rounded-2xl border bg-white p-5"><div className="text-sm text-slate-500">{l}</div><div className="mt-1 text-2xl font-black">{Number(v||0).toFixed(2)}</div></div>)}</div><div className="mt-6 space-y-3">{(data.entries||[]).map((x:any)=><div key={x.id} className="rounded-2xl border bg-white p-4"><div className="font-bold">{x.live_events?.title}</div><div className="text-sm text-slate-500">{x.entry_type} · {x.status} · {x.organizer_amount} {x.currency}</div></div>)}</div></>}</section></OmniaLiveLayout>
}
