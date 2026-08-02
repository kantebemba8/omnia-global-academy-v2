#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const modes = new Set(process.argv.slice(2));
const checks = [];
const failures = [];

function read(relative) {
  const target = path.join(root, relative);
  if (!fs.existsSync(target)) throw new Error(`Fichier absent: ${relative}`);
  return fs.readFileSync(target, 'utf8');
}
function requireFile(relative) {
  const target = path.join(root, relative);
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) failures.push(`Fichier absent: ${relative}`);
  else checks.push(relative);
}
function requireText(relative, needles) {
  const text = read(relative);
  for (const needle of needles) {
    if (!text.includes(needle)) failures.push(`${relative}: texte absent: ${needle}`);
  }
  checks.push(relative);
}
function forbidText(relative, needles) {
  const text = read(relative);
  for (const needle of needles) {
    if (text.includes(needle)) failures.push(`${relative}: texte interdit: ${needle}`);
  }
  checks.push(relative);
}
function countEdgeFunctions() {
  const functions = path.join(root, 'supabase', 'functions');
  return fs.readdirSync(functions, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== '_shared')
    .filter((entry) => fs.existsSync(path.join(functions, entry.name, 'index.ts'))).length;
}

if (modes.has('--source') || modes.size === 0) {
  requireText('src/App.tsx', ['/supprimer-compte', '/compte-supprime']);
  requireText('src/pages/SupprimerCompte.tsx', ['Se connecter pour supprimer le compte', 'SUPPRIMER']);
  requireText('src/pages/dashboard/DashboardProfil.tsx', ['delete_account', 'list_blocked_users', 'Supprimer définitivement mon compte', 'Utilisateurs bloqués']);
  requireText('src/pages/ForumPost.tsx', ['block_user', 'Bloquer cet utilisateur', 'Signaler']);
  requireText('src/pages/Confidentialite.tsx', ['/supprimer-compte', 'blocage']);
  requireText('vite.config.ts', ["sourcemap: false", "return 'document-tools'", "return 'native-bridge'"]);
  requireFile('docs/mobile/PUBLICATION_CHECKLIST.md');
  requireFile('docs/mobile/GOOGLE_PLAY_DATA_SAFETY.md');
  requireFile('docs/mobile/APP_STORE_PRIVACY.md');
  requireFile('docs/mobile/MOBILE_TEST_MATRIX.md');
  requireFile('docs/mobile/ACCOUNT_DELETION_AND_RETENTION.md');
  forbidText('supabase/functions/_shared/mobile-store-billing.ts', ['FEDAPAY_ENV=live', 'api.fedapay.com/v1']);
}

if (modes.has('--android')) {
  requireText('android/variables.gradle', ['minSdkVersion = 24', 'compileSdkVersion = 36', 'targetSdkVersion = 36']);
  requireText('android/app/src/main/AndroidManifest.xml', ['android:allowBackup="false"', 'android:usesCleartextTraffic="false"', '@xml/network_security_config']);
  forbidText('android/app/src/main/AndroidManifest.xml', ['android:appCategory=']);
  requireText('android/app/build.gradle', ['minifyEnabled true', 'shrinkResources true', 'lint', 'OGA_ANDROID_KEYSTORE_PATH', 'billing:9.1.0']);
  requireText('android/app/proguard-rules.pro', ['com.getcapacitor', 'com.omniaglobalacademy.app.billing']);
  requireText('android/app/src/main/res/xml/network_security_config.xml', ['cleartextTrafficPermitted="false"']);
  requireText('.gitignore', ['*.jks', '*.keystore', 'android/app/google-services.json', 'android/local.properties']);
}

if (modes.has('--supabase')) {
  requireText('supabase/migrations/20260802233000_135_account_deletion_store_compliance.sql', [
    'omnia_delete_user_account', 'account_deletion_audit', 'user_blocks', 'LAST_SUPER_ADMIN_PROTECTED'
  ]);
  requireText('supabase/functions/auth-update-profile/index.ts', ['delete_account', 'block_user', 'unblock_user', 'list_blocked_users']);
  requireText('supabase/functions/auth-login/index.ts', ['ACCOUNT_DELETED']);
  requireText('supabase/functions/auth-me/index.ts', ['ACCOUNT_DELETED']);
  requireText('supabase/functions/forum-manage/index.ts', ['user_blocks', 'blockedUserIds', 'user.status !== "actif"']);
  const count = countEdgeFunctions();
  if (count !== 99) failures.push(`Nombre d Edge Functions local inattendu: ${count}; attendu: 99`);
  else checks.push('99 Edge Functions locales');
  const migration = read('supabase/migrations/20260802233000_135_account_deletion_store_compliance.sql');
  if (/cron\.schedule|create\s+extension\s+.*pg_cron/i.test(migration)) failures.push('La migration 135 ne doit activer aucun Cron Job.');
}

if (modes.has('--release')) {
  requireFile('android/app/build/outputs/apk/debug/app-debug.apk');
  const releaseApks = [
    'android/app/build/outputs/apk/release/app-release.apk',
    'android/app/build/outputs/apk/release/app-release-unsigned.apk',
  ];
  if (!releaseApks.some((relative) => fs.existsSync(path.join(root, relative)))) failures.push('APK Release absent.');
  else checks.push('APK Release');
  requireFile('android/app/build/outputs/bundle/release/app-release.aab');
  const lintCandidates = [
    'android/app/build/reports/lint-results-release.html',
    'android/app/build/reports/lint-results-release.txt',
  ];
  if (!lintCandidates.some((relative) => fs.existsSync(path.join(root, relative)))) {
    failures.push('Rapport lintRelease absent.');
  } else checks.push('rapport lintRelease');
}

if (failures.length) {
  console.error('MODULE6_CHECK_FAILED');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('MODULE6_CHECK_OK');
console.log(`CHECKS=${[...new Set(checks)].length}`);
