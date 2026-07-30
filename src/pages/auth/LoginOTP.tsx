import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../components/AuthLayout';
import { authFetch } from '../../lib/authApi';
import { COUNTRIES, getPrefix } from '../../lib/countries';

type LoginOtpResponse = {
  success: boolean;
  message?: string;
  not_found?: boolean;
  next_step?: string;
};

const inputCls =
  'w-full px-4 py-3 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#002050]/20 focus:border-[#002050] transition-colors';

export function LoginOTP() {
  const navigate = useNavigate();
  const [country, setCountry] = useState('ML');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const phone_number = getPrefix(country) + phoneLocal.replace(/^0+/, '');
    try {
      const data = await authFetch<LoginOtpResponse>('auth-login-otp', { phone_number });
      if (!data.success) {
        if (data.not_found) {
          setError(data.message || 'Aucun compte trouvé. Souhaitez-vous vous inscrire ?');
        } else {
          setError(data.message || 'Une erreur est survenue');
        }
        return;
      }
      navigate('/verifier-otp', {
        state: { phone_number, purpose: 'connexion' },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Connexion rapide"
      subtitle="Recevez un code par SMS pour vous connecter"
    >
      <form onSubmit={handleSubmit} className="mt-4 space-y-5">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}{' '}
            {error.includes('inscrire') && (
              <Link to="/inscription" className="font-semibold underline" style={{ color: '#002050' }}>
                S'inscrire
              </Link>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Numéro de téléphone</label>
          <div className="flex gap-2">
            <select
              className="px-3 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#002050] bg-white"
              value={country}
              onChange={e => setCountry(e.target.value)}
            >
              {COUNTRIES.map(c => (
                <option key={c.code} value={c.code}>{c.prefix} {c.label}</option>
              ))}
            </select>
            <input
              className={`${inputCls} flex-1`}
              type="tel" placeholder="70 00 00 00" required
              value={phoneLocal} onChange={e => setPhoneLocal(e.target.value)}
            />
          </div>
        </div>

        <button
          type="submit" disabled={loading}
          className="w-full py-3 rounded-lg font-semibold text-white transition-all"
          style={{ backgroundColor: loading ? '#9CA3AF' : '#002050' }}
        >
          {loading ? 'Envoi du code...' : 'Recevoir le code SMS'}
        </button>

        <p className="text-center text-sm" style={{ color: '#6B7280' }}>
          <Link to="/connexion" className="font-semibold" style={{ color: '#BF8813' }}>
            ← Connexion par mot de passe
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
