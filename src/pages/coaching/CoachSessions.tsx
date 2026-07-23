import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Check, Clock3, MessageSquareText, RefreshCw, UserRound, X } from 'lucide-react';
import CoachingHeader from '../../components/coaching/CoachingHeader';
import CoachWorkspaceNav from '../../components/coaching/CoachWorkspaceNav';
import { CoachingSession, CoachingSlot, coachingRequest, formatCoachingDate, formatXof } from '../../lib/coachingApi';

const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

type Filter = 'all' | 'pending' | 'upcoming' | 'past';
const statusLabels: Record<string, string> = {
  pending_coach: 'Réponse du coach attendue', pending_payment: 'Paiement attendu', confirmed: 'Confirmée', ready: 'Bientôt disponible', in_progress: 'En cours', completed: 'Terminée', cancelled_by_learner: 'Annulée par l’apprenant', cancelled_by_coach: 'Annulée par le coach', declined_by_coach: 'Refusée', expired: 'Expirée',
};

export default function CoachSessions() {
  const [sessions, setSessions] = useState<CoachingSession[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [decision, setDecision] = useState<CoachingSession | null>(null);

  async function load() {
    setLoading(true); setError('');
    try { const data = await coachingRequest<{ success: true; sessions: CoachingSession[] }>('coach_sessions'); setSessions(data.sessions); }
    catch (e) { setError(e instanceof Error ? e.message : 'Sessions indisponibles.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const displayed = useMemo(() => {
    const now = Date.now();
    return sessions.filter(item => {
      if (filter === 'pending') return ['pending_coach', 'pending_payment'].includes(item.status);
      if (filter === 'upcoming') return Boolean(item.scheduled_start && new Date(item.scheduled_start).getTime() >= now && ['pending_payment', 'confirmed', 'ready'].includes(item.status));
      if (filter === 'past') return ['completed', 'cancelled_by_learner', 'cancelled_by_coach', 'declined_by_coach', 'expired'].includes(item.status) || Boolean(item.scheduled_end && new Date(item.scheduled_end).getTime() < now);
      return true;
    });
  }, [sessions, filter]);

  return <div className="min-h-screen bg-[#F8FAFC]">
    <CoachingHeader />
    <main className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      <CoachWorkspaceNav />
      <header className="flex flex-wrap items-start justify-between gap-4"><div><span className="text-xs font-semibold uppercase tracking-[.16em]" style={{ color: GOLD }}>Espace coach</span><h1 className="mt-2 text-3xl font-semibold" style={{ color: BLUE }}>Mes sessions</h1><p className="mt-2 text-sm text-slate-600">Gérez les demandes personnalisées et consultez les pré-réservations en attente de paiement.</p></div><button onClick={load} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold" style={{ borderColor: BORDER, color: BLUE }}><RefreshCw size={16}/>Actualiser</button></header>
      {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {notice && <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">{notice}</div>}
      <nav className="mt-6 flex gap-1 overflow-x-auto border-b" style={{ borderColor: BORDER }}>{([['all', 'Toutes'], ['pending', 'En attente'], ['upcoming', 'À venir'], ['past', 'Historique']] as Array<[Filter, string]>).map(([value, label]) => <button key={value} onClick={() => setFilter(value)} className="whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold" style={{ borderColor: filter === value ? GOLD : 'transparent', color: filter === value ? BLUE : '#667085' }}>{label}</button>)}</nav>

      {loading ? <div className="py-20 text-center text-sm text-slate-500">Chargement des sessions…</div> : displayed.length ? <section className="mt-5 space-y-4">{displayed.map(session => <article key={session.id} className="rounded-2xl border bg-white p-5" style={{ borderColor: BORDER }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold" style={{ color: BLUE }}>{session.offer_title_snapshot}</h2><Status value={session.status}/><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{session.duration_minutes} min</span></div><p className="mt-2 text-sm text-slate-600">Apprenant : <strong>{session.learner?.full_name || 'Utilisateur OGA'}</strong></p><div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500"><span className="inline-flex items-center gap-1.5"><CalendarClock size={15}/>{formatCoachingDate(session.scheduled_start || session.requested_start)}</span><span className="inline-flex items-center gap-1.5"><Clock3 size={15}/>{formatXof(session.price_total_xof)}</span><span>{session.meeting_mode === 'jitsi' ? 'Salle intégrée OGA' : 'Lien externe'}</span></div>{session.learner_message && <div className="mt-4 flex gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700"><MessageSquareText className="shrink-0" size={17}/><p>{session.learner_message}</p></div>}{session.coach_response_message && <p className="mt-3 text-sm text-slate-500">Votre réponse : {session.coach_response_message}</p>}</div>
          {session.status === 'pending_coach' && <button onClick={() => setDecision(session)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{ background: BLUE }}>Répondre</button>}
        </div>
      </article>)}</section> : <div className="mt-6 rounded-2xl border bg-white py-16 text-center" style={{ borderColor: BORDER }}><UserRound className="mx-auto" color={GOLD}/><p className="mt-3 text-sm text-slate-500">Aucune session dans cette catégorie.</p></div>}
      {decision && <DecisionModal session={decision} onClose={() => setDecision(null)} onDone={async message => { setDecision(null); setNotice(message); await load(); }} />}
    </main>
  </div>;
}

function DecisionModal({ session, onClose, onDone }: { session: CoachingSession; onClose: () => void; onDone: (message: string) => void }) {
  const [mode, setMode] = useState<'accept' | 'propose' | 'decline'>('accept');
  const [message, setMessage] = useState('');
  const [date, setDate] = useState(new Date(session.requested_start || Date.now()).toISOString().slice(0, 10));
  const [slots, setSlots] = useState<CoachingSlot[]>([]);
  const [slot, setSlot] = useState('');
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function findSlots() {
    if (!session.offer_id) return;
    setLoadingSlots(true); setError('');
    try {
      const result = await coachingRequest<{ success: true; slots: CoachingSlot[] }>('coach_request_availability', { session_id: session.id, from_date: date, to_date: date });
      setSlots(result.slots); setSlot(result.slots[0]?.slot_start || '');
    } catch (e) { setError(e instanceof Error ? e.message : 'Créneaux indisponibles.'); }
    finally { setLoadingSlots(false); }
  }

  async function submit() {
    setBusy(true); setError('');
    try {
      await coachingRequest('coach_custom_request_decide', { session_id: session.id, decision: mode, message, slot_start: mode === 'propose' ? slot : undefined });
      onDone(mode === 'decline' ? 'La demande a été refusée.' : 'La demande a été acceptée et attend maintenant le paiement de l’apprenant.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Réponse impossible.'); }
    finally { setBusy(false); }
  }

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"><div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl"><div className="flex items-center justify-between border-b pb-4" style={{ borderColor: BORDER }}><div><h2 className="text-lg font-semibold" style={{ color: BLUE }}>Répondre à la demande</h2><p className="mt-1 text-sm text-slate-500">{session.duration_minutes} minutes · {formatCoachingDate(session.requested_start)}</p></div><button onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100"><X size={18}/></button></div>
    <div className="mt-5 grid gap-2 sm:grid-cols-3">{([['accept', 'Accepter', Check], ['propose', 'Autre créneau', CalendarClock], ['decline', 'Refuser', X]] as const).map(([value, label, Icon]) => <button key={value} onClick={() => setMode(value)} className="inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold" style={{ borderColor: mode === value ? GOLD : BORDER, background: mode === value ? 'rgba(191,136,19,.08)' : 'white', color: mode === 'decline' && value === mode ? '#B42318' : BLUE }}><Icon size={16}/>{label}</button>)}</div>
    {mode === 'propose' && <div className="mt-4 rounded-xl bg-slate-50 p-4"><label className="block text-sm font-medium text-slate-700">Date proposée<input type="date" value={date} onChange={e => { setDate(e.target.value); setSlots([]); setSlot(''); }} className="mt-1 h-10 w-full rounded-lg border px-3" style={{ borderColor: BORDER }}/></label><button onClick={findSlots} className="mt-3 rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: BLUE }}>{loadingSlots ? 'Recherche…' : 'Afficher mes créneaux'}</button>{slots.length > 0 && <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{slots.map(item => <button key={item.slot_start} onClick={() => setSlot(item.slot_start)} className="rounded-lg border px-3 py-2 text-sm font-semibold" style={{ borderColor: slot === item.slot_start ? GOLD : BORDER, background: slot === item.slot_start ? 'rgba(191,136,19,.08)' : 'white', color: BLUE }}>{new Date(item.slot_start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</button>)}</div>}</div>}
    <label className="mt-4 block text-sm font-medium text-slate-700">Message facultatif<textarea rows={3} value={message} onChange={e => setMessage(e.target.value)} className="mt-1 w-full rounded-xl border p-3 text-sm" style={{ borderColor: BORDER }} /></label>
    {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="mt-5 flex justify-end gap-3"><button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm" style={{ borderColor: BORDER }}>Annuler</button><button disabled={busy || (mode === 'propose' && !slot)} onClick={submit} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: mode === 'decline' ? '#B42318' : BLUE }}>Confirmer</button></div>
  </div></div>;
}

function Status({ value }: { value: string }) { const danger = ['declined_by_coach', 'cancelled_by_learner', 'cancelled_by_coach', 'expired'].includes(value); const warning = ['pending_coach', 'pending_payment'].includes(value); return <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: danger ? '#FEF2F2' : warning ? '#FFF7E6' : '#ECFDF3', color: danger ? '#B42318' : warning ? '#9A6700' : '#027A48' }}>{statusLabels[value] || value}</span>; }
