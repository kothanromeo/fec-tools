import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/lib';
import { parseFec } from '../src/lib/fec';
import { toFecXml } from '../src/lib/fec-xml';
import { SAMPLE_FILE_NAME, SAMPLE_SIREN, sampleFec } from '../src/lib/sample';

const xmlName = `${SAMPLE_SIREN}FEC20251231.xml`;
const find = (a: ReturnType<typeof analyze>, id: string) => a.checks.find((c) => c.id === id);

describe('FEC XML', () => {
  const text = analyze(sampleFec(), SAMPLE_FILE_NAME);
  const xml = toFecXml(parseFec(sampleFec(), SAMPLE_FILE_NAME));
  mkdirSync('tests/out', { recursive: true });
  writeFileSync(`tests/out/${xmlName}`, xml);
  const a = analyze(xml, xmlName);

  it('lit le même contenu que le format texte', () => {
    expect(a.parsed.info.format).toBe('XML');
    expect(a.parsed.info.xmlClosingDate).toBe('2025-12-31');
    expect(a.parsed.lines).toHaveLength(text.parsed.lines.length);
    expect(a.summary.totalDebit).toBe(text.summary.totalDebit);
    expect(a.summary.result).toBe(text.summary.result);
    expect(a.summary.entries).toBe(text.summary.entries);
    expect(a.balance).toEqual(text.balance);
  });
  it('mêmes anomalies, structure conforme', () => {
    expect(a.checks.filter((c) => c.level === 'error')).toEqual([]);
    expect(find(a, 'XML-STRUCTURE')?.level).toBe('ok');
    expect(find(a, 'RUPTURES')?.level).toBe('warning');
    expect(find(a, 'CAISSE')?.level).toBe('warning');
    expect(find(a, 'SEP')).toBeUndefined();
  });
  it('signale une écriture à une seule ligne et une date au mauvais format', () => {
    const bad = xml
      .replace(/(<ecriture>\s*<EcritureNum>1<\/EcritureNum>[\s\S]*?<\/ValidDate>\s*<ligne>[\s\S]*?<\/ligne>)[\s\S]*?(<\/ecriture>)/, '$1\n$2')
      .replace('<EcritureDate>2025-01-05</EcritureDate>', '<EcritureDate>05/01/2025</EcritureDate>');
    const b = analyze(bad, xmlName);
    expect(find(b, 'XML-STRUCTURE')?.level).toBe('error');
    expect(find(b, 'XML-STRUCTURE')?.samples?.[0]).toContain('au moins 2');
    expect(find(b, 'DATES')?.detail).toContain('AAAA-MM-JJ');
  });
  it('Montant/Sens, virgule décimale, CompteAuxNum et entités', () => {
    const v = xml
      .replace('<Debit>15000.00</Debit>', '<Montant>15000,00</Montant><Sens>d</Sens>')
      .replace('<CompAuxNum>C0001</CompAuxNum>', '<CompteAuxNum>C0001</CompteAuxNum>')
      .replace('<JournalLib>Banque</JournalLib>', '<JournalLib>Banque &amp; caisse</JournalLib>');
    const b = analyze(v, xmlName);
    expect(find(b, 'VIRGULE-XML')?.count).toBe(1);
    expect(b.parsed.lines.find((l) => l.compAuxNum === 'C0001')).toBeTruthy();
    expect(b.journals.find((j) => j.code === 'BQ')?.lib).toBe('Banque & caisse');
    expect(b.summary.totalDebit).toBe(a.summary.totalDebit);
  });
  it('date de clôture différente du nom de fichier', () => {
    const b = analyze(xml, `${SAMPLE_SIREN}FEC20241231.xml`);
    expect(find(b, 'XML-CLOTURE')?.level).toBe('warning');
  });
  it('XML mal formé', () => {
    const b = analyze('<comptabilite><exercice><DateCloture>2025-12-31</DateCloture><journal></exercice></comptabilite>', xmlName);
    expect(find(b, 'XML-STRUCTURE')?.level).toBe('error');
  });
});
