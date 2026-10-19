/** OGA V4 prose persistence checks. Static contracts, NOT browser or remote DB tests. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const base = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(base, file), 'utf8');
const builder = read('src/pages/studio/StudioConceptionFormation.tsx');
const composer = read('src/components/studio/StudioBlankPageComposer.tsx');
const backend = read('supabase/functions/studio-unified/index.ts');
let passed = 0;
const test = (name, ok) => { assert.ok(ok, name); console.log('PASS', name); passed++; };
for (const rel of ['src/pages/studio/StudioConceptionFormation.tsx','src/components/studio/StudioBlankPageComposer.tsx']) {
  const code = read(rel);
  const ast = ts.createSourceFile(rel, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  test('Syntaxe TSX ' + rel, ast.parseDiagnostics.length === 0);
}
test('Prose réutilise bloc sauvegardé', composer.includes('savedBlockId.current = id') && composer.includes('onCommitRef.current(snapshot, savedBlockId.current)'));
test('Brouillon conservé dans onglet en cas échec', composer.includes('sessionStorage.setItem(storageKey, draft)') && composer.includes("setStatus('error')"));
test('Les modifications récentes ne sont pas effacées', composer.includes('latestDraft.current === snapshot'));
test('Changement de leçon attend rédaction', builder.includes('if (!await flushProseComposer()) return false;'));
test('Enregistrer attend rédaction', builder.includes('async function save() {') && builder.includes('if (!await flushProseComposer()) { setSaving(false); return; }'));
test('Historique texte mis à jour et non recréé', builder.includes('await queueBlockUpdate(blockId, { content_json })') && builder.includes("block_type: 'text', content_json: content, settings_json: {}"));
test('Ancien contenu et métadonnées conservés', builder.includes('const content_json = { ...original.content_json, ...content };'));
test('Blocs non textuels ne sont pas masqués', builder.includes("lastContentBlock?.block_type === 'text'") && builder.includes("contentBlocks.filter(block => block.id !== trailingProse?.id)"));
test('Aucun rendu texte caché en lecture seule', builder.includes('const trailingProse = !locked && !assessmentWorkspace'));
test('Backend conserve création et mise à jour', backend.includes('if(action==="create_block")') && backend.includes('if(action==="update_block")'));
test('Aucune suppression DB introduite', !composer.includes("delete_block',") && !builder.includes('drop table lesson_blocks'));
console.log(`OGA_V4_PROSE_PERSISTENCE_STATIC_SUCCESS ${passed} checks. Browser/Supabase/build NOT TESTED.`);
