import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, GraduationCap, LockKeyhole, LogIn, ShieldCheck } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { edgeAuthHeaders } from '../lib/edgeAuth';
import { useLanguage } from '../i18n/LanguageContext';

const API = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/catalogue-list`;
const BLUE = '#002050';
const GOLD = '#BF8813';

type ExternalCourse = {
  id: string;
  title: string;
  short_description?: string | null;
  provider_name: string;
  external_url?: string;
  cover_image_url?: string | null;
  category?: string | null;
  level?: string | null;
  language?: string;
  duration_label?: string | null;
  certificate_available?: boolean;
  access_mode: 'public' | 'registered' | 'premium';
};

export default function ExternalCourseAccess() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [course, setCourse] = useState<ExternalCourse | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'auth' | 'premium' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    fetch(`${API}?mode=external_access&id=${encodeURIComponent(id)}`, { headers: edgeAuthHeaders() })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!active) return;
        setCourse(data.course || null);
        if (response.ok && data.allowed) setState('ready');
        else if (response.status === 401 || data.error === 'AUTH_REQUIRED') setState('auth');
        else if (response.status === 403 || data.error === 'PREMIUM_REQUIRED') setState('premium');
        else { setState('error'); setMessage(data.message || data.error || t('Une erreur est survenue.', 'An error occurred.')); }
      })
      .catch(error => { if (active) { setState('error'); setMessage(error instanceof Error ? error.message : t('Une erreur est survenue.', 'An error occurred.')); } });
    return () => { active = false; };
  }, [id, t]);

  const accessLabel = course?.access_mode === 'public'
    ? t('Accès public', 'Public access')
    : course?.access_mode === 'registered'
    ? t('Après inscription', 'After registration')
    : t('Accès Premium', 'Premium access');

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Navbar />
      <main className="mx-auto max-w-5xl px-5 pb-16 pt-24 sm:px-6">
        <button type="button" onClick={() => navigate('/catalogue')} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold" style={{ color: BLUE }}>
          <ArrowLeft size={16} />{t('Retour au catalogue', 'Back to catalogue')}
        </button>
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="grid md:grid-cols-[1.05fr_.95fr]">
            <div className="flex min-h-[300px] items-center justify-center bg-slate-100">
              {course?.cover_image_url
                ? <img src={course.cover_image_url} alt="" className="h-full w-full object-cover" />
                : <GraduationCap size={68} style={{ color: GOLD }} />}
            </div>
            <div className="p-7 sm:p-10">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-[#FFF8E8] px-3 py-1 text-xs font-bold text-[#8A5F09]">{t('Formation externe', 'External course')}</span>
                {course && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{accessLabel}</span>}
              </div>
              <h1 data-no-auto-translate="true" className="mt-5 text-2xl font-black sm:text-3xl" style={{ color: BLUE }}>{course?.title || t('Accès à la formation', 'Course access')}</h1>
              {course?.provider_name && <p className="mt-2 text-sm font-semibold text-slate-600">{t('Source :', 'Source:')} <span data-no-auto-translate="true">{course.provider_name}</span></p>}
              {course?.short_description && <p data-no-auto-translate="true" className="mt-5 text-sm leading-7 text-slate-600">{course.short_description}</p>}
              <div data-no-auto-translate="true" className="mt-5 flex flex-wrap gap-2 text-xs text-slate-500">
                {course?.category && <span>{course.category}</span>}
                {course?.level && <span>· {course.level}</span>}
                {course?.duration_label && <span>· {course.duration_label}</span>}
                {course?.certificate_available && <span>· {t('Certificat disponible', 'Certificate available')}</span>}
              </div>

              {state === 'loading' && <p className="mt-8 text-sm text-slate-500">{t('Chargement…', 'Loading…')}</p>}
              {state === 'ready' && course?.external_url && (
                <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                  <div className="flex gap-3"><ShieldCheck className="mt-0.5 text-emerald-700" /><p className="text-sm leading-6 text-emerald-900">{t('Vous allez être redirigé vers le site du fournisseur.', "You will be redirected to the provider's website.")}</p></div>
                  <a href={course.external_url} target="_blank" rel="noopener noreferrer" onClick={() => { void fetch(`${API}?mode=external_access&id=${encodeURIComponent(id)}&track=1`, { headers: edgeAuthHeaders(), keepalive: true }); }} className="mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white" style={{ background: BLUE }}>
                    {t('Accéder à la formation', 'Access course')}<ExternalLink size={16} />
                  </a>
                </div>
              )}
              {state === 'auth' && (
                <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                  <div className="flex gap-3"><LogIn className="mt-0.5 text-amber-700" /><p className="text-sm leading-6 text-amber-900">{t('Votre compte est requis pour accéder à cette formation.', 'Your account is required to access this course.')}</p></div>
                  <Link to={`/connexion?redirect=${encodeURIComponent(`/formation-externe/${id}`)}`} className="mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white" style={{ background: BLUE }}>{t('Se connecter', 'Sign in')}</Link>
                </div>
              )}
              {state === 'premium' && (
                <div className="mt-8 rounded-2xl border border-[#E5C780] bg-[#FFF8E8] p-5">
                  <div className="flex gap-3"><LockKeyhole className="mt-0.5 text-[#8A5F09]" /><p className="text-sm leading-6 text-[#6F4C08]">{t('Une offre Premium active est requise pour accéder à cette formation.', 'An active Premium plan is required to access this course.')}</p></div>
                  <Link to="/dashboard/abonnements" className="mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white" style={{ background: GOLD }}>{t('Voir les offres Premium', 'View Premium plans')}</Link>
                </div>
              )}
              {state === 'error' && <p className="mt-8 rounded-xl bg-red-50 p-4 text-sm text-red-700">{message}</p>}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
