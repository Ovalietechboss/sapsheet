import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';

export interface Client {
  id: string;
  user_id: string;
  name: string;
  address: string;
  facturation_mode: 'CESU' | 'CLASSICAL';
  hourly_rate: number;
  mandataire_name?: string;
  mandataire_email?: string;
  mandataire_siren?: string;
  created_at: number;
  updated_at: number;
}

interface ClientStore {
  clients: Client[];
  isLoading: boolean;
  hydrateClients: () => Promise<void>;
  addClient: (client: Omit<Client, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateClient: (id: string, updates: Partial<Client>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  getClientById: (id: string) => Client | null;
  getClientsByFacturationMode: (mode: 'CESU' | 'CLASSICAL') => Client[];
  searchClients: (query: string) => Client[];
  setLoading: (loading: boolean) => void;
}

export const useClientStore = create<ClientStore>((set, get) => ({
  clients: [],
  isLoading: false,

  hydrateClients: async () => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      set({ clients: data || [], isLoading: false });
    } catch (error) {
      console.error('hydrateClients failed', error);
      set({ isLoading: false });
    }
  },

  addClient: async (clientData) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) throw new Error('User not authenticated');

    const now = Date.now();
    const client: Client = {
      ...clientData,
      id: `client_${now}`,
      user_id: userId,
      created_at: now,
      updated_at: now,
    };

    const { error } = await supabase
      .from('clients')
      .insert(client);

    if (error) throw error;

    set((state) => ({
      clients: [client, ...state.clients],
    }));
  },

  updateClient: async (id, updates) => {
    const now = Date.now();
    const updatedData = { ...updates, updated_at: now };

    const { error } = await supabase
      .from('clients')
      .update(updatedData)
      .eq('id', id);

    if (error) throw error;

    set((state) => ({
      clients: state.clients.map((c) =>
        c.id === id ? { ...c, ...updatedData } : c
      ),
    }));
  },

  deleteClient: async (id) => {
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id);

    if (error) throw error;

    set((state) => ({
      clients: state.clients.filter((c) => c.id !== id),
    }));
  },

  getClientById: (id) => {
    return get().clients.find((c) => c.id === id) || null;
  },

  getClientsByFacturationMode: (mode) => {
    return get().clients.filter((c) => c.facturation_mode === mode);
  },

  searchClients: (query) => {
    if (!query) return get().clients;
    const lowerQuery = query.toLowerCase();
    return get().clients.filter(
      (c) =>
        c.name.toLowerCase().includes(lowerQuery) ||
        c.address.toLowerCase().includes(lowerQuery)
    );
  },

  setLoading: (loading) => {
    set({ isLoading: loading });
  },
}));
