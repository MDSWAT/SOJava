import { create } from 'zustand';
import api from '@/services/api';
import { PersonalVaultItem, PaginatedResponse } from '@/types';

interface PersonalVaultState {
  items: PersonalVaultItem[];
  totalCount: number;
  isLoading: boolean;
  error: string | null;

  fetchItems: (search?: string, category?: string, favoritesOnly?: boolean, page?: number) => Promise<void>;
  createItem: (data: Record<string, unknown>) => Promise<boolean>;
  updateItem: (id: string, data: Record<string, unknown>) => Promise<boolean>;
  deleteItem: (id: string) => Promise<boolean>;
  toggleFavorite: (id: string) => Promise<void>;
  revealPassword: (id: string) => Promise<string | null>;
  copyPassword: (id: string) => Promise<string | null>;
  clearError: () => void;
}

const extractError = (err: unknown): string => {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const axiosErr = err as { response?: { data?: { detail?: string } } };
    if (axiosErr.response?.data?.detail) return axiosErr.response.data.detail;
  }
  return 'A apărut o eroare neașteptată.';
};

export const usePersonalVaultStore = create<PersonalVaultState>((set) => ({
  items: [],
  totalCount: 0,
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  fetchItems: async (search, category, favoritesOnly, page) => {
    set({ isLoading: true, error: null });
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (category) params.category = category;
      if (favoritesOnly) params.favorites = 'true';
      if (page) params.page = page.toString();

      const response = await api.get<PaginatedResponse<PersonalVaultItem> | PersonalVaultItem[]>(
        '/personal-vault/',
        { params }
      );
      const data = response.data;
      if (Array.isArray(data)) {
        set({ items: data, totalCount: data.length, isLoading: false });
      } else {
        set({ items: data.results, totalCount: data.count, isLoading: false });
      }
    } catch (err) {
      set({ isLoading: false, error: extractError(err) });
    }
  },

  createItem: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<PersonalVaultItem>('/personal-vault/', data);
      set((state) => ({
        items: [response.data, ...state.items],
        totalCount: state.totalCount + 1,
        isLoading: false,
      }));
      return true;
    } catch (err) {
      set({ isLoading: false, error: extractError(err) });
      return false;
    }
  },

  updateItem: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.patch<PersonalVaultItem>(`/personal-vault/${id}/`, data);
      set((state) => ({
        items: state.items.map((item) => (item.id === id ? response.data : item)),
        isLoading: false,
      }));
      return true;
    } catch (err) {
      set({ isLoading: false, error: extractError(err) });
      return false;
    }
  },

  deleteItem: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete(`/personal-vault/${id}/`);
      set((state) => ({
        items: state.items.filter((item) => item.id !== id),
        totalCount: state.totalCount - 1,
        isLoading: false,
      }));
      return true;
    } catch (err) {
      set({ isLoading: false, error: extractError(err) });
      return false;
    }
  },

  toggleFavorite: async (id) => {
    try {
      const response = await api.patch<{ is_favorite: boolean }>(`/personal-vault/${id}/toggle-favorite/`);
      set((state) => ({
        items: state.items.map((item) =>
          item.id === id ? { ...item, is_favorite: response.data.is_favorite } : item
        ),
      }));
    } catch (err) {
      console.error('Toggle favorite failed:', err);
    }
  },

  revealPassword: async (id) => {
    try {
      const response = await api.get<{ password: string }>(`/personal-vault/${id}/reveal/`);
      return response.data.password;
    } catch (err) {
      console.error('Personal reveal failed:', err);
      return null;
    }
  },

  copyPassword: async (id) => {
    try {
      const response = await api.get<{ password: string }>(`/personal-vault/${id}/copy/`);
      return response.data.password;
    } catch (err) {
      console.error('Personal copy failed:', err);
      return null;
    }
  },
}));
