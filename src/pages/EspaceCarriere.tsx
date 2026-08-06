import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import CommunityLayout from '../components/community/CommunityLayout';
import { PageFooter } from '../components/PageFooter';
import { ENDPOINTS } from '../lib/config';
import {
  ArrowRight,
  Briefcase as BriefcaseBusiness,
  Building2,
  Clock3,
  ExternalLink,
  Eye,
  Filter,
  Globe2,
  Mail,
  MapPin,
  MessageCircle as MessageCircleQuestion,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { APPLICATION_MODE_SHORT_LABELS, normalizeApplicationMode } from '../lib/jobApplicationModes';
import { edgeGatewayHeaders } from '../lib/edgeAuth';
import { COUNTRIES as COUNTRY_OPTIONS } from '../lib/countries';

const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E5E7EB';

const CONTRACT_TYPES = ['CDI', 'CDD', 'Stage', 'Freelance', 'Alternance'];
const CATEGORIES = ['Tech & Digital', 'Finance', 'Marketing', 'Management', 'Santé', 'Education', 'Juridique', 'Autre'];
const JOB_COUNTRIES = [
  { code: 'remote', name: 'Télétravail / Remote' },
  ...COUNTRY_OPTIONS.map(country => ({ code: country.code, name: country.label })),
];

interface Job {
  id: string;
  title: string;
  description: string;
  location: string;
  contract_type: string;
  category: string;
  salary_range: string | null;
  required_level: string | null;
  recruiter_company: string;
  recruiter_name: string;
  views_count: number;
  applications_count: number;
  deadline: string | null;
  created_at: string;
  is_external_recruiter: boolean;
  status: string;
  application_mode?: string;
  external_apply_url?: string | null;
  external_apply_email?: string | null;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return 'Hier';
  if (days < 30) return `Il y a ${days} jours`;
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

function recruiterPath() {
  try {
    const user = JSON.parse(localStorage.getItem('omnia_user') || '{}');
    return (user.roles || []).includes('super_admin') ? '/admin/offres-emploi' : '/structure/offres-emploi';
  } catch {
    return '/structure/offres-emploi';
  }
}

export default function EspaceCarriere() {
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
  const [country, setCountry] = useState(params.get('country_code') || localStorage.getItem('user_country') || '');
  const [showFilters, setShowFilters] = useState(false);

  const canPostJob = (() => {
    try {
      const user = JSON.parse(localStorage.getItem('omnia_user') || '{}');
      const roles: string[] = user.roles || [];
      const permissions: string[] = user.permissions || user.structure_permissions || [];
      return roles.includes('super_admin') || roles.includes('responsable_structure') || roles.includes('structure_admin') || permissions.includes('can_create_job_offers') || permissions.includes('can_manage_job_offers');
    } catch {
      return false;
    }
  })();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: String(page),
        ...(country ? { country_code: country } : {}),
        ...(search ? { search } : {}),
        ...(contractType ? { contract_type: contractType } : {}),
        ...(category ? { category } : {}),
      });
      const response = await fetch(`${ENDPOINTS.jobsList}?${query}`, { headers: edgeGatewayHeaders(), cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || data?.error || 'Impossible de charger les offres.');
      setJobs(Array.isArray(data.jobs) ? data.jobs : []);
      setTotal(Number(data.total || 0));
      setTotalPages(Math.max(1, Number(data.total_pages || 1)));
    } catch {
      setJobs([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, country, search, contractType, category]);

  useEffect(() => { void load(); }, [load]);

  const activeFilters = [contractType, category].filter(Boolean).length;

  return (
    <CommunityLayout>
      <div className="min-h-screen bg-white">
        <section className="border-b border-slate-100 px-4 pb-9 pt-8 md:px-8 md:pb-11">
          <div className="mx-auto max-w-6xl">
            <div className="rounded-3xl border bg-gradient-to-br from-slate-50 via-white to-amber-50 p-6 md:p-8" style={{ borderColor: BORDER }}>
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div className="max-w-3xl">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-[.12em] shadow-sm" style={{ color: GOLD }}>
                    <BriefcaseBusiness size={15} /> Carrière & emploi
                  </div>
                  <h1 className="mt-4 text-3xl font-black leading-tight md:text-4xl" style={{ color: BLUE }}>Trouvez une opportunité et préparez votre candidature</h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Consultez les offres publiées sur Omnia, filtrez-les selon votre projet et utilisez Omnia Career pour adapter votre CV et votre lettre de motivation.</p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link to="/forum/carriere" className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-bold" style={{ borderColor: BORDER, color: BLUE }}><MessageCircleQuestion size={16} /> Poser une question carrière</Link>
                    <Link to="/dashboard/career-studio" className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white" style={{ background: BLUE }}><Sparkles size={16} /> Ouvrir Omnia Career</Link>
                  </div>
                </div>
                <div className="grid min-w-[220px] grid-cols-2 gap-3">
                  <div className="rounded-2xl border bg-white p-4 text-center" style={{ borderColor: BORDER }}><strong className="block text-2xl" style={{ color: BLUE }}>{total}</strong><span className="text-xs text-slate-500">offre{total === 1 ? '' : 's'} disponible{total === 1 ? '' : 's'}</span></div>
                  <div className="rounded-2xl border bg-white p-4 text-center" style={{ borderColor: BORDER }}><Globe2 size={20} className="mx-auto" color={GOLD} /><span className="mt-2 block text-xs text-slate-500">Opportunités locales et internationales</span></div>
                </div>
              </div>

              <div className="mt-7 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Rechercher un poste, une entreprise ou un mot-clé..." className="w-full rounded-xl border bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-slate-400" style={{ borderColor: BORDER }} />
                </div>
                <div className="flex items-center gap-2 rounded-xl border bg-white px-3" style={{ borderColor: BORDER }}>
                  <Globe2 size={16} className="text-slate-400" />
                  <select value={country} onChange={event => { setCountry(event.target.value); setPage(1); }} className="h-11 min-w-[175px] bg-transparent text-sm text-slate-600 outline-none"><option value="">Tous les pays</option>{JOB_COUNTRIES.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</select>
                </div>
                <button onClick={() => setShowFilters(value => !value)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-bold" style={showFilters || activeFilters > 0 ? { borderColor: BLUE, color: BLUE, background: '#EFF6FF' } : { borderColor: BORDER, color: '#64748B', background: 'white' }}><Filter size={16} /> Filtres{activeFilters > 0 && <span className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] text-white" style={{ background: BLUE }}>{activeFilters}</span>}</button>
              </div>

              {showFilters && (
                <div className="mt-4 grid gap-4 rounded-2xl border bg-white p-4 md:grid-cols-2" style={{ borderColor: BORDER }}>
                  <div><label className="mb-2 block text-xs font-bold text-slate-500">Type de contrat</label><div className="flex flex-wrap gap-2"><button onClick={() => { setContractType(''); setPage(1); }} className="rounded-lg px-3 py-1.5 text-xs font-bold" style={contractType === '' ? { background: BLUE, color: 'white' } : { background: '#F8FAFC', color: '#64748B' }}>Tous</button>{CONTRACT_TYPES.map(type => <button key={type} onClick={() => { setContractType(type); setPage(1); }} className="rounded-lg px-3 py-1.5 text-xs font-bold" style={contractType === type ? { background: BLUE, color: 'white' } : { background: '#F8FAFC', color: '#64748B' }}>{type}</button>)}</div></div>
                  <div><label className="mb-2 block text-xs font-bold text-slate-500">Secteur</label><select value={category} onChange={event => { setCategory(event.target.value); setPage(1); }} className="h-10 w-full rounded-xl border bg-white px-3 text-sm text-slate-600 outline-none" style={{ borderColor: BORDER }}><option value="">Tous les secteurs</option>{CATEGORIES.map(item => <option key={item} value={item}>{item}</option>)}</select></div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="px-4 py-10 md:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black" style={{ color: BLUE }}>Offres disponibles</h2><p className="mt-1 text-sm text-slate-500">Des opportunités filtrées selon vos critères.</p></div>{canPostJob && <Link to={recruiterPath()} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white" style={{ background: GOLD }}><BriefcaseBusiness size={16} /> Déposer une offre</Link>}</div>

            {loading ? (
              <div className="space-y-4">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-36 animate-pulse rounded-2xl border bg-slate-50" style={{ borderColor: BORDER }} />)}</div>
            ) : jobs.length === 0 ? (
              <div className="rounded-3xl border border-dashed bg-white p-14 text-center" style={{ borderColor: BORDER }}><BriefcaseBusiness size={38} className="mx-auto text-slate-300" /><h3 className="mt-4 text-lg font-bold" style={{ color: BLUE }}>Aucune offre disponible</h3><p className="mt-2 text-sm text-slate-500">Essayez d'autres critères ou revenez bientôt.</p></div>
            ) : (
              <div className="space-y-4">
                {jobs.map(job => {
                  const badge = deadlineBadge(job.deadline);
                  const mode = normalizeApplicationMode(job.application_mode);
                  return (
                    <Link key={job.id} to={`/forum/emploi/${job.id}`} className="group block rounded-2xl border bg-white p-5 transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md" style={{ borderColor: BORDER }}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 flex-1 items-start gap-4">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: BLUE }}><Building2 size={21} /></div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-black" style={{ color: BLUE }}>{job.title}</h3>{job.is_external_recruiter && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">Recruteur externe</span>}</div>
                            <p className="mt-1 text-sm font-semibold text-slate-600">{job.recruiter_company}</p>
                            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">{job.location && <span className="inline-flex items-center gap-1"><MapPin size={13} /> {job.location}</span>}<span className="inline-flex items-center gap-1"><Clock3 size={13} /> {timeAgo(job.created_at)}</span><span className="inline-flex items-center gap-1"><Eye size={13} /> {job.views_count} vue{job.views_count === 1 ? '' : 's'}</span><span className="inline-flex items-center gap-1 font-semibold" style={{ color: mode === 'omnia_managed' ? BLUE : GOLD }}>{mode === 'external_link' ? <ExternalLink size={13} /> : mode === 'external_email' ? <Mail size={13} /> : <ShieldCheck size={13} />}{APPLICATION_MODE_SHORT_LABELS[mode]}</span></div>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2"><span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold" style={{ color: BLUE }}>{job.contract_type}</span>{job.salary_range && <span className="text-xs font-semibold text-emerald-700">{job.salary_range}</span>}{badge && <span className={`text-xs font-bold ${badge === 'Expiré' ? 'text-red-600' : 'text-amber-700'}`}>{badge}</span>}<ArrowRight size={17} className="mt-1 text-slate-300 transition group-hover:translate-x-1" /></div>
                      </div>
                      {job.category && <div className="mt-4 border-t border-slate-100 pt-3"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">{job.category}</span></div>}
                    </Link>
                  );
                })}
              </div>
            )}

            {totalPages > 1 && <div className="mt-8 flex items-center justify-center gap-3"><button disabled={page <= 1} onClick={() => setPage(current => current - 1)} className="rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-40" style={{ borderColor: BORDER, color: BLUE }}>Précédent</button><span className="text-sm text-slate-500">Page {page} / {totalPages}</span><button disabled={page >= totalPages} onClick={() => setPage(current => current + 1)} className="rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-40" style={{ borderColor: BORDER, color: BLUE }}>Suivant</button></div>}
          </div>
        </section>

        <PageFooter />
      </div>
    </CommunityLayout>
  );
}
