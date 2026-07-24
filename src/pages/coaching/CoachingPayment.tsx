import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Clock3, CreditCard, Download, Loader2, RefreshCw, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import CoachingHeader from '../../components/coaching/CoachingHeader';
import { CoachingInvoice, CoachingPaymentOrder, CoachingRefund, CoachingSession, coachingRequest, formatCoachingDate, formatXof } from '../../lib/coachingApi';

const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

type PaymentData = {
  session: CoachingSession;
  order: CoachingPaymentOrder | null;
  invoice: CoachingInvoice | null;
  refund: CoachingRefund | null;
};

export default function CoachingPayment() {
  const { sessionId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const returned = searchParams.get('retour') === 'fedapay';
  const cancelled = searchParams.get('annule') === '1';
  const [data, setData] = useState<PaymentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [polling, setPolling] = useState(returned);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    try {
      const result = await coachingRequest<{ success: true } & PaymentData>('payment_status', { session_id: sessionId });
      setData(result);
      setError('');
      if (result.order?.payment_status === 'paid' || result.session.payment_status === 'paid') setPolling(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Paiement indisponible.');
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => { load(); }, [sessionId]);
  useEffect(() => {
    if (!polling) return;
    let count = 0;
    const timer = window.setInterval(() => {
      count += 1;
      load(true);
      if (count >= 20) { window.clearInterval(timer); setPolling(false); }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [polling, sessionId]);

  const paid = data?.order?.payment_status === 'paid' || data?.session.payment_status === 'paid';
  const canPay = data?.session.status === 'pending_payment' && !paid;
  const expiresIn = useMemo(() => {
    if (!data?.session.hold_expires_at) return null;
    const minutes = Math.max(0, Math.ceil((new Date(data.session.hold_expires_at).getTime() - Date.now()) / 60000));
    return minutes;
  }, [data]);

  async function startPayment() {
    setBusy(true); setError('');
    try {
      const result = await coachingRequest<{ success: true; payment_url: string | null; already_paid: boolean }>('payment_checkout', { session_id: sessionId });
      if (result.already_paid) { await load(); return; }
      if (!result.payment_url) throw new Error('Le lien de paiement est indisponible.');
      window.location.assign(result.payment_url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Paiement impossible.');
    } finally { setBusy(false); }
  }

  async function openInvoice() {
    if (!data?.invoice?.id) return;
    setBusy(true); setError('');
    try {
      const result = await coachingRequest<{ success: true; signed_url: string }>('invoice_signed_url', { invoice_id: data.invoice.id });
      window.open(result.signed_url, '_blank', 'noopener,noreferrer');
    } catch (e) { setError(e instanceof Error ? e.message : 'Facture indisponible.'); }
    finally { setBusy(false); }
  }

  if (loading) return <div className="min-h-screen bg-[#F8FAFC]"><CoachingHeader/><div className="py-24 text-center text-sm text-slate-500">Chargement du paiement…</div></div>;

  return <div className="min-h-screen bg-[#F8FAFC]">
    <CoachingHeader />
    <main className="mx-auto max-w-4xl px-4 py-8 md:px-6">
      <Link to="/dashboard/coaching" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600"><ArrowLeft size={16}/>Retour à mes sessions</Link>
      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="rounded-2xl border bg-white p-6 md:p-8" style={{ borderColor: BORDER }}>
          {paid ? <>
            <CheckCircle2 size={50} color={GOLD}/>
            <h1 className="mt-4 text-3xl font-semibold" style={{ color: BLUE }}>Paiement confirmé</h1>
            <p className="mt-3 leading-7 text-slate-600">Votre session est confirmée. Les rappels seront envoyés avant le rendez-vous.</p>
          </> : <>
            <CreditCard size={46} color={GOLD}/>
            <h1 className="mt-4 text-3xl font-semibold" style={{ color: BLUE }}>Paiement de la session</h1>
            <p className="mt-3 leading-7 text-slate-600">Le paiement s’effectue sur l’interface sécurisée FedaPay. Aucune donnée de paiement n’est saisie directement dans OGA.</p>
          </>}

          {cancelled && !paid && <div className="mt-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><AlertTriangle size={19} className="shrink-0"/><p>Le paiement a été annulé. Aucun montant n’a été débité. Vous pouvez réessayer tant que le créneau reste réservé.</p></div>}
          {polling && !paid && <div className="mt-5 flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm" style={{ color: BLUE }}><Loader2 size={18} className="animate-spin"/>Vérification de la confirmation FedaPay…</div>}
          {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

          {data?.session && <div className="mt-7 divide-y rounded-xl border" style={{ borderColor: BORDER }}>
            <div className="flex justify-between gap-4 p-4"><span className="text-sm text-slate-500">Service</span><span className="text-right text-sm font-semibold" style={{ color: BLUE }}>{data.session.offer_title_snapshot}</span></div>
            <div className="flex justify-between gap-4 p-4"><span className="text-sm text-slate-500">Coach</span><span className="text-right text-sm font-semibold" style={{ color: BLUE }}>{data.session.coach_name_snapshot}</span></div>
            <div className="flex justify-between gap-4 p-4"><span className="text-sm text-slate-500">Date</span><span className="text-right text-sm font-semibold" style={{ color: BLUE }}>{formatCoachingDate(data.session.scheduled_start)}</span></div>
            <div className="flex justify-between gap-4 p-4"><span className="text-sm text-slate-500">Durée</span><span className="text-right text-sm font-semibold" style={{ color: BLUE }}>{data.session.duration_minutes} minutes</span></div>
            <div className="flex justify-between gap-4 p-4"><span className="text-sm text-slate-500">Total</span><span className="text-right text-base font-bold" style={{ color: GOLD }}>{formatXof(data.session.price_total_xof)}</span></div>
          </div>}

          <div className="mt-6 flex flex-wrap gap-3">
            {canPay && <button onClick={startPayment} disabled={busy} className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-60" style={{ background: BLUE }}>{busy ? <Loader2 size={17} className="animate-spin"/> : <CreditCard size={17}/>}Payer avec FedaPay</button>}
            {!paid && <button onClick={() => load()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-semibold" style={{ borderColor: BORDER, color: BLUE }}><RefreshCw size={17}/>Actualiser le statut</button>}
            {paid && data?.invoice && <button onClick={openInvoice} disabled={busy} className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white" style={{ background: BLUE }}><Download size={17}/>Télécharger la facture PDF</button>}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border bg-white p-5" style={{ borderColor: BORDER }}><ShieldCheck color={GOLD}/><h2 className="mt-3 font-semibold" style={{ color: BLUE }}>Paiement sécurisé</h2><p className="mt-2 text-sm leading-6 text-slate-600">La confirmation définitive vient du webhook FedaPay, pas du simple retour dans le navigateur.</p></div>
          {!paid && expiresIn !== null && <div className="rounded-2xl border bg-white p-5" style={{ borderColor: BORDER }}><Clock3 color={GOLD}/><h2 className="mt-3 font-semibold" style={{ color: BLUE }}>Créneau réservé</h2><p className="mt-2 text-sm leading-6 text-slate-600">Il reste environ <strong>{expiresIn} minute{expiresIn > 1 ? 's' : ''}</strong> pour terminer le paiement.</p></div>}
          {data?.order && <div className="rounded-2xl border bg-white p-5 text-sm" style={{ borderColor: BORDER }}><p className="text-slate-500">Commande</p><p className="mt-1 font-semibold" style={{ color: BLUE }}>{data.order.order_number}</p><p className="mt-3 text-slate-500">Statut</p><p className="mt-1 font-semibold capitalize" style={{ color: GOLD }}>{data.order.payment_status.replace(/_/g, ' ')}</p></div>}
        </aside>
      </div>
    </main>
  </div>;
}
