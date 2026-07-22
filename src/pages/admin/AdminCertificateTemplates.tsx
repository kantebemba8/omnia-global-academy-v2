import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { edgeAuthHeaders } from '../../lib/edgeAuth';
import { Plus, Save } from 'lucide-react';
const API=`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/certificate-admin`;const BLUE='#002050',GOLD='#BF8813';
const empty={name:'',document_type:'completion_certificate',source_type:'course',issuer_scope:'platform',language_code:'fr',is_active:true,is_default:false};
export default function AdminCertificateTemplates(){
 const [rows,setRows]=useState<any[]>([]),[edit,setEdit]=useState<any>(null),[error,setError]=useState('');
 async function load(){const r=await fetch(`${API}?action=templates`,{headers:edgeAuthHeaders()});const d=await r.json();setRows(d.templates||[])}
 useEffect(()=>{load()},[]);
 async function save(){const r=await fetch(API,{method:'POST',headers:edgeAuthHeaders(),body:JSON.stringify({action:'save_template',template:edit})});const d=await r.json();if(!d.success){setError(d.message||d.error);return}setEdit(null);await load()}
 return <AdminLayout><div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
  <header className="border-b border-gray-200 pb-5 flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.14em]" style={{color:GOLD}}>Certificats & attestations</p><h1 className="text-2xl font-black mt-1" style={{color:BLUE}}>Modèles</h1><p className="text-sm text-gray-500 mt-1">Modèles illimités, par type de document, origine, rôle et langue.</p></div><button onClick={()=>setEdit({...empty})} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold" style={{background:BLUE}}><Plus size={14}/>Nouveau modèle</button></header>
  {error&&<div className="text-red-700 text-sm">{error}</div>}
  <div className="border-t border-gray-200">{rows.map(t=><button key={t.id} onClick={()=>setEdit(t)} className="w-full grid md:grid-cols-[1.4fr_.8fr_.8fr_.5fr] gap-3 py-4 border-b text-left hover:bg-gray-50">
   <div><p className="font-semibold" style={{color:BLUE}}>{t.name}</p><p className="text-xs text-gray-400">{t.code} · v{t.version}</p></div><span className="text-sm text-gray-600">{t.document_type}</span><span className="text-sm text-gray-600">{t.source_type}</span><span className="text-sm uppercase">{t.language_code}</span>
  </button>)}</div>
  {edit&&<div className="fixed inset-0 z-[100] bg-black/30 flex items-center justify-center p-4"><div className="bg-white w-full max-w-2xl rounded-xl p-6 shadow-xl">
   <h2 className="text-lg font-black" style={{color:BLUE}}>{edit.id?'Modifier le modèle':'Nouveau modèle'}</h2>
   <div className="grid md:grid-cols-2 gap-4 mt-4">
    <label className="text-sm">Nom<input value={edit.name||''} onChange={e=>setEdit({...edit,name:e.target.value})} className="w-full mt-1 border rounded-lg px-3 py-2"/></label>
    <label className="text-sm">Langue<select value={edit.language_code||'fr'} onChange={e=>setEdit({...edit,language_code:e.target.value})} className="w-full mt-1 border rounded-lg px-3 py-2"><option value="fr">Français</option><option value="en">Anglais</option><option value="es">Espagnol</option></select></label>
    <label className="text-sm">Type<select value={edit.document_type} onChange={e=>setEdit({...edit,document_type:e.target.value})} className="w-full mt-1 border rounded-lg px-3 py-2"><option value="completion_certificate">Certificat de réussite</option><option value="participation_attestation">Attestation de participation</option><option value="attendance_certificate">Attestation de présence</option><option value="cpd_certificate">Certificat Open CPD</option></select></label>
    <label className="text-sm">Origine<select value={edit.source_type} onChange={e=>setEdit({...edit,source_type:e.target.value})} className="w-full mt-1 border rounded-lg px-3 py-2"><option value="course">Formation</option><option value="omnia_live">Omnia Live</option></select></label>
    <label className="text-sm">Émetteur<select value={edit.issuer_scope} onChange={e=>setEdit({...edit,issuer_scope:e.target.value})} className="w-full mt-1 border rounded-lg px-3 py-2"><option value="platform">OGA</option><option value="professeur">Professeur</option><option value="structure">Structure</option></select></label>
   </div>
   <div className="flex gap-4 mt-4"><label className="text-sm flex gap-2"><input type="checkbox" checked={!!edit.is_active} onChange={e=>setEdit({...edit,is_active:e.target.checked})}/>Actif</label><label className="text-sm flex gap-2"><input type="checkbox" checked={!!edit.is_default} onChange={e=>setEdit({...edit,is_default:e.target.checked})}/>Par défaut</label></div>
   <div className="flex justify-end gap-3 mt-6"><button onClick={()=>setEdit(null)} className="px-4 py-2 border rounded-lg text-sm">Annuler</button><button onClick={save} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold" style={{background:BLUE}}><Save size={14}/>Enregistrer</button></div>
  </div></div>}
 </div></AdminLayout>
}
