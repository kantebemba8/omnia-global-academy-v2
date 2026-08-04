import { getSessionToken } from '../lib/session';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import CommunityLayout from '../components/community/CommunityLayout';
import { PageFooter } from '../components/PageFooter';
import {
  ArrowRight,
  BookOpen as BookOpenCheck,
  Briefcase as BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  Globe2,
  GraduationCap,
  MessageCircle as MessageCircleQuestion,
  MessageSquare as MessagesSquare,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import { ENDPOINTS } from '../lib/config';
import { edgeAuthHeaders, edgeGatewayHeaders } from '../lib/edgeAuth';

const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E5E7EB';

const COUNTRIES = [
  { code: 'ML', name: 'Mali' }, { code: 'SN', name: 'Sénégal' }, { code: 'CI', name: "Côte d'Ivoire" },
  { code: 'BF', name: 'Burkina Faso' }, { code: 'GN', name: 'Guinée' }, { code: 'TG', name: 'Togo' },
  { code: 'BJ', name: 'Bénin' }, { code: 'NE', name: 'Niger' }, { code: 'CM', name: 'Cameroun' },
  { code: 'GH', name: 'Ghana' }, { code: 'NG', name: 'Nigeria' }, { code: 'MA', name: 'Maroc' },
  { code: 'DZ', name: 'Algérie' }, { code: 'TN', name: 'Tunisie' }, { code: 'CD', name: 'RD Congo' },
  { code: 'FR', name: 'France' }, { code: 'BE', name: 'Belgique' }, { code: 'LU', name: 'Luxembourg' },
  { code: 'CA', name: 'Canada' }, { code: 'US', name: 'États-Unis' },
];

type CommunityPost = {
  id: string;
  title: string;
  content: string;
  space: 'general' | 'carriere' | 'cours';
  author_name: string;
  author_initials: string;
  author_avatar_url?: string | null;
  author_badge?: string | null;
  replies_count: number;
  likes_count: number;
  is_solved: boolean;
  created_at: string;
};

type AccessibleCourse = {
  id: string;
  title: string;
  access_type: 'learner' | 'instructor' | 'moderation';
  discussions_count?: number;
};

type CommunityStats = {
  general: number;
  carriere: number;
  jobs: number;
  courses: number;
};

function relativeTime(iso: string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `il y a ${Math.max(1, minutes)} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `il y a ${days} j`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function PostAvatar({ post }: { post: CommunityPost }) {
  if (post.author_avatar_url) {
    return <img src={post.author_avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />;
  }
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: BLUE }}>
      {post.author_initials || '?'}
    </span>
  );
}

export default function Forum() {
  const [country, setCountry] = useState('ML');
  const [stats, setStats] = useState<CommunityStats>({ general: 0, carriere: 0, jobs: 0, courses: 0 });
  const [recentPosts, setRecentPosts] = useState<CommunityPost[]>([]);
  const [unansweredPosts, setUnansweredPosts] = useState<CommunityPost[]>([]);
  const [courses, setCourses] = useState<AccessibleCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const token = getSessionToken() || '';
  const isLoggedIn = Boolean(token);

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem('omnia_user') || '{}');
      if (user?.country_code) setCountry(user.country_code);
    } catch { /* keep the default country */ }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const headers = token ? edgeAuthHeaders() : edgeGatewayHeaders();
      const generalUrl = `${ENDPOINTS.forumPostsList}&space=general&country_code=${country}&limit=4`;
      const careerUrl = `${ENDPOINTS.forumPostsList}&space=carriere&country_code=${country}&limit=4`;
      const unansweredUrl = `${ENDPOINTS.forumPostsList}&space=general&country_code=${country}&sort=unanswered&limit=4`;
      const promises: Promise<unknown>[] = [
        fetch(generalUrl, { headers }).then(response => response.json()).catch(() => ({})),
        fetch(careerUrl, { headers }).then(response => response.json()).catch(() => ({})),
        fetch(unansweredUrl, { headers }).then(response => response.json()).catch(() => ({})),
        fetch(`${ENDPOINTS.jobsList}?limit=1`, { headers: edgeGatewayHeaders() }).then(response => response.json()).catch(() => ({})),
      ];
      if (token) {
        promises.push(fetch(ENDPOINTS.forumAccessibleCourses, { headers }).then(response => response.json()).catch(() => ({})));
      }
      const [general, career, unanswered, jobs, courseData] = await Promise.all(promises) as Array<Record<string, unknown>>;
      if (cancelled) return;
      const generalPosts = Array.isArray(general?.posts) ? general.posts as CommunityPost[] : [];
      const careerPosts = Array.isArray(career?.posts) ? career.posts as CommunityPost[] : [];
      const merged = [...generalPosts, ...careerPosts]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 6);
      const accessibleCourses = Array.isArray(courseData?.courses) ? courseData.courses as AccessibleCourse[] : [];
      setRecentPosts(merged);
      setUnansweredPosts(Array.isArray(unanswered?.posts) ? unanswered.posts as CommunityPost[] : []);
      setCourses(accessibleCourses);
      setStats({
        general: Number(general?.total || 0),
        carriere: Number(career?.total || 0),
        jobs: Number(jobs?.total || 0),
        courses: accessibleCourses.length,
      });
      setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [country, token]);

  const countryName = useMemo(() => COUNTRIES.find(item => item.code === country)?.name || country, [country]);

  return (
    <CommunityLayout>
      <div className="min-h-screen bg-white">
        <section className="border-b border-slate-100 bg-white px-4 pb-10 pt-8 md:px-8 md:pb-14 md:pt-12">
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.2fr_.8fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em]" style={{ borderColor: 'rgba(191,136,19,.28)', color: GOLD, background: 'rgba(191,136,19,.06)' }}>
                <UsersRound size={15} /> Communauté d'apprentissage et d'opportunités
              </div>
              <h1 className="mt-5 max-w-3xl text-4xl font-black leading-tight md:text-6xl" style={{ color: BLUE }}>
                Grandir ensemble dans <span style={{ color: GOLD }}>Omnia Communauté</span>
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 md:text-lg">
                Posez vos questions, partagez vos expériences, échangez avec les formateurs et découvrez les opportunités professionnelles de l'écosystème Omnia.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link to={`/forum/general?country_code=${country}`} className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white" style={{ background: BLUE }}>
                  Rejoindre l'espace général <ArrowRight size={17} />
                </Link>
                <Link to="/forum/formations" className="inline-flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-bold" style={{ borderColor: BORDER, color: BLUE }}>
                  Mes forums de formation <BookOpenCheck size={17} />
                </Link>
                <Link to="/emploi" className="inline-flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-bold" style={{ borderColor: BORDER, color: BLUE }}>
                  Carrière & emploi <BriefcaseBusiness size={17} />
                </Link>
              </div>
            </div>

            <div className="rounded-3xl border bg-gradient-to-br from-slate-50 via-white to-amber-50 p-5 shadow-sm" style={{ borderColor: BORDER }}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: GOLD }}>Communauté locale</p>
                  <p className="mt-1 text-xl font-bold" style={{ color: BLUE }}>{countryName}</p>
                </div>
                <Globe2 size={26} color={GOLD} />
              </div>
              <div className="relative mt-4">
                <select value={country} onChange={event => setCountry(event.target.value)} className="w-full appearance-none rounded-xl border bg-white px-4 py-3 pr-10 text-sm font-semibold outline-none" style={{ borderColor: BORDER, color: BLUE }}>
                  {COUNTRIES.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}
                </select>
                <ChevronDown size={17} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">Les discussions générales et carrière sont organisées par pays. Les forums de formation restent liés à vos cours.</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <Metric value={stats.general} label="Discussions générales" icon={MessagesSquare} />
                <Metric value={stats.carriere} label="Questions carrière" icon={GraduationCap} />
                <Metric value={stats.jobs} label="Offres disponibles" icon={BriefcaseBusiness} />
                <Metric value={stats.courses} label="Forums accessibles" icon={BookOpenCheck} />
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-12 md:px-8">
          <div className="mx-auto max-w-6xl">
            <SectionHeader eyebrow="Explorer" title="Tous les espaces de la communauté" subtitle="Chaque espace a un objectif clair et conserve ses propres règles d'accès." />
            <div className="mt-7 grid gap-5 lg:grid-cols-3">
              <SpacePanel icon={MessageCircleQuestion} title="Espace général" description="Entraide, apprentissage, orientation et échanges entre membres de la communauté." stat={`${stats.general} discussion${stats.general === 1 ? '' : 's'}`} to={`/forum/general?country_code=${country}`} action="Ouvrir l'espace" />
              <SpacePanel icon={BriefcaseBusiness} title="Carrière & emploi" description="Offres professionnelles, conseils de candidature et échanges sur le développement de carrière." stat={`${stats.jobs} offre${stats.jobs === 1 ? '' : 's'} disponible${stats.jobs === 1 ? '' : 's'}`} to="/emploi" action="Voir les opportunités" secondary={{ to: '/forum/carriere', label: 'Poser une question carrière' }} />
              <SpacePanel icon={BookOpenCheck} title="Forums des formations" description="Questions et réponses rattachées aux formations auxquelles vous avez réellement accès." stat={isLoggedIn ? `${stats.courses} forum${stats.courses === 1 ? '' : 's'} accessible${stats.courses === 1 ? '' : 's'}` : 'Connexion requise'} to={isLoggedIn ? '/forum/formations' : '/connexion'} action={isLoggedIn ? 'Voir mes forums' : 'Se connecter'} />
            </div>
          </div>
        </section>

        <section className="border-y border-slate-100 bg-slate-50/60 px-4 py-12 md:px-8">
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.4fr_.6fr]">
            <div>
              <SectionHeader eyebrow="Activité" title="Discussions récentes" subtitle="Les publications les plus récentes dans l'espace général et les conseils carrière." />
              <div className="mt-6 space-y-3">
                {loading ? <LoadingRows /> : recentPosts.length === 0 ? <EmptyPanel text="Aucune discussion récente dans cette communauté." /> : recentPosts.map(post => <PostRow key={post.id} post={post} />)}
              </div>
            </div>
            <div>
              <SectionHeader eyebrow="Entraide" title="Questions sans réponse" subtitle="Une contribution utile peut débloquer le parcours d'un autre membre." />
              <div className="mt-6 space-y-3">
                {loading ? <LoadingRows count={3} /> : unansweredPosts.length === 0 ? <EmptyPanel text="Aucune question en attente pour le moment." /> : unansweredPosts.slice(0, 4).map(post => <PostRow key={post.id} post={post} compact />)}
              </div>
            </div>
          </div>
        </section>

        {isLoggedIn && (
          <section className="px-4 py-12 md:px-8">
            <div className="mx-auto max-w-6xl">
              <SectionHeader eyebrow="Vos apprentissages" title="Forums de vos formations" subtitle="Retrouvez les espaces réservés à vos formations, avec les questions, réponses et solutions validées." action={{ to: '/forum/formations', label: 'Voir tous mes forums' }} />
              <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {courses.length === 0 ? (
                  <div className="md:col-span-2 lg:col-span-3"><EmptyPanel text="Aucun forum de formation n'est disponible pour votre compte." action={{ to: '/catalogue', label: 'Explorer le catalogue' }} /></div>
                ) : courses.slice(0, 6).map(course => (
                  <Link key={course.id} to={`/forum/cours/${course.id}`} className="rounded-2xl border bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md" style={{ borderColor: BORDER }}>
                    <div className="flex items-start justify-between gap-3">
                      <BookOpenCheck size={22} color={GOLD} />
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">{course.access_type === 'learner' ? 'Apprenant' : course.access_type === 'instructor' ? 'Formateur' : 'Modération'}</span>
                    </div>
                    <h3 className="mt-4 line-clamp-2 text-base font-bold" style={{ color: BLUE }}>{course.title}</h3>
                    <p className="mt-2 text-xs text-slate-500">{Number(course.discussions_count || 0)} discussion{Number(course.discussions_count || 0) === 1 ? '' : 's'}</p>
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold" style={{ color: BLUE }}>Accéder au forum <ArrowRight size={15} /></span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        <section id="regles" className="border-t border-slate-100 bg-white px-4 py-12 md:px-8">
          <div className="mx-auto max-w-6xl rounded-3xl border p-6 md:p-8" style={{ borderColor: BORDER, background: 'linear-gradient(135deg, rgba(0,32,80,.035), rgba(191,136,19,.055))' }}>
            <div className="grid gap-8 lg:grid-cols-[.75fr_1.25fr] lg:items-center">
              <div>
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm"><ShieldCheck size={24} color={GOLD} /></div>
                <h2 className="mt-4 text-2xl font-black" style={{ color: BLUE }}>Une communauté utile, respectueuse et sûre</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">Les échanges sont conçus pour favoriser l'apprentissage, l'entraide et les opportunités professionnelles. Les contenus peuvent être signalés et modérés.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Rule icon={CheckCircle2} title="Partagez des informations utiles" text="Précisez le contexte de vos questions et valorisez les réponses qui vous ont aidé." />
                <Rule icon={UsersRound} title="Respectez chaque membre" text="Aucun harcèlement, discrimination, spam ou divulgation d'informations privées." />
                <Rule icon={Sparkles} title="Mettez en avant les solutions" text="Dans les forums de formation, marquez la réponse qui résout réellement la question." />
                <Rule icon={ShieldCheck} title="Signalez les abus" text="Le signalement et le blocage sont disponibles depuis chaque discussion." />
              </div>
            </div>
          </div>
        </section>

        <PageFooter />
      </div>
    </CommunityLayout>
  );
}

function Metric({ value, label, icon: Icon }: { value: number; label: string; icon: typeof MessagesSquare }) {
  return (
    <div className="rounded-2xl border bg-white p-3" style={{ borderColor: BORDER }}>
      <div className="flex items-center justify-between"><Icon size={16} color={GOLD} /><strong className="text-lg" style={{ color: BLUE }}>{value}</strong></div>
      <p className="mt-2 text-[11px] leading-4 text-slate-500">{label}</p>
    </div>
  );
}

function SectionHeader({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle: string; action?: { to: string; label: string } }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: GOLD }}>{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-black md:text-3xl" style={{ color: BLUE }}>{title}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{subtitle}</p>
      </div>
      {action && <Link to={action.to} className="inline-flex items-center gap-1 text-sm font-bold" style={{ color: BLUE }}>{action.label}<ArrowRight size={16} /></Link>}
    </div>
  );
}

function SpacePanel({ icon: Icon, title, description, stat, to, action, secondary }: { icon: typeof MessagesSquare; title: string; description: string; stat: string; to: string; action: string; secondary?: { to: string; label: string } }) {
  return (
    <article className="flex min-h-[280px] flex-col rounded-3xl border bg-white p-6 shadow-sm" style={{ borderColor: BORDER }}>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: 'rgba(191,136,19,.09)' }}><Icon size={23} color={GOLD} /></div>
      <h3 className="mt-5 text-xl font-black" style={{ color: BLUE }}>{title}</h3>
      <p className="mt-2 flex-1 text-sm leading-6 text-slate-500">{description}</p>
      <p className="mt-4 text-xs font-semibold text-slate-400">{stat}</p>
      <Link to={to} className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white" style={{ background: BLUE }}>{action}<ArrowRight size={15} /></Link>
      {secondary && <Link to={secondary.to} className="mt-3 text-center text-xs font-semibold" style={{ color: GOLD }}>{secondary.label}</Link>}
    </article>
  );
}

function PostRow({ post, compact = false }: { post: CommunityPost; compact?: boolean }) {
  return (
    <Link to={`/forum/post/${post.id}`} className="flex items-start gap-3 rounded-2xl border bg-white p-4 transition hover:border-amber-300 hover:shadow-sm" style={{ borderColor: BORDER }}>
      <PostAvatar post={post} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">{post.author_name}</span>
          {post.author_badge && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold" style={{ color: GOLD }}>{post.author_badge}</span>}
          <span className="text-[11px] text-slate-400">{relativeTime(post.created_at)}</span>
        </div>
        <h3 className={`mt-1 font-bold ${compact ? 'line-clamp-2 text-sm' : 'line-clamp-2 text-[15px]'}`} style={{ color: BLUE }}>{post.title}</h3>
        {!compact && <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{post.content}</p>}
        <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-400">
          <span>{post.space === 'carriere' ? 'Conseils carrière' : 'Espace général'}</span>
          <span>{post.replies_count} réponse{post.replies_count === 1 ? '' : 's'}</span>
          <span>{post.likes_count} utile{post.likes_count === 1 ? '' : 's'}</span>
        </div>
      </div>
    </Link>
  );
}

function Rule({ icon: Icon, title, text }: { icon: typeof ShieldCheck; title: string; text: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4" style={{ borderColor: BORDER }}>
      <Icon size={18} color={GOLD} />
      <h3 className="mt-3 text-sm font-bold" style={{ color: BLUE }}>{title}</h3>
      <p className="mt-1 text-xs leading-5 text-slate-500">{text}</p>
    </div>
  );
}

function LoadingRows({ count = 4 }: { count?: number }) {
  return <>{Array.from({ length: count }).map((_, index) => <div key={index} className="h-24 animate-pulse rounded-2xl border bg-white" style={{ borderColor: BORDER }} />)}</>;
}

function EmptyPanel({ text, action }: { text: string; action?: { to: string; label: string } }) {
  return (
    <div className="rounded-2xl border border-dashed bg-white p-8 text-center" style={{ borderColor: BORDER }}>
      <MessageCircleQuestion size={28} className="mx-auto text-slate-300" />
      <p className="mt-3 text-sm text-slate-500">{text}</p>
      {action && <Link to={action.to} className="mt-4 inline-flex items-center gap-1 text-sm font-bold" style={{ color: BLUE }}>{action.label}<ArrowRight size={15} /></Link>}
    </div>
  );
}
