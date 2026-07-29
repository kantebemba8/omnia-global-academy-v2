import { FormEvent, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MessageSquareQuote, Send } from 'lucide-react';
import { getOwnerProjects, OmniaProject } from '../../lib/projectsApi';
import { projectPortfolioRequest } from '../../lib/projectPortfolioApi';
import { ProjectsWorkspaceFrame } from '../../components/projects/ProjectUi';

type Candidate = {
  id: string;
  full_name?: string | null;
  email?: string | null;
};

export default function ProjectRecommendations() {
  const { pathname } = useLocation();
  const backPath = pathname.startsWith('/admin/') ? '/admin/projects' : '/projects/gestion';
  const [projects, setProjects] = useState<OmniaProject[]>([]);
  const [projectId, setProjectId] = useState('');
  const [users, setUsers] = useState<Candidate[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setBusy(true);
    setError('');
    try {
      const result = await getOwnerProjects();
      setProjects(result.projects || []);
      if (!projectId && result.projects?.[0]) setProjectId(result.projects[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chargement impossible.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
    // Le chargement initial ne doit pas se répéter lors du choix d’un projet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!projectId) {
      setUsers([]);
      return;
    }
    projectPortfolioRequest<{ users: Candidate[] }>('project_candidates', { project_id: projectId })
      .then(result => setUsers(result.users || []))
      .catch(err => setError(err instanceof Error ? err.message : 'Participants indisponibles.'));
  }, [projectId]);

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
      setNotice('Recommandation professionnelle envoyée. Le destinataire devra l’accepter avant son intégration au portfolio.');
      event.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Envoi impossible.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ProjectsWorkspaceFrame>
      <div className="mx-auto max-w-4xl px-4 py-7 md:px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#BF8813]">Omnia Projects</p>
          <h1 className="mt-1 text-2xl font-bold text-[#002050]">Recommandations professionnelles</h1>
          <p className="mt-2 text-sm text-slate-500">Émettez une recommandation vérifiable après une expérience réelle.</p>
        </div>
        <div className="flex justify-end">
          <Link to={backPath} className="rounded-lg border px-4 py-2 text-sm font-semibold">Retour à la gestion</Link>
        </div>

        {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {notice && <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{notice}</div>}

        <form onSubmit={submit} className="mt-6 rounded-xl border bg-white p-6">
          <div className="flex items-center gap-2">
            <MessageSquareQuote color="#BF8813" />
            <h2 className="font-bold text-[#002050]">Nouvelle recommandation professionnelle</h2>
          </div>

          <label className="mt-5 block text-sm font-semibold">
            Projet
            <select value={projectId} onChange={event => setProjectId(event.target.value)} className="mt-2 w-full rounded-lg border px-3 py-2">
              <option value="">Choisir</option>
              {projects.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}
            </select>
          </label>

          <label className="mt-4 block text-sm font-semibold">
            Participant
            <select name="recipient" required className="mt-2 w-full rounded-lg border px-3 py-2">
              <option value="">Choisir</option>
              {users.map(user => <option key={user.id} value={user.id}>{user.full_name || user.email}</option>)}
            </select>
          </label>

          <label className="mt-4 block text-sm font-semibold">
            Recommandation
            <textarea name="text" required rows={6} className="mt-2 w-full rounded-lg border px-3 py-2" placeholder="Décrivez les contributions observées et les qualités démontrées." />
          </label>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold">
              Compétences observées
              <input name="skills" className="mt-2 w-full rounded-lg border px-3 py-2" placeholder="Gestion de projet, analyse…" />
            </label>
            <label className="text-sm font-semibold">
              Appréciation
              <select name="rating" defaultValue="" className="mt-2 w-full rounded-lg border px-3 py-2">
                <option value="">Sans note</option>
                {[5, 4, 3, 2, 1].map(value => <option key={value} value={value}>{value}/5</option>)}
              </select>
            </label>
          </div>

          <button disabled={busy || !projectId} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#002050] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
            <Send size={15} />
            {busy ? 'Envoi…' : 'Envoyer la recommandation'}
          </button>
        </form>
      </div>
    </ProjectsWorkspaceFrame>
  );
}
