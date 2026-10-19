/** Lot 1 architecture contracts; not a browser or live Supabase test. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const builder=fs.readFileSync('src/pages/studio/StudioConceptionFormation.tsx','utf8');
const backend=fs.readFileSync('supabase/functions/studio-unified/index.ts','utf8');
const ledger=fs.readFileSync('src/lib/studioUndoLedger.ts','utf8');
const composer=fs.readFileSync('src/components/studio/StudioBlankPageComposer.tsx','utf8');
let count=0;
function check(label,value){assert.ok(value,label);count++;}
check('Chronological ledger replaces separate stacks',builder.includes('const sessionHistory = useRef(createStudioUndoLedger())')&&!builder.includes('blockOrderUndo.current'));
check('Creation recorded',builder.includes("operation: 'add', lessonId: targetLessonId"));
check('Duplication recorded',builder.includes("rememberAction({ kind: 'structure', operation: 'add', lessonId: currentLesson.id"));
check('Deletion recorded only with signed receipt',builder.includes("operation: 'delete'")&&builder.includes('result.restore_receipt'));
check('Deletion captures nullable lesson id before async actions',
  builder.includes('const deletingLessonId = currentLesson?.id;') &&
  builder.includes('historyReplayInFlight.current || !deletingLessonId') &&
  builder.includes("operation: 'delete', lessonId: deletingLessonId") &&
  !builder.includes("operation: 'delete', lessonId: currentLesson.id"));
check('Undo removals on server',builder.includes("api('history_remove_block'"));
check('Redo restores same ID using signed receipt',builder.includes("api('history_restore_block'"));
check('History actions wait for editor flush',builder.includes('async function replayStructural(')&&builder.includes('await flushProseComposer()'));
check('Tiptap shares chronology',builder.includes("kind:'prose'")&&builder.includes('editor.undo()'));
check('Reorder saves expected ordering',builder.includes('expected_ordered_ids: expected, ordered_ids: target'));
check('Specialist content records before and after',builder.includes("kind: 'content'")&&builder.includes('before, after, at: Date.now()'));
check('Block settings supported safely',builder.includes("case 'settings': success = await replayBlockSettings")&&builder.includes('const safeKeys = new Set('));
check('History limited and not persisted',ledger.includes('undo.length > limit')&&ledger.includes('Session-only'));
check('All active prose editors flushed',builder.includes('for (const [key, composer] of [...proseComposerRefs.current.entries()])'));
check('Local drafts require deliberate recovery',composer.includes('Restaurer le brouillon')&&composer.includes('Garder la version serveur'));
check('Original 52 types preserved', (builder.match(/type:\s*'/g)||[]).length>=52);
check('History actions forbidden for published content',backend.includes('"history_remove_block","history_restore_block"')&&backend.includes('PUBLISHED_VERSION_IMMUTABLE'));
check('Restoration requires signed unexpired user course receipt',backend.includes('crypto.subtle.verify("HMAC"')&&backend.includes('receipt.userId!==userId'));
check('Resource-backed blocks cannot be reversibly erased',backend.includes('if(block.storage_path||block.bucket_name||block.file_url||block.file_name'));
check('Linked block cannot be silently removed',backend.includes('source_block_id.eq.${blockId},target_block_id.eq.${blockId}'));
check('Stale block restore refuses concurrent edits',backend.includes('HISTORY_ORDER_CHANGED'));
for(const name of ['src/pages/studio/StudioConceptionFormation.tsx','src/lib/studioUndoLedger.ts','supabase/functions/studio-unified/index.ts']){
 const ast=ts.createSourceFile(name,fs.readFileSync(name,'utf8'),ts.ScriptTarget.Latest,true,name.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 check(`TS syntax ${name}`,ast.parseDiagnostics.length===0);
}
console.log(`OGA_V4_LOT1_ARCHITECTURE_STATIC_PASS ${count} assertions (NO remote E2E or Android tested)`);
