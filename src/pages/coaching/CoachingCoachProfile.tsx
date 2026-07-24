import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, CalendarDays, Globe2, Heart, Languages, Linkedin, Package, Star, Users, Video } from 'lucide-react';
import CoachingHeader from '../../components/coaching/CoachingHeader';
import { CoachProfile, coachingRequest, formatXof } from '../../lib/coachingApi';

const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'OC'; }

export default function CoachingCoachProfile() {
  const { coachId = '' } = useParams();
  const navigate = useNavigate();
  const loggedIn = Boolean(localStorage.getItem('omnia_session_token'));
  const [coach, setCoach] = useState<CoachProfile | null>(null);
  const [favorite, setFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    coachingRequest<{ success: true; coach: CoachProfile }>('public_profile', { coach_id: coachId })
      .then(async data => {
        setCoach(data.coach);
        if (loggedIn) {
          try { const state = await coachingRequest<{ success: true; favorite: boolean }>('favorite_status', { coach_id: data.coach.id }); setFavorite(state.favorite); }
          catch { /* Le profil public reste accessible même si l’état favori échoue. */ }
        }
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Profil indisponible.'))
      .finally(() => setLoading(false));
  }, [coachId, loggedIn]);

  async function toggleFavorite() {
    if (!coach) return;
    if (!loggedIn) { navigate(`/connexion?redirect=${encodeURIComponent(`/coaching/coachs/${coach.public_slug}`)}`); return; }
    setFavoriteBusy(true); setNotice('');
    try {
      const next = !favorite;
      await coachingRequest('favorite_toggle', { coach_id: coach.id, active: next });
      setFavorite(next);
      setNotice(next ? 'Coach ajouté à vos favoris.' : 'Coach retiré de vos favoris.');
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Modification impossible.'); }
    finally { setFavoriteBusy(false); }
  }

  if (loading) return <div className="min-h-screen bg-[#F8FAFC]"><CoachingHeader/><div className="py-24 text-center text-sm text-slate-500">Chargement du profil…</div></div>;
  if (!coach || error) return <div className="min-h-screen bg-[#F8FAFC]"><CoachingHeader/><div className="mx-auto max-w-3xl px-5 py-20 text-center"><h1 className="text-2xl font-semibold" style={{ color: BLUE }}>Profil introuvable</h1><p className="mt-3 text-slate-600">{error || 'Ce coach n’est pas disponible.'}</p><Link to="/coaching" className="mt-6 inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white" style={{ background: BLUE }}><ArrowLeft size={16}/>Retour au catalogue</Link></div></div>;

  const offers = coach.offers || [];

  return <div className="min-h-screen bg-[#F8FAFC]">
    <CoachingHeader/>
    <main className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      <button onClick={() => navigate('/coaching')} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600"><ArrowLeft size={16}/>Retour au catalogue</button>
      {notice && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{notice}</div>}
      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
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
              <button disabled={favoriteBusy} onClick={toggleFavorite} className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border px-4 text-sm font-semibold disabled:opacity-50" style={{ borderColor: favorite ? GOLD : BORDER, color: favorite ? GOLD : BLUE, background: favorite ? 'rgba(191,136,19,.08)' : 'white' }}><Heart size={17} fill={favorite ? 'currentColor' : 'none'}/>{favorite ? 'Enregistré' : 'Favori'}</button>
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-6 md:p-8" style={{ borderColor: BORDER }}><h2 className="text-xl font-semibold" style={{ color: BLUE }}>À propos</h2><p className="mt-4 whitespace-pre-line text-sm leading-7 text-slate-600">{coach.biography}</p></div>
          <div className="rounded-2xl border bg-white p-6 md:p-8" style={{ borderColor: BORDER }}><h2 className="text-xl font-semibold" style={{ color: BLUE }}>Spécialités</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{coach.specialties?.map(item => <div key={item} className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700">{item}</div>)}</div></div>
          {(coach.packages?.length || coach.groups?.length) ? <div className="grid gap-6 md:grid-cols-2">{coach.packages?.length ? <div className="rounded-2xl border bg-white p-6" style={{borderColor:BORDER}}><h2 className="flex items-center gap-2 text-lg font-semibold" style={{color:BLUE}}><Package size={19} color={GOLD}/>Packs disponibles</h2><div className="mt-4 space-y-3">{coach.packages.map(pack=><div key={pack.id} className="rounded-xl border p-4" style={{borderColor:BORDER}}><p className="font-semibold" style={{color:BLUE}}>{pack.title}</p><p className="mt-1 text-xs text-slate-500">{pack.session_count} séances de {pack.session_duration_minutes} min · {pack.validity_days} jours</p><div className="mt-3 flex items-center justify-between"><strong style={{color:GOLD}}>{formatXof(pack.price_xof)}</strong><Link to="/coaching/solutions" className="rounded-lg px-3 py-2 text-xs font-semibold text-white" style={{background:BLUE}}>Acheter</Link></div></div>)}</div></div>:null}{coach.groups?.length ? <div className="rounded-2xl border bg-white p-6" style={{borderColor:BORDER}}><h2 className="flex items-center gap-2 text-lg font-semibold" style={{color:BLUE}}><Users size={19} color={GOLD}/>Sessions collectives</h2><div className="mt-4 space-y-3">{coach.groups.map(group=><div key={group.id} className="rounded-xl border p-4" style={{borderColor:BORDER}}><p className="font-semibold" style={{color:BLUE}}>{group.title}</p><p className="mt-1 text-xs text-slate-500">{new Date(group.scheduled_start).toLocaleString('fr-FR')} · {group.capacity} places</p><div className="mt-3 flex items-center justify-between"><strong style={{color:GOLD}}>{formatXof(group.price_per_participant_xof)}</strong><Link to="/coaching/solutions" className="rounded-lg px-3 py-2 text-xs font-semibold text-white" style={{background:BLUE}}>Voir</Link></div></div>)}</div></div>:null}</div>:null}
          <div className="rounded-2xl border bg-white p-6 md:p-8" style={{ borderColor: BORDER }}><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold" style={{ color: BLUE }}>Avis vérifiés</h2><span className="inline-flex items-center gap-1 text-sm font-semibold" style={{ color: GOLD }}><Star size={17} fill={coach.rating_count ? GOLD : 'none'}/>{Number(coach.average_rating || 0).toFixed(1)} · {coach.rating_count || 0}</span></div><div className="mt-5 space-y-4">{coach.ratings?.length ? coach.ratings.map(rating => <article key={rating.id} className="rounded-xl border p-4" style={{ borderColor: BORDER }}><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold" style={{ color: BLUE }}>{rating.learner_name || 'Apprenant OGA'}</p><p className="mt-1 text-xs text-slate-500">Session vérifiée · {new Date(rating.created_at).toLocaleDateString('fr-FR')}</p></div><span className="inline-flex items-center gap-1 text-sm font-semibold" style={{ color: GOLD }}><Star size={15} fill={GOLD}/>{rating.overall_rating}/5</span></div>{rating.comment && <p className="mt-3 text-sm leading-6 text-slate-600">{rating.comment}</p>}{rating.coach_response && <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm"><strong style={{ color: BLUE }}>Réponse du coach</strong><p className="mt-1 text-slate-600">{rating.coach_response}</p></div>}</article>) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Ce coach n’a pas encore reçu d’avis vérifié.</p>}</div></div>
          {(coach.linkedin_url || coach.website_url) && <div className="rounded-2xl border bg-white p-6" style={{ borderColor: BORDER }}><h2 className="font-semibold" style={{ color: BLUE }}>Liens professionnels</h2><div className="mt-4 flex flex-wrap gap-3">{coach.linkedin_url && <a href={coach.linkedin_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"><Linkedin size={16}/>LinkedIn</a>}{coach.website_url && <a href={coach.website_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"><Globe2 size={16}/>Site professionnel</a>}</div></div>}
        </section>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border bg-white p-6 shadow-sm" style={{ borderColor: BORDER }}>
            <h2 className="text-lg font-semibold" style={{ color: BLUE }}>Offres disponibles</h2>
            <div className="mt-4 space-y-3">{offers.length ? offers.map(offer => <div key={offer.id} className="rounded-xl border p-4" style={{ borderColor: BORDER }}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold" style={{ color: BLUE }}>{offer.title}</p><p className="mt-1 text-xs text-slate-500">{offer.offer_type === 'fixed' ? `${offer.duration_minutes} minutes` : `${offer.custom_min_minutes} à ${offer.custom_max_minutes} minutes`}</p></div><strong className="text-sm" style={{ color: GOLD }}>{offer.offer_type === 'fixed' ? formatXof(offer.price_xof) : `${formatXof(offer.hourly_price_xof)}/h`}</strong></div>{offer.description && <p className="mt-2 text-xs leading-5 text-slate-600">{offer.description}</p>}<div className="mt-3 flex items-center gap-2 text-xs text-slate-500"><Video size={14}/>{offer.session_modes.map(mode => mode === 'jitsi' ? 'Salle OGA' : 'Lien externe').join(' · ')}</div></div>) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Aucune offre active pour le moment.</p>}</div>
            <Link to={`/coaching/coachs/${coach.public_slug}/reserver`} className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white ${offers.length ? '' : 'pointer-events-none opacity-50'}`} style={{ background: BLUE }}><CalendarDays size={17}/>Réserver une session</Link>
            <p className="mt-3 text-center text-xs leading-5 text-slate-500">Les disponibilités affichées lors de la réservation tiennent compte du calendrier, des pauses et des créneaux déjà occupés.</p>
          </div>
        </aside>
      </div>
    </main>
  </div>;
}
