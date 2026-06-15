import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';

/** Ligne d'une facture indépendante (société B2B, sans pointage). */
export interface InvoiceLine {
  designation: string;
  quantity: number;
  unit_price: number; // prix unitaire HT
}

export interface Invoice {
  id: string;
  user_id: string;
  client_id: string;
  invoice_number: string;
  status: 'draft' | 'sent' | 'paid';
  total_amount: number;
  month: number;
  year: number;
  /** Lignes libres (facture indépendante). Absent pour les factures issues des pointages. */
  lines?: InvoiceLine[];
  /** Date d'encaissement (ms). Renseignée quand la facture passe en « payée » → base URSSAF. */
  paid_at?: number | null;
  /** Si renseigné : ce document est un AVOIR sur la facture dont c'est le numéro (total négatif). */
  credit_of?: string | null;
  /** Date d'envoi par email (ms). */
  sent_at?: number | null;
  generated_at: number;
  created_at: number;
  updated_at: number;
}

interface InvoiceStore {
  invoices: Invoice[];
  isLoading: boolean;
  hydrateInvoices: () => Promise<void>;
  addInvoice: (invoice: Omit<Invoice, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateInvoice: (id: string, updates: Partial<Invoice>) => Promise<void>;
  deleteInvoice: (id: string) => Promise<void>;
  getInvoicesForClient: (clientId: string) => Invoice[];
  getInvoicesByMonth: (year: number, month: number) => Invoice[];
  getInvoiceById: (id: string) => Invoice | null;
  setLoading: (loading: boolean) => void;
}

export const useInvoiceStore = create<InvoiceStore>((set, get) => ({
  invoices: [],
  isLoading: false,

  hydrateInvoices: async () => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .order('generated_at', { ascending: false });

      if (error) throw error;

      set({ invoices: data || [], isLoading: false });
    } catch (error) {
      console.error('hydrateInvoices failed', error);
      set({ isLoading: false });
    }
  },

  addInvoice: async (invoiceData) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) throw new Error('User not authenticated');

    const now = Date.now();
    const invoice: Invoice = {
      ...invoiceData,
      id: `invoice_${now}`,
      user_id: userId,
      generated_at: invoiceData.generated_at ?? now,
      created_at: now,
      updated_at: now,
    };

    const { error } = await supabase
      .from('invoices')
      .insert(invoice);

    if (error) throw error;

    set((state) => ({
      invoices: [invoice, ...state.invoices],
    }));
  },

  updateInvoice: async (id, updates) => {
    const now = Date.now();
    const updatedData = { ...updates, updated_at: now };

    const { error } = await supabase
      .from('invoices')
      .update(updatedData)
      .eq('id', id);

    if (error) throw error;

    set((state) => ({
      invoices: state.invoices.map((i) =>
        i.id === id ? { ...i, ...updatedData } : i
      ),
    }));
  },

  deleteInvoice: async (id) => {
    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', id);

    if (error) throw error;

    set((state) => ({
      invoices: state.invoices.filter((i) => i.id !== id),
    }));
  },

  getInvoicesForClient: (clientId) => {
    return get().invoices.filter((i) => i.client_id === clientId);
  },

  getInvoicesByMonth: (year, month) => {
    return get().invoices.filter((i) => {
      const date = new Date(i.created_at);
      return date.getFullYear() === year && date.getMonth() === month - 1;
    });
  },

  getInvoiceById: (id) => {
    return get().invoices.find((i) => i.id === id) || null;
  },

  setLoading: (loading) => {
    set({ isLoading: loading });
  },
}));
