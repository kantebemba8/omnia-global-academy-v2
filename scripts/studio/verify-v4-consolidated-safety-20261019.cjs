/** OGA V4 consolidated builder checks. Static/code-level, NOT browser/remote SQL evidence. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const builder = read('src/pages/studio/StudioConceptionFormation.tsx');
const prose = read('src/components/studio/StudioBlankPageComposer.tsx');
const server = read('supabase/functions/studio-unified/index.ts');
let passed = 0;
function check(label, condition) { assert.ok(condition, label); passed++; console.log(`PASS ${label}`); }
const action = (name, end) => server.slice(server.indexOf(`if(action==="${name}")`), server.indexOf(`if(action==="${end}")`));
const section = action('assessment_section_update','assessment_section_delete');
const question = action('assessment_question_design_update','question_bank_list');
const management = server.slice(server.indexOf('if(action==="assessment_set_active"'), server.indexOf('if(action==="assessment_policy_get")'));
const sync = server.slice(server.indexOf('async function syncExistingOfficialAssessmentFromBlock'), server.indexOf('async function blockLinkIds'));
check('Section editing has no undefined question object', !section.includes('(question as any)') && !section.includes('question.question_type'));
check('Question update owns its grading type', question.includes('const type=String(question.question_type'));
check('Automatic grading restricts question types', question.includes('AUTOMATIC_MODE_NOT_SUPPORTED_FOR_QUESTION_TYPE'));
check('AI file grading prohibited', question.includes('AI_FILE_GRADING_NOT_AVAILABLE'));
check('Response layout and size configured at question level', question.includes('patch.response_layout=layout') && question.includes('patch.max_submission_size_mb='));
check('Deactivation and clearing require course ownership', management.includes('can_manage_lessons'));
check('Assessment cannot be managed in published course', management.includes('"published","suspended"'));
check('Required assessments cannot be deactivated silently', management.includes('REQUIRED_ASSESSMENT'));
check('Reactivation refuses empty assessment', management.includes('ASSESSMENT_EMPTY'));
check('Clear refuses recorded attempts', management.includes('ASSESSMENT_ATTEMPTS_EXIST'));
check('Questions are not cleared if blocks shared elsewhere', management.includes('SHARED_SOURCE_BLOCK'));
check('Clear preserves source media as training blocks', management.includes('interaction_mode:"training"'));
check('Clear disables assessment before removing questions', management.indexOf('is_active:false') < management.indexOf('assessment_questions").delete()'));
check('Attempt histories never deleted in management action', !management.includes('assessment_attempts").delete()'));
check('Certificates never deleted in management action', !management.includes('certificates").delete()'));
check('Block auto sync does not reactivate explicitly disabled evaluation', !sync.includes('is_active:true'));
check('Policy lookup includes active flag', action('assessment_policy_get','assessment_policy_update').includes('lesson_id,is_active,passing_score'));
check('Assessment UI has safe clear and toggle actions', builder.includes('Vider les questions…') && builder.includes('Désactiver l’évaluation'));
check('Assessment state is re-fetched after first question created', builder.includes('setAssessmentRefresh(previous => previous + 1)'));
check('Reorder history recorded after acknowledged API', builder.includes('blockOrderUndo.current.push({ lessonId'));
check('Reorder undo/redo uses server persistence', builder.includes("async function replayBlockOrder(direction: 'undo'|'redo')") && builder.includes("expected_ordered_ids: expected, ordered_ids: target"));
check('Stale reorder history invalidated', builder.includes('Historique de déplacement réinitialisé'));
check('Course metadata flushed before navigation', builder.includes('async function flushPendingCourseEdits()') && (builder.match(/if \(!await flushPendingCourseEdits\(\)\) return false;/g)||[]).length >= 3);
check('Unsent block and metadata warn on tab close', builder.includes("Object.keys(blockSaveQueues.current).length > 0") && builder.includes("['pending','saving','error'].includes(courseSaveStatus)"));
check('Unsaved local recovery does not auto overwrite remote', prose.includes('const [draft, setDraft] = useState(initialHtml);'));
check('Local recovery requires explicit author choice', prose.includes('Restaurer le brouillon') && prose.includes('Garder la version serveur'));
check('Local recovery survives until user chooses', prose.includes('if (recoveryPending) return;'));
check('Old lesson blocks remain source of truth', builder.includes("api('update_block'") && builder.includes("api('create_block'"));
check('No database migration added', !fs.existsSync(path.join(root, 'supabase/migrations/20261019040000_aga_v4_new.sql')));
let ts;
try { ts = require('typescript'); } catch { try { ts = require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript'); } catch {} }
if (ts) for(const [name,kind] of [['src/pages/studio/StudioConceptionFormation.tsx',ts.ScriptKind.TSX],['src/components/studio/StudioBlankPageComposer.tsx',ts.ScriptKind.TSX],['supabase/functions/studio-unified/index.ts',ts.ScriptKind.TS]]) {
  const ast=ts.createSourceFile(name,read(name),ts.ScriptTarget.Latest,true,kind);
  check(`TS syntax parse ${name}`,ast.parseDiagnostics.length===0);
}
console.log('OGA_V4_CONSOLIDATED_SAFETY_STATIC_SUCCESS',passed,'checks; no remote SQL/browser/mobile validation');
