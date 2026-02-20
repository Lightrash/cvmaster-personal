import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useNavStore } from '@/store/useNavStore';
import { useBoardStore } from '@/store/useBoardStore';
import { useJobsStore } from '@/store/useJobsStore';
import { fetchCandidateById, matchCandidateToJob, updateCandidate } from '@/services/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Briefcase,
  GraduationCap,
  Globe,
  Code,
  Star,
  Brain,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Save,
  FileText,
  Linkedin,
  TrendingUp,
} from 'lucide-react';
import type { Candidate, ColumnStatus, MatchResult, ResumeAnalysis } from '@/types';

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
  technologies: [],
  softSkills: [],
  overallScore: 0,
  summary: '',
  education: '',
  languages: [],
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
    technologies: Array.isArray(src.technologies) ? src.technologies.map(String) : [],
    softSkills: Array.isArray(src.softSkills) ? src.softSkills.map(String) : [],
    overallScore: Number.isFinite(Number(src.overallScore))
      ? Number(src.overallScore)
      : 0,
    summary: String(src.summary || ''),
    education: String(src.education || ''),
    languages: Array.isArray(src.languages) ? src.languages.map(String) : [],
  };
}

export function CandidateProfilePage() {
  const { id } = useParams();
  const isCreateMode = !id || id === 'new';

  const { pendingAnalysis, pendingFile, clearPendingCandidate } = useNavStore();
  const addCandidate = useBoardStore((s) => s.addCandidate);
  const loadCandidates = useBoardStore((s) => s.loadCandidates);
  const { jobs, loadJobs, hasLoaded: jobsLoaded } = useJobsStore();
  const navigate = useNavigate();

  const [existingCandidate, setExistingCandidate] = useState<Candidate | null>(null);
  const [isLoadingCandidate, setIsLoadingCandidate] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState(pendingAnalysis?.firstName || '');
  const [lastName, setLastName] = useState(pendingAnalysis?.lastName || '');
  const [email, setEmail] = useState(pendingAnalysis?.email || '');
  const [phone, setPhone] = useState(pendingAnalysis?.phone || '');
  const [position, setPosition] = useState(pendingAnalysis?.position || '');
  const [linkedinUrl, setLinkedinUrl] = useState(pendingAnalysis?.linkedin || '');
  const [status, setStatus] = useState<ColumnStatus>('New');

  useEffect(() => {
    if (pendingAnalysis) {
      setFirstName(pendingAnalysis.firstName || '');
      setLastName(pendingAnalysis.lastName || '');
      setEmail(pendingAnalysis.email || '');
      setPhone(pendingAnalysis.phone || '');
      setPosition(pendingAnalysis.position || '');
      setLinkedinUrl(pendingAnalysis.linkedin || '');
    }
  }, [pendingAnalysis]);

  useEffect(() => {
    if (!jobsLoaded) {
      void loadJobs();
    }
  }, [jobsLoaded, loadJobs]);

  useEffect(() => {
    if (isCreateMode || pendingAnalysis || !id) return;

    let isCancelled = false;
    setIsLoadingCandidate(true);
    setLoadError(null);

    void fetchCandidateById(id)
      .then((candidate) => {
        if (isCancelled) return;
        setExistingCandidate(candidate);
        setFirstName(candidate.name || '');
        setLastName(candidate.surname || '');
        setEmail(candidate.email || '');
        setPhone(candidate.phone || '');
        setPosition(candidate.position || '');
        setLinkedinUrl(candidate.linkedin || '');
        setStatus(candidate.status || 'New');
      })
      .catch((error) => {
        if (isCancelled) return;
        setLoadError(error instanceof Error ? error.message : 'Failed to load candidate');
      })
      .finally(() => {
        if (isCancelled) return;
        setIsLoadingCandidate(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [id, isCreateMode, pendingAnalysis]);

  const analysis = useMemo(() => {
    if (pendingAnalysis) return normalizeAnalysis(pendingAnalysis);
    if (existingCandidate?.resumeAnalysis) return normalizeAnalysis(existingCandidate.resumeAnalysis);
    return EMPTY_ANALYSIS;
  }, [pendingAnalysis, existingCandidate]);

  const hasAnalysisData =
    analysis.summary.length > 0 ||
    analysis.skills.length > 0 ||
    analysis.technologies.length > 0;

  const [selectedJobId, setSelectedJobId] = useState('');
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [isMatching, setIsMatching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  if (!isCreateMode && isLoadingCandidate) {
    return (
      <div className="flex-1 flex items-center justify-center h-screen bg-neutral-50 dark:bg-neutral-950">
        <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading candidate...
        </div>
      </div>
    );
  }

  if (!isCreateMode && loadError) {
    return (
      <div className="flex-1 flex items-center justify-center h-screen bg-neutral-50 dark:bg-neutral-950">
        <div className="text-center">
          <p className="text-neutral-500 dark:text-neutral-400">{loadError}</p>
          <Button
            variant="ghost"
            className="mt-3 cursor-pointer"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to board
          </Button>
        </div>
      </div>
    );
  }

  if (isCreateMode && !pendingAnalysis) {
    return (
      <div className="flex-1 flex items-center justify-center h-screen bg-neutral-50 dark:bg-neutral-950">
        <div className="text-center">
          <p className="text-neutral-500 dark:text-neutral-400">
            No candidate data available. Upload and analyze a CV first.
          </p>
          <Button
            variant="ghost"
            className="mt-3 cursor-pointer"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to board
          </Button>
        </div>
      </div>
    );
  }

  const handleMatch = async () => {
    if (!selectedJobId || !hasAnalysisData) return;
    const job = jobs.find((j) => j.id === selectedJobId);
    if (!job) return;

    setIsMatching(true);
    try {
      const result = await matchCandidateToJob(analysis, job);
      setMatchResult(result);
    } catch (err) {
      console.error('Match failed:', err);
    } finally {
      setIsMatching(false);
    }
  };

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) return;

    setIsSaving(true);
    try {
      const avatar =
        existingCandidate?.avatar ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(firstName)}+${encodeURIComponent(lastName)}&background=random&color=fff&size=100`;

      const progressSource = analysis.overallScore || existingCandidate?.progress || 0;
      const progress = Math.max(0, Math.min(100, Math.round(progressSource * 10)));
      const resumeAnalysisPayload = hasAnalysisData ? analysis : null;

      if (isCreateMode) {
        await addCandidate({
          name: firstName.trim(),
          surname: lastName.trim(),
          position: position.trim(),
          email: email.trim(),
          phone: phone.trim(),
          linkedin: linkedinUrl.trim(),
          avatar,
          progress,
          deadline: existingCandidate?.deadline || '14d',
          status,
          resumeAnalysis: resumeAnalysisPayload,
        });
      } else if (id) {
        await updateCandidate(id, {
          name: firstName.trim(),
          surname: lastName.trim(),
          position: position.trim(),
          email: email.trim(),
          phone: phone.trim(),
          linkedin: linkedinUrl.trim(),
          avatar,
          progress,
          status,
          resumeAnalysis: resumeAnalysisPayload,
        });
        await loadCandidates();
      }

      clearPendingCandidate();
      navigate('/');
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    clearPendingCandidate();
    navigate('/');
  };

  const getScoreColor = (score: number) => {
    if (score >= 8)
      return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800';
    if (score >= 5)
      return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800';
    return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800';
  };

  const getLevelColor = (level: string) => {
    if (level === 'Senior')
      return 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800';
    if (level === 'Middle')
      return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800';
    return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800';
  };

  const getMatchColor = (pct: number) => {
    if (pct >= 70) return 'text-emerald-600 dark:text-emerald-400';
    if (pct >= 40) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getRecIcon = (rec: string) => {
    if (rec === 'Proceed')
      return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    if (rec === 'Review manually')
      return <AlertCircle className="w-4 h-4 text-amber-500" />;
    return <XCircle className="w-4 h-4 text-red-500" />;
  };

  const activeJobs = jobs.filter((j) => j.status === 'Active');

  return (
    <div className="flex-1 flex flex-col h-screen max-h-screen overflow-hidden bg-neutral-50 dark:bg-neutral-950 transition-colors duration-300">
      <PageHeader
        title={isCreateMode ? 'New Candidate' : 'Candidate Profile'}
        subtitle={
          isCreateMode
            ? `AI-parsed from ${pendingFile?.name || 'uploaded CV'}`
            : `Editing ${firstName} ${lastName}`.trim()
        }
        backButton={
          <button
            onClick={handleBack}
            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
          </button>
        }
        actions={
          <Button
            onClick={handleSave}
            disabled={!firstName.trim() || !lastName.trim() || isSaving}
            className="gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-5 text-[13px] h-9 cursor-pointer font-medium disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {isCreateMode ? 'Create Candidate' : 'Save Changes'}
          </Button>
        }
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-100 dark:border-neutral-800 p-5">
              <h2 className="text-[14px] font-bold text-neutral-800 dark:text-neutral-200 mb-4 flex items-center gap-2">
                <User className="w-4 h-4 text-blue-500" />
                Personal Information
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1 block">
                    First Name *
                  </label>
                  <Input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="rounded-lg h-9 text-[13px]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1 block">
                    Last Name *
                  </label>
                  <Input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="rounded-lg h-9 text-[13px]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1 block flex items-center gap-1">
                    <Mail className="w-3 h-3" /> Email
                  </label>
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="rounded-lg h-9 text-[13px]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1 block flex items-center gap-1">
                    <Phone className="w-3 h-3" /> Phone
                  </label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="rounded-lg h-9 text-[13px]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1 block flex items-center gap-1">
                    <Briefcase className="w-3 h-3" /> Position
                  </label>
                  <Input
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    className="rounded-lg h-9 text-[13px]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1 block flex items-center gap-1">
                    <Linkedin className="w-3 h-3" /> LinkedIn
                  </label>
                  <Input
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    className="rounded-lg h-9 text-[13px]"
                    placeholder="https://linkedin.com/in/..."
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1 block">
                    Pipeline Stage
                  </label>
                  <Select
                    value={status}
                    onValueChange={(v) => setStatus(v as ColumnStatus)}
                  >
                    <SelectTrigger className="rounded-lg h-9 text-[13px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        'New',
                        'Screening',
                        'Interview',
                        'Test Task',
                        'Offer',
                        'Hired',
                        'Rejected',
                      ].map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1 block flex items-center gap-1">
                    <GraduationCap className="w-3 h-3" /> Education
                  </label>
                  <Input
                    value={analysis.education}
                    readOnly
                    className="rounded-lg h-9 text-[13px] bg-neutral-50 dark:bg-neutral-800"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-100 dark:border-neutral-800 p-5">
              <h2 className="text-[14px] font-bold text-neutral-800 dark:text-neutral-200 mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                AI Profile Summary
              </h2>
              <p className="text-[13px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
                {analysis.summary || 'No AI summary is saved for this candidate yet.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-100 dark:border-neutral-800 p-5">
                <h2 className="text-[14px] font-bold text-neutral-800 dark:text-neutral-200 mb-3 flex items-center gap-2">
                  <Code className="w-4 h-4 text-violet-500" />
                  Key Skills
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.skills.map((skill, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-full bg-violet-50 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-800 text-[11px] font-medium text-violet-600 dark:text-violet-400"
                    >
                      {skill}
                    </span>
                  ))}
                  {analysis.skills.length === 0 && (
                    <span className="text-[12px] text-neutral-400">No skills detected</span>
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-100 dark:border-neutral-800 p-5">
                <h2 className="text-[14px] font-bold text-neutral-800 dark:text-neutral-200 mb-3 flex items-center gap-2">
                  <Code className="w-4 h-4 text-blue-500" />
                  Technologies
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.technologies.map((tech, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-[11px] font-medium text-blue-600 dark:text-blue-400"
                    >
                      {tech}
                    </span>
                  ))}
                  {analysis.technologies.length === 0 && (
                    <span className="text-[12px] text-neutral-400">No technologies detected</span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-100 dark:border-neutral-800 p-5">
                <h2 className="text-[14px] font-bold text-neutral-800 dark:text-neutral-200 mb-3 flex items-center gap-2">
                  <Brain className="w-4 h-4 text-pink-500" />
                  Soft Skills
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.softSkills.map((skill, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-full bg-pink-50 dark:bg-pink-900/30 border border-pink-200 dark:border-pink-800 text-[11px] font-medium text-pink-600 dark:text-pink-400"
                    >
                      {skill}
                    </span>
                  ))}
                  {analysis.softSkills.length === 0 && (
                    <span className="text-[12px] text-neutral-400">No soft skills detected</span>
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-100 dark:border-neutral-800 p-5">
                <h2 className="text-[14px] font-bold text-neutral-800 dark:text-neutral-200 mb-3 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-teal-500" />
                  Languages
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.languages.map((lang, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-full bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-800 text-[11px] font-medium text-teal-600 dark:text-teal-400"
                    >
                      {lang}
                    </span>
                  ))}
                  {analysis.languages.length === 0 && (
                    <span className="text-[12px] text-neutral-400">No languages detected</span>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-100 dark:border-neutral-800 p-5">
              <h2 className="text-[14px] font-bold text-neutral-800 dark:text-neutral-200 mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-500" />
                Match with Vacancy
              </h2>

              {!hasAnalysisData && (
                <p className="mb-3 text-[12px] text-neutral-500 dark:text-neutral-400">
                  This candidate has no saved AI analysis yet. Upload and analyze CV to enable matching.
                </p>
              )}

              <div className="flex items-center gap-3 mb-4">
                <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                  <SelectTrigger className="flex-1 rounded-lg h-9 text-[13px]">
                    <SelectValue placeholder="Select a job to compare..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activeJobs.map((job) => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.title} - {job.department}
                      </SelectItem>
                    ))}
                    {activeJobs.length === 0 && (
                      <SelectItem value="none" disabled>
                        No active jobs
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={handleMatch}
                  disabled={!selectedJobId || isMatching || !hasAnalysisData}
                  className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] h-9 px-4 cursor-pointer font-medium gap-1.5 disabled:opacity-50"
                >
                  {isMatching ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  Analyze Match
                </Button>
              </div>

              {matchResult && (
                <div className="space-y-4 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                  <div className="flex items-center gap-4">
                    <div
                      className={`text-3xl font-black ${getMatchColor(matchResult.matchPercentage)}`}
                    >
                      {matchResult.matchPercentage}%
                    </div>
                    <div className="flex items-center gap-2">
                      {getRecIcon(matchResult.recommendation)}
                      <span className="text-[13px] font-semibold text-neutral-700 dark:text-neutral-300">
                        {matchResult.recommendation}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-[12px] font-semibold text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Strengths
                      </h3>
                      <ul className="space-y-1">
                        {matchResult.strengths.map((s, i) => (
                          <li
                            key={i}
                            className="text-[12px] text-neutral-600 dark:text-neutral-400 flex items-start gap-1.5"
                          >
                            <span className="text-emerald-400 mt-1">-</span> {s}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h3 className="text-[12px] font-semibold text-red-600 dark:text-red-400 mb-2 flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> Gaps
                      </h3>
                      <ul className="space-y-1">
                        {matchResult.gaps.map((g, i) => (
                          <li
                            key={i}
                            className="text-[12px] text-neutral-600 dark:text-neutral-400 flex items-start gap-1.5"
                          >
                            <span className="text-red-400 mt-1">-</span> {g}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-5">
            <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-100 dark:border-neutral-800 p-5">
              <h2 className="text-[14px] font-bold text-neutral-800 dark:text-neutral-200 mb-4 flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500" />
                AI Assessment
              </h2>

              <div className="text-center mb-5">
                <div
                  className={`inline-flex items-center justify-center w-20 h-20 rounded-2xl border-2 ${getScoreColor(analysis.overallScore)}`}
                >
                  <span className="text-3xl font-black">
                    {analysis.overallScore}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 mt-2">
                  Overall Score / 10
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-neutral-500 dark:text-neutral-400">
                    Level
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${getLevelColor(analysis.level)}`}
                  >
                    {analysis.level}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-neutral-500 dark:text-neutral-400">
                    Experience
                  </span>
                  <span className="text-[12px] font-semibold text-neutral-800 dark:text-neutral-200">
                    {analysis.yearsOfExperience} years
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-neutral-500 dark:text-neutral-400">
                    Skills
                  </span>
                  <span className="text-[12px] font-semibold text-neutral-800 dark:text-neutral-200">
                    {analysis.skills.length} found
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-neutral-500 dark:text-neutral-400">
                    Technologies
                  </span>
                  <span className="text-[12px] font-semibold text-neutral-800 dark:text-neutral-200">
                    {analysis.technologies.length} found
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-100 dark:border-neutral-800 p-5">
              <h2 className="text-[14px] font-bold text-neutral-800 dark:text-neutral-200 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-neutral-500" />
                Source File
              </h2>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800">
                <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-neutral-700 dark:text-neutral-300 truncate">
                    {pendingFile?.name || (isCreateMode ? 'resume.pdf' : 'candidate-profile')}
                  </p>
                  <p className="text-[10px] text-neutral-400">
                    {pendingFile
                      ? `${(pendingFile.size / 1024 / 1024).toFixed(1)} MB`
                      : isCreateMode
                        ? ''
                        : 'Saved in database'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
