export type ColumnStatus = 'New' | 'Screening' | 'Interview' | 'Test Task' | 'Offer' | 'Hired' | 'Rejected';

export interface CandidateStatusHistoryEntry {
    from: ColumnStatus | null;
    to: ColumnStatus;
    changedAt: string;
    changedBy?: string;
    reason?: string;
    comment?: string;
}

export interface Candidate {
    id: string;
    name: string;
    surname: string;
    vacancyId?: string | null;
    position: string;
    ownerId?: string;
    avatar: string;
    progress: number;
    deadline: string;
    email?: string;
    phone?: string;
    linkedin?: string;
    status: ColumnStatus;
    stageEnteredAt?: string | null;
    nextActionAt?: string | null;
    rejectionReason?: string;
    statusHistory?: CandidateStatusHistoryEntry[];
    isOverdue?: boolean;
    rejectedAt?: string | null;
    trashDeleteAfter?: string | null;
    createdAt?: string;
    updatedAt?: string;
    resumeFile?: File | null;
    resumeAnalysis?: ResumeAnalysis | null;
}

export interface Column {
    id: ColumnStatus;
    title: string;
    color: string;
    dotClass: string;
    candidates: Candidate[];
}

// --- Jobs ---
export interface Job {
    id: string;
    title: string;
    department: string;
    candidatesCount: number;
    status: 'Active' | 'Closed' | 'Draft';
    postedDate: string;
    description?: string;
    requirements?: string[];
    stack?: string[];
    criticalSkills?: string[];
    coreSkills?: string[];
    optionalSkills?: string[];
}

// --- AI Resume Analysis (розширений з parsed даними) ---
export interface ResumeAnalysis {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    position: string;
    linkedin: string;
    skills: string[];
    level: 'Junior' | 'Middle' | 'Senior';
    yearsOfExperience: number;
    generalYearsExperience?: number;
    relevantYearsExperience?: number | null;
    technologies: string[];
    softSkills: string[];
    overallScore: number; // 1-10
    summary: string;
    education: string;
    languages: string[];
    scoringMeta?: Record<string, unknown>;
}

export interface MatchConfidence {
    matchConfidenceScore: number;
    flags: string[];
    reasons: string[];
}

export interface MatchRoleContext {
    jobRoleFamily: string;
    candidateRoleFamily: string;
    jobFamilyConfidence: number;
    candidateFamilyConfidence: number;
    roleContextAlignment: number;
    roleContextConfidence: number;
    alignmentBand: 'strong' | 'medium' | 'weak' | 'neutral' | string;
    rawAdjustment: number;
    effectiveAdjustment: number;
    adjustmentReason: string;
    jobFamilyEvidence?: Record<string, unknown> | null;
    candidateFamilyEvidence?: Record<string, unknown> | null;
}

export interface MatchPenaltiesApplied {
    missingCriticalCount?: number;
    criticalPenaltyAdjustment: number;
    confidenceAdjustment: number;
    roleContextAdjustment: number;
    severeSemanticMismatchPenalty?: number;
    severeSemanticMismatchAdjustment: number;
    total: number;
}

export interface NeuralSimilarityComponents {
    neuralOverallAlignment: number;
    neuralSkillsAlignment: number;
    neuralExperienceAlignment: number;
}

export interface NeuralSemanticTextsUsed {
    candidateOverall?: string;
    vacancyOverall?: string;
    candidateSkills?: string;
    vacancySkills?: string;
    candidateExperience?: string;
    vacancyExperience?: string;
}

export interface NeuralBreakdown {
    semanticTextsUsed?: NeuralSemanticTextsUsed;
    neuralSimilarityComponents: NeuralSimilarityComponents | null;
    neuralWeights?: {
        overall: number;
        skills: number;
        experience: number;
    };
    semanticSharedConcepts?: string[];
    providerStatus?: string;
    providerFlags?: string[];
    providerReasons?: string[];
}

export interface FinalScoreComposition {
    neuralMatchScore: number | null;
    ruleBasedMatchScore: number;
    finalMatchScore: number;
    dominantSource?: 'neural' | 'rule-based-fallback' | string;
}

// --- Match Result ---
export interface MatchResult {
    matchPercentage: number;
    neuralMatchScore?: number | null;
    ruleBasedMatchScore?: number | null;
    finalMatchScore?: number;
    strengths: string[];
    gaps: string[];
    recommendation: 'Proceed' | 'Review manually' | 'Reject';
    matchedCriticalSkills?: string[];
    missingCriticalSkills?: string[];
    matchedCoreSkills?: string[];
    missingCoreSkills?: string[];
    matchedOptionalSkills?: string[];
    optionalCoverage?: number;
    skillMatchBreakdown?: Array<{
        category: 'critical' | 'core' | 'optional';
        requiredSkill: string;
        matchedSkill: string | null;
        tier: 'exact' | 'synonym' | 'related' | 'none';
        score: number;
        matchSource?: 'exact' | 'synonym-group' | 'related-group' | 'token-overlap' | 'none';
        requiredCanonical?: string | null;
        matchedCanonical?: string | null;
        matchedTierScore?: number;
    }>;
    neuralBreakdown?: NeuralBreakdown | null;
    confidence?: MatchConfidence | null;
    roleContext?: MatchRoleContext | null;
    penaltiesApplied?: MatchPenaltiesApplied | null;
    scoringMeta?: Record<string, unknown>;
    providerStatus?: string;
    providerFlags?: string[];
    providerReasons?: string[];
    finalScoreComposition?: FinalScoreComposition | null;
}

export interface AuthUser {
    id: string;
    name: string;
    token: string;
}
