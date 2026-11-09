---
title: "Vérifier son FEC avant un contrôle fiscal : la méthode en 6 étapes"
seoTitle: "Vérifier son FEC avant un contrôle fiscal : méthode et outils"
description: "Avis de contrôle reçu ? La méthode pour vérifier son FEC avant de le remettre : export, nom du fichier, Test Compta Démat, cohérence et descriptif."
keywords: ["vérifier fec avant contrôle fiscal", "contrôle fiscal fec", "remise fec", "test compta démat", "examen de comptabilité fec", "avis de vérification fec", "préparer contrôle fiscal", "descriptif fec", "fec délai remise", "vérification comptabilité informatisée"]
published: 2026-11-09
faq:
  - q: "Quel est le délai pour remettre le FEC ?"
    a: "<p>Dans une vérification de comptabilité classique, le FEC est remis au vérificateur dès le début des opérations de contrôle. Dans un examen de comptabilité (contrôle à distance), il doit être transmis dans les 15 jours suivant la réception de l’avis d’examen. Dans les deux cas, mieux vaut l’avoir vérifié avant.</p>"
  - q: "Qu’est-ce que Test Compta Démat ?"
    a: "<p>C’est le logiciel gratuit mis à disposition par la DGFiP pour tester la conformité d’un FEC à la norme. Il vérifie la structure et le format, pas la régularité de la comptabilité. Il se télécharge sur impots.gouv.fr.</p>"
---

L’avis de vérification ou d’examen de comptabilité est arrivé, et l’une des premières choses demandées est le Fichier des Écritures Comptables. C’est le moment de le vérifier, pas celui de le découvrir en même temps que le vérificateur. Voici une méthode simple, applicable en une demi-journée.

## 1. Exporter le bon fichier

Le FEC se génère depuis la fonction prévue à cet effet dans le logiciel comptable, souvent dans un menu « Clôture », « Fiscal » ou « Export FEC ». Vérifiez trois choses :

- l’**exercice** : un fichier par exercice contrôlé, du premier au dernier jour ;
- les **écritures validées** uniquement, pas le brouillard ;
- la présence des **à-nouveaux** et des écritures d’inventaire.

Si un expert-comptable tient votre comptabilité, c’est lui qui produit le fichier. Demandez-le-lui tôt.

## 2. Vérifier le nom du fichier

Il doit être de la forme `SirenFECAAAAMMJJ`, avec la date de clôture de l’exercice : `123456782FEC20251231.txt`. Renommez-le si besoin : c’est la seule modification que l’on peut faire sans risque.

## 3. Contrôler la forme

Deux outils gratuits, complémentaires :

- **Test Compta Démat**, le logiciel de la DGFiP, fait référence pour la conformité à la norme. Il s’installe sur Windows ;
- le [validateur de FEC](/valider-fec/) de ce site fait les mêmes vérifications de structure (séparateur, champs, dates, montants), directement dans le navigateur, sans installer ni envoyer le fichier.

Toute anomalie de forme se corrige **dans le logiciel** (paramétrage de l’export), puis on régénère le fichier. Ne jamais retoucher un FEC dans un tableur.

## 4. Contrôler le fond

C’est l’étape que l’on oublie, et c’est pourtant celle qui compte pour la suite du contrôle. Le validateur vérifie automatiquement :

- l’**équilibre** de chaque écriture et du fichier ;
- la **numérotation** : continue, sans trou, et dans l’ordre des dates ;
- les **dates** : aucune écriture hors de l’exercice ;
- le **solde de caisse**, qui ne doit jamais devenir négatif ;
- les écritures des **dimanches et jours fériés**, les **doublons**, les comptes hors plan comptable.

Le détail de chaque anomalie et de ses causes habituelles est dans le guide [des anomalies FEC](/guides/anomalies-fec-controle-fiscal/).

## 5. Préparer le descriptif

Le FEC doit être accompagné d’un descriptif qui explique ses conventions. Il tient souvent en une page :

- la signification des **codes journaux** (VT = ventes, HA = achats…) ;
- le mode de **numérotation** des écritures : continu sur le fichier, ou par journal ;
- la **convention** utilisée pour la référence et la date de pièce des à-nouveaux et écritures sans justificatif ;
- les **tables de codes** éventuelles : devises, modes de règlement, établissements ;
- l’**encodage** et le séparateur du fichier.

## 6. Préparer vos explications

Pour chaque point orange du rapport (une rupture de numérotation, un jour de caisse négative, une série d’écritures un dimanche), rédigez une explication courte et factuelle. Ce n’est pas un aveu : c’est la preuve que vous connaissez votre comptabilité.

L’export Excel du [lecteur de FEC](/ouvrir-fec-excel/) contient un onglet « Contrôles » avec la liste complète et les lignes concernées. C’est une bonne base de travail à partager avec votre expert-comptable.

## Ce que l’outil ne fait pas

Il ne dit pas si votre comptabilité est **régulière** au sens fiscal : un fichier parfaitement conforme peut contenir des charges non déductibles ou des recettes oubliées. Il ne remplace ni Test Compta Démat pour la conformité officielle, ni le regard d’un expert-comptable sur le fond. Il sert à arriver au contrôle sans mauvaise surprise sur le fichier lui-même.
