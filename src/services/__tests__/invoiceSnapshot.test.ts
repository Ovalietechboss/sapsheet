import { buildInvoiceLines, linesTotal } from '../invoiceSnapshot';
import { Timesheet } from '../../stores/timesheetStore.supabase';

const d = (jour: number) => new Date(2026, 9, jour, 9, 0).getTime(); // octobre 2026

const ts = (jour: number, over: Partial<Timesheet> = {}): Timesheet => ({
  id: `ts_${jour}`, user_id: 'u', client_id: 'c',
  date_arrival: d(jour), date_departure: d(jour) + 7200000,
  duration: 2, frais_repas: 0, frais_transport: 0, frais_autres: 0,
  ik_km: 40, ik_rate: 0.603, ik_amount: 24.12,
  status: 'validated', created_at: 0, updated_at: 0, ...over,
});

describe('buildInvoiceLines — instantane d une facture de pointages', () => {
  it('regroupe les heures en une ligne et detaille les dates', () => {
    const lignes = buildInvoiceLines([ts(6), ts(22)], 31.5);
    const presta = lignes.find((l) => l.designation === 'Assistance à domicile')!;
    expect(presta.quantity).toBe(4);
    expect(presta.unit_price).toBe(31.5);
    expect(presta.detail).toBe('06/10: 2h00\n22/10: 2h00');
  });

  it('separe les prestations portant un libelle different', () => {
    const lignes = buildInvoiceLines(
      [ts(6), ts(8, { description: 'Accompagnement sortie' })], 31.5);
    expect(lignes.map((l) => l.designation)).toEqual(
      expect.arrayContaining(['Assistance à domicile', 'Accompagnement sortie']));
  });

  it('met les IK en UNE ligne au montant exact, pas en prix moyen', () => {
    // 24,12 + 26,53 = 50,65. Une moyenne (25,325 x 2) perdrait un centime.
    const lignes = buildInvoiceLines([ts(6), ts(22, { ik_amount: 26.53 })], 31.5);
    const ik = lignes.find((l) => l.designation === 'Indemnités Kilométriques')!;
    expect(ik.quantity).toBe(1);
    expect(ik.unit_price).toBe(50.65);
    expect(ik.detail).toBe('2 déplacements');
  });

  it('ignore une IK negative et n ajoute pas de ligne si tout est a zero', () => {
    const lignes = buildInvoiceLines([ts(6, { ik_amount: -5 })], 31.5);
    expect(lignes.find((l) => l.designation === 'Indemnités Kilométriques')).toBeUndefined();
  });

  it('regroupe repas, transport et autres en une ligne de frais annexes', () => {
    const lignes = buildInvoiceLines(
      [ts(6, { frais_repas: 8, frais_transport: 2.5, frais_autres: 1.5 })], 31.5);
    const frais = lignes.find((l) => l.designation === 'Frais annexes')!;
    expect(frais.unit_price).toBe(12);
  });
});

describe('linesTotal — le total EST la somme des lignes', () => {
  it('reproduit le total du mois de octobre 2026 du dossier reel', () => {
    // 06, 22 et 29/10 : 2 h a 31,50 et des IK de 24,12 / 26,53 / 26,53.
    const lignes = buildInvoiceLines(
      [ts(6), ts(22, { ik_amount: 26.53 }), ts(29, { ik_amount: 26.53 })], 31.5);
    expect(linesTotal(lignes)).toBe(266.18);
  });

  it('ne laisse pas deriver le total quand les heures sont fractionnaires', () => {
    const lignes = buildInvoiceLines(
      [ts(6, { duration: 1.5, ik_amount: 0 }), ts(8, { duration: 2.25, ik_amount: 0 })], 31.5);
    // 3,75 h x 31,50 = 118,125 -> 118,13 arrondi une seule fois, sur la ligne.
    expect(linesTotal(lignes)).toBe(118.13);
  });

  it('une facture sans rien a facturer ne produit aucune ligne', () => {
    expect(buildInvoiceLines([], 31.5)).toEqual([]);
    expect(linesTotal([])).toBe(0);
  });
});
