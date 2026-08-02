# Checklist de publication mobile Omnia Global Academy

## État bloquant avant soumission

- Le vrai fichier `android/app/google-services.json` doit provenir du projet Firebase officiel Omnia.
- APNs, l’équipe Apple et les capacités Xcode doivent être configurés sur Mac avec les vrais comptes.
- Les produits Google Play et App Store doivent être créés avec les identifiants définis par le Super-admin.
- Les URL publiques `/confidentialite`, `/cgu` et `/supprimer-compte` doivent être déployées et accessibles sans compte.
- Les fichiers `assetlinks.json` et `apple-app-site-association` doivent être générés avec les vraies empreintes et le vrai Team ID.

## Android

1. Définir `OGA_ANDROID_VERSION_CODE` et `OGA_ANDROID_VERSION_NAME`.
2. Créer une clé de signature sécurisée hors du dépôt.
3. Définir `OGA_ANDROID_KEYSTORE_PATH`, `OGA_ANDROID_KEYSTORE_PASSWORD`, `OGA_ANDROID_KEY_ALIAS` et `OGA_ANDROID_KEY_PASSWORD` uniquement dans le terminal ou le coffre CI.
4. Exécuter le build web, le build natif, `lintRelease`, `bundleRelease` et les tests du Module 6.
5. Activer Play App Signing et téléverser l’AAB signé dans Internal Testing.
6. Renseigner Data Safety à partir du document dédié, sans déclarer une donnée non réellement collectée.
7. Renseigner l’URL publique de suppression de compte : `https://omniaglobalacademy.com/supprimer-compte`.

## iOS

1. Travailler sur un Mac avec Xcode 26 ou version ultérieure.
2. Générer le projet iOS avec Capacitor, puis exécuter `npm run mobile:module6:ios`.
3. Sélectionner l’équipe Apple réelle et le Bundle ID `com.omniaglobalacademy.app`.
4. Activer Push Notifications et Associated Domains dans Xcode.
5. Ajouter le vrai `GoogleService-Info.plist` seulement si Firebase iOS est retenu.
6. Vérifier `PrivacyInfo.xcprivacy`, les textes de permissions et StoreKit 2.
7. Archiver, téléverser sur TestFlight et tester la suppression de compte, les achats restaurés et les liens profonds.

## Tests obligatoires sur appareils

- Android 7/API 24, Android récent/API 36 et au moins un appareil à faible mémoire.
- iPhone avec encoche/Dynamic Island et iPad si la fiche store annonce la compatibilité iPad.
- Connexion lente, coupures réseau, reprise après arrière-plan et stockage faible.
- Tous les rôles principaux, langue française et anglaise, lecteur d’écran, taille de police agrandie et clavier externe.
