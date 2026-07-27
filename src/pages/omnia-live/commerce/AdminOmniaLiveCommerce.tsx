import {useEffect,useState} from 'react';
import {liveApi} from '../liveApi';
import AdminOmniaLiveShell from '../admin/AdminOmniaLiveShell';
import {omniaDialog} from '../../../lib/omniaDialog';
import {liveStatusLabel} from '../../../lib/omniaLiveLabels';

const BLUE='#002050';

export default function AdminOmniaLiveCommerce(){
 const [discounts,setDiscounts]=useState<any[]>([]),[payouts,setPayouts]=useState<any[]>([]),[msg,setMsg]=useState('');
 const load=async()=>{try{const [d,p]=await Promise.all([liveApi('discount_admin_list'),liveApi('payout_admin_requests')]);setDiscounts(d.discounts||[]);setPayouts(p.requests||[])}catch(e){setMsg(e instanceof Error?e.message:'Erreur')}};
 useEffect(()=>{load()},[]);
 async function discount(){
  const c=await omniaDialog({title:'Créer un code promotionnel',confirmLabel:'Continuer',inputLabel:'Code promotionnel',inputRequired:true});if(!c.confirmed)return;
  const v=await omniaDialog({title:'Réduction',message:'Saisissez un pourcentage entre 1 et 100.',confirmLabel:'Créer',inputLabel:'Pourcentage',inputRequired:true});if(!v.confirmed)return;
  const code=String(c.value||'').trim().toUpperCase(),value=Number(v.value);if(!code||!Number.isFinite(value)||value<=0||value>100){setMsg('Code ou pourcentage invalide.');return}
  try{await liveApi('discount_admin_create',{method:'POST',body:JSON.stringify({code,discount_type:'percent',discount_value:value,status:'active'})});setMsg('Code promotionnel créé.');await load()}catch(e){setMsg(e instanceof Error?e.message:'Erreur')}
 }
 async function decide(id:string,status:string){
  const r=await omniaDialog({title:status==='rejected'?'Refuser la demande':status==='paid'?'Marquer comme payée':'Approuver la demande',message:status==='paid'?'Confirmez uniquement après le versement réel.':'Cette décision sera conservée dans l’historique.',confirmLabel:'Confirmer',inputLabel:'Note de décision',inputRequired:status==='rejected',danger:status==='rejected'});if(!r.confirmed)return;
  try{await liveApi('payout_admin_decision',{method:'POST',body:JSON.stringify({request_id:id,status,decision_note:r.value||''})});await load()}catch(e){setMsg(e instanceof Error?e.message:'Erreur')}
 }

 return <AdminOmniaLiveShell title="Commerce Omnia Live" subtitle="Codes promotionnels et payouts des ventes Omnia Live.">{msg&&<div className="mb-5 border-l-2 border-[#BF8813] bg-amber-50 px-4 py-3 text-sm">{msg}</div>}
 <section className="border-b border-slate-200 pb-7"><div className="mb-4 flex justify-between"><h2 className="font-bold" style={{color:BLUE}}>Codes promotionnels</h2><button onClick={discount} className="text-sm font-bold" style={{color:BLUE}}>+ Créer</button></div>{discounts.map(x=><div key={x.id} className="grid grid-cols-[1fr_.7fr_.7fr] border-b border-slate-200 py-4 text-sm"><div className="font-semibold">{x.code}</div><div>{x.discount_value}{x.discount_type==='percent'?' %':''}</div><div>{liveStatusLabel(x.status)}</div></div>)}</section>
 <section className="border-b border-slate-200 py-7"><h2 className="mb-4 font-bold" style={{color:BLUE}}>Demandes payout</h2>{payouts.map(x=><div key={x.id} className="grid grid-cols-[1.2fr_.8fr_.8fr_1fr] items-center border-b border-slate-200 py-4 text-sm"><div className="font-semibold">{x.users?.full_name||x.organizer_user_id}</div><div>{x.requested_amount} {x.currency}</div><div>{liveStatusLabel(x.status)}</div><div className="flex justify-end gap-3">{x.status==='pending'&&<button onClick={()=>decide(x.id,'approved')} className="font-semibold text-emerald-700">Approuver</button>}{x.status==='approved'&&<button onClick={()=>decide(x.id,'paid')} className="font-semibold" style={{color:BLUE}}>Marquer payé</button>}{!['paid','rejected','cancelled'].includes(x.status)&&<button onClick={()=>decide(x.id,'rejected')} className="font-semibold text-red-700">Refuser</button>}</div></div>)}</section>
 <section className="py-7"><h2 className="font-bold" style={{color:BLUE}}>Abonnements et packs</h2><p className="mt-1 text-sm text-slate-500">Les anciens plans Omnia Live ont été retirés. Les futurs abonnements des organisateurs et packs de capacité seront créés dans le moteur central de monétisation.</p></section>
 </AdminOmniaLiveShell>
}
