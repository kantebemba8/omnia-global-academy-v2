import { getSessionToken } from '../../lib/session';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '../../components/AdminLayout';
import { ENDPOINTS } from '../../lib/config';
import { edgeAuthHeaders } from '../../lib/edgeAuth';
import { ArrowLeft, Clock } from 'lucide-react';
const BLUE='#002050';

export default function AdminActivityToday(){
 const navigate=useNavigate();
 const [rows,setRows]=useState<any[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{(async()=>{try{
   const token=getSessionToken(); if(!token)throw new Error('Session expirée.');
   const r=await fetch(`${ENDPOINTS.dashboardAdmin}?activity_today_detail=true`,{headers:edgeAuthHeaders()});
   const d=await r.json(); if(!r.ok)throw new Error(d.message||d.error||'Chargement impossible');
   setRows(d.activities||[]);
 }catch(e){setError(e instanceof Error?e.message:'Erreur')}finally{setLoading(false)}})()},[]);
 return <AdminLayout><div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
   <header className="border-b border-gray-200 pb-5">
    <button onClick={()=>navigate('/admin/dashboard')} className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 mb-4"><ArrowLeft size={15}/>Retour au tableau de bord</button>
    <h1 className="text-2xl font-black mt-1" style={{color:BLUE}}>Activité d’aujourd’hui</h1>
   </header>
   {error&&<div className="border-l-4 border-red-500 pl-4 text-sm text-red-700">{error}</div>}
   {loading?<div className="py-16 text-center text-gray-400">Chargement…</div>:rows.length===0?<div className="py-16 text-center text-gray-400">Aucune activité enregistrée aujourd’hui.</div>:
   <div className="border-t border-gray-200">{rows.map((r,i)=><div key={`${r.created_at}-${i}`} className="grid md:grid-cols-[150px_1fr_180px] gap-3 py-4 border-b border-gray-100">
     <div className="text-xs text-gray-500 flex items-center gap-1"><Clock size={13}/>{new Date(r.created_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</div>
     <div><p className="font-semibold" style={{color:BLUE}}>{r.label}</p>{r.detail&&<p className="text-sm text-gray-500 mt-1">{r.detail}</p>}</div>
     <div className="text-xs text-gray-400 md:text-right">{r.source||'Plateforme'}</div>
   </div>)}</div>}
 </div></AdminLayout>
}