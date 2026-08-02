import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const root = fileURLToPath(new URL('../..', import.meta.url));
const iosApp = join(root, 'ios', 'App', 'App');
const storyboard = join(iosApp, 'Base.lproj', 'Main.storyboard');
const templates = join(root, 'scripts', 'mobile', 'templates', 'module5', 'ios');

if (!existsSync(iosApp) || !existsSync(storyboard)) {
  console.error('Dossier iOS absent. Exécutez cette commande sur Mac après npm run mobile:add:ios.');
  process.exitCode = 1;
} else {
  mkdirSync(iosApp, { recursive: true });
  for (const name of ['OmniaStorePlugin.swift', 'OmniaBridgeViewController.swift']) {
    copyFileSync(join(templates, name), join(iosApp, name));
  }

  let xml = readFileSync(storyboard, 'utf8');
  if (!xml.includes('customClass="OmniaBridgeViewController"')) {
    const replaced = xml.replace(
      /customClass="CAPBridgeViewController"(?:\s+customModule="Capacitor")?/,
      'customClass="OmniaBridgeViewController" customModule="App" customModuleProvider="target"',
    );
    if (replaced === xml) {
      console.error('Le contrôleur Capacitor principal n’a pas été trouvé dans Main.storyboard. Aucune modification automatique n’a été appliquée.');
      process.exitCode = 1;
    } else {
      writeFileSync(storyboard, replaced, 'utf8');
      console.log('Module 5 iOS préparé. Ouvrez Xcode, ajoutez les deux fichiers Swift à la cible App si nécessaire, puis validez StoreKit sur un appareil réel.');
    }
  } else {
    console.log('Module 5 iOS déjà préparé.');
  }
}
