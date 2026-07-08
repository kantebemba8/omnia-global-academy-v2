import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Star, Zap, Shield, Globe, Award, ChevronRight,
  Check, Users, Download, Briefcase, GraduationCap, Building2,
  Sparkles, Lock, Eye
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { PageFooter } from '../components/PageFooter';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface Template {
  template_key: string;
  name_fr: string;
  description_fr: string;
  category: string;
  is_free: boolean;
  is_ats_compatible: boolean;
  allows_photo: boolean;
  display_order: number;
  default_colors: {
    primary: string;
    accent: string;
    sidebar: string;
    text: string;
  };
}

interface TokenPack {
  pack_key: string;
  name_fr: string;
  tokens: number;
  price_xof: number;
  is_popular: boolean;
  bonus_tokens: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  student: 'Étudiant & Stage',
  professional: 'Professionnel',
  africa_premium: 'Afrique Premium',
  tech: 'Tech & Digital',
  creative: 'Créatif',
  specialized: 'Métiers spécialisés',
};

const CATEGORY_ICONS: Record<string, typeof FileText> = {
  student: GraduationCap,
  professional: Briefcase,
  africa_premium: Globe,
  tech: Zap,
  creative: Star,
  specialized: Shield,
};

function TemplateCard({ template, onSelect }: { template: Template; onSelect: () => void }) {
  const colors = template.default_colors || { primary: '#002050', accent: '#BF8813', sidebar: '#F8F9FA' };

  return (
    <div
      className="group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border border-gray-100"
      onClick={onSelect}
      style={{ background: 'white' }}
    >
      {/* Template Preview */}
      <div className="relative h-56 overflow-hidden" style={{ background: '#F8F9FA' }}>
        {/* Mini CV Preview */}
        <div className="absolute inset-2 rounded-lg overflow-hidden shadow-sm" style={{ background: 'white' }}>
          <div className="flex h-full" style={{ fontSize: '5px' }}>
            {/* Sidebar */}
            <div className="w-1/3 h-full p-1.5" style={{ background: colors.sidebar || colors.primary }}>
              <div className="w-6 h-6 rounded-full mb-1 mx-auto" style={{ background: colors.accent || colors.primary, opacity: 0.6 }} />
              <div className="h-1 rounded mb-0.5" style={{ background: colors.accent, width: '60%', margin: '0 auto 2px' }} />
              <div className="h-0.5 rounded mb-1" style={{ background: 'rgba(0,0,0,0.1)', width: '80%', margin: '0 auto 4px' }} />
              {[70, 55, 85, 65].map((w, i) => (
                <div key={i} className="mb-1">
                  <div className="h-0.5 rounded mb-0.5" style={{ background: 'rgba(0,0,0,0.15)', width: '90%' }} />
                  <div className="h-0.5 rounded" style={{ background: colors.accent, width: `${w}%`, opacity: 0.8 }} />
                </div>
              ))}
            </div>
            {/* Main */}
            <div className="flex-1 p-1.5">
              <div className="h-1.5 rounded mb-0.5" style={{ background: colors.primary, width: '80%' }} />
              <div className="h-0.5 rounded mb-1.5" style={{ background: colors.accent, width: '50%' }} />
              <div className="h-px mb-1" style={{ background: colors.primary }} />
              {[90, 75, 95, 80, 70, 85].map((w, i) => (
                <div key={i} className="h-0.5 rounded mb-0.5" style={{ background: 'rgba(0,0,0,0.12)', width: `${w}%` }} />
              ))}
              <div className="h-px mt-1 mb-1" style={{ background: colors.primary, opacity: 0.3 }} />
              {[85, 70, 90].map((w, i) => (
                <div key={i} className="h-0.5 rounded mb-0.5" style={{ background: 'rgba(0,0,0,0.1)', width: `${w}%` }} />
              ))}
            </div>
          </div>
        </div>

        {/* Badges */}
        <div className="absolute top-3 left-3 flex gap-1.5">
          {template.is_free ? (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#D1FAE5', color: '#065F46' }}>Gratuit</span>
          ) : (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#FEF3C7', color: '#92400E' }}>Premium</span>
          )}
          {template.is_ats_compatible && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#EFF6FF', color: '#1D4ED8' }}>ATS</span>
          )}
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
          style={{ background: 'rgba(0,32,80,0.75)' }}>
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm text-white"
            style={{ background: '#BF8813' }}>
            Utiliser ce modèle <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-bold text-sm" style={{ color: '#002050' }}>{template.name_fr}</h3>
            <p className="text-xs mt-0.5 line-clamp-2" style={{ color: '#6B7280' }}>{template.description_fr}</p>
          </div>
          <div className="w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center mt-0.5"
            style={{ background: `${colors.primary}15` }}>
            <div className="w-3 h-3 rounded-sm" style={{ background: colors.primary }} />
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-2">
          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: '#F3F4F6', color: '#6B7280' }}>
            {CATEGORY_LABELS[template.category] || template.category}
          </span>
          {!template.allows_photo && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: '#F3F4F6', color: '#6B7280' }}>Sans photo</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OmniaCareerStudio() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [packs, setPacks] = useState<TokenPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'cv' | 'lm'>('cv');

  const isLoggedIn = !!localStorage.getItem('omnia_session_token');

  useEffect(() => {
    fetch(`${SUPABASE_URL}/functions/v1/career-studio-list?type=${activeTab}`)
      .then(r => r.json())
      .then(d => {
        setTemplates(d.templates || []);
        setPacks(d.packs || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [activeTab]);

  const categories = ['all', ...Array.from(new Set(templates.map(t => t.category)))];
  const filteredTemplates = activeCategory === 'all'
    ? templates
    : templates.filter(t => t.category === activeCategory);

  const freeTemplates = templates.filter(t => t.is_free).length;
  const premiumTemplates = templates.filter(t => !t.is_free).length;

  function handleStart() {
    if (isLoggedIn) {
      navigate('/dashboard/career-studio');
    } else {
      navigate('/inscription?redirect=/dashboard/career-studio');
    }
  }

  function handleTemplateSelect(template: Template) {
    if (isLoggedIn) {
      navigate(`/dashboard/career-studio/new?template=${template.template_key}`);
    } else {
      navigate(`/inscription?redirect=/dashboard/career-studio/new&template=${template.template_key}`);
    }
  }

  return (
    <div className="min-h-screen" style={{ background: '#F8F9FA' }}>
      <Navbar />

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section style={{ background: 'linear-gradient(135deg, #001840 0%, #002050 60%, #003580 100%)' }} className="pt-20 pb-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="flex-1 text-center lg:text-left">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6"
                style={{ background: 'rgba(191,136,19,0.15)', border: '1px solid rgba(191,136,19,0.3)' }}>
                <Sparkles size={14} style={{ color: '#BF8813' }} />
                <span className="text-sm font-semibold" style={{ color: '#BF8813' }}>Nouveau — Omnia Career Studio</span>
              </div>

              <h1 className="font-black mb-4 leading-tight"
                style={{ color: 'white', fontSize: 'clamp(28px, 4vw, 48px)' }}>
                Créez votre CV professionnel<br />
                <span style={{ color: '#BF8813' }}>assisté par l'IA</span>
              </h1>

              <p className="mb-8 max-w-xl mx-auto lg:mx-0"
                style={{ color: 'rgba(255,255,255,0.75)', fontSize: '17px', lineHeight: 1.65 }}>
                CV, lettres de motivation et candidatures professionnelles.
                20 modèles premium, assistant IA, export PDF.
                Adapté au marché africain et international.
              </p>

              {/* Stats rapides */}
              <div className="flex flex-wrap gap-6 justify-center lg:justify-start mb-8">
                {[
                  { value: '20', label: 'Modèles CV' },
                  { value: '32', label: 'Modèles LM' },
                  { value: 'IA', label: 'Assisté' },
                  { value: 'PDF', label: 'Export propre' },
                ].map(stat => (
                  <div key={stat.label} className="text-center">
                    <div className="text-2xl font-black" style={{ color: '#BF8813' }}>{stat.value}</div>
                    <div className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
                <button onClick={handleStart}
                  className="flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-white transition-all hover:opacity-90"
                  style={{ background: '#BF8813', fontSize: '15px' }}>
                  {isLoggedIn ? 'Accéder à Career Studio' : 'Commencer gratuitement'}
                  <ChevronRight size={18} />
                </button>
                <button onClick={() => document.getElementById('modeles')?.scrollIntoView({ behavior: 'smooth' })}
                  className="flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold transition-all"
                  style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', fontSize: '15px' }}>
                  Voir les modèles
                </button>
              </div>

              {!isLoggedIn && (
                <p className="mt-4 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Inscription gratuite · Aucune carte bancaire requise
                </p>
              )}
            </div>

            {/* Preview cards */}
            <div className="flex-shrink-0 grid grid-cols-2 gap-3 w-full max-w-sm">
              {[
                { label: 'CV professionnel', icon: FileText, color: '#002050' },
                { label: 'Lettre de motivation', icon: Award, color: '#1B4332' },
                { label: 'Score ATS', icon: Shield, color: '#1E3A5F' },
                { label: 'Candidature complète', icon: Briefcase, color: '#4A235A' },
              ].map(({ label, icon: Icon, color }) => (
                <div key={label} className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-2" style={{ background: `${color}40` }}>
                    <Icon size={18} style={{ color: '#BF8813' }} />
                  </div>
                  <p className="text-sm font-semibold" style={{ color: 'white' }}>{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── AVANTAGES ─────────────────────────────────────────── */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black mb-3" style={{ color: '#002050' }}>
              Pourquoi Omnia Career Studio ?
            </h2>
            <p style={{ color: '#6B7280' }}>Tout ce dont vous avez besoin pour décrocher votre emploi</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Sparkles, color: '#BF8813', bg: '#FFFBEB',
                title: 'Intelligence artificielle',
                desc: 'L\'IA génère, améliore et adapte votre CV et lettre de motivation en quelques secondes.',
              },
              {
                icon: Shield, color: '#065F46', bg: '#ECFDF5',
                title: 'Score ATS intégré',
                desc: 'Vérifiez que votre CV passe les logiciels de recrutement automatiques utilisés par les grandes entreprises.',
              },
              {
                icon: Award, color: '#1D4ED8', bg: '#EFF6FF',
                title: 'Certifications Omnia',
                desc: 'Vos formations Omnia s\'ajoutent automatiquement avec lien de vérification et QR code.',
              },
              {
                icon: Globe, color: '#7C3AED', bg: '#F5F3FF',
                title: 'Adapté à l\'Afrique',
                desc: 'Modèles calibrés pour le marché africain et les candidatures internationales depuis l\'Afrique.',
              },
              {
                icon: Eye, color: '#0369A1', bg: '#F0F9FF',
                title: 'Aperçu A4 en temps réel',
                desc: 'Visualisez exactement le rendu final de votre CV avant de télécharger.',
              },
              {
                icon: Download, color: '#BE185D', bg: '#FDF2F8',
                title: 'Export PDF sans filigrane',
                desc: 'Téléchargez votre CV professionnel propre et prêt à l\'emploi.',
              },
            ].map(({ icon: Icon, color, bg, title, desc }) => (
              <div key={title} className="p-6 rounded-2xl border" style={{ borderColor: '#E4E7EC' }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: bg }}>
                  <Icon size={22} style={{ color }} />
                </div>
                <h3 className="font-bold mb-2" style={{ color: '#002050' }}>{title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#6B7280' }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MODÈLES ───────────────────────────────────────────── */}
      <section id="modeles" className="py-16 px-4" style={{ background: '#F8F9FA' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-black mb-3" style={{ color: '#002050' }}>
              {freeTemplates + premiumTemplates} modèles professionnels
            </h2>
            <p style={{ color: '#6B7280' }}>
              {freeTemplates} gratuits · {premiumTemplates} premium · 3 variantes de couleur chacun
            </p>
          </div>

          {/* Tabs CV / LM */}
          <div className="flex gap-2 mb-6 justify-center">
            {[
              { key: 'cv', label: 'Modèles CV' },
              { key: 'lm', label: 'Lettres de motivation' },
            ].map(tab => (
              <button key={tab.key}
                onClick={() => { setActiveTab(tab.key as 'cv' | 'lm'); setActiveCategory('all'); }}
                className="px-5 py-2.5 rounded-xl font-semibold text-sm transition-all"
                style={activeTab === tab.key
                  ? { background: '#002050', color: 'white' }
                  : { background: 'white', color: '#6B7280', border: '1px solid #E4E7EC' }}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Filtres catégories */}
          <div className="flex flex-wrap gap-2 mb-8 justify-center">
            {categories.map(cat => {
              const Icon = cat === 'all' ? FileText : (CATEGORY_ICONS[cat] || FileText);
              return (
                <button key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                  style={activeCategory === cat
                    ? { background: '#002050', color: 'white' }
                    : { background: 'white', color: '#6B7280', border: '1px solid #E4E7EC' }}>
                  <Icon size={13} />
                  {cat === 'all' ? 'Tous' : CATEGORY_LABELS[cat] || cat}
                </button>
              );
            })}
          </div>

          {/* Grille de templates */}
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-64 rounded-2xl animate-pulse" style={{ background: '#E4E7EC' }} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredTemplates.map(template => (
                <TemplateCard key={template.template_key} template={template} onSelect={() => handleTemplateSelect(template)} />
              ))}
            </div>
          )}

          <div className="text-center mt-8">
            <button onClick={handleStart}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white"
              style={{ background: '#002050' }}>
              Voir tous les modèles <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* ── COMMENT ÇA MARCHE ────────────────────────────────── */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black mb-3" style={{ color: '#002050' }}>Comment ça marche ?</h2>
            <p style={{ color: '#6B7280' }}>Créez votre CV en 3 étapes simples</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: '1', title: 'Choisissez un modèle', desc: 'Parcourez nos 20 modèles et choisissez celui qui correspond à votre profil.', color: '#002050' },
              { step: '2', title: 'Remplissez vos informations', desc: 'Saisissez vos données manuellement ou laissez l\'IA générer votre CV à partir d\'un texte libre.', color: '#1B4332' },
              { step: '3', title: 'Téléchargez votre PDF', desc: 'Prévisualisez en A4, ajustez les couleurs et téléchargez votre CV propre sans filigrane.', color: '#4A235A' },
            ].map(({ step, title, desc, color }) => (
              <div key={step} className="text-center">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl font-black text-white"
                  style={{ background: color }}>{step}</div>
                <h3 className="font-bold mb-2" style={{ color: '#002050' }}>{title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#6B7280' }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TARIFS JETONS ─────────────────────────────────────── */}
      <section className="py-16 px-4" style={{ background: '#F8F9FA' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-black mb-3" style={{ color: '#002050' }}>Tarifs simples et transparents</h2>
            <p style={{ color: '#6B7280' }}>Création et modification gratuites · Payez uniquement pour télécharger</p>
          </div>

          {/* Ce qui est gratuit */}
          <div className="bg-white rounded-2xl p-6 border mb-6" style={{ borderColor: '#E4E7EC' }}>
            <h3 className="font-bold mb-4 flex items-center gap-2" style={{ color: '#065F46' }}>
              <Check size={20} style={{ color: '#065F46' }} /> Toujours gratuit
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                'Création de CV', 'Modification manuelle', 'Sauvegarde brouillon',
                'Aperçu A4', 'Changement de couleurs', 'Changement de police',
              ].map(item => (
                <div key={item} className="flex items-center gap-2 text-sm" style={{ color: '#374151' }}>
                  <Check size={14} style={{ color: '#065F46' }} /> {item}
                </div>
              ))}
            </div>
          </div>

          {/* Packs de jetons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {packs.map(pack => (
              <div key={pack.pack_key}
                className="bg-white rounded-2xl p-5 border-2 relative"
                style={{ borderColor: pack.is_popular ? '#BF8813' : '#E4E7EC' }}>
                {pack.is_popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-bold text-white"
                    style={{ background: '#BF8813' }}>Meilleure valeur</div>
                )}
                <div className="text-center">
                  <p className="font-bold text-sm mb-1" style={{ color: '#002050' }}>{pack.name_fr}</p>
                  <div className="text-3xl font-black mb-1" style={{ color: pack.is_popular ? '#BF8813' : '#002050' }}>
                    {pack.tokens + (pack.bonus_tokens || 0)}
                    <span className="text-base font-semibold ml-1" style={{ color: '#6B7280' }}>jetons</span>
                  </div>
                  <p className="text-lg font-bold mb-3" style={{ color: '#374151' }}>
                    {pack.price_xof.toLocaleString('fr-FR')} FCFA
                  </p>
                  <p className="text-xs mb-4" style={{ color: '#9CA3AF' }}>
                    {Math.round(pack.price_xof / (pack.tokens + (pack.bonus_tokens || 0)))} FCFA/jeton
                  </p>
                  <button onClick={handleStart}
                    className="w-full py-2 rounded-xl text-sm font-semibold transition-all"
                    style={pack.is_popular
                      ? { background: '#BF8813', color: 'white' }
                      : { background: '#002050', color: 'white' }}>
                    Acheter
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Ce que coûte chaque action */}
          <div className="mt-6 bg-white rounded-2xl p-6 border" style={{ borderColor: '#E4E7EC' }}>
            <h3 className="font-bold mb-4" style={{ color: '#002050' }}>Coût des actions</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { action: 'Export PDF modèle gratuit', cost: '1 jeton' },
                { action: 'Export PDF modèle premium', cost: '2 jetons' },
                { action: 'Génération CV avec IA', cost: '2 jetons' },
                { action: 'Génération lettre de motivation', cost: '1 jeton' },
                { action: 'Adaptation à une offre d\'emploi', cost: '2 jetons' },
                { action: 'Pack candidature complet', cost: '5 jetons' },
                { action: 'Score ATS + recommandations', cost: '1 jeton' },
                { action: 'Traduction français/anglais', cost: '1 jeton' },
                { action: 'Export Word', cost: '2 jetons' },
              ].map(({ action, cost }) => (
                <div key={action} className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: '#F8F9FA' }}>
                  <span className="text-xs" style={{ color: '#374151' }}>{action}</span>
                  <span className="text-xs font-bold ml-2 whitespace-nowrap" style={{ color: '#002050' }}>{cost}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── ORGANISATIONS PARTENAIRES ────────────────────────── */}
      <section className="py-16 px-4" style={{ background: '#002050' }}>
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-10">
          <div className="flex-1 text-white">
            <div className="inline-block text-xs font-bold uppercase px-3 py-1 rounded-full mb-5"
              style={{ background: 'rgba(191,136,19,0.2)', color: '#BF8813', letterSpacing: '0.1em' }}>
              B2B / B2G
            </div>
            <h2 className="text-3xl font-black mb-4">Vous êtes une organisation ?</h2>
            <p className="mb-6" style={{ color: 'rgba(255,255,255,0.75)', lineHeight: 1.65 }}>
              Écoles, universités, entreprises, ONG, ministères — offrez Career Studio à vos membres,
              étudiants ou employés. Codes partenaires, avantages personnalisables, suivi statistique.
            </p>
            <ul className="space-y-2 mb-8">
              {[
                'Codes d\'accès + PIN pour vos membres',
                'Avantages personnalisables (CV, LM, jetons, formations)',
                'Suivi des utilisateurs liés',
                'Paiement institutionnel (virement, Mobile Money, contrat)',
              ].map(b => (
                <li key={b} className="flex items-center gap-3 text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>
                  <Check size={14} style={{ color: '#BF8813' }} /> {b}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => navigate('/inscription/organisation')}
                className="px-5 py-2.5 rounded-xl font-semibold text-white"
                style={{ background: '#BF8813' }}>
                Devenir organisation partenaire
              </button>
              <button onClick={() => navigate('/contact')}
                className="px-5 py-2.5 rounded-xl font-semibold"
                style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}>
                Nous contacter
              </button>
            </div>
          </div>
          <div className="flex-shrink-0 grid grid-cols-2 gap-3 w-full max-w-xs">
            {[
              { icon: GraduationCap, label: 'Écoles & Universités' },
              { icon: Building2, label: 'Entreprises' },
              { icon: Globe, label: 'ONG & International' },
              { icon: Users, label: 'Gouvernements' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="p-4 rounded-xl text-center"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <Icon size={24} style={{ color: '#BF8813' }} className="mx-auto mb-2" />
                <p className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ─────────────────────────────────────────── */}
      <section className="py-16 px-4 bg-white text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-black mb-4" style={{ color: '#002050' }}>
            Prêt à créer votre CV professionnel ?
          </h2>
          <p className="mb-8" style={{ color: '#6B7280' }}>
            Rejoignez des milliers d'apprenants qui ont déjà utilisé Omnia Career Studio pour décrocher leur emploi.
          </p>
          <button onClick={handleStart}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-white text-lg transition-all hover:opacity-90"
            style={{ background: '#BF8813' }}>
            {isLoggedIn ? 'Accéder à Career Studio' : 'Créer mon CV gratuitement'}
            <ChevronRight size={20} />
          </button>
          {!isLoggedIn && (
            <p className="mt-3 text-sm" style={{ color: '#9CA3AF' }}>
              Déjà inscrit ?{' '}
              <button onClick={() => navigate('/connexion')} className="font-semibold underline" style={{ color: '#002050' }}>
                Se connecter
              </button>
            </p>
          )}
        </div>
      </section>

      <PageFooter />
    </div>
  );
}
