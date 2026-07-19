import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import OmniaLiveLayout from '../../components/omnia-live/OmniaLiveLayout';
import { liveApi } from './liveApi';

const BLUE='#002050', GOLD='#BF8813';

export default function OmniaLiveStudioResources(){
  const {liveId}=useParams(); const navigate=useNavigate();
  const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[message,setMessage]=useState('');
  const [chat,setChat]=useState(true),[qa,setQa]=useState(true),[raiseHand,setRaiseHand]=useState(true),[polls,setPolls]=useState(true);
  const [participantCamera,setParticipantCamera]=useState(false),[participantMic,setParticipantMic]=useState('on_request'),[audioOnly,setAudioOnly]=useState(true);
  const [certificateRequested,setCertificateRequested]=useState(false),[cpdRequested,setCpdRequested]=useState(false);
  const [attendanceMin,setAttendanceMin]=useState('80');
  const [media,setMedia]=useState<any[]>([]);

  useEffect(()=>{ if(!liveId)return;
    liveApi('studio_get',{}, {event_id:liveId}).then(d=>{
      const e=d?.event||{}, s=e.interaction_settings||{};
      setChat(s.chat!==false); setQa(s.qa!==false); setRaiseHand(s.raise_hand!==false); setPolls(s.polls!==false);
      setParticipantCamera(Boolean(s.participant_camera)); setParticipantMic(s.participant_microphone||'on_request'); setAudioOnly(s.audio_only!==false);
      setCertificateRequested(Boolean(e.certificate_requested)); setCpdRequested(Boolean(e.cpd_requested));
      setAttendanceMin(String(e.certificate_request_config?.minimum_attendance_percent ?? 80));
      setMedia(Array.isArray(d?.media)?d.media:[]);
    }).catch(e=>setMessage(e instanceof Error?e.message:'Chargement impossible.')).finally(()=>setLoading(false));
  },[liveId]);

  async function save(next=false){
    if(!liveId)return; setSaving(true); setMessage('');
    try{
      await liveApi('update_draft',{method:'POST',body:JSON.stringify({
        event_id:liveId,
        interaction_settings:{chat,qa,raise_hand:raiseHand,polls,participant_camera:participantCamera,participant_microphone:participantMic,audio_only:audioOnly},
        certificate_requested:certificateRequested,
        cpd_requested:cpdRequested,
        certificate_request_config:{minimum_attendance_percent:Number(attendanceMin||0)}
      })});
      if(next) navigate(`/omnia-live/studio/${liveId}/previsualisation`);
      else setMessage('Étape 6 enregistrée.');
    }catch(e){setMessage(e instanceof Error?e.message:'Enregistrement impossible.')}finally{setSaving(false)}
  }

  if(loading)return <OmniaLiveLayout><div className="mx-auto max-w-6xl px-4 py-12 text-slate-500">Chargement...</div></OmniaLiveLayout>;

  const toggles=[
    ['Chat',chat,setChat],['Questions / Réponses',qa,setQa],['Lever la main',raiseHand,setRaiseHand],['Sondages',polls,setPolls],
    ['Caméra participants',participantCamera,setParticipantCamera],['Mode audio uniquement',audioOnly,setAudioOnly],
  ] as const;

  return <OmniaLiveLayout><section className="mx-auto max-w-6xl px-4 py-10 md:px-8">
    <div className="mb-8"><div className="text-sm font-bold uppercase tracking-wide" style={{color:GOLD}}>Studio Omnia Live · Étape 6 sur 7</div><h1 className="mt-2 text-3xl font-black" style={{color:BLUE}}>Ressources et paramètres</h1></div>
    <div className="space-y-7 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <div><h2 className="text-lg font-bold" style={{color:BLUE}}>Interactions pendant le Live</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">{toggles.map(([label,value,setter])=><label key={label} className="flex items-center justify-between rounded-xl border border-slate-200 p-4"><span className="font-semibold">{label}</span><input type="checkbox" checked={value as boolean} onChange={e=>(setter as any)(e.target.checked)}/></label>)}</div>
        <div className="mt-4"><label className="mb-2 block font-semibold">Micro participants</label><select value={participantMic} onChange={e=>setParticipantMic(e.target.value)} className="rounded-xl border border-slate-300 px-4 py-3"><option value="disabled">Désactivé</option><option value="on_request">Sur autorisation</option><option value="enabled">Autorisé</option></select></div>
      </div>

      <div><h2 className="text-lg font-bold" style={{color:BLUE}}>Attestation / certificat / CPD</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="rounded-xl border border-slate-200 p-4"><div className="flex gap-3"><input type="checkbox" checked={certificateRequested} onChange={e=>setCertificateRequested(e.target.checked)}/><div><div className="font-semibold">Demander un document de participation ou réussite</div><p className="text-sm text-slate-500">Soumis à validation Super Admin.</p></div></div></label>
          <label className="rounded-xl border border-slate-200 p-4"><div className="flex gap-3"><input type="checkbox" checked={cpdRequested} onChange={e=>setCpdRequested(e.target.checked)}/><div><div className="font-semibold">Demander des crédits CPD</div><p className="text-sm text-slate-500">Uniquement si le programme est réellement éligible.</p></div></div></label>
        </div>
        {(certificateRequested||cpdRequested)&&<div className="mt-4 max-w-sm"><label className="mb-2 block text-sm font-semibold">Présence minimale proposée (%)</label><input type="number" min={0} max={100} value={attendanceMin} onChange={e=>setAttendanceMin(e.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3"/></div>}
      </div>

      <div><h2 className="text-lg font-bold" style={{color:BLUE}}>Ressources déjà rattachées</h2>
        {media.length?<div className="mt-4 space-y-2">{media.map(m=><div key={m.id} className="rounded-xl border border-slate-200 p-4"><div className="font-semibold">{m.title||m.file_name||m.media_type}</div><div className="text-xs text-slate-500">{m.media_type} · {m.status}</div></div>)}</div>:<div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Aucune ressource rattachée pour le moment. Les fichiers vidéo, documents et replays seront stockés et sécurisés par Omnia lors de l’intégration du moteur média.</div>}
      </div>

      {message&&<div className="rounded-xl bg-slate-50 px-4 py-3 text-sm">{message}</div>}
      <div className="flex flex-wrap justify-between gap-3 border-t pt-6">
        <button onClick={()=>navigate(`/omnia-live/studio/${liveId}/intervenants`)} className="rounded-xl border border-slate-300 px-5 py-3 font-semibold">← Étape 5</button>
        <div className="flex gap-3"><button onClick={()=>save(false)} disabled={saving} className="rounded-xl border px-5 py-3 font-bold" style={{borderColor:BLUE,color:BLUE}}>Enregistrer</button><button onClick={()=>save(true)} disabled={saving} className="rounded-xl px-6 py-3 font-bold text-white" style={{background:BLUE}}>{saving?'Enregistrement...':'Continuer →'}</button></div>
      </div>
    </div>
  </section></OmniaLiveLayout>;
}
