import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  rectIntersection,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { Column } from './Column';
import { CandidateCard } from './CandidateCard';
import { AddCandidateModal } from './AddCandidateModal';
import { ResumeAnalysisModal } from './ResumeAnalysisModal';
import { CandidateDrawer } from './CandidateDrawer';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { fetchTrashCandidates, restoreCandidateFromTrash } from '@/services/api';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useBoardStore } from '@/store/useBoardStore';
import { useJobsStore } from '@/store/useJobsStore';
import { useThemeStore } from '@/store/useThemeStore';
import { useLayoutStore } from '@/store/useLayoutStore';
import { Search, LayoutGrid, Sun, Moon, PanelLeft, Trash2 } from 'lucide-react';
import type { Candidate, ColumnStatus } from '@/types';

const columns: { id: ColumnStatus; title: string; dotColor: string }[] = [
  { id: 'New', title: 'New', dotColor: 'green' },
  { id: 'Screening', title: 'Screening', dotColor: 'blue' },
  { id: 'Interview', title: 'Interview', dotColor: 'pink' },
  { id: 'Test Task', title: 'Test Task', dotColor: 'orange' },
  { id: 'Offer', title: 'Offer', dotColor: 'purple' },
  { id: 'Hired', title: 'Hired', dotColor: 'emerald' },
];

const REJECT_DROP_ID = 'reject-dropzone';

const columnIndex = new Map<ColumnStatus, number>(columns.map((c, i) => [c.id, i]));

function isMoveAllowed(from: ColumnStatus, to: ColumnStatus): boolean {
  const fromIdx = columnIndex.get(from);
  const toIdx = columnIndex.get(to);
  if (fromIdx === undefined || toIdx === undefined) return false;
  return Math.abs(toIdx - fromIdx) === 1;
}

function parseSelectedJobValue(value: string): { vacancyId: string; title: string } | null {
  if (!value.startsWith('job|')) return null;
  const [, vacancyId, ...titleParts] = value.split('|');
  if (!vacancyId) return null;
  return { vacancyId, title: titleParts.join('|') };
}

function canScrollColumnVertically(element: HTMLElement, deltaY: number): boolean {
  if (element.scrollHeight <= element.clientHeight) return false;
  if (deltaY < 0) return element.scrollTop > 0;
  if (deltaY > 0) return element.scrollTop + element.clientHeight < element.scrollHeight;
  return false;
}

function RejectDropZone({ isActive }: { isActive: boolean }) {
  const { setNodeRef, isOver } = useDroppable({
    id: REJECT_DROP_ID,
    data: { type: 'reject-zone' },
  });

  if (!isActive) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] pointer-events-none">
      <div
        ref={setNodeRef}
        className={`pointer-events-auto flex items-center gap-2 rounded-2xl px-6 py-3 shadow-xl border transition-all duration-200 ${
          isOver
            ? 'bg-red-600 border-red-400 text-white scale-105'
            : 'bg-red-500/95 border-red-400/70 text-white'
        }`}
      >
        <Trash2 className="w-4 h-4" />
        <span className="text-sm font-semibold">
          {isOver ? 'Release to reject candidate' : 'Drop here to reject'}
        </span>
      </div>
    </div>
  );
}

export function Board() {
  const {
    searchQuery,
    setSearchQuery,
    selectedJob,
    setSelectedJob,
    sortBy,
    setSortBy,
    moveCandidate,
    setCandidateStatus,
    getCandidatesByStatus,
    candidates,
    loadCandidates,
    isLoading,
    error,
    hasLoaded,
  } = useBoardStore();

  const { jobs, loadJobs, hasLoaded: jobsLoaded } = useJobsStore();
  const { theme, toggleTheme } = useThemeStore();
  const { isSidebarCollapsed, toggleSidebar } = useLayoutStore();

  const [activeCandidate, setActiveCandidate] = useState<Candidate | null>(null);
  const [analysisCandidate, setAnalysisCandidate] = useState<Candidate | null>(null);
  const [profileCandidate, setProfileCandidate] = useState<Candidate | null>(null);
  const [candidateToReject, setCandidateToReject] = useState<Candidate | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [trashCandidates, setTrashCandidates] = useState<Candidate[]>([]);
  const [trashRetentionDays, setTrashRetentionDays] = useState(60);
  const [trashOpen, setTrashOpen] = useState(false);
  const [isTrashLoading, setIsTrashLoading] = useState(false);
  const [isRestoringId, setIsRestoringId] = useState<string | null>(null);
  const [trashError, setTrashError] = useState('');
  const kanbanRef = useRef<HTMLDivElement>(null);
  const jobOptions = useMemo(() => jobs.map((job) => ({ id: job.id, title: job.title, department: job.department })), [jobs]);
  const legacyPositionOptions = useMemo(() => {
    const linkedTitles = new Set(jobs.map((job) => job.title));
    return Array.from(
      new Set(
        candidates
          .filter((candidate) => !candidate.vacancyId && candidate.position)
          .map((candidate) => candidate.position)
          .filter((position) => !linkedTitles.has(position))
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [candidates, jobs]);
  const selectedJobInfo = useMemo(
    () => {
      const parsed = parseSelectedJobValue(selectedJob);
      if (!parsed) return null;
      return jobs.find((job) => job.id === parsed.vacancyId) || null;
    },
    [jobs, selectedJob]
  );
  const selectedJobCandidatesCount = useMemo(
    () => {
      if (selectedJob === 'all') return candidates.length;

      const parsed = parseSelectedJobValue(selectedJob);
      if (parsed) {
        return candidates.filter(
          (candidate) =>
            candidate.vacancyId === parsed.vacancyId ||
            (!candidate.vacancyId && candidate.position === parsed.title)
        ).length;
      }

      if (selectedJob.startsWith('legacy:')) {
        const legacyPosition = selectedJob.slice('legacy:'.length);
        return candidates.filter((candidate) => !candidate.vacancyId && candidate.position === legacyPosition).length;
      }

      return candidates.filter(
        (candidate) =>
          candidate.vacancyId === selectedJob ||
          (!candidate.vacancyId && selectedJobInfo?.title && candidate.position === selectedJobInfo.title)
      ).length;
    },
    [candidates, selectedJob, selectedJobInfo]
  );

  useEffect(() => {
    if (!hasLoaded) {
      void loadCandidates();
    }
  }, [hasLoaded, loadCandidates]);

  useEffect(() => {
    if (!jobsLoaded) {
      void loadJobs();
    }
  }, [jobsLoaded, loadJobs]);

  const loadTrash = useCallback(async () => {
    setIsTrashLoading(true);
    setTrashError('');
    try {
      const result = await fetchTrashCandidates();
      setTrashCandidates(result.items || []);
      setTrashRetentionDays(result.retentionDays || 60);
    } catch (nextError) {
      setTrashError(nextError instanceof Error ? nextError.message : 'Failed to load trash');
    } finally {
      setIsTrashLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasLoaded) {
      void loadTrash();
    }
  }, [hasLoaded, loadTrash]);

  useEffect(() => {
    const el = kanbanRef.current;
    if (!el) return;

    const handler = (e: WheelEvent) => {
      const target = e.target;
      if (target instanceof HTMLElement) {
        const columnScroll = target.closest('[data-column-scroll="true"]');
        if (
          columnScroll instanceof HTMLElement &&
          canScrollColumnVertically(columnScroll, e.deltaY)
        ) {
          return;
        }
      }

      if (el.scrollWidth > el.clientWidth) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };

    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [hasLoaded]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  useEffect(() => {
    if (activeCandidate) {
      const style = document.createElement('style');
      style.id = 'drag-cursor-override';
      style.textContent = `*, *::before, *::after { cursor: grabbing !important; }`;
      document.head.appendChild(style);
    } else {
      const existing = document.getElementById('drag-cursor-override');
      if (existing) existing.remove();
    }

    return () => {
      const existing = document.getElementById('drag-cursor-override');
      if (existing) existing.remove();
    };
  }, [activeCandidate]);

  const findColumnForOver = useCallback(
    (overId: string | number): ColumnStatus | null => {
      const id = String(overId);

      if (columnIndex.has(id as ColumnStatus)) {
        return id as ColumnStatus;
      }

      const cand = candidates.find((c) => c.id === id);
      return cand ? cand.status : null;
    },
    [candidates]
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const candidate = candidates.find((c) => c.id === String(event.active.id));
      if (candidate) setActiveCandidate(candidate);
    },
    [candidates]
  );

  const handleDragOver = useCallback(() => undefined, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveCandidate(null);
      if (!over) return;

      const activeId = String(active.id);
      const activeCand = candidates.find((c) => c.id === activeId);
      if (!activeCand) return;

      if (String(over.id) === REJECT_DROP_ID) {
        if (activeCand.status !== 'Rejected') {
          setCandidateToReject(activeCand);
        }
        return;
      }

      const overColumn = findColumnForOver(over.id);
      if (!overColumn) return;

      if (activeCand.status !== overColumn && isMoveAllowed(activeCand.status, overColumn)) {
        try {
          await moveCandidate(activeId, overColumn);
        } catch (nextError) {
          console.error('Failed to move candidate:', nextError);
        }
      }
    },
    [candidates, findColumnForOver, moveCandidate]
  );

  const handleOpenProfile = useCallback((candidate: Candidate) => {
    setProfileCandidate(candidate);
  }, []);

  const handleAdvance = useCallback(
    async (candidate: Candidate) => {
      const index = columns.findIndex((c) => c.id === candidate.status);
      if (index < 0) return;
      if (candidate.status === 'Hired' || candidate.status === 'Rejected') return;

      const nextStatus = columns[index + 1]?.id;
      if (!nextStatus) return;

      try {
        await setCandidateStatus(candidate.id, nextStatus);
      } catch (nextError) {
        console.error('Failed to advance candidate:', nextError);
      }
    },
    [setCandidateStatus]
  );

  const handleConfirmReject = useCallback(async () => {
    if (!candidateToReject || isRejecting) return;
    if (!rejectReason.trim()) {
      return;
    }

    setIsRejecting(true);
    try {
      await setCandidateStatus(candidateToReject.id, 'Rejected', {
        rejectionReason: rejectReason.trim(),
        comment: 'Rejected from board trash drop zone',
      });
      setCandidateToReject(null);
      setRejectReason('');
      await Promise.all([loadCandidates(), loadTrash()]);
    } catch (nextError) {
      console.error('Failed to reject candidate:', nextError);
    } finally {
      setIsRejecting(false);
    }
  }, [candidateToReject, isRejecting, loadCandidates, loadTrash, rejectReason, setCandidateStatus]);

  const handleCancelReject = useCallback(() => {
    if (isRejecting) return;
    setCandidateToReject(null);
    setRejectReason('');
  }, [isRejecting]);

  const handleRestoreCandidate = useCallback(async (candidateId: string) => {
    setIsRestoringId(candidateId);
    setTrashError('');
    try {
      await restoreCandidateFromTrash(candidateId, 'New');
      await Promise.all([loadCandidates(), loadTrash()]);
    } catch (nextError) {
      setTrashError(nextError instanceof Error ? nextError.message : 'Failed to restore candidate');
    } finally {
      setIsRestoringId(null);
    }
  }, [loadCandidates, loadTrash]);

  return (
    <div className="flex-1 flex flex-col h-screen max-h-screen overflow-hidden bg-neutral-50 dark:bg-neutral-950 transition-colors duration-300">
      <header className="shrink-0 bg-white dark:bg-neutral-900 border-b border-neutral-100 dark:border-neutral-800 px-6 py-4 transition-colors duration-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button
              onClick={toggleSidebar}
              className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all duration-300 cursor-pointer"
              title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <PanelLeft className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />
            </button>

            <div className="p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800">
              <LayoutGrid className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
            </div>
            <h1 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Board</h1>
          </div>

          <button
            onClick={toggleTheme}
            className="relative p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all duration-300 cursor-pointer"
          >
            <Sun
              className={`w-4 h-4 text-amber-500 transition-all duration-300 ${
                theme === 'light' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-0'
              } absolute top-2 left-2`}
            />
            <Moon
              className={`w-4 h-4 text-blue-400 transition-all duration-300 ${
                theme === 'dark' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-0'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between mt-4 gap-4">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 dark:text-neutral-500" />
            <Input
              placeholder="Search candidates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 rounded-lg"
            />
          </div>

          <div className="flex items-center gap-2.5">
            <AddCandidateModal />

            <Button
              type="button"
              variant="outline"
              className="h-9 px-3"
              onClick={() => {
                setTrashOpen(true);
                void loadTrash();
              }}
            >
              Trash ({trashCandidates.length})
            </Button>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[120px] h-9">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="progress">Progress</SelectItem>
                <SelectItem value="deadline">Deadline</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <div className="flex-1 p-5 overflow-hidden">
        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 text-red-600 px-3 py-2 text-[12px]">
            {error}
          </div>
        )}

        {isLoading && !hasLoaded ? (
          <div className="text-[13px] text-neutral-500">Loading candidates...</div>
        ) : (
          <div className="h-full flex flex-col gap-3">
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white/90 dark:bg-neutral-900/80 px-3.5 py-2.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-[12px] font-medium text-neutral-500 dark:text-neutral-400">
                  Vacancy for funnel:
                </span>
                <Select value={selectedJob} onValueChange={setSelectedJob}>
                  <SelectTrigger className="w-[220px] h-9">
                    <SelectValue placeholder="Select vacancy" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Vacancies</SelectItem>
                    {jobOptions.map((job) => (
                      <SelectItem key={job.id} value={`job|${job.id}|${job.title}`}>
                        {job.title}
                      </SelectItem>
                    ))}
                    {legacyPositionOptions.map((position) => (
                      <SelectItem key={`legacy:${position}`} value={`legacy:${position}`}>
                        {position} (legacy)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="text-[12px] text-neutral-500 dark:text-neutral-400">
                {selectedJob === 'all'
                  ? `${selectedJobCandidatesCount} candidates total`
                  : `${selectedJobCandidatesCount} candidates${
                      selectedJobInfo ? ` - ${selectedJobInfo.department}` : ''
                    }`}
              </div>
            </div>

            <div ref={kanbanRef} className="kanban-scroll flex-1">
              <DndContext
                sensors={sensors}
                collisionDetection={rectIntersection}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
              >
                <div className="flex gap-5 min-w-max h-full">
                  {columns.map((col) => (
                    <Column
                      key={col.id}
                      id={col.id}
                      title={col.title}
                      dotColor={col.dotColor}
                      candidates={getCandidatesByStatus(col.id)}
                      onViewAnalysis={setAnalysisCandidate}
                      onOpenProfile={handleOpenProfile}
                      onAdvance={handleAdvance}
                    />
                  ))}
                </div>

                <RejectDropZone isActive={Boolean(activeCandidate)} />

                <DragOverlay dropAnimation={null}>
                  {activeCandidate && (
                    <div className="shadow-xl rounded-xl rotate-2 scale-105">
                      <CandidateCard candidate={activeCandidate} isOverlay />
                    </div>
                  )}
                </DragOverlay>
              </DndContext>
            </div>
          </div>
        )}
      </div>

      <ResumeAnalysisModal candidate={analysisCandidate} onClose={() => setAnalysisCandidate(null)} />

      <CandidateDrawer
        candidate={profileCandidate}
        onClose={() => setProfileCandidate(null)}
        onSaved={() => {
          setProfileCandidate(null);
          void loadCandidates();
        }}
      />

      <Dialog
        open={Boolean(candidateToReject)}
        onOpenChange={(open) => {
          if (!open) {
            handleCancelReject();
          }
        }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Reject candidate?</DialogTitle>
            <DialogDescription>
              {candidateToReject
                ? `Move ${candidateToReject.name} ${candidateToReject.surname} to rejected status?`
                : 'Move selected candidate to rejected status?'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
              Rejection reason *
            </label>
            <Input
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="e.g. Missing required experience"
              disabled={isRejecting}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCancelReject} disabled={isRejecting}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleConfirmReject()}
              disabled={isRejecting || !rejectReason.trim()}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isRejecting ? 'Rejecting...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={trashOpen}
        onOpenChange={(open) => {
          setTrashOpen(open);
          if (open) {
            void loadTrash();
          }
        }}
      >
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>Trash</DialogTitle>
            <DialogDescription>
              Rejected candidates are auto-deleted after {trashRetentionDays} days.
            </DialogDescription>
          </DialogHeader>

          {trashError && (
            <p className="text-sm text-red-500">{trashError}</p>
          )}

          <div className="max-h-[420px] overflow-auto rounded-md border border-neutral-200 dark:border-neutral-800">
            {isTrashLoading ? (
              <p className="p-4 text-sm text-neutral-500">Loading trash...</p>
            ) : trashCandidates.length === 0 ? (
              <p className="p-4 text-sm text-neutral-500">Trash is empty.</p>
            ) : (
              <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {trashCandidates.map((candidate) => (
                  <div key={candidate.id} className="p-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                        {candidate.name} {candidate.surname}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                        {candidate.position || 'No position'}
                      </p>
                      {candidate.rejectionReason && (
                        <p className="text-xs text-red-500 dark:text-red-400 truncate">
                          Reason: {candidate.rejectionReason}
                        </p>
                      )}
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        Delete after:{' '}
                        {candidate.trashDeleteAfter
                          ? new Date(candidate.trashDeleteAfter).toLocaleDateString()
                          : 'n/a'}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void handleRestoreCandidate(candidate.id)}
                      disabled={isRestoringId === candidate.id}
                    >
                      {isRestoringId === candidate.id ? 'Restoring...' : 'Restore'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
