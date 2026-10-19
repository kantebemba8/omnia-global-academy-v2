/**
 * Read-time compatibility for courses authored with earlier OGA Builders.
 * Never writes to the database, deletes legacy keys or silently changes a course's
 * stage/assessment policy. Persisted source objects are retained via spreading.
 */
export type StudioObject = Record<string, unknown>;

export const isStudioObject = (value: unknown): value is StudioObject =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export const studioArray = (value: unknown): StudioObject[] =>
  Array.isArray(value) ? value.filter(isStudioObject) : [];

const text = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : typeof value === 'number' && Number.isFinite(value) ? String(value) : fallback;

const nonNegative = (value: unknown, fallback: number): number => {
  const parsed = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

function objectOrParsedJson(value: unknown): StudioObject {
  if (isStudioObject(value)) return value;
  if (typeof value === 'string') {
    const source = value.trim();
    if (/^\{/.test(source)) {
      try { const parsed: unknown = JSON.parse(source); if (isStudioObject(parsed)) return parsed; } catch { /* Old raw text must survive. */ }
    }
    return { text: value, html: value };
  }
  return {};
}

function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === 'string');
  if (typeof value === 'string') return value.split(/\r?\n/).map(entry => entry.trim()).filter(Boolean);
  return [];
}

const STAGES = new Set(['introduction','module_presentation','lesson','module_summary','conclusion','final_exam']);
const SECTIONS = new Set(['introduction','module','conclusion','final_exam']);

export function normalizeStudioLesson(value: unknown): StudioObject | null {
  if (!isStudioObject(value) || !text(value.id).trim()) return null;
  const title = text(value.title, 'Leçon');
  const explicit = text(value.stage_type);
  const stage_type = STAGES.has(explicit) ? explicit
    : value.is_intro === true ? 'introduction'
    : value.is_module_intro === true ? 'module_presentation'
    : value.is_conclusion === true ? 'conclusion'
    : value.is_final_exam === true ? 'final_exam'
    : /^(synthèse|bilan du module)$/i.test(title.trim()) ? 'module_summary'
    : 'lesson';
  return {
    ...value,
    id: text(value.id),
    title,
    stage_type,
    position: nonNegative(value.position, 0),
    block_count: nonNegative(value.block_count, 0),
    has_blocks: value.has_blocks === true || nonNegative(value.block_count, 0) > 0,
  };
}

export function normalizeStudioModule(value: unknown): StudioObject | null {
  if (!isStudioObject(value) || !text(value.id).trim()) return null;
  const explicit = text(value.section_type);
  const section_type = SECTIONS.has(explicit) ? explicit
    : value.is_intro === true ? 'introduction'
    : value.is_conclusion === true ? 'conclusion'
    : value.is_final_exam === true ? 'final_exam'
    : 'module';
  // Some historical APIs returned lesson arrays as a serialized value or omitted
  // them entirely. Never let a bad row crash the entire course editor.
  const lessonsValue = typeof value.lessons === 'string' ? (() => {
    try { return JSON.parse(value.lessons as string) as unknown; } catch { return []; }
  })() : value.lessons;
  const lessons = (Array.isArray(lessonsValue) ? lessonsValue : [])
    .map(normalizeStudioLesson).filter((item): item is StudioObject => item !== null);
  return {
    ...value,
    id: text(value.id),
    title: text(value.title, 'Module'),
    objective: text(value.objective),
    section_type,
    position: nonNegative(value.position, 0),
    lessons,
  };
}

export function normalizeStudioCourse(value: unknown): StudioObject | null {
  if (!isStudioObject(value) || !text(value.id).trim()) return null;
  return {
    ...value,
    id: text(value.id),
    title: text(value.title, 'Formation sans titre'),
    short_description: text(value.short_description),
    long_description: text(value.long_description),
    language: text(value.language, 'fr'),
    instruction_language: text(value.instruction_language, text(value.language, 'fr')),
    studio_status: text(value.studio_status, value.is_published === true ? 'published' : 'draft'),
    studio_mode: text(value.studio_mode, 'simple'),
    objectives: normalizeStringList(value.objectives),
    learning_outcomes: normalizeStringList(value.learning_outcomes),
  };
}

/** Normalize only collection fields known to the 52-block editor.
 * The raw legacy value survives under a reserved key for deliberate recovery;
 * this is an in-memory projection, NOT a write to Supabase.
 */
const COLLECTION_FIELDS: Record<string, readonly string[]> = {
  remember: ['points'], bullet_list: ['items'], numbered_list: ['items'],
  qcm: ['options'], checklist: ['items'], accordion: ['items'],
  flashcards: ['cards'], interactive_table: ['rows'], timeline: ['steps'],
  columns: ['columns'], gallery: ['images'], case_study: ['questions'],
  rubric: ['criteria'], open_question: ['rubric'], assignment_upload: ['rubric'],
  oral_response: ['rubric'], written_expression: ['rubric'],
  vocabulary: ['items'], dialogue: ['lines'], pronunciation: ['items'],
  matching: ['pairs'], listening_comprehension: ['questions'],
};

export function normalizeStudioBlockContent(blockType: string, value: unknown): StudioObject {
  const source = objectOrParsedJson(value);
  const collectionKeys = COLLECTION_FIELDS[blockType] || [];
  if (!collectionKeys.length) return source;
  let output = source;
  for (const key of collectionKeys) {
    const original = source[key];
    if (original === undefined || original === null || Array.isArray(original)) continue;
    let items: unknown[] | null = null;
    if (typeof original === 'string') {
      try { const parsed: unknown = JSON.parse(original); if (Array.isArray(parsed)) items = parsed; } catch { /* Preserve below. */ }
      if (!items && ['points','options'].includes(key) && original.trim()) {
        items = original.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      }
    }
    output = {
      ...output,
      [key]: items || [],
      __legacy_collection_source: {
        ...(isStudioObject(output.__legacy_collection_source) ? output.__legacy_collection_source : {}),
        [key]: original,
      },
    };
  }
  return output;
}

export function normalizeStudioBlock(value: unknown): StudioObject | null {
  if (!isStudioObject(value) || !text(value.id).trim()) return null;
  return {
    ...value,
    id: text(value.id),
    block_type: text(value.block_type, 'text'),
    position: nonNegative(value.position, 0),
    content_json: normalizeStudioBlockContent(text(value.block_type, 'text'), value.content_json),
    settings_json: objectOrParsedJson(value.settings_json),
    title: text(value.title),
  };
}

/** Reject unusable envelopes explicitly; never present an empty course as success. */
export function normalizeStudioEnvelope(data: unknown): {
  course: StudioObject;
  modules: StudioObject[];
} | null {
  if (!isStudioObject(data) || data.success !== true) return null;
  const course = normalizeStudioCourse(data.course);
  if (!course || !Array.isArray(data.modules)) return null;
  // A partial/invalid payload must never look like an empty course. In particular,
  // do not silently discard a malformed module while leaving the Save button active.
  if ((data.modules as unknown[]).some(module => !isStudioObject(module) || !text(module.id).trim())) return null;
  const modules = studioArray(data.modules)
    .map(normalizeStudioModule).filter((item): item is StudioObject => item !== null);
  return { course, modules };
}

export function normalizeStudioBlocks(data: unknown): StudioObject[] | null {
  if (!isStudioObject(data) || data.success !== true || !Array.isArray(data.blocks)) return null;
  if ((data.blocks as unknown[]).some(block => !isStudioObject(block) || !text(block.id).trim())) return null;
  return data.blocks.map(normalizeStudioBlock)
    .filter((item): item is StudioObject => item !== null)
    .sort((a, b) => Number(a.position) - Number(b.position));
}
