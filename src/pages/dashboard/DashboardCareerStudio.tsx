import { getSessionToken } from '../../lib/session';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
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
  Download,
  Edit2,
  Eye,
  ExternalLink,
  FileText,
  Mail,
  MessageSquare,
  Plus,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Trash2,
  UserRound,
  RefreshCw,
} from 'lucide-react';
import { APPLICATION_MODE_SHORT_LABELS, JobApplicationMode, labelApplicationStatus, normalizeApplicationMode, STATUS_TONE } from '../../lib/jobApplicationModes';
import { cacheCareerTemplates, getCareerTemplates, mergeCareerTemplateCatalog, normalizeTemplateKey } from '../../lib/careerStudioData';
import { consumeCareerTokenAction, deleteCareerDocument, fetchCareerTemplateCatalog, getCareerJobContext, listCareerApplications, renameCareerDocument, type CareerJobContext, type CareerTrackedApplication } from '../../lib/careerStudioApi';
import { ENDPOINTS } from '../../lib/config';
import { edgeAuthHeaders } from '../../lib/edgeAuth';
import { dashboardGreeting } from '../../lib/dashboardGreeting';
import { isLearnerPreviewMode, withLearnerPreview } from '../../lib/learnerPreview';
import TemplateLiveCard from '../../components/career/TemplateLiveCard';
import type { CareerTemplateMeta } from '../../lib/careerStudioData';
import { EnhancedDashboard, EnhancedApplications, EnhancedProfile, EnhancedSettings } from '../../components/career/CareerEnhancedViews';
import type { SubspaceSearchResult } from '../../components/SubspaceHamburgerLayout';
import CareerLearnerLayout from '../../components/career/CareerRoleLayout';

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

interface CurrentUser {
  full_name?: string;
  name?: string;
  email?: string;
  roles?: string[];
}

const navItems: { id: ActiveView; label: string; icon: typeof FileText }[] = [
  { id: 'dashboard', label: 'Accueil Career', icon: BarChart3 },
  { id: 'cv', label: 'CV Builder', icon: FileText },
  { id: 'lm', label: 'Lettres de motivation', icon: Mail },
  { id: 'interview', label: 'Préparation entretien', icon: MessageSquare },
  { id: 'applications', label: 'Suivi candidatures', icon: Briefcase },
  { id: 'profile', label: 'Profil carrière', icon: UserRound },
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
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const incomingSearch = searchParams.get('search');
  const requestedSection = searchParams.get('section') || 'dashboard';
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [documents, setDocuments] = useState<CareerDocument[]>([]);
  const [cvTemplates, setCvTemplates] = useState<Template[]>(fallbackCvTemplates);
  const [lmTemplates, setLmTemplates] = useState<Template[]>(fallbackLmTemplates);
  const [tokens, setTokens] = useState(0);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [renameTarget, setRenameTarget] = useState<CareerDocument | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameBusy, setRenameBusy] = useState(false);
  const previewMode = isLearnerPreviewMode();

  const user = readUser();
  const displayName = previewMode ? 'Aperçu apprenant' : (user?.full_name || user?.name || user?.email || 'Apprenant');
  const initials = getInitials(displayName, user?.email);

  const cvDocs = useMemo(() => documents.filter((doc) => doc.doc_type === 'cv'), [documents]);
  const lmDocs = useMemo(() => documents.filter((doc) => doc.doc_type === 'lm'), [documents]);
  const latestCv = cvDocs[0];
  const latestLm = lmDocs[0];

  const searchResults = useMemo<SubspaceSearchResult[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const pages = navItems
      .filter(item => item.label.toLowerCase().includes(q))
      .map(item => ({ id: `page-${item.id}`, label: item.label, description: 'Page Omnia Career', onSelect: () => goToView(item.id) }));
    const docs = documents
      .filter(doc => `${doc.title} ${doc.doc_type}`.toLowerCase().includes(q))
      .map(doc => ({ id: `doc-${doc.id}`, label: doc.title, description: doc.doc_type === 'cv' ? 'CV' : 'Lettre de motivation', onSelect: () => openDoc(doc.id, doc.doc_type) }));
    const models = [...cvTemplates, ...lmTemplates]
      .filter(t => `${t.name_fr} ${t.description_fr || ''}`.toLowerCase().includes(q))
      .map(t => ({ id: `model-${t.template_key}`, label: t.name_fr, description: t.template_key.startsWith('lm_') ? 'Modèle LM' : 'Modèle CV', onSelect: () => createDoc(t.template_key.startsWith('lm_') ? 'lm' : 'cv', t.template_key) }));
    return [...pages, ...docs, ...models].slice(0, 12);
  }, [searchQuery, documents, cvTemplates, lmTemplates]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(''), 3500);
  }

  async function loadByType(docType: DocType) {
    if (!SUPABASE_URL) return { documents: [], templates: [], user: null };
    const response = await fetch(`${SUPABASE_URL}/functions/v1/career-studio-manage?action=list`, {
      method: 'POST',
      headers: edgeAuthHeaders(),
      body: JSON.stringify({ doc_type: docType }),
    });
    return response.json();
  }


  async function loadData() {
    setLoading(true);
    try {
      if (previewMode) {
        const [publicCvTemplates, publicLmTemplates] = await Promise.all([
          fetchCareerTemplateCatalog('cv'),
          fetchCareerTemplateCatalog('lm'),
        ]);
        setDocuments([]);
        setCvTemplates(publicCvTemplates as Template[]);
        setLmTemplates(publicLmTemplates as Template[]);
        cacheCareerTemplates([...(publicCvTemplates as any), ...(publicLmTemplates as any)]);
        setTokens(0);
        return;
      }

      const [cvData, lmData, publicCvTemplates, publicLmTemplates] = await Promise.allSettled([
        loadByType('cv'),
        loadByType('lm'),
        fetchCareerTemplateCatalog('cv'),
        fetchCareerTemplateCatalog('lm'),
      ]);
      const cvPayload = cvData.status === 'fulfilled' ? cvData.value : null;
      const lmPayload = lmData.status === 'fulfilled' ? lmData.value : null;
      const publicCv = publicCvTemplates.status === 'fulfilled' ? publicCvTemplates.value : fallbackCvTemplates;
      const publicLm = publicLmTemplates.status === 'fulfilled' ? publicLmTemplates.value : fallbackLmTemplates;

      const loadedDocs = [
        ...((cvPayload?.documents || []) as CareerDocument[]),
        ...((lmPayload?.documents || []) as CareerDocument[]),
      ].sort((a, b) => new Date(b.updated_at || b.created_at || '').getTime() - new Date(a.updated_at || a.created_at || '').getTime());

      setDocuments(loadedDocs);
      const rawCvTemplates = ((((cvPayload?.templates || []) as Template[]).length ? cvPayload.templates : publicCv) || []) as Template[];
      const rawLmTemplates = ((((lmPayload?.templates || []) as Template[]).length ? lmPayload.templates : publicLm) || []) as Template[];
      // The user-facing catalog exposes only the canonical 12 CV / 6 LM templates.
      // Legacy aliases remain supported when old documents are opened, but never create duplicate cards.
      const loadedCvTemplates = mergeCareerTemplateCatalog('cv', rawCvTemplates, { authoritative: true })
        .filter(template => /^cv_(horizon|sahara|atlas|kora|nile|executive|baobab|digital|academia|hospitality|qhse|impact)$/.test(template.template_key)) as Template[];
      const loadedLmTemplates = mergeCareerTemplateCatalog('lm', rawLmTemplates, { authoritative: true })
        .filter(template => /^lm_(horizon|sahara|atlas|kora|digital|executive)$/.test(template.template_key)) as Template[];
      setCvTemplates(loadedCvTemplates);
      setLmTemplates(loadedLmTemplates);
      cacheCareerTemplates([...(loadedCvTemplates as any), ...(loadedLmTemplates as any)]);
      setTokens(cvPayload?.user?.cv_tokens ?? lmPayload?.user?.cv_tokens ?? 0);
    } catch {
      showToast('Impossible de charger les données Omnia Career pour le moment.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewMode]);

  useEffect(() => {
    if (incomingSearch !== null) setSearchQuery(incomingSearch);
  }, [incomingSearch]);

  useEffect(() => {
    if (location.pathname === '/omnia-career/profil' || requestedSection === 'profile' || requestedSection === 'profil') {
      if (previewMode) {
        setActiveView('dashboard');
        return;
      }
      navigate('/mon-profil?tab=professionnel', { replace: true });
      return;
    }
    const pathMap: Record<string, ActiveView> = {
      '/omnia-career': 'dashboard',
      '/omnia-career/cv-builder': 'cv',
      '/omnia-career/lettres': 'lm',
      '/omnia-career/entretien': 'interview',
      '/omnia-career/candidatures': 'applications',
      '/omnia-career/parametres': 'settings',
    };
    const sectionMap: Record<string, ActiveView> = { dashboard:'dashboard', cv:'cv', builder:'cv', letters:'lm', lettre:'lm', lm:'lm', interview:'interview', entretien:'interview', applications:'applications', candidatures:'applications', settings:'settings', parametres:'settings' };
    setActiveView(pathMap[location.pathname] || sectionMap[requestedSection] || 'dashboard');
  }, [location.pathname, navigate, requestedSection]);

  function routeForView(view: ActiveView) {
    if (previewMode) {
      const params = new URLSearchParams({ preview: 'true', section: view });
      const currentJob = searchParams.get('job_id');
      if (currentJob && (view === 'interview' || view === 'applications')) params.set('job_id', currentJob);
      return `/dashboard/career-studio?${params.toString()}`;
    }
    const routes: Record<ActiveView, string> = {
      dashboard: '/omnia-career', cv: '/omnia-career/cv-builder', lm: '/omnia-career/lettres', interview: '/omnia-career/entretien',
      applications: '/omnia-career/candidatures', profile: '/mon-profil?tab=professionnel', settings: '/omnia-career/parametres',
    };
    const currentJob = searchParams.get('job_id');
    const query = currentJob && (view === 'interview' || view === 'applications') ? `?job_id=${encodeURIComponent(currentJob)}` : '';
    return `${routes[view]}${query}`;
  }

  function goToView(view: ActiveView) {
    if (previewMode && view === 'profile') {
      showToast('Le profil personnel n’est pas modifié pendant la prévisualisation apprenant.');
      return;
    }
    navigate(routeForView(view));
  }

  async function createDoc(docType: DocType, templateKey?: string) {
    // Creation never silently chooses the first template: the learner must choose it.
    if (!templateKey) {
      goToView(docType === 'cv' ? 'cv' : 'lm');
      showToast(docType === 'cv' ? 'Choisissez un modèle CV pour commencer.' : 'Choisissez un modèle de lettre pour commencer.');
      return;
    }
    const templates = docType === 'cv' ? cvTemplates : lmTemplates;
    const chosen = normalizeTemplateKey(docType, templateKey);
    const selected = templates.find(template => template.template_key === chosen);

    if (!previewMode && selected && selected.is_free === false) {
      try {
        const charge = await consumeCareerTokenAction(
          'spend_premium_template',
          `new:${docType}:${chosen}`,
          { template_key: chosen, doc_type: docType, source: 'career_dashboard' },
        );
        if (typeof charge.tokens_remaining === 'number') setTokens(charge.tokens_remaining);
        if (Number(charge.amount || 0) > 0) showToast(`${charge.amount} jeton(s) consommé(s) pour le modèle Premium.`);
      } catch (error) {
        showToast((error as Error).message || 'Impossible d’activer ce modèle Premium.');
        return;
      }
    }

    navigate(withLearnerPreview(`/dashboard/career-studio/editor/new?type=${docType}&template=${encodeURIComponent(chosen)}`));
  }

  function openDoc(documentId?: string, fallbackType: DocType = 'cv') {
    if (documentId) navigate(withLearnerPreview(`/dashboard/career-studio/editor/${documentId}`));
    else createDoc(fallbackType);
  }

  async function deleteDoc(docId: string) {
    if (previewMode) { showToast('La prévisualisation administrative Omnia est en lecture seule.'); return; }
    const target = documents.find(item => item.id === docId);
    if (!target) { showToast('Document introuvable.'); return; }
    if (!confirm(`Supprimer définitivement « ${target.title} » ?`)) return;
    try {
      await deleteCareerDocument(target.doc_type, target.id);
      setDocuments((prev) => prev.filter((item) => item.id !== target.id));
      showToast('Document supprimé définitivement.');
    } catch (error) {
      showToast((error as Error).message || 'La suppression n’a pas été confirmée par le serveur.');
    }
  }

  function startRename(document: CareerDocument) {
    if (previewMode) { showToast('La prévisualisation administrative Omnia est en lecture seule.'); return; }
    setRenameTarget(document);
    setRenameValue(document.title || '');
  }

  async function confirmRename() {
    if (!renameTarget || !renameValue.trim() || renameBusy) return;
    setRenameBusy(true);
    try {
      const result = await renameCareerDocument(renameTarget.doc_type, renameTarget.id, renameValue);
      setDocuments(current => current.map(item => item.id === renameTarget.id
        ? { ...item, title: result.title, updated_at: new Date().toISOString() }
        : item));
      setRenameTarget(null);
      setRenameValue('');
      showToast('Document renommé.');
    } catch (error) {
      showToast((error as Error).message || 'Le renommage n’a pas été confirmé par le serveur.');
    } finally {
      setRenameBusy(false);
    }
  }

  const quickActions = [
    { label: 'Créer un CV', icon: FileText, action: () => createDoc('cv') },
    { label: 'Nouvelle lettre', icon: Mail, action: () => createDoc('lm') },
    { label: 'Préparer entretien', icon: MessageSquare, action: () => goToView('interview') },
    { label: 'Évaluer mon profil', icon: Star, action: () => goToView('profile') },
  ];

  return (
    <CareerLearnerLayout>
      <div className="min-h-full bg-[#F7F5F0]" style={{ color: '#111827' }}>
        {toast && <div className="fixed right-5 top-20 z-50 rounded-xl border bg-white px-4 py-3 text-sm font-medium shadow-lg" style={{ color: OMNIA_BLUE, borderColor: BORDER }}>{toast}</div>}
        <main className="px-5 py-7 md:px-8">
          {activeView === 'dashboard' && <EnhancedDashboard displayName={displayName} loading={loading} cvDocs={cvDocs} lmDocs={lmDocs} cvTemplates={cvTemplates as any} lmTemplates={lmTemplates as any} onView={(view) => goToView(view as ActiveView)} onCreate={createDoc} onOpen={openDoc} previewMode={previewMode} />}
          {activeView === 'cv' && <CvBuilderView documents={cvDocs} templates={cvTemplates} createDoc={createDoc} openDoc={openDoc} deleteDoc={deleteDoc} renameDoc={startRename} />}
          {activeView === 'lm' && <LettersView documents={lmDocs} templates={lmTemplates} createDoc={createDoc} openDoc={openDoc} deleteDoc={deleteDoc} renameDoc={startRename} />}
          {activeView === 'interview' && <InterviewView jobId={searchParams.get('job_id') || undefined} />}
          {activeView === 'applications' && <EnhancedApplications navigate={navigate} />}
          {activeView === 'profile' && <EnhancedProfile displayName={displayName} />}
          {activeView === 'settings' && <EnhancedSettings tokens={tokens} user={user} />}
        </main>
        {renameTarget && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
              <h2 className="text-xl font-semibold" style={{ color: OMNIA_BLUE }}>Renommer le document</h2>
              <p className="mt-2 text-sm leading-6" style={{ color: MUTED }}>Le contenu du CV ou de la lettre ne sera pas modifié.</p>
              <input
                autoFocus
                value={renameValue}
                onChange={event => setRenameValue(event.target.value)}
                onKeyDown={event => { if (event.key === 'Enter' && renameValue.trim()) void confirmRename(); }}
                className="mt-5 h-12 w-full rounded-2xl border px-4 text-sm outline-none focus:ring-4"
                style={{ borderColor: BORDER }}
                placeholder="Nom du document"
              />
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" disabled={renameBusy} onClick={() => { setRenameTarget(null); setRenameValue(''); }} className="rounded-xl border px-4 py-2.5 text-sm font-semibold" style={{ borderColor: BORDER }}>Annuler</button>
                <button type="button" disabled={renameBusy || !renameValue.trim()} onClick={() => void confirmRename()} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40" style={{ background: OMNIA_BLUE }}>{renameBusy ? 'Renommage…' : 'Renommer'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </CareerLearnerLayout>
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
        <div><h1 className="text-2xl font-semibold" style={{ color: OMNIA_BLUE }}>{dashboardGreeting()}</h1></div>
        <div className="rounded-2xl border bg-white px-4 py-3 shadow-sm" style={{ borderColor: BORDER }}><div className="text-xs" style={{ color: MUTED }}>Jetons disponibles</div><div className="text-2xl font-bold" style={{ color: OMNIA_GOLD }}>{loading ? '…' : tokens}</div></div>
      </div>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.map(stat => { const Icon=stat.icon; return <button key={stat.label} onClick={() => setActiveView(stat.view)} className="rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" style={{ borderColor: BORDER }}><div className="flex items-center justify-between"><div><div className="text-sm" style={{ color: MUTED }}>{stat.label}</div><div className="mt-1 text-3xl font-semibold" style={{ color: OMNIA_BLUE }}>{loading ? '…' : stat.value}</div></div><div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background:'rgba(0,32,80,.08)' }}><Icon size={20} color={OMNIA_BLUE}/></div></div></button> })}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.1fr_1fr]">
        <Card className="p-5"><SectionTitle title="Actions principales"/><div className="grid grid-cols-2 gap-3">{quickActions.map(action => { const Icon=action.icon; return <button key={action.label} onClick={action.action} className="rounded-2xl border p-4 text-left hover:bg-slate-50" style={{ borderColor:BORDER }}><div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background:'rgba(0,32,80,.08)' }}><Icon size={18} color={OMNIA_BLUE}/></div><div className="mt-3 text-sm font-semibold" style={{ color:OMNIA_BLUE }}>{action.label}</div></button>})}</div></Card>
        <Card className="p-5"><SectionTitle title="Activité récente"/>{recent.length ? <div className="space-y-3">{recent.map(doc => <button key={doc.id} onClick={() => openDoc(doc.id,doc.doc_type)} className="flex w-full items-center gap-3 rounded-xl border p-3 text-left hover:bg-slate-50" style={{ borderColor:BORDER }}><div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background:'rgba(0,32,80,.08)' }}>{doc.doc_type==='cv'?<FileText size={16} color={OMNIA_BLUE}/>:<Mail size={16} color={OMNIA_BLUE}/>}</div><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold" style={{ color:OMNIA_BLUE }}>{doc.title}</div><div className="text-xs" style={{ color:MUTED }}>{doc.status==='completed'?'Terminé':'Brouillon'} · {formatDate(doc.updated_at)}</div></div><ChevronRight size={15} color={MUTED}/></button>)}</div> : <EmptyState text="Aucune activité enregistrée."/>}</Card>
      </div>
      <Card className="p-5"><div className="mb-4 flex items-center justify-between"><SectionTitle title="Modèles CV officiels"/><button onClick={() => setActiveView('cv')} className="text-sm font-semibold" style={{ color:OMNIA_BLUE }}>Voir les 12 modèles</button></div><div className="grid grid-cols-2 gap-4 md:grid-cols-4">{(templates.length?templates:fallbackCvTemplates).slice(0,4).map(t => <TemplateLiveCard key={t.template_key} template={t as CareerTemplateMeta} docType="cv" onClick={() => createDoc('cv',t.template_key)} compact />)}</div></Card>
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

function templateMockupPath(template: Template) {
  return template.thumbnail_url || (template.is_custom ? '/career-templates/generated/custom.svg' : `/career-templates/generated/${template.template_key}.svg`);
}

function TemplateMini({ template, selected = false }: { template: Template; selected?: boolean }) {
  return <TemplateLiveCard template={template as CareerTemplateMeta} docType={(template.template_key || '').startsWith('lm_') ? 'lm' : 'cv'} selected={selected} compact />;
}

function ActivityItem({ icon: Icon, title, date }: { icon: typeof FileText; title: string; date: string }) {
  return <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'rgba(0,32,80,0.08)' }}><Icon size={16} color={OMNIA_BLUE} /></div><div className="flex-1"><div className="font-medium" style={{ color: OMNIA_BLUE }}>{title}</div><div className="text-xs" style={{ color: MUTED }}>{date}</div></div></div>;
}

function CvBuilderView({ documents, templates, createDoc, openDoc, deleteDoc, renameDoc }: { documents: CareerDocument[]; templates: Template[]; createDoc: (type: DocType, templateKey?: string) => void; openDoc: (id?: string, type?: DocType) => void; deleteDoc: (id: string) => void; renameDoc: (document: CareerDocument) => void }) {
  const list = templates.length ? templates : fallbackCvTemplates;
  return (
    <div className="space-y-5">
      <PageHeader title="CV Builder" subtitle="Choisissez un vrai modèle puis remplissez-le dans l’éditeur." actionLabel="Nouveau CV" onAction={() => createDoc('cv')} />
      <Card className="p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-base font-semibold" style={{ color:OMNIA_BLUE }}>Modèles CV officiels</h2><p className="mt-1 text-sm" style={{ color:MUTED }}>La maquette choisie sera utilisée dans le Builder, l’aperçu et le PDF.</p></div><SmallBadge tone="gold">{list.length} modèles</SmallBadge></div><div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">{list.map(t => <TemplateLiveCard key={t.template_key} template={t as CareerTemplateMeta} docType="cv" onClick={() => createDoc('cv',t.template_key)} />)}</div></Card>
      <DocumentsList title="Mes CV" documents={documents} empty="Aucun CV enregistré pour le moment." createLabel="Créer un CV" onCreate={() => createDoc('cv')} onOpen={(id) => openDoc(id, 'cv')} onDelete={deleteDoc} onRename={renameDoc} />
    </div>
  );
}

function LettersView({ documents, templates, createDoc, openDoc, deleteDoc, renameDoc }: { documents: CareerDocument[]; templates: Template[]; createDoc: (type: DocType, templateKey?: string) => void; openDoc: (id?: string, type?: DocType) => void; deleteDoc: (id: string) => void; renameDoc: (document: CareerDocument) => void }) {
  const list = templates.length ? templates : fallbackLmTemplates;
  return (
    <div className="space-y-5">
      <PageHeader title="Lettres de motivation" subtitle="Choisissez un modèle assorti à votre CV ou un modèle spécialisé." actionLabel="Nouvelle lettre" onAction={() => createDoc('lm')} />
      <Card className="p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-base font-semibold" style={{ color:OMNIA_BLUE }}>Modèles LM officiels</h2><p className="mt-1 text-sm" style={{ color:MUTED }}>Les 6 modèles officiels sont visibles et sélectionnables.</p></div><SmallBadge tone="gold">{list.length} modèles</SmallBadge></div><div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">{list.map(t => <TemplateLiveCard key={t.template_key} template={t as CareerTemplateMeta} docType="lm" onClick={() => createDoc('lm',t.template_key)} />)}</div></Card>
      <DocumentsList title="Mes lettres enregistrées" documents={documents} empty="Aucune lettre enregistrée pour le moment." createLabel="Créer une lettre" onCreate={() => createDoc('lm')} onOpen={(id) => openDoc(id, 'lm')} onDelete={deleteDoc} onRename={renameDoc} />
    </div>
  );
}

type InterviewFeedback = {
  score: number;
  strengths: string[];
  improvements: string[];
  star_analysis: { situation?: string; task?: string; action?: string; result?: string };
  relevance: string;
  improved_answer: string;
  next_tip: string;
};

const EMPTY_INTERVIEW_FEEDBACK: InterviewFeedback = {
  score: 0,
  strengths: [],
  improvements: [],
  star_analysis: {},
  relevance: '',
  improved_answer: '',
  next_tip: '',
};

function normalizeInterviewFeedback(value: unknown): InterviewFeedback {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const stringList = (entry: unknown) => Array.isArray(entry) ? entry.map(item => String(item || '').trim()).filter(Boolean) : [];
  const star = raw.star_analysis && typeof raw.star_analysis === 'object' ? raw.star_analysis as Record<string, unknown> : {};
  return {
    score: Math.max(0, Math.min(100, Number(raw.score || 0))),
    strengths: stringList(raw.strengths),
    improvements: stringList(raw.improvements),
    star_analysis: {
      situation: String(star.situation || '').trim(), task: String(star.task || '').trim(),
      action: String(star.action || '').trim(), result: String(star.result || '').trim(),
    },
    relevance: String(raw.relevance || '').trim(),
    improved_answer: String(raw.improved_answer || '').trim(),
    next_tip: String(raw.next_tip || '').trim(),
  };
}

function InterviewFeedbackCard({ feedback }: { feedback: InterviewFeedback }) {
  const starRows = [
    ['Situation', feedback.star_analysis.situation], ['Tâche', feedback.star_analysis.task],
    ['Action', feedback.star_analysis.action], ['Résultat', feedback.star_analysis.result],
  ].filter(([, value]) => Boolean(value));
  return <div className="mt-4 space-y-4 rounded-2xl border border-[#DCE5F1] bg-[#F8FAFD] p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-[#8A620D]">Analyse Assistant IA</p><h4 className="mt-1 font-black text-[#002050]">Retour pédagogique sur votre réponse</h4></div><div className="rounded-xl bg-[#002050] px-3 py-2 text-sm font-black text-white">{Math.round(feedback.score)}/100</div></div>
    <div className="grid gap-4 md:grid-cols-2">
      <div><p className="text-sm font-black text-emerald-700">Points forts</p><ul className="mt-2 space-y-1.5 text-sm leading-6 text-slate-600">{feedback.strengths.length ? feedback.strengths.map(item => <li key={item}>• {item}</li>) : <li>• Aucun point fort suffisamment précis n’a été identifié.</li>}</ul></div>
      <div><p className="text-sm font-black text-amber-700">À améliorer</p><ul className="mt-2 space-y-1.5 text-sm leading-6 text-slate-600">{feedback.improvements.length ? feedback.improvements.map(item => <li key={item}>• {item}</li>) : <li>• Continuez à préciser vos exemples et résultats.</li>}</ul></div>
    </div>
    {starRows.length > 0 && <div><p className="text-sm font-black text-[#002050]">Lecture STAR</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{starRows.map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-3"><span className="text-xs font-black text-[#002050]">{label}</span><p className="mt-1 text-xs leading-5 text-slate-500">{value}</p></div>)}</div></div>}
    {feedback.relevance && <div><p className="text-sm font-black text-[#002050]">Pertinence pour le poste</p><p className="mt-1 text-sm leading-6 text-slate-600">{feedback.relevance}</p></div>}
    {feedback.improved_answer && <div className="rounded-xl border border-[#BF8813]/25 bg-white p-4"><p className="text-sm font-black text-[#002050]">Exemple de réponse améliorée</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{feedback.improved_answer}</p></div>}
    {feedback.next_tip && <p className="text-sm font-semibold leading-6 text-[#002050]">Prochaine amélioration : {feedback.next_tip}</p>}
  </div>;
}

function InterviewView({ jobId }: { jobId?: string }) {
  type InterviewTab = 'questions' | 'simulation' | 'answers' | 'advice';
  const categories = ['Général','RH','Comportemental','Technique','Sectoriel','Lié à une offre'] as const;
  const [tab,setTab]=useState<InterviewTab>('questions');
  const [category,setCategory]=useState<typeof categories[number]>(jobId ? 'Lié à une offre' : 'Général');
  const [seed,setSeed]=useState(() => Math.floor(Math.random()*1000));
  const [openQuestion,setOpenQuestion]=useState<string | null>(null);
  const [answers,setAnswers]=useState<Record<string,string>>(() => { try { return JSON.parse(localStorage.getItem('omnia_interview_answers')||'{}'); } catch { return {}; } });
  const [feedback,setFeedback]=useState<Record<string,InterviewFeedback>>({});
  const [aiLoading,setAiLoading]=useState<string | null>(null);
  const [applications,setApplications]=useState<CareerTrackedApplication[]>([]);
  const [selectedJobId,setSelectedJobId]=useState(jobId || '');
  const [jobContext,setJobContext]=useState<CareerJobContext | null>(null);
  const [contextLoading,setContextLoading]=useState(false);
  const [targetRole,setTargetRole]=useState('');
  const [targetCompany,setTargetCompany]=useState('');
  const [simulationIndex,setSimulationIndex]=useState(0);
  const [summaryFeedback,setSummaryFeedback]=useState<InterviewFeedback | null>(null);

  useEffect(()=>{
    let active=true;
    void listCareerApplications().then(result=>{if(active)setApplications(result.applications||[])}).catch(()=>{});
    return()=>{active=false};
  },[]);

  useEffect(()=>{
    if(jobId){setSelectedJobId(jobId);setCategory('Lié à une offre');}
  },[jobId]);

  useEffect(()=>{
    let active=true;
    if(!selectedJobId){setJobContext(null);return()=>{active=false};}
    setContextLoading(true);
    void getCareerJobContext(selectedJobId).then(({job})=>{
      if(!active)return;
      setJobContext(job);
      if(job){setTargetRole(job.title||'');setTargetCompany(job.recruiter_company||'');setCategory('Lié à une offre');}
    }).catch(()=>{if(active)setJobContext(null)}).finally(()=>{if(active)setContextLoading(false)});
    return()=>{active=false};
  },[selectedJobId]);

  const questionBank = useMemo<Record<string,string[]>>(()=>({
    Général:['Présentez-vous en deux minutes.','Pourquoi souhaitez-vous rejoindre cette entreprise ?','Pourquoi êtes-vous la bonne personne pour ce poste ?','Quel accomplissement vous rend le plus fier ?'],
    RH:['Quelles sont vos principales motivations ?','Quel environnement de travail vous convient le mieux ?','Comment gérez-vous un désaccord avec un collègue ?','Où vous voyez-vous dans trois ans ?'],
    Comportemental:['Parlez d’une situation difficile que vous avez résolue.','Décrivez une erreur et ce que vous en avez appris.','Donnez un exemple de prise d’initiative.','Racontez une situation où vous avez dû convaincre.'],
    Technique:[`Quelle compétence technique est déterminante pour ${targetRole || 'votre métier'} et comment l’avez-vous utilisée ?`,'Comment contrôlez-vous la qualité de votre travail ?','Décrivez un problème technique complexe que vous avez résolu.','Comment restez-vous à jour dans votre domaine ?'],
    Sectoriel:['Quels sont les principaux enjeux actuels de votre secteur ?','Comment votre expérience répond-elle aux besoins du secteur ?','Quelle évolution du secteur vous semble la plus importante ?','Quels indicateurs utiliseriez-vous pour mesurer votre performance ?'],
    'Lié à une offre':[
      `Pourquoi le poste de ${targetRole || 'cette offre'}${targetCompany ? ` chez ${targetCompany}` : ''} vous intéresse-t-il ?`,
      `Quelles compétences de votre parcours correspondent le mieux aux attentes du poste de ${targetRole || 'cette offre'} ?`,
      'Quel exemple concret de votre parcours démontre que vous pouvez répondre au besoin principal de cette offre ?',
      `Que feriez-vous pendant vos 90 premiers jours${targetCompany ? ` chez ${targetCompany}` : ''} ?`,
    ],
  }),[targetRole,targetCompany]);

  const questions=useMemo(()=>[...questionBank[category]].sort((a,b)=>((a.length+seed)%7)-((b.length+seed)%7)),[questionBank,category,seed]);
  const platformJobs=applications.filter(item=>item.job_id);
  const selectedApplication=applications.find(item=>item.job_id===selectedJobId) || null;
  const contextForAi={
    job_id:selectedJobId||null,title:targetRole||jobContext?.title||null,company:targetCompany||jobContext?.recruiter_company||null,
    description:jobContext?.description||null,skills_required:jobContext?.skills_required||null,required_level:jobContext?.required_level||null,
    category:jobContext?.category||null,contract_type:jobContext?.contract_type||selectedApplication?.contract_type||null,
    location:jobContext?.location||selectedApplication?.location||null,
  };

  function saveAnswer(q:string,value:string){const next={...answers,[q]:value};setAnswers(next);localStorage.setItem('omnia_interview_answers',JSON.stringify(next));}

  async function requestFeedback(question:string, answer:string, mode:'answer'|'summary'='answer'){
    if(!SUPABASE_URL) throw new Error('Le service IA n’est pas configuré.');
    const res=await fetch(`${SUPABASE_URL}/functions/v1/career-studio-manage?action=ai`,{
      method:'POST',headers:edgeAuthHeaders(),body:JSON.stringify({
        action:'interview_feedback',interview_mode:mode,question,answer,answers:mode==='summary'?answers:undefined,
        job_context:contextForAi,language:'fr',
      }),
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok||data.error) throw new Error(data.message||data.error||'Analyse IA impossible.');
    return normalizeInterviewFeedback(data.feedback || (()=>{try{return JSON.parse(data.result||'{}')}catch{return EMPTY_INTERVIEW_FEEDBACK}})());
  }

  async function submitAi(q:string){const answer=(answers[q]||'').trim();if(!answer)return;setAiLoading(q);try{const result=await requestFeedback(q,answer);setFeedback(current=>({...current,[q]:result}));}catch(error){setFeedback(current=>({...current,[q]:{...EMPTY_INTERVIEW_FEEDBACK,improvements:[error instanceof Error?error.message:'Le service IA n’est pas disponible.']} }));}finally{setAiLoading(null)}}
  async function generateAdvice(){setAiLoading('summary');try{setSummaryFeedback(await requestFeedback('Bilan global de préparation à l’entretien',JSON.stringify(answers),'summary'));}catch(error){setSummaryFeedback({...EMPTY_INTERVIEW_FEEDBACK,improvements:[error instanceof Error?error.message:'Le service IA n’est pas disponible.']});}finally{setAiLoading(null)}}

  const tabs:Array<{id:InterviewTab;label:string}>=[{id:'questions',label:'Questions fréquentes'},{id:'simulation',label:'Simulation entretien'},{id:'answers',label:'Mes réponses'},{id:'advice',label:'Bilan & conseils'}];
  const simulationQuestion=questions[simulationIndex%questions.length];

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><PageHeader title="Préparer mon entretien" subtitle="Entraînement guidé, contexte de candidature et correction pédagogique par Assistant IA."/><div className="rounded-xl border border-[#BF8813]/25 bg-[#FFF9EC] px-3 py-2 text-xs font-bold text-[#805A0C]">Vos réponses restent liées à votre espace Career.</div></div>

    <Card className="overflow-hidden">
      <div className="grid gap-0 lg:grid-cols-[1fr_1.1fr]">
        <div className="bg-[#002050] p-5 text-white sm:p-6"><p className="text-xs font-black uppercase tracking-[0.15em] text-[#E8B94E]">Contexte de préparation</p><h2 className="mt-2 text-xl font-black">Adaptez les questions à une opportunité réelle</h2><p className="mt-2 text-sm leading-6 text-white/70">Sélectionnez une candidature Omnia ou indiquez simplement le poste et l’entreprise visés.</p></div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
          <label className="text-sm font-bold text-[#002050] sm:col-span-2">Candidature suivie<select value={selectedJobId} onChange={event=>setSelectedJobId(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">Préparation générale / saisie manuelle</option>{platformJobs.map(item=><option key={item.id} value={item.job_id||''}>{item.job_title||'Offre'}{item.company_name?` — ${item.company_name}`:''}</option>)}</select></label>
          <label className="text-sm font-bold text-[#002050]">Poste visé<input value={targetRole} onChange={event=>setTargetRole(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" placeholder="Ex. Chef de projet" /></label>
          <label className="text-sm font-bold text-[#002050]">Entreprise<input value={targetCompany} onChange={event=>setTargetCompany(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" placeholder="Nom de l’organisation" /></label>
          {contextLoading&&<p className="text-xs text-slate-400 sm:col-span-2">Chargement de l’offre…</p>}
          {jobContext&&<div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600 sm:col-span-2"><strong className="text-[#002050]">Offre reliée :</strong> {[jobContext.contract_type,jobContext.location,jobContext.required_level].filter(Boolean).join(' · ') || 'contexte disponible'}{jobContext.skills_required&&<div className="mt-1"><strong>Compétences attendues :</strong> {Array.isArray(jobContext.skills_required)?jobContext.skills_required.join(', '):String(jobContext.skills_required)}</div>}</div>}
        </div>
      </div>
    </Card>

    <div className="overflow-x-auto border-b border-slate-200"><div className="flex min-w-max gap-6">{tabs.map(item=><button key={item.id} onClick={()=>setTab(item.id)} className="border-b-2 px-1 pb-3 text-sm font-black" style={{borderColor:tab===item.id?OMNIA_GOLD:'transparent',color:tab===item.id?OMNIA_BLUE:MUTED}}>{item.label}</button>)}</div></div>

    {(tab==='questions'||tab==='simulation')&&<div className="flex flex-wrap gap-2">{categories.map(item=><button key={item} onClick={()=>{setCategory(item);setSeed(Math.floor(Math.random()*1000));setOpenQuestion(null);setSimulationIndex(0)}} className="rounded-full px-4 py-2 text-sm font-semibold" style={{background:category===item?OMNIA_BLUE:'#fff',color:category===item?'#fff':OMNIA_BLUE,border:`1px solid ${BORDER}`}}>{item}</button>)}<button onClick={()=>{setSeed(Math.floor(Math.random()*1000));setSimulationIndex(0)}} className="inline-flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm font-semibold" style={{borderColor:BORDER,color:OMNIA_BLUE}}><RefreshCw size={15}/>Changer les questions</button></div>}

    {tab==='questions'&&<div className="grid gap-5 xl:grid-cols-[1fr_330px]"><Card className="p-5"><SectionTitle title="Banque de questions"/><div className="space-y-3">{questions.map(q=><div key={q} className="rounded-xl border" style={{borderColor:BORDER}}><button onClick={()=>setOpenQuestion(openQuestion===q?null:q)} className="flex w-full items-center justify-between gap-4 p-4 text-left text-sm font-semibold" style={{color:OMNIA_BLUE}}>{q}<ChevronDown size={16} className={openQuestion===q?'rotate-180':''}/></button>{openQuestion===q&&<div className="border-t p-4" style={{borderColor:BORDER}}><p className="text-sm leading-6" style={{color:MUTED}}>Répondez avec un exemple réel. L’Assistant IA analysera votre réponse sans inventer d’expérience à votre place.</p><textarea value={answers[q]||''} onChange={e=>saveAnswer(q,e.target.value)} className="mt-3 min-h-40 w-full rounded-xl border p-3 text-sm" style={{borderColor:BORDER}} placeholder="Rédigez votre réponse personnelle..."/><div className="mt-3 flex flex-wrap gap-2"><button onClick={()=>submitAi(q)} disabled={!answers[q]?.trim()||aiLoading===q} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40" style={{background:OMNIA_BLUE}}><Sparkles size={16}/>{aiLoading===q?'Analyse en cours...':'Analyser ma réponse'}</button><button onClick={()=>saveAnswer(q,'')} className="rounded-xl border px-4 py-2.5 text-sm font-semibold text-slate-600" style={{borderColor:BORDER}}>Réessayer</button></div>{feedback[q]&&<InterviewFeedbackCard feedback={feedback[q]} />}</div>}</div>)}</div></Card><Card className="p-5"><SectionTitle title="Méthode STAR"/><div className="space-y-3">{[['S','Situation','Contexte précis'],['T','Tâche','Objectif ou responsabilité'],['A','Action','Ce que vous avez personnellement fait'],['R','Résultat','Résultat observable ou chiffré']].map(([letter,name,copy])=><div key={letter} className="flex gap-3 rounded-xl border border-slate-200 p-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#BF8813] text-sm font-black text-white">{letter}</span><div><p className="text-sm font-black text-[#002050]">{name}</p><p className="mt-1 text-xs leading-5 text-slate-500">{copy}</p></div></div>)}</div></Card></div>}

    {tab==='simulation'&&<Card className="overflow-hidden"><div className="border-b border-slate-200 bg-[#F8FAFD] p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-[#8A620D]">Simulation · question {simulationIndex+1}/{questions.length}</p><h3 className="mt-2 max-w-3xl text-xl font-black text-[#002050]">{simulationQuestion}</h3></div><span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-500">{category}</span></div></div><div className="p-5 sm:p-6"><textarea value={answers[simulationQuestion]||''} onChange={e=>saveAnswer(simulationQuestion,e.target.value)} className="min-h-48 w-full rounded-2xl border border-slate-200 p-4 text-sm leading-6" placeholder="Répondez comme si vous étiez face au recruteur..."/><div className="mt-4 flex flex-wrap justify-between gap-3"><button onClick={()=>setSimulationIndex(index=>(index-1+questions.length)%questions.length)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-[#002050]">Question précédente</button><div className="flex flex-wrap gap-2"><button onClick={()=>submitAi(simulationQuestion)} disabled={!answers[simulationQuestion]?.trim()||aiLoading===simulationQuestion} className="inline-flex items-center gap-2 rounded-xl bg-[#002050] px-4 py-2.5 text-sm font-black text-white disabled:opacity-40"><Sparkles size={16}/>{aiLoading===simulationQuestion?'Analyse…':'Corriger avec l’IA'}</button><button onClick={()=>setSimulationIndex(index=>(index+1)%questions.length)} className="rounded-xl bg-[#BF8813] px-4 py-2.5 text-sm font-black text-white">Question suivante</button></div></div>{feedback[simulationQuestion]&&<InterviewFeedbackCard feedback={feedback[simulationQuestion]} />}</div></Card>}

    {tab==='answers'&&<Card className="p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><SectionTitle title="Mes réponses sauvegardées"/><span className="text-xs font-bold text-slate-400">{Object.values(answers).filter(value=>value.trim()).length} réponse(s)</span></div>{Object.entries(answers).filter(([,value])=>value.trim()).length? <div className="divide-y divide-slate-200">{Object.entries(answers).filter(([,value])=>value.trim()).map(([question,answer])=><div key={question} className="py-4"><p className="text-sm font-black text-[#002050]">{question}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{answer}</p>{feedback[question]&&<div className="mt-2 text-xs font-bold text-[#8A620D]">Analyse IA disponible · score {Math.round(feedback[question].score)}/100</div>}</div>)}</div>:<div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Aucune réponse sauvegardée. Commencez dans Questions fréquentes ou Simulation.</div>}</Card>}

    {tab==='advice'&&<div className="grid gap-5 lg:grid-cols-[1fr_.75fr]"><Card className="p-5 sm:p-6"><SectionTitle title="Bilan de préparation"/><p className="text-sm leading-6 text-slate-600">L’Assistant IA analyse vos réponses enregistrées et le contexte du poste sélectionné pour établir vos priorités de progression.</p><button onClick={()=>void generateAdvice()} disabled={aiLoading==='summary'||Object.values(answers).every(value=>!value.trim())} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#002050] px-4 py-2.5 text-sm font-black text-white disabled:opacity-40"><Sparkles size={16}/>{aiLoading==='summary'?'Analyse globale…':'Générer mon bilan'}</button>{summaryFeedback&&<InterviewFeedbackCard feedback={summaryFeedback} />}</Card><Card className="p-5 sm:p-6"><SectionTitle title="Avant l’entretien"/><div className="space-y-3 text-sm leading-6 text-slate-600">{['Relisez l’offre et identifiez les trois attentes essentielles.','Préparez deux exemples STAR réellement vécus.','Reliez chaque compétence annoncée à une preuve concrète.','Préparez deux questions pertinentes à poser au recruteur.'].map(item=><div key={item} className="flex gap-2"><CheckCircle2 size={17} className="mt-1 shrink-0 text-emerald-600"/><span>{item}</span></div>)}</div></Card></div>}
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
  const storageKey='omnia_manual_applications';
  const [apps,setApps]=useState<TrackedApplication[]>([]);
  const [loading,setLoading]=useState(false);
  const [showManual,setShowManual]=useState(false);
  const [manual,setManual]=useState({company_name:'',job_title:'',job_url:'',location:'',contract_type:'CDI'});
  function localApps(){ try { return JSON.parse(localStorage.getItem(storageKey)||'[]') as TrackedApplication[]; } catch { return []; } }
  function loadApplications(){ setApps(localApps()); }
  useEffect(()=>{loadApplications()},[]);
  function addManual(){ if(!manual.company_name.trim()||!manual.job_title.trim()) return; const item:TrackedApplication={id:`local-app-${Date.now()}`,source:'manual',status:'draft',company_name:manual.company_name,job_title:manual.job_title,job_url:manual.job_url,job_offers:{title:manual.job_title,recruiter_company:manual.company_name,location:manual.location,contract_type:manual.contract_type,application_mode:'external_link',external_apply_url:manual.job_url}}; const next=[item,...localApps()]; localStorage.setItem(storageKey,JSON.stringify(next)); setApps(prev=>[item,...prev]); setManual({company_name:'',job_title:'',job_url:'',location:'',contract_type:'CDI'}); setShowManual(false); }
  const columns=[{title:'Brouillon',statuses:['draft','prepared']},{title:'À envoyer',statuses:['to_apply']},{title:'Envoyée',statuses:['applied','submitted','declared_sent','redirected','email_prepared','received','waiting_response']},{title:'Entretien',statuses:['interview','shortlisted']},{title:'Finalisée',statuses:['offer','accepted','rejected','withdrawn','archived']}];
  return <div className="space-y-5"><PageHeader title="Suivi candidatures" subtitle="Suivez vos candidatures réelles sans perdre vos données si le service distant est indisponible." actionLabel="Ajouter une candidature" onAction={()=>setShowManual(true)}/>{loading?<Card className="p-8"><div className="text-center text-sm" style={{color:MUTED}}>Chargement des candidatures…</div></Card>:apps.length===0?<Card className="p-8"><EmptyState text="Aucune candidature suivie pour le moment." action="Ajouter une candidature" onAction={()=>setShowManual(true)}/></Card>:<div className="grid gap-4 xl:grid-cols-5">{columns.map(col=>{const items=apps.filter(app=>col.statuses.includes(app.tracking_status||app.status||'draft'));return <Card key={col.title} className="p-4"><div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-semibold" style={{color:OMNIA_BLUE}}>{col.title}</h2><SmallBadge>{items.length}</SmallBadge></div><div className="space-y-3">{items.map(app=><div key={app.id} className="rounded-xl border p-3" style={{borderColor:BORDER}}><div className="text-sm font-semibold" style={{color:OMNIA_BLUE}}>{app.job_offers?.title||app.job_title||'Poste'}</div><div className="mt-1 text-xs" style={{color:MUTED}}>{app.job_offers?.recruiter_company||app.company_name||'Entreprise'}</div><div className="mt-3 flex gap-2"><button onClick={()=>navigate(`/omnia-career/entretien${app.job_offers?.id?`?job_id=${app.job_offers.id}`:''}`)} className="text-xs font-semibold" style={{color:OMNIA_BLUE}}>Préparer entretien</button>{app.job_url&&<a href={app.job_url} target="_blank" rel="noreferrer" className="text-xs font-semibold" style={{color:OMNIA_GOLD}}>Voir l’offre</a>}</div></div>)}</div></Card>})}</div>}{showManual&&<div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl"><h2 className="text-lg font-semibold" style={{color:OMNIA_BLUE}}>Ajouter une candidature</h2><div className="mt-4 grid gap-3"><input value={manual.company_name} onChange={e=>setManual({...manual,company_name:e.target.value})} placeholder="Entreprise *" className="h-11 rounded-xl border px-3 text-sm" style={{borderColor:BORDER}}/><input value={manual.job_title} onChange={e=>setManual({...manual,job_title:e.target.value})} placeholder="Poste *" className="h-11 rounded-xl border px-3 text-sm" style={{borderColor:BORDER}}/><input value={manual.job_url} onChange={e=>setManual({...manual,job_url:e.target.value})} placeholder="Lien de l’offre" className="h-11 rounded-xl border px-3 text-sm" style={{borderColor:BORDER}}/><input value={manual.location} onChange={e=>setManual({...manual,location:e.target.value})} placeholder="Lieu" className="h-11 rounded-xl border px-3 text-sm" style={{borderColor:BORDER}}/></div><div className="mt-5 flex justify-end gap-3"><button onClick={()=>setShowManual(false)} className="rounded-xl border px-4 py-2 text-sm" style={{borderColor:BORDER}}>Annuler</button><button onClick={addManual} className="rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{background:OMNIA_BLUE}}>Ajouter</button></div></div></div>}</div>;
}

function ProfileView({ displayName }: { displayName: string }) {
  const raw=readUser()||{};
  const [profile,setProfile]=useState({full_name:raw.full_name||raw.name||displayName,email:raw.email||'',phone:(raw as any).phone_number||(raw as any).phone||'',location:(raw as any).location||'',title:(raw as any).professional_title||'',bio:(raw as any).bio||''});
  const [saving,setSaving]=useState(false); const [message,setMessage]=useState('');
  async function save(){
    setSaving(true); setMessage('');
    const token=getSessionToken()||'';
    const payload={full_name:profile.full_name,email:profile.email,phone_number:profile.phone,professional_title:profile.title,location:profile.location,bio:profile.bio};
    try {
      if(token){
        const res=await fetch(ENDPOINTS.authUpdateProfile,{method:'PATCH',headers:edgeAuthHeaders(),body:JSON.stringify(payload)});
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

function SettingsView({ tokens, user }: { tokens: number; user: any }) {
  const [language,setLanguage]=useState(localStorage.getItem('omnia_career_language')||'fr');
  const [notifications,setNotifications]=useState(localStorage.getItem('omnia_career_notifications')!=='false');
  function save(){ localStorage.setItem('omnia_career_language',language); localStorage.setItem('omnia_career_notifications',String(notifications)); window.dispatchEvent(new Event('omnia-career-language-change')); }
  return <div className="space-y-5"><PageHeader title="Paramètres Omnia Career" subtitle="Réglages propres à votre espace carrière."/><div className="grid gap-5 xl:grid-cols-3"><Card className="p-5"><SectionTitle title="Langue"/><select value={language} onChange={e=>setLanguage(e.target.value)} className="h-11 w-full rounded-xl border px-3 text-sm" style={{borderColor:BORDER}}><option value="fr">Français</option><option value="en">English</option><option value="es">Español</option><option value="pt">Português</option><option value="ar">العربية</option><option value="zh">中文</option><option value="ru">Русский</option><option value="de">Deutsch</option></select><p className="mt-3 text-xs" style={{color:MUTED}}>La préférence est enregistrée. La traduction complète dépend des textes traduits disponibles dans l’application.</p></Card><Card className="p-5"><SectionTitle title="Notifications"/><label className="flex items-center justify-between gap-3 text-sm" style={{color:OMNIA_BLUE}}><span>Notifications Career</span><input type="checkbox" checked={notifications} onChange={e=>setNotifications(e.target.checked)}/></label></Card><Card className="p-5"><SectionTitle title="Jetons"/><div className="text-3xl font-semibold" style={{color:OMNIA_BLUE}}>{tokens}</div><p className="text-sm" style={{color:MUTED}}>jeton(s) disponible(s)</p></Card></div><button onClick={save} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{background:OMNIA_BLUE}}>Enregistrer les paramètres</button></div>;
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

function DocumentsList({ title, documents, empty, createLabel, onCreate, onOpen, onDelete, onRename }: { title: string; documents: CareerDocument[]; empty: string; createLabel: string; onCreate: () => void; onOpen: (id: string) => void; onDelete: (id: string) => void; onRename: (document: CareerDocument) => void }) {
  return <Card className="p-5"><div className="mb-4 flex items-center justify-between"><h2 className="text-base font-semibold" style={{ color: OMNIA_BLUE }}>{title}</h2><button onClick={onCreate} className="rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: OMNIA_GOLD }}>{createLabel}</button></div>{documents.length === 0 ? <div className="rounded-2xl border border-dashed p-8 text-center" style={{ borderColor: BORDER }}><FileText className="mx-auto mb-3" color={MUTED} /><p className="text-sm" style={{ color: MUTED }}>{empty}</p></div> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{documents.map(doc => <div key={doc.id} className="rounded-2xl border p-4" style={{ borderColor: BORDER }}><div className="text-sm font-semibold" style={{ color: OMNIA_BLUE }}>{doc.title}</div><div className="mt-1 text-xs" style={{ color: MUTED }}>Mis à jour le {formatDate(doc.updated_at)}</div><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => onOpen(doc.id)} className="rounded-xl px-3 py-2 text-xs font-semibold text-white" style={{ background: OMNIA_BLUE }}>Ouvrir</button><button onClick={() => onRename(doc)} className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold" style={{ borderColor: BORDER, color: OMNIA_BLUE }}><Edit2 size={13} />Renommer</button><button onClick={() => onDelete(doc.id)} className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold text-red-600" style={{ borderColor: BORDER }}><Trash2 size={13} />Supprimer</button></div></div>)}</div>}</Card>;
}

function Badge({ label }: { label: string }) {
  return <div className="flex h-20 w-20 items-center justify-center rounded-2xl border text-center text-xs font-bold text-white" style={{ background: OMNIA_BLUE, borderColor: OMNIA_GOLD }}>{label}</div>;
}

function Field({ label, value }: { label: string; value: string }) {
  return <label className="mb-3 block text-sm font-medium" style={{ color: OMNIA_BLUE }}>{label}<input className="mt-1 h-10 w-full rounded-xl border px-3 text-sm" style={{ borderColor: BORDER }} value={value} readOnly /></label>;
}
