import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '../../components/AdminLayout';
import { ENDPOINTS } from '../../lib/config';
import {
  Activity, ArrowRight, BookOpen, Building2, CircleDollarSign, Clock3,
  Eye, GraduationCap, Radio, RefreshCw, ShieldCheck, Users, UserCheck,
  Wallet, Briefcase, MessageSquare, Wrench, AlertCircle, CheckCircle2
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

type NullableNumber = number | null;

interface ActionItem {
  key: string;
  label: string;
  count: number;
  path: string;
  detail?: string;
  priority?: 'high' | 'normal';
}

interface DashboardData {
  period: string;
  kpis: {
    ca_encaisse_xof: NullableNumber;
    revenu_omnia_xof: NullableNumber;
    a_reverser_xof: NullableNumber;
    utilisateurs_actifs_24h: NullableNumber;
  };
  activity_today: {
    nouveaux_utilisateurs: NullableNumber;
    commandes_payees: NullableNumber;
    formations_soumises: NullableNumber;
    lives_crees: NullableNumber;
    retraits_demandes: NullableNumber;
  };
  actions: ActionItem[];
  ventes_evolution: { date: string; amount_xof: number; count: number }[];
  repartition_geo: { country_code: string; sales_count: number; amount_xof: number }[];
  paiements: {
    available: boolean;
    rows: { gateway: string; count: number; amount_xof: number; percent: number }[];
  };
  formations: {
    attente_tarification: NullableNumber;
    attente_acceptation_professeur: NullableNumber;
    validation_pedagogique: NullableNumber;
    pretes_a_publier: NullableNumber;
    publiees: NullableNumber;
  };
  omnia_live: {
    validation: NullableNumber;
    programmes_ou_publies: NullableNumber;
    en_direct: NullableNumber;
    remboursements: NullableNumber;
    retraits: NullableNumber;
    organisateurs: NullableNumber;
  };
  structures: {
    en_attente: NullableNumber;
    actives: NullableNumber;
  };
  users_by_role: { role: string; role_key?: string; count: number }[];
  platform: {
    maintenance_global: boolean;
    maintenance_modules: string[];
  };
  latest_admin_activity: { label: string; created_at: string }[];
}

const PERIOD_OPTIONS = [
  { label: "Aujourd'hui", value: '1d' },
  { label: '7 jours', value: '7d' },
  { label: '30 jours', value: '30d' },
  { label: 'Année', value: '1y' },
];

function fmt(n: NullableNumber, suffix = '') {
  if (n == null) return 'Non disponible';
  return `${n.toLocaleString('fr-FR')}${suffix}`;
}

function shortDate(value: string) {
  try {
    return new Date(value).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return value;
  }
}

function StatLine({ label, value, suffix = '' }: { label: string; value: NullableNumber; suffix?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b border-gray-100 last:border-b-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-bold" style={{ color: '#002050' }}>{fmt(value, suffix)}</span>
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30d');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function load(p: string) {
    setLoading(true);
    setError('');
    const token = localStorage.getItem('omnia_session_token');
    if (!token) {
      navigate('/connexion');
      return;
    }

    try {
      const response = await fetch(`${ENDPOINTS.dashboardAdmin}?period=${p}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok || !payload?.kpis) {
        throw new Error(payload?.message || payload?.error || 'Chargement impossible');
      }
      setData(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(period); }, [period]);

  const previewSpaces = [
    { label: 'Apprenant', icon: GraduationCap, path: '/dashboard?preview=true' },
    { label: 'Formateur', icon: BookOpen, path: '/professeur/dashboard?preview=true' },
    { label: 'Organisateur', icon: Radio, path: '/omnia-live/organisateur?preview=true' },
    { label: 'Structure', icon: Building2, path: '/structure/dashboard?preview=true' },
    { label: 'Modérateur', icon: UserCheck, path: '/moderator/dashboard?preview=true' },
  ];

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between border-b border-gray-200 pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: '#BF8813' }}>
              Pilotage global
            </p>
            <h1 className="text-2xl font-black mt-1" style={{ color: '#002050' }}>Tableau de bord Super-admin</h1>
            <p className="text-sm text-gray-500 mt-1">
              Données réelles, actions prioritaires et état opérationnel de la plateforme.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {PERIOD_OPTIONS.map(o => (
              <button key={o.value} type="button" onClick={() => setPeriod(o.value)}
                className="px-3 py-1.5 text-sm font-semibold border-b-2 transition-colors"
                style={{
                  color: period === o.value ? '#002050' : '#667085',
                  borderColor: period === o.value ? '#BF8813' : 'transparent',
                }}>
                {o.label}
              </button>
            ))}
            <button type="button" onClick={() => load(period)}
              className="ml-2 inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold border border-gray-200 rounded-lg text-gray-600">
              <RefreshCw size={14} /> Actualiser
            </button>
          </div>
        </header>

        <section>
          <div className="flex items-center gap-2 mb-3">
            <Eye size={16} style={{ color: '#002050' }} />
            <h2 className="text-sm font-bold" style={{ color: '#002050' }}>Prévisualiser les espaces</h2>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-3 border-y border-gray-200 py-4">
            {previewSpaces.map(item => (
              <button key={item.path} type="button" onClick={() => navigate(item.path)}
                className="inline-flex items-center gap-2 text-sm font-semibold hover:underline"
                style={{ color: '#002050' }}>
                <item.icon size={16} />
                {item.label}
              </button>
            ))}
          </div>
        </section>

        {loading ? (
          <div className="py-24 flex justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
          </div>
        ) : error ? (
          <div className="border-l-4 border-red-500 pl-4 py-3">
            <p className="font-semibold text-red-700">Impossible de charger le tableau de bord</p>
            <p className="text-sm text-gray-500 mt-1">{error}</p>
          </div>
        ) : data && (
          <>
            <section className="grid grid-cols-2 lg:grid-cols-4 border-y border-gray-200">
              {[
                ['CA encaissé', fmt(data.kpis.ca_encaisse_xof, ' XOF'), 'Paiements confirmés sur la période'],
                ['Revenu Omnia', fmt(data.kpis.revenu_omnia_xof, ' XOF'), 'Part plateforme réellement enregistrée'],
                ['À reverser', fmt(data.kpis.a_reverser_xof, ' XOF'), 'Soldes et parts disponibles/en attente'],
                ['Actifs 24 h', fmt(data.kpis.utilisateurs_actifs_24h), 'Utilisateurs distincts connectés'],
              ].map(([label, value, detail], index) => (
                <div key={label} className={`py-5 px-4 ${index < 3 ? 'lg:border-r border-gray-200' : ''}`}>
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-xl font-black mt-1" style={{ color: '#002050' }}>{value}</p>
                  <p className="text-xs text-gray-400 mt-1">{detail}</p>
                </div>
              ))}
            </section>

            <section>
              <div className="flex items-center justify-between gap-4 mb-3">
                <div>
                  <h2 className="text-lg font-black" style={{ color: '#002050' }}>Actions requises</h2>
                  <p className="text-sm text-gray-500">Uniquement les éléments qui nécessitent une intervention.</p>
                </div>
                <span className="text-sm font-bold" style={{ color: '#BF8813' }}>
                  {data.actions.reduce((sum, a) => sum + a.count, 0)} à traiter
                </span>
              </div>
              <div className="border-t border-gray-200">
                {data.actions.length === 0 ? (
                  <div className="py-5 flex items-center gap-2 text-sm text-gray-500">
                    <CheckCircle2 size={17} style={{ color: '#1E7A52' }} />
                    Aucune action prioritaire détectée.
                  </div>
                ) : data.actions.map(action => (
                  <button key={action.key} type="button" onClick={() => navigate(action.path)}
                    className="w-full flex items-center justify-between gap-4 py-3 border-b border-gray-100 text-left hover:bg-gray-50/70 px-1">
                    <div className="flex items-center gap-3 min-w-0">
                      <AlertCircle size={17} style={{ color: action.priority === 'high' ? '#B42318' : '#BF8813' }} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{action.label}</p>
                        {action.detail && <p className="text-xs text-gray-400 truncate">{action.detail}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-black" style={{ color: '#002050' }}>{action.count}</span>
                      <ArrowRight size={15} className="text-gray-400" />
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-8">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-black" style={{ color: '#002050' }}>Évolution des ventes encaissées</h2>
                  <span className="text-xs text-gray-400">Formations + Omnia Live</span>
                </div>
                <div className="h-72 border-y border-gray-200 py-4">
                  {data.ventes_evolution.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-sm text-gray-400">
                      Aucune vente encaissée sur cette période.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data.ventes_evolution}>
                        <defs>
                          <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#002050" stopOpacity={0.20} />
                            <stop offset="100%" stopColor="#002050" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#EAECF0" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v: number) => `${fmt(v)} XOF`} />
                        <Area type="monotone" dataKey="amount_xof" stroke="#002050" fill="url(#salesFill)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3"><h2 className="text-lg font-black" style={{ color: '#002050' }}>Activité aujourd’hui</h2><button onClick={()=>navigate('/admin/dashboard/activity-today')} className="text-sm font-semibold" style={{color:'#BF8813'}}>Voir le détail →</button></div>
                <div className="border-y border-gray-200 py-2">
                  <StatLine label="Nouveaux utilisateurs" value={data.activity_today.nouveaux_utilisateurs} />
                  <StatLine label="Commandes payées" value={data.activity_today.commandes_payees} />
                  <StatLine label="Formations soumises" value={data.activity_today.formations_soumises} />
                  <StatLine label="Lives créés" value={data.activity_today.lives_crees} />
                  <StatLine label="Retraits demandés" value={data.activity_today.retraits_demandes} />
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div>
                <h2 className="text-base font-black mb-2" style={{ color: '#002050' }}>Formations</h2>
                <div className="border-t border-gray-200">
                  <StatLine label="Tarifications à valider" value={data.formations.attente_tarification} />
                  <StatLine label="Acceptation professeur" value={data.formations.attente_acceptation_professeur} />
                  <StatLine label="Validation pédagogique" value={data.formations.validation_pedagogique} />
                  <StatLine label="Prêtes à publier" value={data.formations.pretes_a_publier} />
                  <StatLine label="Publiées" value={data.formations.publiees} />
                </div>
                <button onClick={() => navigate('/admin/studio-validation')}
                  className="mt-3 text-xs font-bold inline-flex items-center gap-1" style={{ color: '#BF8813' }}>
                  Gérer les formations <ArrowRight size={13} />
                </button>
              </div>

              <div>
                <h2 className="text-base font-black mb-2" style={{ color: '#002050' }}>Omnia Live</h2>
                <div className="border-t border-gray-200">
                  <StatLine label="À valider" value={data.omnia_live.validation} />
                  <StatLine label="Programmés / publiés" value={data.omnia_live.programmes_ou_publies} />
                  <StatLine label="En direct" value={data.omnia_live.en_direct} />
                  <StatLine label="Remboursements à traiter" value={data.omnia_live.remboursements} />
                  <StatLine label="Retraits organisateurs" value={data.omnia_live.retraits} />
                  <StatLine label="Organisateurs à valider" value={data.omnia_live.organisateurs} />
                </div>
                <button onClick={() => navigate('/admin/omnia-live')}
                  className="mt-3 text-xs font-bold inline-flex items-center gap-1" style={{ color: '#BF8813' }}>
                  Ouvrir Omnia Live <ArrowRight size={13} />
                </button>
              </div>

              <div>
                <h2 className="text-base font-black mb-2" style={{ color: '#002050' }}>Structures</h2>
                <div className="border-t border-gray-200">
                  <StatLine label="En attente de validation" value={data.structures.en_attente} />
                  <StatLine label="Actives / validées" value={data.structures.actives} />
                </div>
                <button onClick={() => navigate('/admin/structures')}
                  className="mt-3 text-xs font-bold inline-flex items-center gap-1" style={{ color: '#BF8813' }}>
                  Gérer les structures <ArrowRight size={13} />
                </button>
              </div>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <h2 className="text-lg font-black mb-3" style={{ color: '#002050' }}>Utilisateurs par rôle</h2>
                <div className="border-y border-gray-200 py-2">
                  {data.users_by_role.length === 0 ? (
                    <p className="text-sm text-gray-400 py-3">Aucune donnée disponible.</p>
                  ) : data.users_by_role.map(row => (
                    <button key={row.role} type="button"
                      onClick={() => navigate(`/admin/dashboard/roles/${encodeURIComponent(row.role_key || row.role)}`)}
                      className="w-full flex justify-between items-center py-2 border-b border-gray-100 last:border-0 text-left hover:bg-gray-50 px-1">
                      <span className="text-sm text-gray-600">{row.role}</span>
                      <span className="flex items-center gap-2">
                        <span className="font-bold text-sm" style={{ color: '#002050' }}>{fmt(row.count)}</span>
                        <ArrowRight size={13} className="text-gray-400"/>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="text-lg font-black mb-3" style={{ color: '#002050' }}>Moyens de paiement</h2>
                <div className="border-y border-gray-200 py-2">
                  {!data.paiements.available ? (
                    <p className="text-sm text-gray-400 py-3">
                      Aucune transaction payée ne permet encore d’établir une répartition.
                    </p>
                  ) : data.paiements.rows.map(row => (
                    <div key={row.gateway} className="py-2 border-b border-gray-100 last:border-0">
                      <div className="flex justify-between gap-4">
                        <span className="text-sm text-gray-600">{row.gateway}</span>
                        <span className="text-sm font-bold" style={{ color: '#002050' }}>
                          {row.percent.toFixed(1)} % · {fmt(row.amount_xof)} XOF
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-8">
              <div>
                <h2 className="text-lg font-black mb-3" style={{ color: '#002050' }}>État de la plateforme</h2>
                <div className="border-y border-gray-200 py-2">
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-600">Maintenance globale</span>
                    <span className="text-sm font-bold" style={{ color: data.platform.maintenance_global ? '#B42318' : '#1E7A52' }}>
                      {data.platform.maintenance_global ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="py-2">
                    <p className="text-sm text-gray-600">Maintenance ciblée</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {data.platform.maintenance_modules.length
                        ? data.platform.maintenance_modules.join(', ')
                        : 'Aucun module en maintenance'}
                    </p>
                  </div>
                </div>
                <button onClick={() => navigate('/admin/cms-branding')}
                  className="mt-3 text-xs font-bold inline-flex items-center gap-1" style={{ color: '#BF8813' }}>
                  Gérer la maintenance <ArrowRight size={13} />
                </button>
              </div>

              <div>
                <h2 className="text-lg font-black mb-3" style={{ color: '#002050' }}>Dernières activités administratives</h2>
                <div className="border-y border-gray-200">
                  {data.latest_admin_activity.length === 0 ? (
                    <p className="text-sm text-gray-400 py-4">Aucun journal administratif disponible.</p>
                  ) : data.latest_admin_activity.map((row, i) => (
                    <div key={`${row.created_at}-${i}`} className="py-3 border-b border-gray-100 last:border-0">
                      <p className="text-sm text-gray-700">{row.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{shortDate(row.created_at)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
