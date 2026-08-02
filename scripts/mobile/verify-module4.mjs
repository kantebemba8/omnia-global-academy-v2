import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
const root = fileURLToPath(new URL('../..', import.meta.url));
const mode = process.argv[2] || '--source';
const failures = [];
const read = path => readFileSync(join(root, path), 'utf8');
const requireFile = path => { if (!existsSync(join(root, path))) failures.push(`Fichier manquant : ${path}`); };
const requireText = (path, value, message) => { if (!read(path).includes(value)) failures.push(message || `${path} ne contient pas ${value}`); };
function source() {
  ['src/lib/mobile/deepLinks.ts','src/lib/mobile/notifications.ts','src/components/mobile/MobileNotificationBridge.tsx','scripts/mobile/configure-app-links.mjs','scripts/mobile/apply-module4-ios.mjs','resources/mobile-links/assetlinks.template.json','resources/mobile-links/apple-app-site-association.template.json'].forEach(requireFile);
  const pkg=JSON.parse(read('package.json'));
  if(pkg.dependencies?.['@capacitor/push-notifications']!=='8.1.2') failures.push('Push Notifications 8.1.2 absent.');
  if(pkg.dependencies?.['@capacitor/device']!=='8.0.2') failures.push('Device 8.0.2 absent.');
  requireText('src/main.tsx','initializeMobileNotificationRuntime','Runtime notifications non initialisé.');
  requireText('src/App.tsx','MobileNotificationBridge','Pont notification global absent.');
  requireText('src/lib/mobile/notifications.ts',"PushNotifications.addListener('registration'",'Enregistrement push absent.');
  requireText('src/lib/mobile/notifications.ts','syncMobileNotifications','Synchronisation premier plan absente.');
  requireText('src/lib/mobile/notifications.ts','data.notification_id','Identifiant notification push non normalise.');
  requireText('src/lib/mobile/notifications.ts',"notification.source === 'push'",'Protection du marquage des push externes absente.');
  requireText('src/lib/mobile/deepLinks.ts','routeFromNotificationData','Routage notification absent.');
  requireText('android/app/src/main/AndroidManifest.xml','android:autoVerify="true"','Android App Links absent.');
  requireText('android/app/src/main/AndroidManifest.xml','android:scheme="omnia"','Schéma omnia absent.');
  requireText('android/app/src/main/AndroidManifest.xml','android.permission.POST_NOTIFICATIONS','Permission Android 13 absente.');
}

function supabase() {
  ['supabase/migrations/20260802190000_133_mobile_notifications_deep_links.sql','supabase/functions/mobile-notifications/index.ts','supabase/functions/_shared/cors.ts','supabase/config.toml'].forEach(requireFile);
  requireText('supabase/functions/mobile-notifications/index.ts','FIREBASE_PROJECT_ID','FCM HTTP v1 absent.');
  requireText('supabase/functions/mobile-notifications/index.ts','APNS_TEAM_ID','APNs absent.');
  requireText('supabase/functions/mobile-notifications/index.ts','mobile_push_installations','Registre appareils absent.');
  requireText('supabase/functions/mobile-notifications/index.ts','notification_id: notificationId','Identifiant de notification absent du payload push.');
  requireText('supabase/functions/mobile-notifications/index.ts','onConflict: "user_id,platform,installation_id"','Rotation des jetons push non securisee.');
  requireText('supabase/migrations/20260802190000_133_mobile_notifications_deep_links.sql','mobile_notification_deliveries','Journal de livraison absent.');
  requireText('supabase/functions/_shared/cors.ts','x-mobile-push-secret','En-tête interne push absent de CORS.');
  requireText('supabase/config.toml','[functions.mobile-notifications]','Fonction non déclarée dans config.toml.');
}

function android() {
  ['android/capacitor.settings.gradle','android/app/capacitor.build.gradle','android/app/src/main/assets/capacitor.plugins.json'].forEach(requireFile);
  requireText('android/capacitor.settings.gradle','capacitor-push-notifications','Plugin Push absent des réglages Android.');
  requireText('android/capacitor.settings.gradle','capacitor-device','Plugin Device absent des réglages Android.');
  requireText('android/app/src/main/assets/capacitor.plugins.json','PushNotificationsPlugin','PushNotificationsPlugin absent.');
  requireText('android/app/src/main/assets/capacitor.plugins.json','DevicePlugin','DevicePlugin absent.');
}
if(mode==='--source')source();else if(mode==='--android')android();else if(mode==='--supabase')supabase();else failures.push(`Mode inconnu : ${mode}`);
if(failures.length){console.error('ECHEC CONTROLE MODULE 4');failures.forEach(x=>console.error(`- ${x}`));process.exit(1);}console.log(`Contrôle Module 4 réussi (${mode.slice(2)}).`);
