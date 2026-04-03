import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';
import { cancelTodayReminder } from '../utils/notificationService';

export interface Timesheet {
  id: string;
  user_id: string;
  client_id: string;
  date_arrival: number;
  date_departure: number;
  duration: number;
  frais_repas: number;
  frais_transport: number;
  frais_autres: number;
  ik_km: number;
  ik_rate: number;
  ik_amount: number;
  description?: string;
  notes?: string;
  status: 'draft' | 'validated';
  created_at: number;
  updated_at: number;
}

interface TimesheetStore {
  timesheets: Timesheet[];
  isLoading: boolean;
  hydrateTimesheets: () => Promise<void>;
  addTimesheet: (timesheet: Omit<Timesheet, 'id' | 'user_id' | 'status' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateTimesheet: (id: string, updates: Partial<Timesheet>) => Promise<void>;
  deleteTimesheet: (id: string) => Promise<void>;
  getTimesheetsForClient: (clientId: string) => Timesheet[];
  getTimesheetsForMonth: (year: number, month: number) => Timesheet[];
  searchTimesheets: (query: string) => Timesheet[];
  getTimesheetById: (id: string) => Timesheet | null;
  setLoading: (loading: boolean) => void;
}

export const useTimesheetStore = create<TimesheetStore>((set, get) => ({
  timesheets: [],
  isLoading: false,

  hydrateTimesheets: async () => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from('timesheets')
        .select('*')
        .order('date_arrival', { ascending: false });

      if (error) throw error;

      console.log('[TimesheetStore] Loaded timesheets from Supabase:', data?.length);
      set({ timesheets: data || [], isLoading: false });
    } catch (error) {
      console.error('hydrateTimesheets failed', error);
      set({ isLoading: false });
    }
  },

  addTimesheet: async (timesheetData) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) throw new Error('User not authenticated');

    const now = Date.now();
    const timesheet: Timesheet = {
      ...timesheetData,
      id: `timesheet_${now}`,
      user_id: userId,
      status: 'draft',
      created_at: now,
      updated_at: now,
    };

    console.log('[TimesheetStore] Inserting timesheet:', timesheet);

    const { error } = await supabase
      .from('timesheets')
      .insert(timesheet);

    if (error) {
      console.error('[TimesheetStore] Insert error:', error);
      throw error;
    }

    console.log('[TimesheetStore] Timesheet inserted successfully');
    set((state) => ({
      timesheets: [timesheet, ...state.timesheets],
    }));

    // Annuler la notification de rappel du jour
    cancelTodayReminder().catch(() => {});
  },

  updateTimesheet: async (id, updates) => {
    const now = Date.now();
    const updatedData = { ...updates, updated_at: now };

    const { error } = await supabase
      .from('timesheets')
      .update(updatedData)
      .eq('id', id);

    if (error) throw error;

    set((state) => ({
      timesheets: state.timesheets.map((t) =>
        t.id === id ? { ...t, ...updatedData } : t
      ),
    }));
  },

  deleteTimesheet: async (id) => {
    const { error } = await supabase
      .from('timesheets')
      .delete()
      .eq('id', id);

    if (error) throw error;

    set((state) => ({
      timesheets: state.timesheets.filter((t) => t.id !== id),
    }));
  },

  getTimesheetsForClient: (clientId) => {
    return get().timesheets.filter((t) => t.client_id === clientId);
  },

  getTimesheetsForMonth: (year, month) => {
    return get().timesheets.filter((t) => {
      const date = new Date(t.date_arrival);
      return date.getFullYear() === year && date.getMonth() === month - 1;
    });
  },

  searchTimesheets: (query) => {
    return get().timesheets.filter((t) =>
      t.client_id.toLowerCase().includes(query.toLowerCase())
    );
  },

  getTimesheetById: (id) => {
    return get().timesheets.find((t) => t.id === id) || null;
  },

  setLoading: (loading) => {
    set({ isLoading: loading });
  },
}));
