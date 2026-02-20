import { create } from 'zustand';

type Theme = 'light' | 'dark';

interface ThemeState {
    theme: Theme;
    toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set) => {
    // Read from localStorage or system preference
    const savedTheme = typeof window !== 'undefined'
        ? (localStorage.getItem('theme') as Theme)
        : null;
    const systemDark = typeof window !== 'undefined'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
        : false;
    const initial: Theme = savedTheme || (systemDark ? 'dark' : 'light');

    // Apply on init
    if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', initial === 'dark');
    }

    return {
        theme: initial,
        toggleTheme: () =>
            set((state) => {
                const next: Theme = state.theme === 'light' ? 'dark' : 'light';
                document.documentElement.classList.toggle('dark', next === 'dark');
                localStorage.setItem('theme', next);
                return { theme: next };
            }),
    };
});
