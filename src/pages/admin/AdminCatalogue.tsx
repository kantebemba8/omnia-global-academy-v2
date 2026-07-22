import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '../../components/AdminLayout';
import { edgeAuthHeaders } from '../../lib/edgeAuth';
import { BookOpen, RefreshCw, Search, ArrowRight, CheckCircle2, Clock3, FileText, ShieldCheck } from 'lucide-react';

const API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/studio-unified`;
const BLUE = '#002050';
const GOLD = '#BF8813';

type Tab = 'ready' | 'published' | 'all' | 'assisted';
type Course = {
  id:string; title:string; category?:string; level?:string; studio_status?:string;
  is_published?:boolean; creator_context?:string; updated_at?:string; submitted_at?:string;
  assisted_status?:string; certification_requested?:boolean; current_version?:string;
};

const STATUS: Record<string,string> = {
  draft:'Brouillon', pending_validation:'En validation', changes_requested:'Modifications demandées',
  rejected:'Refusée', validated:'Validée', published:'Publiée', archived:'Archivée'
};

export default function AdminCatalogue(){
  const navigate=useNavigate();
  const [tab,setTab]=useState<Tab>('ready');
  const [rows,setRows]=useState<Course[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [q,setQ]=useState('');

  async function load(){
    setLoading(true); setError('');
    try{
      const r=await fetch(API,{method:'POST',headers:edgeAuthHeaders(),body:JSON.stringify({action:'admin_catalogue'})});
      const d=await r.json();
      if(!r.ok||d.success===false) {
        if (d?.error === 'UNKNOWN_ACTION') {
          throw new Error("La fonction Supabase studio-unified déployée n'est pas à jour. Remplacez son index.ts par la V17 fournie puis redéployez.");
        }
        throw new Error(d.message||d.error||'Chargement impossible');
      }
      setRows(d.courses||[]);
    }catch(e){setError(e instanceof Error?e.message:'Erreur de chargement');}
    finally{setLoading(false);}
  }
  useEffect(()=>{load()},[]);

  const filtered=useMemo(()=>{
    let list=rows;
    if(tab==='ready') list=list.filter(x=>x.studio_status==='validated'&&!x.is_published);
    else if(tab==='published') list=list.filter(x=>x.is_published||x.studio_status==='published');
    else if(tab==='assisted') list=list.filter(x=>x.assisted_status||x.certification_requested);
    const query=q.trim().toLowerCase();
    if(query) list=list.filter(x=>`${x.title} ${x.category||''} ${x.level||''}`.toLowerCase().includes(query));
    return list;
  },[rows,tab,q]);

  const counts={
    ready: rows.filter(x=>x.studio_status==='validated'&&!x.is_published).length,
    published: rows.filter(x=>x.is_published||x.studio_status==='published').length,
    all: rows.length,
    assisted: rows.filter(x=>x.assisted_status||x.certification_requested).length,
  };

  return <AdminLayout>
    <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between border-b border-gray-200 pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.14em]" style={{color:GOLD}}>Formations & CPD</p>
          <h1 className="text-2xl font-black mt-1" style={{color:BLUE}}>Catalogue & CPD</h1>
          <p className="text-sm text-gray-500 mt-1">Vue centrale des formations réellement présentes dans la base.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 text-sm font-semibold border border-gray-200 rounded-lg px-3 py-2 text-gray-600">
          <RefreshCw size={15}/> Actualiser
        </button>
      </div>

      <div className="flex flex-wrap gap-6 border-b border-gray-200">
        {([
          ['ready','À publier'],['published','Publiées'],['all','Toutes'],['assisted','Saisie assistée / certifications']
        ] as [Tab,string][]).map(([key,label])=>
          <button key={key} onClick={()=>setTab(key)} className="pb-3 text-sm font-semibold border-b-2"
            style={{color:tab===key?BLUE:'#667085',borderColor:tab===key?GOLD:'transparent'}}>
            {label} ({counts[key]})
          </button>
        )}
      </div>

      <div className="relative max-w-lg">
        <Search size={17} className="absolute left-3 top-2.5 text-gray-400"/>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Rechercher une formation…"
          className="w-full border border-gray-200 rounded-lg py-2 pl-10 pr-3 text-sm outline-none"/>
      </div>

      {error&&<div className="border-l-4 border-red-500 pl-4 py-2 text-sm text-red-700">{error}</div>}

      {loading?<div className="py-16 text-center text-sm text-gray-400">Chargement…</div>:
      filtered.length===0?<div className="border-y border-gray-200 py-14 text-center">
        <BookOpen size={30} className="mx-auto text-gray-300 mb-2"/>
        <p className="text-sm text-gray-500">Aucune formation dans cette vue.</p>
      </div>:
      <div className="border-t border-gray-200">
        {filtered.map(c=><div key={c.id} className="grid grid-cols-1 md:grid-cols-[1.4fr_.7fr_.7fr_auto] gap-3 items-center py-4 border-b border-gray-100">
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate" style={{color:BLUE}}>{c.title}</p>
            <p className="text-xs text-gray-400 mt-1">{c.category||'Sans catégorie'} · {c.level||'Niveau non renseigné'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Statut</p>
            <p className="text-sm text-gray-700">{c.is_published?'Publiée':STATUS[c.studio_status||'']||c.studio_status||'—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Version</p>
            <p className="text-sm text-gray-700">{c.current_version||'1.0'}</p>
          </div>
          <button onClick={()=>navigate(`/admin/courses/${c.id}/edit`)}
            className="inline-flex items-center gap-1 text-xs font-bold" style={{color:GOLD}}>
            Examiner <ArrowRight size={13}/>
          </button>
        </div>)}
      </div>}
    </div>
  </AdminLayout>;
}
