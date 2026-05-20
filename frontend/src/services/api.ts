import type {
    ResumeAnalysis,
    MatchResult,
    Job,
    Candidate,
    ColumnStatus,
    AuthUser,
    MatchConfidence,
    MatchRoleContext,
    MatchPenaltiesApplied,
    NeuralBreakdown,
    FinalScoreComposition,
} from '@/types';

const API_URL = import.meta.env.VITE_API_URL || '/api';

function getNetworkErrorMessage(error: unknown): string {
    if (error instanceof TypeError) {
        return 'Cannot connect to backend API. Start backend server and check VITE_API_URL.';
    }
    return 'Request failed';
}

async function parseError(res: Response, fallback: string): Promise<Error> {
    const err = await res.json().catch(() => ({ message: fallback }));
    return new Error(err.message || fallback);
}

function normalizeAuthUser(payload: unknown): AuthUser {
    const data = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
    const id = String(data.id || data._id || '');
    const name = String(data.name || '');
    const token = String(data.token || '');

    if (!id || !token) {
        throw new Error('Invalid auth response');
    }

    return { id, name, token };
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;
}

function asStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function asFiniteNumber(value: unknown, fallback: number): number {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function normalizeConfidence(value: unknown): MatchConfidence | null {
    const record = asRecord(value);
    if (!record) return null;

    return {
        matchConfidenceScore: clamp(asFiniteNumber(record.matchConfidenceScore, 0), 0, 1),
        flags: asStringArray(record.flags),
        reasons: asStringArray(record.reasons),
    };
}

function normalizeRoleContext(value: unknown): MatchRoleContext | null {
    const record = asRecord(value);
    if (!record) return null;

    return {
        jobRoleFamily: String(record.jobRoleFamily || ''),
        candidateRoleFamily: String(record.candidateRoleFamily || ''),
        jobFamilyConfidence: clamp(asFiniteNumber(record.jobFamilyConfidence, 0), 0, 1),
        candidateFamilyConfidence: clamp(asFiniteNumber(record.candidateFamilyConfidence, 0), 0, 1),
        roleContextAlignment: clamp(asFiniteNumber(record.roleContextAlignment, 0), 0, 1),
        roleContextConfidence: clamp(asFiniteNumber(record.roleContextConfidence, 0), 0, 1),
        alignmentBand: String(record.alignmentBand || 'neutral'),
        rawAdjustment: asFiniteNumber(record.rawAdjustment, 0),
        effectiveAdjustment: asFiniteNumber(record.effectiveAdjustment, 0),
        adjustmentReason: String(record.adjustmentReason || ''),
        jobFamilyEvidence: asRecord(record.jobFamilyEvidence),
        candidateFamilyEvidence: asRecord(record.candidateFamilyEvidence),
    };
}

function normalizePenaltiesApplied(value: unknown): MatchPenaltiesApplied | null {
    const record = asRecord(value);
    if (!record) return null;

    return {
        missingCriticalCount: Number.isFinite(Number(record.missingCriticalCount))
            ? Number(record.missingCriticalCount)
            : undefined,
        criticalPenaltyAdjustment: asFiniteNumber(record.criticalPenaltyAdjustment, 0),
        confidenceAdjustment: asFiniteNumber(record.confidenceAdjustment, 0),
        roleContextAdjustment: asFiniteNumber(record.roleContextAdjustment, 0),
        severeSemanticMismatchPenalty: Number.isFinite(Number(record.severeSemanticMismatchPenalty))
            ? Number(record.severeSemanticMismatchPenalty)
            : undefined,
        severeSemanticMismatchAdjustment: asFiniteNumber(record.severeSemanticMismatchAdjustment, 0),
        total: asFiniteNumber(record.total, 0),
    };
}

function normalizeNeuralBreakdown(value: unknown): NeuralBreakdown | null {
    const record = asRecord(value);
    if (!record) return null;

    const similarity = asRecord(record.neuralSimilarityComponents);
    const weights = asRecord(record.neuralWeights);
    const semanticTexts = asRecord(record.semanticTextsUsed);

    return {
        semanticTextsUsed: semanticTexts
            ? {
                candidateOverall: typeof semanticTexts.candidateOverall === 'string' ? semanticTexts.candidateOverall : undefined,
                vacancyOverall: typeof semanticTexts.vacancyOverall === 'string' ? semanticTexts.vacancyOverall : undefined,
                candidateSkills: typeof semanticTexts.candidateSkills === 'string' ? semanticTexts.candidateSkills : undefined,
                vacancySkills: typeof semanticTexts.vacancySkills === 'string' ? semanticTexts.vacancySkills : undefined,
                candidateExperience: typeof semanticTexts.candidateExperience === 'string' ? semanticTexts.candidateExperience : undefined,
                vacancyExperience: typeof semanticTexts.vacancyExperience === 'string' ? semanticTexts.vacancyExperience : undefined,
            }
            : undefined,
        neuralSimilarityComponents: similarity
            ? {
                neuralOverallAlignment: clamp(asFiniteNumber(similarity.neuralOverallAlignment, 0), 0, 1),
                neuralSkillsAlignment: clamp(asFiniteNumber(similarity.neuralSkillsAlignment, 0), 0, 1),
                neuralExperienceAlignment: clamp(asFiniteNumber(similarity.neuralExperienceAlignment, 0), 0, 1),
            }
            : null,
        neuralWeights: weights
            ? {
                overall: asFiniteNumber(weights.overall, 0.5),
                skills: asFiniteNumber(weights.skills, 0.3),
                experience: asFiniteNumber(weights.experience, 0.2),
            }
            : undefined,
        semanticSharedConcepts: asStringArray(record.semanticSharedConcepts),
        providerStatus: typeof record.providerStatus === 'string' ? record.providerStatus : undefined,
        providerFlags: asStringArray(record.providerFlags),
        providerReasons: asStringArray(record.providerReasons),
    };
}

function normalizeFinalScoreComposition(value: unknown): FinalScoreComposition | null {
    const record = asRecord(value);
    if (!record) return null;

    return {
        neuralMatchScore: Number.isFinite(Number(record.neuralMatchScore))
            ? Number(record.neuralMatchScore)
            : null,
        ruleBasedMatchScore: asFiniteNumber(record.ruleBasedMatchScore, 0),
        finalMatchScore: asFiniteNumber(record.finalMatchScore, 0),
        dominantSource: typeof record.dominantSource === 'string' ? record.dominantSource : undefined,
    };
}

function normalizeMatchResult(payload: unknown): MatchResult {
    const data = asRecord(payload) || {};
    const scoringMeta = asRecord(data.scoringMeta);
    const neuralBreakdown = normalizeNeuralBreakdown(data.neuralBreakdown ?? scoringMeta?.neuralBreakdown);
    const confidence = normalizeConfidence(data.confidence ?? scoringMeta?.confidence);
    const roleContext = normalizeRoleContext(data.roleContext ?? scoringMeta?.roleContext);
    const penaltiesApplied = normalizePenaltiesApplied(data.penaltiesApplied ?? scoringMeta?.penaltiesApplied);
    const finalScoreComposition = normalizeFinalScoreComposition(scoringMeta?.finalScoreComposition);

    const finalScore = clamp(
        asFiniteNumber(
            data.finalMatchScore ?? data.matchPercentage ?? finalScoreComposition?.finalMatchScore,
            0
        ),
        0,
        100
    );
    const neuralMatchScore = Number.isFinite(Number(data.neuralMatchScore))
        ? clamp(Number(data.neuralMatchScore), 0, 100)
        : finalScoreComposition?.neuralMatchScore ?? null;
    const ruleBasedMatchScore = Number.isFinite(Number(data.ruleBasedMatchScore))
        ? clamp(Number(data.ruleBasedMatchScore), 0, 100)
        : finalScoreComposition?.ruleBasedMatchScore ?? null;

    return {
        matchPercentage: finalScore,
        neuralMatchScore,
        ruleBasedMatchScore,
        finalMatchScore: finalScore,
        strengths: asStringArray(data.strengths),
        gaps: asStringArray(data.gaps),
        recommendation:
            data.recommendation === 'Proceed' || data.recommendation === 'Review manually'
                ? data.recommendation
                : 'Reject',
        matchedCriticalSkills: asStringArray(data.matchedCriticalSkills),
        missingCriticalSkills: asStringArray(data.missingCriticalSkills),
        matchedCoreSkills: asStringArray(data.matchedCoreSkills),
        missingCoreSkills: asStringArray(data.missingCoreSkills),
        matchedOptionalSkills: asStringArray(data.matchedOptionalSkills),
        optionalCoverage: clamp(asFiniteNumber(data.optionalCoverage, 0), 0, 1),
        skillMatchBreakdown: Array.isArray(data.skillMatchBreakdown)
            ? data.skillMatchBreakdown.map((item) => {
                const record = asRecord(item) || {};
                return {
                    category: (record.category === 'critical' || record.category === 'optional') ? record.category : 'core',
                    requiredSkill: String(record.requiredSkill || ''),
                    matchedSkill: record.matchedSkill == null ? null : String(record.matchedSkill),
                    tier:
                        record.tier === 'exact' || record.tier === 'synonym' || record.tier === 'related'
                            ? record.tier
                            : 'none',
                    score: clamp(asFiniteNumber(record.score, 0), 0, 1),
                    matchSource: typeof record.matchSource === 'string'
                        ? record.matchSource as 'exact' | 'synonym-group' | 'related-group' | 'token-overlap' | 'none'
                        : undefined,
                    requiredCanonical: record.requiredCanonical == null ? null : String(record.requiredCanonical),
                    matchedCanonical: record.matchedCanonical == null ? null : String(record.matchedCanonical),
                    matchedTierScore: Number.isFinite(Number(record.matchedTierScore))
                        ? clamp(Number(record.matchedTierScore), 0, 1)
                        : undefined,
                };
            })
            : [],
        neuralBreakdown,
        confidence,
        roleContext,
        penaltiesApplied,
        scoringMeta: scoringMeta || undefined,
        providerStatus: neuralBreakdown?.providerStatus,
        providerFlags: neuralBreakdown?.providerFlags,
        providerReasons: neuralBreakdown?.providerReasons,
        finalScoreComposition,
    };
}

export async function loginUser(email: string, password: string): Promise<AuthUser> {
    let res: Response;
    try {
        res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
    } catch (error) {
        throw new Error(getNetworkErrorMessage(error));
    }

    if (!res.ok) {
        throw await parseError(res, 'Не вдалося виконати вхід');
    }

    return normalizeAuthUser(await res.json());
}

export async function registerUser(name: string, email: string, password: string): Promise<AuthUser> {
    let res: Response;
    try {
        res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password }),
        });
    } catch (error) {
        throw new Error(getNetworkErrorMessage(error));
    }

    if (!res.ok) {
        throw await parseError(res, 'Не вдалося зареєструвати користувача');
    }

    return normalizeAuthUser(await res.json());
}

export async function analyzeResume(file: File): Promise<ResumeAnalysis> {
    const formData = new FormData();
    formData.append('resume', file);

    let res: Response;
    try {
        res = await fetch(`${API_URL}/ai/analyze-resume`, {
            method: 'POST',
            body: formData,
        });
    } catch (error) {
        throw new Error(getNetworkErrorMessage(error));
    }

    if (!res.ok) {
        throw await parseError(res, 'Не вдалося проаналізувати резюме');
    }

    return res.json();
}

export async function matchCandidateToJob(
    analysis: ResumeAnalysis,
    job: Job
): Promise<MatchResult> {
    let res: Response;
    try {
        res = await fetch(`${API_URL}/ai/match`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ analysis, job }),
        });
    } catch (error) {
        throw new Error(getNetworkErrorMessage(error));
    }

    if (!res.ok) {
        throw await parseError(res, 'Не вдалося виконати оцінювання');
    }

    return normalizeMatchResult(await res.json());
}

// Jobs CRUD
export async function fetchJobs(): Promise<Job[]> {
    let res: Response;
    try {
        res = await fetch(`${API_URL}/jobs`);
    } catch (error) {
        throw new Error(getNetworkErrorMessage(error));
    }
    if (!res.ok) throw await parseError(res, 'Не вдалося завантажити вакансії');
    return res.json();
}

export async function createJob(job: Omit<Job, 'id'>): Promise<Job> {
    let res: Response;
    try {
        res = await fetch(`${API_URL}/jobs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(job),
        });
    } catch (error) {
        throw new Error(getNetworkErrorMessage(error));
    }
    if (!res.ok) throw await parseError(res, 'Не вдалося створити вакансію');
    return res.json();
}

export async function updateJob(
    id: string,
    patch: Partial<Omit<Job, 'id'>>
): Promise<Job> {
    let res: Response;
    try {
        res = await fetch(`${API_URL}/jobs/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch),
        });
    } catch (error) {
        throw new Error(getNetworkErrorMessage(error));
    }
    if (!res.ok) throw await parseError(res, 'Не вдалося оновити вакансію');
    return res.json();
}

export async function deleteJob(id: string): Promise<void> {
    let res: Response;
    try {
        res = await fetch(`${API_URL}/jobs/${id}`, { method: 'DELETE' });
    } catch (error) {
        throw new Error(getNetworkErrorMessage(error));
    }
    if (!res.ok) throw await parseError(res, 'Не вдалося видалити вакансію');
}

// Candidates CRUD
export async function fetchCandidates(params?: { includeRejected?: boolean; vacancyId?: string }): Promise<Candidate[]> {
    let res: Response;
    const search = new URLSearchParams();
    if (params?.includeRejected) search.set('includeRejected', 'true');
    if (params?.vacancyId) search.set('vacancyId', params.vacancyId);
    const query = search.toString();
    try {
        res = await fetch(`${API_URL}/candidates${query ? `?${query}` : ''}`);
    } catch (error) {
        throw new Error(getNetworkErrorMessage(error));
    }
    if (!res.ok) throw await parseError(res, 'Не вдалося завантажити кандидатів');
    return res.json();
}

export async function fetchTrashCandidates(): Promise<{ retentionDays: number; items: Candidate[] }> {
    let res: Response;
    try {
        res = await fetch(`${API_URL}/candidates/trash`);
    } catch (error) {
        throw new Error(getNetworkErrorMessage(error));
    }
    if (!res.ok) throw await parseError(res, 'Не вдалося завантажити кошик кандидатів');
    return res.json();
}

export async function createCandidate(candidate: Omit<Candidate, 'id'>): Promise<Candidate> {
    const { resumeFile, ...payload } = candidate;
    let res: Response;
    try {
        res = await fetch(`${API_URL}/candidates`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    } catch (error) {
        throw new Error(getNetworkErrorMessage(error));
    }
    if (!res.ok) throw await parseError(res, 'Не вдалося створити кандидата');
    return res.json();
}

export async function fetchCandidateById(id: string): Promise<Candidate> {
    let res: Response;
    try {
        res = await fetch(`${API_URL}/candidates/${id}`);
    } catch (error) {
        throw new Error(getNetworkErrorMessage(error));
    }
    if (!res.ok) throw await parseError(res, 'Не вдалося завантажити кандидата');
    return res.json();
}

export async function updateCandidate(
    id: string,
    payload: Partial<Omit<Candidate, 'id' | 'resumeFile'>>
): Promise<Candidate> {
    let res: Response;
    try {
        res = await fetch(`${API_URL}/candidates/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    } catch (error) {
        throw new Error(getNetworkErrorMessage(error));
    }
    if (!res.ok) throw await parseError(res, 'Не вдалося оновити дані кандидата');
    return res.json();
}

export async function updateCandidateStatus(
    id: string,
    status: ColumnStatus,
    options?: { rejectionReason?: string; comment?: string }
): Promise<Candidate> {
    let res: Response;
    try {
        res = await fetch(`${API_URL}/candidates/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status,
                rejectionReason: options?.rejectionReason,
                comment: options?.comment,
            }),
        });
    } catch (error) {
        throw new Error(getNetworkErrorMessage(error));
    }
    if (!res.ok) throw await parseError(res, 'Не вдалося оновити статус кандидата');
    return res.json();
}

export async function restoreCandidateFromTrash(
    id: string,
    status: Exclude<ColumnStatus, 'Rejected'> = 'New'
): Promise<Candidate> {
    let res: Response;
    try {
        res = await fetch(`${API_URL}/candidates/${id}/restore`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
        });
    } catch (error) {
        throw new Error(getNetworkErrorMessage(error));
    }
    if (!res.ok) throw await parseError(res, 'Не вдалося відновити кандидата');
    return res.json();
}

