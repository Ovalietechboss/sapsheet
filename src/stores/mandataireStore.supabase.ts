import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';

export interface Mandataire {
  id: string;
  user_id: string;
  titre?: string;              // M., Mme., Dr., etc.
  name: string;                // Nom de la personne
  association_name: string;    // Nom de l'association / entreprise
  email: string;
  phone?: string;
  siren?: string;
  address?: string;
  created_at: number;
  updated_at: number;
}

interface MandataireStore {
  mandataires: Mandataire[];
  isLoading: boolean;
  hydrateMandataires: () => Promise<void>;
  addMandataire: (m: Omit<Mandataire, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<Mandataire>;
  updateMandataire: (id: string, updates: Partial<Mandataire>) => Promise<void>;
  deleteMandataire: (id: string) => Promise<void>;
  getMandataireById: (id: string) => Mandataire | null;
  searchMandataires: (query: string) => Mandataire[];
}

export const useMandataireStore = create<MandataireStore>((set, get) => ({
  mandataires: [],
  isLoading: false,

  hydrateMandataires: async () => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from('mandataires')
        .select('*')
        .order('association_name', { ascending: true });

      if (error) throw error;
      set({ mandataires: data || [], isLoading: false });
    } catch (error) {
      console.error('hydrateMandataires failed', error);
      set({ isLoading: false });
    }
  },

  addMandataire: async (mandataireData) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) throw new Error('User not authenticated');

    const now = Date.now();
    const mandataire: Mandataire = {
      ...mandataireData,
      id: `mandataire_${now}`,
      user_id: userId,
      created_at: now,
      updated_at: now,
    };

    const { error } = await supabase.from('mandataires').insert(mandataire);
    if (error) throw error;

    set((state) => ({ mandataires: [mandataire, ...state.mandataires] }));
    return mandataire;
  },

  updateMandataire: async (id, updates) => {
    const now = Date.now();
    const updatedData = { ...updates, updated_at: now };

    const { error } = await supabase
      .from('mandataires')
      .update(updatedData)
      .eq('id', id);

    if (error) throw error;

    set((state) => ({
      mandataires: state.mandataires.map((m) =>
        m.id === id ? { ...m, ...updatedData } : m
      ),
    }));
  },

  deleteMandataire: async (id) => {
    const { error } = await supabase.from('mandataires').delete().eq('id', id);
    if (error) throw error;

    set((state) => ({
      mandataires: state.mandataires.filter((m) => m.id !== id),
    }));
  },

  getMandataireById: (id) => {
    return get().mandataires.find((m) => m.id === id) || null;
  },

  searchMandataires: (query) => {
    if (!query) return get().mandataires;
    const q = query.toLowerCase();
    return get().mandataires.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.association_name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
    );
  },
}));
