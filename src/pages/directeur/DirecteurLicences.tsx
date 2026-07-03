import { DashboardLayout } from '../../components/DashboardLayout';
import { Key, Mail } from 'lucide-react';

export function DirecteurLicences() {
  const bypassAuth = new URLSearchParams(window.location.search).get('preview') === 'true' &&
    (() => { try { return JSON.parse(localStorage.getItem('omnia_user') || '{}')?.roles?.includes('super_admin') ?? false; } catch { return false; } })();
  void bypassAuth;
  return (
    <DashboardLayout role="directeur">
      <div className="p-6 lg:p-8 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Licences B2B</h1>
          <p className="text-gray-500 text-sm mt-1">Codes d'accès groupés pour vos formations</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ backgroundColor: '#002050' + '10' }}>
            <Key className="w-8 h-8" style={{ color: '#002050' }} />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Aucune licence active</h2>
          <p className="text-gray-500 text-sm max-w-md mx-auto mb-6">
            Les licences de groupe sont créées par l'équipe Omnia Global Academy.
            Contactez-nous pour obtenir des accès groupés pour votre établissement.
          </p>
          <a href="mailto:contact@omniaglobalacademy.com"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#002050' }}>
            <Mail className="w-4 h-4" /> contact@omniaglobalacademy.com
          </a>
          <p className="text-xs text-gray-400 mt-4">
            Une fois attribuées, vos licences apparaîtront ici avec leur code, le nombre de places et la date d'expiration.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
