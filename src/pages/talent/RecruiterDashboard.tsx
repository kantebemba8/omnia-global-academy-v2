import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight, Briefcase, CalendarDays, CheckCircle2, FileText, Heart,
  Mail, MapPin, MessageSquare, Plus, Search, Settings, UserRound, UsersRound,
} from 'lucide-react';
import { RecruiterLayout } from '../../components/talent/RecruiterLayout';
import { loadPublicJobs, loadPublicTalents, PublicJob, PublicTalent } from './talentApi';
import { getStoredUser } from '../../lib/session';

const BLUE = '#002050';
const GOLD = '#BF8813';
const BORDER = '#E4E7EC';

type User = { id?: string; full_name?: string; email?: string; phone_number?: string; roles?: string[] };
type Section = 'dashboard'|'offres'|'talents'|'favoris'|'candidatures'|'entretiens'|'messages'|'profil'|'parametres';

type Favorite = { id: string; name: string; title?: string; location?: string; photo_url?: string };

function sectionFromPath(path: string): Section {
  const last = path.split('/').filter(Boolean).pop() || 'dashboard';
  return (['dashboard','offres','talents','favoris','candidatures','entretiens','messages','profil','parametres'].includes(last) ? last : 'dashboard') as Section;
}

function EmptyState({ icon: Icon, title, text, action }: { icon: React.ElementType; title: string; text: string; action?: React.ReactNode }) {
  return <div className="rounded-xl border bg-white px-6 py-12 text-center" style={{ borderColor: BORDER }}><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-50"><Icon size={22} color={GOLD} /></div><h2 className="mt-4 text-base font-semibold" style={{ color: BLUE }}>{title}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">{text}</p>{action && <div className="mt-5">{action}</div>}</div>;
}

export default function RecruiterDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const section = sectionFromPath(location.pathname);
  const [user] = useState<User | null>(() => getStoredUser<User>());
  const [talents, setTalents] = useState<PublicTalent[]>([]);
  const [jobs, setJobs] = useState<PublicJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [favorites, setFavorites] = useState<Favorite[]>(() => {
    try { return JSON.parse(localStorage.getItem('omnia_recruiter_favorites') || '[]'); } catch { return []; }
  });

  useEffect(() => {
    const roles = user?.roles || [];
    if (!user) { navigate('/connexion'); return; }
    if (!roles.includes('recruteur') && !roles.includes('super_admin')) navigate('/talent/recruteurs');
  }, [user, navigate]);

  useEffect(() => {
    let alive = true;
    Promise.allSettled([loadPublicTalents(), loadPublicJobs()]).then(results => {
      if (!alive) return;
      if (results[0].status === 'fulfilled') setTalents(results[0].value); else setError('Les profils publics ne sont pas disponibles pour le moment.');
      if (results[1].status === 'fulfilled') setJobs(results[1].value);
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  function toggleFavorite(t: PublicTalent) {
    const next = favorites.some(f => f.id === t.id)
      ? favorites.filter(f => f.id !== t.id)
      : [...favorites, { id: t.id, name: t.full_name, title: t.professional_title, location: t.location || t.country, photo_url: t.photo_url }];
    setFavorites(next);
    localStorage.setItem('omnia_recruiter_favorites', JSON.stringify(next));
  }

  const filteredTalents = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return talents;
    return talents.filter(t => [t.full_name,t.professional_title,t.location,t.country,...(t.skills||[]),...(t.sectors||[])].filter(Boolean).join(' ').toLowerCase().includes(q));
  }, [talents, query]);

  const titleMap: Record<Section,string> = {
    dashboard:'Tableau de bord recruteur', offres:'Mes offres', talents:'Rechercher des talents', favoris:'Talents favoris', candidatures:'Candidatures', entretiens:'Entretiens', messages:'Messages', profil:'Profil recruteur', parametres:'Paramètres',
  };

  return <RecruiterLayout title={titleMap[section]} subtitle="Espace recruteur indépendant · Talent Omnia">
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
      {section === 'dashboard' && <DashboardHome user={user} talents={talents} jobs={jobs} favorites={favorites} loading={loading} />}
      {section === 'talents' && <TalentsSection talents={filteredTalents} loading={loading} error={error} query={query} setQuery={setQuery} favorites={favorites} toggleFavorite={toggleFavorite} />}
      {section === 'favoris' && <FavoritesSection favorites={favorites} />}
      {section === 'offres' && <EmptyState icon={Briefcase} title="Aucune offre publiée" text="Vos offres de recrutement apparaîtront ici dès leur création. La publication et la persistance seront reliées au backend lors de l’étape Synchronisation Supabase." action={<button className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white" style={{ background: BLUE }}><Plus size={16}/>Créer une offre</button>} />}
      {section === 'candidatures' && <EmptyState icon={FileText} title="Aucune candidature reçue" text="Les candidatures liées à vos offres seront centralisées ici avec leur statut réel." />}
      {section === 'entretiens' && <EmptyState icon={CalendarDays} title="Aucun entretien programmé" text="Les entretiens confirmés apparaîtront ici après la connexion du calendrier et des candidatures." />}
      {section === 'messages' && <EmptyState icon={MessageSquare} title="Aucun message" text="Les conversations avec les talents seront disponibles ici. Aucune conversation fictive n’est affichée." />}
      {section === 'profil' && <ProfileSection user={user} />}
      {section === 'parametres' && <SettingsSection />}
    </div>
  </RecruiterLayout>;
}

function DashboardHome({ user, talents, jobs, favorites, loading }: { user: User|null; talents: PublicTalent[]; jobs: PublicJob[]; favorites: Favorite[]; loading: boolean }) {
  const metrics = [
    { label:'Offres actives', value: jobs.length, icon:Briefcase },
    { label:'Talents publics', value: talents.length, icon:UsersRound },
    { label:'Talents favoris', value:favorites.length, icon:Heart },
    { label:'Entretiens à venir', value:0, icon:CalendarDays },
  ];
  return <>
    <div><h2 className="text-2xl font-semibold" style={{ color: BLUE }}>Bienvenue, {user?.full_name?.split(' ')[0] || 'Recruteur'}</h2><p className="mt-1 text-sm text-gray-500">Voici un aperçu réel de votre activité de recrutement.</p></div>
    <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(m=><div key={m.label} className="rounded-xl border bg-white p-5" style={{ borderColor:BORDER }}><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">{m.label}</p><p className="mt-2 text-2xl font-semibold" style={{ color:BLUE }}>{loading?'—':m.value}</p></div><div className="rounded-lg p-3" style={{ background:'rgba(191,136,19,.10)' }}><m.icon size={20} color={GOLD}/></div></div></div>)}</div>
    <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_.7fr]">
      <div className="rounded-xl border bg-white p-5" style={{ borderColor:BORDER }}><div className="flex items-center justify-between"><h3 className="font-semibold" style={{ color:BLUE }}>Talents récemment visibles</h3><Link to="/talent/recruteur/talents" className="text-sm font-semibold" style={{ color:GOLD }}>Voir tous</Link></div>{talents.length===0?<p className="mt-6 text-sm text-gray-500">Aucun profil public disponible.</p>:<div className="mt-4 divide-y">{talents.slice(0,4).map(t=><Link key={t.id} to={`/talent/profil/${t.id}`} className="flex items-center gap-3 py-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold" style={{ color:BLUE }}>{t.full_name.slice(0,2).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold" style={{ color:BLUE }}>{t.full_name}</p><p className="truncate text-xs text-gray-500">{t.professional_title || 'Profil professionnel'}{t.location ? ` · ${t.location}` : ''}</p></div><ArrowRight size={16} className="text-gray-400"/></Link>)}</div>}</div>
      <div className="rounded-xl border bg-white p-5" style={{ borderColor:BORDER }}><h3 className="font-semibold" style={{ color:BLUE }}>Actions rapides</h3><div className="mt-4 space-y-2">{[
        ['/talent/recruteur/talents','Rechercher des talents',Search],['/talent/recruteur/offres','Créer une offre',Plus],['/talent/recruteur/favoris','Voir mes favoris',Heart],
      ].map(([path,label,Icon]:any)=><Link key={path} to={path} className="flex items-center gap-3 rounded-lg border px-3 py-3 text-sm font-medium" style={{ borderColor:BORDER,color:BLUE }}><Icon size={17} color={GOLD}/><span className="flex-1">{label}</span><ArrowRight size={15}/></Link>)}</div></div>
    </div>
  </>;
}

function TalentsSection({ talents, loading, error, query, setQuery, favorites, toggleFavorite }: any) {
  return <><div className="flex flex-col gap-3 sm:flex-row"><label className="relative flex-1"><Search className="absolute left-3 top-3 text-gray-400" size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Métier, compétence, secteur, pays…" className="w-full rounded-lg border bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:ring-2" style={{ borderColor:BORDER }}/></label><select className="rounded-lg border bg-white px-3 py-2.5 text-sm" style={{ borderColor:BORDER }}><option>Toutes les disponibilités</option><option>Disponible immédiatement</option><option>En poste</option><option>Freelance</option></select></div>
    {error&&<div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{error}</div>}
    {loading?<p className="mt-8 text-sm text-gray-500">Chargement des profils publics…</p>:talents.length===0?<div className="mt-6"><EmptyState icon={UsersRound} title="Aucun talent trouvé" text="Aucun profil public ne correspond à votre recherche."/></div>:<div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{talents.map((t:PublicTalent)=>{const fav=favorites.some((f:Favorite)=>f.id===t.id);return <article key={t.id} className="rounded-xl border bg-white p-5" style={{ borderColor:BORDER }}><div className="flex gap-3"><div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-gray-100 font-semibold" style={{ color:BLUE }}>{t.photo_url?<img src={t.photo_url} alt="" className="h-full w-full object-cover"/>:t.full_name.slice(0,2).toUpperCase()}</div><div className="min-w-0 flex-1"><h3 className="truncate font-semibold" style={{ color:BLUE }}>{t.full_name}</h3><p className="truncate text-sm text-gray-500">{t.professional_title || 'Profil professionnel'}</p></div><button onClick={()=>toggleFavorite(t)} className="rounded-lg p-2" aria-label="Favori"><Heart size={18} fill={fav?GOLD:'none'} color={fav?GOLD:'#98A2B3'}/></button></div>{(t.location||t.country)&&<p className="mt-4 flex items-center gap-2 text-xs text-gray-500"><MapPin size={14}/>{t.location||t.country}</p>}<div className="mt-4 flex flex-wrap gap-2">{(t.skills||[]).slice(0,4).map(s=><span key={s} className="rounded-full bg-gray-50 px-2.5 py-1 text-xs text-gray-600">{s}</span>)}</div><div className="mt-5 flex gap-2"><Link to={`/talent/profil/${t.id}`} className="flex-1 rounded-lg px-3 py-2 text-center text-sm font-semibold text-white" style={{ background:BLUE }}>Voir le profil</Link>{t.contact_enabled&&<button className="rounded-lg border px-3 py-2" style={{ borderColor:BORDER,color:GOLD }}><Mail size={17}/></button>}</div></article>})}</div>}</>;
}

function FavoritesSection({ favorites }: { favorites: Favorite[] }) {
  if (!favorites.length) return <EmptyState icon={Heart} title="Aucun talent favori" text="Ajoutez des profils depuis la recherche pour les retrouver ici." action={<Link to="/talent/recruteur/talents" className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white" style={{ background:BLUE }}><Search size={16}/>Rechercher</Link>}/>;
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{favorites.map(f=><Link key={f.id} to={`/talent/profil/${f.id}`} className="rounded-xl border bg-white p-5" style={{ borderColor:BORDER }}><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 font-semibold" style={{ color:BLUE }}>{f.name.slice(0,2).toUpperCase()}</div><div><p className="font-semibold" style={{ color:BLUE }}>{f.name}</p><p className="text-sm text-gray-500">{f.title||'Profil professionnel'}</p></div></div></Link>)}</div>;
}

function ProfileSection({ user }: { user: User|null }) {
  return <div className="grid gap-6 lg:grid-cols-[1fr_.7fr]"><section className="rounded-xl border bg-white p-6" style={{ borderColor:BORDER }}><div className="flex items-center gap-3"><UserRound color={GOLD}/><h2 className="font-semibold" style={{ color:BLUE }}>Informations du recruteur</h2></div><dl className="mt-6 grid gap-5 sm:grid-cols-2"><div><dt className="text-xs text-gray-500">Nom complet</dt><dd className="mt-1 text-sm font-medium">{user?.full_name||'Non renseigné'}</dd></div><div><dt className="text-xs text-gray-500">Email</dt><dd className="mt-1 text-sm font-medium">{user?.email||'Non renseigné'}</dd></div><div><dt className="text-xs text-gray-500">Téléphone</dt><dd className="mt-1 text-sm font-medium">{user?.phone_number||'Non renseigné'}</dd></div><div><dt className="text-xs text-gray-500">Statut</dt><dd className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-green-700"><CheckCircle2 size={15}/>Compte connecté</dd></div></dl><button className="mt-6 rounded-lg border px-4 py-2.5 text-sm font-semibold" style={{ borderColor:BORDER,color:BLUE }}>Modifier mon profil</button></section><section className="rounded-xl border bg-white p-6" style={{ borderColor:BORDER }}><h2 className="font-semibold" style={{ color:BLUE }}>Vérification</h2><p className="mt-3 text-sm leading-6 text-gray-500">La vérification de l’entreprise et la validation Super Admin seront connectées lors de l’étape Supabase et permissions.</p></section></div>;
}

function SettingsSection() {
  return <div className="space-y-5"><section className="rounded-xl border bg-white p-6" style={{ borderColor:BORDER }}><div className="flex items-center gap-3"><Settings color={GOLD}/><h2 className="font-semibold" style={{ color:BLUE }}>Préférences recruteur</h2></div><div className="mt-5 space-y-4">{['Notifications de nouvelles candidatures','Rappels d’entretien','Alertes nouveaux talents correspondant à mes recherches'].map(label=><label key={label} className="flex items-center justify-between border-b border-gray-100 pb-4 text-sm"><span>{label}</span><input type="checkbox" className="h-4 w-4" defaultChecked/></label>)}</div></section></div>;
}
