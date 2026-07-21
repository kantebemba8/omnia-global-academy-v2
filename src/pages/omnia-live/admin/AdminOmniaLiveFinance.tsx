import { useEffect,useMemo,useState } from 'react';
import { Plus, X } from 'lucide-react';
import { liveApi } from '../liveApi';
import { omniaDialog } from '../../../lib/omniaDialog';
import AdminOmniaLiveShell from './AdminOmniaLiveShell';

export default function AdminOmniaLiveFinance(){
 const [d,setD]=useState<any>({orders:[],ledger:[],payouts:[],refunds:[]}),[msg,setMsg]=useState(''),[open,setOpen]=useState(false);
 const [form,setForm]=useState({organizer_user_id:'',currency:'XOF',notes:''});
 const load=()=>liveApi('admin_finance').then(setD).catch(e=>setMsg(e instanceof Error?e.message:'Erreur'));useEffect(()=>{load()},[]);
 const totals=useMemo(()=>({gross:d.orders.filter((x:any)=>x.payment_status==='paid').reduce((a:number,x:any)=>a+Number(x.amount||0),0),oga:d.ledger.reduce((a:number,x:any)=>a+Number(x.oga_amount||0),0),due:d.ledger.filter((x:any)=>['pending','available'].includes(x.status)).reduce((a:number,x:any)=>a+Number(x.organizer_amount||0),0)}),[d]);

 async function createPayout(){
   if(!form.organizer_user_id.trim()){setMsg("L'identifiant de l'organisateur est obligatoire.");return}
   try{await liveApi('admin_payout_create',{method:'POST',body:JSON.stringify(form)});setOpen(false);setMsg('Payout créé en brouillon.');await load()}catch(e){setMsg(e instanceof Error?e.message:'Erreur')}
 }
 async function payout(id:string,status:string){
   const labels:any={approved:['Approuver le payout','Le payout pourra ensuite être traité.'],paid:['Marquer le payout comme payé','Confirmez uniquement après le versement réel à l’organisateur.'],cancelled:['Annuler le payout','Le payout sera annulé.']};
   const [title,message]=labels[status]||['Confirmer','Confirmer cette action.'];
   const r=await omniaDialog({title,message,confirmLabel:'Confirmer',danger:status==='cancelled'});if(!r.confirmed)return;
   try{await liveApi('admin_payout_decision',{method:'POST',body:JSON.stringify({payout_id:id,status})});await load()}catch(e){setMsg(e instanceof Error?e.message:'Erreur')}
 }

 return <AdminOmniaLiveShell title="Finance & Payouts" subtitle="Suivez les ventes, commissions et versements dus aux organisateurs.">
  <div className="mb-5 flex justify-end"><button onClick={()=>setOpen(true)} className="flex items-center gap-2 rounded-xl bg-[#002050] px-4 py-3 font-bold text-white"><Plus size={17}/>Créer un payout</button></div>
  {msg&&<div className="mb-4 rounded-xl bg-slate-50 p-4">{msg}</div>}
  <div className="grid gap-4 md:grid-cols-3">{[['CA encaissé',totals.gross],['Revenu OGA',totals.oga],['Part organisateurs due',totals.due]].map(([l,v])=><div key={l} className="rounded-2xl border bg-white p-5"><div className="text-sm text-slate-500">{l}</div><div className="mt-1 text-2xl font-black text-[#002050]">{Number(v||0).toFixed(2)}</div></div>)}</div>
  <div className="mt-7 overflow-hidden rounded-2xl border bg-white"><div className="border-b px-5 py-4"><h2 className="font-bold text-[#002050]">Payouts</h2><p className="text-sm text-slate-500">Un payout regroupe les montants disponibles à verser à un organisateur dans une devise.</p></div>
   <div className="divide-y">{d.payouts.map((x:any)=><div key={x.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><b>{x.batch_number}</b><div className="text-sm text-slate-500">{x.amount} {x.currency} · {x.status}</div></div><div className="flex gap-2">{x.status==='draft'&&<button onClick={()=>payout(x.id,'approved')} className="rounded-lg border px-3 py-2">Approuver</button>}{['approved','processing'].includes(x.status)&&<button onClick={()=>payout(x.id,'paid')} className="rounded-lg bg-[#002050] px-3 py-2 text-white">Marquer payé</button>}{!['paid','cancelled'].includes(x.status)&&<button onClick={()=>payout(x.id,'cancelled')} className="rounded-lg border border-red-200 px-3 py-2 text-red-700">Annuler</button>}</div></div>)}
   {!d.payouts.length&&<div className="p-6 text-slate-500">Aucun payout créé.</div>}</div>
  </div>

  {open&&<div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/40 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
   <div className="flex items-center justify-between"><div><h2 className="text-xl font-bold text-[#002050]">Créer un payout</h2><p className="mt-1 text-sm text-slate-500">Le système regroupe automatiquement toutes les lignes comptables disponibles de cet organisateur et de cette devise.</p></div><button onClick={()=>setOpen(false)}><X/></button></div>
   <div className="mt-5 space-y-4">
    <label className="block"><span className="text-sm font-semibold">Organisateur</span><input value={form.organizer_user_id} onChange={e=>setForm({...form,organizer_user_id:e.target.value})} placeholder="ID utilisateur organisateur" className="mt-1 w-full rounded-xl border p-3"/></label>
    <label className="block"><span className="text-sm font-semibold">Devise</span><select value={form.currency} onChange={e=>setForm({...form,currency:e.target.value})} className="mt-1 w-full rounded-xl border p-3"><option>XOF</option><option>EUR</option><option>USD</option></select></label>
    <label className="block"><span className="text-sm font-semibold">Note interne</span><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} className="mt-1 w-full rounded-xl border p-3"/></label>
   </div>
   <div className="mt-6 flex justify-end gap-2"><button onClick={()=>setOpen(false)} className="rounded-xl border px-4 py-2.5">Annuler</button><button onClick={createPayout} className="rounded-xl bg-[#002050] px-4 py-2.5 font-bold text-white">Créer</button></div>
  </div></div>}
 </AdminOmniaLiveShell>
}