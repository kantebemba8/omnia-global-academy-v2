import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDays, Users, ArrowRight, Radio, CheckCircle2,
} from 'lucide-react';
import { RoleDashboardPanel, RoleDashboardStatCard } from '../../../components/dashboard/RoleDashboardCards';
import { liveApi } from '../liveApi';
import OrganizerShell from './OrganizerShell';
import { dashboardGreeting } from '../../../lib/dashboardGreeting';

const BLUE = '#002050';
const GOLD = '#BF8813';

export default function OrganizerDashboard() {
  const [k, setK] = useState<any>({});
  const [recent, setRecent] = useState<any[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    liveApi('organizer_dashboard')
      .then(d => {
        setK(d.kpis || {});
        setRecent(d.recent_events || []);
      })
      .catch(e => setErr(e instanceof Error ? e.message : 'Erreur'));
  }, []);

  const overview = useMemo(() => [
    { label: 'Événements', value: k.total_events ?? 0, icon: CalendarDays, accent: BLUE, to: '/omnia-live/organisateur/evenements' },
    { label: 'Publiés', value: k.published ?? 0, icon: CheckCircle2, accent: '#1E7A52', to: '/omnia-live/organisateur/evenements' },
    { label: 'En direct', value: k.live_now ?? 0, icon: Radio, accent: '#DC2626', to: '/omnia-live/organisateur/evenements' },
    { label: 'Participants inscrits', value: k.registrations ?? 0, icon: Users, accent: '#7C3AED', to: '/omnia-live/organisateur/participants' },
  ], [k]);

  return (
    <OrganizerShell title={dashboardGreeting()}>
      {err && <div className="mb-6 border-l-2 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div>}

      <section className="grid border-t border-slate-200 sm:grid-cols-2 lg:grid-cols-4">
        {overview.map(item => (
          <RoleDashboardStatCard
            key={item.label}
            label={item.label}
            value={typeof item.value === 'number' ? item.value.toLocaleString('fr-FR') : item.value}
            icon={item.icon}
            accent={item.accent}
            to={item.to}
          />
        ))}
      </section>

      <RoleDashboardPanel className="mt-7">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold" style={{ color: BLUE }}>Activité récente</h2>
          <Link to="/omnia-live/organisateur/evenements" className="flex items-center gap-1 text-sm font-semibold" style={{ color: GOLD }}>
            Tous mes événements <ArrowRight size={15} />
          </Link>
        </div>

        {recent.length > 0 ? (
          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              <div className="grid grid-cols-[1.5fr_.8fr_.7fr_.4fr] border-b border-slate-200 px-1 pb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <div>Événement</div>
                <div>Format</div>
                <div>Statut</div>
                <div className="text-right">Action</div>
              </div>
              {recent.map(x => (
                <div key={x.id} className="grid grid-cols-[1.5fr_.8fr_.7fr_.4fr] items-center border-b border-slate-100 px-1 py-4 text-sm last:border-b-0">
                  <div>
                    <div className="font-semibold" style={{ color: BLUE }}>{x.title}</div>
                    {x.starts_at && <div className="mt-1 flex items-center gap-1 text-xs text-slate-400"><CalendarDays size={13} />{new Date(x.starts_at).toLocaleString('fr-FR')}</div>}
                  </div>
                  <div className="text-slate-600">{x.delivery_type || '—'}</div>
                  <div className="font-medium" style={{ color: GOLD }}>{x.status || '—'}</div>
                  <div className="text-right">
                    <Link to={`/omnia-live/organisateur/evenements/${x.id}`} className="text-sm font-semibold" style={{ color: BLUE }}>
                      Gérer
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-8 text-sm text-slate-500">Aucun événement pour le moment.</div>
        )}
      </RoleDashboardPanel>
    </OrganizerShell>
  );
}
