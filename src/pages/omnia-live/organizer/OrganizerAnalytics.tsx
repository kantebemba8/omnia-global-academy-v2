import {useEffect,useMemo,useState} from 'react';
import OrganizerShell from './OrganizerShell';
import {liveApi} from '../liveApi';

const BLUE='#002050';
const GOLD='#BF8813';

export default function OrganizerAnalytics(){
 const [data,setData]=useState<any>({events:[],analytics:[]}),[msg,setMsg]=useState('');
 useEffect(()=>{liveApi('organizer_analytics').then(setData).catch(e=>setMsg(e instanceof Error?e.message:'Erreur'))},[]);
 const totals=useMemo(()=>(data.analytics||[]).reduce((a:any,x:any)=>{a.reg+=Number(x.registrations||0);a.paid+=Number(x.paid_orders||0);a.gross+=Number(x.gross_revenue||0);a.att+=Number(x.live_attendees||0);a.replay+=Number(x.replay_viewers||0);return a},{reg:0,paid:0,gross:0,att:0,replay:0}),[data]);
 const items=[['Inscriptions',totals.reg],['Commandes payées',totals.paid],['CA brut',totals.gross],['Participants Live',totals.att],['Spectateurs Replay',totals.replay]];
 return <OrganizerShell title="Statistiques" subtitle="Performance globale de vos contenus Omnia Live.">
  {msg&&<div className="mb-5 border-l-2 border-[#BF8813] bg-amber-50 px-4 py-3 text-sm">{msg}</div>}
  <div className="grid grid-cols-2 gap-x-8 gap-y-5 md:grid-cols-5">{items.map(([l,v])=><div key={String(l)} className="border-b border-slate-200 pb-4"><div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{l}</div><div className="mt-1 text-xl font-bold" style={{color:l==='CA brut'?GOLD:BLUE}}>{Number(v||0).toLocaleString('fr-FR',{maximumFractionDigits:l==='CA brut'?2:0})}</div></div>)}</div>
  <p className="mt-6 text-xs text-slate-500">Ces statistiques doivent provenir des inscriptions, présences, commandes et lectures réelles enregistrées par Omnia Live.</p>
 </OrganizerShell>
}
