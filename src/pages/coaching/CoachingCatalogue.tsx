import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, BadgeCheck, CalendarClock, Languages, SlidersHorizontal, Star, UserRoundCheck } from 'lucide-react';
import CoachingLayout from '../../components/coaching/CoachingLayout';
import { CoachProfile, CoachingDomain, CoachingLevel, coachingRequest, formatXof } from '../../lib/coachingApi';

const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

type Bootstrap = { success: true; coaches: CoachProfile[]; domains: CoachingDomain[]; levels: CoachingLevel[] };


function withPreview(path: string, params: URLSearchParams) {
  if (params.get('preview') !== 'true') return path;
  const [base, hash = ''] = path.split('#', 2);
  const [pathname, query = ''] = base.split('?', 2);
  const next = new URLSearchParams(query);
  next.set('preview', 'true');
  const role = params.get('role');
  if (role) next.set('role', role);
  return `${pathname}?${next.toString()}${hash ? `#${hash}` : ''}`;
}

function PreviewLink({ to, ...props }: ComponentProps<typeof Link>) {
  const [params] = useSearchParams();
  return <Link to={typeof to === 'string' ? withPreview(to, params) : to} {...props} />;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'OC';
}

function CoachCard({ coach }: { coach: CoachProfile }) {
  const prices = [coach.price_30_xof, coach.price_60_xof, coach.price_90_xof].filter((v): v is number => typeof v === 'number');
  const starting = prices.length ? Math.min(...prices) : null;
  return (
    <article className="flex h-full flex-col rounded-2xl border bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lg" style={{ borderColor: BORDER }}>
      <div className="flex items-start gap-4">
        {coach.photo_url ? <img src={coach.photo_url} alt={coach.full_name} className="h-16 w-16 rounded-2xl object-cover" /> : <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white" style={{ background: BLUE }}>{initials(coach.full_name)}</div>}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-semibold" style={{ color: BLUE }}>{coach.full_name}</h2>
            {(coach.badge_override || coach.level?.badge_label) && <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: 'rgba(191,136,19,.12)', color: GOLD }}><BadgeCheck size={13}/>{coach.badge_override || coach.level?.badge_label}</span>}
          </div>
          <p className="mt-1 text-sm text-slate-600">{coach.professional_title}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1"><Star size={14} fill={coach.rating_count ? GOLD : 'none'} color={GOLD}/>{Number(coach.average_rating || 0).toFixed(1)} ({coach.rating_count || 0})</span>
            <span className="inline-flex items-center gap-1"><Languages size={14}/>{coach.languages?.slice(0, 2).join(', ') || 'Non renseigné'}</span>
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">{coach.domains?.slice(0, 3).map(domain => <span key={domain.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{domain.name}</span>)}</div>
      <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600">{coach.biography}</p>
      <div className="mt-auto pt-5">
        <div className="flex items-end justify-between gap-3 border-t pt-4" style={{ borderColor: BORDER }}>
          <div><p className="text-xs text-slate-500">À partir de</p><p className="mt-1 font-semibold" style={{ color: BLUE }}>{starting === null ? 'Tarif sur demande' : `${formatXof(starting)} / séance`}</p></div>
          <PreviewLink to={`/coaching/coachs/${coach.public_slug}`} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{ background: BLUE }}>Voir le profil <ArrowRight size={15}/></PreviewLink>
        </div>
      </div>
    </article>
  );
}

export default function CoachingCatalogue() {
  const [params] = useSearchParams();
  const headerQuery = params.get('q') || '';
  const [data, setData] = useState<Bootstrap>({ success: true, coaches: [], domains: [], levels: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState(() => headerQuery);
  const [domain, setDomain] = useState('');
  const [level, setLevel] = useState('');
  const [language, setLanguage] = useState('');
  const [sort, setSort] = useState('featured');

  useEffect(() => {
    coachingRequest<Bootstrap>('public_bootstrap').then(setData).catch(e => setError(e instanceof Error ? e.message : 'Catalogue indisponible.')).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setQuery(headerQuery);
  }, [headerQuery]);

  const languages = useMemo(() => [...new Set(data.coaches.flatMap(coach => coach.languages || []))].sort((a, b) => a.localeCompare(b, 'fr')), [data.coaches]);
  const coaches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = data.coaches.filter(coach => {
      const text = [coach.full_name, coach.professional_title, coach.biography, ...(coach.specialties || []), ...(coach.domains || []).map(item => item.name)].join(' ').toLowerCase();
      return (!normalized || text.includes(normalized)) && (!domain || coach.domains?.some(item => item.id === domain)) && (!level || coach.level?.id === level) && (!language || coach.languages?.includes(language));
    });
    return [...filtered].sort((a, b) => {
      if (sort === 'rating') return Number(b.average_rating || 0) - Number(a.average_rating || 0);
      if (sort === 'price') {
        const min = (coach: CoachProfile) => Math.min(...[coach.price_30_xof, coach.price_60_xof, coach.price_90_xof].filter((v): v is number => typeof v === 'number'), Number.MAX_SAFE_INTEGER);
        return min(a) - min(b);
      }
      if (sort === 'new') return String(b.id).localeCompare(String(a.id));
      return Number(Boolean(b.is_featured)) - Number(Boolean(a.is_featured));
    });
  }, [data, query, domain, level, language, sort]);

  return <CoachingLayout>
    <main className="mx-auto max-w-[1320px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-3xl">
          <p className="text-[11px] font-black uppercase tracking-[.18em] text-[#356C63]">Explorer Omnia Coaching</p>
          <h1 className="mt-3 text-3xl font-black tracking-[-.04em] text-[#002050] md:text-4xl">Choisir un coach à partir de l’objectif, pas du bruit.</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">La recherche reste dans l’en-tête. Ici, affinez uniquement les critères réellement utiles à la sélection.</p>
        </div>
        <span className="rounded-full bg-[#EAF3F0] px-3 py-1.5 text-xs font-black text-[#356C63]">{coaches.length} coach{coaches.length > 1 ? 's' : ''}</span>
      </div>

      <section className="mt-7 border-y border-[#DCE7E1] bg-[#FBFCFA] py-4">
        <div className="flex items-center gap-2 text-sm font-black text-[#002050]"><SlidersHorizontal size={17} color={GOLD}/>Filtres du catalogue</div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <select value={domain} onChange={e => setDomain(e.target.value)} className="h-10 rounded-xl border bg-white px-3 text-sm" style={{ borderColor: BORDER }}><option value="">Tous les domaines</option>{data.domains.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <select value={language} onChange={e => setLanguage(e.target.value)} className="h-10 rounded-xl border bg-white px-3 text-sm" style={{ borderColor: BORDER }}><option value="">Toutes les langues</option>{languages.map(item => <option key={item}>{item}</option>)}</select>
          <select value={level} onChange={e => setLevel(e.target.value)} className="h-10 rounded-xl border bg-white px-3 text-sm" style={{ borderColor: BORDER }}><option value="">Tous les niveaux</option>{data.levels.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <select value={sort} onChange={e => setSort(e.target.value)} className="h-10 rounded-xl border bg-white px-3 text-sm" style={{ borderColor: BORDER }}><option value="featured">Mise en avant</option><option value="rating">Meilleure note</option><option value="price">Prix croissant</option><option value="new">Nouveaux coachs</option></select>
        </div>
      </section>

      {error && <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {loading ? <div className="py-20 text-center text-sm text-slate-500">Chargement des coachs…</div> : coaches.length ? <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{coaches.map(coach => <CoachCard key={coach.id} coach={coach}/>)}</div> : <div className="mt-6 rounded-2xl border bg-white px-6 py-16 text-center" style={{ borderColor: BORDER }}><CalendarClock className="mx-auto h-10 w-10" color={GOLD}/><h2 className="mt-4 text-lg font-semibold" style={{ color: BLUE }}>Aucun coach ne correspond à ces critères</h2><p className="mt-2 text-sm text-slate-500">Modifiez les filtres ou revenez prochainement.</p></div>}
    </main>
  </CoachingLayout>;
}
