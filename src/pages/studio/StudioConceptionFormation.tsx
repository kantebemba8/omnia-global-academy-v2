import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Save, Eye, EyeOff, Send, History,
  Plus, Trash2, Copy, GripVertical, Settings, Sparkles, X, Check,
  AlertCircle, CheckCircle, Clock, FileText, Image, Video, Music,
  File, Table, HelpCircle, BookOpen, Lightbulb, Star, Minus,
  AlignLeft, Heading1, Heading2, Download, Layers, ToggleLeft,
  ChevronDown, ChevronUp, Zap, AlertTriangle, Info, BarChart2,
  Layout, RefreshCw, MoreVertical, Move
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

interface Lesson { id: string; title: string; position: number; has_blocks: boolean; block_count: number; }
interface Module { id: string; title: string; objective: string; position: number; lessons: Lesson[]; }
interface Course {
  id: string; title: string; short_description?: string; long_description?: string;
  category?: string; level?: string; language?: string; prerequisites?: string;
  objectives?: string[]; cover_image_url?: string; studio_status: string;
  studio_mode?: string; word_count?: number; estimated_read_min?: number;
  last_autosave_at?: string; admin_comment?: string; template_used?: string;
}

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
  const [course, setCourse] = useState<Course | null>(null);
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

  // Autosave ref
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const courseRef = useRef<Course | null>(null);
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
          const data = await api('create_course', {
            title: 'Nouvelle formation',
            template_used: templateKey,
            studio_mode: 'simple',
          });
          if (data.success) {
            setCourse(data.course);
            navigate(`/professeur/studio/${data.course.id}`, { replace: true });
          }
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
            navigate('/professeur/courses');
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
    setCourse(c => c ? { ...c, [field]: value } : c);
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
    const title = `Module ${modules.length + 1}`;
    const data = await api('create_module', { course_id: course.id, title, objective: '' });
    if (data.success) {
      const newMod = { ...data.module, lessons: [] };
      setModules(m => [...m, newMod]);
      setCurrentModule(newMod);
      setCurrentLesson(null);
      setBlocks([]);
      showToast('Module ajouté');
    }
  }

  // ─── Ajouter leçon ────────────────────────────────────────
  async function addLesson(mod: Module) {
    if (!course?.id) return;
    const title = `Leçon ${(mod.lessons?.length || 0) + 1}`;
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
      case 'remember': return { title: 'À retenir', points: ['Point clé 1', 'Point clé 2'] };
      case 'objective': return { text: 'À la fin de cette leçon, vous serez capable de...' };
      case 'example': return { title: 'Exemple', situation: '', explication: '', conclusion: '' };
      case 'summary': return { intro: 'Dans cette leçon, vous avez appris...', points: [] };
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
      case 'open_question': return { question: '', guidance: '', expected_answer: '' };
      case 'exercise': return { title: '', instructions: '', data: '', task: '' };
      case 'accordion': return { items: [{ id: uid(), title: 'Section 1', content: '' }] };
      case 'flashcards': return { cards: [{ id: uid(), front: 'Recto', back: 'Verso' }] };
      case 'interactive_table': return { headers: ['Colonne 1', 'Colonne 2', 'Colonne 3'], rows: [['', '', '']], style: 'table' };
      case 'timeline': return { steps: [{ id: uid(), title: 'Étape 1', description: '' }] };
      case 'columns': return { columns: [{ id: uid(), content: '' }, { id: uid(), content: '' }] };
      case 'important': return { type: 'warning', content: '' };
      case 'case_study': return { context: '', data: '', task: '', questions: [] };
      case 'definition': return { term: '', definition: '', example: '' };
      case 'correction': return { content: '', key_points: [] };
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

  // ─── Sauvegarder ──────────────────────────────────────────
  async function save() {
    if (!course?.id) return;
    setSaving(true);
    try {
      const data = await api('update_course', {
        course_id: course.id, title: course.title,
        short_description: course.short_description,
        category: course.category, level: course.level,
        language: course.language, objectives: course.objectives,
        cover_image_url: course.cover_image_url,
        word_count: wordCount,
      });
      if (data.success) {
        setCourse(data.course);
        setLastSave(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
        showToast('✅ Sauvegardé');
      }
    } catch { showToast('Erreur de sauvegarde', 'error'); }
    finally { setSaving(false); }
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

  const locked = ['pending_validation', 'validated', 'published'].includes(course?.studio_status || '');
  const statusCfg = STATUS_CFG[course?.studio_status || 'draft'] || STATUS_CFG.draft;
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
        <button onClick={() => navigate('/professeur/courses')} className="flex items-center gap-1.5 mr-4 text-sm" style={{ color: '#6B7280' }}>
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
          <button onClick={() => setShowPreview(v => !v)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium" style={{ borderColor: '#E4E7EC', color: '#6B7280' }}>
            {showPreview ? <EyeOff size={13} /> : <Eye size={13} />} Aperçu
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
      <div className="flex flex-1 overflow-hidden">

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
                          <button key={def.type} onClick={() => addBlock(def.type)} disabled={locked}
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
                  <button key={tmpl.key}
                    className="w-full text-left p-3 rounded-lg border text-xs transition-all hover:shadow-sm"
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
                  <div className="text-xs font-semibold mb-1" style={{ color: currentModule?.id === mod.id ? '#002050' : '#6B7280' }}>{mod.title}</div>
                  <div className="flex gap-1">
                    {(mod.lessons || []).map(lesson => (
                      <button key={lesson.id}
                        onClick={() => selectLesson(mod, lesson)}
                        className="text-xs px-2 py-0.5 rounded-full border transition-all"
                        style={currentLesson?.id === lesson.id
                          ? { background: '#002050', color: 'white', borderColor: '#002050' }
                          : { borderColor: '#E4E7EC', color: '#6B7280' }}>
                        {lesson.title}
                      </button>
                    ))}
                    <button onClick={() => addLesson(mod)} disabled={locked}
                      className="text-xs px-1.5 py-0.5 rounded-full border border-dashed disabled:opacity-40"
                      style={{ borderColor: '#BF8813', color: '#BF8813' }}>
                      + Leçon
                    </button>
                  </div>
                </div>
              ))}
              <button onClick={addModule} disabled={locked}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-dashed flex-shrink-0 disabled:opacity-40"
                style={{ borderColor: '#002050', color: '#002050' }}>
                <Plus size={11} /> Module
              </button>
            </div>
          </div>

          {/* Canevas */}
          <div className="flex-1 overflow-y-auto p-6" style={{ background: '#F0F2F5' }}>

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
                  { field: 'short_description', label: 'Description courte *', placeholder: 'Décrivez votre formation en 2-3 phrases...', type: 'textarea' },
                  { field: 'category', label: 'Catégorie *', placeholder: '', type: 'select', options: ['Comptabilité & Finance', 'Marketing digital', 'Management & Leadership', 'Informatique de gestion', 'Langues & Linguistique', 'Entrepreneuriat', 'Ressources humaines', 'Commerce international', 'Autre'] },
                  { field: 'level', label: 'Niveau *', placeholder: '', type: 'select', options: ['debutant', 'intermediaire', 'avance'] },
                  { field: 'language', label: 'Langue *', placeholder: '', type: 'select', options: ['fr', 'en', 'ar', 'bm'] },
                  { field: 'prerequisites', label: 'Prérequis', placeholder: 'Aucun prérequis particulier...', type: 'textarea' },
                  { field: 'cover_image_url', label: 'URL image de couverture', placeholder: 'https://...', type: 'text' },
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
                    disabled={locked} />
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
                    <option value="ai_fix_grammar">Corriger la grammaire</option>
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
      <input className="text-xl font-black bg-transparent border-none outline-none w-full" style={{ color: '#002050' }}
        value={c.text || ''} onChange={e => onChange({ ...c, text: e.target.value })} placeholder="Titre..." disabled={locked} />
    );
    case 'subheading': return (
      <input className="text-lg font-bold bg-transparent border-none outline-none w-full" style={{ color: '#374151' }}
        value={c.text || ''} onChange={e => onChange({ ...c, text: e.target.value })} placeholder="Sous-titre..." disabled={locked} />
    );
    case 'text': return (
      <textarea className={inputCls} style={{ ...style, resize: 'vertical', minHeight: '100px' }} rows={4}
        value={(c.html || '').replace(/<[^>]+>/g, '')} disabled={locked}
        onChange={e => onChange({ ...c, html: `<p>${e.target.value}</p>` })} placeholder="Saisissez votre texte..." />
    );
    case 'callout': return (
      <div className="flex gap-2 p-3 rounded-lg" style={{ background: c.type === 'warning' ? '#FEF3C7' : c.type === 'error' ? '#FEE2E2' : '#EFF6FF' }}>
        <Info size={14} style={{ color: c.type === 'warning' ? '#D97706' : c.type === 'error' ? '#DC2626' : '#0369A1', flexShrink: 0, marginTop: 2 }} />
        <textarea className="flex-1 bg-transparent text-sm border-none outline-none resize-none" rows={2}
          value={c.content || ''} onChange={e => onChange({ ...c, content: e.target.value })} placeholder="Contenu de l'encadré..." disabled={locked} />
      </div>
    );
    case 'remember': return (
      <div className="p-3 rounded-lg" style={{ background: 'rgba(191,136,19,0.08)', border: '1px solid #BF881330' }}>
        <div className="flex items-center gap-1.5 mb-2"><Star size={13} style={{ color: '#BF8813' }} /><span className="text-xs font-bold" style={{ color: '#BF8813' }}>À retenir</span></div>
        {(c.points || []).map((pt: string, i: number) => (
          <div key={i} className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#BF8813' }} />
            <input className="flex-1 bg-transparent text-sm border-none outline-none" value={pt}
              onChange={e => { const pts = [...(c.points || [])]; pts[i] = e.target.value; onChange({ ...c, points: pts }); }} disabled={locked} />
          </div>
        ))}
      </div>
    );
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
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-sm font-semibold" style={{ color: '#002050' }}>Mode simple</p>
              <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Vidéo non chargée automatiquement (éco-data)</p>
            </div>
            <div className={`w-10 h-6 rounded-full relative transition-all cursor-pointer ${c.eco_data ? 'bg-[#002050]' : 'bg-gray-200'}`}
              onClick={() => onUpdate({ content_json: { ...c, eco_data: !c.eco_data } })}>
              <span className="absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform" style={{ transform: c.eco_data ? 'translateX(20px)' : 'translateX(4px)' }} />
            </div>
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-sm font-semibold" style={{ color: '#002050' }}>Mode avancé</p>
              <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Options de personnalisation et accessibilité</p>
            </div>
            <div className="w-10 h-6 rounded-full relative bg-gray-200">
              <span className="absolute top-1 w-4 h-4 bg-white rounded-full shadow" style={{ transform: 'translateX(4px)' }} />
            </div>
          </label>
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
