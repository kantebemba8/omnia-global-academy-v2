import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, Circle, PlayCircle, Volume2, FileText, ChevronDown, ChevronRight, X, Bot, ArrowLeft, ClipboardList, Trophy, Send, AlertCircle, ExternalLink } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useCpdTimer } from '../hooks/useCpdTimer';
import { QuizLecon, type QuizQuestion } from './QuizLecon';
import { ENDPOINTS } from '../lib/config';

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
  is_external?: boolean;
}
interface ModuleItem {
  module_id: string; title: string; position: number; description?: string;
  lessons: LessonItem[]; exam_unlocked: boolean; exam_passed: boolean;
  exam_score: number | null; exam_attempts: number; is_unlocked: boolean;
}
interface LessonContent {
  id: string; title: string; content_type: 'video' | 'audio' | 'text' | 'external';
  video_url?: string; audio_url?: string; text_content?: string;
  lesson_summary?: string; duration_seconds: number; cloudflare_stream_uid?: string;
  is_external?: boolean; external_url?: string; external_partner?: string;
  course_category?: string;
  exercices_auto?: Array<{
    type: 'flashcards_vocabulaire' | 'texte_a_trous' | 'dictee_audio';
    mots?: string[];
    phrase?: string;
    reponse?: string;
    texteReference?: string;
  }>;
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
function fmtTime(s: number) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

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
function CourseSidebar({ modules, currentLessonId, onSelectLesson, onGoExam, onGoFinal, finalUnlocked }: {
  modules: ModuleItem[]; currentLessonId: string | null;
  onSelectLesson: (id: string) => void; onGoExam: (modId: string) => void;
  onGoFinal: () => void; finalUnlocked: boolean;
}) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(modules.map(m => m.module_id)));
  const toggle = (id: string) => setOpen(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const typeIcon = (ct: string) => ct === 'video' ? <PlayCircle size={13} /> : ct === 'audio' ? <Volume2 size={13} /> : ct === 'external' ? <ExternalLink size={13} /> : <FileText size={13} />;

  return (
    <div className="h-full overflow-y-auto" style={{ backgroundColor: '#FAFAFA', borderRight: '1px solid #E4E7EC' }}>
      <div className="py-3">
        {modules.map(mod => (
          <div key={mod.module_id}>
            <button onClick={() => toggle(mod.module_id)}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-gray-100 transition-colors"
              style={{ opacity: mod.is_unlocked ? 1 : 0.45 }}>
              <span className="flex-1 text-xs font-bold uppercase tracking-wide" style={{ color: '#002050' }}>{mod.position}. {mod.title}</span>
              {open.has(mod.module_id) ? <ChevronDown size={14} style={{ color: '#9CA3AF' }} /> : <ChevronRight size={14} style={{ color: '#9CA3AF' }} />}
            </button>
            {open.has(mod.module_id) && (
              <div>
                {mod.lessons.map(l => {
                  const cur = l.lesson_id === currentLessonId;
                  return (
                    <button key={l.lesson_id}
                      onClick={() => mod.is_unlocked && onSelectLesson(l.lesson_id)}
                      className="w-full flex items-center gap-2.5 pl-6 pr-4 py-2 text-left transition-colors"
                      style={{ backgroundColor: cur ? '#EEF2FF' : 'transparent', cursor: mod.is_unlocked ? 'pointer' : 'not-allowed', opacity: mod.is_unlocked ? 1 : 0.5 }}>
                      {l.is_completed ? <CheckCircle size={14} style={{ color: '#1E7A52', flexShrink: 0 }} />
                        : cur ? <PlayCircle size={14} style={{ color: '#002050', flexShrink: 0 }} />
                          : <Circle size={14} style={{ color: '#D1D5DB', flexShrink: 0 }} />}
                      <span className="text-xs leading-tight flex-1" style={{ color: cur ? '#002050' : '#374151', fontWeight: cur ? 600 : 400 }}>{l.title}</span>
                      <span className="ml-auto flex-shrink-0" style={{ color: '#9CA3AF' }}>{typeIcon(l.content_type)}</span>
                    </button>
                  );
                })}
                {mod.is_unlocked && (
                  <button onClick={() => mod.exam_unlocked && onGoExam(mod.module_id)}
                    className="w-full flex items-center gap-2.5 pl-6 pr-4 py-2 text-left hover:bg-gray-50 transition-colors"
                    style={{ opacity: mod.exam_unlocked ? 1 : 0.4, cursor: mod.exam_unlocked ? 'pointer' : 'default' }}>
                    <ClipboardList size={14} style={{ color: mod.exam_passed ? '#1E7A52' : '#BF8813', flexShrink: 0 }} />
                    <span className="text-xs font-semibold" style={{ color: mod.exam_passed ? '#1E7A52' : '#BF8813' }}>
                      {mod.exam_passed ? `Examen ✓ (${mod.exam_score}%)` : 'Examen de module'}
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
        {finalUnlocked && (
          <div style={{ borderTop: '1px solid #E4E7EC', marginTop: 8, paddingTop: 8 }}>
            <button onClick={onGoFinal} className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-amber-50 transition-colors">
              <Trophy size={15} style={{ color: '#BF8813' }} />
              <span className="text-xs font-bold" style={{ color: '#BF8813' }}>Validation finale</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── CPD Bar ───────────────────────────────────────────────────────────────────
function CpdBar({ required, spent, reached, isActive, quizPassed, isCompleted, onStartQuiz, hasQ }: {
  required: number; spent: number; reached: boolean; isActive: boolean;
  quizPassed: boolean; isCompleted: boolean; onStartQuiz: () => void; hasQ: boolean;
}) {
  if (isCompleted || quizPassed) {
    return <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ backgroundColor: 'rgba(30,122,82,0.08)' }}>
      <CheckCircle size={14} style={{ color: '#1E7A52' }} />
      <span className="text-xs font-semibold" style={{ color: '#1E7A52' }}>Leçon complétée</span>
    </div>;
  }
  if (reached && hasQ) {
    return <button onClick={onStartQuiz} className="flex items-center gap-2 px-3 py-2 rounded-xl hover:opacity-85" style={{ backgroundColor: '#BF8813' }}>
      <ClipboardList size={14} style={{ color: '#FFF' }} />
      <span className="text-xs font-bold text-white">Démarrer le quiz</span>
    </button>;
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

// ── Main ──────────────────────────────────────────────────────────────────────
export function CoursLecteur() {
  const { id: courseId, lessonId: routeLessonId } = useParams<{ id: string; lessonId?: string }>();
  const navigate = useNavigate();
  const { user, sessionToken, loading: authLoading } = useAuth();

  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [finalUnlocked, setFinalUnlocked] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(routeLessonId ?? null);
  const [lessonData, setLessonData] = useState<{
    lesson: LessonContent;
    progress: { time_spent_seconds: number; quiz_passed: boolean; is_completed: boolean };
    required_seconds: number; cpd_time_reached: boolean;
    questions: QuizQuestion[]; next_lesson_id: string | null;
  } | null>(null);
  const [progressLoading, setProgressLoading] = useState(true);
  const [lessonLoading, setLessonLoading] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [externalVisited, setExternalVisited] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const aiBottomRef = useRef<HTMLDivElement>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const videoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!authLoading && !user) navigate('/connexion'); }, [authLoading, user, navigate]);

  const loadProgress = useCallback(async () => {
    if (!sessionToken || !courseId) return;
    try {
      const res = await fetch(`${ENDPOINTS.courseProgress}?course_id=${courseId}`, { headers: { Authorization: `Bearer ${sessionToken}` } });
      const data = await res.json();
      if (data.error) { navigate(`/cours/${courseId}`); return; }
      setModules(data.modules ?? []);
      setFinalUnlocked(data.final_validation_unlocked ?? false);
      setProgressPct(data.progress?.percent ?? 0);
    } catch { /* ignore */ }
  }, [sessionToken, courseId, navigate]);

  useEffect(() => {
    if (!sessionToken) return;
    setProgressLoading(true);
    loadProgress().finally(() => setProgressLoading(false));
  }, [sessionToken, loadProgress]);

  useEffect(() => {
    if (modules.length === 0 || currentLessonId) return;
    const first = routeLessonId ?? findFirstIncomplete(modules);
    if (first) setCurrentLessonId(first);
  }, [modules, routeLessonId, currentLessonId]);

  useEffect(() => {
    if (!currentLessonId || !courseId || !sessionToken) return;
    setLessonLoading(true);
    setShowQuiz(false); setShowSummary(false); setVideoUrl(null); setExternalVisited(false);
    if (videoTimerRef.current) clearInterval(videoTimerRef.current);
    fetch(`${ENDPOINTS.lessonContent}?lesson_id=${currentLessonId}&course_id=${courseId}`, { headers: { Authorization: `Bearer ${sessionToken}` } })
      .then(r => r.json())
      .then(d => {
        if (d.error) return;
        setLessonData(d);
        if (d.lesson.content_type === 'video') signVideo(currentLessonId);
      })
      .finally(() => setLessonLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLessonId, courseId, sessionToken]);

  const signVideo = useCallback((lid: string) => {
    if (!courseId || !sessionToken) return;
    const doSign = async () => {
      try {
        const r = await fetch(ENDPOINTS.videoSignedUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` }, body: JSON.stringify({ lesson_id: lid, course_id: courseId }) });
        const d = await r.json();
        if (d.url) setVideoUrl(d.url);
      } catch { /* ignore */ }
    };
    doSign();
    if (videoTimerRef.current) clearInterval(videoTimerRef.current);
    videoTimerRef.current = setInterval(doSign, 55_000);
  }, [courseId, sessionToken]);

  const { timeSpent, cpdTimeReached, isActive } = useCpdTimer({
    lessonId: currentLessonId, courseId: courseId ?? null,
    requiredSeconds: lessonData?.required_seconds ?? 0,
    initialSpent: lessonData?.progress.time_spent_seconds ?? 0,
    sessionToken,
    onTimeReached: () => {
      if (!currentLessonId || !courseId || !sessionToken) return;
      fetch(`${ENDPOINTS.lessonContent}?lesson_id=${currentLessonId}&course_id=${courseId}`, { headers: { Authorization: `Bearer ${sessionToken}` } })
        .then(r => r.json()).then(d => { if (!d.error) setLessonData(d); });
    },
  });

  const goToLesson = (id: string) => { setCurrentLessonId(id); navigate(`/cours/${courseId}/apprendre/${id}`, { replace: true }); };

  const handleQuizPassed = async (score: number) => {
    void score;
    setShowQuiz(false); setShowSummary(true);
    await loadProgress();
    setLessonData(prev => prev ? { ...prev, progress: { ...prev.progress, quiz_passed: true, is_completed: true } } : prev);
  };

  const handleNext = () => {
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

  const handleSendAI = useCallback(async () => {
    if (!aiInput.trim() || aiLoading || !courseId || !sessionToken) return;
    const userMsg: AiMessage = { id: Date.now().toString(), role: 'user', content: aiInput };
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
        body: JSON.stringify({ course_id: courseId, message: userMsg.content, conversation_history: history }),
      });
      const d = await res.json();
      if (d.reply) {
        setAiMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: d.reply }]);
      } else {
        setAiError('Désolé, une erreur est survenue. Réessayez dans un instant.');
      }
    } catch {
      setAiError('Erreur réseau. Réessayez dans un instant.');
    } finally {
      setAiLoading(false);
    }
  }, [aiInput, aiLoading, courseId, sessionToken, aiMessages]);

  const lesson = lessonData?.lesson;
  const prog = lessonData?.progress;
  const isCompleted = prog?.is_completed ?? false;
  const quizPassed = prog?.quiz_passed ?? false;
  const hasQ = (lessonData?.questions.length ?? 0) > 0;
  const effectiveCpd = cpdTimeReached || (lessonData?.cpd_time_reached ?? false);
  const currentMod = modules.find(m => m.lessons.some(l => l.lesson_id === currentLessonId));

  if (progressLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
    </div>
  );

  return (
    <div className="flex flex-col h-screen" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <header className="flex items-center gap-3 px-4 flex-shrink-0" style={{ backgroundColor: '#002050', height: 56 }}>
        <button onClick={() => navigate(`/cours/${courseId}`)} className="hover:opacity-70 transition-opacity">
          <ArrowLeft size={18} style={{ color: 'rgba(255,255,255,0.65)' }} />
        </button>
        <div className="flex-1 flex items-center gap-3">
          <div className="flex-1 rounded-full overflow-hidden" style={{ height: 4, backgroundColor: 'rgba(255,255,255,0.15)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${progressPct}%`, backgroundColor: '#BF8813' }} />
          </div>
          <span className="text-xs font-semibold text-white">{progressPct}%</span>
        </div>
        <button onClick={() => setAiOpen(o => !o)}
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

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col flex-shrink-0" style={{ width: 280 }}>
          <CourseSidebar modules={modules} currentLessonId={currentLessonId}
            onSelectLesson={goToLesson}
            onGoExam={(modId) => navigate(`/cours/${courseId}/examen-module/${modId}`)}
            onGoFinal={() => navigate(`/cours/${courseId}/validation-finale`)}
            finalUnlocked={finalUnlocked} />
        </aside>

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
            <div className="max-w-3xl mx-auto px-4 py-6">
              <h1 className="font-bold text-xl mb-4" style={{ color: '#002050' }}>{lesson.title}</h1>

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
                    <a href={lesson.external_url} target="_blank" rel="noopener noreferrer"
                      onClick={() => setExternalVisited(true)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white hover:opacity-85 transition-opacity"
                      style={{ backgroundColor: '#BF8813' }}>
                      <ExternalLink size={15} />
                      Accéder au contenu
                    </a>
                  </div>
                  <p className="text-xs" style={{ color: '#9CA3AF' }}>
                    Ce contenu s'ouvre dans un nouvel onglet et n'est pas comptabilisé dans le timer CPD.
                  </p>
                  {externalVisited && !isCompleted && (
                    <button
                      onClick={async () => {
                        if (!currentLessonId || !courseId || !sessionToken) return;
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

              {lesson.content_type === 'video' && !(lesson.is_external) && (
                <div
                  ref={videoContainerRef}
                  className="rounded-2xl overflow-hidden mb-5"
                  style={{ aspectRatio: '16/9', backgroundColor: '#000', userSelect: 'none', WebkitUserSelect: 'none' } as React.CSSProperties}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  {videoUrl
                    ? <iframe src={videoUrl} className="w-full h-full" allowFullScreen allow="autoplay; fullscreen" title={lesson.title} />
                    : <div className="w-full h-full flex items-center justify-center">
                        <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: '#FFF', borderTopColor: 'transparent' }} />
                      </div>
                  }
                </div>
              )}
              {lesson.content_type === 'audio' && lesson.audio_url && (
                <div className="rounded-2xl p-5 mb-5" style={{ border: '1px solid #E4E7EC', backgroundColor: '#F8F9FA' }}>
                  <audio controls className="w-full"><source src={lesson.audio_url} /></audio>
                </div>
              )}
              {lesson.content_type === 'text' && lesson.text_content && (
                <div className="rounded-2xl p-6 mb-5" style={{ border: '1px solid #E4E7EC' }}>
                  <SimpleMarkdown text={lesson.text_content} />
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

              {/* CPD row — hidden for external lessons */}
              {!lesson.is_external && lesson.content_type !== 'external' && (
              <div className="flex items-center justify-between mb-5 px-4 py-3 rounded-xl" style={{ backgroundColor: '#F8F9FA', border: '1px solid #E4E7EC' }}>
                <CpdBar required={lessonData?.required_seconds ?? 0} spent={timeSpent}
                  reached={effectiveCpd} isActive={isActive} quizPassed={quizPassed}
                  isCompleted={isCompleted} onStartQuiz={() => setShowQuiz(true)} hasQ={hasQ} />
                {currentMod?.exam_unlocked && !currentMod.exam_passed && (
                  <button onClick={() => navigate(`/cours/${courseId}/examen-module/${currentMod.module_id}`)}
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
                  {lessonData?.next_lesson_id && (
                    <button onClick={handleNext} className="px-5 py-2.5 rounded-xl font-semibold text-sm text-white hover:opacity-85"
                      style={{ backgroundColor: '#002050' }}>Leçon suivante →</button>
                  )}
                </div>
              )}

              {/* Next shortcuts */}
              {isCompleted && !showSummary && (
                <div className="flex gap-3 mt-2">
                  {lessonData?.next_lesson_id && (
                    <button onClick={handleNext} className="px-5 py-2.5 rounded-xl font-semibold text-sm text-white hover:opacity-85"
                      style={{ backgroundColor: '#002050' }}>Leçon suivante →</button>
                  )}
                  {currentMod?.exam_unlocked && !currentMod.exam_passed && (
                    <button onClick={() => navigate(`/cours/${courseId}/examen-module/${currentMod.module_id}`)}
                      className="px-5 py-2.5 rounded-xl font-semibold text-sm hover:opacity-85"
                      style={{ border: '1.5px solid #BF8813', color: '#BF8813' }}>Passer l'examen du module</button>
                  )}
                </div>
              )}
            </div>
          )}
        </main>

        {/* AI Panel */}
        {aiOpen && (
          <aside className="hidden lg:flex flex-col flex-shrink-0" style={{ width: 320, borderLeft: '1px solid #E4E7EC' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid #E4E7EC' }}>
              <div className="flex items-center gap-2">
                <Bot size={15} style={{ color: '#BF8813' }} />
                <span className="text-sm font-bold" style={{ color: '#002050' }}>Assistant IA</span>
                <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#E4F1EA', color: '#1E7A52', fontSize: 10 }}>
                  Scopé sur ce cours
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

            {/* Input */}
            <div className="flex-shrink-0 p-3" style={{ borderTop: '1px solid #E4E7EC' }}>
              <div className="flex gap-2 items-end">
                <textarea
                  value={aiInput}
                  onChange={e => setAiInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendAI(); } }}
                  placeholder="Posez une question sur ce cours..."
                  rows={2}
                  disabled={aiLoading}
                  className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:border-gray-400 disabled:opacity-50"
                  style={{ lineHeight: '1.5' }}
                />
                <button onClick={handleSendAI} disabled={aiLoading || !aiInput.trim()}
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-40"
                  style={{ backgroundColor: '#002050' }}>
                  <Send size={13} style={{ color: 'white' }} />
                </button>
              </div>
              <p className="text-center mt-2" style={{ color: '#9CA3AF', fontSize: 10 }}>
                ⚡ Réponses basées sur le contenu de ce cours uniquement
              </p>
            </div>
          </aside>
        )}
      </div>

      {/* Quiz modal */}
      {showQuiz && lessonData && currentLessonId && courseId && sessionToken && (
        <QuizLecon questions={lessonData.questions} lessonId={currentLessonId} courseId={courseId}
          sessionToken={sessionToken} onClose={() => setShowQuiz(false)} onPassed={handleQuizPassed} />
      )}
    </div>
  );
}
