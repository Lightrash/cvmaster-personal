import { create } from 'zustand';

interface LayoutState {
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (isSidebarCollapsed: boolean) => void;
}

const readInitialCollapsedState = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  return localStorage.getItem('layout.sidebarCollapsed') === '1';
};

export const useLayoutStore = create<LayoutState>((set) => ({
  isSidebarCollapsed: readInitialCollapsedState(),
  toggleSidebar: () =>
    set((state) => {
      const nextValue = !state.isSidebarCollapsed;
      localStorage.setItem('layout.sidebarCollapsed', nextValue ? '1' : '0');
      return { isSidebarCollapsed: nextValue };
    }),
  setSidebarCollapsed: (isSidebarCollapsed) => {
    localStorage.setItem('layout.sidebarCollapsed', isSidebarCollapsed ? '1' : '0');
    set({ isSidebarCollapsed });
  },
}));
