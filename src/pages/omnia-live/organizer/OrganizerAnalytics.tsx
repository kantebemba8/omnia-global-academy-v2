import { useEffect, useMemo, useState } from 'react';
import OrganizerShell from './OrganizerShell';
import { liveApi } from '../liveApi';
export default function OrganizerAnalytics(){
 const [data,setData]=useState<any>({events:[],analytics:[]}),[msg,setMsg]=useState('');
 useEffect(()=>{liveApi('organizer_analytics').then(setData).catch(e=>setMsg(e instanceof Error?e.message:'Erreur'))},[]);
 const totals=useMemo(()=>data.analytics.reduce((a:any,x:any)=>{a.reg+=Number(x.registrations||0);a.paid+=Number(x.paid_orders||0);a.gross+=Number(x.gross_revenue||0);a.att+=Number(x.live_attendees||0);a.replay+=Number(x.replay_viewers||0);return a},{reg:0,paid:0,gross:0,att:0,replay:0}),[data]);
 return <OrganizerShell title="Statistiques" subtitle="Performance globale de vos contenus Omnia Live.">{msg&&<div className="mb-4 rounded-xl bg-slate-50 p-4">{msg}</div>}<div className="grid gap-4 md:grid-cols-5">{[['Inscriptions',totals.reg],['Commandes',totals.paid],['CA brut',totals.gross],['Participants Live',totals.att],['Replay viewers',totals.replay]].map(([l,v])=><div key={l} className="rounded-2xl border bg-white p-5"><div className="text-sm text-slate-500">{l}</div><div className="mt-2 text-2xl font-black text-[#002050]">{Number(v||0).toFixed(l==='CA brut'?2:0)}</div></div>)}</div></OrganizerShell>
}
