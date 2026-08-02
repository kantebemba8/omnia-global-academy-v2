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
  if (!existsSync(join(root, relativePath))) fail(`Fichier Module 2 manquant : ${relativePath}`);
};
const requireText = (relativePath, value, message) => {
  if (!read(relativePath).includes(value)) fail(message ?? `${relativePath} ne contient pas ${value}`);
};
const forbidText = (relativePath, value, message) => {
  if (read(relativePath).includes(value)) fail(message ?? `${relativePath} contient encore ${value}`);
};

function verifySource() {
  const required = [
    'src/lib/mobile/network.ts',
    'src/hooks/useOmniaNetwork.ts',
    'src/lib/resilientCourseStore.ts',
    'src/hooks/useCpdTimer.ts',
    'src/components/NetworkStatusBanner.tsx',
    'src/components/ScormPlayer.tsx',
    'src/components/BlockRenderer.tsx',
    'src/pages/CoursLecteur.tsx',
    'src/pages/dashboard/DashboardMesCours.tsx',
  ];
  required.forEach(requireFile);

  const packageJson = JSON.parse(read('package.json'));
  if (packageJson.dependencies?.['@capacitor/network'] !== '8.0.1') {
    fail('La dépendance @capacitor/network 8.0.1 est absente.');
  }
  if (!packageJson.scripts?.['test:mobile:module2']) fail('Le contrôle source du Module 2 est absent.');
  if (!packageJson.scripts?.['test:mobile:module2:android']) fail('Le contrôle Android du Module 2 est absent.');

  requireText('src/main.tsx', 'initializeNetworkRuntime', 'Le runtime réseau n’est pas initialisé au démarrage.');
  requireText('src/lib/mobile/network.ts', "Network.addListener('networkStatusChange'", 'L’écoute réseau native Capacitor est absente.');
  requireText('src/lib/mobile/network.ts', "window.addEventListener('online'", 'Le fallback réseau web est absent.');

  requireText('src/lib/resilientCourseStore.ts', 'const DB_VERSION = 2', 'La migration IndexedDB du Module 2 est absente.');
  requireText('src/lib/resilientCourseStore.ts', "const STORE_SNAPSHOTS = 'snapshots'", 'Le cache chiffré des instantanés est absent.');
  requireText('src/lib/resilientCourseStore.ts', 'saveResilientCourseProgress', 'Le programme de formation n’est pas mis en cache.');
  requireText('src/lib/resilientCourseStore.ts', 'saveResilientLearnerDashboard', 'La liste Mes formations n’est pas mise en cache.');
  requireText('src/lib/resilientCourseStore.ts', 'listOfflineProgress', 'La synchronisation de toutes les progressions en attente est absente.');
  requireText('src/lib/resilientCourseStore.ts', 'acknowledgeOfflineSeconds', 'La confirmation non destructive de progression est absente.');

  const reader = 'src/pages/CoursLecteur.tsx';
  forbidText(reader, 'navigator.onLine', 'Le lecteur utilise encore directement navigator.onLine.');
  forbidText(reader, 'takeOfflineSeconds', 'Le lecteur utilise encore la synchronisation destructive.');
  requireText(reader, 'listOfflineProgress', 'Le lecteur ne synchronise pas toutes les leçons en attente.');
  requireText(reader, 'loadResilientCourseProgress', 'Le lecteur ne recharge pas le programme hors connexion.');
  requireText(reader, 'audio_url: undefined', 'La copie locale conserve encore une URL audio distante.');
  requireText(reader, "content_json: onlineOnly ? { ...content, url: undefined, src: undefined }", 'Les URL de ressources distantes ne sont pas neutralisées dans la copie locale.');
  requireText(reader, 'offlineLessonIds={offlineLessonSet}', 'Le programme ne distingue pas les leçons réellement conservées.');
  requireText(reader, 'isOnline && courseId && currentLessonId', 'Les évaluations ne sont pas protégées contre le mode hors connexion.');
  requireText(reader, 'oga-course-reader-shell', 'La hauteur mobile du lecteur n’est pas corrigée.');

  requireText('src/pages/dashboard/DashboardMesCours.tsx', 'saveResilientLearnerDashboard', 'Mes formations n’est pas sauvegardé localement.');
  requireText('src/pages/dashboard/DashboardMesCours.tsx', 'loadResilientLearnerDashboard', 'Mes formations ne possède pas de reprise locale.');
  requireText('src/hooks/useCpdTimer.ts', 'omnia:app-state', 'Le temps pédagogique ignore encore le cycle de vie natif.');
  requireText('src/hooks/useCpdTimer.ts', '!network.connected', 'Le heartbeat ne tient pas compte du réseau natif.');
  requireText('src/components/ScormPlayer.tsx', 'useOmniaNetworkStatus', 'Le lecteur SCORM ne détecte pas les coupures réseau.');
  requireText('src/components/BlockRenderer.tsx', "onlineOnlyTypes", 'Les ressources de blocs distantes ne sont pas protégées hors connexion.');
  requireText('src/index.css', '.oga-scorm-fullscreen', 'Les safe areas SCORM plein écran sont absentes.');
}

function verifyAndroid() {
  const required = [
    'android/capacitor.settings.gradle',
    'android/app/capacitor.build.gradle',
    'android/app/src/main/assets/capacitor.plugins.json',
  ];
  required.forEach(requireFile);
  requireText('android/capacitor.settings.gradle', "include ':capacitor-network'", 'Le plugin Network est absent des réglages Gradle Capacitor.');
  requireText('android/app/capacitor.build.gradle', "implementation project(':capacitor-network')", 'Le plugin Network est absent des dépendances Android générées.');
  requireText('android/app/src/main/assets/capacitor.plugins.json', 'com.capacitorjs.plugins.network.NetworkPlugin', 'Le registre Android Capacitor ne contient pas NetworkPlugin.');
}

if (mode === '--source') verifySource();
else if (mode === '--android') verifyAndroid();
else fail(`Mode inconnu : ${mode}`);

if (failures.length) {
  console.error('\nECHEC DU CONTROLE MODULE 2');
  failures.forEach(message => console.error(`- ${message}`));
  process.exit(1);
}

console.log(`Controle Module 2 reussi (${mode.replace('--', '')}).`);
