/** Regression contracts for reported TEST 03 FAIL.
 * Static inspections only: DO NOT report browser, server or Android success.
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const builder = fs.readFileSync(path.join(root,'src/pages/studio/StudioConceptionFormation.tsx'),'utf8');
const composer = fs.readFileSync(path.join(root,'src/components/studio/StudioBlankPageComposer.tsx'),'utf8');
let passed=0;
function check(name, condition){ assert.ok(condition,name); passed++; console.log('PASS',name); }
for (const file of ['src/pages/studio/StudioConceptionFormation.tsx','src/components/studio/StudioBlankPageComposer.tsx']) {
 const ast=ts.createSourceFile(file,fs.readFileSync(path.join(root,file),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 check('Valid TSX syntax '+file,ast.parseDiagnostics.length===0);
}
const section=(first,next)=>builder.slice(builder.indexOf(first),builder.indexOf(next,builder.indexOf(first)));
const deleteSection=section('  async function deleteBlock(','  async function duplicateBlock(');
const contentSection=section('  function recordSpecialistBlockEdit(','  function queueBlockUpdate(');
const replaySection=section('  async function replaySpecialistContent(','  async function undoStudioAction(');
check('Content history records before and after',contentSection.includes('before, after, at: now'));
check('Identical content ignored',contentSection.includes('JSON.stringify(before) === JSON.stringify(after)'));
check('History limited',contentSection.includes('length > 40'));
check('History grouped by block and lesson',contentSection.includes('previous?.lessonId === currentLesson.id')&&contentSection.includes('previous.blockId === blockId'));
check('Unsaved content queues a server update',contentSection.includes('queueBlockUpdate(blockId, { content_json: after })'));
check('Undo restores remote persisted block',replaySection.includes("queueBlockUpdate(command.blockId, { content_json: target })"));
check('Undo requires current content precondition',replaySection.includes('JSON.stringify(block.content_json || {}) !== JSON.stringify(expected)'));
check('Undo does not mutate local data before remote success',replaySection.indexOf('await queueBlockUpdate(')<replaySection.indexOf('setBlocks(updated)'));
check('Redo keeps a separate stack',replaySection.includes('contentRedo.current')&&replaySection.includes('from.pop(); to.push(command)'));
check('Undo and redo menus use content history',builder.includes("replaySpecialistContent('undo')")&&builder.includes("replaySpecialistContent('redo')"));
check('Specialist preview routed to history',builder.includes('recordSpecialistBlockEdit(block.id, content_json)'));
check('Inspector content routed to history',builder.includes('recordSpecialistBlockEdit(selectedBlock.id, updates.content_json)'));
check('Prose edits select prose history',composer.includes('onEdit?.(); latestDraft.current = html')&&builder.includes("lastHistoryKind.current = 'prose'"));
check('Original Tiptap history still separate',builder.includes('proseComposerRefs.current.get(activeProseKey.current)?.undo()'));
check('Delete asks confirmation',deleteSection.includes('window.confirm('));
check('Delete awaits pending writes',deleteSection.includes('await flushBlockUpdates()'));
check('Delete only calls delete_block',deleteSection.includes("api('delete_block'")&&!deleteSection.includes('runQualityCheck('));
check('Delete invalidates stale quality display on success',deleteSection.includes('setShowChecklist(false)')&&deleteSection.includes('setChecklist(null)'));
check('Delete button prevents default and bubbling',builder.includes('event.preventDefault(); event.stopPropagation(); void deleteBlock(block.id)'));
check('Delete button never submits form',builder.includes('type="button" aria-label={`Supprimer uniquement le bloc'));
check('Only explicit quality action opens quality modal',builder.includes('async function runQualityCheck()'));
check('History limitations conveyed after page reload',builder.includes('L’historique ne survit pas à une actualisation'));
console.log(`OGA_V4_HISTORY_DELETE_STATIC_SUCCESS: ${passed} checks (NOT E2E)`);
