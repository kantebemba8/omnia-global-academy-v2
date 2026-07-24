import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, CheckCircle2, Loader2, Video } from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import CoachingHeader from '../../components/coaching/CoachingHeader';
import { CoachOffer, CoachProfile, CoachingPackagePurchase, CoachingSlot, coachingRequest, formatCoachingDate, formatXof } from '../../lib/coachingApi';

const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

function isoDate(date: Date) { return date.toISOString().slice(0, 10); }

export default function CoachingBooking() {
  const { coachId = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const purchaseId = searchParams.get('purchase') || '';
  const loggedIn = Boolean(localStorage.getItem('omnia_session_token'));
  const [coach, setCoach] = useState<CoachProfile | null>(null);
  const [offerId, setOfferId] = useState('');
  const [duration, setDuration] = useState(60);
  const [date, setDate] = useState(isoDate(new Date(Date.now() + 86400000)));
  const [slots, setSlots] = useState<CoachingSlot[]>([]);
  const [slotStart, setSlotStart] = useState('');
  const [meetingMode, setMeetingMode] = useState<'jitsi' | 'external'>('jitsi');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ custom: boolean; id: string; package?: boolean } | null>(null);
  const [packagePurchase, setPackagePurchase] = useState<CoachingPackagePurchase | null>(null);

  useEffect(() => {
    coachingRequest<{ success: true; coach: CoachProfile }>('public_profile', { coach_id: coachId })
      .then(data => {
        setCoach(data.coach);
        const first = data.coach.offers?.[0];
        if (first) {
          setOfferId(first.id);
          if (first.offer_type === 'fixed') setDuration(Number(first.duration_minutes || 60));
          else setDuration(Number(first.custom_min_minutes || 30));
          setMeetingMode((first.session_modes?.[0] || 'jitsi') as 'jitsi' | 'external');
        }
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Profil indisponible.'))
      .finally(() => setLoading(false));
  }, [coachId]);

  useEffect(() => {
    if (!purchaseId || !loggedIn) return;
    coachingRequest<{ packages: CoachingPackagePurchase[] }>('learner_advanced_dashboard')
      .then(data => setPackagePurchase(data.packages.find(item => item.id === purchaseId) || null))
      .catch(() => setPackagePurchase(null));
  }, [purchaseId, loggedIn]);

  useEffect(() => {
    if (!coach || !packagePurchase?.package) return;
    const compatible = coach.offers?.find(item => item.offer_type === 'fixed'
      && Number(item.duration_minutes || 0) === Number(packagePurchase.package?.session_duration_minutes || 0)
      && (item.session_modes || []).some(mode => (packagePurchase.package?.session_modes || []).includes(mode as 'jitsi' | 'external')));
    if (compatible && compatible.id !== offerId) selectOffer(compatible.id);
  }, [coach, packagePurchase, offerId]);

  const offer = useMemo(() => coach?.offers?.find(item => item.id === offerId) || null, [coach, offerId]);
  const price = useMemo(() => {
    if (!offer) return null;
    return offer.offer_type === 'fixed' ? offer.price_xof ?? null : Math.round(Number(offer.hourly_price_xof || 0) * duration / 60);
  }, [offer, duration]);

  function selectOffer(nextId: string) {
    const next = coach?.offers?.find(item => item.id === nextId);
    setOfferId(nextId); setSlots([]); setSlotStart('');
    if (!next) return;
    if (next.offer_type === 'fixed') setDuration(Number(next.duration_minutes || 60));
    else setDuration(Number(next.custom_min_minutes || 30));
    setMeetingMode((next.session_modes?.[0] || 'jitsi') as 'jitsi' | 'external');
  }

  async function loadSlots() {
    if (!offer) return;
    setLoadingSlots(true); setError(''); setSlots([]); setSlotStart('');
    try {
      const data = await coachingRequest<{ success: true; slots: CoachingSlot[] }>('public_availability', { coach_id: coachId, offer_id: offer.id, duration_minutes: duration, from_date: date, to_date: date });
      setSlots(data.slots);
    } catch (e) { setError(e instanceof Error ? e.message : 'Créneaux indisponibles.'); }
    finally { setLoadingSlots(false); }
  }

  async function book() {
    if (!loggedIn) { const target = `/coaching/coachs/${coachId}/reserver${purchaseId ? `?purchase=${encodeURIComponent(purchaseId)}` : ''}`; navigate(`/connexion?redirect=${encodeURIComponent(target)}`); return; }
    if (!offer || !slotStart) { setError('Sélectionnez une offre et un créneau.'); return; }
    setBusy(true); setError('');
    try {
      if (packagePurchase) {
        const result = await coachingRequest<{ success: true; session: { id: string } }>('package_booking_create', { purchase_id: packagePurchase.id, offer_id: offer.id, slot_start: slotStart, meeting_mode: meetingMode, learner_message: message });
        setSuccess({ custom: false, package: true, id: result.session.id });
        return;
      }
      const action = offer.offer_type === 'custom' ? 'booking_create_custom' : 'booking_create_fixed';
      const result = await coachingRequest<{ success: true; session: { id: string } }>(action, { offer_id: offer.id, slot_start: slotStart, duration_minutes: duration, meeting_mode: meetingMode, learner_message: message });
      if (offer.offer_type === 'fixed') {
        navigate(`/coaching/paiement/${result.session.id}`);
        return;
      }
      setSuccess({ custom: true, id: result.session.id });
    } catch (e) { setError(e instanceof Error ? e.message : 'Réservation impossible.'); }
    finally { setBusy(false); }
  }

  if (loading) return <div className="min-h-screen bg-[#F8FAFC]"><CoachingHeader/><div className="py-24 text-center text-sm text-slate-500">Chargement de la réservation…</div></div>;
  if (!coach || !offer) return <div className="min-h-screen bg-[#F8FAFC]"><CoachingHeader/><main className="mx-auto max-w-2xl px-5 py-20 text-center"><h1 className="text-2xl font-semibold" style={{ color: BLUE }}>Réservation indisponible</h1><p className="mt-3 text-slate-600">{error || 'Ce coach ne propose actuellement aucune offre active.'}</p><Link to={`/coaching/coachs/${coachId}`} className="mt-6 inline-flex rounded-xl px-4 py-3 text-sm font-semibold text-white" style={{ background: BLUE }}>Retour au profil</Link></main></div>;

  if (success) return <div className="min-h-screen bg-[#F8FAFC]"><CoachingHeader/><main className="mx-auto max-w-2xl px-5 py-20 text-center"><CheckCircle2 className="mx-auto h-14 w-14" color={GOLD}/><h1 className="mt-5 text-3xl font-semibold" style={{ color: BLUE }}>{success.package ? 'Séance confirmée avec votre pack' : success.custom ? 'Demande transmise au coach' : 'Créneau temporairement réservé'}</h1><p className="mt-4 leading-7 text-slate-600">{success.package ? 'Un crédit a été utilisé. La séance est confirmée et apparaît dans votre espace coaching.' : 'Le coach doit accepter votre durée et votre créneau avant que le paiement FedaPay soit proposé.'}</p><div className="mt-7 flex flex-wrap justify-center gap-3"><Link to="/dashboard/coaching" className="rounded-xl px-5 py-3 text-sm font-semibold text-white" style={{ background: BLUE }}>Voir mon espace coaching</Link><Link to="/coaching" className="rounded-xl border px-5 py-3 text-sm font-semibold" style={{ borderColor: BORDER, color: BLUE }}>Retour au catalogue</Link></div></main></div>;

  return <div className="min-h-screen bg-[#F8FAFC]">
    <CoachingHeader />
    <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <Link to={`/coaching/coachs/${coach.public_slug}`} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600"><ArrowLeft size={16}/>Retour au profil</Link>
      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="space-y-5">
          <div className="rounded-2xl border bg-white p-6" style={{ borderColor: BORDER }}><span className="text-xs font-semibold uppercase tracking-[.16em]" style={{ color: GOLD }}>{packagePurchase ? 'Réservation avec un pack' : 'Réservation 1-on-1'}</span><h1 className="mt-2 text-3xl font-semibold" style={{ color: BLUE }}>Réserver avec {coach.full_name}</h1><p className="mt-2 text-sm text-slate-600">Choisissez une offre, une date et l’un des créneaux réellement disponibles.</p></div>

          <div className="rounded-2xl border bg-white p-6" style={{ borderColor: BORDER }}><h2 className="font-semibold" style={{ color: BLUE }}>1. Choisissez une offre</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{coach.offers?.filter(item => !packagePurchase || (item.offer_type === 'fixed' && Number(item.duration_minutes) === Number(packagePurchase.package?.session_duration_minutes))).map(item => <button key={item.id} onClick={() => selectOffer(item.id)} className="rounded-xl border p-4 text-left" style={{ borderColor: offerId === item.id ? GOLD : BORDER, background: offerId === item.id ? 'rgba(191,136,19,.06)' : 'white' }}><div className="flex items-start justify-between gap-3"><div><p className="font-semibold" style={{ color: BLUE }}>{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.offer_type === 'fixed' ? `${item.duration_minutes} minutes` : 'Durée personnalisée'}</p></div><p className="text-sm font-semibold" style={{ color: GOLD }}>{item.offer_type === 'fixed' ? formatXof(item.price_xof) : `${formatXof(item.hourly_price_xof)}/h`}</p></div>{item.description && <p className="mt-3 text-sm leading-6 text-slate-600">{item.description}</p>}</button>)}</div>
            {offer.offer_type === 'custom' && <label className="mt-4 block text-sm font-medium text-slate-700">Durée souhaitée<select value={duration} onChange={e => { setDuration(Number(e.target.value)); setSlots([]); setSlotStart(''); }} className="mt-1 h-11 w-full rounded-xl border px-3" style={{ borderColor: BORDER }}>{Array.from({ length: Math.floor((Number(offer.custom_max_minutes) - Number(offer.custom_min_minutes)) / Number(offer.custom_step_minutes)) + 1 }, (_, index) => Number(offer.custom_min_minutes) + index * Number(offer.custom_step_minutes)).map(value => <option key={value} value={value}>{value} minutes</option>)}</select></label>}
          </div>

          <div className="rounded-2xl border bg-white p-6" style={{ borderColor: BORDER }}><h2 className="font-semibold" style={{ color: BLUE }}>2. Choisissez le créneau</h2><div className="mt-4 flex flex-wrap items-end gap-3"><label className="block flex-1 text-sm font-medium text-slate-700">Date<input type="date" min={isoDate(new Date())} value={date} onChange={e => { setDate(e.target.value); setSlots([]); setSlotStart(''); }} className="mt-1 h-11 w-full rounded-xl border px-3" style={{ borderColor: BORDER }}/></label><button onClick={loadSlots} className="inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white" style={{ background: BLUE }}>{loadingSlots ? <Loader2 className="animate-spin" size={16}/> : <CalendarDays size={16}/>}Voir les créneaux</button></div>{slots.length > 0 && <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">{slots.map(item => <button key={item.slot_start} onClick={() => setSlotStart(item.slot_start)} className="rounded-xl border px-3 py-3 text-sm font-semibold" style={{ borderColor: slotStart === item.slot_start ? GOLD : BORDER, background: slotStart === item.slot_start ? 'rgba(191,136,19,.08)' : 'white', color: BLUE }}>{new Date(item.slot_start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</button>)}</div>}{!loadingSlots && slots.length === 0 && <p className="mt-4 text-sm text-slate-500">Sélectionnez une date puis affichez les créneaux.</p>}</div>

          <div className="rounded-2xl border bg-white p-6" style={{ borderColor: BORDER }}><h2 className="font-semibold" style={{ color: BLUE }}>3. Format et objectif</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{offer.session_modes.map(mode => <button key={mode} onClick={() => setMeetingMode(mode)} className="inline-flex items-center gap-3 rounded-xl border p-4 text-left" style={{ borderColor: meetingMode === mode ? GOLD : BORDER, background: meetingMode === mode ? 'rgba(191,136,19,.06)' : 'white' }}><Video size={20} color={GOLD}/><div><p className="font-semibold" style={{ color: BLUE }}>{mode === 'jitsi' ? 'Salle intégrée OGA' : 'Zoom / Google Meet'}</p><p className="mt-1 text-xs text-slate-500">{mode === 'jitsi' ? 'Accès directement depuis la plateforme' : 'Lien privé fourni pour cette session'}</p></div></button>)}</div><label className="mt-4 block text-sm font-medium text-slate-700">Message au coach<textarea rows={4} maxLength={1500} value={message} onChange={e => setMessage(e.target.value)} className="mt-1 w-full rounded-xl border p-3 text-sm" style={{ borderColor: BORDER }} placeholder="Expliquez votre objectif ou les sujets à préparer." /></label></div>
          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        </section>

        <aside className="h-fit rounded-2xl border bg-white p-5 lg:sticky lg:top-24" style={{ borderColor: BORDER }}><h2 className="font-semibold" style={{ color: BLUE }}>Récapitulatif</h2><div className="mt-4 space-y-4 text-sm"><Summary label="Coach" value={coach.full_name}/><Summary label="Offre" value={offer.title}/><Summary label="Durée" value={`${duration} minutes`}/><Summary label="Date" value={slotStart ? formatCoachingDate(slotStart) : 'À sélectionner'}/><Summary label="Format" value={meetingMode === 'jitsi' ? 'Salle intégrée OGA' : 'Lien externe'}/></div><div className="mt-5 border-t pt-4" style={{ borderColor: BORDER }}><div className="flex items-center justify-between"><span className="text-sm text-slate-500">Prix</span><span className="text-lg font-semibold" style={{ color: BLUE }}>{packagePurchase ? '1 crédit du pack' : formatXof(price)}</span></div><p className="mt-3 text-xs leading-5 text-slate-500">{packagePurchase ? `${packagePurchase.sessions_remaining} crédit(s) disponible(s) avant cette réservation.` : 'Le paiement sécurisé FedaPay confirme définitivement le créneau.'}</p></div><button disabled={busy || !slotStart} onClick={book} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" style={{ background: BLUE }}>{busy && <Loader2 className="animate-spin" size={16}/>} {packagePurchase ? 'Utiliser un crédit du pack' : offer.offer_type === 'custom' ? 'Envoyer la demande' : 'Réserver ce créneau'}</button></aside>
      </div>
    </main>
  </div>;
}

function Summary({ label, value }: { label: string; value: string }) { return <div className="flex items-start justify-between gap-4"><span className="text-slate-500">{label}</span><span className="text-right font-medium text-slate-800">{value}</span></div>; }
