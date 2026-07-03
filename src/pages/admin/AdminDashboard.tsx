import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AdminLayout } from '../../components/AdminLayout';
import { ENDPOINTS } from '../../lib/config';
import { useSiteMode } from '../../context/SiteModeContext';
import {
  TrendingUp, DollarSign, Lock, Users, AlertTriangle, BookOpen,
  Wallet, Shield, Briefcase, ArrowRight, Clock,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

interface AdminData {
  kpis: { ca_brut_xof: number; revenu_net_plateforme_xof: number; tresorerie_sequestree_xof: number; dau: number };
  ventes_evolution: { date: string; amount_xof: number; count: number }[];
  repartition_geo: { country_code: string; country_name: string; sales_count: number; amount_xof: number }[];
  repartition_paiement: { gateway: string; count: number; percent: number }[];
  finops: { ai_tokens_used_month: number; ai_tokens_cost_usd: number; cloudflare_stream_minutes_used: number; cloudflare_stream_cost_usd: number; r2_storage_gb: number };
  alertes: { retraits_en_attente: number; courses_a_publier: number; kyc_en_attente: number; offres_emploi_en_attente: number };
  cours_a_publier: { id: string; title: string; creator_name: string; score_calcule: number | null; prix_provisoire_xof: number | null; category: string; created_at: string }[];
}

const PERIOD_OPTIONS = [
  { label: "Aujourd'hui", value: '1d' },
  { label: '7 jours', value: '7d' },
  { label: 'Mois', value: '30d' },
  { label: 'Année', value: '1y' },
];

const GW_COLORS = ['#002050', '#BF8813', '#1E7A52', '#dc2626', '#7c3aed'];

function fmt(n: number) {
  return n.toLocaleString('fr-FR');
}

export default function AdminDashboard() {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30d');
  const { comingSoon, waitlistCount, launchDate } = useSiteMode();
  const navigate = useNavigate();

  function load(p: string) {
    setLoading(true);
    const token = localStorage.getItem('omnia_session_token');
    if (!token) {
      navigate('/connexion');
      return;
    }
    fetch(`${ENDPOINTS.dashboardAdmin}?period=${p}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    })
      .then(r => r.json())
      .then(d => {
        if (d && d.kpis) {
          setData(d);
        } else {
          console.error('Dashboard admin error:', d);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Dashboard admin fetch error:', err);
        setLoading(false);
      });
  }

  useEffect(() => { load(period); }, [period]);

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header + period filter */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#002050' }}>Tableau de bord Super-admin</h1>
            <p className="text-gray-500 text-sm mt-0.5">Vue globale de la plateforme</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {PERIOD_OPTIONS.map((o) => (
              <button key={o.value} onClick={() => setPeriod(o.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${period === o.value ? 'text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                style={period === o.value ? { backgroundColor: '#002050' } : {}}>
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Waitlist banner — shown when site is in coming soon mode */}
        {comingSoon && (
          <div className="rounded-xl border-2 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            style={{ borderColor: '#BF8813', backgroundColor: 'rgba(191,136,19,0.05)' }}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'rgba(191,136,19,0.12)' }}>
                <Users className="w-6 h-6" style={{ color: '#BF8813' }} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-0.5" style={{ color: '#BF8813' }}>
                  Mode liste d'attente actif
                </p>
                <p className="text-2xl font-bold" style={{ color: '#002050' }}>
                  {waitlistCount.toLocaleString('fr-FR')} <span className="text-base font-medium text-gray-500">inscrits</span>
                </p>
                {launchDate && (
                  <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Lancement prévu : {new Date(launchDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                )}
              </div>
            </div>
            <Link to="/admin/cms-branding"
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#002050' }}>
              Gérer le lancement
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'CA Brut', value: `${fmt(data?.kpis.ca_brut_xof ?? 0)} XOF`, sub: 'Total des ventes', icon: TrendingUp, color: '#BF8813' },
                { label: 'Revenu Net Plateforme', value: `${fmt(data?.kpis.revenu_net_plateforme_xof ?? 0)} XOF`, sub: 'Après commissions', icon: DollarSign, color: '#1E7A52' },
                { label: 'Trésorerie Séquestrée', value: `${fmt(data?.kpis.tresorerie_sequestree_xof ?? 0)} XOF`, sub: 'Non encore reversés', icon: Lock, color: '#dc2626' },
                { label: 'Utilisateurs Actifs (DAU)', value: `${fmt(data?.kpis.dau ?? 0)}`, sub: 'Dernières 24h', icon: Users, color: '#002050' },
              ].map((kpi) => (
                <div key={kpi.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-gray-500">{kpi.label}</p>
                      <p className="text-xl font-bold mt-1 leading-tight" style={{ color: '#002050' }}>{kpi.value}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{kpi.sub}</p>
                    </div>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${kpi.color}15` }}>
                      <kpi.icon className="w-5 h-5" style={{ color: kpi.color }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Central zone 65% */}
              <div className="lg:col-span-2 space-y-6">
                {/* Area chart sales */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                  <h3 className="font-semibold text-sm mb-4" style={{ color: '#002050' }}>Évolution des ventes</h3>
                  {(data?.ventes_evolution?.length ?? 0) === 0 ? (
                    <div className="h-44 flex items-center justify-center text-sm text-gray-300">Aucune donnée disponible</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={180}>
                      <AreaChart data={data?.ventes_evolution ?? []}>
                        <defs>
                          <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#002050" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="#002050" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(v) => [`${fmt(v as number)} XOF`, 'Ventes']} />
                        <Area type="monotone" dataKey="amount_xof" stroke="#BF8813" strokeWidth={2} fill="url(#salesGrad)" name="Montant XOF" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Geo bar chart */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                  <h3 className="font-semibold text-sm mb-4" style={{ color: '#002050' }}>Répartition géographique</h3>
                  {(data?.repartition_geo?.length ?? 0) === 0 ? (
                    <div className="h-32 flex items-center justify-center text-sm text-gray-300">Aucune donnée</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={data?.repartition_geo ?? []} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis type="number" tick={{ fontSize: 10 }} />
                        <YAxis dataKey="country_code" type="category" tick={{ fontSize: 10 }} width={35} />
                        <Tooltip formatter={(v) => [`${fmt(v as number)} XOF`, 'Ventes']} />
                        <Bar dataKey="amount_xof" radius={[0, 4, 4, 0]} name="Montant XOF">
                          {(data?.repartition_geo ?? []).map((_, i) => (
                            <Cell key={i} fill={i === 0 ? '#002050' : i === 1 ? '#BF8813' : '#1E7A52'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Payment methods donut + FinOps */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <h3 className="font-semibold text-sm mb-4" style={{ color: '#002050' }}>Passerelles de paiement</h3>
                    {(data?.repartition_paiement?.length ?? 0) === 0 ? (
                      <div className="h-32 flex items-center justify-center text-xs text-gray-300">Aucune donnée</div>
                    ) : (
                      <ResponsiveContainer width="100%" height={140}>
                        <PieChart>
                          <Pie data={data?.repartition_paiement ?? []} dataKey="count" nameKey="gateway" cx="50%" cy="50%" innerRadius={35} outerRadius={60}>
                            {(data?.repartition_paiement ?? []).map((_, i) => <Cell key={i} fill={GW_COLORS[i % GW_COLORS.length]} />)}
                          </Pie>
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: 10 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-3">
                    <h3 className="font-semibold text-sm mb-2" style={{ color: '#002050' }}>Jauges FinOps</h3>
                    {[
                      { label: `Jetons IA — ${fmt(data?.finops?.ai_tokens_used_month ?? 0)} (${data?.finops?.ai_tokens_cost_usd?.toFixed(2) ?? '0.00'} USD)`, val: data?.finops?.ai_tokens_used_month ?? 0, max: 50000 },
                      { label: `Stream — ${fmt(data?.finops?.cloudflare_stream_minutes_used ?? 0)} min`, val: data?.finops?.cloudflare_stream_minutes_used ?? 0, max: 10000 },
                      { label: `Stockage R2 — ${data?.finops?.r2_storage_gb?.toFixed(1) ?? '0'} GB`, val: data?.finops?.r2_storage_gb ?? 0, max: 100 },
                    ].map((g) => (
                      <div key={g.label}>
                        <p className="text-xs text-gray-500 mb-1">{g.label}</p>
                        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full transition-all"
                            style={{ width: `${Math.min(100, (g.val / g.max) * 100)}%`, backgroundColor: '#BF8813' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Side zone 35% */}
              <div className="space-y-4">
                {/* Alertes */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <h3 className="font-semibold text-sm" style={{ color: '#002050' }}>Centre d'alertes</h3>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {[
                      { count: data?.alertes?.retraits_en_attente ?? 0, label: 'retrait(s) en attente', link: '/admin/payouts', icon: Wallet, color: '#BF8813' },
                      { count: data?.alertes?.courses_a_publier ?? 0, label: 'formation(s) à approuver', link: '/admin/courses', icon: BookOpen, color: '#002050' },
                      { count: data?.alertes?.kyc_en_attente ?? 0, label: 'KYC en attente', link: '/admin/team', icon: Shield, color: '#1E7A52' },
                      { count: data?.alertes?.offres_emploi_en_attente ?? 0, label: "offre(s) d'emploi", link: '/admin/marketing', icon: Briefcase, color: '#7c3aed' },
                    ].map((a) => (
                      <Link key={a.label} to={a.link}
                        className={`flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors ${a.count === 0 ? 'opacity-40' : ''}`}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${a.color}15` }}>
                          <a.icon className="w-3.5 h-3.5" style={{ color: a.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold" style={{ color: a.count > 0 ? '#002050' : '#9ca3af' }}>{a.count}</p>
                          <p className="text-xs text-gray-400">{a.label}</p>
                        </div>
                        {a.count > 0 && <ArrowRight className="w-3.5 h-3.5 text-gray-300" />}
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Formations prêtes à publier */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-semibold text-sm" style={{ color: '#002050' }}>Prêtes à publier</h3>
                    <Link to="/admin/courses" className="text-xs hover:underline" style={{ color: '#BF8813' }}>Voir tout</Link>
                  </div>
                  {(data?.cours_a_publier?.length ?? 0) === 0 ? (
                    <div className="px-5 py-6 text-center text-xs text-gray-400">Aucune formation en attente</div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {(data?.cours_a_publier ?? []).slice(0, 5).map((c) => (
                        <div key={c.id} className="flex items-center gap-3 px-5 py-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-800 truncate">{c.title}</p>
                            <p className="text-xs text-gray-400">{c.creator_name}</p>
                          </div>
                          <Link to="/admin/courses"
                            className="text-xs px-2.5 py-1 rounded-lg text-white font-medium flex-shrink-0 hover:opacity-90 transition-opacity"
                            style={{ backgroundColor: '#1E7A52' }}>
                            Publier →
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
