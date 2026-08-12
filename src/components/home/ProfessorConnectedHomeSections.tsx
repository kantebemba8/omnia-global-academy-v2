import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Briefcase,
  CheckCircle2,
  ClipboardCheck,
  FolderKanban,
  GraduationCap,
  Heart,
  MessageSquare,
  Plus,
  Radio,
  Star,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { getOwnerProjects, type OmniaProject } from '../../lib/projectsApi';

export type ProfessorConnectedHomeData = {
  user?: { full_name?: string; email?: string };
  kpis?: {
    solde_retirable_xof?: number;
    gains_cumules_xof?: number;
    total_eleves?: number;
    note_globale?: number;
  };
  formations?: Array<{
    id: string;
    title: string;
    status: string;
    score_calcule?: number;
    cover_image_url?: string | null;
    total_students?: number;
    average_rating?: number;
    admin_comment?: string | null;
    rejection_reason?: string | null;
    projets_a_corriger?: number;
    created_at?: string;
  }>;
  forum_questions_unanswered?: number;
};

type Props = { data: ProfessorConnectedHomeData | null; previewMode: boolean };
type ProfessorFormation = NonNullable<ProfessorConnectedHomeData['formations']>[number];
type SpaceItem = { label: string; caption: string; path: string; accent: string; soft: string; icon: LucideIcon; signal?: string };

const INDIGO = '#4657C8';
const GOLD = '#BF8813';
const BLUE = '#002050';

const STATUS: Record<string, { label: string; accent: string; soft: string }> = {
  draft: { label: 'Brouillon', accent: '#64748B', soft: '#F1F5F9' }, brouillon: { label: 'Brouillon', accent: '#64748B', soft: '#F1F5F9' },
  pending_validation: { label: 'En vérification', accent: '#B7791F', soft: '#FFF7E6' }, soumise: { label: 'En vérification', accent: '#B7791F', soft: '#FFF7E6' }, en_attente_validation_manuelle: { label: 'En vérification', accent: '#B7791F', soft: '#FFF7E6' },
  validated: { label: 'Validée', accent: '#17845B', soft: '#EAF8F2' }, validee: { label: 'Validée', accent: '#17845B', soft: '#EAF8F2' }, published: { label: 'Publiée', accent: '#176B5B', soft: '#EAF6F2' }, publiee: { label: 'Publiée', accent: '#176B5B', soft: '#EAF6F2' },
  rejected: { label: 'Rejetée', accent: '#C24141', soft: '#FFF0F0' }, rejetee: { label: 'Rejetée', accent: '#C24141', soft: '#FFF0F0' }, changes_requested: { label: 'À modifier', accent: '#C45B24', soft: '#FFF2E8' }, modification_demandee: { label: 'À modifier', accent: '#C45B24', soft: '#FFF2E8' },
  archived: { label: 'Archivée', accent: '#64748B', soft: '#F1F5F9' }, suspendue: { label: 'Archivée', accent: '#64748B', soft: '#F1F5F9' },
};

function withPreview(path: string, previewMode: boolean) {
  if (!previewMode) return path;
  const [base, hash = ''] = path.split('#', 2);
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}preview=true${hash ? `#${hash}` : ''}`;
}
function statusOf(status: string) { return STATUS[status] || { label: status || 'Formation', accent: '#64748B', soft: '#F1F5F9' }; }
function courseActionPath(course: ProfessorFormation) {
  if (['draft', 'brouillon', 'rejected', 'rejetee', 'changes_requested', 'modification_demandee'].includes(course.status)) return `/professeur/courses/${course.id}/edit`;
  if (['published', 'publiee'].includes(course.status)) return '/professeur/analytics';
  return '/professeur/courses';
}

function useProfessorProjects(previewMode: boolean) {
  const [projects, setProjects] = useState<OmniaProject[]>([]);
  useEffect(() => {
    if (previewMode) { setProjects([]); return; }
    let active = true;
    getOwnerProjects('personal').then(result => { if (active) setProjects(result.projects || []); }).catch(() => { if (active) setProjects([]); });
    return () => { active = false; };
  }, [previewMode]);
  return projects;
}

function StudioHero({ data, previewMode, projects }: Props & { projects: OmniaProject[] }) {
  const formations = data?.formations || [];
  const changes = formations.filter(item => ['changes_requested', 'modification_demandee', 'rejected', 'rejetee'].includes(item.status));
  const drafts = formations.filter(item => ['draft', 'brouillon'].includes(item.status));
  const reviewCount = formations.reduce((sum, item) => sum + Number(item.projets_a_corriger || 0), 0);
  const focus = changes[0] || drafts[0] || formations[0];
  const state = focus ? statusOf(focus.status) : null;
  const actionPath = changes[0] || drafts[0] ? `/professeur/courses/${focus?.id}/edit` : reviewCount ? '/professeur/courses' : focus ? courseActionPath(focus) : '/professeur/courses/new';
  const actionLabel = changes[0] ? 'Corriger la formation' : reviewCount ? 'Examiner les travaux' : drafts[0] ? 'Continuer le brouillon' : focus ? 'Ouvrir la formation' : 'Créer une formation';

  return (
    <section className="border-b border-[#DDE1F0] bg-[#F8F8FD]">
      <div className="mx-auto grid min-h-[490px] max-w-7xl gap-10 px-5 py-14 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-8 lg:py-16">
        <div>
          <div className="inline-flex items-center gap-2 border-l-4 border-[#4657C8] pl-3 text-xs font-black uppercase tracking-[0.17em] text-[#4657C8]">Studio pédagogique</div>
          <h1 className="mt-5 max-w-[700px] text-4xl font-black leading-[1.02] tracking-[-0.048em] text-[#002050] sm:text-5xl lg:text-[3.6rem]">Concevoir, publier et suivre depuis un véritable atelier pédagogique.</h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">Créez, corrigez et améliorez vos formations en gardant sous les yeux les apprenants, les travaux et les échanges qui demandent votre attention.</p>
          <div className="mt-8 flex flex-wrap gap-3"><Link to={withPreview('/professeur/courses/new', previewMode)} className="inline-flex items-center gap-2 rounded-xl bg-[#002050] px-5 py-3 text-sm font-black text-white"><Plus size={16} />Nouvelle formation</Link><Link to={withPreview('/professeur/courses', previewMode)} className="inline-flex items-center gap-2 rounded-xl border border-[#CBD2E8] bg-white px-5 py-3 text-sm font-black text-[#002050]">Mes formations<ArrowRight size={16} /></Link></div>
        </div>

        <div className="relative mx-auto w-full max-w-[560px]">
          <div className="absolute -left-5 top-8 h-[88%] w-[94%] rotate-[-2.5deg] rounded-[24px] border border-[#D9DDF0] bg-[#EDEFFD]" aria-hidden="true" />
          <div className="relative overflow-hidden rounded-[24px] border border-[#CCD2E7] bg-white shadow-[0_28px_70px_rgba(0,32,80,.12)]">
            <div className="flex items-center justify-between border-b border-[#E6E8F2] bg-[#071C3A] px-5 py-4 text-white"><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#BF8813]" /><span className="text-[11px] font-black uppercase tracking-[0.14em] text-white/60">Plan de travail</span></div><span className="text-[11px] font-bold text-white/45">{previewMode ? 'Aperçu Professeur' : `${formations.length} formation${formations.length > 1 ? 's' : ''}`}</span></div>
            <div className="grid min-h-[290px] md:grid-cols-[118px_1fr]">
              <div className="border-b border-[#E8EAF3] bg-[#F3F4FB] p-3 md:border-b-0 md:border-r"><div className="space-y-2">{['Plan', 'Contenu', 'Évaluer', 'Publier'].map((item, index) => <div key={item} className={`rounded-lg px-3 py-2 text-[11px] font-black ${index === 0 ? 'bg-white text-[#4657C8] shadow-sm' : 'text-slate-400'}`}>{item}</div>)}</div></div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#4657C8]">Priorité pédagogique</p><h2 className="mt-2 text-xl font-black tracking-[-0.02em] text-[#002050]">{previewMode ? 'Votre contenu prioritaire' : focus?.title || (reviewCount ? `${reviewCount} travaux à examiner` : 'Votre prochaine formation')}</h2></div>{state && !previewMode && <span className="rounded-full px-3 py-1 text-[10px] font-black" style={{ background: state.soft, color: state.accent }}>{state.label}</span>}</div>
                <div className="mt-6 space-y-3">{[0, 1, 2].map(index => <div key={index} className="flex items-center gap-3"><span className={`h-8 w-8 rounded-lg ${index === 0 ? 'bg-[#EEF0FF]' : 'bg-slate-100'}`} /><span className={`h-2 rounded-full ${index === 0 ? 'w-[72%] bg-[#B7C0F6]' : index === 1 ? 'w-[56%] bg-slate-200' : 'w-[64%] bg-slate-200'}`} /></div>)}</div>
                <Link to={withPreview(actionPath, previewMode)} className="group mt-7 flex items-center justify-between border-t border-[#E8EAF3] pt-5 text-sm font-black text-[#4657C8]"><span>{previewMode ? 'Voir l’espace Professeur' : actionLabel}</span><ArrowRight size={15} className="transition group-hover:translate-x-1" /></Link>
                {!previewMode && projects.length > 0 && <p className="mt-3 text-[11px] font-bold text-slate-400">{projects.length} projet{projects.length > 1 ? 's' : ''} porté{projects.length > 1 ? 's' : ''} dans Omnia Projects</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProfessorSpaces({ data, previewMode, projects }: Props & { projects: OmniaProject[] }) {
  const formations = data?.formations || [];
  const unanswered = Number(data?.forum_questions_unanswered || 0);
  const spaces: SpaceItem[] = [
    { label: 'Formations', caption: 'Créer, publier et faire évoluer vos cours', path: '/formations', accent: '#4657C8', soft: '#EEF0FF', icon: BookOpen, signal: formations.length ? `${formations.length} contenu${formations.length > 1 ? 's' : ''}` : undefined },
    { label: 'Omnia Career', caption: 'Documents, trajectoires et outils carrière', path: '/career-studio', accent: '#BF8813', soft: '#FBF5E9', icon: Briefcase },
    { label: 'Omnia Projects', caption: 'Projets et expériences liés à votre expertise', path: '/projects', accent: '#A56B12', soft: '#FFF7E6', icon: FolderKanban, signal: projects.length ? `${projects.length} projet${projects.length > 1 ? 's' : ''}` : undefined },
    { label: 'Omnia Talent', caption: 'Votre présence dans l’écosystème professionnel', path: '/talent', accent: '#7650C5', soft: '#F4F0FF', icon: UsersRound },
    { label: 'Omnia Live', caption: 'Événements et expériences en direct', path: '/omnia-live', accent: '#5A55C9', soft: '#F0F0FF', icon: Radio },
    { label: 'Communauté', caption: 'Répondre, partager et échanger', path: '/forum', accent: '#0F766E', soft: '#EAF8F6', icon: MessageSquare, signal: unanswered ? `${unanswered} question${unanswered > 1 ? 's' : ''}` : undefined },
    { label: 'Coaching', caption: 'Accompagnement et progression professionnelle', path: '/coaching', accent: '#356C63', soft: '#EAF3F0', icon: Heart },
  ];
  return <section className="border-b border-slate-200 bg-white"><div className="mx-auto max-w-7xl px-5 py-9 sm:px-6 lg:px-8"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#4657C8]">Vos espaces Omnia</p><h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#002050]">Passer du studio à l’écosystème utile.</h2></div><div className="mt-6 flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{spaces.map(item => { const Icon = item.icon; return <Link key={item.path} to={withPreview(item.path, previewMode)} className="group min-w-[215px] flex-1 rounded-[18px] border border-slate-200 bg-white p-4 transition hover:border-[#BFC6E6] hover:bg-[#FBFBFE]"><div className="flex items-start justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ color: item.accent, background: item.soft }}><Icon size={18} /></span>{item.signal && !previewMode && <span className="text-[10px] font-black text-slate-400">{item.signal}</span>}</div><strong className="mt-4 block text-sm font-black text-[#002050]">{item.label}</strong><span className="mt-1 block text-xs leading-5 text-slate-500">{item.caption}</span><ArrowRight size={14} className="mt-3 text-slate-300 transition group-hover:translate-x-1" /></Link>; })}</div></div></section>;
}

function ProfessorWorkspace({ data, previewMode, projects }: Props & { projects: OmniaProject[] }) {
  const formations = data?.formations || [];
  const published = formations.filter(item => ['published', 'publiee'].includes(item.status)).length;
  const revisions = formations.filter(item => ['changes_requested', 'modification_demandee', 'rejected', 'rejetee'].includes(item.status));
  const drafts = formations.filter(item => ['draft', 'brouillon'].includes(item.status));
  const projectsToReview = formations.reduce((sum, item) => sum + Number(item.projets_a_corriger || 0), 0);
  const unanswered = Number(data?.forum_questions_unanswered || 0);
  const students = Number(data?.kpis?.total_eleves || 0);
  const rating = Number(data?.kpis?.note_globale || 0);

  const qualityActions = useMemo(() => {
    const rows: Array<{ title: string; text: string; path: string; icon: LucideIcon; accent: string }> = [];
    if (revisions.length) rows.push({ title: 'Reprendre les formations retournées', text: `${revisions.length} formation${revisions.length > 1 ? 's nécessitent' : ' nécessite'} une correction avant la suite.`, path: '/professeur/courses', icon: AlertCircle, accent: '#C45B24' });
    if (projectsToReview) rows.push({ title: 'Fermer la boucle d’évaluation', text: `${projectsToReview} travail${projectsToReview > 1 ? 'x attendent' : ' attend'} votre lecture.`, path: '/professeur/courses', icon: ClipboardCheck, accent: '#B23A48' });
    if (unanswered) rows.push({ title: 'Répondre aux questions de la communauté', text: `${unanswered} question${unanswered > 1 ? 's restent' : ' reste'} sans réponse.`, path: '/forum', icon: MessageSquare, accent: '#0F766E' });
    if (published && rating > 0) rows.push({ title: 'Lire vos signaux de qualité', text: `Votre note globale est de ${rating}/5. Utilisez l’analytique pour voir ce qui fonctionne.`, path: '/professeur/analytics', icon: BarChart3, accent: '#4657C8' });
    if (drafts.length) rows.push({ title: 'Finaliser avant de multiplier les brouillons', text: `${drafts.length} brouillon${drafts.length > 1 ? 's sont' : ' est'} encore en préparation.`, path: '/professeur/courses', icon: BookOpen, accent: '#64748B' });
    if (!rows.length) rows.push({ title: 'Préparer votre prochaine séquence', text: 'Aucune urgence détectée : vous pouvez enrichir vos formations ou préparer une nouvelle création.', path: '/professeur/courses/new', icon: Plus, accent: GOLD });
    return rows.slice(0, 4);
  }, [revisions.length, projectsToReview, unanswered, published, rating, drafts.length]);

  const activeProjects = projects.filter(project => ['published', 'selection', 'in_progress'].includes(project.status));
  return <section className="bg-[#F7F8FC]"><div className="mx-auto max-w-7xl px-5 py-14 sm:px-6 lg:px-8"><div className="grid gap-9 xl:grid-cols-[1.2fr_0.8fr]">
    <div><div className="flex flex-wrap items-end justify-between gap-5 border-b border-slate-200 pb-6"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#4657C8]">Production pédagogique</p><h2 className="mt-2 text-3xl font-black tracking-[-0.035em] text-[#002050]">Vos contenus et leur impact.</h2></div><div className="flex gap-5 text-right"><div><span className="block text-2xl font-black text-[#002050]">{previewMode ? '—' : published}</span><span className="text-[11px] font-bold text-slate-400">publiées</span></div><div><span className="block text-2xl font-black text-[#002050]">{previewMode ? '—' : students}</span><span className="text-[11px] font-bold text-slate-400">apprenants</span></div><div><span className="block text-2xl font-black text-[#002050]">{previewMode ? '—' : projectsToReview}</span><span className="text-[11px] font-bold text-slate-400">à examiner</span></div></div></div>
      <div className="mt-5 border-y border-slate-200 bg-white px-5 sm:px-6">{previewMode ? <div className="py-10 text-sm text-slate-500">Les contenus personnels sont masqués pendant la prévisualisation.</div> : formations.length ? formations.slice(0, 5).map((course, index) => { const state = statusOf(course.status); return <Link key={course.id} to={courseActionPath(course)} className={`group flex items-center gap-4 py-4 ${index ? 'border-t border-slate-100' : ''}`}><span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#EEF0FF] text-[#4657C8]">{course.cover_image_url ? <img src={course.cover_image_url} alt="" className="h-full w-full object-cover" /> : <BookOpen size={18} />}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm font-black text-[#002050]">{course.title}</strong><span className="mt-1 block text-xs text-slate-500">{course.total_students || 0} apprenant{Number(course.total_students || 0) > 1 ? 's' : ''}</span></span><span className="rounded-full px-3 py-1 text-[10px] font-black" style={{ background: state.soft, color: state.accent }}>{state.label}</span><ArrowRight size={14} className="text-slate-300 transition group-hover:translate-x-1" /></Link>; }) : <div className="flex items-center justify-between gap-4 py-9"><div><strong className="text-sm font-black text-[#002050]">Votre studio est vide</strong><p className="mt-1 text-xs text-slate-500">Une première formation apparaîtra ici dès sa création.</p></div><Link to="/professeur/courses/new" className="text-sm font-black text-[#4657C8]">Créer</Link></div>}</div>
      {activeProjects.length > 0 && !previewMode && <div className="mt-8"><div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-[#A56B12]">Omnia Projects</p><h3 className="mt-1 text-lg font-black text-[#002050]">Projets liés à votre expertise</h3></div><Link to="/professeur/projects" className="text-xs font-black text-[#A56B12]">Tout voir</Link></div><div className="mt-3 grid gap-3 md:grid-cols-2">{activeProjects.slice(0, 2).map(project => <Link key={project.id} to="/professeur/projects" className="rounded-[18px] border border-[#E9DFC9] bg-[#FFF9EE] p-4"><strong className="block text-sm font-black text-[#002050]">{project.title}</strong><p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{project.short_description || project.description}</p></Link>)}</div></div>}
    </div>
    <aside><div className="rounded-[24px] bg-[#071C3A] p-6 text-white"><p className="text-xs font-black uppercase tracking-[0.16em] text-[#AEB8FF]">Qualité pédagogique</p><h3 className="mt-2 text-2xl font-black tracking-[-0.03em]">Les leviers qui changent avec vos contenus.</h3><div className="mt-5 divide-y divide-white/10">{qualityActions.map(item => { const Icon = item.icon; return <Link key={`${item.path}-${item.title}`} to={withPreview(item.path, previewMode)} className="group flex gap-3 py-4"><span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10" style={{ color: item.accent }}><Icon size={17} /></span><span className="min-w-0 flex-1"><strong className="block text-sm font-black">{previewMode ? 'Action personnalisée' : item.title}</strong><span className="mt-1 block text-xs leading-5 text-white/50">{previewMode ? 'Cette action dépendra de la production réelle du professeur.' : item.text}</span></span><ArrowRight size={14} className="mt-2 text-white/25 transition group-hover:translate-x-1" /></Link>; })}</div></div>
      <div className="mt-5 rounded-[20px] border border-slate-200 bg-white p-5"><div className="flex items-center justify-between"><span className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Signal global</span><Star size={16} className="text-[#BF8813]" /></div><div className="mt-4 flex items-end gap-2"><span className="text-3xl font-black text-[#002050]">{previewMode || !rating ? '—' : rating.toFixed(1)}</span>{!previewMode && rating > 0 && <span className="pb-1 text-xs font-bold text-slate-400">/ 5</span>}</div><p className="mt-2 text-xs leading-5 text-slate-500">La note n’apparaît que lorsqu’une donnée réelle existe.</p></div>
    </aside>
  </div></div></section>;
}

export default function ProfessorConnectedHomeSections(props: Props) {
  const projects = useProfessorProjects(props.previewMode);
  return <><StudioHero {...props} projects={projects} /><ProfessorSpaces {...props} projects={projects} /><ProfessorWorkspace {...props} projects={projects} /></>;
}
