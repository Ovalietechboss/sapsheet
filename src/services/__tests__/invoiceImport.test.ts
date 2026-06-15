import { describe, it, expect } from '@jest/globals';
import { consolidateInvoiceImport, findImportOverlaps, supersededByManual } from '../invoiceImport';
import type { ReconstructedInvoice } from '../invoiceHistoryReconstruction';

const dom = (clientId: string, clientName: string, month: number, date: string, amount: number): ReconstructedInvoice => ({
  clientId, clientName, month, year: 2026, oldNumber: `FAC-2026-${String(month).padStart(2, '0')}-${clientName}`,
  amount, date: new Date(date).getTime(), source: 'domitemps',
});

describe('consolidateInvoiceImport', () => {
  it('fusionne les 2 sources, trie par date, numérote AAAA-NNN (ancien n°)', () => {
    const res = consolidateInvoiceImport({
      year: 2026,
      domitemps: [dom('c1', 'Prats', 3, '2026-03-31', 200)],
      manual: [
        { oldNumber: 'F-2026-001', date: new Date('2026-02-10').getTime(), clientId: 'c9', clientName: 'Durand', amount: 150, paid: true },
      ],
    });
    expect(res.map((r) => r.newNumber)).toEqual([
      '2026-001 (F-2026-001)',   // février d'abord
      '2026-002 (FAC-2026-03-Prats)',
    ]);
    expect(res[0].status).toBe('paid');   // facture.net payée
    expect(res[1].status).toBe('sent');   // DomiTemps reconstruit
    expect(res[0].month).toBe(2);
  });

  it('respecte startSeq (reprise au-delà d\'un n°)', () => {
    const res = consolidateInvoiceImport({
      year: 2026, startSeq: 5,
      domitemps: [dom('c1', 'Prats', 3, '2026-03-31', 200)],
      manual: [],
    });
    expect(res[0].newNumber).toBe('2026-005 (FAC-2026-03-Prats)');
  });

  it('facture.net prioritaire : dédoublonne (client×mois), DomiTemps écartée', () => {
    const domPrats = dom('c1', 'Prats', 3, '2026-03-31', 200);
    const manualPrats = { oldNumber: 'F-9', date: new Date('2026-03-15').getTime(), clientId: 'c1', clientName: 'Prats', amount: 50, paid: true };
    const consolidated = consolidateInvoiceImport({ year: 2026, domitemps: [domPrats], manual: [manualPrats] });
    expect(consolidated).toHaveLength(1);              // une seule (pas de doublon)
    expect(consolidated[0].source).toBe('facture.net'); // facture.net retenue
    expect(consolidated[0].amount).toBe(50);
    expect(supersededByManual([domPrats], [manualPrats])).toHaveLength(1); // DomiTemps écartée

    const warns = findImportOverlaps(consolidated, [{ client_id: 'c1', month: 3, year: 2026 }]);
    expect(warns.some((w) => w.includes('Doublon'))).toBe(false);          // recouvrement résolu
    expect(warns.some((w) => w.includes('Déjà dans Factures'))).toBe(true); // mais déjà en base = alerte
  });
});
