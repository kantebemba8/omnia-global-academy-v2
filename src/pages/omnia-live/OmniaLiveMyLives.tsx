import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import OmniaLiveLayout from '../../components/omnia-live/OmniaLiveLayout';
import LiveCard from './LiveCard';
import { LiveItem, liveApi } from './liveApi';

export default function OmniaLiveMyLives() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [registered, setRegistered] = useState<LiveItem[]>([]);
  const [organized, setOrganized] = useState<LiveItem[]>([]);

  useEffect(() => {
    liveApi('my')
      .then((d) => {
        setRegistered((d.registrations || []).map((r: any) => r.live_events).filter(Boolean));
        setOrganized(d.organized || []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Connexion requise.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <OmniaLiveLayout>
      <section className="mx-auto max-w-7xl px-4 py-12 md:px-8">
        <h1 className="text-3xl font-black" style={{ color: '#002050' }}>Mes Lives</h1>
        {loading ? <p className="mt-8 text-slate-500">Chargement...</p> : error ? (
          <div className="mt-8 rounded-2xl border bg-slate-50 p-8">
            <h2 className="font-bold" style={{ color: '#002050' }}>Connexion requise</h2>
            <p className="mt-2 text-sm text-slate-600">{error}</p>
            <Link to="/connexion" className="mt-5 inline-block rounded-xl px-5 py-3 font-bold text-white" style={{ background: '#002050' }}>Se connecter</Link>
          </div>
        ) : (
          <div className="mt-8 space-y-12">
            <div>
              <h2 className="text-xl font-bold" style={{ color: '#002050' }}>Mes inscriptions</h2>
              {registered.length ? <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{registered.map((x) => <LiveCard key={x.id} item={x} />)}</div> : <p className="mt-4 text-sm text-slate-500">Aucune inscription Omnia Live pour le moment.</p>}
            </div>
            {organized.length > 0 && <div>
              <h2 className="text-xl font-bold" style={{ color: '#002050' }}>Mes contenus organisés</h2>
              <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{organized.map((x) => <LiveCard key={x.id} item={x} />)}</div>
            </div>}
          </div>
        )}
      </section>
    </OmniaLiveLayout>
  );
}
