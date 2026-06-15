import { describe, it, expect } from '@jest/globals';
import { buildAttestationData, generateAttestationHtml } from '../attestationFiscale';

const user = {
  display_name: 'Cathy D.',
  business_name: 'Cathy Services à domicile',
  business_address: '1 rue des Pyrénées, 65000 Tarbes',
  address: 'perso',
  siren: '123456789',
  siret: '12345678900012',
};
const client = { titre: 'Mme', first_name: 'Nicole', name: 'Martin', address: '2 place de Verdun, 65000 Tarbes' };

// timestamps
const d2026a = new Date('2026-03-10').getTime();
const d2026b = new Date('2026-01-05').getTime();
const d2025 = new Date('2025-12-20').getTime();

const ts = (client_id: string, date: number, duration: number) => ({ client_id, date_arrival: date, duration });
const inv = (client_id: string, year: number, status: 'draft' | 'sent' | 'paid', total_amount: number) =>
  ({ client_id, year, status, total_amount });

const base = {
  user, client, clientId: 'c1', year: 2026,
  sapDeclarationNumber: 'SAP/2024/12345',
};

describe('buildAttestationData (S8 — art. D7233-4)', () => {
  it('montant acquitté = somme des factures PAYÉES du client sur l\'année', () => {
    const d = buildAttestationData({
      ...base,
      timesheets: [],
      invoices: [
        inv('c1', 2026, 'paid', 500),
        inv('c1', 2026, 'paid', 300),
        inv('c1', 2026, 'sent', 200),   // non payée → exclue
        inv('c1', 2026, 'draft', 100),  // brouillon → exclu
        inv('c2', 2026, 'paid', 999),   // autre client → exclu
        inv('c1', 2025, 'paid', 999),   // autre année → exclu
      ],
    });
    expect(d.montantAcquitte).toBe(800);
  });

  it('interventions = pointages du client sur l\'année, triés, total heures', () => {
    const d = buildAttestationData({
      ...base,
      invoices: [],
      timesheets: [
        ts('c1', d2026a, 3),
        ts('c1', d2026b, 2),
        ts('c1', d2025, 5),   // autre année → exclu
        ts('c2', d2026a, 9),  // autre client → exclu
      ],
    });
    expect(d.interventions.map((i) => i.durationHours)).toEqual([2, 3]); // trié par date (janv avant mars)
    expect(d.totalHours).toBe(5);
  });

  it('compose bénéficiaire + organisme', () => {
    const d = buildAttestationData({ ...base, timesheets: [], invoices: [] });
    expect(d.beneficiary.name).toBe('Mme Nicole Martin');
    expect(d.org.name).toBe('Cathy Services à domicile');
    expect(d.org.address).toContain('Tarbes');
    expect(d.sapDeclarationNumber).toBe('SAP/2024/12345');
  });

  it('HTML contient les mentions clés (293... non, mais D7233-4, CESU préfinancé, montant)', () => {
    const d = buildAttestationData({
      ...base, timesheets: [ts('c1', d2026a, 4)], invoices: [inv('c1', 2026, 'paid', 600)],
    });
    const html = generateAttestationHtml(d);
    expect(html).toContain('D.7233-4');
    expect(html).toContain('199 sexdecies');
    expect(html).toContain('CESU préfinancé');
    expect(html).toContain('600');
  });
});
