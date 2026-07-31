import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, CheckCircle2, Package, Star, UsersRound, WalletCards } from 'lucide-react';
import CoachWorkspaceLayout from '../../components/coaching/CoachWorkspaceLayout';
import { RoleDashboardActionCard, RoleDashboardPanel, RoleDashboardStatCard } from '../../components/dashboard/RoleDashboardCards';
import { CoachProfile, CoachingSession, coachingRequest, withCoachPreview } from '../../lib/coachingApi';

const BLUE = '#002050';
const GOLD = '#BF8813';

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

  const metrics = data?.metrics;

  return (
    <CoachWorkspaceLayout>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.18em]" style={{ color: GOLD }}>Espace coach</p>
        <h1 className="mt-2 text-3xl font-bold" style={{ color: BLUE }}>Tableau de bord coach</h1>
        <p className="mt-2 text-sm text-slate-500">Suivez vos sessions, demandes et évaluations depuis un seul espace.</p>
        {error && <p className="mt-4 rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <RoleDashboardStatCard label="Sessions à venir" value={metrics?.upcoming_sessions || 0} icon={CalendarDays} accent={BLUE} to={withCoachPreview('/coach/sessions')} />
          <RoleDashboardStatCard label="Sessions terminées" value={metrics?.completed_sessions || 0} icon={CheckCircle2} accent="#1E7A52" to={withCoachPreview('/coach/sessions')} />
          <RoleDashboardStatCard label="Demandes personnalisées" value={metrics?.pending_custom_requests || 0} icon={Package} accent="#7C3AED" to={withCoachPreview('/coach/offres')} />
          <RoleDashboardStatCard label="Note moyenne" value={Number(metrics?.average_rating || data?.profile?.average_rating || 0).toFixed(1)} icon={Star} accent={GOLD} to={withCoachPreview('/coach/avis')} />
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-3">
          <RoleDashboardActionCard to={withCoachPreview('/coach/sessions')} icon={UsersRound} title="Gérer mes sessions" text="Réservations, salles et suivi des apprenants." />
          <RoleDashboardActionCard to={withCoachPreview('/coach/produits')} icon={Package} title="Coaching collectif" text="Créer et suivre vos sessions collectives." accent="#7C3AED" />
          <RoleDashboardActionCard to={withCoachPreview('/coach/revenus')} icon={WalletCards} title="Espace revenus" text="Accéder au suivi financier et aux demandes de retrait." accent="#1E7A52" />
        </div>

        <RoleDashboardPanel className="mt-6">
          <h2 className="font-semibold" style={{ color: BLUE }}>Activité récente</h2>
          {data?.recent_sessions?.length ? (
            <div className="mt-4 divide-y divide-slate-100">
              {data.recent_sessions.slice(0, 5).map(session => (
                <div key={session.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-semibold" style={{ color: BLUE }}>{session.offer_title_snapshot}</p>
                    <p className="text-xs text-slate-500">{session.status.replace(/_/g, ' ')}</p>
                  </div>
                  <Link to={withCoachPreview('/coach/sessions')} className="text-sm font-semibold" style={{ color: GOLD }}>Ouvrir</Link>
                </div>
              ))}
            </div>
          ) : <p className="mt-4 text-sm text-slate-500">Aucune activité récente.</p>}
        </RoleDashboardPanel>
      </div>
    </CoachWorkspaceLayout>
  );
}
