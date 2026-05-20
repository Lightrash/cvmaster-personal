import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useJobsStore } from '@/store/useJobsStore';
import { matchCandidateToJob, updateCandidate } from '@/services/api';
import type { Candidate, ColumnStatus, MatchResult, ResumeAnalysis } from '@/types';
import {
  Loader2,
  Save,
  Sparkles,
  Target,
} from 'lucide-react';
import { MatchResultPanel } from '@/components/match/MatchResultPanel';
import { translateCandidateLevel, translateDepartment, translatePipelineStage } from '@/lib/uiText';

interface CandidateDrawerProps {
  candidate: Candidate | null;
  onClose: () => void;
  onSaved: (candidate: Candidate) => void;
}

const EMPTY_ANALYSIS: ResumeAnalysis = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  position: '',
  linkedin: '',
  skills: [],
  level: 'Junior',
  yearsOfExperience: 0,
  generalYearsExperience: 0,
  relevantYearsExperience: null,
  technologies: [],
  softSkills: [],
  overallScore: 0,
  summary: '',
  education: '',
  languages: [],
  scoringMeta: undefined,
};

function normalizeAnalysis(value: unknown): ResumeAnalysis {
  const src = (value && typeof value === 'object' ? value : {}) as Partial<ResumeAnalysis>;
  return {
    firstName: String(src.firstName || ''),
    lastName: String(src.lastName || ''),
    email: String(src.email || ''),
    phone: String(src.phone || ''),
    position: String(src.position || ''),
    linkedin: String(src.linkedin || ''),
    skills: Array.isArray(src.skills) ? src.skills.map(String) : [],
    level: src.level === 'Senior' || src.level === 'Middle' ? src.level : 'Junior',
    yearsOfExperience: Number.isFinite(Number(src.yearsOfExperience))
      ? Number(src.yearsOfExperience)
      : 0,
    generalYearsExperience: Number.isFinite(Number(src.generalYearsExperience))
      ? Number(src.generalYearsExperience)
      : Number.isFinite(Number(src.yearsOfExperience))
        ? Number(src.yearsOfExperience)
        : 0,
    relevantYearsExperience: Number.isFinite(Number(src.relevantYearsExperience))
      ? Number(src.relevantYearsExperience)
      : null,
    technologies: Array.isArray(src.technologies) ? src.technologies.map(String) : [],
    softSkills: Array.isArray(src.softSkills) ? src.softSkills.map(String) : [],
    overallScore: Number.isFinite(Number(src.overallScore))
      ? Number(src.overallScore)
      : 0,
    summary: String(src.summary || ''),
    education: String(src.education || ''),
    languages: Array.isArray(src.languages) ? src.languages.map(String) : [],
    scoringMeta: src.scoringMeta && typeof src.scoringMeta === 'object'
      ? src.scoringMeta as Record<string, unknown>
      : undefined,
  };
}

export function CandidateDrawer({ candidate, onClose, onSaved }: CandidateDrawerProps) {
  const jobs = useJobsStore((s) => s.jobs);
  const loadJobs = useJobsStore((s) => s.loadJobs);
  const jobsLoaded = useJobsStore((s) => s.hasLoaded);

  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [vacancyId, setVacancyId] = useState('');
  const [position, setPosition] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [nextActionAt, setNextActionAt] = useState('');
  const [status, setStatus] = useState<ColumnStatus>('New');
  const [analysis, setAnalysis] = useState<ResumeAnalysis>(EMPTY_ANALYSIS);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [selectedJobId, setSelectedJobId] = useState('');
  const [isMatching, setIsMatching] = useState(false);
  const [matchError, setMatchError] = useState('');
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);

  useEffect(() => {
    if (!candidate) return;

    setName(candidate.name || '');
    setSurname(candidate.surname || '');
    setEmail(candidate.email || '');
    setPhone(candidate.phone || '');
    setVacancyId(candidate.vacancyId || '');
    setPosition(candidate.position || '');
    setLinkedin(candidate.linkedin || '');
    setOwnerId(candidate.ownerId || '');
    setNextActionAt(
      candidate.nextActionAt ? new Date(candidate.nextActionAt).toISOString().slice(0, 10) : ''
    );
    setStatus(candidate.status || 'New');
    setAnalysis(
      candidate.resumeAnalysis ? normalizeAnalysis(candidate.resumeAnalysis) : EMPTY_ANALYSIS
    );

    setSaveError('');
    setSelectedJobId('');
    setMatchError('');
    setMatchResult(null);
  }, [candidate]);

  useEffect(() => {
    if (candidate && !jobsLoaded) {
      void loadJobs();
    }
  }, [candidate, jobsLoaded, loadJobs]);

  const hasAnalysis =
    analysis.summary.length > 0 ||
    analysis.skills.length > 0 ||
    analysis.technologies.length > 0;

  const activeJobs = useMemo(() => jobs.filter((j) => j.status === 'Active'), [jobs]);

  const handleSave = async () => {
    if (!candidate?.id) return;
    if (!name.trim() || !surname.trim()) {
      setSaveError("Ім'я та прізвище є обов'язковими");
      return;
    }

    const linkedJob = activeJobs.find((job) => job.id === vacancyId);

    setIsSaving(true);
    setSaveError('');
    try {
      const updated = await updateCandidate(candidate.id, {
        name: name.trim(),
        surname: surname.trim(),
        email: email.trim(),
        phone: phone.trim(),
        vacancyId: vacancyId || null,
        position: linkedJob?.title || position.trim(),
        linkedin: linkedin.trim(),
        ownerId: ownerId.trim(),
        nextActionAt: nextActionAt || null,
        status,
        resumeAnalysis: hasAnalysis ? analysis : null,
      });

      onSaved(updated);
    } catch (error: any) {
      setSaveError(error?.message || 'Не вдалося зберегти кандидата');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMatch = async () => {
    if (!selectedJobId || !hasAnalysis) return;
    const job = activeJobs.find((j) => j.id === selectedJobId);
    if (!job) return;

    setIsMatching(true);
    setMatchError('');
    try {
      const result = await matchCandidateToJob(analysis, job);
      setMatchResult(result);
    } catch (error: any) {
      setMatchError(error?.message || 'Не вдалося оцінити кандидата');
    } finally {
      setIsMatching(false);
    }
  };

  return (
    <Dialog open={!!candidate} onOpenChange={(isOpen) => (!isOpen ? onClose() : undefined)}>
      <DialogContent
        showCloseButton
        className="!top-0 !left-auto !right-0 !translate-x-0 !translate-y-0 h-screen w-full sm:max-w-[640px] rounded-none border-0 border-l border-neutral-200 dark:border-neutral-800 p-0 gap-0"
      >
        <div className="h-full flex flex-col bg-white dark:bg-neutral-900">
          <div className="px-6 py-4 border-b border-neutral-100 dark:border-neutral-800 bg-gradient-to-r from-blue-50/70 to-cyan-50/70 dark:from-blue-950/30 dark:to-cyan-950/30">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                Профіль кандидата
              </DialogTitle>
            </DialogHeader>
            <p className="text-[12px] text-neutral-600 dark:text-neutral-300 mt-1">
              Редагуйте профіль, змінюйте етап воронки та запускайте швидке оцінювання.
            </p>
          </div>

          <div className="flex-1 overflow-auto px-6 py-5 space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-neutral-500">Ім'я *</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 mt-1" />
              </div>
              <div>
                <label className="text-[11px] font-medium text-neutral-500">Прізвище *</label>
                <Input value={surname} onChange={(e) => setSurname(e.target.value)} className="h-9 mt-1" />
              </div>
              <div>
                <label className="text-[11px] font-medium text-neutral-500">Електронна пошта</label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} className="h-9 mt-1" />
              </div>
              <div>
                <label className="text-[11px] font-medium text-neutral-500">Телефон</label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-9 mt-1" />
              </div>
              <div>
                <label className="text-[11px] font-medium text-neutral-500">Вакансія</label>
                <Select value={vacancyId || '__none__'} onValueChange={(value) => setVacancyId(value === '__none__' ? '' : value)}>
                  <SelectTrigger className="h-9 mt-1">
                    <SelectValue placeholder="Оберіть вакансію..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Без вакансії</SelectItem>
                    {activeJobs.map((job) => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.title} - {translateDepartment(job.department)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-neutral-500">Посада</label>
                <Input value={position} onChange={(e) => setPosition(e.target.value)} className="h-9 mt-1" />
              </div>
              <div>
                <label className="text-[11px] font-medium text-neutral-500">ID відповідального</label>
                <Input value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="h-9 mt-1" />
              </div>
              <div>
                <label className="text-[11px] font-medium text-neutral-500">Дата наступної дії</label>
                <Input
                  type="date"
                  value={nextActionAt}
                  onChange={(e) => setNextActionAt(e.target.value)}
                  className="h-9 mt-1"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-neutral-500">Етап воронки</label>
                <Select value={status} onValueChange={(v) => setStatus(v as ColumnStatus)}>
                  <SelectTrigger className="h-9 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['New', 'Screening', 'Interview', 'Test Task', 'Offer', 'Hired'].map((nextStatus) => (
                      <SelectItem key={nextStatus} value={nextStatus}>
                        {translatePipelineStage(nextStatus as ColumnStatus)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-medium text-neutral-500">LinkedIn</label>
              <Input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} className="h-9 mt-1" />
            </div>

            <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 mb-2">
                Підсумок аналізу
              </p>
              <p className="text-[12px] text-neutral-700 dark:text-neutral-300">
                {analysis.summary || 'Збереженого підсумку аналізу ще немає.'}
              </p>
              <div className="mt-2 text-[12px] text-neutral-600 dark:text-neutral-400">
                Оцінка: <span className="font-semibold">{analysis.overallScore}/10</span>
                {' | '}
                Рівень: <span className="font-semibold">{translateCandidateLevel(analysis.level)}</span>
              </div>
            </div>

            <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Target className="w-3.5 h-3.5 text-blue-500" />
                <p className="text-[12px] font-semibold text-neutral-700 dark:text-neutral-200">
                  Швидке оцінювання
                </p>
              </div>

              {!hasAnalysis && (
                <p className="text-[12px] text-neutral-500">Для цього кандидата ще немає збереженого AI-аналізу.</p>
              )}

              <div className="flex gap-2">
                <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                  <SelectTrigger className="h-9 flex-1">
                    <SelectValue placeholder="Оберіть вакансію..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activeJobs.map((job) => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.title} - {translateDepartment(job.department)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  onClick={handleMatch}
                  disabled={!hasAnalysis || !selectedJobId || isMatching}
                  className="h-9"
                >
                  {isMatching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                </Button>
              </div>

              {matchError && <p className="text-[12px] text-red-500">{matchError}</p>}

              {matchResult && <MatchResultPanel matchResult={matchResult} compact />}
            </div>

            {saveError && <p className="text-[12px] text-red-500">{saveError}</p>}
          </div>

          <div className="px-6 py-4 border-t border-neutral-100 dark:border-neutral-800 flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Закрити
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="gap-1.5">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Зберегти зміни
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
