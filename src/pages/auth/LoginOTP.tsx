import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../components/AuthLayout';
import { authFetch } from '../../lib/authApi';

type LoginOtpResponse = {
  success: boolean;
  message?: string;
  not_found?: boolean;
  error?: string;
  can_reactivate?: boolean;
};

const inputCls = 'w-full px-4 py-3 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#002050]/20 focus:border-[#002050] transition-colors';

export function LoginOTP() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reactivationRequired, setReactivationRequired] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setReactivationRequired(false);
    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();
    try {
      const data = await authFetch<LoginOtpResponse>('auth-login-otp', { email: normalizedEmail });
      if (!data.success) {
        if (data.can_reactivate && data.error === 'ACCOUNT_SELF_SUSPENDED') {
          setReactivationRequired(true);
          setError(data.message || 'Ce compte doit être réactivé avec son mot de passe.');
        } else {
          setError(data.message || 'Une erreur est survenue');
        }
        return;
      }
      navigate('/verifier-otp', { state: { email: normalizedEmail, purpose: 'connexion' } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Connexion rapide" subtitle="Recevez un code à usage unique par e-mail">
      <form onSubmit={handleSubmit} className="mt-4 space-y-5">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}{' '}
            {error.includes('inscrire') && <Link to="/inscription" className="font-semibold underline" style={{ color: '#002050' }}>S'inscrire</Link>}
            {reactivationRequired && <Link to="/connexion" className="ml-1 font-semibold underline" style={{ color: '#002050' }}>Connexion par mot de passe</Link>}
          </div>
        )}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Adresse e-mail</label>
          <input className={inputCls} type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="votre@email.com" />
        </div>
        <button type="submit" disabled={loading} className="w-full rounded-lg py-3 font-semibold text-white" style={{ backgroundColor: loading ? '#9CA3AF' : '#002050' }}>
          {loading ? 'Envoi du code…' : 'Recevoir le code par e-mail'}
        </button>
        <p className="text-center text-sm text-gray-500"><Link to="/connexion" className="font-semibold" style={{ color: '#BF8813' }}>← Connexion par mot de passe</Link></p>
      </form>
    </AuthLayout>
  );
}
