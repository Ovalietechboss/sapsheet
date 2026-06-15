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
});
