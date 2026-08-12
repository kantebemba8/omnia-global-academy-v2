import { useEffect, useMemo, useState } from 'react';
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
import { ENDPOINTS } from '../../lib/config';
import { edgeAuthHeaders } from '../../lib/edgeAuth';
import { getMyProjectsWorkspace } from '../../lib/projectsApi';
import { coachingRequest } from '../../lib/coachingApi';
import { liveApi } from '../../pages/omnia-live/liveApi';

const BLUE = '#002050';
const CYAN = '#0F7699';
const GOLD = '#BF8813';

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

type Signals = {
  careerDocuments: number;
  projectsActive: number;
  projectInvites: number;
  liveUpcoming: number;
  liveActive: number;
  nextLiveTitle?: string;
  coachingUpcoming: number;
  nextCoachName?: string;
};

type EcosystemItem = {
  label: string;
  caption: string;
  path: string;
  accent: string;
  soft: string;
  icon: LucideIcon;
  signal?: string;
};

const EMPTY_SIGNALS: Signals = {
  careerDocuments: 0,
  projectsActive: 0,
  projectInvites: 0,
  liveUpcoming: 0,
  liveActive: 0,
  coachingUpcoming: 0,
};

function withPreview(path: string, previewMode: boolean) {
  if (!previewMode) return path;
  const [base, hash = ''] = path.split('#', 2);
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}preview=true${hash ? `#${hash}` : ''}`;
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(date);
}

async function loadCareerDocumentCount() {
  const loadType = async (docType: 'cv' | 'lm') => {
    const response = await fetch(ENDPOINTS.careerStudioList, {
      method: 'POST',
      headers: edgeAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ doc_type: docType }),
    });
    if (!response.ok) return 0;
    const payload = await response.json().catch(() => ({}));
    return Array.isArray(payload?.documents) ? payload.documents.length : 0;
  };
  const [cv, lm] = await Promise.all([loadType('cv'), loadType('lm')]);
  return cv + lm;
}

function useLearnerSignals(previewMode: boolean) {
  const [signals, setSignals] = useState<Signals>(EMPTY_SIGNALS);

  useEffect(() => {
    if (previewMode) {
      setSignals(EMPTY_SIGNALS);
      return;
    }
    let active = true;
    Promise.allSettled([
      loadCareerDocumentCount(),
      getMyProjectsWorkspace(),
      liveApi('participant_dashboard'),
      coachingRequest<any>('learner_coaching_dashboard'),
    ]).then(results => {
      if (!active) return;
      const next: Signals = { ...EMPTY_SIGNALS };
      if (results[0].status === 'fulfilled') next.careerDocuments = Number(results[0].value || 0);
      if (results[1].status === 'fulfilled') {
        const workspace = results[1].value;
        next.projectsActive = (workspace.applications || []).filter(item => ['selected', 'under_review', 'submitted'].includes(item.status)).length
          + (workspace.memberships || []).filter(item => item.invitation_status === 'accepted').length;
        next.projectInvites = (workspace.invitations || []).filter(item => item.invitation_status === 'pending').length
          + (workspace.project_invitations || []).filter(item => item.status === 'pending').length;
      }
      if (results[2].status === 'fulfilled') {
        const live = results[2].value || {};
        next.liveUpcoming = Number(live?.kpis?.upcoming || live?.upcoming?.length || 0);
        next.liveActive = Number(live?.kpis?.active || live?.active?.length || 0);
        next.nextLiveTitle = live?.upcoming?.[0]?.live_events?.title || live?.active?.[0]?.live_events?.title || undefined;
      }
      if (results[3].status === 'fulfilled') {
        const coaching = results[3].value || {};
        const sessions = Array.isArray(coaching.sessions) ? coaching.sessions : [];
        const now = Date.now();
        const upcoming = sessions
          .filter((session: any) => {
            const date = session.scheduled_start || session.requested_start;
            const stamp = date ? new Date(date).getTime() : 0;
            return stamp >= now && !['cancelled_by_learner', 'cancelled_by_coach', 'refunded', 'expired'].includes(String(session.status || ''));
          })
          .sort((a: any, b: any) => new Date(a.scheduled_start || a.requested_start || 0).getTime() - new Date(b.scheduled_start || b.requested_start || 0).getTime());
        next.coachingUpcoming = upcoming.length;
        next.nextCoachName = upcoming[0]?.coach_name_snapshot || upcoming[0]?.coach?.full_name || undefined;
      }
      setSignals(next);
    });
    return () => { active = false; };
  }, [previewMode]);

  return signals;
}

function LearnerHero({ data, previewMode, signals }: Props & { signals: Signals }) {
  const courses = data?.courses_en_cours || [];
  const firstCourse = courses[0];
  const progress = Math.max(0, Math.min(100, Number(firstCourse?.progress_percent || 0)));
  const completed = Number(data?.kpis?.formations_terminees || 0);
  const certificates = Number(data?.kpis?.certificats_obtenus || 0);

  const nextTitle = previewMode
    ? 'Votre prochaine étape apparaîtra ici'
    : firstCourse?.title || (signals.liveUpcoming ? signals.nextLiveTitle || 'Un Live est bientôt prévu' : 'Choisir votre prochaine formation');
  const nextPath = firstCourse ? `/cours/${firstCourse.slug}/apprendre` : signals.liveUpcoming ? '/omnia-live/participant/mes-lives' : '/catalogue';
  const nextLabel = firstCourse ? 'Reprendre maintenant' : signals.liveUpcoming ? 'Voir mes Lives' : 'Explorer les formations';

  return (
    <section className="relative overflow-hidden border-b border-[#D7E6EE] bg-[linear-gradient(125deg,#F7FCFF_0%,#EEF7FB_52%,#FFF9EE_100%)]">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -right-28 -top-32 h-[430px] w-[430px] rounded-full border border-[#0F7699]/10" />
        <div className="absolute right-4 top-2 h-[320px] w-[320px] rounded-full border border-[#BF8813]/15" />
        <div className="absolute bottom-[-170px] left-[28%] h-[320px] w-[520px] rounded-[50%] bg-[#0F7699]/[0.05] blur-3xl" />
      </div>
      <div className="relative mx-auto grid min-h-[485px] max-w-7xl gap-12 px-5 py-14 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-8 lg:py-16">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-[#BBD8E5] bg-white/80 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.15em] text-[#0F7699]">
            <span className="h-2 w-2 rounded-full bg-[#BF8813]" /> Mon parcours Omnia
          </p>
          <h1 className="mt-5 max-w-[690px] text-4xl font-black leading-[1.02] tracking-[-0.048em] text-[#002050] sm:text-5xl lg:text-[3.65rem]">Avancer sans perdre le fil.</h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">Votre accueil rassemble ce que vous apprenez, ce que vous construisez et les prochaines opportunités utiles à votre progression.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to={withPreview(nextPath, previewMode)} className="inline-flex items-center gap-2 rounded-full bg-[#002050] px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5">{nextLabel}<ArrowRight size={16} /></Link>
            <Link to={withPreview('/dashboard/learning-record', previewMode)} className="inline-flex items-center gap-2 rounded-full border border-[#B8CAD8] bg-white px-5 py-3 text-sm font-black text-[#002050]">Mon Learning Record<FileBadge size={16} /></Link>
          </div>
        </div>

        <div className="relative min-h-[330px]">
          <div className="absolute left-4 right-4 top-1/2 h-1 -translate-y-1/2 rounded-full bg-[#CFE2EA]" aria-hidden="true" />
          <div className="absolute left-4 top-1/2 h-1 -translate-y-1/2 rounded-full bg-[linear-gradient(90deg,#0F7699,#BF8813)] transition-all" style={{ width: `${Math.max(18, Math.min(88, progress || (completed > 0 ? 68 : 28)))}%` }} aria-hidden="true" />
          <div className="relative grid h-full grid-cols-3 items-center gap-3 pt-8">
            <div className="self-end pb-5">
              <div className="rounded-[26px] border border-white bg-white p-5 shadow-[0_24px_60px_rgba(0,32,80,.10)]">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E9F7FB] text-[#0F7699]"><BookOpen size={20} /></span>
                <p className="mt-5 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Maintenant</p>
                <strong className="mt-2 block text-sm font-black leading-5 text-[#002050]">{previewMode ? 'Formation en cours' : nextTitle}</strong>
                {firstCourse && !previewMode && <div className="mt-4"><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#0F7699]" style={{ width: `${progress}%` }} /></div><p className="mt-2 text-xs font-black text-[#0F7699]">{progress}%</p></div>}
              </div>
            </div>

            <div className="self-start pt-2">
              <div className="rounded-[28px] border border-[#E8DFC7] bg-[#FFF9EE] p-5 shadow-[0_20px_50px_rgba(191,136,19,.09)]">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#BF8813]"><Target size={20} /></span>
                <p className="mt-5 text-[10px] font-black uppercase tracking-[0.15em] text-[#9A752A]">Construire</p>
                <strong className="mt-2 block text-sm font-black leading-5 text-[#002050]">{previewMode ? 'Career & Projects' : signals.projectsActive ? `${signals.projectsActive} activité${signals.projectsActive > 1 ? 's' : ''} Projects` : signals.careerDocuments ? `${signals.careerDocuments} document${signals.careerDocuments > 1 ? 's' : ''} Career` : 'Transformer vos acquis en preuves'}</strong>
              </div>
            </div>

            <div className="self-end pb-10">
              <div className="rounded-[26px] bg-[#002050] p-5 text-white shadow-[0_24px_60px_rgba(0,32,80,.18)]">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-[#DDB55C]"><Award size={20} /></span>
                <p className="mt-5 text-[10px] font-black uppercase tracking-[0.15em] text-white/45">Valoriser</p>
                <strong className="mt-2 block text-sm font-black leading-5">{previewMode ? 'Compétences & opportunités' : certificates > 0 ? `${certificates} certificat${certificates > 1 ? 's' : ''} à valoriser` : 'Rendre vos compétences visibles'}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function EcosystemRail({ previewMode, data, signals }: Props & { signals: Signals }) {
  const courseCount = Number(data?.kpis?.formations_en_cours ?? data?.courses_en_cours?.length ?? 0);
  const ecosystems: EcosystemItem[] = [
    { label: 'Formations', caption: 'Cours, évaluations et progression', path: '/formations', accent: '#0F7699', soft: '#E9F7FB', icon: BookOpen, signal: courseCount ? `${courseCount} en cours` : undefined },
    { label: 'Omnia Career', caption: 'CV, LM et préparation carrière', path: '/dashboard/career-studio', accent: '#4F46E5', soft: '#EEF2FF', icon: Briefcase, signal: signals.careerDocuments ? `${signals.careerDocuments} document${signals.careerDocuments > 1 ? 's' : ''}` : undefined },
    { label: 'Omnia Projects', caption: 'Projets, équipes et réalisations', path: '/projects/mes-projets', accent: '#A56B12', soft: '#FFF7E6', icon: FolderKanban, signal: signals.projectInvites ? `${signals.projectInvites} invitation${signals.projectInvites > 1 ? 's' : ''}` : signals.projectsActive ? `${signals.projectsActive} actif${signals.projectsActive > 1 ? 's' : ''}` : undefined },
    { label: 'Omnia Talent', caption: 'Profil et visibilité professionnelle', path: '/talent', accent: '#7C3AED', soft: '#F5F0FF', icon: UsersRound },
    { label: 'Omnia Live', caption: 'Lives, replays et événements', path: '/omnia-live/participant', accent: '#5B4BC4', soft: '#F2F0FF', icon: Radio, signal: signals.liveActive ? `${signals.liveActive} disponible${signals.liveActive > 1 ? 's' : ''}` : signals.liveUpcoming ? `${signals.liveUpcoming} à venir` : undefined },
    { label: 'Communauté', caption: 'Échanges, forums et entraide', path: '/forum', accent: '#0F766E', soft: '#EAF8F6', icon: MessageSquare },
    { label: 'Coaching', caption: 'Sessions et accompagnement', path: '/dashboard/coaching', accent: '#176B5B', soft: '#EAF6F2', icon: Heart, signal: signals.coachingUpcoming ? `${signals.coachingUpcoming} séance${signals.coachingUpcoming > 1 ? 's' : ''}` : undefined },
  ];

  return (
    <section className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-5 py-9 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-5">
          <div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#0F7699]">Vos espaces Omnia</p><h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#002050]">Accéder directement à votre univers.</h2></div>
          <p className="hidden max-w-md text-right text-xs leading-5 text-slate-500 md:block">Les chiffres apparaissent seulement lorsqu’un contenu réel existe dans l’espace concerné.</p>
        </div>
        <div className="mt-6 flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {ecosystems.map(item => {
            const Icon = item.icon;
            return <Link key={item.path} to={withPreview(item.path, previewMode)} className="group min-w-[205px] flex-1 border-l-2 bg-white px-4 py-4 transition hover:bg-slate-50" style={{ borderColor: item.accent }}>
              <div className="flex items-start justify-between gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: item.soft, color: item.accent }}><Icon size={18} /></span>{item.signal && !previewMode && <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">{item.signal}</span>}</div>
              <strong className="mt-4 block text-sm font-black text-[#002050]">{item.label}</strong><span className="mt-1 block text-xs leading-5 text-slate-500">{item.caption}</span><ArrowRight size={14} className="mt-3 text-slate-300 transition group-hover:translate-x-1" />
            </Link>;
          })}
        </div>
      </div>
    </section>
  );
}

function LearnerDigest({ data, previewMode, signals }: Props & { signals: Signals }) {
  const courses = data?.courses_en_cours || [];
  const recent = data?.activite_recente || [];
  const kpis = data?.kpis || {};
  const firstCourse = courses[0];

  const nextActions = useMemo(() => {
    const actions: Array<{ title: string; text: string; path: string; icon: LucideIcon; accent: string }> = [];
    if (signals.projectInvites > 0) actions.push({ title: 'Répondre à vos invitations Projects', text: `${signals.projectInvites} invitation${signals.projectInvites > 1 ? 's attendent' : ' attend'} votre réponse.`, path: '/projects/mes-projets', icon: FolderKanban, accent: '#A56B12' });
    if (firstCourse) actions.push({ title: `Continuer ${firstCourse.title}`, text: `${firstCourse.progress_percent}% du parcours est déjà réalisé.`, path: `/cours/${firstCourse.slug}/apprendre`, icon: BookOpen, accent: CYAN });
    if (signals.liveUpcoming > 0) actions.push({ title: signals.nextLiveTitle || 'Un Live approche', text: `${signals.liveUpcoming} événement${signals.liveUpcoming > 1 ? 's sont' : ' est'} prévu prochainement.`, path: '/omnia-live/participant/mes-lives', icon: Radio, accent: '#5B4BC4' });
    if (signals.coachingUpcoming > 0) actions.push({ title: `Préparer votre séance${signals.nextCoachName ? ` avec ${signals.nextCoachName}` : ''}`, text: `${signals.coachingUpcoming} rendez-vous Coaching à venir.`, path: '/dashboard/coaching', icon: Heart, accent: '#176B5B' });
    if (Number(kpis.certificats_obtenus || 0) > 0 && signals.careerDocuments === 0) actions.push({ title: 'Transformer vos certificats en candidature', text: 'Vos preuves existent déjà : Career peut vous aider à les présenter dans un CV ou une LM.', path: '/dashboard/career-studio', icon: Briefcase, accent: '#4F46E5' });
    if (!actions.length) actions.push({ title: 'Choisir votre prochaine progression', text: 'Aucune priorité n’est détectée. Explorez une formation ou un espace Omnia selon votre objectif.', path: '/catalogue', icon: Sparkles, accent: GOLD });
    return actions.slice(0, 4);
  }, [firstCourse, kpis.certificats_obtenus, signals]);

  const platformNotes = [
    signals.careerDocuments ? `${signals.careerDocuments} document${signals.careerDocuments > 1 ? 's' : ''} dans Career` : null,
    signals.projectsActive ? `${signals.projectsActive} activité${signals.projectsActive > 1 ? 's' : ''} Projects` : null,
    signals.liveUpcoming || signals.liveActive ? `${signals.liveUpcoming + signals.liveActive} contenu${signals.liveUpcoming + signals.liveActive > 1 ? 's' : ''} Live` : null,
    signals.coachingUpcoming ? `${signals.coachingUpcoming} séance${signals.coachingUpcoming > 1 ? 's' : ''} Coaching` : null,
  ].filter(Boolean) as string[];

  return (
    <section className="bg-[#F7FAFC]">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-8 xl:grid-cols-[1.25fr_0.75fr]">
          <div>
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6">
              <div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#0F7699]">Votre apprentissage</p><h2 className="mt-2 text-3xl font-black tracking-[-0.035em] text-[#002050]">Ce qui est réellement en cours.</h2></div>
              <div className="flex gap-5 text-right"><div><span className="block text-2xl font-black text-[#002050]">{previewMode ? '—' : Number(kpis.formations_en_cours ?? courses.length)}</span><span className="text-[11px] font-bold text-slate-400">en cours</span></div><div><span className="block text-2xl font-black text-[#002050]">{previewMode ? '—' : Number(kpis.formations_terminees || 0)}</span><span className="text-[11px] font-bold text-slate-400">terminées</span></div><div><span className="block text-2xl font-black text-[#002050]">{previewMode ? '—' : Number(kpis.certificats_obtenus || 0)}</span><span className="text-[11px] font-bold text-slate-400">certificats</span></div></div>
            </div>

            <div className="mt-5 border-y border-slate-200 bg-white px-5 sm:px-6">
              {previewMode ? <div className="py-10 text-sm text-slate-500">Les formations personnelles ne sont pas chargées pendant la prévisualisation.</div> : courses.length ? courses.slice(0, 4).map((course, index) => <Link key={course.course_id} to={`/cours/${course.slug}/apprendre`} className={`group grid gap-4 py-5 sm:grid-cols-[1fr_190px] sm:items-center ${index ? 'border-t border-slate-100' : ''}`}>
                <div className="min-w-0"><strong className="block truncate text-sm font-black text-[#002050]">{course.title}</strong><span className="mt-1 block text-xs text-slate-500">{course.lessons_completed}/{course.lessons_total} leçons terminées</span></div>
                <div className="flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#0F7699]" style={{ width: `${Math.max(0, Math.min(100, course.progress_percent))}%` }} /></div><span className="w-10 text-right text-xs font-black text-[#002050]">{course.progress_percent}%</span><ArrowRight size={15} className="text-slate-300 transition group-hover:translate-x-1" /></div>
              </Link>) : <div className="flex flex-col gap-4 py-9 sm:flex-row sm:items-center sm:justify-between"><div><strong className="text-sm font-black text-[#002050]">Aucune formation en cours</strong><p className="mt-1 text-xs text-slate-500">Votre prochaine inscription apparaîtra automatiquement ici.</p></div><Link to="/catalogue" className="text-sm font-black text-[#0F7699]">Voir le catalogue</Link></div>}
            </div>

            <div className="mt-9">
              <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#BF8813]">Prochaine meilleure action</p><h3 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#002050]">Des recommandations qui changent avec votre activité.</h3></div></div>
              <div className="mt-4 grid gap-px overflow-hidden rounded-[24px] border border-slate-200 bg-slate-200 md:grid-cols-2">
                {nextActions.map(item => { const Icon = item.icon; return <Link key={`${item.path}-${item.title}`} to={withPreview(item.path, previewMode)} className="group bg-white p-5"><div className="flex items-start gap-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-50" style={{ color: item.accent }}><Icon size={18} /></span><div className="min-w-0 flex-1"><strong className="block text-sm font-black text-[#002050]">{previewMode ? 'Suggestion personnalisée' : item.title}</strong><p className="mt-1.5 text-xs leading-5 text-slate-500">{previewMode ? 'Cette recommandation se nourrit des contenus réels du compte.' : item.text}</p></div><ArrowRight size={14} className="mt-2 text-slate-300 transition group-hover:translate-x-1" /></div></Link>; })}
              </div>
            </div>
          </div>

          <aside className="overflow-hidden rounded-[28px] bg-[#061F3B] text-white shadow-[0_24px_60px_rgba(0,32,80,.15)]">
            <div className="border-b border-white/10 px-6 py-6"><p className="text-xs font-black uppercase tracking-[0.16em] text-[#DDB55C]">Votre Omnia en résumé</p><h3 className="mt-2 text-2xl font-black tracking-[-0.03em]">Ce qui bouge autour de vous.</h3></div>
            <div className="px-6 py-2">
              {previewMode ? <div className="py-7 text-sm leading-6 text-white/55">Les contenus personnels sont masqués dans la prévisualisation.</div> : platformNotes.length ? platformNotes.map(note => <div key={note} className="flex items-center gap-3 border-b border-white/10 py-4 last:border-0"><span className="h-2 w-2 rounded-full bg-[#DDB55C]" /><span className="text-sm font-bold text-white/80">{note}</span></div>) : <div className="py-7 text-sm leading-6 text-white/55">Les résumés Career, Projects, Live et Coaching apparaîtront ici automatiquement dès qu’une activité existe.</div>}
            </div>
            <div className="border-t border-white/10 px-6 py-5"><p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/40">Dernières leçons</p><div className="mt-3 divide-y divide-white/10">{!previewMode && recent.length ? recent.slice(0, 3).map((activity, index) => <div key={`${activity.lesson_id || index}`} className="grid grid-cols-[1fr_auto] gap-3 py-3"><div className="min-w-0"><strong className="block truncate text-xs font-bold text-white">{activity.lesson_title || 'Leçon terminée'}</strong><span className="mt-1 block text-[11px] text-white/40">Progression enregistrée</span></div><span className="text-[11px] font-bold text-white/40">{formatDate(activity.completed_at)}</span></div>) : <p className="py-3 text-xs leading-5 text-white/45">Votre historique récent s’affichera ici.</p>}</div><Link to={withPreview('/dashboard/learning-record', previewMode)} className="mt-4 inline-flex items-center gap-2 text-xs font-black text-[#DDB55C]">Learning Record <ArrowRight size={13} /></Link></div>
          </aside>
        </div>
      </div>
    </section>
  );
}

export default function LearnerConnectedHomeSections(props: Props) {
  const signals = useLearnerSignals(props.previewMode);
  return <><LearnerHero {...props} signals={signals} /><EcosystemRail {...props} signals={signals} /><LearnerDigest {...props} signals={signals} /></>;
}
