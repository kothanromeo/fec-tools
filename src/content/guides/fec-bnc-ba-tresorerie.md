---
title: "FEC des BNC et des exploitants agricoles en comptabilité de trésorerie (21 et 22 champs)"
seoTitle: "FEC BNC et BA en comptabilité de trésorerie : les 21 et 22 champs"
description: "BNC et exploitants agricoles : quel FEC selon la comptabilité tenue, les champs DateRglt, ModeRglt, NatOp et IdClient, et ce qui peut rester vide."
keywords: ["fec bnc", "fec profession libérale", "fec comptabilité de trésorerie", "fec recettes dépenses", "fec bénéfices agricoles", "fec 22 champs", "fec 21 champs", "dateRglt modeRglt natop idclient", "fec médecin avocat", "fec bnc 2035", "fec agriculteur"]
published: 2026-11-09
faq:
  - q: "Je suis en micro-BNC, dois-je produire un FEC ?"
    a: "<p>L’obligation de présenter la comptabilité sous forme de FEC vise les contribuables qui tiennent une comptabilité informatisée et relèvent d’un régime réel. La doctrine prévoit aussi des assouplissements, par exemple l’enregistrement des recettes par récapitulatif au moins mensuel pour certains petits contribuables. En cas de doute, faites le point avec votre expert-comptable ou votre association de gestion agréée.</p>"
  - q: "Comment coder le mode de règlement ?"
    a: "<p>En toutes lettres (chèque, espèces, virement) ou avec des codes, par exemple 01 pour la carte bancaire et 02 pour le chèque. Dans ce cas, la table de correspondance doit figurer dans le descriptif du fichier.</p>"
---

Le format standard du FEC, avec ses 18 champs, a été pensé pour une comptabilité d’engagement : on enregistre une facture quand elle est émise ou reçue. Mais beaucoup de professions libérales (BNC) et d’exploitants agricoles (BA) tiennent une **comptabilité de trésorerie**, où l’on enregistre les recettes et les dépenses au moment où elles sont encaissées ou payées.

L’article A. 47 A-1 du Livre des procédures fiscales prévoit pour eux des formats adaptés, dans son paragraphe VIII.

## Trois cas de figure

| Situation | Format | Nombre de champs |
|---|---|---|
| BNC ou BA en **comptabilité d’engagement** | Les 18 champs standard, avec quelques assouplissements | 18 |
| BA en **comptabilité de trésorerie** | Les 18 champs + 3 champs de règlement | 21 |
| BNC en **comptabilité de trésorerie** | Les 21 champs du BA + l’identification du client | 22 |

## Les assouplissements par rapport au format standard

Pour les BNC et les BA, le texte autorise à laisser vides (« à blanc si non utilisé ») des champs obligatoires dans le cas général :

- `JournalCode` et `JournalLib` : un praticien qui n’utilise pas de journaux n’a pas à en inventer ;
- `CompteNum` : le numéro de compte peut rester vide si le plan de comptes ne suit pas le plan comptable général ;
- comme dans le format standard, les comptes auxiliaires, le lettrage et les devises.

Les autres champs restent obligatoires, en particulier le libellé du compte, la pièce, la date, le libellé de l’écriture, les montants et la date de validation. Le [lecteur de FEC](/) en tient compte : il ne signale pas comme erreur un `JournalCode` vide dans un fichier BNC ou BA en trésorerie.

## Les champs supplémentaires

Ils sont ajoutés **après** les 18 champs standard, dans cet ordre :

| N° | Champ | Contenu | Peut être vide |
|---|---|---|---|
| 19 | `DateRglt` | Date du règlement : encaissement de la recette ou paiement de la dépense | |
| 20 | `ModeRglt` | Mode de règlement : chèque, espèces, virement, carte… | |
| 21 | `NatOp` | Nature de l’opération | oui |
| 22 | `IdClient` | Identification du client (BNC uniquement) | oui |

**La date de règlement** est le cœur de la comptabilité de trésorerie : c’est elle qui rattache une recette à un exercice. Elle se distingue de la date de pièce (la date de la note d’honoraires, par exemple).

**Le mode de règlement** peut être écrit en clair ou codé. S’il est codé, la table de correspondance doit figurer dans le descriptif du fichier.

**L’identification du client** peut elle aussi être codée, notamment lorsque la profession est soumise au secret professionnel (médecins, avocats…). Le vérificateur doit pouvoir faire le lien avec les pièces, pas forcément lire le nom du patient dans le fichier.

## Un en-tête complet

Pour un BNC en comptabilité de trésorerie, la première ligne du fichier ressemble donc à ceci (séparée par des tabulations) :

```text
JournalCode  JournalLib  EcritureNum  EcritureDate  CompteNum  CompteLib  CompAuxNum  CompAuxLib  PieceRef  PieceDate  EcritureLib  Debit  Credit  EcritureLet  DateLet  ValidDate  Montantdevise  Idevise  DateRglt  ModeRglt  NatOp  IdClient
```

À noter : dans le tableau du texte réglementaire pour ce cas, le champ 13 est écrit `Crédit`, avec un accent, alors qu’il est écrit `Credit` partout ailleurs. Le lecteur accepte les deux orthographes.

## Vérifier son fichier

Déposez le fichier dans le [validateur](/valider-fec/) : la structure détectée (18, 21 ou 22 champs) s’affiche dans les contrôles « Fichier », et l’export Excel ajoute les colonnes de règlement à l’onglet « Écritures ».
