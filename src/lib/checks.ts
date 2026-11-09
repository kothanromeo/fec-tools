import { VARIANT_LABELS, parseFileName, type FecLine, type ParsedFec } from './fec';
import { frenchHolidays } from './holidays';

/*
 * Contrôles d'un FEC, en deux familles :
 *  - « Format » : ce que vérifie le logiciel officiel Test Compta Démat (structure, champs, dates, montants) ;
 *  - « Contenu » : la cohérence comptable que regarde un vérificateur (équilibre, numérotation,
 *    dates hors exercice, caisse créditrice, écritures du dimanche…).
 */

export type Level = 'error' | 'warning' | 'info' | 'ok';

export interface Check {
  id: string;
  group: 'Fichier' | 'Format des données' | 'Écritures' | 'Points d’attention';
  level: Level;
  title: string;
  detail?: string;
  /** Exemples (numéros de ligne et extraits), limités pour l'affichage. */
  samples?: string[];
  count?: number;
}

const MAX_SAMPLES = 12;
const cents = (n: number) => Math.round(n * 100);
const eur = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const frd = (iso?: string) => (iso ? iso.split('-').reverse().join('/') : '—');

export function sirenValid(s: string): boolean {
  if (!/^\d{9}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let d = Number(s[8 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

/** Clé d'une écriture : journal + numéro (la numérotation peut être propre à chaque journal). */
export const entryKey = (l: FecLine) => `${l.journalCode}\u0000${l.ecritureNum}`;

export interface Exercise {
  start?: string;
  end?: string;
  /** Source de la date de clôture : nom de fichier ou dates des écritures. */
  source: 'nom de fichier' | 'écritures';
}

export function exerciseOf(p: ParsedFec): Exercise {
  const dates = p.lines.map((l) => l.ecritureDate).filter(Boolean).sort() as string[];
  const end = p.info.closingDate ?? dates[dates.length - 1];
  let start: string | undefined;
  if (end) {
    // Exercice de 12 mois par défaut, se terminant à la date de clôture.
    const [y, m, d] = end.split('-').map(Number);
    const s = new Date(Date.UTC(y - 1, m - 1, d + 1));
    start = s.toISOString().slice(0, 10);
    // Si des écritures commencent plus tard (premier exercice court), on garde la première date.
    if (dates[0] && dates[0] > start && !p.info.closingDate) start = dates[0];
  }
  return { start, end, source: p.info.closingDate ? 'nom de fichier' : 'écritures' };
}

/** Repère les journaux d'à-nouveaux (code AN, RAN, ANO… ou libellé contenant « nouveau »). */
export function isOpeningJournal(code: string, lib: string): boolean {
  return /^(R?AN[OVX]?\d*)$/i.test(code.trim()) || /nouveau|ouverture|report/i.test(lib);
}

export function runChecks(p: ParsedFec): Check[] {
  const out: Check[] = [];
  const { info, lines } = p;
  const add = (c: Check) => out.push(c);
  const sample = (list: string[]) => list.slice(0, MAX_SAMPLES);
  const ex = exerciseOf(p);

  // ---------------------------------------------------------------- Fichier
  if (info.name) {
    const n = parseFileName(info.name);
    if (n.conform) {
      add({ id: 'NOM', group: 'Fichier', level: 'ok', title: `Nom de fichier conforme : SIREN ${n.siren}, clôture au ${frd(n.closingDate)}.` });
    } else {
      add({
        id: 'NOM', group: 'Fichier', level: 'warning',
        title: 'Le nom du fichier ne respecte pas la forme SirenFECAAAAMMJJ.',
        detail: `Nom reçu : « ${info.name} ». Exemple attendu : 123456789FEC20251231.txt (SIREN, « FEC », date de clôture). Sans ce nom, la date de clôture est déduite des écritures.`,
      });
    }
    if (n.siren && !sirenValid(n.siren)) {
      add({ id: 'SIREN', group: 'Fichier', level: 'warning', title: `Le SIREN ${n.siren} du nom de fichier n’a pas une clé valide.`, detail: 'Le SIREN comporte 9 chiffres et une clé de contrôle (algorithme de Luhn). Vérifiez qu’il n’y a pas de faute de frappe.' });
    }
  }
  add({
    id: 'SEP', group: 'Fichier', level: info.separator === '\t' || info.separator === '|' ? 'ok' : 'error',
    title: info.separator === '\t' ? 'Séparateur : tabulation (conforme).' : info.separator === '|' ? 'Séparateur : « | » (conforme).' : `Séparateur « ${info.separator} » non autorisé.`,
    detail: info.separator === '\t' || info.separator === '|' ? undefined : 'L’article A. 47 A-1 n’autorise que la tabulation ou le caractère « | ». Un export CSV classique au point-virgule sera refusé.',
  });
  add({
    id: 'ENC', group: 'Fichier', level: 'ok',
    title: `Encodage : ${info.encoding}${info.bom ? ' (avec BOM)' : ''}.`,
    detail: info.encoding === 'ISO 8859-15' ? 'Le fichier n’est pas en UTF-8 valide ; il a été lu en ISO 8859-15, encodage autorisé par la norme.' : undefined,
  });
  add({ id: 'VAR', group: 'Fichier', level: 'info', title: `Structure détectée : ${VARIANT_LABELS[info.variant]}.` });
  if (info.missing.length) {
    add({ id: 'CHAMPS', group: 'Fichier', level: 'error', title: `${info.missing.length} champ(s) obligatoire(s) absent(s) de l’en-tête : ${info.missing.join(', ')}.`, detail: 'Chaque champ doit être présent, même vide (« à blanc si non utilisé »).' });
  } else {
    add({ id: 'CHAMPS', group: 'Fichier', level: 'ok', title: 'Tous les champs obligatoires sont présents dans l’en-tête.' });
  }
  if (info.renamed.length) {
    add({
      id: 'NOMS-CHAMPS', group: 'Fichier', level: 'warning',
      title: `${info.renamed.length} nom(s) de champ diffèrent de la norme.`,
      samples: info.renamed.map((r) => `« ${r.found} » au lieu de « ${r.expected} »`),
      detail: 'Les noms doivent être écrits exactement comme dans l’article A. 47 A-1 (par exemple CompAuxNum, et non CompteAuxNum).',
    });
  }
  if (info.extra.length) {
    add({ id: 'COL-SUP', group: 'Fichier', level: 'info', title: `Colonne(s) supplémentaire(s) : ${info.extra.join(', ')}.`, detail: 'Une colonne « code établissement » est admise pour les entreprises à plusieurs établissements ; les autres doivent être expliquées dans le descriptif du fichier.' });
  }
  add({ id: 'LIGNES', group: 'Fichier', level: lines.length ? 'ok' : 'error', title: lines.length ? `${lines.length.toLocaleString('fr-FR')} lignes d’écriture lues.` : 'Aucune ligne d’écriture après l’en-tête.' });

  // ---------------------------------------------------------------- Format des données
  const fc = p.formatIssueCount;
  const fmt = (problem: keyof typeof fc) => p.formatIssues.filter((i) => i.problem === problem).map((i) => `ligne ${i.line} · ${i.field} : « ${i.value} »`);
  if (fc.colonnes) add({ id: 'NB-COL', group: 'Format des données', level: 'error', title: `${fc.colonnes} ligne(s) n’ont pas le même nombre de colonnes que l’en-tête.`, samples: sample(fmt('colonnes')), count: fc.colonnes, detail: 'Cause fréquente : un séparateur (tabulation ou « | ») présent à l’intérieur d’un libellé.' });
  if (fc.date) add({ id: 'DATES', group: 'Format des données', level: 'error', title: `${fc.date} date(s) invalides ou mal formatées.`, samples: sample(fmt('date')), count: fc.date, detail: 'Format attendu : AAAAMMJJ, sans séparateur (20251231).' });
  if (fc.montant) add({ id: 'MONTANTS', group: 'Format des données', level: 'error', title: `${fc.montant} montant(s) illisible(s).`, samples: sample(fmt('montant')), count: fc.montant });
  if (fc['point-decimal']) add({ id: 'DECIMALE', group: 'Format des données', level: 'warning', title: `${fc['point-decimal']} montant(s) avec un point décimal.`, samples: sample(fmt('point-decimal')), count: fc['point-decimal'], detail: 'La norme impose la virgule comme séparateur décimal (1234,56).' });
  if (fc['separateur-milliers']) add({ id: 'MILLIERS', group: 'Format des données', level: 'warning', title: `${fc['separateur-milliers']} montant(s) avec un séparateur de milliers.`, samples: sample(fmt('separateur-milliers')), count: fc['separateur-milliers'], detail: '« Aucun séparateur de millier n’est accepté » (A. 47 A-1, XII).' });
  if (fc.sens) add({ id: 'SENS', group: 'Format des données', level: 'error', title: `${fc.sens} valeur(s) de Sens invalide(s).`, samples: sample(fmt('sens')), count: fc.sens, detail: 'Valeurs autorisées : D, C, +1 ou -1.' });
  if (!fc.colonnes && !fc.date && !fc.montant && !fc.sens) add({ id: 'FORMAT', group: 'Format des données', level: 'ok', title: 'Dates et montants au bon format.' });

  // Champs obligatoires non renseignés
  const required: [keyof FecLine, string][] = [
    ['journalCode', 'JournalCode'], ['journalLib', 'JournalLib'], ['ecritureNum', 'EcritureNum'], ['ecritureDate', 'EcritureDate'],
    ['compteNum', 'CompteNum'], ['compteLib', 'CompteLib'], ['pieceRef', 'PieceRef'], ['pieceDate', 'PieceDate'],
    ['ecritureLib', 'EcritureLib'], ['validDate', 'ValidDate'],
  ];
  const cashOnly = info.variant === 'ba-tresorerie' || info.variant === 'bnc-tresorerie';
  let emptyTotal = 0;
  for (const [key, label] of required) {
    if (cashOnly && (label === 'JournalCode' || label === 'JournalLib' || label === 'CompteNum')) continue;
    if (info.columns[label] === undefined) continue;
    const empty = lines.filter((l) => !l[key] && !l.raw[label]);
    if (empty.length) {
      emptyTotal += empty.length;
      add({ id: `VIDE-${label}`, group: 'Format des données', level: 'error', title: `${label} vide sur ${empty.length.toLocaleString('fr-FR')} ligne(s).`, samples: sample(empty.map((l) => `ligne ${l.no}`)), count: empty.length, detail: label === 'PieceRef' || label === 'PieceDate' ? 'Même sans pièce (à-nouveaux, écritures d’inventaire), une référence et une date conventionnelles doivent être indiquées.' : undefined });
    }
  }
  if (!emptyTotal) add({ id: 'VIDES', group: 'Format des données', level: 'ok', title: 'Aucun champ obligatoire vide.' });

  const letNoDate = lines.filter((l) => l.ecritureLet && !l.dateLet);
  if (letNoDate.length) add({ id: 'DATELET', group: 'Format des données', level: 'warning', title: `${letNoDate.length} ligne(s) lettrées sans date de lettrage.`, samples: sample(letNoDate.map((l) => `ligne ${l.no} · lettre ${l.ecritureLet}`)), count: letNoDate.length });
  const devise = lines.filter((l) => (l.montantDevise !== undefined && l.montantDevise !== 0) !== !!l.idevise);
  if (devise.length) add({ id: 'DEVISE', group: 'Format des données', level: 'warning', title: `${devise.length} ligne(s) avec un montant en devise sans code devise, ou l’inverse.`, samples: sample(devise.map((l) => `ligne ${l.no}`)), count: devise.length });

  // ---------------------------------------------------------------- Écritures
  const totalD = lines.reduce((s, l) => s + cents(l.debit), 0);
  const totalC = lines.reduce((s, l) => s + cents(l.credit), 0);
  add({
    id: 'EQUILIBRE-GLOBAL', group: 'Écritures', level: totalD === totalC ? 'ok' : 'error',
    title: totalD === totalC ? `Fichier équilibré : ${eur(totalD / 100)} au débit et au crédit.` : `Fichier déséquilibré : débit ${eur(totalD / 100)}, crédit ${eur(totalC / 100)}, écart ${eur((totalD - totalC) / 100)}.`,
  });

  const entries = new Map<string, FecLine[]>();
  for (const l of lines) {
    const k = entryKey(l);
    const g = entries.get(k);
    if (g) g.push(l);
    else entries.set(k, [l]);
  }
  const unbalanced: string[] = [];
  let unbalancedCount = 0;
  for (const g of entries.values()) {
    const d = g.reduce((s, l) => s + cents(l.debit), 0);
    const c = g.reduce((s, l) => s + cents(l.credit), 0);
    if (d !== c) {
      unbalancedCount++;
      if (unbalanced.length < MAX_SAMPLES) unbalanced.push(`${g[0].journalCode} n° ${g[0].ecritureNum} (ligne ${g[0].no}) : débit ${eur(d / 100)}, crédit ${eur(c / 100)}`);
    }
  }
  add({
    id: 'EQUILIBRE-ECRITURES', group: 'Écritures', level: unbalancedCount ? 'error' : 'ok',
    title: unbalancedCount ? `${unbalancedCount} écriture(s) déséquilibrée(s) sur ${entries.size.toLocaleString('fr-FR')}.` : `Les ${entries.size.toLocaleString('fr-FR')} écritures sont équilibrées.`,
    samples: unbalanced, count: unbalancedCount,
  });

  // Une écriture = une seule date
  const multiDate = [...entries.values()].filter((g) => new Set(g.map((l) => l.ecritureDate)).size > 1);
  if (multiDate.length) add({ id: 'DATE-ECRITURE', group: 'Écritures', level: 'warning', title: `${multiDate.length} écriture(s) dont les lignes n’ont pas toutes la même date.`, samples: sample(multiDate.map((g) => `${g[0].journalCode} n° ${g[0].ecritureNum} (ligne ${g[0].no})`)), count: multiDate.length });

  // Lignes à la fois au débit et au crédit / lignes à zéro
  const both = lines.filter((l) => l.debit !== 0 && l.credit !== 0);
  if (both.length) add({ id: 'DEBIT-CREDIT', group: 'Écritures', level: 'warning', title: `${both.length} ligne(s) portent un montant à la fois au débit et au crédit.`, samples: sample(both.map((l) => `ligne ${l.no}`)), count: both.length });
  const zero = lines.filter((l) => l.debit === 0 && l.credit === 0);
  if (zero.length) add({ id: 'ZERO', group: 'Écritures', level: 'info', title: `${zero.length} ligne(s) à montant nul.`, samples: sample(zero.map((l) => `ligne ${l.no} · ${l.compteNum} ${l.ecritureLib}`)), count: zero.length });

  // Numérotation : chronologique, croissante, sans rupture
  const numeric = lines.every((l) => /^\d+$/.test(l.ecritureNum));
  if (numeric && lines.length) {
    const firstOf = new Map<string, FecLine>();
    for (const l of lines) if (!firstOf.has(entryKey(l))) firstOf.set(entryKey(l), l);
    const nums = [...firstOf.values()];
    const globalUnique = new Set(nums.map((l) => l.ecritureNum)).size === nums.length;
    const scopes = globalUnique ? new Map([['', nums]]) : groupBy(nums, (l) => l.journalCode);
    const gaps: string[] = [];
    const inversions: string[] = [];
    let gapCount = 0;
    let inversionCount = 0;
    for (const [scope, list] of scopes) {
      const sorted = [...list].sort((a, b) => Number(a.ecritureNum) - Number(b.ecritureNum));
      for (let i = 1; i < sorted.length; i++) {
        const a = sorted[i - 1];
        const b = sorted[i];
        const diff = Number(b.ecritureNum) - Number(a.ecritureNum);
        if (diff > 1) {
          gapCount++;
          if (gaps.length < MAX_SAMPLES) gaps.push(`${scope ? `journal ${scope} : ` : ''}de ${a.ecritureNum} à ${b.ecritureNum} (${diff - 1} numéro(s) manquant(s))`);
        }
        if (a.ecritureDate && b.ecritureDate && b.ecritureDate < a.ecritureDate) {
          inversionCount++;
          if (inversions.length < MAX_SAMPLES) inversions.push(`${scope ? `journal ${scope} : ` : ''}n° ${b.ecritureNum} du ${frd(b.ecritureDate)} après le n° ${a.ecritureNum} du ${frd(a.ecritureDate)}`);
        }
      }
    }
    add({ id: 'NUMEROTATION', group: 'Écritures', level: 'info', title: globalUnique ? 'Numérotation des écritures continue sur tout le fichier.' : 'Numérotation des écritures propre à chaque journal.', detail: 'Les deux sont admis, à condition de l’expliquer dans le descriptif du fichier.' });
    add({ id: 'RUPTURES', group: 'Écritures', level: gapCount ? 'warning' : 'ok', title: gapCount ? `${gapCount} rupture(s) dans la numérotation.` : 'Aucune rupture de numérotation.', samples: gaps, count: gapCount, detail: gapCount ? 'La doctrine demande une numérotation « sans rupture ni inversion ». Une écriture supprimée laisse un trou qu’il faudra justifier.' : undefined });
    add({ id: 'INVERSIONS', group: 'Écritures', level: inversionCount ? 'warning' : 'ok', title: inversionCount ? `${inversionCount} inversion(s) chronologique(s) : un numéro plus grand porte une date plus ancienne.` : 'Numéros et dates sont dans le même ordre.', samples: inversions, count: inversionCount });
  } else if (lines.length) {
    add({ id: 'NUMEROTATION', group: 'Écritures', level: 'info', title: 'Numéros d’écriture alphanumériques : la continuité de la numérotation n’a pas été contrôlée.' });
  }

  // Dates hors exercice
  if (ex.start && ex.end) {
    const outside = lines.filter((l) => l.ecritureDate && (l.ecritureDate < ex.start! || l.ecritureDate > ex.end!));
    add({
      id: 'HORS-EXERCICE', group: 'Écritures', level: outside.length ? 'warning' : 'ok',
      title: outside.length ? `${outside.length} ligne(s) datée(s) hors de l’exercice ${frd(ex.start)} – ${frd(ex.end)}.` : `Toutes les écritures sont dans l’exercice ${frd(ex.start)} – ${frd(ex.end)}.`,
      detail: `Exercice déduit ${ex.source === 'nom de fichier' ? 'de la date de clôture du nom de fichier' : 'des dates des écritures'}, sur 12 mois. Un premier exercice ou un exercice décalé peut expliquer un écart.`,
      samples: sample(outside.map((l) => `ligne ${l.no} · ${frd(l.ecritureDate)} · ${l.ecritureLib}`)), count: outside.length,
    });
  }

  // Date de validation
  const validBefore = lines.filter((l) => l.validDate && l.ecritureDate && l.validDate < l.ecritureDate);
  if (validBefore.length) add({ id: 'VALIDATION', group: 'Écritures', level: 'warning', title: `${validBefore.length} ligne(s) validée(s) avant leur date de comptabilisation.`, samples: sample(validBefore.map((l) => `ligne ${l.no} · écriture ${frd(l.ecritureDate)}, validation ${frd(l.validDate)}`)), count: validBefore.length });

  // À-nouveaux
  const journals = new Map<string, string>();
  for (const l of lines) if (!journals.has(l.journalCode)) journals.set(l.journalCode, l.journalLib);
  const opening = [...journals].filter(([c, lib]) => isOpeningJournal(c, lib));
  add({
    id: 'A-NOUVEAUX', group: 'Écritures', level: opening.length ? 'ok' : 'info',
    title: opening.length ? `Journal d’à-nouveaux repéré : ${opening.map(([c, lib]) => `${c} (${lib})`).join(', ')}.` : 'Aucun journal d’à-nouveaux repéré.',
    detail: opening.length ? undefined : 'Le FEC doit contenir les écritures de reprise des soldes (à-nouveaux), sauf pour un premier exercice. Si elles existent sous un autre code journal, ignorez ce message.',
  });

  // ---------------------------------------------------------------- Points d’attention
  // Comptes hors plan comptable
  const badAccounts = uniq(lines.filter((l) => l.compteNum && !/^[1-8]\d{2}/.test(l.compteNum)).map((l) => l.compteNum));
  if (badAccounts.length) add({ id: 'PCG', group: 'Points d’attention', level: 'warning', title: `${badAccounts.length} numéro(s) de compte ne suivent pas le plan comptable général.`, samples: sample(badAccounts), count: badAccounts.length, detail: 'Un compte du PCG commence par un chiffre de 1 à 8 suivi d’au moins deux chiffres.' });

  // Libellés de compte multiples
  const libs = new Map<string, Set<string>>();
  for (const l of lines) {
    if (!l.compteNum) continue;
    const s = libs.get(l.compteNum) ?? new Set();
    s.add(l.compteLib);
    libs.set(l.compteNum, s);
  }
  const multiLib = [...libs].filter(([, s]) => s.size > 1);
  if (multiLib.length) add({ id: 'LIBELLES', group: 'Points d’attention', level: 'info', title: `${multiLib.length} compte(s) avec plusieurs libellés différents.`, samples: sample(multiLib.map(([c, s]) => `${c} : ${[...s].slice(0, 3).join(' / ')}`)), count: multiLib.length });

  // Caisse créditrice
  const cash = lines.filter((l) => l.compteNum.startsWith('53') && l.ecritureDate).sort((a, b) => (a.ecritureDate! < b.ecritureDate! ? -1 : a.ecritureDate! > b.ecritureDate! ? 1 : a.no - b.no));
  if (cash.length) {
    const byDay = new Map<string, number>();
    let bal = 0;
    for (const l of cash) {
      bal += cents(l.debit) - cents(l.credit);
      byDay.set(l.ecritureDate!, bal);
    }
    const negative = [...byDay].filter(([, b]) => b < 0);
    add({
      id: 'CAISSE', group: 'Points d’attention', level: negative.length ? 'warning' : 'ok',
      title: negative.length ? `Solde de caisse créditeur (négatif) sur ${negative.length} jour(s).` : 'Le solde de caisse n’est jamais négatif.',
      detail: negative.length ? 'Une caisse ne peut pas contenir moins de zéro euro. Un solde créditeur est un signal classique en contrôle fiscal : il laisse supposer des recettes non comptabilisées ou des écritures mal datées.' : undefined,
      samples: sample(negative.map(([d, b]) => `${frd(d)} : ${eur(b / 100)}`)), count: negative.length,
    });
  }

  // Dimanches et jours fériés
  const years = uniq(lines.map((l) => l.ecritureDate?.slice(0, 4)).filter(Boolean) as string[]).map(Number);
  const holidays = new Map<string, string>();
  for (const y of years) for (const [d, n] of frenchHolidays(y)) holidays.set(d, n);
  const dayLines = new Map<string, FecLine>();
  for (const l of lines) {
    if (!l.ecritureDate || isOpeningJournal(l.journalCode, l.journalLib)) continue;
    const dow = new Date(l.ecritureDate + 'T00:00:00Z').getUTCDay();
    if ((dow === 0 || holidays.has(l.ecritureDate)) && !dayLines.has(entryKey(l))) dayLines.set(entryKey(l), l);
  }
  if (dayLines.size) {
    add({
      id: 'DIMANCHES', group: 'Points d’attention', level: 'info',
      title: `${dayLines.size} écriture(s) datée(s) un dimanche ou un jour férié.`,
      detail: 'Ce n’est pas une anomalie en soi (commerce ouvert le dimanche, paiement en ligne…), mais c’est un tri fréquent lors d’une analyse de FEC.',
      samples: sample([...dayLines.values()].map((l) => `${frd(l.ecritureDate)}${holidays.has(l.ecritureDate!) ? ` (${holidays.get(l.ecritureDate!)})` : ' (dimanche)'} · ${l.journalCode} n° ${l.ecritureNum} · ${l.ecritureLib}`)),
      count: dayLines.size,
    });
  }

  // Doublons potentiels
  const seen = new Map<string, FecLine>();
  const dups: string[] = [];
  let dupCount = 0;
  for (const l of lines) {
    const k = [l.journalCode, l.ecritureDate, l.compteNum, l.compAuxNum, l.pieceRef, cents(l.debit), cents(l.credit), l.ecritureLib].join('|');
    const prev = seen.get(k);
    if (prev && entryKey(prev) !== entryKey(l)) {
      dupCount++;
      if (dups.length < MAX_SAMPLES) dups.push(`lignes ${prev.no} et ${l.no} · ${frd(l.ecritureDate)} · ${l.compteNum} · ${eur((l.debit || l.credit))}`);
    } else seen.set(k, l);
  }
  if (dupCount) add({ id: 'DOUBLONS', group: 'Points d’attention', level: 'info', title: `${dupCount} ligne(s) identique(s) dans des écritures différentes (doublons possibles).`, samples: dups, count: dupCount });

  return out;
}

function groupBy<T>(list: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const t of list) {
    const k = key(t);
    const g = m.get(k);
    if (g) g.push(t);
    else m.set(k, [t]);
  }
  return m;
}

function uniq<T>(list: T[]): T[] {
  return [...new Set(list)];
}

export function summarize(checks: Check[]) {
  return {
    errors: checks.filter((c) => c.level === 'error').length,
    warnings: checks.filter((c) => c.level === 'warning').length,
    ok: checks.filter((c) => c.level === 'ok').length,
  };
}
