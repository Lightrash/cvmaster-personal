import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import type { ReactNode } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useNavStore } from "@/store/useNavStore";
import { useBoardStore } from "@/store/useBoardStore";
import { useJobsStore } from "@/store/useJobsStore";
import {
  fetchCandidateById,
  matchCandidateToJob,
  updateCandidate,
} from "@/services/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/PageHeader";
import { MatchResultPanel } from "@/components/match/MatchResultPanel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type {
  Candidate,
  ColumnStatus,
  MatchResult,
  ResumeAnalysis,
} from "@/types";

const PIPELINE_STAGE_OPTIONS: Array<{ value: ColumnStatus; label: string }> = [
  { value: "New", label: "Новий" },
  { value: "Screening", label: "Первинний відбір" },
  { value: "Interview", label: "Співбесіда" },
  { value: "Test Task", label: "Тестове завдання" },
  { value: "Offer", label: "Офер" },
  { value: "Hired", label: "Найнято" },
];

const EMPTY_ANALYSIS: ResumeAnalysis = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  position: "",
  linkedin: "",
  skills: [],
  level: "Junior",
  yearsOfExperience: 0,
  generalYearsExperience: 0,
  relevantYearsExperience: null,
  technologies: [],
  softSkills: [],
  overallScore: 0,
  summary: "",
  education: "",
  languages: [],
  scoringMeta: undefined,
};

function normalizeAnalysis(value: unknown): ResumeAnalysis {
  const src = (
    value && typeof value === "object" ? value : {}
  ) as Partial<ResumeAnalysis>;
  return {
    firstName: String(src.firstName || ""),
    lastName: String(src.lastName || ""),
    email: String(src.email || ""),
    phone: String(src.phone || ""),
    position: String(src.position || ""),
    linkedin: String(src.linkedin || ""),
    skills: Array.isArray(src.skills) ? src.skills.map(String) : [],
    level:
      src.level === "Senior" || src.level === "Middle" ? src.level : "Junior",
    yearsOfExperience: Number.isFinite(Number(src.yearsOfExperience))
      ? Number(src.yearsOfExperience)
      : 0,
    generalYearsExperience: Number.isFinite(Number(src.generalYearsExperience))
      ? Number(src.generalYearsExperience)
      : Number.isFinite(Number(src.yearsOfExperience))
        ? Number(src.yearsOfExperience)
        : 0,
    relevantYearsExperience: Number.isFinite(
      Number(src.relevantYearsExperience),
    )
      ? Number(src.relevantYearsExperience)
      : null,
    technologies: Array.isArray(src.technologies)
      ? src.technologies.map(String)
      : [],
    softSkills: Array.isArray(src.softSkills) ? src.softSkills.map(String) : [],
    overallScore: Number.isFinite(Number(src.overallScore))
      ? Number(src.overallScore)
      : 0,
    summary: String(src.summary || ""),
    education: String(src.education || ""),
    languages: Array.isArray(src.languages) ? src.languages.map(String) : [],
    scoringMeta:
      src.scoringMeta && typeof src.scoringMeta === "object"
        ? (src.scoringMeta as Record<string, unknown>)
        : undefined,
  };
}

function translateLevel(level: ResumeAnalysis["level"]) {
  if (level === "Senior") return "Senior";
  if (level === "Middle") return "Middle";
  return "Junior";
}

function translateRecommendation(
  recommendation: MatchResult["recommendation"],
) {
  if (recommendation === "Proceed") return "Рекомендується";
  if (recommendation === "Review manually") return "Потрібна ручна перевірка";
  return "Низька відповідність";
}

function translateAlignmentBand(band?: string | null) {
  const normalized = String(band || "")
    .trim()
    .toLowerCase();
  if (normalized === "strong") return "сильний";
  if (normalized === "medium") return "середній";
  if (normalized === "weak") return "слабкий";
  if (normalized === "neutral") return "нейтральний";
  return String(band || "н/д");
}

interface ExpandableTagSectionProps {
  title: string;
  icon: ReactNode;
  items: string[];
  emptyText: string;
  chipClassName: string;
  initialVisible?: number;
}

function ExpandableTagSection({
  title,
  icon,
  items,
  emptyText,
  chipClassName,
  initialVisible = 6,
}: ExpandableTagSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const visibleItems = expanded ? items : items.slice(0, initialVisible);
  const hiddenCount = Math.max(items.length - initialVisible, 0);
  const canExpand = hiddenCount > 0;

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-100 dark:border-neutral-800 p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 className="text-[14px] font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
          {icon}
          {title}
        </h2>
        {canExpand && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px] text-neutral-500"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? (
              <>
                Згорнути <ChevronUp className="ml-1 h-3.5 w-3.5" />
              </>
            ) : (
              <>
                Ще {hiddenCount} <ChevronDown className="ml-1 h-3.5 w-3.5" />
              </>
            )}
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {visibleItems.map((item, index) => (
          <span key={`${item}-${index}`} className={chipClassName}>
            {item}
          </span>
        ))}
        {items.length === 0 && (
          <span className="text-[12px] text-neutral-400">{emptyText}</span>
        )}
      </div>
    </div>
  );
}

function ExpandableSummary({ summary }: { summary: string }) {
  const [expanded, setExpanded] = useState(false);
  const normalizedSummary = summary.trim();
  const shouldCollapse = normalizedSummary.length > 320;
  const visibleSummary =
    shouldCollapse && !expanded
      ? `${normalizedSummary.slice(0, 320).trimEnd()}...`
      : normalizedSummary;

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-100 dark:border-neutral-800 p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 className="text-[14px] font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          Короткий опис профілю
        </h2>
        {shouldCollapse && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px] text-neutral-500"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? (
              <>
                Згорнути <ChevronUp className="ml-1 h-3.5 w-3.5" />
              </>
            ) : (
              <>
                Читати далі <ChevronDown className="ml-1 h-3.5 w-3.5" />
              </>
            )}
          </Button>
        )}
      </div>
      <p className="text-[13px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
        {visibleSummary ||
          "Для цього кандидата ще немає збереженого короткого опису."}
      </p>
    </div>
  );
}

export function CandidateProfilePage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isCreateMode = !id || id === "new";
  const routeVacancyId = searchParams.get("vacancyId")?.trim() || "";
  const isVacancyContextLocked = isCreateMode && routeVacancyId.length > 0;

  const { pendingAnalysis, pendingFile, clearPendingCandidate } = useNavStore();
  const addCandidate = useBoardStore((s) => s.addCandidate);
  const loadCandidates = useBoardStore((s) => s.loadCandidates);
  const { jobs, loadJobs, hasLoaded: jobsLoaded } = useJobsStore();
  const navigate = useNavigate();

  const [existingCandidate, setExistingCandidate] = useState<Candidate | null>(
    null,
  );
  const [isLoadingCandidate, setIsLoadingCandidate] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState(pendingAnalysis?.firstName || "");
  const [lastName, setLastName] = useState(pendingAnalysis?.lastName || "");
  const [email, setEmail] = useState(pendingAnalysis?.email || "");
  const [phone, setPhone] = useState(pendingAnalysis?.phone || "");
  const [position, setPosition] = useState(pendingAnalysis?.position || "");
  const [linkedinUrl, setLinkedinUrl] = useState(
    pendingAnalysis?.linkedin || "",
  );
  const [status, setStatus] = useState<ColumnStatus>("New");
  const [selectedJobId, setSelectedJobId] = useState(routeVacancyId);
  const [matchedJobTitle, setMatchedJobTitle] = useState<string | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [isAnalysisDetailsOpen, setIsAnalysisDetailsOpen] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>("");
  const [contentView, setContentView] = useState<"overview" | "profile">(
    "overview",
  );
  const contentScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (pendingAnalysis) {
      setFirstName(pendingAnalysis.firstName || "");
      setLastName(pendingAnalysis.lastName || "");
      setEmail(pendingAnalysis.email || "");
      setPhone(pendingAnalysis.phone || "");
      setPosition(pendingAnalysis.position || "");
      setLinkedinUrl(pendingAnalysis.linkedin || "");

      if (isVacancyContextLocked) {
        setSelectedJobId(routeVacancyId);
      } else {
        const matchedJob = jobs.find(
          (job) =>
            job.status === "Active" &&
            job.title.toLowerCase() ===
              String(pendingAnalysis.position || "")
                .trim()
                .toLowerCase(),
        );
        if (matchedJob) {
          setSelectedJobId(matchedJob.id);
        }
      }
    }
  }, [isVacancyContextLocked, jobs, pendingAnalysis, routeVacancyId]);

  useEffect(() => {
    if (isVacancyContextLocked) {
      setSelectedJobId(routeVacancyId);
    }
  }, [isVacancyContextLocked, routeVacancyId]);

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
        setFirstName(candidate.name || "");
        setLastName(candidate.surname || "");
        setEmail(candidate.email || "");
        setPhone(candidate.phone || "");
        setPosition(candidate.position || "");
        setLinkedinUrl(candidate.linkedin || "");
        setStatus(candidate.status || "New");
        setSelectedJobId(candidate.vacancyId || "");
      })
      .catch((error) => {
        if (isCancelled) return;
        setLoadError(
          error instanceof Error
            ? error.message
            : "Не вдалося завантажити кандидата",
        );
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
    if (existingCandidate?.resumeAnalysis)
      return normalizeAnalysis(existingCandidate.resumeAnalysis);
    return EMPTY_ANALYSIS;
  }, [pendingAnalysis, existingCandidate]);

  const hasAnalysisData =
    analysis.summary.length > 0 ||
    analysis.skills.length > 0 ||
    analysis.technologies.length > 0;
  const selectedVacancy = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) || null,
    [jobs, selectedJobId],
  );

  useEffect(() => {
    if (!saveError) return;
    const timer = window.setTimeout(() => setSaveError(""), 5000);
    return () => window.clearTimeout(timer);
  }, [saveError]);

  if (!isCreateMode && isLoadingCandidate) {
    return (
      <div className="flex-1 flex items-center justify-center h-screen bg-neutral-50 dark:bg-neutral-950">
        <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          Завантажуємо кандидата...
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
            onClick={() => navigate("/candidates")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Назад до воронки
          </Button>
        </div>
      </div>
    );
  }

  if (isCreateMode && !routeVacancyId) {
    return (
      <div className="flex-1 flex items-center justify-center h-screen bg-neutral-50 dark:bg-neutral-950">
        <div className="text-center max-w-md px-6">
          <p className="text-neutral-700 dark:text-neutral-300 font-medium">
            Створення кандидата тепер запускається тільки з конкретної вакансії.
          </p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">
            Поверніться до воронки, виберіть одну вакансію і запустіть додавання
            кандидата саме з цього контексту.
          </p>
          <Button
            variant="ghost"
            className="mt-4 cursor-pointer"
            onClick={() => navigate("/candidates")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Назад до воронки
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
            Дані кандидата відсутні. Спочатку завантажте та проаналізуйте
            резюме.
          </p>
          <Button
            variant="ghost"
            className="mt-3 cursor-pointer"
            onClick={() => navigate("/candidates")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Назад до воронки
          </Button>
        </div>
      </div>
    );
  }

  const handleMatch = useCallback(async () => {
    if (!selectedJobId || !hasAnalysisData) return;
    const job = jobs.find((j) => j.id === selectedJobId);
    if (!job) return;

    setIsMatching(true);
    try {
      const result = await matchCandidateToJob(analysis, job);
      setMatchResult(result);
      setMatchedJobTitle(job.title);
    } catch (err) {
      console.error("Match failed:", err);
    } finally {
      setIsMatching(false);
    }
  }, [analysis, hasAnalysisData, jobs, selectedJobId]);

  useEffect(() => {
    if (!isVacancyContextLocked || !selectedVacancy || !hasAnalysisData) return;
    if (isMatching) return;
    if (matchResult && matchedJobTitle === selectedVacancy.title) return;
    void handleMatch();
  }, [
    handleMatch,
    hasAnalysisData,
    isMatching,
    isVacancyContextLocked,
    matchResult,
    matchedJobTitle,
    selectedVacancy,
  ]);

  const handleSave = async () => {
    setSaveError("");
    if (!firstName.trim() || !lastName.trim()) return;
    if (isCreateMode && !selectedJobId) {
      setSaveError("Спочатку виберіть вакансію перед створенням кандидата.");
      return;
    }

    setIsSaving(true);
    try {
      const avatar =
        existingCandidate?.avatar ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(firstName)}+${encodeURIComponent(lastName)}&background=random&color=fff&size=100`;

      const progressSource =
        analysis.overallScore || existingCandidate?.progress || 0;
      const progress = Math.max(
        0,
        Math.min(100, Math.round(progressSource * 10)),
      );
      const resumeAnalysisPayload = hasAnalysisData ? analysis : null;

      if (isCreateMode) {
        await addCandidate({
          name: firstName.trim(),
          surname: lastName.trim(),
          vacancyId: selectedJobId || null,
          position: selectedVacancy?.title || position.trim(),
          email: email.trim(),
          phone: phone.trim(),
          linkedin: linkedinUrl.trim(),
          avatar,
          progress,
          deadline: existingCandidate?.deadline || "14d",
          status,
          resumeAnalysis: resumeAnalysisPayload,
        });
      } else if (id) {
        await updateCandidate(id, {
          name: firstName.trim(),
          surname: lastName.trim(),
          vacancyId: selectedJobId || null,
          position: selectedVacancy?.title || position.trim(),
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
      navigate("/candidates", {
        state: selectedVacancy
          ? {
              selectedJob: `job|${selectedVacancy.id}|${selectedVacancy.title}`,
            }
          : undefined,
      });
    } catch (err) {
      console.error("Save failed:", err);
      setSaveError(
        err instanceof Error
          ? err.message
          : "Не вдалося створити кандидата. Спробуйте ще раз.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    clearPendingCandidate();
    navigate("/candidates", {
      state: selectedVacancy
        ? { selectedJob: `job|${selectedVacancy.id}|${selectedVacancy.title}` }
        : undefined,
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 8)
      return "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800";
    if (score >= 5)
      return "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800";
    return "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800";
  };

  const getLevelColor = (level: string) => {
    if (level === "Senior")
      return "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800";
    if (level === "Middle")
      return "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800";
    return "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800";
  };

  const getMatchColor = (pct: number) => {
    if (pct >= 70) return "text-emerald-600 dark:text-emerald-400";
    if (pct >= 40) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  const getRecIcon = (rec: string) => {
    if (rec === "Proceed")
      return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    if (rec === "Review manually")
      return <AlertCircle className="w-4 h-4 text-amber-500" />;
    return <XCircle className="w-4 h-4 text-red-500" />;
  };

  const vacancyScopedScore = matchResult
    ? Math.round(
        (Number(
          matchResult.finalMatchScore ?? matchResult.matchPercentage ?? 0,
        ) /
          10) *
          10,
      ) / 10
    : null;
  const profileScoreForDisplay = vacancyScopedScore ?? analysis.overallScore;
  const scoreLabel =
    vacancyScopedScore != null
      ? "Оцінка для цієї вакансії / 10"
      : "Загальна оцінка профілю / 10";
  const scoreHint =
    vacancyScopedScore != null
      ? "Показує, наскільки кандидат підходить саме до вибраної вакансії."
      : "Показує загальну оцінку профілю на основі аналізу резюме.";

  const activeJobs = jobs.filter((j) => j.status === "Active");
  const createModeSubtitle = selectedVacancy
    ? `Резюме проаналізовано для вакансії ${selectedVacancy.title}`
    : "Резюме проаналізовано";

  const handleContentViewChange = (view: "overview" | "profile") => {
    setContentView(view);
    contentScrollRef.current?.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <div className="flex-1 flex flex-col h-screen max-h-screen overflow-hidden bg-neutral-50 dark:bg-neutral-950 transition-colors duration-300">
      <PageHeader
        title={isCreateMode ? "Новий кандидат" : "Профіль кандидата"}
        subtitle={
          isCreateMode
            ? createModeSubtitle
            : `Редагування: ${firstName} ${lastName}`.trim()
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
            disabled={
              !firstName.trim() ||
              !lastName.trim() ||
              (isCreateMode && !selectedJobId) ||
              isSaving
            }
            className="gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-5 text-[13px] h-9 cursor-pointer font-medium disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {isCreateMode ? "Створити кандидата" : "Зберегти зміни"}
          </Button>
        }
      />

      <div ref={contentScrollRef} className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 items-start gap-6">
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-100 dark:border-neutral-800 p-5">
              <h2 className="text-[14px] font-bold text-neutral-800 dark:text-neutral-200 mb-4 flex items-center gap-2">
                <User className="w-4 h-4 text-blue-500" />
                Особисті дані
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1 block">
                    Ім'я *
                  </label>
                  <Input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="rounded-lg h-9 text-[13px]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1 block">
                    Прізвище *
                  </label>
                  <Input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="rounded-lg h-9 text-[13px]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1 block flex items-center gap-1">
                    <Mail className="w-3 h-3" /> Електронна пошта
                  </label>
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="rounded-lg h-9 text-[13px]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1 block flex items-center gap-1">
                    <Phone className="w-3 h-3" /> Телефон
                  </label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="rounded-lg h-9 text-[13px]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1 block">
                    Вакансія {isCreateMode ? "*" : ""}
                  </label>
                  {isVacancyContextLocked ? (
                    <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/30 px-3 py-2.5">
                      <p className="text-[13px] font-medium text-blue-700 dark:text-blue-300">
                        {selectedVacancy?.title || "Вибрана вакансія"}
                      </p>
                      <p className="text-[11px] text-blue-600/80 dark:text-blue-300/80 mt-0.5">
                        Кандидат створюється одразу в межах цієї вакансії.
                      </p>
                    </div>
                  ) : (
                    <Select
                      value={
                        isCreateMode
                          ? selectedJobId
                          : selectedJobId || "__none__"
                      }
                      onValueChange={(value) => {
                        setSelectedJobId(value === "__none__" ? "" : value);
                        setSaveError("");
                      }}
                    >
                      <SelectTrigger className="w-full rounded-lg h-9 text-[13px]">
                        <SelectValue placeholder="Оберіть вакансію..." />
                      </SelectTrigger>
                      <SelectContent>
                        {!isCreateMode && (
                          <SelectItem value="__none__">Без вакансії</SelectItem>
                        )}
                        {activeJobs.map((job) => (
                          <SelectItem key={job.id} value={job.id}>
                            {job.title} - {job.department}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div>
                  <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1 block flex items-center gap-1">
                    <Briefcase className="w-3 h-3" /> Посада
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
                    Етап воронки
                  </label>
                  <Select
                    value={status}
                    onValueChange={(v) => setStatus(v as ColumnStatus)}
                  >
                    <SelectTrigger className="rounded-lg h-9 text-[13px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PIPELINE_STAGE_OPTIONS.map((stage) => (
                        <SelectItem key={stage.value} value={stage.value}>
                          {stage.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1 block flex items-center gap-1">
                    <GraduationCap className="w-3 h-3" /> Освіта
                  </label>
                  <Input
                    value={analysis.education}
                    readOnly
                    className="rounded-lg h-9 text-[13px] bg-neutral-50 dark:bg-neutral-800"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-100 dark:border-neutral-800 p-2">
              <div className="inline-flex w-full rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
                <button
                  type="button"
                  onClick={() => handleContentViewChange("overview")}
                  className={`flex-1 rounded-md px-3 py-2 text-[12px] font-medium transition-colors ${
                    contentView === "overview"
                      ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-900 dark:text-neutral-100"
                      : "text-neutral-500 dark:text-neutral-400"
                  }`}
                >
                  Огляд
                </button>
                <button
                  type="button"
                  onClick={() => handleContentViewChange("profile")}
                  className={`flex-1 rounded-md px-3 py-2 text-[12px] font-medium transition-colors ${
                    contentView === "profile"
                      ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-900 dark:text-neutral-100"
                      : "text-neutral-500 dark:text-neutral-400"
                  }`}
                >
                  Повні дані профілю
                </button>
              </div>
            </div>

            {contentView === "overview" ? (
              <>
                <ExpandableSummary summary={analysis.summary} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <ExpandableTagSection
                    title="Ключові навички"
                    icon={<Code className="w-4 h-4 text-violet-500" />}
                    items={analysis.skills}
                    emptyText="Навички не визначено"
                    chipClassName="px-2.5 py-1 rounded-full bg-violet-50 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-800 text-[11px] font-medium text-violet-600 dark:text-violet-400"
                    initialVisible={5}
                  />

                  <ExpandableTagSection
                    title="Технології"
                    icon={<Code className="w-4 h-4 text-blue-500" />}
                    items={analysis.technologies}
                    emptyText="Технології не визначено"
                    chipClassName="px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-[11px] font-medium text-blue-600 dark:text-blue-400"
                    initialVisible={5}
                  />
                </div>

                <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-100 dark:border-neutral-800 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-[14px] font-bold text-neutral-800 dark:text-neutral-200">
                        Ще дані профілю
                      </h2>
                      <p className="mt-1 text-[12px] text-neutral-500 dark:text-neutral-400">
                        Тут зібрано другорядні дані, які теж можуть бути
                        корисними під час перегляду кандидата.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => handleContentViewChange("profile")}
                    >
                      Відкрити повні дані
                    </Button>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-neutral-50 px-3 py-2 dark:bg-neutral-800/70">
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        Особисті якості
                      </p>
                      <p className="mt-1 text-[13px] font-semibold text-neutral-800 dark:text-neutral-100">
                        {analysis.softSkills.length || "Немає даних"}
                      </p>
                    </div>
                    <div className="rounded-lg bg-neutral-50 px-3 py-2 dark:bg-neutral-800/70">
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        Мови
                      </p>
                      <p className="mt-1 text-[13px] font-semibold text-neutral-800 dark:text-neutral-100">
                        {analysis.languages.length || "Немає даних"}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <ExpandableSummary summary={analysis.summary} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <ExpandableTagSection
                    title="Ключові навички"
                    icon={<Code className="w-4 h-4 text-violet-500" />}
                    items={analysis.skills}
                    emptyText="Навички не визначено"
                    chipClassName="px-2.5 py-1 rounded-full bg-violet-50 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-800 text-[11px] font-medium text-violet-600 dark:text-violet-400"
                  />

                  <ExpandableTagSection
                    title="Технології"
                    icon={<Code className="w-4 h-4 text-blue-500" />}
                    items={analysis.technologies}
                    emptyText="Технології не визначено"
                    chipClassName="px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-[11px] font-medium text-blue-600 dark:text-blue-400"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <ExpandableTagSection
                    title="Особисті якості"
                    icon={<Brain className="w-4 h-4 text-pink-500" />}
                    items={analysis.softSkills}
                    emptyText="Особисті якості не визначено"
                    chipClassName="px-2.5 py-1 rounded-full bg-pink-50 dark:bg-pink-900/30 border border-pink-200 dark:border-pink-800 text-[11px] font-medium text-pink-600 dark:text-pink-400"
                  />

                  <ExpandableTagSection
                    title="Мови"
                    icon={<Globe className="w-4 h-4 text-teal-500" />}
                    items={analysis.languages}
                    emptyText="Мови не визначено"
                    chipClassName="px-2.5 py-1 rounded-full bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-800 text-[11px] font-medium text-teal-600 dark:text-teal-400"
                  />
                </div>

                <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-100 dark:border-neutral-800 p-5">
                  <h2 className="text-[14px] font-bold text-neutral-800 dark:text-neutral-200 mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-neutral-500" />
                    Файл резюме
                  </h2>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800">
                    <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
                      <FileText className="w-4 h-4 text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-neutral-700 dark:text-neutral-300 truncate">
                        {pendingFile?.name ||
                          (isCreateMode ? "resume.pdf" : "профіль-кандидата")}
                      </p>
                      <p className="text-[10px] text-neutral-400">
                        {pendingFile
                          ? `${(pendingFile.size / 1024 / 1024).toFixed(1)} МБ`
                          : isCreateMode
                            ? ""
                            : "Збережено в системі"}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="space-y-5 lg:sticky lg:top-0 self-start">
            <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-100 dark:border-neutral-800 p-5">
              <h2 className="text-[14px] font-bold text-neutral-800 dark:text-neutral-200 mb-4 flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500" />
                {vacancyScopedScore != null
                  ? "Оцінювання для вакансії"
                  : "Оцінювання"}
              </h2>

              <div className="text-center mb-5">
                <div
                  className={`inline-flex items-center justify-center w-20 h-20 rounded-2xl border-2 ${getScoreColor(profileScoreForDisplay)}`}
                >
                  <span className="text-3xl font-black">
                    {Number.isInteger(profileScoreForDisplay)
                      ? profileScoreForDisplay
                      : profileScoreForDisplay.toFixed(1)}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 mt-2">
                  {scoreLabel}
                </p>
                <p className="text-[11px] text-neutral-400 mt-1">{scoreHint}</p>
              </div>

              <div className="rounded-lg bg-neutral-50 px-3 py-3 dark:bg-neutral-800/70">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[12px] text-neutral-500 dark:text-neutral-400">
                      Професійний рівень
                    </p>
                    <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400"></p>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${getLevelColor(analysis.level)}`}
                  >
                    {translateLevel(analysis.level)}
                  </span>
                </div>
              </div>

              {matchResult && (
                <div className="mt-5 pt-4 border-t border-neutral-100 dark:border-neutral-800 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[12px] font-semibold text-neutral-700 dark:text-neutral-300">
                      Результат відповідності
                    </p>
                    <span
                      className={`text-2xl font-black ${getMatchColor(matchResult.matchPercentage)}`}
                    >
                      {matchResult.matchPercentage}%
                    </span>
                  </div>
                  {matchedJobTitle && (
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      для вакансії {matchedJobTitle}
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    {getRecIcon(matchResult.recommendation)}
                    <span className="text-[12px] font-semibold text-neutral-700 dark:text-neutral-300">
                      {translateRecommendation(matchResult.recommendation)}
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {matchResult.confidence?.matchConfidenceScore != null && (
                        <span className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[11px] font-medium text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                          Рівень упевненості{" "}
                          {Math.round(
                            matchResult.confidence.matchConfidenceScore * 100,
                          )}
                          %
                        </span>
                      )}
                      <span className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[11px] font-medium text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                        Контекст{" "}
                        {translateAlignmentBand(
                          matchResult.roleContext?.alignmentBand,
                        )}
                      </span>
                      {matchResult.providerStatus === "fallback-rule-based" && (
                        <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                          Резервний режим активний
                        </span>
                      )}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-800 dark:bg-emerald-950/20">
                        <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                          Сильні сторони
                        </p>
                        <ul className="mt-2 space-y-1 text-[11px] text-emerald-700/90 dark:text-emerald-300/90">
                          {(matchResult.strengths.length
                            ? matchResult.strengths.slice(0, 3)
                            : ["Система не виділила окремих сильних сторін"]
                          ).map((item) => (
                            <li key={item}>- {item}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="rounded-lg border border-red-200 bg-red-50/60 p-3 dark:border-red-800 dark:bg-red-950/20">
                        <p className="text-[11px] font-semibold text-red-700 dark:text-red-300">
                          Основні прогалини
                        </p>
                        <ul className="mt-2 space-y-1 text-[11px] text-red-700/90 dark:text-red-300/90">
                          {(matchResult.gaps.length
                            ? matchResult.gaps.slice(0, 3)
                            : ["Система не виділила суттєвих прогалин"]
                          ).map((item) => (
                            <li key={item}>- {item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full rounded-lg text-[13px]"
                      onClick={() => setIsAnalysisDetailsOpen(true)}
                    >
                      Деталі аналізу
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-100 dark:border-neutral-800 p-5">
              <h2 className="text-[14px] font-bold text-neutral-800 dark:text-neutral-200 mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-500" />
                {isVacancyContextLocked
                  ? "Оцінювання для вибраної вакансії"
                  : "Оцінювання для вакансії"}
              </h2>

              {!hasAnalysisData && (
                <p className="mb-3 text-[12px] text-neutral-500 dark:text-neutral-400">
                  Для цього кандидата ще немає збереженого аналізу. Завантажте
                  та проаналізуйте резюме, щоб оцінити відповідність.
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-3">
                {isVacancyContextLocked ? (
                  <div className="rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/30 px-3 py-2.5">
                    <p className="text-[13px] font-medium text-indigo-700 dark:text-indigo-300">
                      {selectedVacancy?.title || "Вибрана вакансія"}
                    </p>
                    <p className="text-[11px] text-indigo-600/80 dark:text-indigo-300/80 mt-0.5">
                      Оцінювання виконується тільки для вакансії, яку було
                      вибрано у воронці.
                    </p>
                  </div>
                ) : (
                  <Select
                    value={selectedJobId}
                    onValueChange={(value) => {
                      setSelectedJobId(value);
                      setMatchedJobTitle(null);
                      setMatchResult(null);
                    }}
                  >
                    <SelectTrigger className="flex-1 rounded-lg h-9 text-[13px]">
                      <SelectValue placeholder="Оберіть вакансію для порівняння..." />
                    </SelectTrigger>
                    <SelectContent>
                      {activeJobs.map((job) => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.title} - {job.department}
                        </SelectItem>
                      ))}
                      {activeJobs.length === 0 && (
                        <SelectItem value="none" disabled>
                          Немає активних вакансій
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                )}
                <Button
                  size="sm"
                  onClick={handleMatch}
                  disabled={!selectedJobId || isMatching || !hasAnalysisData}
                  className="w-full sm:w-auto rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] h-9 px-4 cursor-pointer font-medium gap-1.5 disabled:opacity-50 whitespace-nowrap"
                >
                  {isMatching ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  {matchResult && isVacancyContextLocked
                    ? "Повторити оцінювання"
                    : "Оцінити відповідність"}
                </Button>
              </div>

              {matchResult && (
                <div className="mt-4 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50/70 dark:bg-neutral-800/60 p-3">
                  <p className="text-[12px] font-medium text-neutral-700 dark:text-neutral-200">
                    Повний розбір оцінки, чинників зниження та змістової
                    схожості доступний у деталях аналізу.
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-2 h-8 px-0 text-[12px] text-indigo-600 hover:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-200"
                    onClick={() => setIsAnalysisDetailsOpen(true)}
                  >
                    Відкрити деталі аналізу
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {matchResult && (
        <Dialog
          open={isAnalysisDetailsOpen}
          onOpenChange={setIsAnalysisDetailsOpen}
        >
          <DialogContent className="w-[min(100vw-2rem,960px)] max-w-[960px] max-h-[90vh] overflow-hidden rounded-2xl border border-neutral-200 p-0 sm:max-w-[960px] dark:border-neutral-800">
            <div className="flex max-h-[90vh] flex-col bg-white dark:bg-neutral-950">
              <DialogHeader className="border-b border-neutral-200 px-6 py-5 dark:border-neutral-800">
                <DialogTitle className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                  Деталі оцінювання
                </DialogTitle>
                <DialogDescription className="text-sm text-neutral-500 dark:text-neutral-400">
                  Детальний розбір для вакансії{" "}
                  {matchedJobTitle || selectedVacancy?.title || "без назви"}.
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto px-6 py-5">
                <MatchResultPanel
                  matchResult={matchResult}
                  jobTitle={matchedJobTitle}
                  detailsVariant="expanded"
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {saveError && (
        <div className="fixed top-20 right-6 z-50 w-[min(460px,calc(100vw-2rem))] rounded-xl border border-red-300/70 dark:border-red-700 bg-red-50 dark:bg-red-950/95 shadow-xl p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-red-700 dark:text-red-300">
                Кандидата не вдалося створити
              </p>
              <p className="text-[12px] text-red-700/90 dark:text-red-300/90 break-words">
                {saveError}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSaveError("")}
              className="p-1 rounded-md hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
              aria-label="Закрити повідомлення"
            >
              <X className="w-3.5 h-3.5 text-red-700 dark:text-red-300" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

