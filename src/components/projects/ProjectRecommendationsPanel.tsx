import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Ban, MessageSquareQuote, RefreshCw, Send } from 'lucide-react';
import { OmniaProject } from '../../lib/projectsApi';
import { projectPortfolioRequest } from '../../lib/projectPortfolioApi';

type Candidate = { id: string; full_name?: string | null; email?: string | null };
type Recommendation = {
  id: string;
  recommendation_text: string;
  skill_codes?: string[];
  rating?: number | null;
  status: string;
  author_name_snapshot: string;
  author_role_snapshot?: string | null;
  organization_name_snapshot?: string | null;
  created_at?: string;
  recipient?: { id: string; full_name?: string | null; email?: string | null } | null;
  project?: { id: string; title: string; status?: string } | null;
};

const STATUS_LABELS: Record<string, string> = {
  submitted: 'En attente de réponse',
  accepted: 'Acceptée',
  declined: 'Refusée',
  revoked: 'Invalidée',
};

export function OwnerProjectRecommendationsPanel({ projects }: { projects: OmniaProject[] }) {
  const eligibleProjects = useMemo(() => projects.filter(project => project.status === 'closed'), [projects]);
  const [projectId, setProjectId] = useState('');
  const [users, setUsers] = useState<Candidate[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!projectId && eligibleProjects[0]) setProjectId(eligibleProjects[0].id);
  }, [eligibleProjects, projectId]);

  async function loadProjectData(selectedProjectId = projectId) {
    if (!selectedProjectId) {
      setUsers([]);
      setRecommendations([]);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const [candidateResult, recommendationResult] = await Promise.all([
        projectPortfolioRequest<{ users: Candidate[] }>('project_candidates', { project_id: selectedProjectId }),
        projectPortfolioRequest<{ recommendations: Recommendation[] }>('owner_recommendations', { project_id: selectedProjectId }),
      ]);
      setUsers(candidateResult.users || []);
      setRecommendations(recommendationResult.recommendations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chargement impossible.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { void loadProjectData(projectId); }, [projectId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await projectPortfolioRequest('create_recommendation', {
        project_id: projectId,
        recipient_user_id: form.get('recipient'),
        recommendation_text: form.get('text'),
        skill_codes: String(form.get('skills') || '').split(',').map(value => value.trim()).filter(Boolean),
        rating: Number(form.get('rating') || 0) || null,
      });
      setNotice('Recommandation professionnelle envoyée. Le participant doit l’accepter avant son intégration au portfolio.');
      event.currentTarget.reset();
      await loadProjectData(projectId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Envoi impossible.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="mt-8 border bg-white p-5 sm:p-6" style={{ borderColor: '#E4E7EC', borderRadius: 18 }}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="flex items-center gap-2 text-xl font-bold" style={{ color: '#002050' }}><MessageSquareQuote size={20} /> Recommandations professionnelles</h2><p className="mt-1 text-sm text-slate-600">Disponibles uniquement après la clôture du projet et uniquement pour ses participants réels.</p></div>
      <button onClick={() => void loadProjectData()} disabled={busy} className="rounded-lg border p-2 text-slate-500" style={{ borderColor: '#D0D5DD' }}><RefreshCw size={17} /></button>
    </div>
    {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {notice && <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{notice}</div>}
    {!eligibleProjects.length ? <div className="mt-5 rounded-xl bg-slate-50 p-5 text-sm text-slate-600">Aucun projet clôturé. Une recommandation ne peut être créée qu’après la fin et la validation du projet.</div> : <>
      <label className="mt-5 block text-sm font-semibold">Projet clôturé<select value={projectId} onChange={event => setProjectId(event.target.value)} className="mt-2 w-full rounded-lg border px-3 py-2"><option value="">Choisir</option>{eligibleProjects.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label>
      <form onSubmit={submit} className="mt-5 rounded-xl border p-5" style={{ borderColor: '#E4E7EC' }}>
        <h3 className="font-bold text-[#002050]">Ajouter une recommandation</h3>
        <label className="mt-4 block text-sm font-semibold">Participant<select name="recipient" required className="mt-2 w-full rounded-lg border px-3 py-2"><option value="">Choisir</option>{users.map(user => <option key={user.id} value={user.id}>{user.full_name || user.email}</option>)}</select></label>
        <label className="mt-4 block text-sm font-semibold">Recommandation<textarea name="text" required rows={5} className="mt-2 w-full rounded-lg border px-3 py-2" placeholder="Décrivez les contributions observées et les qualités démontrées." /></label>
        <div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Compétences observées<input name="skills" className="mt-2 w-full rounded-lg border px-3 py-2" placeholder="Gestion de projet, analyse…" /></label><label className="text-sm font-semibold">Appréciation<select name="rating" defaultValue="" className="mt-2 w-full rounded-lg border px-3 py-2"><option value="">Sans note</option>{[5,4,3,2,1].map(value => <option key={value} value={value}>{value}/5</option>)}</select></label></div>
        <button disabled={busy || !projectId || !users.length} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#002050] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Send size={15} />{busy ? 'Envoi…' : 'Envoyer la recommandation'}</button>
      </form>
      <div className="mt-6"><h3 className="font-bold text-[#002050]">Recommandations envoyées</h3><div className="mt-3 divide-y rounded-xl border" style={{ borderColor: '#E4E7EC' }}>{recommendations.length ? recommendations.map(item => <article key={item.id} className="p-4"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-semibold text-slate-900">{item.recipient?.full_name || item.recipient?.email || 'Participant'}</p><p className="text-xs text-slate-500">{STATUS_LABELS[item.status] || item.status}</p></div>{item.rating ? <span className="text-sm font-semibold text-[#76520A]">{item.rating}/5</span> : null}</div><p className="mt-2 text-sm text-slate-700">{item.recommendation_text}</p></article>) : <p className="p-4 text-sm text-slate-500">Aucune recommandation envoyée pour ce projet.</p>}</div></div>
    </>}
  </section>;
}

export function AdminProjectRecommendationsPanel() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    setError('');
    try {
      const result = await projectPortfolioRequest<{ recommendations: Recommendation[] }>('admin_list_recommendations');
      setRecommendations(result.recommendations || []);
    } catch (err) { setError(err instanceof Error ? err.message : 'Chargement impossible.'); }
  }
  useEffect(() => { void load(); }, []);

  async function invalidate(id: string) {
    const reason = window.prompt('Motif obligatoire de l’invalidation');
    if (!reason?.trim()) return;
    setBusyId(id); setError(''); setNotice('');
    try {
      await projectPortfolioRequest('admin_revoke_recommendation', { recommendation_id: id, reason: reason.trim() });
      setNotice('Recommandation invalidée.');
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Action impossible.'); }
    finally { setBusyId(''); }
  }

  return <section className="mt-8 border bg-white p-5 sm:p-6" style={{ borderColor: '#E4E7EC', borderRadius: 18 }}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-xl font-bold" style={{ color: '#002050' }}><MessageSquareQuote size={20}/> Recommandations professionnelles</h2><p className="mt-1 text-sm text-slate-600">Supervision et modération uniquement. L’Administration Omnia ne crée pas de recommandation.</p></div><button onClick={() => void load()} className="rounded-lg border p-2 text-slate-500" style={{ borderColor: '#D0D5DD' }}><RefreshCw size={17}/></button></div>
    {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}{notice && <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{notice}</div>}
    <div className="mt-5 divide-y rounded-xl border" style={{ borderColor: '#E4E7EC' }}>{recommendations.length ? recommendations.map(item => <article key={item.id} className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-slate-900">{item.project?.title || 'Projet'} — {item.recipient?.full_name || item.recipient?.email || 'Participant'}</p><p className="mt-1 text-xs text-slate-500">Par {item.author_name_snapshot} · {STATUS_LABELS[item.status] || item.status}</p></div>{item.status !== 'revoked' && <button disabled={busyId === item.id} onClick={() => void invalidate(item.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700"><Ban size={14}/> Invalider</button>}</div><p className="mt-3 text-sm text-slate-700">{item.recommendation_text}</p></article>) : <p className="p-5 text-sm text-slate-500">Aucune recommandation professionnelle.</p>}</div>
  </section>;
}
