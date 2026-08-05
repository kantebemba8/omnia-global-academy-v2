# Suspension, suppression de compte et conservation

## Suspension volontaire

La suspension est disponible dans `Mon profil > Sécurité > Gestion du compte` pour tous les rôles.

- Le mot de passe actuel, un motif et la confirmation `SUSPENDRE` sont obligatoires.
- Une date de retour prévue peut être renseignée, sans empêcher une réactivation anticipée.
- Toutes les sessions sont révoquées immédiatement.
- Le profil public devient temporairement indisponible.
- Les données, formations, certificats, événements, journaux et documents ne sont pas supprimés.
- La réactivation autonome est autorisée uniquement pour une suspension demandée par le titulaire. Elle exige une nouvelle vérification du mot de passe depuis la page de connexion.
- Une suspension administrative ou de modération ne peut jamais être contournée par cette procédure. Les changements de statut administratifs effacent automatiquement tout ancien marqueur de suspension volontaire.
- Le compte de démonstration et le dernier Super-admin actif sont protégés.

## Suppression définitive

La suppression réutilise le moteur réglementaire `omnia_delete_user_account` introduit par la migration 135. Le Lot 2C ne crée pas de logique parallèle.

- Le mot de passe actuel, un motif et la confirmation `SUPPRIMER` sont obligatoires.
- Toutes les sessions et les accès sont révoqués immédiatement.
- Les identifiants directs sont effacés ou remplacés irréversiblement.
- Les lignes personnelles supprimables sont effacées et les attributions facultatives sont dissociées.
- Les écritures nécessaires à la facturation, aux paiements, à la lutte contre la fraude, à la sécurité et à l’audit réglementaire restent pseudonymisées.
- Le compte de démonstration et le dernier Super-admin actif sont protégés.

## Questionnaire facultatif

Le questionnaire d’amélioration est facultatif. Il est stocké séparément sans nom, e-mail, téléphone ou secret d’authentification. Les adresses, numéros et secrets détectables sont masqués avant stockage. Son texte n’est jamais affiché dans le journal d’activité Super-admin. Le journal administratif expose seulement l’action, la date et une catégorie de motif non sensible.

## Continuité selon les rôles

- Les formations et preuves nécessaires aux apprenants ne sont pas supprimées aveuglément avec un Professeur.
- La suspension ou suppression d’un compte personnel ne supprime pas automatiquement une Structure.
- Les événements, paiements et documents légalement nécessaires restent conservés sous une forme appropriée.
- Les journaux de modération et de sécurité requis restent pseudonymisés.

## URL publique

`https://omniaglobalacademy.com/supprimer-compte`
