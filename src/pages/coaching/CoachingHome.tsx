import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, BadgeCheck, CalendarDays, CircleDot, Compass, HeartHandshake, MessageCircle, Network, Route, ShieldCheck, Sparkles, Target, Users } from 'lucide-react';
import CoachingLayout from '../../components/coaching/CoachingLayout';
import { useAuth } from '../../hooks/useAuth';
import { resolveCoachingAudience, type CoachingAudience } from '../../lib/coachingNavigation';
import {
  type CoachProfile,
  type CoachingDomain,
  type CoachingGroupProgram,
  type CoachingLevel,
  type CoachingSession,
  coachingRequest,
  formatCoachingDate,
} from '../../lib/coachingApi';

const BLUE = '#002050';
void BLUE;
const PETROL = '#667A3D';
void PETROL;
const GOLD = '#BF8813';
void GOLD;
const BORDER = '#DFE4C9';
void BORDER;

type Bootstrap = { success: true; coaches: CoachProfile[]; domains: CoachingDomain[]; levels: CoachingLevel[] };
type Advanced = { success: true; groups: CoachingGroupProgram[]; domains: CoachingDomain[] };
type LearnerDashboard = { success: true; sessions: CoachingSession[]; favorites: CoachProfile[] };
type CoachDashboard = {
  profile: CoachProfile;
  metrics: { upcoming_sessions: number; completed_sessions: number; average_rating: number; pending_custom_requests: number };
  recent_sessions: CoachingSession[];
};


function withPreview(path: string, params: URLSearchParams) {
  if (params.get('preview') !== 'true') return path;
  const [base, hash = ''] = path.split('#', 2);
  const [pathname, query = ''] = base.split('?', 2);
  const next = new URLSearchParams(query);
  next.set('preview', 'true');
  const role = params.get('role');
  if (role) next.set('role', role);
  return `${pathname}?${next.toString()}${hash ? `#${hash}` : ''}`;
}

function PreviewLink({ to, ...props }: ComponentProps<typeof Link>) {
  const [params] = useSearchParams();
  return <Link to={typeof to === 'string' ? withPreview(to, params) : to} {...props} />;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'OC';
}

function nextSession(sessions: CoachingSession[]) {
  const now = Date.now();
  return sessions
    .filter(session => ['confirmed', 'ready', 'in_progress'].includes(session.status))
    .filter(session => session.status === 'in_progress' || Boolean(session.scheduled_start && new Date(session.scheduled_start).getTime() >= now))
    .sort((a, b) => new Date(a.scheduled_start || a.requested_start || 0).getTime() - new Date(b.scheduled_start || b.requested_start || 0).getTime())[0] || null;
}

function CoachMiniList({ coaches, title = 'Coachs à découvrir' }: { coaches: CoachProfile[]; title?: string }) {
  if (!coaches.length) return null;
  return (
    <section className="border-t border-[#DFE4C9] bg-white">
      <div className="mx-auto max-w-[1320px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[.18em] text-[#667A3D]">Expertises disponibles</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-.03em] text-[#002050]">{title}</h2>
          </div>
          <PreviewLink to="/coaching/explorer" className="inline-flex items-center gap-2 text-sm font-black text-[#667A3D]">Explorer tous les coachs <ArrowRight size={15} /></PreviewLink>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {coaches.slice(0, 3).map(coach => (
            <PreviewLink key={coach.id} to={`/coaching/coachs/${coach.public_slug}`} className="group flex items-start gap-4 rounded-2xl border border-[#DFE4C9] bg-[#FBFCFA] p-4 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-lg">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#002050] text-xs font-black text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.12)]">{initials(coach.full_name)}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><strong className="truncate text-sm font-black text-[#002050]">{coach.full_name}</strong>{coach.level?.badge_label ? <BadgeCheck size={14} className="shrink-0 text-[#BF8813]" /> : null}</div>
                <p className="mt-1 line-clamp-1 text-xs font-semibold text-slate-500">{coach.professional_title}</p>
                <p className="mt-2 line-clamp-1 text-xs text-slate-400">{coach.domains?.slice(0, 2).map(item => item.name).join(' · ') || coach.specialties?.slice(0, 2).join(' · ') || 'Accompagnement professionnel'}</p>
              </div>
              <ArrowRight size={15} className="mt-1 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#667A3D]" />
            </PreviewLink>
          ))}
        </div>
      </div>
    </section>
  );
}

function PublicHero({ coachCount, domainCount, groupCount }: { coachCount: number; domainCount: number; groupCount: number }) {
  return (
    <section className="overflow-hidden bg-[#FBFCFA]">
      <div className="mx-auto grid max-w-[1320px] gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:py-20">
        <div className="self-center">
          <p className="text-[11px] font-black uppercase tracking-[.22em] text-[#667A3D]">Un accompagnement qui continue après la séance</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-black leading-[1.03] tracking-[-.045em] text-[#002050] md:text-6xl">Transformer une question en prochaine étape.</h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-slate-600 md:text-lg">Omnia Coaching relie choix du coach, préparation, rendez-vous, plan d’action et suivi dans un même parcours.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <PreviewLink to="/coaching/explorer" className="inline-flex items-center gap-2 rounded-xl bg-[#002050] px-5 py-3 text-sm font-black text-white">Trouver un coach <ArrowRight size={16} /></PreviewLink>
            <PreviewLink to="/coaching/solutions" className="inline-flex items-center gap-2 rounded-xl border border-[#D8DEC2] bg-white px-5 py-3 text-sm font-black text-[#002050]">Voir les solutions <Sparkles size={16} className="text-[#BF8813]" /></PreviewLink>
          </div>
          <div className="mt-9 flex flex-wrap gap-x-8 gap-y-3 border-t border-[#DFE4C9] pt-5 text-sm text-slate-500">
            <span><strong className="text-[#002050]">{coachCount}</strong> coach{coachCount > 1 ? 's' : ''} visible{coachCount > 1 ? 's' : ''}</span>
            <span><strong className="text-[#002050]">{domainCount}</strong> domaine{domainCount > 1 ? 's' : ''}</span>
            <span><strong className="text-[#002050]">{groupCount}</strong> session{groupCount > 1 ? 's' : ''} collective{groupCount > 1 ? 's' : ''}</span>
          </div>
        </div>
        <div className="relative min-h-[390px]">
          <div className="absolute inset-4 rounded-[38px] border border-[#D8DEC2] bg-[#F1F3E7] shadow-[0_30px_80px_rgba(0,32,80,.12)]" />
          <div className="absolute left-[12%] top-[10%] h-[78%] w-[76%] -rotate-3 rounded-[34px] border border-white/70 bg-[#002050] p-7 text-white shadow-2xl">
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#D8B35D]">Parcours d’accompagnement</p>
            <div className="mt-8 space-y-5">
              {[
                ['01', 'Clarifier', 'Nommer le besoin avant de choisir.'],
                ['02', 'Échanger', 'Travailler avec un coach dans un cadre clair.'],
                ['03', 'Agir', 'Transformer la séance en actions concrètes.'],
                ['04', 'Suivre', 'Revenir sur les avancées et ajuster.'],
              ].map(([n, title, text], index) => (
                <div key={n} className="grid grid-cols-[34px_1fr] gap-4">
                  <div className="relative flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-[10px] font-black text-[#F2CF7A]">{n}{index < 3 ? <span className="absolute left-1/2 top-full h-5 w-px bg-white/15" /> : null}</div>
                  <div><strong className="text-sm font-black">{title}</strong><p className="mt-1 text-xs leading-5 text-white/60">{text}</p></div>
                </div>
              ))}
            </div>
          </div>
          <div className="absolute bottom-2 right-0 w-[54%] rounded-2xl border border-[#E1E5D0] bg-white p-4 shadow-xl">
            <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF1DE] text-[#667A3D]"><Target size={18} /></div><div><p className="text-[10px] font-black uppercase tracking-[.15em] text-slate-400">Après la séance</p><p className="mt-1 text-sm font-black text-[#002050]">Un plan, pas seulement un rendez-vous.</p></div></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LearnerHero({ learner }: { learner: LearnerDashboard | null }) {
  const next = nextSession(learner?.sessions || []);
  const pending = learner?.sessions.filter(item => ['pending_coach', 'pending_payment'].includes(item.status)).length || 0;
  const completed = learner?.sessions.filter(item => item.status === 'completed').length || 0;
  return (
    <section className="bg-[#FAFBF4]">
      <div className="mx-auto max-w-[1320px] px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-6 lg:grid-cols-[.82fr_1.18fr]">
          <aside className="rounded-[30px] bg-[#002050] p-7 text-white shadow-[0_28px_70px_rgba(0,32,80,.16)]">
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#D8B35D]">Carnet d’accompagnement</p>
            <h1 className="mt-4 text-3xl font-black tracking-[-.04em] md:text-4xl">Votre progression, séance après séance.</h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/65">Retrouvez ce qui arrive, ce qui attend votre action et ce que vous avez déjà transformé en expérience.</p>
            <div className="mt-8 space-y-4">
              {[
                ['À préparer', pending, 'Demandes ou paiements qui attendent une action'],
                ['En mémoire', learner?.favorites.length || 0, 'Coachs enregistrés pour plus tard'],
                ['Acquis', completed, 'Séances terminées dans votre parcours'],
              ].map(([label, value, text]) => (
                <div key={String(label)} className="grid grid-cols-[70px_1fr] gap-4 border-t border-white/10 pt-4"><strong className="text-2xl font-black text-[#F1C96E]">{String(value)}</strong><div><p className="text-xs font-black uppercase tracking-[.13em] text-white/80">{label}</p><p className="mt-1 text-xs leading-5 text-white/45">{text}</p></div></div>
              ))}
            </div>
          </aside>
          <div className="grid gap-4">
            <div className="rounded-[30px] border border-[#DFE4C9] bg-white p-7">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#667A3D]">Prochaine étape</p><h2 className="mt-3 text-2xl font-black tracking-[-.03em] text-[#002050]">{next ? next.offer_title_snapshot : 'Choisir le bon accompagnement'}</h2></div>
                <span className="rounded-full bg-[#EEF1DE] px-3 py-1.5 text-xs font-black text-[#667A3D]">{next ? 'Séance programmée' : 'À votre rythme'}</span>
              </div>
              {next ? (
                <div className="mt-7 grid gap-4 md:grid-cols-3"><InfoCell label="Coach" value={next.coach?.full_name || next.coach_name_snapshot} /><InfoCell label="Quand" value={formatCoachingDate(next.scheduled_start || next.requested_start)} /><InfoCell label="Format" value={next.meeting_mode === 'jitsi' ? 'Salle Omnia' : 'Lien externe'} /></div>
              ) : (
                <div className="mt-6 flex flex-wrap gap-3"><PreviewLink to="/coaching/explorer" className="inline-flex items-center gap-2 rounded-xl bg-[#002050] px-4 py-2.5 text-sm font-black text-white">Explorer les coachs <Compass size={15} /></PreviewLink><PreviewLink to="/coaching/solutions" className="inline-flex items-center gap-2 rounded-xl border border-[#DFE4C9] px-4 py-2.5 text-sm font-black text-[#002050]">Voir les solutions <Sparkles size={15} className="text-[#BF8813]" /></PreviewLink></div>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <PreviewLink to="/dashboard/coaching" className="group rounded-[24px] border border-[#DFE4C9] bg-[#F1F3E7] p-5"><CalendarDays className="text-[#667A3D]" size={20} /><p className="mt-5 text-sm font-black text-[#002050]">Mes séances</p><p className="mt-2 text-xs leading-5 text-slate-500">Demandes, rendez-vous, historique et favoris.</p><ArrowRight size={15} className="mt-4 text-[#667A3D] transition group-hover:translate-x-1" /></PreviewLink>
              <PreviewLink to="/dashboard/coaching/avance" className="group rounded-[24px] border border-[#E8DEC7] bg-[#F8F4EA] p-5"><Route className="text-[#BF8813]" size={20} /><p className="mt-5 text-sm font-black text-[#002050]">Plans & recommandations</p><p className="mt-2 text-xs leading-5 text-slate-500">Matching, collectif et actions à poursuivre.</p><ArrowRight size={15} className="mt-4 text-[#BF8813] transition group-hover:translate-x-1" /></PreviewLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CoachHero({ dashboard }: { dashboard: CoachDashboard | null }) {
  const recent = dashboard?.recent_sessions || [];
  return (
    <section className="bg-[#FBFCFA]">
      <div className="mx-auto max-w-[1320px] px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="rounded-[34px] border border-[#DFE4C9] bg-white shadow-[0_24px_70px_rgba(0,32,80,.08)]">
          <div className="grid lg:grid-cols-[1.05fr_.95fr]">
            <div className="border-b border-[#DFE4C9] p-7 lg:border-b-0 lg:border-r lg:p-9">
              <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#002050] text-[#F2CF7A]"><HeartHandshake size={20} /></span><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#667A3D]">Cabinet Omnia Coaching</p><p className="mt-1 text-sm font-semibold text-slate-400">Votre pratique aujourd’hui</p></div></div>
              <h1 className="mt-8 max-w-xl text-4xl font-black tracking-[-.045em] text-[#002050]">Accompagner avec continuité, pas seulement remplir un agenda.</h1>
              <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-[#ECEFDF] pt-6 md:grid-cols-4">
                <Metric label="À venir" value={dashboard?.metrics.upcoming_sessions || 0} />
                <Metric label="Demandes" value={dashboard?.metrics.pending_custom_requests || 0} />
                <Metric label="Terminées" value={dashboard?.metrics.completed_sessions || 0} />
                <Metric label="Note" value={Number(dashboard?.metrics.average_rating || dashboard?.profile.average_rating || 0).toFixed(1)} />
              </div>
              <div className="mt-7 flex flex-wrap gap-3"><PreviewLink to="/coaching/pratique" className="rounded-xl bg-[#002050] px-4 py-2.5 text-sm font-black text-white">Piloter ma pratique</PreviewLink><PreviewLink to="/coaching/revenus-plan" className="rounded-xl border border-[#DFE4C9] px-4 py-2.5 text-sm font-black text-[#002050]">Revenus & plan</PreviewLink></div>
            </div>
            <div className="bg-[#F7F8F0] p-7 lg:rounded-r-[34px] lg:p-9">
              <div className="flex items-center justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#667A3D]">Continuité</p><h2 className="mt-2 text-xl font-black text-[#002050]">Dernières interactions</h2></div><CalendarDays size={21} className="text-[#BF8813]" /></div>
              <div className="mt-6 space-y-3">
                {recent.length ? recent.slice(0, 4).map(session => (
                  <div key={session.id} className="grid grid-cols-[12px_1fr] gap-3 rounded-2xl border border-[#DFE4C9] bg-white p-4"><span className="mt-1.5 h-3 w-3 rounded-full bg-[#667A3D] ring-4 ring-[#EEF1DE]" /><div><p className="text-sm font-black text-[#002050]">{session.learner?.full_name || 'Apprenant'}</p><p className="mt-1 text-xs text-slate-500">{session.offer_title_snapshot} · {formatCoachingDate(session.scheduled_start)}</p></div></div>
                )) : <div className="rounded-2xl border border-dashed border-[#D8DEC2] p-8 text-center"><CircleDot className="mx-auto text-[#667A3D]" size={24} /><p className="mt-3 text-sm font-bold text-[#002050]">Votre activité apparaîtra ici.</p><p className="mt-1 text-xs leading-5 text-slate-500">Les prochaines séances et demandes remonteront automatiquement.</p></div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProfessorHero() {
  return (
    <section className="bg-[#FBFCFA]">
      <div className="mx-auto max-w-[1320px] px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_.92fr]">
          <div className="self-center"><p className="text-[11px] font-black uppercase tracking-[.2em] text-[#667A3D]">Recul pédagogique</p><h1 className="mt-4 text-4xl font-black tracking-[-.045em] text-[#002050] md:text-5xl">Quand enseigner ne suffit pas, accompagner peut débloquer la suite.</h1><p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">Omnia Coaching complète la formation par un espace individuel ou collectif centré sur décision, posture, transition et mise en action.</p><div className="mt-7 flex gap-3"><PreviewLink to="/coaching/explorer" className="rounded-xl bg-[#002050] px-4 py-2.5 text-sm font-black text-white">Explorer les expertises</PreviewLink><PreviewLink to="/coaching/solutions" className="rounded-xl border border-[#DFE4C9] px-4 py-2.5 text-sm font-black text-[#002050]">Coaching collectif</PreviewLink></div></div>
          <div className="relative min-h-[340px] rounded-[32px] border border-[#DFE4C9] bg-[#F6F7EE] p-7">
            <div className="absolute left-8 top-8 h-[72%] w-[78%] -rotate-2 rounded-[26px] bg-white shadow-xl" />
            <div className="absolute right-8 top-16 h-[72%] w-[78%] rotate-3 rounded-[26px] border border-[#DFE4C9] bg-[#002050] p-6 text-white shadow-xl"><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#D8B35D]">Question de pratique</p><p className="mt-6 text-2xl font-black leading-tight">« Comment transformer un acquis en décision professionnelle ? »</p><div className="mt-8 border-t border-white/15 pt-5"><p className="text-xs leading-6 text-white/60">Le coaching ne remplace pas le contenu pédagogique. Il travaille la mise en mouvement, la posture et les choix qui suivent.</p></div></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StructureHero() {
  return (
    <section className="bg-[#FAFBF4]">
      <div className="mx-auto max-w-[1320px] px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[.95fr_1.05fr]">
          <div className="rounded-[32px] bg-[#002050] p-8 text-white"><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#D8B35D]">Développement humain</p><h1 className="mt-5 text-4xl font-black tracking-[-.04em]">Créer des espaces d’accompagnement autour des enjeux réels de l’organisation.</h1><p className="mt-5 text-sm leading-7 text-white/65">Leadership, transition, management, carrière ou expertise : l’écosystème permet d’identifier des coachs et des formats adaptés sans transformer la homepage en outil RH.</p><PreviewLink to="/coaching/explorer" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-[#002050]">Identifier des coachs <ArrowRight size={15} /></PreviewLink></div>
          <div className="relative min-h-[360px] rounded-[32px] border border-[#DFE4C9] bg-white p-8">
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#667A3D]">Carte d’accompagnement</p>
            <div className="relative mt-8 h-[250px]">
              <div className="absolute left-1/2 top-1/2 h-px w-[70%] -translate-x-1/2 bg-[#DFE4C9]" /><div className="absolute left-1/2 top-[18%] h-[64%] w-px -translate-x-1/2 bg-[#DFE4C9]" />
              <Node className="left-[8%] top-[38%]" label="Équipe" icon={Users} /><Node className="right-[7%] top-[38%]" label="Manager" icon={Target} /><Node className="left-[38%] top-[6%]" label="Transition" icon={Route} /><Node className="left-[39%] bottom-[4%]" label="Compétence" icon={BadgeCheck} />
              <div className="absolute left-1/2 top-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#002050] text-center text-xs font-black text-white shadow-xl ring-8 ring-[#EEF1DE]">Omnia<br/>Coaching</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function RecruiterHero() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-[1320px] px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1fr]">
          <div><p className="text-[11px] font-black uppercase tracking-[.2em] text-[#667A3D]">Potentiel & transition</p><h1 className="mt-4 text-4xl font-black tracking-[-.045em] text-[#002050] md:text-5xl">L’embauche n’est pas toujours la fin du parcours.</h1><p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">Coaching de prise de poste, évolution, management ou repositionnement : utilisez l’écosystème comme ressource de développement, pas comme pipeline de recrutement supplémentaire.</p><PreviewLink to="/coaching/explorer" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#002050] px-4 py-2.5 text-sm font-black text-white">Explorer les expertises <ArrowRight size={15} /></PreviewLink></div>
          <div className="rounded-[30px] border border-[#DFE4C9] bg-[#FBFCFA] p-7"><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#667A3D]">De l’opportunité à l’ancrage</p><div className="mt-7 grid gap-3">{[['01','Prise de poste','Clarifier les premières priorités.'],['02','Posture','Trouver le bon niveau d’autonomie et de communication.'],['03','Progression','Transformer les retours en actions suivies.']].map(([n,t,d])=><div key={n} className="grid grid-cols-[48px_1fr] gap-4 rounded-2xl bg-white p-4 shadow-sm"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF1DE] text-xs font-black text-[#667A3D]">{n}</span><div><strong className="text-sm font-black text-[#002050]">{t}</strong><p className="mt-1 text-xs leading-5 text-slate-500">{d}</p></div></div>)}</div></div>
        </div>
      </div>
    </section>
  );
}

function OrganizerHero() {
  return (
    <section className="overflow-hidden bg-[#FAFBF4]">
      <div className="mx-auto grid max-w-[1320px] gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_.95fr] lg:px-8">
        <div><p className="text-[11px] font-black uppercase tracking-[.2em] text-[#667A3D]">Après le direct</p><h1 className="mt-4 text-4xl font-black tracking-[-.045em] text-[#002050] md:text-5xl">Un événement peut ouvrir une conversation. Le coaching peut la prolonger.</h1><p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">Lorsque l’expertise Live doit devenir accompagnement, Omnia Coaching permet d’orienter vers des professionnels et des formats plus continus.</p><div className="mt-7 flex gap-3"><PreviewLink to="/coaching/explorer" className="rounded-xl bg-[#002050] px-4 py-2.5 text-sm font-black text-white">Voir les coachs</PreviewLink><PreviewLink to="/omnia-live" className="rounded-xl border border-[#DFE4C9] bg-white px-4 py-2.5 text-sm font-black text-[#002050]">Retour à Omnia Live</PreviewLink></div></div>
        <div className="relative min-h-[330px]"><div className="absolute left-8 top-7 h-52 w-52 rounded-full border border-[#D8DEC2]"/><div className="absolute left-20 top-20 h-28 w-28 rounded-full bg-[#002050] shadow-2xl"/><div className="absolute left-[45%] top-[42%] h-px w-[42%] rotate-[-12deg] bg-[#BF8813]"/><div className="absolute right-8 top-24 w-48 rounded-[24px] border border-[#DFE4C9] bg-white p-5 shadow-xl"><Network className="text-[#667A3D]" size={20}/><p className="mt-5 text-sm font-black text-[#002050]">Live → échange → accompagnement</p><p className="mt-2 text-xs leading-5 text-slate-500">Une continuité utile quand le sujet nécessite davantage qu’une session publique.</p></div></div>
      </div>
    </section>
  );
}

function ModeratorHero() {
  return (
    <section className="bg-[#F8FAF9]">
      <div className="mx-auto max-w-[1320px] px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-7 lg:grid-cols-[.78fr_1.22fr]">
          <div className="rounded-[30px] border border-[#DFE4C9] bg-white p-7"><ShieldCheck size={28} className="text-[#667A3D]"/><p className="mt-7 text-[10px] font-black uppercase tracking-[.2em] text-[#667A3D]">Cadre de confiance</p><h1 className="mt-3 text-3xl font-black tracking-[-.04em] text-[#002050]">Un coaching crédible commence par des règles visibles.</h1><p className="mt-4 text-sm leading-6 text-slate-600">Votre accès à Omnia Coaching reste centré sur l’offre publique. Les décisions administratives de gouvernance restent réservées aux espaces autorisés.</p></div>
          <div className="rounded-[30px] bg-[#002050] p-7 text-white"><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#D8B35D]">Principes affichés</p><div className="mt-6 grid gap-4 md:grid-cols-3"><TrustItem icon={BadgeCheck} title="Profils validés" text="Le statut du coach et ses niveaux restent identifiables."/><TrustItem icon={MessageCircle} title="Avis issus de séances" text="Les retours sont rattachés à l’expérience réelle."/><TrustItem icon={ShieldCheck} title="Cadre de session" text="Paiements, litiges et accès suivent les règles existantes."/></div></div>
        </div>
      </div>
    </section>
  );
}

function GenericRoleFooter({ audience, coaches, domains, groups }: { audience: CoachingAudience; coaches: CoachProfile[]; domains: CoachingDomain[]; groups: CoachingGroupProgram[] }) {
  if (audience === 'coach') return null;
  const title = audience === 'apprenant' ? 'Expertises qui peuvent compléter votre parcours' : audience === 'structure' ? 'Ressources d’accompagnement disponibles' : audience === 'professeur' ? 'Coachs et expertises complémentaires' : audience === 'recruteur' ? 'Expertises utiles aux transitions' : audience === 'organisateur' ? 'Professionnels à découvrir' : audience === 'moderateur' ? 'Offre publique actuellement visible' : 'Coachs à découvrir';
  return (
    <>
      <CoachMiniList coaches={coaches} title={title} />
      <section className="bg-[#F5F7EC]">
        <div className="mx-auto grid max-w-[1320px] gap-5 px-4 py-10 sm:px-6 md:grid-cols-3 lg:px-8">
          <Signal icon={Compass} label="Domaines" value={domains.length} text="Domaines d’accompagnement actuellement proposés." />
          <Signal icon={Users} label="Collectif" value={groups.length} text="Sessions collectives présentes dans le catalogue." />
          <Signal icon={HeartHandshake} label="Continuité" value="1:1 + groupe" text="Des formats qui peuvent se prolonger par des plans d’action." />
        </div>
      </section>
    </>
  );
}

export default function CoachingHome() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const preview = params.get('preview') === 'true' && Boolean(user?.roles?.includes('super_admin'));
  const audience = resolveCoachingAudience(user?.roles, preview ? params.get('role') : null);
  const [bootstrap, setBootstrap] = useState<Bootstrap>({ success: true, coaches: [], domains: [], levels: [] });
  const [advanced, setAdvanced] = useState<Advanced>({ success: true, groups: [], domains: [] });
  const [learner, setLearner] = useState<LearnerDashboard | null>(null);
  const [coach, setCoach] = useState<CoachDashboard | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      coachingRequest<Bootstrap>('public_bootstrap').catch(() => ({ success: true, coaches: [], domains: [], levels: [] } as Bootstrap)),
      coachingRequest<Advanced>('public_advanced_catalogue').catch(() => ({ success: true, groups: [], domains: [] } as Advanced)),
    ]).then(([publicData, advancedData]) => {
      if (!active) return;
      setBootstrap(publicData);
      setAdvanced(advancedData);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (preview) return;
    let active = true;
    if (audience === 'apprenant' && user) {
      coachingRequest<LearnerDashboard>('learner_coaching_dashboard').then(data => { if (active) setLearner(data); }).catch(() => { if (active) setLearner(null); });
    } else if (audience === 'coach' && user) {
      coachingRequest<CoachDashboard>('coach_dashboard').then(data => { if (active) setCoach(data); }).catch(() => { if (active) setCoach(null); });
    }
    return () => { active = false; };
  }, [audience, preview, user]);

  const visibleAudience = audience === 'super_admin' ? 'public' : audience;
  const hero = useMemo(() => {
    if (visibleAudience === 'apprenant') return <LearnerHero learner={learner} />;
    if (visibleAudience === 'coach') return <CoachHero dashboard={coach} />;
    if (visibleAudience === 'professeur') return <ProfessorHero />;
    if (visibleAudience === 'structure') return <StructureHero />;
    if (visibleAudience === 'recruteur') return <RecruiterHero />;
    if (visibleAudience === 'organisateur') return <OrganizerHero />;
    if (visibleAudience === 'moderateur') return <ModeratorHero />;
    return <PublicHero coachCount={bootstrap.coaches.length} domainCount={bootstrap.domains.length} groupCount={advanced.groups.length} />;
  }, [advanced.groups.length, bootstrap.coaches.length, bootstrap.domains.length, coach, learner, visibleAudience]);

  return (
    <CoachingLayout>
      {hero}
      <GenericRoleFooter audience={visibleAudience} coaches={bootstrap.coaches} domains={bootstrap.domains} groups={advanced.groups} />
    </CoachingLayout>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return <div className="border-l-2 border-[#EEF1DE] pl-3"><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">{label}</p><p className="mt-1 text-sm font-black text-[#002050]">{value}</p></div>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div><p className="text-2xl font-black tracking-[-.03em] text-[#002050]">{value}</p><p className="mt-1 text-[10px] font-black uppercase tracking-[.12em] text-slate-400">{label}</p></div>;
}

function Node({ className, label, icon: Icon }: { className: string; label: string; icon: typeof Users }) {
  return <div className={`absolute ${className} flex w-28 flex-col items-center rounded-2xl border border-[#DFE4C9] bg-white px-3 py-4 text-center shadow-lg`}><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EEF1DE] text-[#667A3D]"><Icon size={16} /></span><span className="mt-2 text-xs font-black text-[#002050]">{label}</span></div>;
}

function TrustItem({ icon: Icon, title, text }: { icon: typeof ShieldCheck; title: string; text: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[.06] p-5"><Icon size={19} className="text-[#F2CF7A]" /><p className="mt-5 text-sm font-black">{title}</p><p className="mt-2 text-xs leading-5 text-white/55">{text}</p></div>;
}

function Signal({ icon: Icon, label, value, text }: { icon: typeof Compass; label: string; value: string | number; text: string }) {
  return <div className="flex items-start gap-4 rounded-2xl border border-[#DFE4C9] bg-white p-5"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF1DE] text-[#667A3D]"><Icon size={18} /></span><div><p className="text-[10px] font-black uppercase tracking-[.13em] text-slate-400">{label}</p><p className="mt-1 text-xl font-black text-[#002050]">{value}</p><p className="mt-2 text-xs leading-5 text-slate-500">{text}</p></div></div>;
}
