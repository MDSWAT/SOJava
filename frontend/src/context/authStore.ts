import { create } from 'zustand';
import api from '@/services/api';
import { User } from '@/types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  hasPermission: (permissionCode: string) => boolean;
  clearError: () => void;
}

const getUserFromStorage = (): User | null => {
  try {
    const stored = localStorage.getItem('sidesi_user');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: getUserFromStorage(),
  isAuthenticated: !!localStorage.getItem('sidesi_access_token'),
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  login: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/auth/login/', { username, password });
      const { access, refresh, user } = response.data;

      localStorage.setItem('sidesi_access_token', access);
      localStorage.setItem('sidesi_refresh_token', refresh);
      localStorage.setItem('sidesi_user', JSON.stringify(user));

      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      return true;
    } catch (err: unknown) {
      let errorMessage = 'Date de autentificare incorecte.';
      if (
        typeof err === 'object' &&
        err !== null &&
        'response' in err &&
        (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
      ) {
        errorMessage = (err as { response: { data: { detail: string } } }).response.data.detail;
      }
      set({ isLoading: false, error: errorMessage });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('sidesi_access_token');
    localStorage.removeItem('sidesi_refresh_token');
    localStorage.removeItem('sidesi_user');
    set({ user: null, isAuthenticated: false, error: null });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('sidesi_access_token');
    if (!token) {
      set({ isAuthenticated: false, user: null });
      return;
    }

    set({ isLoading: true });
    try {
      const response = await api.get('/auth/me/');
      const user: User = response.data;
      localStorage.setItem('sidesi_user', JSON.stringify(user));
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      // Token invalid or expired — clear everything
      localStorage.removeItem('sidesi_access_token');
      localStorage.removeItem('sidesi_refresh_token');
      localStorage.removeItem('sidesi_user');
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  hasPermission: (permissionCode: string): boolean => {
    const user = get().user;
    if (!user) return false;

    // Super Admin bypasses all permission checks
    if (user.role_detail?.name === 'Super Admin') return true;

    // Check custom direct permissions overrides first
    const hasCustom = user.custom_permissions?.some((p) => p.code === permissionCode) ?? false;
    if (hasCustom) return true;

    // Check if the permission code exists in the role's permissions array
    return user.role_detail?.permissions?.some((p) => p.code === permissionCode) ?? false;
  },
}));
