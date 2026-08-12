import { getSessionToken } from '../lib/session';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import CommunityLayout from '../components/community/CommunityLayout';
import { ArrowRight, BookOpen, CheckCircle2, GraduationCap, MessageSquare, ShieldCheck } from 'lucide-react';
import { ENDPOINTS } from '../lib/config';
import { edgeAuthHeaders } from '../lib/edgeAuth';

const BLUE = '#002050';
const TEAL = '#0F766E';
const BORDER = '#DDEBE8';

type AccessibleCourse = {
  id: string;
  title: string;
  access_type: 'learner' | 'instructor' | 'moderation';
  discussions_count?: number;
  unresolved_count?: number;
};

function accessMeta(type: AccessibleCourse['access_type']) {
  if (type === 'instructor') return { label: 'Formateur', icon: GraduationCap, tone: 'text-[#002050] bg-[#EEF3F8]' };
  if (type === 'moderation') return { label: 'Modération', icon: ShieldCheck, tone: 'text-amber-700 bg-amber-50' };
  return { label: 'Apprenant', icon: BookOpen, tone: 'text-[#0F766E] bg-[#E8F6F3]' };
}

export default function CommunityCourseForums() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = getSessionToken() || '';
  const search = (params.get('search') || '').trim().toLocaleLowerCase('fr-FR');
  const [courses, setCourses] = useState<AccessibleCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      navigate(`/connexion?redirect=${encodeURIComponent('/forum/formations')}`, { replace: true });
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true); setError('');
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

  const visibleCourses = useMemo(() => search ? courses.filter(course => course.title.toLocaleLowerCase('fr-FR').includes(search)) : courses, [courses, search]);
  const totalDiscussions = useMemo(() => courses.reduce((sum, course) => sum + Number(course.discussions_count || 0), 0), [courses]);
  const totalOpen = useMemo(() => courses.reduce((sum, course) => sum + Number(course.unresolved_count || 0), 0), [courses]);

  return (
    <CommunityLayout>
      <main className="min-h-screen bg-[#F8FCFB]">
        <section className="border-b border-[#DDEBE8] bg-white">
          <div className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
              <div className="max-w-3xl">
                <p className="text-[10px] font-black uppercase tracking-[.17em] text-[#0F766E]">Questions ancrées dans l’apprentissage</p>
                <h1 className="mt-2 text-3xl font-black tracking-[-.035em] text-[#002050] md:text-5xl">Forums de vos formations</h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">Chaque espace reste attaché à une formation précise. Les participants, le formateur et les personnes autorisées à modérer partagent le même contexte pédagogique.</p>
                {search && <p className="mt-4 text-sm font-semibold text-[#0F766E]">Recherche active : « {params.get('search')} »</p>}
              </div>
              <div className="flex gap-6 border-l-2 border-[#0F766E] pl-5">
                <div><strong className="block text-3xl font-black text-[#002050]">{courses.length}</strong><span className="text-xs font-semibold text-slate-400">espaces</span></div>
                <div><strong className="block text-3xl font-black text-[#002050]">{totalOpen}</strong><span className="text-xs font-semibold text-slate-400">questions ouvertes</span></div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-9 md:px-8 md:py-12">
          <div className="grid gap-6 lg:grid-cols-[.7fr_1.3fr]">
            <aside className="rounded-[28px] bg-[#083F43] p-6 text-white md:p-8">
              <BookOpen size={26} className="text-[#86D9CD]" />
              <h2 className="mt-5 text-2xl font-black">Le bon contexte, avant la bonne réponse.</h2>
              <p className="mt-3 text-sm leading-7 text-white/65">Une question liée à un cours ne se mélange pas au flux général : elle reste avec les personnes qui connaissent le contenu, les consignes et l’étape du parcours.</p>
              <div className="mt-8 border-t border-white/10 pt-5"><p className="text-[10px] font-black uppercase tracking-[.15em] text-white/40">Activité accessible</p><p className="mt-2 text-3xl font-black">{totalDiscussions}</p><p className="mt-1 text-xs text-white/55">discussion{totalDiscussions === 1 ? '' : 's'} dans vos espaces</p></div>
            </aside>

            <div className="overflow-hidden rounded-[28px] border border-[#DDEBE8] bg-white">
              {loading ? Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-24 animate-pulse border-b border-[#E8F1EF] p-5 last:border-0"><div className="h-full rounded-xl bg-[#F1F6F5]" /></div>) : error ? (
                <div className="p-10 text-center"><ShieldCheck size={30} className="mx-auto text-slate-300" /><p className="mt-3 text-sm text-red-600">{error}</p></div>
              ) : visibleCourses.length === 0 ? (
                <div className="p-12 text-center"><BookOpen size={34} className="mx-auto text-slate-300" /><h2 className="mt-4 text-lg font-black text-[#002050]">{search ? 'Aucune formation correspondante' : 'Aucun forum disponible'}</h2><p className="mt-2 text-sm text-slate-500">{search ? 'Modifiez la recherche depuis l’en-tête.' : 'Les forums apparaîtront ici lorsque votre compte aura accès à une formation disposant d’un espace de discussion.'}</p></div>
              ) : visibleCourses.map((course, index) => {
                const meta = accessMeta(course.access_type); const AccessIcon = meta.icon;
                return <Link key={course.id} to={`/forum/cours/${course.id}`} className={`group grid gap-4 px-5 py-5 transition hover:bg-[#F8FCFB] md:grid-cols-[46px_1fr_auto] md:items-center ${index ? 'border-t border-[#E8F1EF]' : ''}`}>
                  <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${meta.tone}`}><AccessIcon size={18} /></span>
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm font-black text-[#002050]">{course.title}</strong><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-500">{meta.label}</span></div><div className="mt-2 flex flex-wrap gap-4 text-xs font-semibold text-slate-400"><span className="inline-flex items-center gap-1"><MessageSquare size={13} /> {Number(course.discussions_count || 0)} discussion{Number(course.discussions_count || 0) === 1 ? '' : 's'}</span><span className="inline-flex items-center gap-1"><CheckCircle2 size={13} /> {Number(course.unresolved_count || 0)} ouverte{Number(course.unresolved_count || 0) === 1 ? '' : 's'}</span></div></div>
                  <span className="inline-flex items-center gap-2 text-xs font-black text-[#0F766E]">Ouvrir <ArrowRight size={14} className="transition group-hover:translate-x-1" /></span>
                </Link>;
              })}
            </div>
          </div>
        </section>
      </main>
    </CommunityLayout>
  );
}
