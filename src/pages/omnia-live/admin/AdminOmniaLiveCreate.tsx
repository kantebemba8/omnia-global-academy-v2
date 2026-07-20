import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { liveApi } from '../liveApi';
import AdminOmniaLiveShell from './AdminOmniaLiveShell';

export default function AdminOmniaLiveCreate(){
 const navigate=useNavigate();
 const [form,setForm]=useState<any>({
   creation_mode:'omnia',
   title:'',
   event_type:'masterclass',
   delivery_type:'single_live',
   presenter_name:'',
   presenter_title:'',
   presenter_organization:'',
   presenter_email:'',
   owner_user_id:'',
   owner_structure_id:'',
 });
 const [busy,setBusy]=useState(false),[msg,setMsg]=useState('');
 const set=(k:string,v:any)=>setForm((x:any)=>({...x,[k]:v}));

 async function create(publish:boolean){
   if(!form.title.trim()){setMsg('Le titre est obligatoire.');return}
   setBusy(true);setMsg('');
   try{
     const r=await liveApi('admin_create_live',{method:'POST',body:JSON.stringify({...form,publish_now:publish})});
     if(r?.event?.id){
       if(publish) navigate(`/admin/omnia-live/evenements/${r.event.id}`);
       else navigate(`/omnia-live/studio/${r.event.id}`);
     }
   }catch(e){setMsg(e instanceof Error?e.message:'Création impossible.')}
   finally{setBusy(false)}
 }

 return <AdminOmniaLiveShell title="Créer un Live" subtitle="Créer directement au nom d’Omnia Global Academy ou pour un compte/Structure.">
  {msg&&<div className="mb-5 rounded-xl bg-slate-50 p-4">{msg}</div>}
  <div className="mx-auto max-w-4xl space-y-6 rounded-3xl border bg-white p-6">
   <div>
    <label className="text-sm font-bold">Créer au nom de</label>
    <select value={form.creation_mode} onChange={e=>set('creation_mode',e.target.value)} className="mt-2 w-full rounded-xl border p-3">
      <option value="omnia">Omnia Global Academy</option>
      <option value="organizer">Un organisateur existant</option>
      <option value="structure">Une Structure</option>
    </select>
   </div>
   {form.creation_mode==='organizer'&&<input value={form.owner_user_id} onChange={e=>set('owner_user_id',e.target.value)} placeholder="ID utilisateur organisateur" className="w-full rounded-xl border p-3"/>}
   {form.creation_mode==='structure'&&<input value={form.owner_structure_id} onChange={e=>set('owner_structure_id',e.target.value)} placeholder="ID Structure" className="w-full rounded-xl border p-3"/>}

   <div className="grid gap-4 md:grid-cols-2">
    <label className="block"><span className="text-sm font-bold">Titre</span><input value={form.title} onChange={e=>set('title',e.target.value)} className="mt-2 w-full rounded-xl border p-3"/></label>
    <label className="block"><span className="text-sm font-bold">Mode</span><select value={form.delivery_type} onChange={e=>set('delivery_type',e.target.value)} className="mt-2 w-full rounded-xl border p-3"><option value="single_live">Live unique</option><option value="synchronous_training">Formation synchrone</option><option value="recorded_video">Vidéo préenregistrée</option></select></label>
    <label className="block"><span className="text-sm font-bold">Format</span><select value={form.event_type} onChange={e=>set('event_type',e.target.value)} className="mt-2 w-full rounded-xl border p-3"><option value="class_live">Classe Live</option><option value="masterclass">Masterclass</option><option value="workshop">Atelier</option><option value="webinar">Webinaire</option><option value="conference">Conférence</option><option value="event">Événement</option></select></label>
   </div>

   <div className="border-t pt-5">
    <h2 className="font-bold text-[#002050]">Intervenant principal</h2>
    <p className="mt-1 text-sm text-slate-500">Peut être un expert externe sans rôle permanent sur la plateforme.</p>
    <div className="mt-4 grid gap-3 md:grid-cols-2">
     <input value={form.presenter_name} onChange={e=>set('presenter_name',e.target.value)} placeholder="Nom de l’intervenant" className="rounded-xl border p-3"/>
     <input value={form.presenter_title} onChange={e=>set('presenter_title',e.target.value)} placeholder="Titre / fonction" className="rounded-xl border p-3"/>
     <input value={form.presenter_organization} onChange={e=>set('presenter_organization',e.target.value)} placeholder="Organisation" className="rounded-xl border p-3"/>
     <input type="email" value={form.presenter_email} onChange={e=>set('presenter_email',e.target.value)} placeholder="Email (facultatif)" className="rounded-xl border p-3"/>
    </div>
   </div>

   <div className="flex flex-wrap gap-3 border-t pt-5">
    <button disabled={busy} onClick={()=>create(false)} className="rounded-xl border px-5 py-3 font-bold disabled:opacity-50">Enregistrer en brouillon</button>
    {form.creation_mode==='omnia'&&<button disabled={busy} onClick={()=>create(true)} className="rounded-xl bg-[#002050] px-5 py-3 font-bold text-white disabled:opacity-50">Publier directement au nom d’Omnia</button>}
   </div>
   {form.creation_mode==='omnia'&&<p className="text-xs text-slate-500">Un Live créé au nom d’Omnia par le Super Admin ne repasse pas par la validation classique. Toutes les actions restent tracées dans l’historique/audit.</p>}
  </div>
 </AdminOmniaLiveShell>
}