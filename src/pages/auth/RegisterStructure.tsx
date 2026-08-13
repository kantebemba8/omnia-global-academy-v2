import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Building2, ChevronRight, ChevronLeft, Info, CheckCircle } from 'lucide-react';
import { AuthLayout } from '../../components/AuthLayout';
import { COUNTRIES, getPrefix } from '../../lib/countries';
import { edgeGatewayHeaders } from '../../lib/edgeAuth';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const API = `${SUPABASE_URL}/functions/v1`;

// ── Types de structure ─────────────────────────────────────────────────────
const STRUCTURE_TYPES = [
  { value: 'ministere',                  label: 'Ministère',                       display: 'Espace Ministère' },
  { value: 'etablissement',             label: 'Établissement',                   display: 'Espace Établissement' },
  { value: 'universite',                label: 'Université',                      display: 'Espace Université' },
  { value: 'ecole',                     label: 'École',                           display: 'Espace École' },
  { value: 'centre_formation',          label: 'Centre de formation',             display: 'Espace Centre de formation' },
  { value: 'entreprise',               label: 'Entreprise',                      display: 'Espace Entreprise' },
  { value: 'ong',                       label: 'ONG',                             display: 'Espace ONG' },
  { value: 'association',              label: 'Association',                     display: 'Espace Association' },
  { value: 'institution_publique',     label: 'Institution publique',            display: 'Espace Institution publique' },
  { value: 'organisation_internationale', label: 'Organisation internationale',  display: 'Espace Organisation internationale' },
  { value: 'cabinet_formation',        label: 'Cabinet de formation',            display: 'Espace Cabinet de formation' },
  { value: 'autre',                    label: 'Autre structure professionnelle', display: 'Espace Structure professionnelle' },
];

// ── Styles communs ──────────────────────────────────────────────────────────
const inputCls = 'w-full px-4 py-3 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#002050]/20 focus:border-[#002050] transition-colors';
const labelCls = 'block text-sm font-medium text-gray-700 mb-1.5';

function getPasswordStrength(pwd: string) {
  if (!pwd) return { level: '', color: '#E4E7EC', width: '0%' };
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

export function RegisterStructure() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedType, setSelectedType] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [justifFile, setJustifFile] = useState<File | null>(null);
  const [registrationSessionToken, setRegistrationSessionToken] = useState('');
  const [registrationEmailSent, setRegistrationEmailSent] = useState<boolean | null>(null);

  const [form, setForm] = useState({
    // Structure
    name: '',
    country: '',
    city: '',
    address: '',
    professional_email: '',
    phone: '',
    phone_local: '',
    website: '',
    description: '',
    objective: '',
    // Responsable
    responsible_name: '',
    responsible_function: '',
    responsible_email: '',
    responsible_phone: '',
    responsible_phone_local: '',
    // Compte
    password: '',
    confirm_password: '',
    allow_email: true,
    allow_sms: false,
    subscribe_newsletter: false,
  });

  const set = (field: string, value: unknown) => setForm(f => ({ ...f, [field]: value }));

  const selectedTypeObj = STRUCTURE_TYPES.find(t => t.value === selectedType);

  // ── Étape 1 : choix du type ─────────────────────────────────────────────
  if (step === 1) {
    return (
      <AuthLayout
        title="Inscrire une Structure"
        subtitle="Choisissez le type de votre structure"
        variant="wide"
      >
        <div className="mt-2 space-y-2">
          {STRUCTURE_TYPES.map(type => (
            <button
              key={type.value}
              onClick={() => { setSelectedType(type.value); setStep(2); }}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all"
              style={{ borderColor: selectedType === type.value ? '#002050' : '#E5E7EB' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#BF8813')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = selectedType === type.value ? '#002050' : '#E5E7EB')}
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: '#F0F4FF' }}>
                <Building2 size={17} style={{ color: '#002050' }} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold" style={{ color: '#002050' }}>{type.label}</div>
                <div className="text-xs" style={{ color: '#9CA3AF' }}>{type.display}</div>
              </div>
              <ChevronRight size={16} style={{ color: '#BF8813' }} />
            </button>
          ))}
        </div>
        <p className="mt-5 text-center text-sm" style={{ color: '#6B7280' }}>
          <Link to="/inscription" className="font-semibold" style={{ color: '#BF8813' }}>← Changer de profil</Link>
        </p>
      </AuthLayout>
    );
  }

  // ── Étape 2 : formulaire complet ────────────────────────────────────────
  if (success) {
    return (
      <AuthLayout title={selectedTypeObj?.display ?? 'Espace Structure'} subtitle="">
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <CheckCircle size={56} style={{ color: '#1E7A52' }} />
          <h2 className="text-xl font-bold" style={{ color: '#002050' }}>Demande envoyée</h2>
          <p className="text-sm leading-relaxed" style={{ color: '#374151' }}>
            Votre adresse e-mail a été confirmée et votre demande a bien été reçue.<br />
            Elle est en attente de validation par notre équipe.<br />
            Vous serez notifié(e) par email dès qu’une décision sera disponible.
          </p>
          <button
            onClick={() => navigate('/connexion')}
            className="mt-4 px-6 py-3 rounded-lg font-semibold text-white text-sm"
            style={{ backgroundColor: '#002050' }}
          >
            Aller à la connexion
          </button>
        </div>
      </AuthLayout>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm_password) {
      setError('Les mots de passe ne correspondent pas'); return;
    }
    if (!form.country) {
      setError('Sélectionnez le pays de la Structure.'); return;
    }
    if (!logoFile) {
      setError('Veuillez téléverser le logo de votre structure'); return;
    }
    setError('');
    setLoading(true);

    try {
      let sessionToken = registrationSessionToken;
      let initialEmailSent = registrationEmailSent;

      // Le compte n'est créé qu'une seule fois. Si la création de la fiche
      // Structure échoue, le jeton temporaire permet de réessayer sans créer
      // un doublon d'utilisateur.
      if (!sessionToken) {
        const regRes = await fetch(`${API}/auth-register`, {
          method: 'POST',
          headers: edgeGatewayHeaders(),
          body: JSON.stringify({
            email: form.responsible_email,
            password: form.password,
            full_name: form.responsible_name,
            phone_number: `${getPrefix(form.country)}${form.responsible_phone_local}`,
            country_code: form.country,
            role: 'responsable_structure',
            allow_email: form.allow_email,
            allow_sms: form.allow_sms,
            subscribe_newsletter: form.subscribe_newsletter,
          }),
        });
        const regData = await regRes.json().catch(() => ({}));
        if (!regRes.ok || !regData.success || !regData.session_token) {
          throw new Error(regData.message ?? 'Erreur lors de la création du compte');
        }
        sessionToken = String(regData.session_token);
        initialEmailSent = regData.email_sent !== false;
        setRegistrationSessionToken(sessionToken);
        setRegistrationEmailSent(initialEmailSent);
      }

      const [logoBase64, justificatifBase64] = await Promise.all([
        toBase64(logoFile),
        justifFile ? toBase64(justifFile) : Promise.resolve(''),
      ]);

      // Les documents sont envoyés à l'Edge Function. Elle les contrôle puis
      // les téléverse avec le rôle serveur, sans exposer de droit d'écriture
      // Storage au navigateur.
      const structRes = await fetch(`${API}/structure-manage`, {
        method: 'POST',
        headers: edgeGatewayHeaders({ 'x-omnia-session-token': sessionToken }),
        body: JSON.stringify({
          action: 'create_structure',
          name: form.name,
          structure_type: selectedType,
          country: form.country,
          city: form.city,
          address: form.address,
          professional_email: form.professional_email,
          phone: `${getPrefix(form.country)}${form.phone_local}`,
          website: form.website,
          description: form.description,
          objective: form.objective,
          responsible_name: form.responsible_name,
          responsible_function: form.responsible_function,
          responsible_email: form.responsible_email,
          responsible_phone: `${getPrefix(form.country)}${form.responsible_phone_local}`,
          logo_base64: logoBase64,
          logo_mime: logoFile.type,
          logo_name: logoFile.name,
          justificatif_base64: justificatifBase64 || undefined,
          justificatif_mime: justifFile?.type || undefined,
          justificatif_name: justifFile?.name || undefined,
        }),
      });
      const structData = await structRes.json().catch(() => ({}));
      if (!structRes.ok || !structData.success) {
        if (structData.error === 'STRUCTURE_ALREADY_EXISTS') {
          setRegistrationSessionToken('');
          navigate('/verifier-otp', { state: { email: form.responsible_email.trim().toLowerCase(), purpose: 'inscription', initial_email_sent: initialEmailSent !== false } });
          return;
        }
        throw new Error(structData.message ?? structData.error ?? 'Erreur lors de la création de la structure');
      }

      setRegistrationSessionToken('');
      navigate('/verifier-otp', {
        state: { email: form.responsible_email.trim().toLowerCase(), purpose: 'inscription', initial_email_sent: initialEmailSent !== false },
      });
    } catch (err) {
      setError((err as Error).message ?? 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const pwdStrength = getPasswordStrength(form.password);

  return (
    <AuthLayout
      title={selectedTypeObj?.display ?? 'Espace Structure'}
      subtitle="Remplissez les informations de votre structure"
      variant="wide"
    >
      {/* Badge type sélectionné + bouton retour */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setStep(1)}
          className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg border transition-colors hover:bg-gray-50"
          style={{ borderColor: '#E4E7EC', color: '#6B7280' }}
        >
          <ChevronLeft size={13} /> Changer
        </button>
        <span className="text-xs font-semibold px-3 py-1 rounded-full"
          style={{ background: '#EEF2FF', color: '#002050' }}>
          {selectedTypeObj?.label}
        </span>
      </div>

      {/* Info validation */}
      <div className="flex items-start gap-2 p-3 rounded-lg mb-4"
        style={{ backgroundColor: '#FFF8E7', border: '1px solid #FDE68A' }}>
        <Info size={15} style={{ color: '#BF8813', flexShrink: 0, marginTop: 1 }} />
        <p className="text-xs" style={{ color: '#374151' }}>
          Votre demande sera examinée par l’équipe Omnia avant activation.
          La structure ne sera activée qu'après validation.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        {/* ── Section : Informations de la structure ── */}
        <div className="space-y-1 pb-1">
          <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: '#002050' }}>
            Informations de la structure
          </h3>
          <div className="h-0.5 rounded" style={{ background: '#EEF2FF' }} />
        </div>

        <div>
          <label className={labelCls}>Nom de la structure <span style={{ color: '#DC2626' }}>*</span></label>
          <input className={inputCls} type="text" required value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder={`Nom officiel de votre ${selectedTypeObj?.label?.toLowerCase() ?? 'structure'}`} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Pays <span style={{ color: '#DC2626' }}>*</span></label>
            <select className={inputCls} value={form.country}
              onChange={e => set('country', e.target.value)} required>
              <option value="">Choisir un pays</option>
              {COUNTRIES.map(c => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Ville</label>
            <input className={inputCls} type="text" value={form.city}
              onChange={e => set('city', e.target.value)} placeholder="ex: Votre ville" />
          </div>
        </div>

        <div>
          <label className={labelCls}>Adresse</label>
          <input className={inputCls} type="text" value={form.address}
            onChange={e => set('address', e.target.value)} placeholder="Adresse complète" />
        </div>

        <div>
          <label className={labelCls}>Email professionnel <span style={{ color: '#DC2626' }}>*</span></label>
          <input className={inputCls} type="email" required value={form.professional_email}
            onChange={e => set('professional_email', e.target.value)} />
        </div>

        <div>
          <label className={labelCls}>Téléphone de la structure</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select className="w-full px-3 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#002050] bg-white sm:w-[210px]"
              value={form.country} onChange={e => set('country', e.target.value)}>
              <option value="">Indicatif</option>
              {COUNTRIES.map(c => (
                <option key={c.code} value={c.code}>{getPrefix(c.code)} {c.label}</option>
              ))}
            </select>
            <input className={`${inputCls} flex-1`} type="tel" placeholder="Numéro sans indicatif"
              value={form.phone_local} onChange={e => set('phone_local', e.target.value)} />
          </div>
        </div>

        <div>
          <label className={labelCls}>Site web <span className="text-gray-400 font-normal">(optionnel)</span></label>
          <input className={inputCls} type="url" value={form.website}
            onChange={e => set('website', e.target.value)} placeholder="https://example.com" />
        </div>

        <div>
          <label className={labelCls}>Description de la structure <span style={{ color: '#DC2626' }}>*</span></label>
          <textarea className={`${inputCls} resize-none`} rows={3} required
            value={form.description} onChange={e => set('description', e.target.value)}
            placeholder="Décrivez votre structure en quelques phrases..." />
        </div>

        <div>
          <label className={labelCls}>Objectif de présence sur Omnia Global Academy <span style={{ color: '#DC2626' }}>*</span></label>
          <textarea className={`${inputCls} resize-none`} rows={3} required
            value={form.objective} onChange={e => set('objective', e.target.value)}
            placeholder="Pourquoi souhaitez-vous rejoindre la plateforme ?" />
        </div>

        {/* ── Section : Responsable de la structure ── */}
        <div className="space-y-1 pb-1 pt-2">
          <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: '#002050' }}>
            Responsable de la structure
          </h3>
          <div className="h-0.5 rounded" style={{ background: '#EEF2FF' }} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Nom complet <span style={{ color: '#DC2626' }}>*</span></label>
            <input className={inputCls} type="text" required value={form.responsible_name}
              onChange={e => set('responsible_name', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Fonction <span style={{ color: '#DC2626' }}>*</span></label>
            <input className={inputCls} type="text" required value={form.responsible_function}
              onChange={e => set('responsible_function', e.target.value)}
              placeholder="ex: Directeur, DRH..." />
          </div>
        </div>

        <div>
          <label className={labelCls}>Email du responsable <span style={{ color: '#DC2626' }}>*</span></label>
          <input className={inputCls} type="email" required value={form.responsible_email}
            onChange={e => set('responsible_email', e.target.value)} />
          <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
            Cet email sera utilisé pour vous connecter à votre Espace Structure.
          </p>
        </div>

        <div>
          <label className={labelCls}>Téléphone du responsable</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select className="w-full px-3 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#002050] bg-white sm:w-[210px]"
              value={form.country} onChange={e => set('country', e.target.value)}>
              <option value="">Indicatif</option>
              {COUNTRIES.map(c => (
                <option key={c.code} value={c.code}>{getPrefix(c.code)}</option>
              ))}
            </select>
            <input className={`${inputCls} flex-1`} type="tel" placeholder="Numéro sans indicatif"
              value={form.responsible_phone_local} onChange={e => set('responsible_phone_local', e.target.value)} />
          </div>
        </div>

        {/* ── Section : Documents ── */}
        <div className="space-y-1 pb-1 pt-2">
          <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: '#002050' }}>
            Documents
          </h3>
          <div className="h-0.5 rounded" style={{ background: '#EEF2FF' }} />
        </div>

        <div>
          <label className={labelCls}>
            Logo de la structure <span style={{ color: '#DC2626' }}>*</span>
            <span className="font-normal text-gray-400"> (PNG, JPG — max 2 MB)</span>
          </label>
          <input type="file" accept=".png,.jpg,.jpeg" required
            onChange={e => {
              const file = e.target.files?.[0];
              if (file && file.size > 2 * 1024 * 1024) {
                setError('Le logo ne doit pas dépasser 2 MB');
                e.target.value = ''; return;
              }
              setLogoFile(file || null);
            }}
            className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#002050] file:text-white hover:file:opacity-90 cursor-pointer" />
          <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
            Apparaîtra sur les certificats et dans votre espace
          </p>
        </div>

        <div>
          <label className={labelCls}>
            Document justificatif
            <span className="font-normal text-gray-400"> (PDF, JPG — max 5 MB)</span>
          </label>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file && file.size > 5 * 1024 * 1024) {
                setError('Le justificatif ne doit pas dépasser 5 MB');
                e.target.value = ''; return;
              }
              setJustifFile(file || null);
            }}
            className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#002050] file:text-white hover:file:opacity-90 cursor-pointer" />
          <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
            Registre de commerce, agrément, statuts ou tout document officiel
          </p>
        </div>

        {/* ── Section : Mot de passe ── */}
        <div className="space-y-1 pb-1 pt-2">
          <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: '#002050' }}>
            Mot de passe
          </h3>
          <div className="h-0.5 rounded" style={{ background: '#EEF2FF' }} />
        </div>

        <div>
          <label className={labelCls}>Mot de passe <span style={{ color: '#DC2626' }}>*</span></label>
          <div className="relative">
            <input className={inputCls} type={showPwd ? 'text' : 'password'}
              autoComplete="new-password" required minLength={8}
              value={form.password} onChange={e => set('password', e.target.value)} />
            <button type="button" className="absolute right-3 top-3.5 text-gray-400"
              onClick={() => setShowPwd(v => !v)}>
              {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {form.password && (
            <div className="mt-1.5">
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{ width: pwdStrength.width, backgroundColor: pwdStrength.color }} />
              </div>
              {pwdStrength.level && (
                <p className="text-xs mt-1 font-medium" style={{ color: pwdStrength.color }}>
                  Mot de passe {pwdStrength.level}
                </p>
              )}
            </div>
          )}
        </div>

        <div>
          <label className={labelCls}>Confirmer le mot de passe <span style={{ color: '#DC2626' }}>*</span></label>
          <input className={inputCls} type={showPwd ? 'text' : 'password'}
            autoComplete="new-password" required
            value={form.confirm_password} onChange={e => set('confirm_password', e.target.value)} />
          {form.confirm_password && form.confirm_password !== form.password && (
            <p className="text-xs mt-1" style={{ color: '#DC2626' }}>Les mots de passe ne correspondent pas</p>
          )}
        </div>

        {/* ── Consentements ── */}
        <div className="space-y-2 pt-1">
          {([
            { field: 'allow_email', label: 'Recevoir les actualités par email' },
            { field: 'allow_sms', label: 'Recevoir les alertes par SMS' },
            { field: 'subscribe_newsletter', label: "S'abonner à la newsletter" },
          ] as { field: keyof typeof form; label: string }[]).map(({ field, label }) => (
            <label key={field} className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded"
                style={{ accentColor: '#002050' }}
                checked={form[field] as boolean}
                onChange={e => set(field, e.target.checked)} />
              <span className="text-sm" style={{ color: '#374151' }}>{label}</span>
            </label>
          ))}
        </div>

        <button type="submit" disabled={loading}
          className="w-full py-3 rounded-lg font-semibold text-white transition-all"
          style={{ backgroundColor: loading ? '#9CA3AF' : '#002050' }}>
          {loading ? 'Envoi de la demande...' : 'Soumettre la demande'}
        </button>

        <p className="text-center text-sm" style={{ color: '#6B7280' }}>
          <Link to="/inscription" className="font-semibold" style={{ color: '#BF8813' }}>← Changer de profil</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
