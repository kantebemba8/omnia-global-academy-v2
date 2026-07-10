import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Award,
  BarChart3,
  Bell,
  Briefcase,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  ClipboardList,
  Coins,
  Crown,
  Download,
  Edit2,
  Eye,
  FileText,
  Mail,
  MessageSquare,
  Plus,
  Search,
  Settings,
  Sparkles,
  Star,
  Target,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const OMNIA_BLUE = '#002050';
const OMNIA_GOLD = '#bf8813';
const PAGE_BG = '#F8F9FA';
const BORDER = '#E4E7EC';
const MUTED = '#6B7280';

type ActiveView =
  | 'dashboard'
  | 'cv'
  | 'lm'
  | 'interview'
  | 'applications'
  | 'profile'
  | 'coaching'
  | 'settings';

type DocType = 'cv' | 'lm';

interface CareerDocument {
  id: string;
  title: string;
  doc_type: DocType;
  template_key?: string;
  language?: string;
  status?: string;
  ats_score?: number | null;
  target_job?: string | null;
  application_type?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface Template {
  template_key: string;
  name_fr: string;
  description_fr?: string;
  category?: string;
  is_free?: boolean;
  is_ats_compatible?: boolean;
  display_order?: number;
  default_colors?: {
    primary?: string;
    accent?: string;
    sidebar?: string;
    text?: string;
  };
}

interface TokenPack {
  pack_key: string;
  name_fr: string;
  tokens: number;
  price_xof: number;
  is_popular?: boolean;
  bonus_tokens?: number;
}

interface CurrentUser {
  full_name?: string;
  name?: string;
  email?: string;
  roles?: string[];
}

const navItems: { id: ActiveView; label: string; icon: typeof FileText }[] = [
  { id: 'dashboard', label: 'Tableau de bord', icon: BarChart3 },
  { id: 'cv', label: 'CV Builder', icon: FileText },
  { id: 'lm', label: 'Lettres de motivation', icon: Mail },
  { id: 'interview', label: 'Préparation entretien', icon: MessageSquare },
  { id: 'applications', label: 'Suivi candidatures', icon: Briefcase },
  { id: 'profile', label: 'Profil carrière', icon: UserRound },
  { id: 'coaching', label: 'Coaching carrière', icon: Star },
  { id: 'settings', label: 'Paramètres', icon: Settings },
];

const fallbackCvTemplates: Template[] = [
  { template_key: 'modern', name_fr: 'Moderne', description_fr: 'Idéal pour la tech', is_free: true, is_ats_compatible: true },
  { template_key: 'professional', name_fr: 'Professionnel', description_fr: 'Tous secteurs', is_free: true, is_ats_compatible: true },
  { template_key: 'creative', name_fr: 'Créatif', description_fr: 'Design & Marketing', is_free: false, is_ats_compatible: false },
];

const fallbackLmTemplates: Template[] = [
  { template_key: 'classic_lm', name_fr: 'Classique', description_fr: 'Professionnel et formel', is_free: true },
  { template_key: 'dynamic_lm', name_fr: 'Dynamique', description_fr: 'Moderne et engageant', is_free: true },
  { template_key: 'academic_lm', name_fr: 'Académique', description_fr: 'Recherche et enseignement', is_free: false },
];

function readUser(): CurrentUser | null {
  try {
    const raw = localStorage.getItem('omnia_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getInitials(name?: string, email?: string) {
  const source = name || email || 'Apprenant';
  const parts = source.trim().split(' ').filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function formatDate(date?: string) {
  if (!date) return 'Aujourd’hui';
  try {
    return new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return date;
  }
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border bg-white shadow-sm ${className}`} style={{ borderColor: BORDER }}>
      {children}
    </div>
  );
}

function SectionTitle({ title, action }: { title: string; action?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold" style={{ color: OMNIA_BLUE }}>{title}</h2>
      {action && <button className="text-xs font-semibold" style={{ color: OMNIA_BLUE }}>{action}</button>}
    </div>
  );
}

function SmallBadge({ children, tone = 'blue' }: { children: React.ReactNode; tone?: 'blue' | 'gold' | 'green' | 'purple' | 'red' }) {
  const map = {
    blue: { bg: 'rgba(0,32,80,0.08)', color: OMNIA_BLUE },
    gold: { bg: 'rgba(191,136,19,0.12)', color: OMNIA_GOLD },
    green: { bg: '#DCFCE7', color: '#15803D' },
    purple: { bg: '#F3E8FF', color: '#7E22CE' },
    red: { bg: '#FEE2E2', color: '#B91C1C' },
  }[tone];
  return <span className="rounded-full px-2 py-1 text-xs font-semibold" style={{ background: map.bg, color: map.color }}>{children}</span>;
}

export default function DashboardCareerStudio() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [documents, setDocuments] = useState<CareerDocument[]>([]);
  const [cvTemplates, setCvTemplates] = useState<Template[]>(fallbackCvTemplates);
  const [lmTemplates, setLmTemplates] = useState<Template[]>(fallbackLmTemplates);
  const [packs, setPacks] = useState<TokenPack[]>([]);
  const [tokens, setTokens] = useState(0);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  const user = readUser();
  const displayName = user?.full_name || user?.name || 'Lina Amani';
  const initials = getInitials(displayName, user?.email);

  const cvDocs = useMemo(() => documents.filter((doc) => doc.doc_type === 'cv'), [documents]);
  const lmDocs = useMemo(() => documents.filter((doc) => doc.doc_type === 'lm'), [documents]);
  const latestCv = cvDocs[0];
  const latestLm = lmDocs[0];

  const token = () => localStorage.getItem('omnia_session_token') || '';

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(''), 3500);
  }

  async function loadByType(docType: DocType) {
    if (!SUPABASE_URL) return { documents: [], templates: [], packs: [], user: null };
    const response = await fetch(`${SUPABASE_URL}/functions/v1/career-studio-list`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ doc_type: docType }),
    });
    return response.json();
  }

  async function loadData() {
    setLoading(true);
    try {
      const [cvData, lmData] = await Promise.allSettled([loadByType('cv'), loadByType('lm')]);
      const cvPayload = cvData.status === 'fulfilled' ? cvData.value : null;
      const lmPayload = lmData.status === 'fulfilled' ? lmData.value : null;

      const loadedDocs = [
        ...((cvPayload?.documents || []) as CareerDocument[]),
        ...((lmPayload?.documents || []) as CareerDocument[]),
      ].sort((a, b) => new Date(b.updated_at || b.created_at || '').getTime() - new Date(a.updated_at || a.created_at || '').getTime());

      setDocuments(loadedDocs);
      setCvTemplates(((cvPayload?.templates || []) as Template[]).length ? cvPayload.templates : fallbackCvTemplates);
      setLmTemplates(((lmPayload?.templates || []) as Template[]).length ? lmPayload.templates : fallbackLmTemplates);
      setPacks((cvPayload?.packs || lmPayload?.packs || []) as TokenPack[]);
      setTokens(cvPayload?.user?.cv_tokens ?? lmPayload?.user?.cv_tokens ?? 0);
    } catch {
      showToast('Impossible de charger vos données Omnia Career pour le moment.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    const purchased = searchParams.get('tokens_purchased');
    if (purchased) showToast(`${purchased} jeton(s) crédité(s) sur votre compte.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function createDoc(docType: DocType, templateKey?: string) {
    const templates = docType === 'cv' ? cvTemplates : lmTemplates;
    const chosen = templateKey || templates[0]?.template_key || (docType === 'cv' ? 'modern' : 'classic_lm');
    navigate(`/dashboard/career-studio/editor/new?type=${docType}&template=${encodeURIComponent(chosen)}`);
  }

  function openDoc(documentId?: string, fallbackType: DocType = 'cv') {
    if (documentId) navigate(`/dashboard/career-studio/editor/${documentId}`);
    else createDoc(fallbackType);
  }

  async function deleteDoc(docId: string) {
    if (!confirm('Supprimer ce document ?')) return;
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/career-studio-save`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', document_id: docId }),
      });
      setDocuments((prev) => prev.filter((item) => item.id !== docId));
      showToast('Document supprimé.');
    } catch {
      showToast('Erreur pendant la suppression.');
    }
  }

  const quickActions = [
    { label: 'Créer un CV', icon: FileText, action: () => createDoc('cv') },
    { label: 'Nouvelle lettre', icon: Mail, action: () => createDoc('lm') },
    { label: 'Préparer entretien', icon: MessageSquare, action: () => setActiveView('interview') },
    { label: 'Évaluer mon profil', icon: Star, action: () => setActiveView('profile') },
  ];

  return (
    <div className="min-h-screen" style={{ background: PAGE_BG, color: '#111827' }}>
      {toast && (
        <div className="fixed right-5 top-5 z-50 rounded-xl border bg-white px-4 py-3 text-sm font-medium shadow-lg" style={{ color: OMNIA_BLUE, borderColor: BORDER }}>
          {toast}
        </div>
      )}

      <div className="flex min-h-screen">
        {/* Sidebar Omnia Career */}
        <aside className="fixed left-0 top-0 z-40 flex h-screen w-[280px] flex-col text-white shadow-xl" style={{ background: OMNIA_BLUE }}>
          <div className="px-5 pb-4 pt-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-white">
                <img src="/IMG_0349.png" alt="Omnia Global Academy" className="h-full w-full object-cover" />
              </div>
              <div className="leading-tight">
                <div className="text-base font-bold text-white">Omnia Global</div>
                <div className="text-base font-bold text-white">Academy</div>
              </div>
            </div>
            <div className="mt-8">
              <h2 className="text-xl font-semibold" style={{ color: OMNIA_GOLD }}>Omnia Career</h2>
              <div className="mt-3 h-0.5 w-10 rounded-full" style={{ background: OMNIA_GOLD }} />
            </div>
          </div>

          <nav className="flex-1 space-y-1 px-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveView(item.id)}
                  className="group relative flex h-11 w-full items-center gap-3 rounded-xl px-4 text-left text-sm font-medium transition"
                  style={{
                    background: isActive ? 'rgba(255,255,255,0.10)' : 'transparent',
                    color: isActive ? 'white' : 'rgba(255,255,255,0.88)',
                  }}
                >
                  {isActive && <span className="absolute left-0 top-2 h-7 w-1 rounded-r-full" style={{ background: OMNIA_GOLD }} />}
                  <Icon size={19} style={{ color: isActive ? OMNIA_GOLD : 'rgba(255,255,255,0.82)' }} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="px-5 pb-6">
            <div className="rounded-2xl border p-4" style={{ borderColor: 'rgba(191,136,19,0.45)', background: 'rgba(255,255,255,0.05)' }}>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: OMNIA_GOLD }}>
                <Crown size={18} color="white" />
              </div>
              <h3 className="text-base font-semibold" style={{ color: OMNIA_GOLD }}>Passez à Premium</h3>
              <p className="mt-2 text-sm leading-6 text-white/75">Accédez à des modèles exclusifs, des analyses avancées et plus.</p>
              <button className="mt-4 h-10 w-full rounded-xl text-sm font-semibold text-white" style={{ background: OMNIA_GOLD }}>Découvrir Premium</button>
            </div>
            <button className="ml-auto mt-4 flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:bg-white/10" aria-label="Réduire le menu">
              <ChevronsLeft size={18} />
            </button>
          </div>
        </aside>

        {/* Main */}
        <div className="ml-[280px] flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b bg-white px-8" style={{ borderColor: BORDER }}>
            <div className="flex h-11 w-full max-w-[560px] items-center rounded-2xl border bg-white px-4" style={{ borderColor: BORDER }}>
              <Search size={18} color="#9CA3AF" />
              <input className="ml-3 h-full flex-1 border-0 bg-transparent text-sm outline-none" placeholder="Rechercher un CV, une offre, un conseil..." />
              <span className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-semibold" style={{ color: MUTED }}>⌘ K</span>
            </div>
            <div className="ml-6 flex items-center gap-4">
              <button className="relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100" aria-label="Notifications">
                <Bell size={18} color={OMNIA_BLUE} />
                <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: OMNIA_GOLD }}>3</span>
              </button>
              <div className="h-8 w-px bg-gray-200" />
              <button className="flex items-center gap-3 rounded-xl px-2 py-1 hover:bg-gray-100">
                <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: OMNIA_BLUE }}>{initials}</div>
                <div className="hidden text-left md:block">
                  <div className="text-sm font-semibold" style={{ color: OMNIA_BLUE }}>{displayName}</div>
                  <div className="text-xs" style={{ color: MUTED }}>Apprenant</div>
                </div>
                <ChevronDown size={16} color={MUTED} />
              </button>
            </div>
          </header>

          <main className="flex-1 px-8 py-7">
            {activeView === 'dashboard' && <DashboardView loading={loading} cvDocs={cvDocs} lmDocs={lmDocs} latestCv={latestCv} latestLm={latestLm} templates={cvTemplates} tokens={tokens} quickActions={quickActions} setActiveView={setActiveView} createDoc={createDoc} openDoc={openDoc} />}
            {activeView === 'cv' && <CvBuilderView documents={cvDocs} templates={cvTemplates} createDoc={createDoc} openDoc={openDoc} deleteDoc={deleteDoc} />}
            {activeView === 'lm' && <LettersView documents={lmDocs} templates={lmTemplates} createDoc={createDoc} openDoc={openDoc} deleteDoc={deleteDoc} />}
            {activeView === 'interview' && <InterviewView />}
            {activeView === 'applications' && <ApplicationsView />}
            {activeView === 'profile' && <ProfileView displayName={displayName} />}
            {activeView === 'coaching' && <CoachingView />}
            {activeView === 'settings' && <SettingsView packs={packs} tokens={tokens} />}
          </main>
        </div>
      </div>
    </div>
  );
}

function DashboardView({
  loading,
  cvDocs,
  lmDocs,
  latestCv,
  latestLm,
  templates,
  tokens,
  quickActions,
  setActiveView,
  createDoc,
  openDoc,
}: {
  loading: boolean;
  cvDocs: CareerDocument[];
  lmDocs: CareerDocument[];
  latestCv?: CareerDocument;
  latestLm?: CareerDocument;
  templates: Template[];
  tokens: number;
  quickActions: { label: string; icon: typeof FileText; action: () => void }[];
  setActiveView: (view: ActiveView) => void;
  createDoc: (type: DocType, templateKey?: string) => void;
  openDoc: (id?: string, type?: DocType) => void;
}) {
  const stats = [
    { label: 'CV créés', value: cvDocs.length, sub: `${Math.max(0, cvDocs.length ? 1 : 0)} à améliorer`, icon: FileText, action: 'Voir mes CV', view: 'cv' as ActiveView, tone: 'blue' },
    { label: 'Lettres créées', value: lmDocs.length, sub: 'lettres enregistrées', icon: Mail, action: 'Voir mes lettres', view: 'lm' as ActiveView, tone: 'green' },
    { label: 'Jetons CV', value: tokens, sub: 'disponibles', icon: Coins, action: 'Voir mes jetons', view: 'settings' as ActiveView, tone: 'gold' },
    { label: 'Modèles CV', value: templates.length || 20, sub: 'templates disponibles', icon: Target, action: 'Choisir un modèle', view: 'cv' as ActiveView, tone: 'purple' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold" style={{ borderColor: 'rgba(191,136,19,0.35)', background: 'rgba(191,136,19,0.08)', color: OMNIA_GOLD }}>
          <Sparkles size={14} /> Omnia Career
        </div>
        <h1 className="text-2xl font-semibold" style={{ color: OMNIA_BLUE }}>Bienvenue dans Omnia Career</h1>
        <p className="mt-1 text-sm" style={{ color: MUTED }}>Votre espace pour créer vos CV, lettres de motivation et préparer vos candidatures.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const colors = {
            blue: ['rgba(0,32,80,0.08)', OMNIA_BLUE],
            green: ['#DCFCE7', '#16A34A'],
            gold: ['rgba(191,136,19,0.12)', OMNIA_GOLD],
            purple: ['#F3E8FF', '#7E22CE'],
          }[stat.tone as 'blue' | 'green' | 'gold' | 'purple'];
          return (
            <Card key={stat.label} className="p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: colors[0] }}>
                  <Icon size={22} color={colors[1]} />
                </div>
                <div>
                  <div className="text-sm font-medium" style={{ color: MUTED }}>{stat.label}</div>
                  <div className="text-2xl font-semibold" style={{ color: OMNIA_BLUE }}>{loading ? '...' : stat.value}</div>
                  <div className="text-xs" style={{ color: MUTED }}>{stat.sub}</div>
                </div>
              </div>
              <button onClick={() => setActiveView(stat.view)} className="mt-4 flex w-full items-center justify-between border-t pt-3 text-sm font-semibold" style={{ borderColor: BORDER, color: OMNIA_BLUE }}>
                {stat.action} <ChevronRight size={16} />
              </button>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1.15fr_1fr]">
        <Card className="p-5">
          <SectionTitle title="Prochaines actions" action="Voir tout" />
          <div className="space-y-3">
            <ActionRow icon={FileText} title="Améliorer mon CV" subtitle="Optimisez votre CV principal avant export PDF." badge="Prioritaire" onClick={() => openDoc(latestCv?.id, 'cv')} />
            <ActionRow icon={Mail} title="Personnaliser une lettre" subtitle="Adaptez votre lettre à une offre précise." badge="Aujourd’hui" onClick={() => openDoc(latestLm?.id, 'lm')} />
            <ActionRow icon={MessageSquare} title="Préparer un entretien" subtitle="Répondez aux questions fréquentes." badge="Demain" onClick={() => setActiveView('interview')} />
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle title="Mon CV le plus récent" action="Voir tous mes CV" />
          <div className="flex gap-5">
            <MiniCvPreview />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold" style={{ color: OMNIA_BLUE }}>{latestCv?.title || 'Développeur Full Stack'}</h3>
                <SmallBadge>Principal</SmallBadge>
              </div>
              <p className="mt-1 text-sm" style={{ color: MUTED }}>Mis à jour le {formatDate(latestCv?.updated_at)}</p>
              <div className="mt-4 space-y-2 text-sm">
                <MetricLine label="Score d’optimisation" value={`${latestCv?.ats_score || 82}/100`} />
                <MetricLine label="Mots-clés pertinents" value="18" />
                <MetricLine label="Lisibilité" value="Excellente" />
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <button onClick={() => openDoc(latestCv?.id, 'cv')} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: OMNIA_BLUE }}><Edit2 size={15} /> Modifier</button>
                <button className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-semibold" style={{ borderColor: BORDER, color: OMNIA_BLUE }}><Download size={15} /> Télécharger</button>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle title="Modèles recommandés" action="Voir tous les modèles" />
          <div className="grid grid-cols-3 gap-3">
            {(templates.length ? templates : fallbackCvTemplates).slice(0, 3).map((template, index) => (
              <button key={template.template_key} onClick={() => createDoc('cv', template.template_key)} className="text-left">
                <TemplateMini selected={index === 0} />
                <div className="mt-2 text-sm font-semibold" style={{ color: OMNIA_BLUE }}>{template.name_fr}</div>
                <div className="text-xs" style={{ color: MUTED }}>{template.description_fr || 'Modèle CV'}</div>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1fr_1fr]">
        <Card className="p-5">
          <SectionTitle title="Démarrage rapide" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-2">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button key={action.label} onClick={action.action} className="rounded-2xl border p-4 text-center transition hover:-translate-y-0.5 hover:shadow-md" style={{ borderColor: BORDER }}>
                  <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: 'rgba(0,32,80,0.08)' }}><Icon size={20} color={OMNIA_BLUE} /></div>
                  <div className="text-sm font-semibold" style={{ color: OMNIA_BLUE }}>{action.label}</div>
                  <div className="mt-1 text-xs" style={{ color: MUTED }}>Commencer</div>
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle title="Activité récente" action="Voir toute l’activité" />
          <div className="space-y-3 text-sm">
            <ActivityItem icon={FileText} title="CV principal mis à jour" date="10 mai 2025 à 16:42" />
            <ActivityItem icon={Mail} title="Lettre de motivation modifiée" date="9 mai 2025 à 11:15" />
            <ActivityItem icon={Calendar} title="Entretien planifié" date="8 mai 2025 à 09:30" />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-4xl" style={{ color: OMNIA_GOLD }}>“</div>
              <h2 className="text-base font-semibold" style={{ color: OMNIA_BLUE }}>Conseil du jour</h2>
              <p className="mt-4 text-sm leading-7" style={{ color: '#374151' }}>Un CV ciblé augmente vos chances d’entretien. Adaptez-le à chaque offre et ajoutez des résultats mesurables.</p>
              <button className="mt-5 rounded-xl border px-4 py-2 text-sm font-semibold" style={{ borderColor: 'rgba(191,136,19,0.35)', color: OMNIA_GOLD }}>Voir tous les conseils</button>
            </div>
            <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full" style={{ background: 'rgba(191,136,19,0.10)' }}><Sparkles size={28} color={OMNIA_GOLD} /></div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function ActionRow({ icon: Icon, title, subtitle, badge, onClick }: { icon: typeof FileText; title: string; subtitle: string; badge: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl border bg-white p-3 text-left hover:bg-gray-50" style={{ borderColor: BORDER }}>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'rgba(0,32,80,0.08)' }}><Icon size={18} color={OMNIA_BLUE} /></div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold" style={{ color: OMNIA_BLUE }}>{title}</div>
        <div className="truncate text-xs" style={{ color: MUTED }}>{subtitle}</div>
      </div>
      <SmallBadge tone={badge === 'Prioritaire' ? 'blue' : 'green'}>{badge}</SmallBadge>
      <ChevronRight size={16} color={MUTED} />
    </button>
  );
}

function MetricLine({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between"><span className="inline-flex items-center gap-2" style={{ color: '#374151' }}><CheckCircle2 size={15} color="#16A34A" />{label}</span><span className="font-semibold" style={{ color: '#16A34A' }}>{value}</span></div>;
}

function MiniCvPreview() {
  return (
    <div className="h-44 w-32 flex-shrink-0 overflow-hidden rounded-xl border bg-white shadow-sm" style={{ borderColor: BORDER }}>
      <div className="h-10 px-3 py-2" style={{ background: OMNIA_BLUE }}><div className="h-2 w-16 rounded bg-white/80" /><div className="mt-1 h-1.5 w-10 rounded" style={{ background: OMNIA_GOLD }} /></div>
      <div className="space-y-2 p-3">
        {[70, 90, 58, 82, 74, 64].map((width, i) => <div key={i} className="h-1.5 rounded bg-gray-200" style={{ width: `${width}%` }} />)}
        <div className="mt-3 grid grid-cols-2 gap-1">{[50, 80, 70, 60].map((width, i) => <div key={i} className="h-1 rounded" style={{ width: `${width}%`, background: 'rgba(0,32,80,0.25)' }} />)}</div>
      </div>
    </div>
  );
}

function TemplateMini({ selected = false }: { selected?: boolean }) {
  return (
    <div className="relative h-36 overflow-hidden rounded-xl border bg-white p-2" style={{ borderColor: selected ? OMNIA_GOLD : BORDER }}>
      {selected && <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full text-white" style={{ background: OMNIA_BLUE }}><CheckCircle2 size={12} /></div>}
      <div className="h-7 rounded-t" style={{ background: OMNIA_BLUE }} />
      <div className="space-y-1.5 p-2">
        {[80, 55, 95, 70, 88, 60].map((w, i) => <div key={i} className="h-1 rounded bg-gray-200" style={{ width: `${w}%` }} />)}
      </div>
      <div className="absolute bottom-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow"><Eye size={13} color={OMNIA_BLUE} /></div>
    </div>
  );
}

function ActivityItem({ icon: Icon, title, date }: { icon: typeof FileText; title: string; date: string }) {
  return <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'rgba(0,32,80,0.08)' }}><Icon size={16} color={OMNIA_BLUE} /></div><div className="flex-1"><div className="font-medium" style={{ color: OMNIA_BLUE }}>{title}</div><div className="text-xs" style={{ color: MUTED }}>{date}</div></div></div>;
}

function CvBuilderView({ documents, templates, createDoc, openDoc, deleteDoc }: { documents: CareerDocument[]; templates: Template[]; createDoc: (type: DocType, templateKey?: string) => void; openDoc: (id?: string, type?: DocType) => void; deleteDoc: (id: string) => void }) {
  const sections = ['Profil', 'Compétences', 'Expériences', 'Formation', 'Certifications', 'Langues', 'Centres d’intérêt'];
  return (
    <div className="space-y-5">
      <PageHeader title="CV Builder" subtitle="Créez un CV professionnel qui vous démarque." actionLabel="Nouveau CV" onAction={() => createDoc('cv')} />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[280px_1fr_330px]">
        <Card className="p-5">
          <h2 className="text-base font-semibold" style={{ color: OMNIA_BLUE }}>Sections du CV</h2>
          <p className="mt-1 text-sm" style={{ color: MUTED }}>Cliquez sur une section pour la modifier.</p>
          <div className="mt-4 space-y-3">
            {sections.map((section, index) => <div key={section} className="flex items-center justify-between rounded-xl border p-3" style={{ borderColor: BORDER }}><span className="text-sm font-medium" style={{ color: OMNIA_BLUE }}>{section}</span>{index < 6 ? <CheckCircle2 size={16} color="#16A34A" /> : <span className="h-4 w-4 rounded-full border" style={{ borderColor: BORDER }} />}</div>)}
          </div>
          <button onClick={() => openDoc(documents[0]?.id, 'cv')} className="mt-4 w-full rounded-xl border px-4 py-2 text-sm font-semibold" style={{ borderColor: OMNIA_GOLD, color: OMNIA_GOLD }}>+ Ajouter une section</button>
        </Card>
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-base font-semibold" style={{ color: OMNIA_BLUE }}>Aperçu en direct</h2><SmallBadge tone="green">Enregistré automatiquement</SmallBadge></div>
          <CvLargePreview />
        </Card>
        <Card className="p-5">
          <SectionTitle title="Modèle" action="Voir tous les modèles" />
          <div className="grid grid-cols-3 gap-3">{(templates.length ? templates : fallbackCvTemplates).slice(0, 3).map((t, i) => <button key={t.template_key} onClick={() => createDoc('cv', t.template_key)}><TemplateMini selected={i === 0} /><div className="mt-2 text-xs font-semibold" style={{ color: OMNIA_BLUE }}>{t.name_fr}</div></button>)}</div>
          <div className="mt-5 border-t pt-5" style={{ borderColor: BORDER }}><h3 className="text-base font-semibold" style={{ color: OMNIA_BLUE }}>Couleurs</h3><div className="mt-3 flex gap-3">{[OMNIA_BLUE, '#0F766E', '#111827', '#7E22CE', '#9F1239'].map((color) => <span key={color} className="h-8 w-8 rounded-full border-2" style={{ background: color, borderColor: color === OMNIA_BLUE ? OMNIA_GOLD : 'transparent' }} />)}</div></div>
          <OptimizationPanel />
          <div className="mt-5 space-y-2"><button onClick={() => openDoc(documents[0]?.id, 'cv')} className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{ background: OMNIA_BLUE }}>Modifier</button><button className="w-full rounded-xl border px-4 py-2.5 text-sm font-semibold" style={{ borderColor: BORDER, color: OMNIA_BLUE }}>Prévisualiser</button><button className="w-full rounded-xl border px-4 py-2.5 text-sm font-semibold" style={{ borderColor: BORDER, color: OMNIA_BLUE }}>Télécharger PDF</button></div>
        </Card>
      </div>
      <DocumentsList title="Mes CV" documents={documents} empty="Aucun CV enregistré pour le moment." createLabel="Créer un CV" onCreate={() => createDoc('cv')} onOpen={(id) => openDoc(id, 'cv')} onDelete={deleteDoc} />
    </div>
  );
}

function LettersView({ documents, templates, createDoc, openDoc, deleteDoc }: { documents: CareerDocument[]; templates: Template[]; createDoc: (type: DocType, templateKey?: string) => void; openDoc: (id?: string, type?: DocType) => void; deleteDoc: (id: string) => void }) {
  return (
    <div className="space-y-5">
      <PageHeader title="Lettres de motivation" subtitle="Créez des lettres personnalisées qui captent l’attention des recruteurs." actionLabel="Nouvelle lettre" onAction={() => createDoc('lm')} />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[270px_1fr_330px]">
        <Card className="p-5"><SectionTitle title="Mes lettres" /><div className="space-y-3">{(documents.length ? documents : [{ id: 'demo-lm', title: 'Développeur Full Stack', doc_type: 'lm' as DocType, updated_at: new Date().toISOString() }]).slice(0, 4).map((doc) => <button key={doc.id} onClick={() => doc.id === 'demo-lm' ? createDoc('lm') : openDoc(doc.id, 'lm')} className="w-full rounded-xl border p-3 text-left hover:bg-gray-50" style={{ borderColor: BORDER }}><div className="text-sm font-semibold" style={{ color: OMNIA_BLUE }}>{doc.title}</div><div className="text-xs" style={{ color: MUTED }}>Modifiée le {formatDate(doc.updated_at)}</div></button>)}</div></Card>
        <Card className="p-5"><LetterPreview /></Card>
        <Card className="p-5"><SectionTitle title="Suggestions IA" /><Suggestion title="Mettre en avant votre expérience" text="Soulignez vos projets complets et résultats mesurables." /><Suggestion title="Valoriser votre impact" text="Ajoutez des chiffres concrets pour renforcer votre candidature." /><div className="mt-5 border-t pt-5" style={{ borderColor: BORDER }}><SectionTitle title="Modèles LM" />{(templates.length ? templates : fallbackLmTemplates).slice(0, 3).map(t => <button key={t.template_key} onClick={() => createDoc('lm', t.template_key)} className="mb-2 flex w-full items-center justify-between rounded-xl border p-3 text-sm" style={{ borderColor: BORDER, color: OMNIA_BLUE }}><span>{t.name_fr}</span><ChevronRight size={16} /></button>)}</div></Card>
      </div>
      <DocumentsList title="Mes lettres enregistrées" documents={documents} empty="Aucune lettre enregistrée pour le moment." createLabel="Créer une lettre" onCreate={() => createDoc('lm')} onOpen={(id) => openDoc(id, 'lm')} onDelete={deleteDoc} />
    </div>
  );
}

function InterviewView() {
  return (
    <div className="space-y-5"><PageHeader title="Préparation entretien" subtitle="Entraînez-vous, maîtrisez les questions clés et gagnez en confiance." />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1fr_360px]"><Card className="p-5"><SectionTitle title="Catégories d’entretien" /><div className="grid gap-3 md:grid-cols-2">{['Développeur Full Stack', 'Data & Analytics', 'Product Manager', 'Design & UX/UI', 'Questions RH'].map((label, i) => <button key={label} className="rounded-xl border p-4 text-left" style={{ borderColor: BORDER }}><div className="text-sm font-semibold" style={{ color: OMNIA_BLUE }}>{label}</div><div className="text-xs" style={{ color: MUTED }}>{[28,22,20,18,35][i]} questions</div></button>)}</div></Card><Card className="p-5 text-white" style={{ background: OMNIA_BLUE }}><h2 className="text-base font-semibold">Simulation entretien</h2><p className="mt-2 text-sm text-white/75">Entraînez-vous dans des conditions réalistes avec feedback personnalisé.</p><div className="mt-5 space-y-3"><select className="h-10 w-full rounded-xl border border-white/20 bg-white/10 px-3 text-sm"><option>Développeur Full Stack</option></select><button className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white" style={{ background: OMNIA_GOLD }}>Commencer une simulation</button></div></Card><Card className="p-5"><SectionTitle title="Checklist STAR" />{['Situation', 'Tâche', 'Action', 'Résultat'].map((item) => <div key={item} className="mb-3 flex items-center justify-between rounded-xl border p-3" style={{ borderColor: BORDER }}><span className="text-sm font-medium" style={{ color: OMNIA_BLUE }}>{item}</span><span className="h-4 w-4 rounded border" style={{ borderColor: BORDER }} /></div>)}</Card></div>
      <Card className="p-5"><SectionTitle title="Questions fréquentes" action="Voir toutes les questions" /><div className="grid gap-3 md:grid-cols-2">{['Parlez-moi de vous.', 'Pourquoi voulez-vous rejoindre cette entreprise ?', 'Quels sont vos points forts ?', 'Décrivez un défi technique.'].map(q => <div key={q} className="rounded-xl border p-3 text-sm" style={{ borderColor: BORDER, color: OMNIA_BLUE }}>{q}</div>)}</div></Card>
    </div>
  );
}

function ApplicationsView() {
  const columns = ['À envoyer', 'Envoyées', 'Entretien', 'Offres', 'Refus'];
  return <div className="space-y-5"><PageHeader title="Suivi candidatures" subtitle="Suivez l’avancement de vos candidatures et ne manquez aucune opportunité." actionLabel="Ajouter une candidature" /> <div className="flex flex-wrap gap-3"><input className="h-10 w-72 rounded-xl border px-3 text-sm" style={{ borderColor: BORDER }} placeholder="Rechercher une candidature..." />{['Statut', 'Type de contrat', 'Lieu', 'Plus de filtres'].map(f => <button key={f} className="rounded-xl border bg-white px-4 py-2 text-sm" style={{ borderColor: BORDER }}>{f}</button>)}</div><div className="grid grid-cols-1 gap-4 xl:grid-cols-5">{columns.map((col, i) => <Card key={col} className={`p-4 ${i === 3 ? 'bg-green-50' : i === 4 ? 'bg-red-50' : ''}`}><div className="mb-4 flex items-center justify-between"><h2 className="text-base font-semibold" style={{ color: OMNIA_BLUE }}>{col}</h2><SmallBadge tone={i === 4 ? 'red' : i === 3 ? 'green' : 'blue'}>{[4,6,3,1,2][i]}</SmallBadge></div>{['TotalEnergies', 'BNP Paribas', 'Schneider Electric'].slice(0, i === 3 ? 1 : i === 4 ? 2 : 3).map((company, index) => <div key={`${col}-${company}`} className="mb-3 rounded-xl border bg-white p-3" style={{ borderColor: BORDER }}><div className="text-sm font-semibold" style={{ color: OMNIA_BLUE }}>{company}</div><div className="text-xs" style={{ color: MUTED }}>{['Ingénieur Data Analyst','Analyste Crédit','Entretien RH'][index]}</div><button className="mt-3 text-xs font-semibold" style={{ color: OMNIA_BLUE }}>{i === 2 ? 'Préparer l’entretien' : i === 3 ? 'Voir les détails' : 'Préparer ma candidature'}</button></div>)}<button className="mt-2 w-full rounded-xl border py-2 text-sm" style={{ borderColor: BORDER, color: OMNIA_BLUE }}>+ Ajouter une candidature</button></Card>)}</div></div>;
}

function ProfileView({ displayName }: { displayName: string }) {
  return <div className="space-y-5"><PageHeader title="Profil carrière" subtitle="Gérez votre profil professionnel et augmentez votre visibilité auprès des recruteurs." actionLabel="Modifier mon profil" /><div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1fr_1fr]"><Card className="p-5"><div className="flex items-center gap-4"><div className="flex h-20 w-20 items-center justify-center rounded-full text-xl font-bold text-white" style={{ background: OMNIA_BLUE }}>{getInitials(displayName)}</div><div><h2 className="text-lg font-semibold" style={{ color: OMNIA_BLUE }}>{displayName}</h2><p className="text-sm" style={{ color: MUTED }}>Développeur Full Stack</p><p className="text-sm" style={{ color: MUTED }}>Paris, France</p></div></div></Card><Card className="p-5"><SectionTitle title="Complétude du profil" /><div className="flex items-center gap-4"><div className="flex h-20 w-20 items-center justify-center rounded-full border-8 text-lg font-semibold" style={{ borderColor: '#16A34A', color: OMNIA_BLUE }}>82%</div><div><div className="text-sm font-semibold text-green-700">Excellent !</div><p className="text-sm" style={{ color: MUTED }}>Votre profil est bien renseigné.</p></div></div></Card><Card className="p-5"><SectionTitle title="Badges Omnia Global Academy" /><div className="flex gap-3"><Badge label="Full Stack" /><Badge label="Career" /><Badge label="Interview" /></div></Card></div><div className="grid grid-cols-1 gap-5 xl:grid-cols-2"><Card className="p-5"><SectionTitle title="Compétences" action="Modifier" /><div className="flex flex-wrap gap-2">{['JavaScript','TypeScript','React','Node.js','PostgreSQL','Docker','AWS'].map(s => <SmallBadge key={s}>{s}</SmallBadge>)}</div></Card><Card className="p-5"><SectionTitle title="Portfolio & Documents" action="Modifier" />{['CV Lina Amani.pdf','Lettre de motivation.pdf','Recommandation.pdf'].map(d => <div key={d} className="flex items-center justify-between border-b py-2 text-sm" style={{ borderColor: BORDER }}><span style={{ color: OMNIA_BLUE }}>{d}</span><Download size={15} color={MUTED} /></div>)}</Card></div></div>;
}

function CoachingView() {
  return <div className="space-y-5"><PageHeader title="Coaching carrière" subtitle="Avancez avec un accompagnement personnalisé pour atteindre vos objectifs professionnels." /><div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-5">{['Progression globale 72%','Sessions complétées 8','Objectifs atteints 3','Prochaine session 14 mai','Plan en cours 30 jours'].map((s) => <Card key={s} className="p-5"><div className="text-sm" style={{ color: MUTED }}>{s.split(' ').slice(0,-1).join(' ')}</div><div className="mt-2 text-2xl font-semibold" style={{ color: OMNIA_BLUE }}>{s.split(' ').at(-1)}</div></Card>)}</div><div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1fr_1fr]"><Card className="p-5"><SectionTitle title="Objectif professionnel" action="Modifier" /><div className="text-base font-semibold" style={{ color: OMNIA_BLUE }}>Devenir Développeur Full Stack</div><p className="mt-2 text-sm" style={{ color: MUTED }}>Évoluer vers un poste tech innovant d’ici 6 mois.</p></Card><Card className="p-5"><SectionTitle title="Plan 30 jours" /><p className="text-sm" style={{ color: MUTED }}>Renforcer mes compétences techniques.</p><button className="mt-4 rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: OMNIA_BLUE }}>Voir mon plan</button></Card><Card className="p-5 text-white" style={{ background: OMNIA_BLUE }}><h2 className="text-base font-semibold">Coaching IA</h2><p className="mt-2 text-sm text-white/75">Votre coach IA disponible 24/7.</p><button className="mt-5 w-full rounded-xl py-2 text-sm font-semibold text-white" style={{ background: OMNIA_GOLD }}>Poser une question</button></Card></div></div>;
}

function SettingsView({ packs, tokens }: { packs: TokenPack[]; tokens: number }) {
  return <div className="space-y-5"><PageHeader title="Paramètres" subtitle="Gérez vos préférences, votre compte et vos documents Omnia Career." /><div className="grid grid-cols-1 gap-5 xl:grid-cols-3"><Card className="p-5"><SectionTitle title="Compte" /><Field label="Nom complet" value="Lina Amani" /><Field label="Adresse e-mail" value="lina.amani@email.com" /></Card><Card className="p-5"><SectionTitle title="Notifications" />{['Nouvelles opportunités d’emploi','Mises à jour candidatures','Rappels entretien','Conseils carrière'].map(t => <div key={t} className="mb-3 flex items-center justify-between text-sm" style={{ color: OMNIA_BLUE }}><span>{t}</span><span className="h-5 w-9 rounded-full" style={{ background: OMNIA_BLUE }} /></div>)}</Card><Card className="p-5"><SectionTitle title="Jetons CV" /><div className="text-3xl font-semibold" style={{ color: OMNIA_BLUE }}>{tokens}</div><p className="text-sm" style={{ color: MUTED }}>jeton(s) disponible(s)</p>{(packs || []).slice(0,2).map(p => <div key={p.pack_key} className="mt-3 rounded-xl border p-3 text-sm" style={{ borderColor: BORDER }}><b>{p.name_fr}</b> — {p.tokens + (p.bonus_tokens || 0)} jetons</div>)}</Card></div></div>;
}

function PageHeader({ title, subtitle, actionLabel, onAction }: { title: string; subtitle: string; actionLabel?: string; onAction?: () => void }) {
  return <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold" style={{ color: OMNIA_BLUE }}>{title}</h1><p className="mt-1 text-sm" style={{ color: MUTED }}>{subtitle}</p></div>{actionLabel && <button onClick={onAction} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{ background: OMNIA_BLUE }}><Plus size={16} />{actionLabel}</button>}</div>;
}

function CvLargePreview() {
  return <div className="mx-auto max-w-[620px] rounded-2xl border bg-white p-6 shadow-sm" style={{ borderColor: BORDER }}><div className="-mx-6 -mt-6 mb-5 rounded-t-2xl px-8 py-5 text-white" style={{ background: OMNIA_BLUE }}><h2 className="text-2xl font-semibold tracking-wide">LINA AMANI</h2><p className="text-sm font-semibold" style={{ color: OMNIA_GOLD }}>DÉVELOPPEUSE FULL STACK</p></div><div className="mb-5 flex flex-wrap gap-4 text-xs" style={{ color: MUTED }}><span>lina.amani@email.com</span><span>+33 6 12 34 56 78</span><span>Paris, France</span><span>linkedin.com/in/linaamani</span></div><CvSection title="PROFIL" text="Développeuse Full Stack passionnée avec 4 ans d’expérience dans la conception et le développement d’applications web performantes." /><CvSection title="COMPÉTENCES" chips={['JavaScript','React','Next.js','Node.js','TypeScript','PostgreSQL','MongoDB','Docker']} /><CvSection title="EXPÉRIENCES PROFESSIONNELLES" text="Développeuse Full Stack — TechNova Solutions. Conception, optimisation et collaboration avec les équipes design et produit." /><CvSection title="FORMATION" text="Master en Informatique — Université Paris-Saclay." /></div>;
}

function CvSection({ title, text, chips }: { title: string; text?: string; chips?: string[] }) {
  return <div className="mb-5 border-t pt-4" style={{ borderColor: BORDER }}><h3 className="mb-2 text-sm font-semibold" style={{ color: OMNIA_BLUE }}>{title}</h3>{text && <p className="text-sm leading-6" style={{ color: '#374151' }}>{text}</p>}{chips && <div className="flex flex-wrap gap-2">{chips.map(c => <span key={c} className="rounded-lg px-2 py-1 text-xs font-medium" style={{ background: 'rgba(0,32,80,0.08)', color: OMNIA_BLUE }}>{c}</span>)}</div>}</div>;
}

function OptimizationPanel() {
  return <div className="mt-5 border-t pt-5" style={{ borderColor: BORDER }}><h3 className="text-base font-semibold" style={{ color: OMNIA_BLUE }}>Score d’optimisation</h3><div className="mt-4 flex items-center gap-4"><div className="flex h-20 w-20 items-center justify-center rounded-full border-8 text-lg font-semibold" style={{ borderColor: '#16A34A', color: OMNIA_BLUE }}>82</div><div><div className="text-sm font-semibold text-green-700">Très bon</div><p className="text-sm" style={{ color: MUTED }}>Votre CV est bien optimisé.</p></div></div><div className="mt-4 rounded-xl border p-3 text-sm" style={{ borderColor: BORDER }}><Sparkles size={15} color={OMNIA_GOLD} className="mr-2 inline" />Quantifiez vos réalisations</div></div>;
}

function LetterPreview() {
  return <div><div className="mb-4 flex gap-3 border-b pb-3" style={{ borderColor: BORDER }}>{['Paragraphe','B','I','U','•','🔗'].map(t => <span key={t} className="text-sm" style={{ color: OMNIA_BLUE }}>{t}</span>)}</div><div className="min-h-[520px] rounded-2xl border bg-white p-8 text-sm leading-7" style={{ borderColor: BORDER }}><p><b>Lina Amani</b><br />lina.amani@email.com<br />Paris, France</p><p className="mt-5 text-right">10 mai 2025</p><p className="mt-5"><b>Objet : Candidature au poste de Développeur Full Stack</b></p><p className="mt-5">Monsieur,</p><p className="mt-4">Passionnée par le développement web et les technologies innovantes, je souhaite vous proposer ma candidature au poste de Développeur Full Stack.</p><p className="mt-4">Rigoureuse, autonome et orientée résultats, je suis convaincue que mes compétences techniques seraient un atout pour vos projets ambitieux.</p><p className="mt-4">Dans l’attente de votre retour, je vous prie d’agréer, Monsieur, l’expression de mes salutations distinguées.</p><p className="mt-5">Lina Amani</p></div></div>;
}

function Suggestion({ title, text }: { title: string; text: string }) {
  return <div className="mb-3 rounded-2xl border p-4" style={{ borderColor: BORDER }}><div className="text-sm font-semibold" style={{ color: OMNIA_BLUE }}>{title}</div><p className="mt-1 text-sm" style={{ color: MUTED }}>{text}</p><button className="mt-3 rounded-xl border px-4 py-2 text-sm font-semibold" style={{ borderColor: BORDER, color: OMNIA_BLUE }}>Appliquer</button></div>;
}

function DocumentsList({ title, documents, empty, createLabel, onCreate, onOpen, onDelete }: { title: string; documents: CareerDocument[]; empty: string; createLabel: string; onCreate: () => void; onOpen: (id: string) => void; onDelete: (id: string) => void }) {
  return <Card className="p-5"><div className="mb-4 flex items-center justify-between"><h2 className="text-base font-semibold" style={{ color: OMNIA_BLUE }}>{title}</h2><button onClick={onCreate} className="rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: OMNIA_GOLD }}>{createLabel}</button></div>{documents.length === 0 ? <div className="rounded-2xl border border-dashed p-8 text-center" style={{ borderColor: BORDER }}><FileText className="mx-auto mb-3" color={MUTED} /><p className="text-sm" style={{ color: MUTED }}>{empty}</p></div> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{documents.map(doc => <div key={doc.id} className="rounded-2xl border p-4" style={{ borderColor: BORDER }}><div className="text-sm font-semibold" style={{ color: OMNIA_BLUE }}>{doc.title}</div><div className="mt-1 text-xs" style={{ color: MUTED }}>Mis à jour le {formatDate(doc.updated_at)}</div><div className="mt-4 flex gap-2"><button onClick={() => onOpen(doc.id)} className="rounded-xl px-3 py-2 text-xs font-semibold text-white" style={{ background: OMNIA_BLUE }}>Ouvrir</button><button onClick={() => onDelete(doc.id)} className="rounded-xl border px-3 py-2 text-xs font-semibold text-red-600" style={{ borderColor: BORDER }}><Trash2 size={13} /></button></div></div>)}</div>}</Card>;
}

function Badge({ label }: { label: string }) {
  return <div className="flex h-20 w-20 items-center justify-center rounded-2xl border text-center text-xs font-bold text-white" style={{ background: OMNIA_BLUE, borderColor: OMNIA_GOLD }}>{label}</div>;
}

function Field({ label, value }: { label: string; value: string }) {
  return <label className="mb-3 block text-sm font-medium" style={{ color: OMNIA_BLUE }}>{label}<input className="mt-1 h-10 w-full rounded-xl border px-3 text-sm" style={{ borderColor: BORDER }} value={value} readOnly /></label>;
}
