import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';

export interface Client {
  id: string;
  user_id: string;
  titre?: string;
  name: string;
  first_name?: string;
  email?: string;
  address: string;
  facturation_mode: 'CESU' | 'CLASSICAL';
  hourly_rate: number;
  mandataire_id?: string;
  observations?: string;
  created_at: number;
  updated_at: number;
}

export interface ClientContact {
  id: string;
  client_id: string;
  label: string;
  email: string;
  notes?: string;
  created_at: number;
  updated_at: number;
}

interface ClientStore {
  clients: Client[];
  contacts: ClientContact[];
  isLoading: boolean;
  hydrateClients: () => Promise<void>;
  addClient: (client: Omit<Client, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateClient: (id: string, updates: Partial<Client>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  getClientById: (id: string) => Client | null;
  getClientsByFacturationMode: (mode: 'CESU' | 'CLASSICAL') => Client[];
  searchClients: (query: string) => Client[];
  setLoading: (loading: boolean) => void;
  // Contacts additionnels
  getContactsForClient: (clientId: string) => ClientContact[];
  addContact: (contact: Omit<ClientContact, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateContact: (id: string, updates: Partial<ClientContact>) => Promise<void>;
  deleteContact: (id: string) => Promise<void>;
}

export const useClientStore = create<ClientStore>((set, get) => ({
  clients: [],
  contacts: [],
  isLoading: false,

  hydrateClients: async () => {
    set({ isLoading: true });
    try {
      const [{ data: clientsData, error: clientsError }, { data: contactsData }] = await Promise.all([
        supabase.from('clients').select('*').order('created_at', { ascending: false }),
        supabase.from('client_contacts').select('*').order('label', { ascending: true }),
      ]);

      if (clientsError) throw clientsError;

      set({ clients: clientsData || [], contacts: contactsData || [], isLoading: false });
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

  // ─── Contacts additionnels ───────────────────────────────────
  getContactsForClient: (clientId) => {
    return get().contacts.filter((c) => c.client_id === clientId);
  },

  addContact: async (contactData) => {
    const now = Date.now();
    const contact: ClientContact = {
      ...contactData,
      id: `contact_${now}`,
      created_at: now,
      updated_at: now,
    };
    const { error } = await supabase.from('client_contacts').insert(contact);
    if (error) throw error;
    set((state) => ({ contacts: [...state.contacts, contact] }));
  },

  updateContact: async (id, updates) => {
    const now = Date.now();
    const updated = { ...updates, updated_at: now };
    const { error } = await supabase.from('client_contacts').update(updated).eq('id', id);
    if (error) throw error;
    set((state) => ({
      contacts: state.contacts.map((c) => c.id === id ? { ...c, ...updated } : c),
    }));
  },

  deleteContact: async (id) => {
    const { error } = await supabase.from('client_contacts').delete().eq('id', id);
    if (error) throw error;
    set((state) => ({ contacts: state.contacts.filter((c) => c.id !== id) }));
  },
}));
