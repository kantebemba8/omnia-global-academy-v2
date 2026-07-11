import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Award,
  BarChart3,
  Bell,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  ChevronsLeft,
  Coins,
  Crown,
  Download,
  Edit2,
  ExternalLink,
  FileText,
  FolderOpen,
  Mail,
  MessageSquare,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { ENDPOINTS } from '../../lib/config';
import {
  APPLICATION_MODE_SHORT_LABELS,
  JobApplicationMode,
  labelApplicationStatus,
  normalizeApplicationMode,
  STATUS_TONE,
} from '../../lib/jobApplicationModes';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const OMNIA_BLUE = '#002050';
const OMNIA_GOLD = '#bf8813';
const PAGE_BG = '#F8F9FA';
const BORDER = '#E4E7EC';
const MUTED = '#6B7280';

type ActiveView = 'dashboard' | 'cv' | 'lm' | 'interview' | 'applications' | 'profile' | 'coaching' | 'settings';
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
}

interface TokenPack {
  pack_key: string;
  name_fr: string;
  tokens: number;
  price_xof?: number;
  price_eur?: number;
  is_popular?: boolean;
  bonus_tokens?: number;
}

interface CurrentUser {
  id?: string;
  full_name?: string;
  name?: string;
  email?: string;
  roles?: string[];
  cv_tokens?: number;
}

interface TrackedApplication {
  id: string;
  source?: 'platform' | 'manual';
  status?: string;
  tracking_status?: string;
  application_mode?: JobApplicationMode | string | null;
  company_name?: string;
  job_title?: string;
  location?: string;
  contract_type?: string;
  created_at?: string;
  updated_at?: string;
  job_id?: string;
  job_offers?: {
    id?: string;
    title?: string;
    recruiter_company?: string;
    location?: string;
    contract_type?: string;
    application_mode?: string | null;
    external_apply_url?: string | null;
    external_apply_email?: string | null;
  } | null;
}

interface JobSummary {
  id: string;
  title: string;
  recruiter_company?: string;
  location?: string;
  contract_type?: string;
  category?: string;
  application_mode?: string | null;
  description?: string;
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
  const parts = source.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function formatDate(date?: string) {
  if (!date) return 'Date non disponible';
  try {
    return new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return date;
  }
}

function token() {
  return localStorage.getItem('omnia_session_token') || '';
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border bg-white shadow-sm ${className}`} style={{ borderColor: BORDER }}>{children}</div>;
}

function EmptyState({ icon: Icon = FileText, title, description, actionLabel, onAction }: { icon?: typeof FileText; title: string; description: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed p-8 text-center" style={{ borderColor: BORDER }}>
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50">
        <Icon className="h-6 w-6" style={{ color: MUTED }} />
      </div>
      <h3 className="text-sm font-semibold" style={{ color: OMNIA_BLUE }}>{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6" style={{ color: MUTED }}>{description}</p>
      {actionLabel && onAction && (
        <button onClick={onAction} className="mt-5 rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: OMNIA_BLUE }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function Badge({ children, tone = 'blue' }: { children: React.ReactNode; tone?: 'blue' | 'gold' | 'green' | 'purple' | 'red' | 'gray' }) {
  const map = {
    blue: { bg: 'rgba(0,32,80,0.08)', color: OMNIA_BLUE },
    gold: { bg: 'rgba(191,136,19,0.12)', color: OMNIA_GOLD },
    green: { bg: '#DCFCE7', color: '#15803D' },
    purple: { bg: '#F3E8FF', color: '#7E22CE' },
    red: { bg: '#FEE2E2', color: '#B91C1C' },
    gray: { bg: '#F3F4F6', color: '#4B5563' },
  }[tone];
  return <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: map.bg, color: map.color }}>{children}</span>;
}

function toneClass(tone: string) {
  if (tone === 'green') return 'bg-green-50 text-green-700';
  if (tone === 'red') return 'bg-red-50 text-red-700';
  if (tone === 'purple') return 'bg-purple-50 text-purple-700';
  if (tone === 'gold' || tone === 'yellow') return 'bg-yellow-50 text-yellow-700';
  return 'bg-blue-50 text-blue-700';
}

async function fetchCareerList(docType: DocType) {
  if (!SUPABASE_URL || !token()) return { documents: [], templates: [], packs: [], user: null };
  const response = await fetch(`${SUPABASE_URL}/functions/v1/career-studio-list`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ doc_type: docType }),
  });
  if (!response.ok) throw new Error('CAREER_LIST_FAILED');
  return response.json();
}

async function fetchJob(jobId: string): Promise<JobSummary | null> {
  try {
    const response = await fetch(`${ENDPOINTS.jobsList}?job_id=${encodeURIComponent(jobId)}`);
    const data = await response.json();
    return data.job || (data.id ? data : null);
  } catch {
    return null;
  }
}

async function fetchApplications() {
  if (!SUPABASE_URL || !token()) return { platform: [], manual: [] };
  const response = await fetch(`${SUPABASE_URL}/functions/v1/career-application-track`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'list' }),
  });
  if (!response.ok) return { platform: [], manual: [] };
  const data = await response.json();
  return {
    platform: (data.platform_applications || []).map((item: TrackedApplication) => ({ ...item, source: 'platform' as const })),
    manual: (data.manual_applications || []).map((item: TrackedApplication) => ({
      ...item,
      id: `manual-${item.id}`,
      source: 'manual' as const,
      job_offers: {
        id: item.job_id,
        title: item.job_title,
        recruiter_company: item.company_name,
        location: item.location,
        contract_type: item.contract_type,
        application_mode: item.application_mode,
      },
    })),
  };
}

export default function DashboardCareerStudio() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [documents, setDocuments] = useState<CareerDocument[]>([]);
  const [cvTemplates, setCvTemplates] = useState<Template[]>([]);
  const [lmTemplates, setLmTemplates] = useState<Template[]>([]);
  const [packs, setPacks] = useState<TokenPack[]>([]);
  const [tokens, setTokens] = useState(0);
  const [applications, setApplications] = useState<TrackedApplication[]>([]);
  const [targetJob, setTargetJob] = useState<JobSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [search, setSearch] = useState('');
  const [showPremium, setShowPremium] = useState(false);
  const user = readUser();

  const displayName = user?.full_name || user?.name || 'Apprenant';
  const initials = getInitials(displayName, user?.email);
  const jobId = searchParams.get('job_id') || undefined;

  const cvDocs = useMemo(() => documents.filter((doc) => doc.doc_type === 'cv'), [documents]);
  const lmDocs = useMemo(() => documents.filter((doc) => doc.doc_type === 'lm'), [documents]);
  const latestCv = cvDocs[0];
  const latestLm = lmDocs[0];

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(''), 3500);
  }

  function goToView(view: ActiveView) {
    const map: Record<ActiveView, string> = {
      dashboard: '',
      cv: 'section=cv',
      lm: 'section=lm',
      interview: 'section=interview',
      applications: 'section=applications',
      profile: 'section=profile',
      coaching: 'section=coaching',
      settings: 'section=settings',
    };
    const query = [map[view], jobId && (view === 'applications' || view === 'interview') ? `job_id=${encodeURIComponent(jobId)}` : ''].filter(Boolean).join('&');
    navigate(`/dashboard/career-studio${query ? `?${query}` : ''}`);
  }

  function createDoc(docType: DocType, templateKey?: string) {
    const templates = docType === 'cv' ? cvTemplates : lmTemplates;
    const selected = templateKey || templates[0]?.template_key || (docType === 'cv' ? 'classic_pro' : 'lm_classic_pro');
    const extra = jobId ? `&job_id=${encodeURIComponent(jobId)}` : '';
    navigate(`/dashboard/career-studio/editor/new?type=${docType}&template=${encodeURIComponent(selected)}${extra}`);
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
      setDocuments((prev) => prev.filter((doc) => doc.id !== docId));
      showToast('Document supprimé.');
    } catch {
      showToast('Suppression impossible pour le moment.');
    }
  }

  async function loadData() {
    setLoading(true);
    try {
      const [cvResult, lmResult, appResult] = await Promise.allSettled([
        fetchCareerList('cv'),
        fetchCareerList('lm'),
        fetchApplications(),
      ]);
      const cvPayload = cvResult.status === 'fulfilled' ? cvResult.value : null;
      const lmPayload = lmResult.status === 'fulfilled' ? lmResult.value : null;
      const appPayload = appResult.status === 'fulfilled' ? appResult.value : { platform: [], manual: [] };

      const loadedDocs = [
        ...((cvPayload?.documents || []) as CareerDocument[]),
        ...((lmPayload?.documents || []) as CareerDocument[]),
      ].sort((a, b) => new Date(b.updated_at || b.created_at || '').getTime() - new Date(a.updated_at || a.created_at || '').getTime());
      setDocuments(loadedDocs);
      setCvTemplates(((cvPayload?.templates || []) as Template[]));
      setLmTemplates(((lmPayload?.templates || []) as Template[]));
      setPacks((cvPayload?.packs || lmPayload?.packs || []) as TokenPack[]);
      setTokens(cvPayload?.user?.cv_tokens ?? lmPayload?.user?.cv_tokens ?? user?.cv_tokens ?? 0);
      setApplications([...(appPayload.platform || []), ...(appPayload.manual || [])]);
    } catch {
      showToast('Certaines données Omnia Career n’ont pas pu être chargées.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const section = searchParams.get('section') || 'dashboard';
    const map: Record<string, ActiveView> = {
      dashboard: 'dashboard', cv: 'cv', builder: 'cv', lm: 'lm', letters: 'lm', lettres: 'lm', lettre: 'lm',
      interview: 'interview', entretien: 'interview', applications: 'applications', candidatures: 'applications',
      profile: 'profile', profil: 'profile', coaching: 'coaching', settings: 'settings', parametres: 'settings', paramètres: 'settings',
    };
    setActiveView(map[section] || 'dashboard');
  }, [searchParams]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!jobId) { setTargetJob(null); return; }
    fetchJob(jobId).then(setTargetJob);
  }, [jobId]);

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [] as Array<{ label: string; hint: string; action: () => void }>;
    const base: Array<{ label: string; hint: string; action: () => void }> = [];
    documents.forEach(doc => {
      if (`${doc.title} ${doc.target_job || ''}`.toLowerCase().includes(q)) {
        base.push({ label: doc.title, hint: doc.doc_type === 'cv' ? 'CV' : 'Lettre', action: () => openDoc(doc.id, doc.doc_type) });
      }
    });
    [...cvTemplates, ...lmTemplates].forEach(t => {
      if (`${t.name_fr} ${t.description_fr || ''}`.toLowerCase().includes(q)) {
        base.push({ label: t.name_fr, hint: t.is_free ? 'Modèle gratuit' : 'Modèle premium', action: () => createDoc(t.template_key.startsWith('lm_') ? 'lm' : 'cv', t.template_key) });
      }
    });
    navItems.forEach(n => {
      if (n.label.toLowerCase().includes(q)) base.push({ label: n.label, hint: 'Menu Omnia Career', action: () => goToView(n.id) });
    });
    return base.slice(0, 8);
  }, [search, documents, cvTemplates, lmTemplates]);

  return (
    <div className="min-h-screen" style={{ background: PAGE_BG, color: '#111827' }}>
      {toast && <div className="fixed right-5 top-5 z-50 rounded-xl border bg-white px-4 py-3 text-sm font-medium shadow-lg" style={{ color: OMNIA_BLUE, borderColor: BORDER }}>{toast}</div>}
      {showPremium && <PremiumModal packs={packs} onClose={() => setShowPremium(false)} />}

      <div className="flex min-h-screen">
        <aside className="fixed left-0 top-0 z-40 flex h-screen w-[260px] flex-col text-white shadow-xl" style={{ background: OMNIA_BLUE }}>
          <div className="px-5 pb-4 pt-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white">
                <img src="/IMG_0349.png" alt="Omnia Global Academy" className="h-full w-full object-cover" />
              </div>
              <div className="leading-tight">
                <div className="text-sm font-bold text-white">Omnia Global</div>
                <div className="text-sm font-bold text-white">Academy</div>
              </div>
            </div>
            <div className="mt-6">
              <h2 className="text-lg font-semibold" style={{ color: OMNIA_GOLD }}>Omnia Career</h2>
              <div className="mt-2 h-0.5 w-9 rounded-full" style={{ background: OMNIA_GOLD }} />
            </div>
          </div>

          <div className="px-3 pb-2">
            <button onClick={() => navigate('/dashboard')} className="flex h-10 w-full items-center gap-3 rounded-xl px-4 text-left text-sm font-medium transition hover:bg-white/10" style={{ color: 'rgba(255,255,255,0.88)' }}>
              <ArrowLeft size={17} />
              <span>Retour au dashboard</span>
            </button>
          </div>

          <nav className="flex-1 space-y-1 px-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button key={item.id} onClick={() => goToView(item.id)} className="group relative flex h-10 w-full items-center gap-3 rounded-xl px-4 text-left text-sm font-medium transition" style={{ background: isActive ? 'rgba(255,255,255,0.11)' : 'transparent', color: isActive ? 'white' : 'rgba(255,255,255,0.86)' }}>
                  {isActive && <span className="absolute left-0 top-2 h-6 w-1 rounded-r-full" style={{ background: OMNIA_GOLD }} />}
                  <Icon size={18} style={{ color: isActive ? OMNIA_GOLD : 'rgba(255,255,255,0.80)' }} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="px-4 pb-4">
            <div className="rounded-2xl border p-4" style={{ borderColor: 'rgba(191,136,19,0.45)', background: 'rgba(255,255,255,0.05)' }}>
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: OMNIA_GOLD }}><Crown size={16} color="white" /></div>
              <h3 className="text-sm font-semibold" style={{ color: OMNIA_GOLD }}>Passez à Premium</h3>
              <p className="mt-2 text-xs leading-5 text-white/75">Modèles premium, analyses avancées et packs de jetons.</p>
              <button onClick={() => setShowPremium(true)} className="mt-4 h-9 w-full rounded-xl text-sm font-semibold text-white" style={{ background: OMNIA_GOLD }}>Voir les packs</button>
            </div>
            <button className="ml-auto mt-3 flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:bg-white/10" aria-label="Réduire le menu"><ChevronsLeft size={18} /></button>
          </div>
        </aside>

        <div className="ml-[260px] flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b bg-white px-7" style={{ borderColor: BORDER }}>
            <div className="relative flex h-11 w-full max-w-[560px] items-center rounded-2xl border bg-white px-4" style={{ borderColor: BORDER }}>
              <Search size={18} color="#9CA3AF" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} className="ml-3 h-full flex-1 border-0 bg-transparent text-sm outline-none" placeholder="Rechercher un CV, une offre, un conseil..." />
              <span className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-semibold" style={{ color: MUTED }}>⌘ K</span>
              {searchResults.length > 0 && (
                <div className="absolute left-0 top-12 z-50 w-full rounded-2xl border bg-white p-2 shadow-xl" style={{ borderColor: BORDER }}>
                  {searchResults.map((result, index) => (
                    <button key={`${result.label}-${index}`} onClick={() => { setSearch(''); result.action(); }} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-slate-50">
                      <span className="text-sm font-semibold" style={{ color: OMNIA_BLUE }}>{result.label}</span>
                      <span className="text-xs" style={{ color: MUTED }}>{result.hint}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="ml-6 flex items-center gap-4">
              <button className="relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100" aria-label="Notifications">
                <Bell size={18} color={OMNIA_BLUE} />
              </button>
              <div className="h-8 w-px bg-gray-200" />
              <button onClick={() => goToView('settings')} className="flex items-center gap-3 rounded-xl px-2 py-1 hover:bg-gray-100">
                <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: OMNIA_BLUE }}>{initials}</div>
                <div className="hidden text-left md:block">
                  <div className="text-sm font-semibold" style={{ color: OMNIA_BLUE }}>{displayName}</div>
                  <div className="text-xs" style={{ color: MUTED }}>Apprenant</div>
                </div>
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto px-7 py-7">
            {loading && <div className="rounded-2xl border bg-white p-8 text-center text-sm text-slate-500" style={{ borderColor: BORDER }}>Chargement de vos données Omnia Career...</div>}
            {!loading && activeView === 'dashboard' && <DashboardHome docs={documents} cvDocs={cvDocs} lmDocs={lmDocs} latestCv={latestCv} latestLm={latestLm} templates={cvTemplates} tokens={tokens} applications={applications} createDoc={createDoc} openDoc={openDoc} goToView={goToView} />}
            {!loading && activeView === 'cv' && <DocumentsView title="CV Builder" subtitle="Créez, modifiez et exportez vos CV Omnia Career." type="cv" documents={cvDocs} templates={cvTemplates} createDoc={createDoc} openDoc={openDoc} deleteDoc={deleteDoc} />}
            {!loading && activeView === 'lm' && <DocumentsView title="Lettres de motivation" subtitle="Créez des lettres ciblées pour vos candidatures." type="lm" documents={lmDocs} templates={lmTemplates} createDoc={createDoc} openDoc={openDoc} deleteDoc={deleteDoc} />}
            {!loading && activeView === 'applications' && <ApplicationsView applications={applications} job={targetJob} navigate={navigate} createDoc={createDoc} />}
            {!loading && activeView === 'interview' && <InterviewView job={targetJob} navigate={navigate} />}
            {!loading && activeView === 'profile' && <ProfileView user={user} docs={documents} goToView={goToView} />}
            {!loading && activeView === 'coaching' && <CoachingView docs={documents} applications={applications} goToView={goToView} />}
            {!loading && activeView === 'settings' && <SettingsView user={user} packs={packs} tokens={tokens} onPremium={() => setShowPremium(true)} />}
          </main>
        </div>
      </div>
    </div>
  );
}

function DashboardHome({ docs, cvDocs, lmDocs, latestCv, latestLm, templates, tokens, applications, createDoc, openDoc, goToView }: { docs: CareerDocument[]; cvDocs: CareerDocument[]; lmDocs: CareerDocument[]; latestCv?: CareerDocument; latestLm?: CareerDocument; templates: Template[]; tokens: number; applications: TrackedApplication[]; createDoc: (type: DocType, template?: string) => void; openDoc: (id?: string, type?: DocType) => void; goToView: (view: ActiveView) => void }) {
  const statCards = [
    { title: 'CV créés', value: cvDocs.length, hint: cvDocs.length ? `${cvDocs.length} document(s)` : 'Aucun CV', icon: FileText, action: () => goToView('cv') },
    { title: 'Lettres créées', value: lmDocs.length, hint: lmDocs.length ? `${lmDocs.length} lettre(s)` : 'Aucune lettre', icon: Mail, action: () => goToView('lm') },
    { title: 'Candidatures suivies', value: applications.length, hint: applications.length ? `${applications.length} candidature(s)` : 'Aucune candidature', icon: Briefcase, action: () => goToView('applications') },
    { title: 'Jetons CV', value: tokens, hint: `${tokens} disponible(s)`, icon: Coins, action: () => goToView('settings') },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Omnia Career" subtitle="Votre espace pour préparer vos CV, lettres, candidatures et entretiens avec vos données réelles." />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map(card => {
          const Icon = card.icon;
          return (
            <button key={card.title} onClick={card.action} className="rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" style={{ borderColor: BORDER }}>
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: 'rgba(0,32,80,0.07)' }}><Icon className="h-5 w-5" style={{ color: OMNIA_BLUE }} /></div>
              <div className="text-sm font-medium" style={{ color: MUTED }}>{card.title}</div>
              <div className="mt-1 text-2xl font-semibold" style={{ color: OMNIA_BLUE }}>{card.value}</div>
              <div className="mt-1 text-xs" style={{ color: MUTED }}>{card.hint}</div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.05fr_1fr_1fr]">
        <Card className="p-5">
          <SectionHeader title="Prochaines actions" />
          <div className="space-y-3">
            {!latestCv && <ActionRow icon={FileText} title="Créer mon premier CV" subtitle="Commencez avec un modèle Omnia." action="Créer" onClick={() => createDoc('cv')} />}
            {latestCv && <ActionRow icon={FileText} title="Améliorer mon CV" subtitle={latestCv.title} action="Ouvrir" onClick={() => openDoc(latestCv.id, 'cv')} />}
            {!latestLm && <ActionRow icon={Mail} title="Créer une lettre de motivation" subtitle="Préparez une lettre ciblée pour une offre." action="Créer" onClick={() => createDoc('lm')} />}
            <ActionRow icon={Briefcase} title="Voir les offres d’emploi" subtitle="Préparez une candidature avec Omnia Career." action="Voir" onClick={() => { window.location.href = '/emploi'; }} />
          </div>
        </Card>

        <Card className="p-5">
          <SectionHeader title="Mon CV le plus récent" action="Voir mes CV" onAction={() => goToView('cv')} />
          {latestCv ? (
            <div className="space-y-4">
              <div className="rounded-2xl border p-4" style={{ borderColor: BORDER }}>
                <div className="text-base font-semibold" style={{ color: OMNIA_BLUE }}>{latestCv.title}</div>
                <div className="mt-1 text-sm" style={{ color: MUTED }}>Mis à jour le {formatDate(latestCv.updated_at)}</div>
                <div className="mt-3 flex items-center gap-2"><Badge tone="green">Score {latestCv.ats_score ?? 0}/100</Badge>{latestCv.is_primary && <Badge tone="gold">Principal</Badge>}</div>
              </div>
              <div className="flex gap-2"><Button onClick={() => openDoc(latestCv.id, 'cv')}>Modifier</Button><Button variant="secondary" onClick={() => openDoc(latestCv.id, 'cv')}>Aperçu</Button></div>
            </div>
          ) : <EmptyState title="Aucun CV créé" description="Votre CV principal apparaîtra ici après création." actionLabel="Créer mon CV" onAction={() => createDoc('cv')} />}
        </Card>

        <Card className="p-5">
          <SectionHeader title="Modèles recommandés" action="Tous les modèles" onAction={() => goToView('cv')} />
          {templates.length ? <div className="grid grid-cols-1 gap-3">{templates.slice(0, 3).map(t => <TemplateMini key={t.template_key} template={t} onClick={() => createDoc('cv', t.template_key)} />)}</div> : <EmptyState icon={FolderOpen} title="Aucun modèle disponible" description="Les modèles seront affichés après configuration Super Admin." />}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1fr]">
        <Card className="p-5">
          <SectionHeader title="Activité récente" />
          {docs.length ? <div className="space-y-3">{docs.slice(0, 5).map(doc => <button key={doc.id} onClick={() => openDoc(doc.id, doc.doc_type)} className="flex w-full items-center justify-between rounded-xl border p-3 text-left hover:bg-slate-50" style={{ borderColor: BORDER }}><span><b style={{ color: OMNIA_BLUE }}>{doc.title}</b><span className="ml-2 text-xs" style={{ color: MUTED }}>{doc.doc_type === 'cv' ? 'CV' : 'LM'}</span></span><span className="text-xs" style={{ color: MUTED }}>{formatDate(doc.updated_at)}</span></button>)}</div> : <EmptyState title="Aucune activité récente" description="Vos créations et modifications apparaîtront ici." />}
        </Card>
        <Card className="p-5">
          <SectionHeader title="Démarrage rapide" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4"><QuickTile icon={FileText} label="Créer un CV" onClick={() => createDoc('cv')} /><QuickTile icon={Mail} label="Nouvelle lettre" onClick={() => createDoc('lm')} /><QuickTile icon={MessageSquare} label="Entretien" onClick={() => goToView('interview')} /><QuickTile icon={Target} label="Offres" onClick={() => { window.location.href = '/emploi'; }} /></div>
        </Card>
      </div>
    </div>
  );
}

function DocumentsView({ title, subtitle, type, documents, templates, createDoc, openDoc, deleteDoc }: { title: string; subtitle: string; type: DocType; documents: CareerDocument[]; templates: Template[]; createDoc: (type: DocType, template?: string) => void; openDoc: (id?: string, type?: DocType) => void; deleteDoc: (id: string) => void }) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} subtitle={subtitle} actionLabel={type === 'cv' ? 'Créer un CV' : 'Créer une lettre'} onAction={() => createDoc(type)} />
      <Card className="p-5">
        <SectionHeader title={type === 'cv' ? 'Mes CV' : 'Mes lettres'} />
        {documents.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{documents.map(doc => <DocumentCard key={doc.id} doc={doc} onOpen={() => openDoc(doc.id, type)} onDelete={() => deleteDoc(doc.id)} />)}</div> : <EmptyState title={type === 'cv' ? 'Aucun CV créé pour le moment' : 'Aucune lettre de motivation créée'} description={type === 'cv' ? 'Créez votre premier CV avec un modèle Omnia Career.' : 'Créez votre première lettre pour une candidature ciblée.'} actionLabel={type === 'cv' ? 'Créer mon premier CV' : 'Créer une lettre'} onAction={() => createDoc(type)} />}
      </Card>
      <Card className="p-5">
        <SectionHeader title="Modèles disponibles" />
        {templates.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{templates.map(t => <TemplateLarge key={t.template_key} template={t} onClick={() => createDoc(type, t.template_key)} />)}</div> : <EmptyState icon={FolderOpen} title="Aucun modèle disponible" description="Les modèles seront visibles après configuration Super Admin." />}
      </Card>
    </div>
  );
}

function ApplicationsView({ applications, job, navigate, createDoc }: { applications: TrackedApplication[]; job: JobSummary | null; navigate: (path: string) => void; createDoc: (type: DocType, template?: string) => void }) {
  const columns = [
    { title: 'À préparer', statuses: ['draft', 'prepared'], tone: 'gray' },
    { title: 'Envoyées', statuses: ['redirected', 'email_prepared', 'declared_sent', 'submitted', 'received', 'waiting_response'], tone: 'blue' },
    { title: 'En analyse', statuses: ['viewed', 'under_review', 'shortlisted', 'response_received', 'follow_up_recommended', 'followed_up'], tone: 'gold' },
    { title: 'Entretien', statuses: ['interview'], tone: 'purple' },
    { title: 'Finalisées', statuses: ['accepted', 'rejected', 'archived'], tone: 'green' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Suivi candidatures" subtitle="Suivez vos candidatures Omnia et vos candidatures ajoutées manuellement." actionLabel="Voir les offres" onAction={() => navigate('/emploi')} />
      {job && <TargetJobCard job={job} createDoc={createDoc} navigate={navigate} />}
      {applications.length ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          {columns.map(col => {
            const items = applications.filter(app => col.statuses.includes(app.tracking_status || app.status || 'draft'));
            return <Card key={col.title} className="p-4"><div className="mb-4 flex items-center justify-between"><h2 className="text-base font-semibold" style={{ color: OMNIA_BLUE }}>{col.title}</h2><Badge tone={col.tone as any}>{items.length}</Badge></div><div className="space-y-3">{items.map(app => <ApplicationCard key={app.id} app={app} navigate={navigate} />)}</div></Card>;
          })}
        </div>
      ) : <EmptyState icon={Briefcase} title="Aucune candidature suivie" description="Postulez depuis une offre Omnia ou ajoutez une candidature manuelle pour commencer votre suivi." actionLabel="Voir les offres" onAction={() => navigate('/emploi')} />}
    </div>
  );
}

function InterviewView({ job, navigate }: { job: JobSummary | null; navigate: (path: string) => void }) {
  return (
    <div className="space-y-6">
      <PageHeader title="Préparation entretien" subtitle="Préparez vos réponses à partir d’une offre, de votre CV et de vos lettres." actionLabel="Voir les offres" onAction={() => navigate('/emploi')} />
      {job ? <Card className="p-5"><SectionHeader title="Préparation liée à une offre" /><div className="rounded-2xl border p-4" style={{ borderColor: BORDER }}><div className="text-base font-semibold" style={{ color: OMNIA_BLUE }}>{job.title}</div><div className="mt-1 text-sm" style={{ color: MUTED }}>{job.recruiter_company || 'Entreprise'} · {job.location || 'Lieu non renseigné'}</div><p className="mt-3 text-sm leading-6" style={{ color: MUTED }}>Utilisez le CV et la lettre préparés dans Omnia Career pour générer des questions d’entretien adaptées à cette offre.</p><div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => navigate(`/dashboard/career-studio?section=applications&job_id=${job.id}`)}>Préparer la candidature</Button><Button variant="secondary" onClick={() => navigate(`/emploi/${job.id}`)}>Retour à l’offre</Button></div></div></Card> : <EmptyState icon={MessageSquare} title="Aucune offre sélectionnée" description="Ouvrez une offre d’emploi, puis cliquez sur “Préparer avec Omnia Career” pour obtenir une préparation ciblée." actionLabel="Voir les offres" onAction={() => navigate('/emploi')} />}
      <Card className="p-5"><SectionHeader title="Banque de questions" /><EmptyState icon={ShieldCheck} title="Aucune question officielle disponible" description="Les questions RH, techniques et sectorielles seront alimentées par le Super Admin Omnia Career. Les questions personnalisées seront générées à partir d’une offre ciblée." /></Card>
    </div>
  );
}

function ProfileView({ user, docs, goToView }: { user: CurrentUser | null; docs: CareerDocument[]; goToView: (view: ActiveView) => void }) {
  return <div className="space-y-6"><PageHeader title="Profil carrière" subtitle="Données du compte apprenant et documents liés à votre espace carrière." /><div className="grid grid-cols-1 gap-5 xl:grid-cols-3"><Card className="p-5 xl:col-span-1"><SectionHeader title="Compte" /><div className="flex items-center gap-4"><div className="flex h-16 w-16 items-center justify-center rounded-full text-lg font-bold text-white" style={{ background: OMNIA_BLUE }}>{getInitials(user?.full_name || user?.name, user?.email)}</div><div><div className="text-base font-semibold" style={{ color: OMNIA_BLUE }}>{user?.full_name || user?.name || 'Nom non renseigné'}</div><div className="text-sm" style={{ color: MUTED }}>{user?.email || 'Email non renseigné'}</div></div></div></Card><Card className="p-5 xl:col-span-2"><SectionHeader title="Complétude carrière" /><div className="grid gap-3 md:grid-cols-3"><Metric label="Documents" value={docs.length} /><Metric label="CV" value={docs.filter(d => d.doc_type === 'cv').length} /><Metric label="Lettres" value={docs.filter(d => d.doc_type === 'lm').length} /></div><div className="mt-4"><Button onClick={() => goToView('cv')}>Compléter mon profil avec un CV</Button></div></Card></div></div>;
}

function CoachingView({ docs, applications, goToView }: { docs: CareerDocument[]; applications: TrackedApplication[]; goToView: (view: ActiveView) => void }) {
  return <div className="space-y-6"><PageHeader title="Coaching carrière" subtitle="Votre accompagnement se construit à partir de vos CV, lettres et candidatures réels." /><div className="grid gap-4 md:grid-cols-3"><MetricCard title="Documents créés" value={docs.length} icon={FileText} /><MetricCard title="Candidatures suivies" value={applications.length} icon={Briefcase} /><MetricCard title="Jetons utilisés" value="—" icon={Coins} /></div><Card className="p-5"><SectionHeader title="Plan d’action" /><EmptyState icon={Star} title="Aucun plan de coaching actif" description="Le coaching personnalisé sera généré à partir de vos objectifs, de vos documents et de vos candidatures. Commencez par compléter votre CV et vos candidatures." actionLabel="Aller au CV Builder" onAction={() => goToView('cv')} /></Card></div>;
}

function SettingsView({ user, packs, tokens, onPremium }: { user: CurrentUser | null; packs: TokenPack[]; tokens: number; onPremium: () => void }) {
  const [notifications, setNotifications] = useState({ jobs: true, applications: true, interviews: true, advice: false });
  return <div className="space-y-6"><PageHeader title="Paramètres" subtitle="Gérez vos préférences Omnia Career." /><div className="grid grid-cols-1 gap-5 xl:grid-cols-3"><Card className="p-5"><SectionHeader title="Compte" /><ReadOnlyField label="Nom complet" value={user?.full_name || user?.name || 'Non renseigné'} /><ReadOnlyField label="Adresse e-mail" value={user?.email || 'Non renseignée'} /></Card><Card className="p-5"><SectionHeader title="Notifications" />{Object.entries({ jobs: 'Nouvelles opportunités d’emploi', applications: 'Mises à jour candidatures', interviews: 'Rappels entretien', advice: 'Conseils carrière' }).map(([key, label]) => <button key={key} onClick={() => setNotifications(prev => ({ ...prev, [key]: !prev[key as keyof typeof prev] }))} className="mb-3 flex w-full items-center justify-between text-left text-sm" style={{ color: OMNIA_BLUE }}><span>{label}</span><span className="relative h-5 w-9 rounded-full" style={{ background: notifications[key as keyof typeof notifications] ? OMNIA_BLUE : '#D1D5DB' }}><span className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition" style={{ left: notifications[key as keyof typeof notifications] ? 18 : 2 }} /></span></button>)}</Card><Card className="p-5"><SectionHeader title="Jetons CV" /><div className="text-3xl font-semibold" style={{ color: OMNIA_BLUE }}>{tokens}</div><p className="text-sm" style={{ color: MUTED }}>jeton(s) disponible(s)</p><Button className="mt-4" onClick={onPremium}>Acheter des jetons</Button></Card></div><Card className="p-5"><SectionHeader title="Packs disponibles" />{packs.length ? <div className="grid gap-3 md:grid-cols-3">{packs.map(pack => <div key={pack.pack_key} className="rounded-xl border p-4" style={{ borderColor: BORDER }}><div className="text-sm font-semibold" style={{ color: OMNIA_BLUE }}>{pack.name_fr}</div><div className="mt-1 text-sm" style={{ color: MUTED }}>{pack.tokens + (pack.bonus_tokens || 0)} jeton(s)</div><div className="mt-2 text-sm font-semibold" style={{ color: OMNIA_GOLD }}>{pack.price_xof ? `${pack.price_xof} FCFA` : pack.price_eur ? `${pack.price_eur} €` : 'Prix à configurer'}</div></div>)}</div> : <EmptyState icon={Coins} title="Aucun pack configuré" description="Les packs seront affichés après configuration dans le Super Admin." />}</Card></div>;
}

function PremiumModal({ packs, onClose }: { packs: TokenPack[]; onClose: () => void }) {
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-6"><div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-2xl font-semibold" style={{ color: OMNIA_BLUE }}>Omnia Career Premium</h2><p className="mt-1 text-sm" style={{ color: MUTED }}>Modèles premium, analyses avancées et jetons CV.</p></div><button onClick={onClose} className="rounded-full p-2 hover:bg-slate-100"><X size={20} /></button></div>{packs.length ? <div className="grid gap-4 md:grid-cols-3">{packs.map(pack => <div key={pack.pack_key} className="rounded-2xl border p-5" style={{ borderColor: pack.is_popular ? OMNIA_GOLD : BORDER }}><div className="text-base font-semibold" style={{ color: OMNIA_BLUE }}>{pack.name_fr}</div><div className="mt-2 text-2xl font-semibold" style={{ color: OMNIA_GOLD }}>{pack.tokens + (pack.bonus_tokens || 0)}</div><div className="text-sm" style={{ color: MUTED }}>jetons</div><Button className="mt-4 w-full" onClick={() => alert('Connexion paiement à intégrer avec votre module paiement.')}>Choisir</Button></div>)}</div> : <EmptyState icon={Crown} title="Aucun pack configuré" description="Configurez les packs Omnia Career depuis le Super Admin." />}</div></div>;
}

function PageHeader({ title, subtitle, actionLabel, onAction }: { title: string; subtitle: string; actionLabel?: string; onAction?: () => void }) {
  return <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold" style={{ color: OMNIA_BLUE }}>{title}</h1><p className="mt-1 text-sm leading-6" style={{ color: MUTED }}>{subtitle}</p></div>{actionLabel && onAction && <Button onClick={onAction}><Plus size={16} />{actionLabel}</Button>}</div>;
}

function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-base font-semibold" style={{ color: OMNIA_BLUE }}>{title}</h2>{action && onAction && <button onClick={onAction} className="text-xs font-semibold" style={{ color: OMNIA_BLUE }}>{action}</button>}</div>;
}

function Button({ children, onClick, variant = 'primary', className = '' }: { children: React.ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary'; className?: string }) {
  return <button onClick={onClick} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${variant === 'primary' ? 'text-white' : 'border bg-white'} ${className}`} style={variant === 'primary' ? { background: OMNIA_BLUE } : { color: OMNIA_BLUE, borderColor: BORDER }}>{children}</button>;
}

function ActionRow({ icon: Icon, title, subtitle, action, onClick }: { icon: typeof FileText; title: string; subtitle: string; action: string; onClick: () => void }) {
  return <button onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition hover:bg-slate-50" style={{ borderColor: BORDER }}><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50"><Icon size={18} color={OMNIA_BLUE} /></div><div className="min-w-0 flex-1"><div className="text-sm font-semibold" style={{ color: OMNIA_BLUE }}>{title}</div><div className="truncate text-xs" style={{ color: MUTED }}>{subtitle}</div></div><span className="text-xs font-semibold" style={{ color: OMNIA_GOLD }}>{action}</span></button>;
}

function QuickTile({ icon: Icon, label, onClick }: { icon: typeof FileText; label: string; onClick: () => void }) {
  return <button onClick={onClick} className="rounded-2xl border p-4 text-center hover:bg-slate-50" style={{ borderColor: BORDER }}><Icon className="mx-auto h-5 w-5" style={{ color: OMNIA_BLUE }} /><div className="mt-2 text-xs font-semibold" style={{ color: OMNIA_BLUE }}>{label}</div></button>;
}

function TemplateMini({ template, onClick }: { template: Template; onClick: () => void }) {
  return <button onClick={onClick} className="flex items-center gap-3 rounded-2xl border p-3 text-left hover:bg-slate-50" style={{ borderColor: BORDER }}><div className="flex h-14 w-11 items-center justify-center rounded-lg bg-slate-50"><FileText size={18} color={OMNIA_BLUE} /></div><div><div className="text-sm font-semibold" style={{ color: OMNIA_BLUE }}>{template.name_fr}</div><div className="line-clamp-1 text-xs" style={{ color: MUTED }}>{template.description_fr || 'Modèle Omnia Career'}</div><div className="mt-1 flex gap-1">{template.is_ats_compatible && <Badge tone="green">ATS</Badge>}{!template.is_free && <Badge tone="gold">Premium</Badge>}</div></div></button>;
}

function TemplateLarge({ template, onClick }: { template: Template; onClick: () => void }) {
  return <button onClick={onClick} className="rounded-2xl border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md" style={{ borderColor: BORDER }}><div className="mb-4 flex h-44 items-center justify-center rounded-xl bg-slate-50"><div className="h-36 w-24 rounded-lg border bg-white p-2 shadow-sm" style={{ borderColor: BORDER }}><div className="h-5 rounded" style={{ background: OMNIA_BLUE }} /><div className="mt-2 h-1.5 rounded bg-slate-200" /><div className="mt-2 h-1.5 rounded bg-slate-200" /><div className="mt-2 h-1.5 rounded bg-slate-200" /><div className="mt-4 h-1 rounded" style={{ background: OMNIA_GOLD }} /><div className="mt-2 h-1.5 rounded bg-slate-200" /><div className="mt-2 h-1.5 rounded bg-slate-200" /></div></div><div className="text-sm font-semibold" style={{ color: OMNIA_BLUE }}>{template.name_fr}</div><div className="mt-1 min-h-[34px] text-xs leading-5" style={{ color: MUTED }}>{template.description_fr || 'Modèle Omnia Career'}</div><div className="mt-3 flex gap-1">{template.is_ats_compatible && <Badge tone="green">ATS</Badge>}{template.is_free ? <Badge tone="blue">Gratuit</Badge> : <Badge tone="gold">Premium</Badge>}</div></button>;
}

function DocumentCard({ doc, onOpen, onDelete }: { doc: CareerDocument; onOpen: () => void; onDelete: () => void }) {
  return <div className="rounded-2xl border bg-white p-4" style={{ borderColor: BORDER }}><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-semibold" style={{ color: OMNIA_BLUE }}>{doc.title}</div><div className="mt-1 text-xs" style={{ color: MUTED }}>Mis à jour le {formatDate(doc.updated_at)}</div></div><Badge tone={doc.doc_type === 'cv' ? 'blue' : 'gold'}>{doc.doc_type === 'cv' ? 'CV' : 'LM'}</Badge></div><div className="mt-4 flex gap-2"><Button onClick={onOpen}>Ouvrir</Button><Button variant="secondary" onClick={onDelete}><Trash2 size={14} /></Button></div></div>;
}

function ApplicationCard({ app, navigate }: { app: TrackedApplication; navigate: (path: string) => void }) {
  const status = app.tracking_status || app.status || 'draft';
  const mode = normalizeApplicationMode(app.application_mode || app.job_offers?.application_mode);
  const tone = STATUS_TONE[status] || 'blue';
  const jobId = app.job_offers?.id || app.job_id;
  return <div className="rounded-xl border bg-white p-3" style={{ borderColor: BORDER }}><div className="text-sm font-semibold" style={{ color: OMNIA_BLUE }}>{app.job_offers?.title || app.job_title || 'Poste non renseigné'}</div><div className="text-xs" style={{ color: MUTED }}>{app.job_offers?.recruiter_company || app.company_name || 'Entreprise non renseignée'} · {app.job_offers?.contract_type || app.contract_type || 'Contrat non renseigné'}</div><div className="mt-3 flex flex-wrap gap-2"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${toneClass(tone)}`}>{labelApplicationStatus(status)}</span><span className="rounded-full px-2 py-1 text-xs font-semibold" style={{ background: mode === 'omnia_managed' ? 'rgba(0,32,80,0.08)' : 'rgba(191,136,19,0.12)', color: mode === 'omnia_managed' ? OMNIA_BLUE : OMNIA_GOLD }}>{APPLICATION_MODE_SHORT_LABELS[mode]}</span></div>{jobId && <button onClick={() => navigate(`/emploi/${jobId}`)} className="mt-3 text-xs font-semibold" style={{ color: OMNIA_BLUE }}>Voir l’offre →</button>}</div>;
}

function TargetJobCard({ job, createDoc, navigate }: { job: JobSummary; createDoc: (type: DocType, template?: string) => void; navigate: (path: string) => void }) {
  return <Card className="p-5"><SectionHeader title="Offre ciblée" /><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="text-base font-semibold" style={{ color: OMNIA_BLUE }}>{job.title}</div><div className="mt-1 text-sm" style={{ color: MUTED }}>{job.recruiter_company || 'Entreprise'} · {job.location || 'Lieu non renseigné'} · {job.contract_type || 'Contrat'}</div></div><div className="flex flex-wrap gap-2"><Button onClick={() => createDoc('cv')}>Préparer un CV</Button><Button variant="secondary" onClick={() => createDoc('lm')}>Préparer une lettre</Button><Button variant="secondary" onClick={() => navigate(`/emploi/${job.id}`)}>Retour à l’offre</Button></div></div></Card>;
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="rounded-xl border p-4" style={{ borderColor: BORDER }}><div className="text-xs" style={{ color: MUTED }}>{label}</div><div className="mt-1 text-2xl font-semibold" style={{ color: OMNIA_BLUE }}>{value}</div></div>;
}

function MetricCard({ title, value, icon: Icon }: { title: string; value: React.ReactNode; icon: typeof FileText }) {
  return <Card className="p-5"><Icon className="mb-4 h-5 w-5" style={{ color: OMNIA_GOLD }} /><div className="text-sm" style={{ color: MUTED }}>{title}</div><div className="mt-1 text-2xl font-semibold" style={{ color: OMNIA_BLUE }}>{value}</div></Card>;
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return <label className="mb-3 block text-sm font-medium" style={{ color: OMNIA_BLUE }}>{label}<input className="mt-1 h-10 w-full rounded-xl border px-3 text-sm" style={{ borderColor: BORDER }} value={value} readOnly /></label>;
}
