# OGA Formation Studio V4 — LOT 4 — Recette fonctionnelle A01–A20

**Référence contrôlée :** `omnia-global-academy-v2-reference-studio-v4-lot3-evaluations-parcours-build-success-20261019-135900.zip`

**État :** tous les scénarios ci-dessous sont **NOT TESTED sur cette référence publiée**, tant qu'un testeur n'a pas consigné une preuve de navigation, d'enregistrement et, le cas échéant, de backend. Les scripts statiques ne valident pas un scénario E2E. Réaliser les tests sur une formation de test, jamais sur des résultats certifiants réels. Après chaque test, conserver capture, URL, date, support et résultat PASS / FAIL / NOT TESTED.

## Anciennes formations et rédaction

- **A01 — NOT TESTED** : ouvrir une ancienne formation IA-101 sur PC, vérifier absence de crash.
- **A02 — NOT TESTED** : ouvrir la même formation sur mobile ; inspecter modules, leçons, médias et évaluations.
- **A03 — NOT TESTED** : rédiger texte et titres directement dans le canevas sans commande « Ajouter ce texte à la leçon ».
- **A04 — NOT TESTED** : enregistrer, changer de leçon, revenir, actualiser ; contrôler texte identique, ordre et absence de doublon.
- **A05 — NOT TESTED** : simuler perte de réseau avant sauvegarde ; constater brouillon conservé, erreur explicite et réessai.
- **A06 — NOT TESTED** : continuer à écrire pendant une sauvegarde ; contrôler qu'aucune frappe récente n'est effacée.

## Interface et historique

- **A07 — NOT TESTED** : alterner Simple/Avancé sans perte ; vérifier les 52 identifiants disponibles en mode Avancé.
- **A08 — NOT TESTED** : masquer/rouvrir bibliothèque et inspecteur sur PC et mobile.
- **A09 — NOT TESTED** : réduire l'en-tête ; vérifier que Paramètres reste accessible.
- **A10 — NOT TESTED** : chaque menu `…` se ferme au premier clic extérieur et par Échap.
- **A11 — NOT TESTED** : ajouter un bloc → Annuler le retire → Rétablir le restaure ; taper du texte dans un bloc → Annuler/Rétablir ; tester déplacement, duplication et suppression éligible. **Priorité bloquante**, car des échecs ont été rapportés avant les LOTS 2 et 3.

## Médias, évaluations et publication

- **A12 — NOT TESTED** : insérer image, vidéo, document et QCM entre paragraphes ; déplacer, sauvegarder et actualiser ; aucune perte de référence média.
- **A13 — NOT TESTED** : vider avec confirmation une évaluation en brouillon ; préserver la synthèse et ses données non liées à l'évaluation.
- **A14 — NOT TESTED** : protéger les tentatives et notes anciennes lors de la désactivation d'une évaluation publiée. **Attention : la règle actuelle interdit de modifier directement une version publiée ; tester la création d'un brouillon/version ultérieure au lieu de forcer cette modification.**
- **A15 — NOT TESTED** : nouvelle formation → écriture → sauvegarde → aperçu → Centre Qualité → publication.
- **A16 — NOT TESTED** : introduction sans évaluation officielle, synthèse, conclusion obligatoire et examen final facultatif.
- **A17 — NOT TESTED** : durées, progression, accès après achat, règles de temps, droits et aperçu gratuit.

## Anti-régression et supports

- **A18 — NOT TESTED** : ancienne formation sur PC/mobile ; vérifier absence de `InvalidCharacterError` DOMTokenList et crash global.
- **A19 — NOT TESTED** : comparaison éditeur/lecteur apprenant ; blocs historiques HTML/JSON et blocs inconnus conservés sans destruction.
- **A20 — NOT TESTED** : responsive PC/iPhone/Android, navigation clavier, RTL de l'arabe si applicable.

## Consignation d'une preuve

Pour chaque résultat, indiquer : ID, PASS/FAIL/NOT TESTED, date/heure, formation de test, rôle, navigateur/appareil, étapes exécutées, résultat observé, capture ou console, lien incident si FAIL.

**Critère final :** impossible de déclarer `OGA_V4_FUNCTIONAL_SUCCESS` si A11, A04, A15, A17, A18 ou A19 est FAIL/NOT TESTED. Les autres cas doivent avoir un statut documenté et une décision d'acceptation explicite.
