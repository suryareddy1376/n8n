import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types';
import { supabase } from '@/lib/supabase';
import apiClient from '@/lib/api';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  
  // Actions
  setUser: (user: User | null) => void;
  login: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: true,
      isAuthenticated: false,

      setUser: (user) => {
        set({ user, isAuthenticated: !!user, isLoading: false });
      },

      login: async (email, password) => {
        set({ isLoading: true });
        
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (error) throw error;

          if (data.user) {
            // Fetch user profile from backend
            try {
              const response = await apiClient.get<{ data: User }>('/users/me');
              set({ user: response.data, isAuthenticated: true });
            } catch (profileError) {
              // Backend might be down or user profile missing - use basic user data
              console.warn('Could not fetch user profile:', profileError);
              set({ 
                user: {
                  id: data.user.id,
                  email: data.user.email || email,
                  full_name: data.user.user_metadata?.full_name || email,
                  role: data.user.user_metadata?.role || 'citizen',
                } as User, 
                isAuthenticated: true 
              });
            }
          }
        } finally {
          set({ isLoading: false });
        }
      },

      signUp: async (email, password, fullName) => {
        set({ isLoading: true });
        
        try {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: fullName,
                role: 'citizen',
              },
            },
          });

          if (error) throw error;

          if (data.user) {
            // User will need to verify email before logging in
            set({ isLoading: false });
          }
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        set({ isLoading: true });
        
        try {
          await supabase.auth.signOut();
          set({ user: null, isAuthenticated: false });
        } finally {
          set({ isLoading: false });
        }
      },

      refreshUser: async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          
          if (session) {
            const response = await apiClient.get<{ data: User }>('/users/me');
            set({ user: response.data, isAuthenticated: true, isLoading: false });
          } else {
            set({ user: null, isAuthenticated: false, isLoading: false });
          }
        } catch {
          set({ user: null, isAuthenticated: false, isLoading: false });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);

// Initialize auth state listener
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_IN' && session) {
    try {
      const response = await apiClient.get<{ data: User }>('/users/me');
      useAuthStore.getState().setUser(response.data);
    } catch {
      useAuthStore.getState().setUser(null);
    }
  } else if (event === 'SIGNED_OUT') {
    useAuthStore.getState().setUser(null);
  }
});
