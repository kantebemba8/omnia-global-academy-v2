import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { AuthLayout } from '../../components/AuthLayout';
import { authFetch } from '../../lib/authApi';
import { COUNTRIES, getPrefix } from '../../lib/countries';
import { saveSession } from '../../lib/session';

type LoginResponse = {
  success: boolean;
  message?: string;
  needs_validation?: boolean;
  demo_expired?: boolean;
  not_found?: boolean;
  is_demo?: boolean;
  heartbeat_token?: string;
  expires_at?: string;
  demo_roles?: string[];
  demo_course_ids?: string[];
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

const inputCls =
  'w-full px-4 py-3 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#002050]/20 focus:border-[#002050] transition-colors';
const labelCls = 'block text-sm font-medium text-gray-700 mb-1.5';

const DEMO_STORAGE_KEYS = [
  'heartbeat_token',
  'is_demo',
  'demo_roles',
  'demo_expires_at',
  'demo_course_ids',
] as const;

function clearDemoSessionMetadata() {
  for (const key of DEMO_STORAGE_KEYS) localStorage.removeItem(key);
}

function safeLocalRedirect(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [tab, setTab] = useState<'email' | 'phone'>('email');


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

  const completeLogin = (data: LoginResponse) => {
    if (!data.session_token || !data.user) {
      setError('Réponse de connexion incomplète. Veuillez réessayer.');
      return;
    }

    saveSession(data.session_token, data.user);

    if (data.is_demo) {
      localStorage.setItem('is_demo', 'true');
      if (data.heartbeat_token) localStorage.setItem('heartbeat_token', data.heartbeat_token);
      if (data.expires_at) localStorage.setItem('demo_expires_at', data.expires_at);
      localStorage.setItem('demo_roles', JSON.stringify(data.demo_roles ?? data.user.roles ?? []));
      localStorage.setItem('demo_course_ids', JSON.stringify(data.demo_course_ids ?? []));
    } else {
      clearDemoSessionMetadata();
    }

    if (data.user.force_password_change) {
      navigate('/changer-mot-de-passe', {
        replace: true,
        state: { session_token: data.session_token, user: data.user },
      });
      return;
    }

    const requestedRedirect = safeLocalRedirect(new URLSearchParams(location.search).get('redirect'));
    navigate(data.is_demo ? (data.redirect_url || '/demo/dashboard') : (requestedRedirect || data.redirect_url || '/dashboard'), { replace: true });
  };

  const handleLoginFailure = (data: LoginResponse, phoneMode = false) => {
    if (data.demo_expired) {
      setDemoExpired(true);
      setError('');
      return;
    }
    if (data.needs_validation) {
      navigate('/en-attente-validation', { replace: true });
      return;
    }
    if (phoneMode && data.not_found) {
      setNotFound(true);
      setError('');
      return;
    }
    setError(data.message || 'Identifiants incorrects');
  };

  const handleSubmit = async () => {
    clearErrors();
    setLoading(true);

    try {
      const data = await authFetch<LoginResponse>('auth-login', { email: email.trim(), password });

      if (data.success) completeLogin(data);
      else handleLoginFailure(data);
    } catch (err) {
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
      if (data.success) completeLogin(data);
      else handleLoginFailure(data, true);
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
              <Link to="/mot-de-passe-oublie" className="text-xs font-medium" style={{ color: '#BF8813' }}>
                Mot de passe oublié ?
              </Link>
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
              aria-label={showPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            >
              {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <button
            type="submit"
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
              <Link to="/inscription" className="font-semibold underline" style={{ color: '#002050' }}>
                Créer un compte
              </Link>
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
              aria-label={showPhonePwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
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
        <Link to="/inscription" className="font-semibold" style={{ color: '#BF8813' }}>
          S'inscrire
        </Link>
      </p>
    </AuthLayout>
  );
}
