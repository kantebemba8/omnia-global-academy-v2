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
const replaySection=section('  async function replaySpecialistContent(','  async function replayStructural(');
const historySection=section('  async function replayStudioHistory(','  async function onDrop(');
const ledger=fs.readFileSync(path.join(root,'src/lib/studioUndoLedger.ts'),'utf8');
const backend=fs.readFileSync(path.join(root,'supabase/functions/studio-unified/index.ts'),'utf8');
check('Content history snapshots before and after', contentSection.includes('before, after, at: Date.now()'));
check('Identical content ignored', contentSection.includes('JSON.stringify(before) === JSON.stringify(after)'));
check('History bounded', ledger.includes('if (undo.length > limit) undo.shift()'));
check('Typing grouped by block and lesson', ledger.includes('last.blockId === command.blockId') && ledger.includes('last.lessonId === command.lessonId'));
check('Unsaved content queues server update', contentSection.includes('queueBlockUpdate(blockId, { content_json: after })'));
check('Undo updates remote content', replaySection.includes('queueBlockUpdate(command.blockId, { content_json: target })'));
check('Undo requires current content precondition', replaySection.includes('JSON.stringify(block.content_json || {}) !== JSON.stringify(expected)'));
check('Undo does not mutate local data before remote success', replaySection.indexOf('await queueBlockUpdate(')<replaySection.indexOf('setBlocks(updated)'));
check('Redo uses chronological ledger', historySection.includes('ledger.completeRedo(command)') && ledger.includes('redo.push(command)'));
check('Undo and redo route specialist history', historySection.includes("case 'content': success = await replaySpecialistContent"));
check('Specialist preview routed to history', builder.includes('recordSpecialistBlockEdit(block.id, content_json)'));
check('Inspector content routed to history', builder.includes('recordSpecialistBlockEdit(selectedBlock.id, updates.content_json)'));
check('Prose changes stored in same chronological ledger', builder.includes("kind:'prose'") && composer.includes('onEdit?.(before, html); latestDraft.current = html'));
check('Prose undo and redo use saved text snapshots and retain Tiptap fallback', historySection.includes('editor.applyHistoryHtml(expected, target)') && historySection.includes('editor.undo()') && historySection.includes('editor.redo()'));
check('Delete asks confirmation', deleteSection.includes('window.confirm('));
check('Delete awaits pending writes', deleteSection.includes('await flushBlockUpdates()'));
check('Delete uses reversible server operation first', deleteSection.includes("api('history_remove_block'"));
check('Server receipt signed, expires and restricted to same creator', backend.includes('signBlockHistory(') && backend.includes('Date.now()+20*60*1000') && backend.includes('receipt.userId!==userId'));
check('Delete invalidates stale quality display on success', deleteSection.includes('setShowChecklist(false)')&&deleteSection.includes('setChecklist(null)'));
check('Delete button prevents default and bubbling', builder.includes('event.preventDefault(); event.stopPropagation(); void deleteBlock(block.id)'));
check('Delete button never submits form', builder.includes('type="button" aria-label={`Supprimer uniquement le bloc'));
check('Only explicit quality action opens quality modal', builder.includes('async function runQualityCheck()'));
check('Session history cleared on lesson change', builder.includes('clearBlockOrderHistory();') && ledger.includes('clear() { undo.length = 0; redo.length = 0; }'));
console.log(`OGA_V4_HISTORY_DELETE_STATIC_SUCCESS: ${passed} checks (NOT E2E)`);
