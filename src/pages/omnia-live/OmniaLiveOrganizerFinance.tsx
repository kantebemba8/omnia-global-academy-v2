import {useEffect,useState} from 'react';
import {liveApi} from './liveApi';
import OrganizerShell from './organizer/OrganizerShell';
import {liveStatusLabel} from '../../lib/omniaLiveLabels';

export default function OmniaLiveOrganizerFinance(){
 const [data,setData]=useState<any>(null),[error,setError]=useState('');
 useEffect(()=>{liveApi('organizer_ledger_mine').then(setData).catch(e=>setError(e instanceof Error?e.message:'Erreur'))},[]);
 return <OrganizerShell title="Revenus & Payouts" subtitle="Suivez vos ventes, la commission Omnia Global Academy, votre part organisateur et vos paiements.">
  {error&&<div className="mb-5 border-l-2 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
  <section className="border-b border-slate-200 pb-7"><div className="grid grid-cols-1 gap-x-10 gap-y-5 md:grid-cols-3">{[
   ['Revenu brut',data?.totals?.gross],['Commission Omnia Global Academy',data?.totals?.oga],['Part organisateur',data?.totals?.organizer]
  ].map(([label,value])=><div key={String(label)} className="border-b border-slate-200 pb-4"><div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div><div className="mt-1 text-2xl font-bold text-[#002050]">{Number(value||0).toFixed(2)}</div></div>)}</div></section>
  <section className="py-7"><h2 className="mb-4 text-lg font-bold text-[#002050]">Historique des revenus</h2>{(data?.entries||[]).length?(<div className="overflow-x-auto"><div className="min-w-[760px]"><div className="grid grid-cols-[1.4fr_.8fr_.8fr_.7fr] border-b border-slate-300 pb-3 text-xs font-semibold uppercase tracking-wide text-slate-400"><div>Événement</div><div>Type</div><div>Statut</div><div className="text-right">Montant</div></div>{(data.entries||[]).map((x:any)=><div key={x.id} className="grid grid-cols-[1.4fr_.8fr_.8fr_.7fr] border-b border-slate-200 py-4 text-sm"><div className="font-semibold text-[#002050]">{x.live_events?.title||'Événement'}</div><div className="text-slate-600">{String(x.entry_type||'—').replaceAll('_',' ')}</div><div className="text-slate-600">{liveStatusLabel(x.status)}</div><div className="text-right font-semibold">{Number(x.organizer_amount||0).toFixed(2)} {x.currency||''}</div></div>)}</div></div>):<div className="border-y border-slate-200 py-10 text-sm text-slate-500">Aucun revenu enregistré pour le moment.</div>}</section>
 </OrganizerShell>
}
