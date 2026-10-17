/* OGA Formation Studio V4: offline, deterministic regression checks.
   These checks are NOT a substitute for live Supabase or browser tests. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const ts = require('typescript');
const root = process.cwd();
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const server = read('supabase/functions/studio-unified/index.ts');
const engine = read('src/components/AssessmentEngine.tsx');
const talent = read('src/pages/talent/VerifiedTalentCandidates.tsx');
let passed = 0;
function test(name, callback) { callback(); ++passed; console.log('PASS', name); }
function syntax(file) {
  const source = read(file);
  const result = ts.transpileModule(source, { fileName: file, reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } });
  const errors = (result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, errors.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n'));
}
for (const file of ['supabase/functions/studio-unified/index.ts', 'src/components/AssessmentEngine.tsx', 'src/pages/talent/VerifiedTalentCandidates.tsx']) {
  test('TypeScript syntax '+file, () => syntax(file));
}
const start = server.indexOf('const ASSESSMENT_SECRET_KEYS=');
const end = server.indexOf('function sanitizeAssessmentValue(', start);
assert(start > 0 && end > start);
const extracted = server.slice(start, end);
const transpiled = ts.transpileModule(extracted, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
const context = { assessmentPlainText: input => String(input) };
vm.createContext(context);
vm.runInContext(`${transpiled};globalScrub=publicAssessmentValue;`, context);
const scrub = input => JSON.parse(JSON.stringify(context.globalScrub(input)));
const publicChoice = {label:'Réponse A', options:[{text:'A', isCorrect:true, 'correct-answer':'A', teacher_notes:'Secret'}], nested:{answer:'A', correction:'visible?', explanation:'secret', hint:'indice'}};
const output = scrub(publicChoice);
test('public alternatives remain visible', () => assert.equal(output.options[0].text, 'A'));
test('nested secret answer and grading keys removed', () => {
  assert(!('isCorrect' in output.options[0]));
  assert(!('correct-answer' in output.options[0]));
  assert(!('teacher_notes' in output.options[0]));
  assert(!('answer' in output.nested));
  assert(!('explanation' in output.nested));
});
test('no public preview of interactive assessment blocks', () => {
  const match = server.match(/const safePreviewTypes=new Set\(\[(.*?)\]\);/s);
  assert(match, 'preview allowlist missing');
  for (const type of ['matching', 'cloze', 'sentence_order']) assert(!match[1].includes(`"${type}"`), type);
  assert(server.includes('row.preview_allowed===true'));
});
test('creator role checked before new course insertion', () => {
  const route=server.slice(server.indexOf('if(action==="create_course")'), server.indexOf('if(action==="ai_course_blueprint_preview")'));
  assert(route.indexOf('SUPER_ADMIN_ROLE_REQUIRED') >= 0);
  assert(route.indexOf('SUPER_ADMIN_ROLE_REQUIRED') < route.indexOf('sb.from("courses").insert(insert)'));
});
test('import cannot claim administrator context', () => {
  const route=server.slice(server.indexOf('if(action==="apply_course_import")'),server.indexOf('const courseId=b.course_id;',server.indexOf('if(action==="apply_course_import")')));
  assert(route.includes('SUPER_ADMIN_ROLE_REQUIRED'));
});
test('empty assessment does not count as complete', () => {
  assert(engine.includes('Boolean(assessment?.questions?.length)'));
});
test('Talent no unused GOLD constant', () => {
  assert(!/const GOLD\s*=/.test(talent));
});
console.log(`OGA_V4_SECURITY_REGRESSIONS_SUCCESS: ${passed} checks`);
