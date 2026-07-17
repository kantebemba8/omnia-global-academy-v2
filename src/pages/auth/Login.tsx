import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { AuthLayout } from '../../components/AuthLayout';
import { authFetch } from '../../lib/authApi';
import { COUNTRIES, getPrefix } from '../../lib/countries';

type LoginResponse = {
  success: boolean;
  message?: string;
  needs_validation?: boolean;
  demo_expired?: boolean;
  session_token?: string;
  redirect_url?: string;
  user?: {
    id: string;
    full_name: string;
    email: string;
    phone_number: string;
    roles: string[];
    force_password_change?: boolean;
  };
};

type OtpResponse = {
  success: boolean;
  message?: string;
  not_found?: boolean;
};

const inputCls =
  'w-full px-4 py-3 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#002050]/20 focus:border-[#002050] transition-colors';
const labelCls = 'block text-sm font-medium text-gray-700 mb-1.5';

export function Login() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'email' | 'phone'>('email');

  useEffect(() => {
    console.log('Login page loaded');
  }, []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  const [country, setCountry] = useState('ML');
  const [phoneLocal, setPhoneLocal] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [demoExpired, setDemoExpired] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const clearErrors = () => {
    setError('');
    setDemoExpired(false);
    setNotFound(false);
  };

  const handleSubmit = async () => {
    console.log('CLICKED', email, password);
    setLoading(true);
    setError('');

    try {
      const data = await authFetch<LoginResponse>('auth-login', { email: email.trim(), password });
      console.log('Response:', data);

      if (data.success) {
        localStorage.setItem('omnia_session_token', data.session_token!);
        localStorage.setItem('omnia_user', JSON.stringify(data.user));
        navigate(data.redirect_url || '/dashboard', { replace: true });
      } else {
        setError(data.message || 'Identifiants incorrects');
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const [phonePassword, setPhonePassword] = useState('');
  const [showPhonePwd, setShowPhonePwd] = useState(false);

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();
    setLoading(true);
    const phone_number = getPrefix(country) + phoneLocal.replace(/^0+/, '');
    try {
      const data = await authFetch<LoginResponse>('auth-login', { phone_number, password: phonePassword });
      if (data.success) {
        localStorage.setItem('omnia_session_token', data.session_token);
        localStorage.setItem('omnia_user', JSON.stringify(data.user));
        navigate(data.redirect_url || '/dashboard', { replace: true });
      } else {
        setError(data.message || 'Identifiants incorrects');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };
  return (
    <AuthLayout title="Se connecter">
      {/* Tabs */}
      <div className="flex rounded-xl p-1 mb-6" style={{ backgroundColor: '#F3F4F6' }}>
        <button
          type="button"
          onClick={() => { setTab('email'); clearErrors(); }}
          className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all"
          style={{
            backgroundColor: tab === 'email' ? '#002050' : 'transparent',
            color: tab === 'email' ? '#FFFFFF' : '#6B7280',
          }}
        >
          Email & Mot de passe
        </button>
        <button
          type="button"
          onClick={() => { setTab('phone'); clearErrors(); }}
          className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all"
          style={{
            backgroundColor: tab === 'phone' ? '#002050' : 'transparent',
            color: tab === 'phone' ? '#FFFFFF' : '#6B7280',
          }}
        >
          Numéro de téléphone
        </button>
      </div>

      {/* Demo expired banner */}
      {demoExpired && (
        <div
          className="flex items-start gap-3 rounded-xl border p-4 mb-4"
          style={{ borderColor: '#F97316', backgroundColor: '#FFF7ED' }}
        >
          <AlertTriangle size={18} style={{ color: '#F97316', flexShrink: 0, marginTop: 1 }} />
          <p className="text-sm" style={{ color: '#7C3A00' }}>
            Cet accès temporaire a expiré. Veuillez contacter l'administrateur.
          </p>
        </div>
      )}

      {/* Email login */}
      {tab === 'email' && (
        <form onSubmit={e => { e.preventDefault(); handleSubmit(); }} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className={labelCls}>Email</label>
            <input
              className={inputCls}
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div className="relative">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-gray-700">Mot de passe</label>
              <a href="/mot-de-passe-oublie" className="text-xs font-medium" style={{ color: '#BF8813' }}>
                Mot de passe oublié ?
              </a>
            </div>
            <input
              className={inputCls}
              type={showPwd ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="absolute right-3 top-9 text-gray-400"
              onClick={() => setShowPwd(v => !v)}
            >
              {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={loading}
            className="w-full py-3 rounded-lg font-semibold text-white transition-all mt-1"
            style={{ backgroundColor: '#002050' }}
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      )}

      {/* Phone OTP login */}
      {tab === 'phone' && (
        <form onSubmit={handlePhoneLogin} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {notFound && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Aucun compte trouvé pour ce numéro.{' '}
              <a href="/inscription" className="font-semibold underline" style={{ color: '#002050' }}>
                Créer un compte
              </a>
            </div>
          )}

         <div>
            <label className={labelCls}>Numéro de téléphone</label>
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
                type="tel"
                placeholder="70 00 00 00"
                required
                value={phoneLocal}
                onChange={e => setPhoneLocal(e.target.value)}
              />
            </div>
          </div>

          <div className="relative">
            <label className={labelCls}>Mot de passe</label>
            <input
              className={inputCls}
              type={showPhonePwd ? 'text' : 'password'}
              placeholder="Votre mot de passe"
              required
              value={phonePassword}
              onChange={e => setPhonePassword(e.target.value)}
            />
            <button
              type="button"
              className="absolute right-3 top-9 text-gray-400"
              onClick={() => setShowPhonePwd(v => !v)}
            >
              {showPhonePwd ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg font-semibold text-white transition-all"
            style={{ backgroundColor: '#002050' }}
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm" style={{ color: '#6B7280' }}>
        Pas encore de compte ?{' '}
        <a href="/inscription" className="font-semibold" style={{ color: '#BF8813' }}>
          S'inscrire
        </a>
      </p>
    </AuthLayout>
  );
}
