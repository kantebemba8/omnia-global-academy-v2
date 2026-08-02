import { assertNativePaymentAvailable, redirectToWebPayment } from '../lib/mobile';
import { getSessionToken } from '../lib/session';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { ENDPOINTS } from '../lib/config';
import { edgeAuthHeaders } from '../lib/edgeAuth';
import { ShieldCheck, Clock, BadgeCheck, RefreshCw, CheckCircle, XCircle, Tag, Loader2 } from 'lucide-react';

interface CourseInfo {
  id: string; title: string; category: string; level: string;
  price_xof: number; cover_image_url: string | null;
  cpd_accredited: boolean; creator_name: string; is_free: boolean;
}

interface CouponResult {
  valid: boolean; discount_xof: number; final_price_xof: number; message: string;
}

const PAYMENT_LOGOS = [
  { name: 'Wave', bg: '#1DCAD3', text: '#fff', abbr: 'W' },
  { name: 'Orange Money', bg: '#FF6600', text: '#fff', abbr: 'OM' },
  { name: 'Moov', bg: '#0070C0', text: '#fff', abbr: 'MV' },
  { name: 'MTN', bg: '#FFCC00', text: '#000', abbr: 'MTN' },
  { name: 'Visa', bg: '#1A1F71', text: '#fff', abbr: 'VISA' },
  { name: 'Mastercard', bg: '#EB001B', text: '#fff', abbr: 'MC' },
];

const GUARANTEES = [
  'Paiement sécurisé via FedaPay',
  'Accès illimité à vie',
  'Remboursement 14 jours si non commencé',
  'Facture envoyée par email',
];

function fmt(n: number) { return n.toLocaleString('fr-FR'); }

export default function Checkout() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  const [course, setCourse] = useState<CourseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [couponInput, setCouponInput] = useState('');
  const [couponResult, setCouponResult] = useState<CouponResult | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = getSessionToken();
    if (!token) { navigate(`/connexion?redirect=/paiement/${courseId}`); return; }

    fetch(`${ENDPOINTS.courseDetail}?id=${courseId}`)
      .then(r => r.json())
      .then(d => { setCourse(d.course ?? null); setLoading(false); })
      .catch(() => setLoading(false));
  }, [courseId, navigate]);

  const applyCode = useCallback(async () => {
    if (!couponInput.trim() || !courseId) return;
    setCouponLoading(true);
    try {
      const res = await fetch(ENDPOINTS.checkoutValidateCoupon, {
        method: 'POST',
        headers: edgeAuthHeaders(),
        body: JSON.stringify({ coupon_code: couponInput.trim(), course_id: courseId }),
      });
      const d = await res.json();
      setCouponResult(d);
    } catch {
      setCouponResult({ valid: false, discount_xof: 0, final_price_xof: course?.price_xof ?? 0, message: 'Erreur lors de la vérification.' });
    } finally {
      setCouponLoading(false);
    }
  }, [couponInput, courseId, course?.price_xof]);

  const removeCode = () => { setCouponInput(''); setCouponResult(null); };

  const handlePay = async () => {
    if (!courseId) return;
    setSubmitting(true);
    setError('');
    try {
      if (finalPrice > 0) assertNativePaymentAvailable();
      const res = await fetch(ENDPOINTS.checkoutInit, {
        method: 'POST',
        headers: edgeAuthHeaders(),
        body: JSON.stringify({
          course_id: courseId,
          coupon_code: couponResult?.valid ? couponInput.trim() : undefined,
        }),
      });
      const d = await res.json();
      if (d.enrolled) {
        navigate(`/cours/${d.course_id}/apprendre`);
        return;
      }
      if (d.error) {
        const messages: Record<string, string> = {
          SELF_PURCHASE_FORBIDDEN: 'Vous ne pouvez pas acheter votre propre formation.',
          ALREADY_ENROLLED: 'Vous êtes déjà inscrit à cette formation.',
          PAYMENT_INIT_FAILED: 'Impossible d\'initialiser le paiement. Veuillez réessayer.',
        };
        setError(messages[d.error] ?? d.message ?? 'Une erreur est survenue.');
        return;
      }
      if (d.payment_url) {
        redirectToWebPayment(d.payment_url);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Erreur réseau. Veuillez réessayer.');
    } finally {
      setSubmitting(false);
    }
  };

  const originalPrice = course?.price_xof ?? 0;
  const discountXof = couponResult?.valid ? (couponResult.discount_xof ?? 0) : 0;
  const finalPrice = couponResult?.valid ? (couponResult.final_price_xof ?? originalPrice) : originalPrice;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#002050' }} />
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <XCircle className="w-12 h-12 text-red-400" />
          <p className="text-gray-600">Formation introuvable.</p>
          <Link to="/catalogue" className="text-sm font-medium" style={{ color: '#002050' }}>Retour au catalogue</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-8" style={{ color: '#002050' }}>Finaliser votre inscription</h1>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
          {/* Left — Order summary */}
          <div className="lg:col-span-3 space-y-5">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Récapitulatif de votre commande</p>

                {course.cover_image_url && (
                  <div className="rounded-xl overflow-hidden mb-4 aspect-video bg-gray-100">
                    <img src={course.cover_image_url} alt={course.title} className="w-full h-full object-cover" />
                  </div>
                )}

                <h2 className="font-bold text-lg leading-snug mb-2" style={{ color: '#002050' }}>{course.title}</h2>
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{course.category}</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{course.level}</span>
                  {course.cpd_accredited && (
                    <span className="text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1" style={{ backgroundColor: '#F0FAF5', color: '#1E7A52' }}>
                      <BadgeCheck className="w-3 h-3" /> Formation reconnue
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">Par {course.creator_name}</p>

                <div className="border-t border-gray-100 mt-5 pt-4 space-y-2">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Sous-total</span>
                    <span>{fmt(originalPrice)} XOF</span>
                  </div>
                  {discountXof > 0 && (
                    <div className="flex justify-between text-sm font-medium" style={{ color: '#1E7A52' }}>
                      <span>Réduction (code promo)</span>
                      <span>-{fmt(discountXof)} XOF</span>
                    </div>
                  )}
                  <div className="border-t border-gray-100 pt-3 flex justify-between items-baseline">
                    <span className="font-bold text-base" style={{ color: '#002050' }}>Total</span>
                    <span className="font-bold text-2xl" style={{ color: '#002050' }}>{fmt(finalPrice)} XOF</span>
                  </div>
                </div>
              </div>

              {/* Coupon section */}
              <div className="border-t border-gray-100 p-6">
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                  <Tag className="w-4 h-4" style={{ color: '#BF8813' }} /> Code promo
                </label>
                {couponResult?.valid ? (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-mono font-semibold" style={{ backgroundColor: '#F0FAF5', borderColor: '#1E7A52', color: '#1E7A52' }}>
                      <CheckCircle className="w-4 h-4 flex-shrink-0" /> {couponInput.toUpperCase()} — {couponResult.message}
                    </div>
                    <button onClick={removeCode} className="text-xs text-gray-400 hover:text-red-500 transition-colors whitespace-nowrap">Supprimer</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      value={couponInput}
                      onChange={e => setCouponInput(e.target.value.toUpperCase())}
                      onKeyDown={e => e.key === 'Enter' && applyCode()}
                      placeholder="PROMO2026"
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:border-gray-400"
                    />
                    <button onClick={applyCode} disabled={!couponInput.trim() || couponLoading}
                      className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50 disabled:opacity-50 transition-colors whitespace-nowrap">
                      {couponLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Appliquer'}
                    </button>
                  </div>
                )}
                {couponResult && !couponResult.valid && (
                  <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> {couponResult.message}
                  </p>
                )}
              </div>
            </div>

            {/* Guarantees */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <ul className="grid grid-cols-2 gap-2">
                {GUARANTEES.map(g => (
                  <li key={g} className="flex items-start gap-1.5 text-xs text-gray-600">
                    <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#1E7A52' }} /> {g}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right — Payment */}
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
              <div>
                <p className="font-semibold text-gray-800 mb-1">Mode de paiement</p>
                <p className="text-xs text-gray-500">Vous serez redirigé vers FedaPay pour finaliser le paiement en toute sécurité.</p>
              </div>

              {/* Payment method logos */}
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_LOGOS.map(m => (
                  <div key={m.name} title={m.name} className="h-10 rounded-lg flex items-center justify-center text-xs font-bold" style={{ backgroundColor: m.bg, color: m.text }}>
                    {m.abbr}
                  </div>
                ))}
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              )}

              <button
                onClick={handlePay}
                disabled={submitting}
                className="w-full py-4 rounded-xl text-white font-bold text-lg transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ backgroundColor: '#BF8813' }}
              >
                {submitting ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Redirection…</>
                ) : (
                  <>Procéder au paiement →</>
                )}
              </button>

              <div className="flex items-center gap-1.5 justify-center">
                <ShieldCheck className="w-3.5 h-3.5 text-gray-400" />
                <p className="text-xs text-gray-400">Paiement sécurisé SSL</p>
              </div>

              <p className="text-xs text-gray-400 text-center leading-relaxed">
                En procédant au paiement, vous acceptez nos{' '}
                <Link to="/confidentialite" className="underline hover:text-gray-600">Conditions Générales de Vente</Link>.
              </p>
            </div>

            {/* Summary card */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">Montant à payer</span>
                <Clock className="w-3.5 h-3.5 text-gray-300" />
              </div>
              <p className="text-2xl font-bold" style={{ color: '#002050' }}>{fmt(finalPrice)} <span className="text-sm font-normal text-gray-500">XOF</span></p>
              {discountXof > 0 && <p className="text-xs mt-0.5" style={{ color: '#1E7A52' }}>Vous économisez {fmt(discountXof)} XOF</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
