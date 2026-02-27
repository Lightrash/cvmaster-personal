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
  setCandidateStatus: (
    candidateId: string,
    status: ColumnStatus,
    options?: { rejectionReason?: string; comment?: string }
  ) => Promise<void>;
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

  setCandidateStatus: async (candidateId, status, options) => {
    const previous = get().candidates;

    set((state) => ({
      candidates: state.candidates.map((c) =>
        c.id === candidateId ? { ...c, status } : c
      ),
      error: null,
    }));

    try {
      const updated = await updateCandidateStatus(candidateId, status, options);
      set((state) => ({
        candidates: state.candidates.map((c) => (c.id === candidateId ? updated : c)),
      }));
    } catch (error) {
      set({
        candidates: previous,
        error: error instanceof Error ? error.message : 'Failed to update candidate status',
      });
      throw error;
    }
  },

  moveCandidate: async (candidateId, newStatus) => {
    await get().setCandidateStatus(candidateId, newStatus);
  },

  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedJob: (job) => set({ selectedJob: job }),
  setSortBy: (sort) => set({ sortBy: sort }),

  getCandidatesByStatus: (status) => {
    const state = get();
    const filtered = state.candidates.filter((candidate) => candidate.status === status);

    let result = filtered;

    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      result = result.filter(
        (candidate) =>
          candidate.name.toLowerCase().includes(q) ||
          candidate.surname.toLowerCase().includes(q) ||
          candidate.position.toLowerCase().includes(q)
      );
    }

    if (state.selectedJob && state.selectedJob !== 'all') {
      if (state.selectedJob.startsWith('job|')) {
        const [, vacancyId, ...titleParts] = state.selectedJob.split('|');
        const vacancyTitle = titleParts.join('|');
        result = result.filter(
          (candidate) =>
            candidate.vacancyId === vacancyId ||
            (!candidate.vacancyId && (candidate.position || '') === vacancyTitle)
        );
      } else {
      const legacyPosition = state.selectedJob.startsWith('legacy:')
        ? state.selectedJob.slice('legacy:'.length)
        : '';

        result = result.filter((candidate) => {
          if (legacyPosition) {
            return (candidate.position || '') === legacyPosition && !candidate.vacancyId;
          }
          return candidate.vacancyId === state.selectedJob || candidate.position === state.selectedJob;
        });
      }
    }

    if (state.sortBy === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (state.sortBy === 'progress') {
      result.sort((a, b) => b.progress - a.progress);
    } else if (state.sortBy === 'deadline') {
      result.sort((a, b) => parseInt(a.deadline, 10) - parseInt(b.deadline, 10));
    }

    return result;
  },
}));
