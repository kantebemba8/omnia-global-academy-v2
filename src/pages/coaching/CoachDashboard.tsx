import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, CheckCircle2, Package, Star } from 'lucide-react';
import CoachWorkspaceLayout from '../../components/coaching/CoachWorkspaceLayout';
import { RoleDashboardPanel, RoleDashboardStatCard } from '../../components/dashboard/RoleDashboardCards';
import { CoachProfile, CoachingSession, coachingRequest, withCoachPreview } from '../../lib/coachingApi';
import { dashboardGreeting } from '../../lib/dashboardGreeting';

const BLUE = '#002050';
const GOLD = '#BF8813';

type DashboardData = {
  profile: CoachProfile;
  metrics: {
    upcoming_sessions: number;
    completed_sessions: number;
    average_rating: number;
    pending_custom_requests: number;
  };
  recent_sessions: CoachingSession[];
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
        <h1 className="text-2xl font-bold" style={{ color: BLUE }}>{dashboardGreeting(data?.profile?.full_name)}</h1>
        {error && <p className="mt-4 rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}

        <div className="mt-6 grid border-t border-slate-200 sm:grid-cols-2 xl:grid-cols-4">
          <RoleDashboardStatCard label="Sessions à venir" value={metrics?.upcoming_sessions || 0} icon={CalendarDays} accent={BLUE} to={withCoachPreview('/coach/sessions')} />
          <RoleDashboardStatCard label="Sessions terminées" value={metrics?.completed_sessions || 0} icon={CheckCircle2} accent="#1E7A52" to={withCoachPreview('/coach/sessions')} />
          <RoleDashboardStatCard label="Demandes personnalisées" value={metrics?.pending_custom_requests || 0} icon={Package} accent="#7C3AED" to={withCoachPreview('/coach/offres')} />
          <RoleDashboardStatCard label="Note moyenne" value={Number(metrics?.average_rating || data?.profile?.average_rating || 0).toFixed(1)} icon={Star} accent={GOLD} to={withCoachPreview('/coach/avis')} />
        </div>

        <RoleDashboardPanel className="mt-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-semibold" style={{ color: BLUE }}>Activité récente</h2>
            <Link to={withCoachPreview('/coach/sessions')} className="text-sm font-semibold" style={{ color: GOLD }}>Voir les sessions</Link>
          </div>
          {data?.recent_sessions?.length ? (
            <div className="mt-4 divide-y divide-slate-100">
              {data.recent_sessions.slice(0, 6).map(session => (
                <div key={session.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <div>
                    <p className="font-medium" style={{ color: BLUE }}>{session.learner_name || 'Apprenant'}</p>
                    <p className="mt-1 text-xs text-slate-500">{new Date(session.scheduled_start || session.requested_start || session.created_at).toLocaleString('fr-FR')}</p>
                  </div>
                  <p className="text-xs font-semibold" style={{ color: GOLD }}>{session.status.replace(/_/g, ' ')}</p>
                </div>
              ))}
            </div>
          ) : <p className="mt-4 text-sm text-slate-500">Aucune activité récente.</p>}
        </RoleDashboardPanel>
      </div>
    </CoachWorkspaceLayout>
  );
}
