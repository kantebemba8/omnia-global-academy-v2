import { getSessionToken } from '../lib/session';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import CommunityLayout from '../components/community/CommunityLayout';
import {
  Activity,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  CircleDot,
  Flag,
  Globe2,
  GraduationCap,
  MessageCircle,
  MessageSquare,
  Mic2,
  Network,
  Orbit,
  Radio,
  ShieldCheck,
  Sparkles,
  Target,
  UsersRound,
  Waves,
} from 'lucide-react';
import { ENDPOINTS } from '../lib/config';
import { COUNTRIES as COUNTRY_OPTIONS } from '../lib/countries';
import { edgeAuthHeaders, edgeGatewayHeaders } from '../lib/edgeAuth';
import { useAuth } from '../hooks/useAuth';
import { resolveCommunityAudience, type CommunityAudience } from '../lib/communityNavigation';

const BLUE = '#002050';
const TEAL = '#0F766E';
const GOLD = '#BF8813';
const BORDER = '#DDEBE8';
const COUNTRIES = COUNTRY_OPTIONS.map(country => ({ code: country.code, name: country.label }));

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
  unresolved_count?: number;
};

type ModeratedPost = {
  id: string;
  title?: string | null;
  content?: string;
  author_name?: string;
  flagged_reason?: string;
  created_at?: string;
};

type Copy = {
  eyebrow: string;
  title: string;
  accent: string;
  description: string;
  primary: { label: string; path: string };
  secondary: { label: string; path: string };
  focusTitle: string;
  focusDescription: string;
  visual: 'network' | 'path' | 'board' | 'org' | 'signals' | 'wave' | 'circle' | 'trust';
};

const COPY: Record<Exclude<CommunityAudience, 'super_admin'>, Copy> = {
  public: {
    eyebrow: 'UN RÉSEAU QUI FAIT CIRCULER LES BONNES RÉPONSES',
    title: 'Les idées deviennent plus utiles',
    accent: 'quand elles circulent.',
    description: 'Omnia Communauté relie questions, expériences, pratiques et solutions sans transformer la plateforme en réseau social bruyant.',
    primary: { label: 'Explorer les échanges', path: '/forum/echanges' },
    secondary: { label: 'Ouvrir l’espace général', path: '/forum/general' },
    focusTitle: 'Trouver le bon espace avant de publier',
    focusDescription: 'Les échanges généraux restent ouverts à la communauté. Les forums de formation restent réservés aux personnes qui ont réellement accès au cours.',
    visual: 'network',
  },
  apprenant: {
    eyebrow: 'ENTRAIDE & PROGRESSION',
    title: 'Une question ne doit pas',
    accent: 'bloquer votre progression.',
    description: 'Retrouvez les échanges utiles à votre apprentissage, les questions encore ouvertes et les forums directement liés à vos formations.',
    primary: { label: 'Voir mes forums de formation', path: '/forum/formations' },
    secondary: { label: 'Poser une question générale', path: '/forum/general' },
    focusTitle: 'Débloquer la prochaine étape',
    focusDescription: 'Vos forums de formation et les discussions sans réponse remontent ici pour vous aider à continuer plutôt que chercher au hasard.',
    visual: 'path',
  },
  professeur: {
    eyebrow: 'COMMUNAUTÉ DE PRATIQUE PÉDAGOGIQUE',
    title: 'Transformez les questions',
    accent: 'en apprentissage collectif.',
    description: 'Repérez les questions qui ont besoin d’une réponse, suivez les échanges de vos formations et mettez en avant les solutions réellement utiles.',
    primary: { label: 'Ouvrir mes forums', path: '/forum/formations' },
    secondary: { label: 'Voir l’espace général', path: '/forum/general' },
    focusTitle: 'Questions à transformer en solutions',
    focusDescription: 'Les discussions non résolues et les espaces dont vous êtes formateur sont prioritaires dans votre lecture de la Communauté.',
    visual: 'board',
  },
  structure: {
    eyebrow: 'COMMUNAUTÉ DE PRATIQUES',
    title: 'Faites circuler les pratiques',
    accent: 'au-delà d’une équipe.',
    description: 'La Communauté prolonge les formations et permet à vos membres de partager questions, retours d’expérience et solutions dans un cadre commun.',
    primary: { label: 'Voir les échanges', path: '/forum/echanges' },
    secondary: { label: 'Forums de formation', path: '/forum/formations' },
    focusTitle: 'Faire remonter les sujets utiles',
    focusDescription: 'Les discussions récentes et les forums liés aux formations deviennent un signal complémentaire du développement des compétences.',
    visual: 'org',
  },
  recruteur: {
    eyebrow: 'SIGNAUX DU TERRAIN PROFESSIONNEL',
    title: 'Écoutez ce que les talents',
    accent: 'partagent vraiment.',
    description: 'Les échanges donnent du contexte aux compétences et aux parcours. Ici, vous observez les sujets qui animent la communauté sans mélanger sourcing et discussion.',
    primary: { label: 'Lire les discussions', path: '/forum/general' },
    secondary: { label: 'Voir tous les espaces', path: '/forum/echanges' },
    focusTitle: 'Lire les signaux, pas seulement les profils',
    focusDescription: 'Les conversations récentes montrent les sujets, difficultés et pratiques qui mobilisent réellement les membres de la plateforme.',
    visual: 'signals',
  },
  organisateur: {
    eyebrow: 'LA CONVERSATION APRÈS LE DIRECT',
    title: 'Le Live se termine.',
    accent: 'La conversation continue.',
    description: 'Utilisez la Communauté pour prolonger les échanges, faire émerger des questions et orienter les participants vers des discussions durables.',
    primary: { label: 'Ouvrir les échanges', path: '/forum/general' },
    secondary: { label: 'Voir tous les espaces', path: '/forum/echanges' },
    focusTitle: 'Prolonger ce qui mérite une suite',
    focusDescription: 'Les sujets récents vous aident à voir quelles conversations peuvent continuer au-delà d’un événement ou d’une session Live.',
    visual: 'wave',
  },
  coach: {
    eyebrow: 'RÉFLEXION & CONTINUITÉ',
    title: 'Entre deux séances,',
    accent: 'la réflexion peut continuer.',
    description: 'La Communauté offre un espace d’entraide complémentaire au coaching : questions, expériences et réponses utiles restent accessibles dans le temps.',
    primary: { label: 'Explorer les discussions', path: '/forum/general' },
    secondary: { label: 'Forums de formation', path: '/forum/formations' },
    focusTitle: 'Nourrir la réflexion sans dupliquer le coaching',
    focusDescription: 'Les sujets ouverts peuvent devenir des ressources utiles à recommander lorsque l’entraide collective suffit mieux qu’une séance individuelle.',
    visual: 'circle',
  },
  moderateur: {
    eyebrow: 'TRUST & SAFETY COMMUNAUTAIRE',
    title: 'Une communauté saine se pilote',
    accent: 'par les bons signaux.',
    description: 'Consultez le flux public, repérez les contenus signalés et accédez à la modération sans mélanger l’expérience communautaire et la file de décision.',
    primary: { label: 'Ouvrir la modération', path: '/moderator/forum' },
    secondary: { label: 'Voir la Communauté', path: '/forum/general' },
    focusTitle: 'Traiter ce qui perturbe la confiance',
    focusDescription: 'Les contenus signalés remontent ici comme un signal opérationnel, tandis que les discussions normales restent dans leur contexte d’origine.',
    visual: 'trust',
  },
};

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
  if (post.author_avatar_url) return <img src={post.author_avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />;
  return <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0F766E] text-xs font-bold text-white">{post.author_initials || '?'}</span>;
}

function HeroVisual({ mode, flagged }: { mode: Copy['visual']; flagged: number }) {
  if (mode === 'path') return (
    <div className="relative min-h-[350px] overflow-hidden rounded-[34px] bg-[#082B38] shadow-[0_32px_70px_rgba(0,32,80,.22)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_18%,rgba(15,118,110,.55),transparent_30%),radial-gradient(circle_at_18%_84%,rgba(191,136,19,.18),transparent_30%)]" />
      <div className="absolute left-[14%] top-[18%] h-[64%] w-[3px] rounded-full bg-white/10" />
      {[['Question', '18%'], ['Réponses', '45%'], ['Solution', '72%']].map(([label, top], index) => (
        <div key={label} className="absolute left-[10%] flex items-center gap-4" style={{ top }}>
          <span className={`flex h-10 w-10 items-center justify-center rounded-full border ${index === 2 ? 'border-emerald-300 bg-emerald-300 text-[#082B38]' : 'border-white/20 bg-white/10 text-white'}`}>{index === 0 ? <MessageCircle size={17} /> : index === 1 ? <UsersRound size={17} /> : <CheckCircle2 size={17} />}</span>
          <div><p className="text-[10px] font-black uppercase tracking-[.15em] text-white/45">Étape {index + 1}</p><strong className="mt-1 block text-sm text-white">{label}</strong></div>
        </div>
      ))}
      <div className="absolute bottom-6 right-6 max-w-[48%] rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur"><p className="text-xs font-semibold leading-5 text-white/75">Votre progression peut reprendre dès qu’une réponse utile apparaît.</p></div>
    </div>
  );
  if (mode === 'board') return (
    <div className="relative min-h-[350px] overflow-hidden rounded-[34px] bg-[#10264A] p-7 shadow-[0_32px_70px_rgba(0,32,80,.22)]">
      <div className="absolute right-[-8%] top-[-12%] h-56 w-56 rounded-full bg-[#0F766E]/25 blur-3xl" />
      <div className="relative grid h-full gap-3 pt-6">
        {[['Question ouverte', 'Comment valider cette étape du module ?', '4 réponses'], ['Discussion active', 'Retour d’expérience sur la mise en pratique', '9 réponses'], ['Solution validée', 'Méthode partagée par le formateur', 'Résolu']].map(([eyebrow, title, meta], index) => (
          <div key={eyebrow} className="relative rounded-2xl border border-white/10 bg-white/[.08] p-4 backdrop-blur" style={{ marginLeft: `${index * 10}px` }}>
            <div className="flex items-center justify-between gap-3"><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#7CD4C6]">{eyebrow}</p><span className="text-[10px] font-bold text-white/40">{meta}</span></div>
            <p className="mt-2 text-sm font-bold text-white">{title}</p>
          </div>
        ))}
      </div>
    </div>
  );
  if (mode === 'org') return (
    <div className="relative min-h-[350px] overflow-hidden rounded-[34px] bg-[#062E35] shadow-[0_32px_70px_rgba(0,32,80,.22)]">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.04)_1px,transparent_1px)] bg-[size:42px_42px]" />
      <div className="absolute left-1/2 top-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[28px] border border-[#75D2C5]/30 bg-[#0F766E]/30 text-white backdrop-blur"><Network size={34} /></div>
      {[[22,26,'Équipe'],[72,22,'Formation'],[18,74,'Pratique'],[76,72,'Solution']].map(([left,top,label],index)=><div key={label} className="absolute" style={{left:`${left}%`,top:`${top}%`}}><span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur"><UsersRound size={19}/></span><span className="mt-2 block -translate-x-2 text-[10px] font-black uppercase tracking-[.12em] text-white/50">{label}</span><div className="absolute h-px w-24 origin-left bg-white/10" style={{transform:`rotate(${index%2?155:25}deg)`,left:index%2?0:50,top:28}}/></div>)}
    </div>
  );
  if (mode === 'signals') return (
    <div className="relative min-h-[350px] overflow-hidden rounded-[34px] bg-[#141F37] p-7 shadow-[0_32px_70px_rgba(0,32,80,.22)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_90%_10%,rgba(118,80,111,.45),transparent_34%)]" />
      <p className="relative text-[10px] font-black uppercase tracking-[.16em] text-[#C7A6BE]">Signaux de conversation</p>
      <div className="relative mt-7 space-y-3">{['Compétences recherchées', 'Transition professionnelle', 'Pratiques terrain'].map((label,index)=><div key={label} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-white/10 py-4"><span className="h-2.5 w-2.5 rounded-full" style={{background:index===1?GOLD:'#7EBDB6'}}/><span className="text-sm font-bold text-white">{label}</span><span className="text-xs text-white/40">{[12,8,5][index]} échanges</span></div>)}</div>
      <div className="absolute bottom-7 right-7 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white"><Activity size={24}/></div>
    </div>
  );
  if (mode === 'wave') return (
    <div className="relative min-h-[350px] overflow-hidden rounded-[34px] bg-[#101C46] shadow-[0_32px_70px_rgba(0,32,80,.22)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_25%,rgba(92,85,200,.48),transparent_33%)]" />
      <div className="absolute left-[8%] right-[8%] top-1/2 flex -translate-y-1/2 items-center gap-2">{Array.from({length:34}).map((_,index)=><span key={index} className="w-1 rounded-full bg-[#8D86EC]/70" style={{height:`${18+Math.abs(Math.sin(index*.72))*86}px`}}/>)}</div>
      <div className="absolute left-6 top-6 flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.14em] text-white/70"><Radio size={13}/> après le direct</div>
      <div className="absolute bottom-6 right-6 rounded-2xl border border-white/10 bg-[#101C46]/70 p-4 text-white backdrop-blur"><MessageSquare size={22}/><p className="mt-3 text-xs font-black">Du signal à la discussion</p></div>
    </div>
  );
  if (mode === 'circle') return (
    <div className="relative min-h-[350px] overflow-hidden rounded-[34px] bg-[#073840] shadow-[0_32px_70px_rgba(0,32,80,.22)]">
      {[74,56,38].map((size,index)=><div key={size} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border" style={{width:`${size}%`,height:`${size}%`,borderColor:`rgba(126,211,198,${.16+index*.08})`}}/>)}
      <div className="absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#0F766E] text-white shadow-[0_16px_40px_rgba(15,118,110,.35)]"><Orbit size={28}/></div>
      {[['Question',18,28],['Expérience',72,22],['Réponse',76,72],['Perspective',18,72]].map(([label,left,top])=><div key={String(label)} className="absolute rounded-full border border-white/12 bg-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-[.12em] text-white/70 backdrop-blur" style={{left:`${left}%`,top:`${top}%`}}>{label}</div>)}
    </div>
  );
  if (mode === 'trust') return (
    <div className="relative min-h-[350px] overflow-hidden rounded-[34px] bg-[#172338] p-7 shadow-[0_32px_70px_rgba(0,32,80,.22)]">
      <div className="flex items-center justify-between"><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#F1B36C]">File de confiance</p><ShieldCheck size={22} className="text-[#F1B36C]"/></div>
      <div className="mt-7 space-y-3">{[['Signalé','Contenu à examiner',flagged],['Contexte','Discussion d’origine',''],['Décision','Masquer · restaurer · libérer','']].map(([label,text,value],index)=><div key={String(label)} className={`grid grid-cols-[46px_1fr_auto] items-center gap-3 rounded-2xl border p-4 ${index===0&&flagged?'border-amber-400/30 bg-amber-400/10':'border-white/10 bg-white/[.06]'}`}><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white">{index===0?<Flag size={16}/>:index===1?<MessageCircle size={16}/>:<ShieldCheck size={16}/>}</span><span><strong className="block text-sm text-white">{label}</strong><span className="mt-1 block text-xs text-white/45">{text}</span></span>{value!==''?<strong className="text-2xl text-[#F1B36C]">{String(value)}</strong>:null}</div>)}</div>
    </div>
  );
  return (
    <div className="relative min-h-[350px] overflow-hidden rounded-[34px] bg-[#062E35] shadow-[0_32px_70px_rgba(0,32,80,.22)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_22%,rgba(15,118,110,.52),transparent_32%),radial-gradient(circle_at_18%_82%,rgba(191,136,19,.18),transparent_30%)]" />
      <div className="absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[28px] border border-white/15 bg-white/10 text-white backdrop-blur"><MessageSquare size={28}/></div>
      {[[22,23],[74,20],[18,70],[78,72],[48,13]].map(([left,top],index)=><div key={index} className="absolute flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/80 backdrop-blur" style={{left:`${left}%`,top:`${top}%`}}>{index%2?<UsersRound size={17}/>:<MessageCircle size={17}/>}</div>)}
      <div className="absolute left-[29%] top-[31%] h-px w-[22%] rotate-[18deg] bg-white/10"/><div className="absolute right-[27%] top-[31%] h-px w-[22%] -rotate-[18deg] bg-white/10"/><div className="absolute bottom-[27%] left-[29%] h-px w-[24%] -rotate-[16deg] bg-white/10"/><div className="absolute bottom-[25%] right-[26%] h-px w-[24%] rotate-[16deg] bg-white/10"/>
    </div>
  );
}

export default function Forum() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const search = (searchParams.get('search') || '').trim();
  const preview = searchParams.get('preview') === 'true' && Boolean(user?.roles?.includes('super_admin'));
  const resolved = resolveCommunityAudience(user?.roles, preview ? searchParams.get('role') : null);
  const audience: Exclude<CommunityAudience, 'super_admin'> = resolved === 'super_admin' ? 'public' : resolved;
  const copy = COPY[audience];
  const [country, setCountry] = useState('');
  const [generalTotal, setGeneralTotal] = useState(0);
  const [recentPosts, setRecentPosts] = useState<CommunityPost[]>([]);
  const [unansweredPosts, setUnansweredPosts] = useState<CommunityPost[]>([]);
  const [courses, setCourses] = useState<AccessibleCourse[]>([]);
  const [flaggedPosts, setFlaggedPosts] = useState<ModeratedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const token = getSessionToken() || '';
  const isLoggedIn = Boolean(token);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('omnia_user') || '{}');
      if (stored?.country_code) setCountry(stored.country_code);
    } catch { /* keep default */ }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const headers = token ? edgeAuthHeaders() : edgeGatewayHeaders();
      const encodedSearch = search ? `&search=${encodeURIComponent(search)}` : '';
      const generalUrl = `${ENDPOINTS.forumPostsList}&space=general&country_code=${country}&limit=${search ? 16 : 8}${encodedSearch}`;
      const unansweredUrl = `${ENDPOINTS.forumPostsList}&space=general&country_code=${country}&sort=unanswered&limit=5${encodedSearch}`;
      const promises: Promise<Record<string, unknown>>[] = [
        fetch(generalUrl, { headers }).then(response => response.json()).catch(() => ({})),
        fetch(unansweredUrl, { headers }).then(response => response.json()).catch(() => ({})),
      ];
      if (token && !preview) promises.push(fetch(ENDPOINTS.forumAccessibleCourses, { headers }).then(response => response.json()).catch(() => ({})));
      const [general, unanswered, courseData] = await Promise.all(promises);
      if (cancelled) return;
      setRecentPosts(Array.isArray(general?.posts) ? general.posts as CommunityPost[] : []);
      setGeneralTotal(Number(general?.total || 0));
      setUnansweredPosts(Array.isArray(unanswered?.posts) ? unanswered.posts as CommunityPost[] : []);
      setCourses(Array.isArray(courseData?.courses) ? courseData.courses as AccessibleCourse[] : []);
      if (audience === 'moderateur' && token && !preview) {
        try {
          const response = await fetch(ENDPOINTS.moderatorForumAction, { headers: edgeAuthHeaders() });
          const data = await response.json();
          if (!cancelled) setFlaggedPosts(Array.isArray(data?.flagged_posts) ? data.flagged_posts : []);
        } catch {
          if (!cancelled) setFlaggedPosts([]);
        }
      } else setFlaggedPosts([]);
      setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [audience, country, preview, search, token]);

  const countryName = useMemo(() => COUNTRIES.find(item => item.code === country)?.name || 'Tous les pays', [country]);
  const unresolvedCourses = useMemo(() => courses.reduce((sum, course) => sum + Number(course.unresolved_count || 0), 0), [courses]);
  const courseDiscussions = useMemo(() => courses.reduce((sum, course) => sum + Number(course.discussions_count || 0), 0), [courses]);
  const showPrivateSummary = isLoggedIn && !preview && audience !== 'public';

  const metrics = useMemo(() => {
    if (audience === 'professeur') return [
      ['Forums suivis', courses.filter(course => course.access_type === 'instructor').length],
      ['Questions ouvertes', unresolvedCourses],
      ['Discussions générales', generalTotal],
      ['Réponses à explorer', unansweredPosts.length],
    ];
    if (audience === 'moderateur') return [
      ['Signalés', flaggedPosts.length],
      ['Discussions visibles', generalTotal],
      ['Questions ouvertes', unansweredPosts.length],
      ['Forums accessibles', courses.length],
    ];
    if (audience === 'apprenant') return [
      ['Forums de formation', courses.length],
      ['Discussions de cours', courseDiscussions],
      ['Questions ouvertes', unresolvedCourses],
      ['Espace général', generalTotal],
    ];
    return [
      ['Discussions récentes', recentPosts.length],
      ['Espace général', generalTotal],
      ['Questions ouvertes', unansweredPosts.length],
      ['Forums accessibles', courses.length],
    ];
  }, [audience, courseDiscussions, courses, flaggedPosts.length, generalTotal, recentPosts.length, unansweredPosts.length, unresolvedCourses]);

  const focus = useMemo(() => {
    if (audience === 'professeur' && unresolvedCourses > 0) return { title: `${unresolvedCourses} question${unresolvedCourses > 1 ? 's' : ''} de formation à faire avancer`, text: 'Les questions non résolues de vos espaces pédagogiques méritent une réponse ou une orientation claire.', path: '/forum/formations', label: 'Ouvrir mes forums', icon: GraduationCap };
    if (audience === 'apprenant' && courses.length > 0) return { title: `${courses.length} forum${courses.length > 1 ? 's' : ''} lié${courses.length > 1 ? 's' : ''} à vos formations`, text: 'Vos questions de cours restent dans le contexte du programme, avec les personnes réellement autorisées à répondre.', path: '/forum/formations', label: 'Voir mes forums', icon: BookOpen };
    if (audience === 'moderateur' && flaggedPosts.length > 0) return { title: `${flaggedPosts.length} contenu${flaggedPosts.length > 1 ? 's' : ''} signalé${flaggedPosts.length > 1 ? 's' : ''}`, text: 'La file de modération contient des publications qui nécessitent une vérification de contexte.', path: '/moderator/forum', label: 'Traiter la file', icon: Flag };
    if (audience === 'organisateur' && recentPosts.length > 0) return { title: 'Des conversations peuvent prolonger vos événements', text: 'Les discussions récentes donnent une indication des sujets qui méritent davantage d’échanges après un Live.', path: '/forum/general', label: 'Lire le flux', icon: Radio };
    if (audience === 'coach' && unansweredPosts.length > 0) return { title: `${unansweredPosts.length} question${unansweredPosts.length > 1 ? 's' : ''} sans réponse dans le flux`, text: 'Certaines questions peuvent bénéficier d’une réponse collective avant de devenir un besoin d’accompagnement individuel.', path: '/forum/general', label: 'Explorer les questions', icon: Target };
    if (audience === 'recruteur' && recentPosts.length > 0) return { title: 'Le flux révèle les sujets qui mobilisent les membres', text: 'Lisez les échanges pour compléter votre compréhension du terrain sans transformer la Communauté en outil de sourcing.', path: '/forum/general', label: 'Observer le flux', icon: Activity };
    if (audience === 'structure' && recentPosts.length > 0) return { title: 'Les échanges deviennent une mémoire de pratique', text: 'Les discussions récentes peuvent compléter vos formations en faisant circuler les questions et solutions au-delà d’un groupe.', path: '/forum/general', label: 'Voir les échanges', icon: Network };
    return { title: copy.focusTitle, text: copy.focusDescription, path: copy.primary.path, label: copy.primary.label, icon: Sparkles };
  }, [audience, copy, courses.length, flaggedPosts.length, recentPosts.length, unansweredPosts.length, unresolvedCourses]);

  const FocusIcon = focus.icon;

  return (
    <CommunityLayout>
      <main className="bg-[#F8FCFB]">
        {search && (
          <div className="border-b border-[#DDEBE8] bg-[#E8F6F3] px-5 py-3 text-sm text-[#0B5F59]">
            Résultats pour <strong>« {search} »</strong> dans Omnia Communauté.
          </div>
        )}

        <section className="overflow-hidden border-b border-[#DDEBE8] bg-white">
          <div className="mx-auto grid max-w-[1440px] gap-10 px-4 py-12 sm:px-5 md:py-16 lg:grid-cols-[1.04fr_.96fr] lg:px-6 lg:py-20">
            <div className="self-center">
              <p className="text-[11px] font-black uppercase tracking-[.2em] text-[#0F766E]">{copy.eyebrow}</p>
              <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[1.03] tracking-[-.045em] text-[#002050] md:text-6xl">
                {copy.title} <span className="text-[#0F766E]">{copy.accent}</span>
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 md:text-lg">{copy.description}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to={withPreview(copy.primary.path, searchParams)} className="inline-flex items-center gap-2 rounded-xl bg-[#002050] px-5 py-3 text-sm font-black text-white shadow-[0_12px_24px_rgba(0,32,80,.14)]">{copy.primary.label}<ArrowRight size={16} /></Link>
                <Link to={withPreview(copy.secondary.path, searchParams)} className="inline-flex items-center gap-2 rounded-xl border border-[#CFE3DF] bg-white px-5 py-3 text-sm font-black text-[#002050]">{copy.secondary.label}</Link>
              </div>
            </div>
            <HeroVisual mode={copy.visual} flagged={flaggedPosts.length} />
          </div>
        </section>

        {showPrivateSummary && (
          <section className="border-b border-[#DDEBE8] bg-white">
            <div className="mx-auto grid max-w-[1440px] grid-cols-2 px-4 sm:px-5 md:grid-cols-4 lg:px-6">
              {metrics.map(([label, value], index) => (
                <div key={label} className={`py-5 ${index % 2 === 0 ? 'pr-5' : 'pl-5'} md:border-l md:border-[#E7F0EE] md:px-6 md:first:border-l-0`}>
                  <p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">{label}</p>
                  <p className="mt-1 text-2xl font-black tracking-[-.03em] text-[#002050]">{String(value)}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mx-auto max-w-[1440px] px-4 py-12 sm:px-5 lg:px-6">
          <div className="grid gap-6 lg:grid-cols-[.78fr_1.22fr]">
            <aside className="rounded-[28px] border border-[#DDEBE8] bg-white p-6 md:p-7">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E8F6F3] text-[#0F766E]"><FocusIcon size={20} /></div>
              <p className="mt-5 text-[10px] font-black uppercase tracking-[.16em] text-[#0F766E]">Priorité selon votre rôle</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-.03em] text-[#002050]">{focus.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-500">{focus.text}</p>
              <Link to={withPreview(focus.path, searchParams)} className="mt-6 inline-flex items-center gap-2 text-sm font-black text-[#0F766E]">{focus.label}<ArrowRight size={15} /></Link>
              <div className="mt-8 border-t border-[#E8F1EF] pt-5">
                <div className="flex items-center justify-between gap-3">
                  <div><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Communauté locale</p><p className="mt-1 text-sm font-bold text-[#002050]">{countryName}</p></div>
                  <Globe2 size={20} className="text-[#0F766E]" />
                </div>
                <select value={country} onChange={event => setCountry(event.target.value)} className="mt-3 w-full rounded-xl border border-[#DDEBE8] bg-[#F8FCFB] px-3 py-2.5 text-sm font-semibold text-[#002050] outline-none">
                  <option value="">Tous les pays</option>
                  {COUNTRIES.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}
                </select>
              </div>
            </aside>

            <div className="rounded-[28px] border border-[#DDEBE8] bg-white p-6 md:p-8">
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#E8F1EF] pb-5">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#0F766E]">Flux communautaire</p>
                  <h2 className="mt-2 text-2xl font-black tracking-[-.03em] text-[#002050]">{search ? 'Discussions correspondant à votre recherche' : 'Ce qui se dit maintenant'}</h2>
                </div>
                <Link to={withPreview('/forum/general', searchParams)} className="text-xs font-black text-[#0F766E]">Tout l’espace général</Link>
              </div>
              <div className="divide-y divide-[#E8F1EF]">
                {loading ? Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-24 animate-pulse py-4"><div className="h-full rounded-xl bg-[#F1F6F5]" /></div>) : recentPosts.length === 0 ? (
                  <div className="py-12 text-center"><MessageCircle size={30} className="mx-auto text-slate-300" /><p className="mt-3 text-sm text-slate-500">Aucune discussion à afficher pour le moment.</p></div>
                ) : recentPosts.slice(0, search ? 12 : 7).map(post => <PostRow key={post.id} post={post} params={searchParams} />)}
              </div>
            </div>
          </div>

          {showPrivateSummary && courses.length > 0 && (
            <section className="mt-10 border-y border-[#DDEBE8] bg-white">
              <div className="grid lg:grid-cols-[.72fr_1.28fr]">
                <div className="border-b border-[#DDEBE8] p-6 md:p-8 lg:border-b-0 lg:border-r">
                  <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#0F766E]">Forums de formation</p>
                  <h2 className="mt-2 text-2xl font-black tracking-[-.03em] text-[#002050]">Des conversations qui restent liées au contexte pédagogique.</h2>
                  <p className="mt-3 text-sm leading-7 text-slate-500">Vous ne voyez ici que les formations auxquelles votre compte a réellement accès comme apprenant, formateur ou modérateur.</p>
                  <Link to={withPreview('/forum/formations', searchParams)} className="mt-5 inline-flex items-center gap-2 text-sm font-black text-[#0F766E]">Voir tous mes forums <ArrowRight size={15} /></Link>
                </div>
                <div className="divide-y divide-[#E8F1EF]">
                  {courses.slice(0, 5).map(course => (
                    <Link key={course.id} to={withPreview(`/forum/cours/${course.id}`, searchParams)} className="grid gap-3 px-6 py-5 transition hover:bg-[#F8FCFB] sm:grid-cols-[1fr_auto] sm:items-center">
                      <div><div className="flex items-center gap-2"><BookOpen size={16} className="text-[#0F766E]" /><strong className="text-sm text-[#002050]">{course.title}</strong></div><p className="mt-2 text-xs text-slate-500">{Number(course.discussions_count || 0)} discussion{Number(course.discussions_count || 0) === 1 ? '' : 's'} · {course.access_type === 'instructor' ? 'Formateur' : course.access_type === 'moderation' ? 'Modération' : 'Apprenant'}</p></div>
                      <div className="flex items-center gap-3"><span className="text-xs font-bold text-slate-400">{Number(course.unresolved_count || 0)} ouverte{Number(course.unresolved_count || 0) === 1 ? '' : 's'}</span><ArrowRight size={15} className="text-[#0F766E]" /></div>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          )}

          {audience === 'moderateur' && flaggedPosts.length > 0 && !preview && (
            <section className="mt-10 rounded-[28px] border border-amber-200 bg-[#FFF9F0] p-6 md:p-8">
              <div className="flex items-center justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-amber-700">File de confiance</p><h2 className="mt-2 text-2xl font-black text-[#002050]">Contenus signalés à examiner</h2></div><Link to="/moderator/forum" className="text-xs font-black text-amber-700">Ouvrir la modération</Link></div>
              <div className="mt-6 divide-y divide-amber-200/70 border-y border-amber-200/70">{flaggedPosts.slice(0,4).map(post=><div key={post.id} className="grid gap-2 py-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><strong className="text-sm text-[#002050]">{post.title || post.content || 'Publication signalée'}</strong><p className="mt-1 text-xs text-slate-500">{post.author_name || 'Membre'}{post.flagged_reason ? ` · ${post.flagged_reason}` : ''}</p></div><Flag size={16} className="text-amber-700"/></div>)}</div>
            </section>
          )}

          {!showPrivateSummary && (
            <section id="regles" className="mt-10 overflow-hidden rounded-[28px] border border-[#DDEBE8] bg-white">
              <div className="grid lg:grid-cols-[.72fr_1.28fr]">
                <div className="bg-[#083F43] p-7 text-white md:p-9"><ShieldCheck size={28} className="text-[#7FD3C6]"/><h2 className="mt-5 text-2xl font-black">Utile, respectueuse et sûre.</h2><p className="mt-3 text-sm leading-7 text-white/65">La valeur de la Communauté vient de la qualité des échanges, pas de leur volume.</p></div>
                <div className="grid gap-px bg-[#DDEBE8] sm:grid-cols-2">{[[CheckCircle2,'Contexte clair','Expliquez suffisamment la situation pour recevoir une réponse utile.'],[UsersRound,'Respect des membres','Aucun harcèlement, spam ou divulgation d’informations privées.'],[Sparkles,'Solutions visibles','Les réponses réellement utiles peuvent être mises en avant.'],[ShieldCheck,'Signalement disponible','Les contenus problématiques peuvent être signalés et modérés.']].map(([Icon,title,text]: any)=><div key={title} className="bg-white p-6"><Icon size={19} className="text-[#0F766E]"/><h3 className="mt-4 text-sm font-black text-[#002050]">{title}</h3><p className="mt-2 text-xs leading-5 text-slate-500">{text}</p></div>)}</div>
              </div>
            </section>
          )}
        </section>
      </main>
    </CommunityLayout>
  );
}

function PostRow({ post, params }: { post: CommunityPost; params: URLSearchParams }) {
  return (
    <Link to={withPreview(`/forum/post/${post.id}`, params)} className="group grid gap-3 py-5 sm:grid-cols-[44px_1fr_auto] sm:items-start">
      <PostAvatar post={post} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400"><span className="font-bold text-slate-500">{post.author_name}</span>{post.author_badge && <span className="rounded-full bg-[#E8F6F3] px-2 py-0.5 font-black text-[#0F766E]">{post.author_badge}</span>}<span>{relativeTime(post.created_at)}</span>{post.is_solved && <span className="inline-flex items-center gap-1 font-bold text-emerald-700"><CheckCircle2 size={11}/> Résolu</span>}</div>
        <h3 className="mt-1 line-clamp-2 text-[15px] font-black text-[#002050] transition group-hover:text-[#0F766E]">{post.title}</h3>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{post.content}</p>
      </div>
      <div className="flex items-center gap-3 text-[11px] font-bold text-slate-400 sm:pt-1"><span className="inline-flex items-center gap-1"><MessageSquare size={13}/>{post.replies_count}</span><span>{post.likes_count} utile{post.likes_count===1?'':'s'}</span><ArrowRight size={14} className="text-[#0F766E] opacity-0 transition group-hover:translate-x-1 group-hover:opacity-100"/></div>
    </Link>
  );
}
