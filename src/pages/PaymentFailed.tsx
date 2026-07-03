import { useSearchParams, useNavigate } from 'react-router-dom';
import { XCircle, ArrowLeft } from 'lucide-react';

export default function PaymentFailed() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const courseId = searchParams.get('course');
  const orderNumber = searchParams.get('order');

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-20 h-20 rounded-full flex items-center justify-center bg-red-50">
          <XCircle className="w-10 h-10 text-red-500" />
        </div>

        <div>
          <h1 className="font-bold text-2xl mb-2" style={{ color: '#002050' }}>Paiement annulé ou échoué</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            Votre carte ou compte Mobile Money n'a pas été débité. Vous pouvez réessayer à tout moment.
          </p>
        </div>

        {orderNumber && (
          <p className="text-xs text-gray-400 font-mono">Réf : {orderNumber}</p>
        )}

        <div className="space-y-3">
          {courseId && (
            <button
              onClick={() => navigate(`/paiement/${courseId}`)}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#002050' }}
            >
              Réessayer le paiement
            </button>
          )}
          <button
            onClick={() => navigate(courseId ? `/cours/${courseId}` : '/catalogue')}
            className="w-full py-3 rounded-xl border border-gray-200 font-medium text-sm text-gray-500 flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {courseId ? 'Retour à la formation' : 'Retour au catalogue'}
          </button>
        </div>
      </div>
    </div>
  );
}
