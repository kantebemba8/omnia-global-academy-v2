import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { liveApi } from './liveApi';

export default function AdminOmniaLive() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    liveApi('admin_queue')
      .then((d) => setItems(d.items || d.events || []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Impossible de charger les demandes.'))
      .finally(() => setLoading(false));
  }, []);

  const submitted = items.filter((x) => ['submitted', 'under_review', 'changes_requested'].includes(x.status)).length;
  return (
    <AdminLayout>
      <div className="p-6 md:p-8">
        <h1 className="text-3xl font-black" style={{ color: '#002050' }}>Gestion Omnia Live</h1>
        <p className="mt-2 text-slate-600">Centre de contrôle initial des demandes et contenus Omnia Live.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Demandes à traiter', submitted],
            ['Éléments chargés', items.length],
            ['Replays à valider', 0],
            ['Incidents ouverts', 0],
          ].map(([label, value]) => <div key={String(label)} className="rounded-2xl border bg-white p-5"><div className="text-sm text-slate-500">{label}</div><div className="mt-3 text-3xl font-black" style={{ color: '#002050' }}>{value}</div></div>)}
        </div>
        <div className="mt-8 rounded-2xl border bg-white p-6">
          <h2 className="text-lg font-bold" style={{ color: '#002050' }}>Demandes récentes</h2>
          {loading ? <p className="mt-4 text-sm text-slate-500">Chargement...</p> : error ? <p className="mt-4 text-sm text-red-600">{error}</p> : items.length ? <div className="mt-4 divide-y">{items.slice(0, 20).map((x) => <div key={x.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><div className="font-semibold text-slate-800">{x.title}</div><div className="text-xs text-slate-500">{x.organizer_display_name || 'Organisateur'} · {x.status}</div></div><a href={`/omnia-live/${x.id}`} className="rounded-lg border px-3 py-2 text-sm font-semibold">Prévisualiser</a></div>)}</div> : <p className="mt-4 text-sm text-slate-500">Aucune demande Omnia Live pour le moment.</p>}
        </div>
      </div>
    </AdminLayout>
  );
}
