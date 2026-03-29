/**
 * Tests pour les méthodes pures du invoiceStore (sans appel Supabase)
 */

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({ order: jest.fn().mockResolvedValue({ data: [], error: null }) })),
      insert: jest.fn().mockResolvedValue({ error: null }),
      update: jest.fn(() => ({ eq: jest.fn().mockResolvedValue({ error: null }) })),
      delete: jest.fn(() => ({ eq: jest.fn().mockResolvedValue({ error: null }) })),
    })),
  },
}));

jest.mock('../authStore', () => ({
  useAuthStore: { getState: () => ({ user: { id: 'user_1' } }) },
}));

import { useInvoiceStore } from '../invoiceStore.supabase';
import { Invoice } from '../invoiceStore.supabase';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeInvoice = (overrides: Partial<Invoice> = {}): Invoice => ({
  id: 'inv_1',
  user_id: 'user_1',
  client_id: 'client_1',
  invoice_number: 'FAC-001',
  status: 'draft',
  total_amount: 300,
  month: 3,
  year: 2025,
  generated_at: new Date('2025-03-31').getTime(),
  created_at: new Date('2025-03-31T10:00:00').getTime(),
  updated_at: new Date('2025-03-31T10:00:00').getTime(),
  ...overrides,
});

const INV_MARCH_C1 = makeInvoice({ id: 'inv_march_c1', client_id: 'client_1', invoice_number: 'FAC-001' });
const INV_APRIL_C1 = makeInvoice({
  id: 'inv_april_c1',
  client_id: 'client_1',
  invoice_number: 'FAC-002',
  month: 4,
  created_at: new Date('2025-04-30T10:00:00').getTime(),
});
const INV_MARCH_C2 = makeInvoice({
  id: 'inv_march_c2',
  client_id: 'client_2',
  invoice_number: 'FAC-003',
});

beforeEach(() => {
  useInvoiceStore.setState({
    invoices: [INV_MARCH_C1, INV_APRIL_C1, INV_MARCH_C2],
  });
});

// ── getInvoicesForClient ──────────────────────────────────────────────────────

describe('getInvoicesForClient', () => {
  it('retourne les factures du bon client', () => {
    const result = useInvoiceStore.getState().getInvoicesForClient('client_1');
    expect(result).toHaveLength(2);
    result.forEach((i) => expect(i.client_id).toBe('client_1'));
  });

  it('retourne vide si client inconnu', () => {
    const result = useInvoiceStore.getState().getInvoicesForClient('client_999');
    expect(result).toHaveLength(0);
  });

  it('retourne la facture du client 2', () => {
    const result = useInvoiceStore.getState().getInvoicesForClient('client_2');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('inv_march_c2');
  });
});

// ── getInvoicesByMonth ────────────────────────────────────────────────────────

describe('getInvoicesByMonth', () => {
  it('retourne les factures de mars 2025', () => {
    const result = useInvoiceStore.getState().getInvoicesByMonth(2025, 3);
    const ids = result.map((i) => i.id);
    expect(ids).toContain('inv_march_c1');
    expect(ids).toContain('inv_march_c2');
    expect(ids).not.toContain('inv_april_c1');
  });

  it('retourne les factures d\'avril 2025', () => {
    const result = useInvoiceStore.getState().getInvoicesByMonth(2025, 4);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('inv_april_c1');
  });

  it('retourne vide si aucune facture pour ce mois', () => {
    const result = useInvoiceStore.getState().getInvoicesByMonth(2025, 1);
    expect(result).toHaveLength(0);
  });

  it('distingue les années', () => {
    const inv2024 = makeInvoice({
      id: 'inv_2024',
      created_at: new Date('2024-03-15T10:00:00').getTime(),
    });
    useInvoiceStore.setState({ invoices: [INV_MARCH_C1, inv2024] });
    const result = useInvoiceStore.getState().getInvoicesByMonth(2025, 3);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('inv_march_c1');
  });
});

// ── getInvoiceById ────────────────────────────────────────────────────────────

describe('getInvoiceById', () => {
  it('retourne la bonne facture', () => {
    const result = useInvoiceStore.getState().getInvoiceById('inv_march_c2');
    expect(result).not.toBeNull();
    expect(result?.invoice_number).toBe('FAC-003');
  });

  it('retourne null si id inconnu', () => {
    const result = useInvoiceStore.getState().getInvoiceById('inexistant');
    expect(result).toBeNull();
  });
});

// ── Workflow statuts ──────────────────────────────────────────────────────────

describe('statuts des factures', () => {
  it('une facture créée est en statut draft', () => {
    const inv = useInvoiceStore.getState().getInvoiceById('inv_march_c1');
    expect(inv?.status).toBe('draft');
  });

  it('le statut peut être sent ou paid', () => {
    const invSent = makeInvoice({ id: 'inv_sent', status: 'sent' });
    const invPaid = makeInvoice({ id: 'inv_paid', status: 'paid' });
    useInvoiceStore.setState({ invoices: [invSent, invPaid] });
    expect(useInvoiceStore.getState().getInvoiceById('inv_sent')?.status).toBe('sent');
    expect(useInvoiceStore.getState().getInvoiceById('inv_paid')?.status).toBe('paid');
  });
});
