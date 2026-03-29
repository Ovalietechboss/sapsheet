import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';

export type PeriodStatus = 'open' | 'locked' | 'archived';
export type ClientDocStatus = 'pending' | 'generated' | 'sent' | 'error';

export interface BillingPeriod {
  id: string;
  user_id: string;
  month: number;
  year: number;
  status: PeriodStatus;
  locked_at?: number;
  notes?: string;
  created_at: number;
  updated_at: number;
}

export interface BillingPeriodClient {
  id: string;
  period_id: string;
  client_id: string;
  status: ClientDocStatus;
  doc_generated_at?: number;
  sent_at?: number;
  recipient_email?: string;
  notes?: string;
  created_at: number;
  updated_at: number;
}

interface BillingPeriodStore {
  periods: BillingPeriod[];
  periodClients: BillingPeriodClient[];
  isLoading: boolean;

  hydratePeriods: () => Promise<void>;

  // Obtenir ou créer la période du mois courant
  getOrCreatePeriod: (month: number, year: number) => Promise<BillingPeriod>;

  // Mettre à jour le statut d'un client dans une période
  upsertClientStatus: (
    periodId: string,
    clientId: string,
    updates: Partial<Pick<BillingPeriodClient, 'status' | 'doc_generated_at' | 'sent_at' | 'recipient_email' | 'notes'>>
  ) => Promise<void>;

  // Clôturer un mois (open → locked)
  lockPeriod: (periodId: string) => Promise<void>;

  // Archiver un mois (locked → archived)
  archivePeriod: (periodId: string) => Promise<void>;

  // Rouvrir un mois (locked → open)
  unlockPeriod: (periodId: string) => Promise<void>;

  // Helpers
  getPeriod: (month: number, year: number) => BillingPeriod | null;
  getClientStatus: (periodId: string, clientId: string) => BillingPeriodClient | null;
  getPeriodClients: (periodId: string) => BillingPeriodClient[];
}

export const useBillingPeriodStore = create<BillingPeriodStore>((set, get) => ({
  periods: [],
  periodClients: [],
  isLoading: false,

  hydratePeriods: async () => {
    set({ isLoading: true });
    try {
      const [{ data: periods }, { data: clients }] = await Promise.all([
        supabase.from('billing_periods').select('*').order('year', { ascending: false }).order('month', { ascending: false }),
        supabase.from('billing_period_clients').select('*'),
      ]);
      set({ periods: periods || [], periodClients: clients || [], isLoading: false });
    } catch (err) {
      console.error('hydratePeriods failed', err);
      set({ isLoading: false });
    }
  },

  getOrCreatePeriod: async (month, year) => {
    const existing = get().getPeriod(month, year);
    if (existing) return existing;

    const userId = useAuthStore.getState().user?.id;
    if (!userId) throw new Error('User not authenticated');

    const now = Date.now();
    const period: BillingPeriod = {
      id: `period_${userId}_${year}_${month}`,
      user_id: userId,
      month,
      year,
      status: 'open',
      created_at: now,
      updated_at: now,
    };

    const { error } = await supabase.from('billing_periods').insert(period);
    if (error) throw error;

    set((state) => ({ periods: [period, ...state.periods] }));
    return period;
  },

  upsertClientStatus: async (periodId, clientId, updates) => {
    const now = Date.now();
    const existing = get().getClientStatus(periodId, clientId);

    if (existing) {
      const updated = { ...updates, updated_at: now };
      const { error } = await supabase
        .from('billing_period_clients')
        .update(updated)
        .eq('id', existing.id);
      if (error) throw error;

      set((state) => ({
        periodClients: state.periodClients.map((pc) =>
          pc.id === existing.id ? { ...pc, ...updated } : pc
        ),
      }));
    } else {
      const newRecord: BillingPeriodClient = {
        id: `bpc_${periodId}_${clientId}`,
        period_id: periodId,
        client_id: clientId,
        status: updates.status || 'pending',
        doc_generated_at: updates.doc_generated_at,
        sent_at: updates.sent_at,
        recipient_email: updates.recipient_email,
        notes: updates.notes,
        created_at: now,
        updated_at: now,
      };
      const { error } = await supabase.from('billing_period_clients').insert(newRecord);
      if (error) throw error;

      set((state) => ({ periodClients: [...state.periodClients, newRecord] }));
    }
  },

  lockPeriod: async (periodId) => {
    const now = Date.now();
    const { error } = await supabase
      .from('billing_periods')
      .update({ status: 'locked', locked_at: now, updated_at: now })
      .eq('id', periodId);
    if (error) throw error;

    set((state) => ({
      periods: state.periods.map((p) =>
        p.id === periodId ? { ...p, status: 'locked', locked_at: now, updated_at: now } : p
      ),
    }));
  },

  archivePeriod: async (periodId) => {
    const now = Date.now();
    const { error } = await supabase
      .from('billing_periods')
      .update({ status: 'archived', updated_at: now })
      .eq('id', periodId);
    if (error) throw error;

    set((state) => ({
      periods: state.periods.map((p) =>
        p.id === periodId ? { ...p, status: 'archived', updated_at: now } : p
      ),
    }));
  },

  unlockPeriod: async (periodId) => {
    const now = Date.now();
    const { error } = await supabase
      .from('billing_periods')
      .update({ status: 'open', locked_at: undefined, updated_at: now })
      .eq('id', periodId);
    if (error) throw error;

    set((state) => ({
      periods: state.periods.map((p) =>
        p.id === periodId ? { ...p, status: 'open', locked_at: undefined, updated_at: now } : p
      ),
    }));
  },

  getPeriod: (month, year) => {
    return get().periods.find((p) => p.month === month && p.year === year) || null;
  },

  getClientStatus: (periodId, clientId) => {
    return get().periodClients.find((pc) => pc.period_id === periodId && pc.client_id === clientId) || null;
  },

  getPeriodClients: (periodId) => {
    return get().periodClients.filter((pc) => pc.period_id === periodId);
  },
}));
