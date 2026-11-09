import { mkdirSync, writeFileSync } from 'node:fs';
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { analyze, isoDate, parseAmount, parseFileName, sirenValid, toXlsx, balanceCsv, FecError } from '../src/lib';
import { SAMPLE_FILE_NAME, SAMPLE_SIREN, sampleFec } from '../src/lib/sample';
import { easterSunday } from '../src/lib/holidays';

const find = (a: ReturnType<typeof analyze>, id: string) => a.checks.find((c) => c.id === id);

describe('formats élémentaires', () => {
  it('dates AAAAMMJJ', () => {
    expect(isoDate('20251231')).toBe('2025-12-31');
    expect(isoDate('20250230')).toBeUndefined();
    expect(isoDate('31/12/2025')).toBeUndefined();
  });
  it('montants', () => {
    expect(parseAmount('1234,56')).toEqual({ value: 1234.56, problem: undefined });
    expect(parseAmount('-100,00').value).toBe(-100);
    expect(parseAmount('100,00-').value).toBe(-100);
    expect(parseAmount('0')).toEqual({ value: 0, problem: undefined });
    expect(parseAmount('1234.56')).toEqual({ value: 1234.56, problem: 'point-decimal' });
    expect(parseAmount('1 234,56')).toEqual({ value: 1234.56, problem: 'separateur-milliers' });
    expect(parseAmount('12a4').problem).toBe('montant');
    expect(parseAmount('').value).toBeUndefined();
  });
  it('nom de fichier', () => {
    expect(parseFileName('123456789FEC20251231.txt')).toMatchObject({ siren: '123456789', closingDate: '2025-12-31', conform: true });
    expect(parseFileName('export_fec_2025.csv').conform).toBe(false);
  });
  it('SIREN et Pâques', () => {
    expect(sirenValid(SAMPLE_SIREN)).toBe(true);
    expect(sirenValid('123456789')).toBe(false);
    expect(easterSunday(2025).toISOString().slice(0, 10)).toBe('2025-04-20');
    expect(easterSunday(2026).toISOString().slice(0, 10)).toBe('2026-04-05');
  });
});

describe('FEC d’exemple', () => {
  const a = analyze(sampleFec(), SAMPLE_FILE_NAME);
  it('lit la structure', () => {
    expect(a.parsed.info.separator).toBe('\t');
    expect(a.parsed.info.variant).toBe('standard');
    expect(a.parsed.info.missing).toEqual([]);
    expect(a.parsed.info.closingDate).toBe('2025-12-31');
    expect(a.summary.journals).toBe(6);
    expect(a.summary.totalDebit).toBe(a.summary.totalCredit);
  });
  it('n’a aucune erreur bloquante', () => {
    expect(a.checks.filter((c) => c.level === 'error')).toEqual([]);
  });
  it('trouve les trois anomalies volontaires', () => {
    expect(find(a, 'RUPTURES')?.level).toBe('warning');
    expect(find(a, 'RUPTURES')?.samples?.[0]).toContain('de 17 à 19');
    expect(find(a, 'CAISSE')?.level).toBe('warning');
    expect(find(a, 'DIMANCHES')?.samples?.some((s) => s.includes('16/11/2025'))).toBe(true);
    expect(find(a, 'A-NOUVEAUX')?.level).toBe('ok');
  });
  it('calcule le résultat', () => {
    // Produits : 12 factures (1800 + i*150) + vente comptoir 100 ; charges : 12×(250+90+2100) + 400 + 35
    const revenue = Array.from({ length: 12 }, (_, i) => 1800 + i * 150).reduce((s, v) => s + v, 0) + 100;
    const expenses = 12 * (250 + 90 + 2100) + 400 + 35;
    expect(a.summary.revenue).toBe(revenue);
    expect(a.summary.expenses).toBe(expenses);
    expect(a.summary.result).toBe(revenue - expenses);
  });
  it('exporte un XLSX valide', () => {
    const files = unzipSync(toXlsx(a));
    expect(Object.keys(files)).toEqual(expect.arrayContaining(['xl/worksheets/sheet1.xml', 'xl/worksheets/sheet4.xml']));
    const xml = strFromU8(files['xl/worksheets/sheet2.xml']);
    expect(xml).toContain('Banque');
    mkdirSync('tests/out', { recursive: true });
    writeFileSync('tests/out/exemple.xlsx', toXlsx(a));
    writeFileSync(`tests/out/${SAMPLE_FILE_NAME}`, sampleFec());
    expect(balanceCsv(a).split('\r\n')[0]).toBe('﻿Compte;Libellé;Débit;Crédit;Solde');
  });
});

describe('FEC défectueux', () => {
  const base = sampleFec();
  it('écriture déséquilibrée et fichier déséquilibré', () => {
    const bad = base.replace('\t0,00\t5600,00\t', '\t0,00\t5600,01\t');
    const a = analyze(bad, SAMPLE_FILE_NAME);
    expect(find(a, 'EQUILIBRE-ECRITURES')?.level).toBe('error');
    expect(find(a, 'EQUILIBRE-GLOBAL')?.level).toBe('error');
  });
  it('séparateur pipe accepté, point-virgule refusé', () => {
    expect(find(analyze(base.replace(/\t/g, '|'), SAMPLE_FILE_NAME), 'SEP')?.level).toBe('ok');
    expect(find(analyze(base.replace(/\t/g, ';'), SAMPLE_FILE_NAME), 'SEP')?.level).toBe('error');
  });
  it('dates et montants mal formatés', () => {
    const bad = base.replace('\t20250105\t706000', '\t05/01/2025\t706000').replace('15000,00', '15 000,00');
    const a = analyze(bad, SAMPLE_FILE_NAME);
    expect(find(a, 'DATES')?.count).toBe(1);
    expect(find(a, 'MILLIERS')?.count).toBe(1);
  });
  it('alias de champ CompteAuxNum signalé', () => {
    const a = analyze(base.replace('CompAuxNum', 'CompteAuxNum'), SAMPLE_FILE_NAME);
    expect(find(a, 'NOMS-CHAMPS')?.samples?.[0]).toContain('CompteAuxNum');
    expect(a.parsed.lines[2].compAuxNum).toBe('C0001');
  });
  it('variante Montant / Sens', () => {
    const lines = base.split('\r\n').filter(Boolean).map((l, i) => {
      const c = l.split('\t');
      if (i === 0) { c[11] = 'Montant'; c[12] = 'Sens'; return c.join('\t'); }
      const d = c[11], cr = c[12];
      if (d !== '0,00') { c[11] = d; c[12] = 'D'; } else { c[11] = cr; c[12] = 'C'; }
      return c.join('\t');
    });
    const a = analyze(lines.join('\r\n'), SAMPLE_FILE_NAME);
    expect(a.parsed.info.variant).toBe('montant-sens');
    expect(a.checks.filter((c) => c.level === 'error')).toEqual([]);
  });
  it('fichier sans en-tête', () => {
    expect(() => analyze('bonjour\nmonde', 'x.txt')).toThrow(FecError);
  });
  it('lit l’ISO 8859-15', () => {
    const latin = base.replace('\tCaisse\t\t\tAN2025', '\tCaisse espèces\t\t\tAN2025');
    const bytes = Uint8Array.from([...latin].map((c) => c.charCodeAt(0) & 0xff));
    const a = analyze(bytes, SAMPLE_FILE_NAME);
    expect(a.parsed.info.encoding).toBe('ISO 8859-15');
    expect(a.parsed.lines.find((l) => l.compteNum === '530000')?.compteLib).toBe('Caisse espèces');
  });
});
