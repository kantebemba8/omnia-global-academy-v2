import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import OmniaLiveLayout from '../../components/omnia-live/OmniaLiveLayout';
import { liveApi } from './liveApi';

const BLUE='#002050', GOLD='#BF8813';
type Speaker={user_id?:string;external_name?:string;external_email?:string;title?:string;organization?:string;bio?:string;role:string;permissions:Record<string,boolean>};

const emptySpeaker=():Speaker=>({external_name:'',external_email:'',title:'',organization:'',bio:'',role:'speaker',permissions:{}});

export default function OmniaLiveStudioSpeakers(){
 const {liveId}=useParams(); const navigate=useNavigate();
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[message,setMessage]=useState('');
 const [speakers,setSpeakers]=useState<Speaker[]>([emptySpeaker()]);

 useEffect(()=>{if(!liveId)return;liveApi('studio_get',{}, {event_id:liveId}).then(d=>{
   const rows=Array.isArray(d?.speakers)?d.speakers:[];
   setSpeakers(rows.length?rows.map((s:any)=>({user_id:s.user_id||undefined,external_name:s.external_name||'',external_email:s.external_email||'',title:s.title||'',organization:s.organization||'',bio:s.bio||'',role:s.role||'speaker',permissions:s.permissions||{}})):[emptySpeaker()]);
 }).catch(e=>setMessage(e instanceof Error?e.message:'Chargement impossible.')).finally(()=>setLoading(false));},[liveId]);

 const update=(i:number,k:keyof Speaker,v:any)=>setSpeakers(x=>x.map((s,n)=>n===i?{...s,[k]:v}:s));
 const remove=(i:number)=>setSpeakers(x=>{const n=x.filter((_,j)=>j!==i);return n.length?n:[emptySpeaker()]});

 async function save(next=false){
  if(!liveId)return;
  const valid=speakers.filter(s=>s.user_id||s.external_name?.trim());
  for(const s of valid){if(!s.user_id&&s.external_email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.external_email)){setMessage('Vérifiez les adresses e-mail des intervenants.');return;}}
  setSaving(true);setMessage('');
  try{
   await liveApi('save_speakers',{method:'POST',body:JSON.stringify({event_id:liveId,speakers:valid})});
   if(next)navigate(`/omnia-live/studio/${liveId}/ressources`);else setMessage('Étape 5 enregistrée.');
  }catch(e){setMessage(e instanceof Error?e.message:'Enregistrement impossible.')}finally{setSaving(false)}
 }
 if(loading)return <OmniaLiveLayout><div className="mx-auto max-w-6xl px-4 py-12 text-slate-500">Chargement...</div></OmniaLiveLayout>;

 return <OmniaLiveLayout><section className="mx-auto max-w-6xl px-4 py-10 md:px-8">
  <div className="mb-8"><div className="text-sm font-bold uppercase tracking-wide" style={{color:GOLD}}>Studio Omnia Live · Étape 5 sur 7</div><h1 className="mt-2 text-3xl font-black" style={{color:BLUE}}>Intervenants et équipe du Live</h1><p className="mt-2 text-slate-600">Ajoutez les personnes qui interviennent dans ce contenu. Ces responsabilités ne modifient pas leurs rôles globaux Omnia.</p></div>
  <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
   {speakers.map((s,i)=><div key={i} className="rounded-2xl border border-slate-200 p-5">
    <div className="mb-4 flex items-center justify-between"><h2 className="font-bold" style={{color:BLUE}}>Personne {i+1}</h2><button type="button" onClick={()=>remove(i)} className="text-sm font-semibold text-red-600">Retirer</button></div>
    <div className="grid gap-4 md:grid-cols-2">
     <div><label className="mb-2 block text-sm font-semibold">Nom *</label><input value={s.external_name||''} onChange={e=>update(i,'external_name',e.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3" placeholder="Nom complet"/></div>
     <div><label className="mb-2 block text-sm font-semibold">E-mail d’invitation</label><input type="email" value={s.external_email||''} onChange={e=>update(i,'external_email',e.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3"/></div>
     <div><label className="mb-2 block text-sm font-semibold">Fonction / titre</label><input value={s.title||''} onChange={e=>update(i,'title',e.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3"/></div>
     <div><label className="mb-2 block text-sm font-semibold">Organisation</label><input value={s.organization||''} onChange={e=>update(i,'organization',e.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3"/></div>
     <div><label className="mb-2 block text-sm font-semibold">Rôle dans ce Live</label><select value={s.role} onChange={e=>update(i,'role',e.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3"><option value="speaker">Intervenant</option><option value="trainer">Formateur</option><option value="co_organizer">Co-organisateur</option><option value="moderator">Modérateur du Live</option></select></div>
    </div>
    <div className="mt-4"><label className="mb-2 block text-sm font-semibold">Présentation</label><textarea rows={3} value={s.bio||''} onChange={e=>update(i,'bio',e.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3"/></div>
   </div>)}
   <button type="button" onClick={()=>setSpeakers(x=>[...x,emptySpeaker()])} className="rounded-xl px-4 py-3 font-bold text-white" style={{background:GOLD}}>+ Ajouter une personne</button>
   <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">Le propriétaire du Live reste l’organisateur principal. Un intervenant externe peut être invité sans recevoir automatiquement un rôle global Professeur ou Structure.</div>
   {message&&<div className="rounded-xl bg-slate-50 px-4 py-3 text-sm">{message}</div>}
   <div className="flex flex-wrap justify-between gap-3 border-t pt-6">
    <button onClick={()=>navigate(`/omnia-live/studio/${liveId}/tarification`)} className="rounded-xl border border-slate-300 px-5 py-3 font-semibold">← Étape 4</button>
    <div className="flex gap-3"><button onClick={()=>save(false)} disabled={saving} className="rounded-xl border px-5 py-3 font-bold" style={{borderColor:BLUE,color:BLUE}}>Enregistrer</button><button onClick={()=>save(true)} disabled={saving} className="rounded-xl px-6 py-3 font-bold text-white" style={{background:BLUE}}>{saving?'Enregistrement...':'Continuer →'}</button></div>
   </div>
  </div>
 </section></OmniaLiveLayout>
}
