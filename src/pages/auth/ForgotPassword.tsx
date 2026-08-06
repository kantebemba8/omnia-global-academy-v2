import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../components/AuthLayout';
import { COUNTRIES, getPrefix } from '../../lib/countries';

const inputCls =
  'w-full px-4 py-3 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#002050]/20 focus:border-[#002050] transition-colors';

export function ForgotPassword() {
  const navigate = useNavigate();
  const [method, setMethod] = useState<'email' | 'sms'>('email');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('');
  const [phoneLocal, setPhoneLocal] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (method === 'sms' && !country) { setError('Sélectionnez l’indicatif de votre pays.'); return; }
    setLoading(true);

    const phone_number = method === 'sms'
      ? getPrefix(country) + phoneLocal.replace(/^0+/, '')
      : undefined;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth-forgot-password`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            method,
            email: method === 'email' ? email.trim().toLowerCase() : undefined,
            phone_number,
          }),
        }
      );
      const data = await response.json();

      if (!data.success) {
        setError(data.message || 'Une erreur est survenue');
        return;
      }

      if (data.method === 'email') {
        setSuccess('✓ Un lien de réinitialisation a été envoyé à votre adresse email. Vérifiez votre boîte de réception et vos spams.');
      } else if (data.method === 'sms') {
        navigate('/verifier-otp', {
          state: { phone_number, purpose: 'reset_password' },
        });
      } else if (data.method === 'email_fallback') {
        setSuccess('✓ SMS indisponible — un code a été envoyé par email à votre adresse enregistrée.');
        setTimeout(() => {
          navigate('/verifier-otp', {
            state: { phone_number, purpose: 'reset_password' },
          });
        }, 3000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Mot de passe oublié"
      subtitle="Choisissez comment réinitialiser votre mot de passe"
    >
      {/* Sélecteur de méthode */}
      <div className="flex rounded-xl p-1 mb-6 mt-4"
        style={{ backgroundColor: '#F3F4F6' }}>
        <button
          type="button"
          onClick={() => { setMethod('email'); setError(''); setSuccess(''); }}
          className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all"
          style={{
            backgroundColor: method === 'email' ? '#002050' : 'transparent',
            color: method === 'email' ? '#FFFFFF' : '#6B7280',
          }}>
          Par email
        </button>
        <button
          type="button"
          onClick={() => { setMethod('sms'); setError(''); setSuccess(''); }}
          className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all"
          style={{
            backgroundColor: method === 'sms' ? '#002050' : 'transparent',
            color: method === 'sms' ? '#FFFFFF' : '#6B7280',
          }}>
          Par SMS
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-lg border p-3 text-sm"
            style={{ borderColor: '#1E7A52', backgroundColor: '#E4F1EA', color: '#1E7A52' }}>
            {success}
          </div>
        )}

        {method === 'email' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Adresse email
            </label>
            <input
              className={inputCls}
              type="email"
              placeholder="votre@email.com"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
        )}

        {method === 'sms' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Numéro de téléphone
            </label>
            <div className="flex gap-2">
              <select
                className="px-3 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#002050] bg-white"
                value={country}
                onChange={e => setCountry(e.target.value)}
              >
                <option value="">Indicatif</option>
                {COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>
                    {c.prefix} {c.label}
                  </option>
                ))}
              </select>
              <input
                className={`${inputCls} flex-1`}
                type="tel"
                placeholder="Numéro sans indicatif"
                required
                value={phoneLocal}
                onChange={e => setPhoneLocal(e.target.value)}
              />
            </div>
            <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
              Si le SMS échoue, le code sera envoyé par email automatiquement.
            </p>
          </div>
        )}

        {!success && (
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg font-semibold text-white transition-all"
            style={{ backgroundColor: loading ? '#9CA3AF' : '#002050' }}>
            {loading ? 'Envoi...' : method === 'email' ? 'Envoyer le lien' : 'Envoyer le code'}
          </button>
        )}

        <p className="text-center text-sm" style={{ color: '#6B7280' }}>
          <Link to="/connexion" className="font-semibold" style={{ color: '#BF8813' }}>
            ← Retour à la connexion
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
