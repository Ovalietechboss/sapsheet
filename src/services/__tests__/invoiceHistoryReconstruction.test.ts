import { describe, it, expect } from '@jest/globals';
import { reconstructDomiTempsInvoiceHistory } from '../invoiceHistoryReconstruction';

const period = (id: string, month: number, year: number) => ({ id, month, year });
const pc = (period_id: string, client_id: string, status: 'pending' | 'generated' | 'sent' | 'error', doc_generated_at?: number) =>
  ({ period_id, client_id, status, doc_generated_at });
const client = (id: string, name: string, hourly_rate: number, facturation_mode: 'CESU' | 'CLASSICAL') =>
  ({ id, name, hourly_rate, facturation_mode });
const ts = (client_id: string, date: string, duration: number, extra: Partial<{ frais_repas: number; frais_transport: number; frais_autres: number; ik_amount: number }> = {}) =>
  ({ client_id, date_arrival: new Date(date).getTime(), duration, frais_repas: 0, frais_transport: 0, frais_autres: 0, ik_amount: 0, ...extra });

describe('reconstructDomiTempsInvoiceHistory', () => {
  const base = {
    periods: [period('p3', 3, 2026), period('p4', 4, 2026)],
    clients: [client('c1', 'Mme Dupont', 20, 'CLASSICAL'), client('c2', 'M. Cesu', 18, 'CESU')],
  };

  it('reconstruit une facture classique : montant (heures×taux + frais) + ancien n° FAC-AAAA-MM-tag', () => {
    const res = reconstructDomiTempsInvoiceHistory({
      ...base,
      periodClients: [pc('p3', 'c1', 'generated', new Date('2026-03-31').getTime())],
      timesheets: [
        ts('c1', '2026-03-05', 2, { frais_repas: 5 }),  // 2*20=40 +5
        ts('c1', '2026-03-12', 3, { ik_amount: 4 }),     // 3*20=60 +4
        ts('c1', '2026-02-10', 9),                       // autre mois → ignoré
      ],
    });
    expect(res).toHaveLength(1);
    expect(res[0].amount).toBe(109); // 40+60 + 5+4
    expect(res[0].oldNumber).toBe('FAC-2026-03-Mme_Dupont');
    expect(res[0].month).toBe(3);
  });

  it('exclut les clients CESU (= pointage, pas facture)', () => {
    const res = reconstructDomiTempsInvoiceHistory({
      ...base,
      periodClients: [pc('p3', 'c2', 'generated', 1)],
      timesheets: [ts('c2', '2026-03-05', 5)],
    });
    expect(res).toHaveLength(0);
  });

  it('ignore les statuts pending/error', () => {
    const res = reconstructDomiTempsInvoiceHistory({
      ...base,
      periodClients: [pc('p3', 'c1', 'pending'), pc('p4', 'c1', 'error')],
      timesheets: [ts('c1', '2026-03-05', 5)],
    });
    expect(res).toHaveLength(0);
  });

  it('exclut le mois courant et le futur via `before` (ex. juin écarté)', () => {
    const res = reconstructDomiTempsInvoiceHistory({
      ...base,
      periodClients: [
        pc('p3', 'c1', 'generated', new Date('2026-03-31').getTime()),
        pc('p6', 'c1', 'generated', new Date('2026-06-10').getTime()),
      ],
      periods: [period('p3', 3, 2026), period('p6', 6, 2026)],
      timesheets: [ts('c1', '2026-03-05', 1), ts('c1', '2026-06-05', 1)],
      before: { month: 6, year: 2026 },
    });
    expect(res.map((r) => r.month)).toEqual([3]); // juin (mois courant) exclu
  });

  it('trie par date', () => {
    const res = reconstructDomiTempsInvoiceHistory({
      ...base,
      periodClients: [
        pc('p4', 'c1', 'sent', new Date('2026-04-30').getTime()),
        pc('p3', 'c1', 'sent', new Date('2026-03-31').getTime()),
      ],
      timesheets: [ts('c1', '2026-03-05', 1), ts('c1', '2026-04-05', 1)],
    });
    expect(res.map((r) => r.month)).toEqual([3, 4]);
  });
});
