import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { AuthLayout } from '../../components/AuthLayout';
import { authFetch, authSessionFetch } from '../../lib/authApi';
import { COUNTRIES, getPrefix } from '../../lib/countries';
import { getSessionToken, getStoredUser } from '../../lib/session';

type RegisterResponse = { success: boolean; message?: string; user_id?: string; next_step?: string; email_sent?: boolean; status?: string };
type StoredUser = { full_name?: string; email?: string; phone_number?: string; roles?: string[] };

const inputCls = 'w-full px-4 py-3 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#002050]/20 focus:border-[#002050] transition-colors';
const labelCls = 'block text-sm font-medium text-gray-700 mb-1.5';
const EXPERTISE_DOMAINS = [
  'Data & Intelligence Artificielle','Informatique & Développement','Cybersécurité & Réseaux','Business & Entrepreneuriat','Finance & Comptabilité','Droit & Juridique','Marketing & Communication','Santé & Médecine','Architecture & BTP','Éducation & Pédagogie','Langues & Linguistique','Agriculture & Agro-business','Tourisme & Hôtellerie','Environnement & Développement durable','Bien-être & Développement personnel','Artisanat & Métiers manuels','Cuisine & Gastronomie','Mode & Stylisme','Élevage & Pêche','Arts & Créativité','Musique & Audio','Loisirs & Hobbies','Autre',
];

function getPasswordStrength(pwd: string): { level: string; color: string; width: string } {
  if (!pwd) return { level: 'faible', color: '#E4E7EC', width: '0%' };
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

const toBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve((reader.result as string).split(',')[1]);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

export function RegisterProfesseur() {
  const navigate = useNavigate();
  const existingUser = getStoredUser<StoredUser>();
  const addingToExistingAccount = Boolean(getSessionToken() && existingUser);
  const [form, setForm] = useState({
    full_name: existingUser?.full_name || '', email: existingUser?.email || '', phone_local: '', password: '', confirm_password: '', birth_date: '', country_code: '', expertise_domain: '', bio: '', allow_email: true, allow_sms: false, allow_push: false, subscribe_newsletter: false,
  });
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (field: string, value: unknown) => setForm(current => ({ ...current, [field]: value }));

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!addingToExistingAccount && !cvFile) { setError('Veuillez joindre votre CV ou diplôme (PDF)'); return; }
    if (!addingToExistingAccount && form.password !== form.confirm_password) { setError('Les mots de passe ne correspondent pas'); return; }
    if (!addingToExistingAccount && !form.country_code) { setError('Sélectionnez votre pays de résidence.'); return; }
    setError('');
    setLoading(true);
    try {
      const cv_diploma_base64 = cvFile ? await toBase64(cvFile) : undefined;
      if (addingToExistingAccount) {
        const data = await authSessionFetch<RegisterResponse>('auth-register', {
          action: 'apply_existing_role', target_role: 'professeur', expertise_domain: form.expertise_domain, bio: form.bio || undefined, cv_diploma_base64, cv_diploma_mime: cvFile ? 'application/pdf' : undefined,
        });
        if (!data.success) throw new Error(data.message || 'Une erreur est survenue');
        navigate('/inscription?mode=add-role', { replace: true });
        return;
      }
      const phone_number = getPrefix(form.country_code) + form.phone_local.replace(/^0+/, '');
      const data = await authFetch<RegisterResponse>('auth-register', {
        role: 'professeur', full_name: form.full_name, email: form.email, phone_number, password: form.password, birth_date: form.birth_date, country_code: form.country_code, expertise_domain: form.expertise_domain, bio: form.bio || undefined, cv_diploma_base64, cv_diploma_mime: cvFile ? 'application/pdf' : undefined, allow_email: form.allow_email, allow_sms: form.allow_sms, allow_push: form.allow_push, subscribe_newsletter: form.subscribe_newsletter,
      });
      if (!data.success) throw new Error(data.message || 'Une erreur est survenue');
      navigate('/verifier-otp', { state: { email: form.email.trim().toLowerCase(), purpose: 'inscription', user_id: data.user_id, initial_email_sent: data.email_sent !== false } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally { setLoading(false); }
  }

  return (
    <AuthLayout title={addingToExistingAccount ? 'Devenir Professeur' : 'Inscription Professeur'} subtitle={addingToExistingAccount ? 'Votre compte Omnia reste le même. Le rôle Professeur sera ajouté après validation de votre dossier.' : 'Partagez votre expertise avec nos apprenants'} variant="wide">
      <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 md:col-span-2">{error}</div>}
        {addingToExistingAccount && <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm leading-6 text-blue-800 md:col-span-2">Vous candidatez avec <strong>{existingUser?.email}</strong>. Aucun nouveau compte ni mot de passe ne sera créé.</div>}

        {!addingToExistingAccount && <>
          <div><label className={labelCls}>Nom complet</label><input className={inputCls} type="text" required value={form.full_name} onChange={e => set('full_name', e.target.value)} /></div>
          <div><label className={labelCls}>Email</label><input className={inputCls} type="email" required value={form.email} onChange={e => set('email', e.target.value)} /></div>
          <div><label className={labelCls}>Téléphone</label><div className="flex flex-col gap-2 sm:flex-row"><select className="w-full rounded-lg border border-gray-200 bg-white px-3 py-3 text-sm focus:border-[#002050] focus:outline-none sm:w-[210px]" value={form.country_code} onChange={e => set('country_code', e.target.value)}><option value="">Indicatif</option>{COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.prefix} {c.label}</option>)}</select><input className={`${inputCls} flex-1`} type="tel" placeholder="Numéro sans indicatif" required value={form.phone_local} onChange={e => set('phone_local', e.target.value)} /></div></div>
          <div><label className={labelCls}>Pays de résidence</label><select className={inputCls} value={form.country_code} onChange={e => set('country_code', e.target.value)} required><option value="">Choisir un pays</option>{COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}</select></div>
          <div><label className={labelCls}>Mot de passe</label><div className="relative"><input className={inputCls} type={showPwd ? 'text' : 'password'} autoComplete="new-password" required minLength={8} value={form.password} onChange={e => set('password', e.target.value)} /><button type="button" className="absolute right-3 top-3.5 text-gray-400" onClick={() => setShowPwd(v => !v)}>{showPwd ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div>{form.password && (() => { const strength = getPasswordStrength(form.password); return <div className="mt-1.5"><div className="h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full" style={{ width: strength.width, backgroundColor: strength.color }}/></div><p className="mt-1 text-xs font-medium" style={{ color: strength.color }}>Mot de passe {strength.level}</p></div>; })()}</div>
          <div><label className={labelCls}>Confirmer le mot de passe</label><input className={inputCls} type={showPwd ? 'text' : 'password'} autoComplete="new-password" required value={form.confirm_password} onChange={e => set('confirm_password', e.target.value)} /></div>
          <div><label className={labelCls}>Date de naissance</label><input className={inputCls} type="date" required max={new Date().toISOString().split('T')[0]} value={form.birth_date} onChange={e => set('birth_date', e.target.value)} /><p className="mt-1 text-xs text-gray-500">Requise pour sécuriser votre compte</p></div>
        </>}

        <div className={addingToExistingAccount ? 'md:col-span-2' : ''}><label className={labelCls}>Domaine d'expertise <span className="text-red-600">*</span></label><select className={inputCls} required value={form.expertise_domain} onChange={e => set('expertise_domain', e.target.value)}><option value="">— Sélectionnez un domaine —</option>{EXPERTISE_DOMAINS.map(domain => <option key={domain} value={domain}>{domain}</option>)}</select></div>
        <div className="md:col-span-2"><label className={labelCls}>Biographie <span className="font-normal text-gray-400">(optionnel)</span></label><textarea className={`${inputCls} resize-none`} rows={3} placeholder="Présentez votre parcours et votre expérience..." value={form.bio} onChange={e => set('bio', e.target.value)} /></div>
        <div className="md:col-span-2"><label className={labelCls}>CV / Diplôme <span className="text-red-600">*</span></label><input type="file" accept=".pdf" required={!addingToExistingAccount} onChange={e => { const file=e.target.files?.[0]; if (file && file.size > 4*1024*1024) { setError('Le fichier PDF ne doit pas dépasser 4 MB'); e.target.value=''; return; } setCvFile(file || null); }} className="w-full cursor-pointer text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#002050] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"/><p className="mt-1 text-xs text-gray-500">Document vérifié avant activation du rôle Professeur (PDF, max 4 MB). Si un document existe déjà dans un dossier à corriger, vous pouvez le conserver.</p></div>

        {!addingToExistingAccount && <div className="space-y-2 pt-1 md:col-span-2">{([
          { field:'allow_email', label:'Recevoir les actualités par email' }, { field:'allow_sms', label:'Recevoir les alertes par SMS' }, { field:'allow_push', label:'Recevoir des notifications push' }, { field:'subscribe_newsletter', label:"S'abonner à la newsletter" },
        ] as { field:keyof typeof form; label:string }[]).map(({field,label}) => <label key={field} className="flex cursor-pointer items-center gap-2.5"><input type="checkbox" className="h-4 w-4 rounded" style={{accentColor:'#002050'}} checked={form[field] as boolean} onChange={e=>set(field,e.target.checked)}/><span className="text-sm text-gray-700">{label}</span></label>)}</div>}

        <button type="submit" disabled={loading} className="w-full rounded-lg py-3 font-semibold text-white md:col-span-2" style={{backgroundColor:loading?'#9CA3AF':'#002050'}}>{loading ? 'Envoi en cours...' : addingToExistingAccount ? 'Transmettre ma candidature Professeur' : 'Soumettre ma candidature'}</button>
        <p className="text-center text-sm text-gray-500 md:col-span-2"><Link to="/inscription?mode=add-role" className="font-semibold text-[#BF8813]">← {addingToExistingAccount ? 'Mes espaces' : 'Changer de profil'}</Link></p>
      </form>
    </AuthLayout>
  );
}
