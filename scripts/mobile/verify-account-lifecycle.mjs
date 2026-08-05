#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const failures = [];
const checks = [];

function read(relative) {
  const target = path.join(root, relative);
  if (!fs.existsSync(target)) throw new Error(`Fichier absent: ${relative}`);
  return fs.readFileSync(target, 'utf8');
}
function requireText(relative, needles) {
  const text = read(relative);
  for (const needle of needles) if (!text.includes(needle)) failures.push(`${relative}: texte absent: ${needle}`);
  checks.push(relative);
}
function countEdgeFunctions() {
  const functions = path.join(root, 'supabase', 'functions');
  return fs.readdirSync(functions, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name !== '_shared')
    .filter(entry => fs.existsSync(path.join(functions, entry.name, 'index.ts'))).length;
}

requireText('src/pages/profile/UnifiedProfilePage.tsx', [
  'Suspendre mon compte', 'Supprimer définitivement mon compte', 'SUSPENDRE', 'SUPPRIMER',
  'Que pourrions-nous améliorer', 'Quelle fonctionnalité vous manque', 'Qu’est-ce qui vous ferait revenir',
  "location.hash !== '#gestion-compte'", 'N’indiquez aucun mot de passe',
]);
requireText('src/pages/auth/Login.tsx', ['ACCOUNT_SELF_SUSPENDED', 'reactivate_account', 'Réactiver et me connecter']);
requireText('src/pages/auth/LoginOTP.tsx', ['ACCOUNT_SELF_SUSPENDED', 'Connexion par mot de passe']);
requireText('src/pages/SupprimerCompte.tsx', ['suspension temporaire', 'Suspendre plutôt mon compte']);
requireText('src/pages/Confidentialite.tsx', ['Suspension volontaire', 'questionnaire facultatif']);
requireText('supabase/functions/auth-update-profile/index.ts', [
  'suspend_account', 'delete_account', 'omnia_suspend_user_account', 'account_exit_feedback',
  'redactFeedbackText', '[adresse masquée]', '[numéro masqué]', '[secret masqué]',
]);
requireText('supabase/functions/auth-login/index.ts', [
  'omnia_reactivate_user_account', 'ACCOUNT_SELF_SUSPENDED', 'SELF_REACTIVATION_NOT_ALLOWED',
]);
requireText('supabase/functions/auth-login-otp/index.ts', ['ACCOUNT_SELF_SUSPENDED', 'suspension_source']);
requireText('supabase/functions/auth-forgot-password/index.ts', ['suspension_source !== "self"']);
requireText('supabase/functions/dashboard-admin/index.ts', ['account_lifecycle_audit', 'account_deletion_audit', 'Cycle de vie du compte']);
requireText('supabase/migrations/20260805020000_138_account_suspension_exit_feedback.sql', [
  'omnia_suspend_user_account', 'omnia_reactivate_user_account', 'account_lifecycle_audit',
  'account_exit_feedback', 'LAST_SUPER_ADMIN_PROTECTED', 'delete from public.user_sessions',
  'omnia_normalize_account_suspension_state', "suspension_source := 'administrative'",
]);
requireText('docs/mobile/ACCOUNT_DELETION_AND_RETENTION.md', ['Suspension volontaire', 'Suppression définitive', 'Questionnaire facultatif']);

const count = countEdgeFunctions();
if (count !== 99) failures.push(`Nombre d Edge Functions local inattendu: ${count}; attendu: 99`);
else checks.push('99 Edge Functions locales');

const migration = read('supabase/migrations/20260805020000_138_account_suspension_exit_feedback.sql');
if (/cron\.schedule|create\s+extension\s+.*pg_cron/i.test(migration)) failures.push('La migration 138 ne doit activer aucun Cron Job.');

if (failures.length) {
  console.error('ACCOUNT_LIFECYCLE_CHECK_FAILED');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('ACCOUNT_LIFECYCLE_CHECK_OK');
console.log(`CHECKS=${[...new Set(checks)].length}`);
