import { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { ENDPOINTS } from '../../lib/config';
import { APPLICATION_MODE_SHORT_LABELS, normalizeApplicationMode } from '../../lib/jobApplicationModes';
import { AlertCircle, Briefcase, CheckCircle2, ExternalLink, Mail, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';

const OMNIA_BLUE = '#002050';
const OMNIA_GOLD = '#bf8813';
const BORDER = '#E4E7EC';
const MUTED = '#6B7280';

type Job = {
  id: string;
  title: string;
  description: string;
  recruiter_company?: string | null;
  location?: string | null;
  contract_type?: string | null;
  status: string;
  application_mode?: string | null;
  created_by_role?: string | null;
  applications_count?: number;
  created_at?: string;
  rejection_reason?: string | null;
};

function token() { return localStorage.getItem('omnia_session_token') || ''; }
async function postManage<T>(body: unknown): Promise<T> {
  const res = await fetch(ENDPOINTS.jobPlatformManage, {
    method: 'POST', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.message || data.error || 'Erreur');
  return data as T;
}

function statusLabel(status?: string) {
  const map: Record<string, string> = { approved: 'Publiée', pending_moderation: 'En attente', rejected: 'Refusée', changes_requested: 'Modification demandée', suspended: 'Suspendue', archived: 'Archivée' };
  return map[status || ''] || status || 'Brouillon';
}

function Badge({ children, tone = 'blue' }: { children: React.ReactNode; tone?: 'blue' | 'gold' | 'green' | 'red' | 'gray' }) {
  const map = { blue: ['rgba(0,32,80,0.08)', OMNIA_BLUE], gold: ['rgba(191,136,19,0.12)', OMNIA_GOLD], green: ['#DCFCE7', '#15803D'], red: ['#FEE2E2', '#B91C1C'], gray: ['#F3F4F6', '#4B5563'] }[tone];
  return <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: map[0], color: map[1] }}>{children}</span>;
}

export default function AdminJobOffers() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [filter, setFilter] = useState('');

  const filtered = useMemo(() => jobs.filter((j) => !filter || j.status === filter), [jobs, filter]);
  const stats = useMemo(() => ({
    pending: jobs.filter((j) => j.status === 'pending_moderation').length,
    approved: jobs.filter((j) => j.status === 'approved').length,
    rejected: jobs.filter((j) => j.status === 'rejected').length,
    total: jobs.length,
  }), [jobs]);

  function showToast(msg: string) { setToast(msg); window.setTimeout(() => setToast(''), 3500); }

  async function load() {
    setLoading(true);
    try {
      const data = await postManage<{ jobs: Job[] }>({ action: 'admin_list_jobs' });
      setJobs(data.jobs || []);
    } catch (e) { showToast(e instanceof Error ? e.message : 'Impossible de charger les offres.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function decide(jobId: string, decision: 'approve' | 'reject' | 'changes_requested' | 'suspend' | 'archive') {
    const reason = decision === 'reject' || decision === 'changes_requested' ? prompt('Commentaire ou motif à transmettre à la Structure :') || '' : '';
    try {
      await postManage({ action: 'admin_decide_job', job_id: jobId, decision, reason });
      showToast('Décision enregistrée.');
      load();
    } catch (e) { showToast(e instanceof Error ? e.message : 'Erreur pendant la décision.'); }
  }

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {toast && <div className="fixed right-5 top-5 z-50 rounded-xl border bg-white px-4 py-3 text-sm font-medium shadow-lg" style={{ color: OMNIA_BLUE, borderColor: BORDER }}>{toast}</div>}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><h1 className="text-2xl font-bold" style={{ color: OMNIA_BLUE }}>Offres d’emploi</h1><p className="mt-1 text-sm" style={{ color: MUTED }}>Validez les offres créées par les Structures et gérez les offres publiées.</p></div>
          <button onClick={load} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold" style={{ borderColor: BORDER, color: OMNIA_BLUE }}><RefreshCw size={16} />Actualiser</button>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">{[['Total', stats.total, Briefcase], ['En attente', stats.pending, AlertCircle], ['Publiées', stats.approved, CheckCircle2], ['Refusées', stats.rejected, XCircle]].map(([label, value, Icon]) => <div key={String(label)} className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: BORDER }}><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'rgba(0,32,80,0.08)' }}><Icon size={18} color={OMNIA_BLUE} /></div><div><p className="text-xs font-medium" style={{ color: MUTED }}>{label as string}</p><p className="text-2xl font-semibold" style={{ color: OMNIA_BLUE }}>{value as number}</p></div></div></div>)}</div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: BORDER }}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold" style={{ color: OMNIA_BLUE }}>Toutes les offres</h2><select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-10 rounded-xl border px-3 text-sm" style={{ borderColor: BORDER }}><option value="">Tous les statuts</option><option value="pending_moderation">En attente</option><option value="approved">Publiées</option><option value="rejected">Refusées</option><option value="changes_requested">Modification demandée</option><option value="suspended">Suspendues</option></select></div>
          {loading ? <p className="text-sm text-gray-500">Chargement…</p> : filtered.length === 0 ? <div className="rounded-2xl border border-dashed p-10 text-center" style={{ borderColor: BORDER }}><Briefcase className="mx-auto mb-3 opacity-30" /><p className="text-sm" style={{ color: MUTED }}>Aucune offre.</p></div> : <div className="space-y-3">{filtered.map((job) => { const mode = normalizeApplicationMode(job.application_mode); const statusTone = job.status === 'approved' ? 'green' : job.status === 'rejected' ? 'red' : job.status === 'pending_moderation' ? 'gold' : 'blue'; return <div key={job.id} className="rounded-2xl border p-4" style={{ borderColor: BORDER }}><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-semibold" style={{ color: OMNIA_BLUE }}>{job.title}</h3><p className="mt-1 text-xs" style={{ color: MUTED }}>{job.recruiter_company || 'Structure'} · {job.contract_type || 'Contrat'} · {job.location || 'Lieu non défini'} · {job.applications_count || 0} candidature(s)</p><div className="mt-3 flex flex-wrap gap-2"><Badge tone={mode === 'omnia_managed' ? 'blue' : 'gold'}>{mode === 'external_link' ? <ExternalLink className="mr-1 inline h-3 w-3" /> : mode === 'external_email' ? <Mail className="mr-1 inline h-3 w-3" /> : <ShieldCheck className="mr-1 inline h-3 w-3" />}{APPLICATION_MODE_SHORT_LABELS[mode]}</Badge><Badge tone={statusTone as any}>{statusLabel(job.status)}</Badge>{job.created_by_role && <Badge tone="gray">{job.created_by_role}</Badge>}</div>{job.rejection_reason && <p className="mt-2 text-xs text-red-600">{job.rejection_reason}</p>}</div><div className="flex flex-wrap gap-2">{job.status !== 'approved' && <button onClick={() => decide(job.id, 'approve')} className="rounded-xl px-3 py-2 text-xs font-semibold text-white" style={{ background: '#15803D' }}>Valider</button>}{job.status === 'pending_moderation' && <button onClick={() => decide(job.id, 'changes_requested')} className="rounded-xl px-3 py-2 text-xs font-semibold text-white" style={{ background: OMNIA_GOLD }}>Modifier</button>}<button onClick={() => decide(job.id, 'reject')} className="rounded-xl px-3 py-2 text-xs font-semibold text-white bg-red-600">Refuser</button>{job.status === 'approved' && <button onClick={() => decide(job.id, 'suspend')} className="rounded-xl border px-3 py-2 text-xs font-semibold" style={{ borderColor: BORDER, color: OMNIA_BLUE }}>Suspendre</button>}</div></div></div>; })}</div>}
        </div>
      </div>
    </AdminLayout>
  );
}
