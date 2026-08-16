import { useEffect, useState } from 'react';
import { CircleDollarSign, Clock3, LockKeyhole, RefreshCw, WalletCards, X } from 'lucide-react';
import CoachWorkspaceLayout from '../../components/coaching/CoachWorkspaceLayout';
import { CoachingAdvancedEarning, CoachingEarning, coachingRequest, formatCoachingDate, formatXof } from '../../lib/coachingApi';

const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

type RevenueData = {
  success: true;
  earnings: CoachingEarning[];
  advanced_earnings: CoachingAdvancedEarning[];
  wallet: { balance_xof: number; reserved_xof: number; total_earned_xof: number; total_withdrawn_xof: number };
  payouts: Array<Record<string, any>>;
  settings: Record<string, any>;
  metrics: { locked_xof: number; frozen_xof: number; available_earnings_xof: number; lifetime_net_xof: number };
};

export default function CoachRevenue() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState('');

  async function load() {
    setLoading(true); setError('');
    try { setData(await coachingRequest<RevenueData>('coach_revenue')); }
    catch (error) { setError(error instanceof Error ? error.message : 'Revenus indisponibles.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const available = Math.max(0, Number(data?.wallet.balance_xof || 0) - Number(data?.wallet.reserved_xof || 0));
  const minimum = Number(data?.settings.payout_minimum_xof ?? 0);

  return <CoachWorkspaceLayout>
    <div>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div><span className="text-xs font-semibold uppercase tracking-[.15em]" style={{ color: GOLD }}>Espace coach</span><h1 className="mt-2 text-3xl font-semibold" style={{ color: BLUE }}>Mes revenus</h1><p className="mt-2 text-sm text-slate-600">Les sessions et activités collectives validées sont créditées dans le portefeuille OGA après leur délai de libération. Les anciennes écritures restent visibles uniquement comme historique financier.</p></div>
        <div className="flex gap-2"><button onClick={load} className="rounded-xl border bg-white p-3" style={{ borderColor: BORDER }}><RefreshCw size={17}/></button><button disabled={available < minimum} onClick={() => setOpen(true)} className="rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" style={{ background: BLUE }}>Demander un retrait</button></div>
      </header>
      {notice && <div className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-700">{notice}</div>}
      {error && <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {loading ? <p className="py-20 text-center text-sm text-slate-500">Chargement…</p> : <>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Solde retirable" value={formatXof(available)} icon={WalletCards}/>
          <Metric label="Revenus verrouillés" value={formatXof(data?.metrics.locked_xof)} icon={Clock3}/>
          <Metric label="Revenus gelés" value={formatXof(data?.metrics.frozen_xof)} icon={LockKeyhole}/>
          <Metric label="Revenus nets cumulés" value={formatXof(data?.metrics.lifetime_net_xof)} icon={CircleDollarSign}/>
        </div>
        <SessionEarnings rows={data?.earnings || []}/>
        <AdvancedEarnings rows={data?.advanced_earnings || []}/>
        <section className="mt-6 rounded-2xl border bg-white p-5" style={{ borderColor: BORDER }}><h2 className="font-semibold" style={{ color: BLUE }}>Historique des retraits</h2><div className="mt-4 divide-y">{data?.payouts.length ? data.payouts.map(payout => <div key={payout.id} className="flex flex-wrap justify-between gap-3 py-3 text-sm"><div><strong>{formatXof(payout.amount_xof)}</strong><p className="text-xs text-slate-500">{String(payout.channel).replace(/_/g, ' ')} · {formatCoachingDate(payout.requested_at)}</p></div><Status value={payout.status}/></div>) : <p className="py-8 text-center text-sm text-slate-500">Aucun retrait demandé.</p>}</div></section>
      </>}
      {open && data && <Payout available={available} minimum={minimum} onClose={() => setOpen(false)} onDone={async () => { setOpen(false); setNotice('Votre demande de retrait a été transmise.'); await load(); }}/>} 
    </div>
  </CoachWorkspaceLayout>;
}

function SessionEarnings({ rows }: { rows: CoachingEarning[] }) {
  return <section className="mt-6 overflow-hidden rounded-2xl border bg-white" style={{ borderColor: BORDER }}><div className="border-b p-5" style={{ borderColor: BORDER }}><h2 className="font-semibold" style={{ color: BLUE }}>Séances individuelles</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead><tr className="border-b text-left text-xs text-slate-500" style={{ borderColor: BORDER }}><th className="p-4">Session</th><th>Brut</th><th>Commission</th><th>Net</th><th>Disponible le</th><th>Statut</th></tr></thead><tbody>{rows.length ? rows.map(row => <tr key={row.id} className="border-b last:border-0" style={{ borderColor: BORDER }}><td className="p-4"><p className="font-semibold" style={{ color: BLUE }}>{row.session?.offer_title_snapshot || 'Session coaching'}</p><p className="text-xs text-slate-500">{formatCoachingDate(row.session?.scheduled_start)}</p></td><td>{formatXof(row.gross_amount_xof)}</td><td>{formatXof(row.commission_amount_xof)}</td><td>{formatXof(Math.max(0, row.net_amount_xof - row.refunded_net_xof))}</td><td>{row.credited_at ? 'Crédité' : formatCoachingDate(row.unlock_at)}</td><td><Status value={row.status}/></td></tr>) : <tr><td colSpan={6} className="p-8 text-center text-slate-500">Aucun revenu de séance.</td></tr>}</tbody></table></div></section>;
}

function AdvancedEarnings({ rows }: { rows: CoachingAdvancedEarning[] }) {
  return <section className="mt-6 overflow-hidden rounded-2xl border bg-white" style={{ borderColor: BORDER }}><div className="border-b p-5" style={{ borderColor: BORDER }}><h2 className="font-semibold" style={{ color: BLUE }}>Coaching collectif et historique</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-sm"><thead><tr className="border-b text-left text-xs text-slate-500" style={{ borderColor: BORDER }}><th className="p-4">Produit</th><th>Type</th><th>Brut</th><th>Commission</th><th>Net</th><th>Statut</th></tr></thead><tbody>{rows.length ? rows.map(row => <tr key={row.id} className="border-b last:border-0" style={{ borderColor: BORDER }}><td className="p-4 font-semibold" style={{ color: BLUE }}>{row.order?.offer_title_snapshot || 'Produit coaching'}</td><td className="capitalize">{row.source_type === 'group' ? 'Groupe' : 'Historique'}</td><td>{formatXof(row.gross_amount_xof)}</td><td>{formatXof(row.commission_amount_xof)}</td><td>{formatXof(row.net_amount_xof)}</td><td><Status value={row.status}/></td></tr>) : <tr><td colSpan={6} className="p-8 text-center text-slate-500">Aucun revenu collectif ou historique.</td></tr>}</tbody></table></div></section>;
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: any }) { return <div className="rounded-2xl border bg-white p-5" style={{ borderColor: BORDER }}><Icon color={GOLD}/><p className="mt-3 text-sm text-slate-500">{label}</p><p className="mt-1 text-xl font-semibold" style={{ color: BLUE }}>{value}</p></div>; }
function Status({ value }: { value: string }) { const danger = ['frozen', 'reversed', 'failed', 'rejected'].includes(value), warning = ['locked', 'pending', 'approved'].includes(value); return <span className="rounded-full px-2.5 py-1 text-xs font-semibold capitalize" style={{ background: danger ? '#FEF2F2' : warning ? '#FFF7E6' : '#ECFDF3', color: danger ? '#B42318' : warning ? '#9A6700' : '#027A48' }}>{value.replace(/_/g, ' ')}</span>; }

function Payout({ available, minimum, onClose, onDone }: { available: number; minimum: number; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ amount_xof: available, channel: 'mobile_money', mm_operator: '', mm_phone: '', bank_name: '', account_holder: '', account_number: '', swift: '' });
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit() { setBusy(true); setError(''); try { await coachingRequest('coach_payout_request', form); onDone(); } catch (error) { setError(error instanceof Error ? error.message : 'Demande impossible.'); } finally { setBusy(false); } }
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-5"><div className="flex justify-between"><h2 className="font-semibold" style={{ color: BLUE }}>Demander un retrait</h2><button onClick={onClose}><X size={18}/></button></div><p className="mt-2 text-sm text-slate-500">Minimum {formatXof(minimum)} · Disponible {formatXof(available)}</p><label className="mt-4 block text-sm">Montant<input type="number" min={minimum} max={available} value={form.amount_xof} onChange={e => setForm({ ...form, amount_xof: Number(e.target.value) })} className="mt-1 h-11 w-full rounded-xl border px-3" style={{ borderColor: BORDER }}/></label><label className="mt-4 block text-sm">Canal<select value={form.channel} onChange={e => setForm({ ...form, channel: e.target.value })} className="mt-1 h-11 w-full rounded-xl border px-3" style={{ borderColor: BORDER }}><option value="mobile_money">Mobile Money</option><option value="bank_transfer">Virement bancaire UEMOA</option><option value="swift">SWIFT / International</option></select></label>{form.channel === 'mobile_money' ? <div className="grid gap-3 sm:grid-cols-2"><Field label="Opérateur" value={form.mm_operator} onChange={value => setForm({ ...form, mm_operator: value })}/><Field label="Téléphone" value={form.mm_phone} onChange={value => setForm({ ...form, mm_phone: value })}/></div> : <><Field label="Banque" value={form.bank_name} onChange={value => setForm({ ...form, bank_name: value })}/><Field label="Titulaire" value={form.account_holder} onChange={value => setForm({ ...form, account_holder: value })}/><Field label="Numéro de compte / IBAN" value={form.account_number} onChange={value => setForm({ ...form, account_number: value })}/>{form.channel === 'swift' && <Field label="Code SWIFT" value={form.swift} onChange={value => setForm({ ...form, swift: value })}/>}</>}{error && <p className="mt-3 text-sm text-red-600">{error}</p>}<div className="mt-5 flex justify-end gap-2"><button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm" style={{ borderColor: BORDER }}>Annuler</button><button disabled={busy || form.amount_xof < minimum || form.amount_xof > available} onClick={submit} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: BLUE }}>Confirmer</button></div></div></div>;
}
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="mt-4 block text-sm">{label}<input value={value} onChange={event => onChange(event.target.value)} className="mt-1 h-11 w-full rounded-xl border px-3" style={{ borderColor: BORDER }}/></label>; }
