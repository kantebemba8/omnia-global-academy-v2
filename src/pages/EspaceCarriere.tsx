import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { PageFooter } from '../components/PageFooter';
import { ENDPOINTS } from '../lib/config';
import { Briefcase, Search, MapPin, Clock, ChevronDown, Filter, Eye, Globe, Building2 } from 'lucide-react';

const CONTRACT_TYPES = ['CDI', 'CDD', 'Stage', 'Freelance', 'Alternance'];
const CATEGORIES = ['Tech & Digital', 'Finance', 'Marketing', 'Management', 'Santé', 'Education', 'Juridique', 'Autre'];
const JOB_COUNTRIES = [
  { code: 'remote', name: '🌍 Télétravail / Remote' },
  { code: 'ML', name: 'Mali' }, { code: 'SN', name: 'Sénégal' }, { code: 'CI', name: "Côte d'Ivoire" },
  { code: 'BF', name: 'Burkina Faso' }, { code: 'GN', name: 'Guinée' }, { code: 'NE', name: 'Niger' },
  { code: 'MR', name: 'Mauritanie' }, { code: 'TG', name: 'Togo' }, { code: 'BJ', name: 'Bénin' },
  { code: 'GH', name: 'Ghana' }, { code: 'NG', name: 'Nigeria' }, { code: 'GM', name: 'Gambie' },
  { code: 'GW', name: 'Guinée-Bissau' }, { code: 'SL', name: 'Sierra Leone' }, { code: 'LR', name: 'Libéria' },
  { code: 'CV', name: 'Cap-Vert' }, { code: 'CM', name: 'Cameroun' }, { code: 'CG', name: 'Congo' },
  { code: 'CD', name: 'RD Congo' }, { code: 'GA', name: 'Gabon' }, { code: 'MA', name: 'Maroc' },
  { code: 'DZ', name: 'Algérie' }, { code: 'TN', name: 'Tunisie' }, { code: 'LY', name: 'Libye' },
  { code: 'EG', name: 'Égypte' }, { code: 'KE', name: 'Kenya' }, { code: 'TZ', name: 'Tanzanie' },
  { code: 'ET', name: 'Éthiopie' }, { code: 'ZA', name: 'Afrique du Sud' }, { code: 'AO', name: 'Angola' },
  { code: 'MZ', name: 'Mozambique' }, { code: 'MG', name: 'Madagascar' }, { code: 'RW', name: 'Rwanda' },
  { code: 'UG', name: 'Ouganda' }, { code: 'SD', name: 'Soudan' }, { code: 'TD', name: 'Tchad' },
  { code: 'CF', name: 'Centrafrique' }, { code: 'KM', name: 'Comores' },
  { code: 'FR', name: 'France' }, { code: 'BE', name: 'Belgique' }, { code: 'CH', name: 'Suisse' },
  { code: 'LU', name: 'Luxembourg' }, { code: 'DE', name: 'Allemagne' }, { code: 'GB', name: 'Royaume-Uni' },
  { code: 'ES', name: 'Espagne' }, { code: 'PT', name: 'Portugal' },
  { code: 'CA', name: 'Canada' }, { code: 'US', name: 'États-Unis' },
  { code: 'AE', name: 'Émirats Arabes Unis' }, { code: 'SA', name: 'Arabie Saoudite' },
];

interface Job {
  id: string; title: string; description: string; location: string; contract_type: string;
  category: string; salary_range: string | null; required_level: string | null;
  recruiter_company: string; recruiter_name: string; views_count: number;
  applications_count: number; deadline: string | null; created_at: string;
  is_external_recruiter: boolean; status: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return "Aujourd'hui";
  if (d === 1) return 'Hier';
  if (d < 30) return `Il y a ${d} jours`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function deadlineBadge(deadline: string | null): string | null {
  if (!deadline) return null;
  const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
  if (days < 0) return 'Expiré';
  if (days === 0) return "Expire aujourd'hui";
  if (days <= 7) return `${days}j restant${days > 1 ? 's' : ''}`;
  return null;
}

export default function EspaceCarriere() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(params.get('search') || '');
  const [contractType, setContractType] = useState(params.get('contract_type') || '');
  const [category, setCategory] = useState(params.get('category') || '');
  const [country, setCountry] = useState(params.get('country_code') || localStorage.getItem('user_country') || 'ML');
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({
        page: String(page),
        country_code: country,
        ...(search ? { search } : {}),
        ...(contractType ? { contract_type: contractType } : {}),
        ...(category ? { category } : {}),
      });
      const res = await fetch(`${ENDPOINTS.jobsList}?${q}`);
      const d = await res.json();
      setJobs(d.jobs || []);
      setTotal(d.total || 0);
      setTotalPages(d.total_pages || 1);
    } catch { /**/ }
    setLoading(false);
  }, [page, country, search, contractType, category]);

  useEffect(() => { load(); }, [load]);

  const activeFilters = [contractType, category].filter(Boolean).length;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F8F9FA' }}>
      <Navbar />

      {/* Hero */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
            <Link to="/forum" className="hover:text-gray-600 transition-colors">Forum</Link>
            <span>›</span>
            <span style={{ color: '#002050' }}>Espace Carrière & Emploi</span>
          </div>
          <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: '#002050' }}>Espace Carrière & Emploi</h1>
              <p className="text-sm text-gray-500 mt-1">{total} offre{total !== 1 ? 's' : ''} disponible{total !== 1 ? 's' : ''}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-1.5 bg-white">
                <Globe className="w-3.5 h-3.5 text-gray-400" />
                <select value={country} onChange={e => { setCountry(e.target.value); setPage(1); }}
                  className="text-xs text-gray-600 focus:outline-none bg-transparent">
                  {JOB_COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
              </div>
              <Link to="/recruteur"
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ backgroundColor: '#BF8813' }}>
                <Briefcase className="w-4 h-4" /> Déposer une offre
              </Link>
            </div>
          </div>

          {/* Search + filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-60 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Rechercher un poste, une entreprise..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-gray-400" />
            </div>
            <button onClick={() => setShowFilters(v => !v)}
              className="flex items-center gap-2 px-4 py-2.5 border rounded-xl text-sm font-medium transition-colors"
              style={showFilters || activeFilters > 0
                ? { borderColor: '#002050', color: '#002050', backgroundColor: '#EFF6FF' }
                : { borderColor: '#E5E7EB', color: '#6B7280', backgroundColor: 'white' }}>
              <Filter className="w-4 h-4" />
              Filtres
              {activeFilters > 0 && (
                <span className="w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center text-white"
                  style={{ backgroundColor: '#002050' }}>{activeFilters}</span>
              )}
            </button>
          </div>

          {showFilters && (
            <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200 flex flex-wrap gap-4">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1.5">Type de contrat</label>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => { setContractType(''); setPage(1); }}
                    className="px-3 py-1 rounded-lg text-xs font-medium transition-colors"
                    style={contractType === '' ? { backgroundColor: '#002050', color: 'white' } : { backgroundColor: 'white', color: '#6B7280', border: '1px solid #E5E7EB' }}>
                    Tous
                  </button>
                  {CONTRACT_TYPES.map(t => (
                    <button key={t} onClick={() => { setContractType(t); setPage(1); }}
                      className="px-3 py-1 rounded-lg text-xs font-medium transition-colors"
                      style={contractType === t ? { backgroundColor: '#002050', color: 'white' } : { backgroundColor: 'white', color: '#6B7280', border: '1px solid #E5E7EB' }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1.5">Secteur</label>
                <select value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-600 focus:outline-none bg-white">
                  <option value="">Tous les secteurs</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 w-full flex-1">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
          </div>
        ) : jobs.length === 0 ? (
          <div className="bg-white rounded-2xl p-16 text-center border border-gray-100">
            <Briefcase className="w-12 h-12 mx-auto mb-4 text-gray-200" />
            <p className="text-gray-500 font-medium text-lg mb-1">Aucune offre disponible</p>
            <p className="text-sm text-gray-400">Essayez d'autres critères ou revenez bientôt.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {jobs.map(job => {
              const badge = deadlineBadge(job.deadline);
              return (
                <Link key={job.id} to={`/emploi/${job.id}`}
                  className="block bg-white rounded-2xl border border-gray-100 hover:border-amber-300 hover:shadow-md transition-all p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      {/* Company logo placeholder */}
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-lg font-bold"
                        style={{ backgroundColor: '#002050' }}>
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-bold text-base" style={{ color: '#002050' }}>{job.title}</h3>
                          {job.is_external_recruiter && (
                            <span className="text-xs px-2 py-0.5 rounded-full border" style={{ borderColor: '#E5E7EB', color: '#9CA3AF' }}>Externe</span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-gray-600 mb-2">{job.recruiter_company}</p>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                          {job.location && (
                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.location}</span>
                          )}
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo(job.created_at)}</span>
                          <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{job.views_count} vue{job.views_count !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                        style={{ backgroundColor: '#EFF6FF', color: '#002050' }}>
                        {job.contract_type}
                      </span>
                      {job.salary_range && (
                        <span className="text-xs font-medium" style={{ color: '#1E7A52' }}>{job.salary_range}</span>
                      )}
                      {badge && (
                        <span className="text-xs font-medium" style={{ color: badge === 'Expiré' ? '#DC2626' : '#D97706' }}>
                          {badge}
                        </span>
                      )}
                    </div>
                  </div>
                  {job.category && (
                    <div className="mt-3 pt-3 border-t border-gray-50">
                      <span className="inline-block text-xs px-2.5 py-1 rounded-full" style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}>
                        {job.category}
                      </span>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium disabled:opacity-40 hover:bg-gray-50">
              Précédent
            </button>
            <span className="text-sm text-gray-500">Page {page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium disabled:opacity-40 hover:bg-gray-50">
              Suivant
            </button>
          </div>
        )}
      </div>

      <PageFooter />
    </div>
  );
}
