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

function templateMockup(templateKey: string) {
  return `/career-template-mockups/individual/${templateKey}.webp`;
}

function normalizedStatus(status?: string) {
  return status === 'completed' || status === 'finished' || status === 'published' ? 'completed' : 'draft';
}

function isRealDocument(doc: CareerDocument) {
  return Boolean(doc.id && (doc.updated_at || doc.created_at));
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
  const [globalSearch, setGlobalSearch] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showPremium, setShowPremium] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const user = readUser();
  const displayName = user?.full_name || user?.name || user?.email || 'Apprenant';
  const initials = getInitials(displayName, user?.email);

  const cvDocs = useMemo(() => documents.filter((doc) => doc.doc_type === 'cv' && isRealDocument(doc)), [documents]);
  const lmDocs = useMemo(() => documents.filter((doc) => doc.doc_type === 'lm' && isRealDocument(doc)), [documents]);
  const searchResults = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (!q) return [] as Array<{label:string; type:string; action:()=>void}>;
    const results: Array<{label:string; type:string; action:()=>void}> = [];
    documents.filter(isRealDocument).filter(d => `${d.title} ${d.doc_type}`.toLowerCase().includes(q)).forEach(d => results.push({ label:d.title, type:d.doc_type === 'cv' ? 'CV' : 'Lettre', action:()=>openDoc(d.id,d.doc_type) }));
    [...cvTemplates,...lmTemplates].filter(t => `${t.name_fr} ${t.description_fr || ''}`.toLowerCase().includes(q)).slice(0,12).forEach(t => results.push({ label:t.name_fr, type:t.template_key.startsWith('lm_') ? 'Modèle LM' : 'Modèle CV', action:()=>createDoc(t.template_key.startsWith('lm_') ? 'lm':'cv',t.template_key) }));
    navItems.filter(n => n.label.toLowerCase().includes(q)).forEach(n => results.push({label:n.label,type:'Page',action:()=>goToView(n.id)}));
    return results.slice(0,20);
  }, [globalSearch, documents, cvTemplates, lmTemplates]);
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
        <aside className="fixed left-0 top-0 z-40 flex h-screen w-[280px] flex-col overflow-hidden text-white shadow-xl" style={{ background: OMNIA_BLUE }}>
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

          <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-4">
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

          <div className="shrink-0 border-t border-white/10 bg-[#002050] px-5 pb-5 pt-4">
            <div className="rounded-2xl border p-4" style={{ borderColor: 'rgba(191,136,19,0.45)', background: 'rgba(255,255,255,0.05)' }}>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: OMNIA_GOLD }}>
                <Crown size={18} color="white" />
              </div>
              <h3 className="text-base font-semibold" style={{ color: OMNIA_GOLD }}>Passez à Premium</h3>
              <p className="mt-2 text-sm leading-6 text-white/75">Accédez à des modèles exclusifs, des analyses avancées et plus.</p>
              <button onClick={() => setShowPremium(true)} className="mt-4 h-10 w-full rounded-xl text-sm font-semibold text-white" style={{ background: OMNIA_GOLD }}>Découvrir Premium</button>
            </div>
            <button className="ml-auto mt-4 flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:bg-white/10" aria-label="Réduire le menu">
              <ChevronsLeft size={18} />
            </button>
          </div>
        </aside>

        {/* Main */}
        <div className="ml-[280px] flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b bg-white px-8" style={{ borderColor: BORDER }}>
            <div className="relative w-full max-w-[560px]">
              <div className="flex h-11 items-center rounded-2xl border bg-white px-4" style={{ borderColor: BORDER }}>
                <Search size={18} color="#9CA3AF" />
                <input value={globalSearch} onChange={(e)=>{setGlobalSearch(e.target.value);setShowSearchResults(true)}} onFocus={()=>setShowSearchResults(true)} className="ml-3 h-full flex-1 border-0 bg-transparent text-sm outline-none" placeholder="Rechercher dans Omnia Career..." />
                {globalSearch && <button onClick={()=>setGlobalSearch('')} aria-label="Effacer"><X size={16} color={MUTED}/></button>}
              </div>
              {showSearchResults && globalSearch.trim() && <div className="absolute left-0 right-0 top-13 z-50 max-h-80 overflow-auto rounded-2xl border bg-white p-2 shadow-xl" style={{borderColor:BORDER}}>
                {searchResults.length ? searchResults.map((r,i)=><button key={`${r.type}-${r.label}-${i}`} onClick={()=>{r.action();setShowSearchResults(false);setGlobalSearch('')}} className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left hover:bg-slate-50"><span className="text-sm font-semibold" style={{color:OMNIA_BLUE}}>{r.label}</span><span className="text-xs" style={{color:MUTED}}>{r.type}</span></button>) : <div className="p-4 text-sm" style={{color:MUTED}}>Aucun résultat.</div>}
              </div>}
            </div>
            <div className="ml-6 flex items-center gap-4">
              <div className="relative"><button onClick={()=>setShowNotifications(v=>!v)} className="relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100" aria-label="Notifications"><Bell size={18} color={OMNIA_BLUE} /></button>{showNotifications && <div className="absolute right-0 top-12 z-50 w-80 rounded-2xl border bg-white p-4 shadow-xl" style={{borderColor:BORDER}}><h3 className="font-semibold" style={{color:OMNIA_BLUE}}>Notifications</h3><p className="mt-3 text-sm" style={{color:MUTED}}>Aucune notification non lue.</p></div>}</div>
              <div className="h-8 w-px bg-gray-200" />
              <div className="relative">
                <button onClick={() => setShowProfileMenu(v => !v)} className="flex items-center gap-3 rounded-xl px-2 py-1 hover:bg-gray-100">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: OMNIA_BLUE }}>{initials}</div>
                  <div className="hidden text-left md:block">
                    <div className="text-sm font-semibold" style={{ color: OMNIA_BLUE }}>{displayName}</div>
                    <div className="text-xs" style={{ color: MUTED }}>Apprenant</div>
                  </div>
                  <ChevronDown size={16} color={MUTED} className={showProfileMenu ? 'rotate-180' : ''} />
                </button>
                {showProfileMenu && <div className="absolute right-0 top-12 z-50 w-64 rounded-2xl border bg-white p-2 shadow-xl" style={{borderColor:BORDER}}>
                  <button onClick={() => navigate('/dashboard')} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold hover:bg-slate-50" style={{color:OMNIA_BLUE}}><ChevronRight size={16} className="rotate-180"/>Retour au Dashboard</button>
                  <button onClick={() => goToView('profile')} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold hover:bg-slate-50" style={{color:OMNIA_BLUE}}><UserRound size={16}/>Mon profil carrière</button>
                  <button onClick={() => goToView('settings')} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold hover:bg-slate-50" style={{color:OMNIA_BLUE}}><Settings size={16}/>Paramètres</button>
                </div>}
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
      {showPremium && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h2 className="text-xl font-semibold" style={{color:OMNIA_BLUE}}>Omnia Career Premium</h2><p className="mt-2 text-sm" style={{color:MUTED}}>Modèles premium, coaching humain sur demande et analyses avancées. Les tarifs sont définis par le Super Admin.</p></div><button onClick={()=>setShowPremium(false)}><X size={20}/></button></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border p-4" style={{borderColor:BORDER}}><b>Modèles premium</b><p className="mt-1 text-sm" style={{color:MUTED}}>Accès aux modèles CV et LM premium.</p></div><div className="rounded-2xl border p-4" style={{borderColor:BORDER}}><b>Coaching humain</b><p className="mt-1 text-sm" style={{color:MUTED}}>Demande de rendez-vous auprès de la plateforme.</p></div></div><button onClick={()=>{setShowPremium(false);goToView('settings')}} className="mt-6 w-full rounded-xl py-3 font-semibold text-white" style={{background:OMNIA_GOLD}}>Voir les options disponibles</button></div></div>}
    </div>
  );
}

function DashboardView({
  loading, cvDocs, lmDocs, templates, tokens, quickActions, setActiveView, createDoc, openDoc,
}: {
  loading: boolean; cvDocs: CareerDocument[]; lmDocs: CareerDocument[]; latestCv?: CareerDocument; latestLm?: CareerDocument;
  templates: Template[]; tokens: number; quickActions: { label: string; icon: typeof FileText; action: () => void }[];
  setActiveView: (view: ActiveView) => void; createDoc: (type: DocType, templateKey?: string) => void; openDoc: (id?: string, type?: DocType) => void;
}) {
  const cvDrafts=cvDocs.filter(d=>normalizedStatus(d.status)==='draft');
  const cvDone=cvDocs.filter(d=>normalizedStatus(d.status)==='completed');
  const lmDrafts=lmDocs.filter(d=>normalizedStatus(d.status)==='draft');
  const lmDone=lmDocs.filter(d=>normalizedStatus(d.status)==='completed');
  const recent=[...cvDocs,...lmDocs].sort((a,b)=>new Date(b.updated_at||0).getTime()-new Date(a.updated_at||0).getTime()).slice(0,5);
  const stats=[
    {label:'CV brouillons',value:cvDrafts.length,view:'cv' as ActiveView,icon:FileText},
    {label:'CV terminés',value:cvDone.length,view:'cv' as ActiveView,icon:CheckCircle2},
    {label:'LM brouillons',value:lmDrafts.length,view:'lm' as ActiveView,icon:Mail},
    {label:'LM terminées',value:lmDone.length,view:'lm' as ActiveView,icon:ShieldCheck},
    {label:'Jetons disponibles',value:tokens,view:'settings' as ActiveView,icon:Coins},
  ];
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-semibold" style={{color:OMNIA_BLUE}}>Tableau de bord Omnia Career</h1><p className="mt-1 text-sm" style={{color:MUTED}}>Un aperçu simple de vos documents et candidatures réelles.</p></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{stats.map(st=>{const Icon=st.icon;return <button key={st.label} onClick={()=>setActiveView(st.view)} className="rounded-2xl border bg-white p-5 text-left shadow-sm" style={{borderColor:BORDER}}><Icon size={20} color={OMNIA_BLUE}/><div className="mt-3 text-2xl font-semibold" style={{color:OMNIA_BLUE}}>{loading?'…':st.value}</div><div className="text-sm" style={{color:MUTED}}>{st.label}</div></button>})}</div>
    <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
      <Card className="p-5"><SectionTitle title="Actions principales"/><div className="grid gap-3 sm:grid-cols-2">{quickActions.map(a=>{const Icon=a.icon;return <button key={a.label} onClick={a.action} className="flex items-center gap-3 rounded-2xl border p-4 text-left hover:bg-slate-50" style={{borderColor:BORDER}}><div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{background:'rgba(0,32,80,.08)'}}><Icon size={18} color={OMNIA_BLUE}/></div><span className="text-sm font-semibold" style={{color:OMNIA_BLUE}}>{a.label}</span></button>})}</div></Card>
      <Card className="p-5"><SectionTitle title="Activité récente"/>{recent.length?<div className="space-y-3">{recent.map(d=><button key={d.id} onClick={()=>openDoc(d.id,d.doc_type)} className="flex w-full items-center justify-between rounded-xl border p-3 text-left" style={{borderColor:BORDER}}><div><div className="text-sm font-semibold" style={{color:OMNIA_BLUE}}>{d.title}</div><div className="text-xs" style={{color:MUTED}}>{d.doc_type==='cv'?'CV':'Lettre'} · {normalizedStatus(d.status)==='completed'?'Terminé':'Brouillon'} · {formatDate(d.updated_at)}</div></div><ChevronRight size={16}/></button>)}</div>:<EmptyState text="Aucune activité enregistrée."/>}</Card>
    </div>
    <Card className="p-5"><div className="flex items-center justify-between"><SectionTitle title="Modèles CV officiels"/><button onClick={()=>setActiveView('cv')} className="text-sm font-semibold" style={{color:OMNIA_BLUE}}>Voir les 20 modèles</button></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">{(templates.length?templates:fallbackCvTemplates).slice(0,5).map(t=><button key={t.template_key} onClick={()=>createDoc('cv',t.template_key)} className="overflow-hidden rounded-2xl border bg-white text-left" style={{borderColor:BORDER}}><img src={templateMockup(t.template_key)} alt={t.name_fr} className="aspect-[0.71] w-full object-cover object-top"/><div className="p-3 text-sm font-semibold" style={{color:OMNIA_BLUE}}>{t.name_fr}</div></button>)}</div></Card>
  </div>;
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
        <Card className="p-5"><SectionTitle title="Mes lettres" />{documents.length ? <div className="space-y-3">{documents.slice(0, 4).map((doc) => <button key={doc.id} onClick={() => openDoc(doc.id, 'lm')} className="w-full rounded-xl border p-3 text-left hover:bg-gray-50" style={{ borderColor: BORDER }}><div className="text-sm font-semibold" style={{ color: OMNIA_BLUE }}>{doc.title}</div><div className="text-xs" style={{ color: MUTED }}>Modifiée le {formatDate(doc.updated_at)}</div></button>)}</div> : <EmptyState text="Aucune lettre créée." action="Créer ma première lettre" onAction={() => createDoc('lm')} />}</Card>
        <Card className="p-5"><LetterPreview /></Card>
        <Card className="p-5"><SectionTitle title="Suggestions IA" /><p className="text-sm" style={{color:MUTED}}>Les suggestions apparaîtront uniquement après analyse réelle de votre lettre.</p><div className="mt-5 border-t pt-5" style={{ borderColor: BORDER }}><SectionTitle title="Modèles LM" />{(templates.length ? templates : fallbackLmTemplates).slice(0, 3).map(t => <button key={t.template_key} onClick={() => createDoc('lm', t.template_key)} className="mb-2 flex w-full items-center justify-between rounded-xl border p-3 text-sm" style={{ borderColor: BORDER, color: OMNIA_BLUE }}><span>{t.name_fr}</span><ChevronRight size={16} /></button>)}</div></Card>
      </div>
      <DocumentsList title="Mes lettres enregistrées" documents={documents} empty="Aucune lettre enregistrée pour le moment." createLabel="Créer une lettre" onCreate={() => createDoc('lm')} onOpen={(id) => openDoc(id, 'lm')} onDelete={deleteDoc} />
    </div>
  );
}

function InterviewView({ jobId }: { jobId?: string }) {
  const categories = [
    ['general','Général'],['rh','RH'],['behavioral','Comportemental'],['technical','Technique'],['sector','Sectoriel'],['job','Lié à une offre']
  ] as const;
  const banks:Record<string,string[]>={
    general:['Présentez-vous en deux minutes.','Pourquoi souhaitez-vous rejoindre cette entreprise ?','Pourquoi êtes-vous la bonne personne pour ce poste ?','Quel projet vous rend le plus fier ?','Comment organisez-vous vos priorités ?','Où vous voyez-vous dans trois ans ?'],
    rh:['Quelles sont vos principales forces ?','Quel est votre axe d’amélioration actuel ?','Pourquoi souhaitez-vous quitter votre poste actuel ?','Quel environnement de travail vous convient le mieux ?','Comment recevez-vous un feedback difficile ?','Qu’attendez-vous de votre futur manager ?'],
    behavioral:['Décrivez une situation où vous avez résolu un problème difficile.','Parlez d’un conflit professionnel et de sa résolution.','Donnez un exemple de résultat mesurable obtenu.','Racontez une situation où vous avez dû vous adapter rapidement.','Décrivez une erreur et ce que vous en avez appris.','Parlez d’une décision prise sous pression.'],
    technical:['Quelles compétences techniques maîtrisez-vous le mieux ?','Expliquez un projet technique complexe auquel vous avez participé.','Comment contrôlez-vous la qualité de votre travail ?','Comment documentez-vous votre travail ?','Comment apprenez-vous un nouvel outil ?','Décrivez votre méthode de résolution d’un incident.'],
    sector:['Quels sont les enjeux actuels de votre secteur ?','Quelles normes ou réglementations connaissez-vous ?','Comment restez-vous à jour dans votre domaine ?','Quel changement majeur anticipez-vous dans votre secteur ?','Quels indicateurs suivez-vous dans votre métier ?','Comment gérez-vous les risques propres à votre secteur ?'],
    job: jobId ? ['Pourquoi cette offre vous intéresse-t-elle précisément ?','Quelles compétences de votre CV répondent le mieux à cette offre ?','Quel résultat concret pouvez-vous apporter dès les premiers mois ?','Quelles questions poseriez-vous au recruteur à propos de ce poste ?'] : ['Sélectionnez une offre depuis la page Emploi pour obtenir des questions ciblées.'],
  };
  const [category,setCategory]=useState('general');
  const [cycle,setCycle]=useState(0);
  const [selected,setSelected]=useState<number|null>(null);
  const [answers,setAnswers]=useState<Record<string,string>>(()=>{try{return JSON.parse(localStorage.getItem('omnia_interview_answers')||'{}')}catch{return {}}});
  const [feedback,setFeedback]=useState<Record<string,string>>({});
  const [submitting,setSubmitting]=useState<string>('');
  const [star,setStar]=useState({Situation:false,Tâche:false,Action:false,Résultat:false});
  const steps = [
    {key:'Situation', role:'Décrivez le contexte précis : où, quand et dans quelle situation ?'},
    {key:'Tâche', role:'Expliquez votre objectif, votre responsabilité ou le problème à résoudre.'},
    {key:'Action', role:'Détaillez ce que vous avez personnellement fait, étape par étape.'},
    {key:'Résultat', role:'Terminez par un impact concret, observable ou chiffré.'},
  ] as const;
  const questions=useMemo(()=>{
    const source=banks[category]||banks.general;
    if(source.length<=3)return source;
    const offset=(cycle*3)%source.length;
    return [...source.slice(offset),...source.slice(0,offset)].slice(0,3);
  },[category,cycle,jobId]);
  useEffect(()=>{setCycle(v=>v+1)},[]);
  const saveAnswer=(q:string,v:string)=>{const n={...answers,[q]:v};setAnswers(n);localStorage.setItem('omnia_interview_answers',JSON.stringify(n))};
  async function submitForAi(q:string){
    const answer=(answers[q]||'').trim();
    if(!answer)return;
    setSubmitting(q); setFeedback(f=>({...f,[q]:''}));
    try{
      if(!SUPABASE_URL) throw new Error('IA indisponible');
      const res=await fetch(`${SUPABASE_URL}/functions/v1/career-studio-ai`,{method:'POST',headers:{Authorization:`Bearer ${localStorage.getItem('omnia_session_token')||''}`,'Content-Type':'application/json'},body:JSON.stringify({action:'make_professional',text:`Question: ${q}\nRéponse: ${answer}`,doc_type:'cv',language:'fr'})});
      const data=await res.json().catch(()=>({}));
      if(!res.ok||!data.result)throw new Error(data.error||'Service IA indisponible');
      setFeedback(f=>({...f,[q]:data.result}));
    }catch(e:any){setFeedback(f=>({...f,[q]:e?.message||'Le service IA n’est pas disponible pour le moment.'}))}
    finally{setSubmitting('')}
  }
  const checked=Object.values(star).filter(Boolean).length;
  function toggleStar(key:keyof typeof star){
    const index=steps.findIndex(s=>s.key===key);
    const previousComplete=steps.slice(0,index).every(s=>star[s.key]);
    if(!star[key]&&!previousComplete){alert(`Terminez d’abord l’étape ${steps[index-1].key}.`);return}
    if(!star[key]&&!confirm(`Avez-vous bien effectué l’étape ${key} ?\n\n${steps[index].role}`))return;
    setStar(v=>({...v,[key]:!v[key]}));
  }
  return <div className="space-y-5"><PageHeader title="Préparation entretien" subtitle="Questions renouvelées, réponses personnelles, correction IA et méthode STAR."/>
    <div className="flex flex-wrap items-center gap-2">{categories.map(([k,l])=><button key={k} onClick={()=>{setCategory(k);setSelected(null);setCycle(v=>v+1)}} className="rounded-xl px-4 py-2 text-sm font-semibold" style={{background:category===k?OMNIA_BLUE:'white',color:category===k?'white':OMNIA_BLUE,border:`1px solid ${BORDER}`}}>{l}</button>)}<button onClick={()=>{setCycle(v=>v+1);setSelected(null)}} className="ml-auto rounded-xl border bg-white px-4 py-2 text-sm font-semibold" style={{borderColor:BORDER,color:OMNIA_BLUE}}>Changer les questions</button></div>
    <div className="grid gap-5 xl:grid-cols-[1.3fr_.7fr]">
      <Card className="p-5"><SectionTitle title="Banque de questions"/><p className="mb-4 text-xs" style={{color:MUTED}}>Les questions changent lors d’un changement de catégorie, d’un rafraîchissement ou avec « Changer les questions ».</p><div className="space-y-3">{questions.map((q,i)=><div key={`${category}-${cycle}-${q}`} className="rounded-2xl border" style={{borderColor:BORDER}}><button onClick={()=>setSelected(selected===i?null:i)} className="flex w-full items-center justify-between p-4 text-left"><span className="text-sm font-semibold" style={{color:OMNIA_BLUE}}>{q}</span><ChevronDown className={selected===i?'rotate-180':''} size={16}/></button>{selected===i&&<div className="border-t p-4" style={{borderColor:BORDER}}><p className="text-sm" style={{color:MUTED}}>Répondez avec un exemple concret. Pour une situation vécue, utilisez STAR afin de structurer votre réponse.</p><textarea value={answers[q]||''} onChange={e=>saveAnswer(q,e.target.value)} className="mt-3 min-h-32 w-full rounded-xl border p-3 text-sm" style={{borderColor:BORDER}} placeholder="Rédigez votre réponse personnelle..."/><button onClick={()=>submitForAi(q)} disabled={!answers[q]?.trim()||submitting===q} className="mt-3 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40" style={{background:OMNIA_BLUE}}>{submitting===q?'Analyse en cours...':'Soumettre à l’IA'}</button>{feedback[q]&&<div className="mt-3 rounded-xl border bg-slate-50 p-4 text-sm whitespace-pre-wrap" style={{borderColor:BORDER,color:OMNIA_BLUE}}><div className="mb-2 font-semibold">Correction et conseils IA</div>{feedback[q]}</div>}</div>}</div>)}</div></Card>
      <Card className="p-5"><SectionTitle title="Checklist STAR"/><p className="mb-4 text-sm" style={{color:MUTED}}>STAR vous aide à répondre clairement aux questions comportementales. Cochez une étape seulement lorsque votre réponse contient réellement l’élément demandé.</p>{steps.map((step,index)=><div key={step.key} className={`mb-3 rounded-xl border p-3 ${star[step.key]?'bg-green-50':'bg-white'}`} style={{borderColor:star[step.key]?'#86efac':BORDER}}><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-semibold" style={{color:OMNIA_BLUE}}>{index+1}. {step.key}</div><div className="mt-1 text-xs leading-5" style={{color:MUTED}}>{step.role}</div></div><input type="checkbox" checked={star[step.key]} onChange={()=>toggleStar(step.key)} /></div>{star[step.key]&&<div className="mt-3 rounded-lg bg-white p-2 text-xs font-medium text-green-700">Étape confirmée. Vous pouvez passer à {steps[index+1]?.key||'la finalisation de votre réponse'}.</div>}</div>)}<div className="mt-4 text-sm font-semibold" style={{color:OMNIA_BLUE}}>Progression : {checked}/4</div>{checked===4&&<div className="mt-3 rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-700">Votre réponse contient les quatre éléments STAR.</div>}</Card>
    </div>
  </div>;
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
  const [error, setError] = useState('');
  const [targetJob, setTargetJob] = useState<any | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState({ company_name: '', job_title: '', job_url: '', location: '', contract_type: 'CDI' });
  const localKey='omnia_manual_applications';
  const readLocal=()=>{try{return JSON.parse(localStorage.getItem(localKey)||'[]') as TrackedApplication[]}catch{return []}};
  function normalizeApp(a:any, source:'platform'|'manual'):TrackedApplication{
    const rawOffer=Array.isArray(a?.job_offers)?a.job_offers[0]:a?.job_offers;
    return {...a,id:String(a?.id||`${source}-${Date.now()}-${Math.random()}`),source,tracking_status:a?.tracking_status||a?.status||'draft',job_offers:rawOffer||{id:a?.job_id,title:a?.job_title,recruiter_company:a?.company_name,location:a?.location,contract_type:a?.contract_type,application_mode:a?.application_mode,external_apply_url:a?.job_url}};
  }
  async function callTrack(body: unknown) {
    if (!SUPABASE_URL) throw new Error('Le service de suivi n’est pas configuré.');
    const res = await fetch(`${SUPABASE_URL}/functions/v1/career-application-track`, { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('omnia_session_token') || ''}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data=await res.json().catch(()=>({}));
    if (!res.ok) throw new Error(data?.error || 'Impossible de charger les candidatures.');
    return data;
  }
  async function loadApplications() {
    setLoading(true); setError('');
    try {
      const d = await callTrack({ action: 'list' });
      const platform = Array.isArray(d.platform_applications)?d.platform_applications.map((a:any)=>normalizeApp(a,'platform')):[];
      const manualRemote = Array.isArray(d.manual_applications)?d.manual_applications.map((a:any)=>normalizeApp(a,'manual')):[];
      setApps([...platform,...manualRemote]);
    } catch(e:any) {
      const local=readLocal().map(a=>normalizeApp(a,'manual'));
      setApps(local); setError(e?.message||'Le suivi distant est indisponible. Vos candidatures manuelles locales restent accessibles.');
    } finally { setLoading(false); }
  }
  useEffect(() => { loadApplications(); }, []);
  useEffect(() => { if (!jobId) return; callTrack({ action: 'get', job_id: jobId }).then((d) => setTargetJob(d.job || null)).catch(() => setTargetJob(null)); }, [jobId]);
  async function prepareJob() { if (!jobId) return; try{const d = await callTrack({ action: 'prepare_job', job_id: jobId }); if (d.success) loadApplications();}catch(e:any){setError(e?.message||'Préparation impossible.')}}
  async function addManual() {
    if (!manual.company_name.trim() || !manual.job_title.trim()) return;
    try { const d = await callTrack({ action: 'create_manual', ...manual, application_mode: 'external_link', status: 'draft' }); if (d.success) { setShowManual(false); setManual({ company_name: '', job_title: '', job_url: '', location: '', contract_type: 'CDI' }); loadApplications(); return; } } catch {}
    const item=normalizeApp({...manual,id:`local-${Date.now()}`,tracking_status:'draft',application_mode:'external_link'},'manual');
    const next=[item,...readLocal()]; localStorage.setItem(localKey,JSON.stringify(next)); setApps(next); setShowManual(false); setManual({ company_name: '', job_title: '', job_url: '', location: '', contract_type: 'CDI' }); setError('Candidature enregistrée localement. La synchronisation reprendra lorsque le service sera disponible.');
  }
  const columns = [
    { title: 'Brouillon', statuses: ['draft','prepared'], countTone: 'gray' },
    { title: 'À envoyer', statuses: ['to_apply','redirected','email_prepared'], countTone: 'gold' },
    { title: 'Envoyées', statuses: ['declared_sent','submitted','received','waiting_response','viewed','under_review','shortlisted'], countTone: 'blue' },
    { title: 'Entretien', statuses: ['interview'], countTone: 'purple' },
    { title: 'Finalisées', statuses: ['offer','accepted','rejected','withdrawn','archived'], countTone: 'green' },
  ];
  return <div className="space-y-5"><PageHeader title="Suivi candidatures" subtitle="Suivez vos candidatures réelles, depuis une offre Omnia ou ajoutées manuellement." actionLabel="Ajouter une candidature" onAction={() => setShowManual(true)} />
    {error&&<div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{error}<button onClick={loadApplications} className="ml-3 font-semibold underline">Réessayer</button></div>}
    {targetJob&&<Card className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold" style={{color:OMNIA_BLUE}}>{targetJob.title}</h2><p className="text-sm" style={{color:MUTED}}>{targetJob.recruiter_company||'Entreprise'}</p></div><div className="flex gap-2"><button onClick={prepareJob} className="rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{background:OMNIA_BLUE}}>Ajouter au suivi</button><button onClick={()=>navigate(`/dashboard/career-studio?section=interview&job_id=${jobId}`)} className="rounded-xl border px-4 py-2 text-sm font-semibold" style={{borderColor:BORDER,color:OMNIA_BLUE}}>Préparer entretien</button></div></div></Card>}
    {loading?<Card className="p-8 text-center"><span className="text-sm" style={{color:MUTED}}>Chargement des candidatures…</span></Card>:apps.length===0?<EmptyState text="Aucune candidature suivie pour le moment." action="Ajouter une candidature" onAction={()=>setShowManual(true)}/>:<div className="grid grid-cols-1 gap-4 xl:grid-cols-5">{columns.map(col=>{const items=apps.filter(app=>col.statuses.includes(app.tracking_status||app.status||'draft'));return <Card key={col.title} className="p-4"><div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-semibold" style={{color:OMNIA_BLUE}}>{col.title}</h2><SmallBadge tone={col.countTone as any}>{items.length}</SmallBadge></div><div className="space-y-3">{items.map(app=>{const offer=app.job_offers||{};const status=app.tracking_status||app.status||'draft';const mode=normalizeApplicationMode(app.application_mode||offer.application_mode);return <div key={app.id} className="rounded-xl border p-3" style={{borderColor:BORDER}}><div className="text-sm font-semibold" style={{color:OMNIA_BLUE}}>{offer.title||app.job_title||'Poste sans titre'}</div><div className="mt-1 text-xs" style={{color:MUTED}}>{offer.recruiter_company||app.company_name||'Entreprise non renseignée'}</div><div className="mt-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold" style={{color:OMNIA_BLUE}}>{labelApplicationStatus(status)}</span></div><button onClick={()=>mode==='omnia_managed'&&offer.id?navigate(`/emploi/${offer.id}`):undefined} className="mt-3 text-xs font-semibold" style={{color:OMNIA_BLUE}}>{mode==='omnia_managed'?'Voir l’offre':'Mettre à jour'} →</button></div>})}</div></Card>})}</div>}
    {showManual&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-5"><h2 className="text-lg font-semibold" style={{color:OMNIA_BLUE}}>Ajouter une candidature</h2><div className="mt-4 grid gap-3"><input value={manual.company_name} onChange={e=>setManual({...manual,company_name:e.target.value})} placeholder="Entreprise *" className="h-11 rounded-xl border px-3"/><input value={manual.job_title} onChange={e=>setManual({...manual,job_title:e.target.value})} placeholder="Poste *" className="h-11 rounded-xl border px-3"/><input value={manual.job_url} onChange={e=>setManual({...manual,job_url:e.target.value})} placeholder="Lien de l’offre" className="h-11 rounded-xl border px-3"/><input value={manual.location} onChange={e=>setManual({...manual,location:e.target.value})} placeholder="Lieu" className="h-11 rounded-xl border px-3"/></div><div className="mt-5 flex justify-end gap-2"><button onClick={()=>setShowManual(false)} className="rounded-xl border px-4 py-2">Annuler</button><button onClick={addManual} className="rounded-xl px-4 py-2 font-semibold text-white" style={{background:OMNIA_BLUE}}>Enregistrer</button></div></div></div>}
  </div>;
}

function ProfileView({ displayName }: { displayName: string }) {
  const navigate=useNavigate(); const user=readUser() as any; const photo=user?.avatar_url||user?.photo_url||'';
  return <div className="space-y-5"><PageHeader title="Profil carrière" subtitle="Ce profil utilise les mêmes informations que votre compte principal."/><Card className="p-6"><div className="flex flex-wrap items-center gap-5">{photo?<img src={photo} alt="Photo de profil" className="h-24 w-24 rounded-full object-cover"/>:<div className="flex h-24 w-24 items-center justify-center rounded-full text-xl font-bold text-white" style={{background:OMNIA_BLUE}}>{getInitials(displayName)}</div>}<div className="flex-1"><h2 className="text-lg font-semibold" style={{color:OMNIA_BLUE}}>{displayName}</h2><p className="mt-1 text-sm" style={{color:MUTED}}>{user?.professional_title||user?.job_title||'Titre professionnel non renseigné'}</p><p className="mt-1 text-sm" style={{color:MUTED}}>{user?.email||''}</p></div><button onClick={()=>navigate('/dashboard/profil')} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{background:OMNIA_BLUE}}>Modifier le profil principal</button></div></Card><Card className="p-5"><SectionTitle title="Synchronisation du profil"/><p className="text-sm" style={{color:MUTED}}>Les changements effectués dans le profil principal sont utilisés dans Omnia Career. Une seule source de données évite les informations différentes entre l’inscription et Career Studio.</p></Card></div>;
}

function CoachingView() {
  const [goal,setGoal]=useState(''); const [request,setRequest]=useState(''); const [saved,setSaved]=useState(false);
  const submit=()=>{if(!request.trim())return; localStorage.setItem('omnia_human_coaching_request',JSON.stringify({message:request,status:'requested',created_at:new Date().toISOString()}));setSaved(true)};
  return <div className="space-y-5"><PageHeader title="Coaching carrière" subtitle="Coaching IA lorsque le service est disponible, ou accompagnement humain sur demande."/><div className="grid gap-5 xl:grid-cols-2"><Card className="p-6"><SectionTitle title="Coaching IA"/><textarea value={goal} onChange={e=>setGoal(e.target.value)} className="min-h-40 w-full rounded-xl border p-3 text-sm" style={{borderColor:BORDER}} placeholder="Décrivez votre objectif professionnel..."/><button disabled className="mt-3 rounded-xl px-4 py-2.5 text-sm font-semibold text-white opacity-50" style={{background:OMNIA_BLUE}}>Service IA à configurer</button><p className="mt-3 text-xs" style={{color:MUTED}}>Aucune réponse IA fictive n’est affichée.</p></Card><Card className="p-6"><div className="flex items-center justify-between"><SectionTitle title="Coaching humain sur demande"/><SmallBadge tone="gold">Premium</SmallBadge></div><textarea value={request} onChange={e=>setRequest(e.target.value)} className="min-h-40 w-full rounded-xl border p-3 text-sm" style={{borderColor:BORDER}} placeholder="Expliquez le type d’accompagnement souhaité..."/><button onClick={submit} disabled={!request.trim()} className="mt-3 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40" style={{background:OMNIA_GOLD}}>Envoyer ma demande</button>{saved&&<p className="mt-3 text-sm text-green-700">Demande enregistrée. La plateforme pourra vous recontacter.</p>}</Card></div></div>;
}

function SettingsView({ packs, tokens, user }: { packs: TokenPack[]; tokens: number; user: any }) {
  const [prefs,setPrefs]=useState(()=>{try{return JSON.parse(localStorage.getItem('omnia_career_preferences')||'{"notifications":false,"profileVisible":false,"aiConsent":false,"language":"fr"}')}catch{return {notifications:false,profileVisible:false,aiConsent:false,language:'fr'}}});
  const save=(next:any)=>{setPrefs(next);localStorage.setItem('omnia_career_preferences',JSON.stringify(next))};
  return <div className="space-y-5"><PageHeader title="Paramètres Omnia Career" subtitle="Réglages réels propres à votre espace carrière."/><div className="grid gap-5 xl:grid-cols-3"><Card className="p-5"><SectionTitle title="Préférences"/><label className="mb-4 block text-sm">Langue<select value={prefs.language} onChange={e=>{const language=e.target.value;save({...prefs,language});document.documentElement.lang=language;window.dispatchEvent(new CustomEvent('omnia-career-language-change',{detail:language}));window.location.reload()}} className="mt-1 h-11 w-full rounded-xl border px-3" style={{borderColor:BORDER}}><option value="fr">Français</option><option value="en">English</option><option value="es">Español</option><option value="de">Deutsch</option></select></label>{[['notifications','Notifications Career'],['profileVisible','Profil visible aux recruteurs'],['aiConsent','Autoriser l’utilisation IA de mes documents']].map(([k,l])=><label key={k} className="mb-3 flex items-center justify-between rounded-xl border p-3 text-sm" style={{borderColor:BORDER}}><span>{l}</span><input type="checkbox" checked={Boolean(prefs[k])} onChange={e=>save({...prefs,[k]:e.target.checked})}/></label>)}</Card><Card className="p-5"><SectionTitle title="Jetons Omnia Career"/><div className="text-3xl font-semibold" style={{color:OMNIA_BLUE}}>{tokens}</div><p className="mt-1 text-sm" style={{color:MUTED}}>Solde unique utilisé uniquement dans Omnia Career.</p>{packs.slice(0,3).map(p=><div key={p.pack_key} className="mt-3 rounded-xl border p-3 text-sm" style={{borderColor:BORDER}}><b>{p.name_fr}</b><div>{p.tokens+(p.bonus_tokens||0)} jetons</div></div>)}</Card><Card className="p-5"><SectionTitle title="Données et sécurité"/><button className="mb-3 w-full rounded-xl border px-4 py-2.5 text-left text-sm" style={{borderColor:BORDER}}>Exporter mes documents</button><button className="mb-3 w-full rounded-xl border px-4 py-2.5 text-left text-sm text-red-600" style={{borderColor:BORDER}}>Supprimer un document</button><p className="text-xs" style={{color:MUTED}}>Les modifications de compte et mot de passe se font depuis le profil principal.</p></Card></div></div>;
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
  return <Card className="p-5"><div className="mb-4 flex items-center justify-between"><h2 className="text-base font-semibold" style={{ color: OMNIA_BLUE }}>{title}</h2><button onClick={onCreate} className="rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: OMNIA_GOLD }}>{createLabel}</button></div>{documents.length === 0 ? <div className="rounded-2xl border border-dashed p-8 text-center" style={{ borderColor: BORDER }}><FileText className="mx-auto mb-3" color={MUTED} /><p className="text-sm" style={{ color: MUTED }}>{empty}</p></div> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{documents.map(doc => <div key={doc.id} className="rounded-2xl border p-4" style={{ borderColor: BORDER }}><div className="text-sm font-semibold" style={{ color: OMNIA_BLUE }}>{doc.title}</div><div className="mt-1 flex items-center gap-2 text-xs" style={{ color: MUTED }}><span>{normalizedStatus(doc.status)==='completed'?'Terminé':'Brouillon'}</span><span>·</span><span>{formatDate(doc.updated_at)}</span></div><div className="mt-4 flex gap-2"><button onClick={() => onOpen(doc.id)} className="rounded-xl px-3 py-2 text-xs font-semibold text-white" style={{ background: OMNIA_BLUE }}>Ouvrir</button><button onClick={() => onDelete(doc.id)} className="rounded-xl border px-3 py-2 text-xs font-semibold text-red-600" style={{ borderColor: BORDER }}><Trash2 size={13} /></button></div></div>)}</div>}</Card>;
}

function Badge({ label }: { label: string }) {
  return <div className="flex h-20 w-20 items-center justify-center rounded-2xl border text-center text-xs font-bold text-white" style={{ background: OMNIA_BLUE, borderColor: OMNIA_GOLD }}>{label}</div>;
}

function Field({ label, value }: { label: string; value: string }) {
  return <label className="mb-3 block text-sm font-medium" style={{ color: OMNIA_BLUE }}>{label}<input className="mt-1 h-10 w-full rounded-xl border px-3 text-sm" style={{ borderColor: BORDER }} value={value} readOnly /></label>;
}
