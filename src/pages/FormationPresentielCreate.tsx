import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, ArrowRight } from 'lucide-react';
import { AdaptiveFormationsLayout } from '../components/formations/FormationsRoleLayout';
import { ENDPOINTS } from '../lib/config';
import { useAuth } from '../hooks/useAuth';

export default function FormationPresentielCreate(){
 const nav=useNavigate(); const {sessionToken}=useAuth();
 const [f,setF]=useState({title:'',short_description:'',long_description:'',category:'',level:'Débutant',language:'fr',target_audience:'',prerequisites:'',creator_context:location.pathname.startsWith('/structure')?'structure':location.pathname.startsWith('/admin')?'super_admin':'professeur'});
 const [busy,setBusy]=useState(false);const [err,setErr]=useState('');
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setErr('');try{
  const r=await fetch(ENDPOINTS.studioUnified,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${sessionToken}`,'x-omnia-session-token':sessionToken||''},body:JSON.stringify({action:'create_course',...f,client_draft_key:`presentiel-${crypto.randomUUID()}`})});
  const d=await r.json();if(!r.ok||!d.success)throw new Error(d.message||d.error||'Création impossible');
  await fetch(ENDPOINTS.courseSessions,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${sessionToken}`,'x-omnia-session-token':sessionToken||''},body:JSON.stringify({action:'set_course_mode',course_id:d.course.id,training_delivery_mode:'in_person'})});
  nav(`/formations/${d.course.id}/sessions`);
 }catch(e){setErr(e instanceof Error?e.message:'Erreur')}finally{setBusy(false)}}
 return <AdaptiveFormationsLayout><div className="mx-auto max-w-3xl px-4 py-10"><div className="mb-6 flex items-center gap-3"><div className="rounded-xl p-3" style={{background:'#E8F6F4',color:'#0B817A'}}><MapPin/></div><div><h1 className="text-2xl font-black" style={{color:'#002050'}}>Créer une formation présentielle</h1><p className="text-sm text-slate-500">Aucun Builder requis. Créez la fiche, puis ses dates, lieux et places.</p></div></div>
 <form onSubmit={submit} className="rounded-2xl border bg-white p-6" style={{borderColor:'#E4E7EC'}}>
  <Field label="Titre"><input required value={f.title} onChange={e=>setF({...f,title:e.target.value})}/></Field>
  <Field label="Description courte"><textarea required rows={2} value={f.short_description} onChange={e=>setF({...f,short_description:e.target.value})}/></Field>
  <Field label="Description complète"><textarea rows={5} value={f.long_description} onChange={e=>setF({...f,long_description:e.target.value})}/></Field>
  <div className="grid gap-4 sm:grid-cols-2"><Field label="Catégorie"><input value={f.category} onChange={e=>setF({...f,category:e.target.value})}/></Field><Field label="Niveau"><select value={f.level} onChange={e=>setF({...f,level:e.target.value})}><option>Débutant</option><option>Intermédiaire</option><option>Avancé</option><option>Expert</option></select></Field></div>
  <Field label="Public cible"><textarea rows={2} value={f.target_audience} onChange={e=>setF({...f,target_audience:e.target.value})}/></Field>
  <Field label="Prérequis"><textarea rows={2} value={f.prerequisites} onChange={e=>setF({...f,prerequisites:e.target.value})}/></Field>
  {err&&<p className="mt-3 text-sm text-red-600">{err}</p>}
  <button disabled={busy} className="mt-5 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white disabled:opacity-50" style={{background:'#002050'}}>{busy?'Création…':'Continuer vers les sessions'}<ArrowRight size={16}/></button>
 </form></div></AdaptiveFormationsLayout>
}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="mt-4 block text-xs font-semibold text-slate-600">{label}<div className="mt-1 [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:px-3 [&_input]:py-2.5 [&_select]:w-full [&_select]:rounded-xl [&_select]:border [&_select]:px-3 [&_select]:py-2.5 [&_textarea]:w-full [&_textarea]:rounded-xl [&_textarea]:border [&_textarea]:px-3 [&_textarea]:py-2.5">{children}</div></label>}
