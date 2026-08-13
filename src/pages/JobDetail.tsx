import { openExternalUrl } from '../lib/mobile';
import { getSessionToken } from '../lib/session';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import CareerPublicLayout from '../components/career/CareerPublicLayout';
import { PageFooter } from '../components/PageFooter';
import { ENDPOINTS } from '../lib/config';
import { COUNTRIES as COUNTRY_OPTIONS } from '../lib/countries';
import { edgeAuthHeaders, edgeGatewayHeaders } from '../lib/edgeAuth';
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle,
  ExternalLink,
  FileText,
  Mail,
  MapPin,
  Phone,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import {
  APPLICATION_MODE_HELP,
  APPLICATION_MODE_LABELS,
  APPLICATION_MODE_SHORT_LABELS,
  JobApplicationMode,
  normalizeApplicationMode,
} from '../lib/jobApplicationModes';

const OMNIA_BLUE = '#002050';
const OMNIA_GOLD = '#bf8813';

const COUNTRIES = COUNTRY_OPTIONS.map(country => ({ code: country.code, name: country.label }));

interface Job {
  id: string;
  title: string;
  description: string;
  location: string;
  contract_type: string;
  category: string;
  salary_range: string | null;
  required_level: string | null;
  skills_required: string[] | null;
  recruiter_company: string;
  recruiter_name: string;
  recruiter_email?: string | null;
  recruiter_phone?: string | null;
  recruiter_address?: string | null;
  views_count: number;
  applications_count: number;
  deadline: string | null;
  created_at: string;
  is_external_recruiter: boolean;
  status: string;
  country_code?: string;
  application_mode?: JobApplicationMode | string | null;
  external_apply_url?: string | null;
  external_apply_email?: string | null;
  application_instructions?: string | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function isLearner() {
  try {
    const user = JSON.parse(localStorage.getItem('omnia_user') || '{}');
    const roles: string[] = user.roles || [];
    return roles.includes('apprenant') || roles.includes('student') || roles.includes('learner');
  } catch {
    return false;
  }
}

export default function JobDetail() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showApply, setShowApply] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [cvUrl, setCvUrl] = useState('');
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState('');
  const [applied, setApplied] = useState(false);

  const isLoggedIn = !!getSessionToken();
  const userData = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('omnia_user') || '{}'); } catch { return {}; }
  }, []);

  useEffect(() => {
    if (!jobId) return;
    fetch(`${ENDPOINTS.jobsList}?job_id=${jobId}`, { headers: edgeGatewayHeaders(), cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        const loadedJob = d.job || (d.id ? d : null);
        if (loadedJob) setJob(loadedJob);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));

    if (userData?.cv_url) setCvUrl(userData.cv_url);
  }, [jobId, userData?.cv_url]);

  const mode = normalizeApplicationMode(job?.application_mode);
  const isExpired = !!job?.deadline && new Date(job.deadline) < new Date();
  const countryName = job?.country_code ? (COUNTRIES.find((c) => c.code === job.country_code)?.name || job.country_code) : null;

  function prepareWithCareer() {
    if (!jobId) return;
    if (!isLoggedIn) {
      navigate(`/connexion?redirect=${encodeURIComponent(`/omnia-career/candidatures?job_id=${jobId}&mode=prepare`)}`);
      return;
    }
    if (!isLearner()) {
      alert('Omnia Career est réservé aux apprenants.');
      return;
    }
    navigate(`/omnia-career/candidatures?job_id=${jobId}&mode=prepare`);
  }

  async function submitApplication() {
    if (!job || !jobId) return;
    if (mode === 'omnia_managed') {
      if (!coverLetter.trim()) { setApplyError('La lettre de motivation est requise.'); return; }
      if (coverLetter.length < 50) { setApplyError('Lettre trop courte (min 50 caractères).'); return; }
    }
    setApplying(true); setApplyError('');
    try {
      const res = await fetch(ENDPOINTS.jobApply, {
        method: 'POST',
        headers: edgeAuthHeaders(),
        body: JSON.stringify({ job_id: jobId, cover_letter: coverLetter, cv_url: cvUrl || null }),
      });
      const d = await res.json();
      if (d.success) {
        setApplied(true);
        setShowApply(false);
        if (mode === 'external_link' && d.external_url) void openExternalUrl(d.external_url);
        if (mode === 'external_email' && d.external_email) {
          const subject = encodeURIComponent(`Candidature — ${job.title}`);
          const body = encodeURIComponent(coverLetter || `Bonjour,\n\nJe vous adresse ma candidature pour le poste ${job.title}.\n\nCordialement,`);
          window.location.href = `mailto:${d.external_email}?subject=${subject}&body=${body}`;
        }
      } else if (d.error === 'ALREADY_APPLIED') {
        setApplyError('Vous avez déjà postulé ou préparé une candidature pour cette offre.');
      } else if (d.error === 'DEADLINE_PASSED') {
        setApplyError('La date limite de candidature est dépassée.');
      } else {
        setApplyError(d.error || 'Erreur lors de la soumission.');
      }
    } catch {
      setApplyError('Erreur réseau.');
    }
    setApplying(false);
  }

  if (loading) {
    return (
      <CareerPublicLayout>
        <div className="flex min-h-[70vh] items-center justify-center bg-white">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: OMNIA_BLUE, borderTopColor: 'transparent' }} />
        </div>
      </CareerPublicLayout>
    );
  }

  if (notFound || !job) {
    return (
      <CareerPublicLayout>
        <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 bg-white p-8">
          <p className="text-lg text-slate-500">Offre introuvable ou expirée.</p>
          <Link to="/forum/emploi" className="text-sm font-bold underline" style={{ color: OMNIA_BLUE }}>Retour aux offres</Link>
        </div>
      </CareerPublicLayout>
    );
  }

  return (
    <CareerPublicLayout>
      <div className="min-h-screen bg-white">
      <div className="mx-auto w-full max-w-6xl px-4 pb-12 pt-8 md:px-8">
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-5">
          <Link to="/forum" className="hover:text-slate-600">Omnia Communauté</Link>
          <span>›</span>
          <Link to="/forum/emploi" className="hover:text-slate-600">Carrière & emploi</Link>
          <span>›</span>
          <span className="truncate max-w-48" style={{ color: OMNIA_BLUE }}>{job.title}</span>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(0,32,80,0.08)' }}>
                  <Building2 className="w-7 h-7" style={{ color: OMNIA_BLUE }} />
                </div>
                <div>
                  <h1 className="text-xl font-bold mb-1" style={{ color: OMNIA_BLUE }}>{job.title}</h1>
                  <p className="text-base font-semibold text-gray-600">{job.recruiter_company || 'Entreprise'}</p>
                  <div className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: 'rgba(191,136,19,0.12)', color: OMNIA_GOLD }}>
                    {APPLICATION_MODE_SHORT_LABELS[mode]}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {job.contract_type && <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-semibold" style={{ backgroundColor: 'rgba(0,32,80,0.08)', color: OMNIA_BLUE }}>{job.contract_type}</span>}
                {job.location && <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-gray-100 text-gray-600"><MapPin className="w-3.5 h-3.5" />{job.location}</span>}
                {job.category && <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-gray-100 text-gray-600">{job.category}</span>}
                {job.salary_range && <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium" style={{ backgroundColor: '#E4F1EA', color: '#1E7A52' }}>{job.salary_range}</span>}
              </div>

              {job.deadline && (
                <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${isExpired ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>
                  <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                  {isExpired ? `Offre expirée le ${formatDate(job.deadline)}` : `Date limite : ${formatDate(job.deadline)}`}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h2 className="font-bold mb-4" style={{ color: OMNIA_BLUE }}>Description du poste</h2>
              <div className="prose prose-sm max-w-none text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{job.description}</div>
            </div>

            {job.skills_required && job.skills_required.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <h2 className="font-bold mb-4" style={{ color: OMNIA_BLUE }}>Compétences requises</h2>
                <div className="flex flex-wrap gap-2">
                  {job.skills_required.map((s, i) => <span key={i} className="px-3 py-1.5 rounded-full text-sm font-medium" style={{ backgroundColor: '#FEF9EE', color: '#92660A' }}>{s}</span>)}
                </div>
              </div>
            )}

            {(job.is_external_recruiter || job.recruiter_phone || job.recruiter_address) && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <h2 className="font-bold mb-4" style={{ color: OMNIA_BLUE }}>Contact de l’offre externe</h2>
                <div className="space-y-3 text-sm text-gray-600">
                  {job.recruiter_name && <p className="font-semibold text-gray-800">{job.recruiter_name}</p>}
                  {job.recruiter_email && <a className="flex items-center gap-2 hover:underline" href={`mailto:${job.recruiter_email}`}><Mail className="h-4 w-4" />{job.recruiter_email}</a>}
                  {job.recruiter_phone && <a className="flex items-center gap-2 hover:underline" href={`tel:${job.recruiter_phone}`}><Phone className="h-4 w-4" />{job.recruiter_phone}</a>}
                  {job.recruiter_address && <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{job.recruiter_address}</p>}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="sticky top-24 rounded-2xl border border-gray-100 bg-white p-5">
              {applied ? (
                <div className="text-center">
                  <CheckCircle className="w-10 h-10 mx-auto mb-3" style={{ color: '#1E7A52' }} />
                  <p className="font-semibold text-gray-800 mb-1">Candidature enregistrée</p>
                  <p className="text-xs text-gray-400">Suivez son statut dans Omnia Career.</p>
                </div>
              ) : isExpired ? (
                <div className="text-center">
                  <AlertCircle className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                  <p className="font-medium text-gray-500 text-sm">Cette offre est expirée</p>
                </div>
              ) : !isLoggedIn ? (
                <>
                  <p className="text-sm text-gray-500 mb-4 text-center">Connectez-vous pour préparer ou suivre cette candidature.</p>
                  <Link to="/connexion" className="block text-center py-3 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: OMNIA_BLUE }}>Se connecter</Link>
                </>
              ) : (
                <>
                  <button onClick={prepareWithCareer} className="w-full py-3 rounded-xl text-sm font-bold text-white mb-3 transition-opacity hover:opacity-90" style={{ backgroundColor: OMNIA_GOLD }}>
                    <Sparkles className="mr-2 inline h-4 w-4" />Préparer avec Omnia Career
                  </button>
                  {mode === 'omnia_managed' ? (
                    <button onClick={() => setShowApply(true)} className="w-full py-3 rounded-xl text-sm font-bold text-white mb-3 transition-opacity hover:opacity-90" style={{ backgroundColor: OMNIA_BLUE }}>
                      Postuler sur Omnia
                    </button>
                  ) : mode === 'external_link' ? (
                    <button onClick={submitApplication} disabled={applying} className="w-full py-3 rounded-xl text-sm font-bold text-white mb-3 disabled:opacity-60" style={{ backgroundColor: OMNIA_BLUE }}>
                      <ExternalLink className="mr-2 inline h-4 w-4" />{applying ? 'Ouverture…' : 'Ouvrir le lien externe'}
                    </button>
                  ) : (
                    <button onClick={() => setShowApply(true)} className="w-full py-3 rounded-xl text-sm font-bold text-white mb-3" style={{ backgroundColor: OMNIA_BLUE }}>
                      <Mail className="mr-2 inline h-4 w-4" />Préparer l’email
                    </button>
                  )}
                  <p className="text-xs text-gray-400 text-center">{job.applications_count} candidature{job.applications_count !== 1 ? 's' : ''}</p>
                </>
              )}
            </div>

            <div className="rounded-2xl border p-5" style={{ background: 'rgba(0,32,80,0.03)', borderColor: 'rgba(0,32,80,0.10)' }}>
              <h3 className="font-semibold text-sm mb-2" style={{ color: OMNIA_BLUE }}>{APPLICATION_MODE_LABELS[mode]}</h3>
              <p className="text-xs leading-5 text-gray-500">{APPLICATION_MODE_HELP[mode]}</p>
              {job.application_instructions && <p className="mt-3 text-xs leading-5 text-gray-600">{job.application_instructions}</p>}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
              <h3 className="font-semibold text-sm" style={{ color: OMNIA_BLUE }}>Informations</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-gray-400">Publié le</span><span className="font-medium text-gray-700">{formatDate(job.created_at)}</span></div>
                {job.required_level && <div className="flex justify-between"><span className="text-gray-400">Niveau requis</span><span className="font-medium text-gray-700">{job.required_level}</span></div>}
                {countryName && <div className="flex justify-between"><span className="text-gray-400">Pays</span><span className="font-medium text-gray-700">{countryName}</span></div>}
                <div className="flex justify-between"><span className="text-gray-400">Vues</span><span className="font-medium text-gray-700">{job.views_count}</span></div>
              </div>
            </div>

            <div className="rounded-2xl p-5 border border-amber-200" style={{ backgroundColor: '#FEF9EE' }}>
              <FileText className="w-6 h-6 mb-2" style={{ color: OMNIA_GOLD }} />
              <p className="text-sm font-semibold mb-1" style={{ color: '#92660A' }}>Documents prêts ?</p>
              <p className="text-xs text-amber-700 mb-3">Créez ou adaptez votre CV et votre lettre depuis Omnia Career.</p>
              <button onClick={prepareWithCareer} className="block w-full text-center py-2 rounded-lg text-xs font-semibold" style={{ backgroundColor: OMNIA_GOLD, color: 'white' }}>Préparer ma candidature →</button>
            </div>
          </div>
        </div>
      </div>

      <PageFooter />

      {showApply && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-gray-900">{mode === 'external_email' ? 'Préparer l’email' : 'Postuler'}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{job.title} — {job.recruiter_company}</p>
              </div>
              <button onClick={() => setShowApply(false)} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-4 h-4 text-gray-500" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">Lettre / message <span className="text-gray-400">({coverLetter.length}/2000)</span></label>
                <textarea value={coverLetter} onChange={(e) => setCoverLetter(e.target.value.slice(0, 2000))} rows={7} placeholder="Présentez-vous et expliquez pourquoi vous êtes le candidat idéal pour ce poste..." className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-gray-400" />
              </div>
              {mode === 'omnia_managed' && (
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1.5">Lien vers votre CV <span className="text-gray-400">(optionnel)</span></label>
                  <input value={cvUrl} onChange={(e) => setCvUrl(e.target.value)} placeholder="https://... (lien PDF, Google Drive, etc.)" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400" />
                  <p className="text-xs text-gray-400 mt-1">Utilisez Omnia Career pour générer un CV PDF et une lettre adaptés.</p>
                </div>
              )}
              {applyError && <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3 py-2.5 rounded-lg"><AlertCircle className="w-4 h-4 flex-shrink-0" />{applyError}</div>}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowApply(false)} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Annuler</button>
                <button onClick={submitApplication} disabled={applying} className="flex-1 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-60" style={{ backgroundColor: OMNIA_BLUE }}>
                  {applying ? 'En cours…' : mode === 'external_email' ? <><Send className="mr-2 inline h-4 w-4" />Ouvrir l’email</> : 'Envoyer ma candidature'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </CareerPublicLayout>
  );
}
