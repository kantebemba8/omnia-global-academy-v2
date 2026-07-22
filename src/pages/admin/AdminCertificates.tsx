import { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { edgeAuthHeaders } from '../../lib/edgeAuth';
import { Download, Eye, RefreshCw, Search, XCircle } from 'lucide-react';

const API=`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/certificate-admin`;
const BLUE='#002050', GOLD='#BF8813';

export default function AdminCertificates(){
  const [rows,setRows]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [search,setSearch]=useState('');
  const [status,setStatus]=useState('all');
  const [source,setSource]=useState('all');
  const [revoke,setRevoke]=useState<any|null>(null);
  const [reason,setReason]=useState('');

  async function load(){
    setLoading(true);setError('');
    try{
      const r=await fetch(`${API}?action=list`,{headers:edgeAuthHeaders()});
      const d=await r.json();if(!r.ok||!d.success)throw new Error(d.message||d.error||'Chargement impossible');
      setRows(d.certificates||[]);
    }catch(e){setError(e instanceof Error?e.message:'Erreur');}
    finally{setLoading(false);}
  }
  useEffect(()=>{load()},[]);

  async function confirmRevoke(){
    if(!revoke||!reason.trim())return;
    try{
      const r=await fetch(API,{method:'POST',headers:edgeAuthHeaders(),body:JSON.stringify({action:'revoke',certificate_id:revoke.omnia_certificate_id,reason})});
      const d=await r.json();if(!r.ok||!d.success)throw new Error(d.message||d.error||'Révocation impossible');
      setRevoke(null);setReason('');await load();
    }catch(e){setError(e instanceof Error?e.message:'Erreur');}
  }

  const filtered=useMemo(()=>rows.filter(c=>{
    const q=search.toLowerCase();
    return (!q||`${c.student_full_name||''} ${c.course_title||''} ${c.omnia_certificate_id||''}`.toLowerCase().includes(q))
      &&(status==='all'||(status==='active'?(c.status!=='revoked'&&c.validity_status!=='revoked'):(c.status==='revoked'||c.validity_status==='revoked')))
      &&(source==='all'||c.source_type===source);
  }),[rows,search,status,source]);

  const active=rows.filter(c=>c.status!=='revoked'&&c.validity_status!=='revoked').length;
  const revoked=rows.length-active;
  const cpd=rows.filter(c=>c.cpd_accredited||c.document_type==='cpd_certificate').length;

  return <AdminLayout><div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
    <header className="border-b border-gray-200 pb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="text-xs font-semibold uppercase tracking-[.14em]" style={{color:GOLD}}>Certificats & attestations</p>
        <h1 className="text-2xl font-black mt-1" style={{color:BLUE}}>Documents délivrés</h1>
        <p className="text-sm text-gray-500 mt-1">Formations OGA, professeurs, Structures, Omnia Live et Open CPD.</p></div>
      <button onClick={load} className="inline-flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold text-gray-600"><RefreshCw size={15}/>Actualiser</button>
    </header>

    <div className="flex flex-wrap gap-x-7 gap-y-2 border-y border-gray-200 py-3 text-sm">
      <span><strong style={{color:BLUE}}>{rows.length}</strong> délivrés</span>
      <span><strong style={{color:'#1E7A52'}}>{active}</strong> actifs</span>
      <span><strong style={{color:'#B42318'}}>{revoked}</strong> révoqués</span>
      <span><strong style={{color:GOLD}}>{cpd}</strong> Open CPD / CPD</span>
    </div>

    <div className="flex flex-col md:flex-row gap-3">
      <div className="relative flex-1"><Search size={16} className="absolute left-3 top-2.5 text-gray-400"/>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nom, formation ou identifiant…" className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm"/></div>
      <select value={status} onChange={e=>setStatus(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm"><option value="all">Tous les statuts</option><option value="active">Actifs</option><option value="revoked">Révoqués</option></select>
      <select value={source} onChange={e=>setSource(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm"><option value="all">Toutes les origines</option><option value="course">Formation</option><option value="omnia_live">Omnia Live</option></select>
    </div>

    {error&&<div className="border-l-4 border-red-500 pl-4 py-2 text-sm text-red-700">{error}</div>}

    <div className="overflow-x-auto border-t border-gray-200">
      <table className="w-full text-sm"><thead><tr className="text-left text-xs text-gray-500 border-b border-gray-200">
        <th className="py-3">Identifiant</th><th>Bénéficiaire</th><th>Document</th><th>Origine</th><th>Langue</th><th>Date</th><th>Statut</th><th></th>
      </tr></thead><tbody>
      {loading?<tr><td colSpan={8} className="py-14 text-center text-gray-400">Chargement…</td></tr>:
      filtered.length===0?<tr><td colSpan={8} className="py-14 text-center text-gray-400">Aucun document trouvé.</td></tr>:
      filtered.map(c=><tr key={c.id} className="border-b border-gray-100">
        <td className="py-3 font-mono text-xs" style={{color:BLUE}}>{c.omnia_certificate_id}</td>
        <td className="font-semibold text-gray-700">{c.student_full_name||'—'}</td>
        <td><p className="text-gray-700">{c.course_title||'Document Omnia'}</p><p className="text-xs text-gray-400">{c.document_type||'completion_certificate'}</p></td>
        <td className="text-gray-600">{c.source_type==='omnia_live'?'Omnia Live':'Formation'}</td>
        <td className="uppercase text-xs">{c.language_code||'fr'}</td>
        <td className="text-gray-500">{c.issued_at?new Date(c.issued_at).toLocaleDateString('fr-FR'):'—'}</td>
        <td className={c.status==='revoked'||c.validity_status==='revoked'?'text-red-700':'text-emerald-700'}>{c.status==='revoked'||c.validity_status==='revoked'?'Révoqué':'Actif'}</td>
        <td><div className="flex gap-2 justify-end">
          <a href={`/verify/${c.omnia_certificate_id}`} target="_blank" rel="noreferrer" title="Vérifier"><Eye size={15}/></a>
          {c.pdf_url&&<a href={c.pdf_url} target="_blank" rel="noreferrer" title="Télécharger"><Download size={15}/></a>}
          {c.status!=='revoked'&&c.validity_status!=='revoked'&&<button onClick={()=>setRevoke(c)} title="Révoquer" className="text-red-600"><XCircle size={15}/></button>}
        </div></td>
      </tr>)}
      </tbody></table>
    </div>

    {revoke&&<div className="fixed inset-0 z-[100] bg-black/30 flex items-center justify-center p-4"><div className="bg-white w-full max-w-md rounded-xl p-5 shadow-xl">
      <h3 className="text-lg font-black" style={{color:BLUE}}>Révoquer ce document ?</h3>
      <p className="text-sm text-gray-500 mt-2">{revoke.omnia_certificate_id} · {revoke.student_full_name}</p>
      <label className="block text-sm font-semibold text-gray-700 mt-4 mb-1">Motif obligatoire</label>
      <textarea value={reason} onChange={e=>setReason(e.target.value)} rows={4} className="w-full border border-gray-200 rounded-lg p-3 text-sm" placeholder="Erreur administrative, fraude, annulation…"/>
      <div className="flex justify-end gap-3 mt-4"><button onClick={()=>{setRevoke(null);setReason('')}} className="px-4 py-2 border rounded-lg text-sm">Annuler</button><button disabled={!reason.trim()} onClick={confirmRevoke} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm disabled:opacity-50">Confirmer la révocation</button></div>
    </div></div>}
  </div></AdminLayout>;
}
