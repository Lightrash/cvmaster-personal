import { useState, useEffect, useRef, useCallback } from 'react';
import {
    DndContext,
    DragOverlay,
    PointerSensor,
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
import { Input } from '@/components/ui/input';
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
import { Search, LayoutGrid, Sun, Moon } from 'lucide-react';
import type { Candidate, ColumnStatus } from '@/types';

const columns: { id: ColumnStatus; title: string; dotColor: string }[] = [
    { id: 'New', title: 'New', dotColor: 'green' },
    { id: 'Screening', title: 'Screening', dotColor: 'blue' },
    { id: 'Interview', title: 'Interview', dotColor: 'pink' },
    { id: 'Test Task', title: 'Test Task', dotColor: 'orange' },
    { id: 'Offer', title: 'Offer', dotColor: 'purple' },
    { id: 'Hired', title: 'Hired', dotColor: 'emerald' },
    { id: 'Rejected', title: 'Rejected', dotColor: 'red' },
];

const columnIndex = new Map<ColumnStatus, number>(
    columns.map((c, i) => [c.id, i])
);

function isMoveAllowed(from: ColumnStatus, to: ColumnStatus): boolean {
    const fromIdx = columnIndex.get(from);
    const toIdx = columnIndex.get(to);
    if (fromIdx === undefined || toIdx === undefined) return false;
    return Math.abs(toIdx - fromIdx) === 1;
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
        getCandidatesByStatus,
        candidates,
        loadCandidates,
        hasLoaded,
    } = useBoardStore();
    const { jobs, loadJobs, hasLoaded: jobsLoaded } = useJobsStore();

    const { theme, toggleTheme } = useThemeStore();

    const [activeCandidate, setActiveCandidate] = useState<Candidate | null>(null);
    const [analysisCandidate, setAnalysisCandidate] = useState<Candidate | null>(null);
    const kanbanRef = useRef<HTMLDivElement>(null);
    const jobOptions = Array.from(new Set(jobs.map((job) => job.title)));

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

    // Horizontal scroll
    useEffect(() => {
        const el = kanbanRef.current;
        if (!el) return;

        const handler = (e: WheelEvent) => {
            if (el.scrollWidth > el.clientWidth) {
                e.preventDefault();
                el.scrollLeft += e.deltaY;
            }
        };

        el.addEventListener('wheel', handler, { passive: false });
        return () => el.removeEventListener('wheel', handler);
    }, []);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 },
        })
    );

    // Cursor override during drag
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
            const candidate = candidates.find(
                (c) => c.id === String(event.active.id)
            );
            if (candidate) setActiveCandidate(candidate);
        },
        [candidates]
    );

    // ❗ НІЧОГО НЕ РОБИМО ТУТ
    const handleDragOver = useCallback(() => {
        return;
    }, []);

    const handleDragEnd = useCallback(
        async (event: DragEndEvent) => {
            const { active, over } = event;

            setActiveCandidate(null);

            if (!over) return;

            const activeId = String(active.id);
            const activeCand = candidates.find((c) => c.id === activeId);
            if (!activeCand) return;

            const overColumn = findColumnForOver(over.id);
            if (!overColumn) return;

            if (
                activeCand.status !== overColumn &&
                isMoveAllowed(activeCand.status, overColumn)
            ) {
                try {
                    await moveCandidate(activeId, overColumn);
                } catch (error) {
                    console.error('Failed to move candidate:', error);
                }
            }
        },
        [candidates, findColumnForOver, moveCandidate]
    );

    return (
        <div className="flex-1 flex flex-col h-screen max-h-screen overflow-hidden bg-neutral-50 dark:bg-neutral-950 transition-colors duration-300">
            <header className="shrink-0 bg-white dark:bg-neutral-900 border-b border-neutral-100 dark:border-neutral-800 px-6 py-4 transition-colors duration-300">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800">
                            <LayoutGrid className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
                        </div>
                        <h1 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                            Home
                        </h1>
                    </div>

                    <button
                        onClick={toggleTheme}
                        className="relative p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all duration-300 cursor-pointer"
                    >
                        <Sun className={`w-4 h-4 text-amber-500 transition-all duration-300 ${theme === 'light' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-0'} absolute top-2 left-2`} />
                        <Moon className={`w-4 h-4 text-blue-400 transition-all duration-300 ${theme === 'dark' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-0'}`} />
                    </button>
                </div>

                <div className="flex items-center justify-between mt-4 gap-4">
                    <div className="relative flex-1 max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 dark:text-neutral-500" />
                        <Input
                            placeholder="Search option..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 h-9 rounded-lg"
                        />
                    </div>

                    <div className="flex items-center gap-2.5">
                        <AddCandidateModal />

                        <Select value={selectedJob} onValueChange={setSelectedJob}>
                            <SelectTrigger className="w-[140px] h-9">
                                <SelectValue placeholder="Select job..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Jobs</SelectItem>
                                {jobOptions.map((jobTitle) => (
                                    <SelectItem key={jobTitle} value={jobTitle}>
                                        {jobTitle}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={sortBy} onValueChange={setSortBy}>
                            <SelectTrigger className="w-[110px] h-9">
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

            <div ref={kanbanRef} className="kanban-scroll flex-1 p-5">
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
                            />
                        ))}
                    </div>

                    <DragOverlay dropAnimation={null}>
                        {activeCandidate && (
                            <div className="shadow-xl rounded-xl rotate-2 scale-105">
                                <CandidateCard
                                    candidate={activeCandidate}
                                    isOverlay
                                />
                            </div>
                        )}
                    </DragOverlay>
                </DndContext>
            </div>

            <ResumeAnalysisModal
                candidate={analysisCandidate}
                onClose={() => setAnalysisCandidate(null)}
            />
        </div>
    );
}
