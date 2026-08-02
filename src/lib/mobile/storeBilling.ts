import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { commerceRequest } from '../commerceApi';
import { getOmniaPlatform, isAndroidApp, isIosApp, isNativeApp } from './platform';

export type StoreTargetType = 'course' | 'commerce' | 'omnia_live' | 'coaching' | 'coaching_advanced';
export type NativeStoreProductType = 'consumable' | 'non_consumable' | 'subscription';
type GoogleProductType = 'inapp' | 'subs';

export interface NativeStoreOffer {
  offerToken?: string | null;
  offerId?: string | null;
  purchaseOptionId?: string | null;
  basePlanId?: string | null;
  formattedPrice?: string | null;
  priceAmountMicros?: number | null;
  priceCurrencyCode?: string | null;
  pricingPhases?: Array<{
    formattedPrice: string;
    priceAmountMicros: number;
    priceCurrencyCode: string;
    billingPeriod: string;
    billingCycleCount: number;
    recurrenceMode: number;
  }>;
}

export interface NativeStoreProduct {
  productId: string;
  productType: GoogleProductType;
  name: string;
  title: string;
  description: string;
  offers: NativeStoreOffer[];
}

export interface NativeStorePurchase {
  purchaseToken: string;
  products: string[];
  purchaseState: 'purchased' | 'pending' | 'unspecified';
  packageName?: string;
  orderId?: string | null;
  acknowledged?: boolean;
  autoRenewing?: boolean;
  quantity?: number;
  obfuscatedAccountId?: string | null;
}

interface PurchaseUpdatedEvent {
  responseCode: number;
  debugMessage: string;
  purchases: NativeStorePurchase[];
}

interface OmniaStorePlugin {
  isAvailable(): Promise<{ available: boolean }>;
  queryProduct(options: { productId: string; productType: GoogleProductType }): Promise<{ product: NativeStoreProduct }>;
  purchase(options: {
    productId: string;
    productType: GoogleProductType;
    offerToken?: string;
    obfuscatedAccountId: string;
  }): Promise<{ launched: boolean }>;
  restorePurchases(options: { productType: GoogleProductType }): Promise<{ purchases: NativeStorePurchase[] }>;
  addListener(
    eventName: 'purchaseUpdated',
    listener: (event: PurchaseUpdatedEvent) => void,
  ): Promise<PluginListenerHandle>;
}

const OmniaStore = registerPlugin<OmniaStorePlugin>('OmniaStore');
const GOOGLE_OK = 0;
const GOOGLE_USER_CANCELED = 1;
const GOOGLE_ITEM_ALREADY_OWNED = 7;
const PURCHASE_TIMEOUT_MS = 5 * 60 * 1000;

interface PreparedStorePurchase {
  completed: boolean;
  session_id?: string;
  platform?: 'android' | 'ios';
  product_id?: string;
  product_type?: NativeStoreProductType;
  expected_amount_xof?: number;
  obfuscated_account_id?: string;
  target_type?: StoreTargetType;
  target_id?: string;
}

export interface NativeStorePurchaseResult {
  completed: boolean;
  pending?: boolean;
  cancelled?: boolean;
  target_type: StoreTargetType;
  target_id: string;
  verification?: unknown;
}

function googleProductType(productType: NativeStoreProductType): GoogleProductType {
  return productType === 'subscription' ? 'subs' : 'inapp';
}

function bestOffer(product: NativeStoreProduct): NativeStoreOffer | undefined {
  if (!product.offers?.length) return undefined;
  if (product.productType === 'subs') {
    return product.offers.find(offer => offer.pricingPhases?.some(phase => phase.priceAmountMicros > 0))
      ?? product.offers[0];
  }
  return product.offers[0];
}

function storeErrorMessage(error: unknown): string {
  const record = error && typeof error === 'object' ? error as { code?: unknown; message?: unknown } : null;
  const code = typeof record?.code === 'string' ? record.code : '';
  const rawMessage = typeof record?.message === 'string' ? record.message : String(error || '');
  const value = code || rawMessage;
  const messages: Record<string, string> = {
    STORE_PRODUCT_NOT_CONFIGURED: 'Ce produit mobile n’est pas encore configuré par l’administrateur dans Google Play ou l’App Store.',
    STORE_PRODUCT_MAPPING_AMBIGUOUS: 'La configuration mobile de ce tarif est ambiguë. Contactez l’assistance Omnia.',
    GOOGLE_PLAY_CONFIGURATION_MISSING: 'La vérification Google Play n’est pas encore configurée côté serveur.',
    APPLE_STORE_SERVER_CONFIGURATION_PENDING: 'La vérification App Store sera finalisée sur Mac avec les identifiants Apple officiels.',
    BILLING_CLIENT_UNAVAILABLE: 'Le service de paiement Google Play est indisponible sur cet appareil.',
    PRODUCT_NOT_FOUND: 'Le produit n’est pas encore publié ou accessible dans Google Play.',
    STORE_SESSION_EXPIRED: 'La session d’achat a expiré. Recommencez le paiement.',
  };
  return messages[value] ?? messages[rawMessage] ?? (rawMessage || 'Le paiement mobile n’a pas pu être terminé.');
}

async function waitForAndroidPurchase(
  productId: string,
  productType: GoogleProductType,
  offerToken: string | undefined,
  obfuscatedAccountId: string,
): Promise<NativeStorePurchaseResult | NativeStorePurchase> {
  let listener: PluginListenerHandle | null = null;
  let timer = 0;

  try {
    return await new Promise<NativeStorePurchaseResult | NativeStorePurchase>(async (resolve, reject) => {
      const finish = async (callback: () => void) => {
        window.clearTimeout(timer);
        if (listener) await listener.remove().catch(() => undefined);
        callback();
      };

      listener = await OmniaStore.addListener('purchaseUpdated', event => {
        if (event.responseCode === GOOGLE_USER_CANCELED) {
          void finish(() => resolve({ completed: false, cancelled: true, target_type: 'commerce', target_id: '' }));
          return;
        }
        if (event.responseCode !== GOOGLE_OK && event.responseCode !== GOOGLE_ITEM_ALREADY_OWNED) {
          void finish(() => reject(new Error(event.debugMessage || `GOOGLE_PLAY_${event.responseCode}`)));
          return;
        }
        const purchase = event.purchases?.find(item => item.products?.includes(productId));
        if (!purchase) {
          if (event.responseCode === GOOGLE_ITEM_ALREADY_OWNED) {
            void OmniaStore.restorePurchases({ productType })
              .then(({ purchases }) => {
                const owned = purchases.find(item => item.products?.includes(productId));
                if (owned) void finish(() => resolve(owned));
                else void finish(() => reject(new Error('GOOGLE_PLAY_ITEM_ALREADY_OWNED')));
              })
              .catch(error => void finish(() => reject(error)));
          }
          return;
        }
        void finish(() => resolve(purchase));
      });

      timer = window.setTimeout(() => {
        void finish(() => reject(new Error('GOOGLE_PLAY_PURCHASE_TIMEOUT')));
      }, PURCHASE_TIMEOUT_MS);

      try {
        await OmniaStore.purchase({
          productId,
          productType,
          offerToken,
          obfuscatedAccountId,
        });
      } catch (error) {
        await finish(() => reject(error));
      }
    });
  } finally {
    window.clearTimeout(timer);
    if (listener) await listener.remove().catch(() => undefined);
  }
}

export async function startNativeStorePurchase(
  targetType: StoreTargetType,
  targetId: string,
): Promise<NativeStorePurchaseResult> {
  if (!isNativeApp()) throw new Error('NATIVE_STORE_ONLY');
  if (!targetId) throw new Error('STORE_TARGET_REQUIRED');

  const platform = getOmniaPlatform();
  const prepared = await commerceRequest<PreparedStorePurchase>('store_purchase_prepare', {
    platform,
    target_type: targetType,
    target_id: targetId,
  });

  if (prepared.completed) {
    return {
      completed: true,
      target_type: targetType,
      target_id: targetId,
    };
  }

  if (!prepared.session_id || !prepared.product_id || !prepared.product_type || !prepared.obfuscated_account_id) {
    throw new Error('STORE_PREPARATION_INCOMPLETE');
  }

  if (isIosApp()) {
    throw new Error('APPLE_STORE_SERVER_CONFIGURATION_PENDING');
  }
  if (!isAndroidApp()) throw new Error('STORE_PLATFORM_INVALID');

  try {
    const available = await OmniaStore.isAvailable();
    if (!available.available) throw new Error('BILLING_CLIENT_UNAVAILABLE');

    const productType = googleProductType(prepared.product_type);
    const { product } = await OmniaStore.queryProduct({
      productId: prepared.product_id,
      productType,
    });
    const offer = bestOffer(product);
    const purchaseOrStatus = await waitForAndroidPurchase(
      prepared.product_id,
      productType,
      offer?.offerToken || undefined,
      prepared.obfuscated_account_id,
    );

    if ('cancelled' in purchaseOrStatus) {
      return {
        completed: false,
        cancelled: true,
        target_type: targetType,
        target_id: targetId,
      };
    }

    if (purchaseOrStatus.purchaseState === 'pending') {
      return {
        completed: false,
        pending: true,
        target_type: targetType,
        target_id: targetId,
      };
    }
    if (purchaseOrStatus.purchaseState !== 'purchased') {
      throw new Error('GOOGLE_PLAY_PURCHASE_NOT_COMPLETED');
    }

    const verification = await commerceRequest('store_purchase_verify', {
      session_id: prepared.session_id,
      platform: 'android',
      product_id: prepared.product_id,
      product_type: prepared.product_type,
      purchase_token: purchaseOrStatus.purchaseToken,
      package_name: purchaseOrStatus.packageName || 'com.omniaglobalacademy.app',
    });

    return {
      completed: true,
      target_type: targetType,
      target_id: targetId,
      verification,
    };
  } catch (error) {
    throw new Error(storeErrorMessage(error));
  }
}

export async function reconcileNativeStorePurchases(): Promise<{ restored: number; results: unknown[] }> {
  if (!isNativeApp()) throw new Error('NATIVE_STORE_ONLY');
  if (isIosApp()) throw new Error('APPLE_STORE_SERVER_CONFIGURATION_PENDING');
  if (!isAndroidApp()) throw new Error('STORE_PLATFORM_INVALID');

  const [oneTimeResult, subscriptionResult] = await Promise.allSettled([
    OmniaStore.restorePurchases({ productType: 'inapp' }),
    OmniaStore.restorePurchases({ productType: 'subs' }),
  ]);
  const owned = [
    ...(oneTimeResult.status === 'fulfilled'
      ? oneTimeResult.value.purchases.map(purchase => ({ purchase, googleProductType: 'inapp' as const }))
      : []),
    ...(subscriptionResult.status === 'fulfilled'
      ? subscriptionResult.value.purchases.map(purchase => ({ purchase, googleProductType: 'subs' as const }))
      : []),
  ].filter(({ purchase }) => purchase.purchaseState === 'purchased');

  if (!owned.length) return { restored: 0, results: [] };

  return commerceRequest('store_purchase_restore', {
    platform: 'android',
    package_name: 'com.omniaglobalacademy.app',
    purchases: owned.flatMap(({ purchase, googleProductType }) => purchase.products.map(productId => ({
      product_id: productId,
      purchase_token: purchase.purchaseToken,
      package_name: purchase.packageName || 'com.omniaglobalacademy.app',
      google_product_type: googleProductType,
    }))),
  });
}

export async function restoreNativeStoreSubscriptions(): Promise<{ restored: number; results: unknown[] }> {
  return reconcileNativeStorePurchases();
}
