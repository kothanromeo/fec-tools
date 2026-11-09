import { balance, journals, summary, type AccountBalance, type JournalSummary, type Summary } from './analysis';
import { runChecks, summarize, type Check } from './checks';
import { parseFec, type FecLine, type ParsedFec } from './fec';
import { writeXlsx, type Sheet } from './xlsx';

export * from './fec';
export { runChecks, summarize, sirenValid, type Check } from './checks';
export { balance, journals, summary } from './analysis';

export interface Analysis {
  parsed: ParsedFec;
  checks: Check[];
  summary: Summary;
  balance: AccountBalance[];
  journals: JournalSummary[];
}

export function analyze(input: Uint8Array | string, fileName?: string): Analysis {
  const parsed = parseFec(input, fileName);
  return {
    parsed,
    checks: runChecks(parsed),
    summary: summary(parsed),
    balance: balance(parsed.lines),
    journals: journals(parsed.lines),
  };
}

const d = (iso?: string) => (iso ? { date: iso } : undefined);
const lvl: Record<Check['level'], string> = { error: 'Erreur', warning: 'Avertissement', info: 'Information', ok: 'Conforme' };

/** Classeur Excel : écritures, balance, journaux et rapport de contrôle. */
export function toXlsx(a: Analysis): Uint8Array {
  const cash = a.parsed.info.variant === 'ba-tresorerie' || a.parsed.info.variant === 'bnc-tresorerie';
  const lineHeader = ['Journal', 'Libellé journal', 'N° écriture', 'Date', 'Compte', 'Libellé compte', 'Compte auxiliaire', 'Libellé auxiliaire', 'Pièce', 'Date pièce', 'Libellé écriture', 'Débit', 'Crédit', 'Solde', 'Lettrage', 'Date lettrage', 'Date validation', 'Montant devise', 'Devise'];
  if (cash) lineHeader.push('Date règlement', 'Mode règlement', 'Nature opération', 'Id client');
  const lineRow = (l: FecLine) => {
    const r: Sheet['rows'][number] = [
      l.journalCode, l.journalLib, /^\d+$/.test(l.ecritureNum) ? Number(l.ecritureNum) : l.ecritureNum, d(l.ecritureDate), l.compteNum, l.compteLib,
      l.compAuxNum, l.compAuxLib, l.pieceRef, d(l.pieceDate), l.ecritureLib, l.debit, l.credit, Math.round((l.debit - l.credit) * 100) / 100,
      l.ecritureLet, d(l.dateLet), d(l.validDate), l.montantDevise, l.idevise,
    ];
    if (cash) r.push(d(l.dateRglt), l.modeRglt, l.natOp, l.idClient);
    return r;
  };
  const sheets: Sheet[] = [
    {
      name: 'Écritures',
      header: lineHeader,
      widths: [9, 22, 11, 11, 11, 30, 13, 26, 14, 11, 38, 13, 13, 13, 9, 12, 12, 13, 8, 12, 14, 14, 12],
      rows: a.parsed.lines.map(lineRow),
      amountCols: [11, 12, 13, 17],
    },
    {
      name: 'Balance',
      header: ['Compte', 'Libellé', 'Nb lignes', 'Débit', 'Crédit', 'Solde débiteur', 'Solde créditeur'],
      widths: [12, 38, 10, 15, 15, 15, 15],
      rows: a.balance.map((b) => [b.compteNum, b.compteLib, b.lines, b.debit, b.credit, b.solde > 0 ? b.solde : undefined, b.solde < 0 ? -b.solde : undefined]),
      amountCols: [3, 4, 5, 6],
    },
    {
      name: 'Journaux',
      header: ['Journal', 'Libellé', 'Écritures', 'Lignes', 'Débit', 'Crédit', 'Première date', 'Dernière date'],
      widths: [9, 30, 11, 9, 15, 15, 14, 14],
      rows: a.journals.map((j) => [j.code, j.lib, j.entries, j.lines, j.debit, j.credit, d(j.first), d(j.last)]),
      amountCols: [4, 5],
    },
    {
      name: 'Contrôles',
      header: ['Niveau', 'Catégorie', 'Contrôle', 'Détail', 'Exemples'],
      widths: [14, 20, 70, 70, 90],
      rows: a.checks.map((c) => [lvl[c.level], c.group, c.title, c.detail, c.samples?.join(' ; ')]),
    },
  ];
  return writeXlsx(sheets, a.parsed.info.name ?? 'FEC');
}

/** Balance générale au format CSV français. */
export function balanceCsv(a: Analysis): string {
  const f = (n: number) => n.toFixed(2).replace('.', ',');
  const q = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const rows = ['Compte;Libellé;Débit;Crédit;Solde'];
  for (const b of a.balance) rows.push([q(b.compteNum), q(b.compteLib), f(b.debit), f(b.credit), f(b.solde)].join(';'));
  return '﻿' + rows.join('\r\n') + '\r\n';
}
