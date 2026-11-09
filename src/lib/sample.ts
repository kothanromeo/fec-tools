import { STANDARD_FIELDS } from './fec';

/*
 * FEC d'exemple fictif : petite entreprise de services, exercice 2025.
 * Il contient volontairement trois anomalies pour montrer les contrôles :
 * une rupture de numérotation, une écriture un dimanche et une caisse qui passe en négatif.
 */

/** Complète 8 chiffres avec la clé de Luhn pour obtenir un SIREN valide. */
export function withLuhn(base8: string): string {
  for (let k = 0; k <= 9; k++) {
    const s = base8 + k;
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      let d = Number(s[8 - i]);
      if (i % 2 === 1) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      sum += d;
    }
    if (sum % 10 === 0) return s;
  }
  return base8 + '0';
}

export const SAMPLE_SIREN = withLuhn('12345678');
export const SAMPLE_FILE_NAME = `${SAMPLE_SIREN}FEC20251231.txt`;

type L = [compte: string, lib: string, aux: string, auxLib: string, debit: number, credit: number, lettre?: string];

interface Entry {
  journal: [string, string];
  date: string; // AAAAMMJJ
  piece: string;
  lib: string;
  lines: L[];
}

const J = {
  AN: ['AN', 'A nouveaux'] as [string, string],
  VT: ['VT', 'Journal des ventes'] as [string, string],
  HA: ['HA', 'Journal des achats'] as [string, string],
  BQ: ['BQ', 'Banque'] as [string, string],
  CA: ['CA', 'Caisse'] as [string, string],
  OD: ['OD', 'Operations diverses'] as [string, string],
};

const amt = (n: number) => (n === 0 ? '0,00' : n.toFixed(2).replace('.', ','));

export function sampleFec(): string {
  const entries: Entry[] = [
    {
      journal: J.AN, date: '20250101', piece: 'AN2025', lib: 'Reprise des soldes',
      lines: [
        ['512000', 'Banque', '', '', 15000, 0],
        ['530000', 'Caisse', '', '', 200, 0],
        ['411000', 'Clients', 'C0001', 'BOULANGERIE MARTIN', 1200, 0, 'AA'],
        ['101300', 'Capital souscrit appele verse', '', '', 0, 10000],
        ['401000', 'Fournisseurs', 'F0001', 'PAPETERIE DU CENTRE', 0, 800, 'AB'],
        ['120000', 'Resultat de l exercice (benefice)', '', '', 0, 5600],
      ],
    },
  ];
  const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
  let fa = 1;
  months.forEach((m, i) => {
    const ht = 1800 + i * 150;
    const tva = Math.round(ht * 0.2 * 100) / 100;
    entries.push({
      journal: J.VT, date: `2025${m}05`, piece: `FA2025-${String(fa).padStart(3, '0')}`, lib: `Facture prestation ${m}/2025`,
      lines: [
        ['411000', 'Clients', 'C0002', 'STUDIO GRAPHIQUE NORD', ht + tva, 0, i < 11 ? `V${i}` : ''],
        ['706000', 'Prestations de services', '', '', 0, ht],
        ['445710', 'TVA collectee', '', '', 0, tva],
      ],
    });
    entries.push({
      journal: J.BQ, date: `2025${m}25`, piece: `REL${m}`, lib: `Reglement FA2025-${String(fa).padStart(3, '0')}`,
      lines: i < 11
        ? [
            ['512000', 'Banque', '', '', ht + tva, 0],
            ['411000', 'Clients', 'C0002', 'STUDIO GRAPHIQUE NORD', 0, ht + tva, `V${i}`],
          ]
        : [
            ['512000', 'Banque', '', '', 400, 0],
            ['411000', 'Clients', 'C0001', 'BOULANGERIE MARTIN', 0, 400],
          ],
    });
    fa++;
    entries.push({
      journal: J.HA, date: `2025${m}10`, piece: `ACH${m}`, lib: 'Fournitures et logiciels',
      lines: [
        ['606400', 'Fournitures administratives', '', '', 250, 0],
        ['651000', 'Redevances logiciels', '', '', 90, 0],
        ['445660', 'TVA deductible sur ABS', '', '', 68, 0],
        ['401000', 'Fournisseurs', 'F0001', 'PAPETERIE DU CENTRE', 0, 408],
      ],
    });
    entries.push({
      journal: J.OD, date: `2025${m}28`, piece: `PAIE${m}`, lib: `Salaires ${m}/2025`,
      lines: [
        ['641000', 'Remunerations du personnel', '', '', 2100, 0],
        ['421000', 'Personnel remunerations dues', '', '', 0, 1650],
        ['431000', 'Securite sociale', '', '', 0, 450],
      ],
    });
  });
  // Caisse : petites recettes et dépenses ; une dépense de mars fait passer la caisse en négatif.
  entries.push(
    { journal: J.CA, date: '20250214', piece: 'CA001', lib: 'Vente comptoir especes', lines: [['530000', 'Caisse', '', '', 120, 0], ['706000', 'Prestations de services', '', '', 0, 100], ['445710', 'TVA collectee', '', '', 0, 20]] },
    { journal: J.CA, date: '20250312', piece: 'CA002', lib: 'Achat materiel especes', lines: [['606300', 'Petit equipement', '', '', 400, 0], ['445660', 'TVA deductible sur ABS', '', '', 80, 0], ['530000', 'Caisse', '', '', 0, 480]] },
    { journal: J.CA, date: '20250320', piece: 'CA003', lib: 'Apport en caisse', lines: [['530000', 'Caisse', '', '', 300, 0], ['512000', 'Banque', '', '', 0, 300]] },
    // Écriture datée d'un dimanche (16 novembre 2025)
    { journal: J.OD, date: '20251116', piece: 'OD-REG', lib: 'Regularisation frais bancaires', lines: [['627000', 'Services bancaires', '', '', 35, 0], ['512000', 'Banque', '', '', 0, 35]] },
  );

  entries.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1));
  // Les à-nouveaux restent en tête
  entries.sort((a, b) => (a.journal[0] === 'AN' ? -1 : b.journal[0] === 'AN' ? 1 : 0));

  const out = [STANDARD_FIELDS.join('\t')];
  let num = 1;
  for (const e of entries) {
    if (num === 18) num++; // rupture volontaire de numérotation
    for (const [compte, lib, aux, auxLib, d, c, lettre] of e.lines) {
      out.push(
        [
          e.journal[0], e.journal[1], String(num), e.date, compte, lib, aux, auxLib, e.piece, e.date, e.lib,
          amt(Math.round(d * 100) / 100), amt(Math.round(c * 100) / 100), lettre ?? '', lettre ? '20251231' : '', e.date, '', '',
        ].join('\t'),
      );
    }
    num++;
  }
  return out.join('\r\n') + '\r\n';
}
