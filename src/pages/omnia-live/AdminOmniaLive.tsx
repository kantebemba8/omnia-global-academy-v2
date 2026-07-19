import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { liveApi } from './liveApi';

const BLUE='#002050', GOLD='#BF8813';

export default function AdminOmniaLive(){
  const [items,setItems]=useState<any[]>([]),[selected,setSelected]=useState<any>(null),[loading,setLoading]=useState(true),[message,setMessage]=useState('');
  const [reason,setReason]=useState(''),[price,setPrice]=useState(''),[replayPrice,setReplayPrice]=useState(''),[commission,setCommission]=useState('20'),[payoutDelay,setPayoutDelay]=useState('48');

  const load=async()=>{setLoading(true);try{const d=await liveApi('admin_queue');setItems(d.items||[])}catch(e){setMessage(e instanceof Error?e.message:'Chargement impossible.')}finally{setLoading(false)}};
  useEffect(()=>{load()},[]);

  async function open(item:any){
    setMessage('');
    try{const d=await liveApi('studio_get',{}, {event_id:item.id});setSelected(d);setPrice(String(d.event?.price_amount??0));setReplayPrice(String(d.event?.proposed_replay_price_amount??''));}
    catch(e){setMessage(e instanceof Error?e.message:'Ouverture impossible.')}
  }
  async function review(decision:string){
    if(!selected)return;
    try{await liveApi('admin_review',{method:'POST',body:JSON.stringify({event_id:selected.event.id,decision,reason})});setReason('');await load();await open({...selected.event});setMessage('Décision enregistrée.');}
    catch(e){setMessage(e instanceof Error?e.message:'Action impossible.')}
  }
  async function saveTerms(){
    if(!selected)return; const c=Number(commission||0);
    try{await liveApi('set_commercial_terms',{method:'POST',body:JSON.stringify({
      event_id:selected.event.id,live_price_amount:Number(price||0),replay_price_amount:replayPrice===''?null:Number(replayPrice),
      currency:selected.event.currency||'XOF',oga_commission_percent:c,organizer_share_percent:100-c,payout_delay_hours:Number(payoutDelay||48),
      refund_policy:selected.event.organizer_refund_proposal||selected.event.refund_policy_snapshot||{},
      cancellation_policy:selected.event.organizer_cancellation_proposal||selected.event.cancellation_policy_snapshot||{}
    })});await open(selected.event);setMessage('Conditions commerciales enregistrées.');}
    catch(e){setMessage(e instanceof Error?e.message:'Enregistrement impossible.')}
  }
  async function publish(){if(!selected)return;try{await liveApi('publish',{method:'POST',body:JSON.stringify({event_id:selected.event.id})});await load();await open(selected.event);setMessage('Contenu publié.');}catch(e){setMessage(e instanceof Error?e.message:'Publication impossible.')}}

  return <AdminLayout><div className="p-6 md:p-8"><h1 className="text-3xl font-black" style={{color:BLUE}}>Gestion Omnia Live</h1><p className="mt-2 text-slate-600">Validation, conditions commerciales et publication.</p>
    {message&&<div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm">{message}</div>}
    <div className="mt-8 grid gap-6 xl:grid-cols-[390px_1fr]">
      <div className="rounded-2xl border bg-white p-4"><div className="mb-3 font-bold" style={{color:BLUE}}>Demandes</div>{loading?<p className="text-sm text-slate-500">Chargement...</p>:items.length?<div className="space-y-2">{items.map(x=><button key={x.id} onClick={()=>open(x)} className="w-full rounded-xl border p-3 text-left hover:bg-slate-50" style={{borderColor:selected?.event?.id===x.id?GOLD:'#E2E8F0'}}><div className="font-semibold">{x.title}</div><div className="mt-1 text-xs text-slate-500">{x.organizer_display_name} · {x.status}</div></button>)}</div>:<p className="text-sm text-slate-500">Aucune demande.</p>}</div>
      <div className="rounded-2xl border bg-white p-5 md:p-7">{!selected?<div className="text-slate-500">Sélectionnez une demande.</div>:<>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-xs uppercase text-slate-400">{selected.event.status}</div><h2 className="text-2xl font-black" style={{color:BLUE}}>{selected.event.title}</h2><p className="mt-1 text-sm text-slate-500">{selected.event.organizer_display_name}</p></div><a href={`/omnia-live/${selected.event.id}`} target="_blank" rel="noreferrer" className="rounded-xl border px-4 py-2 text-sm font-semibold">Prévisualiser</a></div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">{[['Type',selected.event.delivery_type],['Format',selected.event.event_type],['Visibilité',selected.event.visibility]].map(([a,b])=><div key={a} className="rounded-xl bg-slate-50 p-4"><div className="text-xs text-slate-400">{a}</div><div className="font-semibold">{b||'—'}</div></div>)}</div>
        <div className="mt-6"><label className="mb-2 block font-semibold">Motif / message</label><textarea value={reason} onChange={e=>setReason(e.target.value)} rows={3} className="w-full rounded-xl border border-slate-300 p-3"/></div>
        <div className="mt-4 flex flex-wrap gap-2"><button onClick={()=>review('start_review')} className="rounded-xl border px-4 py-2 font-semibold">Commencer l’examen</button><button onClick={()=>review('request_changes')} className="rounded-xl border border-amber-400 px-4 py-2 font-semibold">Demander modifications</button><button onClick={()=>review('approve')} className="rounded-xl px-4 py-2 font-semibold text-white" style={{background:BLUE}}>Approuver</button><button onClick={()=>review('reject')} className="rounded-xl border border-red-300 px-4 py-2 font-semibold text-red-700">Refuser</button></div>
        <div className="mt-8 border-t pt-6"><h3 className="font-bold" style={{color:BLUE}}>Conditions commerciales</h3><div className="mt-4 grid gap-4 md:grid-cols-4"><label className="text-sm">Prix final<input type="number" value={price} onChange={e=>setPrice(e.target.value)} className="mt-1 w-full rounded-lg border p-2"/></label><label className="text-sm">Prix Replay<input type="number" value={replayPrice} onChange={e=>setReplayPrice(e.target.value)} className="mt-1 w-full rounded-lg border p-2"/></label><label className="text-sm">Commission OGA %<input type="number" min={0} max={100} value={commission} onChange={e=>setCommission(e.target.value)} className="mt-1 w-full rounded-lg border p-2"/></label><label className="text-sm">Délai payout h<input type="number" min={0} value={payoutDelay} onChange={e=>setPayoutDelay(e.target.value)} className="mt-1 w-full rounded-lg border p-2"/></label></div><button onClick={saveTerms} className="mt-4 rounded-xl px-4 py-2 font-bold text-white" style={{background:GOLD}}>Enregistrer les conditions</button></div>
        <div className="mt-8 border-t pt-6"><div className="flex flex-wrap gap-3"><button onClick={publish} className="rounded-xl px-5 py-3 font-bold text-white" style={{background:BLUE}}>Publier</button><button onClick={()=>review('suspend')} className="rounded-xl border border-red-300 px-5 py-3 font-semibold text-red-700">Suspendre</button></div></div>
      </>}</div>
    </div>
  </div></AdminLayout>;
}
