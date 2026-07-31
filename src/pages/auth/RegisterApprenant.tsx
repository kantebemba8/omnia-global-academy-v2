import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { AuthLayout } from '../../components/AuthLayout';
import { authFetch } from '../../lib/authApi';
import { COUNTRIES, getPrefix } from '../../lib/countries';
import { getPublicSiteSettings } from '../../lib/siteSettingsCache';

type RegisterResponse = {
  success: boolean;
  message?: string;
  user_id?: string;
  next_step?: string;
};

const inputCls =
  'w-full px-4 py-3 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#002050]/20 focus:border-[#002050] transition-colors';
const labelCls = 'block text-sm font-medium text-gray-700 mb-1.5';

function getPasswordStrength(pwd: string): { level: string; color: string; width: string } {
  if (pwd.length === 0) return { level: 'faible', color: '#E4E7EC', width: '0%' };
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 2) return { level: 'faible', color: '#DC2626', width: '33%' };
  if (score <= 3) return { level: 'moyen', color: '#F59E0B', width: '66%' };
  return { level: 'fort', color: '#1E7A52', width: '100%' };
}

export function RegisterApprenant() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone_local: '',
    password: '',
    confirm_password: '',
    birth_date: '',
    country_code: 'ML',
    allow_email: true,
    allow_sms: true,
    allow_push: false,
    subscribe_newsletter: false,
  });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [referralEnabled, setReferralEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    getPublicSiteSettings()
      .then(settings => {
        if (!active) return;
        const enabled = settings.referral_enabled === true || settings.referral_enabled === 'true';
        setReferralEnabled(enabled);
        if (enabled) {
          const code = new URLSearchParams(window.location.search).get('ref');
          if (code) setReferralCode(code.trim());
        }
      })
      .catch(() => {
        if (active) setReferralEnabled(false);
      });

    return () => { active = false; };
  }, []);

  const set = (field: string, value: unknown) =>
    setForm(f => ({ ...f, [field]: value }));

  const handleCountryChange = (code: string) =>
    setForm(f => ({ ...f, country_code: code }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm_password) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    setError('');
    setLoading(true);
    const phone_number = getPrefix(form.country_code) + form.phone_local.replace(/^0+/, '');
    try {
      const data = await authFetch<RegisterResponse>('auth-register', {
        role: 'apprenant',
        full_name: form.full_name,
        email: form.email,
        phone_number,
        password: form.password,
        birth_date: form.birth_date,
        country_code: form.country_code,
        allow_email: form.allow_email,
        allow_sms: form.allow_sms,
        allow_push: form.allow_push,
        subscribe_newsletter: form.subscribe_newsletter,
        referral_code: referralEnabled && referralCode ? referralCode : undefined,
      });
      if (!data.success) {
        setError(data.message || 'Une erreur est survenue');
        return;
      }
      navigate('/verifier-otp', {
        state: { phone_number, purpose: 'inscription', user_id: data.user_id },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Inscription Apprenant" subtitle="Créez votre espace d'apprentissage">
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Nom complet */}
        <div>
          <label className={labelCls}>Nom complet</label>
          <input
            className={inputCls} type="text" autoComplete="name" required
            value={form.full_name} onChange={e => set('full_name', e.target.value)}
          />
        </div>

        {/* Email */}
        <div>
          <label className={labelCls}>Email</label>
          <input
            className={inputCls} type="email" autoComplete="email" required
            value={form.email} onChange={e => set('email', e.target.value)}
          />
        </div>

        {/* Téléphone (synchronisé avec pays) */}
        <div>
          <label className={labelCls}>Téléphone</label>
          <div className="flex gap-2">
            <select
              className="px-3 py-3 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-[#002050] bg-white"
              value={form.country_code}
              onChange={e => handleCountryChange(e.target.value)}
            >
              {COUNTRIES.map(c => (
                <option key={c.code} value={c.code}>{c.prefix} {c.label}</option>
              ))}
            </select>
            <input
              className={`${inputCls} flex-1`} type="tel" placeholder="70 00 00 00" required
              value={form.phone_local} onChange={e => set('phone_local', e.target.value)}
            />
          </div>
        </div>

        {/* Pays de résidence — synchronisé avec le SELECT téléphone */}
        <div>
          <label className={labelCls}>Pays de résidence</label>
          <select
            className={inputCls}
            value={form.country_code}
            onChange={e => handleCountryChange(e.target.value)}
            required
          >
            {COUNTRIES.map(c => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
        </div>

        {/* Mot de passe + force */}
        <div>
          <label className={labelCls}>Mot de passe</label>
          <div className="relative">
            <input
              className={inputCls} type={showPwd ? 'text' : 'password'}
              autoComplete="new-password" required minLength={8}
              value={form.password} onChange={e => set('password', e.target.value)}
            />
            <button
              type="button" className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600"
              onClick={() => setShowPwd(v => !v)}
            >
              {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {form.password && (() => {
            const s = getPasswordStrength(form.password);
            return (
              <div className="mt-1.5">
                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: s.width, backgroundColor: s.color }}
                  />
                </div>
                <p className="text-xs mt-1 font-medium" style={{ color: s.color }}>
                  Mot de passe {s.level}
                </p>
              </div>
            );
          })()}
        </div>

        {/* Confirmer mot de passe */}
        <div>
          <label className={labelCls}>Confirmer le mot de passe</label>
          <input
            className={inputCls} type={showPwd ? 'text' : 'password'}
            autoComplete="new-password" required
            value={form.confirm_password} onChange={e => set('confirm_password', e.target.value)}
          />
          {form.confirm_password && form.confirm_password !== form.password && (
            <p className="text-xs mt-1" style={{ color: '#DC2626' }}>
              Les mots de passe ne correspondent pas
            </p>
          )}
        </div>

        {/* Date de naissance */}
        <div>
          <label className={labelCls}>Date de naissance</label>
          <input
            className={inputCls} type="date" required
            max={new Date().toISOString().split('T')[0]}
            value={form.birth_date} onChange={e => set('birth_date', e.target.value)}
          />
          <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
            Requise pour sécuriser votre compte
          </p>
        </div>

        {referralEnabled && (
          <div>
            <label className={labelCls}>Code de parrainage (optionnel)</label>
            <input
              type="text"
              className={inputCls}
              placeholder="Collez le code de votre parrain"
              value={referralCode}
              onChange={e => setReferralCode(e.target.value.trim())}
            />
          </div>
        )}

        {/* Consentements */}
        <div className="pt-1 space-y-2">
          {(
            [
              { field: 'allow_email',          label: 'Recevoir les actualités par email' },
              { field: 'allow_sms',            label: 'Recevoir les alertes par SMS' },
              { field: 'allow_push',           label: 'Recevoir des notifications push' },
              { field: 'subscribe_newsletter', label: "S'abonner à la newsletter" },
            ] as { field: keyof typeof form; label: string }[]
          ).map(({ field, label }) => (
            <label key={field} className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 rounded"
                style={{ accentColor: '#002050' }}
                checked={form[field] as boolean}
                onChange={e => set(field, e.target.checked)}
              />
              <span className="text-sm" style={{ color: '#374151' }}>{label}</span>
            </label>
          ))}
        </div>

        <button
          type="submit" disabled={loading}
          className="w-full py-3 rounded-lg font-semibold text-white transition-all mt-2"
          style={{ backgroundColor: loading ? '#9CA3AF' : '#002050' }}
        >
          {loading ? 'Inscription en cours...' : 'Créer mon compte'}
        </button>

        <p className="text-center text-sm" style={{ color: '#6B7280' }}>
          Déjà un compte ?{' '}
          <Link to="/connexion" className="font-semibold" style={{ color: '#BF8813' }}>
            Se connecter
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
