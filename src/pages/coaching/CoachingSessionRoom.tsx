import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CalendarClock, CheckCircle2, Clock3, Download, DoorOpen, ExternalLink, Headphones, Link2, Loader2, LogOut, Play, Radio, RefreshCw, ShieldCheck, Square, UsersRound, Video } from 'lucide-react';
import CoachingHeader from '../../components/coaching/CoachingHeader';
import { CoachingAttendance, CoachingRecording, CoachingSessionRoomAccess, coachingRequest, formatCoachingDate } from '../../lib/coachingApi';

const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

type JoinedRoom = { join_url: string; room: { id: string; status: string }; role: string } | null;
type RecordingState = { role: string; recording_enabled: boolean; consents: Array<{ user_id: string; party_role: string; consent_status: string }>; recording: CoachingRecording | null };

export default function CoachingSessionRoom() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<CoachingSessionRoomAccess | null>(null);
  const [joined, setJoined] = useState<JoinedRoom>(null);
  const [audioOnly, setAudioOnly] = useState(false);
  const [meetingUrl, setMeetingUrl] = useState('');
  const [externalPresent, setExternalPresent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [recording, setRecording] = useState<RecordingState | null>(null);
  const heartbeat = useRef<number | null>(null);

  async function load(silent = false) {
    if (!sessionId) return;
    if (!silent) setLoading(true);
    setError('');
    try {
      const [response, recordingData] = await Promise.all([
        coachingRequest<{ success: true } & CoachingSessionRoomAccess>('session_room_access', { session_id: sessionId }),
        coachingRequest<RecordingState>('recording_status', { session_id: sessionId }).catch(() => null),
      ]);
      setData(response);
      setRecording(recordingData);
      setMeetingUrl(response.session.external_meeting_url || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'La session est indisponible.');
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const refresh = window.setInterval(() => load(true), 30000);
    return () => {
      window.clearInterval(refresh);
      if (heartbeat.current) window.clearInterval(heartbeat.current);
      if (sessionId) coachingRequest('session_room_leave', { session_id: sessionId }).catch(() => undefined);
    };
  }, [sessionId]);

  function startHeartbeat() {
    if (!sessionId) return;
    if (heartbeat.current) window.clearInterval(heartbeat.current);
    heartbeat.current = window.setInterval(async () => {
      try {
        await coachingRequest('session_room_heartbeat', { session_id: sessionId });
      } catch {
        if (heartbeat.current) window.clearInterval(heartbeat.current);
      }
    }, 15000);
  }

  async function startSession() {
    if (!sessionId) return;
    setBusy('start'); setError('');
    try {
      await coachingRequest('session_room_start', { session_id: sessionId });
      setNotice('La session est démarrée.');
      await load(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Démarrage impossible.'); }
    finally { setBusy(''); }
  }

  async function joinRoom() {
    if (!sessionId) return;
    setBusy('join'); setError('');
    try {
      const response = await coachingRequest<{ success: true; join_url: string; room: { id: string; status: string }; role: string }>('session_room_join', { session_id: sessionId });
      setJoined(response);
      startHeartbeat();
      await load(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Connexion impossible.'); }
    finally { setBusy(''); }
  }

  async function leaveRoom() {
    if (!sessionId) return;
    setBusy('leave');
    try {
      await coachingRequest('session_room_leave', { session_id: sessionId });
      setJoined(null);
      if (heartbeat.current) window.clearInterval(heartbeat.current);
      setNotice('Votre sortie de la salle a été enregistrée.');
      await load(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Sortie impossible.'); }
    finally { setBusy(''); }
  }

  async function endSession() {
    if (!sessionId) return;
    setBusy('end'); setError('');
    try {
      await coachingRequest('session_room_end', { session_id: sessionId });
      setJoined(null); setConfirmEnd(false);
      if (heartbeat.current) window.clearInterval(heartbeat.current);
      setNotice('La session a été clôturée et les présences ont été enregistrées.');
      await load(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Clôture impossible.'); }
    finally { setBusy(''); }
  }

  async function saveExternalLink() {
    if (!sessionId) return;
    setBusy('link'); setError('');
    try {
      await coachingRequest('session_external_link_save', { session_id: sessionId, meeting_url: meetingUrl });
      setNotice('Le lien de réunion a été enregistré et l’apprenant a été notifié.');
      await load(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Enregistrement impossible.'); }
    finally { setBusy(''); }
  }

  async function markExternal(action: 'join' | 'leave') {
    if (!sessionId) return;
    setBusy(action); setError('');
    try {
      await coachingRequest('session_external_presence', { session_id: sessionId, presence_action: action });
      setExternalPresent(action === 'join');
      setNotice(action === 'join' ? 'Votre présence est enregistrée.' : 'Votre sortie est enregistrée.');
      await load(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Présence impossible à enregistrer.'); }
    finally { setBusy(''); }
  }


  async function setRecordingConsent(consent_status: 'accepted' | 'declined' | 'revoked') {
    if (!sessionId) return; setBusy('consent'); setError('');
    try { await coachingRequest('recording_consent', { session_id: sessionId, consent_status }); setNotice('Votre choix concernant l’enregistrement a été enregistré.'); await load(true); }
    catch (e) { setError(e instanceof Error ? e.message : 'Consentement impossible.'); } finally { setBusy(''); }
  }
  async function recordingAction(action: 'start' | 'stop') {
    if (!sessionId) return; setBusy(`recording-${action}`); setError('');
    try { await coachingRequest(action === 'start' ? 'recording_start' : 'recording_stop', { session_id: sessionId }); setNotice(action === 'start' ? 'La demande d’enregistrement a été transmise.' : 'L’enregistrement est en cours de traitement.'); await load(true); }
    catch (e) { setError(e instanceof Error ? e.message : 'Action d’enregistrement impossible.'); } finally { setBusy(''); }
  }
  async function openRecording() {
    if (!recording?.recording?.id) return;
    setBusy('recording-download');
    try { const result = await coachingRequest<{ signed_url: string }>('recording_signed_url', { recording_id: recording.recording.id }); window.open(result.signed_url, '_blank', 'noopener,noreferrer'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Enregistrement indisponible.'); } finally { setBusy(''); }
  }

  const canManage = data?.role === 'coach' || data?.role === 'admin_supervisor';
  const sessionEnded = ['completed', 'no_show_coach', 'no_show_learner', 'cancelled_by_learner', 'cancelled_by_coach', 'refunded', 'partially_refunded'].includes(data?.session.status || '');
  const statusLabel = useMemo(() => { const labels: Record<string, string> = { confirmed: 'Confirmée', ready: 'Salle disponible', in_progress: 'En cours', completed: 'Terminée', no_show_coach: 'Absence du coach', no_show_learner: 'Absence de l’apprenant' }; return labels[data?.session.status || ''] || data?.session.status?.replace(/_/g, ' '); }, [data?.session.status]);

  if (loading) return <div className="min-h-screen bg-[#F8FAFC]"><CoachingHeader/><div className="mx-auto max-w-7xl px-4 py-20 text-center text-sm text-slate-500">Préparation de la session…</div></div>;

  return <div className="min-h-screen bg-[#F8FAFC]">
    <CoachingHeader />
    <main className="mx-auto max-w-[1500px] px-4 py-6 md:px-6">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div><button onClick={() => navigate(-1)} className="text-sm font-semibold" style={{ color: BLUE }}>← Retour</button><h1 className="mt-2 text-2xl font-semibold" style={{ color: BLUE }}>{data?.session.offer_title_snapshot || 'Session de coaching'}</h1><div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-500"><span className="inline-flex items-center gap-1.5"><CalendarClock size={15}/>{formatCoachingDate(data?.session.scheduled_start)}</span><span className="inline-flex items-center gap-1.5"><Clock3 size={15}/>{data?.session.duration_minutes} minutes</span><span className="rounded-full bg-white px-2.5 py-1 font-semibold" style={{ color: GOLD }}>{statusLabel}</span></div></div>
        <button onClick={() => load()} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold" style={{ borderColor: BORDER, color: BLUE }}><RefreshCw size={16}/>Actualiser</button>
      </header>

      {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {notice && <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">{notice}</div>}

      {data?.access_status === 'too_early' && <section className="rounded-2xl border bg-white p-8 text-center" style={{ borderColor: BORDER }}><Clock3 className="mx-auto" color={GOLD} size={36}/><h2 className="mt-4 text-xl font-semibold" style={{ color: BLUE }}>La salle n’est pas encore ouverte</h2><p className="mt-2 text-sm text-slate-600">Accès à partir du {formatCoachingDate(data.opens_at)}.</p></section>}
      {data?.access_status === 'closed' && !sessionEnded && <section className="rounded-2xl border bg-white p-8 text-center" style={{ borderColor: BORDER }}><DoorOpen className="mx-auto" color={GOLD} size={36}/><h2 className="mt-4 text-xl font-semibold" style={{ color: BLUE }}>La fenêtre d’accès est terminée</h2><p className="mt-2 text-sm text-slate-600">La clôture automatique vérifiera les présences enregistrées.</p></section>}

      {data && data.access_status === 'available' && !sessionEnded && <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="overflow-hidden rounded-3xl bg-slate-950 shadow-xl">
          {data.session.meeting_mode === 'jitsi' ? <>
            <div className="relative min-h-[68vh]">
              {joined?.join_url && !audioOnly ? <iframe title="Session Omnia Coaching" src={joined.join_url} allow="camera; microphone; fullscreen; display-capture; autoplay" className="h-[68vh] w-full border-0"/> : joined?.join_url && audioOnly ? <div className="flex min-h-[68vh] items-center justify-center text-center text-white"><div><Headphones className="mx-auto" size={52}/><h2 className="mt-4 text-xl font-semibold">Mode audio uniquement</h2><p className="mt-2 max-w-md text-sm text-slate-400">La vidéo est masquée dans l’interface pour limiter la consommation de données.</p></div></div> : <div className="flex min-h-[68vh] items-center justify-center p-8 text-center text-white"><div><Video className="mx-auto" size={52}/><h2 className="mt-4 text-xl font-semibold">Salle vidéo Omnia</h2><p className="mt-2 text-sm text-slate-400">Rejoignez la salle pour activer la caméra, le microphone et le chat.</p><button disabled={busy === 'join'} onClick={joinRoom} className="mt-5 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-50" style={{ background: GOLD }}>{busy === 'join' ? <Loader2 className="animate-spin" size={17}/> : <DoorOpen size={17}/>}Rejoindre la salle</button></div></div>}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 p-4 text-white"><span className="text-xs text-slate-400">Salle intégrée OGA · {data.role}</span><div className="flex flex-wrap gap-2">{joined && <button onClick={() => setAudioOnly(value => !value)} className="rounded-xl border border-white/20 px-3 py-2 text-sm">{audioOnly ? 'Afficher la vidéo' : 'Audio uniquement'}</button>}{joined && <button disabled={busy === 'leave'} onClick={leaveRoom} className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-3 py-2 text-sm"><LogOut size={15}/>Quitter</button>}</div></div>
          </> : <ExternalSession data={data} meetingUrl={meetingUrl} setMeetingUrl={setMeetingUrl} canManage={canManage} present={externalPresent} busy={busy} onSave={saveExternalLink} onJoin={() => markExternal('join')} onLeave={() => markExternal('leave')}/>} 
        </section>

        <aside className="space-y-5">
          <section className="rounded-2xl border bg-white p-5" style={{ borderColor: BORDER }}><h2 className="font-semibold" style={{ color: BLUE }}>Commandes de session</h2><div className="mt-4 space-y-2">{canManage && data.session.status !== 'in_progress' && <button disabled={busy === 'start'} onClick={startSession} className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" style={{ background: BLUE }}><Play size={16}/>Démarrer la session</button>}{canManage && <button onClick={() => setConfirmEnd(true)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-700"><Square size={15}/>Clôturer la session</button>}</div><p className="mt-3 text-xs leading-5 text-slate-500">La clôture calcule les présences du coach et de l’apprenant. Une absence du coach crée automatiquement une demande de remboursement total.</p></section>
          <AttendancePanel attendance={data.attendance}/>
          {data.session.meeting_mode === 'jitsi' && <RecordingPanel state={recording} role={data.role} busy={busy} onConsent={setRecordingConsent} onStart={()=>recordingAction('start')} onStop={()=>recordingAction('stop')} onDownload={openRecording}/>}
          {data.role === 'admin_supervisor' && <section className="rounded-2xl border bg-white p-5" style={{ borderColor: BORDER }}><div className="flex items-center gap-2"><ShieldCheck color={GOLD} size={18}/><h2 className="font-semibold" style={{ color: BLUE }}>Supervision administrative</h2></div><p className="mt-2 text-sm text-slate-600">Votre accès est journalisé. Vous pouvez démarrer ou clôturer la session sans modifier votre rôle Super Admin.</p></section>}
        </aside>
      </div>}

      {sessionEnded && data && <section className="rounded-2xl border bg-white p-7" style={{ borderColor: BORDER }}><CheckCircle2 color={GOLD} size={34}/><h2 className="mt-4 text-xl font-semibold" style={{ color: BLUE }}>Session clôturée</h2><p className="mt-2 text-sm text-slate-600">Statut final : <strong>{statusLabel}</strong>. Les présences ci-dessous sont conservées dans l’historique administratif.</p><div className="mt-5 grid max-w-3xl gap-5 md:grid-cols-2"><AttendancePanel attendance={data.attendance}/>{data.session.meeting_mode === 'jitsi' && <RecordingPanel state={recording} role={data.role} busy={busy} onConsent={setRecordingConsent} onStart={()=>recordingAction('start')} onStop={()=>recordingAction('stop')} onDownload={openRecording}/>}</div><div className="mt-5"><Link to={data.role === 'coach' ? '/coach/sessions' : data.role === 'admin_supervisor' ? '/admin/coaching/sessions' : '/dashboard/coaching'} className="inline-flex rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{ background: BLUE }}>Retour aux sessions</Link></div></section>}
    </main>

    {confirmEnd && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"><h2 className="text-lg font-semibold" style={{ color: BLUE }}>Clôturer la session</h2><p className="mt-3 text-sm leading-6 text-slate-600">Cette action ferme la salle et calcule les présences. Elle ne doit être utilisée qu’à la fin réelle de la session.</p><div className="mt-5 flex justify-end gap-3"><button onClick={() => setConfirmEnd(false)} className="rounded-lg border px-4 py-2 text-sm" style={{ borderColor: BORDER }}>Annuler</button><button disabled={busy === 'end'} onClick={endSession} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Clôturer</button></div></div></div>}
  </div>;
}

function ExternalSession({ data, meetingUrl, setMeetingUrl, canManage, present, busy, onSave, onJoin, onLeave }: { data: CoachingSessionRoomAccess; meetingUrl: string; setMeetingUrl: (value: string) => void; canManage: boolean; present: boolean; busy: string; onSave: () => void; onJoin: () => void; onLeave: () => void }) {
  return <div className="flex min-h-[68vh] items-center justify-center p-6 text-white"><div className="w-full max-w-2xl"><ExternalLink className="mx-auto" size={50}/><h2 className="mt-4 text-center text-2xl font-semibold">Réunion externe sécurisée</h2><p className="mt-2 text-center text-sm text-slate-400">Le lien est associé uniquement à cette réservation et n’est jamais affiché sur le profil public du coach.</p>{canManage && <div className="mt-6 rounded-2xl border border-white/15 bg-white/5 p-4"><label className="text-sm font-semibold">Lien Zoom, Google Meet ou autre<input value={meetingUrl} onChange={e => setMeetingUrl(e.target.value)} placeholder="https://..." className="mt-2 h-11 w-full rounded-xl border border-white/20 bg-slate-900 px-3 text-sm text-white outline-none"/></label><button disabled={busy === 'link'} onClick={onSave} className="mt-3 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: GOLD }}><Link2 size={16}/>Enregistrer et notifier</button></div>}{data.session.external_meeting_url ? <div className="mt-6 rounded-2xl border border-white/15 bg-white/5 p-5 text-center"><a href={data.session.external_meeting_url} target="_blank" rel="noreferrer" onClick={onJoin} className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white" style={{ background: GOLD }}><ExternalLink size={17}/>Ouvrir la réunion</a><div className="mt-4 flex justify-center gap-2"><button disabled={present || busy === 'join'} onClick={onJoin} className="rounded-xl border border-white/20 px-4 py-2 text-sm disabled:opacity-40">J’ai rejoint</button><button disabled={!present || busy === 'leave'} onClick={onLeave} className="rounded-xl border border-white/20 px-4 py-2 text-sm disabled:opacity-40">J’ai quitté</button></div></div> : <div className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-center text-sm text-amber-100">{canManage ? 'Ajoutez le lien de réunion avant le rendez-vous.' : data.external_link_visible ? 'Le coach n’a pas encore ajouté le lien.' : 'Le lien apparaîtra peu avant le début de la session.'}</div>}</div></div>;
}


function RecordingPanel({ state, role, busy, onConsent, onStart, onStop, onDownload }: { state: RecordingState | null; role: string; busy: string; onConsent: (status:'accepted'|'declined'|'revoked')=>void; onStart:()=>void; onStop:()=>void; onDownload:()=>void }) {
  const mine = state?.consents.find(item => item.party_role === role);
  const accepted = new Set((state?.consents || []).filter(item => item.consent_status === 'accepted').map(item => item.party_role));
  const bothAccepted = accepted.has('coach') && accepted.has('learner');
  const status = state?.recording?.status;
  return <section className="rounded-2xl border bg-white p-5" style={{ borderColor: BORDER }}><div className="flex items-center gap-2"><Radio size={18} color={GOLD}/><h2 className="font-semibold" style={{ color: BLUE }}>Enregistrement privé</h2></div>{!state?.recording_enabled ? <p className="mt-3 text-sm text-slate-500">Cette fonction est désactivée par le Super Admin.</p> : <><p className="mt-3 text-xs leading-5 text-slate-500">Aucune capture ne démarre sans l’accord explicite du coach et de l’apprenant.</p>{['coach','learner'].includes(role) && <div className="mt-3 flex gap-2"><button onClick={()=>onConsent('accepted')} disabled={busy!==''} className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">J’accepte</button><button onClick={()=>onConsent(mine?.consent_status==='accepted'?'revoked':'declined')} disabled={busy!==''} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">Je refuse</button></div>}<p className="mt-3 text-xs text-slate-500">Coach : {accepted.has('coach')?'accord donné':'en attente'} · Apprenant : {accepted.has('learner')?'accord donné':'en attente'}</p>{['coach','admin_supervisor'].includes(role) && bothAccepted && !['starting','recording','processing','ready'].includes(status||'') && <button onClick={onStart} disabled={busy!==''} className="mt-3 w-full rounded-xl px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{background:BLUE}}>Démarrer l’enregistrement</button>}{['coach','admin_supervisor'].includes(role) && ['starting','recording'].includes(status||'') && <button onClick={onStop} disabled={busy!==''} className="mt-3 w-full rounded-xl bg-red-700 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Arrêter l’enregistrement</button>}{status && <p className="mt-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">Statut : {status.replace(/_/g,' ')}</p>}{status==='ready' && <button onClick={onDownload} disabled={busy!==''} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold" style={{color:BLUE,borderColor:BORDER}}><Download size={15}/>Lire l’enregistrement</button>}</>}</section>
}

function AttendancePanel({ attendance }: { attendance: CoachingAttendance[] }) {
  const rows = attendance.filter(item => item.participant_role !== 'admin_supervisor');
  return <section className="rounded-2xl border bg-white p-5" style={{ borderColor: BORDER }}><div className="flex items-center gap-2"><UsersRound size={18} color={GOLD}/><h2 className="font-semibold" style={{ color: BLUE }}>Présences enregistrées</h2></div><div className="mt-4 space-y-3">{rows.length ? rows.map(item => <div key={`${item.user_id}-${item.participant_role}`} className="flex items-center justify-between rounded-xl bg-slate-50 p-3"><div><p className="text-sm font-semibold capitalize" style={{ color: BLUE }}>{item.participant_role === 'coach' ? 'Coach' : 'Apprenant'}</p><p className="text-xs text-slate-500">Première entrée : {formatCoachingDate(item.first_joined_at)}</p></div><span className="text-sm font-semibold" style={{ color: GOLD }}>{formatDuration(item.duration_seconds)}</span></div>) : <p className="py-4 text-center text-sm text-slate-500">Aucune présence enregistrée.</p>}</div></section>;
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return `${seconds}s`;
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}h ${minutes % 60}min` : `${minutes}min`;
}
