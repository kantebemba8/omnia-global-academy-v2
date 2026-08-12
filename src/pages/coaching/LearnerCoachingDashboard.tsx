import { openExternalUrl } from '../../lib/mobile';
import { getSessionToken } from '../../lib/session';
import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, CreditCard, Download, Heart, RefreshCw, Search, Sparkles, Star, UserRound, Video, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import CoachingLayout from '../../components/coaching/CoachingLayout';
import { CoachProfile, CoachingSession, coachingRequest, formatCoachingDate, formatXof } from '../../lib/coachingApi';

const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

type DashboardData = { success: true; sessions: CoachingSession[]; favorites: CoachProfile[] };
type Section = 'upcoming' | 'requests' | 'history' | 'favorites';

const statusLabels: Record<string, string> = {
  pending_coach: 'Réponse du coach attendue', pending_payment: 'Paiement à effectuer', confirmed: 'Confirmée', ready: 'Bientôt disponible', in_progress: 'En cours', completed: 'Terminée', cancelled_by_learner: 'Annulée', cancelled_by_coach: 'Annulée par le coach', declined_by_coach: 'Refusée par le coach', expired: 'Créneau expiré', disputed: 'Vérification administrative', partially_refunded: 'Remboursement partiel', refunded: 'Remboursée', no_show_learner: 'Absence apprenant', no_show_coach: 'Absence coach',
};

export default function LearnerCoachingDashboard() {
  const [searchParams] = useSearchParams();
  const previewMode = searchParams.get('preview') === 'true' && (() => { try { return JSON.parse(localStorage.getItem('omnia_user') || '{}')?.roles?.includes('super_admin') ?? false; } catch { return false; } })();
  const loggedIn = Boolean(getSessionToken());
  const [data, setData] = useState<DashboardData>({ success: true, sessions: [], favorites: [] });
  const [section, setSection] = useState<Section>('upcoming');
  const [loading, setLoading] = useState(loggedIn && !previewMode);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cancelSession, setCancelSession] = useState<CoachingSession | null>(null);

  async function load() {
    if (!loggedIn || previewMode) { setLoading(false); return; }
    setLoading(true); setError('');
    try { setData(await coachingRequest<DashboardData>('learner_coaching_dashboard')); }
    catch (e) { setError(e instanceof Error ? e.message : 'Votre espace coaching est indisponible.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [loggedIn, previewMode]);

  const filtered = useMemo(() => {
    const now = Date.now();
    if (section === 'requests') return data.sessions.filter(item => ['pending_coach', 'pending_payment'].includes(item.status));
    if (section === 'history') return data.sessions.filter(item => ['completed', 'cancelled_by_learner', 'cancelled_by_coach', 'declined_by_coach', 'expired', 'disputed', 'partially_refunded', 'refunded', 'no_show_learner', 'no_show_coach'].includes(item.status) || Boolean(item.scheduled_end && new Date(item.scheduled_end).getTime() < now));
    return data.sessions.filter(item => item.status === 'in_progress' || Boolean(item.scheduled_start && new Date(item.scheduled_start).getTime() >= now && ['confirmed', 'ready'].includes(item.status)));
  }, [data.sessions, section]);

  async function openInvoice(invoiceId: string) {
    setError('');
    try {
      const result = await coachingRequest<{ success: true; signed_url: string }>('invoice_signed_url', { invoice_id: invoiceId });
      void openExternalUrl(result.signed_url);
    } catch (e) { setError(e instanceof Error ? e.message : 'Facture indisponible.'); }
  }

  if (!loggedIn) return <CoachingLayout><main className="mx-auto max-w-2xl px-5 py-20 text-center"><UserRound className="mx-auto" color={GOLD}/><h1 className="mt-4 text-2xl font-semibold" style={{ color: BLUE }}>Connectez-vous pour retrouver vos coachs</h1><p className="mt-3 text-slate-600">Vos demandes, réservations et favoris sont liés à votre compte OGA.</p><Link to="/connexion?redirect=/dashboard/coaching" className="mt-6 inline-block rounded-xl px-5 py-3 text-sm font-semibold text-white" style={{ background: BLUE }}>Se connecter</Link></main></CoachingLayout>;

  return <CoachingLayout>
    <main className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4"><div><span className="text-xs font-semibold uppercase tracking-[.16em]" style={{ color: GOLD }}>Espace apprenant</span><h1 className="mt-2 text-3xl font-semibold" style={{ color: BLUE }}>Mon coaching</h1><p className="mt-2 text-sm text-slate-600">Suivez vos demandes, vos sessions et les coachs enregistrés.</p></div><div className="flex flex-wrap gap-2"><Link to="/dashboard/coaching/avance" className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold" style={{ borderColor: BORDER, color: BLUE }}><Sparkles size={16}/>Recommandations et groupes</Link><Link to="/coaching/explorer" className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{ background: BLUE }}><Search size={16}/>Trouver un coach</Link><button onClick={load} className="rounded-xl border bg-white p-2.5" style={{ borderColor: BORDER, color: BLUE }}><RefreshCw size={17}/></button></div></header>
      {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {notice && <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">{notice}</div>}
      <nav className="mt-6 flex gap-1 overflow-x-auto border-b" style={{ borderColor: BORDER }}>{([['upcoming', 'À venir'], ['requests', 'Demandes et paiements'], ['history', 'Historique'], ['favorites', 'Mes favoris']] as Array<[Section, string]>).map(([value, label]) => <button key={value} onClick={() => setSection(value)} className="whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold" style={{ borderColor: section === value ? GOLD : 'transparent', color: section === value ? BLUE : '#667085' }}>{label}</button>)}</nav>

      {loading ? <div className="py-20 text-center text-sm text-slate-500">Chargement…</div> : section === 'favorites' ? <Favorites coaches={data.favorites} onRemoved={async name => { setNotice(`${name} a été retiré de vos favoris.`); await load(); }} /> : filtered.length ? <section className="mt-5 space-y-4">{filtered.map(session => <article key={session.id} className="rounded-2xl border bg-white p-5" style={{ borderColor: BORDER }}><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold" style={{ color: BLUE }}>{session.offer_title_snapshot}</h2><Status value={session.status}/><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{session.duration_minutes} min</span></div><p className="mt-2 text-sm text-slate-600">Avec <strong>{session.coach?.full_name || session.coach_name_snapshot}</strong></p><div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500"><span className="inline-flex items-center gap-1.5"><CalendarClock size={15}/>{formatCoachingDate(session.scheduled_start || session.requested_start)}</span><span>{formatXof(session.price_total_xof)}</span><span>{session.meeting_mode === 'jitsi' ? 'Salle intégrée OGA' : 'Lien externe'}</span></div>{session.status === 'pending_payment' && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><strong>Créneau réservé temporairement.</strong> Finalisez le paiement FedaPay avant l’expiration du délai.</div>}{session.refund && <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800"><strong>Remboursement :</strong> {session.refund.status.replace(/_/g, ' ')} — {formatXof(session.refund.approved_amount_xof ?? session.refund.requested_amount_xof)}</div>}{session.coach_response_message && <p className="mt-3 text-sm text-slate-500">Réponse du coach : {session.coach_response_message}</p>}</div><div className="flex flex-wrap gap-2">{['confirmed', 'ready', 'in_progress'].includes(session.status) && session.payment_status === 'paid' && <Link to={`/coaching/sessions/${session.id}/room`} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white" style={{ background: GOLD }}><Video size={15}/>Rejoindre</Link>}{['completed','no_show_learner','no_show_coach','disputed','partially_refunded','refunded'].includes(session.status) && <Link to={`/coaching/sessions/${session.id}/suivi`} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold" style={{ borderColor: BORDER, color: BLUE }}><Star size={15}/>Suivi et avis</Link>}{session.status === 'pending_payment' && <Link to={`/coaching/paiement/${session.id}`} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white" style={{ background: BLUE }}><CreditCard size={15}/>Payer</Link>}{session.invoice?.id && <button onClick={() => openInvoice(session.invoice!.id)} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold" style={{ borderColor: BORDER, color: BLUE }}><Download size={15}/>Facture</button>}{session.coach?.public_slug && <Link to={`/coaching/coachs/${session.coach.public_slug}`} className="rounded-lg border px-3 py-2 text-sm font-semibold" style={{ borderColor: BORDER, color: BLUE }}>Voir le coach</Link>}{['pending_coach', 'pending_payment', 'confirmed', 'ready'].includes(session.status) && !session.refund && <button onClick={() => setCancelSession(session)} className="rounded-lg border px-3 py-2 text-sm font-semibold text-red-600" style={{ borderColor: BORDER }}>Annuler</button>}</div></div></article>)}</section> : <div className="mt-6 rounded-2xl border bg-white py-16 text-center" style={{ borderColor: BORDER }}><CalendarClock className="mx-auto" color={GOLD}/><p className="mt-3 text-sm text-slate-500">Aucune session dans cette catégorie.</p></div>}
      {cancelSession && <CancelModal session={cancelSession} onClose={() => setCancelSession(null)} onDone={async () => { setCancelSession(null); setNotice('La demande a été annulée.'); await load(); }} />}
    </main>
  </CoachingLayout>;
}

function Favorites({ coaches, onRemoved }: { coaches: CoachProfile[]; onRemoved: (name: string) => void }) {
  const [busy, setBusy] = useState('');
  async function remove(coach: CoachProfile) { setBusy(coach.id); try { await coachingRequest('favorite_toggle', { coach_id: coach.id, active: false }); onRemoved(coach.full_name); } finally { setBusy(''); } }
  if (!coaches.length) return <div className="mt-6 rounded-2xl border bg-white py-16 text-center" style={{ borderColor: BORDER }}><Heart className="mx-auto" color={GOLD}/><p className="mt-3 text-sm text-slate-500">Vous n’avez pas encore enregistré de coach.</p></div>;
  return <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{coaches.map(coach => <article key={coach.id} className="rounded-2xl border bg-white p-5" style={{ borderColor: BORDER }}><div className="flex items-start gap-3">{coach.photo_url ? <img src={coach.photo_url} alt={coach.full_name} className="h-14 w-14 rounded-xl object-cover"/> : <div className="flex h-14 w-14 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ background: BLUE }}>{coach.full_name.split(' ').map(part => part[0]).slice(0, 2).join('')}</div>}<div><h2 className="font-semibold" style={{ color: BLUE }}>{coach.full_name}</h2><p className="mt-1 text-sm text-slate-500">{coach.professional_title}</p></div></div><div className="mt-4 flex gap-2"><Link to={`/coaching/coachs/${coach.public_slug}`} className="flex-1 rounded-lg px-3 py-2 text-center text-sm font-semibold text-white" style={{ background: BLUE }}>Voir le profil</Link><button disabled={busy === coach.id} onClick={() => remove(coach)} className="rounded-lg border p-2 text-red-600 disabled:opacity-50" style={{ borderColor: BORDER }}><Heart size={17} fill="currentColor"/></button></div></article>)}</section>;
}

function CancelModal({ session, onClose, onDone }: { session: CoachingSession; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reason, setReason] = useState('changement_de_programme');
  const [details, setDetails] = useState('');
  const paid = ['confirmed', 'ready'].includes(session.status) && session.payment_status === 'paid';
  async function confirm() {
    setBusy(true); setError('');
    try {
      await coachingRequest(paid ? 'learner_cancel_paid' : 'booking_cancel_pending', paid
        ? { session_id: session.id, reason_code: reason, reason_details: details }
        : { session_id: session.id });
      onDone();
    } catch (e) { setError(e instanceof Error ? e.message : 'Annulation impossible.'); }
    finally { setBusy(false); }
  }
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold" style={{ color: BLUE }}>Annuler cette session ?</h2><button onClick={onClose} className="p-2"><X size={18}/></button></div><p className="mt-3 text-sm leading-6 text-slate-600">{paid ? 'Le remboursement sera calculé automatiquement selon le délai restant et la politique enregistrée lors du paiement.' : `La demande « ${session.offer_title_snapshot} » sera annulée et le créneau sera libéré.`}</p>{paid && <div className="mt-4 space-y-3"><label className="block text-sm font-medium text-slate-700">Motif<select value={reason} onChange={e => setReason(e.target.value)} className="mt-1 h-11 w-full rounded-xl border px-3" style={{ borderColor: BORDER }}><option value="changement_de_programme">Changement de programme</option><option value="indisponibilite">Indisponibilité</option><option value="erreur_reservation">Erreur de réservation</option><option value="autre">Autre</option></select></label><label className="block text-sm font-medium text-slate-700">Précisions facultatives<textarea value={details} onChange={e => setDetails(e.target.value)} rows={3} className="mt-1 w-full rounded-xl border p-3" style={{ borderColor: BORDER }}/></label></div>}{error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="mt-5 flex justify-end gap-3"><button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm" style={{ borderColor: BORDER }}>Conserver</button><button disabled={busy} onClick={confirm} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Confirmer l’annulation</button></div></div></div>;
}

function Status({ value }: { value: string }) { const danger = ['declined_by_coach', 'cancelled_by_learner', 'cancelled_by_coach', 'expired', 'disputed'].includes(value); const warning = ['pending_coach', 'pending_payment'].includes(value); return <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: danger ? '#FEF2F2' : warning ? '#FFF7E6' : '#ECFDF3', color: danger ? '#B42318' : warning ? '#9A6700' : '#027A48' }}>{statusLabels[value] || value}</span>; }
