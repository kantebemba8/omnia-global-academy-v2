import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Heart,
  MessageCircle,
  Package,
  Radio,
  Sparkles,
  Star,
  User,
  Users,
  Video,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import {
  type CoachOffer,
  type CoachProfile,
  type CoachingSession,
  coachingRequest,
  formatXof,
} from '../../lib/coachingApi';

type Props = {
  previewMode: boolean;
};

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

type Space = {
  label: string;
  caption: string;
  path: string;
  accent: string;
  soft: string;
  icon: LucideIcon;
};

type Recommendation = {
  title: string;
  description: string;
  path: string;
  label: string;
  icon: LucideIcon;
};

const PETROL = '#0F766E';
const PETROL_DARK = '#0B4F54';
const BLUE = '#002050';
const GOLD = '#BF8813';

const SPACES: Space[] = [
  { label: 'Omnia Coaching', caption: 'Votre univers d’accompagnement, les offres et le catalogue', path: '/coaching', accent: '#0F766E', soft: '#E9F8F5', icon: Heart },
  { label: 'Omnia Communauté', caption: 'Prolonger les échanges et partager des ressources utiles', path: '/forum', accent: '#087F79', soft: '#E8F7F5', icon: MessageCircle },
  { label: 'Omnia Talent', caption: 'Votre présence professionnelle dans l’écosystème Omnia', path: '/talent', accent: '#7A5578', soft: '#F6EEF5', icon: Users },
  { label: 'Omnia Live', caption: 'Découvrir les événements et expériences en direct', path: '/omnia-live', accent: '#6257B8', soft: '#F0EEFF', icon: Radio },
];

function withPreview(path: string, previewMode: boolean) {
  if (!previewMode) return path;
  const [base, hash = ''] = path.split('#', 2);
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}preview=true${hash ? `#${hash}` : ''}`;
}

function numberValue(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function formatNumber(value: unknown) {
  return numberValue(value).toLocaleString('fr-FR');
}

function formatDate(value?: string | null, includeTime = true) {
  if (!value) return 'À planifier';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'À planifier';
  return new Intl.DateTimeFormat('fr-FR', includeTime
    ? { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
    : { day: 'numeric', month: 'short' }).format(date);
}

function sessionDate(session: CoachingSession) {
  return session.scheduled_start || session.requested_start || session.created_at;
}

function learnerName(session: CoachingSession) {
  return session.learner?.full_name?.trim() || 'Apprenant';
}

function statusLabel(status?: string | null) {
  const labels: Record<string, string> = {
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
    partially_refunded: 'Remboursement partiel',
    refunded: 'Remboursée',
    no_show_learner: 'Absence apprenant',
    no_show_coach: 'Absence coach',
  };
  const key = String(status || '');
  return labels[key] || key.replace(/_/g, ' ') || 'À suivre';
}

function statusTone(status?: string | null) {
  const value = String(status || '');
  if (['in_progress'].includes(value)) return { accent: '#C44259', soft: '#FFF0F3' };
  if (['confirmed', 'ready', 'completed'].includes(value)) return { accent: '#13795B', soft: '#EAF8F2' };
  if (['pending_coach', 'pending_payment'].includes(value)) return { accent: '#A56B12', soft: '#FFF7E6' };
  if (['disputed', 'no_show_coach', 'no_show_learner', 'cancelled_by_coach', 'cancelled_by_learner'].includes(value)) return { accent: '#C45B24', soft: '#FFF2E8' };
  return { accent: '#667085', soft: '#F2F4F7' };
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

function nextSession(sessions: CoachingSession[]) {
  const now = Date.now();
  return sessions
    .filter(session => {
      const date = sessionDate(session);
      if (!date) return false;
      const time = new Date(date).getTime();
      return Number.isFinite(time) && time >= now && !['cancelled_by_learner', 'cancelled_by_coach', 'declined_by_coach', 'expired', 'refunded'].includes(session.status);
    })
    .sort((a, b) => new Date(sessionDate(a) || 0).getTime() - new Date(sessionDate(b) || 0).getTime())[0] || null;
}

function buildRecommendations(data: DashboardData, previewMode: boolean): Recommendation[] {
  if (previewMode) {
    return [{
      title: 'Aperçu des recommandations Coach',
      description: 'En utilisation réelle, cette zone s’adapte à vos sessions, offres, avis et disponibilités.',
      path: '/coach/dashboard',
      label: 'Voir l’espace Coach',
      icon: Sparkles,
    }];
  }

  const metrics = data.metrics || {};
  const profile = data.profile;
  const offers = data.offers || [];
  const activeOffers = offers.filter(offer => offer.status === 'active');
  const recommendations: Recommendation[] = [];

  if (numberValue(metrics.pending_custom_requests) > 0) {
    recommendations.push({
      title: 'Répondre aux demandes personnalisées',
      description: `${formatNumber(metrics.pending_custom_requests)} demande${numberValue(metrics.pending_custom_requests) > 1 ? 's attendent' : ' attend'} votre décision avant la suite du parcours.`,
      path: '/coach/offres',
      label: 'Traiter les demandes',
      icon: MessageCircle,
    });
  }

  if (!activeOffers.length) {
    recommendations.push({
      title: 'Rendre une offre disponible',
      description: offers.length ? 'Vous avez déjà préparé des offres : vérifiez leur statut pour rendre votre accompagnement réservable.' : 'Créez une première offre claire avec durée, tarif et mode de session.',
      path: '/coach/offres',
      label: 'Gérer les offres',
      icon: Package,
    });
  }

  const completion = profileCompletion(profile);
  if (profile && completion < 100) {
    recommendations.push({
      title: 'Renforcer votre signature professionnelle',
      description: `Votre profil Coach est complété à environ ${completion} %. Ajoutez les éléments manquants pour mieux présenter votre expertise.`,
      path: '/mon-profil',
      label: 'Compléter mon profil',
      icon: User,
    });
  }

  if (activeOffers.length > 0 && numberValue(metrics.upcoming_sessions) === 0) {
    recommendations.push({
      title: 'Vérifier vos disponibilités',
      description: 'Des offres sont actives mais aucune session à venir n’apparaît actuellement. Vérifiez votre calendrier et vos créneaux.',
      path: '/coach/calendrier',
      label: 'Ouvrir le calendrier',
      icon: CalendarDays,
    });
  }

  if (numberValue(metrics.completed_sessions) > 0 && numberValue(metrics.average_rating) > 0) {
    recommendations.push({
      title: 'Exploiter les retours de vos accompagnements',
      description: 'Consultez vos avis pour identifier les points forts à conserver et les axes de progression utiles.',
      path: '/coach/avis',
      label: 'Voir les avis',
      icon: Star,
    });
  }

  if (numberValue(metrics.available_revenue_xof) > 0) {
    recommendations.push({
      title: 'Suivre vos revenus disponibles',
      description: `${formatXof(numberValue(metrics.available_revenue_xof))} apparaissent comme disponibles dans votre activité Coaching.`,
      path: '/coach/revenus',
      label: 'Voir mes revenus',
      icon: Wallet,
    });
  }

  if (!recommendations.length) {
    recommendations.push({
      title: 'Préparer votre prochaine séquence d’accompagnement',
      description: 'Votre activité ne présente pas de priorité urgente. Vous pouvez enrichir vos offres ou organiser vos prochaines disponibilités.',
      path: '/coach/calendrier',
      label: 'Préparer mon agenda',
      icon: Sparkles,
    });
  }

  return recommendations.slice(0, 4);
}

function Hero({ data, loading, previewMode }: { data: DashboardData; loading: boolean; previewMode: boolean }) {
  const sessions = data.recent_sessions || [];
  const metrics = data.metrics || {};
  const profile = data.profile;
  const upcoming = nextSession(sessions);
  const pending = sessions.filter(session => session.status === 'pending_coach');
  const inProgress = sessions.find(session => session.status === 'in_progress');

  let eyebrow = 'Votre accompagnement est à jour';
  let title = upcoming ? `Prochaine séance avec ${learnerName(upcoming)}` : 'Préparer votre prochain accompagnement';
  let description = upcoming
    ? `${formatDate(sessionDate(upcoming))} · ${upcoming.duration_minutes} min · ${upcoming.offer_title_snapshot}`
    : 'Organisez votre disponibilité, vos offres et vos prochains rendez-vous depuis votre espace Coach.';
  let path = upcoming ? '/coach/sessions' : '/coach/calendrier';
  let label = upcoming ? 'Préparer la séance' : 'Ouvrir mon calendrier';

  if (inProgress) {
    eyebrow = 'Séance en cours';
    title = `Accompagnement en direct avec ${learnerName(inProgress)}`;
    description = `${inProgress.offer_title_snapshot} · ${inProgress.duration_minutes} min`;
    path = `/coaching/sessions/${inProgress.id}/room`;
    label = 'Rejoindre la séance';
  } else if (pending.length || numberValue(metrics.pending_custom_requests) > 0) {
    const count = Math.max(pending.length, numberValue(metrics.pending_custom_requests));
    eyebrow = 'Réponse attendue';
    title = `${count} demande${count > 1 ? 's personnalisées' : ' personnalisée'} à examiner`;
    description = 'Ces demandes attendent votre réponse avant de pouvoir avancer vers la réservation et le paiement.';
    path = '/coach/offres';
    label = 'Examiner les demandes';
  } else if (profile?.status === 'vacation') {
    eyebrow = 'Mode vacances actif';
    title = 'Préparer votre reprise de disponibilité';
    description = 'Votre profil Coach est actuellement en vacances. Vérifiez votre calendrier avant votre prochaine période d’activité.';
    path = '/coach/calendrier';
    label = 'Gérer mes disponibilités';
  }

  const continuity = [
    { label: 'Demande', icon: MessageCircle, active: pending.length > 0 || numberValue(metrics.pending_custom_requests) > 0 },
    { label: 'Préparation', icon: CalendarDays, active: Boolean(upcoming) },
    { label: 'Séance', icon: Video, active: Boolean(inProgress) },
    { label: 'Suivi', icon: CheckCircle2, active: numberValue(metrics.completed_sessions) > 0 },
  ];

  return (
    <section className="relative overflow-hidden bg-[#082E3A] text-white">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 opacity-[0.075]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,.55) 1px, transparent 0)', backgroundSize: '30px 30px' }} />
        <div className="absolute -right-56 -top-64 h-[720px] w-[720px] rounded-full border border-white/10" />
        <div className="absolute -right-24 -top-32 h-[470px] w-[470px] rounded-full border border-[#62C6B7]/20" />
        <div className="absolute bottom-[-220px] right-[18%] h-[430px] w-[430px] rounded-full bg-[#0F766E]/35 blur-3xl" />
        <div className="absolute left-[36%] top-[20%] h-px w-[58%] -rotate-6 bg-gradient-to-r from-transparent via-[#8ADACB]/40 to-transparent" />
      </div>

      <div className="relative mx-auto grid min-h-[540px] max-w-7xl gap-10 px-5 py-14 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:px-8 lg:py-16">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-3 text-xs font-black uppercase tracking-[0.18em] text-white/55">
            <span className="h-2 w-2 rounded-full bg-[#70CDBD] shadow-[0_0_0_5px_rgba(112,205,189,.12)]" />
            Studio d’accompagnement
            {profile?.level?.badge_label && <span className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-[10px] tracking-[0.12em] text-[#B8E7DE]">{profile.level.badge_label}</span>}
          </div>
          <h1 className="mt-6 max-w-[760px] text-4xl font-black leading-[1.02] tracking-[-0.045em] sm:text-5xl lg:text-[3.55rem]">Accompagner avec continuité, pas seulement séance par séance.</h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-white/66 sm:text-lg">Votre accueil Coach rassemble ce qui doit être préparé, suivi et amélioré autour de vos accompagnements réels.</p>

          <div className="mt-9 max-w-2xl rounded-[28px] border border-white/12 bg-white/[0.065] p-5 shadow-[0_24px_80px_rgba(0,0,0,.16)] backdrop-blur-sm sm:p-6">
            <div className="flex items-start justify-between gap-5">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#91D8CC]">{previewMode ? 'Aperçu Coach' : loading ? 'Chargement de votre activité…' : eyebrow}</p>
                <h2 className="mt-2 text-xl font-black tracking-[-0.025em] text-white sm:text-2xl">{previewMode ? 'Une priorité adaptée à l’activité du Coach' : title}</h2>
                <p className="mt-3 text-sm leading-6 text-white/55">{previewMode ? 'En utilisation réelle, cette zone affiche la prochaine action utile sans exposer les données privées pendant la prévisualisation.' : description}</p>
              </div>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-[#0F766E]/35 text-[#9CE1D5]"><Heart size={22} /></span>
            </div>
            <Link to={withPreview(path, previewMode)} className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#A9E4D8] px-5 py-2.5 text-xs font-black text-[#073943] transition hover:-translate-y-0.5">
              {label}<ArrowRight size={14} />
            </Link>
          </div>
        </div>

        <div className="relative min-h-[430px]">
          <div className="absolute left-[8%] top-[8%] h-[360px] w-[360px] rounded-full border border-white/10 sm:left-[18%]" />
          <div className="absolute left-[17%] top-[17%] h-[285px] w-[285px] rounded-full border border-[#6FCDBD]/20 sm:left-[27%]" />
          <div className="absolute left-[29%] top-[30%] h-[190px] w-[190px] rounded-full bg-gradient-to-br from-[#0F766E]/55 to-[#143F52]/20 shadow-[0_28px_80px_rgba(0,0,0,.22)] sm:left-[39%]" />

          <div className="absolute left-[6%] top-[18%] w-[88%] rounded-[30px] border border-white/12 bg-[#0B3441]/88 p-5 shadow-[0_30px_80px_rgba(0,0,0,.22)] backdrop-blur-lg sm:left-[10%] sm:w-[80%] sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8CD9CC]">Fil de continuité</p><h3 className="mt-2 text-lg font-black">De la demande au suivi</h3></div>
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] font-bold text-white/55">{previewMode ? 'Aperçu' : `${formatNumber(metrics.upcoming_sessions)} à venir`}</span>
            </div>

            <div className="relative mt-7 grid grid-cols-4 gap-2">
              <div className="absolute left-[11%] right-[11%] top-[18px] h-px bg-white/12" />
              {continuity.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.label} className="relative z-10 text-center">
                    <span className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full border ${step.active ? 'border-[#8EE1D2] bg-[#0F766E] text-white shadow-[0_0_0_5px_rgba(15,118,110,.18)]' : 'border-white/14 bg-[#0A2B37] text-white/42'}`}><Icon size={15} /></span>
                    <span className={`mt-3 block text-[10px] font-black ${step.active ? 'text-[#B6EADF]' : 'text-white/38'}`}>{step.label}</span>
                    <span className="mt-1 block text-[9px] text-white/28">0{index + 1}</span>
                  </div>
                );
              })}
            </div>

            <div className="mt-7 grid grid-cols-3 gap-3 border-t border-white/10 pt-5">
              <div><span className="text-[9px] font-black uppercase tracking-[0.12em] text-white/35">Sessions terminées</span><strong className="mt-1 block text-xl font-black text-white">{previewMode ? '—' : formatNumber(metrics.completed_sessions)}</strong></div>
              <div><span className="text-[9px] font-black uppercase tracking-[0.12em] text-white/35">Note moyenne</span><strong className="mt-1 block text-xl font-black text-white">{previewMode ? '—' : numberValue(metrics.average_rating).toFixed(1)}</strong></div>
              <div><span className="text-[9px] font-black uppercase tracking-[0.12em] text-white/35">Revenu disponible</span><strong className="mt-1 block truncate text-sm font-black text-[#F0C565] sm:text-base">{previewMode ? '—' : formatXof(numberValue(metrics.available_revenue_xof))}</strong></div>
            </div>
          </div>

          <span className="absolute bottom-[4%] left-[5%] h-14 w-14 rotate-6 rounded-[20px] border border-white/10 bg-[#0F766E]/55 shadow-[0_18px_45px_rgba(0,0,0,.25)]" />
          <span className="absolute right-[4%] top-[10%] h-10 w-10 -rotate-12 rounded-2xl border border-[#BF8813]/35 bg-[#BF8813]/22" />
        </div>
      </div>
    </section>
  );
}

function SpacesStrip({ previewMode }: { previewMode: boolean }) {
  return (
    <section className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0F766E]">Vos espaces Omnia</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#002050]">Passez directement à l’univers dont vous avez besoin.</h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-slate-500">Cette bande ne remplace aucun menu : elle sert uniquement de raccourci vers les écosystèmes accessibles au Coach.</p>
        </div>

        <div className="mt-6 flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SPACES.map(space => {
            const Icon = space.icon;
            return (
              <Link key={space.label} to={withPreview(space.path, previewMode)} className="group relative min-w-[245px] flex-1 overflow-hidden rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_12px_28px_rgba(0,32,80,.05)] transition hover:-translate-y-1 hover:shadow-[0_18px_36px_rgba(0,32,80,.09)]">
                <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full opacity-70" style={{ background: `radial-gradient(circle, ${space.soft}, transparent 70%)` }} />
                <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl" style={{ color: space.accent, background: space.soft }}><Icon size={20} /></span>
                <strong className="relative mt-5 block text-sm font-black text-[#002050]">{space.label}</strong>
                <span className="relative mt-1.5 block text-xs leading-5 text-slate-500">{space.caption}</span>
                <ArrowRight size={16} className="absolute bottom-5 right-5 text-slate-300 transition group-hover:translate-x-1" />
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function PracticePulse({ data, previewMode }: { data: DashboardData; previewMode: boolean }) {
  const metrics = data.metrics || {};
  const offers = data.offers || [];
  const activeOffers = offers.filter(offer => offer.status === 'active').length;
  const profile = data.profile;

  const items = [
    { label: 'Sessions à venir', value: previewMode ? '—' : formatNumber(metrics.upcoming_sessions), icon: CalendarDays, accent: PETROL },
    { label: 'Accompagnements terminés', value: previewMode ? '—' : formatNumber(metrics.completed_sessions), icon: CheckCircle2, accent: '#13795B' },
    { label: 'Offres actives', value: previewMode ? '—' : formatNumber(activeOffers), icon: Package, accent: '#7650C5' },
    { label: 'Note moyenne', value: previewMode ? '—' : numberValue(metrics.average_rating).toFixed(1), icon: Star, accent: GOLD },
  ];

  return (
    <section className="bg-[#F7FAFA]">
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-7 xl:grid-cols-[0.72fr_1.28fr] xl:items-stretch">
          <div className="rounded-[30px] border border-[#DCE9E7] bg-[#EAF7F4] p-6 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#0F766E]">Votre signature de Coach</p><h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#002050]">Une présence professionnelle lisible.</h2></div>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#0F766E] shadow-sm"><BadgeCheck size={20} /></span>
            </div>
            {previewMode ? (
              <p className="mt-6 text-sm leading-7 text-slate-600">La prévisualisation conserve la structure du profil sans charger les informations privées d’un Coach.</p>
            ) : (
              <>
                <div className="mt-6 flex items-center gap-4">
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[#0F766E] text-lg font-black text-white">{(profile?.full_name || 'C').slice(0, 1).toUpperCase()}</span>
                  <div className="min-w-0"><strong className="block truncate text-base font-black text-[#002050]">{profile?.full_name || 'Profil Coach'}</strong><span className="mt-1 block truncate text-xs text-slate-500">{profile?.professional_title || 'Titre professionnel à compléter'}</span></div>
                </div>
                <div className="mt-6 flex flex-wrap gap-2">
                  {(profile?.domains || []).slice(0, 4).map(domain => <span key={domain.id} className="rounded-full border border-[#C7E2DD] bg-white px-3 py-1.5 text-[10px] font-black text-[#0B5F58]">{domain.name}</span>)}
                  {!(profile?.domains || []).length && <span className="text-xs text-slate-500">Aucun domaine affiché pour le moment.</span>}
                </div>
                <div className="mt-6 h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-[#0F766E]" style={{ width: `${profileCompletion(profile)}%` }} /></div>
                <div className="mt-2 flex justify-between gap-4 text-[10px] font-bold text-slate-500"><span>Complétude du profil</span><span>{profileCompletion(profile)} %</span></div>
              </>
            )}
            <Link to={withPreview('/mon-profil', previewMode)} className="mt-6 inline-flex items-center gap-2 text-xs font-black text-[#0F766E]">Voir mon profil <ArrowRight size={14} /></Link>
          </div>

          <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_20px_50px_rgba(0,32,80,.05)] sm:p-7">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#0F766E]">Activité</p><h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#002050]">Les signaux utiles de votre pratique.</h2></div>
              <Link to={withPreview('/coach/dashboard', previewMode)} className="inline-flex items-center gap-2 text-xs font-black text-[#0F766E]">Ouvrir l’espace Coach <ArrowRight size={14} /></Link>
            </div>
            <div className="mt-7 grid gap-0 overflow-hidden rounded-[22px] border border-slate-200 sm:grid-cols-2 lg:grid-cols-4">
              {items.map((item, index) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className={`min-h-[145px] bg-[#FBFCFD] p-5 ${index > 0 ? 'border-t border-slate-200 sm:border-t-0 sm:border-l' : ''} ${index === 2 ? 'lg:border-l' : ''}`}>
                    <div className="flex items-center justify-between gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm" style={{ color: item.accent }}><Icon size={17} /></span><span className="text-2xl font-black tracking-[-0.04em] text-[#002050]">{item.value}</span></div>
                    <p className="mt-6 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{item.label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ScheduleAndContinuity({ data, previewMode }: { data: DashboardData; previewMode: boolean }) {
  const sessions = data.recent_sessions || [];
  const now = Date.now();
  const upcoming = sessions
    .filter(session => {
      const date = sessionDate(session);
      if (!date) return false;
      const time = new Date(date).getTime();
      return Number.isFinite(time) && time >= now && !['cancelled_by_learner', 'cancelled_by_coach', 'declined_by_coach', 'expired', 'refunded'].includes(session.status);
    })
    .sort((a, b) => new Date(sessionDate(a) || 0).getTime() - new Date(sessionDate(b) || 0).getTime())
    .slice(0, 4);
  const recentCompleted = sessions
    .filter(session => ['completed', 'no_show_learner', 'no_show_coach'].includes(session.status))
    .sort((a, b) => new Date(sessionDate(b) || 0).getTime() - new Date(sessionDate(a) || 0).getTime())
    .slice(0, 4);

  return (
    <section className="bg-white">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-8 xl:grid-cols-[1.08fr_0.92fr]">
          <div>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#0F766E]">Votre agenda</p><h2 className="mt-2 text-3xl font-black tracking-[-0.035em] text-[#002050]">Les prochains rendez-vous, dans l’ordre utile.</h2></div>
              <Link to={withPreview('/coach/sessions', previewMode)} className="inline-flex items-center gap-2 text-xs font-black text-[#0F766E]">Toutes les sessions <ArrowRight size={14} /></Link>
            </div>

            <div className="relative mt-7 border-l border-[#DCE8E6] pl-6">
              {previewMode ? (
                <div className="relative py-5"><span className="absolute -left-[31px] top-7 h-3 w-3 rounded-full border-4 border-white bg-[#0F766E] shadow-[0_0_0_1px_#BFD8D3]" /><strong className="text-sm font-black text-[#002050]">Aperçu de l’agenda Coach</strong><p className="mt-1 text-xs leading-5 text-slate-500">Les vrais rendez-vous ne sont pas chargés pendant la prévisualisation Super-admin.</p></div>
              ) : upcoming.length ? upcoming.map((session, index) => {
                const tone = statusTone(session.status);
                return (
                  <Link key={session.id} to="/coach/sessions" className="group relative grid gap-4 border-b border-slate-100 py-5 last:border-0 sm:grid-cols-[122px_1fr_auto] sm:items-center">
                    <span className="absolute -left-[31px] top-7 h-3 w-3 rounded-full border-4 border-white shadow-[0_0_0_1px_#BFD8D3]" style={{ backgroundColor: index === 0 ? PETROL : '#AFC9C4' }} />
                    <div><strong className="block text-sm font-black text-[#002050]">{formatDate(sessionDate(session), false)}</strong><span className="mt-1 block text-[10px] font-bold text-slate-400">{formatDate(sessionDate(session)).split(',').pop()?.trim()}</span></div>
                    <div className="min-w-0"><strong className="block truncate text-sm font-black text-[#002050]">{learnerName(session)}</strong><span className="mt-1 block truncate text-xs text-slate-500">{session.offer_title_snapshot} · {session.duration_minutes} min</span></div>
                    <span className="inline-flex w-fit rounded-full px-3 py-1 text-[10px] font-black" style={{ color: tone.accent, backgroundColor: tone.soft }}>{statusLabel(session.status)}</span>
                  </Link>
                );
              }) : (
                <Link to="/coach/calendrier" className="group relative flex items-start gap-4 py-6"><span className="absolute -left-[31px] top-8 h-3 w-3 rounded-full border-4 border-white bg-[#0F766E] shadow-[0_0_0_1px_#BFD8D3]" /><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E9F8F5] text-[#0F766E]"><CalendarDays size={18} /></span><span className="min-w-0 flex-1"><strong className="block text-sm font-black text-[#002050]">Aucune session à venir détectée</strong><span className="mt-1 block text-xs leading-5 text-slate-500">Ouvrez votre calendrier pour vérifier ou enrichir vos disponibilités.</span></span><ArrowRight size={15} className="mt-2 text-slate-300 transition group-hover:translate-x-1" /></Link>
              )}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[32px] border border-[#D7E5E2] bg-[#F1F8F7] p-6 sm:p-7">
            <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full border border-[#0F766E]/10" />
            <div className="relative">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0F766E]">Continuité</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#002050]">Ne pas perdre le fil après la séance.</h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">Les derniers accompagnements servent de repère pour revenir rapidement sur les séances déjà réalisées et leurs suites.</p>

              <div className="mt-7 divide-y divide-[#D8E6E3] border-y border-[#D8E6E3]">
                {previewMode ? (
                  <div className="py-5 text-sm text-slate-500">La prévisualisation affiche la structure de la continuité sans données privées.</div>
                ) : recentCompleted.length ? recentCompleted.map(session => (
                  <Link key={session.id} to={`/coaching/sessions/${session.id}/suivi`} className="group flex items-center gap-4 py-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#0F766E] shadow-sm"><CheckCircle2 size={16} /></span>
                    <span className="min-w-0 flex-1"><strong className="block truncate text-sm font-black text-[#002050]">{learnerName(session)}</strong><span className="mt-1 block truncate text-xs text-slate-500">{session.offer_title_snapshot} · {formatDate(sessionDate(session), false)}</span></span>
                    <ArrowRight size={15} className="text-slate-300 transition group-hover:translate-x-1" />
                  </Link>
                )) : (
                  <div className="py-5"><strong className="text-sm font-black text-[#002050]">Aucun accompagnement clôturé à afficher</strong><p className="mt-1 text-xs leading-5 text-slate-500">Les séances terminées apparaîtront ici pour faciliter le suivi.</p></div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function AttentionAndImprovements({ data, previewMode }: { data: DashboardData; previewMode: boolean }) {
  const sessions = data.recent_sessions || [];
  const metrics = data.metrics || {};
  const recommendations = useMemo(() => buildRecommendations(data, previewMode), [data, previewMode]);
  const next = nextSession(sessions);
  const pending = sessions.filter(session => session.status === 'pending_coach');
  const disputed = sessions.filter(session => session.status === 'disputed');

  const attention = previewMode
    ? [{ title: 'Aperçu des priorités Coach', description: 'Les actions privées ne sont pas chargées dans la prévisualisation.', path: '/coach/dashboard', icon: Heart, accent: PETROL, soft: '#E9F8F5' }]
    : disputed.length
      ? disputed.slice(0, 3).map(session => ({ title: learnerName(session), description: 'Cette séance est actuellement en vérification administrative.', path: '/coach/sessions', icon: Clock3, accent: '#C45B24', soft: '#FFF2E8' }))
      : pending.length || numberValue(metrics.pending_custom_requests) > 0
        ? [{ title: `${Math.max(pending.length, numberValue(metrics.pending_custom_requests))} demande${Math.max(pending.length, numberValue(metrics.pending_custom_requests)) > 1 ? 's' : ''} à examiner`, description: 'Répondez avant que ces demandes puissent avancer vers la prochaine étape.', path: '/coach/offres', icon: MessageCircle, accent: '#A56B12', soft: '#FFF7E6' }]
        : next
          ? [{ title: `Préparer la séance avec ${learnerName(next)}`, description: `${formatDate(sessionDate(next))} · ${next.offer_title_snapshot}`, path: '/coach/sessions', icon: CalendarDays, accent: PETROL, soft: '#E9F8F5' }]
          : [{ title: 'Aucune priorité urgente détectée', description: 'Votre activité ne présente pas d’action immédiate dans les données actuellement disponibles.', path: '/coach/dashboard', icon: CheckCircle2, accent: '#13795B', soft: '#EAF8F2' }];

  return (
    <section className="bg-[#F7F8FA]">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-8 xl:grid-cols-2">
          <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_20px_50px_rgba(0,32,80,.05)] sm:p-7">
            <div className="flex items-center justify-between gap-4">
              <div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#C47B3B]">À traiter</p><h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#002050]">Ce qui mérite votre attention.</h2></div>
              <Clock3 size={20} className="text-slate-300" />
            </div>
            <div className="mt-6 divide-y divide-slate-100 border-y border-slate-100">
              {attention.map(item => {
                const Icon = item.icon;
                return (
                  <Link key={`${item.path}-${item.title}`} to={withPreview(item.path, previewMode)} className="group flex items-start gap-4 py-5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ color: item.accent, backgroundColor: item.soft }}><Icon size={18} /></span>
                    <span className="min-w-0 flex-1"><strong className="block text-sm font-black text-[#002050]">{item.title}</strong><span className="mt-1 block text-xs leading-5 text-slate-500">{item.description}</span></span>
                    <ArrowRight size={15} className="mt-2 shrink-0 text-slate-300 transition group-hover:translate-x-1" />
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[30px] border border-[#BDD8D3] bg-[#0B3F46] p-6 text-white shadow-[0_24px_60px_rgba(11,63,70,.14)] sm:p-7">
            <div className="pointer-events-none absolute -right-24 -top-28 h-64 w-64 rounded-full border border-white/10" aria-hidden="true" />
            <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-[#0F766E]/30 blur-xl" aria-hidden="true" />
            <div className="relative">
              <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#9BDFD2]">Progresser</p><h2 className="mt-2 text-2xl font-black tracking-[-0.03em]">Améliorer votre pratique</h2></div><Sparkles size={20} className="text-[#F0C565]" /></div>
              <p className="mt-3 max-w-lg text-xs leading-6 text-white/55">Les propositions ci-dessous sont déclenchées uniquement par les informations réellement disponibles dans votre activité Coaching.</p>
              <div className="mt-6 divide-y divide-white/10 border-y border-white/10">
                {recommendations.map(item => {
                  const Icon = item.icon;
                  return (
                    <Link key={`${item.path}-${item.title}`} to={withPreview(item.path, previewMode)} className="group flex items-start gap-4 py-5">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[#B8E8DF]"><Icon size={18} /></span>
                      <span className="min-w-0 flex-1"><strong className="block text-sm font-black text-white">{item.title}</strong><span className="mt-1 block text-xs leading-5 text-white/50">{item.description}</span><span className="mt-2 inline-flex items-center gap-1 text-[11px] font-black text-[#F0C565]">{item.label}<ArrowRight size={12} /></span></span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function OfferRail({ data, previewMode }: { data: DashboardData; previewMode: boolean }) {
  const offers = (data.offers || []).slice(0, 4);
  if (!previewMode && !offers.length) return null;

  return (
    <section className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#0F766E]">Vos offres</p><h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#002050]">Des accompagnements clairs et directement lisibles.</h2></div>
          <Link to={withPreview('/coach/offres', previewMode)} className="inline-flex items-center gap-2 text-xs font-black text-[#0F766E]">Gérer mes offres <ArrowRight size={14} /></Link>
        </div>

        <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {previewMode ? [0, 1, 2].map(index => (
            <div key={index} className="rounded-[22px] border border-slate-200 bg-[#FAFCFC] p-5"><div className="h-10 w-10 rounded-2xl bg-[#E9F8F5]" /><div className="mt-5 h-4 w-2/3 rounded bg-slate-200" /><div className="mt-3 h-3 w-full rounded bg-slate-100" /><div className="mt-2 h-3 w-4/5 rounded bg-slate-100" /></div>
          )) : offers.map(offer => {
            const active = offer.status === 'active';
            return (
              <Link key={offer.id} to="/coach/offres" className="group rounded-[22px] border border-slate-200 bg-[#FAFCFC] p-5 transition hover:-translate-y-1 hover:shadow-[0_16px_34px_rgba(0,32,80,.07)]">
                <div className="flex items-center justify-between gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#E9F8F5] text-[#0F766E]"><Package size={18} /></span><span className="rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em]" style={{ color: active ? '#13795B' : '#667085', backgroundColor: active ? '#EAF8F2' : '#F2F4F7' }}>{active ? 'Active' : offer.status.replace(/_/g, ' ')}</span></div>
                <strong className="mt-5 block line-clamp-2 text-sm font-black text-[#002050]">{offer.title}</strong>
                <span className="mt-2 block line-clamp-2 text-xs leading-5 text-slate-500">{offer.description}</span>
                <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-200 pt-4"><span className="text-xs font-black text-[#0F766E]">{offer.price_xof != null ? formatXof(offer.price_xof) : offer.hourly_price_xof != null ? `${formatXof(offer.hourly_price_xof)}/h` : 'Tarif personnalisé'}</span><ArrowRight size={15} className="text-slate-300 transition group-hover:translate-x-1" /></div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
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
      .then(payload => {
        if (!active) return;
        setData(payload || {});
        setError('');
      })
      .catch(caught => {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : 'Impossible de charger l’activité Coach.');
      })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [previewMode]);

  return (
    <>
      <Hero data={data} loading={loading} previewMode={previewMode} />
      {error && !previewMode && (
        <section className="border-b border-amber-200 bg-amber-50">
          <div className="mx-auto max-w-7xl px-5 py-3 text-xs font-semibold text-amber-800 sm:px-6 lg:px-8">Certaines données Coaching n’ont pas pu être chargées : {error}</div>
        </section>
      )}
      <SpacesStrip previewMode={previewMode} />
      <PracticePulse data={data} previewMode={previewMode} />
      <ScheduleAndContinuity data={data} previewMode={previewMode} />
      <AttentionAndImprovements data={data} previewMode={previewMode} />
      <OfferRail data={data} previewMode={previewMode} />
    </>
  );
}
