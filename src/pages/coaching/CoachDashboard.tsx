import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, CircleDollarSign, Package, Star } from 'lucide-react';
import CoachWorkspaceLayout from '../../components/coaching/CoachWorkspaceLayout';
import { CoachProfile, CoachingSession, coachingRequest, formatXof } from '../../lib/coachingApi';

const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

type DashboardData = {
  profile: CoachProfile;
  recent_sessions: CoachingSession[];
  metrics: {
    upcoming_sessions: number;
    pending_custom_requests: number;
    completed_sessions: number;
    average_rating: number;
    available_revenue_xof: number;
  };
};

export default function CoachDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    coachingRequest<DashboardData>('coach_dashboard')
      .then(setData)
      .catch(error => setError(error instanceof Error ? error.message : 'Chargement impossible.'));
  }, []);

  const cards = [
    ['Sessions à venir', data?.metrics.upcoming_sessions || 0, CalendarDays],
    ['Revenus disponibles', formatXof(data?.metrics.available_revenue_xof || 0), CircleDollarSign],
    ['Note moyenne', Number(data?.metrics.average_rating || data?.profile?.average_rating || 0).toFixed(1), Star],
    ['Demandes personnalisées', data?.metrics.pending_custom_requests || 0, Package],
  ] as const;

  return <CoachWorkspaceLayout>
    <div>
      <p className="text-xs font-semibold uppercase tracking-[.18em]" style={{ color: GOLD }}>Espace coach</p>
      <h1 className="mt-2 text-3xl font-bold" style={{ color: BLUE }}>Bonjour {data?.profile?.full_name || 'Coach'}</h1>
      {error && <p className="mt-4 rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, Icon]) => <div key={label} className="rounded-2xl border bg-white p-5" style={{ borderColor: BORDER }}>
          <Icon color={GOLD} />
          <p className="mt-4 text-sm text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold" style={{ color: BLUE }}>{value}</p>
        </div>)}
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-3">
        <Card to="/coach/sessions" title="Gérer mes sessions" text="Réservations, salles et suivi des apprenants." />
        <Card to="/coach/produits" title="Packs et groupes" text="Créer des packs de séances et du coaching collectif." />
        <Card to="/coach/revenus" title="Revenus et retraits" text="Consulter les revenus disponibles et demander un payout." />
      </div>

      <section className="mt-6 rounded-2xl border bg-white p-5" style={{ borderColor: BORDER }}>
        <h2 className="font-semibold" style={{ color: BLUE }}>Activité récente</h2>
        {data?.recent_sessions?.length ? <div className="mt-4 divide-y">
          {data.recent_sessions.slice(0, 5).map(session => <div key={session.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
            <div><p className="font-semibold" style={{ color: BLUE }}>{session.offer_title_snapshot}</p><p className="text-xs text-slate-500">{session.status.replace(/_/g, ' ')}</p></div>
            <Link to="/coach/sessions" className="text-sm font-semibold" style={{ color: GOLD }}>Ouvrir</Link>
          </div>)}
        </div> : <p className="mt-4 text-sm text-slate-500">Aucune activité récente.</p>}
      </section>
    </div>
  </CoachWorkspaceLayout>;
}

function Card({ to, title, text }: { to: string; title: string; text: string }) {
  return <Link to={to} className="rounded-2xl border bg-white p-5" style={{ borderColor: BORDER }}>
    <h2 className="font-semibold" style={{ color: BLUE }}>{title}</h2>
    <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
    <span className="mt-4 inline-block text-sm font-semibold" style={{ color: GOLD }}>Ouvrir →</span>
  </Link>;
}
