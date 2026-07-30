import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Brain, Code, Shield, TrendingUp, DollarSign, Scale, Megaphone, Heart,
  Building2, GraduationCap, Globe, Leaf, Compass, TreePine, Smile, Wrench,
  ChefHat, Shirt, Bird, Palette, Music, Gamepad2, Award, Monitor, Users,
  Check, MessageCircle, type LucideIcon,
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { PageFooter } from '../components/PageFooter';
import { CourseCard, type CourseCardData } from '../components/CourseCard';
import { ENDPOINTS } from '../lib/config';

const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// ── Types ────────────────────────────────────────────────────────────────────
interface Pilier { icon: string; title: string; desc: string }
interface LandingData {
  hero: { title_fr: string; subtitle_fr: string };
stats: { formations: string | null; apprenants: string | null; pays: string | null; formateurs: string | null; etablissements: string | null };
  stats_visibility: { formations: boolean; apprenants: boolean; pays: boolean; formateurs: boolean; etablissements: boolean };
  piliers: Pilier[];
  featured_courses: CourseCardData[];
  devenir_formateur: { title_fr: string; desc_fr: string };
  fintech_logos: string[];
  social_networks: Record<string, string | null>;
  app_downloads: { google_play?: string | null; app_store?: string | null };
  collaborations_logos: Array<{ name: string; file_url: string; link?: string | null }>;
  public_partners?: Array<{ id:string; name:string; category:string; logo_url?:string|null; website_url?:string|null; description?:string|null; is_featured?:boolean }>;
  follow_us_label_fr: string;
  category_counts: Record<string, number>;
}

// ── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES: { label: string; icon: LucideIcon }[] = [
  { label: 'Data & IA',      icon: Brain },
  { label: 'Informatique',   icon: Code },
  { label: 'Cybersécurité',  icon: Shield },
  { label: 'Business',       icon: TrendingUp },
  { label: 'Finance',        icon: DollarSign },
  { label: 'Droit',          icon: Scale },
  { label: 'Marketing',      icon: Megaphone },
  { label: 'Santé',          icon: Heart },
  { label: 'Architecture',   icon: Building2 },
  { label: 'Éducation',      icon: GraduationCap },
  { label: 'Langues',        icon: Globe },
  { label: 'Agriculture',    icon: Leaf },
  { label: 'Tourisme',       icon: Compass },
  { label: 'Environnement',  icon: TreePine },
  { label: 'Bien-être',      icon: Smile },
  { label: 'Artisanat',      icon: Wrench },
  { label: 'Cuisine',        icon: ChefHat },
  { label: 'Mode',           icon: Shirt },
  { label: 'Élevage',        icon: Bird },
  { label: 'Arts',           icon: Palette },
  { label: 'Musique',        icon: Music },
  { label: 'Loisirs',        icon: Gamepad2 },
];

const PILIER_ICON_MAP: Record<string, LucideIcon> = {
  Award, Monitor, Globe, Users, Shield, TrendingUp, Check, Brain,
};

const FINTECH_OPERATORS = ['Wave', 'Orange Money', 'MTN Mobile Money', 'Moov Money', 'Free Money'];

const DEFAULT: LandingData = {
  hero: {
    title_fr: 'Formez-vous, certifiez-vous, transformez votre avenir',
    subtitle_fr: "Des formations certifiées CPD, accessibles partout en Afrique de l'Ouest, payables par Mobile Money.",
  },
stats: { formations: null, apprenants: null, pays: null, formateurs: null, etablissements: null },
  stats_visibility: { formations: false, apprenants: false, pays: false, formateurs: false, etablissements: false },
  piliers: [
    { icon: 'Award',   title: 'Certifications CPD internationales',  desc: 'Reconnues mondialement, valorisables sur LinkedIn en un clic' },
    { icon: 'Monitor', title: 'Mode éco-data',                       desc: "Apprenez même avec une connexion limitée — optimisé pour l'Afrique de l'Ouest" },
    { icon: 'Globe',   title: 'Paiement Mobile Money',               desc: 'Wave, Orange Money, MTN, Moov et toutes les solutions locales africaines' },
    { icon: 'Users',   title: 'Communauté africaine',                desc: "Rejoignez des milliers d'apprenants et formateurs à travers le continent" },
  ],
  featured_courses: [],
  devenir_formateur: {
    title_fr: "Partagez votre savoir avec l'Afrique",
    desc_fr: "Créez des formations certifiées, touchez des milliers d'apprenants et générez des revenus depuis chez vous.",
  },
  fintech_logos: [],
  social_networks: {},
  app_downloads: {},
  collaborations_logos: [],
  public_partners: [],
  follow_us_label_fr: 'Suivez-nous',
  category_counts: {},
};

// ── Page ─────────────────────────────────────────────────────────────────────
export function LandingPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<LandingData>(DEFAULT);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetch(ENDPOINTS.landingData, { headers: { Authorization: `Bearer ${ANON_KEY}` } })
      .then(r => r.json())
      .then(d => setData({ ...DEFAULT, ...d }))
      .catch(() => {/* keep default */});
  }, []);

  useEffect(() => {
    fetch(ENDPOINTS.siteSettings, { headers: { Authorization: `Bearer ${ANON_KEY}` } })
      .then(r => r.json())
      .then(d => setData(prev => ({ ...prev, public_partners: Array.isArray(d.public_partners) ? d.public_partners : [] })))
      .catch(() => {});
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) navigate(`/catalogue?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#FFFFFF' }}>
      <Navbar />

      {/* ── SECTION 2 : HERO ─────────────────────────────────────────── */}
      <section
        className="px-6 pb-16 pt-28 md:pb-20 md:pt-32"
        style={{ background: 'linear-gradient(135deg, #00183E 0%, #002A67 64%, #173E75 100%)' }}
      >
        <div className="mx-auto max-w-6xl">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#E8C76E]">
            <Award size={17} /> Formation, compétences et opportunités
          </div>

          <h1
            className="mt-4 max-w-4xl font-bold leading-tight text-white"
            style={{ fontSize: 'clamp(34px,5vw,64px)', lineHeight: 1.08 }}
          >
            {data.hero.title_fr}
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-blue-100 sm:text-lg">
            {data.hero.subtitle_fr}
          </p>

          <form onSubmit={handleSearch} className="mt-8 flex max-w-2xl flex-col gap-3 sm:flex-row">
            <div className="flex flex-1 items-center gap-3 rounded-xl border border-white/20 bg-white px-4">
              <Search size={18} className="shrink-0 text-slate-400" />
              <input
                className="flex-1 bg-transparent py-3.5 text-sm text-slate-900 outline-none"
                placeholder="Rechercher une formation..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="rounded-xl px-6 py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#BF8813' }}
            >
              Rechercher
            </button>
          </form>

          {([
            ['formations', 'Formations'],
            ['apprenants', 'Apprenants'],
            ['pays', 'Pays'],
            ['formateurs', 'Formateurs'],
            ['etablissements', 'Structures partenaires'],
          ] as [keyof typeof data.stats, string][])
            .filter(([key]) => data.stats[key] !== null && data.stats_visibility[key as keyof typeof data.stats_visibility])
            .length > 0 && (
            <div className="mt-9 flex flex-wrap gap-x-8 gap-y-4 text-blue-50">
              {([
                ['formations', 'Formations'],
                ['apprenants', 'Apprenants'],
                ['pays', 'Pays'],
                ['formateurs', 'Formateurs'],
                ['etablissements', 'Structures partenaires'],
              ] as [keyof typeof data.stats, string][])
                .filter(([key]) => data.stats[key] !== null && data.stats_visibility[key as keyof typeof data.stats_visibility])
                .map(([key, label]) => (
                  <div key={key}>
                    <p className="text-2xl font-bold text-white">{data.stats[key]}</p>
                    <p className="mt-1 text-xs text-blue-200">{label}</p>
                  </div>
                ))}
            </div>
          )}
        </div>
      </section>

      {/* ── SECTION 3 : FINTECH STRIP ────────────────────────────────── */}
      <section className="px-6 py-5" style={{ backgroundColor: '#F8F9FA', borderTop: '1px solid #E4E7EC', borderBottom: '1px solid #E4E7EC' }}>
        <div className="max-w-6xl mx-auto">
          <p className="text-center mb-4" style={{ color: '#6B7280', fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            Payez avec vos solutions habituelles
          </p>
          <div className="flex flex-wrap justify-center items-center gap-6">
            {(data.fintech_logos?.length > 0)
              ? data.fintech_logos.map((url, i) => (
                  <img key={i} src={url} alt="logo" style={{ height: '28px', objectFit: 'contain', filter: 'grayscale(100%)', opacity: 0.6 }} />
                ))
              : FINTECH_OPERATORS.map(op => (
                  <span
                    key={op}
                    className="text-sm font-semibold transition-colors cursor-default hover:text-[#002050]"
                    style={{ color: '#9CA3AF' }}
                  >
                    {op}
                  </span>
                ))
            }
          </div>
        </div>
      </section>

      {/* ── SECTION 4 : PILIERS ──────────────────────────────────────── */}
      <section className="px-6 py-16 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-center font-bold mb-10" style={{ color: '#002050', fontSize: '26px' }}>
            Pourquoi choisir Omnia Global Academy ?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {data.piliers.map((p, i) => {
              const Icon = PILIER_ICON_MAP[p.icon] ?? Award;
              return (
                <div
                  key={i}
                  className="flex flex-col gap-3 p-7 rounded-xl"
                  style={{ border: '1px solid #E4E7EC', backgroundColor: '#FFFFFF' }}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(191,136,19,0.10)' }}
                  >
                    <Icon size={24} style={{ color: '#BF8813' }} />
                  </div>
                  <p className="font-bold text-sm" style={{ color: '#002050' }}>{p.title}</p>
                  <p className="text-xs leading-relaxed" style={{ color: '#6B7280' }}>{p.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── SECTION 5 : CATÉGORIES ───────────────────────────────────── */}
      <section className="px-6 py-16" style={{ backgroundColor: '#F8F9FA', borderTop: '1px solid #E4E7EC' }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h2 className="font-bold" style={{ color: '#002050', fontSize: '24px' }}>Catégories populaires</h2>
            <button
              onClick={() => navigate('/catalogue')}
              className="text-sm font-semibold transition-opacity hover:opacity-70"
              style={{ color: '#BF8813' }}
            >
              Voir toutes les catégories →
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {CATEGORIES.map(({ label, icon: Icon }) => {
              const count = data.category_counts?.[label];
              return (
                <div
                  key={label}
                  onClick={() => navigate(`/catalogue?categorie=${encodeURIComponent(label)}`)}
                  className="flex flex-col items-center gap-2.5 py-4 px-2 rounded-xl cursor-pointer transition-all hover:shadow-sm"
                  style={{ border: '1px solid #E4E7EC', backgroundColor: '#FFFFFF' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#BF8813'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#E4E7EC'; }}
                >
                  <Icon size={26} style={{ color: '#BF8813' }} />
                  <p className="text-xs font-semibold text-center" style={{ color: '#002050' }}>{label}</p>
                  {count ? <span className="text-xs" style={{ color: '#6B7280' }}>{count}</span> : null}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── SECTION 6 : COURS VEDETTES (fond navy) ───────────────────── */}
      {data.featured_courses.length > 0 && (
        <section className="px-6 py-16" style={{ backgroundColor: '#002050' }}>
          <div className="max-w-6xl mx-auto">
            <h2 className="font-bold text-white mb-1" style={{ fontSize: '26px' }}>
              Nos formations les mieux notées
            </h2>
            <p className="mb-8 text-sm font-semibold" style={{ color: '#BF8813' }}>
              Certifiées · Reconnues · Accessibles
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {data.featured_courses.map(c => <CourseCard key={c.id} course={c} />)}
            </div>
            <div className="text-center mt-10">
              <button
                onClick={() => navigate('/catalogue')}
                className="px-8 py-3.5 rounded-lg font-semibold text-white transition-opacity hover:opacity-85"
                style={{ backgroundColor: '#BF8813' }}
              >
                Explorer tout le catalogue →
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── SECTION 7 : DEVENIR FORMATEUR ────────────────────────────── */}
      <section className="px-6 py-16 bg-white" style={{ borderTop: '1px solid #E4E7EC' }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-12">
          {/* Text */}
          <div className="flex-1">
            <div
              className="inline-block text-xs font-bold uppercase px-3 py-1 rounded-full mb-5"
              style={{ backgroundColor: 'rgba(191,136,19,0.10)', color: '#BF8813', letterSpacing: '0.10em' }}
            >
              Pour les formateurs
            </div>
            <h2
              className="font-bold mb-3"
              style={{ color: '#002050', fontSize: 'clamp(22px, 3vw, 34px)' }}
            >
              {data.devenir_formateur.title_fr}
            </h2>
            <p className="mb-7 max-w-lg" style={{ color: '#6B7280', fontSize: '16px', lineHeight: 1.65 }}>
              {data.devenir_formateur.desc_fr}
            </p>
            <ul className="space-y-3 mb-8">
              {[
                'Créez et publiez vos formations facilement',
                "Touchez des apprenants dans toute l'Afrique",
                'Gérez vos revenus et demandez vos retraits',
                'Obtenez des certifications CPD reconnues',
              ].map(b => (
                <li key={b} className="flex items-center gap-3">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'rgba(191,136,19,0.14)' }}
                  >
                    <Check size={11} style={{ color: '#BF8813' }} />
                  </div>
                  <span className="text-sm" style={{ color: '#374151' }}>{b}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => navigate('/inscription/professeur')}
              className="px-6 py-3 rounded-lg font-semibold text-white transition-opacity hover:opacity-85"
              style={{ backgroundColor: '#002050' }}
            >
              Commencer comme formateur →
            </button>
          </div>

          {/* Stats card */}
          <div
            className="flex-shrink-0 w-full md:w-[40%] rounded-2xl p-6 grid grid-cols-1 gap-3"
            style={{ backgroundColor: '#F8F9FA', border: '1px solid #E4E7EC' }}
          >
            {[
              { emoji: '💰', title: 'Revenus',         desc: "Gagnez jusqu'à 70% par vente" },
              { emoji: '📊', title: 'Statistiques',    desc: 'Suivez vos performances en temps réel' },
              { emoji: '🎓', title: 'Certification',   desc: "Formez-vous pour créer de meilleures formations" },
              { emoji: '🌍', title: 'Portée',          desc: 'Visibilité dans 15+ pays africains' },
            ].map(({ emoji, title, desc }) => (
              <div key={title} className="flex items-start gap-4 p-4 rounded-xl bg-white" style={{ border: '1px solid #E4E7EC' }}>
                <span className="text-2xl flex-shrink-0">{emoji}</span>
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#002050' }}>{title}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
{/* ── SECTION CV BUILDER ───────────────────────────────────────── */}
      <section className="px-6 py-16" style={{ backgroundColor: '#002050' }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1 text-white">
            <div className="inline-block text-xs font-bold uppercase px-3 py-1 rounded-full mb-5"
              style={{ backgroundColor: 'rgba(191,136,19,0.20)', color: '#BF8813', letterSpacing: '0.10em' }}>
              CV Builder IA
            </div>
            <h2 className="font-bold mb-4" style={{ fontSize: 'clamp(22px, 3vw, 34px)', color: 'white' }}>
              Créez un CV professionnel en quelques minutes
            </h2>
            <p className="mb-7 max-w-lg" style={{ color: 'rgba(255,255,255,0.75)', fontSize: '16px', lineHeight: 1.65 }}>
              8 modèles conçus pour le marché africain. Vos formations Omnia s'ajoutent automatiquement avec lien de vérification. L'IA améliore vos textes. Téléchargez en PDF.
            </p>
            <ul className="space-y-3 mb-8">
              {[
                '8 templates professionnels (ATS, Étudiant, IT, Business...)',
                'Formations Omnia intégrées automatiquement',
                'Assistant IA pour améliorer vos textes',
                'Aperçu temps réel en format A4',
                '1 jeton offert à l\'inscription',
              ].map(b => (
                <li key={b} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'rgba(191,136,19,0.25)' }}>
                    <Check size={11} style={{ color: '#BF8813' }} />
                  </div>
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>{b}</span>
                </li>
              ))}
            </ul>
            <button onClick={() => navigate('/omnia-career/cv-builder')}
              className="px-6 py-3 rounded-lg font-semibold transition-opacity hover:opacity-85"
              style={{ backgroundColor: '#BF8813', color: 'white' }}>
              Créer mon CV gratuitement →
            </button>
          </div>
          <div className="flex-shrink-0 w-full md:w-[42%] grid grid-cols-2 gap-3">
            {[
              { emoji: '📄', title: 'CV Classique', desc: 'Structure traditionnelle et professionnelle' },
              { emoji: '🤖', title: 'CV ATS', desc: 'Optimisé pour les recruteurs automatiques' },
              { emoji: '💻', title: 'CV IT/Digital', desc: 'Pour les profils techniques et numériques' },
              { emoji: '🌍', title: 'CV International', desc: 'Pour les candidatures à l\'international' },
            ].map(({ emoji, title, desc }) => (
              <div key={title} className="p-4 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <span className="text-2xl">{emoji}</span>
                <p className="text-sm font-semibold mt-2" style={{ color: 'white' }}>{title}</p>
                <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.55)' }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* ── SECTION FORUM COMMUNAUTÉ ─────────────────────────────────── */}
      <section className="px-6 py-16 bg-white" style={{ borderTop: '1px solid #E4E7EC' }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-12">
          {/* Cards communauté */}
          <div className="flex-shrink-0 w-full md:w-[42%] grid grid-cols-2 gap-3">
            {[
              { emoji: '💬', title: 'Forum général', desc: 'Posez vos questions, partagez vos connaissances' },
              { emoji: '🌍', title: 'Par pays', desc: 'Rejoignez la communauté de votre région' },
              { emoji: '📚', title: 'Forum de cours', desc: 'Discutez directement avec vos formateurs' },
              { emoji: '💼', title: 'Offres d\'emploi', desc: 'Trouvez des opportunités dans votre domaine' },
            ].map(({ emoji, title, desc }) => (
              <div key={title} className="p-4 rounded-xl border hover:shadow-md transition-shadow"
                style={{ borderColor: '#E4E7EC', backgroundColor: '#F8F9FA' }}>
                <span className="text-2xl">{emoji}</span>
                <p className="text-sm font-semibold mt-2" style={{ color: '#002050' }}>{title}</p>
                <p className="text-xs mt-1" style={{ color: '#6B7280' }}>{desc}</p>
              </div>
            ))}
          </div>

          {/* Texte */}
          <div className="flex-1">
            <div className="inline-block text-xs font-bold uppercase px-3 py-1 rounded-full mb-5"
              style={{ backgroundColor: 'rgba(0,32,80,0.08)', color: '#002050', letterSpacing: '0.10em' }}>
              Communauté
            </div>
            <h2 className="font-bold mb-3" style={{ color: '#002050', fontSize: 'clamp(22px, 3vw, 34px)' }}>
              Apprenez ensemble, progressez plus vite
            </h2>
            <p className="mb-7 max-w-lg" style={{ color: '#6B7280', fontSize: '16px', lineHeight: 1.65 }}>
              Rejoignez une communauté active d'apprenants et de formateurs à travers toute l'Afrique. Posez vos questions, partagez vos expériences, trouvez des opportunités.
            </p>
            <ul className="space-y-3 mb-8">
              {[
                'Forum général filtré par pays',
                'Espaces de discussion par formation',
                'Offres d\'emploi et opportunités professionnelles',
                'Échanges directs avec les formateurs',
                'Communauté modérée et bienveillante',
              ].map(b => (
                <li key={b} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'rgba(191,136,19,0.14)' }}>
                    <Check size={11} style={{ color: '#BF8813' }} />
                  </div>
                  <span className="text-sm" style={{ color: '#374151' }}>{b}</span>
                </li>
              ))}
            </ul>
            <button onClick={() => navigate('/forum')}
              className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-white transition-opacity hover:opacity-85"
              style={{ backgroundColor: '#002050' }}>
              <MessageCircle size={18} />
              Rejoindre la communauté →
            </button>
          </div>
        </div>
      </section>
      {/* ── SECTION 8 : PARTENAIRES ─────────────────────────────── */}
      {((data.public_partners?.length ?? 0) > 0 || data.collaborations_logos?.length > 0) && (
        <section className="px-6 py-12 bg-white" style={{ borderTop: '1px solid #E4E7EC' }}>
          <div className="max-w-6xl mx-auto">
            <h2 className="text-center font-bold mb-3" style={{ color: '#002050', fontSize: '22px' }}>
              Nos partenaires
            </h2>
            <p className="text-center text-sm text-gray-500 mb-9">Institutions, entreprises, organismes de certification et partenaires technologiques qui collaborent avec Omnia.</p>
            <div className="flex flex-wrap justify-center items-stretch gap-5">
              {(data.public_partners || []).map((partner) => {
                const content = <div className="w-44 min-h-[120px] rounded-xl border border-gray-200 p-4 flex flex-col items-center justify-center text-center bg-white hover:shadow-sm transition">
                  {partner.logo_url ? <img src={partner.logo_url} alt={partner.name} className="h-12 max-w-[130px] object-contain mb-3" /> : <div className="h-12 flex items-center text-sm font-bold" style={{color:'#002050'}}>{partner.name}</div>}
                  <p className="text-xs font-semibold" style={{color:'#002050'}}>{partner.name}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{partner.category}</p>
                </div>;
                return partner.website_url ? <a key={partner.id} href={partner.website_url} target="_blank" rel="noopener noreferrer">{content}</a> : <div key={partner.id}>{content}</div>;
              })}
              {(data.public_partners?.length ?? 0) === 0 && data.collaborations_logos?.map((logo, i) =>
                logo.link
                  ? <a key={i} href={logo.link} target="_blank" rel="noopener noreferrer" className="transition-opacity hover:opacity-70"><img src={logo.file_url} alt={logo.name} style={{ height: '48px', objectFit: 'contain' }} /></a>
                  : <img key={i} src={logo.file_url} alt={logo.name} style={{ height: '48px', objectFit: 'contain' }} />
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── SECTION 9 : FOOTER ───────────────────────────────────────── */}
      <PageFooter
        socialNetworks={data.social_networks}
        appDownloads={data.app_downloads}
        followUsLabel={data.follow_us_label_fr}
      />
    </div>
  );
}
