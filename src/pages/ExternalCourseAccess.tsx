import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock3, Copy, ExternalLink, GraduationCap, Loader2, LockKeyhole, LogIn, ShieldCheck } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { edgeAuthHeaders } from '../lib/edgeAuth';
import { useLanguage } from '../i18n/LanguageContext';

const API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/catalogue-list`;
const COMMERCE_API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/external-course-commerce`;
const BLUE = '#002050';
const GOLD = '#BF8813';

type ExternalCourse = {
  id: string;
  title: string;
  short_description?: string | null;
  provider_name: string;
  external_url?: string;
  registration_url?: string;
  cover_image_url?: string | null;
  category?: string | null;
  level?: string | null;
  language?: string;
  duration_label?: string | null;
  certificate_available?: boolean;
  access_mode: 'public' | 'registered' | 'premium' | 'paid';
  price_xof?: number;
  registration_deadline?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  contact_address?: string | null;
  delivery_methods?: string[];
};

type PaidAccess = {
  status: 'access_ready';
  delivery_methods: string[];
  private_access_url?: string | null;
  access_code?: string | null;
  ready_at?: string | null;
};

type ViewState = 'loading' | 'ready' | 'auth' | 'premium' | 'payment' | 'payment_pending' | 'registration' | 'closed' | 'revoked' | 'error';

function xof(value: number | undefined) {
  return `${new Intl.NumberFormat('fr-FR').format(Number(value || 0))} FCFA`;
}

export default function ExternalCourseAccess() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useLanguage();
  const [course, setCourse] = useState<ExternalCourse | null>(null);
  const [access, setAccess] = useState<PaidAccess | null>(null);
  const [state, setState] = useState<ViewState>('loading');
  const [message, setMessage] = useState('');
  const [paying, setPaying] = useState(false);

  const loadAccess = useCallback(async () => {
    const response = await fetch(`${API}?mode=external_access&id=${encodeURIComponent(id)}`, { headers: edgeAuthHeaders() });
    const data = await response.json().catch(() => ({}));
    setCourse(data.course || null);
    setAccess(data.access || null);
    if (response.ok && data.allowed) setState('ready');
    else if (response.ok && data.access_state === 'registration_in_progress') setState('registration');
    else if (response.status === 401 || data.error === 'AUTH_REQUIRED') setState('auth');
    else if (data.error === 'PREMIUM_REQUIRED') setState('premium');
    else if (data.error === 'PAYMENT_REQUIRED') setState('payment');
    else if (data.error === 'REGISTRATION_CLOSED') setState('closed');
    else if (data.error === 'ACCESS_REVOKED') setState('revoked');
    else { setState('error'); setMessage(data.message || data.error || t('Une erreur est survenue.', 'An error occurred.')); }
  }, [id, t]);

  useEffect(() => {
    let active = true;
    async function run() {
      setState('loading');
      try {
        if (searchParams.get('payment') === 'return') {
          const statusResponse = await fetch(COMMERCE_API, {
            method: 'POST', headers: edgeAuthHeaders(), body: JSON.stringify({ action: 'status', external_course_id: id }),
          });
          const statusData = await statusResponse.json().catch(() => ({}));
          if (!active) return;
          if (statusResponse.ok && statusData.access?.status === 'registration_in_progress') setState('registration');
          else if (statusResponse.ok && statusData.access?.status === 'access_ready') setState('ready');
          else setState('payment_pending');
        }
        if (active) await loadAccess();
      } catch (error) {
        if (active) { setState('error'); setMessage(error instanceof Error ? error.message : t('Une erreur est survenue.', 'An error occurred.')); }
      }
    }
    void run();
    return () => { active = false; };
  }, [id, loadAccess, searchParams, t]);

  async function startPayment() {
    setPaying(true); setMessage('');
    try {
      const response = await fetch(COMMERCE_API, {
        method: 'POST',
        headers: { ...edgeAuthHeaders(), 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ action: 'start_payment', external_course_id: id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || data.error || 'PAYMENT_INIT_FAILED');
      if (data.already_paid) { await loadAccess(); return; }
      if (!data.payment_url) throw new Error('PAYMENT_LINK_MISSING');
      window.location.assign(String(data.payment_url));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('Paiement impossible.', 'Payment unavailable.'));
    } finally { setPaying(false); }
  }

  async function copyCode() {
    if (!access?.access_code) return;
    await navigator.clipboard.writeText(access.access_code).catch(() => undefined);
  }

  const accessLabel = course?.access_mode === 'public'
    ? t('Accès public', 'Public access')
    : course?.access_mode === 'registered'
    ? t('Après inscription', 'After registration')
    : course?.access_mode === 'premium'
    ? t('Accès Premium', 'Premium access')
    : t('Paiement sur Omnia', 'Payment on Omnia');
  const paidAccessUrl = access?.private_access_url || course?.registration_url || course?.external_url;

  return <div className="min-h-screen bg-[#F8FAFC]">
    <Navbar />
    <main className="mx-auto max-w-5xl px-5 pb-16 pt-24 sm:px-6">
      <button type="button" onClick={() => navigate('/catalogue')} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold" style={{ color: BLUE }}><ArrowLeft size={16}/>{t('Retour au catalogue', 'Back to catalogue')}</button>
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="grid md:grid-cols-[1.05fr_.95fr]">
          <div className="flex min-h-[300px] items-center justify-center bg-slate-100">{course?.cover_image_url ? <img src={course.cover_image_url} alt="" className="h-full w-full object-cover"/> : <GraduationCap size={68} style={{ color: GOLD }}/>}</div>
          <div className="p-7 sm:p-10">
            <div className="flex flex-wrap gap-2"><span className="rounded-full bg-[#FFF8E8] px-3 py-1 text-xs font-bold text-[#8A5F09]">{t('Formation externe', 'External course')}</span>{course && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{accessLabel}</span>}</div>
            <h1 data-no-auto-translate="true" className="mt-5 text-2xl font-black sm:text-3xl" style={{ color: BLUE }}>{course?.title || t('Accès à la formation', 'Course access')}</h1>
            {course?.provider_name && <p className="mt-2 text-sm font-semibold text-slate-600">{t('Source :', 'Source:')} <span data-no-auto-translate="true">{course.provider_name}</span></p>}
            {course?.short_description && <p data-no-auto-translate="true" className="mt-5 text-sm leading-7 text-slate-600">{course.short_description}</p>}
            <div data-no-auto-translate="true" className="mt-5 flex flex-wrap gap-2 text-xs text-slate-500">{course?.category && <span>{course.category}</span>}{course?.level && <span>· {course.level}</span>}{course?.duration_label && <span>· {course.duration_label}</span>}{course?.certificate_available && <span>· {t('Certificat disponible', 'Certificate available')}</span>}</div>
            {course?.registration_deadline && <p className="mt-4 flex items-center gap-2 text-xs text-slate-500"><Clock3 size={14}/>Date limite d’inscription : {new Date(`${course.registration_deadline}T12:00:00`).toLocaleDateString('fr-FR')}</p>}
            {(course?.contact_name || course?.contact_email || course?.contact_phone || course?.contact_address) && <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-600"><p className="font-bold" style={{ color: BLUE }}>Contact de la formation</p>{course.contact_name && <p>{course.contact_name}</p>}{course.contact_email && <p><a className="hover:underline" href={`mailto:${course.contact_email}`}>{course.contact_email}</a></p>}{course.contact_phone && <p><a className="hover:underline" href={`tel:${course.contact_phone}`}>{course.contact_phone}</a></p>}{course.contact_address && <p>{course.contact_address}</p>}</div>}
            {course?.access_mode !== 'paid' && course?.registration_url && <a href={course.registration_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-bold" style={{ color: GOLD }}>Lien d’inscription <ExternalLink size={13}/></a>}

            {state === 'loading' && <p className="mt-8 text-sm text-slate-500">{t('Chargement…', 'Loading…')}</p>}
            {state === 'ready' && course?.access_mode !== 'paid' && course?.external_url && <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><div className="flex gap-3"><ShieldCheck className="mt-0.5 text-emerald-700"/><p className="text-sm leading-6 text-emerald-900">{t('Vous allez être redirigé vers le site du fournisseur.', "You will be redirected to the provider's website.")}</p></div><a href={course.external_url} target="_blank" rel="noopener noreferrer" onClick={() => { void fetch(`${API}?mode=external_access&id=${encodeURIComponent(id)}&track=1`, { headers: edgeAuthHeaders(), keepalive: true }); }} className="mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white" style={{ background: BLUE }}>{t('Accéder à la formation', 'Access course')}<ExternalLink size={16}/></a></div>}
            {state === 'ready' && course?.access_mode === 'paid' && <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><div className="flex gap-3"><CheckCircle2 className="mt-0.5 text-emerald-700"/><div><p className="font-semibold text-emerald-900">Accès prêt</p><p className="mt-1 text-sm leading-6 text-emerald-800">Votre paiement Omnia est validé et l’accès attribué à votre compte.</p></div></div>{access?.access_code && <div className="mt-4 rounded-xl border border-emerald-200 bg-white p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Code d’accès</p><div className="mt-1 flex items-center justify-between gap-3"><code className="break-all text-sm font-bold" style={{ color: BLUE }}>{access.access_code}</code><button type="button" onClick={() => void copyCode()} className="rounded-lg border p-2" aria-label="Copier le code"><Copy size={15}/></button></div></div>}{paidAccessUrl && <a href={paidAccessUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white" style={{ background: BLUE }}>Accéder à la formation<ExternalLink size={16}/></a>}</div>}
            {state === 'payment' && <div className="mt-8 rounded-2xl border border-[#E5C780] bg-[#FFF8E8] p-5"><p className="text-sm font-semibold text-[#6F4C08]">Formation externe payante</p><p className="mt-2 text-2xl font-black" style={{ color: BLUE }}>{xof(course?.price_xof)}</p><p className="mt-2 text-sm leading-6 text-[#6F4C08]">Le paiement est effectué sur Omnia. Après validation, votre accès externe est attribué individuellement selon le mode prévu par cette formation.</p><button type="button" disabled={paying} onClick={() => void startPayment()} className="mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white disabled:opacity-60" style={{ background: GOLD }}>{paying ? <Loader2 size={16} className="animate-spin"/> : <ShieldCheck size={16}/>}Payer sur Omnia</button>{message && <p className="mt-3 text-xs text-red-700">{message}</p>}</div>}
            {state === 'payment_pending' && <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="flex gap-3"><Loader2 className="mt-0.5 animate-spin text-amber-700"/><div><p className="font-semibold text-amber-900">Validation du paiement en cours</p><p className="mt-1 text-sm leading-6 text-amber-800">Actualisez l’accès après la confirmation FedaPay.</p></div></div><button type="button" onClick={() => void loadAccess()} className="mt-4 rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{ background: BLUE }}>Actualiser l’accès</button></div>}
            {state === 'registration' && <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="flex gap-3"><Clock3 className="mt-0.5 text-amber-700"/><div><p className="font-semibold text-amber-900">Inscription en cours</p><p className="mt-1 text-sm leading-6 text-amber-800">Votre paiement est validé. Omnia finalise maintenant votre accès individuel auprès du fournisseur.</p></div></div></div>}
            {state === 'auth' && <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="flex gap-3"><LogIn className="mt-0.5 text-amber-700"/><p className="text-sm leading-6 text-amber-900">{t('Votre compte est requis pour accéder à cette formation.', 'Your account is required to access this course.')}</p></div><Link to={`/connexion?redirect=${encodeURIComponent(`/formation-externe/${id}`)}`} className="mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white" style={{ background: BLUE }}>{t('Se connecter', 'Sign in')}</Link></div>}
            {state === 'premium' && <div className="mt-8 rounded-2xl border border-[#E5C780] bg-[#FFF8E8] p-5"><div className="flex gap-3"><LockKeyhole className="mt-0.5 text-[#8A5F09]"/><p className="text-sm leading-6 text-[#6F4C08]">{t('Une offre Premium active est requise pour accéder à cette formation.', 'An active Premium plan is required to access this course.')}</p></div><Link to="/dashboard/abonnements" className="mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white" style={{ background: GOLD }}>{t('Voir les offres Premium', 'View Premium plans')}</Link></div>}
            {state === 'closed' && <p className="mt-8 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">La date limite d’inscription à cette formation est dépassée.</p>}
            {state === 'revoked' && <p className="mt-8 rounded-xl bg-red-50 p-4 text-sm text-red-700">Cet accès n’est plus actif. Contactez l’Administration Omnia si nécessaire.</p>}
            {state === 'error' && <p className="mt-8 rounded-xl bg-red-50 p-4 text-sm text-red-700">{message}</p>}
          </div>
        </div>
      </section>
    </main>
  </div>;
}
