import { create } from 'zustand';
import { loginUser, registerUser } from '@/services/api';
import type { AuthUser } from '@/types';

const AUTH_STORAGE_KEY = 'cvmaster.auth';

function readStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<AuthUser>;
    if (!parsed?.id || !parsed?.token) return null;

    return {
      id: String(parsed.id),
      name: String(parsed.name || ''),
      token: String(parsed.token),
    };
  } catch {
    return null;
  }
}

function persistUser(user: AuthUser | null) {
  if (typeof window === 'undefined') {
    return;
  }

  if (!user) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }

  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

const initialUser = readStoredUser();

export const useAuthStore = create<AuthState>((set) => ({
  user: initialUser,
  isAuthenticated: Boolean(initialUser),
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const user = await loginUser(email, password);
      persistUser(user);
      set({ user, isAuthenticated: true, isLoading: false, error: null });
    } catch (error) {
      set({
        isLoading: false,
        isAuthenticated: false,
        error: error instanceof Error ? error.message : 'Login failed',
      });
      throw error;
    }
  },

  register: async (name, email, password) => {
    set({ isLoading: true, error: null });
    try {
      const user = await registerUser(name, email, password);
      persistUser(user);
      set({ user, isAuthenticated: true, isLoading: false, error: null });
    } catch (error) {
      set({
        isLoading: false,
        isAuthenticated: false,
        error: error instanceof Error ? error.message : 'Registration failed',
      });
      throw error;
    }
  },

  logout: () => {
    persistUser(null);
    set({ user: null, isAuthenticated: false, error: null });
  },

  clearError: () => set({ error: null }),
}));
