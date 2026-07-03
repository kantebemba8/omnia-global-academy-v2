import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DashboardLayout } from '../../components/DashboardLayout';
import {
  ChevronRight, ChevronLeft, PlusCircle, Trash2, Wand2, Upload,
  AlertCircle, CheckCircle, Info, ChevronDown, ChevronUp, Loader2,
  BookOpen, FileText, Video, Headphones, Link2, Sparkles
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Objective { id: string; text: string }
interface Question {
  id: string; question_text: string; question_type: string;
  options: string[]; correct_answer: string;
}
interface Resource { id: string; resource_type: string; title: string; url: string }
interface Lesson {
  id: string; title: string; position: number;
  content_text: string; video_url: string; audio_url: string; summary: string;
  questions: Question[]; resources: Resource[];
  expanded: boolean;
  is_external: boolean; external_url: string; external_partner: string;
  audio_text_to_generate: string; audioMode: 'upload' | 'text' | '';
}
interface Module {
  id: string; title: string; position: number;
  lessons: Lesson[]; expanded: boolean;
  competences_linguistiques: string[];
}
interface CourseData {
  id: string | null; title: string; description: string;
  category: string; level: string; language: string;
  prerequisites: string; objectives: Objective[];
  cover_image_url: string; requested_cpd: boolean;
  final_validation_type: string;
  modules: Module[];
}
interface ScorePreview {
  score: number; price_xof: number; palier: number; multiplier: number;
  commission: number; breakdown: Record<string, number>;
}

// ─── Constants ───────────────────────────────────────────────────────────────
function getApiBase() {
  const url = import.meta.env.VITE_SUPABASE_URL || '';
  return url ? `${url}/functions/v1` : '/api';
}

const CATEGORIES = [
  'Comptabilité & Finance', 'Fiscalité', 'Droit des affaires', 'Gestion de projet',
  'Management & Leadership', 'Ressources humaines', 'Marketing digital', 'Vente & Négociation',
  'Entrepreneuriat', 'Informatique de gestion', 'Bureautique & Productivité',
  'Langues & Linguistique', 'Communication professionnelle', 'Logistique & Supply chain',
  'Qualité & Processus', 'Banque & Microfinance', 'Agriculture & Agribusiness',
  'Santé & Sécurité au travail', 'Développement personnel', 'Secteur public & Gouvernance',
  'Commerce international', 'Énergie & Environnement',
];
const LEVELS = [
  { value: 'debutant', label: 'Débutant' },
  { value: 'intermediaire', label: 'Intermédiaire' },
  { value: 'avance', label: 'Avancé' },
  { value: 'expert', label: 'Expert' },
];
const LANGUAGES = ['Français', 'Anglais', 'Arabe', 'Bambara', 'Dioula', 'Wolof'];
const VALIDATION_TYPES = [
  { value: 'qcm', label: 'QCM uniquement', desc: 'Évaluation automatique par quiz' },
  { value: 'projet_soumettre', label: 'Projet à soumettre', desc: 'Travail pratique soumis' },
  { value: 'projet_corriger', label: 'Projet à corriger', desc: 'Correction manuelle par le formateur' },
  { value: 'examen_oral', label: 'Examen oral', desc: 'Pour les cours de langues' },
];

const STEPS = ['Infos générales', 'Structure', 'Contenu', 'Évaluation', 'Soumettre'];

const emptyLesson = (pos: number): Lesson => ({
  id: `new_lesson_${Date.now()}_${pos}`, title: '', position: pos,
  content_text: '', video_url: '', audio_url: '', summary: '',
  questions: [], resources: [], expanded: false,
  is_external: false, external_url: '', external_partner: '',
  audio_text_to_generate: '', audioMode: '',
});
const emptyModule = (pos: number): Module => ({
  id: `new_mod_${Date.now()}_${pos}`, title: '', position: pos,
  lessons: [emptyLesson(1)], expanded: true,
  competences_linguistiques: [],
});

// ─── ScoreCard ────────────────────────────────────────────────────────────────
function ScoreCard({ score, preview }: { score: ScorePreview | null; preview: boolean }) {
  const palierLabel = ['Bronze', 'Silver', 'Gold', 'Platinum'];
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sticky top-6">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4" style={{ color: '#BF8813' }} />
        <span className="text-sm font-semibold text-gray-900">Score prévisionnel</span>
        {preview && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
      </div>
      {score ? (
        <>
          <div className="text-3xl font-bold mb-1" style={{ color: '#002050' }}>{score.score}</div>
          <div className="text-xs text-gray-400 mb-3">points</div>
          <div className="rounded-lg p-3 mb-3" style={{ backgroundColor: '#BF8813' + '15' }}>
            <div className="text-xs text-gray-500 mb-0.5">Prix prévu</div>
            <div className="font-bold" style={{ color: '#BF8813' }}>{score.price_xof.toLocaleString()} XOF</div>
            <div className="text-xs text-gray-400 mt-0.5">Palier {palierLabel[score.palier - 1] || score.palier}</div>
          </div>
          <div className="text-xs text-gray-500 mb-1">Ventilation</div>
          <div className="space-y-1">
            {Object.entries(score.breakdown).map(([k, v]) => (
              <div key={k} className="flex justify-between text-xs">
                <span className="text-gray-400 capitalize">{k.replace(/_/g, ' ')}</span>
                <span className="font-medium text-gray-700">{v}</span>
              </div>
            ))}
          </div>
          {score.multiplier !== 1 && (
            <div className="mt-2 text-xs text-center py-1 rounded" style={{ backgroundColor: '#002050' + '10', color: '#002050' }}>
              ×{score.multiplier} (catégorie)
            </div>
          )}
        </>
      ) : (
        <div className="text-xs text-gray-400 text-center py-4">
          Remplissez les informations pour voir le score
        </div>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export function ProfesseurStudioCreation({ is_admin = false }: { is_admin?: boolean }) {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submitErrors, setSubmitErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [scorePreview, setScorePreview] = useState<ScorePreview | null>(null);
  const [scoreFetching, setScoreFetching] = useState(false);
  const scoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [plateformeMode, setPlateformeMode] = useState(false);
  const [generatingAudio, setGeneratingAudio] = useState<string | null>(null);

  const [course, setCourse] = useState<CourseData>({
    id: id || null, title: '', description: '', category: '', level: 'debutant',
    language: 'Français', prerequisites: '', objectives: [{ id: 'obj1', text: '' }],
    cover_image_url: '', requested_cpd: false, final_validation_type: 'qcm',
    modules: [emptyModule(1)],
  });

  const token = () => localStorage.getItem('omnia_session_token') || '';
  const userRole = (() => {
    try { return JSON.parse(localStorage.getItem('omnia_user') || '{}').role ?? ''; }
    catch { return ''; }
  })();
  const canAddExternalLesson = is_admin || userRole === 'super_admin' || userRole === 'etablissement_directeur' || userRole === 'etablissement_enseignant';

  // ── Language-specific state ────────────────────────────────────────────────
  const [langueEnseignee, setLangueEnseignee] = useState('');
  const [langueInstruction, setLangueInstruction] = useState('Français');
  const [niveauCecrl, setNiveauCecrl] = useState('');
  const [sousCategorie, setSousCategorie] = useState('');
  const [champsSousCategorie, setChampsSousCategorie] = useState<Record<string, string>>({});
  const [proposeExamenOral, setProposeExamenOral] = useState(false);
  const [examenOralConsignes, setExamenOralConsignes] = useState('');
  const [examenOralCriteres, setExamenOralCriteres] = useState<Record<string, number>>({
    prononciation: 20, vocabulaire: 20, grammaire: 20, fluidite: 20, comprehension: 20,
  });

  // ── Load existing course ──────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    (async () => {
      const res = await fetch(`${getApiBase()}/course-create?course_id=${id}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) return;
      const json = await res.json();
      const c = json.course;
      if (!c) return;
      const mods: Module[] = (json.modules || []).map((m: any) => ({
        id: m.id, title: m.title, position: m.position, expanded: false,
        competences_linguistiques: m.competences_linguistiques || [],
        lessons: (json.lessons || [])
          .filter((l: any) => l.module_id === m.id)
          .sort((a: any, b: any) => a.position - b.position)
          .map((l: any) => ({
            id: l.id, title: l.title, position: l.position,
            content_text: l.content_text || '', video_url: l.video_url || '',
            audio_url: l.audio_url || '', summary: l.summary || '',
            expanded: false,
            is_external: l.is_external || false,
            external_url: l.external_url || '',
            external_partner: l.external_partner || '',
            audio_text_to_generate: l.audio_text_to_generate || '',
            audioMode: (l.audio_url ? 'upload' : l.audio_text_to_generate ? 'text' : '') as 'upload' | 'text' | '',
            resources: (json.resources || []).filter((r: any) => r.lesson_id === l.id),
            questions: (json.questions || [])
              .filter((q: any) => q.lesson_id === l.id)
              .map((q: any) => ({
                ...q,
                options: Array.isArray(q.options) ? q.options : [],
              })),
          })),
      }));
      setCourse({
        id: c.id, title: c.title || '', description: c.description || '',
        category: c.category || '', level: c.level || 'debutant',
        language: c.language || 'Français', prerequisites: c.prerequisites || '',
        objectives: Array.isArray(c.objectives) && c.objectives.length
          ? c.objectives.map((t: string, i: number) => ({ id: `obj_${i}`, text: t }))
          : [{ id: 'obj1', text: '' }],
        cover_image_url: c.cover_image_url || '',
        requested_cpd: !!c.requested_cpd,
        final_validation_type: c.final_validation_type || 'qcm',
        modules: mods.length ? mods : [emptyModule(1)],
      });
      // Load language fields
      if (c.langue_enseignee) setLangueEnseignee(c.langue_enseignee);
      if (c.langue_instruction) setLangueInstruction(c.langue_instruction);
      if (c.niveau_cecrl) setNiveauCecrl(c.niveau_cecrl);
      if (c.sous_categorie_langue) setSousCategorie(c.sous_categorie_langue);
      if (c.champs_sous_categorie) setChampsSousCategorie(c.champs_sous_categorie);
      if (c.examen_oral_statut && c.examen_oral_statut !== 'non_propose') {
        setProposeExamenOral(true);
        setExamenOralConsignes(c.examen_oral_consignes || '');
        if (c.examen_oral_criteres) setExamenOralCriteres(c.examen_oral_criteres);
      }
    })();
  }, [id]);

  // ── Score preview debounce ─────────────────────────────────────────────────
  const fetchScore = useCallback(async () => {
    if (!course.category) return;
    setScoreFetching(true);
    try {
      const payload = {
        category: course.category,
        level: course.level,
        requested_cpd: course.requested_cpd ? 1 : 0,
        modules_count: course.modules.length,
        lessons_count: course.modules.reduce((s, m) => s + m.lessons.length, 0),
        resources_count: course.modules.reduce((s, m) =>
          s + m.lessons.reduce((ls, l) => ls + l.resources.length, 0), 0),
        has_video: course.modules.some((m) => m.lessons.some((l) => !!l.video_url)),
        objectives_count: course.objectives.filter((o) => o.text.trim()).length,
        has_oral_exam: proposeExamenOral,
      };
      const res = await fetch(`${getApiBase()}/course-score-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify(payload),
      });
      if (res.ok) setScorePreview(await res.json());
    } catch { /* ignore */ }
    finally { setScoreFetching(false); }
  }, [course]);

  useEffect(() => {
    if (scoreTimerRef.current) clearTimeout(scoreTimerRef.current);
    scoreTimerRef.current = setTimeout(fetchScore, 800);
    return () => { if (scoreTimerRef.current) clearTimeout(scoreTimerRef.current); };
  }, [fetchScore]);

  // ── Save step ──────────────────────────────────────────────────────────────
  const saveStep = useCallback(async (action: string, data: object) => {
    setSaving(true);
    try {
      const res = await fetch(`${getApiBase()}/course-create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ action, course_id: course.id, ...data }),
      });
      const json = await res.json();
      if (json.course_id && !course.id) setCourse((c) => ({ ...c, id: json.course_id }));
      return json;
    } catch { return null; }
    finally { setSaving(false); }
  }, [course.id]);

  // ── Generate AI cover ──────────────────────────────────────────────────────
  const generateCover = async () => {
    if (!course.title || !course.category) return;
    setAiGenerating(true);
    try {
      const res = await fetch(`${getApiBase()}/dall-e-cover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          course_id: course.id || 'preview',
          title: course.title,
          category: course.category,
          level: course.level,
        }),
      });
      const json = await res.json();
      if (json.cover_url) setCourse((c) => ({ ...c, cover_image_url: json.cover_url }));
    } catch { /* ignore */ }
    finally { setAiGenerating(false); }
  };

  // ── Step navigation ────────────────────────────────────────────────────────
  const handleNext = async () => {
    if (step === 0) {
      const json = await saveStep('save_step', {
        title: course.title, description: course.description,
        category: course.category, level: course.level,
        language: course.language, prerequisites: course.prerequisites,
        objectives: course.objectives.map((o) => o.text).filter(Boolean),
        cover_image_url: course.cover_image_url,
        requested_cpd: course.requested_cpd ? 1 : 0,
        sous_categorie_langue: sousCategorie || null,
        champs_sous_categorie: champsSousCategorie,
        niveau_cecrl: niveauCecrl || null,
        langue_enseignee: langueEnseignee || null,
        langue_instruction: langueInstruction,
      });
      if (json?.course_id) setCourse((c) => ({ ...c, id: json.course_id }));
    }
    setStep((s) => Math.min(s + 1, 4));
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!course.id) return;
    setSubmitting(true);
    setSubmitErrors([]);
    try {
      const res = await fetch(`${getApiBase()}/course-submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          course_id: course.id,
          final_validation_type: course.final_validation_type,
          sous_categorie_langue: sousCategorie || null,
          champs_sous_categorie: champsSousCategorie,
          niveau_cecrl: niveauCecrl || null,
          langue_enseignee: langueEnseignee || null,
          langue_instruction: langueInstruction,
          examen_oral_statut: proposeExamenOral ? 'propose_par_professeur' : 'non_propose',
          examen_oral_consignes: proposeExamenOral ? examenOralConsignes : null,
          examen_oral_criteres: proposeExamenOral ? examenOralCriteres : null,
        }),
      });
      const json = await res.json();
      if (res.ok) { setSubmitted(true); }
      else { setSubmitErrors(json.errors || [json.error || 'Erreur lors de la soumission']); }
    } catch { setSubmitErrors(['Erreur réseau']); }
    finally { setSubmitting(false); }
  };

  // ── Module/Lesson helpers ──────────────────────────────────────────────────
  const addModule = () => {
    if (course.modules.length >= 8) return;
    setCourse((c) => ({ ...c, modules: [...c.modules, emptyModule(c.modules.length + 1)] }));
  };
  const removeModule = (mIdx: number) => {
    if (course.modules.length <= 1) return;
    setCourse((c) => ({ ...c, modules: c.modules.filter((_, i) => i !== mIdx).map((m, i) => ({ ...m, position: i + 1 })) }));
  };
  const updateModule = (mIdx: number, field: keyof Module, val: any) => {
    setCourse((c) => ({ ...c, modules: c.modules.map((m, i) => i === mIdx ? { ...m, [field]: val } : m) }));
  };
  const addLesson = (mIdx: number) => {
    if (course.modules[mIdx].lessons.length >= 6) return;
    setCourse((c) => ({
      ...c, modules: c.modules.map((m, i) =>
        i === mIdx ? { ...m, lessons: [...m.lessons, emptyLesson(m.lessons.length + 1)] } : m),
    }));
  };
  const removeLesson = (mIdx: number, lIdx: number) => {
    if (course.modules[mIdx].lessons.length <= 1) return;
    setCourse((c) => ({
      ...c, modules: c.modules.map((m, i) =>
        i === mIdx ? { ...m, lessons: m.lessons.filter((_, j) => j !== lIdx).map((l, j) => ({ ...l, position: j + 1 })) } : m),
    }));
  };
  const updateLesson = (mIdx: number, lIdx: number, field: keyof Lesson, val: any) => {
    setCourse((c) => ({
      ...c, modules: c.modules.map((m, i) =>
        i === mIdx ? { ...m, lessons: m.lessons.map((l, j) => j === lIdx ? { ...l, [field]: val } : l) } : m),
    }));
  };
  const addQuestion = (mIdx: number, lIdx: number) => {
    const lesson = course.modules[mIdx].lessons[lIdx];
    if (lesson.questions.length >= 20) return;
    const q: Question = { id: `q_${Date.now()}`, question_text: '', question_type: 'mcq', options: ['', '', '', ''], correct_answer: '' };
    updateLesson(mIdx, lIdx, 'questions', [...lesson.questions, q]);
  };
  const updateQuestion = (mIdx: number, lIdx: number, qIdx: number, field: keyof Question, val: any) => {
    const questions = course.modules[mIdx].lessons[lIdx].questions.map((q, i) =>
      i === qIdx ? { ...q, [field]: val } : q);
    updateLesson(mIdx, lIdx, 'questions', questions);
  };
  const updateQuestionOption = (mIdx: number, lIdx: number, qIdx: number, oIdx: number, val: string) => {
    const questions = course.modules[mIdx].lessons[lIdx].questions.map((q, i) => {
      if (i !== qIdx) return q;
      const opts = [...q.options]; opts[oIdx] = val; return { ...q, options: opts };
    });
    updateLesson(mIdx, lIdx, 'questions', questions);
  };
  const addResource = (mIdx: number, lIdx: number) => {
    const r: Resource = { id: `r_${Date.now()}`, resource_type: 'lien', title: '', url: '' };
    updateLesson(mIdx, lIdx, 'resources', [...course.modules[mIdx].lessons[lIdx].resources, r]);
  };
  const updateResource = (mIdx: number, lIdx: number, rIdx: number, field: keyof Resource, val: string) => {
    const resources = course.modules[mIdx].lessons[lIdx].resources.map((r, i) =>
      i === rIdx ? { ...r, [field]: val } : r);
    updateLesson(mIdx, lIdx, 'resources', resources);
  };
  const removeQuestion = (mIdx: number, lIdx: number, qIdx: number) => {
    updateLesson(mIdx, lIdx, 'questions', course.modules[mIdx].lessons[lIdx].questions.filter((_, i) => i !== qIdx));
  };
  const removeResource = (mIdx: number, lIdx: number, rIdx: number) => {
    updateLesson(mIdx, lIdx, 'resources', course.modules[mIdx].lessons[lIdx].resources.filter((_, i) => i !== rIdx));
  };

  // ── Save lesson content ────────────────────────────────────────────────────
  const saveLessonContent = async (mIdx: number, lIdx: number) => {
    const l = course.modules[mIdx].lessons[lIdx];
    if (!l.id.startsWith('new_')) {
      await saveStep('save_lesson_content', {
        lesson_id: l.id, content_text: l.content_text,
        video_url: l.video_url, audio_url: l.audio_url, summary: l.summary,
        questions: l.questions, resources: l.resources,
        is_external: l.is_external, external_url: l.external_url, external_partner: l.external_partner,
        audio_text_to_generate: l.audio_text_to_generate || null,
      });
    }
  };

  if (submitted) {
    return (
      <DashboardLayout role={is_admin ? 'admin' : 'professeur'}>
        <div className="p-6 lg:p-8 max-w-2xl mx-auto text-center py-20">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: '#1E7A52' + '15' }}>
            <CheckCircle className="w-8 h-8" style={{ color: '#1E7A52' }} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Formation soumise !</h1>
          <p className="text-gray-500 mb-8">
            Votre formation est en cours de validation. Vous recevrez une notification
            dès qu'elle aura été examinée par notre équipe.
          </p>
          <button onClick={() => navigate(is_admin ? '/admin/courses' : '/professeur/courses')}
            className="px-6 py-3 rounded-xl text-white font-semibold"
            style={{ backgroundColor: '#002050' }}>
            {is_admin ? 'Retour au catalogue admin' : 'Retour à mes formations'}
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role={is_admin ? 'admin' : 'professeur'}>
      <div className="p-4 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">
            {id ? 'Modifier la formation' : 'Nouvelle formation'}
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">Assistant de création en 5 étapes</p>
        </div>

        {/* Admin-only: mode switcher */}
        {is_admin && (
          <div className="mb-6 flex items-center gap-3 p-4 rounded-xl border" style={{ borderColor: '#002050', backgroundColor: '#F0F4FF' }}>
            <Info className="w-4 h-4 flex-shrink-0" style={{ color: '#002050' }} />
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: '#002050' }}>Mode saisie assistée (Super-admin)</p>
              <p className="text-xs text-gray-500">Toutes les options avancées sont déverrouillées.</p>
            </div>
            <button
              type="button"
              onClick={() => setPlateformeMode(v => !v)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border"
              style={{
                borderColor: plateformeMode ? '#002050' : '#D1D5DB',
                backgroundColor: plateformeMode ? '#002050' : '#FFFFFF',
                color: plateformeMode ? '#FFFFFF' : '#374151',
              }}>
              <FileText className="w-3.5 h-3.5" />
              {plateformeMode ? 'Mode Plateforme actif' : 'Mode Plateforme'}
            </button>
          </div>
        )}

        {/* Admin: Plateforme mode — simplified upload without mandatory architecture */}
        {is_admin && plateformeMode && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4" style={{ color: '#BF8813' }} />
              <h2 className="font-semibold text-gray-900">Formation Plateforme — Import direct</h2>
            </div>
            <p className="text-sm text-gray-500">Ce mode permet de créer une formation en important directement un PDF, Word ou SCORM sans architecture de modules obligatoire. Le contenu sera traité par la plateforme.</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titre de la formation *</label>
                <input value={course.title} onChange={(e) => setCourse((c) => ({ ...c, title: e.target.value }))}
                  placeholder="Ex: Comptabilité générale"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie *</label>
                <select value={course.category} onChange={(e) => setCourse((c) => ({ ...c, category: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white">
                  <option value="">Choisir...</option>
                  {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fichier de contenu (PDF / Word / SCORM)</label>
              <div className="flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50">
                <Upload className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500">Glissez-déposez un fichier ou cliquez pour sélectionner</p>
                  <p className="text-xs text-gray-400 mt-0.5">.pdf, .docx, .zip (SCORM) — max 50 Mo</p>
                </div>
                <label className="px-3 py-1.5 rounded-lg text-xs font-medium text-white cursor-pointer" style={{ backgroundColor: '#002050' }}>
                  Parcourir
                  <input type="file" accept=".pdf,.docx,.zip" className="hidden" onChange={() => {}} />
                </label>
              </div>
              <p className="text-xs text-gray-400 mt-1">Note : le traitement du fichier sera effectué manuellement par l'équipe technique.</p>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={handleNext}
                disabled={!course.title || !course.category}
                className="flex items-center gap-2 text-sm font-semibold text-white px-5 py-2.5 rounded-xl disabled:opacity-50"
                style={{ backgroundColor: '#002050' }}>
                Continuer avec l'assistant <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Stepper */}
        <div className="flex items-center gap-0 mb-8 bg-white rounded-xl border border-gray-100 shadow-sm p-4 overflow-x-auto">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center flex-shrink-0">
              <button onClick={() => i < step && setStep(i)}
                className={`flex items-center gap-2 text-sm font-medium transition-colors ${i === step ? 'text-white' : i < step ? 'text-gray-700' : 'text-gray-400'}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  i < step ? 'text-white' : i === step ? 'text-white' : 'bg-gray-100 text-gray-400'
                }`} style={i <= step ? { backgroundColor: '#002050' } : {}}>
                  {i < step ? <CheckCircle className="w-4 h-4" /> : i + 1}
                </span>
                <span className="hidden sm:block">{s}</span>
              </button>
              {i < STEPS.length - 1 && (
                <ChevronRight className="w-4 h-4 mx-2 text-gray-200 flex-shrink-0" />
              )}
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-[1fr_220px] gap-6">
          {/* Main content */}
          <div>
            {/* ── Step 0: Infos générales ── */}
            {step === 0 && (
              <div className="space-y-5">
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <h2 className="font-semibold text-gray-900 mb-4">Informations de base</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Titre de la formation *</label>
                      <input value={course.title} onChange={(e) => setCourse((c) => ({ ...c, title: e.target.value }))}
                        placeholder="Ex: Comptabilité générale pour non-comptables"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                      <textarea rows={4} value={course.description}
                        onChange={(e) => setCourse((c) => ({ ...c, description: e.target.value }))}
                        placeholder="Décrivez votre formation en détail..."
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none" />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie *</label>
                        <select value={course.category} onChange={(e) => setCourse((c) => ({ ...c, category: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white">
                          <option value="">Choisir...</option>
                          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Niveau *</label>
                        <select value={course.level} onChange={(e) => setCourse((c) => ({ ...c, level: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white">
                          {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Langue</label>
                        <select value={course.language} onChange={(e) => setCourse((c) => ({ ...c, language: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white">
                          {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* ── Language-specific fields ── */}
                    {course.category?.toLowerCase().includes('langue') && (
                      <div className="space-y-4 pt-3 border-t border-gray-100">
                        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#002050' }}>Paramètres de langue</p>
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Langue enseignée *</label>
                            <input type="text" value={langueEnseignee} onChange={e => setLangueEnseignee(e.target.value)}
                              placeholder="Ex: Anglais, Français, Arabe, Bambara"
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Niveau CECRL *</label>
                            <select value={niveauCecrl} onChange={e => setNiveauCecrl(e.target.value)}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white">
                              <option value="">Sélectionner le niveau</option>
                              <option value="A1">A1 — Débutant</option>
                              <option value="A2">A2 — Élémentaire</option>
                              <option value="B1">B1 — Intermédiaire</option>
                              <option value="B2">B2 — Intermédiaire avancé</option>
                              <option value="C1">C1 — Avancé</option>
                              <option value="C2">C2 — Maîtrise</option>
                            </select>
                            <p className="text-xs mt-1" style={{ color: '#6B7280' }}>Cadre Européen Commun de Référence</p>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Type de formation de langue *</label>
                          <select value={sousCategorie} onChange={e => { setSousCategorie(e.target.value); setChampsSousCategorie({}); }}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white">
                            <option value="">Sélectionner le type</option>
                            <option value="generale">Langue générale / conversationnelle</option>
                            <option value="affaires">Langue des affaires</option>
                            <option value="technique">Langue technique / spécialisée</option>
                            <option value="preparation_certification">Préparation à une certification</option>
                          </select>
                        </div>
                        {sousCategorie === 'affaires' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Secteur professionnel ciblé *</label>
                            <input type="text" value={champsSousCategorie.secteurProfessionnel || ''}
                              onChange={e => setChampsSousCategorie({ ...champsSousCategorie, secteurProfessionnel: e.target.value })}
                              placeholder="Vente, Hôtellerie, Finance, Diplomatie..."
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                          </div>
                        )}
                        {sousCategorie === 'technique' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Domaine technique ciblé *</label>
                            <input type="text" value={champsSousCategorie.domaineTechnique || ''}
                              onChange={e => setChampsSousCategorie({ ...champsSousCategorie, domaineTechnique: e.target.value })}
                              placeholder="Médical, Juridique, Informatique..."
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                          </div>
                        )}
                        {sousCategorie === 'preparation_certification' && (
                          <>
                            <div className="grid sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Certification visée *</label>
                                <input type="text" value={champsSousCategorie.certificationVisee || ''}
                                  onChange={e => setChampsSousCategorie({ ...champsSousCategorie, certificationVisee: e.target.value })}
                                  placeholder="TOEFL, IELTS, DELF/DALF, Cambridge..."
                                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Niveau ou score visé *</label>
                                <input type="text" value={champsSousCategorie.niveauOuScoreVise || ''}
                                  onChange={e => setChampsSousCategorie({ ...champsSousCategorie, niveauOuScoreVise: e.target.value })}
                                  placeholder="Ex: B2, Score 90+, Grade A..."
                                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                              </div>
                            </div>
                            <div className="rounded-xl p-4 border" style={{ borderColor: '#F97316', backgroundColor: '#FFF7ED' }}>
                              <p className="text-sm font-semibold" style={{ color: '#7C3A00' }}>Avertissement obligatoire</p>
                              <p className="text-sm mt-1" style={{ color: '#7C3A00' }}>
                                Cette formation prépare à la certification mais ne la délivre pas. Seul l'organisme officiel émet la certification.
                              </p>
                              <p className="text-xs mt-2" style={{ color: '#9A3412' }}>
                                Cet avertissement sera affiché sur la fiche de votre formation dans le catalogue.
                              </p>
                            </div>
                          </>
                        )}
                        {sousCategorie && (
                          <div className="rounded-xl p-4 border" style={{ borderColor: '#002050', backgroundColor: 'rgba(0,32,80,0.03)' }}>
                            <p className="font-semibold text-sm mb-2" style={{ color: '#002050' }}>Audio et exercices interactifs</p>
                            <p className="text-sm mb-2" style={{ color: '#374151' }}>
                              <strong>Audio (obligatoire, 1 minimum par module) :</strong> Importez un fichier ou écrivez le texte — la plateforme génère l'audio automatiquement.
                            </p>
                            <p className="text-sm mb-2" style={{ color: '#374151' }}>
                              <strong>Exercices interactifs :</strong> Flashcards, textes à trous et dictées générés automatiquement depuis votre contenu.
                            </p>
                            <p className="text-sm" style={{ color: '#374151' }}>
                              <strong>Examen oral (optionnel) :</strong> Proposez un examen oral à l'étape Évaluation.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                    {/* CPD toggle */}
                    <button
                      type="button"
                      onClick={() => setCourse(c => ({ ...c, requested_cpd: !c.requested_cpd }))}
                      className="w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left"
                      style={{
                        borderColor: course.requested_cpd ? '#1E7A52' : '#E4E7EC',
                        backgroundColor: course.requested_cpd ? '#F0FDF4' : '#F9FAFB',
                      }}>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: course.requested_cpd ? '#1E7A52' : '#374151' }}>
                          Demander l'accréditation CPD
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
                          Votre formation sera évaluée pour l'attribution de crédits CPD. Une fois accordée, elle sera visible dans le catalogue CPD.
                        </p>
                      </div>
                      <div className="flex-shrink-0 ml-4">
                        <div className={`relative w-12 h-6 rounded-full transition-colors`}
                          style={{ backgroundColor: course.requested_cpd ? '#1E7A52' : '#D1D5DB' }}>
                          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${course.requested_cpd ? 'translate-x-6' : 'translate-x-0.5'}`} />
                        </div>
                      </div>
                    </button>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Prérequis</label>
                      <textarea rows={2} value={course.prerequisites}
                        onChange={(e) => setCourse((c) => ({ ...c, prerequisites: e.target.value }))}
                        placeholder="Aucun prérequis spécifique (ou liste les prérequis...)"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none" />
                    </div>
                  </div>
                </div>

                {/* Objectives */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-gray-900">Objectifs pédagogiques *</h2>
                    <span className="text-xs text-gray-400">Minimum 3</span>
                  </div>
                  <div className="space-y-2">
                    {course.objectives.map((obj, i) => (
                      <div key={obj.id} className="flex gap-2">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-2"
                          style={{ backgroundColor: '#002050' + '15', color: '#002050' }}>{i + 1}</span>
                        <input value={obj.text}
                          onChange={(e) => setCourse((c) => ({
                            ...c, objectives: c.objectives.map((o, j) => j === i ? { ...o, text: e.target.value } : o)
                          }))}
                          placeholder={`Objectif ${i + 1}...`}
                          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                        {course.objectives.length > 1 && (
                          <button onClick={() => setCourse((c) => ({ ...c, objectives: c.objectives.filter((_, j) => j !== i) }))}
                            className="text-gray-300 hover:text-red-400 mt-2">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button onClick={() => setCourse((c) => ({ ...c, objectives: [...c.objectives, { id: `obj_${Date.now()}`, text: '' }] }))}
                      className="flex items-center gap-1 text-sm mt-1" style={{ color: '#002050' }}>
                      <PlusCircle className="w-4 h-4" /> Ajouter un objectif
                    </button>
                  </div>
                </div>

                {/* Cover */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <h2 className="font-semibold text-gray-900 mb-4">Image de couverture *</h2>
                  <div className="flex gap-4 items-start">
                    {course.cover_image_url ? (
                      <div className="relative w-32 h-20 rounded-lg overflow-hidden flex-shrink-0 border border-gray-100">
                        <img src={course.cover_image_url} alt="" className="w-full h-full object-cover" />
                        <button onClick={() => setCourse((c) => ({ ...c, cover_image_url: '' }))}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs">×</button>
                      </div>
                    ) : (
                      <div className="w-32 h-20 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: '#002050' + '10' }}>
                        <BookOpen className="w-6 h-6" style={{ color: '#002050' + '40' }} />
                      </div>
                    )}
                    <div className="flex-1 space-y-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">URL de l'image</label>
                        <input value={course.cover_image_url}
                          onChange={(e) => setCourse((c) => ({ ...c, cover_image_url: e.target.value }))}
                          placeholder="https://..."
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={generateCover}
                          disabled={aiGenerating || !course.title || !course.category}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium border disabled:opacity-50 transition-colors"
                          style={{ borderColor: '#BF8813', color: '#BF8813' }}>
                          {aiGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                          Générer avec IA
                        </button>
                        <span className="text-xs text-gray-400 self-center">Gratuit · DALL-E 3</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 1: Structure ── */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700 flex gap-2">
                  <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>Créez entre <strong>3 et 8 modules</strong>, chaque module doit avoir entre <strong>2 et 6 leçons</strong>.</span>
                </div>
                {course.modules.map((mod, mIdx) => (
                  <div key={mod.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 flex items-center gap-3 border-b border-gray-50 cursor-pointer"
                      onClick={() => updateModule(mIdx, 'expanded', !mod.expanded)}>
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: '#002050', color: 'white' }}>{mIdx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <input value={mod.title}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => updateModule(mIdx, 'title', e.target.value)}
                          placeholder={`Titre du module ${mIdx + 1}...`}
                          className="w-full text-sm font-medium border-0 bg-transparent focus:outline-none text-gray-900 placeholder-gray-300" />
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-gray-400">{mod.lessons.length} leçon{mod.lessons.length > 1 ? 's' : ''}</span>
                        {mod.expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        {course.modules.length > 1 && (
                          <button onClick={(e) => { e.stopPropagation(); removeModule(mIdx); }}
                            className="text-gray-300 hover:text-red-400">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    {mod.expanded && (
                      <div className="p-5 space-y-2">
                        {mod.lessons.map((lesson, lIdx) => (
                          <div key={lesson.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: '#f9fafb' }}>
                            <span className="text-xs text-gray-400 w-5 text-center font-medium">{mIdx + 1}.{lIdx + 1}</span>
                            <input value={lesson.title}
                              onChange={(e) => updateLesson(mIdx, lIdx, 'title', e.target.value)}
                              placeholder={`Titre de la leçon ${lIdx + 1}...`}
                              className="flex-1 text-sm border-0 bg-transparent focus:outline-none text-gray-700 placeholder-gray-300" />
                            {mod.lessons.length > 1 && (
                              <button onClick={() => removeLesson(mIdx, lIdx)} className="text-gray-300 hover:text-red-400">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                        {mod.lessons.length < 6 && (
                          <button onClick={() => addLesson(mIdx)}
                            className="flex items-center gap-1 text-xs mt-1" style={{ color: '#002050' }}>
                            <PlusCircle className="w-3.5 h-3.5" /> Ajouter une leçon
                          </button>
                        )}
                        {/* Language competences — only for Langues & Linguistique */}
                        {course.category?.toLowerCase().includes('langue') && (
                          <div className="mt-4 pt-4 border-t border-gray-100">
                            <p className="text-sm font-semibold mb-2" style={{ color: '#002050' }}>Compétences linguistiques couvertes dans ce module *</p>
                            <p className="text-xs mb-3" style={{ color: '#6B7280' }}>
                              Cochez toutes les compétences abordées. Les 4 compétences doivent être couvertes sur l'ensemble de la formation.
                            </p>
                            <div className="grid grid-cols-2 gap-1">
                              {[
                                { id: 'comprehension_orale', label: 'Compréhension orale' },
                                { id: 'comprehension_ecrite', label: 'Compréhension écrite' },
                                { id: 'expression_orale', label: 'Expression orale' },
                                { id: 'expression_ecrite', label: 'Expression écrite' },
                              ].map(comp => (
                                <label key={comp.id} className="flex items-center gap-2 py-1.5 cursor-pointer">
                                  <input type="checkbox"
                                    checked={mod.competences_linguistiques?.includes(comp.id) ?? false}
                                    onChange={e => {
                                      const cur = mod.competences_linguistiques || [];
                                      const updated = e.target.checked
                                        ? [...cur, comp.id]
                                        : cur.filter(c => c !== comp.id);
                                      updateModule(mIdx, 'competences_linguistiques', updated);
                                    }}
                                    className="w-4 h-4" style={{ accentColor: '#002050' }} />
                                  <span className="text-sm" style={{ color: '#374151' }}>{comp.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {course.modules.length < 8 && (
                  <button onClick={addModule}
                    className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm font-medium text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-colors flex items-center justify-center gap-2">
                    <PlusCircle className="w-4 h-4" /> Ajouter un module
                  </button>
                )}
              </div>
            )}

            {/* ── Step 2: Contenu ── */}
            {step === 2 && (
              <div className="space-y-5">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700 flex gap-2">
                  <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>Chaque leçon doit contenir au minimum <strong>100 mots</strong> de contenu textuel.</span>
                </div>
                {course.modules.map((mod, mIdx) =>
                  mod.lessons.map((lesson, lIdx) => {
                    const wordCount = lesson.content_text.trim().split(/\s+/).filter(Boolean).length;
                    return (
                      <div key={lesson.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between cursor-pointer"
                          onClick={() => updateLesson(mIdx, lIdx, 'expanded', !lesson.expanded)}>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: '#002050' + '10', color: '#002050' }}>
                              {mIdx + 1}.{lIdx + 1}
                            </span>
                            <span className="text-sm font-medium text-gray-700">{lesson.title || `Leçon ${lIdx + 1}`}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${wordCount >= 100 ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-500'}`}>
                              {wordCount} mots
                            </span>
                            {lesson.expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                          </div>
                        </div>
                        {lesson.expanded && (
                          <div className="p-5 space-y-4">
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                                <FileText className="w-3 h-3" /> Contenu textuel *
                              </label>
                              <textarea rows={8} value={lesson.content_text}
                                onChange={(e) => updateLesson(mIdx, lIdx, 'content_text', e.target.value)}
                                placeholder="Rédigez le contenu pédagogique de cette leçon..."
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none" />
                              <div className={`text-xs mt-1 ${wordCount >= 100 ? 'text-green-500' : 'text-orange-400'}`}>
                                {wordCount < 100 ? `${100 - wordCount} mots manquants` : `${wordCount} mots — OK`}
                              </div>
                            </div>
                            <div className="grid sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                                  <Video className="w-3 h-3" /> Vidéo (URL, optionnel)
                                </label>
                                <input value={lesson.video_url}
                                  onChange={(e) => updateLesson(mIdx, lIdx, 'video_url', e.target.value)}
                                  placeholder="https://youtube.com/..."
                                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                                  <Headphones className="w-3 h-3" /> Audio (URL, optionnel)
                                </label>
                                <input value={lesson.audio_url}
                                  onChange={(e) => updateLesson(mIdx, lIdx, 'audio_url', e.target.value)}
                                  placeholder="https://..."
                                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                              </div>
                            </div>

                            {/* External partner lesson — super_admin + établissement only */}
                            {canAddExternalLesson && (
                              <div className="border-t border-gray-100 pt-4">
                                <button
                                  type="button"
                                  onClick={() => updateLesson(mIdx, lIdx, 'is_external', !lesson.is_external)}
                                  className="flex items-center gap-3 w-full p-3 rounded-xl border-2 transition-all text-left"
                                  style={{
                                    borderColor: lesson.is_external ? '#BF8813' : '#E4E7EC',
                                    backgroundColor: lesson.is_external ? '#FFFBEB' : '#F9FAFB',
                                  }}>
                                  <Link2 className="w-4 h-4 flex-shrink-0" style={{ color: lesson.is_external ? '#BF8813' : '#9CA3AF' }} />
                                  <div className="flex-1">
                                    <p className="text-sm font-medium" style={{ color: lesson.is_external ? '#BF8813' : '#374151' }}>
                                      Lien externe partenaire
                                    </p>
                                    <p className="text-xs text-gray-400">La leçon redirige vers un contenu externe. Non comptabilisée dans le timer CPD.</p>
                                  </div>
                                  <div className="relative w-10 h-5 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: lesson.is_external ? '#BF8813' : '#D1D5DB' }}>
                                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${lesson.is_external ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                  </div>
                                </button>
                                {lesson.is_external && (
                                  <div className="grid sm:grid-cols-2 gap-3 mt-3">
                                    <div>
                                      <label className="block text-xs font-medium text-gray-500 mb-1">URL du contenu partenaire *</label>
                                      <input value={lesson.external_url}
                                        onChange={e => updateLesson(mIdx, lIdx, 'external_url', e.target.value)}
                                        placeholder="https://partenaire.com/contenu"
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-gray-500 mb-1">Nom du partenaire</label>
                                      <input value={lesson.external_partner}
                                        onChange={e => updateLesson(mIdx, lIdx, 'external_partner', e.target.value)}
                                        placeholder="Ex: Coursera, edX, …"
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Résumé (optionnel)</label>
                              <textarea rows={2} value={lesson.summary}
                                onChange={(e) => updateLesson(mIdx, lIdx, 'summary', e.target.value)}
                                placeholder="Points clés de cette leçon..."
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none" />
                            </div>
                            {/* Audio for language courses */}
                            {course.category?.toLowerCase().includes('langue') && !lesson.is_external && (
                              <div className="p-4 rounded-xl border" style={{ borderColor: '#BF8813', backgroundColor: 'rgba(191,136,19,0.03)' }}>
                                <p className="font-semibold text-sm mb-3" style={{ color: '#002050' }}>
                                  Support audio (obligatoire — au moins 1 par module)
                                </p>
                                <div className="flex gap-3 mb-3">
                                  {(['upload', 'text'] as const).map(mode => (
                                    <button key={mode} type="button"
                                      onClick={() => updateLesson(mIdx, lIdx, 'audioMode', lesson.audioMode === mode ? '' : mode)}
                                      className="px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors"
                                      style={{
                                        backgroundColor: lesson.audioMode === mode ? '#002050' : 'white',
                                        color: lesson.audioMode === mode ? 'white' : '#374151',
                                        borderColor: '#002050',
                                      }}>
                                      {mode === 'upload' ? 'Importer un fichier audio' : 'Générer depuis le texte'}
                                    </button>
                                  ))}
                                </div>
                                {lesson.audioMode === 'upload' && (
                                  <div>
                                    <input type="file" accept=".mp3,.wav,.ogg,.m4a"
                                      onChange={e => {
                                        const file = e.target.files?.[0];
                                        if (file) updateLesson(mIdx, lIdx, 'audio_url', URL.createObjectURL(file));
                                      }}
                                      className="block w-full text-sm text-gray-500" />
                                    {lesson.audio_url && <p className="text-xs mt-1" style={{ color: '#1E7A52' }}>Fichier sélectionné</p>}
                                  </div>
                                )}
                                {lesson.audioMode === 'text' && (
                                  <div>
                                    <textarea
                                      value={lesson.audio_text_to_generate}
                                      onChange={e => updateLesson(mIdx, lIdx, 'audio_text_to_generate', e.target.value)}
                                      placeholder="Écrivez le texte à lire à voix haute..."
                                      rows={4}
                                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
                                    />
                                    <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
                                      La plateforme convertira ce texte en audio automatiquement (~150 mots/minute)
                                    </p>
                                    {lesson.audio_text_to_generate && !lesson.id.startsWith('new_') && (
                                      <button
                                        type="button"
                                        disabled={generatingAudio === lesson.id}
                                        onClick={async () => {
                                          setGeneratingAudio(lesson.id);
                                          try {
                                            const res = await fetch(`${getApiBase()}/tts-generate`, {
                                              method: 'POST',
                                              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
                                              body: JSON.stringify({ lesson_id: lesson.id, text: lesson.audio_text_to_generate }),
                                            });
                                            const data = await res.json();
                                            if (data.audio_url) updateLesson(mIdx, lIdx, 'audio_url', data.audio_url);
                                          } catch { /* ignore */ }
                                          finally { setGeneratingAudio(null); }
                                        }}
                                        className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60"
                                        style={{ backgroundColor: '#002050' }}>
                                        {generatingAudio === lesson.id
                                          ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Génération en cours...</>
                                          : <><Headphones className="w-3.5 h-3.5" /> Générer l'audio</>}
                                      </button>
                                    )}
                                    {lesson.audio_url && (
                                      <div className="mt-2">
                                        <p className="text-xs font-medium mb-1" style={{ color: '#1E7A52' }}>Audio disponible</p>
                                        <audio controls className="w-full h-8">
                                          <source src={lesson.audio_url} type="audio/mpeg" />
                                        </audio>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                            {/* Resources */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                                  <Link2 className="w-3 h-3" /> Ressources bonus
                                </label>
                                <button onClick={() => addResource(mIdx, lIdx)}
                                  className="text-xs" style={{ color: '#002050' }}>
                                  + Ajouter
                                </button>
                              </div>
                              {lesson.resources.map((r, rIdx) => (
                                <div key={r.id} className="flex gap-2 mb-2">
                                  <select value={r.resource_type}
                                    onChange={(e) => updateResource(mIdx, lIdx, rIdx, 'resource_type', e.target.value)}
                                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none bg-white">
                                    <option value="lien">Lien</option>
                                    <option value="pdf">PDF</option>
                                    <option value="exercice">Exercice</option>
                                  </select>
                                  <input value={r.title} onChange={(e) => updateResource(mIdx, lIdx, rIdx, 'title', e.target.value)}
                                    placeholder="Titre" className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none" />
                                  <input value={r.url} onChange={(e) => updateResource(mIdx, lIdx, rIdx, 'url', e.target.value)}
                                    placeholder="URL" className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none" />
                                  <button onClick={() => removeResource(mIdx, lIdx, rIdx)} className="text-gray-300 hover:text-red-400">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                            <button onClick={() => saveLessonContent(mIdx, lIdx)}
                              className="text-xs px-3 py-1.5 rounded-lg text-white font-medium"
                              style={{ backgroundColor: '#002050' }}>
                              Sauvegarder cette leçon
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* ── Step 3: Évaluation ── */}
            {step === 3 && (
              <div className="space-y-5">
                {/* Final validation type */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <h2 className="font-semibold text-gray-900 mb-4">Type d'évaluation finale</h2>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {VALIDATION_TYPES.map((vt) => (
                      <button key={vt.value}
                        onClick={() => setCourse((c) => ({ ...c, final_validation_type: vt.value }))}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${course.final_validation_type === vt.value ? 'border-blue-200' : 'border-gray-100 hover:border-gray-200'}`}
                        style={course.final_validation_type === vt.value ? { backgroundColor: '#002050' + '08', borderColor: '#002050' + '40' } : {}}>
                        <div className="font-medium text-sm text-gray-900">{vt.label}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{vt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Oral exam — only for language courses */}
                {course.category?.toLowerCase().includes('langue') && (
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-semibold text-sm" style={{ color: '#002050' }}>Proposer un examen oral (optionnel)</p>
                        <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
                          L'apprenant enregistre sa voix. Vous l'évaluez selon votre grille. Ajoute +6 points au score de la formation.
                        </p>
                      </div>
                      <button type="button" onClick={() => setProposeExamenOral(v => !v)}
                        className="relative w-12 h-6 rounded-full flex-shrink-0 transition-colors"
                        style={{ backgroundColor: proposeExamenOral ? '#1E7A52' : '#D1D5DB' }}>
                        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${proposeExamenOral ? 'translate-x-6' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                    {proposeExamenOral && (
                      <div className="space-y-4 pt-4 border-t border-gray-100">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Consignes d'enregistrement *</label>
                          <textarea value={examenOralConsignes} onChange={e => setExamenOralConsignes(e.target.value)}
                            placeholder="Ex: Enregistrez-vous pendant 3 minutes en vous présentant et en décrivant votre journée typique..."
                            rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-3">Grille d'évaluation</label>
                          <div className="space-y-2">
                            {[
                              { id: 'prononciation', label: 'Prononciation (sur 20)' },
                              { id: 'vocabulaire', label: 'Vocabulaire (sur 20)' },
                              { id: 'grammaire', label: 'Grammaire (sur 20)' },
                              { id: 'fluidite', label: 'Fluidité (sur 20)' },
                              { id: 'comprehension', label: 'Compréhension (sur 20)' },
                            ].map(critere => (
                              <div key={critere.id} className="flex items-center justify-between">
                                <span className="text-sm" style={{ color: '#374151' }}>{critere.label}</span>
                                <input type="number" min="0" max="20"
                                  value={examenOralCriteres[critere.id] ?? 20}
                                  onChange={e => setExamenOralCriteres(prev => ({ ...prev, [critere.id]: parseInt(e.target.value) || 0 }))}
                                  className="w-16 border border-gray-200 rounded px-2 py-1 text-sm text-center focus:outline-none" />
                              </div>
                            ))}
                            <p className="text-xs pt-1" style={{ color: '#6B7280' }}>Total : 100 points. Seuil de réussite : 60/100.</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Questions per lesson */}
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700 flex gap-2">
                  <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>Chaque leçon doit avoir entre <strong>5 et 20 questions QCM</strong>. L'IA peut générer les options manquantes lors de la soumission.</span>
                </div>
                {course.modules.map((mod, mIdx) =>
                  mod.lessons.map((lesson, lIdx) => (
                    <div key={lesson.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between cursor-pointer"
                        onClick={() => updateLesson(mIdx, lIdx, 'expanded', !lesson.expanded)}>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: '#002050' + '10', color: '#002050' }}>
                            {mIdx + 1}.{lIdx + 1}
                          </span>
                          <span className="text-sm font-medium text-gray-700">{lesson.title || `Leçon ${lIdx + 1}`}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            lesson.questions.length >= 5 ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-500'
                          }`}>
                            {lesson.questions.length} question{lesson.questions.length !== 1 ? 's' : ''}
                          </span>
                          {lesson.expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        </div>
                      </div>
                      {lesson.expanded && (
                        <div className="p-5 space-y-4">
                          {lesson.questions.map((q, qIdx) => (
                            <div key={q.id} className="border border-gray-100 rounded-xl p-4 space-y-3">
                              <div className="flex items-start gap-2">
                                <span className="text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5"
                                  style={{ backgroundColor: '#BF8813' + '15', color: '#BF8813' }}>Q{qIdx + 1}</span>
                                <input value={q.question_text}
                                  onChange={(e) => updateQuestion(mIdx, lIdx, qIdx, 'question_text', e.target.value)}
                                  placeholder="Rédigez votre question..."
                                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                                <button onClick={() => removeQuestion(mIdx, lIdx, qIdx)} className="text-gray-300 hover:text-red-400 flex-shrink-0">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                              <div className="grid sm:grid-cols-2 gap-2 pl-7">
                                {q.options.map((opt, oIdx) => (
                                  <div key={oIdx} className="flex items-center gap-2">
                                    <input type="radio" name={`correct_${q.id}`} checked={q.correct_answer === opt && !!opt}
                                      onChange={() => opt && updateQuestion(mIdx, lIdx, qIdx, 'correct_answer', opt)}
                                      className="flex-shrink-0" />
                                    <input value={opt}
                                      onChange={(e) => updateQuestionOption(mIdx, lIdx, qIdx, oIdx, e.target.value)}
                                      placeholder={`Option ${oIdx + 1}`}
                                      className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none" />
                                  </div>
                                ))}
                              </div>
                              {!q.correct_answer && q.options.some((o) => o) && (
                                <p className="text-xs text-orange-400 pl-7">Sélectionnez la bonne réponse (radio)</p>
                              )}
                              {!q.options.some((o) => o) && (
                                <p className="text-xs text-gray-400 pl-7 italic flex items-center gap-1">
                                  <Sparkles className="w-3 h-3" style={{ color: '#BF8813' }} />
                                  L'IA générera les options à la soumission si elles sont vides
                                </p>
                              )}
                            </div>
                          ))}
                          {lesson.questions.length < 20 && (
                            <button onClick={() => addQuestion(mIdx, lIdx)}
                              className="flex items-center gap-1 text-sm" style={{ color: '#002050' }}>
                              <PlusCircle className="w-4 h-4" /> Ajouter une question
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── Step 4: Soumettre ── */}
            {step === 4 && (
              <div className="space-y-5">
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <h2 className="font-semibold text-gray-900 mb-5">Récapitulatif et checklist</h2>
                  {[
                    { label: 'Titre renseigné', ok: !!course.title.trim() },
                    { label: 'Description renseignée', ok: course.description.trim().length >= 50 },
                    { label: 'Catégorie choisie', ok: !!course.category },
                    { label: 'Niveau choisi', ok: !!course.level },
                    { label: 'Image de couverture', ok: !!course.cover_image_url },
                    { label: 'Au moins 3 objectifs', ok: course.objectives.filter((o) => o.text.trim()).length >= 3 },
                    { label: '3 à 8 modules', ok: course.modules.length >= 3 && course.modules.length <= 8 },
                    { label: '2 à 6 leçons par module', ok: course.modules.every((m) => m.lessons.length >= 2 && m.lessons.length <= 6) },
                    { label: '5+ questions par leçon', ok: course.modules.every((m) => m.lessons.every((l) => l.questions.length >= 5)) },
                    { label: 'Contenu ≥100 mots par leçon', ok: course.modules.every((m) => m.lessons.every((l) => l.content_text.trim().split(/\s+/).filter(Boolean).length >= 100)) },
                    { label: 'Type d\'évaluation finale défini', ok: !!course.final_validation_type },
                    ...(course.category?.toLowerCase().includes('langue') ? [
                      { label: 'Langue enseignée renseignée', ok: !!langueEnseignee.trim() },
                      { label: 'Niveau CECRL défini', ok: !!niveauCecrl },
                      { label: 'Type de formation de langue défini', ok: !!sousCategorie },
                      { label: 'Audio dans chaque module (min. 1)', ok: course.modules.every(m => m.lessons.some(l => l.audio_url || l.audio_text_to_generate?.trim())) },
                      { label: '4 compétences linguistiques couvertes', ok: (() => {
                        const all = new Set(course.modules.flatMap(m => m.competences_linguistiques || []));
                        return ['comprehension_orale','comprehension_ecrite','expression_orale','expression_ecrite'].every(c => all.has(c));
                      })() },
                      ...(proposeExamenOral ? [{ label: 'Consignes d\'examen oral renseignées', ok: !!examenOralConsignes.trim() }] : []),
                    ] : []),
                  ].map(({ label, ok }) => (
                    <div key={label} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                      {ok ? (
                        <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#1E7A52' }} />
                      ) : (
                        <AlertCircle className="w-4 h-4 flex-shrink-0 text-orange-400" />
                      )}
                      <span className={`text-sm ${ok ? 'text-gray-700' : 'text-orange-500'}`}>{label}</span>
                    </div>
                  ))}
                </div>

                {submitErrors.length > 0 && (
                  <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                    <p className="text-sm font-medium text-red-700 mb-2">Erreurs de validation :</p>
                    <ul className="space-y-1">
                      {submitErrors.map((e, i) => (
                        <li key={i} className="text-sm text-red-600 flex items-start gap-2">
                          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {e}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-700 flex gap-2">
                  <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>Après soumission, votre formation sera examinée par notre équipe sous 48-72 heures. Si des corrections sont nécessaires, vous en serez informé par e-mail.</span>
                </div>

                <button onClick={handleSubmit} disabled={submitting || !course.id}
                  className="w-full py-3.5 rounded-xl text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
                  style={{ backgroundColor: '#1E7A52' }}>
                  {submitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Soumission en cours...</>
                  ) : (
                    <><CheckCircle className="w-4 h-4" /> Soumettre pour validation</>
                  )}
                </button>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-6">
              <button onClick={() => step === 0 ? navigate(is_admin ? '/admin/courses' : '/professeur/courses') : setStep((s) => s - 1)}
                className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors">
                <ChevronLeft className="w-4 h-4" />
                {step === 0 ? 'Annuler' : 'Précédent'}
              </button>
              {step < 4 && (
                <button onClick={handleNext}
                  disabled={saving || (step === 0 && (!course.title || !course.category))}
                  className="flex items-center gap-2 text-sm font-semibold text-white px-5 py-2.5 rounded-xl disabled:opacity-50 transition-opacity"
                  style={{ backgroundColor: '#002050' }}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Suivant <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* ScoreCard sidebar */}
          <div className="hidden lg:block">
            <ScoreCard score={scorePreview} preview={scoreFetching} />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
