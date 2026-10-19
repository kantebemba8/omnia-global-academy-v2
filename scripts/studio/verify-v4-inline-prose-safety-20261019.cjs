/** OGA V4 inline prose + safe navigation. Static contracts, NOT end-to-end tests. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const builder = read('src/pages/studio/StudioConceptionFormation.tsx');
const prose = read('src/components/studio/StudioBlankPageComposer.tsx');
const rich = read('src/components/studio/StudioRichTextEditor.tsx');
let count = 0;
const test = (label, condition) => {assert.ok(condition,label);console.log('PASS',label);count++;};
for(const name of ['src/pages/studio/StudioConceptionFormation.tsx','src/components/studio/StudioBlankPageComposer.tsx','src/components/studio/StudioRichTextEditor.tsx']){
 const parsed = ts.createSourceFile(name,read(name),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 test('TSX syntax '+name,parsed.parseDiagnostics.length===0);
}
test('Historical block store remains lesson_blocks-backed',builder.includes('onCommit={commitPageParagraph}')&&builder.includes("block_type: 'text'")&&builder.includes('await queueBlockUpdate(blockId, { content_json })'));
test('Every visible safe text row uses in-flow Tiptap',builder.includes('inlineProse ? (')&&builder.includes('ref={instance => registerProseComposer(block.id, instance)}'));
test('Historical incompatible rows untouched',builder.includes('!block.content_json?.__legacy_collection_source')&&builder.includes('original.content_json?.__legacy_collection_source'));
test('Multiple prose editor refs flushed before navigation',builder.includes('for (const [key, composer] of [...proseComposerRefs.current.entries()])') && builder.includes('if (key === excludeComposerKey) continue;'));
test('Beforeunload warns on unsent edits from any editor',builder.includes('[...proseComposerRefs.current.values()].some(composer => composer.hasUnsaved())'));
test('Quality selection uses the legacy normalization type bridge',builder.includes('(normalized as unknown as Block[]).find(')&&!builder.includes('(normalized as Block[]).find('));
test('Quality navigation does not create blank list when load fails',builder.includes("if (!normalized) { showToast('Impossible de sélectionner le bloc ; contenu existant conservé.'")&&!builder.includes('const nextBlocks = data.success ? (data.blocks || []) : [];'));
test('Top navigation awaits persistence',builder.includes('async function leaveLessonFor(')&&builder.includes("void leaveLessonFor('publication')")&&builder.includes("void leaveLessonFor('formation')"));
test('Visible undo/redo include block content and order',builder.includes('aria-label="Annuler la dernière modification"')&&builder.includes('aria-label="Rétablir la dernière modification"')&&builder.includes('async function replaySpecialistContent('));
test('Tiptap undo not confused with server history',rich.includes('editor.chain().focus().undo().run()')&&rich.includes('editor.chain().focus().redo().run()'));
test('Editor active selection tracked',prose.includes('onEditorFocus={onActivate}')&&builder.includes("activeProseKey.current = block.id"));
test('Errors retain session draft recovery',prose.includes('sessionStorage.setItem(storageKey, draft)')&&prose.includes("setStatus('error')"));
console.log('OGA_V4_INLINE_PROSE_SAFETY_STATIC_SUCCESS',count,'checks — no cloud, browser or native certification');
