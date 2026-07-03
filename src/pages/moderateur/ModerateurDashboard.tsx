import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ModerateurLayout } from '../../components/ModerateurLayout';
import { ENDPOINTS } from '../../lib/config';
import { usePreviewMode } from '../../hooks/usePreviewMode';
import {
  BookOpen, Users, Shield, MessageSquare, Briefcase, HelpCircle,
  Clock, CheckCircle, XCircle, Lock, AlertTriangle, BarChart2
} from 'lucide-react';

interface KPI { label: string; value: number; icon: React.ElementType; color: string }
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
  kyc_etab: '#1E7A52',
  job: '#BF8813',
  forum: '#c2410c',
  support: '#7c3aed',
};
const TYPE_LABEL: Record<string, string> = {
  course: 'Formation', kyc_prof: 'KYC Prof', kyc_etab: 'KYC Étab',
  job: "Offre d'emploi", forum: 'Forum', support: 'Support',
};
const ACTION_LABELS: Record<string, string> = {
  course_approved: 'Formation approuvée', course_rejected: 'Formation rejetée',
  course_transmitted: 'Formation transmise', kyc_approved: 'KYC approuvé',
  kyc_rejected: 'KYC rejeté', account_suspended: 'Compte suspendu',
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
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewToast, setPreviewToast] = useState(false);
  const previewMode = usePreviewMode();

  function handlePreviewAction() {
    if (!previewMode) return;
    setPreviewToast(true);
    setTimeout(() => setPreviewToast(false), 3000);
  }

  useEffect(() => {
    const token = localStorage.getItem('omnia_session_token');
    if (!token) { setLoading(false); return; }
    fetch(ENDPOINTS.dashboardModerateur, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

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

  if (!data) return <ModerateurLayout><div className="p-8 text-red-600">Erreur de chargement.</div></ModerateurLayout>;

  return (
    <ModerateurLayout>
      {previewToast && (
        <div className="fixed top-16 right-4 z-50 bg-gray-800 text-white text-xs font-medium px-4 py-2 rounded-lg shadow-lg">
          Mode aperçu — Action désactivée
        </div>
      )}
      <div className="p-6 max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#002050' }}>Tableau de bord Modérateur</h1>
          <p className="text-gray-500 text-sm mt-1">Aperçu de votre espace de modération</p>
        </div>

        {/* No permissions banner */}
        {!data.has_any_permission && (
          <div className="rounded-xl p-6 flex items-start gap-4 border border-amber-200 bg-amber-50">
            <Lock className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800">Aucune permission active</p>
              <p className="text-amber-700 text-sm mt-1">
                Votre compte modérateur n'a pas encore de permissions assignées.
                Contactez un Super-admin pour obtenir des droits d'accès.
              </p>
            </div>
          </div>
        )}

        {/* KPIs */}
        {data.kpis?.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {data.kpis.map((kpi, i) => (
              <div key={i} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500">{kpi.label}</p>
                <p className="text-3xl font-bold mt-1" style={{ color: '#002050' }}>{kpi.value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Priority queue */}
          {data.priority_queue?.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <Clock className="w-4 h-4" style={{ color: '#BF8813' }} />
                <h2 className="font-semibold text-sm" style={{ color: '#002050' }}>File de priorité</h2>
                <span className="ml-auto text-xs text-gray-400">{data.priority_queue.length} éléments</span>
              </div>
              <div className="divide-y divide-gray-50">
                {data.priority_queue.map((item) => (
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
            {data.todays_decisions?.length === 0 ? (
              <div className="px-5 py-8 text-center text-gray-400 text-sm">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                Aucune décision aujourd'hui
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {(data.todays_decisions ?? []).map((log) => (
                  <div key={log.id} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: log.action_type.includes('reject') || log.action_type.includes('suspend') ? '#fee2e2' : '#dcfce7' }}>
                      {log.action_type.includes('reject') || log.action_type.includes('suspend')
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

        {/* Quick access cards */}
        {data.has_any_permission && (
          <div>
            <h2 className="font-semibold mb-4" style={{ color: '#002050' }}>Accès rapide</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {data.permissions?.can_see_pending_courses && (
                <Link to="/moderator/courses" className="bg-white rounded-xl p-4 flex flex-col items-center gap-2 shadow-sm border border-gray-100 hover:shadow-md transition-shadow text-center">
                  <BookOpen className="w-6 h-6" style={{ color: '#002050' }} />
                  <span className="text-xs font-medium text-gray-700">Formations</span>
                </Link>
              )}
              {(data.permissions?.can_validate_professor_kyc || data.permissions?.can_validate_establishment_kyc) && (
                <Link to="/moderator/kyc" className="bg-white rounded-xl p-4 flex flex-col items-center gap-2 shadow-sm border border-gray-100 hover:shadow-md transition-shadow text-center">
                  <Shield className="w-6 h-6" style={{ color: '#1E7A52' }} />
                  <span className="text-xs font-medium text-gray-700">KYC</span>
                </Link>
              )}
              {(data.permissions?.can_see_learners_list || data.permissions?.can_suspend_account) && (
                <Link to="/moderator/users" className="bg-white rounded-xl p-4 flex flex-col items-center gap-2 shadow-sm border border-gray-100 hover:shadow-md transition-shadow text-center">
                  <Users className="w-6 h-6" style={{ color: '#BF8813' }} />
                  <span className="text-xs font-medium text-gray-700">Utilisateurs</span>
                </Link>
              )}
              {data.permissions?.can_manage_support && (
                <Link to="/moderator/support" className="bg-white rounded-xl p-4 flex flex-col items-center gap-2 shadow-sm border border-gray-100 hover:shadow-md transition-shadow text-center">
                  <HelpCircle className="w-6 h-6" style={{ color: '#7c3aed' }} />
                  <span className="text-xs font-medium text-gray-700">Support</span>
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Important notice */}
        <div className="rounded-xl p-4 bg-blue-50 border border-blue-100 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700">
            En tant que modérateur, vous ne pouvez jamais <strong>publier</strong> directement une formation.
            Les formations validées sont transmises au Super-admin pour publication finale.
          </p>
        </div>
      </div>
    </ModerateurLayout>
  );
}
