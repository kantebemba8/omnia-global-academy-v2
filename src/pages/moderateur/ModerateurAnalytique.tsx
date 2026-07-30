import { useEffect, useState } from 'react';
import { ModerateurLayout } from '../../components/ModerateurLayout';
import { ENDPOINTS } from '../../lib/config';
import { edgeAuthHeaders } from '../../lib/edgeAuth';
import { BarChart2, Lock, TrendingUp, Users, BookOpen, MessageSquare } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const COLORS = ['#002050', '#BF8813', '#1E7A52', '#dc2626', '#7c3aed', '#0284c7'];

export default function ModerateurAnalytique() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [error, setError] = useState('');

  const bypassAuth = new URLSearchParams(window.location.search).get('preview') === 'true' &&
    (() => { try { return JSON.parse(localStorage.getItem('omnia_user') || '{}')?.roles?.includes('super_admin') ?? false; } catch { return false; } })();

  useEffect(() => {
    if (bypassAuth) { setLoading(false); return; }
    const perms = localStorage.getItem('mod_perms');
    if (perms) {
      try {
        const p = JSON.parse(perms);
        setHasPermission(!!p.can_view_analytics);
      } catch { /* ignore */ }
    }

    const token = localStorage.getItem('omnia_session_token');
    if (!token) {
      setError('Session expirée. Veuillez vous reconnecter.');
      setLoading(false);
      return;
    }

    fetch(`${ENDPOINTS.dashboardModerateur}?analytics=1`, { headers: edgeAuthHeaders() })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || payload.error || 'Analytique indisponible.');
        return payload;
      })
      .then((payload) => {
        setData(payload.analytics ?? null);
        setHasPermission(!!payload.permissions?.can_view_analytics);
      })
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'Analytique indisponible.'))
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

  if (!hasPermission) {
    return (
      <ModerateurLayout>
        <div className="p-6 max-w-3xl mx-auto">
          <div className="bg-white rounded-xl p-12 text-center border border-gray-100 shadow-sm">
            <Lock className="w-12 h-12 mx-auto mb-4 opacity-20" style={{ color: '#002050' }} />
            <p className="font-semibold text-gray-700">Accès refusé</p>
            <p className="text-sm text-gray-400 mt-1">Permission can_view_analytics requise.</p>
          </div>
        </div>
      </ModerateurLayout>
    );
  }

  // Derive charts from moderation_log data or use sample shapes
  const ana = data as {
    decisions_by_day?: { date: string; total: number; approved: number; rejected: number }[];
    actions_by_type?: { action: string; count: number }[];
    tickets_by_status?: { status: string; count: number }[];
    kyc_by_week?: { week: string; professeurs: number }[];
    forum_by_space?: { space: string; posts: number; flagged: number }[];
  } | null;

  return (
    <ModerateurLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#002050' }}>Analytique de modération</h1>
          <p className="text-gray-500 text-sm mt-1">Statistiques pédagogiques — aucune donnée financière</p>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5" role="alert">
            <p className="font-semibold text-red-800">Impossible de charger l’analytique</p>
            <p className="mt-1 text-sm text-red-700">{error}</p>
          </div>
        ) : !ana ? (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-100 shadow-sm">
            <BarChart2 className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: '#002050' }} />
            <p className="text-gray-400 text-sm">Données analytiques insuffisantes pour le moment</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Decisions by day */}
            {ana.decisions_by_day && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-4 h-4" style={{ color: '#002050' }} />
                  <h3 className="font-semibold text-sm" style={{ color: '#002050' }}>Décisions par jour</h3>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={ana.decisions_by_day}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="approved" stroke="#1E7A52" strokeWidth={2} dot={false} name="Approuvés" />
                    <Line type="monotone" dataKey="rejected" stroke="#dc2626" strokeWidth={2} dot={false} name="Rejetés" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Actions by type */}
            {ana.actions_by_type && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <BookOpen className="w-4 h-4" style={{ color: '#BF8813' }} />
                  <h3 className="font-semibold text-sm" style={{ color: '#002050' }}>Actions par type</h3>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={ana.actions_by_type}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="action" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#002050" radius={[4, 4, 0, 0]} name="Actions" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Tickets by status */}
            {ana.tickets_by_status && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <MessageSquare className="w-4 h-4" style={{ color: '#7c3aed' }} />
                  <h3 className="font-semibold text-sm" style={{ color: '#002050' }}>Tickets support par statut</h3>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={ana.tickets_by_status} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={80} label>
                      {ana.tickets_by_status.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* KYC by week */}
            {ana.kyc_by_week && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-4 h-4" style={{ color: '#1E7A52' }} />
                  <h3 className="font-semibold text-sm" style={{ color: '#002050' }}>KYC traités par semaine</h3>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={ana.kyc_by_week}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="professeurs" fill="#002050" radius={[4, 4, 0, 0]} name="Professeurs" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </div>
    </ModerateurLayout>
  );
}
