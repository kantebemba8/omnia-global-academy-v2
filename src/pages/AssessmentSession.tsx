import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  FileUp,
  Loader2,
  Mic,
  MonitorUp,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import { DashboardLayout } from '../components/DashboardLayout';
import { AssessmentEngine } from '../components/AssessmentEngine';
import { edgeAuthHeaders } from '../lib/edgeAuth';

const API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/assessment-center`;
const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

async function call(action: string, payload: Record<string, unknown> = {}) {
  const response = await fetch(API, {
    method: 'POST',
    headers: edgeAuthHeaders(),
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await response.json();
  if (!response.ok || data.success === false) throw new Error(data.message || data.error || 'Erreur');
  return data;
}

export default function AssessmentSession() {
  const { sessionId = '' } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [started, setStarted] = useState(false);
  const [identity, setIdentity] = useState(false);
  const [honor, setHonor] = useState(false);
  const [error, setError] = useState('');
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [incidentFile, setIncidentFile] = useState<File | null>(null);
  const [incident, setIncident] = useState({ title: '', description: '', incident_type: 'technical', severity: 'minor' });
  const mediaRef = useRef<MediaStream[]>([]);
  const intentionalStopRef = useRef(false);

  function stopMedia() {
    intentionalStopRef.current = true;
    mediaRef.current.forEach(stream => stream.getTracks().forEach(track => track.stop()));
    mediaRef.current = [];
    if (document.fullscreenElement && document.exitFullscreen) void document.exitFullscreen().catch(() => undefined);
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await call('learner_session_get', { session_id: sessionId });
      setData(result);
      setStarted(Boolean(result.candidate?.started_at));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
    return () => stopMedia();
  }, [load]);

  const settings = data?.session?.proctoring_settings || data?.assessment?.proctoring_settings || {};

  async function log(eventType: string, metadata: Record<string, unknown> = {}) {
    try {
      await call('learner_log_event', {
        session_id: sessionId,
        assessment_id: data?.assessment?.id,
        event_type: eventType,
        metadata,
      });
    } catch {
      // Le journal de surveillance ne doit pas bloquer l'épreuve.
    }
  }

  useEffect(() => {
    if (!started || !settings.tab_switch_tracking) return;
    const visibility = () => void log(document.hidden ? 'tab_hidden' : 'tab_visible');
    const blur = () => void log('page_blur');
    const focus = () => void log('page_focus');
    const fullscreen = () => { if (!document.fullscreenElement) void log('fullscreen_exit'); };
    document.addEventListener('visibilitychange', visibility);
    document.addEventListener('fullscreenchange', fullscreen);
    window.addEventListener('blur', blur);
    window.addEventListener('focus', focus);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      document.removeEventListener('fullscreenchange', fullscreen);
      window.removeEventListener('blur', blur);
      window.removeEventListener('focus', focus);
    };
  }, [started, settings.tab_switch_tracking]);

  async function start() {
    if (data?.session?.identity_verification_required && !identity) {
      setError('Confirmez votre identité avant de démarrer.');
      return;
    }
    if (!honor) {
      setError('Acceptez la déclaration d’intégrité.');
      return;
    }
    setStarting(true);
    setError('');
    intentionalStopRef.current = false;
    try {
      if (settings.camera_required || settings.microphone_required) {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Votre navigateur ne permet pas l’accès caméra/microphone requis.');
        const stream = await navigator.mediaDevices.getUserMedia({ video: settings.camera_required, audio: settings.microphone_required });
        mediaRef.current.push(stream);
        stream.getVideoTracks().forEach(track => track.addEventListener('ended', () => { if (!intentionalStopRef.current) void log('camera_stopped'); }));
        stream.getAudioTracks().forEach(track => track.addEventListener('ended', () => { if (!intentionalStopRef.current) void log('microphone_stopped'); }));
      }
      if (settings.screen_share_required) {
        if (!navigator.mediaDevices?.getDisplayMedia) throw new Error('Votre navigateur ne permet pas le partage d’écran requis.');
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        mediaRef.current.push(stream);
        stream.getTracks().forEach(track => track.addEventListener('ended', () => { if (!intentionalStopRef.current) void log('screen_share_stopped'); }));
      }
      if (settings.fullscreen_required && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      await call('learner_session_start', {
        session_id: sessionId,
        identity_confirmed: identity || !data?.session?.identity_verification_required,
      });
      setStarted(true);
    } catch (caught) {
      stopMedia();
      setError(caught instanceof Error ? caught.message : 'Démarrage impossible.');
    } finally {
      setStarting(false);
    }
  }

  async function uploadIncidentEvidence() {
    if (!incidentFile) return [];
    const prepared = await call('prepare_incident_upload', {
      session_id: sessionId,
      file_name: incidentFile.name,
      size_bytes: incidentFile.size,
      mime_type: incidentFile.type,
    });
    const upload = await fetch(prepared.signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': incidentFile.type || 'application/octet-stream' },
      body: incidentFile,
    });
    if (!upload.ok) throw new Error('La preuve de l’incident n’a pas pu être téléversée.');
    return [{
      bucket_name: prepared.bucket,
      storage_path: prepared.path,
      file_name: incidentFile.name,
      mime_type: incidentFile.type || 'application/octet-stream',
      size_bytes: incidentFile.size,
    }];
  }

  async function reportIncident() {
    if (!incident.title.trim() || !incident.description.trim()) {
      setError('Indiquez le titre et la description de l’incident.');
      return;
    }
    try {
      const evidence = await uploadIncidentEvidence();
      await call('learner_report_incident', {
        session_id: sessionId,
        assessment_id: data.assessment.id,
        ...incident,
        evidence,
      });
      setIncidentOpen(false);
      setIncidentFile(null);
      setIncident({ title: '', description: '', incident_type: 'technical', severity: 'minor' });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Déclaration impossible.');
    }
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl p-6 lg:p-8">
        {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div> : (
          <>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: BLUE }}>{data?.session?.title || 'Session d’évaluation'}</h1>
              <p className="mt-1 text-sm text-gray-500">{data?.course?.title} · surveillance {data?.session?.security_level || 1}/4 · fin {data?.session?.effective_ends_at ? new Date(data.session.effective_ends_at).toLocaleString('fr-FR') : new Date(data?.session?.ends_at).toLocaleString('fr-FR')}</p>
            </div>
            {error && <p className="mt-5 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700"><AlertCircle size={16} />{error}</p>}

            {!started ? (
              <div className="mt-6 rounded-xl border bg-white p-6" style={{ borderColor: BORDER }}>
                <h2 className="flex items-center gap-2 font-semibold" style={{ color: BLUE }}><ShieldCheck size={19} color={GOLD} />Vérifications avant le démarrage</h2>
                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <Requirement icon={Camera} label="Caméra" active={settings.camera_required} />
                  <Requirement icon={Mic} label="Microphone" active={settings.microphone_required} />
                  <Requirement icon={MonitorUp} label="Partage d’écran" active={settings.screen_share_required} />
                </div>
                {data?.assessment?.candidate_instructions && <p className="mt-5 rounded-lg bg-blue-50 p-4 text-sm text-blue-900">{data.assessment.candidate_instructions}</p>}
                {data?.assessment?.integrity_rules && <p className="mt-3 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">{data.assessment.integrity_rules}</p>}
                {data?.session?.identity_verification_required && <label className="mt-5 flex items-start gap-3 text-sm text-gray-700"><input type="checkbox" checked={identity} onChange={event => setIdentity(event.target.checked)} className="mt-1" /><span>Je confirme être la personne inscrite à cette évaluation. Cette déclaration est enregistrée dans le journal de session.</span></label>}
                <label className="mt-4 flex items-start gap-3 text-sm text-gray-700"><input type="checkbox" checked={honor} onChange={event => setHonor(event.target.checked)} className="mt-1" /><span>Je m’engage à respecter les règles d’intégrité et à ne pas utiliser de ressources non autorisées.</span></label>
                <button disabled={starting} onClick={() => void start()} className="mt-6 inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold text-white disabled:opacity-40" style={{ background: BLUE }}>{starting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}Démarrer l’évaluation</button>
              </div>
            ) : (
              <>
                <div className="mt-5 flex justify-end"><button onClick={() => setIncidentOpen(value => !value)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold" style={{ borderColor: GOLD, color: BLUE }}><AlertCircle size={16} />Signaler un incident</button></div>
                {incidentOpen && (
                  <div className="mt-4 rounded-xl border bg-white p-5" style={{ borderColor: BORDER }}>
                    <h3 className="font-semibold" style={{ color: BLUE }}>Signaler un incident</h3>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <select value={incident.incident_type} onChange={event => setIncident(current => ({ ...current, incident_type: event.target.value }))} className="h-10 rounded-lg border px-2 text-sm" style={{ borderColor: BORDER }}><option value="technical">Technique</option><option value="connectivity">Connexion</option><option value="identity">Identité</option><option value="integrity">Intégrité</option><option value="proctoring">Surveillance</option><option value="accessibility">Accessibilité</option><option value="other">Autre</option></select>
                      <select value={incident.severity} onChange={event => setIncident(current => ({ ...current, severity: event.target.value }))} className="h-10 rounded-lg border px-2 text-sm" style={{ borderColor: BORDER }}><option value="minor">Mineur</option><option value="major">Majeur</option><option value="critical">Critique</option></select>
                      <input value={incident.title} onChange={event => setIncident(current => ({ ...current, title: event.target.value }))} className="h-10 rounded-lg border px-3 text-sm md:col-span-2" style={{ borderColor: BORDER }} placeholder="Titre" />
                      <textarea rows={3} value={incident.description} onChange={event => setIncident(current => ({ ...current, description: event.target.value }))} className="rounded-lg border p-3 text-sm md:col-span-2" style={{ borderColor: BORDER }} placeholder="Décrivez précisément le problème…" />
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm md:col-span-2" style={{ borderColor: BORDER }}><FileUp size={16} />{incidentFile?.name || 'Joindre une preuve facultative (10 Mo maximum)'}<input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.json" onChange={event => setIncidentFile(event.target.files?.[0] || null)} /></label>
                    </div>
                    <button onClick={() => void reportIncident()} className="mt-3 rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: BLUE }}>Envoyer</button>
                  </div>
                )}
                <AssessmentEngine courseId={data.course.id} assessmentId={data.assessment.id} sessionId={sessionId} scope={data.assessment.scope} onSubmitted={() => stopMedia()} />
              </>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function Requirement({ icon: Icon, label, active }: { icon: LucideIcon; label: string; active: boolean }) {
  return <div className={`rounded-xl border p-4 ${active ? 'bg-amber-50' : 'bg-gray-50'}`} style={{ borderColor: active ? GOLD : BORDER }}><Icon size={18} color={active ? GOLD : '#9CA3AF'} /><p className="mt-2 text-sm font-semibold" style={{ color: BLUE }}>{label}</p><p className="mt-1 text-xs text-gray-500">{active ? 'Obligatoire pour cette session' : 'Non demandé'}</p></div>;
}
