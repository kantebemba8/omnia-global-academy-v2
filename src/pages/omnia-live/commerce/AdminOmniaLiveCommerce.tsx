import {useEffect,useState} from 'react';
import {liveApi} from '../liveApi';
import AdminOmniaLiveShell from '../admin/AdminOmniaLiveShell';
import {omniaDialog} from '../../../lib/omniaDialog';
import {liveStatusLabel} from '../../../lib/omniaLiveLabels';
import {ENDPOINTS} from '../../../lib/config';
import {getSessionToken} from '../../../lib/session';

const BLUE='#002050', GOLD='#BF8813', BORDER='#E4E7EC';
const empty={name:'',discount_value:'10',distribution_mode:'private',message:'',max_uses:'',ends_at:''};

export default function AdminOmniaLiveCommerce(){
 const [discounts,setDiscounts]=useState<any[]>([]),[payouts,setPayouts]=useState<any[]>([]),[msg,setMsg]=useState(''),[form,setForm]=useState({...empty}),[busy,setBusy]=useState(false);
 const load=async()=>{try{const [d,p]=await Promise.all([liveApi('discount_admin_list'),liveApi('payout_admin_requests')]);setDiscounts(d.discounts||[]);setPayouts(p.requests||[])}catch(e){setMsg(e instanceof Error?e.message:'Erreur')}};
 useEffect(()=>{load()},[]);
 async function discount(){
  const value=Number(form.discount_value);if(!form.name.trim()||!Number.isFinite(value)||value<=0||value>100){setMsg('Renseignez un nom et un pourcentage entre 1 et 100.');return}
  setBusy(true);setMsg('');
  try{
   const result=await liveApi('discount_admin_create',{method:'POST',body:JSON.stringify({name:form.name,code:'',discount_type:'percent',discount_value:value,distribution_mode:form.distribution_mode,message:form.message,max_uses:form.max_uses?Number(form.max_uses):null,ends_at:form.ends_at||null,status:'active'})});
   if(form.distribution_mode==='newsletter'){
    const token=getSessionToken()||'';
    const response=await fetch(ENDPOINTS.newsletterSend,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,'x-omnia-session-token':token},body:JSON.stringify({action:'send',subject:form.name,content_html:`<p>${form.message||'Une promotion Omnia Live est disponible.'}</p><p><strong>Code : ${result.discount?.code||''}</strong></p>`})});
    const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.message||body.error||'Code créé, mais envoi Newsletter impossible.');
   }
   setForm({...empty});setMsg('Promotion Omnia Live créée. Le code a été généré automatiquement.');await load();
  }catch(e){setMsg(e instanceof Error?e.message:'Erreur')}finally{setBusy(false)}
 }
 async function decide(id:string,status:string){
  const r=await omniaDialog({title:status==='rejected'?'Refuser la demande':status==='paid'?'Marquer comme payée':'Approuver la demande',message:status==='paid'?'Confirmez uniquement après le versement réel et saisissez sa référence.':'Cette décision sera conservée dans l’historique.',confirmLabel:'Confirmer',inputLabel:status==='paid'?'Référence du versement':'Note de décision',inputRequired:status==='paid'||status==='rejected',danger:status==='rejected'});if(!r.confirmed)return;
  try{await liveApi('payout_admin_decision',{method:'POST',body:JSON.stringify({request_id:id,status,decision_note:status==='paid'?null:(r.value||''),provider_reference:status==='paid'?(r.value||''):null})});await load()}catch(e){setMsg(e instanceof Error?e.message:'Erreur')}
 }
 return <AdminOmniaLiveShell title="Commerce Omnia Live" subtitle="Promotions et reversements des ventes Omnia Live.">{msg&&<div className="mb-5 border-l-2 bg-amber-50 px-4 py-3 text-sm" style={{borderColor:GOLD}}>{msg}</div>}
 <section className="border-b border-slate-200 pb-7"><h2 className="font-bold" style={{color:BLUE}}>Promotions Omnia Live</h2><p className="mt-1 text-sm text-slate-500">Le code est généré automatiquement. Choisissez s’il reste privé, s’affiche au paiement Live ou est diffusé via la Newsletter.</p><div className="mt-4 grid gap-3 md:grid-cols-3"><Field label="Nom"><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></Field><Field label="Réduction %"><input type="number" min="1" max="100" value={form.discount_value} onChange={e=>setForm({...form,discount_value:e.target.value})}/></Field><Field label="Diffusion"><select value={form.distribution_mode} onChange={e=>setForm({...form,distribution_mode:e.target.value})}><option value="private">Privée</option><option value="public">Publique au paiement Live</option><option value="newsletter">Newsletter</option></select></Field><Field label="Utilisations max"><input type="number" min="1" value={form.max_uses} onChange={e=>setForm({...form,max_uses:e.target.value})}/></Field><Field label="Expiration"><input type="date" value={form.ends_at} onChange={e=>setForm({...form,ends_at:e.target.value})}/></Field><Field label="Message"><input value={form.message} onChange={e=>setForm({...form,message:e.target.value})}/></Field></div><button disabled={busy} onClick={discount} className="mt-4 rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-50" style={{background:BLUE}}>Créer la promotion</button><div className="mt-5 divide-y">{discounts.map(x=><div key={x.id} className="grid gap-2 py-4 text-sm md:grid-cols-[1fr_.7fr_.7fr_.7fr]"><div><p className="font-semibold" style={{color:BLUE}}>{x.name||'Promotion Live'}</p><p className="font-mono text-xs text-slate-400">{x.code}</p></div><div>{x.discount_value}{x.discount_type==='percent'?' %':''}</div><div>{x.distribution_mode==='public'?'Publique':x.distribution_mode==='newsletter'?'Newsletter':'Privée'}</div><div>{liveStatusLabel(x.status)}</div></div>)}</div></section>
 <section className="border-b border-slate-200 py-7"><h2 className="mb-4 font-bold" style={{color:BLUE}}>Demandes de reversement</h2>{payouts.map(x=><div key={x.id} className="grid grid-cols-[1.2fr_.8fr_.8fr_1fr] items-center border-b border-slate-200 py-4 text-sm"><div className="font-semibold">{x.users?.full_name||x.organizer_user_id}</div><div>{x.requested_amount} {x.currency}</div><div>{liveStatusLabel(x.status)}</div><div className="flex justify-end gap-3">{x.status==='pending'&&<button onClick={()=>decide(x.id,'approved')} className="font-semibold text-emerald-700">Approuver</button>}{x.status==='approved'&&<button onClick={()=>decide(x.id,'paid')} className="font-semibold" style={{color:BLUE}}>Marquer payé</button>}{!['paid','rejected','cancelled'].includes(x.status)&&<button onClick={()=>decide(x.id,'rejected')} className="font-semibold text-red-700">Refuser</button>}</div></div>)}</section>
 <section className="py-7"><h2 className="font-bold" style={{color:BLUE}}>Abonnements et packs</h2><p className="mt-1 text-sm text-slate-500">Les plans Organisateur Omnia Live sont administrés dans le moteur central « Plans, abonnements & capacités » afin que les quotas Live restent cohérents avec Finance & Commerce.</p></section>
 </AdminOmniaLiveShell>
}
function Field({label,children}:{label:string;children:any}){return <label className="block text-sm"><span className="mb-1 block text-xs font-semibold text-slate-600">{label}</span><div className="[&_input]:w-full [&_input]:rounded-lg [&_input]:border [&_input]:px-3 [&_input]:py-2 [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:px-3 [&_select]:py-2" style={{borderColor:BORDER}}>{children}</div></label>}
