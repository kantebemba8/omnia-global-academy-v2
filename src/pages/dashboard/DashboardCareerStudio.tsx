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
  AlertCircle,
  Check,
  RefreshCw,
} from 'lucide-react';
import { APPLICATION_MODE_SHORT_LABELS, JobApplicationMode, labelApplicationStatus, normalizeApplicationMode, STATUS_TONE } from '../../lib/jobApplicationModes';
import { getCareerTemplates, normalizeTemplateKey } from '../../lib/careerStudioData';
import { ENDPOINTS } from '../../lib/config';

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
  thumbnail_url?: string;
  is_custom?: boolean;
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
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const user = readUser();
  const displayName = user?.full_name || user?.name || user?.email || 'Apprenant';
  const initials = getInitials(displayName, user?.email);

  const cvDocs = useMemo(() => documents.filter((doc) => doc.doc_type === 'cv'), [documents]);
  const lmDocs = useMemo(() => documents.filter((doc) => doc.doc_type === 'lm'), [documents]);
  const latestCv = cvDocs[0];
  const latestLm = lmDocs[0];

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [] as Array<{ label: string; subtitle: string; action: () => void }>;
    const pages = navItems
      .filter(item => item.label.toLowerCase().includes(q))
      .map(item => ({ label: item.label, subtitle: 'Page Omnia Career', action: () => goToView(item.id) }));
    const docs = documents
      .filter(doc => `${doc.title} ${doc.doc_type}`.toLowerCase().includes(q))
      .map(doc => ({ label: doc.title, subtitle: doc.doc_type === 'cv' ? 'CV' : 'Lettre de motivation', action: () => openDoc(doc.id, doc.doc_type) }));
    const models = [...cvTemplates, ...lmTemplates]
      .filter(t => `${t.name_fr} ${t.description_fr || ''}`.toLowerCase().includes(q))
      .map(t => ({ label: t.name_fr, subtitle: t.template_key.startsWith('lm_') ? 'Modèle LM' : 'Modèle CV', action: () => createDoc(t.template_key.startsWith('lm_') ? 'lm' : 'cv', t.template_key) }));
    return [...pages, ...docs, ...models].slice(0, 12);
  }, [searchQuery, documents, cvTemplates, lmTemplates]);

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
              className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-[#002050] shadow-sm transition hover:brightness-105"
              style={{ background: OMNIA_GOLD }}
            >
              <Crown size={17} />
              <span>Passer à Premium</span>
            </button>
          </div>
        </aside>

        {/* Main */}
        <div className="ml-[280px] flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b bg-white px-8" style={{ borderColor: BORDER }}>
            <div className="relative w-full max-w-[560px]">
              <div className="flex h-11 items-center rounded-2xl border bg-white px-4" style={{ borderColor: BORDER }}>
                <Search size={18} color="#9CA3AF" />
                <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="ml-3 h-full flex-1 border-0 bg-transparent text-sm outline-none" placeholder="Rechercher dans Omnia Career..." />
                {searchQuery && <button onClick={() => setSearchQuery('')} className="rounded-full p-1 hover:bg-slate-100"><X size={15} color={MUTED} /></button>}
              </div>
              {searchQuery && (
                <div className="absolute left-0 right-0 top-13 z-50 max-h-80 overflow-y-auto rounded-2xl border bg-white p-2 shadow-xl" style={{ borderColor: BORDER }}>
                  {searchResults.length ? searchResults.map((result, index) => (
                    <button key={`${result.label}-${index}`} onClick={() => { result.action(); setSearchQuery(''); }} className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left hover:bg-slate-50">
                      <span><span className="block text-sm font-semibold" style={{ color: OMNIA_BLUE }}>{result.label}</span><span className="text-xs" style={{ color: MUTED }}>{result.subtitle}</span></span><ChevronRight size={15} color={MUTED} />
                    </button>
                  )) : <div className="px-3 py-5 text-center text-sm" style={{ color: MUTED }}>Aucun résultat.</div>}
                </div>
              )}
            </div>
            <div className="ml-6 flex items-center gap-4">
              <div className="relative">
                <button onClick={() => setNotificationOpen(v => !v)} className="relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100" aria-label="Notifications">
                  <Bell size={18} color={OMNIA_BLUE} />
                </button>
                {notificationOpen && <div className="absolute right-0 top-12 z-50 w-80 rounded-2xl border bg-white p-4 shadow-xl" style={{ borderColor: BORDER }}><div className="text-sm font-semibold" style={{ color: OMNIA_BLUE }}>Notifications</div><p className="mt-3 text-sm" style={{ color: MUTED }}>Aucune notification non lue.</p></div>}
              </div>
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
  const cvDrafts = cvDocs.filter(d => (d.status || 'draft') !== 'completed');
  const cvCompleted = cvDocs.filter(d => d.status === 'completed');
  const lmDrafts = lmDocs.filter(d => (d.status || 'draft') !== 'completed');
  const lmCompleted = lmDocs.filter(d => d.status === 'completed');
  const recent = [...cvDocs, ...lmDocs].sort((a,b) => new Date(b.updated_at || '').getTime() - new Date(a.updated_at || '').getTime()).slice(0,5);
  const stats = [
    { label: 'CV brouillons', value: cvDrafts.length, icon: FileText, view: 'cv' as ActiveView },
    { label: 'CV terminés', value: cvCompleted.length, icon: CheckCircle2, view: 'cv' as ActiveView },
    { label: 'LM brouillons', value: lmDrafts.length, icon: Mail, view: 'lm' as ActiveView },
    { label: 'LM terminées', value: lmCompleted.length, icon: Award, view: 'lm' as ActiveView },
  ];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-2xl font-semibold" style={{ color: OMNIA_BLUE }}>Tableau de bord Omnia Career</h1><p className="mt-1 text-sm" style={{ color: MUTED }}>Un aperçu simple de vos documents et de vos prochaines actions.</p></div>
        <div className="rounded-2xl border bg-white px-4 py-3 shadow-sm" style={{ borderColor: BORDER }}><div className="text-xs" style={{ color: MUTED }}>Jetons disponibles</div><div className="text-2xl font-bold" style={{ color: OMNIA_GOLD }}>{loading ? '…' : tokens}</div></div>
      </div>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.map(stat => { const Icon=stat.icon; return <button key={stat.label} onClick={() => setActiveView(stat.view)} className="rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" style={{ borderColor: BORDER }}><div className="flex items-center justify-between"><div><div className="text-sm" style={{ color: MUTED }}>{stat.label}</div><div className="mt-1 text-3xl font-semibold" style={{ color: OMNIA_BLUE }}>{loading ? '…' : stat.value}</div></div><div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background:'rgba(0,32,80,.08)' }}><Icon size={20} color={OMNIA_BLUE}/></div></div></button> })}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.1fr_1fr]">
        <Card className="p-5"><SectionTitle title="Actions principales"/><div className="grid grid-cols-2 gap-3">{quickActions.map(action => { const Icon=action.icon; return <button key={action.label} onClick={action.action} className="rounded-2xl border p-4 text-left hover:bg-slate-50" style={{ borderColor:BORDER }}><div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background:'rgba(0,32,80,.08)' }}><Icon size={18} color={OMNIA_BLUE}/></div><div className="mt-3 text-sm font-semibold" style={{ color:OMNIA_BLUE }}>{action.label}</div></button>})}</div></Card>
        <Card className="p-5"><SectionTitle title="Activité récente"/>{recent.length ? <div className="space-y-3">{recent.map(doc => <button key={doc.id} onClick={() => openDoc(doc.id,doc.doc_type)} className="flex w-full items-center gap-3 rounded-xl border p-3 text-left hover:bg-slate-50" style={{ borderColor:BORDER }}><div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background:'rgba(0,32,80,.08)' }}>{doc.doc_type==='cv'?<FileText size={16} color={OMNIA_BLUE}/>:<Mail size={16} color={OMNIA_BLUE}/>}</div><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold" style={{ color:OMNIA_BLUE }}>{doc.title}</div><div className="text-xs" style={{ color:MUTED }}>{doc.status==='completed'?'Terminé':'Brouillon'} · {formatDate(doc.updated_at)}</div></div><ChevronRight size={15} color={MUTED}/></button>)}</div> : <EmptyState text="Aucune activité enregistrée."/>}</Card>
      </div>
      <Card className="p-5"><div className="mb-4 flex items-center justify-between"><SectionTitle title="Modèles CV officiels"/><button onClick={() => setActiveView('cv')} className="text-sm font-semibold" style={{ color:OMNIA_BLUE }}>Voir les 12 modèles</button></div><div className="grid grid-cols-2 gap-4 md:grid-cols-4">{(templates.length?templates:fallbackCvTemplates).slice(0,4).map(t => <button key={t.template_key} onClick={() => createDoc('cv',t.template_key)} className="overflow-hidden rounded-2xl border bg-white text-left shadow-sm hover:shadow-md" style={{ borderColor:BORDER }}><div className="aspect-[9/11] overflow-hidden"><img src={templateMockupPath(t.template_key)} alt={t.name_fr} onError={(e)=>handleTemplateImageError(e,t.template_key)} className="h-full w-full object-cover object-top"/></div><div className="p-3 text-sm font-semibold" style={{ color:OMNIA_BLUE }}>{t.name_fr}</div></button>)}</div></Card>
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

function templateMockupPath(template: Template | string) {
  if (typeof template === 'string') return `/career-templates/generated/${template}.svg`;
  return template.thumbnail_url || (template.is_custom ? '/career-templates/generated/custom.svg' : `/career-templates/generated/${template.template_key}.svg`);
}

function handleTemplateImageError(event: React.SyntheticEvent<HTMLImageElement>, templateKey: string) {
  const img = event.currentTarget;
  const fallback = `/career-templates/generated/${templateKey}.svg`;
  if (!img.src.endsWith(fallback)) img.src = fallback;
}


function TemplateMini({ template, selected = false }: { template: Template; selected?: boolean }) {
  return (
    <div className="group relative aspect-[9/11] w-full overflow-hidden rounded-xl border bg-white shadow-sm" style={{ borderColor: selected ? OMNIA_GOLD : BORDER }}>
      <img src={templateMockupPath(template)} alt={template.name_fr} className="h-full w-full object-cover object-top transition duration-200 group-hover:scale-[1.02]" />
      {selected && <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-white shadow" style={{ background: OMNIA_BLUE }}><CheckCircle2 size={14} /></div>}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-2 pt-8 text-xs font-semibold text-white">{template.name_fr}</div>
    </div>
  );
}

function ActivityItem({ icon: Icon, title, date }: { icon: typeof FileText; title: string; date: string }) {
  return <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'rgba(0,32,80,0.08)' }}><Icon size={16} color={OMNIA_BLUE} /></div><div className="flex-1"><div className="font-medium" style={{ color: OMNIA_BLUE }}>{title}</div><div className="text-xs" style={{ color: MUTED }}>{date}</div></div></div>;
}

function CvBuilderView({ documents, templates, createDoc, openDoc, deleteDoc }: { documents: CareerDocument[]; templates: Template[]; createDoc: (type: DocType, templateKey?: string) => void; openDoc: (id?: string, type?: DocType) => void; deleteDoc: (id: string) => void }) {
  const list = templates.length ? templates : fallbackCvTemplates;
  return (
    <div className="space-y-5">
      <PageHeader title="CV Builder" subtitle="Choisissez un vrai modèle puis remplissez-le dans l’éditeur." actionLabel="Nouveau CV" onAction={() => createDoc('cv')} />
      <Card className="p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-base font-semibold" style={{ color:OMNIA_BLUE }}>Modèles CV officiels</h2><p className="mt-1 text-sm" style={{ color:MUTED }}>La maquette choisie sera utilisée dans le Builder, l’aperçu et le PDF.</p></div><SmallBadge tone="gold">{list.length} modèles</SmallBadge></div><div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">{list.map(t => <button key={t.template_key} onClick={() => createDoc('cv',t.template_key)} className="group overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg" style={{ borderColor:BORDER }}><div className="aspect-[9/11] overflow-hidden bg-slate-100"><img src={templateMockupPath(t.template_key)} alt={t.name_fr} onError={(e)=>handleTemplateImageError(e,t.template_key)} className="h-full w-full object-cover object-top transition group-hover:scale-[1.02]"/></div><div className="flex items-center justify-between gap-2 p-3"><div className="text-sm font-semibold" style={{ color:OMNIA_BLUE }}>{t.name_fr}</div>{t.is_free?<SmallBadge tone="green">Gratuit</SmallBadge>:<SmallBadge tone="gold">Premium</SmallBadge>}</div></button>)}</div></Card>
      <DocumentsList title="Mes CV" documents={documents} empty="Aucun CV enregistré pour le moment." createLabel="Créer un CV" onCreate={() => createDoc('cv')} onOpen={(id) => openDoc(id, 'cv')} onDelete={deleteDoc} />
    </div>
  );
}

function LettersView({ documents, templates, createDoc, openDoc, deleteDoc }: { documents: CareerDocument[]; templates: Template[]; createDoc: (type: DocType, templateKey?: string) => void; openDoc: (id?: string, type?: DocType) => void; deleteDoc: (id: string) => void }) {
  const list = templates.length ? templates : fallbackLmTemplates;
  return (
    <div className="space-y-5">
      <PageHeader title="Lettres de motivation" subtitle="Choisissez un modèle assorti à votre CV ou un modèle spécialisé." actionLabel="Nouvelle lettre" onAction={() => createDoc('lm')} />
      <Card className="p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-base font-semibold" style={{ color:OMNIA_BLUE }}>Modèles LM officiels</h2><p className="mt-1 text-sm" style={{ color:MUTED }}>Les 6 modèles officiels sont visibles et sélectionnables.</p></div><SmallBadge tone="gold">{list.length} modèles</SmallBadge></div><div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">{list.map(t => <button key={t.template_key} onClick={() => createDoc('lm',t.template_key)} className="group overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg" style={{ borderColor:BORDER }}><div className="aspect-[9/11] overflow-hidden bg-slate-100"><img src={templateMockupPath(t.template_key)} alt={t.name_fr} onError={(e)=>handleTemplateImageError(e,t.template_key)} className="h-full w-full object-cover object-top transition group-hover:scale-[1.02]"/></div><div className="flex items-center justify-between gap-2 p-3"><div className="text-sm font-semibold" style={{ color:OMNIA_BLUE }}>{t.name_fr}</div>{t.is_free?<SmallBadge tone="green">Gratuit</SmallBadge>:<SmallBadge tone="gold">Premium</SmallBadge>}</div></button>)}</div></Card>
      <DocumentsList title="Mes lettres enregistrées" documents={documents} empty="Aucune lettre enregistrée pour le moment." createLabel="Créer une lettre" onCreate={() => createDoc('lm')} onOpen={(id) => openDoc(id, 'lm')} onDelete={deleteDoc} />
    </div>
  );
}

function InterviewView({ jobId }: { jobId?: string }) {
  const categories = ['Général','RH','Comportemental','Technique','Sectoriel','Lié à une offre'] as const;
  const questionBank: Record<string,string[]> = {
    Général:['Présentez-vous en deux minutes.','Pourquoi souhaitez-vous rejoindre cette entreprise ?','Pourquoi êtes-vous la bonne personne pour ce poste ?','Quel accomplissement vous rend le plus fier ?'],
    RH:['Quelles sont vos principales motivations ?','Quel environnement de travail vous convient le mieux ?','Comment gérez-vous un désaccord avec un collègue ?','Où vous voyez-vous dans trois ans ?'],
    Comportemental:['Parlez d’une situation difficile que vous avez résolue.','Décrivez une erreur et ce que vous en avez appris.','Donnez un exemple de prise d’initiative.','Racontez une situation où vous avez dû convaincre.'],
    Technique:['Expliquez une compétence technique importante pour votre métier.','Comment contrôlez-vous la qualité de votre travail ?','Décrivez un problème technique complexe que vous avez résolu.','Comment restez-vous à jour dans votre domaine ?'],
    Sectoriel:['Quels sont les principaux enjeux actuels de votre secteur ?','Comment votre expérience répond-elle aux besoins du secteur ?','Quelle évolution du secteur vous semble la plus importante ?','Quels indicateurs utiliseriez-vous pour mesurer votre performance ?'],
    'Lié à une offre':['Pourquoi cette offre vous intéresse-t-elle ?','Quelles compétences correspondent le mieux à cette offre ?','Quel élément de votre parcours répond au besoin principal ?','Que feriez-vous pendant vos 90 premiers jours ?'],
  };
  const [category,setCategory]=useState<typeof categories[number]>('Général');
  const [seed,setSeed]=useState(() => Math.floor(Math.random()*1000));
  const [openQuestion,setOpenQuestion]=useState<string | null>(null);
  const [answers,setAnswers]=useState<Record<string,string>>(() => { try { return JSON.parse(localStorage.getItem('omnia_interview_answers')||'{}'); } catch { return {}; } });
  const [feedback,setFeedback]=useState<Record<string,string>>({});
  const [aiLoading,setAiLoading]=useState<string | null>(null);
  const [starStep,setStarStep]=useState(0);
  const [confirmStep,setConfirmStep]=useState<number | null>(null);
  const star=[
    {letter:'S',name:'Situation',role:'Décrivez précisément le contexte : où, quand et dans quelle situation ?'},
    {letter:'T',name:'Tâche',role:'Expliquez votre objectif, votre responsabilité ou le problème à résoudre.'},
    {letter:'A',name:'Action',role:'Détaillez ce que vous avez personnellement fait, étape par étape.'},
    {letter:'R',name:'Résultat',role:'Présentez le résultat concret, observable ou chiffré obtenu.'},
  ];
  const questions=[...questionBank[category]].sort((a,b)=>((a.length+seed)%7)-((b.length+seed)%7));
  function saveAnswer(q:string,value:string){ const next={...answers,[q]:value}; setAnswers(next); localStorage.setItem('omnia_interview_answers',JSON.stringify(next)); }
  async function submitAi(q:string){ const answer=(answers[q]||'').trim(); if(!answer) return; setAiLoading(q); try { if(!SUPABASE_URL) throw new Error('IA indisponible'); const res=await fetch(`${SUPABASE_URL}/functions/v1/career-studio-ai`,{method:'POST',headers:{Authorization:`Bearer ${localStorage.getItem('omnia_session_token')||''}`,'Content-Type':'application/json'},body:JSON.stringify({action:'make_professional',text:`Question d'entretien : ${q}\nRéponse du candidat : ${answer}\nAnalyse cette réponse, donne ses points forts, ce qui manque selon STAR, puis propose une version améliorée.`})}); const data=await res.json(); if(!res.ok||data.error) throw new Error(data.message||data.error); setFeedback(f=>({...f,[q]:data.result||'Correction reçue.'})); } catch(e:any){ setFeedback(f=>({...f,[q]:e?.message||'Le service IA n’est pas disponible.'})); } finally { setAiLoading(null); } }
  return <div className="space-y-5"><PageHeader title="Préparation entretien" subtitle="Questions renouvelées, réponses sauvegardées et méthode STAR guidée."/><div className="flex flex-wrap gap-2">{categories.map(c=><button key={c} onClick={()=>{setCategory(c);setSeed(Math.floor(Math.random()*1000));setOpenQuestion(null)}} className="rounded-full px-4 py-2 text-sm font-semibold" style={{background:category===c?OMNIA_BLUE:'#fff',color:category===c?'#fff':OMNIA_BLUE,border:`1px solid ${BORDER}`}}>{c}</button>)}<button onClick={()=>setSeed(Math.floor(Math.random()*1000))} className="inline-flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm font-semibold" style={{borderColor:BORDER,color:OMNIA_BLUE}}><RefreshCw size={15}/>Changer les questions</button></div><div className="grid gap-5 xl:grid-cols-[1fr_360px]"><Card className="p-5"><SectionTitle title="Banque de questions"/><div className="space-y-3">{questions.map(q=><div key={q} className="rounded-xl border" style={{borderColor:BORDER}}><button onClick={()=>setOpenQuestion(openQuestion===q?null:q)} className="flex w-full items-center justify-between p-4 text-left text-sm font-semibold" style={{color:OMNIA_BLUE}}>{q}<ChevronDown size={16} className={openQuestion===q?'rotate-180':''}/></button>{openQuestion===q&&<div className="border-t p-4" style={{borderColor:BORDER}}><p className="text-sm" style={{color:MUTED}}>Répondez avec un exemple concret. Pour une expérience, structurez votre réponse avec STAR.</p><textarea value={answers[q]||''} onChange={e=>saveAnswer(q,e.target.value)} className="mt-3 min-h-36 w-full rounded-xl border p-3 text-sm" style={{borderColor:BORDER}} placeholder="Rédigez votre réponse personnelle..."/><button onClick={()=>submitAi(q)} disabled={!answers[q]?.trim()||aiLoading===q} className="mt-3 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40" style={{background:OMNIA_BLUE}}><Sparkles size={16}/>{aiLoading===q?'Correction en cours...':'Soumettre à l’IA'}</button>{feedback[q]&&<div className="mt-3 whitespace-pre-wrap rounded-xl border bg-slate-50 p-4 text-sm leading-6" style={{borderColor:BORDER,color:'#334155'}}>{feedback[q]}</div>}</div>}</div>)}</div></Card><Card className="p-5"><SectionTitle title="Checklist STAR"/><p className="mb-4 text-sm leading-6" style={{color:MUTED}}>STAR vous aide à construire une réponse complète. Validez chaque étape seulement si votre réponse contient réellement l’élément demandé.</p>{star.map((item,index)=><div key={item.letter} className={`mb-3 rounded-xl border p-4 ${index>starStep?'opacity-45':''}`} style={{borderColor:index===starStep?OMNIA_GOLD:BORDER,background:index<starStep?'#F0FDF4':'#fff'}}><div className="flex items-start gap-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-bold" style={{background:index<starStep?'#16A34A':OMNIA_GOLD,color:'#fff'}}>{index<starStep?<Check size={16}/>:item.letter}</div><div><div className="font-semibold" style={{color:OMNIA_BLUE}}>{item.name}</div><p className="mt-1 text-sm leading-5" style={{color:MUTED}}>{item.role}</p></div></div>{index===starStep&&<button onClick={()=>setConfirmStep(index)} className="mt-3 w-full rounded-xl px-3 py-2 text-sm font-semibold text-white" style={{background:OMNIA_BLUE}}>Cette étape est bien présente</button>}</div>)}<div className="text-sm font-semibold" style={{color:OMNIA_BLUE}}>Progression : {starStep}/4</div></Card></div>{confirmStep!==null&&<div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"><h3 className="text-lg font-semibold" style={{color:OMNIA_BLUE}}>Confirmer l’étape {star[confirmStep].name}</h3><p className="mt-2 text-sm leading-6" style={{color:MUTED}}>Êtes-vous sûr que votre réponse contient bien : {star[confirmStep].role}</p><div className="mt-5 flex justify-end gap-3"><button onClick={()=>setConfirmStep(null)} className="rounded-xl border px-4 py-2 text-sm" style={{borderColor:BORDER}}>Annuler</button><button onClick={()=>{setStarStep(Math.min(4,confirmStep+1));setConfirmStep(null)}} className="rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{background:OMNIA_BLUE}}>Confirmer et continuer</button></div></div></div>}</div>;
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
  const storageKey='omnia_manual_applications';
  const [apps,setApps]=useState<TrackedApplication[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [showManual,setShowManual]=useState(false);
  const [manual,setManual]=useState({company_name:'',job_title:'',job_url:'',location:'',contract_type:'CDI'});
  function localApps(){ try { return JSON.parse(localStorage.getItem(storageKey)||'[]') as TrackedApplication[]; } catch { return []; } }
  async function loadApplications(){ setLoading(true); setError(''); const local=localApps(); if(!SUPABASE_URL){setApps(local);setLoading(false);return;} try { const res=await fetch(`${SUPABASE_URL}/functions/v1/career-application-track`,{method:'POST',headers:{Authorization:`Bearer ${localStorage.getItem('omnia_session_token')||''}`,'Content-Type':'application/json'},body:JSON.stringify({action:'list'})}); const data=await res.json(); if(!res.ok||data.error) throw new Error(data.message||data.error||'Service indisponible'); const platform=(data.platform_applications||[]).map((a:TrackedApplication)=>({...a,source:'platform' as const})); const manualRemote=(data.manual_applications||[]).map((a:any)=>({...a,id:`manual-${a.id}`,source:'manual' as const,job_offers:{id:a.job_id,title:a.job_title,recruiter_company:a.company_name,location:a.location,contract_type:a.contract_type,application_mode:a.application_mode,external_apply_url:a.job_url}})); setApps([...platform,...manualRemote,...local.filter(l=>!manualRemote.some((r:any)=>r.id===l.id))]); } catch(e:any){ setApps(local); setError('Le suivi distant est momentanément indisponible. Vos candidatures locales restent accessibles.'); } finally { setLoading(false); } }
  useEffect(()=>{loadApplications()},[]);
  function addManual(){ if(!manual.company_name.trim()||!manual.job_title.trim()) return; const item:TrackedApplication={id:`local-app-${Date.now()}`,source:'manual',status:'draft',company_name:manual.company_name,job_title:manual.job_title,job_url:manual.job_url,job_offers:{title:manual.job_title,recruiter_company:manual.company_name,location:manual.location,contract_type:manual.contract_type,application_mode:'external_link',external_apply_url:manual.job_url}}; const next=[item,...localApps()]; localStorage.setItem(storageKey,JSON.stringify(next)); setApps(prev=>[item,...prev]); setManual({company_name:'',job_title:'',job_url:'',location:'',contract_type:'CDI'}); setShowManual(false); }
  const columns=[{title:'Brouillon',statuses:['draft','prepared']},{title:'À envoyer',statuses:['to_apply']},{title:'Envoyée',statuses:['applied','submitted','declared_sent','redirected','email_prepared','received','waiting_response']},{title:'Entretien',statuses:['interview','shortlisted']},{title:'Finalisée',statuses:['offer','accepted','rejected','withdrawn','archived']}];
  return <div className="space-y-5"><PageHeader title="Suivi candidatures" subtitle="Suivez vos candidatures réelles sans perdre vos données si le service distant est indisponible." actionLabel="Ajouter une candidature" onAction={()=>setShowManual(true)}/>{error&&<div className="flex items-start gap-3 rounded-2xl border bg-amber-50 p-4 text-sm text-amber-800" style={{borderColor:'#FCD34D'}}><AlertCircle size={18}/><div className="flex-1">{error}</div><button onClick={loadApplications} className="font-semibold underline">Réessayer</button></div>}{loading?<Card className="p-8"><div className="text-center text-sm" style={{color:MUTED}}>Chargement des candidatures…</div></Card>:apps.length===0?<Card className="p-8"><EmptyState text="Aucune candidature suivie pour le moment." action="Ajouter une candidature" onAction={()=>setShowManual(true)}/></Card>:<div className="grid gap-4 xl:grid-cols-5">{columns.map(col=>{const items=apps.filter(app=>col.statuses.includes(app.tracking_status||app.status||'draft'));return <Card key={col.title} className="p-4"><div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-semibold" style={{color:OMNIA_BLUE}}>{col.title}</h2><SmallBadge>{items.length}</SmallBadge></div><div className="space-y-3">{items.map(app=><div key={app.id} className="rounded-xl border p-3" style={{borderColor:BORDER}}><div className="text-sm font-semibold" style={{color:OMNIA_BLUE}}>{app.job_offers?.title||app.job_title||'Poste'}</div><div className="mt-1 text-xs" style={{color:MUTED}}>{app.job_offers?.recruiter_company||app.company_name||'Entreprise'}</div><div className="mt-3 flex gap-2"><button onClick={()=>navigate(`/dashboard/career-studio?section=interview${app.job_offers?.id?`&job_id=${app.job_offers.id}`:''}`)} className="text-xs font-semibold" style={{color:OMNIA_BLUE}}>Préparer entretien</button>{app.job_url&&<a href={app.job_url} target="_blank" rel="noreferrer" className="text-xs font-semibold" style={{color:OMNIA_GOLD}}>Voir l’offre</a>}</div></div>)}</div></Card>})}</div>}{showManual&&<div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl"><h2 className="text-lg font-semibold" style={{color:OMNIA_BLUE}}>Ajouter une candidature</h2><div className="mt-4 grid gap-3"><input value={manual.company_name} onChange={e=>setManual({...manual,company_name:e.target.value})} placeholder="Entreprise *" className="h-11 rounded-xl border px-3 text-sm" style={{borderColor:BORDER}}/><input value={manual.job_title} onChange={e=>setManual({...manual,job_title:e.target.value})} placeholder="Poste *" className="h-11 rounded-xl border px-3 text-sm" style={{borderColor:BORDER}}/><input value={manual.job_url} onChange={e=>setManual({...manual,job_url:e.target.value})} placeholder="Lien de l’offre" className="h-11 rounded-xl border px-3 text-sm" style={{borderColor:BORDER}}/><input value={manual.location} onChange={e=>setManual({...manual,location:e.target.value})} placeholder="Lieu" className="h-11 rounded-xl border px-3 text-sm" style={{borderColor:BORDER}}/></div><div className="mt-5 flex justify-end gap-3"><button onClick={()=>setShowManual(false)} className="rounded-xl border px-4 py-2 text-sm" style={{borderColor:BORDER}}>Annuler</button><button onClick={addManual} className="rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{background:OMNIA_BLUE}}>Ajouter</button></div></div></div>}</div>;
}

function ProfileView({ displayName }: { displayName: string }) {
  const raw=readUser()||{};
  const [profile,setProfile]=useState({full_name:raw.full_name||raw.name||displayName,email:raw.email||'',phone:(raw as any).phone_number||(raw as any).phone||'',location:(raw as any).location||'',title:(raw as any).professional_title||'',bio:(raw as any).bio||''});
  const [saving,setSaving]=useState(false); const [message,setMessage]=useState('');
  async function save(){
    setSaving(true); setMessage('');
    const token=localStorage.getItem('omnia_session_token')||'';
    const payload={full_name:profile.full_name,email:profile.email,phone_number:profile.phone,professional_title:profile.title,location:profile.location,bio:profile.bio};
    try {
      if(token){
        const res=await fetch(ENDPOINTS.authUpdateProfile,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(payload)});
        const data=await res.json().catch(()=>({}));
        if(!res.ok) throw new Error(data.message||data.error||'Mise à jour impossible');
        const merged={...raw,...payload,...(data.user||{}),phone:payload.phone_number};
        localStorage.setItem('omnia_user',JSON.stringify(merged));
      } else {
        localStorage.setItem('omnia_user',JSON.stringify({...raw,...payload,phone:payload.phone_number}));
      }
      window.dispatchEvent(new CustomEvent('omnia-profile-updated',{detail:payload}));
      setMessage('Profil synchronisé avec le Dashboard principal.');
    } catch(e:any){ setMessage(e?.message||'Erreur de synchronisation.'); }
    finally{setSaving(false);}
  }
  return <div className="space-y-5"><PageHeader title="Profil carrière" subtitle="Ce profil utilise les mêmes données que votre profil apprenant principal."/><div className="grid gap-5 xl:grid-cols-[320px_1fr]"><Card className="p-6"><div className="flex h-28 w-28 items-center justify-center rounded-full text-2xl font-bold text-white" style={{background:OMNIA_BLUE}}>{getInitials(profile.full_name,profile.email)}</div><h2 className="mt-4 text-xl font-semibold" style={{color:OMNIA_BLUE}}>{profile.full_name||'Votre nom'}</h2><p className="text-sm" style={{color:MUTED}}>{profile.title||'Titre professionnel non renseigné'}</p></Card><Card className="p-6"><div className="grid gap-4 md:grid-cols-2"><EditableField label="Nom complet" value={profile.full_name} onChange={v=>setProfile({...profile,full_name:v})}/><EditableField label="E-mail" value={profile.email} onChange={v=>setProfile({...profile,email:v})}/><EditableField label="Téléphone" value={profile.phone} onChange={v=>setProfile({...profile,phone:v})}/><EditableField label="Ville / Pays" value={profile.location} onChange={v=>setProfile({...profile,location:v})}/><EditableField label="Titre professionnel" value={profile.title} onChange={v=>setProfile({...profile,title:v})}/></div><label className="mt-4 block text-sm font-medium" style={{color:OMNIA_BLUE}}>Biographie<textarea value={profile.bio} onChange={e=>setProfile({...profile,bio:e.target.value})} className="mt-1 min-h-28 w-full rounded-xl border p-3 text-sm" style={{borderColor:BORDER}}/></label>{message&&<p className="mt-3 text-sm" style={{color:message.includes('synchronisé')?'#15803d':'#b91c1c'}}>{message}</p>}<button onClick={save} disabled={saving} className="mt-4 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{background:OMNIA_BLUE}}>{saving?'Synchronisation…':'Enregistrer et synchroniser'}</button></Card></div></div>;
}

function CoachingView() {
  const [question,setQuestion]=useState(''); const [request,setRequest]=useState('');
  return <div className="space-y-5"><PageHeader title="Coaching carrière" subtitle="Choisissez entre un accompagnement IA et une demande de coaching humain Premium."/><div className="grid gap-5 xl:grid-cols-2"><Card className="p-6"><SectionTitle title="Coaching IA"/><p className="text-sm" style={{color:MUTED}}>Décrivez votre objectif. Une réponse ne sera générée que si le service IA est configuré.</p><textarea value={question} onChange={e=>setQuestion(e.target.value)} className="mt-4 min-h-40 w-full rounded-xl border p-3 text-sm" style={{borderColor:BORDER}} placeholder="Votre objectif ou difficulté..."/><button disabled={!question.trim()} className="mt-3 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40" style={{background:OMNIA_BLUE}}>Lancer le coaching IA</button></Card><Card className="p-6"><div className="flex items-center justify-between"><SectionTitle title="Coaching humain Premium"/><Crown size={20} color={OMNIA_GOLD}/></div><p className="text-sm" style={{color:MUTED}}>Envoyez une demande à la plateforme. Le tarif et les disponibilités seront définis dans l’offre Premium.</p><textarea value={request} onChange={e=>setRequest(e.target.value)} className="mt-4 min-h-40 w-full rounded-xl border p-3 text-sm" style={{borderColor:BORDER}} placeholder="Sujet de votre demande..."/><button disabled={!request.trim()} className="mt-3 rounded-xl px-4 py-2.5 text-sm font-semibold text-[#002050] disabled:opacity-40" style={{background:OMNIA_GOLD}}>Demander un coaching</button></Card></div></div>;
}

function SettingsView({ packs, tokens, user }: { packs: TokenPack[]; tokens: number; user: any }) {
  const [language,setLanguage]=useState(localStorage.getItem('omnia_career_language')||'fr');
  const [notifications,setNotifications]=useState(localStorage.getItem('omnia_career_notifications')!=='false');
  function save(){ localStorage.setItem('omnia_career_language',language); localStorage.setItem('omnia_career_notifications',String(notifications)); }
  return <div className="space-y-5"><PageHeader title="Paramètres Omnia Career" subtitle="Réglages propres à votre espace carrière."/><div className="grid gap-5 xl:grid-cols-3"><Card className="p-5"><SectionTitle title="Langue"/><select value={language} onChange={e=>setLanguage(e.target.value)} className="h-11 w-full rounded-xl border px-3 text-sm" style={{borderColor:BORDER}}><option value="fr">Français</option><option value="en">English</option></select><p className="mt-3 text-xs" style={{color:MUTED}}>La préférence est enregistrée. La traduction complète dépend des textes traduits disponibles dans l’application.</p></Card><Card className="p-5"><SectionTitle title="Notifications"/><label className="flex items-center justify-between gap-3 text-sm" style={{color:OMNIA_BLUE}}><span>Notifications Career</span><input type="checkbox" checked={notifications} onChange={e=>setNotifications(e.target.checked)}/></label></Card><Card className="p-5"><SectionTitle title="Jetons"/><div className="text-3xl font-semibold" style={{color:OMNIA_BLUE}}>{tokens}</div><p className="text-sm" style={{color:MUTED}}>jeton(s) disponible(s)</p></Card></div><button onClick={save} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{background:OMNIA_BLUE}}>Enregistrer les paramètres</button></div>;
}

function EditableField({label,value,onChange}:{label:string;value:string;onChange:(v:string)=>void}){return <label className="block text-sm font-medium" style={{color:OMNIA_BLUE}}>{label}<input value={value} onChange={e=>onChange(e.target.value)} className="mt-1 h-11 w-full rounded-xl border px-3 text-sm" style={{borderColor:BORDER}}/></label>}

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
