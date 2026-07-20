import { useEffect, useMemo, useState } from 'react';
import OmniaLiveLayout from '../../components/omnia-live/OmniaLiveLayout';
import LiveCard from './LiveCard';
import { LiveItem, liveApi } from './liveApi';

export default function CatalogView({ title, subtitle, filter }: { title: string; subtitle: string; filter?: string }) {
  const [items, setItems] = useState<LiveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const params = useMemo(() => {
    if (filter === 'live') return { status: 'live' };
    if (filter === 'training') return { delivery_type: 'synchronous_training' };
    if (filter === 'video') return { delivery_type: 'recorded_video' };
    if (filter === 'replay') return {};
    return {};
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    setError('');
    liveApi('list', {}, params)
      .then((d) => {
        let next = (d.items || []) as LiveItem[];
        if (filter === 'replay') {
          next = next.filter((item) => item.replay_enabled && ['completed','published','live'].includes(item.status || ''));
        }
        if (filter === 'upcoming') {
          const now = Date.now();
          next = next.filter((item) => item.starts_at && new Date(item.starts_at).getTime() > now && item.status === 'published');
        }
        setItems(next);
      })
      .catch((e) => {
        setItems([]);
        setError(e instanceof Error ? e.message : 'Impossible de charger le catalogue.');
      })
      .finally(() => setLoading(false));
  }, [filter, params]);

  return (
    <OmniaLiveLayout>
      <section className="mx-auto max-w-7xl px-4 py-10 md:px-8">
        <h1 className="text-3xl font-extrabold md:text-4xl" style={{ color: '#002050' }}>{title}</h1>
        <p className="mt-3 max-w-3xl text-slate-600">{subtitle}</p>
        {loading ? (
          <div className="mt-10 text-slate-500">Chargement...</div>
        ) : error ? (
          <div className="mt-10 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>
        ) : items.length ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => <LiveCard key={item.id} item={item} />)}
          </div>
        ) : (
          <div className="mt-10 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
            <h2 className="font-bold text-slate-700">Aucun contenu disponible pour le moment</h2>
            <p className="mt-2 text-sm text-slate-500">Les nouveaux contenus apparaîtront ici après validation par Omnia.</p>
          </div>
        )}
      </section>
    </OmniaLiveLayout>
  );
}
