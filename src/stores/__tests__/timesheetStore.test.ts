/**
 * Tests pour les méthodes pures du timesheetStore (sans appel Supabase)
 */

// Mock Supabase avant tout import
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

import { useTimesheetStore } from '../timesheetStore.supabase';
import { Timesheet } from '../timesheetStore.supabase';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeTs = (overrides: Partial<Timesheet> = {}): Timesheet => ({
  id: 'ts_1',
  user_id: 'user_1',
  client_id: 'client_1',
  date_arrival: new Date('2025-03-10T09:00:00').getTime(),
  date_departure: new Date('2025-03-10T13:00:00').getTime(),
  duration: 4,
  frais_repas: 0,
  frais_transport: 0,
  frais_autres: 0,
  status: 'draft',
  created_at: Date.now(),
  updated_at: Date.now(),
  ...overrides,
});

const MARCH_TS = makeTs({ id: 'ts_march', date_arrival: new Date('2025-03-15T09:00:00').getTime() });
const APRIL_TS = makeTs({ id: 'ts_april', date_arrival: new Date('2025-04-01T09:00:00').getTime() });
// ts_c2 : client différent, en février pour ne pas interférer avec mars
const CLIENT2_TS = makeTs({ id: 'ts_c2', client_id: 'client_2', date_arrival: new Date('2025-02-10T09:00:00').getTime() });

beforeEach(() => {
  useTimesheetStore.setState({
    timesheets: [MARCH_TS, APRIL_TS, CLIENT2_TS],
  });
});

// ── getTimesheetsForMonth ─────────────────────────────────────────────────────

describe('getTimesheetsForMonth', () => {
  it('retourne uniquement les timesheets du mois demandé', () => {
    const result = useTimesheetStore.getState().getTimesheetsForMonth(2025, 3);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('ts_march');
  });

  it('retourne vide si aucun timesheet pour ce mois', () => {
    const result = useTimesheetStore.getState().getTimesheetsForMonth(2025, 1);
    expect(result).toHaveLength(0);
  });

  it('retourne les timesheets d\'avril', () => {
    const result = useTimesheetStore.getState().getTimesheetsForMonth(2025, 4);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('ts_april');
  });

  it('gère correctement le mois de décembre (mois 12)', () => {
    const tsDecembre = makeTs({ id: 'ts_dec', date_arrival: new Date('2025-12-20T09:00:00').getTime() });
    useTimesheetStore.setState({ timesheets: [tsDecembre] });
    const result = useTimesheetStore.getState().getTimesheetsForMonth(2025, 12);
    expect(result).toHaveLength(1);
  });

  it('distingue les années différentes', () => {
    const ts2024 = makeTs({ id: 'ts_2024', date_arrival: new Date('2024-03-10T09:00:00').getTime() });
    const ts2025 = makeTs({ id: 'ts_2025', date_arrival: new Date('2025-03-10T09:00:00').getTime() });
    useTimesheetStore.setState({ timesheets: [ts2024, ts2025] });
    const result = useTimesheetStore.getState().getTimesheetsForMonth(2025, 3);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('ts_2025');
  });
});

// ── getTimesheetsForClient ────────────────────────────────────────────────────

describe('getTimesheetsForClient', () => {
  it('retourne les timesheets du bon client', () => {
    const result = useTimesheetStore.getState().getTimesheetsForClient('client_1');
    const ids = result.map((t) => t.id);
    expect(ids).toContain('ts_march');
    expect(ids).toContain('ts_april');
    expect(ids).not.toContain('ts_c2');
  });

  it('retourne vide si client inconnu', () => {
    const result = useTimesheetStore.getState().getTimesheetsForClient('client_999');
    expect(result).toHaveLength(0);
  });

  it('retourne le timesheet du client 2 (en février)', () => {
    const result = useTimesheetStore.getState().getTimesheetsForClient('client_2');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('ts_c2');
  });
});

// ── searchTimesheets ──────────────────────────────────────────────────────────

describe('searchTimesheets', () => {
  it('trouve les timesheets par client_id', () => {
    const result = useTimesheetStore.getState().searchTimesheets('client_2');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('ts_c2');
  });

  it('est insensible à la casse', () => {
    const result = useTimesheetStore.getState().searchTimesheets('CLIENT_1');
    expect(result.length).toBeGreaterThan(0);
  });

  it('retourne vide si aucun résultat', () => {
    const result = useTimesheetStore.getState().searchTimesheets('inexistant_xyz');
    expect(result).toHaveLength(0);
  });
});

// ── getTimesheetById ──────────────────────────────────────────────────────────

describe('getTimesheetById', () => {
  it('retourne le bon timesheet', () => {
    const result = useTimesheetStore.getState().getTimesheetById('ts_march');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('ts_march');
  });

  it('retourne null si id inconnu', () => {
    const result = useTimesheetStore.getState().getTimesheetById('ts_999');
    expect(result).toBeNull();
  });
});
