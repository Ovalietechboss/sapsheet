/**
 * Tests pour InvoiceTemplates (generateCESUTemplate & generateClassicalTemplate)
 *
 * NOTE: InvoiceTemplates.ts référence des champs qui n'existent PAS dans
 * l'interface Invoice actuelle :
 *   - invoice.hourlyRate    → n'existe pas (Invoice a hourly_rate sur Client, pas Invoice)
 *   - invoice.totalHours    → n'existe pas
 *   - invoice.totalFrais    → n'existe pas
 *   - invoice.totalAmount   → n'existe pas (Invoice a total_amount)
 *   - client.mandataire     → n'existe pas (Client a mandataire_name/email/siren séparés)
 *
 * Ces tests documentent le comportement attendu ET révèlent les bugs.
 */

import { generateCESUTemplate, generateClassicalTemplate } from '../InvoiceTemplates';
import { Invoice } from '../../stores/invoiceStore.supabase';
import { Client } from '../../stores/clientStore.supabase';
import { Timesheet } from '../../stores/timesheetStore.supabase';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockInvoice: Invoice = {
  id: 'invoice_1',
  user_id: 'user_1',
  client_id: 'client_1',
  invoice_number: 'FAC-2025-001',
  status: 'draft',
  total_amount: 520,
  month: 3,
  year: 2025,
  generated_at: new Date('2025-03-31').getTime(),
  created_at: new Date('2025-03-31').getTime(),
  updated_at: new Date('2025-03-31').getTime(),
};

const mockClient: Client = {
  id: 'client_1',
  user_id: 'user_1',
  name: 'Mme Marie Dupont',
  address: '12 rue des Lilas, 75001 Paris',
  facturation_mode: 'CESU',
  hourly_rate: 15,
  mandataire_name: 'ADMR Paris',
  mandataire_email: 'admr@paris.fr',
  mandataire_siren: '123456789',
  created_at: Date.now(),
  updated_at: Date.now(),
};

const mockClientClassic: Client = {
  ...mockClient,
  facturation_mode: 'CLASSICAL',
  mandataire_name: undefined,
  mandataire_email: undefined,
  mandataire_siren: undefined,
};

const mockTimesheet: Timesheet = {
  id: 'ts_1',
  user_id: 'user_1',
  client_id: 'client_1',
  date_arrival: new Date('2025-03-10T09:00:00').getTime(),
  date_departure: new Date('2025-03-10T13:00:00').getTime(),
  duration: 4,
  frais_repas: 8.5,
  frais_transport: 5,
  frais_autres: 0,
  ik_km: 0,
  ik_rate: 0.603,
  ik_amount: 0,
  status: 'draft',
  created_at: Date.now(),
  updated_at: Date.now(),
};

const mockTimesheetNoFrais: Timesheet = {
  ...mockTimesheet,
  id: 'ts_2',
  frais_repas: 0,
  frais_transport: 0,
  frais_autres: 0,
  ik_km: 0,
  ik_rate: 0.603,
  ik_amount: 0,
};

const mockUser = {
  displayName: 'Sophie Bernard',
  email: 'sophie@example.com',
  address: '5 allée des Roses, 69001 Lyon',
  phone: '06 12 34 56 78',
  cesuNumber: 'CESU-987654',
  iban: 'FR76 3000 4028 3798 7654 3210 943',
  bic: 'BNPAFRPP',
};

const mockUserClassic = {
  ...mockUser,
  siren: '987654321',
  siret: '98765432100012',
  businessName: 'Sophie Bernard Services',
  businessAddress: '5 allée des Roses, 69001 Lyon',
};

// ── Tests generateCESUTemplate ────────────────────────────────────────────────

describe('generateCESUTemplate', () => {
  it('retourne une chaîne HTML non vide', () => {
    const html = generateCESUTemplate(mockInvoice, mockClient, [mockTimesheet], mockUser);
    expect(typeof html).toBe('string');
    expect(html.length).toBeGreaterThan(100);
  });

  it('contient le numéro de facture/pointage', () => {
    const html = generateCESUTemplate(mockInvoice, mockClient, [mockTimesheet], mockUser);
    expect(html).toContain('FAC-2025-001');
  });

  it('contient le badge POINTAGE CESU', () => {
    const html = generateCESUTemplate(mockInvoice, mockClient, [mockTimesheet], mockUser);
    expect(html).toContain('POINTAGE CESU');
  });

  it('contient la couleur CESU (#34C759)', () => {
    const html = generateCESUTemplate(mockInvoice, mockClient, [mockTimesheet], mockUser);
    expect(html).toContain('#34C759');
  });

  it('contient le nom du prestataire', () => {
    const html = generateCESUTemplate(mockInvoice, mockClient, [mockTimesheet], mockUser);
    expect(html).toContain('Sophie Bernard');
  });

  it('contient le numéro CESU du prestataire', () => {
    const html = generateCESUTemplate(mockInvoice, mockClient, [mockTimesheet], mockUser);
    expect(html).toContain('CESU-987654');
  });

  it('contient le nom du client', () => {
    const html = generateCESUTemplate(mockInvoice, mockClient, [mockTimesheet], mockUser);
    expect(html).toContain('Mme Marie Dupont');
  });

  it('contient l\'adresse du client', () => {
    const html = generateCESUTemplate(mockInvoice, mockClient, [mockTimesheet], mockUser);
    expect(html).toContain('12 rue des Lilas');
  });

  it('affiche la section frais annexes quand des frais existent', () => {
    const html = generateCESUTemplate(mockInvoice, mockClient, [mockTimesheet], mockUser);
    // BUG POTENTIEL: invoice.totalFrais > 0 → si totalFrais est undefined, cette section est cachée
    expect(html).toContain('Frais annexes');
  });

  it('contient les frais repas dans le détail (colonne Repas)', () => {
    const html = generateCESUTemplate(mockInvoice, mockClient, [mockTimesheet], mockUser);
    // Les frais sont affichés dans des colonnes séparées dans le nouveau tableau
    expect(html).toContain('8.50€');
  });

  it('contient les frais transport dans le détail (colonne Transport)', () => {
    const html = generateCESUTemplate(mockInvoice, mockClient, [mockTimesheet], mockUser);
    expect(html).toContain('5.00€');
  });

  it('affiche 0.00€ pour les frais annexes quand aucun frais', () => {
    // La section "Frais annexes" est toujours présente (carte récapitulative),
    // mais le total doit être 0.00€ quand aucun frais n'est saisi.
    const html = generateCESUTemplate(mockInvoice, mockClient, [mockTimesheetNoFrais], mockUser);
    expect(html).toContain('Frais annexes');
    // Le total frais dans la carte récap doit être 0.00€
    expect(html).toContain('0.00€');
  });

  it('affiche le montant total recalculé depuis les timesheets', () => {
    const html = generateCESUTemplate(mockInvoice, mockClient, [mockTimesheet], mockUser);
    // 4h × 15€ = 60€ salaire + 13.50€ frais = 73.50€
    expect(html).toContain('73.50');
  });

  it('calcule et affiche le total des heures depuis les timesheets', () => {
    const html = generateCESUTemplate(mockInvoice, mockClient, [mockTimesheet], mockUser);
    // 1 timesheet de 4h → 4.00h
    expect(html).toContain('4.00h');
  });

  it('affiche l\'IBAN dans le footer', () => {
    const html = generateCESUTemplate(mockInvoice, mockClient, [mockTimesheet], mockUser);
    expect(html).toContain('FR76 3000 4028 3798 7654 3210 943');
  });

  it('contient la mention CESU dans le footer', () => {
    const html = generateCESUTemplate(mockInvoice, mockClient, [mockTimesheet], mockUser);
    expect(html).toContain('CESU');
  });

  it('gère correctement un tableau de timesheets vide', () => {
    expect(() => {
      generateCESUTemplate(mockInvoice, mockClient, [], mockUser);
    }).not.toThrow();
  });
});

// ── Tests generateClassicalTemplate ──────────────────────────────────────────

describe('generateClassicalTemplate', () => {
  it('retourne une chaîne HTML non vide', () => {
    const html = generateClassicalTemplate(mockInvoice, mockClientClassic, [mockTimesheet], mockUserClassic);
    expect(typeof html).toBe('string');
    expect(html.length).toBeGreaterThan(100);
  });

  it('contient le mot Facture dans le titre', () => {
    const html = generateClassicalTemplate(mockInvoice, mockClientClassic, [mockTimesheet], mockUserClassic);
    expect(html).toContain('Facture');
  });

  it('contient la section Emetteur', () => {
    const html = generateClassicalTemplate(mockInvoice, mockClientClassic, [mockTimesheet], mockUserClassic);
    expect(html).toContain('metteur');
  });

  it('affiche le nom de l\'entreprise au lieu du nom complet', () => {
    const html = generateClassicalTemplate(mockInvoice, mockClientClassic, [mockTimesheet], mockUserClassic);
    expect(html).toContain('Sophie Bernard Services');
  });

  it('affiche le SIREN du prestataire', () => {
    const html = generateClassicalTemplate(mockInvoice, mockClientClassic, [mockTimesheet], mockUserClassic);
    expect(html).toContain('987654321');
  });

  it('affiche le SIRET du prestataire', () => {
    const html = generateClassicalTemplate(mockInvoice, mockClientClassic, [mockTimesheet], mockUserClassic);
    expect(html).toContain('98765432100012');
  });

  it('contient le numéro de facture', () => {
    const html = generateClassicalTemplate(mockInvoice, mockClientClassic, [mockTimesheet], mockUserClassic);
    expect(html).toContain('FAC-2025-001');
  });

  it('n\'affiche pas le numéro CESU', () => {
    const html = generateClassicalTemplate(mockInvoice, mockClientClassic, [mockTimesheet], mockUserClassic);
    expect(html).not.toContain('CESU N°');
  });

  it('affiche le montant total recalculé', () => {
    const html = generateClassicalTemplate(mockInvoice, mockClientClassic, [mockTimesheet], mockUserClassic);
    // 4h × 15€ = 60€ + 13.50€ frais = 73.50€
    expect(html).toContain('73.50');
  });

  it('affiche les conditions de paiement dans le footer', () => {
    const html = generateClassicalTemplate(mockInvoice, mockClientClassic, [mockTimesheet], mockUserClassic);
    expect(html).toContain('réception');
  });

  it('gère correctement un tableau de timesheets vide', () => {
    expect(() => {
      generateClassicalTemplate(mockInvoice, mockClientClassic, [], mockUserClassic);
    }).not.toThrow();
  });
});
