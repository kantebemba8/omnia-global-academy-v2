import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Award,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Download,
  Edit3,
  Eye,
  FileText,
  GraduationCap,
  Languages,
  Loader2,
  Mail,
  Palette,
  Plus,
  Save,
  Settings,
  Sparkles,
  Star,
  Trash2,
  User,
  X,
  Search,
  Database,
  Target,
  ShieldCheck,
  History,
  Undo2,
  Redo2,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { CvPreview, type DesignOptions, type DocData } from '../../components/career/CvTemplates';
import { LmPreview, type LmData, type LmDesign } from '../../components/career/LmTemplates';
import {
  CAREER_PALETTES,
  CareerDocType,
  CareerDocumentFull,
  CareerTemplateMeta,
  DEFAULT_COLORS,
  createDefaultData,
  createDefaultDesign,
  getDefaultDocTitle,
  getDefaultTemplateKey,
  getCareerTemplates,
  getTemplateMeta,
  normalizeTemplateKey,
} from '../../lib/careerStudioData';
import { consumeCareerTokenAction, deleteCareerDocument, fetchCareerTemplateCatalog, getCareerDocument, listCareerDocuments, prepareCareerPdfExport, renameCareerDocument, runCareerAiAction, saveCareerDocument } from '../../lib/careerStudioApi';
import { downloadPreparedCareerPdf, renderCareerPdfBeforeAuthorization } from '../../lib/careerPdfExport';
import { exportCareerWord } from '../../lib/careerWordExport';
import { approximateDataUrlBytes, isNativeApp, pickNativeImageAsDataUrl } from '../../lib/mobile';
import TemplateLiveCard from '../../components/career/TemplateLiveCard';
import CareerSourcePanel from '../../components/career/CareerSourcePanel';
import CareerTargetPanel from '../../components/career/CareerTargetPanel';
import CareerDesignPanel, { type AdvancedCareerDesign } from '../../components/career/CareerDesignPanel';
import CareerQualityPanel from '../../components/career/CareerQualityPanel';
import CareerVersionPanel from '../../components/career/CareerVersionPanel';
import CareerDocumentSurface, { getCareerSurfaceMetrics } from '../../components/career/CareerDocumentSurface';
import {
  analyzeCareerDocument,
  createLinkedLetterFromCv,
  getCareerMeta,
  hasCareerQualityStarted,
  markCareerDocumentModified,
  normalizeCareerDocument,
  withCareerMeta,
  type CareerSourceProfile,
} from '../../lib/careerBuilderV2';
import { isLearnerPreviewMode, withLearnerPreview } from '../../lib/learnerPreview';
import MobileBuilderAdvice from '../../components/MobileBuilderAdvice';
import { createCareerHistory, recordCareerEdit, undoCareerEdit, redoCareerEdit, moveCareerEntry, type CareerHistory } from '../../lib/careerEditingHistory';
import { appendVerifiedCareerSkills, buildSpecializedCareerCv, isCareerAiProposalCurrent } from '../../lib/careerFinalization';

const BLUE = '#002050';
const GOLD = '#bf8813';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type AiSuggestionMode = 'cv_summary' | 'cv_experience' | 'cv_skills' | 'lm_full' | 'lm_section' | 'cv_personalize' | 'lm_personalize' | 'analysis';
type AiSuggestion = { title: string; text: string; mode: AiSuggestionMode; targetId?: string; sourceValue?: string; sourceDocumentId?: string; tokensConsumed?: number; tokensRemaining?: number; remote?: boolean };

type CvSectionKey = 'profile' | 'summary' | 'skills' | 'experiences' | 'education' | 'certifications' | 'languages' | 'projects' | 'interests';
type LmSectionKey = 'sender' | 'recipient' | 'letter' | 'variables';
type Workspace = 'content' | 'source' | 'target' | 'design' | 'quality' | 'versions' | 'ai' | 'templates';

const CV_SECTIONS: Array<{ key: CvSectionKey; label: string; subtitle: string; icon: any }> = [
  { key: 'profile', label: 'Profil', subtitle: 'Informations personnelles', icon: User },
  { key: 'summary', label: 'Résumé', subtitle: 'Accroche professionnelle', icon: FileText },
  { key: 'skills', label: 'Compétences', subtitle: 'Compétences clés', icon: Star },
  { key: 'experiences', label: 'Expériences', subtitle: 'Parcours professionnel', icon: Briefcase },
  { key: 'education', label: 'Formation', subtitle: 'Diplômes et formations', icon: GraduationCap },
  { key: 'certifications', label: 'Certifications', subtitle: 'Certifications obtenues', icon: Award },
  { key: 'languages', label: 'Langues', subtitle: 'Langues parlées', icon: Languages },
  { key: 'projects', label: 'Projets', subtitle: 'Portfolio et réalisations', icon: Settings },
  { key: 'interests', label: 'Centres d’intérêt', subtitle: 'Vos passions', icon: Star },
];

const LM_SECTIONS: Array<{ key: LmSectionKey; label: string; subtitle: string; icon: any }> = [
  { key: 'sender', label: 'Expéditeur', subtitle: 'Vos coordonnées', icon: User },
  { key: 'recipient', label: 'Destinataire', subtitle: 'Entreprise et recruteur', icon: Briefcase },
  { key: 'letter', label: 'Corps de la lettre', subtitle: 'Contenu principal', icon: Mail },
  { key: 'variables', label: 'Ciblage', subtitle: 'Poste, ton et mots-clés', icon: Sparkles },
];

const WORKSPACE_ITEMS: Array<{ key: Workspace; label: string; icon: any }> = [
  { key: 'content', label: 'Contenu', icon: FileText },
  { key: 'source', label: 'Sources', icon: Database },
  { key: 'target', label: 'Poste', icon: Target },
  { key: 'design', label: 'Design', icon: Palette },
  { key: 'quality', label: 'Qualité', icon: ShieldCheck },
  { key: 'versions', label: 'Versions', icon: History },
  { key: 'ai', label: 'IA', icon: Sparkles },
  { key: 'templates', label: 'Modèles', icon: Settings },
];

type BuilderMode = 'write' | 'design' | 'check';
const BUILDER_MODES: Array<{ key: BuilderMode; label: string; icon: any; start: Workspace; items: Workspace[] }> = [
  { key: 'write', label: 'Rédiger', icon: FileText, start: 'content', items: ['content', 'source', 'target', 'ai'] },
  { key: 'design', label: 'Design', icon: Palette, start: 'design', items: ['design', 'templates'] },
  { key: 'check', label: 'Vérifier', icon: ShieldCheck, start: 'quality', items: ['quality', 'versions'] },
];
const getBuilderMode = (item: Workspace): BuilderMode =>
  BUILDER_MODES.find(mode => mode.items.includes(item))?.key || 'write';

const WORKSPACE_TITLES: Record<Workspace, { title: string; description: string }> = {
  content: { title: 'Contenu', description: 'Modifiez les informations affichées dans le document.' },
  source: { title: 'Sources Omnia', description: 'Importez uniquement les données que vous souhaitez utiliser.' },
  target: { title: 'Poste ciblé', description: 'Adaptez le document à une offre ou à une candidature.' },
  design: { title: 'Design', description: 'Personnalisez la présentation sans casser le modèle.' },
  quality: { title: 'Qualité', description: 'Contrôlez la lisibilité, le contenu et la compatibilité ATS.' },
  versions: { title: 'Versions', description: 'Enregistrez et restaurez des étapes importantes.' },
  ai: { title: 'Assistant IA', description: 'Demandez une suggestion puis décidez de l’appliquer.' },
  templates: { title: 'Modèles', description: 'Changez de modèle sans perdre le contenu du document.' },
};

function uid(prefix = 'item') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function cardClass(extra = '') {
  return `rounded-2xl border border-slate-200 bg-white shadow-sm ${extra}`;
}

function inputClass(extra = '') {
  return `w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-[#002050] focus:ring-4 focus:ring-[#002050]/10 ${extra}`;
}

function labelClass() {
  return 'mb-1.5 block text-xs font-semibold text-slate-600';
}

function getCvData(document: CareerDocumentFull): DocData {
  return document.doc_data as DocData;
}

function getLmData(document: CareerDocumentFull): LmData {
  return document.doc_data as LmData;
}

function getCvDesign(document: CareerDocumentFull): DesignOptions {
  return document.design_options as DesignOptions;
}

function getLmDesign(document: CareerDocumentFull): LmDesign {
  return document.design_options as LmDesign;
}

function PreviewFrame({ children, zoom, onZoomChange, width = 794, height = 1123 }: { children: React.ReactNode; zoom: number; onZoomChange: (zoom:number)=>void; width?: number; height?: number }) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-center gap-2">
        <button type="button" onClick={()=>onZoomChange(Math.max(.35, zoom-.1))} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold">−</button>
        <span className="w-16 text-center text-xs font-semibold text-slate-600">{Math.round(zoom*100)}%</span>
        <button type="button" onClick={()=>onZoomChange(Math.min(1.05, zoom+.1))} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold">+</button>
        <button type="button" onClick={()=>onZoomChange(.62)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold">Ajuster</button>
      </div>
      <div className="mx-auto flex h-[calc(100dvh-280px)] min-h-[420px] w-full justify-center overflow-auto rounded-2xl border border-slate-200 bg-slate-100 p-2 shadow-inner sm:h-[760px] sm:p-5">
        <div style={{ width: width * zoom, height: height * zoom }}><div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', width, height }}>{children}</div></div>
      </div>
    </div>
  );
}

function containsExampleContent(data: DocData | LmData) {
  const serialized = JSON.stringify(data || {});
  return /Votre nom complet|Titre professionnel visé|prenom\.nom@email\.com|XX XX|Nom de l’entreprise|Intitulé du poste|Remplacez|Décrivez|votre-portfolio\.com|linkedin\.com\/in\/votre-profil|\[[^\]]+\]/i.test(serialized);
}

function hasText(value: unknown) { return typeof value === 'string' && value.trim().length > 0; }
function isCvSectionComplete(key: CvSectionKey, data: DocData) {
  if (key === 'profile') return hasText(data.name) && hasText(data.title) && (hasText(data.contact?.email) || hasText(data.contact?.phone));
  if (key === 'summary') return hasText(data.summary);
  if (key === 'skills') return Array.isArray(data.skills) && data.skills.some((x: any) => hasText(x?.name));
  if (key === 'experiences') return Array.isArray(data.experiences) && data.experiences.some((x: any) => hasText(x?.position) && hasText(x?.company));
  if (key === 'education') return Array.isArray(data.education) && data.education.some((x: any) => hasText(x?.degree) && hasText(x?.school));
  if (key === 'certifications') return Array.isArray(data.certifications_external) && data.certifications_external.some((x: any) => hasText(x?.name));
  if (key === 'languages') return Array.isArray(data.languages) && data.languages.some((x: any) => hasText(x?.name) && hasText(x?.level));
  return false;
}
function isLmSectionComplete(key: LmSectionKey, data: LmData) {
  const map: Record<LmSectionKey, boolean> = {
    sender: hasText(data.sender?.name) && hasText(data.sender?.email),
    recipient: hasText(data.recipient?.company),
    letter: hasText(data.intro) && hasText(data.motivation) && hasText(data.skills_paragraph) && hasText(data.closing),
    variables: hasText(data.subject) && hasText(data.salutation) && hasText(data.signature),
  };
  return map[key];
}
export default function CareerStudioEditor() {
  const navigate = useNavigate();
  const { docId } = useParams<{ docId: string }>();
  const [searchParams] = useSearchParams();
  const docType = (searchParams.get('type') === 'lm' ? 'lm' : 'cv') as CareerDocType;
  const rawRequestedTemplate = String(searchParams.get('template') || '').trim();
  const requestedTemplate = rawRequestedTemplate ? normalizeTemplateKey(docType, rawRequestedTemplate) : '';
  const previewMode = isLearnerPreviewMode();

  const [document, setDocument] = useState<CareerDocumentFull | null>(null);
  // A single in-memory document is shared by the writing panel and page.
  // History is local to the open document; it is not a second persisted store.
  const liveDocumentRef = useRef<CareerDocumentFull | null>(null);
  const historyRef = useRef<CareerHistory<CareerDocumentFull>>(createCareerHistory());
  const [historyRevision, setHistoryRevision] = useState(0);

  const [templates, setTemplates] = useState<CareerTemplateMeta[]>([]);
  const [tokens, setTokens] = useState(0);
  const [remoteMode, setRemoteMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [activeCvSection, setActiveCvSection] = useState<CvSectionKey>('profile');
  const [activeLmSection, setActiveLmSection] = useState<LmSectionKey>('letter');
  const [toast, setToast] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingWord, setExportingWord] = useState(false);
  const [aiLoadingAction, setAiLoadingAction] = useState<string | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);
  const [selectedExperienceId, setSelectedExperienceId] = useState('');
  const [specializeOpen, setSpecializeOpen] = useState(false);
  const [specializeJob, setSpecializeJob] = useState('');
  const [specializeCompany, setSpecializeCompany] = useState('');
  const [specializeCountry, setSpecializeCountry] = useState('');
  const [specializeSaving, setSpecializeSaving] = useState(false);
  const [offerText, setOfferText] = useState('');
  const saveTimer = useRef<number | null>(null);
  const printRef = useRef<HTMLDivElement | null>(null);
  const [dirty, setDirty] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640 ? 0.38 : 0.62);
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [pendingDocumentName, setPendingDocumentName] = useState('');
  const [pendingSaveAction, setPendingSaveAction] = useState<'save' | 'pdf' | 'word' | 'manual' | 'rename' | null>(null);
  const [fullPreviewOpen, setFullPreviewOpen] = useState(false);
  const [personalizeOpen, setPersonalizeOpen] = useState(false);
  const [personalizeText, setPersonalizeText] = useState('');
  const [personalizeLoading, setPersonalizeLoading] = useState(false);
  const [workspace, setWorkspace] = useState<Workspace>('content');
  const [toolPanelOpen, setToolPanelOpen] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [sourceProfile, setSourceProfile] = useState<CareerSourceProfile>({});

  const qualityStarted = useMemo(() => {
    if (!document) return false;
    return hasCareerQualityStarted(document.doc_data, document.doc_type);
  }, [document]);

  const qualityReport = useMemo(() => {
    if (!document || !qualityStarted) return null;
    return analyzeCareerDocument(document.doc_type, document.doc_data, document.design_options);
  }, [document, qualityStarted]);
  const score = qualityReport?.overall ?? null;

  const selectedTemplate = useMemo(() => {
    if (!document) return getTemplateMeta(docType, requestedTemplate);
    return templates.find(t => t.template_key === document.template_key) || getTemplateMeta(document.doc_type, document.template_key);
  }, [document, docType, requestedTemplate, templates]);

  // A single canonical representation is shared by editing, preview and export.
  // Legacy freeform canvas snapshots remain in test documents as data but are
  // intentionally never used: they were detached from the structured fields.
  const previewMetrics = useMemo(() => document
    ? getCareerSurfaceMetrics(document.design_options).page
    : { width: 794, height: 1123 }, [document]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3200);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      if ((docId === 'new' || !docId) && !requestedTemplate) {
        navigate(docType === 'cv' ? '/omnia-career/cv-builder' : '/omnia-career/lettres', { replace: true });
        return;
      }
      if (previewMode) {
        const catalog = await fetchCareerTemplateCatalog(docType);
        setTemplates(catalog);
        setTokens(0);
        setRemoteMode(false);
        setSourceProfile({});
        const loaded = await getCareerDocument(docType, 'new', requestedTemplate);
        const normalized = normalizeCareerDocument({ ...loaded.document, design_options: { ...loaded.document.design_options, editor_mode: 'template' } });
        liveDocumentRef.current = normalized;
        setDocument(normalized);
        setOfferText('');
        return;
      }

      const list = await listCareerDocuments(docType);
      setTemplates(list.templates);
      setTokens(list.tokens);
      setRemoteMode(list.remote);
      setSourceProfile(list.sourceProfile || {});
      const loaded = await getCareerDocument(docType, docId, requestedTemplate);
      const normalized = normalizeCareerDocument({ ...loaded.document, design_options: { ...loaded.document.design_options, editor_mode: 'template' } });
      setRemoteMode(loaded.remote);
      liveDocumentRef.current = normalized;
      setDocument(normalized);
      setOfferText(getCareerMeta(normalized.doc_data, normalized.doc_type).target.job_description || '');
      if ((docId === 'new' || !docId) && normalized.id.startsWith('local_')) {
        setPendingDocumentName('');
        setPendingSaveAction(null);
        setNameDialogOpen(true);
      }
    } catch (error) {
      setLoadError((error as Error).message || 'Chargement du document impossible.');
    } finally {
      setLoading(false);
    }
  }, [docId, docType, previewMode, requestedTemplate]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    liveDocumentRef.current = document;
  }, [document]);

  useEffect(() => {
    historyRef.current = createCareerHistory();
    setHistoryRevision(value => value + 1);
  }, [document?.id]);


  const updateDocument = useCallback((
    updater: (current: CareerDocumentFull) => CareerDocumentFull,
    options: { startQuality?: boolean } = {},
  ) => {
    const prev = liveDocumentRef.current;
    if (!prev) return;
    const next = updater(prev);
    const startQuality = options.startQuality !== false;
    const nextData = startQuality ? markCareerDocumentModified(next.doc_data, next.doc_type) : next.doc_data;
    const qualityIsActive = hasCareerQualityStarted(nextData, next.doc_type);
    const normalized: CareerDocumentFull = {
      ...next,
      doc_data: nextData,
      ats_score: qualityIsActive ? analyzeCareerDocument(next.doc_type, nextData, next.design_options).ats : 0,
      updated_at: new Date().toISOString(),
    };
    const activeElement = typeof window !== 'undefined' ? window.document.activeElement : null;
    const coalesceTarget = activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement || activeElement instanceof HTMLSelectElement
      ? activeElement : null;
    historyRef.current = recordCareerEdit(historyRef.current, prev, coalesceTarget, Date.now());
    liveDocumentRef.current = normalized;
    setDocument(normalized);
    setHistoryRevision(value => value + 1);
    setSaveState('idle');
    setDirty(true);
  }, []);

  const restoreHistoryDocument = useCallback((restored: CareerDocumentFull) => {
    // Recalculate quality without dropping persisted metadata or the chosen template.
    const clean = normalizeCareerDocument({ ...restored, updated_at: new Date().toISOString() });
    liveDocumentRef.current = clean;
    setDocument(clean);
    setSaveState('idle');
    setDirty(true);
    setHistoryRevision(value => value + 1);
  }, []);

  const undoEdit = useCallback(() => {
    if (previewMode) return;
    const result = undoCareerEdit(historyRef.current, liveDocumentRef.current);
    if (!result.document) return;
    historyRef.current = result.history;
    restoreHistoryDocument(result.document);
  }, [previewMode, restoreHistoryDocument]);

  const redoEdit = useCallback(() => {
    if (previewMode) return;
    const result = redoCareerEdit(historyRef.current, liveDocumentRef.current);
    if (!result.document) return;
    historyRef.current = result.history;
    restoreHistoryDocument(result.document);
  }, [previewMode, restoreHistoryDocument]);

  const isDocumentNamed = useCallback((doc: CareerDocumentFull) => {
    const currentTitle = String(doc.title || '').trim();
    const defaultTitle = getDefaultDocTitle(doc.doc_type);
    return Boolean(currentTitle && currentTitle !== defaultTitle);
  }, []);

  const persistDocument = useCallback(async (docToSave: CareerDocumentFull) => {
    setSaveState('saving');
    if (previewMode) {
      const previewDocument = normalizeCareerDocument({ ...docToSave, updated_at: new Date().toISOString() });
      liveDocumentRef.current = previewDocument;
      setDocument(previewDocument);
      setRemoteMode(false);
      setSaveState('saved');
      setDirty(false);
      return previewDocument;
    }
    try {
      const saved = await saveCareerDocument(docToSave);
      // Avoid replacing newer typing with an older async save response.
      const hasNewerChanges = liveDocumentRef.current !== docToSave;
      if (!hasNewerChanges) {
        liveDocumentRef.current = saved.document;
        setDocument(saved.document);
        setSaveState('saved');
        setDirty(false);
      } else {
        // The server may assign an id on the first save while the user keeps editing.
        const latest = liveDocumentRef.current;
        if (latest && latest.id === docToSave.id && saved.document.id !== docToSave.id) {
          const withRemoteId = { ...latest, id: saved.document.id };
          liveDocumentRef.current = withRemoteId;
          setDocument(withRemoteId);
        }
        setSaveState('idle');
        setDirty(true);
      }
      setRemoteMode(saved.remote);
      return saved.document;
    } catch {
      setSaveState('error');
      throw new Error('SAVE_FAILED');
    }
  }, [previewMode]);

  const saveNow = useCallback(async (interactive = true, action: 'save' | 'pdf' | 'word' | 'manual' = 'save') => {
    if (!document) return null;
    if (!isDocumentNamed(document)) {
      if (!interactive) return null;
      setPendingDocumentName('');
      setPendingSaveAction(action);
      setNameDialogOpen(true);
      setSaveState('idle');
      return null;
    }
    return persistDocument(document);
  }, [document, isDocumentNamed, persistDocument]);

  const confirmDocumentName = useCallback(async () => {
    if (!document || !pendingDocumentName.trim()) return;
    const cleanTitle = pendingDocumentName.trim();
    const named = { ...document, title: cleanTitle, updated_at: new Date().toISOString() };
    const action = pendingSaveAction;
    liveDocumentRef.current = named;
    setDocument(named);
    setNameDialogOpen(false);
    setPendingSaveAction(null);

    if (action === null) {
      setDirty(true);
      setSaveState('idle');
      showToast('Nom défini. Le document ne sera créé qu’à votre premier enregistrement.');
      return;
    }

    if (action === 'rename') {
      try {
        const result = await renameCareerDocument(named.doc_type, named.id, cleanTitle);
        setDocument(current => current ? { ...current, title: result.title, updated_at: new Date().toISOString() } : current);
        setSaveState('saved');
        showToast('Document renommé.');
      } catch (error) {
        setSaveState('error');
        showToast((error as Error).message || 'Impossible de renommer le document.');
      }
      return;
    }

    try {
      const savedNamed = await persistDocument(named);
      if (action === 'word') {
        await exportCareerWord(savedNamed);
        showToast('Document Word modifiable créé.');
      }
      else if (action === 'manual') showToast('Mise en page manuelle enregistrée');
      else if (action === 'save') showToast('Document enregistré. Vérifiez l’indicateur de synchronisation.');
      else if (action === 'pdf') {
        await handlePdfDownload(true, savedNamed);
      }
    } catch (error) {
      showToast((error as Error).message || 'Impossible de sauvegarder le document.');
    }
  }, [document, pendingDocumentName, pendingSaveAction, persistDocument]);

  useEffect(() => {
    if (!document || loading || !dirty) return;
    // Un nouveau CV/LM reste uniquement en mémoire jusqu'à un enregistrement explicite.
    // Cela évite de créer un brouillon simplement parce que l'utilisateur a ouvert un modèle,
    // changé son nom ou commencé à explorer l'éditeur.
    if (document.id.startsWith('local_')) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void saveNow(false).catch(() => setSaveState('error'));
    }, 900);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [document?.doc_data, document?.design_options, document?.template_key, document?.title, dirty]);

  function updateCv(mutator: (data: DocData) => DocData) {
    updateDocument(doc => {
      const previous = getCvData(doc);
      const next = mutator(previous);
      const photoAdded = !previous.photo_url && Boolean(next.photo_url);
      return {
        ...doc, doc_data: next,
        design_options: photoAdded ? { ...doc.design_options, photo_enabled: true } : doc.design_options,
      };
    });
  }

  function updateLm(mutator: (data: LmData) => LmData) {
    updateDocument(doc => {
      const next = mutator(getLmData(doc));
      return { ...doc, doc_data: next };
    });
  }


  function templatePreset(key: string) {
    const meta = getTemplateMeta('cv', key);
    return {
      colors: meta.default_colors || DEFAULT_COLORS,
      photo_enabled: Boolean((document?.design_options as DesignOptions | undefined)?.photo_enabled),
    } satisfies Partial<DesignOptions>;
  }

  function editCvField(field:string, value:string) {
    if (previewMode) return;
    const parts = field.split(':');
    if (['name','title','summary','objective','references'].includes(field)) {
      updateCv(data => ({...data, [field]: value}));
      return;
    }
    if (field.startsWith('contact.')) {
      const key = field.slice('contact.'.length);
      if (['email','phone','location','linkedin','portfolio'].includes(key)) {
        updateCv(data => ({...data, contact: {...data.contact, [key]: value}}));
      }
      return;
    }
    if (field === 'interests') {
      updateCv(data => ({...data, interests: value.split(/[;,\n]/).map(s=>s.trim()).filter(Boolean)}));
      return;
    }
    if (parts.length !== 3) return;
    const [kind,id,key] = parts;
    const allowed:Record<string,string[]> = {
      experience:['position','company','location','start_date','end_date','description'],
      education:['degree','school','location','year'],
      skill:['name'], language:['name','level'],
      certification:['name','issuer','year'], project:['name','description','technologies'],
      custom:['title','content'],
    };
    if (!allowed[kind]?.includes(key)) return;
    const mapKey:Record<string,keyof DocData> = {
      experience:'experiences', education:'education', skill:'skills', language:'languages',
      certification:'certifications_external',project:'projects',custom:'custom_sections',
    };
    const collection = mapKey[kind];
    if (!collection) return;
    updateCv(data => {
      const entries = (data as unknown as Record<string, unknown>)[collection];
      if (!Array.isArray(entries)) return data;
      return {...data, [collection]: entries.map(item => item.id === id ? {...item,[key]:value} : item)};
    });
  }

  function editLmField(field:string,value:string) {
    if (previewMode) return;
    if (field.startsWith('sender.') || field.startsWith('recipient.')) {
      const [group,key]=field.split('.');
      const valid = group === 'sender'
        ? ['name','address','phone','email','city','date']
        : ['name','company','address'];
      if (!valid.includes(key)) return;
      if (group === 'sender') updateLm(data => ({...data,sender:{...data.sender,[key]:value}}));
      else updateLm(data => ({...data,recipient:{...data.recipient,[key]:value}}));
      return;
    }
    if (['subject','salutation','intro','motivation','skills_paragraph','company_link','availability','closing','signature'].includes(field)) {
      updateLm(data => ({...data,[field]:value}));
    }
  }

  function selectPreviewSection(event:import('react').MouseEvent<HTMLDivElement>){
    if(previewMode)return;
    const target=event.target;
    if(!(target instanceof HTMLElement))return;
    const field=target.closest<HTMLElement>('[data-career-field]')?.dataset.careerField;
    const section=target.closest<HTMLElement>('[data-career-section]')?.dataset.careerSection;
    const chosen=field?.startsWith('experience:')?'experiences':field?.startsWith('education:')?'education':field?.startsWith('skill:')?'skills':field?.startsWith('language:')?'languages':field?.startsWith('certification:')?'certifications':field?.startsWith('project:')?'projects':field?.startsWith('custom:')?'projects':field==='summary'||field==='objective'?'summary':field==='name'||field==='title'||field?.startsWith('contact.')||field?.startsWith('sender.')?'profile':section;
    if(!chosen)return;
    if(isCv){if(CV_SECTIONS.some(x=>x.key===chosen))setActiveCvSection(chosen as CvSectionKey);}
    else {setActiveLmSection((chosen==='sender'?'sender':chosen==='recipient'?'recipient':'letter') as LmSectionKey);}
    setWorkspace('content');setFocusMode(false);setToolPanelOpen(true);
  }

  async function changeTemplate(templateKey: string) {
    const normalizedTemplateKey = normalizeTemplateKey(docType, templateKey);
    const meta = templates.find(template => template.template_key === normalizedTemplateKey)
      || getTemplateMeta(docType, normalizedTemplateKey);

    if (!previewMode && !meta.is_free && document?.template_key !== normalizedTemplateKey) {
      try {
        const charge = await consumeCareerTokenAction(
          'spend_premium_template',
          `${document?.id || 'local'}:${normalizedTemplateKey}`,
          { template_key: normalizedTemplateKey, doc_type: docType },
        );
        if (typeof charge.tokens_remaining === 'number') setTokens(charge.tokens_remaining);
        if (Number(charge.amount || 0) > 0) {
          showToast(`${charge.amount} jeton(s) consommé(s) pour le modèle Premium.`);
        }
      } catch (error) {
        showToast((error as Error).message || 'Impossible d’activer ce modèle Premium.');
        return;
      }
    }

    const preset = docType === 'cv' ? templatePreset(normalizedTemplateKey) : {};
    updateDocument(doc => ({
      ...doc,
      template_key: normalizedTemplateKey,
      doc_data: { ...(doc.doc_data as any) },
      design_options: {
        ...doc.design_options,
        ...preset,
        colors: (preset as any).colors || meta.default_colors || DEFAULT_COLORS,
        editor_mode: 'template',
      } as DesignOptions | LmDesign,
    }));
  }

  function resetDemoData() {
    updateDocument(doc => ({
      ...doc,
      doc_data: createDefaultData(doc.doc_type),
      design_options: createDefaultDesign(doc.doc_type),
      template_key: doc.template_key,
      title: getDefaultDocTitle(doc.doc_type),
      ats_score: 0,
    }), { startQuality: false });
  }

  async function manualSave() {
    const saved = await saveNow(true, 'save');
    if (saved) showToast('Enregistrement effectué. Vérifiez l’indicateur Supabase/local.');
  }

  function openRenameDialog() {
    if (!document) return;
    if (previewMode) { showToast('La prévisualisation administrative Omnia est en lecture seule.'); return; }
    setPendingDocumentName(document.title || '');
    setPendingSaveAction(document.id.startsWith('local_') ? null : 'rename');
    setNameDialogOpen(true);
    setActionsOpen(false);
  }

  async function deleteCurrentDocument() {
    if (!document) return;
    if (previewMode) { showToast('La prévisualisation administrative Omnia est en lecture seule.'); return; }
    if (!confirm(`Supprimer définitivement « ${document.title || 'ce document'} » ?`)) return;
    try {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      await deleteCareerDocument(document.doc_type, document.id);
      showToast('Document supprimé définitivement.');
      navigate(withLearnerPreview(document.doc_type === 'cv' ? '/omnia-career/cv-builder' : '/omnia-career/lettres'), { replace: true });
    } catch (error) {
      showToast((error as Error).message || 'La suppression n’a pas été confirmée par le serveur.');
    }
  }


  function getSelectedExperience() {
    const current = liveDocumentRef.current;
    if (!current || current.doc_type !== 'cv') return undefined;
    const experiences = getCvData(current).experiences || [];
    return experiences.find(item => item.id === selectedExperienceId) || experiences[0];
  }

  function getActiveExperienceText() {
    const active = getSelectedExperience();
    return active ? `${active.position} - ${active.company}\n${active.description}` : '';
  }

  async function requestAi(mode: AiSuggestionMode, action: Parameters<typeof runCareerAiAction>[0]['action']) {
    if (previewMode) { showToast('L’IA est désactivée dans la prévisualisation administrative Omnia.'); return; }
    if (!document || aiLoadingAction) return;
    setAiLoadingAction(action);
    setAiSuggestion(null);
    try {
      const isCvDoc = document.doc_type === 'cv';
      const cv = isCvDoc ? getCvData(document) : null;
      const lm = !isCvDoc ? getLmData(document) : null;
      const activeExperience = mode === 'cv_experience' ? getSelectedExperience() : undefined;
      if (mode === 'cv_experience' && !activeExperience) {
        showToast('Ajoutez une expérience avant de demander une reformulation.');
        return;
      }
      const proposalSourceValue = mode === 'cv_experience' ? (activeExperience?.description || '') :
        mode === 'cv_summary' ? (cv?.summary || '') :
        mode === 'cv_skills' ? JSON.stringify(cv?.skills || []) :
        JSON.stringify(document.doc_data);
      const textByMode =
        mode === 'cv_summary' ? (cv?.summary || '') :
        mode === 'cv_experience' ? getActiveExperienceText() :
        mode === 'cv_skills' ? `${cv?.title || ''}\n${cv?.summary || ''}\n${(cv?.experiences || []).map(e => e.description).join('\n')}` :
        mode === 'lm_full' ? `${lm?.subject || ''}\n${lm?.intro || ''}\n${lm?.motivation || ''}\n${lm?.skills_paragraph || ''}` :
        mode === 'lm_section' ? `${lm?.intro || ''}\n${lm?.motivation || ''}\n${lm?.skills_paragraph || ''}\n${lm?.company_link || ''}` :
        document.doc_type === 'cv' ? JSON.stringify(cv) : JSON.stringify(lm);

      const result = await runCareerAiAction({
        action,
        doc_type: document.doc_type,
        text: textByMode,
        doc_data: document.doc_data,
        offer_text: offerText,
        target_job: isCvDoc ? (cv?.title || document.target_job || '') : (lm?.subject || document.target_job || ''),
        application_type: document.application_type || document.doc_type,
        language: (localStorage.getItem('omnia_platform_language') || localStorage.getItem('omnia_career_language') || 'fr') as any,
      });

      if (typeof result.tokens_remaining === 'number') setTokens(result.tokens_remaining);
      setAiSuggestion({
        title: getAiTitle(mode, action),
        text: formatStructuredAiResult(action, result.result),
        mode,
        targetId: activeExperience?.id,
        sourceValue: proposalSourceValue,
        sourceDocumentId: document.id,
        tokensConsumed: result.tokens_consumed,
        tokensRemaining: result.tokens_remaining,
        remote: result.remote,
      });
      showToast(result.remote ? 'Suggestion IA générée' : 'Suggestion locale générée');
    } catch (err) {
      showToast((err as Error).message || 'Impossible de générer la suggestion IA.');
    } finally {
      setAiLoadingAction(null);
    }
  }

  async function personalizeWithAi() {
    if (previewMode) { showToast('L’IA est désactivée dans la prévisualisation administrative Omnia.'); return; }
    if (!document || !personalizeText.trim() || personalizeLoading) return;
    setPersonalizeLoading(true);
    try {
      const result = await runCareerAiAction({
        action: document.doc_type === 'cv' ? 'generate_cv' : 'generate_lm',
        doc_type: document.doc_type,
        text: personalizeText,
        doc_data: document.doc_data,
        target_job: document.target_job || '',
        application_type: document.application_type || document.doc_type,
        language: (localStorage.getItem('omnia_platform_language') || localStorage.getItem('omnia_career_language') || 'fr') as any,
      });
      if (typeof result.tokens_remaining === 'number') setTokens(result.tokens_remaining);
      // Never apply a paid AI result silently: display the full proposal first.
      setAiSuggestion({
        title: 'Personnalisation IA à valider',
        text: cleanAiText(result.result),
        mode: document.doc_type === 'cv' ? 'cv_personalize' : 'lm_personalize',
        sourceValue: JSON.stringify(document.doc_data),
        sourceDocumentId: document.id,
        tokensConsumed: result.tokens_consumed,
        tokensRemaining: result.tokens_remaining,
        remote: result.remote,
      });
      setPersonalizeOpen(false);
      setPersonalizeText('');
      setWorkspace('ai');
      setToolPanelOpen(true);
      setFocusMode(false);
      showToast('Proposition IA disponible : acceptez-la ou refusez-la avant toute modification.');
    } catch (e) {
      showToast((e as Error).message || 'Le service IA n’est pas disponible.');
    } finally {
      setPersonalizeLoading(false);
    }
  }

  function applyAiSuggestion() {
    const proposal = aiSuggestion;
    const current = liveDocumentRef.current;
    if (!proposal || !current || proposal.mode === 'analysis') return;
    if (!isCareerAiProposalCurrent(proposal, current)) {
      setAiSuggestion(null);
      showToast('Le document a changé depuis la suggestion. Relancez l’IA pour éviter un écrasement.');
      return;
    }
    if (current.doc_type === 'cv') {
      if (proposal.mode === 'cv_summary') {
        updateCv(d => ({ ...d, summary: cleanAiText(proposal.text) }));
      } else if (proposal.mode === 'cv_experience') {
        updateCv(d => ({ ...d, experiences: d.experiences.map(exp =>
          exp.id === proposal.targetId ? { ...exp, description: cleanAiText(proposal.text) } : exp),
        }));
      } else if (proposal.mode === 'cv_skills') {
        // Suggestions are not proof of competence: preserve declared skills and
        // let the learner confirm the proposed additions before accepting.
        updateCv(d => ({ ...d, skills: appendVerifiedCareerSkills(d.skills, parseAiLines(proposal.text)) }));
      } else if (proposal.mode === 'cv_personalize') {
        const paragraphs = splitParagraphs(proposal.text);
        updateCv(d => ({
          ...d,
          summary: paragraphs[0] || d.summary,
          experiences: d.experiences?.length ? d.experiences.map((e, i) => i === 0 ? { ...e, description: paragraphs[1] || e.description } : e) : d.experiences,
        }));
      }
    } else if (proposal.mode === 'lm_full' || proposal.mode === 'lm_personalize') {
      updateLm(d => mergeLetterText(d, proposal.text));
    } else if (proposal.mode === 'lm_section') {
      const paragraphs = splitParagraphs(proposal.text);
      updateLm(d => ({
        ...d,
        intro: paragraphs[0] || d.intro,
        motivation: paragraphs[1] || d.motivation,
        skills_paragraph: paragraphs[2] || d.skills_paragraph,
        company_link: paragraphs[3] || d.company_link,
        availability: paragraphs[4] || d.availability,
      }));
    }
    setAiSuggestion(null);
    showToast('Proposition appliquée. Vous pouvez l’annuler avec Annuler.');
  }

  function openSpecializeDialog() {
    const current = liveDocumentRef.current;
    if (!current || current.doc_type !== 'cv') return;
    const meta = getCareerMeta(current.doc_data, 'cv');
    setSpecializeJob(meta.target.job_title || current.target_job || '');
    setSpecializeCompany(meta.target.company || '');
    setSpecializeCountry(meta.target.country || current.target_country || '');
    setSpecializeOpen(true);
  }

  async function createSpecializedCv() {
    if (previewMode || !document || document.doc_type !== 'cv' || specializeSaving) return;
    if (!specializeJob.trim()) { showToast('Indiquez le poste visé pour identifier cette copie.'); return; }
    setSpecializeSaving(true);
    try {
      const source = liveDocumentRef.current || document;
      const original = isDocumentNamed(source) ? source : { ...source, title: 'CV principal' };
      const savedOriginal = await persistDocument(original);
      if (savedOriginal.id.startsWith('local_') && remoteMode) {
        showToast('La copie source n’est pas synchronisée. Vérifiez la connexion avant de créer une variante.');
        return;
      }
      const specialized = buildSpecializedCareerCv(savedOriginal, {
        job: specializeJob,
        company: specializeCompany,
        country: specializeCountry,
      });
      const saved = await saveCareerDocument(specialized);
      setSpecializeOpen(false);
      if (!saved.remote) showToast('Copie conservée localement, à synchroniser après reconnexion.');
      navigate(`/dashboard/career-studio/editor/${saved.document.id}?type=cv&template=${encodeURIComponent(saved.document.template_key)}`);
    } catch (error) {
      showToast((error as Error).message || 'La copie spécialisée n’a pas pu être créée.');
    } finally { setSpecializeSaving(false); }
  }

  async function createAtsVersion() {
    if (previewMode) { showToast('La création d’une copie est désactivée en prévisualisation.'); return; }
    if (!document) return;
    try {
      const now = new Date().toISOString();
      const atsDocument: CareerDocumentFull = normalizeCareerDocument({
        ...document,
        id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        title: `${document.title || getDefaultDocTitle(document.doc_type)} - ATS`,
        template_key: document.doc_type === 'cv' ? 'cv_atlas' : 'lm_atlas',
        is_primary: false,
        created_at: now,
        updated_at: now,
        design_options: {
          ...document.design_options,
          document_mode: 'ats',
          page_format: 'a4',
          orientation: 'portrait',
          editor_mode: 'template',
          ...(document.doc_type === 'cv' ? { photo_enabled: false } : {}),
          colors: { ...DEFAULT_COLORS, primary: '#16213e', accent: '#4b79a1', sidebar: '#ffffff' },
          margins: { top: 18, right: 18, bottom: 18, left: 18 },
          border_width: 0,
          footer_text: '',
        } as DesignOptions | LmDesign,
      });
      const saved = await saveCareerDocument(atsDocument);
      showToast('Copie ATS créée sans modifier votre version visuelle.');
      navigate(`/dashboard/career-studio/editor/${saved.document.id}?type=${saved.document.doc_type}&template=${encodeURIComponent(saved.document.template_key)}`);
    } catch {
      showToast('Impossible de créer la copie ATS.');
    }
  }

  async function createLinkedLetter() {
    if (previewMode) { showToast('La création d’une lettre associée est désactivée en prévisualisation.'); return; }
    if (!document || document.doc_type !== 'cv') return;
    try {
      const source = isDocumentNamed(document) ? document : { ...document, title: 'CV principal' };
      const savedCv = await persistDocument(source);
      const linked = createLinkedLetterFromCv(savedCv);
      const savedLm = await saveCareerDocument(linked);
      showToast('Lettre associée créée avec les mêmes preuves et le même poste ciblé.');
      navigate(`/dashboard/career-studio/editor/${savedLm.document.id}?type=lm&template=${encodeURIComponent(savedLm.document.template_key)}`);
    } catch {
      showToast('Impossible de créer la lettre associée. Enregistrez d’abord le CV puis réessayez.');
    }
  }

  async function handleWordDownload() {
    if (previewMode) { showToast('Export Word désactivé en prévisualisation.'); return; }
    if (!document || exportingWord) return;
    setExportingWord(true);
    try {
      const saved = await saveNow(true, 'word');
      if (!saved) return; // Name dialog will continue export on confirmation.
      await exportCareerWord(saved);
      showToast('Document Word modifiable créé.');
    } catch (error) {
      showToast((error as Error).message || 'Impossible de créer le document Word.');
    } finally {
      setExportingWord(false);
    }
  }

  async function handlePdfDownload(alreadyNamed = false, savedDocument?: CareerDocumentFull) {
    if (previewMode) { showToast('Le téléchargement PDF est désactivé en prévisualisation afin de ne consommer aucun jeton.'); return; }
    if (!document && !savedDocument) return;
    if (exportingPdf) return;

    setExportingPdf(true);
    try {
      if (!printRef.current) throw new Error('Aucun aperçu disponible pour ce PDF.');
      let currentDocument = savedDocument || document!;
      if (!alreadyNamed) {
        const saved = await saveNow(true, 'pdf');
        if (!saved) { setExportingPdf(false); return; }
        currentDocument = saved;
      }
      const pdfOptions = {
        title: currentDocument.title || (currentDocument.doc_type === 'cv' ? 'CV Omnia Career' : 'Lettre Omnia Career'),
        docType: currentDocument.doc_type,
        design: currentDocument.design_options,
      };
      // Render the finished PDF before requesting authorization. A failed canvas,
      // font or image capture must not consume a paid export credit.
      const pdfBlob = await renderCareerPdfBeforeAuthorization(printRef.current, pdfOptions);
      const result = await prepareCareerPdfExport(currentDocument);
      if (typeof result.tokens_remaining === 'number') setTokens(result.tokens_remaining);
      await downloadPreparedCareerPdf(pdfBlob, pdfOptions);

      const message = currentDocument.doc_type === 'cv' && result.remote && result.tokens_consumed > 0
        ? `PDF téléchargé. ${result.tokens_consumed} jeton consommé. Solde : ${result.tokens_remaining ?? tokens}.`
        : 'Fichier PDF téléchargé. Retrouvez-le dans vos téléchargements.';
      showToast(message);
    } catch (err) {
      const e = err as Error & { code?: string; status?: number };
      if (e.code === 'INSUFFICIENT_TOKENS' || e.status === 402) {
        showToast(e.message || 'Jetons insuffisants pour télécharger ce CV.');
      } else {
        showToast(e.message || 'Impossible de préparer le PDF.');
      }
    } finally {
      setExportingPdf(false);
    }
  }

  if (loadError && !loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] p-6">
        <div className="max-w-lg rounded-2xl border border-amber-200 bg-white p-8 shadow-sm">
          <h1 className="text-lg font-bold text-[#002050]">Document temporairement indisponible</h1>
          <p className="mt-3 text-sm text-slate-700">{loadError}</p>
          <p className="mt-2 text-xs text-slate-500">Aucun document vide n'a été créé à sa place.</p>
          <button onClick={() => void load()} className="mt-5 rounded-xl bg-[#002050] px-4 py-2 text-sm font-semibold text-white">Réessayer</button>
        </div>
      </div>
    );
  }
  if (loading || !document) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="h-8 w-8 animate-spin text-[#002050]" />
      </div>
    );
  }

  const isCv = document.doc_type === 'cv';
  const cvData = isCv ? getCvData(document) : null;
  const lmData = !isCv ? getLmData(document) : null;
  const isExampleContent = Boolean((document.doc_data as any)?.career_meta?.example_content) || containsExampleContent(document.doc_data);
  const workspaceMeta = WORKSPACE_TITLES[workspace];
  const editCount = historyRevision >= 0 ? historyRef.current.past.length : 0;

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#F8FAFC] text-slate-900">
      <MobileBuilderAdvice
        storageKey={isCv ? 'career-cv' : 'career-lm'}
        description={isCv
          ? 'La création et la modification de votre CV fonctionnent sur mobile. Pour des documents longs ou un ajustement précis des colonnes, un ordinateur reste plus confortable.'
          : 'La création et la modification de votre lettre fonctionnent sur mobile. Pour une personnalisation typographique précise, un ordinateur reste plus confortable.'}
      />
      {toast && (
        <div className="fixed right-5 top-5 z-[160] rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-[#002050] shadow-lg">
          {toast}
        </div>
      )}

      <header className="relative z-40 shrink-0 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex min-h-[64px] items-center justify-between gap-2 px-3 sm:min-h-[76px] sm:gap-4 sm:px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => navigate(withLearnerPreview('/omnia-career/documents'))}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              title="Mes documents"
              aria-label="Retour à mes documents"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Omnia Career <ChevronRight className="h-3 w-3" /> {isCv ? 'CV Builder' : 'Lettre de motivation'}
              </div>
              <input
                value={document.title}
                onChange={e => updateDocument(doc => ({ ...doc, title: e.target.value }), { startQuality: false })}
                className="mt-0.5 w-full max-w-[520px] truncate border-0 bg-transparent text-lg font-semibold text-[#002050] outline-none sm:text-xl"
                aria-label="Nom du document"
              />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 xl:flex">
              {saveState === 'saving' && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#bf8813]" />}
              {saveState === 'saved' && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
              {saveState === 'saving' ? 'Enregistrement...' : saveState === 'error' ? 'Échec de synchronisation : réessayez' : saveState === 'saved' ? (remoteMode ? 'Enregistré dans Supabase' : 'Enregistré localement uniquement') : previewMode ? 'Mode aperçu administratif' : remoteMode ? 'Connecté Supabase' : 'Mode local sécurisé'}
            </div>
            <div className="hidden rounded-full bg-[#bf8813]/10 px-3 py-2 text-xs font-bold text-[#9a6810] sm:block">{tokens} jeton(s)</div>
            <div className="flex items-center rounded-xl border border-slate-200 bg-white" aria-label="Historique des modifications">
              <button type="button" onClick={undoEdit} disabled={previewMode || editCount === 0}
                className="rounded-l-xl p-2.5 text-[#002050] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30" aria-label="Annuler" title="Annuler la dernière modification"><Undo2 className="h-4 w-4" /></button>
              <button type="button" onClick={redoEdit} disabled={previewMode || historyRef.current.future.length === 0}
                className="rounded-r-xl p-2.5 text-[#002050] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30" aria-label="Rétablir" title="Rétablir la modification"><Redo2 className="h-4 w-4" /></button>
            </div>
            <button
              type="button"
              onClick={() => setFullPreviewOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-[#002050] hover:bg-slate-50"
              title="Prévisualiser le document"
            >
              <Eye className="h-4 w-4" /><span className="hidden lg:inline">Prévisualiser</span>
            </button>
            <button
              type="button"
              onClick={() => { setWorkspace('design'); setFocusMode(false); setToolPanelOpen(true); }}
              className="inline-flex items-center gap-2 rounded-xl border border-[#bf8813]/40 bg-[#fff8e8] px-3 py-2 text-sm font-semibold text-[#7a5310] hover:bg-[#fff2cf]"
              title="Personnaliser le document sans changer de moteur"
            >
              <Edit3 className="h-4 w-4" /><span className="hidden xl:inline">Personnalisation avancée</span>
            </button>
            <button
              type="button"
              onClick={manualSave}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-[#002050] hover:bg-slate-50"
            >
              <Save className="h-4 w-4" /><span className="hidden sm:inline">Enregistrer</span>
            </button>
            <button
              type="button"
              onClick={() => void handlePdfDownload()}
              disabled={exportingPdf}
              className="inline-flex items-center gap-2 rounded-xl bg-[#002050] px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download className="h-4 w-4" /><span className="hidden sm:inline">{exportingPdf ? 'Préparation...' : 'PDF'}</span>
            </button>
            <button
              type="button"
              onClick={handleWordDownload}
              disabled={exportingWord || exportingPdf || previewMode}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-[#002050] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              title="Télécharger le document Word modifiable (.docx) avec les couleurs et la structure de son modèle"
            >
              <FileText className="h-4 w-4"/><span className="hidden sm:inline">{exportingWord ? 'Word...' : 'Word'}</span>
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setActionsOpen(value => !value)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#002050] hover:bg-slate-50"
                aria-expanded={actionsOpen}
                aria-label="Ouvrir les actions du document"
                title="Plus d’actions"
              >
                <Settings className="h-4 w-4" />
              </button>
              {actionsOpen && (
                <div className="absolute right-0 top-12 z-50 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
                  <button type="button" onClick={() => { setFullPreviewOpen(true); setActionsOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"><Eye className="h-4 w-4 text-[#002050]" />Prévisualiser en plein écran</button>
                  <button type="button" onClick={() => { setPersonalizeOpen(true); setActionsOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"><Sparkles className="h-4 w-4 text-[#bf8813]" />Personnaliser à partir d’un texte</button>
                  {isCv && <button type="button" onClick={() => { openSpecializeDialog(); setActionsOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"><Briefcase className="h-4 w-4 text-[#002050]" />Créer un CV pour un poste</button>}
                  <button type="button" onClick={() => { setWorkspace('ai'); setToolPanelOpen(true); setActionsOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"><Sparkles className="h-4 w-4 text-[#002050]" />Ouvrir l’assistant IA</button>
                  {isCv && <button type="button" onClick={() => { createLinkedLetter(); setActionsOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"><Mail className="h-4 w-4 text-[#bf8813]" />Créer la LM associée</button>}
                  <button type="button" onClick={openRenameDialog} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"><Edit3 className="h-4 w-4 text-[#002050]" />Renommer le document</button>
                  <button type="button" onClick={() => { setWorkspace('design'); setFocusMode(false); setToolPanelOpen(true); setActionsOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"><Edit3 className="h-4 w-4 text-[#002050]" />Personnalisation avancée</button>
                  <div className="my-1 border-t border-slate-100" />
                  <button type="button" onClick={() => { resetDemoData(); setActionsOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"><Sparkles className="h-4 w-4 text-[#bf8813]" />Réinitialiser avec l’exemple</button>
                  <button type="button" onClick={() => { setActionsOpen(false); void deleteCurrentDocument(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" />Supprimer le document</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {previewMode && <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-5 py-2.5 text-sm font-semibold text-amber-900">Prévisualisation apprenant sécurisée : les changements restent locaux et aucun jeton n’est consommé.</div>}


      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {!focusMode && <nav className="absolute inset-x-0 bottom-0 z-40 flex h-[68px] shrink-0 flex-row items-center gap-1 overflow-x-auto border-t border-slate-200 bg-white px-2 py-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] md:static md:h-auto md:w-[76px] md:flex-col md:overflow-y-auto md:border-r md:border-t-0 md:py-3 md:shadow-none" aria-label="Outils du Career Studio">
          {BUILDER_MODES.map(mode => {
            const Icon = mode.icon;
            const active = getBuilderMode(workspace) === mode.key;
            return (
              <button
                key={mode.key}
                type="button"
                onClick={() => { if (!active) setWorkspace(mode.start); setToolPanelOpen(true); }}
                className={`flex min-w-[72px] flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-bold transition md:min-w-0 md:w-full md:px-1 ${active ? 'bg-[#002050] text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-[#002050]'}`}
                aria-pressed={active}
                title={mode.label}
              >
                <Icon className="h-4 w-4" />
                <span>{mode.label}</span>
              </button>
            );
          })}
          {!toolPanelOpen && (
            <button type="button" onClick={() => setToolPanelOpen(true)} className="mt-auto flex w-full flex-col items-center gap-1 rounded-xl border border-slate-200 px-1 py-2 text-[10px] font-bold text-[#002050] hover:bg-slate-50" title="Ouvrir le panneau">
              <ChevronRight className="h-4 w-4" /><span>Panneau</span>
            </button>
          )}
        </nav>}

        {!focusMode && toolPanelOpen && <button type="button" aria-label="Fermer le panneau" onClick={() => setToolPanelOpen(false)} className="absolute inset-x-0 bottom-[68px] top-0 z-20 bg-slate-950/20 md:inset-0 md:left-[76px] md:hidden" />}

        {!focusMode && toolPanelOpen && (
          <aside className="absolute inset-x-0 bottom-[68px] top-0 z-30 flex w-full flex-col border-r border-slate-200 bg-[#F8FAFC] shadow-xl md:static md:z-auto md:w-[380px] md:shadow-none">
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4">
              <div>
                <h2 className="text-lg font-semibold text-[#002050]">{workspaceMeta.title}</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">{workspaceMeta.description}</p>
              </div>
              <button type="button" onClick={() => setToolPanelOpen(false)} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" aria-label="Fermer le panneau"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-white p-2" aria-label="Outils du mode sélectionné">
              {WORKSPACE_ITEMS.filter(item => BUILDER_MODES.find(mode => mode.key === getBuilderMode(workspace))?.items.includes(item.key)).map(item => {
                const Icon = item.icon;
                return <button key={item.key} type="button" onClick={() => setWorkspace(item.key)} aria-pressed={workspace === item.key}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold ${workspace === item.key ? 'bg-[#002050] text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                  <Icon className="h-3.5 w-3.5" />{item.label}
                </button>;
              })}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {workspace === 'content' && <EditorPanel isCv={isCv} cvData={cvData} lmData={lmData} activeCvSection={activeCvSection} activeLmSection={activeLmSection} onCvSectionChange={setActiveCvSection} onLmSectionChange={setActiveLmSection} updateCv={updateCv} updateLm={updateLm} score={score ?? 0} isExampleContent={isExampleContent} />}
              {workspace === 'source' && <CareerSourcePanel docType={document.doc_type} data={document.doc_data} source={sourceProfile} onChange={data => updateDocument(doc => ({ ...doc, doc_data: { ...(data as any), career_meta: { ...((data as any).career_meta || {}), example_content: false } } }))} />}
              {workspace === 'target' && <CareerTargetPanel document={document} onSpecialize={isCv ? openSpecializeDialog : undefined} onChange={next => { setOfferText(getCareerMeta(next.doc_data, next.doc_type).target.job_description || ''); updateDocument(() => next); }} />}
              {workspace === 'design' && <CareerDesignPanel docType={document.doc_type} design={document.design_options as AdvancedCareerDesign} onChange={design => updateDocument(doc => ({ ...doc, design_options: design }))} />}
              {workspace === 'quality' && <CareerQualityPanel report={qualityReport} started={qualityStarted} onCreateAtsVersion={qualityStarted ? createAtsVersion : undefined} />}
              {workspace === 'versions' && <CareerVersionPanel document={document} onRestore={restored => { updateDocument(() => normalizeCareerDocument(restored), { startQuality: false }); showToast('Version restaurée. Vérifiez-la puis enregistrez.'); }} />}
              {workspace === 'ai' && <AiAssistantPanel isCv={isCv} experiences={cvData?.experiences || []} selectedExperienceId={selectedExperienceId} onExperienceChange={setSelectedExperienceId} loadingAction={aiLoadingAction} suggestion={aiSuggestion} offerText={offerText} onOfferTextChange={value => { setOfferText(value); const meta = getCareerMeta(document.doc_data, document.doc_type); updateDocument(doc => ({ ...doc, doc_data: { ...(doc.doc_data as any), career_meta: { ...meta, target: { ...meta.target, job_description: value } } } })); }} onRequest={requestAi} onApply={applyAiSuggestion} onDismiss={() => setAiSuggestion(null)} />}
              {workspace === 'templates' && <TemplatePanel docType={document.doc_type} templates={templates.length ? templates : getCareerTemplates(document.doc_type)} selectedTemplate={selectedTemplate} selectedKey={document.template_key} data={document.doc_data} design={document.design_options} onSelect={changeTemplate} />}
            </div>
          </aside>
        )}

        <main className="min-w-0 flex-1 overflow-y-auto bg-slate-100/70 p-2 pb-[78px] sm:p-5 md:pb-5">
          <div className="mx-auto max-w-[1180px]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <span className="rounded-full bg-white px-3 py-1.5 shadow-sm">{selectedTemplate?.name_fr || 'Modèle sélectionné'}</span>
                  <span className="rounded-full bg-white px-3 py-1.5 shadow-sm">{score === null ? 'Qualité —' : `Qualité ${score}%`}</span>
                </div>
                <h1 className="mt-2 text-lg font-semibold text-[#002050] sm:text-xl">Aperçu du document</h1>{!previewMode&&<p className="text-xs text-slate-500">Cliquez sur une rubrique pour ouvrir son édition, ou directement sur un texte pour le modifier.</p>}
              </div>
              <button type="button" onClick={() => { setFocusMode(value => !value); }} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-[#002050] shadow-sm" aria-pressed={focusMode}>{focusMode ? 'Afficher les colonnes de travail' : 'Masquer les colonnes de travail'}</button>
              {!focusMode && !toolPanelOpen && <button type="button" onClick={() => setToolPanelOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-[#002050] shadow-sm"><Settings className="h-4 w-4" />Ouvrir les outils</button>}
            </div>

            {isExampleContent && (
              <div className="mb-3 rounded-2xl border border-[#bf8813]/30 bg-[#fff8e8] px-4 py-3 text-sm text-slate-700">
                <strong className="text-[#002050]">Contenu d’exemple prêt à modifier.</strong> Remplacez les informations génériques par vos données réelles avant d’enregistrer ou d’exporter le document.
              </div>
            )}

            <div className={cardClass('p-3 sm:p-4')}>
              <PreviewFrame zoom={previewZoom} onZoomChange={setPreviewZoom} width={previewMetrics.width} height={previewMetrics.height}>
                <div ref={printRef} data-career-print-source="true" onClick={selectPreviewSection}>
                  <CareerDocumentSurface design={document.design_options} title={document.title}>
                    {isCv ? (
                      <CvPreview templateKey={document.template_key} data={cvData as DocData} design={getCvDesign(document)} layoutConfig={selectedTemplate?.layout_config} onFieldChange={!previewMode?editCvField:undefined} />
                    ) : (
                      <LmPreview templateKey={document.template_key} data={lmData as LmData} design={getLmDesign(document)} layoutConfig={selectedTemplate?.layout_config} onFieldChange={!previewMode?editLmField:undefined} />
                    )}
                  </CareerDocumentSurface>
                </div>
              </PreviewFrame>
            </div>
          </div>
        </main>
      </div>

      {fullPreviewOpen && document && (
        <div className="fixed inset-0 z-[130] flex flex-col bg-slate-950/90 p-4 backdrop-blur-sm">
          <div className="mb-3 flex items-center justify-between text-white">
            <div><div className="text-lg font-semibold">Prévisualisation du document</div><div className="text-xs text-white/70">{document.title}</div></div>
            <button onClick={() => setFullPreviewOpen(false)} className="rounded-xl border border-white/20 p-2 hover:bg-white/10"><X className="h-5 w-5" /></button>
          </div>
          <div className="flex flex-1 items-start justify-center overflow-auto rounded-2xl bg-slate-200 p-6">
            <div style={{ width: previewMetrics.width, minHeight: previewMetrics.height }}>
              <CareerDocumentSurface design={document.design_options} title={document.title}>{isCv ? <CvPreview templateKey={document.template_key} data={cvData as DocData} design={getCvDesign(document)} layoutConfig={selectedTemplate?.layout_config} /> : <LmPreview templateKey={document.template_key} data={lmData as LmData} design={getLmDesign(document)} layoutConfig={selectedTemplate?.layout_config} />}</CareerDocumentSurface>
            </div>
          </div>
        </div>
      )}

      {specializeOpen && document?.doc_type === 'cv' && (
        <div className="fixed inset-0 z-[135] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-semibold text-[#002050]">Créer un CV spécialisé</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Crée une copie autonome à partir de votre CV courant. Les expériences et compétences restent intactes ; adaptez ensuite cette copie au poste avec l’IA.</p>
            <div className="mt-5 space-y-3">
              <label className="block"><span className={labelClass()}>Poste ciblé *</span><input className={inputClass()} value={specializeJob} onChange={e => setSpecializeJob(e.target.value)} placeholder="Ex. Chargé QSE" /></label>
              <label className="block"><span className={labelClass()}>Entreprise (facultatif)</span><input className={inputClass()} value={specializeCompany} onChange={e => setSpecializeCompany(e.target.value)} placeholder="Ex. entreprise visée" /></label>
              <label className="block"><span className={labelClass()}>Pays (facultatif)</span><input className={inputClass()} value={specializeCountry} onChange={e => setSpecializeCountry(e.target.value)} placeholder="Ex. Luxembourg" /></label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setSpecializeOpen(false)} disabled={specializeSaving} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold">Annuler</button>
              <button type="button" onClick={() => void createSpecializedCv()} disabled={specializeSaving || !specializeJob.trim()} className="rounded-xl bg-[#002050] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{specializeSaving ? 'Création...' : 'Créer une copie indépendante'}</button>
            </div>
          </div>
        </div>
      )}

      {personalizeOpen && document && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-semibold text-[#002050]">Personnaliser avec IA</h2><p className="mt-2 text-sm leading-6 text-slate-500">Saisissez uniquement vos informations réelles. L’IA proposera un contenu que vous devrez vérifier avant sauvegarde.</p></div><button onClick={() => setPersonalizeOpen(false)} className="rounded-xl p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
            <textarea value={personalizeText} onChange={e => setPersonalizeText(e.target.value)} className="mt-5 min-h-64 w-full rounded-2xl border border-slate-300 p-4 text-sm outline-none focus:border-[#bf8813] focus:ring-4 focus:ring-[#bf8813]/10" placeholder={document.doc_type === 'cv' ? 'Métier visé, expériences, études, compétences, réalisations et pays ciblé…' : 'Poste visé, entreprise, expériences, compétences, motivation et informations utiles…'} />
            <div className="mt-5 flex justify-end gap-2"><button onClick={() => setPersonalizeOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold">Annuler</button><button onClick={personalizeWithAi} disabled={!personalizeText.trim() || personalizeLoading} className="inline-flex items-center gap-2 rounded-xl bg-[#002050] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{personalizeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Générer</button></div>
          </div>
        </div>
      )}

      {nameDialogOpen && document && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-semibold text-[#002050]">
              {pendingSaveAction === 'rename' ? 'Renommer le document' : document.doc_type === 'cv' ? 'Nommer votre CV' : 'Nommer votre lettre de motivation'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {pendingSaveAction === null ? 'Choisissez son nom dès maintenant. Aucun brouillon ne sera créé tant que vous ne cliquez pas sur Enregistrer.' : 'Donnez un nom clair pour retrouver facilement ce document dans Omnia Career.'}
            </p>
            <input
              autoFocus
              value={pendingDocumentName}
              onChange={(e) => setPendingDocumentName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && pendingDocumentName.trim()) confirmDocumentName(); }}
              placeholder={document.doc_type === 'cv' ? 'Ex. CV Assistant QSE Luxembourg' : 'Ex. LM Stage QHSE'}
              className="mt-5 h-12 w-full rounded-2xl border border-slate-300 px-4 text-sm outline-none focus:border-[#bf8813] focus:ring-4 focus:ring-[#bf8813]/10"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => { setNameDialogOpen(false); setPendingSaveAction(null); setSaveState('idle'); }} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">Annuler</button>
              <button type="button" disabled={!pendingDocumentName.trim()} onClick={confirmDocumentName} className="rounded-xl bg-[#002050] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{pendingSaveAction === 'rename' ? 'Renommer' : pendingSaveAction === null ? 'Utiliser ce nom' : 'Enregistrer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function getAiTitle(mode: AiSuggestionMode, action: string) {
  if (mode === 'cv_summary') return 'Résumé professionnel amélioré';
  if (mode === 'cv_experience') return 'Expérience reformulée';
  if (mode === 'cv_skills') return 'Compétences suggérées';
  if (mode === 'lm_full') return 'Lettre de motivation générée';
  if (mode === 'lm_section') return 'Lettre améliorée';
  if (action === 'ats_score') return 'Analyse ATS détaillée';
  return 'Suggestion IA';
}

function cleanAiText(text: string) {
  return (text || '')
    .replace(/^```(?:json|text)?/i, '')
    .replace(/```$/i, '')
    .trim();
}

function formatStructuredAiResult(action: string, text: string) {
  const cleaned = cleanAiText(text);
  if (!['adapt_to_offer', 'ats_score'].includes(action)) return cleaned;

  let parsed: Record<string, unknown> | null = null;
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  for (const candidate of [cleaned, first >= 0 && last > first ? cleaned.slice(first, last + 1) : '']) {
    if (!candidate) continue;
    try {
      const value = JSON.parse(candidate);
      if (value && typeof value === 'object' && !Array.isArray(value)) { parsed = value as Record<string, unknown>; break; }
    } catch {}
  }
  if (!parsed) return cleaned;

  const list = (value: unknown) => Array.isArray(value)
    ? value.map(item => String(item || '').trim()).filter(Boolean)
    : [];
  const score = (value: unknown) => {
    const n = Number(value);
    return Number.isFinite(n) ? `${Math.max(0, Math.min(100, Math.round(n)))}/100` : '';
  };
  const section = (title: string, items: string[]) => items.length
    ? `\n${title}\n${items.map(item => `• ${item}`).join('\n')}`
    : '';

  if (action === 'adapt_to_offer') {
    return [
      `Compatibilité avec l’offre : ${score(parsed.score) || 'non calculée'}`,
      section('Mots-clés manquants', list(parsed.missing_keywords)),
      section('Compétences à vérifier / ajouter', list(parsed.skills_to_add)),
      section('Expériences à retravailler', list(parsed.experiences_to_rewrite)),
      section('Recommandations', list(parsed.recommendations)),
      typeof parsed.cover_letter === 'string' && parsed.cover_letter.trim() ? `\nProposition de lettre\n${parsed.cover_letter.trim()}` : '',
    ].filter(Boolean).join('\n');
  }

  const labels: Array<[string, string]> = [
    ['score_global', 'Score global'], ['lisibilite', 'Lisibilité'], ['structure', 'Structure'],
    ['orthographe', 'Orthographe'], ['compatibilite_ats', 'Compatibilité ATS'], ['longueur', 'Longueur'],
    ['mots_cles', 'Mots-clés'], ['professionnalisme', 'Professionnalisme'],
  ];
  const scores = labels.map(([key, label]) => {
    const value = score(parsed?.[key]);
    return value ? `${label} : ${value}` : '';
  }).filter(Boolean);
  return [scores.join('\n'), section('Conseils prioritaires', list(parsed.conseils))].filter(Boolean).join('\n');
}

function splitParagraphs(text: string) {
  return cleanAiText(text)
    .split(/\n{2,}/)
    .map(p => p.replace(/^[-•]\s*/, '').trim())
    .filter(Boolean);
}

function parseAiLines(text: string) {
  return cleanAiText(text)
    .split(/\n|,|;/)
    .map(line => line.replace(/^[-•\d.)\s]+/, '').trim())
    .filter(Boolean)
    .filter((item, index, arr) => arr.findIndex(x => x.toLowerCase() === item.toLowerCase()) === index);
}

function mergeLetterText(data: LmData, text: string): LmData {
  const paragraphs = splitParagraphs(text).filter(p => !/^madame|^monsieur|^objet\s*:/i.test(p));
  return {
    ...data,
    intro: paragraphs[0] || data.intro,
    motivation: paragraphs[1] || data.motivation,
    skills_paragraph: paragraphs[2] || data.skills_paragraph,
    company_link: paragraphs[3] || data.company_link,
    availability: paragraphs[4] || data.availability,
    closing: paragraphs[5] || data.closing,
  };
}

function AiAssistantPanel({
  isCv,
  loadingAction,
  suggestion,
  experiences,
  selectedExperienceId,
  onExperienceChange,
  offerText,
  onOfferTextChange,
  onRequest,
  onApply,
  onDismiss,
}: {
  isCv: boolean;
  experiences: Array<{ id: string; position: string; company: string }>;
  selectedExperienceId: string;
  onExperienceChange: (id: string) => void;
  loadingAction: string | null;
  suggestion: AiSuggestion | null;
  offerText: string;
  onOfferTextChange: (value: string) => void;
  onRequest: (mode: AiSuggestionMode, action: Parameters<typeof runCareerAiAction>[0]['action']) => void;
  onApply: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className={cardClass('p-4')}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[#bf8813]/10 px-3 py-1 text-xs font-bold text-[#bf8813]">
            <Sparkles className="h-3.5 w-3.5" /> IA Omnia Career
          </div>
          <h3 className="mt-3 text-lg font-semibold text-[#002050]">Assistant IA</h3>
          <p className="mt-1 text-sm leading-5 text-slate-600">Les suggestions sont proposées sans remplacer votre contenu. Vous décidez quand les appliquer.</p>
        </div>
      </div>

      {isCv ? (
        <div className="space-y-3">
          <label className="block">
            <span className={labelClass()}>Offre d’emploi ou exigences ciblées</span>
            <textarea className={inputClass('min-h-[92px] resize-y')} placeholder="Collez l’offre pour adapter le CV sans inventer de compétence…" value={offerText} onChange={(e) => onOfferTextChange(e.target.value)} />
          </label>
          <div className="grid grid-cols-1 gap-2">
            <AiButton loading={loadingAction === 'improve_summary'} disabled={Boolean(loadingAction)} label="Améliorer le résumé" onClick={() => onRequest('cv_summary', 'improve_summary')} />
            <label className="block"><span className={labelClass()}>Expérience à reformuler</span>
              <select className={inputClass()} value={experiences.some(e => e.id === selectedExperienceId) ? selectedExperienceId : (experiences[0]?.id || '')} onChange={e => onExperienceChange(e.target.value)}>
                {experiences.length === 0 && <option value="">Ajoutez d'abord une expérience</option>}
                {experiences.map(exp => <option key={exp.id} value={exp.id}>{exp.position || 'Poste sans intitulé'} — {exp.company || 'Entreprise'}</option>)}
              </select>
            </label>
            <AiButton loading={loadingAction === 'rewrite_experience'} disabled={Boolean(loadingAction) || !experiences.length} label="Reformuler l’expérience sélectionnée" onClick={() => onRequest('cv_experience', 'rewrite_experience')} />
            <AiButton loading={loadingAction === 'suggest_skills'} disabled={Boolean(loadingAction)} label="Suggérer des compétences à vérifier" onClick={() => onRequest('cv_skills', 'suggest_skills')} />
            <AiButton loading={loadingAction === 'adapt_to_offer'} disabled={Boolean(loadingAction)} label="Comparer le CV à l’offre" onClick={() => onRequest('analysis', 'adapt_to_offer')} />
            <AiButton loading={loadingAction === 'ats_score'} disabled={Boolean(loadingAction)} label="Analyser ATS" onClick={() => onRequest('analysis', 'ats_score')} subtle />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <label className="block">
            <span className={labelClass()}>Offre d’emploi ou contexte ciblé</span>
            <textarea
              className={inputClass('min-h-[92px] resize-y')}
              placeholder="Collez ici une offre, le nom de l’entreprise, les missions ou les mots-clés à intégrer..."
              value={offerText}
              onChange={(e) => onOfferTextChange(e.target.value)}
            />
          </label>
          <div className="grid grid-cols-1 gap-2">
            <AiButton loading={loadingAction === 'generate_lm'} disabled={Boolean(loadingAction)} label="Générer une lettre complète" onClick={() => onRequest('lm_full', 'generate_lm')} />
            <AiButton loading={loadingAction === 'adapt_to_offer'} disabled={Boolean(loadingAction)} label="Analyser l’adaptation à l’offre" onClick={() => onRequest('analysis', 'adapt_to_offer')} />
            <AiButton loading={loadingAction === 'make_professional'} disabled={Boolean(loadingAction)} label="Rendre plus professionnel" onClick={() => onRequest('lm_section', 'make_professional')} subtle />
            <AiButton loading={loadingAction === 'fix_grammar'} disabled={Boolean(loadingAction)} label="Corriger la langue" onClick={() => onRequest('lm_section', 'fix_grammar')} subtle />
          </div>
        </div>
      )}

      {suggestion && (
        <div className="mt-4 rounded-2xl border border-[#bf8813]/30 bg-[#bf8813]/10 p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-[#002050]">{suggestion.title}</h4>
            <span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-slate-600">
              {suggestion.remote ? 'IA' : 'Local'} · {suggestion.tokensConsumed || 0} jeton
            </span>
          </div>
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-xl bg-white p-3 text-xs leading-5 text-slate-700">{suggestion.text}</pre>
          <div className="mt-3 flex items-center gap-2">
            {suggestion.mode !== 'analysis' && (
              <button type="button" onClick={onApply} className="rounded-xl bg-[#002050] px-3 py-2 text-sm font-semibold text-white hover:opacity-90">
                Accepter et appliquer
              </button>
            )}
            <button type="button" onClick={onDismiss} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              {suggestion.mode === 'analysis' ? 'Fermer' : 'Refuser'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AiButton({ label, loading, disabled, onClick, subtle = false }: { label: string; loading: boolean; disabled: boolean; onClick: () => void; subtle?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={subtle
        ? 'inline-flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-[#002050] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60'
        : 'inline-flex items-center justify-between rounded-xl bg-[#002050] px-3 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60'}
    >
      <span>{label}</span>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
    </button>
  );
}

function EditorPanel({
  isCv,
  cvData,
  lmData,
  activeCvSection,
  activeLmSection,
  onCvSectionChange,
  onLmSectionChange,
  updateCv,
  updateLm,
  score,
  isExampleContent,
}: {
  isCv: boolean;
  cvData: DocData | null;
  lmData: LmData | null;
  activeCvSection: CvSectionKey;
  activeLmSection: LmSectionKey;
  onCvSectionChange: (section: CvSectionKey) => void;
  onLmSectionChange: (section: LmSectionKey) => void;
  updateCv: (mutator: (data: DocData) => DocData) => void;
  updateLm: (mutator: (data: LmData) => LmData) => void;
  score: number;
  isExampleContent: boolean;
}) {
  const sections = isCv ? CV_SECTIONS : LM_SECTIONS;
  const activeSection = isCv ? activeCvSection : activeLmSection;
  const currentData = isCv ? cvData : lmData;

  return (
    <div className="space-y-3">
      <div className={cardClass('p-3')}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-[#002050]">Structure du document</div>
            <div className="mt-1 text-xs text-slate-500">Ouvrez une section, modifiez-la puis passez à la suivante.</div>
          </div>
          <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700">{score}%</span>
        </div>
        {isExampleContent && <div className="mt-3 rounded-xl border border-[#bf8813]/30 bg-[#fff8e8] px-3 py-2 text-xs leading-5 text-slate-600">Les textes affichés sont des exemples. La première modification marque le document comme personnalisé.</div>}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {sections.map(section => {
            const Icon = section.icon;
            const active = activeSection === section.key;
            const complete = currentData
              ? isCv
                ? isCvSectionComplete(section.key as CvSectionKey, currentData as DocData)
                : isLmSectionComplete(section.key as LmSectionKey, currentData as LmData)
              : false;
            return (
              <button
                key={section.key}
                type="button"
                onClick={() => isCv ? onCvSectionChange(section.key as CvSectionKey) : onLmSectionChange(section.key as LmSectionKey)}
                className={`flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition ${active ? 'border-[#002050] bg-[#002050]/5' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-[#002050]' : 'text-slate-400'}`} />
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-700">{section.label}</span>
                {complete ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600" /> : <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-slate-300" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className={cardClass('p-4')}>
        <div className="mb-4">
          <h3 className="text-base font-semibold text-[#002050]">{sections.find(section => section.key === activeSection)?.label || 'Modifier la section'}</h3>
          <p className="mt-1 text-xs text-slate-500">{sections.find(section => section.key === activeSection)?.subtitle}</p>
        </div>
        {isCv && cvData ? <CvSectionEditor active={activeCvSection} data={cvData} update={updateCv} /> : null}
        {!isCv && lmData ? <LmSectionEditor active={activeLmSection} data={lmData} update={updateLm} /> : null}
      </div>
    </div>
  );
}

function CvSectionEditor({ active, data, update }: { active: CvSectionKey; data: DocData; update: (mutator: (data: DocData) => DocData) => void }) {
  const nativeApp = isNativeApp();
  if (active === 'profile') {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {data.photo_url ? <img src={data.photo_url} alt="Photo du CV" className="h-full w-full object-cover" style={{ objectPosition: `${data.photo_position_x ?? 50}% ${data.photo_position_y ?? 50}%`, transform: `scale(${Math.max(1, data.photo_zoom ?? 1)})`, transformOrigin: `${data.photo_position_x ?? 50}% ${data.photo_position_y ?? 50}%` }} /> : <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">Photo</div>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-[#002050]">Photo du CV</div>
              <div className="mt-1 text-xs leading-5 text-slate-500">Photo facultative : après ajout, elle apparaît sur le CV. Vous pouvez aussi la masquer dans Personnalisation, sans perdre l’image.</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <label className="cursor-pointer rounded-xl bg-[#002050] px-3 py-2 text-xs font-semibold text-white">
                  {data.photo_url ? 'Remplacer' : 'Ajouter une photo'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
                        window.alert('Format non accepté. Utilisez une image JPG, PNG ou WebP.');
                        event.currentTarget.value = '';
                        return;
                      }
                      if (file.size > 2 * 1024 * 1024) {
                        window.alert('Cette photo dépasse 2 Mo. Compressez-la avant de l’ajouter.');
                        event.currentTarget.value = '';
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () => update(d => ({ ...d, photo_url: String(reader.result || '') }));
                      reader.readAsDataURL(file);
                      event.currentTarget.value = '';
                    }}
                  />
                </label>
                {nativeApp && <button
                  type="button"
                  onClick={async () => {
                    try {
                      const photo = await pickNativeImageAsDataUrl({ source: 'camera', quality: 82, width: 1200 });
                      if (!photo) return;
                      if (approximateDataUrlBytes(photo) > 2 * 1024 * 1024) {
                        window.alert('Cette photo dépasse 2 Mo. Reprenez-la avec une résolution plus faible.');
                        return;
                      }
                      update(d => ({ ...d, photo_url: photo }));
                    } catch (error) {
                      window.alert(error instanceof Error ? error.message : 'Impossible d’utiliser la caméra.');
                    }
                  }}
                  className="rounded-xl border border-[#002050] px-3 py-2 text-xs font-semibold text-[#002050]"
                >
                  Prendre une photo
                </button>}
                {data.photo_url && <button type="button" onClick={() => update(d => ({ ...d, photo_url: '', photo_zoom: 1, photo_position_x: 50, photo_position_y: 50 }))} className="rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600">Supprimer</button>}
              </div>
            </div>
          </div>
          {data.photo_url && <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 md:grid-cols-3">
            <label className="text-xs font-semibold text-slate-600">Zoom photo
              <input type="range" min={1} max={3} step={0.05} value={data.photo_zoom ?? 1} onChange={e => update(d => ({ ...d, photo_zoom: Number(e.target.value) }))} className="mt-2 w-full" />
            </label>
            <label className="text-xs font-semibold text-slate-600">Position horizontale
              <input type="range" min={0} max={100} value={data.photo_position_x ?? 50} onChange={e => update(d => ({ ...d, photo_position_x: Number(e.target.value) }))} className="mt-2 w-full" />
            </label>
            <label className="text-xs font-semibold text-slate-600">Position verticale
              <input type="range" min={0} max={100} value={data.photo_position_y ?? 50} onChange={e => update(d => ({ ...d, photo_position_y: Number(e.target.value) }))} className="mt-2 w-full" />
            </label>
          </div>}
        </div>
        <Field label="Nom complet" value={data.name} onChange={v => update(d => ({ ...d, name: v }))} />
        <Field label="Titre professionnel" value={data.title} onChange={v => update(d => ({ ...d, title: v }))} />
        <Field label="Email" value={data.contact.email} onChange={v => update(d => ({ ...d, contact: { ...d.contact, email: v } }))} />
        <Field label="Téléphone" value={data.contact.phone} onChange={v => update(d => ({ ...d, contact: { ...d.contact, phone: v } }))} />
        <Field label="Ville / Pays" value={data.contact.location} onChange={v => update(d => ({ ...d, contact: { ...d.contact, location: v } }))} />
        <Field label="LinkedIn" value={data.contact.linkedin || ''} onChange={v => update(d => ({ ...d, contact: { ...d.contact, linkedin: v } }))} />
        <Field label="Portfolio / site professionnel" value={data.contact.portfolio || ''} onChange={v => update(d => ({ ...d, contact: { ...d.contact, portfolio: v } }))} />
      </div>
    );
  }

  if (active === 'summary') {
    return <div className="space-y-3"><Field label="Objectif professionnel facultatif" value={data.objective || ''} onChange={v => update(d => ({ ...d, objective: v }))} /><TextArea label="Résumé professionnel" value={data.summary} rows={8} onChange={v => update(d => ({ ...d, summary: v }))} /></div>;
  }

  if (active === 'skills') {
    return (
      <ListEditor
        title="Compétences"
        addLabel="Ajouter une compétence"
        items={data.skills}
        render={(item, remove) => (
          <div className="flex items-center gap-2">
            <input className={inputClass('flex-1')} value={item.name} onChange={e => update(d => ({ ...d, skills: d.skills.map(s => s.id === item.id ? { ...s, name: e.target.value } : s) }))} />
            <input type="range" min={0} max={100} value={item.level} className="w-20" style={{ accentColor: BLUE }} onChange={e => update(d => ({ ...d, skills: d.skills.map(s => s.id === item.id ? { ...s, level: Number(e.target.value) } : s) }))} />
            <span className="w-8 text-right text-xs text-slate-500">{item.level}%</span>
            {remove}
          </div>
        )}
        onAdd={() => update(d => ({ ...d, skills: [...d.skills, { id: uid('sk'), name: 'Nouvelle compétence', level: 70 }] }))}
        onRemove={id => update(d => ({ ...d, skills: d.skills.filter(s => s.id !== id) }))}
        onMove={(id, direction) => update(d => ({ ...d, skills: moveCareerEntry(d.skills, id, direction) }))}
      />
    );
  }

  if (active === 'experiences') {
    return (
      <ListEditor
        title="Expériences"
        addLabel="Ajouter une expérience"
        items={data.experiences}
        render={(item, remove) => (
          <div className="space-y-2 rounded-xl border border-slate-200 p-3">
            <div className="flex justify-end">{remove}</div>
            <Field label="Poste" value={item.position} onChange={v => update(d => ({ ...d, experiences: d.experiences.map(x => x.id === item.id ? { ...x, position: v } : x) }))} />
            <Field label="Entreprise" value={item.company} onChange={v => update(d => ({ ...d, experiences: d.experiences.map(x => x.id === item.id ? { ...x, company: v } : x) }))} />
            <Field label="Lieu" value={item.location || ''} onChange={v => update(d => ({ ...d, experiences: d.experiences.map(x => x.id === item.id ? { ...x, location: v } : x) }))} />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Début" value={item.start_date} onChange={v => update(d => ({ ...d, experiences: d.experiences.map(x => x.id === item.id ? { ...x, start_date: v } : x) }))} />
              <Field label="Fin" value={item.end_date || ''} onChange={v => update(d => ({ ...d, experiences: d.experiences.map(x => x.id === item.id ? { ...x, end_date: v } : x) }))} />
            </div>
            <TextArea label="Description" rows={4} value={item.description} onChange={v => update(d => ({ ...d, experiences: d.experiences.map(x => x.id === item.id ? { ...x, description: v } : x) }))} />
          </div>
        )}
        onAdd={() => update(d => ({ ...d, experiences: [...d.experiences, { id: uid('exp'), position: 'Nouveau poste', company: 'Entreprise', start_date: '2025-01', current: false, description: '' }] }))}
        onRemove={id => update(d => ({ ...d, experiences: d.experiences.filter(x => x.id !== id) }))}
        onMove={(id, direction) => update(d => ({ ...d, experiences: moveCareerEntry(d.experiences, id, direction) }))}
      />
    );
  }

  if (active === 'education') {
    return <SimpleRows title="Formation" items={data.education} fields={[['degree', 'Diplôme'], ['school', 'École'], ['year', 'Année']]} onAdd={() => update(d => ({ ...d, education: [...d.education, { id: uid('edu'), degree: 'Nouveau diplôme', school: 'École', year: '2025' }] }))} onRemove={id => update(d => ({ ...d, education: d.education.filter(x => x.id !== id) }))} onMove={(id, direction) => update(d => ({ ...d, education: moveCareerEntry(d.education, id, direction) }))} onChange={(id, field, value) => update(d => ({ ...d, education: d.education.map(x => x.id === id ? { ...x, [field]: value } : x) }))} />;
  }

  if (active === 'certifications') {
    return <SimpleRows title="Certifications" items={data.certifications_external} fields={[['name', 'Certification'], ['issuer', 'Organisme'], ['year', 'Année']]} onAdd={() => update(d => ({ ...d, certifications_external: [...d.certifications_external, { id: uid('cert'), name: 'Nouvelle certification', issuer: 'Organisme', year: '2025' }] }))} onRemove={id => update(d => ({ ...d, certifications_external: d.certifications_external.filter(x => x.id !== id) }))} onMove={(id, direction) => update(d => ({ ...d, certifications_external: moveCareerEntry(d.certifications_external, id, direction) }))} onChange={(id, field, value) => update(d => ({ ...d, certifications_external: d.certifications_external.map(x => x.id === id ? { ...x, [field]: value } : x) }))} />;
  }

  if (active === 'languages') {
    return <SimpleRows title="Langues" items={data.languages} fields={[['name', 'Langue'], ['level', 'Niveau']]} onAdd={() => update(d => ({ ...d, languages: [...d.languages, { id: uid('lang'), name: 'Anglais', level: 'Intermédiaire' }] }))} onRemove={id => update(d => ({ ...d, languages: d.languages.filter(x => x.id !== id) }))} onMove={(id, direction) => update(d => ({ ...d, languages: moveCareerEntry(d.languages, id, direction) }))} onChange={(id, field, value) => update(d => ({ ...d, languages: d.languages.map(x => x.id === id ? { ...x, [field]: value } : x) }))} />;
  }

  if (active === 'projects') {
    return <SimpleRows title="Projets" items={data.projects} fields={[['name', 'Nom'], ['description', 'Description'], ['technologies', 'Technologies']]} onAdd={() => update(d => ({ ...d, projects: [...d.projects, { id: uid('proj'), name: 'Nouveau projet', description: '', technologies: '' }] }))} onRemove={id => update(d => ({ ...d, projects: d.projects.filter(x => x.id !== id) }))} onMove={(id, direction) => update(d => ({ ...d, projects: moveCareerEntry(d.projects, id, direction) }))} onChange={(id, field, value) => update(d => ({ ...d, projects: d.projects.map(x => x.id === id ? { ...x, [field]: value } : x) }))} />;
  }

  return <TextArea label="Centres d’intérêt" rows={5} value={(data.interests || []).join(', ')} onChange={v => update(d => ({ ...d, interests: v.split(',').map(x => x.trim()).filter(Boolean) }))} />;
}

function LmSectionEditor({ active, data, update }: { active: LmSectionKey; data: LmData; update: (mutator: (data: LmData) => LmData) => void }) {
  if (active === 'sender') {
    return (
      <div className="space-y-3">
        <Field label="Nom complet" value={data.sender.name} onChange={v => update(d => ({ ...d, sender: { ...d.sender, name: v }, signature: v }))} />
        <Field label="Adresse" value={data.sender.address} onChange={v => update(d => ({ ...d, sender: { ...d.sender, address: v } }))} />
        <Field label="Téléphone" value={data.sender.phone} onChange={v => update(d => ({ ...d, sender: { ...d.sender, phone: v } }))} />
        <Field label="Email" value={data.sender.email} onChange={v => update(d => ({ ...d, sender: { ...d.sender, email: v } }))} />
        <Field label="Ville" value={data.sender.city} onChange={v => update(d => ({ ...d, sender: { ...d.sender, city: v } }))} />
        <Field label="Date" value={data.sender.date} onChange={v => update(d => ({ ...d, sender: { ...d.sender, date: v } }))} />
      </div>
    );
  }

  if (active === 'recipient') {
    return (
      <div className="space-y-3">
        <Field label="Nom du recruteur" value={data.recipient.name} onChange={v => update(d => ({ ...d, recipient: { ...d.recipient, name: v } }))} />
        <Field label="Entreprise" value={data.recipient.company} onChange={v => update(d => ({ ...d, recipient: { ...d.recipient, company: v } }))} />
        <TextArea label="Adresse de l’entreprise" value={data.recipient.address} rows={3} onChange={v => update(d => ({ ...d, recipient: { ...d.recipient, address: v } }))} />
      </div>
    );
  }

  if (active === 'variables') {
    return (
      <div className="space-y-3">
        <Field label="Objet" value={data.subject} onChange={v => update(d => ({ ...d, subject: v }))} />
        <Field label="Formule d’appel" value={data.salutation} onChange={v => update(d => ({ ...d, salutation: v }))} />
        <Field label="Signature" value={data.signature} onChange={v => update(d => ({ ...d, signature: v }))} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Field label="Objet" value={data.subject} onChange={v => update(d => ({ ...d, subject: v }))} />
      <Field label="Formule d’appel" value={data.salutation} onChange={v => update(d => ({ ...d, salutation: v }))} />
      <TextArea label="Introduction" value={data.intro} rows={4} onChange={v => update(d => ({ ...d, intro: v }))} />
      <TextArea label="Motivation" value={data.motivation} rows={4} onChange={v => update(d => ({ ...d, motivation: v }))} />
      <TextArea label="Compétences clés" value={data.skills_paragraph} rows={4} onChange={v => update(d => ({ ...d, skills_paragraph: v }))} />
      <TextArea label="Lien avec l’entreprise" value={data.company_link} rows={4} onChange={v => update(d => ({ ...d, company_link: v }))} />
      <TextArea label="Disponibilité" value={data.availability} rows={3} onChange={v => update(d => ({ ...d, availability: v }))} />
      <TextArea label="Conclusion" value={data.closing} rows={4} onChange={v => update(d => ({ ...d, closing: v }))} />
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className={labelClass()}>{label}</span>
      <input className={inputClass()} value={value || ''} onChange={e => onChange(e.target.value)} />
    </label>
  );
}

function TextArea({ label, value, rows, onChange }: { label: string; value: string; rows: number; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className={labelClass()}>{label}</span>
      <textarea className={inputClass('resize-y')} rows={rows} value={value || ''} onChange={e => onChange(e.target.value)} />
    </label>
  );
}

function ListEditor<T extends { id: string }>({ title, addLabel, items, render, onAdd, onRemove, onMove }: { title: string; addLabel: string; items: T[]; render: (item: T, actions: React.ReactNode) => React.ReactNode; onAdd: () => void; onRemove: (id: string) => void; onMove?: (id: string, direction: -1 | 1) => void }) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-[#002050]">{title}</h4>
        <button onClick={onAdd} className="inline-flex items-center gap-1 rounded-lg bg-[#002050] px-3 py-1.5 text-xs font-semibold text-white">
          <Plus className="h-3 w-3" /> {addLabel}
        </button>
      </div>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={item.id}>{render(item, <div className="flex items-center gap-1" aria-label="Actions de la rubrique">
            {onMove && <>
              <button type="button" onClick={() => onMove(item.id, -1)} disabled={index === 0} title="Monter" aria-label="Monter cette entrée" className="rounded-lg p-2 text-[#002050] hover:bg-slate-50 disabled:opacity-25"><ArrowUp className="h-4 w-4" /></button>
              <button type="button" onClick={() => onMove(item.id, 1)} disabled={index === items.length - 1} title="Descendre" aria-label="Descendre cette entrée" className="rounded-lg p-2 text-[#002050] hover:bg-slate-50 disabled:opacity-25"><ArrowDown className="h-4 w-4" /></button>
            </>}
            <button type="button" onClick={() => onRemove(item.id)} title="Supprimer" aria-label="Supprimer cette entrée" className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
          </div>)}</div>
        ))}
      </div>
    </div>
  );
}

function SimpleRows<T extends { id: string }>({ title, items, fields, onAdd, onRemove, onChange, onMove }: { title: string; items: T[]; fields: Array<[keyof T & string, string]>; onAdd: () => void; onRemove: (id: string) => void; onChange: (id: string, field: keyof T & string, value: string) => void; onMove?: (id: string, direction: -1 | 1) => void }) {
  return (
    <ListEditor
      title={title}
      addLabel="Ajouter"
      items={items}
      onAdd={onAdd}
      onRemove={onRemove}
      onMove={onMove}
      render={(item, remove) => (
        <div className="space-y-2 rounded-xl border border-slate-200 p-3">
          <div className="flex justify-end">{remove}</div>
          {fields.map(([field, label]) => (
            <Field key={field} label={label} value={String((item as any)[field] || '')} onChange={v => onChange(item.id, field, v)} />
          ))}
        </div>
      )}
    />
  );
}

function TemplatePanel({
  docType,
  templates,
  selectedTemplate,
  selectedKey,
  data,
  design,
  onSelect,
}: {
  docType: CareerDocType;
  templates: CareerTemplateMeta[];
  selectedTemplate: CareerTemplateMeta;
  selectedKey: string;
  data: DocData | LmData;
  design: DesignOptions | LmDesign;
  onSelect: (key: string) => void;
}) {
  const canonicalTemplates = templates.length ? templates : getCareerTemplates(docType);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'free' | 'premium' | 'ats'>('all');

  const filteredTemplates = canonicalTemplates
    .filter(t => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return `${t.name_fr} ${t.description_fr} ${t.category}`.toLowerCase().includes(q);
    })
    .filter(t => {
      if (filter === 'free') return t.is_free;
      if (filter === 'premium') return !t.is_free;
      if (filter === 'ats') return t.is_ats_compatible;
      return true;
    });

  return (
    <div className={cardClass('p-4')}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-[#002050]">Modèles</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {selectedTemplate?.name_fr || 'Modèle sélectionné'} est appliqué à l’aperçu live et au PDF.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setGalleryOpen(true)}
          className="rounded-xl bg-[#002050] px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
        >
          Voir en grand
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {canonicalTemplates.slice(0, 3).map(template => (
          <TemplatePreviewCard
            key={template.template_key}
            template={template}
            docType={docType}
            data={data}
            design={design}
            selected={template.template_key === selectedKey}
            onSelect={() => onSelect(template.template_key)}
            compact
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => setGalleryOpen(true)}
        className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-[#002050] hover:bg-slate-50"
      >
        Ouvrir la galerie complète ({canonicalTemplates.length})
      </button>

      {galleryOpen && (
        <div className="fixed inset-0 z-[80] bg-slate-950/70 p-4 backdrop-blur-sm md:p-8">
          <div className="mx-auto flex h-full max-w-7xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-[#002050]">
                  {docType === 'cv' ? 'Choisir un modèle de CV' : 'Choisir un modèle de lettre'}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Sélectionnez un modèle : il sera appliqué immédiatement dans l’éditeur, l’aperçu plein écran et le PDF.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setGalleryOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
                aria-label="Fermer la galerie"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex h-11 w-full max-w-md items-center rounded-2xl border border-slate-200 bg-white px-3">
                <Search className="mr-2 h-4 w-4 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Rechercher un modèle..."
                  className="h-full flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-slate-400"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  ['all', 'Tous'],
                  ['free', 'Accessibles'],
                  ['premium', 'Premium'],
                  ['ats', 'ATS'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key as typeof filter)}
                    className={`rounded-full px-4 py-2 text-xs font-bold transition ${filter === key ? 'bg-[#002050] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-5">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
                {filteredTemplates.map(template => (
                  <TemplatePreviewCard
                    key={template.template_key}
                    template={template}
                    docType={docType}
                    data={data}
                    design={design}
                    selected={template.template_key === selectedKey}
                    onSelect={() => {
                      onSelect(template.template_key);
                      setGalleryOpen(false);
                    }}
                  />
                ))}
              </div>
              {!filteredTemplates.length && (
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                  Aucun modèle trouvé pour cette recherche.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/**
 * Chaque modèle dispose de sa propre maquette découpée depuis les planches
 * validées par l'administrateur. La clé du fichier est exactement la même
 * que template_key, ce qui empêche tout décalage entre la galerie, le
 * renderer HTML/CSS, l'aperçu plein écran et l'export PDF.
 */
function getTemplateMockup(template: CareerTemplateMeta, _docType: CareerDocType) {
  return template.thumbnail_url || (template.is_custom ? '/career-templates/generated/custom.svg' : `/career-templates/generated/${template.template_key}.svg`);
}

function TemplatePreviewCard({
  template,
  docType,
  data,
  design,
  selected,
  onSelect,
  compact = false,
}: {
  template: CareerTemplateMeta;
  docType: CareerDocType;
  data: DocData | LmData;
  design: DesignOptions | LmDesign;
  selected: boolean;
  onSelect: () => void;
  compact?: boolean;
}) {
  return <TemplateLiveCard template={template} docType={docType} selected={selected} onClick={onSelect} compact={compact} data={data} documentDesign={design} />;
}
