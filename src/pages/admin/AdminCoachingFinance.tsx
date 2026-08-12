import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CircleDollarSign, Clock3, RefreshCw, Settings2, WalletCards, X, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import AdminCoachingManagementLayout from '../../components/admin/AdminCoachingManagementLayout';
import { CoachingRefund, coachingRequest, formatCoachingDate, formatXof } from '../../lib/coachingApi';

const BLUE = '#002050';
const GOLD = '#667A3D';
const BORDER = '#E4E7EC';

type FinanceOrder = {
  id: string; order_number: string; amount_xof: number; commission_amount_xof: number; coach_net_xof: number;
  payment_status: string; paid_at?: string | null; created_at: string;
  session?: { id: string; offer_title_snapshot: string; coach_name_snapshot: string; scheduled_start?: string | null; status: string } | null;
  invoice?: { id: string; invoice_number: string } | null;
};
type FinanceRefund = CoachingRefund & { user_id: string; session?: { offer_title_snapshot: string; coach_name_snapshot: string; scheduled_start?: string | null } | null };
type FinanceSettings = {
  cancellation_full_refund_hours: number; cancellation_partial_refund_hours: number; cancellation_partial_refund_percent: number;
  dispute_window_hours: number; reminder_day_before_hours: number; reminder_minutes_before: number;
};
type FinanceData = { success: true; orders: FinanceOrder[]; refunds: FinanceRefund[]; settings: FinanceSettings; metrics: { paid_xof: number; commission_xof: number; pending_orders: number; pending_refunds: number } };

export default function AdminCoachingFinance() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [tab, setTab] = useState<'refunds' | 'orders'>('refunds');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refund, setRefund] = useState<FinanceRefund | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  async function load() {
    setLoading(true); setError('');
    try { setData(await coachingRequest<FinanceData>('admin_finance')); }
    catch (e) { setError(e instanceof Error ? e.message : 'La gestion financière est indisponible.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  const openRefunds = useMemo(() => data?.refunds.filter(item => ['pending', 'under_review', 'approved', 'partially_approved'].includes(item.status)) || [], [data]);
  const metricCards = [
    { label: 'Paiements enregistrés', value: data?.metrics.paid_xof || 0, Icon: CircleDollarSign, money: true },
    { label: 'Commission OGA', value: data?.metrics.commission_xof || 0, Icon: WalletCards, money: true },
    { label: 'Commandes en attente', value: data?.metrics.pending_orders || 0, Icon: Clock3, money: false },
    { label: 'Remboursements à traiter', value: data?.metrics.pending_refunds || 0, Icon: RefreshCw, money: false },
  ];

  return <AdminCoachingManagementLayout><div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
    <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-5" style={{ borderColor: BORDER }}><div><span className="text-xs font-semibold uppercase tracking-[.16em]" style={{ color: GOLD }}>Omnia Coaching</span><h1 className="mt-1 text-2xl font-semibold" style={{ color: BLUE }}>Paiements et remboursements</h1><p className="mt-2 text-sm text-slate-500">Suivez les paiements FedaPay, les factures et le traitement administratif des remboursements.</p></div><div className="flex flex-wrap gap-2"><Link to="/admin/coaching" className="rounded-lg border px-3 py-2 text-sm font-semibold" style={{ borderColor: BORDER, color: BLUE }}>Retour à la gestion</Link><button onClick={() => setSettingsOpen(true)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold" style={{ borderColor: BORDER, color: BLUE }}><Settings2 size={15}/>Politique</button><button onClick={load} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white" style={{ background: BLUE }}><RefreshCw size={15}/>Actualiser</button></div></header>
    {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}{notice && <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">{notice}</div>}
    <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metricCards.map(({ label, value, Icon, money }) => <div key={label} className="rounded-xl border bg-white p-5" style={{ borderColor: BORDER }}><Icon color={GOLD}/><p className="mt-4 text-sm text-slate-500">{label}</p><p className="mt-1 text-2xl font-semibold" style={{ color: BLUE }}>{money ? formatXof(value) : String(value)}</p></div>)}</section>

    <nav className="mt-6 flex gap-1 border-b" style={{ borderColor: BORDER }}><button onClick={() => setTab('refunds')} className="border-b-2 px-4 py-3 text-sm font-semibold" style={{ borderColor: tab === 'refunds' ? GOLD : 'transparent', color: tab === 'refunds' ? BLUE : '#667085' }}>Remboursements ({openRefunds.length})</button><button onClick={() => setTab('orders')} className="border-b-2 px-4 py-3 text-sm font-semibold" style={{ borderColor: tab === 'orders' ? GOLD : 'transparent', color: tab === 'orders' ? BLUE : '#667085' }}>Commandes</button></nav>

    {loading ? <div className="py-20 text-center text-sm text-slate-500">Chargement…</div> : tab === 'refunds' ? <Refunds refunds={data?.refunds || []} onOpen={setRefund}/> : <Orders orders={data?.orders || []}/>} 
    {refund && <RefundModal refund={refund} onClose={() => setRefund(null)} onDone={async message => { setRefund(null); setNotice(message); await load(); }}/>} 
    {settingsOpen && data?.settings && <SettingsModal settings={data.settings} onClose={() => setSettingsOpen(false)} onDone={async () => { setSettingsOpen(false); setNotice('La politique financière du coaching a été mise à jour.'); await load(); }}/>} 
  </div></AdminCoachingManagementLayout>;
}

function Refunds({ refunds, onOpen }: { refunds: FinanceRefund[]; onOpen: (refund: FinanceRefund) => void }) {
  if (!refunds.length) return <Empty text="Aucune demande de remboursement."/>;
  return <section className="mt-5 overflow-hidden rounded-xl border bg-white" style={{ borderColor: BORDER }}><div className="overflow-x-auto"><table className="w-full min-w-[940px] text-sm"><thead><tr className="border-b text-left text-xs text-slate-500" style={{ borderColor: BORDER }}><th className="p-4">Session</th><th>Initiateur</th><th>Demandé</th><th>Approuvé</th><th>Statut</th><th>Date</th><th></th></tr></thead><tbody>{refunds.map(item => <tr key={item.id} className="border-b last:border-0" style={{ borderColor: BORDER }}><td className="p-4"><p className="font-semibold" style={{ color: BLUE }}>{item.session?.offer_title_snapshot || 'Session de coaching'}</p><p className="text-xs text-slate-500">{item.session?.coach_name_snapshot} · {formatCoachingDate(item.session?.scheduled_start)}</p></td><td className="capitalize">{item.initiated_by}</td><td>{formatXof(item.requested_amount_xof)}</td><td>{formatXof(item.approved_amount_xof)}</td><td><Status value={item.status}/></td><td className="text-xs text-slate-500">{new Date(item.created_at).toLocaleDateString('fr-FR')}</td><td className="pr-4 text-right"><button onClick={() => onOpen(item)} className="rounded-lg px-3 py-2 text-xs font-semibold text-white" style={{ background: BLUE }}>Traiter</button></td></tr>)}</tbody></table></div></section>;
}

function Orders({ orders }: { orders: FinanceOrder[] }) {
  if (!orders.length) return <Empty text="Aucune commande coaching."/>;
  return <section className="mt-5 overflow-hidden rounded-xl border bg-white" style={{ borderColor: BORDER }}><div className="overflow-x-auto"><table className="w-full min-w-[980px] text-sm"><thead><tr className="border-b text-left text-xs text-slate-500" style={{ borderColor: BORDER }}><th className="p-4">Commande</th><th>Session</th><th>Montant</th><th>Commission</th><th>Coach net</th><th>Statut</th><th>Facture</th></tr></thead><tbody>{orders.map(item => <tr key={item.id} className="border-b last:border-0" style={{ borderColor: BORDER }}><td className="p-4"><p className="font-semibold" style={{ color: BLUE }}>{item.order_number}</p><p className="text-xs text-slate-500">{formatCoachingDate(item.paid_at || item.created_at)}</p></td><td><p>{item.session?.offer_title_snapshot || 'Session'}</p><p className="text-xs text-slate-500">{item.session?.coach_name_snapshot}</p></td><td>{formatXof(item.amount_xof)}</td><td>{formatXof(item.commission_amount_xof)}</td><td>{formatXof(item.coach_net_xof)}</td><td><Status value={item.payment_status}/></td><td>{item.invoice?.invoice_number || '—'}</td></tr>)}</tbody></table></div></section>;
}

function RefundModal({ refund, onClose, onDone }: { refund: FinanceRefund; onClose: () => void; onDone: (message: string) => void }) {
  const approved = ['approved', 'partially_approved'].includes(refund.status);
  const [mode, setMode] = useState<'approve' | 'reject' | 'processed'>(approved ? 'processed' : 'approve');
  const [amount, setAmount] = useState(String(refund.approved_amount_xof ?? refund.requested_amount_xof));
  const [reason, setReason] = useState(refund.decision_reason || '');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit() {
    setBusy(true); setError('');
    try {
      if (mode === 'processed') await coachingRequest('admin_refund_processed', { refund_id: refund.id, provider_reference: reference });
      else await coachingRequest('admin_refund_decide', { refund_id: refund.id, decision: mode, approved_amount_xof: mode === 'approve' ? Number(amount) : undefined, reason });
      onDone(mode === 'processed' ? 'Le remboursement a été marqué comme traité.' : mode === 'approve' ? 'Le remboursement a été approuvé.' : 'Le remboursement a été refusé.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Décision impossible.'); }
    finally { setBusy(false); }
  }
  return <Modal title="Traiter le remboursement" onClose={onClose}><div className="rounded-xl bg-slate-50 p-4 text-sm"><p><strong>{refund.session?.offer_title_snapshot}</strong></p><p className="mt-1 text-slate-600">Demandé : {formatXof(refund.requested_amount_xof)} · Statut : {refund.status.replace(/_/g, ' ')}</p><p className="mt-2 text-slate-600">Motif : {refund.reason_code.replace(/_/g, ' ')} {refund.reason_details ? `— ${refund.reason_details}` : ''}</p></div><div className="mt-4 grid gap-2 sm:grid-cols-3"><Choice active={mode === 'approve'} onClick={() => setMode('approve')} icon={CheckCircle2} label="Approuver"/><Choice active={mode === 'reject'} onClick={() => setMode('reject')} icon={XCircle} label="Refuser" danger/><Choice active={mode === 'processed'} onClick={() => setMode('processed')} icon={WalletCards} label="Déjà remboursé"/></div>{mode === 'approve' && <Field label="Montant approuvé (FCFA)"><input type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} className="input"/></Field>}{mode !== 'processed' && <Field label={mode === 'reject' ? 'Motif obligatoire' : 'Commentaire administratif'}><textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} className="textarea"/></Field>}{mode === 'processed' && <Field label="Référence du remboursement FedaPay *"><input value={reference} onChange={e => setReference(e.target.value)} className="input" placeholder="Référence visible dans FedaPay"/></Field>}{error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="mt-5 flex justify-end gap-3"><button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm" style={{ borderColor: BORDER }}>Annuler</button><button disabled={busy || (mode === 'reject' && !reason.trim()) || (mode === 'processed' && !reference.trim())} onClick={submit} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: mode === 'reject' ? '#B42318' : BLUE }}>Confirmer</button></div><Styles/></Modal>;
}

function SettingsModal({ settings, onClose, onDone }: { settings: FinanceSettings; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ ...settings });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key: keyof FinanceSettings, value: string) => setForm(prev => ({ ...prev, [key]: Number(value) }));
  async function submit() { setBusy(true); setError(''); try { await coachingRequest('admin_finance_settings_save', form); onDone(); } catch (e) { setError(e instanceof Error ? e.message : 'Enregistrement impossible.'); } finally { setBusy(false); } }
  return <Modal title="Politique de paiement et remboursement" onClose={onClose}><div className="grid gap-4 sm:grid-cols-2"><Field label="Remboursement total avant (heures)"><input type="number" min="0" value={form.cancellation_full_refund_hours} onChange={e => set('cancellation_full_refund_hours', e.target.value)} className="input"/></Field><Field label="Remboursement partiel avant (heures)"><input type="number" min="0" value={form.cancellation_partial_refund_hours} onChange={e => set('cancellation_partial_refund_hours', e.target.value)} className="input"/></Field><Field label="Pourcentage partiel (%)"><input type="number" min="0" max="100" value={form.cancellation_partial_refund_percent} onChange={e => set('cancellation_partial_refund_percent', e.target.value)} className="input"/></Field><Field label="Fenêtre de litige (heures)"><input type="number" min="0" value={form.dispute_window_hours} onChange={e => set('dispute_window_hours', e.target.value)} className="input"/></Field><Field label="Premier rappel avant (heures)"><input type="number" min="1" value={form.reminder_day_before_hours} onChange={e => set('reminder_day_before_hours', e.target.value)} className="input"/></Field><Field label="Dernier rappel avant (minutes)"><input type="number" min="5" value={form.reminder_minutes_before} onChange={e => set('reminder_minutes_before', e.target.value)} className="input"/></Field></div>{error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="mt-5 flex justify-end gap-3"><button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm" style={{ borderColor: BORDER }}>Annuler</button><button disabled={busy} onClick={submit} className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: BLUE }}>Enregistrer</button></div><Styles/></Modal>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"><div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl"><div className="flex items-center justify-between border-b pb-4" style={{ borderColor: BORDER }}><h2 className="text-lg font-semibold" style={{ color: BLUE }}>{title}</h2><button onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100"><X size={18}/></button></div><div className="pt-5">{children}</div></div></div>; }
function Choice({ active, onClick, icon: Icon, label, danger = false }: { active: boolean; onClick: () => void; icon: typeof CheckCircle2; label: string; danger?: boolean }) { return <button onClick={onClick} className="inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold" style={{ borderColor: active ? (danger ? '#B42318' : GOLD) : BORDER, background: active ? (danger ? '#FEF2F2' : 'rgba(191,136,19,.08)') : 'white', color: danger ? '#B42318' : BLUE }}><Icon size={16}/>{label}</button>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="mt-4 block text-sm font-medium text-slate-700">{label}{children}</label>; }
function Status({ value }: { value: string }) { const danger = ['failed', 'rejected', 'disputed'].includes(value); const warning = ['pending', 'under_review', 'approved', 'partially_approved'].includes(value); return <span className="rounded-full px-2.5 py-1 text-xs font-semibold capitalize" style={{ background: danger ? '#FEF2F2' : warning ? '#FFF7E6' : '#ECFDF3', color: danger ? '#B42318' : warning ? '#9A6700' : '#027A48' }}>{value.replace(/_/g, ' ')}</span>; }
function Empty({ text }: { text: string }) { return <div className="mt-6 rounded-xl border bg-white py-16 text-center" style={{ borderColor: BORDER }}><CircleDollarSign className="mx-auto" color={GOLD}/><p className="mt-3 text-sm text-slate-500">{text}</p></div>; }
function Styles() { return <style>{`.input{margin-top:.35rem;height:2.65rem;width:100%;border:1px solid ${BORDER};border-radius:.7rem;padding:0 .75rem;font-size:.875rem;outline:none}.textarea{margin-top:.35rem;width:100%;border:1px solid ${BORDER};border-radius:.7rem;padding:.7rem;font-size:.875rem;outline:none}.input:focus,.textarea:focus{border-color:${GOLD}}`}</style>; }
