import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Building2, ChevronRight, ChevronLeft, Check, AlertCircle } from 'lucide-react';
import { AuthLayout } from '../../components/AuthLayout';
import { COUNTRIES, getPrefix } from '../../lib/countries';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const inputCls = 'w-full px-4 py-3 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#002050]/20 focus:border-[#002050] transition-colors';
const labelCls = 'block text-sm font-medium text-gray-700 mb-1.5';

const ORG_TYPES = [
  { value: 'school', label: 'École / Lycée' },
  { value: 'university', label: 'Université' },
  { value: 'training_center', label: 'Centre de formation professionnelle' },
  { value: 'company', label: 'Entreprise' },
  { value: 'ngo', label: 'ONG / Association' },
  { value: 'government', label: 'Institution publique / Gouvernement' },
  { value: 'other', label: 'Autre' },
];

const MAIN_NEEDS = [
  'Accès Career Studio pour nos membres',
  'Formations en ligne pour nos étudiants/employés',
  'Certifications CPD pour nos collaborateurs',
  'Partenariat commercial',
  'Autre',
];

function getPasswordStrength(pwd: string) {
  if (!pwd) return { level: '', color: '#E4E7EC', width: '0%' };
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 2) return { level: 'Faible', color: '#DC2626', width: '33%' };
  if (score <= 3) return { level: 'Moyen', color: '#F59E0B', width: '66%' };
  return { level: 'Fort', color: '#1E7A52', width: '100%' };
}

export default function RegisterOrganisation() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Étape 1 : Compte gestionnaire principal
  const [account, setAccount] = useState({
    full_name: '',
    email: '',
    phone_local: '',
    country_code: 'ML',
    password: '',
    confirm_password: '',
    birth_date: '',
  });

  // Étape 2 : Informations de l'organisation
  const [org, setOrg] = useState({
    org_name: '',
    org_type: '',
    country: 'ML',
    city: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    description: '',
    main_need: '',
  });

  // Étape 3 : Contact & justificatif
  const [contact, setContact] = useState({
    contact_name: '',
    contact_function: '',
    contact_email: '',
    contact_phone: '',
  });

  const pwdStrength = getPasswordStrength(account.password);
  const prefix = getPrefix(account.country_code);

  function updateAccount(field: string, value: string) { setAccount(p => ({ ...p, [field]: value })); }
  function updateOrg(field: string, value: string) { setOrg(p => ({ ...p, [field]: value })); }
  function updateContact(field: string, value: string) { setContact(p => ({ ...p, [field]: value })); }

  function validateStep1() {
    if (!account.full_name.trim()) return 'Nom complet requis';
    if (!account.email.trim()) return 'Email requis';
    if (!account.phone_local.trim()) return 'Téléphone requis';
    if (!account.password) return 'Mot de passe requis';
    if (account.password.length < 8) return 'Mot de passe trop court (8 caractères min)';
    if (account.password !== account.confirm_password) return 'Les mots de passe ne correspondent pas';
    if (!account.birth_date) return 'Date de naissance requise';
    return '';
  }

  function validateStep2() {
    if (!org.org_name.trim()) return 'Nom de l\'organisation requis';
    if (!org.org_type) return 'Type d\'organisation requis';
    if (!org.country) return 'Pays requis';
    return '';
  }

  function validateStep3() {
    if (!contact.contact_name.trim()) return 'Nom du contact requis';
    if (!contact.contact_email.trim()) return 'Email du contact requis';
    return '';
  }

  async function handleSubmit() {
    const err3 = validateStep3();
    if (err3) { setError(err3); return; }

    setLoading(true);
    setError('');

    try {
      const phone = `${prefix}${account.phone_local.replace(/^0/, '')}`;

      // Étape 1 : Créer le compte utilisateur
      const registerRes = await fetch(`${SUPABASE_URL}/functions/v1/auth-register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: account.full_name.trim(),
          email: account.email.trim().toLowerCase(),
          phone_number: phone,
          password: account.password,
          birth_date: account.birth_date,
          country_code: account.country_code,
          role: 'gestionnaire_partenaire',
        }),
      });

      const registerData = await registerRes.json();
      if (!registerData.success) {
        setError(registerData.message || 'Erreur lors de la création du compte');
        setLoading(false);
        return;
      }

      // Étape 2 : Connexion pour obtenir le token
      const loginRes = await fetch(`${SUPABASE_URL}/functions/v1/auth-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: account.email.trim().toLowerCase(), password: account.password }),
      });
      const loginData = await loginRes.json();
      if (!loginData.success) {
        setError('Compte créé mais connexion échouée. Veuillez vous connecter manuellement.');
        setLoading(false);
        navigate('/connexion');
        return;
      }

      const sessionToken = loginData.session_token;
      localStorage.setItem('omnia_session_token', sessionToken);
      localStorage.setItem('omnia_user', JSON.stringify(loginData.user));

      // Étape 3 : Inscrire l'organisation
      const orgRes = await fetch(`${SUPABASE_URL}/functions/v1/partner-org-manage`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register',
          org_name: org.org_name.trim(),
          org_type: org.org_type,
          country: org.country,
          city: org.city.trim(),
          address: org.address.trim(),
          phone: org.phone.trim(),
          email: org.email.trim(),
          website: org.website.trim(),
          description: org.description.trim(),
          main_need: org.main_need,
          contact_name: contact.contact_name.trim(),
          contact_function: contact.contact_function.trim(),
          contact_email: contact.contact_email.trim(),
          contact_phone: contact.contact_phone.trim(),
        }),
      });

      const orgData = await orgRes.json();
      if (!orgData.success) {
        setError(orgData.message || 'Erreur lors de l\'inscription de l\'organisation');
        setLoading(false);
        return;
      }

      // Succès — rediriger vers le dashboard partenaire
      navigate('/partner/dashboard?welcome=1');

    } catch (err) {
      setError('Erreur réseau. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  }

  function nextStep() {
    setError('');
    if (step === 1) {
      const err = validateStep1();
      if (err) { setError(err); return; }
    }
    if (step === 2) {
      const err = validateStep2();
      if (err) { setError(err); return; }
    }
    setStep(s => s + 1);
  }

  const STEPS = ['Votre compte', 'Votre organisation', 'Contact & finalisation'];

  return (
    <AuthLayout>
      <div className="w-full max-w-lg mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: '#002050' }}>
            <Building2 size={26} style={{ color: '#BF8813' }} />
          </div>
          <h1 className="text-2xl font-black" style={{ color: '#002050' }}>Inscription organisation</h1>
          <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
            Rejoignez Omnia Global Academy comme organisation partenaire
          </p>
        </div>

        {/* Progress steps */}
        <div className="flex items-center mb-8">
          {STEPS.map((s, i) => {
            const n = i + 1;
            const done = n < step;
            const active = n === step;
            return (
              <div key={n} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all"
                    style={{
                      background: done ? '#1E7A52' : active ? '#002050' : '#E4E7EC',
                      color: done || active ? 'white' : '#9CA3AF',
                    }}>
                    {done ? <Check size={14} /> : n}
                  </div>
                  <span className="text-xs mt-1 text-center hidden md:block w-20"
                    style={{ color: active ? '#002050' : '#9CA3AF', fontWeight: active ? 600 : 400 }}>
                    {s}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="flex-1 h-0.5 mx-2 mb-4" style={{ background: done ? '#1E7A52' : '#E4E7EC' }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Erreur */}
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl mb-4" style={{ background: '#FEE2E2', border: '1px solid #FECACA' }}>
            <AlertCircle size={16} style={{ color: '#DC2626', flexShrink: 0, marginTop: 1 }} />
            <p className="text-sm" style={{ color: '#DC2626' }}>{error}</p>
          </div>
        )}

        {/* ── ÉTAPE 1 : Compte gestionnaire ─────────── */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl border mb-2" style={{ background: '#F0F9FF', borderColor: '#BAE6FD' }}>
              <p className="text-sm" style={{ color: '#0369A1' }}>
                Vous créez le compte du <strong>gestionnaire principal</strong> de l'organisation.
                Vous pourrez ajouter d'autres gestionnaires depuis votre dashboard.
              </p>
            </div>

            <div>
              <label className={labelCls}>Nom complet *</label>
              <input className={inputCls} value={account.full_name} onChange={e => updateAccount('full_name', e.target.value)} placeholder="Prénom Nom" />
            </div>
            <div>
              <label className={labelCls}>Email *</label>
              <input className={inputCls} type="email" value={account.email} onChange={e => updateAccount('email', e.target.value)} placeholder="contact@organisation.com" />
            </div>
            <div>
              <label className={labelCls}>Pays *</label>
              <select className={inputCls} value={account.country_code} onChange={e => updateAccount('country_code', e.target.value)}>
                {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Téléphone *</label>
              <div className="flex gap-2">
                <div className="px-3 py-3 border border-gray-200 rounded-lg text-sm font-mono bg-gray-50 flex-shrink-0" style={{ color: '#374151' }}>
                  {prefix}
                </div>
                <input className={`${inputCls} flex-1`} type="tel" value={account.phone_local} onChange={e => updateAccount('phone_local', e.target.value)} placeholder="70 00 00 00" />
              </div>
            </div>
            <div>
              <label className={labelCls}>Date de naissance *</label>
              <input className={inputCls} type="date" value={account.birth_date} onChange={e => updateAccount('birth_date', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Mot de passe *</label>
              <div className="relative">
                <input className={inputCls} type={showPassword ? 'text' : 'password'} value={account.password} onChange={e => updateAccount('password', e.target.value)} placeholder="8 caractères minimum" />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2">
                  {showPassword ? <EyeOff size={18} style={{ color: '#9CA3AF' }} /> : <Eye size={18} style={{ color: '#9CA3AF' }} />}
                </button>
              </div>
              {account.password && (
                <div className="mt-2">
                  <div className="h-1.5 rounded-full" style={{ background: '#E4E7EC' }}>
                    <div className="h-1.5 rounded-full transition-all" style={{ width: pwdStrength.width, background: pwdStrength.color }} />
                  </div>
                  <p className="text-xs mt-1" style={{ color: pwdStrength.color }}>Force : {pwdStrength.level}</p>
                </div>
              )}
            </div>
            <div>
              <label className={labelCls}>Confirmer le mot de passe *</label>
              <input className={inputCls} type="password" value={account.confirm_password} onChange={e => updateAccount('confirm_password', e.target.value)} placeholder="Retapez votre mot de passe" />
            </div>
          </div>
        )}

        {/* ── ÉTAPE 2 : Organisation ─────────────────── */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Nom de l'organisation *</label>
              <input className={inputCls} value={org.org_name} onChange={e => updateOrg('org_name', e.target.value)} placeholder="Ex: Université de Bamako, Société ABC..." />
            </div>
            <div>
              <label className={labelCls}>Type d'organisation *</label>
              <select className={inputCls} value={org.org_type} onChange={e => updateOrg('org_type', e.target.value)}>
                <option value="">Sélectionnez un type</option>
                {ORG_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Pays *</label>
                <select className={inputCls} value={org.country} onChange={e => updateOrg('country', e.target.value)}>
                  {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Ville</label>
                <input className={inputCls} value={org.city} onChange={e => updateOrg('city', e.target.value)} placeholder="Bamako" />
              </div>
            </div>
            <div>
              <label className={labelCls}>Adresse</label>
              <input className={inputCls} value={org.address} onChange={e => updateOrg('address', e.target.value)} placeholder="Rue, quartier..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Téléphone organisation</label>
                <input className={inputCls} value={org.phone} onChange={e => updateOrg('phone', e.target.value)} placeholder="+223 20 00 00 00" />
              </div>
              <div>
                <label className={labelCls}>Email organisation</label>
                <input className={inputCls} type="email" value={org.email} onChange={e => updateOrg('email', e.target.value)} placeholder="contact@org.com" />
              </div>
            </div>
            <div>
              <label className={labelCls}>Site web</label>
              <input className={inputCls} value={org.website} onChange={e => updateOrg('website', e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <label className={labelCls}>Description de l'organisation</label>
              <textarea className={inputCls} rows={3} value={org.description} onChange={e => updateOrg('description', e.target.value)} placeholder="Décrivez brièvement votre organisation..." style={{ resize: 'vertical' }} />
            </div>
            <div>
              <label className={labelCls}>Besoin principal</label>
              <select className={inputCls} value={org.main_need} onChange={e => updateOrg('main_need', e.target.value)}>
                <option value="">Sélectionnez votre besoin principal</option>
                {MAIN_NEEDS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* ── ÉTAPE 3 : Contact & finalisation ──────── */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl border mb-2" style={{ background: '#FFFBEB', borderColor: '#FDE68A' }}>
              <p className="text-sm" style={{ color: '#92400E' }}>
                Votre demande sera examinée par l'équipe Omnia Global Academy.
                Vous serez notifié par email après validation.
              </p>
            </div>

            <div>
              <label className={labelCls}>Nom du responsable de contact *</label>
              <input className={inputCls} value={contact.contact_name} onChange={e => updateContact('contact_name', e.target.value)} placeholder="Prénom Nom" />
            </div>
            <div>
              <label className={labelCls}>Fonction</label>
              <input className={inputCls} value={contact.contact_function} onChange={e => updateContact('contact_function', e.target.value)} placeholder="Ex: Directeur, DRH, Responsable formation..." />
            </div>
            <div>
              <label className={labelCls}>Email de contact *</label>
              <input className={inputCls} type="email" value={contact.contact_email} onChange={e => updateContact('contact_email', e.target.value)} placeholder="contact@organisation.com" />
            </div>
            <div>
              <label className={labelCls}>Téléphone de contact</label>
              <input className={inputCls} value={contact.contact_phone} onChange={e => updateContact('contact_phone', e.target.value)} placeholder="+223 70 00 00 00" />
            </div>

            {/* Récapitulatif */}
            <div className="p-4 rounded-xl border mt-4 space-y-2" style={{ borderColor: '#E4E7EC', background: '#F8F9FA' }}>
              <p className="font-bold text-sm mb-2" style={{ color: '#002050' }}>Récapitulatif</p>
              {[
                { label: 'Gestionnaire', value: account.full_name },
                { label: 'Email', value: account.email },
                { label: 'Organisation', value: org.org_name },
                { label: 'Type', value: ORG_TYPES.find(t => t.value === org.org_type)?.label || org.org_type },
                { label: 'Pays', value: org.country },
              ].map(({ label, value }) => value ? (
                <div key={label} className="flex justify-between text-sm">
                  <span style={{ color: '#9CA3AF' }}>{label}</span>
                  <span style={{ color: '#374151' }}>{value}</span>
                </div>
              ) : null)}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3 mt-8">
          {step > 1 && (
            <button onClick={() => { setStep(s => s - 1); setError(''); }}
              className="flex items-center gap-2 px-5 py-3 rounded-xl border font-semibold text-sm"
              style={{ borderColor: '#E4E7EC', color: '#374151' }}>
              <ChevronLeft size={16} /> Précédent
            </button>
          )}
          {step < 3 ? (
            <button onClick={nextStep}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm text-white"
              style={{ background: '#002050' }}>
              Suivant <ChevronRight size={16} />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm text-white disabled:opacity-50"
              style={{ background: '#1E7A52' }}>
              {loading ? '⏳ Inscription en cours...' : '✅ Soumettre ma demande'}
            </button>
          )}
        </div>

        {/* Lien connexion */}
        <p className="text-center text-sm mt-4" style={{ color: '#9CA3AF' }}>
          Déjà un compte ?{' '}
          <button onClick={() => navigate('/connexion')} className="font-semibold underline" style={{ color: '#002050' }}>
            Se connecter
          </button>
        </p>
      </div>
    </AuthLayout>
  );
}
