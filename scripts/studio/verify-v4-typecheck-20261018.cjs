const fs = require('fs');
const path = require('path');
const ts = require('typescript');
// IMPORTANT: This script is only for syntax and source-regression checks.
// It must never be called TYPECHECK_SUCCESS: npm run typecheck is the real TS check.
const root = path.resolve(__dirname, '../..');
let parsed = 0;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(full); continue; }
    if (!/\.tsx?$/.test(entry.name)) continue;
    const sf = ts.createSourceFile(full, fs.readFileSync(full, 'utf8'), ts.ScriptTarget.Latest, true,
      full.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const diag = sf.parseDiagnostics;
    if (diag.length) throw new Error(`${full}: ${ts.flattenDiagnosticMessageText(diag[0].messageText, ' ')}`);
    parsed++;
  }
}
walk(path.join(root, 'src'));
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const checks = [
  ['modern lib', /"lib"\s*:\s*\["ES2022"/.test(read('tsconfig.app.json'))],
  ['assessment no implicit option any', read('src/components/AssessmentEngine.tsx').includes('(option: string, optionIndex: number)')],
  ['CMS segments saving', read('src/components/admin/LandingCmsFoundation.tsx').includes('segments: items')],
  ['CMS steps saving', read('src/components/admin/LandingCmsFoundation.tsx').includes('steps: items')],
  ['lesson stage type preserved', read('src/pages/CoursLecteur.tsx').includes("stage_type?: LessonItem['stage_type']")],
  ['mobile receipt status guard', read('src/lib/mobile/storeBilling.ts').includes("'purchaseState' in purchaseOrStatus")],
  ['legacy career templates normalized', read('src/pages/dashboard/DashboardCareerStudio.tsx').includes('normalizeRemoteCareerTemplate')],
  ['legacy badge template name', read('src/pages/dashboard/DashboardBadges.tsx').includes('badge.template?.name')],
  ['untouched Tiptap integration', fs.existsSync(path.join(root, 'src/components/studio/StudioRichTextEditor.tsx'))],
];
for (const [name, ok] of checks) {
  if (!ok) throw new Error('CONTRACT_FAIL: ' + name);
  console.log('PASS', name);
}
console.log(`OGA_V4_TYPECHECK_SOURCE_CONTRACTS_PASS (${parsed} files parsed) - NOT a TypeScript compilation`);
