// Vérifie que la même navigation de sous-espaces est disponible sur mobile dans
// chaque univers OGA, sans supprimer les rubriques ou modifier les routes PC.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const shell = read('src/components/ecosystem/EcosystemShell.tsx');
const css = read('src/index.css');
const navFiles = [
  'src/lib/formationsNavigation.ts',
  'src/lib/careerNavigation.ts',
  'src/lib/liveNavigation.ts',
  'src/lib/coachingNavigation.ts',
  'src/lib/talentNavigation.ts',
  'src/lib/projectsNavigation.ts',
  'src/lib/communityNavigation.ts',
];
const checks = [
  ['sous-menus indépendants de Career', shell.includes('compact && group.children?.length') && !shell.includes("compact && group.path.startsWith('/omnia-career/')")],
  ['tous les liens des sous-espaces conservés', shell.includes('group.children.map(child =>') && shell.includes('to={withPreview(child.path, params)}')],
  ['menu mobile défilant en modes public/connecté/isolé', (shell.match(/oga-mobile-ecosystem-menu/g) || []).length === 3],
  ['protection du viewport de tous les écosystèmes', css.includes('.oga-ecosystem-shell .oga-ecosystem-content') && !css.includes('.oga-ecosystem-shell[data-ecosystem="career"] .oga-ecosystem-content')],
  ['mise en page PC conservée', shell.includes('oga-horizontal-menu-scroll overflow-x-auto lg:block') && shell.includes('SubmenuPreviewBar')],
  ['menus mobiles refermables', shell.includes("event.key === 'Escape'") && shell.includes('overflow-y-auto overscroll-contain')],
  ['défilement local maintenu', css.includes('.oga-table-scroll,') && css.includes('.overflow-x-auto,')],
];
for (const file of navFiles) {
  const content = read(file);
  checks.push([`navigation déclarée : ${file}`, /children\s*:\s*\[/.test(content) && /path\s*:/.test(content)]);
}
for (const [label, good] of checks) { assert.ok(good, `Echec: ${label}`); console.log(`OK: ${label}`); }
console.log('OGA_ECOSYSTEMS_MOBILE_NAVIGATION_PARITY_SUCCESS');
