/**
 * Tests pour les méthodes pures du clientStore (sans appel Supabase)
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

import { useClientStore } from '../clientStore.supabase';
import { Client } from '../clientStore.supabase';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeClient = (overrides: Partial<Client> = {}): Client => ({
  id: 'client_1',
  user_id: 'user_1',
  name: 'Mme Dupont',
  address: '12 rue des Lilas, Paris',
  facturation_mode: 'CESU',
  hourly_rate: 15,
  created_at: Date.now(),
  updated_at: Date.now(),
  ...overrides,
});

const CLIENT_CESU_1 = makeClient({ id: 'c1', name: 'Mme Dupont', facturation_mode: 'CESU' });
const CLIENT_CESU_2 = makeClient({ id: 'c2', name: 'M. Leroux', address: '5 avenue Victor Hugo, Lyon', facturation_mode: 'CESU' });
const CLIENT_CLASSICAL = makeClient({ id: 'c3', name: 'SARL Martin', address: '8 boulevard Haussmann, Paris', facturation_mode: 'CLASSICAL' });

beforeEach(() => {
  useClientStore.setState({
    clients: [CLIENT_CESU_1, CLIENT_CESU_2, CLIENT_CLASSICAL],
  });
});

// ── getClientsByFacturationMode ───────────────────────────────────────────────

describe('getClientsByFacturationMode', () => {
  it('retourne uniquement les clients CESU', () => {
    const result = useClientStore.getState().getClientsByFacturationMode('CESU');
    expect(result).toHaveLength(2);
    result.forEach((c) => expect(c.facturation_mode).toBe('CESU'));
  });

  it('retourne uniquement les clients CLASSICAL', () => {
    const result = useClientStore.getState().getClientsByFacturationMode('CLASSICAL');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('c3');
  });

  it('retourne vide si aucun client de ce mode', () => {
    useClientStore.setState({ clients: [CLIENT_CESU_1] });
    const result = useClientStore.getState().getClientsByFacturationMode('CLASSICAL');
    expect(result).toHaveLength(0);
  });
});

// ── searchClients ─────────────────────────────────────────────────────────────

describe('searchClients', () => {
  it('retourne tous les clients si la recherche est vide', () => {
    const result = useClientStore.getState().searchClients('');
    expect(result).toHaveLength(3);
  });

  it('trouve un client par son nom', () => {
    const result = useClientStore.getState().searchClients('Dupont');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('c1');
  });

  it('trouve un client par son adresse', () => {
    const result = useClientStore.getState().searchClients('Lyon');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('c2');
  });

  it('est insensible à la casse', () => {
    const result = useClientStore.getState().searchClients('dupont');
    expect(result).toHaveLength(1);
  });

  it('retourne vide si aucun résultat', () => {
    const result = useClientStore.getState().searchClients('Montpellier_xyz');
    expect(result).toHaveLength(0);
  });

  it('peut trouver plusieurs clients sur une recherche partielle', () => {
    const result = useClientStore.getState().searchClients('Paris');
    // CLIENT_CESU_1 (12 rue des Lilas, Paris) + CLIENT_CLASSICAL (boulevard Haussmann, Paris)
    expect(result).toHaveLength(2);
  });
});

// ── getClientById ─────────────────────────────────────────────────────────────

describe('getClientById', () => {
  it('retourne le bon client', () => {
    const result = useClientStore.getState().getClientById('c3');
    expect(result).not.toBeNull();
    expect(result?.name).toBe('SARL Martin');
  });

  it('retourne null si id inconnu', () => {
    const result = useClientStore.getState().getClientById('inexistant');
    expect(result).toBeNull();
  });
});
