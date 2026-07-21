import { useEffect,useState } from 'react';
import { Plus, X } from 'lucide-react';
import { liveApi } from '../liveApi';
import AdminOmniaLiveShell from './AdminOmniaLiveShell';

export default function AdminOmniaLiveStructures(){
 const [packs,setPacks]=useState<any[]>([]),[msg,setMsg]=useState(''),[open,setOpen]=useState(false);
 const [form,setForm]=useState<any>({
   structure_id:'',pack_name:'',status:'active',
   max_members:'',max_live_events:'',max_participants_per_event:'',
   storage_gb:'',archive_enabled:true,certificates_enabled:true,reports_enabled:true,
   support_level:'standard'
 });
 const load=()=>liveApi('admin_structure_packs').then(d=>setPacks(d.packs||[])).catch(e=>setMsg(e instanceof Error?e.message:'Erreur'));
 useEffect(()=>{load()},[]);

 async function create(){
   if(!form.structure_id.trim()||!form.pack_name.trim()){setMsg('La Structure et le nom du Pack sont obligatoires.');return}
   try{
     await liveApi('structure_pack_create',{method:'POST',body:JSON.stringify({
       ...form,
       max_members:form.max_members===''?null:Number(form.max_members),
       max_live_events:form.max_live_events===''?null:Number(form.max_live_events),
       max_participants_per_event:form.max_participants_per_event===''?null:Number(form.max_participants_per_event),
       storage_gb:form.storage_gb===''?null:Number(form.storage_gb),
     })});
     setOpen(false);setMsg('Pack créé.');await load();
   }catch(e){setMsg(e instanceof Error?e.message:'Erreur')}
 }

 return <AdminOmniaLiveShell title="Structures & Packs" subtitle="Créez et attribuez des Packs Omnia Live aux Structures partenaires.">
  <div className="mb-5 flex justify-end"><button onClick={()=>setOpen(true)} className="flex items-center gap-2 rounded-xl bg-[#002050] px-4 py-3 font-bold text-white"><Plus size={17}/>Créer un Pack</button></div>
  {msg&&<div className="mb-4 rounded-xl bg-slate-50 p-4">{msg}</div>}

  <div className="overflow-hidden rounded-2xl border bg-white">
   <table className="w-full min-w-[850px] text-left text-sm">
    <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Pack</th><th className="px-4 py-3">Structure</th><th className="px-4 py-3">Membres</th><th className="px-4 py-3">Lives</th><th className="px-4 py-3">Stockage</th><th className="px-4 py-3">Options</th><th className="px-4 py-3">Statut</th></tr></thead>
    <tbody>{packs.map(x=><tr key={x.id} className="border-t"><td className="px-5 py-4 font-bold text-[#002050]">{x.pack_name}</td><td className="px-4 py-4">{x.structure_id}</td><td className="px-4 py-4">{x.max_members??'Illimité'}</td><td className="px-4 py-4">{x.max_live_events??'Illimité'}</td><td className="px-4 py-4">{x.storage_gb??'—'} GB</td><td className="px-4 py-4 text-xs">{[x.archive_enabled&&'Archive',x.certificates_enabled&&'Certificats',x.reports_enabled&&'Rapports'].filter(Boolean).join(' · ')||'—'}</td><td className="px-4 py-4">{x.status}</td></tr>)}
    {!packs.length&&<tr><td colSpan={7} className="px-5 py-10 text-center text-slate-500">Aucun Pack Omnia Live configuré.</td></tr>}</tbody>
   </table>
  </div>

  {open&&<div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/40 p-4">
   <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
    <div className="flex items-center justify-between"><div><h2 className="text-xl font-bold text-[#002050]">Créer un Pack Omnia Live</h2><p className="mt-1 text-sm text-slate-500">Le Pack fixe les limites et services accordés à une Structure.</p></div><button onClick={()=>setOpen(false)}><X/></button></div>
    <div className="mt-5 grid gap-4 md:grid-cols-2">
     <label className="md:col-span-2"><span className="text-sm font-semibold">Structure</span><input value={form.structure_id} onChange={e=>setForm({...form,structure_id:e.target.value})} placeholder="ID de la Structure" className="mt-1 w-full rounded-xl border p-3"/></label>
     <label className="md:col-span-2"><span className="text-sm font-semibold">Nom du Pack</span><input value={form.pack_name} onChange={e=>setForm({...form,pack_name:e.target.value})} placeholder="Ex. Pack Institutionnel 100" className="mt-1 w-full rounded-xl border p-3"/></label>
     <label><span className="text-sm font-semibold">Membres maximum</span><input type="number" value={form.max_members} onChange={e=>setForm({...form,max_members:e.target.value})} className="mt-1 w-full rounded-xl border p-3" placeholder="Vide = illimité"/></label>
     <label><span className="text-sm font-semibold">Lives maximum</span><input type="number" value={form.max_live_events} onChange={e=>setForm({...form,max_live_events:e.target.value})} className="mt-1 w-full rounded-xl border p-3" placeholder="Vide = illimité"/></label>
     <label><span className="text-sm font-semibold">Participants par Live</span><input type="number" value={form.max_participants_per_event} onChange={e=>setForm({...form,max_participants_per_event:e.target.value})} className="mt-1 w-full rounded-xl border p-3"/></label>
     <label><span className="text-sm font-semibold">Stockage (GB)</span><input type="number" value={form.storage_gb} onChange={e=>setForm({...form,storage_gb:e.target.value})} className="mt-1 w-full rounded-xl border p-3"/></label>
     <label><span className="text-sm font-semibold">Support</span><select value={form.support_level} onChange={e=>setForm({...form,support_level:e.target.value})} className="mt-1 w-full rounded-xl border p-3"><option value="standard">Standard</option><option value="priority">Prioritaire</option><option value="dedicated">Dédié</option></select></label>
     <div className="space-y-2 pt-6">{[['archive_enabled','Archive institutionnelle'],['certificates_enabled','Certificats'],['reports_enabled','Rapports']].map(([k,l])=><label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form[k]} onChange={e=>setForm({...form,[k]:e.target.checked})}/>{l}</label>)}</div>
    </div>
    <div className="mt-6 flex justify-end gap-2"><button onClick={()=>setOpen(false)} className="rounded-xl border px-4 py-2.5 font-semibold">Annuler</button><button onClick={create} className="rounded-xl bg-[#002050] px-4 py-2.5 font-bold text-white">Créer le Pack</button></div>
   </div>
  </div>}
 </AdminOmniaLiveShell>
}