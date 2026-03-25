import { create } from 'zustand';

interface UIState {
  activeTab: 'timesheets' | 'clients' | 'invoices' | 'reports' | 'profile';
  isLoading: boolean;
  error: string | null;
  success: string | null;
  
  setActiveTab: (tab: 'timesheets' | 'clients' | 'invoices' | 'reports' | 'profile') => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSuccess: (message: string | null) => void;
  clearMessages: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeTab: 'timesheets',
  isLoading: false,
  error: null,
  success: null,
  
  setActiveTab: (tab) => {
    set({ activeTab: tab });
  },
  
  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },
  
  setError: (error: string | null) => {
    set({ error });
  },
  
  setSuccess: (message: string | null) => {
    set({ success: message });
  },
  
  clearMessages: () => {
    set({ error: null, success: null });
  },
}));
