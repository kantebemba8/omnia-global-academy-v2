import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  BookOpen,
  Briefcase,
  CalendarCheck,
  FileBadge,
  FolderKanban,
  Heart,
  MessageSquare,
  Radio,
  Sparkles,
  Target,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';

const BLUE = '#002050';

export type LearnerConnectedHomeData = {
  kpis?: {
    formations_en_cours?: number;
    formations_terminees?: number;
    certificats_obtenus?: number;
    jetons_ia_restants?: number;
  };
  courses_en_cours?: Array<{
    course_id: string;
    title: string;
    slug: string;
    progress_percent: number;
    lessons_completed: number;
    lessons_total: number;
  }>;
  activite_recente?: Array<{
    lesson_id?: string;
    course_id?: string;
    lesson_title: string;
    completed_at: string;
  }>;
};

type Props = {
  data: LearnerConnectedHomeData | null;
  previewMode: boolean;
};

type EcosystemItem = {
  label: string;
  caption: string;
  path: string;
  accent: string;
  soft: string;
  icon: LucideIcon;
};

const ECOSYSTEMS: EcosystemItem[] = [
  { label: 'Formations', caption: 'Cours, évaluations et progression', path: '/dashboard/mes-cours', accent: '#0F7699', soft: '#E9F7FB', icon: BookOpen },
  { label: 'Omnia Career', caption: 'CV, LM et préparation carrière', path: '/dashboard/career-studio', accent: '#4F46E5', soft: '#EEF2FF', icon: Briefcase },
  { label: 'Omnia Projects', caption: 'Projets, équipes et réalisations', path: '/projects/mes-projets', accent: '#A56B12', soft: '#FFF7E6', icon: FolderKanban },
  { label: 'Omnia Talent', caption: 'Profil et visibilité professionnelle', path: '/talent', accent: '#7C3AED', soft: '#F5F0FF', icon: UsersRound },
  { label: 'Omnia Live', caption: 'Lives, replays et événements', path: '/omnia-live/participant', accent: '#5B4BC4', soft: '#F2F0FF', icon: Radio },
  { label: 'Communauté', caption: 'Échanges, forums et entraide', path: '/forum', accent: '#0F766E', soft: '#EAF8F6', icon: MessageSquare },
  { label: 'Coaching', caption: 'Sessions et accompagnement', path: '/dashboard/coaching', accent: '#176B5B', soft: '#EAF6F2', icon: Heart },
];

function withPreview(path: string, previewMode: boolean) {
  if (!previewMode) return path;
  const [base, hash = ''] = path.split('#', 2);
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}preview=true${hash ? `#${hash}` : ''}`;
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  } catch {
    return value;
  }
}

function EcosystemRail({ previewMode }: { previewMode: boolean }) {
  return (
    <section className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-5 py-9 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0F7699]">Vos espaces Omnia</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#002050]">Aller directement là où vous voulez avancer.</h2>
          </div>
          <p className="max-w-lg text-sm leading-6 text-slate-500">Cette barre donne accès aux écosystèmes. Les menus détaillés restent à l’intérieur de chaque espace pour éviter les doublons.</p>
        </div>

        <div className="-mx-5 overflow-x-auto px-5 pb-2 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max gap-3">
            {ECOSYSTEMS.map(item => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={withPreview(item.path, previewMode)}
                  className="group relative min-h-[156px] w-[218px] overflow-hidden rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(0,32,80,0.06)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(0,32,80,0.10)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BF8813]"
                >
                  <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-70" style={{ background: item.soft }} aria-hidden="true" />
                  <div className="absolute right-4 top-5 h-10 w-10 rotate-12 rounded-[14px] border opacity-35" style={{ borderColor: item.accent }} aria-hidden="true" />
                  <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: item.soft, color: item.accent }}>
                    <Icon size={20} />
                  </span>
                  <strong className="relative mt-6 block text-[15px] font-black text-[#002050]">{item.label}</strong>
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

function ProgressSummary({ data, previewMode }: Props) {
  const courses = data?.courses_en_cours || [];
  const kpis = data?.kpis || {};
  const recent = data?.activite_recente || [];
  const firstCourse = courses[0];

  const suggestions = [] as Array<{ icon: LucideIcon; title: string; text: string; path: string }>;

  if (firstCourse) {
    suggestions.push({
      icon: Target,
      title: `Reprendre ${firstCourse.title}`,
      text: `${firstCourse.progress_percent}% terminé · ${firstCourse.lessons_completed}/${firstCourse.lessons_total} leçons`,
      path: `/cours/${firstCourse.slug}/apprendre`,
    });
  } else {
    suggestions.push({
      icon: BookOpen,
      title: 'Choisir votre prochaine formation',
      text: 'Explorez le catalogue et démarrez un parcours adapté à votre objectif.',
      path: '/catalogue',
    });
  }

  if ((kpis.formations_terminees || 0) > 0) {
    suggestions.push({
      icon: Sparkles,
      title: 'Transformer vos acquis en preuves',
      text: 'Regroupez vos compétences, badges et réalisations dans votre Skills Passport.',
      path: '/dashboard/skills-passport',
    });
  } else {
    suggestions.push({
      icon: CalendarCheck,
      title: 'Structurer votre prochaine étape',
      text: 'Consultez vos évaluations pour garder votre progression visible et organisée.',
      path: '/dashboard/evaluations',
    });
  }

  if ((kpis.certificats_obtenus || 0) > 0) {
    suggestions.push({
      icon: FileBadge,
      title: 'Valoriser vos certificats',
      text: 'Utilisez Career et Talent pour rendre vos preuves plus visibles dans votre parcours professionnel.',
      path: '/dashboard/career-studio',
    });
  } else {
    suggestions.push({
      icon: Briefcase,
      title: 'Préparer votre profil professionnel',
      text: 'Omnia Career vous aide à transformer vos compétences en documents exploitables.',
      path: '/dashboard/career-studio',
    });
  }

  const metrics = [
    { label: 'En cours', value: kpis.formations_en_cours ?? courses.length, icon: BookOpen, accent: '#0F7699' },
    { label: 'Terminées', value: kpis.formations_terminees ?? 0, icon: CalendarCheck, accent: '#176B5B' },
    { label: 'Certificats', value: kpis.certificats_obtenus ?? 0, icon: Award, accent: '#BF8813' },
  ];

  return (
    <section className="bg-[#F7F9FC]">
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 xl:grid-cols-[1.25fr_0.75fr]">
          <div>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0F7699]">Votre activité</p>
                <h2 className="mt-2 text-3xl font-black tracking-[-0.035em] text-[#002050]">Ce qui compte maintenant.</h2>
              </div>
              <div className="flex overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {metrics.map((metric, index) => {
                  const Icon = metric.icon;
                  return (
                    <div key={metric.label} className={`min-w-[108px] px-4 py-3 ${index ? 'border-l border-slate-200' : ''}`}>
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-500"><Icon size={14} style={{ color: metric.accent }} />{metric.label}</div>
                      <div className="mt-1 text-xl font-black text-[#002050]">{metric.value}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-7 border-y border-slate-200 bg-white px-5 sm:px-6">
              {courses.length ? courses.slice(0, 3).map((course, index) => (
                <Link
                  key={course.course_id}
                  to={withPreview(`/cours/${course.slug}/apprendre`, previewMode)}
                  className={`group grid gap-4 py-5 sm:grid-cols-[1fr_190px] sm:items-center ${index ? 'border-t border-slate-200' : ''}`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E9F7FB] text-[#0F7699]"><BookOpen size={17} /></span>
                      <div className="min-w-0">
                        <strong className="block truncate text-sm font-black text-[#002050] group-hover:underline">{course.title}</strong>
                        <span className="mt-1 block text-xs text-slate-500">{course.lessons_completed}/{course.lessons_total} leçons terminées</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#0F7699]" style={{ width: `${Math.max(0, Math.min(100, course.progress_percent))}%` }} /></div>
                    <span className="w-10 text-right text-xs font-black text-[#002050]">{course.progress_percent}%</span>
                    <ArrowRight size={15} className="text-slate-300 transition group-hover:translate-x-1" />
                  </div>
                </Link>
              )) : (
                <div className="flex flex-col items-start gap-4 py-8 sm:flex-row sm:items-center sm:justify-between">
                  <div><strong className="text-sm font-black text-[#002050]">Aucune formation en cours</strong><p className="mt-1 text-sm text-slate-500">Votre prochaine formation apparaîtra ici dès votre inscription.</p></div>
                  <Link to="/catalogue" className="inline-flex items-center gap-2 rounded-full bg-[#002050] px-4 py-2.5 text-sm font-bold text-white">Explorer le catalogue <ArrowRight size={15} /></Link>
                </div>
              )}
            </div>

            <div className="mt-8">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-black text-[#002050]">Améliorer votre parcours</h3>
                <span className="text-xs font-semibold text-slate-400">Suggestions liées à votre situation</span>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {suggestions.slice(0, 3).map(item => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.title} to={withPreview(item.path, previewMode)} className="group rounded-[20px] border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-[0_14px_30px_rgba(0,32,80,0.07)]">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F1F5F9] text-[#002050]"><Icon size={18} /></span>
                      <strong className="mt-4 block text-sm font-black text-[#002050]">{item.title}</strong>
                      <p className="mt-2 text-xs leading-5 text-slate-500">{item.text}</p>
                      <span className="mt-4 inline-flex items-center gap-1 text-xs font-black text-[#0F7699]">Continuer <ArrowRight size={13} className="transition group-hover:translate-x-1" /></span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          <aside className="relative overflow-hidden rounded-[28px] bg-[#071E39] p-6 text-white shadow-[0_18px_45px_rgba(0,32,80,0.16)] sm:p-7">
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full border border-white/10" aria-hidden="true" />
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full border border-[#BF8813]/40" aria-hidden="true" />
            <div className="absolute right-10 top-12 h-16 w-16 rotate-12 rounded-2xl border border-white/10 bg-white/[0.03]" aria-hidden="true" />
            <div className="relative">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#DDB55C]">Activité récente</p>
              <h3 className="mt-2 text-2xl font-black tracking-[-0.03em]">Votre rythme d’apprentissage</h3>
              <p className="mt-3 text-sm leading-6 text-white/60">Les dernières leçons réellement terminées apparaissent ici.</p>

              <div className="mt-7 divide-y divide-white/10 border-y border-white/10">
                {recent.length ? recent.slice(0, 4).map((activity, index) => (
                  <div key={`${activity.lesson_id || activity.course_id || 'activity'}-${index}`} className="grid grid-cols-[30px_1fr_auto] items-start gap-3 py-4">
                    <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-[#DDB55C]"><CalendarCheck size={14} /></span>
                    <div className="min-w-0"><strong className="block truncate text-sm font-bold text-white">{activity.lesson_title || 'Leçon terminée'}</strong><span className="mt-1 block text-xs text-white/45">Progression enregistrée</span></div>
                    <span className="text-xs font-semibold text-white/45">{formatDate(activity.completed_at)}</span>
                  </div>
                )) : (
                  <div className="py-8 text-sm leading-6 text-white/55">Votre activité récente s’affichera ici après vos premières leçons terminées.</div>
                )}
              </div>

              <Link to={withPreview('/dashboard/learning-record', previewMode)} className="mt-6 inline-flex items-center gap-2 text-sm font-black text-white">Voir mon Learning Record <ArrowRight size={15} className="text-[#DDB55C]" /></Link>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

export default function LearnerConnectedHomeSections(props: Props) {
  return (
    <>
      <EcosystemRail previewMode={props.previewMode} />
      <ProgressSummary {...props} />
    </>
  );
}
