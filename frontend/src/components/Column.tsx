import { useDroppable } from '@dnd-kit/core';
import {
    SortableContext,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CandidateCard } from './CandidateCard';
import { MoreVertical } from 'lucide-react';
import type { Candidate, ColumnStatus } from '@/types';

interface ColumnProps {
    id: ColumnStatus;
    title: string;
    dotColor: string;
    candidates: Candidate[];
    onViewAnalysis?: (candidate: Candidate) => void;
}

const dotColorMap: Record<string, string> = {
    green: 'bg-emerald-400',
    blue: 'bg-blue-400',
    pink: 'bg-pink-400',
    orange: 'bg-orange-400',
    purple: 'bg-purple-400',
    emerald: 'bg-emerald-500',
    red: 'bg-red-400',
};

export function Column({ id, title, dotColor, candidates, onViewAnalysis }: ColumnProps) {
    const { setNodeRef, isOver } = useDroppable({
        id,
        data: {
            type: 'column',
            status: id,
        },
    });

    const isEmpty = candidates.length === 0;

    return (
        <div className="flex flex-col w-[260px] min-w-[260px]">
            {/* Column header */}
            <div className="flex items-center justify-between mb-3 px-0.5">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${dotColorMap[dotColor]}`} />
                    <h3 className="text-[13px] font-semibold text-neutral-800 dark:text-neutral-200">{title}</h3>
                    <span className="text-[12px] font-medium text-neutral-400 dark:text-neutral-500">
                        {candidates.length}
                    </span>
                </div>
                <button className="p-0.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer">
                    <MoreVertical className="w-4 h-4 text-neutral-400 dark:text-neutral-500" />
                </button>
            </div>

            {/* Column body — droppable area */}
            <div
                ref={setNodeRef}
                className={`flex-1 min-h-[200px] rounded-xl p-1.5 transition-all duration-200 ${isOver
                        ? 'bg-neutral-100/60 dark:bg-neutral-800/40'
                        : ''
                    }`}
            >
                <SortableContext
                    items={candidates.map((c) => c.id)}
                    strategy={verticalListSortingStrategy}
                >
                    <div className="flex flex-col gap-2.5">
                        {candidates.map((candidate) => (
                            <CandidateCard
                                key={candidate.id}
                                candidate={candidate}
                                onViewAnalysis={onViewAnalysis}
                            />
                        ))}
                    </div>
                </SortableContext>

                {/* Empty state */}
                {isEmpty && (
                    <div className="flex flex-col items-center justify-center py-10 px-4 border-2 border-dashed border-neutral-200 dark:border-neutral-700 rounded-xl bg-white/50 dark:bg-neutral-800/30">
                        <p className="text-[13px] font-medium text-neutral-400 dark:text-neutral-500 text-center">
                            No candidate yet
                        </p>
                        <p className="text-[11px] text-neutral-300 dark:text-neutral-600 text-center mt-1 leading-relaxed">
                            Drag and drop between
                            <br />
                            the current stages
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
