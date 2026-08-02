# Matrice de tests mobiles

## Authentification et sécurité

- Connexion, OTP, expiration et restauration de session.
- Compte suspendu ou supprimé refusé.
- Changement de mot de passe et suppression définitive avec mot de passe erroné/correct.
- Protection du compte de démonstration et du dernier Super-admin.

## Parcours apprenant

- Catalogue, inscription gratuite, achat, lecteur, progression et reprise hors connexion.
- Vidéo, audio, document, SCORM et évaluation selon les capacités de l’appareil.
- Certificat, badge, Skills Passport, PDF et partage natif.

## Communauté et sécurité utilisateur

- Publication, réponse, signalement et modération.
- Blocage d’un auteur, masquage de ses contenus, déblocage depuis Profil > Sécurité.
- Vérification qu’un utilisateur ne peut pas se bloquer lui-même.

## Paiements

- Google Play : achat, attente, annulation, restauration, consommation et double attribution empêchée.
- Coaching individuel : redirection externe autorisée seulement pour le service direct.
- Web : FedaPay reste séparé et en SANDBOX jusqu’à activation explicite.
- iOS : StoreKit 2 en environnement sandbox/TestFlight.

## Appareil et accessibilité

- Safe areas, rotation, clavier, bouton Retour Android et reprise après arrière-plan.
- TalkBack/VoiceOver, ordre de focus, labels des boutons icône, contraste et police à 200 %.
- Mode sombre système, faible mémoire, stockage faible et permissions refusées.

## Publication

- Liens profonds HTTPS et schéma `omnia://`.
- Notifications premier plan/arrière-plan après configuration FCM/APNs réelle.
- AAB Release, APK Release, lintRelease, installation interne et journal de crash.
