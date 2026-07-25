import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '../../components/DashboardLayout';
import { ENDPOINTS } from '../../lib/config';
import { usePreviewMode } from '../../hooks/usePreviewMode';
import { withLearnerPreview } from '../../lib/learnerPreview';
import {
  BookOpen, Award, Sparkles, TrendingUp, Clock, ChevronRight, Users, ArrowRight
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
  parrainage: { total_filleuls: number; total_recompenses_xof: number; referral_link: string };
}


const PREVIEW_DASHBOARD: DashboardData = {
  user: { full_name: '', ai_tokens: 0, member_since: new Date().toISOString() },
  kpis: { formations_en_cours: 0, formations_terminees: 0, certificats_obtenus: 0, jetons_ia_restants: 0 },
  courses_en_cours: [],
  activite_recente: [],
  parrainage: { total_filleuls: 0, total_recompenses_xof: 0, referral_link: '' },
};

function kpiCard(label: string, value: number | string, icon: React.ReactNode, color: string) {
  return (
    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm flex items-center gap-4">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: color + '18' }}>
        <div style={{ color }}>{icon}</div>
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

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
    const token = localStorage.getItem('omnia_session_token');
    if (!token) { setLoading(false); return; }
    try {
      const res = await fetch((ENDPOINTS as Record<string, string>)['dashboardApprenant'] || `${(ENDPOINTS as Record<string, string>)['authRegister'].replace('/auth-register', '')}/dashboard-apprenant`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Erreur'); return; }
      setData(json);
      // Refresh user tokens in localStorage
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
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            {data?.user.full_name ? `Bonjour, ${data.user.full_name.split(' ')[0]}` : 'Tableau de bord apprenant'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">Suivez vos formations, vos réalisations et vos prochaines étapes.</p>
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
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {kpiCard('Formations en cours', data.kpis.formations_en_cours, <BookOpen className="w-5 h-5" />, '#002050')}
              {kpiCard('Formations terminées', data.kpis.formations_terminees, <TrendingUp className="w-5 h-5" />, '#1E7A52')}
              {kpiCard('Certificats obtenus', data.kpis.certificats_obtenus, <Award className="w-5 h-5" />, '#BF8813')}
              {kpiCard('Jetons IA restants', data.kpis.jetons_ia_restants, <Sparkles className="w-5 h-5" />, '#7C3AED')}
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
              {/* Cours en cours — 65% */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900">Formations en cours</h2>
                  <Link to={withLearnerPreview('/dashboard/mes-cours')} className="text-sm font-medium flex items-center gap-1 hover:opacity-80" style={{ color: '#002050' }}>
                    Voir tout <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                {data.courses_en_cours.length === 0 ? (
                  <div className="bg-white rounded-xl p-8 border border-gray-100 text-center">
                    <BookOpen className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                    <p className="text-gray-500 text-sm">Aucune formation en cours</p>
                    <Link to="/catalogue" className="mt-3 inline-block text-sm font-medium hover:opacity-80" style={{ color: '#002050' }}>
                      Explorer le catalogue
                    </Link>
                  </div>
                ) : (
                  data.courses_en_cours.map((c) => (
                    <Link key={c.course_id} to={`/cours/${c.slug}/apprendre`}
                      className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center gap-4 hover:border-gray-200 hover:shadow-md transition-all">
                      <div className="w-14 h-14 rounded-lg flex-shrink-0 flex items-center justify-center text-white font-bold text-lg"
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

              {/* Right column — 35% */}
              <div className="space-y-4">
                {/* Activité récente */}
                <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                  <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" /> Activité récente
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
                </div>

                {/* Parrainage widget */}
                <div className="rounded-xl p-5 border" style={{ backgroundColor: '#002050', borderColor: '#002050' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4" style={{ color: '#BF8813' }} />
                    <h2 className="font-semibold text-white text-sm">Votre parrainage</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-white/10 rounded-lg p-3">
                      <p className="text-2xl font-bold text-white">{data.parrainage.total_filleuls}</p>
                      <p className="text-xs text-white/60">Filleuls</p>
                    </div>
                    <div className="bg-white/10 rounded-lg p-3">
                      <p className="text-2xl font-bold" style={{ color: '#BF8813' }}>{data.parrainage.total_recompenses_xof.toLocaleString()}</p>
                      <p className="text-xs text-white/60">XOF gagnés</p>
                    </div>
                  </div>
                  <Link to={withLearnerPreview('/dashboard/parrainage')}
                    className="block text-center text-xs font-semibold py-2 rounded-lg transition-all hover:opacity-90"
                    style={{ backgroundColor: '#BF8813', color: '#002050' }}>
                    Inviter des amis
                  </Link>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
