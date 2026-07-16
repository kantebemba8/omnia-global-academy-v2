import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AssessmentRulesCard } from '../../components/AssessmentRulesCard';
import StudioCommercialCertificationPanel from '../../components/StudioCommercialCertificationPanel';
import {
  ChevronLeft, ChevronRight, Save, Eye, EyeOff, Send, History,
  Plus, Trash2, Copy, GripVertical, Settings, Sparkles, X, Check,
  AlertCircle, CheckCircle, Clock, FileText, Image, Video, Music,
  File, Table, HelpCircle, BookOpen, Lightbulb, Star, Minus,
  AlignLeft, Heading1, Heading2, Download, Layers, ToggleLeft,
  ChevronDown, ChevronUp, Zap, AlertTriangle, Info, BarChart2,
  Layout, RefreshCw, MoreVertical, Move, List, ListOrdered, Quote, Code2, CheckSquare, Link2, GalleryHorizontal, Sigma, BarChart3, UploadCloud, ClipboardCheck
} from 'lucide-react';

const SB = import.meta.env.VITE_SUPABASE_URL;
const API = `${SB}/functions/v1/studio-unified`;

// ─── Types ────────────────────────────────────────────────────
interface Block {
  id: string;
  block_type: string;
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

interface Lesson { id: string; title: string; position: number; has_blocks: boolean; block_count: number; is_intro?: boolean; is_module_intro?: boolean; is_conclusion?: boolean; is_final_exam?: boolean; }
interface Module { id: string; title: string; objective: string; position: number; lessons: Lesson[]; is_intro?: boolean; is_conclusion?: boolean; is_final_exam?: boolean; }
interface Course {
  id: string; title: string; short_description?: string; long_description?: string;
  category?: string; level?: string; language?: string; prerequisites?: string;
  objectives?: string[]; cover_image_url?: string; cover_image_prompt?: string;
  target_audience?: string; learning_outcomes?: string[]; course_intro_title?: string;
  course_intro_summary?: string; studio_status: string;
  studio_mode?: string; word_count?: number; estimated_read_min?: number;
  last_autosave_at?: string; admin_comment?: string; template_used?: string;
  sale_mode?: 'free'|'paid'; desired_price_amount?: number|string; sale_currency?: string; promotion_price_amount?: number|string;
  structure_payment_mode?: string; structure_fixed_amount?: number|string; is_assisted?: boolean; assisted_status?: string; assisted_request_id?: string; certification_requested?: boolean;
}

const EMPTY_COURSE: Course = {
  id: '',
  title: '',
  short_description: '',
  long_description: '',
  category: '',
  level: '',
  language: 'fr',
  prerequisites: '',
  objectives: [],
  cover_image_url: '',
  cover_image_prompt: '',
  target_audience: '',
  learning_outcomes: [],
  course_intro_title: 'Bienvenue dans cette formation',
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
};

// ─── Config blocs ─────────────────────────────────────────────
const BLOCK_DEFS = [
  // Simples
  { type: 'heading',    label: 'Titre',        icon: Heading1,   color: '#002050', group: 'structure',   mode: 'simple' },
  { type: 'subheading', label: 'Sous-titre',   icon: Heading2,   color: '#374151', group: 'structure',   mode: 'simple' },
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
];

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  draft:              { label: 'Brouillon',              color: '#6B7280', bg: '#F3F4F6', dot: '#9CA3AF' },
  pending_validation: { label: 'En attente',             color: '#92400E', bg: '#FEF3C7', dot: '#D97706' },
  changes_requested:  { label: 'Modification demandée',  color: '#1D4ED8', bg: '#EFF6FF', dot: '#3B82F6' },
  rejected:           { label: 'Refusée',                color: '#991B1B', bg: '#FEE2E2', dot: '#DC2626' },
  validated:          { label: 'Validée',                color: '#065F46', bg: '#D1FAE5', dot: '#10B981' },
  published:          { label: 'Publiée',                color: '#065F46', bg: '#D1FAE5', dot: '#10B981' },
  archived:           { label: 'Archivée',               color: '#374151', bg: '#F3F4F6', dot: '#6B7280' },
};

function uid() { return Math.random().toString(36).slice(2, 10); }
function token() { return localStorage.getItem('omnia_session_token') || ''; }

async function api(action: string, body: Record<string, any> = {}) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...body }),
  });
  return res.json();
}

// ─── Composant principal ──────────────────────────────────────
export default function StudioConceptionFormation() {
  const navigate = useNavigate();
  const { courseId } = useParams<{ courseId: string }>();
  const [searchParams] = useSearchParams();
  const isNew = courseId === 'new';

  // État principal
  const [course, setCourse] = useState<Course>(EMPTY_COURSE);
  const [modules, setModules] = useState<Module[]>([]);
  const [currentModule, setCurrentModule] = useState<Module | null>(null);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [selectedBlockDef, setSelectedBlockDef] = useState<typeof BLOCK_DEFS[0] | null>(null);

  // UI
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [activeLibTab, setActiveLibTab] = useState<'blocs' | 'sections' | 'templates'>('blocs');
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');
  const [lastSave, setLastSave] = useState('');
  const [wordCount, setWordCount] = useState(0);

  // Checklist
  const [checklist, setChecklist] = useState<{ valid: boolean; errors: string[]; warnings: string[] } | null>(null);

  // Historique
  const [logs, setLogs] = useState<any[]>([]);

  // IA
  const [aiAction, setAiAction] = useState('ai_improve_text');
  const [aiInput, setAiInput] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [coverPrompt, setCoverPrompt] = useState('');
  const [coverCandidates, setCoverCandidates] = useState<string[]>([]);
  const [coverGenerating, setCoverGenerating] = useState(false);
  const [creatingDraft, setCreatingDraft] = useState(false);

  // Autosave ref
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  async function loadBlocks(lessonId: string) {
    const data = await api('get_blocks', { lesson_id: lessonId });
    if (data.success) {
      setBlocks(data.blocks || []);
      // Compter les mots
      const wc = (data.blocks || []).reduce((acc: number, b: Block) => {
        const text = b.content_json?.html || b.content_json?.text || b.content_json?.question || '';
        return acc + text.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
      }, 0);
      setWordCount(wc);
    }
  }

  // ─── Autosave ──────────────────────────────────────────────
  const scheduleAutosave = useCallback(() => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(async () => {
      const c = courseRef.current;
      if (!c?.id) return;
      const data = await api('autosave', { course_id: c.id, title: c.title, short_description: c.short_description, word_count: wordCount });
      if (data.success) setLastSave(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
    }, 30000);
  }, [wordCount]);

  function updateCourse(field: keyof Course, value: any) {
    setCourse(c => ({ ...c, [field]: value }));
    scheduleAutosave();
  }

  // ─── Sélection leçon ──────────────────────────────────────
  async function selectLesson(mod: Module, lesson: Lesson) {
    setCurrentModule(mod);
    setCurrentLesson(lesson);
    setSelectedBlock(null);
    setBlocks([]);
    await loadBlocks(lesson.id);
  }

  // ─── Ajouter module ───────────────────────────────────────
  async function addModule() {
    if (!course?.id) return;
    const normalCount = modules.filter(m => !m.is_intro).length;
    const title = `Module ${normalCount + 1}`;
    const data = await api('create_module', { course_id: course.id, title, objective: '', create_module_introduction: true });
    if (data.success) {
      const introLesson = data.intro_lesson as Lesson | undefined;
      const newMod: Module = { ...data.module, lessons: introLesson ? [introLesson] : [] };
      setModules(m => [...m, newMod]);
      setCurrentModule(newMod);
      setCurrentLesson(introLesson || null);
      setBlocks([]);
      showToast('Module ajouté. Vous pouvez présenter le module avant les leçons.');
    }
  }

  // ─── Ajouter leçon ────────────────────────────────────────
  async function addLesson(mod: Module) {
    if (!course?.id) return;
    const lessonCount = (mod.lessons || []).filter(l => !l.is_module_intro).length;
    const title = `Leçon ${lessonCount + 1}`;
    const data = await api('create_lesson', { course_id: course.id, module_id: mod.id, title });
    if (data.success) {
      const newLesson = data.lesson;
      setModules(ms => ms.map(m => m.id === mod.id ? { ...m, lessons: [...(m.lessons || []), newLesson] } : m));
      setCurrentModule(mod);
      setCurrentLesson(newLesson);
      setBlocks([]);
      showToast('Leçon ajoutée');
    }
  }

  // ─── Ajouter bloc ─────────────────────────────────────────
  async function addBlock(blockType: string) {
    if (!course?.id || !currentModule?.id || !currentLesson?.id) {
      showToast('Sélectionnez d\'abord une leçon', 'error'); return;
    }
    const defaultContent = getDefaultContent(blockType);
    const data = await api('create_block', {
      course_id: course.id, module_id: currentModule.id, lesson_id: currentLesson.id,
      block_type: blockType, content_json: defaultContent, settings_json: {},
    });
    if (data.success) {
      setBlocks(bs => [...bs, data.block]);
      setSelectedBlock(data.block);
      setSelectedBlockDef(BLOCK_DEFS.find(d => d.type === blockType) || null);
      showToast(`Bloc "${BLOCK_DEFS.find(d => d.type === blockType)?.label}" ajouté`);
    }
  }

  function getDefaultContent(type: string): Record<string, any> {
    switch (type) {
      case 'heading': return { text: 'Nouveau titre', level: 1, alignment: 'left' };
      case 'subheading': return { text: 'Sous-titre', level: 2, alignment: 'left' };
      case 'text': return { html: '<p>Saisissez votre texte ici...</p>' };
      case 'separator': return { style: 'line' };
      case 'callout': return { type: 'info', content: 'Information importante...' };
      case 'remember': return { title: 'À retenir', points: [''] };
      case 'objective': return { title: 'Objectif pédagogique', html: '<p>À la fin de cette leçon, vous serez capable de...</p>' };
      case 'example': return { title: 'Exemple', html: '<p>Décrivez ici un exemple concret...</p>' };
      case 'summary': return { title: 'Résumé', html: '<p>Dans cette leçon, vous avez appris...</p>' };
      case 'image': return { url: '', alt: '', caption: '', source: 'upload' };
      case 'video': return { url: '', thumbnail: '', eco_data: true };
      case 'audio': return { url: '', description: '', transcription: '' };
      case 'pdf': return { url: '', title: '', description: '', downloadable: true };
      case 'word': return { url: '', title: '', description: '' };
      case 'excel': return { url: '', title: '', sheet: '', preview_rows: [] };
      case 'scorm': return { url: '', title: '', package_type: 'scorm_12', duration_min: 0 };
      case 'download': return { url: '', title: '', description: '' };
      case 'qcm': return { question: '', options: ['', '', '', ''], correctIndex: 0, explanation: '' };
      case 'true_false': return { statement: '', answer: true, explanation: '' };
      case 'open_question': return { question: '', guidance: '', expected_answer: '', points: 10, required: true };
      case 'exercise': return { title: 'Exercice', instructions: '', task: '', resources: [], accepted_types: ['pdf','doc','docx','xls','xlsx'], learner_upload_required: true, points: 20 };
      case 'accordion': return { items: [{ id: uid(), title: 'Section 1', content: '' }] };
      case 'flashcards': return { cards: [{ id: uid(), front: 'Recto', back: 'Verso' }] };
      case 'interactive_table': return { headers: ['Colonne 1', 'Colonne 2', 'Colonne 3'], rows: [['', '', '']], style: 'table' };
      case 'timeline': return { steps: [{ id: uid(), title: 'Étape 1', description: '' }] };
      case 'columns': return { columns: [{ id: uid(), content: '' }, { id: uid(), content: '' }] };
      case 'important': return { title: 'Important', html: '<p>Saisissez l’information importante...</p>' };
      case 'case_study': return { title: 'Étude de cas', context: '', data: '', task: '', questions: [''] };
      case 'definition': return { term: '', definition: '', example: '' };
      case 'correction': return { title: 'Correction', html: '<p>Saisissez ici la correction détaillée...</p>', key_points: [] };
      case 'bullet_list': return { items: [''] };
      case 'numbered_list': return { items: [''] };
      case 'quote': return { text: 'Citation ou témoignage', author: '' };
      case 'code': return { language: 'text', code: '' };
      case 'checklist': return { items: [{ id: uid(), text: 'Action à réaliser', checked: false }] };
      case 'link_button': return { label: 'Ouvrir le lien', url: '', open_new_tab: true };
      case 'embed': return { url: '', title: 'Contenu intégré' };
      case 'gallery': return { images: [] };
      case 'formula': return { latex: '' };
      case 'chart': return { chart_type: 'bar', labels: ['A', 'B'], values: [0, 0] };
      case 'assignment_upload': return { title: 'Travail à remettre', instructions: '', accepted_types: ['pdf', 'docx'], max_size_mb: 10 };
      case 'rubric': return { criteria: [{ name: 'Critère 1', description: '', points: 10 }] };
      default: return {};
    }
  }

  // ─── Mettre à jour bloc ───────────────────────────────────
  async function updateBlock(blockId: string, updates: Partial<Block>) {
    setBlocks(bs => bs.map(b => b.id === blockId ? { ...b, ...updates } : b));
    if (selectedBlock?.id === blockId) setSelectedBlock(b => b ? { ...b, ...updates } : b);
    // Debounce save
    await api('update_block', { block_id: blockId, ...updates });
  }

  // ─── Supprimer bloc ───────────────────────────────────────
  async function deleteBlock(blockId: string) {
    await api('delete_block', { block_id: blockId });
    setBlocks(bs => bs.filter(b => b.id !== blockId));
    if (selectedBlock?.id === blockId) { setSelectedBlock(null); setSelectedBlockDef(null); }
    showToast('Bloc supprimé');
  }

  // ─── Dupliquer bloc ───────────────────────────────────────
  async function duplicateBlock(block: Block) {
    if (!course?.id || !currentModule?.id || !currentLesson?.id) return;
    const data = await api('create_block', {
      course_id: course.id, module_id: currentModule.id, lesson_id: currentLesson.id,
      block_type: block.block_type, content_json: block.content_json,
      settings_json: block.settings_json, position: block.position + 1,
    });
    if (data.success) {
      setBlocks(bs => {
        const idx = bs.findIndex(b => b.id === block.id);
        const next = [...bs];
        next.splice(idx + 1, 0, data.block);
        return next;
      });
      showToast('Bloc dupliqué');
    }
  }

  // ─── Drag & Drop ──────────────────────────────────────────
  const dragIdx = useRef<number | null>(null);

  function onDragStart(idx: number) { dragIdx.current = idx; }
  function onDragOver(e: React.DragEvent, idx: number) { e.preventDefault(); setDragOverIdx(idx); }
  async function onDrop(e: React.DragEvent, targetIdx: number) {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === targetIdx) { setDragOverIdx(null); return; }
    const newBlocks = [...blocks];
    const [moved] = newBlocks.splice(dragIdx.current, 1);
    newBlocks.splice(targetIdx, 0, moved);
    setBlocks(newBlocks);
    setDragOverIdx(null);
    dragIdx.current = null;
    if (currentLesson?.id) {
      await api('reorder_blocks', { lesson_id: currentLesson.id, ordered_ids: newBlocks.map(b => b.id) });
    }
  }

  async function moveBlock(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= blocks.length || !currentLesson?.id) return;
    const next = [...blocks];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    setBlocks(next);
    await api('reorder_blocks', { lesson_id: currentLesson.id, ordered_ids: next.map(b => b.id) });
    showToast(delta < 0 ? 'Bloc déplacé vers le haut' : 'Bloc déplacé vers le bas');
  }

  async function saveCurrentPage(goNext = false) {
    if (!course.id) { const created = await ensureCourseCreated(); if (!created) return; }
    await api('autosave', { course_id: courseRef.current.id, title: courseRef.current.title, short_description: courseRef.current.short_description, word_count: wordCount });
    setLastSave(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
    showToast('Page enregistrée');
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
  async function ensureCourseCreated(): Promise<Course | null> {
    if (course.id) return course;
    if (!course.title.trim()) { showToast('Saisissez le titre de la formation.', 'error'); return null; }
    if (!course.short_description?.trim()) { showToast('Ajoutez la description courte visible avant achat.', 'error'); return null; }
    setCreatingDraft(true);
    try {
      const data = await api('create_course', {
        client_draft_key: localStorage.getItem('omnia_studio_draft_key') || (()=>{const k=crypto.randomUUID();localStorage.setItem('omnia_studio_draft_key',k);return k;})(),
        title: course.title,
        short_description: course.short_description,
        long_description: course.long_description,
        category: course.category,
        level: course.level,
        language: course.language,
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
      navigate(`${basePath}/${data.course.id}`, { replace: true });
      return data.course;
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Impossible de créer le brouillon', 'error');
      return null;
    } finally { setCreatingDraft(false); }
  }

  async function save() {
    setSaving(true);
    try {
      const savedCourse = course.id ? course : await ensureCourseCreated();
      if (!savedCourse?.id) return;
      const data = await api('update_course', {
        course_id: savedCourse.id, client_draft_key: localStorage.getItem('omnia_studio_draft_key') || (()=>{const k=crypto.randomUUID();localStorage.setItem('omnia_studio_draft_key',k);return k;})(),
        title: course.title,
        short_description: course.short_description,
        long_description: course.long_description,
        category: course.category, level: course.level,
        language: course.language, prerequisites: course.prerequisites,
        objectives: course.objectives, target_audience: course.target_audience,
        learning_outcomes: course.learning_outcomes,
        cover_image_url: course.cover_image_url,
        cover_image_prompt: course.cover_image_prompt,
        course_intro_title: course.course_intro_title,
        course_intro_summary: course.course_intro_summary,
        word_count: wordCount,
      });
      if (data.success) {
        setCourse(data.course);
        await api('ensure_assessments', { course_id: savedCourse.id });
        setLastSave(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
        showToast('✅ Informations enregistrées. Vous pouvez construire l’introduction, les modules et les leçons.');
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
      showToast('Image de couverture ajoutée');
    } catch (error) { showToast(error instanceof Error ? error.message : 'Erreur image', 'error'); }
  }

  async function generateCoverImages() {
    if (!coverPrompt.trim()) { showToast('Décrivez la formation en quelques lignes.', 'error'); return; }
    let c = course;
    if (!c.id) { const created = await ensureCourseCreated(); if (!created) return; c = created; }
    setCoverGenerating(true); setCoverCandidates([]);
    try {
      const data = await api('ai_generate_cover_images', { course_id: c.id, prompt: coverPrompt, count: 3 });
      if (!data.success) throw new Error(data.message || data.error || 'Génération indisponible');
      setCoverCandidates(data.images || []);
      updateCourse('cover_image_prompt', coverPrompt);
    } catch (error) { showToast(error instanceof Error ? error.message : 'Erreur de génération', 'error'); }
    finally { setCoverGenerating(false); }
  }

  // ─── Soumettre ────────────────────────────────────────────
  async function submit() {
    if (!course?.id) return;
    // Valider d'abord
    const check = await api('validate_checklist', { course_id: course.id });
    setChecklist(check);
    if (!check.valid) { setShowChecklist(true); showToast('Corrigez les erreurs avant de soumettre', 'error'); return; }
    setSubmitting(true);
    try {
      const data = await api('submit_course', { course_id: course.id });
      if (data.success) {
        setCourse(c => c ? { ...c, studio_status: 'pending_validation' } : c);
        showToast('✅ Formation soumise pour validation');
      } else {
        setChecklist({ valid: false, errors: data.errors || [], warnings: data.warnings || [] });
        setShowChecklist(true);
      }
    } catch { showToast('Erreur lors de la soumission', 'error'); }
    finally { setSubmitting(false); }
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
      const data = await api(aiAction, { text: aiInput, topic: aiInput, content: aiInput, lesson_title: currentLesson?.title });
      if (data.success) {
        const res = data.result;
        setAiResult(typeof res === 'string' ? res : JSON.stringify(res, null, 2));
      } else showToast('Erreur IA', 'error');
    } catch { showToast('Erreur IA', 'error'); }
    finally { setAiLoading(false); }
  }

  const locked = ['pending_validation', 'validated', 'published'].includes(course.studio_status || '');
  const statusCfg = STATUS_CFG[course.studio_status || 'draft'] || STATUS_CFG.draft;
  const visibleBlocks = advancedMode ? BLOCK_DEFS : BLOCK_DEFS.filter(b => b.mode === 'simple');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: '#F0F2F5' }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: '#F0F2F5', fontFamily: 'Arial, sans-serif' }}>

      {/* Toast */}
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
      <div className="bg-white border-b flex items-center px-4 h-14 flex-shrink-0" style={{ borderColor: '#E4E7EC' }}>
        <button onClick={() => {
          const back = window.location.pathname.includes('/admin/') ? '/admin/studio-mes-formations'
            : window.location.pathname.includes('/partner/') ? '/partner/dashboard'
            : window.location.pathname.includes('/structure/') ? '/structure/formations'
            : '/professeur/courses';
          navigate(back);
        }} className="flex items-center gap-1.5 mr-4 text-sm" style={{ color: '#6B7280' }}>
          <ChevronLeft size={16} /> Retour
        </button>
        <div className="flex items-center gap-2 mr-4">
          <div className="w-7 h-7 rounded flex items-center justify-center" style={{ background: '#002050' }}>
            <BookOpen size={14} color="#BF8813" />
          </div>
          <span className="font-bold text-sm hidden md:block" style={{ color: '#002050' }}>Omnia Global Academy</span>
          <span className="text-sm hidden md:block" style={{ color: '#9CA3AF' }}>|</span>
          <span className="font-semibold text-sm" style={{ color: '#002050' }}>Studio de Conception de Formation</span>
        </div>

        {/* Fil d'Ariane */}
        <div className="flex items-center gap-1 text-xs flex-1 min-w-0 overflow-hidden" style={{ color: '#6B7280' }}>
          <span className="truncate">{course?.title || 'Formation'}</span>
          {currentModule && <><ChevronRight size={12} /><span className="truncate">{currentModule.title}</span></>}
          {currentLesson && <><ChevronRight size={12} /><span className="truncate">{currentLesson.title}</span></>}
        </div>

        {/* Mode simple/avancé */}
        <div className="flex items-center gap-1 mx-3 bg-gray-100 rounded-lg p-1 flex-shrink-0">
          <button onClick={() => setAdvancedMode(false)}
            className="px-2.5 py-1 rounded-md text-xs font-semibold transition-all"
            style={!advancedMode ? { background: '#002050', color: 'white' } : { color: '#6B7280' }}>
            Mode simple
          </button>
          <button onClick={() => setAdvancedMode(true)}
            className="px-2.5 py-1 rounded-md text-xs font-semibold transition-all"
            style={advancedMode ? { background: '#002050', color: 'white' } : { color: '#6B7280' }}>
            Mode avancé
          </button>
        </div>

        {/* Statut */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold mr-3 flex-shrink-0" style={{ background: statusCfg.bg, color: statusCfg.color }}>
          <div className="w-2 h-2 rounded-full" style={{ background: statusCfg.dot }} />
          {statusCfg.label}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={loadHistory} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium" style={{ borderColor: '#E4E7EC', color: '#6B7280' }}>
            <History size={13} /> Historique
          </button>
          <button onClick={() => { if (!course.id) { showToast('Enregistrez d’abord le brouillon.', 'error'); return; } window.open(`/cours/${course.id}/apprendre?preview=1`, '_blank', 'noopener,noreferrer'); }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium" style={{ borderColor: '#E4E7EC', color: '#6B7280' }}>
            <Eye size={13} /> Prévisualiser
          </button>
          <button onClick={save} disabled={saving || locked}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium disabled:opacity-50"
            style={{ borderColor: '#E4E7EC', color: '#374151' }}>
            {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />} Enregistrer
          </button>
          <button onClick={submit} disabled={submitting || locked}
            className="flex items-center gap-1 px-4 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-50"
            style={{ background: locked ? '#9CA3AF' : '#BF8813' }}>
            <Send size={13} /> {locked ? 'Soumise' : 'Soumettre'}
          </button>
        </div>
      </div>

      {/* ── CORPS PRINCIPAL ──────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden relative">
        <div className="absolute left-[252px] right-4 top-3 z-10 pointer-events-none">
          <div className="pointer-events-auto max-w-4xl mx-auto">
            <AssessmentRulesCard durationMinutes={(course as any).calculated_duration_minutes || course.estimated_read_min || 0} />
            <StudioCommercialCertificationPanel course={course} locked={locked} onPatch={(patch)=>setCourse(c=>({...c,...patch}))} onSaved={(msg)=>showToast(msg, msg.toLowerCase().includes('erreur') ? 'error' : 'success')} />
          </div>
        </div>

        {/* ── COLONNE GAUCHE : Bibliothèque ────────────── */}
        <div className="bg-white border-r flex flex-col flex-shrink-0" style={{ width: '240px', borderColor: '#E4E7EC' }}>

          {/* Tabs bibliothèque */}
          <div className="flex border-b" style={{ borderColor: '#E4E7EC' }}>
            {(['blocs', 'sections', 'templates'] as const).map(tab => (
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
                {['structure', 'pedagogique', 'media', 'evaluation', ...(advancedMode ? ['avance'] : [])].map(group => {
                  const groupBlocks = visibleBlocks.filter(b => b.group === group);
                  if (groupBlocks.length === 0) return null;
                  const groupLabels: Record<string, string> = { structure: 'Structure', pedagogique: 'Pédagogie', media: 'Médias & Fichiers', evaluation: 'Évaluation', avance: 'Avancés' };
                  return (
                    <div key={group} className="mb-4">
                      <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#9CA3AF' }}>{groupLabels[group]}</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {groupBlocks.map(def => (
                          <button key={def.type} onClick={() => addBlock(def.type)} disabled={locked} draggable={!locked && !!currentLesson}
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
                ].map(section => (
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
                ].map(tmpl => (
                  <button key={tmpl.key} disabled={locked}
                    onClick={async () => {
                      if (!course?.id) return;
                      const replaceExisting = modules.length === 0 || window.confirm('Appliquer ce modèle remplacera les modules et leçons actuels. Continuer ?');
                      if (!replaceExisting) return;
                      const data = await api('apply_template', { course_id: course.id, template_key: tmpl.key, replace_existing: modules.length > 0 });
                      if (data.success) { showToast('Modèle appliqué'); window.location.reload(); } else showToast('Impossible d’appliquer le modèle', 'error');
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
              💡 Glissez un bloc dans la leçon pour construire votre contenu.
            </p>
          </div>
        </div>

        {/* ── ZONE CENTRALE : Canevas ──────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Navigation structure formation */}
          <div className="bg-white border-b flex items-center px-4 py-2 gap-4 flex-shrink-0 overflow-x-auto" style={{ borderColor: '#E4E7EC' }}>
            {/* Infos formation */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => { setCurrentModule(null); setCurrentLesson(null); setBlocks([]); setSelectedBlock(null); }}
                className="text-xs font-semibold px-2 py-1 rounded" style={{ color: currentModule ? '#6B7280' : '#002050', background: currentModule ? 'transparent' : '#EEF2FF' }}>
                Infos formation
              </button>
            </div>
            <div className="h-4 w-px bg-gray-200 flex-shrink-0" />
            {/* Modules */}
            <div className="flex items-center gap-2 overflow-x-auto">
              {modules.map(mod => (
                <div key={mod.id} className="flex-shrink-0">
                  <div className="text-xs font-semibold mb-1" style={{ color: currentModule?.id === mod.id ? '#002050' : '#6B7280' }}>{(mod as any).is_intro ? 'Introduction' : (mod as any).is_conclusion ? 'Conclusion' : (mod as any).is_final_exam ? 'Examen final' : mod.title}</div>
                  <div className="flex gap-1">
                    {(mod.lessons || []).map(lesson => (
                      <button key={lesson.id}
                        onClick={() => selectLesson(mod, lesson)}
                        className="text-xs px-2 py-0.5 rounded-full border transition-all"
                        title={lesson.is_module_intro ? 'Présentation facultative du module' : lesson.title}
                        style={currentLesson?.id === lesson.id
                          ? { background: '#002050', color: 'white', borderColor: '#002050' }
                          : { borderColor: lesson.is_module_intro ? '#BF8813' : '#E4E7EC', color: lesson.is_module_intro ? '#92400E' : '#6B7280', background: lesson.is_module_intro ? '#FFFBEB' : 'white' }}>
                        {lesson.is_module_intro ? 'Présentation du module' : lesson.title}
                      </button>
                    ))}
                    {!mod.is_intro && (
                      <button onClick={() => addLesson(mod)} disabled={locked}
                        className="text-xs px-1.5 py-0.5 rounded-full border border-dashed disabled:opacity-40"
                        style={{ borderColor: '#BF8813', color: '#BF8813' }}>
                        + Leçon
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <button onClick={async () => { if (!course.id) { const created = await ensureCourseCreated(); if (!created) return; } await addModule(); }} disabled={locked}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-dashed flex-shrink-0 disabled:opacity-40"
                style={{ borderColor: '#002050', color: '#002050' }}>
                <Plus size={11} /> Module
              </button>
              <button onClick={async()=>{if(!course.id){const created=await ensureCourseCreated();if(!created)return;} const d=await api('ensure_special_sections',{course_id:courseRef.current.id}); if(d.success){await loadCourse(courseRef.current.id); showToast('Conclusion et examen final prêts');}}} disabled={locked} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-dashed flex-shrink-0 disabled:opacity-40" style={{borderColor:'#BF8813',color:'#92400E'}}><Plus size={11}/> Conclusion & examen final</button>
            </div>
          </div>

          {/* Canevas */}
          <div className="flex-1 overflow-y-auto p-6" style={{ background: '#F0F2F5' }} onDragOver={(e) => { if (e.dataTransfer.types.includes('application/x-omnia-block')) e.preventDefault(); }} onDrop={async (e) => { const bt = e.dataTransfer.getData('application/x-omnia-block'); if (bt) { e.preventDefault(); await addBlock(bt); } }}>

            {/* ── VUE INFOS FORMATION ──────────────────── */}
            {!currentModule && (
              <div className="max-w-2xl mx-auto space-y-4">
                <h2 className="text-lg font-bold" style={{ color: '#002050' }}>Informations de la formation</h2>

                {course?.admin_comment && (
                  <div className="p-4 rounded-xl border" style={{ background: '#FEF3C7', borderColor: '#FDE68A' }}>
                    <p className="text-xs font-bold mb-1" style={{ color: '#92400E' }}>Message du super-admin</p>
                    <p className="text-sm" style={{ color: '#92400E' }}>{course.admin_comment}</p>
                  </div>
                )}

                {[
                  { field: 'title', label: 'Titre de la formation *', placeholder: 'Ex: Comptabilité générale pour débutants', type: 'text' },
                  { field: 'short_description', label: 'Description courte *', placeholder: 'Résumé affiché sur la carte et avant l’achat...', type: 'textarea' },
                  { field: 'long_description', label: 'Présentation détaillée *', placeholder: 'Présentez le contenu, l’approche pédagogique, les bénéfices et ce que l’apprenant saura faire...', type: 'textarea' },
                  { field: 'target_audience', label: 'À qui s’adresse cette formation ?', placeholder: 'Ex : débutants, entrepreneurs, responsables administratifs...', type: 'textarea' },
                  { field: 'category', label: 'Catégorie *', placeholder: '', type: 'select', options: ['Comptabilité & Finance', 'Marketing digital', 'Management & Leadership', 'Informatique de gestion', 'Langues & Linguistique', 'Entrepreneuriat', 'Ressources humaines', 'Commerce international', 'Autre'] },
                  { field: 'level', label: 'Niveau *', placeholder: '', type: 'select', options: ['debutant', 'intermediaire', 'avance'] },
                  { field: 'language', label: 'Langue *', placeholder: '', type: 'select', options: ['fr', 'en', 'ar', 'bm'] },
                  { field: 'prerequisites', label: 'Prérequis', placeholder: 'Aucun prérequis particulier...', type: 'textarea' },
                ].map(({ field, label, placeholder, type, options }) => (
                  <div key={field} className="bg-white rounded-xl border p-4" style={{ borderColor: '#E4E7EC' }}>
                    <label className="block text-xs font-semibold mb-2" style={{ color: '#002050' }}>{label}</label>
                    {type === 'textarea' ? (
                      <textarea className="w-full px-3 py-2.5 border rounded-lg text-sm resize-none focus:outline-none focus:border-[#002050]"
                        style={{ borderColor: '#E4E7EC' }} rows={3}
                        value={(course as any)?.[field] || ''}
                        onChange={e => updateCourse(field as keyof Course, e.target.value)}
                        placeholder={placeholder} disabled={locked} />
                    ) : type === 'select' ? (
                      <select className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:border-[#002050]"
                        style={{ borderColor: '#E4E7EC' }}
                        value={(course as any)?.[field] || ''}
                        onChange={e => updateCourse(field as keyof Course, e.target.value)}
                        disabled={locked}>
                        <option value="">Sélectionner...</option>
                        {options?.map(o => <option key={o} value={o}>{o}</option>)}
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
                    <button type="button" onClick={generateCoverImages} disabled={coverGenerating || locked} className="mt-2 px-3 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50" style={{ background: '#002050' }}>{coverGenerating ? 'Génération en cours…' : 'Générer 3 images'}</button>
                    {coverCandidates.length > 0 && <div className="grid grid-cols-3 gap-2 mt-3">{coverCandidates.map((url, i) => <button type="button" key={url} onClick={async () => { updateCourse('cover_image_url', url); if(course.id) await api('update_course',{course_id:course.id,cover_image_url:url,cover_image_prompt:coverPrompt}); showToast(`Image ${i+1} sélectionnée`); }} className="rounded-lg overflow-hidden border hover:ring-2" style={{ borderColor: course.cover_image_url===url ? '#BF8813' : '#E4E7EC' }}><img src={url} alt={`Proposition ${i+1}`} className="w-full aspect-video object-cover" /></button>)}</div>}
                  </div>
                </div>

                {/* Introduction obligatoire avant les modules */}
                <div className="bg-white rounded-xl border p-4" style={{ borderColor: '#E4E7EC' }}>
                  <div className="flex items-center gap-2 mb-1"><BookOpen size={16} style={{ color: '#BF8813' }} /><label className="text-xs font-semibold" style={{ color: '#002050' }}>Introduction de la formation *</label></div>
                  <p className="text-xs mb-3" style={{ color: '#6B7280' }}>Comme sur Coursera ou Udemy, cette introduction accueille l’apprenant avant le Module 1. Après le premier enregistrement, vous pourrez la construire avec les mêmes blocs que les leçons.</p>
                  <input className="w-full px-3 py-2.5 border rounded-lg text-sm mb-2" style={{ borderColor: '#E4E7EC' }} value={course.course_intro_title || ''} onChange={e => updateCourse('course_intro_title', e.target.value)} placeholder="Titre de l’introduction" disabled={locked} />
                  <textarea className="w-full px-3 py-2.5 border rounded-lg text-sm resize-none" style={{ borderColor: '#E4E7EC' }} rows={3} value={course.course_intro_summary || ''} onChange={e => updateCourse('course_intro_summary', e.target.value)} placeholder="Message de bienvenue, fonctionnement de la formation, conseils pour réussir..." disabled={locked} />
                </div>

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

            {/* ── VUE LEÇON + BLOCS ────────────────────── */}
            {currentLesson && (
              <div className="max-w-3xl mx-auto">
                {/* Header leçon */}
                <div className="bg-white rounded-xl border p-4 mb-4" style={{ borderColor: '#E4E7EC' }}>
                  <input className="text-xl font-bold bg-transparent border-none outline-none w-full"
                    style={{ color: '#002050' }}
                    value={currentLesson.title}
                    onChange={async e => {
                      const newTitle = e.target.value;
                      setCurrentLesson(l => l ? { ...l, title: newTitle } : l);
                      setModules(ms => ms.map(m => ({ ...m, lessons: (m.lessons || []).map(l => l.id === currentLesson.id ? { ...l, title: newTitle } : l) })));
                      await api('update_lesson', { lesson_id: currentLesson.id, title: newTitle });
                    }}
                    disabled={locked} spellCheck lang="fr" />
                  {currentLesson.is_module_intro && (
                    <p className="text-xs mt-2" style={{ color: '#6B7280' }}>Cette présentation est facultative. Utilisez les blocs pour expliquer le module, ses objectifs, sa méthode ou ses ressources avant la première leçon.</p>
                  )}
                </div>

                {/* Blocs */}
                <div className="space-y-3">
                  {blocks.map((block, idx) => {
                    const def = BLOCK_DEFS.find(d => d.type === block.block_type);
                    const isSelected = selectedBlock?.id === block.id;
                    return (
                      <div key={block.id}
                        draggable={!locked}
                        onDragStart={() => onDragStart(idx)}
                        onDragOver={e => onDragOver(e, idx)}
                        onDrop={e => onDrop(e, idx)}
                        onClick={() => { setSelectedBlock(block); setSelectedBlockDef(def || null); }}
                        className="relative group"
                        style={{ opacity: dragOverIdx === idx ? 0.5 : 1 }}>
                        <div className="absolute left-0 top-0 bottom-0 flex items-center -translate-x-6 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
                          <GripVertical size={14} style={{ color: '#9CA3AF' }} />
                        </div>
                        <div className={`bg-white rounded-xl border transition-all ${isSelected ? 'ring-2' : ''}`}
                          style={{ borderColor: isSelected ? '#002050' : '#E4E7EC', ringColor: '#002050' }}>
                          {/* Header bloc */}
                          <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: '#F3F4F6' }}>
                            <div className="flex items-center gap-2">
                              {def && <def.icon size={14} style={{ color: def.color }} />}
                              <span className="text-xs font-semibold" style={{ color: '#6B7280' }}>{def?.label || block.block_type}</span>
                              {block.ai_generated && !block.ai_confirmed && (
                                <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#FEF3C7', color: '#92400E', fontSize: '9px' }}>IA — à valider</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button title="Déplacer vers le haut" onClick={e => { e.stopPropagation(); moveBlock(idx, -1); }} className="p-1 rounded hover:bg-gray-100" disabled={locked || idx === 0}>
                                <ChevronUp size={12} style={{ color: '#6B7280' }} />
                              </button>
                              <button title="Déplacer vers le bas" onClick={e => { e.stopPropagation(); moveBlock(idx, 1); }} className="p-1 rounded hover:bg-gray-100" disabled={locked || idx === blocks.length - 1}>
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
                          <div className="p-4">
                            <BlockPreview block={block} def={def} locked={locked}
                              onChange={async (content_json) => {
                                setBlocks(bs => bs.map(b => b.id === block.id ? { ...b, content_json } : b));
                                if (isSelected) setSelectedBlock(b => b ? { ...b, content_json } : b);
                                await api('update_block', { block_id: block.id, content_json });
                              }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Zone de drop vide */}
                  {!locked && (
                    <div className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all"
                      style={{ borderColor: '#E4E7EC' }}
                      onDragOver={e => { e.preventDefault(); }}
                      onDrop={e => { e.preventDefault(); }}>
                      <Plus size={20} className="mx-auto mb-2" style={{ color: '#9CA3AF' }} />
                      <p className="text-sm" style={{ color: '#9CA3AF' }}>+ Glissez un bloc ici ou cliquez dans la bibliothèque</p>
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
          <div className="bg-white border-t px-4 py-2 flex items-center justify-between flex-shrink-0 text-xs" style={{ borderColor: '#E4E7EC', color: '#9CA3AF' }}>
            <div className="flex items-center gap-4">
              <span>Mots : {wordCount}</span>
              {wordCount > 0 && <span>Lecture : ~{Math.ceil(wordCount / 200)} min</span>}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setShowAI(v => !v)} className="flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-medium transition-all"
                style={showAI ? { borderColor: '#BF8813', color: '#BF8813', background: 'rgba(191,136,19,0.05)' } : { borderColor: '#E4E7EC', color: '#6B7280' }}>
                <Sparkles size={12} /> Assistant IA
              </button>
              <button onClick={() => { setShowChecklist(true); if (course?.id) api('validate_checklist', { course_id: course.id }).then(d => setChecklist(d)); }}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-medium"
                style={{ borderColor: '#E4E7EC', color: '#6B7280' }}>
                <CheckCircle size={12} /> Checklist
              </button>
              {lastSave && (
                <span className="flex items-center gap-1" style={{ color: '#1E7A52' }}>
                  <Check size={11} /> Toutes les modifications sont enregistrées ({lastSave})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── COLONNE DROITE : Réglages ou Aperçu ─────── */}
        {(selectedBlock || showPreview || showAI) && (
          <div className="bg-white border-l flex flex-col" style={{ width: '300px', borderColor: '#E4E7EC' }}>

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
                    <option value="ai_generate_summary_block">Bloc Résumé</option>
                    <option value="ai_generate_remember">Bloc À retenir</option>
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
                    {aiLoading ? '⏳ Génération...' : '✨ Générer'}
                  </button>
                  {aiResult && (
                    <div className="space-y-2">
                      <div className="p-3 rounded-xl border text-sm" style={{ borderColor: '#E4E7EC', background: '#F8F9FA', color: '#374151', whiteSpace: 'pre-wrap', maxHeight: '200px', overflowY: 'auto' }}>
                        {aiResult}
                      </div>
                      <button onClick={() => { navigator.clipboard?.writeText(aiResult); showToast('Copié'); }}
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
                      await api('update_block', { block_id: selectedBlock.id, ...updates });
                    }}
                    onAI={async (action, prompt) => {
                      setAiAction(action); setAiInput(prompt); setShowAI(true); setSelectedBlock(null);
                    }}
                    courseId={course?.id || ''}
                    moduleId={currentModule?.id || ''}
                    lessonId={currentLesson?.id || ''}
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
                  {blocks.map(block => (
                    <BlockPreviewReadonly key={block.id} block={block} />
                  ))}
                  {blocks.length === 0 && (
                    <p className="text-sm text-center py-8" style={{ color: '#9CA3AF' }}>Aucun bloc à prévisualiser</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── MODAL CHECKLIST ──────────────────────────── */}
      {showChecklist && checklist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#E4E7EC' }}>
              <h3 className="font-bold" style={{ color: '#002050' }}>Checklist de préparation</h3>
              <button onClick={() => setShowChecklist(false)}><X size={18} style={{ color: '#6B7280' }} /></button>
            </div>
            <div className="p-6 space-y-3">
              {checklist.errors.length === 0 && (
                <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: '#D1FAE5' }}>
                  <CheckCircle size={16} style={{ color: '#065F46' }} />
                  <p className="text-sm font-semibold" style={{ color: '#065F46' }}>Formation prête à soumettre !</p>
                </div>
              )}
              {checklist.errors.map((err, i) => (
                <div key={i} className="flex items-start gap-2 p-3 rounded-xl" style={{ background: '#FEE2E2' }}>
                  <AlertCircle size={14} style={{ color: '#DC2626', flexShrink: 0, marginTop: 2 }} />
                  <p className="text-sm" style={{ color: '#DC2626' }}>{err}</p>
                </div>
              ))}
              {checklist.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 p-3 rounded-xl" style={{ background: '#FEF3C7' }}>
                  <AlertTriangle size={14} style={{ color: '#D97706', flexShrink: 0, marginTop: 2 }} />
                  <p className="text-sm" style={{ color: '#92400E' }}>{w}</p>
                </div>
              ))}
              {checklist.valid && (
                <button onClick={() => { setShowChecklist(false); submit(); }}
                  className="w-full py-3 rounded-xl font-bold text-white mt-2"
                  style={{ background: '#BF8813' }}>
                  Soumettre pour validation
                </button>
              )}
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

function RichTextEditor({ value, onChange, locked, placeholder, headingLevel }: {
  value: string; onChange: (html: string) => void; locked: boolean; placeholder: string; headingLevel?: 1 | 2;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [color, setColor] = useState('#002050');
  const [fontSize, setFontSize] = useState(headingLevel === 1 ? '5' : headingLevel === 2 ? '4' : '3');
  useEffect(() => { if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value || ''; }, [value]);
  function command(cmd: string, arg?: string) {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    if (ref.current) onChange(ref.current.innerHTML);
  }
  return (
    <div className="rounded-xl border overflow-hidden bg-white" style={{ borderColor: '#E4E7EC' }}>
      {!locked && (
        <div className="flex flex-wrap items-center gap-1 px-2 py-2 border-b" style={{ borderColor: '#E4E7EC', background: '#F8F9FA' }}>
          <select value={fontSize} onChange={e => { setFontSize(e.target.value); command('fontSize', e.target.value); }} className="text-xs border rounded px-1.5 py-1" aria-label="Taille du texte">
            <option value="2">Petit</option><option value="3">Normal</option><option value="4">Grand</option><option value="5">Très grand</option><option value="6">Titre</option>
          </select>
          <select onChange={e => command('fontName', e.target.value)} className="text-xs border rounded px-1.5 py-1" aria-label="Police">
            <option value="Inter">Inter</option><option value="Arial">Arial</option><option value="Georgia">Georgia</option><option value="Times New Roman">Times New Roman</option>
          </select>
          <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => command('bold')} className="px-2 py-1 text-xs font-bold rounded hover:bg-white">B</button>
          <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => command('italic')} className="px-2 py-1 text-xs italic rounded hover:bg-white">I</button>
          <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => command('underline')} className="px-2 py-1 text-xs underline rounded hover:bg-white">U</button>
          <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => command('strikeThrough')} className="px-2 py-1 text-xs line-through rounded hover:bg-white">S</button>
          <input type="color" value={color} onChange={e => { setColor(e.target.value); command('foreColor', e.target.value); }} className="w-7 h-7 rounded border p-0.5" title="Couleur du texte" />
          <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => command('removeFormat')} className="px-2 py-1 text-xs rounded hover:bg-white">Effacer le style</button>
          <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => command('undo')} className="px-2 py-1 text-xs rounded hover:bg-white">↶</button>
          <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => command('redo')} className="px-2 py-1 text-xs rounded hover:bg-white">↷</button>
        </div>
      )}
      <div ref={ref} contentEditable={!locked} suppressContentEditableWarning spellCheck lang="fr" data-placeholder={placeholder}
        onInput={() => ref.current && onChange(ref.current.innerHTML)}
        className={`${headingLevel === 1 ? 'text-xl font-bold' : headingLevel === 2 ? 'text-lg font-semibold' : 'text-sm'} min-h-[88px] px-3 py-3 outline-none rich-editor`}
        style={{ color: headingLevel ? '#002050' : '#374151' }} />
      {!locked && <div className="px-3 py-1.5 border-t text-[11px]" style={{ borderColor: '#E4E7EC', color: '#6B7280' }}>Correction automatique du navigateur activée. Pour une correction approfondie, utilisez « Corriger l’orthographe et la grammaire » dans l’Assistant IA.</div>}
    </div>
  );
}


function EditableItems({ items, ordered, locked, onChange, placeholder }: { items: string[]; ordered?: boolean; locked: boolean; onChange: (items: string[]) => void; placeholder: string }) {
  const list = items?.length ? items : [''];
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  function update(index: number, value: string) { const next=[...list]; next[index]=value; onChange(next); }
  function addAfter(index: number) { const next=[...list]; next.splice(index+1,0,''); onChange(next); setTimeout(()=>refs.current[index+1]?.focus(),0); }
  function remove(index: number) { if(list.length===1){onChange(['']);return;} const next=list.filter((_,i)=>i!==index); onChange(next); setTimeout(()=>refs.current[Math.max(0,index-1)]?.focus(),0); }
  return <div className="space-y-2">{list.map((item,index)=><div key={index} className="flex items-start gap-2">
    <span className="mt-2 text-sm font-semibold min-w-[20px]" style={{color:'#002050'}}>{ordered?`${index+1}.`:'•'}</span>
    <input ref={el=>{refs.current[index]=el}} className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-[#002050]" style={{borderColor:'#E4E7EC'}} value={item} placeholder={placeholder} disabled={locked} spellCheck lang="fr"
      onChange={e=>update(index,e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addAfter(index)} if(e.key==='Backspace'&&!item){e.preventDefault();remove(index)}}}/>
    {!locked&&<button type="button" onClick={()=>remove(index)} className="mt-1 p-1.5 rounded hover:bg-red-50" title="Supprimer la ligne"><X size={13} style={{color:'#DC2626'}}/></button>}
  </div>)}
  {!locked&&<button type="button" onClick={()=>addAfter(list.length-1)} className="text-xs font-semibold px-3 py-2 rounded-lg border" style={{borderColor:'#BF8813',color:'#92400E'}}>+ Ajouter une ligne</button>}
  </div>
}

function PedagogicalEditor({ c, locked, onChange, kind }: { c: Record<string,any>; locked:boolean; onChange:(c:Record<string,any>)=>void; kind:string }) {
  const labels:Record<string,string>={objective:'Objectif pédagogique',example:'Exemple',summary:'Résumé',important:'Important',correction:'Correction'};
  return <div className="space-y-2 p-3 rounded-xl border" style={{borderColor:'#E4E7EC',background:'#FBFCFE'}}>
    <input className="w-full font-semibold bg-transparent border-none outline-none" style={{color:'#002050'}} value={c.title||labels[kind]||''} onChange={e=>onChange({...c,title:e.target.value})} disabled={locked} spellCheck lang="fr"/>
    <RichTextEditor value={c.html||''} locked={locked} placeholder="Saisissez le contenu pédagogique..." onChange={html=>onChange({...c,html})}/>
  </div>
}

// ─── Aperçu inline du bloc (éditable) ────────────────────────
function BlockPreview({ block, def, locked, onChange }: {
  block: Block; def: typeof BLOCK_DEFS[0] | undefined; locked: boolean;
  onChange: (content: Record<string, any>) => void;
}) {
  const c = block.content_json;
  const inputCls = 'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-[#002050] transition-colors';
  const style = { borderColor: '#E4E7EC' };

  switch (block.block_type) {
    case 'heading': return (
      <RichTextEditor value={c.html || c.text || ''} locked={locked} headingLevel={1}
        placeholder="Titre..." onChange={html => onChange({ ...c, html, text: stripHtml(html) })} />
    );
    case 'subheading': return (
      <RichTextEditor value={c.html || c.text || ''} locked={locked} headingLevel={2}
        placeholder="Sous-titre..." onChange={html => onChange({ ...c, html, text: stripHtml(html) })} />
    );
    case 'text': return (
      <RichTextEditor value={c.html || ''} locked={locked} placeholder="Saisissez votre texte..."
        onChange={html => onChange({ ...c, html })} />
    );
    case 'callout': return (
      <div className="flex gap-2 p-3 rounded-lg" style={{ background: c.type === 'warning' ? '#FEF3C7' : c.type === 'error' ? '#FEE2E2' : '#EFF6FF' }}>
        <Info size={14} style={{ color: c.type === 'warning' ? '#D97706' : c.type === 'error' ? '#DC2626' : '#0369A1', flexShrink: 0, marginTop: 2 }} />
        <textarea className="flex-1 bg-transparent text-sm border-none outline-none resize-none" rows={2}
          value={c.content || ''} onChange={e => onChange({ ...c, content: e.target.value })} placeholder="Contenu de l'encadré..." disabled={locked} />
      </div>
    );
    case 'bullet_list': return <EditableItems items={c.items || ['']} locked={locked} onChange={items=>onChange({...c,items})} placeholder="Écrivez un élément puis appuyez sur Entrée" />;
    case 'numbered_list': return <EditableItems ordered items={c.items || ['']} locked={locked} onChange={items=>onChange({...c,items})} placeholder="Écrivez une étape puis appuyez sur Entrée" />;
    case 'objective': case 'example': case 'summary': case 'important': case 'correction': return <PedagogicalEditor c={c} locked={locked} onChange={onChange} kind={block.block_type} />;
    case 'definition': return <div className="space-y-2"><input className={inputCls} style={style} value={c.term||''} onChange={e=>onChange({...c,term:e.target.value})} placeholder="Terme à définir" disabled={locked}/><RichTextEditor value={c.definition||''} locked={locked} placeholder="Définition..." onChange={definition=>onChange({...c,definition})}/><RichTextEditor value={c.example||''} locked={locked} placeholder="Exemple facultatif..." onChange={example=>onChange({...c,example})}/></div>;
    case 'case_study': return <div className="space-y-2"><input className={inputCls} style={style} value={c.title||''} onChange={e=>onChange({...c,title:e.target.value})} placeholder="Titre de l’étude de cas" disabled={locked}/><textarea className={inputCls} style={style} rows={3} value={c.context||''} onChange={e=>onChange({...c,context:e.target.value})} placeholder="Contexte" disabled={locked}/><textarea className={inputCls} style={style} rows={3} value={c.data||''} onChange={e=>onChange({...c,data:e.target.value})} placeholder="Données et informations disponibles" disabled={locked}/><textarea className={inputCls} style={style} rows={3} value={c.task||''} onChange={e=>onChange({...c,task:e.target.value})} placeholder="Travail demandé" disabled={locked}/><EditableItems items={c.questions||['']} locked={locked} onChange={questions=>onChange({...c,questions})} placeholder="Question d’analyse" /></div>;
    case 'remember': return (
      <div className="p-3 rounded-lg" style={{ background: 'rgba(191,136,19,0.08)', border: '1px solid #BF881330' }}>
        <div className="flex items-center gap-1.5 mb-2"><Star size={13} style={{ color: '#BF8813' }} /><input className="text-xs font-bold bg-transparent outline-none flex-1" style={{color:'#BF8813'}} value={c.title||'À retenir'} onChange={e=>onChange({...c,title:e.target.value})} disabled={locked}/></div>
        <EditableItems items={c.points||['']} locked={locked} onChange={points=>onChange({...c,points})} placeholder="Point clé à retenir" />
      </div>
    );
    case 'open_question': return <div className="space-y-2"><textarea className={inputCls} style={style} rows={3} value={c.question||''} onChange={e=>onChange({...c,question:e.target.value})} placeholder="Question posée à l’apprenant" disabled={locked}/><textarea className={inputCls} style={style} rows={2} value={c.guidance||''} onChange={e=>onChange({...c,guidance:e.target.value})} placeholder="Consignes ou éléments attendus" disabled={locked}/><textarea className={inputCls} style={style} rows={3} value={c.expected_answer||''} onChange={e=>onChange({...c,expected_answer:e.target.value})} placeholder="Réponse de référence pour le correcteur" disabled={locked}/><input type="number" className={inputCls} style={style} value={c.points||10} onChange={e=>onChange({...c,points:Number(e.target.value)})} min={0} placeholder="Points" disabled={locked}/></div>;
    case 'exercise': return <div className="space-y-2"><input className={inputCls} style={style} value={c.title||''} onChange={e=>onChange({...c,title:e.target.value})} placeholder="Titre de l’exercice" disabled={locked}/><textarea className={inputCls} style={style} rows={4} value={c.instructions||''} onChange={e=>onChange({...c,instructions:e.target.value})} placeholder="Consignes détaillées" disabled={locked}/><textarea className={inputCls} style={style} rows={3} value={c.task||''} onChange={e=>onChange({...c,task:e.target.value})} placeholder="Travail à réaliser" disabled={locked}/><div className="p-3 rounded-lg text-xs" style={{background:'#FFF7ED',color:'#9A3412'}}>Ajoutez les fichiers de travail (PDF, Word, Excel) depuis le panneau de réglages. L’apprenant pourra les télécharger puis déposer sa réponse.</div></div>;
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

// ─── Panneau réglages du bloc ─────────────────────────────────
function BlockSettings({ block, locked, onUpdate, onAI, courseId, moduleId, lessonId }: {
  block: Block; locked: boolean;
  onUpdate: (updates: Partial<Block>) => void;
  onAI: (action: string, prompt: string) => void;
  courseId: string; moduleId: string; lessonId: string;
}) {
  const c = block.content_json;
  const inputCls = 'w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:border-[#002050]';
  const style = { borderColor: '#E4E7EC' };
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // ── Upload fichier vers Supabase Storage ──────────────────
  async function handleFileUpload(file: File, blockType: string) {
    if (!file) return;
    setUploading(true);
    setUploadProgress(10);
    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
      const bucketMap: Record<string, string> = {
        image: 'course-images', video: 'course-videos', audio: 'course-audios',
        pdf: 'course-documents', word: 'course-documents', excel: 'course-excel',
        scorm: 'course-scorm', download: 'course-resources',
      };
      const bucket = bucketMap[blockType] || 'course-resources';
      const path = `${courseId}/${moduleId}/${lessonId}/${block.id}.${ext}`;

      setUploadProgress(30);
      const signed = await api('prepare_upload', { course_id: courseId, bucket_name: bucket, storage_path: path });
      if (!signed.success || !signed.signedUrl) throw new Error('Impossible de préparer le téléversement');
      const uploadRes = await fetch(signed.signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
      setUploadProgress(80);
      if (!uploadRes.ok) throw new Error('Erreur upload');

      // Enregistrer le fichier via studio-unified
      const saveRes = await api('upload_block_file', {
        block_id: block.id,
        course_id: courseId,
        module_id: moduleId,
        lesson_id: lessonId,
        file_name: file.name,
        file_size: file.size,
        file_mime: file.type,
        storage_path: path,
        bucket_name: bucket,
      });

      setUploadProgress(100);
      if (saveRes.success) {
        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
        onUpdate({
          file_url: publicUrl,
          file_name: file.name,
          file_size: file.size,
          file_mime: file.type,
          content_json: { ...c, url: publicUrl, title: c.title || file.name },
        });
      }
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setTimeout(() => { setUploading(false); setUploadProgress(0); }, 800);
    }
  }


  return (
    <div className="space-y-4">
      {/* Titre du bloc */}
      <div>
        <label className="block text-xs font-semibold mb-1.5" style={{ color: '#002050' }}>Titre du bloc</label>
        <input className={inputCls} style={style} value={block.title || ''}
          onChange={e => onUpdate({ title: e.target.value })} placeholder="Titre optionnel..." disabled={locked} />
      </div>

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
            <div className={`w-10 h-6 rounded-full relative transition-all cursor-pointer ${c.eco_data ? 'bg-[#002050]' : 'bg-gray-200'}`} onClick={() => onUpdate({ content_json: { ...c, eco_data: !c.eco_data } })}>
              <span className="absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform" style={{ transform: c.eco_data ? 'translateX(20px)' : 'translateX(4px)' }} />
            </div>
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
                  <button onClick={() => onUpdate({ file_url: undefined, file_name: undefined, file_size: undefined, content_json: { ...c, url: '' } })}
                    className="text-xs px-2 py-1 rounded-lg" style={{ color: '#DC2626', background: '#FEE2E2' }}>
                    Retirer
                  </button>
                )}
              </div>
            ) : (
              <label className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all ${locked ? 'opacity-50 cursor-not-allowed' : 'hover:border-[#002050]'}`}
                style={{ borderColor: '#E4E7EC', background: '#F8F9FA' }}>
                <input type="file" className="hidden" disabled={locked}
                  accept={
                    block.block_type === 'video' ? '.mp4,.mov,.avi,.mkv,.webm' :
                    block.block_type === 'pdf' ? '.pdf' :
                    block.block_type === 'word' ? '.doc,.docx' :
                    block.block_type === 'excel' ? '.xls,.xlsx,.csv' :
                    block.block_type === 'audio' ? '.mp3,.wav,.ogg,.m4a' :
                    block.block_type === 'scorm' ? '.zip' :
                    '*'
                  }
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, block.block_type); }} />
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
                        ⚠️ Format ZIP — SCORM 1.2 ou 2004
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
                  <select className={inputCls} style={style} value={c.package_type || 'scorm_12'}
                    onChange={e => onUpdate({ content_json: { ...c, package_type: e.target.value } })} disabled={locked}>
                    <option value="scorm_12">SCORM 1.2</option>
                    <option value="scorm_2004">SCORM 2004</option>
                    <option value="xapi">xAPI (Tin Can)</option>
                    <option value="aicc">AICC</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: '#6B7280' }}>Durée estimée (minutes)</label>
                  <input type="number" className={inputCls} style={style} value={c.duration_min || 0}
                    onChange={e => onUpdate({ content_json: { ...c, duration_min: parseInt(e.target.value) } })} disabled={locked} />
                </div>
              </div>
            </div>
          )}

          {/* Option téléchargeable */}
          {['pdf', 'word', 'excel', 'download'].includes(block.block_type) && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={c.downloadable !== false}
                onChange={e => onUpdate({ content_json: { ...c, downloadable: e.target.checked } })}
                style={{ accentColor: '#002050' }} disabled={locked} />
              <span className="text-sm" style={{ color: '#374151' }}>Autoriser le téléchargement</span>
            </label>
          )}
        </div>
      ))}

      {/* Upload image */}
      {block.block_type === 'image' && (
        <div className="space-y-3">
          {!block.file_name ? (
            <label className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all ${locked ? 'opacity-50 cursor-not-allowed' : 'hover:border-[#002050]'}`}
              style={{ borderColor: '#E4E7EC', background: '#F8F9FA' }}>
              <input type="file" className="hidden" accept=".jpg,.jpeg,.png,.gif,.webp" disabled={locked}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, 'image'); }} />
              {uploading ? (
                <p className="text-xs" style={{ color: '#6B7280' }}>Envoi... {uploadProgress}%</p>
              ) : (
                <>
                  <Image size={20} className="mb-2" style={{ color: '#9CA3AF' }} />
                  <p className="text-xs font-semibold" style={{ color: '#374151' }}>Téléverser une image</p>
                  <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>JPG, PNG, GIF, WebP</p>
                </>
              )}
            </label>
          ) : (
            <div className="p-3 rounded-xl border flex items-center gap-2" style={{ background: '#F0FDF4', borderColor: '#A7F3D0' }}>
              <CheckCircle size={14} style={{ color: '#1E7A52' }} />
              <p className="text-xs font-semibold truncate flex-1" style={{ color: '#065F46' }}>{block.file_name}</p>
              {!locked && (
                <button onClick={() => onUpdate({ file_url: undefined, file_name: undefined, content_json: { ...c, url: '' } })}
                  className="text-xs px-2 py-1 rounded" style={{ color: '#DC2626' }}>Retirer</button>
              )}
            </div>
          )}
        </div>
      )}


      {/* IA Assistant */}
      <div className="p-3 rounded-xl border" style={{ borderColor: '#E4E7EC', background: '#F8F9FA' }}>
        <div className="flex items-center gap-1.5 mb-2">
          <Sparkles size={12} style={{ color: '#BF8813' }} />
          <p className="text-xs font-bold" style={{ color: '#002050' }}>IA Assistant</p>
        </div>
        <p className="text-xs mb-2" style={{ color: '#6B7280' }}>Obtenez de l'aide pour améliorer votre contenu.</p>
        <button onClick={() => onAI('ai_improve_text', c.text || c.html || c.question || c.content || '')}
          className="w-full py-2 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-1.5"
          style={{ background: '#002050' }}>
          <Sparkles size={11} /> Ouvrir l'assistant IA
        </button>
      </div>
    </div>
  );
}

// ─── Aperçu lecture seule (panneau droit) ─────────────────────
function BlockPreviewReadonly({ block }: { block: Block }) {
  const c = block.content_json;
  const def = BLOCK_DEFS.find(d => d.type === block.block_type);

  switch (block.block_type) {
    case 'heading': return <h2 className="text-xl font-black" style={{ color: '#002050' }}>{c.text}</h2>;
    case 'subheading': return <h3 className="text-lg font-bold" style={{ color: '#374151' }}>{c.text}</h3>;
    case 'text': return <div className="text-sm" style={{ color: '#374151', lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: c.html || '' }} />;
    case 'separator': return <hr style={{ borderColor: '#E4E7EC' }} />;
    case 'callout': return (
      <div className="flex gap-2 p-3 rounded-lg" style={{ background: '#EFF6FF' }}>
        <Info size={14} style={{ color: '#0369A1', flexShrink: 0 }} />
        <p className="text-sm" style={{ color: '#374151' }}>{c.content}</p>
      </div>
    );
    case 'remember': return (
      <div className="p-3 rounded-lg" style={{ background: 'rgba(191,136,19,0.08)' }}>
        <p className="text-xs font-bold mb-2" style={{ color: '#BF8813' }}>⭐ À retenir</p>
        {(c.points || []).map((pt: string, i: number) => (
          <p key={i} className="text-sm mb-1" style={{ color: '#374151' }}>• {pt}</p>
        ))}
      </div>
    );
    case 'image': return c.url ? <img src={c.url} alt={c.alt} className="w-full rounded-lg" /> : null;
    case 'qcm': return (
      <div className="space-y-2">
        <p className="text-sm font-semibold" style={{ color: '#002050' }}>{c.question}</p>
        {(c.options || []).map((opt: string, i: number) => (
          <div key={i} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: '#F8F9FA' }}>
            <div className="w-4 h-4 rounded-full border-2 flex-shrink-0" style={{ borderColor: '#D1D5DB' }} />
            <span className="text-sm">{opt}</span>
          </div>
        ))}
      </div>
    );
    case 'true_false': return (
      <div className="space-y-2">
        <p className="text-sm font-semibold" style={{ color: '#002050' }}>{c.statement}</p>
        <div className="flex gap-3">
          <button className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: '#D1FAE5', color: '#065F46' }}>Vrai</button>
          <button className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: '#FEE2E2', color: '#991B1B' }}>Faux</button>
        </div>
      </div>
    );
    default: return def ? (
      <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: '#F8F9FA' }}>
        <def.icon size={16} style={{ color: def.color }} />
        <span className="text-sm" style={{ color: '#374151' }}>{def.label} {c.title || ''}</span>
      </div>
    ) : null;
  }
}
