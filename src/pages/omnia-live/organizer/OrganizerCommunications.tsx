import {useEffect,useState} from 'react';
import OrganizerShell from './OrganizerShell';
import {liveApi} from '../liveApi';
import {omniaDialog} from '../../../lib/omniaDialog';
import {liveStatusLabel} from '../../../lib/omniaLiveLabels';

const BLUE='#002050';
const GOLD='#BF8813';

const AUDIENCE_LABELS:any={
 all_registered:'Tous les inscrits',confirmed:'Inscrits confirmés',waitlist:"Liste d’attente",
 attended:'Participants présents',absent:'Absents',replay_eligible:'Éligibles au replay',custom:'Audience personnalisée'
};
const CHANNEL_LABELS:any={
 multi:'Notifications Omnia + e-mail',in_app:'Notification dans Omnia',email:'E-mail',sms:'SMS',push:'Notification Push'
};

export default function OrganizerCommunications(){
 const [events,setEvents]=useState<any[]>([]),[eventId,setEventId]=useState(''),[campaigns,setCampaigns]=useState<any[]>([]),[rules,setRules]=useState<any[]>([]),[msg,setMsg]=useState('');
 const [form,setForm]=useState<any>({name:'',audience_type:'all_registered',channel:'multi',subject:'',message:''});

 useEffect(()=>{liveApi('organizer_events').then(r=>{const items=r.items||[];setEvents(items);if(items[0])setEventId(items[0].id)}).catch(e=>setMsg(e instanceof Error?e.message:'Erreur'))},[]);

 async function load(){
  if(!eventId){setCampaigns([]);setRules([]);return}
  try{
   const [c,a]=await Promise.all([
    liveApi('communication_campaigns_list',{}, {event_id:eventId}),
    liveApi('automation_rules_list',{}, {event_id:eventId})
   ]);
   setCampaigns(c.campaigns||[]);
   setRules(a.rules||[]);
  }catch(e){setMsg(e instanceof Error?e.message:'Erreur')}
 }
 useEffect(()=>{load()},[eventId]);

 async function create(){
  if(!eventId){setMsg('Choisissez un événement.');return}
  if(!form.name.trim()||!form.message.trim()){setMsg('Le nom de la campagne et le message sont obligatoires.');return}
  if(['email','multi'].includes(form.channel)&&!form.subject.trim()){setMsg('Un objet est obligatoire pour les envois par e-mail.');return}
  try{
   await liveApi('communication_campaign_create',{method:'POST',body:JSON.stringify({...form,event_id:eventId})});
   setForm({...form,name:'',subject:'',message:''});
   setMsg('Campagne créée en brouillon.');
   await load();
  }catch(e){setMsg(e instanceof Error?e.message:'Erreur')}
 }

 async function schedule(id:string){
  const r=await omniaDialog({
   title:'Programmer la campagne',
   message:'Laissez vide pour envoyer dès que la campagne est validée, ou saisissez une date/heure ISO.',
   confirmLabel:'Programmer',
   inputLabel:'Date et heure ISO (optionnel)',
   inputRequired:false
  });
  if(!r.confirmed)return;
  const when=String(r.value||'').trim()||new Date().toISOString();
  try{
   await liveApi('communication_campaign_schedule',{method:'POST',body:JSON.stringify({campaign_id:id,scheduled_at:when})});
   setMsg('Campagne programmée.');
   await load();
  }catch(e){setMsg(e instanceof Error?e.message:'Erreur')}
 }

 async function toggle(rule:any){
  try{
   await liveApi('automation_rule_save',{method:'POST',body:JSON.stringify({...rule,enabled:!rule.enabled})});
   await load();
  }catch(e){setMsg(e instanceof Error?e.message:'Erreur')}
 }

 return <OrganizerShell title="Communications" subtitle="Informez les participants par notifications Omnia et e-mail, puis automatisez les rappels utiles.">
  <div className="mb-5 border-l-2 border-[#BF8813] bg-amber-50 px-4 py-3 text-sm text-slate-700">
   <b>Canaux prioritaires :</b> notification dans Omnia + e-mail. SMS et Push restent complémentaires et ne doivent être utilisés que lorsqu’ils sont activés au niveau de la plateforme.
  </div>

  <div className="border-b border-slate-200 pb-5">
   <label className="block max-w-xl"><span className="mb-1 block text-sm font-semibold" style={{color:BLUE}}>Événement concerné</span>
    <span className="mb-2 block text-xs text-slate-500">Les campagnes, participants et automatisations ci-dessous sont filtrés par événement.</span>
    <select value={eventId} onChange={e=>setEventId(e.target.value)} disabled={!events.length} className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm disabled:bg-slate-50 disabled:text-slate-400">
     <option value="">{events.length?'Choisir un événement':'Aucun événement disponible'}</option>{events.map(e=><option key={e.id} value={e.id}>{e.title}</option>)}
    </select>
   </label>
  </div>

  <section className="border-b border-slate-200 py-7">
   <h2 className="text-lg font-bold" style={{color:BLUE}}>Nouvelle communication</h2>
   <div className="mt-4 grid gap-4 md:grid-cols-2">
    <label className="md:col-span-2"><span className="mb-1 block text-sm font-semibold">Nom interne de la campagne</span><input className="w-full rounded-lg border border-slate-300 p-3 text-sm" placeholder="Ex. Rappel session 2" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
    <label><span className="mb-1 block text-sm font-semibold">Audience</span><select className="w-full rounded-lg border border-slate-300 p-3 text-sm" value={form.audience_type} onChange={e=>setForm({...form,audience_type:e.target.value})}>{Object.entries(AUDIENCE_LABELS).filter(([k])=>k!=='custom').map(([k,l])=><option key={k} value={k}>{String(l)}</option>)}</select></label>
    <label><span className="mb-1 block text-sm font-semibold">Méthode de notification</span><select className="w-full rounded-lg border border-slate-300 p-3 text-sm" value={form.channel} onChange={e=>setForm({...form,channel:e.target.value})}><option value="multi">Notifications Omnia + e-mail (recommandé)</option><option value="in_app">Notification dans Omnia</option><option value="email">E-mail</option><option value="sms">SMS</option><option value="push">Notification Push</option></select></label>
    <label className="md:col-span-2"><span className="mb-1 block text-sm font-semibold">Objet</span><input className="w-full rounded-lg border border-slate-300 p-3 text-sm" placeholder="Objet du message" value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})}/></label>
    <label className="md:col-span-2"><span className="mb-1 block text-sm font-semibold">Message</span><textarea rows={5} className="w-full rounded-lg border border-slate-300 p-3 text-sm" placeholder="Votre message…" value={form.message} onChange={e=>setForm({...form,message:e.target.value})}/></label>
   </div>
   <button onClick={create} disabled={!eventId} className="mt-4 rounded-lg bg-[#002050] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">Créer la campagne</button>
  </section>

  <section className="border-b border-slate-200 py-7">
   <h2 className="mb-4 text-lg font-bold" style={{color:BLUE}}>Campagnes</h2>
   {campaigns.length?<div className="overflow-x-auto"><div className="min-w-[850px]">
    <div className="grid grid-cols-[1.4fr_.9fr_.9fr_.8fr] border-b border-slate-300 pb-3 text-xs font-semibold uppercase tracking-wide text-slate-400"><div>Campagne</div><div>Audience</div><div>Canal</div><div className="text-right">Action</div></div>
    {campaigns.map(c=><div key={c.id} className="grid grid-cols-[1.4fr_.9fr_.9fr_.8fr] items-center border-b border-slate-200 py-4 text-sm">
     <div><div className="font-semibold" style={{color:BLUE}}>{c.name}</div><div className="mt-1 text-xs text-slate-400">{liveStatusLabel(c.status)}</div></div>
     <div>{AUDIENCE_LABELS[c.audience_type]||c.audience_type}</div>
     <div>{CHANNEL_LABELS[c.channel]||c.channel}</div>
     <div className="text-right">{c.status==='draft'&&<button onClick={()=>schedule(c.id)} className="font-semibold" style={{color:GOLD}}>Programmer</button>}</div>
    </div>)}
   </div></div>:<div className="border-y border-slate-200 py-9 text-sm text-slate-500">Aucune campagne pour cet événement.</div>}
  </section>

  <section className="py-7">
   <h2 className="text-lg font-bold" style={{color:BLUE}}>Automatisations de cet événement</h2>
   <p className="mt-1 text-sm text-slate-500">Ce sont les règles déjà créées qui déclenchent automatiquement confirmations, rappels et messages selon une action ou une échéance.</p>
   {rules.length?<div className="mt-5">
    {rules.map(r=><div key={r.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 py-4">
     <div><div className="font-semibold" style={{color:BLUE}}>{r.rule_key}</div><div className="mt-1 text-xs text-slate-500">{String(r.trigger_type||'').replaceAll('_',' ')}{r.trigger_offset_minutes?` · ${Math.abs(r.trigger_offset_minutes)} min`:''} · {CHANNEL_LABELS[r.channel]||r.channel}</div></div>
     <label className="flex items-center gap-2 text-sm font-semibold"><span>{r.enabled?'Active':'Inactive'}</span><input type="checkbox" checked={!!r.enabled} onChange={()=>toggle(r)}/></label>
    </div>)}
   </div>:<div className="mt-5 border-y border-slate-200 py-9 text-sm text-slate-500">Aucune automatisation créée pour cet événement.</div>}
  </section>

  {msg&&<div className="mt-4 border-l-2 border-[#BF8813] bg-amber-50 px-4 py-3 text-sm">{msg}</div>}
 </OrganizerShell>
}
