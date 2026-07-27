import {useEffect,useState} from 'react';
import {liveApi} from '../liveApi';
import AdminOmniaLiveShell from './AdminOmniaLiveShell';
import {omniaDialog} from '../../../lib/omniaDialog';

const BLUE='#002050';
const FLAG_LABELS:any={omnia_live_enabled:'Omnia Live',fedapay_live_payments:'Paiements FedaPay',sms_notifications:'Notifications SMS',push_notifications:'Notifications Push',server_recording:'Enregistrement serveur'};
const LEGACY_COMMERCE_FLAGS=new Set(['omnia_live_pass','oga_premium_live']);
const ROLE_LABELS:any={learner:'Apprenant',professor:'Professeur',structure:'Structure',organizer:'Organisateur',super_admin:'Super-admin',moderator:'Modérateur'};

export default function AdminOmniaLiveSecurity(){
 const [policies,setPolicies]=useState<any[]>([]),[flags,setFlags]=useState<any[]>([]),[permissions,setPermissions]=useState<any[]>([]),[msg,setMsg]=useState('');
 const load=async()=>{try{const [p,f,r]=await Promise.all([liveApi('security_policies_list'),liveApi('feature_flags_list'),liveApi('role_permissions_list')]);setPolicies(p.policies||[]);setFlags((f.flags||[]).filter((flag:any)=>!LEGACY_COMMERCE_FLAGS.has(flag.flag_key)));setPermissions(r.permissions||[])}catch(e){setMsg(e instanceof Error?e.message:'Erreur')}};
 useEffect(()=>{load()},[]);

 async function toggleFlag(flag:any){
  const next=!flag.enabled;
  const sensitive=['fedapay_live_payments','server_recording','omnia_live_enabled'].includes(flag.flag_key);
  if(sensitive){
   const r=await omniaDialog({title:next?'Activer cette fonction':'Désactiver cette fonction',message:`${FLAG_LABELS[flag.flag_key]||flag.flag_key} est une fonction sensible. Confirmez uniquement si la configuration technique correspondante est prête.`,confirmLabel:'Confirmer',danger:!next});
   if(!r.confirmed)return;
  }
  try{await liveApi('feature_flag_save',{method:'POST',body:JSON.stringify({...flag,enabled:next})});await load()}catch(e){setMsg(e instanceof Error?e.message:'Erreur')}
 }
 async function togglePerm(p:any){
  const r=await omniaDialog({title:'Modifier une permission',message:`${ROLE_LABELS[p.role_key]||p.role_key} — ${p.permission_key}. Cette modification agit sur les droits Omnia Live.`,confirmLabel:'Confirmer'});
  if(!r.confirmed)return;
  try{await liveApi('role_permission_save',{method:'POST',body:JSON.stringify({...p,enabled:!p.enabled})});await load()}catch(e){setMsg(e instanceof Error?e.message:'Erreur')}
 }

 return <AdminOmniaLiveShell title="Sécurité & Permissions" subtitle="Contrôlez les droits, politiques et activations sensibles de production.">
  {msg&&<div className="mb-5 border-l-2 border-[#BF8813] bg-amber-50 px-4 py-3 text-sm">{msg}</div>}
  <section className="border-b border-slate-200 pb-7"><h2 className="mb-4 text-lg font-bold" style={{color:BLUE}}>Fonctions activables</h2>{flags.map(f=><div key={f.flag_key} className="flex items-center justify-between gap-4 border-b border-slate-200 py-4"><div><div className="font-semibold" style={{color:BLUE}}>{FLAG_LABELS[f.flag_key]||f.flag_key}</div><div className="mt-1 text-xs text-slate-500">{f.enabled?'Activé':'Désactivé'}{f.config?.environment?` · environnement ${f.config.environment}`:''}</div></div><input type="checkbox" checked={!!f.enabled} onChange={()=>toggleFlag(f)}/></div>)}</section>
  <section className="border-b border-slate-200 py-7"><h2 className="mb-4 text-lg font-bold" style={{color:BLUE}}>Politiques de sécurité</h2>{policies.map(p=><div key={p.policy_key} className="border-b border-slate-200 py-4"><div className="font-semibold" style={{color:BLUE}}>{p.policy_key}</div><pre className="mt-2 whitespace-pre-wrap text-xs text-slate-500">{JSON.stringify(p.config,null,2)}</pre></div>)}</section>
  <section className="py-7"><h2 className="mb-4 text-lg font-bold" style={{color:BLUE}}>Permissions par rôle</h2>{permissions.length?<div className="overflow-x-auto"><div className="min-w-[850px]"><div className="grid grid-cols-[1fr_1.5fr_.8fr_.5fr] border-b border-slate-300 pb-3 text-xs font-semibold uppercase tracking-wide text-slate-400"><div>Rôle</div><div>Permission</div><div>Portée</div><div className="text-right">État</div></div>{permissions.map(p=><label key={p.id} className="grid grid-cols-[1fr_1.5fr_.8fr_.5fr] items-center border-b border-slate-200 py-4 text-sm"><div className="font-semibold">{ROLE_LABELS[p.role_key]||p.role_key}</div><div>{p.permission_key}</div><div>{p.scope}</div><div className="text-right"><input type="checkbox" checked={!!p.enabled} onChange={()=>togglePerm(p)}/></div></label>)}</div></div>:<div className="text-sm text-slate-500">Aucune permission configurée.</div>}</section>
 </AdminOmniaLiveShell>
}
