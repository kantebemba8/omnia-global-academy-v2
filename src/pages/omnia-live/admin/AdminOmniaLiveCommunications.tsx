import {useEffect,useState} from 'react';
import {liveApi} from '../liveApi';
import AdminOmniaLiveShell from './AdminOmniaLiveShell';
import {omniaDialog} from '../../../lib/omniaDialog';
import {liveStatusLabel} from '../../../lib/omniaLiveLabels';

const CHANNEL_LABELS:any={multi:'Notifications + e-mail',in_app:'Notification Omnia',email:'E-mail',sms:'SMS',push:'Push'};

export default function AdminOmniaLiveCommunications(){
 const [templates,setTemplates]=useState<any[]>([]),[campaigns,setCampaigns]=useState<any[]>([]),[jobs,setJobs]=useState<any[]>([]),[msg,setMsg]=useState('');
 const load=async()=>{
  try{
   const [t,c,j]=await Promise.all([liveApi('notification_templates_list'),liveApi('admin_communication_campaigns'),liveApi('notification_jobs_list')]);
   setTemplates(t.templates||[]);setCampaigns(c.campaigns||[]);setJobs(j.jobs||[]);
  }catch(e){setMsg(e instanceof Error?e.message:'Erreur')}
 };
 useEffect(()=>{load()},[]);

 async function decide(id:string,status:string){
  const r=await omniaDialog({
   title:status==='approved'?'Approuver la campagne':'Annuler la campagne',
   message:status==='approved'?'La campagne pourra entrer dans la file d’envoi selon sa programmation.':'Cette campagne ne sera pas envoyée.',
   confirmLabel:'Confirmer',
   danger:status==='cancelled'
  });
  if(!r.confirmed)return;
  try{await liveApi('admin_communication_campaign_decision',{method:'POST',body:JSON.stringify({campaign_id:id,status})});await load()}
  catch(e){setMsg(e instanceof Error?e.message:'Erreur')}
 }

 async function dispatch(){
  const r=await omniaDialog({
   title:'Exécuter les envois dus',
   message:'Seuls les jobs arrivés à échéance et autorisés par les préférences/canaux actifs doivent être traités.',
   confirmLabel:'Exécuter'
  });
  if(!r.confirmed)return;
  try{
   const x=await liveApi('notification_dispatch_due',{method:'POST',body:JSON.stringify({limit:200})});
   setMsg(`Jobs traités : ${x.processed||0}`);
   await load();
  }catch(e){setMsg(e instanceof Error?e.message:'Erreur')}
 }

 return <AdminOmniaLiveShell title="Notifications & Communication" subtitle="Supervisez les modèles, campagnes et files d’envoi Omnia Live.">
  <div className="mb-5 flex justify-end"><button onClick={dispatch} className="rounded-lg bg-[#002050] px-4 py-2.5 text-sm font-bold text-white">Exécuter les envois dus</button></div>
  {msg&&<div className="mb-5 border-l-2 border-[#BF8813] bg-amber-50 px-4 py-3 text-sm">{msg}</div>}

  <section className="border-b border-slate-200 pb-7">
   <h2 className="mb-4 text-lg font-bold text-[#002050]">Campagnes</h2>
   {campaigns.length?<div className="overflow-x-auto"><div className="min-w-[880px]">
    <div className="grid grid-cols-[1.4fr_.8fr_.8fr_1fr] border-b border-slate-300 pb-3 text-xs font-semibold uppercase tracking-wide text-slate-400"><div>Campagne</div><div>Canal</div><div>Statut</div><div className="text-right">Actions</div></div>
    {campaigns.map(c=><div key={c.id} className="grid grid-cols-[1.4fr_.8fr_.8fr_1fr] items-center border-b border-slate-200 py-4 text-sm">
     <div className="font-semibold text-[#002050]">{c.name}</div>
     <div>{CHANNEL_LABELS[c.channel]||c.channel}</div>
     <div>{liveStatusLabel(c.status)}</div>
     <div className="flex justify-end gap-3">
      {c.status==='scheduled'&&<button onClick={()=>decide(c.id,'approved')} className="font-semibold text-emerald-700">Approuver</button>}
      {!['sent','cancelled'].includes(c.status)&&<button onClick={()=>decide(c.id,'cancelled')} className="font-semibold text-red-700">Annuler</button>}
     </div>
    </div>)}
   </div></div>:<div className="border-y border-slate-200 py-9 text-sm text-slate-500">Aucune campagne.</div>}
  </section>

  <section className="border-b border-slate-200 py-7">
   <h2 className="mb-4 text-lg font-bold text-[#002050]">Modèles de notification</h2>
   {templates.length?<div className="overflow-x-auto"><div className="min-w-[760px]">
    <div className="grid grid-cols-[1.4fr_.8fr_.8fr] border-b border-slate-300 pb-3 text-xs font-semibold uppercase tracking-wide text-slate-400"><div>Modèle</div><div>Canal</div><div>Statut</div></div>
    {templates.map(t=><div key={t.id} className="grid grid-cols-[1.4fr_.8fr_.8fr] border-b border-slate-200 py-4 text-sm"><div><div className="font-semibold text-[#002050]">{t.name}</div><div className="mt-1 text-xs text-slate-400">{String(t.category||'').replaceAll('_',' ')}</div></div><div>{CHANNEL_LABELS[t.channel]||t.channel}</div><div>{liveStatusLabel(t.status)}</div></div>)}
   </div></div>:<div className="border-y border-slate-200 py-9 text-sm text-slate-500">Aucun modèle.</div>}
  </section>

  <section className="py-7">
   <h2 className="mb-4 text-lg font-bold text-[#002050]">File d’envoi</h2>
   {jobs.length?<div className="overflow-x-auto"><div className="min-w-[860px]">
    <div className="grid grid-cols-[1.2fr_.8fr_.8fr_1fr] border-b border-slate-300 pb-3 text-xs font-semibold uppercase tracking-wide text-slate-400"><div>Notification</div><div>Canal</div><div>Statut</div><div>Programmée</div></div>
    {jobs.slice(0,200).map(j=><div key={j.id} className="grid grid-cols-[1.2fr_.8fr_.8fr_1fr] border-b border-slate-200 py-4 text-sm"><div>{String(j.notification_type||'').replaceAll('_',' ')}</div><div>{CHANNEL_LABELS[j.channel]||j.channel}</div><div>{liveStatusLabel(j.status)}{j.last_error&&<div className="mt-1 text-xs text-red-600">{j.last_error}</div>}</div><div>{j.scheduled_at?new Date(j.scheduled_at).toLocaleString('fr-FR'):'—'}</div></div>)}
   </div></div>:<div className="border-y border-slate-200 py-9 text-sm text-slate-500">Aucun job de notification.</div>}
  </section>
 </AdminOmniaLiveShell>
}
