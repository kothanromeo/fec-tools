<div align="center">

# FEC Tools

**Lire et vérifier un Fichier des Écritures Comptables (FEC) dans le navigateur, sans envoyer votre comptabilité à un serveur.**

[**→ Ouvrir le lecteur**](https://fec-tools.kothanromeo.dev/) · [Guides](https://fec-tools.kothanromeo.dev/guides/) · [Signaler un problème](https://github.com/kothanromeo/fec-tools/issues)

![Tests](https://github.com/kothanromeo/fec-tools/actions/workflows/ci.yml/badge.svg)
![Licence MIT](https://img.shields.io/badge/licence-MIT-blue)

</div>

---

Toute entreprise française qui tient une comptabilité informatisée doit pouvoir remettre son **FEC** à l'administration fiscale lors d'un contrôle. Pour le vérifier, il y a le logiciel officiel Test Compta Démat (Windows, contrôle de forme uniquement) ou des services en ligne auxquels il faut confier toute sa comptabilité.

FEC Tools fait les deux types de contrôle, forme et fond, directement dans le navigateur.

## Fonctionnalités

- **Lecture** des FEC « à plat » et **XML** (schémas officiels de la DGFiP) : tabulation ou `|`, UTF-8 ou ISO 8859-15, variantes 18 champs, Montant/Sens, 21 champs (BA trésorerie) et 22 champs (BNC trésorerie).
- **Contrôles de format** selon l'article A. 47 A-1 du LPF : nom `SirenFECAAAAMMJJ` et clé du SIREN, séparateur, encodage, noms exacts des champs, dates `AAAAMMJJ`, montants (virgule, pas de séparateur de milliers), champs obligatoires, nombre de colonnes.
- **Contrôles de cohérence** : équilibre de chaque écriture et du fichier, ruptures et inversions de numérotation (globale ou par journal), dates hors exercice, validation antérieure à la comptabilisation, à-nouveaux, solde de caisse négatif, comptes hors PCG, écritures des dimanches et jours fériés, doublons.
- **Analyse** : synthèse de l'exercice et résultat calculé, balance générale, journaux, recherche dans les écritures et grand livre par compte avec solde cumulé.
- **Exports** : classeur Excel (écritures, balance, journaux, rapport de contrôle) et balance CSV.
- **Performances** : analyse dans un Web Worker ; environ 4 s pour un FEC de 300 000 lignes (40 Mo).

## Structure

```
src/lib/
├── fec.ts        Lecture du fichier (encodage, séparateur, en-tête, variantes, formats)
├── checks.ts     Contrôles de format et de cohérence
├── analysis.ts   Balance, journaux, synthèse
├── holidays.ts   Jours fériés français (Pâques par l'algorithme de Meeus)
├── xlsx.ts       Écriture XLSX (Office Open XML + fflate)
├── sample.ts     FEC d'exemple fictif, avec trois anomalies volontaires
└── index.ts      Point d'entrée et exports
src/scripts/
├── fec.worker.ts Analyse hors du fil principal
└── fec-ui.ts     Interface
```

## Développement

```bash
npm install
npm run dev     # http://localhost:4321/
npm test        # tests Vitest
npm run build   # site statique dans dist/
```

## Limites

L'outil ne remplace ni Test Compta Démat pour la conformité officielle, ni l'avis d'un expert-comptable : un FEC conforme peut contenir des écritures fiscalement contestables. Le FEC au format XML (schémas XSD de la DGFiP) est lu également.

## Contribuer

Issues et pull requests bienvenues : contrôles supplémentaires, variantes de logiciels comptables mal lues. **Ne publiez jamais un vrai FEC** : anonymisez noms, montants et numéros.

## Licence

[MIT](LICENSE) © Roméo Kothan
