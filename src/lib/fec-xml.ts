import { isoDate, type FecLine, type FormatIssue, type ParsedFec, type Variant } from './fec';

/*
 * FEC au format XML, selon les schémas XSD publiés par la DGFiP
 * (formatA47A-I-VII-1.xsd et variantes VIII-3, VIII-5, VIII-7) :
 *
 *   <comptabilite>
 *     <exercice>
 *       <DateCloture>2025-12-31</DateCloture>
 *       <journal>
 *         <JournalCode/> <JournalLib/>
 *         <ecriture>
 *           <EcritureNum/> <EcritureDate/> <EcritureLib/> <PieceRef/> <PieceDate/>
 *           [<EcritureLet/> <DateLet/>] <ValidDate/> [<DateRglt/> <ModeRglt/> <NatOp/> <IdClient/>]
 *           <ligne> (au moins 2)
 *             <CompteNum/> <CompteLib/> [<CompAuxNum/> <CompAuxLib/>] [<Montantdevise/> <Idevise/>]
 *             <Debit/> | <Credit/> | <Montant/><Sens/>
 *
 * Différences avec le format texte : dates AAAA-MM-JJ (ou date-heure), montants au format
 * xs:float (point décimal), et une ligne porte SOIT un débit, SOIT un crédit.
 *
 * Le Web Worker n'a pas de DOMParser : on utilise un petit analyseur séquentiel, suffisant
 * pour ce XML sans attributs ni contenu mixte.
 */

export interface XmlStructureIssue {
  line: number;
  message: string;
  severity: 'error' | 'warning';
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decodeEntities = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
    e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENTITIES[e] ?? m,
  );

/** Date XML : AAAA-MM-JJ ou AAAA-MM-JJThh:mm:ss. Accepte aussi AAAAMMJJ (avec un signalement). */
function xmlDate(v: string): { value?: string; problem?: boolean } {
  const s = v.trim();
  if (!s) return {};
  const m = /^(\d{4})-(\d{2})-(\d{2})(T[\d:.]+(Z|[+-]\d{2}:\d{2})?)?$/.exec(s);
  if (m) {
    const iso = isoDate(m[1] + m[2] + m[3]);
    return iso ? { value: iso } : { problem: true };
  }
  const compact = isoDate(s);
  return compact ? { value: compact, problem: true } : { problem: true };
}

/** Montant xs:float : point décimal. La virgule est tolérée mais signalée. */
function xmlAmount(v: string): { value?: number; problem?: FormatIssue['problem'] } {
  const s = v.trim();
  if (!s) return {};
  if (/^[+-]?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(s)) return { value: Math.round(Number(s) * 100) / 100 };
  if (/^[+-]?\d+,\d+$/.test(s)) return { value: Math.round(Number(s.replace(',', '.')) * 100) / 100, problem: 'virgule-xml' };
  return { problem: 'montant' };
}

const TAG = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<!\[CDATA\[([\s\S]*?)\]\]>|<(\/?)([A-Za-z_][\w.:-]*)(\s[^>]*?)?(\/?)>|([^<]+)/g;

export function parseFecXml(text: string, base: Pick<ParsedFec['info'], 'name' | 'siren' | 'closingDate' | 'encoding' | 'bom'>): ParsedFec & { structure: XmlStructureIssue[] } {
  const structure: XmlStructureIssue[] = [];
  const formatIssues: FormatIssue[] = [];
  const formatIssueCount: ParsedFec['formatIssueCount'] = { date: 0, montant: 0, colonnes: 0, 'separateur-milliers': 0, 'point-decimal': 0, sens: 0, 'virgule-xml': 0 };
  const issue = (i: FormatIssue) => {
    formatIssueCount[i.problem]++;
    if (formatIssues.length < 2000) formatIssues.push(i);
  };

  const lines: FecLine[] = [];
  const seen = new Set<string>();
  const stack: string[] = [];
  let lineNo = 1;
  let lastIndex = 0;
  let textBuf = '';
  let dateCloture: string | undefined;
  let journal: Record<string, string> = {};
  let ecriture: Record<string, string> = {};
  let ecritureLine = 0;
  let ecritureLines = 0;
  let ligne: Record<string, string> = {};
  let ligneLine = 0;
  let rootChecked = false;

  const advance = (to: number) => {
    for (let i = lastIndex; i < to; i++) if (text.charCodeAt(i) === 10) lineNo++;
    lastIndex = to;
  };

  const date = (field: string, value: string | undefined, no: number) => {
    if (!value) return undefined;
    const d = xmlDate(value);
    if (d.problem) issue({ line: no, field, value, problem: 'date' });
    return d.value;
  };
  const amount = (field: string, value: string | undefined, no: number) => {
    if (value === undefined) return undefined;
    const a = xmlAmount(value);
    if (a.problem) issue({ line: no, field, value, problem: a.problem });
    return a.value;
  };

  const flushLigne = () => {
    const no = ligneLine;
    let debit = 0;
    let credit = 0;
    if (ligne.Montant !== undefined || ligne.Sens !== undefined) {
      const m = amount('Montant', ligne.Montant ?? '', no) ?? 0;
      const sens = (ligne.Sens ?? '').trim().toUpperCase();
      if (sens === 'D' || sens === '+1') debit = m;
      else if (sens === 'C' || sens === '-1') credit = m;
      else issue({ line: no, field: 'Sens', value: ligne.Sens ?? '', problem: 'sens' });
    } else {
      if (ligne.Debit !== undefined) debit = amount('Debit', ligne.Debit, no) ?? 0;
      if (ligne.Credit !== undefined) credit = amount('Credit', ligne.Credit, no) ?? 0;
      if (ligne.Debit === undefined && ligne.Credit === undefined) structure.push({ line: no, severity: 'error', message: 'Ligne sans Debit, Credit ni Montant/Sens.' });
    }
    const raw: Record<string, string> = { ...journal, ...ecriture, ...ligne };
    for (const k of Object.keys(raw)) seen.add(k);
    lines.push({
      no,
      journalCode: journal.JournalCode ?? '',
      journalLib: journal.JournalLib ?? '',
      ecritureNum: ecriture.EcritureNum ?? '',
      ecritureDate: date('EcritureDate', ecriture.EcritureDate, ecritureLine),
      compteNum: ligne.CompteNum ?? '',
      compteLib: ligne.CompteLib ?? '',
      compAuxNum: ligne.CompAuxNum ?? ligne.CompteAuxNum ?? '',
      compAuxLib: ligne.CompAuxLib ?? ligne.CompteAuxLib ?? '',
      pieceRef: ecriture.PieceRef ?? '',
      pieceDate: date('PieceDate', ecriture.PieceDate, ecritureLine),
      ecritureLib: ecriture.EcritureLib ?? '',
      debit,
      credit,
      ecritureLet: ecriture.EcritureLet ?? '',
      dateLet: date('DateLet', ecriture.DateLet, ecritureLine),
      validDate: date('ValidDate', ecriture.ValidDate, ecritureLine),
      montantDevise: amount('Montantdevise', ligne.Montantdevise, no),
      idevise: ligne.Idevise ?? '',
      dateRglt: ecriture.DateRglt !== undefined ? date('DateRglt', ecriture.DateRglt, ecritureLine) : undefined,
      modeRglt: ecriture.ModeRglt,
      natOp: ecriture.NatOp,
      idClient: ecriture.IdClient,
      raw,
    });
  };

  for (const m of text.matchAll(TAG)) {
    advance(m.index!);
    const [, cdata, close, rawName, , selfClose, chars] = m;
    if (chars !== undefined || cdata !== undefined) {
      textBuf += cdata ?? decodeEntities(chars!);
      continue;
    }
    if (!rawName) continue; // commentaire, déclaration
    const name = rawName.includes(':') ? rawName.split(':').pop()! : rawName;
    const parent = stack[stack.length - 1];

    if (!close) {
      if (!rootChecked) {
        rootChecked = true;
        if (name !== 'comptabilite') structure.push({ line: lineNo, severity: 'error', message: `Racine XML <${name}> : le schéma du FEC attend <comptabilite>.` });
      }
      textBuf = '';
      if (name === 'journal') journal = {};
      else if (name === 'ecriture') {
        ecriture = {};
        ecritureLine = lineNo;
        ecritureLines = 0;
      } else if (name === 'ligne') {
        ligne = {};
        ligneLine = lineNo;
      }
      if (selfClose) {
        // Élément vide <X/> : valeur vide
        if (parent === 'ligne') ligne[name] = '';
        else if (parent === 'ecriture') ecriture[name] = '';
        else if (parent === 'journal') journal[name] = '';
        continue;
      }
      stack.push(name);
      continue;
    }

    // Balise fermante
    const open = stack.pop();
    if (open !== name) {
      structure.push({ line: lineNo, severity: 'error', message: `XML mal formé : </${name}> ferme <${open ?? '?'}>.` });
      break;
    }
    const value = textBuf.trim();
    const owner = stack[stack.length - 1];
    if (name === 'ligne') {
      flushLigne();
      ecritureLines++;
    } else if (name === 'ecriture') {
      if (ecritureLines < 2) structure.push({ line: ecritureLine, severity: 'error', message: `Écriture ${ecriture.EcritureNum ?? '?'} avec ${ecritureLines} ligne(s) : le schéma en exige au moins 2.` });
    } else if (owner === 'ligne') ligne[name] = value;
    else if (owner === 'ecriture') ecriture[name] = value;
    else if (owner === 'journal') journal[name] = value;
    else if (owner === 'exercice' && name === 'DateCloture') {
      const d = xmlDate(value);
      dateCloture = d.value;
      if (d.problem) issue({ line: lineNo, field: 'DateCloture', value, problem: 'date' });
    }
    textBuf = '';
  }
  if (stack.length) structure.push({ line: lineNo, severity: 'error', message: `XML incomplet : <${stack[stack.length - 1]}> n’est jamais fermé.` });
  if (!dateCloture) structure.push({ line: 1, severity: 'error', message: 'Élément <DateCloture> absent de <exercice>.' });
  if (base.closingDate && dateCloture && base.closingDate !== dateCloture) {
    structure.push({ line: 1, severity: 'warning', message: `La date de clôture du nom de fichier (${base.closingDate}) diffère de <DateCloture> (${dateCloture}).` });
  }

  const has = (f: string) => seen.has(f);
  const variant: Variant = has('IdClient') ? 'bnc-tresorerie' : has('DateRglt') ? 'ba-tresorerie' : has('Montant') ? 'montant-sens' : 'standard';
  const columns: Record<string, number> = {};
  for (const f of ['JournalCode', 'JournalLib', 'EcritureNum', 'EcritureDate', 'CompteNum', 'CompteLib', 'PieceRef', 'PieceDate', 'EcritureLib', 'ValidDate']) columns[f] = 0;
  for (const f of seen) columns[f === 'CompteAuxNum' ? 'CompAuxNum' : f === 'CompteAuxLib' ? 'CompAuxLib' : f] = 0;

  return {
    info: {
      ...base,
      closingDate: base.closingDate ?? dateCloture,
      format: 'XML',
      xmlClosingDate: dateCloture,
      separator: '\t',
      header: [],
      columns,
      variant,
      lineEnding: 'LF',
      missing: [],
      renamed: [],
      extra: [],
    },
    lines,
    formatIssues,
    formatIssueCount,
    structure,
  };
}

/** Convertit un FEC (déjà lu) en XML conforme au schéma : utile pour les tests et l'exemple. */
export function toFecXml(p: ParsedFec): string {
  const x = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const n = (v: number) => v.toFixed(2);
  const byJournal = new Map<string, FecLine[]>();
  for (const l of p.lines) byJournal.set(l.journalCode, [...(byJournal.get(l.journalCode) ?? []), l]);
  let out = `<?xml version="1.0" encoding="UTF-8"?>\n<comptabilite>\n  <exercice>\n    <DateCloture>${p.info.closingDate ?? ''}</DateCloture>\n`;
  for (const [code, list] of byJournal) {
    out += `    <journal>\n      <JournalCode>${x(code)}</JournalCode>\n      <JournalLib>${x(list[0].journalLib)}</JournalLib>\n`;
    const entries = new Map<string, FecLine[]>();
    for (const l of list) entries.set(l.ecritureNum, [...(entries.get(l.ecritureNum) ?? []), l]);
    for (const [num, ls] of entries) {
      const e = ls[0];
      out += `      <ecriture>\n        <EcritureNum>${x(num)}</EcritureNum>\n        <EcritureDate>${e.ecritureDate ?? ''}</EcritureDate>\n        <EcritureLib>${x(e.ecritureLib)}</EcritureLib>\n        <PieceRef>${x(e.pieceRef)}</PieceRef>\n        <PieceDate>${e.pieceDate ?? ''}</PieceDate>\n`;
      const lettre = ls.find((l) => l.ecritureLet);
      if (lettre) out += `        <EcritureLet>${x(lettre.ecritureLet)}</EcritureLet>\n        <DateLet>${lettre.dateLet ?? ''}</DateLet>\n`;
      out += `        <ValidDate>${e.validDate ?? ''}</ValidDate>\n`;
      for (const l of ls) {
        out += `        <ligne>\n          <CompteNum>${x(l.compteNum)}</CompteNum>\n          <CompteLib>${x(l.compteLib)}</CompteLib>\n`;
        if (l.compAuxNum) out += `          <CompAuxNum>${x(l.compAuxNum)}</CompAuxNum>\n          <CompAuxLib>${x(l.compAuxLib)}</CompAuxLib>\n`;
        out += l.debit !== 0 || l.credit === 0 ? `          <Debit>${n(l.debit)}</Debit>\n` : `          <Credit>${n(l.credit)}</Credit>\n`;
        out += '        </ligne>\n';
      }
      out += '      </ecriture>\n';
    }
    out += '    </journal>\n';
  }
  return out + '  </exercice>\n</comptabilite>\n';
}
