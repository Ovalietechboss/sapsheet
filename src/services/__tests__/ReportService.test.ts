/**
 * Tests pour ReportService
 *
 * NOTE: ReportService.ts utilise un ancien modèle de données (dateArrival,
 * durationHours, fraisAnnexes, assistantId) qui NE CORRESPOND PAS au modèle
 * actuel de Timesheet (date_arrival, duration, frais_repas/transport/autres,
 * user_id). Ces tests révèlent ce désalignement.
 */

import { ReportService, MonthlyReport } from '../ReportService';

// ── Données de test (modèle ACTUEL du store) ──────────────────────────────────

const makeTimesheet = (overrides = {}) => ({
  id: 'ts_1',
  user_id: 'user_1',
  client_id: 'client_1',
  date_arrival: new Date('2025-03-10T09:00:00').getTime(),
  date_departure: new Date('2025-03-10T13:00:00').getTime(),
  duration: 4,
  frais_repas: 8.5,
  frais_transport: 5,
  frais_autres: 0,
  notes: '',
  status: 'draft' as const,
  created_at: Date.now(),
  updated_at: Date.now(),
  ...overrides,
});

const CLIENT_MAP = { client_1: 'Mme Dupont', client_2: 'M. Martin' };

// ── Tests generateMonthlyReport ───────────────────────────────────────────────

describe('ReportService.generateMonthlyReport', () => {
  it('retourne un rapport avec le bon mois et assistantId', () => {
    const ts = makeTimesheet();
    const report = ReportService.generateMonthlyReport('2025-03', [ts], 'user_1', CLIENT_MAP);
    expect(report.month).toBe('2025-03');
    expect(report.assistantId).toBe('user_1');
  });

  it('filtre correctement les timesheets du mois demandé', () => {
    const tsMarche = makeTimesheet({ date_arrival: new Date('2025-03-10T09:00:00').getTime() });
    const tsAutreMois = makeTimesheet({ id: 'ts_2', date_arrival: new Date('2025-04-01T09:00:00').getTime() });
    const report = ReportService.generateMonthlyReport('2025-03', [tsMarche, tsAutreMois], 'user_1', CLIENT_MAP);
    // ATTENDU: 1 timesheet filtré → 4 heures
    // BUG POTENTIEL: service filtre via ts.dateArrival.startsWith() (ancien modèle)
    // alors que le champ actuel est ts.date_arrival (BIGINT timestamp)
    expect(report.totalHoursWorked).toBe(4);
  });

  it('calcule le total des heures sur plusieurs timesheets', () => {
    const ts1 = makeTimesheet({ id: 'ts_1', duration: 3 });
    const ts2 = makeTimesheet({ id: 'ts_2', duration: 2.5 });
    const report = ReportService.generateMonthlyReport('2025-03', [ts1, ts2], 'user_1', CLIENT_MAP);
    expect(report.totalHoursWorked).toBe(5.5);
  });

  it('calcule le total des frais annexes', () => {
    const ts = makeTimesheet({ frais_repas: 8.5, frais_transport: 5, frais_autres: 2 });
    const report = ReportService.generateMonthlyReport('2025-03', [ts], 'user_1', CLIENT_MAP);
    // ATTENDU: 8.5 + 5 + 2 = 15.5
    // BUG POTENTIEL: service accède à ts.fraisAnnexes (tableau) au lieu de frais_repas/transport/autres
    expect(report.totalFraisAnnexes).toBe(15.5);
  });

  it('regroupe correctement par client', () => {
    const ts1 = makeTimesheet({ id: 'ts_1', client_id: 'client_1', duration: 3 });
    const ts2 = makeTimesheet({ id: 'ts_2', client_id: 'client_2', duration: 2 });
    const report = ReportService.generateMonthlyReport('2025-03', [ts1, ts2], 'user_1', CLIENT_MAP);
    expect(report.clientBreakdown).toHaveLength(2);
    const mme = report.clientBreakdown.find((c) => c.clientId === 'client_1');
    expect(mme?.clientName).toBe('Mme Dupont');
    expect(mme?.hoursWorked).toBe(3);
  });

  it('retourne 0 heures pour un mois sans timesheets', () => {
    const report = ReportService.generateMonthlyReport('2025-01', [], 'user_1', CLIENT_MAP);
    expect(report.totalHoursWorked).toBe(0);
    expect(report.totalFraisAnnexes).toBe(0);
    expect(report.clientBreakdown).toHaveLength(0);
  });

  it('isole les timesheets par assistantId (user_id)', () => {
    const tsUser1 = makeTimesheet({ user_id: 'user_1', id: 'ts_1' });
    const tsUser2 = makeTimesheet({ user_id: 'user_2', id: 'ts_2' });
    const report = ReportService.generateMonthlyReport('2025-03', [tsUser1, tsUser2], 'user_1', CLIENT_MAP);
    // ATTENDU: seulement les timesheets de user_1
    // BUG POTENTIEL: service filtre via ts.assistantId au lieu de ts.user_id
    expect(report.totalHoursWorked).toBe(4);
  });

  it('arrondit les totaux à 2 décimales', () => {
    const ts = makeTimesheet({ duration: 1 / 3 }); // ~0.333...
    const report = ReportService.generateMonthlyReport('2025-03', [ts], 'user_1', CLIENT_MAP);
    expect(report.totalHoursWorked).toBe(Math.round((1 / 3) * 100) / 100);
  });

  it('inclut une chronologie triée par date', () => {
    const ts1 = makeTimesheet({ id: 'ts_1', date_arrival: new Date('2025-03-15T09:00:00').getTime() });
    const ts2 = makeTimesheet({ id: 'ts_2', date_arrival: new Date('2025-03-05T09:00:00').getTime() });
    const report = ReportService.generateMonthlyReport('2025-03', [ts1, ts2], 'user_1', CLIENT_MAP);
    expect(report.timesheetSummary).toHaveLength(2);
  });
});

// ── Tests exportToCSV ─────────────────────────────────────────────────────────

describe('ReportService.exportToCSV', () => {
  const mockReport: MonthlyReport = {
    month: '2025-03',
    assistantId: 'user_1',
    totalHoursWorked: 32,
    totalEarnings: 480,
    totalFraisAnnexes: 45.5,
    clientBreakdown: [
      {
        clientId: 'client_1',
        clientName: 'Mme Dupont',
        hoursWorked: 20,
        earnings: 30,
        lastIntervention: '2025-03-28T10:00:00',
      },
    ],
    timesheetSummary: [
      { date: '2025-03-10', duration: 4, clients: ['Mme Dupont'], frais: 13.5 },
    ],
    generatedAt: 1743000000000,
  };

  it('génère une chaîne CSV non vide', () => {
    const csv = ReportService.exportToCSV(mockReport);
    expect(typeof csv).toBe('string');
    expect(csv.length).toBeGreaterThan(0);
  });

  it('contient le mois dans le CSV', () => {
    const csv = ReportService.exportToCSV(mockReport);
    expect(csv).toContain('2025-03');
  });

  it('contient les heures totales', () => {
    const csv = ReportService.exportToCSV(mockReport);
    expect(csv).toContain('32');
  });

  it('contient les frais annexes', () => {
    const csv = ReportService.exportToCSV(mockReport);
    expect(csv).toContain('45.5');
  });

  it('contient le nom du client', () => {
    const csv = ReportService.exportToCSV(mockReport);
    expect(csv).toContain('Mme Dupont');
  });

  it('contient la chronologie', () => {
    const csv = ReportService.exportToCSV(mockReport);
    expect(csv).toContain('2025-03-10');
  });

  it('commence par le titre SAP Sheet', () => {
    const csv = ReportService.exportToCSV(mockReport);
    expect(csv).toMatch(/^SAP Sheet/);
  });
});
