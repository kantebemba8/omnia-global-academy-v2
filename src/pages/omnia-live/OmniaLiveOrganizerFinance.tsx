import {useEffect,useMemo,useState} from 'react';
import {liveApi} from './liveApi';
import OrganizerShell from './organizer/OrganizerShell';
import {liveStatusLabel} from '../../lib/omniaLiveLabels';

const BLUE='#002050';
const GOLD='#BF8813';

function money(v:any,c=''){return `${Number(v||0).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})}${c?` ${c}`:''}`}

export default function OmniaLiveOrganizerFinance(){
 const [data,setData]=useState<any>({entries:[],totals:{}});
 const [requests,setRequests]=useState<any[]>([]);
 const [error,setError]=useState('');
 const [msg,setMsg]=useState('');
 const [amount,setAmount]=useState('');
 const [currency,setCurrency]=useState('XOF');
 const [method,setMethod]=useState('bank_transfer');
 const [accountName,setAccountName]=useState('');
 const [destination,setDestination]=useState('');
 const [busy,setBusy]=useState(false);

 async function load(){
  setError('');
  try{
   const [ledger,payouts]=await Promise.all([
    liveApi('organizer_ledger_mine'),
    liveApi('payout_requests_mine')
   ]);
   setData(ledger||{entries:[],totals:{}});
   setRequests(payouts.requests||[]);
  }catch(e){setError(e instanceof Error?e.message:'Erreur')}
 }
 useEffect(()=>{load()},[]);

 const computed=useMemo(()=>{
  const entries=data?.entries||[];
  const currencyEntries=entries.filter((x:any)=>!currency||x.currency===currency);
  return {
   gross:data?.totals?.gross??currencyEntries.reduce((a:number,x:any)=>a+Number(x.gross_amount||0),0),
   oga:data?.totals?.oga??currencyEntries.reduce((a:number,x:any)=>a+Number(x.oga_amount||0),0),
   organizer:data?.totals?.organizer??currencyEntries.reduce((a:number,x:any)=>a+Number(x.organizer_amount||0),0),
   available:data?.totals?.available??currencyEntries.reduce((a:number,x:any)=>a+Number(x.available_amount||0),0),
   pending:currencyEntries.filter((x:any)=>x.status==='pending').reduce((a:number,x:any)=>a+Number(x.organizer_amount||0),0),
  };
 },[data,currency]);

 async function requestPayout(){
  const n=Number(amount);
  if(!Number.isFinite(n)||n<=0){setMsg('Saisissez un montant valide.');return}
  if(n>Number(computed.available||0)){setMsg('Le montant demandé dépasse le solde actuellement disponible.');return}
  if(!destination.trim()){setMsg('Renseignez la destination du paiement.');return}
  setBusy(true);setMsg('');
  try{
   await liveApi('payout_request_create',{method:'POST',body:JSON.stringify({
    currency,
    requested_amount:n,
    payout_method:method,
    payout_details:{account_name:accountName.trim()||null,destination:destination.trim()},
   })});
   setAmount('');setDestination('');setAccountName('');
   setMsg('Demande de paiement envoyée. Elle doit être validée avant tout versement.');
   await load();
  }catch(e){setMsg(e instanceof Error?e.message:'Impossible d’envoyer la demande.')}
  finally{setBusy(false)}
 }

 return <OrganizerShell title="Revenus & Payouts" subtitle="Suivez vos ventes, la commission Omnia Global Academy, votre solde disponible et vos demandes de paiement.">
  {error&&<div className="mb-5 border-l-2 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
  {msg&&<div className="mb-5 border-l-2 border-[#BF8813] bg-amber-50 px-4 py-3 text-sm">{msg}</div>}

  <section className="border-b border-slate-200 pb-7">
   <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
    <h2 className="text-lg font-bold" style={{color:BLUE}}>Situation financière</h2>
    <label className="text-sm"><span className="mr-2 text-slate-500">Devise</span><select value={currency} onChange={e=>setCurrency(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2"><option>XOF</option><option>EUR</option><option>USD</option></select></label>
   </div>
   <div className="grid grid-cols-2 gap-x-8 gap-y-5 md:grid-cols-5">
    {[
     ['Revenu brut',computed.gross],
     ['Commission OGA',computed.oga],
     ['Part organisateur',computed.organizer],
     ['En attente de disponibilité',computed.pending],
     ['Disponible au paiement',computed.available],
    ].map(([label,value])=><div key={String(label)} className="border-b border-slate-200 pb-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-xl font-bold" style={{color:label==='Disponible au paiement'?GOLD:BLUE}}>{money(value,currency)}</div>
    </div>)}
   </div>
   <p className="mt-4 text-xs text-slate-500">Le solde devient disponible seulement après le délai de sécurité applicable aux remboursements et après validation des transactions.</p>
  </section>

  <section className="border-b border-slate-200 py-7">
   <h2 className="text-lg font-bold" style={{color:BLUE}}>Demander un paiement</h2>
   <p className="mt-1 text-sm text-slate-500">Une demande ne peut porter que sur le solde réellement disponible. Le versement reste soumis à validation administrative.</p>
   <div className="mt-5 grid gap-4 md:grid-cols-2">
    <label><span className="mb-1 block text-sm font-semibold">Montant</span><input type="number" min="0" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} placeholder={`Maximum ${money(computed.available,currency)}`} className="w-full rounded-lg border border-slate-300 p-3 text-sm"/></label>
    <label><span className="mb-1 block text-sm font-semibold">Méthode</span><select value={method} onChange={e=>setMethod(e.target.value)} className="w-full rounded-lg border border-slate-300 p-3 text-sm"><option value="bank_transfer">Virement bancaire</option><option value="mobile_money">Mobile Money</option><option value="manual">Autre méthode validée</option></select></label>
    <label><span className="mb-1 block text-sm font-semibold">Nom du bénéficiaire</span><input value={accountName} onChange={e=>setAccountName(e.target.value)} placeholder="Nom du titulaire" className="w-full rounded-lg border border-slate-300 p-3 text-sm"/></label>
    <label><span className="mb-1 block text-sm font-semibold">{method==='mobile_money'?'Numéro Mobile Money':method==='bank_transfer'?'IBAN / référence bancaire':'Destination du paiement'}</span><input value={destination} onChange={e=>setDestination(e.target.value)} className="w-full rounded-lg border border-slate-300 p-3 text-sm"/></label>
   </div>
   <button onClick={requestPayout} disabled={busy||Number(computed.available||0)<=0} className="mt-4 rounded-lg bg-[#002050] px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{busy?'Envoi…':'Envoyer la demande de paiement'}</button>
  </section>

  <section className="border-b border-slate-200 py-7">
   <h2 className="mb-4 text-lg font-bold" style={{color:BLUE}}>Demandes de paiement</h2>
   {requests.length?(
    <div className="overflow-x-auto"><div className="min-w-[760px]">
     <div className="grid grid-cols-[1fr_.8fr_.8fr_1.2fr] border-b border-slate-300 pb-3 text-xs font-semibold uppercase tracking-wide text-slate-400"><div>Date</div><div>Montant</div><div>Statut</div><div>Décision</div></div>
     {requests.map(x=><div key={x.id} className="grid grid-cols-[1fr_.8fr_.8fr_1.2fr] border-b border-slate-200 py-4 text-sm">
      <div>{x.created_at?new Date(x.created_at).toLocaleString('fr-FR'):'—'}</div>
      <div className="font-semibold">{money(x.requested_amount,x.currency)}</div>
      <div>{liveStatusLabel(x.status)}</div>
      <div className="text-slate-600">{x.decision_note||'—'}</div>
     </div>)}
    </div></div>
   ):<div className="border-y border-slate-200 py-9 text-sm text-slate-500">Aucune demande de paiement.</div>}
  </section>

  <section className="py-7">
   <h2 className="mb-4 text-lg font-bold" style={{color:BLUE}}>Historique des revenus</h2>
   {(data?.entries||[]).length?(
    <div className="overflow-x-auto"><div className="min-w-[820px]">
     <div className="grid grid-cols-[1.4fr_.7fr_.7fr_.8fr] border-b border-slate-300 pb-3 text-xs font-semibold uppercase tracking-wide text-slate-400"><div>Événement</div><div>Type</div><div>Statut</div><div className="text-right">Part organisateur</div></div>
     {(data.entries||[]).map((x:any)=><div key={x.id} className="grid grid-cols-[1.4fr_.7fr_.7fr_.8fr] border-b border-slate-200 py-4 text-sm">
      <div className="font-semibold text-[#002050]">{x.live_events?.title||'Événement'}</div>
      <div>{String(x.entry_type||'—').replaceAll('_',' ')}</div>
      <div>{liveStatusLabel(x.status)}</div>
      <div className="text-right font-semibold">{money(x.organizer_amount,x.currency)}</div>
     </div>)}
    </div></div>
   ):<div className="border-y border-slate-200 py-9 text-sm text-slate-500">Aucun revenu enregistré.</div>}
  </section>
 </OrganizerShell>
}
