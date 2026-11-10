---
title: "Le FEC au format XML : structure, schémas XSD et différences avec le format texte"
seoTitle: "FEC XML : structure, XSD de la DGFiP et différences avec le format texte"
description: "Le FEC peut être remis en XML : arborescence comptabilite › exercice › journal › ecriture › ligne, schémas XSD de la DGFiP et pièges par rapport au texte."
keywords: ["fec xml", "fec format xml", "xsd fec", "formatA47A-I-VII-1.xsd", "fichier des écritures comptables xml", "fec xml structure", "fec xml dgfip", "fec xml ou txt", "valider fec xml", "fec xml debit credit", "comptabilite exercice journal ecriture ligne"]
published: 2026-11-10
faq:
  - q: "Faut-il préférer le FEC texte ou XML ?"
    a: "<p>Les deux sont admis par l’article A. 47 A-1. Le format texte (tabulation ou « | ») reste de loin le plus utilisé, par tous les logiciels comptables. Le XML n’a d’intérêt que si votre logiciel le produit nativement. Dans le doute, remettez le format texte.</p>"
  - q: "Où trouver les schémas XSD officiels ?"
    a: "<p>La DGFiP les publie avec son outil Test Compta Démat, dont le code source est disponible sur GitHub (dépôt DGFiP/Test-Compta-Demat). Il y en a quatre : un pour le cas général et trois pour les variantes BNC et BA.</p>"
---

On parle presque toujours du FEC comme d’un fichier texte, avec ses 18 colonnes séparées par des tabulations. Mais l’article A. 47 A-1 du Livre des procédures fiscales admet aussi un **format XML**, décrit par des schémas XSD publiés par la DGFiP. Il est rare, mais certains logiciels le produisent, et il a quelques pièges qui lui sont propres.

## Quatre schémas, comme pour le format texte

La DGFiP publie un schéma par variante du FEC, avec son outil de contrôle Test Compta Démat :

| Schéma | Cas |
|---|---|
| `formatA47A-I-VII-1.xsd` | Cas général (BIC, IS) |
| `formatA47A-I-VIII-3.xsd` | BNC et BA en comptabilité d’engagement |
| `formatA47A-I-VIII-5.xsd` | BA en comptabilité de trésorerie |
| `formatA47A-I-VIII-7.xsd` | BNC en comptabilité de trésorerie |

Les variantes BNC et BA rendent facultatifs le code et le libellé du journal ainsi que le numéro de compte, et ajoutent pour la trésorerie `DateRglt`, `ModeRglt`, `NatOp` et, pour les BNC, `IdClient`. C’est le même principe que pour [le FEC des BNC et BA en format texte](/guides/fec-bnc-ba-tresorerie/).

## L’arborescence

Là où le format texte répète le journal et l’écriture sur chaque ligne, le XML les regroupe :

```xml
<comptabilite>
  <exercice>
    <DateCloture>2025-12-31</DateCloture>
    <journal>
      <JournalCode>VT</JournalCode>
      <JournalLib>Journal des ventes</JournalLib>
      <ecriture>
        <EcritureNum>2</EcritureNum>
        <EcritureDate>2025-01-05</EcritureDate>
        <EcritureLib>Facture prestation 01/2025</EcritureLib>
        <PieceRef>FA2025-001</PieceRef>
        <PieceDate>2025-01-05</PieceDate>
        <ValidDate>2025-01-05</ValidDate>
        <ligne>
          <CompteNum>411000</CompteNum>
          <CompteLib>Clients</CompteLib>
          <CompAuxNum>C0002</CompAuxNum>
          <CompAuxLib>STUDIO GRAPHIQUE NORD</CompAuxLib>
          <Debit>2160.00</Debit>
        </ligne>
        <ligne>
          <CompteNum>706000</CompteNum>
          <CompteLib>Prestations de services</CompteLib>
          <Credit>1800.00</Credit>
        </ligne>
        …
      </ecriture>
    </journal>
  </exercice>
</comptabilite>
```

Un fichier contient **un seul exercice**, avec sa date de clôture, puis un ou plusieurs journaux, chacun contenant ses écritures, chacune contenant **au moins deux lignes**.

## Les différences qui piègent

### Une ligne porte un débit OU un crédit

Dans le format texte, chaque ligne a toujours une colonne `Debit` et une colonne `Credit`, l’une des deux à `0,00`. Dans le XML, le schéma impose un **choix** : la ligne contient soit `<Debit>`, soit `<Credit>`, soit le couple `<Montant>` et `<Sens>`. Écrire les deux balises rend le fichier invalide.

### Les dates ont des tirets

Le format texte impose `AAAAMMJJ` (20251231). Le XML utilise le type date standard : `2025-12-31`, ou une date-heure `2025-12-31T00:00:00`. Un export qui garde le format compact du fichier texte n’est pas conforme.

### Les montants ont un point

Les montants sont de type `xs:float` : le séparateur décimal est le **point** (`2160.00`), alors que le format texte exige la virgule. C’est l’erreur la plus fréquente quand on adapte un export texte en XML.

### Le lettrage est porté par l’écriture

`EcritureLet` et `DateLet` sont des éléments de l’écriture, pas de la ligne. Dans le format texte, on peut lettrer une seule ligne d’une écriture ; en XML, le lettrage vaut pour l’écriture entière.

### Les deux orthographes du compte auxiliaire

Le schéma accepte `CompAuxNum` et `CompteAuxNum` (et de même pour le libellé), « pour conserver la compatibilité », comme l’indique un commentaire du fichier XSD. Le format texte, lui, n’admet que `CompAuxNum`.

### Le sens accepte les minuscules

`<Sens>` peut valoir `d`, `D`, `c`, `C`, `+1` ou `-1`.

## Ce qui ne change pas

Le nom du fichier (`SirenFECAAAAMMJJ`, avec l’extension `.xml`), l’obligation des à-nouveaux, la numérotation chronologique sans rupture, l’équilibre de chaque écriture : toutes les règles de fond s’appliquent à l’identique. Le schéma impose aussi qu’un numéro de compte commence par trois chiffres.

## Vérifier un FEC XML

Le [lecteur de FEC](/) accepte les deux formats. Pour un fichier XML, il contrôle la structure (racine, présence de `DateCloture`, au moins deux lignes par écriture, balises bien fermées), les dates et les montants au format XML, la cohérence entre la date de clôture du nom de fichier et celle du contenu, puis applique les mêmes contrôles de fond que pour le format texte. La balance, les journaux et l’export Excel sont identiques.
