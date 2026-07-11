import { useEffect, useMemo, useState } from 'react';
import { StructureLayout } from '../../components/StructureLayout';
import { ENDPOINTS } from '../../lib/config';
import { APPLICATION_MODE_LABELS, APPLICATION_MODE_SHORT_LABELS, JobApplicationMode, normalizeApplicationMode, labelApplicationStatus } from '../../lib/jobApplicationModes';
import { AlertCircle, Briefcase, CheckCircle2, ExternalLink, Eye, Mail, Plus, RefreshCw, Send, ShieldCheck, X } from 'lucide-react';

const OMNIA_BLUE = '#002050';
const OMNIA_GOLD = '#bf8813';
const BORDER = '#E4E7EC';
const MUTED = '#6B7280';

type Job = {
  id: string;
  title: string;
  description: string;
  location?: string | null;
  contract_type?: string | null;
  category?: string | null;
  deadline?: string | null;
  status: string;
  application_mode?: JobApplicationMode | string | null;
  external_apply_url?: string | null;
  external_apply_email?: string | null;
  applications_count?: number;
  created_at?: string;
  recruiter_company?: string | null;
};

type JobApplication = {
  id: string;
  status?: string;
  tracking_status?: string;
  submitted_at?: string;
  application_mode?: string;
  users?: { full_name?: string; email?: string } | null;
  job_offers?: { title?: string; application_mode?: string } | null;
};

function token() { return localStorage.getItem('omnia_session_token') || ''; }

async function postManage<T>(body: unknown): Promise<T> {
  const res = await fetch(ENDPOINTS.jobPlatformManage, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.message || data.error || 'Erreur');
  return data as T;
}

function statusLabel(status?: string) {
  const map: Record<string, string> = {
    approved: 'Publiée',
    pending_moderation: 'En attente Super Admin',
    rejected: 'Refusée',
    changes_requested: 'Modification demandée',
    suspended: 'Suspendue',
    archived: 'Archivée',
  };
  return map[status || ''] || status || 'Brouillon';
}

function StatusBadge({ status }: { status?: string }) {
  const color = status === 'approved' ? '#15803D' : status === 'rejected' ? '#B91C1C' : status === 'pending_moderation' ? '#92400E' : OMNIA_BLUE;
  const bg = status === 'approved' ? '#DCFCE7' : status === 'rejected' ? '#FEE2E2' : status === 'pending_moderation' ? '#FEF3C7' : 'rgba(0,32,80,0.08)';
  return <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: bg, color }}>{statusLabel(status)}</span>;
}

const emptyJob = {
  title: '', description: '', location: '', contract_type: 'CDI', category: '', deadline: '', salary_range: '', required_level: '', skills_required: '', recruiter_company: '', recruiter_name: '', recruiter_email: '', application_mode: 'omnia_managed' as JobApplicationMode, external_apply_url: '', external_apply_email: '', application_instructions: '',
};

export default function StructureJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyJob);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const stats = useMemo(() => ({
    total: jobs.length,
    published: jobs.filter((j) => j.status === 'approved').length,
    pending: jobs.filter((j) => j.status === 'pending_moderation').length,
    apps: applications.length,
  }), [jobs, applications]);

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(''), 3500);
  }

  async function load() {
    setLoading(true);
    try {
      const [jobsData, appsData] = await Promise.all([
        postManage<{ jobs: Job[] }>({ action: 'list_my_jobs' }),
        postManage<{ applications: JobApplication[] }>({ action: 'list_applications' }),
      ]);
      setJobs(jobsData.jobs || []);
      setApplications(appsData.applications || []);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Impossible de charger les offres.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function createJob() {
    setSaving(true);
    try {
      await postManage({
        action: 'create_job',
        job: {
          ...form,
          skills_required: form.skills_required.split(',').map((s) => s.trim()).filter(Boolean),
          external_apply_url: form.application_mode === 'external_link' ? form.external_apply_url : null,
          external_apply_email: form.application_mode === 'external_email' ? form.external_apply_email : null,
        },
      });
      setShowForm(false);
      setForm(emptyJob);
      showToast('Offre envoyée au Super Admin pour validation.');
      load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erreur pendant la création.');
    } finally {
      setSaving(false);
    }
  }

  async function updateApplication(applicationId: string, status: string) {
    try {
      await postManage({ action: 'update_application_status', application_id: applicationId, status });
      showToast('Statut candidature mis à jour.');
      load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erreur de mise à jour.');
    }
  }

  return (
    <StructureLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {toast && <div className="fixed right-5 top-5 z-50 rounded-xl border bg-white px-4 py-3 text-sm font-medium shadow-lg" style={{ color: OMNIA_BLUE, borderColor: BORDER }}>{toast}</div>}

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: OMNIA_BLUE }}>Offres d’emploi</h1>
            <p className="mt-1 text-sm" style={{ color: MUTED }}>Créez des offres, suivez les validations Super Admin et consultez les candidatures reçues.</p>
          </div>
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{ background: OMNIA_BLUE }}><Plus size={16} />Nouvelle offre</button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[['Offres', stats.total, Briefcase], ['Publiées', stats.published, CheckCircle2], ['En attente', stats.pending, AlertCircle], ['Candidatures', stats.apps, Eye]].map(([label, value, Icon]) => (
            <div key={String(label)} className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: BORDER }}>
              <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'rgba(0,32,80,0.08)' }}><Icon size={18} color={OMNIA_BLUE} /></div><div><p className="text-xs font-medium" style={{ color: MUTED }}>{label as string}</p><p className="text-2xl font-semibold" style={{ color: OMNIA_BLUE }}>{value as number}</p></div></div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: BORDER }}>
            <div className="mb-4 flex items-center justify-between"><h2 className="text-base font-semibold" style={{ color: OMNIA_BLUE }}>Mes offres</h2><button onClick={load} className="inline-flex items-center gap-1 text-sm font-semibold" style={{ color: OMNIA_BLUE }}><RefreshCw size={14} />Actualiser</button></div>
            {loading ? <p className="text-sm text-gray-500">Chargement…</p> : jobs.length === 0 ? <div className="rounded-2xl border border-dashed p-10 text-center" style={{ borderColor: BORDER }}><Briefcase className="mx-auto mb-3 opacity-30" /><p className="text-sm" style={{ color: MUTED }}>Aucune offre créée pour le moment.</p></div> : <div className="space-y-3">{jobs.map((job) => { const mode = normalizeApplicationMode(job.application_mode); return <div key={job.id} className="rounded-2xl border p-4" style={{ borderColor: BORDER }}><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-semibold" style={{ color: OMNIA_BLUE }}>{job.title}</h3><p className="mt-1 text-xs" style={{ color: MUTED }}>{job.recruiter_company || 'Structure'} · {job.contract_type || 'Contrat non défini'} · {job.location || 'Lieu non défini'}</p><div className="mt-3 flex flex-wrap gap-2"><span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: 'rgba(191,136,19,0.12)', color: OMNIA_GOLD }}>{mode === 'external_link' ? <ExternalLink size={12} /> : mode === 'external_email' ? <Mail size={12} /> : <ShieldCheck size={12} />}{APPLICATION_MODE_SHORT_LABELS[mode]}</span><StatusBadge status={job.status} /></div></div><div className="text-right text-xs" style={{ color: MUTED }}>{job.applications_count || 0} candidature(s)</div></div></div>; })}</div>}
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: BORDER }}>
            <h2 className="mb-4 text-base font-semibold" style={{ color: OMNIA_BLUE }}>Candidatures reçues</h2>
            {applications.length === 0 ? <p className="text-sm" style={{ color: MUTED }}>Aucune candidature reçue pour le moment.</p> : <div className="space-y-3">{applications.slice(0, 8).map((app) => <div key={app.id} className="rounded-xl border p-3" style={{ borderColor: BORDER }}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold" style={{ color: OMNIA_BLUE }}>{app.users?.full_name || app.users?.email || 'Candidat'}</p><p className="text-xs" style={{ color: MUTED }}>{app.job_offers?.title || 'Offre'} · {labelApplicationStatus(app.tracking_status || app.status)}</p></div><select value={app.tracking_status || app.status || 'submitted'} onChange={(e) => updateApplication(app.id, e.target.value)} className="rounded-lg border px-2 py-1 text-xs" style={{ borderColor: BORDER }}><option value="received">Reçue</option><option value="viewed">Vue</option><option value="under_review">En analyse</option><option value="shortlisted">Présélectionnée</option><option value="interview">Entretien</option><option value="accepted">Acceptée</option><option value="rejected">Refusée</option></select></div></div>)}</div>}
          </div>
        </div>

        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-xl">
              <div className="flex items-center justify-between border-b p-5" style={{ borderColor: BORDER }}><div><h2 className="text-lg font-bold" style={{ color: OMNIA_BLUE }}>Nouvelle offre d’emploi</h2><p className="text-xs" style={{ color: MUTED }}>Une offre créée par une Structure sera soumise au Super Admin.</p></div><button onClick={() => setShowForm(false)} className="rounded-lg p-1 hover:bg-gray-100"><X size={18} /></button></div>
              <div className="grid gap-4 p-5 md:grid-cols-2">
                <Field label="Titre du poste" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
                <Field label="Entreprise / Structure affichée" value={form.recruiter_company} onChange={(v) => setForm({ ...form, recruiter_company: v })} />
                <Field label="Lieu" value={form.location} onChange={(v) => setForm({ ...form, location: v })} />
                <Field label="Type de contrat" value={form.contract_type} onChange={(v) => setForm({ ...form, contract_type: v })} />
                <Field label="Secteur" value={form.category} onChange={(v) => setForm({ ...form, category: v })} />
                <Field label="Date limite" type="date" value={form.deadline} onChange={(v) => setForm({ ...form, deadline: v })} />
                <div className="md:col-span-2"><label className="mb-1.5 block text-xs font-semibold" style={{ color: OMNIA_BLUE }}>Mode de candidature</label><select value={form.application_mode} onChange={(e) => setForm({ ...form, application_mode: e.target.value as JobApplicationMode })} className="h-11 w-full rounded-xl border px-3 text-sm" style={{ borderColor: BORDER }}><option value="omnia_managed">Candidature gérée sur Omnia</option><option value="external_link">Candidature externe par lien</option><option value="external_email">Candidature externe par email</option></select><p className="mt-1 text-xs" style={{ color: MUTED }}>{APPLICATION_MODE_LABELS[form.application_mode]}</p></div>
                {form.application_mode === 'external_link' && <Field label="Lien externe de candidature" value={form.external_apply_url} onChange={(v) => setForm({ ...form, external_apply_url: v })} />}
                {form.application_mode === 'external_email' && <Field label="Email de candidature" value={form.external_apply_email} onChange={(v) => setForm({ ...form, external_apply_email: v })} />}
                <Field label="Nom recruteur" value={form.recruiter_name} onChange={(v) => setForm({ ...form, recruiter_name: v })} />
                <Field label="Email recruteur" value={form.recruiter_email} onChange={(v) => setForm({ ...form, recruiter_email: v })} />
                <div className="md:col-span-2"><label className="mb-1.5 block text-xs font-semibold" style={{ color: OMNIA_BLUE }}>Description</label><textarea rows={6} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full rounded-xl border px-3 py-2 text-sm" style={{ borderColor: BORDER }} /></div>
                <div className="md:col-span-2"><label className="mb-1.5 block text-xs font-semibold" style={{ color: OMNIA_BLUE }}>Compétences requises séparées par virgules</label><input value={form.skills_required} onChange={(e) => setForm({ ...form, skills_required: e.target.value })} className="h-11 w-full rounded-xl border px-3 text-sm" style={{ borderColor: BORDER }} /></div>
              </div>
              <div className="flex justify-end gap-3 border-t p-5" style={{ borderColor: BORDER }}><button onClick={() => setShowForm(false)} className="rounded-xl border px-4 py-2 text-sm font-semibold" style={{ borderColor: BORDER, color: MUTED }}>Annuler</button><button onClick={createJob} disabled={saving} className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: OMNIA_BLUE }}>{saving ? 'Envoi…' : 'Soumettre au Super Admin'}</button></div>
            </div>
          </div>
        )}
      </div>
    </StructureLayout>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold" style={{ color: OMNIA_BLUE }}>{label}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="h-11 w-full rounded-xl border px-3 text-sm outline-none focus:border-[#002050]" style={{ borderColor: BORDER }} /></label>;
}
