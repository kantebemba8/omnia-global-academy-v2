import Foundation
import Capacitor
import StoreKit

@objc(OmniaStorePlugin)
public class OmniaStorePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "OmniaStorePlugin"
    public let jsName = "OmniaStore"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "queryProduct", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restorePurchases", returnType: CAPPluginReturnPromise),
    ]

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": AppStore.canMakePayments])
    }

    @objc func queryProduct(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId"), !productId.isEmpty else {
            call.reject("L’identifiant du produit est obligatoire.", "PRODUCT_ID_REQUIRED")
            return
        }

        Task {
            do {
                guard let product = try await Product.products(for: [productId]).first else {
                    call.reject("Produit introuvable dans l’App Store.", "PRODUCT_NOT_FOUND")
                    return
                }
                call.resolve([
                    "product": [
                        "productId": product.id,
                        "productType": product.type == .autoRenewable ? "subs" : "inapp",
                        "name": product.displayName,
                        "title": product.displayName,
                        "description": product.description,
                        "offers": [[
                            "formattedPrice": product.displayPrice,
                            "offerToken": NSNull(),
                        ]],
                    ],
                ])
            } catch {
                call.reject(error.localizedDescription, "PRODUCT_QUERY_FAILED", error)
            }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        // StoreKit 2 and the JavaScript bridge are prepared here. The purchase
        // remains deliberately disabled until App Store Server API credentials,
        // signed transaction verification and the first Xcode build are complete.
        call.reject(
            "La vérification serveur App Store doit être finalisée sur Mac avant d’activer les achats iOS.",
            "APPLE_STORE_SERVER_CONFIGURATION_PENDING"
        )
    }

    @objc func restorePurchases(_ call: CAPPluginCall) {
        call.reject(
            "La restauration App Store doit être finalisée sur Mac avec les identifiants Apple officiels.",
            "APPLE_STORE_SERVER_CONFIGURATION_PENDING"
        )
    }
}
