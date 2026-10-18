import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, FolderKanban, CalendarDays, CheckCircle2, HeartHandshake, MessageCircle, NotebookPen, Package, Radio, Star, UserRound, Users, Video, Wallet, type LucideIcon } from 'lucide-react';
import {
  type CoachOffer,
  type CoachProfile,
  type CoachingSession,
  coachingRequest,
  formatXof,
} from '../../lib/coachingApi';

type Props = { previewMode: boolean };

type DashboardData = {
  success?: boolean;
  profile?: CoachProfile | null;
  offers?: CoachOffer[];
  recent_sessions?: CoachingSession[];
  metrics?: {
    upcoming_sessions?: number | null;
    completed_sessions?: number | null;
    average_rating?: number | null;
    pending_custom_requests?: number | null;
    available_revenue_xof?: number | null;
  };
};

type HomeAction = {
  title: string;
  description: string;
  path: string;
  label: string;
  icon: LucideIcon;
  accent: string;
};

const BLUE = '#002050';
void BLUE;
const PETROL = '#0B746C';
const GOLD = '#BF8813';

function withPreview(path: string, previewMode: boolean) {
  if (!previewMode) return path;
  const [base, hash = ''] = path.split('#', 2);
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}preview=true${hash ? `#${hash}` : ''}`;
}

function n(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: unknown) {
  return n(value).toLocaleString('fr-FR');
}

function sessionDate(session: CoachingSession) {
  return session.scheduled_start || session.requested_start || session.created_at;
}

function formatDate(value?: string | null, includeTime = true) {
  if (!value) return 'À planifier';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'À planifier';
  return new Intl.DateTimeFormat('fr-FR', includeTime
    ? { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
    : { day: 'numeric', month: 'short' }).format(date);
}

function learnerName(session?: CoachingSession | null) {
  return session?.learner?.full_name?.trim() || 'Apprenant';
}

function statusLabel(status?: string | null) {
  const map: Record<string, string> = {
    pending_coach: 'Réponse attendue',
    pending_payment: 'Paiement en attente',
    confirmed: 'Confirmée',
    ready: 'Prête',
    in_progress: 'En cours',
    completed: 'Terminée',
    cancelled_by_learner: 'Annulée',
    cancelled_by_coach: 'Annulée',
    declined_by_coach: 'Refusée',
    expired: 'Expirée',
    disputed: 'En vérification',
    refunded: 'Remboursée',
  };
  const key = String(status || '');
  return map[key] || key.replace(/_/g, ' ') || 'À suivre';
}

function profileCompletion(profile?: CoachProfile | null) {
  if (!profile) return 0;
  const checks = [
    profile.full_name,
    profile.professional_title,
    profile.biography,
    profile.country,
    profile.timezone,
    profile.languages?.length,
    profile.domains?.length,
    profile.specialties?.length,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function sortedFutureSessions(sessions: CoachingSession[]) {
  const now = Date.now();
  return [...sessions]
    .filter(session => {
      const time = new Date(sessionDate(session) || 0).getTime();
      return Number.isFinite(time)
        && time >= now
        && !['cancelled_by_learner', 'cancelled_by_coach', 'declined_by_coach', 'expired', 'refunded'].includes(session.status);
    })
    .sort((a, b) => new Date(sessionDate(a) || 0).getTime() - new Date(sessionDate(b) || 0).getTime());
}

function buildActions(data: DashboardData, previewMode: boolean): HomeAction[] {
  if (previewMode) {
    return [{
      title: 'Continuité d’accompagnement',
      description: 'En utilisation réelle, cette zone se construit à partir des demandes, séances, avis et disponibilités du Coach.',
      path: '/coaching/pratique',
      label: 'Voir ma pratique',
      icon: HeartHandshake,
      accent: PETROL,
    }];
  }

  const metrics = data.metrics || {};
  const offers = data.offers || [];
  const activeOffers = offers.filter(offer => offer.status === 'active');
  const completion = profileCompletion(data.profile);
  const actions: HomeAction[] = [];

  if (n(metrics.pending_custom_requests) > 0) {
    actions.push({
      title: 'Répondre avant que le parcours ne se bloque',
      description: `${formatNumber(metrics.pending_custom_requests)} demande${n(metrics.pending_custom_requests) > 1 ? 's personnalisées attendent' : ' personnalisée attend'} votre réponse.`,
      path: '/coach/offres', label: 'Traiter les demandes', icon: MessageCircle, accent: '#A56516',
    });
  }
  if (data.profile && completion < 100) {
    actions.push({
      title: 'Affiner votre signature de Coach',
      description: `Votre profil est complété à environ ${completion} %. Les éléments manquants peuvent mieux présenter votre expertise et vos domaines.`,
      path: '/home?section=profil', label: 'Compléter mon profil', icon: UserRound, accent: '#54708F',
    });
  }
  if (!activeOffers.length) {
    actions.push({
      title: 'Rendre votre accompagnement réservable',
      description: offers.length ? 'Vos offres existent mais aucune n’est actuellement active.' : 'Aucune offre n’est encore disponible pour présenter clairement votre accompagnement.',
      path: '/coach/offres', label: 'Gérer mes offres', icon: Package, accent: '#6D5FA6',
    });
  }
  if (activeOffers.length > 0 && n(metrics.upcoming_sessions) === 0) {
    actions.push({
      title: 'Reconnecter offres et disponibilités',
      description: 'Des offres sont actives mais aucune séance future ne remonte. Vérifiez vos créneaux et règles de disponibilité.',
      path: '/coach/calendrier', label: 'Vérifier mon agenda', icon: CalendarDays, accent: PETROL,
    });
  }
  if (n(metrics.completed_sessions) > 0 && n(metrics.average_rating) > 0) {
    actions.push({
      title: 'Transformer les avis en amélioration concrète',
      description: `Votre note moyenne actuelle est de ${n(metrics.average_rating).toFixed(1)}/5. Les retours peuvent guider vos prochains formats et votre préparation.`,
      path: '/coach/avis', label: 'Lire les avis', icon: Star, accent: GOLD,
    });
  }
  if (n(metrics.available_revenue_xof) > 0) {
    actions.push({
      title: 'Suivre ce qui est disponible',
      description: `${formatXof(n(metrics.available_revenue_xof))} sont signalés comme disponibles dans votre activité Coaching.`,
      path: '/coach/revenus', label: 'Voir mes revenus', icon: Wallet, accent: '#187552',
    });
  }
  if (!actions.length) {
    actions.push({
      title: 'Préparer la prochaine séquence',
      description: 'Aucun blocage prioritaire n’est détecté. Vous pouvez préparer vos prochaines séances ou faire évoluer vos offres.',
      path: '/coach/calendrier', label: 'Préparer mon agenda', icon: NotebookPen, accent: PETROL,
    });
  }
  return actions.slice(0, 4);
}

function CoachHero({ data, loading, previewMode }: { data: DashboardData; loading: boolean; previewMode: boolean }) {
  const sessions = data.recent_sessions || [];
  const future = sortedFutureSessions(sessions);
  const next = future[0];
  const inProgress = sessions.find(session => session.status === 'in_progress');
  const pending = n(data.metrics?.pending_custom_requests) || sessions.filter(session => session.status === 'pending_coach').length;
  const profileName = data.profile?.full_name?.trim() || 'Coach';

  const focus = inProgress
    ? { kicker: 'Séance en cours', title: learnerName(inProgress), text: inProgress.offer_title_snapshot, path: `/coaching/sessions/${inProgress.id}/room`, label: 'Rejoindre la séance' }
    : pending > 0
      ? { kicker: 'Réponse attendue', title: `${pending} demande${pending > 1 ? 's' : ''} à examiner`, text: 'Une réponse débloque la suite du parcours de l’apprenant.', path: '/coach/offres', label: 'Examiner maintenant' }
      : next
        ? { kicker: 'Prochaine séance', title: learnerName(next), text: `${formatDate(sessionDate(next))} · ${next.duration_minutes} min`, path: '/coach/sessions', label: 'Préparer la séance' }
        : { kicker: 'Agenda ouvert', title: 'Préparer la prochaine rencontre', text: 'Vos prochains rendez-vous apparaîtront ici dès qu’ils seront programmés.', path: '/coach/calendrier', label: 'Ouvrir le calendrier' };

  const steps = [
    { label: 'Demande', done: pending > 0, icon: MessageCircle },
    { label: 'Préparer', done: Boolean(next), icon: NotebookPen },
    { label: 'Séance', done: Boolean(inProgress), icon: Video },
    { label: 'Suivi', done: n(data.metrics?.completed_sessions) > 0, icon: CheckCircle2 },
  ];

  return (
    <section className="relative overflow-hidden border-b border-[#D5E4E0] bg-[linear-gradient(118deg,#FBFEFD_0%,#F2FAF7_48%,#FFF9EF_100%)]">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -left-40 -top-48 h-[500px] w-[500px] rounded-full border border-[#0B746C]/10" />
        <div className="absolute right-[-160px] top-[-100px] h-[440px] w-[440px] rounded-full border border-[#BF8813]/12" />
        <div className="absolute bottom-[-140px] left-[38%] h-[300px] w-[300px] rounded-full bg-[#0B746C]/[0.05] blur-3xl" />
      </div>
      <div className="relative mx-auto grid min-h-[520px] max-w-7xl gap-12 px-5 py-14 sm:px-6 lg:grid-cols-[0.86fr_1.14fr] lg:items-center lg:px-8 lg:py-16">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#CCE3DE] bg-white/85 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-[#0B746C] shadow-sm">
            <HeartHandshake size={14} /> Continuité d’accompagnement
          </div>
          <h1 className="mt-5 max-w-[650px] text-4xl font-black leading-[1.02] tracking-[-0.048em] text-[#002050] sm:text-5xl lg:text-[3.55rem]">
            Une séance compte. Le fil entre les séances compte encore plus.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
            {previewMode ? 'Aperçu de l’accueil Coach : agenda, continuité et qualité de l’accompagnement.' : `${profileName}, retrouvez ce qui doit être préparé, suivi ou amélioré sans parcourir tous vos menus.`}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to={withPreview(focus.path, previewMode)} className="inline-flex items-center gap-2 rounded-xl bg-[#0B746C] px-5 py-3 text-sm font-black text-white shadow-[0_12px_26px_rgba(11,116,108,.16)]">
              {previewMode ? 'Explorer l’espace Coach' : focus.label} <ArrowRight size={16} />
            </Link>
            <Link to={withPreview('/coach/sessions', previewMode)} className="inline-flex items-center gap-2 rounded-xl border border-[#CBD9D7] bg-white px-5 py-3 text-sm font-black text-[#002050]">Mes séances <CalendarDays size={16} /></Link>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[650px]">
          <div className="absolute -left-5 top-7 h-[88%] w-[96%] -rotate-2 rounded-[30px] border border-[#D8E4E2] bg-white/55" />
          <div className="relative overflow-hidden rounded-[30px] border border-[#C8DAD6] bg-white shadow-[0_26px_70px_rgba(0,32,80,.12)]">
            <div className="flex items-center justify-between border-b border-[#E3EBE9] px-5 py-4 sm:px-6">
              <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#0B746C]">Carnet du jour</p><p className="mt-1 text-sm font-black text-[#002050]">{loading ? 'Synchronisation…' : focus.kicker}</p></div>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EAF6F3] text-[#0B746C]"><NotebookPen size={18} /></span>
            </div>
            <div className="grid gap-0 sm:grid-cols-[1fr_170px]">
              <div className="p-5 sm:p-6">
                <p className="text-xs font-bold text-slate-400">Prochaine attention</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#002050]">{focus.title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">{focus.text}</p>
                {!previewMode && next?.offer_title_snapshot && !inProgress && <p className="mt-5 border-l-2 border-[#BF8813] pl-3 text-xs font-semibold leading-5 text-slate-500">{next.offer_title_snapshot}</p>}
              </div>
              <div className="border-t border-[#E3EBE9] bg-[#F6FAF9] p-5 sm:border-l sm:border-t-0">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Rythme</p>
                <div className="mt-4 space-y-4">
                  {steps.map((step, index) => { const Icon = step.icon; return <div key={step.label} className="flex items-center gap-3"><span className={`flex h-8 w-8 items-center justify-center rounded-full ${step.done ? 'bg-[#0B746C] text-white' : 'border border-slate-200 bg-white text-slate-400'}`}><Icon size={14} /></span><span><strong className="block text-xs font-black text-[#002050]">0{index + 1}</strong><span className="text-[11px] text-slate-500">{step.label}</span></span></div>; })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SpacesRail({ data, previewMode }: { data: DashboardData; previewMode: boolean }) {
  const metrics = data.metrics || {};
  const offers = data.offers || [];
  const activeOffers = offers.filter(item => item.status === 'active').length;
void activeOffers;
  const spaces = [
    { label: 'Formations', caption: 'Parcours et ressources pédagogiques', path: '/formations', accent: '#0F7699', soft: '#E9F7FB', icon: BookOpen },
    { label: 'Omnia Career', caption: 'Trajectoires et préparation professionnelle', path: '/career-studio', accent: '#BF8813', soft: '#FBF5E9', icon: NotebookPen },
    { label: 'Omnia Projects', caption: 'Missions et preuves d’expérience', path: '/projects', accent: '#A56B12', soft: '#FFF7E6', icon: FolderKanban },
    { label: 'Omnia Talent', caption: 'Présence professionnelle', path: '/talent', accent: '#955272', soft: '#FAEEF4', icon: UserRound },
    { label: 'Omnia Live', caption: 'Événements et experts', path: '/omnia-live', accent: '#6556B5', soft: '#F0EEFF', icon: Radio },
    { label: 'Communauté', caption: 'Échanges et ressources', path: '/forum', accent: '#0D8277', soft: '#EAF8F6', icon: Users },
    { label: 'Coaching', caption: 'Séances, offres et accompagnement', path: '/coaching', accent: PETROL, soft: '#EAF6F3', icon: HeartHandshake, signal: n(metrics.upcoming_sessions) ? `${formatNumber(metrics.upcoming_sessions)} à venir` : undefined },
  ];
  return <section className="border-b border-slate-200 bg-white"><div className="mx-auto max-w-7xl px-5 py-9 sm:px-6 lg:px-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#0B746C]">Vos espaces Omnia</p><h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#002050]">Passer du suivi au bon espace.</h2></div><p className="max-w-lg text-xs leading-5 text-slate-500">Les compteurs n’apparaissent que lorsqu’une activité réelle existe.</p></div><div className="mt-6 flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{spaces.map(space => { const Icon = space.icon; return <Link key={space.path} to={withPreview(space.path, previewMode)} className="group min-w-[210px] flex-1 border-b-2 bg-white p-4 transition hover:bg-[#FAFCFB]" style={{ borderColor: space.accent }}><div className="flex items-start justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ color: space.accent, background: space.soft }}><Icon size={18} /></span>{space.signal && !previewMode && <span className="text-[10px] font-black text-slate-400">{space.signal}</span>}</div><strong className="mt-4 block text-sm font-black text-[#002050]">{space.label}</strong><span className="mt-1 block text-xs leading-5 text-slate-500">{space.caption}</span><ArrowRight size={14} className="mt-3 text-slate-300 transition group-hover:translate-x-1" /></Link>; })}</div></div></section>;
}

function ActivityDigest({ data, previewMode }: { data: DashboardData; previewMode: boolean }) {
  const sessions = data.recent_sessions || [];
  const future = sortedFutureSessions(sessions).slice(0, 4);
  const completed = [...sessions].filter(item => item.status === 'completed').sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 3);
  const activeOffers = (data.offers || []).filter(item => item.status === 'active').slice(0, 3);

  const signals = [
    { label: 'Séances à venir', value: n(data.metrics?.upcoming_sessions), icon: CalendarDays },
    { label: 'Accompagnements terminés', value: n(data.metrics?.completed_sessions), icon: CheckCircle2 },
    { label: 'Offres actives', value: activeOffers.length, icon: Package },
    { label: 'Note moyenne', value: n(data.metrics?.average_rating) ? `${n(data.metrics?.average_rating).toFixed(1)}/5` : '—', icon: Star },
  ];

  return <section className="bg-[#F7FAF9]"><div className="mx-auto max-w-7xl px-5 py-14 sm:px-6 lg:px-8"><div className="grid gap-10 xl:grid-cols-[1.12fr_0.88fr]"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#0B746C]">Votre semaine en résumé</p><h2 className="mt-2 max-w-2xl text-3xl font-black tracking-[-0.035em] text-[#002050]">Le contenu réel remonte ici dès qu’il existe.</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">Agenda, séances terminées et offres actives sont résumés sans remplacer leurs pages de gestion.</p><div className="mt-7 overflow-hidden rounded-[24px] border border-slate-200 bg-white">{previewMode ? <div className="px-6 py-10 text-sm text-slate-500">Les rendez-vous privés sont masqués dans la prévisualisation.</div> : future.length ? <div className="divide-y divide-slate-100">{future.map(session => <Link key={session.id} to="/coach/sessions" className="group grid gap-3 px-5 py-4 sm:grid-cols-[120px_1fr_auto] sm:items-center"><span className="text-xs font-black text-[#0B746C]">{formatDate(sessionDate(session))}</span><span className="min-w-0"><strong className="block truncate text-sm font-black text-[#002050]">{learnerName(session)}</strong><span className="mt-1 block truncate text-xs text-slate-500">{session.offer_title_snapshot} · {statusLabel(session.status)}</span></span><ArrowRight size={15} className="text-slate-300 transition group-hover:translate-x-1" /></Link>)}</div> : <div className="flex items-center justify-between gap-4 px-6 py-9"><div><strong className="text-sm font-black text-[#002050]">Aucune séance future pour le moment</strong><p className="mt-1 text-xs text-slate-500">La prochaine réservation apparaîtra automatiquement ici.</p></div><Link to="/coach/calendrier" className="text-sm font-black text-[#0B746C]">Calendrier</Link></div>}</div>{!previewMode && completed.length > 0 && <div className="mt-6"><p className="text-xs font-black uppercase tracking-[0.15em] text-slate-400">Derniers accompagnements</p><div className="mt-3 flex flex-wrap gap-2">{completed.map(session => <Link key={session.id} to="/coach/sessions" className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-[#002050]">{learnerName(session)} · {formatDate(sessionDate(session), false)}</Link>)}</div></div>}</div><div><div className="grid gap-px overflow-hidden rounded-[24px] border border-slate-200 bg-slate-200 sm:grid-cols-2">{signals.map(signal => { const Icon = signal.icon; return <div key={signal.label} className="bg-white p-5"><Icon size={17} className="text-[#0B746C]"/><div className="mt-5 text-2xl font-black tracking-[-0.03em] text-[#002050]">{typeof signal.value === 'number' ? formatNumber(signal.value) : signal.value}</div><p className="mt-1 text-xs font-bold leading-5 text-slate-500">{signal.label}</p></div>; })}</div>{!previewMode && activeOffers.length > 0 && <div className="mt-6 rounded-[24px] border border-[#DCE6E3] bg-white p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[0.15em] text-[#675B9E]">Offres actives</p><h3 className="mt-1 text-lg font-black text-[#002050]">Ce qui est actuellement réservable</h3></div><Package size={18} className="text-[#675B9E]"/></div><div className="mt-4 divide-y divide-slate-100">{activeOffers.map(offer => <div key={offer.id} className="py-3"><strong className="block text-sm font-black text-[#002050]">{offer.title}</strong><span className="mt-1 block text-xs text-slate-500">{offer.duration_minutes ? `${offer.duration_minutes} min` : 'Durée personnalisée'}{offer.price_xof ? ` · ${formatXof(offer.price_xof)}` : ''}</span></div>)}</div></div>}</div></div></div></section>;
}

function ImprovementActions({ data, previewMode }: { data: DashboardData; previewMode: boolean }) {
  const actions = buildActions(data, previewMode);
  return <section className="border-t border-slate-200 bg-white"><div className="mx-auto max-w-7xl px-5 py-14 sm:px-6 lg:px-8"><div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr]"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#BF8813]">Continuité & qualité</p><h2 className="mt-2 text-3xl font-black tracking-[-0.035em] text-[#002050]">Ce qui peut améliorer votre pratique maintenant.</h2><p className="mt-4 max-w-md text-sm leading-7 text-slate-600">Ces propositions évoluent avec vos demandes, votre agenda, vos offres, votre profil et les retours reçus.</p></div><div className="divide-y divide-slate-200 border-y border-slate-200">{actions.map(action => { const Icon = action.icon; return <Link key={`${action.title}-${action.path}`} to={withPreview(action.path, previewMode)} className="group grid grid-cols-[auto_1fr_auto] items-start gap-4 py-5"><span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: `${action.accent}12`, color: action.accent }}><Icon size={18}/></span><span><strong className="block text-sm font-black text-[#002050]">{action.title}</strong><span className="mt-1.5 block text-xs leading-5 text-slate-500">{action.description}</span><span className="mt-2 block text-xs font-black" style={{ color: action.accent }}>{action.label}</span></span><ArrowRight size={15} className="mt-1 text-slate-300 transition group-hover:translate-x-1" /></Link>; })}</div></div></div></section>;
}

export default function CoachConnectedHomeSections({ previewMode }: Props) {
  const [data, setData] = useState<DashboardData>({});
  const [loading, setLoading] = useState(!previewMode);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (previewMode) {
      setData({});
      setLoading(false);
      setError('');
      return () => { active = false; };
    }
    setLoading(true);
    coachingRequest<DashboardData>('coach_dashboard')
      .then(payload => { if (active) { setData(payload || {}); setError(''); } })
      .catch(requestError => { if (active) setError(requestError instanceof Error ? requestError.message : 'Impossible de charger l’activité Coach.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [previewMode]);

  const availableRevenue = n(data.metrics?.available_revenue_xof);
  const hasContent = Boolean((data.recent_sessions || []).length || (data.offers || []).length || availableRevenue);
  const summary = useMemo(() => ({
    sessions: (data.recent_sessions || []).length,
    offers: (data.offers || []).length,
  }), [data.recent_sessions, data.offers]);
  void summary;

  return <>
    <CoachHero data={data} loading={loading} previewMode={previewMode} />
    {error && !previewMode && <section className="border-b border-amber-200 bg-amber-50"><div className="mx-auto max-w-7xl px-5 py-3 text-xs font-semibold text-amber-800 sm:px-6 lg:px-8">Certaines données Coaching n’ont pas pu être chargées : {error}</div></section>}
    <SpacesRail data={data} previewMode={previewMode} />
    <ActivityDigest data={data} previewMode={previewMode} />
    {!previewMode && !loading && !hasContent && <section className="bg-[#F7FAF9]"><div className="mx-auto max-w-7xl px-5 pb-10 sm:px-6 lg:px-8"><div className="rounded-[20px] border border-dashed border-[#BFD7D1] bg-white px-5 py-4 text-xs leading-5 text-slate-500">Dès que des offres, séances ou revenus apparaîtront dans votre activité, leur résumé sera automatiquement visible sur cette page.</div></div></section>}
    <ImprovementActions data={data} previewMode={previewMode} />
  </>;
}
