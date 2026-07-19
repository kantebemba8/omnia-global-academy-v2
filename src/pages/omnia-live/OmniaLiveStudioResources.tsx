import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import OmniaLiveLayout from '../../components/omnia-live/OmniaLiveLayout';
import { liveApi } from './liveApi';

const BLUE = '#002050';
const GOLD = '#BF8813';

export default function OmniaLiveStudioResources() {
  const { liveId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [settings, setSettings] = useState({
    chat: true, qa: true, raise_hand: true, polls: true,
    participant_camera: false, participant_microphone: 'on_request', audio_only: true,
  });
  const [certificateRequested, setCertificateRequested] = useState(false);
  const [cpdRequested, setCpdRequested] = useState(false);
  const [attendance, setAttendance] = useState('80');
  const [media, setMedia] = useState<any[]>([]);

  useEffect(() => {
    if (!liveId) return;
    liveApi('studio_get', {}, { event_id: liveId })
      .then((d) => {
        const event = d.event || {};
        setSettings({ ...settings, ...(event.interaction_settings || {}) });
        setCertificateRequested(Boolean(event.certificate_requested));
        setCpdRequested(Boolean(event.cpd_requested));
        setAttendance(String(event.certificate_request_config?.minimum_attendance_percent ?? 80));
        setMedia(Array.isArray(d.media) ? d.media : []);
      })
      .catch((e) => setMessage(e instanceof Error ? e.message : 'Chargement impossible.'))
      .finally(() => setLoading(false));
  }, [liveId]);

  async function save(next = false) {
    if (!liveId) return;
    setSaving(true); setMessage('');
    try {
      await liveApi('update_draft', {
        method: 'POST',
        body: JSON.stringify({
          event_id: liveId,
          interaction_settings: settings,
          certificate_requested: certificateRequested,
          cpd_requested: cpdRequested,
          certificate_request_config: { minimum_attendance_percent: Number(attendance || 0) },
        }),
      });
      if (next) navigate(`/omnia-live/studio/${liveId}/previsualisation`);
      else setMessage('Étape 6 enregistrée.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Enregistrement impossible.');
    } finally { setSaving(false); }
  }

  if (loading) return <OmniaLiveLayout><div className="mx-auto max-w-6xl px-4 py-12 text-slate-500">Chargement...</div></OmniaLiveLayout>;

  const toggles: [string, keyof typeof settings][] = [
    ['Chat', 'chat'], ['Questions / Réponses', 'qa'], ['Lever la main', 'raise_hand'],
    ['Sondages', 'polls'], ['Caméra participants', 'participant_camera'], ['Audio uniquement', 'audio_only'],
  ];

  return <OmniaLiveLayout><section className="mx-auto max-w-6xl px-4 py-10 md:px-8">
    <div className="mb-8"><div className="text-sm font-bold uppercase" style={{color:GOLD}}>Studio Omnia Live · Étape 6 sur 7</div><h1 className="mt-2 text-3xl font-black" style={{color:BLUE}}>Ressources et paramètres</h1></div>
    <div className="space-y-7 rounded-3xl border bg-white p-6 shadow-sm md:p-8">
      <div><h2 className="text-lg font-bold" style={{color:BLUE}}>Interactions</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{toggles.map(([label,key]) => <label key={key} className="flex items-center justify-between rounded-xl border p-4"><span className="font-semibold">{label}</span><input type="checkbox" checked={Boolean(settings[key])} onChange={(e)=>setSettings({...settings,[key]:e.target.checked})}/></label>)}</div>
        <div className="mt-4"><label className="mb-2 block font-semibold">Micro participants</label><select value={settings.participant_microphone} onChange={(e)=>setSettings({...settings,participant_microphone:e.target.value})} className="rounded-xl border px-4 py-3"><option value="disabled">Désactivé</option><option value="on_request">Sur autorisation</option><option value="enabled">Autorisé</option></select></div>
      </div>
      <div><h2 className="text-lg font-bold" style={{color:BLUE}}>Attestation / Certificat / CPD</h2><div className="mt-4 grid gap-3 md:grid-cols-2"><label className="rounded-xl border p-4"><input className="mr-3" type="checkbox" checked={certificateRequested} onChange={(e)=>setCertificateRequested(e.target.checked)}/>Demander un document de participation/réussite</label><label className="rounded-xl border p-4"><input className="mr-3" type="checkbox" checked={cpdRequested} onChange={(e)=>setCpdRequested(e.target.checked)}/>Demander des crédits CPD</label></div>{(certificateRequested||cpdRequested)&&<div className="mt-4 max-w-sm"><label className="mb-2 block text-sm font-semibold">Présence minimale proposée (%)</label><input type="number" min={0} max={100} value={attendance} onChange={(e)=>setAttendance(e.target.value)} className="w-full rounded-xl border px-4 py-3"/></div>}</div>
      <div><h2 className="text-lg font-bold" style={{color:BLUE}}>Ressources rattachées</h2>{media.length?<div className="mt-4 space-y-2">{media.map((m)=><div key={m.id} className="rounded-xl border p-4"><div className="font-semibold">{m.title||m.file_name||m.media_type}</div><div className="text-xs text-slate-500">{m.media_type} · {m.status}</div></div>)}</div>:<div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Aucune ressource pour le moment. Le stockage vidéo/documents sera géré par Omnia via le moteur média.</div>}</div>
      {message&&<div className="rounded-xl bg-slate-50 p-4 text-sm">{message}</div>}
      <div className="flex flex-wrap justify-between gap-3 border-t pt-6"><button onClick={()=>navigate(`/omnia-live/studio/${liveId}/intervenants`)} className="rounded-xl border px-5 py-3 font-semibold">← Étape 5</button><div className="flex gap-3"><button onClick={()=>save(false)} disabled={saving} className="rounded-xl border px-5 py-3 font-bold" style={{borderColor:BLUE,color:BLUE}}>Enregistrer</button><button onClick={()=>save(true)} disabled={saving} className="rounded-xl px-6 py-3 font-bold text-white" style={{background:BLUE}}>{saving?'Enregistrement...':'Continuer →'}</button></div></div>
    </div>
  </section></OmniaLiveLayout>;
}
