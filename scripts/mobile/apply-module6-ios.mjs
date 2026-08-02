#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../..', import.meta.url));
const iosApp = path.join(root, 'ios', 'App', 'App');
const infoPlist = path.join(iosApp, 'Info.plist');
const projectFile = path.join(root, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj');

if (process.platform !== 'darwin') {
  console.error('Le Module 6 iOS doit être exécuté sur un Mac avec Xcode 26 ou version ultérieure.');
  process.exit(1);
}
if (!fs.existsSync(infoPlist) || !fs.existsSync(projectFile)) {
  console.error('Projet iOS absent. Exécutez npm run mobile:add:ios puis npx cap sync ios sur le Mac.');
  process.exit(1);
}

function run(script) {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts', 'mobile', script)], { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
run('apply-module3-ios.mjs');
run('apply-module4-ios.mjs');
run('apply-module5-ios.mjs');

fs.copyFileSync(path.join(root, 'resources', 'ios', 'PrivacyInfo.xcprivacy'), path.join(iosApp, 'PrivacyInfo.xcprivacy'));
fs.copyFileSync(path.join(root, 'resources', 'ios', 'App.entitlements.template'), path.join(iosApp, 'App.entitlements'));

let plist = fs.readFileSync(infoPlist, 'utf8');
function setString(key, value) {
  const expression = new RegExp(`<key>${key}</key>\\s*<string>[\\s\\S]*?</string>`);
  const replacement = `<key>${key}</key>\n\t<string>${value}</string>`;
  if (expression.test(plist)) plist = plist.replace(expression, replacement);
  else plist = plist.replace('</dict>', `\t${replacement}\n</dict>`);
}
function setBoolean(key, value) {
  const expression = new RegExp(`<key>${key}</key>\\s*<(true|false)\\s*/>`);
  const replacement = `<key>${key}</key>\n\t<${value ? 'true' : 'false'}/>`;
  if (expression.test(plist)) plist = plist.replace(expression, replacement);
  else plist = plist.replace('</dict>', `\t${replacement}\n</dict>`);
}
setString('NSCameraUsageDescription', 'Omnia utilise la caméra uniquement lorsque vous choisissez de scanner un QR code, ajouter une photo ou réaliser une activité qui nécessite la caméra.');
setString('NSMicrophoneUsageDescription', 'Omnia utilise le microphone uniquement pour les activités audio, vidéo ou d’entretien que vous démarrez.');
setString('NSPhotoLibraryUsageDescription', 'Omnia accède aux photos uniquement lorsque vous choisissez un fichier ou une image à importer.');
setString('NSPhotoLibraryAddUsageDescription', 'Omnia enregistre un document ou une image uniquement lorsque vous demandez explicitement son export.');
setBoolean('ITSAppUsesNonExemptEncryption', false);
fs.writeFileSync(infoPlist, plist, 'utf8');

let project = fs.readFileSync(projectFile, 'utf8');
if (!project.includes('CODE_SIGN_ENTITLEMENTS = App/App.entitlements;')) {
  project = project.replace(/CODE_SIGN_STYLE = Automatic;/g, 'CODE_SIGN_ENTITLEMENTS = App/App.entitlements;\n\t\t\t\tCODE_SIGN_STYLE = Automatic;');
  fs.writeFileSync(projectFile, project, 'utf8');
}

console.log('Module 6 iOS préparé. Dans Xcode, activez Push Notifications, vérifiez Associated Domains, sélectionnez votre équipe réelle et lancez Archive sur un appareil réel.');
