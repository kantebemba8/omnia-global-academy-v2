import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, LogIn, LogOut, Play, Square, Users } from 'lucide-react';
import CoachingHeader from '../../components/coaching/CoachingHeader';
import JaasMeetingFrame, { type JaasMeetingAccess } from '../../components/video/JaasMeetingFrame';
import { CoachingGroupProgram, coachingRequest, formatCoachingDate } from '../../lib/coachingApi';

const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

type Access = {
  program: CoachingGroupProgram;
  role: 'coach' | 'learner' | 'admin_supervisor';
  access_status: 'too_early' | 'available' | 'closed';
  opens_at: string;
  closes_at: string;
  join_url?: string | null;
  meeting?: JaasMeetingAccess | null;
  security_mode?: 'jaas' | 'development_public_jitsi' | null;
};

export default function CoachingGroupRoom() {
  const { programId = '' } = useParams();
  const [data, setData] = useState<Access | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [joined, setJoined] = useState(false);

  async function load() {
    try {
      setData(await coachingRequest<Access>('group_room_access', { program_id: programId }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Salle indisponible.');
    }
  }

  useEffect(() => { void load(); }, [programId]);

  async function action(name: 'join' | 'leave' | 'start' | 'end') {
    setBusy(name);
    try {
      const response = await coachingRequest<Access>(`group_room_${name}`, { program_id: programId });
      setData(response);
      if (name === 'join') setJoined(true);
      if (name === 'leave') setJoined(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action impossible.');
    } finally {
      setBusy('');
    }
  }

  useEffect(() => () => {
    if (joined) void coachingRequest('group_room_leave', { program_id: programId }).catch(() => undefined);
  }, [joined, programId]);

  const integratedMeeting = data?.program.meeting_mode === 'jitsi' && data?.access_status === 'available';
  const externalMeeting = data?.program.meeting_mode === 'external' && data?.access_status === 'available' && data?.join_url;

  return <div className="min-h-screen bg-slate-950">
    <CoachingHeader />
    <main className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-white">
        <div>
          <Link to="/dashboard/coaching/avance" className="inline-flex items-center gap-1 text-sm text-slate-300"><ArrowLeft size={15}/>Retour</Link>
          <h1 className="mt-2 text-2xl font-bold">{data?.program.title || 'Salle collective'}</h1>
          <p className="mt-1 text-sm text-slate-300">{data?.program && formatCoachingDate(data.program.scheduled_start)} · {data?.program.confirmed_count || 0}/{data?.program.capacity} participants</p>
        </div>
        <div className="flex gap-2">
          {data?.role === 'learner' && !joined && <button onClick={() => action('join')} disabled={busy !== '' || data.access_status !== 'available'} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-semibold text-white disabled:opacity-50" style={{ background: GOLD }}><LogIn size={16}/>Rejoindre</button>}
          {joined && <button onClick={() => action('leave')} className="inline-flex items-center gap-2 rounded-xl bg-slate-700 px-4 py-2.5 font-semibold"><LogOut size={16}/>Quitter</button>}
          {['coach', 'admin_supervisor'].includes(data?.role || '') && <>
            <button onClick={() => action('start')} disabled={busy !== '' || data?.access_status !== 'available'} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 font-semibold disabled:opacity-50"><Play size={16}/>Démarrer</button>
            <button onClick={() => action('end')} disabled={busy !== ''} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 font-semibold"><Square size={16}/>Terminer</button>
          </>}
        </div>
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-950/50 p-4 text-red-200">{error}</div>}
      {data?.access_status === 'too_early' && <Notice text={`La salle ouvrira le ${formatCoachingDate(data.opens_at)}.`}/>} 
      {data?.access_status === 'closed' && <Notice text="La fenêtre d’accès à cette salle est terminée."/>}

      {integratedMeeting && <div className="overflow-hidden rounded-2xl border border-slate-700 bg-black" style={{ height: 'calc(100vh - 210px)' }}>
        {data?.meeting ? <JaasMeetingFrame meeting={data.meeting} className="h-full w-full"/> : data?.join_url ? <iframe title="Omnia Coaching collectif — mode de développement" src={data.join_url} allow="camera; microphone; fullscreen; display-capture; autoplay" className="h-full w-full"/> : <div className="flex h-full flex-col items-center justify-center gap-4 text-center text-white"><Users size={52} color={GOLD}/><p>Le moteur vidéo sécurisé n’est pas encore configuré.</p></div>}
      </div>}

      {externalMeeting && <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 rounded-2xl border border-slate-700 bg-black text-white"><Users size={52} color={GOLD}/><p>Cette session utilise un outil externe sécurisé.</p><a href={data.join_url || '#'} target="_blank" rel="noreferrer" className="rounded-xl px-5 py-3 font-semibold text-white" style={{ background: GOLD }}>Ouvrir la réunion</a></div>}
    </main>
  </div>;
}

function Notice({ text }: { text: string }) {
  return <div className="rounded-2xl border p-8 text-center text-slate-200" style={{ borderColor: BORDER }}>{text}</div>;
}
