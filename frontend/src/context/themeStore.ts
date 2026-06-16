import { create } from 'zustand';

interface ThemeState {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  // Defaults to dark mode for premium enterprise feel
  theme: (localStorage.getItem('sidesi_theme') as 'light' | 'dark') || 'dark',
  
  toggleTheme: () => set((state) => {
    const nextTheme = state.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('sidesi_theme', nextTheme);
    
    // Toggle system class lists
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    return { theme: nextTheme };
  }),
  
  setTheme: (theme) => set(() => {
    localStorage.setItem('sidesi_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    return { theme };
  })
}));

// Initialize theme on load
const currentTheme = localStorage.getItem('sidesi_theme') || 'dark';
if (currentTheme === 'dark') {
  document.documentElement.classList.add('dark');
} else {
  document.documentElement.classList.remove('dark');
}
