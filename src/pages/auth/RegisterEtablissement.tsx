import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Info } from 'lucide-react';
import { AuthLayout } from '../../components/AuthLayout';
import { authFetch } from '../../lib/authApi';
import { COUNTRIES, getPrefix } from '../../lib/countries';

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

const toBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export function RegisterEtablissement() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    school_name: '',
    registration_number: '',
    director_name: '',
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
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (field: string, value: unknown) => setForm(f => ({ ...f, [field]: value }));
  const handleCountryChange = (code: string) => setForm(f => ({ ...f, country_code: code }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm_password) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    if (!logoFile) {
      setError('Veuillez téléverser le logo officiel de votre établissement');
      return;
    }
    if (!signatureFile) {
      setError('Veuillez téléverser la signature du directeur');
      return;
    }
    setError('');
    setLoading(true);
    const phone_number = getPrefix(form.country_code) + form.phone_local.replace(/^0+/, '');
    try {
      const [logo_base64, signature_base64] = await Promise.all([
        toBase64(logoFile),
        toBase64(signatureFile),
      ]);
      const data = await authFetch<RegisterResponse>('auth-register', {
        role: 'etablissement',
        school_name: form.school_name,
        registration_number: form.registration_number || undefined,
        director_name: form.director_name,
        email: form.email,
        phone_number,
        password: form.password,
        birth_date: form.birth_date,
        country_code: form.country_code,
        logo_base64,
        logo_mime: logoFile.type,
        signature_base64,
        signature_mime: signatureFile.type,
        allow_email: form.allow_email,
        allow_sms: form.allow_sms,
        allow_push: form.allow_push,
        subscribe_newsletter: form.subscribe_newsletter,
      });
      if (!data.success) {
        setError(data.message || 'Une erreur est survenue');
        return;
      }
      navigate('/en-attente-validation', {
        state: { role: 'etablissement', email: form.email },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Inscription Établissement" subtitle="Rejoignez le réseau Omnia Global Academy">
      {/* Intro card */}
      <div
        className="rounded-xl p-4 mb-6 flex items-start gap-3"
        style={{ backgroundColor: '#F8F9FA', border: '1px solid #E4E7EC' }}
      >
        <Info size={16} style={{ color: '#BF8813', flexShrink: 0, marginTop: 1 }} />
        <p className="text-sm" style={{ color: '#374151' }}>
          La validation de votre établissement est effectuée manuellement par notre équipe
          (sous 48h ouvrées). Vous serez notifié par email et SMS.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        {/* Nom établissement */}
        <div>
          <label className={labelCls}>Nom de l'établissement <span style={{ color: '#DC2626' }}>*</span></label>
          <input className={inputCls} type="text" required value={form.school_name} onChange={e => set('school_name', e.target.value)} />
        </div>

        {/* N° agrément */}
        <div>
          <label className={labelCls}>N° d'agrément ministériel <span className="text-gray-400 font-normal">(optionnel)</span></label>
          <input className={inputCls} type="text" placeholder="ex : AGR-2024-00123" value={form.registration_number} onChange={e => set('registration_number', e.target.value)} />
        </div>

        {/* Nom directeur */}
        <div>
          <label className={labelCls}>Nom du directeur <span style={{ color: '#DC2626' }}>*</span></label>
          <input className={inputCls} type="text" required value={form.director_name} onChange={e => set('director_name', e.target.value)} />
        </div>

        {/* Email */}
        <div>
          <label className={labelCls}>Email officiel</label>
          <input className={inputCls} type="email" required value={form.email} onChange={e => set('email', e.target.value)} />
        </div>

        {/* Téléphone */}
        <div>
          <label className={labelCls}>Téléphone</label>
          <div className="flex gap-2">
            <select
              className="px-3 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#002050] bg-white"
              value={form.country_code}
              onChange={e => handleCountryChange(e.target.value)}
            >
              {COUNTRIES.map(c => (
                <option key={c.code} value={c.code}>{c.prefix} {c.label}</option>
              ))}
            </select>
            <input className={`${inputCls} flex-1`} type="tel" placeholder="70 00 00 00" required value={form.phone_local} onChange={e => set('phone_local', e.target.value)} />
          </div>
        </div>

        {/* Pays de résidence */}
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
            <button type="button" className="absolute right-3 top-3.5 text-gray-400" onClick={() => setShowPwd(v => !v)}>
              {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {form.password && (() => {
            const s = getPasswordStrength(form.password);
            return (
              <div className="mt-1.5">
                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: s.width, backgroundColor: s.color }} />
                </div>
                <p className="text-xs mt-1 font-medium" style={{ color: s.color }}>Mot de passe {s.level}</p>
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
            <p className="text-xs mt-1" style={{ color: '#DC2626' }}>Les mots de passe ne correspondent pas</p>
          )}
        </div>

        {/* Date de naissance directeur */}
        <div>
          <label className={labelCls}>Date de naissance du directeur</label>
          <input className={inputCls} type="date" required max={new Date().toISOString().split('T')[0]} value={form.birth_date} onChange={e => set('birth_date', e.target.value)} />
        </div>

        {/* Logo */}
        <div>
          <label className={labelCls}>
            Logo officiel <span style={{ color: '#DC2626' }}>*</span>
            <span className="font-normal text-gray-400"> (PNG transparent recommandé)</span>
          </label>
          <input
            type="file" accept=".png,.jpg,.jpeg" required
            onChange={e => {
              const file = e.target.files?.[0];
              if (file && file.size > 2 * 1024 * 1024) {
                setError('Le logo ne doit pas dépasser 2 MB');
                e.target.value = '';
                return;
              }
              setLogoFile(file || null);
            }}
            className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#002050] file:text-white hover:file:opacity-90 cursor-pointer"
          />
          <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
            Le logo apparaîtra sur les certificats de vos apprenants
          </p>
        </div>

        {/* Signature */}
        <div>
          <label className={labelCls}>
            Signature du directeur <span style={{ color: '#DC2626' }}>*</span>
            <span className="font-normal text-gray-400"> (PNG)</span>
          </label>
          <input
            type="file" accept=".png" required
            onChange={e => {
              const file = e.target.files?.[0];
              if (file && file.size > 1 * 1024 * 1024) {
                setError('La signature ne doit pas dépasser 1 MB');
                e.target.value = '';
                return;
              }
              setSignatureFile(file || null);
            }}
            className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#002050] file:text-white hover:file:opacity-90 cursor-pointer"
          />
          <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
            La signature sera apposée sur les certificats
          </p>
        </div>

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
                type="checkbox" className="w-4 h-4 rounded"
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
          className="w-full py-3 rounded-lg font-semibold text-white transition-all"
          style={{ backgroundColor: loading ? '#9CA3AF' : '#002050' }}
        >
          {loading ? 'Envoi du dossier...' : 'Soumettre le dossier'}
        </button>

        <p className="text-center text-sm" style={{ color: '#6B7280' }}>
          <a href="/inscription" className="font-semibold" style={{ color: '#BF8813' }}>← Changer de profil</a>
        </p>
      </form>
    </AuthLayout>
  );
}
