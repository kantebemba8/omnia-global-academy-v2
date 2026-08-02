import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const root = fileURLToPath(new URL('../..', import.meta.url));
const mode = process.argv.includes('--android') ? 'android' : process.argv.includes('--supabase') ? 'supabase' : 'source';
const failures = [];
const ok = (condition, message) => { if (!condition) failures.push(message); };
const text = relative => readFileSync(join(root, relative), 'utf8');
const has = (relative, value) => existsSync(join(root, relative)) && text(relative).includes(value);

const digitalFlows = [
  'src/pages/Checkout.tsx',
  'src/pages/commerce/CommerceCatalog.tsx',
  'src/pages/omnia-live/OmniaLiveCheckout.tsx',
  'src/pages/omnia-live/commerce/OmniaLiveCommerceCheckout.tsx',
  'src/pages/coaching/CoachingAdvancedHub.tsx',
];

if (mode === 'source') {
  ok(has('src/lib/mobile/storeBilling.ts', "store_purchase_prepare"), 'Couche de facturation mobile absente.');
  ok(has('src/lib/mobile/storeBilling.ts', "store_purchase_verify"), 'Vérification serveur des achats absente.');
  ok(has('src/lib/mobile/storeBilling.ts', "reconcileNativeStorePurchases"), 'Réconciliation des achats interrompus absente.');
  ok(has('src/components/mobile/MobileStoreRecoveryBridge.tsx', 'omnia:app-state'), 'Reprise automatique des achats au retour dans l’application absente.');
  ok(has('src/App.tsx', 'MobileStoreRecoveryBridge'), 'Pont de restauration des achats non monté.');
  for (const file of digitalFlows) {
    ok(has(file, 'startNativeStorePurchase'), `Achat store absent de ${file}.`);
    ok(!has(file, 'assertNativePaymentAvailable'), `Ancien blocage natif encore présent dans ${file}.`);
  }
  ok(has('src/pages/coaching/CoachingPayment.tsx', 'openExternalUrl'), 'Paiement externe du coaching individuel absent.');
  ok(!has('src/pages/coaching/CoachingPayment.tsx', 'startNativeStorePurchase'), 'Le coaching individuel ne doit pas utiliser un achat intégré.');
  ok(has('src/pages/admin/AdminMonetization.tsx', "tab === 'stores'"), 'Gestion Super Admin des produits stores absente.');
  ok(has('scripts/mobile/templates/module5/ios/OmniaBridgeViewController.swift', 'registerPluginInstance'), 'Préparation iOS Module 5 absente.');
  ok(has('scripts/mobile/templates/module5/ios/OmniaStorePlugin.swift', 'APPLE_STORE_SERVER_CONFIGURATION_PENDING'), 'Garde-fou iOS absent.');
}

if (mode === 'android') {
  ok(has('android/app/build.gradle', 'com.android.billingclient:billing:9.1.0'), 'Google Play Billing 9.1.0 absent.');
  ok(has('android/app/src/main/java/com/omniaglobalacademy/app/MainActivity.java', 'registerPlugin(OmniaStorePlugin.class)'), 'Plugin OmniaStore non enregistré.');
  ok(has('android/app/src/main/java/com/omniaglobalacademy/app/billing/OmniaStorePlugin.java', 'enablePendingPurchases'), 'Achats en attente Google Play non activés.');
  ok(has('android/app/src/main/java/com/omniaglobalacademy/app/billing/OmniaStorePlugin.java', 'setObfuscatedAccountId'), 'Identifiant de compte obscurci absent.');
}

if (mode === 'supabase') {
  const migration = 'supabase/migrations/20260802210000_134_mobile_store_billing.sql';
  ok(existsSync(join(root, migration)), 'Migration 134 absente.');
  ok(!/insert\s+into\s+public\.mobile_store_products/i.test(text(migration)), 'La migration ne doit créer aucun produit fictif.');
  ok(has(migration, "target_kind in ('price_tier','commerce_plan','creator_offer')"), 'Cibles de produits stores incomplètes.');
  ok(has(migration, "product_type = 'consumable'"), 'Les paliers de prix doivent être consommables.');
  ok(has('supabase/functions/_shared/mobile-store-billing.ts', 'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON'), 'Vérification Google Play serveur absente.');
  ok(has('supabase/functions/commerce-engine/index.ts', 'restoreStorePurchases'), 'Restauration serveur robuste absente.');
  ok(has('supabase/functions/commerce-engine/index.ts', 'STORE_RESTORE_SESSION_NOT_FOUND'), 'Protection des achats uniques sans session absente.');
  ok(has('supabase/functions/commerce-engine/index.ts', 'commerce_creator_offer_id'), 'Association des offres créateurs aux stores absente.');
  ok(has('supabase/functions/commerce-engine/index.ts', 'STORE_FINALIZATION_PENDING'), 'Reprise après échec d’acquittement Google Play absente.');
  ok(has('supabase/functions/commerce-engine/index.ts', 'STORE_ONE_TO_ONE_EXTERNAL_SERVICE'), 'Protection du coaching individuel absente.');
  ok(has('supabase/functions/checkout-init/index.ts', 'native_store'), 'Checkout formation natif absent.');
  ok(has('supabase/functions/omnia-live/index.ts', 'store_payment_finalize'), 'Finalisation Omnia Live absente.');
  ok(has('supabase/functions/coaching/index.ts', 'store_payment_finalize'), 'Finalisation coaching collectif absente.');
  const functionsDir = join(root, 'supabase', 'functions');
  const functionCount = readdirSync(functionsDir, { withFileTypes: true }).filter(entry => entry.isDirectory() && entry.name !== '_shared').length;
  ok(functionCount === 99, `Nombre local d’Edge Functions inattendu : ${functionCount}; attendu : 99.`);
  ok(!text('supabase/functions/_shared/mobile-store-billing.ts').includes('FEDAPAY_LIVE'), 'Le helper store ne doit pas modifier FedaPay.');
}

if (failures.length) {
  console.error(`MODULE5_${mode.toUpperCase()}_ECHEC`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`MODULE5_${mode.toUpperCase()}_OK`);
}
