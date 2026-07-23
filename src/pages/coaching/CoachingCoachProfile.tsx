import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, CalendarDays, Globe2, Languages, Linkedin, Star, Video } from 'lucide-react';
import CoachingHeader from '../../components/coaching/CoachingHeader';
import { CoachProfile, coachingRequest, formatXof } from '../../lib/coachingApi';

const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'OC'; }

export default function CoachingCoachProfile() {
  const { coachId = '' } = useParams();
  const navigate = useNavigate();
  const [coach, setCoach] = useState<CoachProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    coachingRequest<{ success: true; coach: CoachProfile }>('public_profile', { coach_id: coachId }).then(data => setCoach(data.coach)).catch(e => setError(e instanceof Error ? e.message : 'Profil indisponible.')).finally(() => setLoading(false));
  }, [coachId]);

  if (loading) return <div className="min-h-screen bg-[#F8FAFC]"><CoachingHeader/><div className="py-24 text-center text-sm text-slate-500">Chargement du profil…</div></div>;
  if (!coach || error) return <div className="min-h-screen bg-[#F8FAFC]"><CoachingHeader/><div className="mx-auto max-w-3xl px-5 py-20 text-center"><h1 className="text-2xl font-semibold" style={{ color: BLUE }}>Profil introuvable</h1><p className="mt-3 text-slate-600">{error || 'Ce coach n’est pas disponible.'}</p><Link to="/coaching" className="mt-6 inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white" style={{ background: BLUE }}><ArrowLeft size={16}/>Retour au catalogue</Link></div></div>;

  return <div className="min-h-screen bg-[#F8FAFC]">
    <CoachingHeader/>
    <main className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      <button onClick={() => navigate('/coaching')} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600"><ArrowLeft size={16}/>Retour au catalogue</button>
      {notice && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{notice}</div>}
      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-6">
          <div className="rounded-2xl border bg-white p-6 md:p-8" style={{ borderColor: BORDER }}>
            <div className="flex flex-col gap-5 sm:flex-row">
              {coach.photo_url ? <img src={coach.photo_url} alt={coach.full_name} className="h-28 w-28 rounded-3xl object-cover"/> : <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-3xl text-2xl font-bold text-white" style={{ background: BLUE }}>{initials(coach.full_name)}</div>}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-semibold md:text-3xl" style={{ color: BLUE }}>{coach.full_name}</h1>{(coach.badge_override || coach.level?.badge_label) && <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: 'rgba(191,136,19,.12)', color: GOLD }}><BadgeCheck size={14}/>{coach.badge_override || coach.level?.badge_label}</span>}</div>
                <p className="mt-2 text-base text-slate-600">{coach.professional_title}</p>
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500"><span className="inline-flex items-center gap-1.5"><Star size={16} color={GOLD} fill={coach.rating_count ? GOLD : 'none'}/>{Number(coach.average_rating || 0).toFixed(1)} · {coach.rating_count || 0} avis</span><span className="inline-flex items-center gap-1.5"><Globe2 size={16}/>{coach.country}</span><span className="inline-flex items-center gap-1.5"><Languages size={16}/>{coach.languages?.join(', ')}</span></div>
                <div className="mt-4 flex flex-wrap gap-2">{coach.domains.map(domain => <span key={domain.id} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">{domain.name}</span>)}</div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-6 md:p-8" style={{ borderColor: BORDER }}><h2 className="text-xl font-semibold" style={{ color: BLUE }}>À propos</h2><p className="mt-4 whitespace-pre-line text-sm leading-7 text-slate-600">{coach.biography}</p></div>
          <div className="rounded-2xl border bg-white p-6 md:p-8" style={{ borderColor: BORDER }}><h2 className="text-xl font-semibold" style={{ color: BLUE }}>Spécialités</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{coach.specialties?.map(item => <div key={item} className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700">{item}</div>)}</div></div>
          {(coach.linkedin_url || coach.website_url) && <div className="rounded-2xl border bg-white p-6" style={{ borderColor: BORDER }}><h2 className="font-semibold" style={{ color: BLUE }}>Liens professionnels</h2><div className="mt-4 flex flex-wrap gap-3">{coach.linkedin_url && <a href={coach.linkedin_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"><Linkedin size={16}/>LinkedIn</a>}{coach.website_url && <a href={coach.website_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"><Globe2 size={16}/>Site professionnel</a>}</div></div>}
        </section>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border bg-white p-6 shadow-sm" style={{ borderColor: BORDER }}>
            <h2 className="text-lg font-semibold" style={{ color: BLUE }}>Tarifs des sessions</h2>
            <div className="mt-4 divide-y" style={{ borderColor: BORDER }}>
              {[['30 minutes', coach.price_30_xof], ['60 minutes', coach.price_60_xof], ['90 minutes', coach.price_90_xof]].map(([label, price]) => <div key={String(label)} className="flex items-center justify-between py-3 text-sm"><span className="text-slate-600">{label}</span><strong style={{ color: BLUE }}>{formatXof(price as number | null)}</strong></div>)}
              {coach.custom_duration_enabled && <div className="flex items-center justify-between py-3 text-sm"><span className="text-slate-600">Durée personnalisée</span><strong style={{ color: BLUE }}>{formatXof(coach.custom_hourly_price_xof)} / h</strong></div>}
            </div>
            <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600"><div className="flex items-center gap-2 font-semibold" style={{ color: BLUE }}><Video size={17} color={GOLD}/>Formats proposés</div><p className="mt-2">{coach.preferred_session_modes?.map(mode => mode === 'jitsi' ? 'Salle vidéo OGA' : 'Zoom / Meet').join(' · ')}</p></div>
            <button onClick={() => setNotice('La réservation et le paiement seront activés dans le Grand module 2. Le profil public et la validation des coachs sont déjà opérationnels.')} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white" style={{ background: BLUE }}><CalendarDays size={17}/>Réserver une session</button>
            {coach.status === 'vacation' && <p className="mt-3 text-center text-xs font-medium text-amber-700">Ce coach est actuellement en mode vacances.</p>}
          </div>
        </aside>
      </div>
    </main>
  </div>;
}
