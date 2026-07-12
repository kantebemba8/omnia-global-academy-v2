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
  ExternalLink,
  FileText,
  Mail,
  MessageSquare,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { APPLICATION_MODE_SHORT_LABELS, JobApplicationMode, labelApplicationStatus, normalizeApplicationMode, STATUS_TONE } from '../../lib/jobApplicationModes';
import { getCareerTemplates, normalizeTemplateKey } from '../../lib/careerStudioData';

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

const fallbackCvTemplates: Template[] = getCareerTemplates('cv') as Template[];
const fallbackLmTemplates: Template[] = getCareerTemplates('lm') as Template[];

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

function Card({ children, className = '', style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`rounded-2xl border bg-white shadow-sm ${className}`} style={{ borderColor: BORDER, ...style }}>
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
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const user = readUser();
  const displayName = user?.full_name || user?.name || user?.email || 'Apprenant';
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

  useEffect(() => {
    const section = searchParams.get('section') || 'dashboard';
    const sectionMap: Record<string, ActiveView> = {
      dashboard: 'dashboard',
      cv: 'cv',
      builder: 'cv',
      letters: 'lm',
      lettre: 'lm',
      lm: 'lm',
      interview: 'interview',
      entretien: 'interview',
      applications: 'applications',
      candidatures: 'applications',
      profile: 'profile',
      profil: 'profile',
      coaching: 'coaching',
      settings: 'settings',
      parametres: 'settings',
    };
    setActiveView(sectionMap[section] || 'dashboard');
  }, [searchParams]);

  function goToView(view: ActiveView) {
    const sectionQuery: Record<ActiveView, string> = {
      dashboard: '',
      cv: 'section=cv',
      lm: 'section=lm',
      interview: 'section=interview',
      applications: 'section=applications',
      profile: 'section=profile',
      coaching: 'section=coaching',
      settings: 'section=settings',
    };
    const currentJob = searchParams.get('job_id');
    const base = sectionQuery[view];
    const query = [base, currentJob && (view === 'interview' || view === 'applications') ? `job_id=${encodeURIComponent(currentJob)}` : ''].filter(Boolean).join('&');
    navigate(`/dashboard/career-studio${query ? `?${query}` : ''}`);
  }

  function createDoc(docType: DocType, templateKey?: string) {
    const templates = docType === 'cv' ? cvTemplates : lmTemplates;
    const chosen = normalizeTemplateKey(docType, templateKey || templates[0]?.template_key || undefined);
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
    { label: 'Préparer entretien', icon: MessageSquare, action: () => goToView('interview') },
    { label: 'Évaluer mon profil', icon: Star, action: () => goToView('profile') },
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

          <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => goToView(item.id)}
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
          <div className="border-t border-white/10 px-3 py-3">
            <button
              type="button"
              onClick={() => goToView('settings')}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-white/10"
              style={{ color: OMNIA_GOLD }}
            >
              <Crown size={18} />
              <span>Passer à Premium</span>
            </button>
          </div>
        </aside>

        {/* Main */}
        <div className="ml-[280px] flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b bg-white px-8" style={{ borderColor: BORDER }}>
            <div className="flex h-11 w-full max-w-[560px] items-center rounded-2xl border bg-white px-4" style={{ borderColor: BORDER }}>
              <Search size={18} color="#9CA3AF" />
              <input className="ml-3 h-full flex-1 border-0 bg-transparent text-sm outline-none" placeholder="Rechercher un CV, une offre, un conseil..." />
            </div>
            <div className="ml-6 flex items-center gap-4">
              <button className="relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100" aria-label="Notifications">
                <Bell size={18} color={OMNIA_BLUE} />
              </button>
              <div className="h-8 w-px bg-gray-200" />
              <div className="relative">
                <button onClick={() => setProfileMenuOpen((v) => !v)} className="flex items-center gap-3 rounded-xl px-2 py-1 hover:bg-gray-100">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: OMNIA_BLUE }}>{initials}</div>
                  <div className="hidden text-left md:block">
                    <div className="text-sm font-semibold" style={{ color: OMNIA_BLUE }}>{displayName}</div>
                    <div className="text-xs" style={{ color: MUTED }}>Apprenant</div>
                  </div>
                  <ChevronDown size={16} color={MUTED} className={profileMenuOpen ? 'rotate-180' : ''} />
                </button>
                {profileMenuOpen && (
                  <div className="absolute right-0 top-12 z-50 w-64 rounded-2xl border bg-white p-2 shadow-xl" style={{ borderColor: BORDER }}>
                    <button onClick={() => navigate('/dashboard')} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold hover:bg-gray-50" style={{ color: OMNIA_BLUE }}>
                      <ChevronRight size={17} className="rotate-180" /> Retour au Dashboard
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <main className="flex-1 px-8 py-7">
            {activeView === 'dashboard' && <DashboardView loading={loading} cvDocs={cvDocs} lmDocs={lmDocs} latestCv={latestCv} latestLm={latestLm} templates={cvTemplates} tokens={tokens} quickActions={quickActions} setActiveView={setActiveView} createDoc={createDoc} openDoc={openDoc} />}
            {activeView === 'cv' && <CvBuilderView documents={cvDocs} templates={cvTemplates} createDoc={createDoc} openDoc={openDoc} deleteDoc={deleteDoc} />}
            {activeView === 'lm' && <LettersView documents={lmDocs} templates={lmTemplates} createDoc={createDoc} openDoc={openDoc} deleteDoc={deleteDoc} />}
            {activeView === 'interview' && <InterviewView jobId={searchParams.get('job_id') || undefined} />}
            {activeView === 'applications' && <ApplicationsView jobId={searchParams.get('job_id') || undefined} navigate={navigate} />}
            {activeView === 'profile' && <ProfileView displayName={displayName} />}
            {activeView === 'coaching' && <CoachingView />}
            {activeView === 'settings' && <SettingsView packs={packs} tokens={tokens} user={user} />}
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
                <h3 className="text-lg font-semibold" style={{ color: OMNIA_BLUE }}>{latestCv?.title || 'Aucun CV créé'}</h3>
                <SmallBadge>Principal</SmallBadge>
              </div>
              <p className="mt-1 text-sm" style={{ color: MUTED }}>Mis à jour le {formatDate(latestCv?.updated_at)}</p>
              <div className="mt-4 space-y-2 text-sm">
                <MetricLine label="Score d’optimisation" value={`${latestCv?.ats_score ?? 0}/100`} />
                
                
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
                <TemplateMini template={template} selected={index === 0} />
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

function templateMockupPath(templateKey: string) {
  return `/career-template-mockups/individual/${templateKey}.webp`;
}

function TemplateMini({ template, selected = false }: { template: Template; selected?: boolean }) {
  return (
    <div className="group relative aspect-[9/11] w-full overflow-hidden rounded-xl border bg-white shadow-sm" style={{ borderColor: selected ? OMNIA_GOLD : BORDER }}>
      <img src={templateMockupPath(template.template_key)} alt={template.name_fr} className="h-full w-full object-cover object-top transition duration-200 group-hover:scale-[1.02]" />
      {selected && <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-white shadow" style={{ background: OMNIA_BLUE }}><CheckCircle2 size={14} /></div>}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-2 pt-8 text-xs font-semibold text-white">{template.name_fr}</div>
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
            {sections.map((section) => <div key={section} className="flex items-center justify-between rounded-xl border p-3" style={{ borderColor: BORDER }}><span className="text-sm font-medium" style={{ color: OMNIA_BLUE }}>{section}</span><span className="h-4 w-4 rounded-full border" style={{ borderColor: BORDER }} /></div>)}
          </div>
          <button onClick={() => openDoc(documents[0]?.id, 'cv')} className="mt-4 w-full rounded-xl border px-4 py-2 text-sm font-semibold" style={{ borderColor: OMNIA_GOLD, color: OMNIA_GOLD }}>+ Ajouter une section</button>
        </Card>
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-base font-semibold" style={{ color: OMNIA_BLUE }}>Aperçu en direct</h2><SmallBadge tone="green">Enregistré automatiquement</SmallBadge></div>
          <CvLargePreview />
        </Card>
        <Card className="p-5">
          <SectionTitle title="Modèle" action="Voir tous les modèles" />
          <div className="grid grid-cols-3 gap-3">{(templates.length ? templates : fallbackCvTemplates).slice(0, 3).map((t, i) => <button key={t.template_key} onClick={() => createDoc('cv', t.template_key)}><TemplateMini template={t} selected={i === 0} /><div className="mt-2 text-xs font-semibold" style={{ color: OMNIA_BLUE }}>{t.name_fr}</div></button>)}</div>
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
        <Card className="p-5"><SectionTitle title="Mes lettres" />{documents.length ? <div className="space-y-3">{documents.slice(0, 4).map((doc) => <button key={doc.id} onClick={() => openDoc(doc.id, 'lm')} className="w-full rounded-xl border p-3 text-left hover:bg-gray-50" style={{ borderColor: BORDER }}><div className="text-sm font-semibold" style={{ color: OMNIA_BLUE }}>{doc.title}</div><div className="text-xs" style={{ color: MUTED }}>Modifiée le {formatDate(doc.updated_at)}</div></button>)}</div> : <EmptyState text="Aucune lettre créée." action="Créer ma première lettre" onAction={() => createDoc('lm')} />}</Card>
        <Card className="p-5"><LetterPreview /></Card>
        <Card className="p-5"><SectionTitle title="Suggestions IA" /><Suggestion title="Mettre en avant votre expérience" text="Soulignez vos projets complets et résultats mesurables." /><Suggestion title="Valoriser votre impact" text="Ajoutez des chiffres concrets pour renforcer votre candidature." /><div className="mt-5 border-t pt-5" style={{ borderColor: BORDER }}><SectionTitle title="Modèles LM" />{(templates.length ? templates : fallbackLmTemplates).slice(0, 3).map(t => <button key={t.template_key} onClick={() => createDoc('lm', t.template_key)} className="mb-2 flex w-full items-center justify-between rounded-xl border p-3 text-sm" style={{ borderColor: BORDER, color: OMNIA_BLUE }}><span>{t.name_fr}</span><ChevronRight size={16} /></button>)}</div></Card>
      </div>
      <DocumentsList title="Mes lettres enregistrées" documents={documents} empty="Aucune lettre enregistrée pour le moment." createLabel="Créer une lettre" onCreate={() => createDoc('lm')} onOpen={(id) => openDoc(id, 'lm')} onDelete={deleteDoc} />
    </div>
  );
}

function InterviewView({ jobId }: { jobId?: string }) {
  const [targetJob, setTargetJob] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!jobId || !SUPABASE_URL) return;
    setLoading(true);
    fetch(`${SUPABASE_URL}/functions/v1/career-application-track`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('omnia_session_token') || ''}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get', job_id: jobId }),
    })
      .then((r) => r.json())
      .then((d) => setTargetJob(d.job || null))
      .catch(() => setTargetJob(null))
      .finally(() => setLoading(false));
  }, [jobId]);

  const questions = targetJob ? [
    `Pourquoi êtes-vous intéressé(e) par le poste ${targetJob.title} ?`,
    `Quelles compétences de votre CV correspondent le mieux à cette offre ?`,
    `Décrivez une situation où vous avez démontré une compétence clé demandée par ${targetJob.recruiter_company || 'l’entreprise'}.`,
    'Préparez une réponse STAR sur un projet ou une expérience pertinente.',
  ] : ['Parlez-moi de vous.', 'Pourquoi voulez-vous rejoindre cette entreprise ?', 'Quels sont vos points forts ?', 'Décrivez un défi technique.'];

  return (
    <div className="space-y-5">
      <PageHeader title="Préparation entretien" subtitle={targetJob ? `Préparation personnalisée pour l’offre ${targetJob.title}.` : 'Entraînez-vous, maîtrisez les questions clés et gagnez en confiance.'} />
      {targetJob && <Card className="p-5" style={{ borderColor: 'rgba(191,136,19,0.35)', background: 'rgba(191,136,19,0.06)' } as any}><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-semibold" style={{ color: OMNIA_BLUE }}>Offre ciblée</h2><p className="mt-1 text-sm" style={{ color: MUTED }}>{targetJob.title} — {targetJob.recruiter_company || 'Entreprise'}</p><div className="mt-3 flex flex-wrap gap-2">{(targetJob.skills_required || []).slice(0, 6).map((skill: string) => <SmallBadge key={skill} tone="gold">{skill}</SmallBadge>)}</div></div><SmallBadge tone="gold">IA adaptée à l’offre</SmallBadge></div></Card>}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1fr_360px]">
        <Card className="p-5"><SectionTitle title="Questions probables" action={loading ? 'Chargement…' : undefined} /><div className="space-y-3">{questions.map((q) => <div key={q} className="rounded-xl border p-3 text-sm" style={{ borderColor: BORDER, color: OMNIA_BLUE }}>{q}</div>)}</div></Card>
        <Card className="p-5 text-white" style={{ background: OMNIA_BLUE }}><h2 className="text-base font-semibold">Simulation entretien</h2><p className="mt-2 text-sm text-white/75">Entraînez-vous dans des conditions réalistes avec feedback personnalisé.</p><div className="mt-5 space-y-3"><select className="h-10 w-full rounded-xl border border-white/20 bg-white/10 px-3 text-sm"><option>{targetJob?.title || 'Entretien général'}</option></select><button className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white" style={{ background: OMNIA_GOLD }}>Commencer une simulation</button></div></Card>
        <Card className="p-5"><SectionTitle title="Checklist STAR" />{['Situation', 'Tâche', 'Action', 'Résultat'].map((item) => <div key={item} className="mb-3 flex items-center justify-between rounded-xl border p-3" style={{ borderColor: BORDER }}><span className="text-sm font-medium" style={{ color: OMNIA_BLUE }}>{item}</span><span className="h-4 w-4 rounded border" style={{ borderColor: BORDER }} /></div>)}</Card>
      </div>
      <Card className="p-5"><SectionTitle title="À préparer avant l’entretien" /><div className="grid gap-3 md:grid-cols-3">{['Relire l’offre et relever les mots-clés', 'Préparer 3 exemples STAR', 'Préparer 3 questions à poser'].map(q => <div key={q} className="rounded-xl border p-3 text-sm" style={{ borderColor: BORDER, color: OMNIA_BLUE }}>{q}</div>)}</div></Card>
    </div>
  );
}

type TrackedApplication = {
  id: string;
  status?: string;
  tracking_status?: string;
  application_mode?: JobApplicationMode | string | null;
  submitted_at?: string;
  job_offers?: { id?: string; title?: string; recruiter_company?: string; location?: string; contract_type?: string; application_mode?: string; external_apply_url?: string; external_apply_email?: string } | null;
  source?: 'platform' | 'manual';
  company_name?: string;
  job_title?: string;
  job_url?: string;
};

function toneClass(tone: string) {
  if (tone === 'green') return 'bg-emerald-50 text-emerald-700';
  if (tone === 'purple') return 'bg-purple-50 text-purple-700';
  if (tone === 'red') return 'bg-red-50 text-red-700';
  if (tone === 'gold') return 'bg-amber-50 text-amber-700';
  if (tone === 'gray') return 'bg-gray-100 text-gray-600';
  return 'bg-blue-50 text-blue-700';
}

function ApplicationsView({ jobId, navigate }: { jobId?: string; navigate: (path: string) => void }) {
  const [apps, setApps] = useState<TrackedApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [targetJob, setTargetJob] = useState<any | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState({ company_name: '', job_title: '', job_url: '', location: '', contract_type: 'CDI' });

  async function callTrack(body: unknown) {
    if (!SUPABASE_URL) return { success: false, platform_applications: [], manual_applications: [] };
    const res = await fetch(`${SUPABASE_URL}/functions/v1/career-application-track`, { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('omnia_session_token') || ''}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error('career-application-track failed');
    return res.json();
  }

  async function loadApplications() {
    setLoading(true);
    try {
      const d = await callTrack({ action: 'list' });
      const platform = (d.platform_applications || []).map((a: TrackedApplication) => ({ ...a, source: 'platform' as const }));
      const manualApps = (d.manual_applications || []).map((a: any) => ({ ...a, id: `manual-${a.id}`, source: 'manual' as const, job_offers: { id: a.job_id, title: a.job_title, recruiter_company: a.company_name, location: a.location, contract_type: a.contract_type, application_mode: a.application_mode, external_apply_url: a.job_url } }));
      setApps([...platform, ...manualApps]);
    } catch {
      setApps([]);
    } finally { setLoading(false); }
  }

  useEffect(() => { loadApplications(); }, []);

  useEffect(() => {
    if (!jobId) return;
    callTrack({ action: 'get', job_id: jobId }).then((d) => setTargetJob(d.job || null)).catch(() => setTargetJob(null));
  }, [jobId]);

  async function prepareJob() {
    if (!jobId) return;
    const d = await callTrack({ action: 'prepare_job', job_id: jobId });
    if (d.success) loadApplications();
  }

  async function addManual() {
    if (!manual.company_name || !manual.job_title) return;
    const d = await callTrack({ action: 'create_manual', ...manual, application_mode: 'external_link', status: 'draft' });
    if (d.success) { setShowManual(false); setManual({ company_name: '', job_title: '', job_url: '', location: '', contract_type: 'CDI' }); loadApplications(); }
  }

  const shown = apps;
  const columns = [
    { title: 'À préparer', statuses: ['draft', 'prepared'], countTone: 'gray' },
    { title: 'Envoyées', statuses: ['redirected', 'email_prepared', 'declared_sent', 'submitted', 'received', 'waiting_response'], countTone: 'blue' },
    { title: 'En analyse', statuses: ['viewed', 'under_review', 'shortlisted', 'response_received', 'follow_up_recommended', 'followed_up'], countTone: 'gold' },
    { title: 'Entretien', statuses: ['interview'], countTone: 'purple' },
    { title: 'Finalisées', statuses: ['accepted', 'rejected', 'archived'], countTone: 'green' },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Suivi candidatures" subtitle="Suivez les candidatures Omnia, les candidatures externes et vos candidatures manuelles." actionLabel="Ajouter une candidature" onAction={() => setShowManual(true)} />
      {targetJob && <Card className="p-5" style={{ borderColor: 'rgba(191,136,19,0.35)', background: 'rgba(191,136,19,0.06)' } as any}><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-semibold" style={{ color: OMNIA_BLUE }}>Préparation candidature liée à une offre</h2><p className="mt-1 text-sm" style={{ color: MUTED }}>{targetJob.title} — {targetJob.recruiter_company || 'Entreprise'}</p><p className="mt-2 text-xs" style={{ color: MUTED }}>Omnia Career peut vous aider à adapter le CV, générer la lettre et préparer l’entretien.</p></div><div className="flex flex-wrap gap-2"><button onClick={prepareJob} className="rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: OMNIA_BLUE }}>Préparer dans mon suivi</button><button onClick={() => navigate(`/dashboard/career-studio/editor/new?type=cv&job_id=${jobId}`)} className="rounded-xl border px-4 py-2 text-sm font-semibold" style={{ borderColor: BORDER, color: OMNIA_BLUE }}>Adapter mon CV</button><button onClick={() => navigate(`/dashboard/career-studio?section=interview&job_id=${jobId}`)} className="rounded-xl border px-4 py-2 text-sm font-semibold" style={{ borderColor: BORDER, color: OMNIA_BLUE }}>Préparer entretien</button></div></div></Card>}
      <div className="flex flex-wrap gap-3"><input className="h-10 w-72 rounded-xl border px-3 text-sm" style={{ borderColor: BORDER }} placeholder="Rechercher une candidature..." />{['Statut', 'Type de contrat', 'Source', 'Mode'].map(f => <button key={f} className="rounded-xl border bg-white px-4 py-2 text-sm" style={{ borderColor: BORDER }}>{f}</button>)}</div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">{columns.map((col) => { const items = shown.filter((app) => col.statuses.includes((app.tracking_status || app.status || 'draft'))); return <Card key={col.title} className="p-4"><div className="mb-4 flex items-center justify-between"><h2 className="text-base font-semibold" style={{ color: OMNIA_BLUE }}>{col.title}</h2><SmallBadge tone={col.countTone as any}>{items.length}</SmallBadge></div><div className="space-y-3">{items.map((app) => { const status = app.tracking_status || app.status || 'draft'; const mode = normalizeApplicationMode(app.application_mode || app.job_offers?.application_mode); const tone = STATUS_TONE[status] || 'blue'; return <div key={app.id} className="rounded-xl border bg-white p-3" style={{ borderColor: BORDER }}><div className="text-sm font-semibold" style={{ color: OMNIA_BLUE }}>{app.job_offers?.title || app.job_title}</div><div className="text-xs" style={{ color: MUTED }}>{app.job_offers?.recruiter_company || app.company_name || 'Entreprise'} · {app.job_offers?.contract_type || 'Contrat'}</div><div className="mt-3 flex flex-wrap gap-2"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${toneClass(tone)}`}>{labelApplicationStatus(status)}</span><span className="rounded-full px-2 py-1 text-xs font-semibold" style={{ background: mode === 'omnia_managed' ? 'rgba(0,32,80,0.08)' : 'rgba(191,136,19,0.12)', color: mode === 'omnia_managed' ? OMNIA_BLUE : OMNIA_GOLD }}>{mode === 'external_link' ? <ExternalLink className="mr-1 inline h-3 w-3" /> : mode === 'external_email' ? <Mail className="mr-1 inline h-3 w-3" /> : <ShieldCheck className="mr-1 inline h-3 w-3" />}{APPLICATION_MODE_SHORT_LABELS[mode]}</span></div><button onClick={() => mode === 'omnia_managed' ? navigate(`/emploi/${app.job_offers?.id || ''}`) : undefined} className="mt-3 text-xs font-semibold" style={{ color: OMNIA_BLUE }}>{status === 'interview' ? 'Préparer l’entretien' : mode === 'omnia_managed' ? 'Voir l’offre' : 'Mettre à jour'} →</button></div>; })}</div></Card>; })}</div>
      {!loading && shown.length === 0 && <Card className="p-8"><EmptyState text="Aucune candidature suivie pour le moment." action="Ajouter une candidature" onAction={() => setShowManual(true)} /></Card>}
      {showManual && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl"><h2 className="text-lg font-semibold" style={{ color: OMNIA_BLUE }}>Ajouter une candidature manuelle</h2><div className="mt-4 grid gap-3"><input value={manual.company_name} onChange={(e) => setManual({ ...manual, company_name: e.target.value })} placeholder="Entreprise" className="h-11 rounded-xl border px-3 text-sm" style={{ borderColor: BORDER }} /><input value={manual.job_title} onChange={(e) => setManual({ ...manual, job_title: e.target.value })} placeholder="Poste" className="h-11 rounded-xl border px-3 text-sm" style={{ borderColor: BORDER }} /><input value={manual.job_url} onChange={(e) => setManual({ ...manual, job_url: e.target.value })} placeholder="Lien de l’offre" className="h-11 rounded-xl border px-3 text-sm" style={{ borderColor: BORDER }} /><input value={manual.location} onChange={(e) => setManual({ ...manual, location: e.target.value })} placeholder="Lieu" className="h-11 rounded-xl border px-3 text-sm" style={{ borderColor: BORDER }} /></div><div className="mt-5 flex justify-end gap-3"><button onClick={() => setShowManual(false)} className="rounded-xl border px-4 py-2 text-sm" style={{ borderColor: BORDER }}>Annuler</button><button onClick={addManual} className="rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: OMNIA_BLUE }}>Ajouter</button></div></div></div>}
    </div>
  );
}

function ProfileView({ displayName }: { displayName: string }) {
  return <div className="space-y-5"><PageHeader title="Profil carrière" subtitle="Vos informations professionnelles réelles apparaîtront ici." /><Card className="p-6"><div className="flex items-center gap-4"><div className="flex h-20 w-20 items-center justify-center rounded-full text-xl font-bold text-white" style={{ background: OMNIA_BLUE }}>{getInitials(displayName)}</div><div><h2 className="text-lg font-semibold" style={{ color: OMNIA_BLUE }}>{displayName}</h2><p className="text-sm" style={{ color: MUTED }}>Complétez votre profil carrière pour ajouter un poste, une localisation, des compétences et vos documents.</p></div></div></Card><EmptyState text="Aucune donnée professionnelle enregistrée pour le moment." action="Compléter mon profil" /></div>;
}

function CoachingView() {
  const [question, setQuestion] = useState('');
  return <div className="space-y-5"><PageHeader title="Coaching carrière IA" subtitle="Un accompagnement personnalisé basé uniquement sur vos objectifs et vos documents." /><div className="grid gap-5 xl:grid-cols-2"><Card className="p-6"><SectionTitle title="Démarrer mon coaching" /><p className="text-sm" style={{ color: MUTED }}>Décrivez votre objectif, votre difficulté ou le poste recherché. Aucune progression fictive n’est affichée.</p><textarea value={question} onChange={e => setQuestion(e.target.value)} className="mt-4 min-h-40 w-full rounded-xl border p-3 text-sm" style={{ borderColor: BORDER }} placeholder="Exemple : Je recherche un stage QHSE au Luxembourg et je veux améliorer ma stratégie de candidature." /><button disabled={!question.trim()} className="mt-3 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40" style={{ background: OMNIA_BLUE }}>Lancer le coaching IA</button></Card><Card className="p-6"><SectionTitle title="Mon historique" /><EmptyState text="Aucune session de coaching enregistrée." /></Card></div></div>;
}

function SettingsView({ packs, tokens, user }: { packs: TokenPack[]; tokens: number; user: any }) {
  const name = user?.full_name || user?.name || '';
  const email = user?.email || '';
  return <div className="space-y-5"><PageHeader title="Paramètres" subtitle="Gérez vos informations réelles et les préférences Omnia Career." /><div className="grid grid-cols-1 gap-5 xl:grid-cols-3"><Card className="p-5"><SectionTitle title="Compte" /><Field label="Nom complet" value={name} /><Field label="Adresse e-mail" value={email} />{!name && !email && <p className="text-sm" style={{ color: MUTED }}>Aucune donnée de compte disponible.</p>}</Card><Card className="p-5"><SectionTitle title="Notifications" /><p className="text-sm" style={{ color: MUTED }}>Les préférences seront enregistrées quand vous les activerez. Aucun réglage fictif n’est précoché.</p></Card><Card className="p-5"><SectionTitle title="Jetons CV" /><div className="text-3xl font-semibold" style={{ color: OMNIA_BLUE }}>{tokens}</div><p className="text-sm" style={{ color: MUTED }}>jeton(s) disponible(s)</p>{(packs || []).slice(0,2).map(p => <div key={p.pack_key} className="mt-3 rounded-xl border p-3 text-sm" style={{ borderColor: BORDER }}><b>{p.name_fr}</b> — {p.tokens + (p.bonus_tokens || 0)} jetons</div>)}</Card></div></div>;
}

function PageHeader({ title, subtitle, actionLabel, onAction }: { title: string; subtitle: string; actionLabel?: string; onAction?: () => void }) {
  return <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold" style={{ color: OMNIA_BLUE }}>{title}</h1><p className="mt-1 text-sm" style={{ color: MUTED }}>{subtitle}</p></div>{actionLabel && <button onClick={onAction} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{ background: OMNIA_BLUE }}><Plus size={16} />{actionLabel}</button>}</div>;
}

function CvLargePreview() {
  return <EmptyState text="Ouvrez ou créez un CV pour afficher son aperçu réel." />;
}

function CvSection({ title, text, chips }: { title: string; text?: string; chips?: string[] }) {
  return <div className="mb-5 border-t pt-4" style={{ borderColor: BORDER }}><h3 className="mb-2 text-sm font-semibold" style={{ color: OMNIA_BLUE }}>{title}</h3>{text && <p className="text-sm leading-6" style={{ color: '#374151' }}>{text}</p>}{chips && <div className="flex flex-wrap gap-2">{chips.map(c => <span key={c} className="rounded-lg px-2 py-1 text-xs font-medium" style={{ background: 'rgba(0,32,80,0.08)', color: OMNIA_BLUE }}>{c}</span>)}</div>}</div>;
}

function OptimizationPanel() {
  return <div className="mt-5 border-t pt-5" style={{ borderColor: BORDER }}><h3 className="text-base font-semibold" style={{ color: OMNIA_BLUE }}>Score d’optimisation</h3><p className="mt-2 text-sm" style={{ color: MUTED }}>Le score sera calculé à partir des vraies sections remplies dans votre CV.</p></div>;
}

function LetterPreview() {
  return <EmptyState text="Créez ou ouvrez une lettre pour afficher son contenu réel." />;
}

function Suggestion({ title, text }: { title: string; text: string }) {
  return <div className="mb-3 rounded-2xl border p-4" style={{ borderColor: BORDER }}><div className="text-sm font-semibold" style={{ color: OMNIA_BLUE }}>{title}</div><p className="mt-1 text-sm" style={{ color: MUTED }}>{text}</p><button className="mt-3 rounded-xl border px-4 py-2 text-sm font-semibold" style={{ borderColor: BORDER, color: OMNIA_BLUE }}>Appliquer</button></div>;
}

function EmptyState({ text, action, onAction }: { text: string; action?: string; onAction?: () => void }) {
  return <div className="rounded-2xl border border-dashed p-8 text-center" style={{ borderColor: BORDER }}><FileText className="mx-auto mb-3" color={MUTED} /><p className="text-sm" style={{ color: MUTED }}>{text}</p>{action && <button onClick={onAction} className="mt-4 rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: OMNIA_BLUE }}>{action}</button>}</div>;
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
