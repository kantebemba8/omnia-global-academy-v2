import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/DashboardLayout';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { Users, TrendingUp, BookOpen, AlertCircle } from 'lucide-react';
import { edgeAuthHeaders } from '../../lib/edgeAuth';

interface Formation { id: string; title: string; status: string; total_students: number; average_rating: number; }
interface AnalyticsData {
  enrollments_over_time: Array<{ date: string; count: number }>;
  countries: Array<{ country: string; count: number }>;
  module_completion: Array<{ module_title: string; pct: number }>;
  rating_distribution: Array<{ stars: number; count: number }>;
  students: Array<{ anonymized: string; progress: number; last_activity: string; status: string }>;
}

function getApiBase() {
  const url = import.meta.env.VITE_SUPABASE_URL || '';
  return url ? `${url}/functions/v1` : '/api';
}

const RATING_COLORS = ['#002050', '#1B3A7A', '#3B5FBA', '#BF8813', '#D4A430'];
const PERIOD_OPTIONS = [
  { key: '7d', label: '7 jours' },
  { key: '30d', label: '30 jours' },
  { key: '90d', label: '3 mois' },
  { key: '365d', label: '1 an' },
];
const EMPTY_ANALYTICS: AnalyticsData = {
  enrollments_over_time: [], countries: [], module_completion: [],
  rating_distribution: [5, 4, 3, 2, 1].map((stars) => ({ stars, count: 0 })), students: [],
};

function isPublished(status: string) {
  return ['published', 'publiee'].includes(status);
}

export function ProfesseurAnalytique() {
  const [formations, setFormations] = useState<Formation[]>([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [period, setPeriod] = useState('30d');
  const [analytics, setAnalytics] = useState<AnalyticsData>(EMPTY_ANALYTICS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const bypassAuth = new URLSearchParams(window.location.search).get('preview') === 'true' &&
    (() => { try { return JSON.parse(localStorage.getItem('omnia_user') || '{}')?.roles?.includes('super_admin') ?? false; } catch { return false; } })();

  const loadAnalytics = useCallback(async () => {
    if (bypassAuth) { setLoading(false); return; }
    if (!localStorage.getItem('omnia_session_token')) { navigate('/connexion'); return; }
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ analytics: '1', period });
      if (selectedCourse) params.set('course_id', selectedCourse);
      const response = await fetch(`${getApiBase()}/dashboard-professeur?${params.toString()}`, { headers: edgeAuthHeaders() });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) { navigate('/connexion'); return; }
      if (!response.ok) throw new Error(data.message || data.error || 'Impossible de charger les statistiques.');

      const published = (Array.isArray(data.formations) ? data.formations : []).filter((formation: Formation) => isPublished(formation.status));
      setFormations(published);
      if (!selectedCourse && published.length > 0) setSelectedCourse(published[0].id);
      setAnalytics(data.analytics || EMPTY_ANALYTICS);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de charger les statistiques.');
      setAnalytics(EMPTY_ANALYTICS);
    } finally {
      setLoading(false);
    }
  }, [bypassAuth, navigate, period, selectedCourse]);

  useEffect(() => { void loadAnalytics(); }, [loadAnalytics]);

  const selectedFormation = formations.find((formation) => formation.id === selectedCourse);
  const totalRatings = analytics.rating_distribution.reduce((sum, rating) => sum + rating.count, 0);

  return (
    <DashboardLayout role="professeur">
      <div className="mx-auto max-w-6xl p-6 lg:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Analytique élèves</h1>
          <p className="mt-1 text-sm text-gray-500">Données réelles des inscriptions, progressions et avis de vos formations.</p>
        </div>

        <div className="mb-6 flex flex-wrap gap-3">
          <select value={selectedCourse} onChange={(event) => setSelectedCourse(event.target.value)}
            className="min-w-0 max-w-xs flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none">
            <option value="">Toutes les formations publiées</option>
            {formations.map((formation) => <option key={formation.id} value={formation.id}>{formation.title}</option>)}
          </select>
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
            {PERIOD_OPTIONS.map((option) => (
              <button key={option.key} type="button" onClick={() => setPeriod(option.key)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
                style={period === option.key ? { backgroundColor: '#002050', color: 'white' } : { color: '#6b7280' }}>
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div><p>{error}</p><button type="button" onClick={() => void loadAnalytics()} className="mt-2 font-semibold underline">Réessayer</button></div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} /></div>
        ) : formations.length === 0 ? (
          <div className="rounded-xl border border-gray-100 bg-white p-12 text-center">
            <BookOpen className="mx-auto mb-4 h-12 w-12 text-gray-200" />
            <p className="text-gray-500">Aucune formation publiée</p>
            <p className="mt-1 text-sm text-gray-400">Les analytiques seront disponibles après la publication d’une formation.</p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2"><TrendingUp className="h-4 w-4" style={{ color: '#BF8813' }} /><h2 className="text-sm font-semibold text-gray-900">Inscriptions dans le temps</h2></div>
                {analytics.enrollments_over_time.some((point) => point.count > 0) ? (
                  <ResponsiveContainer width="100%" height={180}><LineChart data={analytics.enrollments_over_time}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} allowDecimals={false} /><Tooltip /><Line type="monotone" dataKey="count" stroke="#BF8813" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>
                ) : <div className="flex h-44 items-center justify-center text-sm text-gray-400">Aucune inscription sur cette période</div>}
              </div>

              <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2"><Users className="h-4 w-4" style={{ color: '#002050' }} /><h2 className="text-sm font-semibold text-gray-900">Répartition géographique</h2></div>
                {analytics.countries.length > 0 ? (
                  <ResponsiveContainer width="100%" height={180}><BarChart data={analytics.countries.slice(0, 5)} layout="vertical" margin={{ left: 30 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} /><YAxis type="category" dataKey="country" tick={{ fontSize: 10 }} width={80} /><Tooltip /><Bar dataKey="count" fill="#002050" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer>
                ) : <div className="flex h-44 items-center justify-center text-sm text-gray-400">Aucune donnée géographique</div>}
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-sm font-semibold text-gray-900">Progression moyenne par module</h2>
                {analytics.module_completion.length > 0 ? (
                  <ResponsiveContainer width="100%" height={180}><BarChart data={analytics.module_completion}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="module_title" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 10 }} domain={[0, 100]} unit="%" /><Tooltip formatter={(value) => `${value}%`} /><Bar dataKey="pct" fill="#1E7A52" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
                ) : <div className="flex h-44 items-center justify-center text-sm text-gray-400">Aucun module disponible</div>}
              </div>

              <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-sm font-semibold text-gray-900">Distribution des notes{selectedFormation && <span className="font-normal text-gray-400"> · ★ {selectedFormation.average_rating}/5</span>}</h2>
                {totalRatings > 0 ? (
                  <div className="flex items-center gap-6"><ResponsiveContainer width="50%" height={150}><PieChart><Pie data={analytics.rating_distribution} dataKey="count" nameKey="stars" innerRadius={40} outerRadius={65}>{analytics.rating_distribution.map((_, index) => <Cell key={index} fill={RATING_COLORS[index]} />)}</Pie><Tooltip formatter={(value, name) => [`${value} avis`, `${name}★`]} /></PieChart></ResponsiveContainer><div className="space-y-1.5">{analytics.rating_distribution.map((rating, index) => <div key={rating.stars} className="flex items-center gap-2 text-xs"><span style={{ color: RATING_COLORS[index] }}>{'★'.repeat(rating.stars)}</span><div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full" style={{ width: `${(rating.count / totalRatings) * 100}%`, backgroundColor: RATING_COLORS[index] }} /></div><span className="text-gray-500">{rating.count}</span></div>)}</div></div>
                ) : <div className="flex h-36 items-center justify-center text-sm text-gray-400">Aucun avis pour l’instant</div>}
              </div>
            </div>

            <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-5 py-4"><h2 className="text-sm font-semibold text-gray-900">Apprenants inscrits</h2><p className="mt-0.5 text-xs text-gray-400">Noms volontairement anonymisés.</p></div>
              {analytics.students.length === 0 ? <div className="p-8 text-center text-sm text-gray-400">Aucun apprenant inscrit</div> : (
                <div className="divide-y divide-gray-50">{analytics.students.map((student, index) => (
                  <div key={`${student.anonymized}-${index}`} className="flex flex-col gap-3 px-5 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3"><div className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold" style={{ backgroundColor: '#00205015', color: '#002050' }}>{student.anonymized[0]}</div><span className="text-gray-700">{student.anonymized}</span></div>
                    <div className="flex flex-wrap items-center gap-4"><div className="flex items-center gap-2"><div className="h-1.5 w-20 rounded-full bg-gray-100"><div className="h-full rounded-full" style={{ width: `${student.progress}%`, backgroundColor: '#1E7A52' }} /></div><span className="text-xs text-gray-500">{student.progress}%</span></div><span className="text-xs text-gray-400">{student.last_activity ? new Date(student.last_activity).toLocaleDateString('fr-FR') : '—'}</span><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${student.status === 'completed' ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-500'}`}>{student.status === 'completed' ? 'Terminé' : 'En cours'}</span></div>
                  </div>
                ))}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
