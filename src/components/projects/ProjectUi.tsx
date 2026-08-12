import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Building2, CalendarDays, Clock3, LockKeyhole, MapPin, ShieldCheck, Users } from 'lucide-react';
import { AdminLayout } from '../AdminLayout';
import { AdaptiveProjectsLayout, ProjectsAudienceLayout } from './ProjectsRoleLayout';
import { OmniaProject, PROJECT_LEVEL_LABELS, PROJECT_STATUS_LABELS, PROJECT_TYPE_LABELS } from '../../lib/projectsApi';

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700', pending_validation: 'bg-amber-50 text-amber-800', changes_requested: 'bg-orange-50 text-orange-800', published: 'bg-emerald-50 text-emerald-800', selection: 'bg-sky-50 text-sky-800', in_progress: 'bg-indigo-50 text-indigo-800', suspended: 'bg-red-50 text-red-800', closed: 'bg-slate-100 text-slate-600', archived: 'bg-slate-100 text-slate-500', rejected: 'bg-red-50 text-red-700',
};

export function ProjectsPublicLayout({ children }: { children: ReactNode }) { return <AdaptiveProjectsLayout>{children}</AdaptiveProjectsLayout>; }

export function ProjectsWorkspaceFrame({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  if (pathname.startsWith('/admin/')) return <AdminLayout>{children}</AdminLayout>;
  if (pathname.startsWith('/structure/')) return <ProjectsAudienceLayout audience="structure">{children}</ProjectsAudienceLayout>;
  if (pathname.startsWith('/professeur/')) return <ProjectsAudienceLayout audience="professeur">{children}</ProjectsAudienceLayout>;
  return <ProjectsAudienceLayout audience="apprenant">{children}</ProjectsAudienceLayout>;
}

export function ProjectStatusBadge({ status }: { status: OmniaProject['status'] }) { return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[status] || STATUS_STYLES.draft}`}>{PROJECT_STATUS_LABELS[status] || status}</span>; }
export function ProjectTypeBadge({ type }: { type: OmniaProject['project_type'] }) { return <span className="inline-flex rounded-full border border-[#E7D4B8] bg-[#FFF8EE] px-2.5 py-1 text-xs font-semibold text-[#87530F]">{PROJECT_TYPE_LABELS[type] || type}</span>; }

export function ProjectCard({ project, showStatus = false }: { project: OmniaProject; showStatus?: boolean }) {
  const deadline = project.application_closes_at ? new Date(project.application_closes_at) : null;
  const deadlineLabel = deadline && !Number.isNaN(deadline.getTime()) ? deadline.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Date flexible';
  return (
    <article className="group relative flex h-full overflow-hidden rounded-[22px] border border-[#E4DDD2] bg-[#FFFEFB] shadow-[0_12px_35px_rgba(0,32,80,.06)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(0,32,80,.1)]">
      <div className="w-1.5 shrink-0 bg-gradient-to-b from-[#A96812] via-[#BF8813] to-[#0F6070]" />
      <div className="flex min-w-0 flex-1 flex-col p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2"><ProjectTypeBadge type={project.project_type} />{showStatus && <ProjectStatusBadge status={project.status} />}{project.confidentiality_level !== 'public' && <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500"><LockKeyhole size={13} /> Accès contrôlé</span>}</div>
        <h2 className="mt-4 text-xl font-black leading-snug tracking-[-0.02em] text-[#002050]">{project.title}</h2>
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{project.short_description || project.description}</p>
        <div className="mt-5 grid gap-2 text-sm text-slate-600"><div className="flex items-center gap-2"><Building2 size={15} className="text-[#A96812]" /> {project.organization_name || 'Omnia Global Academy'}</div><div className="flex items-center gap-2"><MapPin size={15} className="text-[#A96812]" /> {[project.city, project.country_code].filter(Boolean).join(', ') || 'À distance / zone définie'}</div><div className="flex items-center gap-2"><CalendarDays size={15} className="text-[#A96812]" /> Candidatures jusqu’au {deadlineLabel}</div><div className="flex items-center gap-2"><Users size={15} className="text-[#A96812]" /> {project.participation_mode === 'individual' ? 'Participation individuelle' : project.participation_mode === 'team' ? 'Participation en équipe' : 'Individuel ou équipe'}</div></div>
        {!!project.required_skills?.length && <div className="mt-5 flex flex-wrap gap-2">{project.required_skills.slice(0, 4).map(skill => <span key={skill} className="rounded-lg bg-[#F2F5F6] px-2 py-1 text-xs font-semibold text-slate-600">{skill}</span>)}{project.required_skills.length > 4 && <span className="px-1 py-1 text-xs text-slate-500">+{project.required_skills.length - 4}</span>}</div>}
        <div className="mt-auto flex items-center justify-between border-t border-[#EEE8DE] pt-5"><div className="text-xs text-slate-500"><span className="font-bold text-slate-700">{PROJECT_LEVEL_LABELS[project.level]}</span>{project.estimated_hours ? ` · ${project.estimated_hours} h` : ''}</div><Link to={`/projects/${project.slug}`} className="inline-flex items-center gap-1.5 text-sm font-black text-[#002050]">Ouvrir <ArrowRight size={16} className="transition group-hover:translate-x-0.5" /></Link></div>
      </div>
    </article>
  );
}

export function ProjectTrustStrip() { return <div className="grid gap-3 sm:grid-cols-3"><div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4"><ShieldCheck size={19} className="text-[#E5B55D]" /><div><p className="text-sm font-black text-white">Cadre vérifiable</p><p className="text-xs text-blue-100">Accès, confidentialité et preuve définis.</p></div></div><div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4"><Users size={19} className="text-[#E5B55D]" /><div><p className="text-sm font-black text-white">Collaboration consentie</p><p className="text-xs text-blue-100">Invitations et équipes sous contrôle.</p></div></div><div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4"><Clock3 size={19} className="text-[#E5B55D]" /><div><p className="text-sm font-black text-white">Cycle visible</p><p className="text-xs text-blue-100">Jalons, livrables et décisions suivis.</p></div></div></div>; }
