import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const root = fileURLToPath(new URL('../..', import.meta.url));
const appDelegate = join(root, 'ios', 'App', 'App', 'AppDelegate.swift');
if (!existsSync(appDelegate)) {
  console.error('Dossier iOS absent. Exécutez cette commande sur Mac après npx cap add ios.');
  process.exit(1);
}
let content = readFileSync(appDelegate, 'utf8');
if (!content.includes('capacitorDidRegisterForRemoteNotifications')) {
  const methods = `\n    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {\n        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)\n    }\n\n    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {\n        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)\n    }\n`;
  const index = content.lastIndexOf('}');
  content = `${content.slice(0, index)}${methods}${content.slice(index)}`;
  writeFileSync(appDelegate, content, 'utf8');
}
console.log('AppDelegate iOS préparé pour les push. Activez ensuite Push Notifications et Associated Domains dans Xcode.');
