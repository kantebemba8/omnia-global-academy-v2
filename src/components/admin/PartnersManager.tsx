import { useEffect, useState } from 'react';
import { ENDPOINTS } from '../../lib/config';
import { Plus, Upload, Trash2, Save } from 'lucide-react';
type Partner={id?:string;name:string;category:string;logo_url:string;website_url:string;description:string;display_order:number;is_active:boolean;is_featured:boolean};
const empty:Partner={name:'',category:'Institutionnel',logo_url:'',website_url:'',description:'',display_order:0,is_active:true,is_featured:false};
export function PartnersManager(){
 const [items,setItems]=useState<Partner[]>([]);const [form,setForm]=useState<Partner>(empty);const [busy,setBusy]=useState(false);
 const token=()=>localStorage.getItem('omnia_session_token')||'';
 async function load(){const r=await fetch(ENDPOINTS.adminCmsUpdate,{headers:{Authorization:`Bearer ${token()}`}});const d=await r.json();setItems(d.partners||[]);}
 useEffect(()=>{load();},[]);
 async function save(){if(!form.name.trim())return;setBusy(true);await fetch(ENDPOINTS.adminCmsUpdate,{method:'POST',headers:{Authorization:`Bearer ${token()}`,'Content-Type':'application/json'},body:JSON.stringify({action:'upsert_partner',partner:form})});setForm(empty);await load();setBusy(false);}
 async function del(id?:string){if(!id)return;await fetch(ENDPOINTS.adminCmsUpdate,{method:'POST',headers:{Authorization:`Bearer ${token()}`,'Content-Type':'application/json'},body:JSON.stringify({action:'delete_partner',partner_id:id})});load();}
 async function upload(file:File){const b64=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]||'');r.onerror=reject;r.readAsDataURL(file)});const res=await fetch(ENDPOINTS.adminCmsUpdate,{method:'POST',headers:{Authorization:`Bearer ${token()}`,'Content-Type':'application/json'},body:JSON.stringify({action:'upload_partner_logo',file_name:file.name,mime_type:file.type,base64:b64})});const d=await res.json();if(d.logo_url)setForm(x=>({...x,logo_url:d.logo_url}));}
 return <div className="space-y-6">
  <div><h3 className="font-semibold" style={{color:'#002050'}}>Gestion des partenaires</h3><p className="text-xs text-gray-500 mt-1">Ajoutez des partenaires institutionnels, académiques, technologiques, financiers ou autres. Les partenaires actifs s’affichent automatiquement en bas de la page publique.</p></div>
  <div className="rounded-xl border border-gray-200 p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
   <input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Nom du partenaire" className="border rounded-lg px-3 py-2 text-sm"/>
   <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} className="border rounded-lg px-3 py-2 text-sm">
    {['Institutionnel','Académique','Certification','Technologique','Financier','Entreprise','ONG / Association','Autre'].map(x=><option key={x}>{x}</option>)}
   </select>
   <input value={form.website_url} onChange={e=>setForm({...form,website_url:e.target.value})} placeholder="Site web (optionnel)" className="border rounded-lg px-3 py-2 text-sm"/>
   <input type="number" value={form.display_order} onChange={e=>setForm({...form,display_order:Number(e.target.value)})} placeholder="Ordre" className="border rounded-lg px-3 py-2 text-sm"/>
   <div className="md:col-span-2 flex flex-wrap gap-2 items-center">
    <input value={form.logo_url} onChange={e=>setForm({...form,logo_url:e.target.value})} placeholder="URL du logo ou utilisez Joindre une image" className="flex-1 min-w-[260px] border rounded-lg px-3 py-2 text-sm"/>
    <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 rounded-lg text-white text-sm" style={{backgroundColor:'#002050'}}><Upload className="w-4 h-4"/>Joindre une image<input type="file" accept="image/*" className="hidden" onChange={e=>e.target.files?.[0]&&upload(e.target.files[0])}/></label>
   </div>
   <textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Courte description (optionnelle)" rows={2} className="md:col-span-2 border rounded-lg px-3 py-2 text-sm"/>
   <label className="text-sm"><input type="checkbox" checked={form.is_active} onChange={e=>setForm({...form,is_active:e.target.checked})}/> Actif</label>
   <label className="text-sm"><input type="checkbox" checked={form.is_featured} onChange={e=>setForm({...form,is_featured:e.target.checked})}/> Mis en avant</label>
   <div className="md:col-span-2 flex justify-end"><button disabled={busy} onClick={save} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold" style={{backgroundColor:'#002050'}}><Save className="w-4 h-4"/>{form.id?'Mettre à jour':'Ajouter le partenaire'}</button></div>
  </div>
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{items.map(p=><div key={p.id} className="rounded-xl border border-gray-200 p-4 flex gap-3">
   <div className="w-16 h-16 rounded-lg border bg-white flex items-center justify-center overflow-hidden">{p.logo_url?<img src={p.logo_url} className="max-w-full max-h-full object-contain"/>:<span className="text-xs text-gray-400">Logo</span>}</div>
   <div className="flex-1"><p className="font-semibold text-sm">{p.name}</p><p className="text-xs text-gray-400">{p.category}</p><div className="mt-3 flex gap-3"><button onClick={()=>setForm(p)} className="text-xs font-semibold" style={{color:'#002050'}}>Modifier</button><button onClick={()=>del(p.id)} className="text-xs text-red-600"><Trash2 className="w-3 h-3 inline"/> Supprimer</button></div></div>
  </div>)}</div>
 </div>
}
