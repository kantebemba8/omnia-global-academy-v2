import { Link } from 'react-router-dom';
import { Clock, Mail, Phone } from 'lucide-react';

export default function DemoExpiredModal() {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-expired-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
    >
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 text-center">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
          style={{ backgroundColor: '#FEF3C7' }}
        >
          <Clock className="w-8 h-8" style={{ color: '#D97706' }} />
        </div>

        <h2 id="demo-expired-title" className="mb-2 text-xl font-bold" style={{ color: '#002050' }}>
          Session démo expirée
        </h2>
        <p className="text-gray-500 text-sm mb-6">
          Votre accès temporaire à la plateforme a expiré. Pour renouveler cet accès ou obtenir un accès permanent, contactez notre équipe.
        </p>

        <div className="rounded-xl p-4 mb-6 text-left space-y-3" style={{ backgroundColor: '#F0F4FF' }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#002050' }}>
            Contacter l'équipe Omnia
          </p>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#002050' }}>
              <Mail className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Email</p>
              <p className="text-sm font-medium" style={{ color: '#002050' }}>contact@omniaglobalacademy.com</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#002050' }}>
              <Phone className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Téléphone / WhatsApp</p>
              <p className="text-sm font-medium" style={{ color: '#002050' }}>+223 00 00 00 00</p>
            </div>
          </div>
        </div>

        <Link
          to="/accueil"
          className="block w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#002050' }}
        >
          Retour à l'accueil
        </Link>
      </div>
    </div>
  );
}
