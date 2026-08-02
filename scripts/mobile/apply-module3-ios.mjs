import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const root = fileURLToPath(new URL('../..', import.meta.url));
if (process.platform !== 'darwin') {
  console.error('Ce script doit être exécuté sur un Mac après la création du dossier ios.');
  process.exit(1);
}
const iosRoot = join(root, 'ios', 'App');
const plistPath = join(iosRoot, 'App', 'Info.plist');
if (!existsSync(plistPath)) {
  console.error('Info.plist introuvable. Exécutez npm run mobile:add:ios ou npx cap add ios.');
  process.exit(1);
}
let plist = readFileSync(plistPath, 'utf8');
const entries = [
  ['NSCameraUsageDescription', 'Omnia utilise la caméra uniquement lorsque vous choisissez de scanner un QR code ou de prendre une photo pour votre profil ou votre CV.'],
  ['NSPhotoLibraryUsageDescription', 'Omnia accède à vos photos uniquement lorsque vous choisissez un fichier à importer.'],
  ['NSPhotoLibraryAddUsageDescription', 'Omnia peut enregistrer un document ou une image uniquement à votre demande.'],
  ['NSMicrophoneUsageDescription', 'Omnia utilise le microphone uniquement lorsque vous démarrez volontairement une simulation d’entretien ou une activité audio.'],
];
for (const [key, value] of entries) {
  if (plist.includes(`<key>${key}</key>`)) continue;
  plist = plist.replace('</dict>\n</plist>', `  <key>${key}</key>\n  <string>${value}</string>\n</dict>\n</plist>`);
}
writeFileSync(plistPath, plist, 'utf8');
copyFileSync(join(root, 'resources', 'ios', 'PrivacyInfo.xcprivacy'), join(iosRoot, 'PrivacyInfo.xcprivacy'));
console.log('Configuration iOS du Module 3 appliquée. Ouvrez ensuite Xcode et vérifiez la cible App.');
