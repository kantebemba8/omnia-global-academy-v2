import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const root = fileURLToPath(new URL('../..', import.meta.url));
const mode = process.argv[2] ?? '--source';
const failures = [];

function fail(message) {
  failures.push(message);
}

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) files.push(...walk(fullPath));
    else files.push(fullPath);
  }
  return files;
}

function read(path) {
  return readFileSync(path, 'utf8');
}

function verifySource() {
  const required = [
    'capacitor.config.ts',
    'src/lib/mobile/index.ts',
    'src/lib/mobile/platform.ts',
    'src/lib/mobile/nativeRuntime.ts',
    'resources/logo.png',
  ];

  for (const path of required) {
    if (!existsSync(join(root, path))) fail(`Fichier Module 1 manquant : ${path}`);
  }

  const sourceRoot = join(root, 'src');
  const sourceFiles = walk(sourceRoot).filter(path => ['.ts', '.tsx'].includes(extname(path)));
  const allowedPopupFiles = new Set([
    'src/lib/careerPdfExport.ts',
    'src/lib/mobile/platform.ts',
    'src/pages/admin/AdminCertificatePreview.tsx',
    'src/pages/omnia-live/admin/AdminOmniaLiveReports.tsx',
  ]);

  for (const path of sourceFiles) {
    const rel = relative(root, path).replaceAll('\\', '/');
    const content = read(path);

    if (
      rel !== 'src/lib/session.ts' &&
      /localStorage\.(?:getItem|setItem|removeItem)\(\s*['"]omnia_session_token['"]/.test(content)
    ) {
      fail(`Accès direct non sécurisé au jeton de session : ${rel}`);
    }

    if (
      /window\.location\.(?:assign\s*\(|href\s*=)[^;\n]*(?:payment_url|checkout_url)/i.test(content) ||
      /window\.open\([^;\n]*(?:payment_url|checkout_url)/i.test(content)
    ) {
      fail(`Redirection de paiement non protégée pour le build natif : ${rel}`);
    }

    if (content.includes('window.open(') && !allowedPopupFiles.has(rel)) {
      fail(`Ouverture directe non gérée par la couche mobile : ${rel}`);
    }
  }

  const paymentGuardFiles = [
    'src/pages/Checkout.tsx',
    'src/pages/coaching/CoachingPayment.tsx',
    'src/pages/coaching/CoachingAdvancedHub.tsx',
    'src/pages/omnia-live/OmniaLiveCheckout.tsx',
    'src/pages/omnia-live/commerce/OmniaLiveCommerceCheckout.tsx',
    'src/pages/commerce/CommerceCatalog.tsx',
  ];
  for (const path of paymentGuardFiles) {
    const content = read(join(root, path));
    if (!content.includes('assertNativePaymentAvailable') && !content.includes('redirectToWebPayment')) {
      fail(`Garde-fou de paiement natif absent : ${path}`);
    }
  }

  const nativeRuntime = read(join(root, 'src/lib/mobile/nativeRuntime.ts'));
  if (!nativeRuntime.includes("anchor.getAttribute('href')") || !nativeRuntime.includes('/^https?:\\/\\//i.test(rawHref)')) {
    fail('Les liens relatifs risquent d’être interceptés comme liens externes dans la WebView native.');
  }

  const nativeCss = read(join(root, 'src/index.css'));
  if (!nativeCss.includes('--safe-area-inset-top') || !nativeCss.includes('oga-keyboard-open')) {
    fail('Les safe areas ou l’ajustement clavier du runtime natif sont absents.');
  }

  const viteConfig = read(join(root, 'vite.config.ts'));
  if (!/mode\s*===\s*['"]native['"]/.test(viteConfig)) {
    fail('Le build natif n’est pas distingué dans vite.config.ts.');
  }
  if (!/!nativeBuild/.test(viteConfig) || !/VitePWA/.test(viteConfig)) {
    fail('La PWA ne semble pas désactivée uniquement pour le build natif.');
  }

  const packageJson = JSON.parse(read(join(root, 'package.json')));
  if (packageJson.scripts?.['build:native'] !== 'vite build --mode native') {
    fail('Le script build:native est absent ou incorrect.');
  }
  if (!packageJson.dependencies?.['@capacitor/core']) {
    fail('La dépendance @capacitor/core est absente.');
  }
  if (!packageJson.dependencies?.['@aparajita/capacitor-secure-storage']) {
    fail('Le stockage sécurisé natif est absent.');
  }
}

function verifyWebBuild() {
  const dist = join(root, 'dist');
  if (!existsSync(dist)) {
    fail('Le dossier dist du build web est absent.');
    return;
  }
  if (!existsSync(join(dist, 'sw.js'))) fail('Le Service Worker web dist/sw.js est absent.');
  if (!existsSync(join(dist, 'manifest.webmanifest'))) {
    fail('Le manifeste PWA web est absent.');
  }
}

function verifyNativeBuild() {
  const dist = join(root, 'dist');
  if (!existsSync(dist)) {
    fail('Le dossier dist du build natif est absent.');
    return;
  }

  const generated = walk(dist).map(path => relative(dist, path).replaceAll('\\', '/'));
  for (const path of generated) {
    if (path === 'sw.js' || path === 'manifest.webmanifest' || /^workbox-.*\.js$/.test(path)) {
      fail(`Artefact PWA interdit dans le build natif : dist/${path}`);
    }
  }

  const htmlPath = join(dist, 'index.html');
  if (!existsSync(htmlPath)) {
    fail('Le fichier dist/index.html du build natif est absent.');
    return;
  }
  const html = read(htmlPath);
  if (/rel=["']manifest["']/i.test(html)) {
    fail('Le build natif référence encore un manifeste PWA.');
  }
}

if (mode === '--source') verifySource();
else if (mode === '--web') verifyWebBuild();
else if (mode === '--native') verifyNativeBuild();
else fail(`Mode inconnu : ${mode}`);

if (failures.length > 0) {
  console.error('\nÉCHEC DU CONTRÔLE MODULE 1');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Contrôle Module 1 réussi (${mode.replace('--', '')}).`);
