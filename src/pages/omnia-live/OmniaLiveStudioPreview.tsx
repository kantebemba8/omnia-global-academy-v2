import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import OmniaLiveLayout from '../../components/omnia-live/OmniaLiveLayout';
import { liveApi } from './liveApi';

const BLUE='#002050', GOLD='#BF8813';

export default function OmniaLiveStudioPreview(){
  const {liveId}=useParams(); const navigate=useNavigate();
  const [data,setData]=useState<any>(null),[loading,setLoading]=useState(true),[submitting,setSubmitting]=useState(false),[message,setMessage]=useState('');
  const load=()=>liveApi('studio_get',{}, {event_id:liveId||''}).then(setData).catch(e=>setMessage(e instanceof Error?e.message:'Chargement impossible.')).finally(()=>setLoading(false));
  useEffect(()=>{if(liveId)load()},[liveId]);

  async function submit(){
    if(!liveId)return; setSubmitting(true);setMessage('');
    try{await liveApi('submit',{method:'POST',body:JSON.stringify({event_id:liveId})}); await load(); setMessage('Votre proposition a été envoyée au Super Admin.');}
    catch(e){setMessage(e instanceof Error?e.message:'Soumission impossible.')}finally{setSubmitting(false)}
  }
  if(loading)return <OmniaLiveLayout><div className="mx-auto max-w-6xl px-4 py-12 text-slate-500">Chargement...</div></OmniaLiveLayout>;
  const e=data?.event||{}, sessions=data?.sessions||[], speakers=data?.speakers||[];
  return <OmniaLiveLayout><section className="mx-auto max-w-6xl px-4 py-10 md:px-8">
    <div className="mb-8"><div className="text-sm font-bold uppercase tracking-wide" style={{color:GOLD}}>Studio Omnia Live · Étape 7 sur 7</div><h1 className="mt-2 text-3xl font-black" style={{color:BLUE}}>Prévisualisation et soumission</h1></div>
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="rounded-3xl border bg-white overflow-hidden">
        <div className="min-h-56 bg-slate-100 flex items-center justify-center">{e.cover_url?<img src={e.cover_url} alt="" className="h-64 w-full object-cover"/>:<div className="text-center"><div className="text-sm font-bold" style={{color:GOLD}}>OMNIA LIVE</div><div className="mt-2 text-slate-500">{e.cover_template_key||'Couverture Omnia'}</div></div>}</div>
        <div className="p-6 md:p-8"><div className="flex flex-wrap gap-2 text-xs font-bold uppercase"><span className="rounded-full bg-slate-100 px-3 py-1">{e.event_type}</span><span className="rounded-full bg-slate-100 px-3 py-1">{e.delivery_type}</span><span className="rounded-full bg-slate-100 px-3 py-1">{e.visibility}</span></div>
          <h2 className="mt-4 text-3xl font-black" style={{color:BLUE}}>{e.title||'Sans titre'}</h2><p className="mt-3 text-slate-600">{e.short_description}</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2"><div><div className="text-xs uppercase text-slate-400">Organisateur</div><div className="font-semibold">{e.organizer_display_name||'—'}</div></div><div><div className="text-xs uppercase text-slate-400">Prix proposé</div><div className="font-semibold">{Number(e.price_amount||0)>0?`${e.price_amount} ${e.currency||'XOF'}`:'Gratuit'}</div></div><div><div className="text-xs uppercase text-slate-400">Langue</div><div className="font-semibold">{e.language||'—'}</div></div><div><div className="text-xs uppercase text-slate-400">Replay</div><div className="font-semibold">{e.replay_enabled?'Prévu':'Non prévu'}</div></div></div>
          <div className="mt-7"><h3 className="font-bold" style={{color:BLUE}}>Description</h3><p className="mt-2 whitespace-pre-wrap text-slate-600">{e.long_description||'—'}</p></div>
          {sessions.length>0&&<div className="mt-7"><h3 className="font-bold" style={{color:BLUE}}>Sessions</h3><div className="mt-3 space-y-2">{sessions.map((s:any)=><div key={s.id} className="rounded-xl border p-3"><div className="font-semibold">{s.title}</div><div className="text-sm text-slate-500">{s.starts_at?new Date(s.starts_at).toLocaleString():'Date à définir'}</div></div>)}</div></div>}
          {speakers.length>0&&<div className="mt-7"><h3 className="font-bold" style={{color:BLUE}}>Intervenants</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">{speakers.map((s:any)=><div key={s.id} className="rounded-xl border p-3"><div className="font-semibold">{s.external_name||'Utilisateur Omnia'}</div><div className="text-sm text-slate-500">{s.title||s.role}</div></div>)}</div></div>}
        </div>
      </div>
      <aside className="space-y-4"><div className="rounded-2xl border bg-white p-5"><div className="text-sm text-slate-500">Statut</div><div className="mt-1 font-bold" style={{color:BLUE}}>{e.status||'draft'}</div></div>
        {e.admin_review_message&&<div className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="font-bold">Message Super Admin</div><p className="mt-2 text-sm">{e.admin_review_message}</p></div>}
        {['draft','changes_requested'].includes(e.status)&&<button onClick={submit} disabled={submitting} className="w-full rounded-xl px-5 py-3 font-bold text-white" style={{background:BLUE}}>{submitting?'Envoi...':'Soumettre pour validation'}</button>}
        <button onClick={()=>navigate(`/omnia-live/studio/${liveId}/ressources`)} className="w-full rounded-xl border border-slate-300 px-5 py-3 font-semibold">← Modifier l’étape 6</button>
        <button onClick={()=>navigate(`/omnia-live/${liveId}`)} className="w-full rounded-xl border px-5 py-3 font-semibold" style={{borderColor:GOLD,color:BLUE}}>Voir la fiche</button>
        {message&&<div className="rounded-xl bg-slate-50 p-4 text-sm">{message}</div>}
      </aside>
    </div>
  </section></OmniaLiveLayout>;
}
