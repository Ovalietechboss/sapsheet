import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface User {
  id: string;
  auth_id: string;
  type: 'assistant' | 'employer';
  email: string;
  display_name: string;
  created_at: number;
  updated_at: number;
  address?: string;
  phone?: string;
  cesu_number?: string;
  siren?: string;
  siret?: string;
  business_name?: string;
  business_address?: string;
  iban?: string;
  bic?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isCheckingSession: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, type: 'assistant' | 'employer', displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  setCurrentUser: (user: User) => void;
  updateUser: (data: Partial<User>) => Promise<void>;
  clearError: () => void;
  loadUser: () => Promise<void>;
}

function mapDbUser(data: Record<string, unknown>): User {
  return {
    id: data.id as string,
    auth_id: data.auth_id as string,
    email: data.email as string,
    display_name: (data.display_name as string) || '',
    type: data.type as 'assistant' | 'employer',
    created_at: data.created_at as number,
    updated_at: data.updated_at as number,
    address: data.address as string | undefined,
    phone: data.phone as string | undefined,
    cesu_number: data.cesu_number as string | undefined,
    siren: data.siren as string | undefined,
    siret: data.siret as string | undefined,
    business_name: data.business_name as string | undefined,
    business_address: data.business_address as string | undefined,
    iban: data.iban as string | undefined,
    bic: data.bic as string | undefined,
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isCheckingSession: true,
  error: null,

  // ─── Connexion ────────────────────────────────────────────
  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw new Error('Email ou mot de passe incorrect');
      if (!authData.user) throw new Error('Connexion échouée');

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', authData.user.id)
        .single();

      if (userError || !userData) {
        throw new Error('Profil introuvable. Veuillez créer un compte.');
      }

      set({ user: mapDbUser(userData), isAuthenticated: true, isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connexion échouée';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  // ─── Inscription ──────────────────────────────────────────
  signup: async (email: string, password: string, type: 'assistant' | 'employer', displayName: string) => {
    set({ isLoading: true, error: null });
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw new Error(authError.message);
      if (!authData.user) throw new Error('Création du compte échouée');

      const now = Date.now();
      const newUser = {
        id: `user_${now}`,
        auth_id: authData.user.id,
        email,
        display_name: displayName || email.split('@')[0],
        type,
        created_at: now,
        updated_at: now,
      };

      const { error: insertError } = await supabase.from('users').insert([newUser]);

      if (insertError) {
        // Email déjà dans la table users → lier le compte auth existant
        if (insertError.code === '23505') {
          const { data: existing } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

          if (existing) {
            await supabase
              .from('users')
              .update({ auth_id: authData.user.id, updated_at: now })
              .eq('email', email);
            set({
              user: mapDbUser({ ...existing, auth_id: authData.user.id }),
              isAuthenticated: true,
              isLoading: false,
            });
            return;
          }
        }
        throw insertError;
      }

      set({ user: mapDbUser(newUser), isAuthenticated: true, isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Inscription échouée';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  // ─── Déconnexion ──────────────────────────────────────────
  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null, isAuthenticated: false, error: null });
  },

  // ─── Vérification session au démarrage ────────────────────
  checkSession: async () => {
    set({ isCheckingSession: true });
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        set({ isCheckingSession: false, isAuthenticated: false });
        return;
      }

      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', session.user.id)
        .single();

      if (error || !userData) {
        set({ isCheckingSession: false, isAuthenticated: false });
        return;
      }

      set({ user: mapDbUser(userData), isAuthenticated: true, isCheckingSession: false });
    } catch {
      set({ isCheckingSession: false, isAuthenticated: false });
    }
  },

  // ─── Rechargement du profil ───────────────────────────────
  loadUser: async () => {
    const { user } = get();
    if (!user) return;

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error || !data) return;
    set({ user: mapDbUser(data) });
  },

  // ─── Mise à jour du profil ────────────────────────────────
  updateUser: async (data: Partial<User>) => {
    const { user } = get();
    if (!user) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, auth_id, created_at, ...allowedData } = data as Record<string, unknown>;

      const { error } = await supabase
        .from('users')
        .update({ ...allowedData, updated_at: Date.now() })
        .eq('id', user.id);

      if (error) throw error;
      await get().loadUser();
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  },

  setCurrentUser: (user: User) => {
    set({ user, isAuthenticated: true });
  },

  clearError: () => {
    set({ error: null });
  },
}));
