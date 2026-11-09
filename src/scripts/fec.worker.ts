/// <reference lib="webworker" />
import { analyze, balanceCsv, toXlsx, type Analysis } from '../lib';
import { VARIANT_LABELS, type FecLine } from '../lib/fec';
import { SAMPLE_FILE_NAME, sampleFec } from '../lib/sample';

/*
 * Analyse du FEC hors du fil principal : un FEC de plusieurs centaines de milliers
 * de lignes ne fige pas la page. Le worker garde l'analyse en mémoire et ne renvoie
 * à la page que ce qu'elle affiche.
 */

declare const self: DedicatedWorkerGlobalScope;

let current: Analysis | undefined;

export type LineView = Pick<FecLine, 'no' | 'journalCode' | 'ecritureNum' | 'ecritureDate' | 'compteNum' | 'compteLib' | 'compAuxNum' | 'compAuxLib' | 'pieceRef' | 'ecritureLib' | 'debit' | 'credit' | 'ecritureLet'>;

export type Request =
  | { id: number; type: 'analyze'; bytes: ArrayBuffer; name: string }
  | { id: number; type: 'sample' }
  | { id: number; type: 'lines'; query: string; account: string; limit: number }
  | { id: number; type: 'export'; kind: 'xlsx' | 'balance-csv' };

const view = (l: FecLine): LineView => ({
  no: l.no, journalCode: l.journalCode, ecritureNum: l.ecritureNum, ecritureDate: l.ecritureDate, compteNum: l.compteNum,
  compteLib: l.compteLib, compAuxNum: l.compAuxNum, compAuxLib: l.compAuxLib, pieceRef: l.pieceRef, ecritureLib: l.ecritureLib,
  debit: l.debit, credit: l.credit, ecritureLet: l.ecritureLet,
});

function overview(a: Analysis) {
  return {
    name: a.parsed.info.name,
    variant: VARIANT_LABELS[a.parsed.info.variant],
    summary: a.summary,
    checks: a.checks,
    balance: a.balance,
    journals: a.journals,
    accounts: a.balance.map((b) => [b.compteNum, b.compteLib] as [string, string]),
  };
}
export type Overview = ReturnType<typeof overview>;

function lines(query: string, account: string, limit: number) {
  if (!current) return { total: 0, rows: [] as LineView[] };
  const q = query.trim().toLowerCase();
  const out: LineView[] = [];
  let total = 0;
  for (const l of current.parsed.lines) {
    if (account && !l.compteNum.startsWith(account)) continue;
    if (q && !`${l.ecritureLib} ${l.compteLib} ${l.compAuxLib} ${l.pieceRef} ${l.ecritureNum} ${l.journalCode} ${l.debit} ${l.credit}`.toLowerCase().includes(q)) continue;
    total++;
    if (out.length < limit) out.push(view(l));
  }
  return { total, rows: out };
}

self.onmessage = (e: MessageEvent<Request>) => {
  const r = e.data;
  try {
    if (r.type === 'analyze' || r.type === 'sample') {
      current = r.type === 'sample' ? analyze(sampleFec(), SAMPLE_FILE_NAME) : analyze(new Uint8Array(r.bytes), r.name);
      self.postMessage({ id: r.id, ok: true, data: { overview: overview(current), first: lines('', '', 300) } });
    } else if (r.type === 'lines') {
      self.postMessage({ id: r.id, ok: true, data: lines(r.query, r.account, r.limit) });
    } else if (r.type === 'export') {
      if (!current) throw new Error('Aucun fichier analysé.');
      const bytes = r.kind === 'xlsx' ? toXlsx(current) : new TextEncoder().encode(balanceCsv(current));
      self.postMessage({ id: r.id, ok: true, data: bytes }, [bytes.buffer]);
    }
  } catch (err) {
    self.postMessage({ id: r.id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
