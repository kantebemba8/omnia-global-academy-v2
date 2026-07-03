import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { PageFooter } from '../components/PageFooter';
import { ENDPOINTS } from '../lib/config';
import { MapPin, Clock, Calendar, Building2, Briefcase, ChevronLeft, ExternalLink, CheckCircle, AlertCircle, X, FileText, Upload } from 'lucide-react';

const COUNTRIES = [
  { code: 'ML', name: 'Mali' }, { code: 'SN', name: 'Sénégal' }, { code: 'CI', name: "Côte d'Ivoire" },
  { code: 'BF', name: 'Burkina Faso' }, { code: 'GN', name: 'Guinée' }, { code: 'TG', name: 'Togo' },
  { code: 'BJ', name: 'Bénin' }, { code: 'NE', name: 'Niger' }, { code: 'CM', name: 'Cameroun' },
  { code: 'GH', name: 'Ghana' }, { code: 'NG', name: 'Nigeria' }, { code: 'MA', name: 'Maroc' },
  { code: 'DZ', name: 'Algérie' }, { code: 'TN', name: 'Tunisie' }, { code: 'CD', name: 'RD Congo' },
];

interface Job {
  id: string; title: string; description: string; location: string; contract_type: string;
  category: string; salary_range: string | null; required_level: string | null;
  skills_required: string[] | null; recruiter_company: string; recruiter_name: string;
  views_count: number; applications_count: number; deadline: string | null;
  created_at: string; is_external_recruiter: boolean; status: string; country_code?: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
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

  const isLoggedIn = !!localStorage.getItem('omnia_session_token');
  const token = localStorage.getItem('omnia_session_token') || '';
  const userData = (() => { try { return JSON.parse(localStorage.getItem('omnia_user') || '{}'); } catch { return {}; } })();

  useEffect(() => {
    if (!jobId) return;
    fetch(`${ENDPOINTS.jobsList}?job_id=${jobId}`)
      .then(r => r.json())
      .then(d => {
        if (d.job) setJob(d.job);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));

    // Pre-fill CV URL from user profile if available
    if (userData?.cv_url) setCvUrl(userData.cv_url);
  }, [jobId]);

  async function submitApplication() {
    if (!coverLetter.trim()) { setApplyError('La lettre de motivation est requise.'); return; }
    if (coverLetter.length < 50) { setApplyError('Lettre trop courte (min 50 caractères).'); return; }
    setApplying(true); setApplyError('');
    try {
      const res = await fetch(ENDPOINTS.jobApply, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobId, cover_letter: coverLetter, cv_url: cvUrl || null }),
      });
      const d = await res.json();
      if (d.success) {
        setApplied(true);
        setShowApply(false);
      } else if (d.error === 'ALREADY_APPLIED') {
        setApplyError('Vous avez déjà postulé à cette offre.');
      } else if (d.error === 'DEADLINE_PASSED') {
        setApplyError("La date limite de candidature est dépassée.");
      } else {
        setApplyError(d.error || 'Erreur lors de la soumission.');
      }
    } catch { setApplyError('Erreur réseau.'); }
    setApplying(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F8F9FA' }}>
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
        </div>
        <PageFooter />
      </div>
    );
  }

  if (notFound || !job) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F8F9FA' }}>
        <Navbar />
        <div className="flex-1 flex items-center justify-center flex-col gap-4 p-8">
          <p className="text-gray-500 text-lg">Offre introuvable ou expirée.</p>
          <Link to="/emploi" className="text-sm underline" style={{ color: '#002050' }}>Retour aux offres</Link>
        </div>
        <PageFooter />
      </div>
    );
  }

  const isExpired = job.deadline && new Date(job.deadline) < new Date();
  const countryName = job.country_code ? (COUNTRIES.find(c => c.code === job.country_code)?.name || job.country_code) : null;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F8F9FA' }}>
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 py-6 w-full flex-1">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-5">
          <Link to="/forum" className="hover:text-gray-600">Forum</Link>
          <span>›</span>
          <Link to="/emploi" className="hover:text-gray-600">Emploi</Link>
          <span>›</span>
          <span className="truncate max-w-48" style={{ color: '#002050' }}>{job.title}</span>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-5">
            {/* Job header */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: '#EFF6FF' }}>
                  <Building2 className="w-7 h-7" style={{ color: '#002050' }} />
                </div>
                <div>
                  <h1 className="text-xl font-bold mb-1" style={{ color: '#002050' }}>{job.title}</h1>
                  <p className="text-base font-semibold text-gray-600">{job.recruiter_company}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-semibold"
                  style={{ backgroundColor: '#EFF6FF', color: '#002050' }}>
                  <Briefcase className="w-3.5 h-3.5" />{job.contract_type}
                </span>
                {job.location && (
                  <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-gray-100 text-gray-600">
                    <MapPin className="w-3.5 h-3.5" />{job.location}
                  </span>
                )}
                {job.category && (
                  <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-gray-100 text-gray-600">
                    {job.category}
                  </span>
                )}
                {job.salary_range && (
                  <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium"
                    style={{ backgroundColor: '#E4F1EA', color: '#1E7A52' }}>
                    {job.salary_range}
                  </span>
                )}
              </div>

              {job.deadline && (
                <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${isExpired ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>
                  <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                  {isExpired ? `Offre expirée le ${formatDate(job.deadline)}` : `Date limite : ${formatDate(job.deadline)}`}
                </div>
              )}
            </div>

            {/* Description */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h2 className="font-bold mb-4" style={{ color: '#002050' }}>Description du poste</h2>
              <div className="prose prose-sm max-w-none text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                {job.description}
              </div>
            </div>

            {/* Skills */}
            {job.skills_required && job.skills_required.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <h2 className="font-bold mb-4" style={{ color: '#002050' }}>Compétences requises</h2>
                <div className="flex flex-wrap gap-2">
                  {job.skills_required.map((s, i) => (
                    <span key={i} className="px-3 py-1.5 rounded-full text-sm font-medium"
                      style={{ backgroundColor: '#FEF9EE', color: '#92660A' }}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Apply CTA */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 sticky top-4">
              {applied ? (
                <div className="text-center">
                  <CheckCircle className="w-10 h-10 mx-auto mb-3" style={{ color: '#1E7A52' }} />
                  <p className="font-semibold text-gray-800 mb-1">Candidature envoyée !</p>
                  <p className="text-xs text-gray-400">Le recruteur examinera votre profil.</p>
                </div>
              ) : isExpired ? (
                <div className="text-center">
                  <AlertCircle className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                  <p className="font-medium text-gray-500 text-sm">Cette offre est expirée</p>
                </div>
              ) : !isLoggedIn ? (
                <>
                  <p className="text-sm text-gray-500 mb-4 text-center">Connectez-vous pour postuler à cette offre.</p>
                  <Link to="/connexion"
                    className="block text-center py-3 rounded-xl text-sm font-semibold text-white"
                    style={{ backgroundColor: '#002050' }}>
                    Se connecter
                  </Link>
                </>
              ) : (
                <>
                  <button onClick={() => setShowApply(true)}
                    className="w-full py-3 rounded-xl text-sm font-bold text-white mb-3 transition-opacity hover:opacity-90"
                    style={{ backgroundColor: '#002050' }}>
                    Postuler maintenant
                  </button>
                  <p className="text-xs text-gray-400 text-center">{job.applications_count} candidature{job.applications_count !== 1 ? 's' : ''}</p>
                </>
              )}
            </div>

            {/* Job info */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
              <h3 className="font-semibold text-sm" style={{ color: '#002050' }}>Informations</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Publié le</span>
                  <span className="font-medium text-gray-700">{formatDate(job.created_at)}</span>
                </div>
                {job.required_level && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Niveau requis</span>
                    <span className="font-medium text-gray-700">{job.required_level}</span>
                  </div>
                )}
                {countryName && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Pays</span>
                    <span className="font-medium text-gray-700">{countryName}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-400">Vues</span>
                  <span className="font-medium text-gray-700">{job.views_count}</span>
                </div>
              </div>
            </div>

            {/* CV Builder promo */}
            <div className="rounded-2xl p-5 border border-amber-200" style={{ backgroundColor: '#FEF9EE' }}>
              <FileText className="w-6 h-6 mb-2" style={{ color: '#BF8813' }} />
              <p className="text-sm font-semibold mb-1" style={{ color: '#92660A' }}>Votre CV pas encore prêt ?</p>
              <p className="text-xs text-amber-700 mb-3">Créez un CV professionnel avec notre générateur intégré.</p>
              <Link to="/dashboard/cv-builder"
                className="block text-center py-2 rounded-lg text-xs font-semibold"
                style={{ backgroundColor: '#BF8813', color: 'white' }}>
                Créer mon CV →
              </Link>
            </div>
          </div>
        </div>
      </div>

      <PageFooter />

      {/* Apply modal */}
      {showApply && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-gray-900">Postuler</h2>
                <p className="text-xs text-gray-400 mt-0.5">{job.title} — {job.recruiter_company}</p>
              </div>
              <button onClick={() => setShowApply(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">
                  Lettre de motivation <span className="text-gray-400">({coverLetter.length}/2000)</span>
                </label>
                <textarea value={coverLetter} onChange={e => setCoverLetter(e.target.value.slice(0, 2000))}
                  rows={7} placeholder="Présentez-vous et expliquez pourquoi vous êtes le candidat idéal pour ce poste..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-gray-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">
                  Lien vers votre CV <span className="text-gray-400">(optionnel)</span>
                </label>
                <input value={cvUrl} onChange={e => setCvUrl(e.target.value)}
                  placeholder="https://... (lien PDF, Google Drive, etc.)"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400" />
                <p className="text-xs text-gray-400 mt-1">
                  Utilisez notre <Link to="/dashboard/cv-builder" className="underline">CV Builder</Link> pour générer un lien PDF.
                </p>
              </div>
              {applyError && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3 py-2.5 rounded-lg">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {applyError}
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowApply(false)} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
                  Annuler
                </button>
                <button onClick={submitApplication} disabled={applying}
                  className="flex-1 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-60"
                  style={{ backgroundColor: '#002050' }}>
                  {applying ? 'Envoi…' : 'Envoyer ma candidature'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
