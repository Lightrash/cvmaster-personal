import { useEffect, useMemo } from 'react';
import { Users, Briefcase, UserCheck, BarChart3 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { useBoardStore } from '@/store/useBoardStore';
import { useJobsStore } from '@/store/useJobsStore';
import type { ColumnStatus } from '@/types';

const FUNNEL_ORDER: ColumnStatus[] = ['New', 'Screening', 'Interview', 'Test Task', 'Offer', 'Hired'];

export function DashboardPage() {
  const {
    candidates,
    loadCandidates,
    hasLoaded: candidatesLoaded,
    isLoading: candidatesLoading,
  } = useBoardStore();
  const {
    jobs,
    loadJobs,
    hasLoaded: jobsLoaded,
    isLoading: jobsLoading,
  } = useJobsStore();

  useEffect(() => {
    if (!candidatesLoaded) {
      void loadCandidates();
    }
  }, [candidatesLoaded, loadCandidates]);

  useEffect(() => {
    if (!jobsLoaded) {
      void loadJobs();
    }
  }, [jobsLoaded, loadJobs]);

  const stats = useMemo(() => {
    const totalCandidates = candidates.length;
    const openJobs = jobs.filter((job) => job.status === 'Active').length;
    const hiredCount = candidates.filter((candidate) => candidate.status === 'Hired').length;
    return { totalCandidates, openJobs, hiredCount };
  }, [candidates, jobs]);

  const funnel = useMemo(
    () =>
      FUNNEL_ORDER.map((status) => ({
        status,
        count: candidates.filter((candidate) => candidate.status === status).length,
      })),
    [candidates]
  );

  const maxFunnelCount = Math.max(1, ...funnel.map((item) => item.count));

  const topTechnologies = useMemo(() => {
    const counts = new Map<string, number>();

    for (const candidate of candidates) {
      const technologies = candidate.resumeAnalysis?.technologies || [];
      for (const tech of technologies) {
        const key = tech.trim();
        if (!key) continue;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }

    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [candidates]);

  const recentCandidates = useMemo(() => candidates.slice(0, 4), [candidates]);
  const isLoading = candidatesLoading || jobsLoading;

  return (
    <div className="flex-1 flex flex-col h-screen max-h-screen overflow-hidden bg-neutral-50 dark:bg-neutral-950 transition-colors duration-300">
      <PageHeader
        title="Dashboard"
        subtitle="Overview of candidates, jobs and funnel health"
        icon={<BarChart3 className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />}
      />

      <div className="flex-1 min-h-0 p-4 lg:p-5 overflow-y-auto lg:overflow-hidden">
        <div className="h-full min-h-[620px] lg:min-h-0 grid grid-rows-[auto_minmax(0,1fr)_minmax(0,0.9fr)] gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <section className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 p-3.5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-wide text-neutral-500">Total Candidates</p>
                <Users className="w-4 h-4 text-blue-500" />
              </div>
              <p className="text-2xl font-bold mt-1.5">{stats.totalCandidates}</p>
            </section>

            <section className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 p-3.5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-wide text-neutral-500">Open Jobs</p>
                <Briefcase className="w-4 h-4 text-violet-500" />
              </div>
              <p className="text-2xl font-bold mt-1.5">{stats.openJobs}</p>
            </section>

            <section className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 p-3.5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-wide text-neutral-500">Hired</p>
                <UserCheck className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-2xl font-bold mt-1.5">{stats.hiredCount}</p>
            </section>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)] gap-4 min-h-0">
            <section className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 p-4 flex flex-col min-h-0">
              <h3 className="text-[14px] font-semibold">Hiring Funnel</h3>
              <p className="text-[12px] text-neutral-500 mt-0.5">Current candidates by stage</p>

              <div className="mt-3 flex-1 min-h-[170px] grid grid-cols-6 gap-2.5 items-end">
                {funnel.map((item) => (
                  <div key={item.status} className="h-full flex flex-col items-center justify-end gap-1.5">
                    <span className="text-[11px] text-neutral-500">{item.count}</span>
                    <div
                      className="w-full rounded-md bg-blue-500/90"
                      style={{ height: `${Math.max(8, (item.count / maxFunnelCount) * 100)}%` }}
                    />
                    <span className="text-[10px] text-neutral-400 text-center leading-tight">{item.status}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 p-4 flex flex-col min-h-0">
              <h3 className="text-[14px] font-semibold">Top Technologies</h3>
              <p className="text-[12px] text-neutral-500 mt-0.5">Most common in AI analyses</p>

              <div className="mt-3 space-y-2 overflow-auto pr-1">
                {topTechnologies.length === 0 ? (
                  <p className="text-[12px] text-neutral-500">No data yet</p>
                ) : (
                  topTechnologies.map(([tech, count], index) => (
                    <div key={tech} className="flex items-center justify-between text-[12px]">
                      <span className="text-neutral-600 dark:text-neutral-300">
                        {index + 1}. {tech}
                      </span>
                      <span className="font-semibold text-blue-600 dark:text-blue-400">{count}</span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          <section className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 overflow-hidden min-h-0 flex flex-col">
            <div className="px-4 py-2.5 border-b border-neutral-100 dark:border-neutral-800">
              <h3 className="text-[14px] font-semibold">Recent Candidates</h3>
            </div>

            {isLoading ? (
              <div className="px-4 py-5 text-[12px] text-neutral-500">Loading...</div>
            ) : recentCandidates.length === 0 ? (
              <div className="px-4 py-5 text-[12px] text-neutral-500">No candidates yet</div>
            ) : (
              <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {recentCandidates.map((candidate) => (
                  <div key={candidate.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium truncate">
                        {candidate.name} {candidate.surname}
                      </p>
                      <p className="text-[11px] text-neutral-500 truncate">{candidate.email || 'No email'}</p>
                    </div>
                    <div className="text-[12px] text-neutral-600 dark:text-neutral-300">{candidate.position || '-'}</div>
                    <div className="text-[12px] text-neutral-600 dark:text-neutral-300">{candidate.status}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
