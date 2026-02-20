import { create } from 'zustand';
import type { Candidate, ColumnStatus } from '@/types';
import { createCandidate, fetchCandidates, updateCandidateStatus } from '@/services/api';

interface BoardState {
    candidates: Candidate[];
    searchQuery: string;
    selectedJob: string;
    sortBy: string;
    isLoading: boolean;
    error: string | null;
    hasLoaded: boolean;

    loadCandidates: () => Promise<void>;
    addCandidate: (candidate: Omit<Candidate, 'id'>) => Promise<void>;
    moveCandidate: (candidateId: string, newStatus: ColumnStatus) => Promise<void>;
    setSearchQuery: (query: string) => void;
    setSelectedJob: (job: string) => void;
    setSortBy: (sort: string) => void;
    getCandidatesByStatus: (status: ColumnStatus) => Candidate[];
}

export const useBoardStore = create<BoardState>((set, get) => ({
    candidates: [],
    searchQuery: '',
    selectedJob: 'all',
    sortBy: 'name',
    isLoading: false,
    error: null,
    hasLoaded: false,

    loadCandidates: async () => {
        set({ isLoading: true, error: null });
        try {
            const candidates = await fetchCandidates();
            set({ candidates, isLoading: false, hasLoaded: true });
        } catch (error) {
            set({
                isLoading: false,
                error: error instanceof Error ? error.message : 'Failed to load candidates',
            });
        }
    },

    addCandidate: async (candidate) => {
        set({ error: null });
        try {
            const created = await createCandidate(candidate);
            set((state) => ({
                candidates: [created, ...state.candidates],
            }));
        } catch (error) {
            set({
                error: error instanceof Error ? error.message : 'Failed to create candidate',
            });
            throw error;
        }
    },

    moveCandidate: async (candidateId, newStatus) => {
        const previous = get().candidates;

        set((state) => ({
            candidates: state.candidates.map((c) =>
                c.id === candidateId ? { ...c, status: newStatus } : c
            ),
            error: null,
        }));

        try {
            const updated = await updateCandidateStatus(candidateId, newStatus);
            set((state) => ({
                candidates: state.candidates.map((c) =>
                    c.id === candidateId ? updated : c
                ),
            }));
        } catch (error) {
            set({
                candidates: previous,
                error: error instanceof Error ? error.message : 'Failed to move candidate',
            });
            throw error;
        }
    },

    setSearchQuery: (query) => set({ searchQuery: query }),
    setSelectedJob: (job) => set({ selectedJob: job }),
    setSortBy: (sort) => set({ sortBy: sort }),

    getCandidatesByStatus: (status) => {
        const state = get();
        let filtered = state.candidates.filter((c) => c.status === status);

        if (state.searchQuery) {
            const q = state.searchQuery.toLowerCase();
            filtered = filtered.filter(
                (c) =>
                    c.name.toLowerCase().includes(q) ||
                    c.surname.toLowerCase().includes(q) ||
                    c.position.toLowerCase().includes(q)
            );
        }

        if (state.selectedJob && state.selectedJob !== 'all') {
            filtered = filtered.filter((c) => c.position === state.selectedJob);
        }

        if (state.sortBy === 'name') {
            filtered.sort((a, b) => a.name.localeCompare(b.name));
        } else if (state.sortBy === 'progress') {
            filtered.sort((a, b) => b.progress - a.progress);
        } else if (state.sortBy === 'deadline') {
            filtered.sort((a, b) => parseInt(a.deadline, 10) - parseInt(b.deadline, 10));
        }

        return filtered;
    },
}));
