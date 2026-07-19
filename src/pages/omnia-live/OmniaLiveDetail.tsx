import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import OmniaLiveLayout from '../../components/omnia-live/OmniaLiveLayout';
import { LiveItem, liveApi } from './liveApi';

export default function OmniaLiveDetail() {
  const { liveId } = useParams();
  const [item, setItem] = useState<LiveItem | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!liveId) return;
    liveApi('get', {}, { event_id: liveId })
      .then((d) => { setItem(d.event || null); setSessions(d.sessions || []); })
      .catch(() => { setItem(null); setSessions([]); })
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
            <div className="mt-8 rounded-2xl border p-6">
              <strong style={{ color: '#002050' }}>{item.price_amount ? `${item.price_amount.toLocaleString()} ${item.currency || 'XOF'}` : 'GRATUIT'}</strong>
              <p className="mt-2 text-sm text-slate-500">L’inscription et le paiement seront activés dans la prochaine phase. Les droits d’accès resteront contrôlés par Omnia.</p>
            </div>
          </div>
        </> : <div className="rounded-2xl border border-dashed p-10 text-center text-slate-500">Live introuvable, privé ou non publié.</div>}
      </section>
    </OmniaLiveLayout>
  );
}
