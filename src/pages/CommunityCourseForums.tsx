import { getSessionToken } from '../lib/session';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CommunityLayout from '../components/community/CommunityLayout';
import { PageFooter } from '../components/PageFooter';
import { ArrowRight, BookOpen as BookOpenCheck, GraduationCap, Search, ShieldCheck } from 'lucide-react';
import { ENDPOINTS } from '../lib/config';
import { edgeAuthHeaders } from '../lib/edgeAuth';

const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E5E7EB';

type AccessibleCourse = {
  id: string;
  title: string;
  access_type: 'learner' | 'instructor' | 'moderation';
  discussions_count?: number;
  unresolved_count?: number;
};

export default function CommunityCourseForums() {
  const navigate = useNavigate();
  const token = getSessionToken() || '';
  const [courses, setCourses] = useState<AccessibleCourse[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      navigate(`/connexion?redirect=${encodeURIComponent('/forum/formations')}`, { replace: true });
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(ENDPOINTS.forumAccessibleCourses, { headers: edgeAuthHeaders() });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || 'Impossible de charger les forums.');
        if (!cancelled) setCourses(Array.isArray(data.courses) ? data.courses : []);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Impossible de charger les forums.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [navigate, token]);

  const visibleCourses = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('fr-FR');
    if (!normalized) return courses;
    return courses.filter(course => course.title.toLocaleLowerCase('fr-FR').includes(normalized));
  }, [courses, query]);

  return (
    <CommunityLayout>
      <div className="min-h-screen bg-white">
        <section className="border-b border-slate-100 px-4 pb-8 pt-8 md:px-8 md:pb-10">
          <div className="mx-auto max-w-6xl">
            <div className="rounded-3xl border bg-gradient-to-br from-slate-50 via-white to-amber-50 p-6 md:p-8" style={{ borderColor: BORDER }}>
              <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-[.12em] shadow-sm" style={{ color: GOLD }}>
                    <BookOpenCheck size={15} /> Espaces réservés aux formations
                  </div>
                  <h1 className="mt-4 text-3xl font-black md:text-4xl" style={{ color: BLUE }}>Forums de vos formations</h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Chaque forum est rattaché à une formation précise. Les apprenants inscrits, le formateur concerné et les personnes autorisées à modérer peuvent y accéder.</p>
                </div>
                <div className="rounded-2xl border bg-white px-5 py-4 text-center" style={{ borderColor: BORDER }}>
                  <strong className="block text-2xl" style={{ color: BLUE }}>{courses.length}</strong>
                  <span className="text-xs text-slate-500">forum{courses.length === 1 ? '' : 's'} accessible{courses.length === 1 ? '' : 's'}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-10 md:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black" style={{ color: BLUE }}>Vos espaces de questions et réponses</h2>
                <p className="mt-1 text-sm text-slate-500">Recherchez une formation puis ouvrez son espace communautaire.</p>
              </div>
              <div className="relative w-full max-w-sm">
                <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Rechercher une formation..." className="w-full rounded-xl border bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-slate-400" style={{ borderColor: BORDER }} />
              </div>
            </div>

            {loading ? (
              <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-48 animate-pulse rounded-2xl border bg-slate-50" style={{ borderColor: BORDER }} />)}</div>
            ) : error ? (
              <div className="mt-7 rounded-2xl border border-red-100 bg-red-50 p-8 text-center text-sm text-red-700">{error}</div>
            ) : visibleCourses.length === 0 ? (
              <div className="mt-7 rounded-3xl border border-dashed bg-white p-12 text-center" style={{ borderColor: BORDER }}>
                <GraduationCap size={34} className="mx-auto text-slate-300" />
                <h3 className="mt-4 text-lg font-bold" style={{ color: BLUE }}>{query ? 'Aucune formation trouvée' : 'Aucun forum de formation disponible'}</h3>
                <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">{query ? 'Modifiez votre recherche.' : 'Un forum apparaîtra ici lorsqu’une formation sera accessible à votre compte.'}</p>
                {!query && <Link to="/catalogue" className="mt-5 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white" style={{ background: BLUE }}>Explorer le catalogue <ArrowRight size={16} /></Link>}
              </div>
            ) : (
              <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {visibleCourses.map(course => (
                  <Link key={course.id} to={`/forum/cours/${course.id}`} className="group rounded-2xl border bg-white p-5 transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md" style={{ borderColor: BORDER }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: 'rgba(191,136,19,.09)' }}><BookOpenCheck size={21} color={GOLD} /></div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">{course.access_type === 'learner' ? 'Apprenant' : course.access_type === 'instructor' ? 'Formateur' : 'Modération'}</span>
                    </div>
                    <h3 className="mt-4 line-clamp-2 min-h-[48px] text-base font-bold" style={{ color: BLUE }}>{course.title}</h3>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                      <div className="rounded-xl bg-slate-50 px-3 py-2"><strong className="block text-sm" style={{ color: BLUE }}>{Number(course.discussions_count || 0)}</strong><span className="text-[10px] text-slate-500">Discussions</span></div>
                      <div className="rounded-xl bg-slate-50 px-3 py-2"><strong className="block text-sm" style={{ color: BLUE }}>{Number(course.unresolved_count || 0)}</strong><span className="text-[10px] text-slate-500">Sans solution</span></div>
                    </div>
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold" style={{ color: BLUE }}>Ouvrir le forum <ArrowRight size={15} className="transition group-hover:translate-x-0.5" /></span>
                  </Link>
                ))}
              </div>
            )}

            <div className="mt-10 flex items-start gap-3 rounded-2xl border bg-slate-50 p-5" style={{ borderColor: BORDER }}>
              <ShieldCheck size={20} color={GOLD} className="mt-0.5 shrink-0" />
              <div><h3 className="text-sm font-bold" style={{ color: BLUE }}>Accès protégé</h3><p className="mt-1 text-xs leading-5 text-slate-500">Les contenus des forums de formation ne sont pas publics. L'accès est vérifié côté serveur avant l'affichage, la publication, la réponse, le vote ou le signalement.</p></div>
            </div>
          </div>
        </section>

        <PageFooter />
      </div>
    </CommunityLayout>
  );
}
