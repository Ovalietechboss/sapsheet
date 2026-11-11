import { describe, it, expect } from '@jest/globals';
import { nextInvoiceNumber } from '../invoiceNumbering';

const inv = (n: string) => ({ invoice_number: n });

describe('nextInvoiceNumber — série annuelle continue gap-safe', () => {
  it('démarre à 001 quand aucune facture annuelle', () => {
    expect(nextInvoiceNumber([], 2026)).toBe('2026-001');
  });

  it('incrémente à partir du max existant', () => {
    expect(nextInvoiceNumber([inv('2026-001'), inv('2026-002')], 2026)).toBe('2026-003');
  });

  it('GAP-SAFE : ne réutilise pas un numéro après suppression', () => {
    // 002 supprimée → le prochain doit être 004, PAS 003 (qui existe déjà)
    expect(nextInvoiceNumber([inv('2026-001'), inv('2026-003')], 2026)).toBe('2026-004');
  });

  it('ignore l\'ancien format mensuel YYYY-MM-NNN (préserve l\'historique)', () => {
    expect(nextInvoiceNumber([inv('2026-06-001'), inv('2026-06-002')], 2026)).toBe('2026-001');
  });

  it('respecte le startOffset (reprise facture.net)', () => {
    expect(nextInvoiceNumber([], 2026, 120)).toBe('2026-121');
    expect(nextInvoiceNumber([inv('2026-121')], 2026, 120)).toBe('2026-122');
  });

  it('isole par année', () => {
    expect(nextInvoiceNumber([inv('2025-050'), inv('2026-001')], 2026)).toBe('2026-002');
    expect(nextInvoiceNumber([inv('2025-050'), inv('2026-001')], 2025)).toBe('2025-051');
  });

  it('tolère invoice_number absent/null', () => {
    expect(nextInvoiceNumber([{ invoice_number: null }, inv('2026-001')], 2026)).toBe('2026-002');
  });

  // --- NON-REGRESSION incident 2026-11-11 ---
  // L'import de reprise (`invoiceImport.ts`) numerote `AAAA-NNN (ancien numero)`.
  // Le motif ancre sur la fin ne les voyait pas : la serie repartait a 001 et
  // `2026-002` est partie chez un client alors que `2026-002 (FAC-2026-03-PLET)`
  // existait deja au registre.
  it('RECONNAIT les numeros de reprise `AAAA-NNN (ancien numero)`', () => {
    expect(nextInvoiceNumber([inv('2026-001 (FAC-2026-01-Prats)')], 2026)).toBe('2026-002');
  });

  it('NON-REGRESSION : le registre reel de novembre 2026 repart a 022', () => {
    const registre = [
      inv('2026-001 (FAC-2026-01-Prats)'), inv('2026-002 (FAC-2026-03-PLET)'),
      inv('2026-012 (FAC-2026-04-FAVREAUX)'), inv('2026-019 (FAC-2026-05-Pradeau_)'),
      inv('2026-021 (FAC-2026-05-MASSOC)'), inv('2026-021 (2600009)'),
      inv('FAC-2026-10-LECONTE'), inv('FAC-2026-09-FAVREAUX'),
    ];
    expect(nextInvoiceNumber(registre, 2026)).toBe('2026-022');
  });

  it('ne confond PAS le format mensuel suffixe AAAA-MM-NNN', () => {
    // Les chiffres y sont suivis d'un tiret, jamais d'une espace ni de la fin.
    expect(nextInvoiceNumber([inv('2026-10-007 (ancien)')], 2026)).toBe('2026-001');
  });
});
