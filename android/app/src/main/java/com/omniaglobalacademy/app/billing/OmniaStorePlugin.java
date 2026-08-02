package com.omniaglobalacademy.app.billing;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryProductDetailsResult;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Collections;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "OmniaStore")
public class OmniaStorePlugin extends Plugin implements PurchasesUpdatedListener {
    private BillingClient billingClient;
    private final AtomicBoolean connecting = new AtomicBoolean(false);

    @Override
    public void load() {
        PendingPurchasesParams pendingPurchasesParams = PendingPurchasesParams
            .newBuilder()
            .enableOneTimeProducts()
            .enablePrepaidPlans()
            .build();

        billingClient = BillingClient
            .newBuilder(getContext())
            .setListener(this)
            .enablePendingPurchases(pendingPurchasesParams)
            .enableAutoServiceReconnection()
            .build();
    }

    private interface BillingReadyAction {
        void run();
    }

    private void withBillingClient(PluginCall call, BillingReadyAction action) {
        if (billingClient == null) {
            call.reject("Le service Google Play Billing est indisponible.", "BILLING_CLIENT_UNAVAILABLE");
            return;
        }

        if (billingClient.isReady()) {
            action.run();
            return;
        }

        if (!connecting.compareAndSet(false, true)) {
            call.reject("La connexion à Google Play est déjà en cours.", "BILLING_CONNECTION_IN_PROGRESS");
            return;
        }

        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(@NonNull BillingResult billingResult) {
                connecting.set(false);
                if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    action.run();
                } else {
                    call.reject(
                        billingResult.getDebugMessage().isBlank() ? "Connexion à Google Play impossible." : billingResult.getDebugMessage(),
                        "BILLING_SETUP_FAILED",
                        null,
                        billingResultToObject(billingResult)
                    );
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                connecting.set(false);
            }
        });
    }

    private static boolean isSupportedProductType(@Nullable String productType) {
        return BillingClient.ProductType.INAPP.equals(productType) || BillingClient.ProductType.SUBS.equals(productType);
    }

    private static JSObject billingResultToObject(BillingResult result) {
        JSObject ret = new JSObject();
        ret.put("responseCode", result.getResponseCode());
        ret.put("debugMessage", result.getDebugMessage());
        return ret;
    }

    private static String purchaseStateName(int state) {
        if (state == Purchase.PurchaseState.PURCHASED) return "purchased";
        if (state == Purchase.PurchaseState.PENDING) return "pending";
        return "unspecified";
    }

    private static JSObject purchaseToObject(Purchase purchase) {
        JSObject ret = new JSObject();
        ret.put("purchaseToken", purchase.getPurchaseToken());
        ret.put("orderId", purchase.getOrderId());
        ret.put("packageName", purchase.getPackageName());
        ret.put("purchaseTime", purchase.getPurchaseTime());
        ret.put("purchaseState", purchaseStateName(purchase.getPurchaseState()));
        ret.put("acknowledged", purchase.isAcknowledged());
        ret.put("autoRenewing", purchase.isAutoRenewing());
        ret.put("quantity", purchase.getQuantity());
        ret.put("signature", purchase.getSignature());
        ret.put("originalJson", purchase.getOriginalJson());

        JSArray products = new JSArray();
        for (String product : purchase.getProducts()) products.put(product);
        ret.put("products", products);

        if (purchase.getAccountIdentifiers() != null) {
            ret.put("obfuscatedAccountId", purchase.getAccountIdentifiers().getObfuscatedAccountId());
            ret.put("obfuscatedProfileId", purchase.getAccountIdentifiers().getObfuscatedProfileId());
        }

        return ret;
    }

    private static JSObject oneTimeOfferToObject(ProductDetails.OneTimePurchaseOfferDetails offer) {
        JSObject ret = new JSObject();
        ret.put("offerToken", offer.getOfferToken());
        ret.put("offerId", offer.getOfferId());
        ret.put("purchaseOptionId", offer.getPurchaseOptionId());
        ret.put("formattedPrice", offer.getFormattedPrice());
        ret.put("priceAmountMicros", offer.getPriceAmountMicros());
        ret.put("priceCurrencyCode", offer.getPriceCurrencyCode());
        return ret;
    }

    private static JSObject subscriptionOfferToObject(ProductDetails.SubscriptionOfferDetails offer) {
        JSObject ret = new JSObject();
        ret.put("offerToken", offer.getOfferToken());
        ret.put("basePlanId", offer.getBasePlanId());
        ret.put("offerId", offer.getOfferId());

        JSArray phases = new JSArray();
        for (ProductDetails.PricingPhase phase : offer.getPricingPhases().getPricingPhaseList()) {
            JSObject phaseObject = new JSObject();
            phaseObject.put("formattedPrice", phase.getFormattedPrice());
            phaseObject.put("priceAmountMicros", phase.getPriceAmountMicros());
            phaseObject.put("priceCurrencyCode", phase.getPriceCurrencyCode());
            phaseObject.put("billingPeriod", phase.getBillingPeriod());
            phaseObject.put("billingCycleCount", phase.getBillingCycleCount());
            phaseObject.put("recurrenceMode", phase.getRecurrenceMode());
            phases.put(phaseObject);
        }
        ret.put("pricingPhases", phases);
        return ret;
    }

    private static JSObject productToObject(ProductDetails details) {
        JSObject ret = new JSObject();
        ret.put("productId", details.getProductId());
        ret.put("productType", details.getProductType());
        ret.put("name", details.getName());
        ret.put("title", details.getTitle());
        ret.put("description", details.getDescription());

        JSArray offers = new JSArray();
        if (BillingClient.ProductType.INAPP.equals(details.getProductType())) {
            List<ProductDetails.OneTimePurchaseOfferDetails> list = details.getOneTimePurchaseOfferDetailsList();
            if (list != null && !list.isEmpty()) {
                for (ProductDetails.OneTimePurchaseOfferDetails offer : list) offers.put(oneTimeOfferToObject(offer));
            } else if (details.getOneTimePurchaseOfferDetails() != null) {
                offers.put(oneTimeOfferToObject(details.getOneTimePurchaseOfferDetails()));
            }
        } else {
            List<ProductDetails.SubscriptionOfferDetails> list = details.getSubscriptionOfferDetails();
            if (list != null) {
                for (ProductDetails.SubscriptionOfferDetails offer : list) offers.put(subscriptionOfferToObject(offer));
            }
        }
        ret.put("offers", offers);
        return ret;
    }

    private void queryProductDetails(
        String productId,
        String productType,
        ProductQueryCallback callback
    ) {
        QueryProductDetailsParams.Product product = QueryProductDetailsParams.Product
            .newBuilder()
            .setProductId(productId)
            .setProductType(productType)
            .build();

        QueryProductDetailsParams params = QueryProductDetailsParams
            .newBuilder()
            .setProductList(Collections.singletonList(product))
            .build();

        billingClient.queryProductDetailsAsync(params, (billingResult, result) -> {
            if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                callback.onError(billingResult);
                return;
            }
            List<ProductDetails> productDetailsList = result.getProductDetailsList();
            if (productDetailsList == null || productDetailsList.isEmpty()) {
                callback.onMissing(result);
                return;
            }
            callback.onSuccess(productDetailsList.get(0));
        });
    }

    private interface ProductQueryCallback {
        void onSuccess(ProductDetails details);
        void onError(BillingResult result);
        void onMissing(QueryProductDetailsResult result);
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        withBillingClient(call, () -> {
            JSObject ret = new JSObject();
            ret.put("available", billingClient.isReady());
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void queryProduct(PluginCall call) {
        String productId = call.getString("productId");
        String productType = call.getString("productType");
        if (productId == null || productId.isBlank()) {
            call.reject("L’identifiant du produit est obligatoire.", "PRODUCT_ID_REQUIRED");
            return;
        }
        if (!isSupportedProductType(productType)) {
            call.reject("Le type de produit Google Play est invalide.", "INVALID_PRODUCT_TYPE");
            return;
        }

        withBillingClient(call, () -> queryProductDetails(productId, productType, new ProductQueryCallback() {
            @Override
            public void onSuccess(ProductDetails details) {
                JSObject ret = new JSObject();
                ret.put("product", productToObject(details));
                call.resolve(ret);
            }

            @Override
            public void onError(BillingResult result) {
                call.reject(result.getDebugMessage().isBlank() ? "Lecture du produit Google Play impossible." : result.getDebugMessage(), "PRODUCT_QUERY_FAILED", null, billingResultToObject(result));
            }

            @Override
            public void onMissing(QueryProductDetailsResult result) {
                JSObject data = new JSObject();
                data.put("productId", productId);
                data.put("unfetchedCount", result.getUnfetchedProductList().size());
                call.reject("Produit introuvable dans Google Play.", "PRODUCT_NOT_FOUND", null, data);
            }
        }));
    }

    @PluginMethod
    public void purchase(PluginCall call) {
        String productId = call.getString("productId");
        String productType = call.getString("productType");
        String requestedOfferToken = call.getString("offerToken");
        String obfuscatedAccountId = call.getString("obfuscatedAccountId");

        if (productId == null || productId.isBlank()) {
            call.reject("L’identifiant du produit est obligatoire.", "PRODUCT_ID_REQUIRED");
            return;
        }
        if (!isSupportedProductType(productType)) {
            call.reject("Le type de produit Google Play est invalide.", "INVALID_PRODUCT_TYPE");
            return;
        }
        if (obfuscatedAccountId == null || obfuscatedAccountId.isBlank() || obfuscatedAccountId.length() > 64) {
            call.reject("L’identifiant sécurisé du compte est invalide.", "INVALID_OBFUSCATED_ACCOUNT_ID");
            return;
        }

        withBillingClient(call, () -> queryProductDetails(productId, productType, new ProductQueryCallback() {
            @Override
            public void onSuccess(ProductDetails details) {
                String selectedOfferToken = requestedOfferToken;

                if (selectedOfferToken == null || selectedOfferToken.isBlank()) {
                    if (BillingClient.ProductType.SUBS.equals(productType)) {
                        List<ProductDetails.SubscriptionOfferDetails> offers = details.getSubscriptionOfferDetails();
                        if (offers != null && !offers.isEmpty()) selectedOfferToken = offers.get(0).getOfferToken();
                    } else {
                        List<ProductDetails.OneTimePurchaseOfferDetails> offers = details.getOneTimePurchaseOfferDetailsList();
                        if (offers != null && !offers.isEmpty()) {
                            selectedOfferToken = offers.get(0).getOfferToken();
                        } else if (details.getOneTimePurchaseOfferDetails() != null) {
                            selectedOfferToken = details.getOneTimePurchaseOfferDetails().getOfferToken();
                        }
                    }
                }

                BillingFlowParams.ProductDetailsParams.Builder productBuilder = BillingFlowParams.ProductDetailsParams
                    .newBuilder()
                    .setProductDetails(details);
                if (selectedOfferToken != null && !selectedOfferToken.isBlank()) {
                    productBuilder.setOfferToken(selectedOfferToken);
                }

                BillingFlowParams params = BillingFlowParams
                    .newBuilder()
                    .setProductDetailsParamsList(Collections.singletonList(productBuilder.build()))
                    .setObfuscatedAccountId(obfuscatedAccountId)
                    .setIsOfferPersonalized(false)
                    .build();

                final String offerTokenForResult = selectedOfferToken;
                getActivity().runOnUiThread(() -> {
                    BillingResult launchResult = billingClient.launchBillingFlow(getActivity(), params);
                    if (launchResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                        call.reject(launchResult.getDebugMessage().isBlank() ? "Ouverture du paiement Google Play impossible." : launchResult.getDebugMessage(), "PURCHASE_LAUNCH_FAILED", null, billingResultToObject(launchResult));
                        return;
                    }
                    JSObject ret = new JSObject();
                    ret.put("launched", true);
                    ret.put("productId", productId);
                    ret.put("productType", productType);
                    ret.put("offerToken", offerTokenForResult);
                    call.resolve(ret);
                });
            }

            @Override
            public void onError(BillingResult result) {
                call.reject(result.getDebugMessage().isBlank() ? "Lecture du produit Google Play impossible." : result.getDebugMessage(), "PRODUCT_QUERY_FAILED", null, billingResultToObject(result));
            }

            @Override
            public void onMissing(QueryProductDetailsResult result) {
                call.reject("Produit introuvable dans Google Play.", "PRODUCT_NOT_FOUND");
            }
        }));
    }

    @PluginMethod
    public void restorePurchases(PluginCall call) {
        String productType = call.getString("productType");
        if (!isSupportedProductType(productType)) {
            call.reject("Le type de produit Google Play est invalide.", "INVALID_PRODUCT_TYPE");
            return;
        }

        withBillingClient(call, () -> {
            QueryPurchasesParams.Builder builder = QueryPurchasesParams
                .newBuilder()
                .setProductType(productType);
            if (BillingClient.ProductType.SUBS.equals(productType)) {
                builder.includeSuspendedSubscriptions(true);
            }
            billingClient.queryPurchasesAsync(builder.build(), (billingResult, purchases) -> {
                if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    call.reject(billingResult.getDebugMessage().isBlank() ? "Restauration des achats Google Play impossible." : billingResult.getDebugMessage(), "RESTORE_QUERY_FAILED", null, billingResultToObject(billingResult));
                    return;
                }
                JSArray restored = new JSArray();
                for (Purchase purchase : purchases) restored.put(purchaseToObject(purchase));
                JSObject ret = new JSObject();
                ret.put("purchases", restored);
                call.resolve(ret);
            });
        });
    }

    @Override
    public void onPurchasesUpdated(@NonNull BillingResult billingResult, @Nullable List<Purchase> purchases) {
        JSObject event = billingResultToObject(billingResult);
        JSArray purchaseArray = new JSArray();
        if (purchases != null) {
            for (Purchase purchase : purchases) purchaseArray.put(purchaseToObject(purchase));
        }
        event.put("purchases", purchaseArray);
        notifyListeners("purchaseUpdated", event, true);
    }

    @Override
    protected void handleOnDestroy() {
        if (billingClient != null && billingClient.isReady()) billingClient.endConnection();
        super.handleOnDestroy();
    }
}
