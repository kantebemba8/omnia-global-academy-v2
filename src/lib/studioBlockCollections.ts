/**
 * OGA V4 — Non-destructive manipulation of nested editor collections.
 * These helpers never rename historical content keys, discard unknown metadata,
 * or make network calls. The selected block's usual queue persists updates.
 */
export type StudioCollectionSpec = {
  key: string;
  label: string;
  blank: unknown;
  minimum?: number;
};

const spec = (key: string, label: string, blank: unknown, minimum = 0): StudioCollectionSpec =>
  ({ key, label, blank, minimum });

export const STUDIO_COLLECTIONS: Readonly<Record<string, readonly StudioCollectionSpec[]>> = {
  remember: [spec('points', 'Points à retenir', '')],
  bullet_list: [spec('items', 'Puces', '')],
  numbered_list: [spec('items', 'Étapes', '')],
  qcm: [spec('options', 'Réponses possibles', '', 2)],
  checklist: [spec('items', 'Cases à cocher', { id: '', text: '', required: true })],
  accordion: [spec('items', 'Sections', { id: '', title: '', content: '' })],
  flashcards: [spec('cards', 'Cartes recto-verso', { id: '', front: '', back: '' })],
  interactive_table: [spec('rows', 'Lignes du tableau', [])],
  timeline: [spec('steps', 'Étapes chronologiques', { id: '', date: '', title: '', description: '' })],
  columns: [spec('columns', 'Colonnes', { id: '', content: '' }, 1)],
  gallery: [spec('images', 'Images', { url: '', alt: '' })],
  case_study: [spec('questions', 'Questions d’analyse', '')],
  rubric: [spec('criteria', 'Critères', { name: '', description: '', points: 10 })],
  open_question: [spec('rubric', 'Critères de correction', { name: '', description: '', points: 10 })],
  assignment_upload: [spec('rubric', 'Critères de correction', { name: '', description: '', points: 10 })],
  oral_response: [spec('rubric', 'Critères de correction', { name: '', description: '', points: 10 })],
  written_expression: [spec('rubric', 'Critères de correction', { name: '', description: '', points: 10 })],
  vocabulary: [spec('items', 'Mots et expressions', { term: '', translation: '', definition: '', example: '', audio_url: '' })],
  dialogue: [spec('lines', 'Répliques', { speaker: '', text: '', translation: '', audio_url: '' })],
  pronunciation: [spec('items', 'Prononciations', { text: '', phonetic: '', audio_url: '' })],
  matching: [spec('pairs', 'Paires à associer', { left: '', right: '' })],
  listening_comprehension: [spec('questions', 'Questions d’écoute', { question: '', options: [], answer: '' })],
};

function newEntry(blank: unknown, makeId: () => string): unknown {
  if (Array.isArray(blank)) return [...blank];
  if (blank && typeof blank === 'object') {
    const clone = { ...(blank as Record<string, unknown>) };
    if (Object.prototype.hasOwnProperty.call(clone, 'id')) clone.id = makeId();
    return clone;
  }
  return blank;
}

export function editStudioCollection(
  content: Record<string, unknown>,
  blockType: string,
  key: string,
  action: 'add' | 'remove' | 'up' | 'down',
  index = 0,
  makeId: () => string = () => crypto.randomUUID(),
): Record<string, unknown> {
  const definition = STUDIO_COLLECTIONS[blockType]?.find(item => item.key === key);
  if (!definition) throw new Error('COLLECTION_NOT_SUPPORTED');
  const existing = Array.isArray(content[key]) ? [...content[key] as unknown[]] : [];
  if (action !== 'add' && (!Number.isInteger(index) || index < 0 || index >= existing.length)) {
    throw new Error('INVALID_COLLECTION_INDEX');
  }
  if (action === 'add') existing.push(newEntry(definition.blank, makeId));
  if (action === 'remove') {
    if (existing.length <= (definition.minimum || 0)) throw new Error('MINIMUM_COLLECTION_ITEMS');
    existing.splice(index, 1);
  }
  if (action === 'up' || action === 'down') {
    const other = index + (action === 'up' ? -1 : 1);
    if (other < 0 || other >= existing.length) return content;
    [existing[index], existing[other]] = [existing[other], existing[index]];
  }
  const result: Record<string, unknown> = { ...content, [key]: existing };
  // QCM: the correct option follows its answer through deletion/reordering.
  if (blockType === 'qcm' && key === 'options') {
    const originalCorrect = Number(content.correctIndex || 0);
    if (action === 'remove') {
      result.correctIndex = index === originalCorrect ? -1 : Math.max(0, originalCorrect - (index < originalCorrect ? 1 : 0));
    } else if (action === 'up' || action === 'down') {
      const other = index + (action === 'up' ? -1 : 1);
      result.correctIndex = originalCorrect === index ? other : originalCorrect === other ? index : originalCorrect;
    }
  }
  return result;
}
