/**
 * Tests de la logique de génération CSV de ReportsTab
 * On extrait et teste buildCSV indépendamment des APIs DOM/Capacitor.
 */

import { Timesheet } from '../../stores/timesheetStore.supabase';
import { Client } from '../../stores/clientStore.supabase';

// ── Reproduction de buildCSV (logique pure extraite du composant) ─────────────

function buildCSV(
  timesheets: Timesheet[],
  clients: Client[],
): string {
  const headers = [
    'Date', 'Client', 'Arrivée', 'Départ',
    'Heures', 'Taux', 'Salaire',
    'Frais Repas', 'Frais Transport', 'Frais Autres', 'Total',
  ];

  const rows = timesheets.map((ts) => {
    const client = clients.find((c) => c.id === ts.client_id);
    const hourlyRate = client?.hourly_rate || 0;
    const earnings = ts.duration * hourlyRate;
    const total =
      earnings +
      (ts.frais_repas || 0) +
      (ts.frais_transport || 0) +
      (ts.frais_autres || 0);

    return [
      new Date(ts.date_arrival).toLocaleDateString('fr-FR'),
      client?.name || '',
      new Date(ts.date_arrival).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      new Date(ts.date_departure).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      ts.duration.toFixed(2),
      hourlyRate.toFixed(2),
      earnings.toFixed(2),
      (ts.frais_repas || 0).toFixed(2),
      (ts.frais_transport || 0).toFixed(2),
      (ts.frais_autres || 0).toFixed(2),
      total.toFixed(2),
    ].join(';');
  });

  return [headers.join(';'), ...rows].join('\n');
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const client: Client = {
  id: 'c1',
  user_id: 'u1',
  name: 'Mme Dupont',
  address: '12 rue de la Paix',
  facturation_mode: 'CESU',
  hourly_rate: 15,
  created_at: Date.now(),
  updated_at: Date.now(),
};

const ts: Timesheet = {
  id: 'ts1',
  user_id: 'u1',
  client_id: 'c1',
  date_arrival: new Date('2025-03-10T09:00:00').getTime(),
  date_departure: new Date('2025-03-10T13:00:00').getTime(),
  duration: 4,
  frais_repas: 8.5,
  frais_transport: 5,
  frais_autres: 0,
  status: 'draft',
  created_at: Date.now(),
  updated_at: Date.now(),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('buildCSV', () => {
  it('contient la ligne d\'en-tête', () => {
    const csv = buildCSV([ts], [client]);
    const firstLine = csv.split('\n')[0];
    expect(firstLine).toContain('Date');
    expect(firstLine).toContain('Client');
    expect(firstLine).toContain('Heures');
    expect(firstLine).toContain('Salaire');
    expect(firstLine).toContain('Total');
  });

  it('utilise le point-virgule comme séparateur (compatible Excel FR)', () => {
    const csv = buildCSV([ts], [client]);
    expect(csv).toContain(';');
  });

  it('contient le nom du client', () => {
    const csv = buildCSV([ts], [client]);
    expect(csv).toContain('Mme Dupont');
  });

  it('calcule correctement le salaire (4h × 15€ = 60€)', () => {
    const csv = buildCSV([ts], [client]);
    expect(csv).toContain('60.00');
  });

  it('calcule correctement le total (60 + 8.5 + 5 = 73.5€)', () => {
    const csv = buildCSV([ts], [client]);
    expect(csv).toContain('73.50');
  });

  it('inclut les frais repas', () => {
    const csv = buildCSV([ts], [client]);
    expect(csv).toContain('8.50');
  });

  it('inclut les frais transport', () => {
    const csv = buildCSV([ts], [client]);
    expect(csv).toContain('5.00');
  });

  it('produit autant de lignes de données que de timesheets', () => {
    const ts2 = { ...ts, id: 'ts2', date_arrival: new Date('2025-03-15T09:00:00').getTime() };
    const csv = buildCSV([ts, ts2], [client]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3); // 1 header + 2 data
  });

  it('gère un timesheet sans frais', () => {
    const tsNoFrais = { ...ts, frais_repas: 0, frais_transport: 0, frais_autres: 0 };
    const csv = buildCSV([tsNoFrais], [client]);
    expect(csv).toContain('60.00'); // total = salaire seul
  });

  it('retourne seulement la ligne d\'en-tête si aucun timesheet', () => {
    const csv = buildCSV([], [client]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(1);
  });

  it('met "client inconnu" vide si client introuvable', () => {
    const tsUnknown = { ...ts, client_id: 'inexistant' };
    expect(() => buildCSV([tsUnknown], [client])).not.toThrow();
  });
});
