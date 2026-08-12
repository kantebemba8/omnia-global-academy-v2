import { getSessionToken } from '../../lib/session';
import { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { ENDPOINTS } from '../../lib/config';
import { APPLICATION_MODE_SHORT_LABELS, normalizeApplicationMode } from '../../lib/jobApplicationModes';
import { AlertCircle, Briefcase, CheckCircle2, ExternalLink, Loader2, Mail, Plus, RefreshCw, Save, ShieldCheck, X, XCircle } from 'lucide-react';

const OMNIA_BLUE = '#002050';
const OMNIA_GOLD = '#8B4166';
const BORDER = '#E4E7EC';
const MUTED = '#6B7280';

type Job = {
  id: string;
  title: string;
  description: string;
  recruiter_company?: string | null;
  location?: string | null;
  contract_type?: string | null;
  category?: string | null;
  status: string;
  application_mode?: string | null;
  created_by_role?: string | null;
  applications_count?: number;
  created_at?: string;
  rejection_reason?: string | null;
};

type JobForm = {
  title: string;
  description: string;
  recruiter_company: string;
  recruiter_name: string;
  recruiter_email: string;
  location: string;
  contract_type: string;
  category: string;
  deadline: string;
  salary_range: string;
  required_level: string;
  skills: string;
  application_mode: 'omnia_managed' | 'external_link' | 'external_email';
  external_apply_url: string;
  external_apply_email: string;
  application_instructions: string;
};

const EMPTY_FORM: JobForm = {
  title: '', description: '', recruiter_company: 'Omnia Global Academy', recruiter_name: 'Équipe Omnia', recruiter_email: '',
  location: '', contract_type: '', category: '', deadline: '', salary_range: '', required_level: '', skills: '',
  application_mode: 'omnia_managed', external_apply_url: '', external_apply_email: '', application_instructions: '',
};

function token() { return getSessionToken() || ''; }
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
  const [working, setWorking] = useState(false);
  const [toast, setToast] = useState('');
  const [filter, setFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<JobForm>(EMPTY_FORM);

  const filtered = useMemo(() => jobs.filter((job) => !filter || job.status === filter), [jobs, filter]);
  const stats = useMemo(() => ({
    pending: jobs.filter((job) => job.status === 'pending_moderation').length,
    approved: jobs.filter((job) => job.status === 'approved').length,
    rejected: jobs.filter((job) => job.status === 'rejected').length,
    total: jobs.length,
  }), [jobs]);

  function showToast(message: string) { setToast(message); window.setTimeout(() => setToast(''), 4000); }

  async function load() {
    setLoading(true);
    try {
      const data = await postManage<{ jobs: Job[] }>({ action: 'admin_list_jobs' });
      setJobs(data.jobs || []);
    } catch (caught) { showToast(caught instanceof Error ? caught.message : 'Impossible de charger les offres.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function createJob() {
    if (form.title.trim().length < 3 || form.description.trim().length < 20) { showToast('Complétez le titre et une description détaillée.'); return; }
    if (form.application_mode === 'external_link' && !/^https?:\/\//i.test(form.external_apply_url.trim())) { showToast('Indiquez une adresse web complète commençant par https://'); return; }
    if (form.application_mode === 'external_email' && !form.external_apply_email.includes('@')) { showToast('Indiquez une adresse email de candidature valide.'); return; }
    setWorking(true);
    try {
      await postManage({
        action: 'create_job',
        job: {
          ...form,
          deadline: form.deadline || null,
          skills_required: form.skills.split(',').map(value => value.trim()).filter(Boolean),
        },
      });
      setForm(EMPTY_FORM); setShowForm(false);
      showToast('L’offre Omnia a été publiée directement.');
      await load();
    } catch (caught) { showToast(caught instanceof Error ? caught.message : 'Publication impossible.'); }
    finally { setWorking(false); }
  }

  async function decide(jobId: string, decision: 'approve' | 'reject' | 'changes_requested' | 'suspend' | 'archive') {
    const reason = decision === 'reject' || decision === 'changes_requested' ? prompt('Commentaire ou motif à transmettre à la Structure :') || '' : '';
    try {
      await postManage({ action: 'admin_decide_job', job_id: jobId, decision, reason });
      showToast('Décision enregistrée.'); await load();
    } catch (caught) { showToast(caught instanceof Error ? caught.message : 'Erreur pendant la décision.'); }
  }

  return <AdminLayout><div className="mx-auto max-w-7xl space-y-6 p-6 lg:p-8">
    {toast && <div className="fixed right-5 top-5 z-[80] max-w-md rounded-xl border bg-white px-4 py-3 text-sm font-medium shadow-lg" style={{ color: OMNIA_BLUE, borderColor: BORDER }}>{toast}</div>}
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-bold" style={{ color: OMNIA_BLUE }}>Offres d’emploi</h1><p className="mt-1 text-sm" style={{ color: MUTED }}>Publiez directement des offres Omnia et modérez celles créées par les Structures et recruteurs.</p></div><div className="flex gap-2"><button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold" style={{ borderColor: BORDER, color: OMNIA_BLUE }}><RefreshCw size={16} />Actualiser</button><button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{ background: OMNIA_BLUE }}><Plus size={16} />Créer une offre</button></div></div>

    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">{[['Total', stats.total, Briefcase], ['En attente', stats.pending, AlertCircle], ['Publiées', stats.approved, CheckCircle2], ['Refusées', stats.rejected, XCircle]].map(([label, value, Icon]) => <div key={String(label)} className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: BORDER }}><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'rgba(0,32,80,0.08)' }}><Icon size={18} color={OMNIA_BLUE} /></div><div><p className="text-xs font-medium" style={{ color: MUTED }}>{label as string}</p><p className="text-2xl font-semibold" style={{ color: OMNIA_BLUE }}>{value as number}</p></div></div></div>)}</div>

    {showForm && <section className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: OMNIA_GOLD }}>
      <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold" style={{ color: OMNIA_BLUE }}>Nouvelle offre publiée par Omnia</h2><p className="mt-1 text-sm text-gray-500">Une offre créée ici est validée et publiée immédiatement, sans auto-modération inutile.</p></div><button onClick={() => setShowForm(false)} className="rounded-lg p-2 hover:bg-gray-100" aria-label="Fermer"><X size={18} /></button></div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Input label="Titre *" value={form.title} onChange={value => setForm(current => ({ ...current, title: value }))} />
        <Input label="Entreprise" value={form.recruiter_company} onChange={value => setForm(current => ({ ...current, recruiter_company: value }))} />
        <Input label="Lieu" value={form.location} onChange={value => setForm(current => ({ ...current, location: value }))} placeholder="Ville, pays ou télétravail…" />
        <Input label="Type de contrat" value={form.contract_type} onChange={value => setForm(current => ({ ...current, contract_type: value }))} placeholder="CDI, CDD, stage…" />
        <Input label="Catégorie" value={form.category} onChange={value => setForm(current => ({ ...current, category: value }))} />
        <Input label="Date limite" type="date" value={form.deadline} onChange={value => setForm(current => ({ ...current, deadline: value }))} />
        <Input label="Rémunération" value={form.salary_range} onChange={value => setForm(current => ({ ...current, salary_range: value }))} placeholder="Ex. 400 000 – 600 000 XOF" />
        <Input label="Niveau requis" value={form.required_level} onChange={value => setForm(current => ({ ...current, required_level: value }))} />
        <Input label="Nom du recruteur" value={form.recruiter_name} onChange={value => setForm(current => ({ ...current, recruiter_name: value }))} />
        <Input label="Email du recruteur" type="email" value={form.recruiter_email} onChange={value => setForm(current => ({ ...current, recruiter_email: value }))} />
        <div className="md:col-span-2"><Input label="Compétences requises, séparées par des virgules" value={form.skills} onChange={value => setForm(current => ({ ...current, skills: value }))} /></div>
        <label className="md:col-span-2"><span className="mb-1.5 block text-xs font-semibold text-gray-600">Description détaillée *</span><textarea rows={6} value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} className="w-full rounded-xl border px-3 py-2 text-sm" style={{ borderColor: BORDER }} /></label>
        <label><span className="mb-1.5 block text-xs font-semibold text-gray-600">Mode de candidature</span><select value={form.application_mode} onChange={event => setForm(current => ({ ...current, application_mode: event.target.value as JobForm['application_mode'] }))} className="h-11 w-full rounded-xl border px-3 text-sm" style={{ borderColor: BORDER }}><option value="omnia_managed">Candidature gérée sur Omnia</option><option value="external_link">Redirection vers un site externe</option><option value="external_email">Candidature par email externe</option></select></label>
        {form.application_mode === 'external_link' && <Input label="Lien de candidature externe *" value={form.external_apply_url} onChange={value => setForm(current => ({ ...current, external_apply_url: value }))} placeholder="https://…" />}
        {form.application_mode === 'external_email' && <Input label="Email de candidature externe *" type="email" value={form.external_apply_email} onChange={value => setForm(current => ({ ...current, external_apply_email: value }))} />}
        <label className="md:col-span-2"><span className="mb-1.5 block text-xs font-semibold text-gray-600">Instructions de candidature</span><textarea rows={3} value={form.application_instructions} onChange={event => setForm(current => ({ ...current, application_instructions: event.target.value }))} className="w-full rounded-xl border px-3 py-2 text-sm" style={{ borderColor: BORDER }} /></label>
      </div>
      <div className="mt-5 flex justify-end"><button disabled={working} onClick={() => void createJob()} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40" style={{ background: OMNIA_BLUE }}>{working ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}Publier l’offre</button></div>
    </section>}

    <div className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: BORDER }}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold" style={{ color: OMNIA_BLUE }}>Toutes les offres</h2><select value={filter} onChange={(event) => setFilter(event.target.value)} className="h-10 rounded-xl border px-3 text-sm" style={{ borderColor: BORDER }}><option value="">Tous les statuts</option><option value="pending_moderation">En attente</option><option value="approved">Publiées</option><option value="rejected">Refusées</option><option value="changes_requested">Modification demandée</option><option value="suspended">Suspendues</option></select></div>
      {loading ? <p className="text-sm text-gray-500">Chargement…</p> : filtered.length === 0 ? <div className="rounded-2xl border border-dashed p-10 text-center" style={{ borderColor: BORDER }}><Briefcase className="mx-auto mb-3 opacity-30" /><p className="text-sm" style={{ color: MUTED }}>Aucune offre.</p></div> : <div className="space-y-3">{filtered.map((job) => { const mode = normalizeApplicationMode(job.application_mode); const statusTone = job.status === 'approved' ? 'green' : job.status === 'rejected' ? 'red' : job.status === 'pending_moderation' ? 'gold' : 'blue'; return <div key={job.id} className="rounded-2xl border p-4" style={{ borderColor: BORDER }}><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-semibold" style={{ color: OMNIA_BLUE }}>{job.title}</h3><p className="mt-1 text-xs" style={{ color: MUTED }}>{job.recruiter_company || 'Structure'} · {job.contract_type || 'Contrat'} · {job.location || 'Lieu non défini'} · {job.applications_count || 0} candidature(s)</p><div className="mt-3 flex flex-wrap gap-2"><Badge tone={mode === 'omnia_managed' ? 'blue' : 'gold'}>{mode === 'external_link' ? <ExternalLink className="mr-1 inline h-3 w-3" /> : mode === 'external_email' ? <Mail className="mr-1 inline h-3 w-3" /> : <ShieldCheck className="mr-1 inline h-3 w-3" />}{APPLICATION_MODE_SHORT_LABELS[mode]}</Badge><Badge tone={statusTone as 'blue' | 'gold' | 'green' | 'red' | 'gray'}>{statusLabel(job.status)}</Badge>{job.created_by_role && <Badge tone="gray">{job.created_by_role}</Badge>}</div>{job.rejection_reason && <p className="mt-2 text-xs text-red-600">{job.rejection_reason}</p>}</div><div className="flex flex-wrap gap-2">{job.status !== 'approved' && <button onClick={() => void decide(job.id, 'approve')} className="rounded-xl px-3 py-2 text-xs font-semibold text-white" style={{ background: '#15803D' }}>Valider</button>}{job.status === 'pending_moderation' && <button onClick={() => void decide(job.id, 'changes_requested')} className="rounded-xl px-3 py-2 text-xs font-semibold text-white" style={{ background: OMNIA_GOLD }}>Modifier</button>}<button onClick={() => void decide(job.id, 'reject')} className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white">Refuser</button>{job.status === 'approved' && <button onClick={() => void decide(job.id, 'suspend')} className="rounded-xl border px-3 py-2 text-xs font-semibold" style={{ borderColor: BORDER, color: OMNIA_BLUE }}>Suspendre</button>}</div></div></div>; })}</div>}
    </div>
  </div></AdminLayout>;
}

function Input({ label, value, onChange, type = 'text', placeholder = '' }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return <label><span className="mb-1.5 block text-xs font-semibold text-gray-600">{label}</span><input type={type} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="h-11 w-full rounded-xl border px-3 text-sm" style={{ borderColor: BORDER }} /></label>;
}
