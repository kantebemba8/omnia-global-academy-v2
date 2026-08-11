import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Film,
  Megaphone,
  MessageCircle,
  PlayCircle,
  Radio,
  Sparkles,
  Star,
  Ticket,
  Users,
  Video,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { liveStatusLabel, deliveryLabel } from '../../lib/omniaLiveLabels';
import { liveApi, type LiveItem } from '../../pages/omnia-live/liveApi';

type Props = {
  previewMode: boolean;
};

type OrganizerKpis = {
  total_events?: number | null;
  draft?: number | null;
  pending_review?: number | null;
  published?: number | null;
  live_now?: number | null;
  completed?: number | null;
  registrations?: number | null;
  paid_orders?: number | null;
  gross_revenue?: number | null;
  organizer_revenue?: number | null;
  available_payout?: number | null;
  media_processing?: number | null;
  active_rooms?: number | null;
  average_rating?: number | null;
};

type OrganizerSnapshot = {
  kpis: OrganizerKpis;
  recentEvents: LiveItem[];
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


const EMPTY_SNAPSHOT: OrganizerSnapshot = { kpis: {}, recentEvents: [] };

const SPACES: Space[] = [
  { label: 'Omnia Live', caption: 'Explorer l’univers public, les prochains Lives et les replays', path: '/omnia-live', accent: '#6B5BD2', soft: '#F0EEFF', icon: Radio },
  { label: 'Omnia Communauté', caption: 'Prolonger les échanges avant et après vos événements', path: '/forum', accent: '#0D8277', soft: '#EAF8F6', icon: MessageCircle },
  { label: 'Omnia Talent', caption: 'Découvrir les profils et l’écosystème professionnel Omnia', path: '/talent', accent: '#9A4B74', soft: '#FAEEF4', icon: Users },
];

function withPreview(path: string, previewMode: boolean) {
  if (!previewMode) return path;
  const [base, hash = ''] = path.split('#', 2);
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}preview=true${hash ? `#${hash}` : ''}`;
}

function count(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function formatNumber(value: unknown) {
  return count(value).toLocaleString('fr-FR');
}

function formatDate(value?: string | null) {
  if (!value) return 'Date à définir';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date à définir';
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
}

function statusTone(status?: string | null) {
  const value = String(status || 'draft');
  if (value === 'live') return { accent: '#D83B4D', soft: '#FFF0F2' };
  if (value === 'published' || value === 'approved' || value === 'completed') return { accent: '#13795B', soft: '#EAF8F2' };
  if (value === 'changes_requested' || value === 'rejected' || value === 'suspended') return { accent: '#C45B24', soft: '#FFF2E8' };
  if (value === 'submitted' || value === 'under_review') return { accent: '#A56B12', soft: '#FFF7E6' };
  return { accent: '#667085', soft: '#F1F5F9' };
}

function buildRecommendations(snapshot: OrganizerSnapshot, previewMode: boolean): Recommendation[] {
  if (previewMode) {
    return [
      { title: 'Aperçu des recommandations', description: 'En utilisation réelle, cette zone s’adapte aux événements, participants et signaux de production de l’organisateur.', path: '/omnia-live/organisateur', label: 'Voir l’espace Organisateur', icon: Sparkles },
    ];
  }

  const k = snapshot.kpis;
  const recommendations: Recommendation[] = [];
  const changes = snapshot.recentEvents.filter(event => event.status === 'changes_requested').length;

  if (count(k.total_events) === 0) {
    recommendations.push({ title: 'Lancer votre première programmation', description: 'Créez un événement puis préparez-le dans le Studio Omnia Live avant sa soumission.', path: '/omnia-live/proposer', label: 'Proposer un Live', icon: Video });
  }
  if (changes > 0) {
    recommendations.push({ title: 'Reprendre les événements à modifier', description: `${changes} événement${changes > 1 ? 's demandent' : ' demande'} une correction avant de poursuivre le cycle de publication.`, path: '/omnia-live/organisateur/evenements', label: 'Voir les événements', icon: CheckCircle2 });
  }
  if (count(k.draft) > 0) {
    recommendations.push({ title: 'Finaliser vos brouillons', description: `${formatNumber(k.draft)} brouillon${count(k.draft) > 1 ? 's sont' : ' est'} encore en préparation.`, path: '/omnia-live/organisateur/evenements', label: 'Reprendre le Studio', icon: PlayCircle });
  }
  if (count(k.published) > 0 && count(k.registrations) === 0) {
    recommendations.push({ title: 'Développer votre audience', description: 'Des événements sont publiés mais aucune inscription confirmée n’apparaît encore. Préparez vos communications.', path: '/omnia-live/organisateur/communications', label: 'Préparer les communications', icon: Megaphone });
  }
  if (count(k.media_processing) > 0) {
    recommendations.push({ title: 'Suivre les médias en traitement', description: `${formatNumber(k.media_processing)} média${count(k.media_processing) > 1 ? 's sont' : ' est'} encore en cours de traitement.`, path: '/omnia-live/organisateur/medias', label: 'Voir les médias', icon: Film });
  }
  if (count(k.completed) > 0) {
    recommendations.push({ title: 'Transformer vos Lives en apprentissages', description: 'Analysez les événements terminés pour identifier les formats, audiences et résultats à reproduire.', path: '/omnia-live/organisateur/statistiques', label: 'Ouvrir l’analytique', icon: BarChart3 });
  }
  if (count(k.organizer_revenue) > 0 || count(k.available_payout) > 0) {
    recommendations.push({ title: 'Suivre la performance commerciale', description: 'Votre activité Live génère des mouvements financiers. Consultez vos revenus et disponibilités.', path: '/omnia-live/revenus', label: 'Voir les revenus', icon: Wallet });
  }

  if (!recommendations.length) {
    recommendations.push({ title: 'Préparer votre prochaine expérience Live', description: 'Votre espace ne présente pas de priorité urgente. Vous pouvez préparer une nouvelle programmation ou enrichir un événement existant.', path: '/omnia-live/proposer', label: 'Créer un événement', icon: Sparkles });
  }

  return recommendations.slice(0, 4);
}

function Hero({ snapshot, loading, previewMode }: { snapshot: OrganizerSnapshot; loading: boolean; previewMode: boolean }) {
  const k = snapshot.kpis;
  const now = Date.now();
  const futureEvents = snapshot.recentEvents
    .filter(event => event.starts_at && new Date(event.starts_at).getTime() > now && !['cancelled', 'rejected'].includes(String(event.status || '')))
    .sort((a, b) => new Date(a.starts_at || 0).getTime() - new Date(b.starts_at || 0).getTime());
  const changes = snapshot.recentEvents.filter(event => event.status === 'changes_requested').length;
  const nextEvent = futureEvents[0] || null;

  let eyebrow = 'Votre programmation est à jour';
  let priorityTitle = nextEvent ? `Prochain rendez-vous : ${nextEvent.title}` : 'Créer la prochaine expérience Omnia Live';
  let priorityText = nextEvent ? `${formatDate(nextEvent.starts_at)} · ${deliveryLabel(nextEvent.delivery_type)}` : 'Préparez un nouvel événement, son audience et son expérience de diffusion dans Omnia Live.';
  let priorityPath = nextEvent ? `/omnia-live/organisateur/evenements/${nextEvent.id}` : '/omnia-live/proposer';
  let priorityLabel = nextEvent ? 'Préparer cet événement' : 'Proposer un événement';

  if (count(k.live_now) > 0) {
    eyebrow = 'En direct maintenant';
    const live = snapshot.recentEvents.find(event => event.status === 'live');
    priorityTitle = live?.title || `${formatNumber(k.live_now)} Live en cours`;
    priorityText = 'Votre priorité est la diffusion et le suivi de l’audience en temps réel.';
    priorityPath = live?.id ? `/omnia-live/${live.id}/organiser` : '/omnia-live/organisateur/evenements';
    priorityLabel = 'Ouvrir la salle Live';
  } else if (changes > 0) {
    eyebrow = 'Action requise';
    priorityTitle = `${changes} événement${changes > 1 ? 's' : ''} à reprendre`;
    priorityText = 'Des modifications ont été demandées avant la prochaine étape de publication.';
    priorityPath = '/omnia-live/organisateur/evenements';
    priorityLabel = 'Voir les corrections';
  } else if (count(k.draft) > 0) {
    eyebrow = 'Production en cours';
    priorityTitle = `${formatNumber(k.draft)} brouillon${count(k.draft) > 1 ? 's' : ''} à finaliser`;
    priorityText = 'Reprenez le Studio pour compléter la programmation, les intervenants, ressources et paramètres utiles.';
    priorityPath = '/omnia-live/organisateur/evenements';
    priorityLabel = 'Reprendre la production';
  }

  const stages = [
    { label: 'Préparer', value: count(k.draft), accent: '#A9A4FF' },
    { label: 'Validation', value: count(k.pending_review), accent: '#F0C565' },
    { label: 'Publiés', value: count(k.published), accent: '#8CD7BF' },
    { label: 'En direct', value: count(k.live_now), accent: '#FF7A8A' },
    { label: 'Terminés', value: count(k.completed), accent: '#BFC7D9' },
  ];

  return (
    <section className="relative overflow-hidden bg-[#111735] text-white">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.12) 1px, transparent 1px)', backgroundSize: '56px 56px' }} />
        <div className="absolute -right-[180px] -top-[240px] h-[660px] w-[660px] rounded-full border border-white/10" />
        <div className="absolute -right-[60px] -top-[100px] h-[430px] w-[430px] rounded-full border border-[#8E7EF0]/25" />
        <div className="absolute bottom-[-260px] left-[8%] h-[520px] w-[520px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(107,91,210,.36), rgba(107,91,210,.08) 48%, transparent 72%)' }} />
        <div className="absolute right-[24%] top-[16%] h-48 w-48 rotate-12 rounded-[56px] bg-[#BF8813]/10 blur-2xl" />
      </div>

      <div className="relative mx-auto grid min-h-[570px] max-w-7xl gap-12 px-5 py-14 sm:px-6 lg:grid-cols-[0.94fr_1.06fr] lg:items-center lg:px-8 lg:py-16">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#B9B2FF]"><span className="h-2 w-2 rounded-full bg-[#BF8813]" /> Omnia Live · Organisateur</span>
            {previewMode && <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-black text-white/70">Aperçu du rôle Organisateur</span>}
          </div>
          <h1 className="mt-5 max-w-[780px] text-4xl font-black leading-[1.01] tracking-[-0.05em] sm:text-5xl lg:text-[3.65rem]">Votre scène, votre audience, votre prochaine action.</h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">Une page d’accueil événementielle pour voir ce qui se prépare, ce qui se diffuse et ce qui mérite votre attention avant d’entrer dans les outils détaillés d’Omnia Live.</p>

          <div className="mt-8 max-w-2xl border-l-2 border-[#BF8813] pl-5">
            <div className="text-xs font-black uppercase tracking-[0.16em] text-[#F0C565]">{previewMode ? 'Aperçu de priorité' : loading ? 'Synchronisation…' : eyebrow}</div>
            <div className="mt-2 text-xl font-black tracking-[-0.02em] text-white">{previewMode ? 'Les priorités réelles apparaissent ici selon l’activité Live.' : priorityTitle}</div>
            <p className="mt-2 text-sm leading-6 text-white/60">{previewMode ? 'Aucune donnée privée Organisateur n’est chargée pendant la prévisualisation.' : priorityText}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link to={withPreview(previewMode ? '/omnia-live/organisateur' : priorityPath, previewMode)} className="inline-flex items-center gap-2 rounded-full bg-[#BF8813] px-5 py-3 text-sm font-black text-[#111735] transition hover:-translate-y-0.5">{previewMode ? 'Explorer l’espace Organisateur' : priorityLabel}<ArrowRight size={16} /></Link>
              <Link to={withPreview(previewMode ? '/omnia-live/organisateur/evenements' : '/omnia-live/proposer', previewMode)} className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.07] px-5 py-3 text-sm font-bold text-white transition hover:bg-white/[0.12]">{previewMode ? 'Voir la programmation' : 'Créer un nouvel événement'}<Video size={16} /></Link>
            </div>
          </div>
        </div>

        <div className="relative mx-auto h-[410px] w-full max-w-[590px]" aria-label="Illustration abstraite d’une régie événementielle Omnia Live">
          <div className="absolute left-1/2 top-1/2 h-[296px] w-[470px] -translate-x-1/2 -translate-y-1/2 -rotate-[5deg] rounded-[42px] border border-white/10 bg-white/[0.025] shadow-[0_42px_100px_rgba(0,0,0,.28)]" />
          <div className="absolute left-1/2 top-1/2 h-[286px] w-[458px] -translate-x-1/2 -translate-y-1/2 rotate-[3deg] rounded-[40px] border border-[#8E7EF0]/25 bg-[#181D43]/70" />
          <div className="absolute left-1/2 top-1/2 w-[425px] -translate-x-1/2 -translate-y-1/2 rounded-[34px] border border-white/10 bg-[#141A3B]/95 p-6 shadow-[0_28px_75px_rgba(0,0,0,.34)]">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-5">
              <div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">Régie Omnia Live</div><div className="mt-1 text-sm font-black text-white">Cycle de votre programmation</div></div>
              <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${count(k.live_now) > 0 && !previewMode ? 'bg-[#D83B4D]' : 'bg-[#6B5BD2]'}`}><Radio size={18} /></span>
            </div>
            <div className="mt-6 space-y-4">
              {stages.map((stage, index) => (
                <div key={stage.label} className="grid grid-cols-[74px_1fr_34px] items-center gap-3">
                  <span className="text-[11px] font-bold text-white/50">{stage.label}</span>
                  <div className="relative h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: previewMode ? `${38 + index * 9}%` : `${Math.min(100, 22 + stage.value * 16)}%`, backgroundColor: stage.accent }} />
                  </div>
                  <span className="text-right text-xs font-black" style={{ color: stage.accent }}>{previewMode ? '—' : stage.value}</span>
                </div>
              ))}
            </div>
            <div className="mt-7 grid grid-cols-3 gap-3 border-t border-white/10 pt-5">
              <div><span className="block text-xl font-black text-white">{previewMode ? '—' : formatNumber(k.registrations)}</span><span className="mt-1 block text-[10px] font-bold text-white/40">participants</span></div>
              <div><span className="block text-xl font-black text-white">{previewMode ? '—' : formatNumber(k.active_rooms)}</span><span className="mt-1 block text-[10px] font-bold text-white/40">salles actives</span></div>
              <div><span className="block text-xl font-black text-white">{previewMode ? '—' : count(k.average_rating).toFixed(1)}</span><span className="mt-1 block text-[10px] font-bold text-white/40">note moyenne</span></div>
            </div>
          </div>
          <span className="absolute left-4 top-8 h-14 w-14 rotate-[-12deg] rounded-[20px] border border-white/15 bg-[#6B5BD2]/40 shadow-[0_18px_40px_rgba(0,0,0,.22)]" />
          <span className="absolute right-4 top-14 h-9 w-9 rounded-full bg-[#BF8813] shadow-[0_18px_35px_rgba(191,136,19,.32)]" />
          <span className="absolute bottom-5 right-20 h-20 w-20 rotate-6 rounded-[26px] border border-white/10 bg-white/[0.05]" />
        </div>
      </div>
    </section>
  );
}

function SpacesStrip({ previewMode }: Props) {
  return (
    <section className="border-b border-[#E1E5F0] bg-white">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#6B5BD2]">Accès direct</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#002050]">Vos espaces Omnia</h2>
          </div>
          <p className="hidden max-w-md text-right text-xs leading-5 text-slate-500 md:block">Ces accès servent uniquement de raccourcis. Les fonctions et paramètres détaillés restent dans chaque écosystème.</p>
        </div>
        <div className="mt-7 flex snap-x gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
          {SPACES.map(space => {
            const Icon = space.icon;
            return (
              <Link key={space.path} to={withPreview(space.path, previewMode)} className="group min-w-[265px] flex-1 snap-start rounded-[24px] border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_18px_42px_rgba(0,32,80,.08)]">
                <div className="flex items-start justify-between gap-4">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ color: space.accent, backgroundColor: space.soft }}><Icon size={20} /></span>
                  <ArrowRight size={16} className="mt-2 text-slate-300 transition group-hover:translate-x-1 group-hover:text-[#002050]" />
                </div>
                <strong className="mt-4 block text-sm font-black text-[#002050]">{space.label}</strong>
                <span className="mt-1.5 block text-xs leading-5 text-slate-500">{space.caption}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Today({ snapshot, previewMode }: { snapshot: OrganizerSnapshot; previewMode: boolean }) {
  const k = snapshot.kpis;
  const metrics = [
    { label: 'Événements', value: formatNumber(k.total_events), icon: CalendarDays, accent: '#6B5BD2' },
    { label: 'Participants confirmés', value: formatNumber(k.registrations), icon: Users, accent: '#0D8277' },
    { label: 'Publiés', value: formatNumber(k.published), icon: CheckCircle2, accent: '#13795B' },
    { label: 'En direct', value: formatNumber(k.live_now), icon: Radio, accent: count(k.live_now) > 0 ? '#D83B4D' : '#8A94A6' },
  ];

  return (
    <section className="bg-[#F7F8FC]">
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.62fr_1.38fr] lg:items-start">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#6B5BD2]">Votre activité aujourd’hui</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-[#002050]">Une lecture de votre programmation, pas un mur de statistiques.</h2>
            <p className="mt-4 max-w-md text-sm leading-7 text-slate-600">Les indicateurs proviennent du tableau de bord Organisateur Omnia Live déjà existant.</p>
          </div>
          <div className="overflow-hidden rounded-[28px] border border-[#E0E4EF] bg-white shadow-[0_20px_52px_rgba(0,32,80,.055)]">
            <div className="grid sm:grid-cols-2 xl:grid-cols-4">
              {metrics.map((metric, index) => {
                const Icon = metric.icon;
                return (
                  <div key={metric.label} className={`relative p-5 ${index > 0 ? 'border-t border-slate-100 sm:border-l sm:border-t-0' : ''} ${index === 2 ? 'sm:border-l-0 xl:border-l' : ''}`}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50" style={{ color: metric.accent }}><Icon size={17} /></span>
                      <span className="text-3xl font-black tracking-[-0.04em] text-[#002050]">{previewMode ? '—' : metric.value}</span>
                    </div>
                    <p className="mt-5 text-xs font-bold leading-5 text-slate-500">{metric.label}</p>
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

function ProgrammingRail({ snapshot, previewMode }: { snapshot: OrganizerSnapshot; previewMode: boolean }) {
  const now = Date.now();
  const future = snapshot.recentEvents
    .filter(event => event.starts_at && new Date(event.starts_at).getTime() > now && !['cancelled', 'rejected'].includes(String(event.status || '')))
    .sort((a, b) => new Date(a.starts_at || 0).getTime() - new Date(b.starts_at || 0).getTime())
    .slice(0, 4);

  const fallback = snapshot.recentEvents.slice(0, 4);
  const items = future.length ? future : fallback;

  return (
    <section className="bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-6 lg:grid-cols-[0.72fr_1.28fr] lg:px-8">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#BF8813]">Programmation</p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-[#002050]">Les événements qui structurent votre prochaine étape.</h2>
          <p className="mt-4 max-w-md text-sm leading-7 text-slate-600">L’accueil montre seulement les événements utiles à votre lecture immédiate. La gestion complète reste dans « Mes événements ».</p>
          <Link to={withPreview('/omnia-live/organisateur/evenements', previewMode)} className="mt-6 inline-flex items-center gap-2 text-sm font-black text-[#002050] hover:underline">Voir toute la programmation<ArrowRight size={15} /></Link>
        </div>

        <div className="relative border-y border-slate-200">
          <div className="absolute bottom-0 left-[21px] top-0 w-px bg-gradient-to-b from-transparent via-[#C9CEE0] to-transparent" aria-hidden="true" />
          {previewMode ? (
            <div className="relative flex gap-5 py-7 pl-1">
              <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-4 border-white bg-[#EEEBFF] text-[#6B5BD2]"><CalendarDays size={17} /></span>
              <div><strong className="text-sm font-black text-[#002050]">Aperçu de la programmation</strong><p className="mt-1 text-xs leading-5 text-slate-500">Les événements privés ne sont pas chargés pendant la prévisualisation Super-admin.</p></div>
            </div>
          ) : items.length ? items.map(event => {
            const tone = statusTone(event.status);
            return (
              <Link key={event.id} to={`/omnia-live/organisateur/evenements/${event.id}`} className="group relative flex gap-5 border-b border-slate-100 py-6 pl-1 last:border-b-0">
                <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-4 border-white" style={{ backgroundColor: tone.soft, color: tone.accent }}><CalendarDays size={17} /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2"><strong className="truncate text-sm font-black text-[#002050]">{event.title}</strong><span className="rounded-full px-2.5 py-1 text-[10px] font-black" style={{ backgroundColor: tone.soft, color: tone.accent }}>{liveStatusLabel(event.status)}</span></span>
                  <span className="mt-1.5 block text-xs text-slate-500">{formatDate(event.starts_at)} · {deliveryLabel(event.delivery_type)}</span>
                </span>
                <ArrowRight size={16} className="mt-2 shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-[#002050]" />
              </Link>
            );
          }) : (
            <Link to="/omnia-live/proposer" className="group relative flex gap-5 py-7 pl-1">
              <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-4 border-white bg-[#EEEBFF] text-[#6B5BD2]"><Video size={17} /></span>
              <span className="min-w-0 flex-1"><strong className="text-sm font-black text-[#002050]">Aucun événement dans votre programmation</strong><span className="mt-1 block text-xs leading-5 text-slate-500">Commencez par proposer une nouvelle expérience Omnia Live.</span></span>
              <ArrowRight size={16} className="mt-2 text-slate-300 transition group-hover:translate-x-1" />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

function AttentionAndImprovements({ snapshot, previewMode }: { snapshot: OrganizerSnapshot; previewMode: boolean }) {
  const k = snapshot.kpis;
  const recommendations = useMemo(() => buildRecommendations(snapshot, previewMode), [snapshot, previewMode]);
  const changes = snapshot.recentEvents.filter(event => event.status === 'changes_requested');
  const drafts = snapshot.recentEvents.filter(event => event.status === 'draft');

  const attention = previewMode
    ? [{ title: 'Aperçu des priorités Organisateur', description: 'Les actions privées ne sont pas chargées dans la prévisualisation.', path: '/omnia-live/organisateur', icon: Radio, accent: '#6B5BD2', soft: '#EEEBFF' }]
    : count(k.live_now) > 0
      ? [{ title: `${formatNumber(k.live_now)} Live en direct`, description: 'Accédez immédiatement à la régie de diffusion et au suivi de l’audience.', path: '/omnia-live/organisateur/evenements', icon: Radio, accent: '#D83B4D', soft: '#FFF0F2' }]
      : changes.length > 0
        ? changes.slice(0, 3).map(event => ({ title: event.title, description: 'Modifications demandées avant la prochaine étape.', path: `/omnia-live/organisateur/evenements/${event.id}`, icon: CheckCircle2, accent: '#C45B24', soft: '#FFF2E8' }))
        : drafts.length > 0
          ? drafts.slice(0, 3).map(event => ({ title: event.title, description: 'Brouillon à poursuivre dans le Studio Omnia Live.', path: `/omnia-live/studio/${event.id}`, icon: PlayCircle, accent: '#6B5BD2', soft: '#EEEBFF' }))
          : count(k.media_processing) > 0
            ? [{ title: `${formatNumber(k.media_processing)} média${count(k.media_processing) > 1 ? 's' : ''} en traitement`, description: 'Suivez la préparation des médias et replays liés à vos événements.', path: '/omnia-live/organisateur/medias', icon: Film, accent: '#A56B12', soft: '#FFF7E6' }]
            : [{ title: 'Aucune priorité urgente détectée', description: 'Votre programmation ne présente pas d’action immédiate dans les données actuellement disponibles.', path: '/omnia-live/organisateur/evenements', icon: CheckCircle2, accent: '#13795B', soft: '#EAF8F2' }];

  return (
    <section className="bg-[#F7F8FC]">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-8 xl:grid-cols-2">
          <div className="rounded-[30px] border border-[#E0E4EF] bg-white p-6 shadow-[0_20px_50px_rgba(0,32,80,.05)] sm:p-7">
            <div className="flex items-center justify-between gap-4">
              <div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#D05C70]">À traiter</p><h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#002050]">Ce qui mérite votre attention.</h2></div>
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

          <div className="relative overflow-hidden rounded-[30px] border border-[#D8D5F0] bg-[#191E42] p-6 text-white shadow-[0_24px_60px_rgba(17,28,66,.12)] sm:p-7">
            <div className="pointer-events-none absolute -right-24 -top-28 h-64 w-64 rounded-full border border-white/10" aria-hidden="true" />
            <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-[#6B5BD2]/20 blur-xl" aria-hidden="true" />
            <div className="relative">
              <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#B9B2FF]">Progresser</p><h2 className="mt-2 text-2xl font-black tracking-[-0.03em]">Améliorer votre activité Live</h2></div><Sparkles size={20} className="text-[#BF8813]" /></div>
              <p className="mt-3 max-w-lg text-xs leading-6 text-white/55">Les propositions ci-dessous sont déclenchées par vos données existantes, pas par des statistiques inventées.</p>
              <div className="mt-6 divide-y divide-white/10 border-y border-white/10">
                {recommendations.map(item => {
                  const Icon = item.icon;
                  return (
                    <Link key={`${item.path}-${item.title}`} to={withPreview(item.path, previewMode)} className="group flex items-start gap-4 py-5">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[#D1CCFF]"><Icon size={18} /></span>
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

function PerformanceStrip({ snapshot, previewMode }: { snapshot: OrganizerSnapshot; previewMode: boolean }) {
  const k = snapshot.kpis;
  const items = [
    { label: 'Commandes payées', value: formatNumber(k.paid_orders), icon: Ticket },
    { label: 'Médias en traitement', value: formatNumber(k.media_processing), icon: Film },
    { label: 'Note moyenne', value: count(k.average_rating).toFixed(1), icon: Star },
    { label: 'Événements terminés', value: formatNumber(k.completed), icon: CheckCircle2 },
  ];

  if (previewMode) return null;
  if (items.every(item => item.value === '0' || item.value === '0.0')) return null;

  return (
    <section className="border-t border-[#E1E5F0] bg-white">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#6B5BD2]">Performance</p><h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#002050]">Quelques signaux utiles, sans surcharger l’accueil.</h2></div>
          <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2 xl:max-w-[720px] xl:grid-cols-4">
            {items.map(item => { const Icon = item.icon; return <div key={item.label} className="rounded-2xl border border-slate-200 bg-[#FAFBFD] px-4 py-4"><div className="flex items-center gap-2 text-slate-400"><Icon size={15} /><span className="text-[10px] font-black uppercase tracking-[0.12em]">{item.label}</span></div><div className="mt-3 text-xl font-black tracking-[-0.03em] text-[#002050]">{item.value}</div></div>; })}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function OrganizerConnectedHomeSections({ previewMode }: Props) {
  const [snapshot, setSnapshot] = useState<OrganizerSnapshot>(EMPTY_SNAPSHOT);
  const [loading, setLoading] = useState(!previewMode);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (previewMode) {
      setSnapshot(EMPTY_SNAPSHOT);
      setLoading(false);
      setError('');
      return () => { active = false; };
    }

    setLoading(true);
    Promise.all([liveApi('organizer_dashboard'), liveApi('organizer_events')])
      .then(([dashboard, events]) => {
        if (!active) return;
        setSnapshot({ kpis: dashboard?.kpis || {}, recentEvents: events?.items || dashboard?.recent_events || [] });
        setError('');
      })
      .catch(caught => {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : 'Impossible de charger l’activité Organisateur.');
      })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [previewMode]);

  return (
    <>
      <Hero snapshot={snapshot} loading={loading} previewMode={previewMode} />
      {error && !previewMode && (
        <section className="border-b border-amber-200 bg-amber-50">
          <div className="mx-auto max-w-7xl px-5 py-3 text-xs font-semibold text-amber-800 sm:px-6 lg:px-8">Certaines données Live n’ont pas pu être chargées : {error}</div>
        </section>
      )}
      <SpacesStrip previewMode={previewMode} />
      <Today snapshot={snapshot} previewMode={previewMode} />
      <ProgrammingRail snapshot={snapshot} previewMode={previewMode} />
      <AttentionAndImprovements snapshot={snapshot} previewMode={previewMode} />
      <PerformanceStrip snapshot={snapshot} previewMode={previewMode} />
    </>
  );
}
