import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { ENDPOINTS } from '../lib/config';
import { CheckCircle, FileText, LayoutDashboard, Clock, Mail, Loader2, AlertCircle } from 'lucide-react';

interface OrderStatus {
  status: 'pending' | 'completed' | 'failed';
  order_number: string;
  course_id: string;
  course_title: string;
  amount_xof: number;
  paid_at?: string;
  invoice_url?: string;
}

function ConfettiParticle({ style }: { style: React.CSSProperties }) {
  return <div className="absolute rounded-sm opacity-80" style={style} />;
}

function Confetti() {
  const particles = Array.from({ length: 48 }, (_, i) => ({
    left: `${Math.random() * 100}%`,
    top: `${-10 - Math.random() * 20}%`,
    width: `${6 + Math.random() * 8}px`,
    height: `${6 + Math.random() * 8}px`,
    backgroundColor: ['#BF8813', '#002050', '#1E7A52', '#F59E0B', '#3B82F6', '#10B981'][i % 6],
    animation: `confettiFall ${1.5 + Math.random() * 2}s ease-in ${Math.random() * 0.8}s forwards`,
  }));

  return (
    <>
      <style>{`
        @keyframes confettiFall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(${360 + Math.random() * 360}deg); opacity: 0; }
        }
      `}</style>
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-40">
        {particles.map((p, i) => <ConfettiParticle key={i} style={p} />)}
      </div>
    </>
  );
}

export default function PaymentConfirmation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderNumber = searchParams.get('order');

  const [state, setState] = useState<'polling' | 'confirmed' | 'pending_manual'>('polling');
  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const pollCount = useRef(0);
  const maxPolls = 15; // 30 seconds at 2s interval

  useEffect(() => {
    if (!orderNumber) { navigate('/dashboard'); return; }
    const token = localStorage.getItem('omnia_session_token');
    if (!token) { navigate('/connexion'); return; }

    const poll = async () => {
      try {
        const res = await fetch(`${ENDPOINTS.paymentStatus}?order_number=${orderNumber}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const d: OrderStatus = await res.json();
        setOrder(d);

        if (d.status === 'completed') {
          setState('confirmed');
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 4000);
          return true;
        }
        if (d.status === 'failed') {
          navigate(`/paiement/echec?order=${orderNumber}&course=${d.course_id}`);
          return true;
        }
      } catch { /* continue polling */ }
      return false;
    };

    poll().then(done => {
      if (done) return;
      const interval = setInterval(async () => {
        pollCount.current += 1;
        if (pollCount.current >= maxPolls) {
          clearInterval(interval);
          setState('pending_manual');
          return;
        }
        const done = await poll();
        if (done) clearInterval(interval);
      }, 2000);
      return () => clearInterval(interval);
    });
  }, [orderNumber, navigate]);

  const fmt = (n: number) => n.toLocaleString('fr-FR');

  if (state === 'polling') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 max-w-md w-full text-center space-y-5">
          <div className="relative mx-auto w-20 h-20">
            <div className="w-20 h-20 rounded-full border-4 border-gray-100 absolute" />
            <div className="w-20 h-20 rounded-full border-4 border-t-transparent animate-spin absolute"
              style={{ borderColor: '#BF8813', borderTopColor: 'transparent' }} />
          </div>
          <div>
            <p className="font-bold text-lg" style={{ color: '#002050' }}>Vérification du paiement en cours…</p>
            <p className="text-sm text-gray-500 mt-1">Ne fermez pas cette page</p>
          </div>
          <div className="flex items-center justify-center gap-1.5">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-gray-300 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (state === 'confirmed' && order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        {showConfetti && <Confetti />}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 max-w-md w-full text-center space-y-6">
          <div className="mx-auto w-20 h-20 rounded-full flex items-center justify-center" style={{ backgroundColor: '#F0FAF5' }}>
            <CheckCircle className="w-10 h-10" style={{ color: '#1E7A52' }} />
          </div>
          <div>
            <h1 className="font-bold text-3xl mb-2" style={{ color: '#002050' }}>Paiement confirmé !</h1>
            <p className="text-gray-500 text-sm">Vous êtes maintenant inscrit à :</p>
            <p className="font-bold text-lg mt-2" style={{ color: '#002050' }}>{order.course_title}</p>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Commande</span>
              <span className="font-mono font-medium text-gray-700">{order.order_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Montant payé</span>
              <span className="font-semibold" style={{ color: '#002050' }}>{fmt(order.amount_xof)} XOF</span>
            </div>
            {order.paid_at && (
              <div className="flex justify-between">
                <span className="text-gray-500">Date</span>
                <span className="text-gray-700">{new Date(order.paid_at).toLocaleDateString('fr-FR')}</span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <button onClick={() => navigate(`/cours/${order.course_id}/apprendre`)}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#002050' }}>
              Commencer ma formation →
            </button>
            {order.invoice_url && (
              <a href={order.invoice_url} target="_blank" rel="noopener noreferrer"
                className="w-full py-3 rounded-xl border border-gray-200 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
                style={{ color: '#BF8813' }}>
                <FileText className="w-4 h-4" /> Voir ma facture
              </a>
            )}
            <button onClick={() => navigate('/dashboard')}
              className="w-full py-3 rounded-xl border border-gray-100 font-medium text-sm text-gray-500 flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors">
              <LayoutDashboard className="w-4 h-4" /> Retour à mon espace
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Pending manual state
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-20 h-20 rounded-full flex items-center justify-center" style={{ backgroundColor: '#FEF9EE' }}>
          <Clock className="w-10 h-10" style={{ color: '#BF8813' }} />
        </div>
        <div>
          <h1 className="font-bold text-2xl mb-2" style={{ color: '#002050' }}>Paiement en cours de vérification</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            Votre paiement est en cours de traitement. Vous recevrez un email de confirmation dès que le paiement sera validé.
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>Si le montant a été débité et que vous ne recevez pas de confirmation sous 15 minutes, contactez-nous.</p>
        </div>

        <a href="mailto:support@omniaglobalacademy.com"
          className="flex items-center justify-center gap-2 text-sm font-medium"
          style={{ color: '#002050' }}>
          <Mail className="w-4 h-4" /> support@omniaglobalacademy.com
        </a>

        {order && (
          <p className="text-xs text-gray-400 font-mono">Réf : {order.order_number}</p>
        )}

        <button onClick={() => navigate('/dashboard')}
          className="w-full py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors">
          Retour à mon espace
        </button>
      </div>
    </div>
  );
}
