import { useEffect, useState } from 'react';
import { CircleDollarSign, LockKeyhole, RefreshCw, WalletCards } from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';
import { CoachingAdvancedEarning, CoachingEarning, coachingRequest, formatCoachingDate, formatXof } from '../../lib/coachingApi';

const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

type RevenueData = {
  success: true;
  earnings: CoachingEarning[];
  advanced_earnings: CoachingAdvancedEarning[];
  payouts: Array<Record<string, any>>;
  metrics: { locked_xof: number; frozen_xof: number; credited_xof: number; commission_xof: number };
};

export default function AdminCoachingRevenue() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  async function load() { setLoading(true); setError(''); try { setData(await coachingRequest<RevenueData>('admin_revenue')); } catch (error) { setError(error instanceof Error ? error.message : 'Revenus indisponibles.'); } finally { setLoading(false); } }
  useEffect(() => { load(); }, []);

  return <AdminLayout><div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
    <header className="flex items-start justify-between border-b pb-5" style={{ borderColor: BORDER }}><div><span className="text-xs font-semibold uppercase tracking-[.16em]" style={{ color: GOLD }}>Omnia Coaching</span><h1 className="mt-1 text-2xl font-semibold" style={{ color: BLUE }}>Revenus des coachs</h1><p className="mt-2 text-sm text-slate-500">Séances individuelles, packs, groupes, crédits portefeuille et commissions OGA.</p></div><button onClick={load} className="rounded-lg px-3 py-2 text-white" style={{ background: BLUE }}><RefreshCw size={15}/></button></header>
    {error && <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {loading ? <p className="py-20 text-center text-sm text-slate-500">Chargement…</p> : <>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="À libérer" value={formatXof(data?.metrics.locked_xof)} icon={LockKeyhole}/><Metric label="Gelé par litige" value={formatXof(data?.metrics.frozen_xof)} icon={LockKeyhole}/><Metric label="Crédité aux coachs" value={formatXof(data?.metrics.credited_xof)} icon={WalletCards}/><Metric label="Commission OGA" value={formatXof(data?.metrics.commission_xof)} icon={CircleDollarSign}/></div>
      <SessionTable rows={data?.earnings || []}/>
      <AdvancedTable rows={data?.advanced_earnings || []}/>
    </>}
  </div></AdminLayout>;
}

function SessionTable({ rows }: { rows: CoachingEarning[] }) { return <section className="mt-6 overflow-hidden rounded-xl border bg-white" style={{ borderColor: BORDER }}><div className="border-b p-4" style={{ borderColor: BORDER }}><h2 className="font-semibold" style={{ color: BLUE }}>Séances individuelles</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-sm"><thead><tr className="border-b text-left text-xs text-slate-500" style={{ borderColor: BORDER }}><th className="p-4">Coach</th><th>Session</th><th>Brut</th><th>Commission</th><th>Net payable</th><th>Libération</th><th>Statut</th></tr></thead><tbody>{rows.length ? rows.map(row => <tr key={row.id} className="border-b last:border-0" style={{ borderColor: BORDER }}><td className="p-4"><p className="font-semibold" style={{ color: BLUE }}>{row.coach_user?.full_name || 'Coach Omnia'}</p><p className="text-xs text-slate-500">{row.coach_user?.email}</p></td><td><p>{row.session?.offer_title_snapshot || 'Session'}</p><p className="text-xs text-slate-500">{formatCoachingDate(row.session?.scheduled_start)}</p></td><td>{formatXof(row.gross_amount_xof)}</td><td>{formatXof(row.commission_amount_xof)}</td><td>{formatXof(Math.max(0, row.net_amount_xof - row.refunded_net_xof))}</td><td>{row.credited_at ? 'Crédité' : formatCoachingDate(row.unlock_at)}</td><td><Status value={row.status}/></td></tr>) : <tr><td colSpan={7} className="p-8 text-center text-slate-500">Aucun revenu de session.</td></tr>}</tbody></table></div></section>; }

function AdvancedTable({ rows }: { rows: CoachingAdvancedEarning[] }) { return <section className="mt-6 overflow-hidden rounded-xl border bg-white" style={{ borderColor: BORDER }}><div className="border-b p-4" style={{ borderColor: BORDER }}><h2 className="font-semibold" style={{ color: BLUE }}>Packs et coaching collectif</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[950px] text-sm"><thead><tr className="border-b text-left text-xs text-slate-500" style={{ borderColor: BORDER }}><th className="p-4">Coach</th><th>Produit</th><th>Type</th><th>Brut</th><th>Commission</th><th>Net</th><th>Statut</th></tr></thead><tbody>{rows.length ? rows.map(row => <tr key={row.id} className="border-b last:border-0" style={{ borderColor: BORDER }}><td className="p-4"><p className="font-semibold" style={{ color: BLUE }}>{row.coach_user?.full_name || 'Coach Omnia'}</p><p className="text-xs text-slate-500">{row.coach_user?.email}</p></td><td>{row.order?.offer_title_snapshot || 'Produit coaching'}</td><td>{row.source_type === 'group' ? 'Groupe' : 'Pack'}</td><td>{formatXof(row.gross_amount_xof)}</td><td>{formatXof(row.commission_amount_xof)}</td><td>{formatXof(row.net_amount_xof)}</td><td><Status value={row.status}/></td></tr>) : <tr><td colSpan={7} className="p-8 text-center text-slate-500">Aucun revenu de pack ou de groupe.</td></tr>}</tbody></table></div></section>; }

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: any }) { return <div className="rounded-xl border bg-white p-5" style={{ borderColor: BORDER }}><Icon color={GOLD}/><p className="mt-3 text-sm text-slate-500">{label}</p><p className="mt-1 text-xl font-semibold" style={{ color: BLUE }}>{value}</p></div>; }
function Status({ value }: { value: string }) { const danger = ['frozen', 'reversed'].includes(value), warning = value === 'locked'; return <span className="rounded-full px-2.5 py-1 text-xs font-semibold capitalize" style={{ background: danger ? '#FEF2F2' : warning ? '#FFF7E6' : '#ECFDF3', color: danger ? '#B42318' : warning ? '#9A6700' : '#027A48' }}>{value.replace(/_/g, ' ')}</span>; }
