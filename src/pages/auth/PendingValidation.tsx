import { Clock, BookOpen } from 'lucide-react';
import { AuthLayout } from '../../components/AuthLayout';

export function PendingValidation() {
  return (
    <AuthLayout title="Dossier en cours d'examen">
      <div className="mt-2 space-y-5 text-center">
        {/* Icon */}
        <div className="flex justify-center">
          <Clock size={64} style={{ color: '#BF8813' }} />
        </div>

        <div>
          <p className="font-bold text-base mb-2" style={{ color: '#002050' }}>
            Merci pour votre inscription !
          </p>
          <p className="text-sm leading-relaxed" style={{ color: '#6B7280' }}>
            Votre dossier est en cours d'examen par notre équipe.
            Délai habituel : 24 à 48 heures ouvrées.
            Vous recevrez un email et un SMS dès que votre compte sera validé.
          </p>
        </div>

        {/* Info card */}
        <div
          className="rounded-xl p-4 text-left flex items-start gap-3"
          style={{ backgroundColor: '#F8F9FA', border: '1px solid #E5E7EB' }}
        >
          <BookOpen size={18} style={{ color: '#BF8813', flexShrink: 0, marginTop: 1 }} />
          <p className="text-sm" style={{ color: '#374151' }}>
            En attendant, vous pouvez consulter notre{' '}
            <a href="/catalogue" className="font-semibold underline" style={{ color: '#002050' }}>
              catalogue de formations
            </a>
            .
          </p>
        </div>

        <a
          href="/"
          className="block w-full py-3 rounded-lg font-semibold text-white transition-all"
          style={{ backgroundColor: '#002050' }}
        >
          Retour à l'accueil
        </a>
      </div>
    </AuthLayout>
  );
}
