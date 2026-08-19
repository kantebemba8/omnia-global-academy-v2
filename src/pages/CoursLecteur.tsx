import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, Circle, PlayCircle, Volume2, FileText, ChevronDown, ChevronRight, X, Bot, ArrowLeft, ClipboardList, Trophy, Send, AlertCircle, ExternalLink, WifiOff, Database, ShieldCheck, Gauge, RefreshCw, Menu, Target, Clock3, Layers3, Sparkles } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useCpdTimer } from '../hooks/useCpdTimer';
import { ENDPOINTS } from '../lib/config';
import { LessonBlocksRenderer } from '../components/BlockRenderer';
import { AssessmentEngine } from '../components/AssessmentEngine';
import { acknowledgeOfflineSeconds, getResilientDeviceId, listOfflineProgress, listResilientLessonIds, loadResilientCourseProgress, loadResilientLesson, queueOfflineSeconds, saveResilientCourseProgress, saveResilientLesson } from '../lib/resilientCourseStore';
import { useOmniaNetworkStatus } from '../hooks/useOmniaNetwork';
import { openExternalUrl } from '../lib/mobile';
interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface LessonItem {
  lesson_id: string; title: string; position: number;
  content_type: 'video' | 'audio' | 'text' | 'external'; duration_seconds: number;
  is_free: boolean; is_completed: boolean; time_spent_seconds: number; quiz_passed: boolean;
  is_unlocked?: boolean; is_external?: boolean;
  is_intro?: boolean; is_module_intro?: boolean; is_conclusion?: boolean; is_final_exam?: boolean;
  stage_type?: 'introduction' | 'module_presentation' | 'lesson' | 'module_summary' | 'conclusion' | 'final_exam';
}
interface ModuleItem {
  module_id: string; title: string; position: number; description?: string;
  lessons: LessonItem[]; exam_required?: boolean; exam_unlocked: boolean; exam_passed: boolean;
  exam_score: number | null; exam_attempts: number; is_unlocked: boolean;
  is_intro?: boolean; is_conclusion?: boolean; is_final_exam?: boolean; is_required?: boolean;
  section_type?: 'introduction' | 'module' | 'conclusion' | 'final_exam';
}
interface LessonContent {
  id: string; title: string; content_type: 'video' | 'audio' | 'text' | 'external';
  video_url?: string; audio_url?: string; text_content?: string;
  lesson_summary?: string; duration_seconds: number; cloudflare_stream_uid?: string;
  is_external?: boolean; external_url?: string; external_partner?: string;
  course_category?: string;
  has_blocks?: boolean;
  exercices_auto?: Array<{
    type: 'flashcards_vocabulaire' | 'texte_a_trous' | 'dictee_audio';
    mots?: string[];
    phrase?: string;
    reponse?: string;
    texteReference?: string;
  }>;
}

interface CourseInfoPayload {
  course?: Record<string, any>;
  creator?: Record<string, any>;
  modules?: Array<Record<string, any>>;
}

interface CourseProgressSnapshot {
  modules: ModuleItem[];
  finalUnlocked: boolean;
  progressPct: number;
  savedAt: string;
}

interface LessonDataPayload {
  lesson: LessonContent;
  progress: { time_spent_seconds: number; quiz_passed: boolean; is_completed: boolean };
  required_seconds: number;
  cpd_time_reached: boolean;
  next_lesson_id: string | null;
  blocks?: Array<Record<string, unknown>>;
  training?: { required_count: number; passed_count: number; passed: boolean; latest_attempts?: Array<Record<string, any>> };
  block_states?: Array<{ block_id: string; state_json: Record<string, any>; completed: boolean }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function findFirstIncomplete(mods: ModuleItem[]): string | null {
  for (const mod of mods) {
    if (!mod.is_unlocked) continue;
    for (const l of mod.lessons) { if (!l.is_completed) return l.lesson_id; }
  }
  return mods[0]?.lessons[0]?.lesson_id ?? null;
}
function findNext(mods: ModuleItem[], id: string): string | null {
  const all = mods.flatMap(m => m.lessons);
  const idx = all.findIndex(l => l.lesson_id === id);
  return idx >= 0 && idx < all.length - 1 ? all[idx + 1].lesson_id : null;
}
function findFirstOfflineLesson(mods: ModuleItem[], availableLessonIds: ReadonlySet<string>): string | null {
  for (const mod of mods) {
    if (!mod.is_unlocked) continue;
    const available = mod.lessons.find(lesson => availableLessonIds.has(lesson.lesson_id));
    if (available) return available.lesson_id;
  }
  return null;
}
function courseProgressExpiry(): string {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
}
function fmtTime(s: number) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
function previewModulesFromCourseInfo(info: CourseInfoPayload | null): ModuleItem[] {
  return (info?.modules || []).map((mod: any) => ({
    module_id: String(mod.id),
    title: String(mod.title || ''),
    position: Number(mod.position || 0),
    description: String(mod.objective || ''),
    is_unlocked: true,
    is_intro: mod.is_intro === true,
    is_conclusion: mod.is_conclusion === true,
    is_final_exam: mod.is_final_exam === true,
    is_required: mod.is_required !== false,
    section_type: (mod.section_type || (mod.is_intro ? 'introduction' : mod.is_conclusion ? 'conclusion' : mod.is_final_exam ? 'final_exam' : 'module')) as ModuleItem['section_type'],
    exam_unlocked: true, exam_passed: false, exam_score: null, exam_attempts: 0,
    lessons: (mod.lessons || []).map((lesson: any) => ({
      lesson_id: String(lesson.id), title: String(lesson.title || ''), position: Number(lesson.position || 0),
      content_type: lesson.is_external ? 'external' : lesson.has_video ? 'video' : lesson.has_audio ? 'audio' : 'text',
      duration_seconds: Number(lesson.cpd_calculated_time_seconds || lesson.duration_seconds || 0),
      is_free: lesson.is_free_preview === true, is_completed: false, time_spent_seconds: 0, quiz_passed: false, is_unlocked: true,
      is_intro: lesson.is_intro === true, is_module_intro: lesson.is_module_intro === true, is_conclusion: lesson.is_conclusion === true, is_final_exam: lesson.is_final_exam === true,
      stage_type: (lesson.stage_type || (lesson.is_intro ? 'introduction' : lesson.is_module_intro ? 'module_presentation' : lesson.is_conclusion ? 'conclusion' : lesson.is_final_exam ? 'final_exam' : 'lesson')) as LessonItem['stage_type'],
    })),
  }));
}
function normalizeReaderModules(input: any): ModuleItem[] {
  if (!Array.isArray(input)) return [];
  const sectionType = (mod:any) => String(mod?.section_type || (mod?.is_intro ? 'introduction' : mod?.is_conclusion ? 'conclusion' : mod?.is_final_exam ? 'final_exam' : 'module'));
  const stageType = (lesson:any) => String(lesson?.stage_type || (lesson?.is_intro ? 'introduction' : lesson?.is_module_intro ? 'module_presentation' : lesson?.is_conclusion ? 'conclusion' : lesson?.is_final_exam ? 'final_exam' : 'lesson'));
  const rankModule = (mod:any) => sectionType(mod)==='introduction'?-100000:sectionType(mod)==='conclusion'?100000:sectionType(mod)==='final_exam'?200000:Number(mod?.position||0);
  const rankLesson = (lesson:any) => stageType(lesson)==='module_presentation'?-10000:stageType(lesson)==='module_summary'?10000:Number(lesson?.position||0);
  return input.filter(Boolean).map((mod:any) => ({
    ...mod,
    module_id: String(mod.module_id ?? mod.id ?? ''),
    title: String(mod.title ?? ''),
    position: Number(mod.position || 0),
    section_type: sectionType(mod) as ModuleItem['section_type'],
    is_unlocked: mod.is_unlocked !== false,
    exam_unlocked: mod.exam_unlocked !== false,
    exam_passed: mod.exam_passed === true,
    exam_score: mod.exam_score ?? null,
    exam_attempts: Number(mod.exam_attempts || 0),
    lessons: (Array.isArray(mod.lessons) ? mod.lessons : []).filter(Boolean).map((lesson:any) => ({
      ...lesson,
      lesson_id: String(lesson.lesson_id ?? lesson.id ?? ''), title: String(lesson.title ?? ''), position: Number(lesson.position || 0),
      stage_type: stageType(lesson) as LessonItem['stage_type'], duration_seconds: Number(lesson.duration_seconds || lesson.cpd_calculated_time_seconds || 0),
      content_type: lesson.content_type || (lesson.is_external ? 'external' : lesson.has_video || lesson.video_url ? 'video' : lesson.has_audio || lesson.audio_url ? 'audio' : 'text'),
      is_free: lesson.is_free === true || lesson.is_free_preview === true, is_completed: lesson.is_completed === true, time_spent_seconds: Number(lesson.time_spent_seconds || 0), quiz_passed: lesson.quiz_passed === true, is_unlocked: lesson.is_unlocked !== false,
    })).sort((a:any,b:any)=>rankLesson(a)-rankLesson(b)),
  })).sort((a:any,b:any)=>rankModule(a)-rankModule(b));
}

// ── SimpleMarkdown ────────────────────────────────────────────────────────────
function renderInline(text: string): React.ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith('**') && p.endsWith('**') ? <strong key={i} style={{ color: '#002050' }}>{p.slice(2, -2)}</strong> : p
  );
}
function SimpleMarkdown({ text }: { text: string }) {
  return (
    <div className="space-y-2">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### ')) return <h3 key={i} className="font-bold text-base mt-3" style={{ color: '#002050' }}>{line.slice(4)}</h3>;
        if (line.startsWith('## ')) return <h2 key={i} className="font-bold text-lg mt-4" style={{ color: '#002050' }}>{line.slice(3)}</h2>;
        if (line.startsWith('# ')) return <h1 key={i} className="font-bold text-xl mt-4" style={{ color: '#002050' }}>{line.slice(2)}</h1>;
        if (line.startsWith('- ') || line.startsWith('* ')) return <p key={i} className="text-sm flex gap-2" style={{ color: '#374151' }}><span style={{ color: '#BF8813' }}>•</span>{renderInline(line.slice(2))}</p>;
        if (!line.trim()) return <div key={i} className="h-1" />;
        return <p key={i} className="text-sm leading-relaxed" style={{ color: '#374151' }}>{renderInline(line)}</p>;
      })}
    </div>
  );
}

// ── Exercice composants ───────────────────────────────────────────────────────
function TextATrousExercise({ phrase, answer }: { phrase: string; answer: string }) {
  const [input, setInput] = useState('');
  const [checked, setChecked] = useState(false);
  const correct = input.trim().toLowerCase() === answer.toLowerCase();
  const parts = phrase.split('___');
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 flex-wrap text-sm" style={{ color: '#374151' }}>
        {parts.map((part, i) => (
          <span key={i}>
            {part}
            {i < parts.length - 1 && (
              <input type="text" value={input}
                onChange={e => { setInput(e.target.value); setChecked(false); }}
                placeholder="___"
                className="inline-block w-28 px-2 py-0.5 border rounded text-sm mx-1 focus:outline-none"
                style={{ borderColor: checked ? (correct ? '#1E7A52' : '#DC2626') : '#E4E7EC' }} />
            )}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => setChecked(true)}
          className="px-3 py-1.5 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: '#002050' }}>
          Vérifier
        </button>
        {checked && (
          <span className="text-sm font-medium" style={{ color: correct ? '#1E7A52' : '#DC2626' }}>
            {correct ? '✓ Correct !' : `✗ Réponse : ${answer}`}
          </span>
        )}
      </div>
    </div>
  );
}

function DicteeAudioExercise({ texteReference, audioUrl }: { texteReference: string; audioUrl?: string }) {
  const [input, setInput] = useState('');
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="space-y-3">
      {audioUrl && <audio controls className="w-full"><source src={audioUrl} /></audio>}
      <textarea value={input} onChange={e => setInput(e.target.value)}
        placeholder="Transcrivez ce que vous entendez…" rows={3}
        className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none"
        style={{ borderColor: '#E4E7EC' }} />
      <button onClick={() => setRevealed(true)} className="text-sm underline" style={{ color: '#BF8813' }}>
        Voir la transcription
      </button>
      {revealed && (
        <div className="p-3 rounded-lg" style={{ backgroundColor: '#E4F1EA' }}>
          <p className="text-sm" style={{ color: '#1E7A52' }}>{texteReference}</p>
        </div>
      )}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function CourseSidebar({ modules, currentLessonId, onSelectLesson, onGoExam, onGoFinal, finalUnlocked, isOnline, offlineLessonIds }: {
  modules: ModuleItem[];
  currentLessonId: string | null;
  onSelectLesson: (id: string) => void;
  onGoExam: (modId: string) => void;
  onGoFinal: () => void;
  finalUnlocked: boolean;
  isOnline: boolean;
  offlineLessonIds: ReadonlySet<string>;
}) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(modules.filter(m => (m.section_type || 'module') === 'module').map(module => module.module_id)));
  useEffect(() => {
    setOpen(previous => {
      const next = new Set(previous);
      modules.filter(module => (module.section_type || 'module') === 'module').forEach(module => next.add(module.module_id));
      return next;
    });
  }, [modules]);
  const toggle = (id: string) => setOpen(previous => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const typeIcon = (contentType: string) => contentType === 'video'
    ? <PlayCircle size={13} />
    : contentType === 'audio'
      ? <Volume2 size={13} />
      : contentType === 'external'
        ? <ExternalLink size={13} />
        : <FileText size={13} />;
  const normalModules = modules.filter(m => (m.section_type || (m.is_intro ? 'introduction' : m.is_conclusion ? 'conclusion' : m.is_final_exam ? 'final_exam' : 'module')) === 'module');
  const sectionLabel = (module: ModuleItem) => {
    const type = module.section_type || (module.is_intro ? 'introduction' : module.is_conclusion ? 'conclusion' : module.is_final_exam ? 'final_exam' : 'module');
    if (type === 'introduction') return 'Introduction';
    if (type === 'conclusion') return 'Conclusion';
    if (type === 'final_exam') return 'Examen final';
    const index = normalModules.findIndex(m => m.module_id === module.module_id);
    return `Module ${Math.max(1, index + 1)}`;
  };
  const renderLessonButton = (lesson: LessonItem, module: ModuleItem) => {
    const current = lesson.lesson_id === currentLessonId;
    const availableOffline = offlineLessonIds.has(lesson.lesson_id);
    const canOpen = module.is_unlocked && (isOnline || availableOffline);
    const stage = lesson.stage_type || (lesson.is_module_intro ? 'module_presentation' : 'lesson');
    const stageLabel = stage === 'module_presentation' ? 'Présentation' : stage === 'module_summary' ? 'Synthèse' : stage === 'introduction' ? 'Introduction' : stage === 'conclusion' ? 'Conclusion' : stage === 'final_exam' ? 'Examen final' : null;
    return (
      <button
        key={lesson.lesson_id}
        onClick={() => canOpen && onSelectLesson(lesson.lesson_id)}
        disabled={!canOpen}
        title={!isOnline && !availableOffline ? 'Cette étape n’est pas conservée sur cet appareil.' : undefined}
        className="w-full flex items-center gap-2.5 pl-6 pr-4 py-2 text-left transition-colors"
        style={{ backgroundColor: current ? '#EEF2FF' : 'transparent', cursor: canOpen ? 'pointer' : 'not-allowed', opacity: canOpen ? 1 : 0.42 }}
      >
        {lesson.is_completed
          ? <CheckCircle size={14} style={{ color: '#1E7A52', flexShrink: 0 }} />
          : current
            ? <PlayCircle size={14} style={{ color: '#002050', flexShrink: 0 }} />
            : <Circle size={14} style={{ color: '#D1D5DB', flexShrink: 0 }} />}
        <span className="min-w-0 flex-1">
          {stageLabel && stage !== 'lesson' && <span className="mr-1 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-500">{stageLabel}</span>}
          <span className="text-xs leading-tight" style={{ color: current ? '#002050' : '#374151', fontWeight: current ? 600 : 400 }}>{lesson.title}</span>
        </span>
        {!isOnline && availableOffline && <Database size={12} aria-label="Disponible hors connexion" style={{ color: '#1E7A52', flexShrink: 0 }} />}
        <span className="ml-auto flex-shrink-0" style={{ color: '#9CA3AF' }}>{typeIcon(lesson.content_type)}</span>
      </button>
    );
  };

  return (
    <div className="h-full overflow-y-auto" style={{ backgroundColor: '#FAFAFA', borderRight: '1px solid #E4E7EC' }}>
      <div className="py-3">
        {modules.map(module => {
          const type = module.section_type || (module.is_intro ? 'introduction' : module.is_conclusion ? 'conclusion' : module.is_final_exam ? 'final_exam' : 'module');
          const isNormal = type === 'module';
          if (!isNormal) {
            const lesson = module.lessons[0];
            return (
              <div key={module.module_id} className="border-b last:border-b-0" style={{borderColor:'#EEF0F3'}}>
                <div className="px-4 pt-3 pb-1 text-[10px] font-black uppercase tracking-[.12em]" style={{color:'#BF8813'}}>{sectionLabel(module)}</div>
                {lesson ? renderLessonButton(lesson, module) : <div className="px-6 pb-3 text-xs text-slate-400">{module.title}</div>}
                {type === 'final_exam' && finalUnlocked && (
                  <button onClick={() => isOnline && onGoFinal()} disabled={!isOnline} className="mb-3 ml-6 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-white disabled:opacity-40" style={{background:'#BF8813'}}>
                    <Trophy size={14}/>Commencer l’évaluation finale
                  </button>
                )}
              </div>
            );
          }
          const realLessons = module.lessons.filter(l => (l.stage_type || 'lesson') === 'lesson');
          return (
            <div key={module.module_id}>
              <button onClick={() => toggle(module.module_id)} className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-gray-100 transition-colors" style={{ opacity: module.is_unlocked ? 1 : 0.45 }}>
                <span className="flex-1">
                  <span className="block text-[10px] font-black uppercase tracking-[.12em]" style={{color:'#BF8813'}}>{sectionLabel(module)}</span>
                  <span className="block text-xs font-bold" style={{color:'#002050'}}>{module.title}</span>
                  <span className="block text-[10px] text-slate-400">{realLessons.length} leçon{realLessons.length > 1 ? 's' : ''}</span>
                </span>
                {open.has(module.module_id) ? <ChevronDown size={14} style={{ color: '#9CA3AF' }} /> : <ChevronRight size={14} style={{ color: '#9CA3AF' }} />}
              </button>
              {open.has(module.module_id) && (
                <div>
                  {module.lessons.map(lesson => renderLessonButton(lesson, module))}
                  {module.is_unlocked && module.exam_required !== false && (
                    <button onClick={() => isOnline && module.exam_unlocked && onGoExam(module.module_id)} disabled={!isOnline || !module.exam_unlocked} className="w-full flex items-center gap-2.5 pl-6 pr-4 py-2 text-left hover:bg-gray-50 transition-colors" style={{ opacity: isOnline && module.exam_unlocked ? 1 : 0.4, cursor: isOnline && module.exam_unlocked ? 'pointer' : 'default' }}>
                      <ClipboardList size={14} style={{ color: module.exam_passed ? '#1E7A52' : '#BF8813', flexShrink: 0 }} />
                      <span className="text-xs font-semibold" style={{ color: module.exam_passed ? '#1E7A52' : '#BF8813' }}>
                        {module.exam_passed ? `Évaluation du module ✓ (${module.exam_score}%)` : isOnline ? 'Évaluation du module' : 'Évaluation disponible en ligne'}
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

      </div>
    </div>
  );
}

// ── CPD Bar ───────────────────────────────────────────────────────────────────
function CpdBar({ required, spent, reached, isActive, assessmentPassed, isCompleted }: {
  required: number; spent: number; reached: boolean; isActive: boolean;
  assessmentPassed: boolean; isCompleted: boolean;
}) {
  if (isCompleted || assessmentPassed) {
    return <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ backgroundColor: 'rgba(30,122,82,0.08)' }}>
      <CheckCircle size={14} style={{ color: '#1E7A52' }} />
      <span className="text-xs font-semibold" style={{ color: '#1E7A52' }}>Leçon complétée</span>
    </div>;
  }
  if (reached) {
    return <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ backgroundColor: '#FEF3C7' }}>
      <ClipboardList size={14} style={{ color: '#D97706' }} />
      <span className="text-xs font-semibold" style={{ color: '#92400E' }}>Temps pédagogique atteint — complétez l’évaluation ci-dessus</span>
    </div>;
  }
  if (required === 0) return null;
  const pct = Math.min(100, Math.round((spent / required) * 100));
  return (
    <div className="flex items-center gap-3">
      {!isActive && <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#FEF3C7', color: '#D97706' }}>En pause</span>}
      <div className="w-24 rounded-full overflow-hidden" style={{ height: 6, backgroundColor: '#E4E7EC' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: '#002050' }} />
      </div>
      <span className="text-xs" style={{ color: '#6B7280' }}>{fmtTime(Math.max(0, required - spent))} restant</span>
    </div>
  );
}

function CourseInfoView({ info, modules, progressPct, preview, previewMode, onStart, onSelectLesson }: {
  info: CourseInfoPayload | null; modules: ModuleItem[]; progressPct: number; preview: boolean; previewMode?: string | null;
  onStart: () => void; onSelectLesson: (id: string) => void;
}) {
  const course = info?.course || {};
  const creator = info?.creator || {};
  const [aboutOpen, setAboutOpen] = useState(false);
  const totalLessons = modules.reduce((sum, mod) => sum + mod.lessons.filter(l => (l.stage_type || 'lesson') === 'lesson').length, 0);
  const totalModules = modules.filter(mod => (mod.section_type || (mod.is_intro ? 'introduction' : mod.is_conclusion ? 'conclusion' : mod.is_final_exam ? 'final_exam' : 'module')) === 'module').length;
  const duration = Number(course.total_duration_seconds || 0);
  const durationLabel = duration > 0
    ? duration >= 3600 ? `${Math.floor(duration / 3600)} h ${Math.round((duration % 3600) / 60)} min` : `${Math.max(1, Math.round(duration / 60))} min`
    : null;
  const creatorName = String(creator.full_name || creator.school_name || 'Omnia Global Academy');
  const creatorRole = String(creator.expertise_domain || (creator.school_name ? 'Structure de formation' : course.creator_type === 'plateforme' ? 'Équipe pédagogique Omnia' : 'Créateur de la formation'));
  const avatar = String(creator.avatar_url || creator.logo_url || '');
  const initials = creatorName.split(/\s+/).filter(Boolean).slice(0, 2).map((part:string) => part[0]?.toUpperCase() || '').join('') || 'OG';
  const description = String(course.long_description || '');
  const longDescription = description.length > 720;
  const visibleDescription = !longDescription || aboutOpen ? description : `${description.slice(0, 720).trim()}…`;
  const previewLabel = previewMode === 'admin' ? 'Administration Omnia' : 'Apprenant après achat';

  const stageLabel = (mod: ModuleItem, index: number) => {
    const type = mod.section_type || (mod.is_intro ? 'introduction' : mod.is_conclusion ? 'conclusion' : mod.is_final_exam ? 'final_exam' : 'module');
    if (type === 'introduction') return 'Introduction';
    if (type === 'conclusion') return 'Conclusion';
    if (type === 'final_exam') return 'Examen final';
    return `Module ${Math.max(1, modules.slice(0, index + 1).filter(item => (item.section_type || (item.is_intro ? 'introduction' : item.is_conclusion ? 'conclusion' : item.is_final_exam ? 'final_exam' : 'module')) === 'module').length)}`;
  };

  return (
    <div className="min-h-screen pb-14" style={{ background: '#F5F7FB', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {preview && (
        <div className="border-b" style={{ background: '#FFFBEB', borderColor: '#F4D788' }}>
          <div className="mx-auto flex max-w-7xl items-start gap-3 px-4 py-3 text-sm sm:px-6">
            <ShieldCheck size={17} className="mt-0.5 shrink-0" style={{ color: '#9A6D0F' }} />
            <div><strong style={{ color: '#7A560C' }}>Prévisualisation {previewLabel}</strong><span className="text-amber-800"> — rendu réel de la formation, sans inscription, progression, tentative ni certificat enregistrés.</span></div>
          </div>
        </div>
      )}

      <section style={{ background: 'linear-gradient(135deg,#00183F 0%,#002050 58%,#123C6A 100%)' }}>
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-[minmax(0,1fr)_minmax(390px,520px)] lg:items-center lg:py-14">
          <div className="min-w-0 text-white">
            <div className="mb-4 flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-[.12em]">
              {course.category && <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">{String(course.category)}</span>}
              {course.level && <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">{String(course.level)}</span>}
              {course.language && <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">{String(course.language).toUpperCase()}</span>}
            </div>
            <p className="text-xs font-black uppercase tracking-[.18em]" style={{ color: '#E5BE5B' }}>Info formation</p>
            <h1 className="mt-3 max-w-4xl text-3xl font-black leading-tight tracking-[-.035em] sm:text-4xl lg:text-[46px]">{String(course.title || 'Formation')}</h1>
            {course.short_description && <p className="mt-4 max-w-3xl text-base leading-7 text-slate-200 sm:text-lg">{String(course.short_description)}</p>}
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-3 text-sm text-slate-200">
              {durationLabel && <span className="inline-flex items-center gap-2"><Clock3 size={16} style={{ color: '#E5BE5B' }} />{durationLabel}</span>}
              <span className="inline-flex items-center gap-2"><Layers3 size={16} style={{ color: '#E5BE5B' }} />{totalModules} module{totalModules > 1 ? 's' : ''}</span>
              <span className="inline-flex items-center gap-2"><BookOpen size={16} style={{ color: '#E5BE5B' }} />{totalLessons} leçon{totalLessons > 1 ? 's' : ''}</span>
            </div>
            <div className="mt-7 flex items-center gap-3">
              {course.creator_type === 'plateforme' || creatorName.toLowerCase().includes('omnia global academy') ? <img src="/omnia-sidebar-logo.png" alt="Omnia Global Academy" className="h-11 w-11 rounded-xl border border-white/30 bg-white object-contain p-1" /> : avatar ? <img src={avatar} alt="" className="h-11 w-11 rounded-full border-2 border-white/30 object-cover" /> : <span className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-white/20 bg-white/10 text-sm font-black">{initials}</span>}
              <div><p className="text-xs text-slate-300">Créé par</p><p className="font-bold text-white">{creatorName}</p></div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[24px] bg-white shadow-[0_24px_70px_rgba(0,0,0,.28)]">
            <div className="aspect-video bg-slate-100">
              {course.cover_image_url ? <img src={String(course.cover_image_url)} alt={`Couverture — ${String(course.title || 'formation')}`} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><BookOpen size={44} style={{ color: '#BF8813' }} /></div>}
            </div>
            <div className="p-5 sm:p-6">
              {!preview && progressPct > 0 && <div className="mb-4"><div className="mb-1.5 flex justify-between text-xs font-semibold text-slate-500"><span>Votre progression</span><span>{progressPct}%</span></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width:`${progressPct}%`, background:'#1E7A52' }}/></div></div>}
              <button onClick={onStart} className="w-full rounded-xl px-4 py-3.5 text-sm font-black text-white shadow-sm transition hover:opacity-90" style={{ background:'#002050' }}>{preview ? 'Entrer dans la formation' : progressPct > 0 ? 'Continuer la formation' : 'Commencer la formation'}</button>
              <p className="mt-3 text-center text-xs text-slate-400">La formation commence par l’Introduction, puis suit l’ordre pédagogique défini.</p>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <div className="space-y-7">
            {description && <section className="rounded-[22px] border bg-white p-5 sm:p-7" style={{ borderColor:'#E4E7EC' }}><p className="text-xs font-black uppercase tracking-[.15em]" style={{ color:'#BF8813' }}>Présentation</p><h2 className="mt-1 text-2xl font-black tracking-[-.02em]" style={{ color:'#002050' }}>À propos de cette formation</h2><div className="mt-4 whitespace-pre-line text-sm leading-7 text-slate-600">{visibleDescription}</div>{longDescription&&<button type="button" onClick={()=>setAboutOpen(value=>!value)} className="mt-3 text-sm font-bold" style={{color:'#002050'}}>{aboutOpen?'Réduire':'Voir plus'}</button>}</section>}

            {Array.isArray(course.objectives) && course.objectives.length > 0 && <section className="rounded-[22px] border bg-white p-5 sm:p-7" style={{ borderColor:'#E4E7EC' }}><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{background:'#ECFDF5',color:'#1E7A52'}}><Target size={19}/></span><div><p className="text-xs font-black uppercase tracking-[.15em]" style={{color:'#1E7A52'}}>Objectifs</p><h2 className="text-xl font-black" style={{color:'#002050'}}>Ce que vous saurez faire</h2></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{course.objectives.map((item:any,index:number)=><div key={index} className="flex items-start gap-3 rounded-xl bg-slate-50 p-3.5"><CheckCircle size={17} className="mt-0.5 shrink-0" style={{color:'#1E7A52'}}/><span className="text-sm leading-6 text-slate-700">{String(item)}</span></div>)}</div></section>}

            <section className="rounded-[22px] border bg-white p-5 sm:p-7" style={{ borderColor:'#E4E7EC' }}>
              <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.15em]" style={{ color:'#BF8813' }}>Programme</p><h2 className="mt-1 text-2xl font-black tracking-[-.02em]" style={{ color:'#002050' }}>Contenu de la formation</h2></div><p className="text-xs font-semibold text-slate-400">{totalModules} module{totalModules>1?'s':''} · {totalLessons} leçon{totalLessons>1?'s':''}</p></div>
              <div className="mt-5 space-y-3">{modules.map((mod, mi) => <details key={mod.module_id} open={mi < 2 || !!mod.is_intro} className="group overflow-hidden rounded-xl border" style={{ borderColor:'#E4E7EC' }}>
                <summary className="flex cursor-pointer list-none items-center gap-3 bg-slate-50 px-4 py-3.5"><span className="rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-[.08em]" style={{background:'#FFF7E1',color:'#8A650F'}}>{stageLabel(mod,mi)}</span><span className="min-w-0 flex-1 font-bold" style={{color:'#002050'}}>{mod.title}</span><span className="text-xs text-slate-400">{mod.lessons.filter(l => (l.stage_type || 'lesson') === 'lesson').length} leçon{mod.lessons.filter(l => (l.stage_type || 'lesson') === 'lesson').length>1?'s':''}</span><ChevronDown size={16} className="text-slate-400 transition group-open:rotate-180"/></summary>
                {mod.description&&<p className="border-t px-4 py-3 text-xs leading-5 text-slate-500" style={{borderColor:'#EEF1F5'}}>{mod.description}</p>}
                <div className="divide-y" style={{borderColor:'#EEF1F5'}}>{mod.lessons.map((lesson, li) => <button key={lesson.lesson_id} type="button" onClick={() => (preview || lesson.is_unlocked !== false) ? onSelectLesson(lesson.lesson_id) : undefined} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45" disabled={!preview && lesson.is_unlocked === false}><span className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 px-2 text-[10px] font-black" style={{color:'#002050'}}>{lesson.stage_type === 'module_presentation' ? 'Intro' : lesson.stage_type === 'module_summary' ? 'Synth.' : lesson.stage_type === 'introduction' ? 'Intro' : lesson.stage_type === 'conclusion' ? 'Fin' : lesson.stage_type === 'final_exam' ? 'Exam' : mod.lessons.filter((candidate, idx) => idx <= li && (candidate.stage_type || 'lesson') === 'lesson').length}</span><span className="min-w-0 flex-1 text-sm font-medium text-slate-700">{lesson.title}</span>{lesson.duration_seconds > 0 && <span className="text-xs text-slate-400">{Math.max(1,Math.round(lesson.duration_seconds/60))} min</span>}{!preview&&lesson.is_unlocked===false&&<span className="text-xs text-slate-400">Verrouillée</span>}</button>)}</div>
              </details>)}</div>
            </section>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-24">
            <section className="rounded-[22px] border bg-white p-5" style={{borderColor:'#E4E7EC'}}><p className="text-xs font-black uppercase tracking-[.15em]" style={{color:'#BF8813'}}>Votre formateur</p><div className="mt-4 flex items-center gap-3">{course.creator_type === 'plateforme' || creatorName.toLowerCase().includes('omnia global academy') ? <img src="/omnia-sidebar-logo.png" alt="Omnia Global Academy" className="h-14 w-14 rounded-xl bg-white object-contain p-1"/> : avatar?<img src={avatar} alt="" className="h-14 w-14 rounded-full object-cover"/>:<span className="flex h-14 w-14 items-center justify-center rounded-full text-sm font-black text-white" style={{background:'#002050'}}>{initials}</span>}<div className="min-w-0"><p className="truncate font-black" style={{color:'#002050'}}>{creatorName}</p><p className="mt-0.5 text-xs font-semibold" style={{color:'#BF8813'}}>{creatorRole}</p></div></div>{creator.bio&&<p className="mt-4 text-sm leading-6 text-slate-500">{String(creator.bio)}</p>}</section>
            <section className="rounded-[22px] border p-5" style={{borderColor:'#DDE5EF',background:'#F8FAFC'}}><div className="flex items-start gap-3"><Sparkles size={18} className="mt-0.5 shrink-0" style={{color:'#BF8813'}}/><div><p className="font-bold" style={{color:'#002050'}}>Parcours clair</p><p className="mt-1 text-xs leading-5 text-slate-500">Consultez d’abord les informations et le programme. Le bouton principal vous fait ensuite entrer dans l’Introduction puis dans les modules.</p></div></div></section>
          </aside>
        </div>
      </main>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function CoursLecteur() {
  const { id: courseId, lessonId: routeLessonId } = useParams<{ id: string; lessonId?: string }>();
  const navigate = useNavigate();
  const { user, sessionToken, loading: authLoading } = useAuth();
  const previewMode = new URLSearchParams(window.location.search).get('preview');
  const isPreview = previewMode === 'admin' || previewMode === 'learner';
  const previewQuery = isPreview ? `&preview=${previewMode}` : '';
  const previewRouteQuery = isPreview ? `?preview=${previewMode}` : '';
  const network = useOmniaNetworkStatus();
  const isOnline = network.connected;

  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [finalUnlocked, setFinalUnlocked] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(routeLessonId ?? null);
  const [readerStarted, setReaderStarted] = useState(Boolean(routeLessonId));
  const [courseInfo, setCourseInfo] = useState<CourseInfoPayload | null>(null);
  const [lessonData, setLessonData] = useState<LessonDataPayload | null>(null);
  const [progressLoading, setProgressLoading] = useState(true);
  const [progressError, setProgressError] = useState('');
  const [courseInfoError, setCourseInfoError] = useState('');
  const [lessonLoading, setLessonLoading] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [externalVisited, setExternalVisited] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [programOpen, setProgramOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiMode, setAiMode] = useState('question');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const aiBottomRef = useRef<HTMLDivElement>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [dataSaver, setDataSaver] = useState(() => localStorage.getItem('omnia_data_saver') === '1');
  const [resilientMessage, setResilientMessage] = useState('');
  const [resilientBusy, setResilientBusy] = useState(false);
  const [usingLocalCopy, setUsingLocalCopy] = useState(false);
  const [usingLocalProgram, setUsingLocalProgram] = useState(false);
  const [offlineLessonIds, setOfflineLessonIds] = useState<string[]>([]);
  const [appActive, setAppActive] = useState(true);
  const videoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const offlineLessonSet = useMemo(() => new Set(offlineLessonIds), [offlineLessonIds]);

  useEffect(() => {
    localStorage.setItem('omnia_data_saver', dataSaver ? '1' : '0');
  }, [dataSaver]);

  useEffect(() => {
    const updateAppState = (event: Event) => {
      const detail = (event as CustomEvent<{ isActive?: boolean }>).detail;
      setAppActive(detail?.isActive !== false);
    };
    window.addEventListener('omnia:app-state', updateAppState);
    return () => window.removeEventListener('omnia:app-state', updateAppState);
  }, []);

  useEffect(() => {
    if (!user?.id || !courseId) return;
    listResilientLessonIds({ userId: user.id, courseId })
      .then(setOfflineLessonIds)
      .catch(() => setOfflineLessonIds([]));
  }, [user?.id, courseId, resilientMessage]);

  useEffect(() => {
    if (!authLoading && !user) navigate('/connexion');
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!courseId || !sessionToken) return;
    let cancelled = false;
    setCourseInfoError('');
    const suffix = isPreview ? `&preview=${previewMode}` : '';
    (async () => {
      try {
        const response = await fetch(`${ENDPOINTS.courseDetail}?id=${courseId}${suffix}`, { headers: { Authorization: `Bearer ${sessionToken}` } });
        const data = await response.json();
        if (!response.ok || !data?.course) throw new Error(data?.message || data?.error || 'Informations de formation indisponibles.');
        if (!cancelled) {
          setCourseInfo(data);
          if (isPreview) {
            const fallback = normalizeReaderModules(previewModulesFromCourseInfo(data));
            if (fallback.length) {
              setModules(current => current.length ? current : fallback);
              setFinalUnlocked(true);
            }
          }
        }
      } catch (error) {
        if (!cancelled) setCourseInfoError(error instanceof Error ? error.message : 'Informations de formation indisponibles.');
      }
    })();
    return () => { cancelled = true; };
  }, [courseId, sessionToken, isPreview, previewMode]);

  const applyProgressSnapshot = useCallback((snapshot: CourseProgressSnapshot) => {
    setModules(normalizeReaderModules(snapshot.modules));
    setFinalUnlocked(snapshot.finalUnlocked);
    setProgressPct(snapshot.progressPct);
  }, []);

  const loadProgress = useCallback(async () => {
    if (!sessionToken || !courseId || !user?.id) return;

    try {
      if (!isOnline) throw new Error('offline');
      const response = await fetch(`${ENDPOINTS.courseProgress}?course_id=${courseId}${previewQuery}`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        const message = data.message || data.error || 'Progression indisponible';
        if (isPreview) {
          setProgressError(message);
          const fallback = normalizeReaderModules(previewModulesFromCourseInfo(courseInfo));
          if (fallback.length) {
            setModules(fallback);
            setFinalUnlocked(true);
            setProgressPct(0);
          }
          return;
        }
        if (response.status === 401) { navigate('/connexion'); return; }
        if ([403, 404].includes(response.status)) { navigate(`/cours/${courseId}`); return; }
        throw new Error(message);
      }
      setProgressError('');

      const snapshot: CourseProgressSnapshot = {
        modules: normalizeReaderModules(data.modules ?? []),
        finalUnlocked: data.final_validation_unlocked ?? false,
        progressPct: data.progress?.percent ?? 0,
        savedAt: new Date().toISOString(),
      };
      applyProgressSnapshot(snapshot);
      setUsingLocalProgram(false);
      if (!isPreview) {
        await saveResilientCourseProgress({
          userId: user.id,
          courseId,
          expiresAt: courseProgressExpiry(),
          value: snapshot,
        });
      }
    } catch (error) {
      if (isPreview) {
        setProgressError(error instanceof Error ? error.message : 'Le service de progression de prévisualisation est indisponible.');
        const fallback = normalizeReaderModules(previewModulesFromCourseInfo(courseInfo));
        if (fallback.length) {
          setModules(fallback);
          setFinalUnlocked(true);
          setProgressPct(0);
        }
        return;
      }
      const local = await loadResilientCourseProgress<CourseProgressSnapshot>({ userId: user.id, courseId }).catch(() => null);
      if (local) {
        applyProgressSnapshot(local);
        setUsingLocalProgram(true);
      } else if (!isOnline) {
        setResilientMessage('Le programme de cette formation n’est pas encore disponible hors connexion sur cet appareil.');
      }
    }
  }, [sessionToken, courseId, user?.id, isOnline, navigate, applyProgressSnapshot, isPreview, previewQuery, courseInfo]);

  const syncOfflineProgress = useCallback(async () => {
    if (isPreview || !isOnline || !appActive || !user?.id || !courseId || !sessionToken) return;
    const pending = await listOfflineProgress({ userId: user.id, courseId }).catch(() => []);
    if (pending.length === 0) return;

    let synchronized = 0;
    for (const item of pending) {
      try {
        const response = await fetch(ENDPOINTS.videoSignedUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
          body: JSON.stringify({
            action: 'offline_sync',
            course_id: item.courseId,
            lesson_id: item.lessonId,
            device_id: getResilientDeviceId(),
            seconds: item.seconds,
          }),
        });
        if (!response.ok) continue;
        await acknowledgeOfflineSeconds({
          userId: item.userId,
          courseId: item.courseId,
          lessonId: item.lessonId,
          seconds: item.seconds,
        });
        synchronized += 1;
      } catch {
        // Cette entrée reste en attente et sera retentée au prochain retour réseau.
      }
    }

    if (synchronized > 0) {
      setResilientMessage('Progression hors connexion synchronisée.');
      await loadProgress();
    }
  }, [isOnline, appActive, user?.id, courseId, sessionToken, loadProgress, isPreview, previewQuery]);

  useEffect(() => {
    void syncOfflineProgress();
  }, [syncOfflineProgress]);


  useEffect(() => {
    if (!sessionToken) return;
    setProgressLoading(true);
    loadProgress().finally(() => setProgressLoading(false));
  }, [sessionToken, loadProgress]);

  useEffect(() => {
    if (!readerStarted || modules.length === 0 || currentLessonId) return;
    const first = routeLessonId ?? (isOnline
      ? findFirstIncomplete(modules)
      : findFirstOfflineLesson(modules, offlineLessonSet));
    if (first) setCurrentLessonId(first);
  }, [modules, routeLessonId, currentLessonId, isOnline, offlineLessonSet, readerStarted]);

  useEffect(() => {
    if (!currentLessonId || !courseId || !sessionToken || !user?.id) return;
    let cancelled = false;
    let accessDenied = false;
    setLessonLoading(true);
    setShowSummary(false);
    setVideoUrl(null);
    setExternalVisited(false);
    setUsingLocalCopy(false);
    setResilientMessage('');
    if (videoTimerRef.current) clearInterval(videoTimerRef.current);

    (async () => {
      try {
        if (!isOnline) throw new Error('offline');
        const response = await fetch(`${ENDPOINTS.lessonContent}?lesson_id=${currentLessonId}&course_id=${courseId}${previewQuery}`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        const data = await response.json();
        if (!response.ok || data.error) {
          accessDenied = [401, 403, 404].includes(response.status);
          throw new Error(data.message || data.error || 'Chargement impossible');
        }
        if (cancelled) return;
        if (!data?.lesson) throw new Error('La leçon renvoyée est incomplète.');
        const normalizedLessonData = { ...data, progress: data.progress || { time_spent_seconds: 0, quiz_passed: true, is_completed: false }, blocks: Array.isArray(data.blocks) ? data.blocks : [], training: data.training || { required_count: 0, passed_count: 0, passed: true } };
        setLessonData(normalizedLessonData);
        if (normalizedLessonData.lesson.content_type === 'video' && !dataSaver) signVideo(currentLessonId);
      } catch (error) {
        if (accessDenied && isOnline) {
          if (!cancelled) {
            setLessonData(null);
            setResilientMessage(error instanceof Error ? error.message : 'Accès à cette leçon refusé.');
          }
          return;
        }

        const local = await loadResilientLesson<LessonDataPayload>({
          userId: user.id,
          courseId,
          lessonId: currentLessonId,
        });
        if (cancelled) return;
        if (local) {
          setLessonData(local);
          setUsingLocalCopy(true);
          setResilientMessage('Copie locale sécurisée utilisée. La progression sera synchronisée au retour de la connexion.');
        } else {
          setLessonData(null);
          setResilientMessage('Cette leçon n’est pas disponible hors connexion sur cet appareil.');
        }
      } finally {
        if (!cancelled) setLessonLoading(false);
      }
    })();

    return () => { cancelled = true; };
  // signVideo est stable pour le cours et le jeton courants.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLessonId, courseId, sessionToken, user?.id, dataSaver, isOnline, isPreview, previewQuery]);

  const signVideo = useCallback((lessonId: string) => {
    if (!courseId || !sessionToken || !isOnline) return;
    const requestSignedUrl = async () => {
      try {
        const response = await fetch(ENDPOINTS.videoSignedUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
          body: JSON.stringify({ lesson_id: lessonId, course_id: courseId, preview: isPreview ? previewMode : undefined }),
        });
        const data = await response.json();
        if (response.ok && data.url) setVideoUrl(data.url);
      } catch {
        // Le lecteur affichera le contenu texte disponible pendant la coupure.
      }
    };
    void requestSignedUrl();
    if (videoTimerRef.current) clearInterval(videoTimerRef.current);
    videoTimerRef.current = setInterval(requestSignedUrl, 55_000);
  }, [courseId, sessionToken, isOnline, isPreview, previewMode]);

  useEffect(() => {
    if (!isOnline) {
      setVideoUrl(null);
      if (videoTimerRef.current) clearInterval(videoTimerRef.current);
    }
    return () => {
      if (videoTimerRef.current) clearInterval(videoTimerRef.current);
    };
  }, [isOnline]);

  const { timeSpent, cpdTimeReached, isActive } = useCpdTimer({
    lessonId: isPreview ? null : currentLessonId, courseId: isPreview ? null : (courseId ?? null),
    requiredSeconds: lessonData?.required_seconds ?? 0,
    initialSpent: lessonData?.progress?.time_spent_seconds ?? 0,
    sessionToken,
    onTimeReached: () => {
      if (isPreview || !isOnline || !currentLessonId || !courseId || !sessionToken) return;
      fetch(`${ENDPOINTS.lessonContent}?lesson_id=${currentLessonId}&course_id=${courseId}${previewQuery}`, { headers: { Authorization: `Bearer ${sessionToken}` } })
        .then(r => r.json()).then(d => { if (!d.error) setLessonData(d); });
    },
  });

  useEffect(() => {
    if (isPreview || isOnline || !isActive || !appActive || !user?.id || !courseId || !currentLessonId) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) {
        queueOfflineSeconds({ userId: user.id, courseId, lessonId: currentLessonId, seconds: 30 }).catch(() => undefined);
      }
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [isOnline, isActive, appActive, user?.id, courseId, currentLessonId]);

  const goToLesson = (id: string) => { setReaderStarted(true); setCurrentLessonId(id); navigate(`/cours/${courseId}/apprendre/${id}${previewRouteQuery}`, { replace: true }); };

  const handleNext = () => {
    const moduleNow = modules.find(m => m.lessons.some(l => l.lesson_id === currentLessonId));
    const trainingPassed = !lessonData?.training?.required_count || lessonData.training.passed === true;
    const moduleExamPassed = lesson?.stage_type !== 'module_summary' || !moduleNow?.exam_required || moduleNow.exam_passed === true;
    const canAdvance = isPreview || (effectiveCpd && trainingPassed && quizPassed && moduleExamPassed);
    if (!canAdvance) {
      const reason = !effectiveCpd ? `Temps pédagogique requis : ${fmtTime(Math.max(0, Number(lessonData?.required_seconds || 0) - timeSpent))} restant.` : !trainingPassed ? 'Terminez les entraînements obligatoires avant de continuer.' : !quizPassed ? 'Réussissez l’évaluation obligatoire de cette leçon.' : 'Réussissez l’évaluation obligatoire du module avant de continuer.';
      setResilientMessage(reason);
      return;
    }
    const nextId = lessonData?.next_lesson_id ?? findNext(modules, currentLessonId ?? '');
    if (nextId) goToLesson(nextId);
    setShowSummary(false);
  };

  // Reset AI conversation when lesson changes
  useEffect(() => {
    setAiMessages([{
      id: 'welcome',
      role: 'assistant',
      content: `Bonjour ! Je suis votre assistant pédagogique pour cette formation. Posez-moi vos questions sur le contenu de ce cours !`,
    }]);
    setAiError('');
  }, [currentLessonId]);

  useEffect(() => {
    if (aiBottomRef.current) aiBottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages]);

  // DRM: block DevTools keyboard shortcuts and right-click on video area
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        (e.ctrlKey && e.key === 'u') ||
        (e.ctrlKey && e.key === 'U')
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('keydown', handleKey, true);
    return () => document.removeEventListener('keydown', handleKey, true);
  }, []);

  // DRM: pause video iframe when tab loses visibility
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && videoContainerRef.current) {
        const iframe = videoContainerRef.current.querySelector('iframe');
        if (iframe?.contentWindow) {
          try {
            iframe.contentWindow.postMessage('{"pause":true}', '*');
          } catch { /* cross-origin may block */ }
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => {
    if (appActive || !videoContainerRef.current) return;
    const iframe = videoContainerRef.current.querySelector('iframe');
    try {
      iframe?.contentWindow?.postMessage('{"pause":true}', '*');
    } catch {
      // Le lecteur tiers peut refuser les messages cross-origin.
    }
  }, [appActive]);

  const handleSendAI = useCallback(async (requestedMode?: string, suggestedPrompt?: string) => {
    const message = (suggestedPrompt ?? aiInput).trim();
    const mode = requestedMode ?? aiMode;
    if (!message || aiLoading || !courseId || !sessionToken) return;
    if (!isOnline) {
      setAiError('L’assistant IA nécessite une connexion internet. Votre leçon locale reste disponible.');
      return;
    }
    const userMsg: AiMessage = { id: Date.now().toString(), role: 'user', content: message };
    setAiMessages(prev => [...prev, userMsg]);
    setAiInput('');
    setAiLoading(true);
    setAiError('');
    try {
      const history = aiMessages
        .filter(m => m.id !== 'welcome')
        .slice(-6)
        .map(m => ({ role: m.role, content: m.content }));
      const res = await fetch(ENDPOINTS.ragChat, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ course_id: courseId, message: userMsg.content, mode, conversation_history: history }),
      });
      const d = await res.json();
      if (res.ok && d.reply) {
        setAiMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: d.reply }]);
      } else {
        setAiError(d.message || 'Désolé, une erreur est survenue. Réessayez dans un instant.');
      }
    } catch {
      setAiError('Erreur réseau. Réessayez dans un instant.');
    } finally {
      setAiLoading(false);
    }
  }, [aiInput, aiMode, aiLoading, courseId, sessionToken, aiMessages, isOnline]);

  const saveCurrentLessonForResilientAccess = useCallback(async () => {
    if (!user?.id || !courseId || !currentLessonId || !sessionToken || !lessonData) return;
    if (!isOnline) {
      setResilientMessage('Reconnectez-vous pour renouveler l’autorisation hors connexion de cette leçon.');
      return;
    }
    setResilientBusy(true); setResilientMessage('');
    try {
      const response = await fetch(ENDPOINTS.videoSignedUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ action: 'offline_authorize', course_id: courseId, lesson_id: currentLessonId, device_id: getResilientDeviceId() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error || 'Accès résilient refusé.');
      const safeCopy = {
        ...lessonData,
        lesson: { ...lessonData.lesson, video_url: undefined, audio_url: undefined, cloudflare_stream_uid: undefined },
        blocks: (lessonData.blocks ?? []).map((block: Record<string, unknown>) => {
          const blockType = String(block.block_type ?? '');
          const onlineOnly = ['video', 'audio', 'scorm', 'download', 'pdf', 'word', 'excel', 'embed'].includes(blockType);
          const content = block.content_json && typeof block.content_json === 'object'
            ? block.content_json as Record<string, unknown>
            : {};
          return {
            ...block,
            file_url: onlineOnly ? undefined : block.file_url,
            content_json: onlineOnly ? { ...content, url: undefined, src: undefined } : content,
          };
        }),
      };
      await saveResilientLesson({ userId: user.id, courseId, lessonId: currentLessonId, expiresAt: data.expires_at, value: safeCopy });
      setOfflineLessonIds(await listResilientLessonIds({ userId: user.id, courseId }));
      setResilientMessage(`Leçon protégée sur cet appareil jusqu’au ${new Date(data.expires_at).toLocaleDateString('fr-FR')}.`);
    } catch (error) {
      setResilientMessage(error instanceof Error ? error.message : 'Enregistrement local impossible.');
    } finally { setResilientBusy(false); }
  }, [user?.id, courseId, currentLessonId, sessionToken, lessonData, isOnline]);

  const lesson = lessonData?.lesson;
  const prog = lessonData?.progress;
  const isCompleted = prog?.is_completed ?? false;
  const quizPassed = prog?.quiz_passed ?? false;
  const effectiveCpd = cpdTimeReached || (lessonData?.cpd_time_reached ?? false);
  const submitTrainingResult = useCallback(async (blockId: string, score: number, answer: any, _passedClient: boolean) => {
    if (isPreview || !isOnline || !currentLessonId || !courseId || !sessionToken) return;
    try {
      const response = await fetch(ENDPOINTS.lessonContent, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ action: 'training_submit', course_id: courseId, lesson_id: currentLessonId, block_id: blockId, score, answer }),
      });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.message || data.error || 'Enregistrement de l’entraînement impossible');
      const refreshed = await fetch(`${ENDPOINTS.lessonContent}?lesson_id=${currentLessonId}&course_id=${courseId}${previewQuery}`, { headers: { Authorization: `Bearer ${sessionToken}` } });
      const refreshedData = await refreshed.json();
      if (refreshed.ok && !refreshedData.error) setLessonData(refreshedData);
      await loadProgress();
    } catch (error) {
      console.error('training_submit', error);
      setResilientMessage(error instanceof Error ? error.message : 'Résultat d’entraînement non synchronisé.');
    }
  }, [isOnline, currentLessonId, courseId, sessionToken, loadProgress, isPreview, previewQuery]);

  const submitTrainingFile = useCallback(async (blockId: string, file: File) => {
    if (isPreview || !isOnline || !currentLessonId || !courseId || !sessionToken) return false;
    try {
      const preparedResponse = await fetch(ENDPOINTS.lessonContent, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ action: 'prepare_training_upload', course_id: courseId, lesson_id: currentLessonId, block_id: blockId, file_name: file.name, size_bytes: file.size, mime_type: file.type }),
      });
      const prepared = await preparedResponse.json();
      if (!preparedResponse.ok || !prepared?.signedUrl || !prepared?.path) throw new Error(prepared?.message || prepared?.error || 'Préparation du dépôt impossible');
      const uploadResponse = await fetch(prepared.signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
      if (!uploadResponse.ok) throw new Error('Téléversement du fichier impossible');
      const answer = { files: [{ bucket_name: prepared.bucket || 'assessment-submissions', storage_path: prepared.path, file_name: file.name, mime_type: file.type || null, size_bytes: file.size }] };
      const resultResponse = await fetch(ENDPOINTS.lessonContent, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ action: 'training_submit', course_id: courseId, lesson_id: currentLessonId, block_id: blockId, score: 100, answer }),
      });
      const result = await resultResponse.json();
      if (!resultResponse.ok || result.error) throw new Error(result.message || result.error || 'Validation du dépôt impossible');
      const refreshed = await fetch(`${ENDPOINTS.lessonContent}?lesson_id=${currentLessonId}&course_id=${courseId}${previewQuery}`, { headers: { Authorization: `Bearer ${sessionToken}` } });
      const refreshedData = await refreshed.json();
      if (refreshed.ok && !refreshedData.error) setLessonData(refreshedData);
      await loadProgress();
      return true;
    } catch (error) {
      setResilientMessage(error instanceof Error ? error.message : 'Fichier non synchronisé.');
      return false;
    }
  }, [isPreview, isOnline, currentLessonId, courseId, sessionToken, previewQuery, loadProgress]);

  const saveBlockState = useCallback(async (blockId: string, state: Record<string, any>, completed: boolean) => {
    if (isPreview || !isOnline || !currentLessonId || !courseId || !sessionToken) return;
    try {
      await fetch(ENDPOINTS.lessonContent, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ action: 'block_state_save', course_id: courseId, lesson_id: currentLessonId, block_id: blockId, state, completed }),
      });
    } catch (error) { console.error('block_state_save', error); }
  }, [isOnline, currentLessonId, courseId, sessionToken, isPreview, previewQuery]);

  const learnerStateByBlock = useMemo(() => Object.fromEntries((lessonData?.block_states || []).map(item => [item.block_id, item.state_json || {}])), [lessonData?.block_states]);

  const currentMod = modules.find(m => m.lessons.some(l => l.lesson_id === currentLessonId));
  const orderedReaderLessons = modules.flatMap(m => m.lessons);
  const currentReaderIndex = orderedReaderLessons.findIndex(l => l.lesson_id === currentLessonId);
  const previousReaderLesson = currentReaderIndex > 0 ? orderedReaderLessons[currentReaderIndex - 1] : null;
  const nextReaderLesson = currentReaderIndex >= 0 && currentReaderIndex < orderedReaderLessons.length - 1 ? orderedReaderLessons[currentReaderIndex + 1] : null;

  if (progressLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
    </div>
  );

  if (isPreview && courseInfoError) return (
    <div className="min-h-screen bg-slate-50 px-4 py-10"><div className="mx-auto max-w-2xl rounded-2xl border bg-white p-6" style={{borderColor:'#FCA5A5'}}><div className="flex gap-3"><AlertCircle size={20} className="mt-0.5 shrink-0 text-red-600"/><div><h1 className="font-black text-[#002050]">Prévisualisation indisponible</h1><p className="mt-2 text-sm text-slate-600">{courseInfoError}</p><p className="mt-3 text-xs text-slate-500">La formation elle-même n’a pas pu être chargée. Le lecteur ne redirige plus vers une page publique qui masquerait cette erreur.</p></div></div></div></div>
  );

  if (!readerStarted) return <CourseInfoView info={courseInfo} modules={modules} progressPct={progressPct} preview={isPreview} previewMode={previewMode} onStart={() => { const first = modules.flatMap(m=>m.lessons).find(l=>l.stage_type==='introduction'||l.is_intro) || modules.flatMap(m=>m.lessons)[0]; if(first) goToLesson(first.lesson_id); else setReaderStarted(true); }} onSelectLesson={goToLesson} />;

  return (
    <div className="oga-course-reader-shell flex flex-col" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <header className="flex items-center gap-3 px-4 flex-shrink-0" style={{ backgroundColor: '#002050', height: 56 }}>
        <button
          onClick={() => { setReaderStarted(false); setCurrentLessonId(null); navigate(`/cours/${courseId}/apprendre${previewRouteQuery}`, { replace: true }); }}
          className="inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-white/10 transition-colors"
          title="Retour à Info formation"
          aria-label="Retour à Info formation"
        >
          <ArrowLeft size={18} style={{ color: '#FFFFFF' }} />
          <span className="hidden sm:inline text-xs font-semibold text-white">Info formation</span>
        </button>
        <button
          type="button"
          onClick={() => setProgramOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 hover:bg-white/10 transition-colors"
          aria-label="Ouvrir le programme de la formation"
          aria-expanded={programOpen}
        >
          <Menu size={18} className="text-white" />
          <span className="hidden sm:inline text-xs font-semibold text-white">Programme</span>
        </button>
        <div className="flex-1 flex items-center gap-3">
          <div className="flex-1 rounded-full overflow-hidden" style={{ height: 4, backgroundColor: 'rgba(255,255,255,0.15)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${progressPct}%`, backgroundColor: '#BF8813' }} />
          </div>
          <span className="text-xs font-semibold text-white">{progressPct}%</span>
        </div>
        <button onClick={() => setAiOpen(o => !o)}
          title={isOnline ? 'Ouvrir l’assistant IA' : 'L’assistant IA nécessite une connexion'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors"
          style={{ backgroundColor: aiOpen ? 'rgba(191,136,19,0.25)' : 'rgba(255,255,255,0.10)' }}>
          <Bot size={15} style={{ color: aiOpen ? '#BF8813' : 'rgba(255,255,255,0.75)' }} />
          <span className="text-xs font-semibold" style={{ color: aiOpen ? '#BF8813' : 'rgba(255,255,255,0.75)' }}>IA</span>
        </button>
        {user && (
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ backgroundColor: '#BF8813', color: '#FFFFFF' }}>
            {user.full_name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()}
          </div>
        )}
      </header>

      {/* Programme mobile */}
      {programOpen && (
        <div className="fixed inset-0 z-[120] md:hidden" role="dialog" aria-modal="true" aria-label="Programme de la formation">
          <button
            type="button"
            className="absolute inset-0 bg-black/55"
            onClick={() => setProgramOpen(false)}
            aria-label="Fermer le programme"
          />
          <aside className="absolute inset-y-0 left-0 flex w-[88vw] max-w-sm flex-col bg-white shadow-2xl">
            <div className="flex h-14 items-center justify-between border-b px-4" style={{ borderColor: '#E4E7EC' }}>
              <div>
                <p className="text-xs font-bold uppercase tracking-[.12em]" style={{ color: '#BF8813' }}>Formation</p>
                <h2 className="text-sm font-black" style={{ color: '#002050' }}>Programme et progression</h2>
              </div>
              <button
                type="button"
                onClick={() => setProgramOpen(false)}
                className="rounded-lg p-2 hover:bg-slate-100"
                aria-label="Fermer le programme"
              >
                <X size={19} style={{ color: '#002050' }} />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <CourseSidebar
                modules={modules}
                currentLessonId={currentLessonId}
                onSelectLesson={(lessonId) => {
                  setProgramOpen(false);
                  goToLesson(lessonId);
                }}
                onGoExam={(modId) => {
                  setProgramOpen(false);
                  navigate(`/cours/${courseId}/examen-module/${modId}${previewRouteQuery}`);
                }}
                onGoFinal={() => {
                  setProgramOpen(false);
                  navigate(`/cours/${courseId}/validation-finale${previewRouteQuery}`);
                }}
                finalUnlocked={finalUnlocked}
                isOnline={isOnline}
                offlineLessonIds={offlineLessonSet}
              />
            </div>
          </aside>
        </div>
      )}

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {programOpen && <aside className="hidden md:flex flex-col flex-shrink-0 border-r bg-white" style={{ width: 280, borderColor:'#E4E7EC' }}>
          <CourseSidebar modules={modules} currentLessonId={currentLessonId}
            onSelectLesson={goToLesson}
            onGoExam={(modId) => navigate(`/cours/${courseId}/examen-module/${modId}${previewRouteQuery}`)}
            onGoFinal={() => navigate(`/cours/${courseId}/validation-finale${previewRouteQuery}`)}
            finalUnlocked={finalUnlocked}
            isOnline={isOnline}
            offlineLessonIds={offlineLessonSet} />
        </aside>}

        {/* Content */}
        <main className="flex-1 overflow-y-auto" style={{ backgroundColor: '#FFFFFF' }}>
          {lessonLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
            </div>
          ) : !lesson ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm" style={{ color: '#9CA3AF' }}>Sélectionnez une leçon.</p>
            </div>
          ) : (
            <div className="w-full px-4 py-6">
              <div className="mx-auto max-w-3xl">
                {progressError && isPreview && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">Le service de progression de preview a signalé : {progressError}. Le curriculum de contrôle a été chargé depuis Info formation.</div>}
                {lesson.stage_type === 'module_presentation' && currentMod ? (
                  <div className="mb-6 rounded-3xl border p-6 sm:p-8" style={{borderColor:'#E4E7EC',background:'linear-gradient(135deg,#F8FAFC,#FFF7E1)'}}>
                    <p className="text-xs font-black uppercase tracking-[.18em]" style={{color:'#BF8813'}}>Présentation du module</p>
                    <h1 className="mt-2 text-2xl font-black sm:text-3xl" style={{color:'#002050'}}>{currentMod.title}</h1>
                    {currentMod.description && <p className="mt-3 text-sm leading-relaxed text-slate-600">{currentMod.description}</p>}
                    <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                      <span className="rounded-full bg-white px-3 py-1.5 shadow-sm">{currentMod.lessons.filter(l=>l.stage_type==='lesson').length} leçon(s)</span>
                      <span className="rounded-full bg-white px-3 py-1.5 shadow-sm">{Math.ceil(currentMod.lessons.filter(l=>l.stage_type==='lesson').reduce((sum,l)=>sum+Number(l.duration_seconds||0),0)/60)} min estimées</span>
                    </div>
                  </div>
                ) : lesson.stage_type === 'module_summary' && currentMod ? (
                  <div className="mb-6 rounded-3xl border p-6 sm:p-8" style={{borderColor:'#A7F3D0',background:'#F0FDF4'}}>
                    <p className="text-xs font-black uppercase tracking-[.18em]" style={{color:'#1E7A52'}}>Synthèse du module</p>
                    <h1 className="mt-2 text-2xl font-black" style={{color:'#002050'}}>{lesson.title}</h1>
                    <p className="mt-2 text-sm text-slate-600">Bilan, consolidation et validation du module « {currentMod.title} ».</p>
                  </div>
                ) : (
                  <h1 className="font-bold text-xl mb-4" style={{ color: '#002050' }}>{lesson.title}</h1>
                )}
              </div>

              <div className="mx-auto mb-5 max-w-3xl rounded-2xl border p-4" style={{ borderColor: '#E4E7EC', backgroundColor: '#F8FAFC' }}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: isOnline ? '#1E7A52' : '#B45309' }}>
                    {isOnline ? <ShieldCheck size={15}/> : <WifiOff size={15}/>}
                    {isOnline ? `Connexion disponible${network.connectionType === 'cellular' ? ' — réseau mobile' : network.connectionType === 'wifi' ? ' — Wi-Fi' : ''}` : 'Mode hors connexion'}
                    {usingLocalProgram && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">programme local</span>}
                    {usingLocalCopy && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">copie locale</span>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setDataSaver(v => !v)} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold" style={{ borderColor: dataSaver ? '#BF8813' : '#D1D5DB', color: '#002050', background: dataSaver ? '#FFFBEB' : '#FFF' }}>
                      <Gauge size={14}/>{dataSaver ? 'Économie de données active' : 'Activer l’économie de données'}
                    </button>
                    {!isPreview && isOnline && (
                      <button disabled={resilientBusy} onClick={saveCurrentLessonForResilientAccess} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-white disabled:opacity-50" style={{ backgroundColor: '#002050' }}>
                        {resilientBusy ? <RefreshCw size={14} className="animate-spin"/> : <Database size={14}/>}Conserver cette leçon
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">Le stockage local concerne uniquement les contenus autorisés. Les vidéos et fichiers téléchargeables ne sont jamais enregistrés librement.</p>
                {resilientMessage && <p className="mt-2 text-xs font-semibold" style={{ color: resilientMessage.includes('impossible') || resilientMessage.includes('refusé') || resilientMessage.includes('pas disponible') ? '#B91C1C' : '#1E7A52' }}>{resilientMessage}</p>}
              </div>

              {(lesson.is_external || lesson.content_type === 'external') && lesson.external_url && (
                <div className="rounded-2xl p-6 mb-5 border-2 text-center space-y-4"
                  style={{ borderColor: '#BF8813', backgroundColor: '#FFFBEB' }}>
                  <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto"
                    style={{ backgroundColor: 'rgba(191,136,19,0.15)' }}>
                    <ExternalLink className="w-6 h-6" style={{ color: '#BF8813' }} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm mb-1" style={{ color: '#002050' }}>Contenu externe partenaire</p>
                    {lesson.external_partner && (
                      <p className="text-xs text-gray-500 mb-3">Fourni par {lesson.external_partner}</p>
                    )}
                    <button
                      type="button"
                      disabled={!isOnline}
                      onClick={() => {
                        setExternalVisited(true);
                        void openExternalUrl(lesson.external_url!);
                      }}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white hover:opacity-85 transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ backgroundColor: '#BF8813' }}>
                      <ExternalLink size={15} />
                      {isOnline ? 'Accéder au contenu' : 'Contenu disponible en ligne'}
                    </button>
                  </div>
                  <p className="text-xs" style={{ color: '#9CA3AF' }}>
                    Ce contenu s'ouvre dans un nouvel onglet et n'est pas comptabilisé dans le temps pédagogique.
                  </p>
                  {isOnline && externalVisited && !isCompleted && (
                    <button
                      onClick={async () => {
                        if (isPreview || !currentLessonId || !courseId || !sessionToken) return;
                        await fetch(`${ENDPOINTS.lessonContent}?lesson_id=${currentLessonId}&course_id=${courseId}&mark_external_done=1`, {
                          headers: { Authorization: `Bearer ${sessionToken}` },
                        });
                        await loadProgress();
                        setLessonData(prev => prev ? { ...prev, progress: { ...prev.progress, is_completed: true } } : prev);
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border-2 hover:opacity-85 transition-opacity"
                      style={{ borderColor: '#1E7A52', color: '#1E7A52' }}>
                      <CheckCircle size={15} />
                      Marquer comme terminé
                    </button>
                  )}
                  {isCompleted && (
                    <div className="flex items-center justify-center gap-2">
                      <CheckCircle size={15} style={{ color: '#1E7A52' }} />
                      <span className="text-sm font-semibold" style={{ color: '#1E7A52' }}>Leçon complétée</span>
                    </div>
                  )}
                </div>
              )}

              {lesson.content_type === 'video' && !(lesson.is_external) && !dataSaver && isOnline && (
                <div
                  ref={videoContainerRef}
                  className="rounded-2xl overflow-hidden mb-5"
                  style={{ aspectRatio: '16/9', backgroundColor: '#000', userSelect: 'none', WebkitUserSelect: 'none' } as React.CSSProperties}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  {videoUrl
                    ? <iframe src={videoUrl} className="w-full h-full" allowFullScreen allow="autoplay; fullscreen; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" title={lesson.title} />
                    : <div className="w-full h-full flex items-center justify-center">
                        <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: '#FFF', borderTopColor: 'transparent' }} />
                      </div>
                  }
                </div>
              )}
              {lesson.content_type === 'video' && !(lesson.is_external) && (dataSaver || !isOnline) && (
                <div className="rounded-2xl border p-5 mb-5" style={{ borderColor: '#BF8813', backgroundColor: '#FFFBEB' }}>
                  <div className="flex items-center gap-2 font-bold text-sm" style={{ color: '#002050' }}><Gauge size={16}/>Lecture vidéo suspendue pour économiser les données</div>
                  <p className="mt-2 text-xs text-slate-600">Utilisez le texte, la transcription ou la piste audio lorsqu’elle est disponible. Désactivez l’économie de données pour reprendre la vidéo.</p>
                  {lesson.audio_url && isOnline && <audio controls controlsList="nodownload" preload="metadata" className="mt-3 w-full" src={lesson.audio_url} />}
                </div>
              )}
              {lesson.content_type === 'audio' && lesson.audio_url && (
                <div className="rounded-2xl p-5 mb-5" style={{ border: '1px solid #E4E7EC', backgroundColor: '#F8F9FA' }}>
                  <audio controls controlsList="nodownload" preload="metadata" className="w-full"><source src={lesson.audio_url} /></audio>
                </div>
              )}
             {lesson.content_type === 'text' && !lesson.has_blocks && lesson.text_content && (
                <div className="rounded-2xl p-6 mb-5" style={{ border: '1px solid #E4E7EC' }}>
                  <SimpleMarkdown text={lesson.text_content} />
                </div>
              )}
              {lesson.has_blocks && lessonData?.blocks && (lessonData.blocks as any[]).length > 0 && (
                <div className="mb-5">
                  <LessonBlocksRenderer
                    blocks={lessonData.blocks as any[]}
                    contentText={lesson.text_content}
                    isOnline={isOnline}
                    onQuizAnswer={(blockId, answer, correct) => submitTrainingResult(blockId, correct ? 100 : 0, answer, correct)}
                    onTrainingResult={submitTrainingResult}
                    onFileTrainingSubmit={submitTrainingFile}
                    learnerStateByBlock={learnerStateByBlock}
                    onStateChange={saveBlockState}
                  />
                </div>
              )}
              

              {/* Auto exercises for language courses */}
              {(lesson.exercices_auto?.length ?? 0) > 0 && lesson.course_category?.toLowerCase().includes('langue') && (
                <div className="mb-5 space-y-4">
                  <h3 className="font-semibold text-sm" style={{ color: '#002050' }}>Exercices interactifs</h3>
                  {lesson.exercices_auto!.map((ex, i) => (
                    <div key={i} className="rounded-xl border p-4" style={{ borderColor: '#E4E7EC', backgroundColor: '#FAFAFA' }}>
                      {ex.type === 'flashcards_vocabulaire' && ex.mots && (
                        <div>
                          <p className="text-sm font-medium mb-3" style={{ color: '#002050' }}>Vocabulaire clé</p>
                          <div className="flex flex-wrap gap-2">
                            {ex.mots.map((mot, j) => (
                              <span key={j} className="px-3 py-1 rounded-full text-sm font-medium"
                                style={{ backgroundColor: 'rgba(0,32,80,0.08)', color: '#002050' }}>{mot}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {ex.type === 'texte_a_trous' && ex.phrase && ex.reponse && (
                        <div>
                          <p className="text-sm font-medium mb-2" style={{ color: '#002050' }}>Complétez la phrase</p>
                          <TextATrousExercise phrase={ex.phrase} answer={ex.reponse} />
                        </div>
                      )}
                      {ex.type === 'dictee_audio' && ex.texteReference && (
                        <div>
                          <p className="text-sm font-medium mb-2" style={{ color: '#002050' }}>Dictée — Écoutez et transcrivez</p>
                          <DicteeAudioExercise texteReference={ex.texteReference} audioUrl={lesson.audio_url} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {isOnline && courseId && currentLessonId && !(lesson.is_external || lesson.content_type === 'external') && (
                <AssessmentEngine
                  courseId={courseId}
                  lessonId={currentLessonId}
                  scope="lesson"
                  preview={isPreview}
                  onPassed={async () => {
                    if (isPreview) return;
                    await loadProgress();
                    setShowSummary(true);
                    setLessonData(prev => prev ? { ...prev, progress: { ...prev.progress, quiz_passed: true, is_completed: true } } : prev);
                  }}
                />
              )}
              {!isOnline && !(lesson.is_external || lesson.content_type === 'external') && (
                <div className="mb-5 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: '#BF8813', backgroundColor: '#FFFBEB', color: '#002050' }}>
                  Les évaluations et examens nécessitent une connexion afin de protéger les tentatives et les résultats.
                </div>
              )}

              {/* CPD row — hidden for external lessons */}
              {!lesson.is_external && lesson.content_type !== 'external' && (
              <div className="flex items-center justify-between mb-5 px-4 py-3 rounded-xl" style={{ backgroundColor: '#F8F9FA', border: '1px solid #E4E7EC' }}>
                <CpdBar required={lessonData?.required_seconds ?? 0} spent={timeSpent}
                  reached={effectiveCpd} isActive={isActive} assessmentPassed={quizPassed}
                  isCompleted={isCompleted} />
                {lesson.stage_type === 'module_summary' && isOnline && currentMod?.exam_unlocked && !currentMod.exam_passed && (
                  <button onClick={() => navigate(`/cours/${courseId}/examen-module/${currentMod.module_id}${previewRouteQuery}`)}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg hover:opacity-80"
                    style={{ backgroundColor: '#BF8813', color: '#FFF' }}>Passer l'examen</button>
                )}
              </div>
              )}

              {/* Summary after quiz */}
              {showSummary && lesson.lesson_summary && (
                <div className="rounded-2xl p-5 mb-5" style={{ backgroundColor: '#F8F9FA', borderLeft: '4px solid #BF8813' }}>
                  <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#BF8813' }}>Résumé de la leçon</p>
                  <p className="text-sm leading-relaxed mb-4" style={{ color: '#374151' }}>{lesson.lesson_summary}</p>
                  {lessonData?.next_lesson_id && (isOnline || offlineLessonSet.has(lessonData.next_lesson_id)) && (
                    <button onClick={handleNext} className="px-5 py-2.5 rounded-xl font-semibold text-sm text-white hover:opacity-85"
                      style={{ backgroundColor: '#002050' }}>Étape suivante →</button>
                  )}
                </div>
              )}

              {/* Next shortcuts */}
              {isCompleted && !showSummary && (
                <div className="flex gap-3 mt-2">
                  {lessonData?.next_lesson_id && (isOnline || offlineLessonSet.has(lessonData.next_lesson_id)) && (
                    <button onClick={handleNext} className="px-5 py-2.5 rounded-xl font-semibold text-sm text-white hover:opacity-85"
                      style={{ backgroundColor: '#002050' }}>Étape suivante →</button>
                  )}
                  {lesson.stage_type === 'module_summary' && isOnline && currentMod?.exam_unlocked && !currentMod.exam_passed && (
                    <button onClick={() => navigate(`/cours/${courseId}/examen-module/${currentMod.module_id}${previewRouteQuery}`)}
                      className="px-5 py-2.5 rounded-xl font-semibold text-sm hover:opacity-85"
                      style={{ border: '1.5px solid #BF8813', color: '#BF8813' }}>Passer l'examen du module</button>
                  )}
                </div>
              )}
            </div>
          )}
        </main>

              {lesson && (
                <div className="mt-10 flex items-center justify-between gap-3 border-t pt-5" style={{borderColor:'#E4E7EC'}}>
                  <button type="button" disabled={!previousReaderLesson} onClick={()=>previousReaderLesson&&goToLesson(previousReaderLesson.lesson_id)} className="rounded-xl border px-4 py-2.5 text-sm font-bold disabled:opacity-30" style={{borderColor:'#CBD5E1',color:'#002050'}}>← Précédent</button>
                  <div className="text-right">
                    <button type="button" disabled={!nextReaderLesson || nextReaderLesson.is_unlocked===false || (!isPreview && (!effectiveCpd || (!!lessonData?.training?.required_count && lessonData.training.passed !== true) || !quizPassed || (lesson.stage_type === 'module_summary' && !!currentMod?.exam_required && currentMod.exam_passed !== true)))} onClick={handleNext} className="rounded-xl px-5 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-30" style={{background:'#002050'}}>{lesson.stage_type === 'module_presentation' ? 'Commencer le module →' : lesson.stage_type === 'module_summary' ? 'Module suivant →' : lesson.stage_type === 'introduction' ? 'Continuer →' : 'Suivant →'}</button>
                    {!isPreview && nextReaderLesson && (!effectiveCpd || (!!lessonData?.training?.required_count && lessonData.training.passed !== true) || !quizPassed || (lesson.stage_type === 'module_summary' && !!currentMod?.exam_required && currentMod.exam_passed !== true)) && <p className="mt-1 max-w-xs text-xs text-slate-500">{!effectiveCpd ? `${fmtTime(Math.max(0, Number(lessonData?.required_seconds || 0) - timeSpent))} de temps pédagogique restant` : (!!lessonData?.training?.required_count && lessonData.training.passed !== true) ? 'Entraînement obligatoire à terminer' : !quizPassed ? 'Évaluation obligatoire à réussir' : 'Évaluation du module à réussir'}</p>}
                  </div>
                </div>
              )}
        {/* AI Panel */}
        {aiOpen && (
          <aside className="hidden lg:flex flex-col flex-shrink-0" style={{ width: 320, borderLeft: '1px solid #E4E7EC' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid #E4E7EC' }}>
              <div className="flex items-center gap-2">
                <Bot size={15} style={{ color: '#BF8813' }} />
                <span className="text-sm font-bold" style={{ color: '#002050' }}>Assistant IA</span>
                <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#E4F1EA', color: '#1E7A52', fontSize: 10 }}>
                  Contenu validé
                </span>
              </div>
              <button onClick={() => setAiOpen(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X size={15} style={{ color: '#6B7280' }} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {aiMessages.map(msg => (
                <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
                      style={{ backgroundColor: '#002050' }}>IA</div>
                  )}
                  <div className="max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed"
                    style={msg.role === 'assistant'
                      ? { backgroundColor: '#F8F9FA', color: '#374151', borderBottomLeftRadius: 4 }
                      : { backgroundColor: '#002050', color: 'white', borderBottomRightRadius: 4 }}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {aiLoading && (
                <div className="flex gap-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
                    style={{ backgroundColor: '#002050' }}>IA</div>
                  <div className="rounded-2xl px-3 py-2" style={{ backgroundColor: '#F8F9FA', borderBottomLeftRadius: 4 }}>
                    <div className="flex gap-1 items-center h-4">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: '#9CA3AF', animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {aiError && (
                <div className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
                  <AlertCircle size={12} />
                  {aiError}
                </div>
              )}
              <div ref={aiBottomRef} />
            </div>

            {/* Outils et saisie */}
            <div className="flex-shrink-0 p-3" style={{ borderTop: '1px solid #E4E7EC' }}>
              <div className="grid grid-cols-2 gap-1.5 mb-2">
                {[
                  ['explanation', 'Expliquer', 'Expliquez clairement le point principal de cette leçon.'],
                  ['reformulation', 'Simplifier', 'Reformulez les notions principales de cette leçon avec des mots plus simples.'],
                  ['exercise', 'Exercice', 'Proposez-moi un exercice d’entraînement basé uniquement sur cette leçon.'],
                  ['revision_plan', 'Plan de révision', 'Préparez un plan de révision concis pour cette formation.'],
                  ['recommendation', 'À revoir', 'Quels éléments validés de cette formation devrais-je revoir en priorité ?'],
                ].map(([mode, label, prompt]) => (
                  <button key={mode} onClick={() => { setAiMode(mode); handleSendAI(mode, prompt); }} disabled={aiLoading || !isOnline}
                    className="rounded-lg border px-2 py-1.5 text-[11px] font-semibold disabled:opacity-50"
                    style={{ borderColor: aiMode === mode ? '#BF8813' : '#E4E7EC', color: '#002050', background: aiMode === mode ? '#FFFBEB' : 'white' }}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 items-end">
                <textarea
                  value={aiInput}
                  onChange={e => setAiInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendAI('question'); } }}
                  placeholder={isOnline ? 'Posez une question sur le contenu validé...' : 'Assistant IA disponible en ligne'}
                  rows={2}
                  disabled={aiLoading || !isOnline}
                  className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:border-gray-400 disabled:opacity-50"
                  style={{ lineHeight: '1.5' }}
                />
                <button onClick={() => handleSendAI('question')} disabled={aiLoading || !isOnline || !aiInput.trim()}
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-40"
                  style={{ backgroundColor: '#002050' }}>
                  <Send size={13} style={{ color: 'white' }} />
                </button>
              </div>
              <p className="text-center mt-2" style={{ color: isOnline ? '#9CA3AF' : '#B45309', fontSize: 10 }}>
                {isOnline ? 'Réponses limitées aux contenus validés par le Centre Qualité' : 'Connexion internet requise pour l’assistant IA'}
              </p>
            </div>
          </aside>
        )}
      </div>

    </div>
  );
}
