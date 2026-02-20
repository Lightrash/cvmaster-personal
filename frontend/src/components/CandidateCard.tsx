import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { RefreshCw, Calendar, FileText, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Candidate } from '@/types';

interface CandidateCardProps {
    candidate: Candidate;
    onViewAnalysis?: (candidate: Candidate) => void;
    isOverlay?: boolean;
}

export function CandidateCard({ candidate, onViewAnalysis, isOverlay }: CandidateCardProps) {
    const navigate = useNavigate();
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: candidate.id,
        data: {
            type: 'candidate',
            candidate,
        },
    });

    // Якщо це overlay — не застосовуємо transform від sortable
    const style: React.CSSProperties = isOverlay
        ? { cursor: 'grabbing' }
        : {
            transform: CSS.Transform.toString(transform),
            transition,
            touchAction: 'none',
            cursor: isDragging ? 'grabbing' : 'grab',
        };

    // Якщо картка перетягується — показуємо порожній placeholder
    if (isDragging && !isOverlay) {
        return (
            <div
                ref={setNodeRef}
                style={style}
                className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border-2 border-dashed border-neutral-200 dark:border-neutral-700 p-3 h-[88px]"
            />
        );
    }

    return (
        <div
            ref={isOverlay ? undefined : setNodeRef}
            {...(isOverlay ? {} : attributes)}
            {...(isOverlay ? {} : listeners)}
            style={style}
            className="candidate-card group relative bg-white dark:bg-neutral-800 rounded-xl border border-neutral-100 dark:border-neutral-700 p-3 shadow-sm hover:shadow-md transition-shadow duration-200 select-none"
        >
            {!isOverlay && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        navigate(`/candidate/${candidate.id}`);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="absolute top-2 right-2 z-10 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all"
                    style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                    title="Open profile"
                >
                    <ExternalLink className="w-3 h-3 text-neutral-400" />
                </button>
            )}
            <div className="flex items-center gap-2.5 pointer-events-none">
                <Avatar className="w-9 h-9 shrink-0">
                    <AvatarImage src={candidate.avatar} alt={`${candidate.name} ${candidate.surname}`} />
                    <AvatarFallback className="bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 text-xs font-medium">
                        {candidate.name[0]}{candidate.surname[0]}
                    </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100 truncate leading-tight">
                        {candidate.name} {candidate.surname}
                    </p>
                    <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5 leading-tight">{candidate.position}</p>
                </div>
            </div>

            {/* AI Analysis badge */}
            {candidate.resumeAnalysis && (
                <div className="mt-2 flex items-center gap-1.5 pointer-events-none">
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800">
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            AI: {candidate.resumeAnalysis.overallScore}/10
                        </span>
                    </div>
                    <div className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
                        <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                            {candidate.resumeAnalysis.level}
                        </span>
                    </div>
                    {onViewAnalysis && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                onViewAnalysis(candidate);
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                            className="ml-auto p-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                            style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                            title="View analysis"
                        >
                            <FileText className="w-3 h-3 text-neutral-400" />
                        </button>
                    )}
                </div>
            )}

            <div className="flex items-center gap-3.5 mt-2.5 pt-2 border-t border-neutral-50 dark:border-neutral-700/50 pointer-events-none">
                <div className="flex items-center gap-1 text-[11px] text-neutral-400 dark:text-neutral-500">
                    <RefreshCw className="w-3 h-3" />
                    <span className="font-medium text-neutral-500 dark:text-neutral-400">{candidate.progress}%</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-neutral-400 dark:text-neutral-500">
                    <Calendar className="w-3 h-3" />
                    <span className="font-medium text-neutral-500 dark:text-neutral-400">{candidate.deadline}</span>
                </div>
            </div>
        </div>
    );
}
