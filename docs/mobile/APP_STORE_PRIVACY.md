# Préparation Apple App Privacy

La fiche App Store Connect doit refléter les fonctions réellement activées lors de la soumission.

## Données liées à l’utilisateur susceptibles d’être déclarées

- Coordonnées et identifiants de compte.
- Contenu utilisateur : fichiers, CV, lettres, messages, publications et preuves pédagogiques.
- Achats et droits d’accès.
- Activité d’apprentissage et interactions dans l’application.
- Identifiants d’appareil pour les notifications.
- Diagnostics et données de sécurité limitées.
- Photos, audio ou vidéo uniquement lorsque la fonction correspondante est utilisée.

## Tracking

Le code du Module 6 ne doit pas déclarer de suivi publicitaire. Si un SDK publicitaire ou un partage inter-entreprises est ajouté plus tard, la déclaration et, le cas échéant, App Tracking Transparency devront être réévaluées.

## Manifest et permissions

`PrivacyInfo.xcprivacy` déclare l’accès requis aux horodatages de fichiers. Le script iOS ajoute des descriptions précises pour la caméra, le microphone et la photothèque. Vérifier également les manifests de confidentialité des SDK intégrés dans l’archive Xcode.

## Suppression de compte et UGC

La suppression est accessible dans Profil > Sécurité et via `/supprimer-compte`. Le forum propose signalement, blocage et déblocage d’utilisateurs, en complément des outils de modération.
