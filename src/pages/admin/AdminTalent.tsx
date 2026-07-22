import { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { adminLoadTalentSupervision, adminUpdateRecruiterStatus, loadTalentAnalytics, TalentAnalytics } from '../talent/talentApi';
import TalentAnalyticsPanel, { PeriodSelector } from '../../components/talent/TalentAnalyticsPanel';
import { CheckCircle2, Clock3, Contact, RefreshCw, ShieldCheck, UserX, UsersRound } from 'lucide-react';

const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

type Status = 'all'|'pending'|'approved'|'rejected'|'suspended';

export default function AdminTalent() {
  const [status, setStatus] = useState<Status>('all');
  const [data, setData] = useState<any>({ recruiters: [], contacts: [], activity: [], metrics: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [query, setQuery] = useState('');
  const [analytics,setAnalytics] = useState<TalentAnalytics|null>(null);
  const [periodDays,setPeriodDays] = useState(30);

  async function load() {
    setLoading(true); setError('');
    try { const [supervision,stats]=await Promise.all([adminLoadTalentSupervision(status === 'all' ? undefined : status),loadTalentAnalytics('admin',periodDays)]); setData(supervision); setAnalytics(stats.analytics); }
    catch (e) { setError(e instanceof Error ? e.message : 'Supervision Talent indisponible.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [status,periodDays]);

  async function update(userId: string, next: 'approved'|'rejected'|'suspended'|'pending') {
    let reason = '';
    if (next === 'rejected' || next === 'suspended') reason = window.prompt('Motif visible par le recruteur :') || '';
    setBusy(userId + next);
    try { await adminUpdateRecruiterStatus(userId, next, reason); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Action impossible.'); }
    finally { setBusy(''); }
  }

  const recruiters = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data.recruiters || [];
    return (data.recruiters || []).filter((r: any) => [r.users?.full_name, r.users?.email, r.company_name, r.job_title, r.professional_email].filter(Boolean).join(' ').toLowerCase().includes(q));
  }, [data.recruiters, query]);

  const metrics = [
    ['En attente', data.metrics?.pending || 0, Clock3],
    ['Validés', data.metrics?.approved || 0, CheckCircle2],
    ['Suspendus', data.metrics?.suspended || 0, UserX],
    ['Contacts', data.metrics?.contacts || 0, Contact],
  ] as const;

  return <AdminLayout>
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-semibold" style={{color:BLUE}}>Supervision Talent Omnia</h1><p className="mt-1 text-sm text-gray-500">Validez les recruteurs et contrôlez les activités sensibles.</p></div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium" style={{borderColor:BORDER,color:BLUE}}><RefreshCw size={16}/>Actualiser</button>
      </div>
      {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <div className="mt-5 flex justify-end"><PeriodSelector value={periodDays} onChange={setPeriodDays}/></div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label,value,Icon])=><div key={label} className="rounded-xl border bg-white p-5" style={{borderColor:BORDER}}><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">{label}</p><p className="mt-2 text-2xl font-semibold" style={{color:BLUE}}>{value}</p></div><Icon color={GOLD}/></div></div>)}</div>
      <div className="mt-6 rounded-xl border bg-white" style={{borderColor:BORDER}}>
        <div className="flex flex-wrap items-center gap-3 border-b p-4" style={{borderColor:BORDER}}>
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nom, entreprise, email…" className="min-w-[240px] flex-1 rounded-lg border px-3 py-2 text-sm" style={{borderColor:BORDER}}/>
          <select value={status} onChange={e=>setStatus(e.target.value as Status)} className="rounded-lg border px-3 py-2 text-sm" style={{borderColor:BORDER}}><option value="all">Tous les statuts</option><option value="pending">En attente</option><option value="approved">Validés</option><option value="rejected">Refusés</option><option value="suspended">Suspendus</option></select>
        </div>
        {loading ? <p className="p-6 text-sm text-gray-500">Chargement…</p> : recruiters.length === 0 ? <div className="p-12 text-center"><UsersRound className="mx-auto" color={GOLD}/><p className="mt-3 text-sm text-gray-500">Aucun recruteur dans cette catégorie.</p></div> : <div className="divide-y">{recruiters.map((r:any)=><div key={r.user_id} className="flex flex-wrap items-center gap-4 p-4"><div className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold" style={{color:BLUE}}>{(r.users?.full_name||r.company_name||'RE').slice(0,2).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold" style={{color:BLUE}}>{r.users?.full_name||'Recruteur'}</p><p className="truncate text-xs text-gray-500">{r.job_title||'Fonction non renseignée'} · {r.company_name||'Entreprise non renseignée'}</p><p className="truncate text-xs text-gray-400">{r.professional_email||r.users?.email||''}</p></div><span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{background:'rgba(191,136,19,.12)',color:GOLD}}>{r.status}</span><div className="flex flex-wrap gap-2">{r.status!=='approved'&&<button disabled={busy!==''} onClick={()=>update(r.user_id,'approved')} className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white">Valider</button>}{r.status!=='rejected'&&<button disabled={busy!==''} onClick={()=>update(r.user_id,'rejected')} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">Refuser</button>}{r.status!=='suspended'&&r.status==='approved'&&<button disabled={busy!==''} onClick={()=>update(r.user_id,'suspended')} className="rounded-lg border px-3 py-2 text-xs font-semibold" style={{borderColor:BORDER,color:BLUE}}>Suspendre</button>}{r.status==='suspended'&&<button disabled={busy!==''} onClick={()=>update(r.user_id,'approved')} className="rounded-lg px-3 py-2 text-xs font-semibold text-white" style={{background:BLUE}}>Réactiver</button>}</div></div>)}</div>}
      </div>
      <div className="mt-6"><TalentAnalyticsPanel analytics={analytics} loading={loading} mode="admin"/></div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border bg-white p-5" style={{borderColor:BORDER}}><div className="flex items-center gap-2"><ShieldCheck color={GOLD}/><h2 className="font-semibold" style={{color:BLUE}}>Activités récentes</h2></div>{(data.activity||[]).length===0?<p className="mt-5 text-sm text-gray-500">Aucune activité enregistrée.</p>:<div className="mt-4 space-y-3">{(data.activity||[]).slice(0,12).map((a:any)=><div key={a.id} className="border-b pb-3 text-sm"><p className="font-medium" style={{color:BLUE}}>{a.action}</p><p className="text-xs text-gray-400">{new Date(a.created_at).toLocaleString('fr-FR')}</p></div>)}</div>}</section>
        <section className="rounded-xl border bg-white p-5" style={{borderColor:BORDER}}><div className="flex items-center gap-2"><Contact color={GOLD}/><h2 className="font-semibold" style={{color:BLUE}}>Contacts recruteur ↔ apprenant</h2></div>{(data.contacts||[]).length===0?<p className="mt-5 text-sm text-gray-500">Aucun contact enregistré.</p>:<div className="mt-4 space-y-3">{(data.contacts||[]).slice(0,12).map((c:any)=><div key={c.id} className="border-b pb-3 text-sm"><p className="font-medium" style={{color:BLUE}}>{c.subject||'Prise de contact'}</p><p className="text-xs text-gray-500">Statut : {c.status}</p><p className="text-xs text-gray-400">{new Date(c.created_at).toLocaleString('fr-FR')}</p></div>)}</div>}</section>
      </div>
    </div>
  </AdminLayout>;
}
