import { getSessionToken } from '../../lib/session';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '../../components/AdminLayout';
import { ENDPOINTS } from '../../lib/config';
import { edgeAuthHeaders } from '../../lib/edgeAuth';
import { dashboardGreeting } from '../../lib/dashboardGreeting';
import { ADMIN_ECOSYSTEMS } from '../../lib/adminNavigation';
import { getRoleTheme } from '../../lib/roleTheme';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BookOpen,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Eye,
  GraduationCap,
  Radio,
  RefreshCw,
  UserCheck,
  UserRoundSearch,
  Users,
  Wallet,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
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
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

function DataLine({ label, value, suffix = '' }: { label: string; value: NullableNumber; suffix?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-2.5 last:border-b-0">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="text-sm font-extrabold text-[#002050]">{fmt(value, suffix)}</span>
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
    const token = getSessionToken();
    if (!token) {
      navigate('/connexion');
      return;
    }

    try {
      const response = await fetch(`${ENDPOINTS.dashboardAdmin}?period=${p}`, {
        headers: edgeAuthHeaders(),
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

  useEffect(() => { void load(period); }, [period]);

  const previewSpaces = [
    { label: 'Apprenant', icon: GraduationCap, path: '/home?preview=true&role=apprenant', role: 'apprenant', theme: getRoleTheme('apprenant') },
    { label: 'Professeur', icon: BookOpen, path: '/home?preview=true&role=professeur', role: 'professeur', theme: getRoleTheme('professeur') },
    { label: 'Coach', icon: UserCheck, path: '/home?preview=true&role=coach', role: 'coach', theme: getRoleTheme('coach') },
    { label: 'Organisateur', icon: Radio, path: '/home?preview=true&role=organisateur', role: 'organisateur', theme: getRoleTheme('organisateur') },
    { label: 'Structure', icon: Building2, path: '/home?preview=true&role=structure', role: 'structure', theme: getRoleTheme('structure') },
    { label: 'Modérateur', icon: UserCheck, path: '/home?preview=true&role=moderateur', role: 'moderateur', theme: getRoleTheme('moderateur') },
    { label: 'Recruteur indépendant', icon: UserRoundSearch, path: '/home?preview=true&role=recruteur', role: 'recruteur', theme: getRoleTheme('recruteur') },
  ];

  const visibleRoleRows = data?.users_by_role || [];
  const actionCount = useMemo(() => data?.actions.reduce((sum, action) => sum + action.count, 0) || 0, [data]);
  const platformOperational = Boolean(data && !data.platform.maintenance_global && data.platform.maintenance_modules.length === 0);

  function openPreviewSpace(path: string, role: string) {
    sessionStorage.setItem('omnia_admin_role_preview', role);
    window.location.assign(path);
  }

  return (
    <AdminLayout>
      <div className="mx-auto max-w-[1600px] space-y-6 px-4 py-5 md:px-6 md:py-7 xl:px-8">
        <section className="relative overflow-hidden rounded-[28px] bg-[#002050] text-white shadow-[0_22px_60px_rgba(0,32,80,0.14)]">
          <div className="absolute inset-0 opacity-70" aria-hidden="true">
            <div className="absolute -right-24 -top-36 h-[420px] w-[420px] rounded-full border border-white/10" />
            <div className="absolute -right-8 -top-20 h-[300px] w-[300px] rounded-full border border-[#BF8813]/45" />
            <div className="absolute right-24 top-16 h-2 w-2 rounded-full bg-[#E9C876] shadow-[0_0_28px_8px_rgba(233,200,118,0.35)]" />
            <div className="absolute inset-y-0 right-0 w-1/2 bg-[linear-gradient(120deg,transparent,rgba(64,140,210,0.20),rgba(191,136,19,0.08))]" />
          </div>

          <div className="relative grid gap-6 px-5 py-6 md:px-7 md:py-7 xl:grid-cols-[1.25fr_0.75fr] xl:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-white/55">
                <span>Omnia Administration</span>
                <span className="h-1 w-1 rounded-full bg-[#BF8813]" />
                <span>Super-admin</span>
              </div>
              <h1 className="mt-3 max-w-3xl text-2xl font-black tracking-[-0.035em] text-white sm:text-3xl xl:text-[2.25rem]">
                Omnia Administration
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
                <strong className="text-white/85">{dashboardGreeting()}.</strong> Pilotez les opérations, les validations, l’activité et la gouvernance depuis une console unique.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-white/10 pt-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${platformOperational ? 'bg-emerald-400' : 'bg-amber-300'}`} />
                  <span className="font-semibold">{platformOperational ? 'Plateforme opérationnelle' : 'Attention plateforme requise'}</span>
                </div>
                <div className="text-white/65"><strong className="text-white">{actionCount}</strong> action{actionCount > 1 ? 's' : ''} à traiter</div>
                <div className="text-white/65"><strong className="text-white">{fmt(data?.kpis.utilisateurs_actifs_24h ?? null)}</strong> actifs sur 24 h</div>
              </div>
              <div className="mt-5 grid max-w-4xl grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-7" aria-label="Identités des rôles Omnia">
                {previewSpaces.map(item => (
                  <div key={item.role} className="flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[.07] px-3 py-2 backdrop-blur-sm">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.theme.accent }} />
                    <span className="truncate text-[11px] font-bold text-white/80">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 xl:items-end">
              <div className="flex flex-wrap items-center gap-1 rounded-xl bg-white/10 p-1 backdrop-blur-sm">
                {PERIOD_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPeriod(option.value)}
                    className={`rounded-lg px-3 py-2 text-xs font-bold transition ${period === option.value ? 'bg-white text-[#002050]' : 'text-white/65 hover:bg-white/10 hover:text-white'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => void load(period)}
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs font-bold text-white/75 transition hover:bg-white/10 hover:text-white"
              >
                <RefreshCw size={14} /> Actualiser les données
              </button>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="flex min-h-[45vh] items-center justify-center">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-[#002050] border-t-transparent" />
          </div>
        ) : error ? (
          <section className="border-l-4 border-red-500 bg-white/95 px-5 py-4 shadow-sm">
            <p className="font-bold text-red-700">Impossible de charger le tableau de bord</p>
            <p className="mt-1 text-sm text-slate-500">{error}</p>
          </section>
        ) : data && (
          <>
            <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white/90 backdrop-blur-sm">
              <div className="grid sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ['CA encaissé', fmt(data.kpis.ca_encaisse_xof, ' XOF'), CircleDollarSign, '#2563EB'],
                  ['Revenu Omnia', fmt(data.kpis.revenu_omnia_xof, ' XOF'), Activity, '#0F8A63'],
                  ['À reverser', fmt(data.kpis.a_reverser_xof, ' XOF'), Wallet, '#BF8813'],
                  ['Actifs 24 h', fmt(data.kpis.utilisateurs_actifs_24h), Users, '#6D5BD0'],
                ].map(([label, value, Icon, accent], index) => {
                  const MetricIcon = Icon as typeof Activity;
                  return (
                    <div key={String(label)} className={`relative flex min-h-[112px] items-center gap-4 px-5 py-5 ${index > 0 ? 'border-t border-slate-100 sm:border-l sm:border-t-0' : ''} ${index === 2 ? 'sm:border-t xl:border-t-0' : ''}`}>
                      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl" style={{ backgroundColor: `${accent}12`, color: String(accent) }}>
                        <MetricIcon size={19} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-400">{String(label)}</p>
                        <p className="mt-1 truncate text-xl font-black tracking-[-0.03em] text-[#002050]">{String(value)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white/90 backdrop-blur-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Écosystèmes</p>
                  <h2 className="mt-1 text-lg font-black text-[#002050]">Accéder aux espaces de gestion</h2>
                </div>
                <button type="button" onClick={() => navigate('/admin/ecosystemes')} className="inline-flex items-center gap-1 text-xs font-black text-[#002050]">Vue d’ensemble <ArrowRight size={13} /></button>
              </div>
              <div className="flex items-stretch overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {ADMIN_ECOSYSTEMS.map(ecosystem => {
                  const EcosystemIcon = ecosystem.icon;
                  return (
                    <button
                      key={ecosystem.id}
                      type="button"
                      onClick={() => navigate(ecosystem.entryPath)}
                      className="group flex min-w-[180px] flex-1 items-center gap-3 border-r border-slate-100 px-4 py-4 text-left last:border-r-0 hover:bg-slate-50"
                    >
                      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl" style={{ background: ecosystem.soft, color: ecosystem.accent }}><EcosystemIcon size={17} /></span>
                      <span className="min-w-0">
                        <strong className="block text-sm font-black text-[#002050]">{ecosystem.label}</strong>
                        <span className="mt-0.5 block text-xs text-slate-400">Administrer</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.22fr_0.78fr]">
              <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white/90 backdrop-blur-sm">
                <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#BF8813]">Opérations</p>
                    <h2 className="mt-1 text-lg font-black text-[#002050]">À traiter maintenant</h2>
                  </div>
                  <span className="rounded-full bg-[#FFF7E7] px-3 py-1 text-xs font-black text-[#9B6B0B]">{actionCount} en attente</span>
                </div>
                <div>
                  {data.actions.length === 0 ? (
                    <div className="flex items-center gap-3 px-5 py-8 text-sm text-slate-500">
                      <CheckCircle2 size={19} className="text-emerald-600" />
                      Aucune action prioritaire détectée.
                    </div>
                  ) : data.actions.map(action => (
                    <button
                      key={action.key}
                      type="button"
                      onClick={() => navigate(action.path)}
                      className="group flex w-full items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 text-left transition last:border-b-0 hover:bg-slate-50/80"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <span className={`mt-1 h-2.5 w-2.5 flex-none rounded-full ${action.priority === 'high' ? 'bg-red-500' : 'bg-[#BF8813]'}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-800">{action.label}</p>
                          {action.detail && <p className="mt-1 truncate text-xs text-slate-400">{action.detail}</p>}
                        </div>
                      </div>
                      <div className="flex flex-none items-center gap-3">
                        <span className="text-lg font-black text-[#002050]">{action.count}</span>
                        <ArrowRight size={15} className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#BF8813]" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[#071D3C] text-white">
                <div className="border-b border-white/10 px-5 py-4">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#DAB660]">Journal</p>
                  <h2 className="mt-1 text-lg font-black">Activité administrative récente</h2>
                </div>
                <div className="px-5 py-2">
                  {data.latest_admin_activity.length === 0 ? (
                    <p className="py-6 text-sm text-white/45">Aucun journal administratif disponible.</p>
                  ) : data.latest_admin_activity.slice(0, 8).map((row, index) => (
                    <div key={`${row.created_at}-${index}`} className="relative border-b border-white/10 py-3 pl-5 last:border-b-0">
                      <span className="absolute left-0 top-[18px] h-2 w-2 rounded-full bg-[#BF8813]" />
                      <p className="text-sm font-semibold text-white/85">{row.label}</p>
                      <p className="mt-1 text-xs text-white/35">{shortDate(row.created_at)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.55fr_0.75fr]">
              <div className="rounded-2xl border border-slate-200/90 bg-white/90 backdrop-blur-sm p-5">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Pilotage financier</p>
                    <h2 className="mt-1 text-lg font-black text-[#002050]">Évolution des ventes encaissées</h2>
                  </div>
                  <span className="text-xs font-semibold text-slate-400">Formations + Omnia Live</span>
                </div>
                <div className="mt-4 h-[290px] border-t border-slate-100 pt-4">
                  {data.ventes_evolution.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-slate-400">Aucune vente encaissée sur cette période.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data.ventes_evolution}>
                        <defs>
                          <linearGradient id="adminSalesFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#2368C4" stopOpacity={0.22} />
                            <stop offset="100%" stopColor="#2368C4" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(value: number) => `${fmt(value)} XOF`} />
                        <Area type="monotone" dataKey="amount_xof" stroke="#2368C4" fill="url(#adminSalesFill)" strokeWidth={2.5} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/90 bg-white/90 backdrop-blur-sm p-5">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Aujourd’hui</p>
                <h2 className="mt-1 text-lg font-black text-[#002050]">Activité de la plateforme</h2>
                <div className="mt-4 border-t border-slate-200">
                  {[
                    ['Nouveaux utilisateurs', data.activity_today.nouveaux_utilisateurs, 'nouveaux-utilisateurs'],
                    ['Commandes payées', data.activity_today.commandes_payees, 'commandes-payees'],
                    ['Formations soumises', data.activity_today.formations_soumises, 'formations-soumises'],
                    ['Lives créés', data.activity_today.lives_crees, 'lives-crees'],
                    ['Retraits demandés', data.activity_today.retraits_demandes, 'retraits-demandes'],
                  ].map(([label, value, type]) => (
                    <button
                      key={String(type)}
                      type="button"
                      onClick={() => navigate(`/admin/dashboard/activity-today?type=${encodeURIComponent(String(type))}`)}
                      className="group flex w-full items-center justify-between border-b border-slate-100 py-3 text-left last:border-b-0"
                    >
                      <span className="text-sm text-slate-600">{String(label)}</span>
                      <span className="flex items-center gap-2">
                        <strong className="text-sm text-[#002050]">{fmt(value as NullableNumber)}</strong>
                        <ArrowRight size={13} className="text-slate-300 group-hover:text-[#BF8813]" />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-200/90 bg-white/90 backdrop-blur-sm p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-black text-[#002050]">Formations</h2>
                  <BookOpen size={17} className="text-[#BF8813]" />
                </div>
                <div className="mt-3 border-t border-slate-200">
                  <DataLine label="Tarifications à valider" value={data.formations.attente_tarification} />
                  <DataLine label="Acceptation professeur" value={data.formations.attente_acceptation_professeur} />
                  <DataLine label="Validation pédagogique" value={data.formations.validation_pedagogique} />
                  <DataLine label="Prêtes à publier" value={data.formations.pretes_a_publier} />
                  <DataLine label="Publiées" value={data.formations.publiees} />
                </div>
                <button onClick={() => navigate('/admin/quality-center')} className="mt-4 inline-flex items-center gap-1 text-xs font-black text-[#9B6B0B]">Centre Qualité <ArrowRight size={13} /></button>
              </div>

              <div className="rounded-2xl border border-slate-200/90 bg-white/90 backdrop-blur-sm p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-black text-[#002050]">Omnia Live</h2>
                  <Radio size={17} className="text-[#5B5BD6]" />
                </div>
                <div className="mt-3 border-t border-slate-200">
                  <DataLine label="À valider" value={data.omnia_live.validation} />
                  <DataLine label="Programmés / publiés" value={data.omnia_live.programmes_ou_publies} />
                  <DataLine label="En direct" value={data.omnia_live.en_direct} />
                  <DataLine label="Remboursements" value={data.omnia_live.remboursements} />
                  <DataLine label="Retraits organisateurs" value={data.omnia_live.retraits} />
                </div>
                <button onClick={() => navigate('/admin/omnia-live')} className="mt-4 inline-flex items-center gap-1 text-xs font-black text-[#5B5BD6]">Gérer Omnia Live <ArrowRight size={13} /></button>
              </div>

              <div className="rounded-2xl border border-slate-200/90 bg-white/90 backdrop-blur-sm p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-black text-[#002050]">Structures</h2>
                  <Building2 size={17} className="text-[#0F8A63]" />
                </div>
                <div className="mt-3 border-t border-slate-200">
                  <DataLine label="En attente de validation" value={data.structures.en_attente} />
                  <DataLine label="Actives / validées" value={data.structures.actives} />
                  <DataLine label="Organisateurs à valider" value={data.omnia_live.organisateurs} />
                </div>
                <button onClick={() => navigate('/admin/structures')} className="mt-4 inline-flex items-center gap-1 text-xs font-black text-[#0F7A59]">Gérer les structures <ArrowRight size={13} /></button>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-2xl border border-slate-200/90 bg-white/90 backdrop-blur-sm p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Utilisateurs</p>
                    <h2 className="mt-1 text-lg font-black text-[#002050]">Répartition par rôle</h2>
                  </div>
                  <Users size={18} className="text-[#2368C4]" />
                </div>
                <div className="mt-4 border-t border-slate-200">
                  {visibleRoleRows.length === 0 ? (
                    <p className="py-4 text-sm text-slate-400">Aucune donnée disponible.</p>
                  ) : visibleRoleRows.slice(0, 8).map(row => (
                    <button
                      key={row.role}
                      type="button"
                      onClick={() => navigate(`/admin/dashboard/roles/${encodeURIComponent(row.role_key || row.role)}`)}
                      className="group flex w-full items-center justify-between border-b border-slate-100 py-2.5 text-left last:border-b-0"
                    >
                      <span className="text-sm text-slate-600">{row.role}</span>
                      <span className="flex items-center gap-2 text-sm font-black text-[#002050]">{fmt(row.count)}<ArrowRight size={12} className="text-slate-300 group-hover:text-[#BF8813]" /></span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/90 bg-white/90 backdrop-blur-sm p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Système</p>
                    <h2 className="mt-1 text-lg font-black text-[#002050]">État de la plateforme</h2>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${platformOperational ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{platformOperational ? 'Opérationnelle' : 'À surveiller'}</span>
                </div>
                <div className="mt-4 border-t border-slate-200 pt-3">
                  <div className="flex items-center justify-between py-2 text-sm"><span className="text-slate-600">Maintenance globale</span><strong className={data.platform.maintenance_global ? 'text-red-600' : 'text-emerald-700'}>{data.platform.maintenance_global ? 'Active' : 'Inactive'}</strong></div>
                  <div className="border-t border-slate-100 py-2 text-sm"><span className="text-slate-600">Maintenance ciblée</span><p className="mt-1 text-xs text-slate-400">{data.platform.maintenance_modules.length ? data.platform.maintenance_modules.join(', ') : 'Aucun module en maintenance'}</p></div>
                </div>
                <button onClick={() => navigate('/admin/cms-branding')} className="mt-3 inline-flex items-center gap-1 text-xs font-black text-[#9B6B0B]">Gérer la plateforme <ArrowRight size={13} /></button>
              </div>
            </section>

            <section id="previsualiser-les-espaces" className="overflow-hidden rounded-2xl border border-slate-200 bg-[linear-gradient(115deg,#F8FBFF,#F7FAFC_48%,#FFF9EC)]">
              <div className="grid gap-5 px-5 py-5 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[#9B6B0B]"><Eye size={15} /> Prévisualisation</div>
                  <h2 className="mt-2 text-lg font-black text-[#002050]">Voir Omnia comme chaque rôle</h2>
                  <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">La prévisualisation conserve votre session et vos permissions Super-admin. Aucun rôle supplémentaire n’est attribué.</p>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  {previewSpaces.map(item => (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => openPreviewSpace(item.path, item.role)}
                      className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 text-xs font-bold text-[#002050] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" style={{ borderColor: item.theme.accent, background: item.theme.soft }}
                    >
                      <item.icon size={15} style={{ color: item.theme.accent }} />
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200/90 bg-white/90 backdrop-blur-sm p-5">
                <h2 className="text-base font-black text-[#002050]">Moyens de paiement</h2>
                <div className="mt-3 border-t border-slate-200">
                  {!data.paiements.available ? (
                    <p className="py-4 text-sm text-slate-400">Aucune transaction payée ne permet encore d’établir une répartition.</p>
                  ) : data.paiements.rows.map(row => (
                    <div key={row.gateway} className="border-b border-slate-100 py-3 last:border-b-0">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm text-slate-600">{row.gateway}</span>
                        <span className="text-sm font-bold text-[#002050]">{row.percent.toFixed(1)} % · {fmt(row.amount_xof)} XOF</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/90 bg-white/90 backdrop-blur-sm p-5">
                <div className="flex items-center gap-2"><AlertCircle size={16} className="text-[#BF8813]" /><h2 className="text-base font-black text-[#002050]">Lecture rapide</h2></div>
                <p className="mt-3 text-sm leading-6 text-slate-500">Cette vue regroupe uniquement les données déjà disponibles dans l’administration Omnia. Utilisez la navigation horizontale pour ouvrir chaque domaine et ses outils dédiés.</p>
                <button type="button" onClick={() => navigate('/admin/section/utilisateurs-acces')} className="mt-4 inline-flex items-center gap-1 text-xs font-black text-[#002050]">Ouvrir Utilisateurs & accès <ArrowRight size={13} /></button>
              </div>
            </section>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
