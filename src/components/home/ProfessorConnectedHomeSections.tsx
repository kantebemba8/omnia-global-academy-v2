import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  FolderKanban,
  GraduationCap,
  MessageSquare,
  Plus,
  Radio,
  Sparkles,
  Star,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';

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

type Props = {
  data: ProfessorConnectedHomeData | null;
  previewMode: boolean;
};

type SpaceItem = {
  label: string;
  caption: string;
  path: string;
  accent: string;
  soft: string;
  icon: LucideIcon;
};

const INDIGO = '#4657C8';
const GOLD = '#BF8813';

const SPACES: SpaceItem[] = [
  { label: 'Formations', caption: 'Créer, publier et faire évoluer vos cours', path: '/professeur/courses', accent: '#4657C8', soft: '#EEF0FF', icon: BookOpen },
  { label: 'Omnia Projects', caption: 'Suivre les projets liés à votre enseignement', path: '/professeur/projects', accent: '#A56B12', soft: '#FFF7E6', icon: FolderKanban },
  { label: 'Omnia Talent', caption: 'Votre présence dans l’écosystème professionnel', path: '/talent', accent: '#7650C5', soft: '#F4F0FF', icon: UsersRound },
  { label: 'Omnia Live', caption: 'Participer aux expériences et événements live', path: '/omnia-live', accent: '#5A55C9', soft: '#F0F0FF', icon: Radio },
  { label: 'Communauté', caption: 'Échanger, répondre et partager avec la communauté', path: '/forum', accent: '#0F766E', soft: '#EAF8F6', icon: MessageSquare },
  { label: 'Catalogue', caption: 'Voir la présentation publique des formations', path: '/catalogue', accent: '#0F7699', soft: '#E9F7FB', icon: GraduationCap },
];

const STATUS: Record<string, { label: string; accent: string; soft: string }> = {
  draft: { label: 'Brouillon', accent: '#64748B', soft: '#F1F5F9' },
  brouillon: { label: 'Brouillon', accent: '#64748B', soft: '#F1F5F9' },
  pending_validation: { label: 'En vérification', accent: '#B7791F', soft: '#FFF7E6' },
  soumise: { label: 'En vérification', accent: '#B7791F', soft: '#FFF7E6' },
  en_attente_validation_manuelle: { label: 'En vérification', accent: '#B7791F', soft: '#FFF7E6' },
  validated: { label: 'Validée', accent: '#17845B', soft: '#EAF8F2' },
  validee: { label: 'Validée', accent: '#17845B', soft: '#EAF8F2' },
  published: { label: 'Publiée', accent: '#176B5B', soft: '#EAF6F2' },
  publiee: { label: 'Publiée', accent: '#176B5B', soft: '#EAF6F2' },
  rejected: { label: 'Rejetée', accent: '#C24141', soft: '#FFF0F0' },
  rejetee: { label: 'Rejetée', accent: '#C24141', soft: '#FFF0F0' },
  changes_requested: { label: 'À modifier', accent: '#C45B24', soft: '#FFF2E8' },
  modification_demandee: { label: 'À modifier', accent: '#C45B24', soft: '#FFF2E8' },
  archived: { label: 'Archivée', accent: '#64748B', soft: '#F1F5F9' },
  suspendue: { label: 'Archivée', accent: '#64748B', soft: '#F1F5F9' },
};

function withPreview(path: string, previewMode: boolean) {
  if (!previewMode) return path;
  const [base, hash = ''] = path.split('#', 2);
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}preview=true${hash ? `#${hash}` : ''}`;
}

function statusOf(status: string) {
  return STATUS[status] || { label: status || 'Formation', accent: '#64748B', soft: '#F1F5F9' };
}

type ProfessorFormation = NonNullable<ProfessorConnectedHomeData['formations']>[number];

function courseActionPath(course: ProfessorFormation) {
  if (['draft', 'brouillon', 'rejected', 'rejetee', 'changes_requested', 'modification_demandee'].includes(course.status)) {
    return `/professeur/courses/${course.id}/edit`;
  }
  if (['published', 'publiee'].includes(course.status)) return '/professeur/analytics';
  return '/professeur/courses';
}

function ProfessorHero({ data, previewMode }: Props) {
  const formations = data?.formations || [];
  const changes = formations.filter(item => ['changes_requested', 'modification_demandee', 'rejected', 'rejetee'].includes(item.status));
  const drafts = formations.filter(item => ['draft', 'brouillon'].includes(item.status));
  const projects = formations.reduce((sum, item) => sum + (item.projets_a_corriger || 0), 0);
  const priority = changes[0] || drafts[0] || formations[0];

  let priorityTitle = 'Votre studio est prêt';
  let priorityText = 'Créez une nouvelle formation ou retrouvez vos contenus existants.';
  let priorityPath = '/professeur/courses/new';
  let priorityLabel = 'Nouvelle formation';

  if (changes[0]) {
    priorityTitle = changes[0].title;
    priorityText = 'Cette formation demande une correction ou une nouvelle soumission.';
    priorityPath = `/professeur/courses/${changes[0].id}/edit`;
    priorityLabel = 'Traiter maintenant';
  } else if (projects > 0) {
    priorityTitle = `${projects} projet${projects > 1 ? 's' : ''} à examiner`;
    priorityText = 'Des travaux liés à vos formations attendent votre intervention.';
    priorityPath = '/professeur/courses';
    priorityLabel = 'Voir les travaux';
  } else if (drafts[0]) {
    priorityTitle = drafts[0].title;
    priorityText = 'Une formation est encore en préparation dans votre studio.';
    priorityPath = `/professeur/courses/${drafts[0].id}/edit`;
    priorityLabel = 'Continuer la rédaction';
  } else if (priority) {
    priorityTitle = priority.title;
    priorityText = `Statut actuel : ${statusOf(priority.status).label}.`;
    priorityPath = courseActionPath(priority);
    priorityLabel = 'Ouvrir la formation';
  }

  return (
    <section className="relative overflow-hidden bg-[#071C3A] text-white">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 opacity-[0.14]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.28) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.20) 1px, transparent 1px)', backgroundSize: '42px 42px' }} />
        <div className="absolute -right-28 top-[-160px] h-[520px] w-[520px] rounded-full border border-white/10" />
        <div className="absolute -right-10 top-[-90px] h-[390px] w-[390px] rounded-full border border-[#6877E4]/45" />
        <div className="absolute bottom-[-260px] right-[12%] h-[520px] w-[520px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(70,87,200,.48), rgba(70,87,200,.08) 45%, transparent 68%)' }} />
        <div className="absolute left-[44%] top-[20%] h-px w-[48%] -rotate-6 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
      </div>

      <div className="relative mx-auto grid min-h-[470px] max-w-7xl gap-10 px-5 py-14 sm:px-6 lg:grid-cols-[1.03fr_0.97fr] lg:items-center lg:px-8 lg:py-16">
        <div className="max-w-3xl">
          <div className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.18em] text-[#AEB8FF]">
            <span className="h-2 w-2 rounded-full bg-[#BF8813]" />
            Studio pédagogique
          </div>
          <h1 className="mt-5 max-w-[760px] text-4xl font-black leading-[1.02] tracking-[-0.045em] sm:text-5xl lg:text-[3.55rem]">
            Concevoir, enseigner et suivre votre impact.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-white/68 sm:text-lg">
            Votre accueil Professeur met d’abord en avant ce qui demande votre attention, vos formations et les espaces Omnia utiles à votre activité pédagogique.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to={withPreview('/professeur/courses/new', previewMode)} className="inline-flex items-center gap-2 rounded-full bg-[#BF8813] px-5 py-3 text-sm font-black text-[#002050] transition hover:-translate-y-0.5">
              <Plus size={16} /> Nouvelle formation
            </Link>
            <Link to={withPreview('/professeur/courses', previewMode)} className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/15">
              Mes formations <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[500px] lg:mr-0">
          <div className="absolute -left-5 top-7 h-[82%] w-[92%] rotate-[-4deg] rounded-[30px] border border-white/10 bg-[#152C58]/50" aria-hidden="true" />
          <div className="absolute -right-3 top-3 h-[88%] w-[88%] rotate-[3deg] rounded-[30px] border border-[#7B86E5]/30 bg-[#162953]/50" aria-hidden="true" />
          <div className="relative overflow-hidden rounded-[28px] border border-white/15 bg-[#0D2852]/92 p-6 shadow-[0_30px_70px_rgba(0,0,0,.26)] backdrop-blur">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/45">Priorité pédagogique</p>
                <h2 className="mt-2 text-xl font-black tracking-[-0.02em]">{previewMode ? 'Aperçu du rôle Professeur' : priorityTitle}</h2>
              </div>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#4657C8]/35 text-[#DCE1FF]"><Sparkles size={20} /></span>
            </div>
            <p className="mt-5 text-sm leading-6 text-white/60">
              {previewMode ? 'Les données personnelles du professeur ne sont pas chargées pendant la prévisualisation Super-admin.' : priorityText}
            </p>
            <Link to={withPreview(previewMode ? '/professeur/courses' : priorityPath, previewMode)} className="group mt-6 flex items-center justify-between border-t border-white/10 pt-5 text-sm font-black text-white">
              <span>{previewMode ? 'Voir l’espace Professeur' : priorityLabel}</span>
              <ArrowRight size={16} className="transition group-hover:translate-x-1" />
            </Link>

            <div className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-2xl bg-white/10">
              {['Concevoir', 'Évaluer', 'Mesurer'].map((label, index) => (
                <div key={label} className="bg-[#0B2349] px-3 py-4 text-center">
                  <span className="block text-[10px] font-black uppercase tracking-[0.12em] text-[#99A7F5]">0{index + 1}</span>
                  <strong className="mt-1 block text-xs text-white/80">{label}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SpaceRail({ previewMode }: { previewMode: boolean }) {
  return (
    <section className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-5 py-9 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#4657C8]">Vos espaces Omnia</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#002050]">Passer directement à votre prochain espace de travail.</h2>
          </div>
          <p className="max-w-lg text-sm leading-6 text-slate-500">Cette barre sert uniquement de redirection. Les menus et sous-menus détaillés restent dans chaque écosystème pour éviter les doublons.</p>
        </div>

        <div className="-mx-5 overflow-x-auto px-5 pb-2 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max gap-3">
            {SPACES.map(item => {
              const Icon = item.icon;
              return (
                <Link key={item.path} to={withPreview(item.path, previewMode)} className="group relative min-h-[150px] w-[224px] overflow-hidden rounded-[20px] border border-slate-200 bg-white p-5 shadow-[0_10px_28px_rgba(0,32,80,.055)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(0,32,80,.10)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BF8813]">
                  <div className="absolute -right-7 -top-7 h-24 w-24 rotate-12 rounded-[28px] opacity-80" style={{ background: item.soft }} aria-hidden="true" />
                  <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: item.soft, color: item.accent }}><Icon size={20} /></span>
                  <strong className="relative mt-5 block text-[15px] font-black text-[#002050]">{item.label}</strong>
                  <span className="relative mt-1.5 block text-xs leading-5 text-slate-500">{item.caption}</span>
                  <ArrowRight size={16} className="absolute bottom-5 right-5 text-slate-300 transition group-hover:translate-x-1" />
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function Activity({ data, previewMode }: Props) {
  const formations = data?.formations || [];
  const published = formations.filter(item => ['published', 'publiee'].includes(item.status)).length;
  const projectsToReview = formations.reduce((sum, item) => sum + (item.projets_a_corriger || 0), 0);
  const totalStudents = data?.kpis?.total_eleves || 0;
  const rating = data?.kpis?.note_globale || 0;
  const unanswered = data?.forum_questions_unanswered || 0;
  const revisions = formations.filter(item => ['changes_requested', 'modification_demandee', 'rejected', 'rejetee'].includes(item.status));
  const drafts = formations.filter(item => ['draft', 'brouillon'].includes(item.status));

  const todo: Array<{ title: string; text: string; path: string; icon: LucideIcon; accent: string }> = [];
  if (revisions.length) todo.push({ title: `${revisions.length} formation${revisions.length > 1 ? 's' : ''} à reprendre`, text: 'Une correction ou une nouvelle soumission est attendue.', path: '/professeur/courses', icon: AlertCircle, accent: '#C45B24' });
  if (projectsToReview > 0) todo.push({ title: `${projectsToReview} projet${projectsToReview > 1 ? 's' : ''} à examiner`, text: 'Des travaux liés à vos formations attendent votre intervention.', path: '/professeur/courses', icon: ClipboardCheck, accent: '#C24141' });
  if (unanswered > 0) todo.push({ title: `${unanswered} question${unanswered > 1 ? 's' : ''} sans réponse`, text: 'Des échanges de la communauté peuvent nécessiter votre contribution.', path: '/forum', icon: MessageSquare, accent: '#0F766E' });
  if (!todo.length && drafts.length) todo.push({ title: 'Poursuivre une formation en brouillon', text: 'Votre studio contient encore une formation en préparation.', path: `/professeur/courses/${drafts[0].id}/edit`, icon: BookOpen, accent: INDIGO });
  if (!todo.length) todo.push({ title: 'Aucune urgence détectée', text: 'Vous pouvez poursuivre vos formations ou préparer un nouveau contenu.', path: '/professeur/courses', icon: CheckCircle2, accent: '#176B5B' });

  const improve: Array<{ title: string; text: string; path: string; icon: LucideIcon }> = [];
  if (!formations.length) {
    improve.push({ title: 'Créer votre première formation', text: 'Démarrez le parcours de conception déjà disponible dans votre espace Professeur.', path: '/professeur/courses/new', icon: Plus });
  } else if (drafts.length) {
    improve.push({ title: 'Finaliser vos brouillons', text: 'Reprenez les contenus encore en préparation avant de commencer un nouveau cycle.', path: '/professeur/courses', icon: BookOpen });
  } else {
    improve.push({ title: 'Préparer votre prochaine formation', text: 'Votre studio est disponible pour construire un nouveau parcours.', path: '/professeur/courses/new', icon: Plus });
  }
  if (published > 0) improve.push({ title: 'Lire votre activité pédagogique', text: 'Utilisez l’analytique existante pour suivre vos apprenants et vos formations publiées.', path: '/professeur/analytics', icon: BarChart3 });
  if (formations.length) improve.push({ title: 'Renforcer vos évaluations', text: 'Accédez à l’Assessment Center pour structurer les preuves liées à vos formations.', path: '/professeur/assessment-center', icon: ClipboardCheck });

  const metrics = [
    { label: 'Publiées', value: published, icon: BookOpen, accent: INDIGO },
    { label: 'Apprenants', value: totalStudents, icon: Users, accent: '#0F766E' },
    { label: 'À examiner', value: projectsToReview, icon: ClipboardCheck, accent: '#C24141' },
    { label: 'Note', value: rating ? `${rating}/5` : '—', icon: Star, accent: GOLD },
  ];

  return (
    <section className="bg-[#F7F8FC]">
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-5 border-b border-slate-200 pb-7">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#4657C8]">Votre activité pédagogique</p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.035em] text-[#002050]">Ce qui compte aujourd’hui.</h2>
          </div>
          <div className="flex overflow-x-auto rounded-2xl border border-slate-200 bg-white [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {metrics.map((metric, index) => {
              const Icon = metric.icon;
              return (
                <div key={metric.label} className={`min-w-[112px] px-4 py-3 ${index ? 'border-l border-slate-200' : ''}`}>
                  <div className="flex items-center gap-2 whitespace-nowrap text-[11px] font-bold text-slate-500"><Icon size={14} style={{ color: metric.accent }} />{metric.label}</div>
                  <div className="mt-1 text-xl font-black text-[#002050]">{previewMode ? '—' : metric.value}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-8 grid gap-8 xl:grid-cols-[1.18fr_0.82fr]">
          <div>
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-black text-[#002050]">Formations récentes</h3>
              <Link to={withPreview('/professeur/courses', previewMode)} className="text-xs font-black text-[#4657C8] hover:underline">Voir toutes</Link>
            </div>
            <div className="mt-4 border-y border-slate-200 bg-white px-5 sm:px-6">
              {previewMode ? (
                <div className="py-10 text-center text-sm text-slate-500">Les formations personnelles ne sont pas chargées dans l’aperçu Super-admin.</div>
              ) : formations.length ? formations.slice(0, 5).map((course, index) => {
                const state = statusOf(course.status);
                return (
                  <Link key={course.id} to={courseActionPath(course)} className={`group grid gap-4 py-5 sm:grid-cols-[1fr_auto] sm:items-center ${index ? 'border-t border-slate-200' : ''}`}>
                    <div className="flex min-w-0 items-center gap-4">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#EEF0FF] text-[#4657C8]">
                        {course.cover_image_url ? <img src={course.cover_image_url} alt="" className="h-full w-full object-cover" /> : <BookOpen size={20} />}
                      </span>
                      <div className="min-w-0">
                        <strong className="block truncate text-sm font-black text-[#002050] group-hover:underline">{course.title}</strong>
                        <span className="mt-1 block text-xs text-slate-500">{course.total_students || 0} apprenant{(course.total_students || 0) > 1 ? 's' : ''}{course.projets_a_corriger ? ` · ${course.projets_a_corriger} projet(s) à examiner` : ''}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="rounded-full px-3 py-1 text-[11px] font-black" style={{ background: state.soft, color: state.accent }}>{state.label}</span>
                      <ArrowRight size={15} className="text-slate-300 transition group-hover:translate-x-1" />
                    </div>
                  </Link>
                );
              }) : (
                <div className="grid gap-4 py-10 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div><strong className="text-sm font-black text-[#002050]">Aucune formation pour le moment</strong><p className="mt-1 text-xs leading-5 text-slate-500">Votre espace est prêt pour une première création.</p></div>
                  <Link to="/professeur/courses/new" className="inline-flex items-center gap-2 text-sm font-black text-[#4657C8]">Créer une formation <ArrowRight size={15} /></Link>
                </div>
              )}
            </div>
          </div>

          <aside className="rounded-[24px] border border-[#DCE1F2] bg-[#F0F2FF] p-6">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#4657C8]">À traiter</p>
            <div className="mt-4 divide-y divide-[#D7DCF3]">
              {todo.slice(0, 3).map(item => {
                const Icon = item.icon;
                return (
                  <Link key={item.title} to={withPreview(item.path, previewMode)} className="group flex gap-3 py-4 first:pt-0">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white" style={{ color: item.accent }}><Icon size={17} /></span>
                    <span className="min-w-0 flex-1"><strong className="block text-sm font-black text-[#002050]">{previewMode ? 'Donnée masquée en aperçu' : item.title}</strong><span className="mt-1 block text-xs leading-5 text-slate-500">{previewMode ? 'Connectez-vous avec le rôle concerné pour afficher son activité.' : item.text}</span></span>
                    <ArrowRight size={14} className="mt-2 text-slate-300 transition group-hover:translate-x-1" />
                  </Link>
                );
              })}
            </div>
          </aside>
        </div>

        <div className="mt-10 grid gap-7 border-t border-slate-200 pt-8 lg:grid-cols-[0.55fr_1.45fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#BF8813]">Améliorer votre activité</p>
            <h3 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#002050]">Des prochaines étapes utiles, pas des statistiques décoratives.</h3>
          </div>
          <div className="grid gap-x-8 border-t border-slate-200 sm:grid-cols-2">
            {improve.slice(0, 3).map(item => {
              const Icon = item.icon;
              return (
                <Link key={item.title} to={withPreview(item.path, previewMode)} className="group flex gap-3 border-b border-slate-200 py-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#4657C8] shadow-sm"><Icon size={18} /></span>
                  <span className="min-w-0 flex-1"><strong className="block text-sm font-black text-[#002050]">{item.title}</strong><span className="mt-1 block text-xs leading-5 text-slate-500">{item.text}</span></span>
                  <ArrowRight size={15} className="mt-1.5 text-slate-300 transition group-hover:translate-x-1" />
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function ProfessorConnectedHomeSections(props: Props) {
  return (
    <>
      <ProfessorHero {...props} />
      <SpaceRail previewMode={props.previewMode} />
      <Activity {...props} />
    </>
  );
}
