/*
 * Lecture d'un Fichier des Écritures Comptables (FEC), format « à plat »
 * défini par l'article A. 47 A-1 du Livre des procédures fiscales :
 *  - première ligne = noms des champs ;
 *  - séparateur de zones : tabulation ou « | » ;
 *  - encodage ASCII, ISO 8859-15 ou UTF-8 ;
 *  - dates AAAAMMJJ sans séparateur ;
 *  - montants : virgule décimale, pas de séparateur de milliers, signe à gauche ou à droite.
 */

import { parseFecXml, type XmlStructureIssue } from './fec-xml';

export const STANDARD_FIELDS = [
  'JournalCode', 'JournalLib', 'EcritureNum', 'EcritureDate', 'CompteNum', 'CompteLib',
  'CompAuxNum', 'CompAuxLib', 'PieceRef', 'PieceDate', 'EcritureLib', 'Debit', 'Credit',
  'EcritureLet', 'DateLet', 'ValidDate', 'Montantdevise', 'Idevise',
] as const;

export const CASH_FIELDS = ['DateRglt', 'ModeRglt', 'NatOp', 'IdClient'] as const;

export type Variant = 'standard' | 'montant-sens' | 'ba-tresorerie' | 'bnc-tresorerie';

export const VARIANT_LABELS: Record<Variant, string> = {
  standard: 'Standard : 18 champs, débit et crédit séparés',
  'montant-sens': 'Standard : 18 champs, montant et sens',
  'ba-tresorerie': 'Bénéfices agricoles, comptabilité de trésorerie : 21 champs',
  'bnc-tresorerie': 'BNC, comptabilité de trésorerie : 22 champs',
};

export interface FecLine {
  /** Numéro de ligne dans le fichier (l'en-tête est la ligne 1). */
  no: number;
  journalCode: string;
  journalLib: string;
  ecritureNum: string;
  ecritureDate?: string; // AAAA-MM-JJ
  compteNum: string;
  compteLib: string;
  compAuxNum: string;
  compAuxLib: string;
  pieceRef: string;
  pieceDate?: string;
  ecritureLib: string;
  debit: number;
  credit: number;
  ecritureLet: string;
  dateLet?: string;
  validDate?: string;
  montantDevise?: number;
  idevise: string;
  dateRglt?: string;
  modeRglt?: string;
  natOp?: string;
  idClient?: string;
  /** Champs bruts, pour les contrôles de format. */
  raw: Record<string, string>;
}

export interface FileInfo {
  name?: string;
  /** Format du fichier : texte délimité (le plus courant) ou XML. */
  format: 'texte' | 'XML';
  /** Date de clôture lue dans le XML (élément DateCloture). */
  xmlClosingDate?: string;
  siren?: string;
  closingDate?: string;
  encoding: 'UTF-8' | 'ISO 8859-15';
  bom: boolean;
  separator: '\t' | '|' | ';' | ',';
  header: string[];
  /** Correspondance champ normalisé → index de colonne. */
  columns: Record<string, number>;
  variant: Variant;
  lineEnding: 'CRLF' | 'LF' | 'CR';
  /** Champs attendus absents de l'en-tête. */
  missing: string[];
  /** Champs de l'en-tête dont l'orthographe diffère de la norme (casse, alias). */
  renamed: { found: string; expected: string }[];
  /** Colonnes supplémentaires (ex. code établissement). */
  extra: string[];
}

export interface FormatIssue {
  line: number;
  field: string;
  value: string;
  problem: 'date' | 'montant' | 'colonnes' | 'separateur-milliers' | 'point-decimal' | 'sens' | 'virgule-xml';
}

export interface ParsedFec {
  info: FileInfo;
  lines: FecLine[];
  formatIssues: FormatIssue[];
  /** Nombre total de problèmes de format (formatIssues est tronqué pour l'affichage). */
  formatIssueCount: Record<FormatIssue['problem'], number>;
  /** Anomalies de structure propres au format XML. */
  structure?: XmlStructureIssue[];
}

export class FecError extends Error {}

const MAX_KEPT_ISSUES = 2000;

/** Nom de fichier normalisé : SirenFECAAAAMMJJ (extension et suffixe de découpage tolérés). */
export function parseFileName(name: string): { siren?: string; closingDate?: string; conform: boolean } {
  const base = name.replace(/^.*[\\/]/, '');
  const m = /^(\d{9})FEC(\d{8})(?:_[\w-]+)?(?:\.\w+)?$/i.exec(base);
  if (!m) {
    const loose = /(\d{9})\s*FEC\s*(\d{8})/i.exec(base);
    return { siren: loose?.[1], closingDate: loose ? isoDate(loose[2]) : undefined, conform: false };
  }
  return { siren: m[1], closingDate: isoDate(m[2]), conform: /^\d{9}FEC\d{8}/.test(base) };
}

/** AAAAMMJJ → AAAA-MM-JJ, ou undefined si la date est invalide. */
export function isoDate(raw: string | undefined): string | undefined {
  const s = (raw ?? '').trim();
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  if (!m) return undefined;
  const [, y, mo, d] = m;
  const t = new Date(Date.UTC(+y, +mo - 1, +d));
  return t.getUTCFullYear() === +y && t.getUTCMonth() === +mo - 1 && t.getUTCDate() === +d ? `${y}-${mo}-${d}` : undefined;
}

/**
 * Montant FEC → nombre. Renvoie aussi le défaut de format éventuel.
 * Tolère le point décimal et les séparateurs de milliers (signalés), refuse le reste.
 */
export function parseAmount(raw: string): { value?: number; problem?: FormatIssue['problem'] } {
  let s = raw.trim();
  if (s === '') return { value: undefined };
  let problem: FormatIssue['problem'] | undefined;
  let sign = 1;
  if (/^[+-]/.test(s)) {
    if (s[0] === '-') sign = -1;
    s = s.slice(1).trim();
  } else if (/[+-]$/.test(s)) {
    if (s.endsWith('-')) sign = -1;
    s = s.slice(0, -1).trim();
  }
  if (/^\d+(,\d+)?$/.test(s)) {
    // format conforme
  } else if (/^\d{1,3}([ .  ]\d{3})+(,\d+)?$/.test(s)) {
    problem = 'separateur-milliers';
    s = s.replace(/[ .  ]/g, '');
  } else if (/^\d+\.\d+$/.test(s)) {
    problem = 'point-decimal';
    s = s.replace('.', ',');
  } else if (/^\d{1,3}(,\d{3})+\.\d+$/.test(s)) {
    problem = 'separateur-milliers';
    s = s.replace(/,/g, '').replace('.', ',');
  } else {
    return { problem: 'montant' };
  }
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? { value: Math.round(sign * n * 100) / 100, problem } : { problem: 'montant' };
}

function decode(bytes: Uint8Array): { text: string; encoding: FileInfo['encoding']; bom: boolean } {
  const bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, ''), encoding: 'UTF-8', bom };
  } catch {
    return { text: new TextDecoder('iso-8859-15').decode(bytes), encoding: 'ISO 8859-15', bom: false };
  }
}

const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

/** Alias rencontrés dans les fichiers produits par certains logiciels. */
const ALIASES: Record<string, string> = {
  compteauxnum: 'CompAuxNum',
  compteauxlib: 'CompAuxLib',
  comptauxnum: 'CompAuxNum',
  comptauxlib: 'CompAuxLib',
  montantdevise: 'Montantdevise',
  idevise: 'Idevise',
  devise: 'Idevise',
};

const KNOWN = [...STANDARD_FIELDS, 'Montant', 'Sens', ...CASH_FIELDS];

export function parseFec(input: Uint8Array | string, fileName?: string): ParsedFec {
  const { text, encoding, bom } = typeof input === 'string' ? { text: input.replace(/^﻿/, ''), encoding: 'UTF-8' as const, bom: input.startsWith('﻿') } : decode(input);
  if (!text.trim()) throw new FecError('Le fichier est vide.');
  if (/^\s*</.test(text)) {
    const name = fileName ? parseFileName(fileName) : undefined;
    return parseFecXml(text.trimStart(), { name: fileName, siren: name?.siren, closingDate: name?.closingDate, encoding, bom });
  }

  const lineEnding: FileInfo['lineEnding'] = text.includes('\r\n') ? 'CRLF' : text.includes('\n') ? 'LF' : 'CR';
  const rows = text.split(/\r\n|\n|\r/);
  while (rows.length && rows[rows.length - 1].trim() === '') rows.pop();
  const headerLine = rows[0];

  const counts = { '\t': headerLine.split('\t').length, '|': headerLine.split('|').length, ';': headerLine.split(';').length, ',': headerLine.split(',').length };
  const separator = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]) as FileInfo['separator'];
  if (counts[separator] < 10) {
    throw new FecError(
      'Impossible de trouver l’en-tête du FEC. La première ligne doit contenir les noms des champs (JournalCode, JournalLib, EcritureNum…) séparés par une tabulation ou un « | ».',
    );
  }

  const header = headerLine.split(separator).map((h) => h.trim());
  const columns: Record<string, number> = {};
  const renamed: FileInfo['renamed'] = [];
  const extra: string[] = [];
  header.forEach((h, i) => {
    const n = norm(h);
    const exact = KNOWN.find((k) => k === h);
    const ci = KNOWN.find((k) => norm(k) === n);
    const alias = ALIASES[n];
    const field = exact ?? ci ?? alias;
    if (!field) {
      if (h) extra.push(h);
      return;
    }
    if (columns[field] !== undefined) return;
    columns[field] = i;
    if (!exact) renamed.push({ found: h, expected: field });
  });

  const hasMontantSens = columns.Montant !== undefined && columns.Sens !== undefined && (columns.Debit === undefined || columns.Credit === undefined);
  const variant: Variant =
    columns.IdClient !== undefined ? 'bnc-tresorerie' : columns.DateRglt !== undefined ? 'ba-tresorerie' : hasMontantSens ? 'montant-sens' : 'standard';
  const expected: string[] = STANDARD_FIELDS.flatMap((f) => (hasMontantSens && (f === 'Debit' || f === 'Credit') ? (f === 'Debit' ? ['Montant'] : ['Sens']) : [f]));
  if (variant === 'ba-tresorerie') expected.push('DateRglt', 'ModeRglt', 'NatOp');
  if (variant === 'bnc-tresorerie') expected.push('DateRglt', 'ModeRglt', 'NatOp', 'IdClient');
  const missing = expected.filter((f) => columns[f] === undefined);

  const critical = ['EcritureNum', 'CompteNum', ...(hasMontantSens ? ['Montant', 'Sens'] : ['Debit', 'Credit'])];
  const missingCritical = critical.filter((f) => columns[f] === undefined);
  if (missingCritical.length) {
    throw new FecError(`Champs indispensables absents de l’en-tête : ${missingCritical.join(', ')}. En-tête lu : ${header.slice(0, 20).join(' | ')}`);
  }

  const name = fileName ? parseFileName(fileName) : undefined;
  const formatIssues: FormatIssue[] = [];
  const formatIssueCount: ParsedFec['formatIssueCount'] = { date: 0, montant: 0, colonnes: 0, 'separateur-milliers': 0, 'point-decimal': 0, sens: 0, 'virgule-xml': 0 };
  const issue = (i: FormatIssue) => {
    formatIssueCount[i.problem]++;
    if (formatIssues.length < MAX_KEPT_ISSUES) formatIssues.push(i);
  };

  const lines: FecLine[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row.trim()) continue;
    const cells = row.split(separator);
    const no = r + 1;
    if (cells.length !== header.length) issue({ line: no, field: '—', value: `${cells.length} colonnes au lieu de ${header.length}`, problem: 'colonnes' });
    const get = (f: string) => {
      const i = columns[f];
      return i === undefined ? '' : (cells[i] ?? '').trim();
    };
    const raw: Record<string, string> = {};
    for (const f of Object.keys(columns)) raw[f] = get(f);

    const date = (f: string) => {
      const v = get(f);
      if (!v) return undefined;
      const d = isoDate(v);
      if (!d) issue({ line: no, field: f, value: v, problem: 'date' });
      return d;
    };
    const amount = (f: string) => {
      const v = get(f);
      const { value, problem } = parseAmount(v);
      if (problem) issue({ line: no, field: f, value: v, problem });
      return value;
    };

    let debit = 0;
    let credit = 0;
    if (hasMontantSens) {
      const m = amount('Montant') ?? 0;
      const sens = get('Sens').toUpperCase().replace(/\s/g, '');
      if (sens === 'D' || sens === '+1') debit = m;
      else if (sens === 'C' || sens === '-1') credit = m;
      else issue({ line: no, field: 'Sens', value: get('Sens'), problem: 'sens' });
    } else {
      debit = amount('Debit') ?? 0;
      credit = amount('Credit') ?? 0;
    }

    lines.push({
      no,
      journalCode: get('JournalCode'),
      journalLib: get('JournalLib'),
      ecritureNum: get('EcritureNum'),
      ecritureDate: date('EcritureDate'),
      compteNum: get('CompteNum'),
      compteLib: get('CompteLib'),
      compAuxNum: get('CompAuxNum'),
      compAuxLib: get('CompAuxLib'),
      pieceRef: get('PieceRef'),
      pieceDate: date('PieceDate'),
      ecritureLib: get('EcritureLib'),
      debit,
      credit,
      ecritureLet: get('EcritureLet'),
      dateLet: date('DateLet'),
      validDate: date('ValidDate'),
      montantDevise: amount('Montantdevise'),
      idevise: get('Idevise'),
      dateRglt: columns.DateRglt !== undefined ? date('DateRglt') : undefined,
      modeRglt: columns.ModeRglt !== undefined ? get('ModeRglt') : undefined,
      natOp: columns.NatOp !== undefined ? get('NatOp') : undefined,
      idClient: columns.IdClient !== undefined ? get('IdClient') : undefined,
      raw,
    });
  }

  return {
    info: {
      name: fileName,
      format: 'texte',
      siren: name?.siren,
      closingDate: name?.closingDate,
      encoding,
      bom,
      separator,
      header,
      columns,
      variant,
      lineEnding,
      missing,
      renamed,
      extra,
    },
    lines,
    formatIssues,
    formatIssueCount,
  };
}
