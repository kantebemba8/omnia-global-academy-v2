import { useEffect,useState } from 'react';
import { liveApi } from '../liveApi';
import AdminOmniaLiveShell from './AdminOmniaLiveShell';

const LABELS:Record<string,string>={
 general:'Paramètres généraux',
 limits:'Limites opérationnelles',
 moderation:'Règles de gouvernance',
 live_enabled:'Omnia Live activé',
 recorded_video_enabled:'Vidéos préenregistrées activées',
 replay_enabled:'Replays activés',
 private_live_enabled:'Lives privés activés',
 structure_live_enabled:'Lives des Structures activés',
 default_currency:'Devise par défaut',
 default_commission_percent:'Commission OGA par défaut (%)',
 default_payout_delay_hours:'Délai avant disponibilité du payout (heures)',
 max_upload_bytes:'Taille maximale d’un fichier (octets)',
 default_max_participants:'Participants maximum par défaut',
 max_speakers_per_event:'Intervenants maximum par événement',
 max_sessions_per_training:'Sessions maximum par formation Live',
 media_review_required:'Validation Super Admin des médias obligatoire',
 commercial_terms_required_for_paid:'Conditions commerciales obligatoires pour les Lives payants',
 review_required_before_publish:'Validation obligatoire avant publication',
 cancellation_admin_approval_required:'Validation Super Admin obligatoire pour une annulation',
};

const HELP:Record<string,string>={
 default_currency:'Devise proposée automatiquement lors de la création d’un contenu. XOF convient au lancement en Afrique de l’Ouest.',
 default_commission_percent:'Pourcentage conservé par Omnia sur les ventes. Exemple : 20 signifie 20 % pour OGA et 80 % pour l’organisateur.',
 default_payout_delay_hours:'Nombre d’heures après lesquelles la part organisateur devient disponible pour un versement. 48 h permet un délai de sécurité.',
 max_upload_bytes:'Limite technique maximale d’un fichier téléversé. 10 737 418 240 octets correspondent à environ 10 Go.',
 default_max_participants:'Capacité proposée par défaut pour un Live. Elle peut ensuite être limitée selon le Pack ou l’événement.',
 max_speakers_per_event:'Nombre maximal d’intervenants autorisés dans un même événement.',
 max_sessions_per_training:'Nombre maximal de sessions d’une formation synchrone multi-sessions.',
 media_review_required:'Si activé, les vidéos et replays doivent être validés par le Super Admin avant publication.',
 commercial_terms_required_for_paid:'Si activé, un contenu payant ne peut pas être publié tant que prix, commission et conditions commerciales ne sont pas validés.',
 review_required_before_publish:'Impose la validation Super Admin aux contenus proposés par les organisateurs. Les créations officielles OGA du Super Admin suivent leur workflow administratif.',
 cancellation_admin_approval_required:'Empêche un organisateur d’annuler directement un événement sans contrôle administratif.',
};

export default function AdminOmniaLiveSettings(){
 const [rows,setRows]=useState<any[]>([]),[msg,setMsg]=useState('');
 const legacyKeys=new Set(['omnia_live_pass_enabled','oga_premium_live_enabled','structure_packs_enabled']);
 const sanitize=(row:any)=>({...row,config_value:Object.fromEntries(Object.entries(row.config_value||{}).filter(([key])=>!legacyKeys.has(key)))});
 const load=()=>liveApi('admin_settings_get').then(d=>setRows((d.settings||[]).filter((row:any)=>row.config_key!=='subscriptions').map(sanitize))).catch(e=>setMsg(e instanceof Error?e.message:'Erreur'));useEffect(()=>{load()},[]);
 function change(i:number,key:string,value:any){setRows(x=>x.map((r,n)=>n===i?{...r,config_value:{...r.config_value,[key]:value}}:r))}
 async function save(r:any){try{await liveApi('admin_settings_save',{method:'POST',body:JSON.stringify({config_key:r.config_key,config_value:sanitize(r).config_value,description:r.description,is_public:r.is_public})});setMsg(`${LABELS[r.config_key]||r.config_key} enregistré.`)}catch(e){setMsg(e instanceof Error?e.message:'Erreur')}}

 return <AdminOmniaLiveShell title="Paramètres Omnia Live" subtitle="Réglez les fonctions globales, limites, validations et options commerciales de façon compréhensible.">
  {msg&&<div className="mb-4 rounded-xl bg-slate-50 p-4">{msg}</div>}
  <div className="space-y-6">{rows.map((r,i)=><section key={r.config_key} className="overflow-hidden rounded-2xl border bg-white">
   <div className="border-b px-5 py-4"><h2 className="text-lg font-bold text-[#002050]">{LABELS[r.config_key]||r.config_key}</h2>{r.description&&<p className="mt-1 text-sm text-slate-500">{r.description}</p>}</div>
   <div className="grid gap-4 p-5 md:grid-cols-2">{Object.entries(r.config_value||{}).map(([k,v])=><label key={k} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
    <span className="block font-semibold text-[#002050]">{LABELS[k]||k}</span>
    {HELP[k]&&<span className="mt-1 block text-xs leading-5 text-slate-500">{HELP[k]}</span>}
    {typeof v==='boolean'?<div className="mt-3"><input type="checkbox" checked={v} onChange={e=>change(i,k,e.target.checked)}/><span className="ml-2 text-sm">{v?'Activé':'Désactivé'}</span></div>:<input value={String(v??'')} onChange={e=>change(i,k,typeof v==='number'?Number(e.target.value):e.target.value)} className="mt-3 w-full rounded-lg border bg-white p-2.5"/>}
   </label>)}</div>
   <div className="border-t px-5 py-4"><button onClick={()=>save(r)} className="rounded-xl bg-[#002050] px-4 py-2.5 font-bold text-white">Enregistrer</button></div>
  </section>)}</div>
 </AdminOmniaLiveShell>
}