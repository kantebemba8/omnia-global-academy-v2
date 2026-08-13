import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import OmniaLiveLayout from '../../components/omnia-live/OmniaLiveLayout';
import { LiveItem, liveApi } from './liveApi';

export default function OmniaLiveDetail() {
  const { liveId } = useParams();
  const [item, setItem] = useState<LiveItem | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [media, setMedia] = useState<any[]>([]);
  const [hasAccess, setHasAccess] = useState(false);
  const [entitledMediaIds, setEntitledMediaIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!liveId) return;
    liveApi('get', {}, { event_id: liveId })
      .then((d) => { setItem(d.event || null); setSessions(d.sessions || []); setMedia((d.media || []).filter((m:any)=>['recorded_video','replay'].includes(m.media_type))); setHasAccess(d.viewer_has_access===true); setEntitledMediaIds(Array.isArray(d.viewer_entitled_media_ids)?d.viewer_entitled_media_ids.map(String):[]); })
      .catch(() => { setItem(null); setSessions([]); setMedia([]); setHasAccess(false); setEntitledMediaIds([]); })
      .finally(() => setLoading(false));
  }, [liveId]);

  if (loading) return <OmniaLiveLayout><div className="mx-auto max-w-5xl px-4 py-12 text-slate-500">Chargement...</div></OmniaLiveLayout>;

  return (
    <OmniaLiveLayout>
      <section className="mx-auto max-w-5xl px-4 py-12 md:px-8">
        {item ? <>
          <div className="overflow-hidden rounded-3xl bg-slate-100">{item.cover_url ? <img src={item.cover_url} alt="" className="aspect-[16/7] w-full object-cover" /> : <div className="aspect-[16/7] w-full bg-gradient-to-br from-slate-100 to-amber-50" />}</div>
          <div className="mt-8">
            <div className="flex flex-wrap gap-2 text-xs font-bold uppercase" style={{ color: '#BF8813' }}><span>{item.event_type}</span><span>•</span><span>{item.status}</span></div>
            <h1 className="mt-2 text-4xl font-black" style={{ color: '#002050' }}>{item.title}</h1>
            {item.organizer_display_name && <p className="mt-3 font-semibold text-slate-700">Organisé par {item.organizer_display_name}</p>}
            <p className="mt-5 text-slate-600">{item.long_description || item.short_description}</p>
            {sessions.length > 0 && <div className="mt-8 rounded-2xl border p-6"><h2 className="font-bold" style={{ color: '#002050' }}>Sessions</h2><div className="mt-4 space-y-3">{sessions.map((s) => <div key={s.id} className="rounded-xl bg-slate-50 p-4 text-sm"><strong>{s.title || `Session ${s.sequence_no}`}</strong>{s.starts_at && <div className="mt-1 text-slate-500">{new Date(s.starts_at).toLocaleString()}</div>}</div>)}</div></div>}
            {media.length > 0 && <div className="mt-8 rounded-2xl border p-6"><h2 className="font-bold" style={{ color: '#002050' }}>{item.delivery_type==='recorded_video'?'Programme vidéo / Replays':'Replays disponibles'}</h2><p className="mt-1 text-sm text-slate-500">Les contenus sont présentés dans l’ordre pédagogique défini dans Omnia Live.</p><div className="mt-4 divide-y">{media.map((m:any,i:number)=><div key={m.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><div className="text-xs font-bold text-[#BF8813]">{String(m.sequence_no||i+1).padStart(2,'0')}</div><strong className="block truncate text-sm text-[#002050]">{m.title||m.file_name||`Vidéo ${i+1}`}</strong><div className="mt-1 text-xs text-slate-500">{m.media_type==='replay'?'Replay':'Vidéo préenregistrée'}{m.duration_seconds?` · ${Math.ceil(Number(m.duration_seconds)/60)} min`:''}</div></div>{(hasAccess||entitledMediaIds.includes(String(m.id)))&&m.status==='published'&&m.processing_status==='ready'?<Link to={`/omnia-live/watch/${m.id}`} className="shrink-0 rounded-lg bg-[#002050] px-3 py-2 text-xs font-bold text-white">Regarder</Link>:<span className="shrink-0 text-xs font-semibold text-slate-400">Accès après inscription</span>}</div>)}</div></div>}
            <div className="mt-8 rounded-2xl border p-6">
              <strong style={{ color: '#002050' }}>{item.price_amount ? `${item.price_amount.toLocaleString()} ${item.currency || 'XOF'}` : 'GRATUIT'}</strong>
              <p className="mt-2 text-sm text-slate-500">Une seule inscription couvre l’ensemble de ce Live, de cette formation multi-sessions ou de ce parcours vidéo.</p>
              {!hasAccess&&<Link to={`/omnia-live/${item.id}/inscription`} className="mt-4 inline-flex rounded-xl bg-[#6556B5] px-4 py-2.5 text-sm font-bold text-white">{item.price_amount?'S’inscrire et payer':'S’inscrire gratuitement'}</Link>}
              {hasAccess&&<p className="mt-3 text-sm font-semibold text-emerald-700">Accès confirmé.</p>}
            </div>
          </div>
        </> : <div className="rounded-2xl border border-dashed p-10 text-center text-slate-500">Live introuvable, privé ou non publié.</div>}
      </section>
    </OmniaLiveLayout>
  );
}
