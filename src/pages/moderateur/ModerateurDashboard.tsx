import { getSessionToken } from '../../lib/session';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ModerateurLayout } from '../../components/ModerateurLayout';
import { RoleDashboardStatCard } from '../../components/dashboard/RoleDashboardCards';
import { dashboardGreeting } from '../../lib/dashboardGreeting';
import { ENDPOINTS } from '../../lib/config';
import { edgeAuthHeaders } from '../../lib/edgeAuth';
import { MODERATOR_PERMISSION_KEYS, normalizeModeratorPermissions } from '../../lib/moderatorPermissions';

import {
  BookOpen, Users, Shield, MessageSquare, Briefcase, HelpCircle,
  Clock, CheckCircle, XCircle, Lock, AlertTriangle, Activity, ClipboardCheck
} from 'lucide-react';

interface KPI { key: string; label: string; value: number }
interface QueueItem {
  id: string; type: string; title: string; created_at: string;
  priority_label: string; link: string;
}
interface LogItem { id: string; action_type: string; target_type: string; created_at: string }
interface DashData {
  permissions: Record<string, boolean>;
  kpis: KPI[];
  priority_queue: QueueItem[];
  todays_decisions: LogItem[];
  has_any_permission: boolean;
}

const TYPE_COLOR: Record<string, string> = {
  course: '#002050',
  kyc_prof: '#1E7A52',
  job: '#BF8813',
  forum: '#c2410c',
  support: '#7c3aed',
};
const TYPE_LABEL: Record<string, string> = {
  course: 'Formation', kyc_prof: 'Vérification du professeur',
  job: "Offre d'emploi", forum: 'Communauté', support: 'Support',
};

const KPI_PRESENTATION: Record<string, { icon: typeof Activity; accent: string; path: string }> = {
  courses: { icon: BookOpen, accent: '#002050', path: '/moderator/courses' },
  professor_kyc: { icon: Shield, accent: '#1E7A52', path: '/moderator/kyc' },
  learners: { icon: Users, accent: '#7C3AED', path: '/moderator/users' },
  professors: { icon: Users, accent: '#BF8813', path: '/moderator/users' },
  forum: { icon: MessageSquare, accent: '#C2410C', path: '/moderator/forum' },
  jobs: { icon: Briefcase, accent: '#BF8813', path: '/moderator/jobs' },
  support: { icon: HelpCircle, accent: '#7C3AED', path: '/moderator/support' },
};
const ACTION_LABELS: Record<string, string> = {
  course_approved: 'Formation approuvée', course_rejected: 'Formation rejetée',
  course_transmitted: 'Formation transmise', kyc_approved: 'Identité vérifiée',
  kyc_rejected: 'Vérification d’identité refusée', account_suspended: 'Compte suspendu',
  account_reactivated: 'Compte réactivé', forum_post_removed: 'Post masqué',
  forum_post_restored: 'Post restauré', job_approved: 'Offre approuvée',
  job_rejected: 'Offre rejetée',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `il y a ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
}

export default function ModerateurDashboard() {
  const isPreview = new URLSearchParams(window.location.search).get('preview') === 'true';
  const isSuperAdmin = (() => {
    try { return JSON.parse(localStorage.getItem('omnia_user') || '{}')?.roles?.includes('super_admin') ?? false; }
    catch { return false; }
  })();
  const bypassAuth = isPreview && isSuperAdmin;

  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');


  useEffect(() => {
    if (bypassAuth) {
      setData({
        permissions: Object.fromEntries(
          MODERATOR_PERMISSION_KEYS.map(key => [key, true]),
        ),
        kpis: [
          { key: 'courses', label: 'Formations en attente', value: 0 },
          { key: 'professor_kyc', label: 'Professeurs à vérifier', value: 0 },
          { key: 'forum', label: 'Signalements Communauté', value: 0 },
          { key: 'jobs', label: 'Offres à valider', value: 0 },
        ],
        priority_queue: [],
        todays_decisions: [],
        has_any_permission: true,
      });
      setLoading(false);
      return;
    }
    const token = getSessionToken();
    if (!token) {
      setError('Session expirée. Veuillez vous reconnecter.');
      setLoading(false);
      return;
    }

    fetch(ENDPOINTS.dashboardModerateur, { headers: edgeAuthHeaders() })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || payload.error || 'Tableau de bord indisponible.');
        return payload as DashData;
      })
      .then((payload) => {
        const permissions = normalizeModeratorPermissions(payload.permissions);
        setData({
          ...payload,
          permissions,
          has_any_permission: MODERATOR_PERMISSION_KEYS.some(key => permissions[key]),
        });
      })
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'Tableau de bord indisponible.'))
      .finally(() => setLoading(false));
  }, [bypassAuth]);

  if (loading) {
    return (
      <ModerateurLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
        </div>
      </ModerateurLayout>
    );
  }

  if (!loading && !data) {
    return (
      <ModerateurLayout>
        <div className="p-8 max-w-3xl mx-auto">
          <div className="rounded-xl border border-red-200 bg-red-50 p-5" role="alert">
            <p className="font-semibold text-red-800">Impossible de charger le tableau de bord</p>
            <p className="mt-1 text-sm text-red-700">{error || 'Une erreur réseau est survenue.'}</p>
          </div>
        </div>
      </ModerateurLayout>
    );
  }

  if (!data) return (
    <ModerateurLayout>
      <div className="p-8 text-center">
        <p style={{ color: '#6B7280' }}>Chargement du tableau de bord...</p>
      </div>
    </ModerateurLayout>
  );

  const normalizedPermissions = normalizeModeratorPermissions(data.permissions);
  const activePermissionCount = MODERATOR_PERMISSION_KEYS.filter(key => normalizedPermissions[key]).length;
  const missionsPath = bypassAuth ? '/moderator/missions?preview=true' : '/moderator/missions';
  const kpiPriority = ['courses', 'professor_kyc', 'forum', 'jobs', 'support', 'learners', 'professors'];
  const visibleKpis = [...(data.kpis || [])]
    .sort((a, b) => kpiPriority.indexOf(a.key) - kpiPriority.indexOf(b.key))
    .slice(0, 4);

  return (
    <ModerateurLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#002050' }}>{dashboardGreeting()}</h1>
            <p className="mt-1 text-sm text-gray-500">Vos autorisations actives déterminent les espaces et contrôles disponibles.</p>
          </div>
          <Link
            to={missionsPath}
            className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold transition hover:bg-gray-50"
            style={{ borderColor: '#E4E7EC', color: '#002050' }}
          >
            <ClipboardCheck size={17} style={{ color: '#BF8813' }} />
            Centre de missions · {activePermissionCount}
          </Link>
        </div>

        {/* No permissions banner */}
        {!data?.has_any_permission && (
          <div className="rounded-xl p-6 flex items-start gap-4 border border-amber-200 bg-amber-50">
            <Lock className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800">Aucune permission active</p>
              <p className="text-amber-700 text-sm mt-1">
                Votre compte modérateur n'a pas encore de permissions assignées.
                Contactez l’Administration Omnia pour obtenir des droits d'accès.
              </p>
            </div>
          </div>
        )}

        {visibleKpis.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {visibleKpis.map((kpi) => {
              const presentation = KPI_PRESENTATION[kpi.key] || { icon: Activity, accent: '#002050', path: '/moderator/dashboard' };
              return (
                <RoleDashboardStatCard
                  key={kpi.key}
                  label={kpi.label}
                  value={kpi.value}
                  icon={presentation.icon}
                  accent={presentation.accent}
                  to={presentation.path}
                />
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Priority queue */}
          {data?.priority_queue?.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <Clock className="w-4 h-4" style={{ color: '#BF8813' }} />
                <h2 className="font-semibold text-sm" style={{ color: '#002050' }}>File de priorité</h2>
                <span className="ml-auto text-xs text-gray-400">{data?.priority_queue?.length ?? 0} éléments</span>
              </div>
              <div className="divide-y divide-gray-50">
                {(data?.priority_queue ?? []).map((item) => (
                  <Link key={item.id} to={item.link}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors"
                    style={{ borderLeft: `3px solid ${TYPE_COLOR[item.type] ?? '#002050'}` }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{item.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        <span className="mr-2">{TYPE_LABEL[item.type] ?? item.type}</span>
                        {timeAgo(item.created_at)}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: `${TYPE_COLOR[item.type]}15`, color: TYPE_COLOR[item.type] ?? '#002050' }}>
                      {item.priority_label}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Today's decisions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" style={{ color: '#1E7A52' }} />
              <h2 className="font-semibold text-sm" style={{ color: '#002050' }}>Décisions aujourd'hui</h2>
            </div>
            {data?.todays_decisions?.length === 0 ? (
              <div className="px-5 py-8 text-center text-gray-400 text-sm">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                Aucune décision aujourd'hui
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {(data?.todays_decisions ?? []).map((log) => (
                  <div key={log.id} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: (log.action_type ?? '').includes('reject') || (log.action_type ?? '').includes('suspend') ? '#fee2e2' : '#dcfce7' }}>
                      {(log.action_type ?? '').includes('reject') || (log.action_type ?? '').includes('suspend')
                        ? <XCircle className="w-3.5 h-3.5 text-red-500" />
                        : <CheckCircle className="w-3.5 h-3.5 text-green-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800">{ACTION_LABELS[log.action_type] ?? log.action_type}</p>
                      <p className="text-xs text-gray-400">{timeAgo(log.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Important notice */}
        <div className="rounded-xl p-4 bg-blue-50 border border-blue-100 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700">
            En tant que modérateur, vous ne pouvez jamais <strong>publier</strong> directement une formation.
            Les formations validées sont transmises à l’Administration Omnia pour publication finale.
          </p>
        </div>
      </div>
    </ModerateurLayout>
  );
}
