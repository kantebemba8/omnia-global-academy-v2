import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowRight, Briefcase, Building2, CalendarDays, Clock3, Compass, Globe2, Home, LockKeyhole,
  MapPin, ShieldCheck, Sparkles, Users,
} from 'lucide-react';
import SubspaceHamburgerLayout from '../SubspaceHamburgerLayout';
import { DashboardLayout } from '../DashboardLayout';
import { StructureLayout } from '../StructureLayout';
import { AdminLayout } from '../AdminLayout';
import {
  getProjectsContext,
  OmniaProject,
  PROJECT_LEVEL_LABELS,
  PROJECT_STATUS_LABELS,
  PROJECT_TYPE_LABELS,
} from '../../lib/projectsApi';

function resolveProjectsWorkspacePath(context: { is_admin: boolean; roles: string[]; organization_id: string | null } | null) {
  if (!context) return '/projects/mes-projets';
  if (context.is_admin || context.roles.includes('super_admin')) return '/admin/projects';
  if (context.roles.includes('professeur')) return '/professeur/projects';
  if (context.roles.includes('structure') || context.organization_id) return '/structure/projects';
  return '/projects/mes-projets';
}

export function ProjectsPublicLayout({ children }: { children: ReactNode }) {
  const [workspacePath, setWorkspacePath] = useState('/projects/mes-projets');

  useEffect(() => {
    let active = true;
    getProjectsContext()
      .then(context => { if (active) setWorkspacePath(resolveProjectsWorkspacePath(context)); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const navItems = [
    { label: 'Accueil Projects', path: '/projects', icon: Home, exact: true },
    { label: 'Explorer les projets', path: '/projects/explorer', icon: Compass },
    { label: 'Mon espace Projects', path: workspacePath, icon: Briefcase },
  ];

  return (
    <SubspaceHamburgerLayout
      title="Omnia Projects"
      navItems={navItems}
      searchPath="/projects/explorer"
      searchParam="q"
      searchPlaceholder="Rechercher un projet, une compétence, une organisation..."
    >
      {children}
    </SubspaceHamburgerLayout>
  );
}

export function ProjectsWorkspaceFrame({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  if (pathname.startsWith('/admin/')) return <AdminLayout>{children}</AdminLayout>;
  if (pathname.startsWith('/structure/')) return <StructureLayout displayName="Omnia Projects">{children}</StructureLayout>;
  if (pathname.startsWith('/professeur/')) return <DashboardLayout role="professeur">{children}</DashboardLayout>;
  return <DashboardLayout role="apprenant">{children}</DashboardLayout>;
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  pending_validation: 'bg-amber-50 text-amber-800',
  changes_requested: 'bg-orange-50 text-orange-800',
  published: 'bg-emerald-50 text-emerald-800',
  selection: 'bg-sky-50 text-sky-800',
  in_progress: 'bg-indigo-50 text-indigo-800',
  suspended: 'bg-red-50 text-red-800',
  closed: 'bg-slate-100 text-slate-600',
  archived: 'bg-slate-100 text-slate-500',
  rejected: 'bg-red-50 text-red-700',
};

export function ProjectStatusBadge({ status }: { status: OmniaProject['status'] }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[status] || STATUS_STYLES.draft}`}>
      {PROJECT_STATUS_LABELS[status] || status}
    </span>
  );
}

export function ProjectTypeBadge({ type }: { type: OmniaProject['project_type'] }) {
  return (
    <span className="inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold" style={{ borderColor: '#E7D4A1', color: '#7B570A', background: '#FFFBF0' }}>
      {PROJECT_TYPE_LABELS[type] || type}
    </span>
  );
}

export function ProjectCard({ project, showStatus = false }: { project: OmniaProject; showStatus?: boolean }) {
  const deadline = project.application_closes_at ? new Date(project.application_closes_at) : null;
  const deadlineLabel = deadline && !Number.isNaN(deadline.getTime())
    ? deadline.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Date flexible';

  return (
    <article className="group flex h-full flex-col border bg-white transition-transform duration-200 hover:-translate-y-0.5" style={{ borderColor: '#E4E7EC', borderRadius: 18 }}>
      <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg, #002050, #BF8813)' }} />
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <ProjectTypeBadge type={project.project_type} />
          {showStatus && <ProjectStatusBadge status={project.status} />}
          {project.confidentiality_level !== 'public' && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500"><LockKeyhole size={13} /> Accès contrôlé</span>
          )}
        </div>

        <h2 className="mt-4 text-xl font-bold leading-snug" style={{ color: '#002050' }}>{project.title}</h2>
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
          {project.short_description || project.description}
        </p>

        <div className="mt-5 space-y-2 text-sm text-slate-600">
          <div className="flex items-center gap-2"><Building2 size={15} style={{ color: '#BF8813' }} /> {project.organization_name || 'Omnia Global Academy'}</div>
          <div className="flex items-center gap-2"><MapPin size={15} style={{ color: '#BF8813' }} /> {[project.city, project.country_code].filter(Boolean).join(', ') || 'À distance / zone définie'}</div>
          <div className="flex items-center gap-2"><CalendarDays size={15} style={{ color: '#BF8813' }} /> Candidatures jusqu’au {deadlineLabel}</div>
          <div className="flex items-center gap-2"><Users size={15} style={{ color: '#BF8813' }} /> {project.participation_mode === 'individual' ? 'Participation individuelle' : project.participation_mode === 'team' ? 'Participation en équipe' : 'Individuel ou équipe'}</div>
        </div>

        {!!project.required_skills?.length && (
          <div className="mt-5 flex flex-wrap gap-2">
            {project.required_skills.slice(0, 4).map(skill => (
              <span key={skill} className="rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600">{skill}</span>
            ))}
            {project.required_skills.length > 4 && <span className="px-1 py-1 text-xs text-slate-500">+{project.required_skills.length - 4}</span>}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between border-t pt-5" style={{ borderColor: '#EEF0F3' }}>
          <div className="text-xs text-slate-500">
            <span className="font-semibold text-slate-700">{PROJECT_LEVEL_LABELS[project.level]}</span>
            {project.estimated_hours ? ` · ${project.estimated_hours} h estimées` : ''}
          </div>
          <Link to={`/projects/${project.slug}`} className="inline-flex items-center gap-1.5 text-sm font-bold" style={{ color: '#002050' }}>
            Voir le projet <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}

export function ProjectsHero({ compact = false }: { compact?: boolean }) {
  const [workspacePath, setWorkspacePath] = useState('/projects/mes-projets');

  useEffect(() => {
    let active = true;
    getProjectsContext()
      .then(context => { if (active) setWorkspacePath(resolveProjectsWorkspacePath(context)); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  return (
    <section className={compact ? 'border-b bg-white px-5 py-10 sm:px-8' : 'border-b bg-white px-5 py-10 sm:px-8 md:py-14'} style={{ borderColor: '#E4E7EC' }}>
      <div className="mx-auto max-w-6xl">
        <div className="max-w-4xl">
          <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: 'rgba(191,136,19,.12)', color: '#BF8813' }}>
            <Sparkles size={14} /> Expérience vérifiable
          </span>
          <h1 className={`${compact ? 'mt-4 text-3xl md:text-4xl' : 'mt-5 text-3xl md:text-4xl'} font-semibold leading-tight`} style={{ color: '#002050' }}>
            Transformez vos compétences en preuves d’expérience.
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-gray-600">
            Réalisez des projets réels, relevez des défis et collaborez avec des Structures, entreprises et institutions dans un cadre sécurisé.
          </p>
          {!compact && (
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/projects/explorer" className="inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold text-white" style={{ background: '#002050' }}>
                Explorer les projets <ArrowRight size={17} />
              </Link>
              <Link to={workspacePath} className="inline-flex items-center gap-2 rounded-lg border px-5 py-3 text-sm font-semibold" style={{ borderColor: '#BF8813', color: '#002050' }}>
                Mon espace Projects
              </Link>
            </div>
          )}
        </div>
        <div className="mt-10 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-white p-4" style={{ borderColor: '#E4E7EC' }}><ShieldCheck size={18} style={{ color: '#BF8813' }} /><p className="mt-2 text-sm font-semibold" style={{ color: '#002050' }}>Confidentialité définie</p></div>
          <div className="rounded-xl border bg-white p-4" style={{ borderColor: '#E4E7EC' }}><Globe2 size={18} style={{ color: '#BF8813' }} /><p className="mt-2 text-sm font-semibold" style={{ color: '#002050' }}>Partenaires multi-pays</p></div>
          <div className="rounded-xl border bg-white p-4" style={{ borderColor: '#E4E7EC' }}><Clock3 size={18} style={{ color: '#BF8813' }} /><p className="mt-2 text-sm font-semibold" style={{ color: '#002050' }}>Missions courtes ou longues</p></div>
        </div>
      </div>
    </section>
  );
}
