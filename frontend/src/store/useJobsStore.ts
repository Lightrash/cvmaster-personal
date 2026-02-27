import { create } from 'zustand';
import type { Job } from '@/types';
import {
  createJob as createJobApi,
  deleteJob as deleteJobApi,
  fetchJobs,
  updateJob as updateJobApi,
} from '@/services/api';

interface JobsState {
  jobs: Job[];
  searchQuery: string;
  filter: 'all' | 'Active' | 'Closed' | 'Draft';
  isLoading: boolean;
  error: string | null;
  hasLoaded: boolean;
  setSearchQuery: (q: string) => void;
  setFilter: (f: 'all' | 'Active' | 'Closed' | 'Draft') => void;
  loadJobs: () => Promise<void>;
  addJob: (job: Omit<Job, 'id'>) => Promise<void>;
  removeJob: (id: string) => Promise<void>;
  updateJob: (id: string, patch: Partial<Omit<Job, 'id'>>) => Promise<void>;
  updateJobStatus: (id: string, status: Job['status']) => Promise<void>;
  getFilteredJobs: () => Job[];
}

export const useJobsStore = create<JobsState>((set, get) => ({
  jobs: [],
  searchQuery: '',
  filter: 'all',
  isLoading: false,
  error: null,
  hasLoaded: false,

  setSearchQuery: (q) => set({ searchQuery: q }),
  setFilter: (f) => set({ filter: f }),

  loadJobs: async () => {
    set({ isLoading: true, error: null });
    try {
      const jobs = await fetchJobs();
      set({ jobs, isLoading: false, hasLoaded: true });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load jobs',
      });
    }
  },

  addJob: async (job) => {
    set({ error: null });
    try {
      const created = await createJobApi(job);
      set((state) => ({
        jobs: [created, ...state.jobs],
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create job',
      });
      throw error;
    }
  },

  removeJob: async (id) => {
    const previous = get().jobs;
    set((state) => ({ jobs: state.jobs.filter((job) => job.id !== id), error: null }));

    try {
      await deleteJobApi(id);
    } catch (error) {
      set({
        jobs: previous,
        error: error instanceof Error ? error.message : 'Failed to delete job',
      });
      throw error;
    }
  },

  updateJob: async (id, patch) => {
    const previous = get().jobs;
    set((state) => ({
      jobs: state.jobs.map((job) => (job.id === id ? { ...job, ...patch } : job)),
      error: null,
    }));

    try {
      const updated = await updateJobApi(id, patch);
      set((state) => ({
        jobs: state.jobs.map((job) => (job.id === id ? updated : job)),
      }));
    } catch (error) {
      set({
        jobs: previous,
        error: error instanceof Error ? error.message : 'Failed to update job',
      });
      throw error;
    }
  },

  updateJobStatus: async (id, status) => {
    await get().updateJob(id, { status });
  },

  getFilteredJobs: () => {
    const state = get();
    let filtered = [...state.jobs];

    if (state.filter !== 'all') {
      filtered = filtered.filter((j) => j.status === state.filter);
    }

    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (j) =>
          j.title.toLowerCase().includes(q) ||
          j.department.toLowerCase().includes(q)
      );
    }

    return filtered;
  },
}));
