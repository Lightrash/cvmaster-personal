import { create } from 'zustand';
import type { ResumeAnalysis } from '@/types';

type Page = 'home' | 'jobs' | 'candidate-profile';

interface NavState {
    currentPage: Page;
    setPage: (page: Page) => void;
    // Дані для candidate-profile екрану
    pendingAnalysis: ResumeAnalysis | null;
    pendingFile: File | null;
    setPendingCandidate: (analysis: ResumeAnalysis, file: File) => void;
    clearPendingCandidate: () => void;
}

export const useNavStore = create<NavState>((set) => ({
    currentPage: 'home',
    setPage: (page) => set({ currentPage: page }),
    pendingAnalysis: null,
    pendingFile: null,
    setPendingCandidate: (analysis, file) => set({
        pendingAnalysis: analysis,
        pendingFile: file,
        currentPage: 'candidate-profile',
    }),
    clearPendingCandidate: () => set({
        pendingAnalysis: null,
        pendingFile: null,
    }),
}));
