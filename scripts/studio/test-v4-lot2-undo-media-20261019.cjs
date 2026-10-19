/** LOT 2 checks: executable unit tests for history, file policies and ordering,
 * plus syntax/static hooks. NOT a browser, live Supabase or Android test. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
let ts; try {ts=require('typescript')} catch {ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript')}
const read = name => fs.readFileSync(name,'utf8');
function loadTs(name) {
  const output = ts.transpileModule(read(name), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const mod = new Module(name, module); mod.filename=name; mod.paths=module.paths; mod._compile(output,name); return mod.exports;
}
const {createStudioUndoLedger}=loadTs('src/lib/studioUndoLedger.ts');
const ledger=createStudioUndoLedger();
ledger.record({kind:'prose',lessonId:'lesson1',key:'tail',before:'',after:'<p>A</p>',at:1000});
ledger.record({kind:'prose',lessonId:'lesson1',key:'tail',before:'<p>A</p>',after:'<p>AB</p>',at:1150});
assert.equal(ledger.sizes().undo,1, 'typing burst coalesced');
let action=ledger.undoCommand();
assert.equal(action.before,''); assert.equal(action.after,'<p>AB</p>');
assert.ok(ledger.completeUndo(action));
assert.equal(ledger.redoCommand(),action);
assert.ok(ledger.completeRedo(action));
ledger.record({kind:'structure',lessonId:'lesson1',blockId:'block1',operation:'add',at:2000});
action=ledger.undoCommand();assert.equal(action.operation,'add');
assert.ok(ledger.completeUndo(action));assert.equal(ledger.redoCommand(),action);
assert.ok(ledger.completeRedo(action));
ledger.record({kind:'prose',lessonId:'lesson1',key:'block1',before:'<p>X</p>',after:'<p>Y</p>',at:2100});
action=ledger.undoCommand();assert.equal(action.before,'<p>X</p>');
assert.ok(ledger.completeUndo(action));assert.equal(ledger.redoCommand(),action);
ledger.record({kind:'settings',lessonId:'lesson1',blockId:'block1',before:{title:'a'},after:{title:'b'},at:2300});
assert.equal(ledger.redoCommand(),undefined,'real new edit invalidates redo');
const {checkStudioMediaFile}=loadTs('src/lib/studioMediaPolicy.ts');
checkStudioMediaFile({name:'s.mp4',size:10000},'video');
checkStudioMediaFile({name:'photo.webp',size:120},'image');
checkStudioMediaFile({name:'formation.zip',size:1000},'scorm');
assert.throws(()=>checkStudioMediaFile({name:'install.exe',size:100},'image'));
assert.throws(()=>checkStudioMediaFile({name:'file.pdf',size:0},'pdf'));
assert.throws(()=>checkStudioMediaFile({name:'photo.webp',size:21*1048576},'image'));
const {reorderBlocksAtSlot}=loadTs('src/lib/studioBlockOrdering.ts');
const blocks=['a','b','c'].map(id=>({id}));
assert.deepEqual(reorderBlocksAtSlot(blocks,'c',0).map(b=>b.id),['c','a','b']);
assert.deepEqual(reorderBlocksAtSlot(blocks,'a',3).map(b=>b.id),['b','c','a']);
const page=read('src/pages/studio/StudioConceptionFormation.tsx');
const composer=read('src/components/studio/StudioBlankPageComposer.tsx');
for(const name of ['src/pages/studio/StudioConceptionFormation.tsx','src/components/studio/StudioBlankPageComposer.tsx','src/lib/studioUndoLedger.ts']) {
 const parsed=ts.createSourceFile(name,read(name),ts.ScriptTarget.Latest,true,name.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 assert.equal(parsed.parseDiagnostics.length,0,`${name}: valid syntax`);
}
assert.match(page,/editor\.applyHistoryHtml\(expected, target\)/);
assert.match(composer,/latestDraft\.current !== expected/);
assert.match(composer,/onEdit\?\.\(before, html\)/);
assert.match(composer,/busyPromise\.current = operation/);
assert.match(page,/onBeforeUpload=\{async \(\) => \{ if \(!await flushProseComposer\(\)\)/);
assert.match(page,/if \(added\) \{ setInsertionSlot\(null\); setMobileLibraryOpen\(false\); \}/);
assert.match(page,/\(c\.source \|\| 'upload'\) === 'upload'/);
console.log('OGA_V4_LOT2_UNDO_MEDIA_CHECKS_PASS (unit/static only; NO browser or server coverage)');
