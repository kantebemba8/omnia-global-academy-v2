'use strict';
/** OGA V4 — deterministic source-and-data-contract checks for all 52 block IDs.
 * Does NOT replace real React, Supabase, PWA or Android functional tests.
 * Run from project root: node scripts/studio/verify-v4-blocks.cjs
 */
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const ts = require('typescript');
const base = process.cwd();
function source(f) { return fs.readFileSync(path.join(base, f), 'utf8'); }
function transpilePure(f) {
  const script = ts.transpileModule(source(f), { fileName: f,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    reportDiagnostics: true });
  const errors = (script.diagnostics || []).filter(x => x.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, `${f}: parse failure: ${errors.map(x => x.messageText)}`);
  const exports = {};
  const sandbox = { exports, crypto: globalThis.crypto };
  vm.runInNewContext(script.outputText, sandbox, { filename: f });
  return exports;
}
const builder = source('src/pages/studio/StudioConceptionFormation.tsx');
const renderer = source('src/components/BlockRenderer.tsx');
const richEditor = source('src/components/studio/StudioRichTextEditor.tsx');
const defsBlock = builder.match(/const BLOCK_DEFS = \[([\s\S]*?)\n\];/);
assert.ok(defsBlock, 'BLOCK_DEFS missing');
const ids = [...defsBlock[1].matchAll(/\{\s*type:\s*'([^']+)'/g)].map(x => x[1]);
assert.equal(ids.length, 52, 'Expected exactly 52 declared types');
assert.equal(new Set(ids).size, 52, 'Duplicate block identifiers');
const { emptyBlockContent, canonicalizeBlockContent } = transpilePure('src/lib/courseBuilderV3.ts');
const { STUDIO_COLLECTIONS, editStudioCollection } = transpilePure('src/lib/studioBlockCollections.ts');
const tested = [];
for (const type of ids) {
  const initial = emptyBlockContent(type);
  assert.ok(initial && typeof initial === 'object' && Object.keys(initial).length, `${type}: missing default content`);
  const copy = JSON.parse(JSON.stringify(initial));
  const normalized = canonicalizeBlockContent(type, copy);
  assert.equal(typeof normalized, 'object', `${type}: invalid canonical form`);
  assert.deepEqual(JSON.parse(JSON.stringify(copy)), JSON.parse(JSON.stringify(initial)), `${type}: default mutated`);
  assert.ok(renderer.includes(`case '${type}'`), `${type}: no learner renderer case`);
  // Advanced language types are handled by the shared LanguageBlockEditor.
  const directCase = builder.includes(`case '${type}'`) || builder.includes(`type==='${type}'`);
  assert.ok(directCase, `${type}: no editing control in Builder`);
  for (const spec of STUDIO_COLLECTIONS[type] || []) {
    const fresh = editStudioCollection(copy, type, spec.key, 'add', 0, () => 'test-id');
    assert.equal(fresh[spec.key].length, (copy[spec.key]?.length || 0) + 1, `${type}.${spec.key}: addition`);
    assert.equal(copy[spec.key].length, initial[spec.key].length, `${type}.${spec.key}: mutated original`);
    if (fresh[spec.key].length > 1) {
      const reordered = editStudioCollection(fresh, type, spec.key, 'up', fresh[spec.key].length - 1);
      assert.equal(reordered[spec.key].length, fresh[spec.key].length, `${type}.${spec.key}: move`);
    }
    const removable = editStudioCollection(fresh, type, spec.key, 'remove', fresh[spec.key].length - 1);
    assert.equal(removable[spec.key].length, copy[spec.key].length, `${type}.${spec.key}: remove`);
  }
  tested.push(type);
}
// Boundary cases where editing collections must not corrupt graded answers.
const qcm = { options: ['A', 'B', 'C'], correctIndex: 2, explanation: 'keep' };
const shifted = editStudioCollection(qcm, 'qcm', 'options', 'up', 2);
assert.equal(shifted.correctIndex, 1, 'QCM answer must move with its option');
assert.equal(shifted.options[1], 'C', 'QCM answer label corrupted');
const shortened = editStudioCollection(shifted, 'qcm', 'options', 'remove', 0);
assert.equal(shortened.correctIndex, 0, 'QCM correctIndex must shift on delete');
assert.equal(shortened.explanation, 'keep', 'Unrelated content must survive collection changes');
assert.equal(qcm.options.length, 3, 'Original array was mutated');
assert.throws(() => editStudioCollection(qcm, 'text', 'options', 'add'), /COLLECTION_NOT_SUPPORTED/);
assert.throws(() => editStudioCollection(qcm, 'qcm', 'options', 'remove', 12), /INVALID_COLLECTION_INDEX/);
assert.ok(renderer.includes("'strike','code','pre','hr','img'"), 'Tiptap HTML tags missing from learner sanitizer');
assert.ok(builder.includes('retryFailedBlockSaves'), 'Explicit failed-save recovery missing');
assert.ok(builder.includes('StudioCollectionControls'), 'Nested controls not wired into Inspector');
assert.ok(richEditor.includes('useEditor(') && richEditor.includes('@tiptap/react'), 'Tiptap integration lost');
assert.ok(!richEditor.includes('document.execCommand'), 'Legacy execCommand returned');
const result = {
  declared: ids.length, defaults: tested.length, builder_editor_static: tested.length,
  learner_renderer_static: tested.length, nested_collections: Object.keys(STUDIO_COLLECTIONS).length,
  tiptap_present: true, outcome: 'STATIC_CONTRACT_PASS',
  disclaimer: 'Backend/browser/mobile functional behavior is NOT TESTED',
};
console.log(JSON.stringify(result, null, 2));
