/* Source-based regression checks for OGA V4. Not a claim of browser E2E coverage. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const file = p => fs.readFileSync(path.join(root, p), 'utf8');
const builder = file('src/pages/studio/StudioConceptionFormation.tsx');
const editor = file('src/components/studio/StudioRichTextEditor.tsx');
const reader = file('src/pages/CoursLecteur.tsx');
let checks=0;
function check(name, value) { assert.ok(value, name); checks++; console.log('PASS', name); }
check('52 block type definitions retained', (builder.match(/\{ type: '(?:[^']+)',\s+label:/g)||[]).length===52);
check('Full block library independent of complicated simple/advanced filtering', builder.includes('const modeBlocks = BLOCK_DEFS;'));
check('Favorites grid and star buttons removed', !builder.includes('favoriteBlockTypes') && !builder.includes('toggleFavorite'));
check('Accessible searchable library with legible row buttons', builder.includes('aria-label={`Ajouter le bloc ${def.label}`}') && builder.includes('grid grid-cols-1'));
check('Central canvas wide and inspector closed by default', builder.includes('max-w-[1040px]') && builder.includes('useState(true);\n  const [collapsedBlockGroups'));
check('Tiptap 3 rich editor retained', editor.includes("from '@tiptap/react'") && editor.includes('useEditor({') && editor.includes('EditorContent'));
check('Tiptap extensions StarterKit, TableKit, Image preserved', editor.includes('StarterKit.configure') && editor.includes('TableKit') && editor.includes('Image.configure'));
check('Rich editor toolbar contextual', editor.includes('toolbarOpen &&') && editor.includes('onFocus: () => setToolbarOpen(true)'));
check('Builder retains dnd-kit plus Uppy', builder.includes("from '@dnd-kit/core'") && builder.includes("from '@uppy/core'"));
check('Fallback preserves ability to edit after renderer failure', builder.includes('Édition de secours') && builder.includes('onFallbackChange'));
check('Clear text does not restore stale legacy fields', builder.includes('value={c.html ?? c.text ?? c.content ??') && builder.includes('html, content: html, text: stripHtml(html)'));
check('Module summary remains same technical stage', builder.includes("stage_type: 'module_summary'") && builder.includes('Synthèse'));
check('Learner also labels summary Synthèse', reader.includes("? 'Synthèse'") && reader.includes('Bilan du module$/i'));
check('Lesson evaluation short label', builder.includes('>Évaluation</button>') && builder.includes("selectAssessmentWorkspace(mod, lesson, 'lesson')"));
check('No misleading config labels or optional final exam label', !builder.includes('Évaluation facultative · configurer') && !builder.includes('Ajouter un examen final (facultatif)'));
check('No before/after buttons within block header', !builder.includes('Insérer avant ${') && !builder.includes('Insérer après ${'));
check('Contextual insertion preserved', builder.includes('Insérer un bloc après ${'));
check('Deletion hidden in named management menus', builder.includes('Gérer le module') && builder.includes('Supprimer cette étape…'));
check('No module deletion icon beside module assessment', !builder.includes('Configurer évaluation module (facultative)') && builder.includes('void deleteModule(mod)'));
check('Assessment can switch back to same lesson', builder.includes('if (currentLesson?.id === lesson.id) { setAssessmentWorkspace(null)'));
check('Backend RPCs and SQL193 kept in base', file('supabase/functions/studio-unified/index.ts').includes('oga_studio_v4_193_apply_policy') && file('supabase/migrations/20261017205000_193_oga_studio_v4_assessments_atomic.sql').includes('CREATE OR REPLACE FUNCTION'));
let ts;try{ts=require('typescript')}catch{};
if(ts) for(const rel of ['src/pages/studio/StudioConceptionFormation.tsx','src/pages/CoursLecteur.tsx','src/components/studio/StudioRichTextEditor.tsx']){
  const parsed=ts.createSourceFile(rel,file(rel),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  check(`TypeScript parse ${rel}`, parsed.parseDiagnostics.length===0);
}
console.log('OGA_V4_EDITOR_UX_STATIC_SUCCESS',checks,'checks — no browser, cloud, or Android certification');
