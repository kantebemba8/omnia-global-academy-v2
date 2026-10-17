import { openInternalPreviewUrl } from '../../lib/mobile';
import MobileBuilderAdvice from '../../components/MobileBuilderAdvice';
import { Component, useState, useEffect, useCallback, useRef, type ReactNode, type ClipboardEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AssessmentPolicyPanel } from '../../components/AssessmentPolicyPanel';
import { edgeAuthHeaders } from '../../lib/edgeAuth';
import { COURSE_LANGUAGE_OPTIONS, COURSE_LEVEL_OPTIONS, BLOCK_SEARCH_ALIASES, ESSENTIAL_BLOCK_TYPES, TRAINING_CAPABLE_BLOCKS, ASSESSMENT_CAPABLE_BLOCKS, canonicalizeBlockContent, emptyBlockContent } from '../../lib/courseBuilderV3';
import StudioCommercialCertificationPanel from '../../components/StudioCommercialCertificationPanel';
import StudioQualityStatusPanel from '../../components/StudioQualityStatusPanel';
import CourseAdvancedSettingsPanel from '../../components/CourseAdvancedSettingsPanel';
import BuilderImportDialog from '../../components/studio/BuilderImportDialog';
import { STUDIO_MEDIA_POLICY, checkStudioMediaFile, type StudioMediaKind } from '../../lib/studioMediaPolicy';
import { CATEGORY_LABELS } from '../../lib/categories';
import { LessonBlocksRenderer } from '../../components/BlockRenderer';
import {
  ChevronLeft, ChevronRight, Save, Eye, EyeOff, Send, History,
  Plus, Trash2, Copy, GripVertical, Settings, Sparkles, X, Check,
  AlertCircle, CheckCircle, Clock, FileText, Image, Video, Music,
  File, Table, HelpCircle, BookOpen, Lightbulb, Star, Minus,
  AlignLeft, Heading1, Heading2, Download, Layers, ToggleLeft,
  ChevronDown, ChevronUp, Zap, AlertTriangle, Info, BarChart2, ShieldCheck, Monitor, Users, UserCheck,
  Layout, RefreshCw, MoreVertical, Move, List, ListOrdered, Quote, Code2, CheckSquare, Link2, GalleryHorizontal, Sigma, BarChart3, UploadCloud, ClipboardCheck, Headphones
} from 'lucide-react';

const SB = import.meta.env.VITE_SUPABASE_URL;
const API = `${SB}/functions/v1/studio-unified`;

// ─── Types ────────────────────────────────────────────────────
interface Block {
  id: string;
  block_type: string;
  interaction_mode?: 'content'|'training'|'assessment';
  assessment_scope?: 'lesson'|'module'|'final'|null;
  is_required?: boolean;
  training_passing_score?: number;
  training_is_graded?: boolean;
  rubric_block_ids?: string[];
  correction_block_ids?: string[];
  linked_block_ids?: string[];
  rag_enabled?: boolean;
  preview_allowed?: boolean;
  position: number;
  title?: string;
  content_json: Record<string, any>;
  settings_json: Record<string, any>;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  file_mime?: string;
  source_type?: string;
  ai_generated?: boolean;
}

interface Lesson { id: string; title: string; position: number; has_blocks: boolean; block_count: number; is_required?: boolean; is_intro?: boolean; is_module_intro?: boolean; is_conclusion?: boolean; is_final_exam?: boolean; is_free_preview?: boolean; stage_type?: 'introduction'|'module_presentation'|'lesson'|'module_summary'|'conclusion'|'final_exam'; }
interface Module { id: string; title: string; objective: string; position: number; lessons: Lesson[]; is_required?: boolean; is_intro?: boolean; is_conclusion?: boolean; is_final_exam?: boolean; section_type?: 'introduction'|'module'|'conclusion'|'final_exam'; }
interface Course {
  id: string; course_code?: string; title: string; short_description?: string; long_description?: string;
  category?: string; level?: string; language?: string; course_type?: 'standard'|'language_learning'; instruction_language?: string; target_language?: string; cefr_start_level?: string; cefr_target_level?: string; language_framework?: string; prerequisites?: string;
  objectives?: string[]; cover_image_url?: string; cover_image_prompt?: string;
  target_audience?: string; learning_outcomes?: string[]; course_intro_title?: string;
  course_intro_summary?: string; studio_status: string;
  studio_mode?: string; word_count?: number; estimated_read_min?: number; calculated_duration_minutes?: number;
  last_autosave_at?: string; admin_comment?: string; template_used?: string;
  sale_mode?: 'free'|'paid'; desired_price_amount?: number|string; sale_currency?: string; promotion_price_amount?: number|string;
  certificate_mode?: 'omnia'|'external'|'none';
  structure_payment_mode?: string; structure_fixed_amount?: number|string; is_assisted?: boolean; assisted_status?: string; assisted_request_id?: string; certification_requested?: boolean;
  free_preview_mode?: 'none'|'introduction'|'introduction_first_lesson'; quality_status?: string; ready_to_submit?: boolean; current_version?: string;
  pricing_status?: string; lesson_passing_score?: number; module_passing_score?: number; final_passing_score?: number; learning_design_settings?: Record<string, any>; assessment_policy?: Record<string, any>;
  builder_version?: 'v2'|'v3'; is_catalog_active?: boolean; cover_ai_generation_count?: number; preview_first_lesson_enabled?: boolean;
}

const EMPTY_COURSE: Course = {
  id: '',
  course_code: '',
  title: '',
  short_description: '',
  long_description: '',
  category: '',
  level: '',
  language: 'fr',
  course_type: 'standard',
  instruction_language: 'fr',
  target_language: '',
  cefr_start_level: '',
  cefr_target_level: '',
  language_framework: 'CEFR',
  prerequisites: '',
  objectives: [],
  cover_image_url: '',
  cover_image_prompt: '',
  target_audience: '',
  learning_outcomes: [],
  course_intro_title: '',
  course_intro_summary: '',
  studio_status: 'draft',
  studio_mode: 'simple',
  template_used: 'simple_textual',
  sale_mode: 'paid',
  sale_currency: 'XOF',
  desired_price_amount: '',
  promotion_price_amount: '',
  structure_payment_mode: 'free',
  structure_fixed_amount: '',
  is_assisted: false,
  certification_requested: false,
  free_preview_mode: 'introduction',
  quality_status: 'incomplete',
  ready_to_submit: false,
  current_version: '1.0',
  builder_version: 'v3',
  is_catalog_active: true,
  cover_ai_generation_count: 0,
  preview_first_lesson_enabled: true,
  lesson_passing_score: 80,
  module_passing_score: 80,
  final_passing_score: 70,
};

// ─── Config blocs ─────────────────────────────────────────────
const BLOCK_DEFS = [
  // Simples
  { type: 'heading',    label: 'Titre',        icon: Heading1,   color: '#002050', group: 'structure',   mode: 'simple' },
  { type: 'subheading', label: 'Titre secondaire',   icon: Heading2,   color: '#374151', group: 'structure',   mode: 'simple' },
  { type: 'text',       label: 'Texte',        icon: AlignLeft,  color: '#374151', group: 'structure',   mode: 'simple' },
  { type: 'separator',  label: 'Séparateur',   icon: Minus,      color: '#9CA3AF', group: 'structure',   mode: 'simple' },
  { type: 'callout',    label: 'Encadré',      icon: Info,       color: '#0369A1', group: 'structure',   mode: 'simple' },
  { type: 'remember',   label: 'À retenir',    icon: Star,       color: '#BF8813', group: 'pedagogique', mode: 'simple' },
  { type: 'objective',  label: 'Objectif',     icon: CheckCircle,color: '#1E7A52', group: 'pedagogique', mode: 'simple' },
  { type: 'example',    label: 'Exemple',      icon: Lightbulb,  color: '#D97706', group: 'pedagogique', mode: 'simple' },
  { type: 'summary',    label: 'Résumé',       icon: BookOpen,   color: '#7C3AED', group: 'pedagogique', mode: 'simple' },
  { type: 'image',      label: 'Image',        icon: Image,      color: '#0891B2', group: 'media',       mode: 'simple' },
  { type: 'video',      label: 'Vidéo',        icon: Video,      color: '#DC2626', group: 'media',       mode: 'simple' },
  { type: 'audio',      label: 'Audio',        icon: Music,      color: '#7C3AED', group: 'media',       mode: 'simple' },
  { type: 'pdf',        label: 'PDF',          icon: FileText,   color: '#DC2626', group: 'media',       mode: 'simple' },
  { type: 'word',       label: 'Word',         icon: FileText,   color: '#1D4ED8', group: 'media',       mode: 'simple' },
  { type: 'excel',      label: 'Excel',        icon: Table,      color: '#1E7A52', group: 'media',       mode: 'simple' },
  { type: 'scorm',      label: 'SCORM ZIP',    icon: Layers,     color: '#92400E', group: 'media',       mode: 'simple' },
  { type: 'download',   label: 'Téléchargement', icon: Download, color: '#374151', group: 'media',       mode: 'simple' },
  { type: 'qcm',        label: 'QCM',          icon: HelpCircle, color: '#002050', group: 'evaluation',  mode: 'simple' },
  { type: 'true_false', label: 'Vrai / Faux',  icon: ToggleLeft, color: '#1E7A52', group: 'evaluation',  mode: 'simple' },
  { type: 'open_question', label: 'Question ouverte', icon: AlignLeft, color: '#7C3AED', group: 'evaluation', mode: 'simple' },
  { type: 'exercise',   label: 'Exercice',     icon: BookOpen,   color: '#D97706', group: 'evaluation',  mode: 'simple' },
  { type: 'bullet_list', label: 'Liste à puces', icon: List, color: '#374151', group: 'structure', mode: 'simple' },
  { type: 'numbered_list', label: 'Liste numérotée', icon: ListOrdered, color: '#374151', group: 'structure', mode: 'simple' },
  { type: 'quote', label: 'Citation', icon: Quote, color: '#7C3AED', group: 'pedagogique', mode: 'simple' },
  { type: 'checklist', label: 'Checklist', icon: CheckSquare, color: '#1E7A52', group: 'pedagogique', mode: 'simple' },
  { type: 'link_button', label: 'Bouton / lien', icon: Link2, color: '#0369A1', group: 'media', mode: 'simple' },
  // Avancés
  { type: 'accordion',  label: 'Accordéon',    icon: ChevronDown,color: '#374151', group: 'avance',      mode: 'advanced' },
  { type: 'flashcards', label: 'Cartes',       icon: Copy,       color: '#7C3AED', group: 'avance',      mode: 'advanced' },
  { type: 'interactive_table', label: 'Tableau interactif', icon: Table, color: '#0369A1', group: 'avance', mode: 'advanced' },
  { type: 'timeline',   label: 'Timeline',     icon: BarChart2,  color: '#D97706', group: 'avance',      mode: 'advanced' },
  { type: 'columns',    label: 'Colonnes',     icon: Layout,     color: '#374151', group: 'avance',      mode: 'advanced' },
  { type: 'important',  label: 'Important',    icon: AlertTriangle, color: '#DC2626', group: 'avance',   mode: 'advanced' },
  { type: 'case_study', label: 'Étude de cas', icon: BookOpen,   color: '#002050', group: 'avance',      mode: 'advanced' },
  { type: 'definition', label: 'Définition',   icon: AlignLeft,  color: '#374151', group: 'avance',      mode: 'advanced' },
  { type: 'correction', label: 'Correction',   icon: CheckCircle,color: '#1E7A52', group: 'avance',      mode: 'advanced' },
  { type: 'code', label: 'Code', icon: Code2, color: '#111827', group: 'avance', mode: 'advanced' },
  { type: 'embed', label: 'Contenu intégré', icon: Link2, color: '#0369A1', group: 'avance', mode: 'advanced' },
  { type: 'gallery', label: 'Galerie', icon: GalleryHorizontal, color: '#0891B2', group: 'avance', mode: 'advanced' },
  { type: 'formula', label: 'Formule', icon: Sigma, color: '#7C3AED', group: 'avance', mode: 'advanced' },
  { type: 'chart', label: 'Graphique', icon: BarChart3, color: '#0369A1', group: 'avance', mode: 'advanced' },
  { type: 'assignment_upload', label: 'Travail à remettre', icon: UploadCloud, color: '#D97706', group: 'evaluation', mode: 'advanced' },
  { type: 'rubric', label: 'Grille d’évaluation', icon: ClipboardCheck, color: '#1E7A52', group: 'evaluation', mode: 'advanced' },
  { type: 'vocabulary', label: 'Vocabulaire', icon: BookOpen, color: '#7C3AED', group: 'langues', mode: 'advanced' },
  { type: 'dialogue', label: 'Dialogue', icon: Users, color: '#0369A1', group: 'langues', mode: 'advanced' },
  { type: 'cloze', label: 'Texte à trous', icon: AlignLeft, color: '#D97706', group: 'langues', mode: 'advanced' },
  { type: 'dictation', label: 'Dictée', icon: Music, color: '#DC2626', group: 'langues', mode: 'advanced' },
  { type: 'pronunciation', label: 'Prononciation', icon: Monitor, color: '#1E7A52', group: 'langues', mode: 'advanced' },
  { type: 'matching', label: 'Association', icon: Layers, color: '#92400E', group: 'langues', mode: 'advanced' },
  { type: 'sentence_order', label: 'Phrase en ordre', icon: ListOrdered, color: '#374151', group: 'langues', mode: 'advanced' },
  { type: 'oral_response', label: 'Réponse orale', icon: Music, color: '#7C3AED', group: 'langues', mode: 'advanced' },
  { type: 'listening_comprehension', label: 'Compréhension orale', icon: Headphones, color: '#0369A1', group: 'langues', mode: 'advanced' },
  { type: 'written_expression', label: 'Expression écrite', icon: FileText, color: '#002050', group: 'langues', mode: 'advanced' },
];

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  draft:              { label: 'Brouillon',              color: '#6B7280', bg: '#F3F4F6', dot: '#9CA3AF' },
  pending_validation: { label: 'En attente',             color: '#92400E', bg: '#FEF3C7', dot: '#D97706' },
  changes_requested:  { label: 'Modification demandée',  color: '#1D4ED8', bg: '#EFF6FF', dot: '#3B82F6' },
  rejected:           { label: 'Refusée',                color: '#991B1B', bg: '#FEE2E2', dot: '#DC2626' },
  validated:          { label: 'Validée',                color: '#065F46', bg: '#D1FAE5', dot: '#10B981' },
  published:          { label: 'Publiée',                color: '#065F46', bg: '#D1FAE5', dot: '#10B981' },
  archived:           { label: 'Archivée',               color: '#374151', bg: '#F3F4F6', dot: '#6B7280' },
  suspended:          { label: 'Suspendue',              color: '#991B1B', bg: '#FEE2E2', dot: '#DC2626' },
};

function uid() { return Math.random().toString(36).slice(2, 10); }
function normalizeCourseCode(value: string) { return value.toUpperCase().replace(/[^A-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32); }
async function api(action: string, body: Record<string, any> = {}) {
  const res = await fetch(API, {
    method: 'POST',
    headers: edgeAuthHeaders(),
    body: JSON.stringify({ action, ...body }),
  });
  const data = await res.json().catch(() => ({ success: false, error: `HTTP_${res.status}` }));
  if (!res.ok && !data.error) data.error = `HTTP_${res.status}`;
  return data;
}

class BuilderBlockBoundary extends Component<{ children: ReactNode; blockType: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { console.error('Builder block render error', this.props.blockType, error); }
  componentDidUpdate(prevProps: { blockType: string }) {
    if (prevProps.blockType !== this.props.blockType && this.state.failed) this.setState({ failed: false });
  }
  render() {
    if (this.state.failed) return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><p className="font-semibold">Ce bloc n’a pas pu être affiché.</p><p className="mt-1 text-xs">Le reste de la formation reste disponible. Modifiez ou rechargez uniquement ce bloc.</p></div>;
    return this.props.children;
  }
}

// ─── Composant principal ──────────────────────────────────────
export default function StudioConceptionFormation() {
  const navigate = useNavigate();
  const params = useParams<{ courseId?: string; id?: string }>();
  const courseId = params.courseId || params.id;
  const [searchParams] = useSearchParams();
  const requestedPanel = searchParams.get('panel');
  const isNew = !courseId || courseId === 'new';
  const creatorContext: 'professeur'|'structure'|'admin' = typeof window !== 'undefined' && window.location.pathname.includes('/structure/') ? 'structure' : typeof window !== 'undefined' && window.location.pathname.includes('/admin/') ? 'admin' : 'professeur';

  // État principal
  const [course, setCourse] = useState<Course>(EMPTY_COURSE);
  const [modules, setModules] = useState<Module[]>([]);
  const [currentModule, setCurrentModule] = useState<Module | null>(null);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const blockSaveQueues = useRef<Record<string, Promise<any>>>({});
  // Never consider a failed write successful after its Promise leaves the queue.
  const failedBlockSaves = useRef<Set<string>>(new Set());
  const blockLoadRequest = useRef(0);
  const reorderInFlight = useRef(false);
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [selectedBlockDef, setSelectedBlockDef] = useState<typeof BLOCK_DEFS[0] | null>(null);
  const [assessmentWorkspace, setAssessmentWorkspace] = useState<{ scope: 'lesson'|'module'|'final'; lessonId: string; moduleId: string } | null>(null);

  // UI
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [headerCollapsed, setHeaderCollapsed] = useState(() => {
    try { return localStorage.getItem('oga_studio_header_collapsed') === '1'; } catch { return false; }
  });
  const [showPreview, setShowPreview] = useState(false);
  const [mobileLibraryOpen, setMobileLibraryOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [showRolePreview, setShowRolePreview] = useState(false);
  const [showFinalization, setShowFinalization] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showAssessmentPolicy, setShowAssessmentPolicy] = useState(false);
  const [finalizationCheck, setFinalizationCheck] = useState<{ valid: boolean; errors: string[]; warnings: string[] } | null>(null);
  const [activeLibTab, setActiveLibTab] = useState<'blocs' | 'sections' | 'templates'>('blocs');
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');
  const [lastSave, setLastSave] = useState('');
  const [courseSaveStatus, setCourseSaveStatus] = useState<'idle'|'pending'|'saving'|'saved'|'error'>('idle');
  const [wordCount, setWordCount] = useState(0);

  // Qualité
  const [checklist, setChecklist] = useState<{ valid: boolean; errors: string[]; warnings: string[]; issues?: Array<{severity:'error'|'warning';message:string;target?:string;lesson_id?:string;module_id?:string}> } | null>(null);
  const [qualityWritingLoading, setQualityWritingLoading] = useState(false);
  const [qualityWritingSuggestions, setQualityWritingSuggestions] = useState<any[]>([]);

  // Historique
  const [logs, setLogs] = useState<any[]>([]);

  // IA
  const [aiAction, setAiAction] = useState('ai_improve_text');
  const [aiInput, setAiInput] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [mediaAiBusy, setMediaAiBusy] = useState<string | null>(null);
  const [coverPrompt, setCoverPrompt] = useState('');
  const [coverCandidates, setCoverCandidates] = useState<string[]>([]);
  const [coverGenerating, setCoverGenerating] = useState(false);
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [openingAssessmentPolicy, setOpeningAssessmentPolicy] = useState(false);
  const [builderImportTarget, setBuilderImportTarget] = useState<{ type: 'module'|'lesson'|'block'; id: string } | null>(null);
  const [quickBlockQuery, setQuickBlockQuery] = useState('');

  // Autosave ref
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const courseSaveQueue = useRef<Promise<any>>(Promise.resolve());
  const courseEditRevision = useRef(0);
  const courseRef = useRef<Course>(EMPTY_COURSE);
  courseRef.current = course;

  function showToast(msg: string, type: 'success' | 'error' | 'info' = 'success') {
    setToast(msg); setToastType(type);
    setTimeout(() => setToast(''), 4000);
  }

  // ─── Chargement initial ────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        if (isNew) {
          const templateKey = searchParams.get('template') || 'simple_textual';
          // Le brouillon local reste toujours éditable. La création Supabase se fait
          // lors du premier enregistrement afin qu'une indisponibilité réseau ne bloque jamais la saisie.
          setCourse({ ...EMPTY_COURSE, template_used: templateKey });
        } else if (courseId) {
          const data = await api('get_course', { course_id: courseId });
          if (data.success) {
            setCourse(data.course);
            setModules(data.modules || []);
            setAdvancedMode(data.course.studio_mode === 'advanced');
            if (data.modules?.length > 0) {
              const firstMod = data.modules[0];
              setCurrentModule(firstMod);
              if (firstMod.lessons?.length > 0) {
                const firstLesson = firstMod.lessons[0];
                setCurrentLesson(firstLesson);
                await loadBlocks(firstLesson.id);
              }
            }
          } else {
            setCourse({ ...EMPTY_COURSE });
            showToast(data.error === 'AUTH_REQUIRED' ? 'Session expirée : reconnectez-vous puis enregistrez à nouveau.' : 'Formation introuvable ou inaccessible.', 'error');
          }
        }
      } catch { showToast('Erreur de chargement', 'error'); }
      finally { setLoading(false); }
    }
    load();
  }, [courseId]);

  useEffect(() => {
    if (course.id && requestedPanel === 'assessment-rules') setShowAssessmentPolicy(true);
  }, [course.id, requestedPanel]);

  async function loadBlocks(lessonId: string) {
    const request = ++blockLoadRequest.current;
    const data = await api('get_blocks', { lesson_id: lessonId });
    // Ignore an older response if the creator switched lessons during the fetch.
    if (request !== blockLoadRequest.current) return false;
    if (!data.success) {
      showToast(data.message || data.error || 'Impossible de charger les blocs de la leçon.', 'error');
      return false;
    }
    setBlocks(data.blocks || []);
    // Compter les mots
    const wc = (data.blocks || []).reduce((acc: number, b: Block) => {
      const text = b.content_json?.html || b.content_json?.text || b.content_json?.question || '';
      return acc + text.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    }, 0);
    setWordCount(wc);
    return true;
  }

  function queueBlockUpdate(blockId: string, updates: Record<string, any>) {
    const previous = blockSaveQueues.current[blockId] || Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(async () => {
        const result = await api('update_block', { block_id: blockId, ...updates });
        if (!result.success) {
          failedBlockSaves.current.add(blockId);
          showToast(result.message || result.error || 'Impossible d’enregistrer le bloc. Vos modifications restent visibles.', 'error');
          // Do not reload over other unsaved edits. The next successful write may retry.
          throw new Error(result.error || 'BLOCK_UPDATE_FAILED');
        }
        failedBlockSaves.current.delete(blockId);
        return result;
      });
    blockSaveQueues.current[blockId] = next;
    void next.finally(() => {
      if (blockSaveQueues.current[blockId] === next) delete blockSaveQueues.current[blockId];
    }).catch(() => undefined);
    return next;
  }

  async function flushBlockUpdates() {
    // Attendre Ã©galement les Ã©critures ajoutÃ©es pendant les opÃ©rations prÃ©cÃ©dentes.
    // Refuser la suite du parcours si une sauvegarde Ã©choue.
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const pending = Object.values(blockSaveQueues.current);
      if (!pending.length) {
        if (failedBlockSaves.current.size) throw new Error('BLOCK_SAVE_FAILED');
        return;
      }
      const outcomes = await Promise.allSettled(pending);
      if (outcomes.some(result => result.status === 'rejected') || failedBlockSaves.current.size) throw new Error('BLOCK_SAVE_FAILED');
      if (Object.values(blockSaveQueues.current).every(next => pending.includes(next))) return;
    }
    throw new Error('BLOCK_SAVE_QUEUE_NOT_STABLE');
  }

  async function runQualityCheck() {
    if (!course?.id) return;
    try { await flushBlockUpdates(); } catch { showToast('Enregistrement des blocs incomplet : contrôle qualité interrompu.', 'error'); return; }
    setShowChecklist(true);
    const data = await api('validate_checklist', { course_id: course.id, phase: 'quality' });
    setChecklist(data);
    if (data.success) setCourse(current => ({ ...current, quality_status: data.valid ? 'ready' : 'incomplete', calculated_duration_minutes: data.calculated_duration_minutes ?? current.calculated_duration_minutes, ready_to_submit: false }));
  }

  async function reloadCourse(courseIdToLoad: string) {
    const data = await api('get_course', { course_id: courseIdToLoad });
    if (!data.success) {
      showToast(data.error === 'AUTH_REQUIRED' ? 'Session expirée. Reconnectez-vous.' : 'Impossible de recharger la formation.', 'error');
      return false;
    }
    setCourse(data.course);
    setModules(data.modules || []);
    setAdvancedMode(data.course?.studio_mode === 'advanced');
    return true;
  }

  // ─── Sauvegarde sérialisée : un seul moteur pour autosave et bouton manuel ───
  function courseDraftPayload(c: Course) {
    return {
      course_id: c.id, course_code: normalizeCourseCode(c.course_code || ''),
      title: c.title, short_description: c.short_description,
      long_description: c.long_description, category: c.category, level: c.level,
      language: c.language, course_type: c.course_type,
      instruction_language: c.instruction_language || c.language,
      target_language: c.target_language, cefr_start_level: c.cefr_start_level,
      cefr_target_level: c.cefr_target_level, language_framework: c.language_framework,
      prerequisites: c.prerequisites, objectives: c.objectives,
      target_audience: c.target_audience, learning_outcomes: c.learning_outcomes,
      cover_image_url: c.cover_image_url, cover_image_prompt: c.cover_image_prompt,
      course_intro_title: c.course_intro_title, course_intro_summary: c.course_intro_summary,
      studio_mode: c.studio_mode || 'simple', word_count: wordCount,
      free_preview_mode: c.free_preview_mode || 'introduction',
    };
  }

  function persistCourseDraft(action: 'autosave'|'update_course' = 'autosave', snapshot?: Course) {
    const c = snapshot || courseRef.current;
    if (!c?.id) return Promise.resolve({ success: false, error: 'COURSE_NOT_CREATED' });
    const payload = courseDraftPayload(c);
    const revision = courseEditRevision.current;
    setCourseSaveStatus('saving');
    const operation = courseSaveQueue.current.catch(() => undefined).then(async () => {
      const result = await api(action, payload);
      if (!result.success) {
        if (revision === courseEditRevision.current) setCourseSaveStatus('error');
        return result;
      }
      if (revision === courseEditRevision.current) {
        setLastSave(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
        setCourseSaveStatus('saved');
      } else {
        setCourseSaveStatus('pending');
      }
      return result;
    }).catch((error: unknown) => {
      if (revision === courseEditRevision.current) setCourseSaveStatus('error');
      return { success: false, error: error instanceof Error ? error.message : 'AUTOSAVE_FAILED' };
    });
    courseSaveQueue.current = operation;
    return operation;
  }

  useEffect(() => () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); }, []);

  const scheduleAutosave = useCallback(() => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => { void persistCourseDraft(); }, 30000);
  }, [wordCount]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (courseRef.current?.id && courseSaveStatus === 'pending') void persistCourseDraft();
    }, 30000);
    return () => { window.clearInterval(interval); };
  }, [courseSaveStatus, wordCount]);

  function updateCourse(field: keyof Course, value: any) {
    courseEditRevision.current += 1;
    setCourseSaveStatus('pending');
    setCourse(c => ({ ...c, [field]: value }));
    scheduleAutosave();
  }

  async function changeStudioMode(nextAdvanced: boolean) {
    const previous = advancedMode;
    const mode = nextAdvanced ? 'advanced' : 'simple';
    setAdvancedMode(nextAdvanced);
    setCourse(current => ({ ...current, studio_mode: mode }));
    if (!courseRef.current?.id) return;
    const result = await api('update_course', { course_id: courseRef.current.id, studio_mode: mode });
    if (!result.success) {
      setAdvancedMode(previous);
      setCourse(current => ({ ...current, studio_mode: previous ? 'advanced' : 'simple' }));
      showToast(result.message || result.error || 'Impossible d’enregistrer le mode du Builder.', 'error');
    }
  }

  // ─── Sélection leçon ──────────────────────────────────────
  async function selectLesson(mod: Module, lesson: Lesson): Promise<boolean> {
    if (currentLesson?.id === lesson.id) return true;
    try { await flushBlockUpdates(); }
    catch { showToast('Sauvegarde incomplète : changement de leçon annulé.', 'error'); return false; }
    const loaded = await loadBlocks(lesson.id);
    if (!loaded) return false;
    setAssessmentWorkspace(null);
    setCurrentModule(mod);
    setCurrentLesson(lesson);
    setSelectedBlock(null);
    return true;
  }

  async function selectAssessmentWorkspace(mod: Module, lesson: Lesson, scope: 'lesson'|'module'|'final') {
    if (!await selectLesson(mod, lesson)) return;
    setAssessmentWorkspace({ scope, lessonId: lesson.id, moduleId: mod.id });
    setActiveLibTab('blocs');
    setSelectedBlock(null);
    setSelectedBlockDef(null);
  }

  const sectionTypeOf = (m: Module) => m.section_type || (m.is_intro ? 'introduction' : m.is_conclusion ? 'conclusion' : m.is_final_exam ? 'final_exam' : 'module');
  const stageTypeOf = (l: Lesson) => l.stage_type || (l.is_intro ? 'introduction' : l.is_module_intro ? 'module_presentation' : l.is_conclusion ? 'conclusion' : l.is_final_exam ? 'final_exam' : 'lesson');
  const moduleRank = (m: Module) => sectionTypeOf(m) === 'introduction' ? -100000 : sectionTypeOf(m) === 'conclusion' ? 100000 : sectionTypeOf(m) === 'final_exam' ? 200000 : Number(m.position || 0);
  const orderedModules = [...modules].sort((a, b) => moduleRank(a) - moduleRank(b));
  const builderModules = orderedModules.filter(m => sectionTypeOf(m) !== 'conclusion' && sectionTypeOf(m) !== 'final_exam');
  const endingSections = orderedModules.filter(m => sectionTypeOf(m) === 'conclusion' || sectionTypeOf(m) === 'final_exam');
  const setHeaderCollapsedPersisted = (value: boolean) => {
    setHeaderCollapsed(value);
    try { localStorage.setItem('oga_studio_header_collapsed', value ? '1' : '0'); } catch {}
  };

  // ─── Ajouter module ───────────────────────────────────────
  async function addModule() {
    if (!course?.id) return;
    const normalCount = modules.filter(m => sectionTypeOf(m) === 'module').length;
    const title = `Module ${normalCount + 1}`;
    const data = await api('create_module', { course_id: course.id, title, objective: '', create_module_introduction: false });
    if (data.success) {
      const introLesson = data.intro_lesson as Lesson | undefined;
      const newMod: Module = { ...data.module, lessons: introLesson ? [introLesson] : [] };
      setModules(current => {
        const endings = current.filter(m => sectionTypeOf(m) === 'conclusion' || sectionTypeOf(m) === 'final_exam');
        const before = current.filter(m => sectionTypeOf(m) !== 'conclusion' && sectionTypeOf(m) !== 'final_exam');
        return [...before, newMod, ...endings];
      });
      setCurrentModule(newMod);
      setCurrentLesson(introLesson || null);
      setBlocks([]);
    } else {
      showToast(data.message || data.error || 'Impossible de créer le module.', 'error');
    }
  }

  // ─── Ajouter leçon ────────────────────────────────────────
  async function addLesson(mod: Module) {
    if (!course?.id) return;
    const lessonCount = (mod.lessons || []).filter(l => stageTypeOf(l) === 'lesson').length;
    const title = `Leçon ${lessonCount + 1}`;
    const data = await api('create_lesson', { course_id: course.id, module_id: mod.id, title });
    if (data.success) {
      const newLesson = data.lesson;
      const nextModule = { ...mod, lessons: [...(mod.lessons || []), newLesson] };
      setModules(ms => ms.map(m => m.id === mod.id ? nextModule : m));
      setCurrentModule(nextModule);
      setCurrentLesson(newLesson);
      setBlocks([]);
    } else {
      showToast(data.message || data.error || 'Impossible de créer la leçon.', 'error');
    }
  }

  async function addModuleStage(mod: Module, stageType: 'module_presentation' | 'module_summary') {
    if (!course?.id) return;
    const data = await api('create_module_stage', { course_id: course.id, module_id: mod.id, stage_type: stageType });
    if (data.success) {
      const lesson = data.lesson as Lesson;
      const nextModule = { ...mod, lessons: [...(mod.lessons || []).filter(l => l.id !== lesson.id), lesson].sort((a,b)=>a.position-b.position) };
      setModules(ms => ms.map(m => m.id === mod.id ? nextModule : m));
      await selectLesson(nextModule, lesson);
    } else showToast(data.message || data.error || 'Impossible de créer cette étape.', 'error');
  }

  async function deleteLesson(mod: Module, lesson: Lesson) {
    if (!course?.id || locked) return;
    if (!window.confirm(`Supprimer « ${lesson.title} » et tous ses contenus ? Cette action est définitive pour ce brouillon.`)) return;
    const data = await api('delete_lesson', { course_id: course.id, lesson_id: lesson.id });
    if (!data.success) { showToast(data.message || data.error || 'Suppression impossible.', 'error'); return; }
    const nextModule = { ...mod, lessons: (mod.lessons || []).filter(l => l.id !== lesson.id) };
    setModules(ms => ms.map(m => m.id === mod.id ? nextModule : m));
    if (currentLesson?.id === lesson.id) { setCurrentLesson(null); setBlocks([]); }
    showToast('Étape supprimée');
  }

  async function deleteModule(mod: Module) {
    if (!course?.id || locked || mod.is_intro || mod.is_conclusion || mod.is_final_exam) return;
    if (!window.confirm(`Supprimer le module « ${mod.title} », ses leçons, sa synthèse et tous leurs contenus ?`)) return;
    const data = await api('delete_module', { course_id: course.id, module_id: mod.id });
    if (!data.success) { showToast(data.message || data.error || 'Suppression du module impossible.', 'error'); return; }
    setModules(ms => ms.filter(m => m.id !== mod.id));
    if (currentModule?.id === mod.id) { setCurrentModule(null); setCurrentLesson(null); setBlocks([]); }
    showToast('Module supprimé');
  }

  // ─── Ajouter bloc ─────────────────────────────────────────
  async function addBlock(blockType: string) {
    if (locked || !BLOCK_DEFS.some(def => def.type === blockType)) return;
    if (!course?.id || !currentModule?.id || !currentLesson?.id) {
      showToast('Sélectionnez d\'abord une leçon', 'error'); return;
    }
    if (assessmentWorkspace && !ASSESSMENT_CAPABLE_BLOCKS.has(blockType)) {
      showToast('Dans le sous-espace Évaluation, ajoutez uniquement un bloc pouvant servir de question officielle.', 'error');
      return;
    }
    const defaultContent = contentDefaultForLanguage(getDefaultContent(blockType), course.language || 'fr');
    const data = await api('create_block', {
      course_id: course.id, module_id: currentModule.id, lesson_id: currentLesson.id,
      block_type: blockType, content_json: defaultContent, settings_json: {},
      ...(assessmentWorkspace ? { interaction_mode: 'assessment', assessment_scope: assessmentWorkspace.scope } : {}),
    });
    if (data.success) {
      setBlocks(bs => [...bs, data.block]);
      // Un nouveau bloc reste directement éditable dans le canevas.
      // Le panneau Paramètres ne s'ouvre que via l'engrenage, sur PC comme sur mobile.
      setSelectedBlock(null);
      setSelectedBlockDef(null);
    } else {
      showToast(data.message || data.error || 'Impossible de créer le bloc.', 'error');
    }
  }

  function getDefaultContent(type: string): Record<string, any> {
    return emptyBlockContent(type);
  }

  function contentDefaultForLanguage(value: Record<string, any>, _language: string): Record<string, any> {
    // V3 : les exemples sont des placeholders UI, jamais du contenu réellement enregistré.
    return value;
  }


  // ─── Supprimer / dupliquer / réordonner les blocs ───────────
  async function deleteBlock(blockId: string) {
    if (locked) return;
    try { await flushBlockUpdates(); }
    catch { showToast('Sauvegarde incomplète : suppression annulée.', 'error'); return; }
    const result = await api('delete_block', { block_id: blockId });
    if (!result.success) {
      showToast(result.message || result.error || 'Impossible de supprimer le bloc.', 'error');
      return;
    }
    setBlocks(bs => bs.filter(b => b.id !== blockId));
    if (selectedBlock?.id === blockId) { setSelectedBlock(null); setSelectedBlockDef(null); }
  }

  async function duplicateBlock(block: Block) {
    if (locked || !course?.id || !currentLesson?.id) return;
    try { await flushBlockUpdates(); }
    catch { showToast('Sauvegarde incomplète : duplication annulée.', 'error'); return; }
    const data = await api('duplicate_block', { course_id: course.id, block_id: block.id });
    if (data.success && data.block) {
      setBlocks(bs => {
        const idx = bs.findIndex(b => b.id === block.id);
        const next = [...bs];
        next.splice(idx + 1, 0, data.block);
        return next.map((item, position) => ({ ...item, position }));
      });
      if (data.stream_requires_reupload) showToast('Le bloc vidéo a été dupliqué sans copier le flux privé. Téléversez la vidéo du nouveau bloc.', 'info');
    } else {
      showToast(data.message || data.error || 'Impossible de dupliquer le bloc.', 'error');
    }
  }

  async function removeBlockResource(block: Block) {
    if (!course?.id) return;
    const data = await api('remove_block_resource', { course_id: course.id, block_id: block.id });
    if (!data.success || !data.block) {
      showToast(data.message || data.error || 'Impossible de retirer la ressource.', 'error');
      return;
    }
    setBlocks(bs => bs.map(item => item.id === block.id ? data.block : item));
    setSelectedBlock(current => current?.id === block.id ? data.block : current);
    showToast('Ressource retirée et nettoyage serveur effectué.', 'success');
  }

  const dragIdx = useRef<number | null>(null);
  // Native drag on the handle + arrow buttons: keyboard/touch users have an alternative.
  const isBlockDrag = (e: React.DragEvent) => e.dataTransfer.types.includes('application/x-omnia-existing-block');
  function onDragStart(idx: number, e: React.DragEvent) {
    if (locked || reorderInFlight.current || idx < 0) { e.preventDefault(); return; }
    dragIdx.current = idx;
    e.dataTransfer.setData('application/x-omnia-existing-block', String(idx));
    e.dataTransfer.effectAllowed = 'move';
  }
  function onDragOver(e: React.DragEvent, idx: number) {
    if (locked || reorderInFlight.current || !isBlockDrag(e)) return;
    e.preventDefault();
    setDragOverIdx(idx);
  }
  async function persistBlockOrder(next: Block[], original: Block[], lessonId: string) {
    if (locked || reorderInFlight.current || next.length !== original.length) return;
    reorderInFlight.current = true;
    try {
      await flushBlockUpdates();
      const result = await api('reorder_blocks', { lesson_id: lessonId, ordered_ids: next.map(b => b.id) });
      if (!result.success) throw new Error(result.message || result.error || 'Échec du déplacement');
      // Apply only if we are still editing the same lesson.
      if (currentLesson?.id === lessonId) setBlocks(next.map((block, position) => ({ ...block, position })));
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Impossible de réordonner les blocs.', 'error');
      // No optimistic update was applied: leave the user's newer local edits intact.
    } finally {
      reorderInFlight.current = false;
      dragIdx.current = null;
      setDragOverIdx(null);
    }
  }
  async function onDrop(e: React.DragEvent, targetIdx: number) {
    if (!isBlockDrag(e)) return;
    e.preventDefault(); e.stopPropagation();
    const sourceIdx = dragIdx.current;
    dragIdx.current = null;
    setDragOverIdx(null);
    if (locked || reorderInFlight.current || !currentLesson?.id || sourceIdx === null || sourceIdx < 0 || sourceIdx >= blocks.length || sourceIdx === targetIdx || targetIdx < 0 || targetIdx >= blocks.length) return;
    const next = [...blocks];
    const [moved] = next.splice(sourceIdx, 1);
    next.splice(targetIdx, 0, moved);
    await persistBlockOrder(next, blocks, currentLesson.id);
  }

  async function moveBlock(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (locked || reorderInFlight.current || index < 0 || target < 0 || target >= blocks.length || !currentLesson?.id) return;
    const next = [...blocks];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    await persistBlockOrder(next, blocks, currentLesson.id);
  }

  async function saveCurrentPage(goNext = false) {
    if (!course.id) { const created = await ensureCourseCreated(); if (!created) return; courseRef.current = created; }
    try { await flushBlockUpdates(); } catch { showToast('Un bloc n’a pas été enregistré. Corrigez l’erreur avant de changer de page.', 'error'); return; }
    const result = await persistCourseDraft();
    if (!result.success) { showToast(result.message || result.error || 'Échec de sauvegarde. La page n’a pas été changée.', 'error'); return; }
    if (!goNext || !currentModule || !currentLesson) return;
    const modIndex = modules.findIndex(m => m.id === currentModule.id);
    const lessonIndex = (currentModule.lessons || []).findIndex(l => l.id === currentLesson.id);
    const nextLesson = currentModule.lessons?.[lessonIndex + 1];
    if (nextLesson) { await selectLesson(currentModule, nextLesson); return; }
    const nextModule = modules[modIndex + 1];
    if (nextModule?.lessons?.length) { await selectLesson(nextModule, nextModule.lessons[0]); return; }
    showToast('Dernière page de la formation', 'info');
  }

  // ─── Créer / sauvegarder le brouillon ─────────────────────
  async function ensureCourseCreated(options: { openAssessmentPolicy?: boolean } = {}): Promise<Course | null> {
    if (course.id) return course;
    if (!course.title.trim()) { showToast('Saisissez le titre de la formation.', 'error'); return null; }
    if (!course.short_description?.trim()) { showToast('Ajoutez la description courte visible avant achat.', 'error'); return null; }
    setCreatingDraft(true);
    try {
      const creatorContext = window.location.pathname.includes('/structure/') ? 'structure' : window.location.pathname.includes('/admin/') ? 'super_admin' : 'professeur';
      const data = await api('create_course', {
        creator_context: creatorContext,
        client_draft_key: localStorage.getItem('omnia_studio_draft_key') || (()=>{const k=crypto.randomUUID();localStorage.setItem('omnia_studio_draft_key',k);return k;})(),
        course_code: normalizeCourseCode(course.course_code || ''),
        title: course.title,
        short_description: course.short_description,
        long_description: course.long_description,
        category: course.category,
        level: course.level,
        language: course.language,
        course_type: course.course_type,
        instruction_language: course.instruction_language || course.language,
        target_language: course.target_language,
        cefr_start_level: course.cefr_start_level,
        cefr_target_level: course.cefr_target_level,
        language_framework: course.language_framework,
        prerequisites: course.prerequisites,
        objectives: course.objectives,
        target_audience: course.target_audience,
        learning_outcomes: course.learning_outcomes,
        cover_image_url: course.cover_image_url,
        cover_image_prompt: course.cover_image_prompt,
        course_intro_title: course.course_intro_title,
        course_intro_summary: course.course_intro_summary,
        template_used: course.template_used || 'simple_textual',
        studio_mode: course.studio_mode || 'simple',
        create_introduction: true,
        free_preview_mode: 'introduction',
      });
      if (!data.success) throw new Error(data.message || data.error || 'Création impossible');
      setCourse(data.course);
      setModules(data.modules || []);
      const intro = (data.modules || []).find((m: any) => m.is_intro) || (data.modules || [])[0];
      if (intro) {
        setCurrentModule(intro);
        const introLesson = intro.lessons?.[0];
        if (introLesson) { setCurrentLesson(introLesson); await loadBlocks(introLesson.id); }
      }
      const basePath = window.location.pathname.includes('/admin/') ? '/admin/studio'
        : window.location.pathname.includes('/partner/') ? '/partner/studio'
        : window.location.pathname.includes('/structure/') ? '/structure/studio'
        : '/professeur/studio';
      const query = options.openAssessmentPolicy ? '?panel=assessment-rules' : '';
      navigate(`${basePath}/${data.course.id}${query}`, { replace: true });
      return data.course;
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Impossible de créer le brouillon', 'error');
      return null;
    } finally { setCreatingDraft(false); }
  }

  async function openAssessmentPolicy() {
    if (openingAssessmentPolicy) return;
    setOpeningAssessmentPolicy(true);
    try {
      if (!course.id) {
        const created = await ensureCourseCreated({ openAssessmentPolicy: true });
        if (!created?.id) return;
        return;
      }
      setShowAssessmentPolicy(true);
    } finally {
      setOpeningAssessmentPolicy(false);
    }
  }

  function closeAssessmentPolicy() {
    setShowAssessmentPolicy(false);
    if (requestedPanel === 'assessment-rules') {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('panel');
      const query = nextParams.toString();
      navigate({ search: query ? `?${query}` : '' }, { replace: true });
    }
  }

  async function save() {
    setSaving(true);
    try {
      const savedCourse = course.id ? course : await ensureCourseCreated();
      if (!savedCourse?.id) return;
      await flushBlockUpdates();
      const data = await persistCourseDraft('update_course', { ...courseRef.current, id: savedCourse.id });
      if (data.success) {
        // Ne pas écraser les champs édités pendant l'appel avec une réponse devenue ancienne.
        // Les champs restent contrôlés par l'état React ; ne pas réinjecter une réponse serveur périmée.
      } else showToast(data.message || data.error || 'Erreur de sauvegarde', 'error');
    } catch { showToast('Erreur de sauvegarde', 'error'); }
    finally { setSaving(false); }
  }

  async function uploadCoverImage(file: File) {
    if (!file.type.startsWith('image/')) { showToast('Choisissez un fichier image.', 'error'); return; }
    let c = course;
    if (!c.id) { const created = await ensureCourseCreated(); if (!created) return; c = created; }
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `${c.id}/cover-${Date.now()}.${ext}`;
      const signed = await api('prepare_upload', { course_id: c.id, bucket_name: 'course-images', storage_path: path });
      if (!signed.success || !signed.signedUrl) throw new Error('Téléversement impossible');
      const upload = await fetch(signed.signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!upload.ok) throw new Error('Échec du téléversement');
      const url = `${SB}/storage/v1/object/public/course-images/${path}`;
      updateCourse('cover_image_url', url);
      await api('update_course', { course_id: c.id, cover_image_url: url });
    } catch (error) { showToast(error instanceof Error ? error.message : 'Erreur image', 'error'); }
  }

  async function generateCoverImages() {
    if (!coverPrompt.trim()) { showToast('Décrivez la formation en quelques lignes.', 'error'); return; }
    let c = course;
    if (!c.id) { const created = await ensureCourseCreated(); if (!created) return; c = created; }
    setCoverGenerating(true); setCoverCandidates([]);
    try {
      const data = await api('ai_generate_cover_images', { course_id: c.id, prompt: coverPrompt, count: 2 });
      if (!data.success) throw new Error(data.message || data.error || 'Génération indisponible');
      setCoverCandidates(data.images || []);
      updateCourse('cover_image_prompt', coverPrompt);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur de génération';
      showToast(message === 'OPENAI_NOT_CONFIGURED' ? 'La génération d’images OpenAI n’est pas configurée.' : message, 'error');
    }
    finally { setCoverGenerating(false); }
  }

  async function goToQualityIssue(issue: { target?: string; lesson_id?: string; module_id?: string; block_id?: string }) {
    setShowChecklist(false);
    if (issue.target === 'finalization') { setShowFinalization(true); setCurrentModule(null); setCurrentLesson(null); setBlocks([]); setSelectedBlock(null); return; }
    if (issue.target === 'information') { setShowFinalization(false); setCurrentModule(null); setCurrentLesson(null); setBlocks([]); setSelectedBlock(null); return; }
    const module = modules.find(m => m.id === issue.module_id || m.lessons?.some(l => l.id === issue.lesson_id));
    if (!module) return;
    if (issue.lesson_id) {
      const lesson = module.lessons?.find(l => l.id === issue.lesson_id);
      if (lesson) {
        setShowFinalization(false); setCurrentModule(module); setCurrentLesson(lesson); setSelectedBlock(null); setBlocks([]);
        const data = await api('get_blocks', { lesson_id: lesson.id });
        const nextBlocks = data.success ? (data.blocks || []) : [];
        setBlocks(nextBlocks);
        if (issue.block_id) setSelectedBlock(nextBlocks.find((block: Block) => block.id === issue.block_id) || null);
        return;
      }
    }
    setShowFinalization(false); setCurrentModule(module); setCurrentLesson(null); setBlocks([]); setSelectedBlock(null);
  }

  async function runQualityWritingReview() {
    if (!course?.id || qualityWritingLoading) return;
    setQualityWritingLoading(true);
    setQualityWritingSuggestions([]);
    try {
      const data = await api('quality_spelling_review', { course_id: course.id });
      if (!data.success) throw new Error(data.message || data.error || 'Analyse rédactionnelle indisponible');
      setQualityWritingSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
      if (!data.suggestions?.length) showToast('Aucune correction rédactionnelle importante détectée.', 'info');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Analyse rédactionnelle indisponible', 'error');
    } finally { setQualityWritingLoading(false); }
  }

  // ─── Publier / soumettre ──────────────────────────────────
  async function submit() {
    if (!course?.id || submitting) return;
    setSubmitting(true);
    setFinalizationCheck(null);
    try {
      await flushBlockUpdates();

      const quality = await api('validate_checklist', { course_id: course.id, phase: 'quality' });
      setChecklist(quality);
      if (quality.success) setCourse(current => ({ ...current, quality_status: quality.valid ? 'ready' : 'incomplete', calculated_duration_minutes: quality.calculated_duration_minutes ?? current.calculated_duration_minutes, ready_to_submit: false }));
      if (!quality.valid) {
        setShowChecklist(true);
        showToast('Corrigez les erreurs de qualité avant la publication.', 'error');
        return;
      }

      const publication = await api('validate_checklist', { course_id: course.id, phase: 'publication' });
      setFinalizationCheck({
        valid: Boolean(publication.valid),
        errors: Array.isArray(publication.errors) ? publication.errors : [],
        warnings: Array.isArray(publication.warnings) ? publication.warnings : [],
      });
      if (publication.success) setCourse(current => ({ ...current, ready_to_submit: Boolean(publication.valid), calculated_duration_minutes: publication.calculated_duration_minutes ?? current.calculated_duration_minutes }));
      if (!publication.valid) {
        setShowFinalization(true);
        setCurrentModule(null);
        setCurrentLesson(null);
        setBlocks([]);
        setSelectedBlock(null);
        showToast('Complétez les éléments de Finalisation avant de publier.', 'error');
        return;
      }

      const data = await api('submit_course', { course_id: course.id });
      if (data.success) {
        if (data.pricing_required) {
          setCourse(c => c ? { ...c, pricing_status: data.pricing_status } : c);
          showToast(data.message || 'La tarification a été transmise pour validation.', 'info');
        } else if (data.direct_publish || data.published) {
          setCourse(c => c ? { ...c, studio_status: 'published', is_published: true, is_catalog_active: true } : c);
          showToast('Formation publiée par Omnia Global Academy');
        } else {
          setCourse(c => c ? { ...c, studio_status: 'pending_validation' } : c);
          showToast('Formation soumise pour validation');
        }
      } else {
        setFinalizationCheck({ valid: false, errors: data.errors || [data.message || data.error || 'Soumission impossible'], warnings: data.warnings || [] });
        setShowFinalization(true);
        showToast(data.message || data.error || 'Soumission impossible', 'error');
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erreur lors de la publication', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Charger historique ───────────────────────────────────
  async function loadHistory() {
    if (!course?.id) return;
    const data = await api('get_change_logs', { course_id: course.id });
    if (data.success) setLogs(data.logs || []);
    setShowHistory(true);
  }

  // ─── IA ───────────────────────────────────────────────────
  async function runAI() {
    if (!aiInput.trim()) return;
    setAiLoading(true); setAiResult('');
    try {
      const data = await api(aiAction, { course_id: course?.id, lesson_id: currentLesson?.id, block_id: selectedBlock?.id, language: course?.language, instruction_language: course?.instruction_language, target_language: course?.target_language, course_type: course?.course_type, cefr_start_level: course?.cefr_start_level, cefr_target_level: course?.cefr_target_level, text: aiInput, topic: aiInput, content: aiInput, lesson_title: currentLesson?.title });
      if (data.success) {
        const res = data.result;
        setAiResult(typeof res === 'string' ? res : JSON.stringify(res, null, 2));
      } else showToast(data.message || data.error || 'Assistant IA indisponible', 'error');
    } catch (error) { showToast(error instanceof Error ? error.message : 'Assistant IA indisponible', 'error'); }
    finally { setAiLoading(false); }
  }

  async function generateTtsForBlock(block: Block, text: string, targetPath: string) {
    const source = String(text || '').trim();
    if (!source) { showToast('Ajoutez d’abord le texte à transformer en audio.', 'error'); return; }
    setMediaAiBusy(`tts:${block.id}:${targetPath}`);
    try {
      const response = await fetch(`${SB}/functions/v1/tts-generate`, { method: 'POST', headers: edgeAuthHeaders(), body: JSON.stringify({ block_id: block.id, text: source, target_path: targetPath }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || data.error || 'Synthèse vocale indisponible');
      const content_json = data.content_json || block.content_json;
      setBlocks(bs => bs.map(item => item.id === block.id ? { ...item, content_json } : item));
      if (selectedBlock?.id === block.id) setSelectedBlock({ ...block, content_json });
      showToast('Audio IA généré et rattaché au bloc.');
    } catch (error) { showToast(error instanceof Error ? error.message : 'Synthèse vocale indisponible', 'error'); }
    finally { setMediaAiBusy(null); }
  }

  async function generateSubtitlesForBlock(block: Block) {
    if (!String(block.content_json?.cloudflare_stream_uid || '').trim()) { showToast('Téléversez d’abord la vidéo dans Omnia/Cloudflare Stream.', 'error'); return; }
    setMediaAiBusy(`subtitle:${block.id}`);
    try {
      const sourceLanguage = course?.instruction_language || course?.language || 'fr';
      const targetLanguage = String(block.content_json?.subtitle_target_language || sourceLanguage);
      const response = await fetch(`${SB}/functions/v1/subtitle-request`, { method: 'POST', headers: edgeAuthHeaders(), body: JSON.stringify({ block_id: block.id, source_language: sourceLanguage, target_language: targetLanguage }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || data.error || 'Sous-titres indisponibles');
      showToast('Génération des sous-titres lancée. Ils seront rattachés à ce bloc vidéo.');
    } catch (error) { showToast(error instanceof Error ? error.message : 'Sous-titres indisponibles', 'error'); }
    finally { setMediaAiBusy(null); }
  }

  const publishedSuperAdminEditable = course.studio_status === 'published' && course.creator_context === 'super_admin';
  const locked = ['pending_validation', 'validated', 'suspended'].includes(course.studio_status || '') || (course.studio_status === 'published' && !publishedSuperAdminEditable);
  const workflowLocked = ['pending_validation', 'validated', 'published', 'suspended'].includes(course.studio_status || '');
  const statusCfg = STATUS_CFG[course.studio_status || 'draft'] || STATUS_CFG.draft;
  const modeBlocks = advancedMode ? BLOCK_DEFS : BLOCK_DEFS.filter(def => def.mode === 'simple');
  const visibleBlocks = assessmentWorkspace
    ? modeBlocks.filter(def => ASSESSMENT_CAPABLE_BLOCKS.has(def.type))
    : modeBlocks;
  const displayedBlocks = assessmentWorkspace
    ? blocks.filter(block => block.interaction_mode === 'assessment')
    : blocks.filter(block => block.interaction_mode !== 'assessment');

  const quickBlockMatches = quickBlockQuery.trim()
    ? visibleBlocks.filter(def => {
        const query = quickBlockQuery.trim().toLowerCase().replace(/^\//, '');
        const aliases = BLOCK_SEARCH_ALIASES[def.type] || [];
        return def.label.toLowerCase().includes(query) || def.type.toLowerCase().includes(query) || aliases.some(alias => alias.toLowerCase().includes(query));
      }).slice(0, 8)
    : (assessmentWorkspace ? visibleBlocks : visibleBlocks.filter(def => ESSENTIAL_BLOCK_TYPES.includes(def.type))).slice(0, 8);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: '#F0F2F5' }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden" style={{ background: '#F0F2F5', fontFamily: 'Arial, sans-serif' }}>
      <MobileBuilderAdvice
        storageKey="formation-builder"
        description="La création et la modification d’une formation fonctionnent sur mobile. Pour les gros imports, SCORM, la réorganisation de nombreux modules ou une mise en page complexe, un ordinateur reste plus confortable."
      />

      {/* Toast */}

      {builderImportTarget && course.id && (
        <BuilderImportDialog
          open
          onClose={() => setBuilderImportTarget(null)}
          courseId={course.id}
          targetType={builderImportTarget.type}
          targetId={builderImportTarget.id}
          creatorContext={creatorContext}
          onApplied={async () => {
            await reloadCourse(course.id);
            if (currentLesson?.id) await loadBlocks(currentLesson.id);
            showToast('Import appliqué au Builder.', 'success');
          }}
        />
      )}
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-lg border"
          style={{
            background: toastType === 'error' ? '#FEF2F2' : toastType === 'info' ? '#EFF6FF' : 'white',
            borderColor: toastType === 'error' ? '#FECACA' : toastType === 'info' ? '#BFDBFE' : '#E4E7EC',
            color: toastType === 'error' ? '#DC2626' : toastType === 'info' ? '#1D4ED8' : '#002050',
          }}>
          {toast}
        </div>
      )}

      {/* ── BARRE SUPÉRIEURE ─────────────────────────────── */}
      <div className="bg-white border-b flex items-center gap-1 px-2 h-14 flex-shrink-0 sm:px-4" style={{ borderColor: '#E4E7EC' }}>
        <button onClick={() => {
          const back = window.location.pathname.includes('/admin/') ? '/admin/studio-mes-formations'
            : window.location.pathname.includes('/partner/') ? '/partner/dashboard'
            : window.location.pathname.includes('/structure/') ? '/structure/formations'
            : '/professeur/courses';
          navigate(back);
        }} className="flex items-center gap-1 mr-1 text-sm sm:mr-4" style={{ color: '#6B7280' }}>
          <ChevronLeft size={16} /> Retour
        </button>
        <div className="flex items-center gap-2 mr-4">
          <div className="w-7 h-7 rounded flex items-center justify-center" style={{ background: '#002050' }}>
            <BookOpen size={14} color="#BF8813" />
          </div>
          <span className="font-bold text-sm hidden md:block" style={{ color: '#002050' }}>Omnia Global Academy</span>
          <span className="text-sm hidden md:block" style={{ color: '#9CA3AF' }}>|</span>
          <span className="hidden sm:inline font-semibold text-sm" style={{ color: '#002050' }}>Studio de Conception de Formation</span>
        </div>

        {/* Fil d'Ariane */}
        <div className="flex items-center gap-1 text-xs flex-1 min-w-0 overflow-hidden" style={{ color: '#6B7280' }}>
          <span className="truncate">{course?.title || 'Formation'}</span>
          {currentModule && <><ChevronRight size={12} /><span className="truncate">{currentModule.title}</span></>}
          {currentLesson && <><ChevronRight size={12} /><span className="truncate">{currentLesson.title}</span></>}
        </div>

        {/* Mode simple/avancé */}
        {!headerCollapsed && <div className="hidden md:flex items-center gap-1 mx-3 bg-gray-100 rounded-lg p-1 flex-shrink-0">
          <button onClick={() => void changeStudioMode(false)}
            className="px-2.5 py-1 rounded-md text-xs font-semibold transition-all"
            style={!advancedMode ? { background: '#002050', color: 'white' } : { color: '#6B7280' }}>
            Mode simple
          </button>
          <button onClick={() => void changeStudioMode(true)}
            className="px-2.5 py-1 rounded-md text-xs font-semibold transition-all"
            style={advancedMode ? { background: '#002050', color: 'white' } : { color: '#6B7280' }}>
            Mode avancé
          </button>
        </div>}

        {/* Statut */}
        {!headerCollapsed && <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold mr-3 flex-shrink-0" style={{ background: statusCfg.bg, color: statusCfg.color }}>
          <div className="w-2 h-2 rounded-full" style={{ background: statusCfg.dot }} />
          {statusCfg.label}
        </div>}
        {publishedSuperAdminEditable && !headerCollapsed && <span className="hidden md:inline text-[11px] font-semibold text-emerald-700 mr-2">Modifications publiées en direct</span>}

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {!headerCollapsed && <button onClick={loadHistory} className="hidden md:flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium" style={{ borderColor: '#E4E7EC', color: '#6B7280' }}>
            <History size={13} /> Historique
          </button>}
          <button type="button" onClick={() => setHeaderCollapsedPersisted(!headerCollapsed)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium" style={{ borderColor: '#E4E7EC', color: '#6B7280' }} title={headerCollapsed ? 'Afficher les paramètres du Builder' : 'Réduire les paramètres du Builder'}>
            {headerCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}<span className="hidden lg:inline">{headerCollapsed ? 'Afficher' : 'Réduire'}</span>
          </button>
          <button onClick={() => { if (!course.id) { showToast('Enregistrez d’abord le brouillon.', 'error'); return; } setShowRolePreview(true); }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium" style={{ borderColor: '#E4E7EC', color: '#6B7280' }}>
            <Eye size={13} /><span className="hidden sm:inline">Prévisualiser</span>
          </button>
          <button onClick={save} disabled={saving || locked}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium disabled:opacity-50"
            style={{ borderColor: '#E4E7EC', color: '#374151' }}>
            {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}<span className="hidden sm:inline">Enregistrer</span>
          </button>
          <button onClick={submit} disabled={submitting || workflowLocked}
            className="flex items-center gap-1 px-4 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-50"
            style={{ background: locked ? '#9CA3AF' : '#BF8813' }}>
            <Send size={13} /><span className="hidden sm:inline">{course.studio_status === 'published' ? 'Publiée' : workflowLocked ? 'Soumise' : 'Soumettre'}</span>
          </button>
        </div>
      </div>

      {/* ── CORPS PRINCIPAL ──────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden relative">
        {mobileLibraryOpen && <button type="button" aria-label="Fermer la bibliothèque" onClick={() => setMobileLibraryOpen(false)} className="absolute inset-0 z-30 bg-slate-950/30 md:hidden" />}
        {/* ── COLONNE GAUCHE : Bibliothèque ────────────── */}
        <div className={`${mobileLibraryOpen ? 'absolute inset-y-0 left-0 z-40 flex w-[min(22rem,92vw)] shadow-2xl' : 'hidden'} bg-white border-r flex-col flex-shrink-0 md:flex md:static md:w-[240px] md:shadow-none`} style={{ borderColor: '#E4E7EC' }}>

          {/* Tabs bibliothèque */}
          <div className="flex items-center border-b" style={{ borderColor: '#E4E7EC' }}>
            <button type="button" onClick={() => setMobileLibraryOpen(false)} className="ml-2 rounded-lg p-2 text-slate-500 md:hidden" aria-label="Fermer la bibliothèque"><X size={16} /></button>
            {(assessmentWorkspace ? (['blocs'] as const) : (['blocs', 'sections', 'templates'] as const)).map(tab => (
              <button key={tab} onClick={() => setActiveLibTab(tab)}
                className="flex-1 py-2.5 text-xs font-semibold capitalize transition-all"
                style={activeLibTab === tab ? { color: '#002050', borderBottom: '2px solid #BF8813' } : { color: '#9CA3AF' }}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {/* Onglet Blocs */}
            {activeLibTab === 'blocs' && (
              <div>
                {['structure', 'pedagogique', 'media', 'evaluation', 'langues', 'avance'].map(group => {
                  const groupBlocks = visibleBlocks.filter(b => b.group === group);
                  if (groupBlocks.length === 0) return null;
                  const groupLabels: Record<string, string> = { structure: 'Structure & texte', pedagogique: 'Pédagogie', media: 'Médias & documents', evaluation: 'Activités & évaluations', avance: 'Interactions avancées', langues: 'Apprentissage des langues' };
                  return (
                    <div key={group} className="mb-4">
                      <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#9CA3AF' }}>
                        {groupLabels[group]} {group === 'avance' && <span className="ml-1 normal-case font-medium text-[#BF8813]">— disponibles dans toutes les formations</span>}
                      </p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {groupBlocks.map(def => (
                          <button key={def.type} onClick={async () => { await addBlock(def.type); setMobileLibraryOpen(false); }} disabled={locked} draggable={!locked && !!currentLesson}
                            onDragStart={(e) => { e.dataTransfer.setData('application/x-omnia-block', def.type); e.dataTransfer.effectAllowed = 'copy'; }}
                            className="flex flex-col items-center gap-1 p-2 rounded-lg border text-center transition-all hover:shadow-sm disabled:opacity-40"
                            style={{ borderColor: '#E4E7EC', background: 'white' }}>
                            <div className="w-6 h-6 flex items-center justify-center">
                              <def.icon size={18} style={{ color: def.color }} />
                            </div>
                            <span className="text-xs leading-tight" style={{ color: '#374151', fontSize: '10px' }}>{def.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {!currentLesson && (
                  <div className="mt-4 p-3 rounded-lg text-center" style={{ background: '#F8F9FA', border: '1px dashed #E4E7EC' }}>
                    <p className="text-xs" style={{ color: '#9CA3AF' }}>Sélectionnez une leçon pour ajouter des blocs</p>
                  </div>
                )}
              </div>
            )}

            {/* Onglet Sections */}
            {activeLibTab === 'sections' && (
              <div className="space-y-2">
                {[
                  { label: 'Introduction complète', blocks: ['heading', 'objective', 'text'] },
                  { label: 'Explication + Exemple', blocks: ['text', 'example', 'remember'] },
                  { label: 'Quiz rapide', blocks: ['qcm', 'true_false'] },
                  { label: 'Résumé de leçon', blocks: ['remember', 'summary'] },
                  { label: 'Document + Questions', blocks: ['pdf', 'qcm'] },
                  { label: 'Concept interactif', blocks: ['heading', 'accordion', 'flashcards', 'summary'] },
                  { label: 'Étude de cas guidée', blocks: ['case_study', 'rubric', 'assignment_upload'] },
                  { label: 'Démonstration technique', blocks: ['code', 'formula', 'chart', 'remember'] },
                  { label: 'Parcours visuel', blocks: ['timeline', 'gallery', 'checklist'] },
                  { label: 'Module SCORM accompagné', blocks: ['objective', 'scorm', 'summary'] },
                  { label: 'Séquence vocabulaire', blocks: ['vocabulary', 'flashcards', 'matching'] },
                  { label: 'Séquence compréhension orale', blocks: ['listening_comprehension', 'dictation', 'summary'] },
                  { label: 'Séquence expression orale', blocks: ['dialogue', 'pronunciation', 'oral_response'] },
                ].filter(section => advancedMode || section.blocks.every(bt => BLOCK_DEFS.find(def => def.type === bt)?.mode === 'simple')).map(section => (
                  <button key={section.label} disabled={locked}
                    onClick={async () => { for (const bt of section.blocks) { await addBlock(bt); } }}
                    className="w-full text-left p-3 rounded-lg border text-xs font-medium transition-all hover:shadow-sm disabled:opacity-40"
                    style={{ borderColor: '#E4E7EC', background: 'white' }}>
                    <p style={{ color: '#002050' }}>{section.label}</p>
                    <p className="mt-0.5" style={{ color: '#9CA3AF' }}>{section.blocks.map(bt => BLOCK_DEFS.find(d => d.type === bt)?.label).join(' + ')}</p>
                  </button>
                ))}
              </div>
            )}

            {/* Onglet Templates */}
            {activeLibTab === 'templates' && (
              <div className="space-y-2">
                {[
                  { key: 'simple_textual', label: 'Formation simple textuelle', desc: 'Idéal pour débutants', default: true },
                  { key: 'classic_lesson', label: 'Leçon classique', desc: 'Structure standard' },
                  { key: 'case_study', label: 'Avec cas pratique', desc: 'Situations réelles' },
                  { key: 'pdf_word', label: 'Avec PDF / Word', desc: 'Documents professionnels' },
                  { key: 'excel_template', label: 'Avec Excel', desc: 'Tableaux et calculs' },
                  { key: 'advanced_interactive', label: 'Interactive avancée', desc: 'Blocs interactifs' },
                  { key: 'scorm_template', label: 'Formation SCORM', desc: 'Package SCORM' },
                  { key: 'language_learning', label: 'Formation linguistique', desc: 'Vocabulaire, écoute, oral et CECRL' },
                ].filter(tmpl => advancedMode || !['advanced_interactive', 'language_learning'].includes(tmpl.key)).map(tmpl => (
                  <button key={tmpl.key} disabled={locked}
                    onClick={async () => {
                      if (!course?.id) return;
                      const replaceExisting = modules.length === 0 || window.confirm('Appliquer ce modèle remplacera les modules et leçons actuels. Continuer ?');
                      if (!replaceExisting) return;
                      const data = await api('apply_template', { course_id: course.id, template_key: tmpl.key, replace_existing: modules.length > 0 });
                      if (data.success) { window.location.reload(); } else showToast('Impossible d’appliquer le modèle', 'error');
                    }}
                    className="w-full text-left p-3 rounded-lg border text-xs transition-all hover:shadow-sm disabled:opacity-40"
                    style={{ borderColor: course?.template_used === tmpl.key ? '#002050' : '#E4E7EC', background: 'white' }}>
                    <div className="flex items-center gap-1.5">
                      <p style={{ color: '#002050' }} className="font-semibold">{tmpl.label}</p>
                      {tmpl.default && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#EEF2FF', color: '#3730A3', fontSize: '9px' }}>Défaut</span>}
                    </div>
                    <p className="mt-0.5" style={{ color: '#9CA3AF' }}>{tmpl.desc}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Aide */}
          <div className="border-t p-3" style={{ borderColor: '#E4E7EC' }}>
            <p className="text-xs" style={{ color: '#9CA3AF' }}>
              Glissez un bloc dans la leçon ou utilisez la recherche rapide avec /.
            </p>
          </div>
        </div>

        {/* ── ZONE CENTRALE : Canevas ──────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b bg-white px-3 py-2 md:hidden" style={{ borderColor: '#E4E7EC' }}>
            <button type="button" onClick={() => setMobileLibraryOpen(true)} className="flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold" style={{ borderColor: '#002050', color: '#002050' }}><Layers size={14} /> Bibliothèque</button>
            <button type="button" onClick={() => setShowAI(true)} className="flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold" style={{ borderColor: '#BF8813', color: '#92400E' }}><Sparkles size={14} /> IA</button>
            <button type="button" onClick={() => setShowPreview(true)} className="flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold" style={{ borderColor: '#E4E7EC', color: '#002050' }}><Eye size={14} /> Aperçu</button>
            <button type="button" onClick={() => void changeStudioMode(!advancedMode)} className="shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold" style={{ borderColor: '#E4E7EC', color: '#374151' }}>{advancedMode ? 'Mode avancé' : 'Mode simple'}</button>
            <button type="button" onClick={loadHistory} className="flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold" style={{ borderColor: '#E4E7EC', color: '#374151' }}><History size={14} /> Historique</button>
            <button type="button" onClick={runQualityCheck} className="flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold" style={{ borderColor: '#E4E7EC', color: '#374151' }}><CheckCircle size={14} /> Qualité</button>
          </div>

          {/* Navigation structure formation */}
          {!headerCollapsed && (
          <div className="bg-white border-b flex items-center px-4 py-2 gap-4 flex-shrink-0 overflow-x-auto" style={{ borderColor: '#E4E7EC' }}>
            {/* Infos formation */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => { setShowFinalization(false); setCurrentModule(null); setCurrentLesson(null); setBlocks([]); setSelectedBlock(null); }}
                className="text-xs font-semibold px-2 py-1 rounded" style={{ color: currentModule ? '#6B7280' : '#002050', background: currentModule ? 'transparent' : '#EEF2FF' }}>
                Infos formation
              </button>
            </div>
            <div className="h-4 w-px bg-gray-200 flex-shrink-0" />
            {/* Modules */}
            <div className="flex items-center gap-2 overflow-x-auto">
              {builderModules.map(mod => (
                <div key={mod.id} className="flex-shrink-0">
                  <input
                    className="w-full bg-transparent text-xs font-semibold mb-1 outline-none border-b border-transparent focus:border-[#BF8813]"
                    style={{ color: currentModule?.id === mod.id ? '#002050' : '#6B7280' }}
                    value={mod.title}
                    onClick={e => e.stopPropagation()}
                    onChange={e => {
                      const title = e.target.value;
                      setModules(ms => ms.map(m => m.id === mod.id ? { ...m, title } : m));
                      if (currentModule?.id === mod.id) setCurrentModule(m => m ? { ...m, title } : m);
                    }}
                    onBlur={async e => {
                      const fallback = (mod as any).is_intro ? 'Introduction' : (mod as any).is_conclusion ? 'Conclusion' : (mod as any).is_final_exam ? 'Examen final' : `Module ${Math.max(1, builderModules.filter(m => sectionTypeOf(m) === 'module').findIndex(m => m.id === mod.id) + 1)}`;
                      const title = e.target.value.trim() || fallback;
                      setModules(ms => ms.map(m => m.id === mod.id ? { ...m, title } : m));
                      if (currentModule?.id === mod.id) setCurrentModule(m => m ? { ...m, title } : m);
                      const result = await api('update_module', { course_id: course.id, module_id: mod.id, title });
                      if (!result.success) {
                        showToast(result.message || result.error || 'Le titre du module n’a pas été enregistré.', 'error');
                        await reloadCourse(course.id);
                      } else if (result.module?.title) {
                        const persistedTitle = String(result.module.title);
                        setModules(ms => ms.map(m => m.id === mod.id ? { ...m, title: persistedTitle } : m));
                        if (currentModule?.id === mod.id) setCurrentModule(m => m ? { ...m, title: persistedTitle } : m);
                      }
                    }}
                    disabled={locked}
                    aria-label="Titre du module"
                  />
                  {!mod.is_intro && !mod.is_conclusion && !mod.is_final_exam && (
                    <div className="mb-1 flex items-center gap-1">
                      <button type="button" onClick={() => addModuleStage(mod, 'module_presentation')} disabled={locked} className="text-[10px] px-2 py-0.5 rounded-full border" style={{borderColor:'#BF8813',color:'#92400E'}}>Présentation</button>
                      <button type="button" onClick={() => deleteModule(mod)} disabled={locked} className="rounded-full p-1 text-red-600 hover:bg-red-50" title="Supprimer ce module"><Trash2 size={11}/></button>
                    </div>
                  )}
                  <div className="flex gap-1">
                    {(currentModule?.id === mod.id || mod.is_intro || mod.is_conclusion || mod.is_final_exam) && (mod.lessons || []).map(lesson => (
                      <span key={lesson.id} className="inline-flex items-center gap-0.5">
                      <button
                        onClick={() => { setShowFinalization(false); selectLesson(mod, lesson); }}
                        className="text-xs px-2 py-0.5 rounded-full border transition-all"
                        title={lesson.is_module_intro ? 'Présentation facultative du module' : lesson.title}
                        style={currentLesson?.id === lesson.id
                          ? { background: '#002050', color: 'white', borderColor: '#002050' }
                          : { borderColor: lesson.is_module_intro ? '#BF8813' : '#E4E7EC', color: lesson.is_module_intro ? '#92400E' : '#6B7280', background: lesson.is_module_intro ? '#FFFBEB' : 'white' }}>
                        {lesson.title}
                      </button>
                      {stageTypeOf(lesson) === 'lesson' && (
                        <button type="button" onClick={() => selectAssessmentWorkspace(mod, lesson, 'lesson')} disabled={locked} className="text-[10px] px-1.5 py-0.5 rounded-full border" style={assessmentWorkspace?.lessonId===lesson.id&&assessmentWorkspace.scope==='lesson'?{background:'#7C3AED',color:'white',borderColor:'#7C3AED'}:{borderColor:'#DDD6FE',color:'#6D28D9',background:'#F5F3FF'}}>Évaluation</button>
                      )}
                      {stageTypeOf(lesson) === 'module_summary' && (
                        <button type="button" onClick={() => selectAssessmentWorkspace(mod, lesson, 'module')} disabled={locked} className="text-[10px] px-1.5 py-0.5 rounded-full border" style={assessmentWorkspace?.lessonId===lesson.id&&assessmentWorkspace.scope==='module'?{background:'#7C3AED',color:'white',borderColor:'#7C3AED'}:{borderColor:'#DDD6FE',color:'#6D28D9',background:'#F5F3FF'}}>Évaluation module</button>
                      )}
                      {!mod.is_intro && !mod.is_conclusion && !mod.is_final_exam && (
                        <button type="button" onClick={() => deleteLesson(mod, lesson)} disabled={locked} className="rounded-full p-0.5 text-red-500 hover:bg-red-50" title="Supprimer cette étape"><Trash2 size={10}/></button>
                      )}
                      </span>
                    ))}
                    {sectionTypeOf(mod) === 'module' && (
                      <>
                        <button onClick={() => setBuilderImportTarget({ type: 'module', id: mod.id })} disabled={locked || !course.id}
                          className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full border border-dashed disabled:opacity-40"
                          style={{ borderColor: '#E4E7EC', color: '#002050' }} title="Importer un document dans ce module">
                          <UploadCloud size={10} /> Importer
                        </button>
                        <button onClick={() => addLesson(mod)} disabled={locked}
                          className="text-xs px-1.5 py-0.5 rounded-full border border-dashed disabled:opacity-40"
                          style={{ borderColor: '#BF8813', color: '#BF8813' }}>
                          + Leçon
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              <button onClick={async () => { if (!course.id) { const created = await ensureCourseCreated(); if (!created) return; } await addModule(); }} disabled={locked}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-dashed flex-shrink-0 disabled:opacity-40"
                style={{ borderColor: '#002050', color: '#002050' }}>
                <Plus size={11} /> Module
              </button>
              {endingSections.map(mod => (
                <div key={mod.id} className="flex-shrink-0">
                  <input
                    className="w-full bg-transparent text-xs font-semibold mb-1 outline-none border-b border-transparent focus:border-[#BF8813]"
                    style={{ color: currentModule?.id === mod.id ? '#002050' : '#6B7280' }}
                    value={mod.title}
                    onClick={e => e.stopPropagation()}
                    onChange={e => { const title=e.target.value; setModules(ms=>ms.map(m=>m.id===mod.id?{...m,title}:m)); if(currentModule?.id===mod.id)setCurrentModule(m=>m?{...m,title}:m); }}
                    onBlur={async e => { const fallback=sectionTypeOf(mod)==='conclusion'?'Conclusion de la formation':'Examen final'; const title=e.target.value.trim()||fallback; const result=await api('update_module',{course_id:course.id,module_id:mod.id,title}); if(!result.success){showToast(result.message||result.error||'Le titre n’a pas été enregistré.','error');await reloadCourse(course.id);} else {setModules(ms=>ms.map(m=>m.id===mod.id?{...m,title}:m));} }}
                    disabled={locked}
                    aria-label={sectionTypeOf(mod)==='conclusion'?'Titre de la conclusion':'Titre de l’examen final'}
                  />
                  <div className="flex gap-1">
                    {(mod.lessons||[]).map(lesson => (
                      <span key={lesson.id} className="inline-flex items-center gap-1">
                        <button onClick={()=>{setShowFinalization(false);selectLesson(mod,lesson);}} className="text-xs px-2 py-0.5 rounded-full border transition-all" style={currentLesson?.id===lesson.id&&!assessmentWorkspace?{background:'#002050',color:'white',borderColor:'#002050'}:{borderColor:'#E4E7EC',color:'#6B7280',background:'white'}}>{lesson.title}</button>
                        {stageTypeOf(lesson)==='final_exam' && <button type="button" onClick={()=>selectAssessmentWorkspace(mod,lesson,'final')} disabled={locked} className="text-[10px] px-1.5 py-0.5 rounded-full border" style={assessmentWorkspace?.lessonId===lesson.id&&assessmentWorkspace.scope==='final'?{background:'#7C3AED',color:'white',borderColor:'#7C3AED'}:{borderColor:'#DDD6FE',color:'#6D28D9',background:'#F5F3FF'}}>Épreuve officielle</button>}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {!endingSections.some(m => sectionTypeOf(m) === 'conclusion') && <button onClick={async()=>{if(!course.id){const created=await ensureCourseCreated();if(!created)return;} const d=await api('ensure_special_sections',{course_id:courseRef.current.id,include_final_exam:false}); if(d.success){await reloadCourse(courseRef.current.id);showToast('Conclusion prête à construire');}else showToast(d.message||d.error||'Création impossible','error');}} disabled={locked} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-dashed flex-shrink-0 disabled:opacity-40" style={{borderColor:'#BF8813',color:'#92400E'}}><Plus size={11}/> Ajouter la conclusion</button>}
              {!endingSections.some(m => sectionTypeOf(m) === 'final_exam') && <button onClick={async()=>{if(!course.id){const created=await ensureCourseCreated();if(!created)return;} const d=await api('ensure_special_sections',{course_id:courseRef.current.id,include_final_exam:true}); if(d.success){await reloadCourse(courseRef.current.id);showToast('Examen final facultatif ajouté');}else showToast(d.message||d.error||'Création impossible','error');}} disabled={locked} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-dashed flex-shrink-0 disabled:opacity-40" style={{borderColor:'#BF8813',color:'#92400E'}}><Plus size={11}/> Ajouter un examen final (facultatif)</button>}
              <button onClick={runQualityCheck} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border flex-shrink-0" style={{background:'white',color:'#1E7A52',borderColor:'#1E7A52'}}><CheckCircle size={11}/> Qualité</button>
              <button onClick={()=>{setShowFinalization(true);setCurrentModule(null);setCurrentLesson(null);setBlocks([]);setSelectedBlock(null);}} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border flex-shrink-0" style={showFinalization?{background:'#002050',color:'white',borderColor:'#002050'}:{background:'white',color:'#002050',borderColor:'#002050'}}><ShieldCheck size={11}/> Finalisation</button>
            </div>
          </div>
          )}


          {/* Canevas */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6" style={{ background: '#F0F2F5' }} onDragOver={(e) => { if (e.dataTransfer.types.includes('application/x-omnia-block')) e.preventDefault(); }} onDrop={async (e) => { const bt = e.dataTransfer.getData('application/x-omnia-block'); if (bt) { e.preventDefault(); await addBlock(bt); } }}>

            {/* ── VUE INFOS FORMATION ──────────────────── */}
            {!currentModule && !showFinalization && (
              <div className="max-w-5xl mx-auto space-y-4">
                <h2 className="text-lg font-bold" style={{ color: '#002050' }}>Informations de la formation</h2>

                {course?.admin_comment && (
                  <div className="p-4 rounded-xl border" style={{ background: '#FEF3C7', borderColor: '#FDE68A' }}>
                    <p className="text-xs font-bold mb-1" style={{ color: '#92400E' }}>Message de l’Administration Omnia</p>
                    <p className="text-sm" style={{ color: '#92400E' }}>{course.admin_comment}</p>
                  </div>
                )}

                {[
                  { field: 'course_code', label: 'Code de la formation *', placeholder: 'Ex : NEG-101', type: 'course_code' },
                  { field: 'title', label: 'Titre de la formation *', placeholder: 'Ex: Comptabilité générale pour débutants', type: 'text' },
                  { field: 'short_description', label: 'Description courte *', placeholder: 'Résumé affiché sur la carte et avant l’achat...', type: 'textarea' },
                  { field: 'long_description', label: 'Présentation détaillée *', placeholder: 'Présentez le contenu, l’approche pédagogique, les bénéfices et ce que l’apprenant saura faire...', type: 'textarea' },
                  { field: 'target_audience', label: 'À qui s’adresse cette formation ?', placeholder: 'Ex : débutants, entrepreneurs, responsables administratifs...', type: 'textarea' },
                  { field: 'category', label: 'Catégorie *', placeholder: '', type: 'select', options: [...CATEGORY_LABELS] },
                  { field: 'level', label: 'Niveau *', placeholder: '', type: 'select', options: COURSE_LEVEL_OPTIONS },
                  { field: 'language', label: 'Langue principale du contenu *', placeholder: '', type: 'select', options: COURSE_LANGUAGE_OPTIONS },
                  { field: 'prerequisites', label: 'Prérequis', placeholder: 'Aucun prérequis particulier...', type: 'textarea' },
                ].map(({ field, label, placeholder, type, options }) => (
                  <div key={field} className="bg-white rounded-xl border p-4" style={{ borderColor: '#E4E7EC' }}>
                    <label className="block text-xs font-semibold mb-2" style={{ color: '#002050' }}>{label}</label>
                    {type === 'textarea' ? (
                      <textarea className="w-full px-3 py-2.5 border rounded-lg text-sm resize-none focus:outline-none focus:border-[#002050]"
                        style={{ borderColor: '#E4E7EC' }} rows={3}
                        value={(course as any)?.[field] || ''}
                        onChange={e => updateCourse(field as keyof Course, field === 'course_code' ? normalizeCourseCode(e.target.value) : e.target.value)}
                        placeholder={placeholder} disabled={locked}
                        inputMode={field === 'course_code' ? 'text' : undefined}
                        autoCapitalize={field === 'course_code' ? 'characters' : undefined} />
                    ) : type === 'select' ? (
                      <select className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:border-[#002050]"
                        style={{ borderColor: '#E4E7EC' }}
                        value={(course as any)?.[field] || ''}
                        onChange={e => updateCourse(field as keyof Course, e.target.value)}
                        disabled={locked}>
                        <option value="">Sélectionner...</option>
                        {options?.map((o: any) => { const value = typeof o === 'string' ? o : o.value; const text = typeof o === 'string' ? o : o.label; return <option key={value} value={value}>{text}</option>; })}
                      </select>
                    ) : (
                      <input className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:border-[#002050]"
                        style={{ borderColor: '#E4E7EC' }}
                        value={(course as any)?.[field] || ''}
                        onChange={e => updateCourse(field as keyof Course, e.target.value)}
                        placeholder={placeholder} disabled={locked} />
                    )}
                  </div>
                ))}

                <div className="bg-white rounded-xl border p-4" style={{ borderColor: '#E4E7EC' }}>
                  <label className="block text-xs font-semibold mb-2" style={{ color: '#002050' }}>Type de formation</label>
                  <select className="w-full px-3 py-2.5 border rounded-lg text-sm" style={{ borderColor: '#E4E7EC' }} value={course.course_type || 'standard'} onChange={e => updateCourse('course_type', e.target.value as Course['course_type'])} disabled={locked}>
                    <option value="standard">Formation standard</option><option value="language_learning">Apprentissage d’une langue</option>
                  </select>
                </div>
                {course.course_type === 'language_learning' && <div className="bg-white rounded-xl border p-4 space-y-3" style={{ borderColor: '#BF8813' }}>
                  <p className="text-xs font-bold" style={{ color: '#92400E' }}>Paramètres linguistiques — CECRL / CEFR</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-xs font-semibold">Langue d’enseignement<select className="mt-1 w-full px-3 py-2 border rounded-lg font-normal" value={course.instruction_language || course.language || 'fr'} onChange={e=>updateCourse('instruction_language',e.target.value)} disabled={locked}>{COURSE_LANGUAGE_OPTIONS.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
                    <label className="text-xs font-semibold">Langue étudiée<select className="mt-1 w-full px-3 py-2 border rounded-lg font-normal" value={course.target_language || ''} onChange={e=>updateCourse('target_language',e.target.value)} disabled={locked}><option value="">Sélectionner...</option>{COURSE_LANGUAGE_OPTIONS.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
                    <label className="text-xs font-semibold">Niveau de départ<select className="mt-1 w-full px-3 py-2 border rounded-lg font-normal" value={course.cefr_start_level || ''} onChange={e=>updateCourse('cefr_start_level',e.target.value)} disabled={locked}><option value="">Non précisé</option>{['A1','A2','B1','B2','C1','C2'].map(x=><option key={x} value={x}>{x}</option>)}</select></label>
                    <label className="text-xs font-semibold">Niveau visé<select className="mt-1 w-full px-3 py-2 border rounded-lg font-normal" value={course.cefr_target_level || ''} onChange={e=>updateCourse('cefr_target_level',e.target.value)} disabled={locked}><option value="">Non précisé</option>{['A1','A2','B1','B2','C1','C2'].map(x=><option key={x} value={x}>{x}</option>)}</select></label>
                  </div>
                  <p className="text-xs text-slate-500">La langue de l’interface Omnia reste indépendante. Aucune traduction automatique du contenu n’est effectuée.</p>
                </div>}

                {/* Image de couverture visible avant achat */}
                <div className="bg-white rounded-xl border p-4" style={{ borderColor: '#E4E7EC' }}>
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <label className="block text-xs font-semibold" style={{ color: '#002050' }}>Image de couverture *</label>
                      <p className="text-xs mt-1" style={{ color: '#6B7280' }}>Elle sera affichée sur la vitrine, la fiche de formation et avant l’achat.</p>
                    </div>
                    {course.cover_image_url && <button type="button" onClick={() => updateCourse('cover_image_url', '')} className="text-xs" style={{ color: '#DC2626' }}>Supprimer</button>}
                  </div>
                  <div className="rounded-xl border overflow-hidden mb-3 flex items-center justify-center" style={{ borderColor: '#E4E7EC', background: '#F8FAFC', aspectRatio: '16 / 9' }}>
                    {course.cover_image_url ? <img src={course.cover_image_url} alt="Couverture de la formation" className="w-full h-full object-cover" /> : <div className="text-center p-6"><Image size={28} className="mx-auto mb-2" style={{ color: '#BF8813' }} /><p className="text-sm" style={{ color: '#6B7280' }}>Aucune image sélectionnée</p></div>}
                  </div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <label className="cursor-pointer px-3 py-2 rounded-lg border text-xs font-semibold" style={{ borderColor: '#002050', color: '#002050' }}>
                      Importer une image
                      <input type="file" accept="image/*" className="hidden" onChange={e => { const f=e.target.files?.[0]; if(f) uploadCoverImage(f); e.currentTarget.value=''; }} />
                    </label>
                    <input className="flex-1 min-w-[220px] px-3 py-2 border rounded-lg text-sm" style={{ borderColor: '#E4E7EC' }} value={course.cover_image_url || ''} onChange={e => updateCourse('cover_image_url', e.target.value)} placeholder="Ou collez l’URL d’une image" />
                  </div>
                  <div className="rounded-xl p-3" style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                    <div className="flex items-center gap-2 mb-2"><Sparkles size={15} style={{ color: '#BF8813' }} /><p className="text-xs font-semibold" style={{ color: '#92400E' }}>Générer des propositions avec l’IA</p></div>
                    <textarea rows={3} className="w-full px-3 py-2 border rounded-lg text-sm resize-none" style={{ borderColor: '#FDE68A' }} value={coverPrompt} onChange={e => setCoverPrompt(e.target.value)} placeholder="Décrivez le thème, le public et l’ambiance souhaitée. Ex : formation pratique en comptabilité SYSCOHADA pour entrepreneurs africains, style professionnel, sans personnage..." />
                    <button type="button" onClick={generateCoverImages} disabled={coverGenerating || locked || Number(course.cover_ai_generation_count || 0) >= 2} className="mt-2 px-3 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50" style={{ background: '#002050' }}>{coverGenerating ? 'Génération en cours…' : Number(course.cover_ai_generation_count || 0) >= 2 ? 'Limite atteinte' : `Générer 2 images (${Number(course.cover_ai_generation_count || 0)}/2)`}</button>
                    {coverCandidates.length > 0 && <div className="grid grid-cols-2 gap-2 mt-3">{coverCandidates.map((url, i) => <button type="button" key={url} onClick={async () => { updateCourse('cover_image_url', url); if(course.id) await api('update_course',{course_id:course.id,cover_image_url:url,cover_image_prompt:coverPrompt}); }} className="rounded-lg overflow-hidden border hover:ring-2" style={{ borderColor: course.cover_image_url===url ? '#BF8813' : '#E4E7EC' }}><img src={url} alt={`Proposition ${i+1}`} className="w-full aspect-video object-cover" /></button>)}</div>}
                  </div>
                </div>

                {/* L’introduction est construite après cet écran avec les mêmes blocs que les leçons. */}
                {/* Objectifs */}
                <div className="bg-white rounded-xl border p-4" style={{ borderColor: '#E4E7EC' }}>
                  <label className="block text-xs font-semibold mb-2" style={{ color: '#002050' }}>Objectifs pédagogiques *</label>
                  <div className="space-y-2 mb-2">
                    {(course?.objectives || []).map((obj, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-[#002050]"
                          style={{ borderColor: '#E4E7EC' }} value={obj}
                          onChange={e => { const objs = [...(course?.objectives || [])]; objs[i] = e.target.value; updateCourse('objectives', objs); }}
                          placeholder={`Objectif ${i + 1}...`} disabled={locked} />
                        <button onClick={() => { const objs = (course?.objectives || []).filter((_, j) => j !== i); updateCourse('objectives', objs); }} disabled={locked}>
                          <Trash2 size={13} style={{ color: '#DC2626' }} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button disabled={locked} onClick={() => updateCourse('objectives', [...(course?.objectives || []), ''])}
                    className="flex items-center gap-1.5 text-xs font-semibold disabled:opacity-40" style={{ color: '#002050' }}>
                    <Plus size={12} /> Ajouter un objectif
                  </button>
                </div>

                <div className="rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" style={{ background: course.id ? '#ECFDF5' : '#EFF6FF', borderColor: course.id ? '#A7F3D0' : '#BFDBFE' }}>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#002050' }}>{course.id ? 'Brouillon créé et synchronisé' : 'Enregistrez les informations pour commencer la construction'}</p>
                    <p className="text-xs mt-1" style={{ color: '#6B7280' }}>{course.id ? 'Ouvrez Introduction, puis ajoutez vos modules et leurs leçons avec les blocs.' : 'Les champs restent modifiables. L’introduction sera automatiquement créée avant le premier module.'}</p>
                  </div>
                  <button type="button" onClick={save} disabled={saving || creatingDraft || locked} className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background: '#002050' }}>{saving || creatingDraft ? 'Enregistrement…' : course.id ? 'Enregistrer les modifications' : 'Enregistrer et commencer'}</button>
                </div>
              </div>
            )}

            {showFinalization && (
              <div className="max-w-4xl mx-auto space-y-4">
                <div className="bg-white rounded-xl border p-5" style={{borderColor:'#E4E7EC'}}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold" style={{color:'#002050'}}>Finalisation</h2>
                      <p className="mt-1 text-sm text-gray-500">Configurez uniquement les décisions nécessaires avant publication. Le contrôle Qualité reste séparé.</p>
                    </div>
                    <span className="rounded-full px-3 py-1 text-[11px] font-bold" style={{background:advancedMode?'#EEF2FF':'#F3F4F6',color:'#002050'}}>{advancedMode?'Mode avancé':'Mode simple'}</span>
                  </div>
                </div>

                <div className="bg-white rounded-xl border p-5" style={{borderColor:'#E4E7EC'}}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold" style={{color:'#002050'}}>1 · Progression & évaluations</h3>
                      <p className="mt-1 text-xs text-slate-500">Définissez les évaluations obligatoires, les seuils et les reprises.{advancedMode ? ' Les paramètres professionnels avancés sont également disponibles.' : ''}</p>
                    </div>
                    <button type="button" onClick={openAssessmentPolicy} disabled={openingAssessmentPolicy || locked} className="inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50" style={{borderColor:'#002050',color:'#002050'}}><ClipboardCheck size={15}/>Configurer</button>
                  </div>
                  {advancedMode && <div className="mt-4"><CourseAdvancedSettingsPanel course={course} locked={locked} onPatch={(patch)=>setCourse(c=>({...c,...patch}))} onSaved={(msg)=>showToast(msg, msg.toLowerCase().includes('erreur') ? 'error' : 'success')} /></div>}
                </div>

                <StudioCommercialCertificationPanel course={course} locked={locked} advancedMode={advancedMode} onPatch={(patch)=>setCourse(c=>({...c,...patch}))} onSaved={(msg)=>{setFinalizationCheck(null);showToast(msg, msg.toLowerCase().includes('erreur') ? 'error' : 'success')}} />

                <div className="bg-white rounded-xl border p-5" style={{borderColor:'#E4E7EC'}}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold" style={{color:'#002050'}}>4 · Vérification & publication</h3>
                      <p className="mt-1 text-xs text-slate-500">Un seul contrôle final vérifie la Qualité puis la cohérence des choix de Finalisation.</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg border px-3 py-2 text-xs" style={{borderColor:course.quality_status==='ready'?'#A7F3D0':'#E4E7EC',background:course.quality_status==='ready'?'#ECFDF5':'#F8FAFC',color:'#374151'}}><strong>Qualité</strong><span className="ml-2">{course.quality_status==='ready'?'✓ contrôlée':'à contrôler'}</span></div>
                    <div className="rounded-lg border px-3 py-2 text-xs" style={{borderColor:course.assessment_policy?.builder_configured_at?'#A7F3D0':'#E4E7EC',background:course.assessment_policy?.builder_configured_at?'#ECFDF5':'#F8FAFC',color:'#374151'}}><strong>Évaluations</strong><span className="ml-2">{course.assessment_policy?.builder_configured_at?'✓ configurées':'à configurer'}</span></div>
                    <div className="rounded-lg border px-3 py-2 text-xs" style={{borderColor:course.sale_mode && (course.sale_mode==='free'||Number(course.desired_price_amount||0)>0)?'#A7F3D0':'#E4E7EC',background:course.sale_mode && (course.sale_mode==='free'||Number(course.desired_price_amount||0)>0)?'#ECFDF5':'#F8FAFC',color:'#374151'}}><strong>Commercialisation</strong><span className="ml-2">{course.sale_mode==='free'?'✓ gratuite':course.sale_mode==='paid'&&Number(course.desired_price_amount||0)>0?'✓ prix renseigné':'à compléter'}</span></div>
                    <div className="rounded-lg border px-3 py-2 text-xs" style={{borderColor:course.certificate_mode!=='external'||course.certification_requested?'#A7F3D0':'#E4E7EC',background:course.certificate_mode!=='external'||course.certification_requested?'#ECFDF5':'#F8FAFC',color:'#374151'}}><strong>Certification</strong><span className="ml-2">{course.certificate_mode==='external'?(course.certification_requested?'✓ demandée':'à compléter'):'✓ non bloquante'}</span></div>
                  </div>
                  {finalizationCheck && !finalizationCheck.valid && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="text-xs font-bold text-amber-900">Éléments à compléter avant publication</p><ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-800">{finalizationCheck.errors.map((message,index)=><li key={index}>{message}</li>)}</ul></div>}
                  {advancedMode && course.id && course.studio_status && !['draft','changes_requested'].includes(String(course.studio_status)) && <div className="mt-4"><StudioQualityStatusPanel courseId={course.id} /></div>}
                  <div className="mt-4 flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between" style={{borderColor:'#EEF1F5'}}>
                    <button onClick={()=>{setShowFinalization(false);setCurrentModule(null);setCurrentLesson(null);}} className="flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium" style={{borderColor:'#E4E7EC',color:'#374151'}}><ChevronLeft size={15}/>Retour aux informations</button>
                    <button onClick={submit} disabled={submitting||workflowLocked} className="flex items-center justify-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{background:'#BF8813'}}><Send size={15}/>{submitting?'Vérification…':course.creator_context === 'super_admin' ? 'Publier la formation' : 'Soumettre la formation'}</button>
                  </div>
                </div>
              </div>
            )}

            {/* ── VUE LEÇON + BLOCS ────────────────────── */}
            {currentLesson && (
              <div className="max-w-6xl mx-auto">
                {/* Header leçon */}
                <div className="bg-white rounded-xl border p-4 mb-4" style={{ borderColor: '#E4E7EC' }}>
                  <input className="text-xl font-bold bg-transparent border-none outline-none w-full"
                    style={{ color: '#002050' }}
                    value={currentLesson.title}
                    onChange={e => {
                      const newTitle = e.target.value;
                      setCurrentLesson(l => l ? { ...l, title: newTitle } : l);
                      setModules(ms => ms.map(m => ({ ...m, lessons: (m.lessons || []).map(l => l.id === currentLesson.id ? { ...l, title: newTitle } : l) })));
                    }}
                    onBlur={async e => {
                      const fallback = currentLesson.is_module_intro ? 'Présentation du module' : currentLesson.is_intro ? 'Introduction' : currentLesson.is_conclusion ? 'Conclusion' : currentLesson.is_final_exam ? 'Examen final' : 'Leçon';
                      const title = e.target.value.trim() || fallback;
                      setCurrentLesson(l => l ? { ...l, title } : l);
                      setModules(ms => ms.map(m => ({ ...m, lessons: (m.lessons || []).map(l => l.id === currentLesson.id ? { ...l, title } : l) })));
                      const lessonId = currentLesson.id;
                      const result = await api('update_lesson', { course_id: course.id, lesson_id: lessonId, title });
                      if (!result.success) {
                        showToast(result.message || result.error || 'Le titre de la leçon n’a pas été enregistré.', 'error');
                        await reloadCourse(course.id);
                      } else if (result.lesson?.title) {
                        const persistedTitle = String(result.lesson.title);
                        setCurrentLesson(l => l?.id === lessonId ? { ...l, title: persistedTitle } : l);
                        setModules(ms => ms.map(m => ({ ...m, lessons: (m.lessons || []).map(l => l.id === lessonId ? { ...l, title: persistedTitle } : l) })));
                      }
                    }}
                    disabled={locked} spellCheck lang={course?.instruction_language || course?.language || 'fr'} />
                  {assessmentWorkspace && (
                    <div className="mt-3 rounded-xl border px-3 py-2" style={{borderColor:'#DDD6FE',background:'#F5F3FF'}}>
                      <p className="text-xs font-bold" style={{color:'#6D28D9'}}>{assessmentWorkspace.scope==='lesson'?'Sous-espace · Évaluation de la leçon':assessmentWorkspace.scope==='module'?'Sous-espace · Évaluation du module':'Sous-espace · Épreuve officielle finale'}</p>
                      <p className="mt-1 text-[11px] text-slate-500">Ajoutez ici uniquement les questions de l’évaluation officielle. Elles ne seront pas répétées dans le contenu pédagogique.</p>
                    </div>
                  )}
                  {!assessmentWorkspace && !locked && course.id && (
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <button type="button" onClick={() => setBuilderImportTarget({ type: 'lesson', id: currentLesson.id })} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold" style={{ borderColor: '#E4E7EC', color: '#002050' }}>
                        <UploadCloud size={13} /> Importer un document dans cette leçon
                      </button>
                      {(currentLesson.stage_type || (currentLesson.is_module_intro ? 'module_presentation' : currentLesson.is_intro ? 'introduction' : currentLesson.is_conclusion ? 'conclusion' : currentLesson.is_final_exam ? 'final_exam' : 'lesson')) === 'lesson' && (
                        <label className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold" style={{ borderColor:'#E4E7EC', color:'#002050' }}>
                          <input
                            type="checkbox"
                            checked={currentLesson.is_free_preview === true}
                            onChange={async e => {
                              const lessonId = currentLesson.id;
                              const enabled = e.target.checked;
                              const result = await api('update_lesson', { course_id: course.id, lesson_id: lessonId, is_free_preview: enabled });
                              if (!result.success) {
                                showToast(result.message || result.error || 'Le réglage de l’aperçu avant achat n’a pas été enregistré.', 'error');
                                return;
                              }
                              const selectedId = enabled ? lessonId : null;
                              setCurrentLesson(l => l?.id === lessonId ? { ...l, is_free_preview: enabled } : l);
                              setModules(ms => ms.map(m => ({ ...m, lessons: (m.lessons || []).map(l => ({ ...l, is_free_preview: selectedId ? l.id === selectedId : (l.id === lessonId ? false : l.is_free_preview) })) })));
                              showToast(enabled ? 'Cette leçon sera utilisée dans l’aperçu avant achat.' : 'Cette leçon n’est plus utilisée dans l’aperçu avant achat.', 'success');
                            }}
                          />
                          Autoriser cette leçon dans l’aperçu avant achat
                        </label>
                      )}
                    </div>
                  )}
                  {currentLesson.is_module_intro && (
                    <p className="text-xs mt-2" style={{ color: '#6B7280' }}>Cette présentation est facultative. Utilisez les blocs pour expliquer le module, ses objectifs, sa méthode ou ses ressources avant la première leçon.</p>
                  )}
                </div>

                {/* Blocs */}
                <div className="space-y-3">
                  {displayedBlocks.map((block) => {
                    const idx = blocks.findIndex(item => item.id === block.id);
                    const def = BLOCK_DEFS.find(d => d.type === block.block_type);
                    const isSelected = selectedBlock?.id === block.id;
                    return (
                      <div key={block.id}
                        onDragOver={e => onDragOver(e, idx)}
                        onDrop={e => onDrop(e, idx)}
                        className="relative group"
                        style={{ opacity: dragOverIdx === idx ? 0.5 : 1 }}>
                        <div className={`bg-white rounded-xl border transition-all ${isSelected ? 'ring-2' : ''}`}
                          style={{ borderColor: isSelected ? '#002050' : '#E4E7EC', ringColor: '#002050' }}>
                          {/* Header bloc */}
                          <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: '#F3F4F6' }}>
                            <div className="flex items-center gap-2">
                              <span draggable={!locked} onDragStart={e => onDragStart(idx, e)} onDragEnd={() => { dragIdx.current=null; setDragOverIdx(null); }} title="Déplacer le bloc" aria-label="Poignée de déplacement du bloc" className={`inline-flex select-none ${locked ? 'opacity-30' : 'cursor-grab'}`}><GripVertical size={15} style={{ color: '#6B7280' }} /></span>
                              {def && <def.icon size={14} style={{ color: def.color }} />}
                              <span className="text-xs font-semibold" style={{ color: '#6B7280' }}>{def?.label || block.block_type}</span>
                              {block.ai_generated && !block.ai_confirmed && (
                                <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#FEF3C7', color: '#92400E', fontSize: '9px' }}>IA — à valider</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                              {course.id && ['text','heading','subtitle','objective','summary','example','definition','important','remember','key_takeaway','callout','quote','bullet_list','numbered_list','list','interactive_table','table','code'].includes(block.block_type) && (
                                <button title="Remplir ce bloc depuis un document" onClick={e => { e.stopPropagation(); setBuilderImportTarget({ type: 'block', id: block.id }); }} className="p-1 rounded hover:bg-gray-100" disabled={locked}>
                                  <UploadCloud size={13} style={{ color: '#BF8813' }} />
                                </button>
                              )}
                              <button title="Réglages du bloc" onClick={e => { e.stopPropagation(); setSelectedBlock(block); setSelectedBlockDef(def || null); setShowPreview(false); setShowAI(false); }} className="p-1 rounded hover:bg-gray-100">
                                <Settings size={13} style={{ color: '#002050' }} />
                              </button>
                              <button type="button" aria-label={`Déplacer ${def?.label||block.block_type} vers le haut`} title="Déplacer vers le haut" onClick={e => { e.stopPropagation(); moveBlock(idx, -1); }} className="p-1 rounded hover:bg-gray-100" disabled={locked || idx === 0}>
                                <ChevronUp size={12} style={{ color: '#6B7280' }} />
                              </button>
                              <button type="button" aria-label={`Déplacer ${def?.label||block.block_type} vers le bas`} title="Déplacer vers le bas" onClick={e => { e.stopPropagation(); moveBlock(idx, 1); }} className="p-1 rounded hover:bg-gray-100" disabled={locked || idx === blocks.length - 1}>
                                <ChevronDown size={12} style={{ color: '#6B7280' }} />
                              </button>
                              <button onClick={e => { e.stopPropagation(); duplicateBlock(block); }} className="p-1 rounded hover:bg-gray-100" disabled={locked}>
                                <Copy size={12} style={{ color: '#6B7280' }} />
                              </button>
                              <button onClick={e => { e.stopPropagation(); deleteBlock(block.id); }} className="p-1 rounded hover:bg-red-50" disabled={locked}>
                                <Trash2 size={12} style={{ color: '#DC2626' }} />
                              </button>
                            </div>
                          </div>

                          {/* Contenu du bloc */}
                          <div className="p-4" style={{ fontFamily: String(block.settings_json?.font_family || 'Inter, system-ui, sans-serif'), fontSize: block.settings_json?.font_scale === 'small' ? '0.875rem' : block.settings_json?.font_scale === 'large' ? '1.075rem' : undefined, textAlign: (block.settings_json?.text_align || 'left') as any }}>
                            <BuilderBlockBoundary blockType={block.block_type}>
                            <BlockPreview block={block} def={def} locked={locked} mediaAiBusy={mediaAiBusy}
                              defaultLanguage={course?.instruction_language || course?.language || 'fr'}
                              onGenerateTts={(text,targetPath)=>generateTtsForBlock(block,text,targetPath)}
                              onGenerateSubtitles={()=>generateSubtitlesForBlock(block)}
                              onChange={async (content_json) => {
                                setBlocks(bs => bs.map(b => b.id === block.id ? { ...b, content_json } : b));
                                if (isSelected) setSelectedBlock(b => b ? { ...b, content_json } : b);
                                await queueBlockUpdate(block.id, { content_json });
                              }} />
                            </BuilderBlockBoundary>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {!locked && (
                    <div className="rounded-xl border bg-white p-3" style={{ borderColor: '#E4E7EC' }}>
                      <div className="flex items-center gap-2">
                        <Plus size={16} style={{ color: '#9CA3AF' }} />
                        <input
                          value={quickBlockQuery}
                          onChange={(event) => setQuickBlockQuery(event.target.value)}
                          onKeyDown={async (event) => {
                            if (event.key === 'Enter' && quickBlockMatches[0]) {
                              event.preventDefault();
                              await addBlock(quickBlockMatches[0].type);
                              setQuickBlockQuery('');
                            }
                          }}
                          className="min-w-0 flex-1 border-0 bg-transparent px-1 py-2 text-sm outline-none"
                          placeholder="Écrivez / puis le nom d’un bloc, ex. /image, /qcm, /tableau…"
                          aria-label="Ajouter rapidement un bloc"
                        />
                        <button type="button" onClick={() => setMobileLibraryOpen(true)} className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold" style={{ borderColor: '#E4E7EC', color: '#002050' }}>Tous les blocs</button>
                      </div>
                      {(quickBlockQuery.trim() || displayedBlocks.length === 0) && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {quickBlockMatches.map(def => <button key={def.type} type="button" onClick={async()=>{await addBlock(def.type);setQuickBlockQuery('');}} className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium" style={{ borderColor: '#E4E7EC', color: '#374151' }}><def.icon size={12} style={{ color: def.color }}/>{def.label}</button>)}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row justify-between gap-2 pt-3">
                    <button type="button" onClick={async () => { if (!currentModule || !currentLesson) return; const mi=modules.findIndex(m=>m.id===currentModule.id); const li=(currentModule.lessons||[]).findIndex(l=>l.id===currentLesson.id); const prev=(currentModule.lessons||[])[li-1]; if(prev){await selectLesson(currentModule,prev);return;} const pm=modules[mi-1]; if(pm?.lessons?.length) await selectLesson(pm,pm.lessons[pm.lessons.length-1]); }} className="px-4 py-2.5 rounded-lg text-sm font-semibold border" style={{borderColor:'#E4E7EC',color:'#374151',background:'white'}}><ChevronLeft size={14} className="inline mr-1"/> Page précédente</button>
                    <div className="flex flex-col sm:flex-row gap-2">
                    <button type="button" onClick={() => saveCurrentPage(false)} disabled={saving || locked}
                      className="px-4 py-2.5 rounded-lg text-sm font-semibold border disabled:opacity-50" style={{ borderColor: '#002050', color: '#002050', background: 'white' }}>
                      Enregistrer
                    </button>
                    <button type="button" onClick={() => saveCurrentPage(true)} disabled={saving || locked}
                      className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background: '#002050' }}>
                      Enregistrer et page suivante <ChevronRight size={14} className="inline ml-1" />
                    </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Message si pas de leçon sélectionnée et pas en vue infos */}
            {currentModule && !currentLesson && (
              <div className="max-w-xl mx-auto text-center py-16">
                <BookOpen size={40} className="mx-auto mb-3 opacity-20" style={{ color: '#002050' }} />
                <p className="font-semibold" style={{ color: '#002050' }}>Sélectionnez ou créez une leçon</p>
                <button onClick={() => addLesson(currentModule)} disabled={locked}
                  className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-white mx-auto disabled:opacity-40"
                  style={{ background: '#002050' }}>
                  <Plus size={14} /> Créer une leçon
                </button>
              </div>
            )}
          </div>

          {/* ── BARRE INFÉRIEURE ─────────────────────── */}
          <div className="hidden md:flex bg-white border-t px-4 py-2 items-center justify-between flex-shrink-0 text-xs" style={{ borderColor: '#E4E7EC', color: '#9CA3AF' }}>
            <div className="flex items-center gap-4">
              <span>Mots : {wordCount}</span>
              {wordCount > 0 && <span>Lecture : ~{Math.ceil(wordCount / 250)} min</span>}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setShowAI(v => !v)} className="flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-medium transition-all"
                style={showAI ? { borderColor: '#BF8813', color: '#BF8813', background: 'rgba(191,136,19,0.05)' } : { borderColor: '#E4E7EC', color: '#6B7280' }}>
                <Sparkles size={12} /> Assistant IA
              </button>
              <button onClick={runQualityCheck}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-medium"
                style={{ borderColor: '#E4E7EC', color: '#6B7280' }}>
                <CheckCircle size={12} /> Qualité
              </button>
              {courseSaveStatus === 'error' && <span role="alert" className="text-xs font-medium" style={{color:'#B91C1C'}}>Échec de sauvegarde des informations générales — réessayez avec Enregistrer.</span>}
              {courseSaveStatus === 'pending' && <span className="text-xs" style={{color:'#92400E'}}>Modifications des informations générales non enregistrées</span>}
              {courseSaveStatus === 'saving' && <span className="text-xs" style={{color:'#6B7280'}}>Sauvegarde des informations générales…</span>}
              {lastSave && courseSaveStatus === 'saved' && (
                <span className="flex items-center gap-1" style={{ color: '#1E7A52' }}>
                  <Check size={11} /> Informations générales enregistrées ({lastSave})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── COLONNE DROITE : Réglages ou Aperçu ─────── */}
        {(selectedBlock || showPreview || showAI) && (
          <div className="absolute inset-0 z-50 flex flex-col border-l bg-white md:static md:w-[300px]" style={{ borderColor: '#E4E7EC' }}>

            {/* ── ASSISTANT IA ──────────────────────── */}
            {showAI && !selectedBlock && (
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#E4E7EC' }}>
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} style={{ color: '#BF8813' }} />
                    <span className="font-bold text-sm" style={{ color: '#002050' }}>Assistant IA</span>
                  </div>
                  <button onClick={() => setShowAI(false)}><X size={16} style={{ color: '#9CA3AF' }} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  <select className="w-full px-3 py-2 border rounded-lg text-sm" style={{ borderColor: '#E4E7EC' }}
                    value={aiAction} onChange={e => setAiAction(e.target.value)}>
                    <option value="ai_improve_text">Améliorer un texte</option>
                    <option value="ai_simplify_text">Simplifier un texte</option>
                    <option value="ai_correct_grammar">Corriger l’orthographe et la grammaire</option>
                    <option value="ai_summarize">Résumer un texte</option>
                    <option value="ai_generate_qcm">Générer un QCM</option>
                    <option value="ai_generate_true_false">Générer Vrai/Faux</option>
                    <option value="ai_generate_quiz">Générer un quiz complet</option>
                    <option value="ai_create_summary">Bloc Résumé</option>
                    <option value="ai_create_remember">Bloc À retenir</option>
                    <option value="ai_suggest_structure">Suggérer une structure</option>
                    <option value="ai_suggest_objectives">Suggérer des objectifs</option>
                    <option value="ai_suggest_example">Suggérer un exemple</option>
                  </select>
                  <textarea className="w-full px-3 py-2 border rounded-lg text-sm resize-none focus:outline-none focus:border-[#002050]"
                    style={{ borderColor: '#E4E7EC' }} rows={5}
                    value={aiInput} onChange={e => setAiInput(e.target.value)}
                    placeholder="Saisissez votre texte ou sujet..." />
                  <div className="p-2 rounded-lg text-xs" style={{ background: '#FFFBEB', color: '#92400E' }}>
                    L'IA propose des suggestions. Vous validez toujours avant d'utiliser.
                  </div>
                  <button onClick={runAI} disabled={aiLoading || !aiInput.trim()}
                    className="w-full py-2 rounded-xl font-semibold text-white text-sm disabled:opacity-50"
                    style={{ background: '#002050' }}>
                    {aiLoading ? 'Génération...' : 'Générer'}
                  </button>
                  {aiResult && (
                    <div className="space-y-2">
                      <div className="p-3 rounded-xl border text-sm" style={{ borderColor: '#E4E7EC', background: '#F8F9FA', color: '#374151', whiteSpace: 'pre-wrap', maxHeight: '200px', overflowY: 'auto' }}>
                        {aiResult}
                      </div>
                      <button onClick={() => { navigator.clipboard?.writeText(aiResult); }}
                        className="w-full py-1.5 rounded-lg text-xs font-medium border" style={{ borderColor: '#1E7A52', color: '#1E7A52' }}>
                        Copier le résultat
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── RÉGLAGES BLOC ─────────────────────── */}
            {selectedBlock && !showPreview && (
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#E4E7EC' }}>
                  <div className="flex items-center gap-2">
                    {selectedBlockDef && <selectedBlockDef.icon size={14} style={{ color: selectedBlockDef.color }} />}
                    <span className="font-bold text-sm" style={{ color: '#002050' }}>{selectedBlockDef?.label || 'Bloc sélectionné'}</span>
                  </div>
                  <button onClick={() => { setSelectedBlock(null); setSelectedBlockDef(null); }}>
                    <X size={16} style={{ color: '#9CA3AF' }} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  <BlockSettings block={selectedBlock} locked={locked}
                    onUpdate={async (updates) => {
                      setBlocks(bs => bs.map(b => b.id === selectedBlock.id ? { ...b, ...updates } : b));
                      setSelectedBlock(b => b ? { ...b, ...updates } : b);
                      await queueBlockUpdate(selectedBlock.id, updates);
                    }}
                    onAI={async (action, prompt) => {
                      setAiAction(action); setAiInput(prompt); setShowAI(true); setSelectedBlock(null);
                    }}
                    onRemoveResource={() => removeBlockResource(selectedBlock)}
                    onBeforeUpload={flushBlockUpdates}
                    onResourceUploaded={(savedBlock) => {
                      // upload_block_file has already written the authoritative resource on the server.
                      // Do not queue a second update_block with a short-lived signed URL.
                      if (savedBlock?.id !== selectedBlock.id) return;
                      setBlocks(current => current.map(item => item.id === savedBlock.id ? { ...item, ...savedBlock } : item));
                      setSelectedBlock(current => current?.id === savedBlock.id ? { ...current, ...savedBlock } : current);
                    }}
                    courseId={course?.id || ''}
                    moduleId={currentModule?.id || ''}
                    lessonId={currentLesson?.id || ''}
                    lessonBlocks={blocks}
                    forcedAssessmentScope={assessmentWorkspace?.scope || null}
                  />
                </div>
              </div>
            )}

            {/* ── APERÇU ────────────────────────────── */}
            {showPreview && !selectedBlock && (
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#E4E7EC' }}>
                  <span className="font-bold text-sm" style={{ color: '#002050' }}>Aperçu apprenant</span>
                  <button onClick={() => setShowPreview(false)}><X size={16} style={{ color: '#9CA3AF' }} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  <LessonBlocksRenderer blocks={blocks as any} />
                  {blocks.length === 0 && (
                    <p className="text-sm text-center py-8" style={{ color: '#9CA3AF' }}>Aucun bloc à prévisualiser</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showAssessmentPolicy && course.id && (
        <AssessmentPolicyPanel
          courseId={course.id}
          locked={locked}
          advancedMode={advancedMode}
          onClose={closeAssessmentPolicy}
          onSaved={(policy) => {
            setCourse(current => current ? { ...current, assessment_policy: policy as Record<string, any> } : current);
            setChecklist(null);
          }}
        />
      )}



      {/* ── MODAL QUALITÉ ────────────────────────────── */}
      {showChecklist && checklist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#E4E7EC' }}>
              <h3 className="font-bold" style={{ color: '#002050' }}>Contrôle Qualité</h3>
              <button onClick={() => setShowChecklist(false)}><X size={18} style={{ color: '#6B7280' }} /></button>
            </div>
            <div className="p-6 space-y-3">
              {checklist.errors.length === 0 && (
                <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: '#D1FAE5' }}>
                  <CheckCircle size={16} style={{ color: '#065F46' }} />
                  <p className="text-sm font-semibold" style={{ color: '#065F46' }}>Qualité validée — prête pour finalisation</p>
                </div>
              )}
              {(checklist.issues || [
                ...checklist.errors.map(message => ({ severity: 'error' as const, message })),
                ...checklist.warnings.map(message => ({ severity: 'warning' as const, message })),
              ]).map((issue, i) => {
                const isError = issue.severity === 'error';
                return <div key={`${issue.severity}-${i}`} className="flex items-start gap-2 p-3 rounded-xl" style={{ background: isError ? '#FEE2E2' : '#FEF3C7' }}>
                  {isError ? <AlertCircle size={14} style={{ color: '#DC2626', flexShrink: 0, marginTop: 2 }} /> : <AlertTriangle size={14} style={{ color: '#D97706', flexShrink: 0, marginTop: 2 }} />}
                  <div className="min-w-0 flex-1"><p className="text-sm" style={{ color: isError ? '#DC2626' : '#92400E' }}>{issue.message}</p>
                    {issue.target && issue.target !== 'content' && <button type="button" onClick={() => goToQualityIssue(issue)} className="mt-1 text-xs font-semibold underline" style={{ color: '#002050' }}>Corriger</button>}
                  </div>
                </div>;
              })}
              <div className="rounded-xl border p-3 text-sm" style={{ borderColor: '#E4E7EC', background: '#F9FAFB', color: '#4B5563' }}>
                <p className="font-semibold" style={{ color: '#002050' }}>Orthographe et rédaction</p>
                <p className="mt-1 text-xs">Le correcteur automatique reste actif pendant la saisie. Une analyse rédactionnelle globale peut être lancée ici sans bloquer la finalisation.</p>
                <button type="button" onClick={runQualityWritingReview} disabled={!course.id || qualityWritingLoading} className="mt-2 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50" style={{ borderColor: '#002050', color: '#002050' }}>
                  {qualityWritingLoading ? 'Analyse en cours…' : 'Analyser l’orthographe et la rédaction'}
                </button>
                {qualityWritingSuggestions.length > 0 && <div className="mt-3 space-y-2">{qualityWritingSuggestions.map((item:any, index:number)=><div key={`${item.block_id||item.source||'text'}-${index}`} className="rounded-lg bg-white p-2 text-xs"><p className="font-semibold text-gray-800">{item.original || item.source || 'Suggestion'}</p>{item.replacement && <p className="mt-1 text-emerald-700">Proposition : {item.replacement}</p>}{item.reason && <p className="mt-1 text-gray-500">{item.reason}</p>}{item.lesson_id && <button type="button" onClick={() => goToQualityIssue({target:'lesson',lesson_id:item.lesson_id,module_id:item.module_id})} className="mt-1 font-semibold underline" style={{color:'#002050'}}>Voir le bloc</button>}</div>)}</div>}
              </div>
              {checklist.valid && (
                <button onClick={() => { setShowChecklist(false); setShowFinalization(true); setCurrentModule(null); setCurrentLesson(null); setBlocks([]); setSelectedBlock(null); }}
                  className="w-full py-3 rounded-xl font-bold text-white mt-2"
                  style={{ background: '#BF8813' }}>
                  Continuer vers Finalisation
                </button>
              )}
            </div>
          </div>
        </div>
      )}


      {/* ── MODAL PRÉVISUALISATION MULTI-RÔLES ───────── */}
      {showRolePreview && course.id && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#E4E7EC' }}>
              <div><h3 className="font-bold" style={{ color: '#002050' }}>Prévisualiser la formation</h3><p className="text-xs mt-1" style={{ color: '#6B7280' }}>Rendu final de la formation publiée, en lecture de contrôle complète.</p></div>
              <button onClick={() => setShowRolePreview(false)}><X size={18} style={{ color: '#6B7280' }} /></button>
            </div>
            <div className="p-6">
              <button onClick={() => openInternalPreviewUrl(`/cours/${course.id}/apprendre?preview=admin`)} className="flex w-full items-center gap-3 rounded-xl border p-4 text-left hover:bg-gray-50" style={{ borderColor: '#BF8813' }}><Monitor size={18} style={{ color: '#BF8813' }} /><div><p className="text-sm font-semibold" style={{ color: '#002050' }}>Prévisualiser la formation complète</p><p className="text-xs" style={{ color: '#6B7280' }}>Rendu final de la formation publiée. Le créateur peut parcourir toutes les étapes librement, sans inscription ni progression enregistrée.</p></div></button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL HISTORIQUE ──────────────────────────── */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#E4E7EC' }}>
              <h3 className="font-bold" style={{ color: '#002050' }}>Historique des modifications</h3>
              <button onClick={() => setShowHistory(false)}><X size={18} style={{ color: '#6B7280' }} /></button>
            </div>
            <div className="p-4 space-y-2">
              {logs.length === 0 && <p className="text-sm text-center py-4" style={{ color: '#9CA3AF' }}>Aucun historique disponible</p>}
              {logs.map((log: any) => (
                <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: '#F8F9FA' }}>
                  <Clock size={12} style={{ color: '#9CA3AF', flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#374151' }}>{log.action.replace(/_/g, ' ')}</p>
                    {log.comment && <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>{log.comment}</p>}
                    <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{new Date(log.created_at).toLocaleString('fr-FR')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function stripHtml(html: string) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

function escapePastedText(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function sanitizePastedHtml(rawHtml: string, rawText: string) {
  if (!rawHtml.trim()) {
    const lines = rawText.replace(/\r\n?/g, '\n').split(/\n{2,}/).map(part => part.trim()).filter(Boolean);
    return lines.length ? lines.map(part => `<p>${escapePastedText(part).replace(/\n/g, '<br>')}</p>`).join('') : escapePastedText(rawText);
  }
  const source = new DOMParser().parseFromString(rawHtml, 'text/html');
  const target = document.createElement('div');
  const copyNode = (node: Node, parent: HTMLElement) => {
    if (node.nodeType === Node.TEXT_NODE) { parent.appendChild(document.createTextNode(node.textContent || '')); return; }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as HTMLElement;
    const tag = element.tagName.toLowerCase();
    if (['script','style','meta','link','iframe','object','embed','svg','math','form','input','button','textarea','template'].includes(tag)) return;
    const allowed = new Set(['p','br','strong','b','em','i','u','ul','ol','li','a','blockquote']);
    let nextParent = parent;
    if (allowed.has(tag)) {
      const cleanTag = tag === 'b' ? 'strong' : tag === 'i' ? 'em' : tag;
      const clean = document.createElement(cleanTag);
      if (cleanTag === 'a') {
        const href = String(element.getAttribute('href') || '').trim();
        if (/^https?:\/\//i.test(href)) clean.setAttribute('href', href);
      }
      parent.appendChild(clean);
      nextParent = clean;
    } else if (tag === 'div' || /^h[1-6]$/.test(tag)) {
      const paragraph = document.createElement('p');
      parent.appendChild(paragraph);
      nextParent = paragraph;
    }
    Array.from(element.childNodes).forEach(child => copyNode(child, nextParent));
  };
  Array.from(source.body.childNodes).forEach(node => copyNode(node, target));
  return target.innerHTML;
}

function RichTextEditor({ value, onChange, locked, placeholder, headingLevel, language = 'fr' }: {
  value: string; onChange: (html: string) => void; locked: boolean; placeholder: string; headingLevel?: 1 | 2; language?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [selectionToolbar, setSelectionToolbar] = useState<{ left: number; top: number } | null>(null);
  useEffect(() => {
    if (!ref.current || document.activeElement === ref.current) return;
    const clean = sanitizePastedHtml(value || '', value || '');
    if (ref.current.innerHTML !== clean) ref.current.innerHTML = clean;
  }, [value]);
  function emit() { if (ref.current) onChange(sanitizePastedHtml(ref.current.innerHTML, ref.current.textContent || '')); }
  function command(cmd: string, arg?: string) {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    emit();
    window.setTimeout(updateSelectionToolbar, 0);
  }
  function updateSelectionToolbar() {
    if (locked || !ref.current) return setSelectionToolbar(null);
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return setSelectionToolbar(null);
    const range = selection.getRangeAt(0);
    if (!ref.current.contains(range.commonAncestorContainer)) return setSelectionToolbar(null);
    const rect = range.getBoundingClientRect();
    const host = ref.current.getBoundingClientRect();
    setSelectionToolbar({ left: Math.max(8, Math.min(host.width - 210, rect.left - host.left)), top: Math.max(4, rect.top - host.top - 38) });
  }
  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    if (locked) return;
    event.preventDefault();
    const rawText = event.clipboardData.getData('text/plain') || '';
    if (headingLevel) {
      document.execCommand('insertText', false, rawText.replace(/\s+/g, ' ').trim());
      emit();
      return;
    }
    const cleanHtml = sanitizePastedHtml(event.clipboardData.getData('text/html') || '', rawText);
    document.execCommand('insertHTML', false, cleanHtml);
    emit();
  }
  function addLink() {
    const url = window.prompt('Adresse du lien HTTPS');
    if (!url) return;
    if (!/^https:\/\//i.test(url.trim())) { window.alert('Utilisez une adresse HTTPS valide.'); return; }
    command('createLink', url.trim());
  }
  const toolBtn = 'h-8 rounded-lg border px-2.5 text-xs font-semibold hover:bg-slate-50 disabled:opacity-40';
  return (
    <div className="relative overflow-visible rounded-xl border bg-white" style={{ borderColor: '#E4E7EC' }}>
      {!locked && !headingLevel && (
        <div className="flex flex-wrap items-center gap-1 border-b px-2 py-2" style={{ borderColor: '#EEF1F5', background: '#FBFCFE' }}>
          <button type="button" className={toolBtn} onMouseDown={e=>e.preventDefault()} onClick={()=>command('bold')} title="Gras"><strong>B</strong></button>
          <button type="button" className={toolBtn} onMouseDown={e=>e.preventDefault()} onClick={()=>command('italic')} title="Italique"><em>I</em></button>
          <button type="button" className={toolBtn} onMouseDown={e=>e.preventDefault()} onClick={()=>command('underline')} title="Souligné"><u>U</u></button>
          <button type="button" className={toolBtn} onMouseDown={e=>e.preventDefault()} onClick={()=>command('undo')} title="Annuler">↶</button>
          <button type="button" className={toolBtn} onMouseDown={e=>e.preventDefault()} onClick={()=>command('redo')} title="Rétablir">↷</button>
          <button type="button" className={toolBtn} onMouseDown={e=>e.preventDefault()} onClick={()=>command('insertUnorderedList')} title="Liste à puces">• Puces</button>
          <button type="button" className={toolBtn} onMouseDown={e=>e.preventDefault()} onClick={()=>command('insertOrderedList')} title="Liste numérotée">1. Liste</button>
          <button type="button" className={toolBtn} onMouseDown={e=>e.preventDefault()} onClick={addLink} title="Ajouter un lien">Lien</button>
          <span className="ml-auto text-[10px] text-slate-400">Entrée = nouveau paragraphe · Maj+Entrée = retour simple</span>
        </div>
      )}
      {!locked && selectionToolbar && (
        <div className="absolute z-30 flex items-center gap-1 rounded-lg border bg-white p-1 shadow-lg" style={{ left: selectionToolbar.left, top: selectionToolbar.top, borderColor: '#E4E7EC' }}>
          <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => command('bold')} className="h-7 min-w-7 rounded px-2 text-xs font-bold hover:bg-slate-50" title="Gras">B</button>
          <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => command('italic')} className="h-7 min-w-7 rounded px-2 text-xs italic hover:bg-slate-50" title="Italique">I</button>
          <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => command('insertUnorderedList')} className="h-7 rounded px-2 text-xs hover:bg-slate-50" title="Puces">•</button>
          <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => command('insertOrderedList')} className="h-7 rounded px-2 text-xs hover:bg-slate-50" title="Numérotation">1.</button>
          <button type="button" onMouseDown={e => e.preventDefault()} onClick={addLink} className="h-7 rounded px-2 text-xs font-semibold hover:bg-slate-50" title="Ajouter un lien">Lien</button>
        </div>
      )}
      <div ref={ref} contentEditable={!locked} suppressContentEditableWarning spellCheck lang={language} data-placeholder={placeholder}
        role="textbox" aria-multiline={headingLevel ? false : true} aria-label={placeholder || "Éditeur de contenu"}
        onInput={emit}
        onPaste={handlePaste}
        onMouseUp={updateSelectionToolbar} onKeyUp={updateSelectionToolbar} onBlur={() => window.setTimeout(() => setSelectionToolbar(null), 120)}
        className={`${headingLevel === 1 ? 'text-xl font-bold' : headingLevel === 2 ? 'text-lg font-semibold' : 'text-sm'} min-h-[88px] px-3 py-3 outline-none rich-editor [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_a]:text-blue-700 [&_a]:underline`}
        style={{ color: headingLevel ? '#002050' : '#374151' }} />
    </div>
  );
}

function RichListEditor({ items, ordered, locked, onChange, placeholder, language = 'fr' }: { items:string[]; ordered?:boolean; locked:boolean; onChange:(items:string[])=>void; placeholder:string; language?:string }) {
  const list=Array.isArray(items)?items:[];
  function update(index:number, html:string){ const next=[...list]; next[index]=html; onChange(next); }
  function add(){ onChange([...list,'']); }
  function remove(index:number){ onChange(list.filter((_,i)=>i!==index)); }
  return <div className="space-y-2">
    {list.map((item,index)=><div key={index} className="grid grid-cols-[28px_auto_1fr] items-start gap-2">
      <span className="pt-3 text-sm font-bold" style={{color:'#002050'}}>{ordered?`${index+1}.`:'•'}</span>
      {!locked&&<button type="button" onClick={()=>remove(index)} className="mt-2 rounded p-2 hover:bg-red-50" title="Supprimer ce champ"><X size={14} className="text-red-600"/></button>}
      <RichTextEditor value={item||''} locked={locked} language={language} placeholder={placeholder} onChange={html=>update(index,html)}/>
    </div>)}
    {!locked&&<button type="button" onClick={add} className="text-xs font-semibold px-3 py-2 rounded-lg border" style={{borderColor:'#BF8813',color:'#92400E'}}>+ Ajouter un élément</button>}
  </div>;
}

function EditableItems({ items, ordered, locked, onChange, placeholder, language = 'fr' }: { items: string[]; ordered?: boolean; locked: boolean; onChange: (items: string[]) => void; placeholder: string; language?: string }) {
  const list=Array.isArray(items)?items:[];
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  function update(index: number, value: string) { const next=[...list]; next[index]=value; onChange(next); }
  function addAfter(index?: number) {
    const next=[...list];
    const target=typeof index==='number'?index+1:next.length;
    next.splice(target,0,'');
    onChange(next);
    setTimeout(()=>refs.current[target]?.focus(),0);
  }
  function remove(index: number) {
    const next=list.filter((_,i)=>i!==index);
    onChange(next);
    setTimeout(()=>refs.current[Math.max(0,index-1)]?.focus(),0);
  }
  return <div className="space-y-2">
    {list.map((item,index)=><div key={index} className="grid grid-cols-[24px_auto_1fr] items-start gap-2">
      <span className="mt-2 text-sm font-semibold" style={{color:'#002050'}}>{ordered?`${index+1}.`:'•'}</span>
      {!locked&&<button type="button" onClick={()=>remove(index)} className="mt-1 p-1.5 rounded hover:bg-red-50" title="Supprimer ce champ"><X size={13} style={{color:'#DC2626'}}/></button>}
      <input ref={el=>{refs.current[index]=el}} className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-[#002050]" style={{borderColor:'#E4E7EC'}} value={item} placeholder={placeholder} disabled={locked} spellCheck lang={language}
        onChange={e=>update(index,e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addAfter(index)} if(e.key==='Backspace'&&!item){e.preventDefault();remove(index)}}}/>
    </div>)}
    {!locked&&<button type="button" onClick={()=>addAfter()} className="text-xs font-semibold px-3 py-2 rounded-lg border" style={{borderColor:'#BF8813',color:'#92400E'}}>+ Ajouter une ligne</button>}
  </div>;
}

function PedagogicalEditor({ c, locked, onChange, kind, language = 'fr' }: { c: Record<string,any>; locked:boolean; onChange:(c:Record<string,any>)=>void; kind:string; language?:string }) {
  const labels:Record<string,string>={objective:'Objectif pédagogique',example:'Exemple',summary:'Résumé',important:'Important',correction:'Correction'};
  return <div className="space-y-2 p-3 rounded-xl border" style={{borderColor:'#E4E7EC',background:'#FBFCFE'}}>
    <input className="w-full font-semibold bg-transparent border-none outline-none" style={{color:'#002050'}} value={c.title||labels[kind]||''} onChange={e=>onChange({...c,title:e.target.value})} disabled={locked} spellCheck lang={language}/>
    <RichTextEditor value={c.html||c.content||c.text||''} locked={locked} language={language} placeholder="Saisissez le contenu pédagogique..." onChange={html=>onChange({...c,html})}/>
  </div>
}


function LanguageBlockTitle({c,locked,onChange}:{c:Record<string,any>;locked:boolean;onChange:(v:Record<string,any>)=>void}) {
  return <input className="w-full px-3 py-2 border rounded-lg text-sm" style={{borderColor:'#E4E7EC'}} value={c.title||''} onChange={e=>onChange({...c,title:e.target.value})} placeholder="Titre du bloc (facultatif)" disabled={locked}/>;
}

function LanguageBlockEditor({type,c,locked,onChange}:{type:string;c:Record<string,any>;locked:boolean;onChange:(v:Record<string,any>)=>void}){
  const cls='w-full px-3 py-2 border rounded-lg text-sm'; const st={borderColor:'#E4E7EC'};
  if(type==='vocabulary') return <div className="space-y-2"><LanguageBlockTitle c={c} locked={locked} onChange={onChange}/>{(c.items||[]).map((x:any,i:number)=><div key={i} className="grid gap-2 md:grid-cols-3"><input className={cls} style={st} value={x.term||''} onChange={e=>{const items=[...(c.items||[])];items[i]={...x,term:e.target.value};onChange({...c,items})}} placeholder="Mot / expression" disabled={locked}/><input className={cls} style={st} value={x.translation||''} onChange={e=>{const items=[...(c.items||[])];items[i]={...x,translation:e.target.value};onChange({...c,items})}} placeholder="Sens / traduction" disabled={locked}/><input className={cls} style={st} value={x.example||''} onChange={e=>{const items=[...(c.items||[])];items[i]={...x,example:e.target.value};onChange({...c,items})}} placeholder="Exemple" disabled={locked}/></div>)}{!locked&&<button className="text-xs font-semibold text-[#002050]" onClick={()=>onChange({...c,items:[...(c.items||[]),{term:'',translation:'',example:'',audio_url:''}]})}>+ Ajouter un mot</button>}</div>;
  if(type==='dialogue') return <div className="space-y-2"><LanguageBlockTitle c={c} locked={locked} onChange={onChange}/>{(c.lines||[]).map((x:any,i:number)=><div key={i} className="grid gap-2 md:grid-cols-[100px_1fr_1fr]"><input className={cls} style={st} value={x.speaker||''} onChange={e=>{const lines=[...(c.lines||[])];lines[i]={...x,speaker:e.target.value};onChange({...c,lines})}} placeholder="Personne" disabled={locked}/><input className={cls} style={st} value={x.text||''} onChange={e=>{const lines=[...(c.lines||[])];lines[i]={...x,text:e.target.value};onChange({...c,lines})}} placeholder="Réplique" disabled={locked}/><input className={cls} style={st} value={x.translation||''} onChange={e=>{const lines=[...(c.lines||[])];lines[i]={...x,translation:e.target.value};onChange({...c,lines})}} placeholder="Aide / traduction" disabled={locked}/></div>)}{!locked&&<button className="text-xs font-semibold text-[#002050]" onClick={()=>onChange({...c,lines:[...(c.lines||[]),{speaker:'',text:'',translation:''}]})}>+ Ajouter une réplique</button>}</div>;
  if(type==='matching') return <div className="space-y-2"><LanguageBlockTitle c={c} locked={locked} onChange={onChange}/>{(c.pairs||[]).map((x:any,i:number)=><div key={i} className="grid grid-cols-2 gap-2"><input className={cls} style={st} value={x.left||''} onChange={e=>{const pairs=[...(c.pairs||[])];pairs[i]={...x,left:e.target.value};onChange({...c,pairs})}} placeholder="Élément A" disabled={locked}/><input className={cls} style={st} value={x.right||''} onChange={e=>{const pairs=[...(c.pairs||[])];pairs[i]={...x,right:e.target.value};onChange({...c,pairs})}} placeholder="Élément B" disabled={locked}/></div>)}{!locked&&<button className="text-xs font-semibold text-[#002050]" onClick={()=>onChange({...c,pairs:[...(c.pairs||[]),{left:'',right:''}]})}>+ Ajouter une paire</button>}</div>;
  if(type==='pronunciation') return <div className="space-y-2"><LanguageBlockTitle c={c} locked={locked} onChange={onChange}/><textarea className={cls} style={st} rows={2} value={c.instructions||''} onChange={e=>onChange({...c,instructions:e.target.value})} placeholder="Consignes" disabled={locked}/>{(c.items||[]).map((x:any,i:number)=><div key={i} className="grid gap-2 md:grid-cols-3"><input className={cls} style={st} value={x.text||''} onChange={e=>{const items=[...(c.items||[])];items[i]={...x,text:e.target.value};onChange({...c,items})}} placeholder="Mot / phrase" disabled={locked}/><input className={cls} style={st} value={x.phonetic||''} onChange={e=>{const items=[...(c.items||[])];items[i]={...x,phonetic:e.target.value};onChange({...c,items})}} placeholder="Phonétique" disabled={locked}/><input className={cls} style={st} value={x.audio_url||''} onChange={e=>{const items=[...(c.items||[])];items[i]={...x,audio_url:e.target.value};onChange({...c,items})}} placeholder="Audio URL" disabled={locked}/></div>)}</div>;
  if(type==='listening_comprehension'||type==='dictation') return <div className="space-y-2"><LanguageBlockTitle c={c} locked={locked} onChange={onChange}/><input className={cls} style={st} value={c.audio_url||''} onChange={e=>onChange({...c,audio_url:e.target.value})} placeholder="URL audio" disabled={locked}/><textarea className={cls} style={st} rows={4} value={c.transcript||''} onChange={e=>onChange({...c,transcript:e.target.value})} placeholder="Transcription / corrigé" disabled={locked}/>{type==='listening_comprehension'&&(c.questions||[]).map((x:any,i:number)=><input key={i} className={cls} style={st} value={x.question||''} onChange={e=>{const questions=[...(c.questions||[])];questions[i]={...x,question:e.target.value};onChange({...c,questions})}} placeholder={`Question ${i+1}`} disabled={locked}/>)}</div>;
  if(type==='cloze') return <div className="space-y-2"><LanguageBlockTitle c={c} locked={locked} onChange={onChange}/><textarea className={cls} style={st} rows={4} value={c.text||''} onChange={e=>onChange({...c,text:e.target.value})} placeholder="Texte avec ____ pour les trous" disabled={locked}/><input className={cls} style={st} value={(c.answers||[]).join(' | ')} onChange={e=>onChange({...c,answers:e.target.value.split('|').map((x:string)=>x.trim()).filter(Boolean)})} placeholder="Réponses séparées par |" disabled={locked}/></div>;
  if(type==='sentence_order') return <div className="space-y-2"><LanguageBlockTitle c={c} locked={locked} onChange={onChange}/><input className={cls} style={st} value={c.sentence||''} onChange={e=>onChange({...c,sentence:e.target.value,tokens:e.target.value.split(/\s+/).filter(Boolean)})} placeholder="Phrase correcte" disabled={locked}/></div>;
  if(type==='oral_response') return <div className="space-y-2"><LanguageBlockTitle c={c} locked={locked} onChange={onChange}/><textarea className={cls} style={st} rows={3} value={c.prompt||''} onChange={e=>onChange({...c,prompt:e.target.value})} placeholder="Consigne orale" disabled={locked}/><input className={cls} style={st} value={c.reference_audio_url||''} onChange={e=>onChange({...c,reference_audio_url:e.target.value})} placeholder="Audio de référence" disabled={locked}/></div>;
  return <div className="space-y-2"><LanguageBlockTitle c={c} locked={locked} onChange={onChange}/><textarea className={cls} style={st} rows={4} value={c.prompt||''} onChange={e=>onChange({...c,prompt:e.target.value})} placeholder="Sujet d’expression écrite" disabled={locked}/><input type="number" min={20} className={cls} style={st} value={c.target_words||120} onChange={e=>onChange({...c,target_words:Math.max(20,Number(e.target.value)||120)})} disabled={locked}/></div>;
}


function SubmissionModeEditor({ c, locked, onChange, allowPerQuestion = false }: {
  c: Record<string, any>;
  locked?: boolean;
  onChange: (value: Record<string, any>) => void;
  allowPerQuestion?: boolean;
}) {
  const responseMode = String(c.response_mode || (c.learner_upload_required === true ? 'file' : 'text'));
  const accepted = Array.isArray(c.accepted_types) ? c.accepted_types.map((x:any)=>String(x)) : ['pdf','doc','docx','xls','xlsx'];
  const maxSize = Math.max(1, Math.min(50, Number(c.max_size_mb || 10)));
  const setMode = (mode: string) => onChange({ ...c, response_mode: mode, learner_upload_required: mode === 'file' });

  return <div className="space-y-3 rounded-xl border p-3" style={{borderColor:'#D9DEE8',background:'#F8FAFC'}}>
    <div>
      <p className="text-xs font-bold" style={{color:'#002050'}}>Mode de remise apprenant</p>
      <p className="mt-1 text-[11px] text-gray-500">Le mode de remise est indépendant du mode de correction.</p>
    </div>
    <select className="w-full rounded-lg border bg-white px-3 py-2 text-sm" style={{borderColor:'#D9DEE8'}} value={responseMode} disabled={locked} onChange={e=>setMode(e.target.value)}>
      <option value="text">Réponse texte</option>
      <option value="file">Fichier à joindre</option>
      <option value="text_file">Réponse texte + fichier</option>
    </select>

    {allowPerQuestion && responseMode !== 'file' && <div>
      <p className="mb-1 text-xs font-semibold text-slate-600">Organisation de la réponse texte</p>
      <select className="w-full rounded-lg border bg-white px-3 py-2 text-sm" style={{borderColor:'#D9DEE8'}} value={String(c.response_layout || 'per_question')} disabled={locked} onChange={e=>onChange({...c,response_layout:e.target.value})}>
        <option value="per_question">Une réponse par question d’analyse</option>
        <option value="single">Une réponse globale</option>
      </select>
    </div>}

    {(responseMode === 'file' || responseMode === 'text_file') && <>
      <div>
        <p className="mb-1 text-xs font-semibold text-slate-600">Formats autorisés</p>
        <input className="w-full rounded-lg border bg-white px-3 py-2 text-sm" style={{borderColor:'#D9DEE8'}} value={accepted.join(', ')} disabled={locked} onChange={e=>onChange({...c,accepted_types:e.target.value.split(',').map(x=>x.trim().replace(/^\./,'').toLowerCase()).filter(Boolean)})} placeholder="pdf, docx, xlsx, png, jpg"/>
      </div>
      <div>
        <p className="mb-1 text-xs font-semibold text-slate-600">Taille maximale du fichier (Mo)</p>
        <input type="number" min={1} max={50} className="w-full rounded-lg border bg-white px-3 py-2 text-sm" style={{borderColor:'#D9DEE8'}} value={maxSize} disabled={locked} onChange={e=>onChange({...c,max_size_mb:Math.max(1,Math.min(50,Number(e.target.value)||10))})}/>
      </div>
    </>}
  </div>;
}

// ─── Aperçu inline du bloc (éditable) ────────────────────────
function BlockPreview({ block, def, locked, onChange, onGenerateTts, onGenerateSubtitles, mediaAiBusy, defaultLanguage = 'fr' }: {
  block: Block; def: typeof BLOCK_DEFS[0] | undefined; locked: boolean;
  onChange: (content: Record<string, any>) => void;
  onGenerateTts?: (text: string, targetPath: string) => void;
  onGenerateSubtitles?: () => void;
  mediaAiBusy?: string | null;
  defaultLanguage?: string;
}) {
  const c = block.content_json || {};
  const inputCls = 'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-[#002050] transition-colors';
  const style = { borderColor: '#E4E7EC' };

  switch (block.block_type) {
    case 'heading': return (
      <RichTextEditor value={c.html || c.text || ''} locked={locked} headingLevel={1}
        placeholder="Titre..." language={defaultLanguage} onChange={html => onChange({ ...c, html, text: stripHtml(html) })} />
    );
    case 'subheading': return (
      <RichTextEditor value={c.html || c.text || ''} locked={locked} headingLevel={2}
        placeholder="Sous-titre..." language={defaultLanguage} onChange={html => onChange({ ...c, html, text: stripHtml(html) })} />
    );
    case 'text': return (
      <RichTextEditor value={c.html || c.text || c.content || ''} locked={locked} placeholder="Saisissez votre texte..."
        onChange={html => onChange({ ...c, html })} />
    );
    case 'callout': return (
      <div className="space-y-2 rounded-xl border p-3" style={{ borderColor:'#E4E7EC', background: c.type === 'warning' ? '#FEF3C7' : c.type === 'error' ? '#FEE2E2' : '#EFF6FF' }}>
        <input className={inputCls} style={style} value={c.title||''} onChange={e=>onChange({...c,title:e.target.value})} placeholder="Titre de l’encadré (facultatif)" disabled={locked}/>
        <RichTextEditor value={c.html||c.content||''} locked={locked} language={defaultLanguage} placeholder="Contenu de l'encadré..." onChange={html=>onChange({...c,html,content:stripHtml(html)})}/>
      </div>
    );
    case 'bullet_list': return <RichListEditor items={Array.isArray(c.items)?c.items:[]} locked={locked} language={defaultLanguage} onChange={items=>onChange({...c,items})} placeholder="Élément de la liste" />;
    case 'numbered_list': return <RichListEditor ordered items={Array.isArray(c.items)?c.items:[]} locked={locked} language={defaultLanguage} onChange={items=>onChange({...c,items})} placeholder="Étape de la liste" />;
    case 'objective': case 'example': case 'summary': case 'important': case 'correction': return <PedagogicalEditor c={c} locked={locked} onChange={onChange} kind={block.block_type} />;
    case 'definition': return <div className="space-y-2"><input className={inputCls} style={style} value={c.title||''} onChange={e=>onChange({...c,title:e.target.value})} placeholder="Titre du bloc (facultatif)" disabled={locked}/><input className={inputCls} style={style} value={c.term||''} onChange={e=>onChange({...c,term:e.target.value})} placeholder="Terme à définir" disabled={locked}/><RichTextEditor value={c.definition||''} locked={locked} language={defaultLanguage} placeholder="Définition..." onChange={definition=>onChange({...c,definition})}/><RichTextEditor value={c.example||''} locked={locked} language={defaultLanguage} placeholder="Exemple facultatif..." onChange={example=>onChange({...c,example})}/></div>;
    case 'case_study': return <div className="space-y-2"><input className={inputCls} style={style} value={c.title||''} onChange={e=>onChange({...c,title:e.target.value})} placeholder="Titre de l’étude de cas (facultatif)" disabled={locked}/><RichTextEditor value={c.context||''} locked={locked} language={defaultLanguage} placeholder="Contexte" onChange={context=>onChange({...c,context})}/><RichTextEditor value={c.data||''} locked={locked} language={defaultLanguage} placeholder="Données et informations disponibles" onChange={data=>onChange({...c,data})}/><RichTextEditor value={c.task||''} locked={locked} language={defaultLanguage} placeholder="Travail demandé" onChange={task=>onChange({...c,task})}/><EditableItems items={Array.isArray(c.questions)?c.questions:[]} locked={locked} onChange={questions=>onChange({...c,questions})} placeholder="Question d’analyse" /><SubmissionModeEditor c={c} locked={locked} onChange={onChange} allowPerQuestion /></div>;
    case 'remember': return (
      <div className="p-3 rounded-lg" style={{ background: 'rgba(191,136,19,0.08)', border: '1px solid #BF881330' }}>
        <div className="flex items-center gap-1.5 mb-2"><Star size={13} style={{ color: '#BF8813' }} /><input className="text-xs font-bold bg-transparent outline-none flex-1" style={{color:'#BF8813'}} value={c.title||'À retenir'} onChange={e=>onChange({...c,title:e.target.value})} disabled={locked}/></div>
        <RichListEditor items={Array.isArray(c.points)?c.points:[]} locked={locked} language={defaultLanguage} onChange={points=>onChange({...c,points})} placeholder="Point clé à retenir" />
      </div>
    );
    case 'open_question': return <div className="space-y-2"><input className={inputCls} style={style} value={c.title||''} onChange={e=>onChange({...c,title:e.target.value})} placeholder="Titre du bloc (facultatif)" disabled={locked}/><RichTextEditor value={c.question||''} locked={locked} language={defaultLanguage} placeholder="Question posée à l’apprenant" onChange={question=>onChange({...c,question})}/><RichTextEditor value={c.guidance||''} locked={locked} language={defaultLanguage} placeholder="Consignes ou éléments attendus" onChange={guidance=>onChange({...c,guidance})}/><RichTextEditor value={c.expected_answer||''} locked={locked} language={defaultLanguage} placeholder="Réponse de référence pour le correcteur" onChange={expected_answer=>onChange({...c,expected_answer})}/><input type="number" className={inputCls} style={style} value={c.points||10} onChange={e=>onChange({...c,points:Number(e.target.value)})} min={0} placeholder="Points" disabled={locked}/></div>;
    case 'exercise': return <div className="space-y-2"><input className={inputCls} style={style} value={c.title||''} onChange={e=>onChange({...c,title:e.target.value})} placeholder="Titre de l’exercice (facultatif)" disabled={locked}/><RichTextEditor value={c.instructions||''} locked={locked} language={defaultLanguage} placeholder="Consignes détaillées" onChange={instructions=>onChange({...c,instructions})}/><RichTextEditor value={c.task||''} locked={locked} language={defaultLanguage} placeholder="Travail à réaliser" onChange={task=>onChange({...c,task})}/><SubmissionModeEditor c={c} locked={locked} onChange={onChange}/><div className="p-3 rounded-lg text-xs" style={{background:'#FFF7ED',color:'#9A3412'}}>Les fichiers de travail du créateur restent des ressources. La remise apprenant se règle séparément ci-dessus.</div></div>;
    case 'image': return (
      <div className="space-y-2">
        {c.url ? <img src={c.url} alt={c.alt} className="w-full rounded-lg object-cover max-h-48" /> : (
          <div className="flex items-center justify-center h-32 rounded-lg" style={{ background: '#F3F4F6' }}>
            <Image size={24} style={{ color: '#9CA3AF' }} />
          </div>
        )}
        <input className={inputCls} style={style} value={c.url || ''} onChange={e => onChange({ ...c, url: e.target.value })} placeholder="URL de l'image..." disabled={locked} />
        <input className={inputCls} style={style} value={c.alt || ''} onChange={e => onChange({ ...c, alt: e.target.value })} placeholder="Texte alternatif..." disabled={locked} />
      </div>
    );
    case 'video': return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: '#FEF2F2' }}>
          <Video size={14} style={{ color: '#DC2626' }} />
          <input className="flex-1 bg-transparent text-sm border-none outline-none" value={c.url || ''}
            onChange={e => onChange({ ...c, url: e.target.value })} placeholder="URL de la vidéo (YouTube, Vimeo...)..." disabled={locked} />
        </div>
        {c.eco_data && <p className="text-xs" style={{ color: '#9CA3AF' }}>💡 Mode éco-data : vidéo non chargée automatiquement</p>}
        {!locked && String(c.cloudflare_stream_uid||'').trim() && <div className="rounded-lg border p-3 space-y-2" style={{borderColor:'#E4E7EC',background:'#F8FAFC'}}>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <select className="px-3 py-2 rounded-lg border text-xs" style={{borderColor:'#E4E7EC'}} value={c.subtitle_target_language||defaultLanguage} onChange={e=>onChange({...c,subtitle_target_language:e.target.value})}>
              <option value="fr">Français</option><option value="en">Anglais</option><option value="es">Espagnol</option><option value="pt">Portugais</option><option value="ar">Arabe</option><option value="zh">Chinois</option><option value="ru">Russe</option><option value="de">Allemand</option><option value="bm">Bambara</option>
            </select>
            <button type="button" onClick={()=>onGenerateSubtitles?.()} disabled={mediaAiBusy===`subtitle:${block.id}`} className="px-3 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50" style={{background:'#002050'}}>{mediaAiBusy===`subtitle:${block.id}`?'Lancement…':'Générer les sous-titres'}</button>
          </div>
          {Array.isArray(c.subtitles)&&c.subtitles.length>0&&<p className="text-xs text-emerald-700">Sous-titres disponibles : {c.subtitles.map((x:any)=>String(x.language||'').toUpperCase()).join(', ')}</p>}
        </div>}
      </div>
    );
    case 'qcm': return (
      <div className="space-y-2">
        <textarea className={inputCls} style={{ ...style, resize: 'none' }} rows={2}
          value={c.question || ''} onChange={e => onChange({ ...c, question: e.target.value })} placeholder="Saisissez votre question..." disabled={locked} />
        <div className="space-y-1">
          {(c.options || ['', '', '', '']).map((opt: string, i: number) => (
            <div key={i} className="flex items-center gap-2">
              <input type="radio" checked={c.correctIndex === i} onChange={() => onChange({ ...c, correctIndex: i })} style={{ accentColor: '#002050' }} disabled={locked} />
              <input className={`${inputCls} flex-1`} style={style} value={opt}
                onChange={e => { const opts = [...(c.options || ['', '', '', ''])]; opts[i] = e.target.value; onChange({ ...c, options: opts }); }}
                placeholder={`Réponse ${String.fromCharCode(65 + i)}...`} disabled={locked} />
            </div>
          ))}
        </div>
        <textarea className={inputCls} style={{ ...style, resize: 'none' }} rows={2}
          value={c.explanation || ''} onChange={e => onChange({ ...c, explanation: e.target.value })} placeholder="Explication de la bonne réponse..." disabled={locked} />
      </div>
    );
    case 'true_false': return (
      <div className="space-y-2">
        <textarea className={inputCls} style={{ ...style, resize: 'none' }} rows={2}
          value={c.statement || ''} onChange={e => onChange({ ...c, statement: e.target.value })} placeholder="Affirmation à évaluer..." disabled={locked} />
        <div className="flex gap-3">
          {[true, false].map(val => (
            <label key={String(val)} className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={c.answer === val} onChange={() => onChange({ ...c, answer: val })} style={{ accentColor: val ? '#1E7A52' : '#DC2626' }} disabled={locked} />
              <span className="text-sm font-semibold" style={{ color: val ? '#1E7A52' : '#DC2626' }}>{val ? 'Vrai ✓' : 'Faux ✗'}</span>
            </label>
          ))}
        </div>
        <input className={inputCls} style={style} value={c.explanation || ''} onChange={e => onChange({ ...c, explanation: e.target.value })} placeholder="Explication..." disabled={locked} />
      </div>
    );

    case 'audio': return (
      <div className="space-y-2">
        <input className={inputCls} style={style} value={c.description || ''} onChange={e=>onChange({...c,description:e.target.value})} placeholder="Description de l’audio" disabled={locked}/>
        <textarea className={inputCls} style={style} rows={4} value={c.transcription || ''} onChange={e=>onChange({...c,transcription:e.target.value})} placeholder="Texte à convertir en audio / transcription" disabled={locked}/>
        {c.url&&<audio className="w-full" controls src={c.url}/>}
        {!locked&&<button type="button" onClick={()=>onGenerateTts?.(String(c.transcription||c.description||''),'url')} disabled={mediaAiBusy===`tts:${block.id}:url`} className="px-3 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50" style={{background:'#BF8813'}}>{mediaAiBusy===`tts:${block.id}:url`?'Génération…':'Générer l’audio avec l’IA'}</button>}
      </div>
    );
    case 'quote': return (
      <div className="space-y-2">
        <input className={inputCls} style={style} value={c.title||''} onChange={e=>onChange({...c,title:e.target.value})} placeholder="Titre du bloc (facultatif)" disabled={locked}/>
        <RichTextEditor value={c.html||c.text||''} locked={locked} language={defaultLanguage} placeholder="Citation ou témoignage" onChange={html=>onChange({...c,html,text:stripHtml(html)})}/>
        <input className={inputCls} style={style} value={c.author || ''} onChange={e=>onChange({...c,author:e.target.value})} placeholder="Auteur / source" disabled={locked}/>
      </div>
    );
    case 'checklist': return (
      <div className="space-y-2">
        <input className={inputCls} style={style} value={c.title||''} onChange={e=>onChange({...c,title:e.target.value})} placeholder="Titre de la checklist (facultatif)" disabled={locked}/>
        {(c.items || []).map((item:any,i:number)=><div key={item.id||i} className="flex items-center gap-2">
          <input type="checkbox" checked={item.checked===true} onChange={e=>{const items=[...(c.items||[])];items[i]={...item,checked:e.target.checked};onChange({...c,items})}} disabled={locked}/>
          <input className={`${inputCls} flex-1`} style={style} value={item.text||''} onChange={e=>{const items=[...(c.items||[])];items[i]={...item,text:e.target.value};onChange({...c,items})}} placeholder="Élément de checklist" disabled={locked}/>
          {!locked&&<button type="button" onClick={()=>onChange({...c,items:(c.items||[]).filter((_:any,index:number)=>index!==i)})} className="px-2 text-red-600">×</button>}
        </div>)}
        {!locked&&<button type="button" onClick={()=>onChange({...c,items:[...(c.items||[]),{id:crypto.randomUUID(),text:'',checked:false}]})} className="text-xs font-semibold text-[#002050]">+ Ajouter un élément</button>}
      </div>
    );
    case 'link_button': return <div className="grid gap-2 sm:grid-cols-2"><input className={inputCls} style={style} value={c.label||''} onChange={e=>onChange({...c,label:e.target.value})} placeholder="Libellé du bouton" disabled={locked}/><input className={inputCls} style={style} value={c.url||''} onChange={e=>onChange({...c,url:e.target.value})} placeholder="https://..." disabled={locked}/></div>;
    case 'accordion': return (
      <div className="space-y-3"><input className={inputCls} style={style} value={c.title||''} onChange={e=>onChange({...c,title:e.target.value})} placeholder="Titre de l’accordéon (facultatif)" disabled={locked}/>{(c.items||[]).map((item:any,i:number)=><div key={item.id||i} className="rounded-xl border p-3" style={style}><input className={inputCls} style={style} value={item.title||''} onChange={e=>{const items=[...(c.items||[])];items[i]={...item,title:e.target.value};onChange({...c,items})}} placeholder={`Section ${i+1}`} disabled={locked}/><div className="mt-2"><RichTextEditor value={item.content||''} locked={locked} language={defaultLanguage} placeholder="Contenu" onChange={content=>{const items=[...(c.items||[])];items[i]={...item,content};onChange({...c,items})}}/></div>{!locked&&<button type="button" className="mt-2 text-xs text-red-600" onClick={()=>onChange({...c,items:(c.items||[]).filter((_:any,index:number)=>index!==i)})}>Supprimer</button>}</div>)}{!locked&&<button type="button" className="text-xs font-semibold text-[#002050]" onClick={()=>onChange({...c,items:[...(c.items||[]),{id:crypto.randomUUID(),title:'',content:''}]})}>+ Ajouter une section</button>}</div>
    );
    case 'flashcards': return (
      <div className="space-y-3">{(c.cards||[]).map((card:any,i:number)=><div key={card.id||i} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-2" style={style}><textarea className={inputCls} style={style} rows={2} value={card.front||''} onChange={e=>{const cards=[...(c.cards||[])];cards[i]={...card,front:e.target.value};onChange({...c,cards})}} placeholder="Recto" disabled={locked}/><textarea className={inputCls} style={style} rows={2} value={card.back||''} onChange={e=>{const cards=[...(c.cards||[])];cards[i]={...card,back:e.target.value};onChange({...c,cards})}} placeholder="Verso" disabled={locked}/></div>)}{!locked&&<button type="button" className="text-xs font-semibold text-[#002050]" onClick={()=>onChange({...c,cards:[...(c.cards||[]),{id:crypto.randomUUID(),front:'',back:''}]})}>+ Ajouter une carte</button>}</div>
    );
    case 'interactive_table': {
      const headers:string[] = Array.isArray(c.headers) && c.headers.length ? c.headers.map((x:any)=>String(x??'')) : ['Colonne 1','Colonne 2'];
      const rows:string[][] = Array.isArray(c.rows) && c.rows.length ? c.rows.map((row:any)=>headers.map((_:string,i:number)=>String(Array.isArray(row)?(row[i]??''):''))) : [headers.map(()=> '')];
      const updateHeader=(index:number,value:string)=>{const next=[...headers];next[index]=value;onChange({...c,headers:next,rows});};
      const updateCell=(ri:number,ci:number,value:string)=>{const next=rows.map(r=>[...r]);next[ri][ci]=value;onChange({...c,headers,rows:next});};
      const addColumn=()=>{const nextHeaders=[...headers,`Colonne ${headers.length+1}`];const nextRows=rows.map(r=>[...r,'']);onChange({...c,headers:nextHeaders,rows:nextRows});};
      const removeColumn=(ci:number)=>{if(headers.length<=1)return;const nextHeaders=headers.filter((_,i)=>i!==ci);const nextRows=rows.map(r=>r.filter((_,i)=>i!==ci));const training=(c.training_column_indexes||[]).filter((i:number)=>i!==ci).map((i:number)=>i>ci?i-1:i);onChange({...c,headers:nextHeaders,rows:nextRows,training_column_indexes:training});};
      const addRow=()=>onChange({...c,headers,rows:[...rows,headers.map(()=> '')]});
      const removeRow=(ri:number)=>{const next=rows.filter((_,i)=>i!==ri);onChange({...c,headers,rows:next.length?next:[headers.map(()=> '')]});};
      return (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-xl border" style={{borderColor:'#E4E7EC'}}>
            <table className="min-w-full text-xs">
              <thead><tr className="bg-slate-50"><th className="w-10 px-2 py-2 text-slate-400">#</th>{headers.map((header,i)=><th key={i} className="min-w-[180px] p-2"><div className="flex gap-1"><input className={inputCls} style={style} value={header} onChange={e=>updateHeader(i,e.target.value)} placeholder={`Colonne ${i+1}`} disabled={locked}/>{!locked&&headers.length>1&&<button type="button" onClick={()=>removeColumn(i)} className="rounded px-2 text-red-600 hover:bg-red-50" title="Supprimer la colonne">×</button>}</div></th>)}</tr></thead>
              <tbody>{rows.map((row,ri)=><tr key={ri} className="border-t" style={{borderColor:'#EEF1F5'}}><td className="px-2 py-2 text-center font-semibold text-slate-400">{ri+1}</td>{headers.map((_,ci)=><td key={ci} className="p-2 align-top"><textarea className={`${inputCls} min-h-[70px] resize-y`} style={style} value={row[ci]||''} onChange={e=>updateCell(ri,ci,e.target.value)} placeholder="Contenu de la cellule" disabled={locked}/></td>)}{!locked&&<td className="p-2"><button type="button" onClick={()=>removeRow(ri)} className="rounded px-2 py-1 text-red-600 hover:bg-red-50" title="Supprimer la ligne">×</button></td>}</tr>)}</tbody>
            </table>
          </div>
          {!locked&&<div className="flex flex-wrap gap-2"><button type="button" onClick={addRow} className="rounded-lg border px-3 py-2 text-xs font-semibold" style={{borderColor:'#BF8813',color:'#92400E'}}>+ Ligne</button><button type="button" onClick={addColumn} className="rounded-lg border px-3 py-2 text-xs font-semibold" style={{borderColor:'#002050',color:'#002050'}}>+ Colonne</button></div>}
          <div className="grid gap-2 sm:grid-cols-2"><select className={inputCls} style={style} value={c.mode||'explore'} onChange={e=>onChange({...c,headers,rows,mode:e.target.value})} disabled={locked}><option value="explore">Exploration / lecture</option><option value="training">Entraînement à compléter</option></select><select className={inputCls} style={style} value={c.style||'table'} onChange={e=>onChange({...c,headers,rows,style:e.target.value})} disabled={locked}><option value="table">Tableau</option><option value="cards">Cartes</option></select></div>
          {c.mode==='training'&&<div className="rounded-xl border p-3" style={{borderColor:'#E4E7EC'}}><p className="text-xs font-semibold text-[#002050]">Colonnes que l’apprenant doit compléter</p><div className="mt-2 flex flex-wrap gap-3">{headers.map((header:string,i:number)=><label key={i} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={(c.training_column_indexes||[]).includes(i)} onChange={e=>{const current=new Set<number>(c.training_column_indexes||[]);e.target.checked?current.add(i):current.delete(i);onChange({...c,headers,rows,training_column_indexes:[...current].sort((a,b)=>a-b)})}} disabled={locked}/><span>{header||`Colonne ${i+1}`}</span></label>)}</div></div>}
          <p className="text-[11px] text-slate-500">Le tableau est enregistré cellule par cellule. Les anciennes tables créées avec le format « | » restent compatibles et sont automatiquement normalisées.</p>
        </div>
      );
    }
    case 'timeline': return (
      <div className="space-y-2"><input className={inputCls} style={style} value={c.title||''} onChange={e=>onChange({...c,title:e.target.value})} placeholder="Titre de la timeline (facultatif)" disabled={locked}/>{(c.steps||[]).map((step:any,i:number)=><div key={step.id||i} className="grid gap-2 sm:grid-cols-[180px_1fr]"><input className={inputCls} style={style} value={step.title||''} onChange={e=>{const steps=[...(c.steps||[])];steps[i]={...step,title:e.target.value};onChange({...c,steps})}} placeholder={`Étape ${i+1}`} disabled={locked}/><input className={inputCls} style={style} value={step.description||''} onChange={e=>{const steps=[...(c.steps||[])];steps[i]={...step,description:e.target.value};onChange({...c,steps})}} placeholder="Description" disabled={locked}/></div>)}{!locked&&<button type="button" className="text-xs font-semibold text-[#002050]" onClick={()=>onChange({...c,steps:[...(c.steps||[]),{id:crypto.randomUUID(),date:'',title:'',description:''}]})}>+ Ajouter une étape</button>}</div>
    );
    case 'columns': return <div className="space-y-2"><input className={inputCls} style={style} value={c.title||''} onChange={e=>onChange({...c,title:e.target.value})} placeholder="Titre des colonnes (facultatif)" disabled={locked}/><div className="grid gap-3 md:grid-cols-2">{(c.columns||[]).map((col:any,i:number)=><textarea key={col.id||i} className={inputCls} style={style} rows={5} value={col.content||''} onChange={e=>{const columns=[...(c.columns||[])];columns[i]={...col,content:e.target.value};onChange({...c,columns})}} placeholder={`Colonne ${i+1}`} disabled={locked}/>)}</div></div>;
    case 'code': return <div className="space-y-2"><input className={inputCls} style={style} value={c.language||'text'} onChange={e=>onChange({...c,language:e.target.value})} placeholder="Langage" disabled={locked}/><textarea className={`${inputCls} font-mono`} style={style} rows={8} value={c.code||''} onChange={e=>onChange({...c,code:e.target.value})} placeholder="Code..." disabled={locked}/></div>;
    case 'embed': return <div className="space-y-2"><input className={inputCls} style={style} value={c.title||''} onChange={e=>onChange({...c,title:e.target.value})} placeholder="Titre du contenu" disabled={locked}/><input className={inputCls} style={style} value={c.url||''} onChange={e=>onChange({...c,url:e.target.value})} placeholder="URL HTTPS à intégrer" disabled={locked}/></div>;
    case 'gallery': return (
      <div className="space-y-2"><input className={inputCls} style={style} value={c.title||''} onChange={e=>onChange({...c,title:e.target.value})} placeholder="Titre de la galerie (facultatif)" disabled={locked}/>{(c.images||[]).map((img:any,i:number)=><div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><input className={inputCls} style={style} value={typeof img==='string'?img:(img.url||'')} onChange={e=>{const images=[...(c.images||[])];images[i]=typeof img==='string'?e.target.value:{...img,url:e.target.value};onChange({...c,images})}} placeholder="URL image" disabled={locked}/><input className={inputCls} style={style} value={typeof img==='string'?'':(img.alt||'')} onChange={e=>{const images=[...(c.images||[])];images[i]=typeof img==='string'?{url:img,alt:e.target.value}:{...img,alt:e.target.value};onChange({...c,images})}} placeholder="Texte alternatif" disabled={locked}/>{!locked&&<button type="button" onClick={()=>onChange({...c,images:(c.images||[]).filter((_:any,index:number)=>index!==i)})} className="px-2 text-red-600">×</button>}</div>)}{!locked&&<button type="button" className="text-xs font-semibold text-[#002050]" onClick={()=>onChange({...c,images:[...(c.images||[]),{url:'',alt:''}]})}>+ Ajouter une image</button>}</div>
    );
    case 'formula': return <textarea className={`${inputCls} font-mono`} style={style} rows={3} value={c.latex||''} onChange={e=>onChange({...c,latex:e.target.value})} placeholder="LaTeX : E = mc^2" disabled={locked}/>;
    case 'chart': return <div className="space-y-2"><input className={inputCls} style={style} value={c.title||''} onChange={e=>onChange({...c,title:e.target.value})} placeholder="Titre de la formule (facultatif)" disabled={locked}/><select className={inputCls} style={style} value={c.chart_type||'bar'} onChange={e=>onChange({...c,chart_type:e.target.value})} disabled={locked}><option value="bar">Barres</option><option value="line">Courbe</option><option value="pie">Camembert</option></select><input className={inputCls} style={style} value={(c.labels||[]).join(', ')} onChange={e=>onChange({...c,labels:e.target.value.split(',').map((x:string)=>x.trim())})} placeholder="Libellés séparés par des virgules" disabled={locked}/><input className={inputCls} style={style} value={(c.values||[]).join(', ')} onChange={e=>onChange({...c,values:e.target.value.split(',').map((x:string)=>Number(x.trim())||0)})} placeholder="Valeurs séparées par des virgules" disabled={locked}/></div>;
    case 'assignment_upload': return <div className="space-y-2"><input className={inputCls} style={style} value={c.title||''} onChange={e=>onChange({...c,title:e.target.value})} placeholder="Titre du travail" disabled={locked}/><textarea className={inputCls} style={style} rows={5} value={c.instructions||''} onChange={e=>onChange({...c,instructions:e.target.value})} placeholder="Consignes détaillées" disabled={locked}/><input type="number" min={1} className={inputCls} style={style} value={c.max_size_mb||10} onChange={e=>onChange({...c,max_size_mb:Math.max(1,Number(e.target.value)||10)})} disabled={locked}/></div>;
    case 'rubric': return (
      <div className="space-y-2">{(c.criteria||[]).map((criterion:any,i:number)=><div key={i} className="grid gap-2 rounded-xl border p-3 md:grid-cols-[180px_1fr_90px]" style={style}><input className={inputCls} style={style} value={criterion.name||''} onChange={e=>{const criteria=[...(c.criteria||[])];criteria[i]={...criterion,name:e.target.value};onChange({...c,criteria})}} placeholder="Critère" disabled={locked}/><input className={inputCls} style={style} value={criterion.description||''} onChange={e=>{const criteria=[...(c.criteria||[])];criteria[i]={...criterion,description:e.target.value};onChange({...c,criteria})}} placeholder="Description" disabled={locked}/><input type="number" min={0} className={inputCls} style={style} value={criterion.points||0} onChange={e=>{const criteria=[...(c.criteria||[])];criteria[i]={...criterion,points:Number(e.target.value)||0};onChange({...c,criteria})}} disabled={locked}/></div>)}{!locked&&<button type="button" className="text-xs font-semibold text-[#002050]" onClick={()=>onChange({...c,criteria:[...(c.criteria||[]),{name:'',description:'',points:10}]})}>+ Ajouter un critère</button>}</div>
    );

    case 'dictation': case 'listening_comprehension': return <div className="space-y-2"><LanguageBlockEditor type={block.block_type} c={c} locked={locked} onChange={onChange}/>{c.audio_url&&<audio className="w-full" controls src={c.audio_url}/>} {!locked&&<button type="button" onClick={()=>onGenerateTts?.(String(c.transcript||c.instructions||''),'audio_url')} disabled={mediaAiBusy===`tts:${block.id}:audio_url`} className="px-3 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50" style={{background:'#BF8813'}}>Générer l’audio IA</button>}</div>;
    case 'oral_response': return <div className="space-y-2"><LanguageBlockEditor type={block.block_type} c={c} locked={locked} onChange={onChange}/>{c.reference_audio_url&&<audio className="w-full" controls src={c.reference_audio_url}/>} {!locked&&<button type="button" onClick={()=>onGenerateTts?.(String(c.prompt||''),'reference_audio_url')} disabled={mediaAiBusy===`tts:${block.id}:reference_audio_url`} className="px-3 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50" style={{background:'#BF8813'}}>Générer l’audio de référence</button>}</div>;
    case 'pronunciation': return <div className="space-y-2"><LanguageBlockEditor type={block.block_type} c={c} locked={locked} onChange={onChange}/>{!locked&&(c.items||[]).map((item:any,i:number)=><div key={i} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2"><span className="truncate text-xs text-slate-600">Audio IA : {item.text||`élément ${i+1}`}</span>{item.audio_url&&<audio className="h-8 max-w-40" controls src={item.audio_url}/>}<button type="button" onClick={()=>onGenerateTts?.(String(item.text||''),`items.${i}.audio_url`)} disabled={!String(item.text||'').trim()||mediaAiBusy===`tts:${block.id}:items.${i}.audio_url`} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40" style={{background:'#BF8813'}}>Générer</button></div>)}</div>;
    case 'vocabulary': return <div className="space-y-2"><LanguageBlockEditor type={block.block_type} c={c} locked={locked} onChange={onChange}/>{!locked&&(c.items||[]).map((item:any,i:number)=><div key={i} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2"><span className="truncate text-xs text-slate-600">Prononcer : {item.term||`élément ${i+1}`}</span>{item.audio_url&&<audio className="h-8 max-w-40" controls src={item.audio_url}/>}<button type="button" onClick={()=>onGenerateTts?.(String(item.term||''),`items.${i}.audio_url`)} disabled={!String(item.term||'').trim()||mediaAiBusy===`tts:${block.id}:items.${i}.audio_url`} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40" style={{background:'#BF8813'}}>Générer</button></div>)}</div>;
    case 'dialogue': case 'cloze': case 'matching': case 'sentence_order': case 'written_expression':
      return <LanguageBlockEditor type={block.block_type} c={c} locked={locked} onChange={onChange} />;
    case 'separator': return <hr style={{ borderColor: '#E4E7EC' }} />;
    case 'pdf': case 'word': case 'excel': case 'scorm': case 'download': return (
      <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: '#F8F9FA', border: '1px solid #E4E7EC' }}>
        {block.block_type === 'pdf' ? <FileText size={20} style={{ color: '#DC2626' }} /> :
         block.block_type === 'excel' ? <Table size={20} style={{ color: '#1E7A52' }} /> :
         block.block_type === 'word' ? <FileText size={20} style={{ color: '#1D4ED8' }} /> :
         block.block_type === 'scorm' ? <Layers size={20} style={{ color: '#92400E' }} /> :
         <Download size={20} style={{ color: '#374151' }} />}
        <div className="flex-1">
          <input className="font-semibold text-sm bg-transparent border-none outline-none w-full" style={{ color: '#002050' }}
            value={c.title || ''} onChange={e => onChange({ ...c, title: e.target.value })} placeholder="Titre du fichier..." disabled={locked} />
          {block.file_name ? (
            <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{block.file_name} {block.file_size ? `· ${Math.round(block.file_size / 1024)} Ko` : ''}</p>
          ) : (
            <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Aucun fichier — configurez dans les réglages →</p>
          )}
        </div>
      </div>
    );
    default: return (
      <div className="p-3 rounded-lg" style={{ background: '#F8F9FA' }}>
        <p className="text-xs" style={{ color: '#9CA3AF' }}>Bloc "{block.block_type}" — configurez dans le panneau de droite</p>
      </div>
    );
  }
}


function PedagogicalLocalizationEditor({ block, locked, onUpdate }: { block: Block; locked: boolean; onUpdate: (updates: Partial<Block>) => void }) {
  const settings = block.settings_json || {};
  const loc = settings.pedagogical_localization && typeof settings.pedagogical_localization === 'object' ? settings.pedagogical_localization : {};
  const amounts = Array.isArray(loc.amounts) ? loc.amounts : [];
  const save = (next: any[]) => onUpdate({ settings_json: { ...settings, pedagogical_localization: { ...loc, amounts: next } } });
  const updateAmount = (index:number, patch:Record<string,any>) => save(amounts.map((row:any,i:number)=>i===index?{...row,...patch}:row));
  const add = () => save([...amounts,{key:`amount_${amounts.length+1}`,nature:'pedagogical',reference_value:0,reference_currency:'EUR',localize:true,variants:{}}]);
  const localizable = ['text','callout','remember','objective','example','summary','important','case_study','open_question','exercise','qcm','true_false','matching','interactive_table','written_expression','definition','correction','bullet_list','numbered_list'].includes(block.block_type);
  if (!localizable) return null;
  return <details className="rounded-xl border p-3" style={{borderColor:'#DDE5F0',background:'#F8FAFC'}}>
    <summary className="cursor-pointer text-xs font-bold" style={{color:'#002050'}}>Localisation pédagogique des montants</summary>
    <div className="mt-3 space-y-3">
      <p className="text-[11px] text-slate-500">Aucun nombre n’est modifié automatiquement. Déclarez uniquement les montants qui peuvent être localisés, puis insérez leur marqueur dans le contenu.</p>
      {amounts.map((row:any,index:number)=>{
        const variants=row.variants&&typeof row.variants==='object'?row.variants:{};
        const variantsText=Object.entries(variants).map(([code,value])=>`${code}=${value}`).join('; ');
        const marker=`{{oga_amount:${String(row.key||'amount')}}}`;
        return <div key={index} className="rounded-lg border bg-white p-3" style={{borderColor:'#E4E7EC'}}>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-[11px] font-semibold text-slate-600">Identifiant<input className="mt-1 w-full rounded border px-2 py-2 text-xs" value={row.key||''} disabled={locked} onChange={e=>updateAmount(index,{key:e.target.value.replace(/[^A-Za-z0-9_-]/g,'_')})}/></label>
            <label className="text-[11px] font-semibold text-slate-600">Nature<select className="mt-1 w-full rounded border px-2 py-2 text-xs" value={row.nature||'pedagogical'} disabled={locked} onChange={e=>updateAmount(index,{nature:e.target.value,localize:e.target.value==='pedagogical'?row.localize!==false:false})}><option value="pedagogical">Pédagogique / simulation</option><option value="real">Réel / factuel — conserver</option></select></label>
            <label className="text-[11px] font-semibold text-slate-600">Valeur de référence<input type="number" step="0.01" className="mt-1 w-full rounded border px-2 py-2 text-xs" value={Number(row.reference_value||0)} disabled={locked} onChange={e=>updateAmount(index,{reference_value:Number(e.target.value)||0})}/></label>
            <label className="text-[11px] font-semibold text-slate-600">Devise de référence<input maxLength={3} className="mt-1 w-full rounded border px-2 py-2 text-xs uppercase" value={String(row.reference_currency||'EUR')} disabled={locked} onChange={e=>updateAmount(index,{reference_currency:e.target.value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,3)})}/></label>
          </div>
          {row.nature!=='real' && <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={row.localize!==false} disabled={locked} onChange={e=>updateAmount(index,{localize:e.target.checked})}/>Ce montant peut être localisé</label>}
          {row.nature!=='real' && row.localize!==false && <label className="mt-2 block text-[11px] font-semibold text-slate-600">Variantes stables par devise
            <input className="mt-1 w-full rounded border px-2 py-2 text-xs" value={variantsText} disabled={locked} placeholder="XOF=31500000; USD=52000" onChange={e=>{const next:Record<string,number>={};for(const part of e.target.value.split(';')){const [code,val]=part.split('=').map(x=>x?.trim());if(/^[A-Za-z]{3}$/.test(code||'')&&Number.isFinite(Number(val)))next[String(code).toUpperCase()]=Number(val)}updateAmount(index,{variants:next})}}/>
          </label>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="rounded bg-slate-100 px-2 py-1 text-[11px]">{marker}</code>
            {!locked && <button type="button" className="rounded border px-2 py-1 text-[11px] font-semibold" onClick={()=>navigator.clipboard?.writeText(marker)}>Copier le marqueur</button>}
            {!locked && <button type="button" className="rounded border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-700" onClick={()=>save(amounts.filter((_:any,i:number)=>i!==index))}>Supprimer</button>}
          </div>
        </div>
      })}
      {!locked && <button type="button" onClick={add} className="rounded-lg border px-3 py-2 text-xs font-semibold" style={{borderColor:'#002050',color:'#002050'}}>+ Ajouter un montant localisable</button>}
    </div>
  </details>;
}

// ─── Panneau réglages du bloc ─────────────────────────────────
function BlockSettings({ block, locked, onUpdate, onAI, onRemoveResource, onBeforeUpload, onResourceUploaded, courseId, moduleId, lessonId, lessonBlocks, forcedAssessmentScope }: {
  block: Block; locked: boolean;
  onUpdate: (updates: Partial<Block>) => void;
  onAI: (action: string, prompt: string) => void;
  onRemoveResource: () => void;
  onBeforeUpload: () => Promise<void>;
  onResourceUploaded: (savedBlock: Block) => void;
  courseId: string; moduleId: string; lessonId: string; lessonBlocks: Block[]; forcedAssessmentScope?: 'lesson'|'module'|'final'|null;
}) {
  const c = block.content_json || {};
  const relationActivityTypes = new Set(['qcm','true_false','open_question','exercise','assignment_upload','case_study','flashcards','interactive_table','checklist','cloze','dictation','pronunciation','matching','sentence_order','oral_response','listening_comprehension','written_expression']);
  const relationCandidates = (lessonBlocks || []).filter(item => item.id !== block.id && relationActivityTypes.has(item.block_type));
  const correctionCandidates = relationCandidates.filter(item => item.interaction_mode !== 'assessment');
  const linkedIds = Array.isArray(block.linked_block_ids) ? block.linked_block_ids.map(String) : [];
  const incomingRubricIds = Array.isArray(block.rubric_block_ids) ? block.rubric_block_ids.map(String) : [];
  const incomingCorrectionIds = Array.isArray(block.correction_block_ids) ? block.correction_block_ids.map(String) : [];
  const rubricBlocks = (lessonBlocks || []).filter(item => item.block_type === 'rubric' && item.id !== block.id);
  const correctionBlocks = (lessonBlocks || []).filter(item => item.block_type === 'correction' && item.id !== block.id);
  const autoGradingTypes = new Set(['qcm','true_false','cloze','matching','sentence_order','dictation','listening_comprehension']);
  const responseMode = String(c.response_mode || (c.learner_upload_required === true ? 'file' : 'text'));
  const fileBasedResponse = ['assignment_upload','oral_response','pronunciation'].includes(block.block_type) || (['exercise','case_study'].includes(block.block_type) && responseMode !== 'text');
  const blockLabel = (item: Block) => String(item.title || item.content_json?.title || item.content_json?.question || item.content_json?.statement || BLOCK_DEFS.find(def => def.type === item.block_type)?.label || item.block_type).trim();
  const inputCls = 'w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:border-[#002050]';
  const style = { borderColor: '#E4E7EC' };
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [fileDragActive, setFileDragActive] = useState(false);
  const uploadInFlight = useRef(false);
  const showOptionalBlockTitle = !['heading','subheading','separator','callout','remember','objective','example','summary','important','definition','correction','quote'].includes(block.block_type);
  const resourceRagCapable = ['pdf','word','excel','download'].includes(block.block_type);
  const previewProtectedResource = ['image','gallery','video','audio','pdf','word','excel','download','embed'].includes(block.block_type);

  // ── Téléversement sécurisé vers les fournisseurs OGA existants ─────
  // Prepare/commit are backend actions; signed transient URLs never become source data.
  function handleMediaDrop(e: React.DragEvent<HTMLElement>, kind: string) {
    e.preventDefault(); e.stopPropagation(); setFileDragActive(false);
    if (locked || uploadInFlight.current) return;
    const files = e.dataTransfer.files;
    if (files.length !== 1) { setUploadError('Déposez un seul fichier à la fois.'); return; }
    void handleFileUpload(files[0], kind);
  }
  async function handleFileUpload(file: File, blockType: string) {
    if (!file || locked || uploadInFlight.current) return;
    setUploadError(''); setUploadStatus('');
    if (!Object.prototype.hasOwnProperty.call(STUDIO_MEDIA_POLICY, blockType)) {
      setUploadError('Type de ressource non pris en charge.'); return;
    }
    const mediaKind = blockType as StudioMediaKind;
    try { checkStudioMediaFile(file, mediaKind); }
    catch(error) { setUploadError(error instanceof Error ? error.message : 'Fichier invalide'); return; }
    uploadInFlight.current = true;
    setUploading(true); setUploadProgress(5);
    try {
      // Do not let an older autosave overwrite the metadata committed by upload_block_file.
      setUploadStatus('Enregistrement des modifications en attente…');
      await onBeforeUpload();
      const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
      const bucket = STUDIO_MEDIA_POLICY[mediaKind].bucket;
      // A unique object key avoids serving a cached older version after a new upload.
      const path = `${courseId}/${moduleId}/${lessonId}/${block.id}-${crypto.randomUUID()}.${ext}`;
      setUploadProgress(15); setUploadStatus('Préparation du téléversement…');
      const prepared = await api('prepare_upload', {
        course_id: courseId, module_id: moduleId, lesson_id: lessonId,
        block_id: block.id, bucket_name: bucket, storage_path: path,
        file_name: file.name, size_bytes: file.size, file_mime: file.type || 'application/octet-stream',
      });
      if (!prepared.success) throw new Error(prepared.message || prepared.error || 'Préparation impossible');
      if (prepared.provider === 'cloudflare_stream') {
        const uploadUrl = String(prepared.upload_url || '');
        const streamUid = String(prepared.stream_uid || '');
        if (!uploadUrl || !streamUid) throw new Error('Réponse Cloudflare Stream incomplète');
        setUploadStatus('Envoi de la vidéo vers Cloudflare Stream…'); setUploadProgress(20);
        if (prepared.protocol === 'stream_tus') {
          // Cloudflare TUS offsets are authoritative; never assume the server accepted an entire chunk.
          const chunkSize = Math.max(256 * 1024, Number(prepared.chunk_size_bytes || 50 * 1024 * 1024));
          let offset = 0;
          while (offset < file.size) {
            const chunk = file.slice(offset, Math.min(file.size, offset + chunkSize));
            const res = await fetch(uploadUrl, {
              method: 'PATCH',
              headers: { 'Tus-Resumable': '1.0.0', 'Upload-Offset': String(offset), 'Content-Type': 'application/offset+octet-stream' },
              body: chunk,
            });
            if (!res.ok) throw new Error(`Échec du transfert vidéo TUS (${res.status})`);
            const rawOffset = res.headers.get('Upload-Offset');
            if (!rawOffset) throw new Error('Cloudflare Stream n’a pas confirmé la position du fichier.');
            const nextOffset = Number(rawOffset);
            if (!Number.isSafeInteger(nextOffset) || nextOffset <= offset || nextOffset > file.size || nextOffset > offset + chunk.size) {
              throw new Error('Offset TUS invalide : téléversement interrompu pour éviter une vidéo corrompue.');
            }
            offset = nextOffset;
            setUploadProgress(20 + Math.round((offset / file.size) * 65));
          }
        } else if (prepared.protocol === 'stream_basic') {
          const form = new FormData(); form.append('file', file, file.name);
          const res = await fetch(uploadUrl, { method: 'POST', body: form });
          if (!res.ok) throw new Error(`Échec du transfert Cloudflare Stream (${res.status})`);
          setUploadProgress(85);
        } else throw new Error('Protocole vidéo non reconnu.');
        setUploadStatus('Enregistrement de la vidéo dans OGA…');
        const saved = await api('upload_block_file', {
          block_id: block.id, course_id: courseId, module_id: moduleId, lesson_id: lessonId,
          provider: 'cloudflare_stream', stream_uid: streamUid,
          file_name: file.name, file_size: file.size, file_mime: file.type || 'application/octet-stream',
        });
        if (!saved.success || !saved.block) throw new Error(saved.message || saved.error || 'Enregistrement de la vidéo impossible');
        onResourceUploaded(saved.block as Block); setUploadProgress(100);
        setUploadStatus('Vidéo enregistrée.');
        return;
      }
      if (prepared.provider !== 'supabase_storage' || !prepared.signedUrl) {
        throw new Error('Lien sécurisé de téléversement Supabase absent ou incorrect.');
      }
      setUploadStatus('Envoi du fichier vers le stockage OGA…'); setUploadProgress(35);
      const res = await fetch(String(prepared.signedUrl), {
        method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file,
      });
      if (!res.ok) throw new Error(`Téléversement refusé (${res.status}).`);
      setUploadProgress(85); setUploadStatus('Enregistrement de la ressource dans OGA…');
      const saved = await api('upload_block_file', {
        block_id: block.id, course_id: courseId, module_id: moduleId, lesson_id: lessonId,
        provider: 'supabase_storage', bucket_name: bucket, storage_path: path,
        file_name: file.name, file_size: file.size, file_mime: file.type || 'application/octet-stream',
      });
      if (!saved.success || !saved.block) throw new Error(saved.message || saved.error || 'Enregistrement du fichier impossible');
      let authoritative = saved.block as Block;
      // RAG is a separate operation. Failure should not imply that upload itself failed.
      if (resourceRagCapable && block.rag_enabled === true) {
        onResourceUploaded(authoritative);
        try {
          const rag = await api('resource_rag_update', { course_id: courseId, block_id: block.id, enabled: true });
          if (rag.success && rag.block) authoritative = rag.block as Block;
        } catch (error) {
          setUploadError(`Ressource enregistrée, mais indexation RAG indisponible : ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
        }
      }
      onResourceUploaded(authoritative);
      setUploadProgress(100); setUploadStatus('Ressource enregistrée.');
    } catch (error) {
      console.error('Studio B2 media upload:', error);
      setUploadError(error instanceof Error ? error.message : 'Téléversement impossible.');
      setUploadStatus('');
    } finally {
      uploadInFlight.current = false;
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      {uploadError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{uploadError}</div>}
      {uploadStatus && <div role="status" aria-live="polite" className="text-xs font-medium text-[#002050]">{uploadStatus}{uploading ? ` · ${uploadProgress}%` : ''}</div>}
      {showOptionalBlockTitle && <div>
        <label className="block text-xs font-semibold mb-1.5" style={{ color: '#002050' }}>Nom affiché (facultatif)</label>
        <input className={inputCls} style={style} value={block.title || ''}
          onChange={e => onUpdate({ title: e.target.value })} placeholder="Ex. Ressource complémentaire" disabled={locked} />
      </div>}

      {['heading','subheading','text','bullet_list','numbered_list','quote','callout','remember','objective','example','summary','important','definition','correction'].includes(block.block_type) && (
        <details className="rounded-xl border p-3" style={{ borderColor: '#E4E7EC' }}>
          <summary className="cursor-pointer text-xs font-bold" style={{ color: '#002050' }}>Apparence</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-semibold text-slate-600">Style de texte<select className={`${inputCls} mt-1`} style={style} value={String(block.settings_json?.font_scale || 'normal')} disabled={locked} onChange={e=>onUpdate({settings_json:{...(block.settings_json||{}),font_scale:e.target.value}})}><option value="small">Petit</option><option value="normal">Normal</option><option value="large">Grand</option></select></label>
            <label className="text-xs font-semibold text-slate-600">Police<select className={`${inputCls} mt-1`} style={style} value={String(block.settings_json?.font_family || 'Inter')} disabled={locked} onChange={e=>onUpdate({settings_json:{...(block.settings_json||{}),font_family:e.target.value}})}><option value="Inter">Inter</option><option value="Arial">Arial</option><option value="Georgia">Georgia</option></select></label>
            <label className="text-xs font-semibold text-slate-600">Alignement<select className={`${inputCls} mt-1`} style={style} value={String(block.settings_json?.text_align || 'left')} disabled={locked} onChange={e=>onUpdate({settings_json:{...(block.settings_json||{}),text_align:e.target.value}})}><option value="left">Gauche</option><option value="center">Centre</option><option value="right">Droite</option></select></label>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">La mise en forme avancée reste dans Options afin de garder le bloc centré sur la rédaction.</p>
        </details>
      )}

      {block.block_type === 'rubric' && (
        <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: '#DDE5F0', background: '#F8FAFC' }}>
          <div><p className="text-xs font-bold" style={{ color: '#002050' }}>Associer la grille à</p><p className="mt-1 text-[11px] text-gray-500">Sélectionnez une ou plusieurs activités de cette leçon. Cette association alimente aussi la grille des questions lors de la création d’une évaluation officielle.</p></div>
          {relationCandidates.length ? relationCandidates.map(item => <label key={item.id} className="flex items-start gap-2 rounded-lg border bg-white p-2 text-xs" style={{borderColor:'#E4E7EC'}}><input type="checkbox" className="mt-0.5" checked={linkedIds.includes(String(item.id))} disabled={locked} onChange={e=>{const next=e.target.checked?[...linkedIds,String(item.id)]:linkedIds.filter(id=>id!==String(item.id));onUpdate({linked_block_ids:next})}}/><span><strong style={{color:'#002050'}}>{blockLabel(item)}</strong><span className="block text-[10px] text-slate-500">{BLOCK_DEFS.find(def=>def.type===item.block_type)?.label || item.block_type}</span></span></label>) : <p className="text-xs text-amber-700">Ajoutez d’abord une activité à évaluer dans cette leçon.</p>}
        </div>
      )}

      {block.block_type === 'correction' && (
        <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: '#DDE5F0', background: '#F8FAFC' }}>
          <div><p className="text-xs font-bold" style={{ color: '#002050' }}>Correction de</p><p className="mt-1 text-[11px] text-gray-500">La correction restera masquée jusqu’à la tentative de l’activité sélectionnée.</p></div>
          <select className={inputCls} style={style} value={linkedIds[0] || ''} disabled={locked} onChange={e=>onUpdate({linked_block_ids:e.target.value?[e.target.value]:[]})}>
            <option value="">— Sélectionner l’exercice ou l’entraînement —</option>
            {correctionCandidates.map(item => <option key={item.id} value={item.id}>{blockLabel(item)} · {BLOCK_DEFS.find(def=>def.type===item.block_type)?.label || item.block_type}</option>)}
          </select>
        </div>
      )}

      {TRAINING_CAPABLE_BLOCKS.has(block.block_type) && (
        <div className="rounded-xl border p-3 space-y-3" style={{ borderColor: '#DDE5F0', background: '#F8FAFC' }}>
          <div>
            <p className="text-xs font-bold" style={{ color: '#002050' }}>Usage pédagogique</p>
            <p className="mt-1 text-[11px] text-gray-500">Une activité d’entraînement produit une note d’entraînement distincte. Une activité d’évaluation alimente l’évaluation officielle choisie.</p>
          </div>
          {forcedAssessmentScope ? (
            <div className="rounded-lg border px-3 py-2 text-xs font-semibold" style={{borderColor:'#DDD6FE',background:'#F5F3FF',color:'#6D28D9'}}>Évaluation officielle · {forcedAssessmentScope==='lesson'?'leçon':forcedAssessmentScope==='module'?'module':'finale'}</div>
          ) : (
            <select className={inputCls} style={style} value={block.interaction_mode || 'training'} disabled={locked}
              onChange={e => onUpdate({ interaction_mode: e.target.value as Block['interaction_mode'], assessment_scope: null })}>
              {['flashcards','interactive_table','checklist'].includes(block.block_type) && <option value="content">Contenu interactif</option>}
              <option value="training">Entraînement</option>
            </select>
          )}
          {(block.interaction_mode || 'training') === 'training' && <>
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-700"><input type="checkbox" checked={block.is_required === true} disabled={locked} onChange={e => onUpdate({ is_required: e.target.checked })}/> Obligatoire pour progresser</label>
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-700"><input type="checkbox" checked={block.training_is_graded !== false} disabled={locked} onChange={e => onUpdate({ training_is_graded: e.target.checked })}/> Entraînement noté</label>
            {block.training_is_graded !== false ? <div>
              <label className="block text-xs mb-1" style={{ color: '#6B7280' }}>Seuil de réussite de l’entraînement (%)</label>
              <input type="number" min={1} max={100} className={inputCls} style={style} value={Number(block.training_passing_score ?? 80)} disabled={locked} onChange={e => onUpdate({ training_passing_score: Math.min(100, Math.max(1, Number(e.target.value) || 80)) })}/>
            </div> : <p className="rounded-lg bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">Non noté : aucune note ni seuil de réussite. Si l’activité est obligatoire, une tentative/soumission suffit pour progresser.</p>}
          </>}
          {block.interaction_mode === 'assessment' && <div className="space-y-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-700"><input type="checkbox" checked={block.settings_json?.assessment_required === true} disabled={locked} onChange={e=>onUpdate({settings_json:{...(block.settings_json||{}),assessment_required:e.target.checked}})}/>Évaluation obligatoire pour progresser / certifier</label>
            <div>
              <label className="block text-xs mb-1" style={{color:'#6B7280'}}>Seuil de réussite de l’évaluation (%)</label>
              <input type="number" min={1} max={100} className={inputCls} style={style} value={Number(block.settings_json?.assessment_passing_score ?? 80)} disabled={locked} onChange={e=>onUpdate({settings_json:{...(block.settings_json||{}),assessment_passing_score:Math.min(100,Math.max(1,Number(e.target.value)||80))}})}/>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{color:'#6B7280'}}>Points maximum de ce bloc</label>
              <input type="number" min={0.1} step={0.5} className={inputCls} style={style} value={Number(c.points ?? 10)} disabled={locked} onChange={e=>onUpdate({content_json:{...c,points:Math.max(0.1,Number(e.target.value)||0.1)}})}/>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{color:'#6B7280'}}>Mode de correction</label>
              {autoGradingTypes.has(block.block_type) ? <div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">Automatique — réponse objectivement vérifiable</div> :
              <select className={inputCls} style={style} value={fileBasedResponse ? 'human' : String(c.grading_mode || 'human')} disabled={locked || fileBasedResponse} onChange={e=>onUpdate({content_json:{...c,grading_mode:e.target.value}})}>
                <option value="ai">Intelligence artificielle</option>
                <option value="human">Évaluateur humain</option>
                <option value="ai_human">IA + validation humaine</option>
              </select>}
              {fileBasedResponse && <p className="mt-1 text-[11px] text-amber-700">Une pièce jointe est demandée : correction humaine obligatoire tant qu’OGA ne dispose pas d’un pipeline fiable d’extraction des fichiers remis.</p>}
            </div>
            {!autoGradingTypes.has(block.block_type) && <div className="rounded-lg border bg-white p-3" style={{borderColor:'#E4E7EC'}}>
              <p className="text-xs font-bold" style={{color:'#002050'}}>Grille d’évaluation associée</p>
              {rubricBlocks.length ? rubricBlocks.map(item=><label key={item.id} className="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={incomingRubricIds.includes(String(item.id))} disabled={locked} onChange={e=>{const next=e.target.checked?[...incomingRubricIds,String(item.id)]:incomingRubricIds.filter(id=>id!==String(item.id));onUpdate({rubric_block_ids:next})}}/>{blockLabel(item)}</label>) : <p className="mt-1 text-[11px] text-slate-500">Aucune grille dans cette leçon.</p>}
            </div>}
            <div className="rounded-lg border bg-white p-3" style={{borderColor:'#E4E7EC'}}>
              <p className="text-xs font-bold" style={{color:'#002050'}}>Correction pédagogique associée</p>
              <select className={`${inputCls} mt-2`} style={style} value={incomingCorrectionIds[0] || ''} disabled={locked} onChange={e=>onUpdate({correction_block_ids:e.target.value?[e.target.value]:[]})}>
                <option value="">Aucune correction liée</option>
                {correctionBlocks.map(item=><option key={item.id} value={item.id}>{blockLabel(item)}</option>)}
              </select>
            </div>
            <p className="rounded-lg bg-blue-50 px-3 py-2 text-[11px] text-blue-800">Les paramètres sont définis ici pendant le Build. La Finalisation sert uniquement à contrôler leur cohérence avant publication.</p>
          </div>}
        </div>
      )}

      <PedagogicalLocalizationEditor block={block} locked={locked} onUpdate={onUpdate} />

      {/* Source image */}
      {block.block_type === 'image' && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#002050' }}>Source de l'image</label>
            <div className="space-y-1.5">
              {[{ value: 'upload', label: 'Téléverser un fichier' }, { value: 'url', label: 'URL externe' }].map(src => (
                <label key={src.value} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="img_source" value={src.value}
                    checked={(c.source || 'upload') === src.value}
                    onChange={() => onUpdate({ content_json: { ...c, source: src.value } })}
                    style={{ accentColor: '#002050' }} disabled={locked} />
                  <span className="text-sm" style={{ color: '#374151' }}>{src.label}</span>
                </label>
              ))}
            </div>
          </div>
          {c.source === 'url' && (
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#002050' }}>URL de l'image</label>
              <input className={inputCls} style={style} value={c.url || ''} onChange={e => onUpdate({ content_json: { ...c, url: e.target.value } })} placeholder="https://..." disabled={locked} />
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#002050' }}>Description (texte alternatif)</label>
            <textarea className={inputCls} style={{ ...style, resize: 'none' }} rows={2}
              value={c.alt || ''} onChange={e => onUpdate({ content_json: { ...c, alt: e.target.value } })} placeholder="Description pour accessibilité..." disabled={locked} />
          </div>
        </div>
      )}

      {/* Paramètres QCM */}
      {block.block_type === 'qcm' && (
        <div className="space-y-3">
          <div className="p-3 rounded-lg" style={{ background: '#EFF6FF' }}>
            <p className="text-xs font-semibold mb-1" style={{ color: '#1D4ED8' }}>Saisie manuelle prioritaire</p>
            <p className="text-xs" style={{ color: '#6B7280' }}>Remplissez la question et les réponses dans le canevas central. L'IA peut vous assister.</p>
          </div>
          <button onClick={() => onAI('ai_generate_qcm', c.question || '')}
            className="w-full py-2 rounded-xl text-sm font-semibold border flex items-center justify-center gap-2"
            style={{ borderColor: '#BF8813', color: '#BF8813' }}>
            <Sparkles size={13} /> Générer avec l'IA
          </button>
        </div>
      )}

      {/* Paramètres vidéo */}
      {block.block_type === 'video' && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#002050' }}>Source de la vidéo</label>
            <div className="flex gap-3 text-sm">
              <label className="flex items-center gap-2"><input type="radio" name={`video_source_${block.id}`} checked={(c.source || 'upload') === 'upload'} onChange={() => onUpdate({ content_json: { ...c, source: 'upload' } })} disabled={locked} /> Importer un fichier</label>
              <label className="flex items-center gap-2"><input type="radio" name={`video_source_${block.id}`} checked={c.source === 'url'} onChange={() => onUpdate({ content_json: { ...c, source: 'url' } })} disabled={locked} /> URL</label>
            </div>
          </div>
          {c.source === 'url' && (
            <input className={inputCls} style={style} value={c.url || ''} onChange={e => onUpdate({ content_json: { ...c, url: e.target.value } })} placeholder="YouTube, Vimeo ou URL directe" disabled={locked} />
          )}
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-sm font-semibold" style={{ color: '#002050' }}>Mode éco-data</p>
              <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>La vidéo n’est chargée qu’après une action de l’apprenant.</p>
            </div>
            <button type="button" role="switch" aria-checked={Boolean(c.eco_data)} aria-label="Activer le mode éco-data" disabled={locked} className={`w-10 h-6 rounded-full relative transition-all disabled:opacity-40 ${c.eco_data ? 'bg-[#002050]' : 'bg-gray-200'}`} onClick={() => onUpdate({ content_json: { ...c, eco_data: !c.eco_data } })}>
              <span className="absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform" style={{ transform: c.eco_data ? 'translateX(20px)' : 'translateX(4px)' }} />
            </button>
          </label>
        </div>
      )}
       {/* Upload fichiers — Vidéo, PDF, Word, Excel, Audio, SCORM, Download */}
      {['video', 'pdf', 'word', 'excel', 'audio', 'scorm', 'download'].includes(block.block_type) && ((block.block_type !== 'video' || (c.source || 'upload') === 'upload') && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#002050' }}>
              Fichier {block.block_type.toUpperCase()}
            </label>
            {block.file_name ? (
              <div className="p-3 rounded-xl border flex items-center gap-2" style={{ background: '#F0FDF4', borderColor: '#A7F3D0' }}>
                <CheckCircle size={14} style={{ color: '#1E7A52' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: '#065F46' }}>{block.file_name}</p>
                  {block.file_size && <p className="text-xs" style={{ color: '#9CA3AF' }}>{Math.round(block.file_size / 1024)} Ko</p>}
                </div>
                {!locked && (
                  <button onClick={onRemoveResource}
                    className="text-xs px-2 py-1 rounded-lg" style={{ color: '#DC2626', background: '#FEE2E2' }}>
                    Retirer
                  </button>
                )}
              </div>
            ) : (
              <label onDragEnter={e=>{e.preventDefault();if(!locked&&!uploading)setFileDragActive(true);}} onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect=(locked||uploading)?'none':'copy';}} onDragLeave={e=>{e.preventDefault();setFileDragActive(false);}} onDrop={e=>handleMediaDrop(e,block.block_type)} className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all ${fileDragActive?'border-[#BF8813] bg-amber-50':''} ${locked ? 'opacity-50 cursor-not-allowed' : 'hover:border-[#002050]'}`}
                style={{ borderColor: '#E4E7EC', background: '#F8F9FA' }}>
                <input type="file" className="hidden" disabled={locked || uploading}
                  accept={
                    block.block_type === 'video' ? '.mp4,.mov,.avi,.mkv,.webm' :
                    block.block_type === 'pdf' ? '.pdf' :
                    block.block_type === 'word' ? '.doc,.docx' :
                    block.block_type === 'excel' ? '.xls,.xlsx,.csv' :
                    block.block_type === 'audio' ? '.mp3,.wav,.ogg,.m4a' :
                    block.block_type === 'scorm' ? '.zip' :
                    '*'
                  }
                  onChange={e => { const f = e.target.files?.[0]; if (f) void handleFileUpload(f, block.block_type); e.currentTarget.value=''; }} />
                {uploading ? (
                  <div className="text-center">
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2" style={{ width: '120px' }}>
                      <div className="h-1.5 rounded-full transition-all" style={{ width: `${uploadProgress}%`, background: '#002050' }} />
                    </div>
                    <p className="text-xs" style={{ color: '#6B7280' }}>Envoi en cours... {uploadProgress}%</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <Download size={20} className="mx-auto mb-2" style={{ color: '#9CA3AF' }} />
                    <p className="text-xs font-semibold" style={{ color: '#374151' }}>
                      {block.block_type === 'video' ? 'Glissez votre vidéo ici' :
                       block.block_type === 'scorm' ? 'Glissez votre ZIP SCORM ici' :
                       block.block_type === 'pdf' ? 'Glissez votre PDF ici' :
                       block.block_type === 'word' ? 'Glissez votre document Word ici' :
                       block.block_type === 'excel' ? 'Glissez votre fichier Excel ici' :
                       block.block_type === 'audio' ? 'Glissez votre fichier audio ici' :
                       'Glissez votre fichier ici'}
                    </p>
                    <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>ou cliquez pour sélectionner</p>
                    {block.block_type === 'scorm' && (
                      <p className="text-xs mt-2 px-2 py-1 rounded" style={{ background: '#FEF3C7', color: '#92400E' }}>
                        Format ZIP — SCORM 2004 4th Edition (moteur OGA)
                      </p>
                    )}
                  </div>
                )}
              </label>
            )}
          </div>

          {/* URL manuelle si pas d'upload */}
          {!block.file_name && (
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6B7280' }}>
                Ou URL directe
              </label>
              <input className={inputCls} style={style}
                value={c.url || ''} onChange={e => onUpdate({ content_json: { ...c, url: e.target.value } })}
                placeholder="https://..." disabled={locked} />
            </div>
          )}

          {/* Description du fichier */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#002050' }}>Description</label>
            <textarea className={inputCls} style={{ ...style, resize: 'none' }} rows={2}
              value={c.description || ''} onChange={e => onUpdate({ content_json: { ...c, description: e.target.value } })}
              placeholder="Description du fichier..." disabled={locked} />
          </div>

          {/* Options SCORM spécifiques */}
          {block.block_type === 'scorm' && (
            <div className="p-3 rounded-xl" style={{ background: '#FEF3C7', border: '1px solid #FDE68A' }}>
              <p className="text-xs font-bold mb-2" style={{ color: '#92400E' }}>Options SCORM</p>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs mb-1" style={{ color: '#6B7280' }}>Type de package</label>
                  <select className={inputCls} style={style} value={c.package_type || 'scorm_2004'}
                    onChange={e => onUpdate({ content_json: { ...c, package_type: e.target.value } })} disabled={locked}>
                    <option value="scorm_2004">SCORM 2004 4th Edition — moteur OGA</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: '#6B7280' }}>Durée pédagogique SCORM</label>
                  <div className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: '#E4E7EC', background: '#F8FAFC', color: '#374151' }}>{Number(c.duration_min || 0) > 0 ? `${Math.ceil(Number(c.duration_min))} min` : 'Calcul automatique en attente'}</div>
                  <p className="mt-1 text-[11px]" style={{ color: '#9CA3AF' }}>Aucune saisie manuelle : la durée est détectée dans le package ou calculée par OGA.</p>
                </div>
              </div>
            </div>
          )}

          {/* Le téléchargement est une capacité explicite du bloc Téléchargement uniquement. */}
          {block.block_type === 'download' && (
            <div className="rounded-xl border px-3 py-2 text-xs" style={{ borderColor: '#E4E7EC', background: '#F8FAFC', color: '#475569' }}>
              Cette ressource sera téléchargeable par l’apprenant parce qu’elle utilise le bloc « Téléchargement ».
            </div>
          )}
          {(resourceRagCapable || previewProtectedResource) && (
            <div className="space-y-2 rounded-xl border p-3" style={{ borderColor: '#E4E7EC' }}>
              {resourceRagCapable && <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={block.rag_enabled === true} disabled={locked || !block.file_name}
                  onChange={async e => { const enabled = e.target.checked; const data = await api('resource_rag_update', { course_id: courseId, block_id: block.id, enabled }); if (data.success) onUpdate({ rag_enabled: enabled, content_json: data.block?.content_json || c }); }}
                  style={{ accentColor: '#002050', marginTop: 2 }} />
                <span><span className="block text-sm font-medium text-gray-700">Accessible à l’Assistant pédagogique</span><span className="block text-[11px] text-gray-500">Le texte du document est extrait de façon privée pour le RAG. Le fichier lui-même reste protégé.</span></span>
              </label>}
              {previewProtectedResource && <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={block.preview_allowed === true} disabled={locked} onChange={e => onUpdate({ preview_allowed: e.target.checked })} style={{ accentColor: '#002050', marginTop: 2 }} />
                <span><span className="block text-sm font-medium text-gray-700">Autoriser dans l’aperçu gratuit</span><span className="block text-[11px] text-gray-500">Le contenu n’est montré avant achat que si vous l’autorisez explicitement.</span></span>
              </label>}
            </div>
          )}
        </div>
      ))}

      {/* Upload image */}
      {block.block_type === 'image' && (
        <div className="space-y-3">
          {!block.file_name ? (
            <label onDragEnter={e=>{e.preventDefault();if(!locked&&!uploading)setFileDragActive(true);}} onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect=(locked||uploading)?'none':'copy';}} onDragLeave={e=>{e.preventDefault();setFileDragActive(false);}} onDrop={e=>handleMediaDrop(e,'image')} className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all ${fileDragActive?'border-[#BF8813] bg-amber-50':''} ${locked ? 'opacity-50 cursor-not-allowed' : 'hover:border-[#002050]'}`}
              style={{ borderColor: '#E4E7EC', background: '#F8F9FA' }}>
              <input type="file" className="hidden" accept=".jpg,.jpeg,.png,.gif,.webp" disabled={locked || uploading}
                onChange={e => { const f = e.target.files?.[0]; if (f) void handleFileUpload(f, 'image'); e.currentTarget.value=''; }} />
              {uploading ? (
                <p className="text-xs" style={{ color: '#6B7280' }}>Envoi... {uploadProgress}%</p>
              ) : (
                <>
                  <Image size={20} className="mb-2" style={{ color: '#9CA3AF' }} />
                  <p className="text-xs font-semibold" style={{ color: '#374151' }}>Glissez une image ou cliquez pour sélectionner</p>
                  <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>JPG, PNG, GIF, WebP</p>
                </>
              )}
            </label>
          ) : (
            <div className="p-3 rounded-xl border flex items-center gap-2" style={{ background: '#F0FDF4', borderColor: '#A7F3D0' }}>
              <CheckCircle size={14} style={{ color: '#1E7A52' }} />
              <p className="text-xs font-semibold truncate flex-1" style={{ color: '#065F46' }}>{block.file_name}</p>
              {!locked && (
                <button onClick={onRemoveResource}
                  className="text-xs px-2 py-1 rounded" style={{ color: '#DC2626' }}>Retirer</button>
              )}
            </div>
          )}
        </div>
      )}


      {/* L’assistant IA global reste accessible depuis la barre d’outils.
          Les réglages d’un bloc n’affichent que les aides IA réellement spécifiques au type de bloc. */}
    </div>
  );
}
