import { exerciseOf, isOpeningJournal, entryKey } from './checks';
import type { FecLine, ParsedFec } from './fec';

/* Vues comptables calculées à partir du FEC : balance, journaux, synthèse. */

export interface AccountBalance {
  compteNum: string;
  compteLib: string;
  debit: number;
  credit: number;
  solde: number;
  lines: number;
}

export interface JournalSummary {
  code: string;
  lib: string;
  entries: number;
  lines: number;
  debit: number;
  credit: number;
  first?: string;
  last?: string;
}

export interface Summary {
  siren?: string;
  start?: string;
  end?: string;
  lines: number;
  entries: number;
  accounts: number;
  journals: number;
  totalDebit: number;
  totalCredit: number;
  /** Produits (classe 7) − charges (classe 6), hors à-nouveaux. */
  result: number;
  revenue: number;
  expenses: number;
  firstDate?: string;
  lastDate?: string;
}

const c = (n: number) => Math.round(n * 100);

export function balance(lines: FecLine[]): AccountBalance[] {
  const m = new Map<string, { lib: string; d: number; c: number; n: number }>();
  for (const l of lines) {
    const a = m.get(l.compteNum) ?? { lib: l.compteLib, d: 0, c: 0, n: 0 };
    a.d += c(l.debit);
    a.c += c(l.credit);
    a.n++;
    m.set(l.compteNum, a);
  }
  return [...m]
    .map(([compteNum, a]) => ({ compteNum, compteLib: a.lib, debit: a.d / 100, credit: a.c / 100, solde: (a.d - a.c) / 100, lines: a.n }))
    .sort((a, b) => (a.compteNum < b.compteNum ? -1 : a.compteNum > b.compteNum ? 1 : 0));
}

export function journals(lines: FecLine[]): JournalSummary[] {
  const m = new Map<string, JournalSummary & { keys: Set<string> }>();
  for (const l of lines) {
    const j = m.get(l.journalCode) ?? { code: l.journalCode, lib: l.journalLib, entries: 0, lines: 0, debit: 0, credit: 0, keys: new Set<string>() };
    j.lines++;
    j.debit += c(l.debit);
    j.credit += c(l.credit);
    j.keys.add(entryKey(l));
    if (l.ecritureDate && (!j.first || l.ecritureDate < j.first)) j.first = l.ecritureDate;
    if (l.ecritureDate && (!j.last || l.ecritureDate > j.last)) j.last = l.ecritureDate;
    m.set(l.journalCode, j);
  }
  return [...m.values()].map(({ keys, ...j }) => ({ ...j, entries: keys.size, debit: j.debit / 100, credit: j.credit / 100 }));
}

export function summary(p: ParsedFec): Summary {
  const ex = exerciseOf(p);
  const dates = p.lines.map((l) => l.ecritureDate).filter(Boolean).sort() as string[];
  let rev = 0;
  let exp = 0;
  for (const l of p.lines) {
    if (isOpeningJournal(l.journalCode, l.journalLib)) continue;
    if (l.compteNum.startsWith('7')) rev += c(l.credit) - c(l.debit);
    else if (l.compteNum.startsWith('6')) exp += c(l.debit) - c(l.credit);
  }
  return {
    siren: p.info.siren,
    start: ex.start,
    end: ex.end,
    lines: p.lines.length,
    entries: new Set(p.lines.map(entryKey)).size,
    accounts: new Set(p.lines.map((l) => l.compteNum)).size,
    journals: new Set(p.lines.map((l) => l.journalCode)).size,
    totalDebit: p.lines.reduce((s, l) => s + c(l.debit), 0) / 100,
    totalCredit: p.lines.reduce((s, l) => s + c(l.credit), 0) / 100,
    result: (rev - exp) / 100,
    revenue: rev / 100,
    expenses: exp / 100,
    firstDate: dates[0],
    lastDate: dates[dates.length - 1],
  };
}
