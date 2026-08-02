import { getSessionToken } from '../../lib/session';
import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '../../components/DashboardLayout';
import { edgeAuthHeaders } from '../../lib/edgeAuth';
import { BookOpen, CheckCircle, Clock, ChevronRight, TrendingUp } from 'lucide-react';

interface Course {
  course_id: string; title: string; slug: string; thumbnail_url: string | null;
  progress_percent: number; lessons_completed: number; lessons_total: number;
  enrolled_at: string; certificate_earned: boolean;
}

interface DashboardData {
  courses_en_cours: Course[];
  cours_termines: Course[];
}

function getApiBase() {
  const url = import.meta.env.VITE_SUPABASE_URL || '';
  return url ? `${url}/functions/v1` : '/api';
}

function CourseCard({ c, done }: { c: Course; done: boolean }) {
  return (
    <Link to={done ? `/dashboard/certificats` : `/cours/${c.slug}/apprendre`}
      className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center gap-4 hover:shadow-md hover:border-gray-200 transition-all">
      <div className="w-14 h-14 rounded-lg flex-shrink-0 flex items-center justify-center text-white font-bold text-xl"
        style={{ backgroundColor: done ? '#1E7A52' : '#002050' }}>
        {done ? <CheckCircle className="w-6 h-6" /> : c.title[0]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 text-sm truncate">{c.title}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          Inscrit le {new Date(c.enrolled_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
        {!done && (
          <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${c.progress_percent}%`, backgroundColor: '#1E7A52' }} />
          </div>
        )}
      </div>
      <div className="text-right flex-shrink-0">
        {done ? (
          <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: '#1E7A52' + '18', color: '#1E7A52' }}>Terminé</span>
        ) : (
          <>
            <p className="text-base font-bold" style={{ color: '#1E7A52' }}>{c.progress_percent}%</p>
            <ChevronRight className="w-4 h-4 text-gray-400 ml-auto mt-1" />
          </>
        )}
      </div>
    </Link>
  );
}

export function DashboardMesCours() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'en_cours' | 'termines'>('en_cours');

  const bypassAuth = new URLSearchParams(window.location.search).get('preview') === 'true' &&
    (() => { try { return JSON.parse(localStorage.getItem('omnia_user') || '{}')?.roles?.includes('super_admin') ?? false; } catch { return false; } })();

  const load = useCallback(async () => {
    if (bypassAuth) { setLoading(false); return; }
    const token = getSessionToken();
    if (!token) return;
    try {
      const res = await fetch(`${getApiBase()}/dashboard-apprenant`, {
        headers: edgeAuthHeaders(),
      });
      const json = await res.json();
      if (res.ok) setData(json);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const tabs = [
    { key: 'en_cours' as const, label: 'En cours', icon: Clock, count: data?.courses_en_cours.length ?? 0 },
    { key: 'termines' as const, label: 'Terminées', icon: CheckCircle, count: data?.cours_termines.length ?? 0 },
  ];

  const courses = tab === 'en_cours' ? (data?.courses_en_cours ?? []) : (data?.cours_termines ?? []);

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Mes formations</h1>
          <p className="text-gray-500 text-sm mt-1">Suivez votre progression</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={tab === t.key ? { backgroundColor: '#002050', color: 'white' } : { color: '#6b7280' }}>
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
              <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full"
                style={tab === t.key ? { backgroundColor: 'rgba(255,255,255,0.2)' } : { backgroundColor: 'white' }}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
          </div>
        ) : courses.length === 0 ? (
          <div className="bg-white rounded-xl p-12 border border-gray-100 text-center">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-200" />
            <p className="text-gray-500">Aucune formation {tab === 'en_cours' ? 'en cours' : 'terminée'}</p>
            {tab === 'en_cours' && (
              <Link to="/catalogue" className="mt-4 inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg text-white"
                style={{ backgroundColor: '#002050' }}>
                <TrendingUp className="w-4 h-4" /> Explorer le catalogue
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {courses.map((c) => <CourseCard key={c.course_id} c={c} done={tab === 'termines'} />)}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
