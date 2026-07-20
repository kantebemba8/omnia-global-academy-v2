import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import OmniaLiveLayout from '../../../components/omnia-live/OmniaLiveLayout';
import { liveApi } from '../liveApi';

export default function OmniaLiveEntitlements(){
 const [rows,setRows]=useState<any[]>([]),[msg,setMsg]=useState('');
 useEffect(()=>{liveApi('commerce_entitlements_mine').then(d=>setRows(d.entitlements||[])).catch(e=>setMsg(e instanceof Error?e.message:'Erreur'))},[]);
 return <OmniaLiveLayout><section className="mx-auto max-w-6xl px-4 py-10"><h1 className="text-3xl font-black text-[#002050]">Mes accès Omnia Live</h1>{msg&&<div className="mt-4 rounded-xl bg-slate-50 p-4">{msg}</div>}<div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{rows.map(x=><div key={x.id} className="rounded-2xl border bg-white p-5"><div className="text-xs uppercase text-slate-400">{x.entitlement_type}</div><div className="mt-1 font-bold text-[#002050]">{x.live_commerce_products?.title||x.live_events?.title||x.live_media?.title}</div><div className="mt-2 text-sm text-slate-500">{x.expires_at?`Expire le ${new Date(x.expires_at).toLocaleDateString()}`:'Accès sans expiration définie'}</div><div className="mt-4">{x.media_id?<Link to={`/omnia-live/watch/${x.media_id}`} className="rounded-lg bg-[#002050] px-3 py-2 text-sm font-bold text-white">Regarder</Link>:x.event_id?<Link to={`/omnia-live/${x.event_id}`} className="rounded-lg border px-3 py-2 text-sm font-semibold">Ouvrir</Link>:null}</div></div>)}{!rows.length&&<div className="rounded-2xl bg-slate-50 p-8 text-slate-500">Aucun accès actif.</div>}</div></section></OmniaLiveLayout>
}
