import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Briefcase, Building2, Filter, MapPin, Search, UserRound } from 'lucide-react';
import { TalentLayout } from '../../components/talent/TalentLayout';
import { loadPublicJobs, loadPublicTalents, PublicJob, PublicTalent } from './talentApi';

const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

type Tab = 'talents' | 'entreprises' | 'offres';

export default function TalentExplore() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'talents';
  const [talents, setTalents] = useState<PublicTalent[]>([]);
  const [jobs, setJobs] = useState<PublicJob[]>([]);
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [sector, setSector] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([loadPublicTalents(), loadPublicJobs()]).then(([talentResult, jobResult]) => {
      if (talentResult.status === 'fulfilled') setTalents(talentResult.value);
      if (jobResult.status === 'fulfilled') setJobs(jobResult.value);
      setLoading(false);
    });
  }, []);

  const sectors = useMemo(() => Array.from(new Set([
    ...talents.flatMap(t => t.sectors || []),
    ...jobs.map(j => j.sector).filter(Boolean) as string[],
  ])).sort(), [talents, jobs]);

  const filteredTalents = talents.filter(t => {
    const text = `${t.full_name} ${t.professional_title || ''} ${(t.skills || []).join(' ')} ${(t.sectors || []).join(' ')}`.toLowerCase();
    return text.includes(query.toLowerCase())
      && (!location || `${t.location || ''} ${t.country || ''}`.toLowerCase().includes(location.toLowerCase()))
      && (!sector || (t.sectors || []).includes(sector));
  });

  const filteredJobs = jobs.filter(j => {
    const text = `${j.title || ''} ${j.company_name || ''} ${j.description || ''}`.toLowerCase();
    return text.includes(query.toLowerCase())
      && (!location || (j.location || '').toLowerCase().includes(location.toLowerCase()))
      && (!sector || j.sector === sector);
  });

  const companies = useMemo(() => {
    const map = new Map<string, { name: string; jobs: PublicJob[]; sector?: string; location?: string }>();
    jobs.forEach(job => {
      if (!job.company_name) return;
      const current = map.get(job.company_name) || { name: job.company_name, jobs: [], sector: job.sector, location: job.location };
      current.jobs.push(job);
      map.set(job.company_name, current);
    });
    return Array.from(map.values()).filter(c => c.name.toLowerCase().includes(query.toLowerCase()) && (!location || (c.location || '').toLowerCase().includes(location.toLowerCase())) && (!sector || c.sector === sector));
  }, [jobs, query, location, sector]);

  return (
    <TalentLayout>
      <div className="mx-auto max-w-7xl px-5 py-8 md:px-8">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: BLUE }}>Explorer Talent Omnia</h1>
          <p className="mt-1 text-sm text-gray-500">Recherchez dans les profils publics, les organisations visibles et les offres existantes.</p>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {([
            ['talents', 'Talents', UserRound],
            ['entreprises', 'Entreprises', Building2],
            ['offres', 'Offres', Briefcase],
          ] as const).map(([value, label, Icon]) => (
            <button key={value} type="button" onClick={() => setParams({ tab: value })} className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium" style={{ background: tab === value ? BLUE : 'white', color: tab === value ? 'white' : BLUE, border: `1px solid ${tab === value ? BLUE : BORDER}` }}>
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>

        <div className="mt-5 rounded-xl border bg-white p-4" style={{ borderColor: BORDER }}>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="flex h-11 items-center gap-2 rounded-lg border px-3" style={{ borderColor: BORDER }}>
              <Search size={16} className="text-gray-400" />
              <input value={query} onChange={e => setQuery(e.target.value)} className="w-full border-0 bg-transparent text-sm outline-none" placeholder="Nom, métier, compétence ou organisation" />
            </label>
            <label className="flex h-11 items-center gap-2 rounded-lg border px-3" style={{ borderColor: BORDER }}>
              <MapPin size={16} className="text-gray-400" />
              <input value={location} onChange={e => setLocation(e.target.value)} className="w-full border-0 bg-transparent text-sm outline-none" placeholder="Pays ou ville" />
            </label>
            <label className="flex h-11 items-center gap-2 rounded-lg border px-3" style={{ borderColor: BORDER }}>
              <Filter size={16} className="text-gray-400" />
              <select value={sector} onChange={e => setSector(e.target.value)} className="w-full bg-transparent text-sm outline-none">
                <option value="">Tous les secteurs</option>
                {sectors.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
          </div>
        </div>

        {loading ? <Empty text="Chargement des données publiques…" /> : tab === 'talents' ? (
          filteredTalents.length ? <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filteredTalents.map(talent => <TalentResult key={talent.id} talent={talent} />)}</div> : <Empty text="Aucun profil public ne correspond à votre recherche." />
        ) : tab === 'offres' ? (
          filteredJobs.length ? <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filteredJobs.map(job => <JobResult key={job.id} job={job} />)}</div> : <Empty text="Aucune offre ne correspond à votre recherche." />
        ) : (
          companies.length ? <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{companies.map(company => <CompanyResult key={company.name} company={company} />)}</div> : <Empty text="Aucune organisation visible ne correspond à votre recherche." />
        )}
      </div>
    </TalentLayout>
  );
}

function TalentResult({ talent }: { talent: PublicTalent }) {
  return <Link to={`/talent/profil/${talent.id}`} className="rounded-xl border bg-white p-5 hover:shadow-sm" style={{ borderColor: BORDER }}>
    <div className="flex gap-3"><div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full text-white" style={{ background: BLUE }}>{talent.photo_url ? <img src={talent.photo_url} className="h-full w-full object-cover" alt="" /> : <UserRound size={19} />}</div><div className="min-w-0"><p className="truncate text-sm font-semibold" style={{ color: BLUE }}>{talent.full_name}</p><p className="truncate text-sm text-gray-500">{talent.professional_title || 'Titre non renseigné'}</p><p className="mt-1 text-xs text-gray-400">{talent.location || talent.country || ''}</p></div></div>
    <div className="mt-4 flex flex-wrap gap-2">{(talent.skills || []).slice(0, 5).map(skill => <span key={skill} className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">{skill}</span>)}</div>
  </Link>;
}

function JobResult({ job }: { job: PublicJob }) {
  return <Link to={`/emploi/${job.id}`} className="rounded-xl border bg-white p-5 hover:shadow-sm" style={{ borderColor: BORDER }}><Briefcase size={18} color={GOLD} /><p className="mt-3 text-sm font-semibold" style={{ color: BLUE }}>{job.title || 'Offre sans titre'}</p><p className="mt-1 text-sm text-gray-500">{job.company_name || 'Organisation non renseignée'}</p><div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-500">{job.location && <span>{job.location}</span>}{job.contract_type && <span className="rounded-full bg-gray-100 px-2 py-1">{job.contract_type}</span>}</div></Link>;
}

function CompanyResult({ company }: { company: { name: string; jobs: PublicJob[]; sector?: string; location?: string } }) {
  return <div className="rounded-xl border bg-white p-5" style={{ borderColor: BORDER }}><div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: 'rgba(191,136,19,.12)', color: GOLD }}><Building2 size={19} /></div><p className="mt-3 text-sm font-semibold" style={{ color: BLUE }}>{company.name}</p><p className="mt-1 text-sm text-gray-500">{company.sector || 'Secteur non renseigné'}</p><p className="mt-3 text-xs text-gray-500">{company.jobs.length} offre{company.jobs.length > 1 ? 's' : ''} active{company.jobs.length > 1 ? 's' : ''}</p></div>;
}

function Empty({ text }: { text: string }) {
  return <div className="mt-6 rounded-xl border border-dashed bg-white p-12 text-center text-sm text-gray-500" style={{ borderColor: BORDER }}>{text}</div>;
}
