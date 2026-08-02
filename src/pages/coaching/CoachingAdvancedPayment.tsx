import { openExternalUrl } from '../../lib/mobile';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Clock3, FileText, RefreshCw, XCircle } from 'lucide-react';
import CoachingHeader from '../../components/coaching/CoachingHeader';
import { CoachingInvoice, CoachingPaymentOrder, coachingRequest, formatXof } from '../../lib/coachingApi';

const BLUE = '#002050';
const GOLD = '#BF8813';
const MAX_POLL_ATTEMPTS = 20;

type PaymentState = {
  order: CoachingPaymentOrder & { product_type?: string };
  invoice?: CoachingInvoice | null;
};

export default function CoachingAdvancedPayment() {
  const { orderId = '' } = useParams();
  const [data, setData] = useState<PaymentState | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    const result = await coachingRequest<PaymentState>('advanced_payment_status', { order_id: orderId });
    setData(result);
    setError('');
    return result.order?.payment_status;
  }

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    let attempts = 0;

    async function poll() {
      try {
        const status = await load();
        if (cancelled || status !== 'pending') return;
        attempts += 1;
        if (attempts >= MAX_POLL_ATTEMPTS) {
          setError('La confirmation prend plus de temps que prévu. Utilisez le bouton Actualiser dans quelques instants.');
          return;
        }
        timer = window.setTimeout(poll, 3000);
      } catch (currentError) {
        if (!cancelled) setError(currentError instanceof Error ? currentError.message : 'Vérification impossible.');
      }
    }

    void poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [orderId]);

  async function refresh() {
    setRefreshing(true);
    try {
      await load();
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'Vérification impossible.');
    } finally {
      setRefreshing(false);
    }
  }

  async function openInvoice() {
    if (!data?.invoice?.id) return;
    try {
      const result = await coachingRequest<{ signed_url: string }>('invoice_signed_url', { invoice_id: data.invoice.id });
      void openExternalUrl(result.signed_url);
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'Facture indisponible.');
    }
  }

  const status = data?.order.payment_status;

  return <div className="min-h-screen bg-slate-50">
    <CoachingHeader />
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="rounded-3xl border bg-white p-7 text-center shadow-sm">
        {status === 'paid'
          ? <CheckCircle2 className="mx-auto" size={52} color="#059669" />
          : status && status !== 'pending'
            ? <XCircle className="mx-auto" size={52} color="#DC2626" />
            : <Clock3 className="mx-auto" size={52} color={GOLD} />}
        <h1 className="mt-5 text-2xl font-bold" style={{ color: BLUE }}>
          {status === 'paid' ? 'Paiement confirmé' : status && status !== 'pending' ? 'Paiement non confirmé' : 'Confirmation du paiement en cours'}
        </h1>
        <p className="mt-2 text-slate-600">
          {data?.order ? `${data.order.order_number} — ${formatXof(data.order.amount_xof)}` : 'Nous vérifions la confirmation sécurisée transmise par FedaPay.'}
        </p>
        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/dashboard/coaching/avance" className="rounded-xl px-4 py-3 text-sm font-semibold text-white" style={{ background: BLUE }}>Voir mes produits</Link>
          <button disabled={refreshing} onClick={refresh} className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold disabled:opacity-50" style={{ color: BLUE }}>
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />Actualiser
          </button>
          {data?.invoice && <button onClick={openInvoice} className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold" style={{ color: BLUE }}><FileText size={16} />Facture</button>}
        </div>
      </div>
    </main>
  </div>;
}
