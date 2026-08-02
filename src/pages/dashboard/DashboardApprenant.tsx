import { getSessionToken } from '../../lib/session';
import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '../../components/DashboardLayout';
import { RoleDashboardPanel, RoleDashboardStatCard } from '../../components/dashboard/RoleDashboardCards';
import { ENDPOINTS } from '../../lib/config';
import { edgeAuthHeaders } from '../../lib/edgeAuth';
import { usePreviewMode } from '../../hooks/usePreviewMode';
import { withLearnerPreview } from '../../lib/learnerPreview';
import { dashboardGreeting } from '../../lib/dashboardGreeting';
import {
  BookOpen, Award, Sparkles, TrendingUp, Clock, ChevronRight, ArrowRight,
} from 'lucide-react';

interface DashboardData {
  user: { full_name: string; ai_tokens: number; member_since: string };
  kpis: { formations_en_cours: number; formations_terminees: number; certificats_obtenus: number; jetons_ia_restants: number };
  courses_en_cours: Array<{
    course_id: string; title: string; slug: string;
    thumbnail_url: string | null; progress_percent: number;
    lessons_completed: number; lessons_total: number;
  }>;
  activite_recente: Array<{ lesson_title: string; course_id: string; completed_at: string }>;
}

const PREVIEW_DASHBOARD: DashboardData = {
  user: { full_name: '', ai_tokens: 0, member_since: new Date().toISOString() },
  kpis: { formations_en_cours: 0, formations_terminees: 0, certificats_obtenus: 0, jetons_ia_restants: 0 },
  courses_en_cours: [],
  activite_recente: [],
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function DashboardApprenant() {
  const previewMode = usePreviewMode();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (previewMode) { setData(PREVIEW_DASHBOARD); setLoading(false); return; }
    const token = getSessionToken();
    if (!token) { setLoading(false); return; }
    try {
      const res = await fetch((ENDPOINTS as Record<string, string>)['dashboardApprenant'] || `${(ENDPOINTS as Record<string, string>)['authRegister'].replace('/auth-register', '')}/dashboard-apprenant`, {
        headers: edgeAuthHeaders(),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Erreur'); return; }
      setData(json);
      if (json.user) {
        const stored = localStorage.getItem('omnia_user');
        if (stored) {
          try {
            const u = JSON.parse(stored);
            localStorage.setItem('omnia_user', JSON.stringify({ ...u, ai_tokens: json.user.ai_tokens }));
          } catch { /* ignore */ }
        }
      }
    } catch { setError('Erreur réseau'); }
    finally { setLoading(false); }
  }, [previewMode]);

  useEffect(() => { load(); }, [load]);

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{dashboardGreeting(data?.user.full_name)}</h1>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
        )}

        {data && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <RoleDashboardStatCard label="Formations en cours" value={data.kpis.formations_en_cours} icon={BookOpen} accent="#002050" to={withLearnerPreview('/dashboard/mes-cours')} />
              <RoleDashboardStatCard label="Formations terminées" value={data.kpis.formations_terminees} icon={TrendingUp} accent="#1E7A52" to={withLearnerPreview('/dashboard/mes-cours')} />
              <RoleDashboardStatCard label="Certificats obtenus" value={data.kpis.certificats_obtenus} icon={Award} accent="#BF8813" to={withLearnerPreview('/dashboard/certificats')} />
              <RoleDashboardStatCard label="Jetons IA restants" value={data.kpis.jetons_ia_restants} icon={Sparkles} accent="#7C3AED" to={withLearnerPreview('/dashboard/career-studio')} />
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900">Formations en cours</h2>
                  <Link to={withLearnerPreview('/dashboard/mes-cours')} className="text-sm font-medium flex items-center gap-1 hover:opacity-80" style={{ color: '#002050' }}>
                    Voir tout <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                {data.courses_en_cours.length === 0 ? (
                  <RoleDashboardPanel className="text-center py-8">
                    <BookOpen className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                    <p className="text-gray-500 text-sm">Aucune formation en cours</p>
                    <Link to="/catalogue" className="mt-3 inline-block text-sm font-medium hover:opacity-80" style={{ color: '#002050' }}>
                      Explorer le catalogue
                    </Link>
                  </RoleDashboardPanel>
                ) : (
                  data.courses_en_cours.map((c) => (
                    <Link key={c.course_id} to={`/cours/${c.slug}/apprendre`}
                      className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
                      <div className="w-14 h-14 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-bold text-lg"
                        style={{ backgroundColor: '#002050' }}>
                        {c.title[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{c.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{c.lessons_completed}/{c.lessons_total} leçons</p>
                        <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${c.progress_percent}%`, backgroundColor: '#1E7A52' }} />
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-lg font-bold" style={{ color: '#1E7A52' }}>{c.progress_percent}%</p>
                        <ChevronRight className="w-4 h-4 text-gray-400 ml-auto mt-1" />
                      </div>
                    </Link>
                  ))
                )}
              </div>

              <div className="space-y-4">
                <RoleDashboardPanel>
                  <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4" style={{ color: '#BF8813' }} /> Activité récente
                  </h2>
                  {data.activite_recente.length === 0 ? (
                    <p className="text-gray-400 text-xs">Aucune activité récente</p>
                  ) : (
                    <ul className="space-y-2.5">
                      {data.activite_recente.map((a, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: '#1E7A52' }} />
                          <div className="min-w-0">
                            <p className="text-xs text-gray-700 truncate">{a.lesson_title}</p>
                            <p className="text-xs text-gray-400">{formatDate(a.completed_at)}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </RoleDashboardPanel>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
