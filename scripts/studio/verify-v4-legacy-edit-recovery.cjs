/** Deterministic compatibility regression tests for historic OGA courses. */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'src/lib/studioLegacyCompatibility.ts'), 'utf8');
const result = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true });
assert.equal(result.diagnostics?.filter(item => item.category === ts.DiagnosticCategory.Error).length || 0, 0);
const targetModule = { exports: {} };
vm.runInNewContext(result.outputText, { module: targetModule, exports: targetModule.exports, JSON, Number, Array, String, Set, Object, RegExp }, { filename: 'studioLegacyCompatibility.js' });
const lib = targetModule.exports;
let checks = 0;
function check(name, run) { run(); checks++; console.log('OK', name); }
check('Old course strings and goals are normalized without losing unknown fields', () => {
  const original = { id:'old-1', title:'IA-101', objectives:'Objectif A\nObjectif B',learning_outcomes:['Acquis'],is_published:true, bespoke_tag:'historical' };
  const item = lib.normalizeStudioCourse(original);
  assert.equal(item.studio_status,'published'); assert.equal(item.objectives.length,2);
  assert.equal(item.bespoke_tag,'historical'); assert.equal(original.objectives,'Objectif A\nObjectif B');
});
check('Old module and lesson stages preserve synthesis', () => {
  const item = lib.normalizeStudioModule({id:'module-1',title:'Module 1', lessons:JSON.stringify([{id:'l-1',title:'Bilan du module', block_count:1}])});
  assert.equal(item.lessons[0].stage_type, 'module_summary');
  assert.equal(item.lessons[0].has_blocks,true);
});
check('Absent stages never crash a module', () => {
  const item = lib.normalizeStudioModule({id:'old',title:'Historical', lessons:null});
  assert.equal(item.lessons.length, 0);
});
check('Legacy string block content remains available, not discarded', () => {
  const item = lib.normalizeStudioBlock({id:'b1',block_type:'text', content_json:'<p>Bonjour</p>',settings_json:null});
  assert.equal(item.content_json.html,'<p>Bonjour</p>'); assert.equal(Object.keys(item.settings_json).length,0);
});
check('Legacy serialized JSON is parsed while original source is untouched', () => {
  const block={id:'b2',content_json:'{"html":"<p>Texte</p>","custom":8}',settings_json:'{"theme":"light"}'};
  const item=lib.normalizeStudioBlock(block);
  assert.equal(item.content_json.custom,8); assert.equal(item.settings_json.theme,'light');
  assert.equal(typeof block.content_json,'string');
});
check('Malformed success payload is rejected instead of appearing as empty course', () => {
  assert.equal(lib.normalizeStudioEnvelope({success:true,course:{id:'c1'},modules:{}}),null);
  assert.equal(lib.normalizeStudioEnvelope({success:true,course:null,modules:[]}),null);
});
check('Old course and stage envelope is safe', () => {
  const result=lib.normalizeStudioEnvelope({success:true,course:{id:'c1',title:'Ancien'},modules:[{id:'m1',lessons:[{id:'l1',title:'Introduction',is_intro:true}]}]});
  assert.equal(result.modules[0].lessons[0].stage_type, 'introduction');
});
check('Invalid blocks response never clears editor state', () => {
  assert.equal(lib.normalizeStudioBlocks({success:true,blocks:{}}),null);
  assert.equal(lib.normalizeStudioBlocks({success:false,blocks:[]}),null);
});
check('Blocks ordered safely', () => {
  const blocks=lib.normalizeStudioBlocks({success:true,blocks:[{id:'later',position:3},{id:'earlier',position:0}]});
  assert.equal(blocks[0].id, 'earlier');
});
check('Only expected edit routes are wrapped with a scoped error boundary', () => {
  const app=fs.readFileSync(path.join(root,'src/App.tsx'),'utf8');
  assert.ok((app.match(/<SafeStudioEditor returnTo=/g)||[]).length >= 10);
  assert.ok(app.includes('StudioRouteBoundary'));
});
check('Builder validates both course and block envelopes', () => {
  const builder=fs.readFileSync(path.join(root,'src/pages/studio/StudioConceptionFormation.tsx'),'utf8');
  assert.ok(builder.includes('normalizeStudioEnvelope(data)'));
  assert.ok(builder.includes('normalizeStudioBlocks(data)'));
  assert.ok(builder.includes('Réessayer le chargement'));
});
check('Read-only edit load does not invoke historic migration implicitly', () => {
  const edge=fs.readFileSync(path.join(root,'supabase/functions/studio-unified/index.ts'),'utf8');
  const get= edge.split('if(action==="get_course"){')[1]?.split('if(action==="create_module"){')[0];
  assert.ok(get);assert.ok(!get.includes('await ensurePublishedDurationEngineMigration'));
  assert.ok(get.includes('if(modulesReadError)throw modulesReadError'));
  assert.ok(!get.includes('await recalculateCourseDuration(sb,courseId)'));
});
console.log(`OGA_V4_LEGACY_EDIT_RECOVERY_STATIC_SUCCESS: ${checks} controls`);
