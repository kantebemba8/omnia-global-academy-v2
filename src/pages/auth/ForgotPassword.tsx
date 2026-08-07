import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '../../components/AuthLayout';
import { authFetch } from '../../lib/authApi';

const inputCls = 'w-full px-4 py-3 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#002050]/20 focus:border-[#002050] transition-colors';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);
    try {
      const data = await authFetch<{ success: boolean; message?: string }>('auth-forgot-password', { email: email.trim().toLowerCase() });
      if (!data.success) {
        setError(data.message || 'Une erreur est survenue');
        return;
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Mot de passe oublié" subtitle="Recevez un lien sécurisé par e-mail">
      <form onSubmit={handleSubmit} className="mt-4 space-y-5">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {success ? (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm leading-6 text-green-800">
            Si cette adresse correspond à un compte disponible, un lien de réinitialisation vient d’être envoyé. Vérifiez également vos courriers indésirables.
          </div>
        ) : (
          <>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Adresse e-mail</label>
              <input className={inputCls} type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="votre@email.com" />
            </div>
            <button type="submit" disabled={loading} className="w-full rounded-lg py-3 font-semibold text-white" style={{ backgroundColor: loading ? '#9CA3AF' : '#002050' }}>
              {loading ? 'Envoi…' : 'Envoyer le lien de réinitialisation'}
            </button>
          </>
        )}
        <p className="text-center text-sm text-gray-500"><Link to="/connexion" className="font-semibold" style={{ color: '#BF8813' }}>← Retour à la connexion</Link></p>
      </form>
    </AuthLayout>
  );
}
