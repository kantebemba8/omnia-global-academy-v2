import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { liveApi } from '../liveApi';
import AdminOmniaLiveShell from './AdminOmniaLiveShell';

export default function AdminOmniaLiveCreate(){
  const navigate=useNavigate();
  const [form,setForm]=useState({
    creation_mode:'omnia',
    title:'',
    event_type:'masterclass',
    delivery_type:'single_live',
    owner_user_id:'',
    owner_structure_id:'',
  });
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState('');

  async function createDraft(){
    if(!form.title.trim()){setMessage('Le titre est obligatoire.');return}
    setSaving(true);setMessage('');
    try{
      const r=await liveApi('admin_create_live',{
        method:'POST',
        body:JSON.stringify({...form,publish_now:false}),
      });
      if(!r?.event?.id) throw new Error('Le brouillon n’a pas pu être créé.');
      // SAME Studio as organizers/professors/structures.
      navigate(`/omnia-live/studio/${r.event.id}`);
    }catch(e){
      setMessage(e instanceof Error?e.message:'Création impossible.');
    }finally{setSaving(false)}
  }

  return <AdminOmniaLiveShell title="Créer un Live" subtitle="L’Administration Omnia utilise le même Studio complet que les autres créateurs.">
    <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-6 py-5">
        <h2 className="text-lg font-bold text-[#002050]">Démarrer un nouveau contenu</h2>
        <p className="mt-1 text-sm text-slate-500">Ces informations créent le brouillon. Vous poursuivrez ensuite dans le Studio complet Omnia Live.</p>
      </div>

      <div className="grid gap-5 p-6 md:grid-cols-2">
        <label className="md:col-span-2">
          <span className="text-sm font-bold">Créer au nom de</span>
          <select value={form.creation_mode} onChange={e=>setForm({...form,creation_mode:e.target.value})} className="mt-2 w-full rounded-xl border px-4 py-3">
            <option value="omnia">Omnia Global Academy</option>
            <option value="organizer">Un organisateur existant</option>
            <option value="structure">Une Structure</option>
          </select>
        </label>

        {form.creation_mode==='organizer'&&<label className="md:col-span-2"><span className="text-sm font-bold">Organisateur</span><input value={form.owner_user_id} onChange={e=>setForm({...form,owner_user_id:e.target.value})} placeholder="Identifiant du compte organisateur" className="mt-2 w-full rounded-xl border px-4 py-3"/></label>}
        {form.creation_mode==='structure'&&<label className="md:col-span-2"><span className="text-sm font-bold">Structure</span><input value={form.owner_structure_id} onChange={e=>setForm({...form,owner_structure_id:e.target.value})} placeholder="Identifiant de la Structure" className="mt-2 w-full rounded-xl border px-4 py-3"/></label>}

        <label className="md:col-span-2">
          <span className="text-sm font-bold">Titre</span>
          <input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Titre du Live ou de la formation" className="mt-2 w-full rounded-xl border px-4 py-3"/>
        </label>

        <label>
          <span className="text-sm font-bold">Mode</span>
          <select value={form.delivery_type} onChange={e=>setForm({...form,delivery_type:e.target.value})} className="mt-2 w-full rounded-xl border px-4 py-3">
            <option value="single_live">Live unique</option>
            <option value="synchronous_training">Formation synchrone</option>
            <option value="recorded_video">Vidéo préenregistrée</option>
          </select>
        </label>

        <label>
          <span className="text-sm font-bold">Format</span>
          <select value={form.event_type} onChange={e=>setForm({...form,event_type:e.target.value})} className="mt-2 w-full rounded-xl border px-4 py-3">
            <option value="class_live">Classe Live</option>
            <option value="masterclass">Masterclass</option>
            <option value="workshop">Atelier</option>
            <option value="webinar">Webinaire</option>
            <option value="conference">Conférence</option>
            <option value="event">Événement</option>
          </select>
        </label>
      </div>

      {message&&<div className="mx-6 mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{message}</div>}

      <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-5">
        <button onClick={()=>navigate('/admin/omnia-live')} className="rounded-xl border px-5 py-3 font-bold">Annuler</button>
        <button disabled={saving} onClick={createDraft} className="rounded-xl bg-[#002050] px-5 py-3 font-bold text-white disabled:opacity-50">
          {saving?'Création...':'Continuer dans le Studio'}
        </button>
      </div>
    </div>
  </AdminOmniaLiveShell>
}