import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore, getEffectiveUserId } from './authStore';
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
  /** Facture qui porte ce pointage. NULL/absent = pas encore facture.
   *  C'est ce champ qui permet plusieurs factures dans un meme mois sans
   *  jamais recompter deux fois les memes heures. */
  invoice_id?: string | null;
  created_at: number;
  updated_at: number;
}

interface TimesheetStore {
  timesheets: Timesheet[];
  isLoading: boolean;
  hydrateTimesheets: () => Promise<void>;
  addTimesheet: (timesheet: Omit<Timesheet, 'id' | 'user_id' | 'status' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateTimesheet: (id: string, updates: Partial<Timesheet>) => Promise<void>;
  /** Rattache des pointages a une facture (ils cessent d'etre facturables). */
  imputeTimesheets: (ids: ReadonlyArray<string>, invoiceId: string) => Promise<void>;
  /** Libere les pointages d'une facture (avoir, ou brouillon supprime). */
  releaseTimesheets: (invoiceId: string) => Promise<void>;
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
      const uid = getEffectiveUserId();
      if (!uid) {
        set({ timesheets: [], isLoading: false });
        return;
      }

      // La RLS ouvre tout aux admins (`OR is_admin()`) : sans ce filtre, cet
      // écran fondrait les données de tous les utilisateurs. On borne au
      // périmètre de l'utilisateur effectif — soi-même, ou la cible en cours
      // d'impersonation.
      const { data, error } = await supabase
        .from('timesheets')
        .select('*')
        .eq('user_id', uid)
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

  // Imputation : ecrit `invoice_id` sur un lot de pointages, en UNE requete.
  // Appele juste apres la creation de la facture qui les porte. Si cette ecriture
  // echoue, la facture existe mais les pointages restent libres : ils
  // ressortiraient dans le « reste a facturer ». On laisse donc l'erreur
  // remonter pour que l'appelant puisse le signaler, plutot que de la taire.
  imputeTimesheets: async (ids, invoiceId) => {
    if (ids.length === 0) return;
    const now = Date.now();

    const { error } = await supabase
      .from('timesheets')
      .update({ invoice_id: invoiceId, updated_at: now })
      .in('id', ids as string[]);

    if (error) throw error;

    const set_ = new Set(ids);
    set((state) => ({
      timesheets: state.timesheets.map((t) =>
        set_.has(t.id) ? { ...t, invoice_id: invoiceId, updated_at: now } : t
      ),
    }));
  },

  releaseTimesheets: async (invoiceId) => {
    const now = Date.now();

    const { error } = await supabase
      .from('timesheets')
      .update({ invoice_id: null, updated_at: now })
      .eq('invoice_id', invoiceId);

    if (error) throw error;

    set((state) => ({
      timesheets: state.timesheets.map((t) =>
        t.invoice_id === invoiceId ? { ...t, invoice_id: null, updated_at: now } : t
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
