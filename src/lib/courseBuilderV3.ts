export type CourseLevel = 'debutant' | 'intermediaire' | 'avance' | 'expert';
export type CourseLanguageCode = 'fr' | 'en' | 'es' | 'pt' | 'ar' | 'zh' | 'ru' | 'de' | 'bm';
export type InteractionMode = 'content' | 'training' | 'assessment';

export const COURSE_LEVEL_OPTIONS: Array<{ value: CourseLevel; label: string }> = [
  { value: 'debutant', label: 'Débutant' },
  { value: 'intermediaire', label: 'Intermédiaire' },
  { value: 'avance', label: 'Avancé' },
  { value: 'expert', label: 'Expert' },
];

export const COURSE_LANGUAGE_OPTIONS: Array<{ value: CourseLanguageCode; label: string }> = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'Anglais' },
  { value: 'es', label: 'Espagnol' },
  { value: 'pt', label: 'Portugais' },
  { value: 'ar', label: 'Arabe' },
  { value: 'zh', label: 'Chinois' },
  { value: 'ru', label: 'Russe' },
  { value: 'de', label: 'Allemand' },
  { value: 'bm', label: 'Bambara' },
];

export const COURSE_LANGUAGE_LABELS = Object.fromEntries(COURSE_LANGUAGE_OPTIONS.map(item => [item.value, item.label])) as Record<string, string>;
export const COURSE_LEVEL_LABELS = Object.fromEntries(COURSE_LEVEL_OPTIONS.map(item => [item.value, item.label])) as Record<string, string>;

export const TRAINING_CAPABLE_BLOCKS = new Set([
  'qcm', 'true_false', 'open_question', 'exercise', 'assignment_upload', 'case_study',
  'flashcards', 'interactive_table', 'checklist', 'cloze', 'dictation', 'pronunciation',
  'matching', 'sentence_order', 'oral_response', 'listening_comprehension', 'written_expression',
]);

export const ASSESSMENT_CAPABLE_BLOCKS = new Set([
  'qcm', 'true_false', 'open_question', 'exercise', 'assignment_upload', 'case_study',
  'cloze', 'dictation', 'pronunciation', 'matching', 'sentence_order', 'oral_response',
  'listening_comprehension', 'written_expression',
]);

export const ESSENTIAL_BLOCK_TYPES = [
  'text', 'heading', 'bullet_list', 'image', 'video', 'audio', 'interactive_table',
  'example', 'remember', 'quote', 'download', 'qcm',
];

export const BLOCK_SEARCH_ALIASES: Record<string, string[]> = {
  heading: ['titre', 'heading', 'section'],
  subheading: ['sous-titre', 'sous titre', 'subtitle'],
  text: ['texte', 'paragraphe', 'contenu'],
  bullet_list: ['liste', 'puces'], numbered_list: ['liste numérotée', 'numérotée'],
  callout: ['encadré', 'information', 'conseil', 'attention'], remember: ['à retenir', 'retenir'],
  objective: ['objectif'], example: ['exemple'], summary: ['résumé', 'synthèse'], definition: ['définition'],
  image: ['image', 'photo', 'illustration'], gallery: ['galerie', 'images'], video: ['vidéo', 'video'], audio: ['audio', 'son'],
  pdf: ['pdf', 'document'], word: ['word', 'docx', 'document'], excel: ['excel', 'xlsx', 'tableur'], download: ['fichier', 'téléchargement', 'ressource'],
  scorm: ['scorm'], embed: ['embed', 'intégration'],
  qcm: ['qcm', 'quiz'], true_false: ['vrai faux', 'vrai/faux'], open_question: ['question ouverte'], exercise: ['exercice'], assignment_upload: ['devoir', 'travail à remettre'],
  accordion: ['accordéon', 'faq'], flashcards: ['flashcards', 'cartes'], interactive_table: ['tableau interactif', 'tableau'], timeline: ['timeline', 'chronologie'],
  columns: ['colonnes'], code: ['code'], checklist: ['checklist', 'liste de contrôle'], formula: ['formule', 'math'], chart: ['graphique', 'courbe', 'camembert'],
  vocabulary: ['vocabulaire'], dialogue: ['dialogue'], cloze: ['texte à trous'], dictation: ['dictée'], pronunciation: ['prononciation'],
  matching: ['association'], sentence_order: ['phrase en ordre'], oral_response: ['réponse orale'], listening_comprehension: ['compréhension orale'], written_expression: ['expression écrite'],
};

export function emptyBlockContent(type: string): Record<string, any> {
  switch (type) {
    case 'heading': return { text: '', level: 1, alignment: 'left' };
    case 'subheading': return { text: '', level: 2, alignment: 'left' };
    case 'text': return { html: '' };
    case 'separator': return { style: 'line' };
    case 'callout': return { type: 'info', title: '', html: '', content: '' };
    case 'remember': return { title: '', points: [''] };
    case 'objective': return { title: '', html: '', text: '' };
    case 'example': return { title: '', html: '', content: '', situation: '', explication: '', conclusion: '' };
    case 'summary': return { title: '', html: '', content: '', intro: '', points: [] };
    case 'important': return { title: '', html: '', content: '' };
    case 'definition': return { title: '', term: '', definition: '', example: '' };
    case 'correction': return { title: '', html: '', content: '', key_points: [], reveal_mode: 'after_attempt' };
    case 'image': return { url: '', alt: '', caption: '', source: 'upload', rag_enabled: false };
    case 'gallery': return { images: [] };
    case 'video': return { url: '', thumbnail: '', eco_data: true, transcript: '', required_watch_percent: 0 };
    case 'audio': return { url: '', description: '', transcription: '' };
    case 'pdf': case 'word': return { url: '', title: '', description: '', downloadable: true, rag_enabled: false };
    case 'excel': return { url: '', title: '', sheet: '', preview_rows: [], rag_enabled: false };
    case 'download': return { url: '', title: '', description: '', rag_enabled: false };
    case 'scorm': return { url: '', title: '', package_type: 'scorm_2004', duration_min: 0, duration_source: 'automatic', scorm_ready: false };
    case 'qcm': return { question: '', options: ['', '', '', ''], correctIndex: 0, explanation: '', points: 10 };
    case 'true_false': return { statement: '', answer: true, explanation: '', points: 10 };
    case 'open_question': return { question: '', guidance: '', expected_answer: '', points: 10, rubric: [] };
    case 'exercise': return { title: '', instructions: '', task: '', resources: [], response_mode: 'text', accepted_types: ['pdf','doc','docx','xls','xlsx'], max_size_mb: 10, points: 10 };
    case 'assignment_upload': return { title: '', instructions: '', accepted_types: ['pdf', 'docx'], max_size_mb: 10, points: 10, rubric: [] };
    case 'case_study': return { context: '', data: '', task: '', questions: [], response_mode: 'text', response_layout: 'per_question', accepted_types: ['pdf','doc','docx','xls','xlsx','png','jpg'], max_size_mb: 10, points: 20, rubric: [] };
    case 'rubric': return { criteria: [{ name: '', description: '', points: 10 }] };
    case 'accordion': return { items: [{ id: crypto.randomUUID(), title: '', content: '' }] };
    case 'flashcards': return { cards: [{ id: crypto.randomUUID(), front: '', back: '' }], training_enabled: true };
    case 'interactive_table': return { title: '', headers: ['', ''], rows: [['', '']], mode: 'explore', style: 'table', training_column_indexes: [] };
    case 'timeline': return { steps: [{ id: crypto.randomUUID(), date: '', title: '', description: '' }] };
    case 'columns': return { columns: [{ id: crypto.randomUUID(), content: '' }, { id: crypto.randomUUID(), content: '' }], layout: '50-50' };
    case 'bullet_list': case 'numbered_list': return { title: '', items: [''] };
    case 'quote': return { title: '', html: '', text: '', author: '' };
    case 'code': return { language: 'text', code: '', caption: '', line_numbers: false, wrap: true };
    case 'checklist': return { items: [{ id: crypto.randomUUID(), text: '', required: true }], mode: 'personal' };
    case 'link_button': return { label: '', url: '', open_new_tab: true, style: 'link' };
    case 'embed': return { url: '', title: '' };
    case 'formula': return { latex: '', display_mode: 'block', explanation: '' };
    case 'chart': return { chart_type: 'bar', labels: [], values: [], series_name: '', unit: '' };
    case 'vocabulary': return { title: '', items: [{ term: '', translation: '', definition: '', example: '', audio_url: '' }] };
    case 'dialogue': return { title: '', lines: [{ speaker: 'A', text: '', translation: '', audio_url: '' }] };
    case 'cloze': return { title: '', text: '', answers: [], instructions: '', points: 10 };
    case 'dictation': return { title: '', audio_url: '', transcript: '', instructions: '', points: 10 };
    case 'pronunciation': return { title: '', items: [{ text: '', phonetic: '', audio_url: '' }], instructions: '', points: 10 };
    case 'matching': return { title: '', pairs: [{ left: '', right: '' }], instructions: '', points: 10 };
    case 'sentence_order': return { title: '', sentence: '', tokens: [], accepted_orders: [], instructions: '', points: 10 };
    case 'oral_response': return { title: '', prompt: '', reference_audio_url: '', guidance: '', max_duration_seconds: 120, points: 10, rubric: [] };
    case 'listening_comprehension': return { title: '', audio_url: '', transcript: '', questions: [], points: 10 };
    case 'written_expression': return { title: '', prompt: '', guidance: '', target_words: 0, points: 20, rubric: [] };
    default: return {};
  }
}

export function canonicalizeBlockContent(type: string, raw: Record<string, any> | null | undefined): Record<string, any> {
  const c = { ...emptyBlockContent(type), ...(raw || {}) };
  if (type === 'objective') c.text = c.text || stripHtml(c.html || '');
  if (type === 'example') c.content = c.content || stripHtml(c.html || '');
  if (type === 'summary') c.content = c.content || stripHtml(c.html || c.intro || '');
  if (type === 'important') c.content = c.content || stripHtml(c.html || '');
  if (type === 'correction') c.content = c.content || c.html || '';
  return c;
}

export function stripHtml(value: string) {
  return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function isMeaningfulBlockContent(type: string, raw: Record<string, any> | null | undefined): boolean {
  const c = canonicalizeBlockContent(type, raw);
  const ignored = new Set(['type', 'level', 'alignment', 'style', 'source', 'eco_data', 'downloadable', 'package_type', 'duration_source', 'rag_enabled', 'display_mode', 'wrap', 'line_numbers', 'mode']);
  const visit = (v: any, key = ''): boolean => {
    if (ignored.has(key)) return false;
    if (typeof v === 'string') return v.replace(/<[^>]*>/g, '').trim().length > 0;
    if (typeof v === 'number') return false;
    if (typeof v === 'boolean') return false;
    if (Array.isArray(v)) return v.some(item => visit(item));
    if (v && typeof v === 'object') return Object.entries(v).some(([k, val]) => visit(val, k));
    return false;
  };
  return visit(c);
}
