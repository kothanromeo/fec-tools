import type { Check } from '../lib/checks';
import type { LineView, Overview, Request } from './fec.worker';
import { bindThanks, thanksCard, waitCard } from './creator';

/* Interface du lecteur de FEC. Toute donnée issue du fichier passe par esc(). */

type Tab = 'synthese' | 'controles' | 'balance' | 'journaux' | 'ecritures';

const esc = (v: unknown) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const eur = (n: number | undefined) => (n === undefined ? '—' : n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const d = (iso?: string) => (iso ? iso.split('-').reverse().join('/') : '—');
const int = (n: number) => n.toLocaleString('fr-FR');

// --- Worker ----------------------------------------------------------------------------

let worker: Worker | undefined;
let seq = 0;
const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();

type NoId<T> = T extends unknown ? Omit<T, 'id'> : never;

function call<T>(req: NoId<Request>, transfer: Transferable[] = []): Promise<T> {
  if (!worker) {
    worker = new Worker(new URL('./fec.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      e.data.ok ? p.resolve(e.data.data) : p.reject(new Error(e.data.error));
    };
  }
  const id = ++seq;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker!.postMessage({ ...req, id }, transfer);
  });
}

function download(data: Uint8Array | string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// --- Rendu -----------------------------------------------------------------------------

function verdict(o: Overview): string {
  const e = o.checks.filter((c) => c.level === 'error').length;
  const w = o.checks.filter((c) => c.level === 'warning').length;
  if (e) return `<div class="banner err"><div><strong>${e} anomalie(s) bloquante(s), ${w} point(s) d’attention</strong><p>En l’état, ce FEC risque d’être jugé non conforme. Le détail et les lignes concernées sont dans l’onglet « Contrôles ».</p></div></div>`;
  if (w) return `<div class="banner warn"><div><strong>Format conforme, ${w} point(s) à vérifier</strong><p>Aucune anomalie bloquante. Quelques éléments méritent une explication avant une remise à l’administration.</p></div></div>`;
  return `<div class="banner ok"><div><strong>Aucune anomalie détectée</strong><p>Structure, format et équilibre des écritures conformes.</p></div></div>`;
}

function synthese(o: Overview): string {
  const s = o.summary;
  const card = (label: string, value: string, sub = '') => `<div class="stat"><span class="stat-label">${label}</span><strong>${value}</strong>${sub ? `<span class="stat-sub">${sub}</span>` : ''}</div>`;
  return `<div class="stats">
    ${card('Exercice', `${d(s.start)} → ${d(s.end)}`, s.siren ? `SIREN ${esc(s.siren)}` : esc(o.variant))}
    ${card('Écritures', int(s.entries), `${int(s.lines)} lignes`)}
    ${card('Journaux / comptes', `${s.journals} / ${int(s.accounts)}`)}
    ${card('Total débit = crédit', eur(s.totalDebit), s.totalDebit === s.totalCredit ? 'équilibré' : `crédit ${eur(s.totalCredit)}`)}
    ${card('Produits (classe 7)', eur(s.revenue))}
    ${card('Charges (classe 6)', eur(s.expenses))}
    ${card('Résultat calculé', eur(s.result), s.result >= 0 ? 'bénéfice' : 'perte')}
  </div>
  <p class="hint">Résultat = produits − charges hors à-nouveaux, tel qu’il ressort des écritures du fichier. ${esc(o.variant)}.</p>`;
}

const ICON: Record<Check['level'], string> = { error: '✕', warning: '!', info: 'i', ok: '✓' };

function controles(o: Overview): string {
  const groups = new Map<string, Check[]>();
  for (const c of o.checks) groups.set(c.group, [...(groups.get(c.group) ?? []), c]);
  const order: Record<Check['level'], number> = { error: 0, warning: 1, info: 2, ok: 3 };
  let html = '<p class="hint">Les contrôles « Fichier » et « Format » reprennent les exigences de l’article A. 47 A-1 du LPF. Les autres portent sur la cohérence comptable. Ce rapport ne remplace pas l’avis de votre expert-comptable.</p>';
  for (const [g, list] of groups) {
    html += `<h3 class="checks-group">${esc(g)}</h3><ul class="checks">`;
    for (const c of list.sort((a, b) => order[a.level] - order[b.level])) {
      const cls = c.level === 'ok' ? 'pass' : c.level === 'info' ? 'info' : c.level;
      const body =
        (c.detail ? `<p class="check-detail">${esc(c.detail)}</p>` : '') +
        (c.samples?.length
          ? `<details><summary>Voir ${c.count && c.count > c.samples.length ? `les ${c.samples.length} premiers sur ${int(c.count)}` : 'le détail'}</summary><ul class="samples">${c.samples.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></details>`
          : '');
      html += `<li class="${cls}"><span class="ic">${ICON[c.level]}</span><div><span>${esc(c.title)}</span>${body}</div><span class="rule">${esc(c.id)}</span></li>`;
    }
    html += '</ul>';
  }
  return html;
}

function balanceTable(o: Overview, filter = ''): string {
  const f = filter.trim().toLowerCase();
  const rows = o.balance.filter((b) => !f || b.compteNum.startsWith(f) || b.compteLib.toLowerCase().includes(f));
  const tot = rows.reduce((a, b) => [a[0] + b.debit, a[1] + b.credit], [0, 0]);
  return `<div class="table-wrap"><table><thead><tr><th>Compte</th><th>Libellé</th><th class="num">Débit</th><th class="num">Crédit</th><th class="num">Solde</th></tr></thead><tbody>
    ${rows.map((b) => `<tr><td class="mono"><a href="#" data-account="${esc(b.compteNum)}">${esc(b.compteNum)}</a></td><td>${esc(b.compteLib)}</td><td class="num">${eur(b.debit)}</td><td class="num">${eur(b.credit)}</td><td class="num ${b.solde < 0 ? 'neg' : ''}">${eur(b.solde)}</td></tr>`).join('')}
    </tbody><tfoot><tr><th colspan="2">Total (${rows.length} comptes)</th><th class="num">${eur(tot[0])}</th><th class="num">${eur(tot[1])}</th><th class="num">${eur(Math.round((tot[0] - tot[1]) * 100) / 100)}</th></tr></tfoot></table></div>`;
}

function journauxTable(o: Overview): string {
  return `<div class="table-wrap"><table><thead><tr><th>Journal</th><th>Libellé</th><th class="num">Écritures</th><th class="num">Lignes</th><th class="num">Débit</th><th class="num">Crédit</th><th>Période</th></tr></thead><tbody>
    ${o.journals.map((j) => `<tr><td class="mono">${esc(j.code)}</td><td>${esc(j.lib)}</td><td class="num">${int(j.entries)}</td><td class="num">${int(j.lines)}</td><td class="num">${eur(j.debit)}</td><td class="num">${eur(j.credit)}</td><td class="nowrap">${d(j.first)} → ${d(j.last)}</td></tr>`).join('')}
  </tbody></table></div>`;
}

function linesTable(rows: LineView[], total: number, withBalance: boolean): string {
  let run = 0;
  return `<p class="hint">${int(total)} ligne(s)${total > rows.length ? `, ${rows.length} affichées. Affinez la recherche ou exportez le fichier Excel pour tout voir.` : '.'}</p>
  <div class="table-wrap"><table class="ops"><thead><tr><th>Date</th><th>Jnl</th><th>N°</th><th>Compte</th><th>Libellé</th><th>Pièce</th><th class="num">Débit</th><th class="num">Crédit</th>${withBalance ? '<th class="num">Solde cumulé</th>' : ''}<th>Let.</th></tr></thead><tbody>
  ${rows
    .map((l) => {
      run = Math.round((run + l.debit - l.credit) * 100) / 100;
      return `<tr><td class="nowrap">${d(l.ecritureDate)}</td><td class="mono">${esc(l.journalCode)}</td><td class="mono">${esc(l.ecritureNum)}</td>
      <td class="mono" title="${esc(l.compteLib)}">${esc(l.compteNum)}${l.compAuxNum ? `<br><small>${esc(l.compAuxNum)}</small>` : ''}</td>
      <td>${esc(l.ecritureLib)}${l.compAuxLib ? `<br><small>${esc(l.compAuxLib)}</small>` : ''}</td><td>${esc(l.pieceRef)}</td>
      <td class="num">${l.debit ? eur(l.debit) : ''}</td><td class="num">${l.credit ? eur(l.credit) : ''}</td>${withBalance ? `<td class="num ${run < 0 ? 'neg' : ''}">${eur(run)}</td>` : ''}<td>${esc(l.ecritureLet)}</td></tr>`;
    })
    .join('')}</tbody></table></div>`;
}

export function render(root: HTMLElement, o: Overview, first: { total: number; rows: LineView[] }, focus: Tab) {
  const out = root.querySelector<HTMLElement>('[data-result]')!;
  const errs = o.checks.filter((c) => c.level === 'error' || c.level === 'warning').length;
  const base = (o.name ?? 'FEC').replace(/\.[^.]+$/, '');
  const tabs: [Tab, string][] = [
    ['synthese', 'Synthèse'],
    ['controles', `Contrôles${errs ? ` (${errs})` : ''}`],
    ['balance', 'Balance'],
    ['journaux', 'Journaux'],
    ['ecritures', 'Écritures'],
  ];
  out.innerHTML = `${verdict(o)}
    <div class="export-bar card"><span class="export-title">Télécharger :</span><div class="btn-row">
      <button type="button" class="btn" data-export="xlsx">Excel complet (.xlsx)</button>
      <button type="button" class="btn secondary" data-export="balance-csv">Balance (CSV)</button>
    </div></div>
    ${thanksCard('analyse')}
    <div class="tabs" role="tablist">${tabs.map(([id, l]) => `<button type="button" role="tab" aria-selected="${id === focus}" data-tab="${id}">${l}</button>`).join('')}</div>
    <div class="panel card" data-panel="synthese">${synthese(o)}</div>
    <div class="panel card" data-panel="controles">${controles(o)}</div>
    <div class="panel card" data-panel="balance"><input type="search" class="filter" placeholder="Filtrer : numéro ou libellé de compte (ex. 401, banque)" data-bal-filter aria-label="Filtrer la balance" /><div data-bal>${balanceTable(o)}</div></div>
    <div class="panel card" data-panel="journaux">${journauxTable(o)}</div>
    <div class="panel card" data-panel="ecritures">
      <div class="fields" style="margin-bottom:.8rem">
        <label>Rechercher<input type="search" data-q placeholder="Libellé, pièce, montant…" /></label>
        <label>Compte (début du numéro)<input type="search" data-acc placeholder="ex. 512 ou 401000" list="fec-accounts" /></label>
      </div>
      <datalist id="fec-accounts">${o.accounts.slice(0, 2000).map(([n, l]) => `<option value="${esc(n)}">${esc(l)}</option>`).join('')}</datalist>
      <div data-lines>${linesTable(first.rows, first.total, false)}</div>
    </div>
    <div class="btn-row" style="margin-top:1rem"><button type="button" class="btn ghost" data-reset>Analyser un autre fichier</button></div>`;
  out.hidden = false;
  bindThanks(out);

  const select = (id: Tab) => {
    out.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === id)));
    out.querySelectorAll<HTMLElement>('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== id));
  };
  select(focus);
  out.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => select(b.dataset.tab as Tab)));

  out.querySelector<HTMLInputElement>('[data-bal-filter]')!.addEventListener('input', (e) => {
    out.querySelector<HTMLElement>('[data-bal]')!.innerHTML = balanceTable(o, (e.target as HTMLInputElement).value);
  });

  const q = out.querySelector<HTMLInputElement>('[data-q]')!;
  const acc = out.querySelector<HTMLInputElement>('[data-acc]')!;
  const box = out.querySelector<HTMLElement>('[data-lines]')!;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const refresh = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const r = await call<{ total: number; rows: LineView[] }>({ type: 'lines', query: q.value, account: acc.value.trim(), limit: 500 });
      box.innerHTML = linesTable(r.rows, r.total, !!acc.value.trim());
    }, 200);
  };
  q.addEventListener('input', refresh);
  acc.addEventListener('input', refresh);
  // Clic sur un compte de la balance → grand livre du compte
  out.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLElement>('[data-account]');
    if (!a) return;
    e.preventDefault();
    acc.value = a.dataset.account!;
    q.value = '';
    select('ecritures');
    refresh();
  });

  out.querySelectorAll<HTMLButtonElement>('[data-export]').forEach((b) =>
    b.addEventListener('click', async () => {
      const kind = b.dataset.export as 'xlsx' | 'balance-csv';
      const label = b.textContent;
      b.disabled = true;
      b.textContent = 'Préparation…';
      try {
        const bytes = await call<Uint8Array>({ type: 'export', kind });
        if (kind === 'xlsx') download(bytes, `${base}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        else download(bytes, `${base}-balance.csv`, 'text/csv;charset=utf-8');
      } catch (err) {
        alert('Export impossible : ' + (err instanceof Error ? err.message : err));
      } finally {
        b.disabled = false;
        b.textContent = label;
      }
    }),
  );

  out.querySelector('[data-reset]')!.addEventListener('click', () => {
    out.hidden = true;
    out.innerHTML = '';
    root.querySelector('[data-drop]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  out.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function mountFecTool(root: HTMLElement) {
  const focus = (root.dataset.focus as Tab) ?? 'synthese';
  const drop = root.querySelector<HTMLElement>('[data-drop]')!;
  const input = root.querySelector<HTMLInputElement>('[data-file]')!;
  const out = root.querySelector<HTMLElement>('[data-result]')!;

  const run = async (job: () => Promise<{ overview: Overview; first: { total: number; rows: LineView[] } }>, label: string) => {
    const timer = setTimeout(() => {
      out.innerHTML = waitCard(label);
      out.hidden = false;
    }, 150);
    try {
      const r = await job();
      clearTimeout(timer);
      render(root, r.overview, r.first, focus);
    } catch (e) {
      clearTimeout(timer);
      out.innerHTML = `<div class="banner err"><div><strong>Lecture impossible</strong><p>${esc(e instanceof Error ? e.message : e)}</p></div></div>`;
      out.hidden = false;
    }
  };

  const handle = (file?: File) => {
    if (!file) return;
    if (file.size > 500 * 1024 * 1024) {
      out.innerHTML = '<div class="banner err"><div><strong>Fichier trop volumineux</strong><p>500 Mo maximum dans le navigateur.</p></div></div>';
      out.hidden = false;
      return;
    }
    run(async () => {
      const bytes = await file.arrayBuffer();
      return call({ type: 'analyze', bytes, name: file.name }, [bytes]);
    }, `Analyse de ${file.name} (${(file.size / 1e6).toFixed(1)} Mo)…`);
  };

  input.addEventListener('change', () => {
    handle(input.files?.[0]);
    input.value = '';
  });
  drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    drop.classList.add('over');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('over');
    handle(e.dataTransfer?.files[0]);
  });
  root.querySelector<HTMLButtonElement>('[data-sample]')!.addEventListener('click', () => run(() => call({ type: 'sample' }), 'Création d’un FEC d’exemple…'));
}
