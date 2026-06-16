import { create } from 'zustand';
import api from '@/services/api';
import { PasswordVaultItem, Organization, PaginatedResponse } from '@/types';

interface VaultState {
  items: PasswordVaultItem[];
  organizations: Organization[];
  totalCount: number;
  isLoading: boolean;
  error: string | null;

  fetchItems: (search?: string, orgId?: string, page?: number) => Promise<void>;
  fetchOrganizations: () => Promise<void>;
  createItem: (data: Record<string, unknown>) => Promise<boolean>;
  updateItem: (id: string, data: Record<string, unknown>) => Promise<boolean>;
  deleteItem: (id: string) => Promise<boolean>;
  revealPassword: (id: string) => Promise<string | null>;
  copyPassword: (id: string) => Promise<string | null>;
  importExcel: (file: File) => Promise<{ success: boolean; message: string; imported?: number; skipped?: number; errors?: string[] }>;
  exportExcel: () => Promise<void>;
  downloadTemplate: () => Promise<void>;
  clearError: () => void;
}

const extractError = (err: unknown): string => {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const axiosErr = err as { response?: { data?: { detail?: string } } };
    if (axiosErr.response?.data?.detail) return axiosErr.response.data.detail;
  }
  return 'A apărut o eroare neașteptată.';
};

export const useVaultStore = create<VaultState>((set, get) => ({
  items: [],
  organizations: [],
  totalCount: 0,
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  fetchItems: async (search, orgId, page) => {
    set({ isLoading: true, error: null });
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (orgId) params.organization = orgId;
      if (page) params.page = page.toString();

      const response = await api.get<PaginatedResponse<PasswordVaultItem>>('/vault/', { params });

      // Handle both paginated {results: [...]} and plain array responses
      const data = response.data;
      if (Array.isArray(data)) {
        set({ items: data, totalCount: (data as PasswordVaultItem[]).length, isLoading: false });
      } else {
        set({ items: data.results, totalCount: data.count, isLoading: false });
      }
    } catch (err) {
      set({ isLoading: false, error: extractError(err) });
    }
  },

  fetchOrganizations: async () => {
    try {
      const response = await api.get<PaginatedResponse<Organization> | Organization[]>('/organizations/');
      const data = response.data;
      if (Array.isArray(data)) {
        set({ organizations: data });
      } else {
        set({ organizations: data.results });
      }
    } catch (err) {
      console.error('Error fetching organizations:', err);
    }
  },

  createItem: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<PasswordVaultItem>('/vault/', data);
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
      const response = await api.patch<PasswordVaultItem>(`/vault/${id}/`, data);
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
      await api.delete(`/vault/${id}/`);
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

  revealPassword: async (id) => {
    try {
      const response = await api.get<{ password: string }>(`/vault/${id}/reveal/`);
      return response.data.password;
    } catch (err) {
      console.error('Password reveal failed:', err);
      return null;
    }
  },

  copyPassword: async (id) => {
    try {
      const response = await api.get<{ password: string }>(`/vault/${id}/copy/`);
      return response.data.password;
    } catch (err) {
      console.error('Password copy failed:', err);
      return null;
    }
  },

  importExcel: async (file) => {
    set({ isLoading: true, error: null });
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await api.post<{ detail: string; imported: number; skipped: number; errors?: string[] }>(
        '/vault/import/',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      set({ isLoading: false });
      // Reload items after import
      await get().fetchItems();
      return {
        success: true,
        message: response.data.detail,
        imported: response.data.imported,
        skipped: response.data.skipped,
        errors: response.data.errors,
      };
    } catch (err) {
      const msg = extractError(err);
      set({ isLoading: false, error: msg });
      return { success: false, message: msg };
    }
  },

  exportExcel: async () => {
    try {
      const response = await api.get('/vault/export/', { responseType: 'blob' });
      const blob = new Blob([response.data as BlobPart], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `SIDESI_Parole_${new Date().toISOString().slice(0, 10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export Excel failed:', err);
    }
  },

  downloadTemplate: async () => {
    try {
      const response = await api.get('/vault/template/', { responseType: 'blob' });
      const blob = new Blob([response.data as BlobPart], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'SIDESI_Model_Import.xlsx');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download template failed:', err);
    }
  },
}));
