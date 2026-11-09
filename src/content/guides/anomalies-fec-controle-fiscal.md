---
title: "Les anomalies FEC les plus fréquentes, et comment les corriger"
seoTitle: "Anomalies FEC : les erreurs fréquentes avant un contrôle fiscal"
description: "Séparateur, montants, champs vides, écritures déséquilibrées, ruptures de numérotation, caisse négative : les anomalies FEC courantes et leur correction."
keywords: ["anomalies fec", "erreurs fec", "fec non conforme", "fec rejeté", "corriger fec", "rupture numérotation fec", "écriture déséquilibrée fec", "caisse créditrice", "solde de caisse négatif", "fec contrôle fiscal", "fec séparateur", "fec champ vide"]
published: 2026-11-09
faq:
  - q: "Puis-je corriger mon FEC dans Excel ?"
    a: "<p>C’est déconseillé. Excel modifie silencieusement les numéros de compte, les dates et l’encodage, et un FEC retouché à la main ne reflète plus la comptabilité réellement tenue. Corrigez le paramétrage de l’export ou les écritures dans le logiciel, puis régénérez le fichier.</p>"
  - q: "Une anomalie de contenu entraîne-t-elle forcément un redressement ?"
    a: "<p>Non. Une rupture de numérotation ou une écriture du dimanche peut avoir une explication parfaitement légitime. Ce qui compte, c’est de pouvoir la donner. L’intérêt de les repérer avant, c’est de préparer cette explication.</p>"
---

Un FEC peut être refusé pour sa forme, ou accepté mais attirer l’attention pour son contenu. Voici les problèmes que l’on rencontre le plus souvent, classés du plus simple au plus délicat. Tous sont détectés par le [validateur de FEC](/valider-fec/).

## Les anomalies de forme

### 1. Le mauvais séparateur

Le texte n’autorise que la **tabulation** ou le caractère **« | »**. Un export CSV au point-virgule, ou un fichier « enregistré sous » depuis Excel, n’est pas conforme.

**Correction** : dans le logiciel comptable, utilisez la fonction d’export FEC dédiée plutôt qu’un export générique.

### 2. Les montants mal formatés

Trois erreurs reviennent sans cesse : le séparateur de milliers (`15 000,00`), le point décimal (`15000.00`) et le symbole monétaire. La norme exige `15000,00`.

### 3. Les noms de champs approximatifs

`CompteAuxNum` au lieu de `CompAuxNum`, `MontantDevise` au lieu de `Montantdevise`, ou des intitulés traduits. Le format exige les noms exacts de l’article A. 47 A-1 (voir [les 18 champs](/guides/format-fec-18-champs/)).

### 4. Les champs obligatoires vides

Les plus touchés sont `PieceRef` et `PieceDate` sur les écritures sans justificatif, comme les à-nouveaux, les amortissements ou les provisions. La doctrine est claire : il faut une référence et une date conventionnelles, et les expliquer dans le descriptif.

### 5. Le nombre de colonnes qui varie

Si une ligne a une colonne de trop, c’est presque toujours un caractère « | » ou une tabulation présent dans un libellé. Toutes les colonnes suivantes se décalent, et les montants se retrouvent dans le lettrage.

## Les anomalies de contenu

### 6. Les écritures déséquilibrées

Chaque écriture doit avoir autant au débit qu’au crédit. Un déséquilibre, même d’un centime, trahit en général un export incomplet ou une écriture modifiée hors du logiciel. Le fichier dans son ensemble doit aussi être équilibré.

### 7. Les ruptures de numérotation

La numérotation doit être « croissante, sans rupture ni inversion ». Un trou apparaît typiquement quand une écriture a été supprimée après validation, ou quand le logiciel numérote aussi les écritures de brouillard abandonnées.

Ce n’est pas forcément grave, mais un vérificateur demandera ce qu’il y avait sous le numéro manquant. Préparez la réponse.

### 8. Les inversions chronologiques

Un numéro d’écriture plus grand portant une date plus ancienne : c’est le signe d’une saisie tardive, antidatée. Encore une fois, il y a souvent une explication (une facture reçue en retard), mais elle doit exister.

### 9. Les écritures hors exercice

Des lignes datées avant l’ouverture ou après la clôture de l’exercice indiquent une erreur de paramétrage de l’export, ou un exercice qui n’a pas la durée attendue.

### 10. L’absence d’à-nouveaux

Sauf pour un premier exercice, le FEC doit commencer par la reprise des soldes de l’exercice précédent. Un fichier qui démarre directement par les opérations de janvier est incomplet.

## Les points qui attirent l’attention

Ces éléments ne rendent pas le fichier non conforme, mais ils sont regardés de près dans toute analyse de FEC.

### Le solde de caisse négatif

Une caisse ne peut pas contenir moins de zéro euro. Si le compte `53` devient créditeur, même un seul jour, c’est soit qu’une recette en espèces n’a pas été enregistrée, soit que les écritures ne sont pas saisies à leur date. Dans les commerces qui manipulent beaucoup d’espèces, c’est l’un des premiers contrôles effectués.

### Les écritures du dimanche et des jours fériés

Une vente en caisse un jour de fermeture pose question ; une régularisation saisie un dimanche soir par le comptable, beaucoup moins. L’outil les liste, à vous de faire le tri.

### Les comptes hors plan comptable

Un numéro de compte qui ne commence pas par un chiffre de 1 à 8 sort du plan comptable général et complique l’analyse automatique.

### Les doublons

Deux lignes identiques (même date, même compte, même montant, même pièce) dans deux écritures différentes : facture saisie deux fois, ou import en double.

## La bonne méthode

1. Exportez le FEC depuis la fonction dédiée du logiciel comptable.
2. Passez-le dans le [validateur](/valider-fec/) et corrigez à la source tout ce qui est en rouge.
3. Pour chaque point orange, rédigez une explication d’une ligne.
4. Régénérez le fichier et revérifiez.

La démarche complète est détaillée dans [vérifier son FEC avant un contrôle fiscal](/guides/verifier-fec-avant-controle-fiscal/).
