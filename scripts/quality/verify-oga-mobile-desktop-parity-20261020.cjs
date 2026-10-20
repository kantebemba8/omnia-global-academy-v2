const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const reader = read('src/pages/CoursLecteur.tsx');
const detail = read('src/pages/CoursDetail.tsx');
const editor = read('src/pages/dashboard/CareerStudioEditor.tsx');
const inline = read('src/components/career/CareerInlineText.tsx');
const career = read('src/pages/dashboard/DashboardCareerStudio.tsx');
const menu = read('src/components/ecosystem/EcosystemShell.tsx');
const nav = read('src/lib/careerNavigation.ts');
const css = read('src/index.css');
const checks = [
  ['une seule fiche publique', () => !reader.includes('CourseInfoView(') && !reader.includes('readerStarted') && detail.includes('Retour au catalogue')],
  ['progrès / évaluation conservés', () => reader.includes('AssessmentEngine') && reader.includes('loadProgress') && reader.includes('CourseSidebar')],
  ['contrôle de verrouillage', () => reader.includes('lesson.is_unlocked !== false') && reader.includes('Ce module est encore verrouillé')],
  ['retour lecteur', () => reader.includes('Retour à la fiche formation')],
  ['simulation mobile accessible', () => nav.includes('entretien?tab=simulation') && career.includes('requestedInterviewTab')],
  ['onglets mobiles', () => career.includes('grid grid-cols-2 gap-2 border-b border-slate-200')],
  ['édition directe du document', () => editor.includes('inlineText?.isContentEditable') && inline.includes('e.stopPropagation()')],
  ['panneau mobile fermé au départ', () => editor.includes('window.innerWidth >= 768')],
  ['zoom mobile adaptatif', () => editor.includes('(window.innerWidth - 72) / width')],
  ['navigation PC maintenue', () => menu.includes("compact && group.path.startsWith('/omnia-career/')") && menu.includes('lg:block')],
  ['CSS mobile isolé', () => css.includes('@media (max-width: 767px) {') && css.includes('.oga-course-detail-page')],
  ['moteur Career export préservé', () => editor.includes('exportCareerWord') && editor.includes('handlePdfDownload') && editor.includes('<CareerDocumentSurface')],
];
for (const [label, test] of checks) { assert.ok(test(), `Echec : ${label}`); console.log('OK', label); }
console.log('OGA_MOBILE_DESKTOP_STATIC_PARITY_SUCCESS');
