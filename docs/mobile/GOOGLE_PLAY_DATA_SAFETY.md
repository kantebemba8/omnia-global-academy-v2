# Préparation Google Play — Data Safety

Ce document est une base de saisie. La réponse finale doit être vérifiée contre les services réellement activés en production.

## Catégories potentiellement collectées

- Informations personnelles : nom, email, téléphone, date de naissance, pays et photo facultative.
- Activité dans l’application : progression, évaluations, recherches, interactions communautaires et historiques fonctionnels.
- Fichiers et documents : CV, lettres, justificatifs, preuves de compétences et contenus choisis par l’utilisateur.
- Audio, vidéo et photos : uniquement lorsque l’utilisateur démarre une fonction correspondante.
- Informations financières : références de commandes, statuts, remboursements et droits d’accès ; les données bancaires complètes restent chez le prestataire de paiement ou le store.
- Identifiants d’appareil : jeton push et informations techniques nécessaires à la livraison des notifications et à la sécurité.
- Diagnostics et sécurité : erreurs, traces antifraude et journaux d’audit limités.

## Finalités

Fonctionnement de la plateforme, personnalisation du parcours, sécurité, prévention de la fraude, assistance, conformité, communications choisies et attribution des achats.

## Partage

Déclarer uniquement les destinataires réellement actifs : Supabase, Google Play, Apple, Firebase si configuré, FedaPay pour le web SANDBOX/production future, fournisseur email/SMS et outil de diagnostic activé. Les prestataires doivent être décrits comme fournisseurs de service lorsqu’ils traitent les données pour Omnia.

## Contrôles utilisateur

- Préférences email, SMS, push et newsletter.
- Signalement et blocage d’utilisateurs dans les espaces communautaires.
- Suppression du compte dans l’application et sur la page publique `/supprimer-compte`.
- Chiffrement TLS en transit et stockage sécurisé de la session native.

Ne pas cocher « données non collectées » tant qu’une fonction production peut transmettre l’une des catégories ci-dessus.
