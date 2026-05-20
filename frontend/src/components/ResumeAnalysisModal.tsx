import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { Sparkles, Target, Loader2 } from 'lucide-react';
import { matchCandidateToJob } from '@/services/api';
import { useJobsStore } from '@/store/useJobsStore';
import type { Candidate, MatchResult } from '@/types';
import { MatchResultPanel } from '@/components/match/MatchResultPanel';
import { translateCandidateLevel, translateDepartment } from '@/lib/uiText';

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
      setMatchError(err instanceof Error ? err.message : 'Не вдалося виконати оцінювання');
    } finally {
      setIsMatching(false);
    }
  };

  return (
    <Dialog open={!!candidate} onOpenChange={(v) => { if (!v) { onClose(); setMatchResult(null); setSelectedJobId(null); } }}>
      <DialogContent className="sm:max-w-[560px] rounded-xl p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="bg-gradient-to-br from-violet-50 to-blue-50 dark:from-violet-950/40 dark:to-blue-950/40 px-5 pt-5 pb-3">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-500" />
              Аналіз резюме: {candidate.name} {candidate.surname}
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="px-5 pb-5 pt-3 space-y-4">
          <div className="grid grid-cols-3 gap-2.5">
            <div className="text-center p-3 rounded-xl bg-gradient-to-b from-emerald-50 to-white dark:from-emerald-900/20 dark:to-neutral-800 border border-emerald-100 dark:border-emerald-800">
              <p className="text-[24px] font-bold text-emerald-600 dark:text-emerald-400">{analysis.overallScore}</p>
              <p className="text-[10px] text-neutral-400 font-medium uppercase tracking-wider">Оцінка / 10</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-gradient-to-b from-blue-50 to-white dark:from-blue-900/20 dark:to-neutral-800 border border-blue-100 dark:border-blue-800">
              <p className="text-[16px] font-bold text-blue-600 dark:text-blue-400 mt-1">{translateCandidateLevel(analysis.level)}</p>
              <p className="text-[10px] text-neutral-400 font-medium uppercase tracking-wider mt-0.5">Рівень</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-gradient-to-b from-purple-50 to-white dark:from-purple-900/20 dark:to-neutral-800 border border-purple-100 dark:border-purple-800">
              <p className="text-[24px] font-bold text-purple-600 dark:text-purple-400">{analysis.yearsOfExperience}</p>
              <p className="text-[10px] text-neutral-400 font-medium uppercase tracking-wider">Років досвіду</p>
            </div>
          </div>

          <div>
            <h4 className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 mb-1.5 uppercase tracking-wider">Короткий опис</h4>
            <p className="text-[13px] text-neutral-700 dark:text-neutral-300 leading-relaxed">{analysis.summary}</p>
          </div>

          <div>
            <h4 className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 mb-1.5 uppercase tracking-wider">Ключові навички</h4>
            <div className="flex flex-wrap gap-1.5">
              {analysis.skills.map((skill) => (
                <span key={skill} className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                  {skill}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 mb-1.5 uppercase tracking-wider">Технології</h4>
            <div className="flex flex-wrap gap-1.5">
              {analysis.technologies.map((tech) => (
                <span key={tech} className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
                  {tech}
                </span>
              ))}
            </div>
          </div>

          {analysis.softSkills.length > 0 && (
            <div>
              <h4 className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 mb-1.5 uppercase tracking-wider">Особисті якості</h4>
              <div className="flex flex-wrap gap-1.5">
                {analysis.softSkills.map((skill) => (
                  <span key={skill} className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300 border border-violet-100 dark:border-violet-800">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-neutral-100 dark:border-neutral-800 pt-4">
            <div className="flex items-center gap-1.5 mb-3">
              <Target className="w-3.5 h-3.5 text-blue-500" />
              <h4 className="text-[12px] font-semibold text-neutral-700 dark:text-neutral-200">Оцінювання для вакансії</h4>
            </div>

            <div className="flex gap-2">
              <select
                className="flex-1 h-9 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-[13px] px-3 text-neutral-700 dark:text-neutral-200 cursor-pointer"
                value={selectedJobId || ''}
                onChange={(e) => { setSelectedJobId(e.target.value); setMatchResult(null); }}
              >
                <option value="" disabled>Оберіть вакансію...</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>{job.title} - {translateDepartment(job.department)}</option>
                ))}
              </select>
              <Button
                type="button"
                onClick={handleMatch}
                disabled={!selectedJobId || isMatching}
                className="rounded-lg bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-600 hover:to-violet-600 text-white text-[12px] h-9 cursor-pointer gap-1.5 px-4"
              >
                {isMatching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Target className="w-3.5 h-3.5" />}
                Оцінити
              </Button>
            </div>

            {matchError && (
              <p className="mt-2 text-[11px] text-red-500 dark:text-red-400">{matchError}</p>
            )}
          </div>

          {matchResult && (
            <MatchResultPanel
              matchResult={matchResult}
              jobTitle={jobs.find((job) => job.id === selectedJobId)?.title || null}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
