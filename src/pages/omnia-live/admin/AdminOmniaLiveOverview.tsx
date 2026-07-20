import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarDays, CheckCircle2, Eye, Radio, Search, ShieldCheck } from 'lucide-react';
import { liveApi } from '../liveApi';
import AdminOmniaLiveShell from './AdminOmniaLiveShell';

const STATUS_LABELS: Record<string,string> = {
  draft:'Brouillon',
  submitted:'À valider',
  under_review:'En examen',
  changes_requested:'Modifications',
  approved:'Approuvé',
  published:'Programmé',
  live:'En direct',
  completed:'Terminé',
  suspended:'Suspendu',
};

function statusClass(status:string){
  if(status==='live') return 'bg-emerald-50 text-emerald-700';
  if(['submitted','under_review','changes_requested'].includes(status)) return 'bg-amber-50 text-amber-700';
  if(status==='suspended') return 'bg-red-50 text-red-700';
  if(status==='completed') return 'bg-slate-100 text-slate-700';
  return 'bg-blue-50 text-blue-700';
}

export default function AdminOmniaLiveOverview(){
  const [data,setData]=useState<any>({kpis:{},recent_events:[]});
  const [error,setError]=useState('');
  const [query,setQuery]=useState('');
  const [status,setStatus]=useState('all');

  useEffect(()=>{
    liveApi('admin_dashboard')
      .then(setData)
      .catch(e=>setError(e instanceof Error?e.message:'Erreur'));
  },[]);

  const k=data.kpis||{};
  const events=data.recent_events||[];

  const filtered=useMemo(()=>events.filter((e:any)=>{
    const q=query.trim().toLowerCase();
    const matchesQ=!q || [e.title,e.organizer_display_name,e.delivery_type].some((v:any)=>String(v||'').toLowerCase().includes(q));
    const matchesStatus=status==='all' || e.status===status;
    return matchesQ&&matchesStatus;
  }),[events,query,status]);

  const stats=[
    {label:'Événements',value:k.total_events||0,icon:CalendarDays},
    {label:'À valider',value:(k.submitted||0)+(k.under_review||0),icon:ShieldCheck},
    {label:'En direct',value:k.live_now||0,icon:Radio},
    {label:'Terminés',value:k.completed||0,icon:CheckCircle2},
    {label:'Suspendus',value:k.suspended||0,icon:AlertTriangle},
  ];

  return <AdminOmniaLiveShell title="Omnia Live" subtitle="Gérez les événements, validations et opérations depuis un seul espace.">
    <div className="mb-6 flex flex-wrap items-center justify-end gap-3">
      <Link to="/omnia-live" className="rounded-xl border border-[#002050] px-5 py-3 font-bold text-[#002050] transition hover:bg-slate-50">
        Voir Omnia Live
      </Link>
      <Link to="/admin/omnia-live/creer" className="rounded-xl bg-[#BF8813] px-5 py-3 font-bold text-white transition hover:opacity-90">
        + Créer un Live
      </Link>
    </div>

    {error&&<div className="mb-5 rounded-xl bg-red-50 p-4 text-red-700">{error}</div>}

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="grid divide-y divide-slate-100 sm:grid-cols-5 sm:divide-x sm:divide-y-0">
        {stats.map(({label,value,icon:Icon})=><div key={label} className="flex items-center gap-3 px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-50 text-[#002050]"><Icon size={18}/></div>
          <div><div className="text-2xl font-black text-[#002050]">{Number(value).toLocaleString()}</div><div className="text-xs font-semibold text-slate-500">{label}</div></div>
        </div>)}
      </div>
    </section>

    <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-lg font-bold text-[#002050]">Événements récents</h2>
          <p className="text-sm text-slate-500">Une vue opérationnelle, sans multiplier les cartes.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="relative">
            <Search size={16} className="absolute left-3 top-3 text-slate-400"/>
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher..." className="rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm"/>
          </label>
          <select value={status} onChange={e=>setStatus(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
            <option value="all">Tous les statuts</option>
            <option value="submitted">À valider</option>
            <option value="under_review">En examen</option>
            <option value="published">Programmés</option>
            <option value="live">En direct</option>
            <option value="completed">Terminés</option>
            <option value="suspended">Suspendus</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">Événement</th>
              <th className="px-4 py-3">Organisateur</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Inscriptions</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e:any)=><tr key={e.id} className="border-t border-slate-100 hover:bg-slate-50/70">
              <td className="px-5 py-4">
                <div className="font-bold text-[#002050]">{e.title}</div>
                <div className="mt-0.5 text-xs text-slate-500">{e.delivery_type||e.event_type||'Omnia Live'}</div>
              </td>
              <td className="px-4 py-4">{e.organizer_display_name||'Omnia Global Academy'}</td>
              <td className="px-4 py-4">{e.starts_at?new Date(e.starts_at).toLocaleString():'—'}</td>
              <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(e.status)}`}>{STATUS_LABELS[e.status]||e.status}</span></td>
              <td className="px-4 py-4">{Number(e.registrations_count||0).toLocaleString()}</td>
              <td className="px-4 py-4 text-right">
                <Link to={`/admin/omnia-live/evenements/${e.id}`} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 font-semibold text-[#002050] hover:bg-white">
                  <Eye size={15}/> Ouvrir
                </Link>
              </td>
            </tr>)}
            {!filtered.length&&<tr><td colSpan={6} className="px-5 py-10 text-center text-slate-500">Aucun événement correspondant.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end border-t border-slate-100 px-5 py-4">
        <Link to="/admin/omnia-live/evenements" className="text-sm font-bold text-[#002050]">Voir tous les événements →</Link>
      </div>
    </section>
  </AdminOmniaLiveShell>
}
