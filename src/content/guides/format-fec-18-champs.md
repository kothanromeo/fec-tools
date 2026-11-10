---
title: "Le format du FEC : les 18 champs et les règles de l’article A. 47 A-1"
seoTitle: "Format FEC : les 18 champs obligatoires expliqués (article A47 A-1)"
description: "Les 18 champs du FEC un par un, le nom du fichier, le séparateur, l’encodage, les dates et les montants, d’après l’article A. 47 A-1 du LPF."
keywords: ["format fec", "fec 18 champs", "champs obligatoires fec", "article a47 a-1 lpf", "nom fichier fec", "sirenfecaaaammjj", "séparateur fec", "fec tabulation pipe", "fec encodage", "journalcode ecriturenum", "compauxnum", "fec montant sens", "structure fec"]
published: 2026-11-09
faq:
  - q: "Le FEC peut-il être un fichier CSV ?"
    a: "<p>Oui pour l’extension, non pour le séparateur habituel. Le fichier doit être un texte délimité par une tabulation ou par le caractère « | ». Un CSV au point-virgule, comme ceux qu’Excel produit en français, n’est pas conforme.</p>"
  - q: "Faut-il un fichier par exercice ?"
    a: "<p>Oui : un FEC correspond à un exercice. Pour un très gros volume, il peut être découpé en plusieurs fichiers, chacun reprenant la ligne d’en-tête ; c’est à préciser dans le descriptif.</p>"
  - q: "Qu’est-ce que le descriptif du FEC ?"
    a: "<p>C’est un document qui accompagne le fichier et explique ses conventions : signification des codes journaux, mode de numérotation des écritures, convention utilisée pour les à-nouveaux, codes devises, etc. Il est prévu par le XI de l’article A. 47 A-1.</p>"
---

Le Fichier des Écritures Comptables n’est pas un export libre. Sa forme est fixée au millimètre par l’**article A. 47 A-1 du Livre des procédures fiscales**, en vigueur depuis août 2013, et commentée par la doctrine administrative (BOI-CF-IOR-60-40-20). Ce guide reprend ces règles dans l’ordre où on les rencontre en ouvrant un fichier.

## Le nom du fichier

Le texte est précis : `SirenFECAAAAMMJJ`, où *Siren* est le numéro SIREN de l’entreprise et *AAAAMMJJ* la **date de clôture** de l’exercice. Pour une entreprise dont le SIREN est 123456782 et l’exercice clos le 31 décembre 2025 :

```text
123456782FEC20251231.txt
```

Pas de tiret, pas d’espace, pas de « export_compta_final_v2 ». C’est aussi ce nom qui permet de savoir, sans ouvrir le fichier, de quel exercice il s’agit.

## La forme du fichier

| Règle | Exigence |
|---|---|
| Type | Fichier « à plat », texte, à organisation séquentielle (le XML est aussi admis, mais rare : voir [le FEC au format XML](/guides/fec-format-xml/)) |
| Première ligne | Les noms des champs |
| Séparateur de champs | Tabulation ou caractère « \| » |
| Fin de ligne | Retour chariot et/ou saut de ligne |
| Encodage | ASCII, ISO 8859-15 ou UTF-8 |
| Dates | `AAAAMMJJ`, sans séparateur |
| Montants | Virgule décimale, **aucun séparateur de milliers**, signe à gauche ou à droite |

La règle des montants est souvent oubliée : `15000,00` est conforme, `15 000,00` et `15000.00` ne le sont pas.

## Les 18 champs, un par un

Dans l’ordre imposé par le texte. La dernière colonne indique les champs que la norme autorise à laisser vides (« à blanc si non utilisé »).

| N° | Champ | Contenu | Type | Peut être vide |
|---|---|---|---|---|
| 1 | `JournalCode` | Code du journal (VT, HA, BQ…) | Texte | |
| 2 | `JournalLib` | Libellé du journal | Texte | |
| 3 | `EcritureNum` | Numéro de l’écriture, commun à toutes ses lignes | Texte | |
| 4 | `EcritureDate` | Date de comptabilisation | Date | |
| 5 | `CompteNum` | Numéro de compte (plan comptable général) | Texte | |
| 6 | `CompteLib` | Libellé du compte | Texte | |
| 7 | `CompAuxNum` | Numéro de compte auxiliaire (client, fournisseur) | Texte | oui |
| 8 | `CompAuxLib` | Libellé du compte auxiliaire | Texte | oui |
| 9 | `PieceRef` | Référence de la pièce justificative | Texte | |
| 10 | `PieceDate` | Date de la pièce justificative | Date | |
| 11 | `EcritureLib` | Libellé de l’écriture | Texte | |
| 12 | `Debit` | Montant au débit | Nombre | |
| 13 | `Credit` | Montant au crédit | Nombre | |
| 14 | `EcritureLet` | Code de lettrage | Texte | oui |
| 15 | `DateLet` | Date de lettrage | Date | oui |
| 16 | `ValidDate` | Date de validation de l’écriture | Date | |
| 17 | `Montantdevise` | Montant en devise | Nombre | oui |
| 18 | `Idevise` | Code de la devise | Texte | oui |

Quelques précisions utiles :

- **Les noms des champs doivent être exacts.** Le texte écrit `CompAuxNum` et `CompAuxLib`, pas `CompteAuxNum` ; `Montantdevise` avec un *d* minuscule. Beaucoup de logiciels prennent des libertés, et un contrôle automatique s’en aperçoit.
- **Débit et crédit sont toujours renseignés** : la colonne non utilisée contient `0,00`. Un champ vide n’est admis que pour les données marquées ci-dessus.
- **La pièce est obligatoire même sans pièce.** Pour les à-nouveaux ou les écritures d’inventaire, la doctrine demande une référence et une date conventionnelles, expliquées dans le descriptif.
- **La date de validation** est celle à laquelle l’écriture devient définitive. Sans saisie en brouillard, elle est égale à la date de comptabilisation.

### La variante Montant / Sens

Si le logiciel ne distingue pas débit et crédit, les champs 12 et 13 peuvent être remplacés par `Montant` (le montant de l’opération) et `Sens`, qui prend les valeurs `D` ou `C`, ou `+1` ou `-1` (sans espace entre le signe et le chiffre).

### Une colonne de plus pour les établissements

Une entreprise à plusieurs établissements peut ajouter une 19<sup>e</sup> colonne avec le code établissement, à expliquer dans le descriptif.

## Les règles sur les écritures

Au-delà du format, la doctrine pose trois principes que l’on vérifie dans le contenu :

1. **Un seul fichier par exercice**, qui contient toutes les écritures, y compris les **à-nouveaux** et les écritures d’inventaire (amortissements, provisions, stocks, régularisations).
2. **Une numérotation chronologique**, « croissante, sans rupture ni inversion ». Elle peut être continue sur tout le fichier ou propre à chaque journal.
3. **Pas d’écritures de centralisation** : le détail doit figurer ligne à ligne (avec des exceptions limitées, par exemple pour certaines petites recettes de caisse).

## Un exemple de ligne

Avec une tabulation comme séparateur (représentée ici par `→`) :

```text
VT→Journal des ventes→42→20250305→411000→Clients→C0002→STUDIO GRAPHIQUE NORD→FA2025-003→20250305→Facture prestation 03/2025→2520,00→0,00→V2→20251231→20250305→→
```

Le [lecteur de FEC](/) affiche ces lignes en tableau et vérifie automatiquement chacune de ces règles. Pour les entreprises au BNC ou au bénéfice agricole qui tiennent une comptabilité de trésorerie, le format comporte des champs supplémentaires : voir [le guide FEC BNC et BA](/guides/fec-bnc-ba-tresorerie/).
