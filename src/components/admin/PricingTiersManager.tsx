import { getSessionToken } from '../../lib/session';
import { useEffect, useState } from 'react';
import { ENDPOINTS } from '../../lib/config';
import { Plus, Save, Trash2 } from 'lucide-react';

type Band = { id?: string; label: string; min_minutes: number; max_minutes: number | null; base_price_xof: number; display_order: number; is_active: boolean };
const emptyBand = (): Band => ({ label: 'Nouvelle tranche', min_minutes: 0, max_minutes: null, base_price_xof: 0, display_order: 0, is_active: true });

export function PricingTiersManager() {
  const [bands,setBands]=useState<Band[]>([]); const [busy,setBusy]=useState<string>(''); const [message,setMessage]=useState('');
  const token=()=>getSessionToken()||'';
  async function load(){const r=await fetch(ENDPOINTS.adminCmsUpdate,{headers:{Authorization:`Bearer ${token()}`}});const d=await r.json();setBands((d.professor_pricing_duration_bands||[]).sort((a:Band,b:Band)=>a.min_minutes-b.min_minutes));}
  useEffect(()=>{void load()},[]);
  async function save(band:Band,index:number){setBusy(String(band.id||index));const r=await fetch(ENDPOINTS.adminCmsUpdate,{method:'POST',headers:{Authorization:`Bearer ${token()}`,'Content-Type':'application/json'},body:JSON.stringify({action:'upsert_professor_pricing_band',band})});setBusy('');setMessage(r.ok?'Tranche enregistrée.':'Enregistrement impossible.');if(r.ok)await load();}
  async function remove(band:Band,index:number){if(!band.id){setBands(v=>v.filter((_,i)=>i!==index));return;}if(!confirm('Supprimer cette tranche de durée ?'))return;const r=await fetch(ENDPOINTS.adminCmsUpdate,{method:'POST',headers:{Authorization:`Bearer ${token()}`,'Content-Type':'application/json'},body:JSON.stringify({action:'delete_professor_pricing_band',band_id:band.id})});if(r.ok)await load();}
  const edit=(index:number,patch:Partial<Band>)=>setBands(v=>v.map((x,i)=>i===index?{...x,...patch}:x));
  return <div className="space-y-4">
    <div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold" style={{color:'#002050'}}>Tranches de durée — tarification Professeur V3</h3><p className="mt-1 text-xs text-gray-500">La durée pédagogique est calculée automatiquement. Les niveaux Débutant, Intermédiaire, Avancé et Expert n'influencent pas le prix.</p></div><button onClick={()=>setBands(v=>[...v,emptyBand()])} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold" style={{borderColor:'#BF8813',color:'#002050'}}><Plus size={14}/>Ajouter</button></div>
    <div className="space-y-3">{bands.map((band,index)=><div key={band.id||`new-${index}`} className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-[1.4fr_1fr_1fr_1fr_auto]" style={{borderColor:'#E4E7EC'}}>
      <label className="text-xs text-gray-600">Nom<input value={band.label} onChange={e=>edit(index,{label:e.target.value})} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label>
      <label className="text-xs text-gray-600">Minimum (min)<input type="number" min={0} value={band.min_minutes} onChange={e=>edit(index,{min_minutes:Number(e.target.value)})} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label>
      <label className="text-xs text-gray-600">Maximum (min)<input type="number" min={1} value={band.max_minutes??''} placeholder="Sans limite" onChange={e=>edit(index,{max_minutes:e.target.value===''?null:Number(e.target.value)})} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label>
      <label className="text-xs text-gray-600">Prix de base XOF<input type="number" min={0} step={500} value={band.base_price_xof} onChange={e=>edit(index,{base_price_xof:Number(e.target.value)})} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label>
      <div className="flex items-end gap-2"><button onClick={()=>void save(band,index)} disabled={busy===String(band.id||index)} className="rounded-lg p-2 text-white" style={{background:'#002050'}} title="Enregistrer"><Save size={16}/></button><button onClick={()=>void remove(band,index)} className="rounded-lg border p-2 text-red-600" title="Supprimer"><Trash2 size={16}/></button></div>
    </div>)}</div>
    {bands.length===0&&<div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Aucune tranche active. Ajoutez vos montants avant d'utiliser la recommandation automatique.</div>}
    {message&&<p className="text-right text-xs text-gray-500">{message}</p>}
  </div>;
}
