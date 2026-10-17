/* OGA Formation Studio V4 — static integration and ordering regression tests.
 * PASS here does not replace a real browser, Supabase or Android test. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
for (const relative of [
  'src/pages/studio/StudioConceptionFormation.tsx',
  'src/components/studio/StudioSortableBlock.tsx',
  'src/components/studio/BuilderImportDialog.tsx',
]) {
  const source = ts.createSourceFile(relative, read(relative), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(source.parseDiagnostics.length, 0, `${relative}: invalid TSX syntax`);
}
const pkg = JSON.parse(read('package.json'));
for (const [name, version] of Object.entries({
  '@dnd-kit/core': '6.3.1', '@dnd-kit/sortable': '10.0.0',
  '@dnd-kit/utilities': '3.2.2', '@uppy/core': '6.0.1',
})) assert.equal(pkg.dependencies[name], version, `${name}: missing pinned version`);
const builder = read('src/pages/studio/StudioConceptionFormation.tsx');
const importer = read('src/components/studio/BuilderImportDialog.tsx');
assert.match(builder, /<DndContext\s+sensors=/);
assert.match(builder, /<SortableContext\s+items=/);
assert.match(builder, /await persistBlockOrder\(reorderBlocksAtSlot/);
assert.match(builder, /application\/x-omnia-block/);
assert.match(importer, /new Uppy\(/);
assert.match(importer, /uploadCourseImportFile\(/); // signed Supabase flow still intact
const compiled = ts.transpileModule(read('src/lib/studioBlockOrdering.ts'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const mod = {exports: {}};
new Function('module','exports',compiled)(mod,mod.exports);
const { reorderBlocksAtSlot,orderChanged } = mod.exports;
const blocks = ['a','b','c','d'].map(id=>({id}));
for (const [source, slot, expected] of [
  ['a',2,'bacd'], ['d',0,'dabc'], ['b',4,'acdb'],
  ['b',1,'abcd'], ['b',2,'abcd'], ['c',1,'acbd'],
]) assert.equal(reorderBlocksAtSlot(blocks,source,slot).map(b=>b.id).join(''),expected);
assert.equal(orderChanged(blocks,blocks),false);
console.log('OGA_V4_DND_UPPY_CONTROLES_STATIQUES_SUCCESS');
console.log('Note: builds, upload serveur, gestes tactiles et parcours apprenants NON TESTES par ce script.');
