import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BriefcaseBusiness, Eye, EyeOff, Info, ShieldCheck } from 'lucide-react';
import { AuthLayout } from '../../components/AuthLayout';
import { authFetch } from '../../lib/authApi';
import { COUNTRIES, getPrefix } from '../../lib/countries';

const input = 'w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#002050]/20 focus:border-[#002050]';
const label = 'block text-sm font-medium text-gray-700 mb-1.5';

type FormState = {
  full_name: string;
  email: string;
  phone_local: string;
  password: string;
  confirm_password: string;
  country_code: string;
  company_name: string;
  job_title: string;
  linkedin_url: string;
  website_url: string;
  allow_email: boolean;
  allow_sms: boolean;
};

export function RegisterRecruiterIndependent() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>({
    full_name: '', email: '', phone_local: '', password: '', confirm_password: '',
    country_code: 'ML', company_name: '', job_title: '', linkedin_url: '', website_url: '',
    allow_email: true, allow_sms: true,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(current => ({ ...current, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (form.password !== form.confirm_password) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    setLoading(true);
    try {
      const phoneNumber = getPrefix(form.country_code) + form.phone_local.replace(/^0+/, '');
      const response = await authFetch<{ success: boolean; message?: string; user_id?: string }>('auth-register', {
        role: 'recruteur_independant',
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        professional_email: form.email.trim(),
        phone_number: phoneNumber,
        password: form.password,
        country_code: form.country_code,
        company_name: form.company_name.trim(),
        job_title: form.job_title.trim(),
        linkedin_url: form.linkedin_url.trim() || null,
        website_url: form.website_url.trim() || null,
        allow_email: form.allow_email,
        allow_sms: form.allow_sms,
      });
      if (!response.success) {
        setError(response.message || 'Inscription impossible.');
        return;
      }
      navigate('/verifier-otp', {
        state: { phone_number: phoneNumber, purpose: 'inscription', user_id: response.user_id },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Inscription recruteur indépendant"
      subtitle="Créez un compte professionnel distinct pour utiliser Omnia Talent"
    >
      <form onSubmit={submit} className="mt-4 space-y-4">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <div className="flex items-start gap-3 border-y border-amber-200 py-3 text-sm text-gray-600">
          <Info size={17} style={{ color: '#BF8813', flexShrink: 0, marginTop: 1 }} />
          <p>Ce compte est réservé au recrutement. Une adresse déjà utilisée par un compte apprenant ne peut pas être réutilisée.</p>
        </div>

        <div><label className={label}>Nom complet</label><input required className={input} value={form.full_name} onChange={e => set('full_name', e.target.value)} autoComplete="name" /></div>
        <div><label className={label}>Email professionnel</label><input required type="email" className={input} value={form.email} onChange={e => set('email', e.target.value)} autoComplete="email" /></div>
        <div><label className={label}>Entreprise ou cabinet</label><div className="relative"><BriefcaseBusiness size={17} className="absolute left-3 top-3.5 text-gray-400"/><input required className={`${input} pl-10`} value={form.company_name} onChange={e => set('company_name', e.target.value)} /></div></div>
        <div><label className={label}>Fonction</label><input required className={input} value={form.job_title} onChange={e => set('job_title', e.target.value)} placeholder="Responsable recrutement, consultant RH…" /></div>
        <div><label className={label}>Téléphone</label><div className="flex gap-2"><select className={`${input} max-w-[190px]`} value={form.country_code} onChange={e => set('country_code', e.target.value)}>{COUNTRIES.map(country => <option key={country.code} value={country.code}>{country.prefix} {country.label}</option>)}</select><input required className={input} value={form.phone_local} onChange={e => set('phone_local', e.target.value)} autoComplete="tel" /></div></div>
        <div><label className={label}>LinkedIn <span className="text-gray-400">(optionnel)</span></label><input type="url" className={input} value={form.linkedin_url} onChange={e => set('linkedin_url', e.target.value)} placeholder="https://www.linkedin.com/in/..." /></div>
        <div><label className={label}>Site internet <span className="text-gray-400">(optionnel)</span></label><input type="url" className={input} value={form.website_url} onChange={e => set('website_url', e.target.value)} placeholder="https://..." /></div>

        <div><label className={label}>Mot de passe</label><div className="relative"><input required minLength={8} type={showPassword ? 'text' : 'password'} className={input} value={form.password} onChange={e => set('password', e.target.value)} autoComplete="new-password"/><button type="button" onClick={() => setShowPassword(value => !value)} className="absolute right-3 top-3.5 text-gray-400" aria-label="Afficher le mot de passe">{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></div>
        <div><label className={label}>Confirmer le mot de passe</label><input required minLength={8} type={showPassword ? 'text' : 'password'} className={input} value={form.confirm_password} onChange={e => set('confirm_password', e.target.value)} autoComplete="new-password" /></div>

        <div className="flex items-start gap-3 border-y border-gray-200 py-3 text-sm text-gray-600">
          <ShieldCheck size={17} style={{ color: '#BF8813', flexShrink: 0, marginTop: 1 }} />
          <p>Après la vérification du téléphone, le dossier sera soumis au Super-admin. L’espace recruteur sera activé uniquement après validation.</p>
        </div>

        <button disabled={loading} className="w-full rounded-lg bg-[#002050] py-3 font-semibold text-white disabled:opacity-60">
          {loading ? 'Création du compte…' : 'Créer mon compte recruteur'}
        </button>
      </form>
    </AuthLayout>
  );
}
