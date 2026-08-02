import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const root = fileURLToPath(new URL('../..', import.meta.url));
const mode = process.argv[2] ?? '--source';
const failures = [];
const fail = message => failures.push(message);
const read = relativePath => readFileSync(join(root, relativePath), 'utf8');
const requireFile = relativePath => {
  if (!existsSync(join(root, relativePath))) fail(`Fichier Module 3 manquant : ${relativePath}`);
};
const requireText = (relativePath, value, message) => {
  if (!read(relativePath).includes(value)) fail(message ?? `${relativePath} ne contient pas ${value}`);
};
const forbidText = (relativePath, value, message) => {
  if (read(relativePath).includes(value)) fail(message ?? `${relativePath} contient encore ${value}`);
};

function verifySource() {
  [
    'src/lib/mobile/files.ts',
    'src/lib/mobile/images.ts',
    'src/lib/mobile/qr.ts',
    'src/lib/mobile/pdf.ts',
    'src/lib/careerPdfExport.ts',
    'resources/ios/PrivacyInfo.xcprivacy',
    'scripts/mobile/apply-module3-ios.mjs',
  ].forEach(requireFile);

  const packageJson = JSON.parse(read('package.json'));
  const expected = {
    '@capacitor/camera': '8.2.1',
    '@capacitor/filesystem': '8.1.2',
    '@capacitor/share': '8.0.1',
    html2canvas: '1.4.1',
    jspdf: '4.2.1',
    jsqr: '1.4.0',
  };
  for (const [name, version] of Object.entries(expected)) {
    if (packageJson.dependencies?.[name] !== version) fail(`Dépendance absente ou incorrecte : ${name}@${version}`);
  }
  if (!packageJson.scripts?.['test:mobile:module3']) fail('Le contrôle source du Module 3 est absent.');
  if (!packageJson.scripts?.['test:mobile:module3:android']) fail('Le contrôle Android du Module 3 est absent.');
  if (!packageJson.scripts?.['mobile:module3:ios']) fail('La préparation iOS du Module 3 est absente.');

  const expectedInstallScripts = ['core-js@3.49.0', 'esbuild@0.21.5', 'fsevents@2.3.3', 'sharp@0.32.6'];
  for (const packageName of expectedInstallScripts) {
    if (packageJson.allowScripts?.[packageName] !== true) fail(`Script npm non approuvé : ${packageName}`);
  }
  const unexpectedInstallScripts = Object.keys(packageJson.allowScripts || {}).filter(name => !expectedInstallScripts.includes(name));
  if (unexpectedInstallScripts.length) fail(`Scripts npm inattendus dans allowScripts : ${unexpectedInstallScripts.join(', ')}`);
  if (packageJson.overrides?.['core-js'] !== '3.49.0') fail('Le verrouillage de core-js@3.49.0 est absent.');

  requireText('src/lib/mobile/files.ts', 'Filesystem.writeFile', 'Le stockage temporaire natif est absent.');
  requireText('src/lib/mobile/files.ts', 'Directory.Cache', 'Les exports natifs ne sont pas limités au cache privé.');
  requireText('src/lib/mobile/files.ts', 'Share.share', 'La feuille native de partage est absente.');
  requireText('src/lib/mobile/qr.ts', "import jsQR from 'jsqr'", 'Le décodage QR local jsQR est absent.');
  requireText('src/lib/mobile/qr.ts', "source: 'camera'", 'La capture QR native est absente.');
  requireText('src/lib/mobile/pdf.ts', "import('html2canvas')", 'Le rendu PDF natif différé est absent.');
  requireText('src/lib/mobile/pdf.ts', "import('jspdf')", 'La génération PDF native est absente.');
  requireText('src/lib/careerPdfExport.ts', 'isNativeApp()', 'Omnia Career ne distingue pas le build natif.');
  requireText('src/lib/careerPdfExport.ts', 'exportElementAsNativePdf', 'Omnia Career ne génère pas de PDF natif.');
  requireText('src/pages/dashboard/CareerStudioEditor.tsx', 'await printCareerElementAsPdf', 'L’export PDF Career n’attend pas la génération native.');
  requireText('src/pages/dashboard/CareerStudioEditor.tsx', 'pickNativeImageAsDataUrl', 'La photo native du CV est absente.');
  requireText('src/pages/VerifyCertificate.tsx', 'scanQrWithNativeCamera', 'Le scanner QR avec caméra est absent.');
  requireText('src/pages/VerifyCertificate.tsx', 'decodeQrFile', 'Le fallback QR par image est absent.');
  forbidText('src/pages/VerifyCertificate.tsx', 'BarcodeDetectorClass', 'L’ancien BarcodeDetector dépendant du navigateur est encore utilisé.');
  requireText('src/pages/VerifyCertificate.tsx', 'downloadOrShareRemoteFile', 'Le certificat PDF ne passe pas par la couche native.');
  requireText('src/pages/dashboard/DashboardLearningRecord.tsx', 'saveOrShareText', 'Le Learning Record n’utilise pas l’export natif.');
  requireText('src/pages/dashboard/DashboardSkillsPassport.tsx', 'saveOrShareText', 'Le Skills Passport n’utilise pas l’export natif.');
  requireText('src/pages/dashboard/DashboardBadges.tsx', 'downloadOrShareRemoteFile', 'Les badges apprenant ne disposent pas d’un export natif.');
  requireText('src/pages/credentials/PublicBadgeVerification.tsx', 'downloadOrShareRemoteFile', 'Les exports publics de badge ne sont pas natifs.');
  requireText('src/components/career/CareerEnhancedViews.tsx', "'video/mp4'", 'La simulation Career ne prévoit pas de format iOS.');
  requireText('src/components/career/CareerEnhancedViews.tsx', 'MediaRecorder.isTypeSupported', 'La compatibilité MediaRecorder n’est pas vérifiée.');
  requireText('android/app/src/main/AndroidManifest.xml', 'android.permission.CAMERA', 'La permission caméra Android est absente.');
  requireText('android/app/src/main/AndroidManifest.xml', 'android.permission.RECORD_AUDIO', 'La permission microphone Android est absente.');
  requireText('resources/ios/PrivacyInfo.xcprivacy', 'NSPrivacyAccessedAPICategoryFileTimestamp', 'Le manifeste de confidentialité Apple Filesystem est incomplet.');
  requireText('scripts/mobile/apply-module3-ios.mjs', 'NSMicrophoneUsageDescription', 'La description microphone iOS est absente.');
  requireText('scripts/mobile/apply-module3-ios.mjs', 'NSCameraUsageDescription', 'La description caméra iOS est absente.');
  forbidText('package.json', '@capacitor/barcode-scanner', 'Le scanner imposant Android API 26 ne doit pas être installé.');
  requireText('android/variables.gradle', 'minSdkVersion = 24', 'Le support Android API 24 doit être préservé.');
}

function verifyAndroid() {
  [
    'android/capacitor.settings.gradle',
    'android/app/capacitor.build.gradle',
    'android/app/src/main/assets/capacitor.plugins.json',
  ].forEach(requireFile);

  for (const plugin of ['camera', 'filesystem', 'share']) {
    requireText('android/capacitor.settings.gradle', `capacitor-${plugin}`, `Le plugin Android ${plugin} est absent des réglages Capacitor.`);
    requireText('android/app/capacitor.build.gradle', `capacitor-${plugin}`, `Le plugin Android ${plugin} est absent des dépendances générées.`);
  }
  requireText('android/app/src/main/assets/capacitor.plugins.json', 'CameraPlugin', 'CameraPlugin est absent du registre Android.');
  requireText('android/app/src/main/assets/capacitor.plugins.json', 'FilesystemPlugin', 'FilesystemPlugin est absent du registre Android.');
  requireText('android/app/src/main/assets/capacitor.plugins.json', 'SharePlugin', 'SharePlugin est absent du registre Android.');
}

if (mode === '--source') verifySource();
else if (mode === '--android') verifyAndroid();
else fail(`Mode inconnu : ${mode}`);

if (failures.length) {
  console.error('\nECHEC DU CONTROLE MODULE 3');
  failures.forEach(message => console.error(`- ${message}`));
  process.exit(1);
}

console.log(`Controle Module 3 reussi (${mode.replace('--', '')}).`);
