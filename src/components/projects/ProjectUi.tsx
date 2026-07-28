import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowRight, Building2, CalendarDays, Clock3, Globe2, LockKeyhole,
  MapPin, ShieldCheck, Sparkles, Users,
} from 'lucide-react';
import { Navbar } from '../Navbar';
import { DashboardLayout } from '../DashboardLayout';
import { StructureLayout } from '../StructureLayout';
import { AdminLayout } from '../AdminLayout';
import {
  OmniaProject,
  PROJECT_LEVEL_LABELS,
  PROJECT_STATUS_LABELS,
  PROJECT_TYPE_LABELS,
} from '../../lib/projectsApi';

export function ProjectsPublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="pt-16">{children}</main>
    </div>
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
  return (
    <section className={compact ? 'px-5 py-10 sm:px-8' : 'px-5 py-16 sm:px-8 lg:py-20'} style={{ background: 'linear-gradient(135deg, #00183E 0%, #002A67 64%, #173E75 100%)' }}>
      <div className="mx-auto max-w-6xl">
        <div className="flex max-w-3xl items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: '#E8C76E' }}>
          <Sparkles size={17} /> Expérience vérifiable
        </div>
        <h1 className={`${compact ? 'mt-3 text-3xl sm:text-4xl' : 'mt-4 text-4xl sm:text-5xl lg:text-6xl'} max-w-4xl font-bold leading-tight text-white`}>
          Transformez vos compétences en preuves d’expérience.
        </h1>
        <p className="mt-5 max-w-3xl text-base leading-7 text-blue-100 sm:text-lg">
          Réalisez des projets réels, relevez des challenges et collaborez avec des Structures, entreprises et institutions dans un cadre sécurisé.
        </p>
        {!compact && (
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/projects/explorer" className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold" style={{ background: '#BF8813', color: '#FFFFFF' }}>
              Explorer les projets <ArrowRight size={17} />
            </Link>
            <Link to="/projects/mes-projets" className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-bold text-white">
              Mon espace Projects
            </Link>
          </div>
        )}
        <div className="mt-8 grid max-w-3xl grid-cols-1 gap-3 text-sm text-blue-50 sm:grid-cols-3">
          <div className="flex items-center gap-2"><ShieldCheck size={18} style={{ color: '#E8C76E' }} /> Confidentialité définie</div>
          <div className="flex items-center gap-2"><Globe2 size={18} style={{ color: '#E8C76E' }} /> Partenaires multi-pays</div>
          <div className="flex items-center gap-2"><Clock3 size={18} style={{ color: '#E8C76E' }} /> Missions courtes ou longues</div>
        </div>
      </div>
    </section>
  );
}
