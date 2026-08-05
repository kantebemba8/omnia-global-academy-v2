import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowRight, Briefcase, Building2, Filter, Search, ShieldCheck, Target, Users } from 'lucide-react';
import {
  getProjectsContext,
  listProjects,
  OmniaProject,
  PROJECT_TYPE_LABELS,
  ProjectContext,
  ProjectType,
} from '../../lib/projectsApi';
import { ProjectCard, ProjectsHero, ProjectsPublicLayout } from '../../components/projects/ProjectUi';

const TYPES = Object.entries(PROJECT_TYPE_LABELS) as Array<[ProjectType, string]>;

export default function ProjectsHome() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const explorer = location.pathname.endsWith('/explorer');
  const headerQuery = searchParams.get('q') || '';
  const [projects, setProjects] = useState<OmniaProject[]>([]);
  const [context, setContext] = useState<ProjectContext | null>(null);
  const [query, setQuery] = useState(() => headerQuery);
  const [type, setType] = useState('');
  const [level, setLevel] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);

  const load = async (filters: Record<string, unknown> = {}) => {
    setLoading(true);
    setError('');
    try {
      const result = await listProjects({ page_size: explorer ? 30 : 6, ...filters });
      setProjects(result.projects);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger les projets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setQuery(headerQuery);
    load(headerQuery ? { q: headerQuery } : {});
    getProjectsContext().then(setContext).catch(() => setContext(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [explorer, headerQuery]);

  const title = useMemo(() => explorer ? 'Explorer les projets et défis' : 'Opportunités récemment publiées', [explorer]);

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    load({ q: query, project_type: type || undefined, level: level || undefined });
  };

  return (
    <ProjectsPublicLayout>
      {!explorer && <ProjectsHero />}

      {!explorer && (
        <section className="border-b bg-white px-5 py-12 sm:px-8" style={{ borderColor: '#E4E7EC' }}>
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.16em]" style={{ color: '#BF8813' }}>Plus qu’une offre</p>
              <h2 className="mt-3 text-3xl font-bold leading-tight" style={{ color: '#002050' }}>Produire, collaborer et démontrer ce que vous savez faire.</h2>
              <p className="mt-4 max-w-2xl leading-7 text-slate-600">
                Omnia Projects est réservé aux expériences réelles. Les offres d’emploi restent dans Omnia Communauté et la préparation des candidatures dans Omnia Career.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              <div className="flex gap-3 border-l-2 pl-4" style={{ borderColor: '#BF8813' }}><Target className="mt-0.5 shrink-0" size={20} style={{ color: '#002050' }} /><div><strong className="text-sm text-slate-900">Mission concrète</strong><p className="mt-1 text-sm text-slate-600">Objectifs, jalons et livrables clairement définis.</p></div></div>
              <div className="flex gap-3 border-l-2 pl-4" style={{ borderColor: '#BF8813' }}><Users className="mt-0.5 shrink-0" size={20} style={{ color: '#002050' }} /><div><strong className="text-sm text-slate-900">Consentement des équipes</strong><p className="mt-1 text-sm text-slate-600">Personne n’est ajouté à une équipe sans accord.</p></div></div>
              <div className="flex gap-3 border-l-2 pl-4" style={{ borderColor: '#BF8813' }}><ShieldCheck className="mt-0.5 shrink-0" size={20} style={{ color: '#002050' }} /><div><strong className="text-sm text-slate-900">Preuves contrôlées</strong><p className="mt-1 text-sm text-slate-600">Aucun livrable confidentiel n’est publié automatiquement.</p></div></div>
            </div>
          </div>
        </section>
      )}

      <section className="bg-slate-50 px-5 py-12 sm:px-8 lg:py-16">
        <div className="mx-auto max-w-6xl">
          {explorer && (
            <div className="mb-8 max-w-3xl">
              <p className="text-sm font-bold uppercase tracking-[0.16em]" style={{ color: '#BF8813' }}>Catalogue des projets</p>
              <h1 className="mt-2 text-3xl font-bold sm:text-4xl" style={{ color: '#002050' }}>Explorez les projets disponibles</h1>
              <p className="mt-3 leading-7 text-slate-600">Recherchez une mission selon vos compétences, le format du projet et le niveau demandé.</p>
            </div>
          )}
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.16em]" style={{ color: '#BF8813' }}>{total} opportunité{total > 1 ? 's' : ''}</p>
              <h2 className="mt-2 text-3xl font-bold" style={{ color: '#002050' }}>{title}</h2>
            </div>
            {context?.can_create && (
              <Link to={context.is_admin ? '/admin/projects/gestion' : context.roles.includes('professeur') ? '/professeur/projects' : context.organization_id ? '/structure/projects' : '/projects/gestion'} className="inline-flex items-center gap-2 self-start rounded-xl px-4 py-2.5 text-sm font-bold text-white" style={{ background: '#002050' }}>
                <Building2 size={17} /> Proposer un projet
              </Link>
            )}
          </div>

          <form onSubmit={handleSearch} className="mt-8 grid gap-3 border bg-white p-4 sm:grid-cols-2 lg:grid-cols-[1fr_220px_180px_auto]" style={{ borderColor: '#E4E7EC', borderRadius: 16 }}>
            <label className="relative">
              <Search size={18} className="absolute left-3 top-3 text-slate-400" />
              <input value={query} onChange={event => setQuery(event.target.value)} className="w-full rounded-xl border py-2.5 pl-10 pr-3 text-sm outline-none focus:ring-2" style={{ borderColor: '#D0D5DD' }} placeholder="Compétence, mission, partenaire..." />
            </label>
            <select value={type} onChange={event => setType(event.target.value)} className="rounded-xl border px-3 py-2.5 text-sm outline-none" style={{ borderColor: '#D0D5DD' }}>
              <option value="">Tous les formats</option>
              {TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select value={level} onChange={event => setLevel(event.target.value)} className="rounded-xl border px-3 py-2.5 text-sm outline-none" style={{ borderColor: '#D0D5DD' }}>
              <option value="">Tous niveaux</option>
              <option value="beginner">Débutant</option>
              <option value="intermediate">Intermédiaire</option>
              <option value="advanced">Avancé</option>
              <option value="expert">Expert</option>
              <option value="all">Ouvert à tous</option>
            </select>
            <button className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white" style={{ background: '#BF8813' }}><Filter size={17} /> Filtrer</button>
          </form>

          {error && <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          {loading ? (
            <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-80 animate-pulse rounded-[18px] bg-white" />)}
            </div>
          ) : projects.length ? (
            <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {projects.map(project => <ProjectCard key={project.id} project={project} />)}
            </div>
          ) : (
            <div className="mt-8 border bg-white px-6 py-14 text-center" style={{ borderColor: '#E4E7EC', borderRadius: 18 }}>
              <Briefcase className="mx-auto" size={34} style={{ color: '#BF8813' }} />
              <h3 className="mt-4 text-xl font-bold" style={{ color: '#002050' }}>Aucun projet ne correspond à ces critères</h3>
              <p className="mt-2 text-sm text-slate-600">Modifiez les filtres ou revenez prochainement.</p>
            </div>
          )}

          {!explorer && total > 6 && (
            <div className="mt-9 text-center">
              <Link to="/projects/explorer" className="inline-flex items-center gap-2 rounded-xl border bg-white px-5 py-3 text-sm font-bold" style={{ borderColor: '#002050', color: '#002050' }}>
                Voir toutes les opportunités <ArrowRight size={17} />
              </Link>
            </div>
          )}
        </div>
      </section>
    </ProjectsPublicLayout>
  );
}
