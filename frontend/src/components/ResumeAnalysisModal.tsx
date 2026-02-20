import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { Sparkles, Target, Loader2, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { matchCandidateToJob } from '@/services/api';
import { useJobsStore } from '@/store/useJobsStore';
import type { Candidate, MatchResult } from '@/types';

interface Props {
    candidate: Candidate | null;
    onClose: () => void;
}

export function ResumeAnalysisModal({ candidate, onClose }: Props) {
    const jobs = useJobsStore((s) => s.jobs);
    const loadJobs = useJobsStore((s) => s.loadJobs);
    const jobsLoaded = useJobsStore((s) => s.hasLoaded);
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
    const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
    const [isMatching, setIsMatching] = useState(false);
    const [matchError, setMatchError] = useState<string | null>(null);

    useEffect(() => {
        if (!jobsLoaded) {
            void loadJobs();
        }
    }, [jobsLoaded, loadJobs]);

    if (!candidate || !candidate.resumeAnalysis) return null;

    const analysis = candidate.resumeAnalysis;

    const handleMatch = async () => {
        if (!selectedJobId) return;
        const job = jobs.find((j) => j.id === selectedJobId);
        if (!job) return;

        setIsMatching(true);
        setMatchError(null);

        try {
            const result = await matchCandidateToJob(analysis, job);
            setMatchResult(result);
        } catch (err) {
            setMatchError(err instanceof Error ? err.message : 'Failed to match');
        } finally {
            setIsMatching(false);
        }
    };

    const getRecommendationIcon = (rec: string) => {
        switch (rec) {
            case 'Proceed': return <CheckCircle className="w-4 h-4 text-emerald-500" />;
            case 'Review manually': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
            case 'Reject': return <XCircle className="w-4 h-4 text-red-500" />;
            default: return null;
        }
    };

    const getRecommendationColor = (rec: string) => {
        switch (rec) {
            case 'Proceed': return 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300';
            case 'Review manually': return 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300';
            case 'Reject': return 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300';
            default: return '';
        }
    };

    return (
        <Dialog open={!!candidate} onOpenChange={(v) => { if (!v) { onClose(); setMatchResult(null); setSelectedJobId(null); } }}>
            <DialogContent className="sm:max-w-[560px] rounded-xl p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="bg-gradient-to-br from-violet-50 to-blue-50 dark:from-violet-950/40 dark:to-blue-950/40 px-5 pt-5 pb-3">
                    <DialogHeader>
                        <DialogTitle className="text-base font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-violet-500" />
                            AI Resume Analysis — {candidate.name} {candidate.surname}
                        </DialogTitle>
                    </DialogHeader>
                </div>

                <div className="px-5 pb-5 pt-3 space-y-4">
                    {/* Score cards */}
                    <div className="grid grid-cols-3 gap-2.5">
                        <div className="text-center p-3 rounded-xl bg-gradient-to-b from-emerald-50 to-white dark:from-emerald-900/20 dark:to-neutral-800 border border-emerald-100 dark:border-emerald-800">
                            <p className="text-[24px] font-bold text-emerald-600 dark:text-emerald-400">{analysis.overallScore}</p>
                            <p className="text-[10px] text-neutral-400 font-medium uppercase tracking-wider">Score / 10</p>
                        </div>
                        <div className="text-center p-3 rounded-xl bg-gradient-to-b from-blue-50 to-white dark:from-blue-900/20 dark:to-neutral-800 border border-blue-100 dark:border-blue-800">
                            <p className="text-[16px] font-bold text-blue-600 dark:text-blue-400 mt-1">{analysis.level}</p>
                            <p className="text-[10px] text-neutral-400 font-medium uppercase tracking-wider mt-0.5">Level</p>
                        </div>
                        <div className="text-center p-3 rounded-xl bg-gradient-to-b from-purple-50 to-white dark:from-purple-900/20 dark:to-neutral-800 border border-purple-100 dark:border-purple-800">
                            <p className="text-[24px] font-bold text-purple-600 dark:text-purple-400">{analysis.yearsOfExperience}</p>
                            <p className="text-[10px] text-neutral-400 font-medium uppercase tracking-wider">Years Exp</p>
                        </div>
                    </div>

                    {/* Summary */}
                    <div>
                        <h4 className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 mb-1.5 uppercase tracking-wider">Summary</h4>
                        <p className="text-[13px] text-neutral-700 dark:text-neutral-300 leading-relaxed">{analysis.summary}</p>
                    </div>

                    {/* Skills */}
                    <div>
                        <h4 className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 mb-1.5 uppercase tracking-wider">Key Skills</h4>
                        <div className="flex flex-wrap gap-1.5">
                            {analysis.skills.map((skill) => (
                                <span key={skill} className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                                    {skill}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Technologies */}
                    <div>
                        <h4 className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 mb-1.5 uppercase tracking-wider">Technologies</h4>
                        <div className="flex flex-wrap gap-1.5">
                            {analysis.technologies.map((tech) => (
                                <span key={tech} className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
                                    {tech}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Soft Skills */}
                    {analysis.softSkills.length > 0 && (
                        <div>
                            <h4 className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 mb-1.5 uppercase tracking-wider">Soft Skills</h4>
                            <div className="flex flex-wrap gap-1.5">
                                {analysis.softSkills.map((skill) => (
                                    <span key={skill} className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300 border border-violet-100 dark:border-violet-800">
                                        {skill}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Divider */}
                    <div className="border-t border-neutral-100 dark:border-neutral-800 pt-4">
                        <div className="flex items-center gap-1.5 mb-3">
                            <Target className="w-3.5 h-3.5 text-blue-500" />
                            <h4 className="text-[12px] font-semibold text-neutral-700 dark:text-neutral-200">Match with Job</h4>
                        </div>

                        <div className="flex gap-2">
                            <select
                                className="flex-1 h-9 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-[13px] px-3 text-neutral-700 dark:text-neutral-200 cursor-pointer"
                                value={selectedJobId || ''}
                                onChange={(e) => { setSelectedJobId(e.target.value); setMatchResult(null); }}
                            >
                                <option value="" disabled>Select a job...</option>
                                {jobs.map((job) => (
                                    <option key={job.id} value={job.id}>{job.title} — {job.department}</option>
                                ))}
                            </select>
                            <Button
                                type="button"
                                onClick={handleMatch}
                                disabled={!selectedJobId || isMatching}
                                className="rounded-lg bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-600 hover:to-violet-600 text-white text-[12px] h-9 cursor-pointer gap-1.5 px-4"
                            >
                                {isMatching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Target className="w-3.5 h-3.5" />}
                                Analyze Match
                            </Button>
                        </div>

                        {matchError && (
                            <p className="mt-2 text-[11px] text-red-500 dark:text-red-400">{matchError}</p>
                        )}
                    </div>

                    {/* Match Results */}
                    {matchResult && (
                        <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 p-4 space-y-3">
                            {/* Match % + Recommendation */}
                            <div className="flex items-center gap-3">
                                <div className="relative w-16 h-16">
                                    <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                                        <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="2" className="text-neutral-200 dark:text-neutral-700" />
                                        <circle
                                            cx="18" cy="18" r="15.5" fill="none" strokeWidth="2"
                                            strokeDasharray={`${matchResult.matchPercentage} ${100 - matchResult.matchPercentage}`}
                                            strokeLinecap="round"
                                            className={matchResult.matchPercentage >= 70 ? 'text-emerald-500' : matchResult.matchPercentage >= 40 ? 'text-amber-500' : 'text-red-500'}
                                            stroke="currentColor"
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-[14px] font-bold text-neutral-800 dark:text-neutral-100">{matchResult.matchPercentage}%</span>
                                    </div>
                                </div>

                                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${getRecommendationColor(matchResult.recommendation)}`}>
                                    {getRecommendationIcon(matchResult.recommendation)}
                                    <span className="text-[12px] font-semibold">{matchResult.recommendation}</span>
                                </div>
                            </div>

                            {/* Strengths */}
                            {matchResult.strengths.length > 0 && (
                                <div>
                                    <h5 className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mb-1 uppercase tracking-wider">Strengths</h5>
                                    <ul className="space-y-0.5">
                                        {matchResult.strengths.map((s, i) => (
                                            <li key={i} className="text-[12px] text-neutral-600 dark:text-neutral-300 flex items-start gap-1.5">
                                                <span className="text-emerald-400 mt-0.5">✓</span> {s}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Gaps */}
                            {matchResult.gaps.length > 0 && (
                                <div>
                                    <h5 className="text-[11px] font-semibold text-red-600 dark:text-red-400 mb-1 uppercase tracking-wider">Gaps</h5>
                                    <ul className="space-y-0.5">
                                        {matchResult.gaps.map((g, i) => (
                                            <li key={i} className="text-[12px] text-neutral-600 dark:text-neutral-300 flex items-start gap-1.5">
                                                <span className="text-red-400 mt-0.5">✗</span> {g}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
