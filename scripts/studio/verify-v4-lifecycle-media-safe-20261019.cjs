/** Source/AST contract tests for structural navigation and non-destructive resource deletion.
 * These are NOT remote Supabase tests, browser tests, or runtime acceptance tests.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const studio = read('src/pages/studio/StudioConceptionFormation.tsx');
const backend = read('supabase/functions/studio-unified/index.ts');
const prose = read('src/components/studio/StudioBlankPageComposer.tsx');
const rich = read('src/components/studio/StudioRichTextEditor.tsx');
let passed = 0;
const check = (name, condition) => { assert.ok(condition,name); passed++; console.log('PASS',name); };
const studioSection = (name, next) => studio.slice(studio.indexOf(`  async function ${name}`),studio.indexOf(`  async function ${next}`,studio.indexOf(`  async function ${name}`)));
const edgeSection = (name,next) => backend.slice(backend.indexOf(`  if(action==="${name}")`),backend.indexOf(`  if(action==="${next}")`, backend.indexOf(`  if(action==="${name}")`)));
for (const [file,kind] of [
 ['src/pages/studio/StudioConceptionFormation.tsx',ts.ScriptKind.TSX],
 ['src/components/studio/StudioBlankPageComposer.tsx',ts.ScriptKind.TSX],
 ['src/components/studio/StudioRichTextEditor.tsx',ts.ScriptKind.TSX],
 ['supabase/functions/studio-unified/index.ts',ts.ScriptKind.TS],
]) {
 const ast=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,kind);
 check('TS syntax '+file,ast.parseDiagnostics.length===0);
}
const helper=studio.slice(studio.indexOf('  async function secureStructuralTransition('),studio.indexOf('  // ─── Sélection leçon',studio.indexOf('  async function secureStructuralTransition(')));
check('Structural preflight saves prose',helper.includes('await flushProseComposer()'));
check('Structural preflight saves blocks',helper.includes('await flushBlockUpdates()'));
check('Structural preflight saves course',helper.includes('await flushPendingCourseEdits()'));
for(const [fn,next] of [['addModule','addLesson'],['addLesson','addModuleStage'],['addModuleStage','openModuleAssessment'],['openModuleAssessment','deleteLesson'],['deleteLesson','deleteModule'],['deleteModule','addBlock']]){
 check(fn+' checks all pending data before changing structure',studioSection(fn,next).includes('await secureStructuralTransition('));
}
check('Opening import from lesson menu waits for selection',studio.includes('if (await selectLesson(mod, lesson)) setBuilderImportTarget'));
check('Module import flushes pending saves',studio.includes("if (await secureStructuralTransition('Import')) setBuilderImportTarget({ type:'module'"));
check('Selected lesson import flushes pending saves',studio.includes("if (await secureStructuralTransition('Import')) setBuilderImportTarget({ type: 'lesson'"));
check('Block import flushes pending saves',studio.includes("if (await secureStructuralTransition('Import du bloc')) setBuilderImportTarget"));
check('Assessment withdrawal flushes pending saves',studio.includes("await secureStructuralTransition('Retrait de l’examen final')"));
check('Back-navigation saves course metadata',studio.includes("if (!await flushPendingCourseEdits()) return;\n          const back"));
check('All visible prose editors except slash target flushed',studio.includes('for (const [key, composer] of [...proseComposerRefs.current.entries()])')&&studio.includes('if (key === excludeComposerKey) continue;'));
check('Slash for inline segment passes stable identity',studio.includes('addBlock(type, idx + 1, block.id)'));
check('Slash for tail passes its identity',studio.includes("addBlock(type, insertionSlot ?? undefined, 'tail')"));
check('All other slash editors retain data',studio.includes('await flushProseComposer(slashComposerKey)'));
check('Saved prose remains backed by lesson_blocks',studio.includes("block_type: 'text'")&&studio.includes('queueBlockUpdate(blockId, { content_json })'));
check('Legacy resources preserved by prose projection',studio.includes('!block.content_json?.__legacy_collection_source'));
check('Failed import reloading not described as success',studio.includes('if (!refreshed)')&&studio.includes('if (currentLesson?.id && !await loadBlocks(currentLesson.id))'));
for(const [name,next] of [['delete_block','duplicate_block'],['remove_block_resource','reorder_blocks'],['delete_lesson','delete_module'],['delete_module','get_blocks']]){
 const part=edgeSection(name,next),dbAction=name==='remove_block_resource'?'update':'delete';
 check(name+' checks DB mutation error', part.includes('if(deleteError)throw deleteError') || part.includes('if(error)throw error'));
 check(name+' checks shared stream references',part.includes('.contains("content_json",{cloudflare_stream_uid:'));
 check(name+' checks shared storage references',part.includes('.eq("storage_path",String(blk.storage_path))'));
 check(name+' does not delete remote stream before DB mutation',part.indexOf(`.from("lesson_blocks").${dbAction}(`) < part.indexOf('await deleteStreamVideo(uid)') || part.indexOf(`.from("lesson_blocks").${dbAction}(`) < part.indexOf('await deleteStreamVideo(streamUid)'));
}
check('Course lesson removal enforces nonpublished state',edgeSection('delete_lesson','delete_module').includes('"pending_validation","validated","suspended"'));
check('Course module removal enforces nonpublished state',edgeSection('delete_module','get_blocks').includes('"pending_validation","validated","suspended"'));
check('Assessment attempts protected before media detachment',edgeSection('remove_block_resource','reorder_blocks').includes('ensureOfficialQuestionHistoryEditable(sb,blockId)'));
check('Drag/drop sends current order as optimistic precondition',studio.includes('expected_ordered_ids: original.map(block => block.id)'));
check('Undo/redo sends expected block order',studio.includes('expected_ordered_ids: expected, ordered_ids: target'));
check('Backend rejects stale order before updates',edgeSection('reorder_blocks','update_course').includes('Un autre éditeur a modifié l’ordre des blocs'));
check('Backend attempts to restore earlier positions on write failure',edgeSection('reorder_blocks','update_course').includes('for(const row of original)'));
check('Resource removal waits for block saves',studio.includes("showToast('Enregistrement incomplet : retrait de ressource annulé.'"));
check('Structural deletion clears active lesson selection',studio.includes('clearBlockOrderHistory(); setCurrentLesson(null); setBlocks([])'));
check('No schema migration introduced',!fs.existsSync(path.join(root,'supabase/migrations/20261019050000_oga_lifecycle.sql')));
check('Tiptap history retained',rich.includes('editor.chain().focus().undo().run()')&&rich.includes('editor.chain().focus().redo().run()'));
check('Local prose recovery offered instead of automatic overwrite',prose.includes('Restaurer le brouillon')&&prose.includes('Garder la version serveur'));
console.log(`OGA_V4_LIFECYCLE_MEDIA_SAFETY_STATIC_SUCCESS: ${passed} checks (no browser, no remote database, no Android)`);
